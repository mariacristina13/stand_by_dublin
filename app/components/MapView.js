'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import HeatmapLayer from './HeatmapLayer';
import { DUBLIN_CENTER, riskColor } from '../../lib/mapUtils';

// Leaflet's own CSS and all component styling come from app/globals.css,
// imported once via app/layout.js — nothing to import here.

// CARTO basemaps — free, no API key, no signup.
const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Small red pin icon for incidents (keeps CircleMarkers free for risk-coloured stands).
// Styled via the global .incident-pin class — divIcon injects raw HTML outside
// React's render tree, so it can't use a scoped/module class even if we had one.
const incidentIcon = L.divIcon({
  className: '',
  html: `<div class="incident-pin"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function MapView({
  stands = [],
  incidents = [],
  highlightedIncidentIds = [],
  theme = 'dark', // 'dark' demos better with red/amber markers
}) {
  const [showHeatmap, setShowHeatmap] = useState(false);

  const heatPoints = incidents.map((i) => ({ lat: i.lat, lng: i.lng, intensity: 0.7 }));

  return (
    <div className="map-wrap">
      <button
        onClick={() => setShowHeatmap((s) => !s)}
        className={`heat-toggle${showHeatmap ? ' heat-toggle-active' : ''}`}
      >
        {showHeatmap ? 'Hide heatmap' : 'Show theft heatmap'}
      </button>

      <MapContainer center={DUBLIN_CENTER} zoom={15} className="map-container" preferCanvas>
        <TileLayer url={TILE_URLS[theme]} attribution={TILE_ATTRIBUTION} />

        {showHeatmap && <HeatmapLayer points={heatPoints} />}

        {stands.map((stand) => (
          <CircleMarker
            key={stand.id}
            center={[stand.lat, stand.lng]}
            radius={10}
            pathOptions={{
              color: 'white',
              weight: 2,
              fillColor: riskColor(stand.riskScore),
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <strong>{stand.name}</strong>
              <br />
              Risk score: {stand.riskScore}/100
            </Popup>
          </CircleMarker>
        ))}

        {incidents.map((incident) => (
          <Marker
            key={incident.id}
            position={[incident.lat, incident.lng]}
            icon={incidentIcon}
            opacity={highlightedIncidentIds.includes(incident.id) ? 1 : 0.85}
          >
            <Popup>
              {incident.text}
              <br />
              <small>{new Date(incident.time).toLocaleString()}</small>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}