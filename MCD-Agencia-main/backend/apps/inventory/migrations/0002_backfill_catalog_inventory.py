from django.db import migrations


def backfill_inventory_variants(apps, schema_editor):
    from apps.inventory.sync import backfill_missing_inventory_variants

    backfill_missing_inventory_variants()


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
        ('catalog', '0003_productvariant_cost'),
    ]

    operations = [
        migrations.RunPython(backfill_inventory_variants, migrations.RunPython.noop),
    ]
