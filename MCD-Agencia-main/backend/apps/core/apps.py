"""
Core Application Configuration.

This module configures the core Django application.
"""

from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Configuration for the Core application."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    verbose_name = 'Core'

    def ready(self):
        """
        Perform initialization when the app is ready.

        This method is called once Django has finished loading all apps.
        Import signal handlers here to ensure they are registered.
        """
        pass  # Add signal imports here if needed
