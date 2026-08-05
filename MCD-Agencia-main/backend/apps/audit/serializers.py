"""
Audit Serializers for MCD-Agencia.

This module provides serializers for audit log operations:
    - Audit log viewing
    - Audit log filtering
    - Export functionality
"""

from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog model."""

    action_display = serializers.CharField(
        source='get_action_display', read_only=True
    )
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'timestamp', 'actor', 'actor_email', 'actor_name',
            'actor_ip', 'actor_user_agent',
            'entity_type', 'entity_id', 'entity_repr',
            'action', 'action_display',
            'before_state', 'after_state', 'diff',
            'metadata'
        ]
        read_only_fields = [
            'id', 'timestamp', 'actor', 'actor_email', 'actor_ip',
            'actor_user_agent', 'entity_type', 'entity_id', 'entity_repr',
            'action', 'before_state', 'after_state', 'diff', 'metadata'
        ]

    def get_actor_name(self, obj):
        """Get actor name."""
        if obj.actor:
            return obj.actor.full_name
        return obj.actor_email or 'System'


class AuditLogListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for audit log lists."""

    action_display = serializers.CharField(
        source='get_action_display', read_only=True
    )
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'timestamp', 'actor_email', 'actor_name', 'actor_ip',
            'entity_type', 'entity_id', 'entity_repr',
            'action', 'action_display'
        ]
        read_only_fields = ['id']

    def get_actor_name(self, obj):
        """Get actor name."""
        if obj.actor:
            return obj.actor.full_name
        return obj.actor_email or 'System'


class AuditLogFilterSerializer(serializers.Serializer):
    """Serializer for audit log filtering parameters."""

    actor_id = serializers.UUIDField(required=False)
    actor_email = serializers.EmailField(required=False)
    entity_type = serializers.ChoiceField(
        choices=AuditLog.ENTITY_TYPES,
        required=False
    )
    entity_id = serializers.CharField(required=False)
    action = serializers.ChoiceField(
        choices=AuditLog.ACTION_CHOICES,
        required=False
    )
    start_date = serializers.DateTimeField(required=False)
    end_date = serializers.DateTimeField(required=False)
    ip_address = serializers.IPAddressField(required=False)


class AuditLogExportSerializer(serializers.Serializer):
    """Serializer for audit log export requests."""

    FORMAT_CSV = 'csv'
    FORMAT_JSON = 'json'

    FORMAT_CHOICES = [
        (FORMAT_CSV, 'CSV'),
        (FORMAT_JSON, 'JSON'),
    ]

    format = serializers.ChoiceField(
        choices=FORMAT_CHOICES,
        default=FORMAT_JSON
    )
    actor_id = serializers.UUIDField(required=False)
    entity_type = serializers.ChoiceField(
        choices=AuditLog.ENTITY_TYPES,
        required=False
    )
    entity_id = serializers.CharField(required=False)
    action = serializers.ChoiceField(
        choices=AuditLog.ACTION_CHOICES,
        required=False
    )
    start_date = serializers.DateTimeField(required=False)
    end_date = serializers.DateTimeField(required=False)


class AuditLogStatsSerializer(serializers.Serializer):
    """Serializer for audit log statistics."""

    total_entries = serializers.IntegerField()
    entries_by_action = serializers.DictField()
    entries_by_entity_type = serializers.DictField()
    entries_by_actor = serializers.ListField()
    entries_by_date = serializers.ListField()


class EntityAuditHistorySerializer(serializers.Serializer):
    """Serializer for entity audit history request."""

    entity_type = serializers.ChoiceField(
        choices=AuditLog.ENTITY_TYPES,
        required=True
    )
    entity_id = serializers.CharField(required=True)


class UserActivitySerializer(serializers.Serializer):
    """Serializer for user activity report."""

    user_id = serializers.UUIDField()
    user_email = serializers.EmailField()
    user_name = serializers.CharField()
    total_actions = serializers.IntegerField()
    last_action = serializers.DateTimeField()
    actions_by_type = serializers.DictField()
    recent_actions = AuditLogListSerializer(many=True)
