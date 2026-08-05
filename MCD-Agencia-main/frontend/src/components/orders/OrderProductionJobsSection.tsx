'use client';

import Link from 'next/link';
import {
  ArrowPathIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { Card } from '@/components/ui';
import type { OrderOperationalTracks } from '@/lib/api/admin';
import {
  OPERATIONAL_ROLLUP_LABELS,
  ORDER_ORIGIN_LABELS,
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_TONES,
} from '@/lib/production-status';

interface OrderProductionJobsSectionProps {
  tracks: OrderOperationalTracks | null;
  loading: boolean;
  error: string | null;
  locale: string;
  orderId: string;
  orderNumber: string;
  orderOrigin?: string;
  canViewProductionPanel: boolean;
  onRetry: () => void;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function OrderProductionJobsSection({
  tracks,
  loading,
  error,
  locale,
  orderId,
  orderNumber,
  orderOrigin,
  canViewProductionPanel,
  onRetry,
}: OrderProductionJobsSectionProps) {
  const jobs = tracks?.production_jobs ?? [];
  const rollup = tracks?.operational_rollup;
  const rollupLabel = rollup ? OPERATIONAL_ROLLUP_LABELS[rollup] || rollup : null;
  const isDirectPurchase = orderOrigin === 'direct_purchase';

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Trabajos de producción</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Avance del taller vinculado a este pedido
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rollupLabel && (
            <span className="inline-flex items-center rounded-full border border-cmyk-cyan/30 bg-cmyk-cyan/10 px-3 py-1 text-xs font-medium text-cmyk-cyan">
              {rollupLabel}
            </span>
          )}
          {canViewProductionPanel && (
            <Link
              href={`/${locale}/dashboard/produccion?order_id=${orderId}&order_number=${encodeURIComponent(orderNumber)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-200 hover:bg-purple-500/20"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Ver en tablero
            </Link>
          )}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-neutral-400">Cargando trabajos de producción...</p>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-200">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs text-red-100 underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          {isDirectPurchase ? (
            <>
              <p className="text-sm text-neutral-200 font-medium">Este pedido no requiere producción</p>
              <p className="text-xs text-neutral-400 mt-1">
                Las compras directas del catálogo pasan a logística sin trabajo en taller.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-200 font-medium">Sin trabajos de producción registrados</p>
              <p className="text-xs text-neutral-400 mt-1">
                Al enviar el pedido a producción se generan automáticamente. Si es un pedido antiguo, contacte a administración.
              </p>
            </>
          )}
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => {
            const tone = PRODUCTION_STATUS_TONES[job.status] || PRODUCTION_STATUS_TONES.queued;
            const label = job.status_display || PRODUCTION_STATUS_LABELS[job.status] || job.status;

            return (
              <div
                key={job.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {[job.product_name, job.variant_name].filter(Boolean).join(' · ') || 'Trabajo de producción'}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      SKU / línea vinculada al pedido #{orderNumber}
                    </p>
                  </div>
                  <span className={`inline-flex self-start rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
                    {label}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-neutral-400">
                  <p className="flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                    Entrega est.: {formatDate(job.estimated_delivery_date || job.planned_end)}
                  </p>
                  <p>Inicio real: {formatDate(job.actual_start)}</p>
                  <p>Fin real: {formatDate(job.actual_end)}</p>
                </div>
                {job.requires_quality_check && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-300">
                    <ClipboardDocumentCheckIcon className="h-3.5 w-3.5" />
                    Requiere control de calidad
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!canViewProductionPanel && !loading && (
        <p className="mt-4 flex items-start gap-1.5 text-xs text-neutral-500">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0 mt-0.5" />
          El equipo de producción gestiona los estados en el tablero de taller. Ventas puede consultar el avance aquí.
        </p>
      )}

      {orderOrigin && (
        <p className="mt-3 text-xs text-neutral-600">
          Origen del pedido: {ORDER_ORIGIN_LABELS[orderOrigin] || orderOrigin}
        </p>
      )}
    </Card>
  );
}
