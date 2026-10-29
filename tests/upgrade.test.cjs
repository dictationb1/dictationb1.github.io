'use strict';
/* v50 release contract. Network responses are simulated: these tests verify
   routing and lifecycle, not a provider's pronunciation or availability. */
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const acorn = require('acorn');
const { JSDOM } = require('jsdom');
const { harness, html } = require('./app-harness.cjs');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const YOUDAO = 'https://dict.youdao.com/dictvoice?type=1&audio=';
const SI = 'https://dict.youdao.com/dictvoice?type=1&le=si&audio=';
const GOOGLE = 'https://ssl.gstatic.com/dictionary/static/sounds/20200429/';
const KEY = 'sdp.v50_all_p0_p6_fixed';
const words = ['afraid','amazed','amusing','annoyed','anxious','ashamed','awesome','boring','brilliant','challenging','charming','confident','confusing','cruel','curious','delighted','depressed','disappointed','embarrassing','enjoyable','excellent','excited','fantastic','favourite','frightened','friendly','generous','guilty','healthy','hungry'];

function installMedia(w) {
  w.__plays = []; w.__loads = []; w.__synth = []; w.__voices = [];
  w.HTMLMediaElement.prototype.load = function () {
    if (this.id === 'ttsMasterAudio') { this.playbackRate = this.defaultPlaybackRate; w.__loads.push(this.getAttribute('src')); }
  };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.play = function () {
    if (this.id === 'ttsMasterAudio') w.__plays.push({src: this.getAttribute('src'), rate: this.playbackRate, defaultRate: this.defaultPlaybackRate});
    return Promise.resolve();
  };
  w.SpeechSynthesisUtterance = function (text) { this.text = text; };
  Object.defineProperty(w, 'speechSynthesis', { configurable: true, value: {
    getVoices() { return w.__voices; }, cancel() {},
    speak(u) { w.__synth.push(u); }, addEventListener() {}
  }});
}
function app(fn, seed) {
  const a = harness(undefined, { before(w) { installMedia(w); if (seed) w.localStorage.setItem('sdp.v49_working_sound_system', JSON.stringify(seed)); } });
  try { return fn(a); } finally { a.close(); }
}
function end(audio) { assert.equal(typeof audio.onended, 'function', 'a media completion handler exists'); audio.onended(); }
function started(audio) { if (audio.onplaying) audio.onplaying(); }
function player(a) { const E = a.q.Eng; E.start({}); E.readyGo(); E.startWord(0); return E; }
function dataPage() {
  const dom = new JSDOM(read('data.html'), {url:'https://example.test/data.html', runScripts:'outside-only', pretendToBeVisual:true});
  installMedia(dom.window);
  const script = Array.from(dom.window.document.scripts).find((node) => !node.type).textContent;
  dom.window.eval(script);
  return dom;
}

test('v50 metadata and Session 8 are consistent throughout the release', () => {
  for (const file of ['data/version.json','data/config.json','data/session.json']) {
    const d = json(file);
    assert.equal(d.ver, 50, file); assert.equal(d.schema, 50); assert.equal(d.settingsRev, 50);
    assert.equal(d.appVersion, '5.6.0'); assert.equal(d.version, '5.6.0'); assert.equal(d.key, KEY);
    assert.equal(d.storageKey, KEY); assert.equal(d.perf, 'full'); assert.equal(d.adminPin, '78987898');
  }
  const config = json('data/config.json'), session = json('data/session.json');
  assert.equal(config.defaults.perf, 'full'); assert.equal(session.session.perf, 'full');
  const list = session.lists.find((l) => l.id === 'list_session_8_feelings');
  assert.deepEqual(list.words.map((w) => w.w), words);
  for (const word of list.words) assert.equal(word.audio, YOUDAO + encodeURIComponent(word.w));
});

