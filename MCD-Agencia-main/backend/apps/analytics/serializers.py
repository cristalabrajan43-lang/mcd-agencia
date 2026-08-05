from rest_framework import serializers


class EventPayloadSerializer(serializers.Serializer):
    """Single event coming from the frontend batch."""
    event_name = serializers.CharField(max_length=128)
    event_data = serializers.DictField(required=False, default=dict)
    page_url = serializers.URLField(max_length=2048, required=False, default='')
    timestamp = serializers.DateTimeField()


class EventBatchSerializer(serializers.Serializer):
    """Wrapper for the batch of events sent by the frontend."""
    events = EventPayloadSerializer(many=True, max_length=50)
