"""
Payments Application Configuration.
"""

from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    """Configuration for the Payments application."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.payments'
    verbose_name = 'Payments'
