'use client';

import dynamic from 'next/dynamic';
import {
  MapPinIcon,
  TruckIcon,
  PrinterIcon,
  WrenchScrewdriverIcon,
  ClockIcon,
  ChatBubbleLeftIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline';

const RouteMapPreview = dynamic(
  () => import('./RouteMapPreview').then(mod => mod.RouteMapPreview),
  { ssr: false, loading: () => <div className="h-[200px] bg-neutral-800 rounded-lg animate-pulse" /> }
);

// Labels for service-specific fields
export const serviceDetailsLabels: Record<string, string> = {
  // General
  subtipo: 'Subtipo',
  tipo: 'Tipo',
  tipo_anuncio: 'Tipo de anuncio',
  tipo_vehiculo: 'Tipo de vehículo',
  tipo_rotulacion: 'Tipo de rotulación',
  tipo_diseno: 'Tipo de diseño',
  tipo_impresion: 'Tipo de impresión',
  tipo_servicio: 'Tipo de servicio',
  descripcion: 'Descripción',

  // Campos personalizados (indicadores)
  tipo_personalizado: 'Tipo personalizado',
  subtipo_personalizado: 'Subtipo personalizado',
  material_personalizado: 'Material personalizado',
  tipo_rotulacion_personalizado: 'Tipo personalizado',
  producto_personalizado: 'Producto personalizado',
  tipo_impresion_personalizado: 'Tipo de impresión personalizado',

  // Medidas y cantidades
  medidas: 'Medidas',
  cantidad: 'Cantidad',
  numero_piezas: 'Número de piezas',

  // Ubicación y zona
  ubicacion: 'Ubicación',
  zona: 'Zona de circulación',
  ciudad_zona: 'Ciudad / Zona',
  zona_cobertura: 'Zona de cobertura',

  // Tiempos
  tiempo_exhibicion: 'Tiempo de exhibición',
  tiempo_campana: 'Tiempo de campaña',
  duracion: 'Duración',

  // Inclusiones (booleanos)
  impresion_incluida: 'Impresión incluida',
  instalacion_incluida: 'Instalación incluida',
  iluminacion: 'Iluminación',
  diseno_incluido: 'Diseño incluido',
  archivo_listo: 'Archivo listo para imprimir',
  archivo_grabacion_proporcionado: 'Archivo de grabación proporcionado',
  requiere_grabacion: 'Requiere grabación',
  cambios_incluidos: 'Cambios incluidos',

  // Otros
  uso: 'Uso',
  uso_diseno: 'Uso del diseño',
  material: 'Material',
  producto: 'Producto',
  servicio: 'Servicio',

  // Ruta
  ruta: 'Ruta de circulación',
  delimitacion_zona: 'Delimitación de zona',
  punto_a: 'Punto de inicio',
  punto_b: 'Punto final',
  distancia_metros: 'Distancia',

  // Rutas (array)
  rutas: 'Rutas',
  meses_campana: 'Meses de campaña',
  ruta_preestablecida: 'Ruta preestablecida',
  fecha_inicio: 'Fecha inicio',
  fecha_fin: 'Fecha fin',
  horario_inicio: 'Horario inicio',
  horario_fin: 'Horario fin',
  numero: 'Número de ruta',
  duracion_segundos: 'Duración estimada',
};

// Labels for subtypes
export const subtipoLabels: Record<string, string> = {
  'vallas-moviles': 'Vallas móviles',
  'publibuses': 'Publibuses',
  'perifoneo': 'Perifoneo',
  'unipolar': 'Unipolar',
  'azotea': 'Azotea',
  'mural': 'Mural publicitario',
  'cajas-luz': 'Cajas de luz',
  'letras-3d': 'Letras 3D',
  'anuncios-2d': 'Anuncios 2D',
  'bastidores': 'Bastidores',
  'toldos': 'Toldos',
  'neon': 'Neón',
  'completa': 'Rotulación completa',
  'parcial': 'Rotulación parcial',
  'vinil-recortado': 'Vinil recortado',
  'impresion-digital': 'Impresión digital',
  'lona': 'Lona',
  'vinil': 'Vinil',
  'tela': 'Tela',
  'corte': 'Corte',
  'grabado': 'Grabado',
  'offset': 'Offset',
  'serigrafia': 'Serigrafía',
  'sublimacion': 'Sublimación',
  'interior': 'Interior',
  'exterior': 'Exterior',
  'impresion': 'Impresión',
  'digital': 'Digital',
  'ambos': 'Ambos',
  'tarjetas-presentacion': 'Tarjetas de presentación',
  'volantes': 'Volantes',
  'router-cnc': 'Router CNC',
  'corte-laser': 'Corte Láser',
  'grabado-laser': 'Grabado Láser',
  'logotipos': 'Logotipos',
  'papeleria': 'Papelería',
  'redes-sociales': 'Redes Sociales',
  'otro': 'Otro',
  // Rutas preestablecidas publibuses
  'zocalo-base': 'Zócalo Base',
  'colosio-zocalo': 'Colosio Zócalo',
};

// Google My Maps embed URLs for predefined publibus routes
const publibusMapUrls: Record<string, string> = {
  'zocalo-base':
    'https://www.google.com/maps/d/embed?mid=1VXvDDqbLCqv54dbwkmtfNs8XKjUxzvo&ll=16.835724183151132%2C-99.87844209999999&z=13',
  'colosio-zocalo':
    'https://www.google.com/maps/d/embed?mid=1NrsT2SEvgGKOh7NusgOHD6-NJd4h1GE&ll=16.82830914325928%2C-99.85695&z=13',
};

interface ServiceDetailsDisplayProps {
  serviceType?: string;
  serviceDetails?: Record<string, unknown>;
  routePrices?: Record<number, string>;
}

export function ServiceDetailsDisplay({ serviceType, serviceDetails, routePrices }: ServiceDetailsDisplayProps) {
  if (!serviceDetails || Object.keys(serviceDetails).length === 0) {
    return null;
  }

  // Context-aware label for the 'tipo' field based on service
  const tipoLabel = (() => {
    switch (serviceType) {
      case 'espectaculares': return 'Tipo de espectacular';
      case 'fabricacion-anuncios': return 'Tipo de anuncio';
      case 'senalizacion': return 'Tipo de señalización';
      case 'rotulacion-vehicular': return 'Tipo de rotulación';
      case 'corte-grabado-cnc-laser': return 'Tipo de proceso';
      case 'diseno-grafico': return 'Tipo de diseño';
      case 'impresion-offset-serigrafia': return 'Tipo de impresión';
      default: return 'Tipo';
    }
  })();

  const formatValue = (key: string, value: unknown): string | JSX.Element => {
    if (value === null || value === undefined) return '-';

    // Boolean values
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }

    // Subtypes
    if (key === 'subtipo' || key === 'tipo' || key === 'tipo_anuncio' || key === 'tipo_rotulacion' ||
        key === 'material' || key === 'uso' || key === 'uso_diseno' || key === 'tipo_impresion' ||
        key === 'servicio' || key === 'producto') {
      return subtipoLabels[value as string] || String(value);
    }

    // Distance in meters
    if (key === 'distancia_metros' && typeof value === 'number') {
      if (value >= 1000) {
        return `${(value / 1000).toFixed(2)} km`;
      }
      return `${value.toFixed(0)} m`;
    }

    // Route object with coordinates
    if ((key === 'ruta' || key === 'delimitacion_zona') && typeof value === 'object' && value !== null) {
      const routeData = value as Record<string, unknown>;
      const pointA = routeData.punto_a as { name: string; lat: number; lon: number } | null;
      const pointB = routeData.punto_b as { name: string; lat: number; lon: number } | null;
      const distance = routeData.distancia_metros as number | undefined;

      return (
        <div className="space-y-2">
          {pointA && (
            <div className="flex items-start gap-2">
              <MapPinIcon className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-neutral-400 text-xs">Inicio:</span>
                <p className="text-white text-sm">{pointA.name || `${pointA.lat.toFixed(5)}, ${pointA.lon.toFixed(5)}`}</p>
              </div>
            </div>
          )}
          {pointB && (
            <div className="flex items-start gap-2">
              <MapPinIcon className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-neutral-400 text-xs">Fin:</span>
                <p className="text-white text-sm">{pointB.name || `${pointB.lat.toFixed(5)}, ${pointB.lon.toFixed(5)}`}</p>
              </div>
            </div>
          )}
          {distance && (
            <div className="flex items-center gap-2 mt-1">
              <TruckIcon className="h-4 w-4 text-cmyk-cyan flex-shrink-0" />
              <span className="text-cmyk-cyan font-medium">
                {distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance.toFixed(0)} m`}
              </span>
            </div>
          )}
          {/* Read-only map preview */}
          {pointA && pointA.lat && pointA.lon && (
            <div className="mt-2 relative z-0">
              <RouteMapPreview
                pointA={pointA}
                pointB={pointB}
                height={180}
              />
            </div>
          )}
        </div>
      );
    }

    return String(value);
  };

  const getIcon = (key: string) => {
    if (key === 'ruta' || key === 'delimitacion_zona' || key === 'ubicacion' || key === 'zona' || key === 'ciudad_zona' || key === 'zona_cobertura') {
      return <MapPinIcon className="h-4 w-4 text-cmyk-cyan" />;
    }
    if (key.includes('impresion') || key === 'archivo_listo') {
      return <PrinterIcon className="h-4 w-4 text-cmyk-magenta" />;
    }
    if (key.includes('instalacion') || key === 'iluminacion') {
      return <WrenchScrewdriverIcon className="h-4 w-4 text-cmyk-yellow" />;
    }
    return null;
  };

  // Order keys for better display
  const keyOrder = [
    'tipo_servicio', 'subtipo', 'tipo', 'tipo_anuncio', 'tipo_vehiculo', 'tipo_rotulacion', 'tipo_diseno',
    'descripcion', 'cantidad', 'numero_piezas', 'medidas', 'material', 'producto',
    'ubicacion', 'zona', 'ciudad_zona', 'zona_cobertura',
    'tiempo_exhibicion', 'tiempo_campana', 'duracion',
    'uso', 'uso_diseno', 'servicio', 'tipo_impresion',
    'impresion_incluida', 'instalacion_incluida', 'iluminacion', 'diseno_incluido',
    'archivo_listo', 'archivo_grabacion_proporcionado', 'requiere_grabacion', 'cambios_incluidos',
    'ruta', 'delimitacion_zona',
  ];

  const sortedKeys = Object.keys(serviceDetails).sort((a, b) => {
    const indexA = keyOrder.indexOf(a);
    const indexB = keyOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Fields to hide (internal indicators + fields not filled by client form + delivery fields handled separately)
  const hiddenFields = [
    'service_type',                 // already used as serviceType prop — never show raw slug
    'ruta', 'delimitacion_zona', 'coordenadas', 'rutas',
    'tipo_personalizado', 'subtipo_personalizado', 'material_personalizado',
    'tipo_rotulacion_personalizado', 'producto_personalizado', 'tipo_impresion_personalizado',
    'tipo_otro',
    // These fields are NOT collected by the client quote form
    'instalacion_incluida',
    'ubicacion',
    // Delivery-related fields are rendered separately by the parent — never show as raw grid items
    'delivery_method', 'delivery_address', 'pickup_branch', 'required_date',
    // Vendor internal flag
    'vendor_added',
    // For espectaculares, 'subtipo' is a duplicate of 'tipo' — hide it
    ...(serviceType === 'espectaculares' && serviceDetails.tipo ? ['subtipo'] : []),
  ];

  // Separate route/complex fields from simple fields
  const simpleFields = sortedKeys.filter(key =>
    !hiddenFields.includes(key)
  );
  const complexFields = sortedKeys.filter(key =>
    key === 'ruta' || key === 'delimitacion_zona'
  );

  // Routes array (vallas, publibuses, perifoneo)
  const rutasArray = serviceDetails.rutas as Array<Record<string, unknown>> | undefined;
  const subtipo = serviceDetails.subtipo as string | undefined;

  return (
    <div className="space-y-4">
      {/* Simple fields in uniform grid */}
      <div className="grid grid-cols-2 gap-3">
        {simpleFields.map((key) => {
          const value = serviceDetails[key];
          if (value === null || value === undefined || value === '' || key === 'coordenadas') return null;

          const formattedValue = formatValue(key, value);
          const icon = getIcon(key);
          // Use context-aware label for 'tipo'
          const label = key === 'tipo' ? tipoLabel : (serviceDetailsLabels[key] || key);

          return (
            <div key={key} className="p-3 bg-neutral-800/50 rounded-lg flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                {icon}
                <p className="text-neutral-500 text-xs">{label}</p>
              </div>
              <p className="text-white font-medium mt-auto">
                {typeof formattedValue === 'string' ? formattedValue : formattedValue}
              </p>
            </div>
          );
        })}
      </div>

      {/* Complex fields (single route object) */}
      {complexFields.map((key) => {
        const value = serviceDetails[key];
        if (value === null || value === undefined) return null;

        return (
          <div key={key} className="p-4 bg-neutral-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <MapPinIcon className="h-5 w-5 text-cmyk-cyan" />
              <p className="text-neutral-400 text-sm font-medium">{serviceDetailsLabels[key] || key}</p>
            </div>
            {formatValue(key, value)}
          </div>
        );
      })}

      {/* Routes array (vallas-moviles, publibuses, perifoneo) */}
      {rutasArray && rutasArray.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5 text-cmyk-cyan" />
            <p className="text-neutral-400 text-sm font-medium">
              {subtipo === 'publibuses' ? 'Rutas preestablecidas' : 'Rutas de circulación'}
              <span className="ml-2 text-neutral-500">({rutasArray.length})</span>
            </p>
          </div>

          {rutasArray.map((ruta, idx) => {
            const routeObj = ruta.ruta as Record<string, unknown> | null;

            return (
              <div key={idx} className="rounded-xl border border-neutral-700 bg-neutral-800/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-cmyk-cyan">Ruta {ruta.numero as number || idx + 1}</span>
                  {routePrices && routePrices[idx] !== undefined && (
                    <span className="text-green-400 text-xs font-semibold">{routePrices[idx]}</span>
                  )}
                </div>

                {/* Publibuses: ruta preestablecida */}
                {subtipo === 'publibuses' && !!ruta.ruta_preestablecida && (
                  <div className="space-y-3">
                    <div className="p-3 bg-neutral-800/50 rounded-lg">
                      <p className="text-neutral-500 text-xs">Ruta preestablecida</p>
                      <p className="text-white font-medium">
                        {subtipoLabels[ruta.ruta_preestablecida as string] || String(ruta.ruta_preestablecida)}
                      </p>
                    </div>
                    {/* Google My Maps embed for predefined publibus route */}
                    {publibusMapUrls[ruta.ruta_preestablecida as string] && (
                      <div className="rounded-xl overflow-hidden border border-cmyk-cyan/30 bg-neutral-900">
                        <div className="p-2.5 bg-neutral-800/50 border-b border-neutral-700">
                          <p className="text-xs text-cmyk-cyan font-medium flex items-center gap-2">
                            <MapPinIcon className="h-3.5 w-3.5" />
                            {subtipoLabels[ruta.ruta_preestablecida as string] || String(ruta.ruta_preestablecida)}
                          </p>
                        </div>
                        <iframe
                          src={publibusMapUrls[ruta.ruta_preestablecida as string]}
                          width="100%"
                          height="200"
                          style={{ border: 0, minHeight: '180px' }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          className="w-full"
                          title={`Ruta ${subtipoLabels[ruta.ruta_preestablecida as string] || ruta.ruta_preestablecida}`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Dates and times grid */}
                <div className="grid grid-cols-2 gap-2">
                  {!!ruta.fecha_inicio && (
                    <div className="p-2.5 bg-neutral-800/50 rounded-lg">
                      <p className="text-neutral-500 text-xs">Fecha inicio</p>
                      <p className="text-white text-sm font-medium">{String(ruta.fecha_inicio)}</p>
                    </div>
                  )}
                  {!!ruta.fecha_fin && (
                    <div className="p-2.5 bg-neutral-800/50 rounded-lg">
                      <p className="text-neutral-500 text-xs">Fecha fin{subtipo === 'publibuses' ? ' (auto)' : ''}</p>
                      <p className="text-white text-sm font-medium">{String(ruta.fecha_fin)}</p>
                    </div>
                  )}
                  {!!ruta.horario_inicio && (
                    <div className="p-2.5 bg-neutral-800/50 rounded-lg">
                      <p className="text-neutral-500 text-xs">Horario inicio</p>
                      <p className="text-white text-sm font-medium">{String(ruta.horario_inicio)}</p>
                    </div>
                  )}
                  {!!ruta.horario_fin && (
                    <div className="p-2.5 bg-neutral-800/50 rounded-lg">
                      <p className="text-neutral-500 text-xs">Horario fin</p>
                      <p className="text-white text-sm font-medium">{String(ruta.horario_fin)}</p>
                    </div>
                  )}
                </div>

                {/* Route map data (vallas / perifoneo) */}
                {routeObj && (
                  <div className="p-3 bg-neutral-800/50 rounded-lg space-y-2">
                    {!!routeObj.punto_a && (() => {
                      const pa = routeObj.punto_a as { name?: string; lat?: number; lon?: number };
                      return (
                        <div className="flex items-start gap-2">
                          <MapPinIcon className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-neutral-400 text-xs">Inicio:</span>
                            <p className="text-white text-sm break-words">{pa.name || `${pa.lat?.toFixed(5)}, ${pa.lon?.toFixed(5)}`}</p>
                          </div>
                        </div>
                      );
                    })()}
                    {!!routeObj.punto_b && (() => {
                      const pb = routeObj.punto_b as { name?: string; lat?: number; lon?: number };
                      return (
                        <div className="flex items-start gap-2">
                          <MapPinIcon className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-neutral-400 text-xs">Fin:</span>
                            <p className="text-white text-sm break-words">{pb.name || `${pb.lat?.toFixed(5)}, ${pb.lon?.toFixed(5)}`}</p>
                          </div>
                        </div>
                      );
                    })()}
                    {!!routeObj.distancia_metros && (() => {
                      const d = routeObj.distancia_metros as number;
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          <TruckIcon className="h-4 w-4 text-cmyk-cyan flex-shrink-0" />
                          <span className="text-cmyk-cyan font-medium text-sm">
                            {d >= 1000 ? `${(d / 1000).toFixed(2)} km` : `${d.toFixed(0)} m`}
                          </span>
                        </div>
                      );
                    })()}
                    {!!routeObj.duracion_segundos && (() => {
                      const s = routeObj.duracion_segundos as number;
                      const mins = Math.round(s / 60);
                      return (
                        <div className="flex items-center gap-2">
                          <ClockIcon className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                          <span className="text-neutral-300 text-sm">{mins} min aprox.</span>
                        </div>
                      );
                    })()}
                    {/* Read-only map preview for this route */}
                    {(() => {
                      const pa = routeObj.punto_a as { name?: string; lat?: number; lon?: number } | undefined;
                      const pb = routeObj.punto_b as { name?: string; lat?: number; lon?: number } | undefined;
                      if (pa && pa.lat && pa.lon) {
                        return (
                          <div className="mt-2 relative z-0">
                            <RouteMapPreview
                              pointA={{ name: pa.name || '', lat: pa.lat, lon: pa.lon }}
                              pointB={pb && pb.lat && pb.lon ? { name: pb.name || '', lat: pb.lat, lon: pb.lon } : null}
                              height={160}
                            />
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* Per-route comments */}
                {!!ruta.comentarios && (
                  <div className="p-3 bg-neutral-800/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ChatBubbleLeftIcon className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                      <p className="text-neutral-500 text-xs">Comentarios de esta ruta</p>
                    </div>
                    <p className="text-neutral-300 text-sm whitespace-pre-wrap">{String(ruta.comentarios)}</p>
                  </div>
                )}

                {/* Per-route files */}
                {(() => {
                  const archivos = ruta.archivos as Array<{ nombre: string; tamano?: number }> | undefined;
                  if (!archivos || archivos.length === 0) return null;
                  return (
                    <div className="p-3 bg-neutral-800/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1.5">
                        <PaperClipIcon className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                        <p className="text-neutral-500 text-xs">Archivos adjuntos de esta ruta</p>
                      </div>
                      <div className="space-y-1">
                        {archivos.map((archivo, ai) => (
                          <div key={ai} className="flex items-center gap-2 text-sm">
                            <span className="text-white truncate">{archivo.nombre}</span>
                            {archivo.tamano && (
                              <span className="text-neutral-500 text-xs flex-shrink-0">({(archivo.tamano / 1024 / 1024).toFixed(2)} MB)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
