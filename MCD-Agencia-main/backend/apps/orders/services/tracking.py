from __future__ import annotations

from django.utils import timezone

from apps.orders.models import (
    FieldOperationJob,
    LogisticsJob,
    Order,
    OrderStatusHistory,
    OrderTrackingEvent,
    ProductionJob,
)

ORDER_STATUS_LABELS = {
    Order.STATUS_DRAFT: 'Pedido creado',
    Order.STATUS_PENDING_PAYMENT: 'Esperando confirmación de pago',
    Order.STATUS_PAID: 'Pago confirmado',
    Order.STATUS_PARTIALLY_PAID: 'Pago parcial recibido',
    Order.STATUS_IN_PRODUCTION: 'En producción',
    Order.STATUS_READY: 'Pedido listo',
    Order.STATUS_IN_DELIVERY: 'En camino',
    Order.STATUS_COMPLETED: 'Entregado',
    Order.STATUS_CANCELLED: 'Pedido cancelado',
    Order.STATUS_REFUNDED: 'Reembolso procesado',
}

PRODUCTION_STATUS_LABELS = {
    ProductionJob.STATUS_QUEUED: 'Pedido en cola de producción',
    ProductionJob.STATUS_PREPARING: 'Preparando materiales',
    ProductionJob.STATUS_IN_PRODUCTION: 'Fabricación en curso',
    ProductionJob.STATUS_QUALITY_CHECK: 'Control de calidad',
    ProductionJob.STATUS_RELEASED: 'Producción finalizada',
    ProductionJob.STATUS_BLOCKED: 'Producción en pausa',
    ProductionJob.STATUS_CANCELLED: 'Producción cancelada',
}

LOGISTICS_STATUS_LABELS = {
    LogisticsJob.STATUS_PENDING_DISPATCH: 'Preparando envío',
    LogisticsJob.STATUS_SCHEDULED: 'Envío programado',
    LogisticsJob.STATUS_IN_TRANSIT: 'Paquete en camino',
    LogisticsJob.STATUS_READY_FOR_PICKUP: 'Listo para recoger en sucursal',
    LogisticsJob.STATUS_DELIVERED: 'Entregado',
    LogisticsJob.STATUS_DELIVERY_FAILED: 'Intento de entrega fallido',
    LogisticsJob.STATUS_CANCELLED: 'Envío cancelado',
}

FIELD_OPS_STATUS_LABELS = {
    FieldOperationJob.STATUS_SCHEDULED: 'Instalación programada',
    FieldOperationJob.STATUS_CREW_ASSIGNED: 'Equipo asignado',
    FieldOperationJob.STATUS_IN_PROGRESS: 'Instalación en curso',
    FieldOperationJob.STATUS_PAUSED: 'Instalación en pausa',
    FieldOperationJob.STATUS_COMPLETED: 'Instalación completada',
    FieldOperationJob.STATUS_REQUIRES_REVISIT: 'Requiere nueva visita',
    FieldOperationJob.STATUS_CANCELLED: 'Instalación cancelada',
}

PENDING_STEPS_SHIPPING = [
    ('pending_payment', 'Esperando confirmación de pago'),
    ('paid', 'Pago confirmado'),
    ('in_production', 'En producción'),
    ('ready', 'Pedido listo'),
    ('in_delivery', 'En camino'),
    ('completed', 'Entregado'),
]

PENDING_STEPS_PICKUP = [
    ('pending_payment', 'Esperando confirmación de pago'),
    ('paid', 'Pago confirmado'),
    ('in_production', 'En producción'),
    ('ready', 'Listo para recoger'),
    ('completed', 'Entregado'),
]

STATUS_ORDER = [
    Order.STATUS_DRAFT,
    Order.STATUS_PENDING_PAYMENT,
    Order.STATUS_PAID,
    Order.STATUS_PARTIALLY_PAID,
    Order.STATUS_IN_PRODUCTION,
    Order.STATUS_READY,
    Order.STATUS_IN_DELIVERY,
    Order.STATUS_COMPLETED,
]


def _pickup_ready_label(order: Order) -> str:
    if order.delivery_method == Order.DELIVERY_PICKUP:
        return 'Listo para recoger'
    return 'Pedido listo'


