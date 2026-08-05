"""
Catalog Models for MCD-Agencia.

This module defines the unified catalog system for products and services:
    - Category: Hierarchical product/service categories
    - Tag: Flexible tagging for items
    - Attribute: Configurable attributes (size, color, material)
    - AttributeValue: Values for attributes
    - CatalogItem: Unified product/service model
    - ProductVariant: SKU-level variants with specific attributes
    - CatalogImage: Product/service images

The catalog is designed to be "future-proof" supporting:
    - Direct purchase (BUY mode)
    - Quote-only items (QUOTE mode)
    - Hybrid items (both BUY and QUOTE)
    - Configurable deposits/payments
"""

import uuid
from decimal import Decimal

from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from mptt.models import MPTTModel, TreeForeignKey

from apps.core.models import (
    TimeStampedModel,
    SoftDeleteModel,
    SEOModel,
    OrderedModel,
    ERPIntegrationModel,
)


class Category(MPTTModel, TimeStampedModel, SoftDeleteModel, SEOModel, OrderedModel):
    """
    Hierarchical category model for products and services.

    Uses django-mptt for efficient tree operations (ancestors, descendants).
    Categories can be nested to create a hierarchical structure.

    Attributes:
        name: Category name
        name_en: Category name in English
        slug: URL-friendly identifier
        description: Category description
        description_en: Description in English
        parent: Parent category (null for root categories)
        image: Category image
            type: Category type (product or service)
        is_active: Whether category is visible
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        _('name'),
        max_length=100,
        help_text=_('Category name in Spanish.')
    )
    name_en = models.CharField(
        _('name (English)'),
        max_length=100,
        blank=True,
        help_text=_('Category name in English.')
    )
    slug = models.SlugField(
        _('slug'),
        max_length=150,
        unique=True,
        help_text=_('URL-friendly identifier.')
    )
    description = models.TextField(
        _('description'),
        blank=True,
        help_text=_('Category description in Spanish.')
    )
    description_en = models.TextField(
        _('description (English)'),
        blank=True,
        help_text=_('Category description in English.')
    )
    parent = TreeForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
        help_text=_('Parent category.')
    )
    image = models.ImageField(
        _('image'),
        upload_to='catalog/categories/',
        blank=True,
        null=True,
        help_text=_('Category image.')
    )
    type = models.CharField(
        _('type'),
        max_length=20,
        choices=[
            ('product', _('Product')),
            ('service', _('Service')),
        ],
        default='product',
        help_text=_('Category type: product or service.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether this category is visible.')
    )

    class MPTTMeta:
        order_insertion_by = ['position', 'name']

    class Meta:
        verbose_name = _('category')
        verbose_name_plural = _('categories')

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Generate a unique slug if not provided."""
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def get_localized_name(self, language='es'):
        """Return name in the specified language."""
        if language == 'en' and self.name_en:
            return self.name_en
        return self.name

    def get_localized_description(self, language='es'):
        """Return description in the specified language."""
        if language == 'en' and self.description_en:
            return self.description_en
        return self.description


