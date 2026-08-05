"""
Inventory Models for MCD-Agencia.

This module defines the inventory management system:
    - InventoryMovement: Track all stock changes
    - StockAlert: Low stock notifications

Movement Types:
    - IN: Stock received (purchase, return, production)
    - OUT: Stock removed (sale, internal use, damaged)
    - ADJUSTMENT: Stock correction (inventory count)
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class InventoryMovement(TimeStampedModel):
    """
    Track inventory movements for all stock changes.

    Every stock change creates a movement record for complete
    audit trail and history tracking.

    Movement Types:
        - IN: Stock increase (purchase, return, production)
        - OUT: Stock decrease (sale, internal use, damaged, expired)
        - ADJUSTMENT: Correction (inventory count, error fix)

    Attributes:
        variant: Product variant affected
        movement_type: IN, OUT, or ADJUSTMENT
        quantity: Quantity changed (positive for IN, negative for OUT)
        reason: Reason for movement
        reference_type: Type of reference (order, manual, etc.)
        reference_id: ID of reference document
        notes: Additional notes
        created_by: User who created movement
        stock_before: Stock level before movement
        stock_after: Stock level after movement
    """

    MOVEMENT_IN = 'IN'
    MOVEMENT_OUT = 'OUT'
    MOVEMENT_ADJUSTMENT = 'ADJUSTMENT'

    MOVEMENT_TYPE_CHOICES = [
        (MOVEMENT_IN, _('Stock In')),
        (MOVEMENT_OUT, _('Stock Out')),
        (MOVEMENT_ADJUSTMENT, _('Adjustment')),
    ]

    REASON_CHOICES = [
        # IN reasons
        ('purchase', _('Purchase from Supplier')),
        ('return', _('Customer Return')),
        ('production', _('Internal Production')),
        ('transfer_in', _('Transfer In')),

        # OUT reasons
        ('sale', _('Sale')),
        ('internal_use', _('Internal Use')),
        ('damaged', _('Damaged/Defective')),
        ('expired', _('Expired')),
        ('lost', _('Lost/Missing')),
        ('transfer_out', _('Transfer Out')),

        # ADJUSTMENT reasons
        ('inventory_count', _('Inventory Count')),
        ('correction', _('Error Correction')),
        ('initial', _('Initial Stock')),
    ]

    REFERENCE_TYPE_CHOICES = [
        ('order', _('Order')),
        ('order_line', _('Order Line')),
        ('quote', _('Quote')),
        ('purchase_order', _('Purchase Order')),
        ('manual', _('Manual Entry')),
        ('system', _('System Generated')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    variant = models.ForeignKey(
        'catalog.ProductVariant',
        on_delete=models.CASCADE,
        related_name='movements',
        help_text=_('Product variant affected.')
    )
    movement_type = models.CharField(
        _('movement type'),
        max_length=20,
        choices=MOVEMENT_TYPE_CHOICES,
        help_text=_('Type of movement.')
    )
    quantity = models.IntegerField(
        _('quantity'),
        help_text=_('Quantity changed (positive for IN, negative for OUT).')
    )
    reason = models.CharField(
        _('reason'),
        max_length=50,
        choices=REASON_CHOICES,
        help_text=_('Reason for movement.')
    )

    # Reference to source document
    reference_type = models.CharField(
        _('reference type'),
        max_length=20,
        choices=REFERENCE_TYPE_CHOICES,
        default='manual',
        help_text=_('Type of reference document.')
    )
    reference_id = models.CharField(
        _('reference ID'),
        max_length=100,
        blank=True,
        help_text=_('ID of reference document.')
    )

    # Additional info
    notes = models.TextField(
        _('notes'),
        blank=True,
        help_text=_('Additional notes.')
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_movements',
        help_text=_('User who created movement.')
    )

    # Stock levels at time of movement
    stock_before = models.IntegerField(
        _('stock before'),
        help_text=_('Stock level before movement.')
    )
    stock_after = models.IntegerField(
        _('stock after'),
        help_text=_('Stock level after movement.')
    )

    class Meta:
        verbose_name = _('inventory movement')
        verbose_name_plural = _('inventory movements')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['variant', 'created_at']),
            models.Index(fields=['movement_type', 'created_at']),
            models.Index(fields=['reference_type', 'reference_id']),
        ]

    def __str__(self):
        return f"{self.get_movement_type_display()}: {self.quantity} x {self.variant.sku}"

    def save(self, *args, **kwargs):
        """Validate and record stock levels."""
        # UUID primary keys are assigned before first save, so pk presence
        # cannot be used to detect inserts.
        is_new = self._state.adding
        current_stock = self.variant.stock if self.variant.stock is not None else 0

        if is_new:
            # Record stock before
            self.stock_before = current_stock

            # Calculate stock after based on movement type
            if self.movement_type == self.MOVEMENT_IN:
                self.stock_after = self.stock_before + abs(self.quantity)
                self.quantity = abs(self.quantity)
            elif self.movement_type == self.MOVEMENT_OUT:
                self.stock_after = self.stock_before - abs(self.quantity)
                self.quantity = -abs(self.quantity)
            else:  # ADJUSTMENT
                self.stock_after = self.stock_before + self.quantity

        super().save(*args, **kwargs)

        # Update variant stock
        if is_new:
            self.variant.stock = self.stock_after
            self.variant.save(update_fields=['stock', 'updated_at'])


class StockAlert(TimeStampedModel):
    """
    Low stock alert notifications.

    Generated when stock falls below threshold.
    Alerts can be acknowledged or resolved.

    Attributes:
        variant: Product variant with low stock
        threshold: Threshold that triggered alert
        current_stock: Stock level when alert created
        status: Alert status
        acknowledged_by: User who acknowledged
        acknowledged_at: When acknowledged
        resolved_at: When resolved
    """

    STATUS_PENDING = 'pending'
    # Backward-compatible alias used in views/services
    STATUS_ACTIVE = STATUS_PENDING
    STATUS_ACKNOWLEDGED = 'acknowledged'
    STATUS_RESOLVED = 'resolved'

    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending')),
        (STATUS_ACKNOWLEDGED, _('Acknowledged')),
        (STATUS_RESOLVED, _('Resolved')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    variant = models.ForeignKey(
        'catalog.ProductVariant',
        on_delete=models.CASCADE,
        related_name='stock_alerts',
        help_text=_('Product variant with low stock.')
    )
    threshold = models.IntegerField(
        _('threshold'),
        help_text=_('Stock threshold that triggered alert.')
    )
    current_stock = models.IntegerField(
        _('current stock'),
        help_text=_('Stock level when alert was created.')
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        help_text=_('Alert status.')
    )

    # Tracking
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledged_alerts',
        help_text=_('User who acknowledged alert.')
    )
    acknowledged_at = models.DateTimeField(
        _('acknowledged at'),
        null=True,
        blank=True,
        help_text=_('When alert was acknowledged.')
    )
    resolved_at = models.DateTimeField(
        _('resolved at'),
        null=True,
        blank=True,
        help_text=_('When alert was resolved.')
    )

    # Notification tracking
    notification_sent = models.BooleanField(
        _('notification sent'),
        default=False,
        help_text=_('Whether notification email was sent.')
    )

    class Meta:
        verbose_name = _('stock alert')
        verbose_name_plural = _('stock alerts')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['variant', 'status']),
        ]

    def __str__(self):
        return f"Low stock alert: {self.variant.sku}"

    def acknowledge(self, user):
        """Mark alert as acknowledged."""
        from django.utils import timezone
        self.status = self.STATUS_ACKNOWLEDGED
        self.acknowledged_by = user
        self.acknowledged_at = timezone.now()
        self.save(update_fields=['status', 'acknowledged_by', 'acknowledged_at', 'updated_at'])

    def resolve(self):
        """Mark alert as resolved."""
        from django.utils import timezone
        self.status = self.STATUS_RESOLVED
        self.resolved_at = timezone.now()
        self.save(update_fields=['status', 'resolved_at', 'updated_at'])
