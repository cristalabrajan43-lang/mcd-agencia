'use client';

/**
 * Floating Buttons Component
 *
 * Sticky floating buttons for mobile showing:
 * - Quote (Cotizar) - with spinner effect
 * - WhatsApp - with ping animation
 * - AI Chat - with notification dot
 *
 * @module components/layout/FloatingButtons
 */

import { motion } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';

export function FloatingButtons() {
  const handleCotizarClick = () => {
    const cotizarSection = document.getElementById('cotizar');
    if (cotizarSection) {
      cotizarSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCartClick = () => {
    const cartEvent = new CustomEvent('openCart');
    window.dispatchEvent(cartEvent);
  };

  const handleChatClick = () => {
    const chatbotEvent = new CustomEvent('openChatbot');
    window.dispatchEvent(chatbotEvent);
  };

  return (
    <>
      {/* Mobile Floating Buttons Container - Matches inspector structure */}
      <div className="sticky-actions-container fixed right-4 sm:right-6 z-[55] flex flex-col items-center gap-4 sm:gap-5 transition-all duration-300 opacity-100 pointer-events-auto" style={{ bottom: '1.5rem' }}>
        
        {/* Cotizar Button with Spinner Effect */}
        <div className="relative flex items-center">
          {/* Tooltip */}
          <div className="absolute right-full mr-3 whitespace-nowrap pointer-events-none transition-all duration-500 opacity-0 translate-x-4">
            <div className="bg-cmyk-cyan text-white text-sm sm:text-base font-bold px-4 py-2 rounded-lg shadow-lg shadow-cmyk-cyan/30 flex items-center gap-1">
              ¡Cotiza ya!
              <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-b-[5px] border-l-[6px] border-transparent border-l-cmyk-cyan"></div>
            </div>
          </div>

          {/* Spinner wrap */}
          <div className="spinner-wrap relative">
            <div className="spinner-ring absolute inset-0 rounded-full border-2 border-transparent border-t-cmyk-cyan border-r-cmyk-cyan animate-spin"></div>
            <div className="spinner-ring-blur absolute inset-0 rounded-full border-2 border-transparent border-t-cmyk-cyan/20 blur-sm animate-spin" style={{ animationDirection: 'reverse' }}></div>
            
            <motion.a
              href="#cotizar"
              onClick={handleCotizarClick}
              aria-label="Cotizar"
              title="Cotizar ahora"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="relative z-10 w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-cmyk-cyan text-white flex items-center justify-center shadow-2xl shadow-cmyk-cyan/50 hover:scale-110 transition-transform duration-300"
            >
              <DocumentTextIcon className="w-7 h-7 sm:w-8 sm:h-8" />
            </motion.a>
          </div>
        </div>

        {/* Shopping Cart Button with Ping Effect */}
        <motion.button
          onClick={handleCartClick}
          aria-label="Carrito"
          title="Carrito de compras"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-red-500 text-white flex items-center justify-center shadow-2xl shadow-red-500/40 hover:bg-red-400 transition-all duration-300"
        >
          <ShoppingCartIcon className="w-8 h-8 sm:w-9 sm:h-9" />
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20 pointer-events-none"></span>
        </motion.button>

        {/* Chat Button with Notification Dot */}
        <motion.button
          onClick={handleChatClick}
          aria-label="Abrir chat"
          title="Chat en línea"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-yellow-400 text-neutral-900 flex items-center justify-center shadow-2xl shadow-yellow-400/30 hover:scale-110 transition-all duration-300"
        >
          <ChatBubbleLeftRightIcon className="w-8 h-8 sm:w-9 sm:h-9" />
          {/* Notification Dot */}
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white"></span>
          </span>
        </motion.button>
      </div>
    </>
  );
}
