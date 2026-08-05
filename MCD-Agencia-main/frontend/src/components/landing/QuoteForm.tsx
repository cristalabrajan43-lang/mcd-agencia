'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { trackEvent, trackingEvents } from '@/lib/tracking';
import { useLegalModal } from '@/contexts/LegalModalContext';
import { CONTACT_INFO } from '@/lib/constants';
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
  type ServiceId,
  DELIVERY_METHOD_LABELS,
  DELIVERY_METHOD_ICONS,
  type DeliveryMethod,
  getDeliveryMethodsForService,
} from '@/lib/service-ids';
import dynamic from 'next/dynamic';

// Dynamic import with SSR disabled for Leaflet-based component
const RouteSelector = dynamic(
  () => import('./RouteSelector').then(mod => mod.RouteSelector),
  {
    ssr: false,
    loading: () => (
      <div className="w-full p-4 rounded-xl border-2 border-dashed border-cmyk-cyan/50 bg-cmyk-black/30">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cmyk-cyan"></div>
          <span className="text-gray-400">Cargando mapa...</span>
        </div>
      </div>
    )
  }
);
import { useRecaptcha } from '@/hooks';
import { usePostalCode } from '@/hooks/usePostalCode';
import { useAuth } from '@/contexts/AuthContext';
import { getUserAddresses, type UserAddress } from '@/lib/api/auth';
import { SuccessModal } from '@/components/ui';
import { getBranches, type Branch } from '@/lib/api/content';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

// Service labels for display
const serviceLabels: Record<ServiceId, string> = {
  'espectaculares': 'Espectaculares',
  'fabricacion-anuncios': 'Fabricación de anuncios',
  'publicidad-movil': 'Publicidad móvil',
  'impresion-gran-formato': 'Impresión en gran formato',
  'senalizacion': 'Señalización',
  'rotulacion-vehicular': 'Rotulación vehicular',
  'corte-grabado-cnc-laser': 'Corte y grabado CNC/láser',
  'diseno-grafico': 'Diseño gráfico',
  'impresion-offset-serigrafia': 'Impresión offset/serigrafía',
  'otros': 'Otro servicio (especificar)',
};

interface RouteInfo {
  pointA: { name: string; lat: number; lon: number } | null;
  pointB: { name: string; lat: number; lon: number } | null;
  routeData: { coordinates: Array<[number, number]>; distance: number; duration: number } | null;
}

// Multi-route entry for vallas/perifoneo (configurable map route + schedule)
interface ConfigurableRouteEntry {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  horarioInicio: string;
  horarioFin: string;
  route: RouteInfo | null;
  comentarios: string;
  archivos: File[];
}

// Multi-route entry for publibuses (established route + schedule)
interface EstablishedRouteEntry {
  id: string;
  ruta: string;
  fechaInicio: string;
  comentarios: string;
  archivos: File[];
}

const createConfigurableRoute = (): ConfigurableRouteEntry => ({
  id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
  fechaInicio: '',
  fechaFin: '',
  horarioInicio: '',
  horarioFin: '',
  route: null,
  comentarios: '',
  archivos: [],
});

