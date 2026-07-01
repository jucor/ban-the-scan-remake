import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineMeters,
  pointToSegmentMeters,
  minDistanceToRouteMeters,
  countCamerasNearRoute,
  routeLengthMeters,
  coverageFraction,
} from '../src/geo.mjs';

// Helper: assert two numbers are close within an absolute tolerance (meters).
function near(actual, expected, tolMeters, msg) {
  assert.ok(
    Math.abs(actual - expected) <= tolMeters,
    `${msg ?? ''} expected ~${expected}, got ${actual} (tol ${tolMeters})`,
  );
}

test('haversineMeters: one degree of latitude is ~111.2 km', () => {
  // 1 deg * earth radius(6371km) * pi/180 = 111194.9 m
  near(haversineMeters(40, -73, 41, -73), 111194.9, 50);
});

test('haversineMeters: identical points are 0 m apart', () => {
  assert.equal(haversineMeters(40.7, -74, 40.7, -74), 0);
});

test('pointToSegmentMeters: perpendicular offset from a segment', () => {
  // Horizontal segment along lat=40.70 from lon -74.00 to -73.99.
  // Point sits 0.001 deg lat north of the segment's middle ≈ 111.2 m away.
  const a = { lat: 40.70, lon: -74.00 };
  const b = { lat: 40.70, lon: -73.99 };
  const p = { lat: 40.701, lon: -73.995 };
  near(pointToSegmentMeters(p, a, b), 111.2, 3);
});

test('pointToSegmentMeters: clamps to the nearest endpoint when past the end', () => {
  // Point is beyond endpoint b, so distance is measured to b, not the infinite line.
  const a = { lat: 40.70, lon: -74.00 };
  const b = { lat: 40.70, lon: -73.99 };
  const p = { lat: 40.70, lon: -73.98 }; // 0.01 deg lon east of b
  const expected = haversineMeters(40.70, -73.98, 40.70, -73.99);
  near(pointToSegmentMeters(p, a, b), expected, 2);
});

test('minDistanceToRouteMeters: picks the closest segment of a multi-point route', () => {
  const route = [
    { lat: 40.70, lon: -74.00 },
    { lat: 40.70, lon: -73.99 },
    { lat: 40.71, lon: -73.99 },
  ];
  // Camera hugging the second (vertical) segment.
  const d = minDistanceToRouteMeters(40.705, -73.9895, route);
  near(d, haversineMeters(40.705, -73.9895, 40.705, -73.99), 3);
});

test('countCamerasNearRoute: counts only cameras within the radius', () => {
  const route = [
    { lat: 40.70, lon: -74.00 },
    { lat: 40.70, lon: -73.99 },
  ];
  const cameras = [
    [40.7001, -73.995], // ~11 m from route  -> counted
    [40.7005, -73.995], // ~55 m from route  -> counted at 120 m
    [40.75, -73.99],    // ~5.5 km away      -> not counted
  ];
  assert.equal(countCamerasNearRoute(cameras, route, 120), 2);
});

test('countCamerasNearRoute: radius boundary is inclusive-ish and radius matters', () => {
  const route = [
    { lat: 40.70, lon: -74.00 },
    { lat: 40.70, lon: -73.99 },
  ];
  const cameras = [[40.701, -73.995]]; // ~111 m north of the segment
  assert.equal(countCamerasNearRoute(cameras, route, 120), 1); // within 120 m
  assert.equal(countCamerasNearRoute(cameras, route, 100), 0); // outside 100 m
});

test('routeLengthMeters: sums segment lengths of the path', () => {
  const route = [
    { lat: 40.70, lon: -74.00 },
    { lat: 40.71, lon: -74.00 }, // ~1112 m north
    { lat: 40.71, lon: -73.99 }, // ~845 m east (cos(40.7)*111195/... )
  ];
  const expected =
    haversineMeters(40.70, -74.00, 40.71, -74.00) +
    haversineMeters(40.71, -74.00, 40.71, -73.99);
  near(routeLengthMeters(route), expected, 1);
});

test('coverageFraction: fully-covered route is ~100%', () => {
  const route = [
    { lat: 40.70, lon: -74.00 },
    { lat: 40.70, lon: -73.99 },
  ];
  // A camera sitting right on the route line; big radius blankets the whole path.
  const cameras = [[40.70, -73.995]];
  const frac = coverageFraction(route, cameras, 2000, 10);
  near(frac, 1.0, 0.02);
});

test('coverageFraction: no cameras means 0% covered', () => {
  const route = [
    { lat: 40.70, lon: -74.00 },
    { lat: 40.70, lon: -73.99 },
  ];
  assert.equal(coverageFraction(route, [], 120, 10), 0);
});

test('coverageFraction: a camera at one end covers roughly its radius worth of route', () => {
  // ~890 m long east-west segment; a camera at the west end with a 120 m radius
  // should cover roughly the first ~120 m => ~13-14% of the route.
  const route = [
    { lat: 40.70, lon: -74.00 },
    { lat: 40.70, lon: -73.9895 },
  ];
  const total = routeLengthMeters(route);
  const cameras = [[40.70, -74.00]];
  const frac = coverageFraction(route, cameras, 120, 5);
  near(frac * total, 120, 25); // covered length ≈ radius, within tolerance
});
