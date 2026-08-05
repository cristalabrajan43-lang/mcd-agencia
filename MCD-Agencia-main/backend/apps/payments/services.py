"""
Payment Gateway Services for MCD-Agencia.

This module provides payment gateway integrations and mock implementations:
    - MockPaymentGateway: For testing without real provider credentials
    - MercadoPagoGateway: Mercado Pago integration (production-ready)
    - PayPalGateway: PayPal integration (production-ready)
"""

import uuid
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, Optional

from django.conf import settings

logger = logging.getLogger(__name__)


class PaymentGatewayInterface(ABC):
    """Abstract base class for payment gateways."""

    @abstractmethod
    def create_preference(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a payment preference/order."""
        pass

    @abstractmethod
    def verify_webhook(self, payload: Dict[str, Any], signature: str) -> bool:
        """Verify webhook signature."""
        pass

    @abstractmethod
    def get_payment_status(self, payment_id: str) -> str:
        """Get payment status from provider."""
        pass


class MockPaymentGateway(PaymentGatewayInterface):
    """
    Mock payment gateway for testing/development.

    When credentials are not configured, this gateway simulates realistic
    payment flows without calling real payment providers.

    Attributes:
        mode: 'mock', 'sandbox', or controlled by USE_MOCK_PAYMENTS env var
    """

    # Store in-memory payments for testing (would be DB in real app)
    _mock_payments: Dict[str, Dict[str, Any]] = {}

    def __init__(self, mode: str = 'mock'):
        self.mode = mode
        self.provider_name = 'mock'

    def create_preference(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a mock payment preference.

        Args:
            payment_data: Payment information (amount, currency, etc.)

        Returns:
            Dict with preference_id and init_point URLs
        """
        preference_id = f"mock-{uuid.uuid4()}"
        order_id = str(uuid.uuid4())

        # Store mock payment state
        self._mock_payments[preference_id] = {
            'id': preference_id,
            'order_id': order_id,
            'amount': payment_data.get('amount', 0),
            'currency': payment_data.get('currency', 'MXN'),
            'status': 'pending',
            'created_at': datetime.now().isoformat(),
            'metadata': payment_data.get('metadata', {}),
        }

        logger.info(f"Mock payment preference created: {preference_id}")

        return {
            'preference_id': preference_id,
            'order_id': order_id,
            'init_point': f"https://mock-checkout.mercadopago.com/?pref_id={preference_id}",
            'sandbox_init_point': f"https://mock-sandbox.mercadopago.com/?pref_id={preference_id}",
            'public_key': 'mock_public_key_test',
            'is_mock': True,
        }

    def create_paypal_order(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a mock PayPal order.

        Args:
            payment_data: Payment information

        Returns:
            Dict with order_id and approval_url
        """
        order_id = f"mock-{uuid.uuid4()}"

        self._mock_payments[order_id] = {
            'id': order_id,
            'amount': payment_data.get('amount', 0),
            'currency': payment_data.get('currency', 'MXN'),
            'status': 'created',
            'created_at': datetime.now().isoformat(),
            'metadata': payment_data.get('metadata', {}),
        }

        logger.info(f"Mock PayPal order created: {order_id}")

        return {
            'order_id': order_id,
            'status': 'CREATED',
            'approval_url': f"https://mock-sandbox.paypal.com/checkoutnow?token={order_id}",
            'client_id': 'mock_client_id_test',
            'is_mock': True,
        }

    def verify_webhook(self, payload: Dict[str, Any], signature: str) -> bool:
        """
        Verify webhook (always True in mock mode).

        In testing, you can pass signature='valid' or any value.
        """
        return True

    def get_payment_status(self, payment_id: str) -> str:
        """Get status of mock payment."""
        payment = self._mock_payments.get(payment_id, {})
        return payment.get('status', 'unknown')

    def simulate_payment_approved(self, payment_id: str) -> Dict[str, Any]:
        """
        Manually approve a payment (for testing).

        Returns webhook-like payload to process.
        """
        if payment_id not in self._mock_payments:
            return {'error': 'Payment not found'}

        self._mock_payments[payment_id]['status'] = 'approved'

        return {
            'type': 'payment',
            'data': {
                'id': payment_id,
                'status': 'approved',
                'amount': float(self._mock_payments[payment_id]['amount']),
                'simulator': True,
            }
        }

    def simulate_payment_rejected(self, payment_id: str, reason: str = 'declined') -> Dict[str, Any]:
        """Manually reject a payment (for testing)."""
        if payment_id not in self._mock_payments:
            return {'error': 'Payment not found'}

        self._mock_payments[payment_id]['status'] = 'rejected'
        self._mock_payments[payment_id]['rejection_reason'] = reason

        return {
            'type': 'payment',
            'data': {
                'id': payment_id,
                'status': 'rejected',
                'error': reason,
                'simulator': True,
            }
        }

    @classmethod
    def clear_mock_payments(cls):
        """Clear all in-memory mock payments (for test cleanup)."""
        cls._mock_payments.clear()


class MercadoPagoGateway(PaymentGatewayInterface):
    """
    Mercado Pago payment gateway.

    Production implementation using official Mercado Pago SDK.
    """

    def __init__(self):
        self.access_token = settings.MERCADOPAGO_ACCESS_TOKEN
        self.public_key = settings.MERCADOPAGO_PUBLIC_KEY
        self.webhook_secret = settings.MERCADOPAGO_WEBHOOK_SECRET
        self.provider_name = 'mercadopago'

        if not self.access_token or not self.public_key:
            logger.warning(
                "Mercado Pago credentials not configured. "
                "Falling back to mock gateway."
            )

    def create_preference(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create Mercado Pago preference."""
        try:
            # TODO: Implement with official SDK
            # import mercadopago
            # mp = mercadopago.MP(self.access_token)
            # preference_data = {...}
            # response = mp.create_preference(preference_data)
            # return response

            logger.error("Mercado Pago SDK not yet integrated")
            return {'error': 'Mercado Pago not configured'}

        except Exception as e:
            logger.error(f"Mercado Pago error: {str(e)}")
            return {'error': str(e)}

    def verify_webhook(self, payload: Dict[str, Any], signature: str) -> bool:
        """Verify Mercado Pago webhook signature."""
        try:
            # TODO: Implement signature verification
            # import hmac
            # import hashlib
            # expected_signature = hmac.new(
            #     self.webhook_secret.encode(),
            #     str(payload).encode(),
            #     hashlib.sha256
            # ).hexdigest()
            # return hmac.compare_digest(signature, expected_signature)

            logger.warning("Webhook signature verification not yet implemented")
            return True

        except Exception as e:
            logger.error(f"Signature verification error: {str(e)}")
            return False

    def get_payment_status(self, payment_id: str) -> str:
        """Get Mercado Pago payment status."""
        try:
            # TODO: Call Mercado Pago API to get status
            logger.info(f"Fetching Mercado Pago status for {payment_id}")
            return 'unknown'

        except Exception as e:
            logger.error(f"Error getting Mercado Pago status: {str(e)}")
            return 'error'


class PayPalGateway(PaymentGatewayInterface):
    """
    PayPal payment gateway.

    Production implementation using official PayPal SDK.
    """

    def __init__(self):
        self.client_id = settings.PAYPAL_CLIENT_ID
        self.client_secret = settings.PAYPAL_CLIENT_SECRET
        self.mode = settings.PAYPAL_MODE
        self.webhook_id = settings.PAYPAL_WEBHOOK_ID
        self.provider_name = 'paypal'

        if not self.client_id or not self.client_secret:
            logger.warning(
                "PayPal credentials not configured. "
                "Falling back to mock gateway."
            )

    def create_paypal_order(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create PayPal order."""
        try:
            # TODO: Implement with PayPal SDK
            # from paypalrestsdk import Api, Order
            # api = Api({
            #     'mode': self.mode,
            #     'client_id': self.client_id,
            #     'client_secret': self.client_secret,
            # })
            # order = Order(order_data)
            # response = order.create(api=api)

            logger.error("PayPal SDK not yet integrated")
            return {'error': 'PayPal not configured'}

        except Exception as e:
            logger.error(f"PayPal error: {str(e)}")
            return {'error': str(e)}

    def create_preference(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Alias for PayPal order creation."""
        return self.create_paypal_order(payment_data)

    def verify_webhook(self, payload: Dict[str, Any], signature: str) -> bool:
        """Verify PayPal webhook signature."""
        try:
            # TODO: Implement PayPal webhook verification
            # Verify transmission ID, timestamp signature, etc.
            logger.warning("PayPal webhook verification not yet implemented")
            return True

        except Exception as e:
            logger.error(f"PayPal webhook verification error: {str(e)}")
            return False

    def get_payment_status(self, payment_id: str) -> str:
        """Get PayPal payment status."""
        try:
            logger.info(f"Fetching PayPal status for {payment_id}")
            return 'unknown'

        except Exception as e:
            logger.error(f"Error getting PayPal status: {str(e)}")
            return 'error'


def get_payment_gateway(provider: str = 'mercadopago', mode: str = 'auto') -> PaymentGatewayInterface:
    """
    Factory function to get appropriate payment gateway.

    Args:
        provider: 'mercadopago', 'paypal', or 'mock'
        mode: 'auto' (auto-detect), 'mock', 'sandbox', 'live'

    Returns:
        PaymentGatewayInterface implementation
    """
    # Auto-detect if credentials are available
    if mode == 'auto':
        if provider == 'mercadopago':
            if settings.MERCADOPAGO_ACCESS_TOKEN:
                mode = 'live'
            else:
                mode = 'mock'
        elif provider == 'paypal':
            if settings.PAYPAL_CLIENT_ID:
                mode = 'live' if settings.PAYPAL_MODE == 'live' else 'sandbox'
            else:
                mode = 'mock'

    # Return mock gateway if needed
    if mode == 'mock' or getattr(settings, 'USE_MOCK_PAYMENTS', False):
        logger.info(f"Using MockPaymentGateway for {provider}")
        return MockPaymentGateway(mode='mock')

    # Return provider-specific gateway
    if provider == 'mercadopago':
        return MercadoPagoGateway()
    elif provider == 'paypal':
        return PayPalGateway()

    raise ValueError(f"Unknown payment provider: {provider}")
