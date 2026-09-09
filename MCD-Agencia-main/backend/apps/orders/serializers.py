"""
Order Serializers for MCD-Agencia.

This module provides serializers for e-commerce operations:
    - Cart and cart items
    - Orders and order lines
    - Addresses
    - Order status management
"""

import re
from datetime import date, datetime
from decimal import Decimal
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.catalog.serializers import ProductVariantSerializer
from .models import (
    Cart,
    CartItem,
    Address,
    Order,
    OrderLine,
    OrderStatusHistory,
    ProductionJob,
    LogisticsJob,
    FieldOperationJob,
)


QUOTE_NUMBER_REGEX = re.compile(r'(COT-\d{8}-\d+)', flags=re.IGNORECASE)


def _extract_quote_number(text: str) -> str:
    match = QUOTE_NUMBER_REGEX.search(str(text or ''))
    if not match:
        return ''
    return match.group(1).upper()


def _resolve_quote_id_for_order(obj) -> str | None:
    if obj.quote_id:
        return str(obj.quote_id)

    candidates = [
        getattr(obj, 'internal_notes', '') or '',
        getattr(obj, 'notes', '') or '',
    ]

    for history in getattr(obj, 'status_history', []).all() if hasattr(getattr(obj, 'status_history', None), 'all') else []:
        candidates.append(getattr(history, 'notes', '') or '')

    for line in getattr(obj, 'lines', []).all() if hasattr(getattr(obj, 'lines', None), 'all') else []:
        candidates.append(getattr(line, 'sku', '') or '')

    quote_number = ''
    for value in candidates:
        quote_number = _extract_quote_number(value)
        if quote_number:
            break

    if not quote_number:
        return None

    from apps.quotes.models import Quote

    quote_id = Quote.objects.filter(quote_number=quote_number).values_list('id', flat=True).first()
    if quote_id:
        return str(quote_id)
    return None


class CartItemSerializer(serializers.ModelSerializer):
    """Serializer for CartItem model."""

    variant = ProductVariantSerializer(read_only=True)
    variant_id = serializers.UUIDField(write_only=True)
    unit_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    line_total = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    product_name = serializers.SerializerMethodField()
    product_slug = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    variant_display_name = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            'id', 'variant', 'variant_id', 'quantity',
            'unit_price', 'line_total', 'product_name',
            'product_slug', 'product_image', 'variant_display_name'
        ]
        read_only_fields = ['id', 'unit_price', 'line_total']

    def get_product_name(self, obj):
        """Get parent product name."""
        return obj.variant.catalog_item.name

    def get_product_slug(self, obj):
        """Get parent product slug."""
        return obj.variant.catalog_item.slug

    def get_product_image(self, obj):
        """Get catalog item's primary image URL (or first available image)."""
        catalog_item = obj.variant.catalog_item
        primary = catalog_item.images.filter(is_primary=True).first()
        image_obj = primary or catalog_item.images.filter(image__isnull=False).first()

        if not image_obj or not image_obj.image:
            return None

        try:
            image_url = image_obj.image.url
        except Exception:
            return None

        request = self.context.get('request') if hasattr(self, 'context') else None
        if request:
            return request.build_absolute_uri(image_url)
        return image_url

    def get_variant_display_name(self, obj):
        """Friendly variant label for UI."""
        name = (obj.variant.name or '').strip()
        if name.lower() == 'default' or not name:
            return 'Base'
        return name

    def validate_variant_id(self, value):
        """Validate variant exists and is active."""
        from apps.catalog.models import ProductVariant
        from apps.core.permissions import is_role_staff_user
        try:
            variant = ProductVariant.objects.select_related('catalog_item').get(id=value, is_active=True)
        except ProductVariant.DoesNotExist:
            raise serializers.ValidationError(_('Product variant not found.'))
        if variant.catalog_item.vendor_id:
            user = getattr(self.context.get('request'), 'user', None)
            if not is_role_staff_user(user):
                raise serializers.ValidationError(_('This product is only available to the agency.'))
        return value

    def validate_quantity(self, value):
        """Validate quantity is positive."""
        if value < 1:
            raise serializers.ValidationError(_('Quantity must be at least 1.'))
        return value

    def validate(self, attrs):
        """Validate stock availability."""
        from apps.catalog.models import ProductVariant
        variant_id = attrs.get('variant_id')
        quantity = attrs.get('quantity', 1)

        if variant_id:
            variant = ProductVariant.objects.get(id=variant_id)
            if variant.catalog_item.track_inventory and variant.stock < quantity:
                raise serializers.ValidationError({
                    'quantity': _('Only %(stock)s items available.') % {'stock': variant.stock}
                })

        return attrs


