/**
 * Catalog API Service for MCD-Agencia.
 *
 * This module provides catalog-related API calls:
 *   - Categories
 *   - Products (CatalogItems)
 *   - Variants
 *   - Tags
 */

import { apiClient } from './client';

// Types
export interface Category {
  id: string;
  name: string;
  name_en: string;
  slug: string;
  type: 'product' | 'service';
  description?: string;
  description_en?: string;
  image?: string;
  parent_id?: string;
  is_active: boolean;
  position: number;
  breadcrumb?: Array<{ id: string; name: string; slug: string }>;
  children?: Category[];
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

export interface AttributeValue {
  id: string;
  value: string;
  value_en?: string;
  slug: string;
  color_code?: string;
  position: number;
}

export interface Attribute {
  id: string;
  name: string;
  name_en?: string;
  slug: string;
  type: string;
  is_filterable: boolean;
  is_visible: boolean;
  values: AttributeValue[];
}

export interface ProductImage {
  id: string;
  image: string;
  alt_text?: string;
  alt_text_en?: string;
  is_primary: boolean;
  position: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attribute_values: AttributeValue[];
  cost?: string;
  price: string;
  compare_at_price?: string;
  stock: number;
  low_stock_threshold: number;
  weight?: string;
  dimensions?: string;
  barcode?: string;
  is_active: boolean;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  images: ProductImage[];
}

export interface Product {
  id: string;
  type: 'product' | 'service';
  name: string;
  name_en: string;
  slug: string;
  short_description: string;
  short_description_en?: string;
  description?: string;
  description_en?: string;
  category?: Category;
  tags?: Tag[];
  sale_mode: 'BUY' | 'QUOTE' | 'HYBRID';
  payment_mode: 'FULL' | 'DEPOSIT_ALLOWED';
  base_price: string;
  compare_at_price?: string;
  deposit_percentage?: number;
  deposit_amount?: string;
  price_range: {
    min: string | null;
    max: string | null;
    has_range: boolean;
  };
  has_discount: boolean;
  discount_percentage?: number;
  track_inventory: boolean;
  total_stock: number;
  is_in_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  specifications?: Record<string, unknown>;
  installation_info?: string;
  installation_info_en?: string;
  meta_title?: string;
  meta_description?: string;
  variants: ProductVariant[];
  images: ProductImage[];
  available_attributes?: Array<{
    id: string;
    name: string;
    name_en?: string;
    type: string;
    values: Array<{
      id: string;
      value: string;
      value_en?: string;
      color_code?: string;
    }>;
  }>;
  created_at: string;
  updated_at: string;
}

export interface ProductListItem {
  id: string;
  type: 'product' | 'service';
  name: string;
  name_en: string;
  slug: string;
  short_description: string;
  short_description_en?: string;
  category?: Category;
  sale_mode: 'BUY' | 'QUOTE' | 'HYBRID';
  base_price: string;
  compare_at_price?: string;
  price_range: {
    min: string | null;
    max: string | null;
    has_range: boolean;
  };
  has_discount: boolean;
  discount_percentage?: number;
  primary_image?: ProductImage;
  is_active: boolean;
  is_featured: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  total_pages?: number;
  current_page?: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ProductFilters {
  category?: string;
  category_slug?: string;
  tag?: string;
  type?: 'product' | 'service';
  sale_mode?: 'BUY' | 'QUOTE' | 'HYBRID';
  is_active?: boolean;
  is_featured?: boolean;
  has_discount?: boolean;
  promo_banner?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

// API Functions

/**
 * Get category tree.
 */
export async function getCategoryTree(): Promise<Category[]> {
  return apiClient.get<Category[]>('/catalog/categories/tree/');
}

/**
 * Get all categories (flat).
 */
export async function getCategories(
  type?: 'product' | 'service',
  options?: { page?: number; page_size?: number; is_active?: boolean }
): Promise<PaginatedResponse<Category>> {
  const params: Record<string, string | number | boolean> = {};
  if (type) params.type = type;
  if (options?.page !== undefined) params.page = options.page;
  if (options?.page_size !== undefined) params.page_size = options.page_size;
  if (options?.is_active !== undefined) params.is_active = options.is_active;
  return apiClient.get<PaginatedResponse<Category>>('/catalog/categories/', params);
}

/**
 * Get category by ID.
 */
export async function getCategoryById(id: string): Promise<Category> {
  return apiClient.get<Category>(`/catalog/categories/${id}/`);
}

/**
 * Get all tags.
 */
export async function getTags(): Promise<PaginatedResponse<Tag>> {
  return apiClient.get<PaginatedResponse<Tag>>('/catalog/tags/');
}

/**
 * Get all attributes.
 */
export async function getAttributes(): Promise<PaginatedResponse<Attribute>> {
  return apiClient.get<PaginatedResponse<Attribute>>('/catalog/attributes/');
}

/**
 * Get products with filters.
 */
export async function getProducts(filters?: ProductFilters): Promise<PaginatedResponse<ProductListItem>> {
  return apiClient.get<PaginatedResponse<ProductListItem>>('/catalog/items/', filters as Record<string, string | number | boolean | undefined>);
}

/**
 * Get featured products.
 */
export async function getFeaturedProducts(): Promise<ProductListItem[]> {
  return apiClient.get<ProductListItem[]>('/catalog/items/featured/');
}

/**
 * Get product by ID.
 */
export async function getProductById(id: string): Promise<Product> {
  return apiClient.get<Product>(`/catalog/items/${id}/`);
}

/**
 * Get product by slug.
 */
export async function getProductBySlug(slug: string): Promise<Product> {
  return apiClient.get<Product>(`/catalog/items/slug/${slug}/`);
}

/**
 * Get variant by ID.
 */
export async function getVariantById(id: string): Promise<ProductVariant> {
  return apiClient.get<ProductVariant>(`/catalog/variants/${id}/`);
}
