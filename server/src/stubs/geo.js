// Role 1 (geospatial): stands within radiusM of [lng, lat], nearest first, each with
// `distance` in metres. Implemented in core.js, shared with the Next.js API routes.
import { core } from '../risk.js';

export const findNearby = core.findNearby;
