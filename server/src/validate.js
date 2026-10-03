// Shared input checks. Each returns an error message, or null if valid.

export const DUBLIN = { minLat: 53.2, maxLat: 53.45, minLng: -6.45, maxLng: -6.05 };

// For JSON bodies: must be actual numbers inside the Dublin bounding box
export function checkDublin(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'lat and lng must be numbers';
  }
  if (lat < DUBLIN.minLat || lat > DUBLIN.maxLat || lng < DUBLIN.minLng || lng > DUBLIN.maxLng) {
    return `location must be inside Dublin (lat ${DUBLIN.minLat}–${DUBLIN.maxLat}, lng ${DUBLIN.minLng}–${DUBLIN.maxLng})`;
  }
  return null;
}

// For query strings: parses ?lat&lng, returns { lat, lng } or { error }
export function parseLatLng(query) {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!query.lat || !query.lng || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: 'lat and lng query parameters are required numbers' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { error: 'lat/lng out of range' };
  return { lat, lng };
}
