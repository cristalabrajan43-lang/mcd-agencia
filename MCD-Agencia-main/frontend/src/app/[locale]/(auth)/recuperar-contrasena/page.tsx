'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { EnvelopeIcon, ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

import { Button, Input, Card } from '@/components/ui';
import { requestPasswordReset } from '@/lib/api/auth';

const resetSchema = z.object({
  email: z.string().email('Ingresa un email válido'),
});

type ResetFormData = z.infer<typeof resetSchema>;

export default function RecoverPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: ResetFormData) => {
    setIsLoading(true);
    try {
      await requestPasswordReset(data);
      setSubmittedEmail(data.email);
      setIsSuccess(true);
    } catch (error: unknown) {
      // Don't reveal if email exists or not for security
      setSubmittedEmail(data.email);
      setIsSuccess(true);
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
          <h1 className="text-xl font-bold text-white mb-1">Revisa tu correo</h1>
          <p className="text-neutral-400">
            Si existe una cuenta asociada a <strong className="text-white">{submittedEmail}</strong>,
            recibirás un enlace para restablecer tu contraseña.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-neutral-500">
            ¿No recibiste el correo? Revisa tu carpeta de spam o intenta de nuevo.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsSuccess(false)}
          >
            Intentar con otro correo
          </Button>
          <Link href="/login">
            <Button variant="ghost" className="w-full">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Volver al inicio de sesión
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md max-h-[calc(100dvh-6rem)] overflow-y-auto" padding="sm">
      <div className="text-center mb-3">
        <h1 className="text-xl font-bold text-white mb-1">Recuperar Contraseña</h1>
        <p className="text-neutral-400">
          Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="tu@email.com"
          leftIcon={<EnvelopeIcon className="h-5 w-5" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Enviar enlace de recuperación
        </Button>
      </form>

      <p className="mt-3 text-center text-sm">
        <Link
          href="/login"
          className="text-neutral-400 hover:text-white transition-colors inline-flex items-center"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Volver al inicio de sesión
        </Link>
      </p>
    </Card>
  );
}
