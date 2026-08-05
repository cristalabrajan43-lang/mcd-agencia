/**
 * Order tracking API (separate module to avoid bundler cache issues).
 */

import { apiClient } from './client';

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

export async function getOrderTracking(id: string): Promise<OrderTrackingTimeline> {
  return apiClient.get<OrderTrackingTimeline>(`/orders/${id}/tracking/`);
}
