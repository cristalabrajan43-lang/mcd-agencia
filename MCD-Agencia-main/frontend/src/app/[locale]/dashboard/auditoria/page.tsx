'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

import { getAuditLogs, AuditLog } from '@/lib/api/admin';
import { Card, Badge, Button, Input, Select, Pagination, LoadingPage, Modal } from '@/components/ui';
import { formatDateTime, cn } from '@/lib/utils';

const ENTITY_OPTIONS = [
  { value: '', label: 'Todas las entidades' },
  { value: 'User', label: 'Usuarios' },
  { value: 'Order', label: 'Pedidos' },
  { value: 'Quote', label: 'Cotizaciones' },
  { value: 'CatalogItem', label: 'Productos' },
  { value: 'InventoryMovement', label: 'Inventario' },
  { value: 'Payment', label: 'Pagos' },
];

const ACTION_OPTIONS = [
  { value: '', label: 'Todas las acciones' },
  { value: 'created', label: 'Creación' },
  { value: 'updated', label: 'Actualización' },
  { value: 'deleted', label: 'Eliminación' },
  { value: 'state_changed', label: 'Cambio de estado' },
  { value: 'login', label: 'Inicio de sesión' },
  { value: 'logout', label: 'Cierre de sesión' },
];

const getActionColor = (action: string) => {
  const colors: Record<string, string> = {
    created: 'text-green-400',
    updated: 'text-blue-400',
    deleted: 'text-red-400',
    state_changed: 'text-yellow-400',
    login: 'text-cyan-400',
    logout: 'text-neutral-400',
    payment_processed: 'text-green-400',
    email_sent: 'text-purple-400',
  };
  return colors[action] || 'text-neutral-400';
};

export default function AdminAuditPage() {
  const [filters, setFilters] = useState({
    entity_type: '',
    action: '',
    page: 1,
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => getAuditLogs(filters),
  });

  const logs = data?.results || [];
  const totalPages = Math.ceil((data?.count || 0) / 50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Auditoría</h1>
          <p className="text-neutral-400">
            Registro de todas las acciones del sistema
          </p>
        </div>

        <Button
          variant="outline"
          leftIcon={<ArrowDownTrayIcon className="h-5 w-5" />}
        >
          Exportar
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <Select
            value={filters.entity_type}
            onChange={(value) => setFilters({ ...filters, entity_type: value, page: 1 })}
            options={ENTITY_OPTIONS}
            className="w-48"
          />
          <Select
            value={filters.action}
            onChange={(value) => setFilters({ ...filters, action: value, page: 1 })}
            options={ACTION_OPTIONS}
            className="w-48"
          />
        </div>
      </Card>

      {/* Logs Table */}
      {isLoading ? (
        <LoadingPage message="Cargando registros..." />
      ) : logs.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-neutral-400">No se encontraron registros</p>
        </Card>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Fecha/Hora
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Usuario
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Acción
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Entidad
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    ID
                  </th>
                  <th className="text-right text-sm font-medium text-neutral-400 py-3 px-4">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: AuditLog) => (
                  <tr
                    key={log.id}
                    className="border-b border-neutral-800 hover:bg-neutral-900/50"
                  >
                    <td className="py-4 px-4 text-neutral-400 text-sm">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="py-4 px-4">
                      {log.actor_name ? (
                        <div>
                          <p className="text-white text-sm">{log.actor_name}</p>
                          <p className="text-xs text-neutral-500">{log.actor_email}</p>
                        </div>
                      ) : (
                        <span className="text-neutral-500 text-sm">
                          {log.actor_email || 'Sistema'}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className={cn('text-sm font-medium capitalize', getActionColor(log.action))}>
                        {log.action_display || log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-white text-sm">
                      {log.entity_repr || log.entity_type}
                    </td>
                    <td className="py-4 px-4 text-neutral-400 text-sm font-mono">
                      {log.entity_id.length > 8 ? `${log.entity_id.substring(0, 8)}...` : log.entity_id}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <EyeIcon className="h-5 w-5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {logs.map((log: AuditLog) => (
              <Card key={log.id} padding="sm" className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-neutral-500">{formatDateTime(log.timestamp)}</p>
                    <p className="text-sm text-white font-medium truncate">{log.entity_repr || log.entity_type}</p>
                  </div>
                  <span className={cn('text-xs font-medium capitalize', getActionColor(log.action))}>
                    {log.action_display || log.action.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 truncate">
                  {log.actor_name || log.actor_email || 'Sistema'}
                </p>
                <div className="flex justify-end border-t border-neutral-800 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                    <EyeIcon className="h-5 w-5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={filters.page}
              totalPages={totalPages}
              onPageChange={(page) => setFilters({ ...filters, page })}
            />
          )}
        </>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Detalle del registro"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-neutral-500">Fecha/Hora</label>
                <p className="text-white">{formatDateTime(selectedLog.timestamp)}</p>
              </div>
              <div>
                <label className="text-neutral-500">Usuario</label>
                <p className="text-white">
                  {selectedLog.actor_name || selectedLog.actor_email || 'Sistema'}
                </p>
              </div>
              <div>
                <label className="text-neutral-500">IP</label>
                <p className="text-white font-mono">
                  {selectedLog.actor_ip || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-neutral-500">Acción</label>
                <p className={cn('capitalize', getActionColor(selectedLog.action))}>
                  {selectedLog.action_display || selectedLog.action.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <label className="text-neutral-500">Entidad</label>
                <p className="text-white">{selectedLog.entity_repr || selectedLog.entity_type}</p>
              </div>
              <div>
                <label className="text-neutral-500">ID Entidad</label>
                <p className="text-white font-mono">{selectedLog.entity_id}</p>
              </div>
            </div>

            {selectedLog.before_state && (
              <div>
                <label className="text-neutral-500 text-sm">Estado anterior</label>
                <pre className="mt-1 p-3 bg-neutral-800 rounded-lg text-sm text-neutral-300 overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.before_state, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.after_state && (
              <div>
                <label className="text-neutral-500 text-sm">Estado posterior</label>
                <pre className="mt-1 p-3 bg-neutral-800 rounded-lg text-sm text-neutral-300 overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.after_state, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.diff && (
              <div>
                <label className="text-neutral-500 text-sm">Cambios</label>
                <pre className="mt-1 p-3 bg-neutral-800 rounded-lg text-sm text-green-400 overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.diff, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.actor_user_agent && (
              <div>
                <label className="text-neutral-500 text-sm">User Agent</label>
                <p className="text-xs text-neutral-400 break-all mt-1">
                  {selectedLog.actor_user_agent}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
