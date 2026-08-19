/**
 * Content API Service for MCD-Agencia.
 *
 * This module provides content-related API calls:
 *   - Landing page data
 *   - FAQs
 *   - Legal pages
 *   - Site configuration
 *   - Contact form
 */

import { apiClient } from './client';
import { CLIENTS, FAQ_ITEMS, LOCATIONS, SERVICES } from '@/lib/constants';
import { getFallbackCarouselImages } from '@/lib/media';

// Types
export interface CarouselSlide {
  id: string;
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  image: string;
  mobile_image?: string;
  cta_text: string;
  cta_text_en: string;
  cta_url: string;
  service_key: string;
  position: number;
}

export type PromoBackgroundStyle = 'solid' | 'gradient';
export type PromoGradientDirection = 'to right' | 'to left' | 'to bottom' | '135deg';
export type PromoFontFamily = 'sans' | 'display' | 'mono';
export type PromoTitleSize = 'sm' | 'base' | 'lg' | 'xl';
export type PromoTitleWeight = 'medium' | 'semibold' | 'bold' | 'black';
export type PromoTextTransform = 'none' | 'uppercase' | 'capitalize';
export type PromoBadgeShape = 'pill' | 'rounded' | 'square';

export interface PromoBanner {
  id: string;
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  badge_text: string;
  cta_url: string;
  background_color: string;
  background_style: PromoBackgroundStyle;
  background_color_secondary: string;
  gradient_direction: PromoGradientDirection;
  border_color: string;
  text_color: string;
  subtitle_color: string;
  badge_background_color: string;
  badge_text_color: string;
  badge_shape: PromoBadgeShape;
  font_family: PromoFontFamily;
  title_size: PromoTitleSize;
  title_weight: PromoTitleWeight;
  text_transform: PromoTextTransform;
  discount_percent: number;
  apply_to: 'all' | 'selected';
  position: number;
}

export interface PromoBannerAdmin extends PromoBanner {
  is_active: boolean;
  catalog_item_ids?: string[];
}

export interface Testimonial {
  id: string;
  author_name: string;
  author_title: string;
  author_company: string;
  content: string;
  content_en: string;
  photo?: string;
  rating?: number;
  position: number;
}

export interface ClientLogo {
  id: string;
  name: string;
  logo: string;
  website?: string;
  position: number;
}

export interface FAQ {
  id: string;
  question: string;
  question_en: string;
  answer: string;
  answer_en: string;
  category: string;
  category_display: string;
  position: number;
}

export interface Branch {
  id: string;
  name: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  email: string;
  hours: string;
  hours_en: string;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  image?: string;
  full_address: string;
  position: number;
}

export interface LegalPage {
  id: string;
  type: 'terms' | 'privacy' | 'cookies' | 'legal';
  type_display: string;
  title: string;
  title_en: string;
  content: string;
  content_en: string;
  version: string;
  effective_date: string;
  meta_title?: string;
  meta_description?: string;
}

export interface SiteConfig {
  id: string;
  site_name: string;
  site_name_en: string;
  tagline: string;
  tagline_en: string;
  contact_email: string;
  contact_phone: string;
  whatsapp_number?: string;
  social_links: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  logo?: string;
  logo_dark?: string;
  favicon?: string;
  about_content: string;
  about_content_en: string;
  mission: string;
  mission_en: string;
  vision: string;
  vision_en: string;
  values: string;
  values_en: string;
}

export interface Service {
  id: string;
  service_key?: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  icon: string;
  image?: string;
  price_from?: number;
  cta_text: string;
  cta_text_en: string;
  cta_url: string;
  is_featured: boolean;
  position: number;
  is_active?: boolean;
  carousel_images?: ServiceImage[];
}

export interface LandingPageData {
  carousel: CarouselSlide[];
  promo_banners?: PromoBanner[];
  services: Service[];
  testimonials: Testimonial[];
  clients: ClientLogo[];
  faqs: FAQ[];
  branches: Branch[];
  portfolio_videos: PortfolioVideo[];
  portfolio_items: PortfolioItem[];
  config: SiteConfig;
}

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  privacy_accepted: boolean;
}

// ── Service Image (carousel images per service) ────────────────────────
export interface ServiceImage {
  id: string;
  image: string;
  alt_text: string;
  alt_text_en: string;
  subtype_key: string;
  display_format: 'landscape' | 'reel';
  position: number;
}

