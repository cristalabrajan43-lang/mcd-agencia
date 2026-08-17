"""
Order Models for MCD-Agencia.

This module defines the e-commerce order system including:
    - Cart: Shopping cart for authenticated users
    - CartItem: Individual items in the cart
    - Order: Main order model with FSM states
    - OrderLine: Line items in an order
    - Address: Shipping and billing addresses

Order States (FSM):
    Draft → PendingPayment → Paid/PartiallyPaid → InProduction → Ready → Completed
    Any pre-production state → Cancelled
    Paid/Completed → Refunded
"""

import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel, SoftDeleteModel


class Cart(TimeStampedModel):
    """
    Shopping cart for authenticated users.

    Carts are associated with authenticated users and persist
    across sessions. Guest carts are handled client-side and
    merged on authentication.

    Attributes:
        user: Cart owner
        session_key: Session key for guest carts (future use)
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cart',
        null=True,
        blank=True,
        help_text=_('Cart owner.')
    )
    session_key = models.CharField(
        _('session key'),
        max_length=40,
        blank=True,
        db_index=True,
        help_text=_('Session key for guest carts.')
    )

    class Meta:
        verbose_name = _('cart')
        verbose_name_plural = _('carts')

    def __str__(self):
        if self.user:
            return f"Cart for {self.user.email}"
        return f"Guest cart {self.session_key[:8]}"

    @property
    def subtotal(self):
        """Calculate cart subtotal (before tax)."""
        return sum(item.line_total for item in self.items.all())

    @property
    def tax_amount(self):
        """Calculate tax amount (IVA 16%)."""
        return self.subtotal * Decimal(settings.TAX_RATE)

    @property
    def total(self):
        """Calculate cart total (subtotal + tax)."""
        return self.subtotal + self.tax_amount

    @property
    def item_count(self):
        """Get total number of items in cart."""
        return self.items.aggregate(total=models.Sum('quantity'))['total'] or 0

    def clear(self):
        """Remove all items from cart."""
        self.items.all().delete()


class CartItem(TimeStampedModel):
    """
    Individual item in a shopping cart.

    Represents a product variant and quantity in the cart.
    Validates stock availability on add/update.

    Attributes:
        cart: Parent cart
        variant: Product variant
        quantity: Item quantity
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='items',
        help_text=_('Parent cart.')
    )
    variant = models.ForeignKey(
        'catalog.ProductVariant',
        on_delete=models.CASCADE,
        related_name='cart_items',
        help_text=_('Product variant.')
    )
    quantity = models.PositiveIntegerField(
        _('quantity'),
        default=1,
        help_text=_('Item quantity.')
    )

    class Meta:
        verbose_name = _('cart item')
        verbose_name_plural = _('cart items')
        unique_together = ['cart', 'variant']

    def __str__(self):
        return f"{self.quantity}x {self.variant.sku}"

    @property
    def unit_price(self):
        """Get unit price from variant."""
        return self.variant.price

    @property
    def line_total(self):
        """Calculate line total (unit_price * quantity)."""
        return self.unit_price * self.quantity


