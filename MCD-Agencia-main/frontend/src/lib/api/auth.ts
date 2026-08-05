/**
 * Authentication API Service for MCD-Agencia.
 *
 * This module provides authentication-related API calls:
 *   - Login
 *   - Registration
 *   - Token refresh
 *   - Password reset
 */

import { apiClient, setTokens, clearTokens } from './client';

// Types
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  company?: string;
  default_delivery_address?: Record<string, string>;
  date_of_birth?: string;
  role?: {
    id: string;
    name: string;
    display_name: string;
  };
  groups?: string[];
  preferred_language: string;
  avatar?: string;
  marketing_consent: boolean;
  is_email_verified: boolean;
  created_at: string;
}

export interface UserAddress {
  id: string;
  label: string;
  calle: string;
  numero_exterior: string;
  numero_interior: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  referencia: string;
  is_default: boolean;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  recaptcha_token?: string | null;
}

export interface RegisterData {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  terms_accepted: boolean;
  privacy_accepted: boolean;
  marketing_consent?: boolean;
  preferred_language?: string;
  recaptcha_token?: string | null;
}

export interface TokenResponse {
  access: string;
  refresh: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
  password_confirm: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

// API Functions

/**
 * Login with email and password.
 */
export async function login(credentials: LoginCredentials): Promise<{ user: User; tokens: TokenResponse }> {
  const tokens = await apiClient.post<TokenResponse>('/auth/token/', credentials);
  setTokens(tokens.access, tokens.refresh);

  const user = await getProfile();
  return { user, tokens };
}

/**
 * Register a new user.
 */
export async function register(data: RegisterData): Promise<{ message: string; user: User }> {
  const response = await apiClient.post<{ message: string; user: User }>('/auth/register/', data);
  return response;
}

/**
 * Logout the current user.
 */
export function logout(): void {
  clearTokens();
}

/**
 * Get current user profile.
 */
export async function getProfile(): Promise<User> {
  return apiClient.get<User>('/users/me/');
}

/**
 * Update user profile.
 */
export async function updateProfile(data: Partial<User>): Promise<User> {
  return apiClient.patch<User>('/users/me/', data);
}

/**
 * Change password.
 */
export async function changePassword(data: ChangePasswordData): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/users/change-password/', data);
}

/**
 * Request password reset email.
 */
export async function requestPasswordReset(data: PasswordResetRequest): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/password-reset/', data);
}

/**
 * Confirm password reset with token.
 */
export async function confirmPasswordReset(data: PasswordResetConfirm): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/password-reset/confirm/', data);
}

/**
 * Verify email with token.
 */
export async function verifyEmail(token: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/verify-email/', { token });
}

/**
 * Resend email verification.
 */
export async function resendVerification(email: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/resend-verification/', { email });
}

// =============================================
// User Addresses
// =============================================

/**
 * Get all saved delivery addresses.
 */
export async function getUserAddresses(): Promise<UserAddress[]> {
  return apiClient.get<UserAddress[]>('/users/addresses/');
}

/**
 * Create a new delivery address.
 */
export async function createUserAddress(data: Omit<UserAddress, 'id' | 'created_at'>): Promise<UserAddress> {
  return apiClient.post<UserAddress>('/users/addresses/', data);
}

/**
 * Update a delivery address.
 */
export async function updateUserAddress(id: string, data: Partial<UserAddress>): Promise<UserAddress> {
  return apiClient.patch<UserAddress>(`/users/addresses/${id}/`, data);
}

/**
 * Delete a delivery address.
 */
export async function deleteUserAddress(id: string): Promise<void> {
  return apiClient.delete(`/users/addresses/${id}/`);
}
