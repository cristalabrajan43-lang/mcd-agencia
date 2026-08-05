'use client';

import { forwardRef, Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      label,
      value,
      onChange,
      options,
      placeholder = 'Seleccionar...',
      error,
      disabled,
      required,
      className,
    },
    ref
  ) => {
    const selectedOption = options.find((opt) => opt.value === value);

    return (
      <div className={cn('w-full', className)}>
        {label && (
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <Listbox value={value} onChange={onChange} disabled={disabled}>
          <div className="relative">
            <Listbox.Button
              ref={ref}
              className={cn(
                'relative w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5',
                'text-left text-white cursor-pointer',
                'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-200',
                error && 'border-red-500 focus:ring-red-500'
              )}
            >
              <span className={cn('block truncate', !selectedOption && 'text-neutral-500')}>
                {selectedOption?.label || placeholder}
              </span>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronUpDownIcon className="h-5 w-5 text-neutral-400" aria-hidden="true" />
              </span>
            </Listbox.Button>

            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg bg-neutral-900 border border-neutral-700 py-1 shadow-lg focus:outline-none">
                {options.map((option) => (
                  <Listbox.Option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={({ active, selected }) =>
                      cn(
                        'relative cursor-pointer select-none py-2.5 pl-10 pr-4',
                        active && 'bg-neutral-800',
                        selected && 'text-cyan-400',
                        option.disabled && 'opacity-50 cursor-not-allowed'
                      )
                    }
                  >
                    {({ selected }) => (
                      <>
                        <span
                          className={cn(
                            'block truncate',
                            selected ? 'font-medium' : 'font-normal'
                          )}
                        >
                          {option.label}
                        </span>
                        {selected && (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-cyan-400">
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
