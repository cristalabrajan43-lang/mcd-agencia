"""
Payment Views for MCD-Agencia.

This module provides ViewSets for payment operations:
    - Payment initiation
    - Webhook handling
    - Refund management
"""

import hashlib
import hmac
import json
import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from apps.audit.models import AuditLog
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsRoleAdmin
from apps.core.views import is_internal_user
from .models import Payment, PaymentWebhookLog, Refund
from .serializers import (
    PaymentSerializer,
    PaymentListSerializer,
    CreatePaymentSerializer,
    MercadoPagoPreferenceSerializer,
    PayPalOrderSerializer,
    RefundSerializer,
    CreateRefundSerializer,
    PaymentWebhookLogSerializer,
    PaymentSummarySerializer,
)

logger = logging.getLogger(__name__)


class PaymentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for payment management.

    Customer endpoints:
        GET /api/v1/payments/ - List user's payments
        GET /api/v1/payments/{id}/ - Payment details
        POST /api/v1/payments/initiate/ - Start payment

    Admin endpoints:
        GET /api/v1/admin/payments/ - List all payments
    """

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'provider']

    def get_queryset(self):
        """Return payments based on user role."""
        if is_internal_user(self.request.user):
            return Payment.objects.all().select_related('order', 'quote', 'user')
        return Payment.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if self.action == 'list':
            return PaymentListSerializer
        return PaymentSerializer

    @action(detail=False, methods=['post'])
    def initiate(self, request):
        """
        Initiate a payment.

        POST /api/v1/payments/initiate/
        {
            "order_id": "uuid",
            "provider": "mercadopago",
            "amount": 1000.00  # optional, for deposits
        }

        Returns:
            {
                "payment_id": "uuid",
                "provider_order_id": "...",
                "init_point": "https://...",  # for MP
                "approval_url": "https://...",  # for PayPal
                "is_mock": true  # if using mock gateway
            }
        """
        # Include user in validation context
        data = request.data.copy()
        serializer = CreatePaymentSerializer(data=data)

        # Manually set user for validation
        if hasattr(serializer, '_user'):
            serializer._user = request.user

        serializer.is_valid(raise_exception=True)

        provider = serializer.validated_data['provider']
        order = serializer.validated_data.get('order')
        quote = serializer.validated_data.get('quote')
        custom_amount = serializer.validated_data.get('amount')

        # Determine amount and entity
        if order:
            amount = custom_amount or order.balance_due
            entity_type = 'order'
            entity = order
            metadata = {
                'order_id': str(order.id),
                'order_number': order.order_number,
                'user_id': str(order.user_id),
            }
        else:
            amount = custom_amount or quote.total
            entity_type = 'quote'
            entity = quote
            metadata = {
                'quote_id': str(quote.id),
                'quote_number': quote.quote_number,
                'user_id': str(quote.user_id),
            }

        # Create payment record
        payment = Payment.objects.create(
            order=order,
            quote=quote,
            user=request.user,
            provider=provider,
            amount=amount,
            status=Payment.STATUS_PENDING,
            ip_address=self._get_client_ip(request),
            metadata=metadata,
        )

        logger.info(
            f"Payment initiated: {payment.id} for {entity_type} "
            f"(provider={provider}, user={request.user.id}, amount={amount})"
        )

        # Generate payment based on provider
        from .services import get_payment_gateway
        
        try:
            gateway = get_payment_gateway(provider=provider)

            payment_data = {
                'amount': float(amount),
                'currency': 'MXN',
                'metadata': metadata,
            }

            if provider == Payment.PROVIDER_MERCADOPAGO:
                result = gateway.create_preference(payment_data)
            else:  # PayPal
                result = gateway.create_paypal_order(payment_data)

            if 'error' in result:
                payment.status = Payment.STATUS_REJECTED
                payment.error_message = result['error']
                payment.save(update_fields=['status', 'error_message', 'updated_at'])
                
                logger.error(f"Payment initiation failed: {result['error']}")
                
                return Response(
                    {'error': result['error']},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Store provider order ID
            payment.provider_order_id = result.get('order_id') or result.get('preference_id')
            payment.save(update_fields=['provider_order_id', 'updated_at'])

            AuditLog.log(
                entity=payment,
                action=AuditLog.ACTION_CREATED,
                actor=request.user,
                after_state=PaymentSerializer(payment).data,
                request=request,
                metadata={'provider': provider, 'amount': str(amount)}
            )

            logger.info(f"Payment initiated successfully: {payment.id}")

            return Response({
                'payment_id': str(payment.id),
                'status': payment.status,
                **result
            })

        except Exception as e:
            logger.error(f"Unexpected error initiating payment: {str(e)}", exc_info=True)
            payment.status = Payment.STATUS_REJECTED
            payment.error_message = f"System error: {str(e)}"
            payment.save(update_fields=['status', 'error_message', 'updated_at'])

            return Response(
                {'error': 'Failed to initiate payment. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    @action(detail=True, methods=['get'])
    def check_status(self, request, pk=None):
        """Check payment status."""
        payment = self.get_object()
        return Response({
            'status': payment.status,
            'is_successful': payment.is_successful
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def test_simulate_approved(self, request, pk=None):
        """
        [ADMIN/TESTING ONLY] Simulate an approved payment.

        This endpoint is for development/testing only. It manually marks
        a payment as approved and processes it as if a webhook was received.

        POST /api/v1/payments/{id}/test_simulate_approved/

        Returns:
            Updated payment data after approval
        """
        if not is_internal_user(request.user):
            return Response(
                {'error': 'Only staff users can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )

        payment = self.get_object()

        if payment.status in [Payment.STATUS_APPROVED, Payment.STATUS_REFUNDED]:
            return Response(
                {'error': f'Cannot simulate approval for {payment.status} payment'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                # Mark as approved
                payment.status = Payment.STATUS_APPROVED
                payment.approved_at = timezone.now()
                payment.metadata['simulator'] = True
                payment.metadata['simulated_at'] = timezone.now().isoformat()
                payment.save()

                # Process successful payment
                if payment.order:
                    order = payment.order
                    order.amount_paid += payment.amount
                    if order.is_fully_paid:
                        order.transition_to(
                            'paid',
                            notes=f'Payment simulated by {request.user.username} (admin)'
                        )
                        order.paid_at = timezone.now()
                    order.save(update_fields=['amount_paid', 'updated_at'])

                    logger.info(
                        f"Payment {payment.id} simulated as approved by {request.user.username}. "
                        f"Order amount_paid: {order.amount_paid}"
                    )

                # Log audit
                AuditLog.log(
                    entity=payment,
                    action=AuditLog.ACTION_PAYMENT_PROCESSED,
                    actor=request.user,
                    after_state=PaymentSerializer(payment).data,
                    metadata={
                        'simulator': True,
                        'approved_by': request.user.username,
                        'reason': 'Admin testing'
                    }
                )

            return Response(PaymentSerializer(payment).data)

        except Exception as e:
            logger.error(f"Error simulating payment approval: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to simulate payment: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def test_simulate_rejected(self, request, pk=None):
        """
        [ADMIN/TESTING ONLY] Simulate a rejected payment.

        POST /api/v1/payments/{id}/test_simulate_rejected/
        {
            "reason": "declined"  # optional
        }

        Returns:
            Updated payment data after rejection
        """
        if not is_internal_user(request.user):
            return Response(
                {'error': 'Only staff users can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )

        payment = self.get_object()
        reason = request.data.get('reason', 'declined')

        if payment.status in [Payment.STATUS_REJECTED, Payment.STATUS_REFUNDED]:
            return Response(
                {'error': f'Cannot simulate rejection for {payment.status} payment'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                # Mark as rejected
                payment.status = Payment.STATUS_REJECTED
                payment.error_message = f"Simulated rejection: {reason}"
                payment.metadata['simulator'] = True
                payment.metadata['simulated_at'] = timezone.now().isoformat()
                payment.metadata['rejection_reason'] = reason
                payment.save()

                logger.info(
                    f"Payment {payment.id} simulated as rejected by {request.user.username}. "
                    f"Reason: {reason}"
                )

                # Log audit
                AuditLog.log(
                    entity=payment,
                    action=AuditLog.ACTION_PAYMENT_PROCESSED,
                    actor=request.user,
                    after_state=PaymentSerializer(payment).data,
                    metadata={
                        'simulator': True,
                        'rejected_by': request.user.username,
                        'reason': reason
                    }
                )

            return Response(PaymentSerializer(payment).data)

        except Exception as e:
            logger.error(f"Error simulating payment rejection: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to simulate payment: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def test_create_order(self, request):
        """
        [ADMIN/TESTING ONLY] Create a test order for payment testing.

        POST /api/v1/payments/test/create-order/
        {
            "amount": "1500.00"  # optional, defaults to 1500
        }

        Returns:
            Created order with balance_due equal to amount
        """
        if not is_internal_user(request.user):
            return Response(
                {'error': 'Only staff users can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )

        from apps.orders.models import Order
        from decimal import Decimal

        try:
            amount = request.data.get('amount', '1500.00')
            
            try:
                amount = Decimal(str(amount))
            except:
                amount = Decimal('1500.00')

            # Calculate subtotal and tax to match total
            # Assuming 16% tax rate (IVA)
            tax_rate = Decimal('0.1600')
            subtotal = amount / (Decimal('1') + tax_rate)
            tax_amount = amount - subtotal

            order = Order.objects.create(
                user=request.user,
                order_number=f"TEST-{Order.objects.count() + 1}",
                total=amount,
                subtotal=subtotal,
                tax_amount=tax_amount,
                status=Order.STATUS_PENDING_PAYMENT,
            )

            logger.info(f"Test order created: {order.id} by admin {request.user.email}")

            return Response({
                'id': str(order.id),
                'order_number': order.order_number,
                'balance_due': str(order.balance_due),
                'total': str(order.total),
                'subtotal': str(order.subtotal),
                'tax_amount': str(order.tax_amount),
                'status': order.status,
                'user_id': str(order.user_id),
                'created_at': order.created_at.isoformat(),
            })

        except Exception as e:
            logger.error(f"Error creating test order: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to create test order: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def test_create_quote(self, request):
        """
        [ADMIN/TESTING ONLY] Create a test quote for payment testing.

        POST /api/v1/payments/test/create-quote/
        {
            "amount": "2500.00"  # optional, defaults to 2500
        }

        Returns:
            Created quote in ACCEPTED status
        """
        if not is_internal_user(request.user):
            return Response(
                {'error': 'Only staff users can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )

        from apps.quotes.models import Quote
        from decimal import Decimal

        try:
            amount = request.data.get('amount', '2500.00')
            
            try:
                amount = Decimal(str(amount))
            except:
                amount = Decimal('2500.00')

            # Calculate subtotal and tax to match total
            # Assuming 16% tax rate (IVA)
            tax_rate = Decimal('0.1600')
            subtotal = amount / (Decimal('1') + tax_rate)
            tax_amount = amount - subtotal

            quote = Quote.objects.create(
                customer=request.user,
                customer_name=request.user.get_full_name() or request.user.username,
                customer_email=request.user.email,
                quote_number=f"TEST-{Quote.objects.count() + 1}",
                total=amount,
                subtotal=subtotal,
                tax_amount=tax_amount,
                status=Quote.STATUS_ACCEPTED,
            )

            logger.info(f"Test quote created: {quote.id} by admin {request.user.email}")

            return Response({
                'id': str(quote.id),
                'quote_number': quote.quote_number,
                'total': str(quote.total),
                'subtotal': str(quote.subtotal),
                'tax_amount': str(quote.tax_amount),
                'status': quote.status,
                'customer_id': str(quote.customer_id) if quote.customer else None,
                'created_at': quote.created_at.isoformat(),
            })

        except Exception as e:
            logger.error(f"Error creating test quote: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to create test quote: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def test_mock_payments(self, request):
        """
        [ADMIN/TESTING ONLY] Get list of current mock payments.

        Returns all payments that were created using the mock gateway.

        GET /api/v1/payments/test_mock_payments/

        Returns:
            List of mock payments with details
        """
        if not is_internal_user(request.user):
            return Response(
                {'error': 'Only staff users can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )

        from .services import MockPaymentGateway

        mock_payments = MockPaymentGateway._mock_payments
        return Response({
            'count': len(mock_payments),
            'payments': list(mock_payments.values())
        })


class MercadoPagoWebhookView(APIView):
    """
    Handle Mercado Pago webhooks.

    POST /api/v1/payments/webhooks/mercadopago/
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Process Mercado Pago webhook."""
        # Log webhook
        webhook_log = PaymentWebhookLog.objects.create(
            provider=Payment.PROVIDER_MERCADOPAGO,
            event_type=request.data.get('type', 'unknown'),
            event_id=request.data.get('data', {}).get('id', 'unknown'),
            payload=request.data,
            headers=dict(request.headers),
            ip_address=self._get_client_ip(request)
        )

        try:
            # Verify webhook signature
            if not self._verify_signature(request):
                logger.warning("Invalid Mercado Pago webhook signature")
                webhook_log.processing_error = "Invalid signature"
                webhook_log.save(update_fields=['processing_error', 'updated_at'])
                return Response({'error': 'Invalid signature'}, status=status.HTTP_401_UNAUTHORIZED)

            event_type = request.data.get('type')
            data = request.data.get('data', {})

            if event_type == 'payment':
                self._handle_payment_notification(data, webhook_log)

            webhook_log.processed = True
            webhook_log.save(update_fields=['processed', 'updated_at'])

        except Exception as e:
            logger.error(f"Webhook processing error: {str(e)}")
            webhook_log.processing_error = str(e)
            webhook_log.save(update_fields=['processing_error', 'updated_at'])

        # Always return 200 to acknowledge receipt
        return Response({'status': 'ok'})

    def _handle_payment_notification(self, data, webhook_log):
        """Handle payment status notification."""
        payment_id = data.get('id')

        if not payment_id:
            return

        # Find payment by provider ID
        try:
            payment = Payment.objects.get(
                provider=Payment.PROVIDER_MERCADOPAGO,
                provider_order_id=payment_id
            )
        except Payment.DoesNotExist:
            payment = Payment.objects.filter(
                provider=Payment.PROVIDER_MERCADOPAGO,
                provider_payment_id=payment_id
            ).first()

        if not payment:
            logger.warning(f"Payment not found for MP ID: {payment_id}")
            return

        webhook_log.payment = payment
        webhook_log.save(update_fields=['payment'])

        # Update payment status based on webhook data
        # In production, fetch actual status from Mercado Pago API
        status_map = {
            'approved': Payment.STATUS_APPROVED,
            'pending': Payment.STATUS_PENDING,
            'rejected': Payment.STATUS_REJECTED,
            'cancelled': Payment.STATUS_CANCELLED,
        }

        new_status = status_map.get(data.get('status'), payment.status)

        with transaction.atomic():
            if payment.status != new_status:
                payment.status = new_status
                if new_status == Payment.STATUS_APPROVED:
                    payment.approved_at = timezone.now()
                    self._process_successful_payment(payment)
                payment.save()

                AuditLog.log(
                    entity=payment,
                    action=AuditLog.ACTION_PAYMENT_PROCESSED,
                    after_state=PaymentSerializer(payment).data,
                    metadata={'webhook': True, 'provider': 'mercadopago'}
                )

    def _process_successful_payment(self, payment):
        """Process successful payment."""
        if payment.order:
            order = payment.order
            order.amount_paid += payment.amount
            if order.is_fully_paid:
                order.transition_to(
                    'paid',
                    notes='Payment completed via Mercado Pago'
                )
                order.paid_at = timezone.now()
            order.save()

            # In-app notification: payment received
            try:
                from apps.notifications.models import Notification
                owner = order.quote.created_by if order.quote else None
                Notification.notify_owner_and_admins(
                    owner=owner,
                    notification_type=Notification.TYPE_PAYMENT_RECEIVED,
                    title=f'Pago recibido — Pedido #{order.order_number}',
                    message=f'${payment.amount:,.2f} vía Mercado Pago',
                    entity_type='Order',
                    entity_id=order.id,
                    action_url=f'/dashboard/pedidos/{order.id}',
                )
            except Exception:
                pass

    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    def _verify_signature(self, request):
        """
        Verify Mercado Pago webhook signature.

        Mercado Pago sends signature in x-signature header with format:
        ts=timestamp,v1=signature

        The signature is HMAC-SHA256 of: id.request_id.ts.data

        Returns:
            bool: True if signature is valid

        Raises:
            ValueError: If webhook secret is not configured in production
        """
        secret = getattr(settings, 'MERCADOPAGO_WEBHOOK_SECRET', '')

        # In production (DEBUG=False), webhook secret MUST be configured
        if not secret:
            if not settings.DEBUG:
                logger.error("CRITICAL: Mercado Pago webhook secret not configured in production!")
                raise ValueError("Webhook signature verification is required in production")
            logger.warning("Mercado Pago webhook secret not configured, skipping verification (development only)")
            return True

        # Get signature components from headers
        x_signature = request.headers.get('x-signature', '')
        x_request_id = request.headers.get('x-request-id', '')

        if not x_signature:
            logger.warning("Missing x-signature header in Mercado Pago webhook")
            return False

        # Parse signature header
        signature_parts = {}
        for part in x_signature.split(','):
            if '=' in part:
                key, value = part.split('=', 1)
                signature_parts[key.strip()] = value.strip()

        ts = signature_parts.get('ts', '')
        v1 = signature_parts.get('v1', '')

        if not ts or not v1:
            logger.warning("Invalid x-signature format in Mercado Pago webhook")
            return False

        # Get data ID from payload
        data_id = request.data.get('data', {}).get('id', '')

        # Build the manifest string: id.request_id.ts.data_id
        # Note: Mercado Pago uses specific format for signing
        manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"

        # Calculate expected signature
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            manifest.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        # Compare signatures
        is_valid = hmac.compare_digest(expected_signature, v1)

        if not is_valid:
            logger.warning(f"Mercado Pago signature mismatch. Expected prefix of computed signature.")

        return is_valid


class PayPalWebhookView(APIView):
    """
    Handle PayPal webhooks.

    POST /api/v1/payments/webhooks/paypal/
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Process PayPal webhook."""
        # Log webhook
        webhook_log = PaymentWebhookLog.objects.create(
            provider=Payment.PROVIDER_PAYPAL,
            event_type=request.data.get('event_type', 'unknown'),
            event_id=request.data.get('id', 'unknown'),
            payload=request.data,
            headers=dict(request.headers),
            ip_address=self._get_client_ip(request)
        )

        try:
            # Verify webhook signature
            if not self._verify_webhook(request):
                logger.warning("Invalid PayPal webhook signature")
                webhook_log.processing_error = "Invalid signature"
                webhook_log.save(update_fields=['processing_error', 'updated_at'])
                return Response({'error': 'Invalid signature'}, status=status.HTTP_401_UNAUTHORIZED)

            event_type = request.data.get('event_type')
            resource = request.data.get('resource', {})

            if event_type in ['PAYMENT.CAPTURE.COMPLETED', 'CHECKOUT.ORDER.APPROVED']:
                self._handle_payment_completed(resource, webhook_log)

            webhook_log.processed = True
            webhook_log.save(update_fields=['processed', 'updated_at'])

        except Exception as e:
            logger.error(f"PayPal webhook error: {str(e)}")
            webhook_log.processing_error = str(e)
            webhook_log.save(update_fields=['processing_error', 'updated_at'])

        return Response({'status': 'ok'})

    def _handle_payment_completed(self, resource, webhook_log):
        """Handle payment completed notification."""
        order_id = resource.get('id')

        try:
            payment = Payment.objects.get(
                provider=Payment.PROVIDER_PAYPAL,
                provider_order_id=order_id
            )
        except Payment.DoesNotExist:
            logger.warning(f"Payment not found for PayPal order: {order_id}")
            return

        webhook_log.payment = payment
        webhook_log.save(update_fields=['payment'])

        with transaction.atomic():
            payment.status = Payment.STATUS_APPROVED
            payment.approved_at = timezone.now()
            payment.provider_payment_id = resource.get('purchase_units', [{}])[0].get(
                'payments', {}
            ).get('captures', [{}])[0].get('id', '')
            payment.save()

            # Process order payment
            if payment.order:
                order = payment.order
                order.amount_paid += payment.amount
                if order.is_fully_paid:
                    order.transition_to(
                        'paid',
                        notes='Payment completed via PayPal'
                    )
                    order.paid_at = timezone.now()
                order.save()

            AuditLog.log(
                entity=payment,
                action=AuditLog.ACTION_PAYMENT_PROCESSED,
                after_state=PaymentSerializer(payment).data,
                metadata={'webhook': True, 'provider': 'paypal'}
            )

            # In-app notification: PayPal payment received
            if payment.order:
                try:
                    from apps.notifications.models import Notification
                    order = payment.order
                    owner = order.quote.created_by if order.quote else None
                    Notification.notify_owner_and_admins(
                        owner=owner,
                        notification_type=Notification.TYPE_PAYMENT_RECEIVED,
                        title=f'Pago recibido — Pedido #{order.order_number}',
                        message=f'${payment.amount:,.2f} vía PayPal',
                        entity_type='Order',
                        entity_id=order.id,
                        action_url=f'/dashboard/pedidos/{order.id}',
                    )
                except Exception:
                    pass

    def _verify_webhook(self, request):
        """
        Verify PayPal webhook signature.

        PayPal uses a certificate-based signature verification.
        Headers: paypal-transmission-id, paypal-transmission-time,
                 paypal-transmission-sig, paypal-cert-url

        For production, this should verify against PayPal's API.
        See: https://developer.paypal.com/docs/api-basics/notifications/webhooks/rest/

        Returns:
            bool: True if signature is valid or verification is disabled
        """
        import requests
        import base64
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding

        webhook_id = getattr(settings, 'PAYPAL_WEBHOOK_ID', '')

        # Skip verification if webhook ID is not configured (development)
        if not webhook_id:
            logger.warning("PayPal webhook ID not configured, skipping verification")
            return True

        # Get required headers
        transmission_id = request.headers.get('paypal-transmission-id', '')
        transmission_time = request.headers.get('paypal-transmission-time', '')
        transmission_sig = request.headers.get('paypal-transmission-sig', '')
        cert_url = request.headers.get('paypal-cert-url', '')

        if not all([transmission_id, transmission_time, transmission_sig, cert_url]):
            logger.warning("Missing required PayPal webhook headers")
            return False

        # Validate cert URL is from PayPal
        if not cert_url.startswith('https://api.paypal.com/') and not cert_url.startswith('https://api.sandbox.paypal.com/'):
            logger.warning(f"Invalid PayPal certificate URL: {cert_url}")
            return False

        try:
            # Fetch the certificate
            cert_response = requests.get(cert_url, timeout=10)
            cert_response.raise_for_status()
            cert_pem = cert_response.content

            # Load the certificate
            cert = x509.load_pem_x509_certificate(cert_pem)
            public_key = cert.public_key()

            # Build the message to verify
            # Format: transmission_id|transmission_time|webhook_id|crc32(payload)
            import zlib
            payload_bytes = request.body if hasattr(request, 'body') else json.dumps(request.data).encode()
            crc = zlib.crc32(payload_bytes) & 0xffffffff
            message = f"{transmission_id}|{transmission_time}|{webhook_id}|{crc}"

            # Decode the signature
            signature = base64.b64decode(transmission_sig)

            # Verify the signature
            public_key.verify(
                signature,
                message.encode('utf-8'),
                padding.PKCS1v15(),
                hashes.SHA256()
            )

            return True

        except requests.RequestException as e:
            logger.error(f"Failed to fetch PayPal certificate: {e}")
            return False
        except Exception as e:
            logger.error(f"PayPal signature verification failed: {e}")
            return False

    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class RefundViewSet(viewsets.ModelViewSet):
    """
    ViewSet for refund management.

    GET /api/v1/admin/refunds/
    POST /api/v1/admin/refunds/
    GET /api/v1/admin/refunds/{id}/
    """

    queryset = Refund.objects.select_related('payment', 'processed_by')
    serializer_class = RefundSerializer
    permission_classes = [IsRoleAdmin]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'reason']

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if self.action == 'create':
            return CreateRefundSerializer
        return RefundSerializer

    def create(self, request, *args, **kwargs):
        """Create a refund."""
        serializer = CreateRefundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment = serializer.validated_data['payment']

        with transaction.atomic():
            refund = Refund.objects.create(
                payment=payment,
                amount=serializer.validated_data['amount'],
                reason=serializer.validated_data['reason'],
                reason_details=serializer.validated_data.get('reason_details', ''),
                processed_by=request.user,
                processed_at=timezone.now()
            )

            # In production, process refund via payment provider
            # For now, mark as approved
            refund.status = Refund.STATUS_APPROVED
            refund.save(update_fields=['status', 'updated_at'])

            # Update payment status if fully refunded
            total_refunded = sum(
                r.amount for r in payment.refunds.filter(status=Refund.STATUS_APPROVED)
            )
            if total_refunded >= payment.amount:
                payment.status = Payment.STATUS_REFUNDED
                payment.save(update_fields=['status', 'updated_at'])

            AuditLog.log(
                entity=refund,
                action=AuditLog.ACTION_CREATED,
                actor=request.user,
                after_state=RefundSerializer(refund).data,
                request=request
            )

        return Response(
            RefundSerializer(refund).data,
            status=status.HTTP_201_CREATED
        )


class PaymentSummaryView(APIView):
    """
    Get payment summary report.

    GET /api/v1/admin/payments/summary/
    """

    permission_classes = [IsRoleAdmin]

    def get(self, request):
        """Get payment summary."""
        from django.db.models import Sum, Count

        # Get date filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        payments = Payment.objects.filter(status=Payment.STATUS_APPROVED)

        if start_date:
            payments = payments.filter(created_at__gte=start_date)
        if end_date:
            payments = payments.filter(created_at__lte=end_date)

        # Calculate totals
        totals = payments.aggregate(
            total_amount=Sum('amount'),
            total_fees=Sum('fee_amount'),
            total_net=Sum('net_amount'),
            count=Count('id')
        )

        # By provider
        by_provider = {}
        for provider, label in Payment.PROVIDER_CHOICES:
            provider_data = payments.filter(provider=provider).aggregate(
                amount=Sum('amount'),
                count=Count('id')
            )
            by_provider[provider] = {
                'amount': float(provider_data['amount'] or 0),
                'count': provider_data['count'] or 0
            }

        # By status (all payments)
        all_payments = Payment.objects.all()
        if start_date:
            all_payments = all_payments.filter(created_at__gte=start_date)
        if end_date:
            all_payments = all_payments.filter(created_at__lte=end_date)

        by_status = {}
        for status_code, label in Payment.STATUS_CHOICES:
            by_status[status_code] = all_payments.filter(status=status_code).count()

        # By payment method
        by_method = {}
        for payment in payments:
            method = payment.payment_method_type or 'unknown'
            if method not in by_method:
                by_method[method] = {'amount': 0, 'count': 0}
            by_method[method]['amount'] += float(payment.amount)
            by_method[method]['count'] += 1

        # Total refunds
        refunds = Refund.objects.filter(status=Refund.STATUS_APPROVED)
        if start_date:
            refunds = refunds.filter(created_at__gte=start_date)
        if end_date:
            refunds = refunds.filter(created_at__lte=end_date)
        total_refunds = refunds.aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            'total_payments': totals['count'] or 0,
            'total_amount': float(totals['total_amount'] or 0),
            'total_fees': float(totals['total_fees'] or 0),
            'total_net': float(totals['total_net'] or 0),
            'total_refunds': float(total_refunds),
            'by_provider': by_provider,
            'by_status': by_status,
            'by_method': by_method
        })
