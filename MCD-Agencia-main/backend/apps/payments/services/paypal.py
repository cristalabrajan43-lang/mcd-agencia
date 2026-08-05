"""
PayPal Payment Service for MCD-Agencia.

This module provides PayPal integration for payment processing.
Supports:
    - Order creation
    - Order capture
    - Refunds
    - Webhook processing

Documentation: https://developer.paypal.com/docs/api/orders/v2/
"""

import logging
from decimal import Decimal
from typing import Optional
import json

from django.conf import settings
import requests

logger = logging.getLogger(__name__)


class PayPalService:
    """
    Service class for PayPal payment integration.

    Uses PayPal REST API v2 for order management.

    Usage:
        service = PayPalService()
        order = service.create_order(order)
    """

    API_BASE_LIVE = 'https://api-m.paypal.com'
    API_BASE_SANDBOX = 'https://api-m.sandbox.paypal.com'

    def __init__(self):
        """Initialize PayPal configuration."""
        self.client_id = getattr(settings, 'PAYPAL_CLIENT_ID', None)
        self.client_secret = getattr(settings, 'PAYPAL_CLIENT_SECRET', None)
        self.mode = getattr(settings, 'PAYPAL_MODE', 'sandbox')

        self.api_base = (
            self.API_BASE_LIVE if self.mode == 'live'
            else self.API_BASE_SANDBOX
        )

        self._access_token = None
        self._token_expiry = None

    def _get_access_token(self) -> Optional[str]:
        """
        Get OAuth access token from PayPal.

        Returns:
            str: Access token or None on failure.
        """
        if not self.client_id or not self.client_secret:
            logger.error("PayPal credentials not configured")
            return None

        # Check if we have a valid cached token
        import time
        if self._access_token and self._token_expiry:
            if time.time() < self._token_expiry:
                return self._access_token

        try:
            response = requests.post(
                f"{self.api_base}/v1/oauth2/token",
                auth=(self.client_id, self.client_secret),
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data={
                    'grant_type': 'client_credentials',
                },
                timeout=30,
            )

            if response.status_code == 200:
                data = response.json()
                self._access_token = data['access_token']
                # Cache token with some buffer before expiry
                self._token_expiry = time.time() + data.get('expires_in', 3600) - 60
                return self._access_token
            else:
                logger.error(f"Failed to get PayPal token: {response.text}")
                return None

        except Exception as e:
            logger.error(f"Error getting PayPal access token: {e}")
            return None

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[dict] = None
    ) -> Optional[dict]:
        """
        Make authenticated request to PayPal API.

        Args:
            method: HTTP method (GET, POST, etc.).
            endpoint: API endpoint.
            data: Request body data.

        Returns:
            dict: Response data or None on failure.
        """
        access_token = self._get_access_token()
        if not access_token:
            return None

        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
            }

            response = requests.request(
                method,
                f"{self.api_base}{endpoint}",
                headers=headers,
                json=data if data else None,
                timeout=30,
            )

            if response.status_code in [200, 201, 204]:
                if response.content:
                    return response.json()
                return {}
            else:
                logger.error(f"PayPal API error: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            logger.error(f"PayPal request error: {e}")
            return None

    def create_order(self, order) -> Optional[dict]:
        """
        Create a PayPal order for checkout.

        Args:
            order: Order model instance.

        Returns:
            dict: Order data with approval URL, or None on failure.
        """
        try:
            # Build items list
            items = []
            for line in order.lines.all():
                items.append({
                    'name': line.name[:127],  # PayPal limit
                    'description': (line.variant_name or '')[:127],
                    'quantity': str(line.quantity),
                    'unit_amount': {
                        'currency_code': 'MXN',
                        'value': str(line.unit_price),
                    },
                })

            # Build order data
            order_data = {
                'intent': 'CAPTURE',
                'purchase_units': [{
                    'reference_id': str(order.id),
                    'custom_id': str(order.id),
                    'description': f'Pedido #{order.order_number} - MCD Agencia',
                    'amount': {
                        'currency_code': 'MXN',
                        'value': str(order.total),
                        'breakdown': {
                            'item_total': {
                                'currency_code': 'MXN',
                                'value': str(order.subtotal),
                            },
                            'tax_total': {
                                'currency_code': 'MXN',
                                'value': str(order.tax_amount),
                            },
                        },
                    },
                    'items': items,
                }],
                'application_context': {
                    'brand_name': 'MCD Agencia',
                    'locale': 'es-MX',
                    'landing_page': 'LOGIN',
                    'shipping_preference': 'NO_SHIPPING',
                    'user_action': 'PAY_NOW',
                    'return_url': f"{settings.FRONTEND_URL}/checkout/paypal",
                    'cancel_url': f"{settings.FRONTEND_URL}/checkout/paypal/cancel",
                },
            }

            response = self._make_request('POST', '/v2/checkout/orders', order_data)

            if response:
                # Find approval URL
                approval_url = None
                for link in response.get('links', []):
                    if link.get('rel') == 'approve':
                        approval_url = link.get('href')
                        break

                logger.info(f"PayPal order created: {response.get('id')}")

                return {
                    'id': response.get('id'),
                    'status': response.get('status'),
                    'approval_url': approval_url,
                    'client_id': self.client_id,
                }
            else:
                return None

        except Exception as e:
            logger.error(f"Error creating PayPal order: {e}")
            return None

    def capture_order(self, paypal_order_id: str) -> Optional[dict]:
        """
        Capture a PayPal order after approval.

        Args:
            paypal_order_id: PayPal order ID.

        Returns:
            dict: Capture data or None on failure.
        """
        try:
            response = self._make_request(
                'POST',
                f'/v2/checkout/orders/{paypal_order_id}/capture'
            )

            if response:
                logger.info(f"PayPal order captured: {paypal_order_id}")
                return response
            else:
                return None

        except Exception as e:
            logger.error(f"Error capturing PayPal order: {e}")
            return None

    def get_order(self, paypal_order_id: str) -> Optional[dict]:
        """
        Get PayPal order details.

        Args:
            paypal_order_id: PayPal order ID.

        Returns:
            dict: Order data or None on failure.
        """
        return self._make_request('GET', f'/v2/checkout/orders/{paypal_order_id}')

    def create_refund(
        self,
        capture_id: str,
        amount: Optional[Decimal] = None,
        note: Optional[str] = None
    ) -> Optional[dict]:
        """
        Create a refund for a captured payment.

        Args:
            capture_id: PayPal capture ID.
            amount: Amount to refund (None for full refund).
            note: Refund note to seller.

        Returns:
            dict: Refund data or None on failure.
        """
        try:
            refund_data = {}

            if amount is not None:
                refund_data['amount'] = {
                    'currency_code': 'MXN',
                    'value': str(amount),
                }

            if note:
                refund_data['note_to_payer'] = note[:255]

            response = self._make_request(
                'POST',
                f'/v2/payments/captures/{capture_id}/refund',
                refund_data if refund_data else None
            )

            if response:
                logger.info(f"PayPal refund created: {response.get('id')}")
                return response
            else:
                return None

        except Exception as e:
            logger.error(f"Error creating PayPal refund: {e}")
            return None

    def verify_webhook_signature(self, request) -> bool:
        """
        Verify PayPal webhook signature.

        Args:
            request: Django HTTP request.

        Returns:
            bool: True if signature is valid.

        Raises:
            ValueError: If webhook ID is not configured in production.
        """
        webhook_id = getattr(settings, 'PAYPAL_WEBHOOK_ID', None)
        if not webhook_id:
            if not settings.DEBUG:
                logger.error("CRITICAL: PAYPAL_WEBHOOK_ID not configured in production!")
                raise ValueError("Webhook signature verification is required in production")
            logger.warning("PAYPAL_WEBHOOK_ID not configured, skipping verification (development only)")
            return True

        try:
            headers = {
                'PAYPAL-AUTH-ALGO': request.headers.get('PAYPAL-AUTH-ALGO'),
                'PAYPAL-CERT-URL': request.headers.get('PAYPAL-CERT-URL'),
                'PAYPAL-TRANSMISSION-ID': request.headers.get('PAYPAL-TRANSMISSION-ID'),
                'PAYPAL-TRANSMISSION-SIG': request.headers.get('PAYPAL-TRANSMISSION-SIG'),
                'PAYPAL-TRANSMISSION-TIME': request.headers.get('PAYPAL-TRANSMISSION-TIME'),
            }

            # In production, require all headers
            if not all(headers.values()):
                if not settings.DEBUG:
                    logger.error("Missing PayPal webhook headers in production")
                    return False
                logger.warning("Missing PayPal webhook headers, skipping verification (development only)")
                return True

            verify_data = {
                'auth_algo': headers['PAYPAL-AUTH-ALGO'],
                'cert_url': headers['PAYPAL-CERT-URL'],
                'transmission_id': headers['PAYPAL-TRANSMISSION-ID'],
                'transmission_sig': headers['PAYPAL-TRANSMISSION-SIG'],
                'transmission_time': headers['PAYPAL-TRANSMISSION-TIME'],
                'webhook_id': webhook_id,
                'webhook_event': request.data,
            }

            response = self._make_request(
                'POST',
                '/v1/notifications/verify-webhook-signature',
                verify_data
            )

            if response:
                return response.get('verification_status') == 'SUCCESS'
            return False

        except Exception as e:
            logger.error(f"Error verifying PayPal webhook: {e}")
            return False

    def process_webhook(self, data: dict) -> dict:
        """
        Process webhook data from PayPal.

        Args:
            data: Webhook payload.

        Returns:
            dict: Processing result.
        """
        event_type = data.get('event_type')
        resource = data.get('resource', {})

        result = {
            'event_type': event_type,
            'processed': False,
            'order_id': None,
            'capture_id': None,
            'status': None,
        }

        if event_type == 'PAYMENT.CAPTURE.COMPLETED':
            result['capture_id'] = resource.get('id')
            result['custom_id'] = resource.get('custom_id')
            result['amount'] = resource.get('amount', {}).get('value')
            result['status'] = 'completed'
            result['processed'] = True

        elif event_type == 'PAYMENT.CAPTURE.DENIED':
            result['capture_id'] = resource.get('id')
            result['custom_id'] = resource.get('custom_id')
            result['status'] = 'denied'
            result['processed'] = True

        elif event_type == 'PAYMENT.CAPTURE.REFUNDED':
            result['capture_id'] = resource.get('id')
            result['status'] = 'refunded'
            result['processed'] = True

        elif event_type == 'CHECKOUT.ORDER.APPROVED':
            result['order_id'] = resource.get('id')
            result['custom_id'] = resource.get('purchase_units', [{}])[0].get('custom_id')
            result['status'] = 'approved'
            result['processed'] = True

        return result


def get_paypal_service() -> PayPalService:
    """
    Get a PayPal service instance.

    Returns:
        PayPalService: Service instance.
    """
    return PayPalService()
