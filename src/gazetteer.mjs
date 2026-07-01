// Offline NYC gazetteer search — so autocomplete and map-click labels need no
// network at all. This is the key to surviving 40 students behind one IP: the
// per-keystroke lookups become local. Entries: [name, lat, lon, kind].

import { haversineMeters } from './geo.mjs';

const KIND_RANK = { hood: 0, stn: 1, poi: 1, uni: 1, park: 2, x: 3 };

// Rank a gazetteer entry against a lowercased query.
// Lower score = better. Returns null if it doesn't match at all.
function score(name, q) {
  const n = name.toLowerCase();
  if (n.startsWith(q)) return 0;                       // "Washington…" for "wash"
  if (n.split(/[\s\-,]+/).some((w) => w.startsWith(q))) return 1; // mid-name word
  if (n.includes(q)) return 2;                         // anywhere
  return null;
}

// Ranked local matches for an address query, shaped like the network results
// ({ label, lat, lon }). Returns [] for empty queries.
export function searchGazetteer(gaz, query, limit = 6) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  for (const [name, lat, lon, kind] of gaz) {
    const s = score(name, q);
    if (s === null) continue;
    hits.push({ name, lat, lon, kind, s });
  }
  hits.sort((a, b) =>
    a.s - b.s ||
    (KIND_RANK[a.kind] ?? 3) - (KIND_RANK[b.kind] ?? 3) ||
    a.name.length - b.name.length ||
    a.name.localeCompare(b.name));
  return hits.slice(0, limit).map((h) => ({ label: h.name, lat: h.lat, lon: h.lon }));
}

// Closest gazetteer entry to a coordinate — used to label map clicks offline.
export function nearestPlace(gaz, lat, lon) {
  let best = null;
  let bestD = Infinity;
  for (const [name, elat, elon] of gaz) {
    const d = haversineMeters(lat, lon, elat, elon);
    if (d < bestD) { bestD = d; best = { label: name, lat: elat, lon: elon, meters: d }; }
  }
  return best;
}
