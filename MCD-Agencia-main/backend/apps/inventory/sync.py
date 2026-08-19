"""
Keep catalog products and inventory variants in lockstep.

Inventory has no separate stock table: a product appears there when it has an
active ProductVariant and CatalogItem.track_inventory is True. This module is
the single place that creates that variant and copies prices/visibility so a
change in either screen shows up in the other.
"""

from __future__ import annotations

import logging
import threading
import uuid
from contextlib import contextmanager

from django.db import transaction

logger = logging.getLogger(__name__)

_state = threading.local()


def is_syncing() -> bool:
    return bool(getattr(_state, 'active', False))


@contextmanager
def skip_sync():
    """Prevent catalog↔variant signals from looping while we write both sides."""
    previous = getattr(_state, 'active', False)
    _state.active = True
    try:
        yield
    finally:
        _state.active = previous


def get_primary_variant(item):
    """Prefer the Default SKU, otherwise the oldest surviving variant."""
    variants = item.variants.filter(is_deleted=False).order_by('created_at')
    default = variants.filter(name='Default').first()
    return default or variants.first()


def unique_sku(base: str, exclude_pk=None) -> str:
    from apps.catalog.models import ProductVariant

    sku = (base or '').strip().upper() or 'SKU-001'
    taken = ProductVariant.all_objects.filter(sku=sku)
    if exclude_pk:
        taken = taken.exclude(pk=exclude_pk)
    if not taken.exists():
        return sku

    suffix = 2
    while True:
        candidate = f'{sku}-{suffix:02d}'
        collision = ProductVariant.all_objects.filter(sku=candidate)
        if exclude_pk:
            collision = collision.exclude(pk=exclude_pk)
        if not collision.exists():
            return candidate
        suffix += 1


def ensure_inventory_variant(
    item,
    *,
    sku: str | None = None,
    threshold: int | None = None,
    cost=None,
    created_by=None,
):
    """
    Make sure a tracked product has a variant so it shows in inventory.

    Existing variants are reused. New ones start at stock 0; callers that have
    an initial quantity should pass it to apply_initial_stock().
    """
    from apps.catalog.models import ProductVariant

    if item.type != 'product' or not item.track_inventory:
        return get_primary_variant(item)

    variant = get_primary_variant(item)
    if variant:
        updates = {}
        if sku:
            wanted = unique_sku(sku, exclude_pk=variant.pk)
            if wanted != variant.sku:
                updates['sku'] = wanted
        if threshold is not None:
            next_threshold = max(0, int(threshold))
            if variant.low_stock_threshold != next_threshold:
                updates['low_stock_threshold'] = next_threshold
        if cost is not None and variant.cost != cost:
            updates['cost'] = cost
        if updates:
            with skip_sync():
                for field, value in updates.items():
                    setattr(variant, field, value)
                variant.save(update_fields=[*updates.keys(), 'updated_at'])
        return variant

    with skip_sync():
        variant = ProductVariant.objects.create(
            catalog_item=item,
            sku=unique_sku(sku or f'{item.slug}-001'),
            name='Default',
            cost=cost if cost is not None else (item.base_price or 0),
            price=item.base_price or 0,
            compare_at_price=item.compare_at_price,
            stock=0,
            low_stock_threshold=max(0, int(threshold if threshold is not None else 10)),
            is_active=bool(item.is_active),
        )
        logger.info('Created inventory variant %s for catalog item %s', variant.sku, item.id)
    return variant


def apply_initial_stock(variant, quantity: int, *, created_by=None, notes: str = '') -> None:
    """Record opening stock as an audited adjustment instead of writing stock directly."""
    from apps.inventory.models import InventoryMovement

    target = max(0, int(quantity or 0))
    if target <= 0 or variant is None:
        return

    stock_before = variant.stock if variant.stock is not None else 0
    if target == stock_before:
        return

    try:
        with transaction.atomic():
            InventoryMovement.objects.create(
                variant=variant,
                movement_type=InventoryMovement.MOVEMENT_ADJUSTMENT,
                quantity=target - stock_before,
                reason='initial',
                notes=notes or 'Stock inicial al crear producto desde catálogo',
                created_by=created_by if getattr(created_by, 'is_authenticated', False) else None,
                stock_before=stock_before,
                stock_after=target,
            )
    except Exception:
        logger.exception('Initial inventory movement failed for variant %s', variant.id)
        with skip_sync():
            variant.stock = target
            variant.save(update_fields=['stock', 'updated_at'])