class Tag(TimeStampedModel):
    """
    Flexible tagging model for catalog items.

    Tags provide a flat, flexible way to categorize items beyond
    the hierarchical category structure.

    Attributes:
        name: Tag name
        slug: URL-friendly identifier
        color: Optional color for UI display
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        _('name'),
        max_length=50,
        unique=True,
        help_text=_('Tag name.')
    )
    slug = models.SlugField(
        _('slug'),
        max_length=60,
        unique=True,
        help_text=_('URL-friendly identifier.')
    )
    color = models.CharField(
        _('color'),
        max_length=7,
        blank=True,
        help_text=_('Hex color code (e.g., #FF5733).')
    )

    class Meta:
        verbose_name = _('tag')
        verbose_name_plural = _('tags')
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Generate slug if not provided."""
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Attribute(TimeStampedModel):
    """
    Configurable attribute model for product variants.

    Attributes define characteristics that vary between product
    variants (e.g., Size, Color, Material).

    Attributes:
        name: Attribute name (e.g., "Size", "Material")
        name_en: Name in English
        slug: URL-friendly identifier
        type: Data type (select, text, number, boolean)
        is_filterable: Whether to show in catalog filters
        is_visible: Whether to show on product page
    """

    TYPE_CHOICES = [
        ('select', _('Select (dropdown)')),
        ('text', _('Text')),
        ('number', _('Number')),
        ('boolean', _('Yes/No')),
        ('color', _('Color')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        _('name'),
        max_length=100,
        help_text=_('Attribute name (e.g., Size, Material).')
    )
    name_en = models.CharField(
        _('name (English)'),
        max_length=100,
        blank=True,
        help_text=_('Attribute name in English.')
    )
    slug = models.SlugField(
        _('slug'),
        max_length=110,
        unique=True,
        help_text=_('URL-friendly identifier.')
    )
    type = models.CharField(
        _('type'),
        max_length=20,
        choices=TYPE_CHOICES,
        default='select',
        help_text=_('Data type for this attribute.')
    )
    is_filterable = models.BooleanField(
        _('is filterable'),
        default=True,
        help_text=_('Show in catalog filters.')
    )
    is_visible = models.BooleanField(
        _('is visible'),
        default=True,
        help_text=_('Show on product detail page.')
    )

    class Meta:
        verbose_name = _('attribute')
        verbose_name_plural = _('attributes')
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Generate a unique slug if not provided."""
        if not self.slug:
            base_slug = slugify(self.name) or 'item'
            max_length = self._meta.get_field('slug').max_length
            base_slug = base_slug[:max_length]
            slug_candidate = base_slug
            suffix = 2

            while CatalogItem.all_objects.filter(slug=slug_candidate).exclude(pk=self.pk).exists():
                suffix_str = f"-{suffix}"
                slug_candidate = f"{base_slug[:max_length - len(suffix_str)]}{suffix_str}"
                suffix += 1

            self.slug = slug_candidate
        super().save(*args, **kwargs)


class AttributeValue(TimeStampedModel):
    """
    Values for configurable attributes.

    Each attribute can have multiple predefined values that
    can be selected when creating product variants.

    Attributes:
        attribute: Parent attribute
        value: Display value
        value_en: Value in English
        slug: URL-friendly identifier
        color_code: Hex color for color attributes
        position: Display order
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    attribute = models.ForeignKey(
        Attribute,
        on_delete=models.CASCADE,
        related_name='values',
        help_text=_('Parent attribute.')
    )
    value = models.CharField(
        _('value'),
        max_length=100,
        help_text=_('Display value.')
    )
    value_en = models.CharField(
        _('value (English)'),
        max_length=100,
        blank=True,
        help_text=_('Value in English.')
    )
    slug = models.SlugField(
        _('slug'),
        max_length=110,
        help_text=_('URL-friendly identifier.')
    )
    color_code = models.CharField(
        _('color code'),
        max_length=7,
        blank=True,
        help_text=_('Hex color code for color attributes.')
    )
    position = models.PositiveIntegerField(
        _('position'),
        default=0,
        help_text=_('Display order.')
    )

    class Meta:
        verbose_name = _('attribute value')
        verbose_name_plural = _('attribute values')
        ordering = ['attribute', 'position', 'value']
        unique_together = ['attribute', 'slug']

    def __str__(self):
        return f"{self.attribute.name}: {self.value}"

    def save(self, *args, **kwargs):
        """Generate slug if not provided."""
        if not self.slug:
            self.slug = slugify(self.value)
        super().save(*args, **kwargs)


class CatalogItem(TimeStampedModel, SoftDeleteModel, SEOModel, ERPIntegrationModel):
    """
    Unified catalog item model for products and services.

    This model represents both physical products and services in a
    unified structure. It supports multiple sale modes and payment options.

    Sale Modes:
        - BUY: Direct purchase with fixed price
        - QUOTE: Quote-only, requires RFQ process
        - HYBRID: Supports both direct purchase and quotes

    Payment Modes:
        - FULL: Full payment required at checkout
        - DEPOSIT_ALLOWED: Partial payment (deposit) allowed

    Attributes:
        type: Product or Service
        name/name_en: Item names (bilingual)
        slug: URL-friendly identifier
        description/description_en: Descriptions (bilingual)
        category: Primary category
        tags: Associated tags
        sale_mode: BUY, QUOTE, or HYBRID
        payment_mode: FULL or DEPOSIT_ALLOWED
        base_price: Base price (for items without variants)
        deposit_percentage/amount: Deposit configuration
        track_inventory: Whether to track stock
        is_active: Whether item is visible
        is_featured: Whether to feature on homepage
    """

    TYPE_CHOICES = [
        ('product', _('Product')),
        ('service', _('Service')),
    ]

    SALE_MODE_CHOICES = [
        ('BUY', _('Direct purchase')),
        ('QUOTE', _('Quote only')),
        ('HYBRID', _('Both')),
    ]

    PAYMENT_MODE_CHOICES = [
        ('FULL', _('Full payment')),
        ('DEPOSIT_ALLOWED', _('Deposit allowed')),
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
        default='product',
        help_text=_('Item type: product or service.')
    )

    # Basic Information (Bilingual)
    name = models.CharField(
        _('name'),
        max_length=255,
        help_text=_('Item name in Spanish.')
    )
    name_en = models.CharField(
        _('name (English)'),
        max_length=255,
        blank=True,
        help_text=_('Item name in English.')
    )
    slug = models.SlugField(
        _('slug'),
        max_length=280,
        unique=True,
        help_text=_('URL-friendly identifier.')
    )
    short_description = models.CharField(
        _('short description'),
        max_length=500,
        blank=True,
        help_text=_('Brief description for listings.')
    )
    short_description_en = models.CharField(
        _('short description (English)'),
        max_length=500,
        blank=True,
        help_text=_('Brief description in English.')
    )
    description = models.TextField(
        _('description'),
        blank=True,
        help_text=_('Full description in Spanish.')
    )
    description_en = models.TextField(
        _('description (English)'),
        blank=True,
        help_text=_('Full description in English.')
    )

    # Classification
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='items',
        help_text=_('Primary category.')
    )
    tags = models.ManyToManyField(
        Tag,
        blank=True,
        related_name='items',
        help_text=_('Associated tags.')
    )

    # Sale & Payment Configuration
    sale_mode = models.CharField(
        _('sale mode'),
        max_length=10,
        choices=SALE_MODE_CHOICES,
        default='BUY',
        help_text=_('How this item can be purchased.')
    )
    payment_mode = models.CharField(
        _('payment mode'),
        max_length=20,
        choices=PAYMENT_MODE_CHOICES,
        default='FULL',
        help_text=_('Payment requirements for this item.')
    )

    # Pricing
    base_price = models.DecimalField(
        _('base price'),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Base price in MXN (for items without variants).')
    )
    compare_at_price = models.DecimalField(
        _('compare at price'),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Original price for showing discounts.')
    )

    # Deposit Configuration
    deposit_percentage = models.DecimalField(
        _('deposit percentage'),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Deposit percentage (e.g., 50.00 for 50%).')
    )
    deposit_amount = models.DecimalField(
        _('deposit amount'),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Fixed deposit amount in MXN.')
    )

    # Inventory
    track_inventory = models.BooleanField(
        _('track inventory'),
        default=False,
        help_text=_('Whether to track stock for this item.')
    )

    # Visibility & Status
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        db_index=True,
        help_text=_('Whether this item is visible in catalog.')
    )
    is_featured = models.BooleanField(
        _('is featured'),
        default=False,
        help_text=_('Show on homepage/featured sections.')
    )

    # Additional Content (Bilingual)
    specifications = models.JSONField(
        _('specifications'),
        default=dict,
        blank=True,
        help_text=_('Technical specifications as JSON.')
    )
    installation_info = models.TextField(
        _('installation info'),
        blank=True,
        help_text=_('Installation information (if applicable).')
    )
    installation_info_en = models.TextField(
        _('installation info (English)'),
        blank=True,
        help_text=_('Installation info in English.')
    )

    class Meta:
        verbose_name = _('catalog item')
        verbose_name_plural = _('catalog items')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['category', 'is_active']),
            models.Index(fields=['sale_mode', 'is_active']),
            models.Index(fields=['is_featured', 'is_active']),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Generate a unique slug if not provided."""
        if not self.slug:
            base_slug = slugify(self.name) or 'item'
            max_length = self._meta.get_field('slug').max_length
            base_slug = base_slug[:max_length]
            slug_candidate = base_slug
            suffix = 2

            while CatalogItem.all_objects.filter(slug=slug_candidate).exclude(pk=self.pk).exists():
                suffix_str = f"-{suffix}"
                slug_candidate = f"{base_slug[:max_length - len(suffix_str)]}{suffix_str}"
                suffix += 1

            self.slug = slug_candidate
        super().save(*args, **kwargs)

    def get_localized_name(self, language='es'):
        """Return name in the specified language."""
        if language == 'en' and self.name_en:
            return self.name_en
        return self.name

    def get_localized_description(self, language='es'):
        """Return description in the specified language."""
        if language == 'en' and self.description_en:
            return self.description_en
        return self.description

    @property
    def price_range(self):
        """
        Get price range for items with variants.

        Returns:
            tuple: (min_price, max_price) or (base_price, base_price) if no variants
        """
        variants = self.variants.filter(is_active=True)
        if variants.exists():
            prices = variants.values_list('price', flat=True)
            return (min(prices), max(prices))
        return (self.base_price, self.base_price)

    @property
    def effective_price(self):
        """
        Get the effective price for display.

        Returns the base price or the minimum variant price.
        """
        min_price, _ = self.price_range
        return min_price

    @property
    def has_discount(self):
        """Check if item has a discount (compare_at_price > effective_price)."""
        if self.compare_at_price and self.effective_price:
            return self.compare_at_price > self.effective_price
        return False

    @property
    def discount_percentage(self):
        """Calculate discount percentage."""
        if self.has_discount:
            discount = (self.compare_at_price - self.effective_price) / self.compare_at_price
            return round(discount * 100)
        return 0

    def calculate_deposit(self, total_amount):
        """
        Calculate deposit amount for this item.

        Args:
            total_amount: Total order amount for this item

        Returns:
            Decimal: Deposit amount required
        """
        if self.payment_mode != 'DEPOSIT_ALLOWED':
            return total_amount

        if self.deposit_amount:
            return min(self.deposit_amount, total_amount)

        if self.deposit_percentage:
            return total_amount * (self.deposit_percentage / Decimal('100'))

        return total_amount

    @property
    def total_stock(self):
        """Get total stock across all variants."""
        if not self.track_inventory:
            return None
        return self.variants.filter(is_active=True).aggregate(
            total=models.Sum('stock')
        )['total'] or 0

    @property
    def is_in_stock(self):
        """Check if item is in stock."""
        if not self.track_inventory:
            return True
        return self.total_stock > 0


class ProductVariant(TimeStampedModel, SoftDeleteModel, ERPIntegrationModel):
    """
    Product variant model representing specific SKUs.

    Variants represent specific combinations of attributes
    (e.g., "Blue, Large" or "Vinyl, 3x2m").

    Attributes:
        catalog_item: Parent catalog item
        sku: Stock Keeping Unit (unique identifier)
        name: Variant name (auto-generated from attributes)
        attribute_values: Selected attribute values
        price: Variant price
        stock: Current stock level
        low_stock_threshold: Alert threshold
        weight: Weight for shipping
        dimensions: Dimensions as JSON
        barcode: Barcode/UPC
        is_active: Whether variant is available
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    catalog_item = models.ForeignKey(
        CatalogItem,
        on_delete=models.CASCADE,
        related_name='variants',
        help_text=_('Parent catalog item.')
    )
    sku = models.CharField(
        _('SKU'),
        max_length=100,
        unique=True,
        help_text=_('Stock Keeping Unit.')
    )
    name = models.CharField(
        _('name'),
        max_length=255,
        blank=True,
        help_text=_('Variant name (e.g., "Blue, Large").')
    )
    attribute_values = models.ManyToManyField(
        AttributeValue,
        related_name='variants',
        blank=True,
        help_text=_('Selected attribute values.')
    )

    # Pricing
    cost = models.DecimalField(
        _('cost'),
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text=_('Unit cost in MXN (for inventory valuation).')
    )
    price = models.DecimalField(
        _('price'),
        max_digits=12,
        decimal_places=2,
        help_text=_('Variant price in MXN.')
    )
    compare_at_price = models.DecimalField(
        _('compare at price'),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Original price for showing discounts.')
    )

    # Inventory
    stock = models.IntegerField(
        _('stock'),
        default=0,
        help_text=_('Current stock level.')
    )
    low_stock_threshold = models.IntegerField(
        _('low stock threshold'),
        default=10,
        help_text=_('Alert when stock falls below this level.')
    )

    # Physical Properties
    weight = models.DecimalField(
        _('weight'),
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Weight in kg.')
    )
    dimensions = models.JSONField(
        _('dimensions'),
        default=dict,
        blank=True,
        help_text=_('Dimensions as JSON: {length, width, height, unit}.')
    )
    barcode = models.CharField(
        _('barcode'),
        max_length=50,
        blank=True,
        help_text=_('Barcode/UPC.')
    )

    # Status
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether this variant is available.')
    )

    class Meta:
        verbose_name = _('product variant')
        verbose_name_plural = _('product variants')
        ordering = ['catalog_item', 'sku']
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['catalog_item', 'is_active']),
            models.Index(fields=['stock']),
        ]

    def __str__(self):
        return f"{self.catalog_item.name} - {self.name or self.sku}"

    @property
    def is_low_stock(self):
        """Check if stock is below threshold."""
        return self.stock <= self.low_stock_threshold

    @property
    def is_out_of_stock(self):
        """Check if variant is out of stock."""
        return self.stock <= 0

    def generate_name_from_attributes(self):
        """Generate variant name from attribute values."""
        values = self.attribute_values.all().order_by('attribute__name')
        return ", ".join([v.value for v in values])