export interface ServiceImageAdmin extends ServiceImage {
  service: string; // service UUID
  is_active: boolean;
}

// ── Portfolio Video ─────────────────────────────────────────────────────
export interface PortfolioVideo {
  id: string;
  youtube_id: string;
  title: string;
  title_en: string;
  orientation: 'vertical' | 'horizontal';
  position: number;
  thumbnail_url: string;
}

export interface PortfolioVideoAdmin extends PortfolioVideo {
  is_active: boolean;
}

// ── Portfolio Item (unified image + video gallery) ─────────────────────
export interface PortfolioItem {
  id: string;
  media_type: 'image' | 'video';
  image?: string; // For image type
  youtube_id?: string; // For video type
  title: string;
  title_en: string;
  aspect_ratio: 'landscape_16_9' | 'portrait_reel_9_16';
  position: number;
}

export interface PortfolioItemAdmin extends PortfolioItem {
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const LANDING_CACHE_PREFIX = 'mcd:landing-cache:';
const DEFAULT_HOURS = 'Lunes a Viernes: 9:00 - 18:00 Sábados: 9:00 - 14:00';

type CachedEnvelope<T> = {
  timestamp: number;
  data: T;
};

function readCachedData<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${LANDING_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEnvelope<T>;
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function writeCachedData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedEnvelope<T> = { timestamp: Date.now(), data };
    window.localStorage.setItem(`${LANDING_CACHE_PREFIX}${key}`, JSON.stringify(payload));
  } catch {
    // Ignore storage quota/serialization issues.
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), ms);
    }),
  ]);
}

async function cacheFirstFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  fallbackFactory: () => T,
  timeoutMs = 1800,
): Promise<T> {
  const cached = readCachedData<T>(cacheKey);

  if (cached) {
    // Return immediately for fast paint; refresh in background.
    void fetcher()
      .then((fresh) => writeCachedData(cacheKey, fresh))
      .catch(() => {
        // Keep cached data on refresh error.
      });
    return cached;
  }

  try {
    const fresh = await withTimeout(fetcher(), timeoutMs);
    writeCachedData(cacheKey, fresh);
    return fresh;
  } catch {
    return fallbackFactory();
  }
}

function getFallbackCarouselSlides(): CarouselSlide[] {
  const fallbackImages = getFallbackCarouselImages();

  return fallbackImages.map((image, index) => ({
    id: `fallback-slide-${index + 1}`,
    title: 'Agencia MCD',
    title_en: 'MCD Agency',
    subtitle: 'Publicidad e impresión profesional en Guerrero',
    subtitle_en: 'Professional advertising and printing in Guerrero',
    image,
    cta_text: 'Solicitar cotización',
    cta_text_en: 'Request quote',
    cta_url: '/#cotizar',
    service_key: '',
    position: index,
  }));
}

function getFallbackClientLogos(): ClientLogo[] {
  return CLIENTS.map((client, index) => ({
    id: `fallback-client-${index + 1}`,
    name: client.name,
    logo: client.logo,
    website: '',
    position: index,
  }));
}

function getFallbackFAQs(): FAQ[] {
  return FAQ_ITEMS.map((item, index) => ({
    id: `fallback-faq-${index + 1}`,
    question: item.question,
    question_en: item.question,
    answer: item.answer,
    answer_en: item.answer,
    category: 'general',
    category_display: 'General',
    position: index,
  }));
}

function getFallbackBranches(): Branch[] {
  return LOCATIONS.map((location, index) => ({
    id: `fallback-branch-${location.id}`,
    name: location.name,
    street: location.address,
    neighborhood: '',
    city: location.city,
    state: 'Guerrero',
    postal_code: '',
    phone: location.phone,
    email: location.email,
    hours: DEFAULT_HOURS,
    hours_en: 'Mon-Fri: 9:00 - 18:00 Sat: 9:00 - 14:00',
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    full_address: location.address,
    position: index,
  }));
}

function getFallbackServices(): Service[] {
  return SERVICES.map((service, index) => ({
    id: service.id,
    service_key: service.id,
    name: service.title,
    name_en: service.title,
    description: service.description,
    description_en: service.description,
    icon: service.icon,
    image: service.image,
    cta_text: 'Solicitar cotización',
    cta_text_en: 'Request quote',
    cta_url: '/#cotizar',
    is_featured: index < 6,
    position: index,
    is_active: true,
    carousel_images: [],
  }));
}

