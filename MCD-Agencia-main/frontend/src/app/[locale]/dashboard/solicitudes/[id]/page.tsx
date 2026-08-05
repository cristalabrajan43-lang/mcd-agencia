'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  ArrowLeftIcon,
  DocumentPlusIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ClockIcon,
  PaperClipIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { SERVICE_LABELS, type ServiceId, DELIVERY_METHOD_LABELS, DELIVERY_METHOD_ICONS, type DeliveryMethod } from '@/lib/service-ids';
import { Card, Button, LoadingPage } from '@/components/ui';
import { ServiceDetailsDisplay, serviceDetailsLabels, subtipoLabels } from '@/components/quotes/ServiceDetailsDisplay';
import {
  getAdminQuoteRequestById,
  markQuoteRequestInReview,
  unmarkQuoteRequestInReview,
  assignQuoteRequest,
  deleteQuoteRequest,
  requestQuoteRequestInfo,
  getSalesReps,
  QuoteRequest,
  QuoteRequestStatus,
  UrgencyLevel,
  SalesRep,
} from '@/lib/api/quotes';

const statusColors: Record<QuoteRequestStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  in_review: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  quoted: 'bg-cmyk-cyan/20 text-cmyk-cyan border-cmyk-cyan/50',
  accepted: 'bg-green-500/20 text-green-400 border-green-500/50',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/50',
  cancelled: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/50',
  info_requested: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
};

const statusLabels: Record<QuoteRequestStatus, string> = {
  pending: 'Pendiente',
  assigned: 'Asignada',
  in_review: 'En Revisión',
  quoted: 'Cotizada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  info_requested: 'Info Solicitada',
};

const urgencyColors: Record<UrgencyLevel, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  normal: 'bg-green-500/20 text-green-400 border-green-500/50',
};

const urgencyLabels: Record<UrgencyLevel, string> = {
  high: 'Urgente',
  medium: 'Media',
  normal: 'Normal',
};

