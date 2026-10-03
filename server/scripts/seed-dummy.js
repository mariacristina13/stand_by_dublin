// Fill the map with dummy data: extra bike stands in neighbourhoods the real data barely covers,
// and theft reports placed near stands so they move risk scores.
//
//   npm run seed:dummy                    replace any previous dummy data with a fresh set
//   npm run seed:dummy -- --dry-run       print what would be inserted and the resulting risk spread
//   npm run seed:dummy -- --reports=300   number of reports (default 120)
//   npm run seed:dummy:clear              remove all dummy data
//
// Every dummy document has `dummy: true`; real stands and reports are never touched.
// Reports use source "seed" (not "demo"), so `npm run reset` leaves them alone.
// Minor reports expire 48h after their created_at, like real ones.
import { client, reports, spots } from '../src/db.js';
import { scorePoints, R } from '../src/risk.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? Number(arg.split('=')[1]) : fallback;
};
const DRY_RUN = flag('dry-run');
const CLEAR_ONLY = flag('clear');
const REPORT_COUNT = option('reports', 120);
const SEED = option('seed', 42);

// Deterministic randomness, so the same seed gives the same map
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);

// Metres -> degrees at Dublin's latitude
const M_PER_DEG_LAT = 111200;
const M_PER_DEG_LNG = 66400;
function offset([lng, lat], metres, bearing) {
  return [lng + (Math.sin(bearing) * metres) / M_PER_DEG_LNG, lat + (Math.cos(bearing) * metres) / M_PER_DEG_LAT];
}
const round6 = (n) => Math.round(n * 1e6) / 1e6;

// ---------------------------------------------------------------- stands

