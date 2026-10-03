'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '../components/SearchBar';
import ReportForm from '../components/ReportForm';
import { useIncidentStream } from '../hooks/useIncidentStream';
import { DUBLIN_CENTER } from '../lib/mapUtils';
import { getNearbyParking, getRecentIncidents } from '../lib/api';

// Leaflet touches `window`, so the map must never render on the server.
const MapView = dynamic(() => import('../components/Map/MapView'), { ssr: false });

export default function Home() {
  const [stands, setStands] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportLocation, setReportLocation] = useState(null);

  const { liveIncidents, riskUpdate, connected } = useIncidentStream();

  // Merge live incidents from the SSE stream into the map as they arrive.
  useEffect(() => {
    if (liveIncidents.length === 0) return;
    const liveIds = new Set(liveIncidents.map((i) => i.id));
    setIncidents((prev) => [...liveIncidents, ...prev.filter((i) => !liveIds.has(i.id))].slice(0, 100));
    const newest = liveIncidents[0];
    setToast(newest.text);
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [liveIncidents]);

  // Recolour stands whose risk changed because of a new report.
  useEffect(() => {
    if (riskUpdate.length === 0) return;
    const byId = new Map(riskUpdate.map((u) => [u.spot_id, u]));
    setStands((prev) =>
      prev.map((s) => (byId.has(s.id) ? { ...s, riskScore: byId.get(s.id).score, incidentCount: byId.get(s.id).incidents } : s))
    );
  }, [riskUpdate]);

  // Fetch nearby stands + recent incidents from the API server (server/, port 3001).
  useEffect(() => {
    const [lat, lng] = DUBLIN_CENTER;
    getNearbyParking(lat, lng, 1000).then(setStands).catch(() => setLoadError(true));
    getRecentIncidents(100).then(setIncidents).catch(() => setLoadError(true));
  }, []);

  function closeReport() {
    setReporting(false);
    setReportLocation(null);
  }

  function handleReportSubmitted(incident) {
    closeReport();
    // With the stream up, the report arrives as an `incident` event (and shows the toast).
    // Without it, add it locally so the reporter still sees their pin.
    if (!connected) {
      setIncidents((prev) => [incident, ...prev.filter((i) => i.id !== incident.id)].slice(0, 100));
      setToast('Report submitted');
    }
  }

  const highlightedIds = searchResults.map((r) => r.id);
  const incidentsToShow = searchResults.length > 0 ? searchResults : incidents;
  const showEmptyState = !loadError && stands.length === 0 && incidents.length === 0;

  return (
    <main className="page-main">
      <header className="page-header">
        <h1 className="page-title">🚲 Dublin Lock &amp; Ride</h1>
        <SearchBar onResults={setSearchResults} />
        <span className={`page-status ${connected ? 'status-live' : 'status-offline'}`}>
          {connected ? '● live' : '● no live stream connected'}
        </span>
        {!reporting && (
          <button className="report-button" onClick={() => setReporting(true)}>
            + Report a theft
          </button>
        )}
      </header>

      <div className="map-area">
        <MapView
          stands={stands}
          incidents={incidentsToShow}
          highlightedIncidentIds={highlightedIds}
          onMapClick={reporting ? setReportLocation : undefined}
          pickedLocation={reporting ? reportLocation : null}
        />

        {reporting && (
          <ReportForm
            location={reportLocation}
            onLocationChange={setReportLocation}
            onSubmitted={handleReportSubmitted}
            onCancel={closeReport}
          />
        )}

        {loadError && (
          <div className="empty-state">
            Couldn&apos;t reach the API. Start it with <code>npm run server</code> and check
            MONGODB_URI in server/.env.
          </div>
        )}

        {showEmptyState && (
          <div className="empty-state">
            No stands or incidents in the database yet. Run{' '}
            <code>npm --prefix server run seed</code> to add starter stands.
          </div>
        )}

        {toast && <div className="toast">🚨 New report: {toast}</div>}
      </div>
    </main>
  );
}