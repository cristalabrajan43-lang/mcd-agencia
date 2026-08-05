"""
Inventory URLs for MCD-Agencia.

This module provides URL routing for inventory endpoints:
    - Inventory movements
    - Stock alerts
    - Stock reports
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    InventoryMovementViewSet,
    StockAlertViewSet,
    StockSummaryView,
    LowStockReportView,
    InventoryValueReportView,
)

app_name = 'inventory'

router = DefaultRouter()
router.register('movements', InventoryMovementViewSet, basename='movements')
router.register('alerts', StockAlertViewSet, basename='alerts')

urlpatterns = [
    # Reports
    path('summary/', StockSummaryView.as_view(), name='summary'),
    path('low-stock/', LowStockReportView.as_view(), name='low_stock'),
    path('value/', InventoryValueReportView.as_view(), name='value'),

    # ViewSets
    path('', include(router.urls)),
]
