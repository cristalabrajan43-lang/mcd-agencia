"""
Payment Serializers for MCD-Agencia.

This module provides serializers for payment operations:
    - Payment transactions
    - Payment creation
    - Refunds
    - Webhook handling
"""

from decimal import Decimal

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import Payment, PaymentWebhookLog, Refund


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for Payment model."""

    provider_display = serializers.CharField(
        source='get_provider_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    is_successful = serializers.BooleanField(read_only=True)
    order_number = serializers.SerializerMethodField()
    quote_number = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id', 'order', 'order_number', 'quote', 'quote_number',
            'provider', 'provider_display', 'status', 'status_display',
            'amount', 'currency', 'fee_amount', 'net_amount',
            'provider_payment_id', 'provider_order_id',
            'payment_method_type', 'payment_method_id',
            'is_successful', 'error_message',
            'created_at', 'approved_at'
        ]
        read_only_fields = [
            'id', 'fee_amount', 'net_amount', 'provider_payment_id',
            'provider_order_id', 'created_at', 'approved_at'
        ]

    def get_order_number(self, obj):
        """Get order number if payment is for an order."""
        if obj.order:
            return obj.order.order_number
        return None

    def get_quote_number(self, obj):
        """Get quote number if payment is for a quote."""
        if obj.quote:
            return obj.quote.quote_number
        return None


class PaymentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for payment lists."""

    provider_display = serializers.CharField(
        source='get_provider_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = Payment
        fields = [
            'id', 'provider', 'provider_display', 'status', 'status_display',
            'amount', 'currency', 'payment_method_type',
            'created_at', 'approved_at'
        ]
        read_only_fields = ['id']


class CreatePaymentSerializer(serializers.Serializer):
    """
    Serializer for initiating a payment.

    Validates:
        - Either order_id or quote_id is provided (not both)
        - Entity (order/quote) exists and belongs to user
        - Entity is in a valid state for payment
        - Amount is valid for the entity
        - Provider is available
    """

    order_id = serializers.UUIDField(required=False)
    quote_id = serializers.UUIDField(required=False)
    provider = serializers.ChoiceField(
        choices=Payment.PROVIDER_CHOICES,
        required=True,
        help_text=_('Payment provider: mercadopago or paypal')
    )
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False,
        help_text=_('Custom amount (for deposits/partial payments)')
    )
    is_deposit = serializers.BooleanField(
        default=False,
        help_text=_('Whether this is a deposit payment')
    )

    # Additional fields for manual payment methods (transfer, cash)
    payment_method = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text=_('Payment method: mercadopago, paypal, bank_transfer, cash')
    )
    transfer_reference = serializers.CharField(
        required=False, allow_blank=True,
        help_text=_('Bank transfer reference (for bank_transfer method)')
    )
    cash_branch_id = serializers.CharField(
        required=False, allow_blank=True,
        help_text=_('Cash payment branch ID')
    )

    def validate(self, attrs):
        """
        Validate payment creation request.

        Checks:
            1. Order or Quote is provided (mutually exclusive)
            2. Entity exists and belongs to authed user
            3. Entity is in valid state for payment
            4. Amount matches entity or is within valid range
        """
        order_id = attrs.get('order_id')
        quote_id = attrs.get('quote_id')
        user = attrs.get('_user')  # Will be set by view

        # Validate either order or quote
        if not order_id and not quote_id:
            raise serializers.ValidationError({
                'error': _('Either order_id or quote_id is required.')
            })

        if order_id and quote_id:
            raise serializers.ValidationError({
                'error': _('Provide either order_id or quote_id, not both.')
            })

        # Validate order exists, belongs to user, and is payable
        if order_id:
            from apps.orders.models import Order
            try:
                order = Order.objects.get(id=order_id)

                # Security: Validate user owns this order
                if user and order.user_id != user.id:
                    raise serializers.ValidationError({
                        'order_id': _('You do not have permission to pay this order.')
                    })

                # Validate order state
                if order.is_fully_paid:
                    raise serializers.ValidationError({
                        'order_id': _('This order is already fully paid.')
                    })

                if order.status in ['cancelled', 'refunded']:
                    raise serializers.ValidationError({
                        'order_id': _('Cannot pay a %(status)s order.') % {
                            'status': order.get_status_display()
                        }
                    })

                # Validate balance due is positive
                if order.balance_due <= 0:
                    raise serializers.ValidationError({
                        'order_id': _('No payment due for this order.')
                    })

                # Validate minimum payment amount
                if not attrs.get('is_deposit') and order.balance_due < Decimal('50.00'):
                    raise serializers.ValidationError({
                        'amount': _('Minimum payment amount is MXN 50.00')
                    })

                attrs['order'] = order
                attrs['entity_amount'] = order.balance_due

            except Order.DoesNotExist:
                raise serializers.ValidationError({
                    'order_id': _('Order not found.')
                })

        # Validate quote exists, belongs to user, and is accepted
        if quote_id:
            from apps.quotes.models import Quote
            try:
                quote = Quote.objects.get(id=quote_id)

                # Security: Validate user owns this quote
                if user and quote.user_id != user.id:
                    raise serializers.ValidationError({
                        'quote_id': _('You do not have permission to pay this quote.')
                    })

                # Validate quote state
                if quote.status != Quote.STATUS_ACCEPTED:
                    raise serializers.ValidationError({
                        'quote_id': _('Quote must be accepted before payment. Current status: %(status)s') % {
                            'status': quote.get_status_display()
                        }
                    })

                # Validate amount
                if quote.total <= 0:
                    raise serializers.ValidationError({
                        'quote_id': _('Quote total is invalid.')
                    })

                # Validate minimum payment amount
                if not attrs.get('is_deposit') and quote.total < Decimal('50.00'):
                    raise serializers.ValidationError({
                        'amount': _('Minimum payment amount is MXN 50.00')
                    })

                attrs['quote'] = quote
                attrs['entity_amount'] = quote.total

            except Quote.DoesNotExist:
                raise serializers.ValidationError({
                    'quote_id': _('Quote not found.')
                })

        # Validate custom amount if provided
        if attrs.get('amount'):
            custom_amount = attrs['amount']
            entity_amount = attrs.get('entity_amount', Decimal('0'))

            if custom_amount <= 0:
                raise serializers.ValidationError({
                    'amount': _('Payment amount must be positive.')
                })

            if custom_amount > entity_amount:
                raise serializers.ValidationError({
                    'amount': _('Payment amount exceeds balance due. Maximum: %(max)s') % {
                        'max': entity_amount
                    }
                })

            if custom_amount < Decimal('50.00') and not attrs.get('is_deposit'):
                raise serializers.ValidationError({
                    'amount': _('Minimum payment amount is MXN 50.00')
                })

        # Validate manual payment methods
        payment_method = attrs.get('payment_method')
        if payment_method == 'bank_transfer':
            if not attrs.get('transfer_reference'):
                raise serializers.ValidationError({
                    'transfer_reference': _('Bank transfer reference is required.')
                })

        if payment_method == 'cash':
            if not attrs.get('cash_branch_id'):
                raise serializers.ValidationError({
                    'cash_branch_id': _('Cash payment branch must be selected.')
                })

        return attrs


