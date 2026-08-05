"""
Content Views for MCD-Agencia.

This module provides ViewSets for CMS content:
    - Public landing page data
    - Admin content management
"""

from django.db import models, transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.chatbot.models import Lead
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsRoleAdmin
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
from .serializers import (
    CarouselSlideSerializer,
    CarouselSlidePublicSerializer,
    PromoBannerSerializer,
    PromoBannerPublicSerializer,
    TestimonialSerializer,
    TestimonialPublicSerializer,
    ClientLogoSerializer,
    ClientLogoPublicSerializer,
    ServiceSerializer,
    ServicePublicSerializer,
    ServiceImageSerializer,
    ServiceImagePublicSerializer,
    PortfolioVideoSerializer,
    PortfolioVideoPublicSerializer,
    PortfolioItemPublicSerializer,
    PortfolioItemAdminSerializer,
    FAQSerializer,
    FAQPublicSerializer,
    BranchSerializer,
    BranchPublicSerializer,
    LegalPageSerializer,
    LegalPagePublicSerializer,
    SiteConfigurationSerializer,
    SiteConfigurationPublicSerializer,
    ContactFormSerializer,
    LandingPageSerializer,
)
from .services.promotions import get_promo_targets, restore_discount_from_item, sync_promo_banner


class LandingPageView(APIView):
    """
    Get all landing page data in a single request.

    GET /api/v1/content/landing/
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Return aggregated landing page data."""
        data = {
            'carousel': CarouselSlide.objects.filter(is_active=True).order_by('position'),
            'services': Service.objects.filter(is_active=True).order_by('position').prefetch_related(
                models.Prefetch(
                    'carousel_images',
                    queryset=ServiceImage.objects.filter(is_active=True).order_by('position'),
                )
            ),
            'testimonials': Testimonial.objects.filter(is_active=True).order_by('position'),
            'clients': ClientLogo.objects.filter(is_active=True).order_by('position'),
            'faqs': FAQ.objects.filter(is_active=True).order_by('category', 'position'),
            'branches': Branch.objects.filter(is_active=True).order_by('position'),
            'portfolio_videos': PortfolioVideo.objects.filter(is_active=True).order_by('position'),
            'portfolio_items': PortfolioItem.objects.filter(is_active=True).order_by('position'),
            'promo_banners': PromoBanner.objects.filter(is_active=True).order_by('position'),
            'config': SiteConfiguration.get_config(),
        }

        return Response({
            'carousel': CarouselSlidePublicSerializer(
                data['carousel'], many=True, context={'request': request}
            ).data,
            'services': ServicePublicSerializer(
                data['services'], many=True, context={'request': request}
            ).data,
            'testimonials': TestimonialPublicSerializer(
                data['testimonials'], many=True, context={'request': request}
            ).data,
            'clients': ClientLogoPublicSerializer(
                data['clients'], many=True, context={'request': request}
            ).data,
            'faqs': FAQPublicSerializer(
                data['faqs'], many=True, context={'request': request}
            ).data,
            'branches': BranchPublicSerializer(
                data['branches'], many=True, context={'request': request}
            ).data,
            'portfolio_videos': PortfolioVideoPublicSerializer(
                data['portfolio_videos'], many=True, context={'request': request}
            ).data,
            'portfolio_items': PortfolioItemPublicSerializer(
                data['portfolio_items'], many=True, context={'request': request}
            ).data,
            'promo_banners': PromoBannerPublicSerializer(
                data['promo_banners'], many=True, context={'request': request}
            ).data,
            'config': SiteConfigurationPublicSerializer(
                data['config'], context={'request': request}
            ).data,
        })


