'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useTranslations, useLocale } from 'next-intl';

import { Button, Input, Card } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { resendVerification } from '@/lib/api/auth';
import { useRecaptcha } from '@/hooks';
import { getBackendOrigin } from '@/lib/api/base-url';

const loginSchema = z.object({
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  const redirectTo = searchParams.get('redirect') || `/${locale}`;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      // Execute reCAPTCHA verification
      let recaptchaToken: string | null = null;
      if (recaptchaEnabled) {
        recaptchaToken = await executeRecaptcha('login');
        if (!recaptchaToken) {
          toast.error('Error de verificación. Por favor, intenta de nuevo.');
          setIsLoading(false);
          return;
        }
      }

      // Include recaptcha token with login data
      await login({ ...data, recaptcha_token: recaptchaToken });
      toast.success('¡Bienvenido de nuevo!');

      // Si hay un producto pendiente, redirigir a su página de detalle
      // para que se pueda seleccionar variante y agregar desde ahí
      const pending = localStorage.getItem('pendingAddToCart');
      if (pending) {
        try {
          const { categorySlug, productSlug } = JSON.parse(pending);
          localStorage.removeItem('pendingAddToCart');
          router.push(`/${locale}/catalogo/${categorySlug}/${productSlug}`);
          return;
        } catch {
          // Invalid pending item, ignore and continue with redirect
        }
      }

      router.push(redirectTo);
    } catch (error: unknown) {
      const err = error as { message?: string; data?: Record<string, unknown> };

      // Detect email-not-verified error
      const isNotVerified =
        (err.message && err.message.toLowerCase().includes('verificar tu correo')) ||
        (err.data?.non_field_errors &&
          Array.isArray(err.data.non_field_errors) &&
          (err.data.non_field_errors as string[]).some((e) =>
            e.toLowerCase().includes('verificar tu correo')
          ));

      if (isNotVerified) {
        setEmailNotVerified(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.error(err.message || 'Error al iniciar sesión');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md max-h-[calc(100dvh-6rem)] overflow-y-auto" padding="sm">
      <div className="text-center mb-3">
        <h1 className="text-xl font-bold text-white mb-1">Iniciar Sesión</h1>
        <p className="text-neutral-400 text-sm">Ingresa a tu cuenta para continuar</p>
      </div>

      {/* Email not verified banner */}
      {emailNotVerified && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/40 rounded-lg">
          <p className="text-yellow-200 text-sm font-medium mb-1">
            Debes verificar tu correo electrónico antes de iniciar sesión.
          </p>
          <p className="text-neutral-300 text-sm">
            Revisa tu bandeja de entrada.{' '}
            <button
              type="button"
              disabled={resendingEmail}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline disabled:opacity-50"
              onClick={async () => {
                const emailValue = document.querySelector<HTMLInputElement>('input[type=email]')?.value;
                if (!emailValue) return;
                setResendingEmail(true);
                try {
                  await resendVerification(emailValue);
                  toast.success('Correo de verificación reenviado. Revisa tu bandeja.');
                } catch (err: unknown) {
                  const apiErr = err as { message?: string; data?: { detail?: string } };
                  const detail = apiErr?.data?.detail || apiErr?.message || '';
                  toast.error(
                    detail
                      ? `No se pudo reenviar el correo: ${detail}`
                      : 'No se pudo reenviar el correo. Intenta más tarde.'
                  );
                } finally {
                  setResendingEmail(false);
                }
              }}
            >
              {resendingEmail ? 'Reenviando...' : 'Reenviar correo de verificación'}
            </button>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="tu@email.com"
          leftIcon={<EnvelopeIcon className="h-5 w-5" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Contraseña"
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
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-neutral-950"
            />
            <span className="ml-2 text-sm text-neutral-400">Recordarme</span>
          </label>
          <Link
            href={`/${locale}/recuperar-contrasena`}
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Iniciar Sesión
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-800"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-neutral-900 text-neutral-500">o continúa con</span>
        </div>
      </div>

      {/* Social Login */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          sessionStorage.setItem('oauth_redirect', redirectTo);
          const backendUrl = getBackendOrigin();
          const callbackUrl = '/api/v1/auth/google/callback/';
          window.location.href = `${backendUrl}/accounts/google/login/?next=${encodeURIComponent(callbackUrl)}`;
        }}
        leftIcon={
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        }
      >
        Iniciar con Google
      </Button>

      {/* Register link */}
      <p className="mt-3 text-center text-sm text-neutral-400">
        ¿No tienes cuenta?{' '}
        <Link
          href={`/${locale}/registro`}
          className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
        >
          Regístrate aquí
        </Link>
      </p>
    </Card>
  );
}
