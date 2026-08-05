"""
Chatbot Serializers for MCD-Agencia.

This module provides serializers for chatbot and lead management:
    - Lead creation and management
    - Conversation handling
    - Message serialization
"""

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import Lead, Conversation, Message


class LeadSerializer(serializers.ModelSerializer):
    """Serializer for Lead model."""

    source_display = serializers.CharField(
        source='get_source_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            'id', 'name', 'email', 'phone', 'company',
            'source', 'source_display', 'status', 'status_display',
            'message', 'notes', 'assigned_to', 'assigned_to_name',
            'user', 'utm_source', 'utm_medium', 'utm_campaign',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'ip_address', 'user_agent', 'created_at', 'updated_at'
        ]

    def get_assigned_to_name(self, obj):
        """Get assigned user name."""
        if obj.assigned_to:
            return obj.assigned_to.full_name
        return None


class LeadListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for lead lists."""

    source_display = serializers.CharField(
        source='get_source_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            'id', 'name', 'email', 'phone', 'company',
            'source', 'source_display', 'status', 'status_display',
            'assigned_to_name', 'created_at'
        ]
        read_only_fields = ['id']

    def get_assigned_to_name(self, obj):
        """Get assigned user name."""
        if obj.assigned_to:
            return obj.assigned_to.full_name
        return None


class CreateLeadSerializer(serializers.ModelSerializer):
    """Serializer for creating a new lead."""

    privacy_accepted = serializers.BooleanField(
        write_only=True, required=True
    )

    class Meta:
        model = Lead
        fields = [
            'name', 'email', 'phone', 'company', 'source', 'message',
            'utm_source', 'utm_medium', 'utm_campaign', 'privacy_accepted'
        ]

    def validate_privacy_accepted(self, value):
        """Ensure privacy policy is accepted."""
        if not value:
            raise serializers.ValidationError(
                _('You must accept the privacy policy.')
            )
        return value

    def create(self, validated_data):
        """Create lead with request metadata."""
        validated_data.pop('privacy_accepted')
        request = self.context.get('request')

        if request:
            # Extract IP address
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0].strip()
            else:
                ip = request.META.get('REMOTE_ADDR')
            validated_data['ip_address'] = ip
            validated_data['user_agent'] = request.META.get(
                'HTTP_USER_AGENT', ''
            )[:500]

        return Lead.objects.create(**validated_data)


class UpdateLeadStatusSerializer(serializers.Serializer):
    """Serializer for updating lead status."""

    status = serializers.ChoiceField(
        choices=Lead.STATUS_CHOICES, required=True
    )
    notes = serializers.CharField(required=False, allow_blank=True)


class AssignLeadSerializer(serializers.Serializer):
    """Serializer for assigning lead to sales rep."""

    assigned_to_id = serializers.UUIDField(required=True)

    def validate_assigned_to_id(self, value):
        """Validate user exists and can be assigned leads."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(id=value, is_active=True)
            # Check if user has sales role
            # Only admin and sales can be assigned leads
            if user.role and user.role.name not in ['admin', 'sales']:
                raise serializers.ValidationError(
                    _('User cannot be assigned leads.')
                )
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError(_('User not found.'))


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for Message model."""

    role_display = serializers.CharField(
        source='get_role_display', read_only=True
    )

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'role', 'role_display', 'content',
            'intent', 'confidence', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for Conversation model."""

    channel_display = serializers.CharField(
        source='get_channel_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    messages = MessageSerializer(many=True, read_only=True)
    lead_name = serializers.SerializerMethodField()
    escalated_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'session_id', 'lead', 'lead_name', 'user',
            'channel', 'channel_display', 'status', 'status_display',
            'escalated_to', 'escalated_to_name', 'escalated_at',
            'closed_at', 'metadata', 'messages',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'session_id', 'created_at', 'updated_at']

    def get_lead_name(self, obj):
        """Get lead name."""
        if obj.lead:
            return obj.lead.name
        return None

    def get_escalated_to_name(self, obj):
        """Get escalated agent name."""
        if obj.escalated_to:
            return obj.escalated_to.full_name
        return None


class ConversationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for conversation lists."""

    channel_display = serializers.CharField(
        source='get_channel_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    lead_name = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'session_id', 'lead_name', 'channel', 'channel_display',
            'status', 'status_display', 'message_count', 'last_message',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id']

    def get_lead_name(self, obj):
        """Get lead name."""
        if obj.lead:
            return obj.lead.name
        return None

    def get_message_count(self, obj):
        """Get total message count."""
        return obj.messages.count()

    def get_last_message(self, obj):
        """Get last message preview."""
        last_msg = obj.messages.last()
        if last_msg:
            return {
                'content': last_msg.content[:100],
                'role': last_msg.role,
                'created_at': last_msg.created_at
            }
        return None


class ChatMessageSerializer(serializers.Serializer):
    """Serializer for incoming chat messages from users."""

    session_id = serializers.CharField(max_length=100, required=True)
    content = serializers.CharField(required=True, max_length=2000)
    metadata = serializers.JSONField(required=False, default=dict)


class ChatResponseSerializer(serializers.Serializer):
    """Serializer for chat bot responses."""

    session_id = serializers.CharField()
    content = serializers.CharField()
    intent = serializers.CharField(allow_blank=True)
    confidence = serializers.FloatField(allow_null=True)
    suggestions = serializers.ListField(
        child=serializers.CharField(), required=False
    )
    actions = serializers.ListField(
        child=serializers.DictField(), required=False
    )


class EscalateConversationSerializer(serializers.Serializer):
    """Serializer for escalating conversation to human agent."""

    reason = serializers.CharField(required=False, allow_blank=True)


class CloseConversationSerializer(serializers.Serializer):
    """Serializer for closing a conversation."""

    resolution = serializers.CharField(required=False, allow_blank=True)


class LeadStatsSerializer(serializers.Serializer):
    """Serializer for lead statistics."""

    total_leads = serializers.IntegerField()
    new_leads = serializers.IntegerField()
    contacted_leads = serializers.IntegerField()
    qualified_leads = serializers.IntegerField()
    converted_leads = serializers.IntegerField()
    lost_leads = serializers.IntegerField()
    conversion_rate = serializers.FloatField()
    by_source = serializers.DictField()
    by_date = serializers.ListField()