function getFallbackSiteConfig(): SiteConfig {
  return {
    id: 'fallback-site-config',
    site_name: 'Agencia MCD',
    site_name_en: 'MCD Agency',
    tagline: 'Publicidad e impresión profesional',
    tagline_en: 'Professional advertising and printing',
    contact_email: 'ventas@agenciamcd.mx',
    contact_phone: '+52 744 688 7382',
    whatsapp_number: '+52 744 688 7382',
    social_links: {},
    about_content: '',
    about_content_en: '',
    mission: '',
    mission_en: '',
    vision: '',
    vision_en: '',
    values: '',
    values_en: '',
  };
}

function getFallbackLandingData(): LandingPageData {
  return {
    carousel: getFallbackCarouselSlides(),
    services: getFallbackServices(),
    testimonials: [],
    clients: getFallbackClientLogos(),
    faqs: getFallbackFAQs(),
    branches: getFallbackBranches(),
    portfolio_videos: [],
    portfolio_items: [],
    config: getFallbackSiteConfig(),
  };
}

// API Functions

/**
 * Get all landing page data in a single request.
 */
export async function getLandingPageData(): Promise<LandingPageData> {
  return cacheFirstFetch(
    'landing-data',
    () => apiClient.get<LandingPageData>('/content/landing/'),
    getFallbackLandingData,
    2200
  );
}

/**
 * Get carousel slides.
 */
export async function getCarouselSlides(): Promise<CarouselSlide[]> {
  return cacheFirstFetch(
    'carousel-slides',
    async () => {
      const response = await apiClient.get<{ results: CarouselSlide[] } | CarouselSlide[]>('/content/carousel/');
      const slides = Array.isArray(response) ? response : response.results;
      if (!slides || slides.length === 0) {
        return getFallbackCarouselSlides();
      }
      return slides;
    },
    getFallbackCarouselSlides,
    1800
  );
}

/**
 * Get active promo banners for the landing page.
 */
export async function getPromoBanners(): Promise<PromoBanner[]> {
  const response = await apiClient.get<{ results: PromoBanner[] } | PromoBanner[]>('/content/promo-banners/');
  return Array.isArray(response) ? response : response.results;
}

/**
 * Get testimonials.
 */
export async function getTestimonials(): Promise<Testimonial[]> {
  const response = await apiClient.get<{ results: Testimonial[] } | Testimonial[]>('/content/testimonials/');
  return Array.isArray(response) ? response : response.results;
}

/**
 * Get client logos.
 */
export async function getClientLogos(): Promise<ClientLogo[]> {
  return cacheFirstFetch(
    'client-logos',
    async () => {
      const response = await apiClient.get<{ results: ClientLogo[] } | ClientLogo[]>('/content/clients/');
      return Array.isArray(response) ? response : response.results;
    },
    getFallbackClientLogos,
    1800
  );
}

/**
 * Get FAQs.
 */
export async function getFAQs(category?: string): Promise<FAQ[]> {
  return cacheFirstFetch(
    `faqs:${category || 'all'}`,
    async () => {
      const response = await apiClient.get<{ results: FAQ[] } | FAQ[]>('/content/faqs/', { category });
      return Array.isArray(response) ? response : response.results;
    },
    getFallbackFAQs,
    1800
  );
}

/**
 * Get FAQ categories.
 */
export async function getFAQCategories(): Promise<Array<{ value: string; label: string }>> {
  return apiClient.get<Array<{ value: string; label: string }>>('/content/faqs/categories/');
}

/**
 * Get branches.
 */
