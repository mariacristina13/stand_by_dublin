// Remove demo reports only. Never touches seed/user reports or parking_spots.
import { client, reports } from '../src/db.js';

try {
  const { deletedCount } = await reports.deleteMany({ source: 'demo' });
  console.log(`deleted ${deletedCount} demo report(s)`);
} finally {
  await client.close();
}
