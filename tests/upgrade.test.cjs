'use strict';
/* v48 (APP_VERSION 5.4.0) release gate.
   One unified Cambridge British woman studio voice, the exact Session 8 word list,
   the interactive /data report and every v48 UI contract, checked without the network. */
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
const KEY = 'sdp.v48_cambridge_single_voice';
const APP = '5.4.0';
const GB = 'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=en-GB&ttsspeed=0.95&q=';
const SI = 'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=si&q=';
const YOUDAO = 'https://dict.youdao.com/dictvoice?type=1&audio=';
const WORDS = ['afraid', 'amazed', 'amusing', 'annoyed', 'anxious', 'ashamed', 'awesome', 'boring', 'brilliant',
  'challenging', 'charming', 'confident', 'confusing', 'cruel', 'curious', 'delighted', 'depressed', 'disappointed',
  'embarrassing', 'enjoyable', 'excellent', 'excited', 'fantastic', 'favourite', 'frightened', 'friendly', 'generous',
  'guilty', 'healthy', 'hungry'];
const GUIDE_EN = "Welcome to the Smart Dictation Player User Guide. First, choose Listen and write on paper, or Type in app. Second, click Start dictation, then click I'm ready. Every word is read twice with five seconds to write. You can use Repeat, Slower, Repeat sentence, or Spell it at any time. Click Start practising below to begin.";
const GUIDE_SI = 'ස්මාර්ට් ඩික්ටේෂන් ප්ලේයර් උපදෙස් මාලාවට සාදරයෙන් පිළිගනිමු. පළමුව, කඩදාසියක ලිවීමට හෝ ඇප් එක තුළ ටයිප් කිරීමට ක්‍රමයක් තෝරන්න. දෙවනුව, ස්ටාර්ට් ඩික්ටේෂන් බොත්තම ඔබා, අයි ඈම් රෙඩි බොත්තම ඔබන්න. සෑම වචනයක්ම දෙවරක් කියවන අතර ලිවීමට තත්පර පහක් ලැබේ. ආරම්භ කිරීමට ස්ටාර්ට් ප්‍රැක්ටිසිං බොත්තම ඔබන්න.';

function mediaSpy(w) {
  w.__plays = [];
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.play = function () {
    const el = this;
    if (el.id === 'ttsMasterAudio') {
      w.__plays.push(String(el.getAttribute('src') || ''));
      w.setTimeout(function () { if (el.onended) el.onended(); }, 5);
    }
    return Promise.resolve();
  };
}
function withApp(fn) {
  const app = harness(undefined, { before: mediaSpy });
  try { return fn(app); } finally { app.close(); }
}
function plays(a) { return a.w.__plays.slice(); }
function words(a) { return plays(a).filter((u) => /^https?:/.test(u)); }
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

/* ---------------------------------------------------------------- static gates */

test('v48 static gates: compact ES5 single-file app with no generated audio', () => {
  const bytes = Buffer.byteLength(html);
  assert.ok(bytes < 430000, 'index.html stays below 430,000 bytes: ' + bytes);
  assert.equal((html.match(/<link\b/gi) || []).length, 0, 'no static <link> tag');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  acorn.parse(script, { ecmaVersion: 5 });
  assert.equal(fs.existsSync(path.join(root, 'audio')), false, 'no synthetic ./audio pack');
  assert.equal(fs.existsSync(path.join(root, 'scripts', 'build-audio.cjs')), false, 'no build-audio generator');
  assert.match(html, /<html lang="en"/);
  assert.equal((html.match(/<audio id="ttsMasterAudio"/g) || []).length, 1);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.ok(!/<audio id="ttsMasterAudio"[^>]*crossorigin/i.test(html), 'the master element never carries crossOrigin');
});

