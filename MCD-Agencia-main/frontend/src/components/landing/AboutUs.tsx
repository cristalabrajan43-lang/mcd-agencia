'use client';

import { useTranslations } from 'next-intl';

const VALUES = [
  { icon: '👑', key: 'leadership' },
  { icon: '🤝', key: 'commitment' },
  { icon: '💪', key: 'dedication' },
  { icon: '💡', key: 'innovation' },
  { icon: '🎯', key: 'customerFocus' },
  { icon: '🎨', key: 'creativity' },
  { icon: '⭐', key: 'quality' },
];

export function AboutUs() {
  const t = useTranslations('landing.aboutUs');

  return (
    <section id="nosotros" className="section py-12 sm:py-16 md:py-20 lg:py-24">
      <div className="container-custom">
        {/* Header */}
        <div className="text-center max-w-4xl mx-auto mb-10 sm:mb-14 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl mb-6 font-bold text-white">
            {t('title')}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-300 leading-relaxed">
            {t('description')}
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-12 sm:mb-16">
          {/* Mission */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cmyk-cyan/20 to-cmyk-magenta/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-50"></div>
            <div className="relative bg-neutral-900/80 border border-cmyk-cyan/30 rounded-2xl p-6 sm:p-8 h-full hover:border-cmyk-cyan/60 transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-cmyk-cyan/20 flex items-center justify-center">
                  <span className="text-2xl sm:text-3xl">🚀</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-cmyk-cyan">
                  {t('mission.title')}
                </h3>
              </div>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                {t('mission.description')}
              </p>
            </div>
          </div>

          {/* Vision */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cmyk-magenta/20 to-cmyk-yellow/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-50"></div>
            <div className="relative bg-neutral-900/80 border border-cmyk-magenta/30 rounded-2xl p-6 sm:p-8 h-full hover:border-cmyk-magenta/60 transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-cmyk-magenta/20 flex items-center justify-center">
                  <span className="text-2xl sm:text-3xl">🌟</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-cmyk-magenta">
                  {t('vision.title')}
                </h3>
              </div>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                {t('vision.description')}
              </p>
            </div>
          </div>
        </div>

        {/* Values */}
        <div>
          <h3 className="text-2xl sm:text-3xl font-bold text-center text-white mb-8 sm:mb-10">
            {t('values.title')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 sm:gap-6">
            {VALUES.map((value, index) => (
              <div
                key={value.key}
                className="group text-center p-4 sm:p-5 rounded-xl bg-neutral-800/50 border border-neutral-700/50 hover:border-cmyk-yellow/50 hover:bg-neutral-800 transition-all duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                  {value.icon}
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-300 group-hover:text-cmyk-yellow transition-colors">
                  {t(`values.items.${value.key}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
