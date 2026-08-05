"""
Audit Views for MCD-Agencia.

This module provides ViewSets for audit log operations:
    - Audit log viewing
    - Filtering and searching
    - Export functionality
"""

import csv
import json
from datetime import datetime, timedelta

from django.http import HttpResponse
from django.db.models import Count
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.pagination import StandardPagination, LargePagination
from apps.core.permissions import IsRoleAdmin
from .models import AuditLog
from .serializers import (
    AuditLogSerializer,
    AuditLogListSerializer,
    AuditLogFilterSerializer,
    AuditLogExportSerializer,
    AuditLogStatsSerializer,
    EntityAuditHistorySerializer,
    UserActivitySerializer,
)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for audit log viewing (read-only).

    GET /api/v1/admin/audit/
    GET /api/v1/admin/audit/{id}/
    """

    queryset = AuditLog.objects.select_related('actor')
    permission_classes = [IsRoleAdmin]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['entity_type', 'action', 'actor']

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if self.action == 'list':
            return AuditLogListSerializer
        return AuditLogSerializer

    def get_queryset(self):
        """Filter queryset based on query params."""
        qs = super().get_queryset()

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date:
            qs = qs.filter(timestamp__gte=start_date)
        if end_date:
            qs = qs.filter(timestamp__lte=end_date)

        # Filter by entity ID
        entity_id = self.request.query_params.get('entity_id')
        if entity_id:
            qs = qs.filter(entity_id=entity_id)

        # Filter by actor email
        actor_email = self.request.query_params.get('actor_email')
        if actor_email:
            qs = qs.filter(actor_email__icontains=actor_email)

        # Filter by IP address
        ip_address = self.request.query_params.get('ip_address')
        if ip_address:
            qs = qs.filter(actor_ip=ip_address)

        return qs

    @action(detail=False, methods=['get'])
    def entity_history(self, request):
        """Get audit history for a specific entity."""
        serializer = EntityAuditHistorySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        entity_type = serializer.validated_data['entity_type']
        entity_id = serializer.validated_data['entity_id']

        logs = self.queryset.filter(
            entity_type=entity_type,
            entity_id=entity_id
        ).order_by('-timestamp')

        page = self.paginate_queryset(logs)
        if page is not None:
            serializer = AuditLogListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = AuditLogListSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def user_activity(self, request):
        """Get activity for a specific user."""
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {'error': _('user_id is required.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        logs = self.queryset.filter(actor_id=user_id).order_by('-timestamp')

        # Get summary
        actions_by_type = logs.values('action').annotate(
            count=Count('id')
        ).order_by('-count')

        last_action = logs.first()

        from django.contrib.auth import get_user_model
        User = get_user_model()

        try:
            user = User.objects.get(id=user_id)
            user_data = {
                'user_id': str(user.id),
                'user_email': user.email,
                'user_name': user.full_name,
            }
        except User.DoesNotExist:
            user_data = {
                'user_id': user_id,
                'user_email': 'Unknown',
                'user_name': 'Unknown',
            }

        return Response({
            **user_data,
            'total_actions': logs.count(),
            'last_action': last_action.timestamp if last_action else None,
            'actions_by_type': {
                item['action']: item['count'] for item in actions_by_type
            },
            'recent_actions': AuditLogListSerializer(logs[:20], many=True).data
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export audit logs."""
        serializer = AuditLogExportSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        export_format = serializer.validated_data.get('format', 'json')

        # Build queryset with filters
        qs = self.queryset

        if 'actor_id' in serializer.validated_data:
            qs = qs.filter(actor_id=serializer.validated_data['actor_id'])
        if 'entity_type' in serializer.validated_data:
            qs = qs.filter(entity_type=serializer.validated_data['entity_type'])
        if 'entity_id' in serializer.validated_data:
            qs = qs.filter(entity_id=serializer.validated_data['entity_id'])
        if 'action' in serializer.validated_data:
            qs = qs.filter(action=serializer.validated_data['action'])
        if 'start_date' in serializer.validated_data:
            qs = qs.filter(timestamp__gte=serializer.validated_data['start_date'])
        if 'end_date' in serializer.validated_data:
            qs = qs.filter(timestamp__lte=serializer.validated_data['end_date'])

        # Limit export size
        qs = qs[:10000]

        if export_format == 'csv':
            return self._export_csv(qs)
        return self._export_json(qs)

    def _export_csv(self, queryset):
        """Export as CSV."""
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="audit_log_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'timestamp', 'actor_email', 'actor_ip', 'entity_type',
            'entity_id', 'action', 'entity_repr'
        ])

        for log in queryset:
            writer.writerow([
                log.timestamp.isoformat(),
                log.actor_email,
                log.actor_ip,
                log.entity_type,
                log.entity_id,
                log.action,
                log.entity_repr
            ])

        return response

    def _export_json(self, queryset):
        """Export as JSON."""
        data = AuditLogListSerializer(queryset, many=True).data
        response = HttpResponse(
            json.dumps(data, indent=2, default=str),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="audit_log_{timezone.now().strftime("%Y%m%d_%H%M%S")}.json"'
        return response


class AuditLogStatsView(APIView):
    """
    Get audit log statistics.

    GET /api/v1/admin/audit/stats/
    """

    permission_classes = [IsRoleAdmin]

    def get(self, request):
        """Get audit statistics."""
        # Get date range
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        logs = AuditLog.objects.filter(timestamp__gte=start_date)

        # Total entries
        total_entries = logs.count()

        # By action
        entries_by_action = dict(
            logs.values('action').annotate(
                count=Count('id')
            ).values_list('action', 'count')
        )

        # By entity type
        entries_by_entity_type = dict(
            logs.values('entity_type').annotate(
                count=Count('id')
            ).values_list('entity_type', 'count')
        )

        # By actor (top 10)
        entries_by_actor = list(
            logs.exclude(actor_email='').values(
                'actor_email'
            ).annotate(
                count=Count('id')
            ).order_by('-count')[:10]
        )

        # By date
        entries_by_date = list(
            logs.extra(
                select={'date': 'DATE(timestamp)'}
            ).values('date').annotate(
                count=Count('id')
            ).order_by('date')
        )

        return Response({
            'total_entries': total_entries,
            'entries_by_action': entries_by_action,
            'entries_by_entity_type': entries_by_entity_type,
            'entries_by_actor': entries_by_actor,
            'entries_by_date': [
                {'date': str(item['date']), 'count': item['count']}
                for item in entries_by_date
            ]
        })


class RecentActivityView(APIView):
    """
    Get recent system activity.

    GET /api/v1/admin/audit/recent/
    """

    permission_classes = [IsRoleAdmin]

    def get(self, request):
        """Get recent activity."""
        limit = int(request.query_params.get('limit', 50))
        limit = min(limit, 100)  # Cap at 100

        logs = AuditLog.objects.select_related('actor').order_by('-timestamp')[:limit]
        serializer = AuditLogListSerializer(logs, many=True)
        return Response(serializer.data)


class SecurityEventsView(APIView):
    """
    Get security-related audit events.

    GET /api/v1/admin/audit/security/
    """

    permission_classes = [IsRoleAdmin]

    def get(self, request):
        """Get security events (logins, password changes, permission changes)."""
        days = int(request.query_params.get('days', 7))
        start_date = timezone.now() - timedelta(days=days)

        security_actions = [
            AuditLog.ACTION_LOGIN,
            AuditLog.ACTION_LOGOUT,
            AuditLog.ACTION_PASSWORD_CHANGED,
            AuditLog.ACTION_PERMISSION_CHANGED,
        ]

        logs = AuditLog.objects.filter(
            action__in=security_actions,
            timestamp__gte=start_date
        ).select_related('actor').order_by('-timestamp')

        # Group by IP for potential anomaly detection
        suspicious_ips = logs.values('actor_ip').annotate(
            count=Count('id')
        ).filter(count__gt=10).order_by('-count')

        return Response({
            'events': AuditLogListSerializer(logs[:100], many=True).data,
            'summary': {
                'total_logins': logs.filter(action=AuditLog.ACTION_LOGIN).count(),
                'total_password_changes': logs.filter(
                    action=AuditLog.ACTION_PASSWORD_CHANGED
                ).count(),
                'total_permission_changes': logs.filter(
                    action=AuditLog.ACTION_PERMISSION_CHANGED
                ).count(),
            },
            'high_activity_ips': list(suspicious_ips[:10])
        })
