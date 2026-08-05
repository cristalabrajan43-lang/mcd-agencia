'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  ChatBubbleLeftRightIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  PlusCircleIcon,
  PaperClipIcon,
  PaperAirplaneIcon,
  EyeIcon,
  PencilIcon,
  UserIcon,
  CalendarIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  MapPinIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

import {
  getQuoteById,
  downloadQuotePdfByToken,
  acceptQuote,
  rejectQuote,
  requestQuoteChanges,
  getQuoteResponses,
  getQuoteChangeRequests,
  Quote,
  QuoteResponse as QuoteResponseType,
  QuoteLine,
  QuoteAttachment,
  QuoteChangeRequest,
  SubmitChangeRequestData,
  ProposedLine,
} from '@/lib/api/quotes';
import { Card, Badge, Button, LoadingPage, Breadcrumb } from '@/components/ui';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import { DELIVERY_METHOD_LABELS, DELIVERY_METHOD_ICONS, type DeliveryMethod, SERVICE_LABELS, type ServiceId } from '@/lib/service-ids';
import SignaturePad from '@/components/ui/SignaturePad';
import QuoteChangeEditor from '@/components/quotes/QuoteChangeEditor';
import { ServiceDetailsDisplay } from '@/components/quotes/ServiceDetailsDisplay';
import { InlineServiceEditor, buildServiceEditData, validateServiceEditData, type ServiceEditData } from '@/components/quotes/InlineServiceEditor';
import { cleanServiceDetailsForApi } from '@/components/quotes/ServiceFormFields';

