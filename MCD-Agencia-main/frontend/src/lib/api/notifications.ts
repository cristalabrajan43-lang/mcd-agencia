/**
 * Notifications API Service for MCD-Agencia.
 */

import { apiClient } from './client';

export interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  entity_type: string;
  entity_id: string;
  action_url: string;
  created_at: string;
}

export async function getNotifications(): Promise<{ results: Notification[] }> {
  return apiClient.get('/notifications/');
}

export async function getUnreadCount(): Promise<{ unread_count: number }> {
  return apiClient.get('/notifications/unread_count/');
}

export async function markNotificationRead(id: string): Promise<Notification> {
  return apiClient.post(`/notifications/${id}/read/`);
}

export async function markAllNotificationsRead(): Promise<{ marked_read: number }> {
  return apiClient.post('/notifications/read_all/');
}

export async function exportQuotesExcel(filters?: {
  status?: string;
  search?: string;
}): Promise<Blob> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);
  const qs = params.toString();
  const url = `${apiUrl}/quotes/export-excel/${qs ? '?' + qs : ''}`;

  const accessToken = localStorage.getItem('accessToken');
  const response = await fetch(url, {
    method: 'GET',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!response.ok) throw new Error('Error exporting quotes');
  return response.blob();
}
