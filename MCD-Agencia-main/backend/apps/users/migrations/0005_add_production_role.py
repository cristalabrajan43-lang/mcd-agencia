from django.db import migrations, models


PRODUCTION_PERMISSIONS = {
    'catalog': {'view': True},
    'orders': {'view': True, 'edit': True, 'manage': True},
    'quotes': {'view': False},
    'users': {'view': False},
    'inventory': {'view': True},
    'production': {'view': True, 'edit': True, 'manage': True},
}


def create_production_role(apps, schema_editor):
    Role = apps.get_model('users', 'Role')
    Role.objects.update_or_create(
        name='production',
        defaults={
            'display_name': 'Production',
            'description': 'Production floor: manage orders and production jobs.',
            'is_system': True,
            'permissions': PRODUCTION_PERMISSIONS,
        },
    )


def remove_production_role(apps, schema_editor):
    Role = apps.get_model('users', 'Role')
    Role.objects.filter(name='production').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_add_user_address_model'),
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
        migrations.RunPython(create_production_role, remove_production_role),
    ]
