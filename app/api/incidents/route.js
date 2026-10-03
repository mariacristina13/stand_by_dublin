import { badRequest, getCore, handler } from '../../../lib/server/db';
import { RECENT_MAX_LIMIT, parseLimit } from '../../../server/src/core.js';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'), 100);
  if (limit === null) return badRequest('limit must be a positive integer');
  return Response.json(await getCore().recentIncidents(Math.min(limit, RECENT_MAX_LIMIT)));
});
