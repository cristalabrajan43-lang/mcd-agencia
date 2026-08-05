'use client';

/**
 * ContactSection Component for MCD-Agencia.
 *
 * Contact form with branch information and map.
 * Includes form validation and submission handling.
 */

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useLegalModal } from '@/contexts/LegalModalContext';
import { motion } from 'framer-motion';
import {
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface Branch {
  id: string;
  name: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  email: string;
  hours: string;
  hours_en: string;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  full_address: string;
}

interface SiteConfig {
  contact_email: string;
  contact_phone: string;
  whatsapp_number?: string;
}

interface ContactSectionProps {
  branches: Branch[];
  config?: SiteConfig;
}

export default function ContactSection({ branches, config }: ContactSectionProps) {
  const t = useTranslations('Contact');
  const locale = useLocale();
  const { openPrivacy } = useLegalModal();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
    privacy_accepted: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await fetch('/api/v1/content/contact/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitResult('success');
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          message: '',
          privacy_accepted: false,
        });
      } else {
        setSubmitResult('error');
      }
    } catch {
      setSubmitResult('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const mainBranch = branches[0];

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
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="card p-6 md:p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                {t('form.title')}
              </h3>

              {submitResult === 'success' && (
                <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg">
                  {t('form.successMessage')}
                </div>
              )}

              {submitResult === 'error' && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
                  {t('form.errorMessage')}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('form.name')} *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('form.email')} *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('form.phone')}
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('form.company')}
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.message')} *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    required
                    className="input"
                  />
                </div>

                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="privacy_accepted"
                    name="privacy_accepted"
                    checked={formData.privacy_accepted}
                    onChange={handleChange}
                    required
                    className="mt-1"
                  />
                  <label htmlFor="privacy_accepted" className="text-sm text-gray-600">
                    {t('form.privacyConsent')}{' '}
                    <button type="button" onClick={openPrivacy} className="text-cyan-600 hover:underline">
                      {t('form.privacyLink')}
                    </button>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? t('form.sending') : t('form.submit')}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Contact Info & Map */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            {/* Contact Info Cards */}
            {mainBranch && (
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {mainBranch.name}
                </h3>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPinIcon className="h-6 w-6 text-cmyk-cyan flex-shrink-0" />
                    <div>
                      <p className="text-gray-700">{mainBranch.full_address}</p>
                      {mainBranch.google_maps_url && (
                        <a
                          href={mainBranch.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-cyan-600 hover:underline"
                        >
                          {t('viewOnMap')}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <PhoneIcon className="h-6 w-6 text-cmyk-cyan" />
                    <a
                      href={`tel:${mainBranch.phone}`}
                      className="text-gray-700 hover:text-cyan-600"
                    >
                      {mainBranch.phone}
                    </a>
                  </div>

                  <div className="flex items-center gap-3">
                    <EnvelopeIcon className="h-6 w-6 text-cmyk-cyan" />
                    <a
                      href={`mailto:${mainBranch.email}`}
                      className="text-gray-700 hover:text-cyan-600"
                    >
                      {mainBranch.email}
                    </a>
                  </div>

                  <div className="flex items-start gap-3">
                    <ClockIcon className="h-6 w-6 text-cmyk-cyan flex-shrink-0" />
                    <p className="text-gray-700 whitespace-pre-line">
                      {locale === 'en' && mainBranch.hours_en
                        ? mainBranch.hours_en
                        : mainBranch.hours}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Map */}
            {mainBranch?.latitude && mainBranch?.longitude && (
              <div className="card overflow-hidden h-[300px]">
                <iframe
                  src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&q=${mainBranch.latitude},${mainBranch.longitude}&zoom=15`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={mainBranch.name}
                />
              </div>
            )}

            {/* WhatsApp Button */}
            {config?.whatsapp_number && (
              <a
                href={`https://wa.me/${config.whatsapp_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {t('whatsappButton')}
              </a>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
