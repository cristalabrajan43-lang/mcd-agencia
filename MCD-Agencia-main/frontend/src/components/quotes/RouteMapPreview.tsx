'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with webpack/next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface PointData {
  name?: string;
  lat: number;
  lon: number;
}

interface RouteMapPreviewProps {
  pointA: PointData;
  pointB?: PointData | null;
  /** Height of the map container (default: 200px) */
  height?: number;
}

/**
 * Read-only Leaflet map that shows markers for point A and optionally point B,
 * with an OSRM driving route polyline between them.
 */
export function RouteMapPreview({ pointA, pointB, height = 200 }: RouteMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [routeError, setRouteError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create the map
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    } as L.MapOptions);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    // Green icon for A
    const iconA = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [20, 33],
      iconAnchor: [10, 33],
      popupAnchor: [1, -28],
      shadowSize: [33, 33],
    });

    // Red icon for B
    const iconB = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [20, 33],
      iconAnchor: [10, 33],
      popupAnchor: [1, -28],
      shadowSize: [33, 33],
    });

    const markerA = L.marker([pointA.lat, pointA.lon], { icon: iconA })
      .addTo(map)
      .bindPopup(pointA.name || 'Inicio');

    if (pointB && pointB.lat && pointB.lon) {
      const markerB = L.marker([pointB.lat, pointB.lon], { icon: iconB })
        .addTo(map)
        .bindPopup(pointB.name || 'Fin');

      // Fit bounds to both markers
      const bounds = L.latLngBounds(
        [pointA.lat, pointA.lon],
        [pointB.lat, pointB.lon]
      );
      map.fitBounds(bounds, { padding: [30, 30] });

      // Fetch OSRM route
      const fetchRoute = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${pointA.lon},${pointA.lat};${pointB.lon},${pointB.lat}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.code === 'Ok' && data.routes?.[0]) {
            const coords = data.routes[0].geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            );
            L.polyline(coords, {
              color: '#00BFFF',
              weight: 4,
              opacity: 0.8,
            }).addTo(map);
          }
        } catch {
          setRouteError(true);
        }
      };
      fetchRoute();
    } else {
      // Only one point — center on it
      map.setView([pointA.lat, pointA.lon], 14);
    }

    // Force a resize after the next paint so tiles render correctly
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointA.lat, pointA.lon, pointB?.lat, pointB?.lon]);

  return (
    <div
      ref={containerRef}
      className="relative z-0 rounded-lg overflow-hidden border border-neutral-700"
      style={{ height, width: '100%' }}
    />
  );
}
