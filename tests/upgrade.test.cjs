'use strict';
/* v49 (APP_VERSION 5.5.0) release gate.
   The v48 build lost every sound on real browsers: translate.googleapis.com
   answered 403, cross-origin fetch()/Blob replay produced 0-byte opaque blobs,
   and the device-speech safety net was disabled. v49 streams the single Youdao
   en-GB studio MP3 straight into #ttsMasterAudio (no fetch, no Blob, no Cache
   API) and keeps a locked British female speechSynthesis voice as the safety
   net for errors and for the 1600 ms start timeout.
   This gate proves the working sound system and every v22-v48 UI contract
   without touching the network. */
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const KEY = 'sdp.v49_working_sound_system';
const APP = '5.5.0';
const YOUDAO = 'https://dict.youdao.com/dictvoice?type=1&audio=';
const CACHE = 'sdp-voice-v49';
const WORDS = ['afraid', 'amazed', 'amusing', 'annoyed', 'anxious', 'ashamed', 'awesome', 'boring', 'brilliant',
  'challenging', 'charming', 'confident', 'confusing', 'cruel', 'curious', 'delighted', 'depressed', 'disappointed',
  'embarrassing', 'enjoyable', 'excellent', 'excited', 'fantastic', 'favourite', 'frightened', 'friendly', 'generous',
  'guilty', 'healthy', 'hungry'];
const GUIDE_EN = "Welcome to the Smart Dictation Player User Guide. First, choose Listen and write on paper, or Type in app. Second, click Start dictation, then click I'm ready. Every word is read twice with five seconds to write. You can use Repeat, Slower, Repeat sentence, or Spell it at any time. Click Start practising below to begin.";
const GUIDE_SI = 'ස්මාර්ට් ඩික්ටේෂන් ප්ලේයර් උපදෙස් මාලාවකට සාදරයෙන් පිළිගනිමු';

/* The one and only voice URL for a piece of English text. */
const voice = (text) => YOUDAO + encodeURIComponent(String(text) + ' .');
/* What the audio element was asked to say, read back out of the URL. */
function said(url) {
  const value = String(url || '');
  const hit = /[?&]audio=([^&]*)/.exec(value);
  if (!hit) return '';
  let text = hit[1].replace(/\+/g, ' ');
  try { text = decodeURIComponent(text); } catch (e) { text = String(text); }
  return text.replace(/\s*\.\s*$/, '');
}

