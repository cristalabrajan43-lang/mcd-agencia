'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
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
  CalendarIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { Card, Button, LoadingPage, Breadcrumb } from '@/components/ui';
import { ServiceDetailsDisplay } from '@/components/quotes';
import { SERVICE_LABELS, DELIVERY_METHOD_LABELS, DELIVERY_METHOD_ICONS, type ServiceId, type DeliveryMethod } from '@/lib/service-ids';
import {
  getQuoteById,
  getQuoteChangeRequests,
  downloadChangeRequestPdf,
  QuoteChangeRequest,
} from '@/lib/api/quotes';

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

export default function CustomerChangeRequestDetailPage() {
  const params = useParams();
  const locale = useLocale();

  const quoteId = params.id as string;
  const changeId = params.changeId as string;

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [expandedAddedServices, setExpandedAddedServices] = useState<Set<number>>(new Set());

  const toggleAddedService = (idx: number) => {
    setExpandedAddedServices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Fetch quote + change requests together
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-change-request', quoteId, changeId],
    queryFn: async () => {
      const quote = await getQuoteById(quoteId);
      if (!quote.token) throw new Error('No token');
      const crData = await getQuoteChangeRequests(quote.token);
      const changeRequest = crData.change_requests?.find((cr: QuoteChangeRequest) => cr.id === changeId);
      if (!changeRequest) throw new Error('Change request not found');
      return { quote, changeRequest };
    },
  });

  const quote = data?.quote ?? null;
  const changeRequest = data?.changeRequest ?? null;

  const handleDownloadPdf = async () => {
    if (!changeRequest) return;
    setIsDownloadingPdf(true);
    try {
      const blob = await downloadChangeRequestPdf(changeRequest.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizacion_${changeRequest.quote_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF descargado');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Error al descargar el PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Number(amount) || 0);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'add':
        return <PlusIcon className="h-4 w-4 text-green-400" />;
      case 'delete':
        return <TrashIcon className="h-4 w-4 text-red-400" />;
      case 'modify':
        return <PencilIcon className="h-4 w-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'add':
        return 'Agregar';
      case 'delete':
        return 'Eliminar';
      case 'modify':
        return 'Modificar';
      default:
        return action;
    }
  };

  if (isLoading) {
    return <LoadingPage message="Cargando solicitud de cambios..." />;
  }

  if (error || !changeRequest || !quote) {
    return (
      <div className="text-center py-12">
        <ChatBubbleLeftRightIcon className="h-16 w-16 text-neutral-700 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-4">Solicitud no encontrada</h2>
        <Link href={`/${locale}/mi-cuenta/cotizaciones/${quoteId}`}>
          <Button>Volver a la cotización</Button>
        </Link>
      </div>
    );
  }

  const originalLines = changeRequest.original_snapshot.lines || [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Mi Cuenta', href: '/mi-cuenta' },
          { label: 'Cotizaciones', href: '/mi-cuenta/cotizaciones' },
          { label: `#${quote.quote_number}`, href: `/mi-cuenta/cotizaciones/${quoteId}` },
          { label: 'Solicitud de cambios' },
        ]}
        showHome={false}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/${locale}/mi-cuenta/cotizaciones/${quoteId}`}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Solicitud de Cambios</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusColors[changeRequest.status]}`}>
                {changeRequest.status === 'pending' && <ClockIcon className="h-4 w-4" />}
                {changeRequest.status === 'approved' && <CheckCircleIcon className="h-4 w-4" />}
                {changeRequest.status === 'rejected' && <XCircleIcon className="h-4 w-4" />}
                {statusLabels[changeRequest.status]}
              </span>
            </div>
            <p className="text-neutral-400 mt-1">
              Para cotización #{changeRequest.quote_number} · Enviada el {formatDate(changeRequest.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Status Banners */}
      {changeRequest.status === 'pending' && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
          <ClockIcon className="h-6 w-6 text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-yellow-400 font-medium">Pendiente de revisión</p>
            <p className="text-neutral-400 text-sm">
              Tu solicitud de cambios está siendo revisada por el equipo de ventas. Te notificaremos cuando haya una respuesta.
            </p>
          </div>
        </div>
      )}

      {changeRequest.status === 'approved' && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
          <CheckCircleIcon className="h-6 w-6 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-green-400 font-medium">Cambios aprobados</p>
            <p className="text-neutral-400 text-sm">
              Tus cambios fueron aprobados. Recibirás una cotización actualizada pronto.
            </p>
          </div>
        </div>
      )}

      {changeRequest.status === 'rejected' && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <XCircleIcon className="h-6 w-6 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-red-400 font-medium">Cambios rechazados</p>
            <p className="text-neutral-400 text-sm">
              Tu solicitud de cambios no fue aprobada.
              {changeRequest.review_notes && (
                <> Motivo: &ldquo;{changeRequest.review_notes}&rdquo;</>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Proposed Changes */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Cambios Solicitados</h2>

            {/* Summary */}
            <div className="flex flex-wrap gap-3 mb-6">
              {changeRequest.changes_summary.added > 0 && (
                <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm">
                  +{changeRequest.changes_summary.added} agregado(s)
                </span>
              )}
              {changeRequest.changes_summary.modified > 0 && (
                <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm">
                  {changeRequest.changes_summary.modified} modificado(s)
                </span>
              )}
              {changeRequest.changes_summary.deleted > 0 && (
                <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm">
                  -{changeRequest.changes_summary.deleted} eliminado(s)
                </span>
              )}
            </div>

            {/* Changes List */}
            <div className="space-y-4">
              {changeRequest.proposed_lines.map((line, index) => {
                const originalLine = line.id
                  ? originalLines.find((ol) => ol.id === line.id)
                  : null;

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      line.action === 'add'
                        ? 'bg-green-500/10 border-green-500/30'
                        : line.action === 'delete'
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-yellow-500/10 border-yellow-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded bg-neutral-800">
                        {getActionIcon(line.action)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            line.action === 'add'
                              ? 'bg-green-500/30 text-green-400'
                              : line.action === 'delete'
                              ? 'bg-red-500/30 text-red-400'
                              : 'bg-yellow-500/30 text-yellow-400'
                          }`}>
                            {getActionLabel(line.action)}
                          </span>
                        </div>

                        {line.action === 'add' ? (() => {
                            const sd = line.service_details as Record<string, unknown> | undefined;
                            const serviceType = sd?.service_type as string | undefined;
                            const svcLabel = serviceType
                              ? (SERVICE_LABELS[serviceType as ServiceId] || serviceType)
                              : line.concept;
                            const isOpen = expandedAddedServices.has(index);
                            const deliveryMethod = sd?.delivery_method as string | undefined;
                            const requiredDate = sd?.required_date as string | undefined;
                            const deliveryAddress = sd?.delivery_address as Record<string, string> | undefined;
                            const pickupBranch = sd?.pickup_branch_detail as Record<string, string> | undefined;
                            const hasRouteDates = sd && Array.isArray(sd.rutas) &&
                              (sd.rutas as Array<Record<string, unknown>>).some(r => !!r.fecha_inicio);
                            const routeCount = sd && Array.isArray(sd.rutas) ? (sd.rutas as unknown[]).length : 0;

                            return (
                              <div className="w-full">
                                {/* Accordion-style service display */}
                                <div className="rounded-lg border border-neutral-700/50 overflow-hidden mt-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleAddedService(index)}
                                    className="w-full flex items-center gap-3 p-4 bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
                                  >
                                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-500/20 text-green-400 text-sm font-bold flex-shrink-0">
                                      <PlusIcon className="h-4 w-4" />
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-white font-semibold text-sm truncate">
                                          {svcLabel}
                                          {routeCount > 1 && (
                                            <span className="ml-2 text-xs font-normal text-neutral-400">({routeCount} rutas)</span>
                                          )}
                                        </p>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/30">
                                          <UserIcon className="h-3 w-3" />
                                          Agregado por el cliente
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                        <span className="text-neutral-400 text-xs">
                                          {line.quantity} {line.unit}
                                        </span>
                                        {deliveryMethod && (
                                          <span className="text-neutral-500 text-xs flex items-center gap-1">
                                            <span className="text-xs">{DELIVERY_METHOD_ICONS[deliveryMethod as DeliveryMethod]}</span>
                                            {DELIVERY_METHOD_LABELS[deliveryMethod as DeliveryMethod]?.es || deliveryMethod}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <ChevronDownIcon className={`h-5 w-5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                  </button>

                                  {isOpen && (
                                    <div className="p-4 border-t border-neutral-700 space-y-3">
                                      {line.concept && serviceType && line.concept !== svcLabel && (
                                        <div>
                                          <p className="text-white font-medium">{line.concept}</p>
                                        </div>
                                      )}
                                      {line.description && (
                                        <div className="p-4 bg-neutral-800/50 rounded-lg">
                                          <p className="text-neutral-500 text-xs mb-2">Comentarios del cliente</p>
                                          <p className="text-white whitespace-pre-wrap">{line.description}</p>
                                        </div>
                                      )}

                                      {/* Service-specific parameters */}
                                      {sd && Object.keys(sd).length > 0 && serviceType && (
                                        <div>
                                          <ServiceDetailsDisplay
                                            serviceType={serviceType}
                                            serviceDetails={sd}
                                          />
                                        </div>
                                      )}

                                      {/* Delivery Method */}
                                      {deliveryMethod && (
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                          <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                            <p className="text-neutral-500 text-xs mb-1">Método de entrega</p>
                                            <p className="text-white font-medium flex items-center gap-1 mt-auto">
                                              <span>{DELIVERY_METHOD_ICONS[deliveryMethod as DeliveryMethod]}</span>
                                              {DELIVERY_METHOD_LABELS[deliveryMethod as DeliveryMethod]?.es || deliveryMethod}
                                            </p>
                                          </div>
                                          {pickupBranch && (
                                            <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                              <p className="text-neutral-500 text-xs mb-1">Sucursal de recolección</p>
                                              <p className="text-white font-medium mt-auto">{pickupBranch.name}</p>
                                            </div>
                                          )}
                                          {deliveryAddress && Object.keys(deliveryAddress).length > 0 && (
                                            <div className="p-3 bg-neutral-900/50 rounded-lg col-span-2 flex flex-col">
                                              <p className="text-neutral-500 text-xs mb-1">
                                                {deliveryMethod === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}
                                              </p>
                                              <p className="text-white font-medium mt-auto">
                                                {[deliveryAddress.street || deliveryAddress.calle, deliveryAddress.exterior_number || deliveryAddress.numero_exterior, deliveryAddress.neighborhood || deliveryAddress.colonia, deliveryAddress.city || deliveryAddress.ciudad, deliveryAddress.state || deliveryAddress.estado, deliveryAddress.postal_code || deliveryAddress.codigo_postal].filter(Boolean).join(', ')}
                                              </p>
                                            </div>
                                          )}
                                          {requiredDate && !hasRouteDates && (
                                            <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                              <p className="text-neutral-500 text-xs mb-1">Fecha requerida</p>
                                              <p className="text-white font-medium mt-auto">
                                                {new Date(requiredDate + 'T12:00:00').toLocaleDateString('es-MX', {
                                                  year: 'numeric', month: 'short', day: 'numeric',
                                                })}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Required Date (when no delivery method) */}
                                      {!deliveryMethod && requiredDate && !hasRouteDates && (
                                        <div className="p-3 bg-neutral-900/50 rounded-lg flex items-center gap-3">
                                          <CalendarIcon className="h-5 w-5 text-neutral-400" />
                                          <div>
                                            <p className="text-neutral-500 text-xs">Fecha Requerida</p>
                                            <p className="text-white">
                                              {new Date(requiredDate + 'T12:00:00').toLocaleDateString('es-MX', {
                                                year: 'numeric', month: 'long', day: 'numeric',
                                              })}
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })() : line.action === 'delete' ? (
                          <div>
                            <p className="text-white font-medium line-through">
                              {originalLine?.concept}
                            </p>
                            {originalLine?.description && (
                              <p className="text-neutral-400 text-sm line-through">
                                {originalLine.description}
                              </p>
                            )}
                            <p className="text-neutral-500 text-sm mt-1">
                              {originalLine?.quantity} {originalLine?.unit} x{' '}
                              {formatCurrency(originalLine?.unit_price || 0)}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-white font-medium">{originalLine?.concept}</p>

                            {/* Show what changed */}
                            <div className="mt-2 space-y-1">
                              {line.quantity !== undefined &&
                                String(line.quantity) !== originalLine?.quantity && (
                                  <div className="text-sm">
                                    <span className="text-neutral-500">Cantidad: </span>
                                    <span className="text-red-400 line-through">
                                      {originalLine?.quantity}
                                    </span>
                                    <span className="text-neutral-500 mx-1">→</span>
                                    <span className="text-green-400">{line.quantity}</span>
                                  </div>
                                )}

                              {line.description !== undefined &&
                                line.description !== originalLine?.description && (
                                  <div className="text-sm mt-1">
                                    <span className="text-yellow-500 font-medium">Cambios solicitados:</span>
                                    {line.description && (
                                      <p className="text-yellow-400 text-sm mt-0.5 whitespace-pre-line p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                                        {line.description}
                                      </p>
                                    )}
                                    {originalLine?.description && (
                                      <details className="mt-1">
                                        <summary className="text-neutral-500 text-xs cursor-pointer hover:text-neutral-400">
                                          Ver descripción original
                                        </summary>
                                        <p className="text-neutral-500 text-xs mt-1 whitespace-pre-line">
                                          {originalLine.description}
                                        </p>
                                      </details>
                                    )}
                                  </div>
                                )}

                              {/* Service details modified */}
                              {line.service_details && Object.keys(line.service_details).length > 0 && (() => {
                                const sd = line.service_details as Record<string, unknown>;
                                const deliveryMethod = sd.delivery_method as string | undefined;
                                const deliveryAddress = sd.delivery_address as Record<string, string> | undefined;
                                const pickupBranch = sd.pickup_branch as string | undefined;
                                const requiredDate = sd.required_date as string | undefined;
                                const serviceType = String(sd.service_type || originalLine?.service_type || '');

                                return (
                                  <div className="mt-3 pt-3 border-t border-yellow-500/20">
                                    <p className="text-xs text-yellow-500 font-medium mb-2">Detalle del servicio (modificado):</p>
                                    <ServiceDetailsDisplay
                                      serviceType={serviceType}
                                      serviceDetails={sd}
                                    />

                                    {/* Delivery method & address (rendered properly instead of raw values) */}
                                    {(deliveryMethod || requiredDate) && (
                                      <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                                        {deliveryMethod && (
                                          <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                            <p className="text-neutral-500 text-xs mb-1">Método de entrega</p>
                                            <p className="text-white font-medium flex items-center gap-1 mt-auto">
                                              <span>{DELIVERY_METHOD_ICONS[deliveryMethod as DeliveryMethod] || '📦'}</span>
                                              {DELIVERY_METHOD_LABELS[deliveryMethod as DeliveryMethod]?.es || deliveryMethod}
                                            </p>
                                          </div>
                                        )}
                                        {deliveryMethod === 'pickup' && pickupBranch && (
                                          <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                            <p className="text-neutral-500 text-xs mb-1">Sucursal</p>
                                            <p className="text-white font-medium mt-auto">{pickupBranch}</p>
                                          </div>
                                        )}
                                        {(deliveryMethod === 'installation' || deliveryMethod === 'shipping') && deliveryAddress && Object.keys(deliveryAddress).length > 0 && (
                                          <div className="p-3 bg-neutral-900/50 rounded-lg col-span-2 flex flex-col">
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
                                        {requiredDate && (
                                          <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                            <p className="text-neutral-500 text-xs mb-1">Fecha requerida</p>
                                            <p className="text-white font-medium mt-auto">
                                              {new Date(requiredDate + 'T12:00:00').toLocaleDateString('es-MX', {
                                                year: 'numeric', month: 'short', day: 'numeric',
                                              })}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {originalLine?.service_details && Object.keys(originalLine.service_details).length > 0 && (
                                      <details className="mt-2">
                                        <summary className="text-neutral-500 text-xs cursor-pointer hover:text-neutral-400">
                                          Ver detalle de servicio original
                                        </summary>
                                        <div className="mt-2 p-3 bg-neutral-900/50 rounded-lg border border-neutral-700/50">
                                          <ServiceDetailsDisplay
                                            serviceType={originalLine.service_type || ''}
                                            serviceDetails={originalLine.service_details}
                                          />
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Customer Comments */}
          {changeRequest.customer_comments && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-cmyk-cyan" />
                Tus Comentarios
              </h2>
              <p className="text-neutral-300 whitespace-pre-wrap">
                {changeRequest.customer_comments}
              </p>
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
                Tus Archivos Adjuntos ({changeRequest.attachments.length})
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
                          <img
                            src={attachment.file}
                            alt={attachment.filename}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square flex flex-col items-center justify-center p-3">
                          <PhotoIcon className="h-8 w-8 text-cmyk-cyan/60 mb-1" />
                          <span className="text-[10px] text-cmyk-cyan/60 text-center truncate w-full">
                            {attachment.filename}
                          </span>
                        </div>
                      )}
                      <div className="p-2 border-t border-cmyk-cyan/30">
                        <p className="text-xs text-cmyk-cyan truncate" title={attachment.filename}>
                          {attachment.filename}
                        </p>
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

          {/* Original Quote Snapshot */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Cotización Original (Antes de los cambios)
            </h2>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-neutral-500 text-sm border-b border-neutral-700">
                    <th className="pb-3 pr-4">Concepto</th>
                    <th className="pb-3 pr-4 text-right">Cant.</th>
                    <th className="pb-3 pr-4 text-right">P. Unit.</th>
                    <th className="pb-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {originalLines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-3 pr-4">
                        <p className="text-white font-medium">{line.concept}</p>
                        {line.description && (
                          <p className="text-neutral-500 text-sm">{line.description}</p>
                        )}
                        {line.service_details && Object.keys(line.service_details).length > 0 && (
                          <details className="mt-1">
                            <summary className="text-neutral-500 text-xs cursor-pointer hover:text-neutral-400">
                              Ver detalle de servicio
                            </summary>
                            <div className="mt-2">
                              <ServiceDetailsDisplay
                                serviceType={line.service_type || ''}
                                serviceDetails={line.service_details}
                              />
                            </div>
                          </details>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right text-white">{line.quantity}</td>
                      <td className="py-3 pr-4 text-right text-white">
                        {formatCurrency(line.unit_price)}
                      </td>
                      <td className="py-3 text-right text-white font-medium">
                        {formatCurrency(line.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-2">
              {originalLines.map((line) => (
                <div key={line.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{line.concept}</p>
                      {line.description && (
                        <p className="text-neutral-500 text-xs line-clamp-2">{line.description}</p>
                      )}
                    </div>
                    <p className="text-white font-medium text-sm">{formatCurrency(line.line_total)}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-neutral-500">Cantidad</p>
                      <p className="text-white">{line.quantity}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">P. Unit.</p>
                      <p className="text-white">{formatCurrency(line.unit_price)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-700 text-right">
              <span className="text-neutral-400">Total original: </span>
              <span className="text-white font-bold">
                {formatCurrency(changeRequest.original_snapshot.total)}
              </span>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Review Info */}
          {changeRequest.reviewed_at && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Revisión</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-neutral-500 text-sm">Revisada por</p>
                  <p className="text-white">{changeRequest.reviewed_by_name || 'Equipo de ventas'}</p>
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

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Acciones</h2>
            <div className="space-y-2">
              <Link
                href={`/${locale}/mi-cuenta/cotizaciones/${quoteId}`}
                className="block"
              >
                <Button variant="outline" className="w-full justify-start">
                  Ver cotización actual
                </Button>
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

          {/* Info Card */}
          {changeRequest.status === 'pending' && (
            <Card className="p-6 bg-cmyk-cyan/5 border-cmyk-cyan/20">
              <h3 className="font-semibold text-white mb-2">¿Qué sigue?</h3>
              <p className="text-neutral-400 text-sm">
                El equipo de ventas está revisando tu solicitud. Una vez aprobada, recibirás una cotización actualizada con los cambios solicitados por correo electrónico.
              </p>
            </Card>
          )}

          {/* Contact */}
          <Card className="p-6 bg-cmyk-cyan/5 border-cmyk-cyan/20">
            <h3 className="font-semibold text-white mb-2">¿Tienes preguntas?</h3>
            <p className="text-neutral-400 text-sm mb-4">
              Contáctanos para cualquier duda sobre esta solicitud.
            </p>
            <a
              href="mailto:ventas@mcd-agencia.com"
              className="text-cmyk-cyan hover:underline text-sm"
            >
              ventas@mcd-agencia.com
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}
