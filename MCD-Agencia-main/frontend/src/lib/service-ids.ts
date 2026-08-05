// Service IDs for QuoteForm (new structure)
export const SERVICE_IDS = [
  'espectaculares',
  'fabricacion-anuncios',
  'publicidad-movil',
  'impresion-gran-formato',
  'senalizacion',
  'rotulacion-vehicular',
  'corte-grabado-cnc-laser',
  'diseno-grafico',
  'impresion-offset-serigrafia',
  'otros',
] as const;

export type ServiceId = typeof SERVICE_IDS[number];

// Subtypes for Espectaculares
export const ESPECTACULARES_TIPOS = ['unipolar', 'azotea', 'mural', 'otro'] as const;

export type EspectacularesTipo = typeof ESPECTACULARES_TIPOS[number];

// Subtypes for Fabricación de anuncios
export const FABRICACION_ANUNCIOS_TIPOS = [
  'cajas-luz',
  'letras-3d',
  'anuncios-2d',
  'bastidores',
  'toldos',
  'neon',
  'otro',
] as const;

export type FabricacionAnunciosTipo = typeof FABRICACION_ANUNCIOS_TIPOS[number];

// Subtypes for Publicidad móvil
export const PUBLICIDAD_MOVIL_SUBTIPOS = ['vallas-moviles', 'publibuses', 'perifoneo', 'otro'] as const;

export type PublicidadMovilSubtipo = typeof PUBLICIDAD_MOVIL_SUBTIPOS[number];

// Materials for Gran formato
export const GRAN_FORMATO_MATERIALES = ['lona', 'vinil', 'tela', 'otro'] as const;

export type GranFormatoMaterial = typeof GRAN_FORMATO_MATERIALES[number];

// Types for Rotulación vehicular
export const ROTULACION_TIPOS = [
  'completa',
  'parcial',
  'vinil-recortado',
  'impresion-digital',
  'otro',
] as const;

export type RotulacionTipo = typeof ROTULACION_TIPOS[number];

// Products for Offset printing
export const OFFSET_PRODUCTOS = [
  'tarjetas-presentacion',
  'volantes',
  'otro',
] as const;

export type OffsetProducto = typeof OFFSET_PRODUCTOS[number];

// Printing types
export const IMPRESION_TIPOS = ['tarjetas-presentacion', 'volantes', 'otro'] as const;

export type ImpresionTipo = typeof IMPRESION_TIPOS[number];

// Signage types
export const SENALIZACION_TIPOS = ['interior', 'exterior', 'vial', 'otro'] as const;

export type SenalizacionTipo = typeof SENALIZACION_TIPOS[number];

// CNC/Laser types
export const CNC_LASER_TIPOS = ['router-cnc', 'corte-laser', 'grabado-laser', 'otro'] as const;

export type CncLaserTipo = typeof CNC_LASER_TIPOS[number];

// Graphic design types
export const DISENO_GRAFICO_TIPOS = ['logotipos', 'papeleria', 'redes-sociales', 'otro'] as const;

export type DisenoGraficoTipo = typeof DISENO_GRAFICO_TIPOS[number];

// Service labels for display
export const SERVICE_LABELS: Record<ServiceId, string> = {
  'espectaculares': 'Espectaculares',
  'fabricacion-anuncios': 'Fabricación de anuncios',
  'publicidad-movil': 'Publicidad móvil',
  'impresion-gran-formato': 'Impresión en gran formato y alta resolución',
  'senalizacion': 'Señalización',
  'rotulacion-vehicular': 'Rotulación vehicular',
  'corte-grabado-cnc-laser': 'Corte y grabado en CNC y láser',
  'diseno-grafico': 'Diseño gráfico',
  'impresion-offset-serigrafia': 'Impresión offset, serigrafía, sublimación',
  'otros': 'Otro servicio',
};

// Services shown on landing page (all 9 real services)
export const LANDING_SERVICE_IDS = [
  'fabricacion-anuncios',
  'espectaculares',
  'publicidad-movil',
  'impresion-gran-formato',
  'senalizacion',
  'rotulacion-vehicular',
  'corte-grabado-cnc-laser',
  'diseno-grafico',
  'impresion-offset-serigrafia',
] as const;

