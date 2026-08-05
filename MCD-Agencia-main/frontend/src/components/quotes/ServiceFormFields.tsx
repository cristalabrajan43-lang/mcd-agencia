'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPinIcon,
  TruckIcon,
  ClockIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';
import {
  SERVICE_IDS,
  ESPECTACULARES_TIPOS,
  FABRICACION_ANUNCIOS_TIPOS,
  PUBLICIDAD_MOVIL_SUBTIPOS,
  GRAN_FORMATO_MATERIALES,
  ROTULACION_TIPOS,
  OFFSET_PRODUCTOS,
  SENALIZACION_TIPOS,
  CNC_LASER_TIPOS,
  DISENO_GRAFICO_TIPOS,
  SERVICE_LABELS,
  type ServiceId,
} from '@/lib/service-ids';

const RouteSelector = dynamic(
  () => import('@/components/landing/RouteSelector').then(mod => mod.RouteSelector),
  {
    ssr: false,
    loading: () => (
      <div className="w-full p-4 rounded-xl border-2 border-dashed border-cmyk-cyan/50 bg-neutral-900/30">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cmyk-cyan" />
          <span className="text-neutral-500 text-sm">Cargando mapa...</span>
        </div>
      </div>
    ),
  }
);

/* ─── Route types ──────────────────────────────────────────────── */
interface RouteInfo {
  pointA: { name: string; lat: number; lon: number } | null;
  pointB: { name: string; lat: number; lon: number } | null;
  routeData: { coordinates: Array<[number, number]>; distance: number; duration: number } | null;
}

export interface ConfigurableRouteEntry {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  horarioInicio: string;
  horarioFin: string;
  route: RouteInfo | null;
  cantidad: number;
  unidad: string;
  unit_price: number;
  /** Vendor-set estimated delivery date for this route */
  estimated_date?: string;
  /** Vendor description / notes for this route */
  vendorDescription?: string;
  /** Read-only info from client request */
  clientRouteInfo?: {
    punto_a?: { name?: string; lat?: number; lon?: number } | null;
    punto_b?: { name?: string; lat?: number; lon?: number } | null;
    distancia_metros?: number | null;
    duracion_segundos?: number | null;
  } | null;
}

export interface EstablishedRouteEntry {
  id: string;
  ruta: string;
  fechaInicio: string;
  cantidad: number;
  unidad: string;
  unit_price: number;
  /** Vendor-set estimated delivery date for this route */
  estimated_date?: string;
  /** Vendor description / notes for this route */
  vendorDescription?: string;
}

const createConfigurableRoute = (): ConfigurableRouteEntry => ({
  id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
  fechaInicio: '',
  fechaFin: '',
  horarioInicio: '',
  horarioFin: '',
  route: null,
  cantidad: 1,
  unidad: 'servicio',
  unit_price: 0,
});

