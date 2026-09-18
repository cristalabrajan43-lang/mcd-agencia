"""
Content Serializers for MCD-Agencia.

This module provides serializers for CMS content:
    - Carousel slides
    - Testimonials
    - Client logos
    - FAQs
    - Branch locations
    - Legal pages
    - Site configuration
"""

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.catalog.models import CatalogItem
from .models import (
    CarouselSlide,
    PromoBanner,
    Testimonial,
    ClientLogo,
    Service,
    ServiceImage,
    PortfolioVideo,
    PortfolioItem,
    FAQ,
    Branch,
    LegalPage,
    SiteConfiguration,
)

PUBLIC_CATALOG_QS = CatalogItem.objects.filter(
    is_active=True,
    is_deleted=False,
    vendor__isnull=True,
    sale_mode__in=('BUY', 'HYBRID'),
).exclude(specifications__has_key='source_vendor_item_id')


def _absolute_media_url(request, file_field):
    if not file_field:
        return None
    url = file_field.url
    if request:
        return request.build_absolute_uri(url)
    return url


def promo_banner_image_url(banner, request=None):
    """Uploaded photo, then chosen product photo, then first discounted product."""
    if banner.image:
        return _absolute_media_url(request, banner.image)

    item = getattr(banner, 'image_item', None)
    if item is None and banner.apply_to == PromoBanner.APPLY_SELECTED:
        item = banner.catalog_items.first()
    if item is None:
        return None

    photo = item.images.filter(is_primary=True).first() or item.images.first()
    if photo and photo.image:
        return _absolute_media_url(request, photo.image)
    return None


class CarouselSlideSerializer(serializers.ModelSerializer):
    """Serializer for CarouselSlide model with automatic image optimization."""

    class Meta:
        model = CarouselSlide
        fields = [
            'id', 'title', 'title_en', 'subtitle', 'subtitle_en',
            'image', 'mobile_image', 'cta_text', 'cta_text_en',
            'cta_url', 'service_key', 'position', 'is_active'
        ]
        read_only_fields = ['id']

    def validate_image(self, value):
        """Optimize hero image for landing page (1920x1080, high quality WebP)."""
        from apps.catalog.image_utils import validate_image, optimize_for_landing

        is_valid, error = validate_image(value)
        if not is_valid:
            raise serializers.ValidationError(error)

        optimized_file, _ = optimize_for_landing(value, image_type='hero')
        return optimized_file

    def validate_mobile_image(self, value):
        """Optimize mobile image (smaller size)."""
        if not value:
            return value

        from apps.catalog.image_utils import validate_image, optimize_image

        is_valid, error = validate_image(value)
        if not is_valid:
            raise serializers.ValidationError(error)

        # Mobile: 800x600 for better mobile performance
        optimized_file, _ = optimize_image(value, max_size=(800, 600), quality=85)
        return optimized_file


class CarouselSlidePublicSerializer(serializers.ModelSerializer):
    """Public serializer for CarouselSlide (active only)."""

    class Meta:
        model = CarouselSlide
        fields = [
            'id', 'title', 'title_en', 'subtitle', 'subtitle_en',
            'image', 'mobile_image', 'cta_text', 'cta_text_en',
            'cta_url', 'service_key', 'position'
        ]
        read_only_fields = ['id']


