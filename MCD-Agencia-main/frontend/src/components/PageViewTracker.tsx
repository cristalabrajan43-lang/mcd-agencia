'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { analytics } from '@/lib/analytics';
import { useCookieConsent } from '@/contexts/CookieConsentContext';

/**
 * Tracks page views on every Next.js client-side navigation.
 * Also reports scroll depth (25 / 50 / 75 / 100 %) once per page.
 *
 * Only sends events when the user has given analytics consent.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const { consent } = useCookieConsent();
  const reportedDepths = useRef(new Set<number>());

  // Track page view on route change
  useEffect(() => {
    if (!consent?.analytics) return;
    analytics.page(pathname);
    reportedDepths.current.clear();
  }, [pathname, consent?.analytics]);

  // Scroll depth tracking
  useEffect(() => {
    if (!consent?.analytics) return;

    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const pct = Math.round((scrollTop / docHeight) * 100);
      for (const threshold of [25, 50, 75, 100]) {
        if (pct >= threshold && !reportedDepths.current.has(threshold)) {
          reportedDepths.current.add(threshold);
          analytics.track.scrollDepth(threshold);
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname, consent?.analytics]);

  return null;
}
