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

export function getFallbackCarouselImages(): string[] {
  return FALLBACK_CAROUSEL_IMAGES;
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return PRODUCT_PLACEHOLDER;

  const trimmed = url.trim();
  if (!trimmed) return PRODUCT_PLACEHOLDER;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('/media/')) {
    if (typeof window !== 'undefined') {
      return trimmed;
    }
    return `${getBackendOrigin()}${trimmed}`;
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
