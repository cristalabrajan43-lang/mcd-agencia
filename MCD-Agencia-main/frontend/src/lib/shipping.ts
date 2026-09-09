/**
 * Shipping rates from Acapulco, Guerrero to the rest of Mexico.
 * Keep in sync with backend/apps/orders/services/shipping.py
 */

export const MEXICO_STATE_OPTIONS = [
  { value: 'Aguascalientes', label: 'Aguascalientes' },
  { value: 'Baja California', label: 'Baja California' },
  { value: 'Baja California Sur', label: 'Baja California Sur' },
  { value: 'Campeche', label: 'Campeche' },
  { value: 'Chiapas', label: 'Chiapas' },
  { value: 'Chihuahua', label: 'Chihuahua' },
  { value: 'Ciudad de México', label: 'Ciudad de México' },
  { value: 'Coahuila', label: 'Coahuila' },
  { value: 'Colima', label: 'Colima' },
  { value: 'Durango', label: 'Durango' },
  { value: 'Estado de México', label: 'Estado de México' },
  { value: 'Guanajuato', label: 'Guanajuato' },
  { value: 'Guerrero', label: 'Guerrero' },
  { value: 'Hidalgo', label: 'Hidalgo' },
  { value: 'Jalisco', label: 'Jalisco' },
  { value: 'Michoacán', label: 'Michoacán' },
  { value: 'Morelos', label: 'Morelos' },
  { value: 'Nayarit', label: 'Nayarit' },
  { value: 'Nuevo León', label: 'Nuevo León' },
  { value: 'Oaxaca', label: 'Oaxaca' },
  { value: 'Puebla', label: 'Puebla' },
  { value: 'Querétaro', label: 'Querétaro' },
  { value: 'Quintana Roo', label: 'Quintana Roo' },
  { value: 'San Luis Potosí', label: 'San Luis Potosí' },
  { value: 'Sinaloa', label: 'Sinaloa' },
  { value: 'Sonora', label: 'Sonora' },
  { value: 'Tabasco', label: 'Tabasco' },
  { value: 'Tamaulipas', label: 'Tamaulipas' },
  { value: 'Tlaxcala', label: 'Tlaxcala' },
  { value: 'Veracruz', label: 'Veracruz' },
  { value: 'Yucatán', label: 'Yucatán' },
  { value: 'Zacatecas', label: 'Zacatecas' },
] as const;

const STATE_SHIPPING_RATES: Record<string, number> = {
  aguascalientes: 289,
  'baja california': 499,
  'baja california sur': 529,
  campeche: 369,
  chiapas: 329,
  chihuahua: 449,
  'ciudad de mexico': 199,
  coahuila: 389,
  colima: 229,
  durango: 349,
  'estado de mexico': 199,
  guanajuato: 269,
  guerrero: 99,
  hidalgo: 219,
  jalisco: 269,
  michoacan: 199,
  morelos: 169,
  nayarit: 289,
  'nuevo leon': 379,
  oaxaca: 149,
  puebla: 189,
  queretaro: 249,
  'quintana roo': 429,
  'san luis potosi': 299,
  sinaloa: 399,
  sonora: 459,
  tabasco: 319,
  tamaulipas: 359,
  tlaxcala: 209,
  veracruz: 219,
  yucatan: 419,
  zacatecas: 319,
};

const STATE_LABELS: Record<string, string> = {
  aguascalientes: 'Aguascalientes',
  'baja california': 'Baja California',
  'baja california sur': 'Baja California Sur',
  campeche: 'Campeche',
  chiapas: 'Chiapas',
  chihuahua: 'Chihuahua',
  'ciudad de mexico': 'Ciudad de México',
  coahuila: 'Coahuila',
  colima: 'Colima',
  durango: 'Durango',
  'estado de mexico': 'Estado de México',
  guanajuato: 'Guanajuato',
  guerrero: 'Guerrero',
  hidalgo: 'Hidalgo',
  jalisco: 'Jalisco',
  michoacan: 'Michoacán',
  morelos: 'Morelos',
  nayarit: 'Nayarit',
  'nuevo leon': 'Nuevo León',
  oaxaca: 'Oaxaca',
  puebla: 'Puebla',
  queretaro: 'Querétaro',
  'quintana roo': 'Quintana Roo',
  'san luis potosi': 'San Luis Potosí',
  sinaloa: 'Sinaloa',
  sonora: 'Sonora',
  tabasco: 'Tabasco',
  tamaulipas: 'Tamaulipas',
  tlaxcala: 'Tlaxcala',
  veracruz: 'Veracruz',
  yucatan: 'Yucatán',
  zacatecas: 'Zacatecas',
};

