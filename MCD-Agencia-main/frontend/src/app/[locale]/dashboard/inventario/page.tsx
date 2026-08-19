'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
  FunnelIcon,
  ArrowsRightLeftIcon,
  ClockIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

import {
  getMovements,
  getMovementsByVariant,
  createMovement,
  getActiveAlerts,
  getAlertCounts,
  acknowledgeAlert,
  resolveAlert,
  getStockSummary,
  getLowStockReport,
  getInventoryValueReport,
  type StockMovement,
  type StockAlert,
  type StockSummaryItem,
  type CreateMovementData,
  type AlertCounts,
  type LowStockReport,
  type InventoryValueReport,
} from '@/lib/api/inventory';
import { getProductById, type Product } from '@/lib/api/catalog';
import { createProduct, updateProductVariant } from '@/lib/api/admin';
import { Card, Button, Input, Modal, Badge, LoadingPage } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────────
type InventoryTab = 'summary' | 'movements' | 'alerts';

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  ADJUSTMENT: 'Ajuste',
};

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  IN: 'text-green-400',
  OUT: 'text-red-400',
  ADJUSTMENT: 'text-yellow-400',
};

const REASON_LABELS: Record<string, string> = {
  purchase: 'Compra a proveedor',
  return: 'Devolución de cliente',
  production: 'Producción interna',
  transfer_in: 'Transferencia entrante',
  sale: 'Venta (legacy)',
  shipment: 'Salida por envío',
  internal_use: 'Uso interno',
  damaged: 'Dañado/Defectuoso',
  expired: 'Expirado',
  lost: 'Perdido/Extraviado',
  transfer_out: 'Transferencia saliente',
  inventory_count: 'Conteo de inventario',
  correction: 'Corrección de error',
  initial: 'Stock inicial',
};

const IN_REASONS = ['purchase', 'return', 'production', 'transfer_in'];
const OUT_REASONS = ['sale', 'shipment', 'internal_use', 'damaged', 'expired', 'lost', 'transfer_out'];
const ADJUSTMENT_REASONS = ['inventory_count', 'correction', 'initial'];

function formatMoney(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StockStatusBadge({ item }: { item: StockSummaryItem }) {
  if (item.stock_status === 'out_of_stock' || item.is_out_of_stock) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium text-rose-300">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        {item.stock_status_display || 'Sin existencias'}
      </span>
    );
  }
  if (item.stock_status === 'low_stock' || item.is_low_stock) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-300">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        {item.stock_status_display || 'Stock bajo'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      {item.stock_status_display || 'En existencia'}
    </span>
  );
}

function formatLastMovement(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<InventoryTab>('summary');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const variantToOpen = searchParams.get('variant');

  const { data: summary = [], isLoading: l1, isError: summaryError } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: getStockSummary,
  });
  const { data: alertCounts, isLoading: l2 } = useQuery({
    queryKey: ['inventory-alert-counts'],
    queryFn: getAlertCounts,
  });
  const { data: lowStock, isLoading: l3 } = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: getLowStockReport,
  });
  const { data: valueReport } = useQuery({
    queryKey: ['inventory-value'],
    queryFn: getInventoryValueReport,
  });

  const isLoadingData = l1 || l2 || l3;

  const outOfStock = summary.filter((s) => s.is_out_of_stock).length;
  const lowStockCount = lowStock?.count ?? 0;
  const activeAlerts = alertCounts?.active ?? 0;

  const tabs: { id: InventoryTab; label: string; badge?: number }[] = [
    { id: 'summary', label: '📊 Resumen de Stock' },
    { id: 'movements', label: '📦 Movimientos' },
    { id: 'alerts', label: '⚠️ Alertas', badge: activeAlerts },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventario</h1>
          <p className="text-neutral-400 text-sm">Gestiona stock, entradas, salidas y alertas de inventario</p>
        </div>
        <Button
          onClick={() => setShowAddProduct(true)}
          size="lg"
          className="flex-shrink-0 w-full sm:w-auto shadow-lg shadow-cyan-500/20"
        >
          <PlusIcon className="h-5 w-5 mr-1" /> Agregar producto
        </Button>
      </div>

      {summaryError && (
        <Card className="p-4 border border-red-500/40 bg-red-500/10">
          <p className="text-sm text-red-300">
            No se pudo cargar el inventario. Verifica que iniciaste sesión como administrador o ventas.
          </p>
        </Card>
      )}

      {isLoadingData ? (
        <LoadingPage message="Cargando inventario..." />
      ) : (
        <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <ArchiveBoxIcon className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{summary.length}</p>
              <p className="text-xs text-neutral-400">Productos con inventario</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircleIcon className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                ${valueReport?.total_value?.toLocaleString('es-MX', { minimumFractionDigits: 0 }) ?? '0'}
              </p>
              <p className="text-xs text-neutral-400">Valor total</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{lowStockCount}</p>
              <p className="text-xs text-neutral-400">Stock bajo</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{outOfStock}</p>
              <p className="text-xs text-neutral-400">Sin existencias</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800 pb-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('px-3 sm:px-4 py-2 rounded-lg transition-colors whitespace-nowrap text-xs sm:text-sm flex items-center gap-2',
              activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white')}>
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <SummaryTab
          summary={summary}
          lowStock={lowStock}
          valueReport={valueReport}
          locale={locale}
          variantToOpen={variantToOpen}
          queryClient={queryClient}
        />
      )}
      {activeTab === 'movements' && <MovementsTab queryClient={queryClient} />}
      {activeTab === 'alerts' && <AlertsTab queryClient={queryClient} />}
        </>
      )}

      {showAddProduct && (
        <AddProductModal
          queryClient={queryClient}
          onClose={() => setShowAddProduct(false)}
        />
      )}
    </div>
  );
}

function invalidateInventoryQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  variantId?: string,
) {
  queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
  queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
  queryClient.invalidateQueries({ queryKey: ['inventory-value'] });
  queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
  queryClient.invalidateQueries({ queryKey: ['inventory-alert-counts'] });
  if (variantId) {
    queryClient.invalidateQueries({ queryKey: ['inventory-movements-by-variant', variantId] });
  }
}

function EditableStockCell({
  item,
  queryClient,
}: {
  item: StockSummaryItem;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [stockValue, setStockValue] = useState(String(item.current_stock));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setStockValue(String(item.current_stock));
  }, [item.current_stock]);

  const adjustStockMut = useMutation({
    mutationFn: (targetStock: number) =>
      createMovement({
        variant_id: item.variant_id,
        movement_type: 'ADJUSTMENT',
        quantity: targetStock,
        reason: 'inventory_count',
        notes: 'Ajuste de stock desde tabla',
      }),
    onSuccess: () => {
      toast.success('Stock actualizado');
      setIsEditing(false);
      invalidateInventoryQueries(queryClient, item.variant_id);
    },
    onError: (err: { message?: string }) => toast.error(err?.message || 'No se pudo actualizar'),
  });

  const save = () => {
    const target = Number(stockValue);
    if (Number.isNaN(target) || target < 0) {
      toast.error('Cantidad inválida');
      return;
    }
    if (target === item.current_stock) {
      setIsEditing(false);
      return;
    }
    adjustStockMut.mutate(target);
  };

  if (isEditing) {
    return (
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          min="0"
          value={stockValue}
          onChange={(e) => setStockValue(e.target.value)}
          className="w-14 h-8 rounded border border-cyan-500/50 bg-neutral-900 text-white text-sm text-center"
        />
        <button type="button" onClick={save} className="text-[10px] text-cyan-400 px-1">OK</button>
        <button type="button" onClick={() => setIsEditing(false)} className="text-[10px] text-neutral-500 px-1">✕</button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      title="Clic para editar stock"
      className={cn(
        'text-sm font-semibold tabular-nums hover:underline',
        item.is_out_of_stock ? 'text-red-400' : item.is_low_stock ? 'text-amber-400' : 'text-emerald-400',
      )}
    >
      {item.current_stock}
    </button>
  );
}

