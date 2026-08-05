'use client';

import {
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  CubeIcon,
  MapPinIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { cn, formatDateTime } from '@/lib/utils';
import type { OrderTrackingEvent, OrderTrackingTimeline } from '@/lib/api/tracking';
import { Button } from '@/components/ui';

const EVENT_ICONS: Record<string, typeof CheckCircleIcon> = {
  status_change: CheckCircleIcon,
  production: ArrowPathIcon,
  logistics: TruckIcon,
  field_ops: MapPinIcon,
  tracking: TruckIcon,
  custom: CubeIcon,
  pending: ClockIcon,
};

interface OrderTrackingTimelineProps {
  tracking: OrderTrackingTimeline;
  className?: string;
}

function TimelineNode({
  phase,
  eventType,
}: {
  phase: OrderTrackingEvent['phase'];
  eventType: string;
}) {
  const Icon = EVENT_ICONS[eventType] || CheckCircleIcon;
  const isCompleted = phase === 'completed';
  const isCurrent = phase === 'current';
  const isPending = phase === 'pending';

  return (
    <div
      className={cn(
        'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2',
        isCompleted && 'border-cmyk-cyan bg-cmyk-cyan text-neutral-950',
        isCurrent && 'border-cmyk-cyan bg-cmyk-cyan/15 text-cmyk-cyan ring-4 ring-cmyk-cyan/20',
        isPending && 'border-neutral-600 bg-neutral-900 text-neutral-500'
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

function TimelineRow({
  event,
  isLast,
}: {
  event: OrderTrackingEvent;
  isLast: boolean;
}) {
  const isPending = event.phase === 'pending';

  return (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      {!isLast && (
        <div
          className={cn(
            'absolute left-[17px] top-9 bottom-0 w-px',
            isPending ? 'bg-neutral-800' : 'bg-cmyk-cyan/40'
          )}
        />
      )}
      <TimelineNode phase={event.phase} eventType={event.event_type} />
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p
            className={cn(
              'font-medium',
              isPending ? 'text-neutral-500' : 'text-white'
            )}
          >
            {event.title}
          </p>
          {event.occurred_at && (
            <span className="text-xs text-neutral-500">
              {formatDateTime(event.occurred_at)}
            </span>
          )}
        </div>
        {event.description && (
          <p className="mt-1 text-sm text-neutral-400 whitespace-pre-line">
            {event.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function OrderTrackingTimelineView({
  tracking,
  className,
}: OrderTrackingTimelineProps) {
  const completed = tracking.events.map((event) => ({
    ...event,
    phase: 'completed' as const,
  }));

  const allEvents: OrderTrackingEvent[] = [...completed];

  if (!tracking.is_terminal && tracking.pending_steps.length > 0) {
    const currentIndex = completed.length - 1;
    if (currentIndex >= 0) {
      allEvents[currentIndex] = {
        ...allEvents[currentIndex],
        phase: 'current',
      };
    }
    allEvents.push(
      ...tracking.pending_steps.map((step) => ({
        ...step,
        phase: 'pending' as const,
      }))
    );
  } else if (completed.length > 0 && !tracking.is_terminal) {
    allEvents[completed.length - 1] = {
      ...allEvents[completed.length - 1],
      phase: 'current',
    };
  }

  return (
    <div className={className}>
      {(tracking.tracking_number || tracking.tracking_url) && (
        <div className="mb-6 rounded-xl border border-cmyk-cyan/20 bg-cmyk-cyan/5 p-4">
          <p className="text-sm text-neutral-400">Número de guía</p>
          <p className="mt-1 font-mono text-lg text-white">{tracking.tracking_number}</p>
          {tracking.tracking_url && (
            <a
              href={tracking.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3"
            >
              <Button variant="outline" size="sm">
                Rastrear envío en transportista
              </Button>
            </a>
          )}
        </div>
      )}

      {allEvents.length === 0 ? (
        <p className="text-neutral-500 text-sm">
          El seguimiento se actualizará cuando el pedido avance.
        </p>
      ) : (
        <div className="relative">
          {allEvents.map((event, index) => (
            <TimelineRow
              key={event.id}
              event={event}
              isLast={index === allEvents.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
