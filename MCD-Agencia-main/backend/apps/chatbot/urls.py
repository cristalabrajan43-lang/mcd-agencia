"""
Chatbot URLs for MCD-Agencia.

This module provides URL routing for chatbot endpoints:
    - Leads
    - Conversations
    - Chat messaging
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    LeadViewSet,
    PublicLeadCreateView,
    ConversationViewSet,
    ChatView,
    WebChatConfigView,
    WebChatMessageView,
    WebChatFeedbackView,
    ChatAnalyticsView,
    ChatbotHealthView,
    MessageViewSet,
)

app_name = 'chatbot'

router = DefaultRouter()
router.register('leads', LeadViewSet, basename='leads')
router.register('conversations', ConversationViewSet, basename='conversations')
router.register('messages', MessageViewSet, basename='messages')

urlpatterns = [
    # Public endpoints
    path('leads/create/', PublicLeadCreateView.as_view(), name='lead_create'),
    path('chat/', ChatView.as_view(), name='chat'),

    # Web chat widget endpoints (used by frontend ChatWidget)
    path('web-chat/config/', WebChatConfigView.as_view(), name='web_chat_config'),
    path('web-chat/message/', WebChatMessageView.as_view(), name='web_chat_message'),
    path('web-chat/feedback/', WebChatFeedbackView.as_view(), name='web_chat_feedback'),

    # Admin analytics
    path('analytics/', ChatAnalyticsView.as_view(), name='chat_analytics'),

    # Chatbot health/diagnostics
    path('health/', ChatbotHealthView.as_view(), name='chatbot_health'),

    # ViewSets
    path('', include(router.urls)),
]
