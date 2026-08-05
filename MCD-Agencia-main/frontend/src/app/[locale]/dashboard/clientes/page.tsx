'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  PencilIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, LoadingPage, Pagination } from '@/components/ui';
import { getAdminClients, type AdminClient } from '@/lib/api/admin';

export default function ClientsListPage() {
  const router = useRouter();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const isSalesOrAdmin = user?.role?.name && ['admin', 'sales'].includes(user.role.name);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/clientes`);
      } else if (!isSalesOrAdmin) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, isSalesOrAdmin, router, locale]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-clients', searchTerm, page],
    queryFn: () => getAdminClients({ search: searchTerm || undefined, page }),
    enabled: isAuthenticated && Boolean(isSalesOrAdmin),
  });

  const clients = data?.results || [];
  const totalPages = data?.total_pages || Math.ceil((data?.count || 0) / 10);

  if (authLoading) {
    return <LoadingPage message="Cargando..." />;
  }

  if (!isAuthenticated || !isSalesOrAdmin) {
    return null;
  }

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Number(amount || 0));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Stats
  const totalClients = data?.count || clients.length;
  const activeClients = clients.filter(c => c.total_orders > 0).length;
  const totalRevenue = clients.reduce((sum, c) => sum + Number(c.total_spent || 0), 0);
  const totalOrders = clients.reduce((sum, c) => sum + Number(c.total_orders || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Clientes</h1>
            <p className="text-neutral-400">
              Gestiona tus clientes y su información
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Total Clientes</p>
            <p className="text-2xl font-bold text-white">{totalClients}</p>
          </Card>
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Clientes Activos</p>
            <p className="text-2xl font-bold text-green-400">{activeClients}</p>
          </Card>
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Ingresos Totales</p>
            <p className="text-2xl font-bold text-cyan-400">{formatCurrency(totalRevenue)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-neutral-400 text-sm">Ticket Promedio</p>
            <p className="text-2xl font-bold text-purple-400">{formatCurrency(avgOrderValue)}</p>
          </Card>
        </div>

        {/* Search */}
        <Card className="p-4 mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono o empresa..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan"
            />
          </div>
        </Card>

        {/* Clients Grid */}
        {isLoading ? (
          <Card className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cmyk-cyan mx-auto"></div>
            <p className="mt-4 text-neutral-400">Cargando clientes...</p>
          </Card>
        ) : clients.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-neutral-400">No se encontraron clientes</p>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
                className="mt-2 text-cyan-400 hover:text-cyan-300"
              >
                Limpiar búsqueda
              </button>
            )}
          </Card>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client: AdminClient) => (
              <Card key={client.id} className="p-6 hover:border-cmyk-cyan/50 transition-colors">
                {/* Client Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{client.name}</h3>
                    {client.company && (
                      <p className="text-neutral-400 text-sm">{client.company}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      title="Ver detalle"
                      className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      title="Editar"
                      className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <EnvelopeIcon className="h-4 w-4 text-neutral-500" />
                    <span className="text-neutral-300">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <PhoneIcon className="h-4 w-4 text-neutral-500" />
                    <span className="text-neutral-300">{client.phone}</span>
                  </div>
                  {client.city && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPinIcon className="h-4 w-4 text-neutral-500" />
                      <span className="text-neutral-300">{client.city}</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-neutral-800 my-4"></div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold text-white">{client.total_orders}</p>
                    <p className="text-xs text-neutral-500">Pedidos</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{client.total_quotes}</p>
                    <p className="text-xs text-neutral-500">Cotizaciones</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-cyan-400">{formatCurrency(client.total_spent)}</p>
                    <p className="text-xs text-neutral-500">Total</p>
                  </div>
                </div>

                {/* Last Order */}
                {client.last_order_date && (
                  <div className="mt-4 pt-4 border-t border-neutral-800">
                    <p className="text-xs text-neutral-500">
                      Último pedido: {formatDate(client.last_order_date)}
                    </p>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/${locale}/dashboard/cotizaciones/nueva?cliente=${client.id}`}
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full text-sm">
                      Nueva Cotización
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
          </>
        )}
    </div>
  );
}
