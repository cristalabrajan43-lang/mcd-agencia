export const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  queued: 'En cola',
  preparing: 'Preparando',
  in_production: 'En proceso',
  quality_check: 'Control de calidad',
  released: 'Listo para entrega',
  blocked: 'Bloqueado',
  cancelled: 'Cancelado',
};

export const PRODUCTION_STATUS_TONES: Record<string, string> = {
  queued: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  preparing: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  in_production: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  quality_check: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  released: 'bg-green-500/20 text-green-300 border-green-500/30',
  blocked: 'bg-red-500/20 text-red-300 border-red-500/30',
  cancelled: 'bg-neutral-700 text-neutral-300 border-neutral-600',
};

export const OPERATIONAL_ROLLUP_LABELS: Record<string, string> = {
  planned: 'Planeado',
  in_execution: 'En ejecución',
  awaiting_finalization: 'Por finalizar',
  completed: 'Completado',
  on_hold: 'En pausa',
};

export const ORDER_ORIGIN_LABELS: Record<string, string> = {
  quote_conversion: 'Cotización',
  direct_purchase: 'Compra directa',
  manual: 'Manual',
};
