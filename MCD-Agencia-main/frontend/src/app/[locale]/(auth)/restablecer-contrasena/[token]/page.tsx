'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

import { Button, Input, Card } from '@/components/ui';
import { confirmPasswordReset } from '@/lib/api/auth';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    password_confirm: z.string(),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['password_confirm'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      await confirmPasswordReset({
        token,
        password: data.password,
        password_confirm: data.password_confirm,
      });
      setIsSuccess(true);
    } catch (error: unknown) {
      const err = error as { message?: string; data?: { detail?: string } };
      toast.error(
        err.data?.detail ||
          err.message ||
          'Error al restablecer la contraseña. El enlace puede haber expirado.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md max-h-[calc(100dvh-6rem)] overflow-y-auto text-center" padding="sm">
        <div className="mb-3">
          <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-2">
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">
            ¡Contraseña restablecida!
          </h1>
          <p className="text-neutral-400">
            Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión con
            tu nueva contraseña.
          </p>
        </div>

        <Link href="/login">
          <Button className="w-full">
            Ir a iniciar sesión
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md max-h-[calc(100dvh-6rem)] overflow-y-auto" padding="sm">
      <div className="text-center mb-3">
        <h1 className="text-xl font-bold text-white mb-1">Nueva Contraseña</h1>
        <p className="text-neutral-400">Ingresa tu nueva contraseña</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input
          label="Nueva contraseña"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          leftIcon={<LockClosedIcon className="h-5 w-5" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="focus:outline-none"
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          }
          helperText="Mínimo 8 caracteres, una mayúscula y un número"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirmar nueva contraseña"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="••••••••"
          leftIcon={<LockClosedIcon className="h-5 w-5" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="focus:outline-none"
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          }
          error={errors.password_confirm?.message}
          {...register('password_confirm')}
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Restablecer contraseña
        </Button>
      </form>
    </Card>
  );
}
