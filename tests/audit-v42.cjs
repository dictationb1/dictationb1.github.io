'use strict';
/* v48 real-Chromium audio audit (the historical filename is retained).
   The real app and DOM run with remote media recorded instead of downloaded.
   No local audio pack, synthetic waveform or device speech is involved. */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const root = path.resolve(__dirname, '..');
const indexFile = path.join(root, 'index.html');
const GB = 'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=en-GB&ttsspeed=0.95&q=';
const OXFORD = 'https://ssl.gstatic.com/dictionary/static/sounds/20200429/';
const YOUDAO = 'https://dict.youdao.com/dictvoice?type=1&audio=';
const results = [];
let failures = 0;
function rec(name, pass, detail) {
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
  if (!pass) failures += 1;
  console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (detail === undefined ? '' : '  ' + JSON.stringify(detail)));
}
function eq(name, actual, expected) { rec(name, actual === expected, { actual, expected }); }
function ok(name, value, detail) { rec(name, !!value, detail); }
function textOf(url) {
  const value = String(url || '');
  if (value.indexOf(OXFORD) === 0) return value.slice(OXFORD.length).split('--_gb_1')[0];
  try { const u = new URL(value); return u.searchParams.get('audio') || u.searchParams.get('q') || value; } catch (e) { return value; }
}
const RECORDER = () => {
  window.__clips = [];
  window.__loads = [];
  window.__synth = [];
  window.__statusLog = [];
  window.__badgeLog = [];
  window.__subLog = [];
  window.__clipDelay = 60;
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', configurable: true
  });
  const proto = window.HTMLMediaElement.prototype;
  const play = proto.play, load = proto.load, pause = proto.pause;
  proto.load = function () {
    if (this.id !== 'ttsMasterAudio') return load.call(this);
    window.__loads.push(String(this.getAttribute('src') || ''));
  };
  proto.pause = function () { if (this.id !== 'ttsMasterAudio') return pause.call(this); };
  proto.play = function () {
    const el = this;
    if (el.id !== 'ttsMasterAudio') return play.apply(el, arguments);
    const src = String(el.getAttribute('src') || '');
    window.__clips.push({ url: src, t: Date.now(), rate: el.playbackRate, loads: window.__loads.length });
    setTimeout(function () { if (el.onplaying) el.onplaying(); }, 5);
    setTimeout(function () { if (el.onended) el.onended(); }, Number(window.__clipDelay) || 60);
    return Promise.resolve();
  };
  setInterval(function () {
    try {
      const pairs = [['plStatus', '__statusLog'], ['plStepBadge', '__badgeLog'], ['plSub', '__subLog']];
      for (let i = 0; i < pairs.length; i += 1) {
        const el = document.getElementById(pairs[i][0]);
        if (!el) continue;
        const log = window[pairs[i][1]], text = String(el.textContent || '');
        if (log[log.length - 1] !== text) log.push(text);
      }
    } catch (e) {}
  }, 40);
  if (window.speechSynthesis) window.speechSynthesis.speak = function (u) { window.__synth.push(String((u && u.text) || '')); };
};
const noise = (list) => list.filter((m) => !/Failed to load resource|net::ERR/i.test(String(m)));
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.SDP_BROWSER_BIN || await serverChromium.executablePath(),
    args: serverChromium.args.filter((a) => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a))
  });
  const url = require('url').pathToFileURL(indexFile).href;
  async function newPage() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const consoleErrors = [], pageErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.addInitScript(RECORDER);
    await page.route('**/*', (r) => /^(file:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
    await page.goto(url);
    await page.waitForSelector('#homeTitle', { state: 'attached' });
    await page.waitForFunction(() => !!(window.SDP && window.SDP.version), null, { timeout: 20000 });
    const closeGuide = page.locator('#guideSheet .shead button[aria-label="Close"]');
    await closeGuide.waitFor({ state: 'visible', timeout: 12000 });
    await closeGuide.evaluate((b) => b.click());
    await page.waitForSelector('#homeTitle', { state: 'visible' });
    return { context, page, consoleErrors, pageErrors };
  }
  const clipsOf = (page) => page.evaluate(() => (window.__clips || []).slice());
  const clickReady = async (page) => {
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#sheets button')).some((x) => /I['\u2019]m ready/.test(x.textContent)), null, { timeout: 20000 });
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#sheets button')).find((x) => /I['\u2019]m ready/.test(x.textContent)); if (b) b.click(); });
  };
  const state = (page) => page.evaluate(() => ({
    badge: (document.getElementById('plStepBadge') || {}).textContent || '',
    prog: (document.getElementById('plProgText') || {}).textContent || '',
    cd: (document.getElementById('cdNum') || {}).textContent || '',
    statusLog: (window.__statusLog || []).slice(),
    dots: document.querySelectorAll('#plProgressDots .progress-dot').length
  }));

  {
    const { context, page, consoleErrors, pageErrors } = await newPage();
    const voice = await page.evaluate(() => {
      const T = window.TTS, a = T.master();
      return {
        local: String(T.LOCAL_AUDIO_BASE || ''), cache: String(T.CACHE_NAME || ''),
        word: T.getSingleVoiceUrl('afraid'), number: T.getSingleVoiceUrl('Number 1'),
        phrase: T.getSingleVoiceUrl('zebra crossing'), si: T.getSingleVoiceUrl('ආයුබෝවන්', 'si'),
        version: window.SDP.version,
        preload: a.getAttribute('preload'), playsinline: a.hasAttribute('playsinline'),
        referrer: a.getAttribute('referrerpolicy'), cross: a.hasAttribute('crossorigin')
      };
    });
    eq('no local audio base or generated pack remains', voice.local, '');
    ok('the one unified Cambridge British en-GB stream is active', voice.word === GB + 'afraid', voice.word);
    ok('a numbered phrase uses the same single voice', voice.number === GB + 'Number%201', voice.number);
    ok('a custom phrase uses the same single voice', voice.phrase === GB + 'zebra%20crossing', voice.phrase);
    ok('Sinhala uses the si stream of the same engine', /tl=si&q=/.test(voice.si), voice.si);
    eq('the pinned cache bucket is sdp-voice-v48', voice.cache, 'sdp-voice-v48');
    eq('the running build is 5.4.0', voice.version, '5.4.0');
    ok('one unlocked master element has the required attributes', voice.preload === 'auto' && voice.playsinline && voice.referrer === 'no-referrer' && !voice.cross, voice);

    await page.evaluate(() => document.getElementById('btnStart').click());
    await page.waitForTimeout(900);
    let clips = await clipsOf(page);
    ok('the ready instruction is remote human audio', clips.some((c) => textOf(c.url).indexOf('Welcome.') === 0), clips.map((c) => textOf(c.url)));
    await page.evaluate(() => document.getElementById('btnReadyTest').click());
    await page.waitForTimeout(700);
    clips = await clipsOf(page);
    ok('Test sound uses the same remote engine', clips.some((c) => /Sound%20check/.test(c.url)), clips.map((c) => textOf(c.url)));
    eq('the debug voice pill stays removed', await page.locator('#voiceTestPill').count(), 0);

    const startIndex = clips.length;
    await clickReady(page);
    await page.waitForTimeout(3400);
    const marks = (await clipsOf(page)).slice(startIndex).filter((m) => !/^(Sound check|Welcome\.)/.test(textOf(m.url)));
    eq('Three is the first spoken count', textOf(marks[0] && marks[0].url), 'Three');
    eq('Two follows', textOf(marks[1] && marks[1].url), 'Two');
    eq('One follows', textOf(marks[2] && marks[2].url), 'One');
    eq('Word 1 announces its number and the word in one stream', textOf(marks[3] && marks[3].url), 'Number 1, afraid');
    eq('Pass 2 replays only the clean word', textOf(marks[4] && marks[4].url), 'afraid');
    eq('Pass 2 reuses the one master element', await page.evaluate(() => document.querySelectorAll('audio#ttsMasterAudio').length), 1);
    ok('the loaded word URL is remembered for zero-network replays', await page.evaluate(() => String(window.TTS._lastLoadedUrl || '').indexOf('tl=en-GB') >= 0));
    ok('the pinned cache bucket and blob cache exist', await page.evaluate(() => String(window.TTS.CACHE_NAME) === 'sdp-voice-v48' && !!window.TTS._blobCache));
    const gap1 = marks[1] ? marks[1].t - marks[0].t : -1, gap2 = marks[2] ? marks[2].t - marks[1].t : -1;
    ok('the spoken countdown holds each number for at least 500ms', gap1 >= 480 && gap1 <= 1200 && gap2 >= 480 && gap2 <= 1200, { gap1, gap2 });
    const wordGap = marks[4] && marks[3] ? marks[4].t - marks[3].t : -1;
    ok('Pass 2 follows the first reading after about 650ms', wordGap >= 630 && wordGap <= 1200, wordGap);

    let now = await state(page);
    eq('the duplicate dictation badge is removed', now.badge, '');
    eq('progress dots cover all 30 words', now.dots, 30);
    eq('the progress label shows Dictation #1 of 30', now.prog, 'Dictation #1 of 30');
    ok('the writing phase starts after Pass 2', now.statusLog.some((t) => /Write the word now|Your turn/.test(t)), now.statusLog.slice(-5));
    ok('the writing countdown runs from five seconds', Number(now.cd) >= 0 && Number(now.cd) <= 5, now.cd);

    await page.click('#plPlay');
    await page.waitForTimeout(900);
    clips = await clipsOf(page);
    ok('Pause uses remote human audio', clips.some((c) => /Session%20paused/.test(c.url)), clips.slice(-3).map((c) => textOf(c.url)));
    await page.click('#plPlay');
    await page.waitForTimeout(1800);
    clips = await clipsOf(page);
    ok('Resume uses remote human audio', clips.some((c) => /Welcome%20back/.test(c.url)), clips.slice(-4).map((c) => textOf(c.url)));

    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#layers button')).find((x) => /Finish early/i.test(x.textContent)); if (b) b.click(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#modals button')).find((x) => /Finish now/i.test(x.textContent)); if (b) b.click(); });
    await page.waitForTimeout(1200);
    clips = await clipsOf(page);
    ok('Finish uses remote human audio', clips.some((c) => /Dictation%20complete/.test(c.url)), clips.slice(-3).map((c) => textOf(c.url)));
    const bad = clips.map((c) => c.url).filter((u) => /^https?:/i.test(u) && !/^https:\/\/(ssl\.gstatic\.com|dict\.youdao\.com|translate\.googleapis\.com)\//.test(u));
    eq('every session clip is an allowed real remote source', bad.length, 0);
    eq('the robotic device voice never speaks', await page.evaluate(() => (window.__synth || []).length), 0);
    eq('zero console errors during the session', noise(consoleErrors).length, 0);
    eq('zero uncaught page errors during the session', pageErrors.length, 0);
    await context.close();
  }

  {
    const { context, page, consoleErrors, pageErrors } = await newPage();
    const dead = await page.evaluate(async () => {
      const T = window.TTS, proto = window.HTMLMediaElement.prototype, original = proto.play;
      proto.play = function () { return Promise.reject(new Error('blocked')); };
      let result = null;
      T.playClipList(['https://ssl.gstatic.com/dictionary/static/sounds/20200429/missing--_gb_1.mp3'], 'prompt', function (value) { result = value; });
      await new Promise((r) => setTimeout(r, 150));
      proto.play = original;
      return { result, synth: (window.__synth || []).length };
    });
    eq('a missing clip never falls back to device speech', dead.synth, 0);
    eq('a live-browser media failure resolves cleanly as false', dead.result, false);
    const fast = await page.evaluate(async () => {
      const T = window.TTS, original = T.isHeadless;
      T.isHeadless = function () { return true; };
      const started = Date.now();
      let done = -1;
      T.speakStudioText('Number 1', 'en', function () { done = Date.now() - started; });
      await new Promise((r) => setTimeout(r, 100));
      T.isHeadless = original;
      return done;
    });
    ok('HeadlessChrome failure completion is about 50ms', fast >= 35 && fast <= 90, fast);
    eq('failed playback leaves no console error', noise(consoleErrors).length, 0);
    eq('failed playback raises no page error', pageErrors.length, 0);
    await context.close();
  }

  await browser.close();
  console.log('\n' + (results.length - failures) + '/' + results.length + ' v48 audit checks passed' + (failures ? ' — ' + failures + ' FAILED' : ''));
  if (failures) process.exitCode = 1;
})().catch((err) => { console.error('audit crashed: ' + (err && err.stack || err)); process.exit(1); });
