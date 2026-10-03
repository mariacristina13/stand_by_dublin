import { Router } from 'express';
import { core } from '../risk.js';
import { RECENT_MAX_LIMIT, SEARCH_MAX_LIMIT, parseLimit } from '../core.js';

const router = Router();

router.get('/incidents', async (req, res) => {
  const limit = parseLimit(req.query.limit, 100);
  if (limit === null) return res.status(400).json({ error: 'limit must be a positive integer' });
  res.json(await core.recentIncidents(Math.min(limit, RECENT_MAX_LIMIT)));
});

router.get('/incidents/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'q is required' });

  const limit = parseLimit(req.query.limit, 10);
  if (limit === null) return res.status(400).json({ error: 'limit must be a positive integer' });

  res.json(await core.searchIncidents(q, Math.min(limit, SEARCH_MAX_LIMIT)));
});

export default router;
