import { Router } from 'express';
import { core } from '../risk.js';
import { NEARBY_DEFAULT_RADIUS, NEARBY_MAX_RADIUS } from '../core.js';
import { parseLatLng } from '../validate.js';

const router = Router();

router.get('/parking/nearby', async (req, res) => {
  const { lat, lng, error } = parseLatLng(req.query);
  if (error) return res.status(400).json({ error });

  const radius = req.query.radius === undefined ? NEARBY_DEFAULT_RADIUS : Number(req.query.radius);
  if (!Number.isFinite(radius) || radius <= 0) return res.status(400).json({ error: 'radius must be a positive number of metres' });

  res.json(await core.nearbyWithRisk(lng, lat, Math.min(radius, NEARBY_MAX_RADIUS)));
});

export default router;
