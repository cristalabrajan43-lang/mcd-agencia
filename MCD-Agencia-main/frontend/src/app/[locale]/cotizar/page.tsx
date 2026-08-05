'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  PaperClipIcon,
  XMarkIcon,
  CheckCircleIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

import { submitQuoteRequest } from '@/lib/api/quotes';
import { getProducts } from '@/lib/api/catalog';
import { getBranches, type Branch } from '@/lib/api/content';
import { getUserAddresses, type UserAddress } from '@/lib/api/auth';
import { useLegalModal } from '@/contexts/LegalModalContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePostalCode } from '@/hooks/usePostalCode';
import { MapPinIcon } from '@heroicons/react/24/solid';
import { Button, Input, Textarea, Select, Card, Breadcrumb } from '@/components/ui';
import { DELIVERY_METHODS, DELIVERY_METHOD_LABELS, DELIVERY_METHOD_ICONS, type DeliveryMethod } from '@/lib/service-ids';

const quoteSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  company: z.string().optional(),
  catalog_item_id: z.string().optional(),
  quantity: z.string().optional(),
  dimensions: z.string().optional(),
  material: z.string().optional(),
  installation_required: z.boolean().optional(),
  description: z.string().min(10, 'Describe tu proyecto (mínimo 10 caracteres)'),
  privacy_accepted: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar la política de privacidad' }),
  }),
});

type QuoteFormData = z.infer<typeof quoteSchema>;

const MATERIAL_OPTIONS = [
  { value: '', label: 'Seleccionar material...' },
  { value: 'lona', label: 'Lona' },
  { value: 'vinil', label: 'Vinil' },
  { value: 'acrilico', label: 'Acrílico' },
  { value: 'aluminio', label: 'Aluminio' },
  { value: 'pvc', label: 'PVC' },
  { value: 'otro', label: 'Otro (especificar en descripción)' },
];