class PromoBannerSerializer(serializers.ModelSerializer):
    """Admin serializer for promo banners."""

    catalog_item_ids = serializers.PrimaryKeyRelatedField(
        queryset=PUBLIC_CATALOG_QS,
        source='catalog_items',
        many=True,
        required=False,
    )
    image = serializers.ImageField(required=False, allow_null=True)
    image_item_id = serializers.PrimaryKeyRelatedField(
        queryset=PUBLIC_CATALOG_QS,
        source='image_item',
        required=False,
        allow_null=True,
    )
    image_url = serializers.SerializerMethodField()
    clear_image = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = PromoBanner
        fields = [
            'id', 'title', 'title_en', 'subtitle', 'subtitle_en', 'badge_text',
            'cta_url', 'background_color', 'background_style',
            'background_color_secondary', 'gradient_direction', 'border_color',
            'text_color', 'subtitle_color', 'badge_background_color',
            'badge_text_color', 'badge_shape', 'font_family', 'title_size',
            'title_weight', 'text_transform', 'discount_percent',
            'apply_to', 'catalog_item_ids', 'image', 'image_item_id', 'image_url',
            'clear_image', 'position', 'is_active',
        ]
        read_only_fields = ['id', 'image_url']

    def get_image_url(self, obj):
        return promo_banner_image_url(obj, self.context.get('request'))

    def validate(self, attrs):
        apply_to = attrs.get('apply_to', getattr(self.instance, 'apply_to', PromoBanner.APPLY_ALL))
        catalog_items = attrs.get('catalog_items')
        discount_percent = attrs.get('discount_percent', getattr(self.instance, 'discount_percent', 0))

        if apply_to == PromoBanner.APPLY_ALL:
            attrs['catalog_items'] = []

        if apply_to == PromoBanner.APPLY_SELECTED:
            items = catalog_items if catalog_items is not None else (
                list(self.instance.catalog_items.all()) if self.instance else []
            )
            if not items:
                raise serializers.ValidationError({
                    'catalog_item_ids': _('Selecciona al menos un producto del catálogo.'),
                })

            invalid = [
                item.name for item in items
                if not item.is_active or item.sale_mode not in ('BUY', 'HYBRID')
            ]
            if invalid:
                raise serializers.ValidationError({
                    'catalog_item_ids': _('Estos productos no están disponibles en catálogo: %(names)s') % {
                        'names': ', '.join(invalid),
                    },
                })

        if discount_percent and discount_percent > 100:
            raise serializers.ValidationError({'discount_percent': _('El descuento no puede ser mayor a 100%.')})

        background_style = attrs.get(
            'background_style',
            getattr(self.instance, 'background_style', PromoBanner.BACKGROUND_SOLID),
        )
        secondary = attrs.get(
            'background_color_secondary',
            getattr(self.instance, 'background_color_secondary', ''),
        )
        if background_style == PromoBanner.BACKGROUND_GRADIENT and not secondary:
            raise serializers.ValidationError({
                'background_color_secondary': _('Elige el segundo color para el degradado.'),
            })

        return attrs

    def create(self, validated_data):
        validated_data.pop('clear_image', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.pop('clear_image', False):
            if instance.image:
                instance.image.delete(save=False)
            validated_data['image'] = None
        return super().update(instance, validated_data)


class PromoBannerPublicSerializer(serializers.ModelSerializer):
    """Public serializer for promo banners."""

    image_url = serializers.SerializerMethodField()

    class Meta:
        model = PromoBanner
        fields = [
            'id', 'title', 'title_en', 'subtitle', 'subtitle_en', 'badge_text',
            'cta_url', 'background_color', 'background_style',
            'background_color_secondary', 'gradient_direction', 'border_color',
            'text_color', 'subtitle_color', 'badge_background_color',
            'badge_text_color', 'badge_shape', 'font_family', 'title_size',
            'title_weight', 'text_transform', 'discount_percent',
            'apply_to', 'image_url', 'position',
        ]
        read_only_fields = ['id', 'image_url']

    def get_image_url(self, obj):
        return promo_banner_image_url(obj, self.context.get('request'))


class TestimonialSerializer(serializers.ModelSerializer):
    """Serializer for Testimonial model."""

    class Meta:
        model = Testimonial
        fields = [
            'id', 'author_name', 'author_title', 'author_company',
            'content', 'content_en', 'photo', 'rating',
            'position', 'is_active'
        ]
        read_only_fields = ['id']


class TestimonialPublicSerializer(serializers.ModelSerializer):
    """Public serializer for Testimonial (active only)."""

    class Meta:
        model = Testimonial
        fields = [
            'id', 'author_name', 'author_title', 'author_company',
            'content', 'content_en', 'photo', 'rating', 'position'
        ]
        read_only_fields = ['id']


class ClientLogoSerializer(serializers.ModelSerializer):
    """Serializer for ClientLogo model."""

    class Meta:
        model = ClientLogo
        fields = ['id', 'name', 'logo', 'website', 'position', 'is_active']
        read_only_fields = ['id']


class ClientLogoPublicSerializer(serializers.ModelSerializer):
    """Public serializer for ClientLogo (active only)."""

    class Meta:
        model = ClientLogo
        fields = ['id', 'name', 'logo', 'website', 'position']
        read_only_fields = ['id']


class ServiceSerializer(serializers.ModelSerializer):
    """Serializer for Service model with image optimization."""

    class Meta:
        model = Service
        fields = [
            'id', 'service_key', 'name', 'name_en', 'description', 'description_en',
            'icon', 'image', 'price_from', 'cta_text', 'cta_text_en',
            'cta_url', 'is_featured', 'position', 'is_active'
        ]
        read_only_fields = ['id']

    def validate_image(self, value):
        """Optimize service image for landing page."""
        if not value:
            return value

        from apps.catalog.image_utils import validate_image, optimize_for_landing

        is_valid, error = validate_image(value)
        if not is_valid:
            raise serializers.ValidationError(error)

        optimized_file, _ = optimize_for_landing(value, image_type='landing')
        return optimized_file


class ServicePublicSerializer(serializers.ModelSerializer):
    """Public serializer for Service (active only), includes carousel images."""

    carousel_images = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            'id', 'service_key', 'name', 'name_en', 'description', 'description_en',
            'icon', 'image', 'price_from', 'cta_text', 'cta_text_en',
            'cta_url', 'is_featured', 'position', 'carousel_images'
        ]
        read_only_fields = ['id']

    def get_carousel_images(self, obj):
        # Use prefetched data if available (from LandingPageView), otherwise query
        if hasattr(obj, '_prefetched_objects_cache') and 'carousel_images' in obj._prefetched_objects_cache:
            images = obj._prefetched_objects_cache['carousel_images']
        else:
            images = obj.carousel_images.filter(is_active=True).order_by('position')
        return ServiceImagePublicSerializer(images, many=True, context=self.context).data


