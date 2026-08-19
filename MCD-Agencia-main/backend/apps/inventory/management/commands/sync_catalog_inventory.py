"""Backfill inventory variants for catalog products that never received one."""

from django.core.management.base import BaseCommand

from apps.inventory.sync import backfill_missing_inventory_variants, restore_inventory_visibility


class Command(BaseCommand):
    help = 'Create or restore inventory variants so catalog products stay listed.'

    def handle(self, *args, **options):
        created = backfill_missing_inventory_variants()
        restored = restore_inventory_visibility()
        self.stdout.write(self.style.SUCCESS(
            f'Created {created} missing inventory variant(s); restored {restored} product(s) to inventory.'
        ))
