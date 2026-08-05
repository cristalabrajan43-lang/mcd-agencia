'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  DocumentTextIcon,
  DocumentCheckIcon,
  ShoppingCartIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

import { Card, LoadingPage } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getAdminQuoteRequests, type QuoteRequest } from '@/lib/api/quotes';
import { getAdminQuotes, type Quote } from '@/lib/api/quotes';
import { getStaffOrders, type OrderListItem } from '@/lib/api/orders';

type OverviewStats = {
  quote_requests: { total: number; pending: number };
  quotes: { total: number; draft: number };
  orders: { total: number; pending_payment: number; in_production: number };
};

export default function OperationsPage() {
  const router = useRouter();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const permissions = usePermissions();
  const [stats, setStats] = useState<OverviewStats>({
    quote_requests: { total: 0, pending: 0 },
    quotes: { total: 0, draft: 0 },
    orders: { total: 0, pending_payment: 0, in_production: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [recentItems, setRecentItems] = useState<{
    requests: QuoteRequest[];
    quotes: Quote[];
    orders: OrderListItem[];
  }>({
    requests: [],
    quotes: [],
    orders: [],
  });

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push(`/${locale}/login?redirect=/${locale}/dashboard/operaciones`);
      return;
    }
    if (!permissions?.canViewOperationsPanel) {
      router.push(`/${locale}`);
    }
  }, [authLoading, isAuthenticated]);

  // Fetch data
  useEffect(() => {
    if (!isAuthenticated || !permissions?.canViewOperationsPanel) {
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [requestsRes, quotesRes, ordersRes] = await Promise.all([
          getAdminQuoteRequests({ page: 1 }),
          getAdminQuotes({ page: 1 }),
          getStaffOrders({ page: 1 }),
        ]);

        // Calculate stats
        const requests = requestsRes.results || [];
        const quotes = quotesRes.results || [];
        const orders = ordersRes.results || [];

        setStats({
          quote_requests: {
            total: requestsRes.count || 0,
            pending: requests.filter((r) => r.status === 'pending').length,
          },
          quotes: {
            total: quotesRes.count || 0,
            draft: quotes.filter((q) => q.status === 'draft').length,
          },
          orders: {
            total: ordersRes.count || 0,
            pending_payment: orders.filter((o) => o.status === 'pending_payment').length,
            in_production: orders.filter((o) => o.status === 'in_production').length,
          },
        });

        // Set recent items (first 5 of each)
        setRecentItems({
          requests: requests.slice(0, 5),
          quotes: quotes.slice(0, 5),
          orders: orders.slice(0, 5),
        });
      } catch (error) {
        console.error('Error fetching operations data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, permissions?.canViewOperationsPanel]);

  if (authLoading || isLoading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated || !permissions?.canViewOperationsPanel) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Flujo Operativo Unificado</h1>
        <p className="text-neutral-400 mt-2">Resumen de solicitudes, cotizaciones y pedidos</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quote Requests */}
        <Card className="p-6 border border-blue-500/30">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <DocumentTextIcon className="h-5 w-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Solicitudes</h2>
              </div>
              <p className="text-neutral-500 text-sm">De cotización</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Total</span>
              <span className="text-2xl font-bold text-blue-400">{stats.quote_requests.total}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500 flex items-center gap-2">
                <ClockIcon className="h-4 w-4" />
                Pendientes
              </span>
              <span className="text-yellow-400 font-semibold">{stats.quote_requests.pending}</span>
            </div>

            <Link
              href={`/${locale}/dashboard/solicitudes`}
              className="block mt-4 px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm text-center hover:bg-blue-500/30 transition-colors"
            >
              Ver todas
            </Link>
          </div>
        </Card>

        {/* Quotes */}
        <Card className="p-6 border border-purple-500/30">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <DocumentCheckIcon className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Cotizaciones</h2>
              </div>
              <p className="text-neutral-500 text-sm">Presupuestos</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Total</span>
              <span className="text-2xl font-bold text-purple-400">{stats.quotes.total}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500 flex items-center gap-2">
                <DocumentTextIcon className="h-4 w-4" />
                Borradores
              </span>
              <span className="text-purple-400 font-semibold">{stats.quotes.draft}</span>
            </div>

            <Link
              href={`/${locale}/dashboard/cotizaciones`}
              className="block mt-4 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm text-center hover:bg-purple-500/30 transition-colors"
            >
              Ver todas
            </Link>
          </div>
        </Card>

        {/* Orders */}
        <Card className="p-6 border border-green-500/30">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCartIcon className="h-5 w-5 text-green-400" />
                <h2 className="text-lg font-semibold text-white">Pedidos</h2>
              </div>
              <p className="text-neutral-500 text-sm">Órdenes de compra</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Total</span>
              <span className="text-2xl font-bold text-green-400">{stats.orders.total}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500 flex items-center gap-2">
                <ClockIcon className="h-4 w-4" />
                Pendiente pago
              </span>
              <span className="text-yellow-400 font-semibold">{stats.orders.pending_payment}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500 flex items-center gap-2">
                <ArrowPathIcon className="h-4 w-4" />
                En producción
              </span>
              <span className="text-purple-400 font-semibold">{stats.orders.in_production}</span>
            </div>

            <Link
              href={`/${locale}/dashboard/pedidos`}
              className="block mt-4 px-3 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm text-center hover:bg-green-500/30 transition-colors"
            >
              Ver todas
            </Link>
          </div>
        </Card>
      </div>

      {/* Recent Items Sections */}
      <div className="space-y-6">
        {/* Recent Requests */}
        {recentItems.requests.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-blue-400" />
              Solicitudes Recientes
            </h3>
            <div className="space-y-2">
              {recentItems.requests.map((request) => (
                <Link
                  key={request.id}
                  href={`/${locale}/dashboard/solicitudes/${request.id}`}
                  className="block p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{request.request_number}</p>
                      <p className="text-neutral-400 text-sm truncate">{request.customer_name || request.customer_email}</p>
                    </div>
                    <span className="ml-2 px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs whitespace-nowrap">
                      {request.status_display || request.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Recent Quotes */}
        {recentItems.quotes.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DocumentCheckIcon className="h-5 w-5 text-purple-400" />
              Cotizaciones Recientes
            </h3>
            <div className="space-y-2">
              {recentItems.quotes.map((quote) => (
                <Link
                  key={quote.id}
                  href={`/${locale}/dashboard/cotizaciones/${quote.id}`}
                  className="block p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{quote.quote_number}</p>
                      <p className="text-neutral-400 text-sm truncate">{quote.customer_name || quote.customer_email}</p>
                    </div>
                    <span className="ml-2 px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs whitespace-nowrap">
                      {quote.status_display || quote.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Recent Orders */}
        {recentItems.orders.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ShoppingCartIcon className="h-5 w-5 text-green-400" />
              Pedidos Recientes
            </h3>
            <div className="space-y-2">
              {recentItems.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/${locale}/dashboard/pedidos/${order.id}`}
                  className="block p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">Pedido {order.order_number}</p>
                      <p className="text-neutral-400 text-sm truncate">{order.customer?.full_name || order.customer?.email || 'Cliente'}</p>
                    </div>
                    <span className="ml-2 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs whitespace-nowrap">
                      {order.status_display || order.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
