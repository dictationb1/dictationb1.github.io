'use strict';
/* v40 release gate — rewritten from scratch with fs.writeFileSync.
   Dictation speaks ONLY the clean target word: Repetition 1 -> 750ms studio
   silence -> Repetition 2 replays the exact same #ttsMasterAudio buffer with
   currentTime = 0. One locked British English woman studio voice is the only
   voice in the whole app, and window.speechSynthesis never speaks on a live
   online browser. */
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
const KEY = 'sdp.v40_one_studio_voice';
const GH_KEY = 'sdp.gh_assets_v40';
const DEFAULT = './assets/bunny-live-wallpaper.mp4';
const UNIFIED = 'https://dict.youdao.com/dictvoice?type=1&audio=';
const VOICE_LABEL = 'British English Studio Voice (en-GB · Professional)';
const FILLERS = ['listen again', 'one more time', 'once more', 'and again', 'spot on', "let's begin", 'listen carefully', 'brilliant, well done', 'nearly there', 'alright, listen'];
const has = (value, token) => String(value).indexOf(token) !== -1;
const compact = (value) => String(value).replace(/\s+/g, '');
const cssText = () => (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || ['', ''])[1];
const CSS = compact(cssText());
const hasCss = (token) => has(CSS, compact(token));
const script = (html.match(/<script>([\s\S]*?)<\/script>/) || ['', ''])[1];
const masterTag = (html.match(/<audio id="ttsMasterAudio"[^>]*>/) || [''])[0];
const sourceOf = (target) => Object.keys(target).filter((k) => typeof target[k] === 'function').map((k) => String(target[k])).join('\n');
const decodeClip = (url) => decodeURIComponent(String(url || '').split('audio=')[1] || '');
const fillerHits = (text) => FILLERS.filter((phrase) => String(text).toLowerCase().indexOf(phrase) !== -1);

function withApp(fn, seed) {
  const app = harness(seed);
  try { return fn(app); } finally { app.close(); }
}

/* jsdom has no speech engine: install one pinned en-GB woman so the headless
   (test / offline) branch can be driven by the fake clock. */
function withVoice(fn, seed) {
  return withApp(({ q, w, clock }) => {
    const spoken = [];
    w.SpeechSynthesisUtterance = function (text) { this.text = String(text); this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; };
    w.speechSynthesis = {
      getVoices() { return [{ lang: 'en-GB', name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', localService: false }]; },
      cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
      speak(u) { spoken.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name, rate: u.rate, pitch: u.pitch }); w.setTimeout(() => { if (u.onend) u.onend(); }, 1); }
    };
    q.Speech.supported = true;
    q.Speech._pinnedSynthVoice = null;
    q.Speech.readVoices();
    return fn({ q, w, clock, spoken });
  }, seed);
}

/* the real browser path: a live UA, a master <audio> element that really
   "plays", and a speech engine that throws if anything tries to use it. */
function withStream(fn, seed) {
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
      if (String(el.tagName).toUpperCase() === 'AUDIO') played.push({ src: el.getAttribute('src'), at: w.Date.now() });
      w.setTimeout(() => { if (el.onplaying) el.onplaying(); }, 5);
      w.setTimeout(() => { if (el.onended) el.onended(); }, 60);
      return Promise.resolve();
    };
    const master = w.document.getElementById('ttsMasterAudio');
    const clock2 = { value: 0, sets: [], src: [] };
    Object.defineProperty(master, 'currentTime', {
      configurable: true,
      get() { return clock2.value; },
      set(v) { clock2.value = v; clock2.sets.push(v); }
    });
    q.Speech.supported = true;
    return fn({ q, w, clock, played, master, ct: clock2, synthCalls: () => synthCalls });
  }, seed);
}

const said = (spoken, text) => spoken.filter((s) => String(s.text).trim() === text);
const heard = (spoken) => spoken.filter((s) => String(s.text).trim());
const clips = (played) => played.filter((p) => String(p.src || '').indexOf('data:') !== 0);
const qaList = (words) => ({ id: 'qa_list', name: 'QA list', version: 1, published: true, words: words.map((w) => (typeof w === 'string' ? { w } : w)) });
const tickUntil = (clock, check, step, max) => {
  for (let i = 0; i < max && !check(); i += 1) clock.tick(step);
};

