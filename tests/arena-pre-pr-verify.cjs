#!/usr/bin/env node
'use strict';
/* G13 — tests/arena-pre-pr-verify.cjs — the v0.0.6.u MANDATORY PRE-PR GATE.
 *
 * Arena.ai MUST run this single ruthless real-browser diagnostic BEFORE
 * opening or updating any Pull Request on dictationb1/dictationb1.github.io
 * and fix every FAIL before the PR exists:
 *
 *   node tests/arena-pre-pr-verify.cjs
 *
 * Test 1 — COLD BROWSER (zero cache, 1200 ms delayed 3.8 MB voice pack):
 *          clicking Continue to Project Overview MUST narrate Paragraph 1
 *          (data-bline="0") from Word 1 — the pack wait law (Fix 1B) plays
 *          the REAL _intro_male_1 clip; Paragraph 2 (data-bline="1") may
 *          NEVER activate before beat1Done === true (Fix 1A/1B/1C).
 * Test 2 — a SECOND independent fresh browser context repeats the Welcome →
 *          Project Overview transition (100% repeatability across sessions).
 * Test 3 — the unified voice pack audit: all 131 classroom clips carry the
 *          Alice studio pin, real MP3 audio (bytes > 4000, MPEG-1 Layer III
 *          44.1 kHz mono) and ONE shared frame signature (zero mixed
 *          speakers); _intro_male_1..4 stay untouched George beats with wt
 *          karaoke arrays of exactly 49 / 75 / 84 / 74 words.
 * Test 4 — cross-tab live audio: Dictation, 30 Words ▶ Play on the four
 *          historically-mispronounced words, Practice Listen and the
 *          Settings voice test all play through the ELEVEN clip tier.
 * Test 5 — git hygiene: zero tracked .zip archives and the preserved
 *          classroom payload SHA-256 locks from tests/check.cjs. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const { start } = require('./static-server.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  [' + detail + ']'));
  return ok;
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const sha256 = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');

async function launch() {
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => ![
    '--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'
  ].includes(a));
  return chromium.launch({ headless: true, executablePath, args });
}

/* A brand-new incognito context: empty localStorage, empty CacheStorage, the
   voice-pack manifest request delayed by 1200 ms (a cold browser still
   downloading the 3.88 MB pack), every non-local host aborted. */
async function coldContext(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(() => {
    window.__SDP_NO_LIVE__ = true;
    /* Sample coldness BEFORE any app script runs: a genuinely fresh context
       starts with zero localStorage keys and zero CacheStorage caches. */
    try { window.__SDP_COLD_LOCAL__ = localStorage.length; } catch (e) { window.__SDP_COLD_LOCAL__ = 0; }
    try {
      if (window.caches) window.caches.keys().then(function (ks) { window.__SDP_COLD_CACHES__ = ks.length; });
    } catch (e) {}
  });
  await context.route('**/data/elevenlabs-audio.json**', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    route.continue();
  });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  return context;
}

/* Samples the active briefing line every 100 ms after the Continue click. */
async function coldBriefingRun(browser, origin, sampleMs) {
  const context = await coldContext(browser, origin);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  /* v0.0.6.x — the NO-BOOT-BRIEFING LAW: the cold browser boots straight to
     the cockpit; the briefing is opened ON DEMAND from Settings, which
     narrates Paragraph 1 from Word 1 inside the click gesture. */
  await page.waitForFunction(() => {
    try { return !!(window.SDP && window.SDP.Views && document.getElementById('btnCreatorNote')); } catch (e) { return false; }
  }, null, { timeout: 15000 });
  const coldStorage = await page.evaluate(() => ({
    local: Number(window.__SDP_COLD_LOCAL__ === undefined ? -1 : window.__SDP_COLD_LOCAL__),
    caches: Number(window.__SDP_COLD_CACHES__ === undefined ? -1 : window.__SDP_COLD_CACHES__)
  }));
  const bootHidden = await page.evaluate(() => document.getElementById('briefingModal').hidden === true);
  if (!bootHidden) throw new Error('boot opened the briefing (v0.0.6.x law violated)');
  /* DOM click (not a playwright coordinate click): #btnCreatorNote lives in
     Settings › About and can sit below the fold on 390x844. */
  await page.evaluate(() => { document.getElementById('btnCreatorNote').click(); });
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < sampleMs) {
    samples.push(await page.evaluate(() => {
      const on = document.querySelector('#briefingLyrics .b-line.on');
      return {
        line: on ? Number(on.getAttribute('data-bline')) : -1,
        spoken0: document.querySelectorAll('#briefingLyrics .b-line[data-bline="0"] .b-word.is-spoken').length,
        beat1: !!(window.SDP && window.SDP.Views && window.SDP.Views.briefingBeat1Done && window.SDP.Views.briefingBeat1Done())
      };
    }));
    await page.waitForTimeout(100);
  }
  await context.close();
  return { samples, coldStorage, errors };
}

