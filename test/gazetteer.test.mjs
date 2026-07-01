import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchGazetteer, nearestPlace } from '../src/gazetteer.mjs';

const G = [
  ['Washington Square Park', 40.7308, -73.9973, 'park'],
  ['Washington Heights', 40.8417, -73.9394, 'hood'],
  ['Fort Washington Park', 40.8500, -73.9450, 'park'],
  ['Union Square', 40.7359, -73.9911, 'hood'],
  ['Times Square', 40.7580, -73.9855, 'hood'],
];

test('searchGazetteer: empty / whitespace query returns nothing', () => {
  assert.deepEqual(searchGazetteer(G, ''), []);
  assert.deepEqual(searchGazetteer(G, '   '), []);
});

test('searchGazetteer: returns matches shaped for the UI (label/lat/lon)', () => {
  const out = searchGazetteer(G, 'union');
  assert.equal(out.length, 1);
  assert.equal(out[0].label, 'Union Square');
  assert.equal(out[0].lat, 40.7359);
  assert.equal(out[0].lon, -73.9911);
});

test('searchGazetteer: name-prefix matches beat mid-name word matches', () => {
  const out = searchGazetteer(G, 'wash');
  const names = out.map((o) => o.label);
  // All three "Washington" entries match; the two that START with Washington
  // must come before "Fort Washington Park" (matches only mid-name).
  assert.ok(names.indexOf('Fort Washington Park') > names.indexOf('Washington Heights'));
  assert.ok(names.indexOf('Fort Washington Park') > names.indexOf('Washington Square Park'));
});

test('searchGazetteer: neighbourhoods outrank parks on an equal prefix match', () => {
  const out = searchGazetteer(G, 'washington');
  assert.equal(out[0].label, 'Washington Heights'); // hood ranks above park
});

test('searchGazetteer: is case-insensitive and respects the limit', () => {
  assert.equal(searchGazetteer(G, 'SQUARE').length, 3); // 3 "* Square" entries
  assert.equal(searchGazetteer(G, 'square', 2).length, 2);
});

test('nearestPlace: returns the closest entry to a coordinate', () => {
  const r = nearestPlace(G, 40.731, -73.997); // right by Washington Square Park
  assert.equal(r.label, 'Washington Square Park');
});
