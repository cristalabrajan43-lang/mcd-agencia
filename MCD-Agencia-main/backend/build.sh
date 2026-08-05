#!/usr/bin/env bash
# =============================================================================
# Render Build Script for MCD-Agencia Backend
# =============================================================================
# This script runs during Render's build step.
# It installs dependencies, runs migrations, and collects static files.
# =============================================================================

set -o errexit  # Exit on error

echo "=== Installing system dependencies (WeasyPrint, etc.) ==="
apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

echo "=== Installing Python dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Collecting static files ==="
python manage.py collectstatic --noinput

echo "=== Running database migrations ==="
python manage.py migrate --noinput

echo "=== Backfilling operational tracks for existing orders ==="
python manage.py backfill_operational_tracks --max-orders 500

echo "=== Migrating request numbers to sequential format ==="
python manage.py migrate_request_numbers

echo "=== Migrating quote numbers to sequential format ==="
python manage.py migrate_quote_numbers

echo "=== Recalculating urgency ==="
python manage.py recalculate_urgency

echo "=== Creating default roles ==="
python manage.py shell -c "
from apps.users.models import Role

# Define the 3 active roles with their permissions
roles_data = [
    {
        'name': 'admin',
        'display_name': 'Administrator',
        'description': 'Full administrative access to all system features.',
        'is_system': True,
        'permissions': {
            'catalog': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'orders': {'view': True, 'create': True, 'edit': True, 'delete': True, 'manage': True},
            'quotes': {'view': True, 'create': True, 'edit': True, 'delete': True, 'respond': True, 'assign': True},
            'users': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'inventory': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'content': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'payments': {'view': True, 'manage': True},
            'audit': {'view': True},
            'chatbot': {'view': True, 'manage': True},
            'analytics': {'view': True},
        },
    },
    {
        'name': 'sales',
        'display_name': 'Sales',
        'description': 'Commercial operations: quotes, orders, customers.',
        'is_system': True,
        'permissions': {
            'catalog': {'view': True},
            'orders': {'view': True, 'create': True, 'edit': True},
            'quotes': {'view': True, 'create': True, 'edit': True, 'respond': True},
            'users': {'view': True},
            'inventory': {'view': True},
            'chatbot': {'view': True},
        },
    },
    {
        'name': 'customer',
        'display_name': 'Customer',
        'description': 'End-user access to own orders and quotes.',
        'is_system': True,
        'permissions': {
            'catalog': {'view': True},
            'orders': {'view': True, 'create': True},
            'quotes': {'view': True, 'create': True},
        },
    },
]

for role_data in roles_data:
    role, created = Role.objects.update_or_create(
        name=role_data['name'],
        defaults=role_data,
    )
    status = 'Created' if created else 'Updated'
    print(f'{status} role: {role.display_name}')

print('Default roles ready.')
"

echo "=== Creating superuser if needed ==="
python manage.py shell -c "
from apps.users.models import User, Role
import os
email = os.getenv('DJANGO_SUPERUSER_EMAIL', '')
password = os.getenv('DJANGO_SUPERUSER_PASSWORD', '')
if email and password:
    admin_role = Role.objects.filter(name='admin').first()
    if not User.objects.filter(email=email).exists():
        user = User.objects.create_superuser(email=email, password=password)
        user.first_name = 'Admin'
        user.role = admin_role
        user.is_email_verified = True
        user.save()
        print(f'Superuser {email} created with admin role')
    else:
        user = User.objects.get(email=email)
        updated = False
        user.set_password(password)
        updated = True
        if user.role != admin_role:
            user.role = admin_role
            updated = True
        if not user.is_email_verified:
            user.is_email_verified = True
            updated = True
        if not user.is_staff:
            user.is_staff = True
            updated = True
        if not user.is_superuser:
            user.is_superuser = True
            updated = True
        if updated:
            user.save()
            print(f'Superuser {email} updated with admin role and password')
        else:
            print(f'Superuser {email} already has admin role')
else:
    print('No DJANGO_SUPERUSER_EMAIL/PASSWORD set, skipping superuser creation')
"

echo "=== Syncing is_staff flag with user roles ==="
python manage.py shell -c "
from apps.users.models import User, Role

# Sales and admin users must have is_staff=True
staff_updated = User.objects.filter(
    role__name__in=['admin', 'sales'],
    is_staff=False,
    is_active=True,
).update(is_staff=True)
print(f'Set is_staff=True for {staff_updated} admin/sales users')

# Customer users should have is_staff=False (except superusers)
customer_updated = User.objects.filter(
    role__name='customer',
    is_staff=True,
    is_superuser=False,
).update(is_staff=False)
print(f'Set is_staff=False for {customer_updated} customer users')

print('is_staff sync completed.')
"

echo "=== Fixing corrupted route prices in service_details ==="
python manage.py fix_route_prices --apply

echo "=== Build completed successfully ==="
