// Pure geometry + camera-counting logic for the "cameras on your route" tool.
// No DOM, no network — safe to unit-test in Node.
//
// Conventions:
//   route  = [{lat, lon}, ...]        (ordered path points)
//   camera = [lat, lon]               (matches Amnesty's cameras.json rows)
//   radius = meters                   (Amnesty uses 120 m, its "400ft/120m" legend)

const R = 6371000;            // earth radius, meters
const D2R = Math.PI / 180;
const M_PER_DEG_LAT = R * D2R; // ~111194.9 m per degree of latitude

// Great-circle distance between two lat/lon points, in meters.
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * D2R;
  const dLon = (lon2 - lon1) * D2R;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const a = s1 * s1 + Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Shortest distance (meters) from point p to the segment a—b, using a local
// equirectangular projection anchored at a. Accurate at city scale.
export function pointToSegmentMeters(p, a, b) {
  const mLon = M_PER_DEG_LAT * Math.cos(a.lat * D2R);
  const toXY = (pt) => ({
    x: (pt.lon - a.lon) * mLon,
    y: (pt.lat - a.lat) * M_PER_DEG_LAT,
  });
  const P = toXY(p);
  const B = toXY(b);
  const len2 = B.x * B.x + B.y * B.y;
  let t = len2 === 0 ? 0 : (P.x * B.x + P.y * B.y) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = t * B.x;
  const cy = t * B.y;
  return Math.hypot(P.x - cx, P.y - cy);
}

// Min distance (meters) from a camera to any segment of the route.
export function minDistanceToRouteMeters(camLat, camLon, route) {
  const cam = { lat: camLat, lon: camLon };
  if (route.length === 0) return Infinity;
  if (route.length === 1) {
    return haversineMeters(camLat, camLon, route[0].lat, route[0].lon);
  }
  let min = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const d = pointToSegmentMeters(cam, route[i], route[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

// How many cameras lie within `radiusMeters` of the route.
export function countCamerasNearRoute(cameras, route, radiusMeters) {
  let n = 0;
  for (const c of cameras) {
    if (minDistanceToRouteMeters(c[0], c[1], route) <= radiusMeters) n++;
  }
  return n;
}

// Total walking length of the route, in meters.
export function routeLengthMeters(route) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineMeters(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
  }
  return total;
}

// Fraction [0,1] of the route length that lies within `radiusMeters` of at
// least one camera — i.e. the share of the walk under potential surveillance.
// Walks each segment in ~stepMeters increments and tests each increment's
// midpoint against every camera.
export function coverageFraction(route, cameras, radiusMeters, stepMeters = 10) {
  if (!cameras || cameras.length === 0) return 0;
  const total = routeLengthMeters(route);
  if (total === 0) return 0;
  let covered = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const segLen = haversineMeters(a.lat, a.lon, b.lat, b.lon);
    if (segLen === 0) continue;
    const n = Math.max(1, Math.ceil(segLen / stepMeters));
    const sub = segLen / n;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const lat = a.lat + (b.lat - a.lat) * t;
      const lon = a.lon + (b.lon - a.lon) * t;
      for (const c of cameras) {
        if (haversineMeters(lat, lon, c[0], c[1]) <= radiusMeters) {
          covered += sub;
          break;
        }
      }
    }
  }
  return covered / total;
}
