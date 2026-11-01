/* v59 / 8.0.0 static release gate: ES5, size, secrets, metadata and wiring. */
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
checkInline('data.html', 'data-app', 65000);
checkInline('data/index.html', 'data-route-app', 65000);
if (read('data.html') !== read('data/index.html')) throw Error('data.html and data/index.html must remain identical');
const studio = parseES5('data/studio.js', 'studio');
const meterSrc = parseES5('data/data-meter.js', 'data-meter');
const sw = parseES5('sw.js', 'sw');
const learn = parseES5('data/learning-tools.js', 'learning-tools');
/* v59: learning-tools is strict-ES5, wired and precached. */
if (!/\.SDPLearning\s*=/.test(learn)) throw Error('learning-tools must expose window.SDPLearning');
if (!/visualViewport/.test(learn)) throw Error('visualViewport docking missing from learning-tools');
if (!/levenshteinOps/.test(learn) || !/markMissed/.test(learn) || !/markCorrect/.test(learn)) throw Error('learning-tools APIs missing');
if (!/\.\/data\/learning-tools\.js/.test(sw)) throw Error('learning-tools missing from sw.js SHELL');
if (!/\.\/assets\/fonts\/NotoSansSinhala-Regular\.woff2/.test(sw) || !/\.\/assets\/fonts\/NotoSansSinhala-Bold\.woff2/.test(sw)) throw Error('Sinhala fonts missing from sw.js SHELL');
for (const f of ['assets/fonts/NotoSansSinhala-Regular.woff2', 'assets/fonts/NotoSansSinhala-Bold.woff2']) {
  const b = fs.readFileSync(path.join(ROOT, f));
  if (b.length > 60000) throw Error(f + ' exceeds 60KB');
  if (b.slice(0, 4).toString('utf8') !== 'wOF2') throw Error(f + ' is not a WOFF2 file');
}
if (!/window\.ElevenVault\s*=/.test(studio)) throw Error('studio must expose ElevenVault');
if (!/adminGenerateMissing/.test(studio)) throw Error('studio generator missing');
if (!/SDPDataMeter\s*=/.test(meterSrc) || !/SDP_DATA_METER\s*=/.test(meterSrc)) throw Error('meter aliases missing');
if (!/PerformanceObserver/.test(meterSrc) || !/transferSize/.test(meterSrc) || !/getModeProfiles/.test(meterSrc)) throw Error('meter timing/profile wiring missing');
if (!/caches\.match/.test(sw)) throw Error('service worker cache strategy missing');

/* Secret/PIN gate: every shipped file, every test, and the rest of the repo. */
const SCAN_FILES = [
  'README.md', 'CHANGELOG.md', 'index.html', 'data.html', 'data/index.html',
  'data/studio.js', 'data/data-meter.js', 'data/learning-tools.js', 'sw.js',
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
  if (d.ver !== 60 || d.appVersion !== '9.0.0.3') throw Error(f + ' must be ver 60 / appVersion 9.0.0.3');
}
if (!/APP_VERSION="9\.0\.0.3"/.test(INDEX)) throw Error('index APP_VERSION must be 9.0.0.3');
const manifest = JSON.parse(read('manifest.webmanifest'));
if (!manifest.name || manifest.display !== 'standalone' || manifest.theme_color !== '#040812') throw Error('invalid PWA manifest');
const media = JSON.parse(read('data/media-manifest.json'));
if (!Array.isArray(media.assets) || media.assets.length < 4) throw Error('media manifest must list wallpapers + static');
console.log('metadata: v60 / 9.0.0.3; media manifest: ' + media.assets.length + ' assets');

