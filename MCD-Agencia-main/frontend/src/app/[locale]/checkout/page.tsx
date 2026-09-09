'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ChevronLeftIcon,
  LockClosedIcon,
  TruckIcon,
  CreditCardIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline';

import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLegalModal } from '@/contexts/LegalModalContext';
import { getAddresses, createAddress, createOrder, Address } from '@/lib/api/orders';
import { getUserAddresses, type UserAddress } from '@/lib/api/auth';
import { getBranches, type Branch } from '@/lib/api/content';
import { Button, Input, Card, LoadingPage, Modal, Select } from '@/components/ui';
import { formatPrice, cn } from '@/lib/utils';
import { MediaImage } from '@/components/ui/MediaImage';
import { calculateShippingQuote, MEXICO_STATE_OPTIONS } from '@/lib/shipping';

const addressSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  phone: z.string().min(10, 'Teléfono inválido'),
  street: z.string().min(3, 'Calle requerida'),
  exterior_number: z.string().min(1, 'Número exterior requerido'),
  interior_number: z.string().optional(),
  neighborhood: z.string().min(2, 'Colonia requerida'),
  city: z.string().min(2, 'Ciudad requerida'),
  state: z.string().min(2, 'Estado requerido'),
  postal_code: z.string().min(5, 'Código postal inválido'),
  reference: z.string().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

type CheckoutPaymentMethod = 'mercadopago' | 'paypal';

const PAYMENT_METHODS = [
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    description: 'Tarjetas y saldo disponible',
    icon: CreditCardIcon,
    badge: 'MP',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Pago seguro con PayPal',
    icon: BuildingLibraryIcon,
    badge: 'PP',
  },
];

