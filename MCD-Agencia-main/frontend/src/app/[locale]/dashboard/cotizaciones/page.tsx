'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, LoadingPage, Pagination } from '@/components/ui';
import {
  getAdminQuotes,
  deleteQuote,
  duplicateQuote,
  Quote,
  QuoteStatus,
} from '@/lib/api/quotes';
import { exportQuotesExcel } from '@/lib/api/notifications';
import { PaginatedResponse } from '@/lib/api/catalog';

const statusColors: Record<QuoteStatus, string> = {
  draft: 'bg-neutral-500/20 text-neutral-400',
  sent: 'bg-cmyk-cyan/20 text-cmyk-cyan',
  viewed: 'bg-purple-500/20 text-purple-400',
  accepted: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  expired: 'bg-cmyk-yellow/20 text-cmyk-yellow',
  changes_requested: 'bg-orange-500/20 text-orange-400',
  converted: 'bg-blue-500/20 text-blue-400',
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

export default function QuotesListPage() {
  const router = useRouter();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    totalCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; quoteId: string | null; quoteNumber: string }>({
    show: false,
    quoteId: null,
    quoteNumber: '',
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isSalesOrAdmin = user?.role?.name && ['admin', 'sales'].includes(user.role.name);

  const fetchQuotes = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const filters: Record<string, unknown> = { page };

      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      if (searchTerm) {
        filters.search = searchTerm;
      }

      const response: PaginatedResponse<Quote> = await getAdminQuotes(filters as {
        status?: QuoteStatus;
        search?: string;
        page?: number;
      });

      setQuotes(response.results || []);
      setPagination({
        page,
        totalPages: response.total_pages || Math.ceil((response.count || 0) / 10),
        totalCount: response.count || 0,
      });
    } catch (error) {
      console.error('Error fetching quotes:', error);
      setQuotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/cotizaciones`);
      } else if (!isSalesOrAdmin) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, isSalesOrAdmin, router, locale]);

  useEffect(() => {
    if (isAuthenticated && isSalesOrAdmin) {
      fetchQuotes(1);
    }
  }, [isAuthenticated, isSalesOrAdmin, fetchQuotes]);

  if (authLoading) {
    return <LoadingPage message="Cargando..." />;
  }

  if (!isAuthenticated || !isSalesOrAdmin) {
    return null;
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQuotes(1);
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Number(amount));
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

  const handleDuplicate = async (quoteId: string) => {
    setActionLoading(quoteId);
    try {
      const newQuote = await duplicateQuote(quoteId);
      // Redirect to edit the new quote
      router.push(`/${locale}/dashboard/cotizaciones/${newQuote.id}/editar`);
    } catch (error) {
      console.error('Error duplicating quote:', error);
      alert('Error al duplicar la cotización');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.quoteId) return;

    setActionLoading(deleteConfirm.quoteId);
    try {
      await deleteQuote(deleteConfirm.quoteId);
      setDeleteConfirm({ show: false, quoteId: null, quoteNumber: '' });
      // Refresh the list
      fetchQuotes(pagination.page);
    } catch (error) {
      console.error('Error deleting quote:', error);
      alert('Error al eliminar la cotización');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Cotizaciones</h1>
            <p className="text-neutral-400">
              Gestiona las cotizaciones y solicitudes de cambio
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
          <Link href={`/${locale}/dashboard/cotizaciones/nueva`}>
            <Button className="mt-4 sm:mt-0" leftIcon={<PlusIcon className="h-5 w-5" />}>
              Nueva Cotización
            </Button>
          </Link>
          <Button
            variant="outline"
            className="mt-2 sm:mt-0 sm:ml-2"
            leftIcon={<ArrowDownTrayIcon className="h-5 w-5" />}
            onClick={async () => {
              setIsExporting(true);
              try {
                await exportQuotesExcel();
              } catch {
                alert('Error al exportar');
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting}
            isLoading={isExporting}
          >
            Exportar Excel
          </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar por número, cliente o email..."
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
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-cmyk-cyan appearance-none cursor-pointer"
              >
                <option value="all">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="sent">Enviada</option>
                <option value="viewed">Vista</option>
                <option value="accepted">Aceptada</option>
                <option value="rejected">Rechazada</option>
                <option value="expired">Expirada</option>
                <option value="changes_requested">Cambios Solicitados</option>
                <option value="converted">Convertida a Pedido</option>
              </select>
            </div>

            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </form>
        </Card>

        {/* Quotes Table */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cmyk-cyan mx-auto"></div>
              <p className="mt-4 text-neutral-400">Cargando cotizaciones...</p>
            </div>
          ) : quotes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-neutral-400">No se encontraron cotizaciones</p>
              {searchTerm || statusFilter !== 'all' ? (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    fetchQuotes(1);
                  }}
                  className="mt-2 text-cyan-400 hover:text-cyan-300"
                >
                  Limpiar filtros
                </button>
              ) : (
                <Link
                  href={`/${locale}/dashboard/cotizaciones/nueva`}
                  className="mt-2 text-cyan-400 hover:text-cyan-300 inline-block"
                >
                  Crear primera cotización
                </Link>
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
                      Cotización
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                      Válida hasta
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {quotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-neutral-800/30">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/${locale}/dashboard/cotizaciones/${quote.id}`}
                            title="Ver detalle"
                            className="p-1 text-neutral-400 hover:text-white transition-colors"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </Link>
                          {quote.status === 'draft' && quote.version > 1 && (
                            <Link
                              href={`/${locale}/dashboard/cotizaciones/${quote.id}/editar`}
                              title="Editar"
                              className="p-1 text-neutral-400 hover:text-white transition-colors"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </Link>
                          )}
                          <button
                            title="Duplicar"
                            onClick={() => handleDuplicate(quote.id)}
                            disabled={actionLoading === quote.id}
                            className="p-1 text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                          >
                            {actionLoading === quote.id ? (
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
                            ) : (
                              <DocumentDuplicateIcon className="h-5 w-5" />
                            )}
                          </button>
                          {quote.status === 'draft' && (
                            <button
                              title="Eliminar"
                              onClick={() => setDeleteConfirm({ show: true, quoteId: quote.id, quoteNumber: quote.quote_number })}
                              disabled={actionLoading === quote.id}
                              className="p-1 text-neutral-400 hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{quote.quote_number}</p>
                            {quote.version > 1 && (
                              <span className="bg-purple-500/20 text-purple-400 text-xs font-bold px-1.5 py-0.5 rounded-full">
                                v{quote.version}
                              </span>
                            )}
                          </div>
                          <p className="text-neutral-500 text-sm">{quote.lines?.length || 0} productos</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-white">{quote.customer_name}</p>
                          <p className="text-neutral-500 text-sm">{quote.customer_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[quote.status] || 'bg-neutral-500/20 text-neutral-400'}`}>
                            {statusLabels[quote.status] || quote.status}
                          </span>
                          {quote.status === 'changes_requested' && (
                            <span className="text-orange-400 text-xs flex items-center gap-1">
                              <PencilSquareIcon className="h-3 w-3" />
                              Cambios pendientes
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-white">
                        {formatCurrency(Number(quote.total) || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-neutral-400">
                        {formatDate(quote.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-neutral-400">
                        {quote.valid_until ? formatDate(quote.valid_until) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-2 p-3">
              {quotes.map((quote) => (
                <div key={quote.id} className="rounded-lg border border-neutral-800 p-3 bg-neutral-900/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white text-sm font-semibold">{quote.quote_number}</p>
                      <p className="text-xs text-neutral-500">{quote.customer_name}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${statusColors[quote.status] || 'bg-neutral-500/20 text-neutral-400'}`}>
                      {statusLabels[quote.status] || quote.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-cyan-400 font-medium">{formatCurrency(Number(quote.total) || 0)}</span>
                    <span className="text-neutral-500">{formatDate(quote.created_at)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1 border-t border-neutral-800 pt-2">
                    <Link href={`/${locale}/dashboard/cotizaciones/${quote.id}`} className="p-1 text-neutral-400 hover:text-white" title="Ver detalle">
                      <EyeIcon className="h-5 w-5" />
                    </Link>
                    {quote.status === 'draft' && quote.version > 1 && (
                      <Link href={`/${locale}/dashboard/cotizaciones/${quote.id}/editar`} className="p-1 text-neutral-400 hover:text-white" title="Editar">
                        <PencilIcon className="h-5 w-5" />
                      </Link>
                    )}
                    <button
                      title="Duplicar"
                      onClick={() => handleDuplicate(quote.id)}
                      disabled={actionLoading === quote.id}
                      className="p-1 text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {actionLoading === quote.id ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
                      ) : (
                        <DocumentDuplicateIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </Card>

        {/* Pagination */}
        {!isLoading && quotes.length > 0 && pagination.totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => fetchQuotes(page)}
            />
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Total Cotizaciones</p>
            <p className="text-2xl font-bold text-white">{pagination.totalCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Aceptadas</p>
            <p className="text-2xl font-bold text-green-400">
              {quotes.filter(q => q.status === 'accepted').length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Borradores</p>
            <p className="text-2xl font-bold text-neutral-400">
              {quotes.filter(q => q.status === 'draft').length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Valor Total</p>
            <p className="text-2xl font-bold text-cyan-400">
              {formatCurrency(quotes.reduce((sum, q) => sum + Number(q.total || 0), 0))}
            </p>
          </Card>
        </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteConfirm({ show: false, quoteId: null, quoteNumber: '' })}
          />
          <Card className="relative z-10 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">
              Eliminar Cotización
            </h3>
            <p className="text-neutral-400 mb-6">
              ¿Estás seguro de que deseas eliminar la cotización <strong className="text-white">{deleteConfirm.quoteNumber}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm({ show: false, quoteId: null, quoteNumber: '' })}
                disabled={actionLoading !== null}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteConfirm}
                disabled={actionLoading !== null}
                className="bg-red-500 hover:bg-red-600"
              >
                {actionLoading ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
