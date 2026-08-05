import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
const REQUEST_TIMEOUT_MS = 7000;
const MAX_BACKEND_ATTEMPTS = 5;

function getPrimaryApiBase(request: NextRequest): string {
  return `${request.nextUrl.origin.replace(/\/$/, '')}/api/v1`;
}

function normalizeApiBase(input: string): string {
  const value = input.trim().replace(/\/$/, '');
  if (!value) return '';
  if (value.endsWith('/api/v1')) return value;
  return `${value}/api/v1`;
}

function buildBackendCandidates(request: NextRequest): string[] {
  const candidates: string[] = [];

  const backendUrl = process.env.BACKEND_URL;
  const internalApiUrl = process.env.INTERNAL_API_URL;
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (backendUrl) candidates.push(normalizeApiBase(backendUrl));
  if (internalApiUrl) candidates.push(normalizeApiBase(internalApiUrl));
  if (publicApiUrl) candidates.push(normalizeApiBase(publicApiUrl));

  // Stable production fallback (Fly)
  candidates.push('https://mcd-agencia-api.fly.dev/api/v1');
  // Last resort: same-origin /api/v1 rewrite path
  candidates.push(getPrimaryApiBase(request));

  const origin = request.nextUrl.origin.replace(/\/$/, '');
  const seen = new Set<string>();

  const filtered = candidates.filter((candidate) => {
    if (!candidate || seen.has(candidate)) return false;
    // Keep only /api/v1 same-origin target; avoid other same-origin paths.
    if (candidate.startsWith(origin) && candidate !== `${origin}/api/v1`) return false;
    seen.add(candidate);
    return true;
  });

  return filtered.slice(0, MAX_BACKEND_ATTEMPTS);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function submitContactFallback(
  backendCandidates: string[],
  payload: Record<string, unknown>,
): Promise<boolean> {
  const contacto = (payload.contacto as Record<string, unknown> | undefined) || {};
  const fallbackBody = {
    name: String(contacto.nombre || ''),
    email: String(contacto.email || ''),
    phone: String(contacto.telefono || ''),
    company: String(contacto.empresa || ''),
    message: String(payload.comentarios || payload.servicio || 'Solicitud desde formulario de cotización'),
    privacy_accepted: true,
  };

  for (const apiBase of backendCandidates) {
    try {
      const response = await fetchWithTimeout(`${apiBase}/content/contact/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackBody),
      });
      if (response.ok) return true;
    } catch {
      // Continue trying next backend candidate.
    }
  }

  return false;
}

async function submitMinimalQuoteFallback(
  backendCandidates: string[],
  payload: Record<string, unknown>,
): Promise<boolean> {
  const contacto = (payload.contacto as Record<string, unknown> | undefined) || {};
  const serviceType = String(payload.servicio || 'otro');
  const minimalData = new FormData();
  minimalData.append('customer_name', String(contacto.nombre || 'Cliente sin nombre'));
  minimalData.append('customer_email', String(contacto.email || 'sin-correo@placeholder.local'));
  minimalData.append('customer_phone', String(contacto.telefono || ''));
  minimalData.append('customer_company', String(contacto.empresa || ''));
  minimalData.append('service_type', serviceType);
  minimalData.append('description', String(payload.comentarios || `Solicitud generada en modo contingencia para servicio: ${serviceType}`));
  minimalData.append('preferred_language', 'es');

  for (const apiBase of backendCandidates) {
    try {
      const response = await fetchWithTimeout(`${apiBase}/quotes/request/`, {
        method: 'POST',
        body: minimalData,
      });
      if (response.ok) return true;
    } catch {
      // Continue trying next backend candidate.
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payloadStr = formData.get('payload');

    if (!payloadStr || typeof payloadStr !== 'string') {
      return NextResponse.json(
        { error: 'Missing payload' },
        { status: 400 }
      );
    }

    const payload = JSON.parse(payloadStr);

    // Check honeypot
    if (payload.website) {
      // Silently reject spam
      return NextResponse.json({ success: true, request_number: 'SPAM-DETECTED' });
    }

    // Transform landing page payload to quote request format
    const quoteRequestData: Record<string, unknown> = {
      customer_name: payload.contacto.nombre,
      customer_email: payload.contacto.email,
      customer_phone: payload.contacto.telefono,
      customer_company: payload.contacto.empresa,
      service_type: payload.servicio,
      service_details: payload.detalles,
      description: payload.comentarios || `Servicio: ${payload.servicio}`,
      required_date: payload.fecha_requerida,
      // Map service-specific fields
      dimensions: payload.detalles?.medidas,
      material: payload.detalles?.material,
      includes_installation: payload.detalles?.instalacion_incluida,
    };

    // Map delivery method fields
    if (payload.metodo_entrega) {
      quoteRequestData.delivery_method = payload.metodo_entrega;
    }
    if (payload.entrega) {
      if (payload.entrega.direccion) {
        quoteRequestData.delivery_address = payload.entrega.direccion;
      }
      if (payload.entrega.sucursal) {
        quoteRequestData.pickup_branch = payload.entrega.sucursal;
      }
    }

    // Map multi-service data (servicios array from landing form)
    if (payload.servicios && Array.isArray(payload.servicios) && payload.servicios.length > 0) {
      quoteRequestData.services = JSON.stringify(payload.servicios);
    }

    // Create FormData for backend
    const backendFormData = new FormData();

    // Add all quote request fields
    Object.entries(quoteRequestData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'object') {
          backendFormData.append(key, JSON.stringify(value));
        } else {
          backendFormData.append(key, String(value));
        }
      }
    });

    // Forward files to backend
    const fileKeys = Array.from(formData.keys()).filter(key => key.startsWith('archivo_'));
    for (const key of fileKeys) {
      const file = formData.get(key);
      if (file instanceof File) {
        backendFormData.append('attachments', file);
      }
    }

    // Forward file-to-service mapping if present
    const fileServiceMap = formData.get('file_service_map');
    if (fileServiceMap && typeof fileServiceMap === 'string') {
      backendFormData.append('file_service_map', fileServiceMap);
    }

    // Send to Django backend (try multiple configured backends)
    const backendCandidates = buildBackendCandidates(request);
    if (backendCandidates.length === 0) {
      return NextResponse.json(
        { error: 'Configuración de backend faltante en el servidor.' },
        { status: 500 }
      );
    }

    let response: Response | null = null;
    let lastFetchError: unknown = null;

    for (const apiBase of backendCandidates) {
      try {
        const attempt = await fetchWithTimeout(`${apiBase}/quotes/request/`, {
          method: 'POST',
          body: backendFormData,
        });

        if (attempt.status === 404 || attempt.status >= 500) {
          console.error('Backend attempt failed:', apiBase, attempt.status);
          response = attempt;
          continue;
        }

        response = attempt;
        break;
      } catch (fetchError) {
        lastFetchError = fetchError;
        console.error('Backend connection error:', apiBase, fetchError);
      }
    }

    if (!response) {
      console.error('No backend candidate reachable for /quotes/request/', lastFetchError);

      const minimalQuoteSaved = await submitMinimalQuoteFallback(backendCandidates, payload);
      if (minimalQuoteSaved) {
        return NextResponse.json(
          {
            success: true,
            request_number: 'LEAD-QUOTE-FALLBACK',
            message: 'Recibimos tu solicitud y fue registrada en solicitudes. Nuestro equipo te contactará en breve.',
          },
          { status: 202 }
        );
      }

      const fallbackSaved = await submitContactFallback(backendCandidates, payload);
      if (fallbackSaved) {
        return NextResponse.json(
          {
            error: 'Tu solicitud se guardó como contacto, pero no pudo registrarse en Solicitudes. Intenta de nuevo en unos minutos.',
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo conectar con el servidor. Inténtalo de nuevo en unos minutos.' },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      let errorData: Record<string, unknown> = {};
      try {
        errorData = JSON.parse(responseText);
      } catch {
        console.error('Backend non-JSON error:', response.status, responseText.substring(0, 500));
        return NextResponse.json(
          { error: `Error del servidor (${response.status}). Inténtalo de nuevo más tarde.` },
          { status: response.status }
        );
      }
      console.error('Backend error:', response.status, errorData);

      // Backend uses a custom envelope: { success: false, error: { code, message, details } }
      let errorMessage = 'Error al procesar la solicitud';
      const envelope = errorData?.error as Record<string, unknown> | undefined;

      if (typeof envelope === 'object' && envelope !== null && 'message' in envelope) {
        // Custom envelope format
        errorMessage = String(envelope.message || 'Error de validación');
        const details = envelope.details as Record<string, unknown> | undefined;
        if (details && typeof details === 'object') {
          const fieldErrors = Object.entries(details)
            .map(([field, msgs]) => {
              const messages = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
              return `${field}: ${messages}`;
            })
            .join('; ');
          if (fieldErrors) {
            errorMessage += ` (${fieldErrors})`;
          }
        }
      } else if (typeof errorData?.error === 'string') {
        errorMessage = errorData.error;
      } else if (errorData.detail) {
        errorMessage = String(errorData.detail);
      } else if (typeof errorData === 'object' && Object.keys(errorData).length > 0) {
        // Fallback: raw DRF field errors { field: [errors] }
        const fieldErrors = Object.entries(errorData)
          .filter(([key]) => key !== 'success')  // skip envelope keys
          .map(([field, msgs]) => {
            const messages = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
            return `${field}: ${messages}`;
          })
          .join('; ');
        errorMessage = fieldErrors || errorMessage;
      }

      if (response.status >= 500) {
        const minimalQuoteSaved = await submitMinimalQuoteFallback(backendCandidates, payload);
        if (minimalQuoteSaved) {
          return NextResponse.json(
            {
              success: true,
              request_number: 'LEAD-QUOTE-FALLBACK',
              message: 'Recibimos tu solicitud y fue registrada en solicitudes. Nuestro equipo te contactará en breve.',
            },
            { status: 202 }
          );
        }

        const fallbackSaved = await submitContactFallback(backendCandidates, payload);
        if (fallbackSaved) {
          return NextResponse.json(
            {
              error: 'Tu solicitud se guardó como contacto, pero no pudo registrarse en Solicitudes. Intenta de nuevo en unos minutos.',
            },
            { status: 503 }
          );
        }
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      request_number: result.request_number,
      message: result.message,
    });

  } catch (error) {
    console.error('API leads error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { error: `Error interno: ${message}` },
      { status: 500 }
    );
  }
}
