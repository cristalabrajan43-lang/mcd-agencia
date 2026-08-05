'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  StarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

import { useAuth } from '@/contexts/AuthContext';
import {
  updateProfile,
  getUserAddresses,
  createUserAddress,
  updateUserAddress,
  deleteUserAddress,
  type UserAddress,
} from '@/lib/api/auth';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { formatDate, getInitials } from '@/lib/utils';
import { usePostalCode } from '@/hooks/usePostalCode';

const profileSchema = z.object({
  first_name: z.string().min(2, 'Nombre requerido'),
  last_name: z.string().min(2, 'Apellido requerido'),
  phone: z.string().optional(),
  company: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const addressSchema = z.object({
  label: z.string().optional(),
  calle: z.string().min(1, 'Calle requerida'),
  numero_exterior: z.string().min(1, 'No. exterior requerido'),
  numero_interior: z.string().optional(),
  colonia: z.string().min(1, 'Colonia requerida'),
  ciudad: z.string().min(1, 'Ciudad requerida'),
  estado: z.string().min(1, 'Estado requerido'),
  codigo_postal: z.string().min(5, 'Código postal requerido'),
  referencia: z.string().optional(),
  is_default: z.boolean().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Addresses
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const postalCode = usePostalCode();
  const [coloniaManual, setColoniaManual] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      company: user?.company || '',
    },
  });

  const addressForm = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: '',
      calle: '',
      numero_exterior: '',
      numero_interior: '',
      colonia: '',
      ciudad: '',
      estado: '',
      codigo_postal: '',
      referencia: '',
      is_default: false,
    },
  });

  // Fetch addresses
  const fetchAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const data = await getUserAddresses();
      const list = Array.isArray(data) ? data : (data as any).results ?? [];
      setAddresses(list);
    } catch {
      // silently fail
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    if (user) fetchAddresses();
  }, [user]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      await updateProfile(data);
      await refreshUser();
      toast.success('Perfil actualizado');
      setIsEditing(false);
    } catch {
      toast.error('Error al actualizar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    reset({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      company: user?.company || '',
    });
    setIsEditing(false);
  };

  const openAddressForm = (addr?: UserAddress) => {
    if (addr) {
      setEditingAddressId(addr.id);
      addressForm.reset({
        label: addr.label || '',
        calle: addr.calle,
        numero_exterior: addr.numero_exterior,
        numero_interior: addr.numero_interior || '',
        colonia: addr.colonia,
        ciudad: addr.ciudad,
        estado: addr.estado,
        codigo_postal: addr.codigo_postal,
        referencia: addr.referencia || '',
        is_default: addr.is_default,
      });
      postalCode.reset();
      setColoniaManual(false);
      if (addr.codigo_postal && addr.codigo_postal.length === 5) {
        postalCode.lookup(addr.codigo_postal);
      }
    } else {
      setEditingAddressId(null);
      addressForm.reset({
        label: '',
        calle: '',
        numero_exterior: '',
        numero_interior: '',
        colonia: '',
        ciudad: '',
        estado: '',
        codigo_postal: '',
        referencia: '',
        is_default: addresses.length === 0,
      });
      postalCode.reset();
      setColoniaManual(false);
    }
    setShowAddressForm(true);
  };

  const handleAddressSave = async (data: AddressFormData) => {
    try {
      if (editingAddressId) {
        await updateUserAddress(editingAddressId, data);
        toast.success('Dirección actualizada');
      } else {
        await createUserAddress({
          ...data,
          label: data.label || '',
          numero_interior: data.numero_interior || '',
          referencia: data.referencia || '',
          is_default: data.is_default ?? false,
        });
        toast.success('Dirección agregada');
      }
      setShowAddressForm(false);
      setEditingAddressId(null);
      fetchAddresses();
    } catch {
      toast.error('Error al guardar dirección');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteUserAddress(id);
      toast.success('Dirección eliminada');
      fetchAddresses();
    } catch {
      toast.error('Error al eliminar dirección');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await updateUserAddress(id, { is_default: true });
      toast.success('Dirección predeterminada actualizada');
      fetchAddresses();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.full_name}
                className="w-24 h-24 rounded-full object-cover border-4 border-neutral-800"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center text-3xl font-bold text-white">
                {getInitials(user.full_name || user.email)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-2xl font-bold text-white">{user.full_name}</h2>
            <p className="text-neutral-400">{user.email}</p>
            <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
              <Badge variant={user.is_email_verified ? 'success' : 'warning'}>
                {user.is_email_verified ? 'Email verificado' : 'Email no verificado'}
              </Badge>
              {user.role && (
                <Badge variant="cyan">{user.role.display_name}</Badge>
              )}
            </div>
          </div>

          {/* Edit Button */}
          {!isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Editar perfil
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nombre"
                  leftIcon={<UserCircleIcon className="h-5 w-5" />}
                  error={errors.first_name?.message}
                  {...register('first_name')}
                />
                <Input
                  label="Apellido"
                  error={errors.last_name?.message}
                  {...register('last_name')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Teléfono"
                  leftIcon={<PhoneIcon className="h-5 w-5" />}
                  placeholder="(555) 123-4567"
                  {...register('phone')}
                />
                <Input
                  label="Empresa"
                  leftIcon={<BuildingOfficeIcon className="h-5 w-5" />}
                  placeholder="Nombre de tu empresa (opcional)"
                  {...register('company')}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="button" variant="ghost" onClick={handleCancel}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  Guardar cambios
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-neutral-500">Nombre completo</label>
                  <p className="text-white mt-1 flex items-center gap-2">
                    <UserCircleIcon className="h-5 w-5 text-neutral-400" />
                    {user.full_name}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-neutral-500">Email</label>
                  <p className="text-white mt-1 flex items-center gap-2">
                    <EnvelopeIcon className="h-5 w-5 text-neutral-400" />
                    {user.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-neutral-500">Teléfono</label>
                  <p className="text-white mt-1 flex items-center gap-2">
                    <PhoneIcon className="h-5 w-5 text-neutral-400" />
                    {user.phone || 'No especificado'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-neutral-500">Empresa</label>
                  <p className="text-white mt-1 flex items-center gap-2">
                    <BuildingOfficeIcon className="h-5 w-5 text-neutral-400" />
                    {user.company || 'No especificada'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-neutral-500">Fecha de nacimiento</label>
                  <p className="text-white mt-1 flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-neutral-400" />
                    {user.date_of_birth ? formatDate(user.date_of_birth) : 'No especificada'}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-800">
                <label className="text-sm text-neutral-500">Idioma preferido</label>
                <p className="text-white mt-1">
                  {user.preferred_language === 'en' ? 'English' : 'Español'}
                </p>
              </div>

              <div className="pt-4 border-t border-neutral-800">
                <label className="text-sm text-neutral-500">Miembro desde</label>
                <p className="text-white mt-1">{formatDate(user.created_at)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery Addresses */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-cyan-400" />
              Direcciones de entrega
            </CardTitle>
            {!showAddressForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openAddressForm()}
                className="flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Agregar dirección
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Address Form (add / edit) */}
          {showAddressForm && (
            <form
              onSubmit={addressForm.handleSubmit(handleAddressSave)}
              className="mb-6 p-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-medium">
                  {editingAddressId ? 'Editar dirección' : 'Nueva dirección'}
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowAddressForm(false); setEditingAddressId(null); }}
                  className="text-neutral-400 hover:text-white"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <Input
                label="Etiqueta (opcional)"
                placeholder='Ej. "Oficina", "Casa", "Bodega"'
                error={addressForm.formState.errors.label?.message}
                {...addressForm.register('label')}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Código Postal <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Input
                      placeholder="39300"
                      value={addressForm.watch('codigo_postal')}
                      error={addressForm.formState.errors.codigo_postal?.message}
                      onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                        const cp = e.target.value.replace(/\D/g, '').slice(0, 5);
                        addressForm.setValue('codigo_postal', cp);
                        if (cp.length === 5) {
                          const result = await postalCode.lookup(cp);
                          if (result) {
                            addressForm.setValue('estado', result.estado);
                            addressForm.setValue('ciudad', result.municipio);
                            addressForm.setValue('colonia', result.colonias.length > 0 ? result.colonias[0] : '');
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
                  value={addressForm.watch('estado')}
                  readOnly={!!postalCode.data}
                  className={postalCode.data ? 'opacity-70' : ''}
                  error={addressForm.formState.errors.estado?.message}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => addressForm.setValue('estado', e.target.value)}
                />
                <Input
                  label="Municipio / Ciudad"
                  placeholder="Acapulco de Juárez"
                  value={addressForm.watch('ciudad')}
                  readOnly={!!postalCode.data?.municipio}
                  className={postalCode.data?.municipio ? 'opacity-70' : ''}
                  error={addressForm.formState.errors.ciudad?.message}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => addressForm.setValue('ciudad', e.target.value)}
                />
              </div>

              {/* Colonia: dropdown from CP or manual */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Colonia <span className="text-red-500">*</span></label>
                {postalCode.data && postalCode.data.colonias.length > 0 && !coloniaManual ? (
                  <div className="space-y-1">
                    <select
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                      value={addressForm.watch('colonia')}
                      onChange={e => {
                        if (e.target.value === '__otra__') {
                          setColoniaManual(true);
                          addressForm.setValue('colonia', '');
                        } else {
                          addressForm.setValue('colonia', e.target.value);
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
                      value={addressForm.watch('colonia')}
                      error={addressForm.formState.errors.colonia?.message}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => addressForm.setValue('colonia', e.target.value)}
                    />
                    {coloniaManual && postalCode.data && (
                      <button
                        type="button"
                        className="text-xs text-cyan-400 hover:underline"
                        onClick={() => {
                          setColoniaManual(false);
                          addressForm.setValue('colonia', postalCode.data!.colonias[0] || '');
                        }}
                      >
                        ← Volver a seleccionar de la lista
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Calle"
                  placeholder="Av. Costera Miguel Alemán"
                  error={addressForm.formState.errors.calle?.message}
                  {...addressForm.register('calle')}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="No. Exterior"
                    placeholder="123"
                    error={addressForm.formState.errors.numero_exterior?.message}
                    {...addressForm.register('numero_exterior')}
                  />
                  <Input
                    label="No. Interior"
                    placeholder="4B"
                    {...addressForm.register('numero_interior')}
                  />
                </div>
              </div>

              <Input
                label="Referencia (opcional)"
                placeholder="Entre calles, color de fachada, etc."
                {...addressForm.register('referencia')}
              />

              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-cmyk-cyan focus:ring-cmyk-cyan"
                  {...addressForm.register('is_default')}
                />
                Establecer como dirección predeterminada
              </label>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowAddressForm(false); setEditingAddressId(null); }}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" isLoading={addressForm.formState.isSubmitting}>
                  {editingAddressId ? 'Guardar cambios' : 'Agregar'}
                </Button>
              </div>
            </form>
          )}

          {/* Address list */}
          {loadingAddresses ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : addresses.length === 0 && !showAddressForm ? (
            <div className="text-center py-8">
              <MapPinIcon className="h-12 w-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400 mb-4">
                No tienes direcciones guardadas.
              </p>
              <Button variant="outline" size="sm" onClick={() => openAddressForm()}>
                <PlusIcon className="h-4 w-4 mr-1" />
                Agregar tu primera dirección
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-4 rounded-lg border transition-all ${
                    addr.is_default
                      ? 'border-cyan-500/50 bg-cyan-500/5'
                      : 'border-neutral-800 bg-neutral-900/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {addr.is_default ? (
                          <StarIconSolid className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                        ) : (
                          <MapPinIcon className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                        )}
                        <span className="text-white font-medium text-sm">
                          {addr.label || 'Dirección'}
                          {addr.is_default && (
                            <span className="ml-2 text-xs text-cyan-400">(Predeterminada)</span>
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-400 ml-6">
                        {addr.calle} {addr.numero_exterior}
                        {addr.numero_interior ? ` Int. ${addr.numero_interior}` : ''}
                        , {addr.colonia}, {addr.ciudad}, {addr.estado} C.P. {addr.codigo_postal}
                      </p>
                      {addr.referencia && (
                        <p className="text-xs text-neutral-500 ml-6 mt-1">
                          Ref: {addr.referencia}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!addr.is_default && (
                        <button
                          onClick={() => handleSetDefault(addr.id)}
                          className="p-1.5 text-neutral-500 hover:text-cyan-400 transition-colors"
                          title="Establecer como predeterminada"
                        >
                          <StarIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openAddressForm(addr)}
                        className="p-1.5 text-neutral-500 hover:text-white transition-colors"
                        title="Editar"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        disabled={deletingId === addr.id}
                        className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Eliminar"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Marketing Consent */}
      <Card>
        <CardHeader>
          <CardTitle>Preferencias de comunicación</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-white">Recibir ofertas y novedades</p>
              <p className="text-sm text-neutral-400">
                Te enviaremos información sobre promociones y nuevos productos
              </p>
            </div>
            <input
              type="checkbox"
              checked={user.marketing_consent}
              onChange={async (e) => {
                try {
                  await updateProfile({ marketing_consent: e.target.checked });
                  await refreshUser();
                  toast.success('Preferencias actualizadas');
                } catch {
                  toast.error('Error al actualizar');
                }
              }}
              className="w-5 h-5 rounded border-neutral-700 bg-neutral-900 text-cmyk-cyan focus:ring-cmyk-cyan focus:ring-offset-neutral-950"
            />
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
