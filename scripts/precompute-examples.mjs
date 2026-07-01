// One-off: precompute walking routes for the curated classroom examples so the
// synchronized "everyone try this one" moments run fully offline (no API calls).
// Run: node scripts/precompute-examples.mjs   (writes data/examples.json)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { geocode, walkRoute } from '../src/services.mjs';

// [fromQuery, toQuery, fromLabel, toLabel] — labels are curated for display.
const PAIRS = [
  ['Snyder Ave, Brooklyn, NYC', 'Church Ave, Brooklyn, NYC', 'Snyder Ave, Brooklyn', 'Church Ave, Brooklyn'],
  ['Times Square, Manhattan, NYC', 'Washington Square Park, Manhattan, NYC', 'Times Square', 'Washington Square Park'],
  ['Barclays Center, Brooklyn, NYC', 'Atlantic Terminal, Brooklyn, NYC', 'Barclays Center', 'Atlantic Terminal'],
  ['Grand Central Terminal, Manhattan, NYC', 'Bryant Park, Manhattan, NYC', 'Grand Central Terminal', 'Bryant Park'],
  ['Columbia University, Manhattan, NYC', 'Cathedral Parkway, Manhattan, NYC', 'Columbia University', 'Cathedral Pkwy'],
  ['Brooklyn Bridge, NYC', 'City Hall Park, Manhattan, NYC', 'Brooklyn Bridge', 'City Hall Park'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
for (const [fromQ, toQ, fromLabel, toLabel] of PAIRS) {
  const from = await geocode(fromQ); await sleep(1100);
  const to = await geocode(toQ); await sleep(1100);
  const route = await walkRoute(from, to); await sleep(300);
  out.push({
    from: { label: fromLabel, lat: from.lat, lon: from.lon },
    to: { label: toLabel, lat: to.lat, lon: to.lon },
    route: route.points.map((p) => [Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6))]),
  });
  console.log(`✓ ${fromLabel} → ${toLabel}: ${route.points.length} pts`);
}
const dest = fileURLToPath(new URL('../data/examples.json', import.meta.url));
writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${dest} (${out.length} examples)`);
