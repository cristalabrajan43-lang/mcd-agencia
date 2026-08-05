"""
Quote Models for MCD-Agencia.

This module defines the Request for Quote (RFQ) system:
    - QuoteRequest: Initial request from customer
    - Quote: Response quotation from sales team
    - QuoteLine: Line items in a quote
    - QuoteAttachment: Files attached to requests/quotes

Quote Workflow:
    1. Customer submits QuoteRequest
    2. Sales team reviews and creates Quote
    3. Quote is sent to customer (email + web link)
    4. Customer accepts → converts to Order
    5. Customer pays → order processing begins
"""

import logging
import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel, SoftDeleteModel

logger = logging.getLogger(__name__)


def get_default_validity_date():
    """Return default quote validity date (15 days from now)."""
    return timezone.now() + timedelta(days=settings.QUOTE_DEFAULT_VALIDITY_DAYS)


class QuoteRequest(TimeStampedModel, SoftDeleteModel):
    """
    Request for Quote (RFQ) from customer.

    Customers (guests or authenticated) can submit quote requests
    for products/services. These are reviewed by the sales team.

    Attributes:
        status: Request status (draft, in_review, quoted, etc.)
        customer_name: Customer's name
        customer_email: Customer's email
        customer_phone: Customer's phone
        customer_company: Customer's company (optional)
        catalog_item: Requested product/service
        quantity: Requested quantity
        dimensions: Requested dimensions (if applicable)
        material: Requested material (if applicable)
        includes_installation: Whether installation is needed
        description: Additional details
        assigned_to: Sales rep assigned to request
        ip_address: Customer's IP (for anti-spam)
        user: Authenticated user (if logged in)
    """

    STATUS_DRAFT = 'draft'
    STATUS_PENDING = 'pending'
    STATUS_ASSIGNED = 'assigned'
    STATUS_IN_REVIEW = 'in_review'
    STATUS_INFO_REQUESTED = 'info_requested'
    STATUS_QUOTED = 'quoted'
    STATUS_ACCEPTED = 'accepted'
    STATUS_REJECTED = 'rejected'
    STATUS_EXPIRED = 'expired'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (STATUS_DRAFT, _('Draft')),
        (STATUS_PENDING, _('Pending Assignment')),
        (STATUS_ASSIGNED, _('Assigned')),
        (STATUS_IN_REVIEW, _('In Review')),
        (STATUS_INFO_REQUESTED, _('Info Requested')),
        (STATUS_QUOTED, _('Quote Sent')),
        (STATUS_ACCEPTED, _('Accepted')),
        (STATUS_REJECTED, _('Rejected')),
        (STATUS_EXPIRED, _('Expired')),
        (STATUS_CANCELLED, _('Cancelled')),
    ]

    URGENCY_NORMAL = 'normal'
    URGENCY_MEDIUM = 'medium'
    URGENCY_HIGH = 'high'

    URGENCY_CHOICES = [
        (URGENCY_NORMAL, _('Normal')),
        (URGENCY_MEDIUM, _('Medium')),
        (URGENCY_HIGH, _('High')),
    ]

    ASSIGNMENT_MANUAL = 'manual'
    ASSIGNMENT_AUTO_SPECIALTY = 'auto_specialty'
    ASSIGNMENT_AUTO_LOAD = 'auto_load'
    ASSIGNMENT_FALLBACK = 'fallback'

    ASSIGNMENT_CHOICES = [
        (ASSIGNMENT_MANUAL, _('Manual')),
        (ASSIGNMENT_AUTO_SPECIALTY, _('Automatic by Specialty')),
        (ASSIGNMENT_AUTO_LOAD, _('Automatic by Load')),
        (ASSIGNMENT_FALLBACK, _('Fallback')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    request_number = models.CharField(
        _('request number'),
        max_length=20,
        unique=True,
        db_index=True,
        help_text=_('Human-readable request number.')
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
        help_text=_('Current request status.')
    )

    # Customer Information
    customer_name = models.CharField(
        _('customer name'),
        max_length=255,
        help_text=_('Customer\'s full name.')
    )
    customer_email = models.EmailField(
        _('customer email'),
        help_text=_('Customer\'s email address.')
    )
    customer_phone = models.CharField(
        _('customer phone'),
        max_length=20,
        blank=True,
        help_text=_('Customer\'s phone number.')
    )
    customer_company = models.CharField(
        _('customer company'),
        max_length=255,
        blank=True,
        help_text=_('Customer\'s company name.')
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quote_requests',
        help_text=_('Authenticated user (if logged in).')
    )

    # Requested Item
    catalog_item = models.ForeignKey(
        'catalog.CatalogItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quote_requests',
        help_text=_('Requested product/service.')
    )
    catalog_item_name = models.CharField(
        _('item name'),
        max_length=255,
        blank=True,
        help_text=_('Name of requested item (preserved if item deleted).')
    )

    # Request Details
    quantity = models.PositiveIntegerField(
        _('quantity'),
        default=1,
        help_text=_('Requested quantity.')
    )
    dimensions = models.CharField(
        _('dimensions'),
        max_length=100,
        blank=True,
        help_text=_('Requested dimensions (e.g., "3x2m").')
    )
    material = models.CharField(
        _('material'),
        max_length=100,
        blank=True,
        help_text=_('Requested material.')
    )
    includes_installation = models.BooleanField(
        _('includes installation'),
        default=False,
        help_text=_('Whether installation is requested.')
    )
    description = models.TextField(
        _('description'),
        blank=True,
        help_text=_('Additional details and requirements.')
    )

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_quote_requests',
        help_text=_('Sales rep assigned to this request.')
    )

    # Tracking
    ip_address = models.GenericIPAddressField(
        _('IP address'),
        null=True,
        blank=True,
        help_text=_('Customer\'s IP address.')
    )
    user_agent = models.TextField(
        _('user agent'),
        blank=True,
        help_text=_('Customer\'s browser/device info.')
    )
    preferred_language = models.CharField(
        _('preferred language'),
        max_length=2,
        choices=[('es', 'Español'), ('en', 'English')],
        default='es',
        help_text=_('Preferred language for communication.')
    )

    # Service details (dynamic fields from landing form)
    service_type = models.CharField(
        _('service type'),
        max_length=100,
        blank=True,
        help_text=_('Type of service requested (from landing form).')
    )
    service_details = models.JSONField(
        _('service details'),
        default=dict,
        blank=True,
        help_text=_('Dynamic service-specific details from landing form.')
    )

    # Guest/registered tracking
    is_guest = models.BooleanField(
        _('is guest'),
        default=True,
        help_text=_('Whether customer is a guest (not registered).')
    )

    # Required date and urgency
    required_date = models.DateField(
        _('required date'),
        null=True,
        blank=True,
        help_text=_('Date when customer needs the service.')
    )
    urgency = models.CharField(
        _('urgency'),
        max_length=10,
        choices=URGENCY_CHOICES,
        default=URGENCY_NORMAL,
        help_text=_('Request urgency (calculated from required_date).')
    )

    # Assignment tracking
    assignment_method = models.CharField(
        _('assignment method'),
        max_length=20,
        choices=ASSIGNMENT_CHOICES,
        blank=True,
        help_text=_('How the request was assigned.')
    )
    assigned_at = models.DateTimeField(
        _('assigned at'),
        null=True,
        blank=True,
        help_text=_('When the request was assigned.')
    )

    # Delivery method
    DELIVERY_INSTALLATION = 'installation'
    DELIVERY_PICKUP = 'pickup'
    DELIVERY_SHIPPING = 'shipping'
    DELIVERY_DIGITAL = 'digital'
    DELIVERY_NOT_APPLICABLE = 'not_applicable'
    DELIVERY_METHOD_CHOICES = [
        (DELIVERY_INSTALLATION, _('Installation on-site')),
        (DELIVERY_PICKUP, _('Pickup at branch')),
        (DELIVERY_SHIPPING, _('Shipping')),
        (DELIVERY_DIGITAL, _('Digital delivery')),
        (DELIVERY_NOT_APPLICABLE, _('Not applicable')),
    ]
    delivery_method = models.CharField(
        _('delivery method'),
        max_length=20,
        choices=DELIVERY_METHOD_CHOICES,
        blank=True,
        help_text=_('Preferred delivery method.')
    )
    delivery_address = models.JSONField(
        _('delivery address'),
        default=dict,
        blank=True,
        help_text=_('Delivery/installation address details.')
    )
    pickup_branch = models.ForeignKey(
        'content.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quote_requests',
        verbose_name=_('pickup branch'),
        help_text=_('Branch for pickup (if delivery method is pickup).')
    )

    # Info request (vendor asks client for missing information)
    info_request_message = models.TextField(
        _('info request message'),
        blank=True,
        help_text=_('Message from vendor requesting additional information from the client.')
    )
    info_request_token = models.UUIDField(
        _('info request token'),
        null=True,
        blank=True,
        unique=True,
        help_text=_('Unique token for the client to respond to info request.')
    )
    info_request_fields = models.JSONField(
        _('info request fields'),
        default=list,
        blank=True,
        help_text=_('List of service_details field keys the vendor flagged for review.')
    )

    class Meta:
        verbose_name = _('quote request')
        verbose_name_plural = _('quote requests')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['request_number']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['assigned_to', 'status']),
            models.Index(fields=['customer_email']),
        ]

    def __str__(self):
        return f"RFQ-{self.request_number}"

    def save(self, *args, **kwargs):
        """Generate request number and preserve item name."""
        if not self.request_number:
            self.request_number = self._generate_request_number()
        if self.catalog_item and not self.catalog_item_name:
            self.catalog_item_name = self.catalog_item.name

        for _ in range(3):
            try:
                super().save(*args, **kwargs)
                return
            except IntegrityError as exc:
                # Guard against race conditions and soft-deleted collisions
                # on the unique request_number index.
                if self._state.adding and 'quotes_quoterequest_request_number_key' in str(exc):
                    self.request_number = self._generate_request_number()
                    continue
                raise

        # If all retries were exhausted, bubble up the latest DB error.
        super().save(*args, **kwargs)

    def _generate_request_number(self):
        """Generate a unique sequential request number: YYYYMMDD-NNNN."""
        from django.utils import timezone
        date_str = timezone.localtime().strftime('%Y%m%d')
        prefix = f"{date_str}-"

        # Find the highest existing number for today
        last = (
            QuoteRequest.all_objects
            .filter(request_number__startswith=prefix)
            .order_by('-request_number')
            .values_list('request_number', flat=True)
            .first()
        )

        if last:
            try:
                seq = int(last.split('-')[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1

        return f"{prefix}{seq:04d}"

    def calculate_urgency(self):
        """Calculate urgency based on required_date."""
        if not self.required_date:
            return self.URGENCY_NORMAL

        from datetime import date
        days_remaining = (self.required_date - date.today()).days

        if days_remaining <= 7:
            return self.URGENCY_HIGH
        elif days_remaining <= 14:
            return self.URGENCY_MEDIUM
        else:
            return self.URGENCY_NORMAL

    @property
    def days_until_required(self):
        """Get days remaining until required date."""
        if not self.required_date:
            return None
        from datetime import date
        return (self.required_date - date.today()).days

    def assign_to_sales_rep(self, auto=True):
        """
        Assign this request to a sales rep.

        Args:
            auto: If True, use automatic assignment logic.

        Returns:
            User: The assigned sales rep, or None if no one available.
        """
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()

            # Get all eligible sales reps
            eligible_reps = User.objects.filter(
                role__name='sales',
                is_active=True,
                receives_auto_assignments=True,
            ).filter(
                current_load__lt=models.F('max_load')
            )

            if not eligible_reps.exists():
                # Fallback: any active sales rep with capacity
                eligible_reps = User.objects.filter(
                    role__name='sales',
                    is_active=True,
                ).filter(
                    current_load__lt=models.F('max_load')
                )

            if not eligible_reps.exists():
                return None

            # Try to find rep with matching specialty
            if self.service_type:
                specialty_reps = [
                    rep for rep in eligible_reps.order_by('current_load', 'assignment_priority')
                    if rep.sales_specialties and self.service_type in rep.sales_specialties
                ]
                if specialty_reps:
                    assigned_rep = specialty_reps[0]
                    self._do_assignment(assigned_rep, self.ASSIGNMENT_AUTO_SPECIALTY)
                    return assigned_rep

            assigned_rep = eligible_reps.order_by(
                'current_load', 'assignment_priority'
            ).first()

            if assigned_rep:
                method = self.ASSIGNMENT_AUTO_LOAD if auto else self.ASSIGNMENT_MANUAL
                self._do_assignment(assigned_rep, method)

            return assigned_rep
        except Exception:
            logger.exception('Auto-assignment failed for quote request %s', getattr(self, 'id', None))
            return None

    def _do_assignment(self, sales_rep, method):
        """Perform the actual assignment."""
        self.assigned_to = sales_rep
        self.assignment_method = method
        self.assigned_at = timezone.now()
        self.status = self.STATUS_ASSIGNED

        # Increment sales rep's load
        sales_rep.current_load = models.F('current_load') + 1
        sales_rep.save(update_fields=['current_load'])

        self.save(update_fields=[
            'assigned_to', 'assignment_method', 'assigned_at', 'status', 'updated_at'
        ])


class QuoteRequestService(TimeStampedModel):
    """
    Individual service within a multi-service quote request.

    Allows customers to request quotes for multiple services in a single
    request, each with its own service type, details, delivery method,
    and required date.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    quote_request = models.ForeignKey(
        QuoteRequest,
        on_delete=models.CASCADE,
        related_name='services',
        help_text=_('Parent quote request.'),
    )
    position = models.PositiveIntegerField(
        _('position'),
        default=0,
        help_text=_('Display order within the request.'),
    )

    # Service details
    service_type = models.CharField(
        _('service type'),
        max_length=100,
        blank=True,
        help_text=_('Type of service requested.'),
    )
    service_details = models.JSONField(
        _('service details'),
        default=dict,
        blank=True,
        help_text=_('Dynamic service-specific details.'),
    )

    # Per-service delivery
    delivery_method = models.CharField(
        _('delivery method'),
        max_length=20,
        choices=QuoteRequest.DELIVERY_METHOD_CHOICES,
        blank=True,
    )
    delivery_address = models.JSONField(
        _('delivery address'),
        default=dict,
        blank=True,
    )
    pickup_branch = models.ForeignKey(
        'content.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='request_services',
        verbose_name=_('pickup branch'),
    )

    # Per-service required date
    required_date = models.DateField(
        _('required date'),
        null=True,
        blank=True,
    )

    # Per-service description / comments
    description = models.TextField(
        _('comments'),
        blank=True,
    )

    # Per-service attachments are handled via QuoteAttachment FK

    class Meta:
        verbose_name = _('quote request service')
        verbose_name_plural = _('quote request services')
        ordering = ['position', 'created_at']

    def __str__(self):
        return f"{self.service_type} (#{self.position + 1})"


class Quote(TimeStampedModel, SoftDeleteModel):
    """
    Quotation response from sales team.

    Quotes are created in response to QuoteRequests and contain
    itemized pricing. They can be converted to orders upon acceptance.

    Attributes:
        quote_number: Human-readable quote number (folio)
        quote_request: Source request
        status: Quote status
        customer: Customer user
        customer_email: Customer email for notifications
        valid_until: Quote validity date
        subtotal: Quote subtotal
        tax_rate: Applied tax rate
        tax_amount: Tax amount
        total: Quote total
        terms: Commercial terms
        internal_notes: Staff notes
        token: Secure access token
        pdf_file: Generated PDF file
        sent_at: When quote was sent
        viewed_at: When customer viewed quote
        accepted_at: When customer accepted
    """

    STATUS_DRAFT = 'draft'
    STATUS_SENT = 'sent'
    STATUS_VIEWED = 'viewed'
    STATUS_CHANGES_REQUESTED = 'changes_requested'
    STATUS_ACCEPTED = 'accepted'
    STATUS_REJECTED = 'rejected'
    STATUS_EXPIRED = 'expired'
    STATUS_CONVERTED = 'converted'

    STATUS_CHOICES = [
        (STATUS_DRAFT, _('Draft')),
        (STATUS_SENT, _('Sent')),
        (STATUS_VIEWED, _('Viewed')),
        (STATUS_CHANGES_REQUESTED, _('Changes Requested')),
        (STATUS_ACCEPTED, _('Accepted')),
        (STATUS_REJECTED, _('Rejected')),
        (STATUS_EXPIRED, _('Expired')),
        (STATUS_CONVERTED, _('Converted to Order')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    quote_number = models.CharField(
        _('quote number'),
        max_length=20,
        unique=True,
        db_index=True,
        help_text=_('Human-readable quote number (folio).')
    )
    quote_request = models.ForeignKey(
        QuoteRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotes',
        help_text=_('Source quote request.')
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
        help_text=_('Current quote status.')
    )
    version = models.PositiveIntegerField(
        _('version'),
        default=1,
        help_text=_('Quote version number.')
    )

    # Customer
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotes',
        help_text=_('Customer user.')
    )
    customer_name = models.CharField(
        _('customer name'),
        max_length=255,
        help_text=_('Customer\'s name.')
    )
    customer_email = models.EmailField(
        _('customer email'),
        help_text=_('Customer\'s email for notifications.')
    )
    customer_company = models.CharField(
        _('customer company'),
        max_length=255,
        blank=True,
        help_text=_('Customer\'s company.')
    )
    customer_phone = models.CharField(
        _('customer phone'),
        max_length=20,
        blank=True,
        help_text=_('Customer\'s phone number.')
    )

    # Sales
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_quotes',
        help_text=_('Sales rep who created quote.')
    )

    # Validity
    valid_until = models.DateTimeField(
        _('valid until'),
        default=get_default_validity_date,
        help_text=_('Quote validity date.')
    )

    # Financials
    subtotal = models.DecimalField(
        _('subtotal'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text=_('Quote subtotal before tax.')
    )
    tax_rate = models.DecimalField(
        _('tax rate'),
        max_digits=5,
        decimal_places=4,
        default=Decimal('0.1600'),
        help_text=_('Applied tax rate.')
    )
    tax_amount = models.DecimalField(
        _('tax amount'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text=_('Tax amount.')
    )
    total = models.DecimalField(
        _('total'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text=_('Quote total.')
    )
    currency = models.CharField(
        _('currency'),
        max_length=3,
        default='MXN',
        help_text=_('Currency code.')
    )

    # Payment
    payment_mode = models.CharField(
        _('payment mode'),
        max_length=20,
        choices=[('FULL', _('Full')), ('DEPOSIT_ALLOWED', _('Deposit'))],
        default='FULL',
        help_text=_('Payment requirements.')
    )
    deposit_percentage = models.DecimalField(
        _('deposit percentage'),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Deposit percentage if applicable.')
    )

    # Terms
    terms = models.TextField(
        _('commercial terms'),
        blank=True,
        help_text=_('Commercial terms and conditions.')
    )
    terms_en = models.TextField(
        _('commercial terms (English)'),
        blank=True,
        help_text=_('Terms in English.')
    )
    internal_notes = models.TextField(
        _('internal notes'),
        blank=True,
        help_text=_('Staff notes (not visible to customer).')
    )

    # Access
    token = models.UUIDField(
        _('access token'),
        default=uuid.uuid4,
        unique=True,
        help_text=_('Secure access token for customer link.')
    )

    # Files
    pdf_file = models.FileField(
        _('PDF file'),
        upload_to='quotes/pdfs/',
        blank=True,
        null=True,
        help_text=_('Generated PDF file.')
    )
    pdf_file_en = models.FileField(
        _('PDF file (English)'),
        upload_to='quotes/pdfs/',
        blank=True,
        null=True,
        help_text=_('English PDF file.')
    )

    # Tracking
    sent_at = models.DateTimeField(
        _('sent at'),
        null=True,
        blank=True,
        help_text=_('When quote was sent to customer.')
    )
    viewed_at = models.DateTimeField(
        _('viewed at'),
        null=True,
        blank=True,
        help_text=_('When customer first viewed quote.')
    )
    accepted_at = models.DateTimeField(
        _('accepted at'),
        null=True,
        blank=True,
        help_text=_('When customer accepted quote.')
    )
    rejected_at = models.DateTimeField(
        _('rejected at'),
        null=True,
        blank=True,
        help_text=_('When customer rejected quote.')
    )

    # Language
    language = models.CharField(
        _('language'),
        max_length=2,
        choices=[('es', 'Español'), ('en', 'English')],
        default='es',
        help_text=_('Primary language for quote.')
    )

    # Delivery
    delivery_time_text = models.CharField(
        _('delivery time text'),
        max_length=100,
        blank=True,
        help_text=_('Human-readable delivery time (e.g., "10 business days").')
    )
    estimated_delivery_date = models.DateField(
        _('estimated delivery date'),
        null=True,
        blank=True,
        help_text=_('Estimated delivery date.')
    )
    delivery_method = models.CharField(
        _('delivery method'),
        max_length=20,
        choices=QuoteRequest.DELIVERY_METHOD_CHOICES,
        blank=True,
        help_text=_('Selected delivery method.')
    )
    pickup_branch = models.ForeignKey(
        'content.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotes',
        verbose_name=_('pickup branch'),
        help_text=_('Branch for pickup delivery.')
    )
    delivery_address = models.JSONField(
        _('delivery address'),
        default=dict,
        blank=True,
        help_text=_('Shipping or installation address.')
    )

    # Payment methods and conditions
    payment_methods = models.JSONField(
        _('payment methods'),
        default=list,
        blank=True,
        help_text=_('Accepted payment methods.')
    )
    payment_conditions = models.TextField(
        _('payment conditions'),
        blank=True,
        help_text=_('Payment conditions and terms.')
    )
    included_services = models.JSONField(
        _('included services'),
        default=list,
        blank=True,
        help_text=_('Services included in the quote.')
    )

    # Customer notes
    customer_notes = models.TextField(
        _('customer notes'),
        blank=True,
        help_text=_('Notes visible to customer.')
    )

    # Electronic signature
    signature_image = models.ImageField(
        _('signature image'),
        upload_to='quotes/signatures/',
        blank=True, null=True,
        help_text=_('Customer signature image captured on acceptance.')
    )
    signature_name = models.CharField(
        _('signer name'), max_length=255, blank=True
    )
    signed_at = models.DateTimeField(_('signed at'), null=True, blank=True)

    # View tracking
    view_count = models.PositiveIntegerField(
        _('view count'),
        default=0,
        help_text=_('Number of times quote was viewed.')
    )
    first_view_at = models.DateTimeField(
        _('first view at'),
        null=True,
        blank=True,
        help_text=_('First time customer viewed quote.')
    )
    last_view_at = models.DateTimeField(
        _('last view at'),
        null=True,
        blank=True,
        help_text=_('Last time customer viewed quote.')
    )

    class Meta:
        verbose_name = _('quote')
        verbose_name_plural = _('quotes')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['quote_number']),
            models.Index(fields=['token']),
            models.Index(fields=['status', 'valid_until']),
            models.Index(fields=['customer_email']),
        ]

    def __str__(self):
        return f"Quote {self.quote_number}"

    def save(self, *args, **kwargs):
        """Generate quote number and calculate totals."""
        if not self.quote_number:
            self.quote_number = self._generate_quote_number()
        super().save(*args, **kwargs)

    def _generate_quote_number(self):
        """Generate a unique sequential quote number: COT-YYYYMMDD-NNNN."""
        from django.utils import timezone as tz
        date_str = tz.localtime().strftime('%Y%m%d')
        prefix = f"COT-{date_str}-"

        # Find the highest existing number for today
        last = (
            Quote.all_objects
            .filter(quote_number__startswith=prefix)
            .order_by('-quote_number')
            .values_list('quote_number', flat=True)
            .first()
        )

        if last:
            try:
                seq = int(last.split('-')[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1

        return f"{prefix}{seq:04d}"

    @property
    def is_expired(self):
        """Check if quote has expired."""
        return timezone.now() > self.valid_until

    @property
    def is_valid(self):
        """Check if quote is still valid for acceptance."""
        return (
            self.status in [self.STATUS_SENT, self.STATUS_VIEWED] and
            not self.is_expired
        )

    @property
    def deposit_amount(self):
        """Calculate deposit amount if applicable."""
        if self.payment_mode == 'DEPOSIT_ALLOWED' and self.deposit_percentage:
            return self.total * (self.deposit_percentage / Decimal('100'))
        return self.total

    def calculate_totals(self):
        """Recalculate quote totals from line items.

        Shipping costs are added separately without IVA.
        """
        lines = self.lines.all()
        self.subtotal = sum(line.line_total for line in lines)
        self.tax_amount = self.subtotal * self.tax_rate
        shipping_total = sum(line.shipping_cost for line in lines)
        self.total = self.subtotal + self.tax_amount + shipping_total

    def mark_as_viewed(self):
        """Mark quote as viewed by customer."""
        now = timezone.now()
        fields_to_update = ['view_count', 'last_view_at', 'updated_at']

        # Increment view count
        self.view_count = models.F('view_count') + 1
        self.last_view_at = now

        # First view
        if not self.first_view_at:
            self.first_view_at = now
            self.viewed_at = now
            fields_to_update.extend(['first_view_at', 'viewed_at'])
            if self.status == self.STATUS_SENT:
                self.status = self.STATUS_VIEWED
                fields_to_update.append('status')

        self.save(update_fields=fields_to_update)
        self.refresh_from_db(fields=['view_count'])

    def get_web_url(self):
        """Get the customer-facing web URL for this quote."""
        return f"/cotizaciones/{self.token}"


class QuoteLine(TimeStampedModel):
    """
    Individual line item in a quote.

    Each line represents a product/service with quantity and pricing.

    Attributes:
        quote: Parent quote
        catalog_item: Source product/service
        description: Line item description
        description_en: Description in English
        quantity: Quantity
        unit: Unit of measure
        unit_price: Price per unit
        line_total: Line total
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        related_name='lines',
        help_text=_('Parent quote.')
    )
    catalog_item = models.ForeignKey(
        'catalog.CatalogItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quote_lines',
        help_text=_('Source product/service.')
    )

    # Line Details
    concept = models.CharField(
        _('concept'),
        max_length=255,
        help_text=_('Line item concept/name.')
    )
    concept_en = models.CharField(
        _('concept (English)'),
        max_length=255,
        blank=True,
        help_text=_('Concept in English.')
    )
    description = models.TextField(
        _('description'),
        blank=True,
        help_text=_('Detailed description.')
    )
    description_en = models.TextField(
        _('description (English)'),
        blank=True,
        help_text=_('Description in English.')
    )
    quantity = models.DecimalField(
        _('quantity'),
        max_digits=10,
        decimal_places=2,
        default=Decimal('1.00'),
        help_text=_('Quantity.')
    )
    unit = models.CharField(
        _('unit'),
        max_length=20,
        default='pz',
        help_text=_('Unit of measure (pz, m², kg, etc.).')
    )
    unit_price = models.DecimalField(
        _('unit price'),
        max_digits=12,
        decimal_places=2,
        help_text=_('Price per unit.')
    )
    line_total = models.DecimalField(
        _('line total'),
        max_digits=12,
        decimal_places=2,
        help_text=_('Line total.')
    )

    # Shipping cost (separate from product price, no IVA applied)
    shipping_cost = models.DecimalField(
        _('shipping cost'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text=_('Shipping/delivery cost for this line item (no tax applied).')
    )

    # Per-line delivery info (for multi-service quotes each service may differ)
    delivery_method = models.CharField(
        _('delivery method'),
        max_length=20,
        choices=QuoteRequest.DELIVERY_METHOD_CHOICES,
        blank=True,
    )
    delivery_address = models.JSONField(
        _('delivery address'),
        default=dict,
        blank=True,
    )
    pickup_branch = models.ForeignKey(
        'content.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quote_lines',
    )
    estimated_delivery_date = models.DateField(
        _('estimated delivery date'),
        null=True,
        blank=True,
    )

    # Service-specific structured details (JSON)
    service_details = models.JSONField(
        _('service details'),
        null=True,
        blank=True,
        help_text=_('Structured service-specific fields (type, dimensions, routes, etc.).')
    )

    # Ordering
    position = models.PositiveIntegerField(
        _('position'),
        default=0,
        help_text=_('Display order.')
    )

    class Meta:
        verbose_name = _('quote line')
        verbose_name_plural = _('quote lines')
        ordering = ['position', 'created_at']

    def __str__(self):
        return f"{self.quantity} {self.unit} x {self.concept}"

    def save(self, *args, **kwargs):
        """Calculate line total before saving."""
        self.line_total = self.unit_price * self.quantity
        super().save(*args, **kwargs)


class QuoteAttachment(TimeStampedModel):
    """
    File attachments for quote requests and quotes.

    Supports artwork, references, and other files from customers.

    Attributes:
        quote_request: Source request
        quote: Source quote
        file: Uploaded file
        filename: Original filename
        file_type: MIME type
        file_size: Size in bytes
        description: File description
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    quote_request = models.ForeignKey(
        QuoteRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments',
        help_text=_('Source quote request.')
    )
    request_service = models.ForeignKey(
        QuoteRequestService,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments',
        help_text=_('Source request service (for multi-service requests).')
    )
    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments',
        help_text=_('Source quote.')
    )
    change_request = models.ForeignKey(
        'QuoteChangeRequest',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments',
        help_text=_('Source change request.')
    )
    file = models.FileField(
        _('file'),
        upload_to='quotes/attachments/',
        help_text=_('Uploaded file.')
    )
    filename = models.CharField(
        _('filename'),
        max_length=255,
        help_text=_('Original filename.')
    )
    file_type = models.CharField(
        _('file type'),
        max_length=100,
        blank=True,
        help_text=_('MIME type.')
    )
    file_size = models.PositiveIntegerField(
        _('file size'),
        default=0,
        help_text=_('Size in bytes.')
    )
    description = models.CharField(
        _('description'),
        max_length=255,
        blank=True,
        help_text=_('File description.')
    )

    class Meta:
        verbose_name = _('quote attachment')
        verbose_name_plural = _('quote attachments')
        ordering = ['created_at']

    def __str__(self):
        return self.filename

    def save(self, *args, **kwargs):
        """Extract file metadata before saving."""
        if self.file:
            if not self.filename:
                self.filename = self.file.name
            if not self.file_size:
                self.file_size = self.file.size
        super().save(*args, **kwargs)


class QuoteResponse(TimeStampedModel):
    """
    Customer response to a quote.

    Records customer actions: view, comment, change request, approval, rejection.

    Attributes:
        quote: The quote being responded to
        action: Type of response
        comment: Customer's comment
        responded_by: User who responded (null if guest)
        guest_name: Guest name (if not registered)
        guest_email: Guest email (if not registered)
        ip_address: IP address when responding
    """

    ACTION_VIEW = 'view'
    ACTION_COMMENT = 'comment'
    ACTION_CHANGE_REQUEST = 'change_request'
    ACTION_APPROVAL = 'approval'
    ACTION_REJECTION = 'rejection'
    ACTION_SEND = 'send'

    ACTION_CHOICES = [
        (ACTION_VIEW, _('Viewed')),
        (ACTION_COMMENT, _('Commented')),
        (ACTION_CHANGE_REQUEST, _('Change Request')),
        (ACTION_APPROVAL, _('Approved')),
        (ACTION_REJECTION, _('Rejected')),
        (ACTION_SEND, _('Sent')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        related_name='responses',
        help_text=_('Quote being responded to.')
    )
    action = models.CharField(
        _('action'),
        max_length=20,
        choices=ACTION_CHOICES,
        help_text=_('Type of response.')
    )
    comment = models.TextField(
        _('comment'),
        blank=True,
        help_text=_('Customer\'s comment.')
    )

    # Responder info
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quote_responses',
        help_text=_('User who responded (null if guest).')
    )
    guest_name = models.CharField(
        _('guest name'),
        max_length=255,
        blank=True,
        help_text=_('Guest name (if not registered).')
    )
    guest_email = models.EmailField(
        _('guest email'),
        blank=True,
        help_text=_('Guest email (if not registered).')
    )

    # PDF snapshot (for send actions — preserves the PDF at the time of sending)
    pdf_file = models.FileField(
        _('PDF file'),
        upload_to='quotes/response_pdfs/',
        blank=True,
        null=True,
        help_text=_('Snapshot of the PDF at the time of sending.')
    )

    # Tracking
    ip_address = models.GenericIPAddressField(
        _('IP address'),
        null=True,
        blank=True,
        help_text=_('IP address when responding.')
    )

    class Meta:
        verbose_name = _('quote response')
        verbose_name_plural = _('quote responses')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['quote', 'action']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.get_action_display()} - {self.quote.quote_number}"


class GuestAccessToken(TimeStampedModel):
    """
    Temporary access token for guest customers.

    Allows guests to view and respond to quotes without registration.

    Attributes:
        token: Unique secure token
        quote_request: Associated quote request (optional)
        quote: Associated quote (optional)
        email: Guest's email
        token_type: Type of access allowed
        expires_at: When token expires
        used: Whether token has been used
        used_at: When token was used
        ip_used: IP address when token was used
    """

    TYPE_VIEW_QUOTE = 'view_quote'
    TYPE_RESPOND_QUOTE = 'respond_quote'

    TYPE_CHOICES = [
        (TYPE_VIEW_QUOTE, _('View Quote')),
        (TYPE_RESPOND_QUOTE, _('Respond to Quote')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    token = models.CharField(
        _('token'),
        max_length=64,
        unique=True,
        db_index=True,
        help_text=_('Unique secure token.')
    )
    quote_request = models.ForeignKey(
        QuoteRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='guest_tokens',
        help_text=_('Associated quote request.')
    )
    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='guest_tokens',
        help_text=_('Associated quote.')
    )
    email = models.EmailField(
        _('email'),
        help_text=_('Guest\'s email address.')
    )
    token_type = models.CharField(
        _('token type'),
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_RESPOND_QUOTE,
        help_text=_('Type of access allowed.')
    )
    expires_at = models.DateTimeField(
        _('expires at'),
        help_text=_('When token expires.')
    )
    used = models.BooleanField(
        _('used'),
        default=False,
        help_text=_('Whether token has been used.')
    )
    used_at = models.DateTimeField(
        _('used at'),
        null=True,
        blank=True,
        help_text=_('When token was used.')
    )
    ip_used = models.GenericIPAddressField(
        _('IP used'),
        null=True,
        blank=True,
        help_text=_('IP address when token was used.')
    )

    class Meta:
        verbose_name = _('guest access token')
        verbose_name_plural = _('guest access tokens')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['email']),
            models.Index(fields=['expires_at', 'used']),
        ]

    def __str__(self):
        return f"Token for {self.email}"

    @property
    def is_expired(self):
        """Check if token has expired."""
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        """Check if token is still valid."""
        return not self.is_expired and not self.used

    def mark_as_used(self, ip_address=None):
        """Mark token as used."""
        self.used = True
        self.used_at = timezone.now()
        if ip_address:
            self.ip_used = ip_address
        self.save(update_fields=['used', 'used_at', 'ip_used', 'updated_at'])

    @classmethod
    def generate_token(cls):
        """Generate a secure random token."""
        import secrets
        return secrets.token_urlsafe(48)

    @classmethod
    def create_for_quote(cls, quote, email, hours_valid=48):
        """Create a new guest access token for a quote."""
        return cls.objects.create(
            token=cls.generate_token(),
            quote=quote,
            email=email,
            token_type=cls.TYPE_RESPOND_QUOTE,
            expires_at=timezone.now() + timedelta(hours=hours_valid)
        )


class QuoteChangeRequest(TimeStampedModel):
    """
    Customer-requested changes to a quote.

    When a customer wants to modify a quote (change quantities, add/remove items),
    they submit a change request. The sales team reviews and either approves
    (creating a new quote version) or rejects.

    Attributes:
        quote: The quote being modified
        status: Request status (pending, approved, rejected)
        customer_comments: Customer's explanation for changes
        proposed_lines: JSON array of proposed line items
        deleted_line_ids: IDs of lines customer wants removed
        original_snapshot: Snapshot of original quote for comparison
        reviewed_by: Sales rep who reviewed
        reviewed_at: When request was reviewed
        review_notes: Sales rep's notes
    """

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'

    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending Review')),
        (STATUS_APPROVED, _('Approved')),
        (STATUS_REJECTED, _('Rejected')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        related_name='change_requests',
        help_text=_('Quote being modified.')
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
        help_text=_('Request status.')
    )

    # Customer info (for guests)
    customer_name = models.CharField(
        _('customer name'),
        max_length=255,
        blank=True,
        help_text=_('Customer name (copied from quote).')
    )
    customer_email = models.EmailField(
        _('customer email'),
        blank=True,
        help_text=_('Customer email (copied from quote).')
    )

    # Customer's explanation
    customer_comments = models.TextField(
        _('customer comments'),
        blank=True,
        help_text=_('Customer explanation for requested changes.')
    )

    # Proposed changes (JSON structure)
    proposed_lines = models.JSONField(
        _('proposed lines'),
        default=list,
        help_text=_('''
            Array of proposed line items. Each item contains:
            - id: Original line ID (null for new lines)
            - action: "modify", "add", or "delete"
            - concept: Item concept/name
            - description: Item description
            - quantity: Proposed quantity
            - unit: Unit of measure
            - unit_price: Price per unit (may be null, sales will set)
            - original_values: Original values for modified lines
        ''')
    )

    # Original quote snapshot for comparison
    original_snapshot = models.JSONField(
        _('original snapshot'),
        default=dict,
        help_text=_('Snapshot of original quote state for comparison.')
    )

    # Review
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_change_requests',
        help_text=_('Sales rep who reviewed.')
    )
    reviewed_at = models.DateTimeField(
        _('reviewed at'),
        null=True,
        blank=True,
        help_text=_('When request was reviewed.')
    )
    review_notes = models.TextField(
        _('review notes'),
        blank=True,
        help_text=_('Sales rep notes on the review.')
    )

    # Tracking
    ip_address = models.GenericIPAddressField(
        _('IP address'),
        null=True,
        blank=True,
        help_text=_('Customer IP when submitting.')
    )

    class Meta:
        verbose_name = _('quote change request')
        verbose_name_plural = _('quote change requests')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['quote', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"Change Request for {self.quote.quote_number} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        """Copy customer info from quote if not set."""
        if not self.customer_name and self.quote:
            self.customer_name = self.quote.customer_name
        if not self.customer_email and self.quote:
            self.customer_email = self.quote.customer_email
        super().save(*args, **kwargs)

    def get_changes_summary(self):
        """Get a human-readable summary of proposed changes."""
        summary = {
            'modified': 0,
            'added': 0,
            'deleted': 0,
        }
        for line in self.proposed_lines:
            action = line.get('action', 'modify')
            if action in summary:
                summary[action] += 1
        return summary

    def approve(self, reviewed_by, notes=''):
        """Approve the change request, auto-apply changes, increment version."""
        self.status = self.STATUS_APPROVED
        self.reviewed_by = reviewed_by
        self.reviewed_at = timezone.now()
        self.review_notes = notes
        self.save(update_fields=[
            'status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'
        ])

        quote = self.quote

        # Auto-apply proposed changes to quote lines
        for line_data in self.proposed_lines:
            action = line_data.get('action', 'modify')
            line_id = line_data.get('id')

            if action == 'delete' and line_id:
                QuoteLine.objects.filter(id=line_id, quote=quote).delete()

            elif action == 'modify' and line_id:
                try:
                    line = QuoteLine.objects.get(id=line_id, quote=quote)

                    # Only update fields the client actually changed.
                    # The client NEVER sets unit_price at the proposed-line
                    # level, so we never overwrite the seller's price.
                    if line_data.get('concept'):
                        line.concept = line_data['concept']
                    if line_data.get('description') is not None:
                        line.description = line_data.get('description', '')
                    # Don't blindly overwrite quantity — the seller controls
                    # quantities for expanded route lines.
                    if line_data.get('unit'):
                        line.unit = line_data['unit']

                    # Apply service_details if provided (routes, dimensions, etc.)
                    if 'service_details' in line_data and line_data['service_details']:
                        new_sd = line_data['service_details']
                        old_sd = line.service_details or {}

                        if isinstance(new_sd, dict) and isinstance(old_sd, dict):
                            # Preserve ALL seller-set route prices & quantities.
                            new_rutas = new_sd.get('rutas') if isinstance(new_sd.get('rutas'), list) else None
                            old_rutas = old_sd.get('rutas') if isinstance(old_sd.get('rutas'), list) else None
                            if new_rutas and old_rutas:
                                for idx, new_r in enumerate(new_rutas):
                                    if not isinstance(new_r, dict):
                                        continue
                                    if idx < len(old_rutas) and isinstance(old_rutas[idx], dict):
                                        old_r = old_rutas[idx]
                                        # Always keep seller's price (client sends 0)
                                        old_price = old_r.get('precio_unitario', 0)
                                        if old_price and old_price > 0:
                                            new_r['precio_unitario'] = old_price
                                        # Keep seller's cantidad
                                        old_qty = old_r.get('cantidad', 0)
                                        if old_qty and old_qty > 0:
                                            new_r['cantidad'] = old_qty

                            # Preserve internal route arrays if they exist
                            # in old_sd but not in new_sd (cleanServiceDetailsForApi
                            # strips _vallasRoutes etc.)
                            for rkey in ('_vallasRoutes', '_pubRoutes', '_perifoneoRoutes'):
                                if rkey in old_sd and rkey not in new_sd:
                                    new_sd[rkey] = old_sd[rkey]

                            # Determine if this is a publicidad-movil service
                            svc_type = new_sd.get('service_type') or old_sd.get('service_type') or ''
                            subtipo = new_sd.get('subtipo') or old_sd.get('subtipo') or ''
                            is_pub_movil = (svc_type == 'publicidad-movil' and subtipo != 'otro')

                            # Extract delivery fields from service_details
                            # but NOT for publicidad-movil (they use routes,
                            # not delivery addresses — except subtipo 'otro')
                            if not is_pub_movil:
                                sd_delivery = new_sd.get('delivery_method')
                                if sd_delivery:
                                    line.delivery_method = sd_delivery
                                sd_address = new_sd.get('delivery_address')
                                if sd_address:
                                    line.delivery_address = sd_address
                                sd_date = new_sd.get('required_date')
                                if sd_date:
                                    line.estimated_delivery_date = sd_date
                                sd_branch = new_sd.get('pickup_branch')
                                if sd_branch:
                                    from apps.content.models import Branch
                                    try:
                                        line.pickup_branch = Branch.objects.get(id=sd_branch)
                                    except (Branch.DoesNotExist, ValueError):
                                        pass

                            # Remove transient delivery keys from service_details
                            # so they don't clutter the stored JSON
                            for dkey in ('delivery_method', 'delivery_address',
                                         'pickup_branch', 'required_date'):
                                new_sd.pop(dkey, None)

                        line.service_details = new_sd
                    line.save()  # save() recalculates line_total
                except QuoteLine.DoesNotExist:
                    pass

            elif action == 'add':
                max_pos = quote.lines.aggregate(
                    models.Max('position')
                )['position__max'] or 0
                up = Decimal(str(line_data.get('unit_price', 0))) if line_data.get('unit_price') else Decimal('0.00')
                qty = Decimal(str(line_data.get('quantity', 1)))
                sd = line_data.get('service_details')
                create_kwargs = dict(
                    quote=quote,
                    concept=line_data.get('concept', 'Nuevo concepto'),
                    description=line_data.get('description', ''),
                    quantity=qty,
                    unit=line_data.get('unit', 'pz'),
                    unit_price=up,
                    line_total=qty * up,
                    position=max_pos + 1,
                    service_details=sd,
                )
                # Extract delivery fields — but not for publicidad-movil
                if isinstance(sd, dict):
                    svc_type = sd.get('service_type', '')
                    subtipo = sd.get('subtipo', '')
                    is_pub_movil = (svc_type == 'publicidad-movil' and subtipo != 'otro')
                    if not is_pub_movil:
                        if sd.get('delivery_method'):
                            create_kwargs['delivery_method'] = sd['delivery_method']
                        if sd.get('delivery_address'):
                            create_kwargs['delivery_address'] = sd['delivery_address']
                        if sd.get('required_date'):
                            create_kwargs['estimated_delivery_date'] = sd['required_date']
                        if sd.get('pickup_branch'):
                            from apps.content.models import Branch
                            try:
                                create_kwargs['pickup_branch'] = Branch.objects.get(id=sd['pickup_branch'])
                            except (Branch.DoesNotExist, ValueError):
                                pass
                QuoteLine.objects.create(**create_kwargs)

        # Link change request attachments to the quote
        self.attachments.filter(quote__isnull=True).update(quote=quote)

        # Recalculate totals
        quote.calculate_totals()

        # Increment version and reset to draft
        quote.version += 1
        quote.status = Quote.STATUS_DRAFT

        update_fields = ['status', 'version', 'subtotal', 'tax_amount', 'total', 'updated_at']

        # Clear outdated PDF
        if quote.pdf_file:
            try:
                quote.pdf_file.delete(save=False)
            except Exception:
                pass
            quote.pdf_file = ''
            update_fields.append('pdf_file')

        quote.save(update_fields=update_fields)

    def reject(self, reviewed_by, notes=''):
        """Reject the change request."""
        self.status = self.STATUS_REJECTED
        self.reviewed_by = reviewed_by
        self.reviewed_at = timezone.now()
        self.review_notes = notes
        self.save(update_fields=[
            'status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'
        ])

        # Quote goes back to sent/viewed status
        if self.quote.status == Quote.STATUS_CHANGES_REQUESTED:
            self.quote.status = Quote.STATUS_VIEWED
            self.quote.save(update_fields=['status', 'updated_at'])
