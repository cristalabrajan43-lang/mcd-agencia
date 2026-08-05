"""
Command to load sample products for the catalog.
Usage: python manage.py load_sample_products
"""

from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from apps.catalog.models import Category, CatalogItem, CatalogImage
from PIL import Image
from io import BytesIO
import random


def create_test_image(width=400, height=400, color_name="test"):
    """Create a simple test image."""
    colors = {
        "red": (220, 53, 69),
        "blue": (13, 110, 253),
        "green": (25, 135, 84),
        "yellow": (255, 193, 7),
        "cyan": (13, 217, 228),
        "magenta": (229, 0, 217),
        "orange": (253, 126, 20),
        "purple": (111, 66, 193),
    }
    
    color = colors.get(color_name, colors["blue"])
    img = Image.new("RGB", (width, height), color)
    
    # Add text
    try:
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        text = f"{width}x{height}\n{color_name.upper()}"
        draw.text((width//2 - 30, height//2 - 20), text, fill=(255, 255, 255))
    except:
        pass
    
    # Save to BytesIO
    img_io = BytesIO()
    img.save(img_io, format="PNG")
    img_io.seek(0)
    return img_io


class Command(BaseCommand):
    help = "Load sample products for the catalog"

    def handle(self, *args, **options):
        self.stdout.write("Loading sample products...")

        # Create main categories
        lonas_cat, _ = Category.objects.get_or_create(
            name="Lonas",
            defaults={"name_en": "Canvas", "slug": "lonas"}
        )
        vinilos_cat, _ = Category.objects.get_or_create(
            name="Vinilos",
            defaults={"name_en": "Vinyl", "slug": "vinilos"}
        )
        senaletica_cat, _ = Category.objects.get_or_create(
            name="Señalética",
            defaults={"name_en": "Signage", "slug": "senaletica"}
        )

        # Sample products
        products_data = [
            {
                "category": lonas_cat,
                "name": "Lona Grande Impresa 5x3m",
                "name_en": "Large Printed Canvas 5x3m",
                "description": "Lona publicitaria de gran formato para exterior",
                "description_en": "Large format advertising canvas for outdoor use",
                "short_description": "Lona 5x3 metros para publicidad exterior",
                "short_description_en": "5x3 meter canvas for outdoor advertising",
                "base_price": 1500.00,
                "compare_at_price": 2000.00,
                "sale_mode": "QUOTE",
                "color": "yellow",
            },
            {
                "category": lonas_cat,
                "name": "Lona Mediana Impresa 3x2m",
                "name_en": "Medium Printed Canvas 3x2m",
                "description": "Lona de tamaño medio para espacios interiores y exteriores",
                "description_en": "Medium-sized canvas for indoor and outdoor spaces",
                "short_description": "Lona 3x2 metros versátil",
                "short_description_en": "Versatile 3x2 meter canvas",
                "base_price": 800.00,
                "compare_at_price": 1100.00,
                "sale_mode": "QUOTE",
                "color": "cyan",
            },
            {
                "category": vinilos_cat,
                "name": "Vinilo Rotulación Vehícular",
                "name_en": "Vehicle Vinyl Lettering",
                "description": "Vinilo de alta calidad para rotulación de vehículos",
                "description_en": "High-quality vinyl for vehicle lettering",
                "short_description": "Vinilo para rotular vehículos",
                "short_description_en": "Vinyl for vehicle lettering",
                "base_price": 600.00,
                "compare_at_price": 850.00,
                "sale_mode": "QUOTE",
                "color": "red",
            },
            {
                "category": vinilos_cat,
                "name": "Vinilo Decorativo Vidriera",
                "name_en": "Decorative Window Vinyl",
                "description": "Vinilo decorativo para vidriera y espacios interiores",
                "description_en": "Decorative vinyl for storefronts and interior spaces",
                "short_description": "Vinilo decorativo para vidrieras",
                "short_description_en": "Decorative vinyl for windows",
                "base_price": 450.00,
                "compare_at_price": 650.00,
                "sale_mode": "BUY",
                "color": "magenta",
            },
            {
                "category": senaletica_cat,
                "name": "Señal de Seguridad Acrílico",
                "name_en": "Safety Sign Acrylic",
                "description": "Señal de seguridad en material acrílico duradero",
                "description_en": "Safety sign in durable acrylic material",
                "short_description": "Señal de seguridad en acrílico",
                "short_description_en": "Acrylic safety sign",
                "base_price": 250.00,
                "compare_at_price": 350.00,
                "sale_mode": "BUY",
                "color": "green",
            },
            {
                "category": senaletica_cat,
                "name": "Placa Corporativa PVC",
                "name_en": "Corporate PVC Plate",
                "description": "Placa corporativa en PVC de alta calidad",
                "description_en": "High-quality corporate PVC plate",
                "short_description": "Placa corporativa en PVC",
                "short_description_en": "Corporate PVC plate",
                "base_price": 350.00,
                "compare_at_price": 500.00,
                "sale_mode": "BUY",
                "color": "blue",
            },
            {
                "category": lonas_cat,
                "name": "Lona Pequeña Impresa 1.5x1m",
                "name_en": "Small Printed Canvas 1.5x1m",
                "description": "Lona pequeña ideal para puntos de venta y espacios reducidos",
                "description_en": "Small canvas ideal for point of sale and small spaces",
                "short_description": "Lona 1.5x1 metros compacta",
                "short_description_en": "Compact 1.5x1 meter canvas",
                "base_price": 350.00,
                "compare_at_price": 500.00,
                "sale_mode": "BUY",
                "color": "orange",
            },
            {
                "category": vinilos_cat,
                "name": "Vinilo Mate Premium",
                "name_en": "Premium Matte Vinyl",
                "description": "Vinilo mate de premium para aplicaciones especiales",
                "description_en": "Premium matte vinyl for special applications",
                "short_description": "Vinilo mate de alta calidad",
                "short_description_en": "High-quality matte vinyl",
                "base_price": 550.00,
                "compare_at_price": 750.00,
                "sale_mode": "BUY",
                "color": "purple",
            },
        ]

        for idx, data in enumerate(products_data):
            color = data.pop("color")
            slug = data["name"].lower().replace(" ", "-").replace("ú", "u").replace("á", "a")
            
            product, created = CatalogItem.objects.get_or_create(
                slug=slug,
                defaults={
                    **data,
                    "is_active": True,
                    "is_featured": idx < 4,  # Feature first 4 products
                }
            )

            if created:
                # Add sample image
                img_io = create_test_image(400, 400, color)
                image_file = ContentFile(img_io.read(), name=f"{slug}-main.png")
                
                CatalogImage.objects.get_or_create(
                    catalog_item=product,
                    position=0,
                    defaults={
                        "image": image_file,
                        "alt_text": data["name"],
                    }
                )
                
                self.stdout.write(
                    self.style.SUCCESS(f"✓ Created product: {product.name}")
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f"⊘ Product already exists: {product.name}")
                )

        self.stdout.write(
            self.style.SUCCESS("\n✓ Sample products loaded successfully!")
        )
