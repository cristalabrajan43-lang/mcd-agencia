/**
 * API Client for MCD-Agencia.
 *
 * This module provides a centralized HTTP client for API calls.
 * Features:
 *   - Automatic token management
 *   - Request/response interceptors
 *   - Error handling
 *   - TypeScript support
 */

import { getApiBaseUrl } from './base-url';

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

interface ApiError {
  message: string;
  status: number;
  data?: Record<string, unknown>;
}

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(key);
    return value && value !== 'undefined' && value !== 'null' ? value : null;
  } catch {
    return null;
  }
}

function getAccessToken(): string | null {
  if (memoryAccessToken) return memoryAccessToken;
  memoryAccessToken = readStorage('accessToken');
  return memoryAccessToken;
}

function getRefreshToken(): string | null {
  if (memoryRefreshToken) return memoryRefreshToken;
  memoryRefreshToken = readStorage('refreshToken');
  return memoryRefreshToken;
}

/**
 * Store tokens in memory and localStorage.
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  memoryAccessToken = accessToken;
  memoryRefreshToken = refreshToken;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  } catch {
    // Private mode can block localStorage; memory tokens still work this session.
  }
}

/**
 * Clear stored tokens.
 */
export function clearTokens(reason: 'manual' | 'expired' | 'unauthorized' = 'manual'): void {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  } catch {
    // ignore
  }

  window.dispatchEvent(
    new CustomEvent('auth:tokens-cleared', {
      detail: { reason },
    })
  );
}

function readTokenPair(data: Record<string, unknown>): { access?: string; refresh?: string } {
  const nested = data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : undefined;
  const access = (data.access || nested?.access) as string | undefined;
  const refresh = (data.refresh || nested?.refresh) as string | undefined;
  return { access, refresh };
}

/**
 * Refresh access token using refresh token.
 *
 * SIMPLE_JWT rotates refresh tokens. Parallel 401s (notifications + banners)
 * used to blacklist the old refresh and then wipe the new access token.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    const apiBaseUrl = getApiBaseUrl();

    try {
      const response = await fetch(`${apiBaseUrl}/auth/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        if (getRefreshToken() === refreshToken) {
          clearTokens('expired');
        }
        return getAccessToken();
      }

      const data = readTokenPair((await response.json()) as Record<string, unknown>);
      if (!data.access) {
        return getAccessToken();
      }
      setTokens(data.access, data.refresh || refreshToken);
      return data.access;
    } catch {
      if (getRefreshToken() === refreshToken) {
        clearTokens('expired');
      }
      return getAccessToken();
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function sessionExpiredMessage(status: number, message: string): string {
  if (status !== 401) return message;
  const lower = message.toLowerCase();
  if (
    message === 'Authentication credentials were not provided.' ||
    lower.includes('not valid') ||
    lower.includes('expired') ||
    lower.includes('token')
  ) {
    return 'Tu sesión expiró. Recarga la página e inicia sesión de nuevo.';
  }
  return message;
}

/**
 * Build URL with query parameters.
 * Ensures trailing slash for Django APPEND_SLASH compatibility (especially POST).
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const apiBaseUrl = getApiBaseUrl();
  const url = new URL(endpoint.startsWith('http') ? endpoint : `${apiBaseUrl}${endpoint}`);

  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Make an API request.
 */
async function request<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const { params, headers, ...restConfig } = config;

  const url = buildUrl(endpoint, params);
  let accessToken = getAccessToken();

  if (!accessToken && getRefreshToken()) {
    accessToken = await refreshAccessToken();
  }

  // Build headers — skip Content-Type for FormData (browser sets it with boundary)
  const isFormData = restConfig.body instanceof FormData;
  const requestHeaders: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
  };

  if (accessToken) {
    (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  // Make request — catch network-level errors (CORS, DNS, offline, etc.)
  let response: Response;
  try {
    response = await fetch(url, {
      ...restConfig,
      headers: requestHeaders,
    });
  } catch (networkError) {
    console.error('[API] Network error:', endpoint, networkError);
    const error: ApiError = {
      message: 'Error de conexión con el servidor. Verifica tu conexión a internet.',
      status: 0,
      data: { detail: String(networkError) },
    };
    throw error;
  }

  // If 401, try to refresh token and retry (even when the first request had no access token)
  if (response.status === 401) {
    const newToken = await refreshAccessToken();

    if (newToken && newToken !== accessToken) {
      (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      try {
        response = await fetch(url, {
          ...restConfig,
          headers: requestHeaders,
        });
      } catch (networkError) {
        console.error('[API] Network error on retry:', endpoint, networkError);
        const error: ApiError = {
          message: 'Error de conexión con el servidor. Verifica tu conexión a internet.',
          status: 0,
          data: { detail: String(networkError) },
        };
        throw error;
      }
    }
  }

  // Handle non-OK responses
  if (!response.ok) {
    let errorData: Record<string, unknown> | undefined;

    try {
      errorData = await response.json();
    } catch {
      // Response body is not JSON
    }

    // Unwrap our custom error envelope: {success, error: {code, message, details}}
    const envelope = errorData?.error as Record<string, unknown> | undefined;
    const fieldErrors = (envelope?.details ?? errorData) as Record<string, unknown> | undefined;
    const rawMessage =
      (envelope?.message as string) ||
      (errorData?.detail as string) ||
      (errorData?.message as string) ||
      'Error en el servidor';

    const error: ApiError = {
      message: sessionExpiredMessage(response.status, rawMessage),
      status: response.status,
      data: fieldErrors,
    };

    throw error;
  }

  // Handle empty responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * API client with HTTP method helpers.
 */
export const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),

  /** POST with FormData (for file uploads). Content-Type set automatically. */
  upload: <T>(endpoint: string, formData: FormData) =>
    request<T>(endpoint, { method: 'POST', body: formData }),

  /** PATCH with FormData (for file uploads). Content-Type set automatically. */
  uploadPatch: <T>(endpoint: string, formData: FormData) =>
    request<T>(endpoint, { method: 'PATCH', body: formData }),
};

export default apiClient;
