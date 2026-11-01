#!/usr/bin/env node
'use strict';
/* G9 — the v0.0.1.a release audit: retirement, budgets, ES5 and no-build purity.
 * contract: docs/ARCHITECTURE_MAP.md §3 retired ids/strings, §5 H1 budgets, §R10 load order
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R1 preserved payloads, §R6 PWA pins
 * Static only: nothing here needs a browser, so it can run in any CI container. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const bytes = (rel) => fs.statSync(path.join(ROOT, rel)).size;
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
const tracked = require('node:child_process').execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n');

/* ── 1. retirement: nothing from v42–v60 may survive ───────────────────── */
// contract: docs/ARCHITECTURE_MAP.md §3
const RETIRED_FILES = [
  'data/app-core.js', 'data/app.js', 'data/sdp-v50.js', 'data/sdp-v56.js', 'data/sdp-v58.js',
  'data/legacy.js', 'sw-v60.js', 'assets/css/sdp-ui-v50.css', 'assets/css/material-mixer.css',
  'data.html.bak', 'index-v60.html', 'manifest-v60.webmanifest'
];
const presentRetiredFiles = RETIRED_FILES.filter(exists);
check('G9.1a zero retired v42-v60 files exist on disk', presentRetiredFiles.length === 0, presentRetiredFiles.join(','));

const RETIRED_DIRS = ['scripts', 'qa', 'assets/video', 'assets/wallpapers', 'assets/audio/guide'];
const presentDirs = RETIRED_DIRS.filter(exists);
check('G9.1b zero retired directories (scripts/, qa/, video wallpapers)', presentDirs.length === 0, presentDirs.join(','));

const videoFiles = tracked.filter((f) => /\.(mp4|webm|mov|mkv)$/i.test(f));
check('G9.1c the 12.9 MB video wallpapers are gone from Git', videoFiles.length === 0, videoFiles.join(','));

const mp3s = tracked.filter((f) => /\.mp3$/i.test(f));
check('G9.1d no 11-byte fake guide MP3 stubs are tracked', mp3s.length === 0, mp3s.join(','));

const RETIRED_MARKERS = [
  'bgLiveWrap', 'bgLiveVideo', 'btnLiveVideo', 'liveVideoInput', 'dimTpl', 'dimHostSet', 'sVideoDim',
  'topDataBadge', 'topDataMB', 'topDataLkr', 'btnDataSheet', 'dataSheet', 'guideSheet', 'btnReadyTest',
  'screen-comm', 'tab-comm', 'commBadge', 'btnMsg', 'printview', 'materialMixer', 'MaterialMixer',
  'focusDimmer', 'rupeeCalculator', 'readySheet', 'communityTab', 'v58Rail', 'sdpDesktopRail'
];
const indexHtml = read('index.html');
const shipped = ['index.html', 'assets/css/sdp-ui.css', 'data.html', 'data/index.html', 'sw.js',
  'data/sdp-data-sync.js', 'data/sdp-audio-speech.js', 'data/sdp-dictation-engine.js',
  'data/sdp-ui-views.js', 'data/studio.js', 'data/data-meter.js', 'manifest.webmanifest'];
const markerHits = [];
for (const file of shipped) {
  const text = read(file).toLowerCase();
  for (const marker of RETIRED_MARKERS) if (text.indexOf(marker.toLowerCase()) >= 0) markerHits.push(file + ':' + marker);
}
check('G9.1e zero retired v42-v60 markers in any shipped file', markerHits.length === 0, markerHits.join(','));

const cssText = read('assets/css/sdp-ui.css');
check('G9.1f no retired CSS is merely hidden with display:none',
  !/display\s*:\s*none\s*!important[^}]*video/i.test(cssText) && cssText.indexOf('video') < 0, 'video reference in CSS');

