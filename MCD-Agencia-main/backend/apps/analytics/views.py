"""
Analytics views.

Public endpoint:
  POST /api/v1/analytics/events/   – receive a batch of events (no auth required)

Admin endpoints:
  GET /api/v1/analytics/summary/   – aggregated stats for the dashboard
"""

from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, F
from django.db.models.functions import TruncDate

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.core.permissions import IsRoleAdmin

from .models import PageView, TrackEvent
from .serializers import EventBatchSerializer


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    return xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR')


def _detect_device_type(ua: str) -> str:
    ua_lower = ua.lower()
    if any(kw in ua_lower for kw in ('iphone', 'android', 'mobile')):
        return 'mobile'
    if any(kw in ua_lower for kw in ('ipad', 'tablet')):
        return 'tablet'
    return 'desktop'


@api_view(['POST'])
@permission_classes([AllowAny])
def ingest_events(request):
    """
    Receive a batch of analytics events from the frontend.
    Designed to be fire-and-forget — always returns 202 Accepted.
    """
    serializer = EventBatchSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'ok': False}, status=status.HTTP_400_BAD_REQUEST)

    events = serializer.validated_data['events']
    ip = _get_client_ip(request)
    ua = request.META.get('HTTP_USER_AGENT', '')
    session_id = request.COOKIES.get('sessionid', '')[:64]
    user = request.user if request.user.is_authenticated else None

    page_views = []
    track_events = []

    for ev in events:
        name = ev['event_name']
        data = ev.get('event_data', {})
        ts = ev['timestamp']
        page_url = ev.get('page_url', '')

        if name == 'page_view':
            page_views.append(PageView(
                session_id=session_id,
                user=user,
                page_url=page_url,
                page_path=data.get('page_path', ''),
                referrer=str(data.get('referrer', ''))[:2048],
                utm_source=str(data.get('utm_source', ''))[:128],
                utm_medium=str(data.get('utm_medium', ''))[:128],
                utm_campaign=str(data.get('utm_campaign', ''))[:256],
                user_agent=ua,
                ip_address=ip,
                device_type=_detect_device_type(ua),
                screen_width=data.get('screen_width'),
                screen_height=data.get('screen_height'),
                timestamp=ts,
            ))
        else:
            track_events.append(TrackEvent(
                session_id=session_id,
                user=user,
                event_name=name,
                event_data=data,
                page_url=page_url,
                ip_address=ip,
                user_agent=ua,
                timestamp=ts,
            ))

    # Bulk insert for performance
    if page_views:
        PageView.objects.bulk_create(page_views, ignore_conflicts=True)
    if track_events:
        TrackEvent.objects.bulk_create(track_events, ignore_conflicts=True)

    return Response({'ok': True, 'ingested': len(events)}, status=status.HTTP_202_ACCEPTED)


@api_view(['GET'])
@permission_classes([IsRoleAdmin])
def analytics_summary(request):
    """
    Dashboard summary stats.
    Query params:
      ?days=30  (default 30)
    """
    days = int(request.query_params.get('days', 30))
    since = timezone.now() - timedelta(days=days)

    # ── Page views ──────────────────────────────────────────────────
    pv_qs = PageView.objects.filter(timestamp__gte=since)

    total_views = pv_qs.count()
    unique_sessions = pv_qs.values('session_id').distinct().count()

    views_by_day = list(
        pv_qs.annotate(date=TruncDate('timestamp'))
             .values('date')
             .annotate(views=Count('id'))
             .order_by('date')
    )

    top_pages = list(
        pv_qs.values('page_path')
             .annotate(views=Count('id'))
             .order_by('-views')[:15]
    )

    device_breakdown = list(
        pv_qs.exclude(device_type='')
             .values('device_type')
             .annotate(count=Count('id'))
             .order_by('-count')
    )

    # ── Events ──────────────────────────────────────────────────────
    ev_qs = TrackEvent.objects.filter(timestamp__gte=since)

    top_events = list(
        ev_qs.values('event_name')
             .annotate(count=Count('id'))
             .order_by('-count')[:20]
    )

    # CTA breakdown
    cta_events = list(
        ev_qs.filter(event_name__startswith='cta_click')
             .values('event_name')
             .annotate(count=Count('id'))
             .order_by('-count')
    )

    # Quote form funnel
    funnel_names = ['quote_form_start', 'quote_form_submit', 'quote_form_error', 'quote_form_abandon']
    funnel = {n: 0 for n in funnel_names}
    funnel_qs = ev_qs.filter(event_name__in=funnel_names).values('event_name').annotate(count=Count('id'))
    for row in funnel_qs:
        funnel[row['event_name']] = row['count']

    # UTM sources
    utm_sources = list(
        pv_qs.exclude(utm_source='')
             .values('utm_source')
             .annotate(count=Count('id'))
             .order_by('-count')[:10]
    )

    return Response({
        'period_days': days,
        'page_views': {
            'total': total_views,
            'unique_sessions': unique_sessions,
            'by_day': views_by_day,
            'top_pages': top_pages,
            'devices': device_breakdown,
        },
        'events': {
            'top': top_events,
            'ctas': cta_events,
            'quote_funnel': funnel,
        },
        'traffic_sources': utm_sources,
    })