function mediaSpy(w) {
  w.__plays = [];
  w.__synth = [];
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.play = function () {
    const el = this;
    if (el.id === 'ttsMasterAudio') {
      w.__plays.push(String(el.getAttribute('src') || ''));
      w.setTimeout(function () { if (el.onplaying) el.onplaying(); }, 1);
      w.setTimeout(function () { if (el.onended) el.onended(); }, 5);
    }
    return Promise.resolve();
  };
  w.SpeechSynthesisUtterance = function (text) {
    this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null;
  };
  w.speechSynthesis = {
    getVoices() {
      return [
        { name: 'Google US English', lang: 'en-US' },
        { name: 'Daniel', lang: 'en-GB' },
        { name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', lang: 'en-GB' }
      ];
    },
    cancel() {},
    speak(utterance) {
      w.__synth.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate, pitch: utterance.pitch, voice: utterance.voice && utterance.voice.name });
      w.setTimeout(function () { if (utterance.onend) utterance.onend(); }, 5);
    },
    addEventListener() {}
  };
}
function withApp(fn) {
  const app = harness(undefined, { before: mediaSpy });
  try { return fn(app); } finally { app.close(); }
}
function plays(a) { return a.w.__plays.slice(); }
function urls(a) { return plays(a).filter((u) => /^https?:/.test(u)); }
function synth(a) { return a.w.__synth.slice(); }
function tickUntil(a, predicate, limit) {
  let i = 0;
  const max = limit || 4000;
  while (!predicate() && i < max) { a.clock.tick(50); i += 1; }
  return predicate();
}
function dataDom(file, url) {
  const dom = new JSDOM(read(file), { url: url || 'https://dictationb1.github.io/data.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.print = function () { w.__printed = (w.__printed || 0) + 1; };
  w.open = function (u) { w.__opened = u; return null; };
  const script = Array.from(w.document.scripts).find((node) => !node.type).textContent;
  w.eval(script);
  return dom;
}

/* ---------------------------------------------------------------- sound system */

test('v49 no blocked Google endpoint survives in index.html, data.html or data/index.html', () => {
  for (const file of ['index.html', 'data.html', 'data/index.html']) {
    const text = read(file);
    assert.equal((text.match(/translate\.googleapis\.com/g) || []).length, 0, file + ' still points at the 403 endpoint');
    assert.equal((text.match(/translate_tts/g) || []).length, 0, file + ' still builds a translate_tts URL');
  }
  assert.equal(read('data.html'), read('data/index.html'), '/data and /data.html stay identical');
});

test('v49 no fetch, Blob URL or Cache API interception is used for audio', () => {
  for (const file of ['index.html', 'data.html']) {
    const text = read(file);
    const engine = text.slice(text.indexOf('dict.youdao.com/dictvoice'));
    assert.ok(engine.length > 100, file + ' carries the working sound engine');
    assert.equal((engine.match(/createObjectURL/g) || []).length, 0, file + ' must never build a blob: audio URL');
    assert.equal((engine.match(/caches\.open/g) || []).length, 0, file + ' must never open a Cache API bucket for audio');
    assert.equal((engine.match(/mode:"no-cors"|mode: "no-cors"/g) || []).length, 0, file + ' must never fetch opaque audio');
    assert.equal((engine.match(/fetch\(/g) || []).length, 0, file + ' sound engine never calls fetch()');
  }
});

test('v49 the master audio element streams the Youdao URL directly', () => {
  withApp((a) => {
    const T = a.q.Speech;
    const element = a.w.document.querySelector('#ttsMasterAudio');
    assert.ok(element, 'the single master element exists');
    assert.equal(a.w.document.querySelectorAll('audio#ttsMasterAudio').length, 1);
    assert.equal(element.getAttribute('preload'), 'auto');
    assert.equal(element.hasAttribute('playsinline'), true);
    assert.equal(element.getAttribute('referrerpolicy'), 'no-referrer');
    assert.equal(element.hasAttribute('crossorigin'), false, 'no crossOrigin attribute');
    assert.equal(element.hasAttribute('crossOrigin'), false, 'no crossOrigin attribute');
    assert.equal(T.getSingleVoiceUrl('afraid'), voice('afraid'));
    assert.equal(T.getSingleVoiceUrl('afraid'), VOICE_SAMPLE);
    assert.equal(T.getUnifiedVoiceUrl('Repeat this sentence'), voice('Repeat this sentence'));
    assert.equal(T.getSingleVoiceUrl('Number 1', 'en'), voice('Number 1'));
    assert.equal(T.getSingleVoiceUrl('ආයුබෝවන්', 'si'), '', 'Sinhala never builds a blocked URL: it routes to the pinned synth');
    assert.deepEqual(Array.from(T.getRealStudioUrls('afraid')), [voice('afraid')]);
    assert.equal(T.CACHE_NAME, CACHE);
    assert.equal(typeof T._lastLoadedUrl, 'string');
  });
});
const VOICE_SAMPLE = YOUDAO + encodeURIComponent('afraid .');

test('v49 playback assigns the https URL to src, unmutes and keeps full volume', () => {
  withApp((a) => {
    const T = a.q.Speech;
    const element = a.w.document.querySelector('#ttsMasterAudio');
    element.muted = true;
    element.volume = 0.2;
    T.playWord('afraid');
    a.clock.tick(60);
    assert.equal(element.getAttribute('src'), voice('afraid'), 'the direct https URL is the element source');
    assert.equal(/^blob:/.test(String(element.getAttribute('src'))), false, 'never a blob: URL');
    assert.equal(element.muted, false, 'the element is never muted');
    assert.equal(element.volume, 1, 'volume is forced back to 1');
    assert.equal(element.hasAttribute('crossorigin'), false);
    assert.equal(T._lastLoadedUrl, voice('afraid'));
  });
});

test('v49 a failed stream falls back to the locked British female speechSynthesis voice', async () => {
  const a = harness(undefined, { before: mediaSpy });
  try {
    const T = a.q.Speech;
    T.isHeadless = function () { return false; };
    a.w.HTMLMediaElement.prototype.play = function () { return Promise.reject(new Error('blocked by ISP')); };
    let done = null;
    T.playWord('afraid', 1, function (ok) { done = ok; });
    a.clock.tick(200);
    await new Promise((r) => setTimeout(r, 20));
    a.clock.tick(200);
    const spoken = synth(a);
    assert.equal(spoken.length, 1, 'the pinned device voice speaks instead of silence');
    assert.equal(spoken[0].text, 'afraid');
    assert.equal(spoken[0].lang, 'en-GB');
    assert.equal(spoken[0].rate, 0.96);
    assert.equal(spoken[0].pitch, 1.02);
    assert.match(String(spoken[0].voice), /Sonia/, 'the best en-GB female voice is locked');
    assert.equal(done, true, 'the reading still reports success');
  } finally { a.close(); }
});

test('v49 a stream that never starts within 1600 ms hands over to the pinned voice', () => {
  withApp((a) => {
    const T = a.q.Speech;
    T.isHeadless = function () { return false; };
    a.w.HTMLMediaElement.prototype.play = function () { return new Promise(function () {}); };
    let done = null;
    T.speakSingle('Three', function (ok) { done = ok; });
    a.clock.tick(1200);
    assert.equal(synth(a).length, 0, 'the studio stream still gets its 1600 ms window');
    a.clock.tick(600);
    assert.equal(synth(a).length, 1, 'after 1600 ms the pinned voice takes over');
    assert.equal(synth(a)[0].text, 'Three');
    assert.equal(done, true);
  });
});

test('v49 an element error also hands over to the pinned voice', () => {
  withApp((a) => {
    const T = a.q.Speech;
    T.isHeadless = function () { return false; };
    a.w.HTMLMediaElement.prototype.play = function () {
      const el = this;
      a.w.setTimeout(function () { if (el.onerror) el.onerror(); }, 2);
      return Promise.resolve();
    };
    T.testSound();
    a.clock.tick(120);
    assert.ok(synth(a).some((s) => s.text === 'Sound check. Number 1, afraid.'), 'the sound check is spoken by the pinned voice');
    const pill = a.w.document.querySelector('#readySheet [data-voice-pill]');
    if (pill) assert.equal(pill.textContent, '✓ Dictation Voice Verified');
  });
});

test('v49 jsdom headless runs resolve quickly so the suites stay fast', () => {
  withApp((a) => {
    const T = a.q.Speech;
    assert.equal(T.isHeadless(), true);
    a.w.HTMLMediaElement.prototype.play = function () { if (this.onerror) this.onerror(); return Promise.reject(new Error('blocked')); };
    let done = -1;
    T.speakStudioText('Sound check', 'en', function () { done = a.w.Date.now(); });
    a.clock.tick(80);
    assert.ok(done >= 0, 'the headless fallback completed');
  });
});

test('v49 every stage - instruction, countdown, word and helpers - streams the same endpoint', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(60);
    assert.ok(urls(a).length >= 1, 'the opening instruction streamed');
    assert.ok(urls(a).every((u) => u.indexOf(YOUDAO) === 0), 'only the one Youdao stream plays: ' + urls(a).join(' | '));
    a.q.Eng.readyGo();
    a.clock.tick(30);
    a.q.Eng.speakSentence();
    a.clock.tick(30);
    a.q.Eng.spellIt();
    a.clock.tick(30);
    a.q.Eng.speakSlow();
    a.clock.tick(30);
    const list = urls(a);
    assert.ok(list.length >= 3, 'audio was requested');
    assert.ok(list.every((u) => u.indexOf(YOUDAO) === 0), 'every clip is the one studio stream: ' + list.join(' | '));
    assert.equal(synth(a).length, 0, 'the device voice stays idle while the studio stream works');
  });
});

