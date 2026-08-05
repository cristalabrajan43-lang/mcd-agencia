'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  DocumentTextIcon,
  ChevronRightIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

import { getQuotes, getQuoteRequests } from '@/lib/api/quotes';
import type { Quote, QuoteRequest } from '@/lib/api/quotes';
import { Card, Badge, Button, Pagination, LoadingPage, Select } from '@/components/ui';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import { SERVICE_LABELS, type ServiceId } from '@/lib/service-ids';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'request_pending', label: 'Solicitud pendiente' },
  { value: 'request_in_review', label: 'Solicitud en revisión' },
  { value: 'sent', label: 'Enviada' },
  { value: 'viewed', label: 'Vista' },
  { value: 'accepted', label: 'Aceptada' },
  { value: 'rejected', label: 'Rechazada' },
  { value: 'changes_requested', label: 'Cambios Solicitados' },
  { value: 'expired', label: 'Expirada' },
];

// Statuses that mean the request hasn't been turned into a quote yet
const PENDING_REQUEST_STATUSES = ['pending', 'assigned', 'in_review'];

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Solicitud pendiente',
  assigned: 'Solicitud asignada',
  in_review: 'Solicitud en revisión',
};

// Unified item for the list
type ListItem =
  | { kind: 'quote'; data: Quote; sortDate: string }
  | { kind: 'request'; data: QuoteRequest; sortDate: string };

