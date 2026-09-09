from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from apps.catalog.models import CatalogItem, ProductVariant
from apps.content.models import PromoBanner


def get_promo_targets(banner: PromoBanner):
    """Return catalog items affected by a promo banner."""
    queryset = CatalogItem.objects.filter(
        is_active=True,
        is_deleted=False,
        sale_mode__in=['BUY', 'HYBRID'],
        vendor__isnull=True,
    ).exclude(specifications__has_key='source_vendor_item_id')
    if banner.apply_to == PromoBanner.APPLY_SELECTED:
        return queryset.filter(promo_banners=banner)
    return queryset


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def apply_discount_to_item(item: CatalogItem, discount_percent: Decimal) -> None:
    """Apply percentage discount to a catalog item and its variants."""
    if not item.base_price or discount_percent <= 0:
        return

    original = item.compare_at_price or item.base_price
    if not item.compare_at_price:
        item.compare_at_price = original

    factor = Decimal(1) - (discount_percent / Decimal(100))
    item.base_price = _quantize(original * factor)
    item.save(update_fields=['base_price', 'compare_at_price', 'updated_at'])

    for variant in item.variants.all():
        if not variant.price:
            continue
        variant_original = variant.compare_at_price or variant.price
        if not variant.compare_at_price:
            variant.compare_at_price = variant_original
        variant.price = _quantize(variant_original * factor)
        variant.save(update_fields=['price', 'compare_at_price', 'updated_at'])


def restore_discount_from_item(item: CatalogItem) -> None:
    """Restore original prices from compare_at_price."""
    if item.compare_at_price:
        item.base_price = item.compare_at_price
        item.compare_at_price = None
        item.save(update_fields=['base_price', 'compare_at_price', 'updated_at'])

    for variant in ProductVariant.objects.filter(catalog_item=item):
        if variant.compare_at_price:
            variant.price = variant.compare_at_price
            variant.compare_at_price = None
            variant.save(update_fields=['price', 'compare_at_price', 'updated_at'])


def sync_promo_banner(banner: PromoBanner) -> None:
    """Apply or restore product prices for a promo banner."""
    targets = list(get_promo_targets(banner))
    if banner.is_active and banner.discount_percent > 0:
        for item in targets:
            restore_discount_from_item(item)
            apply_discount_to_item(item, banner.discount_percent)
    else:
        for item in targets:
            restore_discount_from_item(item)


def sync_all_active_promos() -> None:
    """Re-apply all active promos (useful after bulk product updates)."""
    active_banners = PromoBanner.objects.filter(is_active=True, discount_percent__gt=0).order_by('position')
    affected_ids: set = set()
    for banner in active_banners:
        targets = list(get_promo_targets(banner))
        for item in targets:
            if item.id not in affected_ids:
                restore_discount_from_item(item)
                affected_ids.add(item.id)
            apply_discount_to_item(item, banner.discount_percent)
