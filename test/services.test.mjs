// Integration tests for the autocomplete + reverse-geocode layer (live Photon).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, reverseGeocode } from '../src/services.mjs';

test('suggest: returns NYC-biased autocomplete candidates with coordinates', async () => {
  const out = await suggest('Times Square');
  assert.ok(Array.isArray(out) && out.length >= 1, 'expected at least one suggestion');
  const first = out[0];
  assert.ok(typeof first.label === 'string' && first.label.length > 0, 'label missing');
  assert.ok(first.lat > 40.49 && first.lat < 40.92, `lat ${first.lat} not in NYC`);
  assert.ok(first.lon > -74.26 && first.lon < -73.69, `lon ${first.lon} not in NYC`);
});

test('suggest: empty / too-short query returns an empty list (no wasted calls)', async () => {
  assert.deepEqual(await suggest(''), []);
  assert.deepEqual(await suggest('a'), []);
});

test('reverseGeocode: turns a map coordinate into an address label', async () => {
  const r = await reverseGeocode(40.7308, -73.9973); // Washington Square Park
  assert.ok(typeof r.label === 'string' && r.label.length > 0, 'no label');
  assert.ok(Math.abs(r.lat - 40.7308) < 0.02 && Math.abs(r.lon + 73.9973) < 0.02);
});
