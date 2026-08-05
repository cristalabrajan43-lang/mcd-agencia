"""
Auto-migration to clean up corrupted jobs in production.
This runs automatically when migrations are applied.

DISABLED: This migration was causing login issues. Use management command instead.
"""
from django.db import migrations


def clean_corrupted_jobs(apps, schema_editor):
    """Remove jobs without valid order_number."""
    # DISABLED - Use management command cleanup_corrupted_jobs instead
    pass


def reverse_migration(apps, schema_editor):
    """This migration cannot be reversed."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0005_create_operation_groups'),
    ]

    operations = [
        # DISABLED - Causing auth issues
        # migrations.RunPython(clean_corrupted_jobs, reverse_migration),
    ]