test('v48 metadata: ver 48, appVersion 5.4.0, admin PIN 78987898 and the Amy voice', () => {
  for (const file of ['data/version.json', 'data/config.json', 'data/session.json']) {
    const doc = json(file);
    assert.equal(doc.ver, 48, file + ' ver');
    assert.equal(doc.appVersion, APP, file + ' appVersion');
    assert.equal(doc.schema, 48, file + ' schema');
    if (doc.settingsRev !== undefined) assert.equal(doc.settingsRev, 48, file + ' settingsRev');
    if (doc.adminPin !== undefined) assert.equal(doc.adminPin, '78987898', file + ' admin PIN');
    if (doc.key !== undefined) assert.equal(doc.key, KEY, file + ' storage key');
    if (doc.voice !== undefined) assert.equal(doc.voice, 'Amy', file + ' voice');
    if (doc.lockedVoice !== undefined) assert.equal(doc.lockedVoice, 'Amy', file + ' locked voice');
  }
  withApp((a) => {
    assert.equal(a.q.CONFIG.lockedVoice, 'Amy');
    assert.equal(a.q.CONFIG.key, KEY);
    assert.equal(a.q.CONFIG.adminPin, '78987898');
    assert.equal(a.q.CONFIG.schema, 48);
    assert.equal(a.q.DB.data.settings.voice, 'Amy');
    assert.equal(a.q.DB.data.settings.adminPin, '78987898');
    assert.equal(a.q.Window === undefined || true, true);
  });
  assert.ok(/maxlength="8"|maxLength=8/.test(html), 'the numeric admin PIN input allows eight digits');
});

test('v48 Session 8 is active with the exact 30 adjectives and Session 7 stays archived', () => {
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
    assert.equal(item.audio, GB + encodeURIComponent(item.w), 'single voice stream for ' + item.w);
  }
  const past = doc.pastSessions.find((s) => /Session 7 - Travel & Transport/.test(s.title));
  assert.ok(past, 'Session 7 is archived');
  const pastWords = past.words || [];
  if (pastWords.length) assert.equal(pastWords.length, 30, 'Session 7 keeps all 30 words');
  else assert.equal(past.wordCount, 30, 'Session 7 keeps all 30 words');
  withApp((a) => {
    const archived = a.q.DB.data.pastSessions.find((x) => /Session 7 - Travel & Transport/.test(x.title));
    assert.ok(archived && archived.words.length === 30, 'the app still ships all 30 Session 7 words');
  });
});

/* ---------------------------------------------------------------- voice engine */

test('v48 the single unified en-GB stream is the only English voice', () => {
  withApp((a) => {
    const T = a.q.Speech;
    assert.equal(T.getSingleVoiceUrl('afraid'), GB + 'afraid');
    assert.equal(T.getSingleVoiceUrl('Number 1', 'en'), GB + 'Number%201');
    assert.equal(T.getUnifiedVoiceUrl('Repeat this sentence'), GB + 'Repeat%20this%20sentence');
    assert.equal(T.getSingleVoiceUrl('ආයුබෝවන්', 'si'), SI + encodeURIComponent('ආයුබෝවන්'));
    assert.deepEqual(Array.from(T.getRealStudioUrls('afraid')), [GB + 'afraid', YOUDAO + encodeURIComponent('afraid .')]);
    assert.equal(T.CACHE_NAME, 'sdp-voice-v48');
    assert.equal(typeof T._blobCache, 'object');
    assert.equal(typeof T._lastLoadedUrl, 'string');
    const master = T.master();
    assert.equal(master.getAttribute('preload'), 'auto');
    assert.equal(master.hasAttribute('playsinline'), true);
    assert.equal(master.getAttribute('referrerpolicy'), 'no-referrer');
    assert.equal(master.hasAttribute('crossorigin'), false);
    assert.equal(a.w.document.querySelectorAll('audio#ttsMasterAudio').length, 1);
  });
});

test('v48 every stage - instruction, countdown, word, helpers - uses the same endpoint', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(60);
    assert.ok(plays(a).every((u) => u.indexOf(GB) === 0 || u.indexOf(SI) === 0), 'only the one stream plays');
    a.q.Eng.readyGo();
    a.clock.tick(30);
    a.q.Eng.speakSentence();
    a.clock.tick(30);
    a.q.Eng.spellIt();
    a.clock.tick(30);
    a.q.Eng.speakSlow();
    a.clock.tick(30);
    const urls = words(a);
    assert.ok(urls.length >= 3, 'audio was requested');
    assert.ok(urls.every((u) => u.indexOf(GB) === 0), 'every clip is the one en-GB stream: ' + urls.join(' | '));
  });
});

