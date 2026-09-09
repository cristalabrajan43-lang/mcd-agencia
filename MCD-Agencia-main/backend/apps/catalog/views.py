"""
Catalog Views for MCD-Agencia.

This module provides ViewSets for catalog operations:
    - Categories (public and admin)
    - Tags
    - Attributes
    - Catalog items (products/services)
    - Product variants
    - Images
"""

from django.db import transaction
from django.db.models import Q, Prefetch, F
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.audit.models import AuditLog
from apps.core.pagination import StandardPagination, LargePagination
from apps.core.permissions import IsRoleAdmin, IsRoleStaff, IsRoleStaffOrVendor, is_role_staff_user, is_role_vendor_user

SOURCE_VENDOR_ITEM_KEY = 'source_vendor_item_id'


def _without_vendor_catalog(qs):
    """Public store catalog: agency products only, never vendor listings or warehouse clones."""
    return qs.filter(vendor__isnull=True).exclude(
        specifications__has_key=SOURCE_VENDOR_ITEM_KEY
    )
from .models import (
    Category,
    Tag,
    Attribute,
    AttributeValue,
    CatalogItem,
    ProductVariant,
    CatalogImage,
)
from .serializers import (
    CategorySerializer,
    CategoryTreeSerializer,
    TagSerializer,
    AttributeSerializer,
    AttributeValueSerializer,
    CatalogItemListSerializer,
    CatalogItemDetailSerializer,
    CatalogItemAdminSerializer,
    ProductVariantSerializer,
    CatalogImageSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for category management.

    Public endpoints:
        GET /api/v1/catalog/categories/ - List active categories
        GET /api/v1/catalog/categories/{id}/ - Category details

    Admin endpoints:
        POST /api/v1/catalog/categories/ - Create category
        PUT /api/v1/catalog/categories/{id}/ - Update category
        DELETE /api/v1/catalog/categories/{id}/ - Delete category
    """

    serializer_class = CategorySerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['name', 'name_en', 'description']
    filterset_fields = ['is_active', 'parent', 'type']

    def get_queryset(self):
        """Return categories based on user permissions."""
        qs = Category.objects.all()
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True, is_deleted=False)
        return qs

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve', 'tree']:
            return [permissions.AllowAny()]
        return [IsRoleStaff()]

    def perform_create(self, serializer):
        """Log category creation."""
        category = serializer.save()
        AuditLog.log(
            entity=category,
            action=AuditLog.ACTION_CREATED,
            actor=self.request.user,
            after_state=CategorySerializer(category).data,
            request=self.request
        )

    def perform_update(self, serializer):
        """Log category update."""
        before_state = CategorySerializer(self.get_object()).data
        category = serializer.save()
        AuditLog.log(
            entity=category,
            action=AuditLog.ACTION_UPDATED,
            actor=self.request.user,
            before_state=before_state,
            after_state=CategorySerializer(category).data,
            request=self.request
        )

    def perform_destroy(self, instance):
        """Soft delete category."""
        AuditLog.log(
            entity=instance,
            action=AuditLog.ACTION_DELETED,
            actor=self.request.user,
            before_state=CategorySerializer(instance).data,
            request=self.request
        )
        instance.soft_delete()

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Get category tree structure."""
        root_categories = self.get_queryset().filter(parent=None)
        serializer = CategoryTreeSerializer(
            root_categories, many=True, context={'request': request}
        )
        return Response(serializer.data)


class TagViewSet(viewsets.ModelViewSet):
    """
    ViewSet for tag management.

    GET /api/v1/catalog/tags/
    POST /api/v1/catalog/tags/
    PUT /api/v1/catalog/tags/{id}/
    DELETE /api/v1/catalog/tags/{id}/
    """

    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleStaff()]


class AttributeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for attribute management.

    GET /api/v1/catalog/attributes/
    POST /api/v1/catalog/attributes/
    PUT /api/v1/catalog/attributes/{id}/
    DELETE /api/v1/catalog/attributes/{id}/
    """

    queryset = Attribute.objects.prefetch_related('values')
    serializer_class = AttributeSerializer
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'name_en']
    filterset_fields = ['type', 'is_filterable', 'is_visible']

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleStaff()]


class AttributeValueViewSet(viewsets.ModelViewSet):
    """
    ViewSet for attribute value management.

    GET /api/v1/catalog/attribute-values/
    POST /api/v1/catalog/attribute-values/
    PUT /api/v1/catalog/attribute-values/{id}/
    DELETE /api/v1/catalog/attribute-values/{id}/
    """

    queryset = AttributeValue.objects.all()
    serializer_class = AttributeValueSerializer
    pagination_class = StandardPagination
    permission_classes = [IsRoleAdmin]
    filterset_fields = ['attribute']


class CatalogItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for catalog item management.

    Public endpoints:
        GET /api/v1/catalog/items/ - List items
        GET /api/v1/catalog/items/{id}/ - Item details
        GET /api/v1/catalog/items/{slug}/ - Item by slug

    Admin endpoints:
        POST /api/v1/catalog/items/ - Create item
        PUT /api/v1/catalog/items/{id}/ - Update item
        DELETE /api/v1/catalog/items/{id}/ - Delete item
    """

    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'name_en', 'short_description', 'sku']
    filterset_fields = ['type', 'category', 'sale_mode', 'is_active', 'is_featured']
    ordering_fields = ['created_at', 'base_price', 'name', 'position']
    ordering = ['-created_at']
    lookup_field = 'pk'

    def get_queryset(self):
        """Return items based on user permissions and catalog scope."""
        qs = CatalogItem.objects.select_related('category', 'vendor').prefetch_related(
            'tags',
            'images',
            Prefetch(
                'variants',
                queryset=ProductVariant.objects.filter(is_active=True).prefetch_related(
                    'attribute_values__attribute', 'images'
                )
            )
        )

        user = self.request.user
        scope = self.request.query_params.get('scope')
        is_staff = is_role_staff_user(user)
        is_vendor = is_role_vendor_user(user)

        if self.action in ('list', 'featured'):
            if scope == 'mine' and is_vendor:
                qs = qs.filter(vendor=user)
            elif scope == 'vendors' and (is_staff or is_vendor):
                qs = qs.filter(vendor__isnull=False)
                if is_vendor:
                    qs = qs.filter(vendor=user)
                vendor_id = self.request.query_params.get('vendor')
                if vendor_id and is_staff:
                    qs = qs.filter(vendor_id=vendor_id)
            else:
                qs = _without_vendor_catalog(qs)
                if not is_staff:
                    qs = qs.filter(is_active=True, is_deleted=False)
        elif self.action in ('retrieve', 'by_slug'):
            if is_staff:
                pass
            elif is_vendor:
                qs = qs.filter(Q(vendor=user) | Q(vendor__isnull=True, is_active=True, is_deleted=False))
                qs = qs.exclude(specifications__has_key=SOURCE_VENDOR_ITEM_KEY)
            else:
                qs = _without_vendor_catalog(qs).filter(is_active=True, is_deleted=False)
        else:
            if is_vendor:
                qs = qs.filter(vendor=user)
            elif not is_staff:
                qs = qs.none()

        # Filter by category slug
        category_slug = self.request.query_params.get('category_slug')
        if category_slug:
            qs = qs.filter(category__slug=category_slug)

        # Filter by tag
        tag = self.request.query_params.get('tag')
        if tag:
            qs = qs.filter(tags__slug=tag)

        # Filter by price range
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        if min_price:
            qs = qs.filter(base_price__gte=min_price)
        if max_price:
            qs = qs.filter(base_price__lte=max_price)

        has_discount = self.request.query_params.get('has_discount')
        if has_discount in ('true', '1', 'yes'):
            qs = qs.filter(
                compare_at_price__isnull=False,
                compare_at_price__gt=F('base_price'),
            )

        promo_banner = self.request.query_params.get('promo_banner')
        if promo_banner:
            qs = qs.filter(promo_banners__id=promo_banner)

        return qs

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return CatalogItemListSerializer
        if is_role_staff_user(self.request.user) or is_role_vendor_user(self.request.user):
            return CatalogItemAdminSerializer
        return CatalogItemDetailSerializer

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve', 'by_slug', 'featured']:
            return [permissions.AllowAny()]
        return [IsRoleStaffOrVendor()]

    def perform_create(self, serializer):
        """Log item creation and attach vendor ownership."""
        extra = {}
        if is_role_vendor_user(self.request.user):
            extra['vendor'] = self.request.user
            extra['is_featured'] = False
        item = serializer.save(**extra)
        AuditLog.log(
            entity=item,
            action=AuditLog.ACTION_CREATED,
            actor=self.request.user,
            after_state=CatalogItemAdminSerializer(item).data,
            request=self.request
        )

    def perform_update(self, serializer):
        """Log item update."""
        before_state = CatalogItemAdminSerializer(self.get_object()).data
        extra = {}
        if is_role_vendor_user(self.request.user):
            extra['vendor'] = self.request.user
            extra['is_featured'] = False
        item = serializer.save(**extra)
        AuditLog.log(
            entity=item,
            action=AuditLog.ACTION_UPDATED,
            actor=self.request.user,
            before_state=before_state,
            after_state=CatalogItemAdminSerializer(item).data,
            request=self.request
        )

    def perform_destroy(self, instance):
        """Soft delete item and hide related inventory variants."""
        before_state = CatalogItemAdminSerializer(instance).data

        with transaction.atomic():
            # Keep inventory consistent with deletion intent.
            variants = instance.variants.filter(is_deleted=False)
            for variant in variants:
                if variant.is_active:
                    variant.is_active = False
                    variant.save(update_fields=['is_active', 'updated_at'])
                variant.delete()

            if instance.is_active:
                instance.is_active = False
                instance.save(update_fields=['is_active', 'updated_at'])

            instance.delete()

        AuditLog.log(
            entity=instance,
            action=AuditLog.ACTION_DELETED,
            actor=self.request.user,
            before_state=before_state,
            request=self.request,
            metadata={'inventory_removed': True}
        )

    @action(detail=False, methods=['get'], url_path='slug/(?P<slug>[^/.]+)')
    def by_slug(self, request, slug=None):
        """Get item by slug."""
        try:
            item = self.get_queryset().get(slug=slug)
        except CatalogItem.DoesNotExist:
            return Response(
                {'error': _('Item not found.')},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured items."""
        items = self.get_queryset().filter(is_featured=True)[:12]
        serializer = CatalogItemListSerializer(
            items, many=True, context={'request': request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def toggle_featured(self, request, pk=None):
        """Toggle item featured status (admin)."""
        item = self.get_object()
        if item.vendor_id:
            return Response(
                {'error': _('Vendor catalog items cannot be featured on the public store.')},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item.is_featured = not item.is_featured
        item.save(update_fields=['is_featured', 'updated_at'])
        return Response({'is_featured': item.is_featured})

    @action(detail=True, methods=['post'], url_path='upload-images')
    def upload_images(self, request, pk=None):
        """
        Upload multiple images to a catalog item.

        POST /api/v1/catalog/items/{id}/upload-images/

        Accepts multipart/form-data with 'images' field containing one or more files.
        Images are automatically optimized (resized, compressed, converted to WebP).
        """
        item = self.get_object()
        images = request.FILES.getlist('images')

        if not images:
            return Response(
                {'error': _('No images provided.')},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_images = []
        errors = []

        for i, image_file in enumerate(images):
            serializer = CatalogImageSerializer(data={
                'catalog_item_id': str(item.id),
                'image': image_file,
                'alt_text': item.name,
                'is_primary': i == 0 and not item.images.exists(),
            })

            if serializer.is_valid():
                created_images.append(serializer.save())
            else:
                errors.append({
                    'file': image_file.name,
                    'errors': serializer.errors
                })

        response_data = {
            'uploaded': len(created_images),
            'images': CatalogImageSerializer(created_images, many=True).data,
        }

        if errors:
            response_data['errors'] = errors
            return Response(response_data, status=status.HTTP_207_MULTI_STATUS)

        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='delete-image/(?P<image_id>[^/.]+)')
    def delete_image(self, request, pk=None, image_id=None):
        """Delete an image from a catalog item."""
        item = self.get_object()

        try:
            image = item.images.get(id=image_id)
        except CatalogImage.DoesNotExist:
            return Response(
                {'error': _('Image not found.')},
                status=status.HTTP_404_NOT_FOUND
            )

        was_primary = image.is_primary
        image.delete()

        # If deleted image was primary, set another one as primary
        if was_primary:
            next_image = item.images.first()
            if next_image:
                next_image.is_primary = True
                next_image.save(update_fields=['is_primary', 'updated_at'])

        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductVariantViewSet(viewsets.ModelViewSet):
    """
    ViewSet for product variant management.

    GET /api/v1/catalog/variants/
    POST /api/v1/catalog/variants/
    PUT /api/v1/catalog/variants/{id}/
    DELETE /api/v1/catalog/variants/{id}/
    """

    queryset = ProductVariant.objects.select_related('catalog_item').prefetch_related(
        'attribute_values__attribute', 'images'
    )
    serializer_class = ProductVariantSerializer
    pagination_class = StandardPagination
    filterset_fields = ['catalog_item', 'is_active']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if is_role_vendor_user(user):
            return qs.filter(catalog_item__vendor=user)
        if not is_role_staff_user(user):
            return qs.filter(catalog_item__vendor__isnull=True).exclude(
                catalog_item__specifications__has_key=SOURCE_VENDOR_ITEM_KEY
            )
        return qs

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleStaffOrVendor()]

    def perform_create(self, serializer):
        """Log variant creation."""
        variant = serializer.save()
        AuditLog.log(
            entity=variant,
            action=AuditLog.ACTION_CREATED,
            actor=self.request.user,
            after_state=ProductVariantSerializer(variant).data,
            request=self.request
        )

    def perform_update(self, serializer):
        """Log variant update."""
        before_state = ProductVariantSerializer(self.get_object()).data
        variant = serializer.save()
        AuditLog.log(
            entity=variant,
            action=AuditLog.ACTION_UPDATED,
            actor=self.request.user,
            before_state=before_state,
            after_state=ProductVariantSerializer(variant).data,
            request=self.request
        )

    def perform_destroy(self, instance):
        """Soft delete variant."""
        AuditLog.log(
            entity=instance,
            action=AuditLog.ACTION_DELETED,
            actor=self.request.user,
            before_state=ProductVariantSerializer(instance).data,
            request=self.request
        )
        instance.soft_delete()

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get variants with low stock."""
        variants = self.queryset.filter(
            is_active=True,
            stock__lte=models.F('low_stock_threshold')
        )
        serializer = self.get_serializer(variants, many=True)
        return Response(serializer.data)


class CatalogImageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for catalog image management.

    POST /api/v1/catalog/images/
    PUT /api/v1/catalog/images/{id}/
    DELETE /api/v1/catalog/images/{id}/
    """

    queryset = CatalogImage.objects.all()
    serializer_class = CatalogImageSerializer
    permission_classes = [IsRoleAdmin]

    @action(detail=True, methods=['post'])
    def set_primary(self, request, pk=None):
        """Set image as primary."""
        image = self.get_object()

        # Unset other primary images for the same item/variant
        if image.catalog_item:
            CatalogImage.objects.filter(
                catalog_item=image.catalog_item, is_primary=True
            ).update(is_primary=False)
        if image.variant:
            CatalogImage.objects.filter(
                variant=image.variant, is_primary=True
            ).update(is_primary=False)

        image.is_primary = True
        image.save(update_fields=['is_primary', 'updated_at'])
        return Response(CatalogImageSerializer(image).data)
