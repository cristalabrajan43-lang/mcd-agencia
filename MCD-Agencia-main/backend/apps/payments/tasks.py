"""
Celery Tasks for Payments App.

This module contains asynchronous tasks for payment processing:
    - Webhook processing
    - Payment status verification
    - Refund processing
    - Payment notifications
"""

import logging
from decimal import Decimal

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=5,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def process_mercadopago_webhook(self, webhook_data: dict):
    """
    Process incoming MercadoPago webhook.

    Args:
        webhook_data: Webhook payload from MercadoPago.

    Returns:
        bool: True if processed successfully.
    """
    from apps.payments.models import Payment, WebhookLog
    from apps.orders.models import Order

    webhook_type = webhook_data.get('type')
    data = webhook_data.get('data', {})

    # Log webhook
    webhook_log = WebhookLog.objects.create(
        provider='mercadopago',
        event_type=webhook_type,
        payload=webhook_data,
        status='processing',
    )

    try:
        if webhook_type == 'payment':
            payment_id = data.get('id')

            # Fetch payment details from MercadoPago API
            import mercadopago
            sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)
            mp_payment = sdk.payment().get(payment_id)

            if mp_payment['status'] != 200:
                raise Exception(f"Failed to fetch payment: {mp_payment}")

            payment_data = mp_payment['response']
            status = payment_data['status']
            external_reference = payment_data.get('external_reference')

            # Find related order and payment
            if external_reference:
                order = Order.objects.filter(id=external_reference).first()
                if order:
                    payment = Payment.objects.filter(
                        order=order,
                        provider='mercadopago',
                    ).first()

                    if payment:
                        # Update payment status
                        old_status = payment.status
                        payment.external_id = str(payment_id)
                        payment.provider_data = payment_data

                        if status == 'approved':
                            payment.status = 'completed'
                            payment.paid_at = timezone.now()
                            # Update order payment status
                            order.amount_paid = Decimal(str(payment_data['transaction_amount']))
                            order.status = 'confirmed'
                            order.paid_at = timezone.now()
                            order.save(update_fields=['amount_paid', 'status', 'paid_at'])

                            # Send confirmation email
                            send_payment_confirmation_email.delay(str(payment.id))

                        elif status == 'rejected':
                            payment.status = 'failed'
                            payment.failure_reason = payment_data.get('status_detail')

                        elif status == 'pending':
                            payment.status = 'pending'

                        elif status == 'cancelled':
                            payment.status = 'cancelled'

                        payment.save()
                        logger.info(
                            f"Payment {payment.id} updated: {old_status} -> {payment.status}"
                        )

        webhook_log.status = 'processed'
        webhook_log.processed_at = timezone.now()
        webhook_log.save(update_fields=['status', 'processed_at'])

        return True

    except Exception as e:
        webhook_log.status = 'failed'
        webhook_log.error_message = str(e)
        webhook_log.save(update_fields=['status', 'error_message'])
        logger.error(f"Failed to process MercadoPago webhook: {e}")
        raise


