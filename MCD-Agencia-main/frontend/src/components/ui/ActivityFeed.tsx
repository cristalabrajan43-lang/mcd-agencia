'use client';

import {
  ClipboardDocumentListIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilSquareIcon,
  ShoppingCartIcon,
  EyeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface ActivityItem {
  id: string;
  action: string;
  action_display: string;
  entity_type: string;
  entity_id: string;
  description: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  created: ClipboardDocumentListIcon,
  state_changed: ArrowPathIcon,
  updated: PencilSquareIcon,
  viewed: EyeIcon,
  deleted: XCircleIcon,
};

const actionColors: Record<string, string> = {
  created: 'text-cmyk-cyan bg-cmyk-cyan/10',
  state_changed: 'text-purple-400 bg-purple-400/10',
  updated: 'text-yellow-400 bg-yellow-400/10',
  viewed: 'text-blue-400 bg-blue-400/10',
  deleted: 'text-red-400 bg-red-400/10',
};

const entityLabels: Record<string, string> = {
  Quote: 'Cotización',
  QuoteRequest: 'Solicitud',
  Order: 'Pedido',
};

export default function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days}d`;
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cmyk-cyan" />
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        <ClipboardDocumentListIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Sin actividad reciente</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity) => {
        const Icon = actionIcons[activity.action] || ArrowPathIcon;
        const colorClass = actionColors[activity.action] || 'text-neutral-400 bg-neutral-400/10';

        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-800/50 transition-colors"
          >
            <div className={`p-1.5 rounded-lg flex-shrink-0 ${colorClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{activity.description}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-neutral-500">{activity.actor}</span>
                <span className="text-xs text-neutral-600">•</span>
                <span className="text-xs text-neutral-500">{formatTime(activity.timestamp)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
