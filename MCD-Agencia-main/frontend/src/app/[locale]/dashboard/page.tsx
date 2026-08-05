'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PencilSquareIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { Card, LoadingPage } from '@/components/ui';
import {
  getSalesRepDashboard,
  getAdminQuoteRequests,
  getPendingChangeRequests,
  SalesRepDashboard,
  QuoteRequest,
  QuoteChangeRequest,
} from '@/lib/api/quotes';

const urgencyColors = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  normal: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const urgencyLabels = {
  high: 'Urgente',
  medium: 'Media',
  normal: 'Normal',
};

export default function DashboardPage() {
  const router = useRouter();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [dashboard, setDashboard] = useState<SalesRepDashboard | null>(null);
  const [pendingRequests, setPendingRequests] = useState<QuoteRequest[]>([]);
  const [pendingChangeRequests, setPendingChangeRequests] = useState<QuoteChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const groups = user?.groups || [];
  const isSalesOrAdmin = user?.role?.name && ['admin', 'sales'].includes(user.role.name);
  const isProduction = groups.includes('production_supervisors');
  const isLogistics = groups.includes('operations_supervisors');
  const dashboardTarget = isSalesOrAdmin
    ? `/${locale}/dashboard/operaciones`
    : isProduction
      ? `/${locale}/dashboard/produccion`
      : isLogistics
        ? `/${locale}/dashboard/logistica`
        : `/${locale}`;

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard`);
      } else if (dashboardTarget !== `/${locale}`) {
        router.replace(dashboardTarget);
      } else {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, dashboardTarget, router, locale]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!isAuthenticated || !isSalesOrAdmin) return;

      setIsLoading(true);
      try {
        // Fetch dashboard stats, pending requests, and change requests in parallel
        const [dashboardData, requestsData, changeRequestsData] = await Promise.all([
          getSalesRepDashboard().catch(() => null),
          getAdminQuoteRequests({ status: 'pending', page: 1 }).catch(() => ({ results: [] })),
          getPendingChangeRequests().catch(() => []),
        ]);

        if (dashboardData) {
          setDashboard(dashboardData);
        }
        setPendingRequests(requestsData.results?.slice(0, 5) || []);
        setPendingChangeRequests(changeRequestsData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAuthenticated, isSalesOrAdmin]);

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
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          {user?.role?.name === 'admin' ? 'Panel de Administración' : 'Panel de Ventas'}
        </h1>
        <p className="text-neutral-400">
          Bienvenido, {user?.first_name || user?.email}
        </p>
      </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cmyk-magenta/20">
                <ClipboardDocumentListIcon className="h-6 w-6 text-cmyk-magenta" />
              </div>
              <div>
                <p className="text-neutral-400 text-sm">Solicitudes Pendientes</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? '...' : dashboard?.pending_requests ?? pendingRequests.length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cmyk-cyan/20">
                <ClockIcon className="h-6 w-6 text-cmyk-cyan" />
              </div>
              <div>
                <p className="text-neutral-400 text-sm">Sin Respuesta</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? '...' : dashboard?.quotes_without_response ?? 0}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircleIcon className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-neutral-400 text-sm">Tasa de Conversión</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? '...' : `${dashboard?.conversion_rate ?? 0}%`}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cmyk-yellow/20">
                <ChartBarIcon className="h-6 w-6 text-cmyk-yellow" />
              </div>
              <div>
                <p className="text-neutral-400 text-sm">Total Aprobado</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? '...' : formatCurrency(dashboard?.total_approved ?? 0)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Urgent Requests */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-cmyk-magenta" />
                  Solicitudes Pendientes
                </h2>
                <Link
                  href={`/${locale}/dashboard/solicitudes`}
                  className="text-cmyk-cyan hover:text-cmyk-cyan/80 text-sm flex items-center gap-1"
                >
                  Ver todas <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cmyk-cyan"></div>
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">
                  <ClipboardDocumentListIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay solicitudes pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <Link
                      key={request.id}
                      href={`/${locale}/dashboard/solicitudes/${request.id}`}
                      className="block p-4 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors border border-neutral-700/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium truncate">
                              {request.customer_name}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${urgencyColors[request.urgency]}`}>
                              {urgencyLabels[request.urgency]}
                            </span>
                          </div>
                          <p className="text-neutral-400 text-sm truncate">
                            {request.catalog_item_name || request.service_type || 'Servicio no especificado'}
                          </p>
                          <p className="text-neutral-500 text-xs mt-1">
                            {request.request_number} • {formatDate(request.created_at)}
                          </p>
                        </div>
                        <ArrowRightIcon className="h-5 w-5 text-neutral-500 flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Acciones Rápidas</h2>
              <div className="space-y-3">
                <Link
                  href={`/${locale}/dashboard/cotizaciones/nueva`}
                  className="block w-full px-4 py-3 bg-cmyk-cyan text-black font-medium rounded-lg hover:bg-cmyk-cyan/90 transition-colors text-center"
                >
                  Nueva Cotización
                </Link>
                <Link
                  href={`/${locale}/dashboard/solicitudes`}
                  className="block w-full px-4 py-3 bg-neutral-800 text-white font-medium rounded-lg hover:bg-neutral-700 transition-colors text-center"
                >
                  Ver Solicitudes
                </Link>
                <Link
                  href={`/${locale}/dashboard/cotizaciones`}
                  className="block w-full px-4 py-3 bg-neutral-800 text-white font-medium rounded-lg hover:bg-neutral-700 transition-colors text-center"
                >
                  Ver Cotizaciones
                </Link>
                <Link
                  href={`/${locale}/dashboard/pedidos`}
                  className="block w-full px-4 py-3 bg-neutral-800 text-white font-medium rounded-lg hover:bg-neutral-700 transition-colors text-center"
                >
                  Ver Pedidos
                </Link>
                <Link
                  href={`/${locale}/dashboard/operaciones`}
                  className="block w-full px-4 py-3 bg-neutral-800 text-white font-medium rounded-lg hover:bg-neutral-700 transition-colors text-center"
                >
                  Flujo Operativo
                </Link>
                <Link
                  href={`/${locale}/catalogo`}
                  className="block w-full px-4 py-3 bg-neutral-800 text-white font-medium rounded-lg hover:bg-neutral-700 transition-colors text-center"
                >
                  Ver Catálogo
                </Link>
              </div>
            </Card>
          </div>
        </div>

        {/* Pending Change Requests */}
        {pendingChangeRequests.length > 0 && (
          <Card className="p-6 mb-8 border-orange-500/30">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <PencilSquareIcon className="h-5 w-5 text-orange-400" />
                Solicitudes de Cambio Pendientes
                <span className="bg-orange-500/20 text-orange-400 text-xs font-medium px-2 py-0.5 rounded-full">
                  {pendingChangeRequests.length}
                </span>
              </h2>
            </div>

            <div className="space-y-3">
              {pendingChangeRequests.map((changeRequest) => (
                <Link
                  key={changeRequest.id}
                  href={`/${locale}/dashboard/cotizaciones/${changeRequest.quote}/cambios/${changeRequest.id}`}
                  className="block p-4 bg-orange-500/10 rounded-lg hover:bg-orange-500/20 transition-colors border border-orange-500/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium truncate">
                          {changeRequest.customer_name}
                        </span>
                        <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-xs font-medium">
                          Cambios solicitados
                        </span>
                      </div>
                      <p className="text-neutral-400 text-sm truncate">
                        Cotización: {changeRequest.quote_number || 'N/A'}
                      </p>
                      {changeRequest.customer_comments && (
                        <p className="text-neutral-500 text-sm mt-1 truncate">
                          &quot;{changeRequest.customer_comments}&quot;
                        </p>
                      )}
                      <p className="text-neutral-500 text-xs mt-1">
                        {formatDate(changeRequest.created_at)}
                      </p>
                    </div>
                    <ArrowRightIcon className="h-5 w-5 text-orange-400 flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Menu Grid - removed, navigation is in sidebar */}
    </div>
  );
}
