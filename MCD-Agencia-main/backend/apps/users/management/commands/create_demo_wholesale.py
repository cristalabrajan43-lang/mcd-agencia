"""Create or reset the demo vendor account."""

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.catalog.models import CatalogItem, Category
from apps.inventory.sync import sync_catalog_item_to_inventory
from apps.orders.models import Address
from apps.users.models import Role, User


class Command(BaseCommand):
    help = 'Create demo vendor vendedor@test.local'

    def handle(self, *args, **options):
        email = 'vendedor@test.local'
        password = 'Vendedor1234!'

        role, _ = Role.objects.get_or_create(
            name=Role.WHOLESALE,
            defaults={
                'display_name': 'Vendedor',
                'description': 'Vendedor: catálogo de insumos y pedidos de la agencia.',
                'is_system': True,
                'permissions': {
                    'catalog': {'view': True},
                    'orders': {'view': True, 'create': True},
                    'quotes': {'view': True, 'create': True},
                },
            },
        )
        role.display_name = 'Vendedor'
        role.description = 'Vendedor: catálogo de insumos y pedidos de la agencia.'
        role.save(update_fields=['display_name', 'description'])

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'first_name': 'Vendedor',
                'last_name': 'MCD',
                'company': 'MCD Agencia',
                'phone': '7446887382',
                'is_email_verified': True,
                'role': role,
                'is_active': True,
                'is_staff': True,
            },
        )
        user.set_password(password)
        user.role = role
        user.first_name = user.first_name or 'Vendedor'
        if user.last_name in ('', 'Mayoreo'):
            user.last_name = 'MCD'
        user.company = user.company or 'MCD Agencia'
        user.phone = user.phone or '7446887382'
        user.is_email_verified = True
        user.is_active = True
        user.is_staff = True
        user.save()

        Address.objects.get_or_create(
            user=user,
            type='shipping',
            is_default=True,
            defaults={
                'name': 'Vendedor MCD',
                'phone': '7446887382',
                'street': 'Av. Costera Miguel Alemán',
                'exterior_number': '100',
                'neighborhood': 'Costa Azul',
                'city': 'Acapulco de Juárez',
                'state': 'Guerrero',
                'postal_code': '39850',
                'country': 'MX',
            },
        )

        category, _ = Category.objects.get_or_create(
            slug='insumos-proveedor',
            defaults={
                'name': 'Insumos',
                'type': 'product',
                'is_active': True,
            },
        )

        samples = [
            ('Vinil adhesivo 3.20m', 'VIN-320', '1400.00', 25, 'Rollo de vinil calandrado para rotulación.'),
            ('Lona front 440g', 'LONA-440', '95.00', 80, 'Lona front para espectaculares, precio por m².'),
            ('Tinta solvente CMYK', 'TINTA-CMYK', '2200.00', 12, 'Kit de tintas solvente para plotter.'),
        ]
        created_items = 0
        for name, sku, price, stock, desc in samples:
            item, item_created = CatalogItem.objects.get_or_create(
                vendor=user,
                name=name,
                defaults={
                    'type': 'product',
                    'short_description': desc,
                    'description': desc,
                    'category': category,
                    'sale_mode': 'BUY',
                    'payment_mode': 'FULL',
                    'base_price': Decimal(price),
                    'track_inventory': True,
                    'is_active': True,
                    'is_featured': False,
                },
            )
            if item_created or not item.variants.filter(is_deleted=False).exists():
                sync_catalog_item_to_inventory(
                    item,
                    sku=sku,
                    initial_stock=stock,
                    threshold=5,
                    created_by=user,
                )
            if item_created:
                created_items += 1

        action = 'creado' if created else 'actualizado'
        self.stdout.write(self.style.SUCCESS(f'Vendedor {action}:'))
        self.stdout.write(f'  Email:    {email}')
        self.stdout.write(f'  Password: {password}')
        self.stdout.write('  Acceso:   catálogo de insumos y pedidos')
        if created_items:
            self.stdout.write(f'  Catálogo: {created_items} productos de ejemplo')