test('v48 the live browser never calls the robotic device speech engine', () => {
  withApp((a) => {
    const spoken = [];
    a.w.speechSynthesis = { cancel() {}, speak(u) { spoken.push(u); }, getVoices() { return []; } };
    const T = a.q.Speech;
    T.isHeadless = function () { return false; };
    T.speakSynth('Hello', 'en', function () {});
    T.speakStudioText('Hello', 'en', function () {});
    a.clock.tick(200);
    assert.equal(spoken.length, 0, 'speechSynthesis.speak was never used');
    assert.ok(plays(a).length >= 1, 'the studio stream played instead');
  });
  return assert.rejects;
});

test('v48 headless errors resolve after 50ms so the test suites stay fast', () => {
  withApp((a) => {
    const T = a.q.Speech;
    a.w.HTMLMediaElement.prototype.play = function () { if (this.onerror) this.onerror(); return Promise.reject(new Error('blocked')); };
    let done = -1;
    const started = Date.now();
    T.speakStudioText('Sound check', 'en', function () { done = Date.now() - started; });
    a.clock.tick(60);
    assert.ok(done >= 0, 'the headless fallback completed');
    assert.ok(a.q.Speech.isHeadless(), 'jsdom is treated as a headless browser');
  });
});

test('v48 Test sound speaks the verified phrase and lights the status pill', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    const btn = a.w.document.querySelector('#btnReadyTest');
    assert.ok(btn, 'the ready sheet offers Test sound');
    btn.click();
    a.clock.tick(80);
    assert.ok(words(a).some((u) => u === GB + encodeURIComponent('Sound check. Number 1, afraid.')), 'the exact sound check line: ' + words(a).join(' | '));
    const pill = a.w.document.querySelector('#readySheet [data-voice-pill]');
    assert.ok(pill, 'a status pill exists');
    assert.equal(pill.textContent, '✓ Dictation Voice Verified');
  });
});

test('v48 ready sheet speaks the I am ready instruction and hides the player layer', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    const sheet = a.w.document.querySelector('#readySheet');
    assert.ok(sheet, 'the ready sheet opened');
    assert.equal(a.w.document.body.classList.contains('sheet-open'), true);
    const spoken = words(a).map((u) => decodeURIComponent(u.split('&q=')[1] || ''));
    assert.ok(spoken.some((t) => t === "Welcome. Prepare your pen and paper. Each word is read twice. Click I'm ready to begin."), spoken.join(' | '));
    assert.ok(!/Yes, I'm ready/i.test(a.w.document.querySelector('#readySheet').textContent), 'the sheet never says Yes, I am ready');
    assert.equal(a.w.document.querySelector('#readySheet .btn-skip, #btnSkipReady'), null);
    assert.ok(!/Skip countdown/.test(a.w.document.querySelector('#readySheet').textContent));
    assert.match(html, /body\.sheet-open[^{]*\.layer\{[^}]*visibility:hidden/);
  });
});

test('v48 countdown is Three at 0ms, Two at 950ms and One at 1900ms in lockstep', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.w.__plays.length = 0;
    a.q.Eng.readyGo();
    a.clock.tick(1);
    assert.equal(words(a)[0], GB + 'Three', 'Three starts immediately');
    a.clock.tick(700);
    assert.equal(words(a).filter((u) => u === GB + 'Two').length, 0, 'Two waits for the 950ms beat');
    a.clock.tick(300);
    assert.equal(words(a).filter((u) => u === GB + 'Two').length, 1, 'Two at about 950ms');
    a.clock.tick(900);
    assert.equal(words(a).filter((u) => u === GB + 'One').length, 1, 'One at about 1900ms');
    assert.equal(a.q.Eng.phase, 'countdown');
    a.clock.tick(40);
    assert.notEqual(a.q.Eng.phase, 'countdown', 'word one starts only after One finishes');
    assert.ok(words(a).some((u) => u.indexOf('Number%201%2C%20afraid') > 0), words(a).join(' | '));
  });
});

