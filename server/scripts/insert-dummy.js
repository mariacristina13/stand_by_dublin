// Insert one demo report straight into MongoDB, bypassing the API, to test the change stream.
// Note: with STREAM_FALLBACK=1 the server isn't watching, so this produces no SSE events.
import { client, reports } from '../src/db.js';

const now = new Date();
const doc = {
  location: { type: 'Point', coordinates: [-6.2645, 53.3427] }, // South Great George's St
  report_text: 'Dummy report: front wheel stolen from a bike locked to the railings on George\'s St.',
  incident_type: 'parts_theft',
  severity: 'minor',
  created_at: now,
  expires_at: new Date(now.getTime() + 48 * 3600 * 1000),
  source: 'demo',
};

try {
  const { insertedId } = await reports.insertOne(doc);
  console.log('inserted', insertedId.toString());
} finally {
  await client.close();
}
