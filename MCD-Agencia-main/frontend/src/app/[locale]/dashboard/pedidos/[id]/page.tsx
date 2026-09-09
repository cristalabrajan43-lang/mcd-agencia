'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  CalendarIcon,
  MapPinIcon,
  XCircleIcon,
  ClockIcon,
  TruckIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, Button, LoadingPage, Input, Textarea } from '@/components/ui';
import { OrderProductionJobsSection } from '@/components/orders/OrderProductionJobsSection';
import { OrderTrackingTimelineView } from '@/components/orders/OrderTrackingTimeline';
import { ServiceDetailsDisplay } from '@/components/quotes/ServiceDetailsDisplay';
import { getOrderOperationalTracks, updateOrderTracking, type OrderOperationalTracks } from '@/lib/api/admin';
import {
  getStaffOrderById,
  updateOrderLineEstimatedDelivery,
  updateOrderStatus,
  Order,
} from '@/lib/api/orders';
import { getOrderTracking, type OrderTrackingTimeline } from '@/lib/api/tracking';
import { DELIVERY_METHOD_LABELS, DELIVERY_METHOD_ICONS, type DeliveryMethod } from '@/lib/service-ids';
import { getWorkflowStatus, requiresManualPayment, getPaymentMethodLabel, isOnlinePayment } from '@/lib/workflow';

const statusColors: Record<string, string> = {
  draft: 'bg-neutral-500/20 text-neutral-400 border-neutral-500',
  pending_payment: 'bg-cmyk-yellow/20 text-cmyk-yellow border-cmyk-yellow',
  paid: 'bg-green-500/20 text-green-400 border-green-500',
  partially_paid: 'bg-orange-500/20 text-orange-400 border-orange-500',
  in_production: 'bg-purple-500/20 text-purple-400 border-purple-500',
  ready: 'bg-cmyk-cyan/20 text-cmyk-cyan border-cmyk-cyan',
  in_delivery: 'bg-indigo-500/20 text-indigo-400 border-indigo-500',
  completed: 'bg-green-600/20 text-green-400 border-green-600',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500',
  refunded: 'bg-red-600/20 text-red-300 border-red-600',
};

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  pending_payment: 'Pendiente de Pago',
  paid: 'Pagado',
  partially_paid: 'Pago Parcial',
  in_production: 'En Producción',
  ready: 'Listo',
  in_delivery: 'En Camino',
  completed: 'Completado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  draft: ClockIcon,
  pending_payment: CurrencyDollarIcon,
  paid: CheckCircleIcon,
  partially_paid: CurrencyDollarIcon,
  in_production: ArrowPathIcon,
  ready: CheckCircleIcon,
  in_delivery: TruckIcon,
  completed: CheckCircleIcon,
  cancelled: XCircleIcon,
  refunded: XCircleIcon,
};

// Which statuses can the staff move this order to?
const nextStatusOptions: Record<string, { value: string; label: string }[]> = {
  pending_payment: [
    { value: 'paid', label: 'Marcar como Pagado' },
    { value: 'partially_paid', label: 'Pago Parcial' },
    { value: 'cancelled', label: 'Cancelar Pedido' },
  ],
  paid: [
    { value: 'in_production', label: 'Enviar a Producción' },
  ],
  partially_paid: [
    { value: 'paid', label: 'Marcar como Pagado Total' },
    { value: 'in_production', label: 'Enviar a Producción' },
    { value: 'cancelled', label: 'Cancelar Pedido' },
  ],
  in_production: [
    { value: 'ready', label: 'Marcar como Listo' },
    { value: 'cancelled', label: 'Cancelar Pedido' },
  ],
  ready: [
    { value: 'in_delivery', label: 'Marcar En Camino' },
    { value: 'completed', label: 'Marcar Completado' },
  ],
  in_delivery: [
    { value: 'completed', label: 'Marcar Completado' },
  ],
  completed: [
    { value: 'refunded', label: 'Reembolsar' },
  ],
};

const getAvailableTransitions = (
  workflowStatus: string,
  paymentMethod?: string,
  canConfirmPayments = false,
) => {
  if (workflowStatus === 'pending_payment' && !requiresManualPayment(paymentMethod)) {
    return [];
  }
  const options = nextStatusOptions[workflowStatus] || [];
  if (canConfirmPayments) return options;
  return options.filter((option) => !['paid', 'partially_paid', 'refunded'].includes(option.value));
};

