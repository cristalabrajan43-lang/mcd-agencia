'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  UserIcon,
  ShoppingBagIcon,
  HeartIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingPage } from '@/components/ui';
import { cn, getInitials } from '@/lib/utils';

interface AccountLayoutProps {
  children: React.ReactNode;
}

export default function AccountLayout({ children }: AccountLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const permissions = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check user role
  const isStaff = user?.role?.name === 'sales' || user?.role?.name === 'admin';

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Menu items based on role
  const MENU_ITEMS = useMemo(() => {
    if (isStaff) {
      // Staff users: account + dashboard access only
      return [
        { href: `/${locale}/mi-cuenta`, label: 'Mi Perfil', icon: UserIcon, exact: true },
        { href: `/${locale}/dashboard/operaciones`, label: 'Panel de Control', icon: Cog6ToothIcon },
      ];
    }
    // Customers: account + own orders/quotes
    return [
      { href: `/${locale}/mi-cuenta`, label: 'Mi Perfil', icon: UserIcon, exact: true },
      { href: `/${locale}/mi-cuenta/pedidos`, label: 'Mis Pedidos', icon: ShoppingBagIcon },
      { href: `/${locale}/mi-cuenta/favoritos`, label: 'Mis Favoritos', icon: HeartIcon },
      { href: `/${locale}/mi-cuenta/cotizaciones`, label: 'Mis Cotizaciones', icon: DocumentTextIcon },
    ];
  }, [locale, isStaff]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/${locale}/login?redirect=/${locale}/mi-cuenta`);
    }
  }, [isLoading, isAuthenticated, router, locale]);

  if (isLoading) {
    return <LoadingPage message="Cargando..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push(`/${locale}`);
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-20 lg:hidden overscroll-contain"
          style={{ top: 'var(--app-header-height, 4rem)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed z-30 w-64 bg-neutral-900 border-neutral-800 transform transition-transform duration-300 overscroll-contain top-[var(--app-header-height,4rem)] h-[calc(100dvh-var(--app-header-height,4rem))] lg:top-0 lg:h-screen',
          'right-0 border-l lg:right-auto lg:left-0 lg:border-l-0 lg:border-r lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-24 flex items-center justify-center px-4 pt-2 border-b border-neutral-800 flex-shrink-0">
            <Link href={`/${locale}/mi-cuenta`} className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 bg-gradient-to-br from-cmyk-cyan to-cmyk-magenta rounded-lg flex items-center justify-center font-bold text-white text-sm">
                {getInitials(user?.full_name || user?.email || '')}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-white text-sm truncate">Mi Cuenta</span>
                <span className="text-[10px] text-neutral-400 truncate">
                  {user?.first_name || user?.full_name || user?.email}
                </span>
              </div>
            </Link>
            <button
              className="xl:hidden text-neutral-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1 overflow-y-auto flex-1 min-h-0">
              {MENU_ITEMS.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href || pathname === `${item.href}/`
                  : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isActive
                        ? 'bg-cmyk-cyan/20 text-cmyk-cyan'
                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                Cerrar Sesión
              </button>
          </nav>

          <div className="flex-shrink-0 p-4 border-t border-neutral-800 bg-neutral-900">
            <div className="text-xs text-neutral-500">
              {permissions.isStaff ? 'Acceso staff activo' : 'Acceso cliente'}
            </div>
          </div>

          <div id="sidebar-extra" className="px-4 pb-4 space-y-4" />
        </div>

      </aside>

      <div className="lg:pl-64 pt-[var(--app-header-height,4rem)]">
        <div
          className="lg:hidden sticky z-20 bg-neutral-950/92 backdrop-blur-sm border-t border-white/10 border-b border-white/5 px-3 py-1.5 flex justify-end"
          style={{ top: 'calc(var(--app-header-height, 4rem) - 1px)' }}
        >
          <button
            className="p-2 text-neutral-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>

        <main className="p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
