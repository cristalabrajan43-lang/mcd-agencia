/**
 * Tracking utilities for analytics
 *
 * ⚠️  DEPRECATED — This file re-exports from @/lib/analytics for backward compatibility.
 *     New code should import directly from '@/lib/analytics'.
 */

export { trackEvent, trackCTA } from '@/lib/analytics';

// Legacy event constants (kept for backward compatibility)
export const trackingEvents = {
  LP_VIEW: 'lp_view',
  CTA_CLICK_QUOTE: 'cta_click_quote',
  CTA_CLICK_WHATSAPP: 'cta_click_whatsapp',
  FORM_START: 'form_start',
  FORM_SUBMIT_SUCCESS: 'form_submit_success',
  FORM_SUBMIT_ERROR: 'form_submit_error',
} as const;

export type TrackingEvent = typeof trackingEvents[keyof typeof trackingEvents];
