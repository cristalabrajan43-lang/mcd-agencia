'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { useCookieConsent } from '@/contexts/CookieConsentContext';
import { useLegalModal } from '@/contexts/LegalModalContext';

/**
 * GDPR / LFPDPPP compliant cookie consent banner.
 * Shows at the bottom of the screen until the user makes a choice.
 * Preferences are persisted in localStorage (no cookie needed for that).
 */
export function CookieConsentBanner() {
  const { consent, acceptAll, rejectAll, savePreferences } = useCookieConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const locale = useLocale();
  const { openPrivacy } = useLegalModal();

  // Already consented → don't render
  if (consent !== null) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[200] p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-5 sm:p-6">
        {/* Main banner */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden>🍪</span>
            <div className="flex-1 space-y-2">
              <h3 className="text-white font-semibold text-base">
                {locale === 'es' ? 'Usamos cookies' : 'We use cookies'}
              </h3>
              <p className="text-sm text-neutral-300 leading-relaxed">
                {locale === 'es'
                  ? 'Utilizamos cookies propias y de terceros para analizar el uso del sitio y mejorar tu experiencia. Puedes aceptar todas, rechazar las no esenciales o personalizar tu elección.'
                  : 'We use our own and third-party cookies to analyze site usage and improve your experience. You can accept all, reject non-essential ones, or customize your choice.'}
                {' '}
                <button
                  type="button"
                  onClick={openPrivacy}
                  className="text-cmyk-cyan hover:underline"
                >
                  {locale === 'es' ? 'Aviso de privacidad' : 'Privacy policy'}
                </button>
              </p>
            </div>
          </div>

          {/* Expandable detail panel */}
          {showDetails && (
            <div className="space-y-3 pt-3 border-t border-neutral-700">
              {/* Necessary — always on */}
              <label className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-medium text-white">
                    {locale === 'es' ? 'Esenciales' : 'Essential'}
                  </span>
                  <p className="text-xs text-neutral-400">
                    {locale === 'es'
                      ? 'Sesión, carrito, idioma. Siempre activas.'
                      : 'Session, cart, language. Always active.'}
                  </p>
                </div>
                <div className="w-10 h-6 bg-cmyk-cyan/30 rounded-full flex items-center justify-end px-0.5 cursor-not-allowed">
                  <div className="w-5 h-5 bg-cmyk-cyan rounded-full" />
                </div>
              </label>

              {/* Analytics */}
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-white">
                    {locale === 'es' ? 'Analíticas' : 'Analytics'}
                  </span>
                  <p className="text-xs text-neutral-400">
                    {locale === 'es'
                      ? 'Google Analytics, Microsoft Clarity. Nos ayudan a mejorar el sitio.'
                      : 'Google Analytics, Microsoft Clarity. Help us improve the site.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analytics}
                  onClick={() => setAnalytics(!analytics)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${analytics ? 'bg-cmyk-cyan' : 'bg-neutral-600'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${analytics ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </button>
              </label>

              {/* Marketing */}
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-white">
                    {locale === 'es' ? 'Marketing' : 'Marketing'}
                  </span>
                  <p className="text-xs text-neutral-400">
                    {locale === 'es'
                      ? 'Facebook Pixel, Google Ads. Para anuncios personalizados.'
                      : 'Facebook Pixel, Google Ads. For personalized ads.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={marketing}
                  onClick={() => setMarketing(!marketing)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${marketing ? 'bg-cmyk-cyan' : 'bg-neutral-600'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${marketing ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </button>
              </label>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={acceptAll}
              className="flex-1 px-4 py-2.5 bg-cmyk-cyan text-black font-semibold rounded-lg hover:bg-cmyk-cyan/90 transition-colors text-sm"
            >
              {locale === 'es' ? 'Aceptar todas' : 'Accept all'}
            </button>

            {showDetails ? (
              <button
                onClick={() => savePreferences({ analytics, marketing })}
                className="flex-1 px-4 py-2.5 border border-cmyk-cyan text-cmyk-cyan font-semibold rounded-lg hover:bg-cmyk-cyan/10 transition-colors text-sm"
              >
                {locale === 'es' ? 'Guardar selección' : 'Save selection'}
              </button>
            ) : (
              <button
                onClick={() => setShowDetails(true)}
                className="flex-1 px-4 py-2.5 border border-neutral-600 text-neutral-300 font-semibold rounded-lg hover:bg-neutral-800 transition-colors text-sm"
              >
                {locale === 'es' ? 'Personalizar' : 'Customize'}
              </button>
            )}

            <button
              onClick={rejectAll}
              className="flex-1 px-4 py-2.5 text-neutral-400 hover:text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors text-sm"
            >
              {locale === 'es' ? 'Solo esenciales' : 'Essential only'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