test('all published HTML scripts remain ES5, self-contained and below their budgets', () => {
  for (const file of ['index.html','data.html','data/index.html']) {
    const doc = read(file), match = doc.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(match, file); acorn.parse(match[1], {ecmaVersion:5});
    assert.doesNotMatch(doc, /<link\b/i);
    assert.ok(Buffer.byteLength(doc) < (file === 'index.html' ? 430000 : 60000));
  }
  assert.equal(read('data.html'), read('data/index.html'));
});

test('fresh defaults and v49 migration preserve personal data; subsequent Lite choice persists', () => {
  let seed;
  app((a) => { assert.equal(a.q.CONFIG.key, KEY); assert.equal(a.q.APP_VERSION, '5.6.0'); assert.equal(a.q.DB.defaults().settings.perf, 'full'); seed = JSON.parse(JSON.stringify(a.q.DB.data)); });
  seed.settingsRev = 49; seed.v = 49; seed.settings.perf = 'lite';
  seed.history = [{id:'history-1', wordCount:30}]; seed.comments = [{id:'comment-1', text:'keep me'}];
  seed.lists.push({id:'personal-list', name:'Personal', words:[{w:'treasure', s:'A treasure is precious.', m:'Something valuable.'}]});
  app((a) => {
    const d = a.q.DB.data;
    assert.equal(d.settingsRev, 50); assert.equal(d.v, 50); assert.equal(d.settings.perf, 'full');
    assert.equal(d.history[0].id, 'history-1'); assert.equal(d.comments[0].text, 'keep me');
    assert.ok(d.lists.some((l) => l.id === 'personal-list' && l.words[0].w === 'treasure'));
    assert.ok(a.w.localStorage.getItem(KEY));
    d.settings.perf = 'lite'; a.q.DB.saveNow();
    a.q.DB.load(); assert.equal(a.q.DB.data.settings.perf, 'lite', 'a deliberate new Lite selection is not reset on every load');
    assert.equal(a.q.DB.resetToV50({settings:{perf:'auto'}}).settings.perf, 'full');
  }, seed);
});

test('all 30 words use clean Youdao URLs and expose the UK Google dictionary backup', () => app((a) => {
  for (const word of words) {
    const urls = Array.from(a.q.Speech.getRealStudioUrls(word, 'en'));
    assert.equal(urls[0], YOUDAO + word); assert.equal(urls[1], GOOGLE + word + '--_gb_1.mp3');
    assert.doesNotMatch(urls[0], /%20\.$/);
  }
  assert.equal(a.q.Speech.getSingleVoiceUrl('Number 1'), YOUDAO + 'Number%201');
  assert.equal(a.q.Speech.getSingleVoiceUrl('a long sentence.'), YOUDAO + 'a%20long%20sentence.');
  assert.equal(a.q.Speech.getSingleVoiceUrl('tyre/tire'), YOUDAO + 'tyre');
  assert.equal(a.q.Speech.getRealStudioUrls('well-known')[1], GOOGLE + 'well-known--_gb_1.mp3');
  assert.equal(a.q.Speech.getRealStudioUrls('two words').length, 1);
}));

test('Sinhala uses a nonempty, length-limited stream URL', () => app((a) => {
  assert.equal(a.q.Speech.getSingleVoiceUrl('ආයුබෝවන්','si'), SI + encodeURIComponent('ආයුබෝවන්'));
  const input = 'අ'.repeat(200), url = a.q.Speech.getSingleVoiceUrl(input, 'si');
  assert.equal(decodeURIComponent(url.slice(SI.length)).length, 180);
  assert.ok(a.q.Speech.getSingleVoiceUrl('', 'si').startsWith(SI));
}));

test('asynchronously discovered UK female voices are selected without a reload', () => app((a) => {
  assert.equal(a.q.Speech.chosen, null);
  a.w.__voices.push({name:'Daniel',lang:'en-GB'}, {name:'Microsoft Sonia Online (Natural) - English (United Kingdom)',lang:'en-GB'});
  assert.equal(typeof a.w.speechSynthesis.onvoiceschanged, 'function'); a.w.speechSynthesis.onvoiceschanged();
  assert.match(a.q.Speech.chosen.name, /Sonia/); assert.equal(a.q.Speech.ukVoices.length, 2);
}));