test('v49 Test sound speaks the verified phrase and lights the status pill', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    const btn = a.w.document.querySelector('#btnReadyTest');
    assert.ok(btn, 'the ready sheet offers Test sound');
    btn.click();
    a.clock.tick(80);
    assert.ok(urls(a).some((u) => u === voice('Sound check. Number 1, afraid.')), 'the exact sound check line: ' + urls(a).join(' | '));
    const pill = a.w.document.querySelector('#readySheet [data-voice-pill]');
    assert.ok(pill, 'a status pill exists');
    assert.equal(pill.textContent, '✓ Dictation Voice Verified');
  });
});

test('v49 metadata: ver 49, appVersion 5.5.0, schema 49, admin PIN 78987898 and the Amy voice', () => {
  for (const file of ['data/version.json', 'data/config.json', 'data/session.json']) {
    const doc = json(file);
    assert.equal(doc.ver, 49, file + ' ver');
    assert.equal(doc.appVersion, APP, file + ' appVersion');
    assert.equal(doc.schema, 49, file + ' schema');
    if (doc.settingsRev !== undefined) assert.equal(doc.settingsRev, 49, file + ' settingsRev');
    if (doc.adminPin !== undefined) assert.equal(doc.adminPin, '78987898', file + ' admin PIN');
    if (doc.key !== undefined) assert.equal(doc.key, KEY, file + ' storage key');
    if (doc.voice !== undefined) assert.equal(doc.voice, 'Amy', file + ' voice');
    if (doc.lockedVoice !== undefined) assert.equal(doc.lockedVoice, 'Amy', file + ' locked voice');
  }
  assert.equal(json('data/config.json').tts.singleWordBase, YOUDAO);
  assert.equal(json('data/config.json').tts.fallbackBase, YOUDAO);
  assert.equal(json('data/config.json').humanAudio.singleWordBase, YOUDAO);
  assert.equal(json('data/config.json').tts.startTimeoutMs, 1600);
  withApp((a) => {
    assert.equal(a.q.CONFIG.lockedVoice, 'Amy');
    assert.equal(a.q.CONFIG.key, KEY);
    assert.equal(a.q.CONFIG.adminPin, '78987898');
    assert.equal(a.q.CONFIG.schema, 49);
    assert.equal(a.q.DB.data.settings.voice, 'Amy');
    assert.equal(a.q.DB.data.settings.adminPin, '78987898');
    assert.equal(a.q.DB.data.settings.mode, 'paper');
  });
  assert.ok(/maxlength="8"|maxLength=8/.test(html), 'the numeric admin PIN input allows eight digits');
});

