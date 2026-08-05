"""
Audit Models for MCD-Agencia.

This module defines the audit logging system with append-only logs
for tracking all sensitive operations in the system.

The audit log captures:
    - Actor (user who performed action)
    - Request metadata (IP, user agent)
    - Entity affected (type and ID)
    - Action performed
    - Before/after state with diff
    - Additional context

Design Principles:
    - Append-only: Records cannot be modified or deleted
    - Complete: Every sensitive action is logged
    - Queryable: Efficient filtering and searching
    - Exportable: CSV/JSON export capability
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class AuditLogManager(models.Manager):
    """
    Custom manager for AuditLog that prevents updates and deletions.

    This ensures the audit log remains append-only for data integrity.
    """

    def get_queryset(self):
        """Return standard queryset."""
        return super().get_queryset()


class AuditLog(models.Model):
    """
    Append-only audit log for tracking all sensitive operations.

    This model captures comprehensive information about every
    significant action in the system for compliance and debugging.

    Covered Entities:
        - CatalogItem (products/services)
        - ProductVariant
        - Category, Tag, Attribute
        - Order, OrderLine
        - Quote, QuoteRequest
        - Payment
        - InventoryMovement
        - User (profile changes, role changes)
        - Configuration (system settings)
        - Content (landing page, FAQ, etc.)

    Attributes:
        timestamp: When the action occurred
        actor: User who performed the action
        actor_email: Email preserved for deleted users
        actor_ip: IP address of the request
        actor_user_agent: Browser/device info
        entity_type: Type of affected entity
        entity_id: ID of affected entity
        action: Action performed
        before_state: JSON state before change
        after_state: JSON state after change
        diff: Calculated differences
        metadata: Additional context
    """

    # Action types
    ACTION_CREATED = 'created'
    ACTION_UPDATED = 'updated'
    ACTION_DELETED = 'deleted'
    ACTION_STATE_CHANGED = 'state_changed'
    ACTION_LOGIN = 'login'
    ACTION_LOGOUT = 'logout'
    ACTION_PASSWORD_CHANGED = 'password_changed'
    ACTION_PERMISSION_CHANGED = 'permission_changed'
    ACTION_VIEWED = 'viewed'
    ACTION_EXPORTED = 'exported'
    ACTION_PAYMENT_PROCESSED = 'payment_processed'
    ACTION_EMAIL_SENT = 'email_sent'

    ACTION_CHOICES = [
        (ACTION_CREATED, _('Created')),
        (ACTION_UPDATED, _('Updated')),
        (ACTION_DELETED, _('Deleted')),
        (ACTION_STATE_CHANGED, _('State Changed')),
        (ACTION_LOGIN, _('Login')),
        (ACTION_LOGOUT, _('Logout')),
        (ACTION_PASSWORD_CHANGED, _('Password Changed')),
        (ACTION_PERMISSION_CHANGED, _('Permission Changed')),
        (ACTION_VIEWED, _('Viewed')),
        (ACTION_EXPORTED, _('Exported')),
        (ACTION_PAYMENT_PROCESSED, _('Payment Processed')),
        (ACTION_EMAIL_SENT, _('Email Sent')),
    ]

    # Entity types (models that are audited)
    ENTITY_TYPES = [
        ('CatalogItem', _('Catalog Item')),
        ('ProductVariant', _('Product Variant')),
        ('Category', _('Category')),
        ('Tag', _('Tag')),
        ('Attribute', _('Attribute')),
        ('Order', _('Order')),
        ('OrderLine', _('Order Line')),
        ('Quote', _('Quote')),
        ('QuoteRequest', _('Quote Request')),
        ('QuoteLine', _('Quote Line')),
        ('Payment', _('Payment')),
        ('InventoryMovement', _('Inventory Movement')),
        ('User', _('User')),
        ('Role', _('Role')),
        ('Configuration', _('Configuration')),
        ('Content', _('Content')),
        ('Carousel', _('Carousel')),
        ('Branch', _('Branch')),
        ('FAQ', _('FAQ')),
        ('Testimonial', _('Testimonial')),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    timestamp = models.DateTimeField(
        _('timestamp'),
        auto_now_add=True,
        db_index=True,
        help_text=_('When the action occurred.')
    )

    # Actor information
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        help_text=_('User who performed the action.')
    )
    actor_email = models.EmailField(
        _('actor email'),
        blank=True,
        help_text=_('Email preserved for deleted users.')
    )
    actor_ip = models.GenericIPAddressField(
        _('actor IP'),
        null=True,
        blank=True,
        help_text=_('IP address of the request.')
    )
    actor_user_agent = models.TextField(
        _('actor user agent'),
        blank=True,
        help_text=_('Browser/device information.')
    )

    # Entity information
    entity_type = models.CharField(
        _('entity type'),
        max_length=50,
        choices=ENTITY_TYPES,
        db_index=True,
        help_text=_('Type of affected entity.')
    )
    entity_id = models.CharField(
        _('entity ID'),
        max_length=100,
        db_index=True,
        help_text=_('ID of affected entity.')
    )
    entity_repr = models.CharField(
        _('entity representation'),
        max_length=255,
        blank=True,
        help_text=_('Human-readable entity representation.')
    )

    # Action
    action = models.CharField(
        _('action'),
        max_length=30,
        choices=ACTION_CHOICES,
        db_index=True,
        help_text=_('Action performed.')
    )

    # State tracking
    before_state = models.JSONField(
        _('before state'),
        null=True,
        blank=True,
        help_text=_('JSON state before change.')
    )
    after_state = models.JSONField(
        _('after state'),
        null=True,
        blank=True,
        help_text=_('JSON state after change.')
    )
    diff = models.JSONField(
        _('diff'),
        null=True,
        blank=True,
        help_text=_('Calculated differences.')
    )

    # Additional context
    metadata = models.JSONField(
        _('metadata'),
        default=dict,
        blank=True,
        help_text=_('Additional context and notes.')
    )

    objects = AuditLogManager()

    class Meta:
        verbose_name = _('audit log')
        verbose_name_plural = _('audit logs')
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['actor', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
            models.Index(fields=['timestamp']),
        ]
        # Prevent modifications at database level (if supported)
        managed = True

    def __str__(self):
        return f"{self.action} {self.entity_type}:{self.entity_id} by {self.actor_email or 'system'}"

    def save(self, *args, **kwargs):
        """
        Save audit log entry.

        Preserves actor email in case user is deleted later.
        Calculates diff if not provided.
        """
        # Preserve actor email
        if self.actor and not self.actor_email:
            self.actor_email = self.actor.email

        # Calculate diff if not provided
        if self.before_state and self.after_state and not self.diff:
            self.diff = self._calculate_diff()

        # Prevent updates to existing records
        if self.pk:
            existing = AuditLog.objects.filter(pk=self.pk).exists()
            if existing:
                raise ValueError("Audit log records cannot be modified")

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Prevent deletion of audit log entries."""
        raise ValueError("Audit log records cannot be deleted")

    def _calculate_diff(self):
        """
        Calculate differences between before and after states.

        Returns:
            dict: Dictionary of changed fields with old/new values
        """
        if not self.before_state or not self.after_state:
            return None

        diff = {}
        all_keys = set(self.before_state.keys()) | set(self.after_state.keys())

        for key in all_keys:
            before_val = self.before_state.get(key)
            after_val = self.after_state.get(key)

            if before_val != after_val:
                diff[key] = {
                    'before': before_val,
                    'after': after_val
                }

        return diff if diff else None

    @staticmethod
    def _make_json_serializable(obj):
        """
        Recursively convert non-JSON-serializable objects to serializable types.

        Handles UUID, Decimal, datetime, date, and other common types.
        """
        from decimal import Decimal
        from datetime import datetime, date
        from uuid import UUID

        if obj is None:
            return None
        if isinstance(obj, dict):
            return {k: AuditLog._make_json_serializable(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [AuditLog._make_json_serializable(item) for item in obj]
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, date):
            return obj.isoformat()
        return obj

    @classmethod
    def log(cls, entity, action, actor=None, before_state=None, after_state=None,
            request=None, metadata=None):
        """
        Create an audit log entry.

        This is the primary method for creating audit entries.

        Args:
            entity: The model instance being audited
            action: Action type (created, updated, deleted, etc.)
            actor: User performing the action
            before_state: State before the action (dict)
            after_state: State after the action (dict)
            request: HTTP request for metadata extraction
            metadata: Additional context

        Returns:
            AuditLog: The created audit log entry
        """
        # Extract request metadata
        actor_ip = None
        actor_user_agent = ''

        if request:
            actor_ip = cls._get_client_ip(request)
            actor_user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]

        # Get entity type name
        entity_type = entity.__class__.__name__

        # Get entity representation
        entity_repr = str(entity)[:255] if entity else ''

        # Make states JSON serializable
        before_state = cls._make_json_serializable(before_state)
        after_state = cls._make_json_serializable(after_state)
        metadata = cls._make_json_serializable(metadata or {})

        return cls.objects.create(
            actor=actor,
            actor_ip=actor_ip,
            actor_user_agent=actor_user_agent,
            entity_type=entity_type,
            entity_id=str(entity.pk) if entity and hasattr(entity, 'pk') else '',
            entity_repr=entity_repr,
            action=action,
            before_state=before_state,
            after_state=after_state,
            metadata=metadata
        )

    @staticmethod
    def _get_client_ip(request):
        """
        Get client IP address from request.

        Handles proxy headers (X-Forwarded-For).
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
