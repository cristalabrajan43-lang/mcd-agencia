"""
User Models for MCD-Agencia.

This module defines the custom user model and related models for:
    - User authentication (email-based)
    - Role-based access control (RBAC)
    - User consent tracking
    - Fiscal data for invoicing

Models:
    - User: Custom user model with email authentication
    - Role: User roles for RBAC
    - UserConsent: Tracks user consent for legal compliance
    - FiscalData: Stores fiscal/tax information for CFDI
"""

import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.core import signing
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel, SoftDeleteModel


class UserManager(BaseUserManager):
    """
    Custom user manager for email-based authentication.

    This manager handles user creation with email as the primary identifier
    instead of the traditional username field.
    """

    def create_user(self, email, password=None, **extra_fields):
        """
        Create and save a regular user with the given email and password.

        Args:
            email: User's email address (required)
            password: User's password (optional for OAuth users)
            **extra_fields: Additional user fields

        Returns:
            User: The created user instance

        Raises:
            ValueError: If email is not provided
        """
        if not email:
            raise ValueError(_('The Email field must be set'))

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Create and save a superuser with the given email and password.

        Args:
            email: Superuser's email address
            password: Superuser's password
            **extra_fields: Additional user fields

        Returns:
            User: The created superuser instance
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_email_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))

        return self.create_user(email, password, **extra_fields)