/* ------------------------------------------------------------------ build */

test('v40 build gate: single-file ES5, no static external links, under 442,000 bytes', () => {
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
  assert.ok(has(html, 'APP_VERSION="4.7.0"'));
});

test('release identity: schema 40, appVersion 4.7.0, English, Amy, paper, one studio voice key', () => {
  for (const [name, data] of [['version', version], ['config', config], ['session', session]]) {
    assert.equal(data.ver, 40, name + '.ver');
    assert.equal(data.appVersion, '4.7.0', name + '.appVersion');
    assert.equal(data.settingsRev, 40, name + '.settingsRev');
    assert.equal(data.lang, 'en', name + '.lang');
    assert.equal(data.guideLang, 'en', name + '.guideLang');
    assert.equal(data.voice, 'Amy', name + '.voice');
    assert.equal(data.lockedVoice, 'Amy', name + '.lockedVoice');
    assert.equal(data.mode, 'paper', name + '.mode');
    assert.equal(data.activeVideoSrc, DEFAULT, name + '.activeVideoSrc');
    assert.equal(data.activeMediaType, 'video', name + '.activeMediaType');
    assert.equal(data.videoDim, 18, name + '.videoDim');
    assert.equal(data.storageKey, KEY, name + '.storageKey');
    assert.ok(!('humanReactions' in data), name + ' has no retired reaction setting');
  }
  assert.equal(version.version, '4.7.0');
  assert.equal(version.ghMediaCache, GH_KEY);
  assert.ok(version.legacyMediaCaches.indexOf('sdp.gh_assets_v39') >= 0);
  assert.match(version.features.humanVoice, /one locked British English woman studio voice/i);
  assert.match(version.features.sessionFlow, /750ms/);
  assert.match(version.features.cleanWords, /cleanWordOnly/);
  assert.match(version.features.repeatReplay, /currentTime = 0/);
  assert.match(version.features.noDeviceVoice, /never called on a live online browser/i);
  assert.ok(!('humanReactions' in version.features));
  assert.ok(!('elevenLabs' in version.features));
  assert.equal(config.defaults.voice, 'Amy');
  assert.equal(config.defaults.lang, 'en');
  assert.equal(config.defaults.guideLang, 'en');
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.session.voice, 'Amy');
  assert.equal(session.session.voice, 'Amy');
  assert.equal(config.tts.silenceBetweenRepeatsMs, 750);
  assert.equal(config.tts.bufferTimeoutMs, 3500);
  assert.equal(config.tts.singleVoiceUrl.indexOf(UNIFIED), 0);
  assert.ok(!has(JSON.stringify(config.defaults), 'humanReactions'));
  assert.ok(!has(JSON.stringify(config.defaults), 'elevenLabsKey'));
});

test('CONFIG and defaultData expose the v40 key, the Amy lock and the one studio voice', () => withApp(({ q }) => {
  assert.equal(q.APP_VERSION, '4.7.0');
  assert.equal(q.CONFIG.key, KEY);
  assert.equal(q.CONFIG.schema, 40);
  assert.equal(q.CONFIG.settingsRev, 40);
  assert.equal(q.CONFIG.lockedVoice, 'Amy');
  assert.equal(q.CONFIG.ghMediaCache, GH_KEY);
  assert.ok(q.CONFIG.legacyMediaCaches.indexOf('sdp.gh_assets_v39') >= 0);
  const d = q.DB.defaults();
  assert.equal(d.v, 40);
  assert.equal(d.settingsRev, 40);
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

/* --------------------------------------------------------- one locked voice */

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
  assert.equal((script.match(/createElement\("audio"\)/g) || []).length, 1, 'the master element is the only audio ever created');
  assert.ok(!has(script, 'new Audio('), 'never a throwaway Audio() inside a timer');
  assert.ok(has(script, 'pointerdown'), 'the master element is unlocked from a pointerdown gesture');
}));

