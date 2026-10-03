import { reports } from './db.js';
import { onIncident } from './risk.js';

export const FALLBACK = process.env.STREAM_FALLBACK === '1';
const clients = new Set();
const PING_MS = 20_000;
const RESTART_MS = 1_000;
const PIPELINE = [{ $match: { operationType: 'insert' } }, { $project: { 'fullDocument.embedding': 0 } }];
const STALE_TOKEN_CODES = new Set([280, 286]); // ChangeStreamFatalError, ChangeStreamHistoryLost

// GET /api/stream
export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), PING_MS);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

export function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

// Shared by the change stream and the STREAM_FALLBACK path in POST /api/reports
export async function handleInsert(doc) {
  broadcast('incident', doc);
  try {
    broadcast('risk_update', await onIncident(doc));
  } catch (err) {
    console.error('risk_update failed:', err.message);
  }
}

let stream = null;
let resumeToken = null;
let stopping = false;

export async function startChangeStream() {
  stopping = false;
  stream = reports.watch(PIPELINE, resumeToken ? { resumeAfter: resumeToken } : {});
  console.log(`change stream ${resumeToken ? 'resumed' : 'started'}`);
  try {
    for await (const change of stream) {
      resumeToken = stream.resumeToken;
      await handleInsert(change.fullDocument);
    }
  } catch (err) {
    if (stopping) return;
    if (STALE_TOKEN_CODES.has(err.code)) {
      console.warn(`resume token unusable (code ${err.code}), starting fresh`);
      resumeToken = null;
    } else {
      // stream.resumeToken also advances on empty batches, so it's fresher than the last change
      resumeToken = stream.resumeToken ?? resumeToken;
      console.error('change stream error:', err.message);
    }
  }
  if (stopping) return;
  // Reached on error, or if the stream ended unexpectedly: single restart path
  await stream.close().catch(() => {});
  setTimeout(startChangeStream, RESTART_MS);
}

export async function stopChangeStream() {
  stopping = true;
  await stream?.close();
}
