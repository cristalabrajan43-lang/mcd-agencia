'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  FolderOpenIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button, LoadingPage } from '@/components/ui';
import { TrackBoardCalendar, type TrackColumn, type TrackItem, type TrackStat } from '@/components/dashboard/TrackBoardCalendar';
import { getProductionJobs, updateProductionJobStatus, type ProductionJob } from '@/lib/api/admin';
import { PRODUCTION_STATUS_LABELS } from '@/lib/production-status';

const PRODUCTION_COLUMNS: TrackColumn[] = [
  { key: 'queued', label: 'En cola', subtitle: 'Pendientes de arrancar', statuses: ['queued'], empty: 'Sin trabajos en cola', accent: 'border-gray-500/30' },
  { key: 'preparing', label: 'Preparando', subtitle: 'Preproducción / configuración', statuses: ['preparing'], empty: 'Nada en preparación', accent: 'border-blue-500/30' },
  { key: 'in_production', label: 'En proceso', subtitle: 'Producción activa', statuses: ['in_production'], empty: 'Nada en proceso', accent: 'border-purple-500/30' },
  { key: 'quality_check', label: 'Control de calidad', subtitle: 'Verificación final', statuses: ['quality_check'], empty: 'Sin revisiones pendientes', accent: 'border-amber-500/30' },
  { key: 'blocked', label: 'Bloqueado', subtitle: 'Requiere atención', statuses: ['blocked'], empty: 'Sin bloqueos', accent: 'border-red-500/30' },
  { key: 'released', label: 'Listo para entrega', subtitle: 'Liberado hacia logística', statuses: ['released'], empty: 'Nada listo aún', accent: 'border-cmyk-cyan/30' },
];

const PRODUCTION_STATUS_TRANSITIONS: Record<string, string[]> = {
  queued: ['preparing', 'blocked', 'cancelled'],
  preparing: ['in_production', 'blocked', 'cancelled'],
  in_production: ['quality_check', 'blocked', 'cancelled'],
  quality_check: ['released', 'blocked', 'cancelled'],
  released: [],
  blocked: ['preparing', 'in_production', 'cancelled'],
  cancelled: [],
};

const PRODUCTION_STATUS_BADGES: Record<string, { tone: string; icon: typeof ClockIcon }> = {
  queued: { tone: 'bg-gray-500/20 text-gray-300 border-gray-500/30', icon: ClockIcon },
  preparing: { tone: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: FolderOpenIcon },
  in_production: { tone: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: ArrowPathIcon },
  quality_check: { tone: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: ClipboardDocumentCheckIcon },
  released: { tone: 'bg-green-500/20 text-green-300 border-green-500/30', icon: CheckCircleIcon },
  blocked: { tone: 'bg-red-500/20 text-red-300 border-red-500/30', icon: ExclamationTriangleIcon },
  cancelled: { tone: 'bg-neutral-700 text-neutral-300 border-neutral-600', icon: ExclamationTriangleIcon },
};

