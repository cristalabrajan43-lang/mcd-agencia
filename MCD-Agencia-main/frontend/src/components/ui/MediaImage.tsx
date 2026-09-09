'use client';

import { resolveMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

interface MediaImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fill?: boolean;
}

/**
 * Product/media photos must not go through next/image in Docker:
 * the optimizer fetches http://localhost:8000 from inside the frontend
 * container and gets ECONNREFUSED. A normal img is loaded by the browser.
 */
export function MediaImage({ src, alt, className, fill = false }: MediaImageProps) {
  return (
    <img
      src={resolveMediaUrl(src)}
      alt={alt}
      className={cn(fill && 'absolute inset-0 h-full w-full', className)}
    />
  );
}
