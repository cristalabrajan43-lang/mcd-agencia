"""
Core Abstract Models for MCD-Agencia.

This module provides base abstract models that are inherited by other models
throughout the application. These provide common functionality like:
    - Timestamp tracking (created_at, updated_at)
    - Soft delete functionality
    - UUID primary keys
    - SEO fields

Usage:
    from apps.core.models import TimeStampedModel, SoftDeleteModel

    class MyModel(TimeStampedModel, SoftDeleteModel):
        name = models.CharField(max_length=255)
"""

import uuid

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class TimeStampedModel(models.Model):
    """
    Abstract base model that provides self-updating created_at and updated_at fields.

    Attributes:
        created_at: DateTime when the record was created (auto-set on creation)
        updated_at: DateTime when the record was last modified (auto-updated)
    """

    created_at = models.DateTimeField(
        _('created at'),
        auto_now_add=True,
        db_index=True,
        help_text=_('Date and time when this record was created.')
    )
    updated_at = models.DateTimeField(
        _('updated at'),
        auto_now=True,
        help_text=_('Date and time when this record was last updated.')
    )

    class Meta:
        abstract = True
        ordering = ['-created_at']


class SoftDeleteManager(models.Manager):
    """
    Custom manager that excludes soft-deleted records by default.

    This manager filters out records where is_deleted=True, providing
    a clean interface for querying only active records.

    Usage:
        MyModel.objects.all()           # Returns only non-deleted records
        MyModel.objects.deleted()       # Returns only deleted records
        MyModel.all_objects.all()       # Returns all records including deleted
    """

    def get_queryset(self):
        """Return queryset excluding soft-deleted records."""
        return super().get_queryset().filter(is_deleted=False)

    def deleted(self):
        """Return queryset of only soft-deleted records."""
        return super().get_queryset().filter(is_deleted=True)


class SoftDeleteModel(models.Model):
    """
    Abstract base model that provides soft delete functionality.

    Instead of permanently deleting records, this model marks them as deleted
    by setting is_deleted=True and deleted_at to the current timestamp.
    This allows for data recovery and maintains referential integrity.

    Attributes:
        is_deleted: Boolean flag indicating if the record is soft-deleted
        deleted_at: DateTime when the record was soft-deleted (null if active)

    Methods:
        delete(): Soft delete the record (set is_deleted=True)
        hard_delete(): Permanently delete the record from the database
        restore(): Restore a soft-deleted record

    Managers:
        objects: Default manager that excludes deleted records
        all_objects: Manager that includes deleted records
    """

    is_deleted = models.BooleanField(
        _('is deleted'),
        default=False,
        db_index=True,
        help_text=_('Indicates if this record has been soft-deleted.')
    )
    deleted_at = models.DateTimeField(
        _('deleted at'),
        null=True,
        blank=True,
        help_text=_('Date and time when this record was soft-deleted.')
    )

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        """
        Soft delete the record.

        Instead of removing the record from the database, this method
        sets is_deleted=True and deleted_at to the current timestamp.

        Args:
            using: Database alias to use
            keep_parents: Not used, kept for compatibility

        Returns:
            Tuple of (1, {model_name: 1}) mimicking Django's delete() return
        """
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])
        return (1, {self._meta.label: 1})

    def hard_delete(self, using=None, keep_parents=False):
        """
        Permanently delete the record from the database.

        Use this method when you actually want to remove the record.
        This is irreversible.

        Args:
            using: Database alias to use
            keep_parents: Whether to keep parent instances

        Returns:
            Django's default delete() return value
        """
        return super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        """
        Restore a soft-deleted record.

        Sets is_deleted=False and deleted_at=None, making the record
        visible again through the default manager.
        """
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])


