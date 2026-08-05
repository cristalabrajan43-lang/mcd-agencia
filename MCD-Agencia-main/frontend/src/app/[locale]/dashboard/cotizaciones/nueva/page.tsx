'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  CheckIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  MapPinIcon,
  CalendarIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, LoadingPage, SuccessModal } from '@/components/ui';
import PriceInput from '@/components/ui/PriceInput';
import { SendConfirmationModal } from '@/components/quotes/SendConfirmationModal';
import { ServiceDetailsDisplay, subtipoLabels } from '@/components/quotes/ServiceDetailsDisplay';
import { ServiceFormFields, type ServiceDetailsData, type ConfigurableRouteEntry, type EstablishedRouteEntry, serviceDetailsFromRequest, cleanServiceDetailsForApi, isRouteBasedService, isRouteBasedDetails, computeRoutesTotal, expandRouteLines } from '@/components/quotes/ServiceFormFields';
import {
  getAdminQuoteRequestById,
  createQuote,
  sendQuote,
  Quote,
  QuoteRequest,
  QuoteRequestService,
  CreateQuoteData,
} from '@/lib/api/quotes';
import { getProducts, ProductListItem } from '@/lib/api/catalog';
import { SERVICE_LABELS, SERVICE_SUBCATEGORIES, type ServiceId, type LandingServiceId, DELIVERY_METHOD_LABELS, DELIVERY_METHOD_ICONS, type DeliveryMethod } from '@/lib/service-ids';

// Alias for better readability
type CatalogItem = ProductListItem;

// Types
interface QuoteLineItem {
  id: string;
  concept: string;
  concept_en?: string;
  description?: string;
  description_en?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  shipping_cost: number;
  catalogItem?: CatalogItem;
  serviceDetails?: ServiceDetailsData;
  showServiceForm?: boolean;
  lineDeliveryMethod?: DeliveryMethod | '';
  lineEstimatedDate?: string;
  /** Reference to the original QuoteRequestService for read-only display */
  requestServiceRef?: QuoteRequestService;
}

