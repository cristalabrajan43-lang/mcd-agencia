"""
Quotes Application Configuration.
"""

from django.apps import AppConfig


class QuotesConfig(AppConfig):
    """Configuration for the Quotes application."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.quotes'
    verbose_name = 'Quotes'

    def ready(self):
        """Import signal handlers when app is ready."""
        import apps.quotes.signals  # noqa: F401
