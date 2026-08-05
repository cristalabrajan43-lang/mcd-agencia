'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  ArrowPathIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { Card, LoadingPage } from '@/components/ui';
import { getStaffOrders, updateOrderStatus, OrderListItem } from '@/lib/api/orders';
import { PaginatedResponse } from '@/lib/api/catalog';
import { getWorkflowStatus, requiresManualPayment, isOnlinePayment } from '@/lib/workflow';

// Status config matching backend Order.STATUS_CHOICES
const statusColors: Record<string, string> = {
  draft: 'bg-neutral-500/20 text-neutral-400',
  pending_payment: 'bg-cmyk-yellow/20 text-cmyk-yellow',
  paid: 'bg-green-500/20 text-green-400',
  partially_paid: 'bg-orange-500/20 text-orange-400',
  in_production: 'bg-purple-500/20 text-purple-400',
  ready: 'bg-cmyk-cyan/20 text-cmyk-cyan',
  in_delivery: 'bg-indigo-500/20 text-indigo-400',
  completed: 'bg-green-600/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
  refunded: 'bg-red-600/20 text-red-300',
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

// Which statuses can the staff move this order to?
const nextStatusOptions: Record<string, { value: string; label: string }[]> = {
  pending_payment: [
    { value: 'paid', label: 'Marcar como Pagado' },
    { value: 'partially_paid', label: 'Pago Parcial' },
    { value: 'cancelled', label: 'Cancelar' },
  ],
  paid: [
    { value: 'in_production', label: 'Enviar a Producción' },
  ],
  partially_paid: [
    { value: 'paid', label: 'Marcar como Pagado Total' },
    { value: 'in_production', label: 'Enviar a Producción' },
    { value: 'cancelled', label: 'Cancelar' },
  ],
  in_production: [
    { value: 'ready', label: 'Marcar como Listo' },
    { value: 'cancelled', label: 'Cancelar' },
  ],
  ready: [
    { value: 'in_delivery', label: 'En Camino' },
    { value: 'completed', label: 'Completado' },
  ],
  in_delivery: [
    { value: 'completed', label: 'Completado' },
  ],
  completed: [
    { value: 'refunded', label: 'Reembolsar' },
  ],
};

const getAvailableTransitions = (status: string, paymentMethod?: string) => {
  if (status === 'pending_payment' && !requiresManualPayment(paymentMethod)) {
    return [];
  }
  return nextStatusOptions[status] || [];
};

export default function SalesOrdersPage() {
  const router = useRouter();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const isSalesOrAdmin = user?.role?.name && ['admin', 'sales'].includes(user.role.name);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/pedidos`);
      } else if (!isSalesOrAdmin) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, isSalesOrAdmin, router, locale]);

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated || !isSalesOrAdmin) return;
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page };
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const data: PaginatedResponse<OrderListItem> = await getStaffOrders(params);
      setOrders(data.results || []);
      setTotalPages(data.total_pages || Math.ceil((data.count || 0) / 10));
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isSalesOrAdmin, page, statusFilter, searchTerm]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleStatusChange = async (
    orderId: string,
    newStatus: string,
    currentStatus?: string,
    paymentMethod?: string,
  ) => {
    setUpdatingOrderId(orderId);
    try {
      const shouldUseOnlineTwoStep =
        newStatus === 'in_production' &&
        currentStatus === 'pending_payment' &&
        isOnlinePayment(paymentMethod);

      if (shouldUseOnlineTwoStep) {
        await updateOrderStatus(orderId, 'paid', 'UI: confirmar pago online antes de enviar a producción');
        await updateOrderStatus(orderId, 'in_production', 'UI: enviar a producción tras confirmar pago online');
        await fetchOrders();
        return;
      }

      await updateOrderStatus(orderId, newStatus);
      await fetchOrders();
    } catch (error: unknown) {
      const errMsg = error && typeof error === 'object' && 'message' in error
        ? (error as { message: string }).message
        : 'Error al actualizar el estado del pedido';

      console.error('Error updating order status:', error);
      alert(errMsg);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (authLoading) {
    return <LoadingPage message="Cargando..." />;
  }

  if (!isAuthenticated || !isSalesOrAdmin) {
    return null;
  }

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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Stats from current page data
  const pendingPayment = orders.filter(o => o.status === 'pending_payment' && requiresManualPayment(o.payment_method)).length;
  const inProduction = orders.filter(o => getWorkflowStatus(o.status, o.payment_method) === 'in_production').length;
  const readyOrders = orders.filter(o => ['ready', 'in_delivery'].includes(getWorkflowStatus(o.status, o.payment_method))).length;
  const completedOrders = orders.filter(o => getWorkflowStatus(o.status, o.payment_method) === 'completed').length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Pedidos</h1>
        <p className="text-neutral-400">
          Gestiona los pedidos de tus clientes
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-neutral-400 text-sm">Pago Pendiente</p>
          <p className="text-2xl font-bold text-yellow-400">{pendingPayment}</p>
        </Card>
        <Card className="p-4">
          <p className="text-neutral-400 text-sm">En Producción</p>
          <p className="text-2xl font-bold text-purple-400">{inProduction}</p>
        </Card>
        <Card className="p-4">
          <p className="text-neutral-400 text-sm">Listos / En Camino</p>
          <p className="text-2xl font-bold text-cyan-400">{readyOrders}</p>
        </Card>
        <Card className="p-4">
          <p className="text-neutral-400 text-sm">Completados</p>
          <p className="text-2xl font-bold text-green-400">{completedOrders}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar por número de pedido o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="pl-10 pr-8 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan appearance-none cursor-pointer"
            >
              <option value="">Todos los estados</option>
              <option value="pending_payment">Pendiente de Pago</option>
              <option value="paid">Pagado</option>
              <option value="partially_paid">Pago Parcial</option>
              <option value="in_production">En Producción</option>
              <option value="ready">Listo</option>
              <option value="in_delivery">En Camino</option>
              <option value="completed">Completado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchOrders}
            className="p-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-cmyk-cyan transition-colors"
            title="Actualizar"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cmyk-cyan mx-auto"></div>
            <p className="mt-4 text-neutral-400">Cargando pedidos...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center">
            <ShoppingCartIcon className="h-12 w-12 mx-auto mb-3 text-neutral-600" />
            <p className="text-neutral-400">No se encontraron pedidos</p>
            {(searchTerm || statusFilter) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setPage(1);
                }}
                className="mt-2 text-cmyk-cyan hover:text-cmyk-cyan/80"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-800/50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Acciones
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {orders.map((order) => {
                  const customer = (order as unknown as { customer?: { full_name: string; email: string } }).customer;
                  const workflowStatus = getWorkflowStatus(order.status, order.payment_method);
                  const availableTransitions = getAvailableTransitions(workflowStatus, order.payment_method);

                  return (
                    <tr key={order.id} className="hover:bg-neutral-800/30">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/${locale}/dashboard/pedidos/${order.id}`}
                            className="p-1 text-neutral-400 hover:text-white transition-colors"
                            title="Ver detalle"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </Link>

                          {availableTransitions.length > 0 && (
                            <select
                              disabled={updatingOrderId === order.id}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleStatusChange(order.id, e.target.value, order.status, order.payment_method);
                                  e.target.value = '';
                                }
                              }}
                              className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 focus:outline-none focus:border-cmyk-cyan cursor-pointer disabled:opacity-50"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                {updatingOrderId === order.id ? 'Actualizando...' : 'Cambiar estado'}
                              </option>
                              {availableTransitions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-white font-medium">{order.order_number}</p>
                          <p className="text-neutral-500 text-sm">{order.item_count} producto(s)</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-white">{customer?.full_name || '-'}</p>
                          <p className="text-neutral-500 text-sm">{customer?.email || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[workflowStatus] || 'bg-neutral-500/20 text-neutral-400'}`}>
                          {statusLabels[workflowStatus] || order.status_display || order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-white">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-neutral-400">
                        {formatDate(order.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2 p-3">
            {orders.map((order) => {
              const customer = (order as unknown as { customer?: { full_name: string; email: string } }).customer;
              const workflowStatus = getWorkflowStatus(order.status, order.payment_method);
              return (
                <div key={order.id} className="rounded-lg border border-neutral-800 p-3 bg-neutral-900/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white text-sm font-semibold">{order.order_number}</p>
                      <p className="text-xs text-neutral-500 truncate">{customer?.full_name || '-'}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${statusColors[workflowStatus] || 'bg-neutral-500/20 text-neutral-400'}`}>
                      {statusLabels[workflowStatus] || order.status_display || order.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-cyan-400 font-medium">{formatCurrency(order.total)}</span>
                    <span className="text-neutral-500">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1 border-t border-neutral-800 pt-2">
                    <Link href={`/${locale}/dashboard/pedidos/${order.id}`} className="p-1 text-neutral-400 hover:text-white" title="Ver detalle">
                      <EyeIcon className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-neutral-800 text-white rounded-lg disabled:opacity-50 hover:bg-neutral-700 transition-colors"
          >
            Anterior
          </button>
          <span className="px-4 py-2 text-neutral-400">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-neutral-800 text-white rounded-lg disabled:opacity-50 hover:bg-neutral-700 transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
