"""
Order Views for MCD-Agencia.

This module provides ViewSets for order operations:
    - Cart management
    - Order creation and management
    - Address management
    - Order status updates (admin)
"""

from datetime import datetime, time
from decimal import Decimal

from django.conf import settings
from django.db import transaction, models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend

from apps.audit.models import AuditLog
from apps.catalog.models import ProductVariant
from apps.content.models import Branch
from apps.core.pagination import StandardPagination
from apps.core.views import is_internal_user
from .models import (
    Cart,
    CartItem,
    Address,
    Order,
    OrderLine,
    OrderStatusHistory,
    ProductionJob,
    LogisticsJob,
    FieldOperationJob,
    OrderTrackingEvent,
)
from .serializers import (
    CartSerializer,
    CartItemSerializer,
    AddToCartSerializer,
    AddressSerializer,
    OrderSerializer,
    OrderListSerializer,
    CreateOrderSerializer,
    UpdateOrderStatusSerializer,
    ProductionJobSerializer,
    LogisticsJobSerializer,
    FieldOperationJobSerializer,
    UpdateProductionJobStatusSerializer,
    UpdateLogisticsJobStatusSerializer,
    UpdateFieldOperationJobStatusSerializer,
    OrderTrackingUpdateSerializer,
)
from .services.operations import (
    build_operational_plan,
    ensure_order_in_production,
    maybe_auto_ready_order_from_production,
    sync_operational_rollup,
)
from .services.tracking import (
    build_order_tracking_timeline,
    maybe_sync_order_status_from_logistics,
    record_job_tracking_event,
    record_tracking_event,
    record_tracking_number_event,
)

MANUAL_PAYMENT_METHODS = {'bank_transfer', 'cash'}
ONLINE_PAYMENT_METHODS = {'mercadopago', 'paypal'}


def normalize_payment_method(value: str | None) -> str:
    raw = str(value or '').strip().lower()
    aliases = {
        'mercado_pago': 'mercadopago',
        'mercado pago': 'mercadopago',
        'paypal': 'paypal',
        'bank_transfer': 'bank_transfer',
        'bank transfer': 'bank_transfer',
        'transferencia': 'bank_transfer',
        'transfer': 'bank_transfer',
        'cash': 'cash',
        'efectivo': 'cash',
    }
    return aliases.get(raw, raw)


# Permission helpers for operation groups
def user_has_production_permission(user) -> bool:
    """Check if user is production supervisor or admin."""
    if not user or not user.is_authenticated:
        return False
    return user.groups.filter(name='production_supervisors').exists() or is_internal_user(user)


def user_has_operations_permission(user) -> bool:
    """Check if user is operations supervisor or admin."""
    if not user or not user.is_authenticated:
        return False
    return user.groups.filter(name='operations_supervisors').exists() or is_internal_user(user)


class CartView(APIView):
    """
    Handle cart operations.

    GET /api/v1/orders/cart/ - Get current cart
    POST /api/v1/orders/cart/add/ - Add item to cart
    PUT /api/v1/orders/cart/update/{item_id}/ - Update item quantity
    DELETE /api/v1/orders/cart/remove/{item_id}/ - Remove item
    DELETE /api/v1/orders/cart/clear/ - Clear cart
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get current user's cart."""
        cart, created = Cart.objects.get_or_create(user=request.user)
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data)


