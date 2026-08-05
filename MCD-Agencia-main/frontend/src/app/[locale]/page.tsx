/**
 * Home Page for MCD-Agencia
 *
 * Landing page with:
 * - Hero full-width carousel (services integrated)
 * - Portfolio
 * - Clients
 * - Quote form
 * - Locations
 *
 * @module app/[locale]/page
 */

'use client';

import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { trackEvent, trackingEvents } from '@/lib/tracking';

// Landing page components
import {
  Header,
  Hero,
  PromoBanners,
  BackgroundGlow,
} from '@/components/landing';

const Portfolio = dynamic(
  () => import('@/components/landing/Portfolio').then((m) => m.Portfolio),
  { ssr: false, loading: () => <div className="min-h-[380px]" /> }
);

const Clients = dynamic(
  () => import('@/components/landing/Clients').then((m) => m.Clients),
  { ssr: false, loading: () => <div className="min-h-[220px]" /> }
);

const QuoteForm = dynamic(
  () => import('@/components/landing/QuoteForm').then((m) => m.QuoteForm),
  { ssr: false, loading: () => <div className="min-h-[420px]" /> }
);

const Locations = dynamic(
  () => import('@/components/landing/Locations').then((m) => m.Locations),
  { ssr: false, loading: () => <div className="min-h-[220px]" /> }
);

const Footer = dynamic(
  () => import('@/components/landing/Footer').then((m) => m.Footer),
  { ssr: false, loading: () => <div className="min-h-[180px]" /> }
);

const StickyActions = dynamic(
  () => import('@/components/landing/StickyActions').then((m) => m.StickyActions),
  { ssr: false }
);

const ChatWidget = dynamic(
  () => import('@/components/landing/ChatWidget').then((m) => m.default),
  { ssr: false }
);

// ─── Scroll-reveal (fueled.com / oncorps.ai style) ─────────────────────────
// Observed once, applies smooth translate + fade + optional scale + clip-path
function ScrollReveal({
  children,
  delay = 0,
  translateY = 60,
  scale = false,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  translateY?: number;
  scale?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const initScale = scale ? 0.95 : 1;
    el.style.opacity = '0';
    el.style.transform = `translateY(${translateY}px) scale(${initScale})`;
    el.style.clipPath = 'inset(8% 0 0 0)';
    el.style.willChange = 'transform, opacity, clip-path';
    el.style.transition = [
      `opacity 1.2s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      `transform 1.2s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      `clip-path 1.4s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    ].join(', ');
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0) scale(1)';
          el.style.clipPath = 'inset(0 0 0 0)';
          obs.unobserve(el);
        }
      },
      { threshold: 0.03, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, translateY, scale]);

  return <div ref={ref} className={className}>{children}</div>;
}

// ─── Parallax speed layer (bearideas.fr style) ─────────────────────────────
function ParallaxShift({
  children,
  speed = 0.12,
  className = '',
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const viewCenter = window.innerHeight / 2;
      const offset = (center - viewCenter) * speed;
      el.style.transform = `translateY(${offset}px)`;
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [speed]);

  return <div ref={ref} className={`will-change-transform ${className}`}>{children}</div>;
}

// =============================================================================
// Home Page Component
// =============================================================================

export default function HomePage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);

  useEffect(() => {
    // Track page view
    trackEvent(trackingEvents.LP_VIEW, {
      page: '/',
      title: 'Landing Page - Agencia MCD',
    });
  }, []);

  return (
    <div className="landing-page relative bg-cmyk-black min-h-screen">
      {/* Hide the default layout header/footer - landing has its own */}
      <style jsx global>{`
        .landing-page ~ header,
        .landing-page ~ footer,
        .layout-header,
        .layout-footer,
        #main-content > .layout-header,
        #main-content > .layout-footer {
          display: none !important;
        }
      `}</style>

      {/* Background glows distributed across the page */}
      <BackgroundGlow />

      <Header />
      <main className="relative z-10">
        <Hero />
        <PromoBanners />

        {/* Portfolio — clip-path reveal + parallax */}
        <ScrollReveal translateY={70} scale className="overflow-hidden">
          <ParallaxShift speed={0.05}>
            <Portfolio />
          </ParallaxShift>
        </ScrollReveal>

        {/* Clients — slide up from below */}
        <ScrollReveal translateY={50} delay={80}>
          <Clients />
        </ScrollReveal>

        {/* QuoteForm — scale reveal + parallax */}
        <ScrollReveal translateY={60} scale>
          <ParallaxShift speed={0.03}>
            <QuoteForm />
          </ParallaxShift>
        </ScrollReveal>

        {/* Locations — slide up */}
        <ScrollReveal translateY={50} delay={60}>
          <Locations />
        </ScrollReveal>
      </main>

      <ScrollReveal translateY={30}>
        <Footer />
      </ScrollReveal>
      <StickyActions
        onChatToggle={() => setChatOpen(true)}
        chatState={chatOpen ? (chatMinimized ? 'minimized' : 'open') : 'closed'}
      />
      <ChatWidget
        externalOpen={chatOpen}
        onOpenChange={setChatOpen}
        onStateChange={({ open, minimized }) => {
          setChatOpen(open);
          setChatMinimized(minimized);
        }}
      />
    </div>
  );
}
