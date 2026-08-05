"""
Notification Serializers for MCD-Agencia.
"""

from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'title', 'message',
            'is_read', 'entity_type', 'entity_id', 'action_url',
            'created_at',
        ]
        read_only_fields = [
            'id', 'notification_type', 'title', 'message',
            'entity_type', 'entity_id', 'action_url', 'created_at',
        ]
