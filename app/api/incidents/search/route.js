import { badRequest, getCore, handler } from '../../../../lib/server/db';
import { SEARCH_MAX_LIMIT, parseLimit } from '../../../../server/src/core.js';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  const params = request.nextUrl.searchParams;
  const q = (params.get('q') ?? '').trim();
  if (!q) return badRequest('q is required');

  const limit = parseLimit(params.get('limit'), 10);
  if (limit === null) return badRequest('limit must be a positive integer');

  return Response.json(await getCore().searchIncidents(q, Math.min(limit, SEARCH_MAX_LIMIT)));
});