test('TTS.cleanWordOnly sends ONLY the clean target word or phrase to the voice engine', () => withApp(({ q }) => {
  const TTS = q.Speech;
  assert.equal(typeof TTS.cleanWordOnly, 'function');
  assert.equal(typeof TTS.getSingleVoiceUrl, 'function');
  const cases = [
    ['tyre/tire', 'tyre'],
    ['tyre / tire', 'tyre'],
    ['bus stop', 'bus stop'],
    ['bicycle', 'bicycle'],
    ['boarding pass', 'boarding pass'],
    ['train station', 'train station'],
    ['on vacation', 'on vacation'],
    ['  bicycle  ', 'bicycle'],
    ['', ''],
    ['   ', '']
  ];
  for (const [raw, clean] of cases) {
    assert.equal(TTS.cleanWordOnly(raw), clean, 'cleanWordOnly(' + JSON.stringify(raw) + ')');
  }
  assert.equal(TTS.getSingleVoiceUrl('bicycle'), UNIFIED + 'bicycle');
  assert.equal(TTS.getSingleVoiceUrl('bus stop'), UNIFIED + 'bus%20stop');
  assert.equal(TTS.getSingleVoiceUrl('tyre/tire'), UNIFIED + 'tyre');
  assert.equal(TTS.getSingleVoiceUrl('boarding pass'), UNIFIED + 'boarding%20pass');
  assert.equal(TTS.getSingleVoiceUrl('   '), '');
  assert.equal(TTS.UNIFIED, UNIFIED, 'the one locked en-GB type=1 studio endpoint');
  assert.equal(TTS.getUnifiedVoiceUrl('bicycle'), TTS.getSingleVoiceUrl('bicycle'), 'the legacy alias cannot point anywhere else');
  assert.deepEqual(Array.from(TTS.getStudioMp3Candidates('bus stop')), [UNIFIED + 'bus%20stop']);
  assert.deepEqual(Array.from(TTS.getStudioMp3Candidates('bicycle', true)), [UNIFIED + 'bicycle']);
  assert.equal(TTS.mp3For('bicycle'), UNIFIED + 'bicycle', 'the dictionary fallback is the same single voice');
}));

test('there is exactly ONE voice URL: no secondary or fallback voice hosts anywhere', () => {
  for (const dead of ['ssl.gstatic.com', 'translate.googleapis', 'translate_tts', 'translate.google', 'api.streamelements.com', 'oxford', 'elevenlabs', '20200429']) {
    assert.ok(!has(script.toLowerCase(), dead), 'retired voice engine removed from the build: ' + dead);
  }
  assert.equal((script.match(/https:\/\/dict\.youdao\.com\/dictvoice\?type=1&audio=/g) || []).length, 1, 'one studio host, declared once');
  withApp(({ q }) => {
    const engine = sourceOf(q.Speech);
    assert.ok(engine.length > 2000, 'the Speech engine source was captured');
    for (const dead of ['ssl.gstatic.com', 'translate_tts', 'streamelements', 'oxford', 'elevenlabs', 'mp3--_gb_1']) {
      assert.ok(!has(engine.toLowerCase(), dead), 'no second voice engine in TTS: ' + dead);
    }
    const urls = ['bicycle', 'bus stop', 'boarding pass', 'tyre/tire', 'windscreen', 'Number 7.'].map((w) => q.Speech.getSingleVoiceUrl(w));
    urls.forEach((url) => assert.equal(url.indexOf(UNIFIED), 0, 'every clip uses the single locked studio URL: ' + url));
  });
});

test('zero filler phrases survive in TTS or the Eng dictation playback', () => withApp(({ q }) => {
  const engine = sourceOf(q.Speech);
  const playback = sourceOf(q.Eng);
  assert.deepEqual(fillerHits(engine), [], 'TTS must never speak a filler phrase');
  assert.deepEqual(fillerHits(playback), [], 'Eng dictation playback must never speak a filler phrase');
  assert.deepEqual(fillerHits(html), [], 'the whole build is free of the retired filler phrases');
  assert.equal(q.Speech.getHumanRepeatPhrase, undefined, 'TTS.getHumanRepeatPhrase is deleted');
  assert.equal(q.Speech.speakHumanReaction, undefined, 'TTS.speakHumanReaction is deleted');
  assert.equal(q.Speech.getHumanReactionPhrase, undefined, 'TTS.getHumanReactionPhrase is deleted');
  assert.equal(q.Speech.reactionsEnabled, undefined, 'the reaction gate is deleted');
  assert.equal(q.Speech.reactionPhrases, undefined, 'the reaction phrase table is deleted');
  assert.equal(q.Speech.repeatCues, undefined, 'the repeat cue table is deleted');
  assert.equal(q.Speech.setReactions, undefined, 'the reaction switch is deleted');
  assert.ok(!('humanReactions' in q.DB.data.settings), 'no reaction toggle in the saved profile');
}));

