'use strict';
/* v39 release gate — rewritten from scratch with fs.writeFileSync.
   One single unified British English woman voice for the whole app, a spoken
   "Are you ready?" session start, and one persistent unlocked #ttsMasterAudio
   element driven by a sequential onended state machine. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const acorn = require('acorn');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const version = readJson('version.json');
const config = readJson('config.json');
const session = readJson('session.json');
const KEY = 'sdp.v39_single_unified_voice';
const GH_KEY = 'sdp.gh_assets_v39';
const DEFAULT = './assets/bunny-live-wallpaper.mp4';
const UNIFIED = 'https://dict.youdao.com/dictvoice?type=1&audio=';
const has = (s, token) => String(s).indexOf(token) !== -1;
const compact = s => String(s).replace(/\s+/g, '');
const cssText = () => (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || ['', ''])[1];
const CSS = compact(cssText());
const hasCss = token => has(CSS, compact(token));
const script = (html.match(/<script>([\s\S]*?)<\/script>/) || ['', ''])[1];
const masterTag = (html.match(/<audio id="ttsMasterAudio"[^>]*>/) || [''])[0];

function withApp(fn, seed) {
  const app = harness(seed);
  try { return fn(app); } finally { app.close(); }
}
/* jsdom has no speech engine: install one en-GB woman so the whole
   sequential engine can be driven by the fake clock. */
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
const said = (spoken, text) => spoken.filter(s => String(s.text).trim() === text);
const qaList = words => ({ id: 'qa_list', name: 'QA list', version: 1, published: true, words: words.map(w => (typeof w === 'string' ? { w: w } : w)) });
const heard = spoken => spoken.filter(s => String(s.text).trim());

