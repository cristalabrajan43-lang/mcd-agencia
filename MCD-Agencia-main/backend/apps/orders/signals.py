"""
Order Signals for MCD-Agencia.

Signal handlers for order-related events.
"""

from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import Order, OrderStatusHistory
from .services.tracking import record_status_tracking_event


@receiver(pre_save, sender=Order)
def track_status_change(sender, instance, **kwargs):
    """
    Track order status changes before saving.

    Stores the previous status for creating history records.
    """
    if instance.pk:
        try:
            old_instance = Order.objects.get(pk=instance.pk)
            instance._previous_status = old_instance.status
        except Order.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=Order)
def create_status_history(sender, instance, created, **kwargs):
    """
    Create status history record when status changes.

    Args:
        sender: Order model
        instance: Order instance
        created: Whether this is a new order
        **kwargs: Additional arguments
    """
    previous_status = getattr(instance, '_previous_status', None)

    # Create history for new orders or status changes
    if created:
        OrderStatusHistory.objects.create(
            order=instance,
            from_status='',
            to_status=instance.status,
            notes='Order created'
        )
    elif previous_status and previous_status != instance.status:
        OrderStatusHistory.objects.create(
            order=instance,
            from_status=previous_status,
            to_status=instance.status
        )


@receiver(post_save, sender=Order)
def update_order_timestamps(sender, instance, **kwargs):
    """
    Update order timestamps based on status changes.

    Sets paid_at when order becomes paid,
    completed_at when order is completed.
    """
    update_fields = []

    if instance.status in [Order.STATUS_PAID, Order.STATUS_PARTIALLY_PAID]:
        if not instance.paid_at:
            instance.paid_at = timezone.now()
            update_fields.append('paid_at')

    if instance.status == Order.STATUS_COMPLETED:
        if not instance.completed_at:
            instance.completed_at = timezone.now()
            update_fields.append('completed_at')

    if update_fields:
        Order.objects.filter(pk=instance.pk).update(**{
            field: getattr(instance, field) for field in update_fields
        })


@receiver(post_save, sender=OrderStatusHistory)
def sync_status_history_to_tracking(sender, instance, created, **kwargs):
    """Mirror order status history into customer-visible tracking events."""
    if created:
        record_status_tracking_event(instance)
