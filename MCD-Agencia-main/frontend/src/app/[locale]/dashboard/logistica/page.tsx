'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  TruckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingPage } from '@/components/ui';
import { TrackBoardCalendar, type TrackColumn, type TrackItem, type TrackStat } from '@/components/dashboard/TrackBoardCalendar';
import { getOperationsJobs, updateLogisticsJobStatus, type LogisticsJob } from '@/lib/api/admin';

const LOGISTICS_COLUMNS: TrackColumn[] = [
  { key: 'pending_dispatch', label: 'Por despachar', subtitle: 'Pendiente de salir de producción', statuses: ['pending_dispatch'], empty: 'Sin entregas pendientes', accent: 'border-gray-500/30' },
  { key: 'scheduled', label: 'Programadas', subtitle: 'Con ventana o cita definida', statuses: ['scheduled'], empty: 'Sin entregas programadas', accent: 'border-blue-500/30' },
  { key: 'in_transit', label: 'En tránsito', subtitle: 'En ruta o traslado', statuses: ['in_transit'], empty: 'Nada en tránsito', accent: 'border-purple-500/30' },
  { key: 'ready_for_pickup', label: 'Lista en sucursal', subtitle: 'Recogida disponible', statuses: ['ready_for_pickup'], empty: 'Sin entregas listas para recoger', accent: 'border-cmyk-cyan/30' },
  { key: 'delivered', label: 'Entregadas', subtitle: 'Cerradas o confirmadas', statuses: ['delivered'], empty: 'Nada entregado aún', accent: 'border-green-500/30' },
  { key: 'delivery_failed', label: 'Incidencias', subtitle: 'Requieren seguimiento', statuses: ['delivery_failed'], empty: 'Sin incidencias', accent: 'border-orange-500/30' },
];

const LOGISTICS_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending_dispatch: ['scheduled', 'cancelled'],
  scheduled: ['in_transit', 'ready_for_pickup', 'cancelled'],
  in_transit: ['delivered', 'delivery_failed', 'cancelled'],
  ready_for_pickup: ['delivered', 'cancelled'],
  delivered: [],
  delivery_failed: ['scheduled', 'cancelled'],
  cancelled: [],
};

const LOGISTICS_STATUS_BADGES: Record<string, { tone: string; icon: typeof ClockIcon }> = {
  pending_dispatch: { tone: 'bg-gray-500/20 text-gray-300 border-gray-500/30', icon: ClockIcon },
  scheduled: { tone: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: ClockIcon },
  in_transit: { tone: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: TruckIcon },
  ready_for_pickup: { tone: 'bg-cmyk-cyan/20 text-cmyk-cyan border-cmyk-cyan/30', icon: MapPinIcon },
  delivered: { tone: 'bg-green-500/20 text-green-300 border-green-500/30', icon: CheckCircleIcon },
  delivery_failed: { tone: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: ExclamationTriangleIcon },
  cancelled: { tone: 'bg-neutral-700 text-neutral-300 border-neutral-600', icon: ExclamationTriangleIcon },
};