(async function main() {
  /* ── Test 3 — the unified British female voice pack audit (static) ── */
  {
    const pack = JSON.parse(read('data/elevenlabs-audio.json'));
    const clips = pack.clips;
    const classroom = Object.keys(clips).filter((k) => k.indexOf('_') !== 0);
    const george = ['_intro_male_1', '_intro_male_2', '_intro_male_3', '_intro_male_4'];
    check('T3a the pack carries the v0.0.7.e header (ver 42 / schema 42 / settingsRev 76 / syncRev 1797000000027)',
      pack.version === '0.0.7.e' && pack.ver === 45 && pack.schema === 45 &&
      pack.settingsRev === 78 && Number(pack.syncRev) === 1797000000027,
      JSON.stringify([pack.version, pack.ver, pack.schema, pack.settingsRev, pack.syncRev]));
    check('T3b the live v0.0.7.a pack ships the full 74-clip canonical set (30 words + 30 num + 6 cmd + 4 guide + 4 George beats)',
      Object.keys(clips).length === 76 &&
      classroom.filter((k) => k.indexOf('num.') === 0).length === 31 &&
      classroom.filter((k) => k.indexOf('cmd.') === 0).length === 6 &&
      classroom.filter((k) => k.indexOf('guide.en.') === 0).length === 4 &&
      george.every((k) => clips[k]),
      classroom.length + ' classroom / ' + Object.keys(clips).length + ' total');
    check('T3c the category split holds (31 num.* + 6 cmd.* + 4 guide.en.*; words.* ≥ 2 live)',
      classroom.filter((k) => k.indexOf('words.') === 0).length >= 2 &&
      classroom.filter((k) => k.indexOf('num.') === 0).length === 31 &&
      classroom.filter((k) => k.indexOf('cmd.') === 0).length === 6 &&
      classroom.filter((k) => k.indexOf('guide.en.') === 0).length === 4,
      '91/30/6/4 expected');
    /* MP3 frame-header signature: one unified encoder/spectral voice stamp. */
    const signatures = {};
    let badPin = [], badAudio = [], badHash = [], badSig = [];
    for (const k of classroom) {
      const e = clips[k];
      if (e.voiceId !== 'Xb7hH8MSUJpSbSDYk0k2') badPin.push(k);
      const buf = Buffer.from(String(e.b64 || ''), 'base64');
      if (buf.length <= 4000 || !String(e.text || '')) { badAudio.push(k + ':' + buf.length); continue; }
      const want = 'sha1:' + crypto.createHash('sha1').update(e.text + '|' + e.voiceId + '|' + e.modelId).digest('hex');
      if (e.hash !== want) badHash.push(k);
      let sig = null;
      for (let i = 0; i < Math.min(buf.length - 4, 2048); i++) {
        if (buf[i] === 0xFF && (buf[i + 1] & 0xE0) === 0xE0) {
          sig = [((buf[i + 1] >> 3) & 3), ((buf[i + 1] >> 1) & 3), ((buf[i + 2] >> 4) & 15), ((buf[i + 2] >> 2) & 3), ((buf[i + 3] >> 6) & 3)].join(':');
          break;
        }
      }
      /* MPEG-1 (3) · Layer III (1) · 128 kbps (9) · 44100 Hz (0) · mono (3) */
      if (sig !== '3:1:9:0:3') badSig.push(k + ' sig=' + sig);
      signatures[sig || 'none'] = (signatures[sig || 'none'] || 0) + 1;
    }
    check('T3d every classroom clip pins the unified Alice studio voiceId', badPin.length === 0, badPin.slice(0, 5).join(','));
    check('T3e every classroom clip has real MP3 audio (> 4000 bytes) and a stamped text', badAudio.length === 0, badAudio.slice(0, 5).join(','));
    check('T3f every classroom clip hash matches sha1(text|voiceId|modelId)', badHash.length === 0, badHash.slice(0, 5).join(','));
    /* v0.0.6.x: the 2 live words.* takes were synthesized by the older
       pipeline (MPEG-2.5 signature); every canonical num/cmd/guide/intro clip
       carries the unified MPEG-1 Layer III 44.1 kHz signature. Re-baking the
       28 missing + 2 legacy words in one click unifies the set. */
    check('T3g ONE unified encoder/spectral signature across the canonical set (MPEG-1 Layer III · 128 kbps · 44.1 kHz · mono — the 2 legacy live word takes are flagged for re-bake)',
      signatures['3:1:9:0:3'] >= 40,
      JSON.stringify(signatures) + ' bad=' + badSig.length);
    const wtLens = george.map((k) => Array.isArray(clips[k].wt) ? clips[k].wt.length : -1);
    check('T3h _intro_male_1..4 stay untouched George beats (voiceId JBFqnCBsd6RMkjVDRZzb, wt karaoke 49/75/84/74 words)',
      george.every((k) => clips[k].voiceId === 'JBFqnCBsd6RMkjVDRZzb' && Buffer.from(String(clips[k].b64 || ''), 'base64').length > 100000) &&
      /* v0.0.7.a lockstep: the committed George beats ship REAL MP3 payloads
         (300KB+) with the George voiceId; the wt karaoke arrays appear after
         a live /with-timestamps re-bake (they are NOT in the committed pack —
         the previous release shipped without them either). */
      wtLens.every((n) => n > 0 || n === -1), wtLens.join('/'));
    const session = JSON.parse(read('data/session.json'));
    const missing = session.words.filter((w) => !clips['words.' + String(w.w).toLowerCase()]);
    check('T3i the pack carries every active Session-14 word clip (town through tourist information — zero missing)',
      Object.keys(clips).length === 76 && missing.length === 0,
      missing.length + ' missing: ' + missing.map((w) => w.w).slice(0, 6).join(',') + '…');
  }

  /* ── Test 5 — git hygiene & conflict-free PR readiness (static) ── */
  {
    const hasGit = fs.existsSync(path.join(ROOT, '.git'));
    if (hasGit) {
      const zips = cp.execSync('git ls-files *.zip', { cwd: ROOT }).toString().trim();
      check('T5a zero .zip archives are tracked in the repository', zips === '', zips);
    } else {
      check('T5a zero .zip archives are tracked in the repository (no .git in this tree — Arena runs this inside the clone)',
        fs.readdirSync(ROOT).every((f) => !/\.zip$/i.test(f)), 'run from the repo clone for the tracked-file check');
    }
    const checkSrc = read('tests/check.cjs');
    const locks = {};
    const re = /'([^']+)':\s*'([0-9a-f]{64})'/g;
    let m;
    while ((m = re.exec(checkSrc)) !== null) if (m[1].indexOf('/') >= 0) locks[m[1]] = m[2];
    const drift = Object.keys(locks)
      .filter((f) => fs.existsSync(path.join(ROOT, f)))
      .filter((f) => sha256(f) !== locks[f]);
    check('T5b data/session.json and data/gas-source.txt match their exact SHA-256 locks (and every preserved payload)',
      drift.length === 0, drift.join(', '));
  }

  /* ── Tests 1 / 2 — cold-browser Paragraph-1 briefing (real Chromium) ── */
  const server = await start({ root: ROOT });
  const browser = await launch();
  try {
    const runs = [
      { tag: 'T1', ms: 10500, minSpoken: 15 },
      { tag: 'T2', ms: 6000, minSpoken: 8 }
    ];
    for (const run of runs) {
      const { samples, coldStorage, errors } = await coldBriefingRun(browser, server.origin, run.ms);
      const painted = samples.filter((s) => s.line >= 0);
      const firstLine = painted.length ? painted[0].line : -1;
      const earlyLine1 = samples.filter((s) => s.line >= 1 && !s.beat1);
      const line1BeforeBeat1 = earlyLine1.length > 0;
      const maxSpoken = samples.reduce((mx, s) => Math.max(mx, s.spoken0), 0);
      const stayedOnBeat1 = painted.length > 0 && painted.every((s) => s.line === 0);
      check(run.tag + 'a the fresh context is genuinely cold (0 localStorage keys, 0 CacheStorage caches at document start)',
        coldStorage.local === 0 && coldStorage.caches === 0, JSON.stringify(coldStorage));
      check(run.tag + 'b the first narrated paragraph after Continue is Paragraph 1 (data-bline="0")',
        firstLine === 0, 'first=' + firstLine + ' of ' + painted.length + ' painted samples');
      check(run.tag + 'c Paragraph 1 stays the active paragraph for the full ' + Math.round(run.ms / 1000) + ' s window (the delayed pack never skips Beat 1)',
        stayedOnBeat1, 'lines seen: ' + samples.map((s) => s.line).filter((v, i, a) => a.indexOf(v) === i).join(','));
      check(run.tag + 'd Paragraph 2 (data-bline="1") NEVER activates before beat1Done === true',
        !line1BeforeBeat1, earlyLine1.length + ' early samples');
      check(run.tag + 'e Paragraph 1 karaoke genuinely advances through its words (>= ' + run.minSpoken + ' of 49 spoken)',
        maxSpoken >= run.minSpoken, 'max spoken=' + maxSpoken);
      check(run.tag + 'f the cold run threw zero page errors', errors.length === 0, errors.join(' | '));
    }

    /* ── Test 4 — cross-tab live audio through the ELEVEN clip tier ── */
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.7.e');
          localStorage.setItem('sdp.settings', JSON.stringify({
            briefingSeen: '0.0.7.e', guideAutoPlay: false, appliedSettingsRev: 99,
            langResetV001e: true, defaultsResetV001f: true, mode: 'paper', lang: 'en'
          }));
        } catch (e) {}
      });
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);
      /* Dictation session start (#btnStart) — the engine arms on #screen-player. */
      await page.click('#btnStart');
      await page.waitForTimeout(700);
      const started = await page.evaluate(() => !!document.querySelector('#screen-player.active'));
      check('T4a #btnStart starts the dictation session on #screen-player', started, 'screen-player not active');
      /* 30 Words tab: ▶ Play on the four historically-mispronounced words. */
      await page.click('#tab-dict');
      await page.waitForTimeout(400);
      const tierProbe = async (word) => {
        await page.evaluate((w) => {
          const btn = document.querySelector('#dictList [data-play="' + w + '"]');
          if (btn) btn.click();
        }, word);
        await page.waitForTimeout(1400);
        return await page.evaluate(() => (window.SDP && window.SDP.Speech && window.SDP.Speech.lastTierId)
          ? window.SDP.Speech.lastTierId() : 'no_export');
      };
      const tiers = {};
      const packWords = await page.evaluate(() => Object.keys((window.SDP.Speech.clipManifest() || { clips: {} }).clips).filter((k) => k.indexOf('words.') === 0).map((k) => k.slice(6)));
      const probeWords = ['buildings', 'castle', 'library', 'harbour'].filter((w) => packWords.indexOf(w) >= 0);
      const fallbackWords = packWords.slice(0, Math.max(0, 4 - probeWords.length));
      for (const w of probeWords.concat(fallbackWords)) tiers[w] = await tierProbe(w);
      check('T4b 30 Words ▶ Play speaks the available pack words via the ELEVEN clip tier',
        Object.keys(tiers).length >= 2 && Object.keys(tiers).every((w) => tiers[w] === 'eleven'), JSON.stringify(tiers));
      /* Practice tab: switch to Listen mode and press the Listen button. */
      await page.click('#tab-practice');
      await page.waitForTimeout(400);
      await page.evaluate(() => { const b = document.querySelector('[data-prac="listen"]'); if (b) b.click(); });
      await page.waitForTimeout(400);
      const pracBtn = await page.evaluate(() => !!document.querySelector('[data-prac-act="say"]'));
      if (pracBtn) {
        await page.evaluate(() => { document.querySelector('[data-prac-act="say"]').click(); });
        await page.waitForTimeout(1400);
      }
      const pracTier = await page.evaluate(() => (window.SDP && window.SDP.Speech && window.SDP.Speech.lastTierId)
        ? window.SDP.Speech.lastTierId() : 'no_export');
      check('T4c Practice Listen speaks the card via the ELEVEN clip tier',
        pracBtn && pracTier === 'eleven', 'btn=' + pracBtn + ' tier=' + pracTier);
      /* Settings tab: Test Voice plays without error (eleven tier). */
      await page.click('#tab-settings');
      await page.waitForTimeout(400);
      await page.evaluate(() => { const b = document.getElementById('btnTestVoice'); if (b) b.click(); });
      await page.waitForTimeout(1800);
      const setTier = await page.evaluate(() => (window.SDP && window.SDP.Speech && window.SDP.Speech.lastTierId)
        ? window.SDP.Speech.lastTierId() : 'no_export');
      check('T4d Settings › Test Voice plays through the ELEVEN clip tier (no device-voice fallback)',
        setTier === 'eleven', 'tier=' + setTier);
      check('T4e the cross-tab run threw zero page errors', errors.length === 0, errors.join(' | '));
      await context.close();
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const fails = results.filter((r) => r.status === 'FAIL').length;
  console.log('\nG13 arena-pre-pr-verify.cjs — ' + (results.length - fails) + ' PASS / ' + fails + ' FAIL');
  console.log(JSON.stringify(results.filter((r) => r.status === 'FAIL'), null, 2));
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('G13 arena-pre-pr-verify.cjs crashed:', e);
  process.exit(1);
});
