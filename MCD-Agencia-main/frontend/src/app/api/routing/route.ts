import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const originLon = searchParams.get('originLon');
  const originLat = searchParams.get('originLat');
  const destLon = searchParams.get('destLon');
  const destLat = searchParams.get('destLat');

  if (!originLon || !originLat || !destLon || !destLat) {
    return NextResponse.json(
      { error: 'Missing coordinates' },
      { status: 400 }
    );
  }

  // OSRM public demo server
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MCD-Agencia/1.0',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('OSRM API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `OSRM API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Routing API error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch routing data' },
      { status: 500 }
    );
  }
}
