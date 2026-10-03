'use client';

import { useState } from 'react';
import { submitReport } from '../lib/api';

const INCIDENT_TYPES = [
  ['bike_theft', 'Whole bike stolen'],
  ['parts_theft', 'Parts stolen (wheel, seat, lights…)'],
  ['tampering', 'Lock or bike tampered with'],
  ['other', 'Other'],
];

/**
 * Theft report panel. The location comes from the parent (a map click), or from
 * "Use my location". On success the server's change stream broadcasts the report,
 * so it reaches the map through useIncidentStream like everyone else's.
 *
 * location: { lat, lng } | null
 * onSubmitted(report): called with the flat incident shape after the server accepts it
 */
export default function ReportForm({ location, onLocationChange, onSubmitted, onCancel }) {
  const [text, setText] = useState('');
  const [type, setType] = useState('bike_theft');
  const [severity, setSeverity] = useState('major');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  function locateMe() {
    if (!navigator.geolocation) return setError('Location is not available in this browser.');
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocationChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setError('Couldn’t get your location. Click the map instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!location) return setError('Click the map to mark where it happened.');
    if (!text.trim()) return setError('Describe what happened.');

    setSubmitting(true);
    setError(null);
    const report = { lat: location.lat, lng: location.lng, report_text: text.trim(), incident_type: type, severity };
    try {
      const { _id } = await submitReport(report);
      onSubmitted({
        id: _id,
        lat: report.lat,
        lng: report.lng,
        text: report.report_text,
        type,
        severity,
        time: new Date().toISOString(),
      });
    } catch (err) {
      // The server's validation messages are user-readable (e.g. "location must be inside Dublin …")
      setError(err.message || 'Couldn’t submit the report. Try again in a moment.');
      setSubmitting(false);
    }
  }

  return (
    <form className="report-panel" onSubmit={handleSubmit}>
      <div className="report-head">
        <div>
          <h2 className="report-title">Report a theft</h2>
          <p className="report-sub">Updates stand risk for everyone, live.</p>
        </div>
        <button type="button" className="report-close" onClick={onCancel} aria-label="Close">
          ×
        </button>
      </div>

      <div className="report-location">
        {location ? (
          <span>
            📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </span>
        ) : (
          <span className="report-hint">Tap the map where it happened</span>
        )}
        <button type="button" className="report-link" onClick={locateMe} disabled={locating}>
          {locating ? 'Locating…' : 'Use my location'}
        </button>
      </div>

      <label className="report-field">
        What happened?
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder='e.g. "D-lock cut with an angle grinder, bike gone"'
          autoFocus
        />
      </label>

      <label className="report-field">
        Type
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {INCIDENT_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="report-severity">
        <legend>Severity</legend>
        <label>
          <input type="radio" checked={severity === 'major'} onChange={() => setSeverity('major')} /> Major
        </label>
        <label>
          <input type="radio" checked={severity === 'minor'} onChange={() => setSeverity('minor')} /> Minor
          <small> (expires after 48h)</small>
        </label>
      </fieldset>

      {error && <p className="report-error">{error}</p>}

      <div className="report-actions">
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="report-submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </div>
    </form>
  );
}
