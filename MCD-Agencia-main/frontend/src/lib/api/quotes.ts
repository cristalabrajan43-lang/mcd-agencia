/**
 * Quotes API Service for MCD-Agencia.
 *
 * This module provides quote-related API calls:
 *   - Quote request submission
 *   - Quote viewing
 *   - Quote acceptance/rejection
 *   - Sales rep dashboard
 */

import { apiClient } from './client';
import { PaginatedResponse } from './catalog';

// Status types
export type QuoteRequestStatus = 'pending' | 'assigned' | 'in_review' | 'quoted' | 'accepted' | 'rejected' | 'cancelled' | 'info_requested';
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'changes_requested' | 'converted';
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';
export type UrgencyLevel = 'normal' | 'medium' | 'high';
export type AssignmentMethod = 'manual' | 'auto_specialty' | 'auto_load' | 'fallback';

// Types
export interface QuoteLine {
  id: string;
  concept: string;
  concept_en?: string;
  description: string;
  description_en?: string;
  quantity: number;
  unit: string;
  unit_price: string;
  line_total: string;
  position: number;
  service_details?: Record<string, unknown>;
  shipping_cost?: string;
  delivery_method?: string;
  delivery_address?: Record<string, string>;
  pickup_branch?: string;
  pickup_branch_detail?: {
    id: string;
    name: string;
    city: string;
    state: string;
    full_address: string;
  } | null;
  estimated_delivery_date?: string;
}

export interface QuoteAttachment {
  id: string;
  file: string;
  filename: string;
  file_type?: string;
  file_size: number;
  description?: string;
  created_at: string;
}

export interface SalesRep {
  id: string;
  full_name: string;
  email: string;
}

export interface QuoteRequestService {
  id: string;
  position: number;
  service_type: string;
  service_details?: Record<string, unknown>;
  delivery_method?: string;
  delivery_method_display?: string;
  delivery_address?: Record<string, string>;
  pickup_branch?: string;
  pickup_branch_detail?: {
    id: string;
    name: string;
    city: string;
    state: string;
    full_address: string;
  } | null;
  required_date?: string;
  description?: string;
  attachments?: QuoteAttachment[];
}

export interface QuoteRequest {
  id: string;
  request_number: string;
  status: QuoteRequestStatus;
  status_display: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_company?: string;
  catalog_item?: {
    id: string;
    name: string;
    slug: string;
    image?: string;
  };
  catalog_item_name?: string;
  quantity?: number;
  dimensions?: string;
  material?: string;
  includes_installation: boolean;
  description: string;
  preferred_language?: string;
  service_type?: string;
  service_details?: Record<string, unknown>;
  is_guest: boolean;
  required_date?: string;
  urgency: UrgencyLevel;
  urgency_display: string;
  days_until_required?: number;
  assigned_to?: string;
  assigned_to_name?: string;
  assignment_method?: AssignmentMethod;
  assigned_at?: string;
  delivery_method?: string;
  delivery_method_display?: string;
  delivery_address?: Record<string, string>;
  pickup_branch?: string;
  pickup_branch_detail?: {
    id: string;
    name: string;
    city: string;
    state: string;
    full_address: string;
  } | null;
  attachments: QuoteAttachment[];
  services?: QuoteRequestService[];
  created_at: string;
  updated_at: string;
  info_request_message?: string;
  info_request_token?: string;
  info_request_fields?: string[];
}

export interface Quote {
  id: string;
  quote_number: string;
  quote_request?: QuoteRequest;
  status: QuoteStatus;
  status_display: string;
  version: number;
  customer_name: string;
  customer_email: string;
  customer_company?: string;
  customer_phone?: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  currency: string;
  payment_mode: 'FULL' | 'DEPOSIT_ALLOWED';
  deposit_percentage?: string;
  deposit_amount?: string;
  valid_until?: string;
  is_expired: boolean;
  is_valid: boolean;
  terms: string;
  terms_en?: string;
  language: 'es' | 'en';
  delivery_time_text?: string;
  estimated_delivery_date?: string;
  payment_methods?: string[];
  payment_conditions?: string;
  included_services?: string[];
  customer_notes?: string;
  internal_notes?: string;
  view_count: number;
  delivery_method?: string;
  delivery_method_display?: string;
  delivery_address?: Record<string, string>;
  pickup_branch?: string;
  pickup_branch_detail?: {
    id: string;
    name: string;
    city: string;
    state: string;
    full_address: string;
  } | null;
  lines: QuoteLine[];
  attachments: QuoteAttachment[];
  created_by?: string;
  created_by_name?: string;
  token?: string;
  pdf_file?: string;
  pdf_file_en?: string;
  sent_at?: string;
  viewed_at?: string;
  accepted_at?: string;
  created_at: string;
}