test('v49 static gates: compact ES5 single-file app, no generated audio, under 425,000 bytes', () => {
  const bytes = Buffer.byteLength(html);
  assert.ok(bytes < 425000, 'index.html stays below 425,000 bytes: ' + bytes);
  assert.equal((html.match(/<link\b/gi) || []).length, 0, 'no static <link> tag');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  acorn.parse(script, { ecmaVersion: 5 });
  assert.equal(fs.existsSync(path.join(root, 'audio')), false, 'no synthetic ./audio pack');
  assert.equal(fs.existsSync(path.join(root, 'scripts', 'build-audio.cjs')), false, 'no build-audio generator');
  assert.match(html, /<html lang="en"/);
  assert.equal((html.match(/<audio id="ttsMasterAudio"/g) || []).length, 1);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.ok(!/<audio id="ttsMasterAudio"[^>]*crossorigin/i.test(html), 'the master element never carries crossOrigin');
  for (const file of ['data.html', 'data/index.html']) {
    const report = read(file);
    assert.ok(Buffer.byteLength(report) < 60000, file + ' stays compact');
    assert.equal((report.match(/<link\b/gi) || []).length, 0, file + ' has no static <link>');
    acorn.parse(report.match(/<script>([\s\S]*?)<\/script>/)[1], { ecmaVersion: 5 });
  }
});

/* ---------------------------------------------------------------- session + UI */

test('v49 Session 8 is active with the exact 30 adjectives and Session 7 stays archived', () => {
  const doc = json('data/session.json');
  const list = doc.lists[0];
  assert.equal(doc.session.no, '8');
  assert.equal(doc.session.date, '2026-10-29');
  assert.match(doc.session.title, /Session 8 - Personal Feelings, Opinions & Experiences \(Adj\)/);
  assert.match(doc.session.classInfo, /CCBE Galle Branch/);
  assert.match(doc.session.classInfo, /Ms\. Sumodya Sewmini/);
  const words = list.words.map((w) => w.w);
  assert.deepEqual(words, WORDS);
  for (const item of list.words) {
    assert.ok(item.p && item.p.length > 3 && !/[A-Z]/.test(item.p), 'UK IPA for ' + item.w);
    assert.ok(item.m && item.m.length > 6, 'English definition for ' + item.w);
    assert.ok(item.si && item.si.length > 1, 'Sinhala meaning for ' + item.w);
    assert.ok(item.s && item.s.split(' ').length > 3, 'example sentence for ' + item.w);
    assert.equal(item.audio, voice(item.w), 'single studio stream for ' + item.w);
  }
  const past = doc.pastSessions.find((s) => /Session 7 - Travel & Transport/.test(s.title));
  assert.ok(past, 'Session 7 is archived');
  if ((past.words || []).length) assert.equal(past.words.length, 30, 'Session 7 keeps all 30 words');
  else assert.equal(past.wordCount, 30, 'Session 7 keeps all 30 words');
  withApp((a) => {
    const archived = a.q.DB.data.pastSessions.find((x) => /Session 7 - Travel & Transport/.test(x.title));
    assert.ok(archived && archived.words.length === 30, 'the app still ships all 30 Session 7 words');
  });
});

