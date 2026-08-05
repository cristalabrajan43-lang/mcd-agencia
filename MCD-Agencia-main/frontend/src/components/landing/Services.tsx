'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  LANDING_SERVICE_IDS,
  SERVICE_CAROUSEL_IMAGES,
  SERVICE_SUBCATEGORIES,
  type LandingServiceId
} from '@/lib/service-ids';
import { CONTACT_INFO } from '@/lib/constants';
import { getLandingPageData, type ServiceImage } from '@/lib/api/content';
import { ServiceCardCarousel, type ServiceCardImageData } from './ServiceCardCarousel';

export function Services() {
  const t = useTranslations('landing.services');
  const [selectedServiceId, setSelectedServiceId] = useState<LandingServiceId | null>(null);
  const [fullscreenImages, setFullscreenImages] = useState<{ images: ServiceCardImageData[]; index: number } | null>(null);

  // Shared tick so every service card carousel advances at the same time
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSyncTick((t) => t + 1), 6000); // 6 s
    return () => clearInterval(timer);
  }, []);

  const { data: landingData, isLoading: landingLoading } = useQuery({
    queryKey: ['landing-data'],
    queryFn: getLandingPageData,
    staleTime: 2 * 60 * 1000,  // 2 min — show CMS image changes faster
    retry: 1,
  });

  // Build API images lookup by service_key — matches service to its carousel images
  const apiDataByKey = useMemo(() => {
    const map: Record<string, { images: ServiceCardImageData[]; rawImages: ServiceImage[] }> = {};
    if (landingData?.services) {
      landingData.services.forEach((svc) => {
        const key = svc.service_key || '';
        if (svc.carousel_images && svc.carousel_images.length > 0 && key) {
          map[key] = {
            rawImages: svc.carousel_images,
            images: svc.carousel_images.map((img) => ({
              src: img.image,
              label: img.alt_text || undefined,
              labelHref: img.subtype_key && key
                ? `#cotizar?servicio=${key}&subtipo=${img.subtype_key}`
                : undefined,
            })),
          };
        }
      });
    }
    return map;
  }, [landingData]);

  // Get translated service data with subcategories
  const getServiceData = useCallback((id: LandingServiceId) => {
    const subcategories = SERVICE_SUBCATEGORIES[id] || [];
    const apiData = apiDataByKey[id];
    // Rich image data for modal; plain strings for card
    const carouselImages: ServiceCardImageData[] = apiData?.images ?? (landingLoading ? [] : SERVICE_CAROUSEL_IMAGES[id].map((src) => ({ src })));
    const carouselImageStrings = apiData ? apiData.images.map((i) => i.src) : (landingLoading ? [] : SERVICE_CAROUSEL_IMAGES[id]);
    return {
      id,
      title: t(`items.${id}.title`),
      description: t(`items.${id}.description`),
      subcategories: subcategories.map(sub => ({
        ...sub,
        title: t(`subcategories.${sub.titleKey}`),
      })),
      carouselImages,
      carouselImageStrings,
    };
  }, [t, apiDataByKey, landingLoading]);

  const selectedService = selectedServiceId
    ? getServiceData(selectedServiceId)
    : null;

  // Lock body scroll when detail modal is open
  useEffect(() => {
    if (selectedService) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedService]);

  // Handle browser back button to close modal instead of navigating away
  const popstateClosedRef = useRef(false);
  useEffect(() => {
    if (!selectedServiceId) return;
    popstateClosedRef.current = false;
    window.history.pushState({ modal: 'service' }, '');
    const onPopState = () => {
      popstateClosedRef.current = true;
      setSelectedServiceId(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      // If closed by UI (not back button), clean up the history entry
      if (!popstateClosedRef.current) {
        window.history.back();
      }
    };
  }, [selectedServiceId]);

  // Fullscreen image handler for modal
  const handleModalImageClick = useCallback((images: ServiceCardImageData[], index: number) => {
    setFullscreenImages({ images, index });
  }, []);

  return (
    <section id="servicios" className="section py-12 sm:py-16 md:py-20 lg:py-24">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-10 md:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl mb-4 font-bold text-white">{t('title')}</h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-300">{t('subtitle')}</p>
        </div>

        {/* Grid de Servicios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {LANDING_SERVICE_IDS.map((serviceId, index) => {
            const service = getServiceData(serviceId);
            return (
              <div key={serviceId} role="button" tabIndex={0}
                onClick={() => setSelectedServiceId(serviceId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedServiceId(serviceId); }}
                className="group overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-to-br from-cmyk-black/80 to-cmyk-black/60 border-2 border-cmyk-cyan/40 hover:border-cmyk-cyan/80 cursor-pointer text-left"
                style={{ animationDelay: `${index * 50}ms` }}>
                <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-200">
                  {service.carouselImageStrings.length === 0 ? (
                    <div className="absolute inset-0 bg-neutral-800/60 animate-pulse flex items-center justify-center">
                      <svg className="w-10 h-10 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                    </div>
                  ) : (
                    <ServiceCardCarousel images={service.carouselImageStrings} alt={service.title} syncTick={syncTick} />
                  )}
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  <h3 className="text-base sm:text-lg font-bold text-white line-clamp-2 group-hover:text-cmyk-cyan transition-colors min-h-14">{service.title}</h3>
                  <p className="text-sm sm:text-base text-gray-300 line-clamp-3 h-auto">{service.description}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {service.subcategories.slice(0, 3).map((subcategory) => (
                      <a key={subcategory.id} href={subcategory.href} onClick={(e) => e.stopPropagation()}
                        className="text-xs bg-cmyk-cyan/30 text-cmyk-cyan px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium hover:bg-cmyk-cyan hover:text-white transition-colors">
                        {subcategory.title}
                      </a>
                    ))}
                  </div>
                  <div className="pt-3 flex items-center justify-between group/cta border-t border-gray-100">
                    <span className="text-sm font-semibold text-gray-200 group-hover/cta:text-cmyk-cyan transition-colors">{t('viewDetails')}</span>
                    <span className="text-cmyk-cyan font-bold group-hover/cta:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════ Service Detail Modal ═══════════ */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start md:items-center justify-center pt-20 md:pt-4 px-3 pb-3 sm:px-4 sm:pb-4 overscroll-contain" onClick={() => setSelectedServiceId(null)}>
          <div className="bg-gradient-to-br from-cmyk-black/80 to-cmyk-black/60 rounded-2xl max-w-4xl w-full max-h-[90dvh] overflow-y-auto shadow-2xl animate-scale-in border-2 border-cmyk-cyan/40 overscroll-contain" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Carousel with arrows + subtype labels + click to fullscreen */}
              <div className="relative h-80 md:h-full min-h-96 overflow-hidden">
                <ServiceCardCarousel
                  images={selectedService.carouselImages}
                  alt={selectedService.title}
                  interval={4000}
                  showArrows
                  contain
                  onImageClick={(i) => handleModalImageClick(selectedService.carouselImages, i)}
                />
                <button onClick={() => setSelectedServiceId(null)}
                  className="absolute top-4 right-4 md:hidden bg-black/50 text-white hover:bg-black/70 p-2 rounded-full transition-colors z-20" aria-label={t('close')}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex flex-col">
                <div className="sticky top-0 bg-gradient-to-r from-cmyk-black to-cmyk-magenta text-white p-6 flex items-start justify-between md:relative">
                  <div><h2 className="text-2xl font-bold">{selectedService.title}</h2></div>
                  <button onClick={() => setSelectedServiceId(null)}
                    className="hidden md:block text-white hover:bg-white/20 p-2 rounded-full transition-colors flex-shrink-0" aria-label={t('close')}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
                  <p className="text-gray-400 leading-relaxed">{selectedService.description}</p>
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-100">{t('subcategoriesLabel')}</h3>
                    <div className="flex flex-wrap gap-3">
                      {selectedService.subcategories.map((subcategory) => (
                        <a key={subcategory.id} href={subcategory.href} onClick={() => setSelectedServiceId(null)}
                          className="bg-cmyk-cyan/20 text-cmyk-cyan px-5 py-3 rounded-full font-medium text-sm hover:bg-cmyk-cyan hover:text-white transition-colors">
                          {subcategory.title}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="bg-cmyk-yellow/10 border border-cmyk-yellow rounded-lg p-5">
                    <p className="text-sm text-gray-200 leading-relaxed"><span className="font-semibold text-cmyk-yellow">💡 Tip:</span> {t('tip')}</p>
                  </div>
                  <div className="border-t border-cmyk-cyan/20 pt-8">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <a href={`#cotizar?servicio=${selectedService.id}`} onClick={() => setSelectedServiceId(null)}
                        className="flex-1 btn-primary text-center py-4 rounded-lg font-semibold transition-all hover:shadow-lg">{t('requestQuote')}</a>
                      <a href={`${CONTACT_INFO.whatsapp.url}?text=${encodeURIComponent(`Hi, I'm interested in ${selectedService.title}`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 btn-whatsapp text-center py-4 rounded-lg font-semibold transition-all hover:shadow-lg">{t('whatsappConsult')}</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Fullscreen Lightbox ═══════════ */}
      {fullscreenImages && (
        <FullscreenServiceImage
          images={fullscreenImages.images}
          initialIndex={fullscreenImages.index}
          onClose={() => setFullscreenImages(null)}
        />
      )}
    </section>
  );
}

/** Fullscreen lightbox for service images — object-contain with dark bg */
function FullscreenServiceImage({ images, initialIndex, onClose }: {
  images: ServiceCardImageData[]; initialIndex: number; onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);

  // Keyboard navigation
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

  const img = images[current];
  if (!img) return null;

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
        {/* Arrows */}
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
          alt={img.label || ''}
          className="max-w-[90vw] max-h-[70vh] object-contain pointer-events-auto rounded"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />

        {/* Label */}
        {img.label && (
          <div className="mt-3 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            {img.labelHref ? (
              <a href={img.labelHref} className="text-white text-xl font-bold bg-black/50 px-4 py-2 rounded-lg hover:text-cmyk-cyan transition-colors">{img.label} →</a>
            ) : (
              <span className="text-white text-xl font-bold bg-black/50 px-4 py-2 rounded-lg">{img.label}</span>
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
