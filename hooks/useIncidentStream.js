'use client';

import { useEffect, useState } from 'react';
import { subscribe, toIncident } from '../lib/api';

/**
 * Live feed from the server's /stream endpoint.
 * liveIncidents: newest first. riskUpdate: the latest [{ spot_id, score, incidents }] batch.
 */
export function useIncidentStream() {
  const [liveIncidents, setLiveIncidents] = useState([]);
  const [riskUpdate, setRiskUpdate] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(
    () =>
      subscribe({
        onOpen: () => setConnected(true),
        onError: () => setConnected(false),
        onIncident: (doc) => setLiveIncidents((prev) => [toIncident(doc), ...prev].slice(0, 100)),
        onRiskUpdate: setRiskUpdate,
      }),
    []
  );

  return { liveIncidents, riskUpdate, connected };
}
