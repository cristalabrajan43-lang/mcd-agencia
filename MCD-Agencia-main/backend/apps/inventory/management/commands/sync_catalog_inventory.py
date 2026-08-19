"""Backfill inventory variants for catalog products that never received one."""

from django.core.management.base import BaseCommand

from apps.inventory.sync import backfill_missing_inventory_variants


class Command(BaseCommand):
    help = 'Create inventory variants for tracked catalog products that have none.'

    def handle(self, *args, **options):
        created = backfill_missing_inventory_variants()
        self.stdout.write(self.style.SUCCESS(
            f'Created {created} missing inventory variant(s).'
        ))
