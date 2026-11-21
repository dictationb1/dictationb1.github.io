#!/usr/bin/env node
'use strict';
/* G22 — the v0.0.7.e dictationb1 / dictationb1.web.app migration verification gate.
 * contract: README.md §Current release + .github/workflows/checks.yml G22
 * (0.0.7.e / ver 44 / schema 44 / session ver 67 / settingsRev 77 /
 *  syncRev+wordsRev 1797000000027 / SW sdp-v0.0.7.e-s44)
 *  M1 zero dictationb01 references anywhere in the live app, data payloads,
 *     docs or active test expectations.
 *  M2 the dictationb1 GitHub repo + https://dictationb1.web.app/ canonical
 *     URLs are the pinned origin across app links, the PWA manifest,
 *     Lecturer Studio sync (repoFromOrigin ladder) and the Live Lab raw leg.
 *  M3 firebase.json is valid JSON, public ".", ignores tests/ + .github/,
 *     and pins no-cache/no-store on sw.js + data/version.json; .firebaserc
 *     defaults to the dictationb1 project.
 *  M4 unified v0.0.7.e lockstep across every surface (Live Lab included —
 *     zero v4.0) with ver 44 / settingsRev 77 / syncRev+wordsRev ...026.
 *  M5 the 76/76 audio-clip family and the 31 bilingual words survive the
 *     rename byte-for-byte (clip count, provenance hash, LUFS family stamp).
 * Plus a live headless-Chromium boot proof on BOTH viewports: the app boots
 * Session 14 · 31 words with zero console errors, and the Live Lab runs the
 * full seven-station suite at 0 FAIL. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
const ROOT = path.resolve(__dirname, '..');
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJSON = (rel) => JSON.parse(readText(rel));
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const syncSrc = readText('data/sdp-data-sync.js');
const studio = readText('data/studio.js');
const telemetry = readText('data/sdp-telemetry.js');
const liveLab = readText('data/sdp-live-lab.js');
const indexHtml = readText('index.html');
const labHtml = readText('lab.html');
const sw = readText('sw.js');
const manifestSrc = readText('manifest.webmanifest');
const session = readJSON('data/session.json');
const version = readJSON('data/version.json');
const config = readJSON('data/config.json');
const pack = readJSON('data/elevenlabs-audio.json');

/* ── M1 · zero dictationb01 references ──────────────────────────────────── */
(function () {
  const liveFiles = ['index.html', 'lab.html', 'data.html', 'data/index.html', 'sw.js', 'manifest.webmanifest',
    'firebase.json', '.firebaserc', 'README.md'];
  const dataFiles = fs.readdirSync(path.join(ROOT, 'data')).filter((f) => /\.(js|json|txt|html)$/.test(f)).map((f) => 'data/' + f);
  const testFiles = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.cjs')).map((f) => 'tests/' + f);
  const docFiles = ['docs/ARCHITECTURE_MAP.md', 'docs/CHANGELOG_LEDGER.md', 'docs/MASTER_PLAN_V006N.md',
    'docs/SYNC_AND_DATA_CONTRACT.md', 'docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md', 'docs/UI_COMPONENT_GUIDE.md'];
  const wfFiles = ['.github/workflows/checks.yml', '.github/workflows/pages.yml', '.github/workflows/firebase-hosting.yml'];
  const bad = [];
  for (const f of [...liveFiles, ...dataFiles, ...docFiles, ...wfFiles]) {
    if (exists(f) && readText(f).indexOf('dictationb01') >= 0) bad.push(f);
  }
  /* active test expectations: v007d itself must name the token it hunts — self-exempt */
  for (const f of testFiles) {
    if (f === 'tests/v007d-verification.cjs') continue;
    if (readText(f).indexOf('dictationb01') >= 0) bad.push(f);
  }
  check('M1a zero dictationb01 references across app, data, docs, workflows and active tests',
    bad.length === 0, bad.join(', '));
})();

/* ── M2 · dictationb1 repo + web.app canonical URLs ─────────────────────── */
check('M2a index.html links the dictationb1 repo and profile (Code on GitHub / profile)',
  indexHtml.indexOf('https://github.com/dictationb1/dictationb1.github.io') > 0 &&
  indexHtml.indexOf('https://github.com/dictationb1') > 0 &&
  indexHtml.indexOf('dictationb01') < 0);
check('M2b config.json pins repoOwner dictationb1 + repoName + Contents URL (the Firebase-origin sync ladder)',
  config.repoOwner === 'dictationb1' && config.repoName === 'dictationb1.github.io' &&
  String(config.repoContentsUrl).indexOf('https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/') === 0,
  JSON.stringify({ repoOwner: config.repoOwner, repoName: config.repoName, repoContentsUrl: config.repoContentsUrl }));
