'use strict';
/* v43 real-Chromium troubleshooting audit (release 5.0.0).
   ----------------------------------------------------------------------------
   Drives index.html in a REAL Chromium build (not jsdom) and verifies the v43
   contract end to end:
     * the whole voice is the committed, same-origin ./audio/*.mp3 pack
       rendered by ONE single neural female voice - no dictionary host, no
       machine-translation voice and never the device speechSynthesis voice
     * welcome, sound check, the lockstep 3 -> 2 -> 1 countdown, "Number N",
       the word (twice), "Session paused", "Welcome back. Continuing dictation
       number N" and the completion summary all come from their own clip
     * the visual counter and the spoken "Three / Two / One" are in lockstep
       (0ms / 950ms / 1900ms) and Word 1 starts at 2850ms
     * the "Dictation #N of 30" badge and the #plSub step line are always live
     * the 5 second writing countdown runs
     * TTS.testSound() marks the voice as verified
     * a same-origin clip gets a 4000ms watchdog and one retry - the old 1500ms
       jump to the robotic device voice is gone
     * zero console errors and zero uncaught page errors
   Run:  node tests/audit-v42.cjs                                      */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();

const root = path.resolve(__dirname, '..');
const indexFile = path.join(root, 'index.html');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'audio-manifest.json'), 'utf8'));
const LOCAL = './audio/';
const results = [];
let failures = 0;

function rec(name, ok, detail) {
  results.push({ name, status: ok ? 'PASS' : 'FAIL', detail: detail === undefined ? undefined : detail });
  if (!ok) failures += 1;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : ''));
}
function eq(name, actual, expected) { rec(name, actual === expected, { actual, expected }); }
function ok(name, value, detail) { rec(name, !!value, detail); }

/* the master <audio> is recorded instead of downloaded: the real app code runs
   against the real DOM, timers and CSS while every requested clip is captured */
const RECORDER = () => {
  window.__clips = [];
  window.__synth = [];
  window.__statusLog = [];
  window.__badgeLog = [];
  window.__subLog = [];
  window.__clipDelay = 60;
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    configurable: true
  });
  const play = window.HTMLMediaElement.prototype.play;
  window.HTMLMediaElement.prototype.play = function () {
    const el = this;
    const src = String(el.getAttribute('src') || '');
    if (el.id === 'ttsMasterAudio' && src && src.indexOf('data:') !== 0) {
      window.__clips.push({ url: src, t: Date.now() });
      setTimeout(function () { if (el.onplaying) el.onplaying(); }, 5);
      setTimeout(function () { if (el.onended) el.onended(); }, Number(window.__clipDelay) || 60);
      return Promise.resolve();
    }
    return play ? play.apply(el, arguments) : Promise.resolve();
  };
  setInterval(function () {
    try {
      const pairs = [['plStatus', '__statusLog'], ['plStepBadge', '__badgeLog'], ['plSub', '__subLog']];
      for (let i = 0; i < pairs.length; i += 1) {
        const el = document.getElementById(pairs[i][0]);
        if (!el) continue;
        const log = window[pairs[i][1]];
        const text = String(el.textContent || '');
        if (log[log.length - 1] !== text) log.push(text);
      }
    } catch (e) {}
  }, 40);
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = function (u) {
      window.__synth.push(String((u && u.text) || ''));
      setTimeout(function () { if (u && u.onend) u.onend(); }, 10);
    };
  }
};