class Address(TimeStampedModel):
    """
    Reusable address model for shipping and billing.

    Addresses can be saved to user profiles for reuse
    across multiple orders.

    Attributes:
        user: Address owner (optional for guest checkout)
        type: shipping or billing
        is_default: Whether this is the default address
        name: Recipient name
        phone: Contact phone
        street: Street address
        exterior_number: Exterior number
        interior_number: Interior number
        neighborhood: Neighborhood (colonia)
        city: City
        state: State
        postal_code: Postal code
        country: Country code
    """

    TYPE_CHOICES = [
        ('shipping', _('Shipping')),
        ('billing', _('Billing')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='addresses',
        null=True,
        blank=True,
        help_text=_('Address owner.')
    )
    type = models.CharField(
        _('type'),
        max_length=10,
        choices=TYPE_CHOICES,
        default='shipping',
        help_text=_('Address type.')
    )
    is_default = models.BooleanField(
        _('is default'),
        default=False,
        help_text=_('Default address for this type.')
    )

    # Recipient
    name = models.CharField(
        _('name'),
        max_length=255,
        help_text=_('Recipient name.')
    )
    phone = models.CharField(
        _('phone'),
        max_length=20,
        help_text=_('Contact phone.')
    )

    # Address
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
        help_text=_('Interior number.')
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
        max_length=10,
        help_text=_('Postal code.')
    )
    country = models.CharField(
        _('country'),
        max_length=3,
        default='MEX',
        help_text=_('Country code (ISO 3166-1 alpha-3).')
    )

    # Reference
    reference = models.TextField(
        _('reference'),
        blank=True,
        help_text=_('Delivery reference (landmarks, instructions).')
    )

    class Meta:
        verbose_name = _('address')
        verbose_name_plural = _('addresses')
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.name} - {self.street} {self.exterior_number}"

    @property
    def full_address(self):
        """Return formatted full address."""
        parts = [
            f"{self.street} {self.exterior_number}",
            self.interior_number and f"Int. {self.interior_number}",
            self.neighborhood,
            f"{self.city}, {self.state}",
            f"C.P. {self.postal_code}",
            self.country,
        ]
        return ", ".join(filter(None, parts))

    def save(self, *args, **kwargs):
        """Ensure only one default address per type per user."""
        if self.is_default and self.user:
            Address.objects.filter(
                user=self.user,
                type=self.type,
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class Order(TimeStampedModel, SoftDeleteModel):
    """
    Main order model for e-commerce transactions.

    Orders follow a finite state machine (FSM) workflow from
    creation through fulfillment. States ensure valid transitions.

    Order States:
        - draft: Order created, in checkout
        - pending_payment: Sent to payment gateway
        - paid: Full payment confirmed
        - partially_paid: Deposit confirmed
        - in_production: Being produced/prepared
        - ready: Ready for delivery/pickup
        - in_delivery: In transit
        - completed: Delivered, order closed
        - cancelled: Cancelled before production
        - refunded: Payment refunded

    Attributes:
        order_number: Human-readable order number
        user: Order owner
        status: Current order status
        shipping_address: Delivery address
        billing_address: Billing address
        subtotal: Order subtotal before tax
        tax_rate: Applied tax rate
        tax_amount: Tax amount
        total: Order total
        amount_paid: Amount already paid
        payment_method: Selected payment method
        notes: Customer notes
        internal_notes: Staff notes
        quote: Source quotation (if converted from quote)
    """

    # Order statuses following FSM pattern
    STATUS_DRAFT = 'draft'
    STATUS_PENDING_PAYMENT = 'pending_payment'
    STATUS_PAID = 'paid'
    STATUS_PARTIALLY_PAID = 'partially_paid'
    STATUS_IN_PRODUCTION = 'in_production'
    STATUS_READY = 'ready'
    STATUS_IN_DELIVERY = 'in_delivery'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_REFUNDED = 'refunded'

    STATUS_CHOICES = [
        (STATUS_DRAFT, _('Draft')),
        (STATUS_PENDING_PAYMENT, _('Pending Payment')),
        (STATUS_PAID, _('Paid')),
        (STATUS_PARTIALLY_PAID, _('Partially Paid')),
        (STATUS_IN_PRODUCTION, _('In Production')),
        (STATUS_READY, _('Ready')),
        (STATUS_IN_DELIVERY, _('In Delivery')),
        (STATUS_COMPLETED, _('Completed')),
        (STATUS_CANCELLED, _('Cancelled')),
        (STATUS_REFUNDED, _('Refunded')),
    ]

    # Valid status transitions
    STATUS_TRANSITIONS = {
        STATUS_DRAFT: [STATUS_PENDING_PAYMENT, STATUS_CANCELLED],
        STATUS_PENDING_PAYMENT: [STATUS_PAID, STATUS_PARTIALLY_PAID, STATUS_IN_PRODUCTION, STATUS_CANCELLED],
        STATUS_PAID: [STATUS_IN_PRODUCTION, STATUS_REFUNDED],
        STATUS_PARTIALLY_PAID: [STATUS_PAID, STATUS_IN_PRODUCTION, STATUS_CANCELLED],
        STATUS_IN_PRODUCTION: [STATUS_READY, STATUS_CANCELLED],
        STATUS_READY: [STATUS_IN_DELIVERY, STATUS_COMPLETED],
        STATUS_IN_DELIVERY: [STATUS_COMPLETED],
        STATUS_COMPLETED: [STATUS_REFUNDED],
        STATUS_CANCELLED: [],
        STATUS_REFUNDED: [],
    }

    PAYMENT_METHOD_CHOICES = [
        ('mercadopago', _('Mercado Pago')),
        ('paypal', _('PayPal')),
        ('bank_transfer', _('Bank Transfer')),
        ('cash', _('Cash')),
    ]

    ORIGIN_QUOTE = 'quote_conversion'
    ORIGIN_DIRECT_PURCHASE = 'direct_purchase'
    ORIGIN_MANUAL = 'manual'
    ORIGIN_CHOICES = [
        (ORIGIN_QUOTE, _('Quote Conversion')),
        (ORIGIN_DIRECT_PURCHASE, _('Direct Purchase')),
        (ORIGIN_MANUAL, _('Manual')),
    ]

    OP_ROLLUP_PLANNED = 'planned'
    OP_ROLLUP_IN_EXECUTION = 'in_execution'
    OP_ROLLUP_AWAITING_FINALIZATION = 'awaiting_finalization'
    OP_ROLLUP_COMPLETED = 'completed'
    OP_ROLLUP_ON_HOLD = 'on_hold'
    OPERATIONAL_ROLLUP_CHOICES = [
        (OP_ROLLUP_PLANNED, _('Planned')),
        (OP_ROLLUP_IN_EXECUTION, _('In Execution')),
        (OP_ROLLUP_AWAITING_FINALIZATION, _('Awaiting Finalization')),
        (OP_ROLLUP_COMPLETED, _('Completed')),
        (OP_ROLLUP_ON_HOLD, _('On Hold')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    order_number = models.CharField(
        _('order number'),
        max_length=20,
        unique=True,
        db_index=True,
        help_text=_('Human-readable order number.')
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='orders',
        help_text=_('Order owner.')
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
        help_text=_('Current order status.')
    )

    # Addresses (copied at order time for immutability)
    shipping_address = models.JSONField(
        _('shipping address'),
        default=dict,
        help_text=_('Shipping address snapshot.')
    )
    billing_address = models.JSONField(
        _('billing address'),
        default=dict,
        help_text=_('Billing address snapshot.')
    )

    # Financials
    subtotal = models.DecimalField(
        _('subtotal'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text=_('Order subtotal before tax.')
    )
    tax_rate = models.DecimalField(
        _('tax rate'),
        max_digits=5,
        decimal_places=4,
        default=Decimal('0.1600'),
        help_text=_('Applied tax rate (e.g., 0.16 for 16%).')
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
        help_text=_('Order total.')
    )
    amount_paid = models.DecimalField(
        _('amount paid'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text=_('Amount already paid.')
    )
    currency = models.CharField(
        _('currency'),
        max_length=3,
        default='MXN',
        help_text=_('Currency code.')
    )

    # Payment
    payment_method = models.CharField(
        _('payment method'),
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        blank=True,
        help_text=_('Selected payment method.')
    )

    # Notes
    notes = models.TextField(
        _('customer notes'),
        blank=True,
        help_text=_('Notes from customer.')
    )
    internal_notes = models.TextField(
        _('internal notes'),
        blank=True,
        help_text=_('Notes for staff (not visible to customer).')
    )

    # Source
    quote = models.ForeignKey(
        'quotes.Quote',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        help_text=_('Source quotation (if converted from quote).')
    )
    origin = models.CharField(
        _('origin'),
        max_length=30,
        choices=ORIGIN_CHOICES,
        default=ORIGIN_DIRECT_PURCHASE,
        db_index=True,
        help_text=_('How this order was created (quote conversion or direct purchase).')
    )

    # Operational orchestration
    operational_rollup = models.CharField(
        _('operational rollup'),
        max_length=30,
        choices=OPERATIONAL_ROLLUP_CHOICES,
        default=OP_ROLLUP_PLANNED,
        db_index=True,
        help_text=_('Aggregated operational progress across production, logistics and field operations.')
    )
    operation_plan = models.JSONField(
        _('operation plan'),
        default=dict,
        blank=True,
        help_text=_('Computed operation plan and dependency map for this order.')
    )
    service_snapshot = models.JSONField(
        _('service snapshot'),
        default=list,
        blank=True,
        help_text=_('Frozen service-level data used for operational routing.')
    )

    # Tracking
    tracking_number = models.CharField(
        _('tracking number'),
        max_length=100,
        blank=True,
        help_text=_('Shipment tracking number.')
    )
    tracking_url = models.URLField(
        _('tracking URL'),
        blank=True,
        help_text=_('Shipment tracking URL.')
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
        help_text=_('Delivery method for this order.')
    )
    pickup_branch = models.ForeignKey(
        'content.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name=_('pickup branch'),
        help_text=_('Branch for pickup.')
    )
    delivery_address = models.JSONField(
        _('delivery address'),
        default=dict,
        blank=True,
        help_text=_('Delivery or installation address.')
    )
    scheduled_date = models.DateTimeField(
        _('scheduled date'),
        null=True,
        blank=True,
        help_text=_('Scheduled date/time for installation or delivery.')
    )

    # Dates
    paid_at = models.DateTimeField(
        _('paid at'),
        null=True,
        blank=True,
        help_text=_('When payment was confirmed.')
    )
    completed_at = models.DateTimeField(
        _('completed at'),
        null=True,
        blank=True,
        help_text=_('When order was completed.')
    )

    class Meta:
        verbose_name = _('order')
        verbose_name_plural = _('orders')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"Order {self.order_number}"

    def save(self, *args, **kwargs):
        """Generate order number if not set."""
        if not self.order_number:
            self.order_number = self._generate_order_number()
        super().save(*args, **kwargs)

    def _generate_order_number(self):
        """Generate a unique order number."""
        import datetime
        import random
        date_str = datetime.datetime.now().strftime('%Y%m%d')
        random_str = ''.join(random.choices('0123456789', k=4))
        return f"MCD-{date_str}-{random_str}"

    @property
    def balance_due(self):
        """Calculate remaining balance to be paid."""
        return self.total - self.amount_paid

    @property
    def is_fully_paid(self):
        """Check if order is fully paid."""
        return self.amount_paid >= self.total

    def can_transition_to(self, new_status):
        """
        Check if transition to new status is valid.

        Args:
            new_status: Target status

        Returns:
            bool: Whether transition is allowed
        """
        return new_status in self.STATUS_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status, changed_by=None, notes=''):
        """
        Transition order to new status.

        Args:
            new_status: Target status
            changed_by: User who triggered the transition
            notes: Optional notes about the transition

        Raises:
            ValueError: If transition is not allowed
        """
        if not self.can_transition_to(new_status):
            raise ValueError(
                f"Cannot transition from {self.status} to {new_status}"
            )
        old_status = self.status
        self.status = new_status

        # Set timestamps for key transitions
        if new_status == self.STATUS_PAID:
            from django.utils import timezone
            self.paid_at = timezone.now()
            self.save(update_fields=['status', 'paid_at', 'updated_at'])
        elif new_status == self.STATUS_COMPLETED:
            from django.utils import timezone
            self.completed_at = timezone.now()
            self.save(update_fields=['status', 'completed_at', 'updated_at'])
        else:
            self.save(update_fields=['status', 'updated_at'])

        # Create status history record
        OrderStatusHistory.objects.create(
            order=self,
            from_status=old_status,
            to_status=new_status,
            changed_by=changed_by,
            notes=notes or ''
        )

    def calculate_totals(self):
        """
        Recalculate order totals from line items.

        Updates subtotal, tax_amount, and total fields.
        """
        self.subtotal = sum(line.line_total for line in self.lines.all())
        self.tax_amount = self.subtotal * self.tax_rate
        self.total = self.subtotal + self.tax_amount


class OrderLine(TimeStampedModel):
    """
    Individual line item in an order.

    Line items store a snapshot of product information at order time
    to maintain accuracy even if products change later.

    Attributes:
        order: Parent order
        variant: Product variant (reference)
        sku: SKU at time of order
        name: Product name at time of order
        quantity: Ordered quantity
        unit_price: Price at time of order
        tax_rate: Tax rate at time of order
        line_total: Line total (quantity * unit_price)
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='lines',
        help_text=_('Parent order.')
    )
    variant = models.ForeignKey(
        'catalog.ProductVariant',
        on_delete=models.SET_NULL,
        null=True,
        related_name='order_lines',
        help_text=_('Product variant reference.')
    )

    # Snapshot data (preserved even if product changes)
    sku = models.CharField(
        _('SKU'),
        max_length=100,
        help_text=_('SKU at time of order.')
    )
    name = models.CharField(
        _('name'),
        max_length=255,
        help_text=_('Product name at time of order.')
    )
    variant_name = models.CharField(
        _('variant name'),
        max_length=255,
        blank=True,
        help_text=_('Variant details (e.g., "Blue, Large").')
    )
    quantity = models.PositiveIntegerField(
        _('quantity'),
        default=1,
        help_text=_('Ordered quantity.')
    )
    unit_price = models.DecimalField(
        _('unit price'),
        max_digits=12,
        decimal_places=2,
        help_text=_('Price per unit at time of order.')
    )

    # Line totals
    line_total = models.DecimalField(
        _('line total'),
        max_digits=12,
        decimal_places=2,
        help_text=_('Line total (quantity * unit_price).')
    )

    # Optional metadata
    metadata = models.JSONField(
        _('metadata'),
        default=dict,
        blank=True,
        help_text=_('Additional line item data.')
    )

    class Meta:
        verbose_name = _('order line')
        verbose_name_plural = _('order lines')
        ordering = ['created_at']

    def __str__(self):
        return f"{self.quantity}x {self.name}"

    def save(self, *args, **kwargs):
        """Calculate line total before saving."""
        self.line_total = self.unit_price * self.quantity
        super().save(*args, **kwargs)


class OrderStatusHistory(TimeStampedModel):
    """
    Track order status changes for audit trail.

    Records every status change with timestamp and actor.

    Attributes:
        order: Parent order
        from_status: Previous status
        to_status: New status
        changed_by: User who made the change
        notes: Optional notes about the change
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='status_history',
        help_text=_('Parent order.')
    )
    from_status = models.CharField(
        _('from status'),
        max_length=20,
        choices=Order.STATUS_CHOICES,
        help_text=_('Previous status.')
    )
    to_status = models.CharField(
        _('to status'),
        max_length=20,
        choices=Order.STATUS_CHOICES,
        help_text=_('New status.')
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='order_status_changes',
        help_text=_('User who made the change.')
    )
    notes = models.TextField(
        _('notes'),
        blank=True,
        help_text=_('Notes about the change.')
    )

    class Meta:
        verbose_name = _('order status history')
        verbose_name_plural = _('order status histories')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.order.order_number}: {self.from_status} → {self.to_status}"


class ProductionJob(TimeStampedModel):
    """Production track item for a specific order line or service group."""

    STATUS_QUEUED = 'queued'
    STATUS_PREPARING = 'preparing'
    STATUS_IN_PRODUCTION = 'in_production'
    STATUS_QUALITY_CHECK = 'quality_check'
    STATUS_RELEASED = 'released'
    STATUS_BLOCKED = 'blocked'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (STATUS_QUEUED, _('Queued')),
        (STATUS_PREPARING, _('Preparing')),
        (STATUS_IN_PRODUCTION, _('In Production')),
        (STATUS_QUALITY_CHECK, _('Quality Check')),
        (STATUS_RELEASED, _('Released')),
        (STATUS_BLOCKED, _('Blocked')),
        (STATUS_CANCELLED, _('Cancelled')),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='production_jobs')
    order_line = models.ForeignKey(
        OrderLine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_jobs'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_QUEUED, db_index=True)
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_end = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    requires_quality_check = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = _('production job')
        verbose_name_plural = _('production jobs')
        ordering = ['created_at']


class LogisticsJob(TimeStampedModel):
    """Logistics track item for shipping, pickup or digital handoff."""

    TYPE_SHIPPING = 'shipping'
    TYPE_PICKUP = 'pickup'
    TYPE_DIGITAL = 'digital_delivery'
    TYPE_CHOICES = [
        (TYPE_SHIPPING, _('Shipping')),
        (TYPE_PICKUP, _('Pickup')),
        (TYPE_DIGITAL, _('Digital Delivery')),
    ]

    STATUS_PENDING_DISPATCH = 'pending_dispatch'
    STATUS_SCHEDULED = 'scheduled'
    STATUS_IN_TRANSIT = 'in_transit'
    STATUS_READY_FOR_PICKUP = 'ready_for_pickup'
    STATUS_DELIVERED = 'delivered'
    STATUS_DELIVERY_FAILED = 'delivery_failed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING_DISPATCH, _('Pending Dispatch')),
        (STATUS_SCHEDULED, _('Scheduled')),
        (STATUS_IN_TRANSIT, _('In Transit')),
        (STATUS_READY_FOR_PICKUP, _('Ready For Pickup')),
        (STATUS_DELIVERED, _('Delivered')),
        (STATUS_DELIVERY_FAILED, _('Delivery Failed')),
        (STATUS_CANCELLED, _('Cancelled')),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='logistics_jobs')
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default=STATUS_PENDING_DISPATCH, db_index=True)
    logistics_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_SHIPPING)
    window_start = models.DateTimeField(null=True, blank=True)
    window_end = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    address_snapshot = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = _('logistics job')
        verbose_name_plural = _('logistics jobs')
        ordering = ['created_at']


