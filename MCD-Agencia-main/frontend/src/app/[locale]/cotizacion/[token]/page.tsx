'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  PlusCircleIcon,
  PaperClipIcon,
  PaperAirplaneIcon,
  EyeIcon,
  PencilIcon,
  UserIcon,
  DocumentTextIcon,
  CalendarIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  MapPinIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

import { Card, Badge, Button, LoadingPage } from '@/components/ui';
import SignaturePad from '@/components/ui/SignaturePad';
import QuoteChangeEditor from '@/components/quotes/QuoteChangeEditor';
import { DELIVERY_METHOD_LABELS, DELIVERY_METHOD_ICONS, type DeliveryMethod, SERVICE_LABELS, type ServiceId } from '@/lib/service-ids';
import { ServiceDetailsDisplay } from '@/components/quotes/ServiceDetailsDisplay';
import {
  viewQuoteByToken,
  acceptQuote,
  duplicateQuote,
  downloadQuotePdfByToken,
  rejectQuoteByToken,
  requestQuoteChanges,
  getQuoteResponsesByToken,
  getQuoteChangeRequests,
  Quote,
  QuoteResponse as QuoteResponseType,
  QuoteLine,
  QuoteAttachment,
  QuoteChangeRequest,
  SubmitChangeRequestData,
} from '@/lib/api/quotes';

type ResponseAction = 'accept' | 'reject' | null;

