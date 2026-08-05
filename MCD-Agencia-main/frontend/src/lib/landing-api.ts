const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  token?: string;
};

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, token } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.detail || errorData.message || 'API request failed',
      response.status,
      errorData
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    apiClient<{ access: string; refresh: string; user: any }>('/api/auth/login/', {
      method: 'POST',
      body: { email, password },
    }),

  register: (data: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) =>
    apiClient<{ access: string; refresh: string; user: any }>('/api/auth/register/', {
      method: 'POST',
      body: data,
    }),

  refreshToken: (refresh: string) =>
    apiClient<{ access: string }>('/api/auth/token/refresh/', {
      method: 'POST',
      body: { refresh },
    }),

  me: (token: string) =>
    apiClient<any>('/api/auth/me/', { token }),

  updateProfile: (token: string, data: any) =>
    apiClient<any>('/api/auth/me/', {
      method: 'PATCH',
      body: data,
      token,
    }),
};

// Catalog API
export const catalogApi = {
  getCategories: (token?: string) =>
    apiClient<any>('/api/catalog/categories/', { token }),

  getCategory: (slug: string, token?: string) =>
    apiClient<any>(`/api/catalog/categories/${slug}/`, { token }),

  getProducts: (params?: Record<string, string>, token?: string) => {
    const searchParams = new URLSearchParams(params);
    return apiClient<any>(`/api/catalog/items/?${searchParams}`, { token });
  },

  getProduct: (slug: string, token?: string) =>
    apiClient<any>(`/api/catalog/items/${slug}/`, { token }),
};

// Quotes API
export const quotesApi = {
  create: (data: any, token?: string) =>
    apiClient<any>('/api/quotes/', {
      method: 'POST',
      body: data,
      token,
    }),

  getByToken: (accessToken: string) =>
    apiClient<any>(`/api/quotes/by-token/${accessToken}/`),

  list: (token: string, params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    return apiClient<any>(`/api/quotes/?${searchParams}`, { token });
  },

  get: (id: string, token: string) =>
    apiClient<any>(`/api/quotes/${id}/`, { token }),

  respond: (id: string, data: any, token: string) =>
    apiClient<any>(`/api/quotes/${id}/respond/`, {
      method: 'POST',
      body: data,
      token,
    }),
};

// Orders API
export const ordersApi = {
  list: (token: string, params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    return apiClient<any>(`/api/orders/?${searchParams}`, { token });
  },

  get: (id: string, token: string) =>
    apiClient<any>(`/api/orders/${id}/`, { token }),

  updateStatus: (id: string, status: string, token: string) =>
    apiClient<any>(`/api/orders/${id}/transition/`, {
      method: 'POST',
      body: { status },
      token,
    }),
};

// Cart API
export const cartApi = {
  get: (token: string) =>
    apiClient<any>('/api/cart/', { token }),

  addItem: (token: string, data: { item_id: string; variant_id?: string; quantity: number }) =>
    apiClient<any>('/api/cart/items/', {
      method: 'POST',
      body: data,
      token,
    }),

  updateItem: (token: string, itemId: string, quantity: number) =>
    apiClient<any>(`/api/cart/items/${itemId}/`, {
      method: 'PATCH',
      body: { quantity },
      token,
    }),

  removeItem: (token: string, itemId: string) =>
    apiClient<any>(`/api/cart/items/${itemId}/`, {
      method: 'DELETE',
      token,
    }),

  applyCoupon: (token: string, code: string) =>
    apiClient<any>('/api/cart/apply-coupon/', {
      method: 'POST',
      body: { code },
      token,
    }),

  checkout: (token: string, data: any) =>
    apiClient<any>('/api/cart/checkout/', {
      method: 'POST',
      body: data,
      token,
    }),
};

// Payments API
export const paymentsApi = {
  createPreference: (token: string, orderId: string, provider: 'mercadopago' | 'paypal') =>
    apiClient<any>(`/api/payments/${orderId}/create-preference/`, {
      method: 'POST',
      body: { provider },
      token,
    }),

  getPaymentStatus: (token: string, paymentId: string) =>
    apiClient<any>(`/api/payments/${paymentId}/`, { token }),
};

// Content API (public)
export const contentApi = {
  getCarousel: () =>
    apiClient<any>('/api/content/carousel/'),

  getBranches: () =>
    apiClient<any>('/api/content/branches/'),

  getTestimonials: () =>
    apiClient<any>('/api/content/testimonials/'),

  getClientLogos: () =>
    apiClient<any>('/api/content/client-logos/'),

  getFAQs: () =>
    apiClient<any>('/api/content/faqs/'),

  getSiteSettings: () =>
    apiClient<any>('/api/content/settings/'),
};

// Admin APIs
export const adminApi = {
  // Dashboard
  getDashboardStats: (token: string) =>
    apiClient<any>('/api/orders/stats/', { token }),

  // Users
  getUsers: (token: string, params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    return apiClient<any>(`/api/auth/users/?${searchParams}`, { token });
  },

  getUser: (token: string, id: string) =>
    apiClient<any>(`/api/auth/users/${id}/`, { token }),

  updateUser: (token: string, id: string, data: any) =>
    apiClient<any>(`/api/auth/users/${id}/`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  // Audit
  getAuditLogs: (token: string, params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    return apiClient<any>(`/api/audit/logs/?${searchParams}`, { token });
  },

  // Inventory
  getInventory: (token: string, params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    return apiClient<any>(`/api/inventory/movements/?${searchParams}`, { token });
  },

  getStockAlerts: (token: string) =>
    apiClient<any>('/api/inventory/alerts/', { token }),

  // Chatbot
  getConversations: (token: string, params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    return apiClient<any>(`/api/chatbot/conversations/?${searchParams}`, { token });
  },

  getConversation: (token: string, id: string) =>
    apiClient<any>(`/api/chatbot/conversations/${id}/`, { token }),

  sendMessage: (token: string, conversationId: string, content: string) =>
    apiClient<any>(`/api/chatbot/conversations/${conversationId}/send_message/`, {
      method: 'POST',
      body: { content, message_type: 'text' },
      token,
    }),
};
