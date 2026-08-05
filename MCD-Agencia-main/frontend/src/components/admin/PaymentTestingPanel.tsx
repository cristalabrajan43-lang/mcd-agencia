'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

import {
  paymentTestingService,
  PaymentInitiationResponse,
  TestPaymentResult,
  MockPaymentsList,
} from '@/lib/api/payment-testing';
import { Card, Button, Badge } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { formatPrice, cn } from '@/lib/utils';

/**
 * Payment Testing Panel
 * 
 * Admin-only component for testing payment flows manually.
 * Allows creating test orders, initiating payments, and simulating payment states.
 * 
 * Features:
 *   - Create test orders with custom amounts
 *   - Initiate payments with different providers (MP, PayPal)
 *   - Simulate approved/rejected payments
 *   - View all mock payments in current session
 *   - Full audit trail of all test transactions
 */
export function PaymentTestingPanel() {
  const permissions = usePermissions();
  const [isExpanded, setIsExpanded] = useState(false);
  const [testAmount, setTestAmount] = useState('1500');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'mercadopago' | 'paypal'>(
    'mercadopago'
  );
  const [selectedPaymentForAction, setSelectedPaymentForAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'active' | 'mock'>('create');

  // Get mock payments
  const { data: mockPayments, refetch: refetchMock, isLoading: isMockLoading, isError: isMockError } = useQuery({
    queryKey: ['mock-payments'],
    queryFn: () => paymentTestingService.getMockPayments(),
    enabled: permissions.isAdmin && activeTab === 'mock',
    refetchInterval: 3000, // Auto-refresh every 3s
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Create test order
  const createOrderMutation = useMutation({
    mutationFn: () => paymentTestingService.createTestOrder(parseFloat(testAmount)),
    onSuccess: (order) => {
      toast.success(`Order created: ${order.order_number}`);
      setTestAmount('1500');
      // Auto-initiate payment
      setTimeout(() => {
        initiatePaymentMutation.mutate(order.id);
      }, 500);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create order');
    },
  });

  // Create test quote
  const createQuoteMutation = useMutation({
    mutationFn: () => paymentTestingService.createTestQuote(parseFloat(testAmount)),
    onSuccess: (quote) => {
      toast.success(`Quote created: ${quote.quote_number}`);
      setTestAmount('2500');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create quote');
    },
  });

  // Initiate payment
  const initiatePaymentMutation = useMutation({
    mutationFn: (orderId: string) =>
      paymentTestingService.initiateTestPayment(orderId, selectedPaymentMethod),
    onSuccess: (payment: PaymentInitiationResponse) => {
      toast.success(`Payment initiated: ${payment.payment_id}`);
      setSelectedPaymentForAction(payment.payment_id);
      setActiveTab('active');
      if (payment.init_point) {
        console.log('Mercado Pago checkout URL:', payment.init_point);
      }
      if (payment.approval_url) {
        console.log('PayPal approval URL:', payment.approval_url);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to initiate payment');
    },
  });

  // Simulate approved
  const simulateApprovedMutation = useMutation({
    mutationFn: (paymentId: string) =>
      paymentTestingService.simulatePaymentApproved(paymentId),
    onSuccess: (payment: TestPaymentResult) => {
      toast.success(`Payment approved! Order: ${payment.order?.order_number}`);
      setSelectedPaymentForAction(null);
      refetchMock();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve payment');
    },
  });

  // Simulate rejected
  const simulateRejectedMutation = useMutation({
    mutationFn: (paymentId: string) =>
      paymentTestingService.simulatePaymentRejected(paymentId, 'declined'),
    onSuccess: (payment: TestPaymentResult) => {
      toast.success(`Payment rejected. Reason: ${payment.error_message}`);
      setSelectedPaymentForAction(null);
      refetchMock();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject payment');
    },
  });

  if (!permissions.isAdmin) {
    return null;
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110"
        title="Open Payment Testing Panel"
      >
        <CreditCardIcon className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-full max-w-2xl max-h-[80vh] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCardIcon className="w-5 h-5 text-white" />
          <h2 className="text-white font-bold">💳 Payment Testing Panel</h2>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-white hover:bg-blue-500 p-1 rounded"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('create')}
            className={cn(
              'px-4 py-2 font-medium border-b-2 transition-colors',
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Create Order
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              'px-4 py-2 font-medium border-b-2 transition-colors',
              activeTab === 'active'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Active Payments
          </button>
          <button
            onClick={() => setActiveTab('mock')}
            className={cn(
              'px-4 py-2 font-medium border-b-2 transition-colors',
              activeTab === 'mock'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Mock Payments
          </button>
        </div>

        {/* Create Tab */}
        {activeTab === 'create' && (
          <div className="space-y-4">
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex gap-2 items-start">
                <ExclamationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold">Testing Mode</p>
                  <p>Create test orders and simulate payment flows. No real charges.</p>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Test Amount (MXN)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="1500"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 caret-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Payment Method
              </label>
              <div className="flex gap-2">
                {(['mercadopago', 'paypal'] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-md border-2 font-medium transition-colors',
                      selectedPaymentMethod === method
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    )}
                  >
                    {method === 'mercadopago' ? 'MP' : 'PayPal'}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => createOrderMutation.mutate()}
              disabled={createOrderMutation.isPending || !testAmount || Number(testAmount) <= 0}
              className="w-full"
              variant="primary"
            >
              {createOrderMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create Test Order & Pay
                </>
              )}
            </Button>
          </div>
        )}

        {/* Active Tab */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {selectedPaymentForAction ? (
              <Card className="p-4 bg-yellow-50 border-yellow-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">Payment Selected</p>
                      <p className="text-sm text-gray-600">{selectedPaymentForAction}</p>
                    </div>
                    <button
                      onClick={() => setSelectedPaymentForAction(null)}
                      className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1 hover:bg-yellow-100 rounded"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        simulateApprovedMutation.mutate(selectedPaymentForAction)
                      }
                      disabled={simulateApprovedMutation.isPending}
                      className="flex-1"
                      variant="primary"
                    >
                      {simulateApprovedMutation.isPending ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="w-4 h-4 mr-2" />
                          Simulate Approved
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() =>
                        simulateRejectedMutation.mutate(selectedPaymentForAction)
                      }
                      disabled={simulateRejectedMutation.isPending}
                      className="flex-1"
                      variant="danger"
                    >
                      {simulateRejectedMutation.isPending ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="w-4 h-4 mr-2" />
                          Simulate Rejected
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-4 bg-gray-50">
                <p className="text-gray-600 text-center">
                  Create an order first to see active payments here
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Mock Payments Tab */}
        {activeTab === 'mock' && (
          <div className="space-y-4">
            {isMockLoading && (
              <div className="flex items-center justify-center py-8">
                <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}

            {isMockError && (
              <Card className="p-4 bg-red-50 border-red-200">
                <div className="text-center space-y-2">
                  <p className="text-red-700 text-sm">
                    No se pudo cargar mock payments.
                  </p>
                  <Button variant="outline" onClick={() => refetchMock()}>
                    Reintentar
                  </Button>
                </div>
              </Card>
            )}

            {!isMockLoading && !isMockError && mockPayments && mockPayments.count === 0 && (
              <Card className="p-4 bg-gray-50">
                <p className="text-gray-600 text-center">No mock payments yet</p>
              </Card>
            )}

            {!isMockLoading && !isMockError && mockPayments && mockPayments.count > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  {mockPayments.count} mock payment{mockPayments.count !== 1 ? 's' : ''} in session
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {mockPayments.payments.map((payment) => (
                    <div
                      key={payment.id}
                      onClick={() => setSelectedPaymentForAction(payment.id)}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm cursor-pointer hover:border-gray-400 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-mono text-gray-700">{payment.id}</p>
                          <p className="text-xs text-gray-500">
                            {formatPrice(payment.amount)} · {payment.currency}
                          </p>
                        </div>
                        <Badge
                          variant={
                            payment.status === 'approved'
                              ? 'success'
                              : payment.status === 'rejected'
                                ? 'error'
                                : 'warning'
                          }
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 text-xs text-gray-500">
        <p>⚠️ This panel is for development/testing only. All data is simulated.</p>
      </div>
    </div>
  );
}

export default PaymentTestingPanel;