export default function QuoteViewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const locale = useLocale();
  const { isAuthenticated, user } = useAuth();
  const isMountedRef = useRef(true);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responseAction, setResponseAction] = useState<ResponseAction>(null);
  const [responseComment, setResponseComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showAuthRequired, setShowAuthRequired] = useState(false);
  const [pendingAction, setPendingAction] = useState<'accept' | 'reject' | null>(null);
  const [showChangeEditor, setShowChangeEditor] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [responses, setResponses] = useState<QuoteResponseType[]>([]);
  const [changeRequests, setChangeRequests] = useState<QuoteChangeRequest[]>([]);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Detect if the logged-in user is staff (admin/sales)
  const isStaff = isAuthenticated && user?.role?.name && ['admin', 'sales'].includes(user.role.name);

  const toggleService = (key: string) => {
    setExpandedServices(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Lock body scroll when change editor modal is open
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (showChangeEditor) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showChangeEditor]);

  // Check if user can perform authenticated actions (accept/reject)
  const canPerformAuthActions = isAuthenticated && user?.email === quote?.customer_email;

  useEffect(() => {
    const fetchQuote = async () => {
      if (!token) {
        setError('Token inválido');
        setIsLoading(false);
        return;
      }

      try {
        const data = await viewQuoteByToken(token);
        setQuote(data);
        // Fetch timeline data in parallel
        const [responsesData, crData] = await Promise.all([
          getQuoteResponsesByToken(token).catch(() => []),
          getQuoteChangeRequests(token).catch(() => ({ change_requests: [] })),
        ]);
        setResponses(responsesData);
        setChangeRequests(crData.change_requests || []);
      } catch (err) {
        console.error('Error fetching quote:', err);
        setError('No se pudo cargar la cotización. El enlace puede ser inválido o haber expirado.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuote();
  }, [token]);

  // ── Group quote lines by service (same logic as client page) ──
  const lineGroups = useMemo(() => {
    if (!quote?.lines) return [];
    const groups: { serviceType: string | undefined; lines: QuoteLine[] }[] = [];
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
      for (const group of lineGroups) {
        if (group.serviceType === quote.quote_request.service_type) {
          map.set(0, group.lines);
          break;
        }
      }
    }
    return map;
  }, [quote, lineGroups]);

  // Prefill existing request attachments into the change editor per matched line
  const existingAttachmentsByLineId = useMemo<Record<string, QuoteAttachment[]>>(() => {
    const byLineId: Record<string, QuoteAttachment[]> = {};
    if (!quote?.quote_request) return byLineId;

    const requestServices = quote.quote_request.services;
    if (requestServices && requestServices.length > 0) {
      requestServices.forEach((svc, idx) => {
        const attachments = Array.isArray(svc.attachments) ? svc.attachments : [];
        if (attachments.length === 0) return;
        const matchedLines = serviceToLinesMap.get(idx) || [];
        const primaryLine = matchedLines[0];
        if (!primaryLine?.id) return;
        byLineId[primaryLine.id] = attachments;
      });
      return byLineId;
    }

    const globalAttachments = Array.isArray(quote.quote_request.attachments)
      ? quote.quote_request.attachments
      : [];
    if (globalAttachments.length > 0 && quote.lines && quote.lines.length > 0) {
      byLineId[quote.lines[0].id] = globalAttachments;
    }

    return byLineId;
  }, [quote, serviceToLinesMap]);

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
      const vLines: QuoteLine[] = [];
      for (const group of lineGroups) {
        if (group.serviceType && remainingCounts.has(group.serviceType) && (remainingCounts.get(group.serviceType)! > 0)) {
          remainingCounts.set(group.serviceType, remainingCounts.get(group.serviceType)! - 1);
        } else {
          vLines.push(...group.lines);
        }
      }
      return vLines;
    }

    if (requestServiceType) {
      let matched = false;
      const vLines: QuoteLine[] = [];
      for (const group of lineGroups) {
        if (!matched && group.serviceType === requestServiceType) {
          matched = true;
        } else {
          vLines.push(...group.lines);
        }
      }
      return vLines;
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
        // Check if the last group has the same service type and could be a route continuation
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

  const handleDownloadPdf = async () => {
    if (!quote) return;

    setIsDownloading(true);
    try {
      await downloadQuotePdfByToken(token, quote.quote_number);
      toast.success('PDF descargado');
    } catch {
      toast.error('Error al descargar el PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  // Handler for accept action that requires authentication
  const handleAcceptClick = () => {
    if (!canPerformAuthActions) {
      setPendingAction('accept');
      setShowAuthRequired(true);
      return;
    }
    setResponseAction('accept');
  };

  const handleAccept = async () => {
    if (!quote) return;

    setIsSubmitting(true);
    try {
      const accepted = await acceptQuote(quote.id, responseComment, signatureData, signatureName);
      
      if (!isMountedRef.current) return;
      
      setResponseAction(null);
      toast.success('¡Cotización aceptada!');
      
      // Redirect immediately without setTimeout to avoid component unmount issues
      if (accepted.order_id) {
        router.push(`/${locale}/mi-cuenta/pedidos/${accepted.order_id}`);
      } else {
        router.push(`/${locale}/mi-cuenta/cotizaciones`);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      
      const err = error as { message?: string; response?: { data?: { error?: string } } };
      const errorMessage = err.response?.data?.error || err.message || 'Error al aceptar la cotización';
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!responseComment.trim()) {
      toast.error('Por favor indica el motivo del rechazo');
      return;
    }

    setIsSubmitting(true);
    try {
      await rejectQuoteByToken(token, responseComment);
      
      if (!isMountedRef.current) return;
      
      setResponseAction(null);
      toast.success('Cotización rechazada. Gracias por tu respuesta.');
      router.push(`/${locale}`);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      const err = error as { message?: string };
      toast.error(err.message || 'Error al rechazar la cotización');
      setIsSubmitting(false);
    }
  };

  const handleRequestChanges = async (data: SubmitChangeRequestData) => {
    setIsSubmitting(true);
    try {
      await requestQuoteChanges(token, data);
      setShowChangeEditor(false);
      setResponseComment('');
      toast.success('Tu solicitud de cambios ha sido enviada. Te contactaremos pronto.');
      window.location.reload();
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Error al enviar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(num || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return <LoadingPage message="Cargando cotización..." />;
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-cmyk-magenta mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Cotización no disponible</h1>
          <p className="text-neutral-400">{error || 'No se encontró la cotización.'}</p>
        </Card>
      </div>
    );
  }

  const getStatusVariant = (status: string) => {
    if (status === 'accepted') return 'success';
    if (status === 'rejected' || status === 'expired') return 'error';
    if (status === 'sent' || status === 'viewed') return 'info';
    if (status === 'changes_requested') return 'warning';
    return 'warning';
  };

  const canRespond = ['sent', 'viewed'].includes(quote.status) && !quote.is_expired;
  const isAccepted = quote.status === 'accepted';
  const isRejected = quote.status === 'rejected';
  const isChangesRequested = quote.status === 'changes_requested';

  return (
    <div className="min-h-screen pt-24 pb-8 px-4">
      <div className="max-w-5xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Cotización #{quote.quote_number}</h2>
            <p className="text-neutral-400">Recibida el {formatDate(quote.created_at)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={getStatusVariant(quote.status)} size="md">
              {quote.status_display}
            </Badge>
            {quote.is_expired && <Badge variant="error">Expirada</Badge>}
          </div>
        </div>

        {/* Status Banners */}
        {isAccepted && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-green-400 font-medium">Cotización Aceptada</p>
              {quote.accepted_at && (
                <p className="text-neutral-400 text-sm">Aceptada el {formatDate(quote.accepted_at)}</p>
              )}
            </div>
          </div>
        )}

        {isRejected && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <XCircleIcon className="h-6 w-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Cotización Rechazada</p>
              {quote.customer_notes && (
                <p className="text-neutral-400 text-sm mt-1">{quote.customer_notes}</p>
              )}
            </div>
          </div>
        )}

        {isChangesRequested && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-yellow-400 font-medium">Cambios Solicitados</p>
              <p className="text-neutral-400 text-sm mt-1">
                Tu solicitud de cambios está siendo revisada. Te enviaremos una cotización actualizada pronto.
              </p>
            </div>
          </div>
        )}

        {quote.is_expired && !isAccepted && !isRejected && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
            <ClockIcon className="h-6 w-6 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-yellow-400 font-medium">Cotización Expirada</p>
              {quote.valid_until && (
                <p className="text-neutral-400 text-sm">
                  Esta cotización venció el {formatDate(quote.valid_until)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Account Registration Banner — only for pending quotes when not logged in (hide for staff) */}
        {canRespond && !isAuthenticated && !isStaff && (
          <div className="p-4 bg-cmyk-cyan/10 border border-cmyk-cyan/30 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <UserPlusIcon className="h-6 w-6 text-cmyk-cyan flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Crea tu cuenta para gestionar tus cotizaciones</p>
                  <p className="text-neutral-400 text-sm mt-1">
                    Registrate con <strong className="text-white">{quote.customer_email}</strong> para poder aceptar cotizaciones, ver tu historial y dar seguimiento a tus pedidos.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                <Link href={`/${locale}/registro?email=${encodeURIComponent(quote.customer_email)}&redirect=/${locale}/cotizacion/${token}`}>
                  <Button leftIcon={<UserPlusIcon className="h-4 w-4" />}>
                    Crear cuenta
                  </Button>
                </Link>
                <Link href={`/${locale}/login?redirect=/${locale}/cotizacion/${token}`}>
                  <Button variant="outline">
                    Ya tengo cuenta
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {canRespond && isAuthenticated && !isStaff && user?.email === quote.customer_email && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
            <ShieldCheckIcon className="h-6 w-6 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">Sesión iniciada como {user.email}</p>
              <p className="text-neutral-400 text-sm">
                Puedes gestionar esta cotización y ver tu historial en{' '}
                <Link href={`/${locale}/mi-cuenta`} className="text-cmyk-cyan hover:underline">
                  Mi Cuenta
                </Link>
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Main Content */}
          <div className="xl:col-span-2 space-y-4">
            {/* Customer Info */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Tus datos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cmyk-cyan/10">
                    <BuildingOfficeIcon className="h-5 w-5 text-cmyk-cyan" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-neutral-500 text-xs">Cliente</p>
                    <p className="text-white break-words">{quote.customer_name}</p>
                    {(quote.customer_company || quote.quote_request?.customer_company) && (
                      <p className="text-neutral-400 text-sm break-words">
                        {quote.customer_company || quote.quote_request?.customer_company}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cmyk-cyan/10">
                    <EnvelopeIcon className="h-5 w-5 text-cmyk-cyan" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-neutral-500 text-xs">Email</p>
                    <p className="text-white text-sm leading-tight break-all">{quote.customer_email}</p>
                  </div>
                </div>
                {quote.customer_phone && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cmyk-cyan/10">
                      <PhoneIcon className="h-5 w-5 text-cmyk-cyan" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-neutral-500 text-xs">Teléfono</p>
                      <p className="text-white break-words">{quote.customer_phone}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Line Items (Conceptos) */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-white mb-3">Conceptos</h3>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500 text-xs border-b border-neutral-700">
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
                        <td className="py-2 pr-4">
                          <p className="text-white font-medium text-sm">{line.concept}</p>
                          {line.description && (
                            <p className="text-neutral-500 text-xs">{line.description}</p>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right text-white text-sm">{line.quantity}</td>
                        <td className="py-2 pr-4 text-neutral-400 text-sm">{line.unit}</td>
                        <td className="py-2 pr-4 text-right text-white text-sm">{formatCurrency(line.unit_price)}</td>
                        <td className="py-2 pr-4 text-right text-neutral-400 text-sm">
                          {parseFloat(line.shipping_cost || '0') > 0
                            ? formatCurrency(line.shipping_cost || '0')
                            : '—'}
                        </td>
                        <td className="py-2 text-right text-white font-medium text-sm">{formatCurrency(line.line_total)}</td>
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
                        <p className="text-white font-medium text-sm truncate">{line.concept}</p>
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
                        <p className="text-neutral-500">Unidad</p>
                        <p className="text-neutral-300">{line.unit}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">P. Unit.</p>
                        <p className="text-white">{formatCurrency(line.unit_price)}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Envío</p>
                        <p className="text-neutral-300">
                          {parseFloat(line.shipping_cost || '0') > 0
                            ? formatCurrency(line.shipping_cost || '0')
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-4 pt-3 border-t border-neutral-700 space-y-1.5">
                <div className="flex justify-between text-neutral-400 text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-400 text-sm">
                  <span>IVA ({Number(quote.tax_rate) * 100}%)</span>
                  <span>{formatCurrency(quote.tax_amount)}</span>
                </div>
                {(() => {
                  const shippingTotal = quote.lines?.reduce(
                    (sum, l) => sum + (parseFloat(l.shipping_cost || '0') || 0), 0
                  ) || 0;
                  return shippingTotal > 0 ? (
                    <div className="flex justify-between text-neutral-400 text-sm">
                      <span>Envío</span>
                      <span>{formatCurrency(shippingTotal)}</span>
                    </div>
                  ) : null;
                })()}
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-neutral-700">
                  <span>Total</span>
                  <span className="text-cyan-400">{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </Card>

            {/* Service Details — Solicitud Original (accordion) */}
            {quote.quote_request && (
              <Card className="p-6 border-cmyk-cyan/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5 text-cmyk-cyan" />
                  Detalles de la Solicitud
                </h3>

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

                {/* ── Single-service rendering (collapsible accordion) ── */}
                {(!quote.quote_request.services || quote.quote_request.services.length === 0) && quote.quote_request.service_type && (() => {
                  const singleKey = 'single-0';
                  const isOpen = expandedServices.has(singleKey);
                  const svcLabel = SERVICE_LABELS[quote.quote_request.service_type as ServiceId] || quote.quote_request.service_type;
                  const matchedLines = serviceToLinesMap.get(0);
                  const svcTotal = matchedLines?.reduce((s, l) => s + (parseFloat(String(l.line_total || 0))), 0) || 0;
                  const firstEstDate = matchedLines?.find(l => l.estimated_delivery_date)?.estimated_delivery_date;
                  return (
                    <div className="rounded-lg border border-neutral-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleService(singleKey)}
                        className="w-full flex items-center gap-3 p-4 bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
                      >
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-cmyk-cyan/20 text-cmyk-cyan text-sm font-bold flex-shrink-0">
                          1
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{svcLabel}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {firstEstDate && (
                              <span className="text-neutral-400 text-xs flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {new Date(firstEstDate + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {svcTotal > 0 && (
                              <span className="text-green-400 text-xs font-medium">{formatCurrency(svcTotal)}</span>
                            )}
                          </div>
                        </div>
                        <ChevronDownIcon className={`h-5 w-5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="p-4 border-t border-neutral-700 space-y-4">
                          {/* Service Details */}
                          {(() => {
                            const lineWithDetails = quote.lines?.find(
                              (l) => l.service_details && Object.keys(l.service_details).length > 0
                            );
                            const effectiveSD = lineWithDetails?.service_details as Record<string, unknown> | undefined
                              ?? (quote.quote_request?.service_details as Record<string, unknown> | undefined);
                            const hasDetails = effectiveSD && Object.keys(effectiveSD).length > 0;
                            if (!hasDetails) return null;
                            return (
                              <div>
                                <p className="text-neutral-400 text-sm mb-3 font-medium">Parámetros del servicio</p>
                                <ServiceDetailsDisplay
                                  serviceType={quote.quote_request!.service_type}
                                  serviceDetails={effectiveSD}
                                  routePrices={matchedLines && matchedLines.length > 1
                                    ? matchedLines.reduce((acc, ml, mlIdx) => ({ ...acc, [mlIdx]: formatCurrency(ml.line_total) }), {} as Record<number, string>)
                                    : undefined
                                  }
                                />
                              </div>
                            );
                          })()}

                          {/* Generic fields fallback */}
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

                          {/* Required Date */}
                          {(() => {
                            const details = quote.quote_request?.service_details as Record<string, unknown> | undefined;
                            const hasRouteDates = details && Array.isArray(details.rutas) &&
                              (details.rutas as Array<Record<string, unknown>>).some(r => !!r.fecha_inicio);
                            if (hasRouteDates) return null;
                            const displayDate = quote.quote_request?.required_date;
                            if (!displayDate) return null;
                            return (
                              <div className="p-3 bg-neutral-800/50 rounded-lg flex items-center gap-3">
                                <CalendarIcon className="h-5 w-5 text-neutral-400" />
                                <div>
                                  <p className="text-neutral-500 text-xs">Fecha Requerida</p>
                                  <p className="text-white">
                                    {new Date(displayDate + 'T12:00:00').toLocaleDateString('es-MX', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })}
                                  </p>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Vendor's estimated delivery dates */}
                          {(() => {
                            if (!matchedLines) return null;
                            const datesInfo = matchedLines
                              .filter(l => l.estimated_delivery_date)
                              .map(l => ({ concept: l.concept, date: l.estimated_delivery_date! }));
                            if (datesInfo.length === 0) return null;
                            return (
                              <div className="p-3 bg-neutral-800/50 rounded-lg">
                                <p className="text-neutral-500 text-xs mb-2 flex items-center gap-1">
                                  <CalendarIcon className="h-3.5 w-3.5" />
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
                })()}

                {/* Vendor-added services for single-service view */}
                {(!quote.quote_request.services || quote.quote_request.services.length === 0) && quote.quote_request.service_type && vendorLineGroups.length > 0 && vendorLineGroups.map((vGroup, gIdx) => {
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
                    <div key={`vendor-${gIdx}`} className="rounded-lg border border-neutral-700 overflow-hidden mt-3">
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
                          {/* Service-specific parameters via ServiceDetailsDisplay */}
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

                          {/* Vendor's estimated delivery dates */}
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

                {/* ── Multi-service rendering (collapsible accordion) ── */}
                {quote.quote_request.services && quote.quote_request.services.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-neutral-400 text-sm font-medium">
                      {quote.quote_request.services.length + vendorLineGroups.length} servicio{(quote.quote_request.services.length + vendorLineGroups.length) > 1 ? 's' : ''} en esta cotización
                    </p>
                    {quote.quote_request.services.map((svc, idx) => {
                      const svcDetails = svc.service_details as Record<string, unknown> | undefined;
                      const hasRouteDates = svcDetails && Array.isArray(svcDetails.rutas) &&
                        (svcDetails.rutas as Array<Record<string, unknown>>).some(r => !!r.fecha_inicio);
                      const multiKey = `multi-${idx}`;
                      const isOpen = expandedServices.has(multiKey);
                      const svcLabel = SERVICE_LABELS[svc.service_type as ServiceId] || svc.service_type;
                      const matchedLines = serviceToLinesMap.get(idx);
                      const svcTotal = matchedLines?.reduce((s, l) => s + (parseFloat(String(l.line_total || 0))), 0) || 0;
                      const firstEstDate = matchedLines?.find(l => l.estimated_delivery_date)?.estimated_delivery_date;
                      const routeCount = svcDetails && Array.isArray(svcDetails.rutas) ? (svcDetails.rutas as unknown[]).length : 0;

                      return (
                        <div key={svc.id} className="rounded-lg border border-neutral-700 overflow-hidden">
                          {/* Accordion header */}
                          <button
                            type="button"
                            onClick={() => toggleService(multiKey)}
                            className="w-full flex items-center gap-3 p-4 bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
                          >
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-cmyk-cyan/20 text-cmyk-cyan text-sm font-bold flex-shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold text-sm truncate">
                                {svcLabel}
                                {routeCount > 1 && (
                                  <span className="ml-2 text-xs font-normal text-neutral-400">({routeCount} rutas)</span>
                                )}
                              </p>
                              {/* Per-route breakdown when multiple routes exist */}
                              {matchedLines && matchedLines.length > 1 ? (
                                <div className="mt-1 space-y-0.5">
                                  {matchedLines.map((ml, mlIdx) => {
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
                                  {svcTotal > 0 && (
                                    <span className="text-green-400 text-xs font-medium">{formatCurrency(svcTotal)}</span>
                                  )}
                                  {svc.delivery_method && (
                                    <span className="text-neutral-500 text-xs flex items-center gap-1">
                                      <span className="text-xs">{DELIVERY_METHOD_ICONS[svc.delivery_method as DeliveryMethod]}</span>
                                      {DELIVERY_METHOD_LABELS[svc.delivery_method as DeliveryMethod]?.es || svc.delivery_method}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <ChevronDownIcon className={`h-5 w-5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Accordion content */}
                          {isOpen && (
                            <div className="p-4 border-t border-neutral-700 space-y-3">
                              {/* Service-specific parameters */}
                              {svc.service_details && Object.keys(svc.service_details).length > 0 && (
                                <div>
                                  <ServiceDetailsDisplay
                                    serviceType={svc.service_type}
                                    serviceDetails={svc.service_details as Record<string, unknown>}
                                    routePrices={matchedLines && matchedLines.length > 1
                                      ? matchedLines.reduce((acc, ml, mlIdx) => ({ ...acc, [mlIdx]: formatCurrency(ml.line_total) }), {} as Record<number, string>)
                                      : undefined
                                    }
                                  />
                                </div>
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
                                    <p className="text-neutral-500 text-xs mb-1">
                                      {svc.delivery_method === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}
                                    </p>
                                    <p className="text-white font-medium mt-auto">
                                      {[svc.delivery_address.street || svc.delivery_address.calle,
                                        svc.delivery_address.exterior_number || svc.delivery_address.numero_exterior,
                                        svc.delivery_address.neighborhood || svc.delivery_address.colonia,
                                        svc.delivery_address.city || svc.delivery_address.ciudad,
                                        svc.delivery_address.state || svc.delivery_address.estado,
                                        svc.delivery_address.postal_code || svc.delivery_address.codigo_postal,
                                      ].filter(Boolean).join(', ')}
                                    </p>
                                  </div>
                                )}
                                {svc.required_date && !hasRouteDates && (
                                  <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                    <p className="text-neutral-500 text-xs mb-1">Fecha requerida</p>
                                    <p className="text-white font-medium mt-auto">
                                      {new Date(svc.required_date + 'T12:00:00').toLocaleDateString('es-MX', {
                                        year: 'numeric', month: 'short', day: 'numeric',
                                      })}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Vendor's estimated delivery dates from quote lines */}
                              {(() => {
                                if (!matchedLines) return null;
                                const datesInfo = matchedLines
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

                              {/* Per-service attachments */}
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
                                        <a
                                          key={att.id}
                                          href={att.file}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block p-2 bg-neutral-900/50 rounded hover:bg-neutral-700 transition-colors group"
                                        >
                                          {isImage && (
                                            <img
                                              src={att.file}
                                              alt={att.filename || 'Archivo'}
                                              className="w-full h-20 object-cover rounded mb-1"
                                            />
                                          )}
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

              </Card>
            )}



            {/* Request Attachments */}
            {quote.quote_request?.attachments && quote.quote_request.attachments.length > 0 && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <PaperClipIcon className="h-5 w-5 text-cmyk-cyan" />
                  Archivos de la Solicitud ({quote.quote_request.attachments.length})
                </h3>
                <div className="space-y-2">
                  {quote.quote_request.attachments.map((attachment) => {
                    const isImage = attachment.file_type?.startsWith('image/');
                    return (
                      <div key={attachment.id} className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
                        {isImage ? (
                          <a href={attachment.file} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <img
                              src={attachment.file}
                              alt={attachment.filename}
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
                            href={attachment.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-cmyk-cyan hover:underline truncate block"
                          >
                            {attachment.filename}
                          </a>
                          <p className="text-xs text-neutral-500">
                            {attachment.file_size > 0 && `${(attachment.file_size / 1024).toFixed(0)} KB`}
                            {attachment.file_type && ` · ${attachment.file_type}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Quote Attachments */}
            {quote.attachments && quote.attachments.length > 0 && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <PaperClipIcon className="h-5 w-5 text-neutral-400" />
                  Archivos Adjuntos ({quote.attachments.length})
                </h3>
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
          </div>

          {/* Sidebar */}
          <div>
            <div className="space-y-4">
              {/* Actions */}
              <div className="z-10">
                <Card className="p-4">
                  <h3 className="font-medium text-white text-xs mb-2">Acciones</h3>
                  <div className="space-y-2">
                    <Button
                      onClick={handleDownloadPdf}
                      disabled={isDownloading}
                      isLoading={isDownloading}
                      variant="outline"
                      className="w-full"
                      leftIcon={<DocumentArrowDownIcon className="h-4 w-4" />}
                    >
                      {isDownloading ? 'Descargando...' : 'Descargar PDF'}
                    </Button>

                    {isStaff ? (
                      /* Staff actions: Duplicate + link to dashboard */
                      <>
                        <Button
                          onClick={async () => {
                            if (!quote) return;
                            setIsDuplicating(true);
                            try {
                              const newQuote = await duplicateQuote(quote.id);
                              toast.success('Cotización duplicada');
                              router.push(`/${locale}/dashboard/cotizaciones/${newQuote.id}/editar`);
                            } catch {
                              toast.error('No se pudo duplicar la cotización');
                            } finally {
                              setIsDuplicating(false);
                            }
                          }}
                          disabled={isDuplicating}
                          isLoading={isDuplicating}
                          variant="outline"
                          className="w-full"
                          leftIcon={<DocumentDuplicateIcon className="h-4 w-4" />}
                        >
                          Duplicar Cotización
                        </Button>
                        <Link href={`/${locale}/dashboard/cotizaciones/${quote.id}`} className="block">
                          <Button
                            variant="outline"
                            className="w-full"
                            leftIcon={<ArrowTopRightOnSquareIcon className="h-4 w-4" />}
                          >
                            Ver en Panel de Control
                          </Button>
                        </Link>
                      </>
                    ) : (
                      /* Client actions */
                      <>
                        {canRespond && (
                          <>
                            <Button
                              onClick={handleAcceptClick}
                              className="w-full bg-green-600 hover:bg-green-700"
                              leftIcon={<CheckCircleIcon className="h-5 w-5" />}
                            >
                              Aceptar Cotización
                            </Button>
                            <Button
                              onClick={() => setResponseAction('reject')}
                              variant="outline"
                              className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                              leftIcon={<XCircleIcon className="h-5 w-5" />}
                            >
                              Rechazar
                            </Button>
                            <Button
                              onClick={() => setShowChangeEditor(true)}
                              variant="outline"
                              className="w-full"
                              leftIcon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
                            >
                              Solicitar Cambios
                            </Button>
                          </>
                        )}

                        {isRejected && (
                          <Link href={`/${locale}/#cotizar`} className="block">
                            <Button
                              variant="outline"
                              className="w-full"
                              leftIcon={<PlusCircleIcon className="h-5 w-5" />}
                            >
                              Solicitar Nueva Cotización
                            </Button>
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              </div>

              {/* Validity */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDaysIcon className="h-4 w-4 text-cmyk-cyan" />
                  <h3 className="font-medium text-white text-xs">Vigencia</h3>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-neutral-500 text-xs">Versión</p>
                    <p className="text-white text-sm">v{quote.version}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500 text-xs">Fecha de emisión</p>
                    <p className="text-white text-sm">{formatDate(quote.created_at)}</p>
                  </div>
                  {quote.valid_until && (
                    <div>
                      <p className="text-neutral-500 text-xs">Válida hasta</p>
                      <p className={`font-medium text-sm ${quote.is_expired ? 'text-red-400' : 'text-white'}`}>
                        {formatDate(quote.valid_until)}
                        {quote.is_expired && ' (Expirada)'}
                      </p>
                    </div>
                  )}
                  {quote.estimated_delivery_date && (
                    <div>
                      <p className="text-neutral-500 text-xs">Fecha estimada de entrega</p>
                      <p className="text-white text-sm">{formatDate(quote.estimated_delivery_date)}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Payment */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CurrencyDollarIcon className="h-4 w-4 text-cmyk-cyan" />
                  <h3 className="font-medium text-white text-xs">Pago</h3>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-neutral-500 text-xs">Modo de pago</p>
                    <p className="text-white text-sm">
                      {quote.payment_mode === 'FULL' ? 'Pago completo' : 'Anticipo permitido'}
                    </p>
                  </div>
                  {quote.payment_mode === 'DEPOSIT_ALLOWED' && quote.deposit_percentage && (
                    <div>
                      <p className="text-neutral-500 text-xs">Anticipo requerido</p>
                      <p className="text-white text-sm">
                        {quote.deposit_percentage}% ({formatCurrency(quote.deposit_amount || '0')})
                      </p>
                    </div>
                  )}
                  {quote.payment_conditions && (
                    <div>
                      <p className="text-neutral-500 text-xs">Condiciones</p>
                      <p className="text-neutral-300 text-xs">{quote.payment_conditions}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Delivery Info */}
              {(quote.delivery_method || quote.estimated_delivery_date) && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TruckIcon className="h-4 w-4 text-cmyk-cyan" />
                    <h3 className="font-medium text-white text-xs">Entrega</h3>
                  </div>
                  <div className="space-y-2">
                    {quote.delivery_method && (
                      <div>
                        <p className="text-neutral-500 text-xs">Método de Entrega</p>
                        <p className="text-white text-sm flex items-center gap-2">
                          <span>{DELIVERY_METHOD_ICONS[quote.delivery_method as DeliveryMethod]}</span>
                          {DELIVERY_METHOD_LABELS[quote.delivery_method as DeliveryMethod]?.es || quote.delivery_method}
                        </p>
                      </div>
                    )}
                    {quote.pickup_branch_detail && (
                      <div>
                        <p className="text-neutral-500 text-xs">Sucursal de recolección</p>
                        <p className="text-white text-sm">{quote.pickup_branch_detail.name} — {quote.pickup_branch_detail.city}, {quote.pickup_branch_detail.state}</p>
                      </div>
                    )}
                    {quote.delivery_address && Object.keys(quote.delivery_address).length > 0 && (
                      <div>
                        <p className="text-neutral-500 text-xs">
                          {quote.delivery_method === 'installation' ? 'Dirección de Instalación' : 'Dirección de Envío'}
                        </p>
                        <p className="text-white text-sm">
                          {[quote.delivery_address.street || quote.delivery_address.calle, quote.delivery_address.exterior_number || quote.delivery_address.numero_exterior, quote.delivery_address.neighborhood || quote.delivery_address.colonia, quote.delivery_address.city || quote.delivery_address.ciudad, quote.delivery_address.state || quote.delivery_address.estado, quote.delivery_address.postal_code || quote.delivery_address.codigo_postal].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Timeline / Historial */}
              {(responses.length > 0 || changeRequests.length > 0 || quote.sent_at) && (() => {
                type TimelineEvent =
                  | { type: 'response'; date: string; data: QuoteResponseType }
                  | { type: 'change_request'; date: string; data: QuoteChangeRequest }
                  | { type: 'change_request_reviewed'; date: string; data: QuoteChangeRequest };

                const eventsList: TimelineEvent[] = [
                  ...responses.map(r => ({ type: 'response' as const, date: r.created_at, data: r })),
                  ...changeRequests.map(cr => ({ type: 'change_request' as const, date: cr.created_at, data: cr })),
                  ...changeRequests
                    .filter(cr => cr.status !== 'pending' && cr.reviewed_at)
                    .map(cr => ({ type: 'change_request_reviewed' as const, date: cr.reviewed_at!, data: cr })),
                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                const sendResponses = responses.filter(r => r.action === 'send').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                const sendVersionMap = new Map<string, number>();
                sendResponses.forEach((r, i) => sendVersionMap.set(r.id, i + 1));
                const hasSendResponses = sendResponses.length > 0;

                const sortedCRs = [...changeRequests].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                const crVersionMap = new Map<string, number>();
                sortedCRs.forEach((cr, i) => crVersionMap.set(cr.id, i + 2));

                const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                return (
                <Card className="p-4">
                  <h3 className="font-medium text-white text-xs mb-3 flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-cmyk-cyan" />
                    Historial
                  </h3>
                  <div className="relative">
                    <div className="absolute left-[9px] top-2 bottom-2 w-px bg-neutral-700 z-0"></div>
                    <div className="space-y-4">
                      {eventsList.map((event, idx) => {
                        const circleBase = 'relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900';

                        if (event.type === 'change_request') {
                          const cr = event.data;
                          const crVersion = crVersionMap.get(cr.id) || 2;
                          return (
                            <div key={`cr-${cr.id}`} className="relative flex items-start gap-3">
                              <div className={`${circleBase} border-orange-500/60`}>
                                <PencilIcon className="h-3 w-3 text-orange-400" />
                              </div>
                              <div className="flex-1 -mt-0.5">
                                <p className="text-orange-400 text-xs font-medium">
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
                                <p className="text-neutral-500 text-xs">{fmtDate(cr.created_at)}</p>
                                {cr.customer_comments ? (
                                  <p className="text-neutral-500 text-xs mt-0.5 line-clamp-2">
                                    &ldquo;{cr.customer_comments}&rdquo;
                                  </p>
                                ) : (() => {
                                  const comments = (cr.proposed_lines || []).filter(pl => pl.description?.trim() && pl.action !== 'delete');
                                  return comments.length > 0 ? (
                                    <p className="text-neutral-500 text-xs mt-0.5 line-clamp-2">
                                      {comments.map(pl => `"${pl.description?.trim()}"`).slice(0, 2).join(', ')}
                                      {comments.length > 2 ? ` (+${comments.length - 2})` : ''}
                                    </p>
                                  ) : null;
                                })()}
                                {cr.attachments && cr.attachments.length > 0 && (
                                  <div className="mt-1.5 space-y-1">
                                    <p className="text-neutral-500 text-xs flex items-center gap-1">
                                      <PaperClipIcon className="h-3 w-3" />
                                      {cr.attachments.length} adjunto{cr.attachments.length > 1 ? 's' : ''}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {cr.attachments.map((att) => {
                                        const isImage = att.file_type?.startsWith('image/');
                                        return isImage ? (
                                          <a key={att.id} href={att.file} target="_blank" rel="noopener noreferrer">
                                            <img
                                              src={att.file}
                                              alt={att.filename}
                                              className="w-12 h-12 object-cover rounded border border-neutral-600 hover:border-cmyk-cyan transition-colors"
                                            />
                                          </a>
                                        ) : (
                                          <a
                                            key={att.id}
                                            href={att.file}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-1.5 py-0.5 bg-neutral-800/50 rounded border border-neutral-700/50 text-[10px] text-cmyk-cyan hover:underline"
                                          >
                                            <PaperClipIcon className="h-2.5 w-2.5 text-neutral-400" />
                                            {att.filename}
                                          </a>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (event.type === 'change_request_reviewed') {
                          const cr = event.data;
                          const isApproved = cr.status === 'approved';
                          return (
                            <div key={`cr-review-${cr.id}`} className="relative flex items-start gap-3">
                              <div className={`${circleBase} ${
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
                                  <p className="text-neutral-400 text-xs mt-1 bg-neutral-800/50 rounded p-1.5 line-clamp-2">
                                    &ldquo;{cr.review_notes}&rdquo;
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }

                        const response = event.data as QuoteResponseType;

                        if (response.action === 'send') {
                          const version = sendVersionMap.get(response.id) || 1;
                          const versionLabel = version > 1 ? ` v${version}` : '';
                          return (
                            <div key={`r-${response.id}`} className="relative flex items-start gap-3">
                              <div className={`${circleBase} border-cmyk-cyan/60`}>
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
                              </div>
                            </div>
                          );
                        }

                        if (response.action === 'view') {
                          return (
                            <div key={`r-${response.id}`} className="relative flex items-start gap-3">
                              <div className={`${circleBase} border-purple-500/60`}>
                                <EyeIcon className="h-3 w-3 text-purple-400" />
                              </div>
                              <div className="flex-1 -mt-0.5">
                                <p className="text-purple-400 text-xs font-medium">Cotización vista</p>
                                <p className="text-neutral-500 text-xs">{fmtDate(response.created_at)}</p>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={`r-${response.id}-${idx}`} className="relative flex items-start gap-3">
                            <div className={`${circleBase} ${
                              response.action === 'approval' ? 'border-green-500/60' :
                              response.action === 'rejection' ? 'border-red-500/60' :
                              'border-blue-500/60'
                            }`}>
                              {response.action === 'approval' && <CheckCircleIcon className="h-3 w-3 text-green-400" />}
                              {response.action === 'rejection' && <XCircleIcon className="h-3 w-3 text-red-400" />}
                              {response.action === 'comment' && <PencilIcon className="h-3 w-3 text-blue-400" />}
                            </div>
                            <div className="flex-1 -mt-0.5">
                              <p className={`text-xs font-medium ${
                                response.action === 'approval' ? 'text-green-400' :
                                response.action === 'rejection' ? 'text-red-400' : 'text-blue-400'
                              }`}>
                                {response.action === 'approval' ? 'Cotización aceptada' :
                                 response.action === 'rejection' ? 'Cotización rechazada' :
                                 response.action_display || 'Comentario'}
                              </p>
                              <p className="text-neutral-500 text-xs">{fmtDate(response.created_at)}</p>
                              {response.comment && (
                                <p className="text-neutral-400 text-xs mt-1 bg-neutral-800/50 rounded p-1.5 line-clamp-2">
                                  &ldquo;{response.comment}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {quote.sent_at && !hasSendResponses && (
                        <div className="relative flex items-start gap-3">
                          <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-cmyk-cyan/60">
                            <PaperAirplaneIcon className="h-3 w-3 text-cmyk-cyan" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-cmyk-cyan text-xs font-medium">
                              Cotización creada y enviada
                            </p>
                            <p className="text-neutral-500 text-xs">{formatDate(quote.sent_at)}</p>
                          </div>
                        </div>
                      )}

                      {/* Request created — the original customer request */}
                      {quote.quote_request && (
                        <>
                          <div className="relative flex items-center gap-3 py-1">
                            <div className="relative z-10 w-5 flex justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-neutral-600"></div>
                            </div>
                            <div className="flex-1 border-t border-dashed border-neutral-700"></div>
                          </div>

                          {quote.quote_request.status !== 'pending' && (
                            <div className="relative flex items-start gap-3">
                              <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-yellow-500/60">
                                <ClockIcon className="h-3 w-3 text-yellow-400" />
                              </div>
                              <div className="flex-1 -mt-0.5">
                                <p className="text-yellow-400 text-xs font-medium">Solicitud en revisión</p>
                                <p className="text-neutral-500 text-xs">{formatDate(quote.quote_request.updated_at)}</p>
                              </div>
                            </div>
                          )}

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

                          <div className="relative flex items-start gap-3">
                            <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-neutral-600">
                              <ChatBubbleLeftRightIcon className="h-3 w-3 text-neutral-400" />
                            </div>
                            <div className="flex-1 -mt-0.5">
                              <p className="text-neutral-400 text-xs font-medium">
                                Solicitud de cotización
                              </p>
                              <p className="text-neutral-500 text-xs">
                                {quote.quote_request.customer_name} · {formatDate(quote.quote_request.created_at)}
                              </p>
                              {quote.quote_request.request_number && (
                                <p className="text-cmyk-cyan text-xs mt-0.5">
                                  #{quote.quote_request.request_number}
                                </p>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
                );
              })()}

              {/* Terms */}
              {quote.terms && (
                <Card className="p-4">
                  <h3 className="font-medium text-white text-xs mb-2">Términos y Condiciones</h3>
                  <p className="text-neutral-300 text-xs whitespace-pre-wrap">{quote.terms}</p>
                </Card>
              )}

              {/* Contact */}
              <Card className="p-4 bg-cmyk-cyan/5 border-cmyk-cyan/20">
                <h3 className="font-medium text-white text-xs mb-2">¿Tienes preguntas?</h3>
                <p className="text-neutral-400 text-xs mb-3">
                  Contáctanos para cualquier duda sobre esta cotización.
                </p>
                <a
                  href="mailto:ventas@mcd-agencia.com"
                  className="text-cmyk-cyan hover:underline text-xs"
                >
                  ventas@mcd-agencia.com
                </a>
              </Card>
            </div>

          </div>
        </div>

        {/* Response Modal (Accept/Reject) */}
        {responseAction && (responseAction === 'accept' || responseAction === 'reject') && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {responseAction === 'accept' ? 'Aceptar Cotización' : 'Rechazar Cotización'}
              </h3>

              {responseAction === 'accept' ? (
                <div className="mb-4">
                  <p className="text-neutral-300 mb-4">
                    ¿Estás seguro de que deseas aceptar esta cotización por{' '}
                    <strong className="text-white">{formatCurrency(quote.total)}</strong>?
                  </p>

                  <label className="block text-neutral-400 text-sm mb-2">
                    Firma electrónica (opcional)
                  </label>
                  <SignaturePad onChange={setSignatureData} width={380} height={160} />

                  <label className="block text-neutral-400 text-sm mb-2 mt-4">
                    Nombre del firmante
                  </label>
                  <input
                    type="text"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Tu nombre completo"
                    className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan mb-4"
                  />

                  <label className="block text-neutral-400 text-sm mb-2">
                    Notas adicionales (opcional)
                  </label>
                  <textarea
                    value={responseComment}
                    onChange={(e) => setResponseComment(e.target.value)}
                    placeholder="Comentarios o instrucciones especiales..."
                    rows={3}
                    className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan resize-none"
                  />
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block text-neutral-400 text-sm mb-2">
                    Motivo del rechazo *
                  </label>
                  <textarea
                    value={responseComment}
                    onChange={(e) => setResponseComment(e.target.value)}
                    placeholder="Por favor, indícanos el motivo..."
                    rows={4}
                    className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan resize-none"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setResponseAction(null);
                    setResponseComment('');
                    setSignatureData(null);
                    setSignatureName('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={responseAction === 'accept' ? handleAccept : handleReject}
                  disabled={isSubmitting || (responseAction === 'reject' && !responseComment.trim())}
                  isLoading={isSubmitting}
                  className={`flex-1 ${
                    responseAction === 'accept'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Confirmar
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Change Request Editor Modal */}
        {showChangeEditor && (
          <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-[70] p-4 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            <div className="w-full max-w-2xl my-8">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">
                    Solicitar cambios en la cotización
                  </h2>
                  <button
                    onClick={() => setShowChangeEditor(false)}
                    className="text-neutral-400 hover:text-white"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>
                <QuoteChangeEditor
                  lines={quote.lines}
                  existingAttachmentsByLineId={existingAttachmentsByLineId}
                  onSubmit={handleRequestChanges}
                  onCancel={() => setShowChangeEditor(false)}
                  isSubmitting={isSubmitting}
                />
              </Card>
            </div>
          </div>
        )}

        {/* Authentication Required Modal (only for accept) */}
        {showAuthRequired && quote && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
            <Card className="w-full max-w-md p-6">
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-cmyk-cyan/10 flex items-center justify-center mb-4">
                  <ShieldCheckIcon className="h-8 w-8 text-cmyk-cyan" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Verificación de identidad requerida
                </h3>
                <p className="text-neutral-400 text-sm">
                  Para aceptar esta cotización necesitas verificar tu identidad creando una cuenta o iniciando sesión.
                </p>
              </div>

              {isAuthenticated && user?.email !== quote.customer_email && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    <strong>Nota:</strong> Estás conectado como <strong>{user?.email}</strong>, pero esta cotización está dirigida a <strong>{quote.customer_email}</strong>. Debes iniciar sesión con el correo correcto.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-neutral-300 text-sm text-center">
                  Registrate o inicia sesión con <strong className="text-white">{quote.customer_email}</strong>
                </p>

                <Link
                  href={`/${locale}/registro?email=${encodeURIComponent(quote.customer_email)}&redirect=/${locale}/cotizacion/${token}`}
                  className="block"
                >
                  <Button className="w-full" leftIcon={<UserPlusIcon className="h-4 w-4" />}>
                    Crear cuenta
                  </Button>
                </Link>

                <Link
                  href={`/${locale}/login?redirect=/${locale}/cotizacion/${token}`}
                  className="block"
                >
                  <Button variant="outline" className="w-full">
                    Ya tengo cuenta
                  </Button>
                </Link>

                <Button
                  onClick={() => {
                    setShowAuthRequired(false);
                    setPendingAction(null);
                  }}
                  variant="ghost"
                  className="w-full text-neutral-400 hover:text-white"
                >
                  Cancelar
                </Button>
              </div>

              <p className="text-neutral-500 text-xs text-center mt-4">
                Tu cuenta te permitirá ver el historial de cotizaciones, dar seguimiento a pedidos y más.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
