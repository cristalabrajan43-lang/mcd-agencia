"""
Order URLs for MCD-Agencia.

This module provides URL routing for order endpoints:
    - Cart management
    - Addresses
    - Orders
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CartView,
    AddToCartView,
    UpdateCartItemView,
    RemoveCartItemView,
    ClearCartView,
    MergeGuestCartView,
    AddressViewSet,
    OrderViewSet,
    OrderAdminViewSet,
    AdminWorkflowView,
)

app_name = 'orders'

router = DefaultRouter()
router.register('addresses', AddressViewSet, basename='addresses')
router.register('', OrderViewSet, basename='orders')

urlpatterns = [
    # Cart endpoints
    path('cart/', CartView.as_view(), name='cart'),
    path('cart/add/', AddToCartView.as_view(), name='cart_add'),
    path('cart/update/<uuid:item_id>/', UpdateCartItemView.as_view(), name='cart_update'),
    path('cart/remove/<uuid:item_id>/', RemoveCartItemView.as_view(), name='cart_remove'),
    path('cart/clear/', ClearCartView.as_view(), name='cart_clear'),
    path('cart/merge/', MergeGuestCartView.as_view(), name='cart_merge'),

    # ViewSets
    path('', include(router.urls)),
]


# Admin URLs
admin_router = DefaultRouter()
admin_router.register('', OrderAdminViewSet, basename='admin-orders')

admin_urlpatterns = [
    path('', include(admin_router.urls)),
    path('workflow/', AdminWorkflowView.as_view(), name='workflow'),
]
