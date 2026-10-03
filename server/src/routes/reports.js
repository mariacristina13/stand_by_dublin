import { Router } from 'express';
import { reports } from '../db.js';
import { embed } from '../stubs/search.js';
import { FALLBACK, handleInsert } from '../stream.js';
import { checkDublin } from '../validate.js';

const MINOR_TTL_MS = 48 * 3600 * 1000;
const SEVERITIES = ['minor', 'major'];
const SOURCES = ['user', 'demo', 'seed'];

const router = Router();

router.post('/reports', async (req, res) => {
  const { lat, lng, report_text, incident_type = 'other', severity = 'minor', source = 'user' } = req.body ?? {};

  const locErr = checkDublin(lat, lng);
  if (locErr) return res.status(400).json({ error: locErr });
  if (typeof report_text !== 'string' || !report_text.trim()) {
    return res.status(400).json({ error: 'report_text is required' });
  }
  if (report_text.length > 1000) return res.status(400).json({ error: 'report_text must be at most 1000 characters' });
  if (typeof incident_type !== 'string' || !incident_type.trim()) {
    return res.status(400).json({ error: 'incident_type must be a non-empty string' });
  }
  if (!SEVERITIES.includes(severity)) return res.status(400).json({ error: 'severity must be "minor" or "major"' });
  if (!SOURCES.includes(source)) return res.status(400).json({ error: `source must be one of ${SOURCES.join(', ')}` });

  const now = new Date();
  const doc = {
    location: { type: 'Point', coordinates: [lng, lat] },
    report_text: report_text.trim(),
    incident_type: incident_type.trim(),
    severity,
    created_at: now,
    source,
  };
  if (severity === 'minor') doc.expires_at = new Date(now.getTime() + MINOR_TTL_MS);

  // Embed before insert so the report is searchable immediately; never block a report on it
  try {
    const embedding = await embed(doc.report_text);
    if (embedding) doc.embedding = embedding;
  } catch (err) {
    console.error('embed failed, inserting without embedding:', err.message);
  }

  try {
    await reports.insertOne(doc); // sets doc._id
  } catch (err) {
    if (err.code === 121) {
      return res.status(400).json({ error: 'Document failed schema validation', errInfo: err.errInfo });
    }
    throw err;
  }

  if (FALLBACK) {
    const { embedding, ...publicDoc } = doc; // same shape the change stream sends
    handleInsert(publicDoc); // don't make the reporter wait on risk scoring
  }

  res.status(201).json({ _id: doc._id });
});

export default router;
