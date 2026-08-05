'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { XCircleIcon } from '@heroicons/react/24/outline';

import { Button, Card } from '@/components/ui';

export default function PayPalCancelPage() {
  return (
    <div className="min-h-screen py-16 flex items-center justify-center">
      <div className="container mx-auto px-4 max-w-lg">
        <Card className="text-center py-12">
          <div className="mx-auto w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mb-6">
            <XCircleIcon className="h-10 w-10 text-yellow-500" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-4">Pago cancelado</h1>
          <p className="text-neutral-400 mb-8">
            Has cancelado el proceso de pago con PayPal. Tu orden sigue pendiente
            y puedes intentar pagar nuevamente cuando lo desees.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/checkout">
              <Button>Volver al checkout</Button>
            </Link>

            <Link href="/mi-cuenta/pedidos">
              <Button variant="outline">Mis pedidos</Button>
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
