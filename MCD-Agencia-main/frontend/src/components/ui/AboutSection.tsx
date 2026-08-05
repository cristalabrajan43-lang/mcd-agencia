'use client';

/**
 * AboutSection Component for MCD-Agencia.
 *
 * Displays company information with mission, vision, and values.
 * Features animated content and bilingual support.
 */

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  EyeIcon,
  RocketLaunchIcon,
  HeartIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface SiteConfig {
  about_content: string;
  about_content_en: string;
  mission: string;
  mission_en: string;
  vision: string;
  vision_en: string;
  values: string;
  values_en: string;
}

interface AboutSectionProps {
  config?: SiteConfig;
  locale?: string;
}

const stats = [
  { key: 'years', value: '25+' },
  { key: 'projects', value: '10,000+' },
  { key: 'clients', value: '500+' },
  { key: 'team', value: '50+' },
];

export default function AboutSection({ config, locale = 'es' }: AboutSectionProps) {
  const t = useTranslations('About');

  const getLocalizedContent = (key: keyof SiteConfig, keyEn: keyof SiteConfig) => {
    if (!config) return t(key);
    return locale === 'en' && config[keyEn] ? config[keyEn] : config[key] || t(key);
  };

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden shadow-xl">
              <Image
                src="/images/about/team.jpg"
                alt={t('imageAlt')}
                fill
                className="object-cover"
              />
            </div>
            {/* Decorative Elements */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-cmyk-cyan rounded-xl -z-10" />
            <div className="absolute -top-6 -left-6 w-24 h-24 bg-cmyk-magenta rounded-xl -z-10" />
          </motion.div>

          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('title')}
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              {getLocalizedContent('about_content', 'about_content_en')}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {stats.map((stat) => (
                <div key={stat.key} className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="text-2xl md:text-3xl font-bold text-cyan-600">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600">{t(`stats.${stat.key}`)}</div>
                </div>
              ))}
            </div>

            <Link href="/about" className="btn-secondary">
              {t('learnMore')}
            </Link>
          </motion.div>
        </div>

        {/* Mission, Vision, Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Mission */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="card p-6"
          >
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
              <RocketLaunchIcon className="h-6 w-6 text-cyan-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('mission.title')}
            </h3>
            <p className="text-gray-600">
              {getLocalizedContent('mission', 'mission_en')}
            </p>
          </motion.div>

          {/* Vision */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="card p-6"
          >
            <div className="w-12 h-12 bg-magenta-100 rounded-xl flex items-center justify-center mb-4">
              <EyeIcon className="h-6 w-6 text-magenta-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('vision.title')}
            </h3>
            <p className="text-gray-600">
              {getLocalizedContent('vision', 'vision_en')}
            </p>
          </motion.div>

          {/* Values */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="card p-6"
          >
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mb-4">
              <HeartIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('values.title')}
            </h3>
            <p className="text-gray-600">
              {getLocalizedContent('values', 'values_en')}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
