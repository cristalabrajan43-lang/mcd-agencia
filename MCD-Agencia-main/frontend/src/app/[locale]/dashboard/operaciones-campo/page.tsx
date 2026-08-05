'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

import { Card, LoadingPage } from '@/components/ui';
import { getOperationsJobs, updateLogisticsJobStatus, updateFieldOperationJobStatus, type LogisticsJob, type FieldOperationJob } from '@/lib/api/admin';

type OperationJob = LogisticsJob | FieldOperationJob;

const statusColors: Record<string, { bg: string; text: string; deliveryIcon?: React.ComponentType<{ className?: string }>; fieldIcon?: React.ComponentType<{ className?: string }> }> = {
  // Logistics statuses
  pending_dispatch: { bg: 'bg-gray-500/10', text: 'text-gray-300', deliveryIcon: ClockIcon },
  scheduled: { bg: 'bg-blue-500/10', text: 'text-blue-300', deliveryIcon: ClockIcon },
  in_transit: { bg: 'bg-purple-500/10', text: 'text-purple-300', deliveryIcon: TruckIcon },
  ready_for_pickup: { bg: 'bg-indigo-500/10', text: 'text-indigo-300', deliveryIcon: MapPinIcon },
  delivered: { bg: 'bg-green-500/10', text: 'text-green-300', deliveryIcon: CheckCircleIcon },
  delivery_failed: { bg: 'bg-red-500/10', text: 'text-red-300', deliveryIcon: ExclamationTriangleIcon },
  // Field ops statuses
  scheduled_field: { bg: 'bg-blue-500/10', text: 'text-blue-300', fieldIcon: ClockIcon },
  crew_assigned: { bg: 'bg-cyan-500/10', text: 'text-cyan-300', fieldIcon: MapPinIcon },
  in_progress: { bg: 'bg-purple-500/10', text: 'text-purple-300', fieldIcon: ArrowPathIcon },
  completed: { bg: 'bg-green-500/10', text: 'text-green-300', fieldIcon: CheckCircleIcon },
  paused: { bg: 'bg-yellow-500/10', text: 'text-yellow-300', fieldIcon: ClockIcon },
  requires_revisit: { bg: 'bg-orange-500/10', text: 'text-orange-300', fieldIcon: ExclamationTriangleIcon },
  cancelled: { bg: 'bg-neutral-700', text: 'text-neutral-300', fieldIcon: ExclamationTriangleIcon },
};

const LOGISTICS_TRANSITIONS: Record<string, string[]> = {
  pending_dispatch: ['scheduled', 'cancelled'],
  scheduled: ['in_transit', 'ready_for_pickup', 'cancelled'],
  in_transit: ['delivered', 'delivery_failed', 'cancelled'],
  ready_for_pickup: ['delivered', 'cancelled'],
  delivered: [],
  delivery_failed: ['scheduled', 'cancelled'],
  cancelled: [],
};

const FIELD_OPS_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['crew_assigned', 'cancelled'],
  crew_assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'paused', 'requires_revisit', 'cancelled'],
  completed: [],
  paused: ['in_progress', 'requires_revisit', 'cancelled'],
  requires_revisit: ['in_progress', 'cancelled'],
  cancelled: [],
};

const isLogisticsJob = (job: OperationJob): job is LogisticsJob => {
  return 'delivery_method' in job;
};

