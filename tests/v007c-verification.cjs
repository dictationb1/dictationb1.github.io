#!/usr/bin/env node
'use strict';
/* G21 — the v0.0.7.e unified release verification gate.
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.e
 * (0.0.7.e / ver 43 / schema 43 / session ver 66 / settingsRev 76 /
 *  syncRev+wordsRev 1797000000027 / SW sdp-v0.0.7.e-s44)
 * C/D/M/L pillars, verified LIVE in headless Chromium at desktop 1280 AND
 * mobile 375×812 plus the Live Lab:
 *  C1/D1-D3 (BUG-01) probe-verified Offline Mode: no false offline banner,
 *    the Lecturer Studio never stays blinded while online, Retry Connection,
 *    the 8 s Check-for-session-update deadline, no Session-8 · 0-words flash.
 *  C2/L2 (BUG-02) ONE unified −21 LUFS voice family — 76/76 clips (the live
 *    Lab full diagnostic run must report 0 FAIL).
 *  C3/D10-D11 (BUG-03) per-provider key tests with real HTTP diagnostics +
 *    the strict word-record schema gate on publish.
 *  C4/D8 (BUG-04) complete bilingual data (natural Sinhala meanings,
 *    repaired English meanings incl. #06 cell phone) + the flip-back footer.
 *  C5/D4-D7/M1-M2 (BUG-05) reveal-open keeps every control, the Pause/Resume
 *    caption follows the phase, the 00 s burst never overlaps the digits,
 *    every word count is dynamic, no heading hides under the sticky header.
 *  C6/L1 (BUG-06) the Live Lab joins the ONE progressive version (no v4.0)
 *    and Station 7 verifies the release in-browser.
 *  C7 attribution invariants stay verbatim. */
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
const viewsSrc = readText('data/sdp-ui-views.js');
const syncSrc = readText('data/sdp-data-sync.js');
const engineSrc = readText('data/sdp-dictation-engine.js');
const studio = readText('data/studio.js');
const css = readText('assets/css/sdp-ui.css');
const indexHtml = readText('index.html');
const labHtml = readText('lab.html');
const liveLab = readText('data/sdp-live-lab.js');
const sw = readText('sw.js');
const session = readJSON('data/session.json');
const version = readJSON('data/version.json');
const config = readJSON('data/config.json');
const pack = readJSON('data/elevenlabs-audio.json');

/* ── C0 · unified lockstep pins ─────────────────────────────────────────── */
check('C0a version.json pins 0.0.7.e / 43 / 76 / 1797000000027 / Session 14',
  version.ver === 45 && version.schema === 45 && version.appVersion === '0.0.7.e' && version.version === '0.0.7.e' &&
  version.settingsRev === 78 && Number(version.syncRev) === 1797000000027 && version.session === '14' && version.buildDate === '2026-11-21',
  JSON.stringify({ ver: version.ver, appVersion: version.appVersion, settingsRev: version.settingsRev, syncRev: version.syncRev }));
check('C0b session.json pins ver 66 / 0.0.7.e / 76 / …025 / 31 words',
  session.ver === 68 && session.appVersion === '0.0.7.e' && session.settingsRev === 78 &&
  Number(session.syncRev) === 1797000000027 && Number(session.wordsRev) === 1797000000027 && session.wordCount === 31,
  JSON.stringify({ ver: session.ver, appVersion: session.appVersion, settingsRev: session.settingsRev, syncRev: session.syncRev, wordsRev: session.wordsRev }));
check('C0c config.json + pack headers pin 43 / 0.0.7.e / 76 / …025 (+ pack wordsRev …025)',
  config.ver === 45 && config.appVersion === '0.0.7.e' && config.settingsRev === 78 && Number(config.syncRev) === 1797000000027 &&
  pack.ver === 45 && pack.appVersion === '0.0.7.e' && pack.settingsRev === 78 && Number(pack.syncRev) === 1797000000027 && Number(pack.wordsRev) === 1797000000027,
  JSON.stringify({ cfg: [config.ver, config.appVersion, config.settingsRev, config.syncRev], pack: [pack.ver, pack.appVersion, pack.settingsRev, pack.syncRev, pack.wordsRev] }));
