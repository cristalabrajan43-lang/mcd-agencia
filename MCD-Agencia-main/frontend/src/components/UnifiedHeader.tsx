'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { CONTACT_INFO } from '@/lib/constants';
import { trackCTA } from '@/lib/tracking';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { CartDrawer } from '@/components/cart/CartDrawer';
import NotificationBell from '@/components/ui/NotificationBell';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {
  ShoppingCartIcon,
  UserIcon,
  GlobeAltIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  UserCircleIcon,
  Bars3Icon,
  XMarkIcon,
  DocumentTextIcon,
  ShoppingBagIcon,
  UsersIcon,
  CubeIcon,
  PhotoIcon,
  ChartBarIcon,
  ArchiveBoxIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

export function UnifiedHeader() {
  const t = useTranslations('landing.header');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<'dashboard' | null>(null);
  const locale = useLocale();
    const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth < 1024);
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
  const { itemCount } = useCart();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Check user role - only 3 roles: admin, sales, customer
  const isAdmin = user?.role?.name === 'admin';
  const isSales = user?.role?.name === 'sales';
  const isStaff = isAdmin || isSales;

  // Language switcher
  const otherLocale = locale === 'es' ? 'en' : 'es';

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
        setOpenSubmenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const updateHeaderHeight = () => {
      const height = headerRef.current?.offsetHeight;
      if (height) {
        document.documentElement.style.setProperty('--app-header-height', `${height}px`);
      }
    };

    updateHeaderHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeaderHeight();
    });

    if (headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  // Listen for openCart event from StickyActions or FloatingButtons
  useEffect(() => {
    const handleOpenCart = () => {
      setIsCartOpen(true);
    };
    window.addEventListener('openCart', handleOpenCart);
    return () => window.removeEventListener('openCart', handleOpenCart);
  }, []);

  const handleWhatsAppClick = () => {
    trackCTA('whatsapp', 'header');
  };

  const handleQuoteClick = () => {
    trackCTA('quote', 'header');
  };

  // Navigation links
  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/#servicios', label: t('nav.services') },
    { href: '/#portafolio', label: t('nav.portfolio') },
    { href: '/#clientes', label: t('nav.clients') },
    { href: '/#ubicaciones', label: t('nav.contact') },
  ];

  const isActive = (href: string) => {
    if (href.startsWith('/#')) return false;
    return pathname === `/${locale}${href}` || pathname === href;
  };

  const hasDesktopSidebarOffset =
    pathname?.startsWith(`/${locale}/dashboard`) ||
    pathname?.startsWith(`/${locale}/mi-cuenta`);

  const desktopNavClassName = hasDesktopSidebarOffset
    ? 'hidden xl:flex items-center space-x-2 2xl:space-x-4 flex-1 ml-4'
    : 'hidden lg:flex items-center space-x-3 xl:space-x-6 flex-1 ml-4';

  const desktopActionsClassName = hasDesktopSidebarOffset
    ? 'hidden xl:flex items-center space-x-2'
    : 'hidden lg:flex items-center space-x-2 xl:space-x-3';

  const mobileControlsClassName = hasDesktopSidebarOffset
    ? 'flex items-center gap-1 xl:hidden'
    : 'flex items-center gap-1 lg:hidden';

  const mobileMenuPanelClassName = hasDesktopSidebarOffset
    ? 'xl:hidden fixed inset-x-0 bottom-0 z-[60] bg-white/95 backdrop-blur-sm overflow-y-auto overscroll-contain dark:bg-neutral-950/95'
    : 'lg:hidden fixed inset-x-0 bottom-0 z-[60] bg-white/95 backdrop-blur-sm overflow-y-auto overscroll-contain dark:bg-neutral-950/95';

  const logoMetaClassName = hasDesktopSidebarOffset ? 'hidden 2xl:block' : 'hidden xl:block';

  return (
    <>
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 ${hasDesktopSidebarOffset ? 'lg:left-64' : ''} z-50 transition-all duration-500 ${
        isScrolled
          ? 'py-0 lg:py-2'
          : 'py-0 lg:py-3 lg:sm:py-4'
      }`}
    >
      {/* Inner container — floating pill shape */}
      <div className={`w-full lg:container-custom lg:px-4 xl:px-6 transition-all duration-500 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-xl border-b border-neutral-200 lg:bg-white/90 lg:shadow-lg lg:shadow-neutral-200/50 lg:rounded-2xl lg:border lg:border-neutral-200 lg:mx-auto dark:bg-black/85 dark:border-white/10 dark:lg:bg-black/70 dark:lg:shadow-2xl dark:lg:shadow-cmyk-cyan/5 dark:lg:border-white/10'
          : 'bg-white/90 backdrop-blur-md border-b border-neutral-100 lg:bg-white/80 lg:rounded-2xl lg:border lg:border-neutral-200 lg:mx-auto dark:bg-black/80 dark:border-white/5 dark:lg:bg-black/30 dark:lg:border-white/5'
      }`}>
        <div className="flex items-center justify-between py-2 px-3 sm:px-4 lg:py-2.5">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center space-x-2 lg:space-x-3 mr-4 flex-shrink-0">
            <div className="w-28 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Agencia MCD Logo"
                width={120}
                height={60}
                className="object-contain"
                priority
              />
            </div>
            <div className={logoMetaClassName}>
              <span className="text-lg font-bold text-neutral-900 dark:text-white">Agencia MCD</span>
              <p className="text-xs text-neutral-500 dark:text-gray-400">Acapulco</p>
            </div>
          </Link>

          {/* Navigation Desktop */}
          <nav className={desktopNavClassName}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={`/${locale}${link.href}`}
                className={`text-sm xl:text-base font-medium whitespace-nowrap transition-colors ${
                  isActive(link.href)
                    ? 'text-cmyk-cyan'
                    : 'text-neutral-800 hover:text-cmyk-cyan dark:text-white dark:hover:text-cmyk-cyan'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTAs Desktop */}
          <div className={desktopActionsClassName}>
            {/* WhatsApp */}
            <a
              href={CONTACT_INFO.whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsAppClick}
              className="text-green-600 hover:text-green-700 transition-colors p-1"
              aria-label="Contactar por WhatsApp"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </a>

            {/* Language Switcher */}
            <button
              onClick={() => {
                const newPathname = pathname.replace(`/${locale}`, `/${otherLocale}`);
                router.push(newPathname);
              }}
              className="p-1 text-neutral-600 hover:text-cmyk-cyan dark:text-gray-300 dark:hover:text-cmyk-cyan transition-colors flex items-center gap-1"
              aria-label={t('changeLanguage')}
            >
              <GlobeAltIcon className="w-5 h-5" />
              <span className="hidden xl:inline text-sm font-medium uppercase">{otherLocale}</span>
            </button>

            {/* Cart - Hidden for sales users */}
            {!isSales && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative text-neutral-600 hover:text-cmyk-cyan dark:text-gray-300 dark:hover:text-cmyk-cyan transition-colors"
              >
                <ShoppingCartIcon className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-cmyk-magenta text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </button>
            )}

            {/* Quote Button */}
            <Link
              href={`/${locale}/#cotizar`}
              onClick={handleQuoteClick}
              className="px-3 py-1.5 text-sm bg-cmyk-cyan text-cmyk-black font-semibold rounded-lg hover:bg-cmyk-cyan/90 transition-all hover:shadow-lg"
            >
              {t('quote')}
            </Link>

            {/* Buy Button - Hidden for sales users */}
            {!isSales && (
              <Link
                href={`/${locale}/catalogo`}
                className="hidden xl:inline-flex px-3 py-1.5 text-sm bg-yellow-400 text-neutral-900 font-semibold rounded-lg hover:bg-yellow-500 transition-all hover:shadow-lg"
              >
                {t('nav.buy') || 'Comprar'}
              </Link>
            )}

            {/* Theme toggle — visible for all users */}
            <ThemeToggle />

            {/* Notifications - Staff only (desktop) */}
            {isStaff && <NotificationBell />}

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 text-neutral-600 hover:text-cmyk-cyan dark:text-gray-300 dark:hover:text-cmyk-cyan transition-colors"
                aria-label={t('myAccount')}
              >
                <UserIcon className="w-6 h-6" />
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-cmyk-black/95 border border-cmyk-cyan/30 rounded-lg shadow-xl backdrop-blur-sm z-50">
                  {!isAuthenticated ? (
                    <>
                      <Link
                        href={`/${locale}/login`}
                        className="block px-4 py-3 text-white hover:bg-cmyk-cyan/10 transition-colors border-b border-cmyk-cyan/10"
                      >
                        {t('login')}
                      </Link>
                      <Link
                        href={`/${locale}/registro`}
                        className="block px-4 py-3 text-white hover:bg-cmyk-cyan/10 transition-colors"
                      >
                        {t('register')}
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-3 border-b border-cmyk-cyan/10">
                        <p className="text-sm text-gray-300">{t('welcome')}</p>
                        <p className="text-white font-semibold truncate">{user?.full_name || user?.first_name || user?.email}</p>
                      </div>

                      {/* Mi Cuenta */}
                      <Link
                        href={`/${locale}/mi-cuenta`}
                        onClick={() => setIsUserMenuOpen(false)}
                        className="px-4 py-3 text-white hover:bg-cmyk-cyan/10 transition-colors flex items-center gap-3"
                      >
                        <UserCircleIcon className="w-5 h-5" />
                        {t('myAccount')}
                      </Link>

                      {/* Cerrar Sesión */}
                      <button
                        onClick={() => {
                          logout();
                          setIsUserMenuOpen(false);
                          router.push(`/${locale}`);
                        }}
                        className="w-full text-left px-4 py-3 text-white hover:bg-cmyk-cyan/10 transition-colors flex items-center gap-3 border-b border-cmyk-cyan/10"
                      >
                        <ArrowRightOnRectangleIcon className="w-5 h-5" />
                        {t('logout')}
                      </button>

                      {/* Panel de Control - accordion style */}
                      {isStaff && (
                        <div
                          onMouseEnter={() => setOpenSubmenu('dashboard')}
                          onMouseLeave={() => setOpenSubmenu(null)}
                        >
                          <Link
                            href={`/${locale}/dashboard/operaciones`}
                            onClick={() => { setIsUserMenuOpen(false); setOpenSubmenu(null); }}
                            className="w-full px-4 py-3 text-cmyk-cyan hover:bg-cmyk-cyan/10 transition-colors flex items-center gap-3"
                          >
                            <Cog6ToothIcon className="w-5 h-5" />
                            <span className="flex-1 text-left font-medium">Panel de Control</span>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${openSubmenu === 'dashboard' ? 'rotate-180' : ''}`} />
                          </Link>
                          {/* Submenu inline */}
                          {openSubmenu === 'dashboard' && (
                            <div className="bg-cmyk-black/50 border-t border-cmyk-cyan/10">
                              {[
                                { href: '/dashboard/operaciones', label: 'Operaciones', icon: CalendarDaysIcon },
                                { href: '/dashboard/solicitudes', label: 'Solicitudes', icon: ClipboardDocumentListIcon },
                                { href: '/dashboard/cotizaciones', label: 'Cotizaciones', icon: DocumentTextIcon },
                                { href: '/dashboard/pedidos', label: 'Pedidos', icon: ShoppingBagIcon },
                                { href: '/dashboard/clientes', label: 'Clientes', icon: UsersIcon },
                                { href: '/dashboard/inventario', label: 'Inventario', icon: ArchiveBoxIcon },
                                ...(isAdmin ? [
                                  { href: '/dashboard/catalogo', label: 'Catálogo', icon: CubeIcon },
                                  { href: '/dashboard/usuarios', label: 'Usuarios', icon: UsersIcon },
                                  { href: '/dashboard/contenido', label: 'Contenido', icon: PhotoIcon },
                                  { href: '/dashboard/analytics', label: 'Analítica', icon: ChartBarIcon },
                                  { href: '/dashboard/auditoria', label: 'Auditoría', icon: ClipboardDocumentListIcon },
                                ] : []),
                              ].map((item) => (
                                <Link
                                  key={item.href}
                                  href={`/${locale}${item.href}`}
                                  onClick={() => { setIsUserMenuOpen(false); setOpenSubmenu(null); }}
                                  className="pl-8 pr-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-cmyk-cyan/10 transition-colors flex items-center gap-3"
                                >
                                  <item.icon className="w-4 h-4" />
                                  {item.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Theme + Notification Bell + Hamburger */}
          <div className={mobileControlsClassName}>
            <ThemeToggle />
            {isStaff && <NotificationBell />}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-neutral-600 hover:text-cmyk-cyan dark:text-gray-300 dark:hover:text-cmyk-cyan transition-colors"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </header>

    {/* Mobile Menu — rendered outside <header> so it's in the root stacking context */}
    {isMobileMenuOpen && (
      <div
        className={mobileMenuPanelClassName}
        style={{ top: 'var(--app-header-height, 4rem)' }}
      >
        <div className="px-4 py-4 border-t border-cmyk-cyan/10">
            <nav className="space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={`/${locale}${link.href}`}
                  className={`block px-4 py-2 rounded transition-colors ${
                    isActive(link.href)
                      ? 'text-cmyk-cyan bg-cmyk-cyan/10'
                      : 'text-white hover:text-cmyk-cyan hover:bg-cmyk-cyan/5'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Auth section */}
            <div className="mt-4 pt-4 border-t border-cmyk-cyan/10 space-y-2">
              {!isAuthenticated ? (
                <>
                  <Link
                    href={`/${locale}/login`}
                    className="block px-4 py-2 text-white hover:text-cmyk-cyan transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t('login')}
                  </Link>
                  <Link
                    href={`/${locale}/registro`}
                    className="block px-4 py-2 text-white hover:text-cmyk-cyan transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t('register')}
                  </Link>
                </>
              ) : (
                <>
                  {/* Mi Cuenta */}
                  <Link
                    href={`/${locale}/mi-cuenta`}
                    className="block px-4 py-2 text-white hover:text-cmyk-cyan transition-colors flex items-center gap-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <UserCircleIcon className="w-5 h-5" />
                    {t('myAccount')}
                  </Link>

                  {/* Panel de Control - unified on mobile */}
                  {isStaff && (
                    <details className="group">
                      <summary className="px-4 py-2 text-white hover:text-cmyk-cyan transition-colors flex items-center gap-2 cursor-pointer list-none">
                        <Cog6ToothIcon className="w-5 h-5" />
                        <span className="flex-1">Panel de Control</span>
                        <ChevronRightIcon className="w-4 h-4 transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="ml-6 space-y-1 pb-1">
                        {[
                          { href: '/dashboard/operaciones', label: 'Operaciones', icon: CalendarDaysIcon },
                          { href: '/dashboard/solicitudes', label: 'Solicitudes', icon: ClipboardDocumentListIcon },
                          { href: '/dashboard/cotizaciones', label: 'Cotizaciones', icon: DocumentTextIcon },
                          { href: '/dashboard/pedidos', label: 'Pedidos', icon: ShoppingBagIcon },
                          { href: '/dashboard/clientes', label: 'Clientes', icon: UsersIcon },
                          { href: '/dashboard/inventario', label: 'Inventario', icon: ArchiveBoxIcon },
                          ...(isAdmin ? [
                            { href: '/dashboard/catalogo', label: 'Catálogo', icon: CubeIcon },
                            { href: '/dashboard/usuarios', label: 'Usuarios', icon: UsersIcon },
                            { href: '/dashboard/contenido', label: 'Contenido', icon: PhotoIcon },
                            { href: '/dashboard/analytics', label: 'Analítica', icon: ChartBarIcon },
                            { href: '/dashboard/auditoria', label: 'Auditoría', icon: ClipboardDocumentListIcon },
                          ] : []),
                        ].map((item) => (
                          <Link
                            key={item.href}
                            href={`/${locale}${item.href}`}
                            className="block px-4 py-1.5 text-sm text-neutral-300 hover:text-cmyk-cyan transition-colors flex items-center gap-2"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Cerrar Sesión */}
                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                      router.push(`/${locale}`);
                    }}
                    className="w-full text-left px-4 py-2 text-white hover:text-cmyk-cyan transition-colors flex items-center gap-2"
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    {t('logout')}
                  </button>
                </>
              )}
            </div>

            {/* Mobile Theme + Language */}
            <div className="mt-4 pt-4 border-t border-cmyk-cyan/10 px-4 flex items-center justify-between">
              <span className="text-sm text-neutral-300">Modo claro / oscuro</span>
              <ThemeToggle />
            </div>
            <div className="px-4 pb-2">
              <button
                onClick={() => {
                  const newPathname = pathname.replace(`/${locale}`, `/${otherLocale}`);
                  router.push(newPathname);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-gray-300 hover:text-cmyk-cyan transition-colors flex items-center gap-2"
              >
                <GlobeAltIcon className="w-5 h-5" />
                <span>{otherLocale.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
