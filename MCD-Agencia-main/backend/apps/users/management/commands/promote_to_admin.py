"""
Management command to promote a user to administrator role.

Security features:
- Validates user exists before promotion
- Requires explicit confirmation via interactive prompt
- Logs all admin actions to AuditLog
- Prevents double promotions
- Only allows execution via command line (not API)

Usage:
    python manage.py promote_to_admin user@example.com
    python manage.py promote_to_admin --email user@example.com --no-input (for automation)
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import Permission, Group
from django.db import transaction

from apps.users.models import User, Role
from apps.audit.models import AuditLog


class Command(BaseCommand):
    help = 'Promote a user to administrator role (staff + admin role). Use with caution!'

    def add_arguments(self, parser):
        parser.add_argument(
            'email',
            nargs='?',
            type=str,
            help='Email address of user to promote to admin'
        )
        parser.add_argument(
            '--email',
            type=str,
            dest='email_arg',
            help='Email address (alternative way to specify)'
        )
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='Skip confirmation prompt (use only in automation with caution)'
        )
        parser.add_argument(
            '--role',
            type=str,
            default='admin',
            choices=['admin', 'sales', 'production', 'wholesale'],
            help='Role to assign: admin, sales, production, or wholesale vendor'
        )

    def handle(self, *args, **options):
        # Get email from arguments
        email = options.get('email') or options.get('email_arg')

        if not email:
            raise CommandError('❌ Error: Email address is required\nUsage: python manage.py promote_to_admin user@example.com')

        email = email.lower().strip()

        # Validate email format
        if '@' not in email:
            raise CommandError(f'❌ Error: Invalid email format: {email}')

        # Attempt to find user
        try:
            user = User.objects.select_related('role').get(email=email)
        except User.DoesNotExist:
            raise CommandError(f'❌ Error: User with email "{email}" does not exist')

        if user.is_deleted:
            raise CommandError(f'❌ Error: User "{email}" has been deleted and cannot be promoted')

        # Check if already admin
        role_name = getattr(user.role, 'name', None) if user.role else None
        if user.is_superuser or role_name in ['admin', 'superadmin']:
            raise CommandError(f'ℹ️  User "{email}" is already an administrator')

        # Get target role
        role_name = options.get('role', 'admin')
        try:
            target_role = Role.objects.get(name=role_name)
        except Role.DoesNotExist:
            raise CommandError(f'❌ Error: Role "{role_name}" does not exist')

        # Display user info
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.WARNING('🔐 ADMIN PROMOTION REQUEST'))
        self.stdout.write('=' * 70)
        self.stdout.write(f'Email:        {user.email}')
        self.stdout.write(f'Name:         {user.get_full_name()}')
        self.stdout.write(f'Current Role: {role_name if role_name else "None"}')
        self.stdout.write(f'New Role:     {target_role.display_name}')
        self.stdout.write(f'Active:       {"✅ Yes" if user.is_active else "❌ No"}')
        self.stdout.write(f'Email Verified: {"✅ Yes" if user.is_email_verified else "❌ No"}')
        self.stdout.write('=' * 70 + '\n')

        # Warn if email not verified
        if not user.is_email_verified:
            self.stdout.write(self.style.WARNING('⚠️  WARNING: User email is not verified'))

        # Get confirmation
        if not options.get('no_input'):
            confirm = input('Are you SURE you want to promote this user to administrator? (yes/no): ').lower().strip()
            if confirm not in ['yes', 'y']:
                self.stdout.write(self.style.ERROR('❌ Promotion cancelled'))
                return

        # Perform promotion in transaction
        try:
            with transaction.atomic():
                # Save previous state for audit
                old_state = {
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser,
                    'role': str(user.role),
                }

                # Update user
                user.is_staff = True
                user.role = target_role
                user.save(update_fields=['is_staff', 'role', 'updated_at'])

                # Log action to AuditLog
                AuditLog.objects.create(
                    entity_type='User',
                    entity_id=str(user.id),
                    action=AuditLog.ACTION_UPDATED,
                    actor_id=None,  # System action
                    before_state=old_state,
                    after_state={
                        'is_staff': user.is_staff,
                        'is_superuser': user.is_superuser,
                        'role': str(target_role),
                    },
                    request_path='/admin/promote_to_admin',
                    request_method='CLI',
                    metadata={
                        'action_type': 'admin_promotion',
                        'promoted_by': 'management_command',
                        'role_assigned': target_role.name,
                    },
                    ip_address='127.0.0.1',
                    user_agent='management-command',
                )

                self.stdout.write(self.style.SUCCESS(f'\n✅ SUCCESS: User "{email}" promoted to {target_role.display_name}'))
                self.stdout.write(self.style.SUCCESS(f'   Action logged to audit trail\n'))

        except Exception as e:
            raise CommandError(f'❌ Error during promotion: {str(e)}')
