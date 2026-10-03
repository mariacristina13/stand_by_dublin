// Dublin city centre, [lat, lng] as Leaflet expects
export const DUBLIN_CENTER = [53.3438, -6.2625];

// Risk scale, tuned to sit with the cream / forest / burnt-orange theme.
// Keep in sync with --risk-* in app/globals.css.
export const RISK_LEVELS = {
  low: { label: 'Low', color: '#6b8f47' },
  medium: { label: 'Medium', color: '#d9962b' },
  high: { label: 'High', color: '#a3260f' },
};

export function riskLevel(score = 0) {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

// Stand marker colour for a 0–100 risk score
export const riskColor = (score) => RISK_LEVELS[riskLevel(score)].color;

// "bike_theft" -> "Bike theft"
export function typeLabel(type = 'other') {
  const s = type.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "5 min ago", "3 h ago", "2 days ago", then a date
export function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}
