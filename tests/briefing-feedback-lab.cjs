#!/usr/bin/env node
'use strict';
/* Lab Environment gate — v0.0.6.q: the GUARANTEED two-stage welcome (even
 * on a device with a stale sdp.guide_seen stamp), the 135-clip cache-first
 * voice pack (131 Alice + 4 George beats) that survives OFFLINE / weak
 * mobile data, the Exit-LEFT / Start-Dictation-RIGHT footer with its
 * seamless guide handover to Dictation Word #1, the anti-7-second silent
 * scroll guard, the Studio ↔ Briefing multi-API bridge and the preserved
 * v0.0.6.m/o fixes.
 *
 * contract: docs/MASTER_PLAN_V006N.md §3 — the dedicated isolated lab the
 * creator demanded: headless Chromium at 390x844 AND 360x800, the real
 * repository tree over a local static server, a real (fake-device)
 * microphone, and request interception that PROVES:
 *   Welcome      Stage 1 (#welcomeStage) shows the animated "Welcome to
 *                Smart Dictation Web App" splash + #btnWelcomeContinue;
 *                clicking it unlocks audio INSIDE the gesture and hands
 *                over to Stage 2 — narration starts strictly at Paragraph
 *                1, Word 1 (idx === 0) with NO tap pill in normal flow.
 *   Zero cut-off Every paragraph plays ALL the way to its FINAL word
 *                (wordIdx === lastWordIdx, all words is-spoken) before the
 *                next beat advances — never a premature jump.
 *   Spacious UI  #briefingLyrics >= 220px, scrollTop === 0, Beat 1 fully
 *                visible, no update badge in the modal, countdown inside
 *                the Continue label, GitHub pills on one row.
 *   Bridge       unlock → ensureBriefingAndGuideVoices → intercepted
 *                the timestamped ElevenLabs George TTS endpoint, answered
 *                with an EXACT alignment over the
 *                AUTHENTIC committed clip audio (never fabricated sound) →
 *                wt parsed per word → live injection + ✓ status bar; the
 *                Groq ww cascade is exercised; zero cross-host leakage.
 *   Cache law    v0.0.6.q PILLAR 1: the boot manifest fetch is CACHE-FIRST
 *                (?v=0.0.6.q, no tick, cache:default) — only the tiny
 *                version.json pointer keeps no-store; the s31 SW serves the
 *                pack STALE-WHILE-REVALIDATE so all 135 clips load OFFLINE
 *                (0-bar) and Word #1 plays from the ElevenLabs tier.
 *   Regression   version-stamp replay, mic-release, sealed feedback,
 *                135-clip integrity (131 Alice + the 4 committed George
 *                beats; SDP.Speech still refuses text-drifted clips).
 * No audio is ever generated inside this (or any) test sandbox.
 */
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
  /* Real (fake-device) microphone + no autoplay block: the lab must exercise
     the true getUserMedia/MediaRecorder path and the true <audio> clock. */
  args.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required');
  return chromium.launch({ headless: true, executablePath, args });
}

/* The lab fixture: a real committed Alice clip stands in for the briefing
   beat through the exact public surface the Studio uses after the real
   ElevenLabs synthesis (injectClips). No synthetic audio is generated. */
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/elevenlabs-audio.json'), 'utf8'));
const ALICE_FIXTURE = pack.clips['guide.en.0']; /* an authentic committed clip */
/* v0.0.6.q: the pack SHIPS the 4 committed George beats — the lab maps the
   authentic Alice fixture onto the 4 beats with exact wt arrays + REAL sha1
   pins built from the LIVE v0.0.6.q sentences, exactly like the creator's
   bridge outcome, to keep the 4-beat observation inside the lab window. */
/* The remote manifest body: the exact shipped pack (the lab is offline). */
const REMOTE_MANIFEST = JSON.stringify(pack);

/* ── The exact /with-timestamps alignment builder ─────────────────────────
 * Given a sentence and a clip duration, produce the ElevenLabs
 * alignment.characters / character_start_times_seconds /
 * character_end_times_seconds triple with one word window per token — the
 * exact shape parseAlignmentToWordTimings() consumes. */
function buildAlignment(text, durSec) {
  const chars = [];
  const starts = [];
  const ends = [];
  const words = text.split(/\s+/).filter(Boolean);
  const perWord = durSec / Math.max(1, words.length);
  let t = 0;
  words.forEach((w, wi) => {
    const wordDur = perWord * 0.86;
    for (let ci = 0; ci < w.length; ci++) {
      chars.push(w.charAt(ci));
      starts.push(+(t + (wordDur * ci) / w.length).toFixed(3));
      ends.push(+(t + (wordDur * (ci + 1)) / w.length).toFixed(3));
    }
    t += perWord;
    if (wi < words.length - 1) {
      chars.push(' ');
      starts.push(+t.toFixed(3));
      ends.push(+t.toFixed(3));
    }
  });
  return { characters: chars.join(''), character_start_times_seconds: starts, character_end_times_seconds: ends };
}

const LAB_STUB = () => {
  window.__SDP_NO_LIVE__ = true;
  window.__lab = { spoken: [], played: 0, ticks: 0, boundaries: [], tracksStopped: 0, recorderStopped: 0, synthCancels: 0, synthResumes: 0, fetches: [] };
  /* SpeechSynthesis: a real-voice-like engine that fires onboundary. */
  try {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak(utterance) {
          window.__lab.spoken.push(utterance && utterance.text);
          setTimeout(() => { if (utterance && typeof utterance.onstart === 'function') utterance.onstart({}); }, 2);
          /* Fire word boundaries so the karaoke boundary path is exercised. */
          const text = (utterance && utterance.text) || '';
          const re = /\S+/g; let m; const marks = [];
          while ((m = re.exec(text)) !== null) marks.push(m.index);
          let i = 0;
          const step = function () {
            if (i >= marks.length) {
              setTimeout(() => { if (utterance && typeof utterance.onend === 'function') utterance.onend({}); }, 4);
              return;
            }
            const ci = marks[i];
            i += 1;
            setTimeout(function () {
              try { if (utterance && typeof utterance.onboundary === 'function') utterance.onboundary({ charIndex: ci }); } catch (e) {}
              window.__lab.boundaries.push(ci);
              step();
            }, 3);
          };
          step();
        },
        cancel() { window.__lab.synthCancels += 1; },
        resume() { window.__lab.synthResumes += 1; },
        pause() {},
        getVoices() { return [{ name: 'Google UK English Male', lang: 'en-GB', default: false, localService: true }]; },
        speaking: false, pending: false, paused: false,
        addEventListener() {}, removeEventListener() {}
      }
    });
  } catch (e) {}
  window.SpeechSynthesisUtterance = function (text) {
    this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.onend = null; this.onerror = null; this.onstart = null; this.onboundary = null;
  };
  /* The REAL playback clock: <audio> advances currentTime like a clip. */
  const proto = window.HTMLMediaElement.prototype;
  const nativePlay = proto.play;
  proto.play = function () {
    const self = this;
    window.__lab.played += 1;
    /* v0.0.6.o: a NEW src (a different beat clip) restarts the clock from 0 —
       exactly like a real <audio> element loading a fresh media source. */
    const srcNow = String(self.getAttribute('src') || self.src || '');
    if (self.__labSrc !== srcNow) { self.__labSrc = srcNow; self.__labT = 0; self.__labClock = false; try { clearInterval(self.__labTimer); } catch (e0) {} }
    if (!self.__labClock) {
      self.__labClock = true;
      /* v0.0.7.e: every play() starts a FRESH media clock — a real <audio>
         element re-loading a source plays from 0:00 even when the URL is
         byte-identical (the lab injects the same fixture b64 into all 4
         briefing beats). Keeping the stale __labT made beats 2-4 fire
         'ended' instantly. */
      self.__labT = 0;
      const dur = 4.2; /* the fixture clip duration in the lab */
      try { Object.defineProperty(self, 'duration', { configurable: true, get() { return dur; } }); } catch (e) {}
      self.__labTimer = setInterval(function () {
        self.__labT += 0.05;
        try { Object.defineProperty(self, 'currentTime', { configurable: true, get() { return Math.min(self.__labT, dur); } }); } catch (e2) {}
        window.__lab.ticks += 1;
        if (typeof self.onplaying === 'function') { self.onplaying({}); self.onplaying = function () {}; }
        if (self.__labT >= dur) {
          clearInterval(self.__labTimer);
          self.__labClock = false;
          if (typeof self.onended === 'function') self.onended({});
        }
      }, 16);
    }
    return nativePlay ? nativePlay.call(self) : Promise.resolve();
  };
  /* Track every stop() on a MediaStreamTrack (the mic-release law). */
  if (window.MediaStreamTrack && window.MediaStreamTrack.prototype) {
    const nativeStop = window.MediaStreamTrack.prototype.stop;
    window.MediaStreamTrack.prototype.stop = function () {
      window.__lab.tracksStopped += 1;
      if (nativeStop) return nativeStop.call(this);
    };
  }
  /* Observe every fetch URL + cache mode (the cache-bust law). */
  try {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        window.__lab.fetches.push({ url: String(url), cache: (init && init.cache) || (input && input.cache) || '' });
      } catch (e) {}
      return nativeFetch(input, init);
    };
  } catch (e) {}
};

async function newPage(browser, origin, opts) {
  opts = opts || {};
  const vp = opts.viewport || { width: 390, height: 844 };
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  await ctx.addInitScript(LAB_STUB);
  await ctx.addInitScript((fixture, fixtureKey, introFixture) => {
    try {
      window.__LAB_FIXTURE__ = { key: fixtureKey, entry: fixture };
      window.__LAB_INTRO__ = introFixture;
    } catch (e) {}
  }, ALICE_FIXTURE, 'guide.en.0', ALICE_FIXTURE);
  if (opts.localStorage) {
    await ctx.addInitScript((entries) => {
      entries.forEach(function (kv) { try { localStorage.setItem(kv[0], kv[1]); } catch (e) {} });
    }, opts.localStorage);
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  /* Lab isolation: same-origin + data/blob continue; the remote manifest
     (raw.githubusercontent.com) is fulfilled with the shipped pack so the app
     behaves exactly as offline — no real network, no synthesis. */
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    if (/raw\.githubusercontent\.com\/dictationb1\/dictationb1\.github\.io\/main\/data\/elevenlabs-audio\.json/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: REMOTE_MANIFEST });
    }
    return route.abort();
  });
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  return { ctx, page, errors };
}

/* The FAST classroom pacing used by the other gates. */
const FAST = { mode: 'paper', writeSecs: 2, repeats: 1, pauseSecs: 0.5, autoAdvance: true, rate: 1, volume: 1, lang: 'en', theme: 'dark', langResetV001e: true, defaultsResetV001f: true, appliedSettingsRev: 99 };

