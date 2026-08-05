'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { capturePayPalPayment } from '@/lib/api/payments';
import { Button, Card, LoadingPage } from '@/components/ui';

type PaymentStatus = 'loading' | 'approved' | 'cancelled' | 'error';

interface StatusConfig {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  title: string;
  description: string;
}

const STATUS_CONFIG: Record<Exclude<PaymentStatus, 'loading'>, StatusConfig> = {
  approved: {
    icon: CheckCircleIcon,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-500/20',
    title: '¡Pago exitoso!',
    description: 'Tu pago con PayPal ha sido procesado correctamente.',
  },
  cancelled: {
    icon: XCircleIcon,
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
    title: 'Pago cancelado',
    description: 'Has cancelado el proceso de pago. Tu orden sigue pendiente.',
  },
  error: {
    icon: ExclamationTriangleIcon,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-500/20',
    title: 'Error en el pago',
    description: 'Ocurrió un error al procesar tu pago. Por favor, intenta de nuevo.',
  },
};

export default function PayPalCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const token = searchParams.get('token'); // PayPal order ID
      const payerId = searchParams.get('PayerID');
      const cancelled = searchParams.get('cancelled');

      // Check if payment was cancelled
      if (cancelled === 'true' || !token) {
        setStatus('cancelled');
        return;
      }

      // If we have token and PayerID, capture the payment
      if (token && payerId) {
        try {
          const result = await capturePayPalPayment(token);
          setOrderId(result.order_id);

          if (result.status === 'completed' || result.status === 'processing') {
            setStatus('approved');
          } else {
            setStatus('error');
            setErrorMessage('El pago no pudo ser completado.');
          }
        } catch (error: unknown) {
          const err = error as { message?: string };
          setStatus('error');
          setErrorMessage(err.message || 'Error al capturar el pago');
        }
      } else {
        setStatus('error');
      }
    };

    processCallback();
  }, [searchParams]);

  if (status === 'loading') {
    return <LoadingPage message="Procesando tu pago con PayPal..." />;
  }

  const config = STATUS_CONFIG[status];
  const IconComponent = config.icon;

  return (
    <div className="min-h-screen py-16 flex items-center justify-center">
      <div className="container mx-auto px-4 max-w-lg">
        <Card className="text-center py-12">
          <div
            className={`mx-auto w-20 h-20 ${config.bgColor} rounded-full flex items-center justify-center mb-6`}
          >
            <IconComponent className={`h-10 w-10 ${config.iconColor}`} />
          </div>

          <h1 className="text-2xl font-bold text-white mb-4">{config.title}</h1>
          <p className="text-neutral-400 mb-4">{config.description}</p>

          {errorMessage && (
            <p className="text-sm text-red-400 mb-4">{errorMessage}</p>
          )}

          {orderId && (
            <p className="text-sm text-neutral-500 mb-6">
              Número de orden: <span className="text-cyan-400 font-mono">{orderId}</span>
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {orderId && status === 'approved' && (
              <Link href={`/mi-cuenta/pedidos/${orderId}`}>
                <Button>Ver mi pedido</Button>
              </Link>
            )}

            {(status === 'cancelled' || status === 'error') && (
              <Link href="/checkout">
                <Button>Reintentar pago</Button>
              </Link>
            )}

            <Link href="/mi-cuenta/pedidos">
              <Button variant={status === 'approved' ? 'outline' : 'ghost'}>
                Mis pedidos
              </Button>
            </Link>

            <Link href="/catalogo">
              <Button variant="ghost">Seguir comprando</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
