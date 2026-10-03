// All database-backed API logic, given the two collections. Shared by the Express
// server (server/src, local dev) and the Next.js API routes (app/api, Vercel), so
// the endpoints behave identically in both.
import { EARTH_R, MAX_STANDS, R, scorePoints } from './scoring.js';
import { checkDublin } from './validate.js';

export const NEARBY_DEFAULT_RADIUS = 200;
export const NEARBY_MAX_RADIUS = 8000;
export const NEARBY_MAX_STANDS = 1500;
export const SEARCH_MAX_LIMIT = 50;
export const RECENT_MAX_LIMIT = 500;

const MINOR_TTL_MS = 48 * 3600 * 1000;
const SEVERITIES = ['minor', 'major'];
const SOURCES = ['user', 'demo', 'seed'];
const HIDDEN = { embedding: 0, dummy: 0 }; // never returned to clients

// Validates a POST /reports body. Returns { error } or { doc } ready to insert.
export function buildReport(body) {
  const { lat, lng, report_text, incident_type = 'other', severity = 'minor', source = 'user' } = body ?? {};

  const locErr = checkDublin(lat, lng);
  if (locErr) return { error: locErr };
  if (typeof report_text !== 'string' || !report_text.trim()) return { error: 'report_text is required' };
  if (report_text.length > 1000) return { error: 'report_text must be at most 1000 characters' };
  if (typeof incident_type !== 'string' || !incident_type.trim()) {
    return { error: 'incident_type must be a non-empty string' };
  }
  if (!SEVERITIES.includes(severity)) return { error: 'severity must be "minor" or "major"' };
  if (!SOURCES.includes(source)) return { error: `source must be one of ${SOURCES.join(', ')}` };

  const now = new Date();
  const doc = {
    location: { type: 'Point', coordinates: [lng, lat] },
    report_text: report_text.trim(),
    incident_type: incident_type.trim(),
    severity,
    created_at: now,
    source,
  };
  if (severity === 'minor') doc.expires_at = new Date(now.getTime() + MINOR_TTL_MS);
  // Atlas Automated Embedding observes `report_text` after insert and keeps
  // the Vector Search index in sync without an application-held model key.
  return { doc };
}

// Parses an optional positive-integer limit; null if invalid
export function parseLimit(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export function makeCore({ reports, spots }) {
  // All incidents within radiusM of a point, scoring fields only
  function incidentsNear(lng, lat, radiusM) {
    return reports
      .find(
        { location: { $geoWithin: { $centerSphere: [[lng, lat], radiusM / EARTH_R] } } },
        { projection: { location: 1, severity: 1, created_at: 1 } }
      )
      .toArray();
  }

  async function riskAt(lng, lat) {
    return scorePoints([lng, lat], await incidentsNear(lng, lat, R));
  }

  // After a new incident: rescore every stand within R of it.
  // One query for stands, one for incidents (any incident affecting those stands is within 2R of the new one).
  async function onIncident(doc) {
    const [lng, lat] = doc.location.coordinates;
    const stands = await spots
      .find(
        { location: { $nearSphere: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: R } } },
        { projection: { location: 1 } }
      )
      .limit(MAX_STANDS)
      .toArray();
    if (!stands.length) return [];

    const incidents = await incidentsNear(lng, lat, 2 * R);
    return stands.map((s) => ({ spot_id: s._id, ...scorePoints(s.location.coordinates, incidents) }));
  }

  // Stands within radiusM of [lng, lat], nearest first, each with `distance` (m).
  // $geoNear rather than $nearSphere because $nearSphere can't return the distance.
  function findNearby(lng, lat, radiusM) {
    return spots
      .aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            key: 'location',
            distanceField: 'distance',
            maxDistance: radiusM,
            spherical: true,
          },
        },
        { $project: { dummy: 0 } },
        { $limit: NEARBY_MAX_STANDS },
      ])
      .toArray();
  }

  // Stands near a point, each with live risk
  async function nearbyWithRisk(lng, lat, radiusM) {
    // One incident query covers every stand: a stand is at most `radius` from the centre,
    // and an incident affecting it is at most R from the stand.
    const [stands, incidents] = await Promise.all([findNearby(lng, lat, radiusM), incidentsNear(lng, lat, radiusM + R)]);
    return stands.map((s) => ({ ...s, risk: scorePoints(s.location.coordinates, incidents) }));
  }

  function recentIncidents(limit) {
    return reports.find({}, { projection: HIDDEN }).sort({ created_at: -1 }).limit(limit).toArray();
  }

  // Ranked by meaning with Atlas Vector Search (`theft_reports_vector`, Automated Embedding
  // with voyage-4 on report_text); each result carries `score` (0–1). Falls back to a
  // substring match if Vector Search is unreachable, so search keeps working on bad wifi.
  async function searchIncidents(q, limit) {
    try {
      return await reports
        .aggregate([
          {
            $vectorSearch: {
              index: 'theft_reports_vector',
              path: 'report_text',
              query: { text: q },
              model: 'voyage-4',
              limit,
              // 20× over-requesting is Atlas's recommended starting point for ANN recall.
              numCandidates: Math.min(limit * 20, 10_000),
            },
          },
          { $project: { ...HIDDEN, score: { $meta: 'vectorSearchScore' } } },
        ])
        .toArray();
    } catch (err) {
      console.error('vector search failed, falling back to substring match:', err.message);
      const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return reports
        .find({ report_text: { $regex: pattern, $options: 'i' } }, { projection: HIDDEN })
        .sort({ created_at: -1 })
        .limit(limit)
        .toArray();
    }
  }

  // Inserts a validated report doc. Returns { id } or { error, errInfo } for schema failures.
  async function insertReport(doc) {
    try {
      await reports.insertOne(doc); // sets doc._id
      return { id: doc._id };
    } catch (err) {
      if (err.code === 121) return { error: 'Document failed schema validation', errInfo: err.errInfo };
      throw err;
    }
  }

  return { incidentsNear, riskAt, onIncident, findNearby, nearbyWithRisk, recentIncidents, searchIncidents, insertReport };
}