/* ── 2. H1 byte budgets ────────────────────────────────────────────────── */
// contract: docs/ARCHITECTURE_MAP.md §5 budget table
const BUDGETS = {
  'index.html': 35000,
  'assets/css/sdp-ui.css': 60000,
  'data/sdp-data-sync.js': 48000,
  'data/sdp-audio-speech.js': 40000,
  'data/sdp-dictation-engine.js': 48000,
  'data/sdp-ui-views.js': 90000,
  'data/studio.js': 60000,
  'data/data-meter.js': 22000,
  'data/config.json': 36000,
  'data/version.json': 2000,
  'data/session.json': 46403,
  'data/gas-source.txt': 13764,
  'data/elevenlabs-audio.json': 717,
  'assets/fonts/NotoSansSinhala-Regular.woff2': 48520,
  'assets/fonts/NotoSansSinhala-Bold.woff2': 48748,
  'data.html': 60000,
  'data/index.html': 60000,
  'sw.js': 12000,
  'manifest.webmanifest': 4000
};
const over = [];
for (const [file, cap] of Object.entries(BUDGETS)) {
  const size = bytes(file);
  if (!(size <= cap)) over.push(file + ' ' + size + '>' + cap);
}
check('G9.2a every shipped file fits its H1 byte cap', over.length === 0, over.join(', '));
check('G9.2b the /data pair is byte-identical', read('data.html') === read('data/index.html'),
  bytes('data.html') + ' vs ' + bytes('data/index.html'));

const docsBudget = { 'ARCHITECTURE_MAP.md': 20000, 'CHANGELOG_LEDGER.md': 20000, 'DAILY_UPGRADE_PROMPT_TEMPLATE.md': 8000, 'SYNC_AND_DATA_CONTRACT.md': 20000, 'UI_COMPONENT_GUIDE.md': 20000 };
const docsOver = Object.entries(docsBudget).filter(([f, cap]) => bytes('docs/' + f) > cap).map(([f]) => f);
check('G9.2c all five living docs are inside their caps', docsOver.length === 0, docsOver.join(','));
check('G9.2d there are exactly five living docs', fs.readdirSync(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).length === 5);

const testBytes = tracked.filter((f) => f.startsWith('tests/') && /\.(cjs|js)$/.test(f))
  .reduce((sum, f) => sum + bytes(f), 0);
check('G9.2e the whole test suite stays inside 220,000 bytes (' + testBytes + ')', testBytes <= 220000, testBytes);

/* ── 3. no build step, no bundler, no monolith ─────────────────────────── */
// contract: docs/ARCHITECTURE_MAP.md §R3 ES5 modules
const monoliths = tracked.filter((f) => f.startsWith('data/') && /\.js$/.test(f) && bytes(f) > 90000);
check('G9.3a no oversized monolith module exists (' + monoliths.join(',') + ')', monoliths.length === 0);
check('G9.3b no package.json build script ships with the site', !exists('package.json') && !exists('webpack.config.js') && !exists('vite.config.js'));

const inlineEvent = /\son(click|input|change|submit|load|error|keydown|keyup)\s*=/i;
const inlineHits = shipped.filter((f) => /\.html$/.test(f)).filter((f) => inlineEvent.test(read(f)));
check('G9.3c no inline event handlers in HTML (no build-time JS in markup)', inlineHits.length === 0, inlineHits.join(','));

/* Two documented exceptions to "one stylesheet", both pre-paint only:
   (a) #sdpCloak in index.html hides .screen until sdp-ui.css applies, so a
       budget Android on 2G never flashes five stacked screens;
   (b) the /data transparency page is a standalone document with its own
       inlined styling and links no shared sheet (R9 byte audit of the app's
       CSS must not be inflated by a page that is not the app). */
const cloakBlocks = Array.from(indexHtml.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/gi));
const cloakOk = cloakBlocks.length === 1 &&
  /id="sdpCloak"/.test(cloakBlocks[0][1]) &&
  cloakBlocks[0][2].length <= 400 &&
  cloakBlocks[0][2].indexOf('.screen') >= 0 &&
  cloakBlocks[0][2].indexOf('dict-card') < 0 &&
  cloakBlocks[0][2].indexOf('.cockpit') < 0;
check('G9.3d index.html carries at most the 400-byte #sdpCloak pre-paint guard',
  cloakOk, cloakBlocks.length + ' style blocks, ' + (cloakBlocks[0] ? cloakBlocks[0][2].length : 0) + ' bytes');
const dataStyleOk = ['data.html', 'data/index.html'].every((f) => {
  const text = read(f);
  return (text.match(/<style[\s>]/gi) || []).length === 1 && text.indexOf('rel="stylesheet"') < 0;
});
check('G9.3e the /data page is self-contained (one inline sheet, no shared link)', dataStyleOk);
check('G9.3f no <style> block exists in any JS module',
  !shipped.filter((f) => /\.js$/.test(f)).some((f) => /<style[\s>]/i.test(read(f))));

