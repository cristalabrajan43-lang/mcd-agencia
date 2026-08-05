/**
 * Analytics & event tracking utility — the single source of truth for all
 * client-side tracking in MCD-Agencia.
 *
 * Events are sent to:
 *  1. Google Analytics 4 (if loaded / user consented)
 *  2. Our own Django backend (/api/v1/analytics/events/) for in-house dashboards
 *
 * Usage:
 *   import { analytics } from '@/lib/analytics';
 *   analytics.page('/servicios');
 *   analytics.event('cta_click', { type: 'whatsapp', location: 'header' });
 *   analytics.track.quoteStart();
 */

// ─── GA4 bridge ──────────────────────────────────────────────────────────────

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

function sendToGA4(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
}

// ─── Backend bridge ──────────────────────────────────────────────────────────

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || '';
const BATCH_INTERVAL = 5_000; // flush every 5 s
const MAX_BATCH = 20;

interface RawEvent {
  event_name: string;
  event_data: Record<string, unknown>;
  page_url: string;
  timestamp: string;
}

let eventQueue: RawEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function enqueueEvent(event: RawEvent) {
  eventQueue.push(event);
  if (eventQueue.length >= MAX_BATCH) {
    flushEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, BATCH_INTERVAL);
  }
}

function flushEvents() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (eventQueue.length === 0) return;

  const batch = [...eventQueue];
  eventQueue = [];

  // Fire-and-forget — we don't want analytics to block the UI
  if (BACKEND_URL) {
    fetch(`${BACKEND_URL}/analytics/events/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true, // survive page unloads
    }).catch(() => {
      // Silently ignore — analytics should never crash the app
    });
  }
}

// Flush when user leaves page
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEvents();
  });
  window.addEventListener('pagehide', flushEvents);
}

// ─── Session metadata (collected once) ───────────────────────────────────────

function getSessionMeta(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const url = new URL(window.location.href);
  return {
    referrer: document.referrer || undefined,
    utm_source: url.searchParams.get('utm_source') || undefined,
    utm_medium: url.searchParams.get('utm_medium') || undefined,
    utm_campaign: url.searchParams.get('utm_campaign') || undefined,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

let cachedSessionMeta: Record<string, unknown> | null = null;
function sessionMeta() {
  if (!cachedSessionMeta) cachedSessionMeta = getSessionMeta();
  return cachedSessionMeta;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const analytics = {
  /**
   * Track a page view
   */
  page(path?: string) {
    const url = path || (typeof window !== 'undefined' ? window.location.pathname : '/');
    sendToGA4('page_view', { page_path: url });
    enqueueEvent({
      event_name: 'page_view',
      event_data: { page_path: url, ...sessionMeta() },
      page_url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track a generic custom event
   */
  event(name: string, data?: Record<string, unknown>) {
    sendToGA4(name, data);
    enqueueEvent({
      event_name: name,
      event_data: { ...data, ...sessionMeta() },
      page_url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', name, data);
    }
  },

  /**
   * Pre-defined business events — keeps naming consistent
   */
  track: {
    // ── CTA clicks ─────────────────────────────────────────────────
    ctaQuote(location: string) {
      analytics.event('cta_click_quote', { location });
    },
    ctaWhatsApp(location: string) {
      analytics.event('cta_click_whatsapp', { location });
    },
    ctaCall(location: string) {
      analytics.event('cta_click_call', { location });
    },

    // ── Quote form ─────────────────────────────────────────────────
    quoteFormStart() {
      analytics.event('quote_form_start');
    },
    quoteFormSubmit(service?: string) {
      analytics.event('quote_form_submit', { service });
    },
    quoteFormError(error: string) {
      analytics.event('quote_form_error', { error });
    },
    quoteFormAbandon(step: string) {
      analytics.event('quote_form_abandon', { step });
    },

    // ── Catalog / Cart ─────────────────────────────────────────────
    productView(productId: string, productName: string) {
      analytics.event('product_view', { product_id: productId, product_name: productName });
    },
    addToCart(productId: string, quantity: number) {
      analytics.event('add_to_cart', { product_id: productId, quantity });
    },
    removeFromCart(productId: string) {
      analytics.event('remove_from_cart', { product_id: productId });
    },
    checkoutStart() {
      analytics.event('checkout_start');
    },
    checkoutComplete(orderId: string, total: number) {
      analytics.event('checkout_complete', { order_id: orderId, total });
    },

    // ── Services ───────────────────────────────────────────────────
    serviceCardOpen(serviceId: string) {
      analytics.event('service_card_open', { service_id: serviceId });
    },
    serviceCardClose(serviceId: string, dwellMs: number) {
      analytics.event('service_card_close', { service_id: serviceId, dwell_ms: dwellMs });
    },

    // ── Chatbot ────────────────────────────────────────────────────
    chatOpen() {
      analytics.event('chat_open');
    },
    chatMessage(message: string) {
      analytics.event('chat_message', { message_length: message.length });
    },

    // ── Auth ───────────────────────────────────────────────────────
    login(method: string) {
      analytics.event('login', { method });
    },
    signup(method: string) {
      analytics.event('signup', { method });
    },

    // ── Scroll depth ───────────────────────────────────────────────
    scrollDepth(percent: number) {
      analytics.event('scroll_depth', { percent });
    },
  },

  /** Force-flush the event queue (e.g. before navigating away) */
  flush: flushEvents,
};

// ─── Convenience re-exports for backward compatibility ───────────────────────

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  analytics.event(eventName, properties);
}

export function trackCTA(type: 'quote' | 'whatsapp' | 'video_play', location: string) {
  if (type === 'quote') analytics.track.ctaQuote(location);
  else if (type === 'whatsapp') analytics.track.ctaWhatsApp(location);
  else analytics.event('video_play', { location });
}