export default function QuoteRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [request, setRequest] = useState<QuoteRequest | null>(null);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInfoRequestModal, setShowInfoRequestModal] = useState(false);
  const [infoRequestMessage, setInfoRequestMessage] = useState('');
  const [isSendingInfoRequest, setIsSendingInfoRequest] = useState(false);
  const [selectedInfoFields, setSelectedInfoFields] = useState<string[]>([]);

  const requestId = params.id as string;
  const isSalesOrAdmin = user?.role?.name && ['admin', 'sales'].includes(user.role.name);
  const isAdmin = user?.role?.name === 'admin';

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/solicitudes/${requestId}`);
      } else if (!isSalesOrAdmin) {
        router.push(`/${locale}`);
      }
    }
  }, [authLoading, isAuthenticated, isSalesOrAdmin, router, locale, requestId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated || !isSalesOrAdmin || !requestId) return;

      setIsLoading(true);
      try {
        const [requestData, repsData] = await Promise.all([
          getAdminQuoteRequestById(requestId),
          isAdmin ? getSalesReps().catch(() => []) : Promise.resolve([]),
        ]);
        setRequest(requestData);
        setSalesReps(repsData);
      } catch (error) {
        console.error('Error fetching request:', error);
        toast.error('Error al cargar la solicitud');
        router.push(`/${locale}/dashboard/solicitudes`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, isSalesOrAdmin, isAdmin, requestId, router, locale]);

  const handleMarkInReview = async () => {
    if (!request) return;

    setIsUpdating(true);
    try {
      const updated = await markQuoteRequestInReview(request.id);
      setRequest(updated);
      toast.success('Solicitud marcada como en revisión');
    } catch (error) {
      console.error('Error updating request:', error);
      toast.error('Error al actualizar la solicitud');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnmarkInReview = async () => {
    if (!request) return;

    setIsUpdating(true);
    try {
      const updated = await unmarkQuoteRequestInReview(request.id);
      setRequest(updated);
      toast.success('Solicitud devuelta a estado anterior');
    } catch (error) {
      console.error('Error updating request:', error);
      toast.error('Error al actualizar la solicitud');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssign = async (salesRepId: string) => {
    if (!request) return;

    setIsUpdating(true);
    try {
      const updated = await assignQuoteRequest(request.id, salesRepId);
      setRequest(updated);
      setShowAssignModal(false);
      toast.success('Solicitud asignada correctamente');
    } catch (error) {
      console.error('Error assigning request:', error);
      toast.error('Error al asignar la solicitud');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!request) return;

    setIsDeleting(true);
    try {
      await deleteQuoteRequest(request.id);
      toast.success(`Solicitud ${request.request_number} eliminada`);
      router.push(`/${locale}/dashboard/solicitudes`);
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      toast.error(err?.data?.error || 'Error al eliminar la solicitud');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const deletableStatuses = ['pending', 'assigned', 'in_review', 'rejected', 'cancelled', 'info_requested'];

  const handleRequestInfo = async () => {
    if (!request || !infoRequestMessage.trim()) return;

    setIsSendingInfoRequest(true);
    try {
      const updated = await requestQuoteRequestInfo(
        request.id,
        infoRequestMessage.trim(),
        selectedInfoFields.length > 0 ? selectedInfoFields : undefined
      );
      setRequest(updated);
      setShowInfoRequestModal(false);
      setInfoRequestMessage('');
      setSelectedInfoFields([]);
      toast.success('Solicitud de información enviada al cliente');
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      toast.error(err?.data?.error || 'Error al enviar la solicitud de información');
    } finally {
      setIsSendingInfoRequest(false);
    }
  };

  if (authLoading || isLoading) {
    return <LoadingPage message="Cargando..." />;
  }

  if (!isAuthenticated || !isSalesOrAdmin || !request) {
    return null;
  }

  const formatDate = (dateString: string) => {
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

  const canCreateQuote = ['pending', 'assigned', 'in_review'].includes(request.status);
  const isSales = user?.role?.name === 'sales';
  const isAssignedToMe = request.assigned_to === user?.id;
  const isUrgent = request.urgency === 'high';
  // Sales can only create quotes for their own assigned requests, or urgent ones
  const canCreateQuoteForRequest = canCreateQuote && (isAdmin || isAssignedToMe || isUrgent);

  return (
    <div className="max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{request.request_number}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[request.status]}`}>
                {statusLabels[request.status]}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${urgencyColors[request.urgency]}`}>
                {urgencyLabels[request.urgency]}
              </span>
            </div>
            <p className="text-neutral-400">
              Creada el {formatDate(request.created_at)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Info */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-cmyk-cyan" />
                Información del Cliente
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
                    <a href={`mailto:${request.customer_email}`} className="text-cmyk-cyan hover:underline">
                      {request.customer_email}
                    </a>
                  </div>
                </div>
                {request.customer_phone && (
                  <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg">
                    <PhoneIcon className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-neutral-500 text-xs">Teléfono</p>
                      <a href={`tel:${request.customer_phone}`} className="text-cmyk-cyan hover:underline">
                        {request.customer_phone}
                      </a>
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
              {request.is_guest && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    Este cliente no está registrado (invitado)
                  </p>
                </div>
              )}
            </Card>

            {/* Service Details — only show legacy single-service card when there are NO multi-service records */}
            {(!request.services || request.services.length === 0) && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Detalles del Servicio</h2>

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
                // If multi-service request and all services have route dates, skip general date
                if (request.services && request.services.length > 0) {
                  const allRoutesBased = request.services.every(svc => {
                    const sd = svc.service_details as Record<string, unknown> | undefined;
                    return sd && Array.isArray(sd.rutas) && (sd.rutas as Array<Record<string, unknown>>).some(r => !!r.fecha_inicio);
                  });
                  if (allRoutesBased) return null;
                }

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
                        {request.days_until_required !== undefined && (
                          <span className={`ml-2 text-sm ${
                            request.days_until_required <= 0
                              ? 'text-red-400'
                              : request.days_until_required <= 7
                              ? 'text-yellow-400'
                              : 'text-neutral-400'
                          }`}>
                            ({request.days_until_required > 0
                              ? `en ${request.days_until_required} días`
                              : request.days_until_required === 0
                              ? 'Hoy'
                              : 'Vencido'})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </Card>
            )}

            {/* Multi-Service Details */}
            {request.services && request.services.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Servicios Solicitados ({request.services.length})
                </h2>
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
                          <p className="text-neutral-500 text-xs mb-2">Comentarios del cliente</p>
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
              </Card>
            )}

            {/* Global Attachments — only show files NOT already linked to a service */}
            {(() => {
              // Collect IDs of attachments already shown per-service
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
                    {globalOnly.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors"
                      >
                        <PaperClipIcon className="h-5 w-5 text-neutral-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate">{attachment.filename}</p>
                          <p className="text-neutral-500 text-xs">
                            {formatFileSize(attachment.file_size)}
                            {attachment.file_type && ` • ${attachment.file_type}`}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </Card>
              );
            })()}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Acciones</h2>
              <div className="space-y-3">
                {canCreateQuote && canCreateQuoteForRequest && (
                  <Link
                    href={`/${locale}/dashboard/cotizaciones/nueva?solicitud=${request.id}`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-cmyk-cyan text-black font-medium rounded-lg hover:bg-cmyk-cyan/90 transition-colors"
                  >
                    <DocumentPlusIcon className="h-5 w-5" />
                    Crear Cotización
                  </Link>
                )}

                {canCreateQuote && !canCreateQuoteForRequest && isSales && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-sm font-medium mb-1">
                      Solicitud asignada a otro vendedor
                    </p>
                    <p className="text-neutral-400 text-xs">
                      {request.assigned_to_name ? `Asignada a: ${request.assigned_to_name}` : 'No asignada a ti'}. 
                      Solo puedes crear cotizaciones para solicitudes asignadas a ti o marcadas como urgentes.
                    </p>
                  </div>
                )}

                {['pending', 'assigned'].includes(request.status) && (
                  <Button
                    onClick={handleMarkInReview}
                    disabled={isUpdating}
                    isLoading={isUpdating}
                    variant="outline"
                    className="w-full"
                    leftIcon={<ArrowPathIcon className="h-5 w-5" />}
                  >
                    Marcar En Revisión
                  </Button>
                )}

                {request.status === 'in_review' && (
                  <Button
                    onClick={handleUnmarkInReview}
                    disabled={isUpdating}
                    isLoading={isUpdating}
                    variant="outline"
                    className="w-full"
                    leftIcon={<ArrowPathIcon className="h-5 w-5" />}
                  >
                    Desmarcar Revisión
                  </Button>
                )}

                {['pending', 'assigned', 'in_review', 'info_requested'].includes(request.status) && (
                  <Button
                    onClick={() => setShowInfoRequestModal(true)}
                    disabled={isUpdating}
                    variant="outline"
                    className="w-full !border-orange-500/50 !text-orange-400 hover:!bg-orange-500/10"
                    leftIcon={<InformationCircleIcon className="h-5 w-5" />}
                  >
                    Solicitar Información
                  </Button>
                )}

                {request.status === 'info_requested' && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-orange-400 text-sm font-medium mb-1 flex items-center gap-1">
                      <InformationCircleIcon className="h-4 w-4" />
                      Esperando información del cliente
                    </p>
                    {request.info_request_message && (
                      <p className="text-neutral-400 text-xs mt-1">
                        Mensaje enviado: &quot;{request.info_request_message}&quot;
                      </p>
                    )}
                    {request.info_request_fields && request.info_request_fields.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-neutral-500 text-xs">Campos solicitados:</p>
                        {request.info_request_fields.map((field) => (
                          <span key={field} className="inline-block text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded mr-1 mb-1">
                            {serviceDetailsLabels[field] || field}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isAdmin && ['pending', 'assigned', 'in_review'].includes(request.status) && (
                  <Button
                    onClick={() => setShowAssignModal(true)}
                    disabled={isUpdating}
                    variant="outline"
                    className="w-full"
                    leftIcon={<UserIcon className="h-5 w-5" />}
                  >
                    {request.assigned_to ? 'Reasignar' : 'Asignar Vendedor'}
                  </Button>
                )}

                {isAdmin && deletableStatuses.includes(request.status) && (
                  <Button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isUpdating || isDeleting}
                    variant="outline"
                    className="w-full !border-red-500/50 !text-red-400 hover:!bg-red-500/10"
                    leftIcon={<TrashIcon className="h-5 w-5" />}
                  >
                    Eliminar Solicitud
                  </Button>
                )}
              </div>
            </Card>

            {/* Assignment Info */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Asignación</h2>
              {request.assigned_to_name ? (
                <div className="p-3 bg-neutral-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cmyk-cyan/20 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-cmyk-cyan" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{request.assigned_to_name}</p>
                      <p className="text-neutral-500 text-xs">
                        {request.assignment_method === 'auto_specialty'
                          ? 'Asignación automática (especialidad)'
                          : request.assignment_method === 'auto_load'
                          ? 'Asignación automática (carga)'
                          : request.assignment_method === 'fallback'
                          ? 'Asignación automática (respaldo)'
                          : 'Asignación manual'}
                      </p>
                    </div>
                  </div>
                  {request.assigned_at && (
                    <p className="text-neutral-500 text-xs mt-2">
                      Asignado el {formatDate(request.assigned_at)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    Sin asignar
                  </p>
                </div>
              )}
            </Card>

            {/* Timeline */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-cmyk-cyan" />
                Historial
              </h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-cmyk-cyan"></div>
                  <div>
                    <p className="text-white text-sm">Solicitud creada</p>
                    <p className="text-neutral-500 text-xs">{formatDate(request.created_at)}</p>
                  </div>
                </div>
                {request.assigned_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-blue-400"></div>
                    <div>
                      <p className="text-white text-sm">Asignada a {request.assigned_to_name}</p>
                      <p className="text-neutral-500 text-xs">{formatDate(request.assigned_at)}</p>
                    </div>
                  </div>
                )}
                {request.status === 'in_review' && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-purple-400"></div>
                    <div>
                      <p className="text-white text-sm">Marcada en revisión</p>
                      <p className="text-neutral-500 text-xs">{formatDate(request.updated_at)}</p>
                    </div>
                  </div>
                )}
                {request.status === 'info_requested' && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-orange-400"></div>
                    <div>
                      <p className="text-white text-sm">Información solicitada al cliente</p>
                      <p className="text-neutral-500 text-xs">{formatDate(request.updated_at)}</p>
                    </div>
                  </div>
                )}
                {request.status === 'quoted' && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-cmyk-cyan"></div>
                    <div>
                      <p className="text-white text-sm">Cotización enviada</p>
                      <p className="text-neutral-500 text-xs">{formatDate(request.updated_at)}</p>
                    </div>
                  </div>
                )}
                {request.status === 'accepted' && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-green-400"></div>
                    <div>
                      <p className="text-white text-sm">Cotización aceptada</p>
                      <p className="text-neutral-500 text-xs">{formatDate(request.updated_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Assign Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Asignar Vendedor</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {salesReps.length === 0 ? (
                  <p className="text-neutral-400 text-center py-4">No hay vendedores disponibles</p>
                ) : (
                  salesReps.map((rep) => (
                    <button
                      key={rep.id}
                      onClick={() => handleAssign(rep.id)}
                      disabled={isUpdating}
                      className="w-full flex items-center gap-3 p-3 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-cmyk-cyan/20 flex items-center justify-center">
                        <UserIcon className="h-5 w-5 text-cmyk-cyan" />
                      </div>
                      <div>
                        <p className="text-white">{rep.full_name}</p>
                        <p className="text-neutral-500 text-sm">{rep.email}</p>
                      </div>
                      {request.assigned_to === rep.id && (
                        <CheckCircleIcon className="h-5 w-5 text-green-400 ml-auto" />
                      )}
                    </button>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-3">
                <Button
                  onClick={() => setShowAssignModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && request && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <TrashIcon className="h-5 w-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Eliminar solicitud</h3>
              </div>
              <p className="text-neutral-400 mb-2">
                ¿Estás seguro de que deseas eliminar la solicitud{' '}
                <span className="text-white font-medium">{request.request_number}</span>?
              </p>
              <p className="text-neutral-500 text-sm mb-6">
                De: {request.customer_name} ({request.customer_email})
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDelete}
                  isLoading={isDeleting}
                  className="!bg-red-600 hover:!bg-red-700 !border-red-600"
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Info Request Modal */}
        {showInfoRequestModal && request && (() => {
          // Build the list of selectable fields from service_details
          const details = (request.service_details || {}) as Record<string, unknown>;
          const internalFields = ['tipo_personalizado', 'subtipo_personalizado', 'material_personalizado',
            'tipo_rotulacion_personalizado', 'producto_personalizado', 'tipo_impresion_personalizado', 'coordenadas'];

          // Format a value for display in the checkbox list
          const formatFieldValue = (key: string, value: unknown): string => {
            if (value === null || value === undefined) return '—';
            if (typeof value === 'boolean') return value ? 'Sí' : 'No';
            if (typeof value === 'object') {
              if (Array.isArray(value)) return `${value.length} elemento(s)`;
              return '(ver detalle)';
            }
            // Try to resolve subtype labels
            if (['subtipo', 'tipo', 'tipo_anuncio', 'tipo_rotulacion', 'material', 'uso',
              'uso_diseno', 'tipo_impresion', 'servicio', 'producto'].includes(key)) {
              return subtipoLabels[String(value)] || String(value);
            }
            return String(value);
          };

          // Collect displayable field entries
          const fieldEntries = Object.entries(details)
            .filter(([key]) => !internalFields.includes(key))
            .map(([key, value]) => ({
              key,
              label: serviceDetailsLabels[key] || key,
              displayValue: formatFieldValue(key, value),
              isRoutes: key === 'rutas',
            }));

          const toggleField = (key: string) => {
            setSelectedInfoFields(prev =>
              prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
            );
          };

          const toggleAll = () => {
            if (selectedInfoFields.length === fieldEntries.length) {
              setSelectedInfoFields([]);
            } else {
              setSelectedInfoFields(fieldEntries.map(f => f.key));
            }
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <InformationCircleIcon className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Solicitar Información</h3>
                    <p className="text-neutral-500 text-xs">
                      {SERVICE_LABELS[request.service_type as ServiceId] || request.service_type}
                    </p>
                  </div>
                </div>

                <p className="text-neutral-400 mb-4 text-sm">
                  Se enviará un correo a <span className="text-white font-medium">{request.customer_email}</span> con
                  un enlace para completar la información. Selecciona los campos que necesitan revisión.
                </p>

                {/* Selectable fields */}
                {fieldEntries.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm text-neutral-300 font-medium">
                        Campos a revisar / completar
                      </label>
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-xs text-cmyk-cyan hover:underline"
                      >
                        {selectedInfoFields.length === fieldEntries.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                      </button>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {fieldEntries.map(({ key, label, displayValue, isRoutes }) => (
                        <label
                          key={key}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                            selectedInfoFields.includes(key)
                              ? 'bg-orange-500/15 border border-orange-500/40'
                              : 'bg-neutral-800/50 border border-transparent hover:bg-neutral-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedInfoFields.includes(key)}
                            onChange={() => toggleField(key)}
                            className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-orange-500 focus:ring-orange-500/50 focus:ring-offset-0 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-white text-sm">{label}</span>
                            {!isRoutes && (
                              <span className="text-neutral-500 text-xs ml-2 truncate">
                                ({displayValue})
                              </span>
                            )}
                            {isRoutes && (
                              <span className="text-neutral-500 text-xs ml-2">
                                ({displayValue})
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedInfoFields.length > 0 && (
                      <p className="text-orange-400/70 text-xs mt-2">
                        {selectedInfoFields.length} campo(s) seleccionado(s)
                      </p>
                    )}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm text-neutral-300 mb-2">
                    Mensaje para el cliente *
                  </label>
                  <textarea
                    value={infoRequestMessage}
                    onChange={(e) => setInfoRequestMessage(e.target.value)}
                    placeholder="Ej: Necesitamos que nos indiques la ruta deseada para tu servicio de publicidad móvil..."
                    rows={3}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white placeholder-neutral-500 focus:border-cmyk-cyan focus:outline-none resize-none text-sm"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowInfoRequestModal(false);
                      setInfoRequestMessage('');
                      setSelectedInfoFields([]);
                    }}
                    disabled={isSendingInfoRequest}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleRequestInfo}
                    isLoading={isSendingInfoRequest}
                    disabled={!infoRequestMessage.trim()}
                    className="!bg-orange-600 hover:!bg-orange-700 !border-orange-600"
                  >
                    Enviar solicitud
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
