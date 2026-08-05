'use client';

import { Fragment, useState } from 'react';
import { Dialog, Disclosure, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  FunnelIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

import { Category, Attribute } from '@/lib/api/catalog';
import { Button, Input } from '@/components/ui';
import { cn, formatPrice } from '@/lib/utils';

type SaleMode = 'BUY' | 'QUOTE' | 'HYBRID';

const SALE_MODE_OPTIONS: { value: SaleMode | ''; label: string }[] = [
  { value: '', label: 'Todos los modos' },
  { value: 'BUY', label: 'Compra' },
  { value: 'QUOTE', label: 'Cotización' },
];

interface ProductFiltersProps {
  categories: Category[];
  attributes: Attribute[];
  selectedCategory?: string;
  selectedSaleMode?: SaleMode;
  selectedAttributes: Record<string, string[]>;
  priceRange: { min?: number; max?: number };
  searchQuery: string;
  onCategoryChange: (categorySlug?: string) => void;
  onSaleModeChange: (saleMode?: SaleMode) => void;
  onAttributeChange: (attributeSlug: string, values: string[]) => void;
  onPriceRangeChange: (range: { min?: number; max?: number }) => void;
  onSearchChange: (query: string) => void;
  onClearFilters: () => void;
}

export function ProductFilters({
  categories,
  attributes,
  selectedCategory,
  selectedSaleMode,
  selectedAttributes,
  priceRange,
  searchQuery,
  onCategoryChange,
  onSaleModeChange,
  onAttributeChange,
  onPriceRangeChange,
  onSearchChange,
  onClearFilters,
}: ProductFiltersProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const hasActiveFilters =
    selectedCategory ||
    selectedSaleMode ||
    Object.keys(selectedAttributes).length > 0 ||
    priceRange.min ||
    priceRange.max ||
    searchQuery;

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <Input
          placeholder="Buscar productos..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
        />
      </div>

      {/* Categories */}
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex w-full items-center justify-between py-3 text-left border-b border-neutral-800">
              <span className="text-sm font-medium text-white">Categorías</span>
              <ChevronDownIcon
                className={cn('h-5 w-5 text-neutral-400', open && 'rotate-180')}
              />
            </Disclosure.Button>
            <Disclosure.Panel className="pt-4 pb-2">
              <div className="space-y-2">
                <button
                  onClick={() => onCategoryChange(undefined)}
                  className={cn(
                    'block w-full text-left px-3 py-2 text-sm rounded-lg transition-colors',
                      !selectedCategory
                        ? 'bg-cmyk-cyan/20 text-cmyk-cyan'
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                  )}
                >
                  Todas las categorías
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => onCategoryChange(category.slug)}
                    className={cn(
                      'block w-full text-left px-3 py-2 text-sm rounded-lg transition-colors',
                      selectedCategory === category.slug
                        ? 'bg-cmyk-cyan/20 text-cmyk-cyan'
                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                    )}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>

      {/* Sale Mode */}
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex w-full items-center justify-between py-3 text-left border-b border-neutral-800">
              <span className="text-sm font-medium text-white">Modo de venta</span>
              <ChevronDownIcon
                className={cn('h-5 w-5 text-neutral-400', open && 'rotate-180')}
              />
            </Disclosure.Button>
            <Disclosure.Panel className="pt-4 pb-2">
              <div className="space-y-2">
                {SALE_MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value || 'all'}
                    onClick={() => onSaleModeChange(option.value || undefined)}
                    className={cn(
                      'block w-full text-left px-3 py-2 text-sm rounded-lg transition-colors',
                      (option.value === '' && !selectedSaleMode) || selectedSaleMode === option.value
                        ? 'bg-cmyk-yellow/20 text-cmyk-yellow'
                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>

      {/* Price Range */}
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex w-full items-center justify-between py-3 text-left border-b border-neutral-800">
              <span className="text-sm font-medium text-white">Precio</span>
              <ChevronDownIcon
                className={cn('h-5 w-5 text-neutral-400', open && 'rotate-180')}
              />
            </Disclosure.Button>
            <Disclosure.Panel className="pt-4 pb-2">
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="Mín"
                  value={priceRange.min || ''}
                  onChange={(e) =>
                    onPriceRangeChange({
                      ...priceRange,
                      min: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="text-sm"
                />
                <span className="text-neutral-500">-</span>
                <Input
                  type="number"
                  placeholder="Máx"
                  value={priceRange.max || ''}
                  onChange={(e) =>
                    onPriceRangeChange({
                      ...priceRange,
                      max: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="text-sm"
                />
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>

      {/* Dynamic Attributes */}
      {attributes
        .filter((attr) => attr.is_filterable)
        .map((attribute) => (
          <Disclosure key={attribute.id}>
            {({ open }) => (
              <>
                <Disclosure.Button className="flex w-full items-center justify-between py-3 text-left border-b border-neutral-800">
                  <span className="text-sm font-medium text-white">{attribute.name}</span>
                  <ChevronDownIcon
                    className={cn('h-5 w-5 text-neutral-400', open && 'rotate-180')}
                  />
                </Disclosure.Button>
                <Disclosure.Panel className="pt-4 pb-2">
                  <div className="space-y-2">
                    {attribute.values.map((value) => {
                      const isSelected =
                        selectedAttributes[attribute.slug]?.includes(value.slug) || false;
                      return (
                        <label
                          key={value.id}
                          className="flex items-center cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const current = selectedAttributes[attribute.slug] || [];
                              const updated = isSelected
                                ? current.filter((v) => v !== value.slug)
                                : [...current, value.slug];
                              onAttributeChange(attribute.slug, updated);
                            }}
                            className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-cmyk-yellow focus:ring-cmyk-yellow focus:ring-offset-neutral-950"
                          />
                          <span className="ml-3 text-sm text-neutral-400 group-hover:text-white">
                            {value.color_code && (
                              <span
                                className="inline-block w-4 h-4 rounded-full mr-2 border border-neutral-700"
                                style={{ backgroundColor: value.color_code }}
                              />
                            )}
                            {value.value}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>
        ))}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" className="w-full" onClick={onClearFilters}>
          Limpiar filtros
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile filter dialog */}
      <Transition.Root show={mobileFiltersOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setMobileFiltersOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80" />
          </Transition.Child>

          <div className="fixed inset-0 z-40 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <Dialog.Panel className="relative ml-auto flex h-full w-full max-w-xs flex-col overflow-y-auto bg-neutral-950 py-4 pb-12 shadow-xl">
                <div className="flex items-center justify-between px-4 mb-4">
                  <h2 className="text-lg font-medium text-white">Filtros</h2>
                  <button
                    type="button"
                    className="text-neutral-400 hover:text-white"
                    onClick={() => setMobileFiltersOpen(false)}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="px-4">
                  <FilterContent />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Mobile filter button */}
      <div className="lg:hidden mb-4">
        <Button
          variant="outline"
          onClick={() => setMobileFiltersOpen(true)}
          leftIcon={<FunnelIcon className="h-5 w-5" />}
        >
          Filtros
          {hasActiveFilters && (
            <span className="ml-2 bg-cmyk-yellow text-neutral-900 text-xs px-2 py-0.5 rounded-full font-medium">
              Activos
            </span>
          )}
        </Button>
      </div>

      {/* Desktop filters */}
      <div className="hidden lg:block">
        <FilterContent />
      </div>
    </>
  );
}
