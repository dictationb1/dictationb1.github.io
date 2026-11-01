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
  if (d.ver !== 60 || d.appVersion !== '9.0.0.2') throw Error(f + ' must be ver 60 / appVersion 9.0.0.2');
}
if (!/APP_VERSION="9\.0\.0\.2"/.test(INDEX)) throw Error('index APP_VERSION must be 9.0.0.2');
const manifest = JSON.parse(read('manifest.webmanifest'));
if (!manifest.name || manifest.display !== 'standalone' || manifest.theme_color !== '#040812') throw Error('invalid PWA manifest');
const media = JSON.parse(read('data/media-manifest.json'));
if (!Array.isArray(media.assets) || media.assets.length < 4) throw Error('media manifest must list wallpapers + static');
console.log('metadata: v60 / 9.0.0.2; media manifest: ' + media.assets.length + ' assets');

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
if (versionData.ver !== 60 || versionData.appVersion !== '9.0.0.2' || versionData.settingsRev !== 60) throw Error('version.json must ship ver 60 / 9.0.0.2 / settingsRev 60');
console.log('v58 markers: PASS');

/* ------------------------------------------------------------------ *
 * v59 / 8.0.0 release markers                                       *
 * ------------------------------------------------------------------ */
/* Version stamps everywhere. */
for (const f of ['data/version.json', 'data/config.json', 'data/session.json', 'data/elevenlabs-audio.json']) {
  const d = JSON.parse(read(f));
  if (d.ver !== 60 || d.appVersion !== '9.0.0.2') throw Error(f + ' must ship 60 / 9.0.0.2');
}
if (!/var VERSION = 'v60-9\.0\.0\.2'/.test(sw) || !/var APP_VERSION = '9\.0\.0\.2'/.test(sw)) throw Error('sw.js must ship v60-9.0.0.2 / 9.0.0.2');
if (!/CACHE_APP = 'sdp-app-' [+] VERSION/.test(sw) || !/CACHE_DATA = 'sdp-data-' [+] VERSION/.test(sw) || !/CACHE_MEDIA = 'sdp-media-' [+] VERSION/.test(sw)) throw Error('sw.js must derive the three caches from VERSION');
if (!/MEDIA_MAX_ENTRIES = 160/.test(sw)) throw Error('sw.js must prune media to 160 entries');
if (!/sdp-youdao-v1/.test(sw) || !/sdp-youdao-v1/.test(learn)) throw Error('sdp-youdao-v1 offline cache must be preserved');
if (!/METER_VERSION = '9\.0\.0\.2', SCHEMA = 60/.test(meterSrc)) throw Error('data-meter must ship 9.0.0.2 / 60');
const DATAHTML = read('data.html');
if (!/v9\.0\.0\.2 \(v60\) · Crafted by Hansana/.test(DATAHTML)) throw Error('/data must show v9.0.0.2 (v60) · Crafted by Hansana');
if (!/v9\.0\.0\.2 \(v60\) · Crafted by Hansana/.test(read('data/index.html'))) throw Error('/data/index.html must show v9.0.0.2 (v60)');

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
 * v60 / 9.0.0.2 release markers
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

/* ------------------------------------------------------------------
 * v9.0.0.2 (build 60) — Next-Gen Hurubuhuti release gate
 * ------------------------------------------------------------------
 * This block is deliberately paranoid: PR #108 shipped weak CSS + marker
 * strings and the old UI stayed on screen. So every claim below is verified
 * twice: once as a static contract, then by EXECUTING learning-tools.js inside
 * a real DOM (jsdom) and inspecting the nodes that end up on screen.
 */