export async function getBranches(): Promise<Branch[]> {
  type BranchListResponse = {
    count?: number;
    next?: string | null;
    previous?: string | null;
    results: Branch[];
  };

  const FRONTEND_BRANCH_PROXY = '/api/branches?preferFly=1';

  const isUuid = (value: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

  const normalizeText = (value: string): string =>
    (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\b(agencia|mcd|sucursal|cp|c\.p\.)\b/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const branchCompletenessScore = (branch: Branch): number => {
    let score = 0;
    if (branch.google_maps_url) score += 3;
    if (branch.latitude && branch.longitude) score += 2;
    if (branch.full_address) score += 2;
    if (branch.street) score += 1;
    if (branch.phone) score += 1;
    if (branch.email) score += 1;
    if (branch.hours) score += 1;
    return score;
  };

  const canonicalBranchConfigs: Array<{
    key: 'diamante' | 'yamaha' | 'tecoanapa';
    name: string;
    matcher: (normalizedName: string, normalizedAddress: string) => boolean;
  }> = [
        {
          key: 'diamante',
          name: 'Acapulco Diamante',
          matcher: (normalizedName, normalizedAddress) =>
            normalizedName.includes('diamante') ||
            normalizedAddress.includes('diamante') ||
            normalizedAddress.includes('granjas marquez') ||
            normalizedAddress.includes('plaza diamante'),
        },
        {
          key: 'yamaha',
          name: 'Acapulco Yamaha',
          matcher: (normalizedName, normalizedAddress) =>
            normalizedName.includes('yamaha') ||
            normalizedAddress.includes('yamaha') ||
            normalizedName.includes('costa azul') ||
            normalizedAddress.includes('costa azul'),
        },
        {
          key: 'tecoanapa',
          name: 'Tecoanapa',
          matcher: (normalizedName, normalizedAddress) =>
            normalizedName.includes('tecoanapa') ||
            normalizedAddress.includes('tecoanapa') ||
            normalizedAddress.includes('tierra colorada') ||
            normalizedAddress.includes('ayutla'),
        },
      ];

  const toCanonicalKey = (branch: Branch): 'diamante' | 'yamaha' | 'tecoanapa' | null => {
    const normalizedName = normalizeText(branch.name || '');
    const normalizedAddress = normalizeText(branch.street || branch.full_address || '');

    const match = canonicalBranchConfigs.find((config) =>
      config.matcher(normalizedName, normalizedAddress)
    );

    return match?.key || null;
  };

  const fetchAllRawBranches = async (initialEndpoint: string): Promise<Branch[]> => {
    const rawBranches: Branch[] = [];
    let endpoint: string | null = initialEndpoint;

    while (endpoint) {
      const response: BranchListResponse | Branch[] = await apiClient.get<BranchListResponse | Branch[]>(
        endpoint,
        { page_size: 100 }
      );

      if (Array.isArray(response)) {
        rawBranches.push(...response);
        break;
      }

      rawBranches.push(...(response.results || []));
      endpoint = response.next || null;
    }

    return rawBranches;
  };

  const fetchFromFrontendBranchProxy = async (): Promise<Branch[]> => {
    if (typeof window === 'undefined') return [];

    const response = await fetch(`${FRONTEND_BRANCH_PROXY}&page_size=100`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`branch proxy failed: ${response.status}`);
    }

    const payload = await response.json() as BranchListResponse | Branch[];
    return Array.isArray(payload) ? payload : (payload.results || []);
  };

  const toCanonicalBranches = (rawBranches: Branch[]): Branch[] => {
    const uuidApiBranches = rawBranches.filter((branch) => isUuid(branch.id));

    const canonicalByKey = new Map<'diamante' | 'yamaha' | 'tecoanapa', Branch>();

    for (const entry of uuidApiBranches) {
      const canonicalKey = toCanonicalKey(entry);
      if (!canonicalKey) continue;

      const existing = canonicalByKey.get(canonicalKey);
      if (!existing || branchCompletenessScore(entry) > branchCompletenessScore(existing)) {
        canonicalByKey.set(canonicalKey, entry);
      }
    }

    return canonicalBranchConfigs
      .map((config, index) => {
        const branch = canonicalByKey.get(config.key);
        if (!branch) return null;
        return {
          ...branch,
          name: config.name,
          position: index,
        } as Branch;
      })
      .filter((branch): branch is Branch => !!branch);
  };

  const primaryRawBranches = await fetchAllRawBranches('/content/branches/');
  let canonicalBranches = toCanonicalBranches(primaryRawBranches);

  const hasYamaha = canonicalBranches.some((branch) => {
    const normalizedName = normalizeText(branch.name || '');
    const normalizedAddress = normalizeText(branch.street || branch.full_address || '');
    return normalizedName.includes('yamaha') || normalizedAddress.includes('yamaha') || normalizedAddress.includes('costa azul');
  });

  if (!hasYamaha) {
    try {
      const flyRawBranches = await fetchFromFrontendBranchProxy();
      const mergedById = new Map<string, Branch>();

      for (const branch of [...primaryRawBranches, ...flyRawBranches]) {
        if (!branch?.id) continue;
        mergedById.set(branch.id, branch);
      }

      canonicalBranches = toCanonicalBranches(Array.from(mergedById.values()));
    } catch {
      // If Fly fallback is unavailable, keep primary source result.
    }
  }

  return canonicalBranches;
}

/**
 * Get legal page by type.
 */
export async function getLegalPage(type: 'terms' | 'privacy' | 'cookies' | 'legal'): Promise<LegalPage> {
  return apiClient.get<LegalPage>(`/content/legal/by-type/${type}/`);
}

/**
 * Get site configuration.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  return apiClient.get<SiteConfig>('/content/config/');
}

/**
 * Submit contact form.
 */
export async function submitContactForm(data: ContactFormData): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/content/contact/', data);
}

