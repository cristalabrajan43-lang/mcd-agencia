/**
 * Next.js Middleware for MCD-Agencia
 *
 * This middleware handles:
 * - Locale detection and routing
 * - Redirect to localized paths
 *
 * @module middleware
 */

import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

/**
 * Internationalization middleware configuration.
 *
 * - Detects user's preferred locale from Accept-Language header
 * - Redirects to localized paths (/es/... or /en/...)
 * - Falls back to default locale (es)
 */
export default createMiddleware({
  // Supported locales
  locales,

  // Default locale when none is detected
  defaultLocale,

  // Always show locale prefix in URL
  localePrefix: 'always',

  // Locale detection strategy
  localeDetection: true,
});

/**
 * Matcher configuration.
 *
 * Excludes:
 * - API routes
 * - Static files
 * - Images
 * - Favicon
 * - Auth callback routes
 */
export const config = {
  matcher: [
    // Match all pathnames except for:
    // - API routes (/api/...)
    // - Static files (/_next/...)
    // - Public files (/favicon.ico, /images/..., etc.)
    // - Auth callback routes (/auth/...)
    '/((?!api|_next|_vercel|auth|.*\\..*).*)',
  ],
};