class FieldOperationJob(TimeStampedModel):
    """Field operation track for installations and date-ranged campaigns."""

    TYPE_INSTALLATION = 'installation'
    TYPE_MOBILE_CAMPAIGN = 'mobile_campaign'
    TYPE_SERVICE_WINDOW = 'service_window'
    TYPE_CHOICES = [
        (TYPE_INSTALLATION, _('Installation')),
        (TYPE_MOBILE_CAMPAIGN, _('Mobile Campaign')),
        (TYPE_SERVICE_WINDOW, _('Service Window')),
    ]

    STATUS_SCHEDULED = 'scheduled'
    STATUS_CREW_ASSIGNED = 'crew_assigned'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_PAUSED = 'paused'
    STATUS_COMPLETED = 'completed'
    STATUS_REQUIRES_REVISIT = 'requires_revisit'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_SCHEDULED, _('Scheduled')),
        (STATUS_CREW_ASSIGNED, _('Crew Assigned')),
        (STATUS_IN_PROGRESS, _('In Progress')),
        (STATUS_PAUSED, _('Paused')),
        (STATUS_COMPLETED, _('Completed')),
        (STATUS_REQUIRES_REVISIT, _('Requires Revisit')),
        (STATUS_CANCELLED, _('Cancelled')),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='field_ops_jobs')
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default=STATUS_SCHEDULED, db_index=True)
    operation_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_INSTALLATION)
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    location_snapshot = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = _('field operation job')
        verbose_name_plural = _('field operation jobs')
        ordering = ['created_at']


