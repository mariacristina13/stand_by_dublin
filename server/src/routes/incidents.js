import { Router } from 'express';
import { searchIncidents } from '../stubs/search.js';

const MAX_LIMIT = 50;

const router = Router();

router.get('/incidents/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'q is required' });

  const limit = req.query.limit === undefined ? 10 : Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) return res.status(400).json({ error: 'limit must be a positive integer' });

  res.json(await searchIncidents(q, Math.min(limit, MAX_LIMIT)));
});

export default router;
