// Client for the Express API in server/ (see server/API.md).
// Run it with `npm run server`; it listens on :3001 and allows CORS from :3000.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
  return body;
}

// Server documents -> the flat shapes the map components use.
// Stored GeoJSON is [lng, lat].
export function toStand(doc) {
  const [lng, lat] = doc.location.coordinates;
  return {
    id: doc._id,
    name: doc.name,
    lat,
    lng,
    capacity: doc.capacity,
    lighting: doc.lighting,
    safetyRating: doc.safety_rating,
    distance: doc.distance,
    riskScore: doc.risk?.score ?? 0,
    incidentCount: doc.risk?.incidents ?? 0,
  };
}

export function toIncident(doc) {
  const [lng, lat] = doc.location.coordinates;
  return {
    id: doc._id,
    lat,
    lng,
    text: doc.report_text,
    type: doc.incident_type,
    severity: doc.severity,
    time: doc.created_at,
  };
}

export const getHealth = () => request("/health");

export const getRisk = (lat, lng) => request(`/risk?${new URLSearchParams({ lat, lng })}`);

export const getNearbyParking = async (lat, lng, radius = 200) =>
  (await request(`/parking/nearby?${new URLSearchParams({ lat, lng, radius })}`)).map(toStand);

export const getRecentIncidents = async (limit = 100) =>
  (await request(`/incidents?${new URLSearchParams({ limit })}`)).map(toIncident);

export const searchIncidents = async (q, limit = 10) =>
  (await request(`/incidents/search?${new URLSearchParams({ q, limit })}`)).map(toIncident);

export const submitReport = (report) =>
  request("/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });

// Live feed. Handlers receive raw server documents:
// { onIncident(report), onRiskUpdate([{ spot_id, score, incidents }]), onOpen(), onError() }.
// Returns a function that closes the connection; call it from a useEffect cleanup.
export function subscribe({ onIncident, onRiskUpdate, onOpen, onError }) {
  const es = new EventSource(`${API_URL}/stream`);
  if (onOpen) es.onopen = onOpen;
  if (onError) es.onerror = onError;
  if (onIncident) es.addEventListener("incident", (e) => onIncident(JSON.parse(e.data)));
  if (onRiskUpdate) es.addEventListener("risk_update", (e) => onRiskUpdate(JSON.parse(e.data)));
  return () => es.close();
}
