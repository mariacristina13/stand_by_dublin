'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '../components/SearchBar';
import { useIncidentStream } from '../hooks/useIncidentStream';
import { DUBLIN_CENTER } from '../lib/mapUtils';

// Leaflet touches `window`, so the map must never render on the server.
const MapView = dynamic(() => import('../components/Map/MapView'), { ssr: false });

export default function Home() {
  const [stands, setStands] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const { liveIncidents, connected } = useIncidentStream();

  // Merge live incidents from the SSE stream into the map as they arrive.
  useEffect(() => {
    if (liveIncidents.length === 0) return;
    setIncidents((prev) => [...liveIncidents, ...prev].slice(0, 100));
    const newest = liveIncidents[0];
    setToast(newest.text);
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [liveIncidents]);

  // Fetch nearby stands + recent incidents from MongoDB. No mock fallback —
  // an unreachable DB or empty collection just means an empty map.
  useEffect(() => {
    const [lat, lng] = DUBLIN_CENTER;

    fetch(`/api/stands/nearby?lat=${lat}&lng=${lng}&radius=500`)
      .then((res) => {
        if (!res.ok) throw new Error('bad response');
        return res.json();
      })
      .then((data) => setStands(data.stands ?? []))
      .catch(() => setLoadError(true));

    fetch('/api/incidents')
      .then((res) => {
        if (!res.ok) throw new Error('bad response');
        return res.json();
      })
      .then((data) => setIncidents(data.incidents ?? []))
      .catch(() => setLoadError(true));
  }, []);

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
      </header>

      <div className="map-area">
        <MapView stands={stands} incidents={incidentsToShow} highlightedIncidentIds={highlightedIds} />

        {loadError && (
          <div className="empty-state">
            Couldn&apos;t reach MongoDB. Check MONGODB_URI in .env.local and
            that scripts/seed.js has been run.
          </div>
        )}

        {showEmptyState && (
          <div className="empty-state">
            No stands or incidents in the database yet. Run{' '}
            <code>node scripts/seed.js</code> to add starter data.
          </div>
        )}

        {toast && <div className="toast">🚨 New report: {toast}</div>}
      </div>
    </main>
  );
}