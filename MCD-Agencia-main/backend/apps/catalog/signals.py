"""
Catalog Signals for MCD-Agencia.

Signal handlers for catalog-related events.
"""

from django.db import transaction
from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver

from .models import CatalogItem, ProductVariant


@receiver(post_save, sender=CatalogItem)
def sync_catalog_item_inventory(sender, instance, created, **kwargs):
    """
    After a catalog product is saved, make sure it has an inventory variant.

    Runs on commit so a serializer that creates the variant in the same
    transaction is visible before we decide whether to create another one.
    """
    from apps.inventory.sync import is_syncing, sync_catalog_item_to_inventory

    if is_syncing():
        return

    def _after_commit():
        if is_syncing():
            return
        sync_catalog_item_to_inventory(instance)

    transaction.on_commit(_after_commit)


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
