import { Router } from 'express';
import { findNearby } from '../stubs/geo.js';
import { R, incidentsNear, scorePoints } from '../risk.js';
import { parseLatLng } from '../validate.js';

const DEFAULT_RADIUS = 200;
const MAX_RADIUS = 1000;

const router = Router();

router.get('/parking/nearby', async (req, res) => {
  const { lat, lng, error } = parseLatLng(req.query);
  if (error) return res.status(400).json({ error });

  let radius = req.query.radius === undefined ? DEFAULT_RADIUS : Number(req.query.radius);
  if (!Number.isFinite(radius) || radius <= 0) return res.status(400).json({ error: 'radius must be a positive number of metres' });
  radius = Math.min(radius, MAX_RADIUS);

  // One incident query covers every stand: a stand is at most `radius` from the centre,
  // and an incident affecting it is at most R from the stand.
  const [stands, incidents] = await Promise.all([findNearby(lng, lat, radius), incidentsNear(lng, lat, radius + R)]);

  res.json(stands.map((s) => ({ ...s, risk: scorePoints(s.location.coordinates, incidents) })));
});

export default router;