/* ---------------------------------------------- the clean word cycle (headless) */

test('speakWordCycle says ONLY the clean word: Repetition 1 -> 750ms silence -> Repetition 2', () => withVoice(({ q, clock, spoken }) => {
  const TTS = q.Speech;
  let done = null;
  const phases = [];
  TTS.speakWordCycle({ w: 'bicycle' }, 0, (ok) => { done = ok; }, (i, n) => phases.push(i + '/' + n));
  assert.equal(done, null, 'the cycle waits for the onended of each repetition');
  clock.tick(5);
  assert.deepEqual(heard(spoken).map((s) => s.text), ['bicycle'], 'repetition 1 is the clean word and nothing else');
  clock.tick(700);
  assert.deepEqual(heard(spoken).map((s) => s.text), ['bicycle'], 'the 750ms studio silence is respected');
  clock.tick(60);
  assert.deepEqual(heard(spoken).map((s) => s.text), ['bicycle', 'bicycle'], 'repetition 2 is the exact same clean word');
  clock.tick(40);
  assert.equal(done, true);
  assert.deepEqual(phases, ['1/2', '2/2']);
  assert.ok(heard(spoken).every((s) => s.voice === TTS.getPinnedVoice().name), 'never changes voice between repeats');
  assert.deepEqual(fillerHits(heard(spoken).map((s) => s.text).join(' ')), []);
  spoken.length = 0;
  TTS.speakWordCycle({ w: 'tyre/tire' }, 1, () => {});
  clock.tick(2000);
  assert.deepEqual(heard(spoken).map((s) => s.text), ['tyre', 'tyre'], 'tyre/tire is spoken as the clean word tyre');
}));

test('Repetition 2 replays the exact same #ttsMasterAudio buffer (currentTime = 0, no new request)', () => withStream(({ q, clock, played, master, ct, synthCalls }) => {
  const TTS = q.Speech;
  let done = null;
  TTS.speakWordCycle({ w: 'bus stop' }, 0, (ok) => { done = ok; });
  clock.tick(10);
  const first = clips(played);
  assert.equal(first.length, 1, 'repetition 1 requests the studio clip once');
  assert.equal(decodeClip(first[0].src), 'bus stop');
  const srcAfterRep1 = master.getAttribute('src');
  clock.tick(80);
  assert.equal(done, null, 'repetition 2 waits for the 750ms studio silence');
  const setsBefore = ct.sets.length;
  clock.tick(700);
  assert.equal(clips(played).length, 1, 'still inside the 750ms silence');
  clock.tick(40);
  const both = clips(played);
  assert.equal(both.length, 2, 'repetition 2 plays the buffered clip again');
  assert.equal(both[0].src, both[1].src, 'the exact same buffer, never a different voice');
  assert.equal(master.getAttribute('src'), srcAfterRep1, 'the master element never loads a second source for repetition 2');
  assert.ok(ct.sets.length > setsBefore, 'repetition 2 rewinds the buffer');
  assert.equal(ct.sets[ct.sets.length - 1], 0, 'repetition 2 sets currentTime = 0 before play()');
  clock.tick(100);
  assert.equal(done, true);
  assert.equal(synthCalls(), 0, 'the device voice never speaks');
  assert.deepEqual(fillerHits(decodeClip(both[1].src)), []);
}));