const createEstablishedRoute = (): EstablishedRouteEntry => ({
  id: `er-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
  ruta: '',
  fechaInicio: '',
  comentarios: '',
  archivos: [],
});

// Helper: add N months to a date string (YYYY-MM-DD) and return YYYY-MM-DD
const addMonths = (dateStr: string, months: number): string => {

  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};

/**
 * Add N business days (Mon–Fri) to a given date.
 * Returns a YYYY-MM-DD string.
 */
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

/**
 * Minimum delivery/start date in business days per service type.
 * Rules:
 *  - impresion-gran-formato: 1 business day (lonas/viniles < 40m²)
 *  - impresion-offset-serigrafia: 5 business days
 *  - everything else: 8 business days
 */
const SERVICE_MIN_BUSINESS_DAYS: Record<string, number> = {
  'impresion-gran-formato': 1,
  'impresion-offset-serigrafia': 5,
  // All others default to 8
};

const getMinBusinessDays = (service: string): number => {
  return SERVICE_MIN_BUSINESS_DAYS[service] ?? 8;
};

const getMinDateForService = (service: string): string => {
  if (!service) return new Date().toISOString().split('T')[0];
  const days = getMinBusinessDays(service);
  return addBusinessDays(new Date(), days);
};

const DELIVERY_TIME_MESSAGES: Record<string, string> = {
  'impresion-gran-formato': 'Lonas y viniles menores a 40m² pueden entregarse al día siguiente hábil. Los días se cuentan a partir de la concreción del pedido (pago realizado).',
  'impresion-offset-serigrafia': 'Tiempo de entrega estimado: 5 a 8 días hábiles a partir de la concreción del pedido (pago realizado).',
  'fabricacion-anuncios': 'Tiempo de entrega estimado: mínimo 8 días hábiles (depende del tamaño del producto). Los días se cuentan a partir de la concreción del pedido (pago realizado).',
  'espectaculares': 'Tiempo de entrega estimado: mínimo 8 días hábiles (depende del tamaño). Los días se cuentan a partir de la concreción del pedido (pago realizado).',
  'publicidad-movil': 'La fecha mínima de inicio del servicio es de 8 días hábiles. Los días se cuentan a partir de la concreción del pedido (pago realizado).',
  '_default': 'Tiempo de entrega estimado: mínimo 8 días hábiles a partir de la concreción del pedido (pago realizado).',
};

// Form data structure
interface QuoteFormData {
  // Global fields
  nombre: string;
  empresa?: string;
  telefono: string;
  email: string;
  fechaRequerida: string;
  servicio: ServiceId | '';
  comentarios?: string;
  privacidad: boolean;

  // Espectaculares
  esp_tipo?: 'unipolar' | 'azotea' | 'mural' | 'otro';
  esp_tipoOtro?: string;
  esp_medidas?: string;
  esp_tiempoExhibicion?: string;
  esp_impresionIncluida?: 'si' | 'no';

  // Fabricación de anuncios
  fab_tipoAnuncio?: string;
  fab_tipoOtro?: string;
  fab_medidas?: string;
  fab_uso?: 'interior' | 'exterior';
  fab_iluminacion?: 'si' | 'no';

  // Publicidad móvil
  pub_subtipo?: 'vallas-moviles' | 'publibuses' | 'perifoneo' | 'otro';
  pub_subtipoOtro?: string;
  pub_otroDescripcion?: string;
  // Vallas móviles
  // (only routes — cantidad/zona/impresion removed)
  // Publibuses
  pub_mesesCampana?: number;
  // (ciudadZona/impresion removed)
  // Perifoneo
  pub_requiereGrabacion?: 'si' | 'no';
  // (zonaCobertura/archivoGrabacion removed)
  pub_descripcionZona?: string;

  // Impresión gran formato
  igf_material?: string;
  igf_materialOtro?: string;
  igf_medidas?: string;
  igf_cantidad?: number;
  igf_archivoListo?: 'si' | 'no';

  // Señalización
  sen_tipo?: 'interior' | 'exterior' | 'vial' | 'otro';
  sen_tipoOtro?: string;
  sen_medidas?: string;
  sen_cantidad?: number;

  // Rotulación vehicular
  rot_tipoVehiculo?: string;
  rot_tipoRotulacion?: string;
  rot_tipoRotulacionOtro?: string;
  rot_disenoIncluido?: 'si' | 'no';

  // Corte y grabado CNC/Láser
  cnc_tipo?: 'router-cnc' | 'corte-laser' | 'grabado-laser' | 'otro';
  cnc_tipoOtro?: string;
  cnc_medidas?: string;
  cnc_cantidad?: number;
  cnc_archivoListo?: 'si' | 'no';

  // Diseño gráfico
  dis_tipo?: 'logotipos' | 'papeleria' | 'redes-sociales' | 'otro';
  dis_tipoOtro?: string;
  dis_numeroPiezas?: number;
  dis_medidas?: string;
  dis_usoDiseno?: 'impresion' | 'digital' | 'ambos';
  dis_cambiosIncluidos?: 'si' | 'no';

  // Tarjetas de Presentación, Volantes y Otro
  off_producto?: string;
  off_productoOtro?: string;
  off_cantidad?: number;
  off_archivoListo?: 'si' | 'no';

  // Servicio "Otros"
  otros_tipoServicio?: string;
  otros_descripcion?: string;
  otros_medidas?: string;
  otros_cantidad?: number;

  // Honeypot
  website?: string;
}

// Saved service entry for multi-service requests
interface SavedServiceEntry {
  id: string;
  serviceType: ServiceId;
  serviceLabel: string;
  serviceDetails: Record<string, unknown>;
  deliveryMethod: DeliveryMethod | '';
  deliveryAddress: Record<string, string>;
  pickupBranch: string;
  requiredDate: string;
  comments: string;
  files: File[];
  // Route data (publicidad-movil)
  vallasRoutes?: ConfigurableRouteEntry[];
  perifoneoRoutes?: ConfigurableRouteEntry[];
  pubRoutes?: EstablishedRouteEntry[];
  // Raw form values for restoring into form when editing
  rawFormValues: Partial<QuoteFormData>;
}

export function QuoteForm() {
  const t = useTranslations('landing.quoteForm');
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();
  const { openPrivacy } = useLegalModal();
  const { user } = useAuth();
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [vallasRoutes, setVallasRoutes] = useState<ConfigurableRouteEntry[]>([createConfigurableRoute()]);
  const [perifoneoRoutes, setPerifoneoRoutes] = useState<ConfigurableRouteEntry[]>([createConfigurableRoute()]);
  const [pubRoutes, setPubRoutes] = useState<EstablishedRouteEntry[]>([createEstablishedRoute()]);
  const [selectionFeedback, setSelectionFeedback] = useState<{ service: string; subtype: string } | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | ''>('');
  const [deliveryError, setDeliveryError] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState({
    calle: '', numero_exterior: '', numero_interior: '', colonia: '', ciudad: '', estado: '', codigo_postal: '', referencia: '',
  });
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState(false);
  const postalCode = usePostalCode();
  const [coloniaManual, setColoniaManual] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRestoringServiceRef = useRef(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Multi-service state
  const [savedServices, setSavedServices] = useState<SavedServiceEntry[]>([]);

  // Saved addresses for logged-in users
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [useNewAddress, setUseNewAddress] = useState(false);

  // Fetch branches for pickup option
  const fetchBranches = async () => {
    setBranchesLoading(true);
    setBranchesError(false);
    try {
      const data = await getBranches();
      setBranches(data);
    } catch {
      setBranchesError(true);
    } finally {
      setBranchesLoading(false);
    }
  };
  useEffect(() => { fetchBranches(); }, []);

  // Fetch saved addresses if user is logged in
  useEffect(() => {
    if (user) {
      getUserAddresses()
        .then((addrs) => {
          setSavedAddresses(addrs);
          const def = addrs.find((a) => a.is_default);
          if (addrs.length > 0) {
            setSelectedAddressId(def?.id || addrs[0].id);
            setUseNewAddress(false);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<QuoteFormData>({
    defaultValues: {
      servicio: '',
      privacidad: false,
    },
  });

  const servicioValue = watch('servicio');
  const pubSubtipo = watch('pub_subtipo');
  const espTipo = watch('esp_tipo');
  const fabTipoAnuncio = watch('fab_tipoAnuncio');
  const igfMaterial = watch('igf_material');
  const rotTipoRotulacion = watch('rot_tipoRotulacion');
  const offProducto = watch('off_producto');
  const senTipo = watch('sen_tipo');
  const cncTipo = watch('cnc_tipo');
  const disTipo = watch('dis_tipo');
  const pubMesesCampana = watch('pub_mesesCampana');
  const pubRequiereGrabacion = watch('pub_requiereGrabacion');

  // Pre-fill form fields from logged-in user profile
  useEffect(() => {
    if (user) {
      setValue('nombre', user.full_name || `${user.first_name} ${user.last_name}`.trim());
      setValue('email', user.email);
      if (user.phone) setValue('telefono', user.phone);
      if (user.company) setValue('empresa', user.company);
      if (user.default_delivery_address && Object.values(user.default_delivery_address).some(v => v)) {
        setDeliveryAddress(prev => ({
          ...prev,
          ...user.default_delivery_address,
        }));
      }
    }
  }, [user, setValue]);

  // Read URL hash parameters to pre-select service and subtype
  useEffect(() => {
    const parseHashParams = () => {
      const hash = window.location.hash;
      if (!hash.includes('?')) return;

      const queryString = hash.split('?')[1];
      const params = new URLSearchParams(queryString);
      const servicio = params.get('servicio') as ServiceId | null;
      const subtipo = params.get('subtipo');

      if (servicio && SERVICE_IDS.includes(servicio)) {
        setValue('servicio', servicio);

        let subtipoLabel = '';

        // Set subtipo based on service
        if (subtipo) {
          if (servicio === 'espectaculares' && ESPECTACULARES_TIPOS.includes(subtipo as typeof ESPECTACULARES_TIPOS[number])) {
            setValue('esp_tipo', subtipo as 'unipolar' | 'azotea' | 'mural' | 'otro');
            subtipoLabel = subtipo === 'otro' ? 'Otro (especificar)' : subtipo === 'unipolar' ? 'Unipolar' : subtipo === 'azotea' ? 'Azotea' : 'Mural publicitario';
          } else if (servicio === 'publicidad-movil' && PUBLICIDAD_MOVIL_SUBTIPOS.includes(subtipo as typeof PUBLICIDAD_MOVIL_SUBTIPOS[number])) {
            setValue('pub_subtipo', subtipo as 'vallas-moviles' | 'publibuses' | 'perifoneo' | 'otro');
            subtipoLabel = subtipo === 'otro' ? 'Otro (especificar)' : subtipo === 'vallas-moviles' ? 'Vallas móviles' : subtipo === 'publibuses' ? 'Publibuses' : 'Perifoneo';
          } else if (servicio === 'fabricacion-anuncios' && FABRICACION_ANUNCIOS_TIPOS.includes(subtipo as typeof FABRICACION_ANUNCIOS_TIPOS[number])) {
            setValue('fab_tipoAnuncio', subtipo);
            subtipoLabel = subtipo === 'otro' ? 'Otro (especificar)' : subtipo === 'cajas-luz' ? 'Cajas de luz' : subtipo === 'letras-3d' ? 'Letras 3D' : subtipo === 'neon' ? 'Neón' : subtipo;
          } else if (servicio === 'impresion-gran-formato' && GRAN_FORMATO_MATERIALES.includes(subtipo as typeof GRAN_FORMATO_MATERIALES[number])) {
            setValue('igf_material', subtipo);
            subtipoLabel = subtipo === 'otro' ? 'Otro (especificar)' : subtipo.charAt(0).toUpperCase() + subtipo.slice(1);
          } else if (servicio === 'rotulacion-vehicular' && ROTULACION_TIPOS.includes(subtipo as typeof ROTULACION_TIPOS[number])) {
            setValue('rot_tipoRotulacion', subtipo);
            subtipoLabel = subtipo === 'otro' ? 'Otro (especificar)' : subtipo === 'completa' ? 'Rotulación completa' : subtipo === 'parcial' ? 'Rotulación parcial' : subtipo === 'vinil-recortado' ? 'Vinil recortado' : 'Impresión digital';
          } else if (servicio === 'senalizacion' && SENALIZACION_TIPOS.includes(subtipo as typeof SENALIZACION_TIPOS[number])) {
            setValue('sen_tipo', subtipo as 'interior' | 'exterior' | 'vial' | 'otro');
            subtipoLabel = subtipo === 'otro' ? 'Otro (especificar)' : subtipo === 'interior' ? 'Interior' : subtipo === 'exterior' ? 'Exterior' : 'Vial';
          } else if (servicio === 'corte-grabado-cnc-laser' && CNC_LASER_TIPOS.includes(subtipo as typeof CNC_LASER_TIPOS[number])) {
            setValue('cnc_tipo', subtipo as 'router-cnc' | 'corte-laser' | 'grabado-laser' | 'otro');
            subtipoLabel = subtipo === 'otro' ? 'Otro (especificar)' : subtipo === 'router-cnc' ? 'Router CNC' : subtipo === 'corte-laser' ? 'Corte Láser' : 'Grabado Láser';
          } else if (servicio === 'diseno-grafico' && DISENO_GRAFICO_TIPOS.includes(subtipo as typeof DISENO_GRAFICO_TIPOS[number])) {
            setValue('dis_tipo', subtipo as 'logotipos' | 'papeleria' | 'redes-sociales' | 'otro');
            subtipoLabel = subtipo === 'otro' ? 'Otro (especificar)' : subtipo === 'logotipos' ? 'Logotipos' : subtipo === 'papeleria' ? 'Papelería' : 'Redes Sociales';
          } else if (servicio === 'impresion-offset-serigrafia' && OFFSET_PRODUCTOS.includes(subtipo as typeof OFFSET_PRODUCTOS[number])) {
            setValue('off_producto', subtipo);
            subtipoLabel = subtipo === 'otro' ? 'Otro (especificar)' : subtipo === 'tarjetas-presentacion' ? 'Tarjetas de presentación' : 'Volantes';
          }
        }

        // Show selection feedback
        setSelectionFeedback({
          service: serviceLabels[servicio],
          subtype: subtipoLabel,
        });

        // Clear feedback after 3 seconds
        setTimeout(() => {
          setSelectionFeedback(null);
        }, 3000);

        // Scroll to the service selector (inside Box 2, which is lower than the form top)
        setTimeout(() => {
          const servicioEl = document.getElementById('servicio');
          if (servicioEl) {
            servicioEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            document.getElementById('cotizar')?.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    };

    parseHashParams();
    window.addEventListener('hashchange', parseHashParams);
    return () => window.removeEventListener('hashchange', parseHashParams);
  }, [setValue]);

  // Close any custom dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openDropdown) {
        const ref = dropdownRefs.current[openDropdown];
        if (ref && !ref.contains(e.target as Node)) {
          setOpenDropdown(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  // Get today's date for min date validation
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Minimum date for the "fecha requerida" and route start dates — depends on service
  const minDeliveryDate = useMemo(
    () => servicioValue ? getMinDateForService(servicioValue) : today,
    [servicioValue, today]
  );

  // Minimum date for publicidad-movil route start dates (always 8 business days)
  const minRouteStartDate = useMemo(
    () => addBusinessDays(new Date(), 8),
    []
  );

  // Info message about delivery times for the selected service
  const deliveryTimeMsg = useMemo(
    () => servicioValue
      ? (DELIVERY_TIME_MESSAGES[servicioValue] || DELIVERY_TIME_MESSAGES['_default'])
      : '',
    [servicioValue]
  );

  // Reset service-specific fields when service changes (skip when restoring a saved service)
  useEffect(() => {
    if (isRestoringServiceRef.current) {
      isRestoringServiceRef.current = false;
      return;
    }
    setVallasRoutes([createConfigurableRoute()]);
    setPerifoneoRoutes([createConfigurableRoute()]);
    setPubRoutes([createEstablishedRoute()]);
    setDeliveryMethod('');
    setDeliveryError('');
    setOpenDropdown(null);
    setDeliveryAddress({ calle: '', numero_exterior: '', numero_interior: '', colonia: '', ciudad: '', estado: '', codigo_postal: '', referencia: '' });
    setSelectedBranch('');
    postalCode.reset();
    setColoniaManual(false);
    // Reset to saved address picker if user has saved addresses
    if (savedAddresses.length > 0) {
      setUseNewAddress(false);
      const def = savedAddresses.find((a) => a.is_default);
      setSelectedAddressId(def?.id || savedAddresses[0].id);
    }
  }, [servicioValue]);

  // Capture current service data into savedServices and reset service fields
  const captureCurrentService = (data: QuoteFormData): boolean => {
    if (!data.servicio) return false;

    // Validate required date (unless route-based pub-movil)
    const isRouteBased = data.servicio === 'publicidad-movil' && ['publibuses', 'vallas-moviles', 'perifoneo'].includes(data.pub_subtipo || '');
    if (!isRouteBased && !data.fechaRequerida) {
      setFormStatus('error');
      setErrorMessage('Selecciona la fecha requerida antes de agregar otro servicio');
      return false;
    }

    // Perifoneo: if user does NOT require provider recording, file is mandatory
    if (data.servicio === 'publicidad-movil' && data.pub_subtipo === 'perifoneo' && data.pub_requiereGrabacion === 'no' && selectedFiles.length === 0) {
      setFormStatus('error');
      setErrorMessage('Debes adjuntar el archivo de grabación para perifoneo.');
      return false;
    }

    // Perifoneo: if user requires provider recording, comments are mandatory
    if (data.servicio === 'publicidad-movil' && data.pub_subtipo === 'perifoneo' && data.pub_requiereGrabacion === 'si' && !data.comentarios?.trim()) {
      setFormStatus('error');
      setErrorMessage('En comentarios especifica qué quieres que diga la grabación y la duración deseada.');
      return false;
    }

    // Build details same as buildPayload but only the service part
    const detalles: Record<string, unknown> = {};
    switch (data.servicio) {
      case 'espectaculares':
        Object.assign(detalles, { tipo: data.esp_tipo === 'otro' ? data.esp_tipoOtro : data.esp_tipo, medidas: data.esp_medidas, tiempo_exhibicion: data.esp_tiempoExhibicion, impresion_incluida: data.esp_impresionIncluida === 'si' });
        break;
      case 'fabricacion-anuncios':
        Object.assign(detalles, { tipo_anuncio: data.fab_tipoAnuncio === 'otro' ? data.fab_tipoOtro : data.fab_tipoAnuncio, medidas: data.fab_medidas, uso: data.fab_uso, iluminacion: data.fab_iluminacion === 'si' });
        break;
      case 'publicidad-movil':
        if (data.pub_subtipo === 'vallas-moviles') {
          Object.assign(detalles, { subtipo: 'vallas-moviles', rutas: vallasRoutes.map((r, i) => ({ numero: i + 1, fecha_inicio: r.fechaInicio, fecha_fin: r.fechaFin, horario_inicio: r.horarioInicio, horario_fin: r.horarioFin, comentarios: r.comentarios || null, archivos: r.archivos.map(f => ({ nombre: f.name, tamano: f.size })), ruta: r.route ? { punto_a: r.route.pointA, punto_b: r.route.pointB, distancia_metros: r.route.routeData?.distance, duracion_segundos: r.route.routeData?.duration } : null })) });
        } else if (data.pub_subtipo === 'publibuses') {
          Object.assign(detalles, { subtipo: 'publibuses', meses_campana: data.pub_mesesCampana, rutas: pubRoutes.map((r, i) => ({ numero: i + 1, ruta_preestablecida: r.ruta, fecha_inicio: r.fechaInicio, comentarios: r.comentarios || null, archivos: r.archivos.map(f => ({ nombre: f.name, tamano: f.size })) })) });
        } else if (data.pub_subtipo === 'perifoneo') {
          Object.assign(detalles, { subtipo: 'perifoneo', requiere_grabacion: data.pub_requiereGrabacion === 'si', rutas: perifoneoRoutes.map((r, i) => ({ numero: i + 1, fecha_inicio: r.fechaInicio, fecha_fin: r.fechaFin, horario_inicio: r.horarioInicio, horario_fin: r.horarioFin, comentarios: r.comentarios || null, archivos: r.archivos.map(f => ({ nombre: f.name, tamano: f.size })), ruta: r.route ? { punto_a: r.route.pointA, punto_b: r.route.pointB } : null })) });
        } else if (data.pub_subtipo === 'otro') {
          Object.assign(detalles, { subtipo: data.pub_subtipoOtro, descripcion: data.pub_otroDescripcion });
        }
        break;
      case 'impresion-gran-formato':
        Object.assign(detalles, { material: data.igf_material === 'otro' ? data.igf_materialOtro : data.igf_material, medidas: data.igf_medidas, cantidad: data.igf_cantidad, archivo_listo: data.igf_archivoListo === 'si' });
        break;
      case 'senalizacion':
        Object.assign(detalles, { tipo: data.sen_tipo === 'otro' ? data.sen_tipoOtro : data.sen_tipo, medidas: data.sen_medidas, cantidad: data.sen_cantidad });
        break;
      case 'rotulacion-vehicular':
        Object.assign(detalles, { tipo_vehiculo: data.rot_tipoVehiculo, tipo_rotulacion: data.rot_tipoRotulacion === 'otro' ? data.rot_tipoRotulacionOtro : data.rot_tipoRotulacion, diseno_incluido: data.rot_disenoIncluido === 'si' });
        break;
      case 'corte-grabado-cnc-laser':
        Object.assign(detalles, { tipo: data.cnc_tipo === 'otro' ? data.cnc_tipoOtro : data.cnc_tipo, medidas: data.cnc_medidas, cantidad: data.cnc_cantidad, archivo_listo: data.cnc_archivoListo === 'si' });
        break;
      case 'diseno-grafico':
        Object.assign(detalles, { tipo: data.dis_tipo === 'otro' ? data.dis_tipoOtro : data.dis_tipo, numero_piezas: data.dis_numeroPiezas, medidas: data.dis_medidas, uso: data.dis_usoDiseno, cambios_incluidos: data.dis_cambiosIncluidos === 'si' });
        break;
      case 'impresion-offset-serigrafia':
        Object.assign(detalles, { producto: data.off_producto === 'otro' ? data.off_productoOtro : data.off_producto, cantidad: data.off_cantidad, archivo_listo: data.off_archivoListo === 'si' });
        break;
      case 'otros':
        Object.assign(detalles, { tipo_servicio: data.otros_tipoServicio, descripcion: data.otros_descripcion, medidas: data.otros_medidas, cantidad: data.otros_cantidad });
        break;
    }

    // Compute required_date for route-based services
    let reqDate = data.fechaRequerida || '';
    if (isRouteBased) {
      let allDates: string[] = [];
      if (data.pub_subtipo === 'vallas-moviles') allDates = vallasRoutes.map(r => r.fechaInicio).filter(Boolean);
      else if (data.pub_subtipo === 'publibuses') allDates = pubRoutes.map(r => r.fechaInicio).filter(Boolean);
      else if (data.pub_subtipo === 'perifoneo') allDates = perifoneoRoutes.map(r => r.fechaInicio).filter(Boolean);
      if (allDates.length > 0) { allDates.sort(); reqDate = allDates[0]; }
    }

    // Resolve delivery address from saved address if applicable
    let resolvedAddress = deliveryAddress;
    if ((deliveryMethod === 'installation' || deliveryMethod === 'shipping') && !useNewAddress && selectedAddressId && savedAddresses.length > 0) {
      const sa = savedAddresses.find(a => a.id === selectedAddressId);
      if (sa) {
        resolvedAddress = { calle: sa.calle, numero_exterior: sa.numero_exterior, numero_interior: sa.numero_interior || '', colonia: sa.colonia, ciudad: sa.ciudad, estado: sa.estado, codigo_postal: sa.codigo_postal, referencia: sa.referencia || '' };
      }
    }

    // Extract only service-related form fields for raw storage
    const rawFormValues: Partial<QuoteFormData> = { ...data };
    // Remove contact and privacy fields (they belong to the top-level form, not the service)
    delete rawFormValues.nombre;
    delete rawFormValues.empresa;
    delete rawFormValues.telefono;
    delete rawFormValues.email;
    delete rawFormValues.privacidad;
    delete rawFormValues.website;

    const entry: SavedServiceEntry = {
      id: `svc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      serviceType: data.servicio as ServiceId,
      serviceLabel: serviceLabels[data.servicio as ServiceId] || data.servicio,
      serviceDetails: detalles,
      deliveryMethod: deliveryMethod,
      deliveryAddress: resolvedAddress,
      pickupBranch: selectedBranch,
      requiredDate: reqDate,
      comments: data.comentarios || '',
      files: [...selectedFiles],
      vallasRoutes: data.pub_subtipo === 'vallas-moviles' ? [...vallasRoutes] : undefined,
      perifoneoRoutes: data.pub_subtipo === 'perifoneo' ? [...perifoneoRoutes] : undefined,
      pubRoutes: data.pub_subtipo === 'publibuses' ? [...pubRoutes] : undefined,
      rawFormValues,
    };

    setSavedServices(prev => [...prev, entry]);

    // Reset service-specific fields
    setValue('servicio', '');
    setValue('fechaRequerida', '');
    setValue('comentarios', '');
    setSelectedFiles([]);
    setDeliveryMethod('');
    setDeliveryAddress({ calle: '', numero_exterior: '', numero_interior: '', colonia: '', ciudad: '', estado: '', codigo_postal: '', referencia: '' });
    setSelectedBranch('');
    postalCode.reset();
    setColoniaManual(false);
    setVallasRoutes([createConfigurableRoute()]);
    setPerifoneoRoutes([createConfigurableRoute()]);
    setPubRoutes([createEstablishedRoute()]);

    return true;
  };

  const removeService = (serviceId: string) => {
    setSavedServices(prev => prev.filter(s => s.id !== serviceId));
  };

  // Restore a saved service into the active form (swap: save current → load clicked)
  const editService = (serviceId: string) => {
    const svc = savedServices.find(s => s.id === serviceId);
    if (!svc) return;

    // If there's a current service selected, capture it first
    if (servicioValue) {
      const currentData = watch() as QuoteFormData;
      const captured = captureCurrentService(currentData);
      if (!captured) return; // Validation failed, don't swap
    }

    // Remove the clicked service from the saved list
    setSavedServices(prev => prev.filter(s => s.id !== serviceId));

    // Flag to prevent the useEffect from resetting delivery/routes
    isRestoringServiceRef.current = true;

    // Restore form fields from rawFormValues
    const raw = svc.rawFormValues;
    Object.entries(raw).forEach(([key, value]) => {
      if (value !== undefined) {
        setValue(key as keyof QuoteFormData, value as string);
      }
    });

    // Restore external state (delivery, files, routes)
    setDeliveryMethod(svc.deliveryMethod);
    setDeliveryAddress(svc.deliveryAddress as typeof deliveryAddress);
    setSelectedBranch(svc.pickupBranch);
    setSelectedFiles([...svc.files]);
    if (svc.vallasRoutes) setVallasRoutes([...svc.vallasRoutes]);
    if (svc.perifoneoRoutes) setPerifoneoRoutes([...svc.perifoneoRoutes]);
    if (svc.pubRoutes) setPubRoutes([...svc.pubRoutes]);

    // Scroll to Box 2
    setTimeout(() => {
      document.getElementById('box-detalles-servicio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const onSubmit = async (data: QuoteFormData) => {
    try {
      setFormStatus('submitting');
      trackEvent(trackingEvents.FORM_START);

      // Validate date is not in the past and meets minimum business days
      if (data.fechaRequerida) {
        if (new Date(data.fechaRequerida) < new Date(today)) {
          setFormStatus('error');
          setErrorMessage('La fecha debe ser igual o posterior a hoy');
          return;
        }
        if (data.fechaRequerida < minDeliveryDate) {
          const minDays = getMinBusinessDays(data.servicio || '');
          setFormStatus('error');
          setErrorMessage(`La fecha mínima de entrega para este servicio es de ${minDays} día${minDays > 1 ? 's' : ''} hábil${minDays > 1 ? 'es' : ''} a partir de hoy. Los días se cuentan a partir de que el pago se realiza.`);
          return;
        }
      }

      // Validate delivery method
      const availMethods = data.servicio ? getDeliveryMethodsForService(data.servicio) : [];
      const onlyNA = availMethods.length === 1 && availMethods[0] === 'not_applicable';

      // Perifoneo: file required if no provider recording; comments required if yes
      if (data.servicio === 'publicidad-movil' && data.pub_subtipo === 'perifoneo') {
        if (data.pub_requiereGrabacion === 'no' && selectedFiles.length === 0) {
          setFormStatus('error');
          setErrorMessage('Debes adjuntar el archivo de grabación para perifoneo.');
          return;
        }
        // Comments validation already handled by react-hook-form required rule
      }

      if (!onlyNA && !deliveryMethod) {
        setDeliveryError('Selecciona un método de entrega');
        setFormStatus('error');
        setErrorMessage('Selecciona un método de entrega');
        return;
      }
      if ((deliveryMethod === 'installation' || deliveryMethod === 'shipping') && !useNewAddress && selectedAddressId && savedAddresses.length > 0) {
        // Using a saved address — no further validation needed
      } else if ((deliveryMethod === 'installation' || deliveryMethod === 'shipping') && !deliveryAddress.calle) {
        setDeliveryError('Ingresa la dirección de entrega');
        setFormStatus('error');
        setErrorMessage('Ingresa la dirección de entrega');
        return;
      }
      if (deliveryMethod === 'pickup' && !selectedBranch) {
        setDeliveryError('Selecciona una sucursal');
        setFormStatus('error');
        setErrorMessage('Selecciona una sucursal para recoger');
        return;
      }
      setDeliveryError('');

      // Validate routes for publicidad-movil subtypes
      if (data.servicio === 'publicidad-movil') {
        if (data.pub_subtipo === 'vallas-moviles') {
          const hasRouteData = vallasRoutes.some(r => r.route?.pointA && r.route?.pointB && r.route?.routeData);
          if (!hasRouteData) {
            setFormStatus('error');
            setErrorMessage('Debes trazar al menos una ruta en el mapa para vallas móviles');
            return;
          }
          const missingSchedule = vallasRoutes.find(r => !r.fechaInicio || !r.horarioInicio || !r.horarioFin);
          if (missingSchedule) {
            setFormStatus('error');
            setErrorMessage('Cada ruta de vallas móviles debe tener fecha de inicio, horario de inicio y horario de fin');
            return;
          }
          const invalidSchedule = vallasRoutes.find(r => (r.horarioInicio && (r.horarioInicio < '07:00' || r.horarioInicio > '19:00')) || (r.horarioFin && (r.horarioFin < '07:00' || r.horarioFin > '19:00')));
          if (invalidSchedule) {
            setFormStatus('error');
            setErrorMessage('El horario de las rutas debe estar entre 7:00 y 19:00');
            return;
          }
          const missingEndDate = vallasRoutes.find(r => !r.fechaFin);
          if (missingEndDate) {
            setFormStatus('error');
            setErrorMessage('Cada ruta de vallas móviles debe tener fecha de fin');
            return;
          }
          const invalidDateRange = vallasRoutes.find(r => r.fechaInicio && r.fechaFin && r.fechaFin < r.fechaInicio);
          if (invalidDateRange) {
            setFormStatus('error');
            setErrorMessage('La fecha de fin de cada ruta debe ser igual o posterior a la fecha de inicio');
            return;
          }
          const dateTooEarly = vallasRoutes.find(r => r.fechaInicio && r.fechaInicio < minRouteStartDate);
          if (dateTooEarly) {
            setFormStatus('error');
            setErrorMessage('Las fechas de inicio de ruta deben ser al menos 8 días hábiles a partir de hoy. Los días se cuentan a partir de que el pago se realiza.');
            return;
          }
        } else if (data.pub_subtipo === 'publibuses') {
          const hasRoute = pubRoutes.some(r => r.ruta && r.fechaInicio);
          if (!hasRoute) {
            setFormStatus('error');
            setErrorMessage('Debes seleccionar al menos una ruta preestablecida con fecha de inicio para publibuses');
            return;
          }
          const dateTooEarly = pubRoutes.find(r => r.fechaInicio && r.fechaInicio < minRouteStartDate);
          if (dateTooEarly) {
            setFormStatus('error');
            setErrorMessage('Las fechas de inicio de ruta deben ser al menos 8 días hábiles a partir de hoy. Los días se cuentan a partir de que el pago se realiza.');
            return;
          }
        } else if (data.pub_subtipo === 'perifoneo') {
          const hasRouteData = perifoneoRoutes.some(r => r.route?.pointA && r.route?.pointB && r.route?.routeData);
          if (!hasRouteData) {
            setFormStatus('error');
            setErrorMessage('Debes trazar al menos una ruta en el mapa para perifoneo');
            return;
          }
          const missingSchedule = perifoneoRoutes.find(r => !r.fechaInicio || !r.horarioInicio || !r.horarioFin);
          if (missingSchedule) {
            setFormStatus('error');
            setErrorMessage('Cada ruta de perifoneo debe tener fecha de inicio, horario de inicio y horario de fin');
            return;
          }
          const invalidSchedule = perifoneoRoutes.find(r => (r.horarioInicio && (r.horarioInicio < '07:00' || r.horarioInicio > '19:00')) || (r.horarioFin && (r.horarioFin < '07:00' || r.horarioFin > '19:00')));
          if (invalidSchedule) {
            setFormStatus('error');
            setErrorMessage('El horario de las rutas debe estar entre 7:00 y 19:00');
            return;
          }
          const missingEndDate = perifoneoRoutes.find(r => !r.fechaFin);
          if (missingEndDate) {
            setFormStatus('error');
            setErrorMessage('Cada ruta de perifoneo debe tener fecha de fin');
            return;
          }
          const invalidDateRange = perifoneoRoutes.find(r => r.fechaInicio && r.fechaFin && r.fechaFin < r.fechaInicio);
          if (invalidDateRange) {
            setFormStatus('error');
            setErrorMessage('La fecha de fin de cada ruta debe ser igual o posterior a la fecha de inicio');
            return;
          }
          const dateTooEarly = perifoneoRoutes.find(r => r.fechaInicio && r.fechaInicio < minRouteStartDate);
          if (dateTooEarly) {
            setFormStatus('error');
            setErrorMessage('Las fechas de inicio de ruta deben ser al menos 8 días hábiles a partir de hoy. Los días se cuentan a partir de que el pago se realiza.');
            return;
          }
        }
      }

      // Execute reCAPTCHA verification
      let recaptchaToken: string | null = null;
      if (recaptchaEnabled) {
        recaptchaToken = await executeRecaptcha('quote_request');
        if (!recaptchaToken) {
          setFormStatus('error');
          setErrorMessage('Error de verificación. Por favor, intenta de nuevo.');
          return;
        }
      }

      // Build structured payload
      const payload = buildPayload(data, recaptchaToken);

      // Prepare request
      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));

      // Add files from current service (with per-service tracking)
      // Build file_service_map: array where index = file index, value = service index
      const fileServiceMap: number[] = [];
      // Also build route_file_map: array where index = file index, value = { service: svcIdx, route: routeIdx } or null
      const routeFileMap: Array<{ service: number; route: number } | null> = [];

      selectedFiles.forEach((file, index) => {
        formData.append(`archivo_${index}`, file);
        // Current service is always the last one in allServices
        fileServiceMap.push(savedServices.length);
        routeFileMap.push(null);
      });

      // Add per-route files from current active service
      const currentSvcIdx = savedServices.length;
      const addRouteFiles = (routes: Array<{ archivos: File[] }>, svcIdx: number) => {
        routes.forEach((route, routeIdx) => {
          route.archivos.forEach((file) => {
            formData.append(`archivo_${fileOffset}`, file);
            fileServiceMap.push(svcIdx);
            routeFileMap.push({ service: svcIdx, route: routeIdx });
            fileOffset++;
          });
        });
      };
      let fileOffset = selectedFiles.length;
      if (data.servicio === 'publicidad-movil') {
        if (data.pub_subtipo === 'vallas-moviles') addRouteFiles(vallasRoutes, currentSvcIdx);
        else if (data.pub_subtipo === 'publibuses') addRouteFiles(pubRoutes, currentSvcIdx);
        else if (data.pub_subtipo === 'perifoneo') addRouteFiles(perifoneoRoutes, currentSvcIdx);
      }

      // Add files from saved services
      savedServices.forEach((svc, svcIdx) => {
        svc.files.forEach((file) => {
          formData.append(`archivo_${fileOffset}`, file);
          fileServiceMap.push(svcIdx);
          routeFileMap.push(null);
          fileOffset++;
        });
        // Add per-route files from saved services
        if (svc.vallasRoutes) addRouteFiles(svc.vallasRoutes, svcIdx);
        if (svc.pubRoutes) addRouteFiles(svc.pubRoutes, svcIdx);
        if (svc.perifoneoRoutes) addRouteFiles(svc.perifoneoRoutes, svcIdx);
      });

      // Send file-to-service mapping so backend can link attachments per service
      if (fileServiceMap.length > 0) {
        formData.append('file_service_map', JSON.stringify(fileServiceMap));
        // Send route-level file mapping for per-route attachments
        if (routeFileMap.some(m => m !== null)) {
          formData.append('route_file_map', JSON.stringify(routeFileMap));
        }
      }

      const response = await fetch('/api/leads', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error('Server response error:', response.status, errorBody);
        const errorMsg = typeof errorBody?.error === 'string'
          ? errorBody.error
          : (errorBody?.detail || 'Error al enviar el formulario');
        throw new Error(errorMsg);
      }

      setFormStatus('success');
      trackEvent(trackingEvents.FORM_SUBMIT_SUCCESS, {
        servicio: data.servicio,
      });
      reset();
      setSelectedFiles([]);
      setSavedServices([]);
      setDeliveryMethod('');
      setDeliveryError('');
      setDeliveryAddress({ calle: '', numero_exterior: '', numero_interior: '', colonia: '', ciudad: '', estado: '', codigo_postal: '', referencia: '' });
      setSelectedBranch('');
      postalCode.reset();
      setColoniaManual(false);
      if (savedAddresses.length > 0) {
        setUseNewAddress(false);
        const def = savedAddresses.find((a) => a.is_default);
        setSelectedAddressId(def?.id || savedAddresses[0].id);
      }
      setVallasRoutes([createConfigurableRoute()]);
      setPerifoneoRoutes([createConfigurableRoute()]);
      setPubRoutes([createEstablishedRoute()]);

      setTimeout(() => {
        document.getElementById('form-status')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Form submission error:', error);
      setFormStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('error'));
      trackEvent(trackingEvents.FORM_SUBMIT_ERROR);
    }
  };

  // Build structured JSON payload
  const buildPayload = (data: QuoteFormData, recaptchaToken: string | null) => {
    const timestamp = new Date().toISOString();
    const quoteId = `COT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const basePayload = {
      id: quoteId,
      timestamp,
      contacto: {
        nombre: data.nombre,
        empresa: data.empresa || null,
        telefono: data.telefono,
        email: data.email,
      },
      fecha_requerida: data.fechaRequerida || (() => {
        // For publicidad-movil subtypes: auto-calculate from earliest route fecha_inicio
        if (data.servicio === 'publicidad-movil') {
          let allDates: string[] = [];
          if (data.pub_subtipo === 'publibuses' && pubRoutes.length > 0) {
            allDates = pubRoutes.map(r => r.fechaInicio).filter(d => !!d);
          } else if (data.pub_subtipo === 'vallas-moviles' && vallasRoutes.length > 0) {
            allDates = vallasRoutes.map(r => r.fechaInicio).filter(d => !!d);
          } else if (data.pub_subtipo === 'perifoneo' && perifoneoRoutes.length > 0) {
            allDates = perifoneoRoutes.map(r => r.fechaInicio).filter(d => !!d);
          }
          if (allDates.length > 0) {
            allDates.sort();
            return allDates[0]; // earliest date
          }
        }
        return null;
      })(),
      servicio: data.servicio,
      metodo_entrega: deliveryMethod || null,
      entrega: deliveryMethod === 'installation' || deliveryMethod === 'shipping' ? (() => {
        let addr = deliveryAddress;
        if (!useNewAddress && selectedAddressId && savedAddresses.length > 0) {
          const sa = savedAddresses.find((a) => a.id === selectedAddressId);
          if (sa) {
            addr = {
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
        return { metodo: deliveryMethod, direccion: addr };
      })() : deliveryMethod === 'pickup' ? {
        metodo: 'pickup',
        sucursal: selectedBranch,
        sucursal_nombre: branches.find(b => b.id === selectedBranch)?.name || '',
      } : deliveryMethod === 'digital' ? {
        metodo: 'digital',
        email: data.email,
      } : null,
      detalles: {} as Record<string, unknown>,
      archivos: selectedFiles.map(f => ({ nombre: f.name, tamano: f.size })),
      comentarios: data.comentarios || null,
      metadata: {
        utm_source: new URLSearchParams(window.location.search).get('utm_source') || null,
        utm_medium: new URLSearchParams(window.location.search).get('utm_medium') || null,
        utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || null,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        page_url: window.location.href,
      },
      recaptcha_token: recaptchaToken,
    };

    // Add service-specific details
    switch (data.servicio) {
      case 'espectaculares':
        basePayload.detalles = {
          tipo: data.esp_tipo === 'otro' ? data.esp_tipoOtro : data.esp_tipo,
          tipo_personalizado: data.esp_tipo === 'otro',
          medidas: data.esp_medidas,
          tiempo_exhibicion: data.esp_tiempoExhibicion,
          impresion_incluida: data.esp_impresionIncluida === 'si',
        };
        break;

      case 'fabricacion-anuncios':
        basePayload.detalles = {
          tipo_anuncio: data.fab_tipoAnuncio === 'otro' ? data.fab_tipoOtro : data.fab_tipoAnuncio,
          tipo_personalizado: data.fab_tipoAnuncio === 'otro',
          medidas: data.fab_medidas,
          uso: data.fab_uso,
          iluminacion: data.fab_iluminacion === 'si',
        };
        break;

      case 'publicidad-movil':
        if (data.pub_subtipo === 'vallas-moviles') {
          basePayload.detalles = {
            subtipo: 'vallas-moviles',
            rutas: vallasRoutes.map((r, i) => ({
              numero: i + 1,
              fecha_inicio: r.fechaInicio || null,
              fecha_fin: r.fechaFin || null,
              horario_inicio: r.horarioInicio || null,
              horario_fin: r.horarioFin || null,
              comentarios: r.comentarios || null,
              archivos: r.archivos.map(f => ({ nombre: f.name, tamano: f.size })),
              ruta: r.route ? {
                punto_a: r.route.pointA,
                punto_b: r.route.pointB,
                distancia_metros: r.route.routeData?.distance,
                duracion_segundos: r.route.routeData?.duration,
                coordenadas: r.route.routeData?.coordinates,
              } : null,
            })),
          };
        } else if (data.pub_subtipo === 'publibuses') {
          basePayload.detalles = {
            subtipo: 'publibuses',
            meses_campana: data.pub_mesesCampana,
            rutas: pubRoutes.map((r, i) => ({
              numero: i + 1,
              ruta_preestablecida: r.ruta || null,
              fecha_inicio: r.fechaInicio || null,
              fecha_fin: r.fechaInicio && data.pub_mesesCampana ? addMonths(r.fechaInicio, Number(data.pub_mesesCampana)) : null,
              comentarios: r.comentarios || null,
              archivos: r.archivos.map(f => ({ nombre: f.name, tamano: f.size })),
            })),
          };
        } else if (data.pub_subtipo === 'perifoneo') {
          basePayload.detalles = {
            subtipo: 'perifoneo',
            requiere_grabacion: data.pub_requiereGrabacion === 'si',
            delimitacion_zona: data.pub_descripcionZona || null,
            rutas: perifoneoRoutes.map((r, i) => ({
              numero: i + 1,
              fecha_inicio: r.fechaInicio || null,
              fecha_fin: r.fechaFin || null,
              horario_inicio: r.horarioInicio || null,
              horario_fin: r.horarioFin || null,
              comentarios: r.comentarios || null,
              archivos: r.archivos.map(f => ({ nombre: f.name, tamano: f.size })),
              ruta: r.route ? {
                punto_a: r.route.pointA,
                punto_b: r.route.pointB,
                distancia_metros: r.route.routeData?.distance,
                duracion_segundos: r.route.routeData?.duration,
                coordenadas: r.route.routeData?.coordinates,
              } : null,
            })),
          };
        } else if (data.pub_subtipo === 'otro') {
          basePayload.detalles = {
            subtipo: data.pub_subtipoOtro,
            subtipo_personalizado: true,
            descripcion: data.pub_otroDescripcion,
          };
        }
        break;

      case 'impresion-gran-formato':
        basePayload.detalles = {
          material: data.igf_material === 'otro' ? data.igf_materialOtro : data.igf_material,
          material_personalizado: data.igf_material === 'otro',
          medidas: data.igf_medidas,
          cantidad: data.igf_cantidad,
          archivo_listo: data.igf_archivoListo === 'si',
        };
        break;

      case 'senalizacion':
        basePayload.detalles = {
          tipo: data.sen_tipo === 'otro' ? data.sen_tipoOtro : data.sen_tipo,
          tipo_personalizado: data.sen_tipo === 'otro',
          medidas: data.sen_medidas,
          cantidad: data.sen_cantidad,
        };
        break;

      case 'rotulacion-vehicular':
        basePayload.detalles = {
          tipo_vehiculo: data.rot_tipoVehiculo,
          tipo_rotulacion: data.rot_tipoRotulacion === 'otro' ? data.rot_tipoRotulacionOtro : data.rot_tipoRotulacion,
          tipo_rotulacion_personalizado: data.rot_tipoRotulacion === 'otro',
          diseno_incluido: data.rot_disenoIncluido === 'si',
        };
        break;

      case 'corte-grabado-cnc-laser':
        basePayload.detalles = {
          tipo: data.cnc_tipo === 'otro' ? data.cnc_tipoOtro : data.cnc_tipo,
          tipo_personalizado: data.cnc_tipo === 'otro',
          medidas: data.cnc_medidas,
          cantidad: data.cnc_cantidad,
          archivo_listo: data.cnc_archivoListo === 'si',
        };
        break;

      case 'diseno-grafico':
        basePayload.detalles = {
          tipo: data.dis_tipo === 'otro' ? data.dis_tipoOtro : data.dis_tipo,
          tipo_personalizado: data.dis_tipo === 'otro',
          numero_piezas: data.dis_numeroPiezas,
          medidas: data.dis_medidas || null,
          uso: data.dis_usoDiseno,
          cambios_incluidos: data.dis_cambiosIncluidos === 'si',
        };
        break;

      case 'impresion-offset-serigrafia':
        basePayload.detalles = {
          producto: data.off_producto === 'otro' ? data.off_productoOtro : data.off_producto,
          producto_personalizado: data.off_producto === 'otro',
          cantidad: data.off_cantidad,
          archivo_listo: data.off_archivoListo === 'si',
        };
        break;

      case 'otros':
        basePayload.detalles = {
          tipo_servicio: data.otros_tipoServicio,
          descripcion: data.otros_descripcion,
          medidas: data.otros_medidas || null,
          cantidad: data.otros_cantidad || null,
        };
        break;
    }

    // Build services array (savedServices + current service)
    const allServices: Array<Record<string, unknown>> = [];

    // Add previously saved services
    savedServices.forEach((svc, idx) => {
      allServices.push({
        position: idx,
        service_type: svc.serviceType,
        service_details: svc.serviceDetails,
        delivery_method: svc.deliveryMethod || null,
        delivery_address: (svc.deliveryMethod === 'installation' || svc.deliveryMethod === 'shipping') ? svc.deliveryAddress : null,
        pickup_branch: svc.deliveryMethod === 'pickup' ? svc.pickupBranch : null,
        required_date: svc.requiredDate || null,
        description: svc.comments || null,
      });
    });

    // Add current service (the one in the form right now)
    if (data.servicio) {
      const entrega = basePayload.entrega as Record<string, unknown> | undefined;
      allServices.push({
        position: allServices.length,
        service_type: data.servicio,
        service_details: basePayload.detalles,
        delivery_method: basePayload.metodo_entrega,
        delivery_address: entrega?.direccion || null,
        pickup_branch: entrega?.sucursal || null,
        required_date: basePayload.fecha_requerida,
        description: data.comentarios || null,
      });
    }

    // Attach services array to payload
    (basePayload as Record<string, unknown>).servicios = allServices.length > 0 ? allServices : null;

    return basePayload;
  };

  // File handling
  const handleFileChange = (files: FileList | null) => {
    if (!files) return;

    const newFiles: File[] = [];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.ai', '.cdr', '.dxf', '.svg'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();

      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name}: ${t('fileTooLarge')}`);
        continue;
      }

      if (!allowedExtensions.includes(ext)) {
        alert(`${file.name}: ${t('fileTypeNotAllowed')}`);
        continue;
      }

      newFiles.push(file);
    }

    setSelectedFiles(prev => {
      const combined = [...prev, ...newFiles];
      if (combined.length > 20) {
        alert('No es posible adjuntar más de 20 archivos en total.');
        return prev;
      }
      return combined;
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <section id="cotizar" className="section py-10 sm:py-14 md:py-18 lg:py-24">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="mb-4">{t('title')}</h2>
          <p className="text-xl text-gray-300">{t('subtitle')}</p>
        </div>


        {/* Success / Error Modal */}
        <SuccessModal
          isOpen={formStatus === 'success'}
          onClose={() => setFormStatus('idle')}
          title={t('success')}
          message={t('successMessage')}
          variant="success"
        />
        <SuccessModal
          isOpen={formStatus === 'error'}
          onClose={() => setFormStatus('idle')}
          title={t('error')}
          message={errorMessage}
          variant="error"
          buttonLabel="Reintentar"
        />

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto space-y-6">

          {/* ═══════════════ OUTER CONTAINER ═══════════════ */}
          <div className="bg-cmyk-black rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 lg:p-10 border border-cmyk-cyan/20 space-y-8">

          {/* ──── BOX 1: Datos de contacto ──── */}
          <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4 sm:p-6">
            <h3 className="text-2xl font-bold text-white mb-6">{t('contactData')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label htmlFor="nombre" className="label-field">
                  {t('name')} <span className="text-cmyk-magenta">*</span>
                </label>
                <input
                  {...register('nombre', { required: 'El nombre es requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' } })}
                  type="text"
                  id="nombre"
                  className="input-field"
                  placeholder="Tu nombre completo"
                  disabled={formStatus === 'submitting'}
                />
                {errors.nombre && <p className="error-message">{errors.nombre.message}</p>}
              </div>

              <div>
                <label htmlFor="empresa" className="label-field">Empresa</label>
                <input
                  {...register('empresa')}
                  type="text"
                  id="empresa"
                  className="input-field"
                  placeholder="Nombre de tu empresa (opcional)"
                  disabled={formStatus === 'submitting'}
                />
              </div>

              <div>
                <label htmlFor="telefono" className="label-field">
                  {t('phone')} <span className="text-cmyk-magenta">*</span>
                </label>
                <input
                  {...register('telefono', {
                    required: 'El teléfono es requerido',
                    pattern: { value: /^\+?[0-9]{10,15}$/, message: 'Formato de teléfono inválido' }
                  })}
                  type="tel"
                  id="telefono"
                  className="input-field"
                  placeholder={t('phonePlaceholder')}
                  disabled={formStatus === 'submitting'}
                />
                {errors.telefono && <p className="error-message">{errors.telefono.message}</p>}
              </div>

              <div>
                <label htmlFor="email" className="label-field">
                  {t('email')} <span className="text-cmyk-magenta">*</span>
                </label>
                <input
                  {...register('email', {
                    required: 'El email es requerido',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' }
                  })}
                  type="email"
                  id="email"
                  className="input-field"
                  placeholder={t('emailPlaceholder')}
                  disabled={formStatus === 'submitting'}
                />
                {errors.email && <p className="error-message">{errors.email.message}</p>}
              </div>
            </div>
          </div>

          {/* ──── SAVED SERVICES (clickable tabs — click to edit) ──── */}
          {savedServices.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 italic">Haz clic en un servicio para editarlo. Se cargará en el formulario de abajo.</p>
              {savedServices.map((svc, idx) => (
                <div
                  key={svc.id}
                  className="rounded-xl border border-cmyk-cyan/30 bg-cmyk-cyan/5 hover:bg-cmyk-cyan/10 hover:border-cmyk-cyan/50 transition-all cursor-pointer group"
                  onClick={() => editService(svc.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editService(svc.id); } }}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cmyk-cyan/20 text-cmyk-cyan text-xs font-bold">{idx + 1}</span>
                          <h4 className="text-base font-bold text-white group-hover:text-cmyk-cyan transition-colors">{svc.serviceLabel}</h4>
                          <span className="text-xs text-cmyk-cyan/60 group-hover:text-cmyk-cyan transition-colors ml-1">
                            <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 ml-8">
                          {svc.requiredDate && (
                            <span>📅 {new Date(svc.requiredDate + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          )}
                          {svc.deliveryMethod && svc.deliveryMethod !== 'not_applicable' && (
                            <span>📦 {DELIVERY_METHOD_LABELS[svc.deliveryMethod]?.es || svc.deliveryMethod}</span>
                          )}
                          {svc.files.length > 0 && <span>📎 {svc.files.length} archivo{svc.files.length > 1 ? 's' : ''}</span>}
                          {svc.comments && <span>💬 Con comentarios</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="hidden sm:inline-block text-xs text-cmyk-cyan/50 group-hover:text-cmyk-cyan transition-colors mr-1">Editar</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeService(svc.id); }}
                          disabled={formStatus === 'submitting'}
                          className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Quitar servicio"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ──── BOX 2: Detalles del servicio (active/current) ──── */}
          <div id="box-detalles-servicio" className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4 sm:p-6 space-y-6">
            <h3 className="text-2xl font-bold text-white">Detalles del servicio</h3>

            {/* Service selector + Subtype + Fecha requerida — same row on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
              <div>
                <div className="flex justify-between items-center">
                  <label htmlFor="servicio" className="label-field">
                    Servicio a cotizar <span className="text-cmyk-magenta">*</span>
                  </label>
                  {selectionFeedback && (
                    <span className="text-xs text-cmyk-cyan font-semibold animate-pulse">
                      Seleccionado
                    </span>
                  )}
                </div>
                {/* Hidden input for react-hook-form */}
                <input type="hidden" {...register('servicio', { required: 'Selecciona un servicio' })} />
                {/* Custom dropdown — always opens downward */}
                <div ref={el => { dropdownRefs.current['servicio'] = el; }} className="relative" id="servicio">
                  <button
                    type="button"
                    onClick={() => { if (formStatus !== 'submitting') setOpenDropdown(prev => prev === 'servicio' ? null : 'servicio'); }}
                    disabled={formStatus === 'submitting'}
                    className={`input-field text-left w-full flex items-center justify-between transition-all duration-300 ${
                      selectionFeedback
                        ? 'border-cmyk-cyan border-b-4 animate-pulse shadow-[0_0_10px_rgba(0,183,235,0.5)]'
                        : ''
                    } ${!servicioValue ? 'text-gray-500' : 'text-white'}`}
                  >
                    <span className="truncate">
                      {servicioValue ? serviceLabels[servicioValue as ServiceId] : t('selectService')}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'servicio' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openDropdown === 'servicio' && (
                    <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl">
                      <li>
                        <button
                          type="button"
                          onClick={() => { setValue('servicio', ''); setOpenDropdown(null); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-neutral-700 transition-colors"
                        >
                          {t('selectService')}
                        </button>
                      </li>
                      {SERVICE_IDS.map((sId) => (
                        <li key={sId}>
                          <button
                            type="button"
                            onClick={() => { setValue('servicio', sId); setOpenDropdown(null); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              servicioValue === sId
                                ? 'bg-cmyk-cyan/20 text-cmyk-cyan font-semibold'
                                : 'text-white hover:bg-neutral-700'
                            }`}
                          >
                            {serviceLabels[sId]}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {errors.servicio && <p className="error-message">{errors.servicio.message}</p>}
              </div>

              {/* Subtype inline — only for services that have a subtype selector as first field */}
              {servicioValue === 'espectaculares' && (
                <div>
                  <div className="flex justify-between items-center">
                    <label className="label-field">Tipo <span className="text-cmyk-magenta">*</span></label>
                    {selectionFeedback?.subtype && (
                      <span className="text-xs text-cmyk-cyan font-semibold animate-pulse">Seleccionado</span>
                    )}
                  </div>
                  <input type="hidden" {...register('esp_tipo', { required: 'Selecciona un tipo' })} />
                  <div ref={el => { dropdownRefs.current['esp_tipo'] = el; }} className="relative">
                    <button type="button" onClick={() => { if (formStatus !== 'submitting') setOpenDropdown(prev => prev === 'esp_tipo' ? null : 'esp_tipo'); }} disabled={formStatus === 'submitting'}
                      className={`input-field text-left w-full flex items-center justify-between transition-all duration-300 ${selectionFeedback?.subtype ? 'border-cmyk-cyan border-b-4 animate-pulse shadow-[0_0_10px_rgba(0,183,235,0.5)]' : ''} ${!espTipo ? 'text-gray-500' : 'text-white'}`}>
                      <span className="truncate">{espTipo ? (espTipo === 'unipolar' ? 'Unipolar' : espTipo === 'azotea' ? 'Azotea' : espTipo === 'mural' ? 'Mural publicitario' : 'Otro (especificar)') : 'Selecciona tipo'}</span>
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'esp_tipo' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {openDropdown === 'esp_tipo' && (
                      <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl">
                        <li><button type="button" onClick={() => { setValue('esp_tipo', '' as any); setOpenDropdown(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-neutral-700 transition-colors">Selecciona tipo</button></li>
                        {ESPECTACULARES_TIPOS.map(tipo => (
                          <li key={tipo}><button type="button" onClick={() => { setValue('esp_tipo', tipo); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${espTipo === tipo ? 'bg-cmyk-cyan/20 text-cmyk-cyan font-semibold' : 'text-white hover:bg-neutral-700'}`}>{tipo === 'unipolar' ? 'Unipolar' : tipo === 'azotea' ? 'Azotea' : tipo === 'mural' ? 'Mural publicitario' : 'Otro (especificar)'}</button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.esp_tipo && <p className="error-message">{errors.esp_tipo.message}</p>}
                  {espTipo === 'otro' && (
                    <div className="mt-2">
                      <input {...register('esp_tipoOtro', { required: espTipo === 'otro' ? 'Especifica el tipo' : false })} type="text" className="input-field" placeholder="Especifica el tipo" disabled={formStatus === 'submitting'} />
                    </div>
                  )}
                </div>
              )}
              {servicioValue === 'fabricacion-anuncios' && (
                <div>
                  <div className="flex justify-between items-center">
                    <label className="label-field">Tipo de anuncio <span className="text-cmyk-magenta">*</span></label>
                    {selectionFeedback?.subtype && (
                      <span className="text-xs text-cmyk-cyan font-semibold animate-pulse">Seleccionado</span>
                    )}
                  </div>
                  <input type="hidden" {...register('fab_tipoAnuncio', { required: 'Selecciona un tipo' })} />
                  <div ref={el => { dropdownRefs.current['fab_tipoAnuncio'] = el; }} className="relative">
                    <button type="button" onClick={() => { if (formStatus !== 'submitting') setOpenDropdown(prev => prev === 'fab_tipoAnuncio' ? null : 'fab_tipoAnuncio'); }} disabled={formStatus === 'submitting'}
                      className={`input-field text-left w-full flex items-center justify-between transition-all duration-300 ${selectionFeedback?.subtype ? 'border-cmyk-cyan border-b-4 animate-pulse shadow-[0_0_10px_rgba(0,183,235,0.5)]' : ''} ${!fabTipoAnuncio ? 'text-gray-500' : 'text-white'}`}>
                      <span className="truncate">{fabTipoAnuncio ? (fabTipoAnuncio === 'cajas-luz' ? 'Cajas de luz' : fabTipoAnuncio === 'letras-3d' ? 'Letras 3D' : fabTipoAnuncio === 'anuncios-2d' ? 'Anuncios 2D' : fabTipoAnuncio === 'bastidores' ? 'Bastidores' : fabTipoAnuncio === 'toldos' ? 'Toldos' : fabTipoAnuncio === 'neon' ? 'Neón' : 'Otro (especificar)') : 'Selecciona tipo'}</span>
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'fab_tipoAnuncio' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {openDropdown === 'fab_tipoAnuncio' && (
                      <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl">
                        <li><button type="button" onClick={() => { setValue('fab_tipoAnuncio', ''); setOpenDropdown(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-neutral-700 transition-colors">Selecciona tipo</button></li>
                        {FABRICACION_ANUNCIOS_TIPOS.map(tipo => (
                          <li key={tipo}><button type="button" onClick={() => { setValue('fab_tipoAnuncio', tipo); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${fabTipoAnuncio === tipo ? 'bg-cmyk-cyan/20 text-cmyk-cyan font-semibold' : 'text-white hover:bg-neutral-700'}`}>{tipo === 'cajas-luz' ? 'Cajas de luz' : tipo === 'letras-3d' ? 'Letras 3D' : tipo === 'anuncios-2d' ? 'Anuncios 2D' : tipo === 'bastidores' ? 'Bastidores' : tipo === 'toldos' ? 'Toldos' : tipo === 'neon' ? 'Neón' : 'Otro (especificar)'}</button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.fab_tipoAnuncio && <p className="error-message">{errors.fab_tipoAnuncio.message}</p>}
                  {fabTipoAnuncio === 'otro' && (
                    <div className="mt-2">
                      <input {...register('fab_tipoOtro', { required: fabTipoAnuncio === 'otro' ? 'Especifica el tipo' : false })} type="text" className="input-field" placeholder="Especifica el tipo" disabled={formStatus === 'submitting'} />
                    </div>
                  )}
                </div>
              )}
              {servicioValue === 'publicidad-movil' && (
                <div>
                  <div className="flex justify-between items-center">
                    <label className="label-field">Subtipo <span className="text-cmyk-magenta">*</span></label>
                    {selectionFeedback?.subtype && (
                      <span className="text-xs text-cmyk-cyan font-semibold animate-pulse">Seleccionado</span>
                    )}
                  </div>
                  <input type="hidden" {...register('pub_subtipo', { required: 'Selecciona un subtipo' })} />
                  <div ref={el => { dropdownRefs.current['pub_subtipo'] = el; }} className="relative">
                    <button type="button" onClick={() => { if (formStatus !== 'submitting') setOpenDropdown(prev => prev === 'pub_subtipo' ? null : 'pub_subtipo'); }} disabled={formStatus === 'submitting'}
                      className={`input-field text-left w-full flex items-center justify-between transition-all duration-300 ${selectionFeedback?.subtype ? 'border-cmyk-cyan border-b-4 animate-pulse shadow-[0_0_10px_rgba(0,183,235,0.5)]' : ''} ${!pubSubtipo ? 'text-gray-500' : 'text-white'}`}>
                      <span className="truncate">{pubSubtipo ? (pubSubtipo === 'vallas-moviles' ? 'Vallas móviles' : pubSubtipo === 'publibuses' ? 'Publibuses' : pubSubtipo === 'perifoneo' ? 'Perifoneo' : 'Otro (especificar)') : 'Selecciona subtipo'}</span>
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'pub_subtipo' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {openDropdown === 'pub_subtipo' && (
                      <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl">
                        <li><button type="button" onClick={() => { setValue('pub_subtipo', '' as any); setOpenDropdown(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-neutral-700 transition-colors">Selecciona subtipo</button></li>
                        {(['vallas-moviles', 'publibuses', 'perifoneo', 'otro'] as const).map(st => (
                          <li key={st}><button type="button" onClick={() => { setValue('pub_subtipo', st); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${pubSubtipo === st ? 'bg-cmyk-cyan/20 text-cmyk-cyan font-semibold' : 'text-white hover:bg-neutral-700'}`}>{st === 'vallas-moviles' ? 'Vallas móviles' : st === 'publibuses' ? 'Publibuses' : st === 'perifoneo' ? 'Perifoneo' : 'Otro (especificar)'}</button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.pub_subtipo && <p className="error-message">{errors.pub_subtipo.message}</p>}
                </div>
              )}
              {servicioValue === 'impresion-gran-formato' && (
                <div>
                  <div className="flex justify-between items-center">
                    <label className="label-field">Material <span className="text-cmyk-magenta">*</span></label>
                    {selectionFeedback?.subtype && (
                      <span className="text-xs text-cmyk-cyan font-semibold animate-pulse">Seleccionado</span>
                    )}
                  </div>
                  <input type="hidden" {...register('igf_material', { required: 'Selecciona un material' })} />
                  <div ref={el => { dropdownRefs.current['igf_material'] = el; }} className="relative">
                    <button type="button" onClick={() => { if (formStatus !== 'submitting') setOpenDropdown(prev => prev === 'igf_material' ? null : 'igf_material'); }} disabled={formStatus === 'submitting'}
                      className={`input-field text-left w-full flex items-center justify-between transition-all duration-300 ${selectionFeedback?.subtype ? 'border-cmyk-cyan border-b-4 animate-pulse shadow-[0_0_10px_rgba(0,183,235,0.5)]' : ''} ${!igfMaterial ? 'text-gray-500' : 'text-white'}`}>
                      <span className="truncate">{igfMaterial ? (igfMaterial === 'otro' ? 'Otro (especificar)' : igfMaterial.charAt(0).toUpperCase() + igfMaterial.slice(1)) : 'Selecciona material'}</span>
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'igf_material' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {openDropdown === 'igf_material' && (
                      <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl">
                        <li><button type="button" onClick={() => { setValue('igf_material', '' as any); setOpenDropdown(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-neutral-700 transition-colors">Selecciona material</button></li>
                        {GRAN_FORMATO_MATERIALES.map(mat => (
                          <li key={mat}><button type="button" onClick={() => { setValue('igf_material', mat); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${igfMaterial === mat ? 'bg-cmyk-cyan/20 text-cmyk-cyan font-semibold' : 'text-white hover:bg-neutral-700'}`}>{mat === 'otro' ? 'Otro (especificar)' : mat.charAt(0).toUpperCase() + mat.slice(1)}</button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.igf_material && <p className="error-message">{errors.igf_material.message}</p>}
                  {igfMaterial === 'otro' && (
                    <div className="mt-2">
                      <input {...register('igf_materialOtro', { required: igfMaterial === 'otro' ? 'Especifica el material' : false })} type="text" className="input-field" placeholder="Especifica el material" disabled={formStatus === 'submitting'} />
                    </div>
                  )}
                </div>
              )}
              {servicioValue === 'senalizacion' && (
                <div>
                  <div className="flex justify-between items-center">
                    <label className="label-field">Tipo <span className="text-cmyk-magenta">*</span></label>
                    {selectionFeedback?.subtype && (
                      <span className="text-xs text-cmyk-cyan font-semibold animate-pulse">Seleccionado</span>
                    )}
                  </div>
                  <input type="hidden" {...register('sen_tipo', { required: 'Selecciona un tipo' })} />
                  <div ref={el => { dropdownRefs.current['sen_tipo'] = el; }} className="relative">
                    <button type="button" onClick={() => { if (formStatus !== 'submitting') setOpenDropdown(prev => prev === 'sen_tipo' ? null : 'sen_tipo'); }} disabled={formStatus === 'submitting'}
                      className={`input-field text-left w-full flex items-center justify-between transition-all duration-300 ${selectionFeedback?.subtype ? 'border-cmyk-cyan border-b-4 animate-pulse shadow-[0_0_10px_rgba(0,183,235,0.5)]' : ''} ${!senTipo ? 'text-gray-500' : 'text-white'}`}>
                      <span className="truncate">{senTipo ? (senTipo === 'interior' ? 'Interior' : senTipo === 'exterior' ? 'Exterior' : senTipo === 'vial' ? 'Vial' : 'Otro (especificar)') : 'Selecciona tipo'}</span>
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'sen_tipo' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {openDropdown === 'sen_tipo' && (
                      <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl">
                        <li><button type="button" onClick={() => { setValue('sen_tipo', '' as any); setOpenDropdown(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-neutral-700 transition-colors">Selecciona tipo</button></li>
                        {SENALIZACION_TIPOS.map(tipo => (
                          <li key={tipo}><button type="button" onClick={() => { setValue('sen_tipo', tipo); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${senTipo === tipo ? 'bg-cmyk-cyan/20 text-cmyk-cyan font-semibold' : 'text-white hover:bg-neutral-700'}`}>{tipo === 'interior' ? 'Interior' : tipo === 'exterior' ? 'Exterior' : tipo === 'vial' ? 'Vial' : 'Otro (especificar)'}</button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.sen_tipo && <p className="error-message">{errors.sen_tipo.message}</p>}
                  {senTipo === 'otro' && (
                    <div className="mt-2">
                      <input {...register('sen_tipoOtro', { required: senTipo === 'otro' ? 'Especifica el tipo' : false })} type="text" className="input-field" placeholder="Especifica el tipo" disabled={formStatus === 'submitting'} />
                    </div>
                  )}
                </div>
              )}
              {servicioValue === 'rotulacion-vehicular' && (
                <div>
                  <div className="flex justify-between items-center">
                    <label className="label-field">Tipo de rotulación <span className="text-cmyk-magenta">*</span></label>
                    {selectionFeedback?.subtype && (
                      <span className="text-xs text-cmyk-cyan font-semibold animate-pulse">Seleccionado</span>
                    )}
                  </div>
                  <input type="hidden" {...register('rot_tipoRotulacion', { required: 'Selecciona un tipo' })} />
                  <div ref={el => { dropdownRefs.current['rot_tipoRotulacion'] = el; }} className="relative">
                    <button type="button" onClick={() => { if (formStatus !== 'submitting') setOpenDropdown(prev => prev === 'rot_tipoRotulacion' ? null : 'rot_tipoRotulacion'); }} disabled={formStatus === 'submitting'}
                      className={`input-field text-left w-full flex items-center justify-between transition-all duration-300 ${selectionFeedback?.subtype ? 'border-cmyk-cyan border-b-4 animate-pulse shadow-[0_0_10px_rgba(0,183,235,0.5)]' : ''} ${!rotTipoRotulacion ? 'text-gray-500' : 'text-white'}`}>
                      <span className="truncate">{rotTipoRotulacion ? (rotTipoRotulacion === 'completa' ? 'Rotulación completa' : rotTipoRotulacion === 'parcial' ? 'Rotulación parcial' : rotTipoRotulacion === 'vinil-recortado' ? 'Vinil recortado' : rotTipoRotulacion === 'impresion-digital' ? 'Impresión digital' : 'Otro (especificar)') : 'Selecciona tipo'}</span>
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'rot_tipoRotulacion' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {openDropdown === 'rot_tipoRotulacion' && (
                      <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl">
                        <li><button type="button" onClick={() => { setValue('rot_tipoRotulacion', ''); setOpenDropdown(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-neutral-700 transition-colors">Selecciona tipo</button></li>
                        {ROTULACION_TIPOS.map(tipo => (
                          <li key={tipo}><button type="button" onClick={() => { setValue('rot_tipoRotulacion', tipo); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${rotTipoRotulacion === tipo ? 'bg-cmyk-cyan/20 text-cmyk-cyan font-semibold' : 'text-white hover:bg-neutral-700'}`}>{tipo === 'completa' ? 'Rotulación completa' : tipo === 'parcial' ? 'Rotulación parcial' : tipo === 'vinil-recortado' ? 'Vinil recortado' : tipo === 'impresion-digital' ? 'Impresión digital' : 'Otro (especificar)'}</button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.rot_tipoRotulacion && <p className="error-message">{errors.rot_tipoRotulacion.message}</p>}
                  {rotTipoRotulacion === 'otro' && (
                    <div className="mt-2">
                      <input {...register('rot_tipoRotulacionOtro', { required: rotTipoRotulacion === 'otro' ? 'Especifica el tipo' : false })} type="text" className="input-field" placeholder="Especifica el tipo" disabled={formStatus === 'submitting'} />
                    </div>
                  )}
                </div>
              )}
              {servicioValue === 'corte-grabado-cnc-laser' && (
                <div>
                  <div className="flex justify-between items-center">
                    <label className="label-field">Tipo de servicio <span className="text-cmyk-magenta">*</span></label>
                    {selectionFeedback?.subtype && (
                      <span className="text-xs text-cmyk-cyan font-semibold animate-pulse">Seleccionado</span>
                    )}
                  </div>
                  <input type="hidden" {...register('cnc_tipo', { required: 'Selecciona un tipo' })} />
                  <div ref={el => { dropdownRefs.current['cnc_tipo'] = el; }} className="relative">
                    <button type="button" onClick={() => { if (formStatus !== 'submitting') setOpenDropdown(prev => prev === 'cnc_tipo' ? null : 'cnc_tipo'); }} disabled={formStatus === 'submitting'}
                      className={`input-field text-left w-full flex items-center justify-between transition-all duration-300 ${selectionFeedback?.subtype ? 'border-cmyk-cyan border-b-4 animate-pulse shadow-[0_0_10px_rgba(0,183,235,0.5)]' : ''} ${!cncTipo ? 'text-gray-500' : 'text-white'}`}>
                      <span className="truncate">{cncTipo ? (cncTipo === 'router-cnc' ? 'Router CNC' : cncTipo === 'corte-laser' ? 'Corte Láser' : cncTipo === 'grabado-laser' ? 'Grabado Láser' : 'Otro (especificar)') : 'Selecciona tipo'}</span>
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'cnc_tipo' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {openDropdown === 'cnc_tipo' && (
                      <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl">
                        <li><button type="button" onClick={() => { setValue('cnc_tipo', '' as any); setOpenDropdown(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-neutral-700 transition-colors">Selecciona tipo</button></li>
                        {CNC_LASER_TIPOS.map(tipo => (
                          <li key={tipo}><button type="button" onClick={() => { setValue('cnc_tipo', tipo); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${cncTipo === tipo ? 'bg-cmyk-cyan/20 text-cmyk-cyan font-semibold' : 'text-white hover:bg-neutral-700'}`}>{tipo === 'router-cnc' ? 'Router CNC' : tipo === 'corte-laser' ? 'Corte Láser' : tipo === 'grabado-laser' ? 'Grabado Láser' : 'Otro (especificar)'}</button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.cnc_tipo && <p className="error-message">{errors.cnc_tipo.message}</p>}
                  {cncTipo === 'otro' && (
                    <div className="mt-2">
                      <input {...register('cnc_tipoOtro', { required: cncTipo === 'otro' ? 'Especifica el tipo' : false })} type="text" className="input-field" placeholder="Especifica el tipo" disabled={formStatus === 'submitting'} />
                    </div>
                  )}
                </div>
              )}
              {servicioValue === 'diseno-grafico' && (
                <div>
                  <div className="flex justify-between items-center">
                    <label className="label-field">Tipo de diseño <span className="text-cmyk-magenta">*</span></label>
                    {selectionFeedback?.subtype && (
                      <span className="text-xs text-cmyk-cyan font-semibold animate-pulse">Seleccionado</span>
                    )}
                  </div>
                  <input type="hidden" {...register('dis_tipo', { required: 'Selecciona un tipo' })} />
                  <div ref={el => { dropdownRefs.current['dis_tipo'] = el; }} className="relative">
                    <button type="button" onClick={() => { if (formStatus !== 'submitting') setOpenDropdown(prev => prev === 'dis_tipo' ? null : 'dis_tipo'); }} disabled={formStatus === 'submitting'}
                      className={`input-field text-left w-full flex items-center justify-between transition-all duration-300 ${selectionFeedback?.subtype ? 'border-cmyk-cyan border-b-4 animate-pulse shadow-[0_0_10px_rgba(0,183,235,0.5)]' : ''} ${!disTipo ? 'text-gray-500' : 'text-white'}`}>
                      <span className="truncate">{disTipo ? (disTipo === 'logotipos' ? 'Logotipos' : disTipo === 'papeleria' ? 'Papelería' : disTipo === 'redes-sociales' ? 'Redes Sociales' : 'Otro (especificar)') : 'Selecciona tipo'}</span>
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'dis_tipo' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {openDropdown === 'dis_tipo' && (
                      <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl">
                        <li><button type="button" onClick={() => { setValue('dis_tipo', '' as any); setOpenDropdown(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-neutral-700 transition-colors">Selecciona tipo</button></li>
                        {DISENO_GRAFICO_TIPOS.map(tipo => (
                          <li key={tipo}><button type="button" onClick={() => { setValue('dis_tipo', tipo); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${disTipo === tipo ? 'bg-cmyk-cyan/20 text-cmyk-cyan font-semibold' : 'text-white hover:bg-neutral-700'}`}>{tipo === 'logotipos' ? 'Logotipos' : tipo === 'papeleria' ? 'Papelería' : tipo === 'redes-sociales' ? 'Redes Sociales' : 'Otro (especificar)'}</button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.dis_tipo && <p className="error-message">{errors.dis_tipo.message}</p>}
                  {disTipo === 'otro' && (
                    <div className="mt-2">
                      <input {...register('dis_tipoOtro', { required: disTipo === 'otro' ? 'Especifica el tipo' : false })} type="text" className="input-field" placeholder="Especifica el tipo" disabled={formStatus === 'submitting'} />
                    </div>
                  )}
                </div>
              )}
              {servicioValue === 'impresion-offset-serigrafia' && (
                <div>
                  <label className="label-field">Producto <span className="text-cmyk-magenta">*</span></label>
                  <input type="hidden" {...register('off_producto', { required: 'Selecciona un producto' })} />
                  <div ref={el => { dropdownRefs.current['off_producto'] = el; }} className="relative">
                    <button type="button" onClick={() => { if (formStatus !== 'submitting') setOpenDropdown(prev => prev === 'off_producto' ? null : 'off_producto'); }} disabled={formStatus === 'submitting'}
                      className={`input-field text-left w-full flex items-center justify-between transition-all duration-300 ${!offProducto ? 'text-gray-500' : 'text-white'}`}>
                      <span className="truncate">{offProducto ? (offProducto === 'tarjetas-presentacion' ? 'Tarjetas de presentación' : offProducto === 'volantes' ? 'Volantes' : 'Otro (especificar)') : 'Selecciona producto'}</span>
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'off_producto' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {openDropdown === 'off_producto' && (
                      <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl">
                        <li><button type="button" onClick={() => { setValue('off_producto', ''); setOpenDropdown(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-neutral-700 transition-colors">Selecciona producto</button></li>
                        {OFFSET_PRODUCTOS.map(prod => (
                          <li key={prod}><button type="button" onClick={() => { setValue('off_producto', prod); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${offProducto === prod ? 'bg-cmyk-cyan/20 text-cmyk-cyan font-semibold' : 'text-white hover:bg-neutral-700'}`}>{prod === 'tarjetas-presentacion' ? 'Tarjetas de presentación' : prod === 'volantes' ? 'Volantes' : 'Otro (especificar)'}</button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.off_producto && <p className="error-message">{errors.off_producto.message}</p>}
                  {offProducto === 'otro' && (
                    <div className="mt-2">
                      <input {...register('off_productoOtro', { required: offProducto === 'otro' ? 'Especifica el producto' : false })} type="text" className="input-field" placeholder="Especifica el producto" disabled={formStatus === 'submitting'} />
                    </div>
                  )}
                </div>
              )}

              {/* Fecha requerida — shown inline unless route-based pub-movil */}
              {servicioValue && !(servicioValue === 'publicidad-movil' && ['publibuses', 'vallas-moviles', 'perifoneo'].includes(pubSubtipo || '')) && (
                <div>
                  <label htmlFor="fechaRequerida" className="label-field">
                    Fecha requerida <span className="text-cmyk-magenta">*</span>
                  </label>
                  <input
                    {...register('fechaRequerida', { required: !servicioValue || (servicioValue === 'publicidad-movil' && ['publibuses', 'vallas-moviles', 'perifoneo'].includes(pubSubtipo || '')) ? false : 'La fecha es requerida' })}
                    type="date"
                    id="fechaRequerida"
                    className="input-field"
                    min={minDeliveryDate}
                    disabled={formStatus === 'submitting'}
                  />
                  {errors.fechaRequerida && <p className="error-message">{errors.fechaRequerida.message}</p>}
                  {deliveryTimeMsg && (
                    <p className="text-xs text-amber-400/90 mt-1.5 flex items-start gap-1">
                      <span className="mt-0.5">⏱️</span>
                      <span>{deliveryTimeMsg}</span>
                    </p>
                  )}
                </div>
              )}
            </div>



          {/* ──── Service Parameters ──── */}
          {servicioValue && (
            <div className="space-y-6">

              {/* ESPECTACULARES — remaining params (type already inline) */}
              {servicioValue === 'espectaculares' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                  <div>
                    <label className="label-field">Medidas (ancho × alto) <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('esp_medidas', { required: 'Las medidas son requeridas' })} type="text" className="input-field" placeholder="ej. 12m × 6m" disabled={formStatus === 'submitting'} />
                    {errors.esp_medidas && <p className="error-message">{errors.esp_medidas.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">Tiempo de exhibición <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('esp_tiempoExhibicion', { required: 'El tiempo es requerido' })} type="text" className="input-field" placeholder="ej. 3 meses" disabled={formStatus === 'submitting'} />
                    {errors.esp_tiempoExhibicion && <p className="error-message">{errors.esp_tiempoExhibicion.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">¿Impresión incluida? <span className="text-cmyk-magenta">*</span></label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('esp_impresionIncluida', { required: 'Selecciona una opción' })} type="radio" value="si" className="text-cmyk-cyan" /> Sí
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('esp_impresionIncluida')} type="radio" value="no" className="text-cmyk-cyan" /> No
                      </label>
                    </div>
                    {errors.esp_impresionIncluida && <p className="error-message">{errors.esp_impresionIncluida.message}</p>}
                  </div>
                </div>
              )}

              {/* FABRICACIÓN DE ANUNCIOS — remaining params (type already inline) */}
              {servicioValue === 'fabricacion-anuncios' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                  <div>
                    <label className="label-field">Medidas <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('fab_medidas', { required: 'Las medidas son requeridas' })} type="text" className="input-field" placeholder="ancho × alto × profundidad" disabled={formStatus === 'submitting'} />
                    {errors.fab_medidas && <p className="error-message">{errors.fab_medidas.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">Uso <span className="text-cmyk-magenta">*</span></label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('fab_uso', { required: 'Selecciona una opción' })} type="radio" value="interior" className="text-cmyk-cyan" /> Interior
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('fab_uso')} type="radio" value="exterior" className="text-cmyk-cyan" /> Exterior
                      </label>
                    </div>
                    {errors.fab_uso && <p className="error-message">{errors.fab_uso.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">¿Iluminación? <span className="text-cmyk-magenta">*</span></label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('fab_iluminacion', { required: 'Selecciona una opción' })} type="radio" value="si" className="text-cmyk-cyan" /> Sí
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('fab_iluminacion')} type="radio" value="no" className="text-cmyk-cyan" /> No
                      </label>
                    </div>
                    {errors.fab_iluminacion && <p className="error-message">{errors.fab_iluminacion.message}</p>}
                  </div>
                </div>
              )}

              {/* PUBLICIDAD MÓVIL — subtypes (subtipo selector already inline) */}
              {servicioValue === 'publicidad-movil' && (
                <div className="space-y-6">
                  {/* Otro subtipo fields */}
                  {pubSubtipo === 'otro' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                      <div className="md:col-span-2">
                        <label className="label-field">Tipo de publicidad móvil <span className="text-cmyk-magenta">*</span></label>
                        <input {...register('pub_subtipoOtro', { required: pubSubtipo === 'otro' ? 'Especifica el tipo' : false })} type="text" className="input-field" placeholder="Especifica el tipo de publicidad móvil" disabled={formStatus === 'submitting'} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label-field">Descripción del servicio <span className="text-cmyk-magenta">*</span></label>
                        <textarea {...register('pub_otroDescripcion', { required: pubSubtipo === 'otro' ? 'La descripción es requerida' : false })} className="input-field" rows={3} placeholder="Describe detalladamente el servicio que necesitas" disabled={formStatus === 'submitting'} />
                      </div>
                    </div>
                  )}

                  {/* Vallas móviles fields */}
                  {pubSubtipo === 'vallas-moviles' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50 overflow-hidden">

                      {/* Multi-route section */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-cmyk-cyan flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                            Rutas de circulación
                          </h4>
                          <span className="text-xs text-gray-500">{vallasRoutes.length} ruta{vallasRoutes.length > 1 ? 's' : ''}</span>
                        </div>
                        <p className="text-xs text-gray-400 -mt-2">Agrega una o más rutas con sus fechas y horarios. Cada ruta puede tener su propio calendario.</p>
                        <p className="text-xs text-amber-400/90 -mt-1 flex items-start gap-1">
                          <span className="mt-0.5">⏱️</span>
                          <span>Mínimo 8 días hábiles de anticipación. Los días se cuentan a partir de que el pago se realiza (es decir, se concreta el pedido).</span>
                        </p>

                        {vallasRoutes.map((entry, idx) => (
                          <div key={entry.id} className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-3 sm:p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-cmyk-cyan">Ruta {idx + 1}</span>
                              {vallasRoutes.length > 1 && (
                                <button type="button" onClick={() => setVallasRoutes(prev => prev.filter(r => r.id !== entry.id))} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Eliminar
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <div>
                                <label className="label-field text-xs">Fecha inicio <span className="text-cmyk-magenta">*</span></label>
                                <input type="date" className="input-field text-sm" disabled={formStatus === 'submitting'}
                                  min={minRouteStartDate}
                                  value={entry.fechaInicio}
                                  onChange={(e) => setVallasRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, fechaInicio: e.target.value, fechaFin: r.fechaFin && r.fechaFin < e.target.value ? e.target.value : r.fechaFin } : r))} />
                              </div>
                              <div>
                                <label className="label-field text-xs">Fecha fin <span className="text-cmyk-magenta">*</span></label>
                                <input type="date" className="input-field text-sm" disabled={formStatus === 'submitting'}
                                  min={entry.fechaInicio || minRouteStartDate}
                                  value={entry.fechaFin}
                                  onChange={(e) => setVallasRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, fechaFin: e.target.value } : r))} />
                              </div>
                              <div>
                                <label className="label-field text-xs">Horario inicio <span className="text-cmyk-magenta">*</span></label>
                                <input type="time" className={`input-field text-sm ${entry.horarioInicio && (entry.horarioInicio < '07:00' || entry.horarioInicio > '19:00') ? 'border-red-500 text-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`} disabled={formStatus === 'submitting'}
                                  min="07:00" max="19:00"
                                  value={entry.horarioInicio}
                                  onChange={(e) => setVallasRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, horarioInicio: e.target.value } : r))} />
                                {entry.horarioInicio && (entry.horarioInicio < '07:00' || entry.horarioInicio > '19:00') && (
                                  <p className="text-xs text-red-400 mt-0.5">Fuera del horario permitido</p>
                                )}
                              </div>
                              <div>
                                <label className="label-field text-xs">Horario fin <span className="text-cmyk-magenta">*</span></label>
                                <input type="time" className={`input-field text-sm ${entry.horarioFin && (entry.horarioFin < '07:00' || entry.horarioFin > '19:00') ? 'border-red-500 text-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`} disabled={formStatus === 'submitting'}
                                  min="07:00" max="19:00"
                                  value={entry.horarioFin}
                                  onChange={(e) => setVallasRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, horarioFin: e.target.value } : r))} />
                                {entry.horarioFin && (entry.horarioFin < '07:00' || entry.horarioFin > '19:00') && (
                                  <p className="text-xs text-red-400 mt-0.5">Fuera del horario permitido</p>
                                )}
                              </div>
                            </div>
                            <p className={`text-xs -mt-1 ${vallasRoutes.some(r => (r.horarioInicio && (r.horarioInicio < '07:00' || r.horarioInicio > '19:00')) || (r.horarioFin && (r.horarioFin < '07:00' || r.horarioFin > '19:00'))) ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>Horario permitido: 7:00 a 19:00</p>
                            <div>
                              <label className="label-field text-xs mb-1.5 block">Trazar ruta en mapa <span className="text-cmyk-magenta">*</span></label>
                              <RouteSelector onChange={(route) => setVallasRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, route } : r))} />
                              {!entry.route?.routeData && (
                                <p className="text-xs text-amber-400 mt-1">⚠️ Debes trazar la ruta en el mapa</p>
                              )}
                            </div>
                            {/* Per-route comments */}
                            <div>
                              <label className="label-field text-xs">Comentarios adicionales <span className="text-gray-500">(opcional)</span></label>
                              <textarea
                                className="input-field text-sm resize-none"
                                rows={2}
                                placeholder="Instrucciones o detalles específicos para esta ruta"
                                value={entry.comentarios}
                                onChange={(e) => setVallasRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, comentarios: e.target.value } : r))}
                                disabled={formStatus === 'submitting'}
                                maxLength={1000}
                              />
                            </div>
                            {/* Per-route files */}
                            <div>
                              <label className="label-field text-xs">Adjuntar archivos <span className="text-gray-500">(opcional)</span></label>
                              <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-neutral-600 hover:border-cmyk-cyan/50 cursor-pointer transition-colors text-xs text-gray-400 hover:text-gray-300">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                Seleccionar archivos
                                <input type="file" multiple className="hidden" disabled={formStatus === 'submitting'}
                                  accept=".pdf,.jpg,.jpeg,.png,.ai,.cdr,.dxf,.svg,.mp3,.wav,.ogg,.m4a"
                                  onChange={(e) => {
                                    if (!e.target.files) return;
                                    const files = Array.from(e.target.files).filter(f => f.size <= 10 * 1024 * 1024);
                                    setVallasRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, archivos: [...r.archivos, ...files] } : r));
                                    e.target.value = '';
                                  }} />
                              </label>
                              {entry.archivos.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {entry.archivos.map((file, fi) => (
                                    <div key={fi} className="flex items-center justify-between bg-neutral-800 rounded px-2 py-1">
                                      <span className="text-xs text-white truncate">{file.name}</span>
                                      <button type="button" onClick={() => setVallasRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, archivos: r.archivos.filter((_, j) => j !== fi) } : r))} className="text-red-400 hover:text-red-300 p-0.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        <button type="button"
                          onClick={() => setVallasRoutes(prev => [...prev, createConfigurableRoute()])}
                          className="w-full py-2.5 rounded-xl border-2 border-dashed border-cmyk-cyan/40 text-cmyk-cyan text-sm font-medium hover:bg-cmyk-cyan/10 hover:border-cmyk-cyan transition-all flex items-center justify-center gap-2"
                          disabled={formStatus === 'submitting'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Agregar otra ruta
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Publibuses fields */}
                  {pubSubtipo === 'publibuses' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                      <div className="md:col-span-2">
                        <label className="label-field">Tiempo de campaña (meses) <span className="text-cmyk-magenta">*</span></label>
                        <select {...register('pub_mesesCampana', { required: pubSubtipo === 'publibuses' ? 'Selecciona los meses' : false, valueAsNumber: true })} className="input-field" disabled={formStatus === 'submitting'}>
                          <option value="">Selecciona duración</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                            <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>
                          ))}
                        </select>
                      </div>

                      {/* Multi-route for publibuses */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-cmyk-cyan flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                            Rutas preestablecidas
                          </h4>
                          <span className="text-xs text-gray-500">{pubRoutes.length} ruta{pubRoutes.length > 1 ? 's' : ''}</span>
                        </div>
                        <p className="text-xs text-gray-400 -mt-2">Selecciona una o más rutas. La fecha fin se calcula automáticamente según los meses de campaña.</p>
                        <p className="text-xs text-amber-400/90 -mt-1 flex items-start gap-1">
                          <span className="mt-0.5">⏱️</span>
                          <span>Mínimo 8 días hábiles de anticipación. Los días se cuentan a partir de que el pago se realiza (es decir, se concreta el pedido).</span>
                        </p>

                        {!pubMesesCampana && (
                          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">⚠️ Primero selecciona los meses de campaña arriba para habilitar las fechas.</p>
                        )}

                        {pubRoutes.map((entry, idx) => (
                          <div key={entry.id} className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-3 sm:p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-cmyk-cyan">Ruta {idx + 1}</span>
                              {pubRoutes.length > 1 && (
                                <button type="button" onClick={() => setPubRoutes(prev => prev.filter(r => r.id !== entry.id))} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Eliminar
                                </button>
                              )}
                            </div>
                            <div>
                              <label className="label-field text-xs">Ruta preestablecida</label>
                              <select className="input-field text-sm" disabled={formStatus === 'submitting'}
                                value={entry.ruta}
                                onChange={(e) => setPubRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, ruta: e.target.value } : r))}>
                                <option value="">Selecciona una ruta</option>
                                <option value="zocalo-base">Zócalo Base</option>
                                <option value="colosio-zocalo">Colosio Zócalo</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <div>
                                <label className="label-field text-xs">Fecha inicio <span className="text-cmyk-magenta">*</span></label>
                                <input type="date" className="input-field text-sm"
                                  disabled={formStatus === 'submitting' || !pubMesesCampana}
                                  min={minRouteStartDate}
                                  value={entry.fechaInicio}
                                  onChange={(e) => setPubRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, fechaInicio: e.target.value } : r))} />
                              </div>
                              <div>
                                <label className="label-field text-xs">Fecha fin <span className="text-gray-500">(auto)</span></label>
                                <input type="date" className="input-field text-sm bg-neutral-800 cursor-not-allowed" readOnly
                                  value={entry.fechaInicio && pubMesesCampana ? addMonths(entry.fechaInicio, Number(pubMesesCampana)) : ''} />
                              </div>
                            </div>

                            {/* Show map only when a route is selected */}
                            {entry.ruta && (
                              <div className="rounded-xl overflow-hidden border border-cmyk-cyan/30 bg-neutral-900">
                                <div className="p-2.5 bg-neutral-800/50 border-b border-neutral-700">
                                  <p className="text-xs text-cmyk-cyan font-medium flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                                    {entry.ruta === 'zocalo-base' ? 'Zócalo Base' : 'Colosio Zócalo'}
                                  </p>
                                </div>
                                <iframe
                                  src={entry.ruta === 'zocalo-base'
                                    ? 'https://www.google.com/maps/d/embed?mid=1VXvDDqbLCqv54dbwkmtfNs8XKjUxzvo&ll=16.835724183151132%2C-99.87844209999999&z=13'
                                    : 'https://www.google.com/maps/d/embed?mid=1NrsT2SEvgGKOh7NusgOHD6-NJd4h1GE&ll=16.82830914325928%2C-99.85695&z=13'}
                                  width="100%"
                                  height="280"
                                  style={{ border: 0, minHeight: '230px' }}
                                  allowFullScreen
                                  loading="lazy"
                                  referrerPolicy="no-referrer-when-downgrade"
                                  className="w-full"
                                  title={entry.ruta === 'zocalo-base' ? 'Ruta Zócalo Base' : 'Ruta Colosio Zócalo'}
                                />
                              </div>
                            )}
                            {/* Per-route comments */}
                            <div>
                              <label className="label-field text-xs">Comentarios adicionales <span className="text-gray-500">(opcional)</span></label>
                              <textarea
                                className="input-field text-sm resize-none"
                                rows={2}
                                placeholder="Instrucciones o detalles específicos para esta ruta"
                                value={entry.comentarios}
                                onChange={(e) => setPubRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, comentarios: e.target.value } : r))}
                                disabled={formStatus === 'submitting'}
                                maxLength={1000}
                              />
                            </div>
                            {/* Per-route files */}
                            <div>
                              <label className="label-field text-xs">Adjuntar archivos <span className="text-gray-500">(opcional)</span></label>
                              <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-neutral-600 hover:border-cmyk-cyan/50 cursor-pointer transition-colors text-xs text-gray-400 hover:text-gray-300">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                Seleccionar archivos
                                <input type="file" multiple className="hidden" disabled={formStatus === 'submitting'}
                                  accept=".pdf,.jpg,.jpeg,.png,.ai,.cdr,.dxf,.svg,.mp3,.wav,.ogg,.m4a"
                                  onChange={(e) => {
                                    if (!e.target.files) return;
                                    const files = Array.from(e.target.files).filter(f => f.size <= 10 * 1024 * 1024);
                                    setPubRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, archivos: [...r.archivos, ...files] } : r));
                                    e.target.value = '';
                                  }} />
                              </label>
                              {entry.archivos.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {entry.archivos.map((file, fi) => (
                                    <div key={fi} className="flex items-center justify-between bg-neutral-800 rounded px-2 py-1">
                                      <span className="text-xs text-white truncate">{file.name}</span>
                                      <button type="button" onClick={() => setPubRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, archivos: r.archivos.filter((_, j) => j !== fi) } : r))} className="text-red-400 hover:text-red-300 p-0.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        <button type="button"
                          onClick={() => setPubRoutes(prev => [...prev, createEstablishedRoute()])}
                          className="w-full py-2.5 rounded-xl border-2 border-dashed border-cmyk-cyan/40 text-cmyk-cyan text-sm font-medium hover:bg-cmyk-cyan/10 hover:border-cmyk-cyan transition-all flex items-center justify-center gap-2"
                          disabled={formStatus === 'submitting'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Agregar otra ruta
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Perifoneo fields */}
                  {pubSubtipo === 'perifoneo' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50 overflow-hidden">
                      <div className="md:col-span-2">
                        <label className="label-field">¿Requiere grabación por parte del proveedor? <span className="text-cmyk-magenta">*</span></label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center gap-2 text-white cursor-pointer">
                            <input {...register('pub_requiereGrabacion', { required: pubSubtipo === 'perifoneo' ? 'Selecciona una opción' : false })} type="radio" value="si" className="text-cmyk-cyan" /> Sí
                          </label>
                          <label className="flex items-center gap-2 text-white cursor-pointer">
                            <input {...register('pub_requiereGrabacion')} type="radio" value="no" className="text-cmyk-cyan" /> No, proporcionaré el archivo
                          </label>
                        </div>
                        {errors.pub_requiereGrabacion && <p className="error-message">{errors.pub_requiereGrabacion.message}</p>}
                      </div>

                      {/* Conditional message based on grabación answer */}
                      {pubRequiereGrabacion === 'si' && (
                        <div className="md:col-span-2">
                          <p className="text-xs text-amber-400/90 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2 flex items-start gap-1.5">
                            <span className="mt-0.5">📝</span>
                            <span>En la sección de <strong>comentarios</strong> (más abajo) es <strong>obligatorio</strong> que especifiques qué quieres que diga la grabación y la duración deseada.</span>
                          </p>
                        </div>
                      )}
                      {pubRequiereGrabacion === 'no' && (
                        <div className="md:col-span-2">
                          <p className="text-xs text-amber-400/90 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2 flex items-start gap-1.5">
                            <span className="mt-0.5">📎</span>
                            <span>Es <strong>obligatorio</strong> adjuntar el archivo de grabación en la sección de <strong>archivos adjuntos</strong> (más abajo).</span>
                          </p>
                        </div>
                      )}

                      {/* Multi-route section for perifoneo */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-cmyk-cyan flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                            Rutas de perifoneo
                          </h4>
                          <span className="text-xs text-gray-500">{perifoneoRoutes.length} ruta{perifoneoRoutes.length > 1 ? 's' : ''}</span>
                        </div>
                        <p className="text-xs text-gray-400 -mt-2">Agrega una o más rutas con sus fechas y horarios de perifoneo.</p>
                        <p className="text-xs text-amber-400/90 -mt-1 flex items-start gap-1">
                          <span className="mt-0.5">⏱️</span>
                          <span>Mínimo 8 días hábiles de anticipación. Los días se cuentan a partir de que el pago se realiza (es decir, se concreta el pedido).</span>
                        </p>

                        {perifoneoRoutes.map((entry, idx) => (
                          <div key={entry.id} className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-3 sm:p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-cmyk-cyan">Ruta {idx + 1}</span>
                              {perifoneoRoutes.length > 1 && (
                                <button type="button" onClick={() => setPerifoneoRoutes(prev => prev.filter(r => r.id !== entry.id))} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Eliminar
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <div>
                                <label className="label-field text-xs">Fecha inicio <span className="text-cmyk-magenta">*</span></label>
                                <input type="date" className="input-field text-sm" disabled={formStatus === 'submitting'}
                                  min={minRouteStartDate}
                                  value={entry.fechaInicio}
                                  onChange={(e) => setPerifoneoRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, fechaInicio: e.target.value, fechaFin: r.fechaFin && r.fechaFin < e.target.value ? e.target.value : r.fechaFin } : r))} />
                              </div>
                              <div>
                                <label className="label-field text-xs">Fecha fin <span className="text-cmyk-magenta">*</span></label>
                                <input type="date" className="input-field text-sm" disabled={formStatus === 'submitting'}
                                  min={entry.fechaInicio || minRouteStartDate}
                                  value={entry.fechaFin}
                                  onChange={(e) => setPerifoneoRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, fechaFin: e.target.value } : r))} />
                              </div>
                              <div>
                                <label className="label-field text-xs">Horario inicio <span className="text-cmyk-magenta">*</span></label>
                                <input type="time" className={`input-field text-sm ${entry.horarioInicio && (entry.horarioInicio < '07:00' || entry.horarioInicio > '19:00') ? 'border-red-500 text-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`} disabled={formStatus === 'submitting'}
                                  min="07:00" max="19:00"
                                  value={entry.horarioInicio}
                                  onChange={(e) => setPerifoneoRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, horarioInicio: e.target.value } : r))} />
                                {entry.horarioInicio && (entry.horarioInicio < '07:00' || entry.horarioInicio > '19:00') && (
                                  <p className="text-xs text-red-400 mt-0.5">Fuera del horario permitido</p>
                                )}
                              </div>
                              <div>
                                <label className="label-field text-xs">Horario fin <span className="text-cmyk-magenta">*</span></label>
                                <input type="time" className={`input-field text-sm ${entry.horarioFin && (entry.horarioFin < '07:00' || entry.horarioFin > '19:00') ? 'border-red-500 text-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`} disabled={formStatus === 'submitting'}
                                  min="07:00" max="19:00"
                                  value={entry.horarioFin}
                                  onChange={(e) => setPerifoneoRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, horarioFin: e.target.value } : r))} />
                                {entry.horarioFin && (entry.horarioFin < '07:00' || entry.horarioFin > '19:00') && (
                                  <p className="text-xs text-red-400 mt-0.5">Fuera del horario permitido</p>
                                )}
                              </div>
                            </div>
                            <p className={`text-xs -mt-1 ${perifoneoRoutes.some(r => (r.horarioInicio && (r.horarioInicio < '07:00' || r.horarioInicio > '19:00')) || (r.horarioFin && (r.horarioFin < '07:00' || r.horarioFin > '19:00'))) ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>Horario permitido: 7:00 a 19:00</p>
                            <div>
                              <label className="label-field text-xs mb-1.5 block">Trazar ruta en mapa <span className="text-cmyk-magenta">*</span></label>
                              <RouteSelector onChange={(route) => setPerifoneoRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, route } : r))} />
                              {!entry.route?.routeData && (
                                <p className="text-xs text-amber-400 mt-1">⚠️ Debes trazar la ruta en el mapa</p>
                              )}
                            </div>
                            {/* Per-route comments */}
                            <div>
                              <label className="label-field text-xs">Comentarios adicionales <span className="text-gray-500">(opcional)</span></label>
                              <textarea
                                className="input-field text-sm resize-none"
                                rows={2}
                                placeholder="Instrucciones o detalles específicos para esta ruta"
                                value={entry.comentarios}
                                onChange={(e) => setPerifoneoRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, comentarios: e.target.value } : r))}
                                disabled={formStatus === 'submitting'}
                                maxLength={1000}
                              />
                            </div>
                            {/* Per-route files */}
                            <div>
                              <label className="label-field text-xs">Adjuntar archivos <span className="text-gray-500">(opcional)</span></label>
                              <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-neutral-600 hover:border-cmyk-cyan/50 cursor-pointer transition-colors text-xs text-gray-400 hover:text-gray-300">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                Seleccionar archivos
                                <input type="file" multiple className="hidden" disabled={formStatus === 'submitting'}
                                  accept=".pdf,.jpg,.jpeg,.png,.ai,.cdr,.dxf,.svg,.mp3,.wav,.ogg,.m4a"
                                  onChange={(e) => {
                                    if (!e.target.files) return;
                                    const files = Array.from(e.target.files).filter(f => f.size <= 10 * 1024 * 1024);
                                    setPerifoneoRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, archivos: [...r.archivos, ...files] } : r));
                                    e.target.value = '';
                                  }} />
                              </label>
                              {entry.archivos.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {entry.archivos.map((file, fi) => (
                                    <div key={fi} className="flex items-center justify-between bg-neutral-800 rounded px-2 py-1">
                                      <span className="text-xs text-white truncate">{file.name}</span>
                                      <button type="button" onClick={() => setPerifoneoRoutes(prev => prev.map(r => r.id === entry.id ? { ...r, archivos: r.archivos.filter((_, j) => j !== fi) } : r))} className="text-red-400 hover:text-red-300 p-0.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        <button type="button"
                          onClick={() => setPerifoneoRoutes(prev => [...prev, createConfigurableRoute()])}
                          className="w-full py-2.5 rounded-xl border-2 border-dashed border-cmyk-cyan/40 text-cmyk-cyan text-sm font-medium hover:bg-cmyk-cyan/10 hover:border-cmyk-cyan transition-all flex items-center justify-center gap-2"
                          disabled={formStatus === 'submitting'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Agregar otra ruta
                        </button>
                      </div>

                      <div className="md:col-span-2">
                        <label className="label-field mb-2 block">Descripción de zona</label>
                        <textarea {...register('pub_descripcionZona')} className="input-field" rows={3} placeholder="Describe las calles, colonias o puntos de referencia que delimitan la zona de perifoneo" disabled={formStatus === 'submitting'} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* IMPRESIÓN GRAN FORMATO — remaining params (material already inline) */}
              {servicioValue === 'impresion-gran-formato' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                  <div>
                    <label className="label-field">Medidas <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('igf_medidas', { required: 'Las medidas son requeridas' })} type="text" className="input-field" placeholder="ancho × alto" disabled={formStatus === 'submitting'} />
                    {errors.igf_medidas && <p className="error-message">{errors.igf_medidas.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">Cantidad <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('igf_cantidad', { required: 'La cantidad es requerida', min: { value: 1, message: 'Mínimo 1' }, valueAsNumber: true })} type="number" min="1" className="input-field" placeholder="1" disabled={formStatus === 'submitting'} />
                    {errors.igf_cantidad && <p className="error-message">{errors.igf_cantidad.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">¿Archivo listo para imprimir? <span className="text-cmyk-magenta">*</span></label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('igf_archivoListo', { required: 'Selecciona una opción' })} type="radio" value="si" className="text-cmyk-cyan" /> Sí
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('igf_archivoListo')} type="radio" value="no" className="text-cmyk-cyan" /> No
                      </label>
                    </div>
                    {errors.igf_archivoListo && <p className="error-message">{errors.igf_archivoListo.message}</p>}
                  </div>
                </div>
              )}

              {/* SEÑALIZACIÓN — remaining params (type already inline) */}
              {servicioValue === 'senalizacion' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                  <div>
                    <label className="label-field">Medidas <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('sen_medidas', { required: 'Las medidas son requeridas' })} type="text" className="input-field" placeholder="ancho × alto" disabled={formStatus === 'submitting'} />
                    {errors.sen_medidas && <p className="error-message">{errors.sen_medidas.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">Cantidad <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('sen_cantidad', { required: 'La cantidad es requerida', min: { value: 1, message: 'Mínimo 1' }, valueAsNumber: true })} type="number" min="1" className="input-field" placeholder="1" disabled={formStatus === 'submitting'} />
                    {errors.sen_cantidad && <p className="error-message">{errors.sen_cantidad.message}</p>}
                  </div>
                </div>
              )}

              {/* ROTULACIÓN VEHICULAR — remaining params (type already inline) */}
              {servicioValue === 'rotulacion-vehicular' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                  <div>
                    <label className="label-field">Tipo de vehículo <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('rot_tipoVehiculo', { required: 'El tipo de vehículo es requerido' })} type="text" className="input-field" placeholder="ej. Camioneta, Sedán, Autobús" disabled={formStatus === 'submitting'} />
                    {errors.rot_tipoVehiculo && <p className="error-message">{errors.rot_tipoVehiculo.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">¿Diseño incluido? <span className="text-cmyk-magenta">*</span></label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('rot_disenoIncluido', { required: 'Selecciona una opción' })} type="radio" value="si" className="text-cmyk-cyan" /> Sí
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('rot_disenoIncluido')} type="radio" value="no" className="text-cmyk-cyan" /> No
                      </label>
                    </div>
                    {errors.rot_disenoIncluido && <p className="error-message">{errors.rot_disenoIncluido.message}</p>}
                  </div>
                </div>
              )}

              {/* CORTE Y GRABADO CNC/LÁSER — remaining params (type already inline) */}
              {servicioValue === 'corte-grabado-cnc-laser' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                  <div>
                    <label className="label-field">Medidas <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('cnc_medidas', { required: 'Las medidas son requeridas' })} type="text" className="input-field" placeholder="ancho × alto × espesor" disabled={formStatus === 'submitting'} />
                    {errors.cnc_medidas && <p className="error-message">{errors.cnc_medidas.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">Cantidad <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('cnc_cantidad', { required: 'La cantidad es requerida', min: { value: 1, message: 'Mínimo 1' }, valueAsNumber: true })} type="number" min="1" className="input-field" placeholder="1" disabled={formStatus === 'submitting'} />
                    {errors.cnc_cantidad && <p className="error-message">{errors.cnc_cantidad.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">¿Archivo listo? <span className="text-cmyk-magenta">*</span></label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('cnc_archivoListo', { required: 'Selecciona una opción' })} type="radio" value="si" className="text-cmyk-cyan" /> Sí
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('cnc_archivoListo')} type="radio" value="no" className="text-cmyk-cyan" /> No
                      </label>
                    </div>
                    {errors.cnc_archivoListo && <p className="error-message">{errors.cnc_archivoListo.message}</p>}
                  </div>
                </div>
              )}

              {/* DISEÑO GRÁFICO — remaining params (type already inline) */}
              {servicioValue === 'diseno-grafico' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                  <div>
                    <label className="label-field">Número de piezas <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('dis_numeroPiezas', { required: 'El número es requerido', min: { value: 1, message: 'Mínimo 1' }, valueAsNumber: true })} type="number" min="1" className="input-field" placeholder="1" disabled={formStatus === 'submitting'} />
                    {errors.dis_numeroPiezas && <p className="error-message">{errors.dis_numeroPiezas.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">Medidas / Dimensiones</label>
                    <input {...register('dis_medidas')} type="text" className="input-field" placeholder="ej. 1080×1080 px, 21×29.7 cm (A4), 1920×1080 px" disabled={formStatus === 'submitting'} />
                    <p className="text-xs text-gray-500 mt-1">Indica las dimensiones y unidad: px (píxeles), cm, mm, in (pulgadas). Si no lo sabes, déjalo en blanco.</p>
                  </div>
                  <div>
                    <label className="label-field">Uso del diseño <span className="text-cmyk-magenta">*</span></label>
                    <div className="flex flex-wrap gap-4 mt-2">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('dis_usoDiseno', { required: 'Selecciona una opción' })} type="radio" value="impresion" className="text-cmyk-cyan" /> Impresión
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('dis_usoDiseno')} type="radio" value="digital" className="text-cmyk-cyan" /> Digital
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('dis_usoDiseno')} type="radio" value="ambos" className="text-cmyk-cyan" /> Ambos
                      </label>
                    </div>
                    {errors.dis_usoDiseno && <p className="error-message">{errors.dis_usoDiseno.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">¿Cambios incluidos? <span className="text-cmyk-magenta">*</span></label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('dis_cambiosIncluidos', { required: 'Selecciona una opción' })} type="radio" value="si" className="text-cmyk-cyan" /> Sí
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('dis_cambiosIncluidos')} type="radio" value="no" className="text-cmyk-cyan" /> No
                      </label>
                    </div>
                    {errors.dis_cambiosIncluidos && <p className="error-message">{errors.dis_cambiosIncluidos.message}</p>}
                  </div>
                </div>
              )}

              {/* IMPRESIÓN OFFSET/SERIGRAFÍA — remaining params (product already inline) */}
              {servicioValue === 'impresion-offset-serigrafia' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                  <div>
                    <label className="label-field">Cantidad <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('off_cantidad', { required: 'La cantidad es requerida', min: { value: 1, message: 'Mínimo 1' }, valueAsNumber: true })} type="number" min="1" className="input-field" placeholder="100" disabled={formStatus === 'submitting'} />
                    {errors.off_cantidad && <p className="error-message">{errors.off_cantidad.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">¿Archivo listo para imprimir? <span className="text-cmyk-magenta">*</span></label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('off_archivoListo', { required: 'Selecciona una opción' })} type="radio" value="si" className="text-cmyk-cyan" /> Sí
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input {...register('off_archivoListo')} type="radio" value="no" className="text-cmyk-cyan" /> No
                      </label>
                    </div>
                    {errors.off_archivoListo && <p className="error-message">{errors.off_archivoListo.message}</p>}
                  </div>
                </div>
              )}

              {/* OTRO SERVICIO */}
              {servicioValue === 'otros' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-neutral-700/50">
                  <div className="md:col-span-2">
                    <label className="label-field">Tipo de servicio <span className="text-cmyk-magenta">*</span></label>
                    <input {...register('otros_tipoServicio', { required: servicioValue === 'otros' ? 'Especifica el tipo de servicio' : false })} type="text" className="input-field" placeholder="Describe brevemente el tipo de servicio que necesitas" disabled={formStatus === 'submitting'} />
                    {errors.otros_tipoServicio && <p className="error-message">{(errors.otros_tipoServicio as { message?: string })?.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="label-field">Descripción detallada <span className="text-cmyk-magenta">*</span></label>
                    <textarea {...register('otros_descripcion', { required: servicioValue === 'otros' ? 'La descripción es requerida' : false })} className="input-field" rows={4} placeholder="Describe detalladamente el servicio que necesitas, incluyendo especificaciones, materiales, acabados, etc." disabled={formStatus === 'submitting'} />
                    {errors.otros_descripcion && <p className="error-message">{(errors.otros_descripcion as { message?: string })?.message}</p>}
                  </div>
                  <div>
                    <label className="label-field">Medidas (si aplica)</label>
                    <input {...register('otros_medidas')} type="text" className="input-field" placeholder="ej. 2m × 1m" disabled={formStatus === 'submitting'} />
                  </div>
                  <div>
                    <label className="label-field">Cantidad</label>
                    <input {...register('otros_cantidad', { min: { value: 1, message: 'Mínimo 1' }, valueAsNumber: true })} type="number" min="1" className="input-field" placeholder="1" disabled={formStatus === 'submitting'} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──── Delivery Method (inside service box) ──── */}
          {servicioValue && (() => {
            let currentSubtype: string | undefined;
            if (servicioValue === 'espectaculares') currentSubtype = espTipo || undefined;
            else if (servicioValue === 'publicidad-movil') currentSubtype = pubSubtipo || undefined;
            else if (servicioValue === 'fabricacion-anuncios') currentSubtype = fabTipoAnuncio || undefined;
            else if (servicioValue === 'senalizacion') currentSubtype = senTipo || undefined;
            else if (servicioValue === 'corte-grabado-cnc-laser') currentSubtype = cncTipo || undefined;
            else if (servicioValue === 'rotulacion-vehicular') currentSubtype = rotTipoRotulacion || undefined;
            else if (servicioValue === 'diseno-grafico') currentSubtype = disTipo || undefined;
            else if (servicioValue === 'impresion-offset-serigrafia') currentSubtype = offProducto || undefined;

            const methods = getDeliveryMethodsForService(servicioValue, currentSubtype);
            if (methods.length === 1 && methods[0] === 'not_applicable') return null;

            return (
              <div className="space-y-4 border border-cmyk-cyan/20 rounded-xl p-4 sm:p-6 bg-neutral-900/60">
                <label className="label-field flex items-center gap-2 !mb-0">
                  <svg className="w-5 h-5 text-cmyk-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Método de entrega <span className="text-cmyk-magenta">*</span>
                </label>
                <p className="text-xs text-gray-400 -mt-2">Selecciona cómo deseas recibir tu producto o servicio</p>

                {/* Method buttons */}
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
                  {methods.filter(m => m !== 'not_applicable').map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        setDeliveryMethod(prev => prev === method ? '' : method);
                        setDeliveryError('');
                        if (method !== deliveryMethod) {
                          setDeliveryAddress({ calle: '', numero_exterior: '', numero_interior: '', colonia: '', ciudad: '', estado: '', codigo_postal: '', referencia: '' });
                          setSelectedBranch('');
                          postalCode.reset();
                          setColoniaManual(false);
                          if (savedAddresses.length > 0) {
                            setUseNewAddress(false);
                            const def = savedAddresses.find((a) => a.is_default);
                            setSelectedAddressId(def?.id || savedAddresses[0].id);
                          }
                        }
                      }}
                      disabled={formStatus === 'submitting'}
                      className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-all ${
                        deliveryMethod === method
                          ? 'border-cmyk-magenta bg-cmyk-magenta/15 text-white ring-2 ring-cmyk-magenta/50'
                          : 'border-gray-600 bg-neutral-800 text-gray-300 hover:border-gray-400 hover:bg-neutral-700'
                      }`}
                    >
                      <span className="text-lg">{DELIVERY_METHOD_ICONS[method]}</span>
                      <span>{DELIVERY_METHOD_LABELS[method].es}</span>
                    </button>
                  ))}
                </div>
                {deliveryError && <p className="error-message">{deliveryError}</p>}

                {/* SUB-FORM: Installation / Shipping address */}
                {(deliveryMethod === 'installation' || deliveryMethod === 'shipping') && (
                  <div className="space-y-3 pt-2 border-t border-gray-700">
                    <p className="text-sm text-cmyk-cyan font-medium">
                      {deliveryMethod === 'installation'
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
                              onClick={() => { setSelectedAddressId(addr.id); setDeliveryError(''); }}
                              disabled={formStatus === 'submitting'}
                              className={`w-full text-left p-3 rounded-lg border transition-all ${
                                selectedAddressId === addr.id
                                  ? 'border-cmyk-magenta bg-cmyk-magenta/10 ring-2 ring-cmyk-magenta/50'
                                  : 'border-gray-600 bg-neutral-800 hover:border-gray-400'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className={`text-sm mt-0.5 ${selectedAddressId === addr.id ? 'text-cmyk-cyan' : 'text-gray-500'}`}>📍</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-white">{addr.label || 'Dirección'}</span>
                                    {addr.is_default && <span className="text-xs text-cmyk-cyan">(Predeterminada)</span>}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {addr.calle} {addr.numero_exterior}{addr.numero_interior ? ` Int. ${addr.numero_interior}` : ''}, {addr.colonia}, {addr.ciudad}, {addr.estado} C.P. {addr.codigo_postal}
                                  </p>
                                  {addr.referencia && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      Referencia: {addr.referencia}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUseNewAddress(true);
                            setDeliveryAddress({ calle: '', numero_exterior: '', numero_interior: '', colonia: '', ciudad: '', estado: '', codigo_postal: '', referencia: '' });
                            postalCode.reset();
                            setColoniaManual(false);
                          }}
                          disabled={formStatus === 'submitting'}
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
                              const def = savedAddresses.find((a) => a.is_default);
                              setSelectedAddressId(def?.id || savedAddresses[0].id);
                            }}
                            disabled={formStatus === 'submitting'}
                            className="text-sm text-cmyk-cyan hover:underline font-medium mb-1"
                          >
                            ← Usar una dirección guardada
                          </button>
                        )}

                    {/* Row 1: Código Postal (triggers autofill) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="label-field">Código Postal <span className="text-cmyk-magenta">*</span></label>
                        <div className="relative">
                          <input
                            type="text" className="input-field" placeholder="39300" maxLength={5}
                            value={deliveryAddress.codigo_postal}
                            onChange={async e => {
                              const cp = e.target.value.replace(/\D/g, '');
                              setDeliveryAddress(p => ({ ...p, codigo_postal: cp }));
                              if (cp.length === 5) {
                                const result = await postalCode.lookup(cp);
                                if (result) {
                                  setDeliveryAddress(p => ({
                                    ...p,
                                    estado: result.estado,
                                    ciudad: result.municipio,
                                    colonia: result.colonias.length > 0 ? result.colonias[0] : '',
                                  }));
                                  setColoniaManual(false);
                                }
                              } else {
                                postalCode.reset();
                              }
                            }}
                            disabled={formStatus === 'submitting'}
                          />
                          {postalCode.loading && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <svg className="animate-spin h-4 w-4 text-cmyk-cyan" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {postalCode.error && (
                          <p className="text-xs text-red-400 mt-1">{postalCode.error}</p>
                        )}
                        {postalCode.data && (
                          <p className="text-xs text-green-400 mt-1">✓ CP encontrado — {postalCode.data.colonias.length} colonia{postalCode.data.colonias.length !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                      <div>
                        <label className="label-field">Estado <span className="text-cmyk-magenta">*</span></label>
                        <input
                          type="text" className={`input-field ${postalCode.data ? 'bg-neutral-700/50 text-gray-300' : ''}`} placeholder="Guerrero"
                          value={deliveryAddress.estado}
                          onChange={e => setDeliveryAddress(p => ({ ...p, estado: e.target.value }))}
                          readOnly={!!postalCode.data}
                          disabled={formStatus === 'submitting'}
                        />
                      </div>
                      <div>
                        <label className="label-field">Municipio / Ciudad <span className="text-cmyk-magenta">*</span></label>
                        <input
                          type="text" className={`input-field ${postalCode.data?.municipio ? 'bg-neutral-700/50 text-gray-300' : ''}`} placeholder="Acapulco de Juárez"
                          value={deliveryAddress.ciudad}
                          onChange={e => setDeliveryAddress(p => ({ ...p, ciudad: e.target.value }))}
                          readOnly={!!postalCode.data?.municipio}
                          disabled={formStatus === 'submitting'}
                        />
                      </div>
                    </div>

                    {/* Row 2: Colonia (dropdown from CP or manual) */}
                    <div>
                      <label className="label-field">Colonia <span className="text-cmyk-magenta">*</span></label>
                      {postalCode.data && postalCode.data.colonias.length > 0 && !coloniaManual ? (
                        <div className="space-y-1">
                          <select
                            className="input-field"
                            value={deliveryAddress.colonia}
                            onChange={e => {
                              if (e.target.value === '__otra__') {
                                setColoniaManual(true);
                                setDeliveryAddress(p => ({ ...p, colonia: '' }));
                              } else {
                                setDeliveryAddress(p => ({ ...p, colonia: e.target.value }));
                              }
                            }}
                            disabled={formStatus === 'submitting'}
                          >
                            {postalCode.data.colonias.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            <option value="__otra__">— Otra (escribir manualmente) —</option>
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <input
                            type="text" className="input-field" placeholder="Centro"
                            value={deliveryAddress.colonia}
                            onChange={e => setDeliveryAddress(p => ({ ...p, colonia: e.target.value }))}
                            disabled={formStatus === 'submitting'}
                          />
                          {coloniaManual && postalCode.data && (
                            <button
                              type="button"
                              className="text-xs text-cmyk-cyan hover:underline"
                              onClick={() => {
                                setColoniaManual(false);
                                setDeliveryAddress(p => ({ ...p, colonia: postalCode.data!.colonias[0] || '' }));
                              }}
                            >
                              ← Volver a seleccionar de la lista
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Row 3: Calle + Números */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label-field">Calle <span className="text-cmyk-magenta">*</span></label>
                        <input
                          type="text" className="input-field" placeholder="Av. Costera Miguel Alemán"
                          value={deliveryAddress.calle}
                          onChange={e => setDeliveryAddress(p => ({ ...p, calle: e.target.value }))}
                          disabled={formStatus === 'submitting'}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label-field">No. Exterior <span className="text-cmyk-magenta">*</span></label>
                          <input
                            type="text" className="input-field" placeholder="123"
                            value={deliveryAddress.numero_exterior}
                            onChange={e => setDeliveryAddress(p => ({ ...p, numero_exterior: e.target.value }))}
                            disabled={formStatus === 'submitting'}
                          />
                        </div>
                        <div>
                          <label className="label-field">No. Interior</label>
                          <input
                            type="text" className="input-field" placeholder="4B"
                            value={deliveryAddress.numero_interior}
                            onChange={e => setDeliveryAddress(p => ({ ...p, numero_interior: e.target.value }))}
                            disabled={formStatus === 'submitting'}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Referencia */}
                    <div>
                      <label className="label-field">Referencia</label>
                      <input
                        type="text" className="input-field" placeholder="Entre calles, color de fachada, etc."
                        value={deliveryAddress.referencia}
                        onChange={e => setDeliveryAddress(p => ({ ...p, referencia: e.target.value }))}
                        disabled={formStatus === 'submitting'}
                      />
                    </div>
                      </>
                    )}
                  </div>
                )}

                {/* SUB-FORM: Pickup — branch selection */}
                {deliveryMethod === 'pickup' && (
                  <div className="space-y-3 pt-3 border-t border-gray-700">
                    <p className="text-sm text-cmyk-cyan font-medium">🏬 Selecciona la sucursal donde recogerás tu pedido</p>
                    {branchesLoading ? (
                      <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-800/60">
                        <svg className="animate-spin h-5 w-5 text-cmyk-cyan" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-sm text-gray-400">Cargando sucursales...</span>
                      </div>
                    ) : branchesError ? (
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                        <p className="text-sm text-red-400 mb-2">No se pudieron cargar las sucursales</p>
                        <button
                          type="button"
                          onClick={fetchBranches}
                          className="text-xs text-cmyk-cyan hover:underline font-medium"
                        >
                          Reintentar
                        </button>
                      </div>
                    ) : branches.length === 0 ? (
                      <p className="text-sm text-gray-400 p-4 text-center">No hay sucursales disponibles actualmente.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {branches.map((branch) => (
                          <button
                            key={branch.id}
                            type="button"
                            onClick={() => { setSelectedBranch(branch.id); setDeliveryError(''); }}
                            disabled={formStatus === 'submitting'}
                            className={`text-left p-3 sm:p-4 rounded-lg border transition-all ${
                              selectedBranch === branch.id
                                ? 'border-cmyk-magenta bg-cmyk-magenta/10 ring-2 ring-cmyk-magenta/50'
                                : 'border-gray-600 bg-neutral-800 hover:border-gray-400'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-2xl mt-0.5 hidden sm:block">{selectedBranch === branch.id ? '✅' : '🏬'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white text-sm sm:text-base">{branch.name}</p>
                                <p className="text-xs sm:text-sm text-gray-400 mt-1 break-words">{branch.full_address}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                  <p className="text-xs text-gray-400">📞 {branch.phone}</p>
                                  <p className="text-xs text-gray-400">🕐 {branch.hours}</p>
                                </div>
                                {branch.google_maps_url && (
                                  <a
                                    href={branch.google_maps_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-xs text-cmyk-cyan hover:underline mt-2 inline-flex items-center gap-1"
                                  >
                                    📍 Ver en Google Maps →
                                  </a>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-FORM: Digital — confirmation */}
                {deliveryMethod === 'digital' && (
                  <div className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <span className="text-lg sm:text-xl">💻</span>
                    <div>
                      <p className="text-sm text-emerald-400 font-medium">Entrega digital</p>
                      <p className="text-xs sm:text-sm text-gray-400 mt-1">
                        Los archivos finales se enviarán al correo electrónico que proporcionaste en los datos de contacto.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ──── Files & Comments (inside service box) ──── */}
          {/* Hide for route-based pub-movil subtypes (each route has its own comments/files) */}
          {servicioValue && !(servicioValue === 'publicidad-movil' && ['vallas-moviles', 'publibuses', 'perifoneo'].includes(pubSubtipo || '')) && (
            <div className="space-y-5 pt-4 border-t border-neutral-700/50">
              {/* File upload */}
              <div>
                <label className="label-field">
                  Agregar archivos
                  {servicioValue === 'publicidad-movil' && pubSubtipo === 'perifoneo' && pubRequiereGrabacion === 'no' && <span className="text-cmyk-magenta"> *</span>}
                </label>
                {servicioValue === 'publicidad-movil' && pubSubtipo === 'perifoneo' && pubRequiereGrabacion === 'no' && selectedFiles.length === 0 && (
                  <p className="text-xs text-amber-400/90 mb-2 flex items-start gap-1">
                    <span className="mt-0.5">⚠️</span>
                    <span>Debes adjuntar el archivo de grabación.</span>
                  </p>
                )}
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                    isDragging ? 'border-cmyk-magenta bg-cmyk-magenta/10' : 'border-gray-600 hover:border-cmyk-magenta hover:bg-cmyk-magenta/5'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(e.dataTransfer.files); }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files)}
                    disabled={formStatus === 'submitting'}
                    accept=".pdf,.jpg,.jpeg,.png,.ai,.cdr,.dxf,.svg,.mp3,.wav,.ogg,.m4a"
                  />
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <p className="text-white font-medium text-sm">{t('dragOrClick')}</p>
                  <p className="text-gray-400 text-xs mt-1">PDF, JPG, PNG, AI, CDR, DXF, SVG, MP3, WAV (max 10MB por archivo)</p>
                  {servicioValue === 'diseno-grafico' && (
                    <p className="text-xs text-cmyk-cyan mt-2 flex items-start gap-1 justify-center">
                      <span className="mt-0.5">💡</span>
                      <span>Adjunta toda la información visual posible: logotipos, imágenes de referencia, paleta de colores, bocetos, etc.</span>
                    </p>
                  )}
                </div>

                {/* File list */}
                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-neutral-800 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-cmyk-cyan flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                          </svg>
                          <span className="text-sm text-white truncate">{file.name}</span>
                          <span className="text-xs text-gray-400">({(file.size / 1024 / 1024).toFixed(2)}MB)</span>
                        </div>
                        <button type="button" onClick={() => removeFile(index)} className="text-red-400 hover:text-red-300 p-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <label htmlFor="comentarios" className="label-field">
                  {t('comments')}
                  {(servicioValue === 'diseno-grafico' || (servicioValue === 'publicidad-movil' && pubSubtipo === 'perifoneo' && pubRequiereGrabacion === 'si')) && <span className="text-cmyk-magenta"> *</span>}
                </label>
                <textarea
                  {...register('comentarios', {
                    required: servicioValue === 'diseno-grafico'
                      ? 'Los comentarios son obligatorios para Diseño Gráfico. Describe qué necesitas para tu diseño.'
                      : (servicioValue === 'publicidad-movil' && pubSubtipo === 'perifoneo' && pubRequiereGrabacion === 'si')
                        ? 'Los comentarios son obligatorios. Especifica qué quieres que diga la grabación y la duración deseada.'
                        : false,
                    maxLength: { value: 2000, message: 'Máximo 2000 caracteres' }
                  })}
                  id="comentarios"
                  rows={3}
                  className="input-field resize-none"
                  placeholder={servicioValue === 'diseno-grafico'
                    ? 'Describe detalladamente qué necesitas: concepto, colores, estilo, texto, público objetivo, referencias, etc.'
                    : (servicioValue === 'publicidad-movil' && pubSubtipo === 'perifoneo' && pubRequiereGrabacion === 'si')
                      ? 'Especifica: ¿Qué quieres que diga la grabación? ¿Cuánto debe durar? (ej. 30 segundos, 1 minuto)'
                      : t('commentsPlaceholder')}
                  disabled={formStatus === 'submitting'}
                />
                {errors.comentarios && <p className="error-message">{errors.comentarios.message}</p>}
                {servicioValue === 'diseno-grafico' && (
                  <p className="text-xs text-amber-400/90 mt-1.5 flex items-start gap-1">
                    <span className="mt-0.5">📝</span>
                    <span>Es importante que describas lo que necesitas para tu diseño: concepto, estilo deseado, colores, textos, etc.</span>
                  </p>
                )}
                {servicioValue === 'publicidad-movil' && pubSubtipo === 'perifoneo' && pubRequiereGrabacion === 'si' && (
                  <p className="text-xs text-amber-400/90 mt-1.5 flex items-start gap-1">
                    <span className="mt-0.5">🎙️</span>
                    <span>Especifica el contenido de la grabación (texto o guion) y la duración deseada.</span>
                  </p>
                )}
              </div>
            </div>
          )}

          </div>{/* end service box */}

          {/* ──── "Add another service" prompt ──── */}
          {servicioValue && (
            <div className="text-center py-2">
              <p className="text-sm text-gray-400 mb-3">¿Necesitas cotizar otro servicio en esta misma solicitud?</p>
              <button
                type="button"
                onClick={() => {
                  // Validate only service-specific fields (NOT privacy) and capture
                  const formData = watch() as QuoteFormData;
                  const ok = captureCurrentService(formData);
                  if (ok) {
                    // Scroll to Box 2 so the user sees the new empty service form
                    setTimeout(() => {
                      document.getElementById('box-detalles-servicio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }
                }}
                disabled={formStatus === 'submitting'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-dashed border-cmyk-cyan/40 text-cmyk-cyan hover:bg-cmyk-cyan/10 hover:border-cmyk-cyan/70 transition-all text-sm font-semibold"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar servicio
              </button>
            </div>
          )}

          {/* ──── Privacy + Submit (inside outer container) ──── */}
          <div className="space-y-5 pt-4 border-t border-neutral-700/50">
            {/* Honeypot */}
            <input {...register('website')} type="text" className="hidden" tabIndex={-1} autoComplete="off" />

            {/* Privacy checkbox */}
            <div className="flex items-start">
              <input
                {...register('privacidad', { required: 'Debes aceptar el aviso de privacidad' })}
                type="checkbox"
                id="privacidad"
                className="mt-1 w-4 h-4 text-cmyk-magenta border-cmyk-cyan/30 rounded focus:ring-cmyk-magenta"
                disabled={formStatus === 'submitting'}
              />
              <label htmlFor="privacidad" className="ml-3 text-sm text-gray-300">
                {t('privacy')}{' '}
                <button type="button" onClick={openPrivacy} className="text-cmyk-magenta hover:underline">{t('privacyLink')}</button>
                . <span className="text-cmyk-magenta">*</span>
              </label>
            </div>
            {errors.privacidad && <p className="error-message">{errors.privacidad.message}</p>}

            {/* Submit button */}
            <button type="submit" disabled={formStatus === 'submitting'} className="btn-primary w-full text-lg py-4">
              {formStatus === 'submitting' ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('sending')}
                </span>
              ) : (
                t('submit')
              )}
            </button>
          </div>

          </div>{/* end outer container */}
        </form>
      </div>
    </section>
  );
}
