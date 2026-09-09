'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { useLocale } from 'next-intl';
import toast from 'react-hot-toast';

import { getProductBySlug, ProductListItem } from '@/lib/api/catalog';
import { useCart } from '@/contexts/CartContext';
import { MediaImage } from '@/components/ui/MediaImage';
import { Button } from '@/components/ui';

interface ProductCardProps {
  product: ProductListItem;
  viewMode?: 'grid' | 'list';
}

export function ProductCard({ product, viewMode = 'grid' }: ProductCardProps) {
  const locale = useLocale();
  const router = useRouter();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  const name = locale === 'en' && product.name_en ? product.name_en : product.name;

  const productPath = `/${locale}/catalogo/${product.category?.slug || 'productos'}/${product.slug}`;
  const isDirectPurchase = product.sale_mode === 'BUY' || product.sale_mode === 'HYBRID';
  const comparePrice = Number(product.compare_at_price || 0);
  const basePrice = Number(product.base_price || 0);
  const hasDiscount = product.has_discount && comparePrice > basePrice && basePrice > 0;
  const displayPrice = hasDiscount ? basePrice : basePrice;
  const taxAmount = displayPrice * 0.16;
  const totalWithTax = displayPrice + taxAmount;

  const formatMx = (value: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 2,
    }).format(value);

  const PriceBlock = ({ compact = false }: { compact?: boolean }) => {
    if (!isDirectPurchase || displayPrice <= 0) return null;
    return (
      <div className={compact ? 'mt-1 space-y-0.5' : 'mt-2 space-y-0.5'}>
        {hasDiscount && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-red-400 font-semibold">
              -{product.discount_percentage || Math.round(((comparePrice - displayPrice) / comparePrice) * 100)}%
            </span>
            <span className={`${compact ? 'text-[11px]' : 'text-xs'} text-neutral-500 line-through`}>
              {formatMx(comparePrice)}
            </span>
          </div>
        )}
        <p className={`${compact ? 'text-xs' : 'text-xs'} text-neutral-300`}>
          Precio: <span className="font-medium text-white">{formatMx(displayPrice)}</span>
        </p>
        <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-neutral-400`}>IVA: {formatMx(taxAmount)}</p>
        <p className={`${compact ? 'text-xs' : 'text-xs'} text-cyan-400 font-semibold`}>Total: {formatMx(totalWithTax)}</p>
      </div>
    );
  };

  const handleQuote = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Redirige al detalle para completar compra o cotización.
    router.push(productPath);
  };

  const resolveVariantId = async (): Promise<string | null> => {
    try {
      const detail = await getProductBySlug(product.slug);
      const variantId = detail.variants?.[0]?.id || null;
      return variantId;
    } catch {
      return null;
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const variantId = await resolveVariantId();
    if (!variantId) {
      toast.error('No hay variante disponible para este producto');
      return;
    }

    try {
      await addItem(variantId, quantity);
      toast.success(`Se agregaron ${quantity} unidad(es) al carrito`);
    } catch {
      toast.error('No se pudo agregar al carrito');
    }
  };

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const variantId = await resolveVariantId();
    if (!variantId) {
      toast.error('No hay variante disponible para este producto');
      return;
    }

    try {
      await addItem(variantId, 1);
      router.push(`/${locale}/checkout`);
    } catch {
      toast.error('No se pudo procesar compra inmediata');
    }
  };

  const decreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const increaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuantity((prev) => Math.min(99, prev + 1));
  };

  const onQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.target.value;
    if (raw === '') {
      setQuantity(1);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    setQuantity(Math.max(1, Math.min(99, parsed)));
  };

  // LIST VIEW - Horizontal compact layout (MercadoLibre style)
  if (viewMode === 'list') {
    return (
      <Link
        href={productPath}
        className="group block"
      >
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden hover:border-cmyk-yellow/50 hover:shadow-lg hover:shadow-cmyk-yellow/10 transition-all duration-200 h-40 flex flex-row">
          {/* Image Container - Left side, square and small */}
          <div className="relative w-40 h-40 flex-shrink-0 overflow-hidden bg-neutral-800">
            <MediaImage
              src={product.primary_image?.image}
              alt={name}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-300"
            />
          </div>

          {/* Content - Right side, vertical layout */}
          <div className="p-2 flex-1 flex flex-col justify-between">
            {/* Header: Name & Category */}
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-white group-hover:text-cmyk-cyan transition-colors line-clamp-2">
                {name}
              </h3>
              {product.category && (
                <p className="text-xs text-neutral-500 mt-0.5">{product.category.name}</p>
              )}
              {isDirectPurchase && displayPrice > 0 && <PriceBlock compact />}
            </div>

            {/* Footer: Buttons */}
            <div className="flex items-end justify-end gap-2 mt-2 flex-wrap">
              {isDirectPurchase ? (
                <>
                  <div className="flex items-center rounded-md border border-neutral-600 overflow-hidden h-8 w-[124px]">
                    <button
                      type="button"
                      onClick={decreaseQuantity}
                      className="px-2 text-xs text-white bg-neutral-800 hover:bg-neutral-700"
                      aria-label="Disminuir cantidad"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={quantity}
                      onChange={onQuantityInputChange}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="w-[44px] h-full text-xs text-white bg-neutral-900 text-center border-0 focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={increaseQuantity}
                      className="px-2 text-xs text-white bg-neutral-800 hover:bg-neutral-700"
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                  <Button
                    size="xs"
                    className="bg-neutral-700 hover:bg-neutral-600 text-white text-xs px-3 py-1.5"
                    onClick={handleAddToCart}
                  >
                    Agregar carrito
                  </Button>
                  <Button
                    size="xs"
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5"
                    onClick={handleBuyNow}
                  >
                    Comprar ahora
                  </Button>
                </>
              ) : (
                <Button
                  size="xs"
                  className="bg-cmyk-cyan hover:bg-cmyk-cyan text-white text-xs px-3 py-1.5"
                  onClick={handleQuote}
                >
                  <DocumentTextIcon className="h-3.5 w-3.5 mr-1" />
                  Cotizar
                </Button>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // GRID VIEW - Vertical compact layout (original)
  return (
    <Link
      href={productPath}
      className="group block"
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden hover:border-cmyk-cyan/50 hover:shadow-lg hover:shadow-cmyk-cyan/10 transition-all duration-200 h-full flex flex-col">
        {/* Image Container - More compact */}
        <div className="relative aspect-square overflow-hidden bg-neutral-800">
          {hasDiscount && (
            <span className="absolute top-2 left-2 z-10 rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              OFERTA
            </span>
          )}
          <MediaImage
            src={product.primary_image?.image}
            alt={name}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-300"
          />

        </div>

        {/* Content - Minimal and compact */}
        <div className="p-3 flex-1 flex flex-col justify-between">
          {/* Name - Single line, compact */}
          <h3 className="text-sm font-medium text-white group-hover:text-cmyk-cyan transition-colors line-clamp-2 min-h-10">
            {name}
          </h3>

          {/* Category */}
          {product.category && (
            <p className="text-xs text-neutral-500 mt-1">{product.category.name}</p>
          )}

          {isDirectPurchase && displayPrice > 0 && <PriceBlock />}

          {/* Action Buttons */}
          <div className="mt-3 flex flex-col gap-2">
            {isDirectPurchase ? (
              <>
                <div className="flex items-center rounded-md border border-neutral-600 overflow-hidden h-10 w-[130px]">
                  <button
                    type="button"
                    onClick={decreaseQuantity}
                    className="px-2.5 text-xs text-white bg-neutral-800 hover:bg-neutral-700"
                    aria-label="Disminuir cantidad"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={quantity}
                    onChange={onQuantityInputChange}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="flex-1 h-full text-xs text-white bg-neutral-900 text-center border-0 focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={increaseQuantity}
                    className="px-2.5 text-xs text-white bg-neutral-800 hover:bg-neutral-700"
                    aria-label="Aumentar cantidad"
                  >
                    +
                  </button>
                </div>
                <Button
                  size="xs"
                  className="w-full bg-neutral-700 hover:bg-neutral-600 text-white text-xs py-1.5"
                  onClick={handleAddToCart}
                >
                  Agregar carrito
                </Button>
                <Button
                  size="xs"
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-1.5"
                  onClick={handleBuyNow}
                >
                  Comprar ahora
                </Button>
              </>
            ) : (
              <Button
                size="xs"
                className="w-full bg-cmyk-cyan hover:bg-cmyk-cyan text-white text-xs py-1.5"
                onClick={handleQuote}
              >
                <DocumentTextIcon className="h-3.5 w-3.5 mr-1" />
                Cotizar
              </Button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
