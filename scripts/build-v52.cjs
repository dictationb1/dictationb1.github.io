#!/usr/bin/env node
/*
 * Deterministic v52 build step for the single-file app.
 *
 *   1. patches index.html (version, storage key, schema, legacy-key fallback)
 *   2. injects scripts/v52-elevenlabs.js into the inline <script>
 *   3. re-minifies the inline script with terser (ES5)
 *
 * Run it from a clean checkout of the previous release:
 *
 *   git checkout -- index.html && node scripts/build-v52.cjs
 *
 * The injection markers match terser's kept-comment filter, so re-running on
 * an already built page replaces the block instead of duplicating it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
const SNIPPET = path.join(__dirname, 'v52-elevenlabs.js');
const START = '/* SECTION 52 - V52 INJECT START */';
const END = '/* SECTION 52 - V52 INJECT END */';
const ANCHOR = 'window.SDP={version:APP_VERSION';

const PATCHES = [
  ['APP_VERSION="5.7.0"', 'APP_VERSION="5.8.0"'],
  ['key:"sdp.v51_hooded_liquid_glass"', 'key:"sdp.v52_elevenlabs_studio"'],
  ['schema:51,', 'schema:52,'],
  ['settingsRev:51,', 'settingsRev:52,'],
  ['CONFIG.schema=51,CONFIG.settingsRev=51', 'CONFIG.schema=52,CONFIG.settingsRev=52'],
  ['e=["sdp.v50_all_p0_p6_fixed"', 'e=["sdp.v51_hooded_liquid_glass","sdp.v50_all_p0_p6_fixed",']
];

let html = fs.readFileSync(FILE, 'utf8');
for (const [from, to] of PATCHES) {
  if (html.indexOf(from) > -1) html = html.split(from).join(to);
}

const body = fs.readFileSync(SNIPPET, 'utf8').trim();
const payload = START + '\n' + body + '\n' + END;
if (html.indexOf(START) > -1) {
  const from = html.indexOf(START);
  const to = html.indexOf(END) + END.length;
  html = html.slice(0, from) + payload + html.slice(to);
} else {
  const at = html.indexOf(ANCHOR);
  if (at < 0) throw new Error('anchor not found: ' + ANCHOR);
  html = html.slice(0, at) + payload + html.slice(at);
}
fs.writeFileSync(FILE, html);
console.log('injected: ' + Buffer.byteLength(html, 'utf8') + ' bytes');

cp.execFileSync(process.execPath, [path.join(__dirname, 'minify-inline.cjs')], { stdio: 'inherit' });
console.log('built: ' + fs.statSync(FILE).size + ' bytes');
