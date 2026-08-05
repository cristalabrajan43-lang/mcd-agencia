"""
AI Chatbot Services for MCD-Agencia.

This package provides a pluggable AI service architecture:
    - ai_service.py: Abstract base + factory (swap providers easily)
    - gemini_provider.py: Google Gemini implementation
    - context_builder.py: Builds business context from DB for the AI
"""

from .ai_service import get_ai_service

__all__ = ['get_ai_service']