class AddToCartView(APIView):
    """Add item to cart."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Add item to cart."""
        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cart, _ = Cart.objects.get_or_create(user=request.user)
        variant_id = serializer.validated_data['variant_id']
        quantity = serializer.validated_data.get('quantity', 1)

        variant = ProductVariant.objects.select_related('catalog_item').get(
            id=variant_id
        )

        # Check if item already in cart
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            variant=variant,
            defaults={'quantity': quantity}
        )

        if not created:
            cart_item.quantity += quantity
            cart_item.save(update_fields=['quantity', 'updated_at'])

        return Response(
            CartSerializer(cart, context={'request': request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class UpdateCartItemView(APIView):
    """Update cart item quantity."""

    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, item_id):
        """Update item quantity."""
        try:
            cart = Cart.objects.get(user=request.user)
            cart_item = cart.items.get(id=item_id)
        except (Cart.DoesNotExist, CartItem.DoesNotExist):
            return Response(
                {'error': _('Item not found in cart.')},
                status=status.HTTP_404_NOT_FOUND
            )

        quantity = request.data.get('quantity')
        if not quantity or quantity < 1:
            return Response(
                {'error': _('Quantity must be at least 1.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check stock
        if cart_item.variant.catalog_item.track_inventory:
            if cart_item.variant.stock < quantity:
                return Response(
                    {'error': _('Insufficient stock. Available: %(stock)s') % {
                        'stock': cart_item.variant.stock
                    }},
                    status=status.HTTP_400_BAD_REQUEST
                )

        cart_item.quantity = quantity
        cart_item.save(update_fields=['quantity', 'updated_at'])

        return Response(CartSerializer(cart, context={'request': request}).data)


class RemoveCartItemView(APIView):
    """Remove item from cart."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, item_id):
        """Remove item from cart."""
        try:
            cart = Cart.objects.get(user=request.user)
            cart_item = cart.items.get(id=item_id)
        except (Cart.DoesNotExist, CartItem.DoesNotExist):
            return Response(
                {'error': _('Item not found in cart.')},
                status=status.HTTP_404_NOT_FOUND
            )

        cart_item.delete()
        return Response(CartSerializer(cart, context={'request': request}).data)


class ClearCartView(APIView):
    """Clear all items from cart."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        """Clear cart."""
        try:
            cart = Cart.objects.get(user=request.user)
            cart.items.all().delete()
        except Cart.DoesNotExist:
            pass

        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart, context={'request': request}).data)


class MergeGuestCartView(APIView):
    """
    Merge guest cart items into user's cart after login.
    
    POST /api/v1/orders/cart/merge/
    Body: { "items": [{ "variant_id": "uuid", "quantity": 1 }, ...] }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Merge guest cart items into user's cart."""
        items = request.data.get('items', [])
        
        if not items:
            cart, _ = Cart.objects.get_or_create(user=request.user)
            return Response(CartSerializer(cart, context={'request': request}).data)
        
        cart, _ = Cart.objects.get_or_create(user=request.user)
        
        for item_data in items:
            variant_id = item_data.get('variant_id')
            quantity = item_data.get('quantity', 1)
            
            if not variant_id or quantity < 1:
                continue
                
            try:
                variant = ProductVariant.objects.select_related('catalog_item').get(
                    id=variant_id
                )
                
                # Check if item already in cart
                cart_item, created = CartItem.objects.get_or_create(
                    cart=cart,
                    variant=variant,
                    defaults={'quantity': quantity}
                )
                
                if not created:
                    # Add quantity if item already exists
                    cart_item.quantity += quantity
                    cart_item.save(update_fields=['quantity', 'updated_at'])
                    
            except ProductVariant.DoesNotExist:
                # Skip invalid variants
                continue
        
        return Response(CartSerializer(cart, context={'request': request}).data)


class AddressViewSet(viewsets.ModelViewSet):
    """
    ViewSet for address management.

    GET /api/v1/orders/addresses/
    POST /api/v1/orders/addresses/
    PUT /api/v1/orders/addresses/{id}/
    DELETE /api/v1/orders/addresses/{id}/
    """

    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPagination

    @staticmethod
    def _user_display_name(user) -> str:
        full_name = (getattr(user, 'full_name', '') or '').strip()
        if full_name:
            return full_name
        combined = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return combined or getattr(user, 'email', '') or 'Cliente'

    @staticmethod
    def _to_profile_address(address: Address) -> dict:
        return {
            'calle': (address.street or '').strip(),
            'numero_exterior': (address.exterior_number or '').strip(),
            'numero_interior': (address.interior_number or '').strip(),
            'colonia': (address.neighborhood or '').strip(),
            'ciudad': (address.city or '').strip(),
            'estado': (address.state or '').strip(),
            'codigo_postal': (address.postal_code or '').strip(),
            'referencia': (address.reference or '').strip(),
        }

    def _sync_profile_from_order_address(self, address: Address) -> None:
        """Mirror order shipping addresses into user profile addresses."""
        if not address.user or address.type != 'shipping':
            return

        from apps.users.models import UserAddress

        user = address.user
        profile_addr = self._to_profile_address(address)
        required = {
            'calle': profile_addr['calle'],
            'numero_exterior': profile_addr['numero_exterior'],
            'colonia': profile_addr['colonia'],
            'ciudad': profile_addr['ciudad'],
            'estado': profile_addr['estado'],
            'codigo_postal': profile_addr['codigo_postal'],
        }
        if not all(required.values()):
            return

        profile_obj = UserAddress.objects.filter(user=user, **required).first()
        if profile_obj:
            update_fields = []
            if profile_addr['numero_interior'] and profile_obj.numero_interior != profile_addr['numero_interior']:
                profile_obj.numero_interior = profile_addr['numero_interior']
                update_fields.append('numero_interior')
            if profile_addr['referencia'] and profile_obj.referencia != profile_addr['referencia']:
                profile_obj.referencia = profile_addr['referencia']
                update_fields.append('referencia')
            if address.is_default and not profile_obj.is_default:
                profile_obj.is_default = True
                update_fields.append('is_default')
            if update_fields:
                profile_obj.save(update_fields=update_fields + ['updated_at'])
        else:
            UserAddress.objects.create(
                user=user,
                label='',
                numero_interior=profile_addr['numero_interior'],
                referencia=profile_addr['referencia'],
                is_default=address.is_default,
                **required,
            )

        if address.is_default:
            user.default_delivery_address = profile_addr
            user.save(update_fields=['default_delivery_address', 'updated_at'])

    def _sync_order_addresses_from_profile(self):
        """Ensure checkout addresses include profile-saved addresses."""
        user = self.request.user
        from apps.users.models import UserAddress

        profile_addresses = list(UserAddress.objects.filter(user=user).order_by('-is_default', '-created_at'))
        existing = Address.objects.filter(user=user, type='shipping')

        for profile in profile_addresses:
            required = {
                'street': (profile.calle or '').strip(),
                'exterior_number': (profile.numero_exterior or '').strip(),
                'neighborhood': (profile.colonia or '').strip(),
                'city': (profile.ciudad or '').strip(),
                'state': (profile.estado or '').strip(),
                'postal_code': (profile.codigo_postal or '').strip(),
            }
            if not all(required.values()):
                continue

            addr = existing.filter(
                street__iexact=required['street'],
                exterior_number__iexact=required['exterior_number'],
                neighborhood__iexact=required['neighborhood'],
                city__iexact=required['city'],
                state__iexact=required['state'],
                postal_code__iexact=required['postal_code'],
            ).first()

            if not addr:
                addr = Address.objects.create(
                    user=user,
                    type='shipping',
                    is_default=profile.is_default,
                    name=self._user_display_name(user),
                    phone=(getattr(user, 'phone', '') or '').strip(),
                    street=required['street'],
                    exterior_number=required['exterior_number'],
                    interior_number=(profile.numero_interior or '').strip(),
                    neighborhood=required['neighborhood'],
                    city=required['city'],
                    state=required['state'],
                    postal_code=required['postal_code'],
                    country='MEX',
                    reference=(profile.referencia or '').strip(),
                )
            else:
                update_fields = []
                if (profile.numero_interior or '').strip() and addr.interior_number != (profile.numero_interior or '').strip():
                    addr.interior_number = (profile.numero_interior or '').strip()
                    update_fields.append('interior_number')
                if (profile.referencia or '').strip() and addr.reference != (profile.referencia or '').strip():
                    addr.reference = (profile.referencia or '').strip()
                    update_fields.append('reference')
                if profile.is_default and not addr.is_default:
                    addr.is_default = True
                    update_fields.append('is_default')
                if update_fields:
                    addr.save(update_fields=update_fields + ['updated_at'])

        # Backfill from user.default_delivery_address for older records without UserAddress rows.
        if not profile_addresses:
            fallback = getattr(user, 'default_delivery_address', None)
            if isinstance(fallback, dict):
                street = (fallback.get('street') or fallback.get('calle') or '').strip()
                exterior = (fallback.get('exterior_number') or fallback.get('numero_exterior') or '').strip()
                neighborhood = (fallback.get('neighborhood') or fallback.get('colonia') or '').strip()
                city = (fallback.get('city') or fallback.get('ciudad') or '').strip()
                state = (fallback.get('state') or fallback.get('estado') or '').strip()
                postal = (fallback.get('postal_code') or fallback.get('codigo_postal') or '').strip()
                if all([street, exterior, neighborhood, city, state, postal]):
                    exists = existing.filter(
                        street__iexact=street,
                        exterior_number__iexact=exterior,
                        neighborhood__iexact=neighborhood,
                        city__iexact=city,
                        state__iexact=state,
                        postal_code__iexact=postal,
                    ).exists()
                    if not exists:
                        Address.objects.create(
                            user=user,
                            type='shipping',
                            is_default=True,
                            name=self._user_display_name(user),
                            phone=(getattr(user, 'phone', '') or '').strip(),
                            street=street,
                            exterior_number=exterior,
                            interior_number=(fallback.get('interior_number') or fallback.get('numero_interior') or '').strip(),
                            neighborhood=neighborhood,
                            city=city,
                            state=state,
                            postal_code=postal,
                            country='MEX',
                            reference=(fallback.get('reference') or fallback.get('referencia') or '').strip(),
                        )

    def get_queryset(self):
        """Return addresses for current user."""
        self._sync_order_addresses_from_profile()
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Create address for current user."""
        address = serializer.save(user=self.request.user)

        # If marked as default, unset other defaults of same type
        if address.is_default:
            Address.objects.filter(
                user=self.request.user,
                type=address.type,
                is_default=True
            ).exclude(id=address.id).update(is_default=False)

        self._sync_profile_from_order_address(address)

    def perform_update(self, serializer):
        """Update address for current user and keep profile addresses in sync."""
        address = serializer.save()
        if address.is_default:
            Address.objects.filter(
                user=self.request.user,
                type=address.type,
                is_default=True,
            ).exclude(id=address.id).update(is_default=False)
        self._sync_profile_from_order_address(address)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set address as default."""
        address = self.get_object()
        Address.objects.filter(
            user=request.user,
            type=address.type,
            is_default=True
        ).update(is_default=False)
        address.is_default = True
        address.save(update_fields=['is_default', 'updated_at'])
        self._sync_profile_from_order_address(address)
        return Response(AddressSerializer(address).data)


class OrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for order management.

    Customer endpoints:
        GET /api/v1/orders/ - List user's orders
        GET /api/v1/orders/{id}/ - Order details
        POST /api/v1/orders/create/ - Create order from cart

    Admin endpoints:
        GET /api/v1/admin/orders/ - List all orders
        PUT /api/v1/admin/orders/{id}/ - Update order
        POST /api/v1/admin/orders/{id}/update-status/ - Change status
    """

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']

    def get_queryset(self):
        """Return orders based on user role."""
        if is_internal_user(self.request.user):
            return Order.objects.all().select_related('pickup_branch').prefetch_related('lines', 'status_history')
        return Order.objects.filter(
            user=self.request.user, is_deleted=False
        ).select_related('pickup_branch').prefetch_related('lines', 'status_history')

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if self.action == 'list':
            return OrderListSerializer
        return OrderSerializer

    @action(detail=False, methods=['post'])
    def create_order(self, request):
        """Create order from cart."""
        serializer = CreateOrderSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            # Get cart
            cart = Cart.objects.prefetch_related(
                'items__variant__catalog_item'
            ).get(user=request.user)

            # Get addresses
            shipping_address = Address.objects.get(
                id=serializer.validated_data['shipping_address_id']
            )
            billing_address = Address.objects.get(
                id=serializer.validated_data['billing_address_id']
            )

            # Calculate totals using Decimal to avoid Decimal*float runtime errors
            subtotal = sum(item.line_total for item in cart.items.all())
            tax_rate = Decimal(str(settings.TAX_RATE))
            tax_amount = subtotal * tax_rate
            delivery_method = serializer.validated_data.get('delivery_method', Order.DELIVERY_SHIPPING)
            shipping_fee = serializer.validated_data.get('shipping_fee', Decimal('0'))
            if delivery_method == Order.DELIVERY_PICKUP:
                shipping_fee = Decimal('0')
            total = subtotal + tax_amount + shipping_fee

            pickup_branch = None
            if delivery_method == Order.DELIVERY_PICKUP and serializer.validated_data.get('pickup_branch_id'):
                pickup_branch = Branch.objects.filter(id=serializer.validated_data['pickup_branch_id'], is_active=True).first()

            # Create order
            order = Order.objects.create(
                user=request.user,
                status=Order.STATUS_PENDING_PAYMENT,
                origin=Order.ORIGIN_DIRECT_PURCHASE,
                shipping_address=shipping_address.full_address,
                billing_address=billing_address.full_address,
                subtotal=subtotal,
                tax_rate=tax_rate,
                tax_amount=tax_amount,
                total=total,
                payment_method=serializer.validated_data['payment_method'],
                notes=serializer.validated_data.get('notes', ''),
                delivery_method=delivery_method,
                pickup_branch=pickup_branch,
                delivery_address={
                    'shipping_fee': str(shipping_fee),
                    'shipping_address_id': str(shipping_address.id),
                },
            )

            # Create order lines
            for cart_item in cart.items.all():
                variant = cart_item.variant
                OrderLine.objects.create(
                    order=order,
                    variant=variant,
                    sku=variant.sku,
                    name=variant.catalog_item.name,
                    variant_name=variant.name,
                    quantity=cart_item.quantity,
                    unit_price=cart_item.unit_price,
                    line_total=cart_item.line_total,
                    metadata={
                        'variant_id': str(variant.id),
                        'catalog_item_id': str(variant.catalog_item.id)
                    }
                )

            # Create initial status history
            OrderStatusHistory.objects.create(
                order=order,
                from_status=Order.STATUS_DRAFT,
                to_status=Order.STATUS_PENDING_PAYMENT,
                changed_by=request.user,
                notes=_('Order created')
            )

            # Temporary simulation: online methods are auto-confirmed as paid.
            if order.payment_method in ONLINE_PAYMENT_METHODS:
                order.amount_paid = order.total
                order.save(update_fields=['amount_paid', 'updated_at'])

                order.transition_to(
                    Order.STATUS_PAID,
                    changed_by=request.user,
                    notes=_('Simulated payment confirmation from checkout')
                )

            ensure_order_in_production(
                order,
                changed_by=request.user,
                notes=_('Order moved to production after checkout'),
            )

            # Log order creation
            AuditLog.log(
                entity=order,
                action=AuditLog.ACTION_CREATED,
                actor=request.user,
                after_state=OrderSerializer(order).data,
                request=request
            )

            # In-app notification: catalog purchase (admins only)
            try:
                from apps.notifications.models import Notification
                Notification.notify_admins(
                    notification_type=Notification.TYPE_CATALOG_PURCHASE,
                    title=f'Compra de catálogo #{order.order_number}',
                    message=f'{request.user.full_name} — ${order.total:,.2f} {order.currency}',
                    entity_type='Order',
                    entity_id=order.id,
                    action_url=f'/dashboard/pedidos/{order.id}',
                )
            except Exception:
                pass

            # Clear cart
            cart.items.all().delete()

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel an order (customer)."""
        order = self.get_object()

        if not order.can_transition_to(Order.STATUS_CANCELLED):
            return Response(
                {'error': _('This order cannot be cancelled.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            old_status = order.status
            order.transition_to(
                Order.STATUS_CANCELLED,
                changed_by=request.user,
                notes=_('Cancelled by customer')
            )

            AuditLog.log(
                entity=order,
                action=AuditLog.ACTION_STATE_CHANGED,
                actor=request.user,
                before_state={'status': old_status},
                after_state={'status': order.status},
                request=request
            )

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def set_payment_method(self, request, pk=None):
        """Set customer-selected payment method for pending orders."""
        order = self.get_object()

        if order.user_id != request.user.id:
            return Response(
                {'error': _('You can only update your own orders.')},
                status=status.HTTP_403_FORBIDDEN
            )

        if order.status not in [Order.STATUS_PENDING_PAYMENT, Order.STATUS_PARTIALLY_PAID]:
            return Response(
                {'error': _('Payment method can only be changed while payment is pending.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment_method = request.data.get('payment_method', '')
        valid_methods = {value for value, _ in Order.PAYMENT_METHOD_CHOICES}
        if payment_method not in valid_methods:
            return Response(
                {'error': _('Invalid payment method.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.payment_method = payment_method
        order.save(update_fields=['payment_method', 'updated_at'])

        AuditLog.log(
            entity=order,
            action=AuditLog.ACTION_UPDATED,
            actor=request.user,
            after_state={'payment_method': order.payment_method},
            request=request,
        )

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['get'])
    def tracking(self, request, pk=None):
        """Return customer-visible order tracking timeline."""
        order = self.get_object()
        if not is_internal_user(request.user) and order.user_id != request.user.id:
            return Response(
                {'error': _('You can only view your own orders.')},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(build_order_tracking_timeline(order))


class OrderAdminViewSet(viewsets.ModelViewSet):
    """
    Admin/Sales ViewSet for order management.

    GET /api/v1/admin/orders/
    GET /api/v1/admin/orders/{id}/
    PUT /api/v1/admin/orders/{id}/
    POST /api/v1/admin/orders/{id}/update_status/ - Change status
    """

    queryset = Order.objects.all().prefetch_related(
        'lines', 'status_history', 'payments'
    ).select_related('user', 'pickup_branch')
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status', 'payment_method', 'user']
    search_fields = ['order_number', 'user__email', 'user__first_name', 'user__last_name']
    ordering = ['-created_at']

    @staticmethod
    def _role_name(user) -> str:
        return getattr(getattr(user, 'role', None), 'name', '')

    def _assert_track_permission(self, request, track: str, target_status: str) -> Response | None:
        """
        Validate group-based permissions for track updates.
        
        Permissions:
        - admin (is_internal_user): Can update any track any status
        - production_supervisors: Can only update production track (except blocked/cancelled)
        - operations_supervisors: Can only update logistics and field_ops tracks (except blocked/cancelled/etc)
        - others: Forbidden
        """
        user = request.user
        
        # Admin can do anything
        if is_internal_user(user):
            return None
        
        # Restricted target statuses by track type (only admin can set these)
        restricted_by_track = {
            'production': {ProductionJob.STATUS_BLOCKED, ProductionJob.STATUS_CANCELLED},
            'logistics': {LogisticsJob.STATUS_DELIVERY_FAILED, LogisticsJob.STATUS_CANCELLED},
            'field_ops': {FieldOperationJob.STATUS_PAUSED, FieldOperationJob.STATUS_REQUIRES_REVISIT, FieldOperationJob.STATUS_CANCELLED},
        }
        
        # Check if target status is restricted
        if target_status in restricted_by_track.get(track, set()):
            return Response(
                {'error': _('Only admin can apply this transition for %(track)s.') % {'track': track}},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Production supervisors can only update production
        if track == 'production':
            if not user_has_production_permission(user):
                return Response(
                    {'error': _('Only production supervisors can update production tracks.')},
                    status=status.HTTP_403_FORBIDDEN,
                )
        
        # Operations supervisors can update logistics and field ops
        elif track in ('logistics', 'field_ops'):
            if not user_has_operations_permission(user):
                return Response(
                    {'error': _('Only operations supervisors can update logistics and field operations tracks.')},
                    status=status.HTTP_403_FORBIDDEN,
                )
        
        else:
            return Response(
                {'error': _('Invalid track type.')},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        return None

    def _audit_track_status_change(
        self,
        *,
        request,
        job,
        order: Order,
        previous_status: str,
        new_status: str,
        notes: str,
        track_type: str,
    ) -> None:
        AuditLog.log(
            entity=job,
            action=AuditLog.ACTION_STATE_CHANGED,
            actor=request.user,
            before_state={'status': previous_status},
            after_state={'status': new_status},
            request=request,
            metadata={
                'track_type': track_type,
                'job_id': str(job.id),
                'order_id': str(order.id),
                'order_number': order.order_number,
                'notes': notes or '',
            },
        )
        record_job_tracking_event(
            order=order,
            track_type=track_type,
            job_id=job.id,
            new_status=new_status,
            notes=notes,
            created_by=request.user,
        )

    def check_permissions(self, request):
        """Only admin and sales staff can access."""
        super().check_permissions(request)
        if not is_internal_user(request.user):
            self.permission_denied(request)

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if self.action == 'list':
            return OrderListSerializer
        return OrderSerializer

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update order status."""
        order = self.get_object()
        serializer = UpdateOrderStatusSerializer(
            data=request.data,
            context={'order': order}
        )
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('notes', '')
        scheduled_date = serializer.validated_data.get('scheduled_date')
        user_role = getattr(getattr(request.user, 'role', None), 'name', '')
        is_admin = user_role == 'admin'

        if new_status in [Order.STATUS_PAID, Order.STATUS_PARTIALLY_PAID, Order.STATUS_REFUNDED] and not is_admin:
            return Response(
                {'error': _('Only admin can confirm or reconcile payments.')},
                status=status.HTTP_403_FORBIDDEN
            )

        normalized_payment_method = normalize_payment_method(order.payment_method)

        if new_status == Order.STATUS_IN_PRODUCTION and not order.is_fully_paid:
            if normalized_payment_method in ONLINE_PAYMENT_METHODS:
                order.amount_paid = order.total
                order.save(update_fields=['amount_paid', 'updated_at'])
            elif not is_admin:
                return Response(
                    {'error': _('Order must be fully paid before starting production.')},
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif not str(notes or '').strip():
                return Response(
                    {'error': _('Admin override requires notes to start production before full payment.')},
                    status=status.HTTP_400_BAD_REQUEST
                )

        with transaction.atomic():
            old_status = order.status
            if (
                old_status == Order.STATUS_PENDING_PAYMENT
                and new_status == Order.STATUS_IN_PRODUCTION
                and (normalize_payment_method(order.payment_method) in ONLINE_PAYMENT_METHODS or order.is_fully_paid)
            ):
                order.transition_to(
                    Order.STATUS_PAID,
                    changed_by=request.user,
                    notes=_('Auto-confirmed online payment before production')
                )
                order.transition_to(new_status, changed_by=request.user, notes=notes)
            else:
                order.transition_to(new_status, changed_by=request.user, notes=notes)

            # Update scheduled_date if provided
            if scheduled_date is not None:
                order.scheduled_date = scheduled_date
                order.save(update_fields=['scheduled_date'])

            if order.status == Order.STATUS_IN_PRODUCTION:
                ensure_order_in_production(order)
                order.refresh_from_db()

            AuditLog.log(
                entity=order,
                action=AuditLog.ACTION_STATE_CHANGED,
                actor=request.user,
                before_state={'status': old_status},
                after_state={'status': order.status},
                request=request,
                metadata={'notes': notes}
            )

            # In-app notifications for important status transitions
            try:
                from apps.notifications.models import Notification

                # Determine the salesperson (quote creator) if order came from a quote
                owner = order.quote.created_by if order.quote else None
                order_url = f'/dashboard/pedidos/{order.id}'

                STATUS_LABELS = {
                    'paid': 'Pagado', 'partially_paid': 'Pago parcial',
                    'in_production': 'En producción', 'ready': 'Listo',
                    'in_delivery': 'En entrega', 'completed': 'Completado',
                    'cancelled': 'Cancelado', 'refunded': 'Reembolsado',
                }
                label = STATUS_LABELS.get(new_status, new_status)

                if new_status == 'completed':
                    Notification.notify_owner_and_admins(
                        owner=owner,
                        notification_type=Notification.TYPE_ORDER_COMPLETED,
                        title=f'Pedido #{order.order_number} completado',
                        message=f'Cliente: {order.user.full_name if order.user else "N/A"}',
                        entity_type='Order',
                        entity_id=order.id,
                        action_url=order_url,
                    )
                elif new_status in ('paid', 'partially_paid'):
                    Notification.notify_owner_and_admins(
                        owner=owner,
                        notification_type=Notification.TYPE_PAYMENT_RECEIVED,
                        title=f'Pago registrado — Pedido #{order.order_number}',
                        message=f'{label} — {order.user.full_name if order.user else "N/A"}',
                        entity_type='Order',
                        entity_id=order.id,
                        action_url=order_url,
                    )
                else:
                    # Generic status change
                    Notification.notify_owner_and_admins(
                        owner=owner,
                        notification_type=Notification.TYPE_ORDER_STATUS,
                        title=f'Pedido #{order.order_number} → {label}',
                        message=f'Cliente: {order.user.full_name if order.user else "N/A"}',
                        entity_type='Order',
                        entity_id=order.id,
                        action_url=order_url,
                    )
            except Exception:
                pass

            sync_operational_rollup(order)

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='lines/(?P<line_id>[^/.]+)/estimated-delivery')
    def update_line_estimated_delivery(self, request, pk=None, line_id=None):
        """Update seller estimated delivery date for one order line."""
        order = self.get_object()
        line = order.lines.filter(id=line_id).first()
        if not line:
            return Response(
                {'error': _('Order line not found for this order.')},
                status=status.HTTP_404_NOT_FOUND,
            )

        raw_date = request.data.get('estimated_delivery_date')
        normalized_date: str | None = None
        scheduled_dt = None

        if raw_date not in (None, '', 'null'):
            try:
                parsed = datetime.fromisoformat(str(raw_date).replace('Z', '+00:00'))
                normalized_date = parsed.date().isoformat()
            except ValueError:
                try:
                    normalized_date = datetime.strptime(str(raw_date), '%Y-%m-%d').date().isoformat()
                except ValueError:
                    return Response(
                        {'error': _('Invalid date format. Use YYYY-MM-DD.')},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            scheduled_dt = timezone.make_aware(datetime.combine(datetime.fromisoformat(normalized_date).date(), time(hour=12)))

        with transaction.atomic():
            metadata = line.metadata or {}
            old_value = metadata.get('estimated_delivery_date')

            if normalized_date:
                metadata['estimated_delivery_date'] = normalized_date
            else:
                metadata.pop('estimated_delivery_date', None)

            line.metadata = metadata
            line.save(update_fields=['metadata', 'updated_at'])

            # Keep operation snapshot aligned with line metadata.
            service_snapshot = order.service_snapshot or []
            snapshot_updated = False
            for item in service_snapshot:
                if str(item.get('line_id')) == str(line.id):
                    item['estimated_date'] = scheduled_dt.isoformat() if scheduled_dt else None
                    meta = item.get('metadata') if isinstance(item.get('metadata'), dict) else {}
                    if normalized_date:
                        meta['estimated_delivery_date'] = normalized_date
                    else:
                        meta.pop('estimated_delivery_date', None)
                    item['metadata'] = meta
                    snapshot_updated = True

            if snapshot_updated:
                order.service_snapshot = service_snapshot
                order.save(update_fields=['service_snapshot', 'updated_at'])

            # Propagate schedule to operation tracks tied to this line.
            production_jobs = order.production_jobs.filter(order_line=line)
            for job in production_jobs:
                job.planned_end = scheduled_dt
                job.save(update_fields=['planned_end', 'updated_at'])

            logistics_jobs = order.logistics_jobs.filter(metadata__line_id=str(line.id))
            for job in logistics_jobs:
                job.window_end = scheduled_dt
                job.save(update_fields=['window_end', 'updated_at'])

            field_ops_jobs = order.field_ops_jobs.filter(metadata__line_id=str(line.id))
            for job in field_ops_jobs:
                job.scheduled_start = scheduled_dt
                job.save(update_fields=['scheduled_start', 'updated_at'])

            AuditLog.log(
                entity=line,
                action=AuditLog.ACTION_UPDATED,
                actor=request.user,
                before_state={'estimated_delivery_date': old_value},
                after_state={'estimated_delivery_date': normalized_date},
                request=request,
                metadata={
                    'order_id': str(order.id),
                    'order_number': order.order_number,
                },
            )

            sync_operational_rollup(order)

        return Response({
            'order_id': str(order.id),
            'line_id': str(line.id),
            'estimated_delivery_date': normalized_date,
        })

    @action(detail=True, methods=['get'])
    def operational_tracks(self, request, pk=None):
        """Return production, logistics and field operation tracks for an order."""
        order = self.get_object()
        sync_operational_rollup(order)
        return Response({
            'order_id': str(order.id),
            'order_number': order.order_number,
            'origin': order.origin,
            'operational_rollup': order.operational_rollup,
            'operation_plan': order.operation_plan,
            'production_jobs': ProductionJobSerializer(order.production_jobs.all(), many=True).data,
            'logistics_jobs': LogisticsJobSerializer(order.logistics_jobs.all(), many=True).data,
            'field_ops_jobs': FieldOperationJobSerializer(order.field_ops_jobs.all(), many=True).data,
        })

    @action(detail=True, methods=['post'])
    def add_tracking(self, request, pk=None):
        """Add or update shipping tracking information."""
        order = self.get_object()
        serializer = OrderTrackingUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tracking_number = (serializer.validated_data.get('tracking_number') or '').strip()
        tracking_url = (serializer.validated_data.get('tracking_url') or '').strip()
        message = (serializer.validated_data.get('message') or '').strip()

        if not tracking_number and not message:
            return Response(
                {'error': _('Tracking number or message is required.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if tracking_number:
                order.tracking_number = tracking_number
                order.tracking_url = tracking_url
                order.save(update_fields=['tracking_number', 'tracking_url', 'updated_at'])
                record_tracking_number_event(
                    order=order,
                    tracking_number=tracking_number,
                    tracking_url=tracking_url,
                    created_by=request.user,
                    message=message,
                )
                if order.can_transition_to(Order.STATUS_IN_DELIVERY):
                    order.transition_to(
                        Order.STATUS_IN_DELIVERY,
                        changed_by=request.user,
                        notes=message or _('Tracking number added'),
                    )

            elif message:
                record_tracking_event(
                    order=order,
                    event_type=OrderTrackingEvent.EVENT_CUSTOM,
                    title=serializer.validated_data.get('title') or 'Actualización del pedido',
                    description=message,
                    created_by=request.user,
                )

            AuditLog.log(
                entity=order,
                action=AuditLog.ACTION_UPDATED,
                actor=request.user,
                after_state={
                    'tracking_number': order.tracking_number,
                    'tracking_url': order.tracking_url,
                    'message': message,
                },
                request=request,
            )

        order.refresh_from_db()
        return Response({
            'order': OrderSerializer(order).data,
            'tracking': build_order_tracking_timeline(order),
        })

    @action(detail=True, methods=['post'], url_path='tracking-update')
    def tracking_update(self, request, pk=None):
        """Post a customer-visible tracking update (message and/or shipping info)."""
        return self.add_tracking(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='production-jobs/(?P<job_id>[^/.]+)/update-status')
    def update_production_job_status(self, request, pk=None, job_id=None):
        """Update status for a production job linked to this order."""
        order = self.get_object()
        job = order.production_jobs.filter(id=job_id).first()
        if not job:
            return Response({'error': _('Production job not found for this order.')}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateProductionJobStatusSerializer(data=request.data, context={'job': job})
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('notes', '')

        denied = self._assert_track_permission(request, 'production', new_status)
        if denied:
            return denied

        old_status = job.status

        job.status = new_status
        if new_status in {ProductionJob.STATUS_PREPARING, ProductionJob.STATUS_IN_PRODUCTION} and not job.actual_start:
            job.actual_start = timezone.now()
        if new_status == ProductionJob.STATUS_RELEASED:
            job.actual_end = timezone.now()
        job.save(update_fields=['status', 'actual_start', 'actual_end', 'updated_at'])

        self._audit_track_status_change(
            request=request,
            job=job,
            order=order,
            previous_status=old_status,
            new_status=new_status,
            notes=notes,
            track_type='production',
        )

        sync_operational_rollup(order)
        order.refresh_from_db()
        auto_ready = maybe_auto_ready_order_from_production(
            order,
            changed_by=request.user,
            notes=notes,
        )
        if auto_ready:
            order.refresh_from_db()
        return Response({
            'job': ProductionJobSerializer(job).data,
            'order_operational_rollup': order.operational_rollup,
            'order_status': order.status,
            'order_auto_ready': auto_ready,
        })

    @action(detail=True, methods=['post'], url_path='logistics-jobs/(?P<job_id>[^/.]+)/update-status')
    def update_logistics_job_status(self, request, pk=None, job_id=None):
        """Update status for a logistics job linked to this order."""
        order = self.get_object()
        job = order.logistics_jobs.filter(id=job_id).first()
        if not job:
            return Response({'error': _('Logistics job not found for this order.')}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateLogisticsJobStatusSerializer(data=request.data, context={'job': job})
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('notes', '')

        denied = self._assert_track_permission(request, 'logistics', new_status)
        if denied:
            return denied

        old_status = job.status

        # Logistics cannot move to transit/pickup while production track still open.
        if new_status in {LogisticsJob.STATUS_IN_TRANSIT, LogisticsJob.STATUS_READY_FOR_PICKUP}:
            has_open_production = order.production_jobs.exclude(
                status__in=[ProductionJob.STATUS_RELEASED, ProductionJob.STATUS_CANCELLED]
            ).exists()
            if has_open_production:
                return Response(
                    {'error': _('Cannot start logistics until production jobs are released.')},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        job.status = new_status
        if new_status == LogisticsJob.STATUS_DELIVERED:
            job.delivered_at = timezone.now()
        job.save(update_fields=['status', 'delivered_at', 'updated_at'])

        self._audit_track_status_change(
            request=request,
            job=job,
            order=order,
            previous_status=old_status,
            new_status=new_status,
            notes=notes,
            track_type='logistics',
        )

        maybe_sync_order_status_from_logistics(
            order,
            job,
            changed_by=request.user,
            notes=notes,
        )

        from apps.inventory.services import register_sale_movements_on_shipment
        if new_status in {LogisticsJob.STATUS_IN_TRANSIT, LogisticsJob.STATUS_DELIVERED}:
            register_sale_movements_on_shipment(order, created_by=request.user)

        sync_operational_rollup(order)
        order.refresh_from_db()
        return Response({
            'job': LogisticsJobSerializer(job).data,
            'order_operational_rollup': order.operational_rollup,
            'order_status': order.status,
            'tracking': build_order_tracking_timeline(order),
        })

    @action(detail=True, methods=['post'], url_path='field-ops-jobs/(?P<job_id>[^/.]+)/update-status')
    def update_field_ops_job_status(self, request, pk=None, job_id=None):
        """Update status for a field operation job linked to this order."""
        order = self.get_object()
        job = order.field_ops_jobs.filter(id=job_id).first()
        if not job:
            return Response({'error': _('Field operation job not found for this order.')}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateFieldOperationJobStatusSerializer(data=request.data, context={'job': job})
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('notes', '')

        denied = self._assert_track_permission(request, 'field_ops', new_status)
        if denied:
            return denied

        old_status = job.status

        # Field installation cannot start while production track still open.
        if new_status == FieldOperationJob.STATUS_IN_PROGRESS and job.operation_type == FieldOperationJob.TYPE_INSTALLATION:
            has_open_production = order.production_jobs.exclude(
                status__in=[ProductionJob.STATUS_RELEASED, ProductionJob.STATUS_CANCELLED]
            ).exists()
            if has_open_production:
                return Response(
                    {'error': _('Cannot start installation until production jobs are released.')},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        job.status = new_status
        if new_status == FieldOperationJob.STATUS_IN_PROGRESS and not job.actual_start:
            job.actual_start = timezone.now()
        if new_status == FieldOperationJob.STATUS_COMPLETED:
            job.actual_end = timezone.now()
        job.save(update_fields=['status', 'actual_start', 'actual_end', 'updated_at'])

        self._audit_track_status_change(
            request=request,
            job=job,
            order=order,
            previous_status=old_status,
            new_status=new_status,
            notes=notes,
            track_type='field_ops',
        )

        sync_operational_rollup(order)
        return Response({
            'job': FieldOperationJobSerializer(job).data,
            'order_operational_rollup': order.operational_rollup,
        })

    @action(detail=False, methods=['get'], url_path='production-jobs')
    def production_jobs(self, request):
        """
        GET /api/v1/orders/production-jobs/ 
        List all production jobs for production supervisors.
        """
        if not user_has_production_permission(request.user):
            raise PermissionDenied(_('Only production supervisors can access production jobs.'))
        
        jobs = ProductionJob.objects.select_related('order', 'order__user').order_by('-updated_at')
        
        # Filter by status if provided
        status_filter = request.query_params.get('status')
        if status_filter:
            jobs = jobs.filter(status=status_filter)
        
        # Filter by status__in for multiple statuses
        statuses = request.query_params.getlist('statuses')
        if statuses:
            jobs = jobs.filter(status__in=statuses)
        
        # Paginate
        paginator = StandardPagination()
        paginated_jobs = paginator.paginate_queryset(jobs, request)
        serializer = ProductionJobSerializer(paginated_jobs, many=True)
        return paginator.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'], url_path='operations-jobs')
    def operations_jobs(self, request):
        """
        GET /api/v1/orders/operations-jobs/
        List all logistics and field operations jobs for operations supervisors.
        """
        if not user_has_operations_permission(request.user):
            raise PermissionDenied(_('Only operations supervisors can access operations jobs.'))
        
        from django.db.models import Q
        
        # Get both logistics and field ops jobs
        logistics_jobs = LogisticsJob.objects.select_related('order', 'order__user').annotate(
            job_type=models.Value('logistics', output_field=models.CharField())
        )
        field_ops_jobs = FieldOperationJob.objects.select_related('order', 'order__user').annotate(
            job_type=models.Value('field_ops', output_field=models.CharField())
        )
        
        # Filter by status if provided
        status_filter = request.query_params.get('status')
        if status_filter:
            logistics_jobs = logistics_jobs.filter(status=status_filter)
            field_ops_jobs = field_ops_jobs.filter(status=status_filter)
        
        # Filter by job_type if provided
        job_type_filter = request.query_params.get('job_type')  # 'logistics' or 'field_ops'
        if job_type_filter == 'logistics':
            field_ops_jobs = field_ops_jobs.none()
        elif job_type_filter == 'field_ops':
            logistics_jobs = logistics_jobs.none()
        
        # Combine and order
        all_jobs = list(logistics_jobs) + list(field_ops_jobs)
        all_jobs.sort(key=lambda x: x.updated_at, reverse=True)
        
        # Paginate combined results
        paginator = StandardPagination()
        # Convert to dict for serializer
        jobs_data = []
        for job in all_jobs:
            if isinstance(job, LogisticsJob):
                jobs_data.append({
                    'job_type': 'logistics',
                    'job': job,
                })
            else:
                jobs_data.append({
                    'job_type': 'field_ops',
                    'job': job,
                })
        
        paginated = paginator.paginate_queryset(jobs_data, request)
        result = []
        for item in paginated:
            if item['job_type'] == 'logistics':
                result.append({
                    'job_type': 'logistics',
                    **LogisticsJobSerializer(item['job']).data
                })
            else:
                result.append({
                    'job_type': 'field_ops',
                    **FieldOperationJobSerializer(item['job']).data
                })
        
        return paginator.get_paginated_response(result)


class AdminWorkflowView(APIView):
    """Unified workflow feed for admin and sales dashboards."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_internal_user(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        from datetime import timedelta

        from apps.quotes.models import QuoteRequest, Quote
        from apps.quotes.serializers import QuoteRequestAdminSerializer, QuoteAdminSerializer

        today = timezone.localdate()
        window_start = today - timedelta(days=14)
        window_end = today + timedelta(days=90)

        orders_qs = Order.objects.select_related('user', 'pickup_branch').prefetch_related(
            'lines', 'status_history', 'production_jobs', 'logistics_jobs', 'field_ops_jobs'
        )
        requests_qs = QuoteRequest.objects.select_related('assigned_to', 'pickup_branch', 'catalog_item').prefetch_related('attachments', 'services')
        quotes_qs = Quote.objects.select_related('quote_request', 'created_by', 'pickup_branch').prefetch_related('lines', 'attachments')
        production_qs = ProductionJob.objects.select_related('order', 'order__user', 'order_line')
        logistics_qs = LogisticsJob.objects.select_related('order', 'order__user')
        field_ops_qs = FieldOperationJob.objects.select_related('order', 'order__user')

        manual_payment_orders = list(
            orders_qs.filter(
                status=Order.STATUS_PENDING_PAYMENT,
                payment_method__in=MANUAL_PAYMENT_METHODS,
            ).order_by('created_at')[:10]
        )
        production_jobs = list(
            production_qs.exclude(status__in=[ProductionJob.STATUS_RELEASED, ProductionJob.STATUS_CANCELLED])
            .order_by('planned_end', 'created_at')[:20]
        )
        logistics_jobs = list(
            logistics_qs.exclude(status__in=[LogisticsJob.STATUS_DELIVERED, LogisticsJob.STATUS_CANCELLED])
            .order_by('window_end', 'created_at')[:20]
        )
        field_ops_jobs = list(
            field_ops_qs.exclude(status__in=[FieldOperationJob.STATUS_COMPLETED, FieldOperationJob.STATUS_CANCELLED])
            .order_by('scheduled_start', 'created_at')[:20]
        )
        ready_orders = list(
            orders_qs.filter(
                operational_rollup__in=[Order.OP_ROLLUP_AWAITING_FINALIZATION, Order.OP_ROLLUP_IN_EXECUTION]
            ).exclude(status=Order.STATUS_PENDING_PAYMENT).order_by('scheduled_date', 'created_at')[:10]
        )
        completed_orders = list(
            orders_qs.filter(status=Order.STATUS_COMPLETED).order_by('-completed_at', '-created_at')[:10]
        )

        assigned_requests = list(
            requests_qs.filter(
                status__in=[QuoteRequest.STATUS_ASSIGNED, QuoteRequest.STATUS_IN_REVIEW, QuoteRequest.STATUS_QUOTED]
            ).order_by('required_date', 'created_at')[:10]
        )
        pending_requests = list(
            requests_qs.filter(
                status=QuoteRequest.STATUS_PENDING,
                assigned_to__isnull=True,
            ).order_by('created_at')[:10]
        )

        accepted_quotes = list(
            quotes_qs.filter(
                status__in=[Quote.STATUS_ACCEPTED, Quote.STATUS_SENT, Quote.STATUS_VIEWED, Quote.STATUS_CHANGES_REQUESTED]
            ).order_by('estimated_delivery_date', 'created_at')[:10]
        )

        def serialize_order(order, kind, date_value=None, date_label=''):
            return {
                'id': str(order.id),
                'kind': kind,
                'title': f'Pedido #{order.order_number}',
                'subtitle': order.user.full_name if order.user and order.user.full_name else order.user.email if order.user else 'Cliente',
                'status': order.status,
                'status_display': order.get_status_display(),
                'payment_method': order.payment_method,
                'delivery_method': order.delivery_method,
                'date': date_value.isoformat() if date_value else None,
                'date_label': date_label,
                'amount': str(order.total),
                'href': f'/dashboard/pedidos/{order.id}',
                'note': order.internal_notes or order.notes or '',
                'start': date_value.isoformat() if date_value else None,
                'end': None,
                'is_range': False,
            }

        def serialize_production_job(job):
            order = job.order
            line_name = job.order_line.name if job.order_line else 'Trabajo de producción'
            date_value = job.planned_end or job.planned_start
            return {
                'id': f'prod-{job.id}',
                'kind': 'production_job',
                'title': f'{line_name} · {order.order_number}',
                'subtitle': order.user.full_name if order.user and order.user.full_name else order.user.email if order.user else 'Cliente',
                'status': job.status,
                'status_display': job.get_status_display(),
                'delivery_method': order.delivery_method,
                'date': date_value.date().isoformat() if date_value else None,
                'date_label': 'Producción',
                'amount': str(order.total),
                'href': f'/dashboard/pedidos/{order.id}',
                'note': '',
                'start': job.planned_start.isoformat() if job.planned_start else None,
                'end': job.planned_end.isoformat() if job.planned_end else None,
                'is_range': bool(job.planned_start and job.planned_end),
            }

        def serialize_logistics_job(job):
            order = job.order
            date_value = job.window_end or job.window_start
            return {
                'id': f'log-{job.id}',
                'kind': 'logistics_job',
                'title': f'Logística · {order.order_number}',
                'subtitle': order.user.full_name if order.user and order.user.full_name else order.user.email if order.user else 'Cliente',
                'status': job.status,
                'status_display': job.get_status_display(),
                'delivery_method': order.delivery_method,
                'date': date_value.date().isoformat() if date_value else None,
                'date_label': 'Logística',
                'amount': str(order.total),
                'href': f'/dashboard/pedidos/{order.id}',
                'note': '',
                'start': job.window_start.isoformat() if job.window_start else None,
                'end': job.window_end.isoformat() if job.window_end else None,
                'is_range': bool(job.window_start and job.window_end),
            }

        def serialize_field_job(job):
            order = job.order
            date_value = job.scheduled_end or job.scheduled_start
            return {
                'id': f'field-{job.id}',
                'kind': 'field_operation_job' if job.operation_type != FieldOperationJob.TYPE_MOBILE_CAMPAIGN else 'mobile_campaign',
                'title': f'Operación en campo · {order.order_number}',
                'subtitle': order.user.full_name if order.user and order.user.full_name else order.user.email if order.user else 'Cliente',
                'status': job.status,
                'status_display': job.get_status_display(),
                'delivery_method': order.delivery_method,
                'date': date_value.date().isoformat() if date_value else None,
                'date_label': 'Operación',
                'amount': str(order.total),
                'href': f'/dashboard/pedidos/{order.id}',
                'note': '',
                'start': job.scheduled_start.isoformat() if job.scheduled_start else None,
                'end': job.scheduled_end.isoformat() if job.scheduled_end else None,
                'is_range': bool(job.scheduled_start and job.scheduled_end),
            }

        def serialize_request(request_obj, kind, date_value=None, date_label=''):
            return {
                'id': str(request_obj.id),
                'kind': kind,
                'title': f'Solicitud #{request_obj.request_number}',
                'subtitle': request_obj.customer_name,
                'status': request_obj.status,
                'status_display': request_obj.get_status_display(),
                'delivery_method': request_obj.delivery_method,
                'date': date_value.isoformat() if date_value else None,
                'date_label': date_label,
                'amount': None,
                'href': f'/dashboard/solicitudes/{request_obj.id}',
                'note': request_obj.description or '',
            }

        def serialize_quote(quote, kind, date_value=None, date_label=''):
            return {
                'id': str(quote.id),
                'kind': kind,
                'title': f'Cotización #{quote.quote_number}',
                'subtitle': quote.customer_name or quote.customer_email or 'Cliente',
                'status': quote.status,
                'status_display': quote.get_status_display(),
                'delivery_method': quote.delivery_method,
                'date': date_value.isoformat() if date_value else None,
                'date_label': date_label,
                'amount': str(quote.total),
                'href': f'/dashboard/cotizaciones/{quote.id}',
                'note': quote.payment_conditions or quote.customer_notes or '',
            }

        calendar_events = []
        for request_obj in requests_qs.filter(required_date__isnull=False, required_date__gte=window_start, required_date__lte=window_end).order_by('required_date', 'created_at')[:50]:
            calendar_events.append(serialize_request(request_obj, 'quote_request_required', request_obj.required_date, 'Fecha requerida'))

        for quote in quotes_qs.filter(estimated_delivery_date__isnull=False, estimated_delivery_date__gte=window_start, estimated_delivery_date__lte=window_end).order_by('estimated_delivery_date', 'created_at')[:50]:
            calendar_events.append(serialize_quote(quote, 'quote_estimated_delivery', quote.estimated_delivery_date, 'Entrega estimada'))

        for job in production_qs.filter(planned_end__isnull=False, planned_end__date__gte=window_start, planned_end__date__lte=window_end).order_by('planned_end', 'created_at')[:50]:
            calendar_events.append(serialize_production_job(job))

        for job in logistics_qs.filter(window_end__isnull=False, window_end__date__gte=window_start, window_end__date__lte=window_end).order_by('window_end', 'created_at')[:50]:
            calendar_events.append(serialize_logistics_job(job))

        for job in field_ops_qs.filter(scheduled_start__isnull=False, scheduled_start__date__gte=window_start, scheduled_start__date__lte=window_end).order_by('scheduled_start', 'created_at')[:50]:
            calendar_events.append(serialize_field_job(job))

        for order in orders_qs.filter(completed_at__isnull=False, completed_at__date__gte=window_start, completed_at__date__lte=window_end).order_by('-completed_at', '-created_at')[:50]:
            calendar_events.append(serialize_order(order, 'order_completed', order.completed_at.date(), 'Completado'))

        calendar_events.sort(key=lambda item: (item['date'] or '', item['title']))

        blocks = {
            'assigned': [serialize_request(request_obj, 'quote_request_assigned', request_obj.required_date, 'Fecha requerida') for request_obj in assigned_requests],
            'to_pay': [serialize_order(order, 'order_pending_payment') for order in manual_payment_orders],
            'in_production': [serialize_production_job(job) for job in production_jobs[:10]],
            'ready': [serialize_order(order, 'order_ready', order.scheduled_date.date() if order.scheduled_date else None, 'Programado') for order in ready_orders],
            'done': [serialize_order(order, 'order_completed', order.completed_at.date() if order.completed_at else None, 'Completado') for order in completed_orders],
            'quotes': [serialize_request(request_obj, 'quote_request_pending', request_obj.required_date, 'Fecha requerida') for request_obj in pending_requests],
        }

        blocks['in_production'].extend([serialize_field_job(job) for job in field_ops_jobs[:10]])
        blocks['ready'].extend([serialize_logistics_job(job) for job in logistics_jobs[:10]])

        stats = {
            'manual_payment_orders': len(manual_payment_orders),
            'in_production_orders': len(production_jobs) + len(field_ops_jobs),
            'ready_orders': len(ready_orders) + len(logistics_jobs),
            'completed_orders': len(completed_orders),
            'assigned_requests': len(assigned_requests),
            'pending_requests': len(pending_requests),
            'calendar_items': len(calendar_events),
        }

        return Response({
            'generated_at': timezone.now().isoformat(),
            'window_start': window_start.isoformat(),
            'window_end': window_end.isoformat(),
            'stats': stats,
            'blocks': blocks,
            'calendar_events': calendar_events,
            'quotes': QuoteAdminSerializer(accepted_quotes, many=True).data,
            'quote_requests': QuoteRequestAdminSerializer(assigned_requests, many=True).data,
        })
