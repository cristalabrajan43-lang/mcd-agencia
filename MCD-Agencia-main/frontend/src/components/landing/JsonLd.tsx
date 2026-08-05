'use server';

import { CONTACT_INFO } from '@/lib/constants';

export async function JsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Agencia MCD Acapulco',
    description: 'Agencia especializada en impresión de gran formato, lonas publicitarias, vinilos y señalética en Acapulco.',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://agenciamcd.mx',
    telephone: CONTACT_INFO.whatsapp.number,
    email: CONTACT_INFO.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Acapulco',
      addressRegion: 'Guerrero',
      addressCountry: 'MX',
    },
    geo: {
      '@type': 'GeoCoordinates',
      // Agregar coordenadas reales cuando estén disponibles
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '18:00',
    },
    priceRange: '$$',
    image: `${process.env.NEXT_PUBLIC_SITE_URL}/og-image.jpg`,
    sameAs: [
      // Agregar redes sociales cuando estén disponibles
    ],
  };

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Impresión de Gran Formato',
    provider: {
      '@type': 'LocalBusiness',
      name: 'Agencia MCD Acapulco',
    },
    areaServed: {
      '@type': 'State',
      name: 'Guerrero',
    },
    serviceType: 'Impresión Digital, Gran Formato, Lonas, Vinilos, Señalética',
    description: 'Servicios profesionales de impresión de gran formato para publicidad exterior e interior.',
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: process.env.NEXT_PUBLIC_SITE_URL,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