def record_tracking_event(
    *,
    order: Order,
    event_type: str,
    title: str,
    description: str = '',
    occurred_at=None,
    created_by=None,
    source_key: str = '',
    metadata: dict | None = None,
    visible_to_customer: bool = True,
) -> OrderTrackingEvent:
    """Create or update a deduplicated tracking event."""
    occurred_at = occurred_at or timezone.now()
    defaults = {
        'event_type': event_type,
        'title': title,
        'description': description or '',
        'occurred_at': occurred_at,
        'created_by': created_by,
        'metadata': metadata or {},
        'visible_to_customer': visible_to_customer,
    }

    if source_key:
        event, _ = OrderTrackingEvent.objects.update_or_create(
            order=order,
            source_key=source_key,
            defaults=defaults,
        )
        return event

    return OrderTrackingEvent.objects.create(
        order=order,
        source_key='',
        **defaults,
    )


def record_status_tracking_event(history: OrderStatusHistory) -> OrderTrackingEvent | None:
    if not history.to_status:
        return None

    title = ORDER_STATUS_LABELS.get(history.to_status, history.to_status)
    if history.to_status == Order.STATUS_READY:
        title = _pickup_ready_label(history.order)

    description = (history.notes or '').strip()
    if description.lower() in {'order created', ''}:
        description = ''

    return record_tracking_event(
        order=history.order,
        event_type=OrderTrackingEvent.EVENT_STATUS,
        title=title,
        description=description,
        occurred_at=history.created_at,
        created_by=history.changed_by,
        source_key=f'status:{history.id}',
        metadata={
            'from_status': history.from_status,
            'to_status': history.to_status,
        },
    )


def record_job_tracking_event(
    *,
    order: Order,
    track_type: str,
    job_id,
    new_status: str,
    notes: str = '',
    created_by=None,
) -> OrderTrackingEvent | None:
    label_maps = {
        'production': PRODUCTION_STATUS_LABELS,
        'logistics': LOGISTICS_STATUS_LABELS,
        'field_ops': FIELD_OPS_STATUS_LABELS,
    }
    event_types = {
        'production': OrderTrackingEvent.EVENT_PRODUCTION,
        'logistics': OrderTrackingEvent.EVENT_LOGISTICS,
        'field_ops': OrderTrackingEvent.EVENT_FIELD_OPS,
    }

    labels = label_maps.get(track_type, {})
    title = labels.get(new_status)
    if not title:
        return None

    if track_type == 'logistics' and new_status == LogisticsJob.STATUS_READY_FOR_PICKUP:
        if order.delivery_method != Order.DELIVERY_PICKUP:
            title = 'Disponible para despacho'

    return record_tracking_event(
        order=order,
        event_type=event_types[track_type],
        title=title,
        description=(notes or '').strip(),
        created_by=created_by,
        source_key=f'{track_type}:{job_id}:{new_status}',
        metadata={
            'track_type': track_type,
            'job_id': str(job_id),
            'status': new_status,
        },
    )


def record_tracking_number_event(
    *,
    order: Order,
    tracking_number: str,
    tracking_url: str = '',
    created_by=None,
    message: str = '',
) -> OrderTrackingEvent:
    description_parts = []
    if message:
        description_parts.append(message.strip())
    description_parts.append(f'Número de guía: {tracking_number}')
    if tracking_url:
        description_parts.append('Puedes rastrear tu envío con el enlace de seguimiento.')

    return record_tracking_event(
        order=order,
        event_type=OrderTrackingEvent.EVENT_TRACKING,
        title='Guía de envío registrada',
        description='\n'.join(part for part in description_parts if part),
        created_by=created_by,
        source_key=f'tracking:{tracking_number}',
        metadata={
            'tracking_number': tracking_number,
            'tracking_url': tracking_url,
        },
    )


def backfill_tracking_events_from_history(order: Order) -> None:
    """Populate tracking events for legacy orders without events."""
    if order.tracking_events.exists():
        return

    for history in order.status_history.order_by('created_at'):
        record_status_tracking_event(history)

    if order.tracking_number:
        record_tracking_number_event(
            order=order,
            tracking_number=order.tracking_number,
            tracking_url=order.tracking_url or '',
        )