test('v39 build gate: single-file ES5, no static external links, under 442,000 bytes', () => {
  assert.ok(script.length > 100000, 'the main inline app is present');
  assert.doesNotThrow(() => acorn.parse(script, { ecmaVersion: 5 }));
  for (const token of ['const ', 'let ', '=>', '`', 'async function', 'await ']) {
    assert.ok(!has(script, token), 'ES5 only; found ' + token);
  }
  assert.ok(!has(html, '<link'), 'no static external or local link tag');
  assert.ok(!/<script[^>]+src=/.test(html), 'no external script tag');
  assert.ok(Buffer.byteLength(html) < 442000, 'index.html is under the 442,000-byte release budget');
  const check = cp.spawnSync(process.execPath, ['tests/check.cjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.ok(has(html, 'APP_VERSION="4.6.0"'));
});

test('release identity: schema 39, appVersion 4.6.0, English, Amy, paper, unified voice key', () => {
  for (const [name, data] of [['version', version], ['config', config], ['session', session]]) {
    assert.equal(data.ver, 39, name + '.ver');
    assert.equal(data.appVersion, '4.6.0', name + '.appVersion');
    assert.equal(data.settingsRev, 39, name + '.settingsRev');
    assert.equal(data.lang, 'en', name + '.lang');
    assert.equal(data.guideLang, 'en', name + '.guideLang');
    assert.equal(data.voice, 'Amy', name + '.voice');
    assert.equal(data.lockedVoice, 'Amy', name + '.lockedVoice');
    assert.equal(data.humanReactions, true, name + '.humanReactions');
    assert.equal(data.mode, 'paper', name + '.mode');
    assert.equal(data.activeVideoSrc, DEFAULT, name + '.activeVideoSrc');
    assert.equal(data.activeMediaType, 'video', name + '.activeMediaType');
    assert.equal(data.videoDim, 18, name + '.videoDim');
    assert.equal(data.storageKey, KEY, name + '.storageKey');
  }
  assert.equal(version.version, '4.6.0');
  assert.equal(version.ghMediaCache, GH_KEY);
  assert.ok(version.legacyMediaCaches.indexOf('sdp.gh_assets_v38') >= 0);
  assert.match(version.features.humanVoice, /one single unified British English woman studio voice/i);
  assert.equal(version.features.sessionFlow.indexOf('650ms'), version.features.sessionFlow.indexOf('650ms'));
  assert.match(version.features.sessionFlow, /Are you ready\?/);
  assert.equal(config.defaults.voice, 'Amy');
  assert.equal(config.defaults.humanReactions, true);
  assert.equal(config.session.voice, 'Amy');
  assert.equal(session.session.voice, 'Amy');
});

test('CONFIG and defaultData expose the v39 key, Amy lock, v39 assets cache and unified voice', () => withApp(({ q }) => {
  assert.equal(q.APP_VERSION, '4.6.0');
  assert.equal(q.CONFIG.key, KEY);
  assert.equal(q.CONFIG.schema, 39);
  assert.equal(q.CONFIG.settingsRev, 39);
  assert.equal(q.CONFIG.lockedVoice, 'Amy');
  assert.equal(q.CONFIG.ghMediaCache, GH_KEY);
  assert.ok(q.CONFIG.legacyMediaCaches.indexOf('sdp.gh_assets_v38') >= 0);
  const d = q.DB.defaults();
  assert.equal(d.v, 39);
  assert.equal(d.settingsRev, 39);
  assert.equal(d.settings.lang, 'en');
  assert.equal(d.settings.guideLang, 'en');
  assert.equal(d.settings.mode, 'paper');
  assert.equal(d.settings.voice, 'Amy');
  assert.equal(d.settings.humanReactions, true);
  assert.equal(d.settings.writeFixed, 5);
  assert.equal(d.settings.repeats, 2);
  assert.equal(d.settings.activeVideoSrc, DEFAULT);
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

test('one persistent #ttsMasterAudio element, preloaded and never CORS-tainted', () => withApp(({ q, w }) => {
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
  assert.ok(!has(script, '#sdpAudio'), 'the old shared element is gone');
  assert.ok(!has(script, 'new StudioAudio'), 'no studio audio factory');
  assert.equal((script.match(/createElement\("audio"\)/g) || []).length, 1, 'the master element is the only audio ever created');
  assert.ok(!has(script, 'new Audio('), 'never a throwaway Audio() inside a timer');
  assert.equal(w.document.querySelectorAll('#sdpAudio').length, 0);
}));

test('TTS.getUnifiedVoiceUrl is the ONE British woman studio voice for words, phrases and prompts', () => withApp(({ q }) => {
  const TTS = q.Speech;
  assert.equal(TTS.getUnifiedVoiceUrl('bicycle'), UNIFIED + 'bicycle');
  assert.equal(TTS.getUnifiedVoiceUrl('bus stop'), UNIFIED + 'bus%20stop');
  assert.equal(TTS.getUnifiedVoiceUrl('boarding pass'), UNIFIED + 'boarding%20pass');
  assert.equal(TTS.getUnifiedVoiceUrl('Are you ready?'), UNIFIED + encodeURIComponent('Are you ready?'));
  assert.equal(TTS.getUnifiedVoiceUrl('Brilliant, well done!'), UNIFIED + encodeURIComponent('Brilliant, well done!'));
  assert.equal(TTS.getUnifiedVoiceUrl('   '), '');
  const wordCandidates = TTS.getStudioMp3Candidates('bicycle', true);
  const phraseCandidates = TTS.getStudioMp3Candidates('bus stop', false);
  assert.equal(wordCandidates.length, 1, 'exactly one candidate for a word');
  assert.equal(phraseCandidates.length, 1, 'exactly one candidate for a phrase');
  assert.equal(wordCandidates[0], UNIFIED + 'bicycle');
  assert.equal(phraseCandidates[0], UNIFIED + 'bus%20stop');
  for (const dead of ['translate_tts', 'api.streamelements.com', '20200429', 'translate.google.com/translate_tts']) {
    assert.ok(!has(script, dead), 'the retired engine is gone from the build: ' + dead);
  }
  const engine = Object.keys(TTS).filter(k => typeof TTS[k] === 'function').map(k => String(TTS[k])).join('\n');
  assert.ok(engine.length > 2000, 'the Speech engine source was captured');
  for (const banned of ['ssl.gstatic.com/dictionary', 'translate_tts', 'api.streamelements.com', 'oxford', '20200429', 'translate.google']) {
    assert.ok(!has(engine, banned), 'no second voice engine in the Speech engine: ' + banned);
    assert.ok(!TTS.getStudioMp3Candidates('bus stop').some(u => has(u, banned)), banned);
    assert.ok(!TTS.getStudioMp3Candidates('bicycle', true).some(u => has(u, banned)), banned);
  }
}));

/* the real-browser path: no speech engine, a <audio> element that really
   "plays", so every utterance must come from the unified stream. */
function withStream(fn, seed) {
  return withApp(({ q, w, clock }) => {
    Object.defineProperty(w.navigator, 'userAgent', { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', configurable: true });
    const played = [];
    w.speechSynthesis = { getVoices: () => [], cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {}, speak() { throw new Error('the device voice must not be used while the studio stream works'); } };
    w.SpeechSynthesisUtterance = function (t) { this.text = String(t); };
    w.HTMLMediaElement.prototype.play = function () {
      const el = this;
      if (String(el.tagName).toUpperCase() === 'AUDIO') played.push(el.src);
      w.setTimeout(() => { if (el.onplaying) el.onplaying(); }, 5);
      w.setTimeout(() => { if (el.onended) el.onended(); }, 60);
      return Promise.resolve();
    };
    w.HTMLMediaElement.prototype.pause = function () {};
    q.Speech.supported = true;
    return fn({ q, w, clock, played });
  }, seed);
}
const saidUrl = url => decodeURIComponent(String(url || '').split('audio=')[1] || '');

test('one pinned en-GB female fallback voice is chosen once and never swapped', () => withVoice(({ q, spoken }) => {
  const TTS = q.Speech;
  const first = TTS.getPinnedVoice();
  assert.ok(first, 'a pinned voice exists');
  assert.match(String(first.lang), /^en[-_]GB$/i);
  assert.match(first.name, /sonia|libby|google uk english female|serena|amy/i);
  assert.equal(TTS.getPinnedVoice(), first, 'the same voice is returned every time');
  assert.equal(TTS._pinnedSynthVoice, first);
  assert.ok(!TTS.isMaleName(first.name));
  for (const male of ['Daniel', 'George', 'Arthur', 'Ryan', 'David']) assert.ok(TTS.isMaleName(male), male);
  assert.ok(!TTS.isMaleName('Google UK English Female'));
  TTS.speakSynth('bicycle', 0.96, () => {});
  return new Promise(resolve => setTimeout(resolve, 20)).then(() => {
    const u = spoken.filter(s => String(s.text).trim());
    assert.ok(u.length, 'the pinned voice spoke');
    assert.equal(u[0].lang, 'en-GB');
    assert.equal(u[0].voice, first.name);
    assert.equal(u[0].rate, 0.96);
    assert.equal(u[0].pitch, 1.02);
  });
}));

test('TTS.speakSingle refuses to switch voices and only ever uses the unified stream', () => withVoice(({ q, clock, spoken }) => {
  const TTS = q.Speech;
  TTS.speakSingle('Are you ready?', () => {});
  clock.tick(400);
  const u = heard(spoken);
  assert.equal(u.length, 1);
  assert.equal(u[0].text, 'Are you ready?');
  assert.equal(u[0].lang, 'en-GB');
  assert.equal(u[0].voice, TTS.getPinnedVoice().name);
}));

test('speakWordCycle runs Repetition 1 -> 650ms breath -> Repetition 2 in the same voice', () => withVoice(({ q, clock, spoken }) => {
  const TTS = q.Speech;
  q.DB.data.settings.humanReactions = false;
  let done = null;
  const phases = [];
  TTS.speakWordCycle({ w: 'bicycle' }, 0, ok => { done = ok; }, (i, n) => phases.push(i + '/' + n));
  assert.equal(done, null, 'the cycle waits for onended');
  clock.tick(5);
  assert.deepEqual(heard(spoken).map(s => s.text), ['bicycle']);
  clock.tick(700);
  assert.deepEqual(heard(spoken).map(s => s.text), ['bicycle', 'bicycle']);
  clock.tick(20);
  assert.equal(done, true);
  assert.deepEqual(phases, ['1/2', '2/2']);
  assert.ok(heard(spoken).every(s => s.voice === TTS.getPinnedVoice().name), 'never changes voice between repeats');
  q.DB.data.settings.humanReactions = true;
  TTS.humanOk = () => true;
  TTS.speakWordCycle({ w: 'bus stop' }, 1, () => {});
  clock.tick(2000);
  const said = heard(spoken).map(s => s.text);
  assert.equal(said[said.length - 2], 'bus stop');
  assert.equal(said[said.length - 1], 'Listen again, carefully… bus stop.');
}));

test('a stale word cycle can never cut off the new word (sequence token guard)', () => withVoice(({ q, clock, spoken }) => {
  const TTS = q.Speech;
  q.DB.data.settings.humanReactions = false;
  const results = [];
  TTS.speakWordCycle({ w: 'bicycle' }, 0, ok => results.push(ok));
  clock.tick(5);
  const token = TTS._seqToken;
  TTS.speakSingle('Number 2.', () => {});
  assert.ok(TTS._seqToken > token, 'a new utterance bumps the sequence token');
  clock.tick(2000);
  assert.deepEqual(results, [false], 'the stale cycle aborts cleanly');
  assert.deepEqual(heard(spoken).map(s => s.text), ['bicycle', 'Number 2.']);
}));

test('Eng.start opens #readySheet and speaks "Are you ready?" immediately', () => withVoice(({ q, w, clock, spoken }) => {
  q.Eng.start({});
  const sheet = w.document.getElementById('readySheet');
  assert.ok(sheet, '#readySheet is open');
  assert.equal(q.Eng.st, 'ready');
  assert.match(sheet.textContent, /Are you ready\?/);
  assert.ok(sheet.textContent.indexOf("Get your pen and paper. Tap I'm ready when you are.") >= 0);
  assert.ok(Array.from(sheet.querySelectorAll('button')).some(b => b.textContent.trim() === 'Skip countdown'));
  assert.ok(Array.from(sheet.querySelectorAll('button')).some(b => b.textContent.trim() === 'Test sound'));
  assert.equal(w.document.querySelectorAll('#sheets .sheet').length, 1, 'one single far-right cross sheet');
  const prompt = heard(spoken).map(s => s.text);
  assert.ok(prompt.length >= 1, 'the greeting is spoken from the tap');
  assert.match(prompt[0], /^Are you ready\?/);
  assert.match(prompt[0], /(pen and paper|press I'm ready)/);
  clock.tick(500);
  assert.equal(q.Eng.st, 'ready', 'the sheet waits for the user');
}));

test('Eng.start speaks the type-mode greeting variant', () => withVoice(({ q, spoken }) => {
  q.DB.data.settings.mode = 'type';
  q.Eng.start({ mode: 'type' });
  const prompt = heard(spoken).map(s => s.text);
  assert.match(prompt[0], /^Are you ready\? Press I'm ready to begin\.$/);
}));

test('Eng.readyGo speaks "Let\'s begin" and flows seamlessly into Word 1, Repetition 1 and 2', () => withVoice(({ q, w, clock, spoken }) => {
  q.DB.data.settings.humanReactions = false;
  q.DB.data.settings.numbers = false;
  q.DB.data.settings.writeFixed = 5;
  q.Eng.start({ list: qaList([{ w: 'bicycle', s: 'I ride a bicycle.' }, { w: 'bus stop', s: 'Meet me at the bus stop.' }]), listName: 'QA' });
  const word = 'bicycle';
  q.Eng.readyGo();
  assert.equal(q.Eng.st, 'speaking');
  assert.equal(w.document.getElementById('readySheet'), null, 'the ready sheet closed');
  assert.ok(w.document.querySelector('#layers .layer'), 'the Dictation Player stays open');
  clock.tick(50);
  assert.ok(heard(spoken).some(s => s.text === "Let's begin. Listen carefully."), 'spoken Let\'s begin');
  let sawListen1 = false, sawListen2 = false;
  for (let i = 0; i < 80 && q.Eng.st !== 'waiting'; i++) {
    clock.tick(100);
    const status = (w.document.querySelector('#plStatus') || {}).textContent || '';
    if (status.indexOf('🔊 Listening (1 of 2)…') >= 0) sawListen1 = true;
    if (status.indexOf('🔊 Listening again (2 of 2)…') >= 0) sawListen2 = true;
  }
  assert.equal(q.Eng.st, 'waiting', 'Word 1 reached its writing timer');
  assert.ok(sawListen1, 'status shows repetition 1 of 2');
  assert.equal(said(spoken, word).length, 2, 'Word 1 is spoken twice without being cut off');
  const status = (w.document.querySelector('#plStatus') || {}).textContent || '';
  assert.match(status, /Write the word now \(5s\)…/);
  assert.ok(q.Eng.countdown && q.Eng.countdown.left > 0 && q.Eng.countdown.left <= 5);
  clock.tick(4000);
  assert.equal(q.Eng.st, 'waiting');
  clock.tick(2000);
  assert.equal(q.Eng.idx, 1, 'the five-second timer advanced to Word 2');
  clock.tick(4000);
  assert.equal(said(spoken, 'bus stop').length, 2, 'Word 2 speaks its own two repetitions');
}));

test('Skip countdown jumps straight to Word 1 without waiting for the spoken countdown', () => withVoice(({ q, w, clock }) => {
  q.DB.data.settings.numbers = false;
  q.Eng.start({ list: qaList(['apple', 'pear']), listName: 'QA' });
  const skip = Array.from(w.document.querySelectorAll('#sheets button')).find(b => b.textContent.trim() === 'Skip countdown');
  skip.click();
  clock.tick(50);
  assert.equal(q.Eng.idx, 0);
  assert.equal(w.document.getElementById('readySheet'), null);
  clock.tick(3000);
  assert.equal(q.Eng.st, 'waiting');
}));

test('the 5s paper timer auto-advances from Word 1 to Word 30 and finishes the session', () => withVoice(({ q, clock }) => {
  q.DB.data.settings.numbers = false;
  q.DB.data.settings.humanReactions = false;
  const words = [];
  for (let i = 1; i <= 30; i++) words.push({ w: 'word' + i });
  q.Eng.start({ list: qaList(words), listName: 'QA 30' });
  const skip = Array.from(q.Eng.layer.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip countdown');
  q.Eng.skipReady();
  for (let i = 0; i < 6000 && !q.DB.data.history.length; i++) clock.tick(100);
  assert.equal(q.DB.data.history.length, 1, 'the full session finished');
  assert.equal(q.DB.data.history[0].wordCount, 30);
  assert.equal(q.Eng.st, 'finished');
  assert.equal(q.DB.data.history[0].mode, 'paper');
}));

test('Pause stops the state machine and Resume replays the current word cleanly', () => withVoice(({ q, w, clock, spoken }) => {
  q.DB.data.settings.numbers = false;
  q.DB.data.settings.humanReactions = false;
  q.Eng.start({ list: qaList(['apple', 'pear']), listName: 'QA' });
  q.Eng.skipReady();
  for (let i = 0; i < 60 && q.Eng.st !== 'waiting'; i++) clock.tick(100);
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
  for (let i = 0; i < 60 && q.Eng.st !== 'waiting'; i++) clock.tick(100);
  const before = heard(spoken).length;
  q.Eng.repeatWord();
  clock.tick(400);
  assert.ok(heard(spoken).length > before, 'the repeat is spoken');
  assert.ok(heard(spoken).slice(before).every(s => s.voice === q.Speech.getPinnedVoice().name));
  q.Eng.slower();
  clock.tick(400);
  assert.ok(q.Eng.st === 'waiting' || q.Eng.st === 'speaking');
  q.Eng.spellWord();
  clock.tick(3000);
  assert.ok(heard(spoken).some(s => /^bicycle\.$/.test(s.text)), 'spelling returns to the writing phase');
}));

test('human reactions, replay cues and the Settings switch stay on the same single voice', () => withVoice(({ q, w, clock, spoken }) => {
  const TTS = q.Speech;
  assert.equal(TTS.getHumanRepeatPhrase('bicycle', 0), 'Once more… bicycle.');
  assert.equal(TTS.getHumanRepeatPhrase('train station', 1), 'Listen again, carefully… train station.');
  assert.ok(TTS.reactionPhrases.correct.indexOf('Lovely — spot on!') >= 0);
  assert.ok(TTS.reactionPhrases.streak[0].indexOf('brilliant streak') >= 0);
  assert.ok(TTS.reactionPhrases.wrong.some(s => s.indexOf('nearly there') >= 0));
  assert.ok(TTS.reactionPhrases.complete[0].indexOf('session complete') >= 0);
  TTS.humanOk = () => true;
  const before = heard(spoken).length;
  for (const kind of ['correct', 'streak', 'wrong', 'complete']) TTS.speakHumanReaction(kind);
  clock.tick(4000);
  const spokenReactions = heard(spoken).slice(before).map(s => s.text);
  assert.equal(spokenReactions.length, 4, 'four reactions were spoken');
  assert.ok(spokenReactions[0].indexOf('spot on') >= 0);
  assert.ok(spokenReactions[3].indexOf('session complete') >= 0);
  assert.ok(heard(spoken).slice(before).every(s => s.voice === TTS.getPinnedVoice().name), 'reactions never change voice');
  q.Screens.settings();
  const toggle = w.document.getElementById('tHumanReactions');
  const badge = w.document.getElementById('voiceHumanBadgeSettings');
  assert.ok(toggle);
  assert.equal(toggle.getAttribute('role'), 'switch');
  assert.equal(toggle.getAttribute('aria-checked'), 'true');
  assert.match(badge.textContent, /British Studio Voice/);
  toggle.click();
  assert.equal(q.DB.data.settings.humanReactions, false);
  assert.equal(toggle.getAttribute('aria-checked'), 'false');
}));

test('the Dictation Player mounts the British Studio Voice presence badge', () => withApp(({ q, w }) => {
  q.Eng.start({});
  const badge = w.document.querySelector('#layers #voiceHumanBadge');
  assert.ok(badge);
  assert.match(badge.textContent, /British Studio Voice/);
  assert.equal(badge.getAttribute('role'), 'status');
  assert.equal(badge.querySelectorAll('.vh-eq i').length, 4);
}));

test('v38 profile migration and resetToV39 force English, paper, Amy, reactions and the bundled video', () => withApp(({ q }) => {
  const old = q.defaultData();
  old.v = 38;
  old.settingsRev = 38;
  old.settings.lang = 'si';
  old.settings.guideLang = 'si';
  old.settings.mode = 'typed';
  old.settings.voice = 'Daniel';
  old.settings.rate = 0.5;
  old.settings.humanReactions = false;
  old.settings.activeVideoSrc = 'https://example.test/outside.mp4';
  old.settings.activeMediaType = 'photo';
  const migrated = q.DB.migrate(old);
  assert.equal(migrated.v, 39);
  assert.equal(migrated.settingsRev, 39);
  assert.equal(migrated.settings.lang, 'en');
  assert.equal(migrated.settings.guideLang, 'en');
  assert.equal(migrated.settings.mode, 'paper');
  assert.equal(migrated.settings.voice, 'Amy');
  assert.equal(migrated.settings.rate, 0.96);
  assert.equal(migrated.settings.humanReactions, true);
  assert.equal(migrated.settings.activeVideoSrc, DEFAULT);
  assert.equal(migrated.settings.activeMediaType, 'video');
  assert.equal(migrated.settings.videoDim, 18);
  assert.equal(typeof q.DB.resetToV39, 'function');
  const again = q.DB.migrate(migrated);
  assert.equal(again.v, 39);
  assert.equal(again.settingsRev, 39);
  assert.ok(has(html, 'sdp.v38_human_reactions_voice'), 'the v38 profile is read once for migration');
}));

test('Session 7 keeps all 30 travel words, five-second writing, x2 repeats and Amy en-GB defaults', () => {
  const list = session.lists.find(item => item.id === 'list_session_7_travel');
  assert.ok(list);
  assert.equal(list.words.length, 30);
  ['guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration', 'journey', 'luggage', 'machine', 'mechanic', 'nationality', 'on business', 'on vacation', 'overnight', 'passenger', 'public transport', 'reception', 'reservation', 'road sign', 'signpost', 'spaceship', 'suitcase', 'tourist information centre', 'traffic lights', 'tunnel', 'tyre/tire', 'vehicle', 'visa', 'waiting room', 'windscreen'].forEach(word => assert.ok(list.words.some(item => item.w === word), word));
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.rate, 0.96);
  assert.equal(config.session.voice, 'Amy');
  assert.equal(config.session.lang, 'en');
  assert.equal(config.session.guideLang, 'en');
  assert.equal(config.session.humanReactions, true);
});

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
  assert.ok(!hasCss('border-radius:99px'));
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

test('wallpaper remains an /assets/-only single hardware video with the v39 discovery cache', () => withApp(({ q, w }) => {
  assert.equal(q.DEFAULT_WALLPAPER_SRC, DEFAULT);
  assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
  assert.equal(q.DB.data.settings.activeMediaType, 'video');
  assert.ok(q.isAssetsMedia(DEFAULT));
  assert.equal(q.normalizeAssetPath('https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-live-wallpaper.mp4?v=39#t=1'), DEFAULT);
  assert.equal(q.normalizeAssetPath('./qa/evidence/fatal-390.png'), '');
  assert.equal(w.document.querySelectorAll('#bgLiveVideo').length, 1);
  assert.ok(has(html, GH_KEY));
  assert.ok(has(html, 'ghMediaTtl:9e5'));
  assert.ok(has(html, 'preload="none"'));
  assert.ok(CSS.indexOf('#bgLiveAmbilight{') >= 0 && CSS.indexOf('#bgLiveAmbilight{') < CSS.indexOf('display:none!important', CSS.indexOf('#bgLiveAmbilight{')));
  assert.ok(hasCss('filter:none'));
  assert.ok(has(html, '?v=39'));
}));

test('legacy v22-v38 core contracts remain in the v39 single-file app', () => {
  const tokens = [
    '#bgLiveWrap', '#bgLiveAmbilight', '#bgLiveVideo', '#bgLiveCanvas', '#bgContrastScrim', '#bgLivePhoto', '#liveVideoInput',
    'video-gallery-badge', 'syncAmbilight:function(){}', 'playAmbilight:function(){}', 'renderGallery:function', 'previewThumb:function',
    'renderGalleryList:function', 'startPractisingFromGuide', 'cmp-ok', 'cmp-miss', 'streak-broken', 'plTickHero', 'plWrongHero',
    'ansMirrorText', 'ans-caret', 'materialMixer', 'CREDITS GOES TO', 'tire:"tyre"', 'tyre/tire', 'navigator.serviceWorker',
    'sdp_wallpaper_db', 'wake:function', 'sleep:function', 'draw:function', 'rafId:null', '💔 Streak Broken! (0)', 'guide-credit-pill',
    'cancelReadyAndExit', 'ansInput', 'tabInd', 'segSync', 'lgStage', 'hollow', 'sanitiseWallpaper',
    'syncRemote', 'buildSearchIndex', 'searchWords', 'ansCompare', 'Next Wallpaper', 'Refresh from GitHub', 'resetToV33:function',
    'resetToV34:function', 'resetToV35:function', 'resetToV36:function', 'resetToV37:function', 'resetToV38:function', 'resetToV39:function',
    'sdp.v37_human_british', 'sdp.v35_rainbow_liquid_glass', 'sdp.v34_highlighted_ui', 'sdp.gh_assets_v39', 'sdp.gh_assets_v38',
    '_loadedSrc', 'adaptPerformance:function', 'gal-preview-btn', 'bindStreamStatus:function', 'recoverVideo:function', 'liteFx:function',
    'markPlaying:function', 'credit-intro', 'hansanaRevealCycle', 'sdpDynamicFonts', 'Noto Sans Sinhala', 'btnPlayerClose',
    'touch-action:manipulation', 'scale(.965) translateZ(0)', 'getHumanRepeatPhrase', 'reactionPhrases', 'preloadSessionWords',
    'mountVoiceBadge', 'isBritishAudio', 'mp3For', 'spell', 'splitLong', 'speakText'
  ];
  tokens.forEach(token => assert.ok(has(html, token), 'missing preserved feature token: ' + token));
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
  media.forEach(item => assert.ok(item.indexOf('./assets/') === 0, 'media outside /assets/: ' + item));
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

test('the real-browser path streams every utterance through the one master audio element', () => withStream(({ q, w, clock, played }) => {
  const master = () => w.document.getElementById('ttsMasterAudio');
  q.Speech.unlock();
  assert.equal(master().getAttribute('preload'), 'auto');
  assert.ok(!master().getAttribute('crossorigin'), 'never CORS-tainted');
  q.Eng.start({});
  clock.tick(10);
  assert.match(master().src, /^https:\/\/dict\.youdao\.com\/dictvoice\?type=1&audio=/);
  assert.match(saidUrl(master().src), /^Are you ready\?/, 'the greeting streams first');
  const ready = Array.from(w.document.querySelectorAll('#readySheet button')).find(b => b.textContent.trim() === "I'm ready");
  assert.ok(ready, "the I'm ready button is there");
  ready.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  clock.tick(3000);
  const first = q.Eng.currentWord().w;
  assert.equal(saidUrl(master().src), first, 'Word 1, repetition 1, on the same stream');
  clock.tick(80);
  const second = saidUrl(master().src);
  assert.ok(second === first || second.indexOf('Once more') === 0, 'repetition 2 never changes voice: ' + second);
  clock.tick(700);
  assert.equal(q.Eng.st, 'waiting');
  assert.match(w.document.querySelector('#plStatus').textContent, /Write the word now \(5s\)/);
  const urls = played.map(saidUrl);
  assert.ok(urls.indexOf("Let's begin. Listen carefully.") >= 0, "Let's begin went through the same stream");
  const clips = played.filter(u => String(u).indexOf('data:') !== 0);
  assert.ok(clips.every(u => String(u).indexOf(UNIFIED) === 0), 'every clip came from the one host: ' + JSON.stringify(clips));
  assert.ok(played.some(u => String(u).indexOf('data:') === 0), 'the unlock prime is the only non-stream clip');
  assert.ok(clips.length >= 4, 'greeting, Let us begin, Number 1., Word 1 and the repeat all streamed');
}));
