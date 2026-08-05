/**
 * Inventory API Service for MCD-Agencia.
 *
 * This module provides inventory-related API calls:
 *   - Stock movements (IN, OUT, ADJUSTMENT)
 *   - Stock alerts
 *   - Reports (summary, low-stock, value)
 */

import { apiClient } from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockMovement {
  id: string;
  variant: {
    id: string;
    sku: string;
    name: string;
    product_name?: string;
  };
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  reason_display?: string;
  reference_type: string;
  reference_id: string;
  notes: string;
  stock_before: number;
  stock_after: number;
  created_by?: {
    id: string;
    email: string;
    full_name?: string;
  };
  created_at: string;
}

export interface CreateMovementData {
  variant_id: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  notes?: string;
  reference_type?: string;
  reference_id?: string;
}

export interface StockAlert {
  id: string;
  variant: {
    id: string;
    sku: string;
    name: string;
    product_name?: string;
  };
  threshold: number;
  current_stock: number;
  status: 'pending' | 'acknowledged' | 'resolved';
  acknowledged_by?: {
    id: string;
    email: string;
    full_name?: string;
  };
  acknowledged_at?: string;
  resolved_at?: string;
  created_at: string;
}

export interface StockSummaryItem {
  variant_id: string;
  product_id: string;
  product_slug: string;
  sku: string;
  product_name: string;
  variant_name: string;
  item_type: 'product' | 'service';
  item_type_display: string;
  sale_mode: 'BUY' | 'QUOTE' | 'HYBRID';
  sale_mode_display: string;
  cost: string | number;
  sale_price: string | number;
  current_stock: number;
  initial_stock: number;
  total_in: number;
  total_out: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  stock_status: 'out_of_stock' | 'low_stock' | 'in_stock';
  stock_status_display: string;
  last_movement_date: string | null;
}

export interface LowStockReport {
  count: number;
  items: Array<{
    variant_id: string;
    sku: string;
    product_name: string;
    variant_name: string;
    current_stock: number;
    low_stock_threshold: number;
    is_out_of_stock: boolean;
  }>;
}

export interface InventoryValueReport {
  total_value: number;
  total_items: number;
  by_category: Record<string, { value: number; items: number }>;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AlertCounts {
  active: number;
  acknowledged: number;
  resolved: number;
}

// ── Movement API ───────────────────────────────────────────────────────────

/**
 * Get stock movements with optional filters.
 */
export async function getMovements(filters?: {
  movement_type?: string;
  reason?: string;
  variant?: string;
  page?: number;
}): Promise<PaginatedResponse<StockMovement>> {
  return apiClient.get<PaginatedResponse<StockMovement>>('/inventory/movements/', filters);
}

/**
 * Get movements for a specific variant.
 */
export async function getMovementsByVariant(variantId: string): Promise<PaginatedResponse<StockMovement>> {
  return apiClient.get<PaginatedResponse<StockMovement>>('/inventory/movements/by_variant/', { variant_id: variantId });
}

/**
 * Create a stock movement (IN, OUT, ADJUSTMENT).
 */
export async function createMovement(data: CreateMovementData): Promise<StockMovement> {
  return apiClient.post<StockMovement>('/inventory/movements/', data);
}

// ── Alert API ──────────────────────────────────────────────────────────────

/**
 * Get stock alerts with optional status filter.
 */
export async function getAlerts(filters?: {
  status?: string;
  page?: number;
}): Promise<PaginatedResponse<StockAlert>> {
  return apiClient.get<PaginatedResponse<StockAlert>>('/inventory/alerts/', filters);
}

/**
 * Get active alerts only.
 */
export async function getActiveAlerts(): Promise<StockAlert[]> {
  return apiClient.get<StockAlert[]>('/inventory/alerts/active/');
}

/**
 * Get alert count by status.
 */
export async function getAlertCounts(): Promise<AlertCounts> {
  return apiClient.get<AlertCounts>('/inventory/alerts/count/');
}

/**
 * Acknowledge an alert.
 */
export async function acknowledgeAlert(id: string): Promise<StockAlert> {
  return apiClient.post<StockAlert>(`/inventory/alerts/${id}/acknowledge/`);
}

/**
 * Resolve an alert.
 */
export async function resolveAlert(id: string): Promise<StockAlert> {
  return apiClient.post<StockAlert>(`/inventory/alerts/${id}/resolve/`);
}

// ── Reports ────────────────────────────────────────────────────────────────

/**
 * Get stock summary report.
 */
export async function getStockSummary(): Promise<StockSummaryItem[]> {
  return apiClient.get<StockSummaryItem[]>('/inventory/summary/');
}

/**
 * Get low-stock report.
 */
export async function getLowStockReport(): Promise<LowStockReport> {
  return apiClient.get<LowStockReport>('/inventory/low-stock/');
}

/**
 * Get inventory value report.
 */
export async function getInventoryValueReport(): Promise<InventoryValueReport> {
  return apiClient.get<InventoryValueReport>('/inventory/value/');
}