// Neighbourhoods the real data covers thinly: [centre lat, lng], jitter radius (m), stands to add, streets.
// Coastal centres are nudged inland and use a small jitter so stands stay on land.
const NEIGHBOURHOODS = {
  Stoneybatter: [[53.353, -6.286], 350, 8, ['Manor St', 'Prussia St', 'Oxmantown Rd', 'Aughrim St', 'Arbour Hill', 'Brunswick St North']],
  Drumcondra: [[53.37, -6.255], 400, 12, ['Drumcondra Rd Upper', 'Drumcondra Rd Lower', 'St Alphonsus Rd', 'Grace Park Rd', 'Clonliffe Rd', 'Millmount Ave']],
  Glasnevin: [[53.372, -6.275], 400, 12, ['Botanic Rd', 'Glasnevin Ave', 'Iona Rd', 'Mobhi Rd', 'Ballymun Rd', 'Prospect Ave']],
  Clontarf: [[53.3655, -6.205], 250, 12, ['Vernon Ave', 'Clontarf Rd', 'Castle Ave', 'Seafield Rd West', 'Haddon Rd', 'Kincora Rd']],
  Fairview: [[53.3635, -6.238], 250, 10, ['Fairview Strand', 'Philipsburgh Ave', 'Annesley Bridge Rd', 'Marino Mart', 'Richmond Rd']],
  'North Strand': [[53.356, -6.242], 300, 8, ['North Strand Rd', 'Ossory Rd', 'Charleville Ave', 'Poplar Row', 'Leinster Ave']],
  Ringsend: [[53.3415, -6.2265], 200, 10, ['Bridge St, Ringsend', 'Thorncastle St', 'Irishtown Rd', 'Fitzwilliam St, Ringsend', 'Pembroke St, Irishtown']],
  Sandymount: [[53.333, -6.22], 250, 10, ['Sandymount Green', 'Gilford Rd', 'Newbridge Ave', 'Tritonville Rd', 'Serpentine Ave', 'Park Ave']],
  Ballsbridge: [[53.329, -6.231], 350, 8, ['Pembroke Rd', 'Merrion Rd', 'Shelbourne Rd', 'Lansdowne Rd', 'Herbert Park', 'Anglesea Rd']],
  Donnybrook: [[53.321, -6.237], 350, 10, ['Donnybrook Rd', 'Morehampton Rd', 'Belmont Ave', 'Eglinton Rd', 'Beaver Row']],
  Ranelagh: [[53.326, -6.256], 300, 8, ['Ranelagh Rd', 'Sandford Rd', 'Charleston Rd', 'Mountpleasant Ave Upper', 'Ranelagh Village']],
  Rathmines: [[53.322, -6.265], 350, 10, ['Rathmines Rd Lower', 'Rathmines Rd Upper', 'Castlewood Ave', 'Leinster Rd', 'Grosvenor Rd', 'Rathgar Rd']],
  Rathgar: [[53.313, -6.274], 350, 12, ['Rathgar Rd', 'Highfield Rd', 'Orwell Rd', 'Terenure Rd East', 'Garville Ave', 'Brighton Rd']],
  "Harold's Cross": [[53.325, -6.281], 350, 10, ["Harold's Cross Rd", 'Kimmage Rd Lower', 'Leinster Rd West', 'Mount Drummond Ave', 'Clareville Rd']],
  "Dolphin's Barn": [[53.333, -6.293], 300, 8, ["Dolphin's Barn St", 'Cork St', 'Crumlin Rd', 'Reuben St', 'Herberton Rd']],
  Kilmainham: [[53.341, -6.307], 350, 8, ['Old Kilmainham', 'Inchicore Rd', 'South Circular Rd, Kilmainham', 'Emmet Rd', 'Bow Lane West']],
  Inchicore: [[53.339, -6.323], 350, 10, ['Emmet Rd', 'Tyrconnell Rd', 'Inchicore Rd', 'Sarsfield Rd', 'Bulfin Rd']],
  Islandbridge: [[53.3455, -6.314], 250, 6, ['Conyngham Rd', 'South Circular Rd, Islandbridge', 'Memorial Rd', 'Sarsfield Rd']],
  Cabra: [[53.364, -6.295], 400, 12, ['Fassaugh Ave', 'Cabra Rd', 'Navan Rd', 'Quarry Rd', 'Dowth Ave', 'New Cabra Rd']],
  Milltown: [[53.311, -6.252], 350, 8, ['Milltown Rd', 'Dartry Rd', 'Churchtown Rd Lower', 'Bird Ave', 'Clonskeagh Rd']],
  Terenure: [[53.309, -6.285], 350, 12, ['Terenure Rd North', 'Templeogue Rd', 'Terenure Rd West', 'Fortfield Rd', 'Kenilworth Park']],
  Crumlin: [[53.327, -6.315], 450, 12, ['Crumlin Rd', 'Sundrive Rd', 'Captain\'s Rd', 'Leighlin Rd', 'Stannaway Rd', 'Kildare Rd']],
  Marino: [[53.364, -6.228], 300, 8, ['Griffith Ave', 'Malahide Rd', 'Marino Crescent', 'Shanard Rd', 'Croydon Park Ave']],
  Whitehall: [[53.382, -6.244], 400, 10, ['Swords Rd', 'Collins Ave', 'Griffith Ave Extension', 'Iveragh Rd', 'Larkhill Rd']],
  Santry: [[53.39, -6.246], 400, 10, ['Santry Ave', 'Swords Rd, Santry', 'Coolock Lane', 'Shanowen Rd', 'Lorcan Ave']],
  Raheny: [[53.381, -6.177], 400, 10, ['Main St, Raheny', 'Howth Rd', 'Station Rd, Raheny', 'Watermill Rd', 'All Saints Rd']],
  Booterstown: [[53.3045, -6.201], 250, 8, ['Booterstown Ave', 'Rock Rd', 'Cross Ave', 'Merrion Ave', 'Mount Merrion Ave']],
  Chapelizod: [[53.348, -6.341], 300, 6, ['Main St, Chapelizod', 'Chapelizod Rd', 'Martin\'s Row', 'Lucan Rd']],
};