export default function QuotesPage() {
  const locale = useLocale();
  const [filters, setFilters] = useState({ status: '', page: 1 });

  // Determine if we're filtering by a request-specific status
  const isRequestFilter = filters.status.startsWith('request_');
  const isQuoteFilter = !isRequestFilter && filters.status !== '';

  const quoteFilters = useMemo(() => {
    if (isRequestFilter) return null; // skip quotes fetch
    return { status: filters.status, page: filters.page };
  }, [filters.status, filters.page, isRequestFilter]);

  const requestFilters = useMemo(() => {
    if (isQuoteFilter) return null; // skip requests fetch
    // Map request_pending → pending, request_in_review → in_review for the API
    const mapped = filters.status.replace('request_', '');
    return { status: mapped || undefined, page: 1 };
  }, [filters.status, isQuoteFilter]);

  const {
    data: quotesData,
    isLoading: quotesLoading,
    error: quotesError,
  } = useQuery({
    queryKey: ['quotes', quoteFilters],
    queryFn: () => getQuotes(quoteFilters!),
    enabled: quoteFilters !== null,
  });

  const {
    data: requestsData,
    isLoading: requestsLoading,
  } = useQuery({
    queryKey: ['my-quote-requests', requestFilters],
    queryFn: () => getQuoteRequests(requestFilters as Record<string, string | number | undefined>),
    enabled: requestFilters !== null,
  });

  const quotes = quotesData?.results || [];
  const quoteRequests = requestsData?.results || [];

  // Filter to only show requests that haven't become quotes yet
  const pendingRequests = useMemo(() => {
    return quoteRequests.filter((r) => PENDING_REQUEST_STATUSES.includes(r.status));
  }, [quoteRequests]);

  // Build unified list sorted by date (newest first)
  const items: ListItem[] = useMemo(() => {
    const list: ListItem[] = [];

    // Don't show requests if filtering by a quote-specific status
    if (!isQuoteFilter) {
      for (const req of pendingRequests) {
        list.push({ kind: 'request', data: req, sortDate: req.created_at });
      }
    }

    // Don't show quotes if filtering by a request-specific status
    if (!isRequestFilter) {
      for (const q of quotes) {
        list.push({ kind: 'quote', data: q, sortDate: q.created_at });
      }
    }

    list.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
    return list;
  }, [quotes, pendingRequests, isQuoteFilter, isRequestFilter]);

  const totalPages = quotesData?.total_pages || Math.ceil((quotesData?.count || 0) / 10);
  const isLoading = quotesLoading || requestsLoading;

  if (isLoading) {
    return <LoadingPage message="Cargando cotizaciones..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Mis Cotizaciones</h2>
          <p className="text-neutral-400">Solicitudes enviadas y cotizaciones recibidas</p>
        </div>

        <Select
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
          options={STATUS_OPTIONS}
          placeholder="Filtrar por estado"
          className="w-48"
        />
      </div>

      {/* List */}
      {quotesError ? (
        <Card className="text-center py-12">
          <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">Error al cargar cotizaciones</h3>
          <p className="text-neutral-400 mb-6">
            No se pudieron cargar tus cotizaciones. Intenta recargar la página.
          </p>
          <Button onClick={() => window.location.reload()}>Recargar página</Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="text-center py-12">
          <DocumentTextIcon className="h-16 w-16 text-neutral-700 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">No tienes cotizaciones</h3>
          <p className="text-neutral-400 mb-6">
            Solicita una cotización para tus proyectos personalizados
          </p>
          <Link href="/cotizar">
            <Button>Solicitar cotización</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) =>
            item.kind === 'request' ? (
              <QuoteRequestCard key={`req-${item.data.id}`} request={item.data} locale={locale} />
            ) : (
              <QuoteCard key={`q-${item.data.id}`} quote={item.data} />
            )
          )}

          {/* Pagination (only for quotes, requests are few) */}
          {totalPages > 1 && !isRequestFilter && (
            <Pagination
              currentPage={filters.page}
              totalPages={totalPages}
              onPageChange={(page) => setFilters({ ...filters, page })}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ───────── Quote Card (existing) ───────── */

function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <Card hover>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-white font-medium">
              Cotización #{quote.quote_number}
            </span>
            <Badge
              variant={
                quote.status === 'accepted'
                  ? 'success'
                  : quote.status === 'rejected' || quote.status === 'expired'
                  ? 'error'
                  : quote.status === 'sent' || quote.status === 'viewed'
                  ? 'info'
                  : quote.status === 'changes_requested'
                  ? 'warning'
                  : quote.status === 'converted'
                  ? 'success'
                  : 'warning'
              }
            >
              {quote.status_display}
            </Badge>
            {quote.is_expired && (
              <Badge variant="error">Expirada</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
            <span>Creada: {formatDate(quote.created_at)}</span>
            {quote.valid_until && (
              <span>Válida hasta: {formatDate(quote.valid_until)}</span>
            )}
            <span className="text-cyan-400 font-medium">
              {formatPrice(quote.total)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {quote.status === 'sent' && !quote.is_expired && (
            <Link href={`/mi-cuenta/cotizaciones/${quote.id}/aceptar`}>
              <Button size="sm">Aceptar</Button>
            </Link>
          )}
          <Link href={`/mi-cuenta/cotizaciones/${quote.id}`}>
            <Button variant="ghost" rightIcon={<ChevronRightIcon className="h-5 w-5" />}>
              Ver detalle
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ───────── Quote Request Card (new) ───────── */

function QuoteRequestCard({ request, locale }: { request: QuoteRequest; locale: string }) {
  const serviceName = request.service_type
    ? SERVICE_LABELS[request.service_type as ServiceId] || request.service_type
    : request.catalog_item?.name || 'Servicio';

  return (
    <Card hover className="border-l-4 border-l-yellow-500/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
            <span className="text-white font-medium">
              Solicitud #{request.request_number}
            </span>
            <Badge variant="warning">
              {REQUEST_STATUS_LABELS[request.status] || request.status_display}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
            <span>Enviada: {formatDate(request.created_at)}</span>
            <span className="text-yellow-400/80">{serviceName}</span>
          </div>
          <p className="text-neutral-500 text-xs mt-1">
            <PaperAirplaneIcon className="h-3 w-3 inline mr-1 -mt-0.5" />
            Tu solicitud está siendo atendida por nuestro equipo de ventas
          </p>
        </div>

        <div className="flex gap-2">
          <Link href={`/${locale}/mi-cuenta/cotizaciones/${request.id}/solicitud-enviada`}>
            <Button variant="ghost" rightIcon={<ChevronRightIcon className="h-5 w-5" />}>
              Ver solicitud
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