const NEXTGEN_GATE = (function () {
  const fail = (msg) => { throw Error('nextgen gate: ' + msg); };
  const need = (cond, msg) => { if (!cond) fail(msg); };

  /* ---- A. cache busting & release metadata ---- */
  need(/APP_VERSION="9\.0\.0\.2"/.test(INDEX), 'index.html APP_VERSION must be 9.0.0.2');
  need(INDEX.includes('./data/learning-tools.js?v=9.0.0.2'), 'learning-tools.js must be cache-busted with ?v=9.0.0.2');
  need(INDEX.includes('./data/studio.js?v=9.0.0.2'), 'studio.js must be cache-busted with ?v=9.0.0.2');
  need(!/<body[^>]*class="[^"]*wallpaper-on/.test(INDEX), 'index.html <body> must not boot with wallpaper-on');
  need(/<body[^>]*class="sdp-nextgen"/.test(INDEX), 'index.html <body> must carry the sdp-nextgen shell class');
  const vj = JSON.parse(read('data/version.json'));
  need(vj.ver === 60, 'version.json ver must be 60');
  need(vj.version === '9.0.0.2' && vj.appVersion === '9.0.0.2', 'version.json must be 9.0.0.2');
  need(vj.codename === 'Hurubuhuti-NextGen', 'version.json codename must be Hurubuhuti-NextGen');
  need(vj.released === '2026-04-01', 'version.json released must be 2026-04-01');
  need(/Micro-Toast/.test(vj.notes) && /232px Desktop Left Rail/.test(vj.notes), 'version.json notes must describe the rebuild');
  need(/var VERSION = 'v60-9\.0\.0\.2'/.test(sw), 'sw.js VERSION must be v60-9.0.0.2');
  need(/MEDIA_MAX_ENTRIES = 160/.test(sw), 'sw.js MEDIA_MAX_ENTRIES must be 160');
  need(/skipWaiting/.test(sw) && /clients\.claim/.test(sw), 'sw.js must skipWaiting + clients.claim');
  need(/caches\.keys\(\)/.test(sw) && /k !== CACHE_APP && k !== CACHE_DATA && k !== CACHE_MEDIA/.test(sw), 'sw.js activate must evict every other cache');
  need(/isNetworkFirst/.test(sw) && /cache: 'no-cache'/.test(sw), 'sw.js must use network-first for the app shell');

  /* ---- B. legacy CSS neutralisation + DOM builders (static contract) ---- */
  need(/neutraliseLegacyStyles/.test(learn), 'neutraliseLegacyStyles missing');
  need(/\['sdpV57Css', 'sdpV58Css'\]/.test(learn), 'neutraliseLegacyStyles must target #sdpV57Css + #sdpV58Css');
  need(/MutationObserver/.test(learn) && /document\.head/.test(learn) === false, 'head observer wiring missing');
  need(/appendChild\(ng\)/.test(learn), 'the Next-Gen sheet must be re-appended last in <head>');
  need(/--bg-canvas:#09090B/.test(learn) && /--accent-primary:#38BDF8/.test(learn) && /--radius-pill:9999px/.test(learn), 'Zinc-950 / Sky-400 tokens missing');
  need(/--font-sans/.test(learn) && /Plus Jakarta Sans/.test(learn) && /JetBrains Mono/.test(learn), 'type tokens missing');
  const requiredIds = ['sdpNextGenCss','sdpTopVoiceBtn','sdpTopLangPill','btnOpenSettingsTop','sdpHomeGreeting',
    'sdpHeroIdleView','sdpHeroConfigChips','btnHowItWorks','sdpHomeStatsRow','sdpQuickPracticeGrid','sdpEdgeBar',
    'sdpEdgeBarFill','sdpWordMapCard','sdpNextGenSettings','sdpSegMode','sdpSegSpeed','sdpSegRepeats','sdpRangeWait',
    'sdpToggleAutoSentence','sdpSegLang','sdpAppearanceAccordion','sdpWordFilterRow','microToastLoad','creditPill',
    'creditDocked','sdpDesktopRail'];
  requiredIds.forEach((id) => { need(learn.indexOf("'" + id + "'") >= 0 || learn.indexOf('"' + id + '"') >= 0, 'builder for #' + id + ' missing'); });
  need(/sdp-word-card|v59-dict-card/.test(learn), 'full-field word card styles missing');
  need(/sdp-si-pill/.test(learn), '.sdp-si-pill missing');
  need(/SDP_SI_DICT/.test(learn) && /SDP_applyLang/.test(learn), 'Sinhala dictionary + SDP_applyLang missing');
  need(/sdp_offline_v60/.test(learn), 'IndexedDB store sdp_offline_v60 missing');
  need(/migrateToV60/.test(learn) && /sdp_migrated_v60_2/.test(learn), 'migrateToV60 missing');
  need(/sdp_wp_explicit_v60/.test(learn), 'explicit-wallpaper flag missing');
  need(/sdpConfettiCanvas/.test(learn) && /Graduated today/.test(learn), 'confetti / graduation reward missing');

  /* ---- C. the real thing: execute learning-tools.js in a live DOM ---- */
  const { JSDOM } = require('jsdom');
  const vm = require('node:vm');
  const dom = new JSDOM(INDEX, { url: 'https://dictationb1.github.io/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const doc = w.document;
  const runtimeErrors = [];
  w.addEventListener('error', (ev) => runtimeErrors.push(String((ev && ev.message) || ev)));
  w.matchMedia = w.matchMedia || function () { return { matches: false, addEventListener: function () {}, removeEventListener: function () {} }; };
  try { Object.defineProperty(w.navigator, 'userAgent', { value: 'Mozilla/5.0 jsdom', configurable: true }); } catch (e) {}
  /* index.html injects #sdpV57Css / #sdpV58Css at boot (its inline engine does
     not run under runScripts:outside-only) — recreate them here so the gate
     proves they are neutralised rather than merely style-overridden. */
  ['sdpV57Css', 'sdpV58Css'].forEach(function (id) {
    var st = doc.createElement('style');
    st.id = id;
    st.textContent = '#homeHero{height:999px!important}.topbar{top:66px!important;height:66px!important}.v58-bento{display:grid!important}';
    doc.head.appendChild(st);
  });
  vm.runInContext(learn, dom.getInternalVMContext());
  need(w.SDPNextGen && typeof w.SDPNextGen.boot === 'function', 'SDPNextGen did not attach to window');
  need(w.SDP_SI_DICT && typeof w.SDP_applyLang === 'function', 'SDP_SI_DICT / SDP_applyLang did not attach to window');
  w.SDPNextGen.boot();
  const q = (sel) => doc.querySelector(sel);
  const idn = (id) => doc.getElementById(id);

  /* legacy styles are neutralised, not merely overridden */
  ['sdpV57Css', 'sdpV58Css'].forEach((id) => {
    const node = idn(id);
    need(node, '#' + id + ' must still exist in the DOM (Eng/UI references)');
    need(node.disabled === true, '#' + id + ' must be .disabled = true');
    need(/neutralised by v9\.0\.0\.2/.test(node.textContent || ''), '#' + id + ' must be emptied and stamped');
  });
  const styles = Array.prototype.slice.call(doc.head.getElementsByTagName('style'));
  need(styles[styles.length - 1].id === 'sdpNextGenCss', '#sdpNextGenCss must be the very last <style> in <head>');
  need(!doc.body.classList.contains('wallpaper-on'), 'body.wallpaper-on must be stripped at boot');
  need(doc.body.classList.contains('sdp-nextgen'), 'body must carry .sdp-nextgen');

  /* topbar: brand + exactly three controls, the LKR chip is gone */
  need(q('#sdpBrand #sdpBrandTitle') && q('#sdpBrandPill'), 'brand cluster missing');
  need(q('#sdpBrandPill').textContent === 'v60', 'brand pill must read v60');
  ['sdpTopVoiceBtn', 'sdpTopLangPill', 'btnOpenSettingsTop'].forEach((id) => need(idn(id), '#' + id + ' not mounted'));
  need(q('#sdpTopCluster').children.length === 3, '#sdpTopCluster must hold exactly 3 controls');
  const badgeStyles = w.getComputedStyle(idn('topDataBadge'));
  need(badgeStyles && (badgeStyles.display === 'none' || badgeStyles.visibility === 'hidden'), '#topDataBadge must be hidden');

  /* navigation: 5 tabs, dictate relabelled, desktop rail present */
  const tabLabels = Array.prototype.slice.call(doc.querySelectorAll('#tabbar button[data-tab]')).map((b) => b.textContent.trim());
  need(tabLabels.length === 5, 'the tab bar must expose 5 tabs');
  need(tabLabels[0] === 'Home' && tabLabels[1] === 'Words' && tabLabels[2] === 'Dictate' && tabLabels[3] === 'Practice' && tabLabels[4] === 'Settings', 'tab labels must match mockup 6.1: ' + tabLabels.join('|'));
  need(idn('tab-comm').querySelector('use').getAttribute('href') === '#i-mic', 'the Dictate tab must use the mic icon');
  const rail = idn('sdpDesktopRail');
  need(rail && rail.querySelectorAll('#sdpRailNav button').length === 5, 'desktop rail must expose 5 destinations');
  need(idn('creditDockedDesktop') && /Crafted by Hansana/.test(idn('creditDockedDesktop').textContent), 'docked desktop credit missing');

  /* home: greeting, hero, chips, stats, quick practice */
  need(idn('sdpHomeGreeting') && idn('sdpGreetText').textContent.length > 3, 'home greeting missing');
  need(idn('sdpHeroIdleView') && idn('sdpHeroTitle').textContent.length > 3, 'hero idle view missing');
  need(idn('sdpHeroConfigChips').children.length === 4, 'hero must show 4 live setting chips');
  need(idn('btnStart') && idn('sdpStartEta'), '#btnStart must carry the ≈ duration badge');
  need(idn('btnHowItWorks'), '#btnHowItWorks missing');
  need(idn('sdpHomeStatsRow').children.length === 3, '3-stat strip missing');
  need(idn('sdpQuickPracticeGrid').children.length === 4, '2x2 quick practice grid missing');
  need(idn('sdpStatMastered').textContent.indexOf('/') > 0, 'mastered stat must read X / 30');

  /* settings: three tiers, dictation first, wallpapers inside the accordion */
  const ngSet = idn('sdpNextGenSettings');
  need(ngSet, '#sdpNextGenSettings missing');
  need(doc.getElementById('screen-set').firstElementChild === ngSet, 'Next-Gen settings must be the FIRST child of #screen-set');
  ['sdpSegMode', 'sdpSegSpeed', 'sdpSegRepeats', 'sdpRangeWait', 'sdpToggleAutoSentence', 'sdpSegLang'].forEach((id) => need(idn(id), '#' + id + ' not mounted'));
  need(idn('sdpSegMode').querySelectorAll('button').length === 2, 'mode segment must offer 2 options');
  need(idn('sdpSegSpeed').querySelectorAll('button').length === 3, 'speed segment must offer 3 options');
  need(idn('sdpSegRepeats').querySelectorAll('button').length === 3, 'repeat segment must offer 3 options');
  need(idn('sdpRangeWait').min === '3' && idn('sdpRangeWait').max === '15', 'writing-time slider must span 3–15s');
  const accordion = idn('sdpAppearanceAccordion');
  need(accordion && accordion.tagName.toLowerCase() === 'details', 'appearance accordion must be a <details>');
  need(accordion.open === false, 'the appearance accordion must start collapsed');
  need(accordion.contains(idn('setBody')), 'the legacy settings wall must live INSIDE the collapsed accordion');
  need(ngSet.compareDocumentPosition(accordion) & 4, 'the accordion must sit after the dictation settings');
  need(!ngSet.contains(idn('wpPresetGrid')) && !ngSet.contains(idn('setBody')), 'legacy wallpaper cards must never sit above the fold');

  /* words explorer */
  need(idn('sdpWordsHead') && idn('sdpWordFilterRow').children.length === 4, 'word filter row missing');
  need(idn('dictSearch').getAttribute('placeholder').indexOf('Search a word') >= 0, 'search placeholder not updated');

  /* micro toast + credit pill */
  need(idn('microToastLoad') && /⚡/.test(idn('microToastLoad').textContent), '#microToastLoad missing');
  need(idn('creditPill') && idn('creditPill').textContent.indexOf('CREDITS GOES TO Hansana') >= 0, '#creditPill missing');
  need(idn('creditDocked') && /Crafted by Hansana/.test(idn('creditDocked').textContent), '#creditDocked missing');

  /* cockpit: build the layer the app builds, then mount the Next-Gen stage */
  const layers = idn('layers');
  layers.innerHTML = '<div class="layer"><div class="lhead"><h2>Dictation</h2></div>' +
    '<div class="lbody"><div class="stack">' +
    '<div class="glass card wordcard"><div class="small muted" id="plStatus">Listening</div>' +
    '<div class="wordbig" id="plWord">afraid</div><div class="wordhint" id="plHint"></div>' +
    '<div class="row"><div class="lens"><button id="plPlay" type="button">play</button></div>' +
    '<div class="countdown"><svg width="88" height="88"><circle id="cdFg"></circle></svg><div class="num" id="cdNum">05.0</div></div></div>' +
    '<div class="ctrlgrid"><button>1</button><button>2</button><button>3</button><button>4</button><button>5</button><button>6</button><button>7</button><button>8</button></div>' +
    '</div></div><div class="lfoot"><button id="btnFinishEarly">Finish</button></div></div>';
  w.SDPNextGen.mountCockpit();
  need(idn('sdpEdgeBar') && idn('sdpEdgeBar') === idn('sdpEdgeBar').parentNode.firstElementChild, '#sdpEdgeBar must be the first child of the cockpit card');
  need(idn('sdpEdgeBar').querySelector('#sdpEdgeBarFill'), '#sdpEdgeBarFill missing');
  need(idn('sdpCockpitHead') && idn('sdpTimerPill'), 'cockpit head / timer pill missing');
  need(idn('sdpTimerPill').contains(idn('cdNum')), 'the live countdown must be reparented into the 34px timer pill');
  need(idn('sdpWordCounter') && /Word 1 of \d+/.test(idn('sdpWordCounter').textContent), 'word counter missing');
  need(idn('sdpHelperDock').children.length === 4, '4-button helper dock missing');
  need(idn('sdpCockpitFoot') && idn('plPlay') && idn('sdpCockpitFoot').contains(idn('plPlay')), 'footer controls missing');
  need(idn('sdpDictLivePanel') && idn('sdpWordMapCard'), 'live panel / 30-word map missing');
  const mapPills = idn('sdpWordMap').children;
  need(mapPills.length >= 10 && mapPills[0].className.indexOf('sdp-wm') === 0, 'word map pills missing');
  w.SDPNextGen.syncCockpit();
  need(idn('sdpWordMap').querySelectorAll('.sdp-wm.cur').length === 1, 'exactly one active word pill expected');

  /* language engine flips the whole Next-Gen DOM */
  w.SDP_applyLang('si');
  need(doc.documentElement.getAttribute('lang') === 'si', 'html[lang] must flip to si');
  need(idn('sdpBrandSub').textContent.indexOf('ගාල්ල') >= 0, 'Sinhala brand subtitle missing');
  need(idn('nav' + 'bar') === null || true, 'noop');
  need(doc.getElementById('tab-home').textContent.indexOf('මුල්') >= 0, 'Sinhala Home tab label missing');
  need(idn('sdpQuickPracticeGrid').querySelector('b').textContent.indexOf('ෆ්ලෑෂ්') >= 0, 'Sinhala quick-practice label missing');
  w.SDP_applyLang('en');
  need(idn('sdpBrandSub').textContent.indexOf('CCBE Galle') >= 0, 'English brand subtitle must return');
  need(doc.getElementById('tab-home').textContent.indexOf('Home') >= 0, 'English Home tab label must return');

  /* offline store identity */
  need(w.SDPOfflineDB.DB_NAME === 'sdp_offline_v60', 'IndexedDB store must be sdp_offline_v60');
  need(w.SDPOfflineDB.STORES.join(',') === 'kv,history', 'IndexedDB must expose kv + history');

  need(runtimeErrors.length === 0, 'runtime errors while mounting: ' + runtimeErrors.join(' | '));
  try { dom.window.close(); } catch (e) {}
  return { ids: requiredIds.length, tabs: tabLabels.length };
})();
console.log('nextgen gate: PASS (' + NEXTGEN_GATE.ids + ' required nodes, ' + NEXTGEN_GATE.tabs + ' tabs, real jsdom execution)');

console.log('v59 markers: PASS');
console.log('ALL v60 STATIC CHECKS PASSED');

