'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { Button, Card, LoadingPage } from '@/components/ui';

type PaymentStatus = 'loading' | 'approved' | 'pending' | 'rejected' | 'error';

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
    description: 'Tu pago ha sido procesado correctamente. Recibirás un email de confirmación.',
  },
  pending: {
    icon: ClockIcon,
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
    title: 'Pago pendiente',
    description: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
  },
  rejected: {
    icon: XCircleIcon,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-500/20',
    title: 'Pago rechazado',
    description: 'El pago no pudo ser procesado. Por favor, intenta con otro método de pago.',
  },
  error: {
    icon: ExclamationTriangleIcon,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-500/20',
    title: 'Error en el pago',
    description: 'Ocurrió un error al procesar tu pago. Por favor, contacta a soporte.',
  },
};

export default function MercadoPagoCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const collectionStatus = searchParams.get('collection_status') || searchParams.get('status');
      const externalReference = searchParams.get('external_reference');
      const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');

      if (!collectionStatus) {
        setStatus('error');
        return;
      }

      // Set order ID from external reference (our order ID)
      if (externalReference) {
        setOrderId(externalReference);
      }

      // Map Mercado Pago status to our status
      switch (collectionStatus) {
        case 'approved':
          setStatus('approved');
          break;
        case 'pending':
        case 'in_process':
          setStatus('pending');
          break;
        case 'rejected':
        case 'cancelled':
          setStatus('rejected');
          break;
        default:
          setStatus('error');
      }

      // Optionally notify backend about the payment (backend should also receive webhook)
      // This is a fallback in case webhook fails
      try {
        await fetch('/api/payments/mercadopago/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collection_status: collectionStatus,
            external_reference: externalReference,
            payment_id: paymentId,
          }),
        });
      } catch {
        // Silent fail - backend webhook should handle this
      }
    };

    processCallback();
  }, [searchParams]);

  if (status === 'loading') {
    return <LoadingPage message="Procesando tu pago..." />;
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
          <p className="text-neutral-400 mb-8">{config.description}</p>

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

            {status === 'rejected' && (
              <Button onClick={() => router.back()} variant="primary">
                Intentar de nuevo
              </Button>
            )}

            <Link href="/mi-cuenta/pedidos">
              <Button variant={status === 'approved' ? 'outline' : 'primary'}>
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
