'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  DocumentPlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  InformationCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, LoadingPage, Pagination } from '@/components/ui';
import { SERVICE_LABELS, type ServiceId } from '@/lib/service-ids';
import {
  getAdminQuoteRequests,
  deleteQuoteRequest,
  QuoteRequest,
  QuoteRequestStatus,
  UrgencyLevel,
} from '@/lib/api/quotes';
import { apiClient } from '@/lib/api/client';
import { PaginatedResponse } from '@/lib/api/catalog';

interface ContingencyLead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  source?: string;
  status?: string;
  created_at: string;
}

const statusColors: Record<QuoteRequestStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  assigned: 'bg-blue-500/20 text-blue-400',
  in_review: 'bg-purple-500/20 text-purple-400',
  quoted: 'bg-cmyk-cyan/20 text-cmyk-cyan',
  accepted: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-neutral-500/20 text-neutral-400',
  info_requested: 'bg-orange-500/20 text-orange-400',
};

const statusLabels: Record<QuoteRequestStatus, string> = {
  pending: 'Pendiente',
  assigned: 'Asignada',
  in_review: 'En Revisión',
  quoted: 'Cotizada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  info_requested: 'Info Solicitada',
};

const statusIcons: Record<QuoteRequestStatus, React.ComponentType<{ className?: string }>> = {
  pending: ClockIcon,
  assigned: EyeIcon,
  in_review: ArrowPathIcon,
  quoted: DocumentPlusIcon,
  accepted: CheckCircleIcon,
  rejected: XCircleIcon,
  cancelled: XCircleIcon,
  info_requested: InformationCircleIcon,
};

const urgencyColors: Record<UrgencyLevel, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  normal: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const urgencyLabels: Record<UrgencyLevel, string> = {
  high: 'Urgente',
  medium: 'Media',
  normal: 'Normal',
};

