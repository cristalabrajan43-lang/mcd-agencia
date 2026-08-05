'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

export interface CarouselImage {
  src: string;
  alt: string;
  title?: string;
  /** Link URL when the title is clicked */
  titleHref?: string;
}

interface ImageCarouselProps {
  images: CarouselImage[];
  autoPlay?: boolean;
  interval?: number;
  height?: number;
  /** Called when an image (not title) is clicked, receives the image index */
  onImageClick?: (index: number) => void;
}

export function ImageCarousel({
  images,
  autoPlay = true,
  interval = 5000,
  height = 500,
  onImageClick,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);

  useEffect(() => {
    if (!isAutoPlaying || images.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, interval);
    return () => clearInterval(timer);
  }, [isAutoPlaying, images.length, interval]);

  const goToPrevious = useCallback(() => { setCurrentIndex((p) => (p - 1 + images.length) % images.length); setIsAutoPlaying(false); }, [images.length]);
  const goToNext = useCallback(() => { setCurrentIndex((p) => (p + 1) % images.length); setIsAutoPlaying(false); }, [images.length]);
  const goToSlide = useCallback((i: number) => { setCurrentIndex(i); setIsAutoPlaying(false); }, []);

  if (images.length === 0) {
    return (
      <div className="w-full rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center" style={{ height: `${height}px` }}>
        <p className="text-gray-400">Sin imágenes disponibles</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-xl sm:shadow-2xl group"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(autoPlay)}
      style={{ height: `${height}px`, minHeight: '200px' }}
    >
      {/* Images */}
      {images.map((image, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100 z-[1]' : 'opacity-0 z-0'}`}
        >
          <div
            className={onImageClick ? 'cursor-pointer w-full h-full' : 'w-full h-full'}
            onClick={() => onImageClick?.(index)}
          >
            <Image src={image.src} alt={image.alt} fill className="object-cover" priority={index === 0} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 80vw" />
          </div>
          {image.title && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3 sm:p-6 pointer-events-none">
              {image.titleHref ? (
                <a href={image.titleHref} className="pointer-events-auto text-white text-lg sm:text-2xl font-bold hover:text-cmyk-cyan transition-colors drop-shadow-lg" onClick={(e) => e.stopPropagation()}>
                  {image.title} →
                </a>
              ) : (
                <h3 className="text-white text-lg sm:text-2xl font-bold drop-shadow-lg">{image.title}</h3>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Arrows */}
      <button onClick={goToPrevious} aria-label="Imagen anterior" className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 bg-white/30 hover:bg-white/50 text-white p-2 sm:p-3 rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 backdrop-blur-sm">
        <svg className="w-5 sm:w-6 h-5 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </button>
      <button onClick={goToNext} aria-label="Siguiente imagen" className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 bg-white/30 hover:bg-white/50 text-white p-2 sm:p-3 rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 backdrop-blur-sm">
        <svg className="w-5 sm:w-6 h-5 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 sm:gap-2">
        {images.map((_, index) => (
          <button key={index} onClick={() => goToSlide(index)} aria-label={`Ir a imagen ${index + 1}`}
            className={`rounded-full transition-all duration-300 ${index === currentIndex ? 'bg-white w-6 sm:w-8 h-2 sm:h-3' : 'bg-white/50 hover:bg-white/75 w-2 sm:w-3 h-2 sm:h-3'}`} />
        ))}
      </div>

      {/* Counter */}
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-10 bg-black/40 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium backdrop-blur-sm">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}

/**
 * Fullscreen lightbox carousel overlay.
 * Shows images with object-contain (letterboxed) and prev/next arrows.
 */
export function FullscreenCarousel({ images, initialIndex = 0, onClose }: {
  images: CarouselImage[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrent((p) => (p - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setCurrent((p) => (p + 1) % images.length);
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', handleKey); document.body.style.overflow = ''; };
  }, [images.length, onClose]);

  if (images.length === 0) return null;
  const img = images[current];

  return (
    <div className="fixed inset-0 z-[100] bg-black/90" onClick={onClose}>
      {/* Close X */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-20 right-4 z-30 text-white hover:text-red-400 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors shadow-lg"
        aria-label="Cerrar"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      {/* Layout — pointer-events-none so clicks pass through to overlay */}
      <div className="flex flex-col items-center justify-center h-full pt-24 pb-4 pointer-events-none select-none">
        {/* Arrows — positioned fixed so they don't depend on image size */}
        {images.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p - 1 + images.length) % images.length); }}
              className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 pointer-events-auto bg-white/20 hover:bg-white/40 text-white p-3 rounded-full transition-colors backdrop-blur-sm" aria-label="Anterior">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p + 1) % images.length); }}
              className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 pointer-events-auto bg-white/20 hover:bg-white/40 text-white p-3 rounded-full transition-colors backdrop-blur-sm" aria-label="Siguiente">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </>
        )}

        {/* Image — native <img> so element boundary = visible image boundary */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.src}
          alt={img.alt}
          className="max-w-[90vw] max-h-[70vh] object-contain pointer-events-auto rounded"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />

        {/* Title */}
        {img.title && (
          <div className="mt-3 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            {img.titleHref ? (
              <a href={img.titleHref} className="text-white text-xl font-bold bg-black/50 px-4 py-2 rounded-lg hover:text-cmyk-cyan transition-colors">{img.title} →</a>
            ) : (
              <span className="text-white text-xl font-bold bg-black/50 px-4 py-2 rounded-lg">{img.title}</span>
            )}
          </div>
        )}

        {/* Counter */}
        <div className="mt-2">
          <span className="bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
            {current + 1} / {images.length}
          </span>
        </div>
      </div>
    </div>
  );
}
