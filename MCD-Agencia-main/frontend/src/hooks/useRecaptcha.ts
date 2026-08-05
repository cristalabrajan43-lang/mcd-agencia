'use client';

/**
 * reCAPTCHA v3 Hook for MCD-Agencia
 *
 * Provides invisible reCAPTCHA protection for:
 * - Login
 * - Registration
 * - Quote requests
 * - Contact forms
 *
 * Uses reCAPTCHA v3 which is invisible and provides a score.
 */

import { useCallback, useEffect, useState } from 'react';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

/** Ignore placeholder keys from .env.example in local/dev. */
function isRecaptchaConfigured(siteKey: string): boolean {
  const key = siteKey.trim();
  if (!key) return false;
  const lower = key.toLowerCase();
  if (lower.includes('your-') || lower.includes('changeme') || lower.includes('example')) {
    return false;
  }
  return true;
}

// Actions for reCAPTCHA scoring
export type RecaptchaAction = 'login' | 'register' | 'quote_request' | 'contact';

interface UseRecaptchaReturn {
  executeRecaptcha: (action: RecaptchaAction) => Promise<string | null>;
  isReady: boolean;
  isEnabled: boolean;
}

/**
 * Hook to use reCAPTCHA v3
 *
 * @example
 * const { executeRecaptcha, isReady } = useRecaptcha();
 *
 * const handleSubmit = async (data) => {
 *   const token = await executeRecaptcha('login');
 *   // Send token with form data to backend for verification
 * };
 */
export function useRecaptcha(): UseRecaptchaReturn {
  const [isReady, setIsReady] = useState(false);
  const isEnabled = isRecaptchaConfigured(RECAPTCHA_SITE_KEY);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    // Check if script is already loaded
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => setIsReady(true));
      return;
    }

    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      window.grecaptcha.ready(() => setIsReady(true));
    };

    script.onerror = () => {
      console.error('Failed to load reCAPTCHA script');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup is not needed as script should persist
    };
  }, [isEnabled]);

  const executeRecaptcha = useCallback(
    async (action: RecaptchaAction): Promise<string | null> => {
      if (!isEnabled) {
        // reCAPTCHA not configured, skip verification
        return null;
      }

      if (!isReady || !window.grecaptcha) {
        console.warn('reCAPTCHA not ready yet');
        return null;
      }

      try {
        const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
        return token;
      } catch (error) {
        console.error('reCAPTCHA execution failed:', error);
        return null;
      }
    },
    [isReady, isEnabled]
  );

  return {
    executeRecaptcha,
    isReady,
    isEnabled,
  };
}