const cssLinks = (indexHtml.match(/<link[^>]+rel="stylesheet"/g) || []).length;
check('G9.3e index.html links exactly one stylesheet', cssLinks === 1, cssLinks);
check('G9.3f the stylesheet is the shipped sdp-ui.css', indexHtml.indexOf('href="./assets/css/sdp-ui.css"') >= 0);
check('G9.3g no runtime CSS injection (no styleSheet.insertRule / adoptedStyleSheets)',
  !/insertRule|adoptedStyleSheets|new CSSStyleSheet/.test(read('data/sdp-ui-views.js') + read('data/studio.js') + read('data/sdp-dictation-engine.js')));

/* ── 4. ES5 purity across every shipped script ─────────────────────────── */
// contract: docs/ARCHITECTURE_MAP.md §R3 acorn ecmaVersion 5
const jsFiles = tracked.filter((f) => /\.js$/.test(f) && !f.startsWith('tests/'));
const es5Fails = [];
for (const file of jsFiles) {
  try {
    acorn.parse(read(file), { ecmaVersion: 5 });
  } catch (err) {
    es5Fails.push(file + ': ' + (err.message || '').slice(0, 60));
  }
}
check('G9.4a every shipped .js parses as strict ES5 (' + jsFiles.length + ' files)', es5Fails.length === 0, es5Fails.join(' | '));

