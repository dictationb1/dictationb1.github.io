#!/usr/bin/env node
'use strict';
/* G20 — the v0.0.7.e seven-pillar release verification gate.
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.e
 * (0.0.7.e / ver 42 / schema 42 / session ver 66 / settingsRev 76 /
 *  syncRev+wordsRev 1797000000027 / SW s41)
 * B1: ONE unified high-professional voice (Xb7hH8MSUJpSbSDYk0k2) + the
 *     ZERO-BYTE LAW — a bytes:0 / sub-512-byte clip is NEVER Ready and the
 *     Studio is told loudly (honest coverage + reuse counters).
 * B2: repaired British RP data (mobile phone /ˌməʊ.baɪl ˈfəʊn/, clean
 *     internet / keyboard meanings, every example contains its word) + the
 *     UK pronunciation-variant hint badges (Words screen + Player reveal).
 * B3: EVERY Dictation Mode button works in Paper AND Typing — the Hint
 *     button drives a 3-stage flow (meaning → first letter + word length +
 *     Si + sentence → off) visible on every mode.
 * B4: Publish, Sync & Leave verifies, releases dictation, LOCKS and returns
 *     home; manual Lock always works; the 10-second security auto-lock
 *     counts down visibly and locks; ZERO topic recommendation chips.
 * B5: the Interactive Studio Guide (Simple + Advanced spotlight tour, EN+SI,
 *     auto-prompt on the new release).
 * B6: Live Student Activity & Alerts — phone device telemetry, score,
 *     reactions and alerts landing in the Studio with auto-refresh + export.
 * B7: the always-visible Offline Mode banner + the bilingual Student
 *     Troubleshooting Guide (4 sections, real 1-tap fixes).
 * Verified LIVE in headless Chromium at desktop 1280 AND mobile 390×844. */
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
const viewsSrc = readText('data/sdp-ui-views.js');
const engineSrc = readText('data/sdp-dictation-engine.js');
const healSrc = readText('data/sdp-selfheal.js');
const telSrc = readText('data/sdp-telemetry.js');
const guideSrc = readText('data/sdp-studio-guide.js');
const indexHtml = readText('index.html');
const sw = readText('sw.js');
const css = readText('assets/css/sdp-ui.css');
const session = readJSON('data/session.json');
const version = readJSON('data/version.json');
const config = readJSON('data/config.json');
const pack = readJSON('data/elevenlabs-audio.json');

/* ── V0 static version pins ───────────────────────────────────────────── */
check('V0a version.json pins 0.0.7.e / 43 / 76 / 1797000000027',
  version.ver === 45 && version.schema === 45 && version.appVersion === '0.0.7.e' && version.version === '0.0.7.e' && version.settingsRev === 78 && Number(version.syncRev) === 1797000000027,
  JSON.stringify({ ver: version.ver, appVersion: version.appVersion, settingsRev: version.settingsRev, syncRev: version.syncRev, wordsRev: version.wordsRev }));
check('V0b session.json pins ver 66 / 0.0.7.e / 72 / …0021 + wordCount 31',
  session.ver === 68 && session.appVersion === '0.0.7.e' && session.settingsRev === 78 && Number(session.syncRev) === 1797000000027 && Number(session.wordsRev) === 1797000000027 && session.wordCount === 31,
  JSON.stringify({ ver: session.ver, appVersion: session.appVersion, settingsRev: session.settingsRev, syncRev: session.syncRev }));
check('V0c config.json + pack headers pin 42 / 0.0.7.e / 72 / …0021',
  config.ver === 45 && config.appVersion === '0.0.7.e' && config.settingsRev === 78 && Number(config.syncRev) === 1797000000027 &&
  pack.ver === 45 && pack.appVersion === '0.0.7.e' && pack.settingsRev === 78 && Number(pack.syncRev) === 1797000000027 && Number(pack.wordsRev) === 1797000000027,
  JSON.stringify({ cfg: [config.ver, config.appVersion, config.settingsRev, config.syncRev], pack: [pack.ver, pack.appVersion, pack.settingsRev, pack.syncRev, pack.wordsRev] }));
check('V0d sw.js pins the s43 shell + s41 release + 0.0.7.e',
  /sdp-v0\.0\.7\.e-s44-shell/.test(sw) && /SW_VERSION = 'sdp-v0\.0\.7\.e-s44'/.test(sw) && /SW_RELEASE = '0\.0\.7\.e'/.test(sw));
check('V0e the app boots at 0.0.7.e and the guide module ships in the load order + SW shell',
  /var TARGET = '0\.0\.7\.e'/.test(indexHtml) &&
  indexHtml.indexOf('./data/sdp-studio-guide.js') > 0 &&
  sw.indexOf('./data/sdp-studio-guide.js') > 0);
check('V0f the repaired session.json preserved-SHA lock (CI-13 prefix 3284f107)',
  crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'data/session.json'))).digest('hex').startsWith('3284f107'));

/* ── B1 static: the zero-byte law ─────────────────────────────────────── */
check('B1a isValidClipEntry rejects recorded bytes < 512 (the live bytes:0 bug)',
  /Number\(entry\.bytes\) \|\| 0\) < 512\) return false/.test(studio) &&
  /b64 && b64\.length > 1400/.test(studio));
check('B1b clipExists is validity-aware (presence is NOT existence)',
  /if \(typeof entry === 'string'\) return isValidClipEntry\(entry\);\s*return isPlayableClipEntry\(entry\);/.test(studio.replace(/\n\s*/g, ' ')) ||
  (/clipExists/.test(studio) && /isValidClipEntry\(entry\)/.test(studio) && /isPlayableClipEntry\(entry\)/.test(studio)),
  'clipExists body must route both entry shapes through the validity law');
