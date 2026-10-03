# Dublin Lock & Ride API

Base URL: `http://localhost:3001/api`. Every response is JSON except `/stream`. CORS allows `CORS_ORIGIN` (default `http://localhost:3000`).

**Conventions**
- Query params and request bodies use `lat` and `lng`. Stored GeoJSON is always `coordinates: [lng, lat]`.
- `_id` is a 24-char hex string. Dates are ISO 8601 strings.
- `risk` is always `{ score, incidents }`. `score` is an integer from 0 to 100. `incidents` is a **count** of reports within 150m, not an array.
- Errors come back as `{ "error": "message" }` with status 400 (bad input), 404 or 500.
- `embedding` is never returned by any endpoint or event.

---

## GET /health

```bash
curl localhost:3001/api/health
```
```json
{ "ok": true, "db": "lockride", "streamMode": "change-stream" }
```
`streamMode` is `"fallback"` when the server runs with `STREAM_FALLBACK=1`.

---

## GET /stream (Server-Sent Events)

Live feed of new reports and the risk changes they cause.

```js
const es = new EventSource('http://localhost:3001/api/stream');

es.addEventListener('incident', (e) => {
  const report = JSON.parse(e.data);      // add a marker
});

es.addEventListener('risk_update', (e) => {
  const updates = JSON.parse(e.data);     // recolour these stands
  for (const { spot_id, score, incidents } of updates) { /* ... */ }
});
```
The browser reconnects automatically: the server sends `retry: 3000`. The server also sends a `: ping` comment every 20s, and EventSource ignores it.

### event: `incident`
Sent once for every new theft report. It contains the full document minus `embedding`.
```
event: incident
data: {"_id":"6ac0ec56218d6d03ea128705","location":{"type":"Point","coordinates":[-6.2645,53.3427]},"report_text":"Front wheel stolen on George's St.","incident_type":"parts_theft","severity":"minor","created_at":"2026-10-03T11:51:50.173Z","expires_at":"2026-10-05T11:51:50.173Z","source":"demo"}
```

### event: `risk_update`
Sent immediately after each `incident`. It holds the new risk for every stand within 150m of that report, up to 20 stands. If no stand is that close, it's an empty array `[]`.
```
event: risk_update
data: [{"spot_id":"6ac0f1a2218d6d03ea128710","score":71,"incidents":2},{"spot_id":"6ac0f1a2218d6d03ea128719","score":34,"incidents":1}]
```
`spot_id` matches `_id` from `/parking/nearby`.

> Every insert into `theft_reports` produces events, including inserts by scripts and other teammates, because the server watches the collection. In `STREAM_FALLBACK=1` mode, only reports made through `POST /reports` produce events.

---

## POST /reports

Submit a theft report.

| field | type | required | notes |
|---|---|---|---|
| `lat` | number | yes | 53.2 – 53.45 |
| `lng` | number | yes | -6.45 – -6.05 |
| `report_text` | string | yes | 1–1000 chars |
| `incident_type` | string | no | default `"other"`, e.g. `bike_theft`, `parts_theft`, `tampering` |
| `severity` | `"minor"` \| `"major"` | no | default `"minor"`. Minor reports expire after 48h |
| `source` | `"user"` \| `"demo"` \| `"seed"` | no | default `"user"` |

```bash
curl -X POST localhost:3001/api/reports \
  -H 'Content-Type: application/json' \
  -d '{"lat":53.3444,"lng":-6.2590,"report_text":"D-lock cut outside Trinity front gate","incident_type":"bike_theft","severity":"major"}'
```
**201**
```json
{ "_id": "6ac0f3b9218d6d03ea128722" }
```
**400** examples
```json
{ "error": "location must be inside Dublin (lat 53.2–53.45, lng -6.45–-6.05)" }
{ "error": "report_text is required" }
{ "error": "severity must be \"minor\" or \"major\"" }
{ "error": "Document failed schema validation", "errInfo": { "...": "..." } }
```
The new report arrives through `/stream` as an `incident` event, so you don't need to add it to the map from this response.

---

## GET /risk?lat&lng

Risk score at any point.

```bash
curl 'localhost:3001/api/risk?lat=53.3427&lng=-6.2645'
```
```json
{ "score": 63, "incidents": 2 }
```

**Model:** each report within 150m adds `severity × recency × proximity`:
- severity: minor 1, major 3
- recency: `0.5^(ageHours/168)`, which halves every week
- proximity: `1 − distance/150`

`score = round(100 × (1 − e^(−sum/3)))`. For example, one fresh major report right at the point scores 63, and one fresh minor scores 28.

---

## GET /parking/nearby?lat&lng&radius

Bike stands near a point, nearest first, each with its risk.

| param | default | notes |
|---|---|---|
| `lat`, `lng` | required | |
| `radius` | 200 | metres, capped at 8000. At most 1500 stands are returned |

```bash
curl 'localhost:3001/api/parking/nearby?lat=53.3430&lng=-6.2620&radius=300'
```
```json
[
  {
    "_id": "6ac0f1a2218d6d03ea128710",
    "name": "South Great George's St",
    "council_area": "Dublin",
    "capacity": "10",
    "location": { "type": "Point", "coordinates": [-6.2645, 53.3427] },
    "lighting": "High",
    "safety_rating": "Medium",
    "distance": 169.4,
    "risk": { "score": 71, "incidents": 2 }
  }
]
```
Stand fields come straight from `parking_spots` (Role 1's data). `capacity` is a string (e.g. `"4"`). `lighting` and `safety_rating` are `"Low" | "Medium" | "High"`. `distance` is in metres from the query point and `risk` is computed live. Returns `[]` if nothing is in range.

---

## GET /incidents?limit

Most recent reports, newest first.

| param | default | notes |
|---|---|---|
| `limit` | 100 | capped at 500 |

```bash
curl 'localhost:3001/api/incidents?limit=20'
```
Returns an array of report documents, the same shape as `/incidents/search` below.

---

## GET /incidents/search?q&limit

Natural-language search over report text.

| param | default | notes |
|---|---|---|
| `q` | required | |
| `limit` | 10 | capped at 50 |

```bash
curl 'localhost:3001/api/incidents/search?q=lock&limit=5'
```
```json
[
  {
    "_id": "6ac0f3b9218d6d03ea128722",
    "location": { "type": "Point", "coordinates": [-6.259, 53.3444] },
    "report_text": "D-lock cut outside Trinity front gate",
    "incident_type": "bike_theft",
    "severity": "major",
    "created_at": "2026-10-03T12:10:02.511Z",
    "source": "user"
  }
]
```
Results are ranked by meaning with Atlas Vector Search (`theft_reports_vector`, Automated Embedding with `voyage-4` on `report_text`), so "someone checking locks" finds "man testing locks one by one". Each result has a `score` from 0 to 1. New reports become searchable a few seconds after insert, once Atlas has embedded them. If vector search is unavailable, the endpoint falls back to a case-insensitive substring match, newest first, without `score`.