export default function CheckoutPage() {
  const router = useRouter();
  const locale = useLocale();
  const { cart, isLoading: isCartLoading, refreshCart, updateItem, removeItem } = useCart();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { openPrivacy, openTerms } = useLegalModal();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<CheckoutPaymentMethod>('mercadopago');
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [selectedPickupBranchId, setSelectedPickupBranchId] = useState<string | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [zeroQuantityConfirmOpen, setZeroQuantityConfirmOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<string | null>(null);

  const { data: addressesData, refetch: refetchAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: getAddresses,
    enabled: isAuthenticated,
  });

  const addresses = addressesData?.results || [];

  const { data: profileAddresses = [] } = useQuery({
    queryKey: ['user-addresses-checkout'],
    queryFn: getUserAddresses,
    enabled: isAuthenticated,
  });

  const normalizeAddressPart = (value: string): string => {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const toAddressKey = (addr: {
    street: string;
    exterior_number: string;
    neighborhood: string;
    city: string;
    state: string;
    postal_code: string;
  }) => [
    addr.street,
    addr.exterior_number,
    addr.neighborhood,
    addr.city,
    addr.state,
    addr.postal_code,
  ].map((v) => normalizeAddressPart(v)).join('|');

  const profileToCheckoutAddress = (addr: UserAddress): Address => {
    const name = user?.full_name?.trim() || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'Cliente';
    const phone = (user?.phone || '').trim();
    const street = (addr.calle || '').trim();
    const exterior = (addr.numero_exterior || '').trim();
    const interior = (addr.numero_interior || '').trim();
    const neighborhood = (addr.colonia || '').trim();
    const city = (addr.ciudad || '').trim();
    const state = (addr.estado || '').trim();
    const postal = (addr.codigo_postal || '').trim();
    const reference = (addr.referencia || '').trim();

    const fullAddress = `${street} ${exterior}${interior ? `, Int. ${interior}` : ''}, ${neighborhood}, ${city}, ${state}, CP ${postal}`.trim();

    return {
      id: `profile-${addr.id}`,
      type: 'shipping',
      is_default: Boolean(addr.is_default),
      name,
      phone,
      street,
      exterior_number: exterior,
      interior_number: interior,
      neighborhood,
      city,
      state,
      postal_code: postal,
      country: 'MX',
      reference,
      full_address: fullAddress,
    };
  };

  const checkoutAddresses = useMemo(() => {
    const merged = [...addresses];
    const existingKeys = new Set(
      addresses.map((addr) => toAddressKey(addr))
    );

    for (const profileAddr of profileAddresses) {
      const mapped = profileToCheckoutAddress(profileAddr);
      if (!mapped.street || !mapped.exterior_number || !mapped.neighborhood || !mapped.city || !mapped.state || !mapped.postal_code) {
        continue;
      }
      const key = toAddressKey(mapped);
      if (!existingKeys.has(key)) {
        merged.push(mapped);
        existingKeys.add(key);
      }
    }

    return merged;
  }, [addresses, profileAddresses, user]);

  const profileMetaByAddressKey = useMemo(() => {
    const map = new Map<string, { label: string; reference: string }>();
    for (const addr of profileAddresses) {
      const key = toAddressKey({
        street: addr.calle,
        exterior_number: addr.numero_exterior,
        neighborhood: addr.colonia,
        city: addr.ciudad,
        state: addr.estado,
        postal_code: addr.codigo_postal,
      });
      map.set(key, {
        label: (addr.label || '').trim(),
        reference: (addr.referencia || '').trim(),
      });
    }
    return map;
  }, [profileAddresses]);

  const profileAddressById = useMemo(() => {
    return new Map(profileAddresses.map((addr) => [addr.id, addr]));
  }, [profileAddresses]);

  const getProfileAddressForCheckoutAddress = (address: Address): UserAddress | undefined => {
    if (address.id.startsWith('profile-')) {
      const profileId = address.id.replace('profile-', '');
      return profileAddressById.get(profileId);
    }

    const key = toAddressKey(address);
    return profileAddresses.find((profileAddr) =>
      toAddressKey({
        street: profileAddr.calle,
        exterior_number: profileAddr.numero_exterior,
        neighborhood: profileAddr.colonia,
        city: profileAddr.ciudad,
        state: profileAddr.estado,
        postal_code: profileAddr.codigo_postal,
      }) === key
    );
  };

  const getAddressCardTitle = (address: Address): string => {
    const profileAddr = getProfileAddressForCheckoutAddress(address);
    const byIdTag = (profileAddr?.label || '').trim();
    if (byIdTag) return byIdTag;

    const byKeyTag = profileMetaByAddressKey.get(toAddressKey(address))?.label || '';
    const tag = byKeyTag.trim();
    if (tag) return tag;
    return address.name || 'Direccion';
  };

  const getAddressCardReference = (address: Address): string => {
    const profileAddr = getProfileAddressForCheckoutAddress(address);
    const byKeyReference = profileMetaByAddressKey.get(toAddressKey(address))?.reference || '';
    return (address.reference || profileAddr?.referencia || byKeyReference || '').trim();
  };

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-checkout'],
    queryFn: getBranches,
    enabled: isAuthenticated,
  });

  const checkoutBranches = branches;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      state: '',
    },
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login?redirect=/checkout');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // Set default address
  useEffect(() => {
    if (checkoutAddresses.length > 0 && !selectedAddressId) {
      const defaultAddress = checkoutAddresses.find((a) => a.is_default) || checkoutAddresses[0];
      setSelectedAddressId(defaultAddress.id);
    }
  }, [checkoutAddresses, selectedAddressId]);

  // Default pickup branch when user switches to pickup and no branch is selected yet.
  useEffect(() => {
    if (deliveryMethod === 'pickup' && !selectedPickupBranchId && checkoutBranches.length > 0) {
      setSelectedPickupBranchId(checkoutBranches[0].id);
    }
  }, [deliveryMethod, selectedPickupBranchId, checkoutBranches]);

  const selectedAddress = checkoutAddresses.find((address) => address.id === selectedAddressId) || null;

  const getAddressShippingQuote = (address: Address) =>
    calculateShippingQuote({
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
    });

  const shippingQuote = selectedAddress ? getAddressShippingQuote(selectedAddress) : null;

  const shippingFee =
    deliveryMethod === 'pickup' ? 0 : shippingQuote?.fee ?? 0;

  const checkoutTotal = Number(cart?.total ?? 0) + shippingFee;

  const handleAddAddress = async (data: AddressFormData) => {
    try {
      await createAddress({
        ...data,
        type: 'shipping',
        is_default: addresses.length === 0,
        country: 'MX',
      });
      toast.success('Dirección agregada');
      refetchAddresses();
      setIsAddressModalOpen(false);
      reset();
    } catch {
      toast.error('Error al agregar dirección');
    }
  };

  const handlePlaceOrder = async () => {
    // Validation checks
    if (!termsAccepted) {
      toast.error('Debes aceptar los términos y condiciones para continuar');
      return;
    }

    if (deliveryMethod === 'shipping' && !selectedAddressId) {
      toast.error('Por favor selecciona una dirección de envío');
      return;
    }

    if (deliveryMethod === 'pickup' && !selectedPickupBranchId) {
      toast.error('Por favor selecciona una sucursal para recoger tu pedido');
      return;
    }

    const findOrderAddressByProfile = (profileAddressId: string): Address | null => {
      const profileAddr = profileAddresses.find((a) => a.id === profileAddressId);
      if (!profileAddr) return null;
      const key = toAddressKey({
        street: profileAddr.calle,
        exterior_number: profileAddr.numero_exterior,
        neighborhood: profileAddr.colonia,
        city: profileAddr.ciudad,
        state: profileAddr.estado,
        postal_code: profileAddr.codigo_postal,
      });
      return addresses.find((addr) => toAddressKey(addr) === key) || null;
    };

    const ensureOrderAddressId = async (rawSelectedAddressId: string | null): Promise<string | null> => {
      if (!rawSelectedAddressId) return addresses[0]?.id || null;
      if (!rawSelectedAddressId.startsWith('profile-')) return rawSelectedAddressId;

      const profileAddressId = rawSelectedAddressId.replace('profile-', '');
      const profileAddr = profileAddresses.find((a) => a.id === profileAddressId);
      if (!profileAddr) return addresses[0]?.id || null;

      const existingOrderAddr = findOrderAddressByProfile(profileAddressId);
      if (existingOrderAddr) return existingOrderAddr.id;

      const created = await createAddress({
        type: 'shipping',
        is_default: addresses.length === 0,
        name: (profileAddr.label || '').trim() || user?.full_name?.trim() || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'Cliente',
        phone: (user?.phone || '').trim(),
        street: (profileAddr.calle || '').trim(),
        exterior_number: (profileAddr.numero_exterior || '').trim(),
        interior_number: (profileAddr.numero_interior || '').trim(),
        neighborhood: (profileAddr.colonia || '').trim(),
        city: (profileAddr.ciudad || '').trim(),
        state: (profileAddr.estado || '').trim(),
        postal_code: (profileAddr.codigo_postal || '').trim(),
        country: 'MX',
        reference: (profileAddr.referencia || '').trim(),
      });

      await refetchAddresses();
      return created.id;
    };

    const resolvedShippingAddressId = await ensureOrderAddressId(selectedAddressId || checkoutAddresses[0]?.id || null);

    if (deliveryMethod === 'shipping' && !resolvedShippingAddressId) {
      toast.error('No se pudo procesar la dirección de envío. Intenta de nuevo.');
      return;
    }

    if (deliveryMethod === 'pickup' && !resolvedShippingAddressId) {
      toast.error('Para finalizar tu pedido, agrega primero una dirección en tu cuenta.');
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedPaymentMethod = selectedPaymentMethod;

      const noteParts: string[] = [
        `Metodo de pago: ${normalizedPaymentMethod}`,
        `Metodo de entrega: ${deliveryMethod}`,
      ];

      // Create the order first
      const order = await createOrder({
        shipping_address_id: resolvedShippingAddressId as string,
        use_shipping_as_billing: true,
        payment_method: normalizedPaymentMethod,
        delivery_method: deliveryMethod,
        pickup_branch_id: deliveryMethod === 'pickup' ? selectedPickupBranchId || undefined : undefined,
        shipping_fee: shippingFee.toFixed(2),
        notes: noteParts.join(' | '),
        terms_accepted: true,
      });

      // Refresh cart (should be empty now)
      await refreshCart();

      toast.success('Pago confirmado correctamente. Tu pedido ya está en proceso.');

      router.push(`/${locale}/mi-cuenta/pedidos/${order.id}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || 'Error al crear la orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || isCartLoading) {
    return <LoadingPage message="Cargando..." />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Tu carrito está vacío</h1>
          <Link href="/catalogo">
            <Button>Ir al catálogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/catalogo"
            className="inline-flex items-center text-neutral-400 hover:text-white transition-colors mb-4"
          >
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            Seguir comprando
          </Link>
          <h1 className="text-3xl font-bold text-white">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            <Card>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <TruckIcon className="h-6 w-6 text-cyan-400" />
                Método de entrega
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('shipping')}
                  className={cn(
                    'text-left p-4 rounded-lg border transition-colors',
                    deliveryMethod === 'shipping'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-neutral-700 hover:border-neutral-600'
                  )}
                >
                  <p className="text-white font-medium">Envío a domicilio</p>
                  <p className="text-sm text-neutral-400 mt-1">Gratis en Acapulco, tarifa por estado en el resto del país</p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMethod('pickup')}
                  className={cn(
                    'text-left p-4 rounded-lg border transition-colors',
                    deliveryMethod === 'pickup'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-neutral-700 hover:border-neutral-600'
                  )}
                >
                  <p className="text-white font-medium">Recoger en sucursal</p>
                  <p className="text-sm text-neutral-400 mt-1">Sin costo de envío</p>
                </button>
              </div>

              {deliveryMethod === 'pickup' && (
                <div className="space-y-3 mb-6">
                  <p className="text-sm text-neutral-300">Selecciona sucursal</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {checkoutBranches.map((branch: Branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => setSelectedPickupBranchId(branch.id)}
                        className={cn(
                          'text-left p-4 rounded-lg border transition-colors',
                          selectedPickupBranchId === branch.id
                            ? 'border-cyan-500 bg-cyan-500/10'
                            : 'border-neutral-700 hover:border-neutral-600'
                        )}
                      >
                        <p className="text-white font-medium">{branch.name}</p>
                        <p className="text-sm text-neutral-400 mt-1">{branch.full_address}</p>
                        {branch.phone && <p className="text-xs text-neutral-500 mt-1">Tel. {branch.phone}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {deliveryMethod === 'shipping' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                      <TruckIcon className="h-6 w-6 text-cyan-400" />
                      Dirección de envío
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAddressModalOpen(true)}
                    >
                      + Agregar nueva
                    </Button>
                  </div>

                  {checkoutAddresses.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-neutral-400 mb-4">No tienes direcciones guardadas</p>
                      <Button onClick={() => setIsAddressModalOpen(true)}>
                        Agregar dirección
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {checkoutAddresses.map((address) => {
                        const addressQuote = getAddressShippingQuote(address);
                        return (
                        <button
                          key={address.id}
                          onClick={() => setSelectedAddressId(address.id)}
                          className={cn(
                            'text-left p-4 rounded-lg border transition-colors',
                            selectedAddressId === address.id
                              ? 'border-cyan-500 bg-cyan-500/10'
                              : 'border-neutral-700 hover:border-neutral-600'
                          )}
                        >
                          <p className="text-white font-medium">{getAddressCardTitle(address)}</p>
                          <p className="text-sm text-neutral-400 mt-1">
                            {address.street} {address.exterior_number}
                            {address.interior_number && `, Int. ${address.interior_number}`}
                          </p>
                          <p className="text-sm text-neutral-400">
                            {address.neighborhood}, {address.city}
                          </p>
                          <p className="text-sm text-neutral-400">
                            {address.state}, CP {address.postal_code}
                          </p>
                          {deliveryMethod === 'shipping' && (
                            <p className={cn(
                              'text-sm mt-2 font-medium',
                              addressQuote.isFree ? 'text-emerald-400' : 'text-cyan-400'
                            )}>
                              {addressQuote.isFree
                                ? 'Envío gratis'
                                : `Envío ${formatPrice(addressQuote.fee)}`}
                            </p>
                          )}
                          {getAddressCardReference(address) && (
                            <p className="text-sm text-neutral-400 mt-1">
                              Referencia: {getAddressCardReference(address)}
                            </p>
                          )}
                          <p className="text-sm text-neutral-400 mt-1">{address.phone}</p>
                        </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

            </Card>

            {/* Payment Method */}
            <Card>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <CreditCardIcon className="h-6 w-6 text-cyan-400" />
                Método de pago
              </h2>

              <div className="space-y-3">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPaymentMethod(method.id as CheckoutPaymentMethod)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left',
                      selectedPaymentMethod === method.id
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-neutral-700 hover:border-neutral-600'
                    )}
                  >
                    <method.icon className="h-8 w-8 text-neutral-400" />
                    <div>
                      <p className="text-white font-medium">{method.name}</p>
                      <p className="text-sm text-neutral-400">{method.description}</p>
                    </div>
                    <span className="ml-auto text-[11px] font-semibold text-neutral-300 bg-neutral-800 px-2 py-1 rounded">
                      {method.badge}
                    </span>
                  </button>
                ))}
              </div>


            </Card>

            {/* Terms */}
            <Card>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-neutral-950"
                />
                <span className="text-sm text-neutral-400">
                  He leído y acepto los{' '}
                  <button type="button" onClick={openTerms} className="text-cyan-400 hover:underline">
                    Términos y Condiciones
                  </button>{' '}
                  y la{' '}
                  <button type="button" onClick={openPrivacy} className="text-cyan-400 hover:underline">
                    Política de Privacidad
                  </button>
                </span>
              </label>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-8">
              <h2 className="text-xl font-semibold text-white mb-4">Resumen del pedido</h2>

              {/* Items */}
              <div className="space-y-4 mb-6">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                      <MediaImage
                        src={item.product_image || item.variant.images?.[0]?.image || '/images/logo.png'}
                        alt={item.product_name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {(item.variant_display_name || item.variant.name) || 'Base'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.quantity - 1 === 0) {
                              setItemToRemove(item.id);
                              setZeroQuantityConfirmOpen(true);
                            } else {
                              updateItem(item.id, item.quantity - 1);
                            }
                          }}
                          className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-xs transition-colors"
                        >
                          −
                        </button>
                        <span className="text-xs text-neutral-300 w-8 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, item.quantity + 1)}
                          className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-xs transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="text-white text-sm font-medium">
                      {formatPrice(item.line_total)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2 border-t border-neutral-800 pt-4">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal</span>
                  <span>{formatPrice(cart.subtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>IVA (16%)</span>
                  <span>{formatPrice(cart.tax_amount)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Envío</span>
                  <span>{shippingFee === 0 ? 'Gratis' : formatPrice(shippingFee)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-neutral-800">
                  <span>Total</span>
                  <span>{formatPrice(checkoutTotal)}</span>
                </div>
              </div>

              <p className="text-xs text-neutral-500 mt-3">
                {deliveryMethod === 'pickup'
                  ? 'Recogida en sucursal: sin costo de envío.'
                  : !selectedAddress
                  ? 'Selecciona una dirección para calcular el envío.'
                  : shippingQuote?.isFree
                  ? 'Envío gratis a Acapulco.'
                  : shippingQuote
                  ? `${shippingQuote.label}: ${formatPrice(shippingQuote.fee)}.`
                  : 'Selecciona una dirección para calcular el envío.'}
              </p>

              {/* Place Order */}
              <Button
                className="w-full mt-6"
                size="lg"
                onClick={handlePlaceOrder}
                isLoading={isSubmitting}
                disabled={
                  (deliveryMethod === 'shipping' && !selectedAddressId) ||
                  (deliveryMethod === 'pickup' && !selectedPickupBranchId) ||
                  !termsAccepted
                }
                leftIcon={<LockClosedIcon className="h-5 w-5" />}
              >
                {selectedPaymentMethod === 'mercadopago' || selectedPaymentMethod === 'paypal'
                  ? `Confirmar pago ${formatPrice(checkoutTotal)}`
                  : 'Generar pedido'}
              </Button>

              <p className="text-xs text-neutral-500 text-center mt-4">
                Pago seguro con encriptación SSL
              </p>
            </Card>
          </div>
        </div>

        {/* Add Address Modal */}
        <Modal
          isOpen={isAddressModalOpen}
          onClose={() => setIsAddressModalOpen(false)}
          title="Nueva dirección"
          size="lg"
        >
          <form onSubmit={handleSubmit(handleAddAddress)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Nombre completo"
                placeholder="Juan Pérez"
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="Teléfono"
                placeholder="(555) 123-4567"
                error={errors.phone?.message}
                {...register('phone')}
              />
            </div>

            <Input
              label="Calle"
              placeholder="Av. Principal"
              error={errors.street?.message}
              {...register('street')}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Número exterior"
                placeholder="123"
                error={errors.exterior_number?.message}
                {...register('exterior_number')}
              />
              <Input
                label="Número interior (opcional)"
                placeholder="4A"
                {...register('interior_number')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Colonia"
                placeholder="Centro"
                error={errors.neighborhood?.message}
                {...register('neighborhood')}
              />
              <Input
                label="Código postal"
                placeholder="39300"
                error={errors.postal_code?.message}
                {...register('postal_code')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Ciudad"
                placeholder="Acapulco de Juárez"
                error={errors.city?.message}
                {...register('city')}
              />
              <Select
                label="Estado"
                value={watch('state') || ''}
                onChange={(value) => setValue('state', value, { shouldValidate: true })}
                options={[...MEXICO_STATE_OPTIONS]}
                placeholder="Selecciona un estado"
                error={errors.state?.message}
                required
              />
            </div>

            <Input
              label="Referencia (opcional)"
              placeholder="Entre calles, color de casa, etc."
              {...register('reference')}
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setIsAddressModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Guardar dirección
              </Button>
            </div>
          </form>
        </Modal>

        {/* Remove Product Confirmation Modal */}
        <Modal
          isOpen={zeroQuantityConfirmOpen}
          onClose={() => {
            setZeroQuantityConfirmOpen(false);
            setItemToRemove(null);
          }}
          title="Confirmar acción"
        >
          <div className="space-y-4">
            <p className="text-neutral-300">¿Está seguro de que desea remover este producto del carrito?</p>
            <div className="flex gap-4">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setZeroQuantityConfirmOpen(false);
                  setItemToRemove(null);
                }}
              >
                No, mantener
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={async () => {
                  if (itemToRemove) {
                    await removeItem(itemToRemove);
                    // If cart becomes empty, redirect to catalog
                    if (cart && cart.items.length === 1) {
                      router.push(`/${locale}/catalogo`);
                    }
                  }
                  setZeroQuantityConfirmOpen(false);
                  setItemToRemove(null);
                }}
              >
                Sí, remover
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
