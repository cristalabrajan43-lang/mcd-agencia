'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  PaperClipIcon,
  PhotoIcon,
  ArrowTopRightOnSquareIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  UserIcon,
  ArrowRightIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, LoadingPage } from '@/components/ui';
import { ServiceDetailsDisplay } from '@/components/quotes';
import { SERVICE_LABELS, DELIVERY_METHOD_LABELS, DELIVERY_METHOD_ICONS, type ServiceId, type DeliveryMethod } from '@/lib/service-ids';
import { serviceDetailsLabels, subtipoLabels } from '@/components/quotes/ServiceDetailsDisplay';
import {
  getChangeRequestById,
  reviewChangeRequest,
  getAdminQuoteById,
  downloadChangeRequestPdf,
  QuoteChangeRequest,
  Quote,
} from '@/lib/api/quotes';

/* ─── Status UI maps ─── */
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
  approved: 'bg-green-500/20 text-green-400 border-green-500',
  rejected: 'bg-red-500/20 text-red-400 border-red-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente de revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

/* ─── Types for grouped service changes ─── */
interface OriginalLine {
  id: string;
  concept: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  line_total: string;
  service_type?: string;
  service_details?: Record<string, unknown>;
}

interface ProposedLineItem {
  id?: string;
  action: string;
  concept?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  service_details?: Record<string, unknown>;
}

interface ServiceGroup {
  action: 'modify' | 'add' | 'delete';
  serviceType?: string;
  serviceLabel: string;
  originalLines: OriginalLine[];
  proposedLines: ProposedLineItem[];
  originalDetails?: Record<string, unknown>;
  proposedDetails?: Record<string, unknown>;
  originalDelivery?: {
    method?: string;
    address?: Record<string, string>;
    pickupBranch?: Record<string, string>;
    requiredDate?: string;
  };
  proposedDelivery?: {
    method?: string;
    address?: Record<string, string>;
    pickupBranch?: string;
    requiredDate?: string;
  };
}

/* ─── Helper: extract delivery info ─── */
function extractDeliveryFromOriginal(line: OriginalLine) {
  const sd = line.service_details as Record<string, unknown> | undefined;
  return {
    method: sd?.delivery_method as string | undefined,
    address: sd?.delivery_address as Record<string, string> | undefined,
    pickupBranch: sd?.pickup_branch_detail as Record<string, string> | undefined,
    requiredDate: sd?.required_date as string | undefined,
  };
}

function extractDeliveryFromProposed(sd: Record<string, unknown> | undefined) {
  if (!sd) return undefined;
  return {
    method: sd.delivery_method as string | undefined,
    address: sd.delivery_address as Record<string, string> | undefined,
    pickupBranch: sd.pickup_branch as string | undefined,
    requiredDate: sd.required_date as string | undefined,
  };
}

/* ─── Fields to skip in service_details diff ─── */
const SKIP_DETAIL_FIELDS = new Set([
  'service_type', 'delivery_method', 'delivery_address', 'pickup_branch',
  'pickup_branch_detail', 'required_date', 'vendor_added', 'rutas',
  '_vallasRoutes', '_pubRoutes', '_perifRoutes',
]);