test('word cycle plays number, 120 ms beat and exactly the same word twice with 650 ms gap', () => app((a) => {
  const S = a.q.Speech, audio = S.master(), passes = []; let done = null;
  S.speakWordCycle({w:'afraid'}, 0, (ok) => { done = ok; }, (pass) => passes.push(pass));
  assert.equal(a.w.__plays.at(-1).src, YOUDAO + 'Number%201'); end(audio);
  a.clock.tick(119); assert.equal(a.w.__plays.length, 1); a.clock.tick(1);
  assert.equal(a.w.__plays.at(-1).src, YOUDAO + 'afraid'); end(audio);
  a.clock.tick(649); assert.equal(a.w.__plays.length, 2); a.clock.tick(1);
  assert.equal(a.w.__plays.at(-1).src, YOUDAO + 'afraid');
  assert.equal(a.w.__loads.filter((u) => u === YOUDAO + 'afraid').length, 1, 'the second pass reuses the loaded word');
  end(audio); assert.equal(done, true); assert.deepEqual(passes, [1,2]);
  a.q.Eng.words = words.map((word) => ({w:word}));
  S.speakWordCycle({w:'hungry'}, 29, () => {});
  assert.equal(a.w.__plays.at(-1).src, YOUDAO + 'Final%20word%2C%20number%2030');
}));

test('stopping during the announcement or beat cancels the queued word', () => app((a) => {
  const S = a.q.Speech, audio = S.master();
  S.speakWordCycle({w:'afraid'}, 0, () => { throw Error('cancelled callback fired'); });
  end(audio); S.stop(); a.clock.tick(2000);
  assert.deepEqual(a.w.__plays.map((p) => p.src), [YOUDAO + 'Number%201']);
}));

test('0.72 rate is restored after load, metadata, and play; synth fallback receives it too', () => app((a) => {
  const S = a.q.Speech, audio = S.master();
  a.w.__voices.push({name:'Google UK English Female',lang:'en-GB'}); a.w.speechSynthesis.onvoiceschanged();
  S.playWord('afraid', 0.72, () => {});
  assert.equal(audio.playbackRate, 0.72); assert.equal(audio.defaultPlaybackRate, 0.72);
  audio.playbackRate = 1; audio.defaultPlaybackRate = 1; audio.onloadedmetadata();
  assert.equal(audio.playbackRate, 0.72); assert.equal(audio.defaultPlaybackRate, 0.72);
  audio.playbackRate = 1; audio.onplay(); assert.equal(audio.playbackRate, 0.72);
  audio.onerror(); assert.equal(audio.getAttribute('src'), GOOGLE + 'afraid--_gb_1.mp3');
  assert.equal(audio.playbackRate, 0.72); assert.equal(audio.defaultPlaybackRate, 0.72);
  audio.onerror(); assert.equal(a.w.__synth.length, 1); assert.equal(a.w.__synth[0].rate, 0.72);
  assert.equal(a.w.__synth[0].voice.name, 'Google UK English Female');
}));

test('a failed primary recording uses and remembers the Google backup for both readings', () => app((a) => {
  const S = a.q.Speech, audio = S.master(); let done = false;
  S.speakWordCycle({w:'afraid'}, 0, (ok) => { done = ok; }); end(audio); a.clock.tick(120);
  audio.onerror(); assert.equal(audio.getAttribute('src'), GOOGLE + 'afraid--_gb_1.mp3'); end(audio);
  a.clock.tick(650); assert.equal(audio.getAttribute('src'), GOOGLE + 'afraid--_gb_1.mp3');
  assert.equal(a.w.__loads.filter((u) => u === GOOGLE + 'afraid--_gb_1.mp3').length, 1);
  end(audio); assert.equal(done, true);
}));

