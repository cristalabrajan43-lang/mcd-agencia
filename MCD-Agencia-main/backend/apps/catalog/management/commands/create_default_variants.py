"""
Management command to create default variants for products without variants.

This ensures all purchasable products (BUY/HYBRID) have at least one variant,
which is required for the cart functionality.

Usage:
    python manage.py create_default_variants
    python manage.py create_default_variants --dry-run
"""

import uuid
from django.core.management.base import BaseCommand

from apps.catalog.models import CatalogItem, ProductVariant


class Command(BaseCommand):
    help = 'Create default variants for products that have no variants'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually creating',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Find products with BUY or HYBRID mode that have no variants
        products_without_variants = CatalogItem.objects.filter(
            sale_mode__in=['BUY', 'HYBRID'],
            is_active=True
        ).exclude(
            variants__isnull=False
        )

        count = products_without_variants.count()

        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('All purchasable products already have variants.')
            )
            return

        self.stdout.write(
            f'Found {count} products without variants that need default variants.'
        )

        if dry_run:
            self.stdout.write(self.style.WARNING('\n[DRY RUN] Would create variants for:'))
            for product in products_without_variants:
                self.stdout.write(f'  - {product.name} (SKU: {product.slug}-default-xxxx)')
            return

        created_count = 0
        for product in products_without_variants:
            sku = f"{product.slug}-default-{str(uuid.uuid4())[:8]}"

            ProductVariant.objects.create(
                catalog_item=product,
                sku=sku,
                name='Default',
                price=product.base_price,
                compare_at_price=product.compare_at_price,
                stock=100 if not product.track_inventory else 0,
                is_active=True
            )

            created_count += 1
            self.stdout.write(f'  Created variant for: {product.name}')

        self.stdout.write(
            self.style.SUCCESS(f'\nSuccessfully created {created_count} default variants.')
        )
