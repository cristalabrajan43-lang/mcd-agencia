/**
 * Orders API Service for MCD-Agencia.
 *
 * This module provides order-related API calls:
 *   - Cart management
 *   - Order creation
 *   - Order history
 *   - Address management
 */

import { apiClient } from './client';
import { ProductVariant, PaginatedResponse } from './catalog';

// Types
export interface CartItem {
  id: string;
  variant: ProductVariant;
  quantity: number;
  unit_price: string;
  line_total: string;
  product_name: string;
  product_slug?: string;
  product_image?: string | null;
  variant_display_name?: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  discount_amount?: number;
  total: string;
  item_count: number;
  updated_at: string;
}

export interface Address {
  id: string;
  type: 'shipping' | 'billing';
  is_default: boolean;
  name: string;
  phone: string;
  street: string;
  exterior_number: string;
  interior_number?: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  reference?: string;
  full_address: string;
}

export interface OrderLine {
  id: string;
  sku: string;
  name: string;
  variant_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  estimated_delivery_date?: string | null;
  metadata?: Record<string, unknown>;
}

export interface OrderStatusHistory {
  id: string;
  from_status: string;
  to_status: string;
  changed_by?: string;
  changed_by_name: string;
  notes?: string;
  created_at: string;
}

export interface OrderTrackingEvent {
  id: string;
  event_type: string;
  title: string;
  description: string;
  occurred_at: string | null;
  phase: 'completed' | 'current' | 'pending';
  metadata?: Record<string, unknown>;
}

export interface OrderTrackingTimeline {
  order_id: string;
  order_number: string;
  current_status: string;
  current_status_label: string;
  delivery_method?: string;
  tracking_number: string;
  tracking_url: string;
  events: OrderTrackingEvent[];
  pending_steps: OrderTrackingEvent[];
  is_terminal: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  quote?: string | null;
  status: string;
  status_display: string;
  shipping_address: string;
  billing_address: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  amount_paid: string;
  balance_due: string;
  is_fully_paid: boolean;
  currency: string;
  payment_method: string;
  notes?: string;
  tracking_number?: string;
  tracking_url?: string;
  delivery_method?: string;
  pickup_branch?: string;
  pickup_branch_detail?: {
    id: string;
    name: string;
    city: string;
    state: string;
    full_address: string;
  } | null;
  delivery_address?: Record<string, string>;
  scheduled_date?: string;
  lines: OrderLine[];
  status_history: OrderStatusHistory[];
  created_at: string;
  paid_at?: string;
  completed_at?: string;
}

export interface OrderListItem {
  id: string;
  order_number: string;
  status: string;
  status_display: string;
  total: string;
  amount_paid?: string;
  currency: string;
  payment_method?: string;
  payment_method_display?: string;
  item_count: number;
  customer?: {
    id: string;
    email: string;
    full_name: string;
  };
  created_at: string;
}

export interface CreateOrderData {
  shipping_address_id: string;
  billing_address_id?: string;
  use_shipping_as_billing?: boolean;
  payment_method: 'mercadopago' | 'paypal' | 'bank_transfer' | 'cash';
  delivery_method?: 'pickup' | 'shipping';
  pickup_branch_id?: string;
  shipping_fee?: string;
  notes?: string;
  terms_accepted: boolean;
}

// Cart API Functions

/**
 * Get current user's cart.
 */
export async function getCart(): Promise<Cart> {
  return apiClient.get<Cart>('/orders/cart/');
}

/**
 * Add item to cart.
 */
export async function addToCart(variantId: string, quantity: number = 1): Promise<Cart> {
  return apiClient.post<Cart>('/orders/cart/add/', {
    variant_id: variantId,
    quantity,
  });
}

/**
 * Update cart item quantity.
 */
export async function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
  return apiClient.put<Cart>(`/orders/cart/update/${itemId}/`, { quantity });
}

/**
 * Remove item from cart.
 */
export async function removeCartItem(itemId: string): Promise<Cart> {
  return apiClient.delete<Cart>(`/orders/cart/remove/${itemId}/`);
}

/**
 * Clear cart.
 */
export async function clearCart(): Promise<Cart> {
  return apiClient.delete<Cart>('/orders/cart/clear/');
}

/**
 * Guest cart item for localStorage.
 */