const STATE_ALIASES: Record<string, string> = {
  ags: 'aguascalientes',
  bc: 'baja california',
  bcs: 'baja california sur',
  camp: 'campeche',
  chis: 'chiapas',
  chih: 'chihuahua',
  cdmx: 'ciudad de mexico',
  df: 'ciudad de mexico',
  'd f': 'ciudad de mexico',
  'distrito federal': 'ciudad de mexico',
  'ciudad mexico': 'ciudad de mexico',
  'mexico city': 'ciudad de mexico',
  coah: 'coahuila',
  'coahuila de zaragoza': 'coahuila',
  col: 'colima',
  dgo: 'durango',
  edomex: 'estado de mexico',
  'edo de mexico': 'estado de mexico',
  'edo mexico': 'estado de mexico',
  'estado mexico': 'estado de mexico',
  mex: 'estado de mexico',
  mexico: 'estado de mexico',
  gto: 'guanajuato',
  gro: 'guerrero',
  hgo: 'hidalgo',
  jal: 'jalisco',
  mich: 'michoacan',
  mor: 'morelos',
  nay: 'nayarit',
  nl: 'nuevo leon',
  'n l': 'nuevo leon',
  oax: 'oaxaca',
  pue: 'puebla',
  qro: 'queretaro',
  'q roo': 'quintana roo',
  qroo: 'quintana roo',
  qr: 'quintana roo',
  slp: 'san luis potosi',
  sin: 'sinaloa',
  son: 'sonora',
  tab: 'tabasco',
  tamps: 'tamaulipas',
  tam: 'tamaulipas',
  tlax: 'tlaxcala',
  ver: 'veracruz',
  'veracruz de ignacio de la llave': 'veracruz',
  yuc: 'yucatan',
  zac: 'zacatecas',
};

const ACAPULCO_POSTAL_PREFIXES = new Set(['393', '394', '395', '396', '397', '398', '399']);
const DEFAULT_NATIONAL_RATE = 299;

export type ShippingQuote = {
  fee: number;
  isFree: boolean;
  isAcapulco: boolean;
  stateKey: string;
  stateLabel: string;
  zoneKey: string;
  label: string;
};

function normalize(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveStateKey(state: string): string {
  const normalized = normalize(state);
  if (!normalized) return '';
  if (normalized in STATE_SHIPPING_RATES) return normalized;
  if (normalized in STATE_ALIASES) return STATE_ALIASES[normalized];
  for (const [key, label] of Object.entries(STATE_LABELS)) {
    if (normalize(label) === normalized) return key;
  }
  return '';
}

function isAcapulcoDestination(city = '', state = '', postalCode = ''): boolean {
  const cityName = normalize(city);
  if (cityName) {
    return cityName.includes('acapulco');
  }
  const digits = (postalCode || '').replace(/\D/g, '');
  if (digits.length >= 5 && ACAPULCO_POSTAL_PREFIXES.has(digits.slice(0, 3))) {
    const stateKey = resolveStateKey(state);
    return !stateKey || stateKey === 'guerrero';
  }
  return false;
}

export function calculateShippingQuote(input: {
  city?: string;
  state?: string;
  postal_code?: string;
}): ShippingQuote {
  const city = input.city || '';
  const state = input.state || '';
  const postalCode = input.postal_code || '';

  if (isAcapulcoDestination(city, state, postalCode)) {
    return {
      fee: 0,
      isFree: true,
      isAcapulco: true,
      stateKey: 'guerrero',
      stateLabel: 'Guerrero',
      zoneKey: 'acapulco',
      label: 'Envío gratis a Acapulco',
    };
  }

  const stateKey = resolveStateKey(state);
  if (stateKey) {
    const fee = STATE_SHIPPING_RATES[stateKey];
    const stateLabel = STATE_LABELS[stateKey];
    return {
      fee,
      isFree: false,
      isAcapulco: false,
      stateKey,
      stateLabel,
      zoneKey: stateKey,
      label: `Envío a ${stateLabel}`,
    };
  }

  return {
    fee: DEFAULT_NATIONAL_RATE,
    isFree: false,
    isAcapulco: false,
    stateKey: '',
    stateLabel: '',
    zoneKey: 'nacional',
    label: 'Envío nacional',
  };
}
