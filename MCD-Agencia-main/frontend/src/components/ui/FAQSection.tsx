'use client';

/**
 * FAQSection Component for MCD-Agencia.
 *
 * Accordion-style FAQ section with category filtering.
 * Supports bilingual content.
 */

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface FAQ {
  id: string;
  question: string;
  question_en: string;
  answer: string;
  answer_en: string;
  category: string;
  category_display: string;
}

interface FAQSectionProps {
  faqs: FAQ[];
}

export default function FAQSection({ faqs }: FAQSectionProps) {
  const t = useTranslations('FAQ');
  const locale = useLocale();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!faqs || faqs.length === 0) {
    return null;
  }

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(faqs.map((faq) => faq.category)))];

  // Filter FAQs by category
  const filteredFaqs = selectedCategory === 'all'
    ? faqs
    : faqs.filter((faq) => faq.category === selectedCategory);

  const toggleFaq = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
          <p className="text-lg text-gray-600">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Category Filters */}
        {categories.length > 2 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-cmyk-cyan text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {category === 'all' ? t('allCategories') : t(`categories.${category}`)}
              </button>
            ))}
          </div>
        )}

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {filteredFaqs.map((faq) => {
            const question = locale === 'en' && faq.question_en
              ? faq.question_en
              : faq.question;
            const answer = locale === 'en' && faq.answer_en
              ? faq.answer_en
              : faq.answer;
            const isOpen = openId === faq.id;

            return (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-gray-900">{question}</span>
                  <ChevronDownIcon
                    className={`h-5 w-5 text-gray-500 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-6 pb-4 text-gray-600">
                        {answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12 p-6 bg-white rounded-xl shadow-sm"
        >
          <p className="text-gray-600 mb-4">{t('needMoreHelp')}</p>
          <a href="/contact" className="btn-primary">
            {t('contactUs')}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
