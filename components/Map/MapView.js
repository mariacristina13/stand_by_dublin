'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import HeatmapLayer from './HeatmapLayer';
import { DUBLIN_CENTER, RISK_LEVELS, riskColor, riskLevel, timeAgo, typeLabel } from '../../lib/mapUtils';

// Leaflet's own CSS and all component styling come from app/globals.css,
// imported once via app/layout.js — nothing to import here.

// OpenStreetMap tiles — free, no API key. The warm tone is a CSS filter on the
// tile pane (.map-warm in globals.css) so the basemap matches the cream theme.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Theft reports are small diamonds so they never read as stands (circles).
// divIcon injects raw HTML outside React's render tree, so it's styled by global classes.
const incidentIcon = L.divIcon({
  className: '',
  html: '<div class="incident-pin"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});
const freshIncidentIcon = L.divIcon({
  className: '',
  html: '<div class="incident-pin incident-pin-fresh"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});
const FRESH_MS = 6 * 3600 * 1000; // reports newer than this pulse

const selectedIncidentIcon = L.divIcon({
  className: '',
  html: '<div class="incident-pin incident-pin-selected"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Draggable pin for a searched place
const placeIcon = L.divIcon({
  className: '',
  html: '<div class="place-pin"><span></span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Flies the map whenever `focus` changes ({ lat, lng, zoom, seq } — seq makes repeat targets fly again)
function FocusController({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom ?? map.getZoom(), { duration: 0.8 });
  }, [focus, map]);
  return null;
}

// Pin for the location being reported, before it's submitted
const pickedIcon = L.divIcon({
  className: '',
  html: '<div class="picked-pin"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

// Reports the visible area (centre + radius to the corner, in metres) after every pan/zoom
function ViewWatcher({ onViewChange }) {
  const map = useMapEvents({ moveend: () => report() });
  function report() {
    const c = map.getCenter();
    onViewChange({ lat: c.lat, lng: c.lng, radius: c.distanceTo(map.getBounds().getNorthEast()) });
  }
  useEffect(report, []); // initial view
  return null;
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function StandPopup({ stand }) {
  const level = riskLevel(stand.riskScore);
  return (
    <div className="popup">
      <div className="popup-kicker">Bike stand</div>
      <div className="popup-title">{stand.name}</div>
      <div className="popup-risk">
        <span className="risk-chip" style={{ background: RISK_LEVELS[level].color }}>
          {RISK_LEVELS[level].label} risk
        </span>
        <span className="popup-score">{stand.riskScore}/100</span>
      </div>
      <dl className="popup-meta">
        <div>
          <dt>Spaces</dt>
          <dd>{stand.capacity || '—'}</dd>
        </div>
        <div>
          <dt>Lighting</dt>
          <dd>{stand.lighting || '—'}</dd>
        </div>
        <div>
          <dt>Safety</dt>
          <dd>{stand.safetyRating || '—'}</dd>
        </div>
      </dl>
      <div className="popup-foot">
        {stand.incidentCount === 0
          ? 'No reports within 150 m'
          : `${stand.incidentCount} report${stand.incidentCount === 1 ? '' : 's'} within 150 m`}
      </div>
    </div>
  );
}

function IncidentPopup({ incident }) {
  return (
    <div className="popup">
      <div className="popup-kicker">
        {typeLabel(incident.type)}
        {incident.severity === 'major' && <span className="severity-tag">Major</span>}
      </div>
      <p className="popup-text">{incident.text}</p>
      <div className="popup-foot">{timeAgo(incident.time)}</div>
    </div>
  );
}

export default function MapView({
  stands = [],
  incidents = [],
  highlightedIncidentIds = [],
  onMapClick, // when set, clicking the map picks a location (report mode)
  pickedLocation, // { lat, lng } shown as a pin while reporting
  onViewChange, // ({ lat, lng, radius }) after the map moves
  focus, // { lat, lng, zoom, seq } to fly to
  placePin, // { lat, lng } searched place, draggable
  onPlacePinMove, // ({ lat, lng }) after the place pin is dragged
  selectedIncidentId, // emphasised report (from search results)
}) {
  const [showHeatmap, setShowHeatmap] = useState(false);

  const heatPoints = incidents.map((i) => ({ lat: i.lat, lng: i.lng, intensity: i.severity === 'major' ? 0.9 : 0.5 }));
  const now = Date.now();

  return (
    <div className="map-wrap">
      <div className="map-toggle" role="group" aria-label="Map layer">
        <button className={showHeatmap ? '' : 'is-active'} onClick={() => setShowHeatmap(false)}>
          Stands
        </button>
        <button className={showHeatmap ? 'is-active' : ''} onClick={() => setShowHeatmap(true)}>
          Heatmap
        </button>
      </div>

      <MapContainer
        center={DUBLIN_CENTER}
        zoom={15}
        className={`map-container map-warm${onMapClick ? ' map-picking' : ''}`}
        preferCanvas
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />

        {showHeatmap && <HeatmapLayer points={heatPoints} />}

        <FocusController focus={focus} />
        {onViewChange && <ViewWatcher onViewChange={onViewChange} />}
        {placePin && (
          <Marker
            position={[placePin.lat, placePin.lng]}
            icon={placeIcon}
            draggable
            zIndexOffset={1000}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                onPlacePinMove?.({ lat, lng });
              },
            }}
          />
        )}
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {pickedLocation && <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={pickedIcon} />}

        {!showHeatmap &&
          stands.map((stand) => (
            <CircleMarker
              key={stand.id}
              center={[stand.lat, stand.lng]}
              radius={8}
              pathOptions={{
                color: '#FDE2C4',
                weight: 2,
                fillColor: riskColor(stand.riskScore),
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <StandPopup stand={stand} />
              </Popup>
            </CircleMarker>
          ))}

        {incidents.map((incident) => (
          <Marker
            key={incident.id}
            position={[incident.lat, incident.lng]}
            icon={
              incident.id === selectedIncidentId
                ? selectedIncidentIcon
                : now - new Date(incident.time).getTime() < FRESH_MS
                  ? freshIncidentIcon
                  : incidentIcon
            }
            zIndexOffset={incident.id === selectedIncidentId ? 900 : 0}
            opacity={highlightedIncidentIds.length === 0 || highlightedIncidentIds.includes(incident.id) ? 1 : 0.35}
          >
            <Popup>
              <IncidentPopup incident={incident} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
