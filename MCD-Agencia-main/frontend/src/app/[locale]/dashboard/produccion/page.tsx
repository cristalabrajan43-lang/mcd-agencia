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
} from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button, LoadingPage } from '@/components/ui';
import { TrackBoardCalendar, type TrackColumn, type TrackItem, type TrackStat } from '@/components/dashboard/TrackBoardCalendar';
import { getProductionJobs, updateProductionJobStatus, type ProductionJob } from '@/lib/api/admin';
import { PRODUCTION_STATUS_LABELS } from '@/lib/production-status';

const PRODUCTION_COLUMNS: TrackColumn[] = [
  { key: 'queued', label: 'En cola', statuses: ['queued'], empty: 'Vacío', accent: 'border-gray-500/30' },
  { key: 'preparing', label: 'Preparando', statuses: ['preparing'], empty: 'Vacío', accent: 'border-blue-500/30' },
  { key: 'in_production', label: 'En proceso', statuses: ['in_production'], empty: 'Vacío', accent: 'border-purple-500/30' },
  { key: 'quality_check', label: 'Calidad', statuses: ['quality_check'], empty: 'Vacío', accent: 'border-amber-500/30' },
  { key: 'blocked', label: 'Bloqueado', statuses: ['blocked'], empty: 'Vacío', accent: 'border-red-500/30' },
  { key: 'released', label: 'Listo', statuses: ['released'], empty: 'Vacío', accent: 'border-cmyk-cyan/30' },
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
      const productBits = [job.product_name, job.variant_name].filter(Boolean);
      const qtyLabel = job.quantity ? `${job.quantity} uds.` : '';

      return {
        id: job.id,
        title: `#${job.order_number || job.order_id || 'N/A'}`,
        subtitle: [productBits.join(' · '), qtyLabel].filter(Boolean).join(' · ') || 'Trabajo de producción',
        status: job.status,
        status_display: job.status_display || PRODUCTION_STATUS_LABELS[job.status] || job.status,
        date: job.estimated_delivery_date || job.planned_end || job.planned_start || null,
        date_label: job.estimated_delivery_date ? 'Entrega' : job.planned_end ? 'Fin' : 'Inicio',
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
    <div className="space-y-3">
      {orderIdFilter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2">
          <p className="text-xs text-purple-100">
            Pedido #{orderNumberFilter || filteredJobs[0]?.order_number || orderIdFilter}
            {filteredJobs.length > 0 ? ` · ${filteredJobs.length} trabajo(s)` : ' · sin trabajos'}
          </p>
          <Link
            href={`/${locale}/dashboard/produccion`}
            className="text-xs font-medium text-purple-200 hover:text-white"
          >
            Ver todos
          </Link>
        </div>
      )}

      <TrackBoardCalendar
        title="Centro de Producción"
        description="Desliza horizontalmente entre columnas. El stock se descuenta al enviar."
        stats={stats}
        columns={PRODUCTION_COLUMNS}
        items={items}
        loading={loading}
        error={error}
        boardLayout="kanban"
        compact
        showCalendar={false}
        toolbar={
          <>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200"
            >
              <option value="all">Todos</option>
              {Object.entries(PRODUCTION_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <Button variant="secondary" size="xs" onClick={fetchJobs} disabled={loading}>
              <ArrowPathIcon className="h-3.5 w-3.5" />
            </Button>
          </>
        }
        renderItemActions={(item) => {
          const job = filteredJobs.find((entry) => entry.id === item.id);
          if (!job) return null;

          const nextStates = PRODUCTION_STATUS_TRANSITIONS[job.status] || [];

          return (
            <div className="flex items-center gap-1.5">
              {nextStates.length > 0 ? (
                <select
                  value=""
                  disabled={updating === job.id}
                  onChange={(event) => handleStatusUpdate(job, event.target.value)}
                  className="flex-1 min-w-0 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-200 disabled:opacity-50"
                >
                  <option value="">Estado…</option>
                  {nextStates.map((status) => (
                    <option key={status} value={status}>
                      {PRODUCTION_STATUS_LABELS[status] || status}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] text-neutral-500">Finalizado</span>
              )}
              <Link
                href={`/${locale}/dashboard/pedidos/${job.order_id}`}
                className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-[10px] text-cyan-400 hover:bg-neutral-800"
                title="Ver pedido"
              >
                Pedido
              </Link>
            </div>
          );
        }}
      />
    </div>
  );
}