export type LandingServiceId = typeof LANDING_SERVICE_IDS[number];

// All 9 real services (excluding 'otros')
export const REAL_SERVICE_IDS = SERVICE_IDS.filter((id) => id !== 'otros') as unknown as readonly ServiceId[];

// Subcategory type for services
export interface ServiceSubcategory {
  id: string;
  titleKey: string;
  label: string;   // human-readable Spanish label
  href: string;
}

// Carousel images for each landing service
export const SERVICE_CAROUSEL_IMAGES: Record<LandingServiceId, string[]> = {
  'fabricacion-anuncios': [
    '/images/carousel/anuncios-iluminados.jfif',
  ],
  'espectaculares': [],
  'publicidad-movil': [
    '/images/carousel/vallas-moviles.jfif',
  ],
  'impresion-gran-formato': [
    '/images/carousel/vinil-en-vidrio.jfif',
  ],
  'rotulacion-vehicular': [
    '/images/carousel/letras-3d.jfif',
  ],
  'senalizacion': [
    '/images/carousel/anuncios-letras-3d.jfif',
  ],
  'corte-grabado-cnc-laser': [],
  'diseno-grafico': [
    '/images/carousel/letras-neon.jfif',
  ],
  'impresion-offset-serigrafia': [],
};

// Subcategories for each landing service
export const SERVICE_SUBCATEGORIES: Record<LandingServiceId, ServiceSubcategory[]> = {
  'fabricacion-anuncios': [
    { id: 'letras-3d', titleKey: 'letras3d', label: 'Letras 3D', href: '#cotizar?servicio=fabricacion-anuncios&subtipo=letras-3d' },
    { id: 'cajas-luz', titleKey: 'cajasLuz', label: 'Cajas de Luz', href: '#cotizar?servicio=fabricacion-anuncios&subtipo=cajas-luz' },
    { id: 'neon', titleKey: 'neonLed', label: 'Neón / LED', href: '#cotizar?servicio=fabricacion-anuncios&subtipo=neon' },
    { id: 'anuncios-2d', titleKey: 'anuncios2d', label: 'Anuncios 2D', href: '#cotizar?servicio=fabricacion-anuncios&subtipo=anuncios-2d' },
    { id: 'bastidores', titleKey: 'bastidores', label: 'Bastidores', href: '#cotizar?servicio=fabricacion-anuncios&subtipo=bastidores' },
    { id: 'toldos', titleKey: 'toldos', label: 'Toldos', href: '#cotizar?servicio=fabricacion-anuncios&subtipo=toldos' },
    { id: 'otro', titleKey: 'otro', label: 'Otro', href: '#cotizar?servicio=fabricacion-anuncios&subtipo=otro' },
  ],
  'espectaculares': [
    { id: 'unipolar', titleKey: 'unipolar', label: 'Unipolar', href: '#cotizar?servicio=espectaculares&subtipo=unipolar' },
    { id: 'azotea', titleKey: 'azotea', label: 'Azotea', href: '#cotizar?servicio=espectaculares&subtipo=azotea' },
    { id: 'mural', titleKey: 'mural', label: 'Mural', href: '#cotizar?servicio=espectaculares&subtipo=mural' },
    { id: 'otro', titleKey: 'otro', label: 'Otro', href: '#cotizar?servicio=espectaculares&subtipo=otro' },
  ],
  'publicidad-movil': [
    { id: 'vallas-moviles', titleKey: 'vallasMoviles', label: 'Vallas Móviles', href: '#cotizar?servicio=publicidad-movil&subtipo=vallas-moviles' },
    { id: 'publibuses', titleKey: 'publibuses', label: 'Publibuses', href: '#cotizar?servicio=publicidad-movil&subtipo=publibuses' },
    { id: 'perifoneo', titleKey: 'perifoneo', label: 'Perifoneo', href: '#cotizar?servicio=publicidad-movil&subtipo=perifoneo' },
    { id: 'otro', titleKey: 'otro', label: 'Otro', href: '#cotizar?servicio=publicidad-movil&subtipo=otro' },
  ],
  'impresion-gran-formato': [
    { id: 'lona', titleKey: 'lona', label: 'Lona', href: '#cotizar?servicio=impresion-gran-formato&subtipo=lona' },
    { id: 'vinil', titleKey: 'vinil', label: 'Vinil', href: '#cotizar?servicio=impresion-gran-formato&subtipo=vinil' },
    { id: 'tela', titleKey: 'tela', label: 'Tela', href: '#cotizar?servicio=impresion-gran-formato&subtipo=tela' },
    { id: 'otro', titleKey: 'otro', label: 'Otro', href: '#cotizar?servicio=impresion-gran-formato&subtipo=otro' },
  ],
  'rotulacion-vehicular': [
    { id: 'completa', titleKey: 'rotulacionCompleta', label: 'Rotulación Completa', href: '#cotizar?servicio=rotulacion-vehicular&subtipo=completa' },
    { id: 'parcial', titleKey: 'rotulacionParcial', label: 'Rotulación Parcial', href: '#cotizar?servicio=rotulacion-vehicular&subtipo=parcial' },
    { id: 'vinil-recortado', titleKey: 'vinilRecortado', label: 'Vinil Recortado', href: '#cotizar?servicio=rotulacion-vehicular&subtipo=vinil-recortado' },
    { id: 'impresion-digital', titleKey: 'impresionDigital', label: 'Impresión Digital', href: '#cotizar?servicio=rotulacion-vehicular&subtipo=impresion-digital' },
    { id: 'otro', titleKey: 'otro', label: 'Otro', href: '#cotizar?servicio=rotulacion-vehicular&subtipo=otro' },
  ],
  'senalizacion': [
    { id: 'interior', titleKey: 'interior', label: 'Interior', href: '#cotizar?servicio=senalizacion&subtipo=interior' },
    { id: 'exterior', titleKey: 'exterior', label: 'Exterior', href: '#cotizar?servicio=senalizacion&subtipo=exterior' },
    { id: 'vial', titleKey: 'vial', label: 'Vial', href: '#cotizar?servicio=senalizacion&subtipo=vial' },
    { id: 'otro', titleKey: 'otro', label: 'Otro', href: '#cotizar?servicio=senalizacion&subtipo=otro' },
  ],
  'corte-grabado-cnc-laser': [
    { id: 'router-cnc', titleKey: 'routerCnc', label: 'Router CNC', href: '#cotizar?servicio=corte-grabado-cnc-laser&subtipo=router-cnc' },
    { id: 'corte-laser', titleKey: 'corteLaser', label: 'Corte Láser', href: '#cotizar?servicio=corte-grabado-cnc-laser&subtipo=corte-laser' },
    { id: 'grabado-laser', titleKey: 'grabadoLaser', label: 'Grabado Láser', href: '#cotizar?servicio=corte-grabado-cnc-laser&subtipo=grabado-laser' },
    { id: 'otro', titleKey: 'otro', label: 'Otro', href: '#cotizar?servicio=corte-grabado-cnc-laser&subtipo=otro' },
  ],
  'diseno-grafico': [
    { id: 'logotipos', titleKey: 'logotipos', label: 'Logotipos', href: '#cotizar?servicio=diseno-grafico&subtipo=logotipos' },
    { id: 'papeleria', titleKey: 'papeleria', label: 'Papelería', href: '#cotizar?servicio=diseno-grafico&subtipo=papeleria' },
    { id: 'redes-sociales', titleKey: 'redesSociales', label: 'Redes Sociales', href: '#cotizar?servicio=diseno-grafico&subtipo=redes-sociales' },
    { id: 'otro', titleKey: 'otro', label: 'Otro', href: '#cotizar?servicio=diseno-grafico&subtipo=otro' },
  ],
  'impresion-offset-serigrafia': [
    { id: 'tarjetas-presentacion', titleKey: 'tarjetasPresentacion', label: 'Tarjetas de Presentación', href: '#cotizar?servicio=impresion-offset-serigrafia&subtipo=tarjetas-presentacion' },
    { id: 'volantes', titleKey: 'volantes', label: 'Volantes', href: '#cotizar?servicio=impresion-offset-serigrafia&subtipo=volantes' },
    { id: 'otro', titleKey: 'otro', label: 'Otro', href: '#cotizar?servicio=impresion-offset-serigrafia&subtipo=otro' },
  ],
};

