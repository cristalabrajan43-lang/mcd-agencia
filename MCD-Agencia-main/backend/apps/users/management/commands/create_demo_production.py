"""Create or reset the demo production account."""

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from apps.users.models import Role, User


class Command(BaseCommand):
    help = 'Create demo production user produccion@test.local'

    def handle(self, *args, **options):
        email = 'produccion@test.local'
        password = 'Produccion1234!'

        role, _ = Role.objects.get_or_create(
            name=Role.PRODUCTION,
            defaults={
                'display_name': 'Production',
                'description': 'Production floor: manage orders and production jobs.',
                'is_system': True,
                'permissions': {
                    'catalog': {'view': True},
                    'orders': {'view': True, 'edit': True, 'manage': True},
                    'inventory': {'view': True},
                    'production': {'view': True, 'edit': True, 'manage': True},
                },
            },
        )

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'first_name': 'Producción',
                'last_name': 'Demo',
                'is_email_verified': True,
                'role': role,
                'is_active': True,
                'is_staff': True,
            },
        )
        user.set_password(password)
        user.role = role
        user.is_email_verified = True
        user.is_active = True
        user.is_staff = True
        user.save()

        group, _ = Group.objects.get_or_create(name='production_supervisors')
        user.groups.add(group)

        action = 'creado' if created else 'actualizado'
        self.stdout.write(self.style.SUCCESS(f'Usuario de producción {action}:'))
        self.stdout.write(f'  Email:    {email}')
        self.stdout.write(f'  Password: {password}')