class OrderTrackingEvent(TimeStampedModel):
    """
    Customer-visible tracking milestones for an order.

    Records status changes, production/logistics updates, shipping info,
    and manual updates posted by staff.
    """

    EVENT_STATUS = 'status_change'
    EVENT_PRODUCTION = 'production'
    EVENT_LOGISTICS = 'logistics'
    EVENT_FIELD_OPS = 'field_ops'
    EVENT_TRACKING = 'tracking'
    EVENT_CUSTOM = 'custom'

    EVENT_TYPE_CHOICES = [
        (EVENT_STATUS, _('Status change')),
        (EVENT_PRODUCTION, _('Production')),
        (EVENT_LOGISTICS, _('Logistics')),
        (EVENT_FIELD_OPS, _('Field operations')),
        (EVENT_TRACKING, _('Shipping tracking')),
        (EVENT_CUSTOM, _('Custom update')),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='tracking_events',
        help_text=_('Parent order.'),
    )
    event_type = models.CharField(
        _('event type'),
        max_length=20,
        choices=EVENT_TYPE_CHOICES,
        default=EVENT_STATUS,
        db_index=True,
    )
    title = models.CharField(_('title'), max_length=200)
    description = models.TextField(_('description'), blank=True, default='')
    occurred_at = models.DateTimeField(_('occurred at'), db_index=True)
    visible_to_customer = models.BooleanField(_('visible to customer'), default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_tracking_events',
    )
    source_key = models.CharField(
        _('source key'),
        max_length=120,
        blank=True,
        default='',
        help_text=_('Dedup key for automated events.'),
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = _('order tracking event')
        verbose_name_plural = _('order tracking events')
        ordering = ['occurred_at', 'created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['order', 'source_key'],
                condition=~models.Q(source_key=''),
                name='orders_tracking_event_unique_source_key',
            ),
        ]

    def __str__(self):
        return f'{self.order.order_number} · {self.title}'
