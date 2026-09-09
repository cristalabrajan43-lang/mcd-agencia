"""Inventory business logic for stock movements tied to orders."""

import logging

from apps.orders.models import Order

logger = logging.getLogger(__name__)

SOURCE_VENDOR_ITEM_KEY = 'source_vendor_item_id'

STOCK_DEDUCT_STATUSES = frozenset({
    Order.STATUS_IN_DELIVERY,
    Order.STATUS_COMPLETED,
})

VENDOR_RECEIPT_STATUSES = frozenset({
    Order.STATUS_PAID,
    Order.STATUS_IN_PRODUCTION,
    Order.STATUS_READY,
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
        if variant.catalog_item.vendor_id:
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


def order_already_has_purchase_receipts(order_id) -> bool:
    from .models import InventoryMovement

    return InventoryMovement.objects.filter(
        reference_type='purchase_order',
        reference_id=str(order_id),
        movement_type=InventoryMovement.MOVEMENT_IN,
        reason='purchase',
    ).exists()


def get_or_create_agency_receipt_variant(vendor_variant, *, unit_cost=None, created_by=None):
    """Clone a vendor catalog SKU into the agency warehouse inventory."""
    from apps.catalog.models import CatalogItem
    from apps.inventory.sync import ensure_inventory_variant, skip_sync

    vendor_item = vendor_variant.catalog_item
    source_id = str(vendor_item.id)
    agency_item = CatalogItem.objects.filter(
        vendor__isnull=True,
        is_deleted=False,
        specifications__contains={SOURCE_VENDOR_ITEM_KEY: source_id},
    ).first()

    if agency_item is None:
        specs = dict(vendor_item.specifications or {})
        specs[SOURCE_VENDOR_ITEM_KEY] = source_id
        if vendor_item.vendor_id:
            specs['source_vendor_id'] = str(vendor_item.vendor_id)
        with skip_sync():
            agency_item = CatalogItem.objects.create(
                type='product',
                name=vendor_item.name,
                short_description=vendor_item.short_description or '',
                description=vendor_item.description or '',
                category=vendor_item.category,
                sale_mode='BUY',
                payment_mode='FULL',
                base_price=vendor_item.base_price,
                track_inventory=True,
                is_active=True,
                is_featured=False,
                specifications=specs,
            )

    return ensure_inventory_variant(
        agency_item,
        sku=f'MCD-{vendor_variant.sku}',
        cost=unit_cost,
        created_by=created_by,
    )


def register_vendor_purchase_receipts(order, created_by=None) -> dict:
    """
    Receive vendor catalog purchases into agency inventory.

    Each vendor line creates an IN movement on an agency SKU and reduces
    the vendor listing stock. Idempotent per order.
    """
    from apps.catalog.models import ProductVariant
    from .models import InventoryMovement

    if order_already_has_purchase_receipts(order.id):
        return {'created': 0, 'skipped': 'already_recorded'}

    created_count = 0
    for line in order.lines.select_related('variant__catalog_item__vendor').all():
        variant = line.variant
        if not variant:
            variant_id = (line.metadata or {}).get('variant_id')
            if variant_id:
                variant = ProductVariant.objects.filter(
                    id=variant_id
                ).select_related('catalog_item__vendor').first()

        if not variant:
            continue
        vendor_item = variant.catalog_item
        if not vendor_item.vendor_id:
            continue

        agency_variant = get_or_create_agency_receipt_variant(
            variant,
            unit_cost=line.unit_price,
            created_by=created_by,
        )
        vendor_name = ''
        if vendor_item.vendor:
            vendor_name = (vendor_item.vendor.full_name or vendor_item.vendor.email or '').strip()

        InventoryMovement.objects.create(
            variant=agency_variant,
            movement_type=InventoryMovement.MOVEMENT_IN,
            quantity=line.quantity,
            reason='purchase',
            reference_type='purchase_order',
            reference_id=str(order.id),
            notes=(
                f'Entrada por compra a {vendor_name or "proveedor"} '
                f'— pedido {order.order_number}'
            ),
            created_by=created_by,
        )

        if vendor_item.track_inventory:
            InventoryMovement.objects.create(
                variant=variant,
                movement_type=InventoryMovement.MOVEMENT_OUT,
                quantity=line.quantity,
                reason='sale',
                reference_type='purchase_order',
                reference_id=str(order.id),
                notes=f'Salida del catálogo del vendedor — pedido {order.order_number}',
                created_by=created_by,
            )

        created_count += 1

    if created_count:
        logger.info(
            'Registered %s vendor purchase receipt(s) for order %s',
            created_count,
            order.order_number,
        )

    return {'created': created_count}
