'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  UserIcon,
  PhoneIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

import { Button, Input, Card } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useLegalModal } from '@/contexts/LegalModalContext';
import { useRecaptcha } from '@/hooks';
import { getBackendOrigin } from '@/lib/api/base-url';

const registerSchema = z
  .object({
    first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    last_name: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
    email: z.string().email('Ingresa un email válido'),
    phone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos'),
    date_of_birth: z.string().min(1, 'La fecha de nacimiento es requerida'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    password_confirm: z.string(),
    terms_accepted: z.literal(true, {
      errorMap: () => ({ message: 'Debes aceptar los términos y condiciones' }),
    }),
    privacy_accepted: z.literal(true, {
      errorMap: () => ({ message: 'Debes aceptar la política de privacidad' }),
    }),
    marketing_consent: z.boolean().optional(),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['password_confirm'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { register: registerUser } = useAuth();
  const { openPrivacy, openTerms } = useLegalModal();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState(false);

  // Get pre-fill values from URL
  const prefillEmail = searchParams.get('email') || '';
  const redirectUrl = searchParams.get('redirect') || '';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: prefillEmail,
      marketing_consent: false,
    },
  });

  // Pre-fill email if provided in URL
  useEffect(() => {
    if (prefillEmail) {
      setValue('email', prefillEmail);
    }
  }, [prefillEmail, setValue]);

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      // Execute reCAPTCHA verification
      let recaptchaToken: string | null = null;
      if (recaptchaEnabled) {
        recaptchaToken = await executeRecaptcha('register');
        if (!recaptchaToken) {
          toast.error('Error de verificación. Por favor, intenta de nuevo.');
          setIsLoading(false);
          return;
        }
      }

      // Include recaptcha token with registration data
      await registerUser({ ...data, recaptcha_token: recaptchaToken });
      toast.success('¡Registro exitoso! Revisa tu email para verificar tu cuenta.');
      // Redirect to the specified URL or login page
      if (redirectUrl) {
        router.push(`/${locale}/login?registered=true&redirect=${encodeURIComponent(redirectUrl)}`);
      } else {
        router.push(`/${locale}/login?registered=true`);
      }
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number; data?: Record<string, string[]> };

      // Detect duplicate email (backend returns 400 with email field error)
      const emailErrors = err.data?.email;
      const isDuplicate =
        Array.isArray(emailErrors) &&
        emailErrors.some((e) => e.toLowerCase().includes('ya existe') || e.toLowerCase().includes('already'));

      if (isDuplicate) {
        setDuplicateEmail(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (err.data) {
        const firstError = Object.values(err.data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : err.message || 'Error al registrar');
      } else {
        toast.error(err.message || 'Error al registrar');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl" padding="sm">
      <div className="text-center mb-2">
        <h1 className="text-xl font-bold text-white">Crear Cuenta</h1>
      </div>

      {/* Duplicate email banner */}
      {duplicateEmail && (
        <div className="mb-2 p-2 bg-yellow-500/10 border border-yellow-500/40 rounded-lg">
          <p className="text-yellow-200 text-sm font-medium mb-1">
            Ya existe una cuenta con este correo electrónico.
          </p>
          <p className="text-neutral-300 text-sm">
            ¿Quieres{' '}
            <Link
              href={`/${locale}/login`}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline"
            >
              iniciar sesión
            </Link>
            {' '}o{' '}
            <Link
              href={`/${locale}/recuperar-contrasena`}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline"
            >
              recuperar tu contraseña
            </Link>
            ?
          </p>
        </div>
      )}

      {prefillEmail && (
        <div className="mb-2 p-2 bg-cmyk-cyan/10 border border-cmyk-cyan/30 rounded-lg">
          <p className="text-neutral-300 text-sm">
            Crea tu cuenta con <strong className="text-white">{prefillEmail}</strong> para gestionar tus cotizaciones y dar seguimiento a tus pedidos.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            label="Nombre"
            placeholder="Juan"
            leftIcon={<UserIcon className="h-5 w-5" />}
            error={errors.first_name?.message}
            {...register('first_name')}
          />
          <Input
            label="Apellido"
            placeholder="Pérez"
            error={errors.last_name?.message}
            {...register('last_name')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            label="Correo electrónico"
            type="email"
            placeholder="tu@email.com"
            leftIcon={<EnvelopeIcon className="h-5 w-5" />}
            error={errors.email?.message}
            {...register('email', {
              onChange: () => duplicateEmail && setDuplicateEmail(false),
            })}
          />
          <Input
            label="Teléfono"
            type="tel"
            placeholder="(555) 123-4567"
            leftIcon={<PhoneIcon className="h-5 w-5" />}
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Input
            label="Fecha de nacimiento"
            type="date"
            leftIcon={<CalendarIcon className="h-5 w-5" />}
            className="min-w-0"
            error={errors.date_of_birth?.message}
            {...register('date_of_birth')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            helperText="Min. 8 caracteres, 1 mayúscula, 1 número"
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
          <Input
            label="Confirmar contraseña"
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
        </div>

        {/* Consents */}
        <div className="space-y-1">
          <label className="flex items-start">
            <input
              type="checkbox"
              className="w-4 h-4 mt-1 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-neutral-950"
              {...register('terms_accepted')}
            />
            <span className="ml-2 text-sm text-neutral-400">
              Acepto los{' '}
              <button type="button" onClick={openTerms} className="text-cyan-400 hover:underline">
                Términos y Condiciones
              </button>
              {errors.terms_accepted && (
                <span className="block text-red-500 text-xs mt-1">
                  {errors.terms_accepted.message}
                </span>
              )}
            </span>
          </label>

          <label className="flex items-start">
            <input
              type="checkbox"
              className="w-4 h-4 mt-1 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-neutral-950"
              {...register('privacy_accepted')}
            />
            <span className="ml-2 text-sm text-neutral-400">
              Acepto la{' '}
              <button type="button" onClick={openPrivacy} className="text-cyan-400 hover:underline">
                Política de Privacidad
              </button>
              {errors.privacy_accepted && (
                <span className="block text-red-500 text-xs mt-1">
                  {errors.privacy_accepted.message}
                </span>
              )}
            </span>
          </label>

          <label className="flex items-start">
            <input
              type="checkbox"
              className="w-4 h-4 mt-1 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-neutral-950"
              {...register('marketing_consent')}
            />
            <span className="ml-2 text-sm text-neutral-400">
              Deseo recibir ofertas y novedades por email (opcional)
            </span>
          </label>
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Crear Cuenta
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-800"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-neutral-900 text-neutral-500">o regístrate con</span>
        </div>
      </div>

      {/* Social Login */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          const backendUrl = getBackendOrigin();
          // Store redirect in sessionStorage for the callback page
          sessionStorage.setItem('oauth_redirect', `/${locale}`);
          // Tell allauth to redirect to our JWT callback endpoint (same as login page)
          const callbackUrl = '/api/v1/auth/google/callback/';
          window.location.href = `${backendUrl}/accounts/google/login/?next=${encodeURIComponent(callbackUrl)}`;
        }}
        leftIcon={
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        }
      >
        Google
      </Button>

      {/* Login link */}
      <p className="mt-2 text-center text-sm text-neutral-400">
        ¿Ya tienes cuenta?{' '}
        <Link
          href={`/${locale}/login`}
          className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
        >
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}
