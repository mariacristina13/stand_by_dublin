// Client for the Express API in server/ (see server/API.md).
// Run it with `npm run server`; it listens on :3001 and allows CORS from :3000.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
  return body;
}

export const getHealth = () => request("/health");

export const getRisk = (lat, lng) => request(`/risk?${new URLSearchParams({ lat, lng })}`);

export const getNearbyParking = (lat, lng, radius = 200) =>
  request(`/parking/nearby?${new URLSearchParams({ lat, lng, radius })}`);

export const searchIncidents = (q, limit = 10) =>
  request(`/incidents/search?${new URLSearchParams({ q, limit })}`);

export const submitReport = (report) =>
  request("/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });

// Live feed. Handlers: { onIncident(report), onRiskUpdate([{ spot_id, score, incidents }]) }.
// Returns a function that closes the connection; call it from a useEffect cleanup.
export function subscribe({ onIncident, onRiskUpdate }) {
  const es = new EventSource(`${API_URL}/stream`);
  if (onIncident) es.addEventListener("incident", (e) => onIncident(JSON.parse(e.data)));
  if (onRiskUpdate) es.addEventListener("risk_update", (e) => onRiskUpdate(JSON.parse(e.data)));
  return () => es.close();
}
