#!/usr/bin/env node
'use strict';
/* G8 — live-lab resilience: a classroom with no internet, a dead API or a hung relay.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R3 fallback ladder, §R7 failure copy
 * contract: docs/ARCHITECTURE_MAP.md §R9 honest empty state
 * A student must always be able to dictate, even when every network tier fails. */
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
  window.__sdpPlayed = 0;
  /* VOX-04: under the unified lock the word is spoken by the professor TTS
     tier, not by a dict.youdao.com <audio> element, so count utterances too. */
  window.__sdpSpoken = [];
  const proto = window.HTMLMediaElement.prototype;
  proto.play = function () {
    window.__sdpPlayed += 1;
    const self = this;
    setTimeout(() => { if (typeof self.onended === 'function') self.onended({}); }, 5);
    return Promise.resolve();
  };
  proto.pause = function () {};
  proto.load = function () {};
  try {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak(u) {
          window.__sdpSpoken.push(u && u.text ? String(u.text) : '');
          setTimeout(() => { if (u && typeof u.onend === 'function') u.onend({}); }, 5);
        },
        cancel() {}, pause() {}, resume() {}, getVoices() { return []; },
        speaking: false, pending: false, paused: false, addEventListener() {}, removeEventListener() {}
      }
    });
  } catch (e) {}
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.onend = null; };
};

/* opts.blockExternal: abort every non-local request (dead API + dead relay) */
async function newPage(browser, origin, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(MOCK);
  await ctx.addInitScript((seedGuide) => {
    try { if (seedGuide) localStorage.setItem('sdp.guide_seen', seedGuide); } catch (e) {}
  }, opts.guideSeen === false ? false : TARGET_VERSION);
  if (opts.settings) await ctx.addInitScript((s) => {
    try { localStorage.setItem('sdp.settings', JSON.stringify(s)); } catch (e) {}
  }, opts.settings);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const blocked = [];
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    blocked.push(url);
    return route.abort();
  });
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  return { ctx, page, errors, blocked };
}

const TARGET_VERSION = /var TARGET = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'))[1];
/* contract: docs/ARCHITECTURE_MAP.md §R1 — the guide is "seen" for the running
 * release only, so this pin follows index.html instead of hardcoding a build. */
/* contract: docs/SYNC_AND_DATA_CONTRACT.md §R11.2 — appliedSettingsRev pins
 * this pacing against a classSettings adoption; guideAutoPlay is off so a
 * resilience tap reaches the cockpit without the quick walkthrough. */
const FAST = { mode: 'paper', writeSecs: 2, repeats: 1, pauseSecs: 0.5, autoAdvance: true, rate: 1, volume: 1, lang: 'en', theme: 'dark', guideAutoPlay: false, appliedSettingsRev: 4 };

