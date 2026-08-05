'use client';

/**
 * FeaturedProducts Component for MCD-Agencia.
 *
 * Displays featured products/services in a grid.
 * Includes add to cart and view details functionality.
 */

import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShoppingCartIcon, EyeIcon } from '@heroicons/react/24/outline';

interface ProductVariant {
  id: string;
  price: string;
  compare_at_price?: string;
}

interface ProductImage {
  id: string;
  image: string;
  alt_text?: string;
}

interface Product {
  id: string;
  name: string;
  name_en: string;
  slug: string;
  short_description: string;
  short_description_en: string;
  sale_mode: 'BUY' | 'QUOTE' | 'HYBRID';
  base_price: string;
  compare_at_price?: string;
  has_discount: boolean;
  discount_percentage?: number;
  primary_image?: ProductImage;
  price_range?: {
    min: string;
    max: string;
    has_range: boolean;
  };
}

interface FeaturedProductsProps {
  products: Product[];
  onAddToCart?: (productId: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export default function FeaturedProducts({
  products,
  onAddToCart,
}: FeaturedProductsProps) {
  const t = useTranslations('Products');
  const locale = useLocale();

  if (!products || products.length === 0) {
    return null;
  }

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-MX' : 'es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(parseFloat(price));
  };

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {t('featured.title')}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('featured.subtitle')}
          </p>
        </motion.div>

        {/* Products Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {products.map((product) => {
            const name = locale === 'en' && product.name_en ? product.name_en : product.name;
            const description =
              locale === 'en' && product.short_description_en
                ? product.short_description_en
                : product.short_description;

            return (
              <motion.div
                key={product.id}
                variants={itemVariants}
                className="group"
              >
                <div className="card overflow-hidden h-full flex flex-col">
                  {/* Image */}
                  <Link href={`/catalog/${product.slug}`} className="relative">
                    <div className="aspect-square relative overflow-hidden bg-gray-100">
                      {product.primary_image ? (
                        <Image
                          src={product.primary_image.image}
                          alt={product.primary_image.alt_text || name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <PhotoIcon className="h-16 w-16" />
                        </div>
                      )}

                      {/* Discount Badge */}
                      {product.has_discount && product.discount_percentage && (
                        <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-sm font-semibold">
                          -{product.discount_percentage}%
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            onAddToCart?.(product.id);
                          }}
                          className="p-2 bg-white rounded-full hover:bg-cmyk-cyan hover:text-white transition-colors"
                          aria-label={t('addToCart')}
                          disabled={product.sale_mode === 'QUOTE'}
                        >
                          <ShoppingCartIcon className="h-5 w-5" />
                        </button>
                        <Link
                          href={`/catalog/${product.slug}`}
                          className="p-2 bg-white rounded-full hover:bg-cmyk-cyan hover:text-white transition-colors"
                          aria-label={t('viewDetails')}
                        >
                          <EyeIcon className="h-5 w-5" />
                        </Link>
                      </div>
                    </div>
                  </Link>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <Link href={`/catalog/${product.slug}`}>
                      <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-cyan-600 transition-colors line-clamp-2">
                        {name}
                      </h3>
                    </Link>

                    <p className="text-sm text-gray-500 mb-3 line-clamp-2 flex-1">
                      {description}
                    </p>

                    {/* Price */}
                    <div className="mt-auto">
                      {product.sale_mode === 'QUOTE' ? (
                        <span className="text-cyan-600 font-medium">
                          {t('requestQuote')}
                        </span>
                      ) : product.price_range?.has_range ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-gray-900">
                            {formatPrice(product.price_range.min)}
                          </span>
                          <span className="text-gray-500">-</span>
                          <span className="text-lg font-bold text-gray-900">
                            {formatPrice(product.price_range.max)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-gray-900">
                            {formatPrice(product.base_price)}
                          </span>
                          {product.compare_at_price && (
                            <span className="text-sm text-gray-400 line-through">
                              {formatPrice(product.compare_at_price)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* View All CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link href="/catalog" className="btn-primary">
            {t('viewAll')}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// Placeholder icon for missing images
function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}