export type AcceptQuoteResponse = Quote & {
  order_id?: string;
  order_number?: string;
};

export interface QuoteResponse {
  id: string;
  quote: string;
  action: 'view' | 'approval' | 'rejection' | 'change_request' | 'comment' | 'send';
  action_display: string;
  comment?: string;
  responded_by?: string;
  responded_by_name?: string;
  guest_name?: string;
  guest_email?: string;
  pdf_file?: string;
  created_at: string;
}

export interface CreateQuoteRequestData {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_company?: string;
  catalog_item_id?: string;
  quantity?: number;
  dimensions?: string;
  material?: string;
  includes_installation?: boolean;
  description: string;
  preferred_language?: string;
  service_type?: string;
  service_details?: Record<string, unknown>;
  required_date?: string;
  delivery_method?: string;
  delivery_address?: Record<string, string>;
  pickup_branch?: string;
  attachments?: File[];
}

export interface CreateQuoteData {
  quote_request_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_company?: string;
  valid_days?: number;
  payment_mode?: 'FULL' | 'DEPOSIT_ALLOWED';
  deposit_percentage?: number;
  terms?: string;
  terms_en?: string;
  internal_notes?: string;
  language?: 'es' | 'en';
  delivery_time_text?: string;
  estimated_delivery_date?: string;
  delivery_method?: string;
  pickup_branch_id?: string;
  delivery_address?: Record<string, string>;
  payment_methods?: string[];
  payment_conditions?: string;
  included_services?: string[];
  lines: Array<{
    concept: string;
    concept_en?: string;
    description?: string;
    description_en?: string;
    quantity: number;
    unit: string;
    unit_price: string | number;
    position?: number;
    service_details?: Record<string, unknown>;
    shipping_cost?: number;
    delivery_method?: string;
    delivery_address?: Record<string, string>;
    pickup_branch?: string;
    estimated_delivery_date?: string;
  }>;
}

// Change Request Types
export interface ProposedLine {
  id?: string; // Line ID for modify/delete, null for add
  action: 'modify' | 'add' | 'delete';
  concept?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  service_details?: Record<string, unknown>;
  original_values?: {
    concept?: string;
    description?: string;
    quantity?: string;
    unit?: string;
    unit_price?: string;
  };
}

export interface QuoteChangeRequest {
  id: string;
  quote: string;
  quote_number: string;
  status: ChangeRequestStatus;
  status_display: string;
  customer_name: string;
  customer_email: string;
  customer_comments: string;
  proposed_lines: ProposedLine[];
  original_snapshot: {
    quote_number: string;
    subtotal: string;
    tax_amount: string;
    total: string;
    lines: Array<{
      id: string;
      concept: string;
      description: string;
      quantity: string;
      unit: string;
      unit_price: string;
      line_total: string;
      service_type?: string;
      service_details?: Record<string, unknown>;
    }>;
  };
  changes_summary: {
    added: number;
    modified: number;
    deleted: number;
  };
  attachments?: Array<{
    id: string;
    file: string;
    filename: string;
    file_type: string;
    file_size: number;
    description?: string;
    created_at: string;
  }>;
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SubmitChangeRequestData {
  proposed_lines: ProposedLine[];
  customer_comments?: string;
  attachments?: File[];
}

export interface SalesRepDashboard {
  pending_requests: number;
  quotes_without_response: number;
  conversion_rate: string;
  total_quoted: string;
  total_approved: string;
  urgent_requests: QuoteRequest[];
  recent_activity: Array<{
    id: string;
    action: string;
    action_display: string;
    entity_type: string;
    entity_id: string;
    description: string;
    actor: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
}

// API Functions

/**
 * Submit a new quote request (public).
 */
export async function submitQuoteRequest(data: CreateQuoteRequestData): Promise<{ message: string; request_number: string }> {
  // Handle file uploads with FormData
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (key === 'attachments' && Array.isArray(value)) {
      value.forEach((file) => {
        formData.append('attachments', file);
      });
    } else if (value !== undefined && value !== null) {
      // JSON-stringify objects/arrays so the backend receives valid JSON
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });

  // Include auth token if user is logged in so backend can link the request
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/quotes/request/`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw {
      message: errorData.detail || errorData.message || 'Error submitting quote request',
      status: response.status,
      data: errorData,
    };
  }

  return response.json();
}

/**
 * Get user's quote requests.
 */
export async function getQuoteRequests(filters?: { status?: string; page?: number }): Promise<PaginatedResponse<QuoteRequest>> {
  return apiClient.get<PaginatedResponse<QuoteRequest>>('/quotes/requests/', filters);
}

/**
 * Get quote request by ID.
 */
export async function getQuoteRequestById(id: string): Promise<QuoteRequest> {
  return apiClient.get<QuoteRequest>(`/quotes/requests/${id}/`);
}

/**
 * Get user's quotes.
 */
export async function getQuotes(filters?: { status?: string; page?: number; search?: string }): Promise<PaginatedResponse<Quote>> {
  return apiClient.get<PaginatedResponse<Quote>>('/quotes/', filters);
}

/**
 * Get quote by ID.
 */
export async function getQuoteById(id: string): Promise<Quote> {
  return apiClient.get<Quote>(`/quotes/${id}/`);
}

/**
 * View quote via public token.
 */
export async function viewQuoteByToken(token: string): Promise<Quote> {
  return apiClient.get<Quote>(`/quotes/view/${token}/`);
}

/**
 * Accept a quote.
 */
export async function acceptQuote(
  id: string,
  notes?: string,
  signature?: string | null,
  signatureName?: string,
): Promise<AcceptQuoteResponse> {
  return apiClient.post<AcceptQuoteResponse>(`/quotes/${id}/accept/`, {
    accepted: true,
    notes: notes || undefined,
    signature: signature || undefined,
    signature_name: signatureName || undefined,
  });
}

/**
 * Reject a quote.
 */
export async function rejectQuote(id: string, reason?: string): Promise<Quote> {
  return apiClient.post<Quote>(`/quotes/${id}/reject/`, { reason });
}

/**
 * Request changes to a quote (public - no auth required).
 * Uses the structured change request format with proposed line modifications.
 */
export async function requestQuoteChanges(
  token: string,
  data: SubmitChangeRequestData
): Promise<{ message: string; change_request: QuoteChangeRequest }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  // Use FormData to support file uploads
  const formData = new FormData();
  formData.append('proposed_lines', JSON.stringify(data.proposed_lines));
  if (data.customer_comments) {
    formData.append('customer_comments', data.customer_comments);
  }
  if (data.attachments && data.attachments.length > 0) {
    data.attachments.forEach((file) => {
      formData.append('attachments', file);
    });
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/quotes/view/${token}/change-request/`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    // Network error (CORS blocked, server down, timeout, etc.)
    throw new Error('No se pudo conectar con el servidor. Por favor intenta de nuevo en unos segundos.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Handle DRF validation errors which can be objects
    let errorMessage = 'Error al enviar la solicitud';
    if (response.status === 503) {
      errorMessage = 'El servidor está temporalmente no disponible. Por favor intenta de nuevo en unos segundos.';
    } else if (typeof errorData.error === 'string') {
      errorMessage = errorData.error;
    } else if (typeof errorData.detail === 'string') {
      errorMessage = errorData.detail;
    } else if (errorData.proposed_lines) {
      // Handle validation errors for proposed_lines
      errorMessage = Array.isArray(errorData.proposed_lines)
        ? errorData.proposed_lines[0]
        : 'Error en los datos enviados';
    } else if (errorData.non_field_errors) {
      errorMessage = Array.isArray(errorData.non_field_errors)
        ? errorData.non_field_errors[0]
        : errorData.non_field_errors;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Get quote responses/timeline events (public - no auth required).
 */
export async function getQuoteResponsesByToken(token: string): Promise<QuoteResponse[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const response = await fetch(`${apiUrl}/quotes/view/${token}/responses/`, {
    method: 'GET',
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * Get existing change requests for a quote (public - no auth required).
 */
export async function getQuoteChangeRequests(
  token: string
): Promise<{ quote_number: string; quote_status: string; change_requests: QuoteChangeRequest[] }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const response = await fetch(`${apiUrl}/quotes/view/${token}/change-request/`, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener las solicitudes');
  }

  return response.json();
}

/**
 * Download quote PDF using token (public - no auth required).
 */
export async function downloadQuotePdfByToken(token: string, quoteNumber: string): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const response = await fetch(`${apiUrl}/quotes/view/${token}/pdf/`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Error al descargar el PDF');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cotizacion_${quoteNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Reject a quote using token (public - no auth required).
 */
export async function rejectQuoteByToken(token: string, reason: string): Promise<{ message: string; status: string }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const response = await fetch(`${apiUrl}/quotes/view/${token}/reject/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al rechazar la cotización');
  }

  return response.json();
}

/**
 * Download quote PDF.
 * Uses token refresh logic if the access token has expired.
 */
export async function downloadQuotePdf(id: string): Promise<Blob> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const url = `${apiUrl}/quotes/${id}/pdf/`;

  let accessToken = localStorage.getItem('accessToken');

  let response = await fetch(url, {
    method: 'GET',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  // If 401, try to refresh token and retry
  if (response.status === 401 && accessToken) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const refreshResp = await fetch(`${apiUrl}/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });
        if (refreshResp.ok) {
          const data = await refreshResp.json();
          localStorage.setItem('accessToken', data.access);
          accessToken = data.access;
          response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
      } catch {
        // Refresh failed, will throw below
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errField = (errorData as Record<string, unknown>).error;
    const msg = typeof errField === 'string'
      ? errField
      : (errField && typeof errField === 'object' && 'message' in errField)
        ? String((errField as Record<string, unknown>).message)
        : (errorData as Record<string, unknown>).detail as string || 'Error downloading PDF';
    throw new Error(msg);
  }

  return response.blob();
}

/**
 * Download PDF snapshot from a specific QuoteResponse (version-specific).
 * Uses the same token refresh logic as downloadQuotePdf.
 */
export async function downloadResponsePdf(quoteId: string, responseId: string): Promise<Blob> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const url = `${apiUrl}/quotes/${quoteId}/responses/${responseId}/pdf/`;

  let accessToken = localStorage.getItem('accessToken');

  let response = await fetch(url, {
    method: 'GET',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  // If 401, try to refresh token and retry
  if (response.status === 401 && accessToken) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const refreshResp = await fetch(`${apiUrl}/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });
        if (refreshResp.ok) {
          const data = await refreshResp.json();
          localStorage.setItem('accessToken', data.access);
          accessToken = data.access;
          response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
      } catch {
        // Refresh failed, will throw below
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errField = (errorData as Record<string, unknown>).error;
    const msg = typeof errField === 'string'
      ? errField
      : (errField && typeof errField === 'object' && 'message' in errField)
        ? String((errField as Record<string, unknown>).message)
        : (errorData as Record<string, unknown>).detail as string || 'Error downloading PDF';
    throw new Error(msg);
  }

  return response.blob();
}

/**
 * Request quote PDF regeneration.
 */
export async function regenerateQuotePdf(id: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>(`/quotes/${id}/regenerate-pdf/`);
}

/**
 * Restore delivery/shipping data on quote lines from the original request.
 * Works on any quote status (including sent).
 */
export async function fixDeliveryData(
  id: string,
  data?: { shipping_costs?: Record<string, string>; regenerate_pdf?: boolean }
): Promise<{
  message: string;
  lines_updated: number;
  changes: Array<{ line_position: number; concept: string; updated: string[] }>;
  total_recalculated: boolean;
  new_total: string;
  shipping_total: string;
}> {
  return apiClient.post(`/quotes/${id}/fix-delivery-data/`, data || {});
}

// ==========================================
// Sales Rep / Admin API Functions
// ==========================================

/**
 * Get sales rep dashboard stats.
 */
export async function getSalesRepDashboard(): Promise<SalesRepDashboard> {
  return apiClient.get<SalesRepDashboard>('/quotes/requests/dashboard/');
}

/**
 * Get all quote requests (admin/sales).
 */
export async function getAdminQuoteRequests(filters?: {
  status?: QuoteRequestStatus;
  urgency?: UrgencyLevel;
  assigned_to?: string;
  search?: string;
  ordering?: string;
  page?: number;
}): Promise<PaginatedResponse<QuoteRequest>> {
  return apiClient.get<PaginatedResponse<QuoteRequest>>('/quotes/requests/', filters);
}

/**
 * Get quote request detail (admin/sales).
 */
export async function getAdminQuoteRequestById(id: string): Promise<QuoteRequest> {
  return apiClient.get<QuoteRequest>(`/quotes/requests/${id}/`);
}

/**
 * Assign quote request to sales rep.
 */
export async function assignQuoteRequest(id: string, assignedToId: string): Promise<QuoteRequest> {
  return apiClient.post<QuoteRequest>(`/quotes/requests/${id}/assign/`, { assigned_to_id: assignedToId });
}

/**
 * Mark quote request as in review.
 */
export async function markQuoteRequestInReview(id: string): Promise<QuoteRequest> {
  return apiClient.post<QuoteRequest>(`/quotes/requests/${id}/mark_in_review/`);
}

/**
 * Revert quote request from in_review back to assigned/pending.
 */
export async function unmarkQuoteRequestInReview(id: string): Promise<QuoteRequest> {
  return apiClient.post<QuoteRequest>(`/quotes/requests/${id}/unmark_in_review/`);
}

/**
 * Request additional information from the customer.
 * @param infoRequestFields Optional list of service_details field keys the vendor flagged.
 */
export async function requestQuoteRequestInfo(
  id: string,
  message: string,
  infoRequestFields?: string[]
): Promise<QuoteRequest> {
  const payload: Record<string, unknown> = { message };
  if (infoRequestFields && infoRequestFields.length > 0) {
    payload.info_request_fields = infoRequestFields;
  }
  return apiClient.post<QuoteRequest>(`/quotes/requests/${id}/request_info/`, payload);
}

/**
 * Get quote request info for the public completion page (by token).
 */
export async function getQuoteRequestByInfoToken(token: string): Promise<Record<string, unknown>> {
  return apiClient.get<Record<string, unknown>>(`/quotes/complete-info/${token}/`);
}

/**
 * Submit updated service details for a quote request (public, by token).
 */
export async function submitQuoteRequestInfo(token: string, serviceDetails: Record<string, unknown>): Promise<{ message: string; status: string }> {
  return apiClient.post<{ message: string; status: string }>(`/quotes/complete-info/${token}/`, { service_details: serviceDetails });
}

/**
 * Delete a quote request (admin only).
 */
export async function deleteQuoteRequest(id: string): Promise<void> {
  return apiClient.delete(`/quotes/requests/${id}/`);
}

/**
 * Get all quotes (admin/sales).
 */
export async function getAdminQuotes(filters?: {
  status?: QuoteStatus;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Quote>> {
  return apiClient.get<PaginatedResponse<Quote>>('/quotes/', filters);
}

/**
 * Get quote detail (admin/sales).
 */
export async function getAdminQuoteById(id: string): Promise<Quote> {
  return apiClient.get<Quote>(`/quotes/${id}/`);
}

/**
 * Create a new quote (admin/sales).
 */
export async function createQuote(data: CreateQuoteData): Promise<Quote> {
  return apiClient.post<Quote>('/quotes/', data);
}

/**
 * Update a quote (admin/sales).
 */
export async function updateQuote(id: string, data: Partial<CreateQuoteData>): Promise<Quote> {
  return apiClient.patch<Quote>(`/quotes/${id}/`, data);
}

/**
 * Send quote to customer.
 */
export async function sendQuote(id: string, options?: {
  send_email?: boolean;
  custom_message?: string;
}): Promise<Quote> {
  return apiClient.post<Quote>(`/quotes/${id}/send/`, options || { send_email: true });
}

/**
 * Resend the quote email to the customer.
 */
export async function resendQuoteEmail(id: string): Promise<{ email_sent: boolean; email_error?: string }> {
  return apiClient.post<{ email_sent: boolean; email_error?: string }>(`/quotes/${id}/resend-email/`);
}

/**
 * Duplicate a quote.
 */
export async function duplicateQuote(id: string): Promise<Quote> {
  return apiClient.post<Quote>(`/quotes/${id}/duplicate/`);
}

/**
 * Delete a quote (only drafts).
 */
export async function deleteQuote(id: string): Promise<void> {
  return apiClient.delete(`/quotes/${id}/`);
}

/**
 * Update internal notes for a quote (admin/sales, any status).
 */
export async function updateQuoteInternalNotes(id: string, internalNotes: string): Promise<Quote> {
  return apiClient.patch<Quote>(`/quotes/${id}/internal-notes/`, { internal_notes: internalNotes });
}

/**
 * Get quote responses/history.
 */
export async function getQuoteResponses(quoteId: string): Promise<QuoteResponse[]> {
  return apiClient.get<QuoteResponse[]>(`/quotes/${quoteId}/responses/`);
}

/**
 * Add response to quote (customer action).
 */
export async function addQuoteResponse(quoteId: string, data: {
  action: 'accept' | 'reject' | 'change_request' | 'comment';
  comment?: string;
  guest_name?: string;
  guest_email?: string;
}): Promise<QuoteResponse> {
  return apiClient.post<QuoteResponse>(`/quotes/${quoteId}/respond/`, data);
}

/**
 * Get available sales reps for assignment.
 */
export async function getSalesReps(): Promise<SalesRep[]> {
  return apiClient.get<SalesRep[]>('/users/sales-reps/');
}

// ==========================================
// Change Request API Functions (Admin/Sales)
// ==========================================

/**
 * Get all change requests (admin/sales).
 */
export async function getAdminChangeRequests(filters?: {
  status?: ChangeRequestStatus;
  quote?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<QuoteChangeRequest>> {
  return apiClient.get<PaginatedResponse<QuoteChangeRequest>>('/quotes/change-requests/', filters);
}

/**
 * Get pending change requests (admin/sales).
 */
export async function getPendingChangeRequests(): Promise<QuoteChangeRequest[]> {
  return apiClient.get<QuoteChangeRequest[]>('/quotes/change-requests/pending/');
}

/**
 * Get change request detail (admin/sales).
 */
export async function getChangeRequestById(id: string): Promise<QuoteChangeRequest> {
  return apiClient.get<QuoteChangeRequest>(`/quotes/change-requests/${id}/`);
}

/**
 * Download PDF for the quote version that was active at the time of
 * a change request. Uses the send response snapshot or generates from
 * original_snapshot data.
 */
export async function downloadChangeRequestPdf(changeRequestId: string): Promise<Blob> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const url = `${apiUrl}/quotes/change-requests/${changeRequestId}/pdf/`;

  let accessToken = localStorage.getItem('accessToken');

  let response = await fetch(url, {
    method: 'GET',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  // If 401, try to refresh token and retry
  if (response.status === 401 && accessToken) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const refreshResp = await fetch(`${apiUrl}/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });
        if (refreshResp.ok) {
          const data = await refreshResp.json();
          localStorage.setItem('accessToken', data.access);
          accessToken = data.access;
          response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
      } catch {
        // Refresh failed, will throw below
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errField = (errorData as Record<string, unknown>).error;
    const msg = typeof errField === 'string'
      ? errField
      : (errField && typeof errField === 'object' && 'message' in errField)
        ? String((errField as Record<string, unknown>).message)
        : (errorData as Record<string, unknown>).detail as string || 'Error downloading PDF';
    throw new Error(msg);
  }

  return response.blob();
}

/**
 * Review a change request (approve or reject).
 */
export async function reviewChangeRequest(
  id: string,
  action: 'approve' | 'reject',
  notes?: string
): Promise<{ message: string; change_request: QuoteChangeRequest }> {
  return apiClient.post<{ message: string; change_request: QuoteChangeRequest }>(
    `/quotes/change-requests/${id}/review/`,
    { action, notes }
  );
}
