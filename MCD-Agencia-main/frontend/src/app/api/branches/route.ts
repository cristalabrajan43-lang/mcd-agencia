import { NextRequest, NextResponse } from 'next/server';

type BranchListResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: unknown[];
};

const FLY_BRANCH_ENDPOINT = 'https://mcd-agencia-api.fly.dev/api/v1/content/branches/';

const hasYamaha = (payload: BranchListResponse | unknown[]): boolean => {
  const results = Array.isArray(payload) ? payload : payload.results || [];
  return results.some((branch) => {
    const row = branch as Record<string, unknown>;
    const name = String(row.name || '').toLowerCase();
    const street = String(row.street || '').toLowerCase();
    const fullAddress = String(row.full_address || '').toLowerCase();
    return name.includes('yamaha') || street.includes('yamaha') || fullAddress.includes('yamaha') || fullAddress.includes('costa azul');
  });
};

const toEndpoint = (base: string, pageSize: number): string => {
  const normalized = base.replace(/\/$/, '');
  return `${normalized}/content/branches/?page_size=${pageSize}`;
};

const fetchCandidate = async (url: string): Promise<BranchListResponse | unknown[] | null> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) return null;

  try {
    return (await response.json()) as BranchListResponse | unknown[];
  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  const pageSizeRaw = Number(request.nextUrl.searchParams.get('page_size') || '100');
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 100;

  const preferFly = request.nextUrl.searchParams.get('preferFly') === '1';
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const internalApiUrl = process.env.INTERNAL_API_URL?.trim();

  const candidates: string[] = [];

  if (preferFly) {
    candidates.push(`${FLY_BRANCH_ENDPOINT}?page_size=${pageSize}`);
  }

  if (internalApiUrl) {
    candidates.push(toEndpoint(internalApiUrl, pageSize));
  }

  if (publicApiUrl) {
    candidates.push(toEndpoint(publicApiUrl, pageSize));
  }

  if (!preferFly) {
    candidates.push(`${FLY_BRANCH_ENDPOINT}?page_size=${pageSize}`);
  }

  const uniqueCandidates = Array.from(new Set(candidates));

  let bestPayload: BranchListResponse | unknown[] | null = null;

  for (const candidate of uniqueCandidates) {
    const payload = await fetchCandidate(candidate);
    if (!payload) continue;

    if (!bestPayload) bestPayload = payload;
    if (hasYamaha(payload)) {
      return NextResponse.json(payload, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      });
    }
  }

  if (bestPayload) {
    return NextResponse.json(bestPayload, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  }

  return NextResponse.json(
    { detail: 'No branch source available' },
    {
      status: 502,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    }
  );
}