const createEstablishedRoute = (): EstablishedRouteEntry => ({
  id: `er-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
  ruta: '',
  fechaInicio: '',
  cantidad: 1,
  unidad: 'servicio',
  unit_price: 0,
});

const addMonths = (dateStr: string, months: number): string => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};

/* ─── Service details data shape ───────────────────────────────── */
export interface ServiceDetailsData {
  service_type: ServiceId | '';
  [key: string]: unknown;
}

/* ─── Props ─────────────────────────────────────────────────────── */
interface ServiceFormFieldsProps {
  value: ServiceDetailsData;
  onChange: (details: ServiceDetailsData) => void;
  disabled?: boolean;
  /** Hide route pricing fields (Cantidad, Unidad, Precio Unit.) — used in client-facing views */
  hideRoutePricing?: boolean;
  /** Per-route customer comments (route index → comment string) */
  routeComments?: Record<number, string>;
  /** Called when a per-route comment changes */
  onRouteCommentsChange?: (routeComments: Record<number, string>) => void;
}

/* ─── Shared field styles ──────────────────────────────────────── */
const inputCls =
  'w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan text-sm';
const labelCls = 'block text-neutral-400 text-xs mb-1';
const radioCls = 'text-cmyk-cyan';

/* ─── Helpers ──────────────────────────────────────────────────── */
const RadioGroup = ({
  label,
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) => (
  <div>
    <label className={labelCls}>{label}</label>
    <div className="flex flex-wrap gap-3 mt-1">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-1.5 text-white text-sm cursor-pointer"
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className={radioCls}
            disabled={disabled}
          />
          {opt.label}
        </label>
      ))}
    </div>
  </div>
);

/* ─── Route point display (read-only, from client request) ───── */
const RoutePointsDisplay = ({
  routeInfo,
}: {
  routeInfo: ConfigurableRouteEntry['clientRouteInfo'];
}) => {
  if (!routeInfo) return null;
  const { punto_a, punto_b, distancia_metros, duracion_segundos } = routeInfo;
  if (!punto_a && !punto_b) return null;

  return (
    <div className="p-3 bg-neutral-800/50 rounded-lg space-y-2 border border-neutral-700/50">
      {punto_a && (
        <div className="flex items-start gap-2">
          <MapPinIcon className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-neutral-400 text-xs">Inicio de ruta:</span>
            <p className="text-white text-sm break-words">
              {punto_a.name ||
                `${punto_a.lat?.toFixed(5)}, ${punto_a.lon?.toFixed(5)}`}
            </p>
          </div>
        </div>
      )}
      {punto_b && (
        <div className="flex items-start gap-2">
          <MapPinIcon className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-neutral-400 text-xs">Fin de ruta:</span>
            <p className="text-white text-sm break-words">
              {punto_b.name ||
                `${punto_b.lat?.toFixed(5)}, ${punto_b.lon?.toFixed(5)}`}
            </p>
          </div>
        </div>
      )}
      {distancia_metros != null && typeof distancia_metros === 'number' && (
        <div className="flex items-center gap-2 mt-1">
          <TruckIcon className="h-4 w-4 text-cmyk-cyan flex-shrink-0" />
          <span className="text-cmyk-cyan font-medium text-sm">
            {distancia_metros >= 1000
              ? `${(distancia_metros / 1000).toFixed(2)} km`
              : `${distancia_metros.toFixed(0)} m`}
          </span>
        </div>
      )}
      {duracion_segundos != null && typeof duracion_segundos === 'number' && (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-neutral-400 flex-shrink-0" />
          <span className="text-neutral-300 text-sm">
            {Math.round(duracion_segundos / 60)} min aprox.
          </span>
        </div>
      )}
    </div>
  );
};

/* ─── Route pricing row (Cantidad + Unidad + Precio Unit.) ───── */
const RoutePricingRow = ({
  cantidad,
  unidad,
  unitPrice,
  onCantidadChange,
  onUnidadChange,
  onUnitPriceChange,
  disabled,
  formatCurrency,
}: {
  cantidad: number;
  unidad: string;
  unitPrice: number;
  onCantidadChange: (v: number) => void;
  onUnidadChange: (v: string) => void;
  onUnitPriceChange: (v: number) => void;
  disabled?: boolean;
  formatCurrency: (n: number) => string;
}) => {
  // Keep a local string so the user can freely type digits, dots, etc.
  // without React overwriting intermediate states (e.g. "10", "1.50").
  const [priceStr, setPriceStr] = useState<string>(
    unitPrice ? String(unitPrice) : ''
  );

  // Sync from parent when the prop changes externally (e.g. prefill).
  useEffect(() => {
    setPriceStr((prev) => {
      const parsed = parseFloat(prev);
      if (isNaN(parsed) && unitPrice === 0) return prev; // keep empty
      if (parsed === unitPrice) return prev; // already in sync
      return unitPrice ? String(unitPrice) : '';
    });
  }, [unitPrice]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty, digits, and one decimal point
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      setPriceStr(raw);
      const num = parseFloat(raw);
      onUnitPriceChange(isNaN(num) ? 0 : num);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-700/30">
      <div className="flex items-center gap-2">
        <label className="text-neutral-500 text-xs whitespace-nowrap">Cantidad:</label>
        <input
          type="number"
          min="1"
          value={cantidad}
          disabled={disabled}
          onChange={(e) => onCantidadChange(parseInt(e.target.value) || 1)}
          className="w-20 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-center focus:outline-none focus:border-cmyk-cyan text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-neutral-500 text-xs whitespace-nowrap">Unidad:</label>
        <select
          value={unidad}
          disabled={disabled}
          onChange={(e) => onUnidadChange(e.target.value)}
          className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-cmyk-cyan text-sm"
        >
          <option value="pza">pza</option>
          <option value="m2">m²</option>
          <option value="ml">ml</option>
          <option value="kg">kg</option>
          <option value="hr">hr</option>
          <option value="servicio">servicio</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-neutral-500 text-xs whitespace-nowrap">Precio Unit.:</label>
        <input
          type="text"
          inputMode="decimal"
          value={priceStr}
          disabled={disabled}
          onChange={handlePriceChange}
          placeholder="0.00"
          className="w-28 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-right focus:outline-none focus:border-cmyk-cyan text-sm"
        />
      </div>
      <div className="ml-auto">
        <span className="text-white font-medium text-sm">
          {formatCurrency(cantidad * unitPrice)}
        </span>
      </div>
    </div>
  );
};

/* ─── Check if a service type uses route-based pricing ─────── */
export function isRouteBasedService(
  serviceType: string,
  subtipo?: string
): boolean {
  if (serviceType !== 'publicidad-movil') return false;
  return (
    subtipo === 'vallas-moviles' ||
    subtipo === 'publibuses' ||
    subtipo === 'perifoneo'
  );
}

/* ─── Check if a service type manages its own quantity fields ── */
export function serviceHasOwnQuantity(
  serviceType: string,
  subtipo?: string
): boolean {
  // Route-based services manage quantity per route
  if (isRouteBasedService(serviceType, subtipo)) return true;
  // Services that have a "Cantidad" / "Número de piezas" field in ServiceFormFields
  return [
    'impresion-gran-formato',
    'senalizacion',
    'corte-grabado-cnc-laser',
    'diseno-grafico',
    'impresion-offset-serigrafia',
    'otros',
  ].includes(serviceType);
}

/* ─── Check if a ServiceDetailsData object is route-based ──── */
export function isRouteBasedDetails(details: ServiceDetailsData | undefined | null): boolean {
  if (!details) return false;
  // Primary check via type + subtipo
  if (isRouteBasedService(details.service_type, details.subtipo as string | undefined)) return true;
  // Fallback: check if route arrays exist (internal or API-facing)
  const hasInternalRoutes = !!(details._vallasRoutes || details._pubRoutes || details._perifoneoRoutes);
  const rutas = details.rutas as unknown[] | undefined;
  const hasApiRoutes = !!(rutas && rutas.length > 0);
  return hasInternalRoutes || hasApiRoutes;
}

/* ─── Compute total from routes ────────────────────────────── */
export function computeRoutesTotal(details: ServiceDetailsData): number {
  const internalRoutes = (details._vallasRoutes ||
    details._pubRoutes ||
    details._perifoneoRoutes) as
    | Array<{ cantidad?: number; unit_price?: number }>
    | undefined;
  if (internalRoutes && internalRoutes.length > 0) {
    return internalRoutes.reduce(
      (sum, r) => sum + (r.cantidad || 1) * (r.unit_price || 0),
      0
    );
  }
  // Fallback: use the API-facing `rutas` array
  const rutas = details.rutas as
    | Array<{ cantidad?: number; precio_unitario?: number }>
    | undefined;
  if (!rutas) return 0;
  return rutas.reduce(
    (sum, r) => sum + (r.cantidad || 1) * (r.precio_unitario || 0),
    0
  );
}

/* ─── Count number of routes ───────────────────────────────── */
export function countRoutes(details: ServiceDetailsData): number {
  const internalRoutes = (details._vallasRoutes ||
    details._pubRoutes ||
    details._perifoneoRoutes) as unknown[] | undefined;
  if (internalRoutes && internalRoutes.length > 0) return internalRoutes.length;
  // Fallback: use the API-facing `rutas` array
  const rutas = details.rutas as unknown[] | undefined;
  return rutas ? rutas.length : 0;
}

/* ─── Expand a route-based item into one line per route ────── */
export interface ExpandedRouteLine {
  concept: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  position?: number;
  service_details?: Record<string, unknown>;
  estimated_date?: string;
}

export function expandRouteLines(
  details: ServiceDetailsData,
  baseConcept: string,
  baseDescription: string,
): ExpandedRouteLine[] {
  // Try internal routes first, then API-facing rutas
  const internalRoutes = (details._vallasRoutes ||
    details._pubRoutes ||
    details._perifoneoRoutes) as
    | Array<{ cantidad?: number; unit_price?: number; unidad?: string; ruta?: string; estimated_date?: string; vendorDescription?: string }>
    | undefined;

  if (internalRoutes && internalRoutes.length > 0) {
    return internalRoutes.map((r, i) => {
      const qty = r.cantidad || 1;
      const price = r.unit_price || 0;
      return {
        concept: `${baseConcept} — Ruta ${i + 1}`,
        description: r.vendorDescription || baseDescription,
        quantity: qty,
        unit: r.unidad || 'servicio',
        unit_price: price,
        line_total: qty * price,
        estimated_date: r.estimated_date || undefined,
      };
    });
  }

  // Fallback: API-facing rutas
  const rutas = details.rutas as
    | Array<{ numero?: number; cantidad?: number; precio_unitario?: number; unidad?: string; ruta_preestablecida?: string }>
    | undefined;
  if (rutas && rutas.length > 0) {
    return rutas.map((r, i) => {
      const qty = r.cantidad || 1;
      const price = r.precio_unitario || 0;
      return {
        concept: `${baseConcept} — Ruta ${r.numero || i + 1}`,
        description: baseDescription,
        quantity: qty,
        unit: r.unidad || 'servicio',
        unit_price: price,
        line_total: qty * price,
      };
    });
  }

  // No routes found — return single line with zero
  return [{
    concept: baseConcept,
    description: baseDescription,
    quantity: 1,
    unit: 'servicio',
    unit_price: 0,
    line_total: 0,
  }];
}

/* ════════════════════════════════════════════════════════════════
 *  Component
 * ════════════════════════════════════════════════════════════════ */
export function ServiceFormFields({
  value,
  onChange,
  disabled,
  hideRoutePricing,
  routeComments,
  onRouteCommentsChange,
}: ServiceFormFieldsProps) {
  const serviceType = value.service_type as ServiceId | '';

  /* ── Route state for publicidad-movil subtypes ─────────────── */
  const [vallasRoutes, setVallasRoutes] = useState<ConfigurableRouteEntry[]>(
    () => {
      const existing = value._vallasRoutes as
        | ConfigurableRouteEntry[]
        | undefined;
      return existing && existing.length > 0
        ? existing
        : [createConfigurableRoute()];
    }
  );
  const [pubRoutes, setPubRoutes] = useState<EstablishedRouteEntry[]>(() => {
    const existing = value._pubRoutes as EstablishedRouteEntry[] | undefined;
    return existing && existing.length > 0
      ? existing
      : [createEstablishedRoute()];
  });
  const [perifoneoRoutes, setPerifoneoRoutes] = useState<
    ConfigurableRouteEntry[]
  >(() => {
    const existing = value._perifoneoRoutes as
      | ConfigurableRouteEntry[]
      | undefined;
    return existing && existing.length > 0
      ? existing
      : [createConfigurableRoute()];
  });

  /* ── Helpers ─────────────────────────────────────────────────── */
  const set = (key: string, v: unknown) => {
    onChangeRef.current({ ...valueRef.current, [key]: v });
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(n);

  /* ── Keep latest value & onChange accessible inside effects ── */
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /* ── Skip sync on initial mount ────────────────────────────── */
  const isInitialMount = useRef(true);

  /* ── Sync route state → parent ─────────────────────────────── */
  useEffect(() => {
    // Skip initial mount — the route state was just initialized from props
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Always read latest value & onChange from refs to avoid stale closures
    const val = valueRef.current;
    const fire = onChangeRef.current;

    const subtipo = val.subtipo as string | undefined;
    if (serviceType !== 'publicidad-movil') return;

    if (subtipo === 'vallas-moviles') {
      // When pricing is managed externally (hideRoutePricing), preserve prices
      // from parent props to avoid overwriting vendor-set prices with stale
      // internal state values.
      const propRoutes = hideRoutePricing
        ? (val._vallasRoutes as ConfigurableRouteEntry[] | undefined)
        : undefined;
      const mergedRoutes = vallasRoutes.map((r, i) =>
        propRoutes?.[i]
          ? { ...r, unit_price: propRoutes[i].unit_price, cantidad: propRoutes[i].cantidad }
          : r
      );

      fire({
        ...val,
        _vallasRoutes: mergedRoutes,
        rutas: mergedRoutes.map((r, i) => ({
          numero: i + 1,
          fecha_inicio: r.fechaInicio || null,
          fecha_fin: r.fechaFin || null,
          horario_inicio: r.horarioInicio || null,
          horario_fin: r.horarioFin || null,
          cantidad: r.cantidad || 1,
          unidad: r.unidad || 'servicio',
          precio_unitario: r.unit_price || 0,
          ruta: r.route
            ? {
                punto_a: r.route.pointA,
                punto_b: r.route.pointB,
                distancia_metros: r.route.routeData?.distance,
                duracion_segundos: r.route.routeData?.duration,
                coordenadas: r.route.routeData?.coordinates,
              }
            : r.clientRouteInfo || null,
        })),
      });
    } else if (subtipo === 'publibuses') {
      const meses = val.meses_campana as number | undefined;
      const propRoutes = hideRoutePricing
        ? (val._pubRoutes as EstablishedRouteEntry[] | undefined)
        : undefined;
      const mergedRoutes = pubRoutes.map((r, i) =>
        propRoutes?.[i]
          ? { ...r, unit_price: propRoutes[i].unit_price, cantidad: propRoutes[i].cantidad }
          : r
      );

      fire({
        ...val,
        _pubRoutes: mergedRoutes,
        rutas: mergedRoutes.map((r, i) => ({
          numero: i + 1,
          ruta_preestablecida: r.ruta || null,
          fecha_inicio: r.fechaInicio || null,
          fecha_fin:
            r.fechaInicio && meses
              ? addMonths(r.fechaInicio, Number(meses))
              : null,
          cantidad: r.cantidad || 1,
          unidad: r.unidad || 'servicio',
          precio_unitario: r.unit_price || 0,
        })),
      });
    } else if (subtipo === 'perifoneo') {
      const propRoutes = hideRoutePricing
        ? (val._perifoneoRoutes as ConfigurableRouteEntry[] | undefined)
        : undefined;
      const mergedRoutes = perifoneoRoutes.map((r, i) =>
        propRoutes?.[i]
          ? { ...r, unit_price: propRoutes[i].unit_price, cantidad: propRoutes[i].cantidad }
          : r
      );

      fire({
        ...val,
        _perifoneoRoutes: mergedRoutes,
        rutas: mergedRoutes.map((r, i) => ({
          numero: i + 1,
          fecha_inicio: r.fechaInicio || null,
          fecha_fin: r.fechaFin || null,
          horario_inicio: r.horarioInicio || null,
          horario_fin: r.horarioFin || null,
          cantidad: r.cantidad || 1,
          unidad: r.unidad || 'servicio',
          precio_unitario: r.unit_price || 0,
          ruta: r.route
            ? {
                punto_a: r.route.pointA,
                punto_b: r.route.pointB,
                distancia_metros: r.route.routeData?.distance,
                duracion_segundos: r.route.routeData?.duration,
                coordenadas: r.route.routeData?.coordinates,
              }
            : r.clientRouteInfo || null,
        })),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vallasRoutes, pubRoutes, perifoneoRoutes]);

  /* ── Reset routes when service type changes ────────────────── */
  useEffect(() => {
    if (serviceType !== 'publicidad-movil') return;
    if (!value._vallasRoutes) setVallasRoutes([createConfigurableRoute()]);
    if (!value._pubRoutes) setPubRoutes([createEstablishedRoute()]);
    if (!value._perifoneoRoutes)
      setPerifoneoRoutes([createConfigurableRoute()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType]);

  const today = new Date().toISOString().split('T')[0];

  // Minimum 8 business days for publicidad-movil route dates
  const minRouteStartDate = useMemo(() => {
    const result = new Date();
    let added = 0;
    while (added < 8) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return result.toISOString().split('T')[0];
  }, []);

  if (!serviceType) return null;

  /* ════════════════════════════════════════════════════════════
   *  ESPECTACULARES
   * ════════════════════════════════════════════════════════════ */
  if (serviceType === 'espectaculares') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipo</label>
          <select
            value={(value.tipo as string) || ''}
            onChange={(e) => set('tipo', e.target.value)}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Selecciona tipo</option>
            {ESPECTACULARES_TIPOS.map((t) => (
              <option key={t} value={t}>
                {t === 'unipolar'
                  ? 'Unipolar'
                  : t === 'azotea'
                    ? 'Azotea'
                    : t === 'mural'
                      ? 'Mural'
                      : 'Otro'}
              </option>
            ))}
          </select>
          {value.tipo === 'otro' && (
            <input
              value={(value.tipo_otro as string) || ''}
              onChange={(e) => set('tipo_otro', e.target.value)}
              className={`${inputCls} mt-1`}
              placeholder="Especifica el tipo"
              disabled={disabled}
            />
          )}
        </div>
        <div>
          <label className={labelCls}>Medidas (ancho × alto)</label>
          <input
            value={(value.medidas as string) || ''}
            onChange={(e) => set('medidas', e.target.value)}
            className={inputCls}
            placeholder="ej. 12m × 6m"
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelCls}>Tiempo de exhibición</label>
          <input
            value={(value.tiempo_exhibicion as string) || ''}
            onChange={(e) => set('tiempo_exhibicion', e.target.value)}
            className={inputCls}
            placeholder="ej. 3 meses"
            disabled={disabled}
          />
        </div>
        <RadioGroup
          label="¿Impresión incluida?"
          name="esp_imp"
          value={value.impresion_incluida as string}
          options={[
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          onChange={(v) => set('impresion_incluida', v)}
          disabled={disabled}
        />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
   *  FABRICACIÓN DE ANUNCIOS
   * ════════════════════════════════════════════════════════════ */
  if (serviceType === 'fabricacion-anuncios') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipo de anuncio</label>
          <select
            value={(value.tipo_anuncio as string) || ''}
            onChange={(e) => set('tipo_anuncio', e.target.value)}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Selecciona tipo</option>
            {FABRICACION_ANUNCIOS_TIPOS.map((t) => (
              <option key={t} value={t}>
                {t === 'cajas-luz'
                  ? 'Cajas de luz'
                  : t === 'letras-3d'
                    ? 'Letras 3D'
                    : t === 'anuncios-2d'
                      ? 'Anuncios 2D'
                      : t === 'bastidores'
                        ? 'Bastidores'
                        : t === 'toldos'
                          ? 'Toldos'
                          : t === 'neon'
                            ? 'Neón'
                            : 'Otro'}
              </option>
            ))}
          </select>
          {value.tipo_anuncio === 'otro' && (
            <input
              value={(value.tipo_anuncio_otro as string) || ''}
              onChange={(e) => set('tipo_anuncio_otro', e.target.value)}
              className={`${inputCls} mt-1`}
              placeholder="Especifica el tipo"
              disabled={disabled}
            />
          )}
        </div>
        <div>
          <label className={labelCls}>Medidas</label>
          <input
            value={(value.medidas as string) || ''}
            onChange={(e) => set('medidas', e.target.value)}
            className={inputCls}
            placeholder="ancho × alto × profundidad"
            disabled={disabled}
          />
        </div>
        <RadioGroup
          label="Uso"
          name="fab_uso"
          value={value.uso as string}
          options={[
            { value: 'interior', label: 'Interior' },
            { value: 'exterior', label: 'Exterior' },
          ]}
          onChange={(v) => set('uso', v)}
          disabled={disabled}
        />
        <RadioGroup
          label="¿Iluminación?"
          name="fab_ilum"
          value={value.iluminacion as string}
          options={[
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          onChange={(v) => set('iluminacion', v)}
          disabled={disabled}
        />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
   *  PUBLICIDAD MÓVIL
   * ════════════════════════════════════════════════════════════ */
  if (serviceType === 'publicidad-movil') {
    const subtipo = value.subtipo as string | undefined;
    const mesesCampana = value.meses_campana as number | undefined;

    return (
      <div className="space-y-4">
        {/* Otro */}
        {subtipo === 'otro' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className={labelCls}>Tipo de publicidad móvil</label>
              <input
                value={(value.subtipo_otro as string) || ''}
                onChange={(e) => set('subtipo_otro', e.target.value)}
                className={inputCls}
                placeholder="Especifica el tipo"
                disabled={disabled}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Descripción del servicio</label>
              <textarea
                value={(value.descripcion as string) || ''}
                onChange={(e) => set('descripcion', e.target.value)}
                className={inputCls}
                rows={3}
                placeholder="Describe el servicio"
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {/* ── Vallas móviles ─────────────────────────────────── */}
        {subtipo === 'vallas-moviles' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden">
            {/* Routes */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-cmyk-cyan flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  Rutas de circulación
                </h4>
                <span className="text-[10px] text-neutral-500">
                  {vallasRoutes.length} ruta
                  {vallasRoutes.length > 1 ? 's' : ''}
                </span>
              </div>

              {vallasRoutes.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-cmyk-cyan">
                      Ruta {idx + 1}
                    </span>
                    {vallasRoutes.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setVallasRoutes((prev) =>
                            prev.filter((r) => r.id !== entry.id)
                          )
                        }
                        className="text-red-400 hover:text-red-300 text-[10px]"
                        disabled={disabled}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  {/* Dates & times */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Fecha inicio</label>
                      <input
                        type="date"
                        className={inputCls}
                        min={minRouteStartDate}
                        value={entry.fechaInicio}
                        disabled={disabled}
                        onChange={(e) =>
                          setVallasRoutes((prev) =>
                            prev.map((r) =>
                              r.id === entry.id
                                ? { ...r, fechaInicio: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Fecha fin</label>
                      <input
                        type="date"
                        className={inputCls}
                        min={minRouteStartDate}
                        value={entry.fechaFin}
                        disabled={disabled}
                        onChange={(e) =>
                          setVallasRoutes((prev) =>
                            prev.map((r) =>
                              r.id === entry.id
                                ? { ...r, fechaFin: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Horario inicio</label>
                      <input
                        type="time"
                        className={inputCls}
                        value={entry.horarioInicio}
                        disabled={disabled}
                        onChange={(e) =>
                          setVallasRoutes((prev) =>
                            prev.map((r) =>
                              r.id === entry.id
                                ? { ...r, horarioInicio: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Horario fin</label>
                      <input
                        type="time"
                        className={inputCls}
                        value={entry.horarioFin}
                        disabled={disabled}
                        onChange={(e) =>
                          setVallasRoutes((prev) =>
                            prev.map((r) =>
                              r.id === entry.id
                                ? { ...r, horarioFin: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Cantidad + Unidad + Precio Unit. (hidden in client view) */}
                  {!hideRoutePricing && (
                    <RoutePricingRow
                      cantidad={entry.cantidad}
                      unidad={entry.unidad}
                      unitPrice={entry.unit_price}
                      onCantidadChange={(v) =>
                        setVallasRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, cantidad: v } : r
                          )
                        )
                      }
                      onUnidadChange={(v) =>
                        setVallasRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, unidad: v } : r
                          )
                        )
                      }
                      onUnitPriceChange={(v) =>
                        setVallasRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, unit_price: v } : r
                          )
                        )
                      }
                      disabled={disabled}
                      formatCurrency={formatCurrency}
                    />
                  )}

                  {/* Route info from client (reference) */}
                  {entry.clientRouteInfo && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Ruta actual del cliente:</p>
                      <RoutePointsDisplay routeInfo={entry.clientRouteInfo} />
                    </div>
                  )}

                  {/* Map tracer — always available for editing */}
                  <div>
                    <label className={labelCls}>
                      {entry.clientRouteInfo ? 'Modificar ruta en mapa' : 'Trazar ruta en mapa (opcional)'}
                    </label>
                    <RouteSelector
                      onChange={(route) =>
                        setVallasRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, route } : r
                          )
                        )
                      }
                      initialPointA={
                        entry.clientRouteInfo?.punto_a?.lat != null
                          ? { name: entry.clientRouteInfo.punto_a.name || '', lat: entry.clientRouteInfo.punto_a.lat, lon: entry.clientRouteInfo.punto_a.lon! }
                          : undefined
                      }
                      initialPointB={
                        entry.clientRouteInfo?.punto_b?.lat != null
                          ? { name: entry.clientRouteInfo.punto_b.name || '', lat: entry.clientRouteInfo.punto_b.lat, lon: entry.clientRouteInfo.punto_b.lon! }
                          : undefined
                      }
                    />
                  </div>

                  {/* Per-route comment */}
                  {routeComments && onRouteCommentsChange && (
                    <div className="p-3 bg-neutral-800/50 rounded-lg space-y-1">
                      <div className="flex items-center gap-2">
                        <ChatBubbleLeftIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                        <label className="text-neutral-500 text-xs">Comentarios de esta ruta</label>
                      </div>
                      <textarea
                        value={routeComments[idx] || ''}
                        onChange={(e) => onRouteCommentsChange({ ...routeComments, [idx]: e.target.value })}
                        rows={2}
                        maxLength={2000}
                        className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50 resize-none"
                        placeholder={`Comentarios para la ruta ${idx + 1}…`}
                      />
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setVallasRoutes((prev) => [
                    ...prev,
                    createConfigurableRoute(),
                  ])
                }
                className="w-full py-2 rounded-lg border-2 border-dashed border-cmyk-cyan/40 text-cmyk-cyan text-xs font-medium hover:bg-cmyk-cyan/10 transition-all flex items-center justify-center gap-1.5"
                disabled={disabled}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Agregar otra ruta
              </button>
            </div>
          </div>
        )}

        {/* ── Publibuses ─────────────────────────────────────── */}
        {subtipo === 'publibuses' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tiempo de campaña (meses)</label>
              <select
                value={mesesCampana || ''}
                onChange={(e) =>
                  set('meses_campana', parseInt(e.target.value) || '')
                }
                className={inputCls}
                disabled={disabled}
              >
                <option value="">Selecciona duración</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? 'mes' : 'meses'}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-cmyk-cyan">
                  Rutas preestablecidas
                </h4>
                <span className="text-[10px] text-neutral-500">
                  {pubRoutes.length} ruta{pubRoutes.length > 1 ? 's' : ''}
                </span>
              </div>

              {!mesesCampana && (
                <p className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-2 py-1.5">
                  ⚠️ Selecciona los meses de campaña para habilitar las fechas.
                </p>
              )}

              {pubRoutes.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-cmyk-cyan">
                      Ruta {idx + 1}
                    </span>
                    {pubRoutes.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPubRoutes((prev) =>
                            prev.filter((r) => r.id !== entry.id)
                          )
                        }
                        className="text-red-400 hover:text-red-300 text-[10px]"
                        disabled={disabled}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Ruta preestablecida</label>
                    <select
                      className={inputCls}
                      value={entry.ruta}
                      disabled={disabled}
                      onChange={(e) =>
                        setPubRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id
                              ? { ...r, ruta: e.target.value }
                              : r
                          )
                        )
                      }
                    >
                      <option value="">Selecciona una ruta</option>
                      <option value="zocalo-base">Zócalo Base</option>
                      <option value="colosio-zocalo">Colosio Zócalo</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Fecha inicio</label>
                      <input
                        type="date"
                        className={inputCls}
                        min={minRouteStartDate}
                        value={entry.fechaInicio}
                        disabled={disabled || !mesesCampana}
                        onChange={(e) =>
                          setPubRoutes((prev) =>
                            prev.map((r) =>
                              r.id === entry.id
                                ? { ...r, fechaInicio: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Fecha fin (auto)</label>
                      <input
                        type="date"
                        className={`${inputCls} cursor-default`}
                        readOnly
                        value={
                          entry.fechaInicio && mesesCampana
                            ? addMonths(
                                entry.fechaInicio,
                                Number(mesesCampana)
                              )
                            : ''
                        }
                      />
                    </div>
                  </div>

                  {/* Cantidad + Unidad + Precio Unit. (hidden in client view) */}
                  {!hideRoutePricing && (
                    <RoutePricingRow
                      cantidad={entry.cantidad}
                      unidad={entry.unidad}
                      unitPrice={entry.unit_price}
                      onCantidadChange={(v) =>
                        setPubRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, cantidad: v } : r
                          )
                        )
                      }
                      onUnidadChange={(v) =>
                        setPubRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, unidad: v } : r
                          )
                        )
                      }
                      onUnitPriceChange={(v) =>
                        setPubRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, unit_price: v } : r
                          )
                        )
                      }
                      disabled={disabled}
                      formatCurrency={formatCurrency}
                    />
                  )}

                  {entry.ruta && (
                    <div className="rounded-lg overflow-hidden border border-cmyk-cyan/30">
                      <iframe
                        src={
                          entry.ruta === 'zocalo-base'
                            ? 'https://www.google.com/maps/d/embed?mid=1VXvDDqbLCqv54dbwkmtfNs8XKjUxzvo&ll=16.835724183151132%2C-99.87844209999999&z=13'
                            : 'https://www.google.com/maps/d/embed?mid=1NrsT2SEvgGKOh7NusgOHD6-NJd4h1GE&ll=16.82830914325928%2C-99.85695&z=13'
                        }
                        width="100%"
                        height="200"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        title={
                          entry.ruta === 'zocalo-base'
                            ? 'Ruta Zócalo Base'
                            : 'Ruta Colosio Zócalo'
                        }
                      />
                    </div>
                  )}

                  {/* Per-route comment */}
                  {routeComments && onRouteCommentsChange && (
                    <div className="p-3 bg-neutral-800/50 rounded-lg space-y-1">
                      <div className="flex items-center gap-2">
                        <ChatBubbleLeftIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                        <label className="text-neutral-500 text-xs">Comentarios de esta ruta</label>
                      </div>
                      <textarea
                        value={routeComments[idx] || ''}
                        onChange={(e) => onRouteCommentsChange({ ...routeComments, [idx]: e.target.value })}
                        rows={2}
                        maxLength={2000}
                        className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50 resize-none"
                        placeholder={`Comentarios para la ruta ${idx + 1}…`}
                      />
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setPubRoutes((prev) => [...prev, createEstablishedRoute()])
                }
                className="w-full py-2 rounded-lg border-2 border-dashed border-cmyk-cyan/40 text-cmyk-cyan text-xs font-medium hover:bg-cmyk-cyan/10 transition-all flex items-center justify-center gap-1.5"
                disabled={disabled}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Agregar otra ruta
              </button>
            </div>
          </div>
        )}

        {/* ── Perifoneo ──────────────────────────────────────── */}
        {subtipo === 'perifoneo' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden">
            <RadioGroup
              label="¿Requiere grabación por proveedor?"
              name="peri_grab"
              value={value.requiere_grabacion as string}
              options={[
                { value: 'si', label: 'Sí' },
                { value: 'no', label: 'No' },
              ]}
              onChange={(v) => set('requiere_grabacion', v)}
              disabled={disabled}
            />

            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-cmyk-cyan">
                  Rutas de perifoneo
                </h4>
                <span className="text-[10px] text-neutral-500">
                  {perifoneoRoutes.length} ruta
                  {perifoneoRoutes.length > 1 ? 's' : ''}
                </span>
              </div>

              {perifoneoRoutes.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-cmyk-cyan">
                      Ruta {idx + 1}
                    </span>
                    {perifoneoRoutes.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPerifoneoRoutes((prev) =>
                            prev.filter((r) => r.id !== entry.id)
                          )
                        }
                        className="text-red-400 hover:text-red-300 text-[10px]"
                        disabled={disabled}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Fecha inicio</label>
                      <input
                        type="date"
                        className={inputCls}
                        min={minRouteStartDate}
                        value={entry.fechaInicio}
                        disabled={disabled}
                        onChange={(e) =>
                          setPerifoneoRoutes((prev) =>
                            prev.map((r) =>
                              r.id === entry.id
                                ? { ...r, fechaInicio: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Fecha fin</label>
                      <input
                        type="date"
                        className={inputCls}
                        min={minRouteStartDate}
                        value={entry.fechaFin}
                        disabled={disabled}
                        onChange={(e) =>
                          setPerifoneoRoutes((prev) =>
                            prev.map((r) =>
                              r.id === entry.id
                                ? { ...r, fechaFin: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Horario inicio</label>
                      <input
                        type="time"
                        className={inputCls}
                        value={entry.horarioInicio}
                        disabled={disabled}
                        onChange={(e) =>
                          setPerifoneoRoutes((prev) =>
                            prev.map((r) =>
                              r.id === entry.id
                                ? { ...r, horarioInicio: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Horario fin</label>
                      <input
                        type="time"
                        className={inputCls}
                        value={entry.horarioFin}
                        disabled={disabled}
                        onChange={(e) =>
                          setPerifoneoRoutes((prev) =>
                            prev.map((r) =>
                              r.id === entry.id
                                ? { ...r, horarioFin: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Cantidad + Unidad + Precio Unit. (hidden in client view) */}
                  {!hideRoutePricing && (
                    <RoutePricingRow
                      cantidad={entry.cantidad}
                      unidad={entry.unidad}
                      unitPrice={entry.unit_price}
                      onCantidadChange={(v) =>
                        setPerifoneoRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, cantidad: v } : r
                          )
                        )
                      }
                      onUnidadChange={(v) =>
                        setPerifoneoRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, unidad: v } : r
                          )
                        )
                      }
                      onUnitPriceChange={(v) =>
                        setPerifoneoRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, unit_price: v } : r
                          )
                        )
                      }
                      disabled={disabled}
                      formatCurrency={formatCurrency}
                    />
                  )}

                  {/* Route info from client (reference) */}
                  {entry.clientRouteInfo && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Ruta actual del cliente:</p>
                      <RoutePointsDisplay routeInfo={entry.clientRouteInfo} />
                    </div>
                  )}

                  {/* Map tracer — always available for editing */}
                  <div>
                    <label className={labelCls}>
                      {entry.clientRouteInfo ? 'Modificar ruta en mapa' : 'Trazar ruta en mapa (opcional)'}
                    </label>
                    <RouteSelector
                      onChange={(route) =>
                        setPerifoneoRoutes((prev) =>
                          prev.map((r) =>
                            r.id === entry.id ? { ...r, route } : r
                          )
                        )
                      }
                      initialPointA={
                        entry.clientRouteInfo?.punto_a?.lat != null
                          ? { name: entry.clientRouteInfo.punto_a.name || '', lat: entry.clientRouteInfo.punto_a.lat, lon: entry.clientRouteInfo.punto_a.lon! }
                          : undefined
                      }
                      initialPointB={
                        entry.clientRouteInfo?.punto_b?.lat != null
                          ? { name: entry.clientRouteInfo.punto_b.name || '', lat: entry.clientRouteInfo.punto_b.lat, lon: entry.clientRouteInfo.punto_b.lon! }
                          : undefined
                      }
                    />
                  </div>

                  {/* Per-route comment */}
                  {routeComments && onRouteCommentsChange && (
                    <div className="p-3 bg-neutral-800/50 rounded-lg space-y-1">
                      <div className="flex items-center gap-2">
                        <ChatBubbleLeftIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                        <label className="text-neutral-500 text-xs">Comentarios de esta ruta</label>
                      </div>
                      <textarea
                        value={routeComments[idx] || ''}
                        onChange={(e) => onRouteCommentsChange({ ...routeComments, [idx]: e.target.value })}
                        rows={2}
                        maxLength={2000}
                        className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50 resize-none"
                        placeholder={`Comentarios para la ruta ${idx + 1}…`}
                      />
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setPerifoneoRoutes((prev) => [
                    ...prev,
                    createConfigurableRoute(),
                  ])
                }
                className="w-full py-2 rounded-lg border-2 border-dashed border-cmyk-cyan/40 text-cmyk-cyan text-xs font-medium hover:bg-cmyk-cyan/10 transition-all flex items-center justify-center gap-1.5"
                disabled={disabled}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Agregar otra ruta
              </button>
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Descripción de zona</label>
              <textarea
                value={(value.delimitacion_zona as string) || ''}
                onChange={(e) => set('delimitacion_zona', e.target.value)}
                className={inputCls}
                rows={2}
                placeholder="Calles, colonias o puntos de referencia"
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
   *  IMPRESIÓN GRAN FORMATO
   * ════════════════════════════════════════════════════════════ */
  if (serviceType === 'impresion-gran-formato') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Material</label>
          <select
            value={(value.material as string) || ''}
            onChange={(e) => set('material', e.target.value)}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Selecciona material</option>
            {GRAN_FORMATO_MATERIALES.map((m) => (
              <option key={m} value={m}>
                {m === 'otro'
                  ? 'Otro'
                  : m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
          {value.material === 'otro' && (
            <input
              value={(value.material_otro as string) || ''}
              onChange={(e) => set('material_otro', e.target.value)}
              className={`${inputCls} mt-1`}
              placeholder="Especifica el material"
              disabled={disabled}
            />
          )}
        </div>
        <div>
          <label className={labelCls}>Medidas</label>
          <input
            value={(value.medidas as string) || ''}
            onChange={(e) => set('medidas', e.target.value)}
            className={inputCls}
            placeholder="ancho × alto"
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelCls}>Cantidad</label>
          <input
            type="number"
            min="1"
            value={(value.cantidad as number) || ''}
            onChange={(e) => set('cantidad', parseInt(e.target.value) || '')}
            className={inputCls}
            placeholder="1"
            disabled={disabled}
          />
        </div>
        <RadioGroup
          label="¿Archivo listo para imprimir?"
          name="igf_arch"
          value={value.archivo_listo as string}
          options={[
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          onChange={(v) => set('archivo_listo', v)}
          disabled={disabled}
        />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
   *  SEÑALIZACIÓN
   * ════════════════════════════════════════════════════════════ */
  if (serviceType === 'senalizacion') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipo de señalización</label>
          <select
            value={(value.tipo as string) || ''}
            onChange={(e) => set('tipo', e.target.value)}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Selecciona tipo</option>
            {SENALIZACION_TIPOS.map((t) => (
              <option key={t} value={t}>
                {t === 'interior'
                  ? 'Interior'
                  : t === 'exterior'
                    ? 'Exterior'
                    : t === 'vial'
                      ? 'Vial'
                      : 'Otro'}
              </option>
            ))}
          </select>
          {value.tipo === 'otro' && (
            <input
              value={(value.tipo_otro as string) || ''}
              onChange={(e) => set('tipo_otro', e.target.value)}
              className={`${inputCls} mt-1`}
              placeholder="Especifica el tipo"
              disabled={disabled}
            />
          )}
        </div>
        <div>
          <label className={labelCls}>Medidas</label>
          <input
            value={(value.medidas as string) || ''}
            onChange={(e) => set('medidas', e.target.value)}
            className={inputCls}
            placeholder="ancho × alto"
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelCls}>Cantidad</label>
          <input
            type="number"
            min="1"
            value={(value.cantidad as number) || ''}
            onChange={(e) => set('cantidad', parseInt(e.target.value) || '')}
            className={inputCls}
            placeholder="1"
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
   *  ROTULACIÓN VEHICULAR
   * ════════════════════════════════════════════════════════════ */
  if (serviceType === 'rotulacion-vehicular') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipo de vehículo</label>
          <input
            value={(value.tipo_vehiculo as string) || ''}
            onChange={(e) => set('tipo_vehiculo', e.target.value)}
            className={inputCls}
            placeholder="ej. Camioneta, Sedán, Autobús"
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelCls}>Tipo de rotulación</label>
          <select
            value={(value.tipo_rotulacion as string) || ''}
            onChange={(e) => set('tipo_rotulacion', e.target.value)}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Selecciona tipo</option>
            {ROTULACION_TIPOS.map((t) => (
              <option key={t} value={t}>
                {t === 'completa'
                  ? 'Completa'
                  : t === 'parcial'
                    ? 'Parcial'
                    : t === 'vinil-recortado'
                      ? 'Vinil recortado'
                      : t === 'impresion-digital'
                        ? 'Impresión digital'
                        : 'Otro'}
              </option>
            ))}
          </select>
          {value.tipo_rotulacion === 'otro' && (
            <input
              value={(value.tipo_rotulacion_otro as string) || ''}
              onChange={(e) => set('tipo_rotulacion_otro', e.target.value)}
              className={`${inputCls} mt-1`}
              placeholder="Especifica el tipo"
              disabled={disabled}
            />
          )}
        </div>
        <RadioGroup
          label="¿Diseño incluido?"
          name="rot_dis"
          value={value.diseno_incluido as string}
          options={[
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          onChange={(v) => set('diseno_incluido', v)}
          disabled={disabled}
        />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
   *  CORTE Y GRABADO CNC/LÁSER
   * ════════════════════════════════════════════════════════════ */
  if (serviceType === 'corte-grabado-cnc-laser') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipo de servicio</label>
          <select
            value={(value.tipo as string) || ''}
            onChange={(e) => set('tipo', e.target.value)}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Selecciona tipo</option>
            {CNC_LASER_TIPOS.map((t) => (
              <option key={t} value={t}>
                {t === 'router-cnc'
                  ? 'Router CNC'
                  : t === 'corte-laser'
                    ? 'Corte Láser'
                    : t === 'grabado-laser'
                      ? 'Grabado Láser'
                      : 'Otro'}
              </option>
            ))}
          </select>
          {value.tipo === 'otro' && (
            <input
              value={(value.tipo_otro as string) || ''}
              onChange={(e) => set('tipo_otro', e.target.value)}
              className={`${inputCls} mt-1`}
              placeholder="Especifica el tipo"
              disabled={disabled}
            />
          )}
        </div>
        <div>
          <label className={labelCls}>Medidas</label>
          <input
            value={(value.medidas as string) || ''}
            onChange={(e) => set('medidas', e.target.value)}
            className={inputCls}
            placeholder="ancho × alto × espesor"
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelCls}>Cantidad</label>
          <input
            type="number"
            min="1"
            value={(value.cantidad as number) || ''}
            onChange={(e) => set('cantidad', parseInt(e.target.value) || '')}
            className={inputCls}
            placeholder="1"
            disabled={disabled}
          />
        </div>
        <RadioGroup
          label="¿Archivo listo?"
          name="cnc_arch"
          value={value.archivo_listo as string}
          options={[
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          onChange={(v) => set('archivo_listo', v)}
          disabled={disabled}
        />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
   *  DISEÑO GRÁFICO
   * ════════════════════════════════════════════════════════════ */
  if (serviceType === 'diseno-grafico') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipo de diseño</label>
          <select
            value={(value.tipo as string) || ''}
            onChange={(e) => set('tipo', e.target.value)}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Selecciona tipo</option>
            {DISENO_GRAFICO_TIPOS.map((t) => (
              <option key={t} value={t}>
                {t === 'logotipos'
                  ? 'Logotipos'
                  : t === 'papeleria'
                    ? 'Papelería'
                    : t === 'redes-sociales'
                      ? 'Redes Sociales'
                      : 'Otro'}
              </option>
            ))}
          </select>
          {value.tipo === 'otro' && (
            <input
              value={(value.tipo_otro as string) || ''}
              onChange={(e) => set('tipo_otro', e.target.value)}
              className={`${inputCls} mt-1`}
              placeholder="Especifica el tipo"
              disabled={disabled}
            />
          )}
        </div>
        <div>
          <label className={labelCls}>Número de piezas</label>
          <input
            type="number"
            min="1"
            value={(value.numero_piezas as number) || ''}
            onChange={(e) =>
              set('numero_piezas', parseInt(e.target.value) || '')
            }
            className={inputCls}
            placeholder="1"
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelCls}>Medidas / Dimensiones</label>
          <input
            value={(value.medidas as string) || ''}
            onChange={(e) => set('medidas', e.target.value)}
            className={inputCls}
            placeholder="ej. 1080×1080 px, 21×29.7 cm (A4)"
            disabled={disabled}
          />
          <p className="text-xs text-neutral-500 mt-1">Indica las dimensiones y unidad (px, cm, mm, pulgadas).</p>
        </div>
        <RadioGroup
          label="Uso del diseño"
          name="dis_uso"
          value={value.uso as string}
          options={[
            { value: 'impresion', label: 'Impresión' },
            { value: 'digital', label: 'Digital' },
            { value: 'ambos', label: 'Ambos' },
          ]}
          onChange={(v) => set('uso', v)}
          disabled={disabled}
        />
        <RadioGroup
          label="¿Cambios incluidos?"
          name="dis_cambios"
          value={value.cambios_incluidos as string}
          options={[
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          onChange={(v) => set('cambios_incluidos', v)}
          disabled={disabled}
        />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
   *  IMPRESIÓN OFFSET/SERIGRAFÍA
   * ════════════════════════════════════════════════════════════ */
  if (serviceType === 'impresion-offset-serigrafia') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Producto</label>
          <select
            value={(value.producto as string) || ''}
            onChange={(e) => set('producto', e.target.value)}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Selecciona producto</option>
            {OFFSET_PRODUCTOS.map((p) => (
              <option key={p} value={p}>
                {p === 'tarjetas-presentacion'
                  ? 'Tarjetas de presentación'
                  : p === 'volantes'
                    ? 'Volantes'
                    : 'Otro'}
              </option>
            ))}
          </select>
          {value.producto === 'otro' && (
            <input
              value={(value.producto_otro as string) || ''}
              onChange={(e) => set('producto_otro', e.target.value)}
              className={`${inputCls} mt-1`}
              placeholder="Especifica el producto"
              disabled={disabled}
            />
          )}
        </div>
        <div>
          <label className={labelCls}>Cantidad</label>
          <input
            type="number"
            min="1"
            value={(value.cantidad as number) || ''}
            onChange={(e) => set('cantidad', parseInt(e.target.value) || '')}
            className={inputCls}
            placeholder="100"
            disabled={disabled}
          />
        </div>
        <RadioGroup
          label="¿Archivo listo para imprimir?"
          name="off_arch"
          value={value.archivo_listo as string}
          options={[
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          onChange={(v) => set('archivo_listo', v)}
          disabled={disabled}
        />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
   *  OTROS
   * ════════════════════════════════════════════════════════════ */
  if (serviceType === 'otros') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className={labelCls}>Tipo de servicio</label>
          <input
            value={(value.tipo_servicio as string) || ''}
            onChange={(e) => set('tipo_servicio', e.target.value)}
            className={inputCls}
            placeholder="Describe brevemente el tipo de servicio"
            disabled={disabled}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Descripción detallada</label>
          <textarea
            value={(value.descripcion as string) || ''}
            onChange={(e) => set('descripcion', e.target.value)}
            className={inputCls}
            rows={3}
            placeholder="Especificaciones, materiales, acabados..."
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelCls}>Medidas (si aplica)</label>
          <input
            value={(value.medidas as string) || ''}
            onChange={(e) => set('medidas', e.target.value)}
            className={inputCls}
            placeholder="ej. 2m × 1m"
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelCls}>Cantidad</label>
          <input
            type="number"
            min="1"
            value={(value.cantidad as number) || ''}
            onChange={(e) => set('cantidad', parseInt(e.target.value) || '')}
            className={inputCls}
            placeholder="1"
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Helper: Build ServiceDetailsData from a QuoteRequest
 * ═══════════════════════════════════════════════════════════════════ */
export function serviceDetailsFromRequest(
  serviceType: string,
  serviceDetails: Record<string, unknown>
): ServiceDetailsData {
  const base: ServiceDetailsData = {
    service_type: serviceType as ServiceId,
    ...serviceDetails,
  };

  // For espectaculares: the client form stores the type as 'tipo', but the
  // concept header reads 'subtipo'. Sync them so both show the same value.
  if (serviceType === 'espectaculares' && base.tipo && !base.subtipo) {
    base.subtipo = base.tipo;
  }
  // For fabricacion-anuncios: sync tipo_anuncio → subtipo
  if (serviceType === 'fabricacion-anuncios' && base.tipo_anuncio && !base.subtipo) {
    base.subtipo = base.tipo_anuncio;
  }

  // Convert boolean values to 'si'/'no' for RadioGroup compatibility
  const boolFields = [
    'impresion_incluida',
    'instalacion_incluida',
    'iluminacion',
    'archivo_listo',
    'archivo_grabacion',
    'requiere_grabacion',
    'diseno_incluido',
    'cambios_incluidos',
  ];
  for (const field of boolFields) {
    const val = base[field];
    if (val === true) base[field] = 'si';
    else if (val === false) base[field] = 'no';
  }

  // Convert route data from request into internal route state
  const subtipo = serviceDetails.subtipo as string | undefined;
  const rutas = serviceDetails.rutas as
    | Array<Record<string, unknown>>
    | undefined;

  if (serviceType === 'publicidad-movil' && rutas && rutas.length > 0) {
    if (subtipo === 'vallas-moviles') {
      base._vallasRoutes = rutas.map((r) => {
        const rutaObj = r.ruta as Record<string, unknown> | null | undefined;
        return {
          id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          fechaInicio: (r.fecha_inicio as string) || '',
          fechaFin: (r.fecha_fin as string) || '',
          horarioInicio: (r.horario_inicio as string) || '',
          horarioFin: (r.horario_fin as string) || '',
          route: null,
          cantidad: (r.cantidad as number) || 1,
          unidad: (r.unidad as string) || 'servicio',
          unit_price: (r.precio_unitario as number) || 0,
          estimated_date: (r.fecha_inicio as string) || '',
          clientRouteInfo: rutaObj
            ? {
                punto_a: rutaObj.punto_a as { name?: string; lat?: number; lon?: number } | null,
                punto_b: rutaObj.punto_b as { name?: string; lat?: number; lon?: number } | null,
                distancia_metros: rutaObj.distancia_metros as number | null,
                duracion_segundos: rutaObj.duracion_segundos as number | null,
              }
            : null,
        };
      });
    } else if (subtipo === 'publibuses') {
      base._pubRoutes = rutas.map((r) => ({
        id: `er-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        ruta: (r.ruta_preestablecida as string) || '',
        fechaInicio: (r.fecha_inicio as string) || '',
        cantidad: (r.cantidad as number) || 1,
        unidad: (r.unidad as string) || 'servicio',
        unit_price: (r.precio_unitario as number) || 0,
        estimated_date: (r.fecha_inicio as string) || '',
      }));
    } else if (subtipo === 'perifoneo') {
      base._perifoneoRoutes = rutas.map((r) => {
        const rutaObj = r.ruta as Record<string, unknown> | null | undefined;
        return {
          id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          fechaInicio: (r.fecha_inicio as string) || '',
          fechaFin: (r.fecha_fin as string) || '',
          horarioInicio: (r.horario_inicio as string) || '',
          horarioFin: (r.horario_fin as string) || '',
          route: null,
          cantidad: (r.cantidad as number) || 1,
          unidad: (r.unidad as string) || 'servicio',
          unit_price: (r.precio_unitario as number) || 0,
          estimated_date: (r.fecha_inicio as string) || '',
          clientRouteInfo: rutaObj
            ? {
                punto_a: rutaObj.punto_a as { name?: string; lat?: number; lon?: number } | null,
                punto_b: rutaObj.punto_b as { name?: string; lat?: number; lon?: number } | null,
                distancia_metros: rutaObj.distancia_metros as number | null,
                duracion_segundos: rutaObj.duracion_segundos as number | null,
              }
            : null,
        };
      });
    }
  }

  return base;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Helper: Clean service_details for API (strip internal route state)
 * ═══════════════════════════════════════════════════════════════════ */
export function cleanServiceDetailsForApi(
  details: ServiceDetailsData
): Record<string, unknown> | null {
  if (!details.service_type) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _vallasRoutes, _pubRoutes, _perifoneoRoutes, ...rest } = details;
  // Strip empty strings, null, undefined values so empty fields aren't sent
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value === null || value === undefined || value === '') continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}
