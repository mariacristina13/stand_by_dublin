'use client';

import { useState, useRef } from 'react';

/**
 * Debounced natural-language search against /api/incidents/search (MongoDB
 * regex match, or $vectorSearch once MONGODB_VECTOR_INDEX is set). No local
 * fallback data — a failed or empty query just shows no results.
 */
export default function SearchBar({ onResults }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  async function runSearch(q) {
    if (!q.trim()) {
      onResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/incidents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      onResults(data.results ?? []);
    } catch {
      setError('Search unavailable — check MongoDB connection.');
      onResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const value = e.target.value;
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 350);
  }

  return (
    <div className="search-wrap">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder='Describe an incident, e.g. "lock cut with a grinder near Trinity"'
        className="search-input"
      />
      {loading && <span className="search-loading">searching…</span>}
      {error && <span className="search-error">{error}</span>}
    </div>
  );
}