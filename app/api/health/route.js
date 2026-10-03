import { getDb, handler } from '../../../lib/server/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const db = getDb();
  await db.command({ ping: 1 });
  return Response.json({ ok: true, db: db.databaseName, streamMode: 'change-stream' });
});
