"""
Tests for promote_to_admin management command
"""

from django.test import TestCase
from django.core.management import call_command
from django.core.management.base import CommandError
from io import StringIO

from apps.users.models import User, Role
from apps.audit.models import AuditLog


class PromoteToAdminCommandTest(TestCase):
    """Test the promote_to_admin management command"""

    def setUp(self):
        """Set up test fixtures"""
        # Create roles
        self.admin_role = Role.objects.create(
            name='admin',
            display_name='Administrator',
            description='Full admin access'
        )
        self.sales_role = Role.objects.create(
            name='sales',
            display_name='Sales',
            description='Sales access'
        )

        self.production_role = Role.objects.create(
            name='production',
            display_name='Production',
            description='Production access'
        )

        # Create test user
        self.test_user = User.objects.create_user(
            email='test@example.com',
            password='secure_password',
            first_name='Test',
            last_name='User',
            is_email_verified=True
        )

    def test_promote_user_success(self):
        """Test successful promotion of user to admin"""
        out = StringIO()

        # Promote user with --no-input flag
        call_command('promote_to_admin', 'test@example.com', '--no-input', stdout=out)

        # Refresh from DB
        self.test_user.refresh_from_db()

        # Verify user is now admin
        self.assertTrue(self.test_user.is_staff)
        self.assertEqual(self.test_user.role, self.admin_role)

        # Verify audit log created
        audit_logs = AuditLog.objects.filter(
            entity_id=str(self.test_user.id),
            metadata__action_type='admin_promotion'
        )
        self.assertTrue(audit_logs.exists())

    def test_promote_user_to_sales(self):
        """Test promotion to sales role"""
        out = StringIO()

        call_command(
            'promote_to_admin',
            'test@example.com',
            '--role', 'sales',
            '--no-input',
            stdout=out
        )

        self.test_user.refresh_from_db()
        self.assertTrue(self.test_user.is_staff)
        self.assertEqual(self.test_user.role, self.sales_role)

    def test_promote_user_to_production(self):
        """Test promotion to production role"""
        out = StringIO()

        call_command(
            'promote_to_admin',
            'test@example.com',
            '--role', 'production',
            '--no-input',
            stdout=out
        )

        self.test_user.refresh_from_db()
        self.assertTrue(self.test_user.is_staff)
        self.assertEqual(self.test_user.role, self.production_role)

    def test_user_not_found(self):
        """Test error when user doesn't exist"""
        with self.assertRaises(CommandError) as ctx:
            call_command('promote_to_admin', 'nonexistent@example.com', '--no-input')

        self.assertIn('does not exist', str(ctx.exception))

    def test_already_admin(self):
        """Test error when user is already admin"""
        self.test_user.role = self.admin_role
        self.test_user.is_staff = True
        self.test_user.save()

        with self.assertRaises(CommandError) as ctx:
            call_command('promote_to_admin', 'test@example.com', '--no-input')

        self.assertIn('already an administrator', str(ctx.exception))

    def test_deleted_user(self):
        """Test error when trying to promote deleted user"""
        self.test_user.delete()  # Soft delete

        with self.assertRaises(CommandError) as ctx:
            call_command('promote_to_admin', 'test@example.com', '--no-input')

        self.assertIn('deleted', str(ctx.exception))

    def test_invalid_email(self):
        """Test error with invalid email format"""
        with self.assertRaises(CommandError) as ctx:
            call_command('promote_to_admin', 'not-an-email', '--no-input')

        self.assertIn('Invalid email', str(ctx.exception))

    def test_audit_trail_recorded(self):
        """Test that action is properly recorded in audit trail"""
        call_command('promote_to_admin', 'test@example.com', '--no-input')

        audit_log = AuditLog.objects.get(
            entity_id=str(self.test_user.id),
            metadata__action_type='admin_promotion'
        )

        self.assertEqual(audit_log.action, AuditLog.ACTION_UPDATED)
        self.assertIn('admin', audit_log.metadata['role_assigned'])
        self.assertEqual(audit_log.metadata['promoted_by'], 'management_command')
