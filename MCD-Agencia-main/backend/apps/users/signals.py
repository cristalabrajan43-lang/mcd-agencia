"""
User Signals for MCD-Agencia.

This module contains signal handlers for user-related events:
    - Assign default role on user creation
    - Create audit log entries
    - Send notifications
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import User, Role


@receiver(post_save, sender=User)
def assign_default_role(sender, instance, created, **kwargs):
    """
    Assign default customer role to new users.

    When a new user is created without a role, this signal assigns
    the 'customer' role by default.

    Args:
        sender: The User model class
        instance: The User instance being saved
        created: Whether this is a new user
        **kwargs: Additional arguments
    """
    if created and not instance.role and not instance.is_superuser:
        try:
            customer_role = Role.objects.get(name=Role.CUSTOMER)
            instance.role = customer_role
            instance.save(update_fields=['role'])
        except Role.DoesNotExist:
            pass  # Role will be created in migrations


@receiver(pre_save, sender=User)
def sync_is_staff_with_role(sender, instance, **kwargs):
    """
    Automatically sync is_staff based on the user's role.

    Admin and Sales roles require is_staff=True for Django permissions
    and staff-only views. Customer role sets is_staff=False.
    """
    if instance.role_id:
        try:
            role_name = instance.role.name if instance.role else None
        except Role.DoesNotExist:
            role_name = None

        if role_name in (Role.ADMIN, Role.SALES):
            instance.is_staff = True
        elif role_name == Role.CUSTOMER:
            # Don't demote superusers
            if not instance.is_superuser:
                instance.is_staff = False


@receiver(pre_save, sender=User)
def normalize_email(sender, instance, **kwargs):
    """
    Normalize email address before saving.

    Ensures email addresses are stored in lowercase for consistent lookups.

    Args:
        sender: The User model class
        instance: The User instance being saved
        **kwargs: Additional arguments
    """
    if instance.email:
        instance.email = instance.email.lower().strip()
