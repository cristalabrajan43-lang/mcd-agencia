'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LOCATION_IDS, LOCATION_DATA, type LocationId } from '@/lib/service-ids';

export function Locations() {
  const t = useTranslations('landing.locations');
  const [selectedLocationId, setSelectedLocationId] = useState<LocationId>(LOCATION_IDS[0]);

  const getLocationData = (id: LocationId) => ({
    id,
    name: t(`items.${id}.name`),
    city: t(`items.${id}.city`),
    address: t(`items.${id}.address`),
    ...LOCATION_DATA[id],
  });

  const selectedLocation = getLocationData(selectedLocationId);

  return (
    <section id="ubicaciones" className="section py-12 sm:py-16 md:py-20 lg:py-24">
      <div className="container-custom">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl mb-4 font-bold text-white">
            {t('title')}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-300">
            {t('subtitle')}
          </p>
        </div>

        {/* Locations Grid and Map */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Location Cards */}
          <div className="lg:col-span-2 space-y-3">
            {LOCATION_IDS.map((locationId) => {
              const location = getLocationData(locationId);
              const isSelected = selectedLocationId === locationId;
              return (
                <button
                  key={locationId}
                  onClick={() => setSelectedLocationId(locationId)}
                  className={`w-full text-left p-4 sm:p-5 rounded-xl transition-all duration-300 border-2 ${
                    isSelected
                      ? 'border-cmyk-magenta bg-cmyk-magenta/10 shadow-lg shadow-cmyk-magenta/20'
                      : 'border-cmyk-cyan/30 bg-cmyk-black/50 hover:border-cmyk-cyan/60 hover:bg-cmyk-black/70'
                  }`}
                >
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                    {location.name}
                  </h3>
                  <p className="text-xs text-gray-400 mb-2">{location.city}</p>
                  
                  {/* Address */}
                  <div className="mb-2 flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 text-cmyk-cyan flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs text-gray-400 leading-relaxed">{location.address}</p>
                  </div>

                  {/* Phone(s) */}
                  <div className="mb-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-cmyk-cyan flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                      </svg>
                      <a
                        href={`tel:${location.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-cmyk-cyan hover:text-cmyk-magenta transition-colors"
                      >
                        {location.phone2Label ? 'CEL. ' : ''}{location.phoneDisplay}
                      </a>
                    </div>
                    {location.phone2 && (
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-cmyk-cyan flex-shrink-0 opacity-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                        </svg>
                        <a
                          href={`tel:${location.phone2}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-cmyk-cyan hover:text-cmyk-magenta transition-colors"
                        >
                          {location.phone2Label || 'TEL'}.&nbsp;{location.phone2Display}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div className="mb-2 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-cmyk-cyan flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <a
                      href={`mailto:${location.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-cmyk-cyan hover:text-cmyk-magenta transition-colors"
                    >
                      {location.email}
                    </a>
                  </div>

                  {/* WhatsApp Button */}
                  <a
                    href={location.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    {t('whatsappCta')}
                  </a>
                </button>
              );
            })}
          </div>

          {/* Map */}
          <div className="lg:col-span-3 bg-cmyk-black/50 rounded-xl overflow-hidden border border-cmyk-cyan/30 min-h-[400px]">
            <iframe
              src={`https://maps.google.com/maps?q=${selectedLocation.latitude},${selectedLocation.longitude}&z=17&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: '400px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`${t('title')} - ${selectedLocation.name}`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
