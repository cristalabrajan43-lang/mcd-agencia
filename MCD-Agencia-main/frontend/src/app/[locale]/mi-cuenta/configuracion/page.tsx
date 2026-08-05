'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { LockClosedIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { changePassword } from '@/lib/api/auth';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Modal } from '@/components/ui';

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Contraseña actual requerida'),
    new_password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener una mayúscula')
      .regex(/[0-9]/, 'Debe contener un número'),
    new_password_confirm: z.string(),
  })
  .refine((data) => data.new_password === data.new_password_confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['new_password_confirm'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);
    try {
      await changePassword(data);
      toast.success('Contraseña actualizada');
      reset();
    } catch (error: unknown) {
      const err = error as { message?: string; data?: { current_password?: string[] } };
      if (err.data?.current_password) {
        toast.error('Contraseña actual incorrecta');
      } else {
        toast.error(err.message || 'Error al cambiar contraseña');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    // In a real app, this would call an API endpoint
    toast.success('Solicitud de eliminación enviada');
    setShowDeleteModal(false);
    logout();
    router.push('/');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Configuración</h2>
        <p className="text-neutral-400">Administra tu cuenta y seguridad</p>
      </div>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockClosedIcon className="h-5 w-5 text-cyan-400" />
            Cambiar Contraseña
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
            <Input
              label="Contraseña actual"
              type="password"
              error={errors.current_password?.message}
              {...register('current_password')}
            />

            <Input
              label="Nueva contraseña"
              type="password"
              helperText="Mínimo 8 caracteres, una mayúscula y un número"
              error={errors.new_password?.message}
              {...register('new_password')}
            />

            <Input
              label="Confirmar nueva contraseña"
              type="password"
              error={errors.new_password_confirm?.message}
              {...register('new_password_confirm')}
            />

            <Button type="submit" isLoading={isLoading}>
              Cambiar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Sesiones activas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-neutral-400 mb-4">
            Puedes cerrar sesión en todos los dispositivos si crees que tu cuenta ha sido comprometida.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              logout();
              router.push('/login');
            }}
          >
            Cerrar todas las sesiones
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-red-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-500">
            <TrashIcon className="h-5 w-5" />
            Eliminar Cuenta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-neutral-400 mb-4">
            Una vez que elimines tu cuenta, todos tus datos serán borrados permanentemente.
            Esta acción no se puede deshacer.
          </p>
          <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
            Eliminar mi cuenta
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="¿Eliminar cuenta?"
      >
        <div className="text-center py-4">
          <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-neutral-300 mb-6">
            Esta acción eliminará permanentemente tu cuenta y todos tus datos.
            No podrás recuperar tu información después de confirmar.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteAccount}>
              Sí, eliminar cuenta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