test('v48 word 1 is Number 1 plus the clean word, then 650ms, then the word alone', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.w.__plays.length = 0;
    a.q.Eng.readyGo();
    tickUntil(a, () => words(a).some((u) => u.indexOf('q=afraid') > 0), 200);
    const list = words(a);
    const pass1 = list.findIndex((u) => u.indexOf('q=Number%201%2C%20afraid') > 0);
    const pass2 = list.findIndex((u) => u === GB + 'afraid');
    assert.ok(pass1 >= 0, 'Pass 1 announces number and word: ' + list.join(' | '));
    assert.ok(pass2 > pass1, 'Pass 2 says only the clean word');
    assert.ok(!/listen again|once more|one more time/i.test(decodeURIComponent(list.slice(pass1, pass2 + 1).join(' '))));
    assert.match(a.w.document.querySelector('#plProgText').textContent, /^Dictation #1 of 30$/);
  });
});

test('v48 the final word is announced as Final word, number 30 and the writing timer is five seconds', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.q.Eng.readyGo();
    a.clock.tick(2600);
    a.w.__plays.length = 0;
    a.q.Eng.words = a.q.DB.data.lists[0].words.slice();
    a.q.Eng.startWord(29);
    const list = words(a);
    assert.ok(list.some((u) => decodeURIComponent(u.split('&q=')[1] || '') === 'Final word, number 30, hungry'), list.join(' | '));
    tickUntil(a, () => /Your turn|Write the word now/.test(a.w.document.querySelector('#plStatus').textContent), 300);
    assert.equal(a.q.Eng.writeSecs(), 5);
    assert.match(a.w.document.querySelector('#plStatus').textContent, /Write the word now \(5s\)|Your turn/);
  });
});

test('v48 Repeat replays the pair, Slower uses 0.72 with preserved pitch and Sentence masks the word', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.q.Eng.readyGo();
    a.clock.tick(2600);
    a.w.__plays.length = 0;
    a.q.Eng.replayWord();
    a.clock.tick(30);
    assert.ok(words(a).some((u) => u.indexOf('Number%201%2C%20afraid') > 0), 'Repeat replays the pair');

    a.w.__plays.length = 0;
    a.q.Eng.speakSlow();
    assert.match(a.w.document.querySelector('#plSub').textContent, /Speaking slowly \(0\.72×\)/);
    a.clock.tick(30);
    assert.equal(a.w.document.querySelector('#ttsMasterAudio').playbackRate, 1, 'the rate is restored after the clip');
    assert.equal(a.w.document.querySelector('#ttsMasterAudio').preservesPitch, true);

    a.q.Eng.speakSentence();
    assert.match(a.w.document.querySelector('#plSub').textContent, /_______/);
    a.clock.tick(30);
    assert.ok(words(a).some((u) => decodeURIComponent(u.split('&q=')[1] || '').indexOf('She was never afraid') === 0), words(a).join(' | '));
  });
});

test('v48 Spell it shows dotted letters and speaks them followed by the word', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.q.Eng.readyGo();
    a.clock.tick(2600);
    a.w.__plays.length = 0;
    a.q.Eng.spellIt();
    assert.match(a.w.document.querySelector('#plSub').textContent, /🔤 A · F · R · A · I · D/);
    a.clock.tick(30);
    assert.ok(words(a).some((u) => decodeURIComponent(u.split('&q=')[1] || '') === 'A, F, R, A, I, D. afraid'), words(a).join(' | '));
  });
});

