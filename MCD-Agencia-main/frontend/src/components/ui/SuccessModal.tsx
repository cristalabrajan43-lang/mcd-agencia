'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type ModalVariant = 'success' | 'error' | 'warning' | 'info';

export interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Main heading */
  title: string;
  /** Optional body text */
  message?: string;
  /** Visual variant – determines icon and accent colour */
  variant?: ModalVariant;
  /** Label for the primary button (default "Ok") */
  buttonLabel?: string;
  /** Optional callback when button is clicked (defaults to onClose) */
  onConfirm?: () => void;
}

// ─── Config per variant ──────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  ModalVariant,
  { icon: React.ElementType; iconColor: string; ringColor: string }
> = {
  success: {
    icon: CheckCircleIcon,
    iconColor: 'text-cmyk-cyan',
    ringColor: 'ring-cmyk-cyan/30',
  },
  error: {
    icon: ExclamationTriangleIcon,
    iconColor: 'text-cmyk-magenta',
    ringColor: 'ring-cmyk-magenta/30',
  },
  warning: {
    icon: ExclamationTriangleIcon,
    iconColor: 'text-cmyk-yellow',
    ringColor: 'ring-cmyk-yellow/30',
  },
  info: {
    icon: InformationCircleIcon,
    iconColor: 'text-blue-400',
    ringColor: 'ring-blue-400/30',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function SuccessModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'success',
  buttonLabel = 'Ok',
  onConfirm,
}: SuccessModalProps) {
  const { icon: Icon, iconColor, ringColor } = VARIANT_CONFIG[variant];

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        {/* Panel */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-90"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-90"
            >
              <Dialog.Panel className="w-full max-w-sm transform rounded-2xl bg-neutral-900 border border-neutral-800 p-6 text-center shadow-xl transition-all">
                {/* Close button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-neutral-800"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>

                {/* Icon */}
                <div
                  className={cn(
                    'mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-4',
                    ringColor,
                    'bg-neutral-800'
                  )}
                >
                  <Icon className={cn('h-8 w-8', iconColor)} />
                </div>

                {/* Title */}
                <Dialog.Title
                  as="h3"
                  className="mt-4 text-lg font-semibold text-white"
                >
                  {title}
                </Dialog.Title>

                {/* Message */}
                {message && (
                  <p className="mt-2 text-sm text-neutral-400">{message}</p>
                )}

                {/* Button */}
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={cn(
                    'mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
                    variant === 'success' && 'bg-cmyk-cyan text-black hover:bg-cmyk-cyan/80',
                    variant === 'error' && 'bg-cmyk-magenta text-white hover:bg-cmyk-magenta/80',
                    variant === 'warning' && 'bg-cmyk-yellow text-black hover:bg-cmyk-yellow/80',
                    variant === 'info' && 'bg-blue-500 text-white hover:bg-blue-500/80'
                  )}
                >
                  {buttonLabel}
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
