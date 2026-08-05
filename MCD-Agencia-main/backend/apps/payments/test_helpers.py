"""
Payment Testing Utilities.

This module provides helper functions for testing payments without real provider credentials.

Usage:
    from apps.payments.test_helpers import *

    # Create order for testing
    order = create_test_order()

    # Initiate payment
    payment = initiate_test_payment(order, 'mercadopago')

    # Simulate approval
    approve_test_payment(payment)

    # Check state
    print(payment.status)  # 'approved'
"""

import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)


def create_test_order(user=None, amount: Decimal = Decimal('1500.00'), **kwargs):
    """
    Create a test order quickly.

    Args:
        user: User to assign order to. If None, uses first user or creates one.
        amount: Order balance due
        **kwargs: Additional Order fields

    Returns:
        Order instance
    """
    from apps.orders.models import Order
    from django.contrib.auth import get_user_model

    User = get_user_model()

    if not user:
        user = User.objects.first() or User.objects.create_user(
            username='test_user',
            email='test@example.local',
            password='testpass123'
        )

    order = Order.objects.create(
        user=user,
        order_number=Order.objects.count() + 1,
        balance_due=amount,
        status=Order.STATUS_PENDING_PAYMENT,
        **kwargs
    )

    logger.info(f"Created test order: {order.id} (${amount})")
    return order


def create_test_quote(user=None, amount: Decimal = Decimal('2500.00'), **kwargs):
    """
    Create a test quote quickly.

    Args:
        user: User to assign quote to
        amount: Quote total
        **kwargs: Additional Quote fields

    Returns:
        Quote instance (ACCEPTED status)
    """
    from apps.quotes.models import Quote
    from django.contrib.auth import get_user_model

    User = get_user_model()

    if not user:
        user = User.objects.first() or User.objects.create_user(
            username='test_user',
            email='test@example.local',
            password='testpass123'
        )

    quote = Quote.objects.create(
        user=user,
        quote_number=f"TEST-{Quote.objects.count() + 1}",
        total=amount,
        status=Quote.STATUS_ACCEPTED,
        **kwargs
    )

    logger.info(f"Created test quote: {quote.id} (${amount})")
    return quote


def initiate_test_payment(order_or_quote, provider: str = 'mercadopago', amount: Decimal = None):
    """
    Initiate a test payment.

    Args:
        order_or_quote: Order or Quote instance
        provider: 'mercadopago' or 'paypal'
        amount: Custom amount (optional, defaults to balance_due/total)

    Returns:
        Payment instance with provider_order_id set
    """
    from apps.payments.models import Payment
    from apps.payments.services import get_payment_gateway

    if hasattr(order_or_quote, 'balance_due'):
        # It's an Order
        order = order_or_quote
        quote = None
        entity_amount = amount or order.balance_due
    else:
        # It's a Quote
        order = None
        quote = order_or_quote
        entity_amount = amount or quote.total

    payment = Payment.objects.create(
        order=order,
        quote=quote,
        user=order.user if order else quote.user,
        provider=provider,
        amount=entity_amount,
        status=Payment.STATUS_PENDING,
        metadata={
            'test': True,
            'created_by': 'test_helper'
        }
    )

    # Get gateway and create preference
    try:
        gateway = get_payment_gateway(provider=provider)

        payment_data = {
            'amount': float(entity_amount),
            'currency': 'MXN',
            'metadata': payment.metadata,
        }

        if provider == 'paypal':
            result = gateway.create_paypal_order(payment_data)
        else:
            result = gateway.create_preference(payment_data)

        if 'error' not in result:
            payment.provider_order_id = result.get('order_id') or result.get('preference_id')
            payment.save(update_fields=['provider_order_id'])
            logger.info(f"Created test payment: {payment.id} (provider_id={payment.provider_order_id})")

    except Exception as e:
        logger.error(f"Error creating test payment: {e}")
        payment.status = Payment.STATUS_REJECTED
        payment.error_message = str(e)
        payment.save()

    return payment


def approve_test_payment(payment, reason: str = 'admin test'):
    """
    Approve a test payment and process it.

    Args:
        payment: Payment instance
        reason: Log reason

    Returns:
        Updated Payment instance
    """
    from apps.payments.models import Payment
    from apps.audit.models import AuditLog

    if payment.status in [Payment.STATUS_APPROVED, Payment.STATUS_REFUNDED]:
        logger.warning(f"Payment {payment.id} already in status {payment.status}")
        return payment

    try:
        with transaction.atomic():
            payment.status = Payment.STATUS_APPROVED
            payment.approved_at = timezone.now()
            payment.metadata['test_approved_at'] = timezone.now().isoformat()
            payment.save()

            # Process order if applicable
            if payment.order:
                order = payment.order
                order.amount_paid += payment.amount
                if order.is_fully_paid:
                    order.transition_to('paid', notes=f'Test approval: {reason}')
                    order.paid_at = timezone.now()
                order.save()

            logger.info(f"Approved test payment: {payment.id}")

            # Audit log
            AuditLog.log(
                entity=payment,
                action=AuditLog.ACTION_PAYMENT_PROCESSED,
                metadata={'test': True, 'reason': reason}
            )

    except Exception as e:
        logger.error(f"Error approving test payment: {e}")
        raise

    return payment