test('window.speechSynthesis.speak is NEVER called on a live online browser', () => withStream(({ q, clock, played, synthCalls }) => {
  const TTS = q.Speech;
  assert.equal(TTS.liveBrowser(), true, 'a live online Chrome browser is detected');
  assert.equal(TTS.canSynth(), false, 'the device voice is disabled for live browsers');
  let synthOk = null;
  assert.doesNotThrow(() => TTS.speakSynth('bicycle', 0.96, (ok) => { synthOk = ok; }));
  clock.tick(100);
  assert.equal(synthOk, false, 'speakSynth refuses instead of speaking robotically');
  assert.doesNotThrow(() => TTS.primeSynth(), 'priming never queues a device utterance');
  TTS.unlock();
  TTS.speakSingle('bicycle', () => {});
  clock.tick(200);
  assert.equal(synthCalls(), 0, 'no device utterance was ever requested');
  assert.ok(clips(played).some((p) => decodeClip(p.src) === 'bicycle'), 'the studio clip played instead');
}));

test('preloadSessionWords pre-buffers every clean word through the single studio URL', () => withStream(({ q }) => {
  const TTS = q.Speech;
  assert.equal(typeof TTS.audioCache, 'object');
  const n = TTS.preloadSessionWords([{ w: 'bicycle' }, { w: 'bus stop' }, { w: 'tyre/tire' }, 'windscreen']);
  assert.equal(n, 4);
  const keys = Object.keys(TTS.audioCache);
  assert.ok(keys.length >= 4, 'every word is cached');
  keys.forEach((url) => assert.equal(url.indexOf(UNIFIED), 0, 'only the single locked studio host is preloaded: ' + url));
  assert.ok(TTS.audioCache[UNIFIED + 'bicycle']);
  assert.ok(TTS.audioCache[UNIFIED + 'bus%20stop']);
  assert.ok(TTS.audioCache[UNIFIED + 'tyre'], 'tyre/tire pre-buffers the clean word');
  assert.ok(!keys.some((url) => url.indexOf('%2F') >= 0), 'no bilingual slash ever reaches the voice engine');
}));

/* ------------------------------------------------------------- the session */

