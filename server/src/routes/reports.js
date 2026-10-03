import { Router } from 'express';
import { core } from '../risk.js';
import { buildReport } from '../core.js';
import { FALLBACK, handleInsert } from '../stream.js';

const router = Router();

router.post('/reports', async (req, res) => {
  const { doc, error } = buildReport(req.body);
  if (error) return res.status(400).json({ error });

  const result = await core.insertReport(doc);
  if (result.error) return res.status(400).json(result);

  if (FALLBACK) {
    handleInsert(doc); // don't make the reporter wait on risk scoring
  }

  res.status(201).json({ _id: result.id });
});

export default router;
