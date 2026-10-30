/* v56 / 6.2.0 static release gate.
 * Verifies the single-file ES5 app, the modular data meter, the service
 * worker, the PWA manifest, the media manifest, the bilingual numeric
 * consistency of the data report and the scrubbed public documents. */
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
  const src = read(rel);
  const file = path.join(dir, label + '.js');
  fs.writeFileSync(file, src);
  cp.execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  acorn.parse(src, { ecmaVersion: 5 });
  return src;
}

/* ---- inline single-file app ------------------------------------------- */
function checkInline(rel, artifact, budget) {
  const html = read(rel);
  if (/<link\b(?![^>]*rel="manifest")/i.test(html)) throw Error(rel + ' contains a static <link> tag');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw Error(rel + ' has no inline application script');
  const script = match[1];
  const file = path.join(dir, artifact);
  fs.writeFileSync(file, script);
  cp.execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  acorn.parse(script, { ecmaVersion: 5 });
  const bytes = Buffer.byteLength(html);
  if (bytes > budget) throw Error(rel + ' exceeds the ' + budget + '-byte budget');
  console.log(rel + ': node --check PASS; ES5 PASS; ' + bytes + ' / ' + budget + ' bytes');
  return html;
}

const INDEX = checkInline('index.html', 'app.js', 600000);
checkInline('data.html', 'data-app.js', 60000);
checkInline('data/index.html', 'data-route-app.js', 60000);

if (read('data.html') !== read('data/index.html')) {
  throw Error('data.html and data/index.html must remain identical');
}

/* ---- modular scripts -------------------------------------------------- */
const studio = parseES5('data/studio.js', 'studio');
if (!/window\.ElevenVault\s*=/.test(studio)) throw Error('data/studio.js must expose window.ElevenVault');
if (!/adminGenerateMissing/.test(studio)) throw Error('data/studio.js must expose the admin-only generator');
console.log('data/studio.js: node --check PASS; ES5 PASS; ' + Buffer.byteLength(studio) + ' bytes');

const meterSrc = parseES5('data/data-meter.js', 'data-meter');
if (!/SDPDataMeter\s*=/.test(meterSrc)) throw Error('data/data-meter.js must expose window.SDPDataMeter');
if (!/SDP_DATA_METER\s*=/.test(meterSrc)) throw Error('data/data-meter.js must expose window.SDP_DATA_METER');
if (!/PerformanceObserver/.test(meterSrc)) throw Error('data/data-meter.js must observe resource timing');
if (!/transferSize/.test(meterSrc)) throw Error('data/data-meter.js must read transferSize');
if (!/getModeProfiles/.test(meterSrc)) throw Error('data/data-meter.js must expose getModeProfiles');
console.log('data/data-meter.js: node --check PASS; ES5 PASS; ' + Buffer.byteLength(meterSrc) + ' bytes');

const sw = parseES5('sw.js', 'sw');
if (!/stale-while-revalidate|caches\.match/i.test(sw)) throw Error('sw.js must implement a cache strategy');
console.log('sw.js: node --check PASS; ES5 PASS; ' + Buffer.byteLength(sw) + ' bytes');

/* ---- PWA manifest + media manifest ------------------------------------ */
const manifest = JSON.parse(read('manifest.webmanifest'));
if (!manifest.name || manifest.display !== 'standalone') throw Error('manifest.webmanifest must be a standalone PWA manifest');
if (manifest.theme_color !== '#040812') throw Error('manifest theme color must be #040812');
if (!/<link[^>]*rel="manifest"/i.test(INDEX)) throw Error('index.html must link the PWA manifest');
console.log('manifest.webmanifest: valid PWA manifest');

const media = JSON.parse(read('data/media-manifest.json'));
if (!Array.isArray(media.assets) || media.assets.length < 3) throw Error('data/media-manifest.json must list the wallpapers');
for (const a of media.assets) {
  if (a.bytes && !(a.bytes > 0)) throw Error('media asset has a bad byte size');
}
console.log('data/media-manifest.json: ' + media.assets.length + ' assets');

/* ---- bilingual numeric consistency (data-en vs data-si) --------------- */
function mbNumbers(s) {
  const out = [];
  let m;
  const re1 = /([0-9]+(?:\.[0-9]+)?)\s*MB/gi;
  while ((m = re1.exec(s))) out.push(parseFloat(m[1]));
  const re2 = /\bMB\s*~?([0-9]+(?:\.[0-9]+)?)(?![A-Za-z])/gi;
  while ((m = re2.exec(s))) out.push(parseFloat(m[1]));
  return out;
}
function checkBilingual(rel) {
  const html = read(rel);
  const re = /<[^>]*\bdata-en="([^"]*)"[^>]*\bdata-si="([^"]*)"[^>]*>/g;
  let m, count = 0;
  while ((m = re.exec(html))) {
    count++;
    const en = mbNumbers(m[1]), si = mbNumbers(m[2]);
    if (en.length && si.length) {
      const a = en.join(','), b = si.join(',');
      if (a !== b) throw Error(rel + ': bilingual MB mismatch data-en["' + m[1] + '"] vs data-si["' + m[2] + '"]');
    }
  }
  return count;
}
const enPairs = checkBilingual('index.html');
const dataPairs = checkBilingual('data.html');
console.log('bilingual data-en/data-si pairs checked: index ' + enPairs + ', data ' + dataPairs);

/* ---- scrubbed public documents ---------------------------------------- */
for (const doc of ['README.md', 'CHANGELOG.md']) {
  if (/78987898/.test(read(doc))) throw Error(doc + ' still leaks the default PIN');
}
if (/sdp\.ghToken/.test(INDEX)) throw Error('index.html must not persist the GitHub token in cleartext localStorage');
if (!/AES-GCM/.test(INDEX)) throw Error('index.html must ship WebCrypto AES-GCM');
if (!/sessionStorage/.test(INDEX)) throw Error('index.html must keep the GitHub token in sessionStorage');
console.log('public documents: PIN scrubbed, no cleartext ghToken, WebCrypto AES-GCM present');

/* ---- version metadata ------------------------------------------------- */
for (const f of ['data/version.json', 'data/config.json', 'data/session.json']) {
  const d = JSON.parse(read(f));
  if (d.ver !== 56) throw Error(f + ' must be ver 56');
  if (d.appVersion !== '6.2.0') throw Error(f + ' must be appVersion 6.2.0');
}
console.log('data documents: ver 56 / appVersion 6.2.0');
console.log('ALL v56 STATIC CHECKS PASSED');
