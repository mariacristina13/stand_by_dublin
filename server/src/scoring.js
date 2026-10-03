// Pure risk model: no database access, so both the Express server and the
// Next.js API routes (app/api, used on Vercel) share it.

// Tunables
export const R = 150;                          // metres: incidents within R count toward a point
export const SEVERITY = { minor: 1, major: 3 };
export const HALF_LIFE_H = 168;                // recency weight halves every week
export const K = 3;                            // saturation: score = 100 * (1 - e^(-sum/K))
export const MAX_STANDS = 20;                  // stands rescored per incident
export const EARTH_R = 6378100;                // metres, same radius MongoDB uses for $centerSphere

const toRad = (d) => (d * Math.PI) / 180;

// Great-circle distance in metres between two [lng, lat] points
export function haversine([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

// Score a point from a list of incident docs ({ location, severity, created_at }).
// Incidents beyond radiusM are ignored, so callers can pass a superset.
export function scorePoints(centreLngLat, incidents, radiusM = R, now = Date.now()) {
  let sum = 0;
  let count = 0;
  for (const inc of incidents) {
    const d = haversine(centreLngLat, inc.location.coordinates);
    if (d > radiusM) continue;
    const ageH = Math.max(0, (now - new Date(inc.created_at).getTime()) / 3.6e6);
    sum += (SEVERITY[inc.severity] ?? 1) * 0.5 ** (ageH / HALF_LIFE_H) * (1 - d / radiusM);
    count++;
  }
  return { score: Math.round(100 * (1 - Math.exp(-sum / K))), incidents: count };
}
