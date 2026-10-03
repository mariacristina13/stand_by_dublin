'use client';

import { timeAgo, typeLabel } from '../lib/mapUtils';

/**
 * Natural-language search results, ranked by meaning (Atlas Vector Search).
 * `score` is the vectorSearchScore (0–1); it's absent if the server fell back to substring match.
 */
export default function ResultsPanel({ query, results, selectedId, onSelect, onClose }) {
  return (
    <section className="side-panel" aria-label="Search results">
      <div className="panel-head">
        <div>
          <div className="panel-kicker">✦ Reports like</div>
          <h2 className="panel-title">“{query}”</h2>
        </div>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close search">
          ×
        </button>
      </div>

      <p className="panel-note">Ranked by meaning with MongoDB Vector Search, so different wording still matches.</p>

      {results.length === 0 ? (
        <p className="panel-empty">No similar reports found.</p>
      ) : (
        <ul className="panel-list">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`panel-row result-row${r.id === selectedId ? ' is-selected' : ''}`}
                onClick={() => onSelect(r)}
              >
                <span className="panel-row-main">
                  {r.score != null && <span className="match-chip">{Math.round(r.score * 100)}% match</span>}
                  <b>{r.text}</b>
                  <small>
                    {typeLabel(r.type)}
                    {r.severity === 'major' ? ' · major' : ''} · {timeAgo(r.time)}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
