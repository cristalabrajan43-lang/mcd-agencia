"""
Chatbot Views for MCD-Agencia.

This module provides ViewSets for chatbot operations:
    - Lead management
    - Conversation handling
    - Chat messaging (AI-powered via pluggable providers)
    - Web chat widget config & messaging endpoints
"""

import logging

from django.db.models import Count, Q, Avg, F
from django.db.models.functions import TruncDate, TruncHour
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from apps.audit.models import AuditLog
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsRoleAdmin
from .models import Lead, Conversation, Message, MessageFeedback
from .throttles import ChatMessageThrottle, ChatConfigThrottle
from .serializers import (
    LeadSerializer,
    LeadListSerializer,
    CreateLeadSerializer,
    UpdateLeadStatusSerializer,
    AssignLeadSerializer,
    ConversationSerializer,
    ConversationListSerializer,
    MessageSerializer,
    ChatMessageSerializer,
    ChatResponseSerializer,
    EscalateConversationSerializer,
    CloseConversationSerializer,
    LeadStatsSerializer,
)
from .services import get_ai_service

logger = logging.getLogger(__name__)


class LeadViewSet(viewsets.ModelViewSet):
    """
    ViewSet for lead management.

    GET /api/v1/chatbot/leads/
    POST /api/v1/chatbot/leads/
    GET /api/v1/chatbot/leads/{id}/
    PUT /api/v1/chatbot/leads/{id}/
    """

    queryset = Lead.objects.select_related('assigned_to', 'user')
    permission_classes = [IsRoleAdmin]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'source', 'assigned_to']
    search_fields = ['name', 'email', 'company']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if self.action == 'list':
            return LeadListSerializer
        if self.action == 'create':
            return CreateLeadSerializer
        return LeadSerializer

    def perform_create(self, serializer):
        """Create lead with audit logging."""
        lead = serializer.save()
        AuditLog.log(
            entity=lead,
            action=AuditLog.ACTION_CREATED,
            actor=self.request.user,
            after_state=LeadSerializer(lead).data,
            request=self.request
        )

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update lead status."""
        lead = self.get_object()
        serializer = UpdateLeadStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = lead.status
        lead.status = serializer.validated_data['status']

        if 'notes' in serializer.validated_data:
            lead.notes = f"{lead.notes}\n\n[{timezone.now().strftime('%Y-%m-%d %H:%M')}] Status changed to {lead.status}: {serializer.validated_data['notes']}"

        lead.save(update_fields=['status', 'notes', 'updated_at'])

        AuditLog.log(
            entity=lead,
            action=AuditLog.ACTION_STATE_CHANGED,
            actor=request.user,
            before_state={'status': old_status},
            after_state={'status': lead.status},
            request=request
        )

        return Response(LeadSerializer(lead).data)

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign lead to sales rep."""
        lead = self.get_object()
        serializer = AssignLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        assigned_to = User.objects.get(id=serializer.validated_data['assigned_to_id'])
        lead.assigned_to = assigned_to
        lead.save(update_fields=['assigned_to', 'updated_at'])

        AuditLog.log(
            entity=lead,
            action=AuditLog.ACTION_UPDATED,
            actor=request.user,
            after_state={'assigned_to': str(assigned_to.id)},
            request=request
        )

        return Response(LeadSerializer(lead).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get lead statistics."""
        # Get date range
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timezone.timedelta(days=days)

        leads = Lead.objects.filter(created_at__gte=start_date)

        # Count by status
        status_counts = leads.values('status').annotate(count=Count('id'))
        by_status = {item['status']: item['count'] for item in status_counts}

        # Count by source
        source_counts = leads.values('source').annotate(count=Count('id'))
        by_source = {item['source']: item['count'] for item in source_counts}

        # Calculate conversion rate
        total = leads.count()
        converted = leads.filter(status='converted').count()
        conversion_rate = (converted / total * 100) if total > 0 else 0

        # By date
        from django.db.models.functions import TruncDate
        by_date = list(
            leads.annotate(
                date=TruncDate('created_at')
            ).values('date').annotate(
                count=Count('id')
            ).order_by('date')
        )

        return Response({
            'total_leads': total,
            'new_leads': by_status.get('new', 0),
            'contacted_leads': by_status.get('contacted', 0),
            'qualified_leads': by_status.get('qualified', 0),
            'converted_leads': converted,
            'lost_leads': by_status.get('lost', 0),
            'conversion_rate': round(conversion_rate, 2),
            'by_source': by_source,
            'by_date': [
                {'date': str(item['date']), 'count': item['count']}
                for item in by_date
            ]
        })


class PublicLeadCreateView(APIView):
    """
    Public endpoint for creating leads.

    POST /api/v1/chatbot/leads/create/
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Create a new lead from public form."""
        serializer = CreateLeadSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        lead = serializer.save()

        AuditLog.log(
            entity=lead,
            action=AuditLog.ACTION_CREATED,
            request=request,
            metadata={'source': 'public_form'}
        )

        return Response(
            {'message': _('Thank you! We will contact you soon.')},
            status=status.HTTP_201_CREATED
        )


class ConversationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for conversation management.

    GET /api/v1/chatbot/conversations/
    GET /api/v1/chatbot/conversations/{id}/
    POST /api/v1/chatbot/conversations/{id}/escalate/
    POST /api/v1/chatbot/conversations/{id}/close/
    """

    queryset = Conversation.objects.select_related(
        'lead', 'user', 'escalated_to'
    ).prefetch_related('messages')
    permission_classes = [IsRoleAdmin]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'channel']
    ordering = ['-updated_at']

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if self.action == 'list':
            return ConversationListSerializer
        return ConversationSerializer

    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        """Escalate conversation to human agent."""
        conversation = self.get_object()

        if conversation.status == Conversation.STATUS_ESCALATED:
            return Response(
                {'error': _('Conversation is already escalated.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = EscalateConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation.status = Conversation.STATUS_ESCALATED
        conversation.escalated_to = request.user
        conversation.escalated_at = timezone.now()
        conversation.save(update_fields=[
            'status', 'escalated_to', 'escalated_at', 'updated_at'
        ])

        # Add system message
        Message.objects.create(
            conversation=conversation,
            role='system',
            content=_('Conversation escalated to human agent.'),
            metadata={'reason': serializer.validated_data.get('reason', '')}
        )

        return Response(ConversationSerializer(conversation).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close a conversation."""
        conversation = self.get_object()

        if conversation.status == Conversation.STATUS_CLOSED:
            return Response(
                {'error': _('Conversation is already closed.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CloseConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation.status = Conversation.STATUS_CLOSED
        conversation.closed_at = timezone.now()
        conversation.save(update_fields=['status', 'closed_at', 'updated_at'])

        # Add system message
        Message.objects.create(
            conversation=conversation,
            role='system',
            content=_('Conversation closed.'),
            metadata={'resolution': serializer.validated_data.get('resolution', '')}
        )

        return Response(ConversationSerializer(conversation).data)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """Send a message as human agent."""
        conversation = self.get_object()

        content = request.data.get('content')
        if not content:
            return Response(
                {'error': _('Content is required.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        message = Message.objects.create(
            conversation=conversation,
            role='agent',
            content=content
        )

        # Update conversation status if waiting
        if conversation.status == Conversation.STATUS_WAITING:
            conversation.status = Conversation.STATUS_ACTIVE
            conversation.save(update_fields=['status', 'updated_at'])

        return Response(MessageSerializer(message).data)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active conversations."""
        conversations = self.queryset.filter(
            status__in=[
                Conversation.STATUS_ACTIVE,
                Conversation.STATUS_WAITING,
                Conversation.STATUS_ESCALATED
            ]
        )
        page = self.paginate_queryset(conversations)
        if page is not None:
            serializer = ConversationListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ConversationListSerializer(conversations, many=True)
        return Response(serializer.data)


class ChatView(APIView):
    """
    Public chat endpoint for chatbot interactions.

    POST /api/v1/chatbot/chat/
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Process chat message and return response."""
        serializer = ChatMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_id = serializer.validated_data['session_id']
        content = serializer.validated_data['content']
        metadata = serializer.validated_data.get('metadata', {})

        # Get or create conversation
        conversation, created = Conversation.objects.get_or_create(
            session_id=session_id,
            defaults={
                'channel': 'web',
                'status': Conversation.STATUS_ACTIVE,
                'metadata': metadata
            }
        )

        # Store user message
        user_message = Message.objects.create(
            conversation=conversation,
            role='user',
            content=content,
            metadata=metadata
        )

        # Generate AI response
        ai_service = get_ai_service()

        # Build history from conversation
        history = list(
            conversation.messages
            .order_by('-created_at')[:8]
            .values('role', 'content')
        )
        history.reverse()
        # Map 'bot' role to 'assistant' for AI service
        for msg in history:
            if msg['role'] == 'bot':
                msg['role'] = 'assistant'

        language = metadata.get('language', 'es')
        response_data = ai_service.generate_response(
            message=content,
            history=history,
            language=language,
            session_id=session_id,
        )

        # Store bot message
        bot_message = Message.objects.create(
            conversation=conversation,
            role='bot',
            content=response_data.content,
            intent=response_data.intent,
            confidence=response_data.confidence,
            metadata=response_data.metadata,
        )

        # Update conversation
        conversation.save(update_fields=['updated_at'])

        return Response({
            'session_id': session_id,
            'content': response_data.content,
            'intent': response_data.intent,
            'confidence': response_data.confidence,
            'suggestions': response_data.suggestions,
            'actions': response_data.actions,
        })


class WebChatConfigView(APIView):
    """
    Public endpoint for chat widget configuration.

    GET /api/v1/chatbot/web-chat/config/?language=es
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ChatConfigThrottle]

    def get(self, request):
        """Return chatbot widget configuration."""
        language = request.query_params.get('language', 'es')
        ai_service = get_ai_service()
        config = ai_service.get_config(language=language)
        return Response(config)


class WebChatMessageView(APIView):
    """
    Public endpoint for web chat messages (used by frontend ChatWidget).

    POST /api/v1/chatbot/web-chat/message/
    Expected body: { message, session_id, language, history }
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ChatMessageThrottle]

    # Message limits
    MAX_MESSAGE_LENGTH = 1000
    MAX_HISTORY_LENGTH = 10

    def post(self, request):
        """Process a web chat message and return AI response."""
        try:
            return self._handle_message(request)
        except Exception as e:
            logger.exception(f'Unhandled error in WebChatMessageView: {e}')
            # Return a fallback response instead of 500
            language = request.data.get('language', 'es') if hasattr(request, 'data') else 'es'
            is_es = language == 'es'
            return Response({
                'message': (
                    'Disculpa, tuve un problema técnico. Por favor intenta de nuevo en unos segundos.'
                    if is_es else
                    'Sorry, I had a technical issue. Please try again in a few seconds.'
                ),
                'message_id': '',
                'source': 'error',
                'intent': 'error',
                'confidence': 0,
                'suggestions': [
                    'Reintentar' if is_es else 'Try again',
                    'WhatsApp' if is_es else 'WhatsApp',
                ],
                'should_escalate': False,
                'whatsapp_links': None,
            })

    def _handle_message(self, request):
        """Internal handler — all logic here, wrapped by post()."""
        message = request.data.get('message', '').strip()
        session_id = request.data.get('session_id', '')
        language = request.data.get('language', 'es')
        history = request.data.get('history', [])

        if not message:
            return Response(
                {'error': 'Message is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not session_id:
            return Response(
                {'error': 'session_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate message length
        if len(message) > self.MAX_MESSAGE_LENGTH:
            return Response(
                {'error': f'Message too long. Maximum {self.MAX_MESSAGE_LENGTH} characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate language
        if language not in ('es', 'en'):
            language = 'es'

        # Trim history to prevent abuse
        if isinstance(history, list):
            history = history[-self.MAX_HISTORY_LENGTH:]
        else:
            history = []

        # Get or create conversation
        conversation, created = Conversation.objects.get_or_create(
            session_id=session_id,
            defaults={
                'channel': 'web',
                'status': Conversation.STATUS_ACTIVE,
                'metadata': {'language': language},
            },
        )

        # Store user message
        Message.objects.create(
            conversation=conversation,
            role='user',
            content=message,
        )

        # Auto-capture lead if contact info detected
        try:
            from .services.lead_capture import try_capture_lead
            try_capture_lead(conversation, message, request=request)
        except Exception as e:
            logger.debug(f'Lead capture skipped: {e}')

        # Get AI response
        ai_service = get_ai_service()
        response_data = ai_service.generate_response(
            message=message,
            history=history,
            language=language,
            session_id=session_id,
        )

        # Store bot message
        bot_message = Message.objects.create(
            conversation=conversation,
            role='bot',
            content=response_data.content,
            intent=response_data.intent,
            confidence=response_data.confidence,
            metadata=response_data.metadata,
        )

        conversation.save(update_fields=['updated_at'])

        return Response({
            'message': response_data.content,
            'message_id': str(bot_message.id),
            'source': response_data.source,
            'intent': response_data.intent,
            'confidence': response_data.confidence,
            'suggestions': response_data.suggestions,
            'should_escalate': response_data.should_escalate,
            'whatsapp_links': response_data.whatsapp_links,
        })


class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for message viewing.

    GET /api/v1/chatbot/messages/?conversation_id={id}
    """

    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [IsRoleAdmin]
    pagination_class = StandardPagination

    def get_queryset(self):
        """Filter messages by conversation."""
        qs = super().get_queryset()
        conversation_id = self.request.query_params.get('conversation_id')
        if conversation_id:
            qs = qs.filter(conversation_id=conversation_id)
        return qs.order_by('created_at')


class WebChatFeedbackView(APIView):
    """
    Public endpoint for rating bot messages (thumbs up / down).

    POST /api/v1/chatbot/web-chat/feedback/
    Expected body: { message_id, rating, comment?, session_id }
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ChatMessageThrottle]

    def post(self, request):
        """Submit feedback for a bot message."""
        message_id = request.data.get('message_id', '')
        rating = request.data.get('rating', '')
        comment = request.data.get('comment', '')
        session_id = request.data.get('session_id', '')

        if not message_id:
            return Response(
                {'error': 'message_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if rating not in ('positive', 'negative'):
            return Response(
                {'error': 'rating must be "positive" or "negative".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            message = Message.objects.get(id=message_id, role='bot')
        except (Message.DoesNotExist, Exception):
            return Response(
                {'error': 'Message not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Create or update feedback
        feedback, created = MessageFeedback.objects.update_or_create(
            message=message,
            defaults={
                'rating': rating,
                'comment': comment[:500] if comment else '',
                'session_id': session_id[:100] if session_id else '',
            },
        )

        return Response({
            'success': True,
            'feedback_id': str(feedback.id),
            'rating': feedback.rating,
        })


class ChatAnalyticsView(APIView):
    """
    Analytics endpoint for chatbot metrics.

    GET /api/v1/chatbot/analytics/?days=30

    Returns: total conversations, messages, popular intents,
    escalation rate, AI vs fallback ratio, feedback stats,
    messages per day, busiest hours.
    """

    permission_classes = [IsRoleAdmin]

    def get(self, request):
        """Get chatbot analytics."""
        days = min(int(request.query_params.get('days', 30)), 365)
        start_date = timezone.now() - timezone.timedelta(days=days)

        # Base querysets
        conversations = Conversation.objects.filter(created_at__gte=start_date)
        messages = Message.objects.filter(created_at__gte=start_date)
        bot_messages = messages.filter(role='bot')
        user_messages = messages.filter(role='user')

        # Total counts
        total_conversations = conversations.count()
        total_messages = messages.count()
        total_user_messages = user_messages.count()
        total_bot_messages = bot_messages.count()

        # Escalation rate
        escalated = conversations.filter(status='escalated').count()
        escalation_rate = (
            round(escalated / total_conversations * 100, 1)
            if total_conversations > 0
            else 0
        )

        # AI vs Fallback source ratio
        ai_count = bot_messages.filter(metadata__model__isnull=False).count()
        fallback_count = total_bot_messages - ai_count

        # Average messages per conversation
        avg_messages = (
            round(total_messages / total_conversations, 1)
            if total_conversations > 0
            else 0
        )

        # Popular intents
        intent_counts = (
            bot_messages
            .exclude(intent='')
            .values('intent')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )

        # Feedback stats
        feedbacks = MessageFeedback.objects.filter(created_at__gte=start_date)
        positive_count = feedbacks.filter(rating='positive').count()
        negative_count = feedbacks.filter(rating='negative').count()
        total_feedback = positive_count + negative_count
        satisfaction_rate = (
            round(positive_count / total_feedback * 100, 1)
            if total_feedback > 0
            else None
        )

        # Conversations per day (for chart)
        conversations_by_day = list(
            conversations
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        # Busiest hours
        messages_by_hour = list(
            user_messages
            .annotate(hour=TruncHour('created_at'))
            .values('hour')
            .annotate(count=Count('id'))
            .order_by('-count')[:5]
        )

        # Average confidence
        avg_confidence = bot_messages.aggregate(
            avg=Avg('confidence')
        )['avg']

        # Lead capture stats
        leads_from_chat = Lead.objects.filter(
            source='chatbot',
            created_at__gte=start_date,
        ).count()

        return Response({
            'period_days': days,
            'total_conversations': total_conversations,
            'total_messages': total_messages,
            'total_user_messages': total_user_messages,
            'total_bot_messages': total_bot_messages,
            'avg_messages_per_conversation': avg_messages,
            'escalation_rate': escalation_rate,
            'escalated_count': escalated,
            'ai_responses': ai_count,
            'fallback_responses': fallback_count,
            'ai_ratio': (
                round(ai_count / total_bot_messages * 100, 1)
                if total_bot_messages > 0
                else 0
            ),
            'avg_confidence': round(avg_confidence, 3) if avg_confidence else None,
            'popular_intents': [
                {'intent': item['intent'], 'count': item['count']}
                for item in intent_counts
            ],
            'feedback': {
                'total': total_feedback,
                'positive': positive_count,
                'negative': negative_count,
                'satisfaction_rate': satisfaction_rate,
            },
            'leads_captured': leads_from_chat,
            'conversations_by_day': [
                {'date': str(item['date']), 'count': item['count']}
                for item in conversations_by_day
            ],
            'busiest_hours': [
                {'hour': item['hour'].strftime('%H:00'), 'count': item['count']}
                for item in messages_by_hour
            ],
        })


class ChatbotHealthView(APIView):
    """
    Public diagnostic endpoint for chatbot AI status.

    GET /api/v1/chatbot/health/
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Check chatbot AI health and configuration."""
        checks = {}

        # 1. Check AI service initialization
        try:
            from .services import get_ai_service
            svc = get_ai_service()
            checks['service'] = type(svc).__name__
        except Exception as e:
            checks['service'] = f'ERROR: {e}'

        # 2. Check Gemini API key
        from django.conf import settings as s
        has_key = bool(getattr(s, 'GEMINI_API_KEY', ''))
        checks['gemini_key_set'] = has_key
        checks['gemini_model'] = getattr(s, 'GEMINI_MODEL', 'not set')
        checks['provider_setting'] = getattr(s, 'CHATBOT_AI_PROVIDER', 'not set')

        # 3. Check google-genai import
        try:
            from google import genai  # noqa: F401
            checks['google_genai_installed'] = True
        except ImportError as e:
            checks['google_genai_installed'] = f'MISSING: {e}'

        # 4. Quick AI test (only if service is Gemini)
        if checks.get('service') == 'GeminiService':
            try:
                resp = svc.generate_response(
                    message='test',
                    history=[],
                    language='es',
                    session_id='health_check',
                )
                checks['ai_test'] = 'OK' if resp.source == 'ai' else f'FALLBACK: {resp.source}'
            except Exception as e:
                checks['ai_test'] = f'ERROR: {e}'

        # 5. Check database (chatbot tables)
        try:
            from .models import Conversation
            Conversation.objects.count()
            checks['database'] = 'OK'
        except Exception as e:
            checks['database'] = f'ERROR: {e}'

        all_ok = (
            checks.get('service') == 'GeminiService'
            and checks.get('gemini_key_set') is True
            and checks.get('google_genai_installed') is True
            and checks.get('ai_test') == 'OK'
            and checks.get('database') == 'OK'
        )

        return Response({
            'healthy': all_ok,
            'checks': checks,
        })
