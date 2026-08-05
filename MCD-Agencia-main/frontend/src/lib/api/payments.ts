/**
 * Payments API Service for MCD-Agencia.
 *
 * This module provides payment-related API calls:
 *   - Payment initiation
 *   - Payment status
 *   - Payment history
 */

import { apiClient } from './client';

// Types
export interface PaymentProvider {
  id: 'mercadopago' | 'paypal';
  name: string;
  enabled: boolean;
}

export interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
  public_key: string;
}

export interface PayPalOrder {
  id: string;
  status: string;
  approval_url: string;
  client_id: string;
}

export interface Payment {
  id: string;
  order_id: string;
  provider: 'mercadopago' | 'paypal';
  amount: string;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  external_id?: string;
  paid_at?: string;
  created_at: string;
}

export interface PaymentSummary {
  total_payments: number;
  total_amount: string;
  completed_payments: number;
  completed_amount: string;
  pending_payments: number;
  pending_amount: string;
}

// API Functions

/**
 * Initiate a MercadoPago payment.
 */
export async function initiateMercadoPagoPayment(orderId: string): Promise<MercadoPagoPreference> {
  return apiClient.post<MercadoPagoPreference>('/payments/initiate/', {
    order_id: orderId,
    provider: 'mercadopago',
  });
}

/**
 * Initiate a PayPal payment.
 */
export async function initiatePayPalPayment(orderId: string): Promise<PayPalOrder> {
  return apiClient.post<PayPalOrder>('/payments/initiate/', {
    order_id: orderId,
    provider: 'paypal',
  });
}

/**
 * Capture a PayPal payment after approval.
 */
export async function capturePayPalPayment(paypalOrderId: string): Promise<Payment> {
  return apiClient.post<Payment>('/payments/paypal/capture/', {
    paypal_order_id: paypalOrderId,
  });
}

/**
 * Get payment by ID.
 */
export async function getPayment(paymentId: string): Promise<Payment> {
  return apiClient.get<Payment>(`/payments/${paymentId}/`);
}

/**
 * Get payments for an order.
 */
export async function getOrderPayments(orderId: string): Promise<Payment[]> {
  return apiClient.get<Payment[]>('/payments/', { order_id: orderId });
}

/**
 * Get payment summary (admin).
 */
export async function getPaymentSummary(filters?: {
  start_date?: string;
  end_date?: string;
}): Promise<PaymentSummary> {
  return apiClient.get<PaymentSummary>('/payments/summary/', filters);
}
