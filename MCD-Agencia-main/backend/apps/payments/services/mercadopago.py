"""
MercadoPago Payment Service for MCD-Agencia.

This module provides MercadoPago integration for payment processing.
Supports:
    - Payment preferences (checkout)
    - Payment status verification
    - Refunds
    - Webhook processing

Documentation: https://www.mercadopago.com.mx/developers/es/docs
"""

import logging
from decimal import Decimal
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


class MercadoPagoService:
    """
    Service class for MercadoPago payment integration.

    Usage:
        service = MercadoPagoService()
        preference = service.create_preference(order)
    """

    def __init__(self):
        """Initialize MercadoPago SDK."""
        try:
            import mercadopago
            self.sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)
            self.public_key = settings.MERCADOPAGO_PUBLIC_KEY
        except ImportError:
            logger.error("mercadopago package not installed")
            self.sdk = None
        except AttributeError:
            logger.error("MERCADOPAGO_ACCESS_TOKEN not configured")
            self.sdk = None

    def create_preference(self, order) -> Optional[dict]:
        """
        Create a payment preference for checkout.

        Args:
            order: Order model instance.

        Returns:
            dict: Preference data with init_point URL, or None on failure.
        """
        if not self.sdk:
            logger.error("MercadoPago SDK not initialized")
            return None

        try:
            # Build items list from order lines
            items = []
            for line in order.lines.all():
                items.append({
                    'id': str(line.id),
                    'title': line.name,
                    'description': line.variant_name or '',
                    'quantity': line.quantity,
                    'currency_id': 'MXN',
                    'unit_price': float(line.unit_price),
                })

            # Build preference data
            preference_data = {
                'items': items,
                'payer': {
                    'name': order.user.first_name,
                    'surname': order.user.last_name,
                    'email': order.user.email,
                },
                'back_urls': {
                    'success': f"{settings.FRONTEND_URL}/checkout/mercadopago",
                    'failure': f"{settings.FRONTEND_URL}/checkout/mercadopago",
                    'pending': f"{settings.FRONTEND_URL}/checkout/mercadopago",
                },
                'auto_return': 'approved',
                'external_reference': str(order.id),
                'notification_url': f"{settings.BACKEND_URL}/api/payments/webhooks/mercadopago/",
                'statement_descriptor': 'MCD AGENCIA',
                'metadata': {
                    'order_id': str(order.id),
                    'order_number': order.order_number,
                },
            }

            # Add phone if available
            if hasattr(order.user, 'phone') and order.user.phone:
                preference_data['payer']['phone'] = {
                    'area_code': '52',  # Mexico
                    'number': order.user.phone,
                }

            # Create preference
            preference_response = self.sdk.preference().create(preference_data)

            if preference_response['status'] == 201:
                preference = preference_response['response']
                logger.info(f"MercadoPago preference created: {preference['id']}")

                return {
                    'id': preference['id'],
                    'init_point': preference['init_point'],
                    'sandbox_init_point': preference.get('sandbox_init_point'),
                    'public_key': self.public_key,
                }
            else:
                logger.error(f"Failed to create preference: {preference_response}")
                return None

        except Exception as e:
            logger.error(f"Error creating MercadoPago preference: {e}")
            return None

    def get_payment(self, payment_id: str) -> Optional[dict]:
        """
        Get payment details from MercadoPago.

        Args:
            payment_id: MercadoPago payment ID.

        Returns:
            dict: Payment data or None on failure.
        """
        if not self.sdk:
            return None

        try:
            response = self.sdk.payment().get(payment_id)

            if response['status'] == 200:
                return response['response']
            else:
                logger.error(f"Failed to get payment: {response}")
                return None

        except Exception as e:
            logger.error(f"Error getting MercadoPago payment: {e}")
            return None

    def create_refund(
        self,
        payment_id: str,
        amount: Optional[Decimal] = None
    ) -> Optional[dict]:
        """
        Create a refund for a payment.

        Args:
            payment_id: MercadoPago payment ID.
            amount: Amount to refund (None for full refund).

        Returns:
            dict: Refund data or None on failure.
        """
        if not self.sdk:
            return None

        try:
            refund_data = {}
            if amount is not None:
                refund_data['amount'] = float(amount)

            response = self.sdk.refund().create(payment_id, refund_data)

            if response['status'] == 201:
                logger.info(f"MercadoPago refund created for payment {payment_id}")
                return response['response']
            else:
                logger.error(f"Failed to create refund: {response}")
                return None

        except Exception as e:
            logger.error(f"Error creating MercadoPago refund: {e}")
            return None

    def verify_webhook_signature(self, request) -> bool:
        """
        Verify MercadoPago webhook signature.

        Args:
            request: Django HTTP request.

        Returns:
            bool: True if signature is valid.
        """
        # MercadoPago sends webhook verification in headers
        x_signature = request.headers.get('x-signature')
        x_request_id = request.headers.get('x-request-id')

        if not x_signature or not x_request_id:
            return True  # Development mode without signature

        # In production, implement proper signature verification
        # https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
        return True

    def process_webhook(self, data: dict) -> dict:
        """
        Process webhook data from MercadoPago.

        Args:
            data: Webhook payload.

        Returns:
            dict: Processing result.
        """
        event_type = data.get('type')
        action = data.get('action')
        resource = data.get('data', {})

        result = {
            'event_type': event_type,
            'action': action,
            'processed': False,
            'payment_id': None,
            'status': None,
        }

        if event_type == 'payment':
            payment_id = resource.get('id')

            if payment_id:
                # Fetch payment details
                payment_data = self.get_payment(payment_id)

                if payment_data:
                    result['payment_id'] = str(payment_id)
                    result['status'] = payment_data.get('status')
                    result['external_reference'] = payment_data.get('external_reference')
                    result['amount'] = payment_data.get('transaction_amount')
                    result['processed'] = True

        return result


def get_mercadopago_service() -> MercadoPagoService:
    """
    Get a MercadoPago service instance.

    Returns:
        MercadoPagoService: Service instance.
    """
    return MercadoPagoService()