class ServiceImageSerializer(serializers.ModelSerializer):
    """Admin serializer for service images — supports file upload."""

    # Explicit default=True so multipart/form-data POSTs that omit the field
    # don't end up as is_active=False (DRF treats missing booleans in
    # multipart as False, unlike JSON where it respects model defaults).
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = ServiceImage
        fields = ['id', 'service', 'image', 'alt_text', 'alt_text_en', 'subtype_key', 'display_format', 'position', 'is_active']
        read_only_fields = ['id']

    def validate_image(self, value):
        from apps.catalog.image_utils import validate_image, optimize_image
        is_valid, error = validate_image(value)
        if not is_valid:
            raise serializers.ValidationError(error)
        optimized_file, _ = optimize_image(value, max_size=(800, 600), quality=85)
        return optimized_file

    def validate(self, attrs):
        service = attrs.get('service') or (self.instance.service if self.instance else None)
        if service:
            existing_count = ServiceImage.objects.filter(service=service).exclude(
                pk=self.instance.pk if self.instance else None
            ).count()
            if existing_count >= ServiceImage.MAX_IMAGES_PER_SERVICE:
                raise serializers.ValidationError(
                    f'Maximum {ServiceImage.MAX_IMAGES_PER_SERVICE} images per service.'
                )
        return attrs


class ServiceImagePublicSerializer(serializers.ModelSerializer):
    """Public serializer for service images."""

    class Meta:
        model = ServiceImage
        fields = ['id', 'image', 'alt_text', 'alt_text_en', 'subtype_key', 'display_format', 'position']
        read_only_fields = ['id']


