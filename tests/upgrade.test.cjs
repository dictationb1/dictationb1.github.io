'use strict';
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
const KEY = 'sdp.v48_real_oxford_voice';
const APP = '5.4.0';
const OXFORD = 'https://ssl.gstatic.com/dictionary/static/sounds/20200429/';
const YOUDAO = 'https://dict.youdao.com/dictvoice?type=1&audio=';
const WORDS = ['afraid','amazed','amusing','annoyed','anxious','ashamed','awesome','boring','brilliant','challenging','charming','confident','confusing','cruel','curious','delighted','depressed','disappointed','embarrassing','enjoyable','excellent','excited','fantastic','favourite','frightened','friendly','generous','guilty','healthy','hungry'];

function withApp(fn, options) {
  const app = harness(undefined, options || {});
  try { return fn(app); } finally { app.close(); }
}
function mediaBefore(w, fail) {
  w.__media = { plays: [], loads: 0 };
  w.HTMLMediaElement.prototype.load = function () { if (this.id === 'ttsMasterAudio') { w.__media.loads += 1; } };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.play = function () {
    const el = this;
    if (el.id === 'ttsMasterAudio') {
      w.__media.plays.push({ src: String(el.getAttribute('src') || ''), rate: el.playbackRate, loads: w.__media.loads });
      if (fail) { if (el.onerror) { el.onerror(); } return; }
      w.setTimeout(function () { if (el.onended) { el.onended(); } }, 5);
    }
  };
}
function withMedia(fn, fail) {
  return withApp(fn, { before: function (w) { mediaBefore(w, fail); } });
}
function dataDom(file, url) {
  const source = read(file);
  const dom = new JSDOM(source, { url: url || 'https://dictationb1.github.io/data.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.play = function () { const el = this; w.setTimeout(function () { if (el.onended) { el.onended(); } }, 5); };
  w.print = function () {};
  w.open = function () { return null; };
  const script = Array.from(w.document.scripts).find((node) => !node.type).textContent;
  w.eval(script);
  return dom;
}

test('v48 static gates: compact ES5 app, no links, no generated audio', () => {
  assert.ok(Buffer.byteLength(html) < 430000, 'index.html stays below 430,000 bytes');
  assert.equal((html.match(/<link\b/gi) || []).length, 0);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  acorn.parse(script, { ecmaVersion: 5 });
  assert.equal(fs.existsSync(path.join(root, 'audio')), false);
  assert.equal(fs.existsSync(path.join(root, 'scripts/build-audio.cjs')), false);
  assert.equal(fs.existsSync(path.join(root, 'scripts/audio-manifest.json')), false);
  assert.equal(fs.existsSync(path.join(root, '.github/workflows/audio-pack.yml')), false);
  assert.equal(/11,232|11232/.test(html), false);
  assert.equal(/\.\/audio\//.test(html), false);
  assert.equal(/speechSynthesis\.speak|new\s+SpeechSynthesisUtterance/.test(script), false);
});

test('version, config and session JSON agree on the release contract', () => {
  for (const file of ['data/version.json', 'data/config.json', 'data/session.json']) {
    const doc = json(file);
    assert.equal(doc.ver, 48, file);
    assert.equal(doc.appVersion, APP, file);
    assert.equal(doc.settingsRev, 48, file);
    assert.equal(doc.schema, 48, file);
    assert.equal(doc.adminPin, '78987898', file);
  }
  const config = json('data/config.json');
  assert.equal(config.key, KEY);
  assert.equal(config.storageKey, KEY);
  assert.equal(config.tts.singleWordBase, OXFORD);
  assert.equal(config.tts.crossOrigin, false);
  assert.equal(config.tts.headlessErrorDelayMs, 50);
  assert.equal(config.tts.silenceBetweenRepeatsMs, 650);
  assert.equal(config.tts.numberToWordBeatMs, 150);
  assert.equal(config.tts.slowPlaybackRate, 0.72);
});

test('running app is 5.4.0 with safe defaults and the new storage key', () => {
  withApp(({ q, w }) => {
    assert.equal(q.APP_VERSION, APP);
    assert.equal(q.CONFIG.key, KEY);
    assert.equal(q.CONFIG.schema, 48);
    assert.equal(q.CONFIG.settingsRev, 48);
    assert.equal(q.CONFIG.adminPin, '78987898');
    assert.equal(q.DB.data.settingsRev, 48);
    assert.equal(q.DB.data.settings.mode, 'paper');
    assert.equal(q.DB.data.settings.writeFixed, 5);
    assert.equal(q.DB.data.settings.repeats, 2);
    assert.equal(q.DB.data.settings.activeVideoSrc, './assets/bunny-live-wallpaper.mp4');
    assert.ok(w.localStorage.getItem(KEY));
    assert.equal(w.SDP.version, APP);
    assert.equal(w.TTS, q.Speech);
  });
});

test('Session 8 keeps all 30 adjectives and rich bilingual learning data', () => {
  withApp(({ q }) => {
    const list = q.DB.defaults().lists[0];
    assert.equal(list.name, 'Session 8 - Personal Feelings, Opinions & Experiences (Adj)');
    assert.deepEqual(Array.from(list.words, (row) => row.w), WORDS);
    for (const row of list.words) {
      assert.ok(/[\u0250-\u02ff]/.test(row.p), row.w + ' UK IPA');
      assert.ok(/[\u0d80-\u0dff]/.test(row.si), row.w + ' Sinhala');
      assert.ok(row.m.length > 8 && row.s.split(' ').length > 4, row.w + ' definition and sentence');
      assert.equal(row.audio, OXFORD + row.w + '--_gb_1.mp3');
    }
    assert.equal(q.DB.data.session.no, '8');
    assert.equal(q.DB.data.session.date, '2026-10-29');
  });
});

test('Session 7 remains archived, complete and practiceable', () => {
  withApp(({ q, w }) => {
    const past = q.DB.data.pastSessions[0];
    assert.equal(past.title, 'Session 7 - Travel & Transport');
    assert.equal(past.words.length, 30);
    assert.equal(past.words[0].w, 'guidebook');
    q.Screens.home();
    assert.match(w.document.body.textContent, /Past Sessions/);
    assert.match(w.document.body.textContent, /Session 7 - Travel & Transport/);
    q.Eng.start({ list: { id: past.listId, name: past.title, words: past.words, published: true, version: 1 } });
    assert.equal(q.Eng.words.length, 30);
    q.Eng.stop(true);
  });
});

test('favourite/favorite and tyre/tire are accepted without fuzzy credit', () => {
  withApp(({ q }) => {
    assert.equal(q.Eng.isAnswerMatch('favorite', { w: 'favourite' }), true);
    assert.equal(q.Eng.isAnswerMatch('favourite', { w: 'favourite' }), true);
    assert.equal(q.Eng.isAnswerMatch('tire', { w: 'tyre' }), true);
    assert.equal(q.Eng.isAnswerMatch('tyre', { w: 'tyre' }), true);
    assert.equal(q.Eng.isAnswerMatch('favorit', { w: 'favourite' }), false);
  });
});

test('Oxford is primary for words and Youdao/Google are ordered fallbacks', () => {
  withApp(({ q }) => {
    const T = q.Speech;
    assert.equal(T.getSingleVoiceUrl('afraid'), OXFORD + 'afraid--_gb_1.mp3');
    assert.deepEqual(Array.from(T.getRealStudioUrls('afraid')), [OXFORD + 'afraid--_gb_1.mp3', YOUDAO + 'afraid']);
    for (const word of WORDS) { assert.equal(T.getSingleVoiceUrl(word), OXFORD + word + '--_gb_1.mp3'); }
    assert.deepEqual(Array.from(T.getRealStudioUrls('Number 1')), [YOUDAO + 'Number%201', 'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=en-GB&q=Number%201']);
    assert.equal(T.getSingleVoiceUrl('Three'), YOUDAO + 'Three');
    assert.match(T.getRealStudioUrls('Repeat this sentence')[1], /client=gtx&tl=en-GB&q=/);
    assert.match(T.getSingleVoiceUrl('ආයුබෝවන්', 'si'), /client=gtx&tl=si&q=/);
  });
});

test('master audio is persistent, unlocked markup with no crossOrigin attribute', () => {
  withApp(({ q, w }) => {
    const audio = q.Speech.master();
    assert.equal(audio, w.document.getElementById('ttsMasterAudio'));
    assert.equal(audio.getAttribute('preload'), 'auto');
    assert.equal(audio.hasAttribute('playsinline'), true);
    assert.equal(audio.getAttribute('referrerpolicy'), 'no-referrer');
    assert.equal(audio.hasAttribute('crossorigin'), false);
    assert.equal(q.Speech.supported, true);
  });
});

test('word cycle is Number, 150ms, Oxford, 650ms, then 0KB memory replay', () => {
  withMedia(({ q, w, clock }) => {
    let completed = false;
    const phases = [];
    q.Speech.speakWordCycle({ w: 'afraid' }, 0, function (ok) { completed = ok; }, function (pass) { phases.push(pass); });
    clock.tick(1000);
    const plays = w.__media.plays;
    assert.equal(completed, true);
    assert.deepEqual(phases, [1, 2]);
    assert.equal(plays.length, 3);
    assert.equal(plays[0].src, YOUDAO + 'Number%201');
    assert.equal(plays[1].src, OXFORD + 'afraid--_gb_1.mp3');
    assert.equal(plays[2].src, plays[1].src);
    assert.equal(plays[1].loads, 2, 'number and Oxford each load once');
    assert.equal(plays[2].loads, 2, 'pass 2 performs no new load');
    assert.equal(q.Speech._lastWordUrl, OXFORD + 'afraid--_gb_1.mp3');
  });
});

test('a late media error cannot cancel a URL that already started', () => {
  withApp(({ q, w, clock }) => {
    q.Speech.isHeadless = function () { return false; };
    w.HTMLMediaElement.prototype.load = function () {};
    w.HTMLMediaElement.prototype.pause = function () {};
    let plays = 0;
    w.HTMLMediaElement.prototype.play = function () {
      if (this.id === 'ttsMasterAudio') {
        plays += 1;
        if (this.onplaying) { this.onplaying(); }
        if (this.onerror) { this.onerror(); }
        w.setTimeout(() => { if (this.onended) { this.onended(); } }, 5);
      }
    };
    let result = null;
    q.Speech._playCandidates(q.Speech.getRealStudioUrls('Number 1'), 'prompt', q.Speech._seqToken, function (ok) { result = ok; }, 1);
    clock.tick(20);
    assert.equal(result, true);
    assert.equal(plays, 1, 'the started URL is not replaced by a fallback after a stale error');
  });
});

test('Slower replays the same Oxford element at 0.72 with preserved pitch', () => {
  withMedia(({ q, w, clock }) => {
    q.Speech.speakWordCycle({ w: 'afraid' }, 0, function () {});
    clock.tick(1000);
    q.Speech.replayMaster(0.72, function () {});
    clock.tick(20);
    const plays = w.__media.plays;
    assert.equal(plays.length, 4);
    assert.equal(plays[3].src, OXFORD + 'afraid--_gb_1.mp3');
    assert.equal(plays[3].rate, 0.72);
    assert.equal(plays[3].loads, 2);
    assert.equal(q.Speech.master().preservesPitch, true);
    assert.equal(q.Speech.master().webkitPreservesPitch, true);
  });
});

test('rolling preloads contain only the current and next Oxford words', () => {
  withApp(({ q }) => {
    q.Eng.words = q.DB.data.lists[0].words.slice();
    q.Eng.order = q.Eng.words.map(function (_, i) { return i; });
    assert.equal(q.Speech.preloadRollingWindow(0), 2);
    assert.deepEqual(Object.keys(q.Speech.audioCache).sort(), [OXFORD + 'afraid--_gb_1.mp3', OXFORD + 'amazed--_gb_1.mp3'].sort());
    assert.equal(q.Speech.preloadRollingWindow(1), 2);
    assert.equal(q.Speech.audioCache[OXFORD + 'afraid--_gb_1.mp3'], undefined);
    assert.ok(q.Speech.audioCache[OXFORD + 'amusing--_gb_1.mp3']);
    assert.equal(q.Speech.preloadSessionWords(), 0);
    assert.equal(q.Speech.preloadCoreAudio(), 0);
  });
});

test('HeadlessChrome/jsdom media errors finish after 50ms without device speech', () => {
  withMedia(({ q, clock }) => {
    let done = false;
    q.Speech.speakStudioText('Number 1', 'en', function (ok) { done = ok; });
    clock.tick(49);
    assert.equal(done, false);
    clock.tick(1);
    assert.equal(done, true);
  }, true);
});

test('Sinhala narration is streamed in sentence chunks of at most 160 chars', () => {
  withMedia(({ q, clock }) => {
    const seen = [];
    const original = q.Speech.getRealStudioUrls;
    q.Speech.getRealStudioUrls = function (value, lang) { seen.push({ value: value, lang: lang }); return original.call(this, value, lang); };
    q.Speech.speakStudioText(new Array(24).join('සිංහල වචන වාක්යය. '), 'si', function () {});
    clock.tick(5000);
    assert.ok(seen.length > 1);
    assert.ok(seen.every((part) => part.value.length <= 160 && part.lang === 'si'));
  });
});

test('ready sheet, credit animation and admin PIN retain the UI contract', () => {
  withMedia(({ q, w }) => {
    q.Eng.start({});
    const sheet = w.document.getElementById('readySheet');
    assert.ok(sheet);
    assert.match(sheet.textContent, /Click I'm ready to begin/);
    assert.match(sheet.textContent, /I'm ready/);
    assert.equal(/Skip countdown/.test(sheet.textContent), false);
    assert.equal(w.document.querySelectorAll('#layers .layer').length, 0);
    assert.match(html, /@keyframes hansanaCinemaCycle/);
    assert.match(html, /#credit\{[^}]*z-index:9999!important/);
    assert.equal(w.document.getElementById('credit').textContent.includes('CREDITS GOES TO Hansana'), true);
    q.Eng.stop(true);
    q.Admin.pad();
    assert.equal(w.document.getElementById('adminPinInput').maxLength, 8);
  });
});

test('data.html and /data are identical full Liquid Glass showcases', () => {
  const one = read('data.html');
  const two = read('data/index.html');
  assert.equal(one, two);
  for (const source of [one, two]) {
    assert.equal((source.match(/<link\b/gi) || []).length, 0);
    acorn.parse(source.match(/<script>([\s\S]*?)<\/script>/)[1], { ecmaVersion: 5 });
    assert.match(source, /id="bgLiveVideo" src="\.\/assets\/bunny-live-wallpaper\.mp4"/);
    assert.match(source, /backdrop-filter:none!important/);
    assert.match(source, /inset 0 1\.5px 1px rgba\(255,255,255,\.52\)/);
    assert.match(source, /@keyframes hansanaCinemaCycle/);
    assert.match(source, /🇬🇧 English/);
    assert.match(source, /🇱🇰 සිංහල/);
    assert.match(source, /Listen to Summary/);
    assert.match(source, /How much data will I use\?/);
    assert.match(source, /issues\/92/);
  }
});

test('data explorer renders 30 Oxford rows and working playback controls', () => {
  const dom = dataDom('data.html');
  try {
    const d = dom.window.document;
    assert.equal(d.querySelectorAll('#wordRows tr').length, 30);
    assert.equal(d.querySelectorAll('.play-word').length, 30);
    assert.equal(d.querySelector('#wordRows tr').getAttribute('data-word'), 'afraid');
    assert.equal(d.querySelector('#wordRows tr:last-child').getAttribute('data-word'), 'hungry');
    assert.equal(dom.window.TTS.getSingleVoiceUrl('afraid'), OXFORD + 'afraid--_gb_1.mp3');
    d.querySelector('.play-word').click();
    assert.equal(d.getElementById('ttsMasterAudio').getAttribute('src'), OXFORD + 'afraid--_gb_1.mp3');
    assert.equal(d.getElementById('ttsMasterAudio').hasAttribute('crossorigin'), false);
    assert.match(d.querySelector('#wordRows').textContent, /0 KB \(Memory Replay\)/);
  } finally { dom.window.close(); }
});

test('data language switch and calculator update the whole interactive report', () => {
  const dom = dataDom('data.html');
  try {
    const d = dom.window.document;
    d.getElementById('modeLite').click();
    d.getElementById('sessionsRange').value = '30';
    d.getElementById('sessionsRange').dispatchEvent(new dom.window.Event('input'));
    assert.equal(d.getElementById('totalMB').textContent, '0.625 MB');
    assert.equal(d.getElementById('savedMB').textContent, '13.78 MB');
    d.getElementById('langSi').click();
    assert.equal(d.documentElement.lang, 'si');
    assert.equal(d.body.className, 'si');
    assert.match(d.getElementById('listenSummary').textContent, /සාරාංශය/);
    assert.match(d.querySelector('.play-word').textContent, /Oxford/);
    assert.match(d.getElementById('totalCaption').textContent, /සැසි 30/);
    d.getElementById('langEn').click();
    assert.equal(d.documentElement.lang, 'en');
  } finally { dom.window.close(); }
});

test('data sharing, print, video toggle and /data asset paths are wired', () => {
  const dom = dataDom('data/index.html', 'https://dictationb1.github.io/data/');
  try {
    const d = dom.window.document;
    assert.match(d.getElementById('bgLiveVideo').src, /\/assets\/bunny-live-wallpaper\.mp4$/);
    assert.equal(d.getElementById('auditLink').href, 'https://github.com/dictationb1/dictationb1.github.io/issues/92');
    assert.equal(d.getElementById('openPlayer').href, 'https://dictationb1.github.io/');
    d.getElementById('videoToggle').click();
    assert.equal(d.getElementById('videoToggle').getAttribute('aria-pressed'), 'false');
    assert.match(d.getElementById('videoToggle').textContent, /OFF/);
    assert.ok(d.getElementById('copyLink') && d.getElementById('shareWa') && d.getElementById('printPage'));
  } finally { dom.window.close(); }
});