(async function main() {
  const server = await start({ root: ROOT });
  const browser = await launch();
  try {
    /* ── 1. dead API tier: the app still dictates ─────────────────────── */
    // contract: docs/SYNC_AND_DATA_CONTRACT.md §R3 ladder — local data wins
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, { settings: FAST });
      await page.waitForTimeout(900);
      const state = await page.evaluate(() => ({
        active: document.querySelector('.screen.active').id,
        words: SDP.Sync.wordCount(),
        title: document.getElementById('sessionTitle').textContent,
        toast: document.getElementById('sdpDataToast').textContent
      }));
      check('G8.1a with every external host dead the 30-word bank still loads', state.words === 30, state.words);
      check('G8.1b the session title is read from the local payload', /Session 8/.test(state.title), state.title);
      check('G8.1c the whisper toast still reports bytes', /KB/.test(state.toast), state.toast);
      await page.click('#btnStart');
      await page.waitForTimeout(600);
      const dictating = await page.evaluate(() => ({
        screen: document.querySelector('.screen.active').id,
        state: document.getElementById('beatStateText').textContent,
        played: window.__sdpPlayed,
        spoken: (window.__sdpSpoken || []).length
      }));
      check('G8.1d dictation starts with no network at all', dictating.screen === 'screen-player', dictating.screen);
      check('G8.1e the first beat is audible with every network tier dead (professor TTS)',
        dictating.spoken >= 1, JSON.stringify(dictating));
      check('G8.1f no unhandled page errors with a dead API', errors.length === 0, errors.slice(0, 2).join(' | '));
      await ctx.close();
    }

    /* ── 2. offline after a cached visit ──────────────────────────────── */
    // contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 offline shell
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, { settings: FAST });
      await page.evaluate(async () => { try { await navigator.serviceWorker.ready; } catch (e) {} });
      await page.waitForTimeout(1500);
      await ctx.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1800);
      const offline = await page.evaluate(() => ({
        words: SDP.Sync ? SDP.Sync.wordCount() : -1,
        active: document.querySelector('.screen.active') ? document.querySelector('.screen.active').id : '',
        cards: document.querySelectorAll('#dictList .dict-card').length
      }));
      check('G8.2a an offline reload keeps the word bank usable', offline.words === 30, offline.words);
      check('G8.2b an offline reload lands on Home', offline.active === 'screen-home', offline.active);
      await page.waitForFunction(() => window.SDP && SDP.Sync && SDP.Sync.wordCount() === 30, null, { timeout: 15000 }).catch(() => {});
      const startable = await page.evaluate(async () => {
        document.getElementById('btnStart').click();
        await new Promise((r) => setTimeout(r, 400));
        return { screen: document.querySelector('.screen.active').id, index: SDP.Engine.config().index };
      });
      check('G8.2c dictation still starts offline', startable.screen === 'screen-player', JSON.stringify(startable));
      check('G8.2d offline boot raises no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await ctx.setOffline(false);
      await ctx.close();
    }

    /* ── 3. a hung relay must never freeze the classroom ──────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R9 nothing blocks the first beat
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(MOCK);
      await ctx.addInitScript((v) => { try { localStorage.setItem('sdp.guide_seen', v); } catch (e) {} }, TARGET_VERSION);
      await ctx.addInitScript((s) => { try { localStorage.setItem('sdp.settings', JSON.stringify(s)); } catch (e) {} }, FAST);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      // a relay that accepts the request and never answers
      await ctx.route('**/macros/**', async (route) => {
        await new Promise((r) => setTimeout(r, 20000));
        await route.abort();
      });
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      const t0 = Date.now();
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.SDP && SDP.Sync && SDP.Sync.isReady(), null, { timeout: 10000 }).catch(() => {});
      const bootMs = Date.now() - t0;
      check('G8.3a boot does not wait for a hung relay (' + bootMs + 'ms)', bootMs < 6000, bootMs);
      const responsive = await page.evaluate(async () => {
        const start = performance.now();
        document.getElementById('tab-dict').click();
        await new Promise((r) => setTimeout(r, 30));
        const cards = document.querySelectorAll('#dictList .dict-card').length;
        document.getElementById('tab-home').click();
        document.getElementById('btnStart').click();
        await new Promise((r) => setTimeout(r, 300));
        return {
          ms: performance.now() - start,
          cards,
          screen: document.querySelector('.screen.active').id,
          state: document.getElementById('beatStateText').textContent
        };
      });
      check('G8.3b taps stay responsive while a relay hangs', responsive.ms < 2500 && responsive.cards === 30, JSON.stringify(responsive));
      check('G8.3c dictation begins despite the hung relay', responsive.screen === 'screen-player' && !/Ready/.test(responsive.state), JSON.stringify(responsive));
      check('G8.3d a hung relay raises no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await ctx.close();
    }

    /* ── 4. an empty or missing word bank is stated honestly ──────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R9 empty state
    {
      server.setOverride('/data/session.json', JSON.stringify({ sessionId: '0', title: 'No session', lists: [] }));
      const { ctx, page, errors } = await newPage(browser, server.origin, { settings: FAST });
      await page.waitForTimeout(900);
      const empty = await page.evaluate(() => ({
        words: SDP.Sync.wordCount(),
        noteHidden: document.getElementById('bankEmpty').hidden,
        noteText: document.getElementById('bankEmpty').textContent,
        startDisabled: document.getElementById('btnStart').disabled,
        mastered: document.getElementById('statMastered').textContent,
        dictNoteHidden: document.getElementById('dictEmpty').hidden
      }));
      check('G8.4a an empty bank reports zero words', empty.words === 0, empty.words);
      check('G8.4b the hero explains what to do instead of promising 30 words',
        empty.noteHidden === false && /session update/i.test(empty.noteText), JSON.stringify(empty));
      check('G8.4c Start Dictation is disabled while the bank is empty', empty.startDisabled === true, empty.startDisabled);
      check('G8.4d the mastered counter refuses to fake a denominator', empty.mastered === '—', empty.mastered);
      check('G8.4e the Words tab shows the same honest note', empty.dictNoteHidden === false, empty.dictNoteHidden);
      const clicked = await page.evaluate(async () => {
        document.getElementById('btnStart').click();
        await new Promise((r) => setTimeout(r, 400));
        return {
          screen: document.querySelector('.screen.active').id,
          toast: document.getElementById('sdpToast') ? document.getElementById('sdpToast').textContent : ''
        };
      });
      check('G8.4f tapping Start on an empty bank never opens an empty cockpit', clicked.screen === 'screen-home', clicked.screen);
      check('G8.4g an empty bank raises no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await ctx.close();
      server.clearOverride('/data/session.json');
    }

    /* ── 5. corrupted storage during a live session ───────────────────── */
    // contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 corruption policy
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, { settings: FAST });
      await page.waitForFunction(() => window.SDP && SDP.Sync && SDP.Sync.wordCount() === 30, null, { timeout: 10000 });
      const survived = await page.evaluate(async () => {
        document.getElementById('btnStart').click();
        await new Promise((r) => setTimeout(r, 500));
        localStorage.setItem('sdp.progress', '<<corrupt>>');
        localStorage.setItem('sdp.settings', '<<corrupt>>');
        try { SDP.Views.renderHome(); } catch (e) { return { crashed: String(e && e.message) }; }
        document.getElementById('btnNext').click();
        await new Promise((r) => setTimeout(r, 300));
        return {
          crashed: null,
          index: SDP.Engine.config().index,
          mode: SDP.Data.settings().mode,
          progress: SDP.Data.progress().weakWords.length
        };
      });
      check('G8.5a corrupting storage mid-session does not throw', survived.crashed === null, survived.crashed);
      check('G8.5b the engine keeps its position', survived.index === 1, survived.index);
      check('G8.5c settings fall back to safe defaults', survived.mode === 'paper', survived.mode);
      check('G8.5d progress resets to an empty but valid shape', survived.progress === 0, survived.progress);
      check('G8.5e no page errors after the corruption', errors.length === 0, errors.slice(0, 2).join(' | '));
      await ctx.close();
    }
    /* ── 6. R1 / SYNC-03: two-device classroom settings propagation ───── */
    // contract: docs/SYNC_AND_DATA_CONTRACT.md §R11.1-§R11.2
    {
      const remote = { files: {}, order: [] };
      /* ── Device A: the lecturer's board, with a stubbed Contents API ── */
      const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctxA.addInitScript(MOCK);
      await ctxA.addInitScript((seed) => {
        try {
          localStorage.setItem('sdp.guide_seen', seed.guide);
          localStorage.setItem('sdp.settings', JSON.stringify(seed.settings));
        } catch (e) {}
      }, { guide: TARGET_VERSION, settings: Object.assign({}, FAST, { appliedSettingsRev: 4 }) });
      const pageA = await ctxA.newPage();
      const errorsA = [];
      pageA.on('pageerror', (e) => errorsA.push(e.message));
      await ctxA.route('**/*', async (route) => {
        const url = route.request().url();
        if (url.indexOf('https://api.github.com/') === 0) {
          if (route.request().method() === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: 'sha-' + Date.now() }) });
          }
          const body = JSON.parse(route.request().postData() || '{}');
          const path = url.split('/contents/')[1].split('?')[0];
          remote.files[path] = Buffer.from(String(body.content || ''), 'base64').toString('utf8');
          remote.order.push(path);
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'sha-' + path } }) });
        }
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await pageA.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await pageA.waitForFunction(() => window.SDP && SDP.Sync && SDP.Sync.wordCount() === 30, null, { timeout: 10000 });
      await pageA.evaluate(() => new Promise((resolve) => { SDP.Studio.unlock('246813', () => resolve()); }));
      const unlocked = await pageA.evaluate(() => SDP.Studio.isUnlocked());
      check('G8.6a the lecturer unlocks the studio with the bootstrap PIN 246813', unlocked === true, unlocked);
      /* the GitHub token is a secret the lecturer types into the unlocked
         studio; the harness seeds it the same way, never in a shipped file. */
      const tokened = await pageA.evaluate(() => {
        SDP.Studio.state.secrets.ghToken = 'ghp_harness';
        return SDP.Studio.secrets().ghToken;
      });
      check('G8.6a2 the unlocked studio holds the publish token', tokened === 'ghp_harness', tokened);
      await pageA.evaluate(() => {
        SDP.Data.saveSettings({ writeSecs: 12, repeats: 4, mode: 'paper', pauseSecs: 2 });
        SDP.Views.renderSettings();
      });
      await pageA.click('#tab-settings');
      await pageA.waitForTimeout(200);
      const barVisible = await pageA.evaluate(() => {
        const bar = document.getElementById('lecturerSyncBar');
        return {
          hidden: bar.hidden,
          height: bar.getBoundingClientRect().height,
          label: document.getElementById('btnSyncClassSettings').textContent,
          last: document.getElementById('lecturerSyncLast').textContent
        };
      });
      check('G8.6b the lecturer-only sync bar is visible and labelled',
        barVisible.hidden === false && barVisible.height > 0 &&
        /Save & Sync Current Settings to All Classroom Devices/.test(barVisible.label),
        JSON.stringify(barVisible));
      await pageA.click('#btnSyncClassSettings');
      for (let i = 0; i < 60 && !remote.files['data/version.json']; i++) await pageA.waitForTimeout(100);
      const published = JSON.parse(remote.files['data/config.json'] || '{}');
      const publishedVer = JSON.parse(remote.files['data/version.json'] || '{}');
      check('G8.6c the sync button publishes config.json + version.json',
        !!remote.files['data/config.json'] && !!remote.files['data/version.json'], remote.order.join(','));
      check('G8.6d version.json is committed last',
        remote.order[remote.order.length - 1] === 'data/version.json', remote.order.join(','));
      check('G8.6e classSettings carries the lecturer writeSecs 12 / repeats 4',
        published.classSettings && published.classSettings.writeSecs === 12 && published.classSettings.repeats === 4,
        JSON.stringify(published.classSettings || null));
      check('G8.6f the publish bumps settingsRev and syncRev',
        publishedVer.settingsRev > 4 && publishedVer.syncRev > 1762000000003,
        JSON.stringify([publishedVer.settingsRev, publishedVer.syncRev]));
      check('G8.6g publishing the class settings raises no page errors', errorsA.length === 0, errorsA.slice(0, 2).join(' | '));
      await ctxA.close();

      /* ── Device B: a student phone that has touched every classroom key ── */
      const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctxB.addInitScript(MOCK);
      await ctxB.addInitScript((seed) => {
        try {
          localStorage.setItem('sdp.guide_seen', seed.guide);
          localStorage.setItem('sdp.settings', JSON.stringify(seed.settings));
          localStorage.setItem('sdp.progress', JSON.stringify(seed.progress));
        } catch (e) {}
      }, {
        guide: TARGET_VERSION,
        settings: Object.assign({}, FAST, {
          writeSecs: 3, repeats: 1, pauseSecs: 0.5, appliedSettingsRev: 0,
          touchedKeys: { writeSecs: true, repeats: true, pauseSecs: true, mode: true }
        }),
        progress: { mastered: { afraid: true, confident: true }, attempts: {}, weakWords: [], streak: { count: 3, lastDate: '2026-10-30' }, history: [], lastScore: { correct: 2, total: 2 } }
      });
      const pageB = await ctxB.newPage();
      const errorsB = [];
      pageB.on('pageerror', (e) => errorsB.push(e.message));
      await ctxB.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await ctxB.route('**/data/config.json*', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: remote.files['data/config.json'] || '{}'
      }));
      await ctxB.route('**/data/version.json*', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: remote.files['data/version.json'] || '{}'
      }));
      await pageB.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await pageB.waitForFunction(() => window.SDP && SDP.Sync && SDP.Sync.isReady(), null, { timeout: 10000 });
      await pageB.waitForTimeout(400);
      const student = await pageB.evaluate(() => ({
        writeSecs: SDP.Data.settings().writeSecs,
        repeats: SDP.Data.settings().repeats,
        pauseSecs: SDP.Data.settings().pauseSecs,
        applied: SDP.Data.settings().appliedSettingsRev,
        touched: SDP.Data.settings().touchedKeys,
        progress: SDP.Data.progress(),
        badge: document.getElementById('settingsSyncStatus').textContent
      }));
      check('G8.6h Device B adopts the lecturer pacing even with touchedKeys set (SYNC-01)',
        student.writeSecs === 12 && student.repeats === 4 && student.pauseSecs === 2, JSON.stringify([student.writeSecs, student.repeats, student.pauseSecs]));
      check('G8.6i Device B records the adopted settingsRev',
        student.applied === Number(publishedVer.settingsRev) && student.applied > 0, student.applied);
      check('G8.6j the classroom keys leave touchedKeys on Device B',
        student.touched.writeSecs === undefined && student.touched.repeats === undefined,
        JSON.stringify(student.touched));
      check('G8.6k Device B keeps its own sdp.progress (A1)',
        student.progress.mastered.afraid === true && student.progress.mastered.confident === true &&
        student.progress.streak.count === 3,
        JSON.stringify(student.progress.mastered) + '/' + student.progress.streak.count);
      check('G8.6l two-device adoption raises no page errors', errorsB.length === 0, errorsB.slice(0, 2).join(' | '));
      await ctxB.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const fails = results.filter((r) => r.status === 'FAIL');
  console.log(JSON.stringify(results, null, 2));
  console.log('\nG8 live-lab.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
  if (fails.length) process.exitCode = 1;
})().catch((err) => {
  console.error('G8 harness crashed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
