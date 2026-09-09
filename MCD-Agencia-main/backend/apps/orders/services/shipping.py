"""Shipping rates from Acapulco, Guerrero to the rest of Mexico."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
import re
import unicodedata


def _normalize(value: str) -> str:
    text = unicodedata.normalize('NFD', value or '')
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


# Official state keys after accent stripping.
STATE_SHIPPING_RATES = {
    'aguascalientes': Decimal('289.00'),
    'baja california': Decimal('499.00'),
    'baja california sur': Decimal('529.00'),
    'campeche': Decimal('369.00'),
    'chiapas': Decimal('329.00'),
    'chihuahua': Decimal('449.00'),
    'ciudad de mexico': Decimal('199.00'),
    'coahuila': Decimal('389.00'),
    'colima': Decimal('229.00'),
    'durango': Decimal('349.00'),
    'estado de mexico': Decimal('199.00'),
    'guanajuato': Decimal('269.00'),
    'guerrero': Decimal('99.00'),
    'hidalgo': Decimal('219.00'),
    'jalisco': Decimal('269.00'),
    'michoacan': Decimal('199.00'),
    'morelos': Decimal('169.00'),
    'nayarit': Decimal('289.00'),
    'nuevo leon': Decimal('379.00'),
    'oaxaca': Decimal('149.00'),
    'puebla': Decimal('189.00'),
    'queretaro': Decimal('249.00'),
    'quintana roo': Decimal('429.00'),
    'san luis potosi': Decimal('299.00'),
    'sinaloa': Decimal('399.00'),
    'sonora': Decimal('459.00'),
    'tabasco': Decimal('319.00'),
    'tamaulipas': Decimal('359.00'),
    'tlaxcala': Decimal('209.00'),
    'veracruz': Decimal('219.00'),
    'yucatan': Decimal('419.00'),
    'zacatecas': Decimal('319.00'),
}

STATE_LABELS = {
    'aguascalientes': 'Aguascalientes',
    'baja california': 'Baja California',
    'baja california sur': 'Baja California Sur',
    'campeche': 'Campeche',
    'chiapas': 'Chiapas',
    'chihuahua': 'Chihuahua',
    'ciudad de mexico': 'Ciudad de México',
    'coahuila': 'Coahuila',
    'colima': 'Colima',
    'durango': 'Durango',
    'estado de mexico': 'Estado de México',
    'guanajuato': 'Guanajuato',
    'guerrero': 'Guerrero',
    'hidalgo': 'Hidalgo',
    'jalisco': 'Jalisco',
    'michoacan': 'Michoacán',
    'morelos': 'Morelos',
    'nayarit': 'Nayarit',
    'nuevo leon': 'Nuevo León',
    'oaxaca': 'Oaxaca',
    'puebla': 'Puebla',
    'queretaro': 'Querétaro',
    'quintana roo': 'Quintana Roo',
    'san luis potosi': 'San Luis Potosí',
    'sinaloa': 'Sinaloa',
    'sonora': 'Sonora',
    'tabasco': 'Tabasco',
    'tamaulipas': 'Tamaulipas',
    'tlaxcala': 'Tlaxcala',
    'veracruz': 'Veracruz',
    'yucatan': 'Yucatán',
    'zacatecas': 'Zacatecas',
}

STATE_ALIASES = {
    'ags': 'aguascalientes',
    'bc': 'baja california',
    'bcs': 'baja california sur',
    'camp': 'campeche',
    'chis': 'chiapas',
    'chih': 'chihuahua',
    'cdmx': 'ciudad de mexico',
    'df': 'ciudad de mexico',
    'd f': 'ciudad de mexico',
    'distrito federal': 'ciudad de mexico',
    'ciudad mexico': 'ciudad de mexico',
    'mexico city': 'ciudad de mexico',
    'coah': 'coahuila',
    'coahuila de zaragoza': 'coahuila',
    'col': 'colima',
    'dgo': 'durango',
    'edomex': 'estado de mexico',
    'edo de mexico': 'estado de mexico',
    'edo mexico': 'estado de mexico',
    'estado mexico': 'estado de mexico',
    'mex': 'estado de mexico',
    'mexico': 'estado de mexico',
    'gto': 'guanajuato',
    'gro': 'guerrero',
    'hgo': 'hidalgo',
    'jal': 'jalisco',
    'mich': 'michoacan',
    'mor': 'morelos',
    'nay': 'nayarit',
    'nl': 'nuevo leon',
    'n l': 'nuevo leon',
    'oax': 'oaxaca',
    'pue': 'puebla',
    'qro': 'queretaro',
    'q roo': 'quintana roo',
    'qroo': 'quintana roo',
    'qr': 'quintana roo',
    'slp': 'san luis potosi',
    'sin': 'sinaloa',
    'son': 'sonora',
    'tab': 'tabasco',
    'tamps': 'tamaulipas',
    'tam': 'tamaulipas',
    'tlax': 'tlaxcala',
    'ver': 'veracruz',
    'veracruz de ignacio de la llave': 'veracruz',
    'yuc': 'yucatan',
    'zac': 'zacatecas',
}

# Sepomex ranges used by Acapulco de Juárez.
ACAPULCO_POSTAL_PREFIXES = {'393', '394', '395', '396', '397', '398', '399'}
DEFAULT_NATIONAL_RATE = Decimal('299.00')


@dataclass(frozen=True)
class ShippingQuote:
    fee: Decimal
    is_free: bool
    is_acapulco: bool
    state_key: str
    state_label: str
    zone_key: str
    label: str

    def to_dict(self) -> dict:
        return {
            'fee': str(self.fee),
            'is_free': self.is_free,
            'is_acapulco': self.is_acapulco,
            'state_key': self.state_key,
            'state_label': self.state_label,
            'zone_key': self.zone_key,
            'label': self.label,
        }


def resolve_state_key(state: str) -> str:
    normalized = _normalize(state)
    if not normalized:
        return ''
    if normalized in STATE_SHIPPING_RATES:
        return normalized
    if normalized in STATE_ALIASES:
        return STATE_ALIASES[normalized]
    for key, label in STATE_LABELS.items():
        if _normalize(label) == normalized:
            return key
    return ''


def is_acapulco_destination(city: str = '', state: str = '', postal_code: str = '') -> bool:
    city_name = _normalize(city)
    if city_name:
        return 'acapulco' in city_name

    digits = re.sub(r'\D', '', postal_code or '')
    if len(digits) >= 5 and digits[:3] in ACAPULCO_POSTAL_PREFIXES:
        state_key = resolve_state_key(state)
        if not state_key or state_key == 'guerrero':
            return True
    return False


def calculate_shipping_quote(
    city: str = '',
    state: str = '',
    postal_code: str = '',
) -> ShippingQuote:
    """Return the shipping fee from Acapulco to a Mexican destination."""
    if is_acapulco_destination(city=city, state=state, postal_code=postal_code):
        return ShippingQuote(
            fee=Decimal('0.00'),
            is_free=True,
            is_acapulco=True,
            state_key='guerrero',
            state_label='Guerrero',
            zone_key='acapulco',
            label='Envío gratis a Acapulco',
        )

    state_key = resolve_state_key(state)
    if state_key:
        fee = STATE_SHIPPING_RATES[state_key]
        state_label = STATE_LABELS[state_key]
        return ShippingQuote(
            fee=fee,
            is_free=False,
            is_acapulco=False,
            state_key=state_key,
            state_label=state_label,
            zone_key=state_key,
            label=f'Envío a {state_label}: ${fee:,.2f}',
        )

    return ShippingQuote(
        fee=DEFAULT_NATIONAL_RATE,
        is_free=False,
        is_acapulco=False,
        state_key='',
        state_label='',
        zone_key='nacional',
        label=f'Envío nacional: ${DEFAULT_NATIONAL_RATE:,.2f}',
    )
