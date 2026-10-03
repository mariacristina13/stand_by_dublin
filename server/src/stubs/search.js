// Role 2: semantic search over report_text with Atlas Vector Search (Automated Embedding,
// voyage-4), with a substring fallback. Implemented in core.js, shared with the Next.js API routes.
import { core } from '../risk.js';

export const searchIncidents = core.searchIncidents;
