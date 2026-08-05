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
  type PromoBannerAdmin,
} from '@/lib/api/content';
import { getProducts, type ProductListItem } from '@/lib/api/catalog';
import { Card, Button, Input, Textarea, Modal, Badge } from '@/components/ui';
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

export function PromoBannersTab({
  promos,
  queryClient,
}: {
  promos: PromoBannerAdmin[];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PromoBannerAdmin | null>(null);
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    badge_text: '',
    cta_url: '',
    background_color: '#00E5FF',
    text_color: '#000000',
    discount_percent: 0,
    apply_to: 'all' as 'all' | 'selected',
    catalog_item_ids: [] as string[],
    position: 0,
    is_active: true,
  });

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

  const createMut = useMutation({
    mutationFn: createPromoBanner,
    onSuccess: () => {
      toast.success('Banner creado y precios actualizados en catálogo');
      queryClient.invalidateQueries({ queryKey: ['admin-promo-banners'] });
      queryClient.invalidateQueries({ queryKey: ['promo-banners'] });
      closeModal();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al crear banner')),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PromoBannerAdmin> }) =>
      updatePromoBanner(id, data),
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
    setForm({
      title: '',
      subtitle: '',
      badge_text: '',
      cta_url: '/catalogo',
      background_color: '#00E5FF',
      text_color: '#000000',
      discount_percent: 0,
      apply_to: 'all',
      catalog_item_ids: [],
      position: promos.length,
      is_active: true,
    });
    setShowModal(true);
  };

  const openEdit = (promo: PromoBannerAdmin) => {
    setEditing(promo);
    setForm({
      title: promo.title,
      subtitle: promo.subtitle || '',
      badge_text: promo.badge_text || '',
      cta_url: promo.cta_url || '',
      background_color: promo.background_color || '#00E5FF',
      text_color: promo.text_color || '#000000',
      discount_percent: Number(promo.discount_percent || 0),
      apply_to: promo.apply_to || 'all',
      catalog_item_ids: (promo.catalog_item_ids || []).filter((id) => productsById.has(id)),
      position: promo.position,
      is_active: promo.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
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

    const payload = {
      ...form,
      discount_percent: Number(form.discount_percent) || 0,
      badge_text: form.badge_text || (form.discount_percent > 0 ? `-${Math.round(form.discount_percent)}%` : ''),
    };

    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
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

            return (
              <Card key={promo.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div
                    className="rounded-xl px-4 py-3 min-w-[180px] border border-white/10"
                    style={{ backgroundColor: promo.background_color, color: promo.text_color }}
                  >
                    <p className="font-semibold text-sm">{promo.badge_text || promo.title}</p>
                    {promo.subtitle && <p className="text-xs opacity-80 mt-1">{promo.subtitle}</p>}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Descuento (%)"
              type="number"
              min={0}
              max={100}
              value={form.discount_percent}
              onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })}
            />
            <Input
              label="Color fondo"
              value={form.background_color}
              onChange={(e) => setForm({ ...form, background_color: e.target.value })}
            />
            <Input
              label="Color texto"
              value={form.text_color}
              onChange={(e) => setForm({ ...form, text_color: e.target.value })}
            />
          </div>

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
