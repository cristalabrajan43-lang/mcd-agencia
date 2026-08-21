/**
 * Resolve media and API URLs for browser/server contexts.
 */

import { getBackendOrigin } from '@/lib/api/base-url';

export const PRODUCT_PLACEHOLDER = '/placeholder-product.svg';

const FALLBACK_CAROUSEL_IMAGES = [
  'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=1920&q=80',
  'https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=1920&q=80',
  'https://images.unsplash.com/photo-1557825835-70d97c4aa567?w=1920&q=80',
];

/** Hosts that the Next.js image optimizer cannot reach from Docker. */
const INTERNAL_MEDIA_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'backend',
  'host.docker.internal',
]);

export function getFallbackCarouselImages(): string[] {
  return FALLBACK_CAROUSEL_IMAGES;
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return PRODUCT_PLACEHOLDER;

  const trimmed = url.trim();
  if (!trimmed) return PRODUCT_PLACEHOLDER;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith('/media/') && INTERNAL_MEDIA_HOSTS.has(parsed.hostname)) {
        // Django returns http://localhost:8000/media/... next/image then fetches
        // that URL from inside the frontend container (ECONNREFUSED ::1:8000).
        // Same-origin /media/* is rewritten to the backend.
        return trimmed.slice(parsed.origin.length) || parsed.pathname;
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }

  if (trimmed.startsWith('/media/')) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return `${getBackendOrigin()}/${trimmed.replace(/^\/+/, '')}`;
}

export function resolveProductImageUrl(
  primaryImage?: { image?: string | null } | null,
  fallback: string = PRODUCT_PLACEHOLDER
): string {
  const raw = primaryImage?.image;
  if (!raw) return fallback;
  return resolveMediaUrl(raw);
}