class Role(TimeStampedModel):
    """
    User role model for role-based access control (RBAC).

    Roles define what actions a user can perform in the system.
    Each role has a set of permissions defined as a JSON field.

    Active roles (3 roles):
        - admin: Full administrative access
        - sales: Commercial operations (quotes, orders, customers)
        - customer: End-user access (own orders/quotes)

    Deprecated roles (kept for migration compatibility):
        - superadmin: Use 'admin' instead
        - operations: Use 'admin' instead

    Attributes:
        name: Unique role name (e.g., 'admin', 'sales')
        display_name: Human-readable name
        description: Role description
        permissions: JSON object defining allowed actions
        is_system: Whether this is a system role (cannot be deleted)
    """

    # Role type choices - only 3 active roles
    ADMIN = 'admin'
    SALES = 'sales'
    CUSTOMER = 'customer'

    # Deprecated roles - kept for migration compatibility
    SUPERADMIN = 'superadmin'  # Deprecated: use ADMIN
    OPERATIONS = 'operations'  # Deprecated: use ADMIN

    ROLE_CHOICES = [
        (ADMIN, _('Administrator')),
        (SALES, _('Sales')),
        (CUSTOMER, _('Customer')),
        # Deprecated choices - kept for existing data
        (SUPERADMIN, _('Super Administrator (Deprecated)')),
        (OPERATIONS, _('Operations (Deprecated)')),
    ]

    name = models.CharField(
        _('name'),
        max_length=50,
        unique=True,
        choices=ROLE_CHOICES,
        help_text=_('Unique role identifier.')
    )
    display_name = models.CharField(
        _('display name'),
        max_length=100,
        help_text=_('Human-readable role name.')
    )
    description = models.TextField(
        _('description'),
        blank=True,
        help_text=_('Description of role capabilities.')
    )
    permissions = models.JSONField(
        _('permissions'),
        default=dict,
        help_text=_('JSON object defining role permissions.')
    )
    is_system = models.BooleanField(
        _('is system role'),
        default=False,
        help_text=_('System roles cannot be deleted.')
    )

    class Meta:
        verbose_name = _('role')
        verbose_name_plural = _('roles')
        ordering = ['name']

    def __str__(self):
        return self.display_name

    def has_permission(self, permission):
        """
        Check if role has a specific permission.

        Args:
            permission: Permission string (e.g., 'catalog.edit')

        Returns:
            bool: True if role has the permission
        """
        # Admin has all permissions (also superadmin for backward compatibility)
        if self.name in [self.ADMIN, self.SUPERADMIN]:
            return True

        # Check permission in JSON structure
        parts = permission.split('.')
        current = self.permissions

        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            else:
                return current is True

        return current is True


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel, SoftDeleteModel):
    """
    Custom user model with email-based authentication.

    This model replaces Django's default User model to use email as the
    primary identifier instead of username. It also includes additional
    fields required for the MCD-Agencia platform.

    Attributes:
        id: UUID primary key
        email: Primary identifier and login field
        first_name: User's first name
        last_name: User's last name
        phone: Contact phone number
        date_of_birth: Required for legal compliance
        role: User's role for RBAC
        is_active: Whether the user account is active
        is_staff: Whether user can access admin site
        is_email_verified: Whether email has been verified
        preferred_language: User's preferred language (es/en)
        avatar: Profile picture
        last_login_ip: IP address of last login
        marketing_consent: Whether user consented to marketing emails
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    email = models.EmailField(
        _('email address'),
        unique=True,
        db_index=True,
        help_text=_('Primary email address used for authentication.')
    )
    first_name = models.CharField(
        _('first name'),
        max_length=150,
        help_text=_('User\'s first name.')
    )
    last_name = models.CharField(
        _('last name'),
        max_length=150,
        help_text=_('User\'s last name.')
    )
    phone = models.CharField(
        _('phone number'),
        max_length=20,
        blank=True,
        help_text=_('Contact phone number.')
    )
    company = models.CharField(
        _('company'),
        max_length=255,
        blank=True,
        default='',
        help_text=_('Company or business name.')
    )
    default_delivery_address = models.JSONField(
        _('default delivery address'),
        default=dict,
        blank=True,
        help_text=_('Default delivery address for quote requests.')
    )
    date_of_birth = models.DateField(
        _('date of birth'),
        null=True,
        blank=True,
        help_text=_('Required for legal compliance.')
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name='users',
        null=True,
        blank=True,
        help_text=_('User\'s role for access control.')
    )

    # Status flags
    is_active = models.BooleanField(
        _('active'),
        default=True,
        help_text=_('Designates whether this user account is active.')
    )
    is_staff = models.BooleanField(
        _('staff status'),
        default=False,
        help_text=_('Designates whether the user can access the admin site.')
    )
    is_email_verified = models.BooleanField(
        _('email verified'),
        default=False,
        help_text=_('Designates whether the user has verified their email.')
    )

    # Preferences
    LANGUAGE_CHOICES = [
        ('es', _('Spanish')),
        ('en', _('English')),
    ]
    preferred_language = models.CharField(
        _('preferred language'),
        max_length=2,
        choices=LANGUAGE_CHOICES,
        default='es',
        help_text=_('User\'s preferred language for communications.')
    )
    avatar = models.ImageField(
        _('avatar'),
        upload_to='users/avatars/',
        blank=True,
        null=True,
        help_text=_('User profile picture.')
    )

    # Security
    last_login_ip = models.GenericIPAddressField(
        _('last login IP'),
        null=True,
        blank=True,
        help_text=_('IP address of the last login.')
    )

    # Consents
    marketing_consent = models.BooleanField(
        _('marketing consent'),
        default=False,
        help_text=_('Whether user consented to receive marketing emails.')
    )

    # Sales rep configuration (for role='sales')
    sales_specialties = models.JSONField(
        _('sales specialties'),
        default=list,
        blank=True,
        help_text=_('List of service category IDs this sales rep handles.')
    )
    current_load = models.PositiveIntegerField(
        _('current load'),
        default=0,
        help_text=_('Number of active quote requests assigned.')
    )
    max_load = models.PositiveIntegerField(
        _('max load'),
        default=10,
        help_text=_('Maximum number of active quote requests.')
    )
    receives_auto_assignments = models.BooleanField(
        _('receives auto assignments'),
        default=True,
        help_text=_('Whether this sales rep receives automatic assignments.')
    )
    assignment_priority = models.PositiveSmallIntegerField(
        _('assignment priority'),
        default=3,
        help_text=_('Assignment priority (1=highest, 5=lowest).')
    )

    # Authentication
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = UserManager()

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role', 'is_active']),
        ]

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        """Return user's full name."""
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self):
        """Return user's first name."""
        return self.first_name

    def has_role_permission(self, permission):
        """
        Check if user has a specific permission through their role.

        Args:
            permission: Permission string (e.g., 'catalog.edit')

        Returns:
            bool: True if user has the permission
        """
        if self.is_superuser:
            return True

        if not self.role:
            return False

        return self.role.has_permission(permission)

    def is_admin(self):
        """Check if user has admin role (includes superadmin for backward compatibility)."""
        if not self.role:
            return False
        return self.role.name in [Role.ADMIN, Role.SUPERADMIN]

    def is_sales(self):
        """Check if user has sales role."""
        if not self.role:
            return False
        return self.role.name == Role.SALES

    def is_staff_member(self):
        """Check if user is staff (admin or sales)."""
        if not self.role:
            return False
        return self.role.name in [Role.ADMIN, Role.SUPERADMIN, Role.SALES]

    def is_operations(self):
        """DEPRECATED: Check if user has operations role. Use is_admin() instead."""
        if not self.role:
            return False
        # Treat operations as admin for backward compatibility
        return self.role.name in [Role.OPERATIONS, Role.ADMIN, Role.SUPERADMIN]

    # ------------------------------------------------------------------
    # Email verification token helpers
    # ------------------------------------------------------------------
    EMAIL_VERIFY_SALT = 'email-verification'
    EMAIL_VERIFY_MAX_AGE = 60 * 60 * 24  # 24 hours

    def generate_verification_token(self) -> str:
        """Generate a signed token for email verification (valid 24 h)."""
        return signing.dumps(
            {'user_id': str(self.id), 'email': self.email},
            salt=self.EMAIL_VERIFY_SALT,
        )

    @classmethod
    def verify_email_token(cls, token: str):
        """
        Verify an email-verification token and return the user.

        Returns:
            User instance if valid, None otherwise.
        """
        try:
            data = signing.loads(
                token,
                salt=cls.EMAIL_VERIFY_SALT,
                max_age=cls.EMAIL_VERIFY_MAX_AGE,
            )
            user = cls.objects.get(id=data['user_id'], email=data['email'])
            return user
        except (signing.BadSignature, signing.SignatureExpired, cls.DoesNotExist, KeyError):
            return None


