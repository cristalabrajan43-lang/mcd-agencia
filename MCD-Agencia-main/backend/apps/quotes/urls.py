"""
Quote URLs for MCD-Agencia.

This module provides URL routing for quote endpoints:
    - Quote requests (public and admin)
    - Quotes management
    - Public quote viewing
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    QuoteRequestPublicView,
    QuoteRequestViewSet,
    QuoteViewSet,
    QuotePublicView,
    QuotePublicResponsesView,
    QuoteChangeRequestView,
    QuotePublicPdfView,
    QuotePublicRejectView,
    QuoteChangeRequestViewSet,
    QuoteCronView,
    QuoteRequestInfoUpdateView,
)

app_name = 'quotes'

router = DefaultRouter()
router.register('requests', QuoteRequestViewSet, basename='requests')
router.register('change-requests', QuoteChangeRequestViewSet, basename='change-requests')
router.register('', QuoteViewSet, basename='quotes')

urlpatterns = [
    # Public endpoints (no authentication required)
    path('request/', QuoteRequestPublicView.as_view(), name='request_public'),
    path('view/<uuid:token>/', QuotePublicView.as_view(), name='view_public'),
    path('view/<uuid:token>/pdf/', QuotePublicPdfView.as_view(), name='pdf_public'),
    path('view/<uuid:token>/reject/', QuotePublicRejectView.as_view(), name='reject_public'),
    path('view/<uuid:token>/responses/', QuotePublicResponsesView.as_view(), name='responses_public'),
    path('view/<uuid:token>/change-request/', QuoteChangeRequestView.as_view(), name='change_request'),
    path('complete-info/<uuid:token>/', QuoteRequestInfoUpdateView.as_view(), name='complete_info'),

    # Cron endpoint for external scheduler
    path('cron/', QuoteCronView.as_view(), name='cron'),

    # ViewSets
    path('', include(router.urls)),
]
