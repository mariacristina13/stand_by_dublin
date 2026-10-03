// Seed ~16 plausible city-centre bike stands, only if parking_spots is empty.
// Placeholder until Role 1's real data lands; matches their schema.
import { client, spots } from '../src/db.js';

const STANDS = [
  // [name, capacity, lighting, safety_rating, lat, lng]
  ["South Great George's St", '10', 'High', 'Medium', 53.3427, -6.2645],
  ["George's St Arcade, Drury St", '8', 'Medium', 'Medium', 53.3420, -6.2633],
  ['Trinity College Front Gate', '20', 'High', 'High', 53.3444, -6.2590],
  ['Trinity College, Nassau St', '12', 'High', 'Medium', 53.3418, -6.2560],
  ['Grafton St / Duke St', '6', 'High', 'High', 53.3417, -6.2598],
  ['Top of Grafton St', '12', 'High', 'High', 53.3390, -6.2610],
  ["St Stephen's Green North", '16', 'Medium', 'Medium', 53.3395, -6.2585],
  ["St Stephen's Green West", '10', 'Low', 'Low', 53.3380, -6.2625],
  ['Temple Bar Square', '8', 'Medium', 'Low', 53.3452, -6.2643],
  ['Meeting House Square', '6', 'Low', 'Low', 53.3449, -6.2660],
  ['Smithfield Square', '20', 'Medium', 'Medium', 53.3485, -6.2780],
  ['Smithfield Luas Stop', '10', 'High', 'Medium', 53.3472, -6.2786],
  ['Dame St / City Hall', '8', 'High', 'High', 53.3441, -6.2669],
  ["Dame St / George's St", '6', 'High', 'Medium', 53.3440, -6.2648],
  ['Camden St Lower', '10', 'Medium', 'Medium', 53.3360, -6.2650],
  ['Camden St Upper / Harcourt Rd', '6', 'Low', 'Low', 53.3335, -6.2647],
];

try {
  const existing = await spots.countDocuments();
  if (existing > 0) {
    console.log(`parking_spots already has ${existing} docs, not seeding`);
  } else {
    const docs = STANDS.map(([name, capacity, lighting, safety_rating, lat, lng]) => ({
      name,
      council_area: 'Dublin',
      capacity,
      location: { type: 'Point', coordinates: [lng, lat] },
      lighting,
      safety_rating,
    }));
    const { insertedCount } = await spots.insertMany(docs);
    console.log(`seeded ${insertedCount} parking spots`);
  }
} finally {
  await client.close();
}