// Full subcategories for ALL 9 services (used in CMS admin)
export const ALL_SERVICE_SUBCATEGORIES: Record<string, ServiceSubcategory[]> = SERVICE_SUBCATEGORIES;

// Definitions used to auto-sync services into the backend
export const SERVICE_SYNC_DEFINITIONS: Array<{
  service_key: string;
  name: string;
  name_en: string;
  description: string;
  icon: string;
  position: number;
}> = [
  { service_key: 'espectaculares', name: 'Espectaculares', name_en: 'Billboards', description: 'Anuncios de gran formato en ubicaciones estratégicas.', icon: '🏢', position: 0 },
  { service_key: 'fabricacion-anuncios', name: 'Fabricación de anuncios', name_en: 'Sign Manufacturing', description: 'Fabricación de anuncios luminosos, letras 3D y más.', icon: '💡', position: 1 },
  { service_key: 'publicidad-movil', name: 'Publicidad móvil', name_en: 'Mobile Advertising', description: 'Vallas móviles, publibuses y perifoneo.', icon: '🚚', position: 2 },
  { service_key: 'impresion-gran-formato', name: 'Impresión en gran formato', name_en: 'Large Format Printing', description: 'Impresiones de alta resolución en lona, vinil y tela.', icon: '🖨️', position: 3 },
  { service_key: 'senalizacion', name: 'Señalización', name_en: 'Signage', description: 'Señalización interior, exterior y vial.', icon: '🚧', position: 4 },
  { service_key: 'rotulacion-vehicular', name: 'Rotulación vehicular', name_en: 'Vehicle Wrapping', description: 'Rotulación completa o parcial para vehículos.', icon: '🚗', position: 5 },
  { service_key: 'corte-grabado-cnc-laser', name: 'Corte y grabado CNC / Láser', name_en: 'CNC & Laser Cutting', description: 'Corte y grabado de precisión en diversos materiales.', icon: '⚙️', position: 6 },
  { service_key: 'diseno-grafico', name: 'Diseño gráfico', name_en: 'Graphic Design', description: 'Diseño de logotipos, papelería y material digital.', icon: '🎨', position: 7 },
  { service_key: 'impresion-offset-serigrafia', name: 'Impresión offset / serigrafía', name_en: 'Offset & Screen Printing', description: 'Tarjetas, volantes, serigrafía y sublimación.', icon: '📄', position: 8 },
];

