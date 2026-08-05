"""
Catalog Signals for MCD-Agencia.

Signal handlers for catalog-related events.
"""

import uuid
from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver

from .models import CatalogItem, ProductVariant


@receiver(post_save, sender=CatalogItem)
def create_default_variant(sender, instance, created, **kwargs):
    """
    Auto-create a default variant for products that can be purchased directly.

    This ensures products with sale_mode BUY or HYBRID always have at least
    one variant, which is required for the cart functionality.

    Args:
        sender: The CatalogItem model
        instance: The CatalogItem instance
        created: Whether this is a new instance
        **kwargs: Additional arguments
    """
    # Only create default variant for products that can be purchased
    if instance.sale_mode in ['BUY', 'HYBRID'] and not instance.track_inventory:
        # Check if product has any variants
        if not instance.variants.exists():
            # Generate a unique SKU
            sku = f"{instance.slug}-default-{str(uuid.uuid4())[:8]}"

            # Create default variant with base price
            ProductVariant.objects.create(
                catalog_item=instance,
                sku=sku,
                name='Default',
                price=instance.base_price,
                compare_at_price=instance.compare_at_price,
                stock=100 if not instance.track_inventory else 0,
                is_active=True
            )


@receiver(m2m_changed, sender=ProductVariant.attribute_values.through)
def update_variant_name(sender, instance, action, **kwargs):
    """
    Auto-generate variant name when attribute values change.

    Args:
        sender: The through model
        instance: The ProductVariant instance
        action: The m2m action (post_add, post_remove, etc.)
        **kwargs: Additional arguments
    """
    if action in ['post_add', 'post_remove', 'post_clear']:
        name = instance.generate_name_from_attributes()
        if name and name != instance.name:
            instance.name = name
            instance.save(update_fields=['name', 'updated_at'])
