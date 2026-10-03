'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import HeatmapLayer from './HeatmapLayer';
import { DUBLIN_CENTER, riskColor } from '../../lib/mapUtils';

// Leaflet's own CSS and all component styling come from app/globals.css,
// imported once via app/layout.js — nothing to import here.

// OpenStreetMap tiles — free, no API key. The dark theme is a CSS filter on the
// tile pane (.map-dark in globals.css) since OSM has no dark style.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Small red pin icon for incidents (keeps CircleMarkers free for risk-coloured stands).
// Styled via the global .incident-pin class — divIcon injects raw HTML outside
// React's render tree, so it can't use a scoped/module class even if we had one.
const incidentIcon = L.divIcon({
  className: '',
  html: `<div class="incident-pin"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Pin for the location being reported, before it's submitted
const pickedIcon = L.divIcon({
  className: '',
  html: `<div class="picked-pin"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export default function MapView({
  stands = [],
  incidents = [],
  highlightedIncidentIds = [],
  theme = 'dark', // 'dark' demos better with red/amber markers
  onMapClick, // when set, clicking the map picks a location (report mode)
  pickedLocation, // { lat, lng } shown as a pin while reporting
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

      <MapContainer center={DUBLIN_CENTER} zoom={15} className={`map-container${theme === 'dark' ? ' map-dark' : ''}${onMapClick ? ' map-picking' : ''}`} preferCanvas>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />

        {showHeatmap && <HeatmapLayer points={heatPoints} />}

        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {pickedLocation && <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={pickedIcon} />}

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
              <br />
              Capacity {stand.capacity} · Lighting {stand.lighting} · Safety {stand.safetyRating}
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