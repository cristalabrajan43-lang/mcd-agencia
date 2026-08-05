"""
User Views for MCD-Agencia.

This module provides ViewSets and views for user operations:
    - User registration and authentication
    - Profile management
    - Role management (admin)
    - Fiscal data management
    - Consent tracking
    - OAuth authentication (Google)
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Max, Q, Sum, Value, DecimalField
from django.db.models.functions import Coalesce
from django.shortcuts import redirect
from django.utils.translation import gettext_lazy as _
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from urllib.parse import urlencode

from apps.audit.models import AuditLog
from apps.core.pagination import StandardResultsSetPagination
from apps.core.permissions import IsRoleAdmin
from .models import Role, UserConsent, FiscalData, UserAddress
from .tasks import send_verification_email
from .serializers import (
    UserRegistrationSerializer,
    UserSerializer,
    UserUpdateSerializer,
    ChangePasswordSerializer,
    RoleSerializer,
    UserConsentSerializer,
    FiscalDataSerializer,
    UserAdminSerializer,
    UserAddressSerializer,
    ClientSummarySerializer,
)

logger = logging.getLogger(__name__)

User = get_user_model()


def _is_internal_user(user) -> bool:
    role_name = getattr(getattr(user, 'role', None), 'name', None)
    return bool(getattr(user, 'is_superuser', False) or role_name in ['admin', 'superadmin', 'sales'])


class UserRegistrationView(APIView):
    """
    Handle user registration.

    POST /api/v1/auth/register/
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Register a new user."""
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Atomic: if anything fails inside, user + consents are rolled back
        with transaction.atomic():
            user = serializer.save()

            # Create consent records
            UserConsent.objects.create(
                user=user,
                document_type='terms',
                document_version='1.0',
                ip_address=self._get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                method='registration_form'
            )
            UserConsent.objects.create(
                user=user,
                document_type='privacy',
                document_version='1.0',
                ip_address=self._get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                method='registration_form'
            )

            # Log registration
            AuditLog.log(
                entity=user,
                action=AuditLog.ACTION_CREATED,
                actor=user,
                request=request,
                metadata={'source': 'registration'}
            )

        # ---- Outside the transaction: side-effects that must NOT roll back ----

        # Send verification email (runs synchronously with ALWAYS_EAGER)
        email_sent = False
        email_error = None
        try:
            result = send_verification_email(str(user.id))
            email_sent = bool(result)
        except Exception as exc:
            email_error = f"{type(exc).__name__}: {exc}"
            logger.error(
                f"Failed to send verification email to {user.email}: {email_error}",
                exc_info=True,
            )

        # In-app notification to admins: new user registered
        try:
            from apps.notifications.models import Notification
            Notification.notify_admins(
                notification_type=Notification.TYPE_NEW_USER,
                title='Nuevo usuario registrado',
                message=f'{user.full_name} ({user.email})',
                entity_type='User',
                entity_id=user.id,
                action_url=f'/dashboard/clientes',
            )
        except Exception:
            pass

        return Response(
            {
                'message': _('Registration successful. Please verify your email.'),
                'user': UserSerializer(user).data,
                'email_sent': email_sent,
                **(
                    {'email_error': email_error} if email_error else {}
                ),
            },
            status=status.HTTP_201_CREATED
        )

    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class VerifyEmailView(APIView):
    """
    Verify a user's email address via signed token.

    POST /api/v1/auth/verify-email/
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response(
                {'error': _('Verification token is required.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.verify_email_token(token)
        if user is None:
            return Response(
                {'error': _('Invalid or expired verification link.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.is_email_verified:
            return Response({'message': _('Email already verified.')})

        user.is_email_verified = True
        user.save(update_fields=['is_email_verified', 'updated_at'])

        return Response({'message': _('Email verified successfully.')})


class ResendVerificationView(APIView):
    """
    Resend email verification link.

    POST /api/v1/auth/resend-verification/
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response(
                {'error': _('Email address is required.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email=email, is_email_verified=False)
        except User.DoesNotExist:
            # Don't reveal whether email exists — return success either way
            return Response(
                {'message': _('If the email exists and is not verified, a new link has been sent.')}
            )

        # Call the task directly (runs synchronously with ALWAYS_EAGER)
        # so we can catch and report the real error to the user.
        try:
            result = send_verification_email(str(user.id))
            if result:
                return Response(
                    {'message': _('If the email exists and is not verified, a new link has been sent.')}
                )
            else:
                logger.error(f"send_verification_email returned False for {email}")
                return Response(
                    {'error': _('Could not send verification email. Please try again later.')},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        except Exception as exc:
            logger.error(
                f"Failed to send verification email to {email}: "
                f"{type(exc).__name__}: {exc}",
                exc_info=True,
            )
            return Response(
                {
                    'error': _('Could not send verification email. Please try again later.'),
                    'detail': f'{type(exc).__name__}: {exc}',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class UserProfileView(APIView):
    """
    Handle user profile operations.

    GET /api/v1/users/me/
    PATCH /api/v1/users/me/
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get current user profile."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        """Update current user profile."""
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)

        # Store before state for audit
        before_state = UserSerializer(request.user).data

        serializer.save()

        # Log profile update
        AuditLog.log(
            entity=request.user,
            action=AuditLog.ACTION_UPDATED,
            actor=request.user,
            before_state=before_state,
            after_state=UserSerializer(request.user).data,
            request=request
        )

        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """
    Handle password change.

    POST /api/v1/users/change-password/
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Change user password."""
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password', 'updated_at'])

        # Log password change
        AuditLog.log(
            entity=request.user,
            action=AuditLog.ACTION_PASSWORD_CHANGED,
            actor=request.user,
            request=request
        )

        return Response({'message': _('Password changed successfully.')})


class RoleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for role management (admin only).

    GET /api/v1/users/roles/
    POST /api/v1/users/roles/
    GET /api/v1/users/roles/{id}/
    PUT /api/v1/users/roles/{id}/
    DELETE /api/v1/users/roles/{id}/
    """

    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsRoleAdmin]
    pagination_class = StandardResultsSetPagination

    def perform_create(self, serializer):
        """Log role creation."""
        role = serializer.save()
        AuditLog.log(
            entity=role,
            action=AuditLog.ACTION_CREATED,
            actor=self.request.user,
            after_state=RoleSerializer(role).data,
            request=self.request
        )

    def perform_update(self, serializer):
        """Log role update."""
        before_state = RoleSerializer(self.get_object()).data
        role = serializer.save()
        AuditLog.log(
            entity=role,
            action=AuditLog.ACTION_UPDATED,
            actor=self.request.user,
            before_state=before_state,
            after_state=RoleSerializer(role).data,
            request=self.request
        )

    def perform_destroy(self, instance):
        """Log role deletion."""
        AuditLog.log(
            entity=instance,
            action=AuditLog.ACTION_DELETED,
            actor=self.request.user,
            before_state=RoleSerializer(instance).data,
            request=self.request
        )
        instance.delete()


class UserConsentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user consent management.

    GET /api/v1/users/consents/
    POST /api/v1/users/consents/
    """

    serializer_class = UserConsentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return consents for current user."""
        return UserConsent.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Create consent with user and request metadata."""
        serializer.save(
            user=self.request.user,
            ip_address=self._get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', '')[:500]
        )

    def _get_client_ip(self):
        """Get client IP address."""
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return self.request.META.get('REMOTE_ADDR')

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke a consent."""
        from django.utils import timezone
        consent = self.get_object()
        consent.revoked_at = timezone.now()
        consent.save(update_fields=['revoked_at', 'updated_at'])
        return Response({'message': _('Consent revoked.')})


class FiscalDataViewSet(viewsets.ModelViewSet):
    """
    ViewSet for fiscal data management.

    GET /api/v1/users/fiscal-data/
    POST /api/v1/users/fiscal-data/
    PUT /api/v1/users/fiscal-data/{id}/
    DELETE /api/v1/users/fiscal-data/{id}/
    """

    serializer_class = FiscalDataSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        """Return fiscal data for current user."""
        return FiscalData.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Create fiscal data for current user."""
        fiscal_data = serializer.save(user=self.request.user)

        # If marked as default, unset other defaults
        if fiscal_data.is_default:
            FiscalData.objects.filter(
                user=self.request.user, is_default=True
            ).exclude(id=fiscal_data.id).update(is_default=False)

    def perform_update(self, serializer):
        """Update fiscal data."""
        fiscal_data = serializer.save()

        # If marked as default, unset other defaults
        if fiscal_data.is_default:
            FiscalData.objects.filter(
                user=self.request.user, is_default=True
            ).exclude(id=fiscal_data.id).update(is_default=False)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set fiscal data as default."""
        fiscal_data = self.get_object()
        FiscalData.objects.filter(
            user=request.user, is_default=True
        ).update(is_default=False)
        fiscal_data.is_default = True
        fiscal_data.save(update_fields=['is_default', 'updated_at'])
        return Response(FiscalDataSerializer(fiscal_data).data)


class UserAddressViewSet(viewsets.ModelViewSet):
    """
    ViewSet for saved delivery addresses.

    GET /api/v1/users/addresses/
    POST /api/v1/users/addresses/
    PUT /api/v1/users/addresses/{id}/
    DELETE /api/v1/users/addresses/{id}/
    """

    serializer_class = UserAddressSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        """Return addresses for current user."""
        return UserAddress.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Create address for current user."""
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set address as default."""
        address = self.get_object()
        UserAddress.objects.filter(
            user=request.user, is_default=True
        ).update(is_default=False)
        address.is_default = True
        address.save(update_fields=['is_default', 'updated_at'])
        return Response(UserAddressSerializer(address).data)


class UserAdminViewSet(viewsets.ModelViewSet):
    """
    Admin ViewSet for user management.

    GET /api/v1/admin/users/
    GET /api/v1/admin/users/{id}/
    PUT /api/v1/admin/users/{id}/
    DELETE /api/v1/admin/users/{id}/
    """

    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filterset_fields = ['role', 'is_active', 'is_staff', 'is_email_verified']
    search_fields = ['email', 'first_name', 'last_name', 'phone']
    ordering_fields = ['created_at', 'last_login', 'email']
    ordering = ['-created_at']

    def check_permissions(self, request):
        """Restrict actions: clients for internal users, rest for admins only."""
        super().check_permissions(request)

        if self.action == 'clients':
            if not _is_internal_user(request.user):
                self.permission_denied(request)
            return

        role_name = getattr(getattr(request.user, 'role', None), 'name', None)
        is_admin = bool(request.user.is_superuser or role_name in [Role.ADMIN, Role.SUPERADMIN])
        if not is_admin:
            self.permission_denied(request)

    def get_queryset(self):
        return User.objects.select_related('role').filter(is_deleted=False).annotate(
            orders_count=Count('orders', filter=Q(orders__is_deleted=False), distinct=True),
            quotes_count=Count('quote_requests', filter=Q(quote_requests__is_deleted=False), distinct=True),
            total_spent=Coalesce(
                Sum('orders__amount_paid', filter=Q(orders__is_deleted=False)),
                Value(0),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
            last_order_date=Max('orders__created_at', filter=Q(orders__is_deleted=False)),
        )

    @action(detail=False, methods=['get'])
    def clients(self, request):
        """List customer users for clients dashboard."""
        queryset = self.get_queryset().filter(role__name=Role.CUSTOMER)

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(company__icontains=search)
            )

        page = self.paginate_queryset(queryset)
        serializer = ClientSummarySerializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def perform_update(self, serializer):
        """Log user update by admin."""
        before_state = UserAdminSerializer(self.get_object()).data
        user = serializer.save()
        AuditLog.log(
            entity=user,
            action=AuditLog.ACTION_UPDATED,
            actor=self.request.user,
            before_state=before_state,
            after_state=UserAdminSerializer(user).data,
            request=self.request,
            metadata={'admin_action': True}
        )

    def perform_destroy(self, instance):
        """Soft delete user."""
        AuditLog.log(
            entity=instance,
            action=AuditLog.ACTION_DELETED,
            actor=self.request.user,
            before_state=UserAdminSerializer(instance).data,
            request=self.request,
            metadata={'admin_action': True}
        )
        if instance.is_active:
            instance.is_active = False
            instance.save(update_fields=['is_active', 'updated_at'])
        instance.delete()

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user account."""
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=['is_active', 'updated_at'])

        AuditLog.log(
            entity=user,
            action=AuditLog.ACTION_STATE_CHANGED,
            actor=request.user,
            request=request,
            metadata={'action': 'activate'}
        )

        return Response({'message': _('User activated.')})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user account."""
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active', 'updated_at'])

        AuditLog.log(
            entity=user,
            action=AuditLog.ACTION_STATE_CHANGED,
            actor=request.user,
            request=request,
            metadata={'action': 'deactivate'}
        )

        return Response({'message': _('User deactivated.')})

    @action(detail=True, methods=['post'])
    def change_role(self, request, pk=None):
        """Change user role."""
        user = self.get_object()
        role_id = request.data.get('role_id')

        if not role_id:
            return Response(
                {'error': _('role_id is required.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            role = Role.objects.get(id=role_id)
        except Role.DoesNotExist:
            return Response(
                {'error': _('Role not found.')},
                status=status.HTTP_404_NOT_FOUND
            )

        old_role = user.role
        user.role = role

        # Sync is_staff based on new role
        if role.name in (Role.ADMIN, Role.SALES):
            user.is_staff = True
        elif role.name == Role.CUSTOMER and not user.is_superuser:
            user.is_staff = False

        user.save(update_fields=['role', 'is_staff', 'updated_at'])

        AuditLog.log(
            entity=user,
            action=AuditLog.ACTION_PERMISSION_CHANGED,
            actor=request.user,
            before_state={'role': str(old_role.id) if old_role else None},
            after_state={'role': str(role.id), 'is_staff': user.is_staff},
            request=request
        )

        return Response(UserAdminSerializer(user).data)

    @action(detail=True, methods=['post'])
    def assign_group(self, request, pk=None):
        """Assign user to an operational group."""
        from django.contrib.auth.models import Group
        
        user = self.get_object()
        group_name = request.data.get('group')
        
        if not group_name:
            return Response(
                {'error': _('group is required.')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Only allow production_supervisors and operations_supervisors groups
        if group_name not in ['production_supervisors', 'operations_supervisors']:
            return Response(
                {'error': _('Invalid group. Must be one of: production_supervisors, operations_supervisors')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            group = Group.objects.get(name=group_name)
        except Group.DoesNotExist:
            return Response(
                {'error': _('Group not found.')},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Add user to group (if already in group, it's idempotent)
        user.groups.add(group)
        
        AuditLog.log(
            entity=user,
            action=AuditLog.ACTION_PERMISSION_CHANGED,
            actor=request.user,
            after_state={'group_added': group_name},
            request=request,
            metadata={'group_action': 'assign', 'group': group_name}
        )
        
        return Response({
            'message': _('User assigned to group.'),
            'user': UserAdminSerializer(user).data,
            'groups': list(user.groups.values_list('name', flat=True))
        })

    @action(detail=False, methods=['post'])
    def create_with_password(self, request):
        """Create a new user with a temporary password."""
        import secrets
        import string
        
        email = request.data.get('email')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        phone = request.data.get('phone', '')
        role_id = request.data.get('role_id')
        groups = request.data.get('groups', [])  # List of group names
        
        if not email:
            return Response(
                {'error': _('email is required.')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user already exists
        if User.objects.filter(email=email).exists():
            return Response(
                {'error': _('User with this email already exists.')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get role if provided
        role = None
        if role_id:
            try:
                role = Role.objects.get(id=role_id)
            except Role.DoesNotExist:
                return Response(
                    {'error': _('Role not found.')},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Generate temporary password
        alphabet = string.ascii_letters + string.digits
        temporary_password = ''.join(secrets.choice(alphabet) for i in range(12))
        
        with transaction.atomic():
            # Create user
            user = User.objects.create_user(
                email=email,
                password=temporary_password,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                role=role,
                is_active=True,
                is_email_verified=True,  # Admin-created users are pre-verified
            )
            
            # Set is_staff if role is admin or sales
            if role and role.name in (Role.ADMIN, Role.SALES):
                user.is_staff = True
                user.save(update_fields=['is_staff'])
            
            # Add to groups if provided
            if groups:
                from django.contrib.auth.models import Group
                for group_name in groups:
                    if group_name in ['production_supervisors', 'operations_supervisors']:
                        try:
                            group = Group.objects.get(name=group_name)
                            user.groups.add(group)
                        except Group.DoesNotExist:
                            pass
            
            # Log action
            AuditLog.log(
                entity=user,
                action=AuditLog.ACTION_CREATED,
                actor=request.user,
                after_state={'email': email, 'role': str(role.id) if role else None},
                request=request,
                metadata={'admin_action': 'create_with_password', 'groups': groups}
            )
        
        return Response({
            'message': _('User created successfully.'),
            'user': UserAdminSerializer(user).data,
            'temporary_password': temporary_password,
            'groups': list(user.groups.values_list('name', flat=True))
        }, status=status.HTTP_201_CREATED)
        """List customer users with commercial metrics for dashboard/clients."""
        queryset = self.get_queryset().filter(
            Q(role__name=Role.CUSTOMER) | Q(role__isnull=True)
        )

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(company__icontains=search)
            )

        queryset = queryset.order_by('-created_at')

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ClientSummarySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ClientSummarySerializer(queryset, many=True)
        return Response(serializer.data)


class AdminCreateUserView(APIView):
    """Create a new user with temporary password."""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """POST /api/v1/admin/users/create_with_password/"""
        from apps.core.views import is_internal_user
        import secrets
        import string
        
        if not is_internal_user(request.user):
            return Response(
                {'error': _('Only internal users can create users.')},
                status=status.HTTP_403_FORBIDDEN
            )
        
        email = request.data.get('email')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        phone = request.data.get('phone', '')
        role_id = request.data.get('role_id')
        groups = request.data.get('groups', [])
        
        if not email:
            return Response({'error': _('email is required.')}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(email=email).exists():
            return Response({'error': _('User already exists.')}, status=status.HTTP_400_BAD_REQUEST)
        
        role = None
        if role_id:
            try:
                role = Role.objects.get(id=role_id)
            except Role.DoesNotExist:
                return Response({'error': _('Role not found.')}, status=status.HTTP_404_NOT_FOUND)
        
        # Generate temporary password
        alphabet = string.ascii_letters + string.digits
        temporary_password = ''.join(secrets.choice(alphabet) for i in range(12))
        user = None
        
        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                password=temporary_password,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                role=role,
                is_active=True,
                is_email_verified=False,
            )
            
            if role and role.name in (Role.ADMIN, Role.SALES):
                user.is_staff = True
                user.save(update_fields=['is_staff'])
            
            if groups:
                from django.contrib.auth.models import Group
                for group_name in groups:
                    if group_name in ['production_supervisors', 'operations_supervisors']:
                        try:
                            group = Group.objects.get(name=group_name)
                            user.groups.add(group)
                        except Group.DoesNotExist:
                            pass
            
            AuditLog.log(
                entity=user,
                action=AuditLog.ACTION_CREATED,
                actor=request.user,
                after_state={'email': email},
                request=request
            )

        # IMPORTANT: send synchronously from API process so delivery does not depend on a Celery worker.
        # If the provider fails, keep the user and return a safe fallback with temporary password.
        from apps.users.tasks import send_setup_email_sync
        email_sent = False
        email_error = None
        try:
            email_sent = bool(send_setup_email_sync(user_id=str(user.id), temporary_password=temporary_password))
        except Exception as exc:
            email_error = str(exc)
            logger.exception('Setup email delivery failed for user_id=%s email=%s', user.id, user.email)

        if email_sent:
            return Response({
                'message': _('Usuario creado exitosamente. Se envió un correo de verificación.'),
                'email': user.email,
                'success': True,
                'email_sent': True,
                'temporary_password': temporary_password,
            }, status=status.HTTP_201_CREATED)

        return Response({
            'message': _('Usuario creado, pero no se pudo enviar correo. Comparte la contraseña temporal manualmente.'),
            'email': user.email,
            'success': True,
            'email_sent': False,
            'temporary_password': temporary_password,
            'email_error': email_error,
        }, status=status.HTTP_201_CREATED)


class AdminAssignGroupView(APIView):
    """Assign user to operational group."""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, user_id):
        """POST /api/v1/admin/users/{user_id}/assign_group/"""
        from apps.core.views import is_internal_user
        from django.contrib.auth.models import Group
        
        if not is_internal_user(request.user):
            return Response(
                {'error': _('Only internal users can assign groups.')},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': _('User not found.')}, status=status.HTTP_404_NOT_FOUND)
        
        group_name = request.data.get('group')
        if not group_name or group_name not in ['production_supervisors', 'operations_supervisors']:
            return Response(
                {'error': _('Invalid group.')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            group = Group.objects.get(name=group_name)
            user.groups.add(group)
        except Group.DoesNotExist:
            return Response({'error': _('Group not found.')}, status=status.HTTP_404_NOT_FOUND)
        
        AuditLog.log(
            entity=user,
            action=AuditLog.ACTION_PERMISSION_CHANGED,
            actor=request.user,
            metadata={'group': group_name},
            request=request
        )
        
        return Response({
            'message': _('User assigned to group.'),
            'user': UserAdminSerializer(user).data,
            'groups': list(user.groups.values_list('name', flat=True))
        })


class SalesRepsView(APIView):
    """
    Get list of available sales representatives.

    GET /api/v1/users/sales-reps/
    """

    permission_classes = [IsRoleAdmin]

    def get(self, request):
        """Get list of sales reps for assignment."""
        sales_role = Role.objects.filter(name='sales').first()

        if not sales_role:
            return Response([])

        sales_reps = User.objects.filter(
            role=sales_role,
            is_active=True,
            receives_auto_assignments=True
        ).order_by('first_name', 'last_name')

        data = [
            {
                'id': str(rep.id),
                'full_name': rep.full_name,
                'email': rep.email,
                'current_load': rep.current_load,
                'max_load': rep.max_load,
            }
            for rep in sales_reps
        ]

        return Response(data)


class GoogleOAuthCallbackView(APIView):
    """
    Handle Google OAuth callback and redirect to frontend with JWT tokens.

    This view is called after successful Google authentication.
    It generates JWT tokens and redirects to the frontend with tokens in URL params.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Handle OAuth callback after Google authentication."""
        import logging
        logger = logging.getLogger(__name__)

        # Check if user is authenticated via allauth
        if not request.user.is_authenticated:
            # Redirect to frontend with error
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            error_params = urlencode({'error': 'authentication_failed'})
            logger.warning("OAuth callback: User not authenticated, redirecting with error")
            return redirect(f'{frontend_url}/auth/callback?{error_params}')

        user = request.user
        logger.info(f"OAuth callback: User authenticated (id={user.id})")

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        # Log OAuth login
        try:
            AuditLog.log(
                entity=user,
                action=AuditLog.ACTION_LOGIN,
                actor=user,
                request=request,
                metadata={'provider': 'google', 'oauth': True}
            )
        except Exception as e:
            logger.error(f"OAuth callback: Failed to log audit entry: {type(e).__name__}")
            pass  # Don't fail if audit logging fails

        # Logout from Django session (we're using JWT for auth)
        from django.contrib.auth import logout
        logout(request)

        # Redirect to frontend with tokens
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        params = urlencode({
            'access': access_token,
            'refresh': refresh_token,
        })

        redirect_url = f'{frontend_url}/auth/callback?{params}'
        logger.info(f"OAuth callback: Redirecting user (id={user.id}) to frontend")

        return redirect(redirect_url)



class VerifyTemporaryPasswordView(APIView):
    """Verify temporary password and get setup token."""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        """POST /api/v1/users/verify-temp-password/"""
        email = request.data.get('email')
        temporary_password = request.data.get('temporary_password')
        
        if not email or not temporary_password:
            return Response(
                {'error': _('Email and temporary password are required.')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': _('Invalid email or temporary password.')},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Verify the temporary password
        if not user.check_password(temporary_password):
            return Response(
                {'error': _('Invalid email or temporary password.')},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Generate a setup token (valid for 24 hours)
        from django.contrib.auth.tokens import default_token_generator
        setup_token = default_token_generator.make_token(user)
        
        return Response({
            'message': _('Verification successful. Proceed to set your password.'),
            'setup_token': setup_token,
            'user': {
                'id': str(user.id),
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            }
        }, status=status.HTTP_200_OK)


class CompleteUserSetupView(APIView):
    """Complete user setup by setting final password."""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        """POST /api/v1/users/complete-setup/"""
        email = request.data.get('email')
        setup_token = request.data.get('setup_token')
        new_password = request.data.get('password')
        
        if not all([email, setup_token, new_password]):
            return Response(
                {'error': _('Email, setup token, and password are required.')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': _('User not found.')},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify the setup token
        from django.contrib.auth.tokens import default_token_generator
        if not default_token_generator.check_token(user, setup_token):
            return Response(
                {'error': _('Setup token is invalid or expired.')},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Validate password requirements
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response(
                {'error': _('Password does not meet requirements.'), 'details': e.messages},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set new password and verify email
        user.set_password(new_password)
        user.is_email_verified = True
        user.save(update_fields=['password', 'is_email_verified', 'updated_at'])
        
        # Log the action
        AuditLog.log(
            entity=user,
            action=AuditLog.ACTION_PERMISSION_CHANGED,
            actor=user,
            metadata={'action': 'completed_account_setup'},
            request=request
        )
        
        # Generate authentication token
        from rest_framework.authtoken.models import Token
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'message': _('Account setup completed successfully.'),
            'token': token.key,
            'user': UserAdminSerializer(user).data
        }, status=status.HTTP_200_OK)

