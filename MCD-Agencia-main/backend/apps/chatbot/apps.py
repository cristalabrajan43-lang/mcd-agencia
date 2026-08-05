"""
Chatbot Application Configuration.
"""

from django.apps import AppConfig


class ChatbotConfig(AppConfig):
    """Configuration for the Chatbot application."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.chatbot'
    verbose_name = 'Chatbot'
