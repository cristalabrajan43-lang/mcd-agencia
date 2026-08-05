'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  UserIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  options?: Array<{ label: string; value: string }>;
}

const INITIAL_MESSAGE: Message = {
  id: '1',
  type: 'bot',
  content: '¡Hola! 👋 Soy el asistente virtual de Agencia MCD. ¿En qué puedo ayudarte?',
  timestamp: new Date(),
  options: [
    { label: '📋 Solicitar cotización', value: 'quote' },
    { label: '🛒 Información de productos', value: 'products' },
    { label: '📍 Ubicaciones y horarios', value: 'locations' },
    { label: '💬 Hablar con un asesor', value: 'human' },
  ],
};

const BOT_RESPONSES: Record<string, Message> = {
  quote: {
    id: '',
    type: 'bot',
    content: 'Para solicitar una cotización personalizada, puedo ayudarte de dos formas:',
    timestamp: new Date(),
    options: [
      { label: 'Llenar formulario de cotización', value: 'quote_form' },
      { label: 'Hablar con un asesor por WhatsApp', value: 'whatsapp' },
    ],
  },
  products: {
    id: '',
    type: 'bot',
    content: '¡Tenemos una amplia variedad de productos y servicios! ¿Qué te interesa?',
    timestamp: new Date(),
    options: [
      { label: 'Señalética y rotulación', value: 'signage' },
      { label: 'Publicidad exterior', value: 'outdoor' },
      { label: 'Impresión gran formato', value: 'printing' },
      { label: 'Ver todo el catálogo', value: 'catalog' },
    ],
  },
  locations: {
    id: '',
    type: 'bot',
    content: '📍 **Sucursal Acapulco (Principal)**\n\nDirección: Av. Costera Miguel Alemán #123, Acapulco, Guerrero\n\nHorario: Lunes a Viernes 9:00 - 18:00, Sábados 9:00 - 14:00\n\nTeléfono: (744) 123-4567',
    timestamp: new Date(),
    options: [
      { label: 'Ver en mapa', value: 'map' },
      { label: 'Llamar ahora', value: 'call' },
      { label: 'Volver al inicio', value: 'start' },
    ],
  },
  human: {
    id: '',
    type: 'bot',
    content: '¡Claro! Puedo conectarte con uno de nuestros asesores. ¿Cómo prefieres comunicarte?',
    timestamp: new Date(),
    options: [
      { label: '📱 WhatsApp', value: 'whatsapp' },
      { label: '📧 Correo electrónico', value: 'email' },
      { label: '📞 Llamada telefónica', value: 'call' },
    ],
  },
  whatsapp: {
    id: '',
    type: 'bot',
    content: '¡Perfecto! Te redirigiré a WhatsApp para hablar con un asesor. Haz clic en el botón para continuar.',
    timestamp: new Date(),
    options: [
      { label: 'Abrir WhatsApp', value: 'open_whatsapp' },
      { label: 'Volver al inicio', value: 'start' },
    ],
  },
  quote_form: {
    id: '',
    type: 'bot',
    content: 'Te llevaré al formulario de cotización donde podrás describir tu proyecto con detalle.',
    timestamp: new Date(),
    options: [
      { label: 'Ir al formulario', value: 'open_quote_form' },
      { label: 'Volver al inicio', value: 'start' },
    ],
  },
  catalog: {
    id: '',
    type: 'bot',
    content: 'Explora nuestro catálogo completo con todos nuestros productos y servicios.',
    timestamp: new Date(),
    options: [
      { label: 'Ver catálogo', value: 'open_catalog' },
      { label: 'Volver al inicio', value: 'start' },
    ],
  },
  start: {
    id: '',
    type: 'bot',
    content: '¿En qué más puedo ayudarte?',
    timestamp: new Date(),
    options: INITIAL_MESSAGE.options,
  },
};

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleOptionClick = (value: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: BOT_RESPONSES[value]?.options?.find((o) => o.value === value)?.label ||
        INITIAL_MESSAGE.options?.find((o) => o.value === value)?.label ||
        value,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Handle actions
    if (value === 'open_whatsapp') {
      window.open('https://wa.me/527441234567?text=Hola,%20quiero%20información%20sobre%20sus%20servicios', '_blank');
      return;
    }
    if (value === 'open_quote_form') {
      window.location.href = '/cotizar';
      return;
    }
    if (value === 'open_catalog') {
      window.location.href = '/catalogo';
      return;
    }
    if (value === 'call') {
      window.location.href = 'tel:+527441234567';
      return;
    }
    if (value === 'email') {
      window.location.href = 'mailto:ventas@agenciamcd.mx';
      return;
    }
    if (value === 'map') {
      window.open('https://maps.google.com/?q=Agencia+MCD+Acapulco', '_blank');
      return;
    }

    // Show typing indicator
    setIsTyping(true);

    // Simulate bot response delay
    setTimeout(() => {
      setIsTyping(false);
      const response = BOT_RESPONSES[value] || BOT_RESPONSES.start;
      const botMessage: Message = {
        ...response,
        id: Date.now().toString(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 800);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // Show typing indicator
    setIsTyping(true);

    // Simulate bot response
    setTimeout(() => {
      setIsTyping(false);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'Gracias por tu mensaje. Para brindarte una mejor atención, te recomiendo hablar con uno de nuestros asesores.',
        timestamp: new Date(),
        options: [
          { label: '📱 Contactar por WhatsApp', value: 'whatsapp' },
          { label: '📋 Solicitar cotización', value: 'quote' },
          { label: 'Volver al inicio', value: 'start' },
        ],
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 1000);
  };

  return (
    <>
      {/* Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 text-black shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
          >
            <ChatBubbleLeftRightIcon className="h-7 w-7" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: isMinimized ? 'auto' : 'min(500px, calc(100dvh - 100px))',
            }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-48px)] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-black">Asistente MCD</h3>
                  <p className="text-xs text-black/70">Siempre disponible</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
                >
                  <MinusIcon className="h-5 w-5 text-black" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-black" />
                </button>
              </div>
            </div>

            {/* Messages */}
            {!isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        message.type === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-4 py-2',
                          message.type === 'user'
                            ? 'bg-cmyk-cyan text-black rounded-br-sm'
                            : 'bg-neutral-800 text-white rounded-bl-sm'
                        )}
                      >
                        <p className="text-sm whitespace-pre-line">{message.content}</p>

                        {/* Options */}
                        {message.options && (
                          <div className="mt-3 space-y-2">
                            {message.options.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => handleOptionClick(option.value)}
                                className="block w-full text-left text-sm px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition-colors"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-neutral-800 rounded-2xl rounded-bl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                          <span className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-neutral-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Escribe un mensaje..."
                      className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <Button onClick={handleSendMessage} disabled={!inputValue.trim()}>
                      <PaperAirplaneIcon className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
