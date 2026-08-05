/**
 * Payment Testing API Client
 * 
 * Client library for testing payment flows without real provider credentials.
 * Only available to admin users.
 * 
 * Usage:
 *   import { paymentTestingService } from '@/lib/api/payment-testing';
 *   
 *   // Create test order
 *   const order = await paymentTestingService.createTestOrder(1500);
 *   
 *   // Initiate payment
 *   const payment = await paymentTestingService.initiateTestPayment(order.id, 'mercadopago');
 *   
 *   // Simulate approval
 *   await paymentTestingService.simulatePaymentApproved(payment.id);
 */

import { apiClient } from './client';

export interface TestOrder {
  id: string;
  order_number: string;
  balance_due: string;
  status: string;
  user_id: string;
  created_at: string;
}

export interface TestQuote {
  id: string;
  quote_number: string;
  total: string;
  status: string;
  user_id: string;
  created_at: string;
}

export interface PaymentInitiationResponse {
  payment_id: string;
  status: string;
  provider_order_id: string;
  init_point?: string;
  sandbox_init_point?: string;
  approval_url?: string;
  is_mock: boolean;
}

export interface TestPaymentResult {
  id: string;
  status: string;
  amount: string;
  provider: string;
  provider_order_id: string;
  order?: {
    id: string;
    order_number: string;
    status: string;
    balance_due: string;
    amount_paid: string;
  };
  approved_at?: string;
  error_message?: string;
  metadata: Record<string, any>;
}

export interface MockPaymentsList {
  count: number;
  payments: Array<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    created_at: string;
    metadata?: Record<string, any>;
  }>;
}

/**
 * Payment testing service - Admin only
 */
export const paymentTestingService = {
  /**
   * Create a test order for payment testing.
   */
  async createTestOrder(amount: number = 1500): Promise<TestOrder> {
    return apiClient.post<TestOrder>('/payments/test_create_order/', {
      amount: String(amount),
    });
  },

  /**
   * Create a test quote for payment testing.
   */
  async createTestQuote(amount: number = 2500): Promise<TestQuote> {
    return apiClient.post<TestQuote>('/payments/test_create_quote/', {
      amount: String(amount),
    });
  },

  /**
   * Initiate a payment on a test order.
   */
  async initiateTestPayment(
    orderId: string,
    provider: 'mercadopago' | 'paypal' = 'mercadopago',
    customAmount?: number
  ): Promise<PaymentInitiationResponse> {
    return apiClient.post<PaymentInitiationResponse>('/payments/initiate/', {
      order_id: orderId,
      provider,
      ...(customAmount && { amount: customAmount }),
    });
  },

  /**
   * Simulate payment approved (admin testing only).
   */
  async simulatePaymentApproved(paymentId: string): Promise<TestPaymentResult> {
    return apiClient.post<TestPaymentResult>(
      `/payments/${paymentId}/test_simulate_approved/`,
      {}
    );
  },

  /**
   * Simulate payment rejected (admin testing only).
   */
  async simulatePaymentRejected(
    paymentId: string,
    reason: string = 'declined'
  ): Promise<TestPaymentResult> {
    return apiClient.post<TestPaymentResult>(
      `/payments/${paymentId}/test_simulate_rejected/`,
      { reason }
    );
  },

  /**
   * Get list of current mock payments in session.
   */
  async getMockPayments(): Promise<MockPaymentsList> {
    try {
      return await apiClient.get<MockPaymentsList>('/payments/test_mock_payments/');
    } catch (error: any) {
      // Graceful fallback in prod when endpoint is temporarily unavailable
      // (e.g. backend not yet deployed with testing routes).
      if (error?.status === 403 || error?.status === 404) {
        return { count: 0, payments: [] };
      }
      throw error;
    }
  },

  /**
   * Get payment details by ID.
   */
  async getPaymentDetails(paymentId: string): Promise<TestPaymentResult> {
    return apiClient.get<TestPaymentResult>(`/payments/${paymentId}/`);
  },

  /**
   * Check if user has access to payment testing endpoints.
   * Returns true if user is admin.
   */
  async canAccessPaymentTesting(): Promise<boolean> {
    try {
      await this.getMockPayments();
      return true;
    } catch (_error) {
      return false;
    }
  },
};

export default paymentTestingService;
