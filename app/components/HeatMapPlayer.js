'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

/**
 * points: [{ lat, lng, intensity? }]
 * Toggle by conditionally rendering <HeatmapLayer /> from the parent.
 */
export default function HeatmapLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    const heatPoints = points.map((p) => [p.lat, p.lng, p.intensity ?? 0.6]);
    const heat = L.heatLayer(heatPoints, {
      radius: 28,
      blur: 22,
      maxZoom: 17,
      gradient: { 0.2: '#2a9d8f', 0.5: '#f4a261', 0.8: '#e63946' },
    });

    heat.addTo(map);
    return () => map.removeLayer(heat);
  }, [map, points]);

  return null;
}