// Builds the single self-contained classroom file `banthescan-walk.html` by
// inlining the tested modules (src/geo.mjs, src/services.mjs) and the camera
// data (data/all-cameras.json) into src/template.html.
//
// Keeping one source of truth: the browser runs the exact functions the Node
// tests exercised — no hand-copied drift.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// Strip ESM `export ` keywords so the module bodies work as plain <script> code.
function inlineModule(path) {
  return readFileSync(here(path), 'utf8')
    .replace(/^export\s+/gm, '')
    .trim();
}

// Modules are inlined in dependency order (gazetteer imports from geo), with
// their cross-module `import` lines stripped since everything shares one scope.
const stripImports = (s) => s.replace(/^import\s.*$/gm, '').trim();
const geoJs = inlineModule('./src/geo.mjs');
const servicesJs = inlineModule('./src/services.mjs');
const gazetteerJs = stripImports(inlineModule('./src/gazetteer.mjs'));
const cameraData = readFileSync(here('./data/all-cameras.json'), 'utf8').trim();
const gazData = readFileSync(here('./data/gazetteer.json'), 'utf8').trim();
const examplesData = readFileSync(here('./data/examples.json'), 'utf8').trim();

const html = readFileSync(here('./src/template.html'), 'utf8')
  .replace('/*__GEO_JS__*/', () => geoJs)
  .replace('/*__SERVICES_JS__*/', () => servicesJs)
  .replace('/*__GAZETTEER_JS__*/', () => gazetteerJs)
  .replace('/*__CAMERA_DATA__*/[]', () => cameraData)
  .replace('/*__GAZETTEER_DATA__*/[]', () => gazData)
  .replace('/*__EXAMPLES_DATA__*/[]', () => examplesData);

// Sanity: every placeholder must be filled.
for (const token of ['__GEO_JS__', '__SERVICES_JS__', '__GAZETTEER_JS__', '__CAMERA_DATA__', '__GAZETTEER_DATA__', '__EXAMPLES_DATA__']) {
  if (html.includes(token)) throw new Error(`Unfilled placeholder: ${token}`);
}

const out = here('./banthescan-walk.html');
writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`Built banthescan-walk.html (${kb} KB, ${JSON.parse(cameraData).length} cameras embedded)`);
