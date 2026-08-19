/**
 * Admin API Service for MCD-Agencia.
 *
 * This module provides admin-specific API calls.
 */

import { apiClient } from './client';
import { User } from './auth';
import { PaginatedResponse } from './catalog';
import { Order } from './orders';
import { QuoteRequest, Quote } from './quotes';

// Types
export interface AdminUser extends User {
  is_active: boolean;
  last_login?: string;
  orders_count: number;
  quotes_count: number;
  total_spent?: string;
  last_order_date?: string;
}

export interface AdminClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  total_orders: number;
  total_quotes: number;
  total_spent: string;
  last_order_date?: string;
  created_at: string;
}

export interface AdminOrder extends Order {
  customer: {
    id: string;
    email: string;
    full_name: string;
  };
}

export interface AdminQuoteRequest extends Omit<QuoteRequest, 'assigned_to'> {
  assigned_to?: {
    id: string;
    full_name: string;
  };
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor_email?: string;
  actor_name?: string;
  actor_ip?: string;
  actor_user_agent?: string;
  entity_type: string;
  entity_id: string;
  entity_repr?: string;
  action: string;
  action_display?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  diff?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface DashboardStats {
  orders: {
    total: number;
    pending: number;
    completed: number;
    revenue: string;
  };
  quotes: {
    total: number;
    pending: number;
    accepted: number;
    conversion_rate: number;
  };
  users: {
    total: number;
    new_this_month: number;
  };
  products: {
    total: number;
    low_stock: number;
  };
}

export interface WorkflowItem {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  status: string;
  status_display: string;
  payment_method?: string;
  delivery_method?: string;
  date?: string | null;
  date_label?: string;
  amount?: string | null;
  href: string;
  note?: string;
  start?: string | null;
  end?: string | null;
  is_range?: boolean;
}

// Operational Track Types
export interface ProductionJob {
  id: string;
  order_id: string;
  order_number: string;
  customer?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  product_name?: string;
  variant_name?: string;
  quantity?: number;
  status: string;
  status_display: string;
  planned_start?: string | null;
  planned_end?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  delivery_method?: string;
  estimated_delivery_date?: string | null;
  requires_quality_check?: boolean;
  assigned_to?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LogisticsJob {
  id: string;
  order_id: string;
  order_number: string;
  customer?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  status: string;
  status_display: string;
  delivery_method: string;
  delivery_method_display: string;
  window_start?: string | null;
  window_end?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  scheduled_date?: string | null;
  delivered_at?: string | null;
  tracking_number?: string | null;
  pickup_branch_detail?: {
    id: string;
    name: string;
    city: string;
    state: string;
    full_address: string;
  } | null;
  shipping_address?: {
    street: string;
    exterior_number: string;
    interior_number?: string;
    neighborhood: string;
    city: string;
    state: string;
    postal_code: string;
    reference?: string;
  } | null;
  assigned_to?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FieldOperationJob {
  id: string;
  order_id: string;
  order_number: string;
  status: string;
  status_display: string;
  operation_type: string;
  operation_type_display: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  assigned_to?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowOverview {
  generated_at: string;
  window_start: string;
  window_end: string;
  stats: {
    manual_payment_orders: number;
    in_production_orders: number;
    ready_orders: number;
    completed_orders: number;
    assigned_requests: number;
    pending_requests: number;
    calendar_items: number;
  };
  blocks: Record<'assigned' | 'to_pay' | 'in_production' | 'ready' | 'done' | 'quotes', WorkflowItem[]>;
  calendar_events: WorkflowItem[];
  quotes: Quote[];
  quote_requests: QuoteRequest[];
}

// User Management
export async function getAdminUsers(filters?: {
  role?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<AdminUser>> {
  return apiClient.get<PaginatedResponse<AdminUser>>('/admin/users/', filters);
}

export async function getAdminClients(filters?: {
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<AdminClient>> {
  return apiClient.get<PaginatedResponse<AdminClient>>('/admin/users/clients/', filters);
}

export async function getAdminUserById(id: string): Promise<AdminUser> {
  return apiClient.get<AdminUser>(`/admin/users/${id}/`);
}

export async function updateAdminUser(id: string, data: Partial<AdminUser>): Promise<AdminUser> {
  return apiClient.patch<AdminUser>(`/admin/users/${id}/`, data);
}

export async function deleteAdminUser(id: string): Promise<void> {
  return apiClient.delete<void>(`/admin/users/${id}/`);
}

export async function activateUser(id: string): Promise<AdminUser> {
  return apiClient.post<AdminUser>(`/admin/users/${id}/activate/`);
}

export async function deactivateUser(id: string): Promise<AdminUser> {
  return apiClient.post<AdminUser>(`/admin/users/${id}/deactivate/`);
}

export async function changeUserRole(id: string, roleId: string): Promise<AdminUser> {
  return apiClient.post<AdminUser>(`/admin/users/${id}/change_role/`, { role_id: roleId });
}

export async function assignUserGroup(
  id: string,
  group: 'production_supervisors' | 'operations_supervisors'
): Promise<{ message: string; user: AdminUser; groups: string[] }> {
  return apiClient.post(`/admin/users/${id}/assign_group/`, { group });
}

export async function createUserWithPassword(data: {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role_id?: string;
  groups?: string[];
}): Promise<{ message: string; email: string; success: boolean; email_sent?: boolean; temporary_password?: string; email_error?: string }> {
  return apiClient.post('/admin/users/create_with_password/', data);
}

// Order Management
export async function getAdminOrders(filters?: {
  status?: string;
  customer?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<AdminOrder>> {
  return apiClient.get<PaginatedResponse<AdminOrder>>('/admin/orders/', filters);
}

export async function getAdminOrderById(id: string): Promise<AdminOrder> {
  return apiClient.get<AdminOrder>(`/admin/orders/${id}/`);
}

export async function updateOrderStatus(
  id: string,
  status: string,
  notes?: string
): Promise<AdminOrder> {
  return apiClient.post<AdminOrder>(`/admin/orders/${id}/update_status/`, { status, notes });
}

export async function updateOrderTracking(
  id: string,
  data: {
    tracking_number?: string;
    tracking_url?: string;
    message?: string;
    title?: string;
  }
): Promise<{ order: AdminOrder; tracking: import('./orders').OrderTrackingTimeline }> {
  return apiClient.post(`/admin/orders/${id}/tracking-update/`, data);
}

// Quote Management
export async function getAdminQuoteRequests(filters?: {
  status?: string;
  assigned_to?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<AdminQuoteRequest>> {
  return apiClient.get<PaginatedResponse<AdminQuoteRequest>>('/admin/quote-requests/', filters);
}

export async function assignQuoteRequest(id: string, userId: string): Promise<AdminQuoteRequest> {
  return apiClient.post<AdminQuoteRequest>(`/admin/quote-requests/${id}/assign/`, { assigned_to_id: userId });
}

export async function createQuoteFromRequest(
  requestId: string,
  data: {
    lines: Array<{
      concept: string;
      description?: string;
      quantity: number;
      unit: string;
      unit_price: string;
    }>;
    valid_days: number;
    terms: string;
  }
): Promise<Quote> {
  return apiClient.post<Quote>(`/admin/quote-requests/${requestId}/create-quote/`, data);
}

export async function sendQuote(id: string): Promise<Quote> {
  return apiClient.post<Quote>(`/admin/quotes/${id}/send/`);
}

// Audit Logs
export async function getAuditLogs(filters?: {
  entity_type?: string;
  entity_id?: string;
  actor?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
}): Promise<PaginatedResponse<AuditLog>> {
  return apiClient.get<PaginatedResponse<AuditLog>>('/audit/', filters);
}

// Dashboard
export async function getDashboardStats(): Promise<DashboardStats> {
  return apiClient.get<DashboardStats>('/admin/dashboard/stats/');
}

export async function getWorkflowOverview(): Promise<WorkflowOverview> {
  return apiClient.get<WorkflowOverview>('/admin/orders/workflow/');
}

// Catalog Admin
export interface CreateProductData {
  type: 'product' | 'service';
  name: string;
  name_en?: string;
  slug?: string;
  short_description: string;
  short_description_en?: string;
  description?: string;
  description_en?: string;
  category_id?: string;
  tag_ids?: string[];
  sale_mode: 'BUY' | 'QUOTE' | 'HYBRID';
  payment_mode: 'FULL' | 'DEPOSIT_ALLOWED';
  base_price?: string;
  compare_at_price?: string;
  deposit_percentage?: number;
  deposit_amount?: string;
  track_inventory?: boolean;
  is_active?: boolean;
  is_featured?: boolean;
  meta_title?: string;
  meta_description?: string;
  initial_sku?: string;
  initial_stock?: number;
  initial_low_stock_threshold?: number;
  initial_cost?: string;
}

export interface CreateCategoryData {
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  type: 'product' | 'service';
  parent_id?: string;
  is_active?: boolean;
}

export interface CreateVariantData {
  catalog_item_id: string;
  sku: string;
  price: string;
  compare_at_price?: string;
  stock?: number;
  low_stock_threshold?: number;
  is_active?: boolean;
}

export interface UpdateVariantData {
  sku?: string;
  cost?: string;
  price?: string;
  low_stock_threshold?: number;
  is_active?: boolean;
}

export async function createProduct(data: CreateProductData): Promise<unknown> {
  return apiClient.post('/catalog/items/', data);
}

export async function updateProduct(id: string, data: Partial<CreateProductData>): Promise<unknown> {
  return apiClient.patch(`/catalog/items/${id}/`, data);
}

export async function deleteProduct(id: string): Promise<void> {
  return apiClient.delete(`/catalog/items/${id}/`);
}

export async function createCategory(data: CreateCategoryData): Promise<{ id: string; name: string }> {
  return apiClient.post('/catalog/categories/', data);
}

export async function createProductVariant(data: CreateVariantData): Promise<{ id: string; sku: string }> {
  return apiClient.post('/catalog/variants/', data);
}

export async function updateProductVariant(id: string, data: UpdateVariantData): Promise<unknown> {
  return apiClient.patch(`/catalog/variants/${id}/`, data);
}

// Product Images
export interface UploadImagesResponse {
  uploaded: number;
  images: Array<{
    id: string;
    image: string;
    alt_text: string;
    is_primary: boolean;
  }>;
  errors?: Array<{
    file: string;
    errors: Record<string, string[]>;
  }>;
}

export async function uploadProductImages(
  productId: string,
  images: File[]
): Promise<UploadImagesResponse> {
  const formData = new FormData();
  images.forEach((image) => {
    formData.append('images', image);
  });

  return apiClient.upload<UploadImagesResponse>(
    `/catalog/items/${productId}/upload-images/`,
    formData
  );
}

export async function deleteProductImage(
  productId: string,
  imageId: string
): Promise<void> {
  await apiClient.delete(`/catalog/items/${productId}/delete-image/${imageId}/`);
}

// Inventory Admin
export interface CreateMovementData {
  variant_id: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  notes?: string;
  reference_type?: string;
  reference_id?: string;
}

export async function createInventoryMovement(data: CreateMovementData): Promise<unknown> {
  return apiClient.post('/inventory/movements/', data);
}

// Content Admin
export async function updateCarouselSlide(id: string, data: FormData): Promise<unknown> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/admin/content/carousel/${id}/`,
    {
      method: 'PATCH',
      body: data,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
    }
  );
  if (!response.ok) throw new Error('Failed to update slide');
  return response.json();
}

export async function createCarouselSlide(data: FormData): Promise<unknown> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/admin/content/carousel/`,
    {
      method: 'POST',
      body: data,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
    }
  );
  if (!response.ok) throw new Error('Failed to create slide');
  return response.json();
}

export interface OrderOperationalTracks {
  order_id: string;
  order_number: string;
  origin: string;
  operational_rollup: string;
  operation_plan: Record<string, unknown> | null;
  production_jobs: ProductionJob[];
  logistics_jobs: LogisticsJob[];
  field_ops_jobs: FieldOperationJob[];
}

export async function getOrderOperationalTracks(orderId: string): Promise<OrderOperationalTracks> {
  return apiClient.get<OrderOperationalTracks>(`/admin/orders/${orderId}/operational_tracks/`);
}

// Operational Tracks - Production
export async function getProductionJobs(filters?: {
  status?: string;
  statuses?: string[];
  page?: number;
}): Promise<PaginatedResponse<ProductionJob>> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.statuses) {
    filters.statuses.forEach(s => params.append('statuses', s));
  }
  if (filters?.page) params.append('page', filters.page.toString());
  
  const queryString = params.toString();
  const url = `/admin/orders/production-jobs/${queryString ? '?' + queryString : ''}`;
  return apiClient.get<PaginatedResponse<ProductionJob>>(url);
}

export async function updateProductionJobStatus(
  orderId: string,
  jobId: string,
  status: string,
  notes?: string
): Promise<{ job: ProductionJob; order_operational_rollup: string }> {
  return apiClient.post(
    `/admin/orders/${orderId}/production-jobs/${jobId}/update-status/`,
    { status, notes }
  );
}

// Operational Tracks - Operations (Logistics + Field Ops)
export async function getOperationsJobs(filters?: {
  status?: string;
  job_type?: 'logistics' | 'field_ops';
  page?: number;
}): Promise<PaginatedResponse<LogisticsJob | FieldOperationJob>> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.job_type) params.append('job_type', filters.job_type);
  if (filters?.page) params.append('page', filters.page.toString());
  
  const queryString = params.toString();
  const url = `/admin/orders/operations-jobs/${queryString ? '?' + queryString : ''}`;
  return apiClient.get<PaginatedResponse<LogisticsJob | FieldOperationJob>>(url);
}

export async function updateLogisticsJobStatus(
  orderId: string,
  jobId: string,
  status: string,
  notes?: string
): Promise<{ job: LogisticsJob; order_operational_rollup: string }> {
  return apiClient.post(
    `/admin/orders/${orderId}/logistics-jobs/${jobId}/update-status/`,
    { status, notes }
  );
}

export async function updateFieldOperationJobStatus(
  orderId: string,
  jobId: string,
  status: string,
  notes?: string
): Promise<{ job: FieldOperationJob; order_operational_rollup: string }> {
  return apiClient.post(
    `/admin/orders/${orderId}/field-ops-jobs/${jobId}/update-status/`,
    { status, notes }
  );
}

export async function verifyTemporaryPassword(data: {
  email: string;
  temporary_password: string;
}): Promise<{ message: string; setup_token: string; user: Omit<AdminUser, 'is_active' | 'last_login' | 'orders_count' | 'quotes_count' | 'total_spent' | 'last_order_date'> }> {
  return apiClient.post('/users/verify-temp-password/', data);
}

export async function completeUserSetup(data: {
  email: string;
  setup_token: string;
  password: string;
}): Promise<{ message: string; token: string; user: AdminUser }> {
  return apiClient.post('/users/complete-setup/', data);
}
