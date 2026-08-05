'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  MapPinIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { Card, Button, LoadingPage } from '@/components/ui';
import { serviceDetailsLabels } from '@/components/quotes/ServiceDetailsDisplay';
import {
  getQuoteRequestByInfoToken,
  submitQuoteRequestInfo,
} from '@/lib/api/quotes';

// Dynamic import of RouteSelector (needs Leaflet, SSR disabled)
const RouteSelector = dynamic(
  () => import('@/components/landing/RouteSelector').then(mod => mod.RouteSelector),
  { ssr: false, loading: () => <div className="h-12 bg-neutral-800 rounded-lg animate-pulse" /> }
);

interface RouteInfo {
  pointA: { name: string; lat: number; lon: number } | null;
  pointB: { name: string; lat: number; lon: number } | null;
  routeData: { coordinates: Array<[number, number]>; distance: number; duration: number } | null;
}

interface RouteEntry {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  horarioInicio: string;
  horarioFin: string;
  route: RouteInfo | null;
}

interface EstablishedRouteEntry {
  id: string;
  ruta: string;
  fechaInicio: string;
}

const ESTABLISHED_ROUTES: Record<string, string> = {
  'zocalo-base': 'Zócalo — Base',
  'colosio-zocalo': 'Colosio — Zócalo',
};

/** Add N business days (Mon–Fri) to a given date. Returns YYYY-MM-DD. */
const addBusinessDays = (from: Date, days: number): string => {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result.toISOString().split('T')[0];
};

/** Minimum start date: 8 business days from today */
const MIN_ROUTE_START_DATE = addBusinessDays(new Date(), 8);

