'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ConsentPreferences {
  /** Always true – required for login, cart, language, etc. */
  necessary: true;
  /** Google Analytics 4, Microsoft Clarity, page-view events */
  analytics: boolean;
  /** Facebook Pixel, Google Ads, remarketing */
  marketing: boolean;
}

interface CookieConsentContextType {
  /** null = user hasn't decided yet (show banner) */
  consent: ConsentPreferences | null;
  /** Has the user made any choice? */
  hasConsented: boolean;
  /** Accept all categories */
  acceptAll: () => void;
  /** Reject non-essential (only necessary) */
  rejectAll: () => void;
  /** Save custom preferences */
  savePreferences: (prefs: Omit<ConsentPreferences, 'necessary'>) => void;
  /** Re-open preferences (e.g. from footer link) */
  resetConsent: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mcd_cookie_consent';
const CONSENT_VERSION = 1; // bump when policy changes to re-ask

interface StoredConsent {
  version: number;
  preferences: ConsentPreferences;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentPreferences | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored: StoredConsent = JSON.parse(raw);
        if (stored.version === CONSENT_VERSION) {
          setConsent(stored.preferences);
        }
        // If version mismatch, consent stays null → banner shows again
      }
    } catch {
      // Corrupt data — ignore
    }
    setLoaded(true);
  }, []);

  const persist = useCallback((prefs: ConsentPreferences) => {
    const stored: StoredConsent = {
      version: CONSENT_VERSION,
      preferences: prefs,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setConsent(prefs);
  }, []);

  const acceptAll = useCallback(() => {
    persist({ necessary: true, analytics: true, marketing: true });
  }, [persist]);

  const rejectAll = useCallback(() => {
    persist({ necessary: true, analytics: false, marketing: false });
  }, [persist]);

  const savePreferences = useCallback(
    (prefs: Omit<ConsentPreferences, 'necessary'>) => {
      persist({ necessary: true, ...prefs });
    },
    [persist],
  );

  const resetConsent = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConsent(null);
  }, []);

  // Don't render children until we've checked localStorage (prevents flash)
  if (!loaded) return null;

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        hasConsented: consent !== null,
        acceptAll,
        rejectAll,
        savePreferences,
        resetConsent,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used within CookieConsentProvider');
  return ctx;
}
