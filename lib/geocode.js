// Place search via OpenStreetMap Nominatim (free, no key).
// Usage policy: at most 1 request/second and no search-as-you-type, so call this on submit only.
// https://operations.osmfoundation.org/policies/nominatim/

// Same box the API accepts for reports (server/src/validate.js), so a pin from a place
// search can always be reported on.
const DUBLIN_VIEWBOX = '-6.45,53.45,-6.05,53.2'; // left,top,right,bottom

let lastRequest = 0;

// Returns { lat, lng, label } for the best match, or null if nothing in Dublin matches
export async function searchPlace(query) {
  const wait = lastRequest + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'ie',
    viewbox: DUBLIN_VIEWBOX,
    bounded: '1',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Place search is unavailable right now.');
  const [match] = await res.json();
  if (!match) return null;

  // "Trinity College Dublin, College Green, …, Dublin 2, Ireland" -> "Trinity College Dublin, College Green"
  const label = match.name || match.display_name.split(',').slice(0, 2).join(',');
  return { lat: Number(match.lat), lng: Number(match.lon), label };
}
