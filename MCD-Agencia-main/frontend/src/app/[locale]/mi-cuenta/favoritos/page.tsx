'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import toast from 'react-hot-toast';
import { HeartIcon, TrashIcon } from '@heroicons/react/24/outline';

import { getProductById, type Product } from '@/lib/api/catalog';
import { Button, Card, Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

const SAVED_PRODUCTS_KEY = 'savedProducts';

export default function FavoritesPage() {
  const locale = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFavorites = async () => {
      setIsLoading(true);
      try {
        const raw = localStorage.getItem(SAVED_PRODUCTS_KEY);
        const ids: string[] = raw ? JSON.parse(raw) : [];

        if (!ids.length) {
          setProducts([]);
          return;
        }

        const resolved = await Promise.allSettled(ids.map((id) => getProductById(id)));
        const found = resolved
          .filter((result): result is PromiseFulfilledResult<Product> => result.status === 'fulfilled')
          .map((result) => result.value);

        setProducts(found);

        if (found.length !== ids.length) {
          const foundIds = found.map((item) => item.id);
          localStorage.setItem(SAVED_PRODUCTS_KEY, JSON.stringify(foundIds));
        }
      } catch {
        toast.error('No se pudieron cargar tus favoritos');
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();
  }, []);

  const removeFavorite = (id: string) => {
    setProducts((prev) => {
      const next = prev.filter((product) => product.id !== id);
      localStorage.setItem(
        SAVED_PRODUCTS_KEY,
        JSON.stringify(next.map((product) => product.id))
      );
      return next;
    });
    toast.success('Producto removido de favoritos');
  };

  if (isLoading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!products.length) {
    return (
      <Card className="text-center py-14">
        <HeartIcon className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">No tienes favoritos guardados</h1>
        <p className="text-neutral-400 mb-6">Guarda productos desde el catálogo para verlos aquí.</p>
        <Link href={`/${locale}/catalogo`}>
          <Button>Explorar catálogo</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Mis favoritos</h1>
        <p className="text-neutral-400">{products.length} productos guardados</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {products.map((product) => {
          const href = `/${locale}/catalogo/${product.category?.slug || 'productos'}/${product.slug}`;
          const image = product.images?.[0]?.image || '/images/logo.png';

          return (
            <Card key={product.id} className="overflow-hidden">
              <Link href={href} className="block">
                <div className="relative h-44 w-full bg-neutral-900">
                  <Image
                    src={image}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
              </Link>

              <div className="p-4 space-y-3">
                <Link href={href} className="block">
                  <h2 className="text-white font-semibold line-clamp-2 hover:text-cyan-300 transition-colors">
                    {product.name}
                  </h2>
                </Link>

                <p className="text-sm text-neutral-400 line-clamp-2">
                  {product.short_description || 'Sin descripción corta'}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-cmyk-cyan font-semibold">
                    {product.sale_mode === 'QUOTE'
                      ? 'Cotizable'
                      : formatCurrency(Number(product.base_price || '0'))}
                  </p>

                  <button
                    type="button"
                    onClick={() => removeFavorite(product.id)}
                    className="inline-flex items-center gap-1 text-sm text-red-300 hover:text-red-200 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Quitar
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