class CatalogImage(TimeStampedModel, OrderedModel):
    """
    Product/service images.

    Supports multiple images per catalog item with ordering
    and alt text for accessibility.

    Attributes:
        catalog_item: Parent catalog item
        variant: Optional variant-specific image
        image: Image file
        alt_text: Accessibility alt text
        alt_text_en: Alt text in English
        is_primary: Whether this is the main image
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    catalog_item = models.ForeignKey(
        CatalogItem,
        on_delete=models.CASCADE,
        related_name='images',
        help_text=_('Parent catalog item.')
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='images',
        help_text=_('Optional variant-specific image.')
    )
    image = models.ImageField(
        _('image'),
        upload_to='catalog/products/',
        help_text=_('Product image.')
    )
    alt_text = models.CharField(
        _('alt text'),
        max_length=255,
        blank=True,
        help_text=_('Accessibility alt text.')
    )
    alt_text_en = models.CharField(
        _('alt text (English)'),
        max_length=255,
        blank=True,
        help_text=_('Alt text in English.')
    )
    is_primary = models.BooleanField(
        _('is primary'),
        default=False,
        help_text=_('Whether this is the main image.')
    )

    class Meta:
        verbose_name = _('catalog image')
        verbose_name_plural = _('catalog images')
        ordering = ['catalog_item', '-is_primary', 'position']

    def __str__(self):
        return f"Image for {self.catalog_item.name}"

    def save(self, *args, **kwargs):
        """Ensure only one primary image per item."""
        if self.is_primary:
            CatalogImage.objects.filter(
                catalog_item=self.catalog_item,
                is_primary=True
            ).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)