// ═══════════════════════════════════════════════════════════════════════════
// Client Logos Admin API
// ═══════════════════════════════════════════════════════════════════════════

export interface ClientLogoAdmin extends ClientLogo {
  is_active: boolean;
}

/**
 * Get all client logos (admin — includes inactive).
 */
export async function getAdminClientLogos(): Promise<ClientLogoAdmin[]> {
  try {
    const response = await apiClient.get<{ results: ClientLogoAdmin[] } | ClientLogoAdmin[]>('/content/clients/');
    const logos = Array.isArray(response) ? response : response.results;
    if (logos.length > 0) return logos;
  } catch {
    // Admin clients endpoint may be unavailable in this deployment; use landing fallback.
  }

  const landing = await getLandingPageData();
  const landingClients = (landing.clients || []).map((client, index) => ({
    id: client.id,
    name: client.name,
    logo: client.logo,
    website: client.website,
    position: client.position ?? index,
    is_active: true,
  }));

  if (landingClients.length > 0) return landingClients;

  return CLIENTS.map((client, index) => ({
    id: `legacy-client-${index}`,
    name: client.name,
    logo: client.logo,
    website: undefined,
    position: index,
    is_active: true,
  }));
}

/**
 * Create client logo with file upload (admin).
 */
export async function createClientLogo(data: {
  name: string;
  logo: File;
  website?: string;
  position?: number;
  is_active?: boolean;
}): Promise<ClientLogoAdmin> {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('logo', data.logo);
  if (data.website) formData.append('website', data.website);
  formData.append('position', String(data.position ?? 0));
  formData.append('is_active', String(data.is_active ?? true));
  return apiClient.upload<ClientLogoAdmin>('/content/clients/', formData);
}

/**
 * Update client logo (admin). Optionally replace logo file.
 */
export async function updateClientLogo(
  id: string,
  data: Record<string, unknown>,
  logoFile?: File,
): Promise<ClientLogoAdmin> {
  if (!logoFile) {
    return apiClient.patch<ClientLogoAdmin>(`/content/clients/${id}/`, data);
  }
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  formData.append('logo', logoFile);
  return apiClient.uploadPatch<ClientLogoAdmin>(`/content/clients/${id}/`, formData);
}

/**
 * Delete client logo (admin).
 */
export async function deleteClientLogo(id: string): Promise<void> {
  return apiClient.delete(`/content/clients/${id}/`);
}

// Admin types with is_active field
export interface CarouselSlideAdmin extends CarouselSlide {
  is_active: boolean;
}

export interface ServiceAdmin extends Service {
  is_active: boolean;
}

// Admin API Functions

/**
 * Get all carousel slides (admin).
 */
export async function getAdminCarouselSlides(): Promise<CarouselSlideAdmin[]> {
  const response = await apiClient.get<{ results: CarouselSlideAdmin[] } | CarouselSlideAdmin[]>('/content/carousel/');
  return Array.isArray(response) ? response : response.results;
}

/**
 * Create carousel slide (admin).
 */
export async function createCarouselSlide(data: Omit<CarouselSlideAdmin, 'id'>): Promise<CarouselSlideAdmin> {
  return apiClient.post<CarouselSlideAdmin>('/content/carousel/', data);
}

/**
 * Update carousel slide (admin).
 */
export async function updateCarouselSlide(id: string, data: Partial<CarouselSlideAdmin>): Promise<CarouselSlideAdmin> {
  return apiClient.patch<CarouselSlideAdmin>(`/content/carousel/${id}/`, data);
}

/**
 * Delete carousel slide (admin).
 */