export default function ProductionDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const orderIdFilter = searchParams.get('order_id');
  const orderNumberFilter = searchParams.get('order_number');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const permissions = usePermissions();

  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/produccion`);
      } else if (!permissions.canViewProductionPanel) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, permissions.canViewProductionPanel, router, locale]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const result = await getProductionJobs();
      setJobs(result.results || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching production jobs:', err);
      setError('No se pudieron cargar los trabajos de producción.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && permissions.canViewProductionPanel) {
      fetchJobs();
    }
  }, [isAuthenticated, permissions.canViewProductionPanel]);

  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (orderIdFilter) {
      list = list.filter((job) => job.order_id === orderIdFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((job) => job.status === statusFilter);
    }
    return list;
  }, [jobs, orderIdFilter, statusFilter]);

  const items: TrackItem[] = useMemo(() => {
    return filteredJobs.map((job) => {
      const customer = job.customer?.full_name || job.customer?.email || 'Cliente';
      const productBits = [job.product_name, job.variant_name].filter(Boolean);
      const qtyLabel = job.quantity ? ` · ${job.quantity} uds.` : '';

      return {
        id: job.id,
        title: `#${job.order_number || job.order_id || 'N/A'}`,
        subtitle: `${productBits.join(' · ') || 'Trabajo de producción'}${qtyLabel} · ${customer}`,
        status: job.status,
        status_display: job.status_display || PRODUCTION_STATUS_LABELS[job.status] || job.status,
        date: job.estimated_delivery_date || job.planned_end || job.planned_start || null,
        date_label: job.estimated_delivery_date ? 'Entrega estimada' : job.planned_end ? 'Fin programado' : 'Inicio programado',
        note: job.delivery_method ? `Entrega: ${job.delivery_method}` : undefined,
        href: `/${locale}/dashboard/pedidos/${job.order_id}`,
      };
    });
  }, [filteredJobs, locale]);

  const stats: TrackStat[] = [
    { label: 'En cola', count: filteredJobs.filter((job) => job.status === 'queued').length, tone: 'bg-gray-500/20 text-gray-300', icon: ClockIcon },
    { label: 'En proceso', count: filteredJobs.filter((job) => job.status === 'in_production').length, tone: 'bg-purple-500/20 text-purple-300', icon: ArrowPathIcon },
    { label: 'Bloqueados', count: filteredJobs.filter((job) => job.status === 'blocked').length, tone: 'bg-red-500/20 text-red-300', icon: ExclamationTriangleIcon },
    { label: 'Listos', count: filteredJobs.filter((job) => job.status === 'released').length, tone: 'bg-green-500/20 text-green-300', icon: CheckCircleIcon },
  ];

  const handleStatusUpdate = async (job: ProductionJob, newStatus: string) => {
    if (!newStatus) return;
    try {
      setUpdating(job.id);
      await updateProductionJobStatus(job.order_id, job.id, newStatus);
      await fetchJobs();
    } catch (err) {
      console.error('Error updating production job status:', err);
      setError('No se pudo actualizar el estado del trabajo.');
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading || loading) {
    return <LoadingPage message="Cargando producción..." />;
  }

  if (!isAuthenticated || !permissions.canViewProductionPanel) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
          >
            <option value="all">Todos los estados</option>
            {Object.entries(PRODUCTION_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={fetchJobs} disabled={loading}>
            <ArrowPathIcon className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
        <p className="text-sm text-neutral-400">
          {filteredJobs.length} trabajo{filteredJobs.length === 1 ? '' : 's'} · El inventario se descuenta al enviar, no al crear el pedido
        </p>
      </div>

      {orderIdFilter && (
        <div className="flex flex-col gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-purple-100">
            Mostrando trabajos del pedido #{orderNumberFilter || filteredJobs[0]?.order_number || orderIdFilter}
            {filteredJobs.length === 0 ? ' (sin trabajos de producción)' : ` (${filteredJobs.length})`}
          </p>
          <Link
            href={`/${locale}/dashboard/produccion`}
            className="inline-flex items-center justify-center rounded-lg border border-purple-500/40 px-3 py-1.5 text-xs font-medium text-purple-200 hover:bg-purple-500/20"
          >
            Ver todos los trabajos
          </Link>
        </div>
      )}

      <TrackBoardCalendar
        title="Centro de Producción"
        description="Tablón de trabajos de taller. Cada pedido genera trabajos aquí al confirmarse. Avanza el estado hasta liberar a logística."
        stats={stats}
        columns={PRODUCTION_COLUMNS}
        items={items}
        loading={loading}
        error={error}
        renderItemActions={(item) => {
          const job = filteredJobs.find((entry) => entry.id === item.id);
          if (!job) return null;

          const nextStates = PRODUCTION_STATUS_TRANSITIONS[job.status] || [];
          const badge = PRODUCTION_STATUS_BADGES[job.status] || PRODUCTION_STATUS_BADGES.queued;
          const StatusIcon = badge.icon;

          return (
            <div className="flex flex-col gap-2">
              <div className={`inline-flex items-center gap-1.5 self-start rounded-full border px-2 py-1 text-[11px] ${badge.tone}`}>
                <StatusIcon className="h-3.5 w-3.5" />
                <span>{PRODUCTION_STATUS_LABELS[job.status] || job.status_display || job.status}</span>
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
                      → {PRODUCTION_STATUS_LABELS[status] || status.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-neutral-500">Sin transiciones disponibles</p>
              )}
              <Link
                href={`/${locale}/dashboard/pedidos/${job.order_id}`}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Ver pedido →
              </Link>
            </div>
          );
        }}
      />
    </div>
  );
}
