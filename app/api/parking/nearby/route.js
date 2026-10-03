import { badRequest, getCore, handler } from '../../../../lib/server/db';
import { NEARBY_DEFAULT_RADIUS, NEARBY_MAX_RADIUS } from '../../../../server/src/core.js';
import { parseLatLng } from '../../../../server/src/validate.js';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  const params = request.nextUrl.searchParams;
  const { lat, lng, error } = parseLatLng(Object.fromEntries(params));
  if (error) return badRequest(error);

  const radius = params.has('radius') ? Number(params.get('radius')) : NEARBY_DEFAULT_RADIUS;
  if (!Number.isFinite(radius) || radius <= 0) return badRequest('radius must be a positive number of metres');

  return Response.json(await getCore().nearbyWithRisk(lng, lat, Math.min(radius, NEARBY_MAX_RADIUS)));
});