/* ─── Build service groups from change request data ─── */
function buildServiceGroups(
  proposedLines: ProposedLineItem[],
  originalLines: OriginalLine[]
): ServiceGroup[] {
  const groups: ServiceGroup[] = [];

  const modifyMap = new Map<string, ProposedLineItem[]>();
  const addLines: ProposedLineItem[] = [];
  const deleteIds: string[] = [];

  for (const pl of proposedLines) {
    if (pl.action === 'add') {
      addLines.push(pl);
    } else if (pl.action === 'delete' && pl.id) {
      deleteIds.push(pl.id);
    } else if (pl.action === 'modify' && pl.id) {
      if (pl.service_details && Object.keys(pl.service_details).length > 0) {
        modifyMap.set(pl.id, [pl]);
      } else {
        const lastKey = Array.from(modifyMap.keys()).pop();
        if (lastKey) {
          modifyMap.get(lastKey)!.push(pl);
        } else {
          modifyMap.set(pl.id, [pl]);
        }
      }
    }
  }

  // Modify groups
  Array.from(modifyMap.entries()).forEach(([, pLines]) => {
    const allIds = pLines.map((p: ProposedLineItem) => p.id).filter(Boolean) as string[];
    const originals = allIds
      .map(id => originalLines.find(ol => ol.id === id))
      .filter(Boolean) as OriginalLine[];
    const leaderOriginal = originals[0];
    const leaderProposed = pLines[0];

    const serviceType = (leaderProposed.service_details?.service_type as string)
      || leaderOriginal?.service_type || '';
    const serviceLabel = serviceType
      ? (SERVICE_LABELS[serviceType as ServiceId] || serviceType)
      : leaderOriginal?.concept || 'Servicio';

    groups.push({
      action: 'modify',
      serviceType,
      serviceLabel,
      originalLines: originals,
      proposedLines: pLines,
      originalDetails: leaderOriginal?.service_details || {},
      proposedDetails: leaderProposed.service_details || {},
      originalDelivery: leaderOriginal ? extractDeliveryFromOriginal(leaderOriginal) : undefined,
      proposedDelivery: extractDeliveryFromProposed(leaderProposed.service_details || {}),
    });
  });

  // Delete groups — cluster by service_type
  const deleteByServiceType = new Map<string, OriginalLine[]>();
  for (const id of deleteIds) {
    const orig = originalLines.find(ol => ol.id === id);
    if (!orig) continue;
    const svcType = orig.service_type || '__no_type__';
    if (!deleteByServiceType.has(svcType)) deleteByServiceType.set(svcType, []);
    deleteByServiceType.get(svcType)!.push(orig);
  }

  Array.from(deleteByServiceType.values()).forEach((originals) => {
    const leader = originals[0];
    const serviceType = leader?.service_type || '';
    const serviceLabel = serviceType
      ? (SERVICE_LABELS[serviceType as ServiceId] || serviceType)
      : leader?.concept || 'Servicio';

    groups.push({
      action: 'delete',
      serviceType,
      serviceLabel,
      originalLines: originals,
      proposedLines: originals.map((o: OriginalLine) => ({ id: o.id, action: 'delete' as const, concept: o.concept })),
      originalDetails: leader?.service_details || {},
      originalDelivery: leader ? extractDeliveryFromOriginal(leader) : undefined,
    });
  });

  // Add groups
  for (const pl of addLines) {
    const sd = pl.service_details as Record<string, unknown> | undefined;
    const serviceType = sd?.service_type as string | undefined;
    const serviceLabel = serviceType
      ? (SERVICE_LABELS[serviceType as ServiceId] || serviceType)
      : pl.concept || 'Nuevo servicio';

    groups.push({
      action: 'add',
      serviceType: serviceType || undefined,
      serviceLabel,
      originalLines: [],
      proposedLines: [pl],
      proposedDetails: sd || {},
      proposedDelivery: extractDeliveryFromProposed(sd),
    });
  }

  const order = { modify: 0, add: 1, delete: 2 };
  groups.sort((a, b) => order[a.action] - order[b.action]);
  return groups;
}

/* ─── Diff helpers ─── */
function getChangedDetailFields(
  original: Record<string, unknown> | undefined,
  proposed: Record<string, unknown> | undefined
): Set<string> {
  const changed = new Set<string>();
  if (!original || !proposed) return changed;
  const allKeys = [...Object.keys(original), ...Object.keys(proposed)].filter((k, i, arr) => arr.indexOf(k) === i);
  for (const key of allKeys) {
    if (SKIP_DETAIL_FIELDS.has(key)) continue;
    const origVal = original[key];
    const propVal = proposed[key];
    if (propVal === undefined || propVal === null || propVal === '') continue;
    if (JSON.stringify(origVal) !== JSON.stringify(propVal)) {
      changed.add(key);
    }
  }
  return changed;
}

function hasDeliveryChanges(
  original?: ServiceGroup['originalDelivery'],
  proposed?: ServiceGroup['proposedDelivery']
): boolean {
  if (!original && !proposed) return false;
  if (!original || !proposed) return !!proposed?.method;
  return original.method !== proposed.method
    || JSON.stringify(original.address) !== JSON.stringify(proposed.address)
    || original.requiredDate !== proposed.requiredDate;
}

function hasRouteChanges(
  originalDetails?: Record<string, unknown>,
  proposedDetails?: Record<string, unknown>
): boolean {
  const origRoutes = originalDetails?.rutas as unknown[] | undefined;
  const propRoutes = proposedDetails?.rutas as unknown[] | undefined;
  if (!origRoutes && !propRoutes) return false;
  return JSON.stringify(origRoutes) !== JSON.stringify(propRoutes);
}

/* ═══════════════════════════════════════════════════════════ */
/*                       MAIN COMPONENT                       */
/* ═══════════════════════════════════════════════════════════ */