@shared_task(
    bind=True,
    max_retries=5,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def process_paypal_webhook(self, webhook_data: dict):
    """
    Process incoming PayPal webhook.

    Args:
        webhook_data: Webhook payload from PayPal.

    Returns:
        bool: True if processed successfully.
    """
    from apps.payments.models import Payment, WebhookLog
    from apps.orders.models import Order

    event_type = webhook_data.get('event_type')
    resource = webhook_data.get('resource', {})

    # Log webhook
    webhook_log = WebhookLog.objects.create(
        provider='paypal',
        event_type=event_type,
        payload=webhook_data,
        status='processing',
    )

    try:
        if event_type == 'PAYMENT.CAPTURE.COMPLETED':
            capture_id = resource.get('id')
            custom_id = resource.get('custom_id')  # Our order ID

            if custom_id:
                order = Order.objects.filter(id=custom_id).first()
                if order:
                    payment = Payment.objects.filter(
                        order=order,
                        provider='paypal',
                    ).first()

                    if payment:
                        amount = Decimal(str(resource['amount']['value']))

                        payment.status = 'completed'
                        payment.external_id = capture_id
                        payment.paid_at = timezone.now()
                        payment.provider_data = resource
                        payment.save()

                        # Update order
                        order.amount_paid = amount
                        order.status = 'confirmed'
                        order.paid_at = timezone.now()
                        order.save(update_fields=['amount_paid', 'status', 'paid_at'])

                        # Send confirmation
                        send_payment_confirmation_email.delay(str(payment.id))

                        logger.info(f"PayPal payment completed for order {order.order_number}")

        elif event_type == 'PAYMENT.CAPTURE.DENIED':
            custom_id = resource.get('custom_id')

            if custom_id:
                order = Order.objects.filter(id=custom_id).first()
                if order:
                    payment = Payment.objects.filter(
                        order=order,
                        provider='paypal',
                    ).first()

                    if payment:
                        payment.status = 'failed'
                        payment.failure_reason = 'Payment denied by PayPal'
                        payment.provider_data = resource
                        payment.save()

                        send_payment_failed_email.delay(str(payment.id))
                        logger.info(f"PayPal payment denied for order {order.order_number}")

        elif event_type == 'PAYMENT.CAPTURE.REFUNDED':
            capture_id = resource.get('id')
            # Handle refund notification
            logger.info(f"PayPal refund processed for capture {capture_id}")

        webhook_log.status = 'processed'
        webhook_log.processed_at = timezone.now()
        webhook_log.save(update_fields=['status', 'processed_at'])

        return True

    except Exception as e:
        webhook_log.status = 'failed'
        webhook_log.error_message = str(e)
        webhook_log.save(update_fields=['status', 'error_message'])
        logger.error(f"Failed to process PayPal webhook: {e}")
        raise


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_payment_confirmation_email(self, payment_id: str):
    """
    Send payment confirmation email to customer.

    Args:
        payment_id: UUID of the payment.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.payments.models import Payment

    try:
        payment = Payment.objects.select_related(
            'order', 'order__user'
        ).get(id=payment_id)

        context = {
            'payment': payment,
            'order': payment.order,
            'user': payment.order.user,
            'order_url': f"{settings.FRONTEND_URL}/orders/{payment.order.id}",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/payment_confirmation.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Pago confirmado - Pedido #{payment.order.order_number}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[payment.order.user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Payment confirmation email sent for payment {payment_id}")
        return True

    except Payment.DoesNotExist:
        logger.error(f"Payment {payment_id} not found")
        return False


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_payment_failed_email(self, payment_id: str):
    """
    Send payment failure notification to customer.

    Args:
        payment_id: UUID of the payment.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.payments.models import Payment

    try:
        payment = Payment.objects.select_related(
            'order', 'order__user'
        ).get(id=payment_id)

        context = {
            'payment': payment,
            'order': payment.order,
            'user': payment.order.user,
            'failure_reason': payment.failure_reason,
            'retry_url': f"{settings.FRONTEND_URL}/checkout/payment?order={payment.order.id}",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/payment_failed.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Problema con tu pago - Pedido #{payment.order.order_number}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[payment.order.user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Payment failed email sent for payment {payment_id}")
        return True

    except Payment.DoesNotExist:
        logger.error(f"Payment {payment_id} not found")
        return False


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=120,
    autoretry_for=(Exception,),
)
def process_refund(self, refund_id: str):
    """
    Process a refund through the payment provider.

    Args:
        refund_id: UUID of the refund.

    Returns:
        bool: True if refund was processed successfully.
    """
    from apps.payments.models import Refund, Payment

    try:
        refund = Refund.objects.select_related('payment', 'payment__order').get(id=refund_id)
        payment = refund.payment

        if payment.provider == 'mercadopago':
            result = process_mercadopago_refund(payment, refund)
        elif payment.provider == 'paypal':
            result = process_paypal_refund(payment, refund)
        else:
            logger.error(f"Unknown payment provider: {payment.provider}")
            refund.status = 'failed'
            refund.failure_reason = f"Unknown provider: {payment.provider}"
            refund.save(update_fields=['status', 'failure_reason'])
            return False

        if result['success']:
            refund.status = 'completed'
            refund.external_id = result.get('refund_id')
            refund.completed_at = timezone.now()
            refund.save(update_fields=['status', 'external_id', 'completed_at'])

            # Update payment refunded amount
            payment.refunded_amount = (payment.refunded_amount or Decimal('0.00')) + refund.amount
            if payment.refunded_amount >= payment.amount:
                payment.status = 'refunded'
            payment.save(update_fields=['refunded_amount', 'status'])

            # Send refund confirmation email
            send_refund_confirmation_email.delay(str(refund.id))

            logger.info(f"Refund {refund_id} processed successfully")
            return True
        else:
            refund.status = 'failed'
            refund.failure_reason = result.get('error', 'Unknown error')
            refund.save(update_fields=['status', 'failure_reason'])
            return False

    except Refund.DoesNotExist:
        logger.error(f"Refund {refund_id} not found")
        return False


def process_mercadopago_refund(payment, refund):
    """
    Process refund through MercadoPago API.

    Args:
        payment: Payment object.
        refund: Refund object.

    Returns:
        dict: Result with success status and refund_id or error.
    """
    try:
        import mercadopago
        sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)

        refund_data = {
            'amount': float(refund.amount),
        }

        result = sdk.refund().create(payment.external_id, refund_data)

        if result['status'] == 201:
            return {
                'success': True,
                'refund_id': str(result['response']['id']),
            }
        else:
            return {
                'success': False,
                'error': result.get('response', {}).get('message', 'Refund failed'),
            }

    except Exception as e:
        logger.error(f"MercadoPago refund error: {e}")
        return {'success': False, 'error': str(e)}


