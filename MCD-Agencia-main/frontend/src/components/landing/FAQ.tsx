'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FAQ_KEYS, type FAQKey } from '@/lib/service-ids';

export function FAQ() {
  const t = useTranslations('landing.faq');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="section py-10 sm:py-14 md:py-18 lg:py-24">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-10 md:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl mb-4 font-bold text-white">{t('title')}</h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-300">
            {t('subtitle')}
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
          {FAQ_KEYS.map((key, index) => (
            <div
              key={key}
              className="bg-cmyk-black rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-cmyk-cyan/20"
            >
              <button
                onClick={() => toggleItem(index)}
                className="w-full px-4 sm:px-6 py-4 sm:py-5 text-left flex items-center justify-between hover:bg-cmyk-black/50 transition-colors"
                aria-expanded={openIndex === index}
              >
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-100 pr-4 sm:pr-8">
                  {t(`items.${key}.question`)}
                </h3>
                <svg
                  className={`w-5 sm:w-6 h-5 sm:h-6 text-cmyk-cyan flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-2">
                  <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                    {t(`items.${key}.answer`)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