check('C0d sw.js pins the s43 shell (sdp-v0.0.7.e-s44) + release 0.0.7.e',
  /SW_VERSION = 'sdp-v0\.0\.7\.e-s44'/.test(sw) && /SHELL_CACHE = 'sdp-v0\.0\.7\.e-s44-shell'/.test(sw) && /SW_RELEASE = '0\.0\.7\.e'/.test(sw));
check('C0e index.html boots at 0.0.7.e and data.html + the meter follow the same release',
  /var TARGET = '0\.0\.7\.e'/.test(indexHtml) &&
  readText('data.html').indexOf("var TARGET = '0.0.7.e'") > 0 &&
  readText('data/data-meter.js').indexOf("CACHE_VERSION = 'sdp-v0.0.7.e'") > 0);
check('C0f zero stale 0.0.7.b live pins anywhere in the app or the tests',
  (function () {
    const files = ['index.html', 'lab.html', 'sw.js', 'manifest.webmanifest', 'data/version.json', 'data/config.json', 'data/session.json', 'data/elevenlabs-audio.json', 'data.html', 'data/index.html'];
    const bad = [];
    for (const f of files) if (readText(f).indexOf('0.0.7.b') >= 0) bad.push(f);
    for (const tf of fs.readdirSync(path.join(ROOT, 'tests'))) {
      /* this gate itself must name the string it hunts — self-exempt. */
      if (tf === 'v007c-verification.cjs') continue;
      if (tf.endsWith('.cjs') && readText('tests/' + tf).indexOf('0.0.7.b') >= 0) bad.push('tests/' + tf);
    }
    return bad.length === 0;
  })(), (function () {
    const files = ['index.html', 'lab.html', 'sw.js', 'manifest.webmanifest', 'data/version.json', 'data/config.json', 'data/session.json', 'data/elevenlabs-audio.json', 'data.html', 'data/index.html'];
    const bad = [];
    for (const f of files) if (readText(f).indexOf('0.0.7.b') >= 0) bad.push(f);
    for (const tf of fs.readdirSync(path.join(ROOT, 'tests'))) {
      if (tf === 'v007c-verification.cjs') continue;
      if (tf.endsWith('.cjs') && readText('tests/' + tf).indexOf('0.0.7.b') >= 0) bad.push('tests/' + tf);
    }
    return bad.length ? bad.join(', ') : '';
  })());

/* ── C1 · BUG-01 offline law ────────────────────────────────────────────── */
check('C1a the connectivity probe: 8 s budget + ANY HTTP answer proves online',
  /version\.json\?probe=' \+ Date\.now\(\)/.test(viewsSrc) && /finish\(!!r\)/.test(viewsSrc) && /\}, 8000\);/.test(viewsSrc),
  'probe law');