class ContactFormView(APIView):
    """
    Handle contact form submissions.

    POST /api/v1/content/contact/
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Process contact form submission."""
        serializer = ContactFormSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Create lead from contact form
        lead = Lead.objects.create(
            name=serializer.validated_data['name'],
            email=serializer.validated_data['email'],
            phone=serializer.validated_data.get('phone', ''),
            company=serializer.validated_data.get('company', ''),
            message=serializer.validated_data['message'],
            source='contact_form',
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500]
        )

        AuditLog.log(
            entity=lead,
            action=AuditLog.ACTION_CREATED,
            request=request,
            metadata={'source': 'contact_form'}
        )

        # TODO: Send notification email to team

        return Response({
            'message': _('Thank you for your message. We will contact you soon.')
        })

    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class CarouselSlideViewSet(viewsets.ModelViewSet):
    """
    ViewSet for carousel slide management.

    Public: GET /api/v1/content/carousel/
    Admin: All CRUD operations
    """

    serializer_class = CarouselSlideSerializer
    pagination_class = StandardPagination

    def paginate_queryset(self, queryset):
        """Skip pagination for public requests (landing gets plain array)."""
        if not self.request.user.is_staff:
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        """Return slides based on user role."""
        if self.request.user.is_staff:
            return CarouselSlide.objects.all().order_by('position')
        return CarouselSlide.objects.filter(is_active=True).order_by('position')

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if not self.request.user.is_staff:
            return CarouselSlidePublicSerializer
        return CarouselSlideSerializer

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]

    def perform_create(self, serializer):
        """Log slide creation."""
        slide = serializer.save()
        AuditLog.log(
            entity=slide,
            action=AuditLog.ACTION_CREATED,
            actor=self.request.user,
            after_state=CarouselSlideSerializer(slide).data,
            request=self.request
        )

    def perform_update(self, serializer):
        """Log slide update."""
        before_state = CarouselSlideSerializer(self.get_object()).data
        slide = serializer.save()
        AuditLog.log(
            entity=slide,
            action=AuditLog.ACTION_UPDATED,
            actor=self.request.user,
            before_state=before_state,
            after_state=CarouselSlideSerializer(slide).data,
            request=self.request
        )


class PromoBannerViewSet(viewsets.ModelViewSet):
    """ViewSet for promotional banners below the hero."""

    serializer_class = PromoBannerSerializer
    pagination_class = StandardPagination

    def paginate_queryset(self, queryset):
        if not self.request.user.is_staff:
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        if self.request.user.is_staff:
            return PromoBanner.objects.all().prefetch_related('catalog_items').order_by('position')
        return PromoBanner.objects.filter(is_active=True).order_by('position')

    def get_serializer_class(self):
        if not self.request.user.is_staff:
            return PromoBannerPublicSerializer
        return PromoBannerSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]

    @transaction.atomic
    def perform_create(self, serializer):
        banner = serializer.save()
        sync_promo_banner(banner)
        AuditLog.log(
            entity=banner,
            action=AuditLog.ACTION_CREATED,
            actor=self.request.user,
            after_state=PromoBannerSerializer(banner).data,
            request=self.request,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        banner = self.get_object()
        previous_targets = list(get_promo_targets(banner))
        before_state = PromoBannerSerializer(banner).data
        banner = serializer.save()
        new_target_ids = {item.id for item in get_promo_targets(banner)}
        for item in previous_targets:
            if item.id not in new_target_ids:
                restore_discount_from_item(item)
        sync_promo_banner(banner)
        AuditLog.log(
            entity=banner,
            action=AuditLog.ACTION_UPDATED,
            actor=self.request.user,
            before_state=before_state,
            after_state=PromoBannerSerializer(banner).data,
            request=self.request,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        targets = list(get_promo_targets(instance))
        before_state = PromoBannerSerializer(instance).data
        instance.delete()
        if instance.discount_percent > 0:
            for item in targets:
                restore_discount_from_item(item)
        AuditLog.log(
            entity=instance,
            action=AuditLog.ACTION_DELETED,
            actor=self.request.user,
            before_state=before_state,
            request=self.request,
        )


class TestimonialViewSet(viewsets.ModelViewSet):
    """ViewSet for testimonial management."""

    serializer_class = TestimonialSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        """Return testimonials based on user role."""
        if self.request.user.is_staff:
            return Testimonial.objects.all().order_by('position')
        return Testimonial.objects.filter(is_active=True).order_by('position')

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if not self.request.user.is_staff:
            return TestimonialPublicSerializer
        return TestimonialSerializer

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]


class ClientLogoViewSet(viewsets.ModelViewSet):
    """ViewSet for client logo management."""

    serializer_class = ClientLogoSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        """Return logos based on user role."""
        if self.request.user.is_staff:
            return ClientLogo.objects.all().order_by('position')
        return ClientLogo.objects.filter(is_active=True).order_by('position')

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if not self.request.user.is_staff:
            return ClientLogoPublicSerializer
        return ClientLogoSerializer

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]


