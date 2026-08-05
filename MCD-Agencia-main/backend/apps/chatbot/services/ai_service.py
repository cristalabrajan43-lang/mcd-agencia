"""
AI Service Abstraction Layer for MCD-Agencia Chatbot.

Provides a pluggable interface so you can swap AI providers
(Gemini, OpenAI, Claude, etc.) by changing one setting.

Usage:
    from apps.chatbot.services import get_ai_service
    service = get_ai_service()
    response = await service.generate_response(message, history, language)
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class ChatResponse:
    """Standardized response from any AI provider."""

    content: str
    intent: str = ''
    confidence: Optional[float] = None
    suggestions: list = field(default_factory=list)
    actions: list = field(default_factory=list)
    source: str = 'ai'  # 'ai', 'predefined', 'fallback'
    should_escalate: bool = False
    whatsapp_links: Optional[dict] = None
    metadata: dict = field(default_factory=dict)


class BaseAIService(ABC):
    """
    Abstract base class for AI chat services.

    To add a new provider (e.g., OpenAI), create a new class
    that extends this and implement generate_response().
    Then register it in get_ai_service().
    """

    @abstractmethod
    def generate_response(
        self,
        message: str,
        history: list = None,
        language: str = 'es',
        session_id: str = '',
    ) -> ChatResponse:
        """
        Generate a chat response.

        Args:
            message: User's message text
            history: List of previous messages [{role, content}, ...]
            language: 'es' or 'en'
            session_id: Conversation session ID

        Returns:
            ChatResponse with the AI's reply
        """
        pass

    @abstractmethod
    def get_config(self, language: str = 'es') -> dict:
        """
        Get chatbot widget configuration.

        Args:
            language: 'es' or 'en'

        Returns:
            Dict with name, welcome_message, is_active, quick_actions
        """
        pass


class FallbackService(BaseAIService):
    """
    Fallback service when no AI provider is configured.
    Uses simple keyword matching (the original behavior).
    """

    WHATSAPP_LINKS = {
        'acapulco': 'https://wa.me/527446887382',
        'tecoanapa': 'https://wa.me/527451147727',
    }

    def generate_response(self, message, history=None, language='es', session_id=''):
        content_lower = message.lower()
        is_es = language == 'es'

        if any(w in content_lower for w in ['hola', 'hello', 'hi', 'buenos', 'buenas']):
            return ChatResponse(
                content='¡Hola! 👋 Bienvenido a Agencia MCD. ¿En qué puedo ayudarte?' if is_es
                else 'Hello! 👋 Welcome to Agencia MCD. How can I help you?',
                intent='greeting',
                confidence=0.95,
                source='predefined',
                suggestions=[
                    'Ver catálogo' if is_es else 'View catalog',
                    'Solicitar cotización' if is_es else 'Request a quote',
                    'Contactar asesor' if is_es else 'Contact advisor',
                ],
            )

        if any(w in content_lower for w in ['cotización', 'cotizacion', 'quote', 'presupuesto']):
            return ChatResponse(
                content='¡Con gusto te ayudo con una cotización! Puedes llenar el formulario o contactarnos por WhatsApp.' if is_es
                else 'I\'d be happy to help with a quote! You can fill out the form or contact us via WhatsApp.',
                intent='quote_request',
                confidence=0.9,
                source='predefined',
                suggestions=[
                    'Ir al formulario' if is_es else 'Go to form',
                    'WhatsApp' if is_es else 'WhatsApp',
                ],
                should_escalate=True,
                whatsapp_links=self.WHATSAPP_LINKS,
            )

        # Default
        return ChatResponse(
            content='Gracias por tu mensaje. Te recomiendo contactar a un asesor para una atención personalizada.' if is_es
            else 'Thanks for your message. I recommend contacting an advisor for personalized assistance.',
            intent='unknown',
            confidence=0.3,
            source='fallback',
            should_escalate=True,
            whatsapp_links=self.WHATSAPP_LINKS,
            suggestions=[
                'WhatsApp Acapulco' if is_es else 'WhatsApp Acapulco',
                'WhatsApp Tecoanapa' if is_es else 'WhatsApp Tecoanapa',
            ],
        )

    def get_config(self, language='es'):
        is_es = language == 'es'
        return {
            'name': 'Agencia MCD Bot',
            'welcome_message': '¡Hola! 👋 Soy el asistente virtual de Agencia MCD. ¿En qué puedo ayudarte?'
            if is_es else 'Hello! 👋 I\'m the virtual assistant of Agencia MCD. How can I help you?',
            'is_active': True,
            'quick_actions': [
                {'id': 'services', 'label': 'Servicios' if is_es else 'Services',
                 'message': 'Quiero conocer los servicios' if is_es else 'I want to know about services'},
                {'id': 'quote', 'label': 'Cotización' if is_es else 'Quote',
                 'message': 'Quiero solicitar una cotización' if is_es else 'I want to request a quote'},
                {'id': 'location', 'label': 'Ubicación' if is_es else 'Location',
                 'message': 'Dónde están ubicados' if is_es else 'Where are you located'},
                {'id': 'catalog', 'label': 'Catálogo' if is_es else 'Catalog',
                 'message': 'Quiero ver el catálogo' if is_es else 'I want to see the catalog'},
            ],
        }


def get_ai_service() -> BaseAIService:
    """
    Factory function that returns the configured AI service.

    Configure via CHATBOT_AI_PROVIDER in settings:
        - 'gemini': Google Gemini (default if API key present)
        - 'openai': OpenAI GPT (future)
        - 'fallback': Simple keyword matching

    To switch providers, just change the setting. No other code changes needed.
    """
    provider = getattr(settings, 'CHATBOT_AI_PROVIDER', 'auto')

    if provider == 'auto':
        # Auto-detect: use Gemini if key exists, otherwise fallback
        if getattr(settings, 'GEMINI_API_KEY', ''):
            provider = 'gemini'
        else:
            provider = 'fallback'

    if provider == 'gemini':
        try:
            from .gemini_provider import GeminiService
            return GeminiService()
        except Exception as e:
            logger.error(f'Failed to initialize Gemini service: {e}')
            return FallbackService()

    if provider == 'openai':
        # Future: from .openai_provider import OpenAIService
        logger.warning('OpenAI provider not yet implemented, using fallback')
        return FallbackService()

    return FallbackService()