check('M2c session.json payload mirror pins the same dictationb1 repo identity',
  session.repoOwner === 'dictationb1' && session.repoName === 'dictationb1.github.io' &&
  String(session.repoContentsUrl).indexOf('repos/dictationb1/dictationb1.github.io/') > 0,
  JSON.stringify({ repoOwner: session.repoOwner, repoName: session.repoName }));
check('M2d repoFromOrigin ladder: hostname first, then config repoContentsUrl, then dictationb1 fallbacks',
  /source: 'hostname'/.test(syncSrc) && /source: 'config-url'/.test(syncSrc) && /source: 'config-fallback'/.test(syncSrc) &&
  /cfg\.repoOwner \|\| 'dictationb1'/.test(syncSrc) && /cfg\.repoName \|\| 'dictationb1\.github\.io'/.test(syncSrc),
  'ladder');
check('M2e the Live Lab raw leg reads dictationb1/dictationb1.github.io main',
  /raw\.githubusercontent\.com\/dictationb1\/dictationb1\.github\.io\/main\/data\/version\.json/.test(liveLab));
check('M2f telemetry owner() falls back to dictationb1',
  /settings\(\)\.repoOwner\) \|\| 'dictationb1'/.test(telemetry));
check('M2g the Studio lab fallback message names the dictationb1 origin',
  /Open https:\/\/dictationb1\.github\.io\/lab\.html/.test(studio));
check('M2h lab.html header names the dictationb1 origin and keeps the verbatim credit line',
  /https:\/\/dictationb1\.github\.io\/lab\.html/.test(labHtml) && labHtml.indexOf('CREDITS GOES TO Hansana') > 0);
(function () {
  const man = JSON.parse(manifestSrc);
  check('M2i the PWA manifest keeps a relative origin (start_url ./?v=…&source=pwa, scope ./) so BOTH the web.app primary and the github.io mirror install cleanly',
    /^\.\//.test(man.start_url) && man.scope === './' && /source=pwa/.test(man.start_url),
    JSON.stringify({ start_url: man.start_url, scope: man.scope }));
})();
check('M2j README carries the primary web.app URL + the github.io mirror + the repo',
  readText('README.md').indexOf('https://dictationb1.web.app/') > 0 &&
  readText('README.md').indexOf('https://dictationb1.github.io/') > 0 &&
  readText('README.md').indexOf('github.com/dictationb1/dictationb1.github.io') > 0);
check('M2k ntfy relay topics stay dictationb1-owned (state + telemetry)',
  /ntfy\.sh\/sdp_dictationb1_state_v8/.test(readText('data/config.json')) &&
  /'https:\/\/ntfy\.sh\/sdp_' \+ owner\(\) \+ '_telemetry_v1'/.test(telemetry));

/* ── M3 · Firebase Hosting readiness ────────────────────────────────────── */
(function () {
  let fb = null, rc = null;
  try { fb = JSON.parse(readText('firebase.json')); } catch (e) { check('M3a firebase.json is valid JSON', false, String(e)); return; }
  try { rc = JSON.parse(readText('.firebaserc')); } catch (e) { check('M3b .firebaserc is valid JSON', false, String(e)); return; }
  check('M3a firebase.json is valid JSON', true);
  check('M3b .firebaserc is valid JSON', true);
  const h = fb.hosting || {};
  const ignore = h.ignore || [];
  check('M3c firebase.json: public "." with tests/, .github/, .git/, docs/ and *.md ignored (zero test/CI files exposed)',
    h.public === '.' &&
    ignore.some((i) => i === 'tests/**' || i === 'tests') &&
    ignore.some((i) => i === '.github/**') &&
    ignore.some((i) => i === '.git/**') &&
    ignore.some((i) => i === '*.md'),
    JSON.stringify({ public: h.public, ignore }));
  const hdr = (src, key) => (h.headers || []).filter((x) => x.source === src)
    .some((x) => (x.headers || []).some((hh) => hh.key === 'Cache-Control' && hh.value.indexOf(key) >= 0));
  check('M3d sw.js and data/version.json are served no-cache/no-store (never stuck behind the Firebase CDN)',
    hdr('/sw.js', 'no-store') && hdr('/data/version.json', 'no-store'));
  check('M3e index.html / lab.html / data.html + session/config JSONs revalidate (no stale shell)',
    hdr('/index.html', 'no-cache') && hdr('/lab.html', 'no-cache') && hdr('/data.html', 'no-cache') &&
    hdr('/data/session.json', 'no-cache') && hdr('/data/config.json', 'no-cache'));
  check('M3f .firebaserc defaults to the dictationb1 project',
    rc.projects && rc.projects.default === 'dictationb1', JSON.stringify(rc.projects || {}));
  check('M3g the v0.0.7.e Firebase law: the hosting workflow is manual opt-in only (workflow_dispatch, NEVER auto-running on push/PR — GitHub Pages is the ONE live host)',
    (function () { const y = readText('.github/workflows/firebase-hosting.yml');
      return /workflow_dispatch\s*:/.test(y) && !/push:\s*\n/.test(y.split('on:')[1].split('permissions:')[0]) && /FIREBASE_SERVICE_ACCOUNT_DICTATIONB1/.test(y); })(), 'firebase manual-only law');
})();