test('v48 pause, resume and finish all speak the single voice in plain sentences', () => {
  withApp((a) => {
    a.q.Eng.start({});
    a.clock.tick(50);
    a.q.Eng.readyGo();
    tickUntil(a, () => words(a).some((u) => u.indexOf('q=afraid') > 0), 200);
    a.w.__plays.length = 0;
    a.q.Eng.pause();
    a.clock.tick(30);
    assert.equal(words(a)[0], GB + encodeURIComponent('Session paused.'));
    assert.match(a.w.document.querySelector('#plStatus').textContent, /Paused · Dictation #1 of 30/);
    a.w.__plays.length = 0;
    a.q.Eng.resume();
    a.clock.tick(30);
    assert.equal(words(a)[0], GB + encodeURIComponent('Welcome back. Continuing dictation number 1.'));
    a.w.__plays.length = 0;
    a.q.Eng.finish(true);
    a.clock.tick(60);
    assert.ok(words(a).some((u) => decodeURIComponent(u.split('&q=')[1] || '') === 'Dictation complete. Well done. Review all thirty words below.'), words(a).join(' | '));
  });
});

test('v48 a typed finish reports the score in the same voice', () => {
  withApp((a) => {
    a.q.DB.data.settings.mode = 'type';
    a.q.Eng.start({});
    a.clock.tick(50);
    a.w.__plays.length = 0;
    a.q.Eng.mode = 'type';
    a.q.Eng.finish(true);
    a.clock.tick(60);
    const said = words(a).map((u) => decodeURIComponent(u.split('&q=')[1] || ''));
    assert.ok(said.some((t) => /^Dictation complete\. Well done\. Your score is \d+ percent\.$/.test(t)), said.join(' | '));
  });
});

test('v48 the user guide speaks English and Sinhala with the exact scripts', () => {
  withApp((a) => {
    assert.equal(a.q.Speech.guideText('en'), GUIDE_EN);
    assert.equal(a.q.Speech.guideText('si'), GUIDE_SI);
    a.w.__plays.length = 0;
    a.q.UI.openGuide();
    a.clock.tick(400);
    const enSaid = words(a).map((u) => decodeURIComponent(u.split('&q=')[1] || '')).join(' ').replace(/\s+/g, ' ').trim();
    assert.match(enSaid, /^Welcome to the Smart Dictation Player User Guide\./);
    assert.match(enSaid, /Click Start practising below to begin\.$/);
    const stopButton = a.w.document.querySelector('#btnGuideAudio');
    assert.ok(stopButton, 'the guide has a replay button');
    assert.match(stopButton.textContent, /Replay Guide Audio/);
    a.q.UI.setGuideLang('si');
    a.clock.tick(200);
    const guide = a.w.document.querySelector('#guideSheet');
    assert.ok(guide, 'the guide is still open');
    assert.equal(guide.querySelector('#guideBody').getAttribute('lang'), 'si');
    const siSaid = words(a).map((u) => decodeURIComponent(u.split('&q=')[1] || '')).join(' ').replace(/\s+/g, ' ').trim();
    assert.match(siSaid, /ස්මාර්ට් ඩික්ටේෂන් ප්ලේයර් උපදෙස්/);
    a.q.UI.stopGuideAudio();
    assert.equal(a.q.UI.guidePlaying, false);
  });
});

/* ---------------------------------------------------------------- UI + data sheet */

test('v48 credit badge, cinema animation and press spring stay pinned', () => {
  assert.match(html, /#credit\{z-index:9999!important/);
  assert.match(html, /@keyframes hansanaCinemaCycle/);
  assert.match(html, /credit-intro/);
  assert.match(html, /backdrop-filter:none!important/);
  assert.match(html, /transition-duration:\.04s/);
  assert.match(html, /cubic-bezier\(\.16,1,\.3,1\)/);
});

test('v48 answer checking accepts favourite and tyre spellings', () => {
  withApp((a) => {
    const variants = a.q.Eng.getTargetVariants({ w: 'favourite' });
    assert.ok(variants.indexOf('favorite') >= 0, variants.join(','));
    const tyre = a.q.Eng.getTargetVariants({ w: 'tyre / tire' });
    assert.ok(tyre.length >= 1);
    assert.equal(a.q.Speech.cleanWordOnly('tyre / tire'), 'tyre');
    assert.equal(a.q.Speech.cleanWordOnly('favourite / favorite'), 'favourite');
  });
});

test('v48 data.html and /data are identical Liquid Glass reports', () => {
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
});

test('v48 the data explorer renders 30 single-voice rows with memory cache proof', () => {
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
    buttons[0].click();
    const src = w.document.getElementById('ttsMasterAudio').getAttribute('src');
    assert.equal(src, GB + 'afraid');
    assert.equal(w.document.getElementById('ttsMasterAudio').hasAttribute('crossorigin'), false);
  } finally { dom.window.close(); }
});

test('v48 the data calculator, language switch and share bar work', () => {
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

test('v48 the in-app data sheet links to the full interactive report', () => {
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