const inlineScripts = [];
const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = scriptRe.exec(indexHtml)) !== null) if (m[1].trim()) inlineScripts.push(m[1]);
const inlineFails = [];
for (const code of inlineScripts) {
  try { acorn.parse(code, { ecmaVersion: 5 }); } catch (err) { inlineFails.push((err.message || '').slice(0, 60)); }
}
check('G9.4b every inline script in index.html parses as ES5 (' + inlineScripts.length + ' blocks)', inlineFails.length === 0, inlineFails.join(' | '));
check('G9.4c no eval / new Function anywhere', !jsFiles.some((f) => /\beval\s*\(|new\s+Function\s*\(/.test(read(f))));

const longLines = [];
for (const file of jsFiles.concat(['assets/css/sdp-ui.css', 'index.html'])) {
  const lines = read(file).split('\n');
  const worst = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const avg = lines.reduce((sum, line) => sum + line.length, 0) / Math.max(1, lines.length);
  if (worst > 400 || avg > 200) longLines.push(file + ' max=' + worst + ' avg=' + Math.round(avg));
}
check('G9.4d no minified files (max line <= 400 chars, mean <= 200)', longLines.length === 0, longLines.join(', '));

/* ── 5. the hard audio and storage laws ───────────────────────────────── */
// contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 no Web Audio, §R4 five keys
const allJs = jsFiles.map(read).join('\n');
check('G9.5a no AudioContext.createMediaElementSource anywhere', allJs.indexOf('createMediaElementSource') < 0);
check('G9.5b no AudioContext is constructed at all', !/new\s+(global\.)?AudioContext/.test(allJs));

const keyHits = new Set();
const keyRe = /['"]sdp\.([a-z_]+)['"]/g;
let k;
while ((k = keyRe.exec(allJs)) !== null) keyHits.add('sdp.' + k[1]);
const allowed = ['sdp.progress', 'sdp.settings', 'sdp.session', 'sdp.guide_seen', 'sdp.migrated_from_legacy'];
const strayKeys = Array.from(keyHits).filter((name) => allowed.indexOf(name) < 0);
check('G9.5c only the five R4 localStorage keys are named in scripts', strayKeys.length === 0, strayKeys.join(','));

/* ── 6. preserved payloads are untouched ──────────────────────────────── */
// contract: docs/SYNC_AND_DATA_CONTRACT.md §R1 SHA-256 lock table
const LOCKED = [
  ['data/session.json', 'e0e86c80'],
  ['data/gas-source.txt', '591b9b08'],
  ['data/elevenlabs-audio.json', '72b2b7db'],
  ['assets/fonts/NotoSansSinhala-Regular.woff2', '23f1503e'],
  ['assets/fonts/NotoSansSinhala-Bold.woff2', 'bf59c148']
];
const lockFails = LOCKED.filter(([file, prefix]) => sha(file).slice(0, 8) !== prefix).map(([f]) => f);
check('G9.6a all five preserved payloads still match their SHA-256 prefixes', lockFails.length === 0, lockFails.join(','));

const session = JSON.parse(read('data/session.json'));
const words = session.lists[0].words;
check('G9.6b the session still holds the 30 B1 adjectives', words.length === 30, words.length);
check('G9.6c every word keeps w, p, pos, m, si, s and audio fields',
  words.every((w) => ['w', 'p', 'pos', 'm', 'si', 's'].every((field) => typeof w[field] === 'string' && w[field].length > 0)), words.length);
check('G9.6d dictionary audio still points at youdao type=1', words.every((w) => String(w.audio || '').indexOf('youdao') >= 0 && String(w.audio).indexOf('type=1') >= 0));

const config = JSON.parse(read('data/config.json'));
const keepKeys = ['encVault', 'repoOwner', 'repoName', 'voiceId', 'voiceName', 'modelId', 'live', 'classInfo', 'credits', 'defaults', 'versionFamily'];
const missingKeys = keepKeys.filter((key) => !(key in config));
check('G9.6e config.json keeps every preserved payload field', missingKeys.length === 0, missingKeys.join(','));
check('G9.6f config.json pins the new release metadata',
  // contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.1.b is ver 2 / schema 2 / settingsRev 2
  config.ver === 2 && config.appVersion === '0.0.1.b' && config.version === '0.0.1.b' && config.schema === 2 && config.settingsRev === 2,
  JSON.stringify({ ver: config.ver, appVersion: config.appVersion, schema: config.schema }));

/* ── 7. PWA pins and load order ────────────────────────────────────────── */
// contract: docs/SYNC_AND_DATA_CONTRACT.md §R6, docs/ARCHITECTURE_MAP.md §R10
const manifest = JSON.parse(read('manifest.webmanifest'));
check('G9.7a the manifest names 0.0.1.b in its description', /0.0.1.b/.test(String(manifest.description)), manifest.description);
check('G9.7b the manifest start_url carries the pwa source tag', /source=pwa/.test(String(manifest.start_url)), manifest.start_url);
check('G9.7c theme and background are the 0.0.1.b matte black', manifest.theme_color === '#09090B' && manifest.background_color === '#09090B', manifest.theme_color);

const sw = read('sw.js');
check('G9.7d the service worker pins the 0.0.1.b cache names', sw.indexOf('sdp-v0.0.1.b') >= 0 && sw.indexOf('9.0.0.4') < 0);
check('G9.7e the service worker preserves the audio caches', sw.indexOf('sdp-youdao-v1') >= 0 && sw.indexOf('sdp-audio-clips') >= 0);

const order = ['data-meter.js', 'sdp-data-sync.js', 'sdp-audio-speech.js', 'sdp-dictation-engine.js', 'sdp-ui-views.js', 'studio.js'];
const scriptTags = Array.from(indexHtml.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)).map((x) => x[1]);
check('G9.7f index.html loads exactly six external scripts', scriptTags.length === 6, scriptTags.join(','));
check('G9.7g the R10 load order is respected', scriptTags.map((s) => s.replace('./data/', '')).join(',') === order.join(','), scriptTags.join(','));
check('G9.7h every script is deferred', Array.from(indexHtml.matchAll(/<script[^>]*src="[^"]+"[^>]*>/g)).every((x) => /\bdefer\b/.test(x[0])));

/* ── 8. the release gate files themselves ─────────────────────────────── */
const GATES = ['check.cjs', 'upgrade.test.cjs', 'phase1.cjs', 'server.cjs', 'browser.cjs',
  'upgrade-browser.cjs', 'e2e.cjs', 'live-lab.cjs', 'audit-v42.cjs'];
const missingGates = GATES.filter((f) => !exists('tests/' + f));
check('G9.8a all nine release gates exist', missingGates.length === 0, missingGates.join(','));
const cited = GATES.filter((f) => {
  const text = exists('tests/' + f) ? read('tests/' + f) : '';
  return text.indexOf('contract:') >= 0;
});
check('G9.8b every gate cites the contract it enforces', cited.length === GATES.length, GATES.length - cited.length + ' without citation');

const attribution = 'Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 / Lesandu';
check('G9.8c the attribution appears verbatim on Home', read('index.html').indexOf(attribution) >= 0);
check('G9.8d the attribution also appears in About', read('index.html').indexOf('id="aboutCard"') >= 0 && read('index.html').split(attribution).length - 1 === 2);
check('G9.8e the credits pill text is exact', (read('index.html').match(/CREDITS GOES TO Hansana/g) || []).length === 2);

const fails = results.filter((r) => r.status === 'FAIL');
console.log(JSON.stringify(results, null, 2));
console.log('\nG9 audit-v42.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
if (fails.length) process.exitCode = 1;