const SPOTS_NEAR = [
  'outside the pharmacy',
  'by the bus stop',
  'outside the Centra',
  'at the community centre',
  'by the school gates',
  'outside the post office',
  'at the church',
  'outside the library',
  'by the park entrance',
  'outside the GAA club',
  'at the shopping parade',
  'outside the credit union',
];

function makeStands() {
  const stands = [];
  for (const [area, [[lat, lng], jitter, count, streets]] of Object.entries(NEIGHBOURHOODS)) {
    for (let i = 0; i < count; i++) {
      const [x, y] = offset([lng, lat], Math.sqrt(rand()) * jitter, rand() * 2 * Math.PI);
      // Lighting and safety lean together: a dark stand is rarely rated safe
      const lighting = pick(['Low', 'Medium', 'Medium', 'High', 'High']);
      const safety_rating =
        lighting === 'Low' ? pick(['Low', 'Low', 'Medium']) : lighting === 'High' ? pick(['Medium', 'High', 'High']) : pick(['Low', 'Medium', 'High']);
      stands.push({
        name: `${pick(streets)}, ${pick(SPOTS_NEAR)}`,
        council_area: 'Dublin',
        capacity: String(pick([4, 4, 6, 6, 8, 10, 12, 16])),
        location: { type: 'Point', coordinates: [round6(x), round6(y)] },
        lighting,
        safety_rating,
        dummy: true,
        area, // only used to build report text; stripped before insert
      });
    }
  }
  return stands;
}

// ---------------------------------------------------------------- reports

// Hotspots get many more reports, so some areas look clearly worse than others
const HOTSPOTS = [
  { name: "George's St", at: [-6.2645, 53.3427], weight: 6 },
  { name: 'Temple Bar', at: [-6.2655, 53.3452], weight: 6 },
  { name: 'Smithfield', at: [-6.278, 53.3482], weight: 5 },
  { name: 'Trinity', at: [-6.258, 53.344], weight: 4 },
  { name: 'Grafton St', at: [-6.26, 53.3405], weight: 4 },
  { name: 'Docklands', at: [-6.238, 53.3475], weight: 4 },
  { name: 'Phibsborough', at: [-6.273, 53.36], weight: 3 },
  { name: 'Rathmines', at: [-6.265, 53.322], weight: 3 },
  { name: 'Portobello', at: [-6.265, 53.331], weight: 3 },
  { name: 'Heuston', at: [-6.292, 53.3465], weight: 3 },
  { name: 'Connolly', at: [-6.2495, 53.3515], weight: 3 },
];
const HOTSPOT_RADIUS = 450; // metres: stands within this of a hotspot share its weight

