"""
Content Models for MCD-Agencia.

This module defines CMS content models for the landing page:
    - CarouselSlide: Hero carousel slides
    - Testimonial: Client testimonials
    - ClientLogo: Client company logos
    - FAQ: Frequently asked questions
    - Branch: Store/office locations
    - LegalPage: Legal documents (terms, privacy, etc.)
    - SiteConfiguration: Global site settings
"""

import uuid

from django.core.validators import RegexValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel, OrderedModel, SEOModel

hex_color_validator = RegexValidator(
    regex=r'^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$',
    message=_('Use a hex color such as #00E5FF or #FFF.'),
)


class CarouselSlide(TimeStampedModel, OrderedModel):
    """
    Hero carousel slide for the homepage.

    Supports bilingual content and configurable CTAs.

    Attributes:
        title: Slide title (Spanish)
        title_en: Slide title (English)
        subtitle: Slide subtitle
        subtitle_en: Subtitle (English)
        image: Slide image
        mobile_image: Optional mobile-specific image
        cta_text: Call-to-action button text
        cta_text_en: CTA text (English)
        cta_url: CTA button link
        is_active: Whether slide is visible
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    title = models.CharField(
        _('title'),
        max_length=255,
        help_text=_('Slide title in Spanish.')
    )
    title_en = models.CharField(
        _('title (English)'),
        max_length=255,
        blank=True,
        help_text=_('Slide title in English.')
    )
    subtitle = models.CharField(
        _('subtitle'),
        max_length=500,
        blank=True,
        help_text=_('Slide subtitle in Spanish.')
    )
    subtitle_en = models.CharField(
        _('subtitle (English)'),
        max_length=500,
        blank=True,
        help_text=_('Slide subtitle in English.')
    )
    image = models.ImageField(
        _('image'),
        upload_to='content/carousel/',
        help_text=_('Slide image. Recommended: 1920x800px.')
    )
    mobile_image = models.ImageField(
        _('mobile image'),
        upload_to='content/carousel/mobile/',
        blank=True,
        null=True,
        help_text=_('Optional mobile-specific image.')
    )
    cta_text = models.CharField(
        _('CTA text'),
        max_length=50,
        blank=True,
        help_text=_('Call-to-action button text.')
    )
    cta_text_en = models.CharField(
        _('CTA text (English)'),
        max_length=50,
        blank=True,
        help_text=_('CTA text in English.')
    )
    cta_url = models.CharField(
        _('CTA URL'),
        max_length=255,
        blank=True,
        help_text=_('CTA button link (internal or external).')
    )
    service_key = models.CharField(
        _('service key'),
        max_length=50,
        blank=True,
        help_text=_('Quote service identifier (e.g. "espectaculares"). Links slide to a quotable service.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether slide is visible.')
    )

    class Meta:
        verbose_name = _('carousel slide')
        verbose_name_plural = _('carousel slides')
        ordering = ['position']

    def __str__(self):
        return self.title


class PromoBanner(TimeStampedModel, OrderedModel):
    """
    Small promotional banner shown below the hero carousel.

    Can optionally apply a percentage discount to catalog products.
    """

    APPLY_ALL = 'all'
    APPLY_SELECTED = 'selected'
    APPLY_CHOICES = [
        (APPLY_ALL, _('All products')),
        (APPLY_SELECTED, _('Selected products')),
    ]

    BACKGROUND_SOLID = 'solid'
    BACKGROUND_GRADIENT = 'gradient'
    BACKGROUND_STYLE_CHOICES = [
        (BACKGROUND_SOLID, _('Solid color')),
        (BACKGROUND_GRADIENT, _('Gradient')),
    ]

    # Values are CSS gradient directions, used verbatim in linear-gradient().
    GRADIENT_DIRECTION_CHOICES = [
        ('to right', _('Left to right')),
        ('to left', _('Right to left')),
        ('to bottom', _('Top to bottom')),
        ('135deg', _('Diagonal')),
    ]

    FONT_SANS = 'sans'
    FONT_DISPLAY = 'display'
    FONT_MONO = 'mono'
    FONT_FAMILY_CHOICES = [
        (FONT_SANS, _('Inter (sans)')),
        (FONT_DISPLAY, _('Montserrat (display)')),
        (FONT_MONO, _('Fira Code (mono)')),
    ]

    TITLE_SIZE_CHOICES = [
        ('sm', _('Small')),
        ('base', _('Medium')),
        ('lg', _('Large')),
        ('xl', _('Extra large')),
    ]

    TITLE_WEIGHT_CHOICES = [
        ('medium', _('Medium')),
        ('semibold', _('Semibold')),
        ('bold', _('Bold')),
        ('black', _('Black')),
    ]

    TEXT_TRANSFORM_CHOICES = [
        ('none', _('As typed')),
        ('uppercase', _('UPPERCASE')),
        ('capitalize', _('Capitalized')),
    ]

    BADGE_SHAPE_CHOICES = [
        ('pill', _('Pill')),
        ('rounded', _('Rounded')),
        ('square', _('Square')),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(_('title'), max_length=120, help_text=_('Main banner text, e.g. "20% OFF".'))
    title_en = models.CharField(_('title (English)'), max_length=120, blank=True)
    subtitle = models.CharField(_('subtitle'), max_length=200, blank=True, help_text=_('Secondary line under title.'))
    subtitle_en = models.CharField(_('subtitle (English)'), max_length=200, blank=True)
    badge_text = models.CharField(
        _('badge text'),
        max_length=30,
        blank=True,
        help_text=_('Short badge label, e.g. "-20%" or "HOT".'),
    )
    cta_url = models.CharField(_('CTA URL'), max_length=255, blank=True)

    # --- Appearance -------------------------------------------------------
    # Colors left blank fall back to a value derived from the base colors, so
    # existing banners keep their current look without any data migration.
    background_color = models.CharField(
        _('background color'),
        max_length=20,
        default='#00E5FF',
        validators=[hex_color_validator],
    )
    background_style = models.CharField(
        _('background style'),
        max_length=20,
        choices=BACKGROUND_STYLE_CHOICES,
        default=BACKGROUND_SOLID,
    )
    background_color_secondary = models.CharField(
        _('second background color'),
        max_length=20,
        blank=True,
        validators=[hex_color_validator],
        help_text=_('Second gradient color. Only used when the background style is a gradient.'),
    )
    gradient_direction = models.CharField(
        _('gradient direction'),
        max_length=20,
        choices=GRADIENT_DIRECTION_CHOICES,
        default='to right',
    )
    border_color = models.CharField(
        _('border color'),
        max_length=20,
        blank=True,
        validators=[hex_color_validator],
        help_text=_('Leave empty for the default subtle border.'),
    )
    text_color = models.CharField(
        _('text color'),
        max_length=20,
        default='#000000',
        validators=[hex_color_validator],
    )
    subtitle_color = models.CharField(
        _('subtitle color'),
        max_length=20,
        blank=True,
        validators=[hex_color_validator],
        help_text=_('Leave empty to reuse the title color at reduced opacity.'),
    )
    badge_background_color = models.CharField(
        _('badge background color'),
        max_length=20,
        blank=True,
        validators=[hex_color_validator],
        help_text=_('Leave empty for a translucent dark badge.'),
    )
    badge_text_color = models.CharField(
        _('badge text color'),
        max_length=20,
        blank=True,
        validators=[hex_color_validator],
        help_text=_('Leave empty to reuse the title color.'),
    )
    badge_shape = models.CharField(
        _('badge shape'),
        max_length=20,
        choices=BADGE_SHAPE_CHOICES,
        default='rounded',
    )

    # --- Typography -------------------------------------------------------
    font_family = models.CharField(
        _('font family'),
        max_length=20,
        choices=FONT_FAMILY_CHOICES,
        default=FONT_SANS,
    )
    title_size = models.CharField(
        _('title size'),
        max_length=10,
        choices=TITLE_SIZE_CHOICES,
        default='sm',
    )
    title_weight = models.CharField(
        _('title weight'),
        max_length=20,
        choices=TITLE_WEIGHT_CHOICES,
        default='semibold',
    )
    text_transform = models.CharField(
        _('text transform'),
        max_length=20,
        choices=TEXT_TRANSFORM_CHOICES,
        default='none',
    )

    discount_percent = models.DecimalField(
        _('discount percent'),
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text=_('Discount to apply to products (0 = banner only).'),
    )
    apply_to = models.CharField(
        _('apply to'),
        max_length=20,
        choices=APPLY_CHOICES,
        default=APPLY_ALL,
    )
    catalog_items = models.ManyToManyField(
        'catalog.CatalogItem',
        blank=True,
        related_name='promo_banners',
        help_text=_('Products affected when apply_to is "selected".'),
    )
    is_active = models.BooleanField(_('is active'), default=True)

    class Meta:
        verbose_name = _('promo banner')
        verbose_name_plural = _('promo banners')
        ordering = ['position']

    def __str__(self):
        return self.title


class Testimonial(TimeStampedModel, OrderedModel):
    """
    Client testimonial for social proof.

    Attributes:
        author_name: Author's name
        author_title: Author's job title
        author_company: Author's company
        content: Testimonial text (Spanish)
        content_en: Testimonial text (English)
        photo: Author's photo
        rating: Optional star rating (1-5)
        is_active: Whether testimonial is visible
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    author_name = models.CharField(
        _('author name'),
        max_length=100,
        help_text=_('Author\'s full name.')
    )
    author_title = models.CharField(
        _('author title'),
        max_length=100,
        blank=True,
        help_text=_('Author\'s job title.')
    )
    author_company = models.CharField(
        _('author company'),
        max_length=100,
        blank=True,
        help_text=_('Author\'s company name.')
    )
    content = models.TextField(
        _('content'),
        help_text=_('Testimonial text in Spanish.')
    )
    content_en = models.TextField(
        _('content (English)'),
        blank=True,
        help_text=_('Testimonial text in English.')
    )
    photo = models.ImageField(
        _('photo'),
        upload_to='content/testimonials/',
        blank=True,
        null=True,
        help_text=_('Author\'s photo.')
    )
    rating = models.PositiveSmallIntegerField(
        _('rating'),
        null=True,
        blank=True,
        choices=[(i, str(i)) for i in range(1, 6)],
        help_text=_('Star rating (1-5).')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether testimonial is visible.')
    )

    class Meta:
        verbose_name = _('testimonial')
        verbose_name_plural = _('testimonials')
        ordering = ['position']

    def __str__(self):
        return f"{self.author_name} - {self.author_company}"


