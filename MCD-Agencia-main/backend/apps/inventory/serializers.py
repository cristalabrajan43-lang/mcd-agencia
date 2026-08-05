"""
Inventory Serializers for MCD-Agencia.

This module provides serializers for inventory management:
    - Inventory movements
    - Stock alerts
"""

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.catalog.serializers import ProductVariantSerializer
from .models import InventoryMovement, StockAlert


class InventoryMovementSerializer(serializers.ModelSerializer):
    """Serializer for InventoryMovement model."""

    variant = ProductVariantSerializer(read_only=True)
    variant_id = serializers.UUIDField(write_only=True)
    movement_type_display = serializers.CharField(
        source='get_movement_type_display', read_only=True
    )
    reason_display = serializers.CharField(
        source='get_reason_display', read_only=True
    )
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = InventoryMovement
        fields = [
            'id', 'variant', 'variant_id', 'movement_type', 'movement_type_display',
            'quantity', 'reason', 'reason_display', 'reference_type', 'reference_id',
            'notes', 'created_by', 'created_by_name', 'stock_before', 'stock_after',
            'created_at'
        ]
        read_only_fields = [
            'id', 'stock_before', 'stock_after', 'created_by', 'created_at'
        ]

    def get_created_by_name(self, obj):
        """Get creator name."""
        if obj.created_by:
            return obj.created_by.full_name
        return 'System'

    def validate_variant_id(self, value):
        """Validate variant exists."""
        from apps.catalog.models import ProductVariant
        try:
            ProductVariant.objects.get(id=value)
        except ProductVariant.DoesNotExist:
            raise serializers.ValidationError(_('Product variant not found.'))
        return value

    def validate(self, attrs):
        """Validate movement based on type."""
        movement_type = attrs.get('movement_type')
        quantity = attrs.get('quantity', 0)
        reason = attrs.get('reason')

        # Validate reason matches movement type
        in_reasons = ['purchase', 'return', 'production', 'transfer_in']
        out_reasons = ['sale', 'internal_use', 'damaged', 'expired', 'lost', 'transfer_out']
        adjustment_reasons = ['inventory_count', 'correction', 'initial']

        if movement_type == InventoryMovement.MOVEMENT_IN and reason not in in_reasons:
            raise serializers.ValidationError({
                'reason': _('Invalid reason for stock in movement.')
            })
        elif movement_type == InventoryMovement.MOVEMENT_OUT and reason not in out_reasons:
            raise serializers.ValidationError({
                'reason': _('Invalid reason for stock out movement.')
            })
        elif movement_type == InventoryMovement.MOVEMENT_ADJUSTMENT and reason not in adjustment_reasons:
            raise serializers.ValidationError({
                'reason': _('Invalid reason for adjustment movement.')
            })

        # Validate stock out doesn't exceed current stock
        if movement_type == InventoryMovement.MOVEMENT_OUT:
            from apps.catalog.models import ProductVariant
            variant = ProductVariant.objects.get(id=attrs['variant_id'])
            current_stock = variant.stock if variant.stock is not None else 0
            if current_stock < abs(quantity):
                raise serializers.ValidationError({
                    'quantity': _('Insufficient stock. Available: %(stock)s') % {
                        'stock': current_stock
                    }
                })

        return attrs


class CreateMovementSerializer(serializers.Serializer):
    """Simplified serializer for creating movements."""

    variant_id = serializers.UUIDField(required=True)
    movement_type = serializers.ChoiceField(
        choices=InventoryMovement.MOVEMENT_TYPE_CHOICES,
        required=True
    )
    quantity = serializers.IntegerField(min_value=0, required=True)
    reason = serializers.ChoiceField(
        choices=InventoryMovement.REASON_CHOICES,
        required=True
    )
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        movement_type = attrs.get('movement_type')
        quantity = attrs.get('quantity', 0)

        # IN/OUT require strictly positive quantity.
        if movement_type in [InventoryMovement.MOVEMENT_IN, InventoryMovement.MOVEMENT_OUT] and quantity <= 0:
            raise serializers.ValidationError({'quantity': _('Quantity must be greater than 0.')})

        # ADJUSTMENT accepts absolute target stock >= 0.
        if movement_type == InventoryMovement.MOVEMENT_ADJUSTMENT and quantity < 0:
            raise serializers.ValidationError({'quantity': _('Adjusted stock cannot be negative.')})

        return attrs


class StockAlertSerializer(serializers.ModelSerializer):
    """Serializer for StockAlert model."""

    variant = ProductVariantSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    acknowledged_by_name = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = StockAlert
        fields = [
            'id', 'variant', 'product_name', 'threshold', 'current_stock',
            'status', 'status_display', 'acknowledged_by', 'acknowledged_by_name',
            'acknowledged_at', 'resolved_at', 'notification_sent', 'created_at'
        ]
        read_only_fields = [
            'id', 'threshold', 'current_stock', 'acknowledged_at',
            'resolved_at', 'notification_sent', 'created_at'
        ]

    def get_acknowledged_by_name(self, obj):
        """Get acknowledger name."""
        if obj.acknowledged_by:
            return obj.acknowledged_by.full_name
        return None

    def get_product_name(self, obj):
        """Get parent product name."""
        return obj.variant.catalog_item.name


class StockSummarySerializer(serializers.Serializer):
    """Serializer for stock summary report."""

    variant_id = serializers.UUIDField()
    product_id = serializers.UUIDField()
    product_slug = serializers.CharField()
    sku = serializers.CharField()
    product_name = serializers.CharField()
    variant_name = serializers.CharField()
    item_type = serializers.CharField()
    item_type_display = serializers.CharField()
    sale_mode = serializers.CharField()
    sale_mode_display = serializers.CharField()
    cost = serializers.DecimalField(max_digits=12, decimal_places=2)
    sale_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    current_stock = serializers.IntegerField()
    initial_stock = serializers.IntegerField()
    total_in = serializers.IntegerField()
    total_out = serializers.IntegerField()
    low_stock_threshold = serializers.IntegerField()
    is_low_stock = serializers.BooleanField()
    is_out_of_stock = serializers.BooleanField()
    stock_status = serializers.CharField()
    stock_status_display = serializers.CharField()
    last_movement_date = serializers.DateTimeField(allow_null=True)