export default function LogisticsDashboardPage() {
  const router = useRouter();
  const locale = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const permissions = usePermissions();

  const [jobs, setJobs] = useState<LogisticsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/logistica`);
      } else if (!permissions.canViewLogisticsPanel) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, permissions.canViewLogisticsPanel, router, locale]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const result = await getOperationsJobs({ job_type: 'logistics' });
      const raw = (result.results || []) as LogisticsJob[];
      setJobs(raw);
      setError(null);
    } catch (err) {
      console.error('Error fetching logistics jobs:', err);
      setError('No se pudieron cargar los trabajos de logística.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && permissions.canViewLogisticsPanel) {
      fetchJobs();
    }
  }, [isAuthenticated, permissions.canViewLogisticsPanel]);

  const items: TrackItem[] = useMemo(() => {
    return jobs.map((job) => {
      const customer = job.customer?.full_name || job.customer?.email || 'Cliente';
      const addressLabel = job.delivery_method === 'pickup'
        ? job.pickup_branch_detail?.name || 'Sucursal'
        : job.shipping_address
          ? `${job.shipping_address.street} ${job.shipping_address.exterior_number}`.trim()
          : 'Dirección de entrega';

      const noteParts: string[] = [];
      if (job.delivery_method_display) noteParts.push(job.delivery_method_display);
      if (job.tracking_number) noteParts.push(`Guía ${job.tracking_number}`);
      if (job.pickup_branch_detail) noteParts.push(job.pickup_branch_detail.full_address || job.pickup_branch_detail.name);
      if (job.shipping_address?.reference) noteParts.push(`Ref. ${job.shipping_address.reference}`);

      return {
        id: job.id,
        title: `#${job.order_number || job.order_id || 'N/A'}`,
        subtitle: `${customer} · ${addressLabel}`,
        status: job.status,
        status_display: job.status_display || job.status,
        date: job.scheduled_date || job.window_end || job.window_start || job.delivered_at || null,
        date_label: job.scheduled_date ? 'Fecha programada' : job.window_end ? 'Ventana final' : job.window_start ? 'Ventana inicio' : 'Entrega',
        note: noteParts.filter(Boolean).join(' · ') || undefined,
        href: `/${locale}/dashboard/pedidos/${job.order_id}`,
      };
    });
  }, [jobs, locale]);

  const stats: TrackStat[] = [
    { label: 'Por despachar', count: jobs.filter((job) => job.status === 'pending_dispatch').length, tone: 'bg-gray-500/20 text-gray-300', icon: ClockIcon },
    { label: 'Programadas', count: jobs.filter((job) => job.status === 'scheduled').length, tone: 'bg-blue-500/20 text-blue-300', icon: ClockIcon },
    { label: 'En tránsito', count: jobs.filter((job) => job.status === 'in_transit').length, tone: 'bg-purple-500/20 text-purple-300', icon: TruckIcon },
    { label: 'Listas / entregadas', count: jobs.filter((job) => ['ready_for_pickup', 'delivered'].includes(job.status)).length, tone: 'bg-green-500/20 text-green-300', icon: CheckCircleIcon },
  ];

  const handleStatusUpdate = async (job: LogisticsJob, newStatus: string) => {
    try {
      setUpdating(job.id);
      await updateLogisticsJobStatus(job.order_id, job.id, newStatus);
      await fetchJobs();
    } catch (err) {
      console.error('Error updating logistics job status:', err);
      setError('No se pudo actualizar el estado del trabajo.');
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading || loading) {
    return <LoadingPage message="Cargando logística..." />;
  }

  if (!isAuthenticated || !permissions.canViewLogisticsPanel) {
    return null;
  }

  return (
    <TrackBoardCalendar
      title="Centro de Logística"
      description="Tablón y calendario para salidas, entregas a sucursal, envíos a domicilio e instalaciones ya liberadas desde producción."
      stats={stats}
      columns={LOGISTICS_COLUMNS}
      items={items}
      loading={loading}
      error={error}
      renderItemActions={(item) => {
        const job = jobs.find((entry) => entry.id === item.id);
        if (!job) return null;

        const nextStates = LOGISTICS_STATUS_TRANSITIONS[job.status] || [];
        const badge = LOGISTICS_STATUS_BADGES[job.status] || LOGISTICS_STATUS_BADGES.pending_dispatch;
        const StatusIcon = badge.icon;

        return (
          <div className="flex flex-col gap-2">
            <div className={`inline-flex items-center gap-1.5 self-start rounded-full border px-2 py-1 text-[11px] ${badge.tone}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              <span>{job.status_display || job.status}</span>
            </div>
            {nextStates.length > 0 ? (
              <select
                value=""
                disabled={updating === job.id}
                onChange={(event) => handleStatusUpdate(job, event.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 disabled:opacity-50"
              >
                <option value="">Cambiar estado...</option>
                {nextStates.map((status) => (
                  <option key={status} value={status}>
                    → {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-neutral-500">Sin transiciones disponibles</p>
            )}
          </div>
        );
      }}
    />
  );
}
