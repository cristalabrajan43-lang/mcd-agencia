"""
Catalog URLs for MCD-Agencia.

This module provides URL routing for catalog endpoints:
    - Categories
    - Tags
    - Attributes
    - Catalog items (products/services)
    - Variants
    - Images
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    TagViewSet,
    AttributeViewSet,
    AttributeValueViewSet,
    CatalogItemViewSet,
    ProductVariantViewSet,
    CatalogImageViewSet,
)

app_name = 'catalog'

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='categories')
router.register('tags', TagViewSet, basename='tags')
router.register('attributes', AttributeViewSet, basename='attributes')
router.register('attribute-values', AttributeValueViewSet, basename='attribute-values')
router.register('items', CatalogItemViewSet, basename='items')
router.register('variants', ProductVariantViewSet, basename='variants')
router.register('images', CatalogImageViewSet, basename='images')

urlpatterns = [
    path('', include(router.urls)),
]
