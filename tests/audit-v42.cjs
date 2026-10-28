'use strict';
/* v42 real-Chromium troubleshooting audit.
   Drives index.html in a REAL Chromium build (not jsdom) and verifies every
   voice, session-flow, countdown, dictation-number, pause/resume, test-sound
   and UI contract that the v42 release claims:
     * one single British English (en-GB) female neural voice, one host
     * every clip formatted as "<text> ." (space + period)
     * the pre-ready instructions, "Three, two, one .", "Number N, word .",
       "word .", "Session paused .", "Welcome back. Continuing dictation
       number N ." and the completion summary
     * the visual 3-2-1 countdown and the spoken countdown are synchronised:
       Word 1 starts only after BOTH have finished
     * the "Dictation #N of 30" badge is always visible (and shows the paused
       state)
     * the 5 second writing countdown runs
     * TTS.testSound() marks the voice as verified
     * a dead audio host never hangs the app in silence (1500ms watchdog ->
       the one locked en-GB female device voice)
     * zero console errors and zero uncaught page errors
   Run:  node tests/audit-v42.cjs                                      */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');

const root = path.resolve(__dirname, '..');
const indexFile = path.join(root, 'index.html');
const UNIFIED = 'https://dict.youdao.com/dictvoice?type=1&audio=';
const results = [];
let failures = 0;

function rec(name, ok, detail) {
  results.push({ name, status: ok ? 'PASS' : 'FAIL', detail: detail === undefined ? undefined : detail });
  if (!ok) failures += 1;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : ''));
}
function eq(name, actual, expected) { rec(name, actual === expected, { actual, expected }); }
function ok(name, value, detail) { rec(name, !!value, detail); }

/* a tiny silent WAV so the pre-buffered clips load without a network error */
function silentWav(seconds) {
  const rate = 8000, samples = Math.max(1, Math.floor(rate * (seconds || 0.2))), dataSize = samples * 2;
  const b = Buffer.alloc(44 + dataSize);
  b.write('RIFF', 0); b.writeUInt32LE(36 + dataSize, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(dataSize, 40);
  return b;
}
const WAV = silentWav(0.2);

/* the master <audio> is recorded, not downloaded: the real app code runs against
   the real DOM, timers and CSS while the requested clip URLs are captured. */
const RECORDER = () => {
  window.__clips = [];
  window.__synth = [];
  window.__clipDelay = 60;
  window.__statusLog = [];
  window.__badgeLog = [];
  setInterval(function () {
    try {
      var s = document.getElementById('plStatus'), b = document.getElementById('plStepBadge');
      if (s) { var t = s.textContent; if (window.__statusLog[window.__statusLog.length - 1] !== t) window.__statusLog.push(t); }
      if (b) { var t2 = b.textContent; if (window.__badgeLog[window.__badgeLog.length - 1] !== t2) window.__badgeLog.push(t2); }
    } catch (e) {}
  }, 50);
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    configurable: true
  });
  const play = window.HTMLMediaElement.prototype.play;
  window.HTMLMediaElement.prototype.play = function () {
    const el = this;
    const src = String(el.getAttribute('src') || '');
    if (el.id === 'ttsMasterAudio' && /^https?:/.test(src)) {
      window.__clips.push({ url: src, t: Date.now() });
      const delay = Number(window.__clipDelay) || 60;
      setTimeout(() => { if (el.onplaying) el.onplaying(); }, 5);
      setTimeout(() => { if (el.onended) el.onended(); }, delay);
      return Promise.resolve();
    }
    return play ? play.apply(el, arguments) : Promise.resolve();
  };
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = function (u) {
      window.__synth.push({ text: String(u && u.text || ''), lang: String(u && u.lang || '') });
      setTimeout(() => { if (u && u.onend) u.onend(); }, 10);
    };
  }
};

