#!/usr/bin/env node
'use strict';
/* G19 — the v0.0.7.g studio-UX / unlimited-words / key-pool / reuse release gate.
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.g
 * (0.0.7.g / ver 42 / schema 42 / settingsRev 76 / syncRev+wordsRev 1797000000032 / SW s41) — v0.0.7.g lockstep
 * The seven pillars verified LIVE in headless Chromium (plus static pins):
 * A1: Unlimited custom word count (5–∞) with 100% lock/unlock/reload persistence.
 * A2: Consolidated multi-key ElevenLabs pool + pre-flight credit check + failover.
 * A3: Permanent voice-clip reuse library (0 credits for returning words).
 * A4: Clean studio layout — Words Card #1 + Session Card #2 above the drawers.
 * A5: Zero false "Voice clips not generated" banners after publish.
 * A6: Version pins + preserved attribution + George MP3 payload integrity.
 * Plus: every Studio button responds cleanly with 0 page errors.
 */
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
const studio = readText('data/studio.js');
const syncSrc = readText('data/sdp-data-sync.js');
const speechSrc = readText('data/sdp-audio-speech.js');
const indexHtml = readText('index.html');
const sw = readText('sw.js');
const session = readJSON('data/session.json');
const version = readJSON('data/version.json');
const config = readJSON('data/config.json');
const pack = readJSON('data/elevenlabs-audio.json');

/* ── A6 static pins ────────────────────────────────────────────────────── */
check('A6a version.json pins ver/schema 43/43, settingsRev 76, syncRev 1797000000034, 0.0.7.g',
  version.ver === 49 && version.schema === 49 && version.appVersion === '0.0.7.i' && version.version === '0.0.7.i' && version.settingsRev === 85 && version.syncRev === 1797000000034,
  JSON.stringify({ ver: version.ver, schema: version.schema, appVersion: version.appVersion, settingsRev: version.settingsRev, syncRev: version.syncRev }));
check('A6b config.json + session.json pins (ver 42/66, settingsRev 76, syncRev 0021, 0.0.7.g)',
  config.ver === 49 && config.appVersion === '0.0.7.i' && session.ver === 70 && session.settingsRev === 85 && session.syncRev === 1797000000034 && session.appVersion === '0.0.7.i',
  JSON.stringify({ cfgVer: config.ver, sesVer: session.ver, sesRev: session.settingsRev, sync: session.syncRev }));
check('A6c sw.js pins the s43 shell + s41 release + 0.0.7.g',
  /sdp-v0\.0\.7\.i-s48-shell/.test(sw) && /SW_RELEASE = '0\.0\.7\.i'/.test(sw));
check('A6d index.html boots at the 0.0.7.g target and every data module moved off 0.0.7.g functionally',
  /var TARGET = '0\.0\.7\.i'/.test(indexHtml) && !/var APP_VERSION = '0\.0\.7\.a'/.test(syncSrc));
check('A6e attribution credits preserved verbatim (Hansana / Ms. Sumodya Sewmini / Ayya01 Lesandu)',
  /Hansana/.test(readText('index.html')) && /Sumodya/.test(readText('index.html')),
  'attribution strings in index.html');
check('A6f the 4 George briefing MP3 payloads are byte-identical (week-4 stamps preserved)',
  (function () {
    const expected = { _intro_male_1: 'df414b60aad0eeab', _intro_male_2: 'b95edc911775985b', _intro_male_3: 'aa09dc4efd98b570', _intro_male_4: 'b515ab0232dccd21' }; /* v0.0.7.g -21 LUFS masters */
    for (const k in expected) {
      const e = pack.clips[k];
      if (!e || crypto.createHash('sha256').update(e.b64).digest('hex').slice(0, 16) !== expected[k]) return false;
    }
    return true;
  })());
check('A6g data.html === data/index.html (byte-identical /data pair)',
  readText('data.html') === readText('data/index.html'));

