"""
Celery Tasks for Orders App.

This module contains asynchronous tasks for order management:
    - Order confirmation emails
    - Order status update notifications
    - Daily/weekly sales reports
    - Abandoned cart reminders
"""

import logging
from datetime import timedelta
from decimal import Decimal

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Sum, Count, F
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_order_confirmation_email(self, order_id: str):
    """
    Send order confirmation email to customer.

    Args:
        order_id: UUID of the order.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.orders.models import Order

    try:
        order = Order.objects.select_related('user').prefetch_related('lines').get(id=order_id)

        context = {
            'order': order,
            'user': order.user,
            'order_url': f"{settings.FRONTEND_URL}/orders/{order.id}",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/order_confirmation.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Confirmación de pedido #{order.order_number} - MCD Agencia',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[order.user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Order confirmation email sent for order {order.order_number}")
        return True

    except Order.DoesNotExist:
        logger.error(f"Order {order_id} not found")
        return False


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_order_status_update_email(self, order_id: str, old_status: str, new_status: str):
    """
    Send email notification when order status changes.

    Args:
        order_id: UUID of the order.
        old_status: Previous status.
        new_status: New status.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.orders.models import Order

    try:
        order = Order.objects.select_related('user').get(id=order_id)

        # Status display names
        status_display = {
            'pending': 'Pendiente',
            'confirmed': 'Confirmado',
            'processing': 'En proceso',
            'ready': 'Listo para envío',
            'shipped': 'Enviado',
            'delivered': 'Entregado',
            'cancelled': 'Cancelado',
        }

        context = {
            'order': order,
            'user': order.user,
            'old_status': status_display.get(old_status, old_status),
            'new_status': status_display.get(new_status, new_status),
            'order_url': f"{settings.FRONTEND_URL}/orders/{order.id}",
            'company_name': 'MCD Agencia',
        }

        # Special handling for shipped orders with tracking
        if new_status == 'shipped' and order.tracking_number:
            context['tracking_number'] = order.tracking_number
            context['tracking_url'] = order.tracking_url

        html_message = render_to_string('emails/order_status_update.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Actualización de pedido #{order.order_number} - MCD Agencia',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[order.user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Order status update email sent for order {order.order_number}")
        return True

    except Order.DoesNotExist:
        logger.error(f"Order {order_id} not found")
        return False


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_shipping_notification_email(self, order_id: str):
    """
    Send shipping notification with tracking information.

    Args:
        order_id: UUID of the order.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.orders.models import Order

    try:
        order = Order.objects.select_related('user').get(id=order_id)

        context = {
            'order': order,
            'user': order.user,
            'tracking_number': order.tracking_number,
            'tracking_url': order.tracking_url,
            'shipping_address': order.shipping_address,
            'order_url': f"{settings.FRONTEND_URL}/orders/{order.id}",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/shipping_notification.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Tu pedido #{order.order_number} ha sido enviado - MCD Agencia',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[order.user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Shipping notification email sent for order {order.order_number}")
        return True

    except Order.DoesNotExist:
        logger.error(f"Order {order_id} not found")
        return False


@shared_task
def generate_daily_report():
    """
    Generate daily sales report and send to administrators.

    This task runs daily at 11:55 PM (configured in celery.py).

    Returns:
        dict: Report summary.
    """
    from apps.orders.models import Order
    from apps.users.models import User

    today = timezone.now().date()
    start_of_day = timezone.make_aware(
        timezone.datetime.combine(today, timezone.datetime.min.time())
    )
    end_of_day = timezone.make_aware(
        timezone.datetime.combine(today, timezone.datetime.max.time())
    )

    # Calculate daily statistics
    daily_orders = Order.objects.filter(
        created_at__gte=start_of_day,
        created_at__lte=end_of_day,
    )

    total_orders = daily_orders.count()
    completed_orders = daily_orders.filter(status='delivered').count()
    cancelled_orders = daily_orders.filter(status='cancelled').count()

    # Revenue calculation
    revenue_data = daily_orders.exclude(status='cancelled').aggregate(
        total_revenue=Sum('total'),
        total_tax=Sum('tax_amount'),
    )

    total_revenue = revenue_data['total_revenue'] or Decimal('0.00')
    total_tax = revenue_data['total_tax'] or Decimal('0.00')

    # New customers today
    new_customers = User.objects.filter(
        created_at__gte=start_of_day,
        created_at__lte=end_of_day,
        role__name='customer',
    ).count()

    # Prepare report
    report = {
        'date': today.isoformat(),
        'total_orders': total_orders,
        'completed_orders': completed_orders,
        'cancelled_orders': cancelled_orders,
        'pending_orders': total_orders - completed_orders - cancelled_orders,
        'total_revenue': str(total_revenue),
        'total_tax': str(total_tax),
        'net_revenue': str(total_revenue - total_tax),
        'new_customers': new_customers,
    }

    # Send report to administrators
    admin_emails = list(
        User.objects.filter(
            role__name__in=['admin'],
            is_active=True,
        ).values_list('email', flat=True)
    )

    if admin_emails:
        context = {
            'report': report,
            'date': today,
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/daily_sales_report.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Reporte de ventas diario - {today.strftime("%d/%m/%Y")}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admin_emails,
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Daily sales report sent to {len(admin_emails)} administrators")

    logger.info(f"Daily report generated: {total_orders} orders, ${total_revenue} revenue")
    return report


@shared_task
def send_abandoned_cart_reminders():
    """
    Send reminder emails for abandoned carts older than 24 hours.

    Returns:
        int: Number of reminders sent.
    """
    from apps.orders.models import Cart

    cutoff_time = timezone.now() - timedelta(hours=24)
    max_age = timezone.now() - timedelta(days=7)  # Don't remind about carts older than 7 days

    # Find abandoned carts with items
    abandoned_carts = Cart.objects.filter(
        updated_at__lt=cutoff_time,
        updated_at__gt=max_age,
        items__isnull=False,
    ).select_related('user').prefetch_related('items__variant').distinct()

    reminders_sent = 0

    for cart in abandoned_carts:
        if not cart.user or not cart.user.email:
            continue

        # Check if items still exist and have stock
        cart_items = cart.items.select_related('variant').all()
        if not cart_items.exists():
            continue

        context = {
            'user': cart.user,
            'cart': cart,
            'cart_items': cart_items,
            'cart_url': f"{settings.FRONTEND_URL}/cart",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/abandoned_cart_reminder.html', context)
        plain_message = strip_tags(html_message)

        try:
            send_mail(
                subject='¿Olvidaste algo? Tu carrito te espera - MCD Agencia',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[cart.user.email],
                html_message=html_message,
                fail_silently=False,
            )
            reminders_sent += 1
            logger.info(f"Abandoned cart reminder sent to {cart.user.email}")
        except Exception as e:
            logger.error(f"Failed to send abandoned cart reminder to {cart.user.email}: {e}")

    logger.info(f"Sent {reminders_sent} abandoned cart reminders")
    return reminders_sent


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def notify_admin_new_order(self, order_id: str):
    """
    Notify administrators about new orders.

    Args:
        order_id: UUID of the order.

    Returns:
        bool: True if notification was sent successfully.
    """
    from apps.orders.models import Order
    from apps.users.models import User

    try:
        order = Order.objects.select_related('user').prefetch_related('lines').get(id=order_id)

        admin_emails = list(
            User.objects.filter(
                role__name__in=['admin', 'sales'],
                is_active=True,
            ).values_list('email', flat=True)
        )

        if not admin_emails:
            logger.warning("No administrators found to notify about new order")
            return False

        context = {
            'order': order,
            'customer': order.user,
            'order_url': f"{settings.FRONTEND_URL}/admin/orders/{order.id}",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/admin_new_order.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Nuevo pedido #{order.order_number} - ${order.total}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admin_emails,
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"New order notification sent to {len(admin_emails)} administrators")
        return True

    except Order.DoesNotExist:
        logger.error(f"Order {order_id} not found")
        return False
