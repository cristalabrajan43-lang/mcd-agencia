'use client';

import { ExclamationTriangleIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Modal, Button } from '@/components/ui';

interface LineItem {
  concept: string;
  quantity: number | string;
  unit: string;
  unit_price: number | string;
  line_total?: number | string;
}

interface SendConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  customerName: string;
  customerEmail: string;
  lines: LineItem[];
  subtotal: number | string;
  taxAmount: number | string;
  shippingTotal?: number | string;
  total: number | string;
}

const fmt = (amount: number | string) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
    Number(amount) || 0
  );

export function SendConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  customerName,
  customerEmail,
  lines,
  subtotal,
  taxAmount,
  shippingTotal,
  total,
}: SendConfirmationModalProps) {
  const hasZeroPrice = lines.some((l) => Number(l.unit_price) <= 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar envío de cotización" size="lg">
      {/* Warning for $0 prices */}
      {hasZeroPrice && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-yellow-400 mt-0.5" />
          <p className="text-sm text-yellow-300">
            Hay conceptos con precio <strong>$0.00</strong>. ¿Estás seguro de que es correcto?
          </p>
        </div>
      )}

      {/* Customer */}
      <div className="mb-4">
        <p className="text-sm text-neutral-400">Se enviará a:</p>
        <p className="text-white font-medium">{customerName}</p>
        <p className="text-neutral-400 text-sm">{customerEmail}</p>
      </div>

      {/* Lines table */}
      <div className="mb-4 max-h-60 overflow-y-auto rounded-lg border border-neutral-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-800">
            <tr className="text-left text-neutral-500 border-b border-neutral-700">
              <th className="px-3 py-2">Concepto</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Cant.</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">P. Unit.</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {lines.map((line, i) => {
              const qty = Number(line.quantity) || 0;
              const price = Number(line.unit_price) || 0;
              const lineTotal = line.line_total ? Number(line.line_total) : qty * price;
              const isZero = price <= 0;

              return (
                <tr key={i} className={isZero ? 'bg-yellow-500/5' : ''}>
                  <td className="px-3 py-2 text-white">
                    {line.concept}
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-300">
                    {qty} {line.unit}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${isZero ? 'text-yellow-400' : 'text-white'}`}>
                    {fmt(price)}
                  </td>
                  <td className="px-3 py-2 text-right text-white">{fmt(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mb-6 space-y-1 text-sm">
        <div className="flex justify-between text-neutral-400">
          <span>Subtotal</span>
          <span>{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between text-neutral-400">
          <span>IVA (16%)</span>
          <span>{fmt(taxAmount)}</span>
        </div>
        {Number(shippingTotal || 0) > 0 && (
          <div className="flex justify-between text-neutral-400">
            <span>Envío</span>
            <span>{fmt(shippingTotal!)}</span>
          </div>
        )}
        <div className="flex justify-between text-white font-semibold text-base pt-2 border-t border-neutral-700">
          <span>Total</span>
          <span className="text-cmyk-cyan">{fmt(total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          Revisar
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          isLoading={isLoading}
          leftIcon={<PaperAirplaneIcon className="h-4 w-4" />}
        >
          Confirmar y Enviar
        </Button>
      </div>
    </Modal>
  );
}
