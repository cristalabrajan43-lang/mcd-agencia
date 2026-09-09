from django.db import migrations, models


WHOLESALE_PERMISSIONS = {
    'catalog': {'view': True},
    'orders': {'view': True, 'create': True},
    'quotes': {'view': True, 'create': True},
    'users': {'view': False},
    'inventory': {'view': False},
}


def create_wholesale_role(apps, schema_editor):
    Role = apps.get_model('users', 'Role')
    Role.objects.update_or_create(
        name='wholesale',
        defaults={
            'display_name': 'Vendedor',
            'description': 'Compra en catálogo a precio de mayoreo.',
            'is_system': True,
            'permissions': WHOLESALE_PERMISSIONS,
        },
    )


def remove_wholesale_role(apps, schema_editor):
    Role = apps.get_model('users', 'Role')
    Role.objects.filter(name='wholesale').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_add_production_role'),
    ]

    operations = [
        migrations.AlterField(
            model_name='role',
            name='name',
            field=models.CharField(
                choices=[
                    ('admin', 'Administrator'),
                    ('sales', 'Sales'),
                    ('production', 'Production'),
                    ('wholesale', 'Wholesale vendor'),
                    ('customer', 'Customer'),
                    ('superadmin', 'Super Administrator (Deprecated)'),
                    ('operations', 'Operations (Deprecated)'),
                ],
                help_text='Unique role identifier.',
                max_length=50,
                unique=True,
                verbose_name='name',
            ),
        ),
        migrations.RunPython(create_wholesale_role, remove_wholesale_role),
    ]
