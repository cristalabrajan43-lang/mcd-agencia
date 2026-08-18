"""Inventory business logic for stock movements tied to orders."""

import logging

from apps.orders.models import Order

logger = logging.getLogger(__name__)

STOCK_DEDUCT_STATUSES = frozenset({
    Order.STATUS_IN_DELIVERY,
    Order.STATUS_COMPLETED,
})


def order_already_has_sale_movements(order_id) -> bool:
    from .models import InventoryMovement

    return InventoryMovement.objects.filter(
        reference_type='order',
        reference_id=str(order_id),
        movement_type=InventoryMovement.MOVEMENT_OUT,
        reason__in=['sale', 'shipment'],
    ).exists()


def register_sale_movements_for_order(order, created_by=None) -> dict:
    """
    Register OUT movements for each inventory-tracked line on an order.

    Idempotent: skips if movements for this order already exist.
    """
    from apps.catalog.models import ProductVariant
    from .models import InventoryMovement

    if order_already_has_sale_movements(order.id):
        return {'created': 0, 'skipped': 'already_recorded'}

    created_count = 0
    for line in order.lines.select_related('variant__catalog_item').all():
        variant = line.variant
        if not variant:
            variant_id = (line.metadata or {}).get('variant_id')
            if variant_id:
                variant = ProductVariant.objects.filter(
                    id=variant_id
                ).select_related('catalog_item').first()

        if not variant or not variant.catalog_item.track_inventory:
            continue

        InventoryMovement.objects.create(
            variant=variant,
            movement_type=InventoryMovement.MOVEMENT_OUT,
            quantity=line.quantity,
            reason='shipment',
            reference_type='order',
            reference_id=str(order.id),
            notes=f'Salida por envío — pedido {order.order_number}',
            created_by=created_by,
        )
        created_count += 1

    if created_count:
        logger.info(
            'Registered %s sale movement(s) for order %s',
            created_count,
            order.order_number,
        )

    return {'created': created_count}


def register_sale_movements_on_shipment(order, created_by=None) -> dict:
    """Deduct inventory when the order is shipped or delivered to the customer."""
    return register_sale_movements_for_order(order, created_by=created_by)
