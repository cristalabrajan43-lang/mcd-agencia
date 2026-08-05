"""
User Serializers for MCD-Agencia.

This module provides serializers for user-related operations:
    - User registration and profile management
    - Authentication
    - Role management
    - Consent tracking
    - Fiscal data

All serializers include proper validation and documentation.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import Role, UserConsent, FiscalData, UserAddress

User = get_user_model()


class RoleSerializer(serializers.ModelSerializer):
    """
    Serializer for Role model.

    Used for displaying role information in user responses.
    """

    class Meta:
        model = Role
        fields = ['id', 'name', 'display_name', 'description']
        read_only_fields = ['id']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.

    Handles new user creation with password validation
    and required consent fields.
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        validators=[validate_password],
        help_text=_('Password must be at least 8 characters with 1 uppercase and 1 number.')
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text=_('Confirm your password.')
    )
    terms_accepted = serializers.BooleanField(
        write_only=True,
        required=True,
        help_text=_('Must accept terms and conditions.')
    )
    privacy_accepted = serializers.BooleanField(
        write_only=True,
        required=True,
        help_text=_('Must accept privacy policy.')
    )
    marketing_consent = serializers.BooleanField(
        required=False,
        default=False,
        help_text=_('Consent to receive marketing communications.')
    )

    class Meta:
        model = User
        fields = [
            'email',
            'first_name',
            'last_name',
            'phone',
            'date_of_birth',
            'password',
            'password_confirm',
            'terms_accepted',
            'privacy_accepted',
            'marketing_consent',
            'preferred_language',
        ]
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
            'phone': {'required': True},
            'date_of_birth': {'required': True},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Replace DRF's auto-generated UniqueValidator message with clear Spanish text
        from rest_framework.validators import UniqueValidator
        for validator in self.fields['email'].validators:
            if isinstance(validator, UniqueValidator):
                validator.message = 'Ya existe una cuenta con este correo electrónico.'

    def validate(self, attrs):
        """Validate registration data."""
        # Check passwords match
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': _('Passwords do not match.')
            })

        # Check required consents
        if not attrs.get('terms_accepted'):
            raise serializers.ValidationError({
                'terms_accepted': _('You must accept the terms and conditions.')
            })

        if not attrs.get('privacy_accepted'):
            raise serializers.ValidationError({
                'privacy_accepted': _('You must accept the privacy policy.')
            })

        return attrs

    def create(self, validated_data):
        """Create new user with consents."""
        # Remove non-model fields
        validated_data.pop('password_confirm')
        validated_data.pop('terms_accepted')
        validated_data.pop('privacy_accepted')
        password = validated_data.pop('password')

        # Create user
        user = User.objects.create_user(
            password=password,
            **validated_data
        )

        return user


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User model.

    Used for user profile display and updates.
    """

    role = RoleSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)
    groups = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone',
            'company',
            'default_delivery_address',
            'date_of_birth',
            'role',
            'groups',
            'preferred_language',
            'avatar',
            'marketing_consent',
            'is_email_verified',
            'created_at',
        ]
        read_only_fields = ['id', 'email', 'is_email_verified', 'created_at']

    def get_groups(self, obj):
        return list(obj.groups.values_list('name', flat=True))


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profile.
    """

    class Meta:
        model = User
        fields = [
            'first_name',
            'last_name',
            'phone',
            'company',
            'default_delivery_address',
            'date_of_birth',
            'preferred_language',
            'avatar',
            'marketing_consent',
        ]


class UserAddressSerializer(serializers.ModelSerializer):
    """
    Serializer for UserAddress model.

    Handles CRUD for saved delivery addresses.
    """

    class Meta:
        model = UserAddress
        fields = [
            'id',
            'label',
            'calle',
            'numero_exterior',
            'numero_interior',
            'colonia',
            'ciudad',
            'estado',
            'codigo_postal',
            'referencia',
            'is_default',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer for password change.
    """

    current_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'},
        validators=[validate_password]
    )
    new_password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate_current_password(self, value):
        """Validate current password is correct."""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError(_('Current password is incorrect.'))
        return value

    def validate(self, attrs):
        """Validate new passwords match."""
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': _('New passwords do not match.')
            })
        return attrs


