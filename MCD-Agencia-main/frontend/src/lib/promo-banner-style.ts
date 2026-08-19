/**
 * Resolves the visual styling of a promo banner.
 *
 * Shared by the public landing chip and the admin preview so both always
 * render identically. Tailwind class names are looked up from static maps
 * because the JIT compiler cannot see dynamically built class strings.
 */

import type { CSSProperties } from 'react';

import type {
  PromoBadgeShape,
  PromoBackgroundStyle,
  PromoFontFamily,
  PromoGradientDirection,
  PromoTextTransform,
  PromoTitleSize,
  PromoTitleWeight,
} from '@/lib/api/content';

export const DEFAULT_BACKGROUND_COLOR = '#00E5FF';
export const DEFAULT_TEXT_COLOR = '#000000';
const DEFAULT_BORDER_COLOR = 'rgba(255, 255, 255, 0.1)';
const DEFAULT_BADGE_BACKGROUND = 'rgba(0, 0, 0, 0.15)';

const FONT_CLASSES: Record<PromoFontFamily, string> = {
  sans: 'font-sans',
  display: 'font-display',
  mono: 'font-mono',
};

const TITLE_SIZE_CLASSES: Record<PromoTitleSize, string> = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const SUBTITLE_SIZE_CLASSES: Record<PromoTitleSize, string> = {
  sm: 'text-xs',
  base: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

const TITLE_WEIGHT_CLASSES: Record<PromoTitleWeight, string> = {
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  black: 'font-black',
};

const TEXT_TRANSFORM_CLASSES: Record<PromoTextTransform, string> = {
  none: 'normal-case',
  uppercase: 'uppercase',
  capitalize: 'capitalize',
};

const BADGE_SHAPE_CLASSES: Record<PromoBadgeShape, string> = {
  pill: 'rounded-full',
  rounded: 'rounded-lg',
  square: 'rounded-none',
};

export interface PromoBannerStyleInput {
  background_color?: string;
  background_style?: PromoBackgroundStyle;
  background_color_secondary?: string;
  gradient_direction?: PromoGradientDirection;
  border_color?: string;
  text_color?: string;
  subtitle_color?: string;
  badge_background_color?: string;
  badge_text_color?: string;
  badge_shape?: PromoBadgeShape;
  font_family?: PromoFontFamily;
  title_size?: PromoTitleSize;
  title_weight?: PromoTitleWeight;
  text_transform?: PromoTextTransform;
}

export interface PromoBannerStyle {
  containerStyle: CSSProperties;
  containerClassName: string;
  titleStyle: CSSProperties;
  titleClassName: string;
  subtitleStyle: CSSProperties;
  subtitleClassName: string;
  badgeStyle: CSSProperties;
  badgeClassName: string;
}

function pick<T extends string>(value: T | undefined, options: Record<T, string>, fallback: T): T {
  return value && value in options ? value : fallback;
}

export function resolvePromoBannerStyle(banner: PromoBannerStyleInput): PromoBannerStyle {
  const primary = banner.background_color?.trim() || DEFAULT_BACKGROUND_COLOR;
  const secondary = banner.background_color_secondary?.trim();
  const textColor = banner.text_color?.trim() || DEFAULT_TEXT_COLOR;
  const subtitleColor = banner.subtitle_color?.trim();
  const badgeBackground = banner.badge_background_color?.trim();
  const badgeTextColor = banner.badge_text_color?.trim();

  const isGradient = banner.background_style === 'gradient' && Boolean(secondary);
  const direction = banner.gradient_direction || 'to right';

  const fontFamily = pick(banner.font_family, FONT_CLASSES, 'sans');
  const titleSize = pick(banner.title_size, TITLE_SIZE_CLASSES, 'sm');
  const titleWeight = pick(banner.title_weight, TITLE_WEIGHT_CLASSES, 'semibold');
  const textTransform = pick(banner.text_transform, TEXT_TRANSFORM_CLASSES, 'none');
  const badgeShape = pick(banner.badge_shape, BADGE_SHAPE_CLASSES, 'rounded');

  return {
    containerStyle: {
      background: isGradient
        ? `linear-gradient(${direction}, ${primary}, ${secondary})`
        : primary,
      color: textColor,
      borderColor: banner.border_color?.trim() || DEFAULT_BORDER_COLOR,
    },
    containerClassName: FONT_CLASSES[fontFamily],
    titleStyle: {},
    titleClassName: [
      TITLE_SIZE_CLASSES[titleSize],
      TITLE_WEIGHT_CLASSES[titleWeight],
      TEXT_TRANSFORM_CLASSES[textTransform],
    ].join(' '),
    // Without an explicit color the subtitle keeps inheriting the title color
    // at reduced opacity, which is how banners looked before this was tunable.
    subtitleStyle: subtitleColor ? { color: subtitleColor } : {},
    subtitleClassName: [
      SUBTITLE_SIZE_CLASSES[titleSize],
      TEXT_TRANSFORM_CLASSES[textTransform],
      subtitleColor ? '' : 'opacity-80',
    ]
      .filter(Boolean)
      .join(' '),
    badgeStyle: {
      backgroundColor: badgeBackground || DEFAULT_BADGE_BACKGROUND,
      color: badgeTextColor || 'inherit',
    },
    badgeClassName: BADGE_SHAPE_CLASSES[badgeShape],
  };
}
