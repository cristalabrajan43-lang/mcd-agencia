'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ServiceCardImageData {
  src: string;
  label?: string;
  labelHref?: string;
}

interface ServiceCardCarouselProps {
  images: string[] | ServiceCardImageData[];
  alt: string;
  autoPlay?: boolean;
  interval?: number;
  /** Show prev/next arrow buttons (useful in modals) */
  showArrows?: boolean;
  /** Use object-contain with dark bg instead of object-cover */
  contain?: boolean;
  /** Called when an image is clicked, receives image index */
  onImageClick?: (index: number) => void;
  /**
   * Shared tick counter from parent — when provided, all carousels
   * advance together.  The displayed index is `syncTick % items.length`.
   * The internal auto-play timer is disabled while syncTick is set.
   */
  syncTick?: number;
}

export function ServiceCardCarousel({
  images,
  alt,
  autoPlay = true,
  interval = 3000,
  showArrows = false,
  contain = false,
  onImageClick,
  syncTick,
}: ServiceCardCarouselProps) {
  const [ownIndex, setOwnIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Normalize to ServiceCardImageData[]
  const items: ServiceCardImageData[] = images.map((img) =>
    typeof img === 'string' ? { src: img } : img
  );

  // When syncTick is provided, derive the visible index from it;
  // otherwise fall back to own internal state.
  const currentIndex =
    syncTick !== undefined && items.length > 0
      ? syncTick % items.length
      : ownIndex;

  const goToSlide = useCallback((i: number) => setOwnIndex(i), []);
  const goPrev = useCallback(() => setOwnIndex((p) => (p - 1 + items.length) % items.length), [items.length]);
  const goNext = useCallback(() => setOwnIndex((p) => (p + 1) % items.length), [items.length]);

  // Touch swipe support for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe if horizontal movement > vertical and exceeds threshold
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      if (deltaX < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, [goNext, goPrev]);

  // Internal timer only when syncTick is NOT provided
  useEffect(() => {
    if (syncTick !== undefined) return;          // parent drives timing
    if (!autoPlay || isHovered || items.length <= 1) return;
    const timer = setInterval(goNext, interval);
    return () => clearInterval(timer);
  }, [syncTick, autoPlay, isHovered, interval, goNext, items.length]);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];

  return (
    <div
      className={`relative w-full h-full min-h-[200px] overflow-hidden group/carousel ${contain ? 'bg-neutral-900' : 'bg-gray-200'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Images — using native <img> for maximum compatibility */}
      {items.map((item, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-500 ${index === currentIndex ? 'opacity-100 z-[1]' : 'opacity-0 z-0'}`}
        >
          <div
            className={onImageClick ? 'cursor-pointer w-full h-full' : 'w-full h-full'}
            onClick={() => onImageClick?.(index)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.src}
              alt={`${alt} - ${index + 1}`}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className={`absolute inset-0 w-full h-full ${contain ? 'object-contain' : 'object-cover group-hover:scale-110'} transition-transform duration-300`}
            />
          </div>
        </div>
      ))}

      {/* Label overlay for current image */}
      {currentItem?.label && (
        <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center pointer-events-none">
          {currentItem.labelHref ? (
            <a href={currentItem.labelHref}
              className="pointer-events-auto bg-black/60 text-white text-sm font-semibold px-4 py-2 rounded-lg backdrop-blur-sm hover:bg-cmyk-cyan/80 hover:text-white transition-colors"
              onClick={(e) => e.stopPropagation()}>
              {currentItem.label} →
            </a>
          ) : (
            <span className="bg-black/60 text-white text-sm font-semibold px-4 py-2 rounded-lg backdrop-blur-sm">{currentItem.label}</span>
          )}
        </div>
      )}

      {/* Arrow buttons */}
      {showArrows && items.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors opacity-0 group-hover/carousel:opacity-100 backdrop-blur-sm" aria-label="Anterior">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors opacity-0 group-hover/carousel:opacity-100 backdrop-blur-sm" aria-label="Siguiente">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}

      {/* Dots indicator */}
      {items.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {items.map((_, index) => (
            <div key={index} role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); goToSlide(index); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); goToSlide(index); } }}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${index === currentIndex ? 'bg-cmyk-cyan w-4' : 'bg-white/60 hover:bg-white/80'}`}
              aria-label={`Ir a imagen ${index + 1}`} />
          ))}
        </div>
      )}

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </div>
  );
}
