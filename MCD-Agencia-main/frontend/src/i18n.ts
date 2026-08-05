/**
 * Internationalization Configuration for MCD-Agencia
 *
 * This module configures next-intl for multi-language support.
 * Supports Spanish (es) and English (en).
 *
 * @module i18n
 */

import { getRequestConfig } from 'next-intl/server';

/**
 * Supported locales for the application.
 */
export const locales = ['es', 'en'] as const;

/**
 * Type for supported locales.
 */
export type Locale = (typeof locales)[number];

/**
 * Default locale for the application.
 */
export const defaultLocale: Locale = 'es';

/**
 * Get the request configuration for next-intl.
 * Loads messages for the requested locale.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale || defaultLocale;
  
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
