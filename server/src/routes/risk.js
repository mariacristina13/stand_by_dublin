import { Router } from 'express';
import { riskAt } from '../risk.js';
import { parseLatLng } from '../validate.js';

const router = Router();

router.get('/risk', async (req, res) => {
  const { lat, lng, error } = parseLatLng(req.query);
  if (error) return res.status(400).json({ error });
  res.json(await riskAt(lng, lat));
});

export default router;
