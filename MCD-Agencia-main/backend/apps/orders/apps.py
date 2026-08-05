"""
Orders Application Configuration.
"""

from django.apps import AppConfig


class OrdersConfig(AppConfig):
    """Configuration for the Orders application."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.orders'
    verbose_name = 'Orders'

    def ready(self):
        """Import signal handlers when app is ready."""
        import apps.orders.signals  # noqa: F401
