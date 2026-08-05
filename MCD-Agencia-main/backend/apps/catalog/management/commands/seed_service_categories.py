"""
Seed catalog service categories from the services taxonomy used by the quote system.

Usage:
    python manage.py seed_service_categories
"""

from django.core.management.base import BaseCommand

from apps.catalog.models import Category


SERVICE_TREE = [
    {
        'slug': 'espectaculares',
        'name': 'Espectaculares',
        'name_en': 'Billboards',
        'description': 'Publicidad exterior de alto impacto.',
        'children': [
            ('unipolar', 'Unipolar'),
            ('azotea', 'Azotea'),
            ('mural', 'Mural'),
        ],
    },
    {
        'slug': 'fabricacion-anuncios',
        'name': 'Fabricación de anuncios',
        'name_en': 'Sign Manufacturing',
        'description': 'Anuncios luminosos, letras 3D, cajas de luz y más.',
        'children': [
            ('cajas-luz', 'Cajas de luz'),
            ('letras-3d', 'Letras 3D'),
            ('neon', 'Neón / LED'),
            ('anuncios-2d', 'Anuncios 2D'),
            ('bastidores', 'Bastidores'),
            ('toldos', 'Toldos'),
        ],
    },
    {
        'slug': 'publicidad-movil',
        'name': 'Publicidad móvil',
        'name_en': 'Mobile Advertising',
        'description': 'Vallas móviles, publibuses y perifoneo.',
        'children': [
            ('vallas-moviles', 'Vallas móviles'),
            ('publibuses', 'Publibuses'),
            ('perifoneo', 'Perifoneo'),
        ],
    },
    {
        'slug': 'impresion-gran-formato',
        'name': 'Impresión en gran formato',
        'name_en': 'Large Format Printing',
        'description': 'Impresión en lona, vinil y tela.',
        'children': [
            ('lona', 'Lona'),
            ('vinil', 'Vinil'),
            ('tela', 'Tela'),
        ],
    },
    {
        'slug': 'senalizacion',
        'name': 'Señalización',
        'name_en': 'Signage',
        'description': 'Señalización interior, exterior y vial.',
        'children': [
            ('interior', 'Interior'),
            ('exterior', 'Exterior'),
            ('vial', 'Vial'),
        ],
    },
    {
        'slug': 'rotulacion-vehicular',
        'name': 'Rotulación vehicular',
        'name_en': 'Vehicle Wrapping',
        'description': 'Rotulación completa o parcial para vehículos.',
        'children': [
            ('completa', 'Completa'),
            ('parcial', 'Parcial'),
            ('vinil-recortado', 'Vinil recortado'),
            ('impresion-digital', 'Impresión digital'),
        ],
    },
    {
        'slug': 'corte-grabado-cnc-laser',
        'name': 'Corte y grabado CNC / Láser',
        'name_en': 'CNC & Laser Cutting',
        'description': 'Corte y grabado de precisión en diversos materiales.',
        'children': [
            ('router-cnc', 'Router CNC'),
            ('corte-laser', 'Corte láser'),
            ('grabado-laser', 'Grabado láser'),
        ],
    },
    {
        'slug': 'diseno-grafico',
        'name': 'Diseño gráfico',
        'name_en': 'Graphic Design',
        'description': 'Diseño de logotipos, papelería y material digital.',
        'children': [
            ('logotipos', 'Logotipos'),
            ('papeleria', 'Papelería'),
            ('redes-sociales', 'Redes sociales'),
        ],
    },
    {
        'slug': 'impresion-offset-serigrafia',
        'name': 'Impresión offset / serigrafía',
        'name_en': 'Offset & Screen Printing',
        'description': 'Tarjetas, volantes, serigrafía y sublimación.',
        'children': [
            ('tarjetas-presentacion', 'Tarjetas de presentación'),
            ('volantes', 'Volantes'),
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed catalog service categories for the services quote taxonomy'

    def handle(self, *args, **options):
        created = 0
        updated = 0

        services_root, _ = Category.objects.get_or_create(
            slug='servicios',
            defaults={
                'name': 'Servicios',
                'name_en': 'Services',
                'description': 'Servicios de publicidad y producción gráfica',
                'description_en': 'Advertising and graphic production services',
                'type': 'service',
                'is_active': True,
            },
        )

        for service in SERVICE_TREE:
            service_category, service_created = Category.all_objects.get_or_create(
                slug=service['slug'],
                defaults={
                    'name': service['name'],
                    'name_en': service['name_en'],
                    'description': service['description'],
                    'type': 'service',
                    'parent': services_root,
                    'is_active': True,
                },
            )
            if not service_created:
                changed = False
                if service_category.type != 'service':
                    service_category.type = 'service'
                    changed = True
                if service_category.parent_id != services_root.id:
                    service_category.parent = services_root
                    changed = True
                if not service_category.is_active:
                    service_category.is_active = True
                    changed = True
                if changed:
                    service_category.save(update_fields=['type', 'parent', 'is_active'])
                    updated += 1
            else:
                created += 1

            for child_slug, child_name in service['children']:
                child_category, child_created = Category.all_objects.get_or_create(
                    slug=child_slug,
                    defaults={
                        'name': child_name,
                        'name_en': child_name,
                        'description': f'Subcategoría de {service["name"]}',
                        'type': 'service',
                        'parent': service_category,
                        'is_active': True,
                    },
                )
                if not child_created:
                    changed = False
                    if child_category.type != 'service':
                        child_category.type = 'service'
                        changed = True
                    if child_category.parent_id != service_category.id:
                        child_category.parent = service_category
                        changed = True
                    if not child_category.is_active:
                        child_category.is_active = True
                        changed = True
                    if changed:
                        child_category.save(update_fields=['type', 'parent', 'is_active'])
                        updated += 1
                else:
                    created += 1

        self.stdout.write(self.style.SUCCESS(f'Service categories ready: {created} created, {updated} updated'))