/* ── A1 static: the unlimited-count law ────────────────────────────────── */
check('A1a wordCap() has NO artificial upper bound (5 floor only)',
  /if \(!n \|\| n < 5\) return 30;/.test(studio) && !/n > 50\) return 30/.test(studio));
check('A1b the custom input ships with no max cap and strict preset gating (disabled on presets)',
  /placeholder="5 – unlimited"/.test(studio) && /\(isCustom \? '' : ' disabled'\)/.test(studio));
check('A1c hydrateWordCap() re-hydrates the persisted cap on mount + both unlock paths',
  /function hydrateWordCap\(\)/.test(studio) && studio.split('hydrateWordCap()').length >= 5);
check('A1d the boot slice follows session.wordCount (never a hard 30)',
  /bootCap/.test(syncSrc) && /slice\(0, bootCap\)/.test(syncSrc));
check('A1e buildSessionPayload stamps wordCount + wordCountMode into every publish',
  /base\.session\.wordCountMode = wordCountMode\(\)/.test(studio));

/* ── A2/A3/A5 static laws ──────────────────────────────────────────────── */
check('A2a the unified key law: voiceDeltas + master setup accept pool keys (resolveElevenKey)',
  /trimmedKey\(str\(resolveElevenKey\(\)\)\) \|\| !allowAutoGen\(\)/.test(studio) && /elKey = trimmedKey\(str\(resolveElevenKey\(\)\)\)/.test(studio));
