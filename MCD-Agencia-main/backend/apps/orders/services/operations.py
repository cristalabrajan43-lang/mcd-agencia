from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
from typing import Any

from django.utils import timezone

from apps.orders.models import FieldOperationJob, LogisticsJob, Order, OrderLine, ProductionJob

MOBILE_SERVICE_KEYWORDS = {
    'publicidad_movil',
    'publicidad móvil',
    'valla_movil',
    'valla móvil',
    'autobus',
    'autobuses',
    'perifoneo',
}


@dataclass
class LineRouting:
    requires_production: bool
    delivery_method: str
    service_type: str
    required_date: datetime | None
    estimated_date: datetime | None


def _as_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if hasattr(value, 'year') and hasattr(value, 'month') and hasattr(value, 'day'):
        return timezone.make_aware(datetime.combine(value, time(hour=12)))
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed)
        return parsed
    except Exception:
        return None


def _parse_bool(value: Any, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value or '').strip().lower()
    if not text:
        return default
    return text in {'1', 'true', 'yes', 'si', 'sí'}


def _normalize_delivery_method(value: Any, order: Order) -> str:
    raw = str(value or '').strip().lower()
    if raw in {'installation', 'pickup', 'shipping', 'digital', 'not_applicable'}:
        return raw
    return order.delivery_method or Order.DELIVERY_NOT_APPLICABLE


def _extract_routing(order: Order, line: OrderLine) -> LineRouting:
    metadata = line.metadata or {}
    service_type = str(
        metadata.get('service_type')
        or metadata.get('quote_request_service_type')
        or metadata.get('catalog_service_type')
        or ''
    ).strip().lower()
    delivery_method = _normalize_delivery_method(
        metadata.get('delivery_method') or order.delivery_method,
        order,
    )

    # Direct catalog purchases skip production - go straight to logistics
    # Quote-based orders require production workflow
    if order.origin == Order.ORIGIN_DIRECT_PURCHASE:
        requires_production = False
    else:
        requires_production = _parse_bool(
            metadata.get('requires_production'),
            default=delivery_method not in {Order.DELIVERY_DIGITAL, Order.DELIVERY_NOT_APPLICABLE},
        )

    required_date = _as_datetime(metadata.get('required_date'))
    estimated_date = _as_datetime(metadata.get('estimated_delivery_date'))

    return LineRouting(
        requires_production=requires_production,
        delivery_method=delivery_method,
        service_type=service_type,
        required_date=required_date,
        estimated_date=estimated_date,
    )


def _is_mobile_service(service_type: str) -> bool:
    normalized = service_type.strip().lower()
    if not normalized:
        return False
    if normalized in MOBILE_SERVICE_KEYWORDS:
        return True
    return any(keyword in normalized for keyword in MOBILE_SERVICE_KEYWORDS)


def _has_any_jobs(order: Order) -> bool:
    return (
        order.production_jobs.exists()
        or order.logistics_jobs.exists()
        or order.field_ops_jobs.exists()
    )