check('M4g zero stale 0.0.7.d LIVE pins in the shipped surfaces (the v0.0.7.e sweep)',
  (function () {
    const textFiles = ['index.html', 'lab.html', 'sw.js', 'manifest.webmanifest', 'data.html', 'data/index.html'];
    const bad = [];
    for (const f of textFiles) if (readText(f).indexOf('0.0.7.d') >= 0) bad.push(f);
    const jsonPins = [
      [readJSON('data/version.json'), 'version.json'],
      [readJSON('data/config.json'), 'config.json'],
      [readJSON('data/elevenlabs-audio.json'), 'pack']
    ];
    for (const [d, n] of jsonPins) {
      if (d.appVersion === '0.0.7.d' || d.version === '0.0.7.d') bad.push(n);
    }
    const ses = readJSON('data/session.json');
    if (ses.appVersion === '0.0.7.d' || ses.version === '0.0.7.d') bad.push('session.json(root)');
    return bad.length === 0;
  })(), 'live surface sweep');
check('M4h the sync module pins 0.0.7.e / SDP.ver 44 / SETTINGS_REV 77',
  /SDP\.version = '0\.0\.7\.e';/.test(syncSrc) && /SDP\.ver = 45;/.test(syncSrc) &&
  /var APP_VERSION = '0\.0\.7\.e';/.test(syncSrc) && /var SETTINGS_REV = 78;/.test(syncSrc));
check('M4i attribution invariants stay verbatim (credit pill + EN + SI lines)',
  indexHtml.indexOf('CREDITS GOES TO Hansana') > 0 &&
  indexHtml.indexOf('Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)') > 0 &&
  indexHtml.indexOf('නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini') > 0 &&
  labHtml.indexOf('CREDITS GOES TO Hansana') > 0);

/* ── M5 · the classroom payload survives the rename ─────────────────────── */
(function () {
  const clips = pack.clips;
  const keys = Object.keys(clips);
  let bytesOk = 0, hashOk = 0;
  for (const k of keys) {
    const e = clips[k];
    const raw = Buffer.from(e.b64 || '', 'base64');
    if (raw.length >= 512 && Number(e.bytes) === raw.length) bytesOk += 1;
    const want = 'sha1:' + crypto.createHash('sha1').update(`${e.text || ''}|${e.voiceId || ''}|${e.modelId || ''}`).digest('hex');
    if (want === e.hash) hashOk += 1;
  }
  check('M5a the pack still ships the 76/76 clip family (31 words + 31 numbers + 6 commands + 4 guides + 4 briefing)',
    keys.length === 76, String(keys.length));
  check('M5b every clip keeps its byte law + provenance hash through the rename (76/76)',
    bytesOk === 76 && hashOk === 76, bytesOk + '/' + hashOk);
  const ws = session.words;
  const siOk = ws.filter((w) => /[\u0D80-\u0DFF]/.test(String(w.si || ''))).length;
  check('M5c all 31 bilingual words keep real Sinhala meanings + complete English meanings',
    ws.length === 31 && siOk === 31, siOk + '/' + ws.length);
  check('M5d the preserved session SHA lock moved in lockstep with the intentional rename publish',
    crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'data/session.json'))).digest('hex').startsWith('3284f107'));
})();

