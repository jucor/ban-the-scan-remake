// Network layer: geocoding + walking routes. Uses the universal `fetch`, so the
// same code runs in Node (integration tests) and in the browser (the tool).
//
// Drop-in replacements for the app's dead HERE calls:
//   geocode()   -> Nominatim (OpenStreetMap), biased to the NYC bounding box
//   walkRoute() -> OSRM foot profile (openstreetmap.de public server)

// NYC bounding box (same one the original app fed to HERE): W,S,E,N.
export const NYC_BBOX = { w: -74.2568, s: 40.4977, e: -73.6992, n: 40.9151 };

// fetch() with a small backoff retry on transient rate-limit / server errors.
// The public OSM services (Nominatim, OSRM, Photon) occasionally return 429/503.
async function fetchRetry(url, opts = {}, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) return res;
      if (![429, 500, 502, 503, 504].includes(res.status) || i === tries - 1) return res;
    } catch (e) {
      last = e;
      if (opts.signal?.aborted || i === tries - 1) throw e;
    }
    // Exponential backoff with random jitter, so a burst of clients that all
    // got throttled at once don't retry in lockstep and collide again.
    const base = 500 * 2 ** i;
    await new Promise((r) => setTimeout(r, base + Math.floor(rand() * base)));
  }
  if (last) throw last;
}

// Math.random is fine in the browser; kept as a helper so intent is clear.
function rand() { return Math.random(); }

// Address text -> { lat, lon, label }. Biased (but not hard-locked) to NYC.
// Throws if nothing is found.
export async function geocode(query, opts = {}) {
  const { w, s, e, n } = NYC_BBOX;
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '0',
    // viewbox = left,top,right,bottom  (lon_min,lat_max,lon_max,lat_min)
    viewbox: `${w},${n},${e},${s}`,
    bounded: '1',
  });
  const url = `https://nominatim.openstreetmap.org/search?${params}`;
  const res = await fetchRetry(url, {
    signal: opts.signal,
    // Nominatim's policy requires an identifying User-Agent. Node honours this;
    // browsers forbid setting User-Agent and silently drop it (their own UA is
    // sent instead, which Nominatim also accepts), so this is safe in both.
    headers: { 'Accept-Language': 'en', 'User-Agent': 'BanTheScan-Classroom/1.0 (privacy education demo)' },
  });
  if (!res.ok) throw new Error(`geocoding failed (${res.status})`);
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`No NYC match for "${query}"`);
  }
  const it = items[0];
  return { lat: parseFloat(it.lat), lon: parseFloat(it.lon), label: it.display_name };
}

// Build a readable one-line label from a Photon feature's properties.
function photonLabel(p) {
  const line1 = [p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [p.name, line1 && line1 !== p.name ? line1 : null, p.city || p.district, p.postcode]
    .filter(Boolean);
  // De-duplicate consecutive repeats (e.g. name === street).
  return parts.filter((v, i) => v !== parts[i - 1]).join(', ');
}

// Type-ahead suggestions for an address query, biased to NYC.
// Returns [] for empty/too-short queries so the UI never fires wasted calls.
export async function suggest(query, opts = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const { w, s, e, n } = NYC_BBOX;
  const params = new URLSearchParams({
    q,
    lang: 'en',
    limit: '6',
    lat: '40.7128',
    lon: '-73.99',
    bbox: `${w},${s},${e},${n}`,
  });
  const res = await fetchRetry(`https://photon.komoot.io/api/?${params}`, { signal: opts.signal });
  if (!res.ok) throw new Error(`autocomplete failed (${res.status})`);
  const data = await res.json();
  return (data.features || []).map((f) => ({
    label: photonLabel(f.properties),
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  })).filter((x) => x.label);
}

// Map coordinate -> { lat, lon, label } via Photon reverse geocoding.
export async function reverseGeocode(lat, lon, opts = {}) {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), lang: 'en' });
  const res = await fetchRetry(`https://photon.komoot.io/reverse?${params}`, { signal: opts.signal });
  if (!res.ok) throw new Error(`reverse geocoding failed (${res.status})`);
  const data = await res.json();
  const f = (data.features || [])[0];
  const label = f ? photonLabel(f.properties) : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  return { lat, lon, label: label || `${lat.toFixed(5)}, ${lon.toFixed(5)}` };
}

// Two {lat,lon} points -> { points:[{lat,lon},...], distanceMeters } walking path.
export async function walkRoute(from, to, opts = {}) {
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url =
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}` +
    `?overview=full&geometries=geojson`;
  const res = await fetchRetry(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`routing failed (${res.status})`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(`No walking route found (${data.code ?? 'unknown'})`);
  }
  const r = data.routes[0];
  const points = r.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
  return { points, distanceMeters: r.distance };
}