class UUIDModel(models.Model):
    """
    Abstract base model that uses UUID as the primary key.

    UUIDs are globally unique identifiers that don't expose sequential IDs,
    making them suitable for public-facing APIs and distributed systems.

    Attributes:
        id: UUID primary key (auto-generated)
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text=_('Unique identifier for this record.')
    )

    class Meta:
        abstract = True


class SEOModel(models.Model):
    """
    Abstract base model that provides SEO-related fields.

    These fields are used for search engine optimization and social media
    sharing (Open Graph, Twitter Cards).

    Attributes:
        meta_title: SEO title for the page (used in <title> tag)
        meta_description: SEO description (used in meta description tag)
        meta_keywords: SEO keywords (deprecated but still used by some engines)
        og_image: Open Graph image for social sharing
    """

    meta_title = models.CharField(
        _('meta title'),
        max_length=255,
        blank=True,
        help_text=_('SEO title for search engines. Max 60 characters recommended.')
    )
    meta_description = models.TextField(
        _('meta description'),
        blank=True,
        max_length=500,
        help_text=_('SEO description for search engines. Max 160 characters recommended.')
    )
    meta_keywords = models.CharField(
        _('meta keywords'),
        max_length=255,
        blank=True,
        help_text=_('Comma-separated keywords for SEO.')
    )
    og_image = models.ImageField(
        _('Open Graph image'),
        upload_to='seo/og/',
        blank=True,
        null=True,
        help_text=_('Image for social media sharing. Recommended size: 1200x630px.')
    )

    class Meta:
        abstract = True


class OrderedModel(models.Model):
    """
    Abstract base model that provides ordering functionality.

    This model adds a position field that can be used to manually order
    records. Useful for carousels, menus, and other ordered content.

    Attributes:
        position: Integer position for manual ordering (lower = first)
    """

    position = models.PositiveIntegerField(
        _('position'),
        default=0,
        db_index=True,
        help_text=_('Display order. Lower values appear first.')
    )

    class Meta:
        abstract = True
        ordering = ['position']


class ERPIntegrationModel(models.Model):
    """
    Abstract base model for ERP integration preparation.

    Provides fields needed for syncing with external ERP systems.
    These fields are designed to be ready for future integration
    without requiring schema changes.

    Attributes:
        external_system: Name of the external system (e.g., "SAP", "ODOO")
        external_id: ID of this record in the external system
        last_sync_at: Last time this record was synced with external system
        sync_status: Current sync status
    """

    SYNC_STATUS_CHOICES = [
        ('pending', _('Pending')),
        ('synced', _('Synced')),
        ('failed', _('Failed')),
        ('conflict', _('Conflict')),
    ]

    external_system = models.CharField(
        _('external system'),
        max_length=50,
        blank=True,
        db_index=True,
        help_text=_('Name of the external ERP system.')
    )
    external_id = models.CharField(
        _('external ID'),
        max_length=100,
        blank=True,
        db_index=True,
        help_text=_('ID of this record in the external system.')
    )
    last_sync_at = models.DateTimeField(
        _('last sync at'),
        null=True,
        blank=True,
        help_text=_('Last successful sync with external system.')
    )
    sync_status = models.CharField(
        _('sync status'),
        max_length=20,
        choices=SYNC_STATUS_CHOICES,
        default='pending',
        help_text=_('Current synchronization status.')
    )

    class Meta:
        abstract = True


class SlugModel(models.Model):
    """
    Abstract base model that provides a URL-friendly slug field.

    The slug is automatically generated from a source field (typically name)
    and is used in URLs for SEO-friendly paths.

    Attributes:
        slug: URL-friendly identifier (unique)
    """

    slug = models.SlugField(
        _('slug'),
        max_length=255,
        unique=True,
        db_index=True,
        help_text=_('URL-friendly identifier. Auto-generated from name.')
    )

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        """
        Generate slug if not provided.

        Override this in child classes to specify the source field:

        def save(self, *args, **kwargs):
            if not self.slug:
                from django.utils.text import slugify
                self.slug = slugify(self.name)
            super().save(*args, **kwargs)
        """
        super().save(*args, **kwargs)
