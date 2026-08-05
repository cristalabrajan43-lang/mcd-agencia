
'use client';

/**
 * Cart Page for MCD-Agencia
 *
 * Full page cart view with:
 * - List of cart items
 * - Quantity controls
 * - Price summary
 * - Checkout button
 *
 * @module app/[locale]/cart
 */

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  TrashIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Spinner } from '@/components/ui';
import { formatPrice } from '@/lib/utils';

export default function CartPage() {
  const locale = useLocale();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { cart, isLoading, updateItem, removeItem, clearCart } = useCart();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/${locale}/login?redirect=/${locale}/cart`);
    }
  }, [isAuthenticated, authLoading, router, locale]);

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      await updateItem(itemId, newQuantity);
    } catch {
      toast.error('Error al actualizar cantidad');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
      toast.success('Producto eliminado del carrito');
    } catch {
      toast.error('Error al eliminar producto');
    }
  };

  const handleClearCart = async () => {
    if (confirm('¿Estás seguro de que deseas vaciar el carrito?')) {
      try {
        await clearCart();
        toast.success('Carrito vaciado');
      } catch {
        toast.error('Error al vaciar el carrito');
      }
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-950 pt-24 pb-16">
      <div className="container-custom px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/catalogo`}
              className="p-2 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-neutral-800"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <ShoppingBagIcon className="h-8 w-8 text-cmyk-cyan" />
              Mi Carrito
              {cart && cart.item_count > 0 && (
                <span className="bg-cmyk-cyan text-black text-sm font-bold px-3 py-1 rounded-full">
                  {cart.item_count} {cart.item_count === 1 ? 'artículo' : 'artículos'}
                </span>
              )}
            </h1>
          </div>

          {cart && cart.items.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-sm text-neutral-400 hover:text-red-400 transition-colors"
            >
              Vaciar carrito
            </button>
          )}
        </div>

        {/* Empty State */}
        {!cart || cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBagIcon className="h-24 w-24 text-neutral-700 mb-6" />
            <h2 className="text-xl font-semibold text-white mb-2">Tu carrito está vacío</h2>
            <p className="text-neutral-400 mb-8 max-w-md">
              Explora nuestro catálogo y agrega productos a tu carrito para continuar con tu compra.
            </p>
            <Link href={`/${locale}/catalogo`}>
              <Button size="lg">Explorar catálogo</Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                <ul className="divide-y divide-neutral-800">
                  {cart.items.map((item) => (
                    <li key={item.id} className="p-4 md:p-6">
                      <div className="flex gap-4 md:gap-6">
                        {/* Image */}
                        <div className="relative h-24 w-24 md:h-32 md:w-32 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                          <Image
                            src={item.product_image || item.variant.images?.[0]?.image || '/images/logo.png'}
                            alt={item.product_name}
                            fill
                            className="object-cover"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-white font-medium text-lg">
                                {item.product_name}
                              </h3>
                              <p className="text-sm text-neutral-400 mt-1">
                                Variante: {item.variant_display_name || item.variant.name || 'Base'}
                              </p>
                              {item.variant.sku && (
                                <p className="text-xs text-neutral-500 mt-1">
                                  SKU: {item.variant.sku}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-2 text-neutral-500 hover:text-red-500 hover:bg-neutral-800 rounded-lg transition-colors"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>

                          {/* Price and Quantity */}
                          <div className="flex items-center justify-between mt-4">
                            {/* Quantity controls */}
                            <div className="flex items-center border border-neutral-700 rounded-lg">
                              <button
                                onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                className="p-2 text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <MinusIcon className="h-4 w-4" />
                              </button>
                              <span className="w-12 text-center text-white font-medium">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                className="p-2 text-neutral-400 hover:text-white transition-colors"
                              >
                                <PlusIcon className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                              <p className="text-cmyk-cyan font-semibold text-lg">
                                {formatPrice(item.line_total)}
                              </p>
                              {item.quantity > 1 && (
                                <p className="text-xs text-neutral-500">
                                  {formatPrice(item.unit_price)} c/u
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 sticky top-24">
                <h2 className="text-lg font-semibold text-white mb-4">Resumen del pedido</h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-neutral-400">
                    <span>Subtotal ({cart.item_count} artículos)</span>
                    <span>{formatPrice(cart.subtotal)}</span>
                  </div>

                  {(cart.discount_amount ?? 0) > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Descuento</span>
                      <span>-{formatPrice(cart.discount_amount ?? 0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-neutral-400">
                    <span>Impuestos</span>
                    <span>{formatPrice(cart.tax_amount)}</span>
                  </div>

                  <div className="border-t border-neutral-700 pt-3">
                    <div className="flex justify-between text-white font-semibold text-lg">
                      <span>Total</span>
                      <span className="text-cmyk-cyan">{formatPrice(cart.total)}</span>
                    </div>
                  </div>
                </div>

                <Link href={`/${locale}/checkout`} className="block mt-6">
                  <Button className="w-full" size="lg">
                    Proceder al pago
                  </Button>
                </Link>

                <Link
                  href={`/${locale}/catalogo`}
                  className="block mt-3 text-center text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Continuar comprando
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
