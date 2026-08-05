"""
Audit URLs for MCD-Agencia.

This module provides URL routing for audit endpoints:
    - Audit log viewing
    - Statistics
    - Export
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AuditLogViewSet,
    AuditLogStatsView,
    RecentActivityView,
    SecurityEventsView,
)

app_name = 'audit'

router = DefaultRouter()
router.register('', AuditLogViewSet, basename='audit')

urlpatterns = [
    # Reports and stats
    path('stats/', AuditLogStatsView.as_view(), name='stats'),
    path('recent/', RecentActivityView.as_view(), name='recent'),
    path('security/', SecurityEventsView.as_view(), name='security'),

    # ViewSets
    path('', include(router.urls)),
]
