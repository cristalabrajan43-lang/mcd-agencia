'use client';

/**
 * Header Component for MCD-Agencia
 *
 * Main navigation header with:
 * - Logo
 * - Navigation links
 * - Language switcher
 * - Cart icon
 * - User menu
 * - Mobile menu
 *
 * @module components/layout/Header
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bars3Icon,
  XMarkIcon,
  ShoppingCartIcon,
  UserIcon,
  GlobeAltIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import NotificationBell from '@/components/ui/NotificationBell';
import { FloatingButtons } from '@/components/layout/FloatingButtons';

// =============================================================================
// Navigation Links
// =============================================================================

const navigation = [
  { name: 'home', href: '/' },
  { name: 'catalog', href: '/catalogo' },
  { name: 'services', href: '/#services' },
  { name: 'about', href: '/#about' },
  { name: 'contact', href: '/#contact' },
];

// =============================================================================
// Header Component
// =============================================================================

export function Header() {
  const t = useTranslations('navigation');
  const locale = useLocale();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount } = useCart();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Check user role - 3 roles: admin, sales, customer
  const isAdmin = user?.role?.name === 'admin';
  const isSales = user?.role?.name === 'sales';
  const isStaff = isAdmin || isSales;

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Toggle language
  const otherLocale = locale === 'es' ? 'en' : 'es';
  const currentPath = pathname.replace(`/${locale}`, '') || '/';

  return (
    <>
    <header
      className={`layout-header fixed left-0 right-0 top-0 lg:left-64 z-[60] transition-all duration-300 ${
        isScrolled
          ? 'bg-neutral-950/95 shadow-lg backdrop-blur-md'
          : 'bg-transparent'
      }`}
    >
      <nav className="container-custom" aria-label="Main navigation">
        <div className="flex h-16 items-center justify-between md:h-20">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
            aria-label="MCD Agencia - Home"
          >
            <Image
              src="/images/logo.png"
              alt="MCD Agencia"
              width={160}
              height={80}
              className="h-8 w-auto md:h-10"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-8 md:flex">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={`/${locale}${item.href}`}
                className={`text-sm font-medium transition-colors hover:text-primary-400 ${
                  pathname === `/${locale}${item.href}`
                    ? 'text-primary-400'
                    : 'text-neutral-300'
                }`}
              >
                {t(item.name)}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <Link
              href={`/${otherLocale}${currentPath}`}
              className="flex items-center gap-1 text-sm font-medium text-neutral-300 transition-colors hover:text-primary-400"
              aria-label={`Switch to ${otherLocale === 'es' ? 'Spanish' : 'English'}`}
            >
              <GlobeAltIcon className="h-5 w-5" />
              <span className="hidden sm:inline">{otherLocale.toUpperCase()}</span>
            </Link>

            {/* Cart Icon - Hidden for sales users */}
            {!isSales && (
              <Link
                href={`/${locale}/cart`}
                className="relative text-neutral-300 transition-colors hover:text-primary-400"
                aria-label={t('cart')}
              >
                <ShoppingCartIcon className="h-6 w-6" />
                {/* Cart badge - show when items in cart */}
                {/* <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cmyk-cyan text-xs font-bold text-black">
                  0
                </span> */}
              </Link>
            )}

            {/* Notification Bell - Staff only */}
            {isStaff && <NotificationBell />}

            {/* User Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 text-neutral-300 transition-colors hover:text-primary-400"
                aria-label={t('account')}
              >
                <UserIcon className="h-6 w-6" />
                {isAuthenticated && user && (
                  <span className="hidden text-sm font-medium sm:inline">
                    {user.first_name || user.email.split('@')[0]}
                  </span>
                )}
              </button>

              {/* User Dropdown Menu */}
              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-neutral-800 bg-neutral-900 py-2 shadow-xl"
                    onMouseLeave={() => setIsUserMenuOpen(false)}
                  >
                    {isAuthenticated ? (
                      <>
                        {/* User Info */}
                        <div className="border-b border-neutral-800 px-4 pb-2 mb-2">
                          <p className="text-sm font-medium text-white">{user?.full_name || user?.email}</p>
                          <p className="text-xs text-neutral-500">{user?.role?.display_name || 'Cliente'}</p>
                        </div>

                        {/* Dashboard Options */}
                        {isStaff && (
                          <>
                            <Link
                              href={`/${locale}/dashboard`}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              <Cog6ToothIcon className="h-4 w-4" />
                              Panel de Control
                            </Link>
                            <Link
                              href={`/${locale}/dashboard/cotizaciones`}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              Cotizaciones
                            </Link>
                            <Link
                              href={`/${locale}/dashboard/pedidos`}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              Pedidos
                            </Link>
                            <Link
                              href={`/${locale}/dashboard/clientes`}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              Clientes
                            </Link>
                            <div className="my-2 border-t border-neutral-800" />
                          </>
                        )}

                        {/* Common Options */}
                        <Link
                          href={`/${locale}/mi-cuenta`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <UserIcon className="h-4 w-4" />
                          Mi Perfil
                        </Link>
                        <Link
                          href={`/${locale}/mi-cuenta/pedidos`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          Mis Pedidos
                        </Link>
                        <Link
                          href={`/${locale}/mi-cuenta/cotizaciones`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          Mis Cotizaciones
                        </Link>

                        <div className="my-2 border-t border-neutral-800" />
                        <button
                          onClick={() => {
                            logout();
                            setIsUserMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-neutral-800"
                        >
                          <ArrowRightOnRectangleIcon className="h-4 w-4" />
                          Cerrar Sesión
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href={`/${locale}/login`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          Iniciar Sesión
                        </Link>
                        <Link
                          href={`/${locale}/registro`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          Crear Cuenta
                        </Link>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="text-neutral-300 md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-md md:hidden"
          >
            <div className="container-custom py-4">
              <div className="flex flex-col gap-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={`/${locale}${item.href}`}
                    className={`rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                      pathname === `/${locale}${item.href}`
                        ? 'bg-cmyk-cyan/10 text-cmyk-cyan'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t(item.name)}
                  </Link>
                ))}

                {/* Mobile CTA Buttons */}
                <div className="mt-4 space-y-2">
                  <Link
                    href={`/${locale}/cart`}
                    className="block rounded-lg bg-red-600 px-4 py-3 text-center text-base font-bold text-white hover:bg-red-700 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <ShoppingCartIcon className="h-5 w-5 inline mr-2" />
                    {t('cart')} {itemCount > 0 && `(${itemCount})`}
                  </Link>

                  <Link
                    href={`/${locale}/catalogo`}
                    className="block rounded-lg bg-yellow-400 px-4 py-3 text-center text-base font-bold text-black hover:bg-yellow-500 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    🛒 COMPRAR AHORA
                  </Link>

                  <Link
                    href={`/${locale}/cotizar`}
                    className="block rounded-lg bg-blue-600 px-4 py-3 text-center text-base font-bold text-white hover:bg-blue-700 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    📋 {t('quote')}
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    <FloatingButtons />
    </>
  );
}
