// MongoDB for the Next.js API routes (app/api). On Vercel each function instance
// reuses one client across requests, so it's cached on globalThis (which also
// survives hot reloads in `next dev`). Connects lazily: nothing touches the
// database at build time.
import { MongoClient } from 'mongodb';
import { makeCore } from '../../server/src/core.js';

const cache = (globalThis.__lockride ??= {});

export function getDb() {
  if (!cache.db) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    cache.client = new MongoClient(uri, { maxPoolSize: 10 });
    cache.db = cache.client.db(process.env.DB_NAME || 'lockride');
  }
  return cache.db;
}

export function getCollections() {
  const db = getDb();
  return { db, reports: db.collection('theft_reports'), spots: db.collection('parking_spots') };
}

export function getCore() {
  return (cache.core ??= makeCore(getCollections()));
}

// Wraps a route handler: JSON errors in the same { error } shape as the Express server
export function handler(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (err) {
      console.error(err);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

export const badRequest = (error, extra) => Response.json({ error, ...extra }, { status: 400 });