class ClientLogo(TimeStampedModel, OrderedModel):
    """
    Client company logo for trust building.

    Attributes:
        name: Client company name
        logo: Company logo image
        website: Client website URL
        is_active: Whether logo is visible
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        _('name'),
        max_length=100,
        help_text=_('Client company name.')
    )
    logo = models.ImageField(
        _('logo'),
        upload_to='content/clients/',
        help_text=_('Company logo. Recommended: transparent PNG.')
    )
    website = models.URLField(
        _('website'),
        blank=True,
        help_text=_('Client website URL.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether logo is visible.')
    )

    class Meta:
        verbose_name = _('client logo')
        verbose_name_plural = _('client logos')
        ordering = ['position']

    def __str__(self):
        return self.name


class Service(TimeStampedModel, OrderedModel):
    """
    Service offering displayed on the homepage.

    Attributes:
        name: Service name (Spanish)
        name_en: Service name (English)
        description: Service description (Spanish)
        description_en: Description (English)
        icon: Icon class name (e.g., heroicons)
        image: Service image
        price_from: Starting price (optional)
        cta_text: CTA button text
        cta_url: CTA link
        is_featured: Show in featured section
        is_active: Whether service is visible
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        _('name'),
        max_length=100,
        help_text=_('Service name in Spanish.')
    )
    name_en = models.CharField(
        _('name (English)'),
        max_length=100,
        blank=True,
        help_text=_('Service name in English.')
    )
    description = models.TextField(
        _('description'),
        help_text=_('Service description in Spanish.')
    )
    description_en = models.TextField(
        _('description (English)'),
        blank=True,
        help_text=_('Service description in English.')
    )
    icon = models.CharField(
        _('icon'),
        max_length=100,
        blank=True,
        help_text=_('Icon identifier (e.g., "printer", "truck", "photo").')
    )
    image = models.ImageField(
        _('image'),
        upload_to='content/services/',
        blank=True,
        null=True,
        help_text=_('Service image.')
    )
    price_from = models.DecimalField(
        _('price from'),
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Starting price (optional).')
    )
    cta_text = models.CharField(
        _('CTA text'),
        max_length=50,
        blank=True,
        default='Cotizar',
        help_text=_('Call-to-action button text.')
    )
    cta_text_en = models.CharField(
        _('CTA text (English)'),
        max_length=50,
        blank=True,
        default='Quote',
        help_text=_('CTA text in English.')
    )
    cta_url = models.CharField(
        _('CTA URL'),
        max_length=255,
        blank=True,
        default='#cotizar',
        help_text=_('CTA button link.')
    )
    is_featured = models.BooleanField(
        _('is featured'),
        default=False,
        help_text=_('Show in featured services section.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether service is visible.')
    )
    service_key = models.CharField(
        _('service key'),
        max_length=50,
        blank=True,
        null=True,
        unique=True,
        help_text=_('Unique service identifier (e.g. "espectaculares"). '
                     'Links to the quote form service.')
    )

    class Meta:
        verbose_name = _('service')
        verbose_name_plural = _('services')
        ordering = ['position']

    def __str__(self):
        return self.name