export default function OperationsFieldDashboard() {
  const locale = useLocale();
  const [jobs, setJobs] = useState<OperationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [jobTypeFilter, setJobTypeFilter] = useState<'all' | 'logistics' | 'field_ops'>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const result = await getOperationsJobs({
        job_type: jobTypeFilter === 'all' ? undefined : jobTypeFilter,
      });
      setJobs(result.results || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching operations jobs:', err);
      setError('Error al cargar los jobs de operaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [jobTypeFilter]);

  const filteredJobs = filter === 'all'
    ? jobs
    : jobs.filter(job => job.status === filter);

  const handleStatusUpdate = async (job: OperationJob, newStatus: string) => {
    try {
      setUpdating(job.id);
      if (isLogisticsJob(job)) {
        await updateLogisticsJobStatus(job.order_id, job.id, newStatus);
      } else {
        await updateFieldOperationJobStatus(job.order_id, job.id, newStatus);
      }
      // Refresh jobs
      await fetchJobs();
    } catch (err) {
      console.error('Error updating job status:', err);
      setError('Error al actualizar el estado del job');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <LoadingPage />;

  const logisticsCount = jobs.filter(j => isLogisticsJob(j)).length;
  const fieldOpsCount = jobs.filter(j => !isLogisticsJob(j)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Centro de Operaciones</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Gestión de logística e instalaciones
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Job Type Filter */}
      <div className="flex gap-2">
        {['all', 'logistics', 'field_ops'].map(type => (
          <button
            key={type}
            onClick={() => setJobTypeFilter(type as 'all' | 'logistics' | 'field_ops')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              jobTypeFilter === type
                ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50'
                : 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700'
            }`}
          >
            {type === 'all' && 'Todos los jobs'}
            {type === 'logistics' && `Logística (${logisticsCount})`}
            {type === 'field_ops' && `Instalaciones (${fieldOpsCount})`}
          </button>
        ))}
      </div>

      {/* Stats */}
      {jobTypeFilter !== 'field_ops' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Por despachar', count: jobs.filter(j => isLogisticsJob(j) && j.status === 'pending_dispatch').length },
            { label: 'En tránsito', count: jobs.filter(j => isLogisticsJob(j) && j.status === 'in_transit').length },
            { label: 'Entregados', count: jobs.filter(j => isLogisticsJob(j) && j.status === 'delivered').length },
          ].map((stat, i) => (
            <Card key={i} className="p-4">
              <div className="text-sm text-neutral-400">{stat.label}</div>
              <div className="text-2xl font-bold mt-2">{stat.count}</div>
            </Card>
          ))}
        </div>
      )}

      {jobTypeFilter !== 'logistics' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Programadas', count: jobs.filter(j => !isLogisticsJob(j) && j.status === 'scheduled').length },
            { label: 'En progreso', count: jobs.filter(j => !isLogisticsJob(j) && j.status === 'in_progress').length },
            { label: 'Completadas', count: jobs.filter(j => !isLogisticsJob(j) && j.status === 'completed').length },
          ].map((stat, i) => (
            <Card key={i} className="p-4">
              <div className="text-sm text-neutral-400">{stat.label}</div>
              <div className="text-2xl font-bold mt-2">{stat.count}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'pending_dispatch', 'scheduled', 'in_transit', 'in_progress', 'completed', 'delivered'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors text-xs ${
              filter === status
                ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50'
                : 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700'
            }`}
          >
            {status === 'all' ? 'Todos' : status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Jobs Table */}
      <Card className="overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-700 bg-neutral-900/50">
                <th className="px-6 py-4 text-left font-semibold text-neutral-300">Pedido</th>
                <th className="px-6 py-4 text-left font-semibold text-neutral-300">Tipo</th>
                <th className="px-6 py-4 text-left font-semibold text-neutral-300">Estado</th>
                <th className="px-6 py-4 text-left font-semibold text-neutral-300">Inicio programado</th>
                <th className="px-6 py-4 text-left font-semibold text-neutral-300">Fin programado</th>
                <th className="px-6 py-4 text-left font-semibold text-neutral-300">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-neutral-400">
                    No hay jobs de operaciones
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => {
                  const StatusIcon = statusColors[job.status]?.deliveryIcon || statusColors[job.status]?.fieldIcon || ClockIcon;
                  const isLogistics = isLogisticsJob(job);
                  const nextStates = isLogistics
                    ? LOGISTICS_TRANSITIONS[job.status] || []
                    : FIELD_OPS_TRANSITIONS[job.status] || [];
                  
                  return (
                    <tr key={job.id} className="border-b border-neutral-800 hover:bg-neutral-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          href={`/${locale}/dashboard/pedidos/${job.order_id}`}
                          className="font-medium text-blue-400 hover:text-blue-300"
                        >
                          #{job.order_number || job.order_id || 'N/A'}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-neutral-400">
                          {isLogistics ? 'Logística' : 'Instalación'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${statusColors[job.status]?.bg} ${statusColors[job.status]?.text}`}>
                          <StatusIcon className="w-4 h-4" />
                          <span className="text-xs font-medium">{job.status_display || job.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-neutral-400 text-xs">
                        {job.scheduled_start
                          ? new Date(job.scheduled_start).toLocaleDateString(locale, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-neutral-400 text-xs">
                        {job.scheduled_end
                          ? new Date(job.scheduled_end).toLocaleDateString(locale, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {nextStates.length > 0 ? (
                            <select
                              disabled={updating === job.id}
                              onChange={(e) => handleStatusUpdate(job, e.target.value)}
                              defaultValue=""
                              className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 hover:border-neutral-600 disabled:opacity-50 cursor-pointer"
                            >
                              <option value="">Cambiar estado...</option>
                              {nextStates.map(status => (
                                <option key={status} value={status}>
                                  → {status.replace('_', ' ')}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-neutral-500">Finalizado</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-2 p-3">
          {filteredJobs.length === 0 ? (
            <div className="text-center text-neutral-400 py-6 text-sm">No hay jobs de operaciones</div>
          ) : (
            filteredJobs.map(job => {
              const StatusIcon = statusColors[job.status]?.deliveryIcon || statusColors[job.status]?.fieldIcon || ClockIcon;
              const isLogistics = isLogisticsJob(job);
              const nextStates = isLogistics
                ? LOGISTICS_TRANSITIONS[job.status] || []
                : FIELD_OPS_TRANSITIONS[job.status] || [];

              return (
                <div key={job.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/${locale}/dashboard/pedidos/${job.order_id}`}
                      className="font-medium text-blue-400 hover:text-blue-300"
                    >
                      #{job.order_number || job.order_id || 'N/A'}
                    </Link>
                    <span className="text-xs text-neutral-500">{isLogistics ? 'Logística' : 'Instalación'}</span>
                  </div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${statusColors[job.status]?.bg} ${statusColors[job.status]?.text}`}>
                    <StatusIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">{job.status_display || job.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400">
                    <div>
                      <p className="text-neutral-500">Inicio</p>
                      <p>
                        {job.scheduled_start
                          ? new Date(job.scheduled_start).toLocaleDateString(locale, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Fin</p>
                      <p>
                        {job.scheduled_end
                          ? new Date(job.scheduled_end).toLocaleDateString(locale, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-neutral-800">
                    {nextStates.length > 0 ? (
                      <select
                        disabled={updating === job.id}
                        onChange={(e) => handleStatusUpdate(job, e.target.value)}
                        defaultValue=""
                        className="w-full text-xs px-2 py-2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 hover:border-neutral-600 disabled:opacity-50 cursor-pointer"
                      >
                        <option value="">Cambiar estado...</option>
                        {nextStates.map(status => (
                          <option key={status} value={status}>
                            → {status.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-neutral-500">Finalizado</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
