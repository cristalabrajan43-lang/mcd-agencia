'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CalendarIcon,
  PaperClipIcon,
  CreditCardIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline';

import { getOrderById, setOrderPaymentMethod } from '@/lib/api/orders';
import { getOrderTracking, type OrderTrackingTimeline } from '@/lib/api/tracking';
import { getQuoteById, getQuotes } from '@/lib/api/quotes';
import { initiateMercadoPagoPayment, initiatePayPalPayment } from '@/lib/api/payments';
import { getBranches } from '@/lib/api/content';
import { Card, Badge, Button, LoadingPage, Breadcrumb } from '@/components/ui';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import { DELIVERY_METHOD_LABELS, DELIVERY_METHOD_ICONS, type DeliveryMethod } from '@/lib/service-ids';
import { ServiceDetailsDisplay } from '@/components/quotes/ServiceDetailsDisplay';
import { OrderTrackingTimelineView } from '@/components/orders/OrderTrackingTimeline';
import toast from 'react-hot-toast';

const STATUS_ICONS: Record<string, typeof CheckCircleIcon> = {
  draft: ClockIcon,
  pending_payment: ClockIcon,
  paid: CheckCircleIcon,
  partially_paid: CheckCircleIcon,
  in_production: ClockIcon,
  ready: CheckCircleIcon,
  in_delivery: TruckIcon,
  completed: CheckCircleIcon,
  cancelled: XCircleIcon,
  refunded: XCircleIcon,
};

const STATUS_LABELS_ES: Record<string, string> = {
  draft: 'Borrador',
  pending_payment: 'Pendiente de confirmación',
  paid: 'Pagado',
  partially_paid: 'Pago parcial',
  in_production: 'En producción',
  ready: 'Pedido realizado',
  in_delivery: 'Enviado',
  completed: 'Entregado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  paypal: 'PayPal',
  bank_transfer: 'Transferencia',
  cash: 'Efectivo',
};

const PAYMENT_OPTIONS: Array<{
  key: 'mercadopago' | 'paypal' | 'bank_transfer' | 'cash';
  label: string;
  Icon: typeof CreditCardIcon;
  hint: string;
  badge: string;
}> = [
  {
    key: 'mercadopago',
    label: 'Mercado Pago',
    Icon: CreditCardIcon,
    hint: 'Tarjetas y saldo disponible',
    badge: 'MP',
  },
  {
    key: 'paypal',
    label: 'PayPal',
    Icon: CreditCardIcon,
    hint: 'Pago seguro con cuenta PayPal',
    badge: 'PP',
  },
  {
    key: 'bank_transfer',
    label: 'Transferencia',
    Icon: BuildingLibraryIcon,
    hint: 'Validación manual por administrador',
    badge: 'CLABE',
  },
  {
    key: 'cash',
    label: 'Efectivo',
    Icon: BanknotesIcon,
    hint: 'Pago presencial y validación manual',
    badge: 'Cash',
  },
];

const QUOTE_NUMBER_REGEX = /(COT-\d{8}-\d+)/i;

type CashBranchInfo = {
  id: string;
  name: string;
  full_address: string;
  phone: string;
  hours: string;
  city?: string;
  state?: string;
};

const CASH_BRANCH_FALLBACKS: CashBranchInfo[] = [
  {
    id: 'fallback-costa-azul',
    name: 'Agencia MCD Costa Azul',
    full_address: 'Capitán Vasco de Gama 295, 2° piso Plaza Yamaha, Fracc. Costa Azul, 39850 Acapulco de Juárez, Gro.',
    phone: '+52 744 688 7382',
    hours: 'Lunes a Viernes: 9:00 - 18:00 Sábados: 9:00 - 14:00',
    city: 'Acapulco de Juárez',
    state: 'Guerrero',
  },
];