class PortfolioVideoSerializer(serializers.ModelSerializer):
    """Admin serializer for portfolio videos."""

    # Accept full YouTube URLs (up to 255 chars); validate_youtube_id
    # extracts the 11-char ID before saving.
    youtube_id = serializers.CharField(max_length=255)
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioVideo
        fields = [
            'id', 'youtube_id', 'title', 'title_en',
            'orientation', 'position', 'is_active', 'thumbnail_url'
        ]
        read_only_fields = ['id', 'thumbnail_url']

    def get_thumbnail_url(self, obj):
        return f'https://img.youtube.com/vi/{obj.youtube_id}/hq720.jpg'

    def validate_youtube_id(self, value):
        import re
        patterns = [
            r'(?:youtube\.com/shorts/|youtu\.be/|youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})',
            r'^([a-zA-Z0-9_-]{11})$',
        ]
        for pattern in patterns:
            match = re.search(pattern, value)
            if match:
                return match.group(1)
        raise serializers.ValidationError('Enter a valid YouTube video ID or URL.')

    def validate(self, attrs):
        if not self.instance:
            existing_count = PortfolioVideo.objects.count()
            if existing_count >= PortfolioVideo.MAX_VIDEOS:
                raise serializers.ValidationError(
                    f'Maximum {PortfolioVideo.MAX_VIDEOS} portfolio videos allowed.'
                )
        return attrs


class PortfolioVideoPublicSerializer(serializers.ModelSerializer):
    """Public serializer for portfolio videos."""

    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioVideo
        fields = [
            'id', 'youtube_id', 'title', 'title_en',
            'orientation', 'position', 'thumbnail_url'
        ]
        read_only_fields = ['id']

    def get_thumbnail_url(self, obj):
        return f'https://img.youtube.com/vi/{obj.youtube_id}/hq720.jpg'


class FAQSerializer(serializers.ModelSerializer):
    """Serializer for FAQ model."""

    category_display = serializers.CharField(
        source='get_category_display', read_only=True
    )

    class Meta:
        model = FAQ
        fields = [
            'id', 'question', 'question_en', 'answer', 'answer_en',
            'category', 'category_display', 'position', 'is_active'
        ]
        read_only_fields = ['id']


class FAQPublicSerializer(serializers.ModelSerializer):
    """Public serializer for FAQ (active only)."""

    category_display = serializers.CharField(
        source='get_category_display', read_only=True
    )

    class Meta:
        model = FAQ
        fields = [
            'id', 'question', 'question_en', 'answer', 'answer_en',
            'category', 'category_display', 'position'
        ]
        read_only_fields = ['id']


class BranchSerializer(serializers.ModelSerializer):
    """Serializer for Branch model."""

    full_address = serializers.CharField(read_only=True)

    class Meta:
        model = Branch
        fields = [
            'id', 'name', 'street', 'neighborhood', 'city', 'state',
            'postal_code', 'phone', 'email', 'hours', 'hours_en',
            'latitude', 'longitude', 'google_maps_url', 'image',
            'full_address', 'position', 'is_active'
        ]
        read_only_fields = ['id', 'full_address']


class BranchPublicSerializer(serializers.ModelSerializer):
    """Public serializer for Branch (active only)."""

    full_address = serializers.CharField(read_only=True)

    class Meta:
        model = Branch
        fields = [
            'id', 'name', 'street', 'neighborhood', 'city', 'state',
            'postal_code', 'phone', 'email', 'hours', 'hours_en',
            'latitude', 'longitude', 'google_maps_url', 'image',
            'full_address', 'position'
        ]
        read_only_fields = ['id', 'full_address']