class UserConsentSerializer(serializers.ModelSerializer):
    """
    Serializer for UserConsent model.
    """

    class Meta:
        model = UserConsent
        fields = [
            'id',
            'document_type',
            'document_version',
            'accepted_at',
            'method',
            'revoked_at',
            'is_active',
        ]
        read_only_fields = ['id', 'accepted_at', 'revoked_at', 'is_active']


class FiscalDataSerializer(serializers.ModelSerializer):
    """
    Serializer for FiscalData model.

    Handles Mexican tax information for invoicing.
    """

    full_address = serializers.CharField(read_only=True)

    class Meta:
        model = FiscalData
        fields = [
            'id',
            'rfc',
            'business_name',
            'tax_regime',
            'cfdi_use',
            'street',
            'exterior_number',
            'interior_number',
            'neighborhood',
            'city',
            'state',
            'postal_code',
            'country',
            'full_address',
            'is_default',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_rfc(self, value):
        """Validate RFC format."""
        import re
        # RFC pattern for Mexico (12 or 13 characters)
        pattern = r'^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$'
        if not re.match(pattern, value.upper()):
            raise serializers.ValidationError(_('Invalid RFC format.'))
        return value.upper()

    def validate_postal_code(self, value):
        """Validate postal code is 5 digits."""
        if not value.isdigit() or len(value) != 5:
            raise serializers.ValidationError(_('Postal code must be 5 digits.'))
        return value


class UserAdminSerializer(serializers.ModelSerializer):
    """
    Serializer for admin user management.

    Includes additional fields for admin operations.
    """

    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source='role',
        write_only=True,
        required=False
    )
    orders_count = serializers.IntegerField(read_only=True)
    quotes_count = serializers.IntegerField(read_only=True)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    last_order_date = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'phone',
            'date_of_birth',
            'role',
            'role_id',
            'is_active',
            'is_staff',
            'is_email_verified',
            'preferred_language',
            'marketing_consent',
            'last_login',
            'last_login_ip',
            'orders_count',
            'quotes_count',
            'total_spent',
            'last_order_date',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'last_login', 'last_login_ip', 'created_at', 'updated_at']


class ClientSummarySerializer(serializers.ModelSerializer):
    """Serializer for admin clients dashboard list."""

    name = serializers.CharField(source='full_name', read_only=True)
    total_orders = serializers.IntegerField(source='orders_count', read_only=True)
    total_quotes = serializers.IntegerField(source='quotes_count', read_only=True)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    last_order_date = serializers.DateTimeField(read_only=True)
    address = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'name',
            'email',
            'phone',
            'company',
            'address',
            'city',
            'total_orders',
            'total_quotes',
            'total_spent',
            'last_order_date',
            'created_at',
        ]

    def get_address(self, obj):
        address = obj.default_delivery_address or {}
        if not isinstance(address, dict):
            return ''

        calle = address.get('calle', '')
        numero_exterior = address.get('numero_exterior', '')
        numero_interior = address.get('numero_interior', '')
        colonia = address.get('colonia', '')

        line = ' '.join(part for part in [calle, numero_exterior] if part).strip()
        if numero_interior:
            line = f"{line} Int. {numero_interior}".strip()
        if colonia:
            line = f"{line}, {colonia}".strip(', ')
        return line

    def get_city(self, obj):
        address = obj.default_delivery_address or {}
        if isinstance(address, dict):
            return address.get('ciudad', '')
        return ''


# =============================================================================
# JWT Token Serializers
# =============================================================================

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class EmailVerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT token serializer that enforces email verification.

    Users who registered via email/password must verify their email
    before they can log in. OAuth users (Google) are automatically
    verified since Google already verified their email.
    """

    def validate(self, attrs):
        """
        Validate credentials and check email verification status.

        Raises:
            serializers.ValidationError: If email is not verified.
        """
        # First, validate credentials (this sets self.user)
        data = super().validate(attrs)

        # Check if email is verified
        if not self.user.is_email_verified:
            raise serializers.ValidationError(
                'Debes verificar tu correo electrónico antes de iniciar sesión. '
                'Revisa tu bandeja de entrada para el correo de verificación.',
                code='email_not_verified',
            )

        return data
