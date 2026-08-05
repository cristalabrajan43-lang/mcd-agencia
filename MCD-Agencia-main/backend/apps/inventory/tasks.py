"""
Celery Tasks for Inventory App.

This module contains asynchronous tasks for inventory management:
    - Low stock alerts
    - Stock level notifications
    - Inventory reports
"""

import logging
from decimal import Decimal

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Sum, F
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


@shared_task
def check_low_stock_alerts():
    """
    Check for products with low stock levels and send alerts.

    This task runs daily at 8:00 AM (configured in celery.py).
    Creates StockAlert records and notifies inventory managers.

    Returns:
        dict: Summary of low stock items found.
    """
    from apps.inventory.models import StockLevel, StockAlert
    from apps.catalog.models import ProductVariant
    from apps.users.models import User

    # Find variants with stock below reorder point
    low_stock_items = StockLevel.objects.filter(
        quantity__lte=F('reorder_point'),
        variant__is_active=True,
    ).select_related('variant', 'variant__product')

    alerts_created = 0
    critical_items = []
    warning_items = []

    for stock in low_stock_items:
        # Determine alert type
        if stock.quantity == 0:
            alert_type = 'out_of_stock'
            critical_items.append(stock)
        elif stock.quantity <= stock.reorder_point / 2:
            alert_type = 'critical'
            critical_items.append(stock)
        else:
            alert_type = 'low_stock'
            warning_items.append(stock)

        # Check if alert already exists for this variant
        existing_alert = StockAlert.objects.filter(
            variant=stock.variant,
            is_resolved=False,
        ).first()

        if existing_alert:
            # Update existing alert
            existing_alert.alert_type = alert_type
            existing_alert.current_quantity = stock.quantity
            existing_alert.save(update_fields=['alert_type', 'current_quantity', 'updated_at'])
        else:
            # Create new alert
            StockAlert.objects.create(
                variant=stock.variant,
                alert_type=alert_type,
                current_quantity=stock.quantity,
                reorder_point=stock.reorder_point,
            )
            alerts_created += 1

    # Send notification if there are critical or warning items
    if critical_items or warning_items:
        # Get inventory managers
        manager_emails = list(
            User.objects.filter(
                role__name__in=['admin'],
                is_active=True,
            ).values_list('email', flat=True)
        )

        if manager_emails:
            context = {
                'critical_items': critical_items,
                'warning_items': warning_items,
                'total_alerts': len(critical_items) + len(warning_items),
                'inventory_url': f"{settings.FRONTEND_URL}/admin/inventory",
                'company_name': 'MCD Agencia',
                'generated_at': timezone.now(),
            }

            html_message = render_to_string('emails/low_stock_alert.html', context)
            plain_message = strip_tags(html_message)

            send_mail(
                subject=f'Alerta de inventario bajo - {len(critical_items)} críticos, {len(warning_items)} advertencias',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=manager_emails,
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(f"Low stock alert sent to {len(manager_emails)} managers")

    summary = {
        'checked_at': timezone.now().isoformat(),
        'total_low_stock': len(low_stock_items),
        'critical_count': len(critical_items),
        'warning_count': len(warning_items),
        'alerts_created': alerts_created,
    }

    logger.info(f"Low stock check completed: {summary}")
    return summary


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_stock_alert_notification(self, alert_id: str):
    """
    Send immediate notification for critical stock alert.

    Args:
        alert_id: UUID of the stock alert.

    Returns:
        bool: True if notification was sent successfully.
    """
    from apps.inventory.models import StockAlert
    from apps.users.models import User

    try:
        alert = StockAlert.objects.select_related(
            'variant', 'variant__product'
        ).get(id=alert_id)

        # Only send immediate notifications for critical alerts
        if alert.alert_type not in ['critical', 'out_of_stock']:
            logger.info(f"Alert {alert_id} is not critical, skipping immediate notification")
            return False

        manager_emails = list(
            User.objects.filter(
                role__name__in=['admin'],
                is_active=True,
            ).values_list('email', flat=True)
        )

        if not manager_emails:
            logger.warning("No managers found to notify about stock alert")
            return False

        alert_type_display = {
            'low_stock': 'Stock Bajo',
            'critical': 'Stock Crítico',
            'out_of_stock': 'Sin Stock',
        }

        context = {
            'alert': alert,
            'variant': alert.variant,
            'product': alert.variant.product,
            'alert_type_display': alert_type_display.get(alert.alert_type, alert.alert_type),
            'inventory_url': f"{settings.FRONTEND_URL}/admin/inventory/variants/{alert.variant.id}",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/stock_alert_critical.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'¡URGENTE! {alert_type_display.get(alert.alert_type)} - {alert.variant.product.name}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=manager_emails,
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Critical stock alert notification sent for {alert.variant.sku}")
        return True

    except StockAlert.DoesNotExist:
        logger.error(f"Stock alert {alert_id} not found")
        return False


@shared_task
def generate_inventory_value_report():
    """
    Generate weekly inventory valuation report.

    Returns:
        dict: Report summary with inventory value.
    """
    from apps.inventory.models import StockLevel
    from apps.users.models import User

    # Calculate total inventory value
    stock_data = StockLevel.objects.select_related(
        'variant', 'variant__product'
    ).filter(
        variant__is_active=True,
    )

    total_units = 0
    total_value = Decimal('0.00')
    categories_summary = {}

    for stock in stock_data:
        quantity = stock.quantity
        unit_value = Decimal(str(stock.variant.price))
        line_value = quantity * unit_value

        total_units += quantity
        total_value += line_value

        # Group by category
        category = stock.variant.product.category
        if category:
            cat_name = category.name
            if cat_name not in categories_summary:
                categories_summary[cat_name] = {
                    'units': 0,
                    'value': Decimal('0.00'),
                }
            categories_summary[cat_name]['units'] += quantity
            categories_summary[cat_name]['value'] += line_value

    # Convert Decimal to string for JSON serialization
    report = {
        'generated_at': timezone.now().isoformat(),
        'total_units': total_units,
        'total_value': str(total_value),
        'categories': {
            k: {'units': v['units'], 'value': str(v['value'])}
            for k, v in categories_summary.items()
        },
    }

    # Send report to managers
    manager_emails = list(
        User.objects.filter(
            role__name__in=['admin'],
            is_active=True,
        ).values_list('email', flat=True)
    )

    if manager_emails:
        context = {
            'report': report,
            'total_value': total_value,
            'total_units': total_units,
            'categories': categories_summary,
            'inventory_url': f"{settings.FRONTEND_URL}/admin/inventory/reports",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/inventory_value_report.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Reporte de valuación de inventario - ${total_value:,.2f}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=manager_emails,
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Inventory value report sent to {len(manager_emails)} managers")

    logger.info(f"Inventory value report: {total_units} units, ${total_value}")
    return report


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def process_stock_movement(self, movement_id: str):
    """
    Process a stock movement and update stock levels.

    This task ensures stock levels are updated atomically
    after a movement is created.

    Args:
        movement_id: UUID of the inventory movement.

    Returns:
        bool: True if movement was processed successfully.
    """
    from apps.inventory.models import InventoryMovement, StockLevel
    from django.db import transaction

    try:
        with transaction.atomic():
            movement = InventoryMovement.objects.select_related('variant').get(id=movement_id)

            # Get or create stock level
            stock_level, created = StockLevel.objects.get_or_create(
                variant=movement.variant,
                defaults={
                    'quantity': 0,
                    'reorder_point': 10,
                    'reorder_quantity': 50,
                }
            )

            # Apply movement based on type
            if movement.movement_type == 'in':
                stock_level.quantity += movement.quantity
            elif movement.movement_type == 'out':
                stock_level.quantity -= movement.quantity
            elif movement.movement_type == 'adjustment':
                stock_level.quantity = movement.quantity

            stock_level.save(update_fields=['quantity', 'updated_at'])

            # Check if we need to create a low stock alert
            if stock_level.quantity <= stock_level.reorder_point:
                check_and_create_stock_alert.delay(str(stock_level.id))

            logger.info(
                f"Stock movement {movement_id} processed: "
                f"{movement.variant.sku} {movement.movement_type} {movement.quantity}"
            )
            return True

    except InventoryMovement.DoesNotExist:
        logger.error(f"Inventory movement {movement_id} not found")
        return False


@shared_task
def check_and_create_stock_alert(stock_level_id: str):
    """
    Check stock level and create alert if needed.

    Args:
        stock_level_id: UUID of the stock level.

    Returns:
        str or None: Alert ID if created, None otherwise.
    """
    from apps.inventory.models import StockLevel, StockAlert

    try:
        stock = StockLevel.objects.select_related('variant').get(id=stock_level_id)

        # Don't create alert if stock is above reorder point
        if stock.quantity > stock.reorder_point:
            # Resolve any existing alerts
            StockAlert.objects.filter(
                variant=stock.variant,
                is_resolved=False,
            ).update(is_resolved=True, resolved_at=timezone.now())
            return None

        # Determine alert type
        if stock.quantity == 0:
            alert_type = 'out_of_stock'
        elif stock.quantity <= stock.reorder_point / 2:
            alert_type = 'critical'
        else:
            alert_type = 'low_stock'

        # Check for existing unresolved alert
        existing = StockAlert.objects.filter(
            variant=stock.variant,
            is_resolved=False,
        ).first()

        if existing:
            existing.alert_type = alert_type
            existing.current_quantity = stock.quantity
            existing.save(update_fields=['alert_type', 'current_quantity', 'updated_at'])
            alert_id = str(existing.id)
        else:
            alert = StockAlert.objects.create(
                variant=stock.variant,
                alert_type=alert_type,
                current_quantity=stock.quantity,
                reorder_point=stock.reorder_point,
            )
            alert_id = str(alert.id)

            # Send immediate notification for critical alerts
            if alert_type in ['critical', 'out_of_stock']:
                send_stock_alert_notification.delay(alert_id)

        return alert_id

    except StockLevel.DoesNotExist:
        logger.error(f"Stock level {stock_level_id} not found")
        return None


@shared_task
def sync_stock_with_orders():
    """
    Synchronize stock levels with pending orders.

    This task ensures stock reservations match actual orders.
    Runs as a maintenance task to catch any discrepancies.

    Returns:
        dict: Sync summary.
    """
    from apps.inventory.models import StockLevel
    from apps.orders.models import OrderLine, Order

    # Get all pending orders' line items
    pending_lines = OrderLine.objects.filter(
        order__status__in=['pending', 'confirmed', 'processing'],
    ).values('variant_id').annotate(reserved=Sum('quantity'))

    reserved_by_variant = {
        str(item['variant_id']): item['reserved']
        for item in pending_lines
    }

    adjustments_made = 0

    for stock in StockLevel.objects.all():
        variant_id = str(stock.variant_id)
        expected_reserved = reserved_by_variant.get(variant_id, 0)

        if stock.reserved != expected_reserved:
            old_reserved = stock.reserved
            stock.reserved = expected_reserved
            stock.save(update_fields=['reserved', 'updated_at'])
            adjustments_made += 1
            logger.info(
                f"Stock reservation adjusted for {stock.variant.sku}: "
                f"{old_reserved} -> {expected_reserved}"
            )

    summary = {
        'synced_at': timezone.now().isoformat(),
        'adjustments_made': adjustments_made,
    }

    logger.info(f"Stock sync completed: {adjustments_made} adjustments")
    return summary
