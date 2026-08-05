"""
Inventory Views for MCD-Agencia.

This module provides ViewSets for inventory operations:
    - Inventory movements
    - Stock alerts
    - Stock reports
"""

from django.db import transaction
from django.db.models import (
    Case,
    F,
    IntegerField,
    Max,
    OuterRef,
    Q,
    Subquery,
    Sum,
    When,
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from apps.audit.models import AuditLog
from apps.catalog.models import ProductVariant
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsRoleAdmin, IsRoleStaff
from .models import InventoryMovement, StockAlert
from .serializers import (
    InventoryMovementSerializer,
    CreateMovementSerializer,
    StockAlertSerializer,
    StockSummarySerializer,
)


class InventoryMovementViewSet(viewsets.ModelViewSet):
    """
    ViewSet for inventory movement management.

    GET /api/v1/inventory/movements/
    POST /api/v1/inventory/movements/
    GET /api/v1/inventory/movements/{id}/
    """

    queryset = InventoryMovement.objects.select_related(
        'variant__catalog_item', 'created_by'
    )
    serializer_class = InventoryMovementSerializer
    permission_classes = [IsRoleStaff]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['movement_type', 'reason', 'variant']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if self.action == 'create':
            return CreateMovementSerializer
        return InventoryMovementSerializer

    def create(self, request, *args, **kwargs):
        """Create inventory movement."""
        serializer = CreateMovementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            variant = ProductVariant.objects.select_for_update().get(
                id=serializer.validated_data['variant_id']
            )

            movement_type = serializer.validated_data['movement_type']
            quantity = serializer.validated_data['quantity']
            reason = serializer.validated_data['reason']

            stock_before = variant.stock if variant.stock is not None else 0

            # Validate stock-out against current stock
            if movement_type == InventoryMovement.MOVEMENT_OUT and stock_before < quantity:
                return Response(
                    {'error': _('Insufficient stock.')},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # For adjustments, API quantity is the target absolute stock.
            # Convert to delta because InventoryMovement stores adjustments as deltas.
            movement_quantity = quantity
            if movement_type == InventoryMovement.MOVEMENT_ADJUSTMENT:
                movement_quantity = quantity - stock_before

            # Create movement record
            movement = InventoryMovement.objects.create(
                variant=variant,
                movement_type=movement_type,
                quantity=movement_quantity,
                reason=reason,
                notes=serializer.validated_data.get('notes', ''),
                created_by=request.user
            )

            # Stock is updated by InventoryMovement.save(); refresh variant state
            variant.refresh_from_db(fields=['stock'])

            # Check for low stock alert
            if variant.stock <= variant.low_stock_threshold:
                StockAlert.objects.get_or_create(
                    variant=variant,
                    status=StockAlert.STATUS_ACTIVE,
                    defaults={
                        'threshold': variant.low_stock_threshold,
                        'current_stock': variant.stock
                    }
                )
            else:
                # Resolve any active alerts
                StockAlert.objects.filter(
                    variant=variant,
                    status=StockAlert.STATUS_ACTIVE
                ).update(
                    status=StockAlert.STATUS_RESOLVED,
                    resolved_at=timezone.now()
                )

            AuditLog.log(
                entity=movement,
                action=AuditLog.ACTION_CREATED,
                actor=request.user,
                after_state=InventoryMovementSerializer(movement).data,
                request=request
            )

        return Response(
            InventoryMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['get'])
    def by_variant(self, request):
        """Get movements for a specific variant."""
        variant_id = request.query_params.get('variant_id')
        if not variant_id:
            return Response(
                {'error': _('variant_id is required.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        movements = self.queryset.filter(variant_id=variant_id)
        page = self.paginate_queryset(movements)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(movements, many=True)
        return Response(serializer.data)


class StockAlertViewSet(viewsets.ModelViewSet):
    """
    ViewSet for stock alert management.

    GET /api/v1/inventory/alerts/
    GET /api/v1/inventory/alerts/{id}/
    POST /api/v1/inventory/alerts/{id}/acknowledge/
    POST /api/v1/inventory/alerts/{id}/resolve/
    """

    queryset = StockAlert.objects.select_related(
        'variant__catalog_item', 'acknowledged_by'
    )
    serializer_class = StockAlertSerializer
    permission_classes = [IsRoleStaff]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']
    ordering = ['-created_at']

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge a stock alert."""
        alert = self.get_object()

        if alert.status != StockAlert.STATUS_ACTIVE:
            return Response(
                {'error': _('Only active alerts can be acknowledged.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        alert.status = StockAlert.STATUS_ACKNOWLEDGED
        alert.acknowledged_by = request.user
        alert.acknowledged_at = timezone.now()
        alert.save(update_fields=[
            'status', 'acknowledged_by', 'acknowledged_at', 'updated_at'
        ])

        return Response(StockAlertSerializer(alert).data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Resolve a stock alert."""
        alert = self.get_object()

        if alert.status == StockAlert.STATUS_RESOLVED:
            return Response(
                {'error': _('Alert is already resolved.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        alert.status = StockAlert.STATUS_RESOLVED
        alert.resolved_at = timezone.now()
        alert.save(update_fields=['status', 'resolved_at', 'updated_at'])

        return Response(StockAlertSerializer(alert).data)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active alerts."""
        alerts = self.queryset.filter(status=StockAlert.STATUS_ACTIVE)
        serializer = self.get_serializer(alerts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def count(self, request):
        """Get count of alerts by status."""
        counts = {
            'active': self.queryset.filter(
                status=StockAlert.STATUS_ACTIVE
            ).count(),
            'acknowledged': self.queryset.filter(
                status=StockAlert.STATUS_ACKNOWLEDGED
            ).count(),
            'resolved': self.queryset.filter(
                status=StockAlert.STATUS_RESOLVED
            ).count(),
        }
        return Response(counts)


class StockSummaryView(APIView):
    """
    Get stock summary report.

    GET /api/v1/inventory/summary/
    """

    permission_classes = [IsRoleStaff]

    def get(self, request):
        """Get stock summary."""
        initial_stock_subquery = InventoryMovement.objects.filter(
            variant=OuterRef('pk'),
            reason='initial',
        ).order_by('created_at').values('stock_after')[:1]

        variants = ProductVariant.objects.filter(
            is_active=True,
            is_deleted=False,
            catalog_item__track_inventory=True
        ).select_related('catalog_item').annotate(
            total_in=Coalesce(
                Sum(
                    'movements__quantity',
                    filter=Q(movements__movement_type=InventoryMovement.MOVEMENT_IN),
                ),
                0,
            ),
            total_out=Coalesce(
                Sum(
                    Case(
                        When(
                            movements__movement_type=InventoryMovement.MOVEMENT_OUT,
                            then=F('movements__quantity') * -1,
                        ),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                0,
            ),
            last_movement_date=Max('movements__created_at'),
            initial_stock_val=Subquery(initial_stock_subquery),
        )

        sale_mode_labels = {
            'BUY': _('Venta'),
            'QUOTE': _('Cotización'),
            'HYBRID': _('Mixto'),
        }
        item_type_labels = {
            'product': _('Producto'),
            'service': _('Servicio'),
        }

        summary = []
        for variant in variants:
            current_stock = variant.stock if variant.stock is not None else 0
            item = variant.catalog_item
            initial_stock = variant.initial_stock_val
            if initial_stock is None:
                initial_stock = 0

            if variant.is_out_of_stock:
                stock_status = 'out_of_stock'
                stock_status_display = _('Sin existencias')
            elif variant.is_low_stock:
                stock_status = 'low_stock'
                stock_status_display = _('Stock bajo')
            else:
                stock_status = 'in_stock'
                stock_status_display = _('En existencia')

            summary.append({
                'variant_id': str(variant.id),
                'product_id': str(item.id),
                'product_slug': item.slug,
                'sku': variant.sku,
                'product_name': item.name,
                'variant_name': variant.name,
                'item_type': item.type,
                'item_type_display': str(item_type_labels.get(item.type, item.type)),
                'sale_mode': item.sale_mode,
                'sale_mode_display': str(sale_mode_labels.get(item.sale_mode, item.sale_mode)),
                'cost': variant.cost if variant.cost is not None else (item.base_price or 0),
                'sale_price': variant.price or item.base_price or 0,
                'current_stock': current_stock,
                'initial_stock': initial_stock,
                'total_in': variant.total_in or 0,
                'total_out': variant.total_out or 0,
                'low_stock_threshold': variant.low_stock_threshold,
                'is_low_stock': variant.is_low_stock,
                'is_out_of_stock': variant.is_out_of_stock,
                'stock_status': stock_status,
                'stock_status_display': stock_status_display,
                'last_movement_date': variant.last_movement_date,
            })

        summary.sort(key=lambda x: x['current_stock'])

        serializer = StockSummarySerializer(summary, many=True)
        return Response(serializer.data)


class LowStockReportView(APIView):
    """
    Get low stock report.

    GET /api/v1/inventory/low-stock/
    """

    permission_classes = [IsRoleStaff]

    def get(self, request):
        """Get low stock items."""
        variants = ProductVariant.objects.filter(
            is_active=True,
            is_deleted=False,
            catalog_item__track_inventory=True,
            stock__lte=F('low_stock_threshold')
        ).select_related('catalog_item').order_by('stock')

        data = []
        for variant in variants:
            data.append({
                'variant_id': str(variant.id),
                'sku': variant.sku,
                'product_name': variant.catalog_item.name,
                'variant_name': variant.name,
                'current_stock': variant.stock,
                'low_stock_threshold': variant.low_stock_threshold,
                'is_out_of_stock': variant.is_out_of_stock,
            })

        return Response({
            'count': len(data),
            'items': data
        })


class InventoryValueReportView(APIView):
    """
    Get inventory value report.
    """

    permission_classes = [IsRoleStaff]

    def get(self, request):
        """Get inventory value."""
        variants = ProductVariant.objects.filter(
            is_active=True,
            is_deleted=False,
            catalog_item__track_inventory=True
        ).select_related('catalog_item')

        total_value = 0
        total_items = 0
        by_category = {}

        for variant in variants:
            item_value = variant.stock * variant.price
            total_value += item_value
            total_items += variant.stock

            category_name = variant.catalog_item.category.name if variant.catalog_item.category else 'Uncategorized'
            if category_name not in by_category:
                by_category[category_name] = {
                    'value': 0,
                    'items': 0
                }
            by_category[category_name]['value'] += float(item_value)
            by_category[category_name]['items'] += variant.stock

        return Response({
            'total_value': float(total_value),
            'total_items': total_items,
            'by_category': by_category
        })
