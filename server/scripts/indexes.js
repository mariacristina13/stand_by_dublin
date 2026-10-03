// Idempotently create the indexes the app needs. Safe to run repeatedly.
import { client, reports, spots } from '../src/db.js';

const INDEX_CONFLICT = new Set([85, 86]); // IndexOptionsConflict, IndexKeySpecsConflict

async function ensure(coll, keys, options = {}) {
  try {
    const name = await coll.createIndex(keys, options);
    console.log(`ok   ${coll.collectionName}.${name}`);
  } catch (err) {
    if (!INDEX_CONFLICT.has(err.code)) throw err;
    console.warn(`skip ${coll.collectionName} ${JSON.stringify(keys)}: an equivalent index already exists (${err.codeName})`);
  }
}

try {
  await ensure(reports, { location: '2dsphere' });
  await ensure(spots, { location: '2dsphere' });
  await ensure(reports, { expires_at: 1 }, { expireAfterSeconds: 0 });
} finally {
  await client.close();
}