def process_paypal_refund(payment, refund):
    """
    Process refund through PayPal API.

    Args:
        payment: Payment object.
        refund: Refund object.

    Returns:
        dict: Result with success status and refund_id or error.
    """
    try:
        import paypalrestsdk

        paypalrestsdk.configure({
            'mode': settings.PAYPAL_MODE,
            'client_id': settings.PAYPAL_CLIENT_ID,
            'client_secret': settings.PAYPAL_CLIENT_SECRET,
        })

        capture = paypalrestsdk.Capture.find(payment.external_id)

        refund_result = capture.refund({
            'amount': {
                'total': str(refund.amount),
                'currency': 'MXN',
            },
        })

        if refund_result.success():
            return {
                'success': True,
                'refund_id': refund_result.id,
            }
        else:
            return {
                'success': False,
                'error': refund_result.error.get('message', 'Refund failed'),
            }

    except Exception as e:
        logger.error(f"PayPal refund error: {e}")
        return {'success': False, 'error': str(e)}


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_refund_confirmation_email(self, refund_id: str):
    """
    Send refund confirmation email to customer.

    Args:
        refund_id: UUID of the refund.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.payments.models import Refund

    try:
        refund = Refund.objects.select_related(
            'payment', 'payment__order', 'payment__order__user'
        ).get(id=refund_id)

        user = refund.payment.order.user

        context = {
            'refund': refund,
            'payment': refund.payment,
            'order': refund.payment.order,
            'user': user,
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/refund_confirmation.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Reembolso confirmado - ${refund.amount}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Refund confirmation email sent for refund {refund_id}")
        return True

    except Refund.DoesNotExist:
        logger.error(f"Refund {refund_id} not found")
        return False


@shared_task
def verify_pending_payments():
    """
    Verify status of pending payments with payment providers.

    This task checks payments that have been pending for more than
    30 minutes and verifies their actual status.

    Returns:
        dict: Summary of verified payments.
    """
    from apps.payments.models import Payment
    from datetime import timedelta

    cutoff_time = timezone.now() - timedelta(minutes=30)

    pending_payments = Payment.objects.filter(
        status='pending',
        created_at__lt=cutoff_time,
    )

    verified = 0
    errors = 0

    for payment in pending_payments:
        try:
            if payment.provider == 'mercadopago' and payment.external_id:
                import mercadopago
                sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)
                result = sdk.payment().get(payment.external_id)

                if result['status'] == 200:
                    mp_status = result['response']['status']
                    if mp_status == 'approved':
                        payment.status = 'completed'
                        payment.paid_at = timezone.now()
                    elif mp_status in ['rejected', 'cancelled']:
                        payment.status = 'failed'
                        payment.failure_reason = result['response'].get('status_detail')
                    payment.save()
                    verified += 1

            elif payment.provider == 'paypal' and payment.external_id:
                # PayPal verification logic
                pass

        except Exception as e:
            logger.error(f"Error verifying payment {payment.id}: {e}")
            errors += 1

    summary = {
        'verified': verified,
        'errors': errors,
        'checked_at': timezone.now().isoformat(),
    }

    logger.info(f"Pending payments verification: {verified} verified, {errors} errors")
    return summary
