'use client';

import { cn } from '@/lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'cyan' | 'magenta';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
}: BadgeProps) {
  const variants = {
    default: 'bg-neutral-800 text-neutral-300',
    success: 'bg-green-500/20 text-green-400 border border-green-500/30',
    warning: 'bg-cmyk-yellow/20 text-cmyk-yellow border border-cmyk-yellow/30',
    error: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-cmyk-cyan/20 text-cmyk-cyan border border-cmyk-cyan/30',
    cyan: 'bg-cmyk-cyan/20 text-cmyk-cyan border border-cmyk-cyan/30',
    magenta: 'bg-cmyk-magenta/20 text-cmyk-magenta border border-cmyk-magenta/30',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}
