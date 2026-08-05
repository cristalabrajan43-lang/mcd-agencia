'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  ArrowLeftIcon,
  PencilIcon,
  PaperAirplaneIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PrinterIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  ShoppingCartIcon,
  ArrowPathIcon,
  ChatBubbleLeftIcon,
  UserIcon,
  PencilSquareIcon,
  PaperClipIcon,
  CalendarIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  MapPinIcon,
  ChevronDownIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, LoadingPage, SuccessModal } from '@/components/ui';
import { SendConfirmationModal } from '@/components/quotes/SendConfirmationModal';
import {
  getAdminQuoteById,
  sendQuote,
  resendQuoteEmail,
  deleteQuote,
  duplicateQuote,
  downloadQuotePdf,
  regenerateQuotePdf,
  fixDeliveryData,
  getQuoteResponses,
  getAdminChangeRequests,
  updateQuoteInternalNotes,
  Quote,
  QuoteLine,
  QuoteStatus,
  QuoteResponse,
  QuoteChangeRequest,
  ChangeRequestStatus,
} from '@/lib/api/quotes';
import { convertQuoteToOrder } from '@/lib/api/orders';
import { SERVICE_LABELS, type ServiceId, DELIVERY_METHOD_LABELS, DELIVERY_METHOD_ICONS, type DeliveryMethod } from '@/lib/service-ids';
import { ServiceDetailsDisplay } from '@/components/quotes/ServiceDetailsDisplay';
import { getDefaultQuoteConversionPaymentMethod, getPaymentMethodLabel } from '@/lib/workflow';

const statusColors: Record<QuoteStatus, string> = {
  draft: 'bg-neutral-500/20 text-neutral-400 border-neutral-500',
  sent: 'bg-cmyk-cyan/20 text-cmyk-cyan border-cmyk-cyan',
  viewed: 'bg-purple-500/20 text-purple-400 border-purple-500',
  accepted: 'bg-green-500/20 text-green-400 border-green-500',
  rejected: 'bg-red-500/20 text-red-400 border-red-500',
  expired: 'bg-cmyk-yellow/20 text-cmyk-yellow border-cmyk-yellow',
  changes_requested: 'bg-orange-500/20 text-orange-400 border-orange-500',
  converted: 'bg-blue-500/20 text-blue-400 border-blue-500',
};

const statusLabels: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  viewed: 'Vista',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  expired: 'Expirada',
  changes_requested: 'Cambios Solicitados',
  converted: 'Convertida a Pedido',
};

const statusIcons: Record<QuoteStatus, React.ComponentType<{ className?: string }>> = {
  draft: PencilIcon,
  sent: PaperAirplaneIcon,
  viewed: EyeIcon,
  accepted: CheckCircleIcon,
  rejected: XCircleIcon,
  expired: ClockIcon,
  changes_requested: PencilIcon,
  converted: ShoppingCartIcon,
};

