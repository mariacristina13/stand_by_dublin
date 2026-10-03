// Express-side bindings for the shared risk logic (core.js / scoring.js).
import { reports, spots } from './db.js';
import { makeCore } from './core.js';

export { R, SEVERITY, HALF_LIFE_H, K, MAX_STANDS, haversine, scorePoints } from './scoring.js';

export const core = makeCore({ reports, spots });
export const { incidentsNear, riskAt, onIncident } = core;
