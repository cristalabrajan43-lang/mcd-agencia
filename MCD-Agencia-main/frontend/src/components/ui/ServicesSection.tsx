'use client';

/**
 * ServicesSection Component for MCD-Agencia.
 *
 * Displays the main services offered by the agency.
 * Features animated cards with icons and bilingual support.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  PrinterIcon,
  MegaphoneIcon,
  PhotoIcon,
  SparklesIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

interface Service {
  id: string;
  icon: React.ElementType;
  titleKey: string;
  descriptionKey: string;
  href: string;
  color: string;
}

const services: Service[] = [
  {
    id: 'printing',
    icon: PrinterIcon,
    titleKey: 'printing.title',
    descriptionKey: 'printing.description',
    href: '/catalog?category=impresion',
    color: 'bg-cmyk-cyan',
  },
  {
    id: 'outdoor',
    icon: MegaphoneIcon,
    titleKey: 'outdoor.title',
    descriptionKey: 'outdoor.description',
    href: '/catalog?category=publicidad-exterior',
    color: 'bg-cmyk-magenta',
  },
  {
    id: 'signage',
    icon: PhotoIcon,
    titleKey: 'signage.title',
    descriptionKey: 'signage.description',
    href: '/catalog?category=senaletica',
    color: 'bg-cmyk-yellow',
  },
  {
    id: 'promotional',
    icon: SparklesIcon,
    titleKey: 'promotional.title',
    descriptionKey: 'promotional.description',
    href: '/catalog?category=articulos-promocionales',
    color: 'bg-cmyk-cyan',
  },
  {
    id: 'delivery',
    icon: TruckIcon,
    titleKey: 'delivery.title',
    descriptionKey: 'delivery.description',
    href: '/services/delivery',
    color: 'bg-cmyk-magenta',
  },
  {
    id: 'installation',
    icon: WrenchScrewdriverIcon,
    titleKey: 'installation.title',
    descriptionKey: 'installation.description',
    href: '/services/installation',
    color: 'bg-cmyk-yellow',
  },
];

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

export default function ServicesSection() {
  const t = useTranslations('Services');

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
          >
            {t('title')}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            {t('subtitle')}
          </motion.p>
        </div>

        {/* Services Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={service.id}
                variants={itemVariants}
                className="group"
              >
                <Link href={service.href}>
                  <div className="card h-full p-6 hover:shadow-lg transition-shadow group-hover:border-cmyk-cyan">
                    <div
                      className={`w-14 h-14 ${service.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-cyan-600 transition-colors">
                      {t(service.titleKey)}
                    </h3>
                    <p className="text-gray-600">
                      {t(service.descriptionKey)}
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
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