class MercadoPagoPreferenceSerializer(serializers.Serializer):
    """Serializer for Mercado Pago preference response."""

    preference_id = serializers.CharField(read_only=True)
    init_point = serializers.URLField(read_only=True)
    sandbox_init_point = serializers.URLField(read_only=True)


class PayPalOrderSerializer(serializers.Serializer):
    """Serializer for PayPal order response."""

    order_id = serializers.CharField(read_only=True)
    approval_url = serializers.URLField(read_only=True)


class RefundSerializer(serializers.ModelSerializer):
    """Serializer for Refund model."""

    reason_display = serializers.CharField(
        source='get_reason_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    is_partial = serializers.BooleanField(read_only=True)
    processed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Refund
        fields = [
            'id', 'payment', 'amount', 'reason', 'reason_display',
            'reason_details', 'status', 'status_display',
            'provider_refund_id', 'is_partial',
            'processed_by', 'processed_by_name', 'processed_at',
            'created_at'
        ]
        read_only_fields = [
            'id', 'provider_refund_id', 'processed_by',
            'processed_at', 'created_at'
        ]

    def get_processed_by_name(self, obj):
        """Get name of user who processed refund."""
        if obj.processed_by:
            return obj.processed_by.full_name
        return None


class CreateRefundSerializer(serializers.Serializer):
    """Serializer for creating a refund."""

    payment_id = serializers.UUIDField(required=True)
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=True
    )
    reason = serializers.ChoiceField(
        choices=Refund.REASON_CHOICES,
        required=True
    )
    reason_details = serializers.CharField(required=False, allow_blank=True)

    def validate_payment_id(self, value):
        """Validate payment exists and is refundable."""
        try:
            payment = Payment.objects.get(id=value)
            if payment.status != Payment.STATUS_APPROVED:
                raise serializers.ValidationError(
                    _('Only approved payments can be refunded.')
                )
            return value
        except Payment.DoesNotExist:
            raise serializers.ValidationError(_('Payment not found.'))

    def validate(self, attrs):
        """Validate refund amount."""
        payment = Payment.objects.get(id=attrs['payment_id'])
        amount = attrs['amount']

        # Calculate already refunded amount
        refunded = sum(
            r.amount for r in payment.refunds.filter(
                status=Refund.STATUS_APPROVED
            )
        )
        available = payment.amount - refunded

        if amount > available:
            raise serializers.ValidationError({
                'amount': _('Refund amount exceeds available amount. Maximum: %(max)s') % {
                    'max': available
                }
            })

        if amount <= 0:
            raise serializers.ValidationError({
                'amount': _('Refund amount must be positive.')
            })

        attrs['payment'] = payment
        return attrs


class PaymentWebhookLogSerializer(serializers.ModelSerializer):
    """Serializer for PaymentWebhookLog model."""

    provider_display = serializers.CharField(
        source='get_provider_display', read_only=True
    )

    class Meta:
        model = PaymentWebhookLog
        fields = [
            'id', 'provider', 'provider_display', 'event_type',
            'event_id', 'payment', 'payload', 'processed',
            'processing_error', 'ip_address', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class PaymentSummarySerializer(serializers.Serializer):
    """Serializer for payment summary report."""

    total_payments = serializers.IntegerField()
    total_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_fees = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_net = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_refunds = serializers.DecimalField(max_digits=14, decimal_places=2)
    by_provider = serializers.DictField()
    by_status = serializers.DictField()
    by_method = serializers.DictField()
