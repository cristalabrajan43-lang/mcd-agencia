'use client';

import { CONTACT_INFO } from '@/lib/constants';
import { trackCTA } from '@/lib/tracking';

export function Contact() {
  const handleWhatsAppClick = () => {
    trackCTA('whatsapp', 'contact-section');
  };

  return (
    <section id="contacto" className="section bg-gradient-to-br from-cmyk-black to-cmyk-black py-8 sm:py-12 md:py-14 lg:py-18">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-3 sm:mb-4 font-bold text-white">¿Prefieres contacto directo?</h2>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-300">
            Estamos disponibles para atenderte por los siguientes medios.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 max-w-5xl mx-auto">
          {/* WhatsApp */}
          <div className="card bg-cmyk-black border-2 border-cmyk-cyan/20 text-center group hover:border-cmyk-cyan transition-all p-3 sm:p-4 md:p-6">
            <div className="w-10 sm:w-12 md:w-16 h-10 sm:h-12 md:h-16 bg-cmyk-cyan/20 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4 group-hover:bg-cmyk-cyan transition-colors">
              <svg className="w-5 sm:w-6 md:w-8 h-5 sm:h-6 md:h-8 text-cmyk-cyan group-hover:text-cmyk-black transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </div>
            <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-100 mb-1 sm:mb-2">WhatsApp</h3>
            <p className="text-gray-400 mb-2 sm:mb-3 md:mb-4 text-xs sm:text-sm md:text-base">{CONTACT_INFO.whatsapp.number}</p>
            <a
              href={CONTACT_INFO.whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsAppClick}
              className="btn-whatsapp w-full text-xs sm:text-sm md:text-base py-2 sm:py-2.5 md:py-3"
            >
              Abrir chat →
            </a>
          </div>

          {/* Email */}
          <div className="card bg-cmyk-black border-2 border-cmyk-cyan/20 text-center group hover:border-cmyk-magenta transition-all p-3 sm:p-4 md:p-6">
            <div className="w-10 sm:w-12 md:w-16 h-10 sm:h-12 md:h-16 bg-cmyk-magenta/20 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4 group-hover:bg-cmyk-magenta transition-colors">
              <svg className="w-5 sm:w-6 md:w-8 h-5 sm:h-6 md:h-8 text-cmyk-magenta group-hover:text-cmyk-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-100 mb-1 sm:mb-2">Email</h3>
            <p className="text-gray-400 mb-2 sm:mb-3 md:mb-4 text-xs sm:text-sm md:text-base break-all">{CONTACT_INFO.email}</p>
            <a
              href={`mailto:${CONTACT_INFO.email}`}
              className="btn-secondary w-full text-xs sm:text-sm md:text-base py-2 sm:py-2.5 md:py-3"
            >
              Enviar email →
            </a>
          </div>

          {/* Ubicación */}
          <div className="card bg-cmyk-black border-2 border-cmyk-cyan/20 text-center group hover:border-cmyk-yellow transition-all p-3 sm:p-4 md:p-6">
            <div className="w-10 sm:w-12 md:w-16 h-10 sm:h-12 md:h-16 bg-cmyk-yellow/20 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4 group-hover:bg-cmyk-yellow transition-colors">
              <svg className="w-5 sm:w-6 md:w-8 h-5 sm:h-6 md:h-8 text-cmyk-yellow group-hover:text-cmyk-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-100 mb-1 sm:mb-2">Ubicación</h3>
            <p className="text-gray-400 mb-2 sm:mb-3 md:mb-4 text-xs sm:text-sm md:text-base break-word">{CONTACT_INFO.location}</p>
            <button className="btn-secondary w-full disabled:opacity-50 text-xs sm:text-sm md:text-base py-2 sm:py-2.5 md:py-3" disabled>
              Ver mapa →
            </button>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 md:mt-8 lg:mt-12 text-center">
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-100">
            <strong>Horario de atención:</strong> Lun-Vie {CONTACT_INFO.businessHours} hrs
          </p>
          <p className="text-gray-400 text-xs sm:text-sm md:text-base mt-1.5 sm:mt-2">
            Fuera de horario, déjanos tu mensaje y te responderemos al siguiente día hábil.
          </p>
        </div>
      </div>
    </section>
  );
}