// Placeholders: {place} stand street, {lock} lock type, {when} time, {bike} bike description.
// Filled independently, so 120 reports read as different people rather than one template.
const TEMPLATES = {
  bike_theft: [
    'Bike stolen from the stand on {place} {when}. {lock} cut clean through.',
    'Came back to an empty stand on {place}, {lock} left on the ground in two pieces.',
    'My {bike} was taken from {place} {when}. Angle grinder by the look of what was left of the {lock}.',
    'Second bike nicked from {place} this month. Locked frame and front wheel, both gone.',
    '{bike} gone from {place} {when}. They cut through the stand itself, not the lock.',
    'Stolen from {place} in broad daylight. A witness saw a van pull up and two lads load it.',
    'Locked my {bike} to the stand at {place} overnight, gone by morning. {lock} snapped.',
    'E-bike taken from {place} {when}. They cut the {lock} and pulled the battery too.',
    'Just the front wheel left on the stand at {place}, rest of my {bike} is gone.',
    'Friend’s {bike} robbed outside {place} {when}, they had a decent {lock} on it too.',
  ],
  parts_theft: [
    'Front wheel stolen off my bike at {place} {when}. Quick release, my own fault.',
    'Saddle and seatpost taken from my bike at {place}.',
    'Both lights and the bell robbed from my {bike} on {place} {when}.',
    'Back wheel gone at {place}, they left the frame locked up.',
    'Battery stolen from my e-bike at {place} while it was locked.',
    'Someone took the pedals and the basket off my bike at {place} {when}.',
    'Came back to {place} and my handlebars had been unbolted and taken.',
  ],
  attempted_theft: [
    'Someone tried to cut my {lock} at {place} {when}. Scratched up but it held.',
    'Came back to find my {lock} half sawn through at {place}.',
    'Keyhole jammed with glue at {place}, looks like someone tried to force it.',
    'Interrupted a guy working on a {lock} at {place} {when}, he legged it.',
    'Bike knocked over and the {lock} twisted at {place}, but they didn’t get it.',
  ],
  tampering: [
    'Brake cables cut on two bikes at {place} {when}.',
    'Tyres slashed on several bikes locked at {place}.',
    'The stand at {place} has had its bolts loosened so it lifts out of the ground.',
    'Spokes bent and the chain cut on my {bike} at {place}.',
  ],
  suspicious_activity: [
    'Two lads with bolt cutters hanging around the stands at {place} {when}.',
    'Same guy checking the locks on every bike at {place} for 20 minutes.',
    'Van parked up beside the bike stands at {place} for ages, people watching the bikes.',
    'Someone photographing locked bikes at {place} {when}, moved on when I asked.',
    'Fella in a hoodie trying the stands one by one at {place}, looked like he was testing locks.',
  ],
};
const FILL = {
  lock: ['D-lock', 'cable lock', 'chain lock', 'folding lock', 'Kryptonite lock', 'combination lock'],
  when: ['last night', 'this morning', 'around lunchtime', 'after work', 'on Saturday evening', 'between 7 and 9pm', 'while I was in the gym', 'during the match'],
  bike: ['bike', 'road bike', 'commuter bike', 'e-bike', 'hybrid', 'cargo bike', 'single-speed', 'Dublin Bikes-style hybrid'],
};
function fillTemplate(template, place) {
  const text = template
    .replace('{place}', place)
    .replace(/\{(lock|when|bike)\}/g, (_, key) => pick(FILL[key]));
  // A placeholder at the start of a sentence needs a capital ("Cable lock cut…", not "cable lock cut…")
  return text.replace(/(^|\. )([a-z])/g, (_, pre, c) => pre + c.toUpperCase());
}

const TYPE_WEIGHTS = [
  ['bike_theft', 40],
  ['parts_theft', 25],
  ['attempted_theft', 12],
  ['tampering', 8],
  ['suspicious_activity', 15],
];
function weightedPick(pairs) {
  let r = rand() * pairs.reduce((sum, [, w]) => sum + w, 0);
  for (const [value, w] of pairs) if ((r -= w) < 0) return value;
  return pairs[pairs.length - 1][0];
}

const dist = ([lng1, lat1], [lng2, lat2]) => Math.hypot((lng2 - lng1) * M_PER_DEG_LNG, (lat2 - lat1) * M_PER_DEG_LAT);

// Short readable place for report text from a stand name. Real names are free text
// ("Start of westborough street", "Jervis Street 1"), so trim the common noise.
function placeOf(stand) {
  const place = stand.name
    .split(',')[0]
    .replace(/^(start of|end of|top of|bottom of|outside|opposite|beside|near|at)\s+/i, '')
    .replace(/\s+\d+$/, '')
    .trim();
  // Names like "Outside 23" trim to nothing; fall back to the dummy stand's area
  if (place.length < 3) return stand.area ?? 'the stand';
  return place.charAt(0).toUpperCase() + place.slice(1);
}

