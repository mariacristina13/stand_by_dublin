import { Router } from 'express';
import { reports } from '../db.js';
import { searchIncidents } from '../stubs/search.js';

const MAX_LIMIT = 50;
const MAX_RECENT = 500;

const router = Router();

function parseLimit(value, fallback) {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

router.get('/incidents', async (req, res) => {
  const limit = parseLimit(req.query.limit, 100);
  if (limit === null) return res.status(400).json({ error: 'limit must be a positive integer' });

  res.json(
    await reports
      .find({}, { projection: { embedding: 0 } })
      .sort({ created_at: -1 })
      .limit(Math.min(limit, MAX_RECENT))
      .toArray()
  );
});

router.get('/incidents/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'q is required' });

  const limit = parseLimit(req.query.limit, 10);
  if (limit === null) return res.status(400).json({ error: 'limit must be a positive integer' });

  res.json(await searchIncidents(q, Math.min(limit, MAX_LIMIT)));
});

export default router;