test('Eng.start opens the ready sheet with no spoken greeting and no spoken countdown', () => withStream(({ q, w, clock, played }) => {
  q.Eng.start({});
  const sheet = w.document.getElementById('readySheet');
  assert.ok(sheet, '#readySheet is open');
  assert.equal(q.Eng.st, 'ready');
  assert.match(sheet.textContent, /Are you ready\?/);
  assert.ok(sheet.textContent.indexOf("Get your pen and paper. Tap I'm ready when you are.") >= 0);
  assert.ok(Array.from(sheet.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Skip countdown'));
  assert.ok(Array.from(sheet.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Test sound'));
  assert.equal(w.document.querySelectorAll('#sheets .sheet').length, 1, 'one single far-right cross sheet');
  clock.tick(500);
  assert.deepEqual(clips(played), [], 'not one word, greeting or countdown is spoken before the tap');
  assert.equal(q.DB.data.settings.showWord, false);
}));

test('Word 1: clean word twice from one buffer, then the 5s writing timer, then Word 2', () => withStream(({ q, w, clock, played }) => {
  q.DB.data.settings.numbers = false;
  q.DB.data.settings.writeFixed = 5;
  const list = qaList([{ w: 'bicycle', s: 'I ride a bicycle.' }, { w: 'bus stop', s: 'Meet me at the bus stop.' }]);
  q.Eng.start({ list, listName: 'QA' });
  q.Eng.skipReady();
  tickUntil(clock, () => q.Eng.st === 'waiting', 50, 200);
  assert.equal(q.Eng.st, 'waiting', 'Word 1 reached its writing timer');
  const first = clips(played).map((p) => decodeClip(p.src));
  assert.deepEqual(first, ['bicycle', 'bicycle'], 'only the clean word is heard, twice: ' + JSON.stringify(first));
  const status = (w.document.querySelector('#plStatus') || {}).textContent || '';
  assert.match(status, /Write the word now \(5s\)/);
  assert.ok(q.Eng.countdown && q.Eng.countdown.left > 0 && q.Eng.countdown.left <= 5);
  clock.tick(4000);
  assert.equal(q.Eng.st, 'waiting');
  clock.tick(1500);
  assert.equal(q.Eng.idx, 1, 'the five-second timer advanced to Word 2');
  tickUntil(clock, () => q.Eng.st === 'waiting', 50, 200);
  const all = clips(played).map((p) => decodeClip(p.src));
  assert.deepEqual(all, ['bicycle', 'bicycle', 'bus stop', 'bus stop'], 'Word 2 speaks its own clean word twice');
  assert.deepEqual(fillerHits(all.join(' ')), []);
}));

test('Skip countdown jumps straight to Word 1 without waiting for a spoken countdown', () => withVoice(({ q, w, clock }) => {
  q.DB.data.settings.numbers = false;
  q.Eng.start({ list: qaList(['apple', 'pear']), listName: 'QA' });
  const skip = Array.from(w.document.querySelectorAll('#sheets button')).find((b) => b.textContent.trim() === 'Skip countdown');
  skip.click();
  clock.tick(50);
  assert.equal(q.Eng.idx, 0);
  assert.equal(w.document.getElementById('readySheet'), null);
  clock.tick(3000);
  assert.equal(q.Eng.st, 'waiting');
}));

test('the 5s paper timer auto-advances from Word 1 to Word 30 and finishes the session', () => withVoice(({ q, clock, spoken }) => {
  q.DB.data.settings.numbers = false;
  const words = [];
  for (let i = 1; i <= 30; i += 1) words.push({ w: 'word' + i });
  q.Eng.start({ list: qaList(words), listName: 'QA 30' });
  q.Eng.skipReady();
  for (let i = 0; i < 6000 && !q.DB.data.history.length; i += 1) clock.tick(100);
  assert.equal(q.DB.data.history.length, 1, 'the full session finished');
  assert.equal(q.DB.data.history[0].wordCount, 30);
  assert.equal(q.DB.data.history[0].mode, 'paper');
  assert.ok(['finished', 'idle'].indexOf(q.Eng.st) >= 0, 'the player closed onto the Results screen');
  assert.ok(q.Errors.items.length === 0, 'the 30-word session ran without an error');
  assert.deepEqual(fillerHits(heard(spoken).map((s) => s.text).join(' ')), [], 'only clean dictation words were spoken');
}));

test('Pause stops the state machine and Resume replays the current word cleanly', () => withVoice(({ q, clock, spoken }) => {
  q.DB.data.settings.numbers = false;
  q.Eng.start({ list: qaList(['apple', 'pear']), listName: 'QA' });
  q.Eng.skipReady();
  for (let i = 0; i < 60 && q.Eng.st !== 'waiting'; i += 1) clock.tick(100);
  assert.equal(q.Eng.st, 'waiting');
  q.Eng.pause();
  assert.equal(q.Eng.st, 'paused');
  assert.equal(q.Eng.idx, 0);
  const before = said(spoken, 'apple').length;
  q.Eng.resume();
  clock.tick(3000);
  assert.ok(said(spoken, 'apple').length >= before, 'resume keeps the same word audible');
  assert.equal(q.Eng.idx, 0);
  assert.ok(q.Eng.st === 'waiting' || q.Eng.st === 'speaking');
}));

test('Repeat word, Slower and Spell stay on the one voice and return to the writing timer', () => withVoice(({ q, clock, spoken }) => {
  q.DB.data.settings.numbers = false;
  q.Eng.start({ list: qaList(['bicycle']), listName: 'QA' });
  q.Eng.skipReady();
  for (let i = 0; i < 60 && q.Eng.st !== 'waiting'; i += 1) clock.tick(100);
  const before = heard(spoken).length;
  q.Eng.repeatWord();
  clock.tick(400);
  assert.ok(heard(spoken).length > before, 'the repeat is spoken');
  assert.ok(heard(spoken).slice(before).every((s) => s.voice === q.Speech.getPinnedVoice().name));
  assert.ok(heard(spoken).slice(before).every((s) => s.text === 'bicycle'), 'the repeat is the clean word only');
  q.Eng.slower();
  clock.tick(400);
  assert.ok(q.Eng.st === 'waiting' || q.Eng.st === 'speaking');
  q.Eng.spellWord();
  clock.tick(3000);
  assert.ok(heard(spoken).some((s) => /^bicycle\.$/.test(s.text)), 'spelling returns to the writing phase');
}));

test('the dictionary speaker, practice replay and review all use the single studio voice', () => withStream(({ q, w, clock, played, master }) => {
  q.Dict.speak('bicycle');
  clock.tick(20);
  assert.equal(decodeClip(master.getAttribute('src')), 'bicycle', 'the dictionary speaker streams the clean word');
  q.Screens.practice();
  clock.tick(20);
  q.Screens.pracSay('bus stop');
  clock.tick(20);
  assert.equal(decodeClip(master.getAttribute('src')), 'bus stop', 'practice replay uses the same single voice');
  q.UI.closeSheet();
  const urls = clips(played).map((p) => String(p.src));
  assert.ok(urls.length >= 2);
  urls.forEach((url) => assert.equal(url.indexOf(UNIFIED), 0, 'one host for every screen: ' + url));
  assert.ok(!has(w.document.body.textContent, 'Human studio reactions'));
}));

/* --------------------------------------------------------------- settings */

test('Settings shows one locked studio voice and no reaction or second-voice controls', () => withApp(({ q, w }) => {
  q.UI.setTab('set');
  const body = w.document.getElementById('setBody');
  const text = body.textContent;
  assert.ok(!w.document.getElementById('tHumanReactions'), 'the reactions toggle is gone');
  assert.ok(!w.document.getElementById('tElevenLabsKey'), 'the second voice provider is gone');
  assert.ok(text.indexOf(VOICE_LABEL) >= 0, 'the one studio voice is named in Settings');
  assert.ok(text.indexOf('Offline device voice') < 0, 'no device-voice picker');
  assert.ok(!has(text, 'Human studio reactions'));
  const badge = w.document.getElementById('voiceHumanBadgeSettings');
  assert.ok(badge);
  assert.match(badge.textContent, /British English Studio Voice \(en-GB · Professional\)/);
  assert.equal(badge.getAttribute('role'), 'status');
  assert.equal(q.Errors.items.length, 0, 'the Settings screen renders without an error');
}));

test('the Dictation Player mounts the single-voice presence badge', () => withApp(({ q, w }) => {
  q.Eng.start({});
  const badge = w.document.querySelector('#layers #voiceHumanBadge');
  assert.ok(badge);
  assert.match(badge.textContent, /British English Studio Voice/);
  assert.equal(badge.getAttribute('role'), 'status');
  assert.equal(badge.querySelectorAll('.vh-eq i').length, 4);
}));

/* ------------------------------------------------------------- migration */

test('v39 profile migration and resetToV40 force English, paper, Amy and the bundled video', () => withApp(({ q }) => {
  const old = q.defaultData();
  old.v = 39;
  old.settingsRev = 39;
  old.settings.lang = 'si';
  old.settings.guideLang = 'si';
  old.settings.mode = 'typed';
  old.settings.voice = 'Daniel';
  old.settings.rate = 0.5;
  old.settings.humanReactions = false;
  old.settings.elevenLabsKey = 'sk-test';
  old.settings.activeVideoSrc = 'https://example.test/outside.mp4';
  old.settings.activeMediaType = 'photo';
  const migrated = q.DB.migrate(old);
  assert.equal(migrated.v, 40);
  assert.equal(migrated.settingsRev, 40);
  assert.equal(migrated.settings.lang, 'en');
  assert.equal(migrated.settings.guideLang, 'en');
  assert.equal(migrated.settings.mode, 'paper');
  assert.equal(migrated.settings.voice, 'Amy');
  assert.equal(migrated.settings.rate, 0.96);
  assert.equal(migrated.settings.activeVideoSrc, DEFAULT);
  assert.equal(migrated.settings.activeMediaType, 'video');
  assert.equal(migrated.settings.videoDim, 18);
  assert.ok(!('humanReactions' in q.DB.defaults().settings), 'the v40 profile has no reaction setting');
  assert.equal(sourceOf(q.Speech).toLowerCase().indexOf('elevenlabs'), -1, 'the retired provider is never read by TTS');
  assert.equal(sourceOf(q.Speech).toLowerCase().indexOf('humanreactions'), -1, 'the retired reaction flag is never read by TTS');
  assert.equal(typeof q.DB.resetToV40, 'function');
  const again = q.DB.migrate(migrated);
  assert.equal(again.v, 40);
  assert.equal(again.settingsRev, 40);
  assert.ok(has(html, 'sdp.v39_single_unified_voice'), 'the v39 profile is read once for migration');
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

/* ---------------------------------------------------- preserved v22-v39 UI */

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

test('wallpaper stays an /assets/-only single hardware video with the v40 discovery cache', () => withApp(({ q, w }) => {
  assert.equal(q.DEFAULT_WALLPAPER_SRC, DEFAULT);
  assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
  assert.equal(q.DB.data.settings.activeMediaType, 'video');
  assert.ok(q.isAssetsMedia(DEFAULT));
  assert.equal(q.normalizeAssetPath('https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-live-wallpaper.mp4?v=40#t=1'), DEFAULT);
  assert.equal(q.normalizeAssetPath('./qa/evidence/fatal-390.png'), '');
  assert.equal(w.document.querySelectorAll('#bgLiveVideo').length, 1);
  assert.ok(has(html, GH_KEY));
  assert.ok(has(html, 'ghMediaTtl:9e5'));
  assert.ok(has(html, 'preload="none"'));
  assert.ok(CSS.indexOf('#bgLiveAmbilight{') >= 0 && CSS.indexOf('#bgLiveAmbilight{') < CSS.indexOf('display:none!important', CSS.indexOf('#bgLiveAmbilight{')));
  assert.ok(hasCss('filter:none'));
  assert.ok(has(html, '?v=40'));
}));

test('legacy v22-v39 core contracts remain in the v40 single-file app', () => {
  const tokens = [
    '#bgLiveWrap', '#bgLiveAmbilight', '#bgLiveVideo', '#bgLiveCanvas', '#bgContrastScrim', '#bgLivePhoto', '#liveVideoInput',
    'video-gallery-badge', 'syncAmbilight:function(){}', 'playAmbilight:function(){}', 'renderGallery:function', 'previewThumb:function',
    'renderGalleryList:function', 'startPractisingFromGuide', 'cmp-ok', 'cmp-miss', 'streak-broken', 'plTickHero', 'plWrongHero',
    'ansMirrorText', 'ans-caret', 'materialMixer', 'CREDITS GOES TO', 'tire:"tyre"', 'tyre/tire', 'navigator.serviceWorker',
    'sdp_wallpaper_db', 'wake:function', 'sleep:function', 'draw:function', 'rafId:null', '💔 Streak Broken! (0)', 'guide-credit-pill',
    'cancelReadyAndExit', 'ansInput', 'tabInd', 'segSync', 'lgStage', 'hollow', 'sanitiseWallpaper',
    'syncRemote', 'buildSearchIndex', 'searchWords', 'ansCompare', 'Next Wallpaper', 'Refresh from GitHub', 'resetToV33:function',
    'resetToV34:function', 'resetToV35:function', 'resetToV36:function', 'resetToV37:function', 'resetToV38:function', 'resetToV39:function',
    'resetToV40:function', 'sdp.v37_human_british', 'sdp.v35_rainbow_liquid_glass', 'sdp.v34_highlighted_ui', GH_KEY, 'sdp.gh_assets_v39',
    '_loadedSrc', 'adaptPerformance:function', 'gal-preview-btn', 'bindStreamStatus:function', 'recoverVideo:function', 'liteFx:function',
    'markPlaying:function', 'credit-intro', 'hansanaRevealCycle', 'sdpDynamicFonts', 'Noto Sans Sinhala', 'btnPlayerClose',
    'touch-action:manipulation', 'scale(.965) translateZ(0)', 'preloadSessionWords', 'mountVoiceBadge', 'isBritishAudio', 'mp3For',
    'spell', 'splitLong', 'speakText', 'getSingleVoiceUrl', 'cleanWordOnly', 'replayMaster', 'audioCache', 'liveBrowser', 'hushSynth',
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
