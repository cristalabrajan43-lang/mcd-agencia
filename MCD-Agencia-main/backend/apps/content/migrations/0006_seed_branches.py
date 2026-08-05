"""
Data migration to seed the default branches (Acapulco and Tecoanapa).
"""

from django.db import migrations


def seed_branches(apps, schema_editor):
    Branch = apps.get_model('content', 'Branch')
    if Branch.objects.exists():
        return  # Already seeded

    import uuid

    Branch.objects.create(
        id=uuid.uuid4(),
        name='Agencia MCD Acapulco',
        street='Granjas Márquez Plaza Diamante',
        neighborhood='Granjas Márquez',
        city='Acapulco de Juárez',
        state='Guerrero',
        postal_code='39890',
        phone='+52 222 805 5700',
        email='ventas@agenciamcd.mx',
        hours='Lunes a Viernes: 9:00 - 18:00\nSábados: 9:00 - 14:00',
        hours_en='Monday to Friday: 9:00 AM - 6:00 PM\nSaturdays: 9:00 AM - 2:00 PM',
        latitude=16.8001189,
        longitude=-99.8063231,
        google_maps_url='https://maps.app.goo.gl/T3pDHZrqm4bVKAJV6',
        is_active=True,
        position=0,
    )
    Branch.objects.create(
        id=uuid.uuid4(),
        name='Agencia MCD Tecoanapa',
        street='Calle Principal 456',
        neighborhood='Centro',
        city='Tecoanapa',
        state='Guerrero',
        postal_code='41300',
        phone='+52 745 114 7727',
        email='ventas2@agenciamcd.mx',
        hours='Lunes a Viernes: 9:00 - 18:00\nSábados: 9:00 - 14:00',
        hours_en='Monday to Friday: 9:00 AM - 6:00 PM\nSaturdays: 9:00 AM - 2:00 PM',
        latitude=16.8512082,
        longitude=-99.84964,
        google_maps_url='https://maps.app.goo.gl/6zj1WJvJ57jb64Ph6',
        is_active=True,
        position=1,
    )


def reverse_branches(apps, schema_editor):
    Branch = apps.get_model('content', 'Branch')
    Branch.objects.filter(
        name__in=['Agencia MCD Acapulco', 'Agencia MCD Tecoanapa']
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0005_add_service_key_to_service'),
    ]

    operations = [
        migrations.RunPython(seed_branches, reverse_branches),
    ]
