import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/postal-code/[cp]
 *
 * Proxy to Zippopotam.us API to look up Mexican postal code data.
 * Returns state, municipality (derived), and neighborhoods (colonias).
 *
 * Response shape:
 * {
 *   codigo_postal: string;
 *   estado: string;
 *   municipio: string;
 *   colonias: string[];
 * }
 */

interface ZippopotamPlace {
  'place name': string;
  longitude: string;
  latitude: string;
  state: string;
  'state abbreviation': string;
}

interface ZippopotamResponse {
  country: string;
  'country abbreviation': string;
  'post code': string;
  places: ZippopotamPlace[];
}

// Map of known CP ranges to municipalities for Guerrero state
// This helps derive the municipality when Zippopotam doesn't provide it
const GUERRERO_CP_MUNICIPIO: Record<string, string> = {
  '39': 'Acapulco de Juárez',
  '413': 'Tecoanapa',
  '396': 'Acapulco de Juárez',
  '395': 'Acapulco de Juárez',
  '394': 'Acapulco de Juárez',
  '393': 'Acapulco de Juárez',
  '398': 'Acapulco de Juárez',
  '397': 'Acapulco de Juárez',
};

function deriveMunicipio(cp: string, places: ZippopotamPlace[]): string {
  // Try to find a place ending in "Centro" which usually = municipality name
  const centroPlace = places.find(p =>
    p['place name'].toLowerCase().endsWith('centro')
  );
  if (centroPlace) {
    // "Tecoanapa Centro" → "Tecoanapa", "Acapulco de Juárez Centro" → "Acapulco de Juárez"
    const name = centroPlace['place name'].replace(/\s+Centro$/i, '').trim();
    if (name) return name;
  }

  // Try known CP prefixes
  for (const [prefix, municipio] of Object.entries(GUERRERO_CP_MUNICIPIO)) {
    if (cp.startsWith(prefix)) return municipio;
  }

  // Fallback: use the state name or empty
  return '';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { cp: string } }
) {
  const { cp } = params;

  // Validate: must be exactly 5 digits
  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json(
      { error: 'El código postal debe tener 5 dígitos' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://api.zippopotam.us/mx/${cp}`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 86400 }, // Cache for 24h
      }
    );

    if (response.status === 404) {
      return NextResponse.json(
        { error: 'Código postal no encontrado' },
        { status: 404 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Error al consultar el servicio postal' },
        { status: 502 }
      );
    }

    const data: ZippopotamResponse = await response.json();

    const colonias = data.places
      .map(p => p['place name'])
      .sort((a, b) => a.localeCompare(b, 'es'));

    const estado = data.places[0]?.state || '';
    const municipio = deriveMunicipio(cp, data.places);

    return NextResponse.json({
      codigo_postal: cp,
      estado,
      municipio,
      colonias,
    });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo conectar con el servicio postal' },
      { status: 503 }
    );
  }
}