// Service icons for display
export const SERVICE_ICONS: Record<ServiceId, string> = {
  'espectaculares': '🏢',
  'fabricacion-anuncios': '💡',
  'publicidad-movil': '🚚',
  'impresion-gran-formato': '🖨️',
  'senalizacion': '🚧',
  'rotulacion-vehicular': '🚗',
  'corte-grabado-cnc-laser': '⚙️',
  'diseno-grafico': '🎨',
  'impresion-offset-serigrafia': '📄',
  'otros': '📋',
};

// FAQ item keys
export const FAQ_KEYS = [
  'delivery',
  'shipping',
  'formats',
  'samples',
  'design',
  'payment',
  'warranty',
  'hours',
] as const;

export type FAQKey = typeof FAQ_KEYS[number];

// Location IDs
export const LOCATION_IDS = ['acapulco-diamante', 'costa-azul', 'tecoanapa'] as const;
export type LocationId = typeof LOCATION_IDS[number];

// ===========================================
// Delivery Methods Configuration
// ===========================================
export const DELIVERY_METHODS = [
  'installation',
  'pickup',
  'shipping',
  'digital',
  'not_applicable',
] as const;

export type DeliveryMethod = typeof DELIVERY_METHODS[number];

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, { es: string; en: string }> = {
  installation: { es: 'Instalación en sitio', en: 'On-site installation' },
  pickup: { es: 'Recoger en sucursal', en: 'Pickup at branch' },
  shipping: { es: 'Envío / Paquetería', en: 'Shipping' },
  digital: { es: 'Entrega digital', en: 'Digital delivery' },
  not_applicable: { es: 'No aplica', en: 'Not applicable' },
};

