"""
Analytics models for tracking user behaviour on the site.

The system collects **anonymous** page views and interaction events that are
batched by the frontend and POSTed in bulk.  No personal data is stored
unless the user is authenticated (in which case only the user ID is linked).

Two tables:
  - PageView   – one row per page visit (fast aggregation for dashboard)
  - TrackEvent – one row per custom event (CTA clicks, form steps, etc.)
"""

import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class PageView(models.Model):
    """
    One row per page visit.  Kept lean for fast aggregation queries.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Session / user (anonymous sessions are tracked by session_id cookie)
    session_id = models.CharField(_('session ID'), max_length=64, blank=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='page_views',
    )

    # Page
    page_url = models.URLField(_('page URL'), max_length=2048)
    page_path = models.CharField(_('page path'), max_length=512, db_index=True)
    referrer = models.URLField(_('referrer'), max_length=2048, blank=True)

    # UTM
    utm_source = models.CharField(max_length=128, blank=True)
    utm_medium = models.CharField(max_length=128, blank=True)
    utm_campaign = models.CharField(max_length=256, blank=True)

    # Device
    user_agent = models.TextField(_('user agent'), blank=True)
    ip_address = models.GenericIPAddressField(_('IP address'), null=True, blank=True)
    device_type = models.CharField(
        max_length=10,
        choices=[('desktop', 'Desktop'), ('tablet', 'Tablet'), ('mobile', 'Mobile')],
        blank=True,
    )
    screen_width = models.PositiveSmallIntegerField(null=True, blank=True)
    screen_height = models.PositiveSmallIntegerField(null=True, blank=True)

    # Geo (derived from IP on write)
    country = models.CharField(max_length=2, blank=True)
    city = models.CharField(max_length=128, blank=True)

    # Timing
    timestamp = models.DateTimeField(_('timestamp'), db_index=True)
    duration_ms = models.PositiveIntegerField(_('time on page (ms)'), null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp', 'page_path']),
            models.Index(fields=['session_id', 'timestamp']),
        ]
        verbose_name = _('page view')
        verbose_name_plural = _('page views')

    def __str__(self):
        return f'{self.page_path} @ {self.timestamp:%Y-%m-%d %H:%M}'


class TrackEvent(models.Model):
    """
    Generic event log (CTA clicks, form interactions, scroll depth, etc.).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    session_id = models.CharField(max_length=64, blank=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='track_events',
    )

    event_name = models.CharField(_('event name'), max_length=128, db_index=True)
    event_data = models.JSONField(_('event data'), default=dict, blank=True)
    page_url = models.URLField(_('page URL'), max_length=2048, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    timestamp = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['event_name', 'timestamp']),
            models.Index(fields=['session_id', 'timestamp']),
        ]
        verbose_name = _('track event')
        verbose_name_plural = _('track events')

    def __str__(self):
        return f'{self.event_name} @ {self.timestamp:%Y-%m-%d %H:%M}'