/* P0 runtime wiring markers. */
if (!/sdp\.v2:/.test(INDEX) || !/isUnlockedOnThisDevice/.test(INDEX)) throw Error('local salted PIN wiring missing');
if (!/fetchOnce:function/.test(studio.replace(/\s/g, '')) || !/strictAdminOnly/.test(studio)) throw Error('paid fetch guard missing');
if (/ntfy\.sh\/dictationb1_sdp_(keys|words|audio)/.test(studio)) throw Error('studio still contains a vault/audio relay');
if (!/persistedSession/.test(meterSrc) || !/videoBufferedBytes/.test(meterSrc) || !/content-length/.test(meterSrc)) throw Error('meter truth fixes missing');
if (!/data\/data-meter\.js/.test(read('data.html')) || !/liveSessionMB/.test(read('data.html')) || !/dataPlanPreset/.test(read('data.html'))) throw Error('/data live meter/preset wiring missing');
console.log('P0 wiring markers: PASS');
/* v59 markers: two-tier glass, fonts, dock, learning tools and signature pill. */
if (!/sdpV58Css/.test(INDEX)) throw Error('sdpV58Css runtime style missing');
if (!/Noto Sans Sinhala/.test(INDEX)) throw Error('Noto Sans Sinhala @font-face missing');
if (!/v58-glass-blur/.test(INDEX) || !/v58-core/.test(INDEX)) throw Error('two-tier glass variables missing');
if (!/v58Dock|v58-keyboard/.test(learn)) throw Error('keyboard dock wiring missing');
if (!/aboutCreditsSheet/.test(INDEX) || !/v58-sig-pill/.test(INDEX)) throw Error('signature pill / about sheet missing');
if (!/v58WorkSpace|v58-workspace/.test(INDEX)) throw Error('desktop workspace missing');
if (!/learning-tools\.js/.test(INDEX)) throw Error('learning-tools script tag missing');
const versionData = JSON.parse(read('data/version.json'));
if (versionData.ver !== 60 || versionData.appVersion !== '9.0.0.3' || versionData.settingsRev !== 60) throw Error('version.json must ship ver 60 / 9.0.0.3 / settingsRev 60');
console.log('v58 markers: PASS');

/* ------------------------------------------------------------------ *
 * v59 / 8.0.0 release markers                                       *
 * ------------------------------------------------------------------ */
/* Version stamps everywhere. */
for (const f of ['data/version.json', 'data/config.json', 'data/session.json', 'data/elevenlabs-audio.json']) {
  const d = JSON.parse(read(f));
  if (d.ver !== 60 || d.appVersion !== '9.0.0.3') throw Error(f + ' must ship 60 / 9.0.0.3');
}
if (!/var VERSION = 'sdp-v60-9\.0\.0\.3'/.test(sw) || !/var APP_VERSION = '9\.0\.0.3'/.test(sw)) throw Error('sw.js must ship sdp-v60 / 9.0.0.3');
if (!/sdp-youdao-v1/.test(sw) || !/sdp-youdao-v1/.test(learn)) throw Error('sdp-youdao-v1 offline cache must be preserved');
if (!/METER_VERSION = '9\.0\.0.3', SCHEMA = 60/.test(meterSrc)) throw Error('data-meter must ship 9.0.0.3 / 60');
const DATAHTML = read('data.html');
if (!/v60 · APP_VERSION 9\.0\.0.3/.test(DATAHTML)) throw Error('/data must show v60 · APP_VERSION 9.0.0.3');
if (!/v60 · APP_VERSION 9\.0\.0.3/.test(read('data/index.html'))) throw Error('/data/index.html must show v60');

