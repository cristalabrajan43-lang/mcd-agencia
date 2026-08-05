/**
 * Global Types for MCD-Agencia
 */

// Re-export all types from API modules
export * from '@/lib/api/auth';
export * from '@/lib/api/catalog';
export * from '@/lib/api/orders';
export * from '@/lib/api/quotes';

// Common types
export interface ApiError {
  message: string;
  status: number;
  data?: Record<string, unknown>;
}

export interface SelectOption {
  value: string;
  label: string;
}

// Locale types
export type Locale = 'es' | 'en';

// Price formatting
export interface PriceFormatOptions {
  currency?: string;
  locale?: string;
  showCurrency?: boolean;
}

// Form states
export type FormStatus = 'idle' | 'loading' | 'success' | 'error';

// Navigation
export interface BreadcrumbItem {
  label: string;
  href?: string;
}