class ServiceViewSet(viewsets.ModelViewSet):
    """ViewSet for service management."""

    serializer_class = ServiceSerializer
    pagination_class = StandardPagination

    def paginate_queryset(self, queryset):
        """Skip pagination for public requests."""
        if not self.request.user.is_staff:
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        """Return services based on user role."""
        if self.request.user.is_staff:
            return Service.objects.all().order_by('position')
        return Service.objects.filter(is_active=True).order_by('position')

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if not self.request.user.is_staff:
            return ServicePublicSerializer
        return ServiceSerializer

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured services."""
        services = Service.objects.filter(is_active=True, is_featured=True).order_by('position')
        serializer = ServicePublicSerializer(services, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='sync')
    def sync_services(self, request):
        """
        Bulk-create missing services from a list of definitions.

        POST body: { "services": [ { "service_key": "...", "name": "...", ... }, ... ] }
        Only creates services whose service_key doesn't already exist.
        Returns the full list of services after sync.
        """
        definitions = request.data.get('services', [])
        if not definitions:
            return Response({'error': 'No services provided.'}, status=status.HTTP_400_BAD_REQUEST)

        existing_keys = set(
            Service.objects.filter(service_key__isnull=False)
            .values_list('service_key', flat=True)
        )

        created = []
        for defn in definitions:
            key = defn.get('service_key', '')
            if not key or key in existing_keys:
                continue
            svc = Service.objects.create(
                service_key=key,
                name=defn.get('name', key),
                name_en=defn.get('name_en', ''),
                description=defn.get('description', ''),
                description_en=defn.get('description_en', ''),
                icon=defn.get('icon', ''),
                cta_text=defn.get('cta_text', 'Cotizar'),
                cta_text_en=defn.get('cta_text_en', 'Quote'),
                cta_url=defn.get('cta_url', '#cotizar'),
                position=defn.get('position', 0),
                is_active=True,
            )
            created.append(svc.service_key)
            existing_keys.add(key)

        all_services = Service.objects.all().order_by('position')
        serializer = ServiceSerializer(all_services, many=True, context={'request': request})
        return Response({
            'created': created,
            'services': serializer.data,
        })


class ServiceImageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for service carousel image management.

    Supports file upload via multipart/form-data.
    Limited to MAX_IMAGES_PER_SERVICE per service.

    GET /api/v1/content/service-images/?service=<uuid>  — list images
    POST /api/v1/content/service-images/                 — upload image
    """

    serializer_class = ServiceImageSerializer
    pagination_class = StandardPagination

    def paginate_queryset(self, queryset):
        """Skip pagination for public requests."""
        if not self.request.user.is_staff:
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        qs = ServiceImage.objects.select_related('service').order_by('service', 'position')
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        if not self.request.user.is_staff:
            return ServiceImagePublicSerializer
        return ServiceImageSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]

    def perform_create(self, serializer):
        image = serializer.save()
        AuditLog.log(
            entity=image, action=AuditLog.ACTION_CREATED,
            actor=self.request.user, request=self.request,
        )

    def perform_destroy(self, instance):
        AuditLog.log(
            entity=instance, action=AuditLog.ACTION_DELETED,
            actor=self.request.user, request=self.request,
        )
        instance.delete()


