'use client';

import { useEffect, useRef } from 'react';

interface ScrollRevealOptions {
  /** Translate Y offset in px (default: 80) */
  translateY?: number;
  /** Animation duration in ms (default: 900) */
  duration?: number;
  /** IntersectionObserver threshold (default: 0.1) */
  threshold?: number;
  /** Delay before animation starts in ms (default: 0) */
  delay?: number;
  /** Animate scale (default: false) */
  scale?: boolean;
}

/**
 * Adds scroll-triggered reveal animation (fade + translate up + optional scale).
 * Uses IntersectionObserver for performance.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: ScrollRevealOptions = {}
) {
  const ref = useRef<T>(null);
  const {
    translateY = 80,
    duration = 900,
    threshold = 0.1,
    delay = 0,
    scale = false,
  } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Set initial hidden state
    el.style.opacity = '0';
    el.style.transform = `translateY(${translateY}px)${scale ? ' scale(0.96)' : ''}`;
    el.style.transition = `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0) scale(1)';
          observer.unobserve(el); // once
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [translateY, duration, threshold, delay, scale]);

  return ref;
}