export async function deleteCarouselSlide(id: string): Promise<void> {
  return apiClient.delete(`/content/carousel/${id}/`);
}

/**
 * Get all promo banners (admin).
 */
export async function getAdminPromoBanners(): Promise<PromoBannerAdmin[]> {
  const response = await apiClient.get<{ results: PromoBannerAdmin[] } | PromoBannerAdmin[]>('/content/promo-banners/');
  return Array.isArray(response) ? response : response.results;
}

export async function createPromoBanner(data: Partial<PromoBannerAdmin>): Promise<PromoBannerAdmin> {
  return apiClient.post<PromoBannerAdmin>('/content/promo-banners/', data);
}

export async function updatePromoBanner(id: string, data: Partial<PromoBannerAdmin>): Promise<PromoBannerAdmin> {
  return apiClient.patch<PromoBannerAdmin>(`/content/promo-banners/${id}/`, data);
}

export async function deletePromoBanner(id: string): Promise<void> {
  return apiClient.delete(`/content/promo-banners/${id}/`);
}

/**
 * Get all services (admin).
 */
export async function getAdminServices(): Promise<ServiceAdmin[]> {
  const response = await apiClient.get<{ results: ServiceAdmin[] } | ServiceAdmin[]>('/content/services/');
  return Array.isArray(response) ? response : response.results;
}

/**
 * Sync services: create any missing services from the known definitions.
 * Returns the full list of services after sync.
 */
export async function syncServices(definitions: Array<{
  service_key: string;
  name: string;
  name_en?: string;
  description?: string;
  icon?: string;
  position?: number;
}>): Promise<{ created: string[]; services: ServiceAdmin[] }> {
  return apiClient.post<{ created: string[]; services: ServiceAdmin[] }>('/content/services/sync/', { services: definitions });
}

/**
 * Create service (admin).
 */
export async function createService(data: Omit<ServiceAdmin, 'id'>): Promise<ServiceAdmin> {
  return apiClient.post<ServiceAdmin>('/content/services/', data);
}

/**
 * Update service (admin).
 */
export async function updateService(id: string, data: Partial<ServiceAdmin>): Promise<ServiceAdmin> {
  return apiClient.patch<ServiceAdmin>(`/content/services/${id}/`, data);
}

/**
 * Delete service (admin).
 */
export async function deleteService(id: string): Promise<void> {
  return apiClient.delete(`/content/services/${id}/`);
}

/**
 * Get services (public).
 */
export async function getServices(): Promise<Service[]> {
  return cacheFirstFetch(
    'services',
    async () => {
      const response = await apiClient.get<{ results: Service[] } | Service[]>('/content/services/');
      return Array.isArray(response) ? response : response.results;
    },
    getFallbackServices,
    1800
  );
}

/**
 * Get featured services.
 */
