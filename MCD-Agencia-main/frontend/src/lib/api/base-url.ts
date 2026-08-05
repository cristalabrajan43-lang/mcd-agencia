/**
 * Resolve API base URL in a deployment-safe way.
 *
 * Browser: uses NEXT_PUBLIC_API_URL when set (direct to Django in local Docker).
 * Server/SSR: prefers BACKEND_INTERNAL_URL for container networking.
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (envUrl) {
      return envUrl.replace(/\/$/, '');
    }
    return `${window.location.origin}/api/v1`;
  }

  const internalUrl = process.env.BACKEND_INTERNAL_URL?.trim();
  if (internalUrl) {
    return internalUrl.replace(/\/$/, '');
  }

  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  return 'http://localhost:8000/api/v1';
}

export function getBackendOrigin(): string {
  const publicUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicUrl) {
    try {
      return new URL(publicUrl).origin;
    } catch {
      // fall through
    }
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}`;
  }

  const internalUrl = process.env.BACKEND_INTERNAL_URL?.trim();
  if (internalUrl) {
    try {
      return new URL(internalUrl).origin;
    } catch {
      // fall through
    }
  }

  return 'http://localhost:8000';
}