export const DELIVERY_METHOD_ICONS: Record<DeliveryMethod, string> = {
  installation: '🔧',
  pickup: '🏬',
  shipping: '📦',
  digital: '💻',
  not_applicable: '➖',
};

/**
 * Available delivery methods per service/subtype.
 * Key format: "service" or "service:subtype" for overrides.
 * The first method in the array is the default.
 */
export const DELIVERY_METHODS_BY_SERVICE: Record<string, DeliveryMethod[]> = {
  // Espectaculares — always installed on-site
  'espectaculares': ['installation'],
  // Fabricación de anuncios — install or pickup or ship
  'fabricacion-anuncios': ['installation', 'pickup', 'shipping'],
  // Publicidad móvil — not applicable (service is the delivery)
  'publicidad-movil': ['not_applicable'],
  // Impresión gran formato — install, pickup or shipping
  'impresion-gran-formato': ['installation', 'pickup', 'shipping'],
  // Señalización — install or pickup or ship
  'senalizacion': ['installation', 'pickup', 'shipping'],
  // Rotulación vehicular — both pickup AND installation on-site
  'rotulacion-vehicular': ['installation', 'pickup'],
  // Corte/Grabado CNC/Láser — install, pickup or shipping
  'corte-grabado-cnc-laser': ['installation', 'pickup', 'shipping'],
  // Diseño gráfico — digital delivery
  'diseno-grafico': ['digital'],
  // Impresión offset/serigrafía — pickup or shipping
  'impresion-offset-serigrafia': ['pickup', 'shipping'],
  // Otros — all methods available
  'otros': ['installation', 'pickup', 'shipping', 'digital', 'not_applicable'],
};

/**
 * Get available delivery methods for a service (and optional subtype).
 * Falls back to service-level config, then to all methods.
 */
export function getDeliveryMethodsForService(
  serviceId: string,
  subtypeId?: string
): DeliveryMethod[] {
  if (subtypeId) {
    const key = `${serviceId}:${subtypeId}`;
    if (DELIVERY_METHODS_BY_SERVICE[key]) {
      return DELIVERY_METHODS_BY_SERVICE[key];
    }
  }
  return DELIVERY_METHODS_BY_SERVICE[serviceId] || DELIVERY_METHODS;
}

export const LOCATION_DATA: Record<LocationId, {
  phone: string;
  phoneDisplay: string;
  phone2?: string;
  phone2Display?: string;
  phone2Label?: string;
  email: string;
  latitude: number;
  longitude: number;
  whatsappUrl: string;
  mapsUrl: string;
}> = {
  'acapulco-diamante': {
    phone: '+52 744 688 7382',
    phoneDisplay: '744 688 7382',
    email: 'ventas@agenciamcd.mx',
    latitude: 16.8001189,
    longitude: -99.8063231,
    whatsappUrl: 'https://wa.me/527446887382',
    mapsUrl: 'https://maps.app.goo.gl/T3pDHZrqm4bVKAJV6',
  },
  'costa-azul': {
    phone: '+52 220 326 9670',
    phoneDisplay: '220 326 9670',
    phone2: '+52 744 443 2745',
    phone2Display: '744 443 2745',
    phone2Label: 'TEL',
    email: 'ventas3@agenciamcd.mx',
    latitude: 16.8512984,
    longitude: -99.8497261,
    whatsappUrl: 'https://wa.me/522203269670',
    mapsUrl: 'https://maps.google.com/?q=16.8512984,-99.8497261',
  },
  'tecoanapa': {
    phone: '+52 745 114 7727',
    phoneDisplay: '745 114 7727',
    email: 'ventas2@agenciamcd.mx',
    latitude: 16.9855387,
    longitude: -99.2569781,
    whatsappUrl: 'https://wa.me/527451147727',
    mapsUrl: 'https://maps.google.com/?q=16.9855387,-99.2569781',
  },
};