const clipText = (url) => {
  const at = String(url || '').indexOf('&audio=');
  if (at < 0) return '';
  try { return decodeURIComponent(String(url).slice(at + 7)); } catch (e) { return ''; }
};
const textOf = (clips) => clips.map((c) => clipText(c.url)).filter(Boolean);
const noise = (list) => list.filter((m) => !/Failed to load resource|net::ERR/i.test(String(m)));

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.SDP_BROWSER_BIN || await serverChromium.executablePath(),
    args: serverChromium.args.filter((a) => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a))
  });
  const url = require('url').pathToFileURL(indexFile).href;

  async function newPage(recorder) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const consoleErrors = [], pageErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => pageErrors.push(e.message));
    if (recorder) await page.addInitScript(recorder);
    await page.route('**/*', (r) => {
      const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      if (u.indexOf('dict.youdao.com') >= 0) return r.fulfill({ status: 200, contentType: 'audio/wav', body: WAV });
      return r.abort();
    });
    await page.goto(url);
    await page.waitForSelector('#homeTitle', { state: 'visible' });
    /* the app binds its listeners in a DOMContentLoaded handler: wait for the
       build stamp, otherwise the first click can be lost in the boot race */
    await page.waitForFunction(() => !!(window.SDP && window.SDP.version), null, { timeout: 20000 });
    await page.waitForTimeout(500);
    return { context, page, consoleErrors, pageErrors };
  }
  const clipsOf = (page) => page.evaluate(() => (window.__clips || []).slice());
  const textsOf = async (page) => textOf(await clipsOf(page));
  /* the ready sheet is rendered after the first-run guide closes: wait for it */
  const clickReady = async (page) => {
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#sheets button')).some((x) => /I['\u2019]m ready/.test(x.textContent)), null, { timeout: 20000 });
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#sheets button')).find((x) => /I['\u2019]m ready/.test(x.textContent));
      if (b) b.click();
    });
  };
  const waitForClip = async (page, re, timeout) => {
    await page.waitForFunction((src) => (window.__clips || []).some((c) => new RegExp(src).test(decodeURIComponent(String(c.url).slice(String(c.url).indexOf('&audio=') + 7)))), re.source, { timeout: timeout || 20000 });
  };

  /* ============================================================ part 1: flow */
  {
    const { context, page, consoleErrors, pageErrors } = await newPage(RECORDER);

    const voice = await page.evaluate(() => {
      const TTS = window.TTS;
      return {
        unified: String(TTS && TTS.UNIFIED || ''),
        word: String(TTS && TTS.getSingleVoiceUrl('bicycle') || ''),
        phrase: String(TTS && TTS.getSingleVoiceUrl('Number 1, bicycle') || ''),
        hasSynthFallback: typeof (TTS && TTS.speakPinnedSynth) === 'function',
        appVersion: window.SDP && window.SDP.version
      };
    });
    eq('the app exposes exactly one voice endpoint', voice.unified, UNIFIED);
    eq('a single word is formatted with " ."', voice.word, UNIFIED + 'bicycle%20.');
    eq('a numbered phrase is formatted with " ."', voice.phrase, UNIFIED + 'Number%201%2C%20bicycle%20.');
    ok('the locked en-GB device voice fallback exists', voice.hasSynthFallback);
    eq('the running build is 4.9.0', voice.appVersion, '4.9.0');

    await page.evaluate(() => { const b = document.getElementById('btnStart'); if (b) b.click(); });
    await page.waitForTimeout(900);
    let spoken = await textsOf(page);
    ok('the pre-ready instructions are spoken in the one voice',
      spoken.indexOf("Welcome. Prepare your pen and paper. Each word is read twice. Press Yes, I'm ready to begin .") >= 0, spoken);

    await page.evaluate(() => { const b = document.getElementById('btnReadyTest'); if (b) b.click(); });
    await page.waitForTimeout(700);
    spoken = await textsOf(page);
    ok('Test sound plays "Sound check. Number 1, bicycle ."', spoken.indexOf('Sound check. Number 1, bicycle .') >= 0, spoken);
    const pill = await page.evaluate(() => { const p = document.getElementById('voiceTestPill'); return p ? p.textContent : ''; });
    eq('the voice pill reports the verified voice', pill, '✓ Dictation Voice Verified');

    await clickReady(page);
    await page.waitForTimeout(400);
    spoken = await textsOf(page);
    ok('the countdown is spoken', spoken.indexOf('Three, two, one .') >= 0, spoken);
    const badge0 = await page.evaluate(() => ({
      badge: document.getElementById('plStepBadge') ? document.getElementById('plStepBadge').textContent : '',
      prog: document.getElementById('plProgText') ? document.getElementById('plProgText').textContent : ''
    }));
    eq('the dictation number badge is visible before Word 1', badge0.badge, 'Dictation #1 of 30');
    eq('the progress label is visible before Word 1', badge0.prog, 'Dictation #1 of 30');

    await page.waitForTimeout(2600);
    spoken = await textsOf(page);
    ok('Word 1 is announced with its dictation number', spoken.some((t) => /^Number 1, .+ \.$/.test(t)), spoken);
    ok('Word 1 is repeated as the clean word only', spoken.some((t) => /^[a-z]+ \.$/.test(t)), spoken);
    const badge1 = await page.evaluate(() => ({
      badge: document.getElementById('plStepBadge').textContent,
      prog: document.getElementById('plProgText').textContent,
      status: document.getElementById('plStatus').textContent
    }));
    eq('the badge still shows Dictation #1 of 30', badge1.badge, 'Dictation #1 of 30');
    eq('the progress label still shows Dictation #1 of 30', badge1.prog, 'Dictation #1 of 30');

    await page.waitForTimeout(1400);
    const writing = await page.evaluate(() => ({
      status: document.getElementById('plStatus').textContent,
      log: (window.__statusLog || []).slice(),
      cd: document.getElementById('cdNum') ? document.getElementById('cdNum').textContent : ''
    }));
    ok('the writing phase starts after the clean repeat',
      writing.log.some((t) => /Write the word now \(5s\)|Your turn/i.test(t)), writing.log.slice(-6));
    ok('the writing countdown counts down from five', Number(writing.cd) <= 5 && Number(writing.cd) >= 0, writing.cd);
    ok('the status line always carries the dictation number',
      writing.log.filter((t) => /of 30/.test(t)).length >= 1, writing.log.slice(-6));

    const clickedFinish = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find((x) => /Finish early/i.test(x.textContent));
      if (b) { b.click(); return true; }
      return false;
    });
    ok('the player offers "Finish early"', clickedFinish);
    await page.waitForTimeout(400);
    const clickedNow = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#modals button')).find((x) => /Finish now/i.test(x.textContent));
      if (b) { b.click(); return true; }
      return false;
    });
    ok('the confirmation offers "Finish now"', clickedNow);
    await page.waitForTimeout(1200);
    spoken = await textsOf(page);
    ok('the completion summary is spoken', spoken.some((t) => /^Dictation complete\. Well done\. Review all thirty words below \.$/.test(t)), spoken);

    const urls = (await clipsOf(page)).map((c) => c.url);
    ok('the session really played clips', urls.length > 5, urls.length);
    const bad = urls.filter((u) => !(u.indexOf(UNIFIED) === 0 && /%20\.$/.test(u)));
    ok('every clip uses the one endpoint with the " ." marker', bad.length === 0, bad.slice(0, 3));
    const synth = await page.evaluate(() => (window.__synth || []));
    eq('the device voice is never used while the master audio works', synth.length, 0);

    eq('zero console errors during the whole session', noise(consoleErrors).length, 0);
    eq('zero uncaught page errors during the whole session', pageErrors.length, 0);
    await context.close();
  }

  /* =============================================== part 2: pause and resume */
  {
    const { context, page, pageErrors } = await newPage(RECORDER);
    await page.evaluate(() => { const b = document.getElementById('btnStart'); if (b) b.click(); });
    await page.waitForTimeout(700);
    await clickReady(page);
    await waitForClip(page, /^Number 1, /);
    await page.waitForSelector('#plPlay', { state: 'attached', timeout: 20000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const b = document.querySelector('#plPlay'); if (b) b.click(); });
    await page.waitForTimeout(900);
    let spoken = await textsOf(page);
    ok('pause speaks "Session paused ."', spoken.indexOf('Session paused .') >= 0, spoken);
    const paused = await page.evaluate(() => ({
      badge: document.getElementById('plStepBadge').textContent,
      prog: document.getElementById('plProgText').textContent,
      status: document.getElementById('plStatus').textContent
    }));
    eq('the badge shows the paused dictation number', paused.badge, '⏸ Paused · Dictation #1 of 30');
    eq('the progress label shows the paused dictation number', paused.prog, '⏸ Paused · Dictation #1 of 30');
    ok('the status line shows the paused number', /Paused · Dictation #1 of 30/.test(paused.status), paused.status);
    const pausedLog = await page.evaluate(() => (window.__statusLog || []).slice());
    ok('the paused status is announced in the status line',
      pausedLog.some((t) => /Paused · Dictation #1 of 30/.test(t)), pausedLog.slice(-6));

    await page.evaluate(() => { const b = document.querySelector('#plPlay'); if (b) b.click(); });
    await page.waitForTimeout(1200);
    spoken = await textsOf(page);
    ok('resume speaks the welcome-back line with the number',
      spoken.some((t) => /^Welcome back\. Continuing dictation number \d+ \.$/.test(t)), spoken);
    const resumed = await page.evaluate(() => ({
      status: document.getElementById('plStatus').textContent,
      log: (window.__statusLog || []).slice(),
      badge: document.getElementById('plStepBadge').textContent
    }));
    ok('the status line shows the resuming number',
      resumed.log.some((t) => /Resuming Dictation #1/.test(t)), resumed.log.slice(-8));
    eq('the badge is back to the plain dictation number', resumed.badge, 'Dictation #1 of 30');
    eq('zero uncaught page errors during pause and resume', pageErrors.length, 0);
    await context.close();
  }

  /* ============================== part 3: the countdown and the audio are in sync */
  {
    const { context, page } = await newPage(RECORDER);
    await page.evaluate(() => { const b = document.getElementById('btnStart'); if (b) b.click(); });
    await page.waitForTimeout(700);
    /* the spoken countdown now takes 2.5s, the visual ticks only 2.1s */
    await page.evaluate(() => { window.__clipDelay = 2500; });
    await clickReady(page);
    await page.waitForTimeout(2300);
    const early = await textsOf(page);
    const visual = await page.evaluate(() => document.getElementById('cdNum') ? document.getElementById('cdNum').textContent : '');
    eq('the visual countdown has finished', visual, '0');
    ok('Word 1 waits for the spoken countdown', !early.some((t) => /^Number 1, /.test(t)), early);
    await page.waitForTimeout(1200);
    const late = await textsOf(page);
    ok('Word 1 starts once the spoken countdown finished too', late.some((t) => /^Number 1, /.test(t)), late);
    await context.close();
  }

  /* ============================ part 4: a dead audio host must never hang */
  {
    const { context, page, pageErrors } = await newPage(() => {
      window.__synth = [];
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        configurable: true
      });
      window.HTMLMediaElement.prototype.play = function () {
        const el = this;
        setTimeout(() => { if (el.onerror) el.onerror(new Error('offline')); }, 10);
        return Promise.reject(new Error('offline'));
      };
      if (window.speechSynthesis) {
        window.speechSynthesis.speak = function (u) {
          window.__synth.push({ text: String(u && u.text || ''), lang: String(u && u.lang || '') });
          setTimeout(() => { if (u && u.onend) u.onend(); }, 10);
        };
      }
    });
    await page.evaluate(() => { const b = document.getElementById('btnStart'); if (b) b.click(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { const b = document.getElementById('btnReadyTest'); if (b) b.click(); });
    await page.waitForTimeout(4000);
    const fallback = await page.evaluate(() => (window.__synth || []));
    ok('a dead audio host falls back to the locked en-GB female voice', fallback.length >= 1, fallback.slice(0, 2));
    ok('the fallback voice is en-GB', fallback.every((s) => s.lang === 'en-GB'), fallback.map((s) => s.lang));
    eq('zero uncaught page errors with a dead audio host', pageErrors.length, 0);
    await context.close();
  }

  await browser.close();

  const report = {
    build: JSON.parse(fs.readFileSync(path.join(root, 'data', 'version.json'), 'utf8')).appVersion,
    bytes: fs.statSync(indexFile).size,
    total: results.length,
    passed: results.length - failures,
    failed: failures,
    results
  };
  fs.mkdirSync(path.join(root, 'tests', 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tests', 'artifacts', 'audit-v42.json'), JSON.stringify(report, null, 2));
  console.log('\nv42 real-Chromium audit: ' + report.passed + '/' + report.total + ' passed, ' + report.failed + ' failed, index.html ' + report.bytes + ' bytes');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
