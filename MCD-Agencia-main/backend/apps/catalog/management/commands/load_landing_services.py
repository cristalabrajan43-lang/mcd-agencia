"""
Command to load landing page services into the catalog.
Usage: python manage.py load_landing_services
"""

from django.core.management.base import BaseCommand
from apps.catalog.models import Category, CatalogItem


class Command(BaseCommand):
    help = "Load landing page services as quotable catalog items"

    def handle(self, *args, **options):
        self.stdout.write("Loading landing page services into catalog...")

        # Create or get the main services category
        services_cat, _ = Category.objects.get_or_create(
            slug="servicios",
            defaults={
                "name": "Servicios",
                "name_en": "Services",
                "description": "Servicios de publicidad y producción gráfica",
                "description_en": "Advertising and graphic production services",
                "is_active": True,
            }
        )

        # Landing page services data (matching SERVICE_LABELS from frontend)
        services_data = [
            {
                "service_id": "espectaculares",
                "name": "Espectaculares",
                "name_en": "Billboards",
                "description": "Renta y producción de espectaculares para publicidad exterior de alto impacto. Incluye opciones de unipolar, azotea y murales publicitarios.",
                "description_en": "Rental and production of billboards for high-impact outdoor advertising. Includes unipolar, rooftop, and advertising mural options.",
                "short_description": "Publicidad exterior de alto impacto",
                "short_description_en": "High-impact outdoor advertising",
            },
            {
                "service_id": "fabricacion-anuncios",
                "name": "Fabricación de anuncios",
                "name_en": "Sign Manufacturing",
                "description": "Diseño y fabricación de anuncios luminosos y no luminosos. Cajas de luz, letras 3D, neón LED, anuncios 2D, bastidores y toldos.",
                "description_en": "Design and manufacturing of illuminated and non-illuminated signs. Light boxes, 3D letters, LED neon, 2D signs, frames, and awnings.",
                "short_description": "Anuncios luminosos y no luminosos",
                "short_description_en": "Illuminated and non-illuminated signs",
            },
            {
                "service_id": "publicidad-movil",
                "name": "Publicidad móvil",
                "name_en": "Mobile Advertising",
                "description": "Campañas de publicidad en movimiento con vallas móviles, publibuses y perifoneo. Alcance masivo en zonas estratégicas.",
                "description_en": "Advertising campaigns in motion with mobile billboards, bus advertising, and loudspeaker announcements. Massive reach in strategic areas.",
                "short_description": "Vallas móviles, publibuses y perifoneo",
                "short_description_en": "Mobile billboards, bus ads, and loudspeakers",
            },
            {
                "service_id": "impresion-gran-formato",
                "name": "Impresión en gran formato y alta resolución",
                "name_en": "Large Format and High Resolution Printing",
                "description": "Impresión de alta calidad en lona, vinil y tela para banners, pendones, displays y más. Acabados profesionales para interior y exterior.",
                "description_en": "High-quality printing on canvas, vinyl, and fabric for banners, pennants, displays, and more. Professional finishes for indoor and outdoor use.",
                "short_description": "Impresión en lona, vinil y tela",
                "short_description_en": "Printing on canvas, vinyl, and fabric",
            },
            {
                "service_id": "senalizacion",
                "name": "Señalización",
                "name_en": "Signage",
                "description": "Diseño y fabricación de señalización interior y exterior. Señales de seguridad, direccionales, corporativas y personalizadas.",
                "description_en": "Design and manufacturing of interior and exterior signage. Safety, directional, corporate, and custom signs.",
                "short_description": "Señalización interior y exterior",
                "short_description_en": "Interior and exterior signage",
            },
            {
                "service_id": "rotulacion-vehicular",
                "name": "Rotulación vehicular",
                "name_en": "Vehicle Wrap and Lettering",
                "description": "Rotulación completa o parcial de vehículos. Vinil recortado e impresión digital para flotillas y vehículos particulares.",
                "description_en": "Full or partial vehicle wrap and lettering. Cut vinyl and digital printing for fleets and private vehicles.",
                "short_description": "Rotulación de vehículos y flotillas",
                "short_description_en": "Vehicle and fleet wrap",
            },
            {
                "service_id": "corte-grabado-cnc-laser",
                "name": "Corte y grabado en CNC y láser",
                "name_en": "CNC and Laser Cutting & Engraving",
                "description": "Servicios de corte y grabado de precisión con tecnología CNC y láser. Ideal para acrílico, madera, metal y más materiales.",
                "description_en": "Precision cutting and engraving services with CNC and laser technology. Ideal for acrylic, wood, metal, and more materials.",
                "short_description": "Corte y grabado de precisión",
                "short_description_en": "Precision cutting and engraving",
            },
            {
                "service_id": "diseno-grafico",
                "name": "Diseño gráfico",
                "name_en": "Graphic Design",
                "description": "Servicios de diseño gráfico profesional para logos, banners, flyers, catálogos y materiales publicitarios.",
                "description_en": "Professional graphic design services for logos, banners, flyers, catalogs, and advertising materials.",
                "short_description": "Diseño profesional para tu marca",
                "short_description_en": "Professional design for your brand",
            },
            {
                "service_id": "impresion-offset-serigrafia",
                "name": "Impresión offset, serigrafía y sublimación",
                "name_en": "Offset, Screen Printing & Sublimation",
                "description": "Impresión de alta calidad para tarjetas de presentación, volantes, papelería corporativa y productos promocionales.",
                "description_en": "High-quality printing for business cards, flyers, corporate stationery, and promotional products.",
                "short_description": "Impresión de calidad para papelería",
                "short_description_en": "Quality printing for stationery",
            },
        ]

        created_count = 0
        existing_count = 0

        for data in services_data:
            service_id = data.pop("service_id")
            slug = service_id  # Use the service ID as slug for consistency

            service, created = CatalogItem.objects.get_or_create(
                slug=slug,
                defaults={
                    **data,
                    "category": services_cat,
                    "type": "service",
                    "sale_mode": "QUOTE",
                    "is_active": True,
                    "is_featured": True,
                }
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"[OK] Created service: {service.name}")
                )
            else:
                existing_count += 1
                self.stdout.write(
                    self.style.WARNING(f"[--] Service already exists: {service.name}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n[OK] Landing services loaded: {created_count} created, {existing_count} existing"
            )
        )
