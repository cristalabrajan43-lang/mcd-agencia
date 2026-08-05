'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';

import { getProducts, getCategories, getProductById, type ProductListItem, type Category } from '@/lib/api/catalog';
import { REAL_SERVICE_IDS, SERVICE_LABELS } from '@/lib/service-ids';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  deleteProductImage,
  createCategory,
  type CreateProductData,
} from '@/lib/api/admin';
import toast from 'react-hot-toast';
import { Card, Badge, Button, Input, Select, Modal, Pagination, LoadingPage } from '@/components/ui';
import { Textarea } from '@/components/ui/Textarea';
import { formatCurrency } from '@/lib/utils';

const SALE_MODE_OPTIONS = [
  { value: '', label: 'Todos los modos' },
  { value: 'BUY', label: 'Compra directa' },
  { value: 'QUOTE', label: 'Cotizable' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'product', label: 'Producto' },
  { value: 'service', label: 'Servicio' },
];

const MAX_IMAGES = 8;

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const getSaleModeVariant = (mode: string): 'success' | 'warning' | 'info' | 'default' => {
  const variants: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
    BUY: 'success',
    QUOTE: 'warning',
    HYBRID: 'info',
  };
  return variants[mode] || 'default';
};

const getSaleModeLabel = (mode: string): string => {
  const labels: Record<string, string> = {
    BUY: 'Compra',
    QUOTE: 'Cotizable',
    HYBRID: 'Ambos',
  };
  return labels[mode] || mode;
};

interface ProductFormData {
  type: 'product' | 'service';
  name: string;
  short_description: string;
  description: string;
  category_id: string;
  sale_mode: 'BUY' | 'QUOTE';
  payment_mode: 'FULL' | 'DEPOSIT_ALLOWED';
  base_price: string;
  compare_at_price: string;
  track_inventory: boolean;
  sku: string;
  initial_stock: string;
  low_stock_threshold: string;
  is_active: boolean;
  is_featured: boolean;
}

interface CategoryFormData {
  name: string;
}

const initialFormData: ProductFormData = {
  type: 'product',
  name: '',
  short_description: '',
  description: '',
  category_id: '',
  sale_mode: 'BUY',
  payment_mode: 'FULL',
  base_price: '',
  compare_at_price: '',
  track_inventory: false,
  sku: '',
  initial_stock: '0',
  low_stock_threshold: '10',
  is_active: true,
  is_featured: false,
};

const initialCategoryFormData: CategoryFormData = {
  name: '',
};

