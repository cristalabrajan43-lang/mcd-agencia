'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ClockIcon,
  PaperClipIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

import { Card, LoadingPage, Badge, Button } from '@/components/ui';
import { Breadcrumb } from '@/components/ui';
import { ServiceDetailsDisplay } from '@/components/quotes/ServiceDetailsDisplay';
import { getQuoteRequestById } from '@/lib/api/quotes';
import {
  SERVICE_LABELS,
  type ServiceId,
  DELIVERY_METHOD_LABELS,
  DELIVERY_METHOD_ICONS,
  type DeliveryMethod,
} from '@/lib/service-ids';

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignada',
  in_review: 'En Revisión',
  quoted: 'Cotizada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  info_requested: 'Info Solicitada',
};

const statusVariants: Record<string, 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning',
  assigned: 'info',
  in_review: 'info',
  quoted: 'success',
  accepted: 'success',
  rejected: 'error',
  cancelled: 'error',
};

export default function CustomerSentRequestPage() {
  const params = useParams();
  const locale = useLocale();
  const requestId = params.id as string;

  const { data: request, isLoading, error } = useQuery({
    queryKey: ['quote-request', requestId],
    queryFn: () => getQuoteRequestById(requestId),
  });

  if (isLoading) {
    return <LoadingPage message="Cargando solicitud..." />;
  }

  if (error || !request) {
    return (
      <div className="text-center py-12">
        <DocumentTextIcon className="h-16 w-16 text-neutral-700 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-4">Solicitud no encontrada</h2>
        <Link href={`/${locale}/mi-cuenta/cotizaciones`}>
          <Button>Volver a cotizaciones</Button>
        </Link>
      </div>
    );
  }

  const fmtDateLong = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Mi Cuenta', href: '/mi-cuenta' },
          { label: 'Cotizaciones', href: '/mi-cuenta/cotizaciones' },
          { label: `Solicitud #${request.request_number}` },
        ]}
        showHome={false}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/${locale}/mi-cuenta/cotizaciones`}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Solicitud de Cotización</h1>
              <Badge variant={statusVariants[request.status] || 'warning'} size="md">
                {statusLabels[request.status] || request.status_display}
              </Badge>
            </div>
            <p className="text-neutral-400 mt-1">
              #{request.request_number} · Enviada el {fmtDateLong(request.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {['pending', 'assigned', 'in_review'].includes(request.status) && (
        <Card className="p-4 bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-start gap-3">
            <PaperAirplaneIcon className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-yellow-400 font-medium">
                {request.status === 'in_review'
                  ? 'Tu solicitud está siendo revisada'
                  : request.status === 'assigned'
                  ? 'Tu solicitud ha sido asignada a un asesor'
                  : 'Tu solicitud fue recibida correctamente'}
              </p>
              <p className="text-neutral-400 text-sm mt-1">
                Nuestro equipo de ventas te contactará con una cotización personalizada.
                {request.assigned_to_name && (
                  <> Tu asesor asignado es <span className="text-white">{request.assigned_to_name}</span>.</>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {request.status === 'quoted' && (
        <Card className="p-4 bg-cmyk-cyan/10 border-cmyk-cyan/30">
          <div className="flex items-start gap-3">
            <DocumentTextIcon className="h-5 w-5 text-cmyk-cyan mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-cmyk-cyan font-medium">¡Cotización lista!</p>
              <p className="text-neutral-400 text-sm mt-1">
                Ya se generó una cotización a partir de esta solicitud. Revísala en tu lista de cotizaciones.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-cmyk-cyan" />
              Tus Datos de Contacto
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg">
                <UserIcon className="h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-neutral-500 text-xs">Nombre</p>
                  <p className="text-white">{request.customer_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg">
                <EnvelopeIcon className="h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-neutral-500 text-xs">Email</p>
                  <p className="text-white">{request.customer_email}</p>
                </div>
              </div>
              {request.customer_phone && (
                <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg">
                  <PhoneIcon className="h-5 w-5 text-neutral-400" />
                  <div>
                    <p className="text-neutral-500 text-xs">Teléfono</p>
                    <p className="text-white">{request.customer_phone}</p>
                  </div>
                </div>
              )}
              {request.customer_company && (
                <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg">
                  <BuildingOfficeIcon className="h-5 w-5 text-neutral-400" />
                  <div>
                    <p className="text-neutral-500 text-xs">Empresa</p>
                    <p className="text-white">{request.customer_company}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Multi-Service Details */}
          {request.services && request.services.length > 0 ? (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Servicios Solicitados ({request.services.length})
              </h2>

              {request.catalog_item && (
                <div className="mb-4 p-4 bg-neutral-800/50 rounded-lg flex items-center gap-4">
                  {request.catalog_item.image && (
                    <img
                      src={request.catalog_item.image}
                      alt={request.catalog_item.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div>
                    <p className="text-neutral-500 text-xs">Producto/Servicio</p>
                    <p className="text-white font-medium">{request.catalog_item.name}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {request.services.map((svc, idx) => (
                  <div key={svc.id} className="p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-cmyk-cyan/20 text-cmyk-cyan text-sm font-bold">
                        {idx + 1}
                      </span>
                      <h3 className="text-white font-semibold text-lg">
                        {SERVICE_LABELS[svc.service_type as ServiceId] || svc.service_type}
                      </h3>
                    </div>

                    {/* Service-specific parameters */}
                    {svc.service_details && Object.keys(svc.service_details).length > 0 && (
                      <div className="mb-3">
                        <ServiceDetailsDisplay
                          serviceType={svc.service_type}
                          serviceDetails={svc.service_details as Record<string, unknown>}
                        />
                      </div>
                    )}

                    {svc.description && (
                      <div className="p-4 bg-neutral-800/50 rounded-lg mb-3">
                        <p className="text-neutral-500 text-xs mb-2">Comentarios</p>
                        <p className="text-white whitespace-pre-wrap">{svc.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {svc.delivery_method && (
                        <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                          <p className="text-neutral-500 text-xs mb-1">Método de entrega</p>
                          <p className="text-white font-medium flex items-center gap-1 mt-auto">
                            <span>{DELIVERY_METHOD_ICONS[svc.delivery_method as DeliveryMethod]}</span>
                            {DELIVERY_METHOD_LABELS[svc.delivery_method as DeliveryMethod]?.es || svc.delivery_method}
                          </p>
                        </div>
                      )}
                      {svc.pickup_branch_detail && (
                        <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                          <p className="text-neutral-500 text-xs mb-1">Sucursal de recolección</p>
                          <p className="text-white font-medium mt-auto">{svc.pickup_branch_detail.name}</p>
                        </div>
                      )}
                      {svc.delivery_address && Object.keys(svc.delivery_address).length > 0 && (
                        <div className="p-3 bg-neutral-900/50 rounded-lg col-span-2 flex flex-col">
                          <p className="text-neutral-500 text-xs mb-1">
                            {svc.delivery_method === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}
                          </p>
                          <p className="text-white font-medium mt-auto">
                            {[svc.delivery_address.street || svc.delivery_address.calle,
                              svc.delivery_address.exterior_number || svc.delivery_address.numero_exterior,
                              svc.delivery_address.neighborhood || svc.delivery_address.colonia,
                              svc.delivery_address.city || svc.delivery_address.ciudad,
                              svc.delivery_address.state || svc.delivery_address.estado,
                              svc.delivery_address.postal_code || svc.delivery_address.codigo_postal,
                            ].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      )}
                      {(() => {
                        const sd = svc.service_details as Record<string, unknown> | undefined;
                        const hasRouteDates = sd && Array.isArray(sd.rutas) &&
                          (sd.rutas as Array<Record<string, unknown>>).some(r => !!r.fecha_inicio);
                        if (!svc.required_date || hasRouteDates) return null;
                        return (
                          <div className="p-3 bg-neutral-900/50 rounded-lg flex flex-col">
                            <p className="text-neutral-500 text-xs mb-1">Fecha requerida</p>
                            <p className="text-white font-medium mt-auto">
                              {new Date(svc.required_date + 'T12:00:00').toLocaleDateString('es-MX', {
                                year: 'numeric', month: 'short', day: 'numeric',
                              })}
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Per-service attachments */}
                    {svc.attachments && svc.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-neutral-700">
                        <p className="text-neutral-500 text-xs mb-2 flex items-center gap-1">
                          <PaperClipIcon className="h-3 w-3" />
                          Archivos adjuntos ({svc.attachments.length})
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {svc.attachments.map((att) => {
                            const isImage = att.file_type?.startsWith('image/');
                            return (
                              <a
                                key={att.id}
                                href={att.file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-2 bg-neutral-900/50 rounded hover:bg-neutral-700 transition-colors group"
                              >
                                {isImage && (
                                  <img
                                    src={att.file}
                                    alt={att.filename || 'Archivo'}
                                    className="w-full h-20 object-cover rounded mb-1"
                                  />
                                )}
                                <p className="text-xs text-cmyk-cyan truncate group-hover:underline flex items-center gap-1">
                                  {!isImage && <PaperClipIcon className="h-3 w-3 flex-shrink-0" />}
                                  {att.filename || 'Archivo'}
                                </p>
                                {att.file_size > 0 && (
                                  <p className="text-neutral-500 text-[10px]">{formatFileSize(att.file_size)}</p>
                                )}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {request.description && (
                <div className="mt-4 p-4 bg-neutral-800/50 rounded-lg">
                  <p className="text-neutral-500 text-xs mb-2">Comentarios generales</p>
                  <p className="text-white whitespace-pre-wrap">{request.description}</p>
                </div>
              )}
            </Card>
          ) : (
            /* Single-service fallback */
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Detalles del Servicio Solicitado</h2>

              {request.catalog_item && (
                <div className="mb-4 p-4 bg-neutral-800/50 rounded-lg flex items-center gap-4">
                  {request.catalog_item.image && (
                    <img
                      src={request.catalog_item.image}
                      alt={request.catalog_item.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div>
                    <p className="text-neutral-500 text-xs">Producto/Servicio</p>
                    <p className="text-white font-medium">{request.catalog_item.name}</p>
                  </div>
                </div>
              )}

              {request.service_type && (
                <div className="mb-4 p-3 bg-cmyk-cyan/10 border border-cmyk-cyan/30 rounded-lg">
                  <p className="text-neutral-500 text-xs">Tipo de Servicio</p>
                  <p className="text-cmyk-cyan font-semibold text-lg">
                    {SERVICE_LABELS[request.service_type as ServiceId] || request.service_type}
                  </p>
                </div>
              )}

              {request.service_details && Object.keys(request.service_details).length > 0 && (
                <div className="mb-4">
                  <p className="text-neutral-400 text-sm mb-3 font-medium">Parámetros del servicio</p>
                  <ServiceDetailsDisplay
                    serviceType={request.service_type}
                    serviceDetails={request.service_details as Record<string, unknown>}
                  />
                </div>
              )}

              {(!request.service_details || Object.keys(request.service_details).length === 0) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {request.quantity && (
                    <div className="p-3 bg-neutral-800/50 rounded-lg">
                      <p className="text-neutral-500 text-xs">Cantidad</p>
                      <p className="text-white font-medium">{request.quantity}</p>
                    </div>
                  )}
                  {request.dimensions && (
                    <div className="p-3 bg-neutral-800/50 rounded-lg">
                      <p className="text-neutral-500 text-xs">Dimensiones</p>
                      <p className="text-white">{request.dimensions}</p>
                    </div>
                  )}
                  {request.material && (
                    <div className="p-3 bg-neutral-800/50 rounded-lg">
                      <p className="text-neutral-500 text-xs">Material</p>
                      <p className="text-white">{request.material}</p>
                    </div>
                  )}
                  <div className="p-3 bg-neutral-800/50 rounded-lg">
                    <p className="text-neutral-500 text-xs">Instalación</p>
                    <p className="text-white">{request.includes_installation ? 'Sí' : 'No'}</p>
                  </div>
                </div>
              )}

              {request.description && (
                <div className="p-4 bg-neutral-800/50 rounded-lg">
                  <p className="text-neutral-500 text-xs mb-2">Comentarios adicionales</p>
                  <p className="text-white whitespace-pre-wrap">{request.description}</p>
                </div>
              )}

              {request.delivery_method && (
                <div className="mt-4 p-3 bg-neutral-800/50 rounded-lg">
                  <p className="text-neutral-500 text-xs mb-2">Método de entrega preferido</p>
                  <p className="text-white flex items-center gap-2">
                    <span>{DELIVERY_METHOD_ICONS[request.delivery_method as DeliveryMethod]}</span>
                    {DELIVERY_METHOD_LABELS[request.delivery_method as DeliveryMethod]?.es || request.delivery_method}
                  </p>
                  {request.pickup_branch_detail && (
                    <p className="text-neutral-300 text-sm mt-1">
                      Sucursal: {request.pickup_branch_detail.name} — {request.pickup_branch_detail.city}, {request.pickup_branch_detail.state}
                    </p>
                  )}
                  {request.delivery_address && typeof request.delivery_address === 'object' && Object.keys(request.delivery_address).length > 0 && (
                    <p className="text-neutral-300 text-sm mt-1">
                      {request.delivery_method === 'installation' ? 'Dirección de instalación' : 'Dirección de envío'}:{' '}
                      {[request.delivery_address.street || request.delivery_address.calle, request.delivery_address.exterior_number || request.delivery_address.numero_exterior, request.delivery_address.neighborhood || request.delivery_address.colonia, request.delivery_address.city || request.delivery_address.ciudad, request.delivery_address.state || request.delivery_address.estado, request.delivery_address.postal_code || request.delivery_address.codigo_postal].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              )}

              {(() => {
                let displayDate = request.required_date;
                const details = request.service_details as Record<string, unknown> | undefined;
                if (details && Array.isArray(details.rutas)) {
                  const routeDates = (details.rutas as Array<Record<string, unknown>>)
                    .map(r => r.fecha_inicio as string)
                    .filter(d => !!d)
                    .sort();
                  if (routeDates.length > 0) {
                    const earliest = routeDates[0];
                    if (!displayDate || earliest < displayDate) {
                      displayDate = earliest;
                    }
                  }
                }
                if (!displayDate) return null;
                return (
                  <div className="mt-4 p-3 bg-neutral-800/50 rounded-lg flex items-center gap-3">
                    <CalendarIcon className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-neutral-500 text-xs">Fecha Requerida</p>
                      <p className="text-white">
                        {new Date(displayDate + 'T12:00:00').toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </Card>
          )}

          {/* Global Attachments — exclude files already shown per-service */}
          {(() => {
            const perServiceAttIds = new Set<string>();
            if (request.services) {
              request.services.forEach(svc => {
                svc.attachments?.forEach(att => perServiceAttIds.add(att.id));
              });
            }
            const globalOnly = (request.attachments || []).filter(a => !perServiceAttIds.has(a.id));
            if (globalOnly.length === 0) return null;
            return (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <PaperClipIcon className="h-5 w-5 text-cmyk-cyan" />
                  Archivos Adjuntos ({globalOnly.length})
                </h2>
                <div className="space-y-2">
                  {globalOnly.map((attachment) => {
                    const isImage = attachment.file_type?.startsWith('image/');
                    return (
                      <a
                        key={attachment.id}
                        href={attachment.file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors border border-neutral-700/50"
                      >
                        {isImage ? (
                          <img
                            src={attachment.file}
                            alt={attachment.filename}
                            className="w-12 h-12 object-cover rounded border border-neutral-600"
                          />
                        ) : (
                          <PaperClipIcon className="h-5 w-5 text-neutral-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-cmyk-cyan hover:underline truncate">{attachment.filename}</p>
                          <p className="text-neutral-500 text-xs">
                            {formatFileSize(attachment.file_size)}
                            {attachment.file_type && ` · ${attachment.file_type}`}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </Card>
            );
          })()}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-cmyk-cyan" />
              Estado
            </h2>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-cmyk-cyan"></div>
                <div>
                  <p className="text-white text-sm">Solicitud enviada</p>
                  <p className="text-neutral-500 text-xs">{fmtDateLong(request.created_at)}</p>
                </div>
              </div>
              {request.assigned_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-400"></div>
                  <div>
                    <p className="text-white text-sm">Asignada a {request.assigned_to_name || 'vendedor'}</p>
                    <p className="text-neutral-500 text-xs">{fmtDateLong(request.assigned_at)}</p>
                  </div>
                </div>
              )}
              {['in_review', 'quoted', 'accepted'].includes(request.status) && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-purple-400"></div>
                  <div>
                    <p className="text-white text-sm">En revisión</p>
                    <p className="text-neutral-500 text-xs">{fmtDateLong(request.updated_at)}</p>
                  </div>
                </div>
              )}
              {['quoted', 'accepted'].includes(request.status) && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-green-400"></div>
                  <div>
                    <p className="text-white text-sm">Cotización generada</p>
                    <p className="text-neutral-500 text-xs">{fmtDateLong(request.updated_at)}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Acciones</h2>
            <div className="space-y-2">
              <Link href={`/${locale}/mi-cuenta/cotizaciones`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  Volver a cotizaciones
                </Button>
              </Link>
            </div>
          </Card>

          {/* Info */}
          <Card className="p-6 bg-cmyk-cyan/5 border-cmyk-cyan/20">
            <h3 className="font-semibold text-white mb-2">¿Tienes preguntas?</h3>
            <p className="text-neutral-400 text-sm mb-4">
              Si necesitas hacer cambios a tu solicitud o tienes alguna duda, contáctanos.
            </p>
            <a
              href="mailto:ventas@mcd-agencia.com"
              className="text-cmyk-cyan hover:underline text-sm"
            >
              ventas@mcd-agencia.com
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}