class UserConsent(TimeStampedModel):
    """
    Track user consent for legal compliance (GDPR/CCPA).

    This model records when users accept terms, privacy policies,
    and other legal documents. Each acceptance is a separate record
    to maintain a complete audit trail.

    Attributes:
        user: The user who gave consent
        document_type: Type of document (terms, privacy, cookies, marketing)
        document_version: Version of the document accepted
        accepted_at: When consent was given
        ip_address: IP address when consent was given
        user_agent: Browser/device information
        method: How consent was given (checkbox, banner, etc.)
        revoked_at: When consent was revoked (null if active)
    """

    DOCUMENT_TYPES = [
        ('terms', _('Terms and Conditions')),
        ('privacy', _('Privacy Policy')),
        ('cookies', _('Cookie Policy')),
        ('marketing', _('Marketing Consent')),
    ]

    CONSENT_METHODS = [
        ('registration', _('During Registration')),
        ('checkout', _('During Checkout')),
        ('banner', _('Cookie Banner')),
        ('settings', _('Account Settings')),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='consents',
        help_text=_('User who gave consent.')
    )
    document_type = models.CharField(
        _('document type'),
        max_length=20,
        choices=DOCUMENT_TYPES,
        help_text=_('Type of legal document.')
    )
    document_version = models.CharField(
        _('document version'),
        max_length=20,
        help_text=_('Version of the document accepted.')
    )
    accepted_at = models.DateTimeField(
        _('accepted at'),
        default=timezone.now,
        help_text=_('When consent was given.')
    )
    ip_address = models.GenericIPAddressField(
        _('IP address'),
        help_text=_('IP address when consent was given.')
    )
    user_agent = models.TextField(
        _('user agent'),
        blank=True,
        help_text=_('Browser/device information.')
    )
    method = models.CharField(
        _('consent method'),
        max_length=20,
        choices=CONSENT_METHODS,
        help_text=_('How consent was given.')
    )
    revoked_at = models.DateTimeField(
        _('revoked at'),
        null=True,
        blank=True,
        help_text=_('When consent was revoked (null if active).')
    )

    class Meta:
        verbose_name = _('user consent')
        verbose_name_plural = _('user consents')
        ordering = ['-accepted_at']
        indexes = [
            models.Index(fields=['user', 'document_type']),
            models.Index(fields=['document_type', 'document_version']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.document_type} v{self.document_version}"

    @property
    def is_active(self):
        """Check if consent is still active (not revoked)."""
        return self.revoked_at is None

    def revoke(self):
        """Revoke this consent."""
        self.revoked_at = timezone.now()
        self.save(update_fields=['revoked_at', 'updated_at'])


class UserAddress(TimeStampedModel):
    """
    Saved delivery addresses for a user.

    Allows users to store multiple delivery addresses so they
    can quickly select one when requesting a quote, instead of
    re-entering the full address each time.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='delivery_addresses',
        help_text=_('User who owns this address.')
    )
    label = models.CharField(
        _('label'),
        max_length=100,
        blank=True,
        default='',
        help_text=_('Friendly label, e.g. "Oficina", "Casa".')
    )
    calle = models.CharField(_('street'), max_length=255)
    numero_exterior = models.CharField(_('exterior number'), max_length=50)
    numero_interior = models.CharField(_('interior number'), max_length=50, blank=True, default='')
    colonia = models.CharField(_('neighborhood'), max_length=255)
    ciudad = models.CharField(_('city'), max_length=255)
    estado = models.CharField(_('state'), max_length=255)
    codigo_postal = models.CharField(_('postal code'), max_length=10)
    referencia = models.CharField(_('reference'), max_length=500, blank=True, default='')
    is_default = models.BooleanField(
        _('default address'),
        default=False,
        help_text=_('Whether this is the default delivery address.')
    )

    class Meta:
        verbose_name = _('user address')
        verbose_name_plural = _('user addresses')
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        label_str = f" ({self.label})" if self.label else ""
        return f"{self.calle} {self.numero_exterior}{label_str}"

    @property
    def as_dict(self):
        """Return the address as a dict matching the quote request format."""
        return {
            'calle': self.calle,
            'numero_exterior': self.numero_exterior,
            'numero_interior': self.numero_interior,
            'colonia': self.colonia,
            'ciudad': self.ciudad,
            'estado': self.estado,
            'codigo_postal': self.codigo_postal,
            'referencia': self.referencia,
        }

    def save(self, *args, **kwargs):
        """Ensure only one default address per user."""
        if self.is_default:
            UserAddress.objects.filter(
                user=self.user, is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class FiscalData(TimeStampedModel):
    """
    Fiscal/tax data for invoicing (CFDI preparation).

    Stores Mexican tax information required for generating
    electronic invoices (CFDI) in the future.

    Attributes:
        user: The user this fiscal data belongs to
        rfc: Mexican tax ID (RFC)
        business_name: Legal business name (razón social)
        tax_regime: Tax regime code
        cfdi_use: CFDI usage code
        address: Fiscal address fields
        is_default: Whether this is the default fiscal data
    """

    TAX_REGIME_CHOICES = [
        ('601', _('General de Ley Personas Morales')),
        ('603', _('Personas Morales con Fines no Lucrativos')),
        ('605', _('Sueldos y Salarios e Ingresos Asimilados a Salarios')),
        ('606', _('Arrendamiento')),
        ('607', _('Régimen de Enajenación o Adquisición de Bienes')),
        ('608', _('Demás ingresos')),
        ('610', _('Residentes en el Extranjero sin Establecimiento Permanente en México')),
        ('611', _('Ingresos por Dividendos')),
        ('612', _('Personas Físicas con Actividades Empresariales y Profesionales')),
        ('614', _('Ingresos por intereses')),
        ('615', _('Régimen de los ingresos por obtención de premios')),
        ('616', _('Sin obligaciones fiscales')),
        ('620', _('Sociedades Cooperativas de Producción')),
        ('621', _('Incorporación Fiscal')),
        ('622', _('Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras')),
        ('623', _('Opcional para Grupos de Sociedades')),
        ('624', _('Coordinados')),
        ('625', _('Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas')),
        ('626', _('Régimen Simplificado de Confianza')),
    ]

    CFDI_USE_CHOICES = [
        ('G01', _('Adquisición de mercancías')),
        ('G02', _('Devoluciones, descuentos o bonificaciones')),
        ('G03', _('Gastos en general')),
        ('I01', _('Construcciones')),
        ('I02', _('Mobiliario y equipo de oficina por inversiones')),
        ('I03', _('Equipo de transporte')),
        ('I04', _('Equipo de cómputo y accesorios')),
        ('I05', _('Dados, troqueles, moldes, matrices y herramental')),
        ('I06', _('Comunicaciones telefónicas')),
        ('I07', _('Comunicaciones satelitales')),
        ('I08', _('Otra maquinaria y equipo')),
        ('D01', _('Honorarios médicos, dentales y gastos hospitalarios')),
        ('D02', _('Gastos médicos por incapacidad o discapacidad')),
        ('D03', _('Gastos funerales')),
        ('D04', _('Donativos')),
        ('D05', _('Intereses reales efectivamente pagados por créditos hipotecarios')),
        ('D06', _('Aportaciones voluntarias al SAR')),
        ('D07', _('Primas por seguros de gastos médicos')),
        ('D08', _('Gastos de transportación escolar obligatoria')),
        ('D09', _('Depósitos en cuentas para el ahorro')),
        ('D10', _('Pagos por servicios educativos')),
        ('S01', _('Sin efectos fiscales')),
        ('CP01', _('Pagos')),
        ('CN01', _('Nómina')),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='fiscal_data',
        help_text=_('User this fiscal data belongs to.')
    )
    rfc = models.CharField(
        _('RFC'),
        max_length=13,
        help_text=_('Mexican tax ID (RFC).')
    )
    business_name = models.CharField(
        _('business name'),
        max_length=255,
        help_text=_('Legal business name (razón social).')
    )
    tax_regime = models.CharField(
        _('tax regime'),
        max_length=3,
        choices=TAX_REGIME_CHOICES,
        help_text=_('Tax regime code.')
    )
    cfdi_use = models.CharField(
        _('CFDI use'),
        max_length=4,
        choices=CFDI_USE_CHOICES,
        default='G03',
        help_text=_('CFDI usage code.')
    )

    # Fiscal address
    street = models.CharField(
        _('street'),
        max_length=255,
        help_text=_('Street name.')
    )
    exterior_number = models.CharField(
        _('exterior number'),
        max_length=20,
        help_text=_('Exterior number.')
    )
    interior_number = models.CharField(
        _('interior number'),
        max_length=20,
        blank=True,
        help_text=_('Interior number (optional).')
    )
    neighborhood = models.CharField(
        _('neighborhood'),
        max_length=100,
        help_text=_('Neighborhood (colonia).')
    )
    city = models.CharField(
        _('city'),
        max_length=100,
        help_text=_('City.')
    )
    state = models.CharField(
        _('state'),
        max_length=100,
        help_text=_('State.')
    )
    postal_code = models.CharField(
        _('postal code'),
        max_length=5,
        help_text=_('Postal code (5 digits).')
    )
    country = models.CharField(
        _('country'),
        max_length=3,
        default='MEX',
        help_text=_('Country code (ISO 3166-1 alpha-3).')
    )

    is_default = models.BooleanField(
        _('is default'),
        default=False,
        help_text=_('Whether this is the default fiscal data.')
    )

    class Meta:
        verbose_name = _('fiscal data')
        verbose_name_plural = _('fiscal data')
        ordering = ['-is_default', '-created_at']
        indexes = [
            models.Index(fields=['user', 'is_default']),
            models.Index(fields=['rfc']),
        ]

    def __str__(self):
        return f"{self.business_name} ({self.rfc})"

    def save(self, *args, **kwargs):
        """Ensure only one default fiscal data per user."""
        if self.is_default:
            # Remove default flag from other fiscal data for this user
            FiscalData.objects.filter(
                user=self.user,
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

    @property
    def full_address(self):
        """Return formatted full address."""
        parts = [
            f"{self.street} {self.exterior_number}",
            self.interior_number and f"Int. {self.interior_number}",
            self.neighborhood,
            f"{self.city}, {self.state}",
            f"C.P. {self.postal_code}",
        ]
        return ", ".join(filter(None, parts))
