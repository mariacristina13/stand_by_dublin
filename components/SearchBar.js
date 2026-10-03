'use client';

import { useState, useRef } from 'react';
import { searchIncidents } from '../lib/api';

/**
 * Debounced search against the API's /incidents/search (substring match for now,
 * vector search once Role 2 lands). A failed or empty query just shows no results.
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
      onResults(await searchIncidents(q.trim(), 20));
    } catch {
      setError('Search unavailable — is the API server running?.');
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