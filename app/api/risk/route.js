import { badRequest, getCore, handler } from '../../../lib/server/db';
import { parseLatLng } from '../../../server/src/validate.js';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  const { lat, lng, error } = parseLatLng(Object.fromEntries(request.nextUrl.searchParams));
  if (error) return badRequest(error);
  return Response.json(await getCore().riskAt(lng, lat));
});