test('v49 ready sheet speaks the I am ready instruction and hides the player layer', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    const sheet = a.w.document.querySelector('#readySheet');
    assert.ok(sheet, 'the ready sheet opened');
    assert.equal(a.w.document.body.classList.contains('sheet-open'), true);
    const spoken = urls(a).map(said);
    assert.ok(spoken.some((t) => t === "Welcome. Prepare your pen and paper. Each word is read twice. Click I'm ready to begin."), spoken.join(' | '));
    assert.ok(!/Yes, I'm ready/i.test(sheet.textContent), 'the sheet never says Yes, I am ready');
    assert.equal(a.w.document.querySelector('#readySheet .btn-skip, #btnSkipReady'), null);
    assert.ok(!/Skip countdown/.test(sheet.textContent));
    assert.match(html, /body\.sheet-open[^{]*\.layer\{[^}]*visibility:hidden/);
  });
});

test('v49 countdown is Three at 0ms, Two at 950ms and One at 1900ms in lockstep', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.w.__plays.length = 0;
    a.q.Eng.readyGo();
    a.clock.tick(1);
    assert.equal(said(urls(a)[0]), 'Three', 'Three starts immediately');
    a.clock.tick(700);
    assert.equal(urls(a).filter((u) => said(u) === 'Two').length, 0, 'Two waits for the 950ms beat');
    a.clock.tick(300);
    assert.equal(urls(a).filter((u) => said(u) === 'Two').length, 1, 'Two at about 950ms');
    a.clock.tick(900);
    assert.equal(urls(a).filter((u) => said(u) === 'One').length, 1, 'One at about 1900ms');
    assert.equal(a.q.Eng.phase, 'countdown');
    a.clock.tick(40);
    assert.notEqual(a.q.Eng.phase, 'countdown', 'word one starts only after One finishes');
    assert.ok(urls(a).some((u) => said(u) === 'Number 1, afraid'), urls(a).map(said).join(' | '));
  });
});

test('v49 word 1 is Number 1 plus the clean word, then 650ms, then the same word at 0 KB', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.w.__plays.length = 0;
    a.q.Eng.readyGo();
    tickUntil(a, () => urls(a).some((u) => said(u) === 'afraid'), 200);
    const element = a.w.document.querySelector('#ttsMasterAudio');
    const list = urls(a).map(said);
    const pass1 = list.indexOf('Number 1, afraid');
    const pass2 = list.indexOf('afraid');
    assert.ok(pass1 >= 0, 'Pass 1 announces number and word: ' + list.join(' | '));
    assert.ok(pass2 > pass1, 'Pass 2 says only the clean word');
    assert.ok(!/listen again|once more|one more time/i.test(list.slice(pass1, pass2 + 1).join(' ')));
    assert.equal(a.q.Speech._lastLoadedUrl, voice('afraid'), 'the loaded word URL is the replay source');
    assert.equal(element.getAttribute('src'), voice('afraid'), 'Pass 2 reuses the same element with no re-download');
    a.w.__plays.length = 0;
    element.playbackRate = 1;
    a.q.Speech.playWord('afraid', 1, function () {});
    a.clock.tick(10);
    assert.equal(a.w.__plays[0], voice('afraid'), 'the 0 KB replay never changes the source');
    assert.match(a.w.document.querySelector('#plProgText').textContent, /^Dictation #1 of 30$/);
  });
});

