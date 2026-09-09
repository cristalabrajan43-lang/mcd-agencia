'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ShoppingCartIcon } from '@heroicons/react/24/outline';

import { getProductById, getProducts, type ProductListItem } from '@/lib/api/catalog';
import { useCart } from '@/contexts/CartContext';
import { Card, Button, LoadingPage } from '@/components/ui';
import { MediaImage } from '@/components/ui/MediaImage';
import { formatCurrency } from '@/lib/utils';

export default function VendorSuppliesPage() {
  const locale = useLocale();
  const router = useRouter();
  const { addItem } = useCart();
  const [addingId, setAddingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-catalog'],
    queryFn: () => getProducts({ scope: 'vendors', page_size: 50, sale_mode: 'BUY' }),
  });

  const products = data?.results || [];
  const grouped = useMemo(() => {
    const groups = new Map<string, { name: string; items: ProductListItem[] }>();
    for (const product of products) {
      const key = product.vendor_id || 'unknown';
      const name = product.vendor_name || 'Proveedor';
      const current = groups.get(key) || { name, items: [] };
      current.items.push(product);
      groups.set(key, current);
    }
    return Array.from(groups.values());
  }, [products]);

  const addProduct = async (product: ProductListItem, buyNow = false) => {
    setAddingId(product.id);
    try {
      const detail = await getProductById(product.id);
      const variantId = detail.variants?.find((variant) => variant.is_active)?.id;
      if (!variantId) {
        toast.error('Este producto no tiene stock para comprar');
        return;
      }
      await addItem(variantId, 1);
      toast.success(`${product.name} agregado al carrito`);
      if (buyNow) {
        router.push(`/${locale}/checkout`);
      }
    } catch {
      toast.error('No se pudo agregar al carrito');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Proveedores</h1>
        <p className="text-neutral-400">
          Compra insumos del catálogo de tus vendedores para el negocio
        </p>
      </div>

      {isLoading ? (
        <LoadingPage message="Cargando catálogo de proveedores..." />
      ) : products.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-neutral-400">Aún no hay productos de vendedores.</p>
        </Card>
      ) : (
        grouped.map((group) => (
          <section key={group.name} className="space-y-4">
            <h2 className="text-lg font-semibold text-white">{group.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((product) => (
                <Card key={product.id} padding="none" className="overflow-hidden">
                  <div className="relative h-40 bg-neutral-800">
                    <MediaImage
                      src={product.primary_image?.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="font-medium text-white">{product.name}</p>
                      <p className="text-sm text-neutral-400 line-clamp-2">
                        {product.short_description}
                      </p>
                    </div>
                    <p className="text-cyan-400 font-semibold">
                      {formatCurrency(parseFloat(product.base_price || '0'))}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={addingId === product.id}
                        onClick={() => addProduct(product)}
                      >
                        <ShoppingCartIcon className="mr-1 h-4 w-4" />
                        Carrito
                      </Button>
                      <Button
                        size="sm"
                        isLoading={addingId === product.id}
                        onClick={() => addProduct(product, true)}
                      >
                        Comprar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
