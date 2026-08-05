"""
Payment URLs for MCD-Agencia.

This module provides URL routing for payment endpoints:
    - Payment management
    - Webhooks
    - Refunds
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PaymentViewSet,
    MercadoPagoWebhookView,
    PayPalWebhookView,
    RefundViewSet,
    PaymentSummaryView,
)

app_name = 'payments'

router = DefaultRouter()
router.register('', PaymentViewSet, basename='payments')

urlpatterns = [
    # Webhooks (public, no auth required)
    path('webhooks/mercadopago/', MercadoPagoWebhookView.as_view(), name='webhook_mercadopago'),
    path('webhooks/paypal/', PayPalWebhookView.as_view(), name='webhook_paypal'),

    # Explicit testing endpoints (avoid router ambiguity with {pk} route)
    path(
        'test_create_order/',
        PaymentViewSet.as_view({'post': 'test_create_order'}),
        name='payments_test_create_order',
    ),
    path(
        'test_create_quote/',
        PaymentViewSet.as_view({'post': 'test_create_quote'}),
        name='payments_test_create_quote',
    ),
    path(
        'test_mock_payments/',
        PaymentViewSet.as_view({'get': 'test_mock_payments'}),
        name='payments_test_mock_payments',
    ),

    # ViewSets
    path('', include(router.urls)),
]


# Admin URLs
admin_router = DefaultRouter()
admin_router.register('refunds', RefundViewSet, basename='admin-refunds')

admin_urlpatterns = [
    path('summary/', PaymentSummaryView.as_view(), name='admin_summary'),
    path('', include(admin_router.urls)),
]