test('v49 the final word is announced as Final word, number 30 and the writing timer is five seconds', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.q.Eng.readyGo();
    a.clock.tick(2600);
    a.w.__plays.length = 0;
    a.q.Eng.words = a.q.DB.data.lists[0].words.slice();
    a.q.Eng.startWord(29);
    const list = urls(a).map(said);
    assert.ok(list.some((t) => t === 'Final word, number 30, hungry'), list.join(' | '));
    tickUntil(a, () => /Your turn|Write the word now/.test(a.w.document.querySelector('#plStatus').textContent), 300);
    assert.equal(a.q.Eng.writeSecs(), 5);
    assert.match(a.w.document.querySelector('#plStatus').textContent, /Write the word now \(5s\)|Your turn/);
  });
});

test('v49 Repeat replays the pair, Slower uses 0.72 with preserved pitch and Sentence masks the word', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.q.Eng.readyGo();
    a.clock.tick(2600);
    a.w.__plays.length = 0;
    a.q.Eng.replayWord();
    a.clock.tick(30);
    assert.ok(urls(a).map(said).some((t) => t === 'Number 1, afraid'), 'Repeat replays the pair');

    a.w.__plays.length = 0;
    a.q.Eng.speakSlow();
    assert.match(a.w.document.querySelector('#plSub').textContent, /Speaking slowly \(0\.72×\)/);
    a.clock.tick(30);
    const element = a.w.document.querySelector('#ttsMasterAudio');
    assert.equal(element.playbackRate, 1, 'the rate is restored after the clip');
    assert.equal(element.preservesPitch, true);

    a.q.Eng.speakSentence();
    assert.match(a.w.document.querySelector('#plSub').textContent, /_______/);
    a.clock.tick(30);
    assert.ok(urls(a).map(said).some((t) => t.indexOf('She was never afraid') === 0), urls(a).map(said).join(' | '));
  });
});

test('v49 Spell it shows dotted letters and speaks them followed by the word', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.q.Eng.readyGo();
    a.clock.tick(2600);
    a.w.__plays.length = 0;
    a.q.Eng.spellIt();
    assert.match(a.w.document.querySelector('#plSub').textContent, /🔤 A · F · R · A · I · D/);
    a.clock.tick(30);
    assert.ok(urls(a).map(said).some((t) => t === 'A, F, R, A, I, D. afraid'), urls(a).map(said).join(' | '));
  });
});

test('v49 pause, resume and finish all speak the one studio stream in plain sentences', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.q.Eng.readyGo();
    tickUntil(a, () => urls(a).some((u) => said(u) === 'afraid'), 200);
    a.w.__plays.length = 0;
    a.q.Eng.pause();
    a.clock.tick(30);
    assert.equal(said(urls(a)[0]), 'Session paused.');
    assert.match(a.w.document.querySelector('#plStatus').textContent, /Paused · Dictation #1 of 30/);
    a.w.__plays.length = 0;
    a.q.Eng.resume();
    a.clock.tick(30);
    assert.equal(said(urls(a)[0]), 'Welcome back. Continuing dictation number 1.');
    a.w.__plays.length = 0;
    a.q.Eng.finish(true);
    a.clock.tick(60);
    assert.ok(urls(a).map(said).some((t) => t === 'Dictation complete. Well done. Review all thirty words below.'), urls(a).map(said).join(' | '));
  });
});

test('v49 a typed finish reports the score in the same voice', () => {
  withApp((a) => {
    a.q.DB.data.settings.mode = 'type';
    a.q.Eng.start({});
    a.clock.tick(50);
    a.w.__plays.length = 0;
    a.q.Eng.mode = 'type';
    a.q.Eng.finish(true);
    a.clock.tick(60);
    const list = urls(a).map(said);
    assert.ok(list.some((t) => /^Dictation complete\. Well done\. Your score is \d+ percent\.$/.test(t)), list.join(' | '));
  });
});