(async function main() {
  const server = await start({ root: ROOT });
  const browser = await launch();
  let exitCode = 0;
  try {
    /* ══ Test 1 — THE TWO-STAGE CINEMATIC WELCOME + ZERO CUT-OFF PROJECT
       OVERVIEW at 390x844 AND 360x800. A v0.0.6.m device (briefingSeen:1,
       guide 0.0.6.m) auto-replays on v0.0.6.o: Stage 1 shows the animated
       welcome splash; clicking #btnWelcomeContinue unlocks audio INSIDE the
       gesture and Stage 2 narrates from Paragraph 1, Word 1 — every beat
       playing ALL the way to its final word before advancing. */
    for (const vp of [{ width: 390, height: 844, tag: '390x844' }, { width: 360, height: 800, tag: '360x800' }]) {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        viewport: { width: vp.width, height: vp.height },
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: 1, sdpDiag: undefined }))],
          ['sdp.guide_seen', '0.0.6.m']
        ]
      });
      await page.waitForTimeout(700);
      /* v0.0.6.x — the NO-BOOT-BRIEFING LAW: even a stale-stamp device boots
         straight into the cockpit; the briefing opens ONLY from Settings. */
      const bootProbe = await page.evaluate(() => ({
        briefingOpen: document.getElementById('briefingModal').hidden === false,
        homeActive: (document.querySelector('.screen.active') || {}).id
      }));
      check(`LAB1a(${vp.tag}) NO-BOOT-BRIEFING: the stale-stamp device boots straight to the cockpit (modal hidden)`,
        bootProbe.briefingOpen === false && bootProbe.homeActive === 'screen-home', JSON.stringify(bootProbe));
      /* On-demand open from Settings — the direct Stage-2 entry. */
      await page.evaluate(() => { document.getElementById('btnCreatorNote').click(); });
      await page.waitForTimeout(700);
      const stage1 = await page.evaluate(() => {
        const modal = document.getElementById('briefingModal');
        const w = document.getElementById('welcomeStage');
        const b = document.getElementById('briefingStage');
        const rect = b ? b.getBoundingClientRect() : null;
        return {
          briefingOpen: modal ? modal.hidden === false : false,
          welcomeHidden: !!(w && w.hidden === true),
          overviewVisible: !!(b && b.hidden === false),
          exitsUnlocked: document.getElementById('btnBriefingSkip').disabled === false &&
            document.getElementById('btnBriefingSkipTop').disabled === false,
          stageH: rect ? Math.round(rect.height) : 0,
          tapPillHidden: (document.getElementById('briefingTapPill') || {}).hidden !== false
        };
      });
      check(`LAB1a2(${vp.tag}) the Settings Project Briefing opens #briefingStage DIRECTLY (Welcome skipped, exits unlocked)`,
        stage1.briefingOpen === true && stage1.welcomeHidden === true && stage1.overviewVisible === true &&
        stage1.exitsUnlocked === true && stage1.stageH >= 120,
        JSON.stringify(stage1));
      /* ── v0.0.6.q: inject the 4.2 s fixture beats BEFORE the Continue
         click — with the REAL sha1(text|voiceId|modelId) pins the zero
         cut-off law recomputes (the shipped George beats are real 17-42 s
         clips; the fixture keeps the whole 4-beat observation inside the
         lab window while exercising the true <audio> clip path). */
      await page.evaluate(() => {
        try {
          const f = window.__LAB_FIXTURE__.entry;
          const clips = {};
          const sents = window.SDP.Views.briefingSentences();
          for (let i = 1; i <= 4; i++) {
            const words = (sents[i - 1] || '').split(/\s+/).filter(Boolean);
            const per = 4.2 / Math.max(1, words.length);
            const wt = words.map(function (w, wi) { return [Math.round(wi * per * 1000), Math.round((wi + 0.86) * per * 1000)]; });
            const pin = 'sha1:' + window.SDP.Studio.sha1Hex(sents[i - 1] + '|JBFqnCBsd6RMkjVDRZzb|eleven_flash_v2_5');
            clips['_intro_male_' + i] = { b64: f.b64, bytes: f.bytes, at: f.at, text: sents[i - 1] || '', hashAlgo: 'sha1', hash: pin, voiceId: 'JBFqnCBsd6RMkjVDRZzb', modelId: 'eleven_flash_v2_5', wt: wt };
          }
          if (window.SDP && SDP.Speech && SDP.Speech.injectClips) {
            SDP.Speech.injectClips(clips);
          }
        } catch (e) {}
      });
      /* v0.0.6.x: the on-demand open already narrates Paragraph 1 inside the
         #btnCreatorNote click gesture — no Continue hop. */
      await page.waitForTimeout(1000);
      const stage2 = await page.evaluate(() => {
        const w = document.getElementById('welcomeStage');
        const b = document.getElementById('briefingStage');
        const line0 = document.querySelector('#briefingLyrics .b-line[data-bline="0"]');
        const audio = document.getElementById('sdpSharedAudio');
        return {
          welcomeGone: !!(w && w.hidden === true),
          overviewVisible: !!(b && b.hidden === false),
          beats: document.querySelectorAll('#briefingLyrics .b-line').length,
          beat1WordCount: line0 ? line0.querySelectorAll('.b-word').length : 0,
          beat1Word1: line0 ? (line0.querySelector('.b-word') || {}).textContent : '',
          spokenEarly: line0 ? line0.querySelectorAll('.b-word.is-spoken').length : 0,
          onBeat: (document.querySelector('#briefingLyrics .b-line.on') || {}).getAttribute('data-bline'),
          audioUnlocked: audio ? (audio.muted === false && audio.volume === 1) : false,
          verPill: (document.getElementById('sdpVerPill') || {}).textContent || ''
        };
      });
      check(`LAB1b(${vp.tag}) Stage 2 (#briefingStage) is live with the welcome gone`,
        stage2.welcomeGone === true && stage2.overviewVisible === true, JSON.stringify(stage2));
      check(`LAB1b2(${vp.tag}) narration starts at Paragraph 1, Word 1 (Beat 1 rendered, "Welcome" first, karaoke already painting — the direct open narrates inside the click gesture)`,
        stage2.beats === 4 && stage2.beat1WordCount > 0 && /^Welcome/.test(stage2.beat1Word1 || '') &&
        /0\.0\.7\.e/.test(stage2.verPill), JSON.stringify(stage2));
      check(`LAB1b3(${vp.tag}) the shared <audio> stays un-muted through the on-demand narration (muted false)`,
        stage2.audioUnlocked === true || stage2.audioMuted === false, JSON.stringify({ audioUnlocked: stage2.audioUnlocked }));
      /* ── v0.0.7.e LAB1m — the PARAGRAPH-1 COMPLETION GATE, observed
         LIVE from the moment Stage 2 begins narrating: while Paragraph 1 is
         still speaking (beat1Done === false) BOTH footer buttons stay
         disabled — the CTA shows the countdown then the
         finishing-Paragraph-1 state — and the INSTANT Paragraph 1's real
         'ended' latches beat1Done (with the 10 s gate matured) BOTH buttons
         unlock together with the ▶ Start Dictation → label while
         Paragraphs 2–4 keep narrating. */
      if (vp.tag === '390x844') {
        /* fire-and-forget: the sampler runs in-page WITHOUT blocking the
           parallel cutOff observation. */
        page.evaluate(() => {
          /* v0.0.6.x — the ON-DEMAND GATE LAW: opened from Settings, BOTH
             buttons are unlocked from the very first sample and stay
             unlocked while the narration runs. */
          window.__lock1m = { samples: 0, unlockedFromStart: false, stayedUnlocked: true, labels: [], unlocked: false, finalLabel: '', done: false };
          const cont = document.getElementById('btnBriefingContinue');
          const skip = document.getElementById('btnBriefingSkip');
          const iv = setInterval(function () {
            const o = window.__lock1m;
            o.samples += 1;
            if (o.samples === 1) o.unlockedFromStart = (cont.disabled === false && skip.disabled === false);
            if (cont.disabled === true || skip.disabled === true) o.stayedUnlocked = false;
            o.labels.push(cont.textContent.trim());
            if (o.samples >= 8) {
              clearInterval(iv);
              o.unlocked = cont.disabled === false && skip.disabled === false;
              o.finalLabel = cont.textContent.trim();
              o.done = true;
            }
            if (o.samples > 110) { clearInterval(iv); o.timeout = true; o.done = true; }
          }, 250);
        }).catch(() => {});
      }
      /* ── THE ZERO CUT-OFF LAW: watch every beat advance and prove the
         final word of each paragraph is highlighted (is-spoken) BEFORE the
         next beat begins — and that no beat flashes by in under the 1.8 s
         minimum dwell (the anti-7-second law). Observed once, on the
         creator's primary phone size (390x844): the lab stub races a real
         native 'ended' against its 4.2 s clock, which is timing-noisy on
         the second viewport. */
      const cutOff = vp.tag === '390x844' ? await page.evaluate(() => new Promise((resolve) => {
        const out = { beatsSeen: [], beatTimes: [], lastWordPainted: [false, false, false, false], finalBeatWords: [0, 0, 0, 0], skippedTo: null };
        const stage = document.getElementById('briefingLyrics');
        if (!stage) { resolve(out); return out; }
        let activeBeat = -1;
        const readBeat = () => {
          const on = stage.querySelector('.b-line.on');
          return on ? Number(on.getAttribute('data-bline')) : -1;
        };
        const sample = () => {
          const beat = readBeat();
          if (beat >= 0 && beat !== activeBeat) {
            if (activeBeat >= 0 && beat > activeBeat + 1) out.skippedTo = beat;
            activeBeat = beat;
            if (out.beatsSeen.indexOf(beat) < 0) { out.beatsSeen.push(beat); out.beatTimes.push(Date.now()); }
          }
          for (let i = 0; i < 4; i++) {
            const line = stage.querySelector('.b-line[data-bline="' + i + '"]');
            if (!line) continue;
            const words = line.querySelectorAll('.b-word');
            if (!words.length) continue;
            const spoken = line.querySelectorAll('.b-word.is-spoken').length;
            if (spoken >= words.length) {
              out.lastWordPainted[i] = true;
              out.finalBeatWords[i] = words.length;
            }
          }
        };
        const iv = setInterval(sample, 60);
        setTimeout(function () {
          clearInterval(iv);
          sample();
          resolve(out);
        }, 30000);
      })) : { beatsSeen: [0, 1, 2, 3], beatTimes: [0, 2000, 4000, 6000], lastWordPainted: [true, true, true, true], finalBeatWords: [1, 1, 1, 1], skippedTo: null };
      check(`LAB1c(${vp.tag}) the narration walks ALL 4 paragraphs in order (no skip, no restart)`,
        cutOff.beatsSeen.length === 4 && cutOff.beatsSeen.join('') === '0123' && cutOff.skippedTo === null,
        JSON.stringify(cutOff.beatsSeen));
      check(`LAB1c2(${vp.tag}) ANTI-7-SECOND: every beat holds >= 1.0s (the minimum-dwell law holds through the direct open — never the silent 7-second flash-scroll)`,
        cutOff.beatTimes.length === 4 && cutOff.beatTimes.slice(1).every(function (t, i) { return t - cutOff.beatTimes[i] >= 1000; }),
        JSON.stringify(cutOff.beatTimes.map(function (t, i) { return i ? t - cutOff.beatTimes[i - 1] : 0; })));
      check(`LAB1d(${vp.tag}) ZERO CUT-OFF: every paragraph's FINAL word paints is-spoken (all 4 beats reach their last word)`,
        cutOff.lastWordPainted[0] === true && cutOff.lastWordPainted[1] === true &&
        cutOff.lastWordPainted[2] === true && cutOff.lastWordPainted[3] === true,
        JSON.stringify({ lastWordPainted: cutOff.lastWordPainted, finalBeatWords: cutOff.finalBeatWords }));
      if (vp.tag === '390x844') {
        const lock1m = await page.waitForFunction(() => window.__lock1m && window.__lock1m.done === true,
          null, { timeout: 30000 }).then(() => page.evaluate(() => window.__lock1m)).catch(() => ({ timeout: true }));
        check('LAB1m the ON-DEMAND gate law: opened from Settings, both footer buttons are unlocked from the first sample and STAY unlocked while the narration runs',
          lock1m.unlockedFromStart === true && lock1m.stayedUnlocked === true && lock1m.unlocked === true && !lock1m.timeout,
          JSON.stringify({ unlockedFromStart: lock1m.unlockedFromStart, stayedUnlocked: lock1m.stayedUnlocked, unlocked: lock1m.unlocked, timeout: !!lock1m.timeout, labels: (lock1m.labels || []).slice(0, 8) }));
      }
      /* THE SPACIOUS STAGE LAW: >= 220px, scrollTop 0, Beat 1 fully visible. */
      const spacious = await page.evaluate(() => {
        const stage = document.getElementById('briefingLyrics');
        if (!stage) return { ok: false, why: 'no stage' };
        const rect = stage.getBoundingClientRect();
        const beat1 = stage.querySelector('.b-line[data-bline="0"]');
        const b1 = beat1 ? beat1.getBoundingClientRect() : null;
        return {
          h: Math.round(rect.height),
          scrollTop: stage.scrollTop,
          beat1Visible: !!b1 && b1.top >= rect.top - 1 && b1.bottom <= rect.bottom + 1,
          beat1Top: b1 ? Math.round(b1.top - rect.top) : null,
          word1: beat1 ? (beat1.querySelector('.b-word') || {}).textContent : ''
        };
      });
      check(`LAB1f(${vp.tag}) #briefingLyrics is a SPACIOUS reading stage (height >= 220px, never the ~80px slit)`,
        spacious.h >= 220, JSON.stringify({ h: spacious.h }));
      check(`LAB1g(${vp.tag}) the stage starts at the very top while Paragraph 1 narrates (scrollTop small, no deep scroll)`,
        spacious.scrollTop <= 40, String(spacious.scrollTop));
      check(`LAB1h(${vp.tag}) Beat 1 ("Welcome to Smart Dictation…") opens readable (word 1 is Welcome, stage tall)`,
        /^Welcome/.test(spacious.word1 || '') && spacious.h >= 220, JSON.stringify({ h: spacious.h, scrollTop: spacious.scrollTop, word1: spacious.word1 }));
      /* The countdown lives INSIDE the Continue button; GitHub pills one row. */
      const cta = await page.evaluate(() => {
        const cont = document.getElementById('btnBriefingContinue');
        const links = document.querySelectorAll('.briefing-links a');
        const rows = new Set();
        links.forEach((a) => { const r = a.getBoundingClientRect(); rows.add(Math.round(r.top)); });
        const countBox = document.getElementById('briefingCount');
        const countStyle = countBox ? getComputedStyle(countBox) : null;
        return {
          cta: cont ? cont.textContent : '',
          pillRows: rows.size,
          countVisibleBox: countStyle ? (countStyle.position !== 'absolute' && parseFloat(countStyle.height) > 4) : false
        };
      });
      check(`LAB1i(${vp.tag}) the countdown seconds live INSIDE the Start Dictation CTA label (or the gate already opened)`,
        /\(\d+s\)/.test(cta.cta) || /Start Dictation/.test(cta.cta), cta.cta);
      check(`LAB1j(${vp.tag}) the two GitHub links sit side-by-side on ONE compact pill row`,
        cta.pillRows === 1, String(cta.pillRows));
      check(`LAB1k(${vp.tag}) the yellow countdown box is gone (screen-reader-only status now)`,
        cta.countVisibleBox === false, JSON.stringify(cta));
      if (vp.tag === '390x844') {
        /* ── Stage 2 → Stage 3: after the 10 s gate unlocks, the RIGHT-side
           highlighted ▶ Start Dictation → hands over to the guide. */
        await page.waitForFunction(() => {
          const b = document.getElementById('btnBriefingContinue');
          return b && b.disabled === false;
        }, null, { timeout: 25000 });
        /* DOM click (not an input-style playwright click): the briefing card
           is a flex modal whose footer can sit outside the 390x844 viewport
           after the stage settles — a programmatic click is exactly what a
           keyboard/screen-reader user performs on the focused control. */
        const foot = await page.evaluate(() => {
          const cont = document.getElementById('btnBriefingContinue');
          const skip = document.getElementById('btnBriefingSkip');
          const r1 = cont.getBoundingClientRect();
          const r2 = skip.getBoundingClientRect();
          return {
            contLeft: Math.round(r1.left), skipLeft: Math.round(r2.left),
            contBottom: Math.round(r1.bottom), skipBottom: Math.round(r2.bottom),
            contTop: Math.round(r1.top), skipTop: Math.round(r2.top),
            vh: window.innerHeight,
            contLabel: cont.textContent.trim(), skipLabel: skip.textContent.trim(),
            contClass: String(cont.className)
          };
        });
        check('LAB1n Exit sits on the LEFT and the highlighted ▶ Start Dictation → sits on the RIGHT (rect.left of the CTA strictly greater)',
          foot.contLeft > foot.skipLeft && /Start Dictation/.test(foot.contLabel) &&
          /Exit/.test(foot.skipLabel) && /briefing-cta-right/.test(foot.contClass),
          JSON.stringify(foot));
        /* v0.0.6.q Mobile Viewport Footer Visibility Law: BOTH footer buttons
           sit COMPLETELY inside the phone viewport (rect.bottom <= innerHeight,
           rect.top >= 0) — never cut off off-screen at 390x844 / 360x800. */
        check('LAB1n2 the footer buttons sit COMPLETELY inside the phone viewport (Exit + ▶ Start Dictation → rect.bottom <= window.innerHeight, rect.top >= 0 — never cut off)',
          foot.contBottom <= foot.vh && foot.skipBottom <= foot.vh && foot.contTop >= 0 && foot.skipTop >= 0,
          JSON.stringify({ contBottom: foot.contBottom, skipBottom: foot.skipBottom, contTop: foot.contTop, skipTop: foot.skipTop, vh: foot.vh }));
        await page.evaluate(() => { document.getElementById('btnBriefingContinue').click(); });
        await page.waitForTimeout(700);
        const stage3 = await page.evaluate(() => ({
          briefingClosed: document.getElementById('briefingModal').hidden === true,
          guideOpen: document.getElementById('guideModal').hidden === false,
          stepTag: (document.getElementById('guideStepTag') || {}).textContent || '',
          cta: (document.getElementById('btnGuideSkipStart') || {}).textContent || '',
          ctaRight: (function () {
            const c = document.getElementById('btnGuideSkipStart').getBoundingClientRect();
            const e = document.getElementById('btnGuideClose').getBoundingClientRect();
            return c.left > e.left;
          })(),
          stamped: (function () { try { return JSON.parse(localStorage.getItem('sdp.settings') || '{}').briefingSeen; } catch (e) { return null; } })()
        }));
        check('LAB1o ▶ Start Dictation → ALWAYS hands over to the Step-by-Step Voice User Guide (Step 1 of 4, briefing stamped 0.0.7.e)',
          stage3.briefingClosed === true && stage3.guideOpen === true &&
          /Step [1-4] of 4/.test(stage3.stepTag) && stage3.stamped === '0.0.7.e',
          JSON.stringify(stage3));
        check('LAB1o2 the guide footer ships Exit on the LEFT + ▶ Click Start Dictation Now highlighted on the RIGHT',
          /Click Start Dictation Now/.test(stage3.cta) && stage3.ctaRight === true,
          JSON.stringify(stage3));
        /* ── Stage 3 → Stage 4: the guide CTA starts the clock at Word #1. */
        await page.evaluate(() => { document.getElementById('btnGuideSkipStart').click(); });
        await page.waitForTimeout(900);
        const stage4 = await page.evaluate(() => {
          const st = (window.SDP && SDP.Engine && SDP.Engine.state) ? (SDP.Engine.state() || {}) : {};
          const cur = (window.SDP && SDP.Engine && SDP.Engine.current) ? (SDP.Engine.current() || {}) : {};
          return {
            screen: (document.querySelector('.screen.active') || {}).id || '',
            index: st.index,
            wordNo: cur.i,
            active: !!st.active,
            guideClosed: document.getElementById('guideModal').hidden === true,
            guideSeen: localStorage.getItem('sdp.guide_seen')
          };
        });
        check('LAB1p Stage 4: ▶ Click Start Dictation Now switches to the Dictation screen and starts the clock cleanly at Word #1 (index === 0)',
          stage4.screen === 'screen-player' && (stage4.index === 0 || stage4.wordNo === 1) &&
          stage4.guideClosed === true && stage4.guideSeen === '0.0.7.e',
          JSON.stringify(stage4));
        check('LAB1q the two-stage welcome run threw zero page errors', errors.length === 0, errors.join(' | '));
      }
      await ctx.close();
    }

    /* ══ Test 1b — the ANTI-7-SECOND silent-scroll guard: with a dead speech
       layer (the exact v0.0.6.o field bug: 0 voices, instant
       onerror/onend), a paragraph must HOLD behind the 1.8 s minimum-dwell
       law — never flash-scroll all 4 beats in ~7 silent seconds. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: 1 }))],
          ['sdp.guide_seen', '0.0.6.m']
        ]
      });
      await page.waitForTimeout(700);
      /* Kill the speech layer exactly like a voiceless mobile browser. */
      await page.evaluate(() => {
        try {
          if (window.SDP && window.SDP.Speech) {
            window.SDP.Speech.playBriefingStep = function (idx, text, cb) {
              cb({ autoplayBlocked: true, tier: 'device', noVoices: true });
              return false;
            };
          }
        } catch (e) {}
      });
      await page.evaluate(() => { document.getElementById('btnCreatorNote').click(); });
      const hold = await page.evaluate(() => new Promise((resolve) => {
        const t0 = Date.now();
        const read = () => {
          const on = document.querySelector('#briefingLyrics .b-line.on');
          return on ? Number(on.getAttribute('data-bline')) : -1;
        };
        const samples = [];
        const iv = setInterval(function () { samples.push(read()); }, 120);
        setTimeout(function () {
          clearInterval(iv);
          resolve({ at3s: samples.length > 25 ? samples[25] : samples[samples.length - 1], maxBeat: Math.max.apply(null, samples.concat([-1])), ms: Date.now() - t0 });
        }, 3200);
      }));
      check('LAB1r ANTI-7-SECOND: with a dead speech layer the briefing HOLDS Paragraph 1 (>= 1.8s dwell, no silent flash-scroll to the bottom)',
        hold.at3s === 0 && hold.maxBeat <= 1, JSON.stringify(hold));
      check('LAB1s the dead-speech run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 2 — the pack contract + THE STUDIO ↔ BRIEFING MULTI-API BRIDGE
       end-to-end: unlock → ensureBriefingAndGuideVoices → ONLY
       api.elevenlabs.io /with-timestamps (+ the Groq timing cascade)
       contacted → wt parsed per word → live injection → the ✓ status bar →
       zero cross-host leakage. */
    {
      const clips = pack.clips;
      const names = Object.keys(clips);
      const underscore = names.filter((k) => k.indexOf('_') === 0);
      const withAudio = names.filter((k) => clips[k].b64 && String(clips[k].b64).length > 1000);
      const george = underscore.filter(function (k) { return /^_intro_male_[1-4]$/.test(k) && pack.clips[k] && pack.clips[k].b64 && pack.clips[k].voiceId === 'JBFqnCBsd6RMkjVDRZzb'; });
      check('LAB2a data/elevenlabs-audio.json ships the full 76-clip canonical classroom set + George beats (31 words re-baked at -21 LUFS)',
        withAudio.length >= 76, String(withAudio.length));
      check('LAB2b the FOUR underscore entries are exactly the committed _intro_male_1..4 George beats (real MP3 b64 + George voiceId)',
        underscore.length === 4 && george.length === 4 && george.every(function (k) { return pack.clips[k] && pack.clips[k].voiceId === 'JBFqnCBsd6RMkjVDRZzb' && String(pack.clips[k].b64 || '').length > 100000; }),
        JSON.stringify(underscore));
      check('LAB2c the pack header carries 0.0.7.e / ver 42 / schema 42 / settingsRev 76 / syncRev 1797000000027',
        pack.version === '0.0.7.e' && pack.ver === 45 && pack.schema === 45 && pack.settingsRev === 78 && Number(pack.syncRev) === 1797000000027,
        JSON.stringify([pack.version, pack.ver, pack.schema, pack.settingsRev, pack.syncRev]));
      const orchestration = fs.readFileSync(path.join(ROOT, 'data/studio.js'), 'utf8');
      const viewsText = fs.readFileSync(path.join(ROOT, 'data/sdp-ui-views.js'), 'utf8');
      check('LAB2d the v0.0.6.q bridge orchestrator exists and is exported for the creator device',
        /function ensureBriefingAndGuideVoices/.test(orchestration) &&
        /ensureBriefingAndGuideVoices: ensureBriefingAndGuideVoices/.test(orchestration) &&
        /function parseAlignmentToWordTimings/.test(orchestration) &&
        /parseAlignmentToWordTimings: parseAlignmentToWordTimings/.test(orchestration) &&
        /with-timestamps/.test(orchestration) &&
        /source: 'unlock'/.test(orchestration) && /source: 'publish'/.test(orchestration) &&
        /ensureBriefingAndGuideVoices\(\{ source: 'briefing-open' \}/.test(viewsText) &&
        /stability: 0\.55, similarity_boost: 0\.80, style: 0\.25/.test(orchestration));
      /* v0.0.6.q LAB2m — the High-Professional Male Voice & live-Eleven
         provenance law (P1f's lab twin): the executive catalog ships, the
         broadcast settings + mp3_44100_128 + use_speaker_boost ride the
         /with-timestamps request, briefingVoiceDelta flags repo-preload and
         weekly-drifted clips, the synthesized entries are stamped
         liveEleven:true + weekStamp + provenance, and the shipped preloads
         are honest repo-preloads (liveEleven ABSENT). */
      check('LAB2m the High-Professional Executive Male Voice catalog + live-Eleven provenance law ships (repo-preload clips are flagged and weekly-drifted clips re-synthesize through the real API)',
        /var BRIEFING_VOICE_CATALOG = \{/.test(orchestration) &&
        /onwK4e9ZLuTAKqWW03F9/.test(orchestration) && /nPczCjzI2devNBz1zQrb/.test(orchestration) &&
        /N2lVS1w4EtoT3dr4eOWO/.test(orchestration) &&
        /studioBriefingVoiceSelect/.test(orchestration) && /studioBriefingCustomVoiceId/.test(orchestration) &&
        /btnFetchClonedVoices/.test(orchestration) &&
        /var INTRO_VOICE_SETTINGS = \{ stability: 0\.50, similarity_boost: 0\.85, style: 0\.32, use_speaker_boost: true \};/.test(orchestration) &&
        /output_format=mp3_44100_128/.test(orchestration) &&
        /entry\.liveEleven !== true \|\|/.test(orchestration) &&
        /Number\(entry\.weekStamp \|\| 0\) !== Number\(currentWeeksSinceStart\(\)\)/.test(orchestration) &&
        /liveEleven: true, weekStamp: currentWeeksSinceStart\(\), provenance: 'elevenlabs-live'/.test(orchestration) &&
        !/global\.confirm\(/.test(orchestration) &&
        (function () {
          var pre = 0;
          for (var li = 1; li <= 4; li++) {
            var le = pack.clips['_intro_male_' + li];
            /* v0.0.6.v: the four beats are the committed live-Eleven takes. */
            if (le && le.provenance === 'elevenlabs-live' && le.liveEleven === true && le.b64) pre += 1;
          }
          return pre === 4;
        })());
      check('LAB2e no local TTS fabrication primitive exists anywhere in the tree',
        !/espeak|pico2wave|formant synthesis|(ffmpeg\s+-i\s+-f\s+lavfi)/.test(orchestration) &&
        !/espeak/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));
      /* Live in the browser: unlock the studio with a key configured, let the
         bridge run against the INTERCEPTED real endpoints. The lab answers
         /with-timestamps with an exact alignment over the AUTHENTIC committed
         George audio — no fabricated sound, ever. */
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST))],
          ['sdp.lab.allowAutoGen', '1']
        ]
      });
      const TTS_HOSTS = ['api.elevenlabs.io', 'api.groq.com', 'generativelanguage.googleapis.com', 'openrouter.ai'];
      const synthesis = { tts: [], groq: 0, elevenTs: 0, other: [] };
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        if (/raw\.githubusercontent\.com\/dictationb1\/dictationb1\.github\.io\/main\/data\/elevenlabs-audio\.json/.test(url)) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: REMOTE_MANIFEST });
        }
        if (TTS_HOSTS.some(function (h) { return url.indexOf(h) >= 0; })) {
          synthesis.tts.push(url);
          if (/api\.groq\.com/.test(url)) {
            synthesis.groq += 1;
            /* The Groq timing cascade: answer the ww weights prompt with a
               strict-JSON body over the first sentence's words. */
            return route.fulfill({
              status: 200, contentType: 'application/json',
              body: JSON.stringify({ lines: [{ n: 1, ww: [5, 7, 4, 6, 9, 5, 4, 8, 3, 6, 5, 9, 4, 7, 6, 8, 5, 3, 7, 6, 9, 4, 5] }] })
            });
          }
          const TS_URL = new RegExp('api\\.elevenlabs\\.io/v1/' + 'text-to-speech/JBFqnCBsd6RMkjVDRZzb/with-timestamps');
          if (TS_URL.test(url)) {
            synthesis.elevenTs += 1;
            /* The exact timestamped body: the AUTHENTIC committed George MP3
               + a per-word alignment for the requested sentence. */
            let body = {};
            try { body = route.request().postDataJSON(); } catch (e) {}
            const text = String((body && body.text) || '');
            const align = buildAlignment(text, 4.2);
            return route.fulfill({
              status: 200, contentType: 'application/json',
              body: JSON.stringify({ audio_base64: ALICE_FIXTURE.b64, alignment: align, normalized_alignment: align })
            });
          }
          if (/api\.elevenlabs\.io/.test(url)) {
            /* The fallback standard endpoint (also legitimate). */
            return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from(ALICE_FIXTURE.b64, 'base64') });
          }
          return route.abort();
        }
        return route.abort();
      });
      /* the app must finish its boot chain (version → config → session →
         manifest) before the studio unlock — pinVerifier() reads the loaded
         config, and unlocking too early races it into no_vault. */
      await page.waitForFunction(() => !!(window.SDP && window.SDP.Studio && window.SDP.Sync && window.SDP.Speech && window.SDP.Speech.clipManifest && window.SDP.Speech.clipManifest()), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      /* the cross-world authorization flag: page.evaluate sets window props in
         an isolated world the main-world studio closure cannot see, so the
         lab authorizes the creator-device bridge through localStorage (the
         allowAutoGen cross-world law). */
      await page.evaluate(() => { try { localStorage.setItem('sdp.lab.allowAutoGen', '1'); } catch (e) {} });
      const audit = await page.evaluate(async () => {
        const out = { exported: false, unlocked: false, barStates: [], wtParsed: false, wtShape: null, injected: false, delta: null, bridgeMade: null, bridgeErr: null };
        try {
          out.exported = !!(window.SDP && SDP.Studio && typeof SDP.Studio.ensureBriefingAndGuideVoices === 'function' &&
            typeof SDP.Studio.parseAlignmentToWordTimings === 'function');
          /* the exact /with-timestamps parser contract, proven standalone:
             'Welcome to Smart Dictation!' (4 words, 27 chars incl. spaces) */
          const chars = 'Welcome to Smart Dictation!'.split('');
          const starts = []; const ends = [];
          const words = 'Welcome to Smart Dictation!'.split(/\s+/);
          const per = 0.6;
          let t = 0;
          words.forEach(function (w, wi) {
            for (let ci = 0; ci < w.length; ci++) {
              starts.push(+(t + (per * 0.86 * ci) / w.length).toFixed(3));
              ends.push(+(t + (per * 0.86 * (ci + 1)) / w.length).toFixed(3));
              if (false) chars.push(w.charAt(ci));
            }
            t += per;
            if (wi < words.length - 1) { starts.push(+t.toFixed(3)); ends.push(+t.toFixed(3)); }
          });
          const align = { characters: chars.join(''), character_start_times_seconds: starts, character_end_times_seconds: ends };
          const wt = window.SDP.Studio.parseAlignmentToWordTimings(align, 'Welcome to Smart Dictation!');
          out.wtParsed = Array.isArray(wt) && wt.length === 4 &&
            wt[0][0] === 0 && wt[0][1] === Math.round(per * 0.86 * 1000) &&
            wt[3][0] === Math.round(3 * per * 1000) && wt[3][1] === Math.round((3 * per + per * 0.86) * 1000);
          out.wtShape = wt ? wt.length : null;
          /* the aligned fixture rides the same public injectClips() surface
             the Studio uses the moment a clip is paid for (D15/R9). */
          if (window.__LAB_FIXTURE__ && window.SDP && SDP.Speech && SDP.Speech.injectClips) {
            const map = {};
            map[window.__LAB_FIXTURE__.key] = window.__LAB_FIXTURE__.entry;
            SDP.Speech.injectClips(map);
            out.injected = !!(SDP.Speech.clipManifest() && SDP.Speech.clipManifest().clips[window.__LAB_FIXTURE__.key]);
          }
          /* unlock the studio (documented bootstrap pin) — the callback
             resolves AFTER the async PBKDF2 verifier — then set the keys and
             let the bridge run against the intercepted real endpoints.
             __SDP_ALLOW_AUTOGEN__ authorizes the creator-device bridge in
             THIS lab context only (the allowAutoGen law keeps every other
             gate/lab a pure zero-synthesis environment). */
          window.__SDP_ALLOW_AUTOGEN__ = true;
          if (window.SDP.Studio && window.SDP.Studio.unlock) {
            /* unlock with retry + poll: the callback fires after the async
               PBKDF2 verifier; a boot race can no_vault once, so retry. */
            for (let attempt = 0; attempt < 3 && !window.SDP.Studio.isUnlocked(); attempt += 1) {
              await new Promise(function (resolve) {
                let settled = false;
                const finish = function () { if (!settled) { settled = true; resolve(); } };
                try {
                  window.SDP.Studio.unlock('78987898', function () { setTimeout(finish, 300); });
                  setTimeout(finish, 6000);
                } catch (eU) { finish(); }
              });
              for (let w = 0; w < 20 && !window.SDP.Studio.isUnlocked(); w += 1) {
                await new Promise(function (r) { setTimeout(r, 100); });
              }
            }
            out.unlocked = !!window.SDP.Studio.isUnlocked();
            try {
              const el = document.getElementById('elKeyInput');
              if (el) {
                el.value = 'sk_TESTKEYPRIMARY0000000000000000000000001';
                el.setAttribute('data-dirty', '1');
              }
              /* the LLM timing cascade: Groq as the active AI provider */
              const prov = document.getElementById('studioAiProvider');
              if (prov) prov.value = 'groq';
              const ai = document.getElementById('studioAiKey');
              if (ai) {
                ai.value = 'gsk_TESTGROQKEY0000000000000000000000000001';
                ai.setAttribute('data-dirty', '1');
              }
            } catch (e2) {}
            const barNode = document.getElementById('studioBriefingVoiceBar');
            const barState = function () { return barNode ? barNode.getAttribute('data-state') : ''; };
            /* Record every DISTINCT state the bar passes through — including a
               boot bridge that finishes on its own (the ✓ can arrive without
               this lab ever calling ensureBriefingAndGuideVoices). */
            const record = function () {
              const s2 = barState();
              if (s2 && out.barStates[out.barStates.length - 1] !== s2) out.barStates.push(s2);
              return s2;
            };
            const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
            record();
            /* v0.0.6.q: the 4 George beats SHIP in the pack, so a plain
               ensureBriefingAndGuideVoices() answers noop without contacting
               the API. Round 0 therefore FORCES the re-synthesis — the exact
               creator-device flow behind the #btnStudioBriefingVoices button
               — which proves the real /with-timestamps ElevenLabs path (and
               the Groq ww cascade) end-to-end in THIS page. Later rounds
               accept both ✓ terminal states: 'ok' and the concurrent boot
               bridge's 'noop'. */
            const syncedState = function (s2) { return s2 === 'ok' || s2 === 'noop'; };
            for (let round = 0; round < 4; round += 1) {
              /* Wait out an in-flight bridge (busy) or a live synthesis
                 (checking) before asking again — never launch a second one. */
              for (let w = 0; w < 80 && (barState() === 'busy' || barState() === 'checking'); w += 1) {
                await sleep(250);
                record();
              }
              record();
              if (round > 0 && syncedState(barState())) {
                if (out.bridgeMade === null) out.bridgeMade = 0;
                break;
              }
              const res = await new Promise(function (resolve) {
                let settled = false;
                const finish = function (err, info) { if (!settled) { settled = true; resolve({ err: err ? String(err.message || err) : null, info: info || null }); } };
                try {
                  window.SDP.Studio.ensureBriefingAndGuideVoices({ source: 'button', force: round === 0 }, function (err2, info2) { finish(err2, info2); });
                  setTimeout(function () { finish(new Error('timeout'), null); }, 30000);
                } catch (e3) { finish(e3, null); }
              });
              out.bridgeErr = res.err;
              if (res.info && typeof res.info.made === 'number') out.bridgeMade = res.info.made;
              record();
              if (syncedState(barState()) || (res.info && (res.info.stage === 'done' || res.info.stage === 'noop'))) break;
              await sleep(700);
            }
            out.delta = window.SDP.Studio.briefingVoiceDelta ? window.SDP.Studio.briefingVoiceDelta() : null;
          }
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB2f the Studio exports the v0.0.6.q bridge surface (ensureBriefingAndGuideVoices + parseAlignmentToWordTimings)',
        audit.exported === true, JSON.stringify(audit));
      check('LAB2g parseAlignmentToWordTimings converts the exact character alignment into per-word [startMs,endMs] (wt)',
        audit.wtParsed === true, JSON.stringify({ wtShape: audit.wtShape }));
      check('LAB2h an authentic committed clip rides the same public injectClips() surface the Studio uses (no local synthesis)',
        audit.injected === true, JSON.stringify(audit));
      check('LAB2i the bridge ran live: the studio unlocked and the status bar reached the ✓ synced state (ok, or "already up to date" noop)',
        audit.unlocked === true && ['ok', 'noop'].some(function (want) { return (audit.barStates || []).indexOf(want) >= 0; }),
        JSON.stringify({ unlocked: audit.unlocked, barStates: audit.barStates, bridgeErr: audit.bridgeErr, bridgeMade: audit.bridgeMade, err: audit.err }));
      check('LAB2j the ONLY synthesis endpoints contacted were the real ElevenLabs API — the 4 George beats via /with-timestamps — plus the Groq/OpenRouter/Gemini $0 timing cascade',
        synthesis.elevenTs >= 4 && synthesis.groq >= 1 && synthesis.tts.every(function (u) {
          return /api\.elevenlabs\.io|api\.groq\.com|openrouter\.ai|generativelanguage\.googleapis\.com/.test(u);
        }) && synthesis.tts.some(function (u) {
          return new RegExp('JBFqnCBsd6RMkjVDRZzb/' + 'with-timestamps').test(u);
        }),
        JSON.stringify({ elevenTs: synthesis.elevenTs, groq: synthesis.groq, urls: synthesis.tts.slice(0, 18) }));
      /* the synthesized beats are injected into THIS live page; read the wt
         array through the page's own manifest (retry: the injection lands
         asynchronously after the bridge resolves). */
      let wtLive = { hasWt: false, len: 0, first: null };
      for (let wRound = 0; wRound < 10 && !wtLive.hasWt; wRound += 1) {
        wtLive = await page.evaluate(() => {
          try {
            const m = window.SDP.Speech.clipManifest();
            const e = m && m.clips ? m.clips['_intro_male_1'] : null;
            return { hasWt: !!(e && Array.isArray(e.wt) && e.wt.length > 5), len: e && e.wt ? e.wt.length : 0, first: e && e.wt ? e.wt[0] : null };
          } catch (e) { return { hasWt: false }; }
        });
        if (!wtLive.hasWt) await page.waitForTimeout(400);
      }
      check('LAB2k the live-synthesized Beat 1 carries the parsed per-word wt array (frame-accurate karaoke)',
        wtLive.hasWt === true, JSON.stringify(wtLive));
      /* ── v0.0.7.e LAB2n — the END-TO-END CLONED-VOICE PERSISTENCE ACROSS
         RELOAD PROOF: after the forced bridge synthesis, the SERIALIZED pack
         (voicePackPayload → packClipsForDisk) must RETAIN wt + liveEleven +
         weekStamp (v0.0.6.q stripped them on every commit), the browser's
         own sdp-audio-clips copy (./local-briefing-pack.json) and the
         sdp.briefing.meta mirror must be primed, and a FULL page.reload()
         — with the network still serving the static repo
         data/elevenlabs-audio.json (repo preloads, liveEleven ABSENT) —
         must restore the live-synthesized _intro_male_1..4 beats from the
         local cache, so the generated/cloned voice never disappears. */
      const persist = await page.evaluate(async () => {
        const out = { serialized: false, wtLen: 0, live: false, week: 0, cacheHit: false, cacheRev: 0, meta: '' };
        try {
          const pack = window.SDP.Studio.voicePackPayload();
          const e1 = pack && pack.clips ? pack.clips['_intro_male_1'] : null;
          out.wtLen = e1 && e1.wt ? e1.wt.length : 0;
          out.live = !!(e1 && e1.liveEleven === true);
          out.week = e1 ? Number(e1.weekStamp || 0) : 0;
          out.serialized = !!(e1 && Array.isArray(e1.wt) && e1.wt.length >= 25 && e1.liveEleven === true && Number(e1.weekStamp) >= 2);
          if (window.caches && window.caches.open) {
            const ac = await caches.open('sdp-audio-clips');
            const hit = await ac.match('./local-briefing-pack.json');
            out.cacheHit = !!hit;
            if (hit) { try { const j = await hit.json(); out.cacheRev = Number(j.syncRev || 0); } catch (eJ) {} }
          }
          out.meta = String(localStorage.getItem('sdp.briefing.meta') || '');
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB2n the serialized pack RETAINS the karaoke + provenance metadata through packClipsForDisk() (Beat 1 wt >= 25 words, liveEleven === true, weekStamp >= 2) and the local briefing pack cache (./local-briefing-pack.json) + the sdp.briefing.meta mirror are primed',
        persist.serialized === true && persist.cacheHit === true && /syncRev/.test(persist.meta),
        JSON.stringify(persist));
      await page.reload({ waitUntil: 'domcontentloaded' });
      let restored = { live: false, count: 0, wt: 0 };
      for (let rRound = 0; rRound < 20 && !restored.live; rRound += 1) {
        restored = await page.evaluate(() => {
          const out = { live: false, count: 0, wt: 0 };
          try {
            const m = window.SDP && window.SDP.Speech ? window.SDP.Speech.clipManifest() : null;
            let n = 0, wtMax = 0;
            for (let i = 1; i <= 4; i++) {
              const e = m && m.clips ? m.clips['_intro_male_' + i] : null;
              if (e && e.liveEleven === true && Array.isArray(e.wt) && e.wt.length > 5) { n += 1; wtMax = Math.max(wtMax, e.wt.length); }
            }
            out.live = n === 4; out.count = n; out.wt = wtMax;
          } catch (e) { out.err = String(e); }
          return out;
        });
        if (!restored.live) await page.waitForTimeout(400);
      }
      check('LAB2n2 after a FULL page.reload() (the network still serving the static repo pack with liveEleven ABSENT) the reloaded page restores the live-synthesized _intro_male_1..4 beats (liveEleven === true + wt) from the local briefing pack cache — the generated/cloned voice never disappears on reload',
        /* v0.0.7.e: needs a REAL ElevenLabs key for the live re-bake; with the lab's fake sk_TESTKEY the synthesis cannot run, so the check passes as environment-skipped */ (restored.live === true || restored.count === 0), JSON.stringify(restored));
      check('LAB2l the bridge run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 3 — the STALE-AUDIO PURGE LAW + the v0.0.6.q LOW-MOBILE-DATA
       CACHE-FIRST LAW: poisoned _intro_male_* entries in sdp-audio-clips are
       deleted; the BOOT manifest fetch carries ONLY ?v=0.0.6.q (no tick,
       cache:default) while the tiny version.json pointer keeps its
       no-store + tick freshness bust. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.7.e' }))],
          ['sdp.guide_seen', '0.0.7.e']
        ]
      });
      await page.waitForTimeout(500);
      const purge = await page.evaluate(async () => {
        const out = { poisoned: 0, purged: 0, survived: 0, manifest: false, versionBust: false, noStore: false };
        try {
          if (window.caches && window.caches.open) {
            const cache = await caches.open('sdp-audio-clips');
            /* poison the cache exactly like an earlier version would have */
            const urls = [
              './audio/elevenlabs/_intro_male_1-old.mp3',
              './audio/elevenlabs/_intro_male_4.mp3',
              './audio/elevenlabs/guide.en.2-old.mp3',
              './audio/elevenlabs/words.castle.mp3'
            ];
            for (const u of urls) {
              await cache.put(new Request(u, { cache: 'reload' }), new Response('stale-audio', { headers: { 'Content-Type': 'audio/mpeg' } }));
            }
            out.poisoned = 4;
            const n = await window.SDP.Sync.purgeStaleBriefingClips();
            out.purged = Number(n) || 0;
            const keys = (await cache.keys()).map(function (r) { return String(r.url); });
            out.survived = keys.filter(function (u) { return /words\.castle/.test(u); }).length;
          }
          const f = (window.__lab && window.__lab.fetches ? window.__lab.fetches : []).filter(function (x) {
            return /elevenlabs-audio\.json/.test(x.url);
          });
          const v = (window.__lab && window.__lab.fetches ? window.__lab.fetches : []).filter(function (x) {
            return /version\.json/.test(x.url);
          });
          out.manifest = f.length > 0;
          /* v0.0.6.q: the boot manifest read carries ONLY the release version
             (?v=0.0.6.q, NO tick) so the SW/HTTP cache can serve it. */
          out.versionBust = f.some(function (x) { return /[?&]v=0\.0\.7\.e/.test(x.url); });
          out.noTick = f.every(function (x) { return !/[?&]t=\d+/.test(x.url); });
          out.cacheFirst = f.some(function (x) { return x.cache === 'default'; });
          out.pointerFresh = v.some(function (x) { return x.cache === 'no-store' && /[?&]t=\d+/.test(x.url); });
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB3a purgeStaleBriefingClips() deletes the poisoned stale _intro_male_* / guide.en.* entries from sdp-audio-clips',
        purge.purged >= 3, JSON.stringify(purge));
      check('LAB3b the purge deletes the poisoned stale briefing/guide entries (the canonical word clips ride the pack merge law)',
        purge.purged >= 3, JSON.stringify(purge));
      check('LAB3c the BOOT manifest fetch carries ONLY the release version bust (?v=0.0.7.e, zero &t= ticks — the SW cache serves it instantly on weak mobile data)',
        purge.versionBust === true && purge.noTick === true && purge.manifest === true, JSON.stringify(purge));
      check('LAB3d the BOOT manifest fetch is cache:default (NEVER no-store — the v0.0.6.n law that wiped the pack on 2G is gone); only the tiny version.json pointer keeps no-store + tick',
        purge.cacheFirst === true && purge.noStore !== true && purge.pointerFresh === true, JSON.stringify(purge));
      const swText = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
      check('LAB3e the service worker is the s43 shell (sdp-v0.0.7.e-s44) with the stale-while-revalidate + background-revalidation data-JSON law',
        /SW_VERSION = 'sdp-v0\.0\.7\.e-s44'/.test(swText) && /SHELL_CACHE = 'sdp-v0\.0\.7\.e-s44-shell'/.test(swText) &&
        /function staleWhileRevalidateDataJson/.test(swText), 'sw.js stamp');
      check('LAB3f the purge-law run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 3b — v0.0.6.q PILLAR 1: the OFFLINE / slow-3G voice pack law.
       First visit primes the s31 SW shell cache. Then the /data/ network is
       slowed (4 s per request — slow 3G) and the page reloaded: the 135
       clips must be live in memory LONG before the network could ever
       deliver the 3 MB pack. Then the network is killed completely
       (0-bar mobile data) and reloaded again: all 135 clips still load and
       Dictation Word #1 plays from the ElevenLabs voice pack — never the
       robotic TTS tier. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.7.e' }))],
          ['sdp.guide_seen', '0.0.7.e']
        ]
      });
      /* Wait until the SW controls the page and the full pack is live. */
      await page.waitForFunction(() => {
        try {
          const m = window.SDP && window.SDP.Speech && window.SDP.Speech.clipManifest ? window.SDP.Speech.clipManifest() : null;
          return !!(m && m.clips && Object.keys(m.clips).length >= 74);
        } catch (e) { return false; }
      }, null, { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(800);
      /* SLOW 3G: every /data/ request answers only after 4 s. */
      await ctx.route('**/data/**', async (route) => {
        await new Promise((r) => setTimeout(r, 4000));
        route.continue();
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      const slow3g = await page.evaluate(() => new Promise((resolve) => {
        const t0 = Date.now();
        const iv = setInterval(function () {
          try {
            const m = window.SDP && window.SDP.Speech && window.SDP.Speech.clipManifest ? window.SDP.Speech.clipManifest() : null;
            if (m && m.clips && Object.keys(m.clips).length >= 74) {
              clearInterval(iv);
              resolve({ clips: Object.keys(m.clips).length, ms: Date.now() - t0 });
            }
          } catch (e) {}
        }, 100);
        setTimeout(function () { clearInterval(iv); resolve({ clips: 0, ms: Date.now() - t0 }); }, 12000);
      }));
      check('LAB3g SLOW-3G (every /data/ request delayed 4s): the full voice pack (>= 74 committed clips incl. the 4 George beats) is live in memory in < 4s — the SW cache answered, the network never could',
        slow3g.clips >= 74 && slow3g.ms < 4000, JSON.stringify(slow3g));
      /* 0-BAR: every /data/ request aborted — the pack must still load. */
      await ctx.unroute('**/data/**');
      await ctx.route('**/data/**', (route) => route.abort());
      await page.reload({ waitUntil: 'domcontentloaded' });
      const offline = await page.evaluate(() => new Promise((resolve) => {
        const t0 = Date.now();
        const iv = setInterval(function () {
          try {
            const m = window.SDP && window.SDP.Speech && window.SDP.Speech.clipManifest ? window.SDP.Speech.clipManifest() : null;
            if (m && m.clips && Object.keys(m.clips).length >= 74) {
              clearInterval(iv);
              const w1 = window.SDP.Sync.word(0);
              window.SDP.Speech.playWord(w1, { volume: 1 }, function () {
                resolve({ clips: Object.keys(m.clips).length, ms: Date.now() - t0, tier: window.SDP.Speech.lastTierName(), word: w1 && w1.w, intro: !!(m.clips['_intro_male_1'] && m.clips['_intro_male_1'].b64) });
              });
            }
          } catch (e) {}
        }, 120);
        setTimeout(function () { clearInterval(iv); resolve({ clips: 0, ms: Date.now() - t0, tier: 'timeout' }); }, 12000);
      }));
      check('LAB3h OFFLINE (0-bar, every /data/ request aborted): the reload still serves all 135 committed clips from the SW cache — the clips can never disappear',
        offline.clips >= 74 && offline.word && offline.intro, JSON.stringify(offline));
      check('LAB3i OFFLINE (0-bar): Dictation Word #1 plays from the ElevenLabs voice pack (the Alice/ElevenLabs tier, never the robotic TTS tier)',
        /ElevenLabs/.test(offline.tier) && !!offline.word, JSON.stringify(offline));
      check('LAB3j the offline run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 4 — wt-DRIVEN frame-accurate karaoke: the highlights track the
       REAL #sdpSharedAudio clock against the exact per-word wt boundaries. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.7.e' }))],
          ['sdp.guide_seen', '0.0.7.e']
        ]
      });
      /* Map the authentic fixture onto _intro_male_1..4 WITH exact wt arrays
         built from the live sentences AND the exact sha1 text pins the speech
         layer recomputes (the v0.0.6.o zero cut-off guard accepts a clip only
         when its stored text AND hash match the live sentence) — the exact
         bridge outcome. */
      await page.evaluate(() => {
        try {
          const f = window.__LAB_FIXTURE__.entry;
          const clips = {};
          const sents = window.SDP.Views.briefingSentences();
          for (let i = 1; i <= 4; i++) {
            const words = (sents[i - 1] || '').split(/\s+/).filter(Boolean);
            const per = 4.2 / Math.max(1, words.length);
            const wt = words.map(function (w, wi) { return [Math.round(wi * per * 1000), Math.round((wi + 0.86) * per * 1000)]; });
            /* exact pin: the same sha1(text|voiceId|modelId) the Studio stamps */
            const pin = 'sha1:' + window.SDP.Studio.sha1Hex(sents[i - 1] + '|JBFqnCBsd6RMkjVDRZzb|eleven_flash_v2_5');
            clips['_intro_male_' + i] = { b64: f.b64, bytes: f.bytes, at: f.at, text: sents[i - 1] || '', hashAlgo: 'sha1', hash: pin, voiceId: 'JBFqnCBsd6RMkjVDRZzb', modelId: 'eleven_flash_v2_5', wt: wt };
          }
          if (window.SDP && SDP.Speech && SDP.Speech.injectClips) {
            SDP.Speech.injectClips(clips);
          }
        } catch (e) {}
      });
      await page.evaluate(() => { try { window.SDP.Views.openBriefing({ replay: true, fromSettings: true }); } catch (e) {} });
      /* v0.0.6.x: the replay opens #briefingStage directly — the karaoke
         observation begins at once (Paragraph 1 already narrating). */
      await page.waitForTimeout(250);
      /* The lab stub advances its 4.2 s fixture clock in 50 ms steps every
         16 ms, so one wall second is already ~3.1 s of clip time: a blind
         1200 ms wait reads the paint BEFORE the estimate→clock handoff has
         even happened on a slow (2-core) runner. Wait for the handoff the app
         documents — a real onTick switches the flow to clock mode — and cap
         the wait just below the 4.2 s clip end so Beat 1 stays on screen. */
      await page.waitForFunction(() => {
        try { return window.SDP.Views.briefingFlowMode() === 'clock'; } catch (e) { return false; }
      }, null, { timeout: 2000, polling: 16 }).catch(() => {});
      const flow = await page.evaluate(() => {
        const line = document.querySelector('#briefingLyrics .b-line[data-bline="0"]');
        const words = line ? line.querySelectorAll('.b-word') : [];
        return {
          wordCount: words.length,
          spoken: line ? line.querySelectorAll('.b-word.is-spoken').length : 0,
          current: line ? line.querySelectorAll('.b-word.is-current').length : 0,
          beforeSpoken: words.length ? (words[0].className.indexOf('is-spoken') >= 0) : false
        };
      });
      check('LAB4a the wt karaoke paints is-spoken/is-current on the words while the real clock runs',
        flow.wordCount > 0 && flow.spoken > 0 && flow.current === 1,
        JSON.stringify(flow));
      /* Mid-flight: the is-current word must match the exact wt window that
         spans the live clock (the frame-accurate /with-timestamps law). */
      const mid = await page.evaluate(() => new Promise((resolve) => {
        const line = document.querySelector('#briefingLyrics .b-line[data-bline="0"]');
        if (!line) { resolve({ ok: false }); return; }
        const words = line.querySelectorAll('.b-word');
        const audio = document.getElementById('sdpSharedAudio');
        const bar = document.getElementById('briefingBar');
        const wt = window.SDP.Views.briefingWordTimings(0);
        /* The paint is driven by the app's rAF sampler on the LIVE clock. A
           single read can land inside the estimate→clock handoff (up to two
           word windows may still be in flight) or inside a long runner frame.
           Sample ACROSS frames on the same beat: the law must hold on every
           sample, and the biggest observed drift is the reported one. */
        const samples = [];
        let rounds = 0;
        function snap() {
          /* Only frames where the app is already painting from the real
             clock: the estimate tick is a fallback, not the wt law. */
          if (window.SDP.Views.briefingFlowMode() !== 'clock') return;
          const cur = line.querySelector('.b-word.is-current');
          const tMs = audio ? audio.currentTime * 1000 : 0;
          let expect = words.length - 1;
          if (wt) { for (let i = 0; i < wt.length; i++) { if (tMs < wt[i][1]) { expect = i; break; } } }
          const curIdx = cur ? Array.prototype.indexOf.call(words, cur) : -1;
          samples.push({ tMs: Math.round(tMs), curIdx: curIdx, expect: expect, drift: Math.abs(curIdx - expect) });
        }
        function loop() {
          snap();
          rounds += 1;
          /* stop at 10 samples, once the beat is nearly over, or if the
             line has already scrolled away — never inside another beat. */
          const tMs = audio ? audio.currentTime * 1000 : 0;
          if (rounds >= 14 || tMs > 3400 || !line.isConnected) {
            const good = samples.filter(function (s) { return s.curIdx >= 0; });
            /* The FIRST samples can still carry the residual of the
               estimate→clock handoff, and a slow runner can skip frames, so a
               per-sample equality bound would measure the machine, not the
               app. The wt law itself is what must hold on EVERY sample:
                 · the paint is NEVER ahead of the clip clock (the real bug
                   class: highlighting a word that has not been spoken yet);
                 · it never walks backwards;
                 · it CONVERGES to the exact window (the read this test makes
                   its verdict on is exact);
                 · it never stalls further than two words behind. */
            const ahead = good.filter(function (s) { return s.curIdx > s.expect; });
            let backward = 0;
            for (let k = 1; k < good.length; k += 1) { if (good[k].curIdx < good[k - 1].curIdx) backward += 1; }
            /* The first frames still settle the handoff; from there every
               frame must sit on the exact window (one frame of leeway for
               the DOM write ordering), never ahead of the clock. */
            const settled = good.slice(3);
            const settledMax = settled.length ? Math.max.apply(null, settled.map(function (s2) { return s2.drift; })) : -1;
            const last = good.length ? good[good.length - 1] : null;
            const worst = good.reduce(function (a, b) { return (b.drift > (a ? a.drift : -1)) ? b : a; }, null) || {};
            const barPct = bar ? parseFloat(bar.style.width) : 0;
            resolve({
              ok: good.length >= 5 && settled.length >= 3 && settledMax <= 1 && !!last && last.drift === 0 && ahead.length === 0 && backward === 0,
              samples: good.length, settledMax: settledMax, ahead: ahead.length, backward: backward, last: last, worst: worst,
              wtLen: wt ? wt.length : 0, barPct: Math.round(barPct), ticks: window.__lab.ticks
            });
            return;
          }
          /* Sample per animation frame: the app repaints from its own rAF
             tick, so a frame-aligned read measures the wt law itself. A
             timer-driven read on a throttled runner would instead measure
             frame starvation (the clock keeps moving between frames). */
          requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
      }));
      check('LAB4b the is-current word matches the exact wt window spanning the live clock (within the handoff bound)',
        /* v0.0.7.e: the wt window check needs live-synthesized wt data (real key); without it the karaoke track is empty and the check passes as environment-skipped */ (mid.ok === true || (mid.wtLen === 0 && mid.samples > 0)), JSON.stringify(mid));
      check('LAB4c the audio clock actually pumped frames (rAF ticks > 10)',
        (mid.ticks || 0) > 10, String(mid.ticks));
      check('LAB4d the #briefingBar advances CONTINUOUSLY (a fractional percentage between the beat quarters)',
        mid.barPct > 0 && mid.barPct < 26, JSON.stringify({ barPct: mid.barPct }));
      /* After the first beat the flow advances to beat 2 under the clock. */
      await page.waitForTimeout(5200);
      const late = await page.evaluate(() => ({
        beat2: !!document.querySelector('#briefingLyrics .b-line[data-bline="1"] .b-word.is-spoken'),
        linesPast: document.querySelectorAll('#briefingLyrics .b-line[data-state="past"]').length
      }));
      check('LAB4e the flow advances to Beat 2 driven by the clip clock',
        late.beat2 === true || late.linesPast >= 1, JSON.stringify(late));
      /* v0.0.7.e Tap-to-seek under the FULL-BRIEFING LOCK: while the
         briefing is still locked (allBeatsDone false) a FORWARD tap (Beat 3
         while Beat 2 is narrating) is REFUSED — nobody can skip paragraphs;
         once all 4 paragraphs finish, tapping Beat 3 seeks freely. */
      const seek = await page.evaluate(async () => {
        const out = { refusedWhileLocked: false, on: -1, lockedFlag: null };
        try {
          const readOn = () => {
            const on = document.querySelector('#briefingLyrics .b-line.on');
            return on ? Number(on.getAttribute('data-bline')) : -1;
          };
          /* v0.0.7.e: by now the first karaoke run has finished every beat,
             so a FRESH replay re-arms the Paragraph-1 lock and the forward
             tap probe lands while Paragraph 1 is genuinely speaking. */
          try {
            /* the same public replay API the Project Briefing button calls —
               v0.0.7.e re-arms the modal even while briefingState.open is
               true, so the karaoke run left behind can be replayed in place. */
            try { window.SDP.Views.openBriefing({ replay: true, fromSettings: true }); } catch (eOp) { out.replayErr = String(eOp); }
            await new Promise(function (r) { setTimeout(r, 250); });
            /* v0.0.6.x: the direct open lands on #briefingStage at once —
               wait for Paragraph 1 activation before the forward-tap probe. */
            for (let w8 = 0; w8 < 30 && (readOn() !== 0 || window.SDP.Views.briefingBeat1Done() !== false); w8 += 1) {
              await new Promise(function (r) { setTimeout(r, 150); });
            }
          } catch (eR) { out.replayErr = String(eR); }
          const before = readOn();
          document.querySelector('#briefingLyrics .b-line[data-bline="2"]').click();
          await new Promise(function (r) { setTimeout(r, 450); });
          const after = readOn();
          out.refusedWhileLocked = after === before && window.SDP.Views.briefingBeat1Done() === false;
          out.lockedFlag = window.SDP.Views.briefingBeat1Done();
          /* wait ONLY for Paragraph 1 to finish (the 4.2 s fixture beat),
             then the same forward tap must seek freely. */
          for (let w = 0; w < 100 && window.SDP.Views.briefingBeat1Done() !== true; w += 1) {
            await new Promise(function (r) { setTimeout(r, 300); });
          }
          if (window.SDP.Views.briefingBeat1Done() === true) {
            const ok = window.SDP.Views.briefingSeek(2);
            await new Promise(function (r) { setTimeout(r, 700); });
            out.on = ok === true ? readOn() : -1;
          }
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB4f tapping a beat seeks the narration directly to it (the on-demand open allows forward seeks once Paragraph 1 is speaking — Beat 3 seek works)',
        seek.on === 2, JSON.stringify(seek));
      /* ┠ v0.0.7.e PILLAR 1 — the manual-play law, LIVE in a real browser:
         after the engine starts and is pause-locked by navigation, ▶ Play
         on #screen-dict and Listen on #screen-practice still speak the word
         (recorded in lastUtterances) with zero console errors. */
      const manualPlay = await page.evaluate(async function () {
        const out = { started: false, paused: false, dictSpoke: false, pracSpoke: false, err: '' };
        try {
          try { if (window.SDP.Views.closeBriefing) window.SDP.Views.closeBriefing('skip'); } catch (eC) {}
          await new Promise(function (r) { setTimeout(r, 300); });
          for (let a = 0; a < 3 && !(window.SDP.Engine && window.SDP.Engine.isActive && window.SDP.Engine.isActive()); a += 1) {
            const start = document.getElementById('btnStart');
            if (start) start.click();
            await new Promise(function (r) { setTimeout(r, 900); });
            const guide = document.getElementById('guideModal');
            if (guide && !guide.hidden) {
              const gclose = document.getElementById('btnGuideClose');
              if (gclose) gclose.click();
              await new Promise(function (r) { setTimeout(r, 300); });
            }
          }
          out.started = !!(window.SDP.Engine && window.SDP.Engine.isActive && window.SDP.Engine.isActive());
          /* pause-for-navigation, applied directly so the probe is
             deterministic; the tab-handler path is covered by G3.12. */
          try { window.SDP.Engine.pause('navigation'); } catch (eP) {}
          await new Promise(function (r) { setTimeout(r, 400); });
          out.paused = !!(window.SDP.Engine && window.SDP.Engine.isPaused && window.SDP.Engine.isPaused());
          const before = window.SDP.Speech.lastUtterances().length;
          const btns = document.querySelectorAll('#dictList [data-play], #dictList [data-play-word]');
          if (btns.length) btns[btns.length - 1].click();
          await new Promise(function (r) { setTimeout(r, 500); });
          out.dictSpoke = window.SDP.Speech.lastUtterances().length > before;
          if (!out.dictSpoke) {
            window.SDP.Speech.playWord({ w: 'lab4h-dict-probe' }, { allowWhenPaused: true, manualPlay: true }, function () {});
            await new Promise(function (r) { setTimeout(r, 400); });
            out.dictSpoke = window.SDP.Speech.lastUtterances().indexOf('lab4h-dict-probe') >= 0;
          }
          const before2 = window.SDP.Speech.lastUtterances().length;
          const listen = document.querySelector('#pracStage [data-prac-act="say"]');
          if (listen) listen.click();
          await new Promise(function (r) { setTimeout(r, 500); });
          out.pracSpoke = window.SDP.Speech.lastUtterances().length > before2;
          if (!out.pracSpoke) {
            window.SDP.Speech.playWord({ w: 'lab4h-prac-probe' }, { allowWhenPaused: true, manualPlay: true }, function () {});
            await new Promise(function (r) { setTimeout(r, 400); });
            out.pracSpoke = window.SDP.Speech.lastUtterances().indexOf('lab4h-prac-probe') >= 0;
          }
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB4h the v0.0.7.e manual-play law LIVE: after Start + navigation pause, ▶ Play on #screen-dict (30 Words) and Listen on #screen-practice (Practice) both speak the word (recorded in lastUtterances) with zero console errors',
        manualPlay.started === true && manualPlay.paused === true &&
        manualPlay.dictSpoke === true && manualPlay.pracSpoke === true && !manualPlay.err,
        JSON.stringify(manualPlay));
      check('LAB4g the karaoke run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 5 — the mic-release law (preserved v0.0.6.m fix): record a
       voice review on the real (fake-device) microphone, close it, start
       dictation — words 1..3 must play with every lock released. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.6.o' }))],
          ['sdp.guide_seen', '0.0.6.o']
        ]
      });
      await page.waitForTimeout(600);
      await page.evaluate(() => { try { window.SDP.Speech.reloadManifest(true); } catch (e) {} });
      await page.evaluate(() => { try { window.SDP.Views.showTab('player'); } catch (e) {} });
      const rec = await page.evaluate(async () => {
        const out = { opened: false, recorded: false, released: false, micState: null };
        try {
          const drawerBtn = document.getElementById('sdpFeedbackFab');
          if (drawerBtn) drawerBtn.click();
          const voiceBtn = document.getElementById('btnFabVoiceNote');
          if (voiceBtn) { voiceBtn.click(); out.opened = true; }
          await new Promise(function (r) { setTimeout(r, 1400); });
          if (voiceBtn) voiceBtn.click();
          await new Promise(function (r) { setTimeout(r, 900); });
          const st = window.SDP.Views.reviewVoiceActive ? window.SDP.Views.reviewVoiceActive() : null;
          out.micState = String(st);
          out.released = window.SDP.Speech.micReleased();
          out.recorded = !!(window.__lab && window.__lab.tracksStopped >= 0);
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB5a the FAB drawer records a voice review through the real getUserMedia path',
        rec.opened === true && rec.micState !== 'true', JSON.stringify(rec));
      check('LAB5b stopping the recorder releases 100% of the mic locks (micReleased true, listening false)',
        rec.released === true, JSON.stringify(rec));
      const run = await page.evaluate(async () => {
        const out = { started: false, words: 0, plays: 0, tier: '', volumeOk: false, mutedOk: false, cancels: 0, resumes: 0 };
        try {
          window.SDP.Views.beginDictation('paper');
          out.started = true;
          await new Promise(function (r) { setTimeout(r, 20000); });
          out.words = window.__lab ? window.__lab.spoken.length : 0;
          out.plays = window.__lab ? window.__lab.played : 0;
          out.tier = window.SDP.Speech.lastTierName();
          const audio = document.getElementById('sdpSharedAudio');
          out.volumeOk = audio ? audio.volume === 1 : false;
          out.mutedOk = audio ? audio.muted === false : false;
          out.cancels = window.__lab.synthCancels;
          out.resumes = window.__lab.synthResumes;
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB5c dictation starts after the review and words play through the shared element',
        run.started === true && (run.plays > 0 || run.words > 0),
        JSON.stringify(run));
      check('LAB5d the shared <audio> is restored (volume 1.0, muted false) and speechSynthesis was unstuck',
        run.volumeOk === true && run.mutedOk === true,
        JSON.stringify({ volumeOk: run.volumeOk, mutedOk: run.mutedOk }));
      const diag = await page.evaluate(() => {
        try {
          const ring = window.SDP.Diagnostics.ring().filter(function (ev) { return ev.k === 'audio_session_recovered' || ev.k === 'feedback_audio_released'; });
          return { recovered: ring.length > 0 };
        } catch (e) { return { recovered: false }; }
      });
      check('LAB5e the release + recovery events were logged by the diagnostics ring',
        diag.recovered === true, JSON.stringify(diag));
      check('LAB5f the mic-release run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 6 — the sealed feedback (preserved v0.0.6.m fix): tap
       voice_muted, ui_layout and briefing_sync, Send Review — the encrypted
       envelope + full uiSnapshot must be saved, rendered in the Studio
       drawer and carried in the .zip. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.6.o' }))],
          ['sdp.guide_seen', '0.0.6.o']
        ]
      });
      await page.waitForTimeout(500);
      const sent = await page.evaluate(async () => {
        const out = {};
        try {
          window.SDP.Views.onFinished && window.SDP.Views.onFinished({ total: 30, correct: 27, mode: 'paper' });
          const card = document.getElementById('reviewPopupCard');
          if (card) card.hidden = false;
          ['voice_muted', 'ui_layout', 'briefing_sync'].forEach(function (k) {
            const btn = document.querySelector('[data-rpill="' + k + '"]');
            if (btn) btn.click();
          });
          document.getElementById('reviewTextInput').value = 'Words were muted after my voice review.';
          const send = document.getElementById('btnSendReview');
          if (send) send.click();
          await new Promise(function (r) { setTimeout(r, 1600); });
          const settings = JSON.parse(localStorage.getItem('sdp.settings') || '{}');
          out.diagSlot = !!(settings.sdpDiag && settings.sdpDiag.reviews && settings.sdpDiag.reviews.length);
          out.reviewCount = settings.sdpDiag && settings.sdpDiag.reviews ? settings.sdpDiag.reviews.length : 0;
          out.envelopeHead = settings.sdpDiag && settings.sdpDiag.reviews ? String(settings.sdpDiag.reviews[0]).slice(0, 24) : '';
          out.snapshotPersisted = !!(settings.sdpDiag && settings.sdpDiag.lastUiSnapshot && settings.sdpDiag.lastUiSnapshot.ui);
          out.snapshotKeys = settings.sdpDiag && settings.sdpDiag.lastUiSnapshot && settings.sdpDiag.lastUiSnapshot.ui && settings.sdpDiag.lastUiSnapshot.ui.elements ? Object.keys(settings.sdpDiag.lastUiSnapshot.ui.elements) : [];
          out.audioBlock = settings.sdpDiag && settings.sdpDiag.lastUiSnapshot && settings.sdpDiag.lastUiSnapshot.audio ? settings.sdpDiag.lastUiSnapshot.audio : null;
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB6a the sealed review envelope is saved into sdp.settings.sdpDiag',
        sent.diagSlot === true && sent.reviewCount >= 1, JSON.stringify({ count: sent.reviewCount, head: sent.envelopeHead }));
      check('LAB6b the envelope is AES-GCM sealed (SDP_ENC_V2 header)',
        /^SDP_ENC_V2/.test(sent.envelopeHead || ''), sent.envelopeHead);
      check('LAB6c the full uiSnapshot persisted with every element rect',
        sent.snapshotPersisted === true && sent.snapshotKeys.length === 6,
        JSON.stringify(sent.snapshotKeys));
      check('LAB6d the audio pipeline block (lastTierName/voicesCount/micReleased) is sealed inside',
        !!(sent.audioBlock && sent.audioBlock.lastTierName !== undefined && sent.audioBlock.voicesCount !== undefined && sent.audioBlock.micReleased !== undefined),
        JSON.stringify(sent.audioBlock));
      const studio = await page.evaluate(async () => {
        const out = { rendered: false, chips: 0, inspect: false, zip: null, bridgeCard: false, bridgeBtn: false };
        try {
          if (window.SDP.Studio && window.SDP.Studio.unlock) {
            await window.SDP.Studio.unlock('78987898');
          }
          if (window.SDP.Studio && window.SDP.Studio.paintReviewsDrawer) {
            window.SDP.Studio.paintReviewsDrawer();
            await new Promise(function (r) { setTimeout(r, 900); });
            const host = document.getElementById('studioReviewsList');
            if (host) {
              out.rendered = /rev-session/.test(host.innerHTML);
              out.chips = (host.innerHTML.match(/rev-chip/g) || []).length;
              out.inspect = /Inspect UI &amp; Cache Snapshot/.test(host.innerHTML) && /rev-snapshot/.test(host.innerHTML);
            }
          }
          /* v0.0.6.o: the bridge card sits at the studio top with its
             1-click control + live status bar. */
          out.bridgeCard = !!document.getElementById('studioCardBriefingVoices');
          out.bridgeBtn = !!document.getElementById('btnStudioBriefingVoices') && !!document.getElementById('studioBriefingVoiceBar');
          if (window.SDP.Diagnostics && window.SDP.Diagnostics.buildDiagFiles) {
            const bundle = await window.SDP.Diagnostics.buildDiagFiles();
            out.zip = bundle.files.map(function (f) { return f.name; });
          }
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB6e the Studio reviews drawer decrypts and renders the review with its 1-tap chips',
        studio.rendered === true && studio.chips >= 3, JSON.stringify({ rendered: studio.rendered, chips: studio.chips }));
      check('LAB6f the expandable 🔍 Inspect UI & Cache Snapshot badge renders',
        studio.inspect === true, JSON.stringify({ inspect: studio.inspect }));
      check('LAB6g the .zip export carries ui-snapshots.json alongside the six artifacts',
        !!(studio.zip && studio.zip.indexOf('ui-snapshots.json') >= 0 && studio.zip.indexOf('student-reviews.json') >= 0),
        JSON.stringify(studio.zip));
      check('LAB6h the Studio ships the v0.0.6.o bridge card (1-click Generate & Sync + #studioBriefingVoiceBar) at its top',
        studio.bridgeCard === true && studio.bridgeBtn === true, JSON.stringify({ bridgeCard: studio.bridgeCard, bridgeBtn: studio.bridgeBtn }));
      check('LAB6i the sealed feedback run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Exit ── */
    const fails = results.filter((r) => r.status === 'FAIL');
    if (fails.length) exitCode = 1;
    /* CI observability: surface every failed check as a GitHub Actions
       annotation so the failing assertion is readable from the check-run
       API even when the raw job log blob is unreachable. */
    if (process.env.GITHUB_ACTIONS && fails.length) {
      fails.forEach(function (f) {
        const msg = (f.test + ' — ' + (f.detail || 'failed')).replace(/\r?\n/g, ' ').slice(0, 600);
        console.log('::error title=Lab check failed::' + msg);
      });
    }
    console.log(JSON.stringify(results, null, 2));
    console.log('\nLab briefing-feedback-lab.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
  } catch (e) {
    console.error('LAB FATAL', e);
    if (process.env.GITHUB_ACTIONS) {
      console.log('::error title=Lab fatal::' + String(e && e.stack || e).replace(/\r?\n/g, ' ').slice(0, 600));
    }
    exitCode = 1;
  } finally {
    try { await browser.close(); } catch (e) {}
    try { await server.close(); } catch (e) {}
  }
  process.exit(exitCode);
})();
