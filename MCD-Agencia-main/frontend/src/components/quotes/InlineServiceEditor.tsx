'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  MapPinIcon,
  CalendarDaysIcon,
  PaperClipIcon,
  ChatBubbleLeftIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { ServiceFormFields, type ServiceDetailsData, cleanServiceDetailsForApi, type ConfigurableRouteEntry, type EstablishedRouteEntry } from './ServiceFormFields';
import {
  type ServiceId,
  SERVICE_LABELS,
  DELIVERY_METHODS,
  DELIVERY_METHOD_LABELS,
  DELIVERY_METHOD_ICONS,
  type DeliveryMethod,
  getDeliveryMethodsForService,
} from '@/lib/service-ids';
import { getBranches, type Branch } from '@/lib/api/content';
import { getUserAddresses, type UserAddress } from '@/lib/api/auth';
import { useAuth } from '@/contexts/AuthContext';

/* ---------- helpers ---------- */

const addBusinessDays = (from: Date, days: number): string => {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result.toISOString().split('T')[0];
};

const SERVICE_MIN_BUSINESS_DAYS: Record<string, number> = {
  'impresion-gran-formato': 1,
  'impresion-offset-serigrafia': 5,
};

const getMinDateForService = (service: string): string => {
  if (!service) return new Date().toISOString().split('T')[0];
  const days = SERVICE_MIN_BUSINESS_DAYS[service] ?? 8;
  return addBusinessDays(new Date(), days);
};

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.ai', '.cdr', '.dxf', '.svg', '.mp3', '.wav', '.ogg', '.m4a'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/* ---------- validation ---------- */

/**
 * Validate a ServiceEditData object. Returns an array of human-readable error messages.
 * Empty array = valid.
 */
export function validateServiceEditData(data: ServiceEditData): string[] {
  const errors: string[] = [];
  const st = data.serviceType;
  const d = data.details;
  const subtipo = d.subtipo as string | undefined;

  // 1. Service type is always required
  if (!st) {
    errors.push('Selecciona un tipo de servicio.');
    return errors; // can't validate further
  }

  // 2. Service-specific required fields
  if (st === 'espectaculares' && !d.tipo) {
    errors.push('Selecciona el tipo de espectacular.');
  }
  if (st === 'fabricacion-anuncios' && !d.tipo_anuncio) {
    errors.push('Selecciona el tipo de anuncio.');
  }
  if (st === 'publicidad-movil') {
    if (!subtipo) {
      errors.push('Selecciona el subtipo de publicidad móvil.');
    } else if (['vallas-moviles', 'publibuses', 'perifoneo'].includes(subtipo)) {
      // Route-based: check that at least the existing routes have basic data
      const rutas = d.rutas as unknown[] | undefined;
      const internalVallas = d._vallasRoutes as ConfigurableRouteEntry[] | undefined;
      const internalPub = d._pubRoutes as EstablishedRouteEntry[] | undefined;
      const internalPeri = d._perifoneoRoutes as ConfigurableRouteEntry[] | undefined;

      if (subtipo === 'vallas-moviles') {
        const routes = internalVallas || [];
        if (routes.length === 0 && (!rutas || rutas.length === 0)) {
          errors.push('Agrega al menos una ruta para vallas móviles.');
        } else {
          routes.forEach((r, i) => {
            if (!r.fechaInicio) errors.push(`Ruta ${i + 1}: falta la fecha de inicio.`);
            if (!r.fechaFin) errors.push(`Ruta ${i + 1}: falta la fecha de fin.`);
          });
        }
      } else if (subtipo === 'publibuses') {
        const routes = internalPub || [];
        if (routes.length === 0 && (!rutas || rutas.length === 0)) {
          errors.push('Agrega al menos una ruta para publibuses.');
        } else {
          routes.forEach((r, i) => {
            if (!r.ruta) errors.push(`Ruta ${i + 1}: selecciona una ruta preestablecida.`);
            if (!r.fechaInicio) errors.push(`Ruta ${i + 1}: falta la fecha de inicio.`);
          });
        }
      } else if (subtipo === 'perifoneo') {
        const routes = internalPeri || [];
        if (routes.length === 0 && (!rutas || rutas.length === 0)) {
          errors.push('Agrega al menos una ruta para perifoneo.');
        } else {
          routes.forEach((r, i) => {
            if (!r.fechaInicio) errors.push(`Ruta ${i + 1}: falta la fecha de inicio.`);
            if (!r.fechaFin) errors.push(`Ruta ${i + 1}: falta la fecha de fin.`);
          });
        }
      }
    }
  }
  if (st === 'impresion-gran-formato' && !d.material) {
    errors.push('Selecciona el material de impresión.');
  }
  if (st === 'senalizacion' && !d.tipo) {
    errors.push('Selecciona el tipo de señalización.');
  }
  if (st === 'rotulacion-vehicular' && !d.tipo_rotulacion) {
    errors.push('Selecciona el tipo de rotulación.');
  }
  if (st === 'corte-grabado-cnc-laser' && !d.tipo) {
    errors.push('Selecciona el tipo de proceso CNC/Láser.');
  }
  if (st === 'diseno-grafico' && !d.tipo) {
    errors.push('Selecciona el tipo de diseño gráfico.');
  }
  if (st === 'impresion-offset-serigrafia' && !d.producto) {
    errors.push('Selecciona el tipo de producto de impresión.');
  }

  // 2b. Medidas required for services that have a medidas field
  const needsMedidas = [
    'impresion-gran-formato',
    'fabricacion-anuncios',
    'senalizacion',
    'corte-grabado-cnc-laser',
  ];
  if (needsMedidas.includes(st) && !((d.medidas as string) || '').trim()) {
    errors.push('Ingresa las medidas.');
  }

  // 2c. Cantidad required for services with a cantidad field (non-route-based)
  const needsCantidad = [
    'impresion-gran-formato',
    'senalizacion',
    'corte-grabado-cnc-laser',
    'impresion-offset-serigrafia',
  ];
  if (needsCantidad.includes(st) && !(d.cantidad as number)) {
    errors.push('Ingresa la cantidad.');
  }

  // 3. Delivery method validation (skip for not_applicable services)
  const methods = getDeliveryMethodsForService(st, subtipo);
  const isSingleNA = methods.length === 1 && methods[0] === 'not_applicable';
  if (!isSingleNA) {
    if (!data.deliveryMethod) {
      errors.push('Selecciona un método de entrega.');
    } else if (data.deliveryMethod === 'installation' || data.deliveryMethod === 'shipping') {
      // Check address — if a saved address was resolved before save, the fields
      // will already be populated in data.deliveryAddress, so we simply validate
      // the actual data regardless of how it got there (saved picker vs manual).
      const addr = data.deliveryAddress;
      if (!addr.calle?.trim()) errors.push('Ingresa la calle de la dirección de entrega.');
      if (!addr.numero_exterior?.trim()) errors.push('Ingresa el número exterior.');
      if (!addr.colonia?.trim()) errors.push('Ingresa la colonia.');
      if (!addr.ciudad?.trim()) errors.push('Ingresa la ciudad.');
      if (!addr.estado?.trim()) errors.push('Ingresa el estado.');
      if (!addr.codigo_postal?.trim()) errors.push('Ingresa el código postal.');
    } else if (data.deliveryMethod === 'pickup' && !data.pickupBranch) {
      errors.push('Selecciona una sucursal para recoger.');
    }
  }

  // 4. Required date (non-route-based services)
  const isRouteBasedPM = st === 'publicidad-movil' &&
    ['vallas-moviles', 'publibuses', 'perifoneo'].includes(subtipo || '');
  if (!isRouteBasedPM && !data.requiredDate) {
    errors.push('Selecciona una fecha requerida.');
  }

  return errors;
}

