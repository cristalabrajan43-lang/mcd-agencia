'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Squares2X2Icon, ListBulletIcon, TagIcon } from '@heroicons/react/24/outline';

import { getProducts, getCategories, getAttributes, ProductFilters as IProductFilters, Product } from '@/lib/api/catalog';

type SaleMode = 'BUY' | 'QUOTE' | 'HYBRID';
import { ProductCard, ProductFilters } from '@/components/catalog';
import { Breadcrumb, Pagination, LoadingPage, Button, Select } from '@/components/ui';
import { cn, debounce } from '@/lib/utils';

const SORT_OPTIONS = [
  { value: '-created_at', label: 'Más recientes' },
  { value: 'name', label: 'Nombre (A-Z)' },
  { value: '-name', label: 'Nombre (Z-A)' },
];

export default function CatalogPage() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const catalogPath = `/${locale}/catalogo`;

  const promoParam = searchParams.get('promo') || undefined;
  const offersOnly = searchParams.get('ofertas') === '1' || Boolean(promoParam);

  // Parse URL params
  const saleModeParam = searchParams.get('modo') as SaleMode | null;
  const initialFilters: IProductFilters = {
    category_slug: searchParams.get('categoria') || undefined,
    sale_mode: saleModeParam || undefined,
    search: searchParams.get('buscar') || undefined,
    min_price: searchParams.get('precio_min') ? Number(searchParams.get('precio_min')) : undefined,
    max_price: searchParams.get('precio_max') ? Number(searchParams.get('precio_max')) : undefined,
    ordering: searchParams.get('orden') || '-created_at',
    page: searchParams.get('pagina') ? Number(searchParams.get('pagina')) : 1,
    page_size: 20,
    has_discount: promoParam ? undefined : offersOnly ? true : undefined,
    promo_banner: promoParam,
  };

  const [filters, setFilters] = useState<IProductFilters>(initialFilters);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState(initialFilters.search || '');

  useEffect(() => {
    setFilters(initialFilters);
    setSearchQuery(initialFilters.search || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Fetch data
  const { data: productsData, isLoading: isLoadingProducts, isError: isProductsError, refetch: refetchProducts } = useQuery({
    queryKey: ['products', filters, selectedAttributes],
    queryFn: () => getProducts(filters),
    retry: 2,
    staleTime: 30_000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const { data: attributesData } = useQuery({
    queryKey: ['attributes'],
    queryFn: getAttributes,
  });

  // Update URL when filters change
  const updateUrl = useCallback((newFilters: IProductFilters, options?: { promo?: string; ofertas?: boolean }) => {
    const params = new URLSearchParams();
    if (newFilters.category_slug) params.set('categoria', newFilters.category_slug);
    if (newFilters.sale_mode) params.set('modo', newFilters.sale_mode);
    if (newFilters.search) params.set('buscar', newFilters.search);
    if (newFilters.min_price) params.set('precio_min', String(newFilters.min_price));
    if (newFilters.max_price) params.set('precio_max', String(newFilters.max_price));
    if (newFilters.ordering && newFilters.ordering !== '-created_at') params.set('orden', newFilters.ordering);
    if (newFilters.page && newFilters.page > 1) params.set('pagina', String(newFilters.page));
    if (options?.promo) params.set('promo', options.promo);
    else if (options?.ofertas || newFilters.has_discount) params.set('ofertas', '1');

    const queryString = params.toString();
    router.push(`${catalogPath}${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [router, catalogPath]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      const newFilters = { ...filters, search: query || undefined, page: 1 };
      setFilters(newFilters);
      updateUrl(newFilters);
    }, 300),
    [filters, updateUrl]
  );

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleCategoryChange = (categorySlug?: string) => {
    const newFilters = { ...filters, category_slug: categorySlug, page: 1 };
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  const handleSaleModeChange = (saleMode?: SaleMode) => {
    const newFilters = { ...filters, sale_mode: saleMode, page: 1 };
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  const handlePriceRangeChange = (range: { min?: number; max?: number }) => {
    const newFilters = { ...filters, min_price: range.min, max_price: range.max, page: 1 };
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  const handleAttributeChange = (attributeSlug: string, values: string[]) => {
    setSelectedAttributes((prev) => {
      if (values.length === 0) {
        const { [attributeSlug]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [attributeSlug]: values };
    });
  };

  const handleSortChange = (value: string) => {
    const newFilters = { ...filters, ordering: value, page: 1 };
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  const handlePageChange = (page: number) => {
    const newFilters = { ...filters, page };
    setFilters(newFilters);
    updateUrl(newFilters);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearFilters = () => {
    const cleared: IProductFilters = { ordering: '-created_at', page: 1, page_size: 20 };
    setFilters(cleared);
    setSelectedAttributes({});
    setSearchQuery('');
    router.push(catalogPath);
  };

  const products = productsData?.results || [];
  const totalProducts = productsData?.count || 0;
  const totalPages = Math.ceil((productsData?.count || 0) / (filters.page_size || 12));
  const categories = categoriesData?.results || [];
  const attributes = attributesData?.results || [];

  return (
    <div className="min-h-screen pt-24 pb-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Catálogo', href: filters.category_slug ? catalogPath : undefined },
            ...(filters.category_slug
              ? [{ label: categories.find((c) => c.slug === filters.category_slug)?.name || '' }]
              : []),
          ]}
          className="mb-6"
        />

        {offersOnly && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-cmyk-cyan/30 bg-cmyk-cyan/10 px-4 py-3">
            <TagIcon className="h-5 w-5 text-cmyk-cyan flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Productos en promoción</p>
              <p className="text-xs text-neutral-400">
                {promoParam
                  ? 'Mostrando los productos incluidos en esta promoción.'
                  : 'Mostrando productos con descuento activo en el catálogo.'}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {filters.category_slug
                ? categories.find((c) => c.slug === filters.category_slug)?.name || 'Catálogo'
                : 'Catálogo'}
            </h1>
            <p className="text-neutral-400">
              {totalProducts} {totalProducts === 1 ? 'producto' : 'productos'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Sort */}
            <Select
              value={filters.ordering || '-created_at'}
              onChange={handleSortChange}
              options={SORT_OPTIONS}
              className="w-48"
            />

            {/* View mode */}
            <div className="flex border border-neutral-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid'
                    ? 'bg-yellow-400 text-neutral-900'
                    : 'text-neutral-400 hover:text-yellow-400'
                )}
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list'
                    ? 'bg-cyan-500 text-neutral-900'
                    : 'text-neutral-400 hover:text-cyan-400'
                )}
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <ProductFilters
              categories={categories}
              attributes={attributes}
              selectedCategory={filters.category_slug}
              selectedSaleMode={filters.sale_mode}
              selectedAttributes={selectedAttributes}
              priceRange={{ min: filters.min_price, max: filters.max_price }}
              searchQuery={searchQuery}
              onCategoryChange={handleCategoryChange}
              onSaleModeChange={handleSaleModeChange}
              onAttributeChange={handleAttributeChange}
              onPriceRangeChange={handlePriceRangeChange}
              onSearchChange={handleSearchChange}
              onClearFilters={handleClearFilters}
            />
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {/* Info Banner */}
            <div className="bg-cmyk-cyan/10 border border-cmyk-cyan/30 rounded-lg p-4 mb-6">
              <p className="text-neutral-300 text-sm">
                Encontrarás productos de compra directa y también productos cotizables.
                En compra directa verás precio, IVA y total; en servicios cotizables podrás solicitar presupuesto.
              </p>
            </div>

            {isLoadingProducts ? (
              <LoadingPage message="Cargando productos..." />
            ) : isProductsError ? (
              <div className="text-center py-16">
                <p className="text-neutral-400 mb-2">No se pudo cargar el catálogo</p>
                <p className="text-neutral-500 text-sm mb-4">
                  Verifica que el servidor esté activo e intenta de nuevo.
                </p>
                <Button variant="outline" onClick={() => refetchProducts()}>
                  Reintentar
                </Button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-neutral-400 mb-2">
                  {offersOnly
                    ? 'No hay productos en promoción en este momento.'
                    : 'No se encontraron productos'}
                </p>
                {offersOnly && (
                  <p className="text-neutral-500 text-sm mb-4">
                    Puedes ver todo el catálogo disponible sin filtros de descuento.
                  </p>
                )}
                <Button variant="outline" onClick={handleClearFilters}>
                  {offersOnly ? 'Ver todo el catálogo' : 'Limpiar filtros'}
                </Button>
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    'grid gap-4',
                    viewMode === 'grid'
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                      : 'grid-cols-1'
                  )}
                >
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} viewMode={viewMode} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={filters.page || 1}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
