# Generated migration for creating operation groups

from django.db import migrations
from django.contrib.auth.models import Group, Permission


def create_groups(apps, schema_editor):
    """Create production_supervisors and operations_supervisors groups."""
    production_group, _ = Group.objects.get_or_create(name='production_supervisors')
    operations_group, _ = Group.objects.get_or_create(name='operations_supervisors')


def reverse_groups(apps, schema_editor):
    """Remove operation groups."""
    Group.objects.filter(name__in=['production_supervisors', 'operations_supervisors']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0004_order_operation_plan_order_operational_rollup_and_more'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(create_groups, reverse_groups),
    ]