export default function StaffOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locale = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const permissions = usePermissions();

  const [order, setOrder] = useState<Order | null>(null);
  const [operationalTracks, setOperationalTracks] = useState<OrderOperationalTracks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [estimatedDateByLineId, setEstimatedDateByLineId] = useState<Record<string, string>>({});
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<OrderTrackingTimeline | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [trackingMessage, setTrackingMessage] = useState('');
  const [isSavingTracking, setIsSavingTracking] = useState(false);

  const orderId = params.id as string;
  const canManageOrders = permissions.canViewAllOrders;

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/pedidos/${orderId}`);
      } else if (!canManageOrders) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, canManageOrders, router, locale, orderId]);

  const fetchOperationalTracks = async () => {
    if (!orderId) return;
    setTracksLoading(true);
    try {
      const data = await getOrderOperationalTracks(orderId);
      setOperationalTracks(data);
      setTracksError(null);
    } catch (error) {
      console.error('Error fetching operational tracks:', error);
      setTracksError('No se pudieron cargar los trabajos de producción.');
    } finally {
      setTracksLoading(false);
    }
  };

  const fetchTracking = async () => {
    if (!orderId) return;
    try {
      const data = await getOrderTracking(orderId);
      setTracking(data);
    } catch (error) {
      console.error('Error fetching order tracking:', error);
    }
  };

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId || !isAuthenticated || !canManageOrders) return;

      setIsLoading(true);
      try {
        const data = await getStaffOrderById(orderId);
        setOrder(data);
        setTrackingNumber(data.tracking_number || '');
        setTrackingUrl(data.tracking_url || '');
        await Promise.all([fetchOperationalTracks(), fetchTracking()]);
      } catch (error) {
        console.error('Error fetching order:', error);
        toast.error('Error al cargar el pedido');
        router.push(`/${locale}/dashboard/pedidos`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, isAuthenticated, canManageOrders, router, locale]);

  useEffect(() => {
    if (!order?.lines) return;
    const next: Record<string, string> = {};
    for (const line of order.lines) {
      const meta = line.metadata && typeof line.metadata === 'object' && !Array.isArray(line.metadata)
        ? (line.metadata as Record<string, unknown>)
        : {};
      const rawDate =
        toSafeText(meta.estimated_delivery_date) ||
        toSafeText(meta.fecha_entrega_estimada) ||
        toSafeText(line.estimated_delivery_date) ||
        toSafeText(order.scheduled_date);
      next[line.id] = normalizeDateForInput(rawDate);
    }
    setEstimatedDateByLineId(next);
  }, [order]);

  const refreshOrder = async () => {
    const data = await getStaffOrderById(orderId);
    setOrder(data);
    setTrackingNumber(data.tracking_number || '');
    setTrackingUrl(data.tracking_url || '');
    await Promise.all([fetchOperationalTracks(), fetchTracking()]);
  };

  const handleSaveTracking = async () => {
    if (!order) return;
    const hasTrackingNumber = Boolean(trackingNumber.trim());
    const hasMessage = Boolean(trackingMessage.trim());
    if (!hasTrackingNumber && !hasMessage) {
      toast.error('Ingresa un número de guía o un mensaje para el cliente.');
      return;
    }

    setIsSavingTracking(true);
    try {
      const response = await updateOrderTracking(order.id, {
        tracking_number: trackingNumber.trim() || undefined,
        tracking_url: trackingUrl.trim() || undefined,
        message: trackingMessage.trim() || undefined,
      });
      setOrder(response.order);
      setTracking(response.tracking);
      setTrackingMessage('');
      toast.success('Seguimiento actualizado para el cliente');
    } catch (error) {
      console.error('Error updating tracking:', error);
      toast.error('No se pudo actualizar el seguimiento');
    } finally {
      setIsSavingTracking(false);
    }
  };

  const handleSaveEstimatedDate = async (lineId: string) => {
    if (!order) return;
    setSavingLineId(lineId);
    try {
      const value = estimatedDateByLineId[lineId] || null;
      await updateOrderLineEstimatedDelivery(order.id, lineId, value);
      await refreshOrder();
      toast.success('Fecha estimada actualizada');
    } catch (error) {
      console.error('Error updating estimated delivery date:', error);
      toast.error('No se pudo actualizar la fecha estimada');
    } finally {
      setSavingLineId(null);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;

    const statusLabel = statusLabels[newStatus] || newStatus;
    if (!confirm(`¿Cambiar estado a "${statusLabel}"?`)) return;

    setIsUpdating(true);
    try {
      const shouldUseOnlineTwoStep =
        newStatus === 'in_production' &&
        order.status === 'pending_payment' &&
        isOnlinePayment(order.payment_method);

      if (shouldUseOnlineTwoStep) {
        await updateOrderStatus(
          order.id,
          'paid',
          'UI: confirmar pago online antes de enviar a producción',
          undefined,
        );
        const movedToProduction = await updateOrderStatus(
          order.id,
          'in_production',
          'UI: enviar a producción tras confirmar pago online',
          undefined,
        );
        setOrder(movedToProduction);
        toast.success('Pedido enviado a producción (flujo online aplicado)');
        return;
      }

      const updated = await updateOrderStatus(
        order.id,
        newStatus,
        undefined,
        undefined,
      );
      setOrder(updated);
      toast.success(`Estado actualizado a "${statusLabel}"`);
    } catch (error: unknown) {
      const errMsg = error && typeof error === 'object' && 'message' in error
        ? (error as { message: string }).message
        : 'Error al actualizar el estado';

      console.error('Error updating status:', error);
      toast.error(errMsg);
    } finally {
      setIsUpdating(false);
    }
  };

  const toSafeText = (value: unknown, fallback = ''): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return fallback;
  };

  const formatCurrency = (amount: unknown) => {
    const numericValue = typeof amount === 'number' || typeof amount === 'string'
      ? Number(amount)
      : 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Number.isFinite(numericValue) ? numericValue : 0);
  };

  const formatDate = (dateString?: unknown) => {
    if (!dateString) return '-';
    const parsedDate = new Date(toSafeText(dateString));
    if (Number.isNaN(parsedDate.getTime())) return '-';
    return parsedDate.toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (dateString?: unknown) => {
    if (!dateString) return '-';
    const parsedDate = new Date(toSafeText(dateString));
    if (Number.isNaN(parsedDate.getTime())) return '-';
    return parsedDate.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLineMetadata = (line: Order['lines'][number]): Record<string, unknown> => {
    if (line.metadata && typeof line.metadata === 'object' && !Array.isArray(line.metadata)) {
      return line.metadata as Record<string, unknown>;
    }
    return {};
  };

  const formatAddressText = (address: unknown): string => {
    if (!address || typeof address !== 'object' || Array.isArray(address)) return '';
    const addr = address as Record<string, unknown>;
    return [
      toSafeText(addr.street) || toSafeText(addr.calle),
      toSafeText(addr.exterior_number) || toSafeText(addr.numero_exterior),
      toSafeText(addr.neighborhood) || toSafeText(addr.colonia),
      toSafeText(addr.city) || toSafeText(addr.ciudad),
      toSafeText(addr.state) || toSafeText(addr.estado),
      toSafeText(addr.postal_code) || toSafeText(addr.codigo_postal),
    ].filter(Boolean).join(', ');
  };

  const formatDateOnly = (dateString?: unknown) => {
    if (!dateString) return '-';
    const rawDate = toSafeText(dateString);
    const parsedDate = new Date(rawDate.includes('T') ? rawDate : `${rawDate}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return '-';
    return parsedDate.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const normalizeDateForInput = (value: unknown): string => {
    const raw = toSafeText(value).trim();
    if (!raw) return '';

    const candidate = raw.split('T')[0].split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      return candidate;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  };

  if (authLoading || isLoading) {
    return <LoadingPage message="Cargando pedido..." />;
  }

  if (!isAuthenticated || !canManageOrders || !order) {
    return null;
  }

  const workflowStatus = getWorkflowStatus(order.status, order.payment_method);
  const StatusIcon = statusIcons[workflowStatus] || ClockIcon;
  const availableTransitions = getAvailableTransitions(
    workflowStatus,
    order.payment_method,
    permissions.isAdmin,
  );
  const canManualConfirmPayment = workflowStatus === 'pending_payment' && requiresManualPayment(order.payment_method);
  const workflowSteps = [
    { key: 'created', label: 'Creación', active: true, date: order.created_at },
    { key: 'payment', label: canManualConfirmPayment ? 'Esperando confirmación' : 'Pagado', active: order.is_fully_paid || ['paid', 'partially_paid', 'in_production', 'ready', 'in_delivery', 'completed'].includes(workflowStatus), date: order.paid_at },
    { key: 'production', label: 'En producción', active: ['in_production', 'ready', 'in_delivery', 'completed'].includes(workflowStatus), date: order.status_history?.find((history) => history.to_status === 'in_production')?.created_at },
    { key: 'ready', label: 'Listo', active: ['ready', 'in_delivery', 'completed'].includes(workflowStatus), date: order.status_history?.find((history) => history.to_status === 'ready')?.created_at },
    { key: 'delivery', label: order.delivery_method === 'pickup' ? 'Listo para recoger' : 'Enviado', active: ['in_delivery', 'completed'].includes(workflowStatus), date: order.tracking_number ? order.completed_at || order.paid_at : undefined },
    { key: 'done', label: 'Entregado', active: workflowStatus === 'completed', date: order.completed_at },
  ];

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/${locale}/dashboard/pedidos`}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Pedido #{toSafeText(order.order_number, '-')}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusColors[workflowStatus] || 'bg-neutral-500/20 text-neutral-400 border-neutral-500'}`}>
                <StatusIcon className="h-4 w-4" />
                {statusLabels[workflowStatus] || toSafeText(order.status_display, workflowStatus)}
              </span>
            </div>
            <p className="text-neutral-400 mt-1">
              Creado el {formatDate(order.created_at)}
            </p>
          </div>
        </div>
        {permissions.canViewProductionPanel && (
          <Link
            href={`/${locale}/dashboard/produccion?order_id=${order.id}&order_number=${encodeURIComponent(toSafeText(order.order_number, order.id))}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-200 hover:bg-purple-500/20 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Ver en tablero de producción
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Conceptos del Pedido</h2>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-neutral-500 text-sm border-b border-neutral-700">
                    <th className="pb-3 pr-4">Producto</th>
                    <th className="pb-3 pr-4">SKU</th>
                    <th className="pb-3 pr-4 text-right">Cant.</th>
                    <th className="pb-3 pr-4 text-right">P. Unit.</th>
                    <th className="pb-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {order.lines?.map((line) => (
                    <tr key={line.id}>
                      <td className="py-3 pr-4">
                        <p className="text-white font-medium">{toSafeText(line.name, '-')}</p>
                        {line.variant_name && (
                          <p className="text-neutral-500 text-sm">{toSafeText(line.variant_name)}</p>
                        )}
                        {(() => {
                          const meta = getLineMetadata(line);
                          const deliveryMethod = toSafeText(meta.delivery_method || order.delivery_method);
                          const deliveryAddress = formatAddressText(meta.delivery_address);
                          const requiredDate = toSafeText(meta.required_date || meta.quote_request_required_date);
                          const estimatedDate = estimatedDateByLineId[line.id] ?? '';
                          const serviceType = toSafeText(meta.service_type || meta.quote_request_service_type);
                          const serviceDetails = (
                            meta.service_details && typeof meta.service_details === 'object' && !Array.isArray(meta.service_details)
                              ? (meta.service_details as Record<string, unknown>)
                              : meta.quote_request_service_details && typeof meta.quote_request_service_details === 'object' && !Array.isArray(meta.quote_request_service_details)
                                ? (meta.quote_request_service_details as Record<string, unknown>)
                                : null
                          );
                          const pickupBranchName = toSafeText(
                            (meta.pickup_branch_detail as Record<string, unknown> | undefined)?.name || order.pickup_branch_detail?.name
                          );

                          if (!deliveryMethod && !deliveryAddress && !requiredDate && !pickupBranchName) {
                            return null;
                          }

                          return (
                            <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 space-y-2">
                              {deliveryMethod && (
                                <p className="text-xs text-neutral-300 flex items-center gap-1">
                                  <TruckIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                                  {DELIVERY_METHOD_LABELS[deliveryMethod as DeliveryMethod]?.es || deliveryMethod}
                                </p>
                              )}
                              {pickupBranchName && (
                                <p className="text-xs text-neutral-300 flex items-center gap-1">
                                  <MapPinIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                                  Sucursal: {pickupBranchName}
                                </p>
                              )}
                              {deliveryAddress && (
                                <p className="text-xs text-neutral-300">
                                  {deliveryMethod === 'installation' ? 'Dirección de instalación:' : 'Dirección de entrega:'} {deliveryAddress}
                                </p>
                              )}
                              {requiredDate && (
                                <p className="text-xs text-neutral-300 flex items-center gap-1">
                                  <CalendarIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                                  Fecha requerida: {formatDateOnly(requiredDate)}
                                </p>
                              )}
                              {serviceType && serviceDetails && Object.keys(serviceDetails).length > 0 && (
                                <div className="pt-2 border-t border-neutral-800">
                                  <ServiceDetailsDisplay
                                    serviceType={serviceType}
                                    serviceDetails={serviceDetails}
                                  />
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-neutral-400">Fecha estimada:</label>
                                <input
                                  type="date"
                                  value={estimatedDate}
                                  onChange={(e) => setEstimatedDateByLineId((prev) => ({ ...prev, [line.id]: e.target.value }))}
                                  className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white [color-scheme:dark]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEstimatedDate(line.id)}
                                  disabled={savingLineId === line.id}
                                  className="px-2 py-1 text-xs rounded border border-cmyk-cyan/40 text-cmyk-cyan hover:bg-cmyk-cyan/10 disabled:opacity-50"
                                >
                                  {savingLineId === line.id ? 'Guardando...' : 'Guardar'}
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 pr-4 text-neutral-400 text-sm font-mono">{toSafeText(line.sku, '-')}</td>
                      <td className="py-3 pr-4 text-right text-white">{toSafeText(line.quantity, '-')}</td>
                      <td className="py-3 pr-4 text-right text-white">{formatCurrency(line.unit_price)}</td>
                      <td className="py-3 text-right text-white font-medium">{formatCurrency(line.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-2">
              {order.lines?.map((line) => (
                <div key={line.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{toSafeText(line.name, '-')}</p>
                      {line.variant_name && (
                        <p className="text-neutral-500 text-xs truncate">{toSafeText(line.variant_name)}</p>
                      )}
                    </div>
                    <p className="text-white font-medium text-sm">{formatCurrency(line.line_total)}</p>
                  </div>
                  {(() => {
                    const meta = getLineMetadata(line);
                    const deliveryMethod = toSafeText(meta.delivery_method || order.delivery_method);
                    const deliveryAddress = formatAddressText(meta.delivery_address);
                    const requiredDate = toSafeText(meta.required_date || meta.quote_request_required_date);
                    const estimatedDate = estimatedDateByLineId[line.id] ?? '';
                    const serviceType = toSafeText(meta.service_type || meta.quote_request_service_type);
                    const serviceDetails = (
                      meta.service_details && typeof meta.service_details === 'object' && !Array.isArray(meta.service_details)
                        ? (meta.service_details as Record<string, unknown>)
                        : meta.quote_request_service_details && typeof meta.quote_request_service_details === 'object' && !Array.isArray(meta.quote_request_service_details)
                          ? (meta.quote_request_service_details as Record<string, unknown>)
                          : null
                    );
                    const pickupBranchName = toSafeText(
                      (meta.pickup_branch_detail as Record<string, unknown> | undefined)?.name || order.pickup_branch_detail?.name
                    );

                    if (!deliveryMethod && !deliveryAddress && !requiredDate && !pickupBranchName) {
                      return null;
                    }

                    return (
                      <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-2 space-y-1.5">
                        {deliveryMethod && (
                          <p className="text-xs text-neutral-300 flex items-center gap-1">
                            <TruckIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                            {DELIVERY_METHOD_LABELS[deliveryMethod as DeliveryMethod]?.es || deliveryMethod}
                          </p>
                        )}
                        {pickupBranchName && (
                          <p className="text-xs text-neutral-300 flex items-center gap-1">
                            <MapPinIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                            Sucursal: {pickupBranchName}
                          </p>
                        )}
                        {deliveryAddress && (
                          <p className="text-xs text-neutral-300">
                            {deliveryMethod === 'installation' ? 'Dirección de instalación:' : 'Dirección de entrega:'} {deliveryAddress}
                          </p>
                        )}
                        {requiredDate && (
                          <p className="text-xs text-neutral-300 flex items-center gap-1">
                            <CalendarIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                            Fecha requerida: {formatDateOnly(requiredDate)}
                          </p>
                        )}
                        {serviceType && serviceDetails && Object.keys(serviceDetails).length > 0 && (
                          <div className="pt-2 border-t border-neutral-800">
                            <ServiceDetailsDisplay
                              serviceType={serviceType}
                              serviceDetails={serviceDetails}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="date"
                            value={estimatedDate}
                            onChange={(e) => setEstimatedDateByLineId((prev) => ({ ...prev, [line.id]: e.target.value }))}
                            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white [color-scheme:dark]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEstimatedDate(line.id)}
                            disabled={savingLineId === line.id}
                            className="px-2 py-1 text-xs rounded border border-cmyk-cyan/40 text-cmyk-cyan hover:bg-cmyk-cyan/10 disabled:opacity-50"
                          >
                            {savingLineId === line.id ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-neutral-500">SKU</p>
                      <p className="text-neutral-300 font-mono truncate">{toSafeText(line.sku, '-')}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Cantidad</p>
                      <p className="text-white">{toSafeText(line.quantity, '-')}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">P. Unit.</p>
                      <p className="text-white">{formatCurrency(line.unit_price)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Total</p>
                      <p className="text-white font-medium">{formatCurrency(line.line_total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t border-neutral-700 space-y-2">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>IVA ({Number(order.tax_rate) * 100}%)</span>
                <span>{formatCurrency(order.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-neutral-700">
                <span>Total</span>
                <span className="text-cmyk-cyan">{formatCurrency(order.total)}</span>
              </div>
              {!order.is_fully_paid && (
                <>
                  <div className="flex justify-between text-green-400 pt-2">
                    <span>Pagado</span>
                    <span>{formatCurrency(order.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between text-cmyk-yellow font-medium">
                    <span>Saldo pendiente</span>
                    <span>{formatCurrency(order.balance_due)}</span>
                  </div>
                </>
              )}
            </div>
          </Card>

          <OrderProductionJobsSection
            tracks={operationalTracks}
            loading={tracksLoading}
            error={tracksError}
            locale={locale}
            orderId={order.id}
            orderNumber={toSafeText(order.order_number, order.id)}
            orderOrigin={operationalTracks?.origin || (order as Order & { origin?: string }).origin}
            canViewProductionPanel={permissions.canViewProductionPanel}
            onRetry={fetchOperationalTracks}
          />

          {/* Workflow */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className="text-lg font-semibold text-white">Flujo operativo</h2>
              <span className="text-xs text-neutral-400">{canManualConfirmPayment ? 'Validación manual requerida' : 'Pago confirmado automáticamente'}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {workflowSteps.map((step) => (
                <div
                  key={step.key}
                  className={`rounded-xl border p-3 ${step.active ? 'border-cmyk-cyan/30 bg-cmyk-cyan/10' : 'border-neutral-800 bg-neutral-900/60'}`}
                >
                  <p className={`text-sm font-medium ${step.active ? 'text-white' : 'text-neutral-400'}`}>{step.label}</p>
                  <p className="text-xs text-neutral-500 mt-1">{step.date ? formatDateTime(step.date) : '—'}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-neutral-400">
              <span className="text-white font-medium">Método de pago:</span> {getPaymentMethodLabel(toSafeText(order.payment_method))}
            </div>
          </Card>

          {/* Status History */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Historial de Estados</h2>
            {order.status_history && order.status_history.length > 0 ? (
              <div className="space-y-4">
                {order.status_history.map((history, index) => (
                  <div key={history.id} className="flex gap-4">
                    <div className="relative">
                      <div
                        className={`w-3 h-3 rounded-full mt-1 ${
                          index === 0 ? 'bg-cmyk-cyan' : 'bg-neutral-700'
                        }`}
                      />
                      {index < order.status_history.length - 1 && (
                        <div className="absolute top-4 left-1.5 w-px h-full -translate-x-1/2 bg-neutral-700" />
                      )}
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[history.to_status] || 'bg-neutral-500/20 text-neutral-400'}`}>
                          {statusLabels[history.to_status] || toSafeText(history.to_status, '-')}
                        </span>
                        {history.from_status && (
                          <span className="text-neutral-600 text-xs">
                            ← {statusLabels[history.from_status] || toSafeText(history.from_status, '-')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-400 mt-1">
                        {formatDateTime(history.created_at)}
                        {history.changed_by_name && ` • ${history.changed_by_name}`}
                      </p>
                      {history.notes && (
                        <p className="text-sm text-neutral-500 mt-1 italic">&ldquo;{toSafeText(history.notes)}&rdquo;</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-neutral-500">No hay historial de estados aún.</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Actions */}
          {availableTransitions.length > 0 && (
            <Card className="p-6 border-cmyk-cyan/30">
              <h2 className="text-lg font-semibold text-white mb-4">Cambiar Estado</h2>
              <div className="space-y-3">
                <div className="space-y-2">
                  {availableTransitions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                      disabled={isUpdating}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                        option.value === 'cancelled' || option.value === 'refunded'
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                          : 'bg-cmyk-cyan/10 text-cmyk-cyan hover:bg-cmyk-cyan/20 border border-cmyk-cyan/30'
                      }`}
                    >
                      {isUpdating ? 'Actualizando...' : option.label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Payment Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Pago</h2>
            <div className="space-y-3">
              <div>
                <p className="text-neutral-500 text-sm">Método de pago</p>
                <p className="text-white capitalize">{toSafeText(order.payment_method, 'No especificado')}</p>
              </div>
              <div>
                <p className="text-neutral-500 text-sm">Estado de pago</p>
                <p className={`font-medium ${order.is_fully_paid ? 'text-green-400' : canManualConfirmPayment ? 'text-cmyk-yellow' : 'text-green-400'}`}>
                  {order.is_fully_paid ? 'Pagado completamente' : canManualConfirmPayment ? 'Pendiente de validación' : 'Confirmado'}
                </p>
              </div>
              {order.paid_at && (
                <div>
                  <p className="text-neutral-500 text-sm">Fecha de pago</p>
                  <p className="text-white">{formatDate(order.paid_at)}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Tracking management */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Seguimiento para el cliente</h2>
            <div className="space-y-4">
              <Input
                label="Número de guía"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="Ej. 1234567890"
              />
              <Input
                label="URL de rastreo (opcional)"
                value={trackingUrl}
                onChange={(event) => setTrackingUrl(event.target.value)}
                placeholder="https://..."
              />
              <Textarea
                label="Mensaje visible para el cliente"
                value={trackingMessage}
                onChange={(event) => setTrackingMessage(event.target.value)}
                placeholder="Ej. Tu paquete salió del almacén y llegará en 2-3 días hábiles."
                rows={3}
              />
              <Button
                onClick={handleSaveTracking}
                disabled={isSavingTracking}
                className="w-full"
              >
                {isSavingTracking ? 'Guardando...' : 'Publicar actualización'}
              </Button>
            </div>
            {tracking && (
              <div className="mt-6 border-t border-neutral-800 pt-6">
                <p className="text-sm text-neutral-400 mb-4">Vista previa del cliente</p>
                <OrderTrackingTimelineView tracking={tracking} />
              </div>
            )}
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card className="p-6 border-yellow-500/30">
              <h2 className="text-lg font-semibold text-yellow-400 mb-4">Notas</h2>
              <p className="text-neutral-300 whitespace-pre-wrap">{toSafeText(order.notes)}</p>
            </Card>
          )}

          {/* Timestamps */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Fechas</h2>
            <div className="space-y-3">
              <div>
                <p className="text-neutral-500 text-sm">Creado</p>
                <p className="text-white">{formatDateTime(order.created_at)}</p>
              </div>
              {order.paid_at && (
                <div>
                  <p className="text-neutral-500 text-sm">Pagado</p>
                  <p className="text-green-400">{formatDateTime(order.paid_at)}</p>
                </div>
              )}
              {order.completed_at && (
                <div>
                  <p className="text-neutral-500 text-sm">Completado</p>
                  <p className="text-green-400">{formatDateTime(order.completed_at)}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
