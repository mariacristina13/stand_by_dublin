// Live feed (Server-Sent Events) for Vercel: one MongoDB change stream per open connection.
//
// A serverless function can't stay open forever, so each connection ends cleanly a little
// before maxDuration and the browser's EventSource reconnects on its own (retry: 3000).
// Every message carries `id:` = the change stream resume token, so the reconnect sends it
// back as Last-Event-ID and resumes exactly where it left off: no reports are lost in the gap.
// Same events as the Express server: `incident` then `risk_update` (see server/API.md).
import { getCollections, getCore } from '../../../lib/server/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // seconds; Vercel's cap on the Hobby plan

const LIFETIME_MS = 270_000; // close before maxDuration so the client reconnects, not errors
const PING_MS = 20_000;
const PIPELINE = [
  { $match: { operationType: 'insert' } },
  { $project: { 'fullDocument.embedding': 0, 'fullDocument.dummy': 0 } },
];
const STALE_TOKEN_CODES = new Set([280, 286]); // ChangeStreamFatalError, ChangeStreamHistoryLost

export async function GET(request) {
  const { reports } = getCollections();
  const core = getCore();
  const lastId = request.headers.get('last-event-id');
  const encoder = new TextEncoder();

  let changeStream;
  let closed = false;

  const body = new ReadableStream({
    async start(controller) {
      const write = (text) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const tokenId = () => changeStream?.resumeToken?._data;
      const send = (event, data) => write(`id: ${tokenId() ?? ''}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const close = async () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        clearTimeout(lifetime);
        await changeStream?.close().catch(() => {});
        try {
          controller.close();
        } catch {}
      };

      write('retry: 3000\n\n');
      // A bare `id:` updates the browser's Last-Event-ID even with no event, so an idle
      // connection still resumes from the latest point (the post-batch resume token).
      const ping = setInterval(() => write(`${tokenId() ? `id: ${tokenId()}\n` : ''}: ping\n\n`), PING_MS);
      const lifetime = setTimeout(close, LIFETIME_MS);
      request.signal.addEventListener('abort', close);

      const open = (resume) =>
        reports.watch(PIPELINE, resume ? { resumeAfter: { _data: resume } } : {});

      try {
        changeStream = open(lastId);
        try {
          await changeStream.hasNext(); // surfaces a bad resume token straight away
        } catch (err) {
          if (!lastId || !STALE_TOKEN_CODES.has(err.code)) throw err;
          await changeStream.close().catch(() => {});
          changeStream = open(null); // token too old: start fresh
        }
        for await (const change of changeStream) {
          if (closed) break;
          const doc = change.fullDocument;
          send('incident', doc);
          try {
            send('risk_update', await core.onIncident(doc));
          } catch (err) {
            console.error('risk_update failed:', err.message);
          }
        }
      } catch (err) {
        if (!closed) console.error('change stream error:', err.message);
      }
      await close();
    },
    async cancel() {
      closed = true;
      await changeStream?.close().catch(() => {});
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