function EntradasQuickCell({
  item,
  queryClient,
}: {
  item: StockSummaryItem;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [qty, setQty] = useState('1');
  const [open, setOpen] = useState(false);

  const entryMut = useMutation({
    mutationFn: (amount: number) =>
      createMovement({
        variant_id: item.variant_id,
        movement_type: 'IN',
        quantity: amount,
        reason: 'purchase',
        notes: 'Entrada rápida',
      }),
    onSuccess: () => {
      toast.success('Entrada registrada');
      setQty('1');
      setOpen(false);
      invalidateInventoryQueries(queryClient, item.variant_id);
    },
    onError: (err: { message?: string }) => toast.error(err?.message || 'Error al registrar entrada'),
  });

  return (
    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      <span className="text-sm font-medium text-emerald-400 tabular-nums">{item.total_in}</span>
      {open ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-12 h-7 rounded border border-neutral-600 bg-neutral-900 text-white text-xs text-center"
          />
          <button
            type="button"
            onClick={() => {
              const n = Number(qty);
              if (n > 0) entryMut.mutate(n);
            }}
            className="text-[10px] text-emerald-400 font-medium"
          >
            OK
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Registrar entrada"
          className="p-1 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function InventoryRowActions({
  onMovement,
  onHistory,
}: {
  onMovement: () => void;
  onHistory: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <button
        type="button"
        title="Movimiento (entrada / salida)"
        onClick={onMovement}
        className="h-8 w-8 rounded-md bg-sky-600 text-white hover:bg-sky-500 flex items-center justify-center shadow-sm"
      >
        <ArrowsRightLeftIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Historial"
        onClick={onHistory}
        className="h-8 w-8 rounded-md border border-neutral-600 bg-neutral-800 text-neutral-200 hover:bg-neutral-700 flex items-center justify-center"
      >
        <ClockIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Alertas de stock"
        onClick={onMovement}
        className="h-8 w-8 rounded-md bg-amber-500/90 text-white hover:bg-amber-400 flex items-center justify-center shadow-sm"
      >
        <BellAlertIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProductInventorySummaryTable({ item }: { item: StockSummaryItem }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-700">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-slate-800 text-slate-200">
            <th className="text-left px-3 py-2 text-xs font-semibold">Tipo</th>
            <th className="text-right px-3 py-2 text-xs font-semibold">Costo</th>
            <th className="text-right px-3 py-2 text-xs font-semibold">Precio venta</th>
            <th className="text-right px-3 py-2 text-xs font-semibold">Stock actual</th>
            <th className="text-center px-3 py-2 text-xs font-semibold">Estado</th>
            <th className="text-right px-3 py-2 text-xs font-semibold">Inicial</th>
            <th className="text-right px-3 py-2 text-xs font-semibold">Entradas</th>
            <th className="text-right px-3 py-2 text-xs font-semibold">Salidas</th>
            <th className="text-right px-3 py-2 text-xs font-semibold">Mínimo</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-neutral-900/60">
            <td className="px-3 py-3 text-neutral-200">{item.sale_mode_display}</td>
            <td className="px-3 py-3 text-right text-neutral-300 tabular-nums">{formatMoney(item.cost)}</td>
            <td className="px-3 py-3 text-right text-white font-medium tabular-nums">{formatMoney(item.sale_price)}</td>
            <td className={cn(
              'px-3 py-3 text-right font-bold tabular-nums',
              item.is_out_of_stock ? 'text-red-400' : item.is_low_stock ? 'text-amber-400' : 'text-emerald-400',
            )}>
              {item.current_stock}
            </td>
            <td className="px-3 py-3 text-center"><StockStatusBadge item={item} /></td>
            <td className="px-3 py-3 text-right text-neutral-400 tabular-nums">{item.initial_stock}</td>
            <td className="px-3 py-3 text-right text-emerald-400 font-medium tabular-nums">{item.total_in}</td>
            <td className="px-3 py-3 text-right text-red-400 font-medium tabular-nums">{item.total_out}</td>
            <td className="px-3 py-3 text-right text-neutral-400 tabular-nums">{item.low_stock_threshold}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY TAB
// ═══════════════════════════════════════════════════════════════════════════
function SummaryTab({ summary, lowStock, valueReport, locale, variantToOpen, queryClient }: {
  summary: StockSummaryItem[];
  lowStock?: LowStockReport;
  valueReport?: InventoryValueReport;
  locale: string;
  variantToOpen?: string | null;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<StockSummaryItem | null>(null);
  const [modalFocus, setModalFocus] = useState<'movement' | 'history'>('movement');

  const openItem = (item: StockSummaryItem, focus: 'movement' | 'history' = 'movement') => {
    setModalFocus(focus);
    setSelectedItem(item);
  };

  useEffect(() => {
    if (!variantToOpen || selectedItem || summary.length === 0) return;
    const found = summary.find((item) => item.variant_id === variantToOpen);
    if (found) {
      openItem(found, 'movement');
      setFilter('all');
    }
  }, [variantToOpen, summary, selectedItem]);

  const filtered = summary.filter((item) => {
    if (filter === 'low' && !(item.is_low_stock && !item.is_out_of_stock)) return false;
    if (filter === 'out' && !item.is_out_of_stock) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        item.product_name.toLowerCase().includes(q)
        || item.sku.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Value by category */}
      {valueReport && Object.keys(valueReport.by_category).length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-neutral-200 mb-3">Valor por categoría</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(valueReport.by_category).map(([cat, data]) => (
              <div key={cat} className="bg-neutral-800/50 rounded-lg p-3">
                <p className="text-sm font-medium text-white">{cat}</p>
                <p className="text-lg font-bold text-cyan-400">${data.value.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</p>
                <p className="text-xs text-neutral-500">{data.items} unidades</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('all')}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === 'all' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-neutral-800 text-neutral-400 hover:text-white')}>
            Todos ({summary.length})
          </button>
          <button onClick={() => setFilter('low')}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === 'low' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-800 text-neutral-400 hover:text-white')}>
            Stock bajo ({lowStock?.count ?? 0})
          </button>
          <button onClick={() => setFilter('out')}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === 'out' ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-400 hover:text-white')}>
            Sin existencias ({summary.filter(s => s.is_out_of_stock).length})
          </button>
        </div>
        <div className="relative sm:ml-auto sm:max-w-xs w-full">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o SKU..."
            className="w-full h-9 rounded-lg border border-neutral-700 bg-neutral-900 pl-3 pr-3 text-sm text-white placeholder:text-neutral-500"
          />
        </div>
      </div>

      {/* Stock table */}
      {filtered.length === 0 ? (
        <Card className="text-center py-12">
          <ArchiveBoxIcon className="h-12 w-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">No hay productos con inventario rastreado</p>
          <p className="text-xs text-neutral-500 mt-2">Usa el botón &quot;Agregar producto&quot; arriba para comenzar</p>
        </Card>
      ) : (
        <>
          {/* Desktop table — estilo referencia */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-neutral-700 shadow-sm">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="bg-slate-800 text-slate-100">
                  <th className="text-left text-xs font-semibold px-3 py-3">Producto</th>
                  <th className="text-left text-xs font-semibold px-3 py-3">Tipo</th>
                  <th className="text-right text-xs font-semibold px-3 py-3">Costo</th>
                  <th className="text-right text-xs font-semibold px-3 py-3">Precio venta</th>
                  <th className="text-right text-xs font-semibold px-3 py-3">Stock actual</th>
                  <th className="text-center text-xs font-semibold px-3 py-3">Estado</th>
                  <th className="text-right text-xs font-semibold px-3 py-3">Stock inicial</th>
                  <th className="text-right text-xs font-semibold px-3 py-3">Entradas</th>
                  <th className="text-right text-xs font-semibold px-3 py-3">Salidas</th>
                  <th className="text-right text-xs font-semibold px-3 py-3">Mínimo</th>
                  <th className="text-center text-xs font-semibold px-3 py-3">Último movimiento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => (
                  <tr
                    key={item.variant_id}
                    className={cn(
                      'border-t border-neutral-800/80 hover:bg-neutral-800/40 transition-colors',
                      index % 2 === 0 ? 'bg-neutral-900/40' : 'bg-neutral-900/20',
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => openItem(item)} className="text-left group">
                        <p className="text-sm font-medium text-white group-hover:text-cyan-300">{item.product_name}</p>
                        <p className="text-[11px] text-cyan-400/90 font-mono">{item.sku}</p>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-neutral-300">{item.sale_mode_display}</td>
                    <td className="px-3 py-2.5 text-right text-neutral-300 tabular-nums">{formatMoney(item.cost)}</td>
                    <td className="px-3 py-2.5 text-right text-white tabular-nums">{formatMoney(item.sale_price)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <EditableStockCell item={item} queryClient={queryClient} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StockStatusBadge item={item} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-neutral-400 tabular-nums">{item.initial_stock}</td>
                    <td className="px-3 py-2.5 text-right">
                      <EntradasQuickCell item={item} queryClient={queryClient} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-medium text-red-400 tabular-nums">{item.total_out}</td>
                    <td className="px-3 py-2.5 text-right text-neutral-500 tabular-nums">{item.low_stock_threshold}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-center gap-1">
                        <InventoryRowActions
                          onMovement={() => openItem(item, 'movement')}
                          onHistory={() => openItem(item, 'history')}
                        />
                        <span className="text-[10px] text-neutral-500">{formatLastMovement(item.last_movement_date)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((item) => (
              <Card key={item.variant_id} className="p-3 space-y-3 border border-neutral-700">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => openItem(item)} className="text-left min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{item.product_name}</p>
                    <p className="text-[11px] text-cyan-400 font-mono">{item.sku}</p>
                  </button>
                  <StockStatusBadge item={item} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md bg-neutral-800/60 p-2 text-center">
                    <p className="text-neutral-500">Stock</p>
                    <p className={cn('font-bold text-lg tabular-nums',
                      item.is_out_of_stock ? 'text-red-400' : 'text-emerald-400')}>{item.current_stock}</p>
                  </div>
                  <div className="rounded-md bg-neutral-800/60 p-2 text-center">
                    <p className="text-neutral-500">Entradas</p>
                    <p className="font-bold text-lg text-emerald-400 tabular-nums">{item.total_in}</p>
                  </div>
                  <div className="rounded-md bg-neutral-800/60 p-2 text-center">
                    <p className="text-neutral-500">Salidas</p>
                    <p className="font-bold text-lg text-red-400 tabular-nums">{item.total_out}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800">
                  <div className="text-[11px] text-neutral-500">
                    {formatMoney(item.sale_price)} · Mín. {item.low_stock_threshold}
                  </div>
                  <InventoryRowActions
                    onMovement={() => openItem(item, 'movement')}
                    onHistory={() => openItem(item, 'history')}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1"><EditableStockCell item={item} queryClient={queryClient} /></div>
                  <div className="flex-1 flex justify-end"><EntradasQuickCell item={item} queryClient={queryClient} /></div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {selectedItem && (
        <InventoryItemModal
          item={selectedItem}
          locale={locale}
          queryClient={queryClient}
          initialFocus={modalFocus}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

function AddProductModal({
  queryClient,
  onClose,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    sku: '',
    cost: '',
    sale_price: '',
    initial_stock: '0',
    low_stock_threshold: '5',
    short_description: '',
  });

  const createMut = useMutation({
    mutationFn: () => {
      const salePrice = form.sale_price || form.cost || '0';
      const cost = form.cost || salePrice;
      return createProduct({
        type: 'product',
        name: form.name.trim(),
        short_description: form.short_description.trim() || form.name.trim(),
        sale_mode: 'BUY',
        payment_mode: 'FULL',
        base_price: salePrice,
        compare_at_price: salePrice,
        track_inventory: true,
        is_active: true,
        initial_sku: form.sku.trim().toUpperCase(),
        initial_stock: Number(form.initial_stock || '0'),
        initial_low_stock_threshold: Number(form.low_stock_threshold || '5'),
        initial_cost: cost,
      });
    },
    onSuccess: () => {
      toast.success('Producto agregado al inventario');
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-value'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      onClose();
    },
    onError: (err: { message?: string; data?: Record<string, unknown> }) => {
      const msg = err?.data
        ? Object.values(err.data).flat().join(', ')
        : err?.message || 'No se pudo crear el producto';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!form.sku.trim()) {
      toast.error('El SKU es obligatorio');
      return;
    }
    if (Number(form.initial_stock) < 0 || Number(form.low_stock_threshold) < 0) {
      toast.error('Stock y mínimo deben ser valores positivos');
      return;
    }
    createMut.mutate();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Agregar producto al inventario" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-neutral-400">
          Crea un producto con control de inventario. Podrás registrar entradas y salidas después.
        </p>
        <Input
          label="Nombre del producto"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Ej. Playera personalizada"
          required
        />
        <Input
          label="SKU"
          value={form.sku}
          onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value.toUpperCase() }))}
          placeholder="SKU-001"
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Costo"
            type="number"
            min="0"
            step="0.01"
            value={form.cost}
            onChange={(e) => setForm((prev) => ({ ...prev, cost: e.target.value }))}
            placeholder="0.00"
          />
          <Input
            label="Precio de venta"
            type="number"
            min="0"
            step="0.01"
            value={form.sale_price}
            onChange={(e) => setForm((prev) => ({ ...prev, sale_price: e.target.value }))}
            placeholder="0.00"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Stock inicial"
            type="number"
            min="0"
            value={form.initial_stock}
            onChange={(e) => setForm((prev) => ({ ...prev, initial_stock: e.target.value }))}
          />
          <Input
            label="Mínimo (alerta stock bajo)"
            type="number"
            min="0"
            value={form.low_stock_threshold}
            onChange={(e) => setForm((prev) => ({ ...prev, low_stock_threshold: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Descripción breve (opcional)</label>
          <textarea
            value={form.short_description}
            onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))}
            rows={2}
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm resize-none"
            placeholder="Descripción corta del producto"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? 'Guardando...' : 'Agregar producto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function InventoryItemModal({
  item,
  locale,
  queryClient,
  initialFocus = 'movement',
  onClose,
}: {
  item: StockSummaryItem;
  locale: string;
  queryClient: ReturnType<typeof useQueryClient>;
  initialFocus?: 'movement' | 'history';
  onClose: () => void;
}) {
  const [movementType, setMovementType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('purchase');
  const [notes, setNotes] = useState('');
  const [editableSku, setEditableSku] = useState(item.sku);
  const [editableThreshold, setEditableThreshold] = useState(item.low_stock_threshold);
  const [editableCost, setEditableCost] = useState(String(item.cost ?? 0));
  const [editablePrice, setEditablePrice] = useState(String(item.sale_price ?? 0));
  const [activePanel, setActivePanel] = useState<'movement' | 'history'>(initialFocus);

  const { data: productDetail } = useQuery({
    queryKey: ['inventory-product-detail', item.product_id],
    queryFn: () => getProductById(item.product_id),
  });

  const currentVariant = productDetail?.variants?.find((variant) => variant.id === item.variant_id);

  const { data: movementData, isLoading: movementsLoading } = useQuery({
    queryKey: ['inventory-movements-by-variant', item.variant_id],
    queryFn: () => getMovementsByVariant(item.variant_id),
  });

  useEffect(() => {
    if (movementType === 'IN') setReason('purchase');
    if (movementType === 'OUT') setReason('sale');
    if (movementType === 'ADJUSTMENT') setReason('inventory_count');
  }, [movementType]);

  useEffect(() => {
    setEditableSku(currentVariant?.sku || item.sku);
    setEditableThreshold(currentVariant?.low_stock_threshold ?? item.low_stock_threshold);
    setEditableCost(String(currentVariant?.cost ?? item.cost ?? 0));
    setEditablePrice(String(currentVariant?.price ?? item.sale_price ?? 0));
  }, [currentVariant, item.sku, item.low_stock_threshold, item.cost, item.sale_price]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const variantSku = currentVariant?.sku || item.sku;
      const variantThreshold = currentVariant?.low_stock_threshold ?? item.low_stock_threshold;
      const variantCost = String(currentVariant?.cost ?? item.cost ?? 0);
      const variantPrice = String(currentVariant?.price ?? item.sale_price ?? 0);
      const skuChanged = editableSku.trim() !== variantSku;
      const thresholdChanged = editableThreshold !== variantThreshold;
      const costChanged = editableCost.trim() !== variantCost;
      const priceChanged = editablePrice.trim() !== variantPrice;
      const hasMovement = quantity > 0;

      if (!skuChanged && !thresholdChanged && !costChanged && !priceChanged && !hasMovement && !notes.trim()) {
        throw new Error('No hay cambios para guardar');
      }

      if (skuChanged || thresholdChanged || costChanged || priceChanged) {
        await updateProductVariant(item.variant_id, {
          sku: editableSku.trim().toUpperCase(),
          low_stock_threshold: editableThreshold,
          ...(costChanged ? { cost: editableCost } : {}),
          ...(priceChanged ? { price: editablePrice } : {}),
        });
      }

      if (hasMovement) {
        await createMovement({
          variant_id: item.variant_id,
          movement_type: movementType,
          quantity,
          reason,
          notes,
        });
      }
    },
    onSuccess: () => {
      toast.success('Cambios de inventario guardados');
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-value'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements-by-variant', item.variant_id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alert-counts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-product-detail', item.product_id] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setNotes('');
      setQuantity(0);
    },
    onError: (err: { message?: string; data?: Record<string, unknown> }) => {
      if (err?.message === 'No hay cambios para guardar') {
        toast('No hay cambios para guardar', { icon: 'ℹ️' });
        return;
      }
      const msg = err?.data
        ? Object.values(err.data).flat().join(', ')
        : err?.message || 'No se pudieron guardar los cambios';
      toast.error(msg);
    },
  });

  const submitChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editableSku.trim()) {
      toast.error('El SKU no puede quedar vacío');
      return;
    }
    if (editableThreshold < 0) {
      toast.error('El umbral no puede ser negativo');
      return;
    }

    saveMut.mutate();
  };

  const movements = movementData?.results ?? [];

  useEffect(() => {
    setActivePanel(initialFocus);
  }, [initialFocus]);

  return (
    <Modal isOpen={true} onClose={onClose} title={item.product_name} size="full">
      <div className="space-y-5">
        {/* Encabezado producto */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-800 border border-neutral-700 flex-shrink-0">
            {(productDetail as Product | undefined)?.images?.[0]?.image ? (
              <img
                src={(productDetail as Product).images[0].image}
                alt={item.product_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">Sin imagen</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-white">{item.product_name}</p>
            <p className="text-sm text-cyan-400 font-mono">{editableSku}</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {productDetail?.category?.name || 'Sin categoría'} · Último mov.: {formatLastMovement(item.last_movement_date)}
            </p>
          </div>
          <Link href={`/${locale}/dashboard/catalogo?edit=${item.product_id}`}>
            <Button size="sm" variant="outline">Editar en catálogo</Button>
          </Link>
        </div>

        {/* Tabla resumen — igual que la referencia */}
        <ProductInventorySummaryTable item={item} />

        {/* Acciones rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => { setMovementType('IN'); setActivePanel('movement'); }}
            className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20"
          >
            <ArrowDownTrayIcon className="h-5 w-5" /> Registrar entrada
          </button>
          <button
            type="button"
            onClick={() => { setMovementType('OUT'); setActivePanel('movement'); }}
            className="flex items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-500/20"
          >
            <ArrowUpTrayIcon className="h-5 w-5" /> Registrar salida
          </button>
          <button
            type="button"
            onClick={() => setActivePanel('history')}
            className="flex items-center justify-center gap-2 rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-3 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
          >
            <ClockIcon className="h-5 w-5" /> Ver historial
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex gap-2 border-b border-neutral-800 pb-2">
          <button
            type="button"
            onClick={() => setActivePanel('movement')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activePanel === 'movement' ? 'bg-cyan-500/20 text-cyan-400' : 'text-neutral-400 hover:text-white')}
          >
            Movimiento
          </button>
          <button
            type="button"
            onClick={() => setActivePanel('history')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activePanel === 'history' ? 'bg-cyan-500/20 text-cyan-400' : 'text-neutral-400 hover:text-white')}
          >
            Historial ({movements.length})
          </button>
        </div>

        {activePanel === 'movement' ? (
        <form onSubmit={submitChanges} className="rounded-lg border border-neutral-700 p-4 space-y-4">
          <h4 className="text-sm font-semibold text-neutral-200">Registrar movimiento</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Costo</label>
              <input type="number" min="0" step="0.01" value={editableCost} onChange={(e) => setEditableCost(e.target.value)}
                className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Precio venta</label>
              <input type="number" min="0" step="0.01" value={editablePrice} onChange={(e) => setEditablePrice(e.target.value)}
                className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">SKU</label>
              <input value={editableSku} onChange={(e) => setEditableSku(e.target.value.toUpperCase())}
                className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Mínimo (alerta)</label>
              <input type="number" min="0" value={String(editableThreshold)} onChange={(e) => setEditableThreshold(Number(e.target.value || 0))}
                className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Tipo</label>
              <select value={movementType} onChange={(e) => setMovementType(e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT')}
                className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 text-sm">
                <option value="IN">Entrada (+ stock)</option>
                <option value="OUT">Salida (− stock)</option>
                <option value="ADJUSTMENT">Ajuste (fijar total)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                {movementType === 'ADJUSTMENT' ? 'Stock final deseado' : 'Cantidad'}
              </label>
              <input type="number" min="0" value={String(quantity)} onChange={(e) => setQuantity(Number(e.target.value || 0))}
                className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Motivo</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 text-sm">
                {(movementType === 'IN' ? IN_REASONS : movementType === 'OUT' ? OUT_REASONS : ADJUSTMENT_REASONS).map((r) => (
                  <option key={r} value={r}>{REASON_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Notas (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm resize-none"
              placeholder="Proveedor, folio, motivo..." />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
        ) : (
        <div id="inventory-movement-history" className="rounded-lg border border-neutral-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-200">
                <th className="text-left px-3 py-2 text-xs font-semibold">Fecha</th>
                <th className="text-left px-3 py-2 text-xs font-semibold">Tipo</th>
                <th className="text-right px-3 py-2 text-xs font-semibold">Cantidad</th>
                <th className="text-left px-3 py-2 text-xs font-semibold">Motivo</th>
                <th className="text-right px-3 py-2 text-xs font-semibold">Antes → Después</th>
              </tr>
            </thead>
            <tbody>
              {movementsLoading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Cargando...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-500">Sin movimientos</td></tr>
              ) : movements.map((mov, i) => (
                <tr key={mov.id} className={cn('border-t border-neutral-800', i % 2 === 0 ? 'bg-neutral-900/30' : '')}>
                  <td className="px-3 py-2 text-xs text-neutral-300">
                    {new Date(mov.created_at).toLocaleString('es-MX')}
                  </td>
                  <td className={cn('px-3 py-2 text-xs font-medium', MOVEMENT_TYPE_COLORS[mov.movement_type])}>
                    {MOVEMENT_TYPE_LABELS[mov.movement_type]}
                  </td>
                  <td className={cn('px-3 py-2 text-right font-semibold tabular-nums',
                    mov.quantity > 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-400">{REASON_LABELS[mov.reason] || mov.reason}</td>
                  <td className="px-3 py-2 text-right text-xs text-neutral-500 tabular-nums">
                    {mov.stock_before} → {mov.stock_after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MOVEMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════
function MovementsTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [showModal, setShowModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['inventory-movements', typeFilter, page],
    queryFn: () => getMovements({ movement_type: typeFilter || undefined, page }),
  });

  const movements = movementsData?.results ?? [];
  const totalPages = Math.ceil((movementsData?.count ?? 0) / 20);

  const [form, setForm] = useState<CreateMovementData>({
    variant_id: '',
    movement_type: 'IN',
    quantity: 1,
    reason: 'purchase',
    notes: '',
  });

  const createMut = useMutation({
    mutationFn: createMovement,
    onSuccess: () => {
      toast.success('Movimiento registrado');
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-value'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alert-counts'] });
      setShowModal(false);
    },
    onError: (err: { message?: string; data?: Record<string, unknown> }) => {
      const msg = err?.data
        ? Object.values(err.data).flat().join(', ')
        : err?.message || 'Error al registrar movimiento';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.variant_id) { toast.error('Ingresa el ID del registro de inventario'); return; }
    createMut.mutate(form);
  };

  const getReasons = () => {
    if (form.movement_type === 'IN') return IN_REASONS;
    if (form.movement_type === 'OUT') return OUT_REASONS;
    return ADJUSTMENT_REASONS;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FunnelIcon className="h-4 w-4 text-neutral-400" />
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-1.5 text-xs">
            <option value="">Todos los tipos</option>
            <option value="IN">Entradas</option>
            <option value="OUT">Salidas</option>
            <option value="ADJUSTMENT">Ajustes</option>
          </select>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex-shrink-0">
          <PlusIcon className="h-5 w-5 mr-1" /> Nuevo Movimiento
        </Button>
      </div>

      {isLoading ? (
        <Card className="text-center py-12">
          <p className="text-neutral-400">Cargando movimientos...</p>
        </Card>
      ) : movements.length === 0 ? (
        <Card className="text-center py-12">
          <ArchiveBoxIcon className="h-12 w-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">No hay movimientos registrados</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowModal(true)}>Registrar primer movimiento</Button>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/50">
                    <th className="text-left text-xs font-medium text-neutral-400 px-4 py-3">Fecha</th>
                    <th className="text-left text-xs font-medium text-neutral-400 px-4 py-3">Tipo</th>
                    <th className="text-left text-xs font-medium text-neutral-400 px-4 py-3">SKU</th>
                    <th className="text-right text-xs font-medium text-neutral-400 px-4 py-3">Cant.</th>
                    <th className="text-left text-xs font-medium text-neutral-400 px-4 py-3">Razón</th>
                    <th className="text-right text-xs font-medium text-neutral-400 px-4 py-3">Antes</th>
                    <th className="text-right text-xs font-medium text-neutral-400 px-4 py-3">Después</th>
                    <th className="text-left text-xs font-medium text-neutral-400 px-4 py-3">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mov) => (
                    <tr key={mov.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                      <td className="px-4 py-3 text-xs text-neutral-400">
                        {new Date(mov.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-semibold flex items-center gap-1', MOVEMENT_TYPE_COLORS[mov.movement_type])}>
                          {mov.movement_type === 'IN' && <ArrowDownTrayIcon className="h-3.5 w-3.5" />}
                          {mov.movement_type === 'OUT' && <ArrowUpTrayIcon className="h-3.5 w-3.5" />}
                          {mov.movement_type === 'ADJUSTMENT' && <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />}
                          {MOVEMENT_TYPE_LABELS[mov.movement_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-cyan-400 font-mono">{mov.variant?.sku || '—'}</td>
                      <td className={cn('px-4 py-3 text-sm text-right font-semibold', MOVEMENT_TYPE_COLORS[mov.movement_type])}>
                        {mov.movement_type === 'IN' ? '+' : mov.movement_type === 'OUT' ? '-' : '±'}{Math.abs(mov.quantity)}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-400">{mov.notes || REASON_LABELS[mov.reason] || mov.reason}</td>
                      <td className="px-4 py-3 text-xs text-right text-neutral-500">{mov.stock_before}</td>
                      <td className="px-4 py-3 text-xs text-right text-white font-medium">{mov.stock_after}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500 max-w-[200px] truncate">{mov.reference_id ? `#${mov.reference_id.slice(0, 8)}…` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {movements.map((mov) => (
              <Card key={mov.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs font-semibold flex items-center gap-1', MOVEMENT_TYPE_COLORS[mov.movement_type])}>
                        {mov.movement_type === 'IN' && <ArrowDownTrayIcon className="h-3.5 w-3.5" />}
                        {mov.movement_type === 'OUT' && <ArrowUpTrayIcon className="h-3.5 w-3.5" />}
                        {mov.movement_type === 'ADJUSTMENT' && <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />}
                        {MOVEMENT_TYPE_LABELS[mov.movement_type]}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {new Date(mov.created_at).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                    <p className="text-xs text-cyan-400 font-mono">{mov.variant?.sku || '—'}</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{REASON_LABELS[mov.reason] || mov.reason}</p>
                    {mov.notes && <p className="text-[10px] text-neutral-600 mt-0.5 truncate">{mov.notes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn('text-lg font-bold', MOVEMENT_TYPE_COLORS[mov.movement_type])}>
                      {mov.movement_type === 'IN' ? '+' : mov.movement_type === 'OUT' ? '-' : '±'}{Math.abs(mov.quantity)}
                    </p>
                    <p className="text-[10px] text-neutral-500">{mov.stock_before} → {mov.stock_after}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-neutral-400 px-3 py-1">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          )}
        </>
      )}

      {/* New Movement Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Movimiento de Inventario" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="ID de inventario"
            value={form.variant_id}
            onChange={(e) => setForm({ ...form, variant_id: e.target.value })}
            placeholder="UUID del registro de inventario"
            required
          />

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Tipo de movimiento <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {(['IN', 'OUT', 'ADJUSTMENT'] as const).map((type) => (
                <button key={type} type="button"
                  onClick={() => {
                    const reasons = type === 'IN' ? IN_REASONS : type === 'OUT' ? OUT_REASONS : ADJUSTMENT_REASONS;
                    setForm({ ...form, movement_type: type, reason: reasons[0] });
                  }}
                  className={cn('py-2 rounded-lg text-xs font-semibold transition-all border',
                    form.movement_type === type
                      ? type === 'IN' ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : type === 'OUT' ? 'bg-red-500/20 border-red-500/50 text-red-400'
                        : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white')}>
                  {type === 'IN' && '📥 Entrada'}
                  {type === 'OUT' && '📤 Salida'}
                  {type === 'ADJUSTMENT' && '🔧 Ajuste'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              label={form.movement_type === 'ADJUSTMENT' ? 'Nuevo stock absoluto' : 'Cantidad'}
              value={form.quantity.toString()}
              onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
              required
            />

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Razón <span className="text-red-400">*</span></label>
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm">
                {getReasons().map((r) => (
                  <option key={r} value={r}>{REASON_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Notas</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm resize-none"
              rows={3} placeholder="Notas adicionales sobre el movimiento..." />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? 'Registrando...' : 'Registrar Movimiento'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS TAB
// ═══════════════════════════════════════════════════════════════════════════
function AlertsTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['inventory-active-alerts'],
    queryFn: getActiveAlerts,
  });

  const ackMut = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      toast.success('Alerta reconocida');
      queryClient.invalidateQueries({ queryKey: ['inventory-active-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alert-counts'] });
    },
    onError: () => toast.error('Error al reconocer alerta'),
  });

  const resolveMut = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      toast.success('Alerta resuelta');
      queryClient.invalidateQueries({ queryKey: ['inventory-active-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alert-counts'] });
    },
    onError: () => toast.error('Error al resolver alerta'),
  });

  if (isLoading) return <Card className="text-center py-12"><p className="text-neutral-400">Cargando alertas...</p></Card>;

  if (alerts.length === 0) {
    return (
      <Card className="text-center py-12">
        <CheckCircleIcon className="h-12 w-12 mx-auto text-green-500 mb-4" />
        <p className="text-neutral-400">No hay alertas activas — ¡todo en orden!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        {alerts.length} alerta{alerts.length !== 1 ? 's' : ''} activa{alerts.length !== 1 ? 's' : ''} de stock bajo.
      </p>

      <div className="grid gap-3">
        {alerts.map((alert) => (
          <Card key={alert.id} className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{alert.variant?.product_name || 'Producto'}</p>
                <p className="text-xs text-neutral-400">SKU: {alert.variant?.sku}</p>
                <p className="text-xs text-red-400 mt-1">
                  Stock actual: <strong>{alert.current_stock}</strong> · Umbral: {alert.threshold}
                </p>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  Creada: {new Date(alert.created_at).toLocaleDateString('es-MX')}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => ackMut.mutate(alert.id)} disabled={ackMut.isPending}>
                  Reconocer
                </Button>
                <Button size="sm" onClick={() => resolveMut.mutate(alert.id)} disabled={resolveMut.isPending}>
                  Resolver
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
