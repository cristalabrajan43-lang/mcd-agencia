"""
Chatbot Models for MCD-Agencia.

This module defines models for chatbot and lead management:
    - Lead: Captured leads from chatbot/forms
    - Conversation: Chatbot conversation sessions
    - Message: Individual chat messages
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class Lead(TimeStampedModel):
    """
    Captured lead from various sources.

    Leads can come from:
        - Contact forms
        - Chatbot interactions
        - Quote requests
        - WhatsApp conversations

    Attributes:
        name: Lead's name
        email: Lead's email
        phone: Lead's phone
        company: Lead's company
        source: Where lead came from
        status: Lead status
        notes: Internal notes
        assigned_to: Assigned sales rep
        user: Converted user account
    """

    SOURCE_CHOICES = [
        ('contact_form', _('Contact Form')),
        ('chatbot', _('Chatbot')),
        ('quote_request', _('Quote Request')),
        ('whatsapp', _('WhatsApp')),
        ('phone', _('Phone Call')),
        ('referral', _('Referral')),
        ('other', _('Other')),
    ]

    STATUS_CHOICES = [
        ('new', _('New')),
        ('contacted', _('Contacted')),
        ('qualified', _('Qualified')),
        ('converted', _('Converted')),
        ('lost', _('Lost')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        _('name'),
        max_length=255,
        help_text=_('Lead\'s full name.')
    )
    email = models.EmailField(
        _('email'),
        help_text=_('Lead\'s email address.')
    )
    phone = models.CharField(
        _('phone'),
        max_length=20,
        blank=True,
        help_text=_('Lead\'s phone number.')
    )
    company = models.CharField(
        _('company'),
        max_length=255,
        blank=True,
        help_text=_('Lead\'s company.')
    )
    source = models.CharField(
        _('source'),
        max_length=20,
        choices=SOURCE_CHOICES,
        default='contact_form',
        help_text=_('Where lead came from.')
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        db_index=True,
        help_text=_('Lead status.')
    )
    message = models.TextField(
        _('message'),
        blank=True,
        help_text=_('Initial message from lead.')
    )
    notes = models.TextField(
        _('notes'),
        blank=True,
        help_text=_('Internal notes.')
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_leads',
        help_text=_('Assigned sales rep.')
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leads',
        help_text=_('Converted user account.')
    )

    # Tracking
    ip_address = models.GenericIPAddressField(
        _('IP address'),
        null=True,
        blank=True,
        help_text=_('Lead\'s IP address.')
    )
    user_agent = models.TextField(
        _('user agent'),
        blank=True,
        help_text=_('Browser/device info.')
    )
    utm_source = models.CharField(
        _('UTM source'),
        max_length=100,
        blank=True,
        help_text=_('Marketing UTM source.')
    )
    utm_medium = models.CharField(
        _('UTM medium'),
        max_length=100,
        blank=True,
        help_text=_('Marketing UTM medium.')
    )
    utm_campaign = models.CharField(
        _('UTM campaign'),
        max_length=100,
        blank=True,
        help_text=_('Marketing UTM campaign.')
    )

    class Meta:
        verbose_name = _('lead')
        verbose_name_plural = _('leads')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['source', 'created_at']),
        ]

    def __str__(self):
        return f"{self.name} ({self.email})"


class Conversation(TimeStampedModel):
    """
    Chatbot conversation session.

    Attributes:
        session_id: Unique session identifier
        lead: Associated lead
        user: Associated user (if authenticated)
        channel: Conversation channel
        status: Conversation status
        metadata: Additional session data
    """

    CHANNEL_CHOICES = [
        ('web', _('Web Chat')),
        ('whatsapp', _('WhatsApp')),
    ]

    STATUS_CHOICES = [
        ('active', _('Active')),
        ('waiting', _('Waiting for Response')),
        ('escalated', _('Escalated to Human')),
        ('closed', _('Closed')),
    ]

    # Convenience constants
    STATUS_ACTIVE = 'active'
    STATUS_WAITING = 'waiting'
    STATUS_ESCALATED = 'escalated'
    STATUS_CLOSED = 'closed'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    session_id = models.CharField(
        _('session ID'),
        max_length=100,
        unique=True,
        db_index=True,
        help_text=_('Unique session identifier.')
    )
    lead = models.ForeignKey(
        Lead,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversations',
        help_text=_('Associated lead.')
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversations',
        help_text=_('Associated user.')
    )
    channel = models.CharField(
        _('channel'),
        max_length=20,
        choices=CHANNEL_CHOICES,
        default='web',
        help_text=_('Conversation channel.')
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        help_text=_('Conversation status.')
    )
    escalated_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='escalated_conversations',
        help_text=_('Human agent handling escalation.')
    )
    escalated_at = models.DateTimeField(
        _('escalated at'),
        null=True,
        blank=True,
        help_text=_('When conversation was escalated.')
    )
    closed_at = models.DateTimeField(
        _('closed at'),
        null=True,
        blank=True,
        help_text=_('When conversation was closed.')
    )
    metadata = models.JSONField(
        _('metadata'),
        default=dict,
        blank=True,
        help_text=_('Additional session data.')
    )

    class Meta:
        verbose_name = _('conversation')
        verbose_name_plural = _('conversations')
        ordering = ['-updated_at']

    def __str__(self):
        return f"Conversation {self.session_id[:8]}"


class Message(TimeStampedModel):
    """
    Individual chat message in a conversation.

    Attributes:
        conversation: Parent conversation
        role: Message sender role (user, bot, agent)
        content: Message content
        intent: Detected intent (for bot)
        metadata: Additional message data
    """

    ROLE_CHOICES = [
        ('user', _('User')),
        ('bot', _('Bot')),
        ('agent', _('Human Agent')),
        ('system', _('System')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
        help_text=_('Parent conversation.')
    )
    role = models.CharField(
        _('role'),
        max_length=10,
        choices=ROLE_CHOICES,
        help_text=_('Message sender role.')
    )
    content = models.TextField(
        _('content'),
        help_text=_('Message content.')
    )
    intent = models.CharField(
        _('intent'),
        max_length=100,
        blank=True,
        help_text=_('Detected intent.')
    )
    confidence = models.FloatField(
        _('confidence'),
        null=True,
        blank=True,
        help_text=_('Intent detection confidence.')
    )
    metadata = models.JSONField(
        _('metadata'),
        default=dict,
        blank=True,
        help_text=_('Additional message data.')
    )

    class Meta:
        verbose_name = _('message')
        verbose_name_plural = _('messages')
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"


class MessageFeedback(TimeStampedModel):
    """
    User feedback on a bot message (thumbs up / thumbs down).

    Used to track AI response quality and improve the service.

    Attributes:
        message: The bot message being rated
        rating: 'positive' or 'negative'
        comment: Optional text feedback
        session_id: For anonymous tracking
    """

    RATING_CHOICES = [
        ('positive', _('Positive')),
        ('negative', _('Negative')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    message = models.OneToOneField(
        Message,
        on_delete=models.CASCADE,
        related_name='feedback',
        help_text=_('The bot message being rated.')
    )
    rating = models.CharField(
        _('rating'),
        max_length=10,
        choices=RATING_CHOICES,
        help_text=_('Positive or negative rating.')
    )
    comment = models.TextField(
        _('comment'),
        blank=True,
        help_text=_('Optional text feedback from user.')
    )
    session_id = models.CharField(
        _('session ID'),
        max_length=100,
        blank=True,
        help_text=_('Chat session for anonymous tracking.')
    )

    class Meta:
        verbose_name = _('message feedback')
        verbose_name_plural = _('message feedbacks')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.rating} on {self.message_id}"
