'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { TagIcon } from '@heroicons/react/24/solid';

import { getPromoBanners, type PromoBanner } from '@/lib/api/content';
import { cn } from '@/lib/utils';

function buildPromoHref(banner: PromoBanner, locale: string): string {
  const catalogBase = `/${locale}/catalogo`;

  if (Number(banner.discount_percent) > 0) {
    if (banner.apply_to === 'selected') {
      return `${catalogBase}?promo=${banner.id}`;
    }
    return `${catalogBase}?ofertas=1`;
  }

  const cta = (banner.cta_url || '').trim();
  if (!cta) return catalogBase;

  if (cta.startsWith('http')) return cta;
  if (cta.startsWith(`/${locale}/`)) return cta;
  if (cta.startsWith('/')) return `/${locale}${cta}`;
  if (cta.startsWith('#')) return `/${locale}${cta}`;
  return `/${locale}/${cta}`;
}

function PromoBannerChip({ banner, locale }: { banner: PromoBanner; locale: string }) {
  const title = locale === 'en' && banner.title_en ? banner.title_en : banner.title;
  const subtitle = locale === 'en' && banner.subtitle_en ? banner.subtitle_en : banner.subtitle;
  const badge = banner.badge_text || (banner.discount_percent > 0 ? `-${Math.round(Number(banner.discount_percent))}%` : '');
  const href = buildPromoHref(banner, locale);
  const isExternal = href.startsWith('http');

  const content = (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 min-w-[220px] max-w-[320px]',
        'shadow-lg backdrop-blur-sm transition-transform hover:scale-[1.02] cursor-pointer'
      )}
      style={{
        backgroundColor: banner.background_color || '#00E5FF',
        color: banner.text_color || '#000000',
      }}
    >
      {badge && (
        <span className="inline-flex items-center justify-center rounded-lg bg-black/15 px-2 py-1 text-xs font-bold whitespace-nowrap">
          {badge}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{title}</p>
        {subtitle && (
          <p className="text-xs opacity-80 leading-tight truncate mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block flex-shrink-0">
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className="block flex-shrink-0">
      {content}
    </Link>
  );
}

export function PromoBanners() {
  const locale = useLocale();
  const { data: banners = [] } = useQuery({
    queryKey: ['promo-banners'],
    queryFn: getPromoBanners,
    staleTime: 60_000,
  });

  if (banners.length === 0) return null;

  return (
    <section className="relative z-20 -mt-2 px-4 sm:px-6 lg:px-8 pb-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <TagIcon className="h-4 w-4 text-cmyk-cyan" />
          <p className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
            Promociones activas
          </p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
          {banners.map((banner) => (
            <div key={banner.id} className="snap-start">
              <PromoBannerChip banner={banner} locale={locale} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
