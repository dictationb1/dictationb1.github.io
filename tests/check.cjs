/* v57 / 6.3.0 static release gate: ES5, size, secrets, metadata and wiring. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const acorn = require('acorn');
const ROOT = path.resolve(__dirname, '..');
const dir = path.join(__dirname, 'artifacts');
fs.mkdirSync(dir, { recursive: true });
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function parseES5(rel, label) {
  const src = read(rel), file = path.join(dir, label + '.js');
  fs.writeFileSync(file, src);
  cp.execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  acorn.parse(src, { ecmaVersion: 5 });
  return src;
}
function inlineScripts(html) { return Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g)).map(m => m[1]); }
function checkInline(rel, artifact, budget) {
  const html = read(rel), scripts = inlineScripts(html);
  if (!scripts.length) throw Error(rel + ' has no inline application script');
  scripts.forEach((script, i) => {
    const file = path.join(dir, artifact + '-' + i + '.js');
    fs.writeFileSync(file, script);
    cp.execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    acorn.parse(script, { ecmaVersion: 5 });
  });
  const bytes = Buffer.byteLength(html);
  if (bytes > budget) throw Error(rel + ' exceeds the ' + budget + '-byte budget');
  console.log(rel + ': node --check PASS; ES5 PASS; ' + bytes + ' / ' + budget + ' bytes');
  return html;
}
const INDEX = checkInline('index.html', 'app', 600000);
if (/<link\b(?![^>]*rel="manifest")/i.test(INDEX)) throw Error('index.html contains a non-manifest <link> tag');
if (!/<link[^>]*rel="manifest"[^>]*href="\.\/manifest\.webmanifest"/i.test(INDEX)) throw Error('manifest link missing');
checkInline('data.html', 'data-app', 60000);
checkInline('data/index.html', 'data-route-app', 60000);
if (read('data.html') !== read('data/index.html')) throw Error('data.html and data/index.html must remain identical');
const studio = parseES5('data/studio.js', 'studio');
const meterSrc = parseES5('data/data-meter.js', 'data-meter');
const sw = parseES5('sw.js', 'sw');
if (!/window\.ElevenVault\s*=/.test(studio)) throw Error('studio must expose ElevenVault');
if (!/adminGenerateMissing/.test(studio)) throw Error('studio generator missing');
if (!/SDPDataMeter\s*=/.test(meterSrc) || !/SDP_DATA_METER\s*=/.test(meterSrc)) throw Error('meter aliases missing');
if (!/PerformanceObserver/.test(meterSrc) || !/transferSize/.test(meterSrc) || !/getModeProfiles/.test(meterSrc)) throw Error('meter timing/profile wiring missing');
if (!/caches\.match/.test(sw)) throw Error('service worker cache strategy missing');

/* Secret/PIN gate: every shipped file, every test, and the rest of the repo. */
const SCAN_FILES = [
  'README.md', 'CHANGELOG.md', 'index.html', 'data.html', 'data/index.html',
  'data/studio.js', 'data/data-meter.js', 'sw.js',
  'data/config.json', 'data/session.json', 'data/version.json',
  'data/elevenlabs-audio.json', 'data/media-manifest.json', 'tests/test-pin.cjs'
];
const COMPROMISED_PIN = ['78', '98', '78', '98'].join('');
const COMPROMISED_HASH = ['17842399970b3f0f', 'a32f82c833a22477', 'd03223dfd6317d10', '31c123ab6ea38250'].join('');
function scanFile(rel) {
  const s = read(rel);
  if (s.includes(COMPROMISED_PIN)) throw Error(rel + ' contains the compromised default PIN');
  if (s.includes(COMPROMISED_HASH)) throw Error(rel + ' contains the seeded default PIN hash');
  if (/"adminPin"\s*:\s*"[^"]+"/.test(s)) throw Error(rel + ' contains a non-empty adminPin JSON literal');
  if (/(?:sk_|ghp_)[A-Za-z0-9_-]{16,}/.test(s)) throw Error(rel + ' contains a live-looking token literal');
}
SCAN_FILES.forEach(scanFile);
const tracked = cp.execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
tracked.filter(f => /\.(?:html|js|cjs|json|md|webmanifest|txt)$/i.test(f)).forEach(scanFile);
for (const f of ['data/config.json', 'data/session.json', 'data/version.json', 'data/elevenlabs-audio.json']) {
  const d = JSON.parse(read(f));
  if (d.adminPin || d.vaultCiphertext || d.keysTopic || d.wordsTopic || d.audioTopic) throw Error(f + ' still ships a PIN/vault/relay field');
}
console.log('secret gate: PASS (' + SCAN_FILES.length + ' required files + all tracked text files)');

/* Metadata and manifest. */
for (const f of ['data/version.json', 'data/config.json', 'data/session.json', 'data/elevenlabs-audio.json', 'data/media-manifest.json']) {
  const d = JSON.parse(read(f));
  if (d.ver !== 57 || d.appVersion !== '6.3.0') throw Error(f + ' must be ver 57 / appVersion 6.3.0');
}
if (!/APP_VERSION="6\.3\.0"/.test(INDEX)) throw Error('index APP_VERSION must be 6.3.0');
const manifest = JSON.parse(read('manifest.webmanifest'));
if (!manifest.name || manifest.display !== 'standalone' || manifest.theme_color !== '#040812') throw Error('invalid PWA manifest');
const media = JSON.parse(read('data/media-manifest.json'));
if (!Array.isArray(media.assets) || media.assets.length < 4) throw Error('media manifest must list wallpapers + static');
console.log('metadata: v57 / 6.3.0; media manifest: ' + media.assets.length + ' assets');

/* P0 runtime wiring markers. */
if (!/sdp\.v2:/.test(INDEX) || !/isUnlockedOnThisDevice/.test(INDEX)) throw Error('local salted PIN wiring missing');
if (!/fetchOnce:function/.test(studio.replace(/\s/g, '')) || !/strictAdminOnly/.test(studio)) throw Error('paid fetch guard missing');
if (/ntfy\.sh\/dictationb1_sdp_(keys|words|audio)/.test(studio)) throw Error('studio still contains a vault/audio relay');
if (!/persistedSession/.test(meterSrc) || !/videoBufferedBytes/.test(meterSrc) || !/content-length/.test(meterSrc)) throw Error('meter truth fixes missing');
if (!/data\/data-meter\.js/.test(read('data.html')) || !/liveSessionMB/.test(read('data.html')) || !/dataPlanPreset/.test(read('data.html'))) throw Error('/data live meter/preset wiring missing');
console.log('P0 wiring markers: PASS');
console.log('ALL v57 STATIC CHECKS PASSED');
