from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand
from django.db.models import Max

from apps.content.models import CarouselSlide, PortfolioVideo, Service, ServiceImage


SERVICE_LABELS = {
    'fabricacion-anuncios': 'Fabricación de anuncios',
    'espectaculares': 'Espectaculares',
    'publicidad-movil': 'Publicidad móvil',
    'impresion-gran-formato': 'Impresión en gran formato',
    'senalizacion': 'Señalización',
    'rotulacion-vehicular': 'Rotulación vehicular',
    'corte-grabado-cnc-laser': 'Corte y grabado CNC/Láser',
    'diseno-grafico': 'Diseño gráfico',
    'impresion-offset-serigrafia': 'Impresión offset / serigrafía',
}

LEGACY_SERVICE_IMAGES = {
    'fabricacion-anuncios': ['/images/carousel/anuncios-iluminados.jfif'],
    'espectaculares': [],
    'publicidad-movil': ['/images/carousel/vallas-moviles.jfif'],
    'impresion-gran-formato': ['/images/carousel/vinil-en-vidrio.jfif'],
    'rotulacion-vehicular': ['/images/carousel/letras-3d.jfif'],
    'senalizacion': ['/images/carousel/anuncios-letras-3d.jfif'],
    'corte-grabado-cnc-laser': [],
    'diseno-grafico': ['/images/carousel/letras-neon.jfif'],
    'impresion-offset-serigrafia': [],
}

LEGACY_HERO_FALLBACK_IMAGES = [
    '/images/carousel/vallas-moviles.jfif',
    '/images/carousel/anuncios-iluminados.jfif',
    '/images/carousel/letras-neon.jfif',
    '/images/carousel/vinil-en-vidrio.jfif',
]

LEGACY_PORTFOLIO_VIDEOS = [
    {'youtube_id': 'sqOb-gSSQq8', 'title': 'Proyecto 1', 'orientation': 'vertical'},
    {'youtube_id': 'b33fwbyZRQM', 'title': 'Proyecto 2', 'orientation': 'vertical'},
]


class Command(BaseCommand):
    help = (
        'Importa imágenes/vídeos legacy del landing (hardcoded) al CMS para administrarlos '
        'desde el panel sin perder contenido existente.'
    )

    def handle(self, *args, **options):
        seed_media_dir = Path(settings.BASE_DIR) / 'seed_media' / 'carousel'
        frontend_public = Path(settings.BASE_DIR).parent / 'frontend' / 'public'

        if not seed_media_dir.exists() and not frontend_public.exists():
            self.stdout.write(self.style.ERROR(
                f'No se encontró fuente de imágenes. Revisar {seed_media_dir} o {frontend_public}'
            ))
            return

        def resolve_image_path(rel_path: str) -> Path | None:
            filename = Path(rel_path).name
            seed_path = seed_media_dir / filename
            if seed_path.exists():
                return seed_path

            public_path = frontend_public / rel_path.lstrip('/')
            if public_path.exists():
                return public_path

            return None

        services_created = 0
        service_images_created = 0
        slides_created = 0
        videos_created = 0

        for service_key, image_paths in LEGACY_SERVICE_IMAGES.items():
            service, created = Service.objects.get_or_create(
                service_key=service_key,
                defaults={
                    'name': SERVICE_LABELS.get(service_key, service_key),
                    'name_en': SERVICE_LABELS.get(service_key, service_key),
                    'description': f'Servicio {SERVICE_LABELS.get(service_key, service_key)}',
                    'description_en': f'Service {SERVICE_LABELS.get(service_key, service_key)}',
                    'icon': '📋',
                    'cta_text': 'Cotizar',
                    'cta_text_en': 'Quote',
                    'cta_url': f'#cotizar?servicio={service_key}',
                    'is_active': True,
                    'position': (Service.objects.aggregate(max_pos=Max('position')).get('max_pos') or -1) + 1,
                },
            )
            if created:
                services_created += 1

            for rel_path in image_paths:
                source_path = resolve_image_path(rel_path)
                if not source_path:
                    self.stdout.write(self.style.WARNING(f'Archivo no encontrado: {rel_path}'))
                    continue

                filename = source_path.name
                already_exists = ServiceImage.objects.filter(service=service, image__icontains=filename).exists()
                if already_exists:
                    continue

                position = (ServiceImage.objects.filter(service=service).aggregate(max_pos=Max('position')).get('max_pos') or -1) + 1
                service_image = ServiceImage(
                    service=service,
                    alt_text=service.name,
                    alt_text_en=service.name_en or service.name,
                    subtype_key='',
                    is_active=True,
                    position=position,
                )
                with source_path.open('rb') as file_handle:
                    service_image.image.save(filename, File(file_handle), save=False)
                service_image.save()
                service_images_created += 1

        for rel_path in LEGACY_HERO_FALLBACK_IMAGES:
            source_path = resolve_image_path(rel_path)
            if not source_path:
                self.stdout.write(self.style.WARNING(f'Archivo no encontrado para hero: {rel_path}'))
                continue

            filename = source_path.name
            if CarouselSlide.objects.filter(image__icontains=filename).exists():
                continue

            matched_service_key = ''
            for key, image_list in LEGACY_SERVICE_IMAGES.items():
                if rel_path in image_list:
                    matched_service_key = key
                    break

            position = (CarouselSlide.objects.aggregate(max_pos=Max('position')).get('max_pos') or -1) + 1
            title = SERVICE_LABELS.get(matched_service_key, 'Agencia MCD')
            cta_url = f'#cotizar?servicio={matched_service_key}' if matched_service_key else '#cotizar'

            slide = CarouselSlide(
                title=title,
                title_en=title,
                subtitle='',
                subtitle_en='',
                cta_text='Cotizar',
                cta_text_en='Quote',
                cta_url=cta_url,
                service_key=matched_service_key,
                is_active=True,
                position=position,
            )
            with source_path.open('rb') as file_handle:
                slide.image.save(filename, File(file_handle), save=False)
            slide.save()
            slides_created += 1

        existing_video_ids = set(PortfolioVideo.objects.values_list('youtube_id', flat=True))
        max_allowed = PortfolioVideo.MAX_VIDEOS
        current_count = PortfolioVideo.objects.count()

        for item in LEGACY_PORTFOLIO_VIDEOS:
            if current_count >= max_allowed:
                break
            if item['youtube_id'] in existing_video_ids:
                continue

            position = (PortfolioVideo.objects.aggregate(max_pos=Max('position')).get('max_pos') or -1) + 1
            PortfolioVideo.objects.create(
                youtube_id=item['youtube_id'],
                title=item['title'],
                title_en=item['title'],
                orientation=item['orientation'],
                is_active=True,
                position=position,
            )
            videos_created += 1
            current_count += 1
            existing_video_ids.add(item['youtube_id'])

        self.stdout.write(self.style.SUCCESS('Importación legacy completada'))
        self.stdout.write(f'Services creados: {services_created}')
        self.stdout.write(f'ServiceImage creadas: {service_images_created}')
        self.stdout.write(f'CarouselSlide creados: {slides_created}')
        self.stdout.write(f'PortfolioVideo creados: {videos_created}')
