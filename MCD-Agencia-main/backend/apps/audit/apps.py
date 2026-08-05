"""
Audit Application Configuration.
"""

from django.apps import AppConfig


class AuditConfig(AppConfig):
    """Configuration for the Audit application."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.audit'
    verbose_name = 'Audit'
