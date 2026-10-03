// STUB for Role 2 (vector search). Swap for the real implementation; keep the signatures.
import { reports } from '../db.js';

// Real version returns a number[] embedding for the text
export async function embed(text) {
  return null;
}

// Real version runs $vectorSearch; this one is a case-insensitive substring match
export function searchIncidents(q, limit) {
  const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return reports
    .find({ report_text: { $regex: pattern, $options: 'i' } }, { projection: { embedding: 0 } })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
}
