'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { getClientLogos } from '@/lib/api/content';
import { CLIENTS } from '@/lib/constants';

/* ── Types ── */
interface ClientItem {
  name: string;
  logo: string;
  website?: string;
}

/* ── Single logo tile ── */
function LogoTile({ client }: { client: ClientItem }) {
  const [err, setErr] = useState(false);

  const inner = (
    <div className="relative w-24 h-16 sm:w-32 sm:h-20 md:w-36 md:h-24 lg:w-40 lg:h-28
                    flex items-center justify-center
                    grayscale opacity-50 hover:grayscale-0 hover:opacity-100
                    transition-all duration-500 ease-out">
      {err ? (
        <span className="text-2xl">🏢</span>
      ) : (
        <Image
          src={client.logo}
          alt={client.name}
          fill
          className="object-contain drop-shadow-lg"
          title={client.name}
          onError={() => setErr(true)}
        />
      )}
    </div>
  );

  if (client.website) {
    return (
      <a href={client.website} target="_blank" rel="noopener noreferrer"
         className="flex-shrink-0 mx-4 sm:mx-6 md:mx-8 lg:mx-10" aria-label={client.name}>
        {inner}
      </a>
    );
  }

  return <div className="flex-shrink-0 mx-4 sm:mx-6 md:mx-8 lg:mx-10">{inner}</div>;
}

/* ── Infinite marquee row ── */
function MarqueeRow({ items, reverse = false, speed = 40 }: {
  items: ClientItem[];
  reverse?: boolean;
  speed?: number;
}) {
  // Duplicate 4× for seamless loop
  const belt = [...items, ...items, ...items, ...items];
  const duration = items.length * speed;

  return (
    <div className="relative overflow-hidden py-4 sm:py-6 group">
      <div
        className="flex items-center w-max group-hover:[animation-play-state:paused]"
        style={{
          animation: `${reverse ? 'marqueeRight' : 'marqueeLeft'} ${duration}s linear infinite`,
        }}
      >
        {belt.map((c, i) => (
          <LogoTile key={`${c.name}-${i}`} client={c} />
        ))}
      </div>
    </div>
  );
}

/* ── Main component ── */
export function Clients() {
  const t = useTranslations('landing.clients');

  const { data: apiClients } = useQuery({
    queryKey: ['landing-client-logos'],
    queryFn: getClientLogos,
    staleTime: 5 * 60 * 1000,
  });

  const clients: ClientItem[] = useMemo(() => {
    if (apiClients && apiClients.length > 0) {
      return apiClients.map((c) => ({ name: c.name, logo: c.logo, website: c.website }));
    }
    return [...CLIENTS];
  }, [apiClients]);

  // Split into two rows for the double-marquee effect
  const mid = Math.ceil(clients.length / 2);
  const row1 = clients.slice(0, mid);
  const row2 = clients.slice(mid);

  return (
    <section id="clientes" className="section py-12 sm:py-16 md:py-20 lg:py-28 overflow-hidden">
      {/* CSS keyframes for marquee */}
      <style jsx>{`
        @keyframes marqueeLeft {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marqueeRight {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>

      {/* Title block */}
      <div className="container-custom text-center mb-6 sm:mb-10 md:mb-12">
        <h2 className="text-3xl sm:text-4xl md:text-5xl mb-4 font-bold text-white">{t('title')}</h2>
        <p className="text-base sm:text-lg md:text-xl text-gray-300">{t('subtitle')}</p>
      </div>

      {/* Double-row marquee */}
      <div className="w-full">
        <MarqueeRow items={row1} reverse={false} speed={5} />
        {row2.length > 0 && <MarqueeRow items={row2} reverse={true} speed={6} />}
      </div>

      {/* Counter */}
      <div className="container-custom mt-8 sm:mt-12 text-center">
        <p className="text-gray-400 italic text-sm">{t('satisfied', { count: String(clients.length) })}</p>
      </div>
    </section>
  );
}
