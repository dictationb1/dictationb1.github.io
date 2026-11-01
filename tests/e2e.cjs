#!/usr/bin/env node
'use strict';
/* G7 — the complete student journey in real Chromium with mocked media.
 * contract: docs/UI_COMPONENT_GUIDE.md §1 the five-tap journey, §4 results, §6 backups
 * contract: docs/ARCHITECTURE_MAP.md §R2 first visit, §R7 credits placement
 * No microphone, no network audio: speechSynthesis and HTMLMediaElement are stubbed. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const { start } = require('./static-server.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}

async function launch() {
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => ![
    '--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'
  ].includes(a));
  return chromium.launch({ headless: true, executablePath, args });
}

const MOCK = () => {
  window.__SDP_NO_LIVE__ = true;
  window.__sdpSpoken = [];
  window.__sdpPlayed = 0;
  try {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak(utterance) {
          window.__sdpSpoken.push(utterance && utterance.text);
          setTimeout(() => { if (utterance && typeof utterance.onend === 'function') utterance.onend({}); }, 5);
        },
        cancel() {}, pause() {}, resume() {},
        getVoices() { return [{ name: 'Test Sinhala', lang: 'si-LK', default: true, localService: true }]; },
        speaking: false, pending: false, paused: false,
        addEventListener() {}, removeEventListener() {}
      }
    });
  } catch (e) {}
  window.SpeechSynthesisUtterance = function (text) {
    this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.onend = null; this.onerror = null;
  };
  const proto = window.HTMLMediaElement.prototype;
  proto.play = function () {
    window.__sdpPlayed += 1;
    const self = this;
    setTimeout(() => { if (typeof self.onended === 'function') self.onended({}); }, 5);
    return Promise.resolve();
  };
  proto.pause = function () { this.__paused = true; };
  proto.load = function () {};
};

async function newPage(browser, origin, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.addInitScript(MOCK);
  if (opts.guideSeen) await ctx.addInitScript(() => { try { localStorage.setItem('sdp.guide_seen', '0.0.1.d'); } catch (e) {} });
  if (opts.settings) await ctx.addInitScript((s) => { try { localStorage.setItem('sdp.settings', JSON.stringify(s)); } catch (e) {} }, opts.settings);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  return { ctx, page, errors };
}

/* appliedSettingsRev pins this pacing against a classSettings adoption (R11.2). */
const FAST = { mode: 'paper', writeSecs: 2, repeats: 1, pauseSecs: 0.5, autoAdvance: true, rate: 1, volume: 1, lang: 'en', theme: 'dark', appliedSettingsRev: 4 };