class CartSerializer(serializers.ModelSerializer):
    """Serializer for Cart model."""

    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    tax_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    total = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    item_count = serializers.IntegerField(read_only=True)
    tax_rate = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = [
            'id', 'items', 'subtotal', 'tax_rate', 'tax_amount',
            'total', 'item_count', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']

    def get_tax_rate(self, obj):
        """Get tax rate as percentage."""
        return f"{settings.TAX_RATE * 100:.0f}%"


class AddToCartSerializer(serializers.Serializer):
    """Serializer for adding items to cart."""

    variant_id = serializers.UUIDField(required=True)
    quantity = serializers.IntegerField(min_value=1, default=1)

    def validate_variant_id(self, value):
        """Validate variant exists and is purchasable."""
        from apps.catalog.models import ProductVariant
        try:
            variant = ProductVariant.objects.select_related('catalog_item').get(
                id=value, is_active=True
            )
            if variant.catalog_item.sale_mode == 'QUOTE':
                raise serializers.ValidationError(
                    _('This item requires a quote request.')
                )
            if variant.catalog_item.vendor_id:
                from apps.core.permissions import is_role_staff_user
                user = getattr(self.context.get('request'), 'user', None)
                if not is_role_staff_user(user):
                    raise serializers.ValidationError(
                        _('This product is only available to the agency.')
                    )
        except ProductVariant.DoesNotExist:
            raise serializers.ValidationError(_('Product variant not found.'))
        return value


class AddressSerializer(serializers.ModelSerializer):
    """Serializer for Address model."""

    full_address = serializers.CharField(read_only=True)

    class Meta:
        model = Address
        fields = [
            'id', 'type', 'is_default', 'name', 'phone',
            'street', 'exterior_number', 'interior_number',
            'neighborhood', 'city', 'state', 'postal_code',
            'country', 'reference', 'full_address'
        ]
        read_only_fields = ['id']

    def validate_postal_code(self, value):
        """Validate postal code format."""
        if not value.isdigit() or len(value) != 5:
            raise serializers.ValidationError(_('Postal code must be 5 digits.'))
        return value


class OrderLineSerializer(serializers.ModelSerializer):
    """Serializer for OrderLine model."""

    metadata = serializers.SerializerMethodField()
    estimated_delivery_date = serializers.SerializerMethodField()

    class Meta:
        model = OrderLine
        fields = [
            'id', 'sku', 'name', 'variant_name', 'quantity',
            'unit_price', 'line_total', 'metadata', 'estimated_delivery_date'
        ]
        read_only_fields = ['id']

    def get_metadata(self, obj):
        """Convert metadata JSONField to serializable format."""
        meta = obj.metadata
        if not meta or not isinstance(meta, dict):
            return None
        # Return as-is if it has content, otherwise None
        return meta if meta else None

    def get_estimated_delivery_date(self, obj):
        """Return seller estimated delivery date (YYYY-MM-DD) with legacy fallbacks."""
        meta = obj.metadata if isinstance(obj.metadata, dict) else {}

        # Primary source for new orders/edits.
        raw_date = meta.get('estimated_delivery_date') or meta.get('fecha_entrega_estimada')

        # Legacy fallback: recover from original quote line when not persisted in order metadata.
        if not raw_date:
            quote_line_id = meta.get('quote_line_id')
            quote = getattr(getattr(obj, 'order', None), 'quote', None)
            if quote and quote_line_id:
                raw_date = quote.lines.filter(id=quote_line_id).values_list('estimated_delivery_date', flat=True).first()

        # Last fallback: operation snapshot mirror.
        if not raw_date:
            snapshot = getattr(getattr(obj, 'order', None), 'service_snapshot', None) or []
            if isinstance(snapshot, list):
                for item in snapshot:
                    if isinstance(item, dict) and str(item.get('line_id')) == str(obj.id):
                        raw_date = item.get('estimated_date') or (item.get('metadata') or {}).get('estimated_delivery_date')
                        if raw_date:
                            break

        # Operational fallback: recover from generated jobs for this line.
        if not raw_date:
            order = getattr(obj, 'order', None)
            if order:
                raw_date = (
                    order.production_jobs
                    .filter(order_line=obj)
                    .exclude(planned_end__isnull=True)
                    .values_list('planned_end', flat=True)
                    .first()
                )
                if not raw_date:
                    raw_date = (
                        order.logistics_jobs
                        .filter(metadata__line_id=str(obj.id))
                        .exclude(window_end__isnull=True)
                        .values_list('window_end', flat=True)
                        .first()
                    )
                if not raw_date:
                    raw_date = (
                        order.field_ops_jobs
                        .filter(metadata__line_id=str(obj.id))
                        .exclude(scheduled_start__isnull=True)
                        .values_list('scheduled_start', flat=True)
                        .first()
                    )

        # Global scheduled fallback for legacy single-line orders.
        if not raw_date:
            raw_date = getattr(getattr(obj, 'order', None), 'scheduled_date', None)

        if not raw_date:
            return None

        if isinstance(raw_date, date):
            return raw_date.isoformat()

        text = str(raw_date).strip()
        if not text:
            return None

        # Fast-path for common serialized datetime/date shapes.
        candidate = text.split('T')[0].split(' ')[0]
        if re.match(r'^\d{4}-\d{2}-\d{2}$', candidate):
            return candidate

        # Parse broader datetime formats (e.g. with timezone offsets).
        try:
            parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
            return parsed.date().isoformat()
        except ValueError:
            return None


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    """Serializer for OrderStatusHistory model."""

    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderStatusHistory
        fields = [
            'id', 'from_status', 'to_status', 'changed_by',
            'changed_by_name', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_changed_by_name(self, obj):
        """Get name of user who changed status."""
        if obj.changed_by:
            return obj.changed_by.full_name
        return 'System'


class OrderSerializer(serializers.ModelSerializer):
    """Serializer for Order model."""

    lines = OrderLineSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    balance_due = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    is_fully_paid = serializers.BooleanField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    customer = serializers.SerializerMethodField()
    pickup_branch_detail = serializers.SerializerMethodField()
    quote = serializers.SerializerMethodField()
    operational_rollup_display = serializers.CharField(source='get_operational_rollup_display', read_only=True)
    shipping_address = serializers.SerializerMethodField()
    billing_address = serializers.SerializerMethodField()
    delivery_address = serializers.SerializerMethodField()
    operation_plan = serializers.SerializerMethodField()
    service_snapshot = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'status', 'status_display',
            'quote',
            'customer',
            'shipping_address', 'billing_address',
            'subtotal', 'tax_rate', 'tax_amount', 'total',
            'amount_paid', 'balance_due', 'is_fully_paid',
            'currency', 'payment_method', 'notes',
            'tracking_number', 'tracking_url',
            'delivery_method', 'pickup_branch', 'pickup_branch_detail',
            'delivery_address',
            'scheduled_date',
            'origin', 'operational_rollup', 'operational_rollup_display', 'operation_plan', 'service_snapshot',
            'lines', 'status_history',
            'created_at', 'paid_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'order_number', 'status', 'subtotal', 'tax_rate',
            'tax_amount', 'total', 'amount_paid', 'paid_at', 'completed_at',
            'created_at'
        ]

    def get_customer(self, obj):
        """Get customer info."""
        if obj.user:
            return {
                'id': str(obj.user.id),
                'email': obj.user.email,
                'full_name': obj.user.full_name or obj.user.email,
            }
        return None

    def get_quote(self, obj):
        """Return source quote UUID if available."""
        return _resolve_quote_id_for_order(obj)

    def get_pickup_branch_detail(self, obj):
        """Return branch name and address for display."""
        if obj.pickup_branch:
            branch = obj.pickup_branch
            return {
                'id': str(branch.id),
                'name': branch.name,
                'city': branch.city,
                'state': branch.state,
                'full_address': getattr(branch, 'full_address', ''),
            }
        return None

    def get_shipping_address(self, obj):
        """Convert shipping_address JSONField to formatted string."""
        addr = obj.shipping_address
        if not addr or not isinstance(addr, dict):
            return ''
        parts = [
            addr.get('street') or addr.get('calle'),
            addr.get('exterior_number') or addr.get('numero_exterior'),
            addr.get('neighborhood') or addr.get('colonia'),
            addr.get('city') or addr.get('ciudad'),
            addr.get('state') or addr.get('estado'),
            addr.get('postal_code') or addr.get('codigo_postal'),
        ]
        return ', '.join(str(p) for p in parts if p)

    def get_billing_address(self, obj):
        """Convert billing_address JSONField to formatted string."""
        addr = obj.billing_address
        if not addr or not isinstance(addr, dict):
            return ''
        parts = [
            addr.get('street') or addr.get('calle'),
            addr.get('exterior_number') or addr.get('numero_exterior'),
            addr.get('neighborhood') or addr.get('colonia'),
            addr.get('city') or addr.get('ciudad'),
            addr.get('state') or addr.get('estado'),
            addr.get('postal_code') or addr.get('codigo_postal'),
        ]
        return ', '.join(str(p) for p in parts if p)

    def get_delivery_address(self, obj):
        """Convert delivery_address JSONField to formatted string or None."""
        addr = obj.delivery_address
        if not addr or not isinstance(addr, dict) or not addr:
            return None
        # Return the dict only if it has content
        return addr

    def get_operation_plan(self, obj):
        """Convert operation_plan JSONField to serializable format or None."""
        plan = obj.operation_plan
        if not plan or not isinstance(plan, dict) or not plan:
            return None
        # Return the dict only if it has content
        return plan

    def get_service_snapshot(self, obj):
        """Convert service_snapshot JSONField to serializable format or None."""
        snapshot = obj.service_snapshot
        if not snapshot or not isinstance(snapshot, list) or not snapshot:
            return None
        # Return the list only if it has content
        return snapshot


class OrderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for order lists."""

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    item_count = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    payment_method_display = serializers.CharField(
        source='get_payment_method_display', read_only=True
    )
    quote = serializers.SerializerMethodField()
    operational_rollup_display = serializers.CharField(source='get_operational_rollup_display', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'status', 'status_display',
            'quote',
            'origin', 'operational_rollup', 'operational_rollup_display',
            'total', 'amount_paid', 'currency', 'payment_method',
            'payment_method_display', 'item_count', 'customer',
            'created_at'
        ]
        read_only_fields = ['id', 'order_number']

    def get_item_count(self, obj):
        """Get total number of items in order."""
        return sum(line.quantity for line in obj.lines.all())

    def get_customer(self, obj):
        """Get customer info."""
        if obj.user:
            return {
                'id': str(obj.user.id),
                'email': obj.user.email,
                'full_name': obj.user.full_name or obj.user.email,
            }
        return None

    def get_quote(self, obj):
        """Return source quote UUID if available."""
        return _resolve_quote_id_for_order(obj)


class CreateOrderSerializer(serializers.Serializer):
    """Serializer for creating an order from cart."""

    shipping_address_id = serializers.UUIDField(required=True)
    billing_address_id = serializers.UUIDField(required=False)
    use_shipping_as_billing = serializers.BooleanField(default=True)
    payment_method = serializers.ChoiceField(
        choices=Order.PAYMENT_METHOD_CHOICES,
        required=True
    )
    delivery_method = serializers.ChoiceField(
        choices=[Order.DELIVERY_PICKUP, Order.DELIVERY_SHIPPING],
        required=False,
        default=Order.DELIVERY_SHIPPING,
    )
    pickup_branch_id = serializers.UUIDField(required=False, allow_null=True)
    shipping_fee = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        default=0,
        min_value=0,
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    terms_accepted = serializers.BooleanField(required=True)

    def validate_shipping_address_id(self, value):
        """Validate shipping address belongs to user."""
        user = self.context['request'].user
        if not Address.objects.filter(id=value, user=user).exists():
            raise serializers.ValidationError(_('Invalid shipping address.'))
        return value

    def validate_billing_address_id(self, value):
        """Validate billing address belongs to user."""
        if value:
            user = self.context['request'].user
            if not Address.objects.filter(id=value, user=user).exists():
                raise serializers.ValidationError(_('Invalid billing address.'))
        return value

    def validate_terms_accepted(self, value):
        """Ensure terms are accepted."""
        if not value:
            raise serializers.ValidationError(_('You must accept the terms.'))
        return value

    def validate(self, attrs):
        """Validate cart, billing behavior, and delivery constraints."""
        user = self.context['request'].user
        try:
            cart = Cart.objects.get(user=user)
            if not cart.items.exists():
                raise serializers.ValidationError(_('Your cart is empty.'))
        except Cart.DoesNotExist:
            raise serializers.ValidationError(_('Your cart is empty.'))

        # Use shipping as billing if specified
        if attrs.get('use_shipping_as_billing'):
            attrs['billing_address_id'] = attrs['shipping_address_id']

        delivery_method = attrs.get('delivery_method', Order.DELIVERY_SHIPPING)
        pickup_branch_id = attrs.get('pickup_branch_id')

        if delivery_method == Order.DELIVERY_PICKUP:
            if not pickup_branch_id:
                raise serializers.ValidationError({'pickup_branch_id': _('Pickup branch is required for pickup delivery.')})

            from apps.content.models import Branch

            if not Branch.objects.filter(id=pickup_branch_id, is_active=True).exists():
                raise serializers.ValidationError({'pickup_branch_id': _('Invalid pickup branch.')})

        return attrs


class ProductionJobSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    metadata = serializers.SerializerMethodField()
    order_id = serializers.SerializerMethodField()
    order_number = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    variant_name = serializers.SerializerMethodField()
    quantity = serializers.SerializerMethodField()
    delivery_method = serializers.SerializerMethodField()
    estimated_delivery_date = serializers.SerializerMethodField()

    class Meta:
        model = ProductionJob
        fields = [
            'id', 'order_id', 'order_number', 'customer', 'product_name', 'variant_name', 'quantity',
            'order_line', 'status', 'status_display',
            'planned_start', 'planned_end', 'actual_start', 'actual_end',
            'requires_quality_check', 'delivery_method', 'estimated_delivery_date',
            'metadata', 'created_at', 'updated_at',
        ]

    def get_order_id(self, obj):
        return str(obj.order_id)

    def get_order_number(self, obj):
        return obj.order.order_number if obj.order else ''

    def get_customer(self, obj):
        user = getattr(obj.order, 'user', None)
        if not user:
            return None
        return {
            'id': str(user.id),
            'full_name': user.full_name or user.email,
            'email': user.email,
        }

    def get_product_name(self, obj):
        if obj.order_line:
            return obj.order_line.name
        return (obj.metadata or {}).get('product_name') or ''

    def get_variant_name(self, obj):
        if obj.order_line:
            return obj.order_line.variant_name or ''
        return (obj.metadata or {}).get('variant_name') or ''

    def get_quantity(self, obj):
        if obj.order_line:
            return obj.order_line.quantity
        return (obj.metadata or {}).get('quantity')

    def get_delivery_method(self, obj):
        return obj.order.delivery_method if obj.order else ''

    def get_estimated_delivery_date(self, obj):
        if obj.planned_end:
            return obj.planned_end.isoformat()
        if obj.order_line:
            meta = obj.order_line.metadata if isinstance(obj.order_line.metadata, dict) else {}
            raw_date = meta.get('estimated_delivery_date') or meta.get('fecha_entrega_estimada')
            if raw_date:
                return str(raw_date)
        return (obj.metadata or {}).get('estimated_delivery_date') or None

    def get_metadata(self, obj):
        """Convert metadata JSONField to serializable format or None."""
        meta = obj.metadata
        if not meta or not isinstance(meta, dict) or not meta:
            return None
        return meta


class LogisticsJobSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    logistics_type_display = serializers.CharField(source='get_logistics_type_display', read_only=True)
    address_snapshot = serializers.SerializerMethodField()
    metadata = serializers.SerializerMethodField()
    order_id = serializers.SerializerMethodField()
    order_number = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    delivery_method = serializers.SerializerMethodField()
    delivery_method_display = serializers.SerializerMethodField()
    tracking_number = serializers.SerializerMethodField()
    pickup_branch_detail = serializers.SerializerMethodField()
    shipping_address = serializers.SerializerMethodField()
    scheduled_date = serializers.SerializerMethodField()
    scheduled_start = serializers.SerializerMethodField()
    scheduled_end = serializers.SerializerMethodField()

    class Meta:
        model = LogisticsJob
        fields = [
            'id', 'order_id', 'order_number', 'customer',
            'status', 'status_display',
            'logistics_type', 'logistics_type_display',
            'delivery_method', 'delivery_method_display',
            'tracking_number', 'pickup_branch_detail', 'shipping_address',
            'window_start', 'window_end', 'scheduled_start', 'scheduled_end', 'scheduled_date', 'delivered_at',
            'address_snapshot', 'metadata', 'created_at', 'updated_at',
        ]

    def get_order_id(self, obj):
        return str(obj.order_id)

    def get_order_number(self, obj):
        return obj.order.order_number if obj.order else ''

    def get_customer(self, obj):
        user = getattr(obj.order, 'user', None)
        if not user:
            return None
        return {
            'id': str(user.id),
            'full_name': user.full_name or user.email,
            'email': user.email,
        }

    def get_delivery_method(self, obj):
        return obj.order.delivery_method if obj.order else ''

    def get_delivery_method_display(self, obj):
        order = getattr(obj, 'order', None)
        if not order:
            return ''
        return order.get_delivery_method_display() if hasattr(order, 'get_delivery_method_display') else (order.delivery_method or '')

    def get_tracking_number(self, obj):
        return obj.order.tracking_number if obj.order else ''

    def get_pickup_branch_detail(self, obj):
        order = getattr(obj, 'order', None)
        if not order or not order.pickup_branch:
            return None
        branch = order.pickup_branch
        return {
            'id': str(branch.id),
            'name': branch.name,
            'city': branch.city,
            'state': branch.state,
            'full_address': getattr(branch, 'full_address', ''),
        }

    def get_shipping_address(self, obj):
        order = getattr(obj, 'order', None)
        if not order or not isinstance(order.delivery_address, dict):
            return None
        addr = order.delivery_address
        return {
            'street': addr.get('street') or addr.get('calle') or '',
            'exterior_number': addr.get('exterior_number') or addr.get('numero_exterior') or '',
            'interior_number': addr.get('interior_number') or addr.get('numero_interior') or '',
            'neighborhood': addr.get('neighborhood') or addr.get('colonia') or '',
            'city': addr.get('city') or addr.get('ciudad') or '',
            'state': addr.get('state') or addr.get('estado') or '',
            'postal_code': addr.get('postal_code') or addr.get('codigo_postal') or '',
            'reference': addr.get('reference') or addr.get('referencia') or '',
        }

    def get_scheduled_date(self, obj):
        if obj.window_start:
            return obj.window_start.isoformat()
        order = getattr(obj, 'order', None)
        if order and order.scheduled_date:
            return order.scheduled_date.isoformat()
        return None

    def get_scheduled_start(self, obj):
        """Alias for window_start for frontend compatibility."""
        if obj.window_start:
            return obj.window_start.isoformat()
        return None

    def get_scheduled_end(self, obj):
        """Alias for window_end for frontend compatibility."""
        if obj.window_end:
            return obj.window_end.isoformat()
        return None

    def get_address_snapshot(self, obj):
        """Convert address_snapshot JSONField to serializable format or None."""
        addr = obj.address_snapshot
        if not addr or not isinstance(addr, dict) or not addr:
            return None
        return addr

    def get_metadata(self, obj):
        """Convert metadata JSONField to serializable format or None."""
        meta = obj.metadata
        if not meta or not isinstance(meta, dict) or not meta:
            return None
        return meta


class FieldOperationJobSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    operation_type_display = serializers.CharField(source='get_operation_type_display', read_only=True)
    location_snapshot = serializers.SerializerMethodField()
    metadata = serializers.SerializerMethodField()
    order_id = serializers.SerializerMethodField()
    order_number = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()

    class Meta:
        model = FieldOperationJob
        fields = [
            'id', 'order_id', 'order_number', 'customer',
            'status', 'status_display',
            'operation_type', 'operation_type_display',
            'scheduled_start', 'scheduled_end', 'actual_start', 'actual_end',
            'location_snapshot', 'metadata', 'created_at', 'updated_at',
        ]

    def get_order_id(self, obj):
        return str(obj.order_id)

    def get_order_number(self, obj):
        return obj.order.order_number if obj.order else ''

    def get_customer(self, obj):
        user = getattr(obj.order, 'user', None) if obj.order else None
        if not user:
            return None
        return {
            'id': str(user.id),
            'full_name': user.full_name or user.email,
            'email': user.email,
        }

    def get_location_snapshot(self, obj):
        """Convert location_snapshot JSONField to serializable format or None."""
        loc = obj.location_snapshot
        if not loc or not isinstance(loc, dict) or not loc:
            return None
        return loc

    def get_metadata(self, obj):
        """Convert metadata JSONField to serializable format or None."""
        meta = obj.metadata
        if not meta or not isinstance(meta, dict) or not meta:
            return None
        return meta


class UpdateOrderStatusSerializer(serializers.Serializer):
    """Serializer for updating order status (admin)."""

    status = serializers.ChoiceField(choices=Order.STATUS_CHOICES, required=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    scheduled_date = serializers.DateTimeField(required=False, allow_null=True)

    @staticmethod
    def _normalize_payment_method(value: str | None) -> str:
        raw = str(value or '').strip().lower()
        aliases = {
            'mercado_pago': 'mercadopago',
            'mercado pago': 'mercadopago',
            'paypal': 'paypal',
            'bank_transfer': 'bank_transfer',
            'bank transfer': 'bank_transfer',
            'transferencia': 'bank_transfer',
            'transfer': 'bank_transfer',
            'cash': 'cash',
            'efectivo': 'cash',
        }
        return aliases.get(raw, raw)

    def validate_status(self, value):
        """Validate status transition is allowed."""
        order = self.context.get('order')
        payment_method = self._normalize_payment_method(getattr(order, 'payment_method', '')) if order else ''
        is_online = payment_method in {'mercadopago', 'paypal'}
        if (
            order
            and order.status == Order.STATUS_PENDING_PAYMENT
            and value == Order.STATUS_IN_PRODUCTION
            and (is_online or order.is_fully_paid)
        ):
            return value
        if order and not order.can_transition_to(value):
            raise serializers.ValidationError(
                _('Cannot transition from %(from)s to %(to)s.') % {
                    'from': order.status,
                    'to': value
                }
            )
        return value


class UpdateProductionJobStatusSerializer(serializers.Serializer):
    """Serializer for production job status updates."""

    ALLOWED_TRANSITIONS = {
        ProductionJob.STATUS_QUEUED: {ProductionJob.STATUS_PREPARING, ProductionJob.STATUS_BLOCKED, ProductionJob.STATUS_CANCELLED},
        ProductionJob.STATUS_PREPARING: {ProductionJob.STATUS_IN_PRODUCTION, ProductionJob.STATUS_BLOCKED, ProductionJob.STATUS_CANCELLED},
        ProductionJob.STATUS_IN_PRODUCTION: {ProductionJob.STATUS_QUALITY_CHECK, ProductionJob.STATUS_BLOCKED, ProductionJob.STATUS_CANCELLED},
        ProductionJob.STATUS_QUALITY_CHECK: {ProductionJob.STATUS_RELEASED, ProductionJob.STATUS_BLOCKED, ProductionJob.STATUS_CANCELLED},
        ProductionJob.STATUS_RELEASED: set(),
        ProductionJob.STATUS_BLOCKED: {ProductionJob.STATUS_PREPARING, ProductionJob.STATUS_IN_PRODUCTION, ProductionJob.STATUS_CANCELLED},
        ProductionJob.STATUS_CANCELLED: set(),
    }

    status = serializers.ChoiceField(choices=ProductionJob.STATUS_CHOICES, required=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_status(self, value):
        job = self.context.get('job')
        if not job:
            return value
        allowed = self.ALLOWED_TRANSITIONS.get(job.status, set())
        if value not in allowed:
            raise serializers.ValidationError(
                _('Cannot transition production job from %(from)s to %(to)s.') % {
                    'from': job.status,
                    'to': value,
                }
            )
        return value


class UpdateLogisticsJobStatusSerializer(serializers.Serializer):
    """Serializer for logistics job status updates."""

    ALLOWED_TRANSITIONS = {
        LogisticsJob.STATUS_PENDING_DISPATCH: {LogisticsJob.STATUS_SCHEDULED, LogisticsJob.STATUS_CANCELLED},
        LogisticsJob.STATUS_SCHEDULED: {LogisticsJob.STATUS_IN_TRANSIT, LogisticsJob.STATUS_READY_FOR_PICKUP, LogisticsJob.STATUS_CANCELLED},
        LogisticsJob.STATUS_IN_TRANSIT: {LogisticsJob.STATUS_DELIVERED, LogisticsJob.STATUS_DELIVERY_FAILED, LogisticsJob.STATUS_CANCELLED},
        LogisticsJob.STATUS_READY_FOR_PICKUP: {LogisticsJob.STATUS_DELIVERED, LogisticsJob.STATUS_DELIVERY_FAILED, LogisticsJob.STATUS_CANCELLED},
        LogisticsJob.STATUS_DELIVERED: set(),
        LogisticsJob.STATUS_DELIVERY_FAILED: {LogisticsJob.STATUS_SCHEDULED, LogisticsJob.STATUS_CANCELLED},
        LogisticsJob.STATUS_CANCELLED: set(),
    }

    status = serializers.ChoiceField(choices=LogisticsJob.STATUS_CHOICES, required=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_status(self, value):
        job = self.context.get('job')
        if not job:
            return value
        allowed = self.ALLOWED_TRANSITIONS.get(job.status, set())
        if value not in allowed:
            raise serializers.ValidationError(
                _('Cannot transition logistics job from %(from)s to %(to)s.') % {
                    'from': job.status,
                    'to': value,
                }
            )
        return value


class UpdateFieldOperationJobStatusSerializer(serializers.Serializer):
    """Serializer for field operation job status updates."""

    ALLOWED_TRANSITIONS = {
        FieldOperationJob.STATUS_SCHEDULED: {FieldOperationJob.STATUS_CREW_ASSIGNED, FieldOperationJob.STATUS_CANCELLED},
        FieldOperationJob.STATUS_CREW_ASSIGNED: {FieldOperationJob.STATUS_IN_PROGRESS, FieldOperationJob.STATUS_PAUSED, FieldOperationJob.STATUS_CANCELLED},
        FieldOperationJob.STATUS_IN_PROGRESS: {FieldOperationJob.STATUS_COMPLETED, FieldOperationJob.STATUS_PAUSED, FieldOperationJob.STATUS_REQUIRES_REVISIT, FieldOperationJob.STATUS_CANCELLED},
        FieldOperationJob.STATUS_PAUSED: {FieldOperationJob.STATUS_IN_PROGRESS, FieldOperationJob.STATUS_CANCELLED},
        FieldOperationJob.STATUS_REQUIRES_REVISIT: {FieldOperationJob.STATUS_CREW_ASSIGNED, FieldOperationJob.STATUS_IN_PROGRESS, FieldOperationJob.STATUS_CANCELLED},
        FieldOperationJob.STATUS_COMPLETED: set(),
        FieldOperationJob.STATUS_CANCELLED: set(),
    }

    status = serializers.ChoiceField(choices=FieldOperationJob.STATUS_CHOICES, required=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_status(self, value):
        job = self.context.get('job')
        if not job:
            return value
        allowed = self.ALLOWED_TRANSITIONS.get(job.status, set())
        if value not in allowed:
            raise serializers.ValidationError(
                _('Cannot transition field operation job from %(from)s to %(to)s.') % {
                    'from': job.status,
                    'to': value,
                }
            )
        return value


class OrderTrackingUpdateSerializer(serializers.Serializer):
    """Serializer for staff tracking updates visible to customers."""

    tracking_number = serializers.CharField(required=False, allow_blank=True)
    tracking_url = serializers.CharField(required=False, allow_blank=True)
    title = serializers.CharField(required=False, allow_blank=True, max_length=200)
    message = serializers.CharField(required=False, allow_blank=True)
