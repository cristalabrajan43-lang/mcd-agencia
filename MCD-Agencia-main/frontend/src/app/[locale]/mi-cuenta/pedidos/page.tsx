'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBagIcon,
  EyeIcon,
  ChevronRightIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

import { getOrders } from '@/lib/api/orders';
import { Card, Badge, Button, Pagination, LoadingPage, Select } from '@/components/ui';
import { formatPrice, formatDate, getOrderStatusColor, cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending_payment', label: 'Pendiente de pago' },
  { value: 'paid', label: 'Pagado' },
  { value: 'in_production', label: 'En producción' },
  { value: 'ready', label: 'Listo' },
  { value: 'in_delivery', label: 'En camino' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
];

export default function OrdersPage() {
  const [filters, setFilters] = useState({ status: '', page: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => getOrders(filters),
  });

  const orders = data?.results || [];
  const totalPages = data?.total_pages || Math.ceil((data?.count || 0) / 10);

  if (isLoading) {
    return <LoadingPage message="Cargando pedidos..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Mis Pedidos</h2>
          <p className="text-neutral-400">Historial de tus compras</p>
        </div>

        <Select
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
          options={STATUS_OPTIONS}
          placeholder="Filtrar por estado"
          className="w-48"
        />
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <Card className="text-center py-12">
          <ShoppingBagIcon className="h-16 w-16 text-neutral-700 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">No tienes pedidos</h3>
          <p className="text-neutral-400 mb-6">
            Cuando realices una compra, aparecerá aquí
          </p>
          <Link href="/catalogo">
            <Button>Explorar catálogo</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} hover>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white font-medium">
                      Pedido #{order.order_number}
                    </span>
                    <Badge
                      variant={
                        order.status === 'completed'
                          ? 'success'
                          : order.status === 'cancelled'
                          ? 'error'
                          : order.status === 'paid' || order.status === 'in_production'
                          ? 'info'
                          : 'warning'
                      }
                    >
                      {order.status_display}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
                    <span>{formatDate(order.created_at)}</span>
                    <span>{order.item_count} productos</span>
                    <span className="text-cyan-400 font-medium">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>

                <Link href={`/mi-cuenta/pedidos/${order.id}`}>
                  <Button variant="ghost" rightIcon={<ChevronRightIcon className="h-5 w-5" />}>
                    Ver detalle
                  </Button>
                </Link>
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={filters.page}
              totalPages={totalPages}
              onPageChange={(page) => setFilters({ ...filters, page })}
            />
          )}
        </div>
      )}
    </div>
  );
}
