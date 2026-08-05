'use client';

/**
 * CTASection Component for MCD-Agencia.
 *
 * Call-to-action section with gradient background.
 * Used to encourage user action (quote request, contact, etc.).
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface CTASectionProps {
  titleKey?: string;
  subtitleKey?: string;
  primaryButtonKey?: string;
  primaryButtonHref?: string;
  secondaryButtonKey?: string;
  secondaryButtonHref?: string;
}

export default function CTASection({
  titleKey = 'default.title',
  subtitleKey = 'default.subtitle',
  primaryButtonKey = 'default.primaryButton',
  primaryButtonHref = '/quote',
  secondaryButtonKey,
  secondaryButtonHref,
}: CTASectionProps) {
  const t = useTranslations('CTA');

  return (
    <section className="py-16 md:py-24 bg-gradient-to-r from-cyan-600 via-cyan-500 to-magenta-500 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-yellow-400/20 rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t(titleKey)}
          </h2>
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            {t(subtitleKey)}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={primaryButtonHref}
              className="btn bg-white text-cyan-600 hover:bg-gray-100 px-8 py-3 text-lg font-semibold"
            >
              {t(primaryButtonKey)}
            </Link>

            {secondaryButtonKey && secondaryButtonHref && (
              <Link
                href={secondaryButtonHref}
                className="btn bg-transparent border-2 border-white text-white hover:bg-white/10 px-8 py-3 text-lg font-semibold"
              >
                {t(secondaryButtonKey)}
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
