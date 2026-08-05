"""
Ensure Yamaha/Costa Azul branch exists with a valid UUID.
"""

from django.db import migrations


def ensure_yamaha_branch(apps, schema_editor):
    Branch = apps.get_model('content', 'Branch')

    yamaha = (
        Branch.objects.filter(name__icontains='yamaha').first()
        or Branch.objects.filter(name__icontains='costa azul').first()
        or Branch.objects.filter(street__icontains='Plaza Yamaha').first()
        or Branch.objects.filter(street__icontains='Costa Azul').first()
    )

    defaults = {
        'name': 'Acapulco Yamaha',
        'street': 'Capitán Vasco de Gama 295, 2° piso Plaza Yamaha',
        'neighborhood': 'Fracc. Costa Azul',
        'city': 'Acapulco de Juárez',
        'state': 'Guerrero',
        'postal_code': '39850',
        'phone': '+52 220 326 9670',
        'email': 'ventas3@agenciamcd.mx',
        'hours': 'Lunes a Viernes: 9:00 - 18:00\nSábados: 9:00 - 14:00',
        'hours_en': 'Monday to Friday: 9:00 AM - 6:00 PM\nSaturdays: 9:00 AM - 2:00 PM',
        'latitude': 16.851298,
        'longitude': -99.849726,
        'google_maps_url': 'https://maps.app.goo.gl/8kzDZf5AE2oJxPj67',
        'is_active': True,
        'position': 1,
    }

    if yamaha:
        for field, value in defaults.items():
            setattr(yamaha, field, value)
        yamaha.save()
    else:
        Branch.objects.create(**defaults)


def reverse_yamaha_branch(apps, schema_editor):
    Branch = apps.get_model('content', 'Branch')
    Branch.objects.filter(name='Acapulco Yamaha').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0007_serviceimage_display_format'),
    ]

    operations = [
        migrations.RunPython(ensure_yamaha_branch, reverse_yamaha_branch),
    ]