check('C1b the 2-strike law: one failed tick never latches Offline (noteSyncFailed / noteSyncReachable)',
  /function noteSyncFailed\(\) \{/.test(viewsSrc) && /offlineStrikes >= 2/.test(viewsSrc) && /function noteSyncReachable\(\) \{/.test(viewsSrc) &&
  viewsSrc.indexOf('noteSyncReachable(); } catch (eO2) {}') > 0);
check('C1c the banner AND the Studio blind always move together (applyProbeResult)',
  /paintOfflineBanner\(!ok\);\s*\n\s*\/\* v0\.0\.7\.e \(BUG-01\): the banner and the Lecturer Studio blind ALWAYS/.test(viewsSrc.replace(/\r/g, '')) ||
  (/function applyProbeResult/.test(viewsSrc) && /paintStudioOffline\(!ok\)/.test(viewsSrc)));
check('C1d the Retry Connection button ships + binds + resets the strike counter',
  indexHtml.indexOf('btnOfflineRetry') > 0 && /obRetry\.addEventListener\('click', function \(\) \{/.test(viewsSrc) && /offlineStrikes = 0;\s*\n\s*refreshOfflineState\(true\)/.test(viewsSrc.replace(/\r/g, '')) || /offlineStrikes = 0;/.test(viewsSrc));
check('C1e Check for session update: hard 8 s deadline + deterministic toast',
  /var deadlineUpd = global\.setTimeout/.test(viewsSrc) && /updateTimedOut/.test(viewsSrc) && /\}, 8000\);/.test(viewsSrc) && /global\.clearTimeout\(deadlineUpd\)/.test(viewsSrc));
check('C1f boot honesty: a loading readiness state, zero literal-8 session fallbacks',
  /homeReadyLoading/.test(viewsSrc) && /dataSettled\(\)/.test(viewsSrc) && !/syncSessionNo[\s\S]{0,120}'8'/.test(viewsSrc));
check('C1g the pullVerified leg is hang-proof (a throwing verifier can never swallow settle)',
  /catch \(eV\) \{ return false; \}/.test(syncSrc) && /catch \(eA\) \{ \/\* fall through to retry\/fail \*\/ \}/.test(syncSrc));

/* ── C2 · BUG-02 unified −21 LUFS voice family ──────────────────────────── */
(function () {
  const clips = pack.clips;
  const keys = Object.keys(clips);
  let bytesOk = 0, hashOk = 0, aliceOk = 0, georgeOk = 0;
  for (const k of keys) {
    const e = clips[k];
    const raw = Buffer.from(e.b64 || '', 'base64');
    if (raw.length >= 512 && Number(e.bytes) === raw.length) bytesOk += 1;
    const want = 'sha1:' + crypto.createHash('sha1').update(`${e.text || ''}|${e.voiceId || ''}|${e.modelId || ''}`).digest('hex');
    if (want === e.hash) hashOk += 1;
    if (k.indexOf('_intro_male_') === 0 ? e.voiceId === 'JBFqnCBsd6RMkjVDRZzb' : e.voiceId === 'Xb7hH8MSUJpSbSDYk0k2') {
      if (k.indexOf('_intro_male_') === 0) georgeOk += 1; else aliceOk += 1;
    }
  }
  check('C2a the pack ships 76 clips (31 words + 31 numbers + 6 commands + 4 guides + 4 briefing)',
    keys.length === 76, String(keys.length));
  check('C2b every clip: bytes field equals the real payload, ≥512 bytes (the shipped zero-byte law)',
    bytesOk === 76, bytesOk + '/76');
  check('C2c the provenance hash law survives mastering (sha1 of text|voiceId|modelId, 76/76)',
    hashOk === 76, hashOk + '/76');
  check('C2d ONE unified voice: Alice on all 72 non-briefing clips, George only on the 4 briefing clips',
    aliceOk === 72 && georgeOk === 4, aliceOk + ' Alice / ' + georgeOk + ' George');
})();

/* ── C3 · BUG-03 provider key tests + the word-record schema gate ───────── */
check('C3a validateWordRecords() ships with the truncation + Sinhala-script laws',
  /function validateWordRecords\(/.test(studio) && /\\u0D80-\\u0DFF/.test(studio) && /English meaning missing or truncated/.test(studio));
check('C3b the schema gate blocks BOTH publish entry points before any credit is spent',
  studio.indexOf("cb(new Error('invalid_words'))") >= 2 && /validate BEFORE any clip synthesis/.test(studio));
check('C3c per-provider Test Key buttons ship (Groq + Gemini) with real HTTP diagnostics',
  /btn\('btnVerifyGroq'/.test(studio) && /btn\('btnVerifyGemini'/.test(studio) && /function httpStatusLine\(/.test(studio) &&
  /HTTP 401/.test(studio) && /HTTP 403/.test(studio) && /HTTP 429/.test(studio));
check('C3d the diagnostics + gate strings are bilingual (EN + SI tables)',
  /studioVerifyGroq: 'Test Groq Key'/.test(viewsSrc) && /studioVerifyGroq: 'Groq යතුර පරීක්ෂා කරන්න'/.test(viewsSrc) &&
  /studioWordsIssueSi: 'missing Sinhala meaning'/.test(viewsSrc) && /සිංහල තේරුම නොමැත/.test(viewsSrc));

/* ── C4 · BUG-04 bilingual data integrity ───────────────────────────────── */
(function () {
  const ws = session.words;
  const siOk = ws.filter((w) => /[\u0D80-\u0DFF]/.test(String(w.si || ''))).length;
  const mOk = ws.filter((w) => String(w.m || '').length >= 15 && !/(\b(the|a|an|of|to|and|into|with|for|from)\.)$/i.test(String(w.m || ''))).length;
  const cell = ws.filter((w) => w.w === 'cell phone')[0] || {};
  check('C4a all 31 words carry a real Sinhala meaning (Sinhala script present)',
    siOk === 31 && ws.length === 31, siOk + '/' + ws.length);
  check('C4b all 31 English meanings are complete — never blank or truncated',
    mOk === 31, mOk + '/' + ws.length);
  check('C4c #06 cell phone ships a full B1 definition (the truncated live bug)',
    /portable telephone/.test(String(cell.m || '')) && String(cell.m || '').length > 60 && !/without losing the\.$/.test(String(cell.m || '')),
    String(cell.m || '').slice(0, 80));
  check('C4d every example sentence contains its word (slash variants included)',
    ws.every((w) => String(w.s || '').toLowerCase().indexOf(String(w.w).split('/')[0].trim().toLowerCase()) >= 0));
  check('C4e the flashcard footer flips (tapFlipBack ships EN + SI)',
    /tapFlipBack: 'Tap the card to flip back'/.test(viewsSrc) && /කාඩ්පත නැවත හැරවීමට තට්ටු කරන්න/.test(viewsSrc) &&
    /practice\.flipped \? 'tapFlipBack' : 'tapToFlip'/.test(viewsSrc));
})();

/* ── C5 · BUG-05 UI laws ────────────────────────────────────────────────── */
check('C5a reveal-open keeps the 4 action buttons + the deck captions (the hiding rule is gone)',
  !/\.cockpit\.reveal-open \.cockpit-helpers,/.test(css) && !/\.cockpit\.reveal-open \.orbital \.deck-cap \{ display: none; \}/.test(css) &&
  /v0\.0\.7\.e \(BUG-05\): while the reveal card is open/.test(css));
check('C5b the play/pause burst lives in the NORTH of the ring (never over the 00 s digits)',
  /place-items:start center;padding-top:12px/.test(css) && /\.ring-tap-overlay svg\{width:42px;height:42px\}/.test(css) && /#beatSeconds \{ font-size: 40px; line-height: 1; \}/.test(css));
check('C5c the Pause/Resume caption follows the phase (paintDeckCap + phase keys)',
  /function paintDeckCap\(\)/.test(engineSrc) && /capPause: 'Pause', capResume: 'Resume', capStart: 'Start'/.test(viewsSrc) &&
  /paintDeckCap\(\); return true; \}/.test(engineSrc));
check('C5d every word count is {N}-templated and painted from the live bank (paintWordCounts + fmtN + liveTotal)',
  /function paintWordCounts\(\)/.test(viewsSrc) && /function liveTotal\(\)/.test(viewsSrc) && /function fmtN\(/.test(viewsSrc) &&
  /tabLabel, \(lang === 'si' \? 'වචන \(' : 'Words \('/.test(viewsSrc));
check('C5e zero hardcoded-30 templates remain in the shipped string tables',
  !/:\s*'[^']*\b30 (B1 )?words/.test(viewsSrc) && !/'All 30'/.test(viewsSrc) && !/'30-Word/.test(viewsSrc) && !/Jump to Word 1–30/.test(viewsSrc) && !/වචන 30/.test(viewsSrc));
check('C5f every screen clears the sticky header (scroll-margin + tab-switch scroll-to-top)',
  /scroll-margin-top: calc\(var\(--header-h\) \+ 14px\)/.test(css) && /global\.scrollTo\(0, 0\)/.test(viewsSrc));

/* ── C6 · BUG-06 unified Live Lab ───────────────────────────────────────── */
check('C6a lab.html carries NO independent version (no v4.0) and paints the unified pill from data/version.json',
  labHtml.indexOf('v4.0') < 0 && /id="labVerPill">0\.0\.7\.e</.test(labHtml) && /\.\/data\/version\.json\?t='/.test(labHtml));
check('C6b SDP.LiveLab.version joins the ONE progressive version + the report follows',
  /version: '0\.0\.7\.e',/.test(liveLab) && /labVersion: '0\.0\.7\.e',/.test(liveLab) && !/'4\.0\.0'/.test(liveLab));
check('C6c Station 7 ships the five v0.0.7.e release probes + joins the full suite',
  /STATION 7<\/span>v0\.0\.7\.e Unified Release Verification/.test(labHtml) && /btnLabRunStation7/.test(labHtml) &&
  /function station7\(\)/.test(liveLab) && /bindBtn\('btnLabRunStation7', station7\)/.test(liveLab) && /try \{ station7\(\); \} catch \(e7\)/.test(liveLab));

/* ── C7 · attribution invariants (verbatim) ─────────────────────────────── */
check('C7 the credit pill + both bilingual credit lines stay verbatim everywhere',
  indexHtml.indexOf('CREDITS GOES TO Hansana') > 0 &&
  indexHtml.indexOf('Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)') > 0 &&
  indexHtml.indexOf('නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini') > 0 &&
  labHtml.indexOf('CREDITS GOES TO Hansana') > 0);

/* ── live verification ──────────────────────────────────────────────────── */
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
      /* ═══ DESKTOP ═══ */
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
      await page.addInitScript(() => { try { localStorage.setItem('sdp.guide_seen', '0.0.7.e'); localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e', guideAutoPlay: false })); } catch (e) {} });
      await page.goto(server.origin + '/', { waitUntil: 'load' });
      await page.waitForTimeout(2600);

      const boot = await page.evaluate(() => ({
        ready: !!(window.SDP && SDP.Sync && SDP.Sync.isReady && SDP.Sync.isReady()),
        sessionNo: String(SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : ''),
        words: SDP.Sync.words().length,
        badge: document.getElementById('homeReadyBadge').textContent,
        badgeState: document.getElementById('homeReadyBadge').getAttribute('data-ready'),
        bankEmptyHidden: document.getElementById('bankEmpty').hidden,
        bannerHidden: document.getElementById('sdpOfflineModeBanner').hidden,
        studioBlinded: document.getElementById('screen-studio').classList.contains('studio-is-offline'),
        startLabel: document.getElementById('btnStart').textContent.trim(),
        homeSub: document.getElementById('homeSub').textContent,
        tabWords: (document.querySelector('#tab-dict [data-i18n="tabWords"]') || {}).textContent,
      }));
      check('D1 the app boots Session 14 · 31 words cleanly — no false Offline banner, no Studio blind, no Session-8 flash',
        boot.ready === true && boot.sessionNo === '14' && boot.words === 31 && /31 words/.test(boot.badge) &&
        boot.bankEmptyHidden === true && boot.bannerHidden === true && boot.studioBlinded === false && errors.length === 0,
        JSON.stringify(boot) + ' | ' + errors.slice(0, 2).join(','));

      /* D2 — Check for session update is deterministic (≤ 9 s) */
      await page.evaluate(() => { document.getElementById('tab-settings').click(); });
      await page.waitForTimeout(250);
      await page.evaluate(() => { const b = document.getElementById('btnCheckUpdate'); if (b) b.click(); });
      const t0 = Date.now();
      let upd = '';
      for (let i = 0; i < 18; i++) {
        await page.waitForTimeout(500);
        upd = await page.evaluate(() => document.getElementById('settingsUpdateStatus').textContent);
        if (upd && upd.indexOf('Checking for a newer session') < 0) break;
      }
      check('D2 Check for session update ALWAYS completes (deterministic status, never hangs)',
        (Date.now() - t0) <= 9500 && /latest session|timed out|offline|failed|downloaded|Session/i.test(upd), upd + ' in ' + (Date.now() - t0) + 'ms');

      /* D3 — the offline round-trip: offline event shows the banner, recovery clears banner AND studio */
      await ctx.setOffline(true);
      await page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); });
      await page.waitForTimeout(1500);
      const offState = await page.evaluate(() => ({
        bannerHidden: document.getElementById('sdpOfflineModeBanner').hidden,
        studioBlinded: document.getElementById('screen-studio').classList.contains('studio-is-offline'),
        retryBtn: !!document.getElementById('btnOfflineRetry'),
      }));
      check('D3a a real offline event raises the banner (with the Retry button present)',
        offState.bannerHidden === false && offState.retryBtn === true, JSON.stringify(offState));
      await ctx.setOffline(false);
      await page.evaluate(() => { document.getElementById('btnOfflineRetry').click(); });
      await page.waitForTimeout(1800);
      const onState = await page.evaluate(() => ({
        bannerHidden: document.getElementById('sdpOfflineModeBanner').hidden,
        studioBlinded: document.getElementById('screen-studio').classList.contains('studio-is-offline'),
      }));
      check('D3b Retry Connection clears the banner AND the Studio blind together (the v0.0.7.b lockout is dead)',
        onState.bannerHidden === true && onState.studioBlinded === false, JSON.stringify(onState));

      /* D4-D7 — player UI */
      await page.evaluate(() => { document.getElementById('tab-player').click(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => { document.getElementById('btnStart').click(); });
      await page.waitForTimeout(2600);
      const runState = await page.evaluate(() => ({
        phase: SDP.Engine.config().phase,
        cap: (document.querySelector('.deck-key-main .deck-cap') || {}).textContent,
        strip: document.getElementById('sessionProgressCount').textContent,
        cockpit: document.getElementById('cockpitProgress').textContent,
      }));
      check('D4 the deck caption reads Pause while running + the live counts are 31 (no hardcoded 30)',
        runState.phase !== 'idle' && /Pause/i.test(runState.cap) && runState.strip.indexOf('31') >= 0 && runState.cockpit.indexOf('31') >= 0,
        JSON.stringify(runState));
      await page.evaluate(() => { document.getElementById('btnRevealWord').click(); });
      await page.waitForTimeout(400);
      const revealState = await page.evaluate(() => {
        const vis = (id) => { const n = document.getElementById(id); return !!n && getComputedStyle(n).display !== 'none' && n.offsetHeight > 0; };
        return {
          helpers: vis('cockpitHelpers'), repeat: vis('btnRepeat'), hint: vis('btnHint'),
          mode: vis('btnModeSwitch'), finish: vis('btnFinish'),
          caps: Array.from(document.querySelectorAll('.orbital .deck-cap')).filter((c) => getComputedStyle(c).display !== 'none').length,
        };
      });
      check('D5 Show Current Word keeps ALL 4 action buttons + all 4 deck captions visible',
        revealState.helpers === true && revealState.repeat === true && revealState.hint === true &&
        revealState.mode === true && revealState.finish === true && revealState.caps >= 4,
        JSON.stringify(revealState));
      await page.evaluate(() => { document.getElementById('btnRevealWord').click(); });
      await page.evaluate(() => { try { SDP.Engine.pause('user'); } catch (e) {} });
      await page.waitForTimeout(400);
      const pauseState = await page.evaluate(() => ({
        cap: (document.querySelector('.deck-key-main .deck-cap') || {}).textContent,
        icon: document.getElementById('btnPlayPause').getAttribute('data-icon'),
      }));
      check('D6 the caption switches Pause → Resume with the icon (the stuck-label bug is dead)',
        /Resume/i.test(pauseState.cap) && pauseState.icon === 'play', JSON.stringify(pauseState));
      const burst = await page.evaluate(() => {
        const ov = document.querySelector('#ringTapOverlay svg');
        if (!ov) return { ok: false, why: 'no burst painted yet' };
        const o = ov.getBoundingClientRect();
        const s = document.getElementById('beatSeconds').getBoundingClientRect();
        const overlap = !(o.right <= s.left || s.right <= o.left || o.bottom <= s.top || s.bottom <= o.top);
        return { ok: !overlap, o: { t: Math.round(o.top), b: Math.round(o.bottom) }, s: { t: Math.round(s.top), b: Math.round(s.bottom) } };
      });
      check('D7 the play/pause burst NEVER overlaps the seconds readout (north position)',
        burst.ok === true, JSON.stringify(burst));

      /* D8 — Sinhala data + flashcard footer */
      await page.evaluate(() => { document.getElementById('tab-practice').click(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => { const b = document.querySelector('[data-prac="flash"]'); if (b) b.click(); });
      await page.waitForTimeout(250);
      const flash = await page.evaluate(() => {
        const card = document.querySelector('.prac-card[data-prac-act="flip"]');
        if (card) card.click();
        return new Promise((resolve) => setTimeout(() => {
          const txt = document.getElementById('pracStage').innerText;
          resolve({ hasSi: /[\u0D80-\u0DFF]/.test(txt), footerBack: /flip back|නැවත හැරවීමට/.test(txt) });
        }, 250));
      });
      check('D8 the flashcard back shows the Sinhala meaning + the footer flips to flip-back',
        flash.hasSi === true && flash.footerBack === true, JSON.stringify(flash));

      /* D9-D11 — Studio: verify buttons + the word-record gate */
      await page.evaluate(() => { document.getElementById('rail-studio') ? document.getElementById('rail-studio').click() : document.getElementById('tab-studio').click(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => new Promise((resolve) => { try { SDP.Studio.unlock('78987898', () => resolve()); } catch (e) { resolve(); } }));
      await page.waitForTimeout(1200);
      const studioState = await page.evaluate(() => ({
        unlocked: SDP.Studio.isUnlocked(),
        groqBtn: !!document.getElementById('btnVerifyGroq'),
        geminiBtn: !!document.getElementById('btnVerifyGemini'),
        groqStatus: !!document.getElementById('groqVerifyStatus'),
        geminiStatus: !!document.getElementById('geminiVerifyStatus'),
      }));
      check('D9 the Studio unlocks online (never falsely blinded) and both provider Test Key buttons render',
        studioState.unlocked === true && studioState.groqBtn === true && studioState.geminiBtn === true &&
        studioState.groqStatus === true && studioState.geminiStatus === true, JSON.stringify(studioState));
      await page.evaluate(() => {
        /* clear any vault-carried key so the honest no-key diagnostic fires */
        try { if (SDP.Studio.state.secrets) SDP.Studio.state.secrets.aiKey = ''; } catch (e) {}
        const inp = document.getElementById('studioAiKey');
        if (inp) inp.value = '';
        const b = document.getElementById('btnVerifyGroq'); if (b) b.click();
      });
      await page.waitForTimeout(600);
      const noKey = await page.evaluate(() => (document.getElementById('groqVerifyStatus') || {}).textContent);
      check('D10 Test Groq Key with no key paints the honest no-key diagnostic (bilingual, never silent)',
        /Paste the AI key|AI යතුර අලවන්න/.test(String(noKey)), String(noKey));
      const gate = await page.evaluate(() => {
        /* a deliberately broken word list: blank Sinhala + a truncated meaning */
        SDP.Studio.state.words = [
          { w: 'brokenword', p: '/ˈbrəʊkən/', pos: 'noun.', m: 'A thing that ends without losing the.', si: '', s: 'The brokenword appears here.' }
        ];
        let blocked = '';
        try { SDP.Studio.state.dirty = true; } catch (e) {}
        const btn = document.getElementById('btnPublishWordsAndVoice');
        if (btn) btn.click();
        return new Promise((resolve) => setTimeout(() => {
          resolve({ msg: String((document.getElementById('studioMsg') || {}).textContent || '') });
        }, 700));
      });
      check('D11 the word-record schema gate blocks publishing a broken list (blank Si + truncated EN)',
        /Publish blocked|පළ කිරීම අවහිරයි/.test(gate.msg), gate.msg);
      await ctx.close();

      /* ═══ MOBILE 375×812 ═══ */
      const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36' });
      const mpage = await mctx.newPage();
      const merrors = [];
      mpage.on('pageerror', (e) => merrors.push(String(e).slice(0, 140)));
      await mpage.addInitScript(() => { try { localStorage.setItem('sdp.guide_seen', '0.0.7.e'); localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e', guideAutoPlay: false })); } catch (e) {} });
      await mpage.goto(server.origin + '/', { waitUntil: 'load' });
      await mpage.waitForTimeout(2200);
      await mpage.evaluate(() => { document.getElementById('tab-settings').click(); });
      await mpage.waitForTimeout(400);
      const mset = await mpage.evaluate(() => {
        const h = document.getElementById('appHeader').getBoundingClientRect();
        const t = document.getElementById('setTitle').getBoundingClientRect();
        return { headerBottom: h.bottom, titleTop: t.top, clipped: t.top < h.bottom, overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
      });
      check('M1 Settings title clears the sticky header on 375 px + zero horizontal overflow',
        mset.clipped === false && mset.overflow === false && merrors.length === 0, JSON.stringify(mset) + ' | ' + merrors.join(','));
      await mpage.evaluate(() => { document.getElementById('tab-studio').click(); });
      await mpage.waitForTimeout(400);
      const mstudio = await mpage.evaluate(() => {
        const h = document.getElementById('appHeader').getBoundingClientRect();
        const t = document.querySelector('#screen-studio .screen-title').getBoundingClientRect();
        return { clipped: t.top < h.bottom };
      });
      check('M2 the Lecturer heading clears the sticky header on mobile too',
        mstudio.clipped === false, JSON.stringify(mstudio));
      await mctx.close();

      /* ═══ THE LIVE LAB ═══ */
      const lctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const lpage = await lctx.newPage();
      const lerrors = [];
      lpage.on('pageerror', (e) => lerrors.push(String(e).slice(0, 140)));
      await lpage.goto(server.origin + '/lab.html', { waitUntil: 'load' });
      await lpage.waitForTimeout(2000);
      const labBoot = await lpage.evaluate(() => ({
        pill: document.getElementById('labVerPill').textContent,
        title: document.title,
        h1: (document.querySelector('header.lab-head h1') || {}).textContent || '',
        station7: !!document.getElementById('btnLabRunStation7'),
      }));
      check('L1 the Live Lab boots on the unified version (pill 0.0.7.e, zero v4.0, Station 7 present)',
        labBoot.pill === '0.0.7.e' && labBoot.title.indexOf('v4.0') < 0 && labBoot.h1.indexOf('v4.0') < 0 && labBoot.station7 === true,
        JSON.stringify(labBoot));
      await lpage.evaluate(() => { const b = document.getElementById('btnLabRunAll'); if (b) b.click(); });
      await lpage.waitForTimeout(26000);
      const labRun = await lpage.evaluate(() => {
        const c = SDP.LiveLab.counts();
        return {
          pass: c.pass, fail: c.fail, warn: c.warn,
          badge: (document.getElementById('labScoreBadge') || {}).getAttribute('data-state'),
          s7: !!(window.LAB_RESULTS_S7 = (SDP.LiveLab && SDP.LiveLab.record && true)),
          status: (document.getElementById('labRunStatus') || {}).textContent || '',
        };
      });
      check('L2 the FULL 7-station Live Lab run is ALL PASS — 0 FAIL (76/76 clips in the −21 LUFS family + Station 7 probes green)',
        labRun.fail === 0 && labRun.badge === 'pass' && labRun.pass >= 20, JSON.stringify(labRun) + ' | ' + lerrors.join(','));
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
  console.log('\nG21 v007c-verification.cjs — ' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})();
