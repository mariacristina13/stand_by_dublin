'use client';

import { useState } from 'react';

const MODES = {
  place: {
    label: 'Places',
    placeholder: 'Find a place — Trinity College, Camden St…',
    aria: 'Search for a Dublin place',
  },
  ask: {
    label: 'Ask',
    placeholder: 'Describe it — “someone testing locks near college”',
    aria: 'Search theft reports in your own words',
  },
};

/**
 * Two searches in one bar:
 *  - Places: geocodes a Dublin place and shows nearby stands + live risk there
 *  - Ask: natural-language search over reports (Atlas Vector Search, ranked by meaning)
 * Both run on Enter, not per keystroke: each Ask query is an embedding call, and
 * Nominatim (Places) forbids search-as-you-type.
 *
 * onPlace(query) / onAsk(query) return promises; onLocate() uses the device location.
 */
export default function SearchBar({ onPlace, onAsk, onLocate }) {
  const [mode, setMode] = useState('place');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      await (mode === 'place' ? onPlace(q) : onAsk(q));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`search-wrap search-${mode}`} onSubmit={handleSubmit} role="search">
      <div className="search-modes" role="tablist" aria-label="Search type">
        {Object.entries(MODES).map(([key, { label }]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            className={mode === key ? 'is-active' : ''}
            onClick={() => setMode(key)}
          >
            {key === 'ask' && <span aria-hidden="true">✦ </span>}
            {label}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
        placeholder={MODES[mode].placeholder}
        className="search-input"
        aria-label={MODES[mode].aria}
      />
      {mode === 'place' && (
        <button type="button" className="search-locate" onClick={onLocate} title="Use my location" aria-label="Use my location">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}
      <button type="submit" className="search-go" disabled={busy || !query.trim()} aria-label="Search">
        {busy ? <span className="spinner" /> : '→'}
      </button>
    </form>
  );
}
