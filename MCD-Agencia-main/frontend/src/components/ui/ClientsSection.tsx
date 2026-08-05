'use client';

/**
 * ClientsSection Component for MCD-Agencia.
 *
 * Displays client logos in an animated marquee.
 * Builds trust through social proof.
 */

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface ClientLogo {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

interface ClientsSectionProps {
  clients: ClientLogo[];
}

export default function ClientsSection({ clients }: ClientsSectionProps) {
  const t = useTranslations('Clients');

  if (!clients || clients.length === 0) {
    return null;
  }

  // Duplicate clients for seamless scrolling
  const duplicatedClients = [...clients, ...clients];

  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {t('title')}
          </h2>
          <p className="text-gray-600">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Logo Marquee */}
        <div className="relative">
          {/* Gradient Overlays */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />

          {/* Scrolling Container */}
          <motion.div
            className="flex gap-12 items-center"
            animate={{
              x: [0, -50 * clients.length],
            }}
            transition={{
              duration: clients.length * 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            {duplicatedClients.map((client, index) => (
              <div
                key={`${client.id}-${index}`}
                className="flex-shrink-0 w-32 h-16 relative grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
              >
                {client.website ? (
                  <Link
                    href={client.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={client.name}
                  >
                    <Image
                      src={client.logo}
                      alt={client.name}
                      fill
                      className="object-contain"
                    />
                  </Link>
                ) : (
                  <Image
                    src={client.logo}
                    alt={client.name}
                    fill
                    className="object-contain"
                  />
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
