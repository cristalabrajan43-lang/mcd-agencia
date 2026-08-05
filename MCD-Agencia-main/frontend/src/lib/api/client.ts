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

/**
 * Get stored access token.
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

/**
 * Get stored refresh token.
 */
function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

/**
 * Store tokens in localStorage.
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

/**
 * Clear stored tokens.
 */
export function clearTokens(reason: 'manual' | 'expired' | 'unauthorized' = 'manual'): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');

  window.dispatchEvent(
    new CustomEvent('auth:tokens-cleared', {
      detail: { reason },
    })
  );
}

/**
 * Refresh access token using refresh token.
 */
async function refreshAccessToken(): Promise<string | null> {
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
      clearTokens('expired');
      return null;
    }

    const data = await response.json();
    localStorage.setItem('accessToken', data.access);
    return data.access;
  } catch {
    clearTokens('expired');
    return null;
  }
}

/**
 * Build URL with query parameters.
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const apiBaseUrl = getApiBaseUrl();
  const url = new URL(endpoint.startsWith('http') ? endpoint : `${apiBaseUrl}${endpoint}`);

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

  // If 401, try to refresh token and retry
  if (response.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();

    if (newToken) {
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

    const error: ApiError = {
      message:
        (envelope?.message as string) ||
        (errorData?.detail as string) ||
        (errorData?.message as string) ||
        'Error en el servidor',
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
