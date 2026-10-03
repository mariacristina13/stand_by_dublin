// Drive a live demo through the API (so it exercises validation, embedding and the stream).
//   npm run demo                    timed sequence at recognisable spots, ~8s apart
//   npm run demo -- --burst         5 reports near one stand, ~1.5s apart, so its score climbs
//   npm run demo -- --delay=3000    override the interval (ms)
// Uses source "demo", so `npm run reset` cleans up afterwards.
import 'dotenv/config';

const API = process.env.API || 'http://localhost:3001/api';
const args = process.argv.slice(2);
const burst = args.includes('--burst');
const delayArg = args.find((a) => a.startsWith('--delay='));
const delay = delayArg ? Number(delayArg.split('=')[1]) : burst ? 1500 : 8000;
if (!Number.isFinite(delay) || delay < 0) {
  console.error('--delay must be a non-negative number of milliseconds');
  process.exit(1);
}

const SEQUENCE = [
  { lat: 53.3427, lng: -6.2645, severity: 'major', incident_type: 'bike_theft',
    report_text: "Bike stolen from the stands on South Great George's St, D-lock cut clean through. Gone in under an hour." },
  { lat: 53.3444, lng: -6.2590, severity: 'minor', incident_type: 'tampering',
    report_text: 'Someone was trying the locks on bikes outside the Trinity front gate, moved on when I walked over.' },
  { lat: 53.3485, lng: -6.2780, severity: 'major', incident_type: 'bike_theft',
    report_text: 'Locked my bike in Smithfield Square for the evening, came back to just the front wheel still locked.' },
  { lat: 53.3390, lng: -6.2610, severity: 'minor', incident_type: 'parts_theft',
    report_text: 'Saddle and seatpost taken from my bike at the top of Grafton St, quick release.' },
];

// Burst: 5 reports clustered around the George's St stand
const BURST_CENTRE = { lat: 53.3427, lng: -6.2645 };
const BURST_TEXTS = [
  "Cable lock cut on a bike at George's St, bike gone.",
  "Saw a guy with bolt cutters near the George's St stands.",
  "Front wheel nicked off my bike on South Great George's St.",
  "Second bike stolen from George's St this week, lock left on the ground.",
  "Bike missing from the George's St stand after lunch, Kryptonite lock snapped.",
];
// ±30m: 1° lat ≈ 111km; at 53.34°N 1° lng ≈ 66.4km
const jitter = (metres, metresPerDeg) => ((Math.random() * 2 - 1) * metres) / metresPerDeg;

function burstReports() {
  return BURST_TEXTS.map((report_text, i) => ({
    lat: +(BURST_CENTRE.lat + jitter(30, 111_000)).toFixed(6),
    lng: +(BURST_CENTRE.lng + jitter(30, 66_400)).toFixed(6),
    severity: i % 2 ? 'minor' : 'major',
    incident_type: i === 2 ? 'parts_theft' : 'bike_theft',
    report_text,
  }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = burst ? burstReports() : SEQUENCE;
console.log(`${burst ? 'burst' : 'sequence'}: ${list.length} reports, ${delay}ms apart → ${API}/reports`);

for (const [i, report] of list.entries()) {
  if (i > 0) await sleep(delay);
  try {
    const res = await fetch(`${API}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...report, source: 'demo' }),
    });
    const body = await res.json();
    const tag = `[${i + 1}/${list.length}] ${report.severity.padEnd(5)} @ ${report.lat},${report.lng}`;
    console.log(res.ok ? `${tag} → ${body._id}` : `${tag} → ${res.status} ${body.error}`);
  } catch (err) {
    console.error(`[${i + 1}/${list.length}] request failed: ${err.message} (is the server running?)`);
  }
}