const changeRequestStatusColors: Record<ChangeRequestStatus, string> = {
  pending: 'bg-orange-500/20 text-orange-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

const changeRequestStatusLabels: Record<ChangeRequestStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const responseActionLabels: Record<string, string> = {
  view: 'Vista',
  approval: 'Cotización aceptada',
  rejection: 'Cotización rechazada',
  change_request: 'Solicitud de cambio',
  comment: 'Comentario',
  send: 'Cotización enviada',
};

const responseActionColors: Record<string, string> = {
  view: 'text-purple-400',
  approval: 'text-green-400',
  rejection: 'text-red-400',
  change_request: 'text-orange-400',
  comment: 'text-blue-400',
  send: 'text-cmyk-cyan',
};

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isRegeneratingPdf, setIsRegeneratingPdf] = useState(false);
  const [isFixingDelivery, setIsFixingDelivery] = useState(false);
  const [editingShippingCosts, setEditingShippingCosts] = useState(false);
  const [shippingInputs, setShippingInputs] = useState<Record<number, string>>({});
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [responses, setResponses] = useState<QuoteResponse[]>([]);
  const [changeRequests, setChangeRequests] = useState<QuoteChangeRequest[]>([]);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [conversionPaymentMethod, setConversionPaymentMethod] = useState<'mercadopago' | 'paypal' | 'bank_transfer' | 'cash'>('bank_transfer');

  const toggleService = (key: string) => {
    setExpandedServices(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const quoteId = params.id as string;
  const isSalesOrAdmin = user?.role?.name && ['admin', 'sales'].includes(user.role.name);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/cotizaciones/${quoteId}`);
      } else if (!isSalesOrAdmin) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, isSalesOrAdmin, router, locale, quoteId]);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!quoteId || !isAuthenticated || !isSalesOrAdmin) return;

      setIsLoading(true);
      try {
        const [data, responsesData, crData] = await Promise.all([
          getAdminQuoteById(quoteId),
          getQuoteResponses(quoteId).catch(() => []),
          getAdminChangeRequests({ quote: quoteId }).catch(() => ({ results: [] })),
        ]);
        setQuote(data);
        setResponses(responsesData);
        setChangeRequests((crData as { results: QuoteChangeRequest[] }).results || []);
      } catch (error) {
        console.error('Error fetching quote:', error);
        toast.error('Error al cargar la cotizacion');
        router.push(`/${locale}/dashboard/cotizaciones`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuote();
  }, [quoteId, isAuthenticated, isSalesOrAdmin, router, locale]);

  useEffect(() => {
    if (quote) {
      setConversionPaymentMethod(getDefaultQuoteConversionPaymentMethod(quote.payment_methods));
    }
  }, [quote]);

  // -- Modal state --
  const [modal, setModal] = useState<{ open: boolean; title: string; message: string; variant: 'success' | 'error'; redirectTo?: string }>({ open: false, title: '', message: '', variant: 'success' });

  const handleSendQuote = async () => {
    if (!quote) return;

    setIsSending(true);
    try {
      const updated = await sendQuote(quote.id) as Quote & { email_sent?: boolean; email_error?: string };
      setQuote(updated);
      if (updated.email_sent === false) {
        setModal({
          open: true,
          title: 'Cotización guardada, pero el correo no se envió',
          message: `La cotización se marcó como enviada, pero no se pudo enviar el correo a ${quote.customer_email}. Puedes reintentar el envío del correo.\n\nError: ${updated.email_error || 'Error desconocido'}`,
          variant: 'error',
        });
      } else {
        setModal({ open: true, title: 'Cotización enviada', message: `La cotización se envió al cliente (${quote.customer_email}).`, variant: 'success' });
      }
    } catch (error) {
      console.error('Error sending quote:', error);
      setModal({ open: true, title: 'Error', message: 'No se pudo enviar la cotización.', variant: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const handleResendEmail = async () => {
    if (!quote) return;
    setIsSending(true);
    try {
      const result = await resendQuoteEmail(quote.id);
      if (result.email_sent) {
        toast.success(`Correo reenviado a ${quote.customer_email}`);
      } else {
        toast.error(`No se pudo reenviar: ${result.email_error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error resending email:', error);
      toast.error('Error al reenviar el correo');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteQuote = async () => {
    if (!quote) return;

    if (!confirm('¿Estas seguro de eliminar esta cotizacion? Esta accion no se puede deshacer.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteQuote(quote.id);
      setModal({ open: true, title: 'Cotización eliminada', message: 'La cotización fue eliminada.', variant: 'success', redirectTo: `/${locale}/dashboard/cotizaciones` });
    } catch (error) {
      console.error('Error deleting quote:', error);
      setModal({ open: true, title: 'Error', message: 'No se pudo eliminar la cotización.', variant: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicateQuote = async () => {
    if (!quote) return;

    setIsDuplicating(true);
    try {
      const newQuote = await duplicateQuote(quote.id);
      setModal({ open: true, title: 'Cotización duplicada', message: 'Se creó una copia de la cotización.', variant: 'success', redirectTo: `/${locale}/dashboard/cotizaciones/${newQuote.id}` });
    } catch (error) {
      console.error('Error duplicating quote:', error);
      setModal({ open: true, title: 'Error', message: 'No se pudo duplicar la cotización.', variant: 'error' });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleConvertToOrder = async () => {
    if (!quote) return;

    if (!confirm('¿Convertir esta cotización en un pedido? Se creará un pedido nuevo con los conceptos de la cotización.')) {
      return;
    }

    setIsConverting(true);
    try {
      const result = await convertQuoteToOrder(quote.id, { payment_method: conversionPaymentMethod });
      const order = result.order;
      setModal({ open: true, title: 'Pedido creado', message: 'El pedido fue creado exitosamente a partir de la cotización.', variant: 'success', redirectTo: `/${locale}/dashboard/pedidos/${order.id}` });
    } catch (error: unknown) {
      console.error('Error converting quote:', error);
      const errMsg = error && typeof error === 'object' && 'message' in error 
        ? (error as { message: string }).message 
        : 'Error al convertir la cotización en pedido';
      setModal({ open: true, title: 'Error', message: errMsg, variant: 'error' });
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!quote) return;
    setIsDownloadingPdf(true);
    try {
      const blob = await downloadQuotePdf(quote.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizacion_${quote.quote_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      setModal({ open: true, title: 'Error al descargar PDF', message: msg, variant: 'error' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleRegeneratePdf = async () => {
    if (!quote) return;
    setIsRegeneratingPdf(true);
    try {
      await regenerateQuotePdf(quote.id);
      // Refresh quote data so pdf_file is updated
      const updated = await getAdminQuoteById(quote.id);
      setQuote(updated);
      toast.success('PDF regenerado exitosamente');
    } catch (error) {
      console.error('Error regenerating PDF:', error);
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      setModal({ open: true, title: 'Error al regenerar PDF', message: msg, variant: 'error' });
    } finally {
      setIsRegeneratingPdf(false);
    }
  };

  const handleFixDeliveryData = async (withShippingCosts = false) => {
    if (!quote) return;
    setIsFixingDelivery(true);
    try {
      const payload: { shipping_costs?: Record<string, string>; regenerate_pdf: boolean } = { regenerate_pdf: true };
      if (withShippingCosts && Object.keys(shippingInputs).length > 0) {
        payload.shipping_costs = {};
        for (const [pos, val] of Object.entries(shippingInputs)) {
          if (val && parseFloat(val) >= 0) {
            payload.shipping_costs[pos] = val;
          }
        }
      }
      const result = await fixDeliveryData(quote.id, payload);
      // Refresh quote data
      const updated = await getAdminQuoteById(quote.id);
      setQuote(updated);
      setEditingShippingCosts(false);
      setShippingInputs({});
      if (result.lines_updated > 0) {
        toast.success(`Datos restaurados (${result.lines_updated} línea(s)). PDF regenerado.`);
      } else {
        toast.success('No se encontraron datos faltantes para restaurar.');
      }
    } catch (error) {
      console.error('Error fixing delivery data:', error);
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      setModal({ open: true, title: 'Error al restaurar datos de entrega', message: msg, variant: 'error' });
    } finally {
      setIsFixingDelivery(false);
    }
  };

  const handleStartEditShipping = () => {
    if (!quote) return;
    const initial: Record<number, string> = {};
    for (const line of quote.lines || []) {
      initial[line.position] = line.shipping_cost || '0';
    }
    setShippingInputs(initial);
    setEditingShippingCosts(true);
  };

  const handleSaveNotes = async () => {
    if (!quote) return;
    setIsSavingNotes(true);
    try {
      const updated = await updateQuoteInternalNotes(quote.id, editedNotes);
      setQuote(updated);
      setIsEditingNotes(false);
      toast.success('Notas actualizadas');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Error al guardar las notas');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleDeleteNotes = async () => {
    if (!quote) return;
    if (!confirm('¿Eliminar las notas internas?')) return;
    setIsSavingNotes(true);
    try {
      const updated = await updateQuoteInternalNotes(quote.id, '');
      setQuote(updated);
      setIsEditingNotes(false);
      toast.success('Notas eliminadas');
    } catch (error) {
      console.error('Error deleting notes:', error);
      toast.error('Error al eliminar las notas');
    } finally {
      setIsSavingNotes(false);
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
    return new Date(dateString).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ── Group quote lines by service ──
  // Must be above early returns to respect React Rules of Hooks.
  interface LineGroup { serviceType?: string; lines: QuoteLine[] }
  const lineGroups = useMemo<LineGroup[]>(() => {
    if (!quote?.lines) return [];
    const groups: LineGroup[] = [];
    for (const line of quote.lines) {
      const sd = line.service_details as Record<string, unknown> | undefined;
      const lineServiceType = sd?.service_type as string | undefined;
      if (lineServiceType) {
        groups.push({ serviceType: lineServiceType, lines: [line] });
      } else if (groups.length > 0 && groups[groups.length - 1].serviceType) {
        const prevGroup = groups[groups.length - 1];
        const prevConcept = prevGroup.lines[0].concept;
        const baseConcept = prevConcept.split(' — Ruta ')[0];
        if (line.concept.startsWith(baseConcept + ' — Ruta')) {
          prevGroup.lines.push(line);
        } else {
          groups.push({ serviceType: undefined, lines: [line] });
        }
      } else {
        groups.push({ serviceType: undefined, lines: [line] });
      }
    }
    return groups;
  }, [quote]);

  // ── Map each request service (by index) → matched quote line group ──
  const serviceToLinesMap = useMemo<Map<number, QuoteLine[]>>(() => {
    const map = new Map<number, QuoteLine[]>();
    if (!quote?.quote_request) return map;

    const requestServices = quote.quote_request.services;
    if (requestServices && requestServices.length > 0) {
      // Track which groups have been assigned
      const assignedGroups = new Set<number>();
      for (let svcIdx = 0; svcIdx < requestServices.length; svcIdx++) {
        const svc = requestServices[svcIdx];
        for (let gIdx = 0; gIdx < lineGroups.length; gIdx++) {
          if (!assignedGroups.has(gIdx) && lineGroups[gIdx].serviceType === svc.service_type) {
            assignedGroups.add(gIdx);
            map.set(svcIdx, lineGroups[gIdx].lines);
            break;
          }
        }
      }
    } else if (quote.quote_request.service_type) {
      // Single-service: match first group with same service_type → index 0
      for (const group of lineGroups) {
        if (group.serviceType === quote.quote_request.service_type) {
          map.set(0, group.lines);
          break;
        }
      }
    }
    return map;
  }, [quote, lineGroups]);

  // ── Identify vendor-added lines (not from the original request) ──
  const vendorAddedLines = useMemo<QuoteLine[]>(() => {
    if (!quote || !quote.quote_request || !quote.lines) return [];

    const requestServices = quote.quote_request.services;
    const hasCatalogItem = !!quote.quote_request.catalog_item;
    const requestServiceType = quote.quote_request.service_type;

    if (requestServices && requestServices.length > 0) {
      const requestTypeCounts = new Map<string, number>();
      for (const svc of requestServices) {
        requestTypeCounts.set(svc.service_type, (requestTypeCounts.get(svc.service_type) || 0) + 1);
      }
      const remainingCounts = new Map(requestTypeCounts);
      const vendorLines: QuoteLine[] = [];
      for (const group of lineGroups) {
        if (group.serviceType && remainingCounts.has(group.serviceType) && (remainingCounts.get(group.serviceType)! > 0)) {
          remainingCounts.set(group.serviceType, remainingCounts.get(group.serviceType)! - 1);
        } else {
          vendorLines.push(...group.lines);
        }
      }
      return vendorLines;
    }

    if (requestServiceType) {
      let matched = false;
      const vendorLines: QuoteLine[] = [];
      for (const group of lineGroups) {
        if (!matched && group.serviceType === requestServiceType) {
          matched = true;
        } else {
          vendorLines.push(...group.lines);
        }
      }
      return vendorLines;
    }

    if (hasCatalogItem) {
      return quote.lines.slice(1);
    }

    return [];
  }, [quote, lineGroups]);

  // ── Group vendor-added lines by service type (so multi-route services are grouped) ──
  const vendorLineGroups = useMemo<{ serviceType: string | undefined; lines: QuoteLine[] }[]>(() => {
    if (vendorAddedLines.length === 0) return [];
    const groups: { serviceType: string | undefined; lines: QuoteLine[] }[] = [];
    for (const line of vendorAddedLines) {
      const sd = line.service_details as Record<string, unknown> | undefined;
      const lineServiceType = sd?.service_type as string | undefined;
      if (lineServiceType) {
        const lastGroup = groups.length > 0 ? groups[groups.length - 1] : null;
        if (lastGroup && lastGroup.serviceType === lineServiceType) {
          lastGroup.lines.push(line);
        } else {
          groups.push({ serviceType: lineServiceType, lines: [line] });
        }
      } else {
        groups.push({ serviceType: undefined, lines: [line] });
      }
    }
    return groups;
  }, [vendorAddedLines]);

  if (authLoading || isLoading) {
    return <LoadingPage message="Cargando cotizacion..." />;
  }

  if (!isAuthenticated || !isSalesOrAdmin || !quote) {
    return null;
  }

  const StatusIcon = statusIcons[quote.status];

  return (
    <div className="max-w-6xl">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/dashboard/cotizaciones`}
              className="p-2 text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{quote.quote_number}</h1>
                {quote.version > 1 && (
                  <span className="bg-purple-500/20 text-purple-400 text-xs font-bold px-2 py-1 rounded-full border border-purple-500/30">
                    v{quote.version}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusColors[quote.status]}`}>
                  <StatusIcon className="h-4 w-4" />
                  {statusLabels[quote.status]}
                </span>
              </div>
              <p className="text-neutral-400 mt-1">
                Creada el {formatDate(quote.created_at)}
                {quote.created_by_name && ` por ${quote.created_by_name}`}
              </p>
            </div>
          </div>


        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="xl:col-span-2 space-y-6">
            {/* Customer Info */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Datos del Cliente</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-neutral-500 text-sm">Nombre</p>
                  <p className="text-white font-medium">{quote.customer_name}</p>
                </div>
                <div>
                  <p className="text-neutral-500 text-sm">Email</p>
                  <p className="text-white">{quote.customer_email}</p>
                </div>
                {quote.customer_company && (
                  <div>
                    <p className="text-neutral-500 text-sm">Empresa</p>
                    <p className="text-white">{quote.customer_company}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Line Items */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Conceptos</h2>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-neutral-500 text-sm border-b border-neutral-700">
                      <th className="pb-3 pr-4">Concepto</th>
                      <th className="pb-3 pr-4 text-right">Cant.</th>
                      <th className="pb-3 pr-4">Unidad</th>
                      <th className="pb-3 pr-4 text-right">P. Unit.</th>
                      <th className="pb-3 pr-4 text-right">Envío</th>
                      <th className="pb-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {quote.lines?.map((line, index) => (
                      <tr key={line.id || index}>
                        <td className="py-3 pr-4">
                          <p className="text-white font-medium">{line.concept}</p>
                          {line.description && (
                            <p className="text-neutral-500 text-sm">{line.description}</p>
                          )}
                          {line.delivery_method && line.delivery_method !== 'not_applicable' && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
                              <span className="inline-flex items-center gap-1">
                                <TruckIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                                {DELIVERY_METHOD_LABELS[line.delivery_method as DeliveryMethod]?.es || line.delivery_method}
                              </span>
                              {line.estimated_delivery_date && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                                  {new Date(`${line.estimated_delivery_date}T12:00:00`).toLocaleDateString('es-MX')}
                                </span>
                              )}
                              {line.delivery_address && Object.keys(line.delivery_address).length > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPinIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                                  <span className="truncate max-w-[200px]">
                                    {[line.delivery_address.street || line.delivery_address.calle, line.delivery_address.city || line.delivery_address.ciudad, line.delivery_address.state || line.delivery_address.estado].filter(Boolean).join(', ')}
                                  </span>
                                </span>
                              )}
                              {line.pickup_branch_detail && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPinIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                                  {line.pickup_branch_detail.name}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right text-white">{line.quantity}</td>
                        <td className="py-3 pr-4 text-neutral-400">{line.unit}</td>
                        <td className="py-3 pr-4 text-right text-white">{formatCurrency(line.unit_price)}</td>
                        <td className="py-3 pr-4 text-right text-neutral-400">
                          {editingShippingCosts ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={shippingInputs[line.position] ?? '0'}
                              onChange={(e) => setShippingInputs(prev => ({ ...prev, [line.position]: e.target.value }))}
                              className="w-24 bg-neutral-800 border border-neutral-600 text-white text-right text-sm rounded px-2 py-1 focus:outline-none focus:border-cmyk-cyan"
                            />
                          ) : (
                            parseFloat(line.shipping_cost || '0') > 0
                              ? formatCurrency(line.shipping_cost || '0')
                              : '—'
                          )}
                        </td>
                        <td className="py-3 text-right text-white font-medium">{formatCurrency(line.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2">
                {quote.lines?.map((line, index) => (
                  <div key={line.id || index} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{line.concept}</p>
                        {line.description && (
                          <p className="text-neutral-500 text-xs line-clamp-2">{line.description}</p>
                        )}
                      </div>
                      <p className="text-white font-medium text-sm">{formatCurrency(line.line_total)}</p>
                    </div>

                    {line.delivery_method && line.delivery_method !== 'not_applicable' && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
                        <span className="inline-flex items-center gap-1">
                          <TruckIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                          {DELIVERY_METHOD_LABELS[line.delivery_method as DeliveryMethod]?.es || line.delivery_method}
                        </span>
                        {line.estimated_delivery_date && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                            {new Date(`${line.estimated_delivery_date}T12:00:00`).toLocaleDateString('es-MX')}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-neutral-500">Cantidad</p>
                        <p className="text-white">{line.quantity}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Unidad</p>
                        <p className="text-neutral-300">{line.unit}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">P. Unit.</p>
                        <p className="text-white">{formatCurrency(line.unit_price)}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Envío</p>
                        {editingShippingCosts ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={shippingInputs[line.position] ?? '0'}
                            onChange={(e) => setShippingInputs(prev => ({ ...prev, [line.position]: e.target.value }))}
                            className="w-full bg-neutral-800 border border-neutral-600 text-white text-right text-sm rounded px-2 py-1 focus:outline-none focus:border-cmyk-cyan"
                          />
                        ) : (
                          <p className="text-neutral-300">
                            {parseFloat(line.shipping_cost || '0') > 0
                              ? formatCurrency(line.shipping_cost || '0')
                              : '—'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Inline shipping cost edit controls */}
              {editingShippingCosts && (
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingShippingCosts(false); setShippingInputs({}); }}
                    disabled={isFixingDelivery}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleFixDeliveryData(true)}
                    disabled={isFixingDelivery}
                  >
                    {isFixingDelivery ? 'Guardando...' : 'Guardar precios de envío'}
                  </Button>
                </div>
              )}

              {/* Totals */}
              <div className="mt-6 pt-4 border-t border-neutral-700 space-y-2">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>IVA ({Number(quote.tax_rate) * 100}%)</span>
                  <span>{formatCurrency(quote.tax_amount)}</span>
                </div>
                {(() => {
                  const shippingTotal = quote.lines?.reduce(
                    (sum, l) => sum + (parseFloat(l.shipping_cost || '0') || 0), 0
                  ) || 0;
                  return shippingTotal > 0 ? (
                    <div className="flex justify-between text-neutral-400">
                      <span>Envío <span className="text-neutral-600 text-xs">(sin IVA)</span></span>
                      <span>{formatCurrency(shippingTotal)}</span>
                    </div>
                  ) : null;
                })()}
                <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-neutral-700">
                  <span>Total</span>
                  <span className="text-cmyk-cyan">{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </Card>

            {/* Original Quote Request Details */}
            {quote.quote_request && (
              <Card className="p-6 border-cmyk-cyan/20">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-cmyk-cyan" />
                    Solicitud Original
                  </h2>
                  <Link
                    href={`/${locale}/dashboard/solicitudes/${quote.quote_request.id}`}
                    className="text-xs text-cmyk-cyan hover:underline"
                  >
                    #{quote.quote_request.request_number} →
                  </Link>
                </div>

                {/* ── Single-service rendering (accordion) ── */}
                {(!quote.quote_request.services || quote.quote_request.services.length === 0) && (() => {
                  const singleKey = 'single-0';
                  const isOpen = expandedServices.has(singleKey);
                  const svcLabel = SERVICE_LABELS[quote.quote_request.service_type as ServiceId] || quote.quote_request.service_type || 'Servicio';
                  const matchedLines = serviceToLinesMap.get(0);
                  const svcTotal = matchedLines?.reduce((s, l) => s + (parseFloat(String(l.line_total)) || 0), 0) || 0;
                  const firstEstDate = matchedLines?.find(l => l.estimated_delivery_date)?.estimated_delivery_date;
                  return (
                    <div className="space-y-3">
                    <div className="rounded-lg border border-neutral-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleService(singleKey)}
                        className="w-full flex items-center gap-3 p-4 bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
                      >
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-cmyk-cyan/20 text-cmyk-cyan text-sm font-bold flex-shrink-0">1</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{svcLabel}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {firstEstDate && (
                              <span className="text-neutral-400 text-xs flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {new Date(firstEstDate + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {svcTotal > 0 && <span className="text-green-400 text-xs font-medium">{formatCurrency(svcTotal)}</span>}
                          </div>
                        </div>
                        <ChevronDownIcon className={`h-5 w-5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="p-4 border-t border-neutral-700 space-y-4">
                          {quote.quote_request.service_details && Object.keys(quote.quote_request.service_details).length > 0 && (
                            <ServiceDetailsDisplay
                              serviceType={quote.quote_request.service_type}
                              serviceDetails={quote.quote_request.service_details as Record<string, unknown>}
                              routePrices={matchedLines && matchedLines.length > 1
                                ? matchedLines.reduce((acc, ml, mlIdx) => ({ ...acc, [mlIdx]: formatCurrency(ml.line_total) }), {} as Record<number, string>)
                                : undefined
                              }
                            />
                          )}
                          {(!quote.quote_request.service_details || Object.keys(quote.quote_request.service_details).length === 0) && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {quote.quote_request.quantity && (
                                <div className="p-3 bg-neutral-800/50 rounded-lg">
                                  <p className="text-neutral-500 text-xs">Cantidad</p>
                                  <p className="text-white font-medium">{quote.quote_request.quantity}</p>
                                </div>
                              )}
                              {quote.quote_request.dimensions && (
                                <div className="p-3 bg-neutral-800/50 rounded-lg">
                                  <p className="text-neutral-500 text-xs">Dimensiones</p>
                                  <p className="text-white">{quote.quote_request.dimensions}</p>
                                </div>
                              )}
                              {quote.quote_request.material && (
                                <div className="p-3 bg-neutral-800/50 rounded-lg">
                                  <p className="text-neutral-500 text-xs">Material</p>
                                  <p className="text-white">{quote.quote_request.material}</p>
                                </div>
                              )}
                              <div className="p-3 bg-neutral-800/50 rounded-lg">
                                <p className="text-neutral-500 text-xs">Instalación</p>
                                <p className="text-white">{quote.quote_request.includes_installation ? 'Sí' : 'No'}</p>
                              </div>
                            </div>
                          )}
                          {quote.quote_request.delivery_method && (
                            <div className="p-3 bg-neutral-800/50 rounded-lg">
                              <p className="text-neutral-500 text-xs mb-2">Método de entrega solicitado</p>
                              <p className="text-white flex items-center gap-2">
                                <span>{DELIVERY_METHOD_ICONS[quote.quote_request.delivery_method as DeliveryMethod]}</span>
                                {DELIVERY_METHOD_LABELS[quote.quote_request.delivery_method as DeliveryMethod]?.es || quote.quote_request.delivery_method}
                              </p>
                              {quote.quote_request.pickup_branch_detail && (
                                <p className="text-neutral-300 text-sm mt-1">Sucursal: {quote.quote_request.pickup_branch_detail.name} — {quote.quote_request.pickup_branch_detail.city}, {quote.quote_request.pickup_branch_detail.state}</p>
                              )}
                              {quote.quote_request.delivery_address && typeof quote.quote_request.delivery_address === 'object' && Object.keys(quote.quote_request.delivery_address).length > 0 && (
                                <p className="text-neutral-300 text-sm mt-1">
                                  {quote.quote_request.delivery_method === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}:{' '}
                                  {[quote.quote_request.delivery_address.street || quote.quote_request.delivery_address.calle, quote.quote_request.delivery_address.exterior_number || quote.quote_request.delivery_address.numero_exterior, quote.quote_request.delivery_address.neighborhood || quote.quote_request.delivery_address.colonia, quote.quote_request.delivery_address.city || quote.quote_request.delivery_address.ciudad, quote.quote_request.delivery_address.state || quote.quote_request.delivery_address.estado, quote.quote_request.delivery_address.postal_code || quote.quote_request.delivery_address.codigo_postal].filter(Boolean).join(', ')}
                                </p>
                              )}
                            </div>
                          )}
                          {(() => {
                            const details = quote.quote_request.service_details as Record<string, unknown> | undefined;
                            const hasRouteDates = details && Array.isArray(details.rutas) && (details.rutas as Array<Record<string, unknown>>).some(r => !!r.fecha_inicio);
                            if (hasRouteDates) return null;
                            const displayDate = quote.quote_request.required_date;
                            if (!displayDate) return null;
                            return (
                              <div className="p-3 bg-neutral-800/50 rounded-lg flex items-center gap-3">
                                <CalendarIcon className="h-5 w-5 text-neutral-400" />
                                <div>
                                  <p className="text-neutral-500 text-xs">Fecha Requerida</p>
                                  <p className="text-white">{new Date(displayDate + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                              </div>
                            );
                          })()}
                          {(() => {
                            if (!matchedLines) return null;
                            const datesInfo = matchedLines.filter(l => l.estimated_delivery_date).map(l => ({ concept: l.concept, date: l.estimated_delivery_date! }));
                            if (datesInfo.length === 0) return null;
                            return (
                              <div className="p-3 bg-neutral-800/50 rounded-lg">
                                <p className="text-neutral-500 text-xs mb-2 flex items-center gap-1">
                                  <CalendarIcon className="h-3.5 w-3.5" />
                                  Fecha{datesInfo.length > 1 ? 's' : ''} estimada{datesInfo.length > 1 ? 's' : ''} de entrega (vendedor)
                                </p>
                                <div className="space-y-1">
                                  {datesInfo.map((d, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                      {datesInfo.length > 1 && <span className="text-neutral-400 truncate mr-2">{d.concept}</span>}
                                      <span className="text-green-400 font-medium whitespace-nowrap">{new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {vendorLineGroups.map((vGroup, gIdx) => {
                      const vendorKey = `vendor-${gIdx}`;
                      const isOpen = expandedServices.has(vendorKey);
                      const svcLabel = vGroup.serviceType
                        ? (SERVICE_LABELS[vGroup.serviceType as ServiceId] || vGroup.serviceType)
                        : vGroup.lines[0]?.concept || 'Servicio';
                      const vGroupTotal = vGroup.lines.reduce((s, l) => s + (parseFloat(String(l.line_total || 0))), 0);
                      const firstEstDate = vGroup.lines.find(l => l.estimated_delivery_date)?.estimated_delivery_date;
                      const routeCount = vGroup.lines.length;
                      const vGroupSD = vGroup.lines[0]?.service_details as Record<string, unknown> | undefined;

                      return (
                        <div key={`vendor-${gIdx}`} className="rounded-lg border border-neutral-700 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleService(vendorKey)}
                            className="w-full flex items-center gap-3 p-4 bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
                          >
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-cmyk-cyan/20 text-cmyk-cyan text-sm font-bold flex-shrink-0">
                              {gIdx + 2}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold text-sm truncate">
                                {svcLabel}
                                {routeCount > 1 && (
                                  <span className="ml-2 text-xs font-normal text-neutral-400">({routeCount} rutas)</span>
                                )}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/30 ml-2 align-middle">Agregado por el vendedor</span>
                              </p>
                              {vGroup.lines.length > 1 ? (
                                <div className="mt-1 space-y-0.5">
                                  {vGroup.lines.map((ml, mlIdx) => {
                                    const routeLabel = ml.concept?.includes(' — Ruta ')
                                      ? ml.concept.split(' — ')[1]
                                      : `Ruta ${mlIdx + 1}`;
                                    return (
                                      <div key={mlIdx} className="flex items-center gap-2 text-xs">
                                        <span className="text-neutral-400">{routeLabel}</span>
                                        {ml.estimated_delivery_date && (
                                          <span className="text-neutral-500 flex items-center gap-0.5">
                                            <CalendarIcon className="h-3 w-3" />
                                            {new Date(ml.estimated_delivery_date + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                                          </span>
                                        )}
                                        <span className="text-green-400 font-medium">{formatCurrency(ml.line_total)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  {firstEstDate && (
                                    <span className="text-neutral-400 text-xs flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      {new Date(firstEstDate + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                  {vGroupTotal > 0 && (
                                    <span className="text-green-400 text-xs font-medium">{formatCurrency(vGroupTotal)}</span>
                                  )}
                                  {vGroup.lines[0]?.delivery_method && (
                                    <span className="text-neutral-500 text-xs flex items-center gap-1">
                                      <span className="text-xs">{DELIVERY_METHOD_ICONS[vGroup.lines[0].delivery_method as DeliveryMethod]}</span>
                                      {DELIVERY_METHOD_LABELS[vGroup.lines[0].delivery_method as DeliveryMethod]?.es || vGroup.lines[0].delivery_method}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <ChevronDownIcon className={`h-5 w-5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isOpen && (
                            <div className="p-4 border-t border-neutral-700 space-y-3">
                              {vGroupSD && Object.keys(vGroupSD).length > 0 && vGroup.serviceType && (
                                <div>
                                  <ServiceDetailsDisplay
                                    serviceType={vGroup.serviceType}
                                    serviceDetails={vGroupSD}
                                    routePrices={vGroup.lines.length > 1
                                      ? vGroup.lines.reduce((acc, ml, mlIdx) => ({ ...acc, [mlIdx]: formatCurrency(ml.line_total) }), {} as Record<number, string>)
                                      : undefined
                                    }
                                  />
                                </div>
                              )}

                              {vGroup.lines[0]?.description && (
                                <div className="p-4 bg-neutral-800/50 rounded-lg">
                                  <p className="text-neutral-500 text-xs mb-2">Comentarios del cliente</p>
                                  <p className="text-white whitespace-pre-wrap">{vGroup.lines[0].description}</p>
                                </div>


                              )}

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {vGroup.lines[0]?.delivery_method && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">Método de entrega</p>
                                    <p className="text-white font-medium flex items-center gap-1 mt-auto">
                                      <span>{DELIVERY_METHOD_ICONS[vGroup.lines[0].delivery_method as DeliveryMethod]}</span>
                                      {DELIVERY_METHOD_LABELS[vGroup.lines[0].delivery_method as DeliveryMethod]?.es || vGroup.lines[0].delivery_method}
                                    </p>
                                  </div>
                                )}
                                {vGroup.lines[0]?.pickup_branch_detail && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">Sucursal de recolección</p>
                                    <p className="text-white font-medium mt-auto">{vGroup.lines[0].pickup_branch_detail.name}</p>
                                  </div>
                                )}
                                {vGroup.lines[0]?.delivery_address && typeof vGroup.lines[0].delivery_address === 'object' && Object.keys(vGroup.lines[0].delivery_address).length > 0 && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg col-span-2 flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">
                                      {vGroup.lines[0].delivery_method === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}
                                    </p>
                                    <p className="text-white font-medium mt-auto">
                                      {[vGroup.lines[0].delivery_address.street || vGroup.lines[0].delivery_address.calle,
                                        vGroup.lines[0].delivery_address.exterior_number || vGroup.lines[0].delivery_address.numero_exterior,
                                        vGroup.lines[0].delivery_address.neighborhood || vGroup.lines[0].delivery_address.colonia,
                                        vGroup.lines[0].delivery_address.city || vGroup.lines[0].delivery_address.ciudad,
                                        vGroup.lines[0].delivery_address.state || vGroup.lines[0].delivery_address.estado,
                                        vGroup.lines[0].delivery_address.postal_code || vGroup.lines[0].delivery_address.codigo_postal,
                                      ].filter(Boolean).join(', ')}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {(() => {
                                const datesInfo = vGroup.lines
                                  .filter(l => l.estimated_delivery_date)
                                  .map(l => ({ concept: l.concept, date: l.estimated_delivery_date! }));
                                if (datesInfo.length === 0) return null;
                                return (
                                  <div className="pt-3 border-t border-neutral-700/50">
                                    <p className="text-neutral-500 text-xs mb-2 flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      Fecha{datesInfo.length > 1 ? 's' : ''} estimada{datesInfo.length > 1 ? 's' : ''} de entrega
                                    </p>
                                    <div className="space-y-1">
                                      {datesInfo.map((d, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                          {datesInfo.length > 1 && (
                                            <span className="text-neutral-400 truncate mr-2">{d.concept}</span>
                                          )}
                                          <span className="text-green-400 font-medium whitespace-nowrap">
                                            {new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', {
                                              year: 'numeric', month: 'short', day: 'numeric',
                                            })}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  );
                })()}

                {/* ── Multi-service rendering (accordion) ── */}
                {quote.quote_request.services && quote.quote_request.services.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-neutral-400 text-sm font-medium">
                      {quote.quote_request.services.length + vendorLineGroups.length} servicio{(quote.quote_request.services.length + vendorLineGroups.length) > 1 ? 's' : ''} solicitado{(quote.quote_request.services.length + vendorLineGroups.length) > 1 ? 's' : ''}
                    </p>
                    {quote.quote_request.services.map((svc, idx) => {
                      const multiKey = `multi-${idx}`;
                      const isOpen = expandedServices.has(multiKey);
                      const svcLabel = SERVICE_LABELS[svc.service_type as ServiceId] || svc.service_type;
                      const svcDetails = svc.service_details as Record<string, unknown> | undefined;
                      const hasRouteDates = svcDetails && Array.isArray(svcDetails.rutas) &&
                        (svcDetails.rutas as Array<Record<string, unknown>>).some(r => !!r.fecha_inicio);
                      const matchedLines = serviceToLinesMap.get(idx);
                      const svcTotal = matchedLines?.reduce((s, l) => s + (parseFloat(String(l.line_total)) || 0), 0) || 0;
                      const routeCount = svcDetails && Array.isArray(svcDetails.rutas) ? (svcDetails.rutas as unknown[]).length : 0;
                      return (
                        <div key={svc.id} className="rounded-lg border border-neutral-700 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleService(multiKey)}
                            className="w-full flex items-center gap-3 p-4 bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
                          >
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-cmyk-cyan/20 text-cmyk-cyan text-sm font-bold flex-shrink-0">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold text-sm truncate">
                                {svcLabel}
                                {routeCount > 1 && <span className="ml-2 text-xs font-normal text-neutral-400">({routeCount} rutas)</span>}
                              </p>
                              {matchedLines && matchedLines.length > 1 ? (
                                <div className="mt-1 space-y-0.5">
                                  {matchedLines.map((ml, mlIdx) => {
                                    const mlDate = ml.estimated_delivery_date;
                                    const mlTotal = parseFloat(String(ml.line_total)) || 0;
                                    const routeLabel = ml.concept.includes(' — Ruta ') ? ml.concept.split(' — Ruta ')[1] : `Ruta ${mlIdx + 1}`;
                                    return (
                                      <div key={mlIdx} className="flex items-center gap-2 text-xs">
                                        <span className="text-neutral-500">Ruta {routeLabel}</span>
                                        {mlDate && (
                                          <span className="text-neutral-400 flex items-center gap-0.5">
                                            — <CalendarIcon className="h-3 w-3" /> {new Date(mlDate + 'T12:00:00').toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                                          </span>
                                        )}
                                        {mlTotal > 0 && <span className="text-green-400 font-medium">— {formatCurrency(mlTotal)}</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  {svc.required_date && !hasRouteDates && (
                                    <span className="text-neutral-400 text-xs flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      {new Date(svc.required_date + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                  {svcTotal > 0 && <span className="text-green-400 text-xs font-medium">{formatCurrency(svcTotal)}</span>}
                                </div>
                              )}
                            </div>
                            <ChevronDownIcon className={`h-5 w-5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="p-4 border-t border-neutral-700 space-y-3">
                              {svc.service_details && Object.keys(svc.service_details).length > 0 && (
                                <ServiceDetailsDisplay
                                  serviceType={svc.service_type}
                                  serviceDetails={svc.service_details as Record<string, unknown>}
                                  routePrices={matchedLines && matchedLines.length > 1
                                    ? matchedLines.reduce((acc, ml, mlIdx) => ({ ...acc, [mlIdx]: formatCurrency(ml.line_total) }), {} as Record<number, string>)
                                    : undefined
                                  }
                                />
                              )}
                              {svc.description && (
                                <div className="p-4 bg-neutral-800/50 rounded-lg">
                                  <p className="text-neutral-500 text-xs mb-2">Comentarios del cliente</p>
                                  <p className="text-white whitespace-pre-wrap">{svc.description}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {svc.delivery_method && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">Método de entrega</p>
                                    <p className="text-white font-medium flex items-center gap-1 mt-auto">
                                      <span>{DELIVERY_METHOD_ICONS[svc.delivery_method as DeliveryMethod]}</span>
                                      {DELIVERY_METHOD_LABELS[svc.delivery_method as DeliveryMethod]?.es || svc.delivery_method}
                                    </p>
                                  </div>
                                )}
                                {svc.pickup_branch_detail && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">Sucursal de recolección</p>
                                    <p className="text-white font-medium mt-auto">{svc.pickup_branch_detail.name}</p>
                                  </div>
                                )}
                                {svc.delivery_address && Object.keys(svc.delivery_address).length > 0 && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg col-span-2 flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">{svc.delivery_method === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}</p>
                                    <p className="text-white font-medium mt-auto">
                                      {[svc.delivery_address.street || svc.delivery_address.calle, svc.delivery_address.exterior_number || svc.delivery_address.numero_exterior, svc.delivery_address.neighborhood || svc.delivery_address.colonia, svc.delivery_address.city || svc.delivery_address.ciudad, svc.delivery_address.state || svc.delivery_address.estado, svc.delivery_address.postal_code || svc.delivery_address.codigo_postal].filter(Boolean).join(', ')}
                                    </p>
                                  </div>
                                )}
                                {svc.required_date && !hasRouteDates && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">Fecha requerida</p>
                                    <p className="text-white font-medium mt-auto">{new Date(svc.required_date + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                  </div>
                                )}
                              </div>
                              {(() => {
                                if (!matchedLines) return null;
                                const datesInfo = matchedLines.filter(l => l.estimated_delivery_date).map(l => ({ concept: l.concept, date: l.estimated_delivery_date! }));
                                if (datesInfo.length === 0) return null;
                                return (
                                  <div className="pt-3 border-t border-neutral-700/50">
                                    <p className="text-neutral-500 text-xs mb-2 flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      Fecha{datesInfo.length > 1 ? 's' : ''} estimada{datesInfo.length > 1 ? 's' : ''} de entrega (vendedor)
                                    </p>
                                    <div className="space-y-1">
                                      {datesInfo.map((d, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                          {datesInfo.length > 1 && <span className="text-neutral-400 truncate mr-2">{d.concept}</span>}
                                          <span className="text-green-400 font-medium whitespace-nowrap">{new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                              {svc.attachments && svc.attachments.length > 0 && (
                                <div className="pt-3 border-t border-neutral-700">
                                  <p className="text-neutral-500 text-xs mb-2 flex items-center gap-1">
                                    <PaperClipIcon className="h-3 w-3" />
                                    Archivos adjuntos ({svc.attachments.length})
                                  </p>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {svc.attachments.map((att) => {
                                      const isImage = att.file_type?.startsWith('image/');
                                      return (
                                        <a key={att.id} href={att.file} target="_blank" rel="noopener noreferrer" className="block p-2 bg-neutral-900/50 rounded hover:bg-neutral-700 transition-colors group">
                                          {isImage && <img src={att.file} alt={att.filename || 'Archivo'} className="w-full h-20 object-cover rounded mb-1" />}
                                          <p className="text-xs text-cmyk-cyan truncate group-hover:underline flex items-center gap-1">
                                            {!isImage && <PaperClipIcon className="h-3 w-3 flex-shrink-0" />}
                                            {att.filename || 'Archivo'}
                                          </p>
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Vendor-added services rendered as regular accordion items */}
                    {vendorLineGroups.map((vGroup, gIdx) => {
                      const vendorKey = `vendor-${gIdx}`;
                      const isOpen = expandedServices.has(vendorKey);
                      const svcLabel = vGroup.serviceType
                        ? (SERVICE_LABELS[vGroup.serviceType as ServiceId] || vGroup.serviceType)
                        : vGroup.lines[0]?.concept || 'Servicio';
                      const vGroupTotal = vGroup.lines.reduce((s, l) => s + (parseFloat(String(l.line_total || 0))), 0);
                      const firstEstDate = vGroup.lines.find(l => l.estimated_delivery_date)?.estimated_delivery_date;
                      const routeCount = vGroup.lines.length;
                      const vGroupSD = vGroup.lines[0]?.service_details as Record<string, unknown> | undefined;

                      return (
                        <div key={`vendor-${gIdx}`} className="rounded-lg border border-neutral-700 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleService(vendorKey)}
                            className="w-full flex items-center gap-3 p-4 bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
                          >
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-cmyk-cyan/20 text-cmyk-cyan text-sm font-bold flex-shrink-0">
                              {gIdx + 1 + (quote.quote_request?.services?.length || 0)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold text-sm truncate">
                                {svcLabel}
                                {routeCount > 1 && (
                                  <span className="ml-2 text-xs font-normal text-neutral-400">({routeCount} rutas)</span>
                                )}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/30 ml-2 align-middle">Agregado por el vendedor</span>
                              </p>
                              {vGroup.lines.length > 1 ? (
                                <div className="mt-1 space-y-0.5">
                                  {vGroup.lines.map((ml, mlIdx) => {
                                    const routeLabel = ml.concept?.includes(' — Ruta ')
                                      ? ml.concept.split(' — ')[1]
                                      : `Ruta ${mlIdx + 1}`;
                                    return (
                                      <div key={mlIdx} className="flex items-center gap-2 text-xs">
                                        <span className="text-neutral-400">{routeLabel}</span>
                                        {ml.estimated_delivery_date && (
                                          <span className="text-neutral-500 flex items-center gap-0.5">
                                            <CalendarIcon className="h-3 w-3" />
                                            {new Date(ml.estimated_delivery_date + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                                          </span>
                                        )}
                                        <span className="text-green-400 font-medium">{formatCurrency(ml.line_total)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  {firstEstDate && (
                                    <span className="text-neutral-400 text-xs flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      {new Date(firstEstDate + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                  {vGroupTotal > 0 && (
                                    <span className="text-green-400 text-xs font-medium">{formatCurrency(vGroupTotal)}</span>
                                  )}
                                  {vGroup.lines[0]?.delivery_method && (
                                    <span className="text-neutral-500 text-xs flex items-center gap-1">
                                      <span className="text-xs">{DELIVERY_METHOD_ICONS[vGroup.lines[0].delivery_method as DeliveryMethod]}</span>
                                      {DELIVERY_METHOD_LABELS[vGroup.lines[0].delivery_method as DeliveryMethod]?.es || vGroup.lines[0].delivery_method}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <ChevronDownIcon className={`h-5 w-5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isOpen && (
                            <div className="p-4 border-t border-neutral-700 space-y-3">
                              {vGroupSD && Object.keys(vGroupSD).length > 0 && vGroup.serviceType && (
                                <div>
                                  <ServiceDetailsDisplay
                                    serviceType={vGroup.serviceType}
                                    serviceDetails={vGroupSD}
                                    routePrices={vGroup.lines.length > 1
                                      ? vGroup.lines.reduce((acc, ml, mlIdx) => ({ ...acc, [mlIdx]: formatCurrency(ml.line_total) }), {} as Record<number, string>)
                                      : undefined
                                    }
                                  />
                                </div>
                              )}

                              {vGroup.lines[0]?.description && (
                                <div className="p-4 bg-neutral-800/50 rounded-lg">
                                  <p className="text-neutral-500 text-xs mb-2">Comentarios del cliente</p>
                                  <p className="text-white whitespace-pre-wrap">{vGroup.lines[0].description}</p>
                                </div>


                              )}

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {vGroup.lines[0]?.delivery_method && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">Método de entrega</p>
                                    <p className="text-white font-medium flex items-center gap-1 mt-auto">
                                      <span>{DELIVERY_METHOD_ICONS[vGroup.lines[0].delivery_method as DeliveryMethod]}</span>
                                      {DELIVERY_METHOD_LABELS[vGroup.lines[0].delivery_method as DeliveryMethod]?.es || vGroup.lines[0].delivery_method}
                                    </p>
                                  </div>
                                )}
                                {vGroup.lines[0]?.pickup_branch_detail && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">Sucursal de recolección</p>
                                    <p className="text-white font-medium mt-auto">{vGroup.lines[0].pickup_branch_detail.name}</p>
                                  </div>
                                )}
                                {vGroup.lines[0]?.delivery_address && typeof vGroup.lines[0].delivery_address === 'object' && Object.keys(vGroup.lines[0].delivery_address).length > 0 && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg col-span-2 flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">
                                      {vGroup.lines[0].delivery_method === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}
                                    </p>
                                    <p className="text-white font-medium mt-auto">
                                      {[vGroup.lines[0].delivery_address.street || vGroup.lines[0].delivery_address.calle,
                                        vGroup.lines[0].delivery_address.exterior_number || vGroup.lines[0].delivery_address.numero_exterior,
                                        vGroup.lines[0].delivery_address.neighborhood || vGroup.lines[0].delivery_address.colonia,
                                        vGroup.lines[0].delivery_address.city || vGroup.lines[0].delivery_address.ciudad,
                                        vGroup.lines[0].delivery_address.state || vGroup.lines[0].delivery_address.estado,
                                        vGroup.lines[0].delivery_address.postal_code || vGroup.lines[0].delivery_address.codigo_postal,
                                      ].filter(Boolean).join(', ')}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {(() => {
                                const datesInfo = vGroup.lines
                                  .filter(l => l.estimated_delivery_date)
                                  .map(l => ({ concept: l.concept, date: l.estimated_delivery_date! }));
                                if (datesInfo.length === 0) return null;
                                return (
                                  <div className="pt-3 border-t border-neutral-700/50">
                                    <p className="text-neutral-500 text-xs mb-2 flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      Fecha{datesInfo.length > 1 ? 's' : ''} estimada{datesInfo.length > 1 ? 's' : ''} de entrega
                                    </p>
                                    <div className="space-y-1">
                                      {datesInfo.map((d, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                          {datesInfo.length > 1 && (
                                            <span className="text-neutral-400 truncate mr-2">{d.concept}</span>
                                          )}
                                          <span className="text-green-400 font-medium whitespace-nowrap">
                                            {new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', {
                                              year: 'numeric', month: 'short', day: 'numeric',
                                            })}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Description / Comments */}
                {quote.quote_request.description && (
                  <div className="mb-4 p-4 bg-neutral-800/50 rounded-lg">
                    <p className="text-neutral-500 text-xs mb-2">Comentarios del cliente</p>
                    <p className="text-white whitespace-pre-wrap">{quote.quote_request.description}</p>
                  </div>
                )}

                {/* Catalog Item */}
                {quote.quote_request.catalog_item && (
                  <div className="mb-4 p-4 bg-neutral-800/50 rounded-lg flex items-center gap-4">
                    {quote.quote_request.catalog_item.image && (
                      <img
                        src={quote.quote_request.catalog_item.image}
                        alt={quote.quote_request.catalog_item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    <div>
                      <p className="text-neutral-500 text-xs">Producto/Servicio</p>
                      <p className="text-white font-medium">{quote.quote_request.catalog_item.name}</p>
                    </div>
                  </div>
                )}

                {/* Request Attachments */}
                {quote.quote_request.attachments && quote.quote_request.attachments.length > 0 && (
                  <div>
                    <p className="text-neutral-400 text-sm mb-2 font-medium flex items-center gap-2">
                      <PaperClipIcon className="h-4 w-4" />
                      Archivos del cliente ({quote.quote_request.attachments.length})
                    </p>
                    <div className="space-y-2">
                      {quote.quote_request.attachments.map((att) => {
                        const isImage = att.file_type?.startsWith('image/');
                        return (
                          <div key={att.id} className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
                            {isImage ? (
                              <a href={att.file} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                <img
                                  src={att.file}
                                  alt={att.filename}
                                  className="w-12 h-12 object-cover rounded border border-neutral-600 hover:border-cmyk-cyan transition-colors"
                                />
                              </a>
                            ) : (
                              <div className="w-8 h-8 flex items-center justify-center bg-neutral-700 rounded flex-shrink-0">
                                <PaperClipIcon className="h-4 w-4 text-neutral-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <a
                                href={att.file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-cmyk-cyan hover:underline truncate block"
                              >
                                {att.filename}
                              </a>
                              <p className="text-xs text-neutral-500">
                                {att.file_size > 0 && `${(att.file_size / 1024).toFixed(0)} KB`}
                                {att.file_type && ` · ${att.file_type}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Change Requests Section */}
            {changeRequests.length > 0 && (
              <Card className="p-6 border-orange-500/20">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <PencilSquareIcon className="h-5 w-5 text-orange-400" />
                    Solicitudes de Cambio
                    {changeRequests.filter(cr => cr.status === 'pending').length > 0 && (
                      <span className="bg-orange-500/20 text-orange-400 text-xs font-medium px-2 py-0.5 rounded-full">
                        {changeRequests.filter(cr => cr.status === 'pending').length} pendiente{changeRequests.filter(cr => cr.status === 'pending').length > 1 ? 's' : ''}
                      </span>
                    )}
                  </h2>
                </div>
                <div className="space-y-3">
                  {changeRequests.map((cr) => (
                    <Link
                      key={cr.id}
                      href={`/${locale}/dashboard/cotizaciones/${quoteId}/cambios/${cr.id}`}
                      className={`block p-4 rounded-lg border transition-colors ${
                        cr.status === 'pending'
                          ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20'
                          : cr.status === 'approved'
                          ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10'
                          : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${changeRequestStatusColors[cr.status]}`}>
                              {cr.status === 'pending' && <ClockIcon className="h-3 w-3" />}
                              {cr.status === 'approved' && <CheckCircleIcon className="h-3 w-3" />}
                              {cr.status === 'rejected' && <XCircleIcon className="h-3 w-3" />}
                              {changeRequestStatusLabels[cr.status]}
                            </span>
                            <span className="text-neutral-500 text-xs">
                              {new Date(cr.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          {cr.customer_comments ? (
                            <p className="text-neutral-300 text-sm mt-1">
                              &ldquo;{cr.customer_comments}&rdquo;
                            </p>
                          ) : (() => {
                            const lineComments = (cr.proposed_lines || [])
                              .filter(pl => pl.description && pl.description.trim() && pl.action !== 'delete')
                              .map(pl => {
                                const label = pl.concept || (cr.original_snapshot?.lines?.find(ol => ol.id === pl.id)?.concept) || '';
                                return { label: label.split(' — ').pop() || label, comment: pl.description!.trim() };
                              });
                            return lineComments.length > 0 ? (
                              <div className="mt-1 space-y-0.5">
                                {lineComments.slice(0, 3).map((lc, i) => (
                                  <p key={i} className="text-neutral-400 text-xs">
                                    <span className="text-neutral-500">{lc.label}:</span>{' '}
                                    &ldquo;{lc.comment}&rdquo;
                                  </p>
                                ))}
                                {lineComments.length > 3 && (
                                  <p className="text-neutral-500 text-xs">+{lineComments.length - 3} más...</p>
                                )}
                              </div>
                            ) : null;
                          })()}
                          {/* Change request attachments */}
                          {cr.attachments && cr.attachments.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <p className="text-neutral-500 text-xs flex items-center gap-1">
                                <PaperClipIcon className="h-3 w-3" />
                                {cr.attachments.length} archivo{cr.attachments.length > 1 ? 's' : ''} adjunto{cr.attachments.length > 1 ? 's' : ''}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {cr.attachments.map((att) => {
                                  const isImage = att.file_type?.startsWith('image/');
                                  return isImage ? (
                                    <a key={att.id} href={att.file} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                      <img
                                        src={att.file}
                                        alt={att.filename}
                                        className="w-14 h-14 object-cover rounded border border-neutral-600 hover:border-cmyk-cyan transition-colors"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      key={att.id}
                                      href={att.file}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1.5 px-2 py-1 bg-neutral-800/50 rounded border border-neutral-700/50 text-xs text-cmyk-cyan hover:underline"
                                    >
                                      <PaperClipIcon className="h-3 w-3 text-neutral-400" />
                                      {att.filename}
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {cr.changes_summary && (
                            <div className="flex gap-3 mt-2 text-xs text-neutral-500">
                              {cr.changes_summary.modified > 0 && (
                                <span className="flex items-center gap-1">
                                  <ArrowPathIcon className="h-3 w-3 text-yellow-400" />
                                  {cr.changes_summary.modified} modificada{cr.changes_summary.modified > 1 ? 's' : ''}
                                </span>
                              )}
                              {cr.changes_summary.added > 0 && (
                                <span className="flex items-center gap-1">
                                  <CheckCircleIcon className="h-3 w-3 text-green-400" />
                                  {cr.changes_summary.added} nueva{cr.changes_summary.added > 1 ? 's' : ''}
                                </span>
                              )}
                              {cr.changes_summary.deleted > 0 && (
                                <span className="flex items-center gap-1">
                                  <XCircleIcon className="h-3 w-3 text-red-400" />
                                  {cr.changes_summary.deleted} eliminada{cr.changes_summary.deleted > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          )}
                          {cr.reviewed_by_name && (
                            <p className="text-neutral-500 text-xs mt-2">
                              Revisada por {cr.reviewed_by_name}
                              {cr.reviewed_at && ` el ${new Date(cr.reviewed_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                            </p>
                          )}
                        </div>
                        <span className={`text-sm font-medium ${
                          cr.status === 'pending' ? 'text-orange-400' : 'text-neutral-400'
                        }`}>
                          {cr.status === 'pending' ? 'Revisar →' : 'Ver →'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}


          </div>

          {/* Sidebar */}
          <div>
            <div className="space-y-6">
            {/* Unified Timeline */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ClockIcon className="h-5 w-5 text-cmyk-cyan" />
                  Historial
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[quote.status]}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusLabels[quote.status]}
                </span>
              </div>
              <div className="relative">
                {/* Timeline line — behind icons (z-0) */}
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-neutral-700 z-0"></div>

                <div className="space-y-4">
                  {/* --- Unified chronological timeline (newest first) --- */}

                  {/* Merged events sorted by date */}
                  {(() => {
                    type TimelineEvent =
                      | { type: 'response'; date: string; data: QuoteResponse }
                      | { type: 'change_request'; date: string; data: QuoteChangeRequest }
                      | { type: 'change_request_reviewed'; date: string; data: QuoteChangeRequest };

                    const eventsList: TimelineEvent[] = [
                      ...responses.map(r => ({ type: 'response' as const, date: r.created_at, data: r })),
                      ...changeRequests.map(cr => ({ type: 'change_request' as const, date: cr.created_at, data: cr })),
                      // Add separate reviewed events for approved/rejected change requests
                      ...changeRequests
                        .filter(cr => cr.status !== 'pending' && cr.reviewed_at)
                        .map(cr => ({ type: 'change_request_reviewed' as const, date: cr.reviewed_at!, data: cr })),
                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    // Count send responses chronologically to assign version numbers
                    const sendResponses = responses.filter(r => r.action === 'send').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    const sendVersionMap = new Map<string, number>();
                    sendResponses.forEach((r, i) => sendVersionMap.set(r.id, i + 1));

                    const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                    // Count change requests chronologically for version labels (v2, v3...)
                    const sortedCRs = [...changeRequests].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    const crVersionMap = new Map<string, number>();
                    sortedCRs.forEach((cr, i) => crVersionMap.set(cr.id, i + 2));

                    // Icon circle base class — solid bg so the line doesn't bleed through
                    const circleBase = 'relative z-10 flex items-center justify-center w-5 h-5 rounded-full border';

                    return eventsList.map((event, idx) => {
                      // --- Change request submitted by client ---
                      if (event.type === 'change_request') {
                        const cr = event.data;
                        const crVersion = crVersionMap.get(cr.id) || 2;
                        return (
                          <Link
                            key={`cr-${cr.id}`}
                            href={`/${locale}/dashboard/cotizaciones/${quoteId}/cambios/${cr.id}`}
                            className="relative flex items-start gap-3 group"
                          >
                            <div className={`${circleBase} bg-neutral-900 border-orange-500/60`}>
                              <PencilIcon className="h-3 w-3 text-orange-400" />
                            </div>
                            <div className="flex-1 -mt-0.5">
                              <p className="text-orange-400 text-xs font-medium group-hover:underline">
                                Solicitud de cambios v{crVersion}
                                {cr.changes_summary && (
                                  <span className="ml-1.5 text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-full">
                                    {[
                                      cr.changes_summary.added > 0 && `+${cr.changes_summary.added}`,
                                      cr.changes_summary.modified > 0 && `~${cr.changes_summary.modified}`,
                                      cr.changes_summary.deleted > 0 && `-${cr.changes_summary.deleted}`,
                                    ].filter(Boolean).join(' ')}
                                  </span>
                                )}
                              </p>
                              <p className="text-neutral-500 text-xs">
                                {cr.customer_name} · {fmtDate(cr.created_at)}
                              </p>
                              {cr.customer_comments ? (
                                <p className="text-neutral-500 text-xs mt-0.5 line-clamp-1 group-hover:text-neutral-300 transition-colors">
                                  &ldquo;{cr.customer_comments}&rdquo;
                                </p>
                              ) : (() => {
                                const comments = (cr.proposed_lines || []).filter(pl => pl.description?.trim() && pl.action !== 'delete');
                                return comments.length > 0 ? (
                                  <p className="text-neutral-500 text-xs mt-0.5 line-clamp-1 group-hover:text-neutral-300 transition-colors">
                                    {comments.length} comentario{comments.length > 1 ? 's' : ''} en líneas
                                  </p>
                                ) : null;
                              })()}
                              {cr.attachments && cr.attachments.length > 0 && (
                                <p className="text-neutral-500 text-xs mt-0.5 flex items-center gap-1">
                                  <PaperClipIcon className="h-3 w-3" />
                                  {cr.attachments.length} adjunto{cr.attachments.length > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </Link>
                        );
                      }

                      // --- Change request reviewed by seller ---
                      if (event.type === 'change_request_reviewed') {
                        const cr = event.data;
                        const isApproved = cr.status === 'approved';
                        return (
                          <div key={`cr-review-${cr.id}`} className="relative flex items-start gap-3">
                            <div className={`${circleBase} bg-neutral-900 ${
                              isApproved ? 'border-green-500/60' : 'border-red-500/60'
                            }`}>
                              {isApproved ? <CheckCircleIcon className="h-3 w-3 text-green-400" /> : <XCircleIcon className="h-3 w-3 text-red-400" />}
                            </div>
                            <div className="flex-1 -mt-0.5">
                              <p className={`text-xs font-medium ${isApproved ? 'text-green-400' : 'text-red-400'}`}>
                                Solicitud de cambios — {isApproved ? 'aprobada' : 'rechazada'}
                              </p>
                              <p className="text-neutral-500 text-xs">
                                {cr.reviewed_by_name || 'Vendedor'} · {fmtDate(cr.reviewed_at!)}
                              </p>
                              {cr.review_notes && (
                                <p className="text-neutral-400 text-xs mt-1 bg-neutral-800/50 rounded p-1.5 line-clamp-1">
                                  &ldquo;{cr.review_notes}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // --- Response events ---
                      const response = event.data as QuoteResponse;

                      // Send: "Cotización creada y enviada [vN]"
                      if (response.action === 'send') {
                        const version = sendVersionMap.get(response.id) || 1;
                        const versionLabel = version > 1 ? ` v${version}` : '';
                        return (
                          <div key={`r-${response.id}`} className="relative flex items-start gap-3">
                            <div className={`${circleBase} bg-neutral-900 border-cmyk-cyan/60`}>
                              <PaperAirplaneIcon className="h-3 w-3 text-cmyk-cyan" />
                            </div>
                            <div className="flex-1 -mt-0.5">
                              <p className="text-cmyk-cyan text-xs font-medium">
                                Cotización creada y enviada{versionLabel}
                                {version > 1 && (
                                  <span className="ml-1.5 text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">
                                    v{version}
                                  </span>
                                )}
                              </p>
                              <p className="text-neutral-500 text-xs">
                                {response.responded_by_name || 'Vendedor'} · {fmtDate(response.created_at)}
                              </p>
                              {quote.token && (
                                <Link
                                  href={`/${locale}/cotizacion/${quote.token}`}
                                  target="_blank"
                                  className="text-cmyk-cyan/70 text-xs hover:underline mt-0.5 inline-block"
                                >
                                  Ver cotización →
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // View: "Cotización vista por el cliente"
                      if (response.action === 'view') {
                        return (
                          <div key={`r-${response.id}`} className="relative flex items-start gap-3">
                            <div className={`${circleBase} bg-neutral-900 border-purple-500/60`}>
                              <EyeIcon className="h-3 w-3 text-purple-400" />
                            </div>
                            <div className="flex-1 -mt-0.5">
                              <p className="text-purple-400 text-xs font-medium">Cotización vista por el cliente</p>
                              <p className="text-neutral-500 text-xs">
                                {response.responded_by_name || response.guest_name || 'Cliente'} · {fmtDate(response.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      // Approval
                      if (response.action === 'approval') {
                        return (
                          <div key={`r-${response.id}`} className="relative flex items-start gap-3">
                            <div className={`${circleBase} bg-neutral-900 border-green-500/60`}>
                              <CheckCircleIcon className="h-3 w-3 text-green-400" />
                            </div>
                            <div className="flex-1 -mt-0.5">
                              <p className="text-green-400 text-xs font-medium">Cotización aceptada</p>
                              <p className="text-neutral-500 text-xs">
                                {response.responded_by_name || response.guest_name || 'Cliente'} · {fmtDate(response.created_at)}
                              </p>
                              {response.comment && (
                                <p className="text-neutral-400 text-xs mt-1 bg-neutral-800/50 rounded p-1.5 line-clamp-2">
                                  &ldquo;{response.comment}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Rejection
                      if (response.action === 'rejection') {
                        return (
                          <div key={`r-${response.id}`} className="relative flex items-start gap-3">
                            <div className={`${circleBase} bg-neutral-900 border-red-500/60`}>
                              <XCircleIcon className="h-3 w-3 text-red-400" />
                            </div>
                            <div className="flex-1 -mt-0.5">
                              <p className="text-red-400 text-xs font-medium">Cotización rechazada</p>
                              <p className="text-neutral-500 text-xs">
                                {response.responded_by_name || response.guest_name || 'Cliente'} · {fmtDate(response.created_at)}
                              </p>
                              {response.comment && (
                                <p className="text-neutral-400 text-xs mt-1 bg-neutral-800/50 rounded p-1.5 line-clamp-2">
                                  &ldquo;{response.comment}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Comment or other
                      return (
                        <div key={`r-${response.id}-${idx}`} className="relative flex items-start gap-3">
                          <div className={`${circleBase} bg-neutral-900 border-blue-500/60`}>
                            <PencilIcon className="h-3 w-3 text-blue-400" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-blue-400 text-xs font-medium">
                              {response.action_display || 'Comentario'}
                            </p>
                            <p className="text-neutral-500 text-xs">
                              {response.responded_by_name || response.guest_name || 'Cliente'} · {fmtDate(response.created_at)}
                            </p>
                            {response.comment && (
                              <p className="text-neutral-400 text-xs mt-1 bg-neutral-800/50 rounded p-1.5 line-clamp-2">
                                &ldquo;{response.comment}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}

                  {/* Sent fallback — only for quotes sent before response tracking existed */}
                  {quote.sent_at && !responses.some(r => r.action === 'send') && (
                    <div className="relative flex items-start gap-3">
                      <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-cmyk-cyan/60">
                        <PaperAirplaneIcon className="h-3 w-3 text-cmyk-cyan" />
                      </div>
                      <div className="flex-1 -mt-0.5">
                        <p className="text-cmyk-cyan text-xs font-medium">
                          Cotización creada y enviada
                        </p>
                        <p className="text-neutral-500 text-xs">
                          {quote.created_by_name && `${quote.created_by_name} · `}{formatDate(quote.sent_at)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* --- Quote Request events (if linked) --- */}
                  {quote.quote_request && (
                    <>
                      {/* Divider between quote and request events */}
                      <div className="relative flex items-center gap-3 py-1">
                        <div className="relative z-10 w-5 flex justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-600"></div>
                        </div>
                        <div className="flex-1 border-t border-dashed border-neutral-700"></div>
                      </div>

                      {/* Request: In review — show if status progressed past pending */}
                      {quote.quote_request.status !== 'pending' && (
                        <div className="relative flex items-start gap-3">
                          <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-yellow-500/60">
                            <ArrowPathIcon className="h-3 w-3 text-yellow-400" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-yellow-400 text-xs font-medium">Solicitud en revisión</p>
                            <p className="text-neutral-500 text-xs">{formatDate(quote.quote_request.updated_at)}</p>
                          </div>
                        </div>
                      )}

                      {/* Request: Assigned */}
                      {quote.quote_request.assigned_at && (
                        <div className="relative flex items-start gap-3">
                          <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-blue-500/60">
                            <UserIcon className="h-3 w-3 text-blue-400" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-blue-400 text-xs font-medium">Asignada a {quote.quote_request.assigned_to_name || 'vendedor'}</p>
                            <p className="text-neutral-500 text-xs">{formatDate(quote.quote_request.assigned_at)}</p>
                          </div>
                        </div>
                      )}

                      {/* Request: Created */}
                      <Link
                        href={`/${locale}/dashboard/solicitudes/${quote.quote_request.id}`}
                        className="relative flex items-start gap-3 group"
                      >
                        <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-neutral-600">
                          <ChatBubbleLeftIcon className="h-3 w-3 text-neutral-400" />
                        </div>
                        <div className="flex-1 -mt-0.5">
                          <p className="text-neutral-400 text-xs font-medium">Solicitud de cotización</p>
                          <p className="text-neutral-500 text-xs">
                            {quote.quote_request.customer_name} · {formatDate(quote.quote_request.created_at)}
                          </p>
                          <span className="text-cmyk-cyan text-xs group-hover:underline mt-0.5 inline-block">
                            #{quote.quote_request.request_number} →
                          </span>
                        </div>
                      </Link>
                    </>
                  )}

                  {/* Fallback: Quote created without request */}
                  {!quote.quote_request && (
                    <div className="relative flex items-start gap-3">
                      <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-neutral-600">
                        <PencilIcon className="h-3 w-3 text-neutral-400" />
                      </div>
                      <div className="flex-1 -mt-0.5">
                        <p className="text-neutral-400 text-xs font-medium">Cotización directa</p>
                        <p className="text-neutral-500 text-xs">Sin solicitud de cotización</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Validity */}
              <div className="mt-4 pt-4 border-t border-neutral-700">
                <div className="flex items-center justify-between">
                  <p className="text-neutral-500 text-sm">Válida hasta</p>
                  <p className={`text-sm font-medium ${quote.is_expired ? 'text-red-400' : 'text-white'}`}>
                    {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                    {quote.is_expired && ' (Expirada)'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Payment Info */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Pago</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-neutral-500 text-sm">Modo de pago</p>
                  <p className="text-white">Pago completo</p>
                </div>
                {quote.payment_conditions && (
                  <div>
                    <p className="text-neutral-500 text-sm">Condiciones</p>
                    <p className="text-neutral-300">{quote.payment_conditions}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Internal Notes - Editable */}
            <Card className="p-6 border-yellow-500/30">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-yellow-400">Notas Internas</h2>
                {!isEditingNotes && quote.internal_notes && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditedNotes(quote.internal_notes || ''); setIsEditingNotes(true); }}
                      className="p-1 text-neutral-500 hover:text-yellow-400 transition-colors"
                      title="Editar notas"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleDeleteNotes}
                      disabled={isSavingNotes}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Eliminar notas"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {isEditingNotes ? (
                <div className="space-y-3">
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-600 rounded-lg p-3 text-neutral-200 text-sm placeholder-neutral-500 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 focus:outline-none resize-y min-h-[80px]"
                    placeholder="Notas internas para el equipo..."
                    rows={3}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setIsEditingNotes(false)}
                      className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="px-3 py-1.5 text-sm bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
                    >
                      {isSavingNotes ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : quote.internal_notes ? (
                <p className="text-neutral-300 whitespace-pre-wrap text-sm">{quote.internal_notes}</p>
              ) : (
                <button
                  onClick={() => { setEditedNotes(''); setIsEditingNotes(true); }}
                  className="w-full py-3 border border-dashed border-neutral-700 rounded-lg text-neutral-500 text-sm hover:border-yellow-500/40 hover:text-yellow-400/70 transition-colors flex items-center justify-center gap-2"
                >
                  <PencilIcon className="h-4 w-4" />
                  Agregar notas internas
                </button>
              )}
            </Card>

            {/* Attachments */}
            {quote.attachments && quote.attachments.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <PaperClipIcon className="h-5 w-5 text-neutral-400" />
                  Archivos Adjuntos ({quote.attachments.length})
                </h2>
                <div className="space-y-2">
                  {quote.attachments.map((att) => {
                    const isImage = att.file_type?.startsWith('image/');
                    return (
                      <div key={att.id} className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
                        {isImage ? (
                          <a href={att.file} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <img
                              src={att.file}
                              alt={att.filename}
                              className="w-16 h-16 object-cover rounded border border-neutral-600 hover:border-cmyk-cyan transition-colors"
                            />
                          </a>
                        ) : (
                          <div className="w-10 h-10 flex items-center justify-center bg-neutral-700 rounded flex-shrink-0">
                            <PaperClipIcon className="h-5 w-5 text-neutral-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <a
                            href={att.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-cmyk-cyan hover:underline truncate block"
                          >
                            {att.filename}
                          </a>
                          <p className="text-xs text-neutral-500">
                            {att.file_size > 0 && `${(att.file_size / 1024).toFixed(0)} KB`}
                            {att.file_type && ` · ${att.file_type}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Terms & Conditions */}
            {quote.terms && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Términos y Condiciones</h2>
                <p className="text-neutral-300 whitespace-pre-wrap text-sm">{quote.terms}</p>
              </Card>
            )}

            </div>{/* end non-sticky wrapper */}

            {/* Acciones — sticky */}
            <div className="xl:sticky xl:top-20 mt-6 z-10">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Acciones</h3>
                <div className="space-y-2">
                  {quote.status === 'draft' && quote.version > 1 && (
                    <>
                      <Link href={`/${locale}/dashboard/cotizaciones/${quote.id}/editar`} className="block">
                        <Button variant="outline" leftIcon={<PencilIcon className="h-4 w-4" />} className="w-full justify-center">
                          Editar
                        </Button>
                      </Link>
                    </>
                  )}
                  {quote.status === 'draft' && (
                    <Button
                      onClick={() => setShowSendConfirm(true)}
                      disabled={isSending}
                      leftIcon={<PaperAirplaneIcon className="h-4 w-4" />}
                      className="w-full justify-center"
                    >
                      {isSending ? 'Enviando...' : 'Enviar al cliente'}
                    </Button>
                  )}
                  {quote.status === 'changes_requested' && (() => {
                    const pendingCRs = changeRequests.filter(cr => cr.status === 'pending');
                    if (pendingCRs.length === 0) return null;
                    return (
                      <>
                        {pendingCRs.map((cr, idx) => (
                          <Link
                            key={cr.id}
                            href={`/${locale}/dashboard/cotizaciones/${quote.id}/cambios/${cr.id}`}
                            className="block"
                          >
                            <Button
                              leftIcon={<PencilSquareIcon className="h-4 w-4" />}
                              className="w-full justify-center bg-orange-600 hover:bg-orange-700 text-white"
                            >
                              {pendingCRs.length === 1
                                ? 'Revisar Solicitud de Cambios'
                                : `Revisar Cambio ${idx + 1} de ${pendingCRs.length}`}
                            </Button>
                          </Link>
                        ))}
                      </>
                    );
                  })()}
                  {quote.status === 'accepted' && (
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-neutral-500 mb-2">Método al convertir</p>
                              <select
                                value={conversionPaymentMethod}
                                onChange={(e) => setConversionPaymentMethod(e.target.value as typeof conversionPaymentMethod)}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cmyk-cyan focus:outline-none"
                              >
                                {(quote.payment_methods && quote.payment_methods.length > 0
                                  ? Array.from(new Set(quote.payment_methods.map((method) => method.trim().toLowerCase())))
                                  : ['mercadopago', 'paypal', 'bank_transfer', 'cash']
                                ).map((method) => (
                                  <option key={method} value={method}>
                                    {getPaymentMethodLabel(method)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <Button
                              onClick={handleConvertToOrder}
                              disabled={isConverting}
                              leftIcon={<ShoppingCartIcon className="h-4 w-4" />}
                              className="w-full justify-center bg-green-600 hover:bg-green-700 text-white"
                            >
                              {isConverting ? 'Convirtiendo...' : 'Convertir a Pedido'}
                            </Button>
                          </div>
                  )}
                  {['sent', 'viewed', 'changes_requested'].includes(quote.status) && (
                    <Button
                      variant="outline"
                      onClick={handleResendEmail}
                      disabled={isSending}
                      leftIcon={<PaperAirplaneIcon className="h-4 w-4" />}
                      className="w-full justify-center"
                    >
                      {isSending ? 'Reenviando...' : 'Reenviar correo'}
                    </Button>
                  )}
                  {quote.pdf_file && (
                    <Button
                      variant="outline"
                      onClick={handleDownloadPdf}
                      disabled={isDownloadingPdf}
                      leftIcon={<PrinterIcon className="h-4 w-4" />}
                      className="w-full justify-center"
                    >
                      {isDownloadingPdf ? 'Descargando...' : 'Ver PDF'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleRegeneratePdf}
                    disabled={isRegeneratingPdf}
                    leftIcon={<ArrowPathIcon className={`h-4 w-4 ${isRegeneratingPdf ? 'animate-spin' : ''}`} />}
                    className="w-full justify-center"
                  >
                    {isRegeneratingPdf ? 'Regenerando...' : 'Regenerar PDF'}
                  </Button>
                  {quote.quote_request && (
                    <Button
                      variant="outline"
                      onClick={() => handleFixDeliveryData(false)}
                      disabled={isFixingDelivery}
                      leftIcon={<WrenchScrewdriverIcon className={`h-4 w-4 ${isFixingDelivery ? 'animate-spin' : ''}`} />}
                      className="w-full justify-center text-amber-400 border-amber-400/50 hover:bg-amber-400/10"
                    >
                      {isFixingDelivery ? 'Restaurando...' : 'Restaurar datos de entrega'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleStartEditShipping}
                    disabled={editingShippingCosts}
                    leftIcon={<CurrencyDollarIcon className="h-4 w-4" />}
                    className="w-full justify-center text-amber-400 border-amber-400/50 hover:bg-amber-400/10"
                  >
                    Editar precios de envío
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDuplicateQuote}
                    disabled={isDuplicating}
                    leftIcon={<DocumentDuplicateIcon className="h-4 w-4" />}
                    className="w-full justify-center"
                  >
                    {isDuplicating ? 'Duplicando...' : 'Duplicar'}
                  </Button>
                  {quote.status === 'draft' && (
                    <Button
                      variant="outline"
                      onClick={handleDeleteQuote}
                      disabled={isDeleting}
                      className="w-full justify-center text-red-400 border-red-400/50 hover:bg-red-400/10"
                      leftIcon={<TrashIcon className="h-4 w-4" />}
                    >
                      {isDeleting ? 'Eliminando...' : 'Eliminar'}
                    </Button>
                  )}
                </div>
              </Card>
            </div>

          </div>
        </div>

    {/* Send Confirmation Modal */}
    {quote && (
      <SendConfirmationModal
        isOpen={showSendConfirm}
        onClose={() => setShowSendConfirm(false)}
        onConfirm={() => {
          setShowSendConfirm(false);
          handleSendQuote();
        }}
        isLoading={isSending}
        customerName={quote.customer_name}
        customerEmail={quote.customer_email}
        lines={quote.lines || []}
        subtotal={quote.subtotal}
        taxAmount={quote.tax_amount}
        total={quote.total}
      />
    )}

    {/* Success/Error Modal */}
    <SuccessModal
      isOpen={modal.open}
      onClose={() => {
        setModal((m) => ({ ...m, open: false }));
        if (modal.variant === 'success' && modal.redirectTo) {
          router.push(modal.redirectTo);
        }
      }}
      title={modal.title}
      message={modal.message}
      variant={modal.variant}
    />
    </div>
  );
}