test('v49 the user guide speaks English from the studio stream and Sinhala from the pinned voice', () => {
  withApp((a) => {
    assert.equal(a.q.Speech.guideText('en'), GUIDE_EN);
    assert.match(a.q.Speech.guideText('si'), /^ස්මාර්ට් ඩික්ටේෂන් ප්ලේයර් උපදෙස් මාලාවට/);
    assert.equal(a.q.DB.data.settings.guideLang, 'en', 'English is the default guide language');
    a.w.__plays.length = 0;
    a.w.__synth.length = 0;
    a.q.UI.openGuide();
    a.clock.tick(400);
    const enSaid = urls(a).map(said).join(' ').replace(/\s+/g, ' ').trim();
    assert.match(enSaid, /^Welcome to the Smart Dictation Player User Guide\./);
    assert.match(enSaid, /Click Start practising below to begin\.$/);
    assert.equal(synth(a).length, 0, 'the English guide never needs the device voice');
    const stopButton = a.w.document.querySelector('#btnGuideAudio');
    assert.ok(stopButton, 'the guide has a replay button');
    assert.match(stopButton.textContent, /Replay Guide Audio/);
    a.w.__synth.length = 0;
    a.q.UI.setGuideLang('si');
    a.clock.tick(200);
    const guide = a.w.document.querySelector('#guideSheet');
    assert.ok(guide, 'the guide is still open');
    assert.equal(guide.querySelector('#guideBody').getAttribute('lang'), 'si');
    const si = synth(a);
    assert.ok(si.length >= 1, 'the Sinhala guide uses the pinned si-LK voice');
    assert.ok(si.every((s) => s.lang === 'si-LK'), 'every guide utterance is si-LK');
    assert.match(String(si[0].text), /^ස්මාර්ට් ඩික්ටේෂන් ප්ලේයර් උපදෙස් මාලාවට/);
    a.q.UI.stopGuideAudio();
    assert.equal(a.q.UI.guidePlaying, false);
  });
});

