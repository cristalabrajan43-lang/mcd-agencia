'use client';

import { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'mcd-theme';

function applyThemeClass(theme: 'light' | 'dark') {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = theme;
}

export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial =
      stored === 'light' || stored === 'dark'
        ? stored
        : document.documentElement.classList.contains('dark')
          ? 'dark'
          : 'light';
    setTheme(initial);
    applyThemeClass(initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyThemeClass(next);
  };

  const label = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        'relative flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-full border transition-colors',
        'border-neutral-300 bg-white/90 text-amber-500 hover:border-cmyk-cyan hover:text-cmyk-cyan',
        'dark:border-neutral-600 dark:bg-neutral-800/90 dark:text-cmyk-yellow dark:hover:border-cmyk-cyan dark:hover:text-cmyk-cyan',
        className
      )}
    >
      {theme === 'dark' ? (
        <SunIcon className="h-5 w-5" aria-hidden />
      ) : (
        <MoonIcon className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
