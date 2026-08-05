"""
Google Gemini AI Provider for MCD-Agencia Chatbot.

Uses Gemini 2.0 Flash (free tier: 1,500 req/day).
To switch to another provider, create a similar class
extending BaseAIService and register it in ai_service.py.
"""

import logging
from typing import Optional

from django.conf import settings

from .ai_service import BaseAIService, ChatResponse
from .context_builder import build_business_context

logger = logging.getLogger(__name__)

# WhatsApp links for escalation
WHATSAPP_LINKS = {
    'acapulco': 'https://wa.me/527446887382',
    'tecoanapa': 'https://wa.me/527451147727',
}


def _get_system_prompt(language: str) -> str:
    """Build the system prompt with business context."""
    business_context = build_business_context(language)
    is_es = language == 'es'

    if is_es:
        return f"""Eres el asistente virtual de Agencia de Publicidad MCD, una agencia de publicidad ubicada en Guerrero, México.

REGLAS IMPORTANTES:
1. Responde SIEMPRE en español (a menos que el usuario escriba en inglés).
2. Sé amable, profesional y conciso. Máximo 2-3 oraciones por respuesta.
4. Tu objetivo es ayudar al cliente y dirigirlo a la acción correcta: cotizar, ver el catálogo, o contactar a un asesor.
5. Si el cliente pregunta por precios específicos, explica que los precios varían según las especificaciones y sugiere solicitar una cotización personalizada.
6. Si el cliente quiere hablar con un humano o no puedes resolver su duda, sugiere contactar por WhatsApp.
7. NUNCA inventes información que no esté en el contexto proporcionado.
8. Si no sabes algo, dilo honestamente y ofrece alternativas (WhatsApp, formulario de cotización).
9. Usa emojis ocasionalmente para ser amigable (pero no en exceso).
10. NO uses markdown (**, ##, etc.) en tus respuestas — son para un chat widget, solo texto plano.

ACCIONES QUE PUEDES SUGERIR:
- Solicitar cotización: https://agenciamcd.mx/es/cotizar
- Ver catálogo: https://agenciamcd.mx/es/catalogo
- WhatsApp Acapulco: https://wa.me/527446887382
- WhatsApp Tecoanapa: https://wa.me/527451147727

{business_context}"""
    else:
        return f"""You are the virtual assistant of Agencia de Publicidad MCD, an advertising agency located in Guerrero, Mexico.

IMPORTANT RULES:
1. ALWAYS respond in English.
2. Be friendly, professional, and concise. Maximum 2-3 sentences per response.
4. Your goal is to help the customer and direct them to the right action: request a quote, browse the catalog, or contact an advisor.
5. If the customer asks for specific prices, explain that prices vary by specification and suggest requesting a custom quote.
6. If the customer wants to speak with a human or you can't resolve their question, suggest contacting via WhatsApp.
7. NEVER make up information that isn't in the provided context.
8. If you don't know something, say so honestly and offer alternatives (WhatsApp, quote form).
9. Use emojis occasionally to be friendly (but not excessively).
10. Do NOT use markdown (**, ##, etc.) in your responses — this is for a chat widget, plain text only.

ACTIONS YOU CAN SUGGEST:
- Request a quote: https://agenciamcd.mx/en/cotizar
- Browse catalog: https://agenciamcd.mx/en/catalogo
- WhatsApp Acapulco: https://wa.me/527446887382
- WhatsApp Tecoanapa: https://wa.me/527451147727

{business_context}"""