def maybe_sync_order_status_from_logistics(
    order: Order,
    job: LogisticsJob,
    *,
    changed_by=None,
    notes: str = '',
) -> bool:
    """Align order FSM with logistics job milestones."""
    updated = False
    note = notes or f'Auto: logística → {job.get_status_display()}'

    if job.status == LogisticsJob.STATUS_IN_TRANSIT:
        if order.can_transition_to(Order.STATUS_IN_DELIVERY):
            order.transition_to(Order.STATUS_IN_DELIVERY, changed_by=changed_by, notes=note)
            updated = True
    elif job.status == LogisticsJob.STATUS_READY_FOR_PICKUP:
        if order.can_transition_to(Order.STATUS_READY):
            order.transition_to(Order.STATUS_READY, changed_by=changed_by, notes=note)
            updated = True
    elif job.status == LogisticsJob.STATUS_DELIVERED:
        if order.can_transition_to(Order.STATUS_COMPLETED):
            order.transition_to(Order.STATUS_COMPLETED, changed_by=changed_by, notes=note)
            updated = True

    return updated


def _event_payload(event: OrderTrackingEvent, *, phase: str) -> dict:
    return {
        'id': str(event.id),
        'event_type': event.event_type,
        'title': event.title,
        'description': event.description,
        'occurred_at': event.occurred_at.isoformat() if event.occurred_at else None,
        'phase': phase,
        'metadata': event.metadata or {},
    }


def _pending_payload(step_key: str, title: str) -> dict:
    return {
        'id': f'pending:{step_key}',
        'event_type': 'pending',
        'title': title,
        'description': '',
        'occurred_at': None,
        'phase': 'pending',
        'metadata': {'step_key': step_key},
    }


def _resolve_effective_status(order: Order) -> str:
    if order.status == Order.STATUS_PARTIALLY_PAID:
        return Order.STATUS_PAID
    return order.status


def _dedupe_events(events: list[OrderTrackingEvent]) -> list[OrderTrackingEvent]:
    """Collapse duplicate automated events (legacy double status history)."""
    deduped: list[OrderTrackingEvent] = []
    index_by_key: dict[tuple, int] = {}

    for event in events:
        metadata = event.metadata or {}
        key = (
            event.event_type,
            metadata.get('to_status') or metadata.get('status') or '',
            event.title,
        )
        if key in index_by_key:
            existing = deduped[index_by_key[key]]
            if len(event.description) > len(existing.description):
                deduped[index_by_key[key]] = event
            elif event.occurred_at and existing.occurred_at and event.occurred_at > existing.occurred_at:
                deduped[index_by_key[key]] = event
            continue

        index_by_key[key] = len(deduped)
        deduped.append(event)

    return deduped


def build_order_tracking_timeline(order: Order) -> dict:
    """Build customer-facing tracking timeline with completed, current and pending steps."""
    backfill_tracking_events_from_history(order)

    events = list(
        order.tracking_events.filter(visible_to_customer=True).order_by('occurred_at', 'created_at')
    )
    events = _dedupe_events(events)

    effective_status = _resolve_effective_status(order)
    is_terminal = effective_status in {Order.STATUS_CANCELLED, Order.STATUS_REFUNDED}

    completed_events = [_event_payload(event, phase='completed') for event in events]

    pending_steps = []
    if not is_terminal and effective_status not in {Order.STATUS_COMPLETED}:
        template = PENDING_STEPS_PICKUP if order.delivery_method == Order.DELIVERY_PICKUP else PENDING_STEPS_SHIPPING
        try:
            current_index = next(
                index for index, (key, _) in enumerate(template) if key == effective_status
            )
        except StopIteration:
            if effective_status == Order.STATUS_PARTIALLY_PAID:
                current_index = 1
            else:
                current_index = len(template) - 1

        for key, label in template[current_index + 1:]:
            pending_steps.append(_pending_payload(key, label))

    current_title = ORDER_STATUS_LABELS.get(effective_status, effective_status)
    if effective_status == Order.STATUS_READY:
        current_title = _pickup_ready_label(order)

    return {
        'order_id': str(order.id),
        'order_number': order.order_number,
        'current_status': order.status,
        'current_status_label': current_title,
        'delivery_method': order.delivery_method,
        'tracking_number': order.tracking_number or '',
        'tracking_url': order.tracking_url or '',
        'events': completed_events,
        'pending_steps': pending_steps,
        'is_terminal': is_terminal,
    }
