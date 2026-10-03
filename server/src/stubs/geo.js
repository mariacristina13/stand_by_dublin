// STUB for Role 1 (geospatial). Swap for the real implementation; keep the signature and return shape.
// Uses $geoNear rather than $nearSphere because $nearSphere can't return the distance.
import { spots } from '../db.js';

// Stands within radiusM of [lng, lat], nearest first, each with `distance` in metres
export function findNearby(lng, lat, radiusM) {
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
      { $limit: 100 },
    ])
    .toArray();
}