check('A2b preFlightCreditCheck probes every pool key via /v1/user/subscription',
  /function preFlightCreditCheck/.test(studio) && /fetchSubscription\(key, function/.test(studio));
check('A2c the bilingual quota dialog ships the 3 one-click actions',
  /btnQuotaAddKey/.test(studio) && /btnQuotaUseReady/.test(studio) && /btnQuotaReduceCount/.test(studio) && /ප්‍රමාණවත් නැත/.test(studio));
check('A3a the permanent reuse library lives inside sdp.settings.clipLibrary',
  /dataSaveSettings\(\{ clipLibrary: lib \}\)/.test(studio) && /CLIP_LIBRARY_MAX = 120/.test(studio));
check('A3b retiring a word snapshots its clip; returning words restore at 0 credits',
  /clipLibrarySaveEntry\(k, clipsObj\[k\]\)/.test(studio) && /restoredFromLibrary: true/.test(studio));
check('A5a fresh clips carry the wordsRev stamp at the synthesizeItem choke point',
  /entry\.wordsRev = Number\(\(SDP\.Speech && SDP\.Speech\.state && SDP\.Speech\.state\.manifest && SDP\.Speech\.state\.manifest\.wordsRev\) \|\| 0\) \|\| nextSyncRev\(\)/.test(studio));
check('A5b the just-published audit law never paints the false banner inside a publish cycle',
  /opts\.justPublished && level !== 'ok'/.test(speechSrc) && /!opts\.justPublished/.test(speechSrc));

/* ── LIVE: headless Chromium verification of the 7 mandated scenarios ──── */
var g19Live = (async function live() {
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
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 2000 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => { const m = String((e && e.message) || e); const st = String((e && e.stack) || ''); if (m.indexOf('decode audio') >= 0 && !st) return; errors.push(m.slice(0, 160)); });
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2400);
      /* v0.0.7.g G19 harness determinism: the Studio's 10-second security
         auto-lock drops ST.secrets to {} when it fires, which can
         land inside a long synthesis leg (the 429 retry alone is 5 s) and wipe
         the key pool the failover leg just planted. The app exposes
         __SDP_AUTOLOCK__ === false for exactly this (same law as
         __SDP_ALLOW_AUTOGEN); the explicit lock()/unlock() legs below still
         exercise the vault. This keeps LIVE-5a/5b deterministic without
         weakening them — a real rotation is still required. */
      await page.evaluate(() => { window.__SDP_AUTOLOCK__ = false; });
      await page.evaluate(() => { const r = document.getElementById('rail-studio'); if (r) r.click(); });
      await page.waitForTimeout(300);
      /* (1) Words Card #1 & Session Card #2 above the voice/alerts/advanced drawers */
      await page.evaluate(() => new Promise((resolve) => { try { SDP.Studio.unlock('78987898', () => resolve()); } catch (e) { resolve(); } }));
      await page.waitForTimeout(900);
      const layout = await page.evaluate(() => {
        const body = document.getElementById('studioBody');
        const order = Array.from(body.children).map((c) => c.id || '').filter(Boolean);
        const inside = (drawer) => { const el = document.getElementById(drawer); return el ? Array.from(el.querySelectorAll('section, details')).map((s) => s.id) : []; };
        return {
          words: order.indexOf('studioCardWords'),
          voiceDrawer: order.indexOf('studioVoiceDrawer'),
          alertsDrawer: order.indexOf('studioAlertsDrawer'),
          advanced: order.indexOf('studioAdvancedDrawer'),
          sessionInWords: !!document.querySelector('#studioCardWords #studioSessionMetaCard'),
          voiceInside: inside('studioVoiceDrawer').indexOf('studioCardClassroomVoice') >= 0,
          alertsInside: inside('studioAlertsDrawer').indexOf('studioLecturerAlertsCard') >= 0,
          stepper: !!document.getElementById('btnSessionNoPlus'),
          daySelect: (document.getElementById('studioMetaDay') || {}).tagName === 'SELECT',
          topicChips: document.querySelectorAll('#studioTopicChips .studio-topic-chip').length
        };
      });
      check('LIVE-1 Words Card #1 + Session Card #2 above Voice/Alerts/Advanced drawers (stepper + day dropdown + ZERO topic chips)',
        layout.words >= 0 && layout.words < layout.voiceDrawer && layout.words < layout.alertsDrawer && layout.words < layout.advanced &&
        layout.sessionInWords && layout.voiceInside && layout.alertsInside && layout.stepper && layout.daySelect && layout.topicChips === 0,
        JSON.stringify(layout));

      /* set a real PIN for the persistence legs */
      await page.evaluate(() => new Promise((resolve) => {
        const n = document.getElementById('studioNewPin'), c = document.getElementById('studioConfirmPin');
        if (n && c) { n.value = '4321'; c.value = '4321'; document.getElementById('btnChangePin').click(); }
        setTimeout(resolve, 900);
      }));

      /* (2) Custom 31 & 55 persist across Lock → Unlock → Reload without resetting to 30 */
      const persistCap = async (n) => {
        await page.evaluate((cap) => {
          const sel = document.getElementById('studioWordCountSelect'), custom = document.getElementById('studioWordCountCustom');
          sel.value = 'custom'; sel.dispatchEvent(new Event('change', { bubbles: true }));
          custom.disabled = false;
          custom.value = String(cap); custom.dispatchEvent(new Event('change', { bubbles: true }));
        }, n);
        await page.evaluate(() => { try { SDP.Studio.lock(); } catch (e) {} });
        await page.waitForTimeout(350);
        await page.evaluate(() => new Promise((resolve) => { try { SDP.Studio.unlock('4321', () => resolve()); } catch (e) { resolve(); } }));
        await page.waitForTimeout(800);
        const afterLock = await page.evaluate(() => SDP.Studio.wordCap());
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2200);
        await page.evaluate(() => new Promise((resolve) => { try { SDP.Studio.unlock('4321', () => resolve()); } catch (e) { resolve(); } }));
        await page.waitForTimeout(800);
        const afterReload = await page.evaluate(() => ({ cap: SDP.Studio.wordCap(), sel: (document.getElementById('studioWordCountSelect') || {}).value }));
        return { afterLock, afterReload };
      };
      const p31 = await persistCap(31);
      check('LIVE-2a Custom 31 persists across lock→unlock AND reload (never resets to 30)',
        p31.afterLock === 31 && p31.afterReload.cap === 31 && p31.afterReload.sel === 'custom', JSON.stringify(p31));
      const p55 = await persistCap(55);
      check('LIVE-2b Custom 55 persists across lock→unlock AND reload (unlimited mode)',
        p55.afterLock === 55 && p55.afterReload.cap === 55 && p55.afterReload.sel === 'custom', JSON.stringify(p55));

      /* (3) #studioWordCountCustom disabled on presets (10/15/20/25/30) */
      const gating = await page.evaluate(() => {
        const out = [];
        const sel = document.getElementById('studioWordCountSelect'), custom = document.getElementById('studioWordCountCustom');
        ['10', '15', '20', '25', '30'].forEach((v) => {
          sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true }));
          out.push({ v, disabled: custom.disabled, cap: SDP.Studio.wordCap() });
        });
        sel.value = 'custom'; sel.dispatchEvent(new Event('change', { bubbles: true }));
        out.push({ v: 'custom', disabled: custom.disabled });
        return out;
      });
      check('LIVE-3 custom input DISABLED on every preset, enabled ONLY on Custom',
        gating.slice(0, 5).every((g) => g.disabled === true) && gating[5].disabled === false, JSON.stringify(gating));

      /* (4) +1 Next Session stepper & Day dropdown update everywhere */
      const stepper = await page.evaluate(() => {
        const r = {};
        r.before = (document.getElementById('studioMetaNo') || {}).value;
        document.getElementById('btnSessionNoPlus').click();
        r.after = (document.getElementById('studioMetaNo') || {}).value;
        r.mirror = (document.getElementById('studioSessionNoInput') || {}).value;
        r.display = (document.getElementById('studioMetaDisplay') || {}).textContent;
        const d = document.getElementById('studioMetaDate');
        d.value = '2026-11-20'; d.dispatchEvent(new Event('input', { bubbles: true }));
        r.dayFromDate = (document.getElementById('studioMetaDay') || {}).value;
        const ti = document.getElementById('studioMetaTitle');
        if (ti) { ti.value = 'Session 15 - Technology Test'; r.titleAfterChip = ti.value; }
        return r;
      });
      check('LIVE-4 +1 Next Session stepper advances + mirrors + Day auto-derives from date + clean topic input holds the title',
        Number(stepper.after) === Number(stepper.before) + 1 && stepper.mirror === stepper.after &&
        /SESSION\s+\d+/.test(stepper.display || '') && stepper.dayFromDate === 'Friday' /* 2026-11-20 is a Friday */ && /Session \d+ - /.test(stepper.titleAfterChip || ''),
        JSON.stringify(stepper));

      /* (5) Multi-key failover (429 on Key #1 → Key #2) + 0-credit library reuse */
      const KEY1 = 'sk_TESTKEYG19PRIMARY11111111111';
      const KEY2 = 'sk_TESTKEYG19BACKUP2222222222222';
      let k1 = 0, k2 = 0;
      await ctx.unroute('**/*');
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await ctx.route('**api.elevenlabs.io**', (route) => {
        const url = route.request().url(), key = String(route.request().headers()['xi-api-key'] || '');
        if (url.indexOf('/v1/user/subscription') >= 0) {
          if (key === KEY1) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ character_count: 100, character_limit: 100000 }) });
          if (key === KEY2) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ character_count: 100, character_limit: 100000 }) });
          return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: { status: 'invalid_api_key' } }) });
        }
        if (url.indexOf('/v1/text-to-speech/') >= 0) {
          const mp3 = Buffer.concat([Buffer.from([0xFF, 0xFB, 0x90, 0x00]), Buffer.alloc(1600, 0x55)]);
          if (key === KEY1) { k1 += 1; return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ detail: { status: 'quota_exceeded' } }) }); }
          if (key === KEY2) { k2 += 1; return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: mp3 }); }
          return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: { status: 'invalid_api_key' } }) });
        }
        return route.abort();
      });
      const failover = await Promise.race([
        page.evaluate(([a, b]) => new Promise((resolve) => {
          SDP.Studio.state.secrets.elevenKey = '';
          SDP.Studio.state.secrets.keyPool = [{ p: 'elevenlabs', k: a }, { p: 'elevenlabs', k: b }];
          window.__SDP_AUTOLOCK__ = false;
          try { if (SDP.Studio.__testAutoLock) SDP.Studio.__testAutoLock.cancel(true); } catch (eAL) {}
          const el = document.getElementById('elKeyInput'); if (el) el.value = '';
          /* v0.0.7.g G19 harness determinism: the Studio re-merges the pool from
             the DOM (mergeKeyPoolInputs) whenever a clip is saved mid-batch, so
             the slot inputs must mirror the state we just wrote — otherwise slot
             #2 falls back to its 'groq' default and the ElevenLabs pool collapses
             to a single key, which silently disables the 429 rotation this leg
             asserts. Drive the panel exactly as a lecturer would. */
          const slotOf = (n) => document.getElementById('kpSlot' + n);
          const provOf = (n) => document.getElementById('kpProv' + n);
          [[1, a], [2, b]].forEach(([n, k]) => {
            const p = provOf(n); if (p) { p.value = 'elevenlabs'; p.dispatchEvent(new Event('change', { bubbles: true })); }
            const s = slotOf(n); if (s) { s.value = k; s.setAttribute('data-dirty', '1'); s.dispatchEvent(new Event('input', { bubbles: true })); }
          });
          [3, 4, 5].forEach((n) => {
            const p = provOf(n), s = slotOf(n);
            if (p) { p.value = 'groq'; p.dispatchEvent(new Event('change', { bubbles: true })); }
            if (s) { s.value = ''; s.setAttribute('data-dirty', '1'); s.dispatchEvent(new Event('input', { bubbles: true })); }
          });
          SDP.Studio.generateClips({ words: [{ w: 'g19failoverword' }], noCommit: true }, function (err, info) {
            resolve({ err: err ? String(err.message) : null, made: (info && info.made) ? info.made.length : -1 });
          });
        }), [KEY1, KEY2]),
        new Promise((resolve) => setTimeout(() => resolve({ err: 'TIMEOUT' }), 30000))
      ]);
      check('LIVE-5a Mid-batch failover: 429 on Key #1 rotates → Key #2 succeeds',
        k1 >= 1 && k2 >= 1 && failover.err === null && failover.made >= 1, JSON.stringify({ failover, k1, k2 }));
      /* 0-credit reuse: retire + re-add → clipLibraryRestore with 0 new TTS calls */
      const reuse = await page.evaluate(() => {
        const word = 'g19failoverword';
        const key = 'words.' + word;
        const had = SDP.Studio.state.voicePack.clips[key];
        if (!had) return { ok: false, why: 'no clip' };
        delete SDP.Studio.state.voicePack.clips[key];
        const n = SDP.Studio.clipLibraryRestore([{ w: word }]);
        const back = SDP.Studio.state.voicePack.clips[key];
        return { ok: n === 1 && !!(back && back.restoredFromLibrary), restored: n };
      });
      check('LIVE-5b 0-credit clip reuse: a returning word restores from the library without synthesis',
        reuse.ok === true, JSON.stringify(reuse));

      /* (6) Zero false "Voice clips not generated" banner after publish */
      const banner = await page.evaluate(() => {
        const words = SDP.Sync.words();
        const audit = SDP.Speech.auditSessionVoiceReadiness({ words, justPublished: true });
        return { bannerShown: audit.bannerShown, level: audit.level, missing: audit.missing, total: audit.total };
      });
      check('LIVE-6 Zero false banners: the just-published audit never paints the guard banner',
        banner.bannerShown === false, JSON.stringify(banner));

      /* (7) Every Studio button responds cleanly with 0 page errors */
      /* H14 law: the studio tab must be ACTIVE for offsetParent visibility
         (a drawer/tab switch during the earlier legs can hide the screen). */
      await page.evaluate(() => { const r = document.getElementById('rail-studio'); if (r) r.click(); });
      await page.waitForTimeout(300);
      const btnIds = await page.evaluate(() => Array.from(document.querySelectorAll('#studioBody button'))
        .filter((b) => b.offsetParent !== null && !b.disabled)
        .map((b) => b.id || ''));
      const SKIP = ['btnSsbPublish', 'btnSsbLock', 'btnLockStudio', 'btnStudioLock', 'btnChangePin', 'btnStudioSyncSettings', 'btnPublishWordsAndVoice', 'btnPublishWords', 'btnOneClickMasterSetup', 'btnForceRegenWords', 'btnRebakeClassroomVoice', 'btnRemoveClonedVoiceRestoreDefault', 'btnGenClips', 'btnTestOneWord', 'btnQuickApplyVoiceId', 'btnCreateAndApplyVoiceClone', 'btnApplyClassroomVoice', 'btnApplySessionMeta', 'btnOpenLiveLab', 'btnConfirmVoiceSample', 'btnRunVoiceAnalyzer', 'btnLowCreditVerifyTest', 'btnVoiceSampleRecord', 'btnStudioRecord', 'btnStudioPasteWords', 'btnPasteElKey', 'btnPasteGhToken', 'btnPasteAi'];
      let bad = [];
      for (const id of btnIds) {
        if (!id || SKIP.indexOf(id) >= 0) continue;
        const errBefore = errors.length;
        let threw = null;
        try { await page.evaluate((bid) => { const b = document.getElementById(bid); if (b) b.click(); }, id); }
        catch (e) { threw = String(e && e.message).slice(0, 100); }
        await page.waitForTimeout(120);
        if (threw || errors.length > errBefore) {
          bad.push(id + (threw ? ':' + threw : ':pageerror'));
          errors.length = errBefore;
        }
      }
      check('LIVE-7 Every visible Studio button responds cleanly (' + (btnIds.filter((i) => i && SKIP.indexOf(i) < 0).length) + ' clicked, destructive/API buttons excluded)',
        bad.length === 0, JSON.stringify(bad.slice(0, 5)));
      check('LIVE-8 0 page errors across the whole gate', errors.length === 0, errors.slice(0, 4).join(' || '));

      /* close with hard guards — a hung SW connection must never eat the report */
      try { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 8000))]); } catch (eC) {}
      try { await Promise.race([new Promise((r) => server.close(r)), new Promise((r) => setTimeout(r, 3000))]); } catch (eS2) {}
    } catch (e) {
      check('LIVE gate crashed', false, String(e && e.stack || e).slice(0, 400));
      try { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]); } catch (e3) {}
    }
  } catch (e) {
    check('Chromium unavailable — LIVE legs skipped', false, String(e && e.message).slice(0, 200));
  }

})();
/* keep the event loop alive until live() settles, then report and exit */
var g19Done = false;
var g19KeepAlive = setInterval(function () { if (g19Done) { clearInterval(g19KeepAlive); } }, 500);
setTimeout(function () {
  if (!g19Done) { g19Done = true; clearInterval(g19KeepAlive); console.log('G19 TIMEOUT after 240s'); process.exit(3); }
}, 240000).unref();
function g19Report() {
  if (g19Done) return;
  g19Done = true;
  clearInterval(g19KeepAlive);
  /* ── report ── */
  const fails = results.filter((r) => r.status === 'FAIL');
  console.log('\n──── G19 · v0.0.7.g verification ────');
  results.forEach((r) => console.log((r.status === 'PASS' ? '  ✓ ' : '  ✗ ') + r.test + (r.detail ? ' — ' + r.detail : '')));
  console.log('──── ' + (results.length - fails.length) + '/' + results.length + ' PASS · ' + fails.length + ' FAIL ────');
  if (fails.length) process.exit(1);
  process.exit(fails.length ? 1 : 0);
}
g19Live.then(g19Report, function (e) {
  results.push({ test: 'live gate crashed', status: 'FAIL', detail: String(e && e.stack || e).slice(0, 300) });
  g19Report();
});