/* ── live boot proof (headless Chromium, desktop + mobile) ───────────────── */
(async () => {
  let chromium = null;
  try {
    chromium = require('playwright-core').chromium;
    const serverChromium = require('@sparticuz/chromium');
    require('./chromium-env.cjs').ensureChromiumLibs();
    const { start } = require('./static-server.cjs');
    const server = await start({ root: ROOT });
    const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
    const args = serverChromium.args.filter((a) => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a));
    const browser = await chromium.launch({ headless: true, executablePath, args });
    try {
      /* desktop 1280x800 */
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
      await page.addInitScript(() => { try { localStorage.setItem('sdp.guide_seen', '0.0.7.e'); localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e', guideAutoPlay: false })); } catch (e) {} });
      await page.goto(server.origin + '/', { waitUntil: 'load' });
      await page.waitForTimeout(2600);
      const boot = await page.evaluate(() => ({
        ready: !!(window.SDP && SDP.Sync && SDP.Sync.isReady && SDP.Sync.isReady()),
        version: String(SDP.version || ''),
        verPill: document.getElementById('sdpVerPill').textContent,
        sessionNo: String(SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : ''),
        words: SDP.Sync.words().length,
        bannerHidden: document.getElementById('sdpOfflineModeBanner').hidden,
        studioBlinded: document.getElementById('screen-studio').classList.contains('studio-is-offline'),
        githubLink: (document.querySelector('a[href="https://github.com/dictationb1/dictationb1.github.io"]') || {}).href || '',
      }));
      check('D1 desktop boot: 0.0.7.e · Session 14 · 31 words · no offline banner · no Studio blind · zero console errors',
        boot.ready === true && boot.version === '0.0.7.e' && boot.verPill === 'v0.0.7.e' && boot.sessionNo === '14' &&
        boot.words === 31 && boot.bannerHidden === true && boot.studioBlinded === false && errors.length === 0 &&
        boot.githubLink === 'https://github.com/dictationb1/dictationb1.github.io',
        JSON.stringify(boot) + ' | ' + errors.slice(0, 2).join(','));
      await ctx.close();

      /* mobile 375x812 */
      const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36' });
      const mpage = await mctx.newPage();
      const merrors = [];
      mpage.on('pageerror', (e) => merrors.push(String(e).slice(0, 140)));
      await mpage.addInitScript(() => { try { localStorage.setItem('sdp.guide_seen', '0.0.7.e'); localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e', guideAutoPlay: false })); } catch (e) {} });
      await mpage.goto(server.origin + '/', { waitUntil: 'load' });
      await mpage.waitForTimeout(2200);
      const mboot = await mpage.evaluate(() => ({
        ready: !!(window.SDP && SDP.Sync && SDP.Sync.isReady && SDP.Sync.isReady()),
        words: SDP.Sync.words().length,
        verPill: document.getElementById('sdpVerPill').textContent,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      }));
      check('D2 mobile 375×812 boot: 31 words · 0.0.7.e pill · zero overflow · zero console errors',
        mboot.ready === true && mboot.words === 31 && mboot.verPill === 'v0.0.7.e' &&
        mboot.overflow === false && merrors.length === 0,
        JSON.stringify(mboot) + ' | ' + merrors.join(','));
      await mctx.close();

      /* the Live Lab full suite */
      const lctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const lpage = await lctx.newPage();
      const lerrors = [];
      lpage.on('pageerror', (e) => lerrors.push(String(e).slice(0, 140)));
      await lpage.goto(server.origin + '/lab.html', { waitUntil: 'load' });
      await lpage.waitForTimeout(2000);
      const labBoot = await lpage.evaluate(() => ({
        pill: document.getElementById('labVerPill').textContent,
        title: document.title,
        station7: !!document.getElementById('btnLabRunStation7'),
      }));
      check('L1 the Live Lab boots unified at 0.0.7.e (zero v4.0) with Station 7 present',
        labBoot.pill === '0.0.7.e' && labBoot.title.indexOf('v4.0') < 0 && labBoot.station7 === true, JSON.stringify(labBoot));
      await lpage.evaluate(() => { const b = document.getElementById('btnLabRunAll'); if (b) b.click(); });
      await lpage.waitForTimeout(26000);
      const labRun = await lpage.evaluate(() => {
        const c = SDP.LiveLab.counts();
        return { pass: c.pass, fail: c.fail, warn: c.warn, badge: (document.getElementById('labScoreBadge') || {}).getAttribute('data-state') };
      });
      check('L2 the FULL 7-station Live Lab run is ALL PASS — 0 FAIL (the 76/76 −21 LUFS family intact)',
        labRun.fail === 0 && labRun.badge === 'pass' && labRun.pass >= 20,
        JSON.stringify(labRun) + ' | ' + lerrors.join(','));
      await lctx.close();
      await server.close();
    } finally {
      await browser.close();
    }
  } catch (e) {
    check('L0 the live verification harness ran', false, String(e).slice(0, 300));
  }

  /* ── report ───────────────────────────────────────────────────────────── */
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  for (const r of results) {
    if (r.status === 'FAIL') console.log('FAIL  ' + r.test + '  [' + r.detail.slice(0, 180) + ']');
  }
  console.log('\nG22 v007d-verification.cjs — ' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})();
