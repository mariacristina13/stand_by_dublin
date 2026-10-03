import express from 'express';
import cors from 'cors';
import { client, db } from './db.js';
import { FALLBACK, sseHandler, startChangeStream, stopChangeStream } from './stream.js';
import reportsRouter from './routes/reports.js';
import riskRouter from './routes/risk.js';
import parkingRouter from './routes/parking.js';
import incidentsRouter from './routes/incidents.js';

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

const api = express.Router();
api.get('/health', async (req, res) => {
  await db.command({ ping: 1 });
  res.json({ ok: true, db: db.databaseName, streamMode: FALLBACK ? 'fallback' : 'change-stream' });
});
api.get('/stream', sseHandler);
api.use(reportsRouter, riskRouter, parkingRouter, incidentsRouter);
app.use('/api', api);

app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

// Express 5 forwards rejected promises from async handlers here
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

const server = app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}/api (stream mode: ${FALLBACK ? 'fallback' : 'change stream'})`);
  if (!FALLBACK) startChangeStream();
});

async function shutdown() {
  console.log('shutting down');
  server.closeAllConnections(); // SSE connections never end on their own
  server.close();
  await stopChangeStream();
  await client.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
