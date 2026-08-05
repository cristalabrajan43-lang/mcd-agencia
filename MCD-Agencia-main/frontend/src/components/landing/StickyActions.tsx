'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { trackCTA } from '@/lib/tracking';
import { useCart } from '@/contexts/CartContext';

/**
 * StickyActions — Fixed right-side action buttons
 * Quote (with clean spinning cyan border + "Cotiza ya" label) + Shopping Cart + Chat toggle
 * Always visible, stacked vertically on the right edge
 */
export function StickyActions({ onChatToggle, chatState }: {
  onChatToggle: () => void;
  chatState: 'closed' | 'open' | 'minimized';
}) {
  const [showLabel, setShowLabel] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { itemCount } = useCart();
  const handleQuoteClick = () => { trackCTA('quote', 'sticky-actions'); };
  const handleCartClick = () => {
    const cartEvent = new CustomEvent('openCart');
    window.dispatchEvent(cartEvent);
  };

  // Hide "Cotiza ya" label after scrolling past the hero
  useEffect(() => {
    const onScroll = () => setShowLabel(window.scrollY < 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const style =
    chatState === 'open' && isMobile
      ? { top: '4.75rem' }
      : {
          bottom: chatState === 'open'
            ? '43.5rem'
            : chatState === 'minimized'
              ? '6.5rem'
              : '1.5rem',
        };

  return (
    <>
      {/* Spinner border animation */}
      <style jsx>{`
        @keyframes spin-border {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes float-gentle {
          0%, 100% { transform: translateX(0); }
          50%      { transform: translateX(-4px); }
        }
        .spinner-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .spinner-wrap .spinner-ring {
          position: absolute;
          inset: -2px;
          border-radius: 9999px;
          border: 2.5px solid transparent;
          border-top-color: #00e5ff;
          border-right-color: #00e5ff;
          animation: spin-border 3s linear infinite;
          filter: drop-shadow(0 0 4px rgba(0, 229, 255, 0.6));
        }
        .spinner-wrap .spinner-ring-blur {
          position: absolute;
          inset: -3px;
          border-radius: 9999px;
          border: 2.5px solid transparent;
          border-top-color: #00e5ff;
          border-right-color: #00b8d4;
          animation: spin-border 3s linear infinite;
          filter: blur(4px);
          opacity: 0.45;
        }
      `}</style>

      {/* Container — fixed right side */}
      <div
        className="sticky-actions-container fixed right-4 sm:right-6 z-[55] flex flex-col items-center gap-4 sm:gap-5 transition-all duration-300 opacity-100 pointer-events-auto"
        style={style}
      >

        {/* ─── Quote button with spinner border ──────────────────────── */}
        <div className="relative flex items-center">
          {/* "Cotiza ya" label — LEFT of button, hides on scroll */}
          <div
            className={`absolute right-full mr-3 whitespace-nowrap pointer-events-none transition-all duration-500 ${
              showLabel ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
            }`}
            style={{ animation: showLabel ? 'float-gentle 2.5s ease-in-out infinite' : 'none' }}
          >
            <div className="bg-cmyk-cyan text-white text-sm sm:text-base font-bold px-4 py-2 rounded-lg shadow-lg shadow-cmyk-cyan/30 flex items-center gap-1">
              ¡Cotiza ya!
              {/* Arrow pointing right toward button */}
              <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-b-[5px] border-l-[6px] border-transparent border-l-cmyk-cyan" />
            </div>
          </div>

          {/* Spinner border wrapper */}
          <div className="spinner-wrap">
            <div className="spinner-ring" />
            <div className="spinner-ring-blur" />
            {/* Button */}
            <a
              href="#cotizar"
              onClick={handleQuoteClick}
              className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-cmyk-cyan text-white flex items-center justify-center shadow-2xl shadow-cmyk-cyan/50 hover:scale-110 transition-transform duration-300 relative z-10"
              aria-label="Cotizar"
              title="Cotizar ahora"
            >
              {/* Flaticon: solicitud de cotización */}
              <Image
                src="/images/quote-icon.png"
                alt="Cotizar"
                width={32}
                height={32}
                className="w-7 h-7 sm:w-8 sm:h-8 brightness-0 invert"
              />
            </a>
          </div>
        </div>

        {/* ─── Shopping Cart button ───────────────────────────────────────── */}
        <button
          onClick={handleCartClick}
          className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-red-500 text-white flex items-center justify-center shadow-2xl shadow-red-500/40 hover:scale-110 hover:bg-red-400 transition-all duration-300 relative"
          aria-label="Carrito de compras"
          title={`Carrito de compras (${itemCount} producto${itemCount !== 1 ? 's' : ''})`}
        >
          {/* Shopping cart icon */}
          <svg className="w-8 h-8 sm:w-9 sm:h-9" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-0.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l0.03-.12 0.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.3.12-.47 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s0.89 2 1.99 2 2-0.9 2-2-0.9-2-2-2z" />
          </svg>
          
          {/* Pulse animation */}
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20 pointer-events-none" />
          
          {/* Badge - Item count */}
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-yellow-400 text-red-600 text-xs font-bold flex items-center justify-center shadow-lg">
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </button>

        {/* ─── Chat toggle button ────────────────────────────────────── */}
        {chatState === 'closed' && (
          <button
            onClick={onChatToggle}
            className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-yellow-400 text-neutral-900 flex items-center justify-center shadow-2xl shadow-yellow-400/30 hover:scale-110 transition-all duration-300 relative"
            aria-label="Abrir chat"
            title="Chat en línea"
          >
            <svg className="w-8 h-8 sm:w-9 sm:h-9" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white" />
            </span>
          </button>
        )}
      </div>
    </>
  );
}