export default function CompletarSolicitudPage() {
  const params = useParams();
  const token = params.token as string;

  const [requestData, setRequestData] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Route state for vallas-moviles / perifoneo
  const [configurableRoutes, setConfigurableRoutes] = useState<RouteEntry[]>([
    { id: '1', fechaInicio: '', fechaFin: '', horarioInicio: '', horarioFin: '', route: null },
  ]);

  // Route state for publibuses
  const [establishedRoutes, setEstablishedRoutes] = useState<EstablishedRouteEntry[]>([
    { id: '1', ruta: '', fechaInicio: '' },
  ]);

  const serviceType = requestData?.service_type as string || '';
  const serviceDetails = requestData?.service_details as Record<string, unknown> || {};
  const subType = (serviceDetails?.subType as string) || '';

  const isVallas = subType === 'vallas-moviles';
  const isPerifoneo = subType === 'perifoneo';
  const isPublibuses = subType === 'publibuses';
  const needsMapRoute = isVallas || isPerifoneo;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getQuoteRequestByInfoToken(token);
        setRequestData(data);

        // Pre-populate existing routes from service_details if any
        const sd = data.service_details as Record<string, unknown> || {};
        if (sd.rutas && Array.isArray(sd.rutas)) {
          const existingRoutes = sd.rutas as RouteEntry[];
          if (existingRoutes.length > 0) {
            setConfigurableRoutes(existingRoutes.map((r, i) => ({
              id: String(i + 1),
              fechaInicio: r.fechaInicio || '',
              fechaFin: r.fechaFin || '',
              horarioInicio: r.horarioInicio || '',
              horarioFin: r.horarioFin || '',
              route: r.route || null,
            })));
          }
        }
        if (sd.rutasEstablecidas && Array.isArray(sd.rutasEstablecidas)) {
          const existingEstablished = sd.rutasEstablecidas as EstablishedRouteEntry[];
          if (existingEstablished.length > 0) {
            setEstablishedRoutes(existingEstablished.map((r, i) => ({
              id: String(i + 1),
              ruta: r.ruta || '',
              fechaInicio: r.fechaInicio || '',
            })));
          }
        }
      } catch {
        setError('No se encontró la solicitud o el enlace ya no es válido.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const addConfigurableRoute = () => {
    setConfigurableRoutes(prev => [
      ...prev,
      { id: String(Date.now()), fechaInicio: '', fechaFin: '', horarioInicio: '', horarioFin: '', route: null },
    ]);
  };

  const removeConfigurableRoute = (id: string) => {
    if (configurableRoutes.length <= 1) return;
    setConfigurableRoutes(prev => prev.filter(r => r.id !== id));
  };

  const updateConfigurableRoute = (id: string, field: keyof RouteEntry, value: unknown) => {
    setConfigurableRoutes(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addEstablishedRoute = () => {
    setEstablishedRoutes(prev => [
      ...prev,
      { id: String(Date.now()), ruta: '', fechaInicio: '' },
    ]);
  };

  const removeEstablishedRoute = (id: string) => {
    if (establishedRoutes.length <= 1) return;
    setEstablishedRoutes(prev => prev.filter(r => r.id !== id));
  };

  const updateEstablishedRoute = (id: string, field: keyof EstablishedRouteEntry, value: string) => {
    setEstablishedRoutes(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSubmit = async () => {
    // ── Validate configurable routes (vallas / perifoneo) ──
    if (needsMapRoute) {
      const hasRouteData = configurableRoutes.some(
        r => r.route?.pointA && r.route?.pointB && r.route?.routeData
      );
      if (!hasRouteData) {
        toast.error('Debes trazar al menos una ruta en el mapa.');
        return;
      }
      // Every route must have a drawn route
      const missingRoute = configurableRoutes.find(
        r => !r.route?.pointA || !r.route?.pointB || !r.route?.routeData
      );
      if (missingRoute) {
        toast.error('Todas las rutas deben tener la ruta trazada en el mapa.');
        return;
      }
      // Every route must have schedule
      const missingSchedule = configurableRoutes.find(
        r => !r.fechaInicio || !r.horarioInicio || !r.horarioFin
      );
      if (missingSchedule) {
        toast.error('Cada ruta debe tener fecha de inicio, horario de inicio y horario de fin.');
        return;
      }
      // Every route must have fecha fin
      const missingEndDate = configurableRoutes.find(r => !r.fechaFin);
      if (missingEndDate) {
        toast.error('Cada ruta debe tener fecha de fin.');
        return;
      }
      // fecha fin >= fecha inicio
      const invalidDateRange = configurableRoutes.find(
        r => r.fechaInicio && r.fechaFin && r.fechaFin < r.fechaInicio
      );
      if (invalidDateRange) {
        toast.error('La fecha de fin de cada ruta debe ser igual o posterior a la fecha de inicio.');
        return;
      }
      // Minimum 8 business days
      const dateTooEarly = configurableRoutes.find(
        r => r.fechaInicio && r.fechaInicio < MIN_ROUTE_START_DATE
      );
      if (dateTooEarly) {
        toast.error('Las fechas de inicio deben ser al menos 8 días hábiles a partir de hoy.');
        return;
      }
      // Horario within 07:00–19:00
      const invalidTime = configurableRoutes.find(
        r => (r.horarioInicio && (r.horarioInicio < '07:00' || r.horarioInicio > '19:00')) ||
             (r.horarioFin && (r.horarioFin < '07:00' || r.horarioFin > '19:00'))
      );
      if (invalidTime) {
        toast.error('El horario debe estar entre 7:00 y 19:00.');
        return;
      }
    }

    // ── Validate established routes (publibuses) ──
    if (isPublibuses) {
      const hasValidRoute = establishedRoutes.some(r => r.ruta && r.fechaInicio);
      if (!hasValidRoute) {
        toast.error('Selecciona al menos una ruta preestablecida con fecha de inicio.');
        return;
      }
      const missingFields = establishedRoutes.find(r => !r.ruta || !r.fechaInicio);
      if (missingFields) {
        toast.error('Cada ruta debe tener una ruta seleccionada y una fecha de inicio.');
        return;
      }
      const dateTooEarly = establishedRoutes.find(
        r => r.fechaInicio && r.fechaInicio < MIN_ROUTE_START_DATE
      );
      if (dateTooEarly) {
        toast.error('Las fechas de inicio deben ser al menos 8 días hábiles a partir de hoy.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const updatedDetails: Record<string, unknown> = {};

      if (needsMapRoute) {
        updatedDetails.rutas = configurableRoutes.map(r => ({
          fechaInicio: r.fechaInicio,
          fechaFin: r.fechaFin,
          horarioInicio: r.horarioInicio,
          horarioFin: r.horarioFin,
          route: r.route,
        }));
      }

      if (isPublibuses) {
        updatedDetails.rutasEstablecidas = establishedRoutes.map(r => ({
          ruta: r.ruta,
          fechaInicio: r.fechaInicio,
        }));
      }

      await submitQuoteRequestInfo(token, updatedDetails);
      setIsSubmitted(true);
      toast.success('¡Información enviada exitosamente!');
    } catch {
      toast.error('Error al enviar la información. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingPage message="Cargando solicitud..." />;
  }

  if (error || !requestData) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Enlace no válido</h1>
          <p className="text-neutral-400">{error || 'No se pudo cargar la solicitud.'}</p>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">¡Información recibida!</h1>
          <p className="text-neutral-400">
            Hemos recibido la información de tu solicitud #{String(requestData.request_number)}.
            Nuestro equipo preparará tu cotización a la brevedad.
          </p>
        </Card>
      </div>
    );
  }

  if (String(requestData.status) !== 'info_requested') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <InformationCircleIcon className="h-16 w-16 text-cmyk-cyan mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Solicitud ya completada</h1>
          <p className="text-neutral-400">
            La información de tu solicitud #{String(requestData.request_number)} ya fue recibida.
            Gracias por tu respuesta.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center gap-4">
          <Image
            src="/images/logo.webp"
            alt="MCD Agencia"
            width={48}
            height={48}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-xl font-bold text-white">Completar Solicitud</h1>
            <p className="text-neutral-400 text-sm">
              Solicitud #{String(requestData.request_number)} — {String(requestData.customer_name)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Vendor message */}
        {Boolean(requestData.info_request_message) && (
          <Card className="p-6 border-orange-500/30 bg-orange-500/5">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="h-6 w-6 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-white font-semibold mb-1">Mensaje del equipo</h2>
                <p className="text-neutral-300 text-sm whitespace-pre-wrap">
                  {String(requestData.info_request_message)}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Flagged fields — which fields the vendor needs the customer to review */}
        {Array.isArray(requestData.info_request_fields) && (requestData.info_request_fields as string[]).length > 0 && (
          <Card className="p-6 border-amber-500/30 bg-amber-500/5">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />
              Campos que necesitan revisión
            </h2>
            <p className="text-neutral-400 text-sm mb-3">
              Nuestro equipo necesita que revises o completes la siguiente información:
            </p>
            <div className="space-y-1.5">
              {(requestData.info_request_fields as string[]).map((fieldKey) => (
                <div key={fieldKey} className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <span className="text-amber-400 font-bold text-xs">▸</span>
                  <span className="text-white text-sm">
                    {serviceDetailsLabels[fieldKey] || fieldKey}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Request summary */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Resumen de tu solicitud</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-neutral-500">Servicio:</span>
              <span className="text-white ml-2">{String(requestData.catalog_item_name)}</span>
            </div>
            {Boolean(requestData.description) && (
              <div className="md:col-span-2">
                <span className="text-neutral-500">Descripción:</span>
                <span className="text-white ml-2">{String(requestData.description)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Route form — configurable routes (vallas / perifoneo) */}
        {needsMapRoute && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-cmyk-cyan" />
              {isVallas ? 'Rutas para Vallas Móviles' : 'Rutas para Perifoneo'}
            </h2>
            <p className="text-neutral-400 text-sm mb-2">
              Por favor traza la(s) ruta(s) que deseas en el mapa e indica las fechas y horarios.
            </p>
            <p className="text-xs text-amber-400/90 mb-6 flex items-start gap-1">
              <span className="mt-0.5">⏱️</span>
              <span>Mínimo 8 días hábiles de anticipación. Los días se cuentan a partir de que el pago se realiza (es decir, se concreta el pedido).</span>
            </p>

            <div className="space-y-6">
              {configurableRoutes.map((entry, index) => (
                <div key={entry.id} className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">Ruta {index + 1}</h3>
                    {configurableRoutes.length > 1 && (
                      <button
                        onClick={() => removeConfigurableRoute(entry.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Route selector */}
                  <div>
                    <label className="block text-sm text-neutral-300 mb-2">
                      Trazar ruta en mapa <span className="text-red-400">*</span>
                    </label>
                    <RouteSelector
                      onChange={(routeData: RouteInfo) => updateConfigurableRoute(entry.id, 'route', routeData)}
                      initialPointA={entry.route?.pointA}
                      initialPointB={entry.route?.pointB}
                    />
                    {entry.route?.routeData && (
                      <p className="text-green-400 text-xs mt-1">
                        ✓ Ruta trazada ({(entry.route.routeData.distance / 1000).toFixed(1)} km)
                      </p>
                    )}
                    {!entry.route?.routeData && (
                      <p className="text-orange-400 text-xs mt-1">
                        ⚠ Haz clic en el botón para trazar tu ruta en el mapa
                      </p>
                    )}
                  </div>

                  {/* Dates and schedule */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-neutral-300 mb-1">Fecha Inicio <span className="text-red-400">*</span></label>
                      <input
                        type="date"
                        min={MIN_ROUTE_START_DATE}
                        value={entry.fechaInicio}
                        onChange={(e) => {
                          updateConfigurableRoute(entry.id, 'fechaInicio', e.target.value);
                          // Auto-adjust fechaFin if it's before the new fechaInicio
                          if (entry.fechaFin && entry.fechaFin < e.target.value) {
                            updateConfigurableRoute(entry.id, 'fechaFin', e.target.value);
                          }
                        }}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white focus:border-cmyk-cyan focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-neutral-300 mb-1">Fecha Fin <span className="text-red-400">*</span></label>
                      <input
                        type="date"
                        min={entry.fechaInicio || MIN_ROUTE_START_DATE}
                        value={entry.fechaFin}
                        onChange={(e) => updateConfigurableRoute(entry.id, 'fechaFin', e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white focus:border-cmyk-cyan focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-neutral-300 mb-1">Horario Inicio <span className="text-red-400">*</span></label>
                      <input
                        type="time"
                        min="07:00" max="19:00"
                        value={entry.horarioInicio}
                        onChange={(e) => updateConfigurableRoute(entry.id, 'horarioInicio', e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white focus:border-cmyk-cyan focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-neutral-300 mb-1">Horario Fin <span className="text-red-400">*</span></label>
                      <input
                        type="time"
                        min="07:00" max="19:00"
                        value={entry.horarioFin}
                        onChange={(e) => updateConfigurableRoute(entry.id, 'horarioFin', e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white focus:border-cmyk-cyan focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 -mt-2">Horario permitido: 7:00 a 19:00</p>
                </div>
              ))}

              <button
                onClick={addConfigurableRoute}
                className="flex items-center gap-2 text-cmyk-cyan hover:text-cmyk-cyan/80 text-sm"
              >
                <PlusIcon className="h-4 w-4" /> Agregar otra ruta
              </button>
            </div>
          </Card>
        )}

        {/* Route form — established routes (publibuses) */}
        {isPublibuses && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-cmyk-cyan" />
              Rutas para Publibuses
            </h2>
            <p className="text-neutral-400 text-sm mb-2">
              Selecciona la(s) ruta(s) preestablecidas que deseas e indica la fecha de inicio.
            </p>
            <p className="text-xs text-amber-400/90 mb-6 flex items-start gap-1">
              <span className="mt-0.5">⏱️</span>
              <span>Mínimo 8 días hábiles de anticipación. Los días se cuentan a partir de que el pago se realiza (es decir, se concreta el pedido).</span>
            </p>

            <div className="space-y-4">
              {establishedRoutes.map((entry, index) => (
                <div key={entry.id} className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-medium">Ruta {index + 1}</h3>
                    {establishedRoutes.length > 1 && (
                      <button
                        onClick={() => removeEstablishedRoute(entry.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-neutral-300 mb-1">Ruta *</label>
                      <select
                        value={entry.ruta}
                        onChange={(e) => updateEstablishedRoute(entry.id, 'ruta', e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white focus:border-cmyk-cyan focus:outline-none"
                      >
                        <option value="">Seleccionar ruta</option>
                        {Object.entries(ESTABLISHED_ROUTES).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-neutral-300 mb-1">Fecha Inicio <span className="text-red-400">*</span></label>
                      <input
                        type="date"
                        min={MIN_ROUTE_START_DATE}
                        value={entry.fechaInicio}
                        onChange={(e) => updateEstablishedRoute(entry.id, 'fechaInicio', e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white focus:border-cmyk-cyan focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addEstablishedRoute}
                className="flex items-center gap-2 text-cmyk-cyan hover:text-cmyk-cyan/80 text-sm"
              >
                <PlusIcon className="h-4 w-4" /> Agregar otra ruta
              </button>
            </div>
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-center pt-4 pb-12">
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            className="px-8 py-3 text-lg"
          >
            Enviar información
          </Button>
        </div>
      </main>
    </div>
  );
}