def reject_test_payment(payment, reason: str = 'declined'):
    """
    Reject a test payment.

    Args:
        payment: Payment instance
        reason: Rejection reason

    Returns:
        Updated Payment instance
    """
    from apps.payments.models import Payment
    from apps.audit.models import AuditLog

    if payment.status != Payment.STATUS_PENDING:
        logger.warning(f"Payment {payment.id} not in PENDING status")
        return payment

    try:
        with transaction.atomic():
            payment.status = Payment.STATUS_REJECTED
            payment.error_message = f"Test rejection: {reason}"
            payment.metadata['test_rejected_at'] = timezone.now().isoformat()
            payment.save()

            logger.info(f"Rejected test payment: {payment.id}")

            # Audit log
            AuditLog.log(
                entity=payment,
                action=AuditLog.ACTION_PAYMENT_PROCESSED,
                metadata={'test': True, 'reason': reason}
            )

    except Exception as e:
        logger.error(f"Error rejecting test payment: {e}")
        raise

    return payment


def get_test_payment_state(payment):
    """
    Get comprehensive payment state for debugging.

    Returns dict with all relevant payment info.
    """
    return {
        'payment_id': str(payment.id),
        'status': payment.status,
        'provider': payment.provider,
        'amount': str(payment.amount),
        'provider_order_id': payment.provider_order_id,
        'is_successful': payment.is_successful,
        'approved_at': payment.approved_at,
        'order': {
            'id': str(payment.order.id),
            'number': payment.order.order_number,
            'status': payment.order.status,
            'balance_due': str(payment.order.balance_due),
            'amount_paid': str(payment.order.amount_paid),
        } if payment.order else None,
        'quote': {
            'id': str(payment.quote.id),
            'number': payment.quote.quote_number,
            'status': payment.quote.status,
            'total': str(payment.quote.total),
        } if payment.quote else None,
        'created_at': payment.created_at.isoformat(),
        'metadata': payment.metadata,
    }


def reset_test_environment():
    """
    Clear all test data from database.

    WARNING: This deletes orders, quotes, and payments!
    Use only in development/testing environments.
    """
    from apps.payments.models import Payment
    from apps.orders.models import Order
    from apps.quotes.models import Quote
    from apps.payments.services import MockPaymentGateway

    logger.warning("Resetting test environment...")

    # Delete test payments
    test_payments = Payment.objects.filter(metadata__test=True)
    count_payments = test_payments.count()
    test_payments.delete()

    # Clear mock gateway memory
    MockPaymentGateway.clear_mock_payments()

    logger.info(f"Reset complete: Deleted {count_payments} test payments, cleared mock gateway")


# Django shell shortcuts
def quick_test_flow():
    """
    Quick end-to-end test flow in Django shell.

    Usage:
        python manage.py shell
        >>> from apps.payments.test_helpers import quick_test_flow
        >>> quick_test_flow()
    """
    print("🚀 Starting quick test flow...\n")

    # 1. Create order
    print("1️⃣ Creating test order...")
    order = create_test_order(amount=Decimal('1500.00'))
    print(f"   ✓ Order: {order.id} | Balance: ${order.balance_due}\n")

    # 2. Initiate payment (Mercado Pago)
    print("2️⃣ Initiating Mercado Pago payment...")
    payment = initiate_test_payment(order, provider='mercadopago')
    print(f"   ✓ Payment: {payment.id}")
    print(f"   ✓ Provider ID: {payment.provider_order_id}")
    print(f"   ✓ Init Point: {payment.metadata.get('init_point', 'N/A')}\n")

    # 3. Simulate approval
    print("3️⃣ Simulating payment approval...")
    payment = approve_test_payment(payment, reason='auto test')
    print(f"   ✓ Status: {payment.status}")
    print(f"   ✓ Approved at: {payment.approved_at}\n")

    # 4. Check order state
    order.refresh_from_db()
    print("4️⃣ Order state after payment:")
    print(f"   ✓ Status: {order.status}")
    print(f"   ✓ Amount paid: ${order.amount_paid}")
    print(f"   ✓ Balance due: ${order.balance_due}")
    print(f"   ✓ Fully paid: {order.is_fully_paid}\n")

    print("✅ Quick test flow complete!")
    print(f"\nPayment state: {get_test_payment_state(payment)}")
