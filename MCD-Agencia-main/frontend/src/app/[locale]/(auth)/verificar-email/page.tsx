'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

import { Button, Card } from '@/components/ui';
import { verifyEmail } from '@/lib/api/auth';

export default function VerifyEmailPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No se proporcionó un token de verificación.');
      return;
    }

    const verify = async () => {
      try {
        await verifyEmail(token);
        setStatus('success');
        setMessage('¡Tu correo electrónico ha sido verificado exitosamente!');
      } catch (error: unknown) {
        const err = error as { message?: string };
        setStatus('error');
        setMessage(
          err.message || 'El enlace de verificación es inválido o ha expirado.'
        );
      }
    };

    verify();
  }, [token]);

  return (
    <Card className="w-full max-w-md max-h-[calc(100dvh-6rem)] overflow-y-auto" padding="sm">
      <div className="text-center py-3">
        {status === 'loading' && (
          <>
            <ArrowPathIcon className="h-12 w-12 text-cyan-400 mx-auto mb-3 animate-spin" />
            <h1 className="text-xl font-bold text-white mb-1">
              Verificando tu correo...
            </h1>
            <p className="text-neutral-400">
              Espera un momento mientras verificamos tu correo electrónico.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-white mb-1">
              ¡Correo verificado!
            </h1>
            <p className="text-neutral-400 mb-3">{message}</p>
            <Link href={`/${locale}/login`}>
              <Button className="w-full">
                Iniciar Sesión
              </Button>
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <ExclamationTriangleIcon className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-white mb-1">
              No se pudo verificar
            </h1>
            <p className="text-neutral-400 mb-3">{message}</p>
            <div className="space-y-3">
              <Link href={`/${locale}/login`}>
                <Button className="w-full">
                  Ir a Iniciar Sesión
                </Button>
              </Link>
              <p className="text-neutral-500 text-sm">
                Si ya verificaste tu correo, puedes iniciar sesión directamente.
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
