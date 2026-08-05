'use client';

import { useTranslations } from 'next-intl';
import { trackCTA } from '@/lib/tracking';

const STEP_ICONS = ['📝', '⚡', '📦'];

export function HowItWorks() {
  const t = useTranslations('landing.howItWorks');

  const handleQuoteClick = () => {
    trackCTA('quote', 'how-it-works');
  };

  const steps = [
    { step: 1, icon: STEP_ICONS[0], key: 'step1' },
    { step: 2, icon: STEP_ICONS[1], key: 'step2' },
    { step: 3, icon: STEP_ICONS[2], key: 'step3' },
  ];

  return (
    <section className="section bg-gradient-to-br from-cmyk-black to-cmyk-black py-10 sm:py-14 md:py-18 lg:py-24">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-10 md:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl mb-4 font-bold text-white">{t('title')}</h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-300">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8 md:mb-12">
          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              {/* Connector line (desktop only) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 md:top-16 left-1/2 w-full h-0.5 bg-gray-200 -z-10">
                  <div className="h-full bg-cmyk-cyan w-0 animate-pulse"></div>
                </div>
              )}

              <div className="text-center">
                {/* Step number circle */}
                <div className="inline-flex items-center justify-center w-16 sm:w-20 md:w-32 h-16 sm:h-20 md:h-32 rounded-full bg-cmyk-cyan text-cmyk-black text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 md:mb-6 shadow-lg">
                  {step.step}
                </div>

                {/* Icon */}
                <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-3 md:mb-4">{step.icon}</div>

                {/* Content */}
                <h3 className="text-base sm:text-lg md:text-2xl mb-2 sm:mb-3 text-gray-100">
                  {t(`steps.${step.key}.title`)}
                </h3>
                <p className="text-sm sm:text-base text-gray-400">
                  {t(`steps.${step.key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <a
            href="#cotizar"
            onClick={handleQuoteClick}
            className="btn-primary text-sm sm:text-base md:text-lg px-6 sm:px-8 py-2 sm:py-3 md:py-4 inline-flex items-center"
          >
            {t('startQuote')}
          </a>
        </div>
      </div>
    </section>
  );
}