export async function getFeaturedServices(): Promise<Service[]> {
  const response = await apiClient.get<Service[]>('/content/services/featured/');
  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// Service Images API (file uploads via FormData)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get service images (admin), optionally filtered by service.
 */
export async function getAdminServiceImages(serviceId?: string): Promise<ServiceImageAdmin[]> {
  const params = serviceId ? { service: serviceId } : undefined;
  const response = await apiClient.get<{ results: ServiceImageAdmin[] } | ServiceImageAdmin[]>(
    '/content/service-images/', params
  );
  return Array.isArray(response) ? response : response.results;
}

/**
 * Upload a service image (admin). Uses FormData for file upload.
 */
export async function createServiceImage(data: {
  service: string;
  image: File;
  alt_text?: string;
  alt_text_en?: string;
  subtype_key?: string;
  display_format?: 'landscape' | 'reel';
  position?: number;
}): Promise<ServiceImageAdmin> {
  const formData = new FormData();
  formData.append('service', data.service);
  formData.append('image', data.image);
  if (data.alt_text) formData.append('alt_text', data.alt_text);
  if (data.alt_text_en) formData.append('alt_text_en', data.alt_text_en);
  if (data.subtype_key) formData.append('subtype_key', data.subtype_key);
  formData.append('display_format', data.display_format || 'landscape');
  formData.append('position', String(data.position ?? 0));
  formData.append('is_active', 'true');
  return apiClient.upload<ServiceImageAdmin>('/content/service-images/', formData);
}

/**
 * Update a service image (admin).
 */
export async function updateServiceImage(
  id: string,
  data: Partial<ServiceImageAdmin>
): Promise<ServiceImageAdmin> {
  return apiClient.patch<ServiceImageAdmin>(`/content/service-images/${id}/`, data);
}

export async function updateServiceImageWithFile(
  id: string,
  data: Partial<ServiceImageAdmin>,
  imageFile?: File,
): Promise<ServiceImageAdmin> {
  if (!imageFile) {
    return updateServiceImage(id, data);
  }

  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  formData.append('image', imageFile);

  return apiClient.uploadPatch<ServiceImageAdmin>(`/content/service-images/${id}/`, formData);
}

/**
 * Delete a service image (admin).
 */
export async function deleteServiceImage(id: string): Promise<void> {
  return apiClient.delete(`/content/service-images/${id}/`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Portfolio Videos API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get portfolio videos (public).
 */
export async function getPortfolioVideos(): Promise<PortfolioVideo[]> {
  return cacheFirstFetch(
    'portfolio-videos',
    async () => {
      const response = await apiClient.get<{ results: PortfolioVideo[] } | PortfolioVideo[]>(
        '/content/portfolio-videos/'
      );
      return Array.isArray(response) ? response : response.results;
    },
    () => [],
    1800
  );
}

/**
 * Get portfolio videos (admin — includes inactive).
 */
export async function getAdminPortfolioVideos(): Promise<PortfolioVideoAdmin[]> {
  const response = await apiClient.get<{ results: PortfolioVideoAdmin[] } | PortfolioVideoAdmin[]>(
    '/content/portfolio-videos/'
  );
  return Array.isArray(response) ? response : response.results;
}

/**
 * Create portfolio video (admin).
 */
export async function createPortfolioVideo(
  data: Omit<PortfolioVideoAdmin, 'id' | 'thumbnail_url'>
): Promise<PortfolioVideoAdmin> {
  return apiClient.post<PortfolioVideoAdmin>('/content/portfolio-videos/', data);
}

/**
 * Update portfolio video (admin).
 */
export async function updatePortfolioVideo(
  id: string,
  data: Partial<PortfolioVideoAdmin>
): Promise<PortfolioVideoAdmin> {
  return apiClient.patch<PortfolioVideoAdmin>(`/content/portfolio-videos/${id}/`, data);
}

/**
 * Delete portfolio video (admin).
 */
export async function deletePortfolioVideo(id: string): Promise<void> {
  return apiClient.delete(`/content/portfolio-videos/${id}/`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Portfolio Items (Unified Image + Video Gallery)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get portfolio items (public).
 */
export async function getPortfolioItems(): Promise<PortfolioItem[]> {
  return cacheFirstFetch(
    'portfolio-items',
    async () => {
      const response = await apiClient.get<{ results: PortfolioItem[] } | PortfolioItem[]>(
        '/content/portfolio-items/'
      );
      return Array.isArray(response) ? response : response.results;
    },
    () => [],
    1800
  );
}

/**
 * Get portfolio items (admin — includes inactive).
 */
export async function getAdminPortfolioItems(): Promise<PortfolioItemAdmin[]> {
  try {
    const response = await apiClient.get<{ results: PortfolioItemAdmin[] } | PortfolioItemAdmin[]>(
      '/content/portfolio-items/'
    );
    const items = Array.isArray(response) ? response : response.results;
    if (items.length > 0) return items;
  } catch {
    // Unified endpoint not available in this deployment; fall back to legacy sources.
  }

  const [landing, legacyVideos] = await Promise.all([
    getLandingPageData(),
    getAdminPortfolioVideos().catch(() => [] as PortfolioVideoAdmin[]),
  ]);

  const mappedVideos: PortfolioItemAdmin[] = legacyVideos.map((video, index) => ({
    id: `legacy-video-${video.id}`,
    media_type: 'video',
    youtube_id: video.youtube_id,
    title: video.title,
    title_en: video.title_en,
    aspect_ratio: video.orientation === 'vertical' ? 'portrait_reel_9_16' : 'landscape_16_9',
    position: index,
    is_active: video.is_active,
  }));

  const mappedImages: PortfolioItemAdmin[] = [];
  let position = mappedVideos.length;
  (landing.services || []).forEach((service) => {
    (service.carousel_images || []).forEach((img) => {
      if (!img.image) return;
      mappedImages.push({
        id: `legacy-image-${img.id}`,
        media_type: 'image',
        image: img.image,
        title: service.name || img.alt_text || 'Trabajo',
        title_en: service.name_en || img.alt_text_en || service.name || 'Work',
        aspect_ratio: img.display_format === 'reel' ? 'portrait_reel_9_16' : 'landscape_16_9',
        position,
        is_active: true,
      });
      position += 1;
    });
  });

  return [...mappedVideos, ...mappedImages];
}

/**
 * Create portfolio item with media file upload (admin).
 */
export async function createPortfolioItem(data: {
  media_type: 'image' | 'video';
  image?: File; // For image type
  youtube_id?: string; // For video type
  title?: string;
  title_en?: string;
  aspect_ratio: 'landscape_16_9' | 'portrait_reel_9_16';
  position?: number;
  is_active?: boolean;
}): Promise<PortfolioItemAdmin> {
  const formData = new FormData();
  formData.append('media_type', data.media_type);
  if (data.image) formData.append('image', data.image);
  if (data.youtube_id) formData.append('youtube_id', data.youtube_id);
  if (data.title) formData.append('title', data.title);
  if (data.title_en) formData.append('title_en', data.title_en);
  formData.append('aspect_ratio', data.aspect_ratio);
  formData.append('position', String(data.position ?? 0));
  formData.append('is_active', String(data.is_active ?? true));
  return apiClient.upload<PortfolioItemAdmin>('/content/portfolio-items/', formData);
}

/**
 * Update portfolio item with optional media file (admin).
 */
export async function updatePortfolioItem(
  id: string,
  data: Partial<PortfolioItemAdmin>,
  mediaFile?: File,
): Promise<PortfolioItemAdmin> {
  if (!mediaFile) {
    return apiClient.patch<PortfolioItemAdmin>(`/content/portfolio-items/${id}/`, data);
  }

  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && key !== 'image' && key !== 'youtube_id') {
      formData.append(key, String(value));
    }
  });
  if (mediaFile) {
    if (data.media_type === 'image') {
      formData.append('image', mediaFile);
    }
  }

  return apiClient.uploadPatch<PortfolioItemAdmin>(`/content/portfolio-items/${id}/`, formData);
}

/**
 * Delete portfolio item (admin).
 */
export async function deletePortfolioItem(id: string): Promise<void> {
  return apiClient.delete(`/content/portfolio-items/${id}/`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Carousel Slides — file upload variant
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create carousel slide with image file upload (admin).
 */
export async function createCarouselSlideWithFile(data: {
  title: string;
  title_en?: string;
  subtitle?: string;
  subtitle_en?: string;
  image: File;
  mobile_image?: File;
  cta_text?: string;
  cta_text_en?: string;
  cta_url?: string;
  service_key?: string;
  position?: number;
  is_active?: boolean;
}): Promise<CarouselSlideAdmin> {
  const formData = new FormData();
  formData.append('title', data.title);
  if (data.title_en) formData.append('title_en', data.title_en);
  if (data.subtitle) formData.append('subtitle', data.subtitle);
  if (data.subtitle_en) formData.append('subtitle_en', data.subtitle_en);
  formData.append('image', data.image);
  if (data.mobile_image) formData.append('mobile_image', data.mobile_image);
  if (data.cta_text) formData.append('cta_text', data.cta_text);
  if (data.cta_text_en) formData.append('cta_text_en', data.cta_text_en);
  if (data.cta_url) formData.append('cta_url', data.cta_url);
  if (data.service_key) formData.append('service_key', data.service_key);
  formData.append('position', String(data.position ?? 0));
  formData.append('is_active', String(data.is_active ?? true));
  return apiClient.upload<CarouselSlideAdmin>('/content/carousel/', formData);
}

/**
 * Update carousel slide with optional image file (admin).
 */
export async function updateCarouselSlideWithFile(
  id: string,
  data: Record<string, unknown>,
  imageFile?: File,
  mobileImageFile?: File,
): Promise<CarouselSlideAdmin> {
  if (!imageFile && !mobileImageFile) {
    return apiClient.patch<CarouselSlideAdmin>(`/content/carousel/${id}/`, data);
  }
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  if (imageFile) formData.append('image', imageFile);
  if (mobileImageFile) formData.append('mobile_image', mobileImageFile);
  return apiClient.uploadPatch<CarouselSlideAdmin>(`/content/carousel/${id}/`, formData);
}