/* ---------- types ---------- */

export interface ServiceEditData {
  /** The service type slug */
  serviceType: ServiceId | '';
  /** service_details bag (matches ServiceFormFields state) */
  details: ServiceDetailsData;
  /** Delivery method */
  deliveryMethod: DeliveryMethod | '';
  /** Delivery address object (for installation / shipping) */
  deliveryAddress: Record<string, string>;
  /** Pickup branch id */
  pickupBranch: string;
  /** Customer-required date (YYYY-MM-DD) */
  requiredDate: string;
  /** Customer comments for this service (used for non-route-based services) */
  comments: string;
  /** Per-route comments (route index → comment). Used for route-based publicidad móvil */
  routeComments: Record<number, string>;
  /** New files attached by customer */
  newFiles: File[];
  /** Existing attachment URLs (from original quote) */
  existingAttachments: Array<{ id: string; file: string; filename: string }>;
  /** Attachments marked for removal */
  removedAttachmentIds: string[];
}

interface InlineServiceEditorProps {
  /** Initial data to populate the editor */
  initial: ServiceEditData;
  /** Index / label for display (e.g. "Servicio 1") */
  label: string;
  /** Called when the user saves changes for this service */
  onSave: (data: ServiceEditData) => void;
  /** Called whenever the user modifies any data (keeps parent in sync) */
  onDataChange?: (data: ServiceEditData) => void;
  /** Called when the user cancels editing */
  onCancel: () => void;
  /** Called when the user wants to delete this service */
  onDelete: () => void;
  /** Whether this is a vendor-added service (shows badge, some fields non-editable) */
  isVendorAdded?: boolean;
  /** Estimated delivery date set by vendor (read-only) */
  vendorEstimatedDate?: string;
}