export default function QuoteRequestsListPage() {
  const router = useRouter();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Quote requests state
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [requestsPagination, setRequestsPagination] = useState({
    page: 1,
    totalPages: 1,
    totalCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [contingencyLeads, setContingencyLeads] = useState<ContingencyLead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [ordering, setOrdering] = useState<string>('-created_at');
  const [sortedRequests, setSortedRequests] = useState<QuoteRequest[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<QuoteRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [servicesPopover, setServicesPopover] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!servicesPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setServicesPopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [servicesPopover]);

  const isSalesOrAdmin = user?.role?.name && ['admin', 'sales'].includes(user.role.name);
  const isAdmin = user?.role?.name === 'admin';
  const isSales = user?.role?.name === 'sales';

  // Fetch quote requests
  const fetchRequests = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const filters: Record<string, unknown> = { page };

      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      if (urgencyFilter !== 'all') {
        filters.urgency = urgencyFilter;
      }
      if (searchTerm) {
        filters.search = searchTerm;
      }

      const response: PaginatedResponse<QuoteRequest> = await getAdminQuoteRequests(filters as {
        status?: QuoteRequestStatus;
        urgency?: UrgencyLevel;
        search?: string;
        ordering?: string;
        page?: number;
      });

      setRequests(response.results || []);
      setRequestsPagination({
        page,
        totalPages: response.total_pages || Math.ceil((response.count || 0) / 10),
        totalCount: response.count || 0,
      });

      try {
        const leadsResponse = await apiClient.get<PaginatedResponse<ContingencyLead>>('/chatbot/leads/', { page: 1 });
        const leads = leadsResponse.results || [];
        setContingencyLeads(leads.slice(0, 8));
      } catch {
        setContingencyLeads([]);
      }
    } catch (error) {
      console.error('Error fetching quote requests:', error);
      setRequests([]);
      setContingencyLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, urgencyFilter, searchTerm]);

  // Client-side sorting for instant response
  useEffect(() => {
    if (requests.length === 0) {
      setSortedRequests([]);
      return;
    }
    const sorted = [...requests].sort((a, b) => {
      const desc = ordering.startsWith('-');
      const field = ordering.replace(/^-/, '');
      let valA: number, valB: number;
      if (field === 'urgency') {
        const urgencyOrder: Record<string, number> = { high: 0, medium: 1, normal: 2 };
        valA = urgencyOrder[a.urgency] ?? 2;
        valB = urgencyOrder[b.urgency] ?? 2;
      } else {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }
      return desc ? valB - valA : valA - valB;
    });
    setSortedRequests(sorted);
  }, [ordering, requests]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/solicitudes`);
      } else if (!isSalesOrAdmin) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, isSalesOrAdmin, router, locale]);

  // Fetch data when filters change
  useEffect(() => {
    if (isAuthenticated && isSalesOrAdmin) {
      fetchRequests(1);
    }
  }, [isAuthenticated, isSalesOrAdmin, fetchRequests]);

  if (authLoading) {
    return <LoadingPage message="Cargando..." />;
  }

  if (!isAuthenticated || !isSalesOrAdmin) {
    return null;
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRequests(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteQuoteRequest(deleteTarget.id);
      toast.success(`Solicitud ${deleteTarget.request_number} eliminada`);
      setDeleteTarget(null);
      fetchRequests(requestsPagination.page);
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      toast.error(err?.data?.error || 'Error al eliminar la solicitud');
    } finally {
      setIsDeleting(false);
    }
  };

  const deletableStatuses = ['pending', 'assigned', 'in_review', 'rejected', 'cancelled'];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Solicitudes</h1>
            <p className="text-neutral-400">
              Gestiona las solicitudes de cotización
            </p>
          </div>
          <Link href={`/${locale}/dashboard/cotizaciones/nueva`}>
            <Button className="mt-4 sm:mt-0" leftIcon={<DocumentPlusIcon className="h-5 w-5" />}>
              Nueva Cotización
            </Button>
          </Link>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Total Solicitudes</p>
            <p className="text-2xl font-bold text-white">{requestsPagination.totalCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-400">
              {requests.filter(r => r.status === 'pending').length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Urgentes</p>
            <p className="text-2xl font-bold text-red-400">
              {requests.filter(r => r.urgency === 'high').length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">En Revisión</p>
            <p className="text-2xl font-bold text-purple-400">
              {requests.filter(r => r.status === 'in_review').length}
            </p>
          </Card>
        </div>

        {/* Quote Requests Content */}
          <>
            {/* Filters */}
            <Card className="p-4 mb-6">
              <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Buscar por número, nombre, email o empresa..."
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
                    }}
                    className="pl-10 pr-8 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan appearance-none cursor-pointer min-w-[160px]"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="pending">Pendiente</option>
                    <option value="assigned">Asignada</option>
                    <option value="in_review">En Revisión</option>
                    <option value="info_requested">Info Solicitada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>

                {/* Urgency Filter */}
                <div className="relative">
                  <ExclamationTriangleIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                  <select
                    value={urgencyFilter}
                    onChange={(e) => {
                      setUrgencyFilter(e.target.value);
                    }}
                    className="pl-10 pr-8 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan appearance-none cursor-pointer min-w-[140px]"
                  >
                    <option value="all">Toda urgencia</option>
                    <option value="high">Urgente</option>
                    <option value="medium">Media</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>

                <Button type="submit" variant="outline">
                  Buscar
                </Button>
              </form>
            </Card>

            {/* Requests Table */}
            <Card className="overflow-hidden">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cmyk-cyan mx-auto"></div>
                  <p className="mt-4 text-neutral-400">Cargando solicitudes...</p>
                </div>
              ) : requests.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-neutral-400">No se encontraron solicitudes</p>
                  {(searchTerm || statusFilter !== 'all' || urgencyFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                        setUrgencyFilter('all');
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
                          Solicitud
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Cliente
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Servicios
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Estado
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider cursor-pointer select-none hover:text-neutral-200 transition-colors"
                          onClick={() => setOrdering(prev => prev === 'urgency' ? '-urgency' : prev === '-urgency' ? '-created_at' : 'urgency')}
                        >
                          <span className="inline-flex items-center gap-1">
                            Urgencia
                            {ordering === 'urgency' ? (
                              <ChevronUpIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                            ) : ordering === '-urgency' ? (
                              <ChevronDownIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                            ) : (
                              <span className="inline-flex flex-col -space-y-1">
                                <ChevronUpIcon className="h-2.5 w-2.5 text-neutral-600" />
                                <ChevronDownIcon className="h-2.5 w-2.5 text-neutral-600" />
                              </span>
                            )}
                          </span>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider cursor-pointer select-none hover:text-neutral-200 transition-colors"
                          onClick={() => setOrdering(prev => prev === '-created_at' ? 'created_at' : prev === 'created_at' ? '-created_at' : '-created_at')}
                        >
                          <span className="inline-flex items-center gap-1">
                            Fecha
                            {ordering === 'created_at' ? (
                              <ChevronUpIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                            ) : ordering === '-created_at' ? (
                              <ChevronDownIcon className="h-3.5 w-3.5 text-cmyk-cyan" />
                            ) : (
                              <span className="inline-flex flex-col -space-y-1">
                                <ChevronUpIcon className="h-2.5 w-2.5 text-neutral-600" />
                                <ChevronDownIcon className="h-2.5 w-2.5 text-neutral-600" />
                              </span>
                            )}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {sortedRequests.map((request) => {
                        const StatusIcon = statusIcons[request.status];
                        return (
                          <tr key={request.id} className="hover:bg-neutral-800/30">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <Link
                                  href={`/${locale}/dashboard/solicitudes/${request.id}`}
                                  className="p-2 text-neutral-400 hover:text-white transition-colors"
                                  title="Ver detalle"
                                >
                                  <EyeIcon className="h-5 w-5" />
                                </Link>
                                {['pending', 'assigned', 'in_review'].includes(request.status) && (
                                  isAdmin || request.assigned_to === user?.id || request.urgency === 'high'
                                ) && (
                                  <Link
                                    href={`/${locale}/dashboard/cotizaciones/nueva?solicitud=${request.id}`}
                                    className="p-2 text-cmyk-cyan hover:text-cmyk-cyan/80 transition-colors"
                                    title="Crear cotización"
                                  >
                                    <DocumentPlusIcon className="h-5 w-5" />
                                  </Link>
                                )}
                                {isAdmin && deletableStatuses.includes(request.status) && (
                                  <button
                                    onClick={() => setDeleteTarget(request)}
                                    className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
                                    title="Eliminar solicitud"
                                  >
                                    <TrashIcon className="h-5 w-5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <p className="text-white font-medium">{request.request_number}</p>
                                {request.is_guest && (
                                  <span className="text-xs text-neutral-500">Invitado</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <p className="text-white">{request.customer_name}</p>
                                <p className="text-neutral-500 text-sm">{request.customer_email}</p>
                                {request.customer_company && (
                                  <p className="text-neutral-600 text-xs">{request.customer_company}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="max-w-xs">
                                {request.services && request.services.length > 0 ? (
                                  request.services.length === 1 ? (
                                    /* ─── Single service: show name directly ─── */
                                    <p className="text-white truncate">
                                      {SERVICE_LABELS[request.services[0].service_type as ServiceId] || request.services[0].service_type}
                                    </p>
                                  ) : (
                                    /* ─── Multiple services: badge + popover ─── */
                                    <div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (servicesPopover === request.id) {
                                            setServicesPopover(null);
                                            setPopoverPos(null);
                                          } else {
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            setPopoverPos({
                                              top: rect.top,
                                              left: rect.left + rect.width / 2,
                                            });
                                            setServicesPopover(request.id);
                                          }
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cmyk-cyan/15 text-cmyk-cyan border border-cmyk-cyan/30 hover:bg-cmyk-cyan/25 transition-colors cursor-pointer"
                                      >
                                        {request.services.length} servicios
                                      </button>
                                      {servicesPopover === request.id && popoverPos && (
                                        <div
                                          ref={popoverRef}
                                          className="fixed w-56 bg-neutral-800 border border-neutral-700 rounded-lg shadow-2xl p-3"
                                          style={{
                                            zIndex: 9999,
                                            top: popoverPos.top - 8,
                                            left: popoverPos.left,
                                            transform: 'translate(-50%, -100%)',
                                          }}
                                        >
                                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
                                            <div className="w-2.5 h-2.5 bg-neutral-800 border-r border-b border-neutral-700 rotate-45 -translate-y-1.5" />
                                          </div>
                                          <p className="text-neutral-400 text-[10px] uppercase tracking-wider mb-2">Servicios solicitados</p>
                                          <ul className="space-y-1.5">
                                            {request.services.map((svc, idx) => {
                                              const routeCount = svc.service_details?.rutas ? (svc.service_details.rutas as unknown[]).length : 0;
                                              return (
                                                <li key={idx} className="flex items-center justify-between gap-2">
                                                  <span className="text-white text-xs truncate">
                                                    {SERVICE_LABELS[svc.service_type as ServiceId] || svc.service_type}
                                                  </span>
                                                  {routeCount > 1 && (
                                                    <span className="text-neutral-500 text-[10px] flex-shrink-0">{routeCount} rutas</span>
                                                  )}
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  <p className="text-white truncate">
                                    {request.catalog_item_name ||
                                     (request.service_type && SERVICE_LABELS[request.service_type as ServiceId]) ||
                                     request.service_type ||
                                     'No especificado'}
                                  </p>
                                )}
                                {/* Total quantity: sum of route counts across all services */}
                                {(() => {
                                  if (!request.services || request.services.length === 0) {
                                    return request.quantity ? (
                                      <p className="text-neutral-500 text-sm">Cantidad: {request.quantity}</p>
                                    ) : null;
                                  }
                                  const total = request.services.reduce((sum, svc) => {
                                    const rutas = svc.service_details?.rutas as unknown[] | undefined;
                                    return sum + (rutas && rutas.length > 0 ? rutas.length : 1);
                                  }, 0);
                                  return (
                                    <p className="text-neutral-500 text-xs mt-1">Cant. total: {total}</p>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[request.status]}`}>
                                <StatusIcon className="h-3.5 w-3.5" />
                                {statusLabels[request.status]}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${urgencyColors[request.urgency]}`}>
                                {urgencyLabels[request.urgency]}
                              </span>
                              {request.days_until_required !== undefined && request.days_until_required !== null && (
                                <p className="text-neutral-500 text-xs mt-1">
                                  {request.days_until_required > 0
                                    ? `${request.days_until_required} días`
                                    : request.days_until_required === 0
                                    ? 'Hoy'
                                    : 'Vencido'}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className="text-neutral-400">{formatDate(request.created_at)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-2 p-3">
                  {sortedRequests.map((request) => {
                    const StatusIcon = statusIcons[request.status];
                    return (
                      <div key={request.id} className="rounded-lg border border-neutral-800 p-3 bg-neutral-900/40">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-white text-sm font-semibold">{request.request_number}</p>
                            <p className="text-xs text-neutral-500 truncate">{request.customer_name}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-neutral-800 text-neutral-200">
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusLabels[request.status] || request.status}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-neutral-500">
                          {request.customer_email}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className={`px-2 py-1 rounded-full font-medium ${urgencyColors[request.urgency] || 'bg-neutral-700/30 text-neutral-300'}`}>
                            {urgencyLabels[request.urgency] || request.urgency}
                          </span>
                          <span className="text-neutral-500">{formatDate(request.created_at)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-1 border-t border-neutral-800 pt-2">
                          <Link
                            href={`/${locale}/dashboard/solicitudes/${request.id}`}
                            className="p-2 text-neutral-400 hover:text-white transition-colors"
                            title="Ver detalle"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </Link>
                          {['pending', 'assigned', 'in_review'].includes(request.status) && (isAdmin || request.assigned_to === user?.id || request.urgency === 'high') && (
                            <Link
                              href={`/${locale}/dashboard/cotizaciones/nueva?solicitud=${request.id}`}
                              className="p-2 text-cmyk-cyan hover:text-cmyk-cyan/80 transition-colors"
                              title="Crear cotización"
                            >
                              <DocumentPlusIcon className="h-5 w-5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </Card>

            {/* Pagination */}
            {!isLoading && requests.length > 0 && requestsPagination.totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={requestsPagination.page}
                  totalPages={requestsPagination.totalPages}
                  onPageChange={(page) => fetchRequests(page)}
                />
              </div>
            )}

            {/* Contingency leads shown when quote creation is degraded */}
            {!isLoading && contingencyLeads.length > 0 && (
              <Card className="mt-6 p-4">
                <h3 className="text-white font-semibold mb-2">Registros de contingencia</h3>
                <p className="text-neutral-400 text-sm mb-3">
                  Estas entradas se recibieron por el canal alterno cuando Solicitudes tuvo intermitencias.
                </p>
                <div className="space-y-2">
                  {contingencyLeads.map((lead) => (
                    <div key={lead.id} className="rounded-lg border border-neutral-800 p-3">
                      <p className="text-white text-sm font-medium">{lead.name} · {lead.email}</p>
                      <p className="text-neutral-500 text-xs">{formatDate(lead.created_at)} · Fuente: {lead.source || 'n/a'}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

          </>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <TrashIcon className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Eliminar solicitud</h3>
            </div>
            <p className="text-neutral-400 mb-2">
              ¿Estás seguro de que deseas eliminar la solicitud{' '}
              <span className="text-white font-medium">{deleteTarget.request_number}</span>?
            </p>
            <p className="text-neutral-500 text-sm mb-6">
              De: {deleteTarget.customer_name} ({deleteTarget.customer_email})
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                isLoading={isDeleting}
                className="!bg-red-600 hover:!bg-red-700 !border-red-600"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