export interface GuestCartItem {
  variant_id: string;
  quantity: number;
}

/**
 * Merge guest cart items into user's cart after login.
 */
export async function mergeGuestCart(items: GuestCartItem[]): Promise<Cart> {
  return apiClient.post<Cart>('/orders/cart/merge/', { items });
}

// Address API Functions

/**
 * Get user's addresses.
 */
export async function getAddresses(): Promise<PaginatedResponse<Address>> {
  return apiClient.get<PaginatedResponse<Address>>('/orders/addresses/');
}

/**
 * Create a new address.
 */
export async function createAddress(data: Omit<Address, 'id' | 'full_address'>): Promise<Address> {
  return apiClient.post<Address>('/orders/addresses/', data);
}

/**
 * Update an address.
 */
export async function updateAddress(id: string, data: Partial<Address>): Promise<Address> {
  return apiClient.patch<Address>(`/orders/addresses/${id}/`, data);
}

/**
 * Delete an address.
 */
export async function deleteAddress(id: string): Promise<void> {
  return apiClient.delete(`/orders/addresses/${id}/`);
}

/**
 * Set address as default.
 */
export async function setDefaultAddress(id: string): Promise<Address> {
  return apiClient.post<Address>(`/orders/addresses/${id}/set_default/`);
}

// Order API Functions

/**
 * Get user's orders.
 */
export async function getOrders(filters?: { status?: string; page?: number }): Promise<PaginatedResponse<OrderListItem>> {
  return apiClient.get<PaginatedResponse<OrderListItem>>('/orders/', filters);
}

/**
 * Get order by ID.
 */
export async function getOrderById(id: string): Promise<Order> {
  return apiClient.get<Order>(`/orders/${id}/`);
}

/**
 * Get customer-visible tracking timeline for an order.
 */
export async function getOrderTracking(id: string): Promise<OrderTrackingTimeline> {
  return apiClient.get<OrderTrackingTimeline>(`/orders/${id}/tracking/`);
}

/**
 * Create order from cart.
 */
export async function createOrder(data: CreateOrderData): Promise<Order> {
  return apiClient.post<Order>('/orders/create_order/', data);
}

/**
 * Cancel an order.
 */
export async function cancelOrder(id: string): Promise<Order> {
  return apiClient.post<Order>(`/orders/${id}/cancel/`);
}

// Staff/Admin Order Functions

/**
 * Get all orders (staff only - admin and sales).
 */
export async function getStaffOrders(filters?: {
  status?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<OrderListItem>> {
  return apiClient.get<PaginatedResponse<OrderListItem>>('/admin/orders/', filters);
}

/**
 * Get order detail (staff).
 */
export async function getStaffOrderById(id: string): Promise<Order> {
  return apiClient.get<Order>(`/admin/orders/${id}/`);
}

/**
 * Update order status (staff).
 */
export async function updateOrderStatus(
  id: string,
  newStatus: string,
  notes?: string,
  scheduledDate?: string | null,
): Promise<Order> {
  return apiClient.post<Order>(`/admin/orders/${id}/update_status/`, {
    status: newStatus,
    notes,
    scheduled_date: scheduledDate ?? undefined,
  });
}

/**
 * Update estimated delivery date for one order line (staff).
 */
export async function updateOrderLineEstimatedDelivery(
  orderId: string,
  lineId: string,
  estimatedDeliveryDate: string | null,
): Promise<{ order_id: string; line_id: string; estimated_delivery_date: string | null }> {
  return apiClient.post(`/admin/orders/${orderId}/lines/${lineId}/estimated-delivery/`, {
    estimated_delivery_date: estimatedDeliveryDate,
  });
}

/**
 * Customer selects payment method for a pending order.
 */
export async function setOrderPaymentMethod(
  id: string,
  paymentMethod: 'mercadopago' | 'paypal' | 'bank_transfer' | 'cash'
): Promise<Order> {
  return apiClient.post<Order>(`/orders/${id}/set_payment_method/`, {
    payment_method: paymentMethod,
  });
}

/**
 * Convert an accepted quote to an order.
 */
export async function convertQuoteToOrder(
  quoteId: string,
  data?: { payment_method?: string; notes?: string }
): Promise<{ quote: unknown; order: Order }> {
  return apiClient.post(`/quotes/${quoteId}/convert_to_order/`, data || {});
}
