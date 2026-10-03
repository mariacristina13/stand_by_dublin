'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '../components/SearchBar';
import ReportForm from '../components/ReportForm';
import PlacePanel from '../components/PlacePanel';
import ResultsPanel from '../components/ResultsPanel';
import { useIncidentStream } from '../hooks/useIncidentStream';
import { getNearbyParking, getRecentIncidents, getRisk, searchIncidents } from '../lib/api';
import { searchPlace } from '../lib/geocode';
import { RISK_LEVELS } from '../lib/mapUtils';

const MAX_INCIDENTS = 500; // matches the server's cap on GET /incidents
const PLACE_RADIUS = 300; // metres: "nearest stands" around a searched place
const ASK_LIMIT = 8;

// Leaflet touches `window`, so the map must never render on the server.
const MapView = dynamic(() => import('../components/Map/MapView'), { ssr: false });

export default function Home() {
  const [stands, setStands] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(false);

  // One left-hand panel at a time: 'place' | 'results' | 'report' | null
  const [panel, setPanel] = useState(null);
  const [reportLocation, setReportLocation] = useState(null);

  // Place search
  const [place, setPlace] = useState(null); // { lat, lng, label }
  const [placeStands, setPlaceStands] = useState([]);
  const [placeRisk, setPlaceRisk] = useState(null);
  const [placeLoading, setPlaceLoading] = useState(false);

  // Natural-language search
  const [askQuery, setAskQuery] = useState('');
  const [askResults, setAskResults] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  const [focus, setFocus] = useState(null);
  const flyTo = (lat, lng, zoom) => setFocus({ lat, lng, zoom, seq: Date.now() });

  const { liveIncidents, riskUpdate, connected } = useIncidentStream();

  function showToast(text, label = 'Heads up') {
    setToast({ text, label });
  }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Merge live incidents from the SSE stream into the map as they arrive.
  useEffect(() => {
    if (liveIncidents.length === 0) return;
    const liveIds = new Set(liveIncidents.map((i) => i.id));
    setIncidents((prev) => [...liveIncidents, ...prev.filter((i) => !liveIds.has(i.id))].slice(0, MAX_INCIDENTS));
    showToast(liveIncidents[0].text, 'New report');
  }, [liveIncidents]);

  // Recent incidents from the API server (server/, port 3001).
  useEffect(() => {
    getRecentIncidents(MAX_INCIDENTS).then(setIncidents).catch(() => setLoadError(true));
  }, []);

  // Stands for whatever part of the city is on screen; refetched (debounced) after each pan/zoom.
  // The server caps the radius at 8km and the result at 1500 stands, nearest first.
  const viewTimer = useRef(null);
  const handleViewChange = useCallback(({ lat, lng, radius }) => {
    clearTimeout(viewTimer.current);
    viewTimer.current = setTimeout(() => {
      getNearbyParking(lat, lng, Math.min(Math.ceil(radius), 8000))
        .then((data) => {
          setStands(data);
          setLoadError(false);
        })
        .catch(() => setLoadError(true));
    }, 300);
  }, []);

  // ---- Place search

  const loadPlace = useCallback(async ({ lat, lng }) => {
    setPlaceLoading(true);
    try {
      const [nearby, risk] = await Promise.all([getNearbyParking(lat, lng, PLACE_RADIUS), getRisk(lat, lng)]);
      setPlaceStands(nearby);
      setPlaceRisk(risk);
    } catch {
      showToast('Couldn’t load stands for this place. Try again in a moment.');
    } finally {
      setPlaceLoading(false);
    }
  }, []);

  function openPlace(next) {
    setPlace(next);
    setPlaceStands([]);
    setPlaceRisk(null);
    setPanel('place');
    flyTo(next.lat, next.lng, 17);
    loadPlace(next);
  }

  async function handlePlaceSearch(query) {
    try {
      const match = await searchPlace(query);
      if (!match) return showToast(`No Dublin place found for “${query}”. Try a street or landmark.`);
      openPlace(match);
    } catch (err) {
      showToast(err.message || 'Place search is unavailable right now.');
    }
  }

  function handleLocate() {
    if (!navigator.geolocation) return showToast('Location is not available in this browser.');
    navigator.geolocation.getCurrentPosition(
      (pos) => openPlace({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your location' }),
      () => showToast('Location permission was not granted.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handlePlacePinMove({ lat, lng }) {
    const moved = { lat, lng, label: place?.label === 'Your location' ? 'Your location' : 'Dropped pin' };
    setPlace(moved);
    loadPlace(moved);
  }

  // ---- Natural-language search

  async function handleAsk(query) {
    try {
      const results = await searchIncidents(query, ASK_LIMIT);
      setAskQuery(query);
      setAskResults(results);
      setSelectedIncidentId(null);
      setPanel('results');
    } catch {
      showToast('Search is unavailable right now. Try again in a moment.');
    }
  }

  function selectResult(result) {
    setSelectedIncidentId(result.id);
    flyTo(result.lat, result.lng, 18);
  }

  // ---- Live risk changes

  // Recolour stands whose risk changed because of a new report, and refresh the
  // place panel (debounced, so a burst of inserts doesn't hammer the API).
  const placeRefresh = useRef(null);
  useEffect(() => {
    if (riskUpdate.length === 0) return;
    const byId = new Map(riskUpdate.map((u) => [u.spot_id, u]));
    setStands((prev) =>
      prev.map((s) => (byId.has(s.id) ? { ...s, riskScore: byId.get(s.id).score, incidentCount: byId.get(s.id).incidents } : s))
    );
    if (place) {
      clearTimeout(placeRefresh.current);
      placeRefresh.current = setTimeout(() => loadPlace(place), 1000);
    }
  }, [riskUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Reporting

  function openReport(location = null) {
    setReportLocation(location);
    setPanel('report');
  }

  function closePanel() {
    if (panel === 'place') setPlace(null);
    if (panel === 'results') {
      setAskResults([]);
      setSelectedIncidentId(null);
    }
    if (panel === 'report') setReportLocation(null);
    setPanel(null);
  }

  function handleReportSubmitted(incident) {
    setReportLocation(null);
    setPanel(place ? 'place' : null);
    // With the stream up, the report arrives as an `incident` event (and shows the toast).
    // Without it, add it locally so the reporter still sees their pin.
    if (!connected) {
      setIncidents((prev) => [incident, ...prev.filter((i) => i.id !== incident.id)].slice(0, MAX_INCIDENTS));
      showToast(incident.text, 'Report sent');
    }
  }

  const showingResults = panel === 'results' && askResults.length > 0;
  const incidentsToShow = showingResults ? askResults : incidents;
  const showEmptyState = !loadError && stands.length === 0 && incidents.length === 0;

  return (
    <main className="page-main">
      <header className="page-header">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="7" y="14" width="18" height="14" rx="3" />
            <path d="M11 14v-3a5 5 0 0 1 10 0v3" />
            <circle cx="16" cy="21" r="2" />
          </svg>
          <div>
            <h1 className="brand-name">Lock &amp; Ride</h1>
            <div className="brand-sub">Dublin bike theft map</div>
          </div>
        </div>

        <SearchBar onPlace={handlePlaceSearch} onAsk={handleAsk} onLocate={handleLocate} />

        <div className="header-actions">
          <span
            className={`live-pill${connected ? ' is-live' : ''}`}
            title={connected ? 'Receiving reports live' : 'Live feed not connected'}
          >
            <span className="live-dot" />
            {connected ? 'Live' : 'Offline'}
          </span>
          <button className="report-button" onClick={() => openReport(place)} disabled={panel === 'report'}>
            <span aria-hidden="true">+</span> Report a theft
          </button>
        </div>
      </header>

      <div className="map-area">
        <MapView
          stands={stands}
          incidents={incidentsToShow}
          onMapClick={panel === 'report' ? setReportLocation : undefined}
          pickedLocation={panel === 'report' ? reportLocation : null}
          onViewChange={handleViewChange}
          focus={focus}
          placePin={place && panel !== 'report' ? place : null}
          onPlacePinMove={handlePlacePinMove}
          selectedIncidentId={selectedIncidentId}
        />

        <aside className="legend" aria-label="Map legend">
          <div className="legend-title">Stand risk</div>
          <ul className="legend-scale">
            {Object.entries(RISK_LEVELS).map(([key, { label, color }]) => (
              <li key={key}>
                <span className="legend-dot" style={{ background: color }} />
                {label}
              </li>
            ))}
          </ul>
          <div className="legend-row">
            <span className="incident-pin legend-pin" />
            Theft report
          </div>
          <div className="legend-stats">
            <strong>{stands.length.toLocaleString()}</strong> stands in view ·{' '}
            <strong>{incidentsToShow.length.toLocaleString()}</strong> {showingResults ? 'matching' : 'recent'} reports
          </div>
        </aside>

        {panel === 'place' && place && (
          <PlacePanel
            place={place}
            risk={placeRisk}
            stands={placeStands}
            loading={placeLoading}
            onSelectStand={(s) => flyTo(s.lat, s.lng, 18)}
            onReportHere={() => openReport({ lat: place.lat, lng: place.lng })}
            onClose={closePanel}
          />
        )}

        {panel === 'results' && (
          <ResultsPanel
            query={askQuery}
            results={askResults}
            selectedId={selectedIncidentId}
            onSelect={selectResult}
            onClose={closePanel}
          />
        )}

        {panel === 'report' && (
          <ReportForm
            location={reportLocation}
            onLocationChange={setReportLocation}
            onSubmitted={handleReportSubmitted}
            onCancel={() => {
              setReportLocation(null);
              setPanel(place ? 'place' : null);
            }}
          />
        )}

        {loadError && (
          <div className="notice">
            Couldn&apos;t reach the database. Check that <code>MONGODB_URI</code> is set (in{' '}
            <code>.env.local</code> locally, or the Vercel project settings).
          </div>
        )}

        {showEmptyState && (
          <div className="notice">
            No stands or reports in the database yet. Run{' '}
            <code>npm --prefix server run seed:dummy</code> to add sample data.
          </div>
        )}

        {toast && (
          <div className="toast" role="status">
            <span className="toast-label">{toast.label}</span>
            {toast.text}
          </div>
        )}
      </div>
    </main>
  );
}
