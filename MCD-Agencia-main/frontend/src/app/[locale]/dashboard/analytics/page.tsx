'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import {
  EyeIcon,
  UsersIcon,
  CursorArrowRaysIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  DeviceTabletIcon,
  ArrowTrendingUpIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingPage, Spinner } from '@/components/ui';
import { apiClient } from '@/lib/api/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  period_days: number;
  page_views: {
    total: number;
    unique_sessions: number;
    by_day: { date: string; views: number }[];
    top_pages: { page_path: string; views: number }[];
    devices: { device_type: string; count: number }[];
  };
  events: {
    top: { event_name: string; count: number }[];
    ctas: { event_name: string; count: number }[];
    quote_funnel: Record<string, number>;
  };
  traffic_sources: { utm_source: string; count: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: 7, label: '7 días' },
  { value: 14, label: '14 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
];

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  desktop: <ComputerDesktopIcon className="h-5 w-5" />,
  mobile: <DevicePhoneMobileIcon className="h-5 w-5" />,
  tablet: <DeviceTabletIcon className="h-5 w-5" />,
};

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'Escritorio',
  mobile: 'Móvil',
  tablet: 'Tablet',
};

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Vistas de página',
  cta_click_quote: 'Click Cotizar',
  cta_click_whatsapp: 'Click WhatsApp',
  cta_click_call: 'Click Llamar',
  quote_form_start: 'Inicio cotización',
  quote_form_submit: 'Cotización enviada',
  quote_form_error: 'Error en cotización',
  quote_form_abandon: 'Cotización abandonada',
  service_card_open: 'Abrir servicio',
  add_to_cart: 'Agregar al carrito',
  checkout_start: 'Inicio checkout',
  checkout_complete: 'Compra completada',
  scroll_depth: 'Scroll depth',
  chat_open: 'Abrir chat',
  login: 'Login',
  signup: 'Registro',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('es-MX');
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const locale = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const permissions = usePermissions();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !permissions.canViewLeads) return;

    setLoading(true);
    setError('');
    apiClient
      .get<AnalyticsSummary>(`/analytics/summary/?days=${days}`)
      .then((data) => setData(data))
      .catch(() => setError('Error al cargar datos de analítica'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, permissions.canViewLeads, days]);

  if (authLoading) return <LoadingPage message="Cargando..." />;
  if (!isAuthenticated || !permissions.canViewLeads) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analítica del Sitio</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Rendimiento, tráfico y comportamiento de usuarios
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-neutral-800 border border-neutral-700 text-white rounded-lg px-3 py-2 text-sm w-40"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── KPI Cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<EyeIcon className="h-6 w-6 text-cmyk-cyan" />}
              label="Vistas de Página"
              value={formatNumber(data.page_views.total)}
            />
            <StatCard
              icon={<UsersIcon className="h-6 w-6 text-cmyk-magenta" />}
              label="Sesiones Únicas"
              value={formatNumber(data.page_views.unique_sessions)}
            />
            <StatCard
              icon={<CursorArrowRaysIcon className="h-6 w-6 text-cmyk-yellow" />}
              label="Clicks en CTAs"
              value={formatNumber(data.events.ctas.reduce((s, c) => s + c.count, 0))}
            />
            <StatCard
              icon={<ArrowTrendingUpIcon className="h-6 w-6 text-green-400" />}
              label="Cotizaciones Enviadas"
              value={formatNumber(data.events.quote_funnel.quote_form_submit || 0)}
            />
          </div>

          {/* ── Two column layout ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily views chart (simple bar) */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <h2 className="text-white font-semibold">Vistas por Día</h2>
              {data.page_views.by_day.length > 0 ? (
                <div className="space-y-1.5">
                  {data.page_views.by_day.slice(-14).map((d) => {
                    const maxViews = Math.max(...data.page_views.by_day.map((x) => x.views), 1);
                    const pct = (d.views / maxViews) * 100;
                    return (
                      <div key={d.date} className="flex items-center gap-3 text-sm">
                        <span className="text-neutral-400 w-20 flex-shrink-0">
                          {new Date(d.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                        </span>
                        <div className="flex-1 bg-neutral-800 rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-cmyk-cyan h-full rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-white w-12 text-right">{d.views}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState text="Sin datos en este período" />
              )}
            </div>

            {/* Top pages */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <h2 className="text-white font-semibold">Páginas Más Visitadas</h2>
              {data.page_views.top_pages.length > 0 ? (
                <div className="space-y-2">
                  {data.page_views.top_pages.slice(0, 10).map((p, i) => (
                    <div key={p.page_path} className="flex items-center gap-3 text-sm">
                      <span className="text-neutral-500 w-6 text-right">{i + 1}.</span>
                      <span className="text-neutral-200 flex-1 truncate">{p.page_path}</span>
                      <span className="text-cmyk-cyan font-medium">{formatNumber(p.views)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Sin datos" />
              )}
            </div>

            {/* Devices */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <h2 className="text-white font-semibold">Dispositivos</h2>
              {data.page_views.devices.length > 0 ? (
                <div className="space-y-3">
                  {data.page_views.devices.map((d) => {
                    const total = data.page_views.devices.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                    return (
                      <div key={d.device_type} className="flex items-center gap-3">
                        <div className="text-neutral-400">{DEVICE_ICONS[d.device_type] || <GlobeAltIcon className="h-5 w-5" />}</div>
                        <span className="text-white text-sm w-20">{DEVICE_LABELS[d.device_type] || d.device_type}</span>
                        <div className="flex-1 bg-neutral-800 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-cmyk-magenta h-full rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-neutral-300 text-sm w-16 text-right">{pct}% ({d.count})</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState text="Sin datos" />
              )}
            </div>

            {/* Quote funnel */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <h2 className="text-white font-semibold">Embudo de Cotización</h2>
              <div className="space-y-3">
                {[
                  { key: 'quote_form_start', label: 'Iniciaron formulario', color: 'bg-blue-500' },
                  { key: 'quote_form_submit', label: 'Enviaron cotización', color: 'bg-green-500' },
                  { key: 'quote_form_abandon', label: 'Abandonaron', color: 'bg-yellow-500' },
                  { key: 'quote_form_error', label: 'Errores', color: 'bg-red-500' },
                ].map((step) => {
                  const count = data.events.quote_funnel[step.key] || 0;
                  const maxFunnel = Math.max(...Object.values(data.events.quote_funnel), 1);
                  const pct = (count / maxFunnel) * 100;
                  return (
                    <div key={step.key} className="flex items-center gap-3 text-sm">
                      <span className="text-neutral-300 w-44 flex-shrink-0">{step.label}</span>
                      <div className="flex-1 bg-neutral-800 rounded-full h-3 overflow-hidden">
                        <div className={`${step.color} h-full rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-white w-10 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top events */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <h2 className="text-white font-semibold">Eventos Principales</h2>
              {data.events.top.length > 0 ? (
                <div className="space-y-2">
                  {data.events.top.filter((e) => e.event_name !== 'page_view').slice(0, 10).map((ev) => (
                    <div key={ev.event_name} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-300">{EVENT_LABELS[ev.event_name] || ev.event_name}</span>
                      <span className="text-cmyk-cyan font-medium">{formatNumber(ev.count)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Sin eventos registrados" />
              )}
            </div>

            {/* Traffic sources */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <h2 className="text-white font-semibold">Fuentes de Tráfico (UTM)</h2>
              {data.traffic_sources.length > 0 ? (
                <div className="space-y-2">
                  {data.traffic_sources.map((s) => (
                    <div key={s.utm_source} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-300">{s.utm_source}</span>
                      <span className="text-cmyk-cyan font-medium">{formatNumber(s.count)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Sin datos UTM — agrega ?utm_source= a tus links de campaña" />
              )}
            </div>
          </div>

          {/* Setup guide if no data */}
          {data.page_views.total === 0 && data.events.top.length === 0 && (
            <div className="bg-cmyk-cyan/5 border border-cmyk-cyan/20 rounded-xl p-6 space-y-4">
              <h2 className="text-white font-semibold text-lg">🚀 Configuración</h2>
              <p className="text-neutral-300 text-sm">
                La analítica está instalada. Para activar Google Analytics y Microsoft Clarity:
              </p>
              <ol className="list-decimal pl-6 text-neutral-300 text-sm space-y-2">
                <li>
                  Crea una cuenta en <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-cmyk-cyan hover:underline">Google Analytics 4</a> y copia tu ID (ej. <code className="text-cmyk-yellow">G-XXXXXXXXXX</code>)
                </li>
                <li>
                  Crea una cuenta en <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-cmyk-cyan hover:underline">Microsoft Clarity</a> (gratis) y copia tu Project ID
                </li>
                <li>
                  Agrega las variables a tu <code className="text-cmyk-yellow">.env.local</code>:
                  <pre className="mt-2 bg-neutral-800 p-3 rounded text-xs overflow-x-auto">
{`NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
NEXT_PUBLIC_CLARITY_ID=tu-project-id
NEXT_PUBLIC_FB_PIXEL_ID=tu-pixel-id  # opcional`}
                  </pre>
                </li>
                <li>Reinicia el servidor de desarrollo.</li>
              </ol>
              <p className="text-neutral-400 text-xs">
                Los eventos propios (page views, clicks, formularios) ya se están enviando a este dashboard automáticamente cuando los usuarios aceptan cookies analíticas.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-center gap-4">
      <div className="p-3 bg-neutral-800 rounded-lg">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-neutral-400">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-neutral-500 text-sm">{text}</div>
  );
}
