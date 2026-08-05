'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { verifyTemporaryPassword, completeUserSetup } from '@/lib/api/admin';
import { Card, Button, Input } from '@/components/ui';

export default function CompletarRegistroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [step, setStep] = useState<'verify' | 'setup'>('verify');
  const [loading, setLoading] = useState(false);
  
  const [verifyForm, setVerifyForm] = useState({
    email: email,
    temporary_password: '',
  });

  const [setupForm, setSetupForm] = useState({
    password: '',
    repeatPassword: '',
  });

  const [setupToken, setSetupToken] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await verifyTemporaryPassword({
        email: verifyForm.email,
        temporary_password: verifyForm.temporary_password,
      });

      setSetupToken(result.setup_token);
      setStep('setup');
      toast.success('Contraseña temporal verificada correctamente');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || 'Error al verificar contraseña temporal';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (setupForm.password !== setupForm.repeatPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (setupForm.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      await completeUserSetup({
        email: verifyForm.email,
        setup_token: setupToken,
        password: setupForm.password,
      });

      toast.success('¡Cuenta activada exitosamente! Redirigiendo al login...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      const errorData = error?.response?.data;
      if (errorData?.details) {
        toast.error(  
          errorData.details.join('. ') || errorData.error || 'Error al completar la configuración'
        );
      } else {
        toast.error(errorData?.error || 'Error al completar la configuración');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            {step === 'verify' ? 'Verificar Email' : 'Crear Contraseña'}
          </h1>
          <p className="text-neutral-400">
            {step === 'verify'
              ? 'Verifica tu identidad usando la contraseña temporal enviada a tu email'
              : 'Establece tu contraseña personal para acceder al sistema'}
          </p>
        </div>

        {step === 'verify' ? (
          // Step 1: Verify Temporary Password
          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <Input
              label="Correo Electrónico"
              type="email"
              value={verifyForm.email}
              onChange={(e) => setVerifyForm({ ...verifyForm, email: e.target.value })}
              disabled
              required
            />

            <Input
              label="Contraseña Temporal"
              type="password"
              placeholder="Ingresa la contraseña del email"
              value={verifyForm.temporary_password}
              onChange={(e) =>
                setVerifyForm({ ...verifyForm, temporary_password: e.target.value })
              }
              required
            />

            <Button type="submit" disabled={loading} className="w-full mt-6">
              {loading ? 'Verificando...' : 'Verificar'}
            </Button>
          </form>
        ) : (
          // Step 2: Set New Password
          <form onSubmit={handleCompleteSetup} className="space-y-4">
            <Input
              label="Nueva Contraseña"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={setupForm.password}
              onChange={(e) => {
                setSetupForm({ ...setupForm, password: e.target.value });
                // Simple strength calculation
                const pwd = e.target.value;
                let strength = 0;
                if (pwd.length >= 8) strength++;
                if (pwd.length >= 12) strength++;
                if (/[A-Z]/.test(pwd)) strength++;
                if (/[0-9]/.test(pwd)) strength++;
                if (/[^A-Za-z0-9]/.test(pwd)) strength++;
                setPasswordStrength(Math.min(strength, 4));
              }}
              required
            />

            {setupForm.password && (
              <div className="flex gap-1 mt-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded ${
                      i < passwordStrength
                        ? passwordStrength === 1
                          ? 'bg-red-500'
                          : passwordStrength === 2
                          ? 'bg-yellow-500'
                          : passwordStrength === 3
                          ? 'bg-cyan-500'
                          : 'bg-green-500'
                        : 'bg-neutral-700'
                    }`}
                  />
                ))}
              </div>
            )}

            <Input
              label="Repetir Contraseña"
              type="password"
              placeholder="Confirma tu contraseña"
              value={setupForm.repeatPassword}
              onChange={(e) => setSetupForm({ ...setupForm, repeatPassword: e.target.value })}
              required
            />

            <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 text-sm text-blue-400">
              <p>
                <strong>Requisitos de contraseña:</strong>
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>✓ Mínimo 8 caracteres</li>
                <li>✓ Debe incluir letras mayúsculas</li>
                <li>✓ Debe incluir números</li>
                <li>✓ Se recomienda incluir caracteres especiales</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('verify')}
                disabled={loading}
                className="flex-1"
              >
                Atrás
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Procesando...' : 'Completar Registro'}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-neutral-800">
          <p className="text-center text-sm text-neutral-400">
            ¿Ya tienes cuenta?{' '}
            <a href="/login" className="text-cyan-400 hover:text-cyan-300">
              Inicia sesión aquí
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}