class GeminiService(BaseAIService):
    """
    Google Gemini AI service implementation.

    Uses google-generativeai SDK with Gemini 2.0 Flash.
    Free tier: 15 RPM, 1,500 RPD, 1M TPM.
    """

    def __init__(self):
        """Initialize Gemini client."""
        from google import genai

        api_key = getattr(settings, 'GEMINI_API_KEY', '')
        if not api_key:
            raise ValueError('GEMINI_API_KEY not configured in settings')

        self.client = genai.Client(api_key=api_key)
        self.model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash')
        logger.info(f'Gemini service initialized with model: {self.model_name}')

    def generate_response(
        self,
        message: str,
        history: list = None,
        language: str = 'es',
        session_id: str = '',
    ) -> ChatResponse:
        """Generate response using Gemini."""
        try:
            from google.genai import types

            system_prompt = _get_system_prompt(language)

            # Build conversation history for Gemini
            contents = []

            # Add conversation history
            if history:
                for msg in history[-8:]:  # Last 8 messages for context
                    role = 'model' if msg.get('role') == 'assistant' else 'user'
                    contents.append(
                        types.Content(
                            role=role,
                            parts=[types.Part.from_text(text=msg.get('content', ''))],
                        )
                    )

            # Add current message
            contents.append(
                types.Content(
                    role='user',
                    parts=[types.Part.from_text(text=message)],
                )
            )

            # Call Gemini with system instruction
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=500,
                    temperature=0.7,
                    top_p=0.9,
                    safety_settings=[
                        types.SafetySetting(
                            category='HARM_CATEGORY_HARASSMENT',
                            threshold='BLOCK_ONLY_HIGH',
                        ),
                        types.SafetySetting(
                            category='HARM_CATEGORY_HATE_SPEECH',
                            threshold='BLOCK_ONLY_HIGH',
                        ),
                        types.SafetySetting(
                            category='HARM_CATEGORY_SEXUALLY_EXPLICIT',
                            threshold='BLOCK_ONLY_HIGH',
                        ),
                        types.SafetySetting(
                            category='HARM_CATEGORY_DANGEROUS_CONTENT',
                            threshold='BLOCK_ONLY_HIGH',
                        ),
                    ],
                ),
            )

            if not response or not response.candidates:
                logger.warning('Empty response from Gemini')
                return self._fallback_response(language)

            # Extract text — handle both regular and "thinking" models
            ai_text = ''
            if response.text:
                ai_text = response.text.strip()
            else:
                # For thinking models (2.5+), text may be in parts
                for part in response.candidates[0].content.parts:
                    if part.text and not getattr(part, 'thought', False):
                        ai_text = part.text.strip()
                        break

            if not ai_text:
                logger.warning('No text content in Gemini response')
                return self._fallback_response(language)

            # Detect intent from response content
            intent, should_escalate = self._detect_intent(message, ai_text, language)

            # Build suggestions based on intent
            suggestions = self._build_suggestions(intent, language)

            return ChatResponse(
                content=ai_text,
                intent=intent,
                confidence=0.85,
                suggestions=suggestions,
                source='ai',
                should_escalate=should_escalate,
                whatsapp_links=WHATSAPP_LINKS if should_escalate else None,
                metadata={'model': getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash')},
            )

        except Exception as e:
            logger.error(f'Gemini API error: {e}', exc_info=True)
            return self._fallback_response(language)

    def get_config(self, language: str = 'es') -> dict:
        """Get chatbot widget configuration."""
        is_es = language == 'es'
        return {
            'name': 'Asistente MCD' if is_es else 'MCD Assistant',
            'welcome_message': '¡Hola! 👋 Soy el asistente virtual de Agencia MCD, potenciado con inteligencia artificial. Puedo ayudarte con información sobre nuestros servicios, productos, sucursales y más. ¿En qué te puedo ayudar?'
            if is_es else 'Hello! 👋 I\'m the AI-powered virtual assistant of Agencia MCD. I can help you with information about our services, products, branches, and more. How can I help you?',
            'is_active': True,
            'quick_actions': [
                {'id': 'services', 'label': '🎨 Servicios' if is_es else '🎨 Services',
                 'message': '¿Qué servicios ofrecen?' if is_es else 'What services do you offer?'},
                {'id': 'quote', 'label': '📋 Cotizar' if is_es else '📋 Quote',
                 'message': 'Quiero solicitar una cotización' if is_es else 'I want to request a quote'},
                {'id': 'catalog', 'label': '🛒 Catálogo' if is_es else '🛒 Catalog',
                 'message': 'Quiero ver el catálogo de productos' if is_es else 'I want to see the product catalog'},
                {'id': 'location', 'label': '📍 Ubicación' if is_es else '📍 Location',
                 'message': '¿Dónde están ubicados?' if is_es else 'Where are you located?'},
                {'id': 'contact', 'label': '💬 Asesor' if is_es else '💬 Advisor',
                 'message': 'Quiero hablar con un asesor' if is_es else 'I want to speak with an advisor'},
            ],
        }

    def _detect_intent(self, user_message: str, ai_response: str, language: str) -> tuple:
        """Detect intent and whether to escalate."""
        combined = (user_message + ' ' + ai_response).lower()

        # Escalation keywords
        escalate_keywords = [
            'whatsapp', 'asesor', 'advisor', 'humano', 'human',
            'representante', 'representative', 'llamar', 'call',
            'hablar con alguien', 'speak with someone',
        ]

        should_escalate = any(kw in combined for kw in escalate_keywords)

        # Intent detection
        msg_lower = user_message.lower()
        if any(w in msg_lower for w in ['cotiz', 'quote', 'presupuesto', 'budget']):
            return 'quote_request', should_escalate
        if any(w in msg_lower for w in ['precio', 'price', 'costo', 'cost', 'cuanto', 'how much']):
            return 'pricing_inquiry', should_escalate
        if any(w in msg_lower for w in ['catálogo', 'catalogo', 'catalog', 'producto', 'product']):
            return 'catalog_inquiry', False
        if any(w in msg_lower for w in ['servicio', 'service', 'ofrecen', 'offer']):
            return 'service_inquiry', False
        if any(w in msg_lower for w in ['ubicación', 'ubicacion', 'location', 'dirección', 'direccion', 'donde', 'where']):
            return 'location_inquiry', False
        if any(w in msg_lower for w in ['horario', 'hours', 'schedule', 'abierto', 'open']):
            return 'hours_inquiry', False
        if any(w in msg_lower for w in ['hola', 'hello', 'hi', 'buenos', 'buenas', 'hey']):
            return 'greeting', False
        if any(w in msg_lower for w in ['gracias', 'thanks', 'thank you']):
            return 'thanks', False
        if should_escalate:
            return 'escalation_request', True

        return 'general', should_escalate

    def _build_suggestions(self, intent: str, language: str) -> list:
        """Build contextual suggestions based on intent."""
        is_es = language == 'es'

        suggestions_map = {
            'greeting': [
                'Ver servicios' if is_es else 'View services',
                'Solicitar cotización' if is_es else 'Request a quote',
                'Ver catálogo' if is_es else 'Browse catalog',
            ],
            'service_inquiry': [
                'Solicitar cotización' if is_es else 'Request a quote',
                'Ver catálogo' if is_es else 'Browse catalog',
                'Hablar con asesor' if is_es else 'Talk to advisor',
            ],
            'quote_request': [
                'Ir al formulario' if is_es else 'Go to form',
                'WhatsApp Acapulco',
                'WhatsApp Tecoanapa',
            ],
            'pricing_inquiry': [
                'Solicitar cotización' if is_es else 'Request a quote',
                'Ver catálogo' if is_es else 'Browse catalog',
            ],
            'catalog_inquiry': [
                'Solicitar cotización' if is_es else 'Request a quote',
                'Hablar con asesor' if is_es else 'Talk to advisor',
            ],
            'location_inquiry': [
                'WhatsApp Acapulco',
                'WhatsApp Tecoanapa',
                'Ver servicios' if is_es else 'View services',
            ],
            'escalation_request': [
                'WhatsApp Acapulco',
                'WhatsApp Tecoanapa',
            ],
        }

        return suggestions_map.get(intent, [
            'Ver servicios' if is_es else 'View services',
            'Solicitar cotización' if is_es else 'Request a quote',
        ])

    def _fallback_response(self, language: str) -> ChatResponse:
        """Fallback when Gemini fails."""
        is_es = language == 'es'
        return ChatResponse(
            content='Lo siento, estoy teniendo problemas técnicos. Te invito a contactarnos directamente por WhatsApp para atención inmediata.'
            if is_es else 'I\'m sorry, I\'m experiencing technical issues. Please contact us directly via WhatsApp for immediate assistance.',
            intent='error',
            confidence=0.0,
            source='fallback',
            should_escalate=True,
            whatsapp_links=WHATSAPP_LINKS,
            suggestions=['WhatsApp Acapulco', 'WhatsApp Tecoanapa'],
        )
