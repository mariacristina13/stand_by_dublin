'use client';

import { RISK_LEVELS, riskLevel } from '../lib/mapUtils';

/**
 * Result of a place search (or "use my location"): live risk at the pin and the
 * nearest stands, each clickable to fly the map to it. The pin is draggable on the map.
 *
 * place: { lat, lng, label }  risk: { score, incidents } | null  stands: nearest-first
 */
export default function PlacePanel({ place, risk, stands, loading, onSelectStand, onReportHere, onClose }) {
  const level = risk ? riskLevel(risk.score) : null;

  return (
    <section className="side-panel" aria-label="Place details">
      <div className="panel-head">
        <div>
          <div className="panel-kicker">Locking up near</div>
          <h2 className="panel-title">{place.label}</h2>
        </div>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="risk-summary" aria-live="polite">
        <div className={`risk-ring risk-${level ?? 'none'}`}>
          <strong>{risk ? risk.score : '—'}</strong>
          <span>/100</span>
        </div>
        <div>
          <div className="risk-summary-title">{risk ? `${RISK_LEVELS[level].label} risk at the pin` : 'Checking risk…'}</div>
          <p className="risk-summary-detail">
            {risk
              ? `${risk.incidents} report${risk.incidents === 1 ? '' : 's'} within 150 m, weighted by severity, recency and distance.`
              : 'Weighing reports within 150 m.'}
          </p>
        </div>
      </div>

      <div className="panel-section-head">
        <h3>Nearest stands</h3>
        <span>within 300 m</span>
      </div>

      {loading && stands.length === 0 ? (
        <p className="panel-empty">Finding stands…</p>
      ) : stands.length === 0 ? (
        <p className="panel-empty">No stands within 300 m. Drag the pin or try another place.</p>
      ) : (
        <ul className="panel-list">
          {stands.slice(0, 8).map((stand) => (
            <li key={stand.id}>
              <button type="button" className="panel-row" onClick={() => onSelectStand(stand)}>
                <span className="legend-dot" style={{ background: RISK_LEVELS[riskLevel(stand.riskScore)].color }} />
                <span className="panel-row-main">
                  <b>{stand.name}</b>
                  <small>
                    {Math.round(stand.distance)} m away
                    {stand.capacity ? ` · ${stand.capacity} ${stand.capacity === '1' ? 'space' : 'spaces'}` : ''}
                    {stand.lighting ? ` · ${stand.lighting.toLowerCase()} lighting` : ''}
                  </small>
                </span>
                <span className="panel-row-score">{stand.riskScore}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="panel-foot">
        <span className="panel-hint">Drag the pin to adjust.</span>
        <button type="button" className="panel-action" onClick={onReportHere}>
          Report a theft here
        </button>
      </div>
    </section>
  );
}