(async function main() {
  const server = await start({ root: ROOT });
  const browser = await launch();
  try {
    /* ── 1. first visit: unmissable guide ─────────────────────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R2 priority #2
    const { ctx, page, errors } = await newPage(browser, server.origin, { settings: FAST });
    await page.waitForTimeout(700);
    const firstRun = await page.evaluate(() => ({
      guideOpen: document.getElementById('guideModal').hidden === false,
      steps: document.getElementById('guideSteps').children.length,
      homeActive: document.querySelector('.screen.active').id,
      header: getComputedStyle(document.getElementById('appHeader')).position,
      headerHeight: document.getElementById('appHeader').getBoundingClientRect().height
    }));
    check('G7.1a the guide opens by itself on the first visit', firstRun.guideOpen === true);
    check('G7.1b the guide shows four steps', firstRun.steps === 4, firstRun.steps);
    check('G7.1c Home is already rendered underneath', firstRun.homeActive === 'screen-home', firstRun.homeActive);
    await page.click('#btnGuideClose');
    await page.waitForTimeout(150);
    const afterGuide = await page.evaluate(() => localStorage.getItem('sdp.guide_seen'));
    check('G7.1d closing the guide records the visit', afterGuide === '0.0.1.d', afterGuide);

    /* ── 2. credits: on Home and in About, never floating ─────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R7 attribution placement
    const credits = await page.evaluate(() => {
      const foot = document.getElementById('creditFoot');
      const line = foot.querySelector('.credit-line');
      const pill = foot.querySelector('.credits-pill');
      const style = getComputedStyle(foot);
      return {
        line: line ? line.textContent.trim() : '',
        pill: pill ? pill.textContent.trim() : '',
        position: style.position,
        inHome: !!document.querySelector('#screen-home #creditFoot'),
        onPlayer: !!document.querySelector('#screen-player #creditFoot')
      };
    });
    check('G7.2a the credit line is verbatim',
      credits.line === 'Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)', credits.line);
    check('G7.2b the shimmer pill reads exactly CREDITS GOES TO Hansana', credits.pill === 'CREDITS GOES TO Hansana', credits.pill);
    check('G7.2c the credits live in Home, never over the player', credits.inHome && !credits.onPlayer, JSON.stringify(credits));
    check('G7.2d no floating fixed badge covers the cockpit', credits.position !== 'fixed', credits.position);
    const aboutCredits = await page.evaluate(async () => {
      document.getElementById('tab-settings').click();
      await new Promise((r) => setTimeout(r, 120));
      const about = document.getElementById('aboutCard');
      return { text: about.textContent, hasPill: !!about.querySelector('.credits-pill') };
    });
    check('G7.2e About repeats the same attribution', aboutCredits.text.indexOf('Creator: Hansana') >= 0 && aboutCredits.text.indexOf('Ms. Sumodya Sewmini') >= 0, aboutCredits.text.slice(0, 120));
    check('G7.2f About carries the shimmer pill too', aboutCredits.hasPill === true);

    /* ── 2b. VOX-07: the quick spoken walkthrough and its skip button ─── */
    // contract: docs/UI_COMPONENT_GUIDE.md §Quick Walkthrough Mode
    {
      const { ctx, page } = await newPage(browser, server.origin, {
        guideSeen: true,
        settings: Object.assign({}, FAST, { guideAutoPlay: true, appliedSettingsRev: 4 })
      });
      await page.waitForTimeout(500);
      /* Hold the narration open so the modal behaves like a real 20 s guide. */
      await page.evaluate(() => {
        Object.defineProperty(window, 'speechSynthesis', {
          configurable: true,
          value: { speak() {}, cancel() {}, pause() {}, resume() {}, getVoices() { return []; },
            speaking: true, pending: false, paused: false, addEventListener() {}, removeEventListener() {} }
        });
      });
      await page.click('#btnStart');
      await page.waitForTimeout(250);
      const quick = await page.evaluate(() => ({
        open: document.getElementById('guideModal').hidden === false,
        title: document.getElementById('guideTitle').textContent,
        skipVisible: document.getElementById('btnGuideSkipStart').hidden === false,
        skipLabel: document.getElementById('btnGuideSkipStart').textContent,
        screen: document.querySelector('.screen.active').id
      }));
      check('G7.2g Start opens the quick voice guide before the cockpit', quick.open === true && quick.screen === 'screen-home', JSON.stringify(quick));
      check('G7.2h the quick guide is titled and offers the skip button',
        /Quick Voice Guide/.test(quick.title) && quick.skipVisible && /Skip Guide & Start Immediately/.test(quick.skipLabel),
        JSON.stringify(quick));
      await page.click('#btnGuideSkipStart');
      await page.waitForTimeout(350);
      const afterSkip = await page.evaluate(() => ({
        screen: document.querySelector('.screen.active').id,
        open: document.getElementById('guideModal').hidden === false,
        state: document.getElementById('beatStateText').textContent
      }));
      check('G7.2i skipping starts the dictation immediately', afterSkip.screen === 'screen-player' && afterSkip.open === false, JSON.stringify(afterSkip));
      check('G7.2j the beat is already running after the skip', afterSkip.state.length > 0, afterSkip.state);
      await ctx.close();
    }

    /* ── 3. paper dictation: five taps to listening ───────────────────── */
    // contract: docs/UI_COMPONENT_GUIDE.md §1 journey
    await page.click('#tab-home');
    await page.click('#btnStart');
    await page.waitForTimeout(600);
    const cockpit = await page.evaluate(() => {
      const current = SDP.Engine.items()[SDP.Engine.config().index];
      const bar = document.getElementById('cockpitBar');
      return {
        screen: document.querySelector('.screen.active').id,
        word: current ? current.w : '',
        inDom: bar.textContent.toLowerCase().indexOf(String(current ? current.w : 'zzzz').toLowerCase()) >= 0,
        progress: document.getElementById('cockpitProgress').textContent,
        pos: document.getElementById('wordPosBadge').textContent,
        state: document.getElementById('beatStateText').textContent,
        seconds: document.getElementById('beatSeconds').textContent,
        ringVisible: document.getElementById('beatRing').getBoundingClientRect().width > 60,
        hasInput: document.querySelectorAll('#beatStage input').length,
        spoken: (window.__sdpSpoken || []).length + window.__sdpPlayed
      };
    });
    check('G7.3a Start opens the cockpit', cockpit.screen === 'screen-player', cockpit.screen);
    check('G7.3b the cockpit shows progress and the word class', cockpit.progress === '1 / 30' && cockpit.pos.length >= 2, JSON.stringify(cockpit));
    // contract: no spoilers — the target word may only appear after Finish
    check('G7.3c the target word is never printed during the beat', cockpit.inDom === false, cockpit.word);
    check('G7.3d the beat starts listening and the ring is drawn', /Listening/.test(cockpit.state) && cockpit.ringVisible, JSON.stringify(cockpit));
    check('G7.3e paper mode keeps the stage free of inputs', cockpit.hasInput === 0, cockpit.hasInput);
    check('G7.3f the word was spoken aloud (mocked media)', cockpit.spoken >= 1, cockpit.spoken);

    const countdown = await page.evaluate(async () => {
      const read = () => parseFloat(document.getElementById('beatSeconds').textContent) || 0;
      const before = read();
      await new Promise((r) => setTimeout(r, 700));
      return { before, after: read() };
    });
    check('G7.3g the countdown ticks down in real time', countdown.after < countdown.before, JSON.stringify(countdown));

    await page.click('#btnPlayPause');
    await page.waitForTimeout(200);
    const paused = await page.evaluate(() => document.getElementById('beatStateText').textContent);
    check('G7.3g Listen/Pause pauses the beat', /Paused/.test(paused), paused);
    await page.click('#btnPlayPause');
    await page.waitForTimeout(300);
    const resumed = await page.evaluate(() => document.getElementById('beatStateText').textContent);
    check('G7.3h the same button resumes', !/Paused/.test(resumed), resumed);

    await page.click('#btnNext');
    await page.waitForTimeout(300);
    const nextWord = await page.evaluate(() => ({
      index: SDP.Engine.config().index,
      progress: document.getElementById('cockpitProgress').textContent
    }));
    check('G7.3i Next moves to word two', nextWord.index === 1 && nextWord.progress === '2 / 30', JSON.stringify(nextWord));
    await page.click('#btnPrev');
    await page.waitForTimeout(200);
    const prevIndex = await page.evaluate(() => SDP.Engine.config().index);
    check('G7.3j Previous returns to word one', prevIndex === 0, prevIndex);
    await page.click('#btnRepeat');
    await page.waitForTimeout(400);
    const repeated = await page.evaluate(() => (window.__sdpSpoken || []).length + window.__sdpPlayed);
    check('G7.3k Repeat re-speaks the same word', repeated >= 3, repeated);

    const hints = await page.evaluate(async () => {
      const out = {};
      for (const key of ['pos', 'first', 'si', 'sentence']) {
        document.querySelector('[data-hint="' + key + '"]').click();
        await new Promise((r) => setTimeout(r, 80));
        out[key] = document.querySelector('.hint-output') ? document.querySelector('.hint-output').textContent : '';
      }
      return out;
    });
    check('G7.3l the four hint chips reveal real content',
      /Word type: adj\./.test(hints.pos) && /First letter: [a-z] _ /.test(hints.first) &&
      /[\u0D80-\u0DFF]/.test(hints.si) && hints.sentence.indexOf('_____') > 0, JSON.stringify(hints));
    check('G7.3m hint chips toggle aria-pressed', await page.evaluate(() => document.querySelector('[data-hint="si"]').getAttribute('aria-pressed') === 'true'));

    /* ── 4. results, self-check and retry ─────────────────────────────── */
    // contract: docs/UI_COMPONENT_GUIDE.md §4 self-check flow
    await page.evaluate(() => SDP.Engine.finish());
    await page.waitForTimeout(400);
    const res = await page.evaluate(() => ({
      visible: document.getElementById('resultsPanel').hidden === false,
      rows: document.querySelectorAll('#resultsTable tbody tr').length,
      score: document.getElementById('scoreValue').textContent,
      pct: document.getElementById('scorePct').textContent
    }));
    check('G7.4a Finish opens the self-check panel', res.visible === true);
    check('G7.4b every word of the session appears in the table', res.rows === 30, res.rows);
    check('G7.4c the default score is a full 30 / 30 (100%)', res.score === '30 / 30' && res.pct === '100%', res.score + ' ' + res.pct);

    const marked = await page.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('#resultsTable [data-mark="missed"]')).slice(0, 6);
      for (const b of buttons) { b.click(); await new Promise((r) => setTimeout(r, 20)); }
      await new Promise((r) => setTimeout(r, 150));
      return {
        score: document.getElementById('scoreValue').textContent,
        pct: document.getElementById('scorePct').textContent,
        missedRows: document.querySelectorAll('#resultsTable tbody tr.is-missed').length,
        progress: JSON.parse(localStorage.getItem('sdp.progress'))
      };
    });
    check('G7.4d six missed words read 24 / 30 and 80%', marked.score === '24 / 30' && marked.pct === '80%', marked.score + ' ' + marked.pct);
    check('G7.4e missed rows are visually flagged', marked.missedRows === 6, marked.missedRows);
    check('G7.4f weakWords is saved for the retry button', marked.progress.weakWords.length === 6, JSON.stringify(marked.progress.weakWords));
    check('G7.4g Home accuracy now reads 80%', await page.evaluate(async () => {
      document.getElementById('tab-home').click();
      await new Promise((r) => setTimeout(r, 120));
      return document.getElementById('statAccuracy').textContent === '80%';
    }));
    await page.evaluate(() => { document.getElementById('tab-player').click(); });

    await page.click('#btnRetryMissed');
    await page.waitForTimeout(500);
    const retry = await page.evaluate(() => ({ items: SDP.Engine.items().length, index: SDP.Engine.config().index }));
    check('G7.4h Retry missed starts a focused six-word session', retry.items === 6, retry.items);

    /* ── 5. typing mode: one focus, instant grading ───────────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R4 typing mode
    await page.evaluate(() => { SDP.Engine.stop(); document.getElementById('tab-home').click(); });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('#homeModePills [data-mode="typing"]').click());
    await page.click('#btnStart');
    // the single focus call happens when the writing window opens (R4)
    await page.waitForFunction(() => SDP.Engine.config().phase === 'writing', null, { timeout: 8000 }).catch(() => {});
    const typing = await page.evaluate(() => {
      const input = document.getElementById('typeInput');
      return {
        exists: !!input,
        focused: document.activeElement === input,
        word: SDP.Engine.items()[SDP.Engine.config().index].w,
        phase: SDP.Engine.config().phase,
        autocomplete: input && input.getAttribute('autocomplete'),
        spellcheck: input && input.getAttribute('spellcheck')
      };
    });
    check('G7.5a typing mode mounts #typeInput', typing.exists === true);
    check('G7.5b #typeInput takes focus once the writing window opens', typing.focused === true && typing.phase === 'writing', JSON.stringify(typing));
    check('G7.5c the input blocks autocorrect', typing.autocomplete === 'off' && typing.spellcheck === 'false');
    await page.fill('#typeInput', typing.word);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1400);
    const advanced = await page.evaluate(() => ({
      index: SDP.Engine.config().index,
      cleared: document.getElementById('typeInput') ? document.getElementById('typeInput').value : 'gone',
      progress: document.getElementById('cockpitProgress').textContent
    }));
    check('G7.5d Enter advances to the next word with a cleared input',
      advanced.index === 1 && advanced.cleared === '' && advanced.progress === '2 / 30', JSON.stringify(advanced));
    await page.evaluate(() => SDP.Engine.finish());
    await page.waitForTimeout(400);
    const typedRow = await page.evaluate(() => {
      const row = document.querySelectorAll('#resultsTable tbody tr')[0];
      return { cls: row.className, cells: row.textContent.slice(0, 60) };
    });
    check('G7.5e the typed word is auto-marked correct', typedRow.cls.indexOf('is-correct') >= 0, typedRow.cls);
    check('G7.5f an unanswered word is auto-marked missed',
      await page.evaluate(() => document.querySelectorAll('#resultsTable tbody tr')[1].className.indexOf('is-missed') >= 0));

    /* ── 6. backup export ─────────────────────────────────────────────── */
    // contract: docs/UI_COMPONENT_GUIDE.md §6 backup round trip
    await page.evaluate(() => document.getElementById('tab-settings').click());
    await page.waitForTimeout(200);
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.click('#btnExportBackup');
    const download = await downloadPromise;
    const savedTo = path.join('/tmp', 'g7-backup.json');
    await download.saveAs(savedTo);
    const backup = JSON.parse(fs.readFileSync(savedTo, 'utf8'));
    check('G7.6a the backup downloads with the version in its name', /smart-dictation-backup-0\.0\.1\.[a-z]\.json/.test(download.suggestedFilename()), download.suggestedFilename());
    check('G7.6b the backup carries progress, settings and provenance',
      ['app', 'schema', 'exportedAt', 'progress', 'settings', 'appVersion'].every((k) => k in backup), Object.keys(backup).join(','));
    // contract: docs/CHANGELOG_LEDGER.md §Release ledger — backups pin the current build
    check('G7.6c the backup pins the running appVersion', backup.appVersion === '0.0.1.d', backup.appVersion);
    fs.unlinkSync(savedTo);

    /* ── 7. the transparency pair is reachable ────────────────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R9 reachability
    const links = await page.evaluate(() => ({
      home: document.querySelectorAll('a[href^="./data/"], a[href="data.html"]').length,
      title: document.title
    }));
    check('G7.7a Home/Settings link to the /data transparency route', links.home >= 1, links.home);
    const backLink = await page.evaluate(async () => {
      const resp = await fetch('./data.html');
      const html = await resp.text();
      return { ok: resp.ok, hasByteTable: html.indexOf('byteTable') >= 0, back: /href="(\.\.?\/)?index\.html/.test(html) };
    });
    check('G7.7b the /data page loads and links back to the app', backLink.ok && backLink.hasByteTable && backLink.back, JSON.stringify(backLink));

    /* ── 8. Sinhala mode during dictation ─────────────────────────────── */
    // contract: docs/UI_COMPONENT_GUIDE.md §5 language purity
    const siMode = await page.evaluate(async () => {
      SDP.Views.applyLang('si');
      document.getElementById('tab-home').click();
      await new Promise((r) => setTimeout(r, 150));
      return {
        chrome: document.getElementById('screen-home').textContent,
        b1: document.getElementById('appHeader').textContent.indexOf('CCBE B1') >= 0
      };
    });
    check('G7.8a Sinhala mode translates Home chrome', /[\u0D80-\u0DFF]/.test(siMode.chrome));
    check('G7.8b the CCBE B1 badge survives the switch', siMode.b1 === true);
    const siWord = await page.evaluate(async () => {
      document.querySelector('#homeModePills [data-mode="paper"]').click();
      document.getElementById('btnStart').click();
      await new Promise((r) => setTimeout(r, 500));
      document.querySelector('[data-hint="si"]').click();
      await new Promise((r) => setTimeout(r, 150));
      const current = SDP.Engine.items()[SDP.Engine.config().index];
      return {
        englishWord: current ? current.w : '',
        hint: document.querySelector('.hint-output') ? document.querySelector('.hint-output').textContent : ''
      };
    });
    check('G7.8c the target word stays English in Sinhala mode', /^[a-z]+$/i.test(siWord.englishWord), siWord.englishWord);
    check('G7.8d the Sinhala hint shows the native meaning', /[\u0D80-\u0DFF]/.test(siWord.hint), siWord.hint);

    check('G7.9 no page errors across the whole journey', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  } finally {
    await browser.close();
    await server.close();
  }

  const fails = results.filter((r) => r.status === 'FAIL');
  console.log(JSON.stringify(results, null, 2));
  console.log('\nG7 e2e.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
  if (fails.length) process.exitCode = 1;
})().catch((err) => {
  console.error('G7 harness crashed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
