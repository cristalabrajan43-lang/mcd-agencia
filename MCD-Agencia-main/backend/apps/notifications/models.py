"""
Notification Models for MCD-Agencia.
"""

import uuid
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Notification(models.Model):
    """In-app notification for users."""

    # ── Quote / Request lifecycle ──────────────────────────────────────────
    TYPE_QUOTE_REQUEST = 'quote_request'
    TYPE_QUOTE_SENT = 'quote_sent'
    TYPE_QUOTE_ACCEPTED = 'quote_accepted'
    TYPE_QUOTE_REJECTED = 'quote_rejected'
    TYPE_CHANGE_REQUEST = 'change_request'

    # ── Order lifecycle ────────────────────────────────────────────────────
    TYPE_ORDER_CREATED = 'order_created'
    TYPE_ORDER_STATUS = 'order_status'
    TYPE_ORDER_COMPLETED = 'order_completed'

    # ── Payments ───────────────────────────────────────────────────────────
    TYPE_PAYMENT_RECEIVED = 'payment_received'

    # ── Admin-only ─────────────────────────────────────────────────────────
    TYPE_NEW_USER = 'new_user'
    TYPE_CATALOG_PURCHASE = 'catalog_purchase'

    # ── Reminders ──────────────────────────────────────────────────────────
    TYPE_QUOTE_EXPIRING = 'quote_expiring'
    TYPE_REQUEST_UNATTENDED = 'request_unattended'

    TYPE_GENERAL = 'general'

    TYPE_CHOICES = [
        (TYPE_QUOTE_REQUEST, _('New Quote Request')),
        (TYPE_QUOTE_SENT, _('Quote Sent')),
        (TYPE_QUOTE_ACCEPTED, _('Quote Accepted')),
        (TYPE_QUOTE_REJECTED, _('Quote Rejected')),
        (TYPE_CHANGE_REQUEST, _('Change Request')),
        (TYPE_ORDER_CREATED, _('Order Created')),
        (TYPE_ORDER_STATUS, _('Order Status Changed')),
        (TYPE_ORDER_COMPLETED, _('Order Completed')),
        (TYPE_PAYMENT_RECEIVED, _('Payment Received')),
        (TYPE_NEW_USER, _('New User Registered')),
        (TYPE_CATALOG_PURCHASE, _('Catalog Purchase')),
        (TYPE_QUOTE_EXPIRING, _('Quote Expiring Soon')),
        (TYPE_REQUEST_UNATTENDED, _('Request Unattended')),
        (TYPE_GENERAL, _('General')),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    notification_type = models.CharField(
        _('type'), max_length=30, choices=TYPE_CHOICES, default=TYPE_GENERAL
    )
    title = models.CharField(_('title'), max_length=255)
    message = models.TextField(_('message'), blank=True)
    is_read = models.BooleanField(_('is read'), default=False)

    # Optional link to entity
    entity_type = models.CharField(_('entity type'), max_length=50, blank=True)
    entity_id = models.CharField(_('entity id'), max_length=50, blank=True)
    action_url = models.CharField(_('action url'), max_length=500, blank=True)

    created_at = models.DateTimeField(_('created at'), auto_now_add=True)

    class Meta:
        verbose_name = _('notification')
        verbose_name_plural = _('notifications')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', '-created_at']),
        ]

    def __str__(self):
        return f"{self.title} → {self.recipient}"

    # ── Factory helpers ────────────────────────────────────────────────────

    @classmethod
    def notify(cls, recipient, notification_type, title, message='',
               entity_type='', entity_id='', action_url=''):
        """Create a notification for a single user."""
        return cls.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else '',
            action_url=action_url,
        )

    @classmethod
    def notify_staff(cls, notification_type, title, message='',
                     entity_type='', entity_id='', action_url=''):
        """Create a notification for ALL staff users (admin + sales)."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        staff_users = User.objects.filter(
            is_active=True,
            role__name__in=['admin', 'sales'],
        )
        notifications = []
        for user in staff_users:
            notifications.append(cls(
                recipient=user,
                notification_type=notification_type,
                title=title,
                message=message,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else '',
                action_url=action_url,
            ))
        return cls.objects.bulk_create(notifications)

    @classmethod
    def notify_sales(cls, notification_type, title, message='',
                     entity_type='', entity_id='', action_url=''):
        """Create a notification for ALL sales users."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        sales_users = User.objects.filter(
            is_active=True, role__name='sales'
        )
        notifications = []
        for user in sales_users:
            notifications.append(cls(
                recipient=user,
                notification_type=notification_type,
                title=title,
                message=message,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else '',
                action_url=action_url,
            ))
        return cls.objects.bulk_create(notifications)

    @classmethod
    def notify_assigned_seller_and_admins(cls, assigned_to, notification_type,
                                          title, message='', entity_type='',
                                          entity_id='', action_url=''):
        """
        Notify the assigned seller + all admins.

        If assigned_to is None, only admins are notified.
        If assigned_to IS an admin, no duplicate.
        """
        from django.contrib.auth import get_user_model
        User = get_user_model()

        recipients = set()

        # Always include admins
        admin_ids = set(
            User.objects.filter(
                is_active=True, role__name='admin',
            ).values_list('id', flat=True)
        )
        recipients.update(admin_ids)

        # Include assigned seller
        if assigned_to and assigned_to.is_active:
            recipients.add(assigned_to.id)

        notifications = []
        for uid in recipients:
            notifications.append(cls(
                recipient_id=uid,
                notification_type=notification_type,
                title=title,
                message=message,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else '',
                action_url=action_url,
            ))
        return cls.objects.bulk_create(notifications)

    @classmethod
    def notify_admins(cls, notification_type, title, message='',
                      entity_type='', entity_id='', action_url=''):
        """Create a notification for admin users only."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        admins = User.objects.filter(
            is_active=True,
            role__name='admin',
        )
        notifications = []
        for user in admins:
            notifications.append(cls(
                recipient=user,
                notification_type=notification_type,
                title=title,
                message=message,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else '',
                action_url=action_url,
            ))
        return cls.objects.bulk_create(notifications)

    @classmethod
    def notify_owner_and_admins(cls, owner, notification_type, title,
                                message='', entity_type='', entity_id='',
                                action_url=''):
        """
        Notify the quote/order owner (salesperson) **plus** all admins.

        If the owner IS an admin, they get only one notification (no dups).
        If owner is None, only admins are notified.
        """
        from django.contrib.auth import get_user_model
        User = get_user_model()

        recipients = set()

        # Always include admins
        admin_ids = set(
            User.objects.filter(
                is_active=True,
                role__name='admin',
            ).values_list('id', flat=True)
        )
        recipients.update(admin_ids)

        # Include the owner (salesperson who created the quote)
        if owner and owner.is_active:
            recipients.add(owner.id)

        notifications = []
        for uid in recipients:
            notifications.append(cls(
                recipient_id=uid,
                notification_type=notification_type,
                title=title,
                message=message,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else '',
                action_url=action_url,
            ))
        return cls.objects.bulk_create(notifications)