/* ================================================================
   Component
   ================================================================ */

export function InlineServiceEditor({
  initial,
  label,
  onSave,
  onDataChange,
  onCancel,
  onDelete,
  isVendorAdded = false,
  vendorEstimatedDate,
}: InlineServiceEditorProps) {
  /* ---- state ---- */
  const [data, setData] = useState<ServiceEditData>(initial);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const { user } = useAuth();

  /* ---- sync when initial prop changes (covers stale-initial-value) ---- */
  const initialRef = useRef(initial);
  useEffect(() => {
    // Only sync if the initial prop materially changed (different service_type or details).
    // Address changes are NOT synced here because the child manages address state
    // (saved address picker + manual form) and pushes changes up via onDataChange.
    const prev = initialRef.current;
    const hasRicherDetails = initial.details && Object.keys(initial.details).length > Object.keys(prev.details || {}).length;
    const serviceTypeChanged = initial.serviceType !== prev.serviceType;
    const deliveryMethodChanged = initial.deliveryMethod !== prev.deliveryMethod;
    const branchChanged = initial.pickupBranch !== prev.pickupBranch;
    const dateChanged = initial.requiredDate !== prev.requiredDate;
    if (hasRicherDetails || serviceTypeChanged || deliveryMethodChanged || branchChanged || dateChanged) {
      setData(initial);
      initialRef.current = initial;
    }
  }, [initial]);
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- fetch branches on mount ---- */
  useEffect(() => {
    let cancelled = false;
    setBranchesLoading(true);
    getBranches()
      .then((b) => { if (!cancelled) setBranches(b); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBranchesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /* ---- fetch saved addresses for logged-in users ---- */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadingAddresses(true);
    getUserAddresses()
      .then((addrs) => {
        if (cancelled) return;
        const list = Array.isArray(addrs) ? addrs : [];
        setSavedAddresses(list);
        // If the current delivery address matches a saved one, pre-select it
        if (list.length > 0 && data.deliveryAddress && Object.keys(data.deliveryAddress).length > 0) {
          const match = list.find(a =>
            a.calle === data.deliveryAddress.calle &&
            a.numero_exterior === data.deliveryAddress.numero_exterior &&
            a.codigo_postal === data.deliveryAddress.codigo_postal
          );
          if (match) {
            setSelectedAddressId(match.id);
            setUseNewAddress(false);
          } else {
            // Address doesn't match any saved one — show the manual form pre-filled
            setUseNewAddress(true);
          }
        } else if (list.length > 0) {
          // No existing address — default to saved address picker
          const def = list.find(a => a.is_default);
          setSelectedAddressId(def?.id || list[0].id);
          setUseNewAddress(false);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingAddresses(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ---- sync deliveryAddress when a saved address is selected ---- */
  useEffect(() => {
    if (useNewAddress || !selectedAddressId || savedAddresses.length === 0) return;
    const sa = savedAddresses.find(a => a.id === selectedAddressId);
    if (!sa) return;
    const resolved: ServiceEditData['deliveryAddress'] = {
      calle: sa.calle,
      numero_exterior: sa.numero_exterior,
      numero_interior: sa.numero_interior || '',
      colonia: sa.colonia,
      ciudad: sa.ciudad,
      estado: sa.estado,
      codigo_postal: sa.codigo_postal,
      referencia: sa.referencia || '',
    };
    setData(prev => {
      // avoid unnecessary updates if already identical
      if (JSON.stringify(prev.deliveryAddress) === JSON.stringify(resolved)) return prev;
      return { ...prev, deliveryAddress: resolved };
    });
  }, [selectedAddressId, useNewAddress, savedAddresses]);

  /* ---- notify parent whenever data changes (keeps editDataMap in sync) ---- */
  const dataJsonRef = useRef(JSON.stringify(data));
  const onDataChangeRef = useRef(onDataChange);
  onDataChangeRef.current = onDataChange;
  useEffect(() => {
    const json = JSON.stringify(data);
    if (json !== dataJsonRef.current) {
      dataJsonRef.current = json;
      onDataChangeRef.current?.(data);
    }
  }, [data]);

  /* ---- helpers ---- */
  const update = useCallback(<K extends keyof ServiceEditData>(key: K, val: ServiceEditData[K]) => {
    setData((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleDetailsChange = useCallback((details: ServiceDetailsData) => {
    setData((prev) => ({ ...prev, details }));
  }, []);

  const handleDeliveryMethodChange = useCallback((method: DeliveryMethod | '') => {
    setData((prev) => ({
      ...prev,
      deliveryMethod: method,
      // reset address / branch when switching method
      deliveryAddress: method === prev.deliveryMethod ? prev.deliveryAddress : {},
      pickupBranch: method === prev.deliveryMethod ? prev.pickupBranch : '',
    }));
    // When switching to installation/shipping, reset address state for saved address picker
    if (method !== data.deliveryMethod && (method === 'installation' || method === 'shipping')) {
      if (savedAddresses.length > 0) {
        setUseNewAddress(false);
        const def = savedAddresses.find(a => a.is_default);
        setSelectedAddressId(def?.id || savedAddresses[0].id);
      }
    }
  }, [data.deliveryMethod, savedAddresses]);

  /* ---- file handling ---- */
  const handleFileChange = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const valid: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
      if (f.size > MAX_FILE_SIZE) continue;
      valid.push(f);
    }
    if (valid.length > 0) {
      setData((prev) => ({ ...prev, newFiles: [...prev.newFiles, ...valid] }));
    }
  }, []);

  const removeNewFile = useCallback((idx: number) => {
    setData((prev) => ({ ...prev, newFiles: prev.newFiles.filter((_, i) => i !== idx) }));
  }, []);

  const removeExistingAttachment = useCallback((attachmentId: string) => {
    setData((prev) => ({
      ...prev,
      removedAttachmentIds: [...prev.removedAttachmentIds, attachmentId],
    }));
  }, []);

  /* ---- computed ---- */
  const serviceType = data.details.service_type as ServiceId | '';
  const availableMethods = useMemo(
    () => getDeliveryMethodsForService(serviceType, data.details.subtipo as string | undefined),
    [serviceType, data.details.subtipo]
  );
  const isSingleNotApplicable = availableMethods.length === 1 && availableMethods[0] === 'not_applicable';
  const minDate = useMemo(() => getMinDateForService(serviceType), [serviceType]);
  const isRouteBasedPubMovil = serviceType === 'publicidad-movil' &&
    ['vallas-moviles', 'publibuses', 'perifoneo'].includes(data.details.subtipo as string || '');

  const visibleAttachments = useMemo(
    () => data.existingAttachments.filter((a) => !data.removedAttachmentIds.includes(a.id)),
    [data.existingAttachments, data.removedAttachmentIds]
  );

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === data.pickupBranch),
    [branches, data.pickupBranch]
  );

  /* ---- detect if user actually changed anything ---- */
  const hasChanges = useMemo(() => {
    const ini = initialRef.current;

    // Helper: build a stable snapshot of details for comparison,
    // stripping volatile/derived fields that get regenerated on mount.
    const snapshot = (d: ServiceDetailsData): string => {
      const copy = { ...d } as Record<string, unknown>;
      // Internal route arrays have random IDs → strip them
      delete copy._vallasRoutes;
      delete copy._pubRoutes;
      delete copy._perifoneoRoutes;
      // `rutas` is rebuilt by ServiceFormFields on mount → strip it too
      delete copy.rutas;
      return JSON.stringify(copy);
    };

    // Helper: extract meaningful route data (without random ids) for comparison
    const routeSnapshot = (d: ServiceDetailsData): string => {
      const routes =
        (d._vallasRoutes as Array<Record<string, unknown>> | undefined) ||
        (d._pubRoutes as Array<Record<string, unknown>> | undefined) ||
        (d._perifoneoRoutes as Array<Record<string, unknown>> | undefined) ||
        [];
      return JSON.stringify(
        routes.map((r) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...rest } = r;
          return rest;
        })
      );
    };

    if (snapshot(data.details) !== snapshot(ini.details)) return true;
    if (routeSnapshot(data.details) !== routeSnapshot(ini.details)) return true;
    if (data.deliveryMethod !== ini.deliveryMethod) return true;
    if (JSON.stringify(data.deliveryAddress) !== JSON.stringify(ini.deliveryAddress)) return true;
    if (data.pickupBranch !== ini.pickupBranch) return true;
    if (data.requiredDate !== ini.requiredDate) return true;
    if (data.comments !== ini.comments) return true;
    if (JSON.stringify(data.routeComments) !== JSON.stringify(ini.routeComments)) return true;
    if (data.newFiles.length > 0) return true;
    if (data.removedAttachmentIds.length > 0) return true;
    return false;
  }, [data]);

  /* ================================================================
     RENDER
     ================================================================ */

  return (
    <div className="space-y-5 rounded-xl border-2 border-cmyk-cyan/30 bg-neutral-900/60 p-4 sm:p-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-white">{label}</h3>
          {isVendorAdded && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
              Agregado por el vendedor
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/30 transition-colors"
        >
          <TrashIcon className="h-4 w-4" />
          Eliminar servicio
        </button>
      </div>

      {/* ---- Service details fields (ServiceFormFields) ---- */}
      <div className="rounded-lg border border-neutral-700 bg-neutral-800/30 p-4">
        <ServiceFormFields
          value={data.details}
          onChange={handleDetailsChange}
          disabled={false}
          hideRoutePricing
          routeComments={isRouteBasedPubMovil ? data.routeComments : undefined}
          onRouteCommentsChange={isRouteBasedPubMovil ? (rc) => update('routeComments', rc) : undefined}
        />
      </div>

      {/* ---- Delivery method ---- */}
      {!isSingleNotApplicable && (
        <div className="space-y-3 border border-neutral-700 rounded-xl p-4 bg-neutral-800/30">
          <label className="text-sm font-semibold text-white flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 text-cmyk-cyan" />
            Método de entrega
          </label>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
            {availableMethods.filter((m) => m !== 'not_applicable').map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => handleDeliveryMethodChange(data.deliveryMethod === method ? '' : method as DeliveryMethod)}
                className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-all ${
                  data.deliveryMethod === method
                    ? 'border-cmyk-magenta bg-cmyk-magenta/15 text-white ring-2 ring-cmyk-magenta/50'
                    : 'border-neutral-600 bg-neutral-800 text-neutral-300 hover:border-neutral-400 hover:bg-neutral-700'
                }`}
              >
                <span className="text-lg">{DELIVERY_METHOD_ICONS[method as DeliveryMethod]}</span>
                <span>{DELIVERY_METHOD_LABELS[method as DeliveryMethod]?.es || method}</span>
              </button>
            ))}
          </div>

          {/* Address form for installation / shipping */}
          {(data.deliveryMethod === 'installation' || data.deliveryMethod === 'shipping') && (
            <div className="space-y-3 mt-3">
              <p className="text-sm text-cmyk-cyan font-medium">
                {data.deliveryMethod === 'installation'
                  ? '📍 Dirección donde se realizará la instalación'
                  : '📦 Dirección de envío'}
              </p>

              {/* Saved addresses picker (logged-in users with addresses) */}
              {savedAddresses.length > 0 && !useNewAddress ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedAddressId === addr.id
                            ? 'border-cmyk-magenta bg-cmyk-magenta/10 ring-2 ring-cmyk-magenta/50'
                            : 'border-neutral-600 bg-neutral-800 hover:border-neutral-400'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`text-sm mt-0.5 ${selectedAddressId === addr.id ? 'text-cmyk-cyan' : 'text-neutral-500'}`}>📍</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{addr.label || 'Dirección'}</span>
                              {addr.is_default && <span className="text-xs text-cmyk-cyan">(Predeterminada)</span>}
                            </div>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              {addr.calle} {addr.numero_exterior}{addr.numero_interior ? ` Int. ${addr.numero_interior}` : ''}, {addr.colonia}, {addr.ciudad}, {addr.estado} C.P. {addr.codigo_postal}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUseNewAddress(true);
                      // Pre-fill form with existing address data if available
                      if (Object.keys(data.deliveryAddress).length === 0) {
                        update('deliveryAddress', { calle: '', numero_exterior: '', numero_interior: '', colonia: '', ciudad: '', estado: '', codigo_postal: '', referencia: '' });
                      }
                    }}
                    className="text-sm text-cmyk-cyan hover:underline font-medium"
                  >
                    + Usar otra dirección
                  </button>
                </div>
              ) : (
                <>
                  {/* Back to saved addresses link */}
                  {savedAddresses.length > 0 && useNewAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        setUseNewAddress(false);
                        const def = savedAddresses.find(a => a.is_default);
                        setSelectedAddressId(def?.id || savedAddresses[0].id);
                      }}
                      className="text-sm text-cmyk-cyan hover:underline font-medium mb-1"
                    >
                      ← Usar una dirección guardada
                    </button>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-neutral-400">Calle *</label>
                      <input type="text" value={data.deliveryAddress.calle || ''}
                        onChange={(e) => update('deliveryAddress', { ...data.deliveryAddress, calle: e.target.value })}
                        className="w-full mt-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50"
                        placeholder="Calle" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-neutral-400">No. Ext *</label>
                        <input type="text" value={data.deliveryAddress.numero_exterior || ''}
                          onChange={(e) => update('deliveryAddress', { ...data.deliveryAddress, numero_exterior: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50"
                          placeholder="#" />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-400">No. Int</label>
                        <input type="text" value={data.deliveryAddress.numero_interior || ''}
                          onChange={(e) => update('deliveryAddress', { ...data.deliveryAddress, numero_interior: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50"
                          placeholder="Opcional" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400">Colonia *</label>
                      <input type="text" value={data.deliveryAddress.colonia || ''}
                        onChange={(e) => update('deliveryAddress', { ...data.deliveryAddress, colonia: e.target.value })}
                        className="w-full mt-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50"
                        placeholder="Colonia" />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400">Ciudad *</label>
                      <input type="text" value={data.deliveryAddress.ciudad || ''}
                        onChange={(e) => update('deliveryAddress', { ...data.deliveryAddress, ciudad: e.target.value })}
                        className="w-full mt-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50"
                        placeholder="Ciudad" />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400">Estado *</label>
                      <input type="text" value={data.deliveryAddress.estado || ''}
                        onChange={(e) => update('deliveryAddress', { ...data.deliveryAddress, estado: e.target.value })}
                        className="w-full mt-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50"
                        placeholder="Estado" />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400">C.P. *</label>
                      <input type="text" value={data.deliveryAddress.codigo_postal || ''}
                        onChange={(e) => update('deliveryAddress', { ...data.deliveryAddress, codigo_postal: e.target.value })}
                        className="w-full mt-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50"
                        placeholder="C.P." maxLength={5} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-neutral-400">Referencia</label>
                      <input type="text" value={data.deliveryAddress.referencia || ''}
                        onChange={(e) => update('deliveryAddress', { ...data.deliveryAddress, referencia: e.target.value })}
                        className="w-full mt-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50"
                        placeholder="Punto de referencia (opcional)" />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Branch picker for pickup */}
          {data.deliveryMethod === 'pickup' && (
            <div className="mt-3 space-y-2">
              {branchesLoading ? (
                <p className="text-neutral-400 text-sm">Cargando sucursales…</p>
              ) : branches.length === 0 ? (
                <p className="text-neutral-400 text-sm">No hay sucursales disponibles.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => update('pickupBranch', data.pickupBranch === branch.id ? '' : branch.id)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        data.pickupBranch === branch.id
                          ? 'border-cmyk-magenta bg-cmyk-magenta/10 ring-2 ring-cmyk-magenta/50'
                          : 'border-neutral-600 bg-neutral-800 hover:border-neutral-400'
                      }`}
                    >
                      <p className="font-medium text-white text-sm">{branch.name}</p>
                      <p className="text-neutral-400 text-xs mt-0.5">{branch.full_address}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Digital delivery confirmation */}
          {data.deliveryMethod === 'digital' && (
            <p className="text-sm text-neutral-400 mt-2">
              ✅ La entrega será de forma digital (correo electrónico o enlace de descarga).
            </p>
          )}
        </div>
      )}

      {/* ---- Required date ---- */}
      {!isRouteBasedPubMovil && (
        <div className="space-y-2 border border-neutral-700 rounded-xl p-4 bg-neutral-800/30">
          <label className="text-sm font-semibold text-white flex items-center gap-2">
            <CalendarDaysIcon className="h-4 w-4 text-cmyk-cyan" />
            Fecha requerida
          </label>
          <input
            type="date"
            value={data.requiredDate}
            min={minDate}
            onChange={(e) => update('requiredDate', e.target.value)}
            className="w-full sm:w-auto rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50"
          />
          <p className="text-xs text-amber-400/80">
            ⏱️ Tiempo mínimo: {SERVICE_MIN_BUSINESS_DAYS[serviceType] ?? 8} días hábiles
          </p>
        </div>
      )}

      {/* ---- Vendor estimated delivery (read-only) ---- */}
      {vendorEstimatedDate && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <CalendarDaysIcon className="h-4 w-4 text-green-400" />
          <span className="text-sm text-neutral-300">Fecha de entrega estimada:</span>
          <span className="text-sm font-semibold text-green-400">{vendorEstimatedDate}</span>
        </div>
      )}

      {/* ---- Comments ---- */}
      {!isRouteBasedPubMovil && (
        <div className="space-y-2 border border-neutral-700 rounded-xl p-4 bg-neutral-800/30">
          <label className="text-sm font-semibold text-white flex items-center gap-2">
            <ChatBubbleLeftIcon className="h-4 w-4 text-cmyk-cyan" />
            Comentarios
          </label>
          <textarea
            value={data.comments}
            onChange={(e) => update('comments', e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:ring-1 focus:ring-cmyk-cyan/50 resize-none"
            placeholder="Describe los cambios o especificaciones adicionales…"
          />
          <p className="text-xs text-neutral-500 text-right">{data.comments.length} / 2000</p>
        </div>
      )}

      {/* ---- Attachments ---- */}
      <div className="space-y-3 border border-neutral-700 rounded-xl p-4 bg-neutral-800/30">
        <label className="text-sm font-semibold text-white flex items-center gap-2">
          <PaperClipIcon className="h-4 w-4 text-cmyk-cyan" />
          Archivos adjuntos
        </label>

        {/* Existing attachments */}
        {visibleAttachments.length > 0 && (
          <div className="space-y-1">
            {visibleAttachments.map((att) => (
              <div key={att.id} className="flex items-center justify-between p-2 rounded-lg bg-neutral-800/60">
                <a href={att.file} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-cmyk-cyan hover:underline truncate flex-1">
                  📎 {att.filename}
                </a>
                <button type="button" onClick={() => removeExistingAttachment(att.id)}
                  className="ml-2 text-red-400 hover:text-red-300 text-xs flex-shrink-0">
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* New files */}
        {data.newFiles.length > 0 && (
          <div className="space-y-1">
            {data.newFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-neutral-800/60">
                <span className="text-sm text-white truncate flex-1">
                  📄 {f.name} <span className="text-neutral-500">({(f.size / 1024).toFixed(0)} KB)</span>
                </span>
                <button type="button" onClick={() => removeNewFile(i)}
                  className="ml-2 text-red-400 hover:text-red-300 text-xs flex-shrink-0">
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-cmyk-magenta bg-cmyk-magenta/10'
              : 'border-neutral-600 hover:border-cmyk-magenta hover:bg-cmyk-magenta/5'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(e.dataTransfer.files); }}
        >
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={(e) => { handleFileChange(e.target.files); e.target.value = ''; }}
            accept=".pdf,.jpg,.jpeg,.png,.ai,.cdr,.dxf,.svg,.mp3,.wav,.ogg,.m4a" />
          <PlusIcon className="h-6 w-6 text-neutral-400 mx-auto" />
          <p className="text-white font-medium text-sm mt-1">Arrastra archivos o haz clic</p>
          <p className="text-neutral-500 text-xs mt-0.5">PDF, JPG, PNG, AI, CDR, DXF, SVG, MP3, WAV (max 10MB)</p>
        </div>
      </div>

      {/* ---- Validation errors ---- */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-1">
          <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-4 w-4" />
            Corrige los siguientes errores:
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i} className="text-sm text-red-300">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Action buttons (only shown when user changed something) ---- */}
      {hasChanges && (
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-700">
        <button
          type="button"
          onClick={() => {
            setValidationErrors([]);
            // Reset data back to initial state and close accordion
            setData(initialRef.current);
            onDataChange?.(initialRef.current);
            onCancel();
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-700 border border-neutral-600 transition-colors"
        >
          <XMarkIcon className="h-4 w-4" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            // Resolve saved address before validation
            const resolvedData = { ...data };
            if (
              (data.deliveryMethod === 'installation' || data.deliveryMethod === 'shipping') &&
              !useNewAddress && selectedAddressId && savedAddresses.length > 0
            ) {
              const sa = savedAddresses.find(a => a.id === selectedAddressId);
              if (sa) {
                resolvedData.deliveryAddress = {
                  calle: sa.calle,
                  numero_exterior: sa.numero_exterior,
                  numero_interior: sa.numero_interior || '',
                  colonia: sa.colonia,
                  ciudad: sa.ciudad,
                  estado: sa.estado,
                  codigo_postal: sa.codigo_postal,
                  referencia: sa.referencia || '',
                };
              }
            }

            // Validate before saving
            const errs = validateServiceEditData(resolvedData);
            if (errs.length > 0) {
              setValidationErrors(errs);
              return;
            }
            setValidationErrors([]);
            onSave(resolvedData);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-cmyk-cyan hover:bg-cmyk-cyan/80 transition-colors"
        >
          <CheckIcon className="h-4 w-4" />
          Guardar cambios
        </button>
      </div>
      )}
    </div>
  );
}

/* ================================================================
   Helper: Build ServiceEditData from existing quote data
   ================================================================ */

/**
 * Transform backend `rutas` array into internal `_vallasRoutes` format.
 * Backend format: { numero, fecha_inicio, fecha_fin, horario_inicio, horario_fin, cantidad, unidad, precio_unitario, ruta: { punto_a, punto_b, distancia_metros, duracion_segundos, coordenadas } }
 * Internal format: ConfigurableRouteEntry[]
 */
function transformRutasToVallasRoutes(
  rutas: Array<Record<string, unknown>>
): ConfigurableRouteEntry[] {
  if (!rutas || rutas.length === 0) return [];
  return rutas.map((r) => {
    const rutaObj = r.ruta as Record<string, unknown> | null;
    let route: ConfigurableRouteEntry['route'] = null;
    let clientRouteInfo: ConfigurableRouteEntry['clientRouteInfo'] = null;

    if (rutaObj) {
      const puntoA = rutaObj.punto_a as { name?: string; lat?: number; lon?: number } | null;
      const puntoB = rutaObj.punto_b as { name?: string; lat?: number; lon?: number } | null;
      const coords = rutaObj.coordenadas as Array<[number, number]> | null;
      const dist = rutaObj.distancia_metros as number | null;
      const dur = rutaObj.duracion_segundos as number | null;

      if (puntoA || puntoB) {
        route = {
          pointA: puntoA ? { name: puntoA.name || '', lat: puntoA.lat || 0, lon: puntoA.lon || 0 } : null,
          pointB: puntoB ? { name: puntoB.name || '', lat: puntoB.lat || 0, lon: puntoB.lon || 0 } : null,
          routeData: coords ? { coordinates: coords, distance: dist || 0, duration: dur || 0 } : null,
        };
        // Also set clientRouteInfo for read-only display
        clientRouteInfo = {
          punto_a: puntoA || null,
          punto_b: puntoB || null,
          distancia_metros: dist,
          duracion_segundos: dur,
        };
      }
    }

    return {
      id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      fechaInicio: (r.fecha_inicio as string) || '',
      fechaFin: (r.fecha_fin as string) || '',
      horarioInicio: (r.horario_inicio as string) || '',
      horarioFin: (r.horario_fin as string) || '',
      route,
      cantidad: (r.cantidad as number) || 1,
      unidad: (r.unidad as string) || 'servicio',
      unit_price: (r.precio_unitario as number) || 0,
      estimated_date: (r.estimated_date as string) || undefined,
      vendorDescription: (r.vendorDescription as string) || undefined,
      clientRouteInfo,
    };
  });
}

/**
 * Transform backend `rutas` array into internal `_pubRoutes` format.
 * Backend format: { numero, ruta_preestablecida, fecha_inicio, fecha_fin, cantidad, unidad, precio_unitario }
 * Internal format: EstablishedRouteEntry[]
 */
function transformRutasToPubRoutes(
  rutas: Array<Record<string, unknown>>
): EstablishedRouteEntry[] {
  if (!rutas || rutas.length === 0) return [];
  return rutas.map((r) => ({
    id: `er-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    ruta: (r.ruta_preestablecida as string) || '',
    fechaInicio: (r.fecha_inicio as string) || '',
    cantidad: (r.cantidad as number) || 1,
    unidad: (r.unidad as string) || 'servicio',
    unit_price: (r.precio_unitario as number) || 0,
    estimated_date: (r.estimated_date as string) || undefined,
    vendorDescription: (r.vendorDescription as string) || undefined,
  }));
}

/**
 * Build an InlineServiceEditor initial state from a QuoteRequestService
 * and its matched QuoteLines.
 */
export function buildServiceEditData(opts: {
  serviceType: string;
  serviceDetails: Record<string, unknown> | undefined;
  deliveryMethod?: string;
  deliveryAddress?: Record<string, string>;
  pickupBranch?: string;
  requiredDate?: string;
  comments?: string;
  routeComments?: Record<number, string>;
  attachments?: Array<{ id: string; file: string; filename: string }>;
}): ServiceEditData {
  const sd = { ...((opts.serviceDetails || {}) as Record<string, unknown>) };
  const serviceType = (opts.serviceType || '') as ServiceId | '';
  const subtipo = sd.subtipo as string | undefined;

  // ── Transform backend rutas → internal route arrays ──
  const rutas = sd.rutas as Array<Record<string, unknown>> | undefined;
  if (serviceType === 'publicidad-movil' && rutas && rutas.length > 0) {
    if (subtipo === 'vallas-moviles') {
      sd._vallasRoutes = transformRutasToVallasRoutes(rutas);
    } else if (subtipo === 'publibuses') {
      sd._pubRoutes = transformRutasToPubRoutes(rutas);
    } else if (subtipo === 'perifoneo') {
      sd._perifoneoRoutes = transformRutasToVallasRoutes(rutas);
    }
  }

  // ── Normalize delivery address keys (backend stores English keys) ──
  const rawAddr = opts.deliveryAddress || {};
  const normalizedAddr: Record<string, string> = {};
  if (Object.keys(rawAddr).length > 0) {
    // Map English keys → Spanish keys (the frontend uses Spanish keys everywhere)
    const engToSpa: Record<string, string> = {
      street: 'calle', exterior_number: 'numero_exterior',
      interior_number: 'numero_interior', neighborhood: 'colonia',
      city: 'ciudad', state: 'estado',
      postal_code: 'codigo_postal', reference: 'referencia',
    };
    for (const [k, v] of Object.entries(rawAddr)) {
      const spanishKey = engToSpa[k] || k; // if already Spanish, keep as-is
      if (!normalizedAddr[spanishKey]) {
        normalizedAddr[spanishKey] = v || '';
      }
    }
  }

  return {
    serviceType,
    details: {
      service_type: serviceType,
      ...sd,
    } as ServiceDetailsData,
    deliveryMethod: (opts.deliveryMethod || '') as DeliveryMethod | '',
    deliveryAddress: normalizedAddr,
    pickupBranch: opts.pickupBranch || '',
    requiredDate: opts.requiredDate || '',
    comments: opts.comments || '',
    routeComments: opts.routeComments || {},
    newFiles: [],
    existingAttachments: opts.attachments || [],
    removedAttachmentIds: [],
  };
}