export default function CustomerQuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const quoteId = params.id as string;
  const isMountedRef = useRef(true);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [responseAction, setResponseAction] = useState<'accept' | 'reject' | null>(null);
  const [responseComment, setResponseComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showChangeEditor, setShowChangeEditor] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  // ── Edit mode state ──
  const [editMode, setEditMode] = useState(false);
  /** Per-service edit state, keyed by service index ("single-0", "multi-0", "vendor-0") */
  const [editDataMap, setEditDataMap] = useState<Record<string, ServiceEditData>>({});
  /** Services marked for deletion */
  const [deletedServiceKeys, setDeletedServiceKeys] = useState<Set<string>>(new Set());
  /** Global comments for the change request */
  const [editGlobalComments, setEditGlobalComments] = useState('');
  /** Global attachments for the change request */
  const [editGlobalFiles, setEditGlobalFiles] = useState<File[]>([]);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  /** Confirmation dialog type */
  const [confirmDialog, setConfirmDialog] = useState<'save' | 'cancel' | null>(null);

  const toggleService = (key: string) => {
    setExpandedServices(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Portal target for rendering Historial in the layout sidebar
  const [sidebarPortal, setSidebarPortal] = useState<HTMLElement | null>(null);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  useEffect(() => {
    const el = document.getElementById('sidebar-extra');
    if (el) setSidebarPortal(el);
    return () => { if (el) el.innerHTML = ''; };
  }, []);

  // Lock body scroll when change editor modal is open
  useEffect(() => {
    if (showChangeEditor) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showChangeEditor]);

  // Fetch quote + timeline data together so everything is cached by React Query
  const { data: quoteData, isLoading, error, refetch } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: async () => {
      const data = await getQuoteById(quoteId);
      // Fetch timeline data in parallel
      const [responsesData, crData] = await Promise.all([
        getQuoteResponses(quoteId).catch(() => []),
        data.token ? getQuoteChangeRequests(data.token).catch(() => ({ change_requests: [] })) : Promise.resolve({ change_requests: [] }),
      ]);
      return {
        quote: data,
        responses: responsesData,
        changeRequests: crData.change_requests || [],
      };
    },
  });

  const quote = quoteData?.quote ?? null;
  const responses = quoteData?.responses ?? [];
  const changeRequests = quoteData?.changeRequests ?? [];

  const handleDownloadPdf = async () => {
    if (!quote?.token || !quote?.quote_number) return;
    setIsDownloadingPdf(true);
    try {
      await downloadQuotePdfByToken(quote.token, quote.quote_number);
      toast.success('PDF descargado');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Error al descargar el PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleAccept = async () => {
    if (!quote) return;
    setIsSubmitting(true);
    try {
      const accepted = await acceptQuote(quote.id, responseComment, signatureData, signatureName);
      
      if (!isMountedRef.current) return;
      
      setResponseAction(null);
      setResponseComment('');
      toast.success('¡Cotización aceptada exitosamente!');
      if (accepted.order_id) {
        router.push(`/${locale}/mi-cuenta/pedidos/${accepted.order_id}`);
        return;
      }
      refetch();
    } catch (error) {
      if (!isMountedRef.current) return;
      
      const err = error as { message?: string; response?: { data?: { error?: string } } };
      const errorMessage = err.response?.data?.error || err.message || 'Error al aceptar la cotización';
      toast.error(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleReject = async () => {
    if (!quote) return;
    if (!responseComment.trim()) {
      toast.error('Por favor indica el motivo del rechazo');
      return;
    }
    setIsSubmitting(true);
    try {
      await rejectQuote(quote.id, responseComment);
      setResponseAction(null);
      setResponseComment('');
      toast.success('Cotización rechazada. Gracias por tu respuesta.');
      refetch();
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Error al rechazar la cotización');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestChanges = async (data: SubmitChangeRequestData) => {
    if (!quote?.token) return;
    setIsSubmitting(true);
    try {
      await requestQuoteChanges(quote.token, data);
      setShowChangeEditor(false);
      toast.success('Tu solicitud de cambios ha sido enviada. Te contactaremos pronto.');
      refetch();
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Error al enviar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Group quote lines by service (same logic as dashboard) ──
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

  // ── Edit mode helpers ──

  /** Build initial ServiceEditData from the quote's services/lines */
  const buildInitialEditMap = useCallback((): Record<string, ServiceEditData> => {
    if (!quote) return {};
    const map: Record<string, ServiceEditData> = {};

    const qr = quote.quote_request;
    if (!qr) return map;

    if (qr.services && qr.services.length > 0) {
      qr.services.forEach((svc, idx) => {
        const key = `multi-${idx}`;
        // Merge service_details from matched lines (line-level has richer data after vendor edits)
        const matchedLines = serviceToLinesMap.get(idx) || [];
        const lineSD = matchedLines.find(l => l.service_details && Object.keys(l.service_details).length > 0)?.service_details as Record<string, unknown> | undefined;
        const effectiveSD = lineSD ?? (svc.service_details as Record<string, unknown> | undefined);
        // Delivery info: prefer line-level (vendor may have set it), fall back to service-level
        const firstLine = matchedLines[0];
        // Per-route comments for route-based publicidad móvil (each line = one route)
        const isRouteBased = svc.service_type === 'publicidad-movil' &&
          ['vallas-moviles', 'perifoneo', 'publibuses'].includes(
            (effectiveSD?.subtipo as string) || (svc.service_details as Record<string, unknown> | undefined)?.subtipo as string || ''
          );
        const routeComments: Record<number, string> = {};
        if (isRouteBased && matchedLines.length > 0) {
          const rutas = (effectiveSD?.rutas ?? (svc.service_details as Record<string, unknown> | undefined)?.rutas) as Array<Record<string, unknown>> | undefined;
          matchedLines.forEach((ml, rIdx) => {
            routeComments[rIdx] = ml.description || (rutas?.[rIdx]?.comentarios as string) || '';
          });
        }
        // Comments: for non-route-based services, use line description → original description
        const lineComments = (!isRouteBased && firstLine?.description) || '';
        map[key] = buildServiceEditData({
          serviceType: svc.service_type || '',
          serviceDetails: effectiveSD,
          deliveryMethod: firstLine?.delivery_method || svc.delivery_method,
          deliveryAddress: (firstLine?.delivery_address || svc.delivery_address) as Record<string, string> | undefined,
          pickupBranch: firstLine?.pickup_branch || svc.pickup_branch,
          requiredDate: svc.required_date,
          comments: lineComments || (!isRouteBased ? svc.description || '' : ''),
          routeComments: isRouteBased ? routeComments : undefined,
          attachments: svc.attachments?.map(a => ({ id: a.id, file: a.file, filename: a.filename })) || [],
        });
      });
    } else if (qr.service_type) {
      // Single-service: merge service_details from lines (richer after vendor processing)
      const allNonVendorLines = (serviceToLinesMap.get(0) || []).length > 0
        ? serviceToLinesMap.get(0)!
        : (quote.lines || []).filter(l => !l.service_details?.vendor_added);
      const lineWithDetails = allNonVendorLines.find(
        l => l.service_details && Object.keys(l.service_details).length > 0
      ) || quote.lines?.find(
        l => l.service_details && Object.keys(l.service_details).length > 0
      );
      const effectiveSD = lineWithDetails?.service_details as Record<string, unknown> | undefined
        ?? (qr.service_details as Record<string, unknown> | undefined);
      // Delivery info: prefer line-level → quote-level → request-level
      const firstLine = allNonVendorLines[0] || quote.lines?.[0];
      // Per-route comments for route-based publicidad móvil
      const isRouteBased = qr.service_type === 'publicidad-movil' &&
        ['vallas-moviles', 'perifoneo', 'publibuses'].includes(
          (effectiveSD?.subtipo as string) || (qr.service_details as Record<string, unknown> | undefined)?.subtipo as string || ''
        );
      const routeComments: Record<number, string> = {};
      if (isRouteBased && allNonVendorLines.length > 0) {
        const rutas = (effectiveSD?.rutas ?? (qr.service_details as Record<string, unknown> | undefined)?.rutas) as Array<Record<string, unknown>> | undefined;
        allNonVendorLines.forEach((ml, rIdx) => {
          routeComments[rIdx] = ml.description || (rutas?.[rIdx]?.comentarios as string) || '';
        });
      }
      // Comments: for non-route-based services, use line description → original description
      const lineComments = (!isRouteBased && firstLine?.description) || '';
      map['single-0'] = buildServiceEditData({
        serviceType: qr.service_type || '',
        serviceDetails: effectiveSD,
        deliveryMethod: firstLine?.delivery_method || quote.delivery_method || qr.delivery_method,
        deliveryAddress: (firstLine?.delivery_address || quote.delivery_address || qr.delivery_address) as Record<string, string> | undefined,
        pickupBranch: firstLine?.pickup_branch || quote.pickup_branch || qr.pickup_branch,
        requiredDate: qr.required_date,
        comments: lineComments || (!isRouteBased ? qr.description || '' : ''),
        routeComments: isRouteBased ? routeComments : undefined,
        attachments: qr.attachments?.map(a => ({ id: a.id, file: a.file, filename: a.filename })) || [],
      });
    }

    vendorLineGroups.forEach((vGroup, gIdx) => {
      const key = `vendor-${gIdx}`;
      const vSD = vGroup.lines[0]?.service_details as Record<string, unknown> | undefined;
      map[key] = buildServiceEditData({
        serviceType: vGroup.serviceType || '',
        serviceDetails: vSD,
        deliveryMethod: vGroup.lines[0]?.delivery_method,
        deliveryAddress: vGroup.lines[0]?.delivery_address as Record<string, string> | undefined,
        pickupBranch: vGroup.lines[0]?.pickup_branch,
        requiredDate: '',
        comments: '',
        attachments: [],
      });
    });

    return map;
  }, [quote, vendorLineGroups, serviceToLinesMap]);

  const enterEditMode = useCallback(() => {
    if (!quote) return;
    const initialMap = buildInitialEditMap();
    setEditDataMap(initialMap);
    setDeletedServiceKeys(new Set());
    setEditGlobalComments('');
    setEditGlobalFiles([]);
    // Don't auto-expand accordions — let user open them manually
    setEditMode(true);
  }, [quote, buildInitialEditMap]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setEditDataMap({});
    setDeletedServiceKeys(new Set());
    setEditGlobalComments('');
    setEditGlobalFiles([]);
    setConfirmDialog(null);
  }, []);

  const handleEditServiceSave = useCallback((key: string, data: ServiceEditData) => {
    setEditDataMap(prev => ({ ...prev, [key]: data }));
    toast.success('Cambios guardados localmente');
  }, []);

  /** Keep editDataMap in sync with live edits (so global submit always has fresh data) */
  const handleEditDataChange = useCallback((key: string, data: ServiceEditData) => {
    setEditDataMap(prev => ({ ...prev, [key]: data }));
  }, []);

  const handleDeleteService = useCallback((key: string) => {
    setDeletedServiceKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    toast.success('Servicio marcado para eliminación');
  }, []);

  const handleUndoDeleteService = useCallback((key: string) => {
    setDeletedServiceKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleSubmitEditChanges = useCallback(async () => {
    if (!quote?.token) return;
    setConfirmDialog(null);
    setIsSubmitting(true);

    try {
      // ── Pre-submit validation: ensure all non-deleted services are valid ──
      for (const [key, svcData] of Object.entries(editDataMap)) {
        if (deletedServiceKeys.has(key)) continue;
        const errs = validateServiceEditData(svcData);
        if (errs.length > 0) {
          const svcLabel = svcData.serviceType
            ? (SERVICE_LABELS[svcData.serviceType as keyof typeof SERVICE_LABELS] || svcData.serviceType)
            : key;
          toast.error(`${svcLabel}: ${errs[0]}`);
          setIsSubmitting(false);
          return;
        }
      }

      const proposed_lines: ProposedLine[] = [];
      const initialMap = buildInitialEditMap();

      for (const [key, currentData] of Object.entries(editDataMap)) {
        if (deletedServiceKeys.has(key)) {
          let matchedLines: QuoteLine[] = [];
          if (key.startsWith('single-')) {
            matchedLines = serviceToLinesMap.get(0) || [];
          } else if (key.startsWith('multi-')) {
            const idx = parseInt(key.split('-')[1], 10);
            matchedLines = serviceToLinesMap.get(idx) || [];
          } else if (key.startsWith('vendor-')) {
            const gIdx = parseInt(key.split('-')[1], 10);
            matchedLines = vendorLineGroups[gIdx]?.lines || [];
          }
          for (const line of matchedLines) {
            proposed_lines.push({
              id: line.id,
              action: 'delete',
              concept: line.concept,
              quantity: line.quantity,
            });
          }
          continue;
        }

        const initialData = initialMap[key];
        if (!initialData) continue;

        let matchedLines: QuoteLine[] = [];
        if (key.startsWith('single-')) {
          matchedLines = serviceToLinesMap.get(0) || [];
        } else if (key.startsWith('multi-')) {
          const idx = parseInt(key.split('-')[1], 10);
          matchedLines = serviceToLinesMap.get(idx) || [];
        } else if (key.startsWith('vendor-')) {
          const gIdx = parseInt(key.split('-')[1], 10);
          matchedLines = vendorLineGroups[gIdx]?.lines || [];
        }

        const detailsChanged = JSON.stringify(currentData.details) !== JSON.stringify(initialData.details);
        const deliveryChanged = currentData.deliveryMethod !== initialData.deliveryMethod
          || JSON.stringify(currentData.deliveryAddress) !== JSON.stringify(initialData.deliveryAddress)
          || currentData.pickupBranch !== initialData.pickupBranch;
        const dateChanged = currentData.requiredDate !== initialData.requiredDate;
        const routeCommentsChanged = JSON.stringify(currentData.routeComments) !== JSON.stringify(initialData.routeComments);
        const hasChanges = detailsChanged || deliveryChanged || dateChanged
          || currentData.comments.trim() !== initialData.comments.trim()
          || routeCommentsChanged
          || currentData.newFiles.length > 0
          || currentData.removedAttachmentIds.length > 0;

        if (hasChanges && matchedLines.length > 0) {
          // Only include delivery_address for methods that use an address
          const includeAddress = (currentData.deliveryMethod === 'installation' || currentData.deliveryMethod === 'shipping')
            && Object.keys(currentData.deliveryAddress).length > 0;
          // Don't include delivery_method for not_applicable services
          const includeDelivery = currentData.deliveryMethod && currentData.deliveryMethod !== 'not_applicable';

          // For route-based services: send each line with its own route comment
          const hasRouteComments = Object.keys(currentData.routeComments).length > 0;
          if (hasRouteComments && matchedLines.length > 1) {
            // Each matched line corresponds to a route — send each with its own description
            matchedLines.forEach((line, rIdx) => {
              proposed_lines.push({
                id: line.id,
                action: 'modify',
                concept: line.concept,
                description: currentData.routeComments[rIdx] ?? line.description,
                quantity: line.quantity,
                unit: line.unit,
                service_details: rIdx === 0 ? {
                  ...cleanServiceDetailsForApi(currentData.details),
                  ...(includeDelivery ? { delivery_method: currentData.deliveryMethod } : {}),
                  ...(includeAddress ? { delivery_address: currentData.deliveryAddress } : {}),
                  ...(currentData.deliveryMethod === 'pickup' && currentData.pickupBranch ? { pickup_branch: currentData.pickupBranch } : {}),
                } : undefined,
              });
            });
          } else {
            // Non-route-based: send only the first line with the single comment
            const firstLine = matchedLines[0];
            proposed_lines.push({
              id: firstLine.id,
              action: 'modify',
              concept: firstLine.concept,
              description: currentData.comments || firstLine.description,
              quantity: firstLine.quantity,
              unit: firstLine.unit,
              service_details: {
                ...cleanServiceDetailsForApi(currentData.details),
                ...(includeDelivery ? { delivery_method: currentData.deliveryMethod } : {}),
                ...(includeAddress ? { delivery_address: currentData.deliveryAddress } : {}),
                ...(currentData.deliveryMethod === 'pickup' && currentData.pickupBranch ? { pickup_branch: currentData.pickupBranch } : {}),
                ...(currentData.requiredDate ? { required_date: currentData.requiredDate } : {}),
              },
            });
          }
        }
      }

      // Handle deleted vendor services that weren't in editDataMap
      const deletedKeysArr = Array.from(deletedServiceKeys);
      for (const key of deletedKeysArr) {
        if (!editDataMap[key]) {
          let matchedLines: QuoteLine[] = [];
          if (key.startsWith('vendor-')) {
            const gIdx = parseInt(key.split('-')[1], 10);
            matchedLines = vendorLineGroups[gIdx]?.lines || [];
          }
          for (const line of matchedLines) {
            proposed_lines.push({ id: line.id, action: 'delete', concept: line.concept });
          }
        }
      }

      if (proposed_lines.length === 0 && !editGlobalComments.trim() && editGlobalFiles.length === 0) {
        toast.error('No se detectaron cambios. Modifica al menos un campo antes de enviar.');
        setIsSubmitting(false);
        return;
      }

      const submitData: SubmitChangeRequestData = {
        proposed_lines: proposed_lines.length > 0 ? proposed_lines : [],
        customer_comments: editGlobalComments || undefined,
        attachments: editGlobalFiles.length > 0 ? editGlobalFiles : undefined,
      };

      await requestQuoteChanges(quote.token, submitData);
      exitEditMode();
      toast.success('Tu solicitud de cambios ha sido enviada. Te contactaremos pronto.');
      refetch();
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Error al enviar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  }, [quote, editDataMap, deletedServiceKeys, editGlobalComments, editGlobalFiles, buildInitialEditMap, serviceToLinesMap, vendorLineGroups, exitEditMode, refetch]);

  if (isLoading) {
    return <LoadingPage message="Cargando cotización..." />;
  }

  if (error || !quote) {
    return (
      <div className="text-center py-12">
        <DocumentTextIcon className="h-16 w-16 text-neutral-700 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-4">Cotización no encontrada</h2>
        <Link href="/mi-cuenta/cotizaciones">
          <Button>Volver a mis cotizaciones</Button>
        </Link>
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
    <div className="space-y-3">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Mi Cuenta', href: '/mi-cuenta' },
          { label: 'Cotizaciones', href: '/mi-cuenta/cotizaciones' },
          { label: `#${quote.quote_number}` },
        ]}
        showHome={false}
      />

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

      {/* Edit Mode Banner */}
      {editMode && (
        <div className="p-4 bg-cmyk-cyan/10 border-2 border-cmyk-cyan/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PencilIcon className="h-6 w-6 text-cmyk-cyan flex-shrink-0" />
            <div>
              <p className="text-cmyk-cyan font-semibold">Modo de edición activo</p>
              <p className="text-neutral-400 text-sm">
                Modifica los servicios que necesites. Al terminar, envía tu solicitud de cambios.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDialog('cancel')}
              leftIcon={<XCircleIcon className="h-4 w-4" />}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirmDialog('save')}
              disabled={isSubmitting}
              isLoading={isSubmitting}
              className="bg-cmyk-cyan hover:bg-cmyk-cyan/80"
              leftIcon={<PaperAirplaneIcon className="h-4 w-4" />}
            >
              Enviar solicitud de cambios
            </Button>
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
                <div>
                  <p className="text-neutral-500 text-xs">Cliente</p>
                  <p className="text-white">{quote.customer_name}</p>
                  {quote.customer_company && (
                    <p className="text-neutral-400 text-sm">{quote.customer_company}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cmyk-cyan/10">
                  <EnvelopeIcon className="h-5 w-5 text-cmyk-cyan" />
                </div>
                <div>
                  <p className="text-neutral-500 text-xs">Email</p>
                  <p className="text-white">{quote.customer_email}</p>
                </div>
              </div>
              {quote.customer_phone && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cmyk-cyan/10">
                    <PhoneIcon className="h-5 w-5 text-cmyk-cyan" />
                  </div>
                  <div>
                    <p className="text-neutral-500 text-xs">Teléfono</p>
                    <p className="text-white">{quote.customer_phone}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Line Items */}
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
                        {line.delivery_method && line.delivery_method !== 'not_applicable' && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
                            <span className="inline-flex items-center gap-1">
                              <TruckIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                              {DELIVERY_METHOD_LABELS[line.delivery_method as DeliveryMethod]?.es || line.delivery_method}
                            </span>
                            {line.estimated_delivery_date && (
                              <span className="inline-flex items-center gap-1">
                                <CalendarIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                                {new Date(line.estimated_delivery_date).toLocaleDateString('es-MX')}
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
                      <td className="py-2 pr-4 text-right text-white text-sm">{line.quantity}</td>
                      <td className="py-2 pr-4 text-neutral-400 text-sm">{line.unit}</td>
                      <td className="py-2 pr-4 text-right text-white text-sm">{formatPrice(line.unit_price)}</td>
                      <td className="py-2 pr-4 text-right text-neutral-400 text-sm">
                        {parseFloat(line.shipping_cost || '0') > 0
                          ? formatPrice(line.shipping_cost || '0')
                          : '—'}
                      </td>
                      <td className="py-2 text-right text-white font-medium text-sm">{formatPrice(line.line_total)}</td>
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
                    <p className="text-white font-medium text-sm">{formatPrice(line.line_total)}</p>
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
                      <p className="text-white">{formatPrice(line.unit_price)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Envío</p>
                      <p className="text-neutral-300">
                        {parseFloat(line.shipping_cost || '0') > 0
                          ? formatPrice(line.shipping_cost || '0')
                          : '—'}
                      </p>
                    </div>
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
                          {new Date(line.estimated_delivery_date).toLocaleDateString('es-MX')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 pt-3 border-t border-neutral-700 space-y-1.5">
              <div className="flex justify-between text-neutral-400 text-sm">
                <span>Subtotal</span>
                <span>{formatPrice(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-400 text-sm">
                <span>IVA ({Number(quote.tax_rate) * 100}%)</span>
                <span>{formatPrice(quote.tax_amount)}</span>
              </div>
              {(() => {
                const shippingTotal = quote.lines?.reduce(
                  (sum, l) => sum + (parseFloat(l.shipping_cost || '0') || 0), 0
                ) || 0;
                return shippingTotal > 0 ? (
                  <div className="flex justify-between text-neutral-400 text-sm">
                    <span>Envío</span>
                    <span>{formatPrice(shippingTotal)}</span>
                  </div>
                ) : null;
              })()}
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-neutral-700">
                <span>Total</span>
                <span className="text-cyan-400">{formatPrice(quote.total)}</span>
              </div>
            </div>
          </Card>

          {/* Service Details — Solicitud Original */}
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
                            <span className="text-green-400 text-xs font-medium">{formatPrice(svcTotal)}</span>
                          )}
                        </div>
                      </div>
                      <ChevronDownIcon className={`h-5 w-5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="p-4 border-t border-neutral-700 space-y-4">
                        {/* ── Edit mode: inline editor ── */}
                        {editMode && !deletedServiceKeys.has(singleKey) ? (
                          <InlineServiceEditor
                            key={singleKey}
                            initial={editDataMap[singleKey] || (() => {
                              const _lwd = quote.lines?.find(l => l.service_details && Object.keys(l.service_details).length > 0);
                              const _esd = _lwd?.service_details as Record<string, unknown> | undefined
                                ?? (quote.quote_request?.service_details as Record<string, unknown> | undefined);
                              const _fl = quote.lines?.[0];
                              const _allLines = (serviceToLinesMap.get(0) || []).length > 0 ? serviceToLinesMap.get(0)! : (quote.lines || []);
                              const _isRouteBased = quote.quote_request!.service_type === 'publicidad-movil' &&
                                ['vallas-moviles', 'perifoneo', 'publibuses'].includes((_esd?.subtipo as string) || '');
                              const _rc: Record<number, string> = {};
                              if (_isRouteBased) {
                                const _rutas = (_esd?.rutas ?? (quote.quote_request?.service_details as Record<string, unknown> | undefined)?.rutas) as Array<Record<string, unknown>> | undefined;
                                _allLines.forEach((ml, ri) => { _rc[ri] = ml.description || (_rutas?.[ri]?.comentarios as string) || ''; });
                              }
                              return buildServiceEditData({
                                serviceType: quote.quote_request!.service_type || '',
                                serviceDetails: _esd,
                                deliveryMethod: _fl?.delivery_method || quote.delivery_method || quote.quote_request?.delivery_method,
                                deliveryAddress: (_fl?.delivery_address || quote.delivery_address || quote.quote_request?.delivery_address) as Record<string, string> | undefined,
                                pickupBranch: _fl?.pickup_branch || quote.pickup_branch || quote.quote_request?.pickup_branch,
                                requiredDate: quote.quote_request?.required_date,
                                comments: !_isRouteBased ? (_fl?.description || quote.quote_request?.description || '') : '',
                                routeComments: _isRouteBased ? _rc : undefined,
                                attachments: quote.quote_request?.attachments?.map(a => ({ id: a.id, file: a.file, filename: a.filename })) || [],
                              });
                            })()}
                            label={svcLabel}
                            onSave={(data) => handleEditServiceSave(singleKey, data)}
                            onDataChange={(data) => handleEditDataChange(singleKey, data)}
                            onCancel={() => toggleService(singleKey)}
                            onDelete={() => handleDeleteService(singleKey)}
                            vendorEstimatedDate={firstEstDate}
                          />
                        ) : editMode && deletedServiceKeys.has(singleKey) ? (
                          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                              <div>
                                <p className="text-red-400 font-medium text-sm">Servicio marcado para eliminación</p>
                                <p className="text-neutral-400 text-xs">Se eliminará al enviar la solicitud de cambios</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUndoDeleteService(singleKey)}
                              className="text-sm text-cmyk-cyan hover:underline"
                            >
                              Deshacer
                            </button>
                          </div>
                        ) : (
                        <>
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

                        {/* Delivery Method from Request */}
                        {quote.quote_request.delivery_method && (
                          <div className="p-3 bg-neutral-800/50 rounded-lg">
                            <p className="text-neutral-500 text-xs mb-2">Método de entrega solicitado</p>
                            <p className="text-white flex items-center gap-2">
                              <span>{DELIVERY_METHOD_ICONS[quote.quote_request.delivery_method as DeliveryMethod]}</span>
                              {DELIVERY_METHOD_LABELS[quote.quote_request.delivery_method as DeliveryMethod]?.es || quote.quote_request.delivery_method}
                            </p>
                            {quote.quote_request.pickup_branch_detail && (
                              <p className="text-neutral-300 text-sm mt-1">
                                Sucursal: {quote.quote_request.pickup_branch_detail.name} — {quote.quote_request.pickup_branch_detail.city}, {quote.quote_request.pickup_branch_detail.state}
                              </p>
                            )}
                            {quote.quote_request.delivery_address && typeof quote.quote_request.delivery_address === 'object' && Object.keys(quote.quote_request.delivery_address).length > 0 && (
                              <p className="text-neutral-300 text-sm mt-1">
                                {quote.quote_request.delivery_method === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}:{' '}
                                {[quote.quote_request.delivery_address.street || quote.quote_request.delivery_address.calle, quote.quote_request.delivery_address.exterior_number || quote.quote_request.delivery_address.numero_exterior, quote.quote_request.delivery_address.neighborhood || quote.quote_request.delivery_address.colonia, quote.quote_request.delivery_address.city || quote.quote_request.delivery_address.ciudad, quote.quote_request.delivery_address.state || quote.quote_request.delivery_address.estado, quote.quote_request.delivery_address.postal_code || quote.quote_request.delivery_address.codigo_postal].filter(Boolean).join(', ')}
                              </p>
                            )}
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
                        </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Vendor-added services for single-service view */}
              {(!quote.quote_request.services || quote.quote_request.services.length === 0) && vendorLineGroups.length > 0 && vendorLineGroups.map((vGroup, gIdx) => {
                const vendorKey = `vendor-${gIdx}`;
                const isOpen = expandedServices.has(vendorKey);
                const svcLabel = vGroup.serviceType
                  ? (SERVICE_LABELS[vGroup.serviceType as ServiceId] || vGroup.serviceType)
                  : vGroup.lines[0]?.concept || 'Servicio';
                const vGroupTotal = vGroup.lines.reduce((s, l) => s + (parseFloat(String(l.line_total || 0))), 0);
                const firstEstDate = vGroup.lines.find(l => l.estimated_delivery_date)?.estimated_delivery_date;
                const routeCount = vGroup.lines.length;
                const vGroupSD = vGroup.lines[0]?.service_details as Record<string, unknown> | undefined;
                const isDeletedVendor = editMode && deletedServiceKeys.has(vendorKey);

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
                                  <span className="text-green-400 font-medium">{formatPrice(ml.line_total)}</span>
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
                              <span className="text-green-400 text-xs font-medium">{formatPrice(vGroupTotal)}</span>
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
                        {editMode && !isDeletedVendor ? (
                          <InlineServiceEditor
                            key={vendorKey}
                            initial={editDataMap[vendorKey] || buildServiceEditData({
                              serviceType: vGroup.serviceType || '',
                              serviceDetails: vGroupSD,
                              deliveryMethod: vGroup.lines[0]?.delivery_method,
                              deliveryAddress: vGroup.lines[0]?.delivery_address as Record<string, string> | undefined,
                              pickupBranch: vGroup.lines[0]?.pickup_branch,
                              requiredDate: '',
                              comments: '',
                              attachments: [],
                            })}
                            label={svcLabel}
                            onSave={(data) => handleEditServiceSave(vendorKey, data)}
                            onDataChange={(data) => handleEditDataChange(vendorKey, data)}
                            onCancel={() => toggleService(vendorKey)}
                            onDelete={() => handleDeleteService(vendorKey)}
                            isVendorAdded
                            vendorEstimatedDate={firstEstDate}
                          />
                        ) : editMode && isDeletedVendor ? (
                          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                              <div>
                                <p className="text-red-400 font-medium text-sm">Servicio marcado para eliminación</p>
                                <p className="text-neutral-400 text-xs">Se eliminará al enviar la solicitud de cambios</p>
                              </div>
                            </div>
                            <button type="button" onClick={() => handleUndoDeleteService(vendorKey)} className="text-sm text-cmyk-cyan hover:underline">Deshacer</button>
                          </div>
                        ) : (
                        <>
                        {vGroupSD && Object.keys(vGroupSD).length > 0 && vGroup.serviceType && (
                          <div>
                            <ServiceDetailsDisplay
                              serviceType={vGroup.serviceType}
                              serviceDetails={vGroupSD}
                              routePrices={vGroup.lines.length > 1
                                ? vGroup.lines.reduce((acc, ml, mlIdx) => ({ ...acc, [mlIdx]: formatPrice(ml.line_total) }), {} as Record<number, string>)
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
                        </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Multi-service rendering (collapsible accordion) ── */}
              {quote.quote_request.services && quote.quote_request.services.length > 0 && (
                <div className="space-y-3">
                  <p className="text-neutral-400 text-sm font-medium">
                    {(quote.quote_request.services.length + vendorLineGroups.length)} servicio{(quote.quote_request.services.length + vendorLineGroups.length) > 1 ? 's' : ''} en esta cotización
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
                                      <span className="text-green-400 font-medium">{formatPrice(ml.line_total)}</span>
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
                                  <span className="text-green-400 text-xs font-medium">{formatPrice(svcTotal)}</span>
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
                            {/* ── Edit mode: inline editor ── */}
                            {editMode && !deletedServiceKeys.has(multiKey) ? (
                              <InlineServiceEditor
                                key={multiKey}
                                initial={editDataMap[multiKey] || (() => {
                                  const _ml = serviceToLinesMap.get(idx) || [];
                                  const _lineSD = _ml.find(l => l.service_details && Object.keys(l.service_details).length > 0)?.service_details as Record<string, unknown> | undefined;
                                  const _fl = _ml[0];
                                  const _effSD = _lineSD ?? (svc.service_details as Record<string, unknown> | undefined);
                                  const _isRouteBased = svc.service_type === 'publicidad-movil' &&
                                    ['vallas-moviles', 'perifoneo', 'publibuses'].includes((_effSD?.subtipo as string) || '');
                                  const _rc: Record<number, string> = {};
                                  if (_isRouteBased) {
                                    const _rutas = (_effSD?.rutas ?? (svc.service_details as Record<string, unknown> | undefined)?.rutas) as Array<Record<string, unknown>> | undefined;
                                    _ml.forEach((ml, ri) => { _rc[ri] = ml.description || (_rutas?.[ri]?.comentarios as string) || ''; });
                                  }
                                  return buildServiceEditData({
                                    serviceType: svc.service_type || '',
                                    serviceDetails: _effSD,
                                    deliveryMethod: _fl?.delivery_method || svc.delivery_method,
                                    deliveryAddress: (_fl?.delivery_address || svc.delivery_address) as Record<string, string> | undefined,
                                    pickupBranch: _fl?.pickup_branch || svc.pickup_branch,
                                    requiredDate: svc.required_date,
                                    comments: !_isRouteBased ? (_fl?.description || svc.description || '') : '',
                                    routeComments: _isRouteBased ? _rc : undefined,
                                    attachments: svc.attachments?.map(a => ({ id: a.id, file: a.file, filename: a.filename })) || [],
                                  });
                                })()}
                                label={svcLabel}
                                onSave={(data) => handleEditServiceSave(multiKey, data)}
                                onDataChange={(data) => handleEditDataChange(multiKey, data)}
                                onCancel={() => toggleService(multiKey)}
                                onDelete={() => handleDeleteService(multiKey)}
                                vendorEstimatedDate={firstEstDate}
                              />
                            ) : editMode && deletedServiceKeys.has(multiKey) ? (
                              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                                  <div>
                                    <p className="text-red-400 font-medium text-sm">Servicio marcado para eliminación</p>
                                    <p className="text-neutral-400 text-xs">Se eliminará al enviar la solicitud de cambios</p>
                                  </div>
                                </div>
                                <button type="button" onClick={() => handleUndoDeleteService(multiKey)} className="text-sm text-cmyk-cyan hover:underline">Deshacer</button>
                              </div>
                            ) : (
                            <>
                            {/* Service-specific parameters */}
                            {svc.service_details && Object.keys(svc.service_details).length > 0 && (
                              <div>
                                <ServiceDetailsDisplay
                                  serviceType={svc.service_type}
                                  serviceDetails={svc.service_details as Record<string, unknown>}
                                  routePrices={matchedLines && matchedLines.length > 1
                                    ? matchedLines.reduce((acc, ml, mlIdx) => ({ ...acc, [mlIdx]: formatPrice(ml.line_total) }), {} as Record<number, string>)
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
                            </>
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
                    const isDeletedVendorMulti = editMode && deletedServiceKeys.has(vendorKey);

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
                                      <span className="text-green-400 font-medium">{formatPrice(ml.line_total)}</span>
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
                                  <span className="text-green-400 text-xs font-medium">{formatPrice(vGroupTotal)}</span>
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
                            {editMode && !isDeletedVendorMulti ? (
                              <InlineServiceEditor
                                key={vendorKey}
                                initial={editDataMap[vendorKey] || buildServiceEditData({
                                  serviceType: vGroup.serviceType || '',
                                  serviceDetails: vGroupSD,
                                  deliveryMethod: vGroup.lines[0]?.delivery_method,
                                  deliveryAddress: vGroup.lines[0]?.delivery_address as Record<string, string> | undefined,
                                  pickupBranch: vGroup.lines[0]?.pickup_branch,
                                  requiredDate: '',
                                  comments: '',
                                  attachments: [],
                                })}
                                label={svcLabel}
                                onSave={(data) => handleEditServiceSave(vendorKey, data)}
                                onDataChange={(data) => handleEditDataChange(vendorKey, data)}
                                onCancel={() => toggleService(vendorKey)}
                                onDelete={() => handleDeleteService(vendorKey)}
                                isVendorAdded
                                vendorEstimatedDate={firstEstDate}
                              />
                            ) : editMode && isDeletedVendorMulti ? (
                              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                                  <div>
                                    <p className="text-red-400 font-medium text-sm">Servicio marcado para eliminación</p>
                                    <p className="text-neutral-400 text-xs">Se eliminará al enviar la solicitud de cambios</p>
                                  </div>
                                </div>
                                <button type="button" onClick={() => handleUndoDeleteService(vendorKey)} className="text-sm text-cmyk-cyan hover:underline">Deshacer</button>
                              </div>
                            ) : (
                            <>
                            {vGroupSD && Object.keys(vGroupSD).length > 0 && vGroup.serviceType && (
                              <div>
                                <ServiceDetailsDisplay
                                  serviceType={vGroup.serviceType}
                                  serviceDetails={vGroupSD}
                                  routePrices={vGroup.lines.length > 1
                                    ? vGroup.lines.reduce((acc, ml, mlIdx) => ({ ...acc, [mlIdx]: formatPrice(ml.line_total) }), {} as Record<number, string>)
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
                            </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Edit mode: Global comments for change request ── */}
              {editMode && (
                <div className="mt-4 pt-4 border-t border-neutral-700 space-y-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="h-4 w-4 text-cmyk-cyan" />
                    Comentarios generales para la solicitud
                  </h4>
                  <textarea
                    value={editGlobalComments}
                    onChange={(e) => setEditGlobalComments(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50 resize-none"
                    placeholder="Comentarios o instrucciones adicionales para toda la cotización…"
                  />

                  {/* File upload section */}
                  <div className="pt-3 border-t border-neutral-700/50">
                    <p className="text-xs text-neutral-400 mb-2 flex items-center gap-1.5">
                      <PhotoIcon className="h-3.5 w-3.5" />
                      Imágenes de referencia (opcional, máx. 10 archivos)
                    </p>
                    {editGlobalFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {editGlobalFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="relative group w-16 h-16 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-800"
                          >
                            {file.type.startsWith('image/') ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-1">
                                <PaperClipIcon className="h-4 w-4 text-neutral-500" />
                                <span className="text-[9px] text-neutral-500 text-center truncate w-full mt-0.5">{file.name}</span>
                              </div>
                            )}
                            <button
                              onClick={() => setEditGlobalFiles(prev => prev.filter((_, i) => i !== index))}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <TrashIcon className="h-4 w-4 text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input
                      ref={editFileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files) return;
                        const valid: File[] = [];
                        for (let i = 0; i < files.length; i++) {
                          const f = files[i];
                          if (!ALLOWED_FILE_TYPES.includes(f.type)) {
                            toast.error(`${f.name}: tipo de archivo no soportado`);
                            continue;
                          }
                          if (f.size > MAX_FILE_SIZE) {
                            toast.error(`${f.name}: excede 10MB`);
                            continue;
                          }
                          valid.push(f);
                        }
                        if (editGlobalFiles.length + valid.length > 10) {
                          toast.error('Máximo 10 archivos');
                          return;
                        }
                        setEditGlobalFiles(prev => [...prev, ...valid]);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-neutral-600 hover:border-cmyk-cyan text-xs text-neutral-400 hover:text-cmyk-cyan transition-colors"
                    >
                      <PlusCircleIcon className="h-4 w-4" />
                      Agregar archivos
                    </button>
                  </div>
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
                  <p className="text-neutral-500 text-sm">Fecha estimada de entrega</p>
                  <p className="text-white">{formatDate(quote.estimated_delivery_date)}</p>
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
                <p className="text-white text-sm">Pago completo</p>
              </div>
              {quote.payment_conditions && (
                <div>
                  <p className="text-neutral-500 text-xs">Condiciones</p>
                  <p className="text-neutral-300 text-xs">{quote.payment_conditions}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Terms */}
          {quote.terms && (
            <Card className="p-4">
              <h3 className="font-medium text-white text-xs mb-2">Términos y Condiciones</h3>
              <p className="text-neutral-300 text-xs whitespace-pre-wrap">{quote.terms}</p>
            </Card>
          )}

          {/* Actions */}
          </div>
          <div className="xl:sticky xl:top-20 mt-6 z-10">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Acciones</h3>
            <div className="space-y-2">
              {/* Download PDF — hidden in edit mode */}
              {!editMode && (quote.pdf_file || quote.token) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  isLoading={isDownloadingPdf}
                  leftIcon={<DocumentArrowDownIcon className="h-4 w-4" />}
                >
                  {isDownloadingPdf ? 'Descargando...' : 'Descargar PDF'}
                </Button>
              )}

              {/* Accept / Reject / Request Changes — hidden in edit mode */}
              {canRespond && !editMode && (
                <>
                  <Button
                    onClick={() => setResponseAction('accept')}
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
                    onClick={enterEditMode}
                    variant="outline"
                    className="w-full"
                    leftIcon={<PencilIcon className="h-5 w-5" />}
                  >
                    Solicitar Cambios
                  </Button>
                </>
              )}

              {/* Edit mode sidebar actions */}
              {editMode && (
                <div className="space-y-2">
                  <div className="p-3 bg-cmyk-cyan/10 border border-cmyk-cyan/30 rounded-lg">
                    <p className="text-cmyk-cyan text-xs font-medium mb-1">✏️ Modo de edición</p>
                    <p className="text-neutral-400 text-[11px]">
                      Modifica los servicios en cada acordeón. Al terminar, haz clic en &quot;Guardar&quot; dentro de cada servicio y luego envía tu solicitud.
                    </p>
                  </div>
                  {deletedServiceKeys.size > 0 && (
                    <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-400 text-xs font-medium">
                        🗑️ {deletedServiceKeys.size} servicio{deletedServiceKeys.size > 1 ? 's' : ''} para eliminar
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={() => setConfirmDialog('save')}
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    className="w-full bg-cmyk-cyan hover:bg-cmyk-cyan/80"
                    leftIcon={<PaperAirplaneIcon className="h-4 w-4" />}
                  >
                    Enviar solicitud de cambios
                  </Button>
                  <Button
                    onClick={() => setConfirmDialog('cancel')}
                    variant="outline"
                    className="w-full"
                    leftIcon={<XCircleIcon className="h-4 w-4" />}
                  >
                    Cancelar edición
                  </Button>
                </div>
              )}

              {/* Request new quote if rejected */}
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
            </div>
          </Card>
          </div>
        </div>
      </div>

      {/* Accept/Reject Modal */}
      {responseAction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {responseAction === 'accept' ? 'Aceptar Cotización' : 'Rechazar Cotización'}
            </h3>

            {responseAction === 'accept' ? (
              <div className="mb-4">
                <p className="text-neutral-300 mb-4">
                  ¿Estás seguro de que deseas aceptar esta cotización por{' '}
                  <strong className="text-white">{formatPrice(quote.total)}</strong>?
                </p>

                {/* Signature */}
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
      {showChangeEditor && quote.token && (
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

      {/* ── Confirmation Dialog ── */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[80] p-4" style={{ overscrollBehavior: 'contain' }}>
          <Card className="p-6 w-full max-w-md">
            <div className="text-center mb-6">
              {confirmDialog === 'save' ? (
                <>
                  <PaperAirplaneIcon className="h-12 w-12 text-cmyk-cyan mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-2">¿Enviar solicitud de cambios?</h3>
                  <p className="text-neutral-400 text-sm">
                    Se enviará tu solicitud con los cambios realizados. El vendedor revisará los cambios y te enviará una cotización actualizada.
                  </p>
                </>
              ) : (
                <>
                  <ExclamationTriangleIcon className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-2">¿Cancelar edición?</h3>
                  <p className="text-neutral-400 text-sm">
                    Se perderán todos los cambios que hayas realizado. ¿Estás seguro?
                  </p>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDialog(null)}
              >
                Volver
              </Button>
              <Button
                className={`flex-1 ${confirmDialog === 'save' ? 'bg-cmyk-cyan hover:bg-cmyk-cyan/80' : 'bg-yellow-600 hover:bg-yellow-700'}`}
                onClick={confirmDialog === 'save' ? handleSubmitEditChanges : exitEditMode}
                disabled={confirmDialog === 'save' && isSubmitting}
                isLoading={confirmDialog === 'save' && isSubmitting}
              >
                {confirmDialog === 'save' ? 'Enviar cambios' : 'Sí, cancelar'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Portal: Render Historial + Contact into the layout's left sidebar */}
      {sidebarPortal && createPortal(
        <>
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

            const sortedChangeRequests = [...changeRequests].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const changeRequestVersionMap = new Map<string, number>();
            sortedChangeRequests.forEach((cr, i) => changeRequestVersionMap.set(cr.id, i + 2));

            const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            return (
            <Card className="p-4">
              <h3 className="font-medium text-white text-xs mb-2 flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-cmyk-cyan" />
                Historial
              </h3>
              <div className="relative">
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-neutral-700 z-0"></div>
                <div className="space-y-3">

                  {eventsList.map((event, idx) => {
                    const circleBase = 'relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900';

                    if (event.type === 'change_request') {
                      const cr = event.data;
                      const crVersion = changeRequestVersionMap.get(cr.id) || 2;
                      return (
                        <Link
                          key={`cr-${cr.id}`}
                          href={`/${locale}/mi-cuenta/cotizaciones/${quoteId}/cambios/${cr.id}`}
                          className="relative flex items-start gap-2 group"
                        >
                          <div className={`${circleBase} border-orange-500/60`}>
                            <PencilIcon className="h-3 w-3 text-orange-400" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-orange-400 text-xs font-medium group-hover:underline">
                              Cambios v{crVersion}
                              {cr.changes_summary && (
                                <span className="ml-1 text-[10px] bg-neutral-800 text-neutral-400 px-1 py-0.5 rounded-full">
                                  {[
                                    cr.changes_summary.added > 0 && `+${cr.changes_summary.added}`,
                                    cr.changes_summary.modified > 0 && `~${cr.changes_summary.modified}`,
                                    cr.changes_summary.deleted > 0 && `-${cr.changes_summary.deleted}`,
                                  ].filter(Boolean).join(' ')}
                                </span>
                              )}
                            </p>
                            <p className="text-neutral-500 text-[11px]">{fmtDate(cr.created_at)}</p>
                            {!cr.customer_comments && (() => {
                              const comments = (cr.proposed_lines || []).filter(pl => pl.description?.trim() && pl.action !== 'delete');
                              return comments.length > 0 ? (
                                <p className="text-neutral-500 text-[11px] mt-0.5">
                                  {comments.length} comentario{comments.length > 1 ? 's' : ''}
                                </p>
                              ) : null;
                            })()}
                            {cr.attachments && cr.attachments.length > 0 && (
                              <p className="text-neutral-500 text-[11px] mt-0.5 flex items-center gap-1">
                                <PaperClipIcon className="h-3 w-3" />
                                {cr.attachments.length} adjunto{cr.attachments.length > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    }

                    if (event.type === 'change_request_reviewed') {
                      const cr = event.data;
                      const isApproved = cr.status === 'approved';
                      return (
                        <div key={`cr-review-${cr.id}`} className="relative flex items-start gap-2">
                          <div className={`${circleBase} ${isApproved ? 'border-green-500/60' : 'border-red-500/60'}`}>
                            {isApproved ? <CheckCircleIcon className="h-3 w-3 text-green-400" /> : <XCircleIcon className="h-3 w-3 text-red-400" />}
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className={`text-xs font-medium ${isApproved ? 'text-green-400' : 'text-red-400'}`}>
                              Cambios — {isApproved ? 'aprobada' : 'rechazada'}
                            </p>
                            <p className="text-neutral-500 text-[11px]">{fmtDate(cr.reviewed_at!)}</p>
                          </div>
                        </div>
                      );
                    }

                    const response = event.data as QuoteResponseType;

                    if (response.action === 'send') {
                      const version = sendVersionMap.get(response.id) || 1;
                      const versionLabel = version > 1 ? ` v${version}` : '';
                      return (
                        <div key={`r-${response.id}`} className="relative flex items-start gap-2">
                          <div className={`${circleBase} border-cmyk-cyan/60`}>
                            <PaperAirplaneIcon className="h-3 w-3 text-cmyk-cyan" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-cmyk-cyan text-xs font-medium">
                              Enviada{versionLabel}
                            </p>
                            <p className="text-neutral-500 text-[11px]">{fmtDate(response.created_at)}</p>
                          </div>
                        </div>
                      );
                    }

                    if (response.action === 'view') {
                      return (
                        <div key={`r-${response.id}`} className="relative flex items-start gap-2">
                          <div className={`${circleBase} border-purple-500/60`}>
                            <EyeIcon className="h-3 w-3 text-purple-400" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-purple-400 text-xs font-medium">Vista</p>
                            <p className="text-neutral-500 text-[11px]">{fmtDate(response.created_at)}</p>
                          </div>
                        </div>
                      );
                    }

                    if (response.action === 'approval') {
                      return (
                        <div key={`r-${response.id}`} className="relative flex items-start gap-2">
                          <div className={`${circleBase} border-green-500/60`}>
                            <CheckCircleIcon className="h-3 w-3 text-green-400" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-green-400 text-xs font-medium">Aceptada</p>
                            <p className="text-neutral-500 text-[11px]">{fmtDate(response.created_at)}</p>
                          </div>
                        </div>
                      );
                    }

                    if (response.action === 'rejection') {
                      return (
                        <div key={`r-${response.id}`} className="relative flex items-start gap-2">
                          <div className={`${circleBase} border-red-500/60`}>
                            <XCircleIcon className="h-3 w-3 text-red-400" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-red-400 text-xs font-medium">Rechazada</p>
                            <p className="text-neutral-500 text-[11px]">{fmtDate(response.created_at)}</p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={`r-${response.id}-${idx}`} className="relative flex items-start gap-2">
                        <div className={`${circleBase} border-blue-500/60`}>
                          <PencilIcon className="h-3 w-3 text-blue-400" />
                        </div>
                        <div className="flex-1 -mt-0.5">
                          <p className="text-blue-400 text-xs font-medium">{response.action_display || 'Comentario'}</p>
                          <p className="text-neutral-500 text-[11px]">{fmtDate(response.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}

                  {quote.sent_at && !hasSendResponses && (
                    <div className="relative flex items-start gap-2">
                      <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-cmyk-cyan/60">
                        <PaperAirplaneIcon className="h-3 w-3 text-cmyk-cyan" />
                      </div>
                      <div className="flex-1 -mt-0.5">
                        <p className="text-cmyk-cyan text-xs font-medium">Enviada</p>
                        <p className="text-neutral-500 text-[11px]">{formatDate(quote.sent_at)}</p>
                      </div>
                    </div>
                  )}

                  {quote.quote_request && (
                    <>
                      <div className="relative flex items-center gap-2 py-0.5">
                        <div className="relative z-10 w-5 flex justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-600"></div>
                        </div>
                        <div className="flex-1 border-t border-dashed border-neutral-700"></div>
                      </div>

                      {quote.quote_request.status !== 'pending' && (
                        <div className="relative flex items-start gap-2">
                          <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-yellow-500/60">
                            <ClockIcon className="h-3 w-3 text-yellow-400" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-yellow-400 text-xs font-medium">En revisión</p>
                            <p className="text-neutral-500 text-[11px]">{formatDate(quote.quote_request.updated_at)}</p>
                          </div>
                        </div>
                      )}

                      {quote.quote_request.assigned_at && (
                        <div className="relative flex items-start gap-2">
                          <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-blue-500/60">
                            <UserIcon className="h-3 w-3 text-blue-400" />
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <p className="text-blue-400 text-xs font-medium">Asignada a {quote.quote_request.assigned_to_name || 'vendedor'}</p>
                            <p className="text-neutral-500 text-[11px]">{formatDate(quote.quote_request.assigned_at)}</p>
                          </div>
                        </div>
                      )}

                      <Link
                        href={`/${locale}/mi-cuenta/cotizaciones/${quoteId}/solicitud`}
                        className="relative flex items-start gap-2 group cursor-pointer"
                      >
                        <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full border bg-neutral-900 border-neutral-600">
                          <ChatBubbleLeftRightIcon className="h-3 w-3 text-neutral-400" />
                        </div>
                        <div className="flex-1 -mt-0.5">
                          <p className="text-neutral-400 text-xs font-medium group-hover:underline">Solicitud</p>
                          <p className="text-neutral-500 text-[11px]">
                            {quote.quote_request.customer_name} · {formatDate(quote.quote_request.created_at)}
                          </p>
                        </div>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </Card>
            );
          })()}

          {/* Contact */}
          <Card className="p-4 bg-cmyk-cyan/5 border-cmyk-cyan/20">
            <h3 className="font-medium text-white text-xs mb-1">¿Tienes preguntas?</h3>
            <p className="text-neutral-400 text-xs mb-2">
              Contáctanos sobre esta cotización.
            </p>
            <a
              href="mailto:ventas@mcd-agencia.com"
              className="text-cmyk-cyan hover:underline text-xs"
            >
              ventas@mcd-agencia.com
            </a>
          </Card>
        </>,
        sidebarPortal
      )}
    </div>
  );
}