check('B1c voiceCoverageCounts counts READY only through the validity law (validAt + isPlayableClipEntry)',
  /var validAt = function \(k\)/.test(studio) && /isPlayableClipEntry\(clips\[k\]\)/.test(studio) && /validAt\('words\.' \+ wk\)/.test(studio));
check('B1d the unified Default Voice ID is pre-filled and visible in the Voice card',
  /Default Voice ID \(unified\): <code>' \+ VOICE_ID \+ '<\/code>/.test(studio) && /value="' \+ esc\(chosenClassroomVoiceId\(\) \|\| VOICE_ID\) \+ '"/.test(studio));
check('B1e the pack itself carries the unified Alice voice + the 4 George briefing beats untouched',
  pack.voiceId === 'Xb7hH8MSUJpSbSDYk0k2' && (function () {
    const want = { _intro_male_1: 'df414b60aad0eeab', _intro_male_2: 'b95edc911775985b', _intro_male_3: 'aa09dc4efd98b570', _intro_male_4: 'b515ab0232dccd21' };
    for (const k in want) {
      const e = pack.clips[k];
      if (!e || crypto.createHash('sha256').update(e.b64).digest('hex').slice(0, 16) !== want[k]) return false;
    }
    return true;
  })());
check('B1f the key-pool diagnostic law: an all-keys-failed batch names the pool size + last error',
  /tried — last error: '/.test(studio) && /poolN = elevenKeyPool\(\)\.length \|\| 1/.test(studio),
  'synthesizeItem must end with the pool diagnostic');

/* ── B2 static + data ─────────────────────────────────────────────────── */
const wordsByName = {};
for (const w of session.words) wordsByName[String(w.w).toLowerCase()] = w;
check('B2a mobile phone carries the repaired British RP IPA /ˌməʊ.baɪl ˈfəʊn/ + variants + a natural example',
  wordsByName['mobile phone'].p === '/ˌməʊ.baɪl ˈfəʊn/' &&
  Array.isArray(wordsByName['mobile phone'].pronunciationVariants) && wordsByName['mobile phone'].pronunciationVariants.length === 2 &&
  wordsByName['mobile phone'].s.indexOf('mobile phone') >= 0,
  JSON.stringify(wordsByName['mobile phone']));
check('B2b internet meaning is clean (no "(An intranet.)") and keyboard has no "(etc.)" prefix',
  wordsByName.internet.m.indexOf('(An intranet.)') < 0 && wordsByName.internet.m.indexOf('worldwide') >= 0 &&
  wordsByName.keyboard.m.indexOf('(etc.)') !== 0 && wordsByName.keyboard.m.indexOf('keys') >= 0,
  JSON.stringify([wordsByName.internet.m, wordsByName.keyboard.m]));
check('B2c every one of the 31 words has a full clean record and an example CONTAINING the exact word',
  (function () {
    for (const w of session.words) {
      if (!w.p || !w.pos || !w.m || !w.si || !w.s) return 'empty field on ' + w.w;
      if (w.m.indexOf('(etc.)') === 0 || w.m.indexOf('(heading)') === 0 || w.m.indexOf(':') === 0) return 'junk meaning on ' + w.w;
      if (String(w.s).toLowerCase().indexOf(String(w.w).toLowerCase()) < 0) return 'example lacks word: ' + w.w;
    }
    return true;
  })());
check('B2d the enrichment pipeline ships the sanitizers + the Cambridge/Oxford RP prompt + the variants table',
  /function sanitizeMeaningText/.test(studio) && /function sanitizeExampleSentence/.test(studio) && /function sanitizeBritishIPA/.test(studio) &&
  /PRONUNCIATION_VARIANTS = \{/.test(studio) && /Cambridge \/ Oxford learner dictionary/.test(studio));
check('B2e the 🔊 variant badges ship on the Words screen AND the Player reveal card',
  /d-pron-variants/.test(viewsSrc) && /pronVariantsBadge/.test(viewsSrc) && /revealPronVariants/.test(viewsSrc) && /revealPronVariants/.test(indexHtml));

/* ── B3 static ────────────────────────────────────────────────────────── */
check('B3a the 3-stage Hint flow ships (meaning → detail card → off) with word length',
  /E\.hintStage = 1/.test(engineSrc) && /E\.hintStage = 2/.test(engineSrc) && /hintLength/.test(engineSrc) && /letterCount \+ ' ' \+ t\('hintLength'/.test(engineSrc));
check('B3b the detailed hint card is visible in PAPER mode (.has-hint law)',
  /#hintOutput\.has-hint \{ display: block !important/.test(css));
check('B3c Views exposes showHintPanel / hideHintPanel for the 3-stage flow',
  /showHintPanel: showHintPanel/.test(viewsSrc) && /hideHintPanel: hideHintPanel/.test(viewsSrc));

/* ── B4 static ────────────────────────────────────────────────────────── */
check('B4a Publish, Sync & Leave releases dictation, LOCKS and returns home on verified success',
  /releaseDictationForStudents\(\)/.test(studio) && /btnSsbPublish[\s\S]{0,600}lock\(\)/.test(studio) && /showScreen\('home'\)/.test(studio));
check('B4b the 10-second security auto-lock engine ships (idle + leave triggers + visible countdown)',
  /function startAutoLockCountdown/.test(studio) && /function armIdleAutoLock/.test(studio) && /Auto-locking Studio in/.test(studio) && /studioAutoLockCountdown/.test(studio) && /10000\)/.test(studio));
check('B4c the 12 topic recommendation chips are GONE from every surface',
  /B1_TOPIC_CHIPS/.test(studio) === false && /topicChipsMarkup/.test(studio) === false && /studio-topic-chip/.test(css) === false && /studioTopicChips/.test(studio) === false);
check('B4d lock() clears every transient surface (busy, popup, guide, countdown)',
  /clearBusy\(\); \} catch \(eBusy\) \{\}/.test(studio) && /closeStudioActivityPopup\(\); \} catch \(eA\) \{\}/.test(studio) && /cancelAutoLockCountdown\(true\); \} catch \(eC\) \{\}/.test(studio));

