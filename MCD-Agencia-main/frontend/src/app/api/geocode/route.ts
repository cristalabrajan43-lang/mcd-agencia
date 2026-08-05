import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'Missing coordinates' },
      { status: 400 }
    );
  }

  // Nominatim reverse geocoding
  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MCD-Agencia/1.0 (contact@agenciamcd.mx)',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Nominatim API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Nominatim API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Build a readable address
    let address = '';
    if (data.address) {
      const parts: string[] = [];

      // Street and number
      if (data.address.road) {
        let street = data.address.road;
        if (data.address.house_number) {
          street = `${street} ${data.address.house_number}`;
        }
        parts.push(street);
      }

      // Neighborhood or suburb
      if (data.address.neighbourhood) {
        parts.push(data.address.neighbourhood);
      } else if (data.address.suburb) {
        parts.push(data.address.suburb);
      } else if (data.address.city_district) {
        parts.push(data.address.city_district);
      } else if (data.address.residential) {
        parts.push(data.address.residential);
      }

      // City
      if (data.address.city) {
        parts.push(data.address.city);
      } else if (data.address.town) {
        parts.push(data.address.town);
      } else if (data.address.village) {
        parts.push(data.address.village);
      } else if (data.address.municipality) {
        parts.push(data.address.municipality);
      }

      if (parts.length > 0) {
        address = parts.slice(0, 3).join(', ');
      }
    }

    // Fallback to display_name
    if (!address && data.display_name) {
      address = data.display_name.split(',').slice(0, 3).join(',').trim();
    }

    return NextResponse.json({
      address: address || null,
      display_name: data.display_name || null,
      raw: data.address || null,
    });

  } catch (error) {
    console.error('Geocode API error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch geocoding data' },
      { status: 500 }
    );
  }
}