export default function AdminCatalogPage() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editProductId = searchParams.get('edit');
  const [filters, setFilters] = useState({
    sale_mode: '',
    type: '',
    search: '',
    page: 1,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductListItem | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState<CategoryFormData>(initialCategoryFormData);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [inventoryWarning, setInventoryWarning] = useState<string>('');

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['admin-products', filters],
    queryFn: () => getProducts({
      sale_mode: filters.sale_mode as 'BUY' | 'QUOTE' | undefined,
      type: filters.type as 'product' | 'service' | undefined,
      search: filters.search || undefined,
      page: filters.page,
      page_size: 20,
    }),
  });

  // Preload categories by type so switching Producto/Servicio is instant.
  const { data: productCategoriesData } = useQuery({
    queryKey: ['categories', 'product', 'active', 100],
    queryFn: () => getCategories('product', { is_active: true, page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: serviceCategoriesData } = useQuery({
    queryKey: ['categories', 'service', 'active', 100],
    queryFn: () => getCategories('service', { is_active: true, page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const products = productsData?.results || [];
  const totalPages = Math.ceil((productsData?.count || 0) / 20);
  const categories = formData.type === 'service'
    ? (serviceCategoriesData?.results || [])
    : (productCategoriesData?.results || []);

  const { data: editingProductDetail } = useQuery({
    queryKey: ['admin-product-detail', editingProduct?.id],
    queryFn: () => getProductById(editingProduct!.id),
    enabled: !!editingProduct,
  });

  useEffect(() => {
    if (!editingProduct || !editingProductDetail || !isModalOpen) return;

    setFormData((prev) => ({
      ...prev,
      description: editingProductDetail.description || prev.description,
      short_description: editingProductDetail.short_description || prev.short_description,
    }));
  }, [editingProduct, editingProductDetail, isModalOpen]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateProductData) => {
      const product = await createProduct(data) as { id: string };

      // Upload images if any
      if (selectedImages.length > 0) {
        try {
          await uploadProductImages(product.id, selectedImages);
          toast.success('Producto e imágenes creados');
        } catch {
          toast.error('Producto creado, pero hubo error al subir imágenes');
        }
      } else {
        toast.success('Producto creado');
      }
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      closeModal();
    },
    onError: (error: { message?: string; data?: Record<string, unknown> }) => {
      const detail = error?.data ? ` ${JSON.stringify(error.data)}` : '';
      toast.error(`Error al crear producto: ${error?.message || 'Solicitud inválida'}${detail}`);
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      return createCategory({
        name: categoryFormData.name,
        type: formData.type,
        is_active: true,
      });
    },
    onSuccess: (created: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setFormData((prev) => ({ ...prev, category_id: created.id }));
      setCategoryFormData(initialCategoryFormData);
      setIsCategoryModalOpen(false);
      toast.success('Categoría creada');
    },
    onError: (error: { message?: string; data?: Record<string, unknown> }) => {
      const detail = error?.data ? ` ${JSON.stringify(error.data)}` : '';
      toast.error(`Error al crear categoría: ${error?.message || 'Solicitud inválida'}${detail}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProductData> }) => updateProduct(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any ongoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-products', filters] });

      // Snapshot the previous data
      const previousData = queryClient.getQueryData(['admin-products', filters]);
      const pendingImages = [...selectedImages];

      // Optimistically update the cache
      queryClient.setQueryData(['admin-products', filters], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          results: old.results.map((product: ProductListItem) =>
            product.id === id 
              ? { 
                  ...product, 
                  is_active: data.is_active !== undefined ? data.is_active : product.is_active,
                  is_featured: data.is_featured !== undefined ? data.is_featured : product.is_featured,
                  name: data.name || product.name,
                  short_description: data.short_description || product.short_description,
                }
              : product
          ),
        };
      });

      // Close immediately to improve perceived response time.
      closeModal();
      toast.success('Cambios aplicados');

      // Return a context with the snapshot for rollback
      return { previousData, pendingImages };
    },
    onSuccess: (_, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products', filters] });

      if (context?.pendingImages?.length) {
        void uploadProductImages(variables.id, context.pendingImages)
          .then(() => undefined)
          .catch(() => toast.error('Producto actualizado, pero hubo error al subir imágenes'));
        return;
      }
    },
    onError: (_, __, context: any) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['admin-products', filters], context.previousData);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-products', filters] });
      toast.error('Error al actualizar producto');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setDeleteConfirm(null);
      setDeleteConfirmText('');
      toast.success('Producto eliminado del catálogo e inventario');
    },
    onError: (error: { message?: string; data?: Record<string, unknown> }) => {
      const detail = error?.data ? ` ${JSON.stringify(error.data)}` : '';
      toast.error(`Error al eliminar producto: ${error?.message || 'Solicitud inválida'}${detail}`);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => updateProduct(id, { is_active: false }),
    onMutate: async (id: string) => {
      // Cancel any ongoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-products', filters] });

      // Snapshot the previous data
      const previousData = queryClient.getQueryData(['admin-products', filters]);

      // Optimistically update the cache
      queryClient.setQueryData(['admin-products', filters], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          results: old.results.map((product: ProductListItem) =>
            product.id === id ? { ...product, is_active: false } : product
          ),
        };
      });

      // Return a context with the snapshot for rollback
      return { previousData };
    },
    onSuccess: () => {
      setDeleteConfirm(null);
      setDeleteConfirmText('');
      toast.success('Producto desactivado. Permanece en inventario y se oculta del catálogo.');
    },
    onError: (error: { message?: string; data?: Record<string, unknown> } | null, _, context: any) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['admin-products', filters], context.previousData);
      }
      const detail = error?.data ? ` ${JSON.stringify(error.data)}` : '';
      toast.error(`Error al desactivar producto: ${error?.message || 'Solicitud inválida'}${detail}`);
    },
  });

  useEffect(() => {
    if (!editProductId || products.length === 0 || isModalOpen) return;
    const productToEdit = products.find((p) => p.id === editProductId);
    if (!productToEdit) return;
    openEditModal(productToEdit);
    router.replace(`/${locale}/dashboard/catalogo`);
  }, [editProductId, products, isModalOpen, router, locale]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData(initialFormData);
    setInventoryWarning('');
    setSelectedImages([]);
    setImagePreview([]);
    setIsModalOpen(true);
  };

  const openEditModal = (product: ProductListItem) => {
    setEditingProduct(product);
    setFormData({
      type: product.type,
      name: product.name,
      short_description: product.short_description,
      description: product.short_description,
      category_id: product.category?.id || '',
      sale_mode: product.sale_mode === 'HYBRID' ? 'BUY' : product.sale_mode,
      payment_mode: 'FULL',
      base_price: product.base_price,
      compare_at_price: product.compare_at_price || '',
      track_inventory: false,
      sku: '',
      initial_stock: '0',
      low_stock_threshold: '10',
      is_active: product.is_active,
      is_featured: product.is_featured,
    });
    // Set existing images for preview if editing
    if (product.primary_image) {
      setImagePreview([product.primary_image.image]);
    } else {
      setImagePreview([]);
    }
    setSelectedImages([]);
    setInventoryWarning('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(initialFormData);
    setCategoryFormData(initialCategoryFormData);
    setIsCategoryModalOpen(false);
    setInventoryWarning('');
    setSelectedImages([]);
    setImagePreview([]);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const availableSlots = MAX_IMAGES - selectedImages.length;

    if (availableSlots <= 0) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes por producto`);
      return;
    }

    if (files.length > availableSlots) {
      toast.error(`Solo puedes agregar ${availableSlots} imagen(es) más`);
    }

    const filesToAdd = files.slice(0, availableSlots);
    setSelectedImages(prev => [...prev, ...filesToAdd]);

    // Create preview URLs
    const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));
    setImagePreview(prev => [...prev, ...newPreviews]);

    // Reset input so selecting the same file again triggers onChange
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreview(prev => prev.filter((_, i) => i !== index));
  };

  const updateInventoryWarning = (nextInitialStock: string, nextThreshold: string) => {
    const initial = Number(nextInitialStock || '0');
    const threshold = Number(nextThreshold || '0');

    if (!Number.isNaN(initial) && !Number.isNaN(threshold) && initial < threshold) {
      setInventoryWarning(
        'El stock inicial es menor que el umbral de stock bajo. El producto quedará marcado en alerta al crearse.'
      );
      return;
    }

    setInventoryWarning('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isCreate = !editingProduct;
    const isPurchasable = formData.sale_mode === 'BUY';
    const basePrice = Number(formData.base_price || '0');
    const comparePrice = Number(formData.compare_at_price || '0');

    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    if (!formData.type) {
      toast.error('El tipo es obligatorio');
      return;
    }

    if (!formData.category_id) {
      toast.error('La categoría es obligatoria');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('La descripción completa es obligatoria');
      return;
    }

    if (isCreate && imagePreview.length === 0) {
      toast.error('Debes subir al menos una imagen');
      return;
    }

    if (isCreate && imagePreview.length > MAX_IMAGES) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes por producto`);
      return;
    }

    if (isPurchasable) {
      if (!formData.base_price || Number.isNaN(basePrice) || basePrice <= 0) {
        toast.error('Para venta directa, el precio base es obligatorio y debe ser mayor a 0');
        return;
      }
      if (!formData.compare_at_price || Number.isNaN(comparePrice) || comparePrice <= 0) {
        toast.error('Para venta directa, el precio comparación es obligatorio y debe ser mayor a 0');
        return;
      }
      if (comparePrice < basePrice) {
        toast.error('El precio comparación debe ser mayor o igual al precio base');
        return;
      }
    }

    if (isCreate && formData.type === 'product') {
      if (!formData.track_inventory) {
        toast.error('Para productos nuevos debes activar gestión de inventario');
        return;
      }
      if (!formData.sku.trim()) {
        toast.error('El SKU es obligatorio para productos con inventario');
        return;
      }
      if (Number(formData.initial_stock || '0') < 0 || Number(formData.low_stock_threshold || '0') < 0) {
        toast.error('Stock inicial y umbral deben ser valores positivos');
        return;
      }
      if (Number(formData.initial_stock || '0') < Number(formData.low_stock_threshold || '0')) {
        toast('El sistema marcará este producto como stock bajo desde su creación.', { icon: '⚠️' });
      }
    }

    const data: CreateProductData = {
      type: formData.type,
      name: formData.name,
      short_description: formData.short_description || formData.description.slice(0, 140),
      description: formData.description || undefined,
      category_id: formData.category_id || undefined,
      sale_mode: formData.sale_mode,
      payment_mode: formData.payment_mode,
      base_price: formData.base_price || undefined,
      compare_at_price: formData.compare_at_price || undefined,
      track_inventory: formData.type === 'product' ? formData.track_inventory : false,
      is_active: formData.is_active,
      is_featured: formData.is_featured,
      ...(formData.type === 'product' && formData.track_inventory && !editingProduct
        ? {
            initial_sku: formData.sku.trim().toUpperCase(),
            initial_stock: Number(formData.initial_stock || '0'),
            initial_low_stock_threshold: Number(formData.low_stock_threshold || '10'),
          }
        : {}),
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (deleteConfirmText.trim().toLowerCase() !== 'eliminar') {
      toast.error('Escribe "eliminar" para confirmar.');
      return;
    }
    deleteMutation.mutate(id);
  };

  const selectedDeleteProduct = deleteConfirm
    ? products.find((product) => product.id === deleteConfirm) || null
    : null;

  // Build flat options from tree for filter Select component
  const formatCategoryLabel = (category: Category) => {
    if (category.breadcrumb && category.breadcrumb.length > 1) {
      return category.breadcrumb.map((item) => item.name).join(' / ');
    }
    return category.name;
  };

  const categoryOptions = [
    { value: '', label: 'Sin categoría' },
    ...categories.map((cat: Category) => ({ value: cat.id, label: formatCategoryLabel(cat) })),
  ];

  const serviceCategoriesBySlug = new Map(
    categories
      .filter((cat: Category) => cat.type === 'service' && cat.slug !== 'servicios' && cat.is_active)
      .map((cat: Category) => [cat.slug, cat])
  );

  const serviceCategoriesByName = new Map(
    categories
      .filter((cat: Category) => cat.type === 'service' && cat.slug !== 'servicios' && cat.is_active)
      .map((cat: Category) => [normalizeText(cat.name), cat])
  );

  const serviceCategoryOptions = REAL_SERVICE_IDS
    .map((serviceId) => {
      const serviceName = SERVICE_LABELS[serviceId];
      const bySlug = serviceCategoriesBySlug.get(serviceId);
      const byName = serviceCategoriesByName.get(normalizeText(serviceName));
      const category = bySlug || byName;

      if (!category) return null;

      return {
        value: category.id,
        label: serviceName,
      };
    })
    .filter((option): option is { value: string; label: string } => option !== null);

  const categoryOptionsForForm = formData.type === 'service'
    ? serviceCategoryOptions
    : categories.map((cat: Category) => ({ value: cat.id, label: formatCategoryLabel(cat) }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Catálogo</h1>
          <p className="text-neutral-400">
            Administra productos y servicios del catálogo
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <PlusIcon className="h-5 w-5 mr-2" />
          Nuevo producto
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nombre o SKU..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
            />
          </div>
          <Select
            value={filters.type}
            onChange={(value) => setFilters({ ...filters, type: value, page: 1 })}
            options={TYPE_OPTIONS}
            className="w-40"
          />
          <Select
            value={filters.sale_mode}
            onChange={(value) => setFilters({ ...filters, sale_mode: value, page: 1 })}
            options={SALE_MODE_OPTIONS}
            className="w-44"
          />
        </div>
      </Card>

      {/* Products Table */}
      {isLoading ? (
        <LoadingPage message="Cargando productos..." />
      ) : products.length === 0 ? (
        <Card className="text-center py-12">
          <PhotoIcon className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400 mb-4">No se encontraron productos</p>
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Crear primer producto
          </Button>
        </Card>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Producto
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Categoría
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Tipo
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Modo venta
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Precio
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Estado
                  </th>
                  <th className="text-right text-sm font-medium text-neutral-400 py-3 px-4">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-b border-neutral-800 hover:bg-neutral-900/50 ${product.is_active ? '' : 'opacity-55'}`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {product.primary_image ? (
                          <img
                            src={product.primary_image.image}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover bg-neutral-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center">
                            <PhotoIcon className="h-6 w-6 text-neutral-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">{product.name}</p>
                          <p className="text-sm text-neutral-400 truncate max-w-xs">
                            {product.short_description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {product.category ? (
                        <span className="text-neutral-300">{product.category.name}</span>
                      ) : (
                        <span className="text-neutral-500">Sin categoría</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={product.type === 'product' ? 'info' : 'default'}>
                        {product.type === 'product' ? 'Producto' : 'Servicio'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={getSaleModeVariant(product.sale_mode)}>
                        {getSaleModeLabel(product.sale_mode)}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      {product.sale_mode === 'QUOTE' ? (
                        <span className="text-neutral-400">A cotizar</span>
                      ) : (
                        <span className="text-white">
                          {formatCurrency(parseFloat(product.base_price))}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={product.is_active ? 'success' : 'default'}>
                          {product.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {product.is_featured && (
                          <Badge variant="info">Destacado</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {product.type === 'product' && (
                          <Link href={`/${locale}/dashboard/inventario`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Ir a inventario"
                            >
                              <ArchiveBoxIcon className="h-5 w-5" />
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(product)}
                          title="Editar"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(product.id)}
                          title="Eliminar"
                          className="text-red-400 hover:text-red-300"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {products.map((product) => (
              <Card
                key={product.id}
                padding="sm"
                className={`${product.is_active ? '' : 'opacity-55'} border border-neutral-800`}
              >
                <div className="flex items-start gap-3">
                  {product.primary_image ? (
                    <img
                      src={product.primary_image.image}
                      alt={product.name}
                      className="w-12 h-12 rounded-lg object-cover bg-neutral-800 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                      <PhotoIcon className="h-6 w-6 text-neutral-600" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{product.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{product.short_description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant={product.type === 'product' ? 'info' : 'default'}>
                        {product.type === 'product' ? 'Producto' : 'Servicio'}
                      </Badge>
                      <Badge variant={getSaleModeVariant(product.sale_mode)}>
                        {getSaleModeLabel(product.sale_mode)}
                      </Badge>
                      <Badge variant={product.is_active ? 'success' : 'default'}>
                        {product.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-neutral-500 truncate max-w-[55%]">
                    {product.category?.name || 'Sin categoría'}
                  </span>
                  <span className="text-white font-medium">
                    {product.sale_mode === 'QUOTE'
                      ? 'A cotizar'
                      : formatCurrency(parseFloat(product.base_price))}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1 border-t border-neutral-800 pt-2">
                  {product.type === 'product' && (
                    <Link href={`/${locale}/dashboard/inventario`}>
                      <Button variant="ghost" size="sm" title="Ir a inventario">
                        <ArchiveBoxIcon className="h-5 w-5" />
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(product)}
                    title="Editar"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(product.id)}
                    title="Eliminar"
                    className="text-red-400 hover:text-red-300"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={filters.page}
              totalPages={totalPages}
              onPageChange={(page) => setFilters({ ...filters, page })}
            />
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen && !isCategoryModalOpen}
        onClose={closeModal}
        title={editingProduct ? 'Editar producto' : 'Nuevo producto'}
        size="full"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Imágenes del producto *
            </label>
            <div className="flex flex-wrap gap-3 mb-3">
              {imagePreview.map((url, index) => (
                <div key={index} className="relative w-20 h-20">
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-neutral-700"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 border-2 border-dashed border-neutral-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-cyan-500 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  disabled={imagePreview.length >= MAX_IMAGES}
                  className="hidden"
                />
                <PlusIcon className="h-8 w-8 text-neutral-500" />
              </label>
            </div>
            <p className="text-xs text-neutral-500">
              Formatos: JPG, PNG, WebP. Máximo 5MB por imagen. Mínimo 1 imagen, máximo {MAX_IMAGES}.
            </p>
          </div>

          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Nombre *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nombre del producto"
              required
            />
          </div>

          {/* Type & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Tipo *
              </label>
              <Select
                value={formData.type}
                onChange={(value) => setFormData({
                  ...formData,
                  type: value as 'product' | 'service',
                  category_id: '',
                })}
                options={[
                  { value: 'product', label: 'Producto' },
                  { value: 'service', label: 'Servicio' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Categoría *
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => {
                  if (e.target.value === '__create_new__') {
                    setIsCategoryModalOpen(true);
                    return;
                  }
                  setFormData({ ...formData, category_id: e.target.value });
                }}
                required
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">Seleccionar categoría...</option>
                {categoryOptionsForForm.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
                <option value="__create_new__">+ Crear nueva categoría</option>
              </select>
              {categoryOptionsForForm.length === 0 && (
                <p className="text-xs text-amber-400 mt-2">
                  No hay categorías enlazadas. Crea una categoría con el mismo nombre del servicio en Contenido.
                </p>
              )}
            </div>
          </div>

          {/* Full Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Descripción completa *
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción detallada del producto (aparece en la página del producto)"
              rows={4}
              required
            />
          </div>

          {/* Sale Mode & Price */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Modo de venta *
              </label>
              <Select
                value={formData.sale_mode}
                onChange={(value) => setFormData({ ...formData, sale_mode: value as 'BUY' | 'QUOTE' })}
                options={[
                  { value: 'BUY', label: 'Compra directa' },
                  { value: 'QUOTE', label: 'Cotizable' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Precio base {formData.sale_mode === 'BUY' ? '*' : ''}
              </label>
              <Input
                type="number"
                step="0.01"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                placeholder="0.00"
                disabled={formData.sale_mode === 'QUOTE'}
                required={formData.sale_mode === 'BUY'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Precio comparación {formData.sale_mode === 'BUY' ? '*' : ''}
              </label>
              <Input
                type="number"
                step="0.01"
                value={formData.compare_at_price}
                onChange={(e) => setFormData({ ...formData, compare_at_price: e.target.value })}
                placeholder="0.00"
                disabled={formData.sale_mode === 'QUOTE'}
                required={formData.sale_mode === 'BUY'}
              />
              <p className="text-xs text-neutral-500 mt-1">
                Precio comparación: precio de referencia/lista para mostrar ahorro u oferta. Debe ser mayor o igual al precio base.
              </p>
            </div>
          </div>

          {/* Inventory Management */}
          {formData.type === 'product' && !editingProduct && (
            <div className="border border-neutral-700 rounded-lg p-4 space-y-4 bg-neutral-900/50">
              <h3 className="text-sm font-semibold text-neutral-200">Gestión de Inventario (solo alta inicial)</h3>
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={formData.track_inventory}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setFormData({ ...formData, track_inventory: enabled });
                      if (!enabled) setInventoryWarning('');
                    }}
                    className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-neutral-300">Rastrear inventario</span>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    SKU (Código único) *
                  </label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="SKU-001"
                    className="text-xs"
                    disabled={!formData.track_inventory}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Stock inicial *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.initial_stock}
                    onChange={(e) => {
                      const nextInitial = e.target.value;
                      setFormData({ ...formData, initial_stock: nextInitial });
                      updateInventoryWarning(nextInitial, formData.low_stock_threshold);
                    }}
                    placeholder="0"
                    className="text-xs"
                    disabled={!formData.track_inventory}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Umbral stock bajo *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.low_stock_threshold}
                    onChange={(e) => {
                      const nextThreshold = e.target.value;
                      setFormData({ ...formData, low_stock_threshold: nextThreshold });
                      updateInventoryWarning(formData.initial_stock, nextThreshold);
                    }}
                    placeholder="10"
                    className="text-xs"
                    disabled={!formData.track_inventory}
                  />
                </div>
              </div>
              <p className="text-xs text-neutral-500">
                Recomendación: define umbral según rotación del producto. Si el stock inicial queda debajo del umbral, el sistema lo marcará como stock bajo.
              </p>
              {inventoryWarning && (
                <p className="text-xs text-amber-400">{inventoryWarning}</p>
              )}
              <p className="text-xs text-neutral-500">
                Al crear producto con inventario, se genera una variante inicial y movimiento de stock.
              </p>
            </div>
          )}

          {formData.type === 'product' && !!editingProduct && (
            <div className="border border-neutral-700 rounded-lg p-4 space-y-3 bg-neutral-900/50">
              <h3 className="text-sm font-semibold text-neutral-200">Inventario</h3>
              <p className="text-xs text-neutral-400">
                La gestión de inventario no se edita desde catálogo para evitar inconsistencias. Usa el módulo de inventario para entradas, salidas y ajustes.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-md border border-neutral-700 bg-neutral-800/40 p-3">
                  <p className="text-neutral-400 mb-1">SKU</p>
                  <p className="text-cyan-400 font-mono break-all">{editingProductDetail?.variants?.[0]?.sku || 'Sin SKU'}</p>
                </div>
                <div className="rounded-md border border-neutral-700 bg-neutral-800/40 p-3">
                  <p className="text-neutral-400 mb-1">Stock actual</p>
                  <p className="text-white font-semibold">{editingProductDetail?.variants?.[0]?.stock ?? 0}</p>
                </div>
                <div className="rounded-md border border-neutral-700 bg-neutral-800/40 p-3">
                  <p className="text-neutral-400 mb-1">Umbral stock bajo</p>
                  <p className="text-white">{editingProductDetail?.variants?.[0]?.low_stock_threshold ?? 0}</p>
                </div>
              </div>
              <div>
                <Link
                  href={`/${locale}/dashboard/inventario${editingProductDetail?.variants?.[0]?.id ? `?variant=${editingProductDetail.variants[0].id}` : ''}`}
                  className="inline-block"
                >
                  <Button type="button" size="sm" variant="outline">
                    Ir a inventario de este producto
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Flags */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm text-neutral-300">Activo</span>
            </label>
            <label className={`flex items-center gap-2 ${formData.is_active ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
              <input
                type="checkbox"
                checked={formData.is_featured}
                onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500"
                disabled={!formData.is_active}
              />
              <span className={`text-sm ${formData.is_active ? 'text-neutral-300' : 'text-neutral-500'}`}>
                Destacado {!formData.is_active && '(requiere activo)'}
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button variant="ghost" type="button" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Guardando...'
                : editingProduct
                ? 'Guardar cambios'
                : 'Crear producto'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => {
          setDeleteConfirm(null);
          setDeleteConfirmText('');
        }}
        title="Confirmar eliminación"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-neutral-300">
            Esta acción eliminará el producto del catálogo y también lo quitará del inventario.
          </p>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Si quieres conservarlo en inventario y solo ocultarlo del catálogo, usa la opción <strong>Desactivar</strong>.
          </div>

          {selectedDeleteProduct && (
            <p className="text-xs text-neutral-400">
              Producto seleccionado: <span className="text-neutral-200 font-medium">{selectedDeleteProduct.name}</span>
            </p>
          )}

          <div>
            <label className="block text-xs text-neutral-400 mb-1">
              Escribe <span className="text-red-400 font-semibold">eliminar</span> para confirmar
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="eliminar"
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => deleteConfirm && deactivateMutation.mutate(deleteConfirm)}
            disabled={deactivateMutation.isPending || deleteMutation.isPending}
          >
            {deactivateMutation.isPending ? 'Desactivando...' : 'Desactivar'}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="bg-red-600 hover:bg-red-700"
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            disabled={deleteMutation.isPending || deleteConfirmText.trim().toLowerCase() !== 'eliminar'}
          >
            {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </Modal>

      {/* Create Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={`Nueva categoría de ${formData.type === 'service' ? 'servicio' : 'producto'}`}
        size="md"
        closeOnOverlayClick={false}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createCategoryMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Nombre de categoría *
            </label>
            <Input
              value={categoryFormData.name}
              onChange={(e) => setCategoryFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ej. Señalética vial"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-800">
            <Button variant="ghost" type="button" onClick={() => setIsCategoryModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createCategoryMutation.isPending || !categoryFormData.name.trim()}
            >
              {createCategoryMutation.isPending ? 'Creando...' : 'Crear categoría'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
