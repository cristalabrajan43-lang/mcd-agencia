'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { CONTACT_INFO } from '@/lib/constants';
import { getCarouselSlides } from '@/lib/api/content';
import { resolveMediaUrl } from '@/lib/media';

// ─── Types ───────────────────────────────────────────────────────────────────
interface HeroSlide {
  image: string;
  title: string;
  subtitle?: string;
  cta?: { label: string; href: string };
  serviceKey?: string;
}



export function Hero() {
  const t = useTranslations('landing.hero');
  const tServices = useTranslations('landing.services');
  const { data: apiSlides = [] } = useQuery({
    queryKey: ['hero-carousel-slides'],
    queryFn: getCarouselSlides,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedImageIndex, setExpandedImageIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showExpandTooltip, setShowExpandTooltip] = useState(true);
  const [heroVisible, setHeroVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ top: 16, right: 16 });
  const sectionRef = useRef<HTMLElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  // Mount flag for portal
  useEffect(() => setMounted(true), []);

  // Auto-hide expand tooltip after 5 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowExpandTooltip(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Keep the expand button anchored to the hero corner instead of the viewport
  useEffect(() => {
    const updateButtonPosition = () => {
      const el = sectionRef.current;
      if (!el || typeof window === 'undefined') return;
      const rect = el.getBoundingClientRect();
      setButtonPosition({
        top: rect.top + 16,
        right: Math.max(window.innerWidth - rect.right + 16, 16),
      });
    };

    updateButtonPosition();

    let raf = 0;
    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateButtonPosition);
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // Hide expand button when hero section scrolls out of view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ─── Build slides: 100% from admin panel ────────────────────────────────────
  const slides: HeroSlide[] = useMemo(() => {
    if (!apiSlides || apiSlides.length === 0) return [];

    return [...apiSlides]
      .sort((a, b) => a.position - b.position)
      .filter((slide) => Boolean(slide.image))
      .map((slide) => ({
        image: resolveMediaUrl(slide.image),
        title: slide.title || t('title'),
        subtitle: slide.subtitle || t('subtitle'),
        cta: slide.cta_url
          ? {
              label: slide.cta_text || t('cta'),
              href: slide.cta_url,
            }
          : undefined,
        serviceKey: slide.service_key || undefined,
      }));
  }, [apiSlides, t]);

  // ─── Auto-play (pause while expanded) ────────────────────────────────────
  useEffect(() => {
    if (!isAutoPlaying || slides.length <= 1 || isExpanded) return;
    const timer = setInterval(() => setCurrentIndex((p) => (p + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, slides.length, isExpanded]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.dataset.heroExpanding = (isExpanding || isExpanded) ? 'true' : 'false';
    document.body.dataset.heroExpanded = isExpanded ? 'true' : 'false';
    return () => {
      delete document.body.dataset.heroExpanding;
      delete document.body.dataset.heroExpanded;
    };
  }, [isExpanding, isExpanded]);

  // Scroll lock while expanded
  useEffect(() => {
    if (!isExpanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded]);

  // ─── Navigation ────────────────────────────────────────────────────────────
  const goTo = useCallback((i: number) => { setCurrentIndex(i); setIsAutoPlaying(false); }, []);
  const goNext = useCallback(() => { setCurrentIndex((p) => (p + 1) % slides.length); setIsAutoPlaying(false); }, [slides.length]);
  const goPrev = useCallback(() => { setCurrentIndex((p) => (p - 1 + slides.length) % slides.length); setIsAutoPlaying(false); }, [slides.length]);
  const handleExpand = useCallback(() => {
    if (isExpanded || isExpanding) return;
    setExpandedImageIndex(currentIndex);
    setIsExpanding(true);
    setTimeout(() => setIsExpanded(true), 380);
    setTimeout(() => setIsExpanding(false), 760);
  }, [isExpanded, isExpanding, currentIndex]);

  const handleMobileHeroClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!isMobile || isExpanded || isExpanding) return;

    const target = event.target as HTMLElement;
    if (
      target.closest('button, a, input, textarea, select, label, [role="button"], [data-no-hero-expand="true"]')
    ) {
      return;
    }

    handleExpand();
  }, [isMobile, isExpanded, isExpanding, handleExpand]);

  // ─── Touch/swipe ───────────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; touchDeltaX.current = 0; }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => { touchDeltaX.current = e.touches[0].clientX - touchStartX.current; }, []);
  const handleTouchEnd = useCallback(() => {
    if (touchDeltaX.current < -50) goNext();
    else if (touchDeltaX.current > 50) goPrev();
    touchDeltaX.current = 0;
  }, [goNext, goPrev]);



  return (
    <>
    <section
      ref={sectionRef}
      id="servicios"
      className="relative w-full h-screen min-h-[600px] max-h-[1000px] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleMobileHeroClick}
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* ─── Background slides with transition effects ───────────────── */}
      {slides.map((slide, index) => {
        const isActive = index === currentIndex;
        return (
          <div
            key={index}
            className="absolute inset-0"
            style={{
              opacity: isActive ? 1 : 0,
              transform: isActive ? 'scale(1)' : 'scale(1.08)',
              transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1), transform 6s cubic-bezier(0.4,0,0.2,1)',
              zIndex: isActive ? 1 : 0,
            }}
          >
            <Image
              src={slide.image}
              alt={slide.title}
              fill
              className="object-cover"
              priority={index === 0}
              sizes="100vw"
            />
            {/* Subtle vignette — lighter than before */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
          </div>
        );
      })}



      {/* ─── Content overlay ────────────────────────────────────────────── */}
      <div className="relative z-10 h-full flex flex-col">

        {/* Center area — service title + subtitle */}
        <div className={`flex-1 flex items-end transition-all duration-500 ${isExpanding || isExpanded ? 'hero-dust-disappear' : ''}`}>
          <div className="container-custom px-4 sm:px-6 w-full pb-6 sm:pb-10 md:pb-12">
            <div className="max-w-3xl rounded-2xl border border-white/10 bg-black/35 backdrop-blur-[1px] shadow-2xl px-5 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7">
              {/* Service title — large uppercase */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white uppercase leading-tight tracking-wide">
                {slides[currentIndex]?.title || t('title')}
              </h1>

              {/* Subtitle */}
              {slides[currentIndex]?.subtitle && (
                <p className="mt-3 text-sm sm:text-base md:text-lg text-white/75 max-w-2xl line-clamp-3">
                  {slides[currentIndex].subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom section — logo left + trust badges */}
        <div className={`px-4 sm:px-8 md:px-12 pb-28 sm:pb-32 md:pb-36 transition-all duration-500 ${isExpanding || isExpanded ? 'hero-dust-disappear' : ''}`}>
          {/* Logo */}
          <img
            src="/logo-hero.png"
            alt="Agencia MCD"
            className="w-36 sm:w-48 md:w-60 lg:w-72 h-auto drop-shadow-2xl opacity-95 mb-3"
            style={{ maxWidth: '50vw' }}
          />

          {/* Trust badges — slightly bigger */}
          <div className="flex flex-wrap gap-4 sm:gap-5">
            <span className="text-white/60 text-xs sm:text-sm flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cmyk-cyan" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              {t('trustBadges.fastDelivery')}
            </span>
            <span className="text-white/60 text-xs sm:text-sm flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cmyk-magenta" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              {t('trustBadges.qualityGuaranteed')}
            </span>
            <span className="text-white/60 text-xs sm:text-sm flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cmyk-yellow" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              {t('trustBadges.businessHours', { hours: CONTACT_INFO.businessHours })}
            </span>
          </div>
        </div>
      </div>



      {/* ─── Navigation arrows ──────────────────────────────────────────── */}
      {slides.length > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="Slide anterior"
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 bg-white/5 hover:bg-white/15 text-white/70 hover:text-white p-2.5 sm:p-3 rounded-full transition-all duration-300 backdrop-blur-sm border border-white/10"
          >
            <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={goNext}
            aria-label="Siguiente slide"
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 bg-white/5 hover:bg-white/15 text-white/70 hover:text-white p-2.5 sm:p-3 rounded-full transition-all duration-300 backdrop-blur-sm border border-white/10"
          >
            <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}

      {/* ─── Slide indicators (center bottom) ──────────────────────────── */}
      {slides.length > 1 && (
        <div className="absolute bottom-8 sm:bottom-10 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              aria-label={`Ir a slide ${index + 1}`}
              className={`rounded-full transition-all duration-300 h-2.5 sm:h-3 ${
                index === currentIndex
                  ? 'bg-cmyk-cyan w-8 sm:w-10'
                  : 'bg-white/40 hover:bg-white/60 w-2.5 sm:w-3'
              }`}
            />
          ))}
        </div>
      )}

      {/* ─── Bottom fade to seamless black ────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-[15] pointer-events-none">
        <div className="h-28 sm:h-36 md:h-44 bg-gradient-to-t from-cmyk-black via-cmyk-black/70 to-transparent" />
      </div>

      <style jsx global>{`
        @keyframes hero-dust {
          0% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
          35% { opacity: 0.65; transform: translateY(-2px) scale(0.995); filter: blur(0.6px); }
          100% { opacity: 0; transform: translateY(-10px) scale(0.985); filter: blur(2px); }
        }
        .hero-dust-disappear {
          animation: hero-dust 420ms ease-out forwards;
          pointer-events: none;
        }
        body[data-hero-expanding='true'] .layout-header {
          animation: hero-dust 420ms ease-out forwards;
          pointer-events: none;
        }
        body[data-hero-expanded='true'] .layout-header,
        body[data-hero-expanded='true'] .sticky-actions-container {
          opacity: 0 !important;
          pointer-events: none !important;
          transition: opacity 300ms ease;
        }
        @keyframes hero-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes hero-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
      `}</style>

    </section>

    {/* ─── Portals: rendered directly into document.body ─────────────── */}
    {mounted && createPortal(
      <>
        {/* Expand button */}
        {!isMobile && (
        <div
          style={{ position: 'fixed', top: buttonPosition.top, right: buttonPosition.right, zIndex: 9999 }}
          className={`hero-expand-button transition-all duration-500 ${
            isExpanding || isExpanded || !heroVisible
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={handleExpand}
            aria-label="Expandir imagen"
            style={{ cursor: 'pointer' }}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-black/40 border border-white/25 text-white/90 hover:bg-black/55 hover:text-white transition-all duration-200 backdrop-blur-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6" />
            </svg>
          </button>
          {/* Tooltip — to the left of the button, vertically centered */}
          <div
            className={`pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 whitespace-nowrap rounded-lg bg-black/70 border border-white/20 px-2.5 py-1 text-xs text-white/90 transition-all duration-300 ${showExpandTooltip ? 'opacity-100' : 'opacity-0'}`}
            style={{ animation: 'hero-float 2.2s ease-in-out infinite' }}
          >
            Expandir
          </div>
        </div>
        )}

        {/* Fullscreen overlay */}
        {isExpanded && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: '#000' }}
            className="flex items-center justify-center"
            onClick={() => setIsExpanded(false)}
          >
            <img
              src={slides[expandedImageIndex]?.image || ''}
              alt={slides[expandedImageIndex]?.title || 'Imagen expandida'}
              className="max-w-full max-h-full object-contain animate-[hero-fade-in_300ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
              aria-label="Cerrar"
              style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, cursor: 'pointer' }}
              className="w-11 h-11 rounded-xl bg-white/15 border border-white/30 text-white hover:bg-white/25 transition-colors flex items-center justify-center text-lg"
            >
              ✕
            </button>
          </div>
        )}
      </>,
      document.body
    )}

    </>
  );
}