class PortfolioVideoViewSet(viewsets.ModelViewSet):
    """
    ViewSet for portfolio video management.

    Limited to MAX_VIDEOS total.
    Accepts YouTube video ID or full URL (auto-extracted).

    GET  /api/v1/content/portfolio-videos/  — list videos
    POST /api/v1/content/portfolio-videos/  — add video
    """

    serializer_class = PortfolioVideoSerializer
    pagination_class = StandardPagination

    def paginate_queryset(self, queryset):
        """Skip pagination for public requests."""
        if not self.request.user.is_staff:
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        if self.request.user.is_staff:
            return PortfolioVideo.objects.all().order_by('position')
        return PortfolioVideo.objects.filter(is_active=True).order_by('position')

    def get_serializer_class(self):
        if not self.request.user.is_staff:
            return PortfolioVideoPublicSerializer
        return PortfolioVideoSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]

    def perform_create(self, serializer):
        video = serializer.save()
        AuditLog.log(
            entity=video, action=AuditLog.ACTION_CREATED,
            actor=self.request.user, request=self.request,
        )

    def perform_update(self, serializer):
        video = serializer.save()
        AuditLog.log(
            entity=video, action=AuditLog.ACTION_UPDATED,
            actor=self.request.user, request=self.request,
        )


class FAQViewSet(viewsets.ModelViewSet):
    """ViewSet for FAQ management."""

    serializer_class = FAQSerializer
    pagination_class = StandardPagination
    filterset_fields = ['category']

    def get_queryset(self):
        """Return FAQs based on user role."""
        if self.request.user.is_staff:
            return FAQ.objects.all().order_by('category', 'position')
        return FAQ.objects.filter(is_active=True).order_by('category', 'position')

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if not self.request.user.is_staff:
            return FAQPublicSerializer
        return FAQSerializer

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get list of FAQ categories."""
        return Response([
            {'value': choice[0], 'label': str(choice[1])}
            for choice in FAQ.CATEGORY_CHOICES
        ])


class BranchViewSet(viewsets.ModelViewSet):
    """ViewSet for branch management."""

    serializer_class = BranchSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        """Return branches based on user role."""
        if self.request.user.is_staff:
            return Branch.objects.all().order_by('position')
        return Branch.objects.filter(is_active=True).order_by('position')

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if not self.request.user.is_staff:
            return BranchPublicSerializer
        return BranchSerializer

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]


class LegalPageViewSet(viewsets.ModelViewSet):
    """ViewSet for legal page management."""

    serializer_class = LegalPageSerializer
    pagination_class = StandardPagination
    lookup_field = 'type'

    def get_queryset(self):
        """Return legal pages based on user role."""
        if self.request.user.is_staff:
            return LegalPage.objects.all()
        return LegalPage.objects.filter(is_active=True)

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if not self.request.user.is_staff:
            return LegalPagePublicSerializer
        return LegalPageSerializer

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]

    @action(detail=False, methods=['get'], url_path='by-type/(?P<page_type>[^/.]+)')
    def by_type(self, request, page_type=None):
        """Get active legal page by type."""
        try:
            page = LegalPage.objects.filter(
                type=page_type, is_active=True
            ).order_by('-effective_date').first()

            if not page:
                return Response(
                    {'error': _('Legal page not found.')},
                    status=status.HTTP_404_NOT_FOUND
                )

            serializer = LegalPagePublicSerializer(page, context={'request': request})
            return Response(serializer.data)
        except Exception:
            return Response(
                {'error': _('Invalid page type.')},
                status=status.HTTP_400_BAD_REQUEST
            )


class SiteConfigurationView(APIView):
    """
    Get/update site configuration.

    GET /api/v1/content/config/
    PUT /api/v1/admin/content/config/
    """

    def get_permissions(self):
        """Set permissions based on method."""
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]

    def get(self, request):
        """Get site configuration."""
        config = SiteConfiguration.get_config()
        if request.user.is_staff:
            serializer = SiteConfigurationSerializer(config, context={'request': request})
        else:
            serializer = SiteConfigurationPublicSerializer(config, context={'request': request})
        return Response(serializer.data)

    def put(self, request):
        """Update site configuration (admin)."""
        config = SiteConfiguration.get_config()
        before_state = SiteConfigurationSerializer(config).data

        serializer = SiteConfigurationSerializer(
            config, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        AuditLog.log(
            entity=config,
            action=AuditLog.ACTION_UPDATED,
            actor=request.user,
            before_state=before_state,
            after_state=SiteConfigurationSerializer(config).data,
            request=request
        )

        return Response(SiteConfigurationSerializer(config).data)

class PortfolioItemViewSet(viewsets.ModelViewSet):
    """ViewSet for portfolio item management (unified image + video gallery)."""

    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]
    pagination_class = StandardPagination

    def _bootstrap_from_legacy(self):
        """Backfill unified portfolio items from legacy sources without duplicates."""
        existing_video_ids = set(
            PortfolioItem.objects.filter(media_type=PortfolioItem.MEDIA_TYPE_VIDEO)
            .exclude(youtube_id='')
            .values_list('youtube_id', flat=True)
        )
        existing_image_paths = set(
            path for path in PortfolioItem.objects.filter(media_type=PortfolioItem.MEDIA_TYPE_IMAGE)
            .exclude(image='')
            .values_list('image', flat=True)
            if path
        )

        next_position = PortfolioItem.objects.aggregate(max_pos=models.Max('position')).get('max_pos')
        position = (next_position + 1) if next_position is not None else 0

        with transaction.atomic():
            legacy_videos = PortfolioVideo.objects.filter(is_active=True).order_by('position')
            for video in legacy_videos:
                if not video.youtube_id or video.youtube_id in existing_video_ids:
                    continue
                PortfolioItem.objects.create(
                    media_type=PortfolioItem.MEDIA_TYPE_VIDEO,
                    youtube_id=video.youtube_id,
                    title=video.title,
                    title_en=video.title_en,
                    aspect_ratio=(
                        PortfolioItem.ASPECT_RATIO_PORTRAIT_REEL_9_16
                        if video.orientation == 'vertical'
                        else PortfolioItem.ASPECT_RATIO_LANDSCAPE_16_9
                    ),
                    position=position,
                    is_active=video.is_active,
                )
                existing_video_ids.add(video.youtube_id)
                position += 1

            legacy_images = ServiceImage.objects.filter(is_active=True).select_related('service').order_by('position')
            for image in legacy_images:
                image_name = image.image.name if image.image else ''
                if not image_name or image_name in existing_image_paths:
                    continue
                PortfolioItem.objects.create(
                    media_type=PortfolioItem.MEDIA_TYPE_IMAGE,
                    image=image.image,
                    title=getattr(image.service, 'name', '') or image.alt_text,
                    title_en=getattr(image.service, 'name_en', '') or image.alt_text_en,
                    aspect_ratio=(
                        PortfolioItem.ASPECT_RATIO_PORTRAIT_REEL_9_16
                        if image.display_format == ServiceImage.DISPLAY_FORMAT_REEL
                        else PortfolioItem.ASPECT_RATIO_LANDSCAPE_16_9
                    ),
                    position=position,
                    is_active=image.is_active,
                )
                existing_image_paths.add(image_name)
                position += 1

    def get_queryset(self):
        """Return portfolio items; always backfill legacy on access."""
        self._bootstrap_from_legacy()
        if self.request.user.is_staff:
            return PortfolioItem.objects.all().order_by('position')
        return PortfolioItem.objects.filter(is_active=True).order_by('position')

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if not self.request.user.is_staff:
            return PortfolioItemPublicSerializer
        return PortfolioItemAdminSerializer

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsRoleAdmin()]

    def perform_create(self, serializer):
        """Log portfolio item creation."""
        item = serializer.save()
        AuditLog.log(
            entity=item,
            action=AuditLog.ACTION_CREATED,
            actor=self.request.user,
            after_state=PortfolioItemAdminSerializer(item).data,
            request=self.request
        )

    def perform_update(self, serializer):
        """Log portfolio item update."""
        before_state = PortfolioItemAdminSerializer(self.get_object()).data
        item = serializer.save()
        AuditLog.log(
            entity=item,
            action=AuditLog.ACTION_UPDATED,
            actor=self.request.user,
            before_state=before_state,
            after_state=PortfolioItemAdminSerializer(item).data,
            request=self.request
        )

    def perform_destroy(self, instance):
        """Log portfolio item deletion."""
        AuditLog.log(
            entity=instance,
            action=AuditLog.ACTION_DELETED,
            actor=self.request.user,
            before_state=PortfolioItemAdminSerializer(instance).data,
            request=self.request
        )
        super().perform_destroy(instance)