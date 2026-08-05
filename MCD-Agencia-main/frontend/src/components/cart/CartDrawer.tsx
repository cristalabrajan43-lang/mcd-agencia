'use client';

import { Fragment, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, TrashIcon, MinusIcon, PlusIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Spinner } from '@/components/ui';
import { formatPrice } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';

interface GuestCartItemDetail {
  variant_id: string;
  quantity: number;
  product_name: string;
  variant_name: string;
  price: string;
  image: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const locale = useLocale();
  const { cart, guestCart, isLoading, updateItem, removeItem, itemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const [guestCartDetails, setGuestCartDetails] = useState<GuestCartItemDetail[]>([]);
  const [isLoadingGuestCart, setIsLoadingGuestCart] = useState(false);

  // Fetch guest cart details when drawer opens and user is not authenticated
  useEffect(() => {
    const fetchGuestCartDetails = async () => {
      if (!isAuthenticated && guestCart.items.length > 0 && isOpen) {
        setIsLoadingGuestCart(true);
        try {
          // Fetch variant details for each item
          const details: GuestCartItemDetail[] = [];
          for (const item of guestCart.items) {
            try {
              const response = await apiClient.get<{
                id: string;
                name: string;
                price: string;
                images: Array<{ image: string }>;
                catalog_item?: { name: string };
              }>(`/catalog/variants/${item.variant_id}/`);
              details.push({
                variant_id: item.variant_id,
                quantity: item.quantity,
                product_name: response.catalog_item?.name || 'Producto',
                variant_name: response.name || '',
                price: response.price,
                image: response.images?.[0]?.image || '/images/logo.png',
              });
            } catch {
              // If variant fetch fails, add with placeholder data
              details.push({
                variant_id: item.variant_id,
                quantity: item.quantity,
                product_name: 'Producto',
                variant_name: '',
                price: '0.00',
                image: '/images/logo.png',
              });
            }
          }
          setGuestCartDetails(details);
        } catch (error) {
          console.error('Error fetching guest cart details:', error);
        } finally {
          setIsLoadingGuestCart(false);
        }
      }
    };

    fetchGuestCartDetails();
  }, [isAuthenticated, guestCart.items, isOpen]);

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      await updateItem(itemId, newQuantity);
      // Update guest cart details if not authenticated
      if (!isAuthenticated) {
        setGuestCartDetails(prev => 
          prev.map(item => 
            item.variant_id === itemId 
              ? { ...item, quantity: newQuantity }
              : item
          )
        );
      }
    } catch {
      toast.error('Error al actualizar cantidad');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
      // Update guest cart details if not authenticated
      if (!isAuthenticated) {
        setGuestCartDetails(prev => prev.filter(item => item.variant_id !== itemId));
      }
      toast.success('Producto eliminado');
    } catch {
      toast.error('Error al eliminar producto');
    }
  };

  // Calculate totals for guest cart
  const guestCartSubtotal = guestCartDetails.reduce((sum, item) => {
    return sum + (parseFloat(item.price) * item.quantity);
  }, 0);
  const guestCartTax = guestCartSubtotal * 0.16;
  const guestCartTotal = guestCartSubtotal + guestCartTax;

  const showLoading = isLoading || isLoadingGuestCart;
  const hasItems = isAuthenticated 
    ? (cart && cart.items.length > 0) 
    : guestCartDetails.length > 0;
  const displayItemCount = isAuthenticated 
    ? (cart?.item_count || 0) 
    : itemCount;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[10000]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 transition-opacity z-[9999] pointer-events-none" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden pointer-events-auto">
          <div className="absolute inset-0 overflow-hidden pointer-events-auto">
            <div className="fixed inset-y-0 right-0 flex max-w-full pl-10 pointer-events-auto">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md z-[10001]">
                  <div className="flex h-full flex-col bg-neutral-950 border-l border-neutral-800 shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
                      <Dialog.Title className="text-lg font-semibold text-white flex items-center gap-2">
                        <ShoppingBagIcon className="h-6 w-6" />
                        Carrito
                        {displayItemCount > 0 && (
                          <span className="bg-cmyk-cyan text-black text-xs font-bold px-2 py-0.5 rounded-full">
                            {displayItemCount}
                          </span>
                        )}
                      </Dialog.Title>
                      <button
                        type="button"
                        className="text-neutral-400 hover:text-white transition-colors"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                      {showLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <Spinner size="lg" />
                        </div>
                      ) : !hasItems ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          <ShoppingBagIcon className="h-16 w-16 text-neutral-700 mb-4" />
                          <p className="text-neutral-400 mb-4">Tu carrito está vacío</p>
                          <Link href={`/${locale}/catalogo`} onClick={onClose}>
                            <Button>Explorar catálogo</Button>
                          </Link>
                        </div>
                      ) : isAuthenticated && cart ? (
                        // Authenticated user cart
                        <ul className="divide-y divide-neutral-800">
                          {cart.items.map((item) => (
                            <li key={item.id} className="py-4 flex gap-4">
                              {/* Image */}
                              <div className="relative h-24 w-24 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                                <Image
                                  src={item.product_image || item.variant.images?.[0]?.image || '/images/logo.png'}
                                  alt={item.product_name}
                                  fill
                                  className="object-cover"
                                />
                              </div>

                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-medium truncate">
                                  {item.product_name}
                                </h3>
                                <p className="text-sm text-neutral-400 truncate">
                                  {item.variant.name}
                                </p>
                                <p className="text-cyan-400 font-medium mt-1">
                                  {formatPrice(item.unit_price)}
                                </p>

                                {/* Quantity controls */}
                                <div className="flex items-center gap-3 mt-2">
                                  <div className="flex items-center border border-neutral-700 rounded-lg">
                                    <button
                                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                      disabled={item.quantity <= 1}
                                      className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-50"
                                    >
                                      <MinusIcon className="h-4 w-4" />
                                    </button>
                                    <span className="w-8 text-center text-sm text-white">
                                      {item.quantity}
                                    </span>
                                    <button
                                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                      className="p-1.5 text-neutral-400 hover:text-white"
                                    >
                                      <PlusIcon className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <button
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="text-neutral-500 hover:text-red-500 transition-colors"
                                  >
                                    <TrashIcon className="h-5 w-5" />
                                  </button>
                                </div>
                              </div>

                              {/* Line total */}
                              <div className="text-right">
                                <p className="text-white font-medium">
                                  {formatPrice(item.line_total)}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        // Guest cart
                        <ul className="divide-y divide-neutral-800">
                          {guestCartDetails.map((item) => (
                            <li key={item.variant_id} className="py-4 flex gap-4">
                              {/* Image */}
                              <div className="relative h-24 w-24 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                                <Image
                                  src={item.image}
                                  alt={item.product_name}
                                  fill
                                  className="object-cover"
                                />
                              </div>

                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-medium truncate">
                                  {item.product_name}
                                </h3>
                                {item.variant_name && (
                                  <p className="text-sm text-neutral-400 truncate">
                                    {item.variant_name}
                                  </p>
                                )}
                                <p className="text-cyan-400 font-medium mt-1">
                                  {formatPrice(item.price)}
                                </p>

                                {/* Quantity controls */}
                                <div className="flex items-center gap-3 mt-2">
                                  <div className="flex items-center border border-neutral-700 rounded-lg">
                                    <button
                                      onClick={() => handleUpdateQuantity(item.variant_id, item.quantity - 1)}
                                      disabled={item.quantity <= 1}
                                      className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-50"
                                    >
                                      <MinusIcon className="h-4 w-4" />
                                    </button>
                                    <span className="w-8 text-center text-sm text-white">
                                      {item.quantity}
                                    </span>
                                    <button
                                      onClick={() => handleUpdateQuantity(item.variant_id, item.quantity + 1)}
                                      className="p-1.5 text-neutral-400 hover:text-white"
                                    >
                                      <PlusIcon className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <button
                                    onClick={() => handleRemoveItem(item.variant_id)}
                                    className="text-neutral-500 hover:text-red-500 transition-colors"
                                  >
                                    <TrashIcon className="h-5 w-5" />
                                  </button>
                                </div>
                              </div>

                              {/* Line total */}
                              <div className="text-right">
                                <p className="text-white font-medium">
                                  {formatPrice((parseFloat(item.price) * item.quantity).toFixed(2))}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Footer */}
                    {hasItems && (
                      <div className="border-t border-neutral-800 px-6 py-4 space-y-4">
                        {/* Totals */}
                        <div className="space-y-2">
                          {isAuthenticated && cart ? (
                            <>
                              <div className="flex justify-between text-neutral-400">
                                <span>Subtotal</span>
                                <span>{formatPrice(cart.subtotal)}</span>
                              </div>
                              <div className="flex justify-between text-neutral-400">
                                <span>IVA ({cart.tax_rate}%)</span>
                                <span>{formatPrice(cart.tax_amount)}</span>
                              </div>
                              <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-neutral-800">
                                <span>Total</span>
                                <span>{formatPrice(cart.total)}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between text-neutral-400">
                                <span>Subtotal</span>
                                <span>{formatPrice(guestCartSubtotal.toFixed(2))}</span>
                              </div>
                              <div className="flex justify-between text-neutral-400">
                                <span>IVA (16%)</span>
                                <span>{formatPrice(guestCartTax.toFixed(2))}</span>
                              </div>
                              <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-neutral-800">
                                <span>Total</span>
                                <span>{formatPrice(guestCartTotal.toFixed(2))}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                          <Link href={`/${locale}/checkout`} onClick={onClose}>
                            <Button className="w-full" size="lg">
                              Proceder al pago
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            className="w-full"
                            onClick={onClose}
                          >
                            Seguir comprando
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