def build_operational_plan(order: Order) -> None:
    """Create operation tracks for an order if they do not exist yet."""
    if _has_any_jobs(order):
        sync_operational_rollup(order)
        return

    service_snapshot: list[dict[str, Any]] = []
    tracks_required: set[str] = set()
    dependencies: list[dict[str, str]] = []

    lines = list(order.lines.all())
    for line in lines:
        route = _extract_routing(order, line)

        snapshot = {
            'line_id': str(line.id),
            'sku': line.sku,
            'name': line.name,
            'service_type': route.service_type,
            'delivery_method': route.delivery_method,
            'requires_production': route.requires_production,
            'required_date': route.required_date.isoformat() if route.required_date else None,
            'estimated_date': route.estimated_date.isoformat() if route.estimated_date else None,
            'metadata': line.metadata or {},
        }
        service_snapshot.append(snapshot)

        if route.requires_production:
            tracks_required.add('production')
            prod = ProductionJob.objects.create(
                order=order,
                order_line=line,
                status=ProductionJob.STATUS_QUEUED,
                planned_end=route.estimated_date,
                metadata={
                    'service_type': route.service_type,
                    'delivery_method': route.delivery_method,
                    'source': 'auto_plan',
                },
            )
        else:
            prod = None

        if route.delivery_method in {Order.DELIVERY_SHIPPING, Order.DELIVERY_PICKUP, Order.DELIVERY_DIGITAL}:
            tracks_required.add('logistics')
            logistics_type = {
                Order.DELIVERY_SHIPPING: LogisticsJob.TYPE_SHIPPING,
                Order.DELIVERY_PICKUP: LogisticsJob.TYPE_PICKUP,
                Order.DELIVERY_DIGITAL: LogisticsJob.TYPE_DIGITAL,
            }[route.delivery_method]

            log_job = LogisticsJob.objects.create(
                order=order,
                status=LogisticsJob.STATUS_PENDING_DISPATCH,
                logistics_type=logistics_type,
                window_end=route.required_date or route.estimated_date,
                address_snapshot=order.delivery_address or {},
                metadata={
                    'line_id': str(line.id),
                    'service_type': route.service_type,
                    'source': 'auto_plan',
                },
            )
            if prod:
                dependencies.append({'from': f'production:{prod.id}:released', 'to': f'logistics:{log_job.id}:scheduled'})

        if route.delivery_method == Order.DELIVERY_INSTALLATION or _is_mobile_service(route.service_type):
            tracks_required.add('field_ops')
            operation_type = FieldOperationJob.TYPE_MOBILE_CAMPAIGN if _is_mobile_service(route.service_type) else FieldOperationJob.TYPE_INSTALLATION
            field_job = FieldOperationJob.objects.create(
                order=order,
                status=FieldOperationJob.STATUS_SCHEDULED,
                operation_type=operation_type,
                scheduled_start=route.estimated_date or route.required_date,
                scheduled_end=route.required_date,
                location_snapshot=order.delivery_address or {},
                metadata={
                    'line_id': str(line.id),
                    'service_type': route.service_type,
                    'source': 'auto_plan',
                },
            )
            if prod:
                dependencies.append({'from': f'production:{prod.id}:released', 'to': f'field_ops:{field_job.id}:in_progress'})

    order.service_snapshot = service_snapshot
    order.operation_plan = {
        'computed_at': timezone.now().isoformat(),
        'tracks_required': sorted(tracks_required),
        'dependencies': dependencies,
    }
    order.save(update_fields=['service_snapshot', 'operation_plan', 'updated_at'])
    sync_operational_rollup(order)


def sync_operational_rollup(order: Order) -> None:
    """Refresh aggregated operational status from jobs."""
    production_statuses = list(order.production_jobs.values_list('status', flat=True))
    logistics_statuses = list(order.logistics_jobs.values_list('status', flat=True))
    field_statuses = list(order.field_ops_jobs.values_list('status', flat=True))

    all_statuses = production_statuses + logistics_statuses + field_statuses
    if not all_statuses:
        rollup = Order.OP_ROLLUP_PLANNED
    elif any(status in {ProductionJob.STATUS_BLOCKED, FieldOperationJob.STATUS_PAUSED, FieldOperationJob.STATUS_REQUIRES_REVISIT, LogisticsJob.STATUS_DELIVERY_FAILED} for status in all_statuses):
        rollup = Order.OP_ROLLUP_ON_HOLD
    elif all(
        status in {
            ProductionJob.STATUS_RELEASED,
            ProductionJob.STATUS_CANCELLED,
            LogisticsJob.STATUS_DELIVERED,
            LogisticsJob.STATUS_CANCELLED,
            FieldOperationJob.STATUS_COMPLETED,
            FieldOperationJob.STATUS_CANCELLED,
        }
        for status in all_statuses
    ):
        rollup = Order.OP_ROLLUP_COMPLETED
    elif any(
        status in {
            ProductionJob.STATUS_PREPARING,
            ProductionJob.STATUS_IN_PRODUCTION,
            ProductionJob.STATUS_QUALITY_CHECK,
            LogisticsJob.STATUS_IN_TRANSIT,
            FieldOperationJob.STATUS_CREW_ASSIGNED,
            FieldOperationJob.STATUS_IN_PROGRESS,
        }
        for status in all_statuses
    ):
        rollup = Order.OP_ROLLUP_IN_EXECUTION
    else:
        rollup = Order.OP_ROLLUP_AWAITING_FINALIZATION

    if order.operational_rollup != rollup:
        order.operational_rollup = rollup
        order.save(update_fields=['operational_rollup', 'updated_at'])


def maybe_auto_ready_order_from_production(order: Order, *, changed_by=None, notes: str = '') -> bool:
    """
    Move order to READY when all production jobs are released or cancelled.
    Returns True if the order status was updated.
    """
    if order.status != Order.STATUS_IN_PRODUCTION:
        return False

    production_jobs = order.production_jobs.all()
    if not production_jobs.exists():
        return False

    terminal_statuses = {ProductionJob.STATUS_RELEASED, ProductionJob.STATUS_CANCELLED}
    if not all(job.status in terminal_statuses for job in production_jobs):
        return False

    auto_notes = notes or 'Auto: todos los trabajos de producción fueron liberados'
    order.transition_to(Order.STATUS_READY, changed_by=changed_by, notes=auto_notes)
    return True
