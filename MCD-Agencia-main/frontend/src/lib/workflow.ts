export const MANUAL_PAYMENT_METHODS = ['bank_transfer', 'cash'] as const;
export const ONLINE_PAYMENT_METHODS = ['mercadopago', 'paypal'] as const;

export function normalizePaymentMethod(paymentMethod?: string | null): string {
  const raw = String(paymentMethod || '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    mercado_pago: 'mercadopago',
    'mercado pago': 'mercadopago',
    paypal: 'paypal',
    bank_transfer: 'bank_transfer',
    'bank transfer': 'bank_transfer',
    transferencia: 'bank_transfer',
    transfer: 'bank_transfer',
    cash: 'cash',
    efectivo: 'cash',
  };
  return aliases[raw] || raw;
}

export function requiresManualPayment(paymentMethod?: string | null): boolean {
  const normalized = normalizePaymentMethod(paymentMethod);
  return !!normalized && MANUAL_PAYMENT_METHODS.includes(normalized as (typeof MANUAL_PAYMENT_METHODS)[number]);
}

export function isOnlinePayment(paymentMethod?: string | null): boolean {
  const normalized = normalizePaymentMethod(paymentMethod);
  return !!normalized && ONLINE_PAYMENT_METHODS.includes(normalized as (typeof ONLINE_PAYMENT_METHODS)[number]);
}

export function getWorkflowStatus(status: string, paymentMethod?: string | null): string {
  if (status === 'pending_payment' && isOnlinePayment(paymentMethod)) {
    return 'paid';
  }
  return status;
}

export function getDefaultQuoteConversionPaymentMethod(paymentMethods?: string[]): 'mercadopago' | 'paypal' | 'bank_transfer' | 'cash' {
  const normalized = (paymentMethods || []).map((method) => method.trim().toLowerCase());
  if (normalized.includes('mercadopago')) return 'mercadopago';
  if (normalized.includes('paypal')) return 'paypal';
  if (normalized.includes('bank_transfer') || normalized.includes('transferencia')) return 'bank_transfer';
  if (normalized.includes('cash') || normalized.includes('efectivo')) return 'cash';
  return 'bank_transfer';
}

export function getPaymentMethodLabel(paymentMethod?: string | null): string {
  switch (normalizePaymentMethod(paymentMethod)) {
    case 'mercadopago':
      return 'Mercado Pago';
    case 'paypal':
      return 'PayPal';
    case 'bank_transfer':
      return 'Transferencia';
    case 'cash':
      return 'Efectivo';
    default:
      return paymentMethod || 'No especificado';
  }
}
