'use strict';
/* v41 (4.8.0) release gate - written from scratch, no regex .replace() surgery.
   ONE single neural British English (en-GB) female voice is the only voice in
   the whole app: https://translate.googleapis.com/translate_tts?...&tl=en-GB
   It speaks the pre-ready instructions, "Three, two, one.", "Number N. word."
   followed by the clean word, "Session paused.", "Welcome back. Continuing
   dictation number N." and the completion summary. dict.youdao.com (the hybrid
   one-word / phrase two-voice server) and ssl.gstatic.com are gone, and
   window.speechSynthesis.speak() never runs on a live online browser. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const acorn = require('acorn');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const version = readJson('version.json');
const config = readJson('config.json');
const session = readJson('session.json');
const KEY = 'sdp.v41_unified_voice_lifecycle';
const GH_KEY = 'sdp.gh_assets_v41';
const DEFAULT = './assets/bunny-live-wallpaper.mp4';
const UNIFIED = 'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-GB&ttsspeed=0.95&q=';
const PAPER_INTRO = "Welcome. Prepare your pen and paper. Each word is read twice. Press Yes, I'm ready to begin.";
const TYPE_INTRO = "Welcome. Each word is read twice. Type your answer and press Enter. Press Yes, I'm ready to begin.";
const COUNTDOWN = 'Three, two, one.';
const TEST_PHRASE = 'Sound check. Number 1. bicycle.';
const FILLERS = ['listen again', 'one more time', 'once more', 'and again', 'spot on', "let's begin", 'listen carefully', 'brilliant, well done', 'nearly there', 'alright, listen'];
const has = (value, token) => String(value).indexOf(token) !== -1;
const compact = (value) => String(value).replace(/\s+/g, '');
const cssText = () => (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || ['', ''])[1];
const CSS = compact(cssText());
const hasCss = (token) => has(CSS, compact(token));
const script = (html.match(/<script>([\s\S]*?)<\/script>/) || ['', ''])[1];
const masterTag = (html.match(/<audio id="ttsMasterAudio"[^>]*>/) || [''])[0];
const sourceOf = (target) => Object.keys(target).filter((k) => typeof target[k] === 'function').map((k) => String(target[k])).join('\n');
const fillerHits = (text) => FILLERS.filter((phrase) => String(text).toLowerCase().indexOf(phrase) !== -1);
const spokenText = (url) => {
  const raw = String(url || '');
  if (raw.indexOf('data:') === 0) return '';
  const at = raw.indexOf('&q=');
  if (at < 0) return '';
  try { return decodeURIComponent(raw.slice(at + 3)); } catch (e) { return ''; }
};

function withApp(fn) {
  const app = harness();
  try { return fn(app); } finally { app.close(); }
}

/* headless / offline device-voice branch: a pinned en-GB woman the fake clock drives */
function withVoice(fn) {
  return withApp(({ q, w, clock }) => {
    const spoken = [];
    w.SpeechSynthesisUtterance = function (text) { this.text = String(text); this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; };
    w.speechSynthesis = {
      getVoices() { return [{ lang: 'en-GB', name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', localService: false }]; },
      cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
      speak(u) { spoken.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name, rate: u.rate }); w.setTimeout(() => { if (u.onend) u.onend(); }, 1); }
    };
    q.Speech.supported = true;
    q.Speech._pinnedSynthVoice = null;
    q.Speech.readVoices();
    return fn({ q, w, clock, spoken });
  });
}

/* the real browser branch: live UA, a master <audio> that really "plays", and a
   speech engine that throws the moment anything asks it to speak. */
function withStream(fn) {
  return withApp(({ q, w, clock }) => {
    Object.defineProperty(w.navigator, 'userAgent', { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', configurable: true });
    const played = [];
    let synthCalls = 0;
    w.speechSynthesis = {
      getVoices: () => [],
      cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
      speak() { synthCalls += 1; throw new Error('the device voice must never speak on a live online browser'); }
    };
    w.SpeechSynthesisUtterance = function (text) { this.text = String(text); };
    w.HTMLMediaElement.prototype.load = function () {};
    w.HTMLMediaElement.prototype.pause = function () {};
    w.HTMLMediaElement.prototype.play = function () {
      const el = this;
      if (String(el.tagName).toUpperCase() === 'AUDIO') played.push(String(el.getAttribute('src') || ''));
      w.setTimeout(() => { if (el.onplaying) el.onplaying(); }, 5);
      w.setTimeout(() => { if (el.onended) el.onended(); }, 60);
      return Promise.resolve();
    };
    q.Speech.supported = true;
    const clips = () => played.map(spokenText).filter(Boolean);
    return fn({ q, w, clock, played, clips, synthCalls: () => synthCalls });
  });
}

const readyButton = (w) => Array.from(w.document.querySelectorAll('#sheets button')).find((b) => /I['’]m ready/.test(b.textContent));
const startSession = (ctx, opts) => {
  ctx.q.Eng.start(opts || {});
  ctx.clock.tick(250);
  return readyButton(ctx.w);
};
const tickFor = (clock, ms, step) => { for (let i = 0; i < ms; i += (step || 100)) clock.tick(step || 100); };

/* ------------------------------------------------------------------ build */

test('v41 build gate: single-file ES5, no static external links, under 442,000 bytes', () => {
  assert.ok(script.length > 100000, 'the main inline app is present');
  assert.doesNotThrow(() => acorn.parse(script, { ecmaVersion: 5 }));
  for (const token of ['const ', 'let ', '=>', '`', 'async function', 'await ']) {
    assert.ok(!has(script, token), 'ES5 only; found ' + token);
  }
  assert.ok(!has(html, '<link'), 'no static external or local link tag');
  assert.ok(!/<script[^>]+src=/.test(html), 'no external script tag');
  assert.ok(Buffer.byteLength(html) < 442000, 'index.html is under the 442,000-byte release budget: ' + Buffer.byteLength(html));
  const check = cp.spawnSync(process.execPath, ['tests/check.cjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.ok(has(html, 'APP_VERSION="4.8.0"'));
});

test('release identity: schema 41, appVersion 4.8.0, English, Amy, paper, one voice key', () => {
  for (const [name, data] of [['version', version], ['config', config], ['session', session]]) {
    assert.equal(data.ver, 41, name + '.ver');
    assert.equal(data.appVersion, '4.8.0', name + '.appVersion');
    assert.equal(data.settingsRev, 41, name + '.settingsRev');
    assert.equal(data.lang, 'en', name + '.lang');
    assert.equal(data.guideLang, 'en', name + '.guideLang');
    assert.equal(data.voice, 'Amy', name + '.voice');
    assert.equal(data.lockedVoice, 'Amy', name + '.lockedVoice');
    assert.equal(data.mode, 'paper', name + '.mode');
    assert.equal(data.activeVideoSrc, DEFAULT, name + '.activeVideoSrc');
    assert.equal(data.activeMediaType, 'video', name + '.activeMediaType');
    assert.equal(data.videoDim, 18, name + '.videoDim');
    assert.equal(data.storageKey, KEY, name + '.storageKey');
    assert.equal(data.ghMediaCache, GH_KEY, name + '.ghMediaCache');
    assert.ok(!('dictHost' in data) || has(data.dictHost, 'dictionaryapi'), name + ' has no dictionary voice host');
    assert.ok(!has(JSON.stringify(data), 'dict.youdao.com'), name + ' has zero secondary dictionary voice');
    assert.ok(!has(JSON.stringify(data), 'ssl.gstatic.com'), name + ' has zero gstatic voice');
  }
  assert.equal(version.version, '4.8.0');
  assert.equal(version.ghMediaCache, GH_KEY);
  assert.ok(version.legacyMediaCaches.indexOf('sdp.gh_assets_v40') >= 0);
  assert.match(version.features.humanVoice, /translate\.googleapis\.com\/translate_tts/);
  assert.match(version.features.humanVoice, /tl=en-GB/);
  assert.match(version.features.voiceLifecycle, /Eng\.readyGo/);
  assert.match(version.features.testSound, /Sound check\. Number 1\. bicycle\./);
  assert.match(version.features.numberedWords, /Number N\. <word>\./);
  assert.match(version.features.pauseResume, /Session paused/);
  assert.match(version.features.finishSummary, /Dictation complete\. Well done\./);
  assert.equal(config.defaults.voice, 'Amy');
  assert.equal(config.defaults.lang, 'en');
  assert.equal(config.defaults.guideLang, 'en');
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.session.voice, 'Amy');
  assert.equal(session.session.voice, 'Amy');
  assert.equal(config.tts.silenceBetweenRepeatsMs, 700);
  assert.equal(config.tts.singleVoiceUrl.indexOf(UNIFIED), 0, 'the documented clip URL is the one neural en-GB endpoint');
});

test('CONFIG and defaultData expose the v41 key, the Amy lock and the one voice', () => withApp(({ q }) => {
  assert.equal(q.APP_VERSION, '4.8.0');
  assert.equal(q.CONFIG.key, KEY);
  assert.equal(q.CONFIG.schema, 41);
  assert.equal(q.CONFIG.settingsRev, 41);
  assert.equal(q.CONFIG.lockedVoice, 'Amy');
  assert.equal(q.CONFIG.ghMediaCache, GH_KEY);
  assert.ok(q.CONFIG.legacyMediaCaches.indexOf('sdp.gh_assets_v40') >= 0);
  const d = q.DB.defaults();
  assert.equal(d.v, 41);
  assert.equal(d.settingsRev, 41);
  assert.equal(d.settings.lang, 'en');
  assert.equal(d.settings.guideLang, 'en');
  assert.equal(d.settings.mode, 'paper');
  assert.equal(d.settings.voice, 'Amy');
  assert.equal(d.settings.writeFixed, 5);
  assert.equal(d.settings.repeats, 2);
  assert.equal(d.settings.activeVideoSrc, DEFAULT);
  assert.equal(d.settings.activeMediaType, 'video');
  assert.equal(d.settings.videoDim, 18);
  assert.ok(!('humanReactions' in d.settings));
  assert.ok(!('elevenLabsKey' in d.settings));
}));

test('the interface opens in English with an optional Sinhala User Guide switch and Sinhala font stack', () => withApp(({ q, w }) => {
  assert.ok(/<html lang="en"/.test(html));
  q.DB.data.settings.lang = 'si';
  q.DB.data.settings.guideLang = 'si';
  q.UI.init();
  assert.equal(q.DB.data.settings.lang, 'en');
  assert.equal(q.DB.data.settings.guideLang, 'en');
  q.UI.openWelcomeGuide();
  const body = w.document.getElementById('guideBody');
  assert.ok(body);
  const tabs = Array.from(body.querySelectorAll('.seg button'));
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0].textContent, 'English');
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[1].textContent, 'සිංහල');
  assert.ok(w.document.getElementById('btnGuideStart'));
  assert.ok(hasCss('font-family:"Noto Sans Sinhala","Sinhala Sangam MN","Nirmala UI",Inter,sans-serif!important'));
  assert.ok(has(cssText(), 'line-height:1.72'));
}));

/* --------------------------------------------------------- the one voice */

test('one persistent #ttsMasterAudio element, preloaded, never CORS-tainted, never duplicated', () => withApp(({ q, w }) => {
  assert.ok(masterTag, 'the static #ttsMasterAudio tag exists');
  assert.match(masterTag, /preload="auto"/);
  assert.match(masterTag, /playsinline/);
  assert.match(masterTag, /referrerpolicy="no-referrer"/);
  assert.ok(!/crossorigin/i.test(masterTag), 'no crossOrigin attribute on the master element');
  const live = w.document.getElementById('ttsMasterAudio');
  assert.ok(live, 'the element is in the live DOM');
  assert.equal(live.getAttribute('crossorigin'), null);
  assert.notEqual(live.crossOrigin, 'anonymous');
  assert.equal(w.document.querySelectorAll('#ttsMasterAudio').length, 1, 'exactly one master audio element');
  assert.equal(q.Speech.master(), live, 'TTS.master() reuses the same element');
  q.Speech.unlock();
  q.Speech.unlock();
  assert.equal(q.Speech.master(), live, 'unlock never creates a second element');
  assert.equal(w.document.querySelectorAll('#ttsMasterAudio').length, 1);
  assert.ok(!/\.crossOrigin\s*=\s*["']anonymous/.test(script), 'crossOrigin is never set');
  assert.ok(has(script, 'referrerpolicy","no-referrer'), 'pre-buffered clips also use referrerpolicy=no-referrer');
  assert.ok(!has(script, 'new Audio('), 'never a throwaway Audio() inside a timer');
  assert.ok(has(script, 'pointerdown'), 'the master element is unlocked from a pointerdown gesture');
}));

test('TTS.cleanWordOnly keeps only the clean target word or phrase', () => withApp(({ q }) => {
  const TTS = q.Speech;
  assert.equal(typeof TTS.cleanWordOnly, 'function');
  assert.equal(typeof TTS.getSingleVoiceUrl, 'function');
  const cases = [
    ['tyre/tire', 'tyre'],
    ['tyre / tire', 'tyre'],
    ['bus stop', 'bus stop'],
    ['bicycle', 'bicycle'],
    ['boarding pass', 'boarding pass'],
    ['tourist information centre', 'tourist information centre'],
    ['  bicycle  ', 'bicycle'],
    ['', ''],
    ['   ', '']
  ];
  for (const [raw, clean] of cases) {
    assert.equal(TTS.cleanWordOnly(raw), clean, 'cleanWordOnly(' + JSON.stringify(raw) + ')');
  }
}));

test('TTS.getSingleVoiceUrl is the ONLY voice URL: one neural en-GB endpoint, zero mixing', () => withApp(({ q }) => {
  const TTS = q.Speech;
  assert.equal(TTS.UNIFIED, UNIFIED, 'the one unified neural en-GB studio endpoint');
  assert.equal(TTS.getSingleVoiceUrl('bicycle'), UNIFIED + 'bicycle');
  assert.equal(TTS.getSingleVoiceUrl('bus stop'), UNIFIED + 'bus%20stop');
  assert.equal(TTS.getSingleVoiceUrl('boarding pass'), UNIFIED + 'boarding%20pass');
  assert.equal(TTS.getSingleVoiceUrl('Number 7. bus stop.'), UNIFIED + 'Number%207.%20bus%20stop.');
  assert.equal(TTS.getSingleVoiceUrl('   '), '');
  assert.equal(TTS.getUnifiedVoiceUrl('bicycle'), TTS.getSingleVoiceUrl('bicycle'), 'the legacy alias cannot point anywhere else');
  assert.deepEqual(Array.from(TTS.getStudioMp3Candidates('bus stop')), [UNIFIED + 'bus%20stop']);
  assert.equal(TTS.mp3For('bicycle'), UNIFIED + 'bicycle', 'the dictionary fallback is the same single voice');
  for (const word of ['bicycle', 'bus stop', 'tyre/tire', 'windscreen', 'Number 30.', 'Three, two, one.']) {
    const url = TTS.getSingleVoiceUrl(word);
    assert.equal(url.indexOf(UNIFIED), 0, 'every clip uses the single locked URL: ' + url);
    assert.ok(has(url, 'tl=en-GB'), 'every clip is British English');
    assert.ok(has(url, 'ttsspeed=0.95'), 'every clip uses the same studio pace');
  }
}));

test('there is exactly ONE voice host: youdao, gstatic and multi-voice fallbacks are gone', () => {
  for (const dead of ['dict.youdao.com', 'youdao', 'ssl.gstatic.com', 'translate.google.com', 'api.streamelements.com', 'elevenlabs', 'mp3-forvo']) {
    assert.ok(!has(html.toLowerCase(), dead), 'retired voice engine removed from the build: ' + dead);
  }
  assert.equal((script.match(/translate\.googleapis\.com\/translate_tts\?ie=UTF-8&client=tw-ob&tl=en-GB&ttsspeed=0\.95&q=/g) || []).length, 1, 'one studio endpoint, declared once');
  assert.equal((script.match(/https:\/\/[^"']*translate_tts/g) || []).length, 1, 'no second speech endpoint anywhere');
  withApp(({ q }) => {
    const engine = sourceOf(q.Speech);
    assert.ok(engine.length > 2000, 'the TTS engine source was captured');
    for (const dead of ['youdao', 'gstatic', 'streamelements', 'elevenlabs', 'mp3--_gb_1']) {
      assert.ok(!has(engine.toLowerCase(), dead), 'no second voice engine in TTS: ' + dead);
    }
  });
});

test('zero filler phrases survive in TTS or the Eng dictation playback', () => withApp(({ q }) => {
  const engine = sourceOf(q.Speech);
  const playback = sourceOf(q.Eng);
  assert.deepEqual(fillerHits(engine), [], 'TTS must never speak a filler phrase');
  assert.deepEqual(fillerHits(playback), [], 'Eng dictation playback must never speak a filler phrase');
  assert.deepEqual(fillerHits(html), [], 'the whole build is free of the retired filler phrases');
  assert.equal(q.Speech.getHumanRepeatPhrase, undefined);
  assert.equal(q.Speech.speakHumanReaction, undefined);
  assert.equal(q.Speech.reactionsEnabled, undefined);
  assert.ok(!('humanReactions' in q.DB.data.settings));
}));

/* ------------------------------------------------------- test sound button */

test('TTS.testSound plays the real dictation voice and marks ✓ Dictation Voice Verified', () => withStream(({ q, w, clock, clips }) => {
  assert.equal(typeof q.Speech.testSound, 'function');
  q.Speech.testSound();
  clock.tick(400);
  assert.ok(clips().indexOf(TEST_PHRASE) >= 0, 'Sound check. Number 1. bicycle. goes through the one dictation voice');
  q.Eng.start({});
  clock.tick(250);
  const pill = w.document.getElementById('voiceTestPill');
  const btn = w.document.getElementById('btnReadyTest');
  assert.ok(btn, 'the Are you ready? sheet has #btnReadyTest');
  assert.ok(pill, 'the Are you ready? sheet has a voice status pill');
  btn.click();
  clock.tick(400);
  assert.equal(pill.textContent, '✓ Dictation Voice Verified');
  assert.ok(clips().indexOf(TEST_PHRASE) >= 0);
  for (const id of ['btnTestVoice', 'btnTestVoicePlayer', 'btnTestVoiceDiag']) {
    assert.ok(has(html, id), 'every test-sound button exists: ' + id);
  }
  assert.equal(q.Speech.testSound.length >= 0, true);
  assert.ok(!/AudioContext|OscillatorNode/.test(String(q.Speech.testSound)), 'Test sound never falls back to an oscillator beep');
}));

/* ---------------------------------------------------- pre-ready instructions */

test('Eng.start speaks brief professional pre-ready instructions in the single voice', () => withStream(({ q, w, clock, clips }) => {
  const btn = startSession({ q, w, clock });
  assert.ok(btn, 'the Are you ready? sheet is open');
  assert.ok(clips().indexOf(PAPER_INTRO) >= 0, 'paper mode instructions: ' + clips().join(' | '));
  assert.ok(clips().every((text) => text === PAPER_INTRO || text === ''), 'nothing else is spoken before Yes, I\'m ready');
}));

test('Eng.start speaks the typing instructions when the session is typed', () => withStream(({ q, clock, clips }) => {
  q.Eng.start({ mode: 'type' });
  clock.tick(250);
  assert.ok(clips().indexOf(TYPE_INTRO) >= 0, 'type mode instructions: ' + clips().join(' | '));
}));

/* ------------------------------------------- three, two, one then word one */

test('Eng.readyGo speaks "Three, two, one." and starts Word 1 only after the visual countdown', () => withStream(({ q, w, clock, clips }) => {
  const btn = startSession({ q, clock, w });
  btn.click();
  clock.tick(100);
  assert.ok(clips().indexOf(COUNTDOWN) >= 0, 'the countdown is spoken immediately');
  assert.equal(q.Eng.phase, 'countdown');
  assert.equal(w.document.getElementById('cdNum').textContent, '3');
  clock.tick(700);
  assert.equal(w.document.getElementById('cdNum').textContent, '2');
  clock.tick(700);
  assert.equal(w.document.getElementById('cdNum').textContent, '1');
  assert.equal(q.Eng.idx, 0, 'word 1 has not started while the countdown runs');
  assert.notEqual(q.Eng.st, 'waiting');
  tickFor(clock, 1400);
  assert.ok(clips().indexOf('Number 1. guidebook.') >= 0, 'word 1 launches after the countdown: ' + clips().join(' | '));
  assert.equal(q.Eng.idx, 0);
}));

/* ------------------------------------------- numbered words + clean repeat */

test('every dictation announces "Number N. <word>." then repeats only the clean word', () => withStream(({ q, w, clock, clips }) => {
  startSession({ q, clock, w }).click();
  tickFor(clock, 3000);
  const first = clips();
  assert.ok(first.indexOf('Number 1. guidebook.') >= 0, 'pass 1 announces the dictation number and the word: ' + first.join(' | '));
  assert.ok(first.indexOf('guidebook') >= 0, 'pass 2 repeats only the clean word');
  assert.ok(first.indexOf('Number 1. guidebook.') < first.indexOf('guidebook'), 'number first, clean repeat second');
  q.Eng.startWord(1);
  tickFor(clock, 1200);
  const second = clips();
  assert.ok(second.indexOf('Number 2. handlebars.') >= 0, 'the second word is announced with its number');
  assert.ok(second.lastIndexOf('handlebars') > second.indexOf('Number 2. handlebars.'));
  const compound = q.Eng.words.map((item) => item.w).indexOf('public transport');
  assert.ok(compound >= 0, 'the compound phrase is in Session 7');
  q.Eng.startWord(compound);
  tickFor(clock, 1200);
  const phrase = 'Number ' + (compound + 1) + '. public transport.';
  assert.ok(clips().indexOf(phrase) >= 0, 'compound phrases keep one voice: ' + clips().join(' | '));
  assert.ok(clips().indexOf('public transport') >= 0);
}));

test('the last dictation is announced as "Final word. Number 30. windscreen."', () => withStream(({ q, w, clock, clips }) => {
  startSession({ q, clock, w }).click();
  tickFor(clock, 2600);
  assert.equal(q.Eng.words.length, 30);
  q.Eng.startWord(29);
  tickFor(clock, 1200);
  assert.ok(clips().indexOf('Final word. Number 30. windscreen.') >= 0, 'the final numbered announcement: ' + clips().join(' | '));
  assert.ok(clips().indexOf('windscreen') >= 0, 'the final word is repeated clean');
}));

test('the player badge always shows which dictation number is continuing', () => withStream(({ q, w, clock }) => {
  startSession({ q, clock, w }).click();
  tickFor(clock, 2600);
  assert.equal(w.document.getElementById('plStep').textContent, 'Dictation #1 of 30');
  assert.equal(w.document.getElementById('plProgText').textContent, 'Dictation #1 of 30');
  q.Eng.startWord(4);
  tickFor(clock, 300);
  assert.equal(w.document.getElementById('plStep').textContent, 'Dictation #5 of 30');
  assert.equal(w.document.getElementById('plProgText').textContent, 'Dictation #5 of 30');
  assert.match(w.document.getElementById('plStatus').textContent, /Number 5 of 30/);
}));

test('the writing timer is five seconds and starts after the clean repeat', () => withStream(({ q, w, clock, clips }) => {
  assert.equal(q.DB.data.settings.writeFixed, 5);
  startSession({ q, clock, w }).click();
  tickFor(clock, 4400);
  assert.equal(q.Eng.phase, 'write');
  assert.equal(q.Eng.countdown.total, 5);
  const before = clips().length;
  tickFor(clock, 5200);
  assert.ok(clips().length > before, 'the next dictation starts after the timer');
  assert.equal(q.Eng.idx, 1);
}));

test('Replay repeats "Number N. word." then the clean word and restarts the timer', () => withStream(({ q, w, clock, clips }) => {
  startSession({ q, clock, w }).click();
  tickFor(clock, 3000);
  const btn = w.document.getElementById('btnReplay');
  assert.ok(btn, 'the player has #btnReplay');
  btn.click();
  tickFor(clock, 300);
  assert.ok(clips().filter((t) => t === 'Number 1. guidebook.').length >= 2, 'the number is repeated: ' + clips().join(' | '));
  assert.equal(q.Eng.phase, 'write', 'the five second timer restarts after the replay');
}));

/* ------------------------------------------------ pause and welcome back */

test('pause speaks "Session paused." and resume speaks the welcome-back number', () => withStream(({ q, w, clock, clips }) => {
  startSession({ q, clock, w }).click();
  tickFor(clock, 3000);
  q.Eng.pause();
  clock.tick(300);
  assert.equal(q.Eng.st, 'paused');
  assert.ok(clips().indexOf('Session paused.') >= 0, 'pause is spoken: ' + clips().join(' | '));
  assert.match(w.document.getElementById('plStatus').textContent, /Paused · Dictation #1/);
  const before = clips().filter((t) => t === 'Number 1. guidebook.').length;
  q.Eng.resume();
  assert.match(w.document.getElementById('plStatus').textContent, /Resuming Dictation #1/);
  clock.tick(300);
  assert.ok(clips().indexOf('Welcome back. Continuing dictation number 1.') >= 0, 'resume is spoken: ' + clips().join(' | '));
  tickFor(clock, 1600);
  assert.ok(clips().filter((t) => t === 'Number 1. guidebook.').length > before, 'the full reading restarts after welcome back');
  assert.equal(q.Eng.idx, 0);
  assert.equal(q.Eng.phase, 'write');
}));

/* ------------------------------------------------------- finish summaries */

test('finishing a paper session speaks the completion summary', () => withStream(({ q, w, clock, clips }) => {
  startSession({ q, w, clock });
  q.Eng.finish(false);
  clock.tick(400);
  assert.ok(clips().indexOf('Dictation complete. Well done. Review all thirty words below.') >= 0, clips().join(' | '));
  assert.equal(q.DB.data.history.length, 1);
}));

test('finishing a typed session reads the score out loud', () => withStream(({ q, clock, clips }) => {
  q.Eng.start({ mode: 'type' });
  clock.tick(250);
  q.Eng.finish(false);
  clock.tick(400);
  assert.ok(clips().some((t) => /^Dictation complete\. Well done\. Your score is \d+ percent\.$/.test(t)), clips().join(' | '));
}));

test('exiting the player or the ready sheet stops every sound immediately', () => withStream(({ q, w, clock }) => {
  startSession({ q, w, clock });
  q.Eng.stop();
  clock.tick(100);
  assert.equal(q.Eng.st, 'idle');
  assert.equal(q.Speech._playing, false, 'nothing is left playing after an exit');
  assert.equal(q.Speech.audioStarted, false);
}));

/* ------------------------------------------- the device voice is never used */

test('window.speechSynthesis.speak() never runs on a live online browser', () => withStream(({ q, w, clock, synthCalls }) => {
  startSession({ q, clock, w }).click();
  tickFor(clock, 3000);
  q.Eng.pause();
  clock.tick(300);
  q.Eng.resume();
  tickFor(clock, 2000);
  q.Eng.finish(false);
  clock.tick(300);
  assert.equal(synthCalls(), 0, 'the OS voice is never spoken on a live online browser');
  assert.ok(has(script, 'hushSynth'), 'TTS always cancels the device voice first');
  assert.ok(/hushSynth:function\(\)\{try\{window\.speechSynthesis&&window\.speechSynthesis\.cancel\(\)\}/.test(script));
}));

test('the headless / fully offline branch still speaks through the device voice', () => withVoice(({ q, clock, spoken }) => {
  q.Speech.speakSingle('Hello Britain');
  clock.tick(200);
  assert.ok(spoken.length >= 1, 'the offline fallback is audible');
  assert.equal(spoken[0].lang, 'en-GB');
}));

/* ------------------------------------------------------------- migration */

test('v40 profile migration and resetToV41 force English, paper, Amy and the bundled video', () => withApp(({ q }) => {
  const old = q.defaultData();
  old.v = 40;
  old.settingsRev = 40;
  old.settings.lang = 'si';
  old.settings.guideLang = 'si';
  old.settings.mode = 'typed';
  old.settings.voice = 'Daniel';
  old.settings.rate = 0.5;
  old.settings.elevenLabsKey = 'sk-test';
  old.settings.activeVideoSrc = 'https://example.test/outside.mp4';
  old.settings.activeMediaType = 'photo';
  const migrated = q.DB.migrate(old);
  assert.equal(migrated.v, 41);
  assert.equal(migrated.settingsRev, 41);
  assert.equal(migrated.settings.lang, 'en');
  assert.equal(migrated.settings.guideLang, 'en');
  assert.equal(migrated.settings.mode, 'paper');
  assert.equal(migrated.settings.voice, 'Amy');
  assert.equal(migrated.settings.rate, 0.96);
  assert.equal(migrated.settings.writeFixed, 5);
  assert.equal(migrated.settings.repeats, 2);
  assert.equal(migrated.settings.activeVideoSrc, DEFAULT);
  assert.equal(migrated.settings.activeMediaType, 'video');
  assert.equal(migrated.settings.videoDim, 18);
  assert.equal(typeof q.DB.resetToV41, 'function');
  const again = q.DB.migrate(migrated);
  assert.equal(again.v, 41);
  assert.equal(again.settingsRev, 41);
  assert.ok(has(html, 'sdp.v40_one_studio_voice'), 'the v40 profile is read once for migration');
}));

test('Session 7 keeps all 30 travel words, five-second writing, x2 repeats and Amy en-GB defaults', () => {
  const list = session.lists.find((item) => item.id === 'list_session_7_travel');
  assert.ok(list);
  assert.equal(list.words.length, 30);
  ['guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration', 'journey', 'luggage', 'machine', 'mechanic', 'nationality', 'on business', 'on vacation', 'overnight', 'passenger', 'public transport', 'reception', 'reservation', 'road sign', 'signpost', 'spaceship', 'suitcase', 'tourist information centre', 'traffic lights', 'tunnel', 'tyre/tire', 'vehicle', 'visa', 'waiting room', 'windscreen'].forEach((word) => assert.ok(list.words.some((item) => item.w === word), word));
  list.words.forEach((word) => assert.ok(!word.audio, 'no second voice recording is bundled: ' + word.w));
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.rate, 0.96);
  assert.equal(config.session.voice, 'Amy');
  assert.equal(config.session.lang, 'en');
  assert.equal(config.session.guideLang, 'en');
});

/* ---------------------------------------------------- preserved v22-v40 UI */

test('architectural interface keeps its radii, cobalt/graphite palette, white headings and hidden orbs', () => withApp(({ w }) => {
  assert.ok(hasCss('border-radius:10px!important'));
  assert.ok(hasCss('border-radius:11px!important'));
  assert.ok(hasCss('border-radius:12px!important'));
  assert.ok(hasCss('border-radius:16px!important'));
  assert.ok(hasCss('--graphite:rgba(17,24,39,0.88)'));
  assert.ok(hasCss('--panel:rgba(11,15,25,0.72)'));
  assert.ok(hasCss('linear-gradient(180deg,#3b82f6 0,#2563eb 100%)!important'));
  assert.ok(hasCss('*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important'));
  assert.ok(hasCss('--fg:#f8fafc'));
  assert.ok(hasCss('.bg-aurora,.bg-grid,.blob,.bubble,.disc,.hansanaSpot,.orb,.player-backdrop,.player-orb,.ring,.stripes{display:none!important'));
  assert.ok(!hasCss('border-radius:999px'));
  assert.ok(!hasCss('background-clip:text'));
  const doc = w.document;
  assert.equal(w.getComputedStyle(doc.getElementById('btnStart')).borderRadius, '10px');
  assert.equal(w.getComputedStyle(doc.getElementById('homeHero')).borderRadius, '16px');
  assert.equal(w.getComputedStyle(doc.getElementById('tabbar')).borderRadius, '16px');
  assert.equal(w.getComputedStyle(doc.querySelector('.seg')).borderRadius, '11px');
}));

test('GPU motion and Hansana credits retain the 0.04s press, 0.22s glide and reveal cycle', () => {
  assert.ok(CSS.indexOf('.16s') >= 0, '0.16 second response transition');
  assert.ok(CSS.indexOf('.04s') >= 0 || CSS.indexOf('40ms!important') >= 0, '0.04 second press feedback');
  assert.ok(CSS.indexOf('.22s') >= 0, '0.22 second screen glide');
  assert.ok(CSS.indexOf('cubic-bezier(.16,1,.3,1)') >= 0);
  assert.ok(CSS.indexOf('#credit{z-index:9999!important') >= 0);
  assert.ok(hasCss('@keyframes hansanaRevealCycle') && CSS.indexOf('opacity:.12') >= 0);
  assert.ok(has(html, 'CREDITS GOES TO'));
  assert.ok(has(html, 'setTimeout(function(){U.setCls(document.body,"credit-intro",!1)},2800)'));
});

test('wallpaper stays an /assets/-only single hardware video with the v41 discovery cache', () => withApp(({ q, w }) => {
  assert.equal(q.DEFAULT_WALLPAPER_SRC, DEFAULT);
  assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
  assert.equal(q.DB.data.settings.activeMediaType, 'video');
  assert.ok(q.isAssetsMedia(DEFAULT));
  assert.equal(q.normalizeAssetPath('https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-live-wallpaper.mp4?v=41#t=1'), DEFAULT);
  assert.equal(q.normalizeAssetPath('./qa/evidence/fatal-390.png'), '');
  assert.equal(w.document.querySelectorAll('#bgLiveVideo').length, 1);
  assert.ok(has(html, GH_KEY));
  assert.ok(has(html, 'ghMediaTtl:9e5'));
  assert.ok(has(html, 'preload="none"'));
  assert.ok(CSS.indexOf('#bgLiveAmbilight{') >= 0 && CSS.indexOf('#bgLiveAmbilight{') < CSS.indexOf('display:none!important', CSS.indexOf('#bgLiveAmbilight{')));
  assert.ok(hasCss('filter:none'));
  assert.ok(has(html, '?v=41'));
}));

test('legacy v22-v40 core contracts remain in the v41 single-file app', () => {
  const tokens = [
    '#bgLiveWrap', '#bgLiveAmbilight', '#bgLiveVideo', '#bgLiveCanvas', '#bgContrastScrim', '#bgLivePhoto', '#liveVideoInput',
    'video-gallery-badge', 'syncAmbilight:function(){}', 'playAmbilight:function(){}', 'renderGallery:function', 'previewThumb:function',
    'renderGalleryList:function', 'startPractisingFromGuide', 'cmp-ok', 'cmp-miss', 'streak-broken', 'plTickHero', 'plWrongHero',
    'ansMirrorText', 'ans-caret', 'materialMixer', 'CREDITS GOES TO', 'tire:"tyre"', 'tyre/tire', 'navigator.serviceWorker',
    'sdp_wallpaper_db', 'wake:function', 'sleep:function', 'draw:function', 'rafId:null', '💔 Streak Broken! (0)', 'guide-credit-pill',
    'cancelReadyAndExit', 'ansInput', 'tabInd', 'segSync', 'lgStage', 'hollow', 'sanitiseWallpaper',
    'syncRemote', 'buildSearchIndex', 'searchWords', 'ansCompare', 'Next Wallpaper', 'Refresh from GitHub', 'resetToV33:function',
    'resetToV34:function', 'resetToV35:function', 'resetToV36:function', 'resetToV37:function', 'resetToV38:function', 'resetToV39:function',
    'resetToV40:function', 'resetToV41:function', 'sdp.v37_human_british', 'sdp.v35_rainbow_liquid_glass', 'sdp.v34_highlighted_ui', GH_KEY, 'sdp.gh_assets_v40',
    '_loadedSrc', 'adaptPerformance:function', 'gal-preview-btn', 'bindStreamStatus:function', 'recoverVideo:function', 'liteFx:function',
    'markPlaying:function', 'credit-intro', 'hansanaRevealCycle', 'sdpDynamicFonts', 'Noto Sans Sinhala', 'btnPlayerClose',
    'touch-action:manipulation', 'scale(.965) translateZ(0)', 'preloadSessionWords', 'mountVoiceBadge', 'isBritishAudio', 'mp3For',
    'spell', 'splitLong', 'speakText', 'getSingleVoiceUrl', 'cleanWordOnly', 'replayMaster', 'audioCache', 'liveBrowser', 'hushSynth',
    'preBuffer', 'testSound', 'numberedPhrase', 'markVoiceVerified', 'speakFinishSummary', 'paintProg', 'btnReadyTest', 'btnReplay',
    KEY
  ];
  tokens.forEach((token) => assert.ok(has(html, token), 'missing preserved feature token: ' + token));
  for (const token of ['backdrop-filter: blur(4px)', 'backdrop-filter:blur(4px)', 'brightness(1.02)', 'blur(4px) saturate(140%)', '#ff3d77', 'transition:all!important', 'background-clip:text']) {
    assert.ok(!has(html, token), 'retired style token returned: ' + token);
  }
});

test('admin PIN, text-mode answer input, IME space sentinel and no password field remain', () => withApp(({ q, w }) => {
  assert.equal(require('./test-pin.cjs'), '7898');
  assert.ok(has(html, '#pinPad'));
  assert.ok(has(html, 'pinSalt') && has(html, 'pinHash'));
  assert.ok(!has(html, 'inp.type="password"'));
  assert.ok(has(html, 'ccHoneypot'));
  q.DB.data.settings.mode = 'type';
  q.Eng.start({ mode: 'type' });
  const input = w.document.getElementById('ansInput');
  assert.ok(input);
  assert.equal(input.type, 'text');
  assert.equal(input.autocomplete, 'off');
  assert.equal(input.value, ' ');
}));

test('all bundled media stays under its size budget and inside /assets/', () => {
  assert.ok(fs.existsSync(path.join(root, 'assets', 'bunny-live-wallpaper.mp4')));
  assert.ok(fs.existsSync(path.join(root, 'assets', 'bunny-poster.webp')));
  assert.ok(fs.statSync(path.join(root, 'assets', 'bunny-live-wallpaper.mp4')).size < 3 * 1024 * 1024);
  assert.ok(fs.statSync(path.join(root, 'assets', 'bunny-poster.webp')).size < 64 * 1024);
  const media = html.match(/\.\/[A-Za-z0-9_\-./]+\.(mp4|webm|mov|m4v|webp|jpe?g|png|mp3)/g) || [];
  media.forEach((item) => assert.ok(item.indexOf('./assets/') === 0, 'media outside /assets/: ' + item));
  assert.ok(!has(html, 'ssl.gstatic.com'));
});

test('low-end performance safeguards and runtime font loading remain headless-safe', () => {
  assert.ok(has(html, 'liteFx:function') && has(html, 'addRing:function'));
  assert.ok(has(html, 'passive:!0'));
  assert.ok(has(html, 'U.on(document,"visibilitychange"'));
  assert.ok(has(html, 'adaptPerformance:function'));
  assert.ok(has(html, 'prefers-reduced-motion') || hasCss('@media (prefers-reduced-motion:reduce)'));
  assert.ok(has(html, 'requestIdleCallback') || has(html, 'frameProbe'));
  assert.ok(has(html, 'HeadlessChrome') && has(html, 'navigator.onLine'));
});