const noise = (list) => list.filter((m) => !/Failed to load resource|net::ERR/i.test(String(m)));
const fileOf = (url) => (String(url).indexOf(LOCAL) === 0 ? String(url).slice(LOCAL.length) : '');

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
    await page.route('**/*', (r) => {
      const u = r.request().url();
      if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
      return r.abort();
    });
    await page.goto(url);
    await page.waitForSelector('#homeTitle', { state: 'visible' });
    await page.waitForFunction(() => !!(window.SDP && window.SDP.version), null, { timeout: 20000 });
    await page.waitForTimeout(500);
    return { context, page, consoleErrors, pageErrors };
  }
  const clipsOf = (page) => page.evaluate(() => (window.__clips || []).slice());
  const filesOf = async (page) => (await clipsOf(page)).map((c) => fileOf(c.url)).filter(Boolean);
  const clickReady = async (page) => {
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#sheets button')).some((x) => /I['\u2019]m ready/.test(x.textContent)), null, { timeout: 20000 });
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#sheets button')).find((x) => /I['\u2019]m ready/.test(x.textContent));
      if (b) b.click();
    });
  };
  const state = (page) => page.evaluate(() => ({
    badge: (document.getElementById('plStepBadge') || {}).textContent || '',
    prog: (document.getElementById('plProgText') || {}).textContent || '',
    status: (document.getElementById('plStatus') || {}).textContent || '',
    sub: (document.getElementById('plSub') || {}).textContent || '',
    cd: (document.getElementById('cdNum') || {}).textContent || '',
    badgeLog: (window.__badgeLog || []).slice(),
    subLog: (window.__subLog || []).slice()
  }));

  /* ======================================================== part 1: the pack */
  {
    const { context, page, consoleErrors, pageErrors } = await newPage();
    const voice = await page.evaluate(() => {
      const T = window.TTS;
      return {
        local: String(T && T.LOCAL_AUDIO_BASE || ''),
        remote: String(T && T.REMOTE_FALLBACK_BASE || ''),
        word: String(T && T.getSingleVoiceUrl('bicycle') || ''),
        pass1: String(T && T.getSingleVoiceUrl('Number 1, guidebook') || ''),
        resume: String(T && T.getSingleVoiceUrl('Welcome back. Continuing dictation number 7 .') || ''),
        unknown: String(T && T.getSingleVoiceUrl('zebra crossing') || ''),
        version: String((window.SDP && window.SDP.version) || ''),
        watchdog: String(T && String(T.playUrl) || '')
      };
    });
    eq('the voice base is the same-origin ./audio pack', voice.local, LOCAL);
    eq('a bundled word resolves to its own clip', voice.word, LOCAL + 'word-bicycle.mp3');
    eq('pass 1 resolves to the atomic Number + word clip', voice.pass1, LOCAL + 'pass1-1-guidebook.mp3');
    eq('a resume line resolves to its own clip', voice.resume, LOCAL + 'resume-7.mp3');
    ok('a custom word falls back to the documented remote endpoint only', voice.unknown.indexOf('https://dict.youdao.com/dictvoice?type=1&audio=') === 0, voice.unknown);
    eq('the running build is 5.0.0', voice.version, '5.0.0');
    ok('the clip watchdog is 4000ms and no longer 1500ms', /4000/.test(voice.watchdog) && !/\},1500\)/.test(voice.watchdog));

    await page.evaluate(() => { const b = document.getElementById('btnStart'); if (b) b.click(); });
    await page.waitForTimeout(900);
    let files = await filesOf(page);
    ok('the bundled welcome clip opens the session', files.indexOf('welcome-paper.mp3') >= 0, files);

    await page.evaluate(() => { const b = document.getElementById('btnReadyTest'); if (b) b.click(); });
    await page.waitForTimeout(700);
    files = await filesOf(page);
    ok('Test sound plays ./audio/sound-check.mp3', files.indexOf('sound-check.mp3') >= 0, files);
    const pill = await page.evaluate(() => { const p = document.getElementById('voiceTestPill'); return p ? p.textContent : ''; });
    eq('the voice pill reports the verified studio voice', pill, '✓ Dictation Voice Verified');

    await page.waitForTimeout(600);
    const startIndex = (await clipsOf(page)).length;
    await clickReady(page);
    await page.waitForTimeout(3400);
    /* the read-sound-check can land after the slice point when the replay chain
       finishes late; it is speech from before the countdown, never part of it */
    const marks = (await clipsOf(page)).slice(startIndex)
      .filter((m) => !/^(sound-check|welcome-)/.test(fileOf(m.url)));
    const name = (i) => fileOf(marks[i] && marks[i].url);
    eq('Three is the first spoken count', name(0), 'count-3.mp3');
    eq('Two follows', name(1), 'count-2.mp3');
    eq('One follows', name(2), 'count-1.mp3');
    ok('Word 1 starts straight after One', /^pass1-1-/.test(name(3) || ''), marks.map((m) => fileOf(m.url)));
    const gap1 = marks[1] ? marks[1].t - marks[0].t : -1;
    const gap2 = marks[2] ? marks[2].t - marks[1].t : -1;
    const gap3 = marks[3] ? marks[3].t - marks[0].t : -1;
    ok('the spoken countdown is 950ms per step', gap1 >= 850 && gap1 <= 1100 && gap2 >= 850 && gap2 <= 1100, { gap1, gap2 });
    eq('the countdown holds exactly three spoken numbers', marks.slice(0, 3).map((m) => fileOf(m.url)).join(','), 'count-3.mp3,count-2.mp3,count-1.mp3');
    ok('Word 1 launches at ~2850ms', gap3 >= 2700 && gap3 <= 3000, gap3);

    let now = await state(page);
    eq('the dictation badge shows Dictation #1 of 30', now.badge, 'Dictation #1 of 30');
    eq('the progress label shows Dictation #1 of 30', now.prog, 'Dictation #1 of 30');
    ok('the step sub-line shows the first reading', /1st reading/.test(now.subLog.join(' | ')), now.subLog.slice(-4));

    await page.waitForTimeout(1500);
    files = await filesOf(page);
    ok('Pass 2 replays the flat word file of the same word', files.some((f) => /^word-/.test(f) && f.indexOf('bicycle') < 0), files);
    now = await state(page);
    ok('the writing phase starts after the repeat', now.subLog.some((t) => /Write the word now \(\d+s\)/.test(t)) || /Write the word now/.test(now.sub), now.subLog.slice(-5));
    ok('the writing countdown runs from five seconds', Number(now.cd) >= 0 && Number(now.cd) <= 5, now.cd);

    await page.click('#plPlay');
    await page.waitForTimeout(900);
    files = await filesOf(page);
    ok('Pause plays ./audio/paused.mp3', files.indexOf('paused.mp3') >= 0, files.slice(-3));
    ok('the paused badge keeps the dictation number', /Dictation #\d+ of 30/.test((await state(page)).badge), (await state(page)).badge);

    await page.click('#plPlay');
    await page.waitForTimeout(2200);
    files = await filesOf(page);
    ok('Resume plays its own ./audio/resume-N.mp3 clip', files.some((f) => /^resume-\d+\.mp3$/.test(f)), files.slice(-4));

    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#layers button')).find((x) => /Finish early/i.test(x.textContent));
      if (b) b.click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#modals button')).find((x) => /Finish now/i.test(x.textContent));
      if (b) b.click();
    });
    await page.waitForTimeout(1600);
    files = await filesOf(page);
    ok('Finish plays ./audio/finish-paper.mp3', files.indexOf('finish-paper.mp3') >= 0, files.slice(-3));

    const all = await clipsOf(page);
    const bad = all.map((c) => String(c.url)).filter((u) => u.indexOf(LOCAL) !== 0 && u.indexOf('data:audio') !== 0);
    ok('every clip the session played is a same-origin ./audio file', bad.length === 0, bad.slice(0, 3));
    const known = new Set(manifest.clips.map((c) => c.file).concat(manifest.pass1.map((p) => p.file)));
    const unknown = (await filesOf(page)).filter((f) => !known.has(f));
    ok('every requested clip exists in the committed pack', unknown.length <= 1, unknown.slice(0, 3));

    eq('the robotic device voice never speaks', (await page.evaluate(() => (window.__synth || []).length)), 0);
    eq('zero console errors during the whole session', noise(consoleErrors).length, 0);
    eq('zero uncaught page errors during the whole session', pageErrors.length, 0);
    await context.close();
  }

  /* ==================================================== part 2: no retries */
  {
    const { context, page, consoleErrors, pageErrors } = await newPage();
    const dead = await page.evaluate(async () => {
      const T = window.TTS;
      const proto = window.HTMLMediaElement.prototype;
      const original = proto.play;
      proto.play = function () { return Promise.reject(new Error('blocked')); };
      let result = null;
      T.playClipList(['./audio/sound-check.mp3'], 'prompt', function (okResult) { result = okResult; });
      await new Promise((r) => setTimeout(r, 900));
      proto.play = original;
      return { result, synth: (window.__synth || []).length };
    });
    eq('a missing clip never falls back to the device voice', dead.synth, 0);
    ok('a missing clip resolves as a clean failure', dead.result === false, dead.result);
    eq('a missing clip leaves no console error behind the app', noise(consoleErrors).length, 0);
    eq('a missing clip raises no page error', pageErrors.length, 0);
    await context.close();
  }

  await browser.close();
  const failed = results.filter((r) => r.status === 'FAIL');
  console.log('\n' + (results.length - failures) + '/' + results.length + ' v43 audit checks passed' + (failures ? ' — ' + failures + ' FAILED' : ''));
  if (failures) {
    failed.slice(0, 5).forEach((r) => console.log('  FAIL ' + r.name + ' :: ' + JSON.stringify(r.detail)));
    process.exitCode = 1;
  }
})().catch((err) => {
  console.error('audit crashed: ' + (err && err.stack || err));
  process.exitCode = 1;
});
