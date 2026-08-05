'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, User, ExternalLink, Minus } from 'lucide-react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  messageId?: string;          // backend UUID for feedback
  source?: 'predefined' | 'ai' | 'fallback' | 'error_fallback';
  suggestions?: string[];
  whatsappLinks?: { acapulco: string; tecoanapa: string };
}

interface QuickAction {
  id: string;
  label: string;
  message: string;
}

interface ChatConfig {
  name: string;
  welcome_message: string;
  is_active: boolean;
  quick_actions: QuickAction[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const STORAGE_KEY = 'mcd_chat_state';
const MAX_MESSAGE_LENGTH = 1000;
const DETACH_FROM_BOTTOM_PX = 320;
const REATTACH_TO_BOTTOM_PX = 120;
const CHAT_REQUEST_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLocaleFromPath(): string {
  if (typeof window === 'undefined') return 'es';
  return window.location.pathname.startsWith('/en') ? 'en' : 'es';
}

/** Convert plain-text URLs into clickable <a> elements. */
function renderContent(text: string) {
  const urlRegex = /(https?:\/\/[^\s,)]+)/g;
  const singleUrlRegex = /^https?:\/\/[^\s,)]+$/i;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    singleUrlRegex.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-cyan-400 hover:text-cyan-300 break-all"
      >
        {part.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 40)}
        {part.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').length > 40 ? '…' : ''}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/** Save chat state to localStorage. */
function saveState(sessionId: string, messages: Message[]) {
  try {
    const payload = {
      sessionId,
      messages: messages.map(m => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      })),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { /* quota exceeded — ignore */ }
}

/** Restore chat state from localStorage (max 24h old). */
function loadState(): { sessionId: string; messages: Message[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expire after 24 hours
    if (Date.now() - new Date(data.savedAt).getTime() > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      sessionId: data.sessionId,
      messages: data.messages.map((m: Message & { timestamp: string }) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    };
  } catch {
    return null;
  }
}

interface ChatWidgetProps {
  /** When provided, controls open state externally */
  externalOpen?: boolean;
  /** Callback when open state changes (for external control) */
  onOpenChange?: (open: boolean) => void;
  /** Callback for the full chat UI state so other floating elements can reposition */
  onStateChange?: (state: { open: boolean; minimized: boolean }) => void;
}

export default function ChatWidget({ externalOpen, onOpenChange, onStateChange }: ChatWidgetProps = {}) {
  const [locale, setLocale] = useState('es');
  const [internalOpen, setInternalOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileViewportHeight, setMobileViewportHeight] = useState<number | null>(null);

  // Use external control when props are provided
  const isExternallyControlled = externalOpen !== undefined;
  const isOpen = isExternallyControlled ? externalOpen : internalOpen;
  const setIsOpen = (open: boolean) => {
    if (isExternallyControlled && onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [showWhatsAppOptions, setShowWhatsAppOptions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const bodyLockRef = useRef<{ overflow: string; overscrollBehavior: string; htmlOverscrollBehavior: string } | null>(null);
  const stickToBottomWhileTypingRef = useRef(false);

  const getDistanceToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return 0;
    return container.scrollHeight - container.scrollTop - container.clientHeight;
  }, []);

  const isFarFromBottom = useCallback(() => {
    return getDistanceToBottom() > DETACH_FROM_BOTTOM_PX;
  }, [getDistanceToBottom]);

  const shouldAutoScrollToBottom = useCallback(() => {
    if (messages.length <= 1) return true;
    if (stickToBottomWhileTypingRef.current) return true;
    return !isFarFromBottom();
  }, [messages.length, isFarFromBottom]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!shouldAutoScrollToBottom()) return;
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [shouldAutoScrollToBottom]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isMobile || !isOpen || typeof window === 'undefined') {
      setMobileViewportHeight(null);
      return;
    }

    const vv = window.visualViewport;
    const update = () => {
      if (!window.visualViewport) return;
      setMobileViewportHeight(Math.round(window.visualViewport.height));
    };

    update();

    if (!vv) return;

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (!isOpen || isMinimized) return;
    // On open, start with chat pinned to latest message.
    stickToBottomWhileTypingRef.current = false;
    requestAnimationFrame(() => scrollToBottom('auto'));
  }, [isOpen, isMinimized, scrollToBottom]);

  useEffect(() => {
    if (!isOpen || isMinimized) return;
    // Keyboard/viewport changes should only autoscroll when user is at start or already near bottom.
    scrollToBottom('auto');
  }, [mobileViewportHeight, isOpen, isMinimized, scrollToBottom]);

  useEffect(() => {
    onStateChange?.({ open: isOpen, minimized: isMinimized });
  }, [isOpen, isMinimized, onStateChange]);

  useEffect(() => {
    if (!isOpen && isMinimized) {
      setIsMinimized(false);
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    const shouldLockPage = isOpen && isMobile;

    if (!shouldLockPage) {
      if (typeof document !== 'undefined') {
        delete document.body.dataset.chatOpen;
      }
      if (bodyLockRef.current) {
        document.body.style.overflow = bodyLockRef.current.overflow;
        document.body.style.overscrollBehavior = bodyLockRef.current.overscrollBehavior;
        document.documentElement.style.overscrollBehavior = bodyLockRef.current.htmlOverscrollBehavior;
        bodyLockRef.current = null;
      }
      return;
    }

    bodyLockRef.current = {
      overflow: document.body.style.overflow,
      overscrollBehavior: document.body.style.overscrollBehavior,
      htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
    };
    if (typeof document !== 'undefined') {
      document.body.dataset.chatOpen = 'true';
    }
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      if (typeof document !== 'undefined') {
        delete document.body.dataset.chatOpen;
      }
      if (!bodyLockRef.current) return;
      document.body.style.overflow = bodyLockRef.current.overflow;
      document.body.style.overscrollBehavior = bodyLockRef.current.overscrollBehavior;
      document.documentElement.style.overscrollBehavior = bodyLockRef.current.htmlOverscrollBehavior;
      bodyLockRef.current = null;
    };
  }, [isOpen, isMobile, isMinimized]);

  // ---- Translations ----
  const t = {
    es: {
      title: 'Asistente Virtual',
      subtitle: 'En linea ahora',
      placeholder: 'Escribe tu mensaje...',
      send: 'Enviar',
      whatsappTitle: 'Continuar por WhatsApp',
      whatsappAcapulco: 'WhatsApp Acapulco',
      whatsappTecoanapa: 'WhatsApp Tecoanapa',
      close: 'Cerrar',
      minimize: 'Minimizar',
      poweredBy: 'Asistente IA · MCD',
      welcomeDefault: '¡Hola! 👋 Soy el asistente virtual de Agencia MCD. ¿En qué puedo ayudarte?',
      charCount: (n: number) => `${n}/${MAX_MESSAGE_LENGTH}`,
      newChat: 'Nueva conversación',
      quickActionsTitle: 'Acciones frecuentes',
      quickActionsHint: 'Toca una opción para comenzar más rápido',
      suggestionsTitle: 'Sugerencias',
    },
    en: {
      title: 'Virtual Assistant',
      subtitle: 'Online now',
      placeholder: 'Type your message...',
      send: 'Send',
      whatsappTitle: 'Continue on WhatsApp',
      whatsappAcapulco: 'WhatsApp Acapulco',
      whatsappTecoanapa: 'WhatsApp Tecoanapa',
      close: 'Close',
      minimize: 'Minimize',
      poweredBy: 'AI Assistant · MCD',
      welcomeDefault: "Hello! 👋 I'm the virtual assistant of Agencia MCD. How can I help you?",
      charCount: (n: number) => `${n}/${MAX_MESSAGE_LENGTH}`,
      newChat: 'New conversation',
      quickActionsTitle: 'Common actions',
      quickActionsHint: 'Tap an option to get started faster',
      suggestionsTitle: 'Suggestions',
    },
  };
  const texts = t[locale as keyof typeof t] || t.es;

  // ---- Initialize: locale + restore from localStorage ----
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const detectedLocale = getLocaleFromPath();
    setLocale(detectedLocale);
    const saved = loadState();
    if (saved) {
      setSessionId(saved.sessionId);
      setMessages(saved.messages);
    } else {
      setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    }
  }, []);

  // ---- Load config ----
  useEffect(() => {
    if (!locale) return;
    const loadConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/chatbot/web-chat/config/?language=${locale}`);
        if (res.ok) { setConfig(await res.json()); return; }
      } catch { /* ignore */ }
      setConfig({
        name: 'Agencia MCD Bot',
        welcome_message: texts.welcomeDefault,
        is_active: true,
        quick_actions: [
          { id: 'services', label: locale === 'es' ? '🎨 Servicios' : '🎨 Services', message: locale === 'es' ? '¿Qué servicios ofrecen?' : 'What services do you offer?' },
          { id: 'quote', label: locale === 'es' ? '📋 Cotizar' : '📋 Quote', message: locale === 'es' ? 'Quiero solicitar una cotización' : 'I want to request a quote' },
          { id: 'location', label: locale === 'es' ? '📍 Ubicación' : '📍 Location', message: locale === 'es' ? '¿Dónde están ubicados?' : 'Where are you located?' },
          { id: 'faq_delivery', label: locale === 'es' ? '🚚 Entregas' : '🚚 Delivery', message: locale === 'es' ? '¿Cuáles son los tiempos de entrega?' : 'What are the delivery times?' },
          { id: 'faq_payment', label: locale === 'es' ? '💳 Pagos' : '💳 Payment', message: locale === 'es' ? '¿Qué métodos de pago aceptan?' : 'What payment methods do you accept?' },
          { id: 'faq_formats', label: locale === 'es' ? '📐 Formatos' : '📐 Formats', message: locale === 'es' ? '¿Qué formatos de archivo aceptan?' : 'What file formats do you accept?' },
          { id: 'faq_warranty', label: locale === 'es' ? '🛡️ Garantía' : '🛡️ Warranty', message: locale === 'es' ? '¿Ofrecen garantía en sus productos?' : 'Do you offer warranty on products?' },
          { id: 'faq_hours', label: locale === 'es' ? '🕐 Horarios' : '🕐 Hours', message: locale === 'es' ? '¿Cuál es su horario de atención?' : 'What are your business hours?' },
        ],
      });
    };
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // ---- Welcome message when opened with no history ----
  useEffect(() => {
    if (isOpen && messages.length === 0 && config) {
      setMessages([{
        id: 'welcome', role: 'assistant', content: config.welcome_message,
        timestamp: new Date(), source: 'predefined',
      }]);
    }
  }, [isOpen, config, messages.length]);

  // ---- Persist to localStorage on message change ----
  useEffect(() => {
    if (sessionId && messages.length > 0) saveState(sessionId, messages);
  }, [messages, sessionId]);

  // ---- Scroll to bottom ----
  useEffect(() => {
    if (!isOpen || isMinimized) return;
    scrollToBottom(messages.length <= 1 ? 'auto' : 'smooth');
  }, [messages, isLoading, isOpen, isMinimized, scrollToBottom]);

  // ---- Focus input ----
  useEffect(() => {
    if (isOpen && !isMinimized) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen, isMinimized]);

  const handleInputFocus = useCallback(() => {
    if (!isOpen || isMinimized) return;
    const shouldStick = !isFarFromBottom();
    stickToBottomWhileTypingRef.current = shouldStick;

    if (!shouldStick) return;

    // Keyboard open can shift layout after focus; do an immediate and delayed snap.
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 140);
  }, [isOpen, isMinimized, isFarFromBottom]);

  const handleInputBlur = useCallback(() => {
    stickToBottomWhileTypingRef.current = false;
  }, []);

  // ---- Send message ----
  const sendMessage = useCallback(async (messageText: string) => {
    const trimmed = messageText.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed || isLoading) return;

    setMessages(prev => [...prev, {
      id: `user_${Date.now()}`, role: 'user', content: trimmed, timestamp: new Date(),
    }]);
    setInputValue('');
    setIsLoading(true);
    setShowWhatsAppOptions(false);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const history = messages.slice(-8).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content,
      }));

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);

      const res = await fetch(`${API_BASE_URL}/chatbot/web-chat/message/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ message: trimmed, session_id: sessionId, language: locale, history }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessages(prev => [...prev, {
        id: `assistant_${Date.now()}`, role: 'assistant', content: data.message,
        messageId: data.message_id, timestamp: new Date(), source: data.source,
        suggestions: data.suggestions || [],
        whatsappLinks: data.whatsapp_links,
      }]);
      if (data.should_escalate) setShowWhatsAppOptions(true);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        id: `fallback_${Date.now()}`, role: 'assistant',
        content: locale === 'es'
          ? '¡Gracias por tu mensaje! Por el momento no puedo conectarme. Te invito a contactarnos por WhatsApp para una atención inmediata.'
          : "Thanks for your message! I'm currently unable to connect. Please contact us via WhatsApp for immediate assistance.",
        timestamp: new Date(), source: 'error_fallback',
        whatsappLinks: { acapulco: 'https://wa.me/527446887382', tecoanapa: 'https://wa.me/527451147727' },
      }]);
      setShowWhatsAppOptions(true);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [isLoading, messages, sessionId, locale]);

  // ---- New conversation ----
  const handleNewChat = useCallback(() => {
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    setMessages([]); setShowWhatsAppOptions(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(inputValue); };
  const handleQuickAction = (action: QuickAction) => sendMessage(action.message);
  const handleSuggestion = (s: string) => sendMessage(s);
  const formatTime = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const lastBotMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.suggestions && m.suggestions.length > 0);
  const showSuggestions = !isLoading && !!lastBotMsg && messages.length > 1;
  const showQuickActionsInThread = messages.length <= 1 && !!config?.quick_actions?.length;

  return (
    <>
      {/* Chat Button — only shown when NOT externally controlled */}
      {!isExternallyControlled && (
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          className={`fixed bottom-24 right-6 z-40 w-14 h-14 bg-cmyk-cyan hover:bg-cmyk-cyan rounded-full shadow-2xl transform hover:scale-110 transition-all duration-300 ${isOpen ? 'hidden' : 'flex'} items-center justify-center`}
          aria-label="Abrir chat"
        >
          <ChatBubbleLeftRightIcon className="w-10 h-10 text-white" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white" />
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-0 z-[58] flex items-end justify-end p-0 sm:p-6 pointer-events-none">
          <div
            className={`pointer-events-auto relative flex flex-col overflow-hidden border border-slate-200/70 bg-white shadow-2xl animate-in slide-in-from-bottom-5 duration-300 ${
              isMobile
                ? 'w-full rounded-none'
                : isMinimized
                  ? 'w-[390px] max-w-[calc(100vw-48px)] rounded-2xl h-auto'
                  : 'w-[390px] max-w-[calc(100vw-48px)] rounded-2xl h-[640px] max-h-[calc(100vh-60px)]'
            }`}
            style={isMobile ? { height: mobileViewportHeight ? `${mobileViewportHeight}px` : '100dvh' } : undefined}
          >

          {/* Header */}
          <div className="bg-slate-950 text-white px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-slate-800" style={{ paddingTop: isMobile ? 'max(0.75rem, env(safe-area-inset-top))' : undefined }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cmyk-cyan/20 rounded-full flex items-center justify-center overflow-hidden ring-1 ring-cmyk-cyan/40">
                <ChatBubbleLeftRightIcon className="w-8 h-8 text-cmyk-cyan" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{texts.title}</h3>
                <p className="text-[11px] text-emerald-300">{texts.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button onClick={handleNewChat} className="p-2 hover:bg-white/15 rounded-full transition-colors" aria-label={texts.newChat} title={texts.newChat}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => {
                  if (isMobile) {
                    setIsMinimized(false);
                    setIsOpen(false);
                    return;
                  }
                  setIsMinimized(!isMinimized);
                }}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                aria-label={texts.minimize}
              >
                <Minus className="w-4 h-4" />
              </button>
              <button onClick={() => { setIsMinimized(false); setIsOpen(false); }} className="p-2 hover:bg-white/15 rounded-full transition-colors" aria-label={texts.close}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y bg-slate-50"
              >
                <div className="flex flex-col p-4 gap-4">
                    {messages.map((message, index) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex items-end gap-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${message.role === 'user' ? 'bg-cmyk-cyan text-white' : 'bg-slate-900 text-white'}`}>
                          {message.role === 'user' ? <User className="w-4 h-4" /> : <ChatBubbleLeftRightIcon className="w-7 h-7 text-white" />}
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className={`rounded-2xl px-4 py-2.5 ${message.role === 'user' ? 'bg-cmyk-cyan text-white rounded-br-sm' : 'bg-white text-slate-800 shadow-sm border border-slate-200 rounded-bl-sm'}`}>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {message.role === 'assistant' ? renderContent(message.content) : message.content}
                            </p>
                            <p className={`text-[10px] mt-1 ${message.role === 'user' ? 'text-white/70' : 'text-slate-500'}`}>
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex items-end gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center overflow-hidden">
                          <ChatBubbleLeftRightIcon className="w-7 h-7 text-white" />
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm rounded-bl-sm">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* WhatsApp escalation */}
                  {showWhatsAppOptions && messages.length > 0 && (
                    <div className="bg-gray-700 rounded-xl p-4 shadow-sm border border-gray-600">
                      <p className="text-sm font-medium text-gray-100 mb-3">{texts.whatsappTitle}</p>
                      <div className="flex flex-col gap-2">
                        {(['acapulco', 'tecoanapa'] as const).map(branch => (
                          <a key={branch} href={messages[messages.length - 1]?.whatsappLinks?.[branch] || `https://wa.me/${branch === 'acapulco' ? '527446887382' : '527451147727'}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium">
                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            {branch === 'acapulco' ? texts.whatsappAcapulco : texts.whatsappTecoanapa}
                            <ExternalLink className="w-4 h-4 ml-auto flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {showQuickActionsInThread && config?.quick_actions && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                        {texts.quickActionsTitle}
                      </p>
                      <p className="text-xs text-slate-500 mb-3">
                        {texts.quickActionsHint}
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {config.quick_actions.slice(0, 5).map((action) => (
                          <button
                            key={action.id}
                            onClick={() => handleQuickAction(action)}
                            className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showSuggestions && lastBotMsg && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        {texts.suggestionsTitle}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {lastBotMsg.suggestions!.slice(0, 4).map((s, i) => (
                          <button
                            key={i}
                            onClick={() => handleSuggestion(s)}
                            className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs text-slate-700 hover:bg-slate-200 hover:border-slate-300 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-200 flex-shrink-0" style={{ paddingBottom: isMobile ? 'max(0.75rem, env(safe-area-inset-bottom))' : undefined }}>
                <div className="flex gap-2 items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder={texts.placeholder}
                    maxLength={MAX_MESSAGE_LENGTH}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-900 placeholder-slate-400 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-cmyk-cyan focus:bg-white border border-slate-200 transition-all"
                    disabled={isLoading}
                  />
                  <button type="submit" disabled={!inputValue.trim() || isLoading} className="p-2.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" aria-label={texts.send}>
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                {inputValue.length > MAX_MESSAGE_LENGTH * 0.8 && (
                  <p className={`text-[10px] mt-1 text-right ${inputValue.length >= MAX_MESSAGE_LENGTH ? 'text-red-500' : 'text-slate-500'}`}>
                    {texts.charCount(inputValue.length)}
                  </p>
                )}
              </form>
            </>
          )}
          </div>
        </div>
      )}
    </>
  );
}