class FAQ(TimeStampedModel, OrderedModel):
    """
    Frequently asked question for support.

    Attributes:
        question: Question text (Spanish)
        question_en: Question text (English)
        answer: Answer text (Spanish)
        answer_en: Answer text (English)
        category: Optional category grouping
        is_active: Whether FAQ is visible
    """

    CATEGORY_CHOICES = [
        ('general', _('General')),
        ('products', _('Products & Services')),
        ('orders', _('Orders & Delivery')),
        ('payments', _('Payments')),
        ('quotes', _('Quotes')),
        ('support', _('Support')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    question = models.CharField(
        _('question'),
        max_length=500,
        help_text=_('Question in Spanish.')
    )
    question_en = models.CharField(
        _('question (English)'),
        max_length=500,
        blank=True,
        help_text=_('Question in English.')
    )
    answer = models.TextField(
        _('answer'),
        help_text=_('Answer in Spanish.')
    )
    answer_en = models.TextField(
        _('answer (English)'),
        blank=True,
        help_text=_('Answer in English.')
    )
    category = models.CharField(
        _('category'),
        max_length=20,
        choices=CATEGORY_CHOICES,
        default='general',
        help_text=_('FAQ category.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether FAQ is visible.')
    )

    class Meta:
        verbose_name = _('FAQ')
        verbose_name_plural = _('FAQs')
        ordering = ['category', 'position']

    def __str__(self):
        return self.question[:50]


class Branch(TimeStampedModel, OrderedModel):
    """
    Store/office location information.

    Attributes:
        name: Branch name
        address: Full address
        phone: Contact phone numbers
        email: Contact email
        hours: Operating hours
        hours_en: Hours in English
        latitude: Map latitude
        longitude: Map longitude
        image: Branch photo
        is_active: Whether branch is visible
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        _('name'),
        max_length=100,
        help_text=_('Branch name.')
    )
    street = models.CharField(
        _('street'),
        max_length=255,
        help_text=_('Street address.')
    )
    neighborhood = models.CharField(
        _('neighborhood'),
        max_length=100,
        help_text=_('Neighborhood (colonia).')
    )
    city = models.CharField(
        _('city'),
        max_length=100,
        help_text=_('City.')
    )
    state = models.CharField(
        _('state'),
        max_length=100,
        help_text=_('State.')
    )
    postal_code = models.CharField(
        _('postal code'),
        max_length=10,
        help_text=_('Postal code.')
    )
    phone = models.CharField(
        _('phone'),
        max_length=100,
        help_text=_('Contact phone number(s).')
    )
    email = models.EmailField(
        _('email'),
        help_text=_('Contact email.')
    )
    hours = models.TextField(
        _('hours'),
        help_text=_('Operating hours in Spanish.')
    )
    hours_en = models.TextField(
        _('hours (English)'),
        blank=True,
        help_text=_('Operating hours in English.')
    )
    latitude = models.DecimalField(
        _('latitude'),
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text=_('Map latitude coordinate.')
    )
    longitude = models.DecimalField(
        _('longitude'),
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text=_('Map longitude coordinate.')
    )
    google_maps_url = models.URLField(
        _('Google Maps URL'),
        blank=True,
        help_text=_('Direct link to Google Maps.')
    )
    image = models.ImageField(
        _('image'),
        upload_to='content/branches/',
        blank=True,
        null=True,
        help_text=_('Branch photo.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether branch is visible.')
    )

    class Meta:
        verbose_name = _('branch')
        verbose_name_plural = _('branches')
        ordering = ['position']

    def __str__(self):
        return self.name

    @property
    def full_address(self):
        """Return formatted full address."""
        return f"{self.street}, {self.neighborhood}, {self.city}, {self.state}, C.P. {self.postal_code}"


class LegalPage(TimeStampedModel, SEOModel):
    """
    Legal document page (terms, privacy, cookies).

    Supports versioning for compliance tracking.

    Attributes:
        type: Page type (terms, privacy, cookies)
        title: Page title (Spanish)
        title_en: Page title (English)
        content: Page content (Spanish)
        content_en: Page content (English)
        version: Document version
        effective_date: When this version becomes effective
        is_active: Whether this is the active version
    """

    TYPE_CHOICES = [
        ('terms', _('Terms and Conditions')),
        ('privacy', _('Privacy Policy')),
        ('cookies', _('Cookie Policy')),
        ('legal', _('Legal Notice')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    type = models.CharField(
        _('type'),
        max_length=20,
        choices=TYPE_CHOICES,
        help_text=_('Document type.')
    )
    title = models.CharField(
        _('title'),
        max_length=255,
        help_text=_('Page title in Spanish.')
    )
    title_en = models.CharField(
        _('title (English)'),
        max_length=255,
        blank=True,
        help_text=_('Page title in English.')
    )
    content = models.TextField(
        _('content'),
        help_text=_('Page content in Spanish (supports Markdown).')
    )
    content_en = models.TextField(
        _('content (English)'),
        blank=True,
        help_text=_('Page content in English (supports Markdown).')
    )
    version = models.CharField(
        _('version'),
        max_length=20,
        default='1.0',
        help_text=_('Document version (e.g., 1.0, 1.1).')
    )
    effective_date = models.DateField(
        _('effective date'),
        help_text=_('When this version becomes effective.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether this is the active version.')
    )

    class Meta:
        verbose_name = _('legal page')
        verbose_name_plural = _('legal pages')
        ordering = ['type', '-effective_date']
        unique_together = ['type', 'version']

    def __str__(self):
        return f"{self.get_type_display()} v{self.version}"


class ServiceImage(TimeStampedModel, OrderedModel):
    """
    Image for a service's carousel on the landing page.

    Each service can have multiple images that rotate in a carousel.
    Limited to MAX_IMAGES_PER_SERVICE per service to keep page fast.

    Attributes:
        service: Parent service
        image: Uploaded image (auto-optimized to WebP)
        alt_text: Alt text (Spanish)
        alt_text_en: Alt text (English)
        is_active: Whether image is visible
    """

    MAX_IMAGES_PER_SERVICE = 10
    DISPLAY_FORMAT_LANDSCAPE = 'landscape'
    DISPLAY_FORMAT_REEL = 'reel'
    DISPLAY_FORMAT_CHOICES = [
        (DISPLAY_FORMAT_LANDSCAPE, _('Landscape (16:9)')),
        (DISPLAY_FORMAT_REEL, _('Reel (9:16)')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name='carousel_images',
        verbose_name=_('service'),
    )
    image = models.ImageField(
        _('image'),
        upload_to='content/services/carousel/',
        help_text=_('Service image. Recommended: 800×600 px (4:3). Max 5 MB.')
    )
    alt_text = models.CharField(
        _('alt text'),
        max_length=255,
        blank=True,
        help_text=_('Image alt text in Spanish.')
    )
    alt_text_en = models.CharField(
        _('alt text (English)'),
        max_length=255,
        blank=True,
        help_text=_('Image alt text in English.')
    )
    subtype_key = models.CharField(
        _('subtype key'),
        max_length=100,
        blank=True,
        help_text=_('Service subtype key for quote form linking (e.g. "letras-3d").')
    )
    display_format = models.CharField(
        _('display format'),
        max_length=20,
        choices=DISPLAY_FORMAT_CHOICES,
        default=DISPLAY_FORMAT_LANDSCAPE,
        help_text=_('Visual format for landing display.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether image is visible on the landing page.')
    )

    class Meta:
        verbose_name = _('service image')
        verbose_name_plural = _('service images')
        ordering = ['service', 'position']

    def __str__(self):
        return f"{self.service.name} - Image {self.position + 1}"


class PortfolioVideo(TimeStampedModel, OrderedModel):
    """
    YouTube video for the portfolio section.

    Supports both vertical (Shorts/Reels) and horizontal videos.
    Limited to MAX_VIDEOS total to keep the section manageable.

    Attributes:
        youtube_id: YouTube video ID (e.g., 'sqOb-gSSQq8')
        title: Video label (Spanish)
        title_en: Video label (English)
        orientation: 'vertical' (9:16) or 'horizontal' (16:9)
        is_active: Whether video is visible
    """

    MAX_VIDEOS = 20

    ORIENTATION_CHOICES = [
        ('vertical', _('Vertical (9:16) — Shorts/Reels')),
        ('horizontal', _('Horizontal (16:9) — Standard')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    youtube_id = models.CharField(
        _('YouTube video ID'),
        max_length=20,
        help_text=_('The video ID from the YouTube URL. E.g. for https://youtube.com/shorts/sqOb-gSSQq8 → sqOb-gSSQq8')
    )
    title = models.CharField(
        _('title'),
        max_length=255,
        blank=True,
        help_text=_('Video label in Spanish (shown below the video).')
    )
    title_en = models.CharField(
        _('title (English)'),
        max_length=255,
        blank=True,
        help_text=_('Video label in English.')
    )
    orientation = models.CharField(
        _('orientation'),
        max_length=20,
        choices=ORIENTATION_CHOICES,
        default='vertical',
        help_text=_('Video aspect ratio.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether video is visible on the landing page.')
    )

    class Meta:
        verbose_name = _('portfolio video')
        verbose_name_plural = _('portfolio videos')
        ordering = ['position']

    def __str__(self):
        return f"{self.title or self.youtube_id} ({self.get_orientation_display()})"


class SiteConfiguration(TimeStampedModel):
    """
    Global site configuration singleton.

    Stores site-wide settings that can be edited via admin.

    Attributes:
        site_name: Site name
        tagline: Site tagline
        contact_email: Main contact email
        contact_phone: Main contact phone
        social_links: Social media links (JSON)
        logo: Site logo
        favicon: Site favicon
        analytics_id: Google Analytics ID
        meta_pixel_id: Meta Pixel ID
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    site_name = models.CharField(
        _('site name'),
        max_length=100,
        default='Agencia MCD',
        help_text=_('Site name.')
    )
    site_name_en = models.CharField(
        _('site name (English)'),
        max_length=100,
        blank=True,
        help_text=_('Site name in English.')
    )
    tagline = models.CharField(
        _('tagline'),
        max_length=255,
        blank=True,
        help_text=_('Site tagline in Spanish.')
    )
    tagline_en = models.CharField(
        _('tagline (English)'),
        max_length=255,
        blank=True,
        help_text=_('Site tagline in English.')
    )

    # Contact
    contact_email = models.EmailField(
        _('contact email'),
        help_text=_('Main contact email.')
    )
    contact_phone = models.CharField(
        _('contact phone'),
        max_length=20,
        help_text=_('Main contact phone.')
    )
    whatsapp_number = models.CharField(
        _('WhatsApp number'),
        max_length=20,
        blank=True,
        help_text=_('WhatsApp number for chat.')
    )

    # Social
    social_links = models.JSONField(
        _('social links'),
        default=dict,
        blank=True,
        help_text=_('Social media links as JSON.')
    )

    # Branding
    logo = models.ImageField(
        _('logo'),
        upload_to='content/branding/',
        blank=True,
        null=True,
        help_text=_('Site logo.')
    )
    logo_dark = models.ImageField(
        _('logo (dark)'),
        upload_to='content/branding/',
        blank=True,
        null=True,
        help_text=_('Logo for dark backgrounds.')
    )
    favicon = models.ImageField(
        _('favicon'),
        upload_to='content/branding/',
        blank=True,
        null=True,
        help_text=_('Site favicon.')
    )

    # Analytics
    google_analytics_id = models.CharField(
        _('Google Analytics ID'),
        max_length=50,
        blank=True,
        help_text=_('GA4 Measurement ID.')
    )
    meta_pixel_id = models.CharField(
        _('Meta Pixel ID'),
        max_length=50,
        blank=True,
        help_text=_('Facebook/Meta Pixel ID.')
    )
    google_tag_manager_id = models.CharField(
        _('GTM ID'),
        max_length=50,
        blank=True,
        help_text=_('Google Tag Manager ID.')
    )

    # About
    about_content = models.TextField(
        _('about content'),
        blank=True,
        help_text=_('About section content in Spanish.')
    )
    about_content_en = models.TextField(
        _('about content (English)'),
        blank=True,
        help_text=_('About section content in English.')
    )
    mission = models.TextField(
        _('mission'),
        blank=True,
        help_text=_('Company mission in Spanish.')
    )
    mission_en = models.TextField(
        _('mission (English)'),
        blank=True,
        help_text=_('Company mission in English.')
    )
    vision = models.TextField(
        _('vision'),
        blank=True,
        help_text=_('Company vision in Spanish.')
    )
    vision_en = models.TextField(
        _('vision (English)'),
        blank=True,
        help_text=_('Company vision in English.')
    )
    values = models.TextField(
        _('values'),
        blank=True,
        help_text=_('Company values in Spanish.')
    )
    values_en = models.TextField(
        _('values (English)'),
        blank=True,
        help_text=_('Company values in English.')
    )

    class Meta:
        verbose_name = _('site configuration')
        verbose_name_plural = _('site configuration')

    def __str__(self):
        return self.site_name

    def save(self, *args, **kwargs):
        """Ensure only one configuration exists (singleton)."""
        if not self.pk and SiteConfiguration.objects.exists():
            raise ValueError("Only one site configuration can exist")
        super().save(*args, **kwargs)

    @classmethod
    def get_config(cls):
        """Get or create the site configuration."""
        config, _ = cls.objects.get_or_create(
            defaults={'contact_email': 'info@agenciamcd.mx', 'contact_phone': '+52 744 000 0000'}
        )
        return config


class PortfolioItem(TimeStampedModel, OrderedModel):
    """
    Unified portfolio item for "Trabajos que hablan por nosotros" section.

    Supports both images (landscape 16:9 and portrait reel 9:16) and
    YouTube videos, allowing mixed media galleries without service-specific
    subtypes or linking.

    Attributes:
        media_type: 'image' or 'video'
        image: Uploaded image (required for image type)
        youtube_id: YouTube video ID (required for video type)
        title: Item title/label (Spanish)
        title_en: Item title/label (English)
        aspect_ratio: Display format ('landscape_16_9' or 'portrait_reel_9_16')
        is_active: Whether item is visible on the landing page
    """

    MEDIA_TYPE_IMAGE = 'image'
    MEDIA_TYPE_VIDEO = 'video'
    MEDIA_TYPE_CHOICES = [
        (MEDIA_TYPE_IMAGE, _('Image')),
        (MEDIA_TYPE_VIDEO, _('YouTube Video')),
    ]

    ASPECT_RATIO_LANDSCAPE_16_9 = 'landscape_16_9'
    ASPECT_RATIO_PORTRAIT_REEL_9_16 = 'portrait_reel_9_16'
    ASPECT_RATIO_CHOICES = [
        (ASPECT_RATIO_LANDSCAPE_16_9, _('Landscape (16:9)')),
        (ASPECT_RATIO_PORTRAIT_REEL_9_16, _('Portrait Reel (9:16)')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    media_type = models.CharField(
        _('media type'),
        max_length=20,
        choices=MEDIA_TYPE_CHOICES,
        default=MEDIA_TYPE_IMAGE,
        help_text=_('Whether this item is an image or video.')
    )
    image = models.ImageField(
        _('image'),
        upload_to='content/portfolio/',
        blank=True,
        null=True,
        help_text=_('Uploaded image. Required for image type items. Max 5 MB.')
    )
    youtube_id = models.CharField(
        _('YouTube video ID'),
        max_length=20,
        blank=True,
        help_text=_('YouTube video ID (e.g., "sqOb-gSSQq8"). Required for video type items.')
    )
    title = models.CharField(
        _('title'),
        max_length=255,
        blank=True,
        help_text=_('Item title/label in Spanish.')
    )
    title_en = models.CharField(
        _('title (English)'),
        max_length=255,
        blank=True,
        help_text=_('Item title/label in English.')
    )
    aspect_ratio = models.CharField(
        _('aspect ratio'),
        max_length=20,
        choices=ASPECT_RATIO_CHOICES,
        default=ASPECT_RATIO_LANDSCAPE_16_9,
        help_text=_('Display aspect ratio on landing page.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether this item is visible on the landing page.')
    )

    class Meta:
        verbose_name = _('portfolio item')
        verbose_name_plural = _('portfolio items')
        ordering = ['position']

    def __str__(self):
        if self.media_type == self.MEDIA_TYPE_IMAGE:
            return f"[IMG] {self.title or f'Image {self.position + 1}'}"
        else:
            return f"[VIDEO] {self.title or self.youtube_id}"

    def clean(self):
        """Validate that required fields are present for media type."""
        from django.core.exceptions import ValidationError
        if self.media_type == self.MEDIA_TYPE_IMAGE and not self.image:
            raise ValidationError(_('Image is required for image type items.'))
        if self.media_type == self.MEDIA_TYPE_VIDEO and not self.youtube_id:
            raise ValidationError(_('YouTube video ID is required for video type items.'))