export default function NewQuotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Get quote request ID from URL if provided
  const quoteRequestId = searchParams.get('solicitud');

  // Form state
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [validDays, setValidDays] = useState(15);
  // Payment mode is always FULL (deposit removed)
  const paymentMode = 'FULL' as const;
  const [terms, setTerms] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [customerEditable, setCustomerEditable] = useState(false);
  const [searchTab, setSearchTab] = useState<'products' | 'services'>('products');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; title: string; message: string; variant: 'success' | 'error'; redirectTo?: string }>({ open: false, title: '', message: '', variant: 'success' });


  const isSalesOrAdmin = user?.role?.name && ['admin', 'sales'].includes(user.role.name);

  // Load quote request data if provided
  const loadQuoteRequest = useCallback(async () => {
    if (!quoteRequestId) {
      setIsLoading(false);
      return;
    }

    try {
      const request = await getAdminQuoteRequestById(quoteRequestId);
      setQuoteRequest(request);

      // Pre-fill customer info
      setCustomerName(request.customer_name);
      setCustomerEmail(request.customer_email);
      setCustomerPhone(request.customer_phone || '');
      setCustomerCompany(request.customer_company || '');

      // When prefilling from request, lock customer fields
      setCustomerEditable(false);

      // ── Multi-service pre-fill ──
      // If the request has services (multi-service), create one QuoteLineItem per service
      if (request.services && request.services.length > 0) {
        const newItems: QuoteLineItem[] = request.services.map((svc, idx) => {
          const svcType = svc.service_type;
          const svcLabel = SERVICE_LABELS[svcType as ServiceId] || svcType;
          const details = svc.service_details as Record<string, unknown> | undefined;

          let conceptText = svcLabel;
          let quantityValue = 1;
          let prefillServiceDetails: ServiceDetailsData | undefined;

          if (details) {
            // Add subtype to concept name
            const subtype = details.subtipo || details.tipo || details.tipo_anuncio ||
                           details.tipo_rotulacion || details.material || details.tipo_diseno ||
                           details.producto || details.servicio || details.tipo_servicio;
            if (subtype && typeof subtype === 'string') {
              const subtypeLabel = subtipoLabels[subtype] || subtype;
              conceptText = `${svcLabel} — ${subtypeLabel}`;
            }
            if (details.cantidad && typeof details.cantidad === 'number') {
              quantityValue = details.cantidad;
            }
            prefillServiceDetails = serviceDetailsFromRequest(svcType, details);
          } else {
            prefillServiceDetails = { service_type: svcType as ServiceId };
          }

          return {
            id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            concept: conceptText,
            description: svc.description || '',
            quantity: quantityValue,
            unit: prefillServiceDetails ? 'servicio' : 'pza',
            unit_price: 0,
            shipping_cost: 0,
            serviceDetails: prefillServiceDetails,
            showServiceForm: !!prefillServiceDetails,
            lineDeliveryMethod: (svc.delivery_method as DeliveryMethod) || '',
            lineEstimatedDate: (() => {
              const t = new Date().toISOString().split('T')[0];
              return svc.required_date && svc.required_date >= t ? svc.required_date : t;
            })(),
            requestServiceRef: svc,
          };
        });

        setItems(newItems);
      } else {
        // ── Legacy single-service pre-fill (fallback) ──
        let conceptText = '';
        let descriptionText = '';
        let quantityValue = request.quantity || 1;
        let prefillServiceDetails: ServiceDetailsData | undefined;

        if (request.service_type) {
          const serviceLabel = SERVICE_LABELS[request.service_type as ServiceId] || request.service_type;
          conceptText = serviceLabel;

          const details = request.service_details as Record<string, unknown> | undefined;
          if (details) {
            const subtype = details.subtipo || details.tipo || details.tipo_anuncio ||
                           details.tipo_rotulacion || details.material || details.tipo_diseno ||
                           details.producto || details.servicio || details.tipo_servicio;
            if (subtype && typeof subtype === 'string') {
              const subtypeLabel = subtipoLabels[subtype] || subtype;
              conceptText = `${serviceLabel} — ${subtypeLabel}`;
            }
            if (details.cantidad && typeof details.cantidad === 'number') {
              quantityValue = details.cantidad;
            }
            prefillServiceDetails = serviceDetailsFromRequest(request.service_type, details);
          } else {
            prefillServiceDetails = { service_type: request.service_type as ServiceId };
          }
          descriptionText = '';
        } else if (request.catalog_item) {
          conceptText = request.catalog_item.name;
        }

        if (conceptText) {
          setItems([{
            id: `item-${Date.now()}`,
            concept: conceptText,
            description: descriptionText,
            quantity: quantityValue,
            unit: prefillServiceDetails ? 'servicio' : 'pza',
            unit_price: 0,
            shipping_cost: 0,
            serviceDetails: prefillServiceDetails,
            showServiceForm: !!prefillServiceDetails,
          }]);
        }
      }
    } catch (error) {
      console.error('Error loading quote request:', error);
      toast.error('Error al cargar la solicitud');
    } finally {
      setIsLoading(false);
    }
  }, [quoteRequestId]);

  // Load catalog items for search
  const loadCatalogItems = useCallback(async () => {
    try {
      const response = await getProducts({ page_size: 100 });
      setCatalogItems(response.results || []);
    } catch (error) {
      console.error('Error loading catalog:', error);
    }  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/cotizaciones/nueva`);
      } else if (!isSalesOrAdmin) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, isSalesOrAdmin, router, locale]);

  useEffect(() => {
    if (isAuthenticated && isSalesOrAdmin) {
      loadQuoteRequest();
      loadCatalogItems();
    }
  }, [isAuthenticated, isSalesOrAdmin, loadQuoteRequest, loadCatalogItems]);


  if (authLoading || isLoading) {
    return <LoadingPage message="Cargando..." />;
  }

  if (!isAuthenticated || !isSalesOrAdmin) {
    return null;
  }

  // Check if sales user can create quote for this request
  const isSales = user?.role?.name === 'sales';
  const isAdmin = user?.role?.name === 'admin';
  const isAssignedToMe = quoteRequest?.assigned_to === user?.id;
  const isUrgent = quoteRequest?.urgency === 'high';
  const cannotCreateForRequest = isSales && quoteRequest && !isAssignedToMe && !isUrgent;

  // Filter products based on search
  const filteredProducts = catalogItems.filter(item =>
    item.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    item.slug.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Add product from catalog
  const addCatalogItem = (item: CatalogItem) => {
    setItems(prev => [...prev, {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      concept: item.name,
      description: item.short_description || '',
      quantity: 1,
      unit: 'pza',
      unit_price: parseFloat(item.base_price || '0'),
      shipping_cost: 0,
      catalogItem: item,
    }]);

    setProductSearch('');
    setShowProductDropdown(false);
  };

  // Add custom line item
  const addCustomItem = () => {
    setItems(prev => [...prev, {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      concept: '',
      description: '',
      quantity: 1,
      unit: 'pza',
      unit_price: 0,
      shipping_cost: 0,
    }]);
  };

  // Remove item from quote
  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Update item field
  const updateItem = (itemId: string, field: keyof QuoteLineItem, value: unknown) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  // Calculate totals
  const subtotal = items.reduce((sum, item) => {
    // For route-based services, total comes from individual routes
    if (isRouteBasedDetails(item.serviceDetails)) {
      return sum + computeRoutesTotal(item.serviceDetails!);
    }
    return sum + (item.quantity * item.unit_price);
  }, 0);
  const shippingTotal = items.reduce((sum, item) => sum + (item.shipping_cost || 0), 0);
  const taxRate = 0.16;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount + shippingTotal;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!customerName.trim()) {
      toast.error('El nombre del cliente es requerido');
      return false;
    }
    if (!customerEmail.trim()) {
      toast.error('El email del cliente es requerido');
      return false;
    }
    if (items.length === 0) {
      toast.error('Agrega al menos un concepto');
      return false;
    }
    if (items.some(item => {
      // Service items get their concept from the service details display
      if (item.serviceDetails && item.serviceDetails.service_type) return false;
      return !item.concept.trim();
    })) {
      toast.error('Todos los conceptos deben tener un nombre');
      return false;
    }
    if (items.some(item => {
      // Route-based services get their pricing from routes, so skip top-level price check
      if (isRouteBasedDetails(item.serviceDetails)) return false;
      return item.unit_price <= 0;
    })) {
      toast.error('Todos los conceptos deben tener un precio válido');
      return false;
    }
    return true;
  };

  // Submit quote
  const handleSubmit = async (sendImmediately: boolean = false) => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const quoteData: CreateQuoteData = {
        quote_request_id: quoteRequestId || undefined,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || undefined,
        customer_company: customerCompany || undefined,
        valid_days: validDays,
        payment_mode: 'FULL',
        terms: terms || undefined,
        internal_notes: internalNotes || undefined,
        lines: items.flatMap((item) => {
          // Auto-generate concept from service details if it's a service item
          let concept = item.concept;
          if (item.serviceDetails && item.serviceDetails.service_type) {
            const svcLabel = SERVICE_LABELS[item.serviceDetails.service_type as ServiceId] || item.serviceDetails.service_type;
            const subLabel = item.serviceDetails.subtipo
              ? subtipoLabels[item.serviceDetails.subtipo as string] || (item.serviceDetails.subtipo as string)
              : '';
            concept = subLabel ? `${svcLabel} — ${subLabel}` : svcLabel;
          }

          // Per-line delivery info (each service has its own delivery method from the request)
          const lineDelivery = item.lineDeliveryMethod || undefined;

          // Route-based: expand into one line per route
          if (isRouteBasedDetails(item.serviceDetails)) {
            const routeLines = expandRouteLines(item.serviceDetails!, concept, item.description || '');
            return routeLines.map((rl, ri) => ({
              concept: rl.concept,
              concept_en: item.concept_en,
              description: rl.description,
              description_en: item.description_en,
              quantity: rl.quantity,
              unit: rl.unit,
              unit_price: rl.unit_price,
              position: 0, // will be set below
              service_details: ri === 0 ? (item.serviceDetails ? cleanServiceDetailsForApi(item.serviceDetails) || undefined : undefined) : undefined,
              shipping_cost: ri === 0 ? (item.shipping_cost || undefined) : undefined,
              delivery_method: ri === 0 ? lineDelivery : undefined,
              estimated_delivery_date: rl.estimated_date || (ri === 0 && item.lineEstimatedDate ? item.lineEstimatedDate : undefined),
            }));
          }

          return [{
            concept,
            concept_en: item.concept_en,
            description: item.description,
            description_en: item.description_en,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            position: 0,
            service_details: item.serviceDetails ? cleanServiceDetailsForApi(item.serviceDetails) || undefined : undefined,
            shipping_cost: item.shipping_cost || undefined,
            delivery_method: lineDelivery,
            estimated_delivery_date: item.lineEstimatedDate || undefined,
          }];
        }).map((line, idx) => ({ ...line, position: idx + 1 })),
      };

      const quote = await createQuote(quoteData);

      if (sendImmediately) {
        const sent = await sendQuote(quote.id, { send_email: true }) as Quote & { email_sent?: boolean; email_error?: string };
        if (sent.email_sent === false) {
          setModal({
            open: true,
            title: 'Cotización creada, pero el correo no se envió',
            message: `La cotización se creó y marcó como enviada, pero no se pudo enviar el correo a ${customerEmail}. Puedes reenviar el correo desde el detalle de la cotización.\n\nError: ${sent.email_error || 'Error desconocido'}`,
            variant: 'error',
            redirectTo: `/${locale}/dashboard/cotizaciones/${quote.id}`,
          });
        } else {
          setModal({ open: true, title: 'Cotización enviada', message: `Se creó y envió la cotización al cliente (${customerEmail}).`, variant: 'success', redirectTo: `/${locale}/dashboard/cotizaciones/${quote.id}` });
        }
      } else {
        setModal({ open: true, title: 'Borrador guardado', message: 'La cotización se guardó como borrador.', variant: 'success', redirectTo: `/${locale}/dashboard/cotizaciones/${quote.id}` });
      }
    } catch (error: unknown) {
      console.error('Error creating quote:', error);

      let errorMessage = 'No se pudo crear la cotización. Intenta de nuevo.';
      if (error && typeof error === 'object') {
        const apiError = error as { message?: string; data?: Record<string, unknown> };
        if (apiError.message) {
          errorMessage = apiError.message;
        }
        // Append field-level details if present
        if (apiError.data && typeof apiError.data === 'object') {
          const fieldMessages = Object.entries(apiError.data)
            .map(([field, msgs]) => {
              const msgStr = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
              return `• ${field}: ${msgStr}`;
            })
            .join('\n');
          if (fieldMessages) {
            errorMessage += '\n\n' + fieldMessages;
          }
        }
      }

      setModal({ open: true, title: 'Error', message: errorMessage, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Nueva Cotización</h1>
            <p className="text-neutral-400">
              {quoteRequest
                ? `Basada en solicitud ${quoteRequest.request_number}`
                : 'Crea una cotización para tu cliente'}
            </p>
          </div>
        </div>

        {/* Assignment restriction warning */}
        {cannotCreateForRequest && (
          <Card className="p-4 mb-6 border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-medium">Solicitud asignada a otro vendedor</p>
                <p className="text-neutral-400 text-sm mt-1">
                  Esta solicitud está asignada a {quoteRequest?.assigned_to_name || 'otro vendedor'}.
                  Solo puedes crear cotizaciones para solicitudes asignadas a ti o marcadas como urgentes.
                </p>
                <button
                  onClick={() => router.back()}
                  className="mt-2 text-cmyk-cyan hover:text-cmyk-cyan/80 text-sm"
                >
                  ← Volver a solicitudes
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Quote Request Info Banner */}
        {quoteRequest && (
          <Card className="p-4 mb-6 border-cmyk-cyan/30 bg-cmyk-cyan/5">
            <div className="flex items-start gap-3 mb-4">
              <InformationCircleIcon className="h-5 w-5 text-cmyk-cyan flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-white font-medium">Solicitud: {quoteRequest.request_number}</p>
                {quoteRequest.description && (
                  <p className="text-neutral-400 text-sm mt-1">
                    {quoteRequest.description}
                  </p>
                )}
                {/* Show per-service summary for multi-service requests */}
                {quoteRequest.services && quoteRequest.services.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-neutral-500 text-xs font-medium">
                      {quoteRequest.services.length} servicio{quoteRequest.services.length > 1 ? 's' : ''} solicitado{quoteRequest.services.length > 1 ? 's' : ''}:
                    </p>
                    {quoteRequest.services.map((svc, idx) => {
                      const svcLabel = SERVICE_LABELS[svc.service_type as ServiceId] || svc.service_type;
                      const deliveryLabel = svc.delivery_method
                        ? DELIVERY_METHOD_LABELS[svc.delivery_method as DeliveryMethod]?.es
                        : null;
                      return (
                        <div key={svc.id} className="flex items-center gap-2 text-sm">
                          <span className="text-cmyk-cyan font-medium">{idx + 1}.</span>
                          <span className="text-white">{svcLabel}</span>
                          {deliveryLabel && (
                            <span className="text-neutral-500 text-xs">
                              ({DELIVERY_METHOD_ICONS[svc.delivery_method as DeliveryMethod]} {deliveryLabel})
                            </span>
                          )}
                          {svc.required_date && (
                            <span className="text-cmyk-cyan text-xs">
                              — {new Date(svc.required_date + 'T12:00:00').toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Fallback: single-service required date */}
                {(!quoteRequest.services || quoteRequest.services.length === 0) && (() => {
                  // Compute the correct required date from route dates if available
                  let displayDate = quoteRequest.required_date;
                  const details = quoteRequest.service_details as Record<string, unknown> | undefined;
                  if (details && Array.isArray(details.rutas)) {
                    const routeDates = (details.rutas as Array<Record<string, unknown>>)
                      .map(r => r.fecha_inicio as string)
                      .filter(d => !!d)
                      .sort();
                    if (routeDates.length > 0) {
                      const earliest = routeDates[0];
                      // Use earliest route date if it's earlier than stored required_date
                      if (!displayDate || earliest < displayDate) {
                        displayDate = earliest;
                      }
                    }
                  }
                  if (!displayDate) return null;
                  return (
                    <p className="text-cmyk-cyan text-sm mt-1">
                      Fecha requerida: {new Date(displayDate + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  );
                })()}
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Info */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Información del Cliente</h2>
                {quoteRequest && (
                  <button
                    type="button"
                    onClick={() => setCustomerEditable(!customerEditable)}
                    className={`p-2 rounded-lg transition-colors ${
                      customerEditable
                        ? 'text-cmyk-cyan bg-cmyk-cyan/10 hover:bg-cmyk-cyan/20'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                    }`}
                    title={customerEditable ? 'Bloquear campos' : 'Editar datos del cliente'}
                  >
                    {customerEditable ? <CheckIcon className="h-5 w-5" /> : <PencilSquareIcon className="h-5 w-5" />}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-400 text-sm mb-2">
                    Nombre <span className="text-cmyk-magenta">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    readOnly={quoteRequest ? !customerEditable : false}
                    tabIndex={quoteRequest && !customerEditable ? -1 : undefined}
                    placeholder="Nombre del cliente"
                    className={`w-full px-4 py-2 border rounded-lg text-white placeholder-neutral-500 focus:outline-none ${
                      quoteRequest && !customerEditable
                        ? 'bg-neutral-800/50 border-neutral-700/50'
                        : 'bg-neutral-800 border-neutral-700 focus:border-cmyk-cyan'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 text-sm mb-2">
                    Email <span className="text-cmyk-magenta">*</span>
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    readOnly={quoteRequest ? !customerEditable : false}
                    tabIndex={quoteRequest && !customerEditable ? -1 : undefined}
                    placeholder="email@ejemplo.com"
                    className={`w-full px-4 py-2 border rounded-lg text-white placeholder-neutral-500 focus:outline-none ${
                      quoteRequest && !customerEditable
                        ? 'bg-neutral-800/50 border-neutral-700/50'
                        : 'bg-neutral-800 border-neutral-700 focus:border-cmyk-cyan'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 text-sm mb-2">Teléfono</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    readOnly={quoteRequest ? !customerEditable : false}
                    tabIndex={quoteRequest && !customerEditable ? -1 : undefined}
                    placeholder="55 1234 5678"
                    className={`w-full px-4 py-2 border rounded-lg text-white placeholder-neutral-500 focus:outline-none ${
                      quoteRequest && !customerEditable
                        ? 'bg-neutral-800/50 border-neutral-700/50'
                        : 'bg-neutral-800 border-neutral-700 focus:border-cmyk-cyan'
                    }`}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-neutral-400 text-sm mb-2">Empresa</label>
                  <input
                    type="text"
                    value={customerCompany}
                    onChange={(e) => setCustomerCompany(e.target.value)}
                    readOnly={quoteRequest ? !customerEditable : false}
                    tabIndex={quoteRequest && !customerEditable ? -1 : undefined}
                    placeholder="Nombre de la empresa (opcional)"
                    className={`w-full px-4 py-2 border rounded-lg text-white placeholder-neutral-500 focus:outline-none ${
                      quoteRequest && !customerEditable
                        ? 'bg-neutral-800/50 border-neutral-700/50'
                        : 'bg-neutral-800 border-neutral-700 focus:border-cmyk-cyan'
                    }`}
                  />
                </div>
              </div>
            </Card>

            {/* Line Items */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Conceptos</h2>
                <Button
                  onClick={addCustomItem}
                  variant="outline"
                  size="sm"
                  leftIcon={<PlusIcon className="h-4 w-4" />}
                >
                  Agregar Concepto
                </Button>
              </div>

              {/* Search Tabs */}
              <div className="mb-4">
                <div className="flex gap-1 mb-3 bg-neutral-800/50 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setSearchTab('products')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      searchTab === 'products'
                        ? 'bg-neutral-700 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                    Productos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchTab('services')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      searchTab === 'services'
                        ? 'bg-neutral-700 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <WrenchScrewdriverIcon className="h-4 w-4" />
                    Servicios
                  </button>
                </div>

                {/* Product Search */}
                {searchTab === 'products' && (
                  <div className="relative">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                      <input
                        type="text"
                        placeholder="Buscar producto del catálogo..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setShowProductDropdown(true);
                        }}
                        onFocus={() => setShowProductDropdown(true)}
                        onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                        className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan"
                      />
                    </div>

                    {showProductDropdown && productSearch && (
                      <div className="absolute z-10 w-full mt-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl max-h-60 overflow-auto">
                        {filteredProducts.length > 0 ? (
                          filteredProducts.slice(0, 10).map(item => (
                            <button
                              key={item.id}
                              onMouseDown={(e) => { e.preventDefault(); addCatalogItem(item); }}
                              className="w-full px-4 py-3 text-left hover:bg-neutral-700 transition-colors flex justify-between items-center"
                            >
                              <div>
                                <p className="text-white">{item.name}</p>
                                <p className="text-neutral-400 text-sm">{item.category?.name || item.type}</p>
                              </div>
                              <span className="text-cmyk-cyan">{formatCurrency(parseFloat(item.base_price || '0'))}</span>
                            </button>
                          ))
                        ) : (
                          <p className="p-4 text-center text-neutral-400">No se encontraron productos</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Service Search */}
                {searchTab === 'services' && (
                  <div className="relative">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                      <input
                        type="text"
                        placeholder="Buscar servicio..."
                        value={serviceSearchQuery}
                        onChange={(e) => {
                          setServiceSearchQuery(e.target.value);
                          setShowServiceDropdown(true);
                        }}
                        onFocus={() => setShowServiceDropdown(true)}
                        onBlur={() => setTimeout(() => setShowServiceDropdown(false), 200)}
                        className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan"
                      />
                    </div>

                    {showServiceDropdown && (
                      <div className="absolute z-10 w-full mt-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl max-h-72 overflow-auto">
                        {(() => {
                          const query = serviceSearchQuery.toLowerCase();
                          const entries = Object.entries(SERVICE_SUBCATEGORIES) as [LandingServiceId, typeof SERVICE_SUBCATEGORIES[LandingServiceId]][];
                          let hasResults = false;

                          const content = entries.map(([serviceId, subcategories]) => {
                            const serviceLabel = SERVICE_LABELS[serviceId] || serviceId;
                            // Filter subcategories that match the search
                            const matchingSubs = subcategories.filter(sub =>
                              !query ||
                              serviceLabel.toLowerCase().includes(query) ||
                              sub.label.toLowerCase().includes(query) ||
                              `${serviceLabel} ${sub.label}`.toLowerCase().includes(query)
                            );

                            if (matchingSubs.length === 0) return null;
                            hasResults = true;

                            return (
                              <div key={serviceId}>
                                <div className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider bg-neutral-800/80 sticky top-0">
                                  {serviceLabel}
                                </div>
                                {matchingSubs.map(sub => (
                                  <button
                                    key={`${serviceId}-${sub.id}`}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const conceptName = `${serviceLabel} — ${sub.label}`;
                                      const details: ServiceDetailsData = { service_type: serviceId as ServiceId, subtipo: sub.id };
                                      setItems(prev => [...prev, {
                                        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                        concept: conceptName,
                                        description: '',
                                        quantity: 1,
                                        unit: 'servicio',
                                        unit_price: 0,
                                        shipping_cost: 0,
                                        serviceDetails: details,
                                        showServiceForm: true,
                                      }]);
                                      setServiceSearchQuery('');
                                      setShowServiceDropdown(false);
                                    }}
                                    className="w-full px-4 py-2.5 pl-8 text-left hover:bg-neutral-700 transition-colors"
                                  >
                                    <p className="text-white text-sm">{sub.label}</p>
                                  </button>
                                ))}
                              </div>
                            );
                          });

                          if (!hasResults) {
                            return <p className="p-4 text-center text-neutral-400">No se encontraron servicios</p>;
                          }
                          return content;
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Items List */}
              {items.length > 0 ? (
                <div className="space-y-4">
                  {items.map((item, index) => {
                    const itemIsRouteBased = isRouteBasedDetails(item.serviceDetails);
                    const svcRef = item.requestServiceRef;

                    // ── Service item WITH request reference → solicitud-style card ──
                    if (item.serviceDetails && svcRef) {
                      const svcType = svcRef.service_type;
                      const svcLabel = SERVICE_LABELS[svcType as ServiceId] || svcType;
                      const svcDetails = svcRef.service_details as Record<string, unknown> | undefined;

                      // Min date for vendor's estimated delivery = client's required_date or today (whichever is later)
                      const today = new Date().toISOString().split('T')[0];
                      const minEstimatedDate = svcRef.required_date && svcRef.required_date >= today
                        ? svcRef.required_date
                        : today;

                      const formatFileSz = (bytes: number) => {
                        if (bytes < 1024) return `${bytes} B`;
                        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
                        return `${(bytes / 1048576).toFixed(1)} MB`;
                      };

                      return (
                        <div key={item.id} className="relative rounded-xl border border-neutral-700 bg-neutral-800/30 overflow-hidden">
                          {/* Delete button */}
                          <button
                            onClick={() => removeItem(item.id)}
                            className="absolute top-3 right-3 z-10 p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Eliminar concepto"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>

                          {/* Service header — like solicitud detail */}
                          <div className="flex items-center gap-3 p-4 pb-0">
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-cmyk-cyan/20 text-cmyk-cyan text-sm font-bold">
                              {index + 1}
                            </span>
                            <h3 className="text-white font-semibold text-lg">{svcLabel}</h3>
                          </div>

                          {/* Read-only service details from client request */}
                          <div className="p-4">
                            {svcDetails && Object.keys(svcDetails).length > 0 && (
                              <div className="mb-3">
                                <ServiceDetailsDisplay
                                  serviceType={svcType}
                                  serviceDetails={svcDetails}
                                />
                              </div>
                            )}

                            {/* Delivery method, address, required date — read-only from request */}
                            {/* Not shown for publicidad-movil (uses routes, not delivery addresses) */}
                            {svcType !== 'publicidad-movil' && (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {svcRef.delivery_method && (
                                <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                  <p className="text-neutral-500 text-xs mb-1">Método de entrega</p>
                                  <p className="text-white font-medium flex items-center gap-1 mt-auto">
                                    <span>{DELIVERY_METHOD_ICONS[svcRef.delivery_method as DeliveryMethod]}</span>
                                    {DELIVERY_METHOD_LABELS[svcRef.delivery_method as DeliveryMethod]?.es || svcRef.delivery_method}
                                  </p>
                                </div>
                              )}
                              {svcRef.pickup_branch_detail && (
                                <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                  <p className="text-neutral-500 text-xs mb-1">Sucursal de recolección</p>
                                  <p className="text-white font-medium mt-auto">{svcRef.pickup_branch_detail.name}</p>
                                </div>
                              )}
                              {svcRef.delivery_address && Object.keys(svcRef.delivery_address).length > 0 && (
                                <div className="p-3 bg-neutral-900/50 rounded-lg col-span-2 flex flex-col">
                                  <p className="text-neutral-500 text-xs mb-1">
                                    {svcRef.delivery_method === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}
                                  </p>
                                  <p className="text-white font-medium mt-auto">
                                    {[svcRef.delivery_address.street || svcRef.delivery_address.calle,
                                      svcRef.delivery_address.exterior_number || svcRef.delivery_address.numero_exterior,
                                      svcRef.delivery_address.neighborhood || svcRef.delivery_address.colonia,
                                      svcRef.delivery_address.city || svcRef.delivery_address.ciudad,
                                      svcRef.delivery_address.state || svcRef.delivery_address.estado,
                                      svcRef.delivery_address.postal_code || svcRef.delivery_address.codigo_postal,
                                    ].filter(Boolean).join(', ')}
                                  </p>
                                </div>
                              )}
                              {svcRef.required_date && (
                                <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                                  <p className="text-neutral-500 text-xs mb-1">Fecha requerida</p>
                                  <p className="text-white font-medium mt-auto">
                                    {new Date(svcRef.required_date + 'T12:00:00').toLocaleDateString('es-MX', {
                                      year: 'numeric', month: 'short', day: 'numeric',
                                    })}
                                  </p>
                                </div>
                              )}
                              {svcRef.description && svcRef.description.trim() && (
                                <div className="p-3 bg-neutral-900/50 rounded-lg col-span-2 flex flex-col">
                                  <p className="text-neutral-500 text-xs mb-1">Comentarios adicionales</p>
                                  <p className="text-white font-medium mt-auto whitespace-pre-wrap">{svcRef.description}</p>
                                </div>
                              )}
                            </div>
                            )}

                            {/* Per-service attachments */}
                            {svcRef.attachments && svcRef.attachments.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-neutral-700">
                                <p className="text-neutral-500 text-xs mb-2 flex items-center gap-1">
                                  <PaperClipIcon className="h-3 w-3" />
                                  Archivos adjuntos ({svcRef.attachments.length})
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {svcRef.attachments.map((att) => {
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
                                        {att.file_size > 0 && (
                                          <p className="text-neutral-500 text-[10px]">{formatFileSz(att.file_size)}</p>
                                        )}
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ── Vendor-editable fields ── */}
                          <div className="p-4 pt-0">
                            <div className="border-t border-cmyk-cyan/20 pt-4">
                              <p className="text-cmyk-cyan text-xs font-semibold uppercase tracking-wider mb-3">Cotización del vendedor</p>

                              {/* === Route-based: per-route pricing === */}
                              {itemIsRouteBased && (() => {
                                const sd = item.serviceDetails!;
                                const routeArrayKey = sd._vallasRoutes ? '_vallasRoutes'
                                  : sd._pubRoutes ? '_pubRoutes'
                                  : sd._perifoneoRoutes ? '_perifoneoRoutes'
                                  : null;
                                const routes = (routeArrayKey ? sd[routeArrayKey] : null) as
                                  | Array<ConfigurableRouteEntry | EstablishedRouteEntry>
                                  | null;

                                if (!routes || routes.length === 0) return null;

                                // Use functional updater to read latest state (avoids stale closure with batched updates)
                                const updateRouteField = (routeIdx: number, field: string, val: unknown) => {
                                  setItems(prev => prev.map(prevItem => {
                                    if (prevItem.id !== item.id) return prevItem;
                                    const latestSd = prevItem.serviceDetails!;
                                    const latestRoutes = [...(latestSd[routeArrayKey!] as Array<ConfigurableRouteEntry | EstablishedRouteEntry>)];
                                    latestRoutes[routeIdx] = { ...latestRoutes[routeIdx], [field]: val };
                                    return { ...prevItem, serviceDetails: { ...latestSd, [routeArrayKey!]: latestRoutes } };
                                  }));
                                };

                                return (
                                  <div className="space-y-4">
                                    {routes.map((route, rIdx) => {
                                      const qty = route.cantidad || 1;
                                      const price = route.unit_price || 0;
                                      const rutaLabel = 'ruta' in route && route.ruta
                                        ? (subtipoLabels[route.ruta] || route.ruta)
                                        : null;

                                      return (
                                        <div key={route.id} className="rounded-lg border border-neutral-700/60 bg-neutral-900/30 p-3 space-y-3">
                                          {/* Route header */}
                                          <div className="flex items-center gap-2">
                                            <MapPinIcon className="h-4 w-4 text-cmyk-cyan" />
                                            <span className="text-cmyk-cyan text-sm font-semibold">Ruta {rIdx + 1}</span>
                                            {rutaLabel && (
                                              <span className="text-neutral-400 text-xs">— {rutaLabel}</span>
                                            )}
                                          </div>

                                          {/* Cantidad / Precio Unitario / Total */}
                                          <div className="grid grid-cols-3 gap-3">
                                            <div>
                                              <label className="block text-neutral-500 text-xs mb-1">Cantidad</label>
                                              <input
                                                type="number"
                                                min="1"
                                                value={qty}
                                                onChange={(e) => updateRouteField(rIdx, 'cantidad', parseInt(e.target.value) || 1)}
                                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center focus:outline-none focus:border-cmyk-cyan text-sm"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-neutral-500 text-xs mb-1">Precio Unitario</label>
                                              <PriceInput
                                                value={price}
                                                onChange={(val) => updateRouteField(rIdx, 'unit_price', val)}
                                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-neutral-500 text-xs mb-1">Total ruta</label>
                                              <div className="px-3 py-2 bg-neutral-900/50 border border-neutral-700/50 rounded-lg text-white font-medium text-right text-sm">
                                                {formatCurrency(qty * price)}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Fecha de entrega estimada */}
                                          <div>
                                            <label className="block text-neutral-500 text-xs mb-1">
                                              <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />
                                              Fecha de entrega estimada
                                            </label>
                                            <input
                                              type="date"
                                              value={route.estimated_date || ''}
                                              onChange={(e) => updateRouteField(rIdx, 'estimated_date', e.target.value)}
                                              min={route.fechaInicio && route.fechaInicio >= today ? route.fechaInicio : today}
                                              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan text-sm [color-scheme:dark]"
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* Route-based total summary */}
                                    <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/50 rounded-lg border border-neutral-700/50">
                                      <span className="text-neutral-400 text-sm font-medium">Total rutas ({routes.length})</span>
                                      <span className="text-white font-semibold text-sm">{formatCurrency(computeRoutesTotal(sd))}</span>
                                    </div>

                                    {/* Shipping cost (conditional) */}
                                    {(item.lineDeliveryMethod === 'installation' || item.lineDeliveryMethod === 'shipping') && (
                                      <div>
                                        <label className="block text-neutral-500 text-xs mb-1">
                                          <TruckIcon className="h-3.5 w-3.5 inline mr-1" />
                                          Costo de envío <span className="text-neutral-600">(sin IVA)</span>
                                        </label>
                                        <PriceInput
                                          value={item.shipping_cost}
                                          onChange={(val) => updateItem(item.id, 'shipping_cost', val)}
                                          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* === Non-route-based: single pricing row === */}
                              {!itemIsRouteBased && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                  <div>
                                    <label className="block text-neutral-500 text-xs mb-1">Cantidad</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center focus:outline-none focus:border-cmyk-cyan text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-neutral-500 text-xs mb-1">Unidad</label>
                                    <select
                                      value={item.unit}
                                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan text-sm"
                                    >
                                      <option value="pza">pza</option>
                                      <option value="m2">m²</option>
                                      <option value="ml">ml</option>
                                      <option value="kg">kg</option>
                                      <option value="hr">hr</option>
                                      <option value="servicio">servicio</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-neutral-500 text-xs mb-1">Precio Unitario</label>
                                    <PriceInput
                                      value={item.unit_price}
                                      onChange={(val) => updateItem(item.id, 'unit_price', val)}
                                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-neutral-500 text-xs mb-1">Total línea</label>
                                    <div className="px-3 py-2 bg-neutral-900/50 border border-neutral-700/50 rounded-lg text-white font-medium text-right text-sm">
                                      {formatCurrency(item.quantity * item.unit_price)}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Row 2: Shipping cost (conditional) + Estimated delivery date — only for non-route items */}
                              {!itemIsRouteBased && (
                              <div className="grid grid-cols-2 gap-3">
                                {/* Shipping cost — only when delivery is installation or shipping */}
                                {(item.lineDeliveryMethod === 'installation' || item.lineDeliveryMethod === 'shipping') && (
                                  <div>
                                    <label className="block text-neutral-500 text-xs mb-1">
                                      <TruckIcon className="h-3.5 w-3.5 inline mr-1" />
                                      Costo de envío <span className="text-neutral-600">(sin IVA)</span>
                                    </label>
                                    <PriceInput
                                      value={item.shipping_cost}
                                      onChange={(val) => updateItem(item.id, 'shipping_cost', val)}
                                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
                                    />
                                  </div>
                                )}
                                <div className={!(item.lineDeliveryMethod === 'installation' || item.lineDeliveryMethod === 'shipping') ? 'col-span-2 md:col-span-1' : ''}>
                                  <label className="block text-neutral-500 text-xs mb-1">
                                    <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />
                                    Fecha de entrega estimada
                                  </label>
                                  <input
                                    type="date"
                                    value={item.lineEstimatedDate || ''}
                                    onChange={(e) => updateItem(item.id, 'lineEstimatedDate', e.target.value)}
                                    min={minEstimatedDate}
                                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan text-sm [color-scheme:dark]"
                                  />
                                </div>
                              </div>
                              )}


                            </div>
                          </div>
                        </div>
                      );
                    }

                    // ── Non-request items (catalog products, custom items, manually added services) ──

                    // Service-based vendor item → new card UI (matches solicitud-style)
                    if (item.serviceDetails) {
                      const svcType = item.serviceDetails.service_type as ServiceId;
                      const svcLabel = SERVICE_LABELS[svcType] || svcType;
                      const today = new Date().toISOString().split('T')[0];

                      return (
                        <div key={item.id} className="relative rounded-xl border border-neutral-700 bg-neutral-800/30 overflow-hidden">
                          {/* Delete button */}
                          <button
                            onClick={() => removeItem(item.id)}
                            className="absolute top-3 right-3 z-10 p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Eliminar concepto"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>

                          {/* Service header */}
                          <div className="flex items-center gap-3 p-4 pb-0">
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-cmyk-cyan/20 text-cmyk-cyan text-sm font-bold">
                              {index + 1}
                            </span>
                            <h3 className="text-white font-semibold text-lg">{svcLabel}</h3>
                            <span className="ml-auto mr-8 text-xs text-neutral-500 italic">Agregado por vendedor</span>
                          </div>

                          {/* Editable service details form */}
                          <div className="p-4">
                            <div className="mb-3">
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, 'showServiceForm', !item.showServiceForm)}
                                className="flex items-center gap-2 text-xs font-medium text-cmyk-cyan hover:text-cmyk-cyan/80 transition-colors"
                              >
                                <WrenchScrewdriverIcon className="h-4 w-4" />
                                <span>{item.showServiceForm ? 'Ocultar' : 'Mostrar'} detalle de servicio</span>
                                <svg className={`h-3 w-3 transition-transform ${item.showServiceForm ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {item.showServiceForm && (
                                <div className="mt-3">
                                  <ServiceFormFields
                                    value={item.serviceDetails}
                                    onChange={(details) => updateItem(item.id, 'serviceDetails', details)}
                                    hideRoutePricing
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ── Vendor-editable pricing fields ── */}
                          <div className="p-4 pt-0">
                            <div className="border-t border-cmyk-cyan/20 pt-4">
                              <p className="text-cmyk-cyan text-xs font-semibold uppercase tracking-wider mb-3">Cotización del vendedor</p>

                              {/* === Route-based: per-route pricing === */}
                              {itemIsRouteBased && (() => {
                                const sd = item.serviceDetails!;
                                const routeArrayKey = sd._vallasRoutes ? '_vallasRoutes'
                                  : sd._pubRoutes ? '_pubRoutes'
                                  : sd._perifoneoRoutes ? '_perifoneoRoutes'
                                  : null;
                                const routes = (routeArrayKey ? sd[routeArrayKey] : null) as
                                  | Array<ConfigurableRouteEntry | EstablishedRouteEntry>
                                  | null;

                                if (!routes || routes.length === 0) return null;

                                // Use functional updater to read latest state (avoids stale closure with batched updates)
                                const updateRouteField = (routeIdx: number, field: string, val: unknown) => {
                                  setItems(prev => prev.map(prevItem => {
                                    if (prevItem.id !== item.id) return prevItem;
                                    const latestSd = prevItem.serviceDetails!;
                                    const latestRoutes = [...(latestSd[routeArrayKey!] as Array<ConfigurableRouteEntry | EstablishedRouteEntry>)];
                                    latestRoutes[routeIdx] = { ...latestRoutes[routeIdx], [field]: val };
                                    return { ...prevItem, serviceDetails: { ...latestSd, [routeArrayKey!]: latestRoutes } };
                                  }));
                                };

                                return (
                                  <div className="space-y-4">
                                    {routes.map((route, rIdx) => {
                                      const qty = route.cantidad || 1;
                                      const price = route.unit_price || 0;
                                      const rutaLabel = 'ruta' in route && route.ruta
                                        ? (subtipoLabels[route.ruta] || route.ruta)
                                        : null;

                                      return (
                                        <div key={route.id} className="rounded-lg border border-neutral-700/60 bg-neutral-900/30 p-3 space-y-3">
                                          <div className="flex items-center gap-2">
                                            <MapPinIcon className="h-4 w-4 text-cmyk-cyan" />
                                            <span className="text-cmyk-cyan text-sm font-semibold">Ruta {rIdx + 1}</span>
                                            {rutaLabel && <span className="text-neutral-400 text-xs">— {rutaLabel}</span>}
                                          </div>
                                          <div className="grid grid-cols-3 gap-3">
                                            <div>
                                              <label className="block text-neutral-500 text-xs mb-1">Cantidad</label>
                                              <input type="number" min="1" value={qty}
                                                onChange={(e) => updateRouteField(rIdx, 'cantidad', parseInt(e.target.value) || 1)}
                                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center focus:outline-none focus:border-cmyk-cyan text-sm"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-neutral-500 text-xs mb-1">Precio Unitario</label>
                                              <PriceInput value={price}
                                                onChange={(val) => updateRouteField(rIdx, 'unit_price', val)}
                                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-neutral-500 text-xs mb-1">Total ruta</label>
                                              <div className="px-3 py-2 bg-neutral-900/50 border border-neutral-700/50 rounded-lg text-white font-medium text-right text-sm">
                                                {formatCurrency(qty * price)}
                                              </div>
                                            </div>
                                          </div>
                                          <div>
                                            <label className="block text-neutral-500 text-xs mb-1">
                                              <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />Fecha de entrega estimada
                                            </label>
                                            <input type="date" value={route.estimated_date || ''}
                                              onChange={(e) => updateRouteField(rIdx, 'estimated_date', e.target.value)}
                                              min={route.fechaInicio && route.fechaInicio >= today ? route.fechaInicio : today}
                                              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan text-sm [color-scheme:dark]"
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                    <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/50 rounded-lg border border-neutral-700/50">
                                      <span className="text-neutral-400 text-sm font-medium">Total rutas ({routes.length})</span>
                                      <span className="text-white font-semibold text-sm">{formatCurrency(computeRoutesTotal(sd))}</span>
                                    </div>
                                    {(item.lineDeliveryMethod === 'installation' || item.lineDeliveryMethod === 'shipping') && (
                                      <div>
                                        <label className="block text-neutral-500 text-xs mb-1">
                                          <TruckIcon className="h-3.5 w-3.5 inline mr-1" />Costo de envío <span className="text-neutral-600">(sin IVA)</span>
                                        </label>
                                        <PriceInput value={item.shipping_cost}
                                          onChange={(val) => updateItem(item.id, 'shipping_cost', val)}
                                          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* === Non-route-based: single pricing row === */}
                              {!itemIsRouteBased && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                  <div>
                                    <label className="block text-neutral-500 text-xs mb-1">Cantidad</label>
                                    <input type="number" min="1" value={item.quantity}
                                      onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center focus:outline-none focus:border-cmyk-cyan text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-neutral-500 text-xs mb-1">Unidad</label>
                                    <select value={item.unit}
                                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan text-sm"
                                    >
                                      <option value="pza">pza</option>
                                      <option value="m2">m²</option>
                                      <option value="ml">ml</option>
                                      <option value="kg">kg</option>
                                      <option value="hr">hr</option>
                                      <option value="servicio">servicio</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-neutral-500 text-xs mb-1">Precio Unitario</label>
                                    <PriceInput value={item.unit_price}
                                      onChange={(val) => updateItem(item.id, 'unit_price', val)}
                                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-neutral-500 text-xs mb-1">Total línea</label>
                                    <div className="px-3 py-2 bg-neutral-900/50 border border-neutral-700/50 rounded-lg text-white font-medium text-right text-sm">
                                      {formatCurrency(item.quantity * item.unit_price)}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Delivery method (optional), Shipping cost, Estimated delivery, Description */}
                              {!itemIsRouteBased && (
                                <>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                    <div>
                                      <label className="block text-neutral-500 text-xs mb-1">
                                        <TruckIcon className="h-3.5 w-3.5 inline mr-1" />Método de entrega
                                      </label>
                                      <select
                                        value={item.lineDeliveryMethod || ''}
                                        onChange={(e) => {
                                          const val = e.target.value as DeliveryMethod | '';
                                          updateItem(item.id, 'lineDeliveryMethod', val);
                                          if (val !== 'shipping' && val !== 'installation') {
                                            updateItem(item.id, 'shipping_cost', 0);
                                          }
                                        }}
                                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan text-sm"
                                      >
                                        <option value="">— Sin especificar —</option>
                                        {(['installation', 'pickup', 'shipping', 'digital', 'not_applicable'] as DeliveryMethod[]).map(m => (
                                          <option key={m} value={m}>
                                            {DELIVERY_METHOD_ICONS[m]} {DELIVERY_METHOD_LABELS[m].es}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    {(item.lineDeliveryMethod === 'installation' || item.lineDeliveryMethod === 'shipping') && (
                                      <div>
                                        <label className="block text-neutral-500 text-xs mb-1">
                                          Costo de envío <span className="text-neutral-600">(sin IVA)</span>
                                        </label>
                                        <PriceInput value={item.shipping_cost}
                                          onChange={(val) => updateItem(item.id, 'shipping_cost', val)}
                                          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
                                        />
                                      </div>
                                    )}
                                    <div>
                                      <label className="block text-neutral-500 text-xs mb-1">
                                        <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />Fecha de entrega estimada
                                      </label>
                                      <input type="date" value={item.lineEstimatedDate || ''}
                                        onChange={(e) => updateItem(item.id, 'lineEstimatedDate', e.target.value)}
                                        min={today}
                                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan text-sm [color-scheme:dark]"
                                      />
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // ── Plain items (catalog products, custom concepts without service) ──
                    return (
                    <div key={item.id} className="relative rounded-xl border border-neutral-700 bg-neutral-800/30 overflow-hidden">
                      {/* Delete button */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="absolute top-3 right-3 z-10 p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Eliminar concepto"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>

                      <div className="flex items-center gap-3 p-4 pb-0">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-neutral-700 text-neutral-300 text-sm font-bold">
                          {index + 1}
                        </span>
                        <h3 className="text-white font-semibold text-lg">Concepto personalizado</h3>
                      </div>

                      <div className="p-4">
                        <div className="border-t border-cmyk-cyan/20 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-neutral-500 text-xs mb-1">Concepto *</label>
                              <input type="text" value={item.concept}
                                onChange={(e) => updateItem(item.id, 'concept', e.target.value)}
                                placeholder="Nombre del concepto"
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-neutral-500 text-xs mb-1">Descripción</label>
                              <textarea value={item.description || ''}
                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                placeholder="Descripción opcional"
                                rows={1}
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan text-sm resize-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <div>
                              <label className="block text-neutral-500 text-xs mb-1">Cantidad</label>
                              <input type="number" min="1" value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center focus:outline-none focus:border-cmyk-cyan text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-neutral-500 text-xs mb-1">Unidad</label>
                              <select value={item.unit}
                                onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan text-sm"
                              >
                                <option value="pza">pza</option>
                                <option value="m2">m²</option>
                                <option value="ml">ml</option>
                                <option value="kg">kg</option>
                                <option value="hr">hr</option>
                                <option value="servicio">servicio</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-neutral-500 text-xs mb-1">Precio Unitario</label>
                              <PriceInput value={item.unit_price}
                                onChange={(val) => updateItem(item.id, 'unit_price', val)}
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-neutral-500 text-xs mb-1">Total línea</label>
                              <div className="px-3 py-2 bg-neutral-900/50 border border-neutral-700/50 rounded-lg text-white font-medium text-right text-sm">
                                {formatCurrency(item.quantity * item.unit_price)}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="block text-neutral-500 text-xs mb-1">
                                <TruckIcon className="h-3.5 w-3.5 inline mr-1" />Método de entrega
                              </label>
                              <select
                                value={item.lineDeliveryMethod || ''}
                                onChange={(e) => {
                                  const val = e.target.value as DeliveryMethod | '';
                                  updateItem(item.id, 'lineDeliveryMethod', val);
                                  if (val !== 'shipping' && val !== 'installation') {
                                    updateItem(item.id, 'shipping_cost', 0);
                                  }
                                }}
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan text-sm"
                              >
                                <option value="">— Sin especificar —</option>
                                {(['installation', 'pickup', 'shipping', 'digital', 'not_applicable'] as DeliveryMethod[]).map(m => (
                                  <option key={m} value={m}>
                                    {DELIVERY_METHOD_ICONS[m]} {DELIVERY_METHOD_LABELS[m].es}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {(item.lineDeliveryMethod === 'installation' || item.lineDeliveryMethod === 'shipping') && (
                              <div>
                                <label className="block text-neutral-500 text-xs mb-1">
                                  Costo de envío <span className="text-neutral-600">(sin IVA)</span>
                                </label>
                                <PriceInput value={item.shipping_cost}
                                  onChange={(val) => updateItem(item.id, 'shipping_cost', val)}
                                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
                                />
                              </div>
                            )}
                            <div>
                              <label className="block text-neutral-500 text-xs mb-1">
                                <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />Fecha de entrega estimada
                              </label>
                              <input type="date" value={item.lineEstimatedDate || ''}
                                onChange={(e) => updateItem(item.id, 'lineEstimatedDate', e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan text-sm [color-scheme:dark]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-400 border border-dashed border-neutral-700 rounded-lg">
                  <p>No hay conceptos agregados</p>
                  <p className="text-sm mt-1">Busca productos o servicios del catálogo, o agrega conceptos personalizados</p>
                </div>
              )}
            </Card>

            {/* Additional Options */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Configuración</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-neutral-400 text-sm mb-2">Vigencia (días)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={validDays}
                    onChange={(e) => setValidDays(parseInt(e.target.value) || 15)}
                    className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 text-sm mb-2">Modo de Pago</label>
                  <div className="px-4 py-2 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-neutral-300 text-sm">
                    Pago completo
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-neutral-400 text-sm mb-2">Términos y Condiciones</label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Términos y condiciones para el cliente..."
                  rows={3}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan resize-none"
                />
              </div>

              <div>
                <label className="block text-neutral-400 text-sm mb-2">Notas Internas (no visibles para el cliente)</label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Notas internas para el equipo..."
                  rows={2}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan resize-none"
                />
              </div>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-white mb-4">Resumen</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>IVA (16%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                {shippingTotal > 0 && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Envío <span className="text-xs text-neutral-500">(sin IVA)</span></span>
                    <span>{formatCurrency(shippingTotal)}</span>
                  </div>
                )}
                <div className="border-t border-neutral-700 pt-3 flex justify-between text-white font-semibold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    if (!validateForm()) return;
                    setShowSendConfirm(true);
                  }}
                  disabled={isSubmitting || items.length === 0 || !!cannotCreateForRequest}
                  className="w-full"
                >
                  Crear y Enviar
                </Button>
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting || items.length === 0 || !!cannotCreateForRequest}
                  variant="outline"
                  className="w-full"
                >
                  Guardar Borrador
                </Button>
                <button
                  onClick={() => router.back()}
                  className="w-full py-2 text-neutral-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>

              {/* Info */}
              <div className="mt-6 p-4 bg-neutral-800/50 rounded-lg">
                <p className="text-neutral-400 text-sm">
                  <strong className="text-white">Nota:</strong> Al crear y enviar, el cliente recibirá un email con el enlace para ver y aceptar la cotización.
                </p>
              </div>
            </Card>
          </div>
        </div>

    {/* Send Confirmation Modal */}
    <SendConfirmationModal
      isOpen={showSendConfirm}
      onClose={() => setShowSendConfirm(false)}
      onConfirm={() => {
        setShowSendConfirm(false);
        handleSubmit(true);
      }}
      isLoading={isSubmitting}
      customerName={customerName}
      customerEmail={customerEmail}
      lines={items.flatMap((item) => {
        let concept = item.concept;
        if (item.serviceDetails && item.serviceDetails.service_type) {
          const svcLabel = SERVICE_LABELS[item.serviceDetails.service_type as ServiceId] || item.serviceDetails.service_type;
          const subLabel = item.serviceDetails.subtipo
            ? subtipoLabels[item.serviceDetails.subtipo as string] || (item.serviceDetails.subtipo as string)
            : '';
          concept = subLabel ? `${svcLabel} — ${subLabel}` : svcLabel;
        }
        if (isRouteBasedDetails(item.serviceDetails)) {
          return expandRouteLines(item.serviceDetails!, concept, item.description || '');
        }
        return [{
          concept,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          line_total: item.quantity * item.unit_price,
        }];
      })}
      subtotal={subtotal}
      taxAmount={taxAmount}
      shippingTotal={shippingTotal}
      total={total}
    />

    {/* Success/Error Modal */}
    <SuccessModal
      isOpen={modal.open}
      onClose={() => {
        setModal((m) => ({ ...m, open: false }));
        const dest = modal.redirectTo || (modal.variant === 'success' ? `/${locale}/dashboard/cotizaciones` : undefined);
        if (dest) {
          router.push(dest);
        }
      }}
      title={modal.title}
      message={modal.message}
      variant={modal.variant}
    />
    </div>
  );
}
