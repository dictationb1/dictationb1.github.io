'use strict';
/* v44 real-Chromium audio audit (the historical filename is retained).
   Verifies same-origin neural clips, dynamic number/word mapping, the
   sequenced 3-2-1 countdown, the five-second timer, pause/resume/finish,
   progress dots and error-free handling of failed playback. Custom content
   retains its documented remote fallback. Run: node tests/audit-v42.cjs */
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
    await page.waitForSelector('#homeTitle', { state: 'attached' });
    await page.waitForFunction(() => !!(window.SDP && window.SDP.version), null, { timeout: 20000 });
    /* The first-run guide is delayed. Close it before starting this audit so
       it cannot race the ready sheet on a heavily loaded runner. */
    const closeGuide = page.locator('#guideSheet .shead button[aria-label="Close"]');
    await closeGuide.waitFor({ state:'visible', timeout:12000 });
    await closeGuide.evaluate((b) => b.click());
    await page.waitForSelector('#homeTitle', { state:'visible' });
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
    subLog: (window.__subLog || []).slice(),
    statusLog: (window.__statusLog || []).slice(),
    dots: document.querySelectorAll('#plProgressDots .progress-dot').length
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
    eq('pass 1 starts with the numbered clip', voice.pass1, LOCAL + 'num-1.mp3');
    eq('a resume line resolves to its own clip', voice.resume, LOCAL + 'resume-7.mp3');
    ok('a custom word falls back to the documented remote endpoint only', voice.unknown.indexOf('https://dict.youdao.com/dictvoice?type=1&audio=') === 0, voice.unknown);
    eq('the running build is 5.1.0', voice.version, '5.1.0');
    ok('the clip watchdog is 4000ms and no longer 1500ms', /(?:4000|4e3)/.test(voice.watchdog) && !/\},1500\)/.test(voice.watchdog));

    await page.evaluate(() => { const b = document.getElementById('btnStart'); if (b) b.click(); });
    await page.waitForTimeout(900);
    let files = await filesOf(page);
    ok('the bundled welcome clip opens the session', files.indexOf('welcome-paper.mp3') >= 0, files);

    await page.evaluate(() => { const b = document.getElementById('btnReadyTest'); if (b) b.click(); });
    await page.waitForTimeout(700);
    files = await filesOf(page);
    ok('Test sound plays ./audio/sound-check.mp3', files.indexOf('sound-check.mp3') >= 0, files);
    const pill = await page.evaluate(() => { const p = document.getElementById('voiceTestPill'); return p ? p.textContent : ''; });
    eq('the debug voice pill is removed', pill, '');

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
    eq('Word 1 begins with its number after One', name(3), 'num-1.mp3');
    eq('the numbered cue is followed by the actual first word', name(4), 'word-guidebook.mp3');
    const gap1 = marks[1] ? marks[1].t - marks[0].t : -1;
    const gap2 = marks[2] ? marks[2].t - marks[1].t : -1;
    const gap3 = marks[3] ? marks[3].t - marks[0].t : -1;
    ok('the spoken countdown holds each number for at least 500ms', gap1 >= 480 && gap1 <= 1200 && gap2 >= 480 && gap2 <= 1200, { gap1, gap2 });
    eq('the countdown holds exactly three spoken numbers', marks.slice(0, 3).map((m) => fileOf(m.url)).join(','), 'count-3.mp3,count-2.mp3,count-1.mp3');
    ok('Word 1 launches only after all three numbers', gap3 >= 1450 && gap3 <= 3600, gap3);

    let now = await state(page);
    eq('the duplicate dictation badge is removed', now.badge, '');
    eq('progress dots cover all 30 words', now.dots, 30);
    eq('the progress label shows Dictation #1 of 30', now.prog, 'Dictation #1 of 30');
    ok('the primary status announces the first reading', /first reading/.test(now.statusLog.join(' | ')), now.statusLog.slice(-4));

    await page.waitForTimeout(1500);
    files = await filesOf(page);
    ok('Pass 2 replays the flat word file of the same word', files.some((f) => /^word-/.test(f) && f.indexOf('bicycle') < 0), files);
    now = await state(page);
    ok('the writing phase starts after the repeat', now.statusLog.some((t) => /Write the word now|Your turn/.test(t)), now.statusLog.slice(-5));
    ok('the writing countdown runs from five seconds', Number(now.cd) >= 0 && Number(now.cd) <= 5, now.cd);

    await page.click('#plPlay');
    await page.waitForTimeout(900);
    files = await filesOf(page);
    ok('Pause plays ./audio/paused.mp3', files.indexOf('paused.mp3') >= 0, files.slice(-3));
    ok('the progress label keeps the dictation number while paused', /Dictation #\d+ of 30/.test((await state(page)).prog), (await state(page)).prog);

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
    const known = new Set(manifest.clips.map((c) => c.file));
    const unknown = (await filesOf(page)).filter((f) => !known.has(f));
    ok('every requested clip exists in the committed pack', unknown.length === 0, unknown.slice(0, 3));

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
  console.log('\n' + (results.length - failures) + '/' + results.length + ' v44 audit checks passed' + (failures ? ' — ' + failures + ' FAILED' : ''));
  if (failures) {
    failed.slice(0, 5).forEach((r) => console.log('  FAIL ' + r.name + ' :: ' + JSON.stringify(r.detail)));
    process.exitCode = 1;
  }
})().catch((err) => {
  console.error('audit crashed: ' + (err && err.stack || err));
  process.exit(1);
});
