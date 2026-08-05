/**
 * Root Layout for MCD-Agencia
 *
 * This layout wraps all pages and provides:
 * - Internationalization context
 * - Global providers (React Query, Auth, etc.)
 * - Base HTML structure with SEO metadata
 * - Font loading
 *
 * @module app/[locale]/layout
 */

import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { Providers } from '@/components/providers';
import { ThemeScript } from '@/components/ThemeScript';
import { UnifiedHeader } from '@/components/UnifiedHeader';
import { Footer } from '@/components/landing/Footer';
import { FooterWrapper } from '@/components/FooterWrapper';
import { CookieConsentProvider } from '@/contexts/CookieConsentContext';
import { LegalModalProvider } from '@/contexts/LegalModalContext';
import { LegalModal } from '@/components/LegalModal';
import { AnalyticsScripts } from '@/components/AnalyticsScripts';
import { PageViewTracker } from '@/components/PageViewTracker';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { SpeedInsights } from '@vercel/speed-insights/next';
import '@/styles/globals.css';

// =============================================================================
// Fonts
// =============================================================================

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

// =============================================================================
// Supported Locales
// =============================================================================

const locales = ['es', 'en'];

// =============================================================================
// Metadata
// =============================================================================

export const metadata: Metadata = {
  title: {
    default: 'Agencia MCD',
    template: '%s | Agencia MCD',
  },
  description:
    'Soluciones integrales en medios impresos, señalética y publicidad exterior. Cotiza en línea o compra directamente. Servicio profesional en Acapulco y toda la República.',
  keywords: [
    'impresión gran formato',
    'publicidad exterior',
    'señalética',
    'rotulación',
    'vallas publicitarias',
    'Acapulco',
    'medios impresos',
  ],
  authors: [{ name: 'Agencia MCD' }],
  creator: 'Agencia MCD',
  publisher: 'Agencia MCD',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://agenciamcd.mx'),
  alternates: {
    canonical: '/',
    languages: {
      'es-MX': '/es',
      'en-US': '/en',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    alternateLocale: 'en_US',
    url: 'https://agenciamcd.mx',
    siteName: 'Agencia MCD',
    title: 'Agencia MCD | Medios Impresos y Publicidad Exterior',
    description:
      'Soluciones integrales en medios impresos, señalética y publicidad exterior.',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Agencia MCD - Medios Impresos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agencia MCD | Medios Impresos y Publicidad Exterior',
    description:
      'Soluciones integrales en medios impresos, señalética y publicidad exterior.',
    images: ['/images/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

// =============================================================================
// Viewport
// =============================================================================

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// =============================================================================
// Generate Static Params (for SSG)
// =============================================================================

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// =============================================================================
// Layout Props
// =============================================================================

interface RootLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

// =============================================================================
// Root Layout Component
// =============================================================================

export default async function RootLayout({
  children,
  params: { locale },
}: RootLayoutProps) {
  // Validate locale
  if (!locales.includes(locale)) {
    notFound();
  }

  // Load messages for the current locale
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${montserrat.variable} dark`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-white">
        <NextIntlClientProvider messages={messages}>
          <CookieConsentProvider>
          <LegalModalProvider>
          <Providers>
            {/* Analytics – loads scripts only when consent is given */}
            <AnalyticsScripts />
            <PageViewTracker />

            {/* Skip to content link for accessibility */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary-500 focus:px-4 focus:py-2 focus:text-black"
            >
              Skip to content
            </a>

            {/* Header */}
            <div className="layout-header">
              <UnifiedHeader />
            </div>

            {/* Main Content */}
            <main id="main-content" className="flex-1">
              {children}
            </main>

            {/* Footer — shifts right on dashboard so the fixed sidebar doesn't cover it */}
            <FooterWrapper>
              <div className="layout-footer">
                <Footer />
              </div>
            </FooterWrapper>

            {/* Cookie consent banner */}
            <CookieConsentBanner />

            {/* Legal modals (privacy + terms) — available from any page */}
            <LegalModal />

            {/* Vercel Speed Insights */}
            <SpeedInsights />
          </Providers>
          </LegalModalProvider>
          </CookieConsentProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