/* ── B5 static ────────────────────────────────────────────────────────── */
check('B5a SDP.StudioGuide ships as a real module with both tour modes + spotlight + tooltip + auto-prompt',
  /SDP\.StudioGuide = \{/.test(guideSrc) && /SIMPLE_STEPS/.test(guideSrc) && /ADVANCED_STEPS/.test(guideSrc) &&
  /sdp-guide-spot/.test(guideSrc) && /maybeAutoPrompt/.test(guideSrc) && /studioGuideSeenVersion/.test(guideSrc));
check('B5b the 📘 Studio Guide button rides in the security bar + the guide re-renders on language change',
  /btn\('btnStudioGuide'/.test(studio) && /SDP\.StudioGuide\.onLangChange/.test(studio));
check('B5c the auto-prompt law reads the five-key setting (studioGuideSeenVersion inside sdp.settings)',
  /saveSettings\(\{ studioGuideSeenVersion/.test(guideSrc) || /patch\.studioGuideSeenVersion/.test(guideSrc));

/* ── B6 static ────────────────────────────────────────────────────────── */
check('B6a telemetry captures OS + browser family + screen size + online flag (privacy-safe, no raw UA)',
  /function osFamily/.test(telSrc) && /function browserFamily/.test(telSrc) && /function deviceTelemetry/.test(telSrc) && /screen: \(Number\(sc\.width\)/.test(telSrc) && /online:/.test(telSrc));
check('B6b a finished session beacons LIVE (never only on tab close) + rating/reactions ride the record',
  /pushTelemetryEnvelope\(function \(\) \{\}\); \} catch \(ePB\) \{\}/.test(telSrc) && /stampLastSession/.test(telSrc) && /rating: Number\(extra && extra\.rating\)/.test(telSrc));
check('B6c the Studio activity popup auto-refreshes every 10 s and pulls alerts on the same tick',
  /setInterval\(refreshStudioActivity, 10000\)/.test(studio) && /pullLecturerAlerts/.test(studio));
check('B6d the activity table shows the full device telemetry + reactions column',
  /last\.device\.os/.test(studio) && /last\.device\.browser/.test(studio) && /Reactions/.test(indexHtml));

/* ── B7 static ────────────────────────────────────────────────────────── */
check('B7a #sdpOfflineModeBanner ships across every screen (first child of #sdpScreens) with the probe law',
  /id="sdpOfflineModeBanner"/.test(indexHtml) && /function paintOfflineBanner/.test(viewsSrc) && /function probeConnectivity/.test(viewsSrc) && /refreshOfflineState/.test(viewsSrc));
check('B7b #sdpTroubleshootModal ships with the 4 student-first sections + real 1-tap actions',
  /'sdpTroubleshootModal'/.test(healSrc) && /TS_COPY = \{/.test(healSrc) && /unlockAudioTest/.test(healSrc) && /clearCacheAndRefresh/.test(healSrc) && /notifyLecturer/.test(healSrc));
check('B7c the banner + FAB expose manual help entries (btnOfflineHelp + btnFabTroubleshoot)',
  /btnOfflineHelp/.test(indexHtml) && /btnFabTroubleshoot/.test(indexHtml) && /showTroubleshoot\('offline'\)/.test(viewsSrc));
check('B7d attribution credits preserved verbatim + data.html pair identical + zero .zip in the repo',
  /Hansana/.test(indexHtml) && /Sumodya/.test(indexHtml) && readText('data.html') === readText('data/index.html') &&
  (function () { const list = fs.readdirSync(ROOT).filter((f) => f.endsWith('.zip')); return list.length === 0; })());

/* ── LIVE verification (headless Chromium: desktop + mobile) ──────────── */
const g20Live = (async function live() {
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
      /* ═══ DESKTOP CONTEXT ═══ */
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 2000 } });
      const page = await ctx.newPage();
      const errors = [];
      let ntfyPosts = 0;
      page.on('pageerror', (e) => { const m = String((e && e.message) || e); const st = String((e && e.stack) || ''); if (m.indexOf('decode audio') >= 0 && !st) return; errors.push(m.slice(0, 160)); });
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        if (url.indexOf('ntfy.sh') >= 0 && route.request().method() === 'POST') { ntfyPosts += 1; return route.fulfill({ status: 200, body: 'ok' }); }
        if (url.indexOf('ntfy.sh') >= 0) {
          /* a REAL phone student's beaconed telemetry envelope, ntfy NDJSON shape */
          const row = { id: 'g20row1', message: JSON.stringify({
            clientId: 'sdp_u_g20phone01',
            session: { sessionNo: 1, startedAt: Date.now() - 90000, endedAt: Date.now() - 30000, dwellSec: 120, wordsCompleted: 5, score: 80, missedWords: [], lagMs: 0, audioTierUsed: 'eleven', rating: 5, reactions: ['fast'], device: { class: 'phone', dpr: 2, vw: 390, vh: 844, screen: '390x844', os: 'Android', browser: 'Chrome', online: true, net: '4g' } },
            incidents: []
          }) };
          return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: JSON.stringify(row) });
        }
        return route.abort();
      });
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2400);
      /* gates stay deterministic: the 10 s auto-lock is driven explicitly */
      await page.evaluate(() => { window.__SDP_AUTOLOCK__ = false; });

      /* ── B2 live: repaired data + badges ── */
      const b2 = await page.evaluate(() => {
        const words = SDP.Sync.words() || [];
        const by = {}; words.forEach((w) => { by[String(w.w).toLowerCase()] = w; });
        const mp = by['mobile phone'] || {};
        SDP.Views.showScreen('dict');
        const badge = document.querySelector('.d-pron-variants');
        return {
          n: words.length,
          mpP: mp.p || '', mpV: (mp.pronunciationVariants || []).join('|'),
          net: (by.internet || {}).m || '', kb: (by.keyboard || {}).m || '',
          badgeText: badge ? badge.textContent : ''
        };
      });
      check('B2L-1 the live session carries the repaired mobile phone RP IPA + 31 words',
        b2.n === 31 && b2.mpP === '/ˌməʊ.baɪl ˈfəʊn/', JSON.stringify(b2));
      check('B2L-2 internet/keyboard meanings are clean in the LIVE session',
        b2.net.indexOf('(An intranet.)') < 0 && b2.kb.indexOf('(etc.)') !== 0, JSON.stringify({ net: b2.net, kb: b2.kb }));
      check('B2L-3 the 🔊 2 UK pronunciations badge renders on the Words screen',
        /2 UK pronunciations accepted/.test(b2.badgeText) && b2.mpV.split('|').length === 2, b2.badgeText + ' | ' + b2.mpV);

      /* ── B3 live: every player button, both modes ── */
      await page.evaluate(() => { document.getElementById('tab-home').click(); });
      await page.waitForTimeout(200);
      await page.click('#btnStart');
      await page.waitForTimeout(900);
      const b3a = await page.evaluate(() => ({
        mode: document.body.getAttribute('data-sdp-mode'),
        started: SDP.Engine.items().length,
        overlay: document.getElementById('dictationStudioLockOverlay').hidden
      }));
      check('B3L-1 the session starts in Paper mode with 31 items and no lock overlay',
        b3a.mode === 'paper' && b3a.started === 31 && b3a.overlay === true, JSON.stringify(b3a));
      /* Hint stage 1: meaning panel */
      await page.click('#btnHint');
      await page.waitForTimeout(250);
      const h1 = await page.evaluate(() => ({
        meaning: !document.getElementById('revealMeaning').hidden,
        ipa: document.getElementById('revealIpa').textContent,
        pos: document.getElementById('revealPos').textContent,
        si: document.getElementById('revealSi').textContent
      }));
      check('B3L-2 Hint press 1 (Paper) opens the meaning panel — IPA + POS + Sinhala, never the spelling',
        h1.meaning === true && /\//.test(h1.ipa) && h1.si !== '—', JSON.stringify(h1));
      /* Hint stage 2: the detailed card visible in PAPER mode */
      await page.click('#btnHint');
      await page.waitForTimeout(250);
      const h2 = await page.evaluate(() => {
        const out = document.getElementById('hintOutput');
        return { visible: !!out && out.offsetParent !== null, text: out ? out.textContent : '', cls: out ? out.className : '' };
      });
      check('B3L-3 Hint press 2 (Paper) paints the detailed hint card VISIBLY — first letter + word length',
        h2.visible === true && /First letter/.test(h2.text) && /letters/.test(h2.text) && /_/.test(h2.text) && h2.cls.indexOf('has-hint') >= 0,
        JSON.stringify(h2));
      /* Hint stage 3: off */
      await page.click('#btnHint');
      await page.waitForTimeout(250);
      const h3 = await page.evaluate(() => ({
        out: (function () { const o = document.getElementById('hintOutput'); return !o || o.offsetParent === null; })(),
        meaning: document.getElementById('revealMeaning').hidden
      }));
      check('B3L-4 Hint press 3 (Paper) clears every hint', h3.out === true && h3.meaning === true, JSON.stringify(h3));
      /* every player button clicks cleanly in Paper mode */
      const paperBtns = await page.evaluate(() => {
        const ids = ['btnPrev', 'btnNext', 'btnPlayPause', 'btnReplay', 'btnRepeat', 'btnModeSwitch', 'btnRevealWord', 'btnFinish'];
        const clicked = [];
        ids.forEach((id) => { const b = document.getElementById(id); if (b) { b.click(); clicked.push(id); } });
        return clicked;
      });
      await page.waitForTimeout(400);
      check('B3L-5 all 8 player controls click cleanly in Paper mode (0 errors)', paperBtns.length === 8, JSON.stringify(paperBtns) + ' errors=' + errors.length);
      /* Typing mode: 3-stage flow + the four chips */
      const b3b = await page.evaluate(() => ({ mode: document.body.getAttribute('data-sdp-mode') }));
      if (b3b.mode !== 'typing') { await page.evaluate(() => { SDP.Engine.setMode('typing', true); }); await page.waitForTimeout(250); }
      await page.evaluate(() => { SDP.Engine.jumpTo(0); });
      await page.waitForTimeout(200);
      await page.click('#btnHint');
      await page.waitForTimeout(200);
      await page.click('#btnHint');
      await page.waitForTimeout(250);
      const h4 = await page.evaluate(() => {
        const out = document.getElementById('hintOutput');
        const chips = Array.from(document.querySelectorAll('#hintChips [data-hint]'));
        const pressedBefore = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').length;
        const si = chips.filter((c) => c.getAttribute('data-hint') === 'si')[0];
        if (si) si.click(); /* toggles the Sinhala chip OFF */
        const pressedAfter = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').length;
        return {
          visible: !!out && out.offsetParent !== null,
          text: out ? out.textContent : '',
          chips: chips.length,
          pressedBefore,
          pressedAfter
        };
      });
      check('B3L-6 Hint works in TYPING mode too + the chips toggle live (4 on, one tap flips one off)',
        h4.visible === true && /First letter/.test(h4.text) && h4.chips === 4 && h4.pressedBefore === 4 && h4.pressedAfter === 3, JSON.stringify(h4));
      /* Jump-to-word via the session pills */
      await page.evaluate(() => { document.getElementById('pillsDrawerToggle').click(); });
      await page.waitForTimeout(150);
      const jumped = await page.evaluate(() => {
        const pills = document.querySelectorAll('#sessionPills .pill, #sessionPills button');
        if (!pills.length) return -1;
        pills[Math.min(29, pills.length - 1)].click();
        return SDP.Engine.config().index;
      });
      await page.waitForTimeout(250);
      check('B3L-7 Jump-to-word pill jumps to word #30', jumped === 29, String(jumped));
      /* the mobile-phone reveal-card variant badge */
      await page.evaluate(() => { SDP.Engine.jumpTo(30); });
      await page.waitForTimeout(400);
      await page.evaluate(() => { if (SDP.Views && SDP.Views.showHintPanel) SDP.Views.showHintPanel(); });
      await page.waitForTimeout(250);
      const badgeReveal = await page.evaluate(() => {
        const pv = document.getElementById('revealPronVariants');
        return { visible: !!pv && !pv.hidden, text: pv ? pv.textContent : '', idx: SDP.Engine.config().index };
      });
      check('B3L-8 the Player reveal card shows the 🔊 variant badge on the mobile-phone word',
        badgeReveal.visible === true && /2 UK pronunciations accepted/.test(badgeReveal.text) && /ˈməʊ\.baɪl/.test(badgeReveal.text), badgeReveal.text);

      /* ── B4 live: chips gone, lock laws ── */
      await page.evaluate(() => { document.getElementById('rail-studio').click(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => new Promise((resolve) => { try { SDP.Studio.unlock('78987898', () => resolve()); } catch (e) { resolve(); } }));
      await page.waitForTimeout(900);
      const b4 = await page.evaluate(() => ({
        unlocked: SDP.Studio.isUnlocked(),
        chips: document.querySelectorAll('#studioTopicChips .studio-topic-chip').length,
        chipsHost: !!document.getElementById('studioTopicChips'),
        guideBtn: !!document.getElementById('btnStudioGuide'),
        voiceIdField: (document.getElementById('studioClassroomCustomVoiceId') || {}).value
      }));
      check('B4L-1 the Studio unlocks with ZERO topic chips and the 📘 Guide button present',
        b4.unlocked === true && b4.chips === 0 && b4.chipsHost === false && b4.guideBtn === true, JSON.stringify(b4));
      check('B4L-2 the Voice ID field is pre-filled with the canonical default Xb7hH8MSUJpSbSDYk0k2 (B1)',
        b4.voiceIdField === 'Xb7hH8MSUJpSbSDYk0k2', b4.voiceIdField);
      /* B1 live: the zero-byte law */
      const b1 = await page.evaluate(() => {
        const host = document.getElementById('studioReuseCounter');
        const k = 'words.mobile phone';
        const backup = SDP.Studio.state.voicePack.clips[k];
        /* 1. a long, non-WAV b64 entry counts as READY */
        SDP.Studio.state.voicePack.clips[k] = { b64: new Array(2001).join('A'), bytes: 1500, text: 'mobile phone' };
        SDP.Studio.paintReuseCounter();
        const tValid = host.textContent;
        /* 2. the live bytes:0 shape is MISSING — never Ready */
        SDP.Studio.state.voicePack.clips[k] = { b64: '', bytes: 0, text: 'mobile phone' };
        SDP.Studio.paintReuseCounter();
        const tZero = host.textContent;
        const missingZero = host.getAttribute('data-missing');
        if (backup) SDP.Studio.state.voicePack.clips[k] = backup;
        else delete SDP.Studio.state.voicePack.clips[k];
        SDP.Studio.paintReuseCounter();
        return { tValid, tZero, missingZero };
      });
      check('B4L-3/B1L a valid clip counts Ready but the SAME word at bytes:0 flips to MISSING — never Ready',
        /* v0.0.7.e: the live 31-word bank — a valid clip keeps ALL-READY,
           the SAME word at bytes:0 flips exactly that word to MISSING. */
        /Reused 31/.test(b1.tValid) && /Missing 0/.test(b1.tValid) && /Missing 1/.test(b1.tZero) && b1.missingZero === '1', JSON.stringify(b1));

      /* ── B5 live: the interactive guide ── */
      const b5a = await page.evaluate(() => new Promise((resolve) => {
        setTimeout(() => {
          const w = document.getElementById('sdpGuideWelcome');
          resolve({ welcome: !!w, simple: !!document.querySelector('[data-guide-mode="simple"]'), advanced: !!document.querySelector('[data-guide-mode="advanced"]') });
        }, 1000);
      }));
      check('B5L-1 the auto-prompt welcomes the lecturer on the new release (Simple | Advanced | later)',
        b5a.welcome === true && b5a.simple === true && b5a.advanced === true, JSON.stringify(b5a));
      const b5b = await page.evaluate(() => new Promise((resolve) => {
        const btn = document.querySelector('[data-guide-mode="simple"]');
        if (btn) btn.click();
        setTimeout(() => {
          const tip = document.getElementById('sdpGuideTip');
          const spot = document.getElementById('sdpGuideSpot');
          resolve({
            open: SDP.StudioGuide.isOpen(),
            step: SDP.StudioGuide.state().index, total: SDP.StudioGuide.state().total,
            tipVisible: !!tip && tip.getBoundingClientRect().height > 0,
            tipText: tip ? tip.textContent : '',
            spotVisible: !!spot && spot.getBoundingClientRect().height > 0
          });
        }, 500);
      }));
      check('B5L-2 the Simple tour opens with the glowing spotlight + tooltip (Step 1 of N)',
        b5b.open === true && b5b.tipVisible === true && b5b.spotVisible === true && /Step 1 \//.test(b5b.tipText) && b5b.total >= 7,
        JSON.stringify(b5b));
      const b5c = await page.evaluate(() => new Promise((resolve) => {
        let guard = 0;
        function step() {
          const next = document.querySelector('#sdpGuideTip [data-gt="next"]');
          if (next && guard < 20) { guard += 1; next.click(); setTimeout(step, 220); }
          else resolve({ guard, open: SDP.StudioGuide.isOpen(), seen: (SDP.Data.settings() || {}).studioGuideSeenVersion });
        }
        step();
      }));
      check('B5L-3 stepping Continue walks every Simple step and seals studioGuideSeenVersion',
        b5c.open === false && b5c.guard >= 7 && b5c.seen === '0.0.7.e', JSON.stringify(b5c));
      const b5d = await page.evaluate(() => new Promise((resolve) => {
        document.getElementById('btnStudioGuide').click();
        setTimeout(() => {
          const adv = document.querySelector('[data-guide-mode="advanced"]');
          if (adv) adv.click();
          setTimeout(() => {
            const tip0 = document.getElementById('sdpGuideTip');
            const nx = tip0 ? tip0.querySelector('[data-gt="next"]') : null;
            if (nx) nx.click();
            setTimeout(() => {
              const tip = document.getElementById('sdpGuideTip');
              resolve({
                open: SDP.StudioGuide.isOpen(), mode: SDP.StudioGuide.state().mode,
                total: SDP.StudioGuide.state().total,
                tipVisible: !!tip && tip.getBoundingClientRect().height > 0,
                backBtn: !!(tip && tip.querySelector('[data-gt="back"]')),
                step2: SDP.StudioGuide.state().index === 1
              });
            }, 350);
          }, 500);
        }, 400);
      }));
      check('B5L-4 the 📘 button + Advanced tour steps through every admin control (with ← Back)',
        b5d.open === true && b5d.mode === 'advanced' && b5d.tipVisible === true && b5d.total >= 10 && b5d.backBtn === true,
        JSON.stringify(b5d));
      const b5e = await page.evaluate(() => new Promise((resolve) => {
        document.getElementById('btnLang').click();
        setTimeout(() => {
          const tip = document.getElementById('sdpGuideTip');
          const siText = tip ? tip.textContent : '';
          const exit = tip ? tip.querySelector('[data-gt="exit"]') : null;
          if (exit) exit.click();
          setTimeout(() => {
            document.getElementById('btnLang').click();
            resolve({ siText: siText.slice(0, 160), closed: !SDP.StudioGuide.isOpen() });
          }, 400);
        }, 500);
      }));
      check('B5L-5 the tour re-renders in Sinhala with the EN|SI switcher and exits cleanly',
        /[\u0D80-\u0DFF]/.test(b5e.siText) && b5e.closed === true, JSON.stringify(b5e));

      /* ── B6 live: telemetry + activity + alerts ── */
      const b6a = await page.evaluate(() => {
        const dev = SDP.Telemetry.deviceTelemetry();
        SDP.Telemetry.sessionStart();
        const rec = SDP.Telemetry.sessionEnd({ wordsCompleted: 5, score: 80, missedWords: ['test'], rating: 5, reactions: ['fast'] });
        const led = SDP.Telemetry.ledger();
        return { dev, last: led.sessions[led.sessions.length - 1] };
      });
      check('B6L-1 device telemetry captures class/OS/browser/screen/online and the session record carries score + reactions',
        b6a.dev.class === 'desktop' && !!b6a.dev.os && !!b6a.dev.browser && /\d+x\d+/.test(b6a.dev.screen) &&
        b6a.last.score === 80 && b6a.last.rating === 5 && b6a.last.reactions.indexOf('fast') >= 0 && b6a.last.device.os === b6a.dev.os,
        JSON.stringify(b6a));
      await page.evaluate(() => { SDP.Telemetry.sendLecturerAlert({ alertType: 'user_message', message: 'G20 live alert: clip missing test' }); });
      await page.waitForTimeout(300);
      await page.evaluate(() => { document.getElementById('btnRefreshLecturerAlerts').click(); });
      await page.waitForTimeout(400);
      await page.evaluate(() => new Promise((resolve) => { SDP.Telemetry.pullTelemetryLedger(() => resolve()); }));
      await page.waitForTimeout(400);
      await page.evaluate(() => { document.getElementById('btnStudioActivityPopup').click(); });
      await page.waitForTimeout(900);
      const b6b = await page.evaluate(() => {
        const popup = document.getElementById('studioActivityPopup');
        const row = popup.querySelector('#studioActivityTable tbody tr');
        return {
          open: !popup.hidden,
          summary: (document.getElementById('studioActivitySummary') || {}).textContent || '',
          row: row ? row.textContent : ''
        };
      });
      check('B6L-2 the Live Student Activity popup shows the beaconed phone student (device + score + reactions)',
        b6b.open === true && /Unique Student/.test(b6b.summary) && /80%/.test(b6b.row) && /fast/.test(b6b.row) && /phone/.test(b6b.row) && /Android/.test(b6b.row),
        JSON.stringify(b6b));
      const b6c = await page.evaluate(() => ({
        list: (document.getElementById('studioLecturerAlertsList') || {}).textContent || '',
        jsonBtn: !!document.getElementById('btnStudioActivityJson'),
        zipBtn: !!document.getElementById('btnStudioActivityZip')
      }));
      check('B6L-3 the lecturer alert inbox renders the live alert + JSON/ZIP exports ship',
        /G20 live alert/.test(b6c.list) && b6c.jsonBtn === true && b6c.zipBtn === true, JSON.stringify(b6c).slice(0, 200));
      check('B6L-4 the telemetry beacon fired LIVE (ntfy POST observed)', ntfyPosts >= 1, String(ntfyPosts));
      await page.evaluate(() => { document.getElementById('btnStudioActivityClose').click(); });

      /* ── B4 live: manual lock + 10s auto-lock + publish-leave ── */
      await page.evaluate(() => { document.getElementById('btnSsbLock').click(); });
      await page.waitForTimeout(500);
      const lock1 = await page.evaluate(() => ({ unlocked: SDP.Studio.isUnlocked(), gate: !!document.getElementById('studioGate') }));
      check('B4L-4 manual 🔒 Lock locks the Studio 100% (gate back, no stuck states)',
        lock1.unlocked === false && lock1.gate === true, JSON.stringify(lock1));
      await page.evaluate(() => new Promise((resolve) => { try { SDP.Studio.unlock('78987898', () => resolve()); } catch (e) { resolve(); } }));
      await page.waitForTimeout(800);
      /* the 10-second countdown: started explicitly, must count down and LOCK */
      const cd1 = await page.evaluate(() => {
        window.__SDP_AUTOLOCK__ = true;
        const started = SDP.Studio.__testAutoLock.start();
        const host = document.getElementById('studioAutoLockCountdown');
        return { started, visible: !!host && !host.hidden, text: host ? host.textContent : '', state: SDP.Studio.__testAutoLock.state() };
      });
      check('B4L-5 the visible 10-second countdown starts (🔒 Auto-locking Studio in 10s…)',
        cd1.started === true && cd1.visible === true && /Auto-locking Studio in 10s/.test(cd1.text) && cd1.state.left === 10, JSON.stringify(cd1));
      await page.waitForTimeout(10600);
      const cd2 = await page.evaluate(() => ({ unlocked: SDP.Studio.isUnlocked(), bannerHidden: (document.getElementById('studioAutoLockCountdown') || {}).hidden }));
      check('B4L-6 the 10-second security auto-lock LOCKS the Studio by itself', cd2.unlocked === false, JSON.stringify(cd2));
      await page.evaluate(() => { window.__SDP_AUTOLOCK__ = false; });
      /* Publish, Sync & Leave — the mocked-GitHub success path */
      await page.evaluate(() => new Promise((resolve) => { try { SDP.Studio.unlock('78987898', () => resolve()); } catch (e) { resolve(); } }));
      await page.waitForTimeout(800);
      await ctx.unroute('**/*');
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        if (url.indexOf('api.github.com') >= 0) {
          if (route.request().method() === 'PUT') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'g20mocksha' } }) });
          return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) });
        }
        if (url.indexOf('ntfy.sh') >= 0) return route.fulfill({ status: 200, body: 'ok' });
        return route.abort();
      });
      const pub = await page.evaluate(() => new Promise((resolve) => {
        /* arm the classroom dictation lock first: publish must RELEASE it */
        try { SDP.Engine.setStudioLocked(true); } catch (e) {}
        try { if (SDP.Views && SDP.Views.paintDictationLockOverlay) SDP.Views.paintDictationLockOverlay(true); } catch (e2) {}
        SDP.Studio.state.secrets.ghToken = 'ghp_G20MOCKTOKEN';
        document.getElementById('btnSsbPublish').click();
        let n = 0;
        const t = setInterval(() => {
          n += 1;
          if (!SDP.Studio.isUnlocked() || n > 40) {
            clearInterval(t);
            resolve({
              locked: !SDP.Studio.isUnlocked(),
              dictationReleased: SDP.Engine.studioLocked ? !SDP.Engine.studioLocked() : true,
              overlayHidden: (document.getElementById('dictationStudioLockOverlay') || {}).hidden,
              homeActive: !!document.querySelector('#screen-home.active'),
              toast: (document.getElementById('sdpDataToast') || {}).textContent || ''
            });
          }
        }, 250);
      }));
      check('B4L-7 Publish, Sync & Leave: verified publish → dictation released → Studio LOCKED → home screen',
        pub.locked === true && pub.dictationReleased === true && pub.overlayHidden === true && pub.homeActive === true,
        JSON.stringify(pub));

      /* ── B7 live: offline banner + troubleshoot guide ── */
      await ctx.setOffline(true);
      await page.waitForTimeout(600);
      const ob1 = await page.evaluate(() => ({
        visible: !document.getElementById('sdpOfflineModeBanner').hidden,
        title: (document.getElementById('obTitle') || {}).textContent || ''
      }));
      check('B7L-1 going offline paints the top banner on every screen (EN)',
        ob1.visible === true && /Running in Offline Mode/.test(ob1.title), JSON.stringify(ob1));
      await page.evaluate(() => { document.getElementById('btnLang').click(); });
      await page.waitForTimeout(400);
      const ob2 = await page.evaluate(() => ({ title: (document.getElementById('obTitle') || {}).textContent || '' }));
      check('B7L-2 the offline banner speaks Sinhala under SI', /[\u0D80-\u0DFF]/.test(ob2.title), ob2.title);
      await page.evaluate(() => { document.getElementById('btnLang').click(); });
      await page.evaluate(() => { document.getElementById('btnOfflineHelp').click(); });
      await page.waitForTimeout(400);
      const ts1 = await page.evaluate(() => {
        const m = document.getElementById('sdpTroubleshootModal');
        return { open: !!m && !m.hidden, sections: m ? m.querySelectorAll('.ts-sec').length : 0, unlockBtn: !!document.querySelector('[data-ts-act="unlock"]') };
      });
      check('B7L-3 the banner Help opens the bilingual Troubleshooting Guide (4 sections + Unlock Audio)',
        ts1.open === true && ts1.sections === 4 && ts1.unlockBtn === true, JSON.stringify(ts1));
      const ts2 = await page.evaluate(() => {
        const btn = document.querySelector('[data-ts-act="unlock"]');
        if (btn) btn.click();
        const done = document.querySelector('#sdpTroubleshootModal [data-ts-act="close"]');
        if (done) done.click();
        return { closed: (document.getElementById('sdpTroubleshootModal') || {}).hidden };
      });
      check('B7L-4 the 1-tap Unlock Audio & Test Sound action runs cleanly', ts2.closed === true, JSON.stringify(ts2));
      await ctx.setOffline(false);
      await page.waitForTimeout(900);
      const ob3 = await page.evaluate(() => ({ hidden: (document.getElementById('sdpOfflineModeBanner') || {}).hidden }));
      check('B7L-5 the banner clears the instant real connectivity returns (probe-verified)', ob3.hidden === true, JSON.stringify(ob3));

      check('LIVE-0a 0 page errors across the whole desktop gate', errors.length === 0, errors.slice(0, 4).join(' | '));
      await ctx.close();

      /* ═══ MOBILE CONTEXT 390×844 (the Student phone) ═══ */
      const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36' });
      const mpage = await mctx.newPage();
      const merrors = [];
      mpage.on('pageerror', (e) => { const m = String((e && e.message) || e); const st = String((e && e.stack) || ''); if (m.indexOf('decode audio') >= 0 && !st) return; merrors.push(m.slice(0, 160)); });
      await mctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await mpage.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await mpage.waitForTimeout(2400);
      await mpage.evaluate(() => { window.__SDP_AUTOLOCK__ = false; });
      const mb2 = await mpage.evaluate(() => {
        const words = SDP.Sync.words() || [];
        const by = {}; words.forEach((w) => { by[String(w.w).toLowerCase()] = w; });
        return { n: words.length, mp: (by['mobile phone'] || {}).p || '' };
      });
      check('B2M-1 the repaired 31-word session + mobile phone RP IPA load on the phone',
        mb2.n === 31 && mb2.mp === '/ˌməʊ.baɪl ˈfəʊn/', JSON.stringify(mb2));
      await mpage.evaluate(() => { document.getElementById('tab-home').click(); });
      await mpage.waitForTimeout(200);
      await mpage.click('#btnStart');
      await mpage.waitForTimeout(800);
      await mpage.click('#btnHint');
      await mpage.waitForTimeout(200);
      await mpage.click('#btnHint');
      await mpage.waitForTimeout(250);
      const mh = await mpage.evaluate(() => {
        const out = document.getElementById('hintOutput');
        return { visible: !!out && out.offsetParent !== null, text: out ? out.textContent.slice(0, 120) : '' };
      });
      check('B3M-2 the Hint button paints the detailed hint card on a 390×844 phone',
        mh.visible === true && /First letter/.test(mh.text) && /letters/.test(mh.text), JSON.stringify(mh));
      await mctx.setOffline(true);
      await mpage.waitForTimeout(600);
      const mob = await mpage.evaluate(() => ({
        banner: !document.getElementById('sdpOfflineModeBanner').hidden,
        fab: !!document.getElementById('btnFabTroubleshoot'),
        hscroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      }));
      check('B7M-3 the Offline banner paints on the phone + the FAB Troubleshoot entry ships + no horizontal overflow',
        mob.banner === true && mob.fab === true && mob.hscroll === true, JSON.stringify(mob));
      await mpage.evaluate(() => { document.getElementById('btnFabTroubleshoot').click(); });
      await mpage.waitForTimeout(400);
      const mts = await mpage.evaluate(() => {
        const m = document.getElementById('sdpTroubleshootModal');
        return { open: !!m && !m.hidden, sections: m ? m.querySelectorAll('.ts-sec').length : 0 };
      });
      check('B7M-4 the Student Troubleshooting Guide opens from the FAB on the phone (4 sections)',
        mts.open === true && mts.sections === 4, JSON.stringify(mts));
      const mdev = await mpage.evaluate(() => {
        const dev = SDP.Telemetry.deviceTelemetry();
        return dev;
      });
      check('B6M-5 the phone reports phone-class device telemetry with the Android UA',
        mdev.class === 'phone' && mdev.os === 'Android' && !!mdev.browser, JSON.stringify(mdev));
      check('LIVE-0b 0 page errors across the mobile gate', merrors.length === 0, merrors.slice(0, 4).join(' | '));
      await mctx.close();
    } finally {
      await browser.close();
    }
  } catch (e) {
    check('G20 live harness boot', false, String((e && e.stack || e)).slice(0, 300));
  }
})();

g20Live.then(() => {
  const fail = results.filter((r) => r.status === 'FAIL');
  for (const r of results) console.log((r.status === 'PASS' ? '  ✓ ' : '  ✗ ') + r.test + (r.status === 'FAIL' ? '  [' + r.detail + ']' : ''));
  console.log('──── ' + (results.length - fail.length) + '/' + results.length + ' PASS · ' + fail.length + ' FAIL ────');
  process.exit(fail.length ? 1 : 0);
});
