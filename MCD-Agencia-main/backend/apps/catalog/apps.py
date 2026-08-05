"""
Catalog Application Configuration.
"""

from django.apps import AppConfig


class CatalogConfig(AppConfig):
    """Configuration for the Catalog application."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.catalog'
    verbose_name = 'Catalog'

    def ready(self):
        """Import signal handlers when app is ready."""
        import apps.catalog.signals  # noqa: F401