/* A1: fresh installs pick the automatic performance mode, never a forced "full". */
if (!/perf:"auto"/.test(INDEX)) throw Error('fresh settings must default to perf:"auto"');
if (!/perfChosenBy="user"/.test(INDEX)) throw Error('a manual perf click must record perfChosenBy="user"');
if (/perf:"full"/.test(INDEX)) throw Error('index.html must not default to perf:"full"');
/* D5: the lecturer writing timer is honoured. */
var wsBody = /Eng\.writeSecs=function\(\)\{([^}]*)\}/.exec(INDEX);
if (!wsBody || wsBody[1].indexOf('writeFixed') < 0 || !/Math\.max\(3,\s*Math\.min\(60/.test(wsBody[1])) throw Error('Eng.writeSecs must honour settings.writeFixed');
if (!/writeFixed/.test(INDEX)) throw Error('writeFixed wiring missing');
/* D1: paper mode maps every word into a self-check row. */
if (!/rows:t\.map\(function\(w\)\{return\{word:/.test(INDEX)) throw Error('paper mode must emit one row per word');
if (!/mode:"paper"/.test(INDEX)) throw Error('paper mode result stamp missing');

/* C1/C2: every data-v58-en attribute is pure English. */
const enAttrs = Array.from(INDEX.matchAll(/data-v58-en="([^"]*)"/g)).map(m => m[1]);
if (enAttrs.length < 8) throw Error('expected the v58 English attribute set, found ' + enAttrs.length);
for (const v of enAttrs) {
  if (/[\u0D80-\u0DFF]/.test(v)) throw Error('data-v58-en must be pure English: ' + v);
}
if (!/guide:"User Guide"/.test(INDEX)) throw Error('STRINGS_EN.guide must be pure English');

/* 3A: the v59 design system lives in learning-tools so index.html adds 0 CSS bytes. */
if (!/sdpV59Css/.test(learn)) throw Error('learning-tools must inject #sdpV59Css');
if (!/--fs-meta:14px/.test(learn) || !/--v59-card/.test(learn)) throw Error('v59 design tokens missing');
if (!/CRUSH_MQ|max-width\s*:\s*560px/.test(learn)) throw Error('v57/v58 hero-crush runtime cleanup missing');
if (!/backdrop-filter:none!important/.test(learn)) throw Error('v59 must neutralise chip/tile/button blur');
if (!/passive: ?true/.test(learn)) throw Error('learning-tools must register passive listeners');
if (!/v58-tile-t i/.test(learn)) throw Error('practice tile subtitles missing');

/* 3B: one unified language engine. */
if (!/applyLang/.test(learn) || !/syncI18n/.test(learn)) throw Error('unified UI.applyLang engine missing');
if (!/puritySweep/.test(learn)) throw Error('English purity sweep missing');

/* 3C: the full-English dictionary card. */
if (!/v59-dict-card/.test(learn) || !/v59-ipa/.test(learn) || !/v59-pos/.test(learn)) throw Error('dictionary card renderer missing');
if (!/v59-si-chip/.test(learn)) throw Error('collapsed Sinhala reveal chip missing');
if (!/v59DictFilters/.test(learn)) throw Error('dictionary filter tabs missing');

/* 3D: every broken tool is fixed. */
if (!/v58SelfScore/.test(learn) || !/self-check: /.test(learn)) throw Error('paper self-check live score/summary missing');
if (!/resSummary/.test(learn)) throw Error('#resSummary live update missing');
if (!/English Meaning/.test(learn) || !/Sinhala Meaning/.test(learn)) throw Error('print sheet must carry all six columns');
if (!/v58ContextNextBtn/.test(learn)) throw Error('Sentence Context Next question button missing');
if (!/audio\/mp4/.test(learn)) throw Error('MediaRecorder MIME selection missing');
if (!/Play my recording/.test(learn)) throw Error('explicit playback button for the student recording missing');
if (!/offlineReadyCount = saved/.test(learn)) throw Error('offline pack must only count real cache writes');

/* 3E: zero canvas readback, zero idle rAF. */
if (/\.drawImage\s*\(|\.getImageData\s*\(/.test(learn)) throw Error('learning-tools must never call drawImage/getImageData');
if (/_gaugeCanvas/.test(learn)) throw Error('the readback canvas must be gone');
if (/setInterval\(function[\s\S]{0,400}?\}\s*,\s*(400|1000|1500)\s*\)/.test(learn)) throw Error('learning-tools must not run background intervals');
if (!/clearInterval/.test(learn)) throw Error('the syllable spotlight timer must be cleared');
if (!/SDPPerfGuard/.test(learn) || !/benchmark: function/.test(learn) || !/decide: function/.test(learn)) throw Error('SDPPerfGuard API missing');
if (!/60 FPS Smooth Mode auto-enabled/.test(learn)) throw Error('PerfGuard toast missing');
if (/\.createMediaElementSource\s*\(/.test(learn)) throw Error('learning-tools must never create a MediaElementSource');
if (/\.createMediaElementSource\s*\(/.test(INDEX)) throw Error('index.html must never create a MediaElementSource on the Youdao audio');

/* ------------------------------------------------------------------
 * v60 / 9.0.0.3 release markers
 * ------------------------------------------------------------------ */
if (!/#sdpNextGenCss/.test(learn)) throw Error('learning-tools must inject #sdpNextGenCss');
var _mt = learn.indexOf("microToastLoad") >= 0 && learn.indexOf("getEntriesByType") >= 0 && learn.indexOf("\"navigation\"") >= 0;
if (learn.indexOf("microToastLoad") < 0) throw Error('microToastLoad missing');
if (learn.indexOf('getEntriesByType("navigation")') < 0) throw Error('navigation transferSize missing');
if (!/creditPill/.test(learn) || !/v60-credit-live/.test(learn) || !/v60-credit-dock/.test(learn)) throw Error('creditPill must toggle v60-credit-live / v60-credit-dock');
if (!/guide-si-1\.mp3/.test(sw)) throw Error('sw.js must precache guide-si-1.mp3');
if (!/eleven_flash_v2_5/.test(studio) || !/eleven_flash_v2_5/.test(read('data/elevenlabs-audio.json'))) throw Error('eleven_flash_v2_5 must be the default model');
if (!/iterations: ?250000/.test(INDEX)) throw Error('index.html must ship PBKDF2 iterations: 250000 (SDP_ENC_V2)');
if (!/encVault/.test(read('data/config.json')) || !/SDP_ENC_V2:/.test(read('data/config.json'))) throw Error('config.json must carry encVault: SDP_ENC_V2:...');
console.log('v60 markers: PASS');
console.log('v59 markers: PASS');
/* ------------------------------------------------------------------
 * v60 Next-Gen DOM wiring (JSDOM, no browser)
 * ------------------------------------------------------------------ */
{
  const { harness } = require('./app-harness.cjs');
  const app = harness(null, {});
  try {
    app.w.eval(learn);
    app.clock.tick(2500);
    const doc = app.w.document;
    const C = app.w.SDPCore;
    for (const id of ['sdpHomeGreeting', 'sdpHeroConfigChips', 'sdpHomeStatsRow', 'sdpQuickPracticeGrid', 'microToastLoad', 'creditPill', 'creditDocked', 'sdpDesktopRail']) {
      if (!doc.getElementById(id)) throw Error('v60 home chrome missing #' + id);
    }
    C.Screens.dict();
    app.clock.tick(80);
    if (!doc.getElementById('sdpWordFilterRow')) throw Error('v60 #sdpWordFilterRow missing after Screens.dict()');
    if (!doc.querySelectorAll('#dictList .sdp-word-card.v59-dict-card').length) throw Error('v60 dictionary cards missing');
    C.Screens.settings();
    app.clock.tick(80);
    const box = doc.getElementById('sdpNextGenSettings');
    const body = doc.getElementById('setBody');
    const acc = doc.getElementById('sdpAppearanceAccordion');
    if (!box) throw Error('v60 #sdpNextGenSettings missing');
    if (doc.getElementById('screen-set').firstElementChild !== box) throw Error('v60 settings must be the first child of #screen-set');
    if (!body || !body.closest('details#sdpAppearanceAccordion')) throw Error('#setBody must be inside details#sdpAppearanceAccordion');
    if (!acc || acc.open !== false) throw Error('the appearance accordion must start collapsed');
    for (const id of ['sdpSegMode', 'sdpSegSpeed', 'sdpSegRepeats', 'sdpRangeWait', 'sdpToggleAutoSentence', 'sdpSegLang', 'rateRange', 'volRange', 'repeatsSelect', 'readSentenceToggle', 'writeSecsRange', 'bitrateSelect']) {
      if (!doc.getElementById(id)) throw Error('v60 settings control missing #' + id);
    }
    const v57 = doc.getElementById('sdpV57Css'), v58 = doc.getElementById('sdpV58Css'), ng = doc.getElementById('sdpNextGenCss');
    if (!v57 || !v57.disabled || v57.textContent !== '/* v60 neutralised */') throw Error('#sdpV57Css must be neutralised');
    if (!v58 || !v58.disabled) throw Error('#sdpV58Css must be neutralised');
    if (!ng || doc.head.lastElementChild !== ng) throw Error('#sdpNextGenCss must be the last style in <head>');
    console.log('v60 next-gen DOM: PASS');
  } finally { app.close(); }
}

console.log('ALL v60 STATIC CHECKS PASSED');