test('Sinhala media failure uses si-LK voice, or a romanised default voice without throwing', () => app((a) => {
  const S = a.q.Speech, audio = S.master(); let ok = null;
  a.w.__voices.push({name:'Thilini',lang:'si-LK'}); a.w.speechSynthesis.onvoiceschanged();
  S.speakStudioText('ආයුබෝවන්', 'si', (value) => { ok = value; });
  assert.equal(audio.getAttribute('src'), SI + encodeURIComponent('ආයුබෝවන්')); audio.onerror();
  assert.equal(a.w.__synth[0].voice.lang, 'si-LK'); assert.equal(a.w.__synth[0].text, 'ආයුබෝවන්');
  a.w.__synth[0].onend(); assert.equal(ok, true);
  a.w.__voices = [{name:'Serena',lang:'en-GB'}]; a.w.speechSynthesis.onvoiceschanged();
  S.speakStudioText('ආයුබෝවන්', 'si', () => {}); audio.onerror();
  assert.equal(a.w.__synth[1].voice.name, 'Serena'); assert.match(a.w.__synth[1].text, /^[a-z ]+$/i);
}));

test('long Sinhala text is sent in consecutive chunks without truncation', () => app((a) => {
  const S = a.q.Speech, audio = S.master(), text = Array(75).fill('සිංහල').join(' '); let done = false;
  S.speakStudioText(text, 'si', (ok) => { done = ok; });
  while (!done) { assert.ok(a.w.__plays.length < 10); end(audio); }
  const parts = a.w.__plays.map((p) => decodeURIComponent(p.src.slice(SI.length)));
  assert.ok(parts.length > 1); assert.ok(parts.every((s) => s.length <= 180)); assert.equal(parts.join(' '), text);
}));

test('sentence helper holds the masked sentence and word position until audio ends', () => app((a) => {
  const E = player(a), audio = a.q.Speech.master(); E.speakSentence(); started(audio);
  const visible = a.w.document.querySelector('#plSub').textContent;
  assert.match(visible, /^💬 .*_______/); assert.doesNotMatch(visible, /afraid/i); assert.equal(E.countdown, null);
  a.clock.tick(6000); assert.equal(E.idx, 0); assert.equal(a.w.document.querySelector('#plSub').textContent, visible); assert.equal(E.countdown, null);
  end(audio); assert.equal(E.st, 'waiting'); assert.equal(E.countdown.left, 5);
  a.clock.tick(4000); assert.equal(E.idx, 0); a.clock.tick(1000); assert.equal(E.idx, 1);
}));

test('spelling, slow and replay helpers wait for completion and display their own text', () => app((a) => {
  const E = player(a), audio = a.q.Speech.master(), sub = a.w.document.querySelector('#plSub');
  E.spellIt(); started(audio); assert.equal(sub.textContent, '🔤 Spelling: A · F · R · A · I · D');
  assert.match(decodeURIComponent(audio.getAttribute('src')), /A\.\.\. F\.\.\. R\.\.\. A\.\.\. I\.\.\. D\.\.\. afraid/);
  a.clock.tick(6000); assert.equal(E.countdown, null); assert.equal(sub.textContent, '🔤 Spelling: A · F · R · A · I · D');
  end(audio); assert.equal(E.countdown.left, 5);
  E.speakSlow(); started(audio); assert.equal(audio.playbackRate, 0.72); assert.equal(audio.defaultPlaybackRate, 0.72); assert.match(sub.textContent, /Speaking slowly/);
  a.clock.tick(2000); assert.equal(E.countdown, null); end(audio); assert.equal(E.countdown.left, 5);
  E.replay(); assert.equal(sub.textContent, '🔊 Repeating word…'); end(audio); a.clock.tick(120); end(audio); a.clock.tick(650); end(audio);
  assert.equal(E.countdown.left, 5);
}));

