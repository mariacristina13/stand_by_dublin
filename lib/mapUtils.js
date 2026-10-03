// Dublin city centre, [lat, lng] as Leaflet expects
export const DUBLIN_CENTER = [53.3438, -6.2625];

// Stand marker colour for a 0–100 risk score
export function riskColor(score = 0) {
  if (score >= 60) return '#e63946';
  if (score >= 30) return '#f4a261';
  return '#2a9d8f';
}
