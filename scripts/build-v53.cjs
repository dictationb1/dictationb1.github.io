#!/usr/bin/env node
/*
 * Deterministic v53 build for the single-file app.
 *
 *   1. patches index.html (APP_VERSION 5.9.0, storage key, schema, legacy keys)
 *   2. strips the old v52 injection block (the cluttered admin studio)
 *   3. injects scripts/v53-inline.js (migration + on-demand studio loader)
 *   4. publishes the studio itself as data/studio.js (voice vault, GitHub sync,
 *      3-step professor panel and the one-click word auto-completer)
 *   5. re-minifies the inline script with terser (ES5)
 *
 *   node scripts/build-v53.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
const INLINE = path.join(__dirname, 'v53-inline.js');
const STUDIO = path.join(ROOT, 'data', 'studio.js');
const START = '/* SECTION 60 - V53 INJECT START */';
const END = '/* SECTION 60 - V53 INJECT END */';
const ANCHOR = 'window.SDP={version:APP_VERSION';

const PATCHES = [
  ['APP_VERSION="5.8.0"', 'APP_VERSION="5.9.0"'],
  ['key:"sdp.v52_elevenlabs_studio"', 'key:"sdp.v53_github_voice_sync"'],
  ['schema:52,', 'schema:53,'],
  ['settingsRev:52,', 'settingsRev:53,'],
  ['CONFIG.schema=52,CONFIG.settingsRev=52', 'CONFIG.schema=53,CONFIG.settingsRev=53'],
  ['e=["sdp.v51_hooded_liquid_glass"', 'e=["sdp.v52_elevenlabs_studio","sdp.v51_hooded_liquid_glass"']
];

let html = fs.readFileSync(FILE, 'utf8');

/* strip the previous release injection, whichever marker survived minification */
const OLD_START = '/* SECTION 52 - V52 INJECT START */';
const OLD_LEGACY_START = '/* SECTION 52 - ELEVENLABS ONE-TIME STUDIO VOICE VAULT (v52) */';
const OLD_END = '/* SECTION 52 - V52 INJECT END */';
if (html.indexOf(OLD_END) > -1) {
  const end = html.indexOf(OLD_END) + OLD_END.length;
  let from = html.indexOf(OLD_START);
  if (from < 0) from = html.indexOf(OLD_LEGACY_START);
  if (from < 0) throw new Error('cannot locate the start of the v52 block');
  html = html.slice(0, from) + html.slice(end);
}

/* the 3-step studio styles (kept inside index.html: no external <link>) */
const STUDIO_CSS = '.prof-table{display:grid;gap:4px;margin-top:8px;overflow:auto}.prof-row{display:grid;grid-template-columns:44px 1fr 1fr 1fr 1.4fr auto;gap:8px;align-items:center;font-size:.82rem;padding:4px 0;border-bottom:1px solid var(--line-2)}.prof-row.head{font-weight:650;color:var(--ink-2)}.el-vault-list{display:grid;gap:6px;margin-top:8px;max-height:300px;overflow:auto}.el-vault-row{display:flex;gap:8px;align-items:center;font-size:.82rem;padding:6px 8px;border-radius:var(--r1);background:var(--field)}.el-vault-row>.grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.admin-advanced{margin-top:14px;border:1px solid var(--line-2);border-radius:var(--r1);padding:10px 12px}.admin-advanced>summary{cursor:pointer;font-weight:650}.field-details{margin-top:10px}.field-details>summary{cursor:pointer;font-size:.82rem;color:var(--ink-2)}@media(max-width:560px){.prof-row{grid-template-columns:34px 1fr 1fr}.prof-row>span:nth-child(n+4){display:none}}';
if (html.indexOf('.prof-row{') < 0) {
  const styleEnd = html.indexOf('</style>');
  if (styleEnd < 0) throw new Error('no </style> block found');
  html = html.slice(0, styleEnd) + STUDIO_CSS + html.slice(styleEnd);
}

for (const [from, to] of PATCHES) {
  if (html.indexOf(from) > -1) html = html.split(from).join(to);
}

const body = fs.readFileSync(INLINE, 'utf8').trim();
const payload = START + '\n' + body + '\n' + END;
if (html.indexOf(START) > -1) {
  const from = html.indexOf(START);
  const to = html.indexOf(END) + END.length;
  html = html.slice(0, from) + payload + html.slice(to);
} else {
  const at = html.indexOf(ANCHOR);
  if (at < 0) throw new Error('anchor not found: ' + ANCHOR);
  html = html.slice(0, at) + payload + '\n' + html.slice(at);
}
fs.writeFileSync(FILE, html);
/* assemble data/studio.js = prologue + voice vault / sync / studio + auto-completer */
fs.writeFileSync(STUDIO, [
  fs.readFileSync(path.join(__dirname, 'v53-studio-prologue.js'), 'utf8').trim(),
  fs.readFileSync(path.join(__dirname, 'v53-studio.source.js'), 'utf8').trim(),
  fs.readFileSync(path.join(__dirname, 'v53-completer.js'), 'utf8').trim()
].join('\n\n') + '\n');
console.log('injected: ' + Buffer.byteLength(html, 'utf8') + ' bytes; studio ' + fs.statSync(STUDIO).size + ' bytes');

cp.execFileSync(process.execPath, [path.join(__dirname, 'minify-inline.cjs')], { stdio: 'inherit' });
console.log('built: ' + fs.statSync(FILE).size + ' bytes');