class LegalPageSerializer(serializers.ModelSerializer):
    """Serializer for LegalPage model."""

    type_display = serializers.CharField(
        source='get_type_display', read_only=True
    )

    class Meta:
        model = LegalPage
        fields = [
            'id', 'type', 'type_display', 'title', 'title_en',
            'content', 'content_en', 'version', 'effective_date',
            'is_active', 'meta_title', 'meta_description',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class LegalPagePublicSerializer(serializers.ModelSerializer):
    """Public serializer for LegalPage (active version only)."""

    type_display = serializers.CharField(
        source='get_type_display', read_only=True
    )

    class Meta:
        model = LegalPage
        fields = [
            'id', 'type', 'type_display', 'title', 'title_en',
            'content', 'content_en', 'version', 'effective_date',
            'meta_title', 'meta_description'
        ]
        read_only_fields = ['id']


class SiteConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for SiteConfiguration model."""

    class Meta:
        model = SiteConfiguration
        fields = [
            'id', 'site_name', 'site_name_en', 'tagline', 'tagline_en',
            'contact_email', 'contact_phone', 'whatsapp_number',
            'social_links', 'logo', 'logo_dark', 'favicon',
            'google_analytics_id', 'meta_pixel_id', 'google_tag_manager_id',
            'about_content', 'about_content_en',
            'mission', 'mission_en', 'vision', 'vision_en',
            'values', 'values_en',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SiteConfigurationPublicSerializer(serializers.ModelSerializer):
    """Public serializer for SiteConfiguration (no analytics IDs)."""

    class Meta:
        model = SiteConfiguration
        fields = [
            'id', 'site_name', 'site_name_en', 'tagline', 'tagline_en',
            'contact_email', 'contact_phone', 'whatsapp_number',
            'social_links', 'logo', 'logo_dark', 'favicon',
            'about_content', 'about_content_en',
            'mission', 'mission_en', 'vision', 'vision_en',
            'values', 'values_en'
        ]
        read_only_fields = ['id']


class PortfolioItemPublicSerializer(serializers.ModelSerializer):
    """Serializer for PortfolioItem in public/landing context."""

    class Meta:
        model = PortfolioItem
        fields = [
            'id', 'media_type', 'image', 'youtube_id', 'title', 'title_en',
            'aspect_ratio', 'position', 'is_active'
        ]
        read_only_fields = ['id']


class PortfolioItemAdminSerializer(serializers.ModelSerializer):
    """Serializer for PortfolioItem in admin context with full details."""

    class Meta:
        model = PortfolioItem
        fields = [
            'id', 'media_type', 'image', 'youtube_id', 'title', 'title_en',
            'aspect_ratio', 'position', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        """Ensure required fields based on media type."""
        media_type = data.get('media_type', self.instance.media_type if self.instance else 'image')
        
        if media_type == PortfolioItem.MEDIA_TYPE_IMAGE and not data.get('image') and not (self.instance and self.instance.image):
            raise serializers.ValidationError(
                {'image': 'Image is required for image type items.'}
            )
        if media_type == PortfolioItem.MEDIA_TYPE_VIDEO and not data.get('youtube_id') and not (self.instance and self.instance.youtube_id):
            raise serializers.ValidationError(
                {'youtube_id': 'YouTube video ID is required for video type items.'}
            )
        return data


class ContactFormSerializer(serializers.Serializer):
    """Serializer for contact form submissions."""

    name = serializers.CharField(max_length=255, required=True)
    email = serializers.EmailField(required=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    company = serializers.CharField(max_length=255, required=False, allow_blank=True)
    message = serializers.CharField(required=True)
    privacy_accepted = serializers.BooleanField(required=True)

    def validate_privacy_accepted(self, value):
        """Ensure privacy policy is accepted."""
        if not value:
            raise serializers.ValidationError(
                'You must accept the privacy policy.'
            )
        return value


class LandingPageSerializer(serializers.Serializer):
    """
    Aggregated serializer for landing page data.

    Returns all content needed for the landing page in a single request.
    """

    carousel = CarouselSlidePublicSerializer(many=True, read_only=True)
    services = ServicePublicSerializer(many=True, read_only=True)
    testimonials = TestimonialPublicSerializer(many=True, read_only=True)
    clients = ClientLogoPublicSerializer(many=True, read_only=True)
    faqs = FAQPublicSerializer(many=True, read_only=True)
    branches = BranchPublicSerializer(many=True, read_only=True)
    portfolio_videos = PortfolioVideoPublicSerializer(many=True, read_only=True)
    portfolio_items = PortfolioItemPublicSerializer(many=True, read_only=True)
    config = SiteConfigurationPublicSerializer(read_only=True)