test('DOM Pause and Resume cancel stale helpers and wait for the entire welcome-back prompt', () => app((a) => {
  const E = player(a), audio = a.q.Speech.master(), pause = a.w.document.querySelector('#btnPause');
  assert.ok(pause); E.speakSentence(); started(audio); const stale = audio.onended;
  pause.click(); assert.equal(E.paused, true); assert.equal(E.st, 'paused'); assert.equal(pause.textContent, '▶ Resume');
  assert.equal(a.w.document.querySelector('#plProgText').textContent, '⏸ Paused · Dictation #1 of 30');
  assert.equal(a.w.document.querySelector('#plStepBadge').textContent, '⏸ Paused · Dictation #1 of 30');
  assert.equal(a.w.document.querySelector('#plSub').textContent, '⏸ Session paused. Click Resume to continue.');
  stale(); a.clock.tick(10000); assert.equal(E.idx, 0); assert.equal(E.st, 'paused');
  pause.click(); started(audio); assert.equal(E.paused, false); assert.equal(pause.textContent, '⏸ Pause');
  assert.match(a.w.document.querySelector('#plSub').textContent, /Welcome back/);
  a.clock.tick(10000); assert.equal(E.phase, 'resume', 'no hardcoded nine-second restart');
  end(audio); assert.equal(E.idx, 0); assert.equal(E.phase, 'listen'); assert.equal(audio.getAttribute('src'), YOUDAO + 'Number%201');
}));

test('late unlock resolution never pauses or removes a newly assigned speech URL', () => app((a) => {
  const S = a.q.Speech, audio = S.master(); let resolveUnlock;
  S.isHeadless = () => false; S._armed = false;
  audio.play = function () { if (audio.getAttribute('src').startsWith('data:')) return {then(resolve) { resolveUnlock = resolve; }}; return Promise.resolve(); };
  S.unlock(); S.playWord('afraid', 1, () => {}); resolveUnlock();
  assert.equal(audio.getAttribute('src'), YOUDAO + 'afraid');
}));

test('data routes use the same clean URLs, Sinhala stream, rate and late voice discovery', () => {
  const dom = dataPage(), w = dom.window, T = w.TTS, audio = T.master();
  try {
    assert.equal(w.document.querySelectorAll('#wordRows tr').length, 30);
    assert.equal(T.getSingleVoiceUrl('afraid'), YOUDAO + 'afraid');
    assert.equal(T.getRealStudioUrls('afraid')[1], GOOGLE + 'afraid--_gb_1.mp3');
    assert.equal(T.getSingleVoiceUrl('ආයුබෝවන්','si'), SI + encodeURIComponent('ආයුබෝවන්'));
    w.__voices.push({name:'Serena',lang:'en-GB'}); w.speechSynthesis.onvoiceschanged(); assert.equal(T.chosen.name, 'Serena');
    T.playWord('afraid', 0.72, () => {}); assert.equal(audio.playbackRate, 0.72); assert.equal(audio.defaultPlaybackRate, 0.72);
    audio.playbackRate = 1; audio.onloadedmetadata(); assert.equal(audio.playbackRate, 0.72);
    T.speakStudioText('ආයුබෝවන්', 'si', () => {}); assert.equal(audio.getAttribute('src'), SI + encodeURIComponent('ආයුබෝවන්'));
  } finally { dom.window.close(); }
});

test('credit and glass styles include both performance modes and the reduced-motion override', () => {
  assert.doesNotMatch(html, /body\[data-perf=lite\] \.glass::before\{display:none!important\}/);
  assert.match(html, /hansanaCinemaCycle/); assert.match(html, /opacity:\.04;transform:translate3d\(0,-24px,0\) scale\(\.70\)/);
  assert.match(html, /#credit, #credit\.in, body\.credit-intro #credit, #credit \*\{animation-duration:7s!important/);
  assert.match(html, /inset 0 1\.5px 1px rgba\(255,255,255,\.55\)/);
  assert.match(html, /inset 0 -1\.5px 3px rgba\(56,189,248,\.28\)/);
});
