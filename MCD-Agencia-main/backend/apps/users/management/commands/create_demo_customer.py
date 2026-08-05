"""Create or reset the demo customer account for checkout testing."""

from django.core.management.base import BaseCommand

from apps.orders.models import Address
from apps.users.models import Role, User


class Command(BaseCommand):
    help = 'Create demo customer cliente@test.local for purchase/inventory testing'

    def handle(self, *args, **options):
        email = 'cliente@test.local'
        password = 'Cliente1234!'

        role, _ = Role.objects.get_or_create(
            name='customer',
            defaults={'display_name': 'Cliente'},
        )

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'first_name': 'Cliente',
                'last_name': 'Demo',
                'is_email_verified': True,
                'role': role,
                'is_active': True,
            },
        )
        user.set_password(password)
        user.role = role
        user.is_email_verified = True
        user.is_active = True
        user.save()

        shipping, _ = Address.objects.get_or_create(
            user=user,
            type='shipping',
            is_default=True,
            defaults={
                'name': 'Cliente Demo',
                'phone': '5512345678',
                'street': 'Av. Reforma',
                'exterior_number': '123',
                'neighborhood': 'Juárez',
                'city': 'Ciudad de México',
                'state': 'CDMX',
                'postal_code': '06600',
                'country': 'MX',
            },
        )

        billing, _ = Address.objects.get_or_create(
            user=user,
            type='billing',
            is_default=True,
            defaults={
                'name': 'Cliente Demo',
                'phone': '5512345678',
                'street': 'Av. Reforma',
                'exterior_number': '123',
                'neighborhood': 'Juárez',
                'city': 'Ciudad de México',
                'state': 'CDMX',
                'postal_code': '06600',
                'country': 'MX',
            },
        )

        action = 'creado' if created else 'actualizado'
        self.stdout.write(self.style.SUCCESS(f'Cliente demo {action}:'))
        self.stdout.write(f'  Email:    {email}')
        self.stdout.write(f'  Password: {password}')
        self.stdout.write(f'  Envío:    {shipping.id}')
        self.stdout.write(f'  Factura:  {billing.id}')