const extractQuoteNumber = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const match = value.match(QUOTE_NUMBER_REGEX);
  return match?.[1]?.toUpperCase() || '';
};

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const isMountedRef = useRef(true);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'mercadopago' | 'paypal' | 'bank_transfer' | 'cash'>('mercadopago');
  const [isPaying, setIsPaying] = useState(false);
  const [isAttachmentsModalOpen, setIsAttachmentsModalOpen] = useState(false);
  const [activeAttachments, setActiveAttachments] = useState<Array<Record<string, unknown>>>([]);
  const [transferReference, setTransferReference] = useState('');
  const [transferFiles, setTransferFiles] = useState<File[]>([]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrderById(orderId),
  });

  const { data: tracking, isLoading: trackingLoading, isError: trackingError, refetch: refetchTracking } = useQuery({
    queryKey: ['order-tracking', orderId],
    queryFn: () => getOrderTracking(orderId),
    enabled: Boolean(order?.id),
    refetchInterval: 60_000,
    retry: 2,
  });

  const inferredQuoteNumber = (() => {
    if (!order) return '';

    const historyQuoteNumber = (Array.isArray(order.status_history) ? order.status_history : [])
      .map((entry) => extractQuoteNumber(entry?.notes))
      .find(Boolean);

    const skuQuoteNumber = (Array.isArray(order.lines) ? order.lines : [])
      .map((line) => extractQuoteNumber(line?.sku))
      .find(Boolean);

    return historyQuoteNumber || skuQuoteNumber || '';
  })();

  const { data: sourceQuoteById } = useQuery({
    queryKey: ['order-source-quote', order?.quote],
    queryFn: () => getQuoteById(order!.quote as string),
    enabled: Boolean(order?.quote),
  });

  const { data: sourceQuoteByNumber } = useQuery({
    queryKey: ['order-source-quote-by-number', inferredQuoteNumber],
    enabled: Boolean(!order?.quote && inferredQuoteNumber),
    queryFn: async () => {
      const response = await getQuotes({ search: inferredQuoteNumber, page: 1 });
      const exactMatch = response.results?.find(
        (quote) => quote.quote_number?.toUpperCase() === inferredQuoteNumber
      );
      return exactMatch || response.results?.[0] || null;
    },
  });

  const sourceQuote = sourceQuoteById || sourceQuoteByNumber || undefined;

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-for-cash-payment'],
    queryFn: getBranches,
    enabled: Boolean(order?.id) && selectedPaymentMethod === 'cash',
  });

  const cashBranches: CashBranchInfo[] = (() => {
    const safeText = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      return '';
    };

    const normalizedFromApi: CashBranchInfo[] = branches.map((branch) => ({
      id: String(branch.id),
      name: safeText((branch as unknown as Record<string, unknown>).name),
      full_address: safeText((branch as unknown as Record<string, unknown>).full_address),
      phone: safeText((branch as unknown as Record<string, unknown>).phone),
      hours: safeText((branch as unknown as Record<string, unknown>).hours),
      city: safeText((branch as unknown as Record<string, unknown>).city),
      state: safeText((branch as unknown as Record<string, unknown>).state),
    }));

    const branchMap = new Map<string, CashBranchInfo>();
    const getKey = (branch: CashBranchInfo) => `${branch.name}|${branch.full_address}`.toLowerCase().trim();

    normalizedFromApi.forEach((branch) => {
      if (!branch.name && !branch.full_address) return;
      branchMap.set(getKey(branch), branch);
    });

    CASH_BRANCH_FALLBACKS.forEach((branch) => {
      if (!branchMap.has(getKey(branch))) {
        branchMap.set(getKey(branch), branch);
      }
    });

    return Array.from(branchMap.values());
  })();

  const toSafeText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  };

  const formatAddress = (value: unknown): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value !== 'object' || Array.isArray(value)) return '';

    const address = value as Record<string, unknown>;
    const parts = [
      toSafeText(address.street) || toSafeText(address.calle),
      toSafeText(address.exterior_number) || toSafeText(address.numero_exterior),
      toSafeText(address.interior_number) || toSafeText(address.numero_interior),
      toSafeText(address.neighborhood) || toSafeText(address.colonia),
      toSafeText(address.city) || toSafeText(address.ciudad),
      toSafeText(address.state) || toSafeText(address.estado),
      toSafeText(address.postal_code) || toSafeText(address.codigo_postal),
      toSafeText(address.reference) || toSafeText(address.referencia),
    ].filter(Boolean);

    return parts.join(', ');
  };

  const parseJsonIfString = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return value;
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  };

  const isImageFile = (attachment: Record<string, unknown>): boolean => {
    const fileUrl = toSafeText(attachment.file_url) || toSafeText(attachment.file);
    const fileName = (toSafeText(attachment.file_name) || toSafeText(attachment.filename) || fileUrl).toLowerCase();
    return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/.test(fileName);
  };

  const openAttachmentsModal = (attachments: Array<Record<string, unknown>>) => {
    if (!attachments.length) return;
    setActiveAttachments(attachments);
    setIsAttachmentsModalOpen(true);
  };

  const flattenTechnicalDetails = (value: unknown, prefix = ''): Array<{ label: string; value: string }> => {
    const normalizedValue = parseJsonIfString(value);
    if (normalizedValue === null || normalizedValue === undefined || normalizedValue === '') return [];

    if (typeof normalizedValue === 'string' || typeof normalizedValue === 'number' || typeof normalizedValue === 'boolean') {
      return prefix ? [{ label: prefix, value: String(normalizedValue) }] : [];
    }

    if (Array.isArray(normalizedValue)) {
      const arrayEntries: Array<{ label: string; value: string }> = [];
      normalizedValue.forEach((item, index) => {
        const itemLabel = prefix ? `${prefix} [${index + 1}]` : `item_${index + 1}`;
        arrayEntries.push(...flattenTechnicalDetails(item, itemLabel));
      });
      return arrayEntries;
    }

    if (typeof normalizedValue !== 'object') return [];

    const entries: Array<{ label: string; value: string }> = [];
    for (const [key, rawValueInput] of Object.entries(normalizedValue as Record<string, unknown>)) {
      const rawValue = parseJsonIfString(rawValueInput);
      const label = prefix ? `${prefix} · ${key}` : key;
      if (rawValue === null || rawValue === undefined || rawValue === '') continue;

      if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        entries.push({ label, value: String(rawValue) });
      } else if (Array.isArray(rawValue) || typeof rawValue === 'object') {
        entries.push(...flattenTechnicalDetails(rawValue, label));
      }
    }

    return entries;
  };

  if (isLoading) {
    return <LoadingPage message="Cargando pedido..." />;
  }

  if (error || !order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-white mb-4">Pedido no encontrado</h2>
        <Link href="/mi-cuenta/pedidos">
          <Button>Volver a mis pedidos</Button>
        </Link>
      </div>
    );
  }

  const rawStatus = toSafeText(order.status);
  const orderLines = Array.isArray(order.lines) ? order.lines : [];
  const statusHistory = Array.isArray(order.status_history) ? order.status_history : [];
  const fullStatusHistory = [...statusHistory].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const uniqueStatusHistory = fullStatusHistory.filter((item, index, items) => {
    const previous = items[index - 1];
    if (!previous) return true;
    return previous.to_status !== item.to_status;
  });
  const quoteLinesById = new Map(
    (sourceQuote?.lines || []).map((quoteLine) => [String(quoteLine.id), quoteLine])
  );
  const shippingAddressText = formatAddress(order.shipping_address);
  const paymentMethodText = toSafeText(order.payment_method);
  const paymentMethodLabel = PAYMENT_METHOD_LABELS[paymentMethodText] || paymentMethodText;
  const isManualPaymentMethod = paymentMethodText === 'bank_transfer' || paymentMethodText === 'cash';
  const effectiveStatus =
    ['pending_payment', 'partially_paid'].includes(rawStatus) && !isManualPaymentMethod
      ? 'paid'
      : rawStatus;
  const StatusIcon = STATUS_ICONS[effectiveStatus] || ClockIcon;
  const deliveryMethodFromNotes = (() => {
    const notes = toSafeText(order.notes);
    const match = notes.match(/Metodo de entrega:\s*(shipping|pickup|installation|digital|not_applicable)/i);
    return (match?.[1] || '').toLowerCase();
  })();

  const resolvedDeliveryMethod = (toSafeText(order.delivery_method) || deliveryMethodFromNotes || '').toLowerCase();
  const canPay =
    ['pending_payment', 'partially_paid'].includes(rawStatus) &&
    Number(order.balance_due) > 0 &&
    isManualPaymentMethod;
  const shouldShowSelectedPaymentMethod = Boolean(paymentMethodText);

  const metadataRecords = orderLines
    .map((line) => (line.metadata && typeof line.metadata === 'object' && !Array.isArray(line.metadata)
      ? (line.metadata as Record<string, unknown>)
      : null))
    .filter((record): record is Record<string, unknown> => Boolean(record));

  const fallbackRequestDescription = metadataRecords
    .map((record) => toSafeText(record.quote_request_description) || toSafeText(record.description))
    .find(Boolean) || '';

  const fallbackRequiredDate = metadataRecords
    .map((record) => toSafeText(record.quote_request_required_date) || toSafeText(record.required_date))
    .find(Boolean) || '';

  const fallbackAttachments = metadataRecords
    .flatMap((record) => {
      const attachments = parseJsonIfString(record.quote_request_attachments || record.attachments);
      return Array.isArray(attachments) ? attachments : [];
    })
    .filter((attachment) => attachment && typeof attachment === 'object') as Array<Record<string, unknown>>;

  const parseMoneyValue = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'string') return 0;
    const normalized = value.replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const shippingFromQuoteLines = (sourceQuote?.lines || []).reduce((sum, line) => {
    return sum + parseMoneyValue(line.shipping_cost);
  }, 0);

  const shippingFromOrderMetadata = metadataRecords.reduce((sum, record) => {
    return sum + parseMoneyValue(
      record.shipping_cost ||
      record.quote_line_shipping_cost ||
      record.shippingCost ||
      record.quote_shipping_cost
    );
  }, 0);

  const shippingFeeFromDeliveryAddress = parseMoneyValue((order.delivery_address as Record<string, unknown> | undefined)?.shipping_fee);
  const resolvedShippingCost =
    shippingFeeFromDeliveryAddress > 0
      ? shippingFeeFromDeliveryAddress
      : (shippingFromQuoteLines > 0 ? shippingFromQuoteLines : shippingFromOrderMetadata);
  const packageGuideEvents = ((tracking?.events || []).filter((event) =>
    ['tracking', 'logistics', 'custom'].includes(event.event_type)
  )).sort((a, b) => {
    const aTime = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
    const bTime = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
    return bTime - aTime;
  });
  const trackingNumber = tracking?.tracking_number || toSafeText(order.tracking_number);
  const trackingUrl = tracking?.tracking_url || toSafeText(order.tracking_url);
  const fallbackTracking: OrderTrackingTimeline | null = tracking || !order ? null : {
    order_id: order.id,
    order_number: order.order_number,
    current_status: order.status,
    current_status_label: STATUS_LABELS_ES[effectiveStatus] || toSafeText(order.status_display) || order.status,
    delivery_method: order.delivery_method,
    tracking_number: trackingNumber,
    tracking_url: trackingUrl,
    events: uniqueStatusHistory.map((item) => ({
      id: item.id,
      event_type: 'status_change',
      title: STATUS_LABELS_ES[item.to_status] || toSafeText(item.to_status),
      description: toSafeText(item.notes),
      occurred_at: item.created_at,
      phase: 'completed' as const,
    })),
    pending_steps: [],
    is_terminal: ['cancelled', 'refunded', 'completed'].includes(order.status),
  };
  const resolvedTracking = tracking || fallbackTracking;

  const handlePayment = async () => {
    if (!canPay || isPaying) return;

    if (selectedPaymentMethod === 'bank_transfer') {
      const hasReference = Boolean(transferReference.trim());
      const hasReceiptImage = transferFiles.length > 0;
      if (!hasReference && !hasReceiptImage) {
        toast.error('Ingresa una referencia o sube una imagen del comprobante para continuar.');
        return;
      }
    }

    setIsPaying(true);
    try {
      await setOrderPaymentMethod(order.id, selectedPaymentMethod);

      if (!isMountedRef.current) return;

      if (selectedPaymentMethod === 'mercadopago') {
        const preference = await initiateMercadoPagoPayment(order.id);
        const redirectUrl = process.env.NODE_ENV === 'production'
          ? preference.init_point
          : preference.sandbox_init_point || preference.init_point;
        window.location.href = redirectUrl;
        return;
      }

      if (selectedPaymentMethod === 'paypal') {
        const paypalOrder = await initiatePayPalPayment(order.id);
        window.location.href = paypalOrder.approval_url;
        return;
      }

      if (!isMountedRef.current) return;

      if (selectedPaymentMethod === 'bank_transfer') {
        toast.success(
          `Transferencia registrada (${transferReference.trim() || 'sin referencia'}). ` +
          `Adjuntos: ${transferFiles.length}. Un asesor validará tu pago.`
        );
      } else {
        toast.success('Método seleccionado: efectivo. Un administrador confirmará el pago.');
      }
    } catch (error) {
      if (!isMountedRef.current) return;

      const err = error as { message?: string };
      toast.error(err.message || 'Error al procesar el pago');
      setIsPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Mi Cuenta', href: '/mi-cuenta' },
          { label: 'Pedidos', href: '/mi-cuenta/pedidos' },
          { label: `#${order.order_number}` },
        ]}
        showHome={false}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Pedido #{order.order_number}</h2>
          <p className="text-neutral-400">Realizado el {formatDate(order.created_at)}</p>
        </div>
        <Badge
          variant={
            effectiveStatus === 'completed'
              ? 'success'
              : effectiveStatus === 'cancelled'
              ? 'error'
              : effectiveStatus === 'paid' || effectiveStatus === 'in_production' || effectiveStatus === 'ready' || effectiveStatus === 'in_delivery'
              ? 'info'
              : 'warning'
          }
          size="md"
        >
          <StatusIcon className="h-4 w-4 mr-1" />
          {STATUS_LABELS_ES[effectiveStatus] || toSafeText(order.status_display) || effectiveStatus}
        </Badge>
      </div>

      <Card className="border-cmyk-cyan/20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white">Seguimiento completo</h3>
            <p className="text-sm text-neutral-400 mt-1">
              Estado actual, historial y guía de envío de tu pedido
            </p>
          </div>
          {resolvedTracking?.current_status_label && (
            <Badge variant="info" size="md">
              {resolvedTracking.current_status_label}
            </Badge>
          )}
        </div>

        {trackingLoading ? (
          <p className="text-sm text-neutral-500 mb-6">Cargando seguimiento...</p>
        ) : resolvedTracking ? (
          <div className="mb-8">
            <OrderTrackingTimelineView tracking={resolvedTracking} />
          </div>
        ) : (
          <p className="text-sm text-neutral-500 mb-6">
            El seguimiento se actualizará cuando el pedido avance.
          </p>
        )}

        {trackingError && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-yellow-200">
              No se pudo cargar el seguimiento en tiempo real. Mostramos el historial del pedido.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchTracking()}>
              Reintentar
            </Button>
          </div>
        )}

        <div className="border-t border-neutral-800 pt-6 mb-8">
          <h4 className="text-base font-semibold text-white mb-4">Historial de estados</h4>
          {uniqueStatusHistory.length === 0 ? (
            <p className="text-sm text-neutral-500">Aún no hay cambios de estado registrados.</p>
          ) : (
            <div className="space-y-4">
              {uniqueStatusHistory.map((item, index) => {
                const toLabel = STATUS_LABELS_ES[item.to_status] || toSafeText(item.to_status);
                const fromLabel = STATUS_LABELS_ES[item.from_status] || toSafeText(item.from_status);
                return (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative mt-1">
                      <span className="block h-2.5 w-2.5 rounded-full bg-cmyk-cyan" />
                      {index < uniqueStatusHistory.length - 1 && (
                        <span className="absolute left-1.5 top-3 block h-8 w-px -translate-x-1/2 bg-neutral-700" />
                      )}
                    </div>
                    <div className="pb-2">
                      <p className="text-sm text-white font-medium">
                        {fromLabel ? `${fromLabel} → ${toLabel}` : toLabel}
                      </p>
                      <p className="text-xs text-neutral-500">{formatDate(item.created_at)}</p>
                      {item.notes && (
                        <p className="text-xs text-neutral-400 mt-1">{item.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-800 pt-6">
          <h4 className="text-base font-semibold text-white mb-4">Guía del paquete</h4>
          {trackingNumber ? (
            <>
              <p className="text-neutral-400 text-sm mb-1">Número de guía</p>
              <p className="text-white font-mono text-lg">{trackingNumber}</p>
            </>
          ) : (
            <p className="text-sm text-neutral-400">
              {resolvedDeliveryMethod === 'shipping'
                ? 'El número de guía aparecerá aquí cuando el pedido sea despachado.'
                : 'Este pedido no requiere guía de envío.'}
            </p>
          )}
          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3"
            >
              <Button variant="outline" size="sm">
                Rastrear envío en transportista
              </Button>
            </a>
          )}
          {packageGuideEvents.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-neutral-400">Movimientos de la guía</p>
              {packageGuideEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                  <p className="text-sm font-medium text-white">{event.title}</p>
                  {event.occurred_at && (
                    <p className="text-xs text-neutral-500 mt-1">{formatDate(event.occurred_at)}</p>
                  )}
                  {event.description && (
                    <p className="text-xs text-neutral-400 mt-2 whitespace-pre-line">{event.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Productos</h3>
            
            {/* DEBUG: Show if quote is loaded */}
            {order.quote && !sourceQuote && (
              <div className="mb-4 p-2 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
                Cargando información de la solicitud original...
              </div>
            )}
            
            {/* DEBUG: If quote exists but quote_request doesn't */}
            {sourceQuote && !sourceQuote.quote_request && (
              <div className="mb-4 p-2 bg-yellow-900/30 border border-yellow-700 rounded text-xs text-yellow-300">
                ⚠️ Cotización sin información de solicitud original
              </div>
            )}

            <div className="divide-y divide-neutral-800">
              {orderLines.map((line) => (
                <div key={line.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                    <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
                      {toSafeText(line.sku)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{toSafeText(line.name)}</p>
                    {(() => {
                      const variantName = toSafeText(line.variant_name).trim();
                      if (!variantName) return null;
                      const friendlyVariant = variantName.toLowerCase() === 'default' ? 'Base' : variantName;
                      return <p className="text-xs text-neutral-500 mt-1">Variante: {friendlyVariant}</p>;
                    })()}
                    {(() => {
                      const metadata = line.metadata && typeof line.metadata === 'object' && !Array.isArray(line.metadata)
                        ? (line.metadata as Record<string, unknown>)
                        : null;
                      const quoteLineId = toSafeText(metadata?.quote_line_id);
                      const quoteLine = quoteLineId ? quoteLinesById.get(quoteLineId) : undefined;
                      const fullDescription =
                        toSafeText(metadata?.quote_line_description) ||
                        toSafeText(quoteLine?.description) ||
                        toSafeText(metadata?.description);

                      const metadataServiceDetails = parseJsonIfString(metadata?.service_details);
                      const quoteLineServiceDetails = parseJsonIfString(quoteLine?.service_details);
                      const metadataQuoteRequestDetails = parseJsonIfString(metadata?.quote_request_service_details);
                      const sourceRequestDetails = parseJsonIfString(sourceQuote?.quote_request?.service_details);
                      const sourceRequestServices = Array.isArray(sourceQuote?.quote_request?.services)
                        ? sourceQuote?.quote_request?.services
                        : [];

                      const inferredServiceType = toSafeText(
                        (metadataServiceDetails as Record<string, unknown> | undefined)?.service_type ||
                        (quoteLineServiceDetails as Record<string, unknown> | undefined)?.service_type ||
                        metadata?.quote_request_service_type
                      );

                      const matchedRequestService = inferredServiceType
                        ? sourceRequestServices.find((service) => service.service_type === inferredServiceType)
                        : (sourceRequestServices.length === 1 ? sourceRequestServices[0] : undefined);

                      const matchedRequestServiceDetails = parseJsonIfString(matchedRequestService?.service_details);
                      const metadataForFallback = metadata
                        ? Object.fromEntries(
                            Object.entries(metadata).filter(([key]) => ![
                              'quote_line_id',
                              'quote_line_description',
                              'quote_line_description_en',
                              'delivery_method',
                              'delivery_address',
                              'pickup_branch_id',
                              'unit',
                              'original_quantity',
                              'description',
                              'quote_request_service_type',
                              'quote_request_service_details',
                              'quote_request_description',
                              'quote_request_quantity',
                              'quote_request_dimensions',
                              'quote_request_material',
                              'quote_request_includes_installation',
                            ].includes(key))
                          )
                        : undefined;

                      const technicalSource =
                        (metadataServiceDetails && typeof metadataServiceDetails === 'object' ? metadataServiceDetails : undefined) ||
                        (quoteLineServiceDetails && typeof quoteLineServiceDetails === 'object' ? quoteLineServiceDetails : undefined) ||
                        (metadataQuoteRequestDetails && typeof metadataQuoteRequestDetails === 'object' ? metadataQuoteRequestDetails : undefined) ||
                        (matchedRequestServiceDetails && typeof matchedRequestServiceDetails === 'object' ? matchedRequestServiceDetails : undefined) ||
                        (sourceRequestDetails && typeof sourceRequestDetails === 'object' ? sourceRequestDetails : undefined) ||
                        metadataForFallback;

                      const requestLevelDescription =
                        toSafeText(matchedRequestService?.description) ||
                        toSafeText(sourceQuote?.quote_request?.description);
                      const customerComment = requestLevelDescription || fallbackRequestDescription || toSafeText(fullDescription);

                      const technicalItems = flattenTechnicalDetails(technicalSource)
                        .filter((item) => {
                          const label = item.label || '';
                          return (
                            label !== 'service_type' &&
                            label !== 'service_details' &&
                            label !== 'variant_id' &&
                            label !== 'catalog_item_id' &&
                            !label.endsWith(' · service_type') &&
                            !label.endsWith(' · service_details') &&
                            !label.endsWith(' · variant_id') &&
                            !label.endsWith(' · catalog_item_id')
                          );
                        })
                        .slice(0, 20);

                      const hasServiceDetails = inferredServiceType && technicalSource && typeof technicalSource === 'object';

                      const rawLineAttachments = [
                        ...(Array.isArray(matchedRequestService?.attachments) ? matchedRequestService.attachments : []),
                        ...(Array.isArray(sourceQuote?.quote_request?.attachments) ? sourceQuote.quote_request.attachments : []),
                        ...fallbackAttachments,
                      ].filter((attachment) => attachment && typeof attachment === 'object') as Array<Record<string, unknown>>;

                      const uniqueLineAttachments = rawLineAttachments.filter((attachment, index, self) => {
                        const currentKey = toSafeText(attachment.id) || toSafeText(attachment.file_url) || toSafeText(attachment.file);
                        return self.findIndex((item) => {
                          const itemKey = toSafeText(item.id) || toSafeText(item.file_url) || toSafeText(item.file);
                          return itemKey === currentKey;
                        }) === index;
                      });

                      const lineDeliveryMethod =
                        toSafeText(quoteLine?.delivery_method) ||
                        toSafeText(metadata?.delivery_method) ||
                        toSafeText(matchedRequestService?.delivery_method) ||
                        toSafeText(sourceQuote?.quote_request?.delivery_method) ||
                        toSafeText(order.delivery_method);

                      const lineDeliveryMethodLabel =
                        DELIVERY_METHOD_LABELS[lineDeliveryMethod as DeliveryMethod]?.es || lineDeliveryMethod;

                      const lineDeliveryAddress =
                        formatAddress(quoteLine?.delivery_address) ||
                        formatAddress(metadata?.delivery_address) ||
                        formatAddress(matchedRequestService?.delivery_address) ||
                        formatAddress(sourceQuote?.quote_request?.delivery_address);

                      const resolvedRequiredDate =
                        toSafeText(matchedRequestService?.required_date) ||
                        toSafeText(sourceQuote?.quote_request?.required_date) ||
                        fallbackRequiredDate;
                      
                      // Find matching quote line for additional details like estimated_delivery_date
                      const matchingQuoteLine = sourceQuote?.lines?.find(
                        (ql) => ql.concept === line.name || ql.description === line.variant_name
                      );

                      return (
                        <>
                          {hasServiceDetails && inferredServiceType && (
                            <div className="mt-2 rounded-md bg-neutral-900/60 border border-neutral-800 p-3">
                              <p className="text-sm font-medium text-neutral-300 mb-3">Parámetros del servicio</p>
                              <ServiceDetailsDisplay
                                serviceType={inferredServiceType}
                                serviceDetails={technicalSource as Record<string, unknown>}
                              />

                              {customerComment && (
                                <p className="mt-3 text-sm text-neutral-300">
                                  <span className="text-neutral-400">Comentarios del cliente:</span>{' '}
                                  {customerComment}
                                </p>
                              )}

                              {uniqueLineAttachments.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-neutral-800">
                                  <p className="text-xs text-neutral-500 mb-1">Archivos adjuntos</p>
                                  <button
                                    type="button"
                                    onClick={() => openAttachmentsModal(uniqueLineAttachments)}
                                    className="inline-flex items-center gap-2 text-sm text-cmyk-cyan hover:text-cmyk-cyan/80"
                                  >
                                    <PaperClipIcon className="h-4 w-4" />
                                    Ver archivos
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {!hasServiceDetails && technicalItems.length > 0 && (
                            <div className="mt-2 rounded-md bg-neutral-900/60 border border-neutral-800 p-2">
                              <p className="text-[11px] font-medium text-neutral-300 mb-1">Detalles técnicos</p>
                              <ul className="space-y-1">
                                {technicalItems.map((item, index) => (
                                  <li key={`${line.id}-tech-${index}`} className="text-[11px] text-neutral-400">
                                    <span className="text-neutral-500">{item.label}:</span> {item.value}
                                  </li>
                                ))}
                              </ul>

                              {customerComment && (
                                <p className="mt-2 text-xs text-neutral-300">
                                  <span className="text-neutral-500">Comentarios del cliente:</span>{' '}
                                  {customerComment}
                                </p>
                              )}

                              {uniqueLineAttachments.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-neutral-800/80">
                                  <p className="text-[11px] text-neutral-500 mb-1">Archivos adjuntos</p>
                                  <button
                                    type="button"
                                    onClick={() => openAttachmentsModal(uniqueLineAttachments)}
                                    className="inline-flex items-center gap-2 text-xs text-cmyk-cyan hover:text-cmyk-cyan/80"
                                  >
                                    <PaperClipIcon className="h-3.5 w-3.5" />
                                    Ver archivos
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="mt-2 space-y-1 text-sm text-neutral-400">
                            {(matchingQuoteLine?.estimated_delivery_date || order.scheduled_date || resolvedRequiredDate) && (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span className="inline-flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4 text-cmyk-cyan" />
                                  <span>
                                    Entrega estimada:{' '}
                                    <span className="text-white font-medium">
                                      {matchingQuoteLine?.estimated_delivery_date
                                        ? new Date(matchingQuoteLine.estimated_delivery_date + 'T12:00:00').toLocaleDateString('es-MX', {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                          })
                                        : order.scheduled_date ? formatDate(order.scheduled_date) : 'No especificada'}
                                    </span>
                                  </span>
                                </span>

                                {resolvedRequiredDate && (
                                  <span>
                                    Fecha requerida:{' '}
                                    <span className="text-white font-medium">
                                      {new Date(`${resolvedRequiredDate}T12:00:00`).toLocaleDateString('es-MX', {
                                        year: 'numeric', month: 'short', day: 'numeric'
                                      })}
                                    </span>
                                  </span>
                                )}
                              </div>
                            )}

                            {lineDeliveryMethodLabel && (
                              <p>
                                Método de entrega:{' '}
                                <span className="text-white font-medium">{lineDeliveryMethodLabel}</span>
                              </p>
                            )}

                            {lineDeliveryAddress && (
                              <p>
                                Dirección de entrega:{' '}
                                <span className="text-white">{lineDeliveryAddress}</span>
                              </p>
                            )}
                          </div>
                        </>
                      );
                    })()}
                    <p className="text-sm text-neutral-400">SKU: {toSafeText(line.sku)}</p>
                  </div>
                  <div className="text-right min-w-[140px]">
                    <p className="text-sm text-neutral-400">{formatPrice(line.unit_price)} × {line.quantity}</p>
                    <p className="text-cyan-400 font-semibold text-lg leading-tight">{formatPrice(line.line_total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Resumen</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Envío</span>
                <span>{formatPrice(resolvedShippingCost.toFixed(2))}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>IVA ({(Number(order.tax_rate) * 100).toFixed(0)}%)</span>
                <span>{formatPrice(order.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-neutral-800">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>

            {shouldShowSelectedPaymentMethod && (
              <div className="mt-4 pt-4 border-t border-neutral-800">
                <p className="text-sm text-neutral-400">Método de pago</p>
                <p className="text-white">{paymentMethodLabel}</p>
              </div>
            )}
          </Card>

          {canPay && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Realizar pago</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  {PAYMENT_OPTIONS.map(({ key, label, Icon, hint, badge }) => {
                    const isSelected = selectedPaymentMethod === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(key)}
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                          isSelected
                            ? 'border-cmyk-cyan bg-cmyk-cyan/10'
                            : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-neutral-800 text-neutral-200">
                              <Icon className="h-5 w-5" />
                            </span>
                            <div>
                              <p className="text-white text-sm font-medium">{label}</p>
                              <p className="text-xs text-neutral-400">{hint}</p>
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-neutral-300 bg-neutral-800 px-2 py-1 rounded">
                            {badge}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedPaymentMethod === 'bank_transfer' && (
                  <div className="rounded-lg border border-neutral-700 bg-neutral-900/60 p-3 space-y-3">
                    <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 text-xs text-neutral-300 space-y-1">
                      <p><span className="text-neutral-500">Beneficiario:</span> MCD Agencia Publicitaria SA de CV</p>
                      <p><span className="text-neutral-500">Banco:</span> BBVA México</p>
                      <p><span className="text-neutral-500">Cuenta:</span> 012345678901234567</p>
                      <p><span className="text-neutral-500">CLABE:</span> 012345678901234567</p>
                    </div>

                    <div>
                      <p className="text-sm text-neutral-300 font-medium">Referencia:</p>
                      <input
                        type="text"
                        value={transferReference}
                        onChange={(e) => setTransferReference(e.target.value)}
                        placeholder="Ejemplo: SPEI-58294011 (opcional si subes imagen)"
                        className="mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:border-cmyk-cyan focus:outline-none"
                      />
                    </div>

                    <div>
                      <p className="text-sm text-neutral-300 font-medium">Comprobante de transferencia (imagen)</p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          setTransferFiles(files);
                        }}
                        className="mt-1 w-full text-sm text-neutral-300 file:mr-3 file:rounded file:border-0 file:bg-neutral-700 file:px-3 file:py-2 file:text-white hover:file:bg-neutral-600"
                      />
                      {transferFiles.length > 0 && (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {transferFiles.slice(0, 3).map((file, index) => (
                            <div key={`${file.name}-${index}`} className="rounded border border-neutral-700 p-2 text-[11px] text-neutral-400 truncate">
                              {file.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-neutral-400 space-y-1">
                      <p>Instrucciones:</p>
                      <p>1) Realiza la transferencia desde tu banco.</p>
                      <p>2) Captura el número de referencia exacto o sube imagen del comprobante.</p>
                      <p>3) Debes proporcionar al menos uno: referencia o imagen de la transferencia.</p>
                      <p>4) Nuestro equipo confirmará tu pago y empezaremos con la producción de tus productos.</p>
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === 'cash' && (
                  <div className="rounded-lg border border-neutral-700 bg-neutral-900/60 p-3 space-y-3">
                    <p className="text-sm text-neutral-300">
                      Debes acercarte a cualquiera de nuestras sucursales para realizar el pago en efectivo.
                      En sucursal te apoyarán con la validación de tu pedido.
                    </p>

                    <div className="space-y-2">
                      {cashBranches.length > 0 ? cashBranches.map((branch) => (
                        <div key={branch.id} className="rounded border border-neutral-800 p-2">
                          <p className="text-sm text-white font-medium">{branch.name}</p>
                          <p className="text-xs text-neutral-400">{branch.full_address || `${branch.city || ''}, ${branch.state || ''}`}</p>
                          <p className="text-xs text-neutral-500">{branch.phone} · {branch.hours}</p>
                        </div>
                      )) : (
                        <p className="text-xs text-neutral-400">Cargando sucursales disponibles...</p>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handlePayment}
                  isLoading={isPaying}
                  className="w-full"
                >
                  {selectedPaymentMethod === 'mercadopago' || selectedPaymentMethod === 'paypal'
                    ? 'Continuar al pago'
                    : 'Solicitar confirmación de pago'}
                </Button>
              </div>
            </Card>
          )}

          {/* Delivery Method */}
          {resolvedDeliveryMethod && (
            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">Método de Entrega</h3>
              <p className="text-white flex items-center gap-2">
                <span>{DELIVERY_METHOD_ICONS[resolvedDeliveryMethod as DeliveryMethod]}</span>
                {DELIVERY_METHOD_LABELS[resolvedDeliveryMethod as DeliveryMethod]?.es || resolvedDeliveryMethod}
              </p>
              {order.pickup_branch_detail && (
                <div className="mt-3">
                  <p className="text-sm text-neutral-400">Sucursal de recolección</p>
                  <p className="text-white">{order.pickup_branch_detail.name} — {order.pickup_branch_detail.city}, {order.pickup_branch_detail.state}</p>
                </div>
              )}
              {((order.delivery_address && Object.keys(order.delivery_address).length > 0) || shippingAddressText) && (
                <div className="mt-3">
                  <p className="text-sm text-neutral-400">
                    {resolvedDeliveryMethod === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}
                  </p>
                  <p className="text-white text-sm">
                    {[order.delivery_address?.street || order.delivery_address?.calle, order.delivery_address?.exterior_number || order.delivery_address?.numero_exterior, order.delivery_address?.neighborhood || order.delivery_address?.colonia, order.delivery_address?.city || order.delivery_address?.ciudad, order.delivery_address?.state || order.delivery_address?.estado, order.delivery_address?.postal_code || order.delivery_address?.codigo_postal].filter(Boolean).join(', ') || shippingAddressText}
                  </p>
                </div>
              )}
              {order.scheduled_date && (
                <div className="mt-3">
                  <p className="text-sm text-neutral-400">Fecha programada</p>
                  <p className="text-white">{formatDate(order.scheduled_date)}</p>
                </div>
              )}
            </Card>
          )}

        </div>
      </div>

      {isAttachmentsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <h4 className="text-white font-semibold">Archivos adjuntos</h4>
              <button
                type="button"
                onClick={() => setIsAttachmentsModalOpen(false)}
                className="text-sm text-neutral-300 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(85vh-64px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeAttachments.map((attachment, index) => {
                  const fileUrl = toSafeText(attachment.file_url) || toSafeText(attachment.file);
                  const fileName = toSafeText(attachment.file_name) || toSafeText(attachment.filename) || `Archivo ${index + 1}`;

                  if (!fileUrl) {
                    return (
                      <div key={`${fileName}-${index}`} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                        <p className="text-sm text-neutral-300">{fileName}</p>
                      </div>
                    );
                  }

                  return (
                    <div key={`${fileUrl}-${index}`} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 space-y-2">
                      {isImageFile(attachment) ? (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                          <div className="relative w-full h-48 rounded-md overflow-hidden border border-neutral-800">
                            <Image
                              src={fileUrl}
                              alt={fileName}
                              fill
                              sizes="(max-width: 768px) 100vw, 50vw"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </a>
                      ) : (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-cmyk-cyan hover:text-cmyk-cyan/80"
                        >
                          Abrir archivo
                        </a>
                      )}
                      <p className="text-xs text-neutral-400 break-all">{fileName}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