test('v49 the credit badge, cinema animation, press spring and the admin PIN stay pinned', () => {
  assert.match(html, /#credit\{z-index:9999!important/);
  assert.match(html, /@keyframes hansanaCinemaCycle/);
  assert.match(html, /credit-intro/);
  assert.match(html, /backdrop-filter:none!important/);
  assert.match(html, /transition-duration:\.04s/);
  assert.match(html, /cubic-bezier\(\.16,1,\.3,1\)/);
  withApp((a) => {
    const credit = a.w.document.querySelector('#credit');
    assert.ok(credit, 'the Hansana credit badge exists');
    assert.match(credit.textContent, /CREDITS GOES TO Hansana/);
    assert.equal(a.q.CONFIG.adminPin, '78987898', 'the admin PIN never changes');
  });
});

test('v49 answer checking accepts favourite and tyre spellings', () => {
  withApp((a) => {
    const variants = a.q.Eng.getTargetVariants({ w: 'favourite' });
    assert.ok(variants.indexOf('favorite') >= 0, variants.join(','));
    const tyre = a.q.Eng.getTargetVariants({ w: 'tyre / tire' });
    assert.ok(tyre.length >= 1);
    assert.equal(a.q.Speech.cleanWordOnly('tyre / tire'), 'tyre');
    assert.equal(a.q.Speech.cleanWordOnly('favourite / favorite'), 'favourite');
  });
});

/* ---------------------------------------------------------------- data sheet */

test('v49 data.html and /data are identical Liquid Glass reports with the working engine', () => {
  const a = read('data.html');
  const b = read('data/index.html');
  assert.equal(a, b);
  assert.ok(Buffer.byteLength(a) < 60000);
  assert.equal((a.match(/<link\b/gi) || []).length, 0);
  const script = a.match(/<script>([\s\S]*?)<\/script>/)[1];
  acorn.parse(script, { ecmaVersion: 5 });
  assert.match(a, /id="bgLiveVideo" src="\.\/assets\/bunny-live-wallpaper\.mp4"/);
  assert.match(a, /poster="\.\/assets\/bunny-poster\.webp"/);
  assert.match(a, /CREDITS GOES TO Hansana/);
  assert.match(a, /@keyframes hansanaCinemaCycle/);
  assert.match(a, /backdrop-filter:none!important/);
  assert.match(a, /linear-gradient\(155deg, rgba\(255,255,255,0\.16\)/);
  assert.match(a, /inset 0 1\.5px 1px rgba\(255,255,255,\.52\)/);
  assert.match(a, /Noto Sans Sinhala/);
  assert.match(a, /line-height:1\.72/);
  assert.match(a, /speakPinnedSynth/);
  assert.ok(!/<audio id="ttsMasterAudio"[^>]*crossorigin/i.test(a), 'the data sheet master element never carries crossOrigin');
});

test('v49 the data explorer renders 30 rows whose Play buttons stream the Youdao voice', () => {
  const dom = dataDom('data.html');
  try {
    const w = dom.window;
    const rows = w.document.querySelectorAll('#wordRows tr');
    assert.equal(rows.length, 30);
    const first = Array.from(rows[0].querySelectorAll('td')).map((td) => td.textContent);
    assert.equal(first[0], '1');
    assert.equal(first[1], 'afraid');
    assert.match(first[2], /əˈfreɪd/);
    assert.equal(first[4], '~11 KB');
    assert.equal(first[5], '0 KB (Memory Cache)');
    const last = Array.from(rows[29].querySelectorAll('td')).map((td) => td.textContent);
    assert.equal(last[1], 'hungry');
    const buttons = w.document.querySelectorAll('#wordRows .play-word');
    assert.equal(buttons.length, 30, 'every row has a working Play button');
    assert.equal(String(w.TTS.getSingleVoiceUrl('afraid')), YOUDAO + encodeURIComponent('afraid .'));
    buttons[0].click();
    const master = w.document.getElementById('ttsMasterAudio');
    assert.equal(master.getAttribute('src'), YOUDAO + encodeURIComponent('afraid .'));
    assert.equal(master.hasAttribute('crossorigin'), false);
    assert.equal(master.muted, false);
    assert.equal(master.volume, 1);
  } finally { dom.window.close(); }
});

test('v49 the data calculator, language switch and share bar still work', () => {
  const dom = dataDom('data.html', 'https://dictationb1.github.io/data');
  try {
    const w = dom.window;
    const d = w.document;
    assert.equal(d.getElementById('totalMB').textContent, '2.375 MB');
    assert.equal(d.getElementById('savedMB').textContent, '16.35 MB');
    d.getElementById('modeLite').click();
    d.getElementById('sessionsRange').value = '30';
    d.getElementById('sessionsRange').dispatchEvent(new w.Event('input'));
    assert.equal(d.getElementById('sessionsOut').textContent, '30');
    assert.equal(d.getElementById('totalMB').textContent, '1.025 MB');
    assert.equal(d.getElementById('savedMB').textContent, '25.38 MB');
    assert.match(d.querySelector('[data-en][data-si]').getAttribute('data-en'), /./);
    d.getElementById('langSi').click();
    assert.equal(d.body.className, 'si');
    assert.equal(d.getElementById('langSi').getAttribute('aria-pressed'), 'true');
    assert.match(d.getElementById('calcTitle').textContent, /[\u0D80-\u0DFF]/);
    d.getElementById('langEn').click();
    assert.equal(d.body.className, '');
    assert.match(d.getElementById('calcTitle').textContent, /How much data/);
    d.getElementById('copyLink').click();
    assert.equal(d.getElementById('shareWa').getAttribute('id'), 'shareWa');
    d.getElementById('shareWa').click();
    assert.match(String(w.__opened || ''), /wa\.me/);
    d.getElementById('printPage').click();
    assert.equal(w.__printed, 1);
    assert.match(d.getElementById('auditLink').getAttribute('href'), /issues\/92$/);
    assert.match(d.getElementById('openPlayer').getAttribute('href'), /dictationb1\.github\.io\/?$/);
    d.getElementById('videoToggle').click();
    assert.equal(d.getElementById('videoToggle').getAttribute('aria-pressed'), 'false');
    d.getElementById('videoToggle').click();
    assert.equal(d.getElementById('videoToggle').getAttribute('aria-pressed'), 'true');
  } finally { dom.window.close(); }
});

test('v49 the in-app data sheet links to the full interactive report', () => {
  withApp((a) => {
    a.q.UI.openDataSheet();
    a.clock.tick(50);
    const sheet = a.w.document.querySelector('#dataReportSheet');
    assert.ok(sheet, 'the data sheet opened');
    const text = sheet.textContent;
    assert.match(text, /2\.28 MB/);
    assert.match(text, /0\.82 MB/);
    assert.match(text, /0\.005 MB/);
    assert.match(text, /dictationb1\.github\.io\/data/);
    const auditLink = Array.from(sheet.querySelectorAll('a')).find((x) => /issues\/92/.test(x.getAttribute('href') || ''));
    assert.ok(auditLink, 'the sheet links to the public GitHub audit issue');
    assert.ok(sheet.querySelector('#btnCopyDataLink'), 'the copy link action exists');
  });
});