export default function ChangeRequestReviewPage() {
  const router = useRouter();
  const params = useParams();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [changeRequest, setChangeRequest] = useState<QuoteChangeRequest | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showReviewModal, setShowReviewModal] = useState<'approve' | 'reject' | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [showOriginalDetail, setShowOriginalDetail] = useState<Set<number>>(new Set());
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const quoteId = params.id as string;
  const changeId = params.changeId as string;
  const isSalesOrAdmin = user?.role?.name && ['admin', 'sales'].includes(user.role.name);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/cotizaciones/${quoteId}/cambios/${changeId}`);
      } else if (!isSalesOrAdmin) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, isSalesOrAdmin, router, locale, quoteId, changeId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!changeId || !quoteId || !isAuthenticated || !isSalesOrAdmin) return;
      setIsLoading(true);
      try {
        const [changeData, quoteData] = await Promise.all([
          getChangeRequestById(changeId),
          getAdminQuoteById(quoteId),
        ]);
        setChangeRequest(changeData);
        setQuote(quoteData);
        const g = buildServiceGroups(changeData.proposed_lines || [], changeData.original_snapshot?.lines || []);
        setExpandedGroups(new Set(g.map((_, i) => i)));
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error al cargar la solicitud');
        router.push(`/${locale}/dashboard/cotizaciones/${quoteId}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [changeId, quoteId, isAuthenticated, isSalesOrAdmin, router, locale]);

  const serviceGroups = useMemo(() => {
    if (!changeRequest) return [];
    return buildServiceGroups(changeRequest.proposed_lines || [], changeRequest.original_snapshot?.lines || []);
  }, [changeRequest]);

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!changeRequest) return;
    setIsReviewing(true);
    try {
      const result = await reviewChangeRequest(changeRequest.id, action, reviewNotes);
      setChangeRequest(result.change_request);
      setShowReviewModal(null);
      setReviewNotes('');
      toast.success(action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      if (action === 'approve') {
        router.push(`/${locale}/dashboard/cotizaciones/${quoteId}/editar`);
      }
    } catch (error) {
      console.error('Error reviewing request:', error);
      toast.error('Error al procesar la solicitud');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!changeRequest) return;
    setIsDownloadingPdf(true);
    try {
      const blob = await downloadChangeRequestPdf(changeRequest.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cambios_${changeRequest.quote_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Error al descargar el PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const toggleGroup = (idx: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleOriginalDetail = (idx: number) => {
    setShowOriginalDetail(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const formatCurrency = (amount: number | string) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount) || 0);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (authLoading || isLoading) return <LoadingPage message="Cargando solicitud de cambios..." />;
  if (!isAuthenticated || !isSalesOrAdmin || !changeRequest || !quote) return null;

  const isPending = changeRequest.status === 'pending';
  const isApproved = changeRequest.status === 'approved';

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/${locale}/dashboard/cotizaciones/${quoteId}`}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">Solicitud de Cambios</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusColors[changeRequest.status]}`}>
                {changeRequest.status === 'pending' && <ClockIcon className="h-4 w-4" />}
                {changeRequest.status === 'approved' && <CheckCircleIcon className="h-4 w-4" />}
                {changeRequest.status === 'rejected' && <XCircleIcon className="h-4 w-4" />}
                {statusLabels[changeRequest.status]}
              </span>
            </div>
            <p className="text-neutral-400 mt-1">
              Para cotización {changeRequest.quote_number} — Recibida el {formatDate(changeRequest.created_at)}
            </p>
          </div>
        </div>

        {isPending && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowReviewModal('reject')}
              variant="outline"
              className="text-red-400 border-red-400/50 hover:bg-red-400/10"
              leftIcon={<XCircleIcon className="h-4 w-4" />}
            >
              Rechazar
            </Button>
            <Button
              onClick={() => setShowReviewModal('approve')}
              className="bg-green-600 hover:bg-green-700"
              leftIcon={<CheckCircleIcon className="h-4 w-4" />}
            >
              Aprobar y Editar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Customer Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Datos del Cliente</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-neutral-500 text-sm">Nombre</p>
                <p className="text-white font-medium">{changeRequest.customer_name}</p>
              </div>
              <div>
                <p className="text-neutral-500 text-sm">Email</p>
                <p className="text-white">{changeRequest.customer_email}</p>
              </div>
            </div>
          </Card>

          {/* Summary */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Resumen de Cambios</h2>
            <div className="flex flex-wrap gap-3">
              {changeRequest.changes_summary.modified > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-medium">
                  <PencilIcon className="h-3.5 w-3.5" />
                  {changeRequest.changes_summary.modified} modificado(s)
                </span>
              )}
              {changeRequest.changes_summary.added > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
                  <PlusIcon className="h-3.5 w-3.5" />
                  {changeRequest.changes_summary.added} agregado(s)
                </span>
              )}
              {changeRequest.changes_summary.deleted > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 text-sm font-medium">
                  <TrashIcon className="h-3.5 w-3.5" />
                  {changeRequest.changes_summary.deleted} eliminado(s)
                </span>
              )}
            </div>
          </Card>

          {/* Service Groups — Diff View */}
          <div className="space-y-4">
            {serviceGroups.map((group, gIdx) => {
              if (group.action === 'delete' && isApproved) return null;

              const isExpanded = expandedGroups.has(gIdx);
              const isShowingOriginal = showOriginalDetail.has(gIdx);

              const routeCount = group.proposedDetails?.rutas
                ? (group.proposedDetails.rutas as unknown[]).length
                : group.originalDetails?.rutas
                  ? (group.originalDetails.rutas as unknown[]).length
                  : 0;

              const changedFields = group.action === 'modify'
                ? getChangedDetailFields(group.originalDetails, group.proposedDetails)
                : new Set<string>();

              const deliveryChanged = group.action === 'modify'
                && hasDeliveryChanges(group.originalDelivery, group.proposedDelivery);

              const routesChanged = group.action === 'modify'
                && hasRouteChanges(group.originalDetails, group.proposedDetails);

              const descriptionChanged = group.action === 'modify' && group.proposedLines.some((pl, i) => {
                const ol = group.originalLines[i];
                return pl.description !== undefined && ol && pl.description !== ol.description;
              });

              const hasAnyChanges = changedFields.size > 0 || deliveryChanged || routesChanged || descriptionChanged;

              const borderClass = group.action === 'add'
                ? 'border-green-500/40'
                : group.action === 'delete'
                  ? 'border-red-500/40'
                  : 'border-yellow-500/40';

              const headerBg = group.action === 'add'
                ? 'bg-green-500/5 hover:bg-green-500/10'
                : group.action === 'delete'
                  ? 'bg-red-500/5 hover:bg-red-500/10'
                  : 'bg-yellow-500/5 hover:bg-yellow-500/10';

              const actionBadge = group.action === 'add'
                ? { bg: 'bg-green-500/15 text-green-400 border-green-500/30', icon: <PlusIcon className="h-3 w-3" />, label: 'Nuevo — Agregado por el cliente' }
                : group.action === 'delete'
                  ? { bg: 'bg-red-500/15 text-red-400 border-red-500/30', icon: <TrashIcon className="h-3 w-3" />, label: 'Eliminado por el cliente' }
                  : { bg: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: <PencilIcon className="h-3 w-3" />, label: 'Modificado por el cliente' };

              return (
                <Card key={gIdx} className={`overflow-hidden border ${borderClass} ${group.action === 'delete' ? 'opacity-70' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(gIdx)}
                    className={`w-full flex items-center gap-3 p-4 ${headerBg} transition-colors text-left`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-white font-semibold text-sm ${group.action === 'delete' ? 'line-through opacity-70' : ''}`}>
                          {group.serviceLabel}
                          {routeCount > 1 && (
                            <span className="ml-2 text-xs font-normal text-neutral-400">({routeCount} rutas)</span>
                          )}
                        </p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${actionBadge.bg}`}>
                          {actionBadge.icon}
                          {actionBadge.label}
                        </span>
                      </div>
                      {group.action === 'modify' && hasAnyChanges && (
                        <p className="text-neutral-500 text-xs mt-1">
                          Campos modificados:{' '}
                          {[
                            ...Array.from(changedFields).map(k => serviceDetailsLabels[k] || k),
                            ...(deliveryChanged ? ['Método de entrega'] : []),
                            ...(routesChanged ? ['Rutas'] : []),
                            ...(descriptionChanged ? ['Comentarios'] : []),
                          ].join(', ')}
                        </p>
                      )}
                    </div>
                    <ChevronDownIcon className={`h-5 w-5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="p-5 border-t border-neutral-700/50 space-y-5">

                      {/* ADDED */}
                      {group.action === 'add' && (() => {
                        const pl = group.proposedLines[0];
                        const sd = pl.service_details as Record<string, unknown> | undefined;
                        const deliveryMethod = sd?.delivery_method as string | undefined;
                        const requiredDate = sd?.required_date as string | undefined;
                        const deliveryAddress = sd?.delivery_address as Record<string, string> | undefined;
                        const pickupBranch = sd?.pickup_branch_detail as Record<string, string> | undefined;

                        return (
                          <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                              <UserIcon className="h-4 w-4 text-green-400" />
                              <p className="text-green-400 text-xs font-medium">Servicio nuevo solicitado por el cliente</p>
                            </div>

                            {pl.description && (
                              <div className="p-3 bg-neutral-800/50 rounded-lg">
                                <p className="text-neutral-500 text-xs mb-1">Comentarios del cliente</p>
                                <p className="text-white text-sm whitespace-pre-wrap">{pl.description}</p>
                              </div>
                            )}

                            {sd && Object.keys(sd).length > 0 && group.serviceType && (
                              <ServiceDetailsDisplay serviceType={group.serviceType} serviceDetails={sd} />
                            )}

                            <DeliveryInfoBlock
                              deliveryMethod={deliveryMethod}
                              deliveryAddress={deliveryAddress}
                              pickupBranch={pickupBranch}
                              requiredDate={requiredDate}
                              hasRouteDates={sd && Array.isArray(sd.rutas) && (sd.rutas as Array<Record<string, unknown>>).some(r => !!r.fecha_inicio)}
                            />
                          </div>
                        );
                      })()}

                      {/* DELETED (Ghost) */}
                      {group.action === 'delete' && (
                        <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <TrashIcon className="h-4 w-4 text-red-400" />
                            <p className="text-red-400 text-xs font-medium">El cliente solicita eliminar este servicio</p>
                          </div>
                          <div className="opacity-60">
                            {group.originalLines.length > 0 && (
                              <div className="space-y-2">
                                {group.originalLines.map((ol, olIdx) => (
                                  <div key={olIdx} className="flex items-center gap-3 text-sm">
                                    <span className="text-neutral-400 line-through">{ol.concept}</span>
                                    <span className="text-neutral-500">
                                      {ol.quantity} {ol.unit} × {formatCurrency(ol.unit_price)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {group.originalDetails && Object.keys(group.originalDetails).length > 0 && group.serviceType && (
                              <div className="mt-3">
                                <ServiceDetailsDisplay serviceType={group.serviceType} serviceDetails={group.originalDetails} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* MODIFIED — Diff View */}
                      {group.action === 'modify' && (
                        <div className="space-y-4">

                          {/* Field-level diff */}
                          {changedFields.size > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-yellow-400 mb-3 flex items-center gap-1.5">
                                <PencilIcon className="h-3.5 w-3.5" />
                                Campos modificados del servicio
                              </p>
                              <div className="grid grid-cols-1 gap-3">
                                {Array.from(changedFields).map(field => {
                                  const origVal = group.originalDetails?.[field];
                                  const propVal = group.proposedDetails?.[field];
                                  const label = serviceDetailsLabels[field] || field;

                                  return (
                                    <div key={field} className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                                      <p className="text-neutral-400 text-xs font-medium mb-2">{label}</p>
                                      <div className="flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] text-neutral-500 mb-0.5">Antes</p>
                                          <div className="p-2 rounded bg-neutral-800/50 border border-neutral-700/50">
                                            <p className="text-neutral-400 text-sm line-through whitespace-pre-wrap break-words">
                                              {formatFieldValue(field, origVal)}
                                            </p>
                                          </div>
                                        </div>
                                        <ArrowRightIcon className="h-4 w-4 text-yellow-400 mt-5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] text-yellow-400 mb-0.5">Ahora</p>
                                          <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                                            <p className="text-white text-sm font-medium whitespace-pre-wrap break-words">
                                              {formatFieldValue(field, propVal)}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Delivery diff */}
                          {deliveryChanged && (
                            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                              <p className="text-neutral-400 text-xs font-medium mb-2">Método de entrega</p>
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <p className="text-[10px] text-neutral-500 mb-0.5">Antes</p>
                                  <div className="p-2 rounded bg-neutral-800/50 border border-neutral-700/50">
                                    <p className="text-neutral-400 text-sm line-through">
                                      {group.originalDelivery?.method
                                        ? (DELIVERY_METHOD_LABELS[group.originalDelivery.method as DeliveryMethod]?.es || group.originalDelivery.method)
                                        : 'Sin especificar'}
                                    </p>
                                    {group.originalDelivery?.address && (
                                      <p className="text-neutral-500 text-xs mt-1 line-through">
                                        {Object.values(group.originalDelivery.address).filter(Boolean).join(', ')}
                                      </p>
                                    )}
                                    {group.originalDelivery?.requiredDate && (
                                      <p className="text-neutral-500 text-xs mt-1 line-through">Fecha: {group.originalDelivery.requiredDate}</p>
                                    )}
                                  </div>
                                </div>
                                <ArrowRightIcon className="h-4 w-4 text-yellow-400 mt-5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-[10px] text-yellow-400 mb-0.5">Ahora</p>
                                  <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                                    <p className="text-white text-sm font-medium">
                                      {group.proposedDelivery?.method
                                        ? <>
                                            <span className="mr-1">{DELIVERY_METHOD_ICONS[group.proposedDelivery.method as DeliveryMethod]}</span>
                                            {DELIVERY_METHOD_LABELS[group.proposedDelivery.method as DeliveryMethod]?.es || group.proposedDelivery.method}
                                          </>
                                        : 'Sin especificar'}
                                    </p>
                                    {group.proposedDelivery?.address && (
                                      <p className="text-neutral-300 text-xs mt-1">
                                        {Object.values(group.proposedDelivery.address).filter(Boolean).join(', ')}
                                      </p>
                                    )}
                                    {group.proposedDelivery?.requiredDate && (
                                      <p className="text-neutral-300 text-xs mt-1">Fecha: {group.proposedDelivery.requiredDate}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Route-level diff */}
                          {routesChanged && (
                            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                              <p className="text-neutral-400 text-xs font-medium mb-3">Rutas modificadas</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <p className="text-[10px] text-neutral-500 mb-1">Antes</p>
                                  <div className="p-3 rounded bg-neutral-800/50 border border-neutral-700/50 space-y-2">
                                    {(() => {
                                      const origRoutes = (group.originalDetails?.rutas as Array<Record<string, unknown>>) || [];
                                      return origRoutes.length > 0 ? origRoutes.map((r, ri) => (
                                        <div key={ri} className="text-sm text-neutral-400 line-through">
                                          <span className="text-neutral-500 text-xs">Ruta {(r.numero as number) || ri + 1}:</span>
                                          {!!r.fecha_inicio && <span className="ml-1">{String(r.fecha_inicio)}</span>}
                                          {!!r.fecha_fin && <span className="ml-1">→ {String(r.fecha_fin)}</span>}
                                          {!!r.comentarios && <p className="text-neutral-500 text-xs truncate">{String(r.comentarios)}</p>}
                                        </div>
                                      )) : <p className="text-neutral-500 text-xs">Sin rutas</p>;
                                    })()}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] text-yellow-400 mb-1">Ahora</p>
                                  <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/30 space-y-2">
                                    {(() => {
                                      const propRoutes = (group.proposedDetails?.rutas as Array<Record<string, unknown>>) || [];
                                      return propRoutes.length > 0 ? propRoutes.map((r, ri) => (
                                        <div key={ri} className="text-sm text-white">
                                          <span className="text-yellow-400 text-xs">Ruta {(r.numero as number) || ri + 1}:</span>
                                          {!!r.fecha_inicio && <span className="ml-1">{String(r.fecha_inicio)}</span>}
                                          {!!r.fecha_fin && <span className="ml-1">→ {String(r.fecha_fin)}</span>}
                                          {!!r.comentarios && <p className="text-neutral-300 text-xs truncate">{String(r.comentarios)}</p>}
                                        </div>
                                      )) : <p className="text-neutral-500 text-xs">Sin rutas</p>;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Description/comment diff */}
                          {descriptionChanged && (
                            <div>
                              <p className="text-xs font-semibold text-yellow-400 mb-3 flex items-center gap-1.5">
                                <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                                Comentarios modificados
                              </p>
                              {group.proposedLines.map((pl, plIdx) => {
                                const ol = group.originalLines[plIdx];
                                if (!ol || pl.description === ol.description) return null;
                                return (
                                  <div key={plIdx} className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 mb-2">
                                    {group.proposedLines.length > 1 && (
                                      <p className="text-neutral-500 text-[10px] mb-2">{ol.concept || `Línea ${plIdx + 1}`}</p>
                                    )}
                                    <div className="flex flex-col gap-2">
                                      {ol.description && (
                                        <div>
                                          <p className="text-[10px] text-neutral-500 mb-0.5">Antes</p>
                                          <p className="text-neutral-400 text-sm line-through whitespace-pre-wrap p-2 rounded bg-neutral-800/50 border border-neutral-700/50">
                                            {ol.description}
                                          </p>
                                        </div>
                                      )}
                                      {pl.description && (
                                        <div>
                                          <p className="text-[10px] text-yellow-400 mb-0.5">Ahora</p>
                                          <p className="text-white text-sm whitespace-pre-wrap p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                                            {pl.description}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* No changes */}
                          {!hasAnyChanges && (
                            <div className="p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/30">
                              <p className="text-neutral-500 text-sm flex items-center gap-2">
                                <CheckCircleIcon className="h-4 w-4 text-neutral-600" />
                                No se detectaron cambios en los campos de este servicio.
                              </p>
                            </div>
                          )}

                          {/* "Ver detalle original" — only when actual modifications exist */}
                          {hasAnyChanges && group.originalDetails && Object.keys(group.originalDetails).length > 0 && (
                            <div>
                              <button
                                type="button"
                                onClick={() => toggleOriginalDetail(gIdx)}
                                className="flex items-center gap-1.5 text-neutral-400 text-xs hover:text-cmyk-cyan transition-colors"
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                {isShowingOriginal ? 'Ocultar detalle de la solicitud original' : 'Ver detalle de la solicitud original'}
                                <ChevronDownIcon className={`h-3 w-3 transition-transform ${isShowingOriginal ? 'rotate-180' : ''}`} />
                              </button>

                              {isShowingOriginal && (
                                <div className="mt-3 p-4 rounded-lg bg-neutral-900/60 border border-neutral-700/50 space-y-3">
                                  <p className="text-neutral-500 text-xs font-medium mb-2">Detalle original del servicio</p>
                                  <ServiceDetailsDisplay serviceType={group.serviceType || ''} serviceDetails={group.originalDetails} />

                                  {group.originalDelivery?.method && (
                                    <DeliveryInfoBlock
                                      deliveryMethod={group.originalDelivery.method}
                                      deliveryAddress={group.originalDelivery.address}
                                      pickupBranch={group.originalDelivery.pickupBranch}
                                      requiredDate={group.originalDelivery.requiredDate}
                                      hasRouteDates={
                                        !!(group.originalDetails?.rutas
                                        && Array.isArray(group.originalDetails.rutas)
                                        && (group.originalDetails.rutas as Array<Record<string, unknown>>).some(r => !!r.fecha_inicio))
                                      }
                                    />
                                  )}

                                  {group.originalLines.length > 0 && (
                                    <div className="pt-2 border-t border-neutral-700/50">
                                      <p className="text-neutral-500 text-xs mb-2">Líneas originales</p>
                                      {group.originalLines.map((ol, olIdx) => (
                                        <div key={olIdx} className="flex items-center justify-between text-sm py-1">
                                          <span className="text-neutral-400 truncate mr-3">{ol.concept}</span>
                                          <span className="text-neutral-500 flex-shrink-0">
                                            {ol.quantity} {ol.unit} × {formatCurrency(ol.unit_price)} = {formatCurrency(ol.line_total)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Customer Global Comments */}
          {changeRequest.customer_comments && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-cmyk-cyan" />
                Comentarios Generales del Cliente
              </h2>
              <p className="text-neutral-300 whitespace-pre-wrap">{changeRequest.customer_comments}</p>
            </Card>
          )}

          {/* Original Quote Attachments */}
          {quote && quote.attachments && quote.attachments.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <PaperClipIcon className="h-5 w-5 text-neutral-400" />
                Archivos de la Cotización Original ({quote.attachments.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {quote.attachments.map((attachment) => {
                  const isImage = attachment.file_type?.startsWith('image/');
                  const fileSize = attachment.file_size
                    ? attachment.file_size < 1024 * 1024
                      ? `${(attachment.file_size / 1024).toFixed(0)} KB`
                      : `${(attachment.file_size / (1024 * 1024)).toFixed(1)} MB`
                    : '';

                  return (
                    <a
                      key={attachment.id}
                      href={attachment.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block rounded-lg border border-neutral-700 bg-neutral-800/50 overflow-hidden hover:border-neutral-500/50 transition-colors"
                    >
                      {isImage ? (
                        <div className="aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={attachment.file} alt={attachment.filename} className="w-full h-full object-cover opacity-75 hover:opacity-100 transition-opacity" />
                        </div>
                      ) : (
                        <div className="aspect-square flex flex-col items-center justify-center p-3">
                          <PhotoIcon className="h-8 w-8 text-neutral-500 mb-1" />
                          <span className="text-[10px] text-neutral-500 text-center truncate w-full">{attachment.filename}</span>
                        </div>
                      )}
                      <div className="p-2 border-t border-neutral-700">
                        <p className="text-xs text-neutral-300 truncate" title={attachment.filename}>{attachment.filename}</p>
                        {fileSize && <p className="text-[10px] text-neutral-500">{fileSize}</p>}
                      </div>
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-white bg-black/50 rounded p-0.5" />
                      </div>
                    </a>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Attachments from Change Request */}
          {changeRequest.attachments && changeRequest.attachments.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <PaperClipIcon className="h-5 w-5 text-cmyk-cyan" />
                Archivos Adjuntos de la Solicitud de Cambio ({changeRequest.attachments.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {changeRequest.attachments.map((attachment) => {
                  const isImage = attachment.file_type?.startsWith('image/');
                  const fileSize = attachment.file_size
                    ? attachment.file_size < 1024 * 1024
                      ? `${(attachment.file_size / 1024).toFixed(0)} KB`
                      : `${(attachment.file_size / (1024 * 1024)).toFixed(1)} MB`
                    : '';

                  return (
                    <a
                      key={attachment.id}
                      href={attachment.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block rounded-lg border border-cmyk-cyan/50 bg-cmyk-cyan/5 overflow-hidden hover:border-cmyk-cyan/80 transition-colors"
                    >
                      {isImage ? (
                        <div className="aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={attachment.file} alt={attachment.filename} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-square flex flex-col items-center justify-center p-3">
                          <PhotoIcon className="h-8 w-8 text-cmyk-cyan/60 mb-1" />
                          <span className="text-[10px] text-cmyk-cyan/60 text-center truncate w-full">{attachment.filename}</span>
                        </div>
                      )}
                      <div className="p-2 border-t border-cmyk-cyan/30">
                        <p className="text-xs text-cmyk-cyan truncate" title={attachment.filename}>{attachment.filename}</p>
                        {fileSize && <p className="text-[10px] text-cmyk-cyan/60">{fileSize}</p>}
                      </div>
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-cmyk-cyan bg-black/50 rounded p-0.5" />
                      </div>
                    </a>
                  );
                })}
              </div>
            </Card>
          )}

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {changeRequest.reviewed_at && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Revisión</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-neutral-500 text-sm">Revisada por</p>
                  <p className="text-white">{changeRequest.reviewed_by_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-neutral-500 text-sm">Fecha</p>
                  <p className="text-white">{formatDate(changeRequest.reviewed_at)}</p>
                </div>
                {changeRequest.review_notes && (
                  <div>
                    <p className="text-neutral-500 text-sm">Notas</p>
                    <p className="text-neutral-300">{changeRequest.review_notes}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Acciones Rápidas</h2>
            <div className="space-y-2">
              <Link href={`/${locale}/dashboard/cotizaciones/${quoteId}`} className="block">
                <Button variant="outline" className="w-full justify-start">Ver cotización actual</Button>
              </Link>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                isLoading={isDownloadingPdf}
                leftIcon={<DocumentArrowDownIcon className="h-4 w-4" />}
              >
                Descargar PDF de esta versión
              </Button>
            </div>
          </Card>

          {isPending && (
            <Card className="p-6 bg-cmyk-cyan/5 border-cmyk-cyan/20">
              <h3 className="font-semibold text-white mb-2">Cómo revisar</h3>
              <ul className="text-sm text-neutral-400 space-y-2">
                <li><strong className="text-yellow-400">Amarillo:</strong> Campos que el cliente modificó respecto al original.</li>
                <li><strong className="text-green-400">Verde:</strong> Servicios nuevos agregados por el cliente.</li>
                <li><strong className="text-red-400">Rojo:</strong> Servicios que el cliente desea eliminar.</li>
                <li className="pt-2 border-t border-neutral-700/50">
                  <strong className="text-green-400">Aprobar:</strong> La cotización volverá a borrador para que apliques los cambios.
                </li>
                <li><strong className="text-red-400">Rechazar:</strong> La cotización volverá a su estado anterior y el cliente será notificado.</li>
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {showReviewModal === 'approve' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
            </h3>
            <p className="text-neutral-300 mb-4">
              {showReviewModal === 'approve'
                ? 'Al aprobar, la cotización volverá a borrador para que puedas aplicar los cambios solicitados.'
                : 'El cliente será notificado de que su solicitud no fue aprobada.'}
            </p>
            <label className="block text-neutral-400 text-sm mb-2">
              Notas {showReviewModal === 'reject' ? '(recomendado)' : '(opcional)'}
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={showReviewModal === 'approve' ? 'Notas internas sobre la aprobación...' : 'Explica brevemente el motivo del rechazo...'}
              rows={3}
              className="w-full px-4 py-2 mb-4 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan resize-none"
            />
            <div className="flex gap-3">
              <Button onClick={() => { setShowReviewModal(null); setReviewNotes(''); }} variant="outline" className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={() => handleReview(showReviewModal)}
                disabled={isReviewing}
                isLoading={isReviewing}
                className={`flex-1 ${showReviewModal === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {showReviewModal === 'approve' ? 'Aprobar' : 'Rechazar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*                    HELPER FUNCTIONS                        */
/* ═══════════════════════════════════════════════════════════ */

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (['subtipo', 'tipo', 'tipo_anuncio', 'tipo_rotulacion', 'material',
    'uso', 'uso_diseno', 'tipo_impresion', 'servicio', 'producto'].includes(key)) {
    return subtipoLabels[value as string] || String(value);
  }
  if (key === 'distancia_metros' && typeof value === 'number') {
    return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${value.toFixed(0)} m`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DeliveryInfoBlock({
  deliveryMethod,
  deliveryAddress,
  pickupBranch,
  requiredDate,
  hasRouteDates,
}: {
  deliveryMethod?: string;
  deliveryAddress?: Record<string, string>;
  pickupBranch?: Record<string, string> | string;
  requiredDate?: string;
  hasRouteDates?: boolean | null;
}) {
  if (!deliveryMethod && !requiredDate) return null;
  const branchName = typeof pickupBranch === 'string' ? pickupBranch : pickupBranch?.name;

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {deliveryMethod && (
        <div className="p-3 bg-neutral-800/50 rounded-lg flex flex-col">
          <p className="text-neutral-500 text-xs mb-1">Método de entrega</p>
          <p className="text-white font-medium flex items-center gap-1 mt-auto">
            <span>{DELIVERY_METHOD_ICONS[deliveryMethod as DeliveryMethod] || '📦'}</span>
            {DELIVERY_METHOD_LABELS[deliveryMethod as DeliveryMethod]?.es || deliveryMethod}
          </p>
        </div>
      )}
      {branchName && (
        <div className="p-3 bg-neutral-800/50 rounded-lg flex flex-col">
          <p className="text-neutral-500 text-xs mb-1">Sucursal de recolección</p>
          <p className="text-white font-medium mt-auto">{branchName}</p>
        </div>
      )}
      {deliveryAddress && Object.keys(deliveryAddress).length > 0 && (
        <div className="p-3 bg-neutral-800/50 rounded-lg col-span-2 flex flex-col">
          <p className="text-neutral-500 text-xs mb-1">
            {deliveryMethod === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}
          </p>
          <p className="text-white font-medium mt-auto">
            {[
              deliveryAddress.street || deliveryAddress.calle,
              deliveryAddress.exterior_number || deliveryAddress.numero_exterior,
              deliveryAddress.neighborhood || deliveryAddress.colonia,
              deliveryAddress.city || deliveryAddress.ciudad,
              deliveryAddress.state || deliveryAddress.estado,
              deliveryAddress.postal_code || deliveryAddress.codigo_postal,
            ].filter(Boolean).join(', ')}
          </p>
        </div>
      )}
      {requiredDate && !hasRouteDates && (
        <div className="p-3 bg-neutral-800/50 rounded-lg flex flex-col">
          <p className="text-neutral-500 text-xs mb-1">Fecha requerida</p>
          <p className="text-white font-medium mt-auto">
            {new Date(requiredDate + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
      )}
    </div>
  );
}
