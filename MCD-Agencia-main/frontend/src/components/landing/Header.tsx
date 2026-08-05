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
import {
  ShoppingCartIcon,
  UserIcon,
  GlobeAltIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

export function Header() {
  const t = useTranslations('landing.header');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount } = useCart();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Check user role - 3 roles: admin, sales, customer
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
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleWhatsAppClick = () => {
    trackCTA('whatsapp', 'header');
  };

  const handleQuoteClick = () => {
    trackCTA('quote', 'header');
  };

  const navLinks = [
    { href: '#', label: t('nav.home') },
    { href: '#servicios', label: t('nav.services') },
    { href: '#portafolio', label: t('nav.portfolio') },
    { href: '#clientes', label: t('nav.clients') },
    { href: '#faq', label: t('nav.faq') },
    { href: '#ubicaciones', label: t('nav.contact') },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 lg:left-64 z-[60] transition-all duration-300 ${
        isScrolled
          ? 'bg-cmyk-black shadow-lg py-3 border-b border-cmyk-cyan/20'
          : 'bg-cmyk-black/95 backdrop-blur-sm py-4 border-b border-cmyk-cyan/10'
      }`}
    >
      <div className="container-custom px-4 sm:px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 mr-8">
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
            <div className="hidden sm:block">
              <span className="text-xl font-bold text-white">Agencia MCD</span>
              <p className="text-xs text-gray-400">Acapulco</p>
            </div>
          </Link>

          {/* Navigation Desktop */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-white hover:text-cmyk-cyan transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTAs Desktop */}
          <div className="hidden lg:flex items-center space-x-4">
            {/* WhatsApp */}
            <a
              href={CONTACT_INFO.whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsAppClick}
              className="text-green-600 hover:text-green-700 transition-colors p-2"
              aria-label="Contactar por WhatsApp"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </a>

            {/* Language Switcher */}
            <button
              onClick={() => {
                const newPathname = pathname.replace(`/${locale}`, `/${otherLocale}`);
                router.push(newPathname);
              }}
              className="p-2 text-gray-300 hover:text-cmyk-cyan transition-colors flex items-center gap-1"
              aria-label={t('changeLanguage')}
            >
              <GlobeAltIcon className="w-5 h-5" />
              <span className="text-sm font-medium uppercase">{otherLocale}</span>
            </button>

            {/* Cart - Hidden for sales users */}
            {isAuthenticated && !isSales && (
              <Link
                href={`/${locale}/cart`}
                className="relative p-2 text-gray-300 hover:text-cmyk-cyan transition-colors"
                aria-label="Carrito"
              >
                <ShoppingCartIcon className="w-6 h-6" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-cmyk-magenta text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>
            )}

            {/* User Menu / Auth Buttons */}
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-2 text-gray-300 hover:text-cmyk-cyan transition-colors"
                >
                  <UserCircleIcon className="w-6 h-6" />
                  <span className="text-sm font-medium max-w-[100px] truncate">
                    {user?.first_name || user?.email?.split('@')[0]}
                  </span>
                  <ChevronDownIcon className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-neutral-700">
                      <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                      <p className="text-xs text-gray-400 capitalize">{user?.role?.name || 'Cliente'}</p>
                    </div>
                    
                    <Link
                      href={`/${locale}/profile`}
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    >
                      <UserIcon className="w-4 h-4" />
                      {t('profile')}
                    </Link>
                    
                    <Link
                      href={`/${locale}/orders`}
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    >
                      <ClipboardDocumentListIcon className="w-4 h-4" />
                      {t('myOrders')}
                    </Link>

                    {isStaff && (
                      <>
                        <div className="border-t border-neutral-700 my-1"></div>
                        <Link
                          href={`/${locale}/dashboard`}
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-cmyk-cyan hover:bg-neutral-800 transition-colors"
                        >
                          <Cog6ToothIcon className="w-4 h-4" />
                          Panel de Control
                        </Link>
                        <Link
                          href={`/${locale}/dashboard/cotizaciones`}
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors"
                        >
                          <ClipboardDocumentListIcon className="w-4 h-4" />
                          Cotizaciones
                        </Link>
                        <Link
                          href={`/${locale}/dashboard/pedidos`}
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors"
                        >
                          <ClipboardDocumentListIcon className="w-4 h-4" />
                          Pedidos
                        </Link>
                        <Link
                          href={`/${locale}/dashboard/clientes`}
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors"
                        >
                          <UserIcon className="w-4 h-4" />
                          Clientes
                        </Link>
                      </>
                    )}

                    <div className="border-t border-neutral-700 my-1"></div>
                    <button
                      onClick={() => {
                        logout();
                        setIsUserMenuOpen(false);
                        router.push(`/${locale}`);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-neutral-800 transition-colors"
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4" />
                      {t('logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href={`/${locale}/login`}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  {t('login')}
                </Link>
              </div>
            )}

            <a
              href="#cotizar"
              onClick={handleQuoteClick}
              className="btn-primary"
            >
              {t('quote')}
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-white hover:text-cmyk-cyan transition-colors"
            aria-label="Menú"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-cmyk-cyan/20 pt-4 px-4 animate-fade-in">
            <nav className="flex flex-col space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-white hover:text-cmyk-cyan transition-colors font-medium py-2"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Mobile Auth Section */}
            <div className="mt-4 pt-4 border-t border-neutral-700">
              {isAuthenticated ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-2 py-2">
                    <UserCircleIcon className="w-8 h-8 text-cmyk-cyan" />
                    <div>
                      <p className="text-white font-medium">{user?.first_name || user?.email?.split('@')[0]}</p>
                      <p className="text-xs text-gray-400 capitalize">{user?.role?.name || 'Cliente'}</p>
                    </div>
                  </div>
                  
                  {/* Cart - Hidden for sales */}
                  {!isSales && (
                    <Link
                      href={`/${locale}/cart`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white"
                    >
                      <ShoppingCartIcon className="w-5 h-5" />
                      {t('nav.cart')} {itemCount > 0 && <span className="bg-cmyk-magenta text-white text-xs px-2 py-0.5 rounded-full">{itemCount}</span>}
                    </Link>
                  )}

                  <Link
                    href={`/${locale}/profile`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white"
                  >
                    <UserIcon className="w-5 h-5" />
                    {t('profile')}
                  </Link>

                  {/* Orders - Hidden for sales (they have their own panel) */}
                  {!isSales && (
                    <Link
                      href={`/${locale}/orders`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white"
                    >
                      <ClipboardDocumentListIcon className="w-5 h-5" />
                      {t('myOrders')}
                    </Link>
                  )}

                  {/* Dashboard Panel */}
                  {isStaff && (
                    <>
                      <Link
                        href={`/${locale}/dashboard`}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-2 py-2 text-cmyk-cyan hover:text-white"
                      >
                        <Cog6ToothIcon className="w-5 h-5" />
                        Panel de Control
                      </Link>
                      <Link
                        href={`/${locale}/dashboard/cotizaciones`}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white"
                      >
                        <ClipboardDocumentListIcon className="w-5 h-5" />
                        Cotizaciones
                      </Link>
                      <Link
                        href={`/${locale}/dashboard/pedidos`}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white"
                      >
                        <ClipboardDocumentListIcon className="w-5 h-5" />
                        Pedidos
                      </Link>
                      <Link
                        href={`/${locale}/dashboard/clientes`}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-2 py-2 text-gray-300 hover:text-white"
                      >
                        <UserIcon className="w-5 h-5" />
                        Clientes
                      </Link>
                    </>
                  )}

                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                      router.push(`/${locale}`);
                    }}
                    className="flex items-center gap-3 w-full px-2 py-2 text-red-400 hover:text-red-300"
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href={`/${locale}/login`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full text-center px-4 py-2 text-gray-300 hover:text-white border border-neutral-700 rounded-lg"
                  >
                    {t('login')}
                  </Link>
                </div>
              )}
            </div>

            {/* Language Switcher Mobile */}
            <button
              onClick={() => {
                const newPathname = pathname.replace(`/${locale}`, `/${otherLocale}`);
                router.push(newPathname);
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 mt-4 px-2 py-2 text-gray-300 hover:text-cmyk-cyan"
            >
              <GlobeAltIcon className="w-5 h-5" />
              {otherLocale === 'en' ? 'English' : 'Español'}
            </button>

            <div className="mt-4 space-y-3">
              <a
                href={CONTACT_INFO.whatsapp.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  handleWhatsAppClick();
                  setIsMobileMenuOpen(false);
                }}
                className="btn-whatsapp w-full"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                WhatsApp
              </a>
              <a
                href="#cotizar"
                onClick={() => {
                  handleQuoteClick();
                  setIsMobileMenuOpen(false);
                }}
                className="btn-primary w-full"
              >
                {t('quote')}
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