def sync_item_fields_to_primary_variant(item) -> None:
    """Copy catalog price and visibility onto the primary inventory variant."""
    variant = get_primary_variant(item)
    if variant is None:
        return

    updates = {}
    price = item.base_price if item.base_price is not None else variant.price
    if variant.price != price:
        updates['price'] = price
    if variant.compare_at_price != item.compare_at_price:
        updates['compare_at_price'] = item.compare_at_price

    if item.track_inventory:
        live_variants = item.variants.filter(is_deleted=False)
        if not item.is_active:
            for other in live_variants.filter(is_active=True):
                if other.pk != variant.pk:
                    with skip_sync():
                        other.is_active = False
                        other.save(update_fields=['is_active', 'updated_at'])
            if variant.is_active:
                updates['is_active'] = False
        elif not live_variants.filter(is_active=True).exists() and not variant.is_active:
            updates['is_active'] = True

    if not updates:
        return

    with skip_sync():
        for field, value in updates.items():
            setattr(variant, field, value)
        variant.save(update_fields=[*updates.keys(), 'updated_at'])


def sync_catalog_item_to_inventory(
    item,
    *,
    sku: str | None = None,
    initial_stock: int | None = None,
    threshold: int | None = None,
    cost=None,
    created_by=None,
) -> None:
    """Create or refresh the inventory row that belongs to this catalog item."""
    if is_syncing() or getattr(item, 'is_deleted', False):
        return

    if item.type == 'product' and item.track_inventory:
        variant = ensure_inventory_variant(
            item,
            sku=sku,
            threshold=threshold,
            cost=cost,
            created_by=created_by,
        )
        if initial_stock:
            apply_initial_stock(variant, initial_stock, created_by=created_by)
        sync_item_fields_to_primary_variant(item)
        return

    if item.sale_mode in ('BUY', 'HYBRID') and not item.track_inventory:
        _ensure_cart_placeholder(item)


def _ensure_cart_placeholder(item) -> None:
    """Purchasable products without stock tracking still need one variant for the cart."""
    from apps.catalog.models import ProductVariant

    if item.variants.filter(is_deleted=False).exists():
        return

    with skip_sync():
        ProductVariant.objects.create(
            catalog_item=item,
            sku=unique_sku(f'{item.slug}-default-{str(uuid.uuid4())[:8]}'),
            name='Default',
            price=item.base_price or 0,
            compare_at_price=item.compare_at_price,
            stock=100,
            is_active=True,
        )


def sync_variant_to_catalog_item(variant) -> None:
    """Copy price and visibility from the primary variant back to the catalog item."""
    if is_syncing() or variant is None:
        return

    item = variant.catalog_item
    if item is None or not item.track_inventory:
        return

    primary = get_primary_variant(item)
    if primary is None or str(primary.pk) != str(variant.pk):
        return

    updates = {}
    if item.base_price != variant.price:
        updates['base_price'] = variant.price
    if item.compare_at_price != variant.compare_at_price:
        updates['compare_at_price'] = variant.compare_at_price

    has_active = item.variants.filter(is_deleted=False, is_active=True).exists()
    if variant.is_active and not item.is_active:
        updates['is_active'] = True
    elif not has_active and item.is_active:
        updates['is_active'] = False

    if not updates:
        return

    with skip_sync():
        for field, value in updates.items():
            setattr(item, field, value)
        item.save(update_fields=[*updates.keys(), 'updated_at'])


def backfill_missing_inventory_variants() -> int:
    """Create inventory variants for tracked products that never received one."""
    from apps.catalog.models import CatalogItem

    created = 0
    qs = CatalogItem.objects.filter(
        type='product',
        track_inventory=True,
        is_deleted=False,
    )
    for item in qs:
        if get_primary_variant(item):
            continue
        ensure_inventory_variant(item)
        created += 1
    return created
