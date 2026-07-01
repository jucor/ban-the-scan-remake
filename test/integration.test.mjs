// End-to-end integration test of the real pipeline (hits live Nominatim + OSRM).
// Reproduces the app's own "Snyder Ave -> Church Ave" walk and asserts it lands
// in the same ballpark the site shows ("0.5 miles", a few public cameras).
//
// Network-dependent by design: this is the integration seam that replaced the
// dead HERE APIs, so we verify it against the real services.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { geocode, walkRoute } from '../src/services.mjs';
import { countCamerasNearRoute, routeLengthMeters } from '../src/geo.mjs';

const publicCameras = JSON.parse(
  readFileSync(fileURLToPath(new URL('../data/cameras.json', import.meta.url))),
); // [[lat,lon], ...] — 2531 public NYPD cameras

test('geocode: resolves a NYC address to coordinates inside the city', async () => {
  const r = await geocode('Times Square, NYC');
  assert.ok(r.lat > 40.49 && r.lat < 40.92, `lat ${r.lat} out of NYC range`);
  assert.ok(r.lon > -74.26 && r.lon < -73.69, `lon ${r.lon} out of NYC range`);
  assert.ok(typeof r.label === 'string' && r.label.length > 0);
});

test('walkRoute: returns a multi-point path with a positive distance', async () => {
  const from = await geocode('Snyder Ave, Brooklyn, NYC');
  const to = await geocode('Church Ave, Brooklyn, NYC');
  const route = await walkRoute(from, to);
  assert.ok(route.points.length > 5, `too few points: ${route.points.length}`);
  assert.ok(route.distanceMeters > 0);
  for (const p of route.points) {
    assert.ok(typeof p.lat === 'number' && typeof p.lon === 'number');
  }
});

test('full pipeline: Snyder Ave -> Church Ave is ~0.5 mi with public cameras on route', async () => {
  const from = await geocode('Snyder Ave, Brooklyn, NYC');
  const to = await geocode('Church Ave, Brooklyn, NYC');
  const route = await walkRoute(from, to);

  const miles = routeLengthMeters(route.points) / 1609.34;
  assert.ok(miles > 0.2 && miles < 1.0, `distance ${miles.toFixed(2)} mi off (app shows ~0.5)`);

  const count = countCamerasNearRoute(publicCameras, route.points, 120);
  assert.ok(count >= 1, `expected at least one public camera near route, got ${count}`);
});