function makeReports(allStands, count, now) {
  // Every stand gets weight 1; stands near a hotspot get that hotspot's weight on top
  const weighted = allStands.map((s) => {
    let w = 1;
    for (const h of HOTSPOTS) if (dist(s.location.coordinates, h.at) < HOTSPOT_RADIUS) w += h.weight;
    return [s, w];
  });

  const docs = [];
  for (let i = 0; i < count; i++) {
    const stand = weightedPick(weighted);
    // 20–140m from the stand: always inside the 150m scoring radius, and on land if the stand is
    const [lng, lat] = offset(stand.location.coordinates, between(20, 140), rand() * 2 * Math.PI);
    const type = weightedPick(TYPE_WEIGHTS);
    const major = type === 'bike_theft' ? rand() < 0.85 : type === 'parts_theft' ? rand() < 0.4 : rand() < 0.15;

    // Majors spread over 30 days (most recent weeks count most). Minors expire 48h after creation,
    // so they're kept inside the last ~46h or the TTL index would delete them straight away.
    const ageMs = major ? rand() ** 1.4 * 30 * 86400e3 : rand() * 46 * 3600e3;
    const created_at = new Date(now - ageMs);

    const doc = {
      location: { type: 'Point', coordinates: [round6(lng), round6(lat)] },
      report_text: fillTemplate(pick(TEMPLATES[type]), placeOf(stand)),
      incident_type: type,
      severity: major ? 'major' : 'minor',
      created_at,
      source: 'seed',
      dummy: true,
    };
    if (!major) doc.expires_at = new Date(created_at.getTime() + 48 * 3600e3);
    docs.push(doc);
  }
  return docs;
}

// ---------------------------------------------------------------- run

function riskSpread(allStands, allReports, now) {
  const buckets = { green: 0, amber: 0, red: 0 }; // same thresholds as lib/mapUtils.js
  for (const s of allStands) {
    const near = allReports.filter((r) => dist(s.location.coordinates, r.location.coordinates) < R + 10);
    const { score } = scorePoints(s.location.coordinates, near, R, now);
    buckets[score >= 60 ? 'red' : score >= 30 ? 'amber' : 'green']++;
  }
  return buckets;
}

try {
  if (CLEAR_ONLY) {
    const s = await spots.deleteMany({ dummy: true });
    const r = await reports.deleteMany({ dummy: true });
    console.log(`removed ${s.deletedCount} dummy stands and ${r.deletedCount} dummy reports`);
  } else {
    const now = Date.now();
    const newStands = makeStands();
    const realStands = await spots.find({ dummy: { $ne: true } }, { projection: { name: 1, location: 1 } }).toArray();
    const allStands = [...realStands, ...newStands];
    const newReports = makeReports(allStands, REPORT_COUNT, now);
    const realReports = await reports
      .find({ dummy: { $ne: true } }, { projection: { location: 1, severity: 1, created_at: 1 } })
      .toArray();

    const majors = newReports.filter((r) => r.severity === 'major').length;
    console.log(`stands: ${realStands.length} real + ${newStands.length} dummy`);
    console.log(`reports: ${realReports.length} real + ${newReports.length} dummy (${majors} major, ${newReports.length - majors} minor)`);
    console.log('risk spread across all stands:', riskSpread(allStands, [...realReports, ...newReports], now));

    if (DRY_RUN) {
      console.log('\nsample stands:');
      for (const s of newStands.slice(0, 4)) console.log(' ', s.name, s.location.coordinates);
      console.log('sample reports:');
      for (const r of newReports.slice(0, 4)) console.log(' ', r.severity, r.incident_type, '-', r.report_text);
      console.log('\ndry run: nothing written');
    } else {
      const s = await spots.deleteMany({ dummy: true });
      const r = await reports.deleteMany({ dummy: true });
      if (s.deletedCount || r.deletedCount) console.log(`replaced previous dummy data (${s.deletedCount} stands, ${r.deletedCount} reports)`);
      await spots.insertMany(newStands.map(({ area, ...doc }) => doc));
      await reports.insertMany(newReports);
      console.log(`inserted ${newStands.length} dummy stands and ${newReports.length} dummy reports`);
    }
  }
} finally {
  await client.close();
}
