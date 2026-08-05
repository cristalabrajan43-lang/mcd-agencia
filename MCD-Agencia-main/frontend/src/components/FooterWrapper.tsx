'use client';

import { usePathname } from 'next/navigation';

/**
 * Wraps the Footer so it shifts right on desktop when the dashboard
 * fixed sidebar (w-64 = 16rem) is visible, preventing the sidebar
 * from covering the footer.
 */
export function FooterWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Dashboard and account layouts use a fixed sidebar (w-64) on lg+ screens.
  const hasFixedSidebar = /^\/[a-z]{2}\/(dashboard|mi-cuenta)(\/|$)/.test(pathname);

  return (
    <div className={hasFixedSidebar ? 'lg:pl-64' : undefined}>
      {children}
    </div>
  );
}
