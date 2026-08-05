/**
 * Utility functions for MCD-Agencia
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price in MXN
 */
export function formatPrice(
  amount: string | number,
  options: {
    currency?: string;
    locale?: string;
    showCurrency?: boolean;
  } = {}
): string {
  const { currency = 'MXN', locale = 'es-MX', showCurrency = true } = options;
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numericAmount)) return '$0.00';

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);

  return showCurrency ? formatted : formatted.replace(/[A-Z$]/g, '').trim();
}

/**
 * Format date
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };
  return dateObj.toLocaleString('es-MX', defaultOptions);
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "hace 2 horas")
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  const intervals = [
    { label: 'año', seconds: 31536000 },
    { label: 'mes', seconds: 2592000 },
    { label: 'semana', seconds: 604800 },
    { label: 'día', seconds: 86400 },
    { label: 'hora', seconds: 3600 },
    { label: 'minuto', seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      const plural = count > 1 ? (interval.label === 'mes' ? 'es' : 's') : '';
      return `hace ${count} ${interval.label}${plural}`;
    }
  }

  return 'hace un momento';
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Slugify text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Debounce function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Mexican RFC format
 */
export function isValidRFC(rfc: string): boolean {
  // RFC format: 3-4 letters + 6 digits + 3 alphanumeric
  const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
  return rfcRegex.test(rfc);
}

/**
 * Validate Mexican phone number
 */
export function isValidMexicanPhone(phone: string): boolean {
  // Remove non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  // Mexican phones: 10 digits (with or without country code)
  return cleaned.length === 10 || (cleaned.length === 12 && cleaned.startsWith('52'));
}

/**
 * Format phone number
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Get order status color
 */
export function getOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-500',
    pending_payment: 'bg-cmyk-yellow',
    paid: 'bg-green-500',
    partially_paid: 'bg-cmyk-cyan',
    in_production: 'bg-purple-500',
    ready: 'bg-cmyk-cyan',
    in_delivery: 'bg-orange-500',
    completed: 'bg-green-600',
    cancelled: 'bg-red-500',
    refunded: 'bg-gray-400',
  };
  return colors[status] || 'bg-gray-500';
}

/**
 * Get quote status color
 */
export function getQuoteStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-500',
    in_review: 'bg-cmyk-yellow',
    sent: 'bg-cmyk-cyan',
    viewed: 'bg-purple-500',
    accepted: 'bg-green-500',
    rejected: 'bg-red-500',
    expired: 'bg-gray-400',
    converted: 'bg-cmyk-cyan',
  };
  return colors[status] || 'bg-gray-500';
}

/**
 * Calculate deposit amount
 */
export function calculateDeposit(
  total: number,
  depositPercentage?: number,
  depositAmount?: number
): number {
  if (depositAmount && depositAmount > 0) {
    return Math.min(depositAmount, total);
  }
  if (depositPercentage && depositPercentage > 0) {
    return (total * depositPercentage) / 100;
  }
  return total;
}

/**
 * Generate a random string (for temporary IDs)
 */
export function generateId(length: number = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

/**
 * Format currency (alias for formatPrice)
 */
export const formatCurrency = formatPrice;
