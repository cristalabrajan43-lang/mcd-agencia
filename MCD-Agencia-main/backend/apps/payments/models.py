"""
Payment Models for MCD-Agencia.

This module defines payment tracking and gateway integration:
    - Payment: Individual payment transactions
    - PaymentWebhookLog: Webhook event logging
    - Refund: Refund transactions

Payment Providers:
    - Mercado Pago
    - PayPal

Payment Statuses:
    - pending: Awaiting payment
    - approved: Payment successful
    - rejected: Payment failed/declined
    - cancelled: Payment cancelled
    - refunded: Payment refunded
"""

import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class Payment(TimeStampedModel):
    """
    Individual payment transaction.

    Tracks all payment attempts and their outcomes.

    Attributes:
        order: Related order
        quote: Related quote (if quote payment)
        user: User who made payment
        provider: Payment provider (mercadopago, paypal)
        status: Payment status
        amount: Payment amount
        currency: Currency code
        provider_payment_id: External payment ID
        provider_order_id: External order/preference ID
        payment_method_type: Type of payment method used
        metadata: Additional payment data
    """

    PROVIDER_MERCADOPAGO = 'mercadopago'
    PROVIDER_PAYPAL = 'paypal'

    PROVIDER_CHOICES = [
        (PROVIDER_MERCADOPAGO, _('Mercado Pago')),
        (PROVIDER_PAYPAL, _('PayPal')),
    ]

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CANCELLED = 'cancelled'
    STATUS_REFUNDED = 'refunded'
    STATUS_IN_PROCESS = 'in_process'

    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending')),
        (STATUS_APPROVED, _('Approved')),
        (STATUS_REJECTED, _('Rejected')),
        (STATUS_CANCELLED, _('Cancelled')),
        (STATUS_REFUNDED, _('Refunded')),
        (STATUS_IN_PROCESS, _('In Process')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='payments',
        null=True,
        blank=True,
        help_text=_('Related order.')
    )
    quote = models.ForeignKey(
        'quotes.Quote',
        on_delete=models.CASCADE,
        related_name='payments',
        null=True,
        blank=True,
        help_text=_('Related quote.')
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='payments',
        help_text=_('User who made payment.')
    )

    # Provider information
    provider = models.CharField(
        _('provider'),
        max_length=20,
        choices=PROVIDER_CHOICES,
        help_text=_('Payment provider.')
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
        help_text=_('Payment status.')
    )

    # Financial details
    amount = models.DecimalField(
        _('amount'),
        max_digits=12,
        decimal_places=2,
        help_text=_('Payment amount.')
    )
    currency = models.CharField(
        _('currency'),
        max_length=3,
        default='MXN',
        help_text=_('Currency code.')
    )
    fee_amount = models.DecimalField(
        _('fee amount'),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Provider fee amount.')
    )
    net_amount = models.DecimalField(
        _('net amount'),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Net amount after fees.')
    )

    # Provider references
    provider_payment_id = models.CharField(
        _('provider payment ID'),
        max_length=100,
        blank=True,
        db_index=True,
        help_text=_('External payment ID from provider.')
    )
    provider_order_id = models.CharField(
        _('provider order ID'),
        max_length=100,
        blank=True,
        db_index=True,
        help_text=_('External order/preference ID.')
    )
    payment_method_type = models.CharField(
        _('payment method type'),
        max_length=50,
        blank=True,
        help_text=_('Type of payment method (credit_card, debit_card, etc.).')
    )
    payment_method_id = models.CharField(
        _('payment method ID'),
        max_length=50,
        blank=True,
        help_text=_('Specific payment method (visa, mastercard, etc.).')
    )

    # Additional data
    metadata = models.JSONField(
        _('metadata'),
        default=dict,
        blank=True,
        help_text=_('Additional payment data from provider.')
    )
    error_message = models.TextField(
        _('error message'),
        blank=True,
        help_text=_('Error message if payment failed.')
    )

    # Tracking
    ip_address = models.GenericIPAddressField(
        _('IP address'),
        null=True,
        blank=True,
        help_text=_('Customer IP address.')
    )
    approved_at = models.DateTimeField(
        _('approved at'),
        null=True,
        blank=True,
        help_text=_('When payment was approved.')
    )

    class Meta:
        verbose_name = _('payment')
        verbose_name_plural = _('payments')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['provider_payment_id']),
            models.Index(fields=['order', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"Payment {self.id} - {self.amount} {self.currency}"

    @property
    def is_successful(self):
        """Check if payment was successful."""
        return self.status == self.STATUS_APPROVED

    def mark_as_approved(self):
        """Mark payment as approved."""
        from django.utils import timezone
        self.status = self.STATUS_APPROVED
        self.approved_at = timezone.now()
        self.save(update_fields=['status', 'approved_at', 'updated_at'])


class PaymentWebhookLog(TimeStampedModel):
    """
    Log all webhook events from payment providers.

    Used for debugging and ensuring idempotent processing.

    Attributes:
        provider: Payment provider
        event_type: Type of webhook event
        event_id: Unique event ID from provider
        payload: Raw webhook payload
        processed: Whether event was processed
        processing_error: Error during processing
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    provider = models.CharField(
        _('provider'),
        max_length=20,
        choices=Payment.PROVIDER_CHOICES,
        help_text=_('Payment provider.')
    )
    event_type = models.CharField(
        _('event type'),
        max_length=100,
        help_text=_('Type of webhook event.')
    )
    event_id = models.CharField(
        _('event ID'),
        max_length=100,
        db_index=True,
        help_text=_('Unique event ID from provider.')
    )
    payment = models.ForeignKey(
        Payment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='webhook_logs',
        help_text=_('Related payment.')
    )
    payload = models.JSONField(
        _('payload'),
        help_text=_('Raw webhook payload.')
    )
    headers = models.JSONField(
        _('headers'),
        default=dict,
        blank=True,
        help_text=_('Request headers.')
    )
    processed = models.BooleanField(
        _('processed'),
        default=False,
        help_text=_('Whether event was processed.')
    )
    processing_error = models.TextField(
        _('processing error'),
        blank=True,
        help_text=_('Error during processing.')
    )
    ip_address = models.GenericIPAddressField(
        _('IP address'),
        null=True,
        blank=True,
        help_text=_('Webhook source IP.')
    )

    class Meta:
        verbose_name = _('payment webhook log')
        verbose_name_plural = _('payment webhook logs')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event_id']),
            models.Index(fields=['provider', 'event_type']),
            models.Index(fields=['processed', 'created_at']),
        ]

    def __str__(self):
        return f"Webhook {self.event_type} ({self.event_id})"


class Refund(TimeStampedModel):
    """
    Refund transaction for processed payments.

    Attributes:
        payment: Original payment being refunded
        amount: Refund amount
        reason: Reason for refund
        status: Refund status
        provider_refund_id: External refund ID
        processed_by: User who processed refund
    """

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'

    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending')),
        (STATUS_APPROVED, _('Approved')),
        (STATUS_REJECTED, _('Rejected')),
    ]

    REASON_CHOICES = [
        ('customer_request', _('Customer Request')),
        ('duplicate', _('Duplicate Payment')),
        ('fraud', _('Fraudulent Transaction')),
        ('order_cancelled', _('Order Cancelled')),
        ('product_issue', _('Product/Service Issue')),
        ('other', _('Other')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='refunds',
        help_text=_('Original payment.')
    )
    amount = models.DecimalField(
        _('amount'),
        max_digits=12,
        decimal_places=2,
        help_text=_('Refund amount.')
    )
    reason = models.CharField(
        _('reason'),
        max_length=30,
        choices=REASON_CHOICES,
        help_text=_('Reason for refund.')
    )
    reason_details = models.TextField(
        _('reason details'),
        blank=True,
        help_text=_('Additional details about refund reason.')
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        help_text=_('Refund status.')
    )
    provider_refund_id = models.CharField(
        _('provider refund ID'),
        max_length=100,
        blank=True,
        help_text=_('External refund ID from provider.')
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='processed_refunds',
        help_text=_('User who processed refund.')
    )
    processed_at = models.DateTimeField(
        _('processed at'),
        null=True,
        blank=True,
        help_text=_('When refund was processed.')
    )
    metadata = models.JSONField(
        _('metadata'),
        default=dict,
        blank=True,
        help_text=_('Additional refund data.')
    )

    class Meta:
        verbose_name = _('refund')
        verbose_name_plural = _('refunds')
        ordering = ['-created_at']

    def __str__(self):
        return f"Refund {self.amount} for Payment {self.payment_id}"

    @property
    def is_partial(self):
        """Check if this is a partial refund."""
        return self.amount < self.payment.amount
