'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { CONTACT_INFO } from '@/lib/constants';
import { SERVICE_IDS } from '@/lib/service-ids';
import { useCookieConsent } from '@/contexts/CookieConsentContext';
import { useLegalModal } from '@/contexts/LegalModalContext';
import { usePathname } from 'next/navigation';

const SOCIAL_LINKS = {
  facebookAcapulco: 'https://www.facebook.com/AgenciaMCDAcapulco',
  facebookTecoanapa: 'https://www.facebook.com/profile.php?id=61566807611080',
  instagram: 'https://www.instagram.com/elpulpograficodiamante',
  twitter: 'https://x.com/AgenciaMCD',
};

const ABOUT_VALUES = [
  { icon: '👑', key: 'leadership' },
  { icon: '🤝', key: 'commitment' },
  { icon: '💡', key: 'innovation' },
  { icon: '🎯', key: 'customerFocus' },
  { icon: '⭐', key: 'quality' },
];

export function Footer() {
  const t = useTranslations('landing.footer');
  const tServices = useTranslations('landing.services');
  const tAbout = useTranslations('landing.aboutUs');
  const locale = useLocale();
  const { resetConsent } = useCookieConsent();
  const { openPrivacy, openTerms } = useLegalModal();
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();
  // Show "About Us" section only on the landing page (e.g. /es or /en)
  const isLanding = /^\/[a-z]{2}\/?$/.test(pathname);

  return (
    <footer className="bg-secondary text-white">
      {/* ─── About Us compact section (landing page only) ─────────────── */}
      {isLanding && (
      <div className="container-custom pt-10 sm:pt-14 pb-6 sm:pb-8 border-b border-gray-700">
        <div className="text-center max-w-3xl mx-auto mb-6">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3">
            {tAbout('title')}
          </h3>
          <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
            {tAbout('description')}
          </p>
        </div>

        {/* Mission & Vision inline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-6">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-800/40 border border-cmyk-cyan/20">
            <span className="text-xl flex-shrink-0">🚀</span>
            <div>
              <h4 className="text-sm font-bold text-cmyk-cyan mb-1">{tAbout('mission.title')}</h4>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{tAbout('mission.description')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-800/40 border border-cmyk-magenta/20">
            <span className="text-xl flex-shrink-0">🌟</span>
            <div>
              <h4 className="text-sm font-bold text-cmyk-magenta mb-1">{tAbout('vision.title')}</h4>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{tAbout('vision.description')}</p>
            </div>
          </div>
        </div>

        {/* Values - compact row */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {ABOUT_VALUES.map((value) => (
            <div key={value.key} className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-300">
              <span>{value.icon}</span>
              <span>{tAbout(`values.items.${value.key}`)}</span>
            </div>
          ))}
        </div>
      </div>
      )}
      <div className="container-custom py-8 sm:py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-2 mb-2 sm:mb-3">
              <div className="w-32 sm:w-36 h-10 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="Agencia MCD Logo"
                  width={140}
                  height={70}
                  className="object-contain"
                />
              </div>
              <div>
                <span className="text-sm sm:text-lg font-bold">Agencia MCD</span>
                <p className="text-xs text-gray-400">Acapulco</p>
              </div>
            </div>
            <p className="text-gray-400 mb-3 sm:mb-4 text-xs sm:text-sm">
              {t('description')}
            </p>
            
            {/* Redes sociales Acapulco */}
            <div className="mb-3">
              <p className="text-xs text-cmyk-cyan font-semibold mb-2">{t('acapulco')}</p>
              <div className="flex flex-wrap gap-2">
                {/* WhatsApp */}
                <a
                  href={CONTACT_INFO.whatsapp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-green-500 transition-colors"
                  aria-label="WhatsApp"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </a>
                {/* Facebook Acapulco */}
                <a
                  href={SOCIAL_LINKS.facebookAcapulco}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-cmyk-cyan transition-colors"
                  aria-label="Facebook Acapulco"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                {/* Instagram */}
                <a
                  href={SOCIAL_LINKS.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-pink-500 transition-colors"
                  aria-label="Instagram"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                {/* X (Twitter) */}
                <a
                  href={SOCIAL_LINKS.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="X (Twitter)"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Redes sociales Tecoanapa */}
            <div className="mb-3">
              <p className="text-xs text-cmyk-magenta font-semibold mb-2">{t('tecoanapa')}</p>
              <div className="flex flex-wrap gap-2">
                {/* WhatsApp Tecoanapa */}
                <a
                  href="https://wa.me/527451147727"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-green-500 transition-colors"
                  aria-label="WhatsApp Tecoanapa"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </a>
                {/* Facebook Tecoanapa */}
                <a
                  href={SOCIAL_LINKS.facebookTecoanapa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-cmyk-cyan transition-colors"
                  aria-label="Facebook Tecoanapa"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* YouTube - Coming Soon */}
            <div className="pt-2 border-t border-gray-700">
              <span
                className="text-gray-600 cursor-not-allowed flex items-center gap-1"
                title={t('comingSoon')}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span className="text-xs">{t('comingSoon')}</span>
              </span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm sm:text-base font-bold mb-2 sm:mb-3">{t('quickLinks')}</h4>
            <ul className="space-y-1 text-xs sm:text-sm">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  {t('nav.home')}
                </a>
              </li>
              <li>
                <a href="#servicios" className="text-gray-400 hover:text-white transition-colors">
                  {t('nav.services')}
                </a>
              </li>
              <li>
                <a href="#portafolio" className="text-gray-400 hover:text-white transition-colors">
                  {t('nav.portfolio')}
                </a>
              </li>
              <li>
                <a href="#clientes" className="text-gray-400 hover:text-white transition-colors">
                  {t('nav.clients')}
                </a>
              </li>
              <li>
                <a href="#ubicaciones" className="text-gray-400 hover:text-white transition-colors">
                  {t('nav.contact')}
                </a>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm sm:text-base font-bold mb-2 sm:mb-3">{t('services')}</h4>
            <ul className="space-y-1 text-xs sm:text-sm">
              {SERVICE_IDS.slice(0, 5).map((serviceId) => (
                <li key={serviceId}>
                  <a
                    href="#servicios"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {tServices(`items.${serviceId}.title`)}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#servicios"
                  className="text-cmyk-cyan hover:text-white transition-colors font-medium"
                >
                  {t('viewAllServices')}
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm sm:text-base font-bold mb-2 sm:mb-3">{t('contact')}</h4>
            <ul className="space-y-1 sm:space-y-2 text-gray-400 text-xs sm:text-sm">
              <li className="flex items-start">
                <svg className="w-4 sm:w-5 h-4 sm:h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                </svg>
                <a href={CONTACT_INFO.whatsapp.url} className="hover:text-white transition-colors">
                  {CONTACT_INFO.whatsapp.number}
                </a>
              </li>
              <li className="flex items-start">
                <svg className="w-4 sm:w-5 h-4 sm:h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <a href={`mailto:${CONTACT_INFO.email}`} className="hover:text-white transition-colors break-all">
                  {CONTACT_INFO.email}
                </a>
              </li>
              <li className="flex items-start">
                <svg className="w-4 sm:w-5 h-4 sm:h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span>{CONTACT_INFO.location}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-6 sm:mt-8 md:mt-12 pt-4 sm:pt-6 md:pt-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-2 sm:space-y-0 text-xs sm:text-sm">
            <div className="text-gray-400">
              {t('copyright', { year: currentYear })}
            </div>
            <div className="flex space-x-4 sm:ml-6">
              <button
                onClick={openPrivacy}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {t('privacy')}
              </button>
              <button
                onClick={() => resetConsent()}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Cookies
              </button>
              <button
                onClick={openTerms}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {t('terms')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
