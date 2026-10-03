import { badRequest, getCore, handler } from '../../../lib/server/db';
import { buildReport } from '../../../server/src/core.js';

export const dynamic = 'force-dynamic';

export const POST = handler(async (request) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON');
  }

  const { doc, error } = buildReport(body);
  if (error) return badRequest(error);

  const result = await getCore().insertReport(doc);
  if (result.error) return badRequest(result.error, { errInfo: result.errInfo });

  // The insert reaches every open map through /api/stream's change stream.
  return Response.json({ _id: result.id }, { status: 201 });
});