export default function QuotePage() {
  const searchParams = useSearchParams();
  const preselectedProduct = searchParams.get('producto');
  const { openPrivacy } = useLegalModal();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [requestNumber, setRequestNumber] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | ''>('');
  const [deliveryError, setDeliveryError] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState({
    calle: '', numero_exterior: '', numero_interior: '', colonia: '', ciudad: '', estado: '', codigo_postal: '', referencia: '',
  });
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState(false);
  const postalCode = usePostalCode();
  const [coloniaManual, setColoniaManual] = useState(false);

  // Saved addresses for logged-in users
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [useNewAddress, setUseNewAddress] = useState(false);

  // Fetch branches for pickup
  const fetchBranches = async () => {
    setBranchesLoading(true);
    setBranchesError(false);
    try {
      const data = await getBranches();
      setBranches(data);
    } catch {
      setBranchesError(true);
    } finally {
      setBranchesLoading(false);
    }
  };
  useEffect(() => { fetchBranches(); }, []);

  // Fetch saved addresses if user is logged in
  useEffect(() => {
    if (user) {
      getUserAddresses()
        .then((addrs) => {
          setSavedAddresses(addrs);
          const def = addrs.find((a) => a.is_default);
          if (addrs.length > 0) {
            setSelectedAddressId(def?.id || addrs[0].id);
            setUseNewAddress(false);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const { data: productsData } = useQuery({
    queryKey: ['products-for-quote'],
    queryFn: () => getProducts({ page_size: 100 }),
  });

  const productOptions = [
    { value: '', label: 'Seleccionar producto/servicio...' },
    ...(productsData?.results || []).map((p) => ({
      value: p.id,
      label: p.name,
    })),
  ];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      catalog_item_id: preselectedProduct || '',
      installation_required: false,
    },
  });

  // Pre-fill form fields from logged-in user profile
  useEffect(() => {
    if (user) {
      setValue('name', user.full_name || `${user.first_name} ${user.last_name}`.trim());
      setValue('email', user.email);
      if (user.phone) setValue('phone', user.phone);
      if (user.company) setValue('company', user.company);
      if (user.default_delivery_address && Object.values(user.default_delivery_address).some(v => v)) {
        setDeliveryAddress(prev => ({
          ...prev,
          ...user.default_delivery_address,
        }));
      }
    }
  }, [user, setValue]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter((file) => {
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });

    if (validFiles.length !== selectedFiles.length) {
      toast.error('Algunos archivos no son válidos (máx 10MB, formatos: JPG, PNG, PDF)');
    }

    setFiles((prev) => [...prev, ...validFiles].slice(0, 5));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: QuoteFormData) => {
    // Validate delivery method
    if (!deliveryMethod) {
      setDeliveryError('Selecciona un método de entrega');
      toast.error('Selecciona un método de entrega');
      return;
    }
    if ((deliveryMethod === 'installation' || deliveryMethod === 'shipping') && !useNewAddress && selectedAddressId && savedAddresses.length > 0) {
      // Using a saved address — no further validation needed
    } else if ((deliveryMethod === 'installation' || deliveryMethod === 'shipping') && !deliveryAddress.calle) {
      setDeliveryError('Ingresa la dirección de entrega');
      toast.error('Ingresa la dirección de entrega');
      return;
    }
    if (deliveryMethod === 'pickup' && !selectedBranch) {
      setDeliveryError('Selecciona una sucursal');
      toast.error('Selecciona una sucursal para recoger');
      return;
    }
    setDeliveryError('');

    setIsLoading(true);
    try {
      // Resolve delivery address — saved or manually entered
      let resolvedAddress = deliveryAddress;
      if ((deliveryMethod === 'installation' || deliveryMethod === 'shipping') && !useNewAddress && selectedAddressId && savedAddresses.length > 0) {
        const addr = savedAddresses.find((a) => a.id === selectedAddressId);
        if (addr) {
          resolvedAddress = {
            calle: addr.calle,
            numero_exterior: addr.numero_exterior,
            numero_interior: addr.numero_interior || '',
            colonia: addr.colonia,
            ciudad: addr.ciudad,
            estado: addr.estado,
            codigo_postal: addr.codigo_postal,
            referencia: addr.referencia || '',
          };
        }
      }

      const result = await submitQuoteRequest({
        customer_name: data.name,
        customer_email: data.email,
        customer_phone: data.phone,
        customer_company: data.company,
        catalog_item_id: data.catalog_item_id,
        quantity: data.quantity ? parseInt(data.quantity) : undefined,
        dimensions: data.dimensions,
        material: data.material,
        includes_installation: data.installation_required,
        description: data.description,
        delivery_method: deliveryMethod || undefined,
        delivery_address: (deliveryMethod === 'installation' || deliveryMethod === 'shipping') ? resolvedAddress : undefined,
        pickup_branch: deliveryMethod === 'pickup' ? selectedBranch : undefined,
        attachments: files,
      });
      setRequestNumber(result.request_number);
      setIsSuccess(true);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || 'Error al enviar cotización');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="text-center py-12">
            <div className="mx-auto w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircleIcon className="h-10 w-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">
              ¡Solicitud enviada con éxito!
            </h1>
            <p className="text-neutral-400 mb-2">
              Tu número de solicitud es:
            </p>
            <p className="text-2xl font-mono text-cyan-400 mb-6">{requestNumber}</p>
            <p className="text-neutral-400 mb-8">
              Nuestro equipo de ventas revisará tu solicitud y te contactará
              en las próximas 24 horas con una cotización personalizada.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/catalogo">
                <Button variant="outline">Seguir explorando</Button>
              </Link>
              <Link href="/">
                <Button>Volver al inicio</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[{ label: 'Solicitar Cotización' }]}
          className="mb-6"
        />

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Solicitar Cotización
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Cuéntanos sobre tu proyecto y te enviaremos una cotización
            personalizada en menos de 24 horas.
          </p>
        </div>

        {/* Form */}
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Contact Info */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-cyan-400" />
                Información de contacto
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nombre completo"
                  placeholder="Juan Pérez"
                  leftIcon={<UserIcon className="h-5 w-5" />}
                  error={errors.name?.message}
                  required
                  {...register('name')}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="tu@email.com"
                  leftIcon={<EnvelopeIcon className="h-5 w-5" />}
                  error={errors.email?.message}
                  required
                  {...register('email')}
                />
                <Input
                  label="Teléfono (opcional)"
                  placeholder="(555) 123-4567"
                  leftIcon={<PhoneIcon className="h-5 w-5" />}
                  {...register('phone')}
                />
                <Input
                  label="Empresa (opcional)"
                  placeholder="Mi Empresa S.A."
                  leftIcon={<BuildingOfficeIcon className="h-5 w-5" />}
                  {...register('company')}
                />
              </div>
            </div>

            {/* Project Details */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-cyan-400" />
                Detalles del proyecto
              </h2>
              <div className="space-y-4">
                <Select
                  label="Producto o servicio"
                  value={watch('catalog_item_id') || ''}
                  onChange={(value) => setValue('catalog_item_id', value)}
                  options={productOptions}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Cantidad"
                    type="number"
                    placeholder="1"
                    min="1"
                    {...register('quantity')}
                  />
                  <Input
                    label="Dimensiones"
                    placeholder="Ej: 3m x 2m"
                    {...register('dimensions')}
                  />
                </div>

                <Select
                  label="Material preferido"
                  value={watch('material') || ''}
                  onChange={(value) => setValue('material', value)}
                  options={MATERIAL_OPTIONS}
                />

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-neutral-950"
                    {...register('installation_required')}
                  />
                  <span className="text-neutral-300">
                    Requiero servicio de instalación
                  </span>
                </label>

                <Textarea
                  label="Descripción del proyecto"
                  placeholder="Describe tu proyecto con el mayor detalle posible: ubicación, acabados deseados, plazos de entrega, etc."
                  rows={5}
                  error={errors.description?.message}
                  required
                  {...register('description')}
                />
              </div>
            </div>

            {/* Delivery Method */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-cyan-400" />
                Método de entrega <span className="text-red-500">*</span>
              </h2>
              <p className="text-sm text-neutral-400 mb-4">Selecciona cómo deseas recibir tu producto o servicio</p>
              <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2">
                {DELIVERY_METHODS.filter(m => m !== 'not_applicable').map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setDeliveryMethod(prev => prev === method ? '' : method);
                      setDeliveryError('');
                      if (method !== deliveryMethod) {
                        setDeliveryAddress({ calle: '', numero_exterior: '', numero_interior: '', colonia: '', ciudad: '', estado: '', codigo_postal: '', referencia: '' });
                        setSelectedBranch('');
                        postalCode.reset();
                        setColoniaManual(false);
                        // Reset to saved address picker if user has saved addresses
                        if (savedAddresses.length > 0) {
                          setUseNewAddress(false);
                          const def = savedAddresses.find((a) => a.is_default);
                          setSelectedAddressId(def?.id || savedAddresses[0].id);
                        }
                      }
                    }}
                    className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-all ${
                      deliveryMethod === method
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 ring-2 ring-cyan-500/50'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    <span className="text-lg">{DELIVERY_METHOD_ICONS[method]}</span>
                    <span className="text-sm">{DELIVERY_METHOD_LABELS[method].es}</span>
                  </button>
                ))}
              </div>
              {deliveryError && <p className="text-red-500 text-sm mt-2">{deliveryError}</p>}

              {/* Installation / Shipping address */}
              {(deliveryMethod === 'installation' || deliveryMethod === 'shipping') && (
                <div className="mt-4 space-y-3 p-3 sm:p-4 rounded-lg border border-neutral-700 bg-neutral-900/50">
                  <p className="text-sm text-cyan-400 font-medium">
                    {deliveryMethod === 'installation' ? '📍 Dirección de instalación' : '📦 Dirección de envío'}
                  </p>

                  {/* Saved addresses picker (logged-in users with addresses) */}
                  {savedAddresses.length > 0 && !useNewAddress ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {savedAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => { setSelectedAddressId(addr.id); setDeliveryError(''); }}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              selectedAddressId === addr.id
                                ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/50'
                                : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <MapPinIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${selectedAddressId === addr.id ? 'text-cyan-400' : 'text-neutral-500'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-white">{addr.label || 'Dirección'}</span>
                                  {addr.is_default && <span className="text-xs text-cyan-400">(Predeterminada)</span>}
                                </div>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                  {addr.calle} {addr.numero_exterior}{addr.numero_interior ? ` Int. ${addr.numero_interior}` : ''}, {addr.colonia}, {addr.ciudad}, {addr.estado} C.P. {addr.codigo_postal}
                                </p>
                                {addr.referencia && (
                                  <p className="text-xs text-neutral-400 mt-0.5">
                                    Referencia: {addr.referencia}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUseNewAddress(true);
                          setDeliveryAddress({ calle: '', numero_exterior: '', numero_interior: '', colonia: '', ciudad: '', estado: '', codigo_postal: '', referencia: '' });
                          postalCode.reset();
                          setColoniaManual(false);
                        }}
                        className="text-sm text-cyan-400 hover:underline font-medium"
                      >
                        + Usar otra dirección
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Back to saved addresses link */}
                      {savedAddresses.length > 0 && useNewAddress && (
                        <button
                          type="button"
                          onClick={() => {
                            setUseNewAddress(false);
                            const def = savedAddresses.find((a) => a.is_default);
                            setSelectedAddressId(def?.id || savedAddresses[0].id);
                          }}
                          className="text-sm text-cyan-400 hover:underline font-medium mb-1"
                        >
                          ← Usar una dirección guardada
                        </button>
                      )}

                  {/* Row 1: Código Postal + Estado + Municipio */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1">Código Postal <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Input
                          placeholder="39300"
                          required
                          value={deliveryAddress.codigo_postal}
                          onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                            const cp = e.target.value.replace(/\D/g, '').slice(0, 5);
                            setDeliveryAddress(p => ({ ...p, codigo_postal: cp }));
                            if (cp.length === 5) {
                              const result = await postalCode.lookup(cp);
                              if (result) {
                                setDeliveryAddress(p => ({
                                  ...p,
                                  estado: result.estado,
                                  ciudad: result.municipio,
                                  colonia: result.colonias.length > 0 ? result.colonias[0] : '',
                                }));
                                setColoniaManual(false);
                              }
                            } else {
                              postalCode.reset();
                            }
                          }}
                        />
                        {postalCode.loading && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <svg className="animate-spin h-4 w-4 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {postalCode.error && (
                        <p className="text-xs text-red-400 mt-1">{postalCode.error}</p>
                      )}
                      {postalCode.data && (
                        <p className="text-xs text-green-400 mt-1">✓ CP encontrado — {postalCode.data.colonias.length} colonia{postalCode.data.colonias.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                    <Input
                      label="Estado"
                      placeholder="Guerrero"
                      required
                      value={deliveryAddress.estado}
                      readOnly={!!postalCode.data}
                      className={postalCode.data ? 'opacity-70' : ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryAddress(p => ({ ...p, estado: e.target.value }))}
                    />
                    <Input
                      label="Municipio / Ciudad"
                      placeholder="Acapulco de Juárez"
                      required
                      value={deliveryAddress.ciudad}
                      readOnly={!!postalCode.data?.municipio}
                      className={postalCode.data?.municipio ? 'opacity-70' : ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryAddress(p => ({ ...p, ciudad: e.target.value }))}
                    />
                  </div>

                  {/* Row 2: Colonia (dropdown from CP or manual) */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">Colonia <span className="text-red-500">*</span></label>
                    {postalCode.data && postalCode.data.colonias.length > 0 && !coloniaManual ? (
                      <div className="space-y-1">
                        <select
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                          value={deliveryAddress.colonia}
                          onChange={e => {
                            if (e.target.value === '__otra__') {
                              setColoniaManual(true);
                              setDeliveryAddress(p => ({ ...p, colonia: '' }));
                            } else {
                              setDeliveryAddress(p => ({ ...p, colonia: e.target.value }));
                            }
                          }}
                        >
                          {postalCode.data.colonias.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          <option value="__otra__">— Otra (escribir manualmente) —</option>
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Input
                          placeholder="Centro"
                          value={deliveryAddress.colonia}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryAddress(p => ({ ...p, colonia: e.target.value }))}
                        />
                        {coloniaManual && postalCode.data && (
                          <button
                            type="button"
                            className="text-xs text-cyan-400 hover:underline"
                            onClick={() => {
                              setColoniaManual(false);
                              setDeliveryAddress(p => ({ ...p, colonia: postalCode.data!.colonias[0] || '' }));
                            }}
                          >
                            ← Volver a seleccionar de la lista
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 3: Calle + Números */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Calle"
                      placeholder="Av. Costera Miguel Alemán"
                      required
                      value={deliveryAddress.calle}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryAddress(p => ({ ...p, calle: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="No. Exterior"
                        placeholder="123"
                        required
                        value={deliveryAddress.numero_exterior}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryAddress(p => ({ ...p, numero_exterior: e.target.value }))}
                      />
                      <Input
                        label="No. Interior"
                        placeholder="4B"
                        value={deliveryAddress.numero_interior}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryAddress(p => ({ ...p, numero_interior: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Row 4: Referencia */}
                  <Input
                    label="Referencia (opcional)"
                    placeholder="Entre calles, color de fachada, etc."
                    value={deliveryAddress.referencia}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryAddress(p => ({ ...p, referencia: e.target.value }))}
                  />
                    </>
                  )}
                </div>
              )}

              {/* Pickup — branch selection */}
              {deliveryMethod === 'pickup' && (
                <div className="mt-4 space-y-3 p-3 sm:p-4 rounded-lg border border-neutral-700 bg-neutral-900/50">
                  <p className="text-sm text-cyan-400 font-medium">🏬 Selecciona la sucursal donde recogerás tu pedido</p>
                  {branchesLoading ? (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-800/60">
                      <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm text-neutral-400">Cargando sucursales...</span>
                    </div>
                  ) : branchesError ? (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                      <p className="text-sm text-red-400 mb-2">No se pudieron cargar las sucursales</p>
                      <button
                        type="button"
                        onClick={fetchBranches}
                        className="text-xs text-cyan-400 hover:underline font-medium"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : branches.length === 0 ? (
                    <p className="text-sm text-neutral-400 p-4 text-center">No hay sucursales disponibles actualmente.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {branches.map((branch) => (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => { setSelectedBranch(branch.id); setDeliveryError(''); }}
                          className={`text-left p-3 sm:p-4 rounded-lg border transition-all ${
                            selectedBranch === branch.id
                              ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/50'
                              : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl mt-0.5 hidden sm:block">{selectedBranch === branch.id ? '✅' : '🏬'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm sm:text-base">{branch.name}</p>
                              <p className="text-xs sm:text-sm text-neutral-400 mt-1 break-words">{branch.full_address}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                <p className="text-xs text-neutral-400">📞 {branch.phone}</p>
                                <p className="text-xs text-neutral-400">🕐 {branch.hours}</p>
                              </div>
                              {branch.google_maps_url && (
                                <a
                                  href={branch.google_maps_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-xs text-cyan-400 hover:underline mt-2 inline-flex items-center gap-1"
                                >
                                  📍 Ver en Google Maps →
                                </a>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Digital — confirmation note */}
              {deliveryMethod === 'digital' && (
                <div className="mt-4 flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <span className="text-lg sm:text-xl">💻</span>
                  <div>
                    <p className="text-sm text-green-400 font-medium">Entrega digital</p>
                    <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                      Los archivos finales se enviarán al correo electrónico que proporcionaste en los datos de contacto.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Attachments */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <PaperClipIcon className="h-5 w-5 text-cyan-400" />
                Archivos adjuntos (opcional)
              </h2>
              <p className="text-sm text-neutral-400 mb-4">
                Sube artes, bocetos o referencias. Máximo 5 archivos de 10MB cada uno.
                Formatos: JPG, PNG, PDF.
              </p>

              <div className="space-y-3">
                {/* File list */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-neutral-800 rounded-lg px-4 py-2"
                      >
                        <span className="text-sm text-neutral-300 truncate flex-1">
                          {file.name}
                        </span>
                        <span className="text-xs text-neutral-500 mx-4">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-neutral-400 hover:text-red-500"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                {files.length < 5 && (
                  <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-neutral-700 rounded-lg cursor-pointer hover:border-neutral-600 transition-colors">
                    <div className="text-center">
                      <PaperClipIcon className="h-8 w-8 text-neutral-500 mx-auto mb-2" />
                      <span className="text-neutral-400">
                        Haz clic para subir archivos
                      </span>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.pdf,.webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Privacy consent */}
            <div className="border-t border-neutral-800 pt-6">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 w-5 h-5 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-neutral-950"
                  {...register('privacy_accepted')}
                />
                <span className="text-sm text-neutral-400">
                  He leído y acepto la{' '}
                  <button type="button" onClick={openPrivacy} className="text-cyan-400 hover:underline">
                    Política de Privacidad
                  </button>
                  . Entiendo que mis datos serán utilizados para procesar mi solicitud
                  de cotización.
                </span>
              </label>
              {errors.privacy_accepted && (
                <p className="text-red-500 text-sm mt-2">
                  {errors.privacy_accepted.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isLoading}
            >
              Enviar solicitud de cotización
            </Button>
          </form>
        </Card>

        {/* Contact info */}
        <div className="mt-8 text-center text-neutral-400">
          <p>
            ¿Prefieres contactarnos directamente? Llámanos al{' '}
            <a href="tel:+527441234567" className="text-cyan-400 hover:underline">
              (744) 123-4567
            </a>{' '}
            o escríbenos a{' '}
            <a href="mailto:ventas@agenciamcd.mx" className="text-cyan-400 hover:underline">
              ventas@agenciamcd.mx
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
