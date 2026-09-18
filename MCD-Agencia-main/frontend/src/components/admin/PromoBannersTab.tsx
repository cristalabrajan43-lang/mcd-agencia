'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import {
  createPromoBanner,
  updatePromoBanner,
  deletePromoBanner,
  type PromoBadgeShape,
  type PromoBackgroundStyle,
  type PromoBannerAdmin,
  type PromoFontFamily,
  type PromoGradientDirection,
  type PromoTextTransform,
  type PromoTitleSize,
  type PromoTitleWeight,
} from '@/lib/api/content';
import { getProducts, type ProductListItem } from '@/lib/api/catalog';
import { Card, Button, Input, Textarea, Modal, Badge } from '@/components/ui';
import { MediaImage } from '@/components/ui/MediaImage';
import { resolvePromoBannerStyle } from '@/lib/promo-banner-style';
import { cn } from '@/lib/utils';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message);
  }
  return fallback;
}

function formatPromoMoney(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

function getCatalogOriginalPrice(product: ProductListItem): number {
  const compare = Number(product.compare_at_price || 0);
  const base = Number(product.base_price || 0);
  if (compare > base) return compare;
  return base;
}

function getDiscountPreview(original: number, percent: number) {
  const safePercent = Math.min(100, Math.max(0, percent));
  const discountAmount = original * (safePercent / 100);
  return {
    original,
    discountAmount,
    newPrice: Math.max(0, original - discountAmount),
  };
}

function PromoPricePreview({
  products,
  discountPercent,
}: {
  products: ProductListItem[];
  discountPercent: number;
}) {
  if (discountPercent <= 0 || products.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        Ingresa un porcentaje de descuento para ver cuánto bajará el precio en catálogo.
      </p>
    );
  }

  const previewItems = products.slice(0, 6);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-white">Vista previa del descuento en catálogo</p>
      <div className="rounded-lg border border-neutral-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-800/80 text-neutral-400 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Producto</th>
              <th className="text-right px-3 py-2 font-medium">Precio actual</th>
              <th className="text-right px-3 py-2 font-medium">Baja</th>
              <th className="text-right px-3 py-2 font-medium">Precio final</th>
            </tr>
          </thead>
          <tbody>
            {previewItems.map((product) => {
              const original = getCatalogOriginalPrice(product);
              const preview = getDiscountPreview(original, discountPercent);
              return (
                <tr key={product.id} className="border-t border-neutral-800">
                  <td className="px-3 py-2 text-white">{product.name}</td>
                  <td className="px-3 py-2 text-right text-neutral-400 line-through">
                    {formatPromoMoney(preview.original)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400">
                    -{formatPromoMoney(preview.discountAmount)}
                  </td>
                  <td className="px-3 py-2 text-right text-green-400 font-semibold">
                    {formatPromoMoney(preview.newPrice)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {products.length > previewItems.length && (
        <p className="text-xs text-neutral-500">
          + {products.length - previewItems.length} producto(s) más con el mismo descuento
        </p>
      )}
    </div>
  );
}

function resolveFormImageUrl(
  form: PromoFormState,
  imagePreview: string | null,
  catalogProducts: ProductListItem[],
) {
  if (imagePreview) return imagePreview;
  const chosen = catalogProducts.find((product) => product.id === form.image_item_id);
  if (chosen?.primary_image?.image) return chosen.primary_image.image;
  if (form.apply_to === 'selected') {
    const firstWithPhoto = catalogProducts.find(
      (product) => form.catalog_item_ids.includes(product.id) && product.primary_image?.image
    );
    return firstWithPhoto?.primary_image?.image || null;
  }
  return null;
}

function ProductPhotoPicker({
  catalogProducts,
  selectedIds,
  applyTo,
  imageItemId,
  imagePreview,
  onSelectProduct,
  onUpload,
  onClear,
}: {
  catalogProducts: ProductListItem[];
  selectedIds: string[];
  applyTo: 'all' | 'selected';
  imageItemId: string;
  imagePreview: string | null;
  onSelectProduct: (product: ProductListItem) => void;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const sourceProducts = useMemo(() => {
    const pool =
      applyTo === 'selected' && selectedIds.length > 0
        ? catalogProducts.filter((product) => selectedIds.includes(product.id))
        : catalogProducts;
    return pool.filter((product) => product.primary_image?.image).slice(0, 12);
  }, [applyTo, catalogProducts, selectedIds]);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-white">Foto del producto</p>
        <p className="text-xs text-neutral-500">
          Elige la foto de un producto del catálogo o sube una imagen para el banner.
        </p>
      </div>

      {sourceProducts.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {sourceProducts.map((product) => {
            const selected = !imagePreview && imageItemId === product.id;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelectProduct(product)}
                className={cn(
                  'relative h-16 overflow-hidden rounded-lg border bg-neutral-800',
                  selected ? 'border-cyan-400 ring-2 ring-cyan-400/40' : 'border-neutral-700 hover:border-neutral-500'
                )}
                title={product.name}
              >
                <MediaImage
                  src={product.primary_image?.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-200 hover:border-neutral-500">
          Subir foto
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = '';
            }}
          />
        </label>
        {(imagePreview || imageItemId) && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-neutral-400 hover:text-white"
          >
            Quitar foto
          </button>
        )}
      </div>
    </div>
  );
}

function CatalogProductPicker({
  catalogProducts,
  selectedIds,
  onChange,
}: {
  catalogProducts: ProductListItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);

  const selectedProducts = useMemo(
    () => catalogProducts.filter((product) => selectedIds.includes(product.id)),
    [catalogProducts, selectedIds]
  );

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return catalogProducts.slice(0, 8);
    return catalogProducts.filter((product) => product.name.toLowerCase().includes(term)).slice(0, 8);
  }, [catalogProducts, search]);

  const addProduct = (product: ProductListItem) => {
    if (!selectedIds.includes(product.id)) {
      onChange([...selectedIds, product.id]);
    }
    setSearch('');
    setNotFoundMessage(null);
  };

  const removeProduct = (productId: string) => {
    onChange(selectedIds.filter((id) => id !== productId));
  };

  const tryAddFromSearch = () => {
    const term = search.trim();
    if (!term) return;

    const exactMatch = catalogProducts.find(
      (product) => product.name.toLowerCase() === term.toLowerCase()
    );
    if (exactMatch) {
      addProduct(exactMatch);
      return;
    }

    if (searchResults.length === 1) {
      addProduct(searchResults[0]);
      return;
    }

    setNotFoundMessage('Ese producto no está en el catálogo. Selecciónalo de la lista.');
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1">
          Buscar producto del catálogo
        </label>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setNotFoundMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                tryAddFromSearch();
              }
            }}
            placeholder="Escribe el nombre exacto o elige de la lista..."
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Solo puedes agregar productos que ya existen en el catálogo.
        </p>
      </div>

      {notFoundMessage && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
          {notFoundMessage}
        </div>
      )}

      {search.trim() && searchResults.length === 0 && !notFoundMessage && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
          Ese producto no está en el catálogo. Selecciónalo de la lista.
        </div>
      )}

      {search.trim() && searchResults.length > 0 && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900 overflow-hidden">
          {searchResults.map((product) => {
            const alreadySelected = selectedIds.includes(product.id);
            return (
              <button
                key={product.id}
                type="button"
                disabled={alreadySelected}
                onClick={() => addProduct(product)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-left text-sm border-b border-neutral-800 last:border-b-0',
                  alreadySelected
                    ? 'text-neutral-500 cursor-not-allowed'
                    : 'text-white hover:bg-neutral-800'
                )}
              >
                <span>{product.name}</span>
                <span className="text-xs text-neutral-400">
                  {formatPromoMoney(getCatalogOriginalPrice(product))}
                  {alreadySelected ? ' · Agregado' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedProducts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedProducts.map((product) => (
            <span
              key={product.id}
              className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-xs text-cyan-200"
            >
              {product.primary_image?.image && (
                <span className="relative h-5 w-5 overflow-hidden rounded-full bg-neutral-800">
                  <MediaImage src={product.primary_image.image} alt="" fill className="object-cover" />
                </span>
              )}
              {product.name}
              <button
                type="button"
                onClick={() => removeProduct(product.id)}
                className="hover:text-white"
                aria-label={`Quitar ${product.name}`}
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-500">Aún no has seleccionado productos.</p>
      )}
    </div>
  );
}

interface PromoFormState {
  title: string;
  subtitle: string;
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
  catalog_item_ids: string[];
  image_item_id: string;
  position: number;
  is_active: boolean;
}

function createEmptyForm(position: number): PromoFormState {
  return {
    title: '',
    subtitle: '',
    badge_text: '',
    cta_url: '/catalogo',
    background_color: '#00E5FF',
    background_style: 'solid',
    background_color_secondary: '',
    gradient_direction: 'to right',
    border_color: '',
    text_color: '#000000',
    subtitle_color: '',
    badge_background_color: '',
    badge_text_color: '',
    badge_shape: 'rounded',
    font_family: 'sans',
    title_size: 'sm',
    title_weight: 'semibold',
    text_transform: 'none',
    discount_percent: 0,
    apply_to: 'all',
    catalog_item_ids: [],
    image_item_id: '',
    position,
    is_active: true,
  };
}

type PromoPreset = {
  name: string;
  background_color: string;
  text_color: string;
  background_style: PromoBackgroundStyle;
  background_color_secondary: string;
};

const COLOR_PRESETS: PromoPreset[] = [
  { name: 'Cian MCD', background_color: '#00E5FF', text_color: '#000000', background_style: 'solid', background_color_secondary: '' },
  { name: 'Magenta', background_color: '#FF00A8', text_color: '#FFFFFF', background_style: 'solid', background_color_secondary: '' },
  { name: 'Amarillo', background_color: '#FFE500', text_color: '#000000', background_style: 'solid', background_color_secondary: '' },
  { name: 'Oferta roja', background_color: '#EF4444', text_color: '#FFFFFF', background_style: 'solid', background_color_secondary: '' },
  { name: 'Verde', background_color: '#22C55E', text_color: '#052E16', background_style: 'solid', background_color_secondary: '' },
  { name: 'Negro', background_color: '#111111', text_color: '#FFFFFF', background_style: 'solid', background_color_secondary: '' },
  { name: 'Degradado CMYK', background_color: '#00E5FF', text_color: '#FFFFFF', background_style: 'gradient', background_color_secondary: '#FF00A8' },
  { name: 'Atardecer', background_color: '#F97316', text_color: '#FFFFFF', background_style: 'gradient', background_color_secondary: '#DB2777' },
  { name: 'Noche', background_color: '#1E3A8A', text_color: '#FFFFFF', background_style: 'gradient', background_color_secondary: '#7C3AED' },
];

function ColorField({
  label,
  value,
  onChange,
  optional = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-10 flex-shrink-0 cursor-pointer rounded border border-neutral-700 bg-neutral-800 p-1"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={optional ? 'Automático' : '#000000'}
          className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm font-mono"
        />
        {optional && value !== '' && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex-shrink-0 text-neutral-400 hover:text-white"
            aria-label={`Restablecer ${label}`}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PromoBannerPreview({ form, imageUrl }: { form: PromoFormState; imageUrl?: string | null }) {
  const style = resolvePromoBannerStyle(form);
  const badge =
    form.badge_text ||
    (form.discount_percent > 0 ? `-${Math.round(form.discount_percent)}%` : '');

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-4">
      <p className="mb-3 text-xs uppercase tracking-wider text-neutral-500">
        Así se verá en la página de inicio
      </p>
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border px-4 py-3 min-w-[220px] max-w-[360px] shadow-lg',
          style.containerClassName
        )}
        style={style.containerStyle}
      >
        {imageUrl && (
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-black/10">
            <MediaImage src={imageUrl} alt={form.title || 'Producto'} fill className="object-cover" />
          </div>
        )}
        {badge && (
          <span
            className={cn(
              'inline-flex items-center justify-center px-2 py-1 text-xs font-bold whitespace-nowrap',
              style.badgeClassName
            )}
            style={style.badgeStyle}
          >
            {badge}
          </span>
        )}
        <div className="min-w-0">
          <p className={cn('leading-tight truncate', style.titleClassName)} style={style.titleStyle}>
            {form.title || 'Título del banner'}
          </p>
          {form.subtitle && (
            <p
              className={cn('leading-tight truncate mt-0.5', style.subtitleClassName)}
              style={style.subtitleStyle}
            >
              {form.subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PromoBannersTab({
  promos,
  queryClient,
}: {
  promos: PromoBannerAdmin[];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PromoBannerAdmin | null>(null);
  const [form, setForm] = useState<PromoFormState>(() => createEmptyForm(0));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [clearImage, setClearImage] = useState(false);

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['catalog-products-for-promos'],
    queryFn: () => getProducts({ page_size: 500 }),
  });

  const catalogProducts = useMemo(
    () =>
      (productsData?.results || []).filter(
        (product) =>
          product.is_active &&
          (product.sale_mode === 'BUY' || product.sale_mode === 'HYBRID') &&
          Number(product.base_price || 0) > 0
      ),
    [productsData?.results]
  );

  const productsById = useMemo(
    () => new Map(catalogProducts.map((product) => [product.id, product])),
    [catalogProducts]
  );

  const previewProducts = useMemo(() => {
    if (form.apply_to === 'all') return catalogProducts;
    return form.catalog_item_ids
      .map((id) => productsById.get(id))
      .filter((product): product is ProductListItem => Boolean(product));
  }, [form.apply_to, form.catalog_item_ids, catalogProducts, productsById]);

  const previewImageUrl = resolveFormImageUrl(form, imagePreview, catalogProducts);

  const createMut = useMutation({
    mutationFn: ({ data, file }: { data: Partial<PromoBannerAdmin>; file?: File | null }) =>
      createPromoBanner(data, file),
    onSuccess: () => {
      toast.success('Banner creado y precios actualizados en catálogo');
      queryClient.invalidateQueries({ queryKey: ['admin-promo-banners'] });
      queryClient.invalidateQueries({ queryKey: ['promo-banners'] });
      closeModal();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al crear banner')),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      data,
      file,
    }: {
      id: string;
      data: Partial<PromoBannerAdmin>;
      file?: File | null;
    }) => updatePromoBanner(id, data, file),
    onSuccess: () => {
      toast.success('Banner actualizado');
      queryClient.invalidateQueries({ queryKey: ['admin-promo-banners'] });
      queryClient.invalidateQueries({ queryKey: ['promo-banners'] });
      closeModal();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al actualizar')),
  });

  const deleteMut = useMutation({
    mutationFn: deletePromoBanner,
    onSuccess: () => {
      toast.success('Banner eliminado');
      queryClient.invalidateQueries({ queryKey: ['admin-promo-banners'] });
      queryClient.invalidateQueries({ queryKey: ['promo-banners'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al eliminar')),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(createEmptyForm(promos.length));
    setImageFile(null);
    setImagePreview(null);
    setClearImage(false);
    setShowModal(true);
  };

  const openEdit = (promo: PromoBannerAdmin) => {
    const defaults = createEmptyForm(promo.position);
    setEditing(promo);
    setForm({
      ...defaults,
      title: promo.title,
      subtitle: promo.subtitle || '',
      badge_text: promo.badge_text || '',
      cta_url: promo.cta_url || '',
      background_color: promo.background_color || defaults.background_color,
      background_style: promo.background_style || defaults.background_style,
      background_color_secondary: promo.background_color_secondary || '',
      gradient_direction: promo.gradient_direction || defaults.gradient_direction,
      border_color: promo.border_color || '',
      text_color: promo.text_color || defaults.text_color,
      subtitle_color: promo.subtitle_color || '',
      badge_background_color: promo.badge_background_color || '',
      badge_text_color: promo.badge_text_color || '',
      badge_shape: promo.badge_shape || defaults.badge_shape,
      font_family: promo.font_family || defaults.font_family,
      title_size: promo.title_size || defaults.title_size,
      title_weight: promo.title_weight || defaults.title_weight,
      text_transform: promo.text_transform || defaults.text_transform,
      discount_percent: Number(promo.discount_percent || 0),
      apply_to: promo.apply_to || 'all',
      catalog_item_ids: (promo.catalog_item_ids || []).filter((id) => productsById.has(id)),
      image_item_id: promo.image_item_id || '',
      is_active: promo.is_active,
    });
    setImageFile(null);
    setImagePreview(promo.image || null);
    setClearImage(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setImageFile(null);
    setImagePreview(null);
    setClearImage(false);
  };

  const toggleActive = (promo: PromoBannerAdmin) => {
    updatePromoBanner(promo.id, { is_active: !promo.is_active }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo-banners'] });
      queryClient.invalidateQueries({ queryKey: ['promo-banners'] });
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (form.apply_to === 'selected' && form.catalog_item_ids.length === 0) {
      toast.error('Selecciona al menos un producto del catálogo.');
      return;
    }

    const invalidIds = form.catalog_item_ids.filter((id) => !productsById.has(id));
    if (invalidIds.length > 0) {
      toast.error('Hay productos seleccionados que ya no están en el catálogo.');
      return;
    }

    if (form.background_style === 'gradient' && !form.background_color_secondary) {
      toast.error('Elige el segundo color del degradado.');
      return;
    }

    const payload: Partial<PromoBannerAdmin> = {
      ...form,
      image_item_id: form.image_item_id || null,
      clear_image: clearImage && !imageFile,
      discount_percent: Number(form.discount_percent) || 0,
      badge_text: form.badge_text || (form.discount_percent > 0 ? `-${Math.round(form.discount_percent)}%` : ''),
    };

    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload, file: imageFile });
    } else {
      createMut.mutate({ data: payload, file: imageFile });
    }
  };

  const sorted = [...promos].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-sm text-neutral-400">
            Crea banners debajo del hero y vincula descuentos reales a productos del catálogo.
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            El admin ve cuánto baja el precio antes de publicar.
          </p>
        </div>
        <Button onClick={openCreate} className="flex-shrink-0">
          <PlusIcon className="h-5 w-5 mr-1" /> Nuevo banner
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-neutral-400">No hay banners de descuento</p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>
            Agregar primer banner
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map((promo) => {
            const linkedNames =
              promo.apply_to === 'selected'
                ? (promo.catalog_item_ids || [])
                    .map((id) => productsById.get(id)?.name)
                    .filter(Boolean)
                : [];

            const promoStyle = resolvePromoBannerStyle(promo);

            return (
              <Card key={promo.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 min-w-[180px] border',
                      promoStyle.containerClassName
                    )}
                    style={promoStyle.containerStyle}
                  >
                    {promo.image_url && (
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-black/10">
                        <MediaImage src={promo.image_url} alt={promo.title} fill className="object-cover" />
                      </div>
                    )}
                    <div className="min-w-0">
                    <p className={promoStyle.titleClassName} style={promoStyle.titleStyle}>
                      {promo.badge_text || promo.title}
                    </p>
                    {promo.subtitle && (
                      <p
                        className={cn('mt-1', promoStyle.subtitleClassName)}
                        style={promoStyle.subtitleStyle}
                      >
                        {promo.subtitle}
                      </p>
                    )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-medium text-white">{promo.title}</h3>
                      <Badge variant={promo.is_active ? 'success' : 'default'}>
                        {promo.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      {promo.discount_percent > 0 && (
                        <Badge variant="warning">{promo.discount_percent}% en catálogo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">
                      {promo.apply_to === 'all'
                        ? `Aplica a ${catalogProducts.length} producto(s) del catálogo`
                        : linkedNames.length > 0
                        ? `Productos: ${linkedNames.join(', ')}`
                        : 'Sin productos vinculados'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(promo)}>
                      {promo.is_active ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(promo)}>
                      <PencilIcon className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('¿Eliminar banner?')) deleteMut.mutate(promo.id);
                      }}
                    >
                      <TrashIcon className="h-5 w-5 text-red-400" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar banner' : 'Nuevo banner'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Título del banner"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <Input
              label="Badge (ej. -20%)"
              value={form.badge_text}
              onChange={(e) => setForm({ ...form, badge_text: e.target.value })}
              placeholder="Se autocompleta con el descuento"
            />
          </div>

          <Textarea
            label="Subtítulo"
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            rows={2}
          />

          <Input
            label="Descuento (%)"
            type="number"
            min={0}
            max={100}
            value={form.discount_percent}
            onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })}
          />

          <Card className="p-4 bg-neutral-900/60 border-neutral-700 space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-white">Apariencia</p>
              <p className="text-xs text-neutral-500">
                Los colores marcados como &quot;Automático&quot; se calculan a partir del color de
                texto.
              </p>
            </div>

            <PromoBannerPreview form={form} imageUrl={previewImageUrl} />

            <ProductPhotoPicker
              catalogProducts={catalogProducts}
              selectedIds={form.catalog_item_ids}
              applyTo={form.apply_to}
              imageItemId={form.image_item_id}
              imagePreview={imagePreview}
              onSelectProduct={(product) => {
                setImageFile(null);
                setImagePreview(null);
                setClearImage(Boolean(editing?.image));
                setForm({ ...form, image_item_id: product.id });
              }}
              onUpload={(file) => {
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
                setClearImage(false);
              }}
              onClear={() => {
                setImageFile(null);
                setImagePreview(null);
                setClearImage(true);
                setForm({ ...form, image_item_id: '' });
              }}
            />

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Paletas rápidas</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        background_color: preset.background_color,
                        text_color: preset.text_color,
                        background_style: preset.background_style,
                        background_color_secondary: preset.background_color_secondary,
                      })
                    }
                    className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 hover:border-neutral-500"
                  >
                    <span
                      className="h-4 w-6 flex-shrink-0 rounded"
                      style={{
                        background:
                          preset.background_style === 'gradient'
                            ? `linear-gradient(to right, ${preset.background_color}, ${preset.background_color_secondary})`
                            : preset.background_color,
                      }}
                    />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Estilo de fondo"
                value={form.background_style}
                onChange={(background_style) => setForm({ ...form, background_style })}
                options={[
                  { value: 'solid', label: 'Color sólido' },
                  { value: 'gradient', label: 'Degradado' },
                ]}
              />
              {form.background_style === 'gradient' && (
                <SelectField
                  label="Dirección del degradado"
                  value={form.gradient_direction}
                  onChange={(gradient_direction) => setForm({ ...form, gradient_direction })}
                  options={[
                    { value: 'to right', label: 'Izquierda a derecha' },
                    { value: 'to left', label: 'Derecha a izquierda' },
                    { value: 'to bottom', label: 'Arriba a abajo' },
                    { value: '135deg', label: 'Diagonal' },
                  ]}
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ColorField
                label="Color de fondo"
                value={form.background_color}
                onChange={(background_color) => setForm({ ...form, background_color })}
              />
              {form.background_style === 'gradient' && (
                <ColorField
                  label="Segundo color del degradado"
                  value={form.background_color_secondary}
                  onChange={(background_color_secondary) =>
                    setForm({ ...form, background_color_secondary })
                  }
                />
              )}
              <ColorField
                label="Color del título"
                value={form.text_color}
                onChange={(text_color) => setForm({ ...form, text_color })}
              />
              <ColorField
                label="Color del subtítulo"
                value={form.subtitle_color}
                onChange={(subtitle_color) => setForm({ ...form, subtitle_color })}
                optional
              />
              <ColorField
                label="Color del borde"
                value={form.border_color}
                onChange={(border_color) => setForm({ ...form, border_color })}
                optional
              />
              <ColorField
                label="Fondo del badge"
                value={form.badge_background_color}
                onChange={(badge_background_color) => setForm({ ...form, badge_background_color })}
                optional
              />
              <ColorField
                label="Texto del badge"
                value={form.badge_text_color}
                onChange={(badge_text_color) => setForm({ ...form, badge_text_color })}
                optional
              />
              <SelectField
                label="Forma del badge"
                value={form.badge_shape}
                onChange={(badge_shape) => setForm({ ...form, badge_shape })}
                options={[
                  { value: 'pill', label: 'Redondeado completo' },
                  { value: 'rounded', label: 'Esquinas suaves' },
                  { value: 'square', label: 'Cuadrado' },
                ]}
              />
            </div>

            <div className="border-t border-neutral-800 pt-4">
              <p className="text-sm font-medium text-white mb-3">Tipografía</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Tipo de letra"
                  value={form.font_family}
                  onChange={(font_family) => setForm({ ...form, font_family })}
                  options={[
                    { value: 'sans', label: 'Inter (moderna)' },
                    { value: 'display', label: 'Montserrat (títulos)' },
                    { value: 'mono', label: 'Fira Code (monoespaciada)' },
                  ]}
                />
                <SelectField
                  label="Tamaño del texto"
                  value={form.title_size}
                  onChange={(title_size) => setForm({ ...form, title_size })}
                  options={[
                    { value: 'sm', label: 'Pequeño' },
                    { value: 'base', label: 'Mediano' },
                    { value: 'lg', label: 'Grande' },
                    { value: 'xl', label: 'Muy grande' },
                  ]}
                />
                <SelectField
                  label="Grosor del título"
                  value={form.title_weight}
                  onChange={(title_weight) => setForm({ ...form, title_weight })}
                  options={[
                    { value: 'medium', label: 'Normal' },
                    { value: 'semibold', label: 'Seminegrita' },
                    { value: 'bold', label: 'Negrita' },
                    { value: 'black', label: 'Extra negrita' },
                  ]}
                />
                <SelectField
                  label="Mayúsculas"
                  value={form.text_transform}
                  onChange={(text_transform) => setForm({ ...form, text_transform })}
                  options={[
                    { value: 'none', label: 'Como se escribió' },
                    { value: 'uppercase', label: 'TODO EN MAYÚSCULAS' },
                    { value: 'capitalize', label: 'Primera Letra Mayúscula' },
                  ]}
                />
              </div>
            </div>
          </Card>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              ¿A qué productos del catálogo aplica?
            </label>
            <select
              value={form.apply_to}
              onChange={(e) =>
                setForm({
                  ...form,
                  apply_to: e.target.value as 'all' | 'selected',
                  catalog_item_ids: e.target.value === 'all' ? [] : form.catalog_item_ids,
                })
              }
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm"
            >
              <option value="all">Todos los productos comprables del catálogo</option>
              <option value="selected">Solo productos seleccionados</option>
            </select>
          </div>

          {form.apply_to === 'selected' && (
            productsLoading ? (
              <p className="text-sm text-neutral-500">Cargando productos del catálogo...</p>
            ) : catalogProducts.length === 0 ? (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
                No hay productos comprables en el catálogo todavía.
              </div>
            ) : (
              <CatalogProductPicker
                catalogProducts={catalogProducts}
                selectedIds={form.catalog_item_ids}
                onChange={(catalog_item_ids) => setForm({ ...form, catalog_item_ids })}
              />
            )
          )}

          <Card className="p-4 bg-neutral-900/60 border-neutral-700">
            <PromoPricePreview products={previewProducts} discountPercent={form.discount_percent} />
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Posición"
              type="number"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: Number(e.target.value) })}
            />
            <Input
              label="URL destino"
              value={form.cta_url}
              onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
              placeholder="/catalogo"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Publicar banner y aplicar descuento en catálogo
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {editing ? 'Guardar cambios' : 'Publicar banner'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
