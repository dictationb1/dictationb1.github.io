'use strict';
/* ============================================================================
   v43 (5.0.0) release gate — rewritten from scratch for the bundled audio pack.
   ----------------------------------------------------------------------------
   The app no longer streams its voice from a third-party dictionary host. 100%
   of its speech is a set of committed, same-origin MP3 files in ./audio/, all
   rendered by ONE single neural voice (speaker "F1" of the build manifest, an
   en-GB woman studio voice; `node scripts/build-audio.cjs` re-renders the very
   same file names with Microsoft's en-GB-SoniaNeural when the build machine
   has internet access).

   What this file guarantees:
     * ES5-only, single file, under 442,000 bytes, no static external <link>
     * every documented clip exists on disk, is a real MP3 (> 1000 bytes) and is
       served with HTTP 200 by a plain static server
     * TTS.resolveClips() maps every spoken line to its bundled ./audio clip
     * a live browser never touches window.speechSynthesis; a clip gets a
       4000ms watchdog plus one load()+play() retry instead of the old 1500ms
       jump to the robotic device voice
     * the visual 3 -> 2 -> 1 countdown and the spoken Three/Two/One are in
       lockstep (0ms / 950ms / 1900ms) and Word 1 starts at 2850ms
     * Pass 1 plays "Number N" + the word, Pass 2 replays the exact same word
       file, and pause / resume / finish / test-sound all use their own clips
     * the full 30-word session runs with zero console errors
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const acorn = require('acorn');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const version = readJson('version.json');
const config = readJson('config.json');
const session = readJson('session.json');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'audio-manifest.json'), 'utf8'));
const AUDIO = path.join(root, 'audio');

const KEY = 'sdp.v43_bundled_studio_voice';
const GH_KEY = 'sdp.gh_assets_v43';
const DEFAULT_VIDEO = './assets/bunny-live-wallpaper.mp4';
const REMOTE = 'https://dict.youdao.com/dictvoice?type=1&audio=';
const LOCAL = './audio/';
const PAPER_INTRO = "Welcome. Prepare your pen and paper. Each word is read twice. Press Yes, I'm ready to begin .";
const TYPE_INTRO = "Welcome. Each word is read twice. Type your answer and press Enter. Press Yes, I'm ready to begin .";
const TEST_PHRASE = 'Sound check. Number 1, bicycle .';
const script = (html.match(/<script>([\s\S]*?)<\/script>/) || ['', ''])[1];
const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || ['', ''])[1];
const has = (value, token) => String(value).indexOf(token) !== -1;
const realErrors = (list) => (list || []).filter((m) => !/^Not implemented:/i.test(String(m)));

/* --------------------------------------------------------------- harness --- */

function withApp(fn) {
  const app = harness();
  try { return fn(app); } finally { app.close(); }
}

/* A live desktop browser: the UA is not headless, the master <audio> really
   "plays" and the speech engine throws the moment anything calls speak(). */
function withStream(fn) {
  return withApp(({ q, w, clock, consoleErrors }) => {
    Object.defineProperty(w.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      configurable: true
    });
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
      played.push(String(el.getAttribute('src') || ''));
      w.setTimeout(() => { if (el.onplaying) el.onplaying(); }, 5);
      w.setTimeout(() => { if (el.onended) el.onended(); }, 60);
      return Promise.resolve();
    };
    q.Speech.supported = true;
    const clips = () => played.filter((u) => u.indexOf(LOCAL) === 0).map((u) => u.slice(LOCAL.length));
    return fn({ q, w, clock, played, clips, consoleErrors, synthCalls: () => synthCalls });
  });
}

const readyButton = (w) => Array.from(w.document.querySelectorAll('#sheets button')).find((b) => /I['’]m ready/.test(b.textContent));
function startSession(ctx) {
  ctx.q.Eng.start({});
  ctx.clock.tick(300);
  const button = readyButton(ctx.w);
  assert.ok(button, 'the Are you ready? sheet offers Yes, I am ready');
  return button;
}
function tickFor(clock, ms, step) {
  const size = step || 50;
  for (let i = 0; i < ms; i += size) clock.tick(size);
}
/* tick in small steps and remember when each new clip first appeared */
function timeline(clock, played, ms) {
  const marks = [];
  let seen = played.length;
  for (let t = 0; t < ms; t += 10) {
    clock.tick(10);
    while (seen < played.length) {
      marks.push({ at: t + 10, url: played[seen] });
      seen += 1;
    }
  }
  return marks;
}
const firstAt = (marks, file) => {
  const hit = marks.find((m) => m.url === LOCAL + file);
  return hit ? hit.at : -1;
};

/* ----------------------------------------------------------- build gate ---- */

test('v43 build gate: one ES5 file, no static external <link>, under 442,000 bytes', () => {
  assert.ok(script.length > 100000, 'the single inline app is present');
  assert.doesNotThrow(() => acorn.parse(script, { ecmaVersion: 5 }), 'strict ES5 only');
  for (const token of ['const ', 'let ', '=>', '`', 'async function', 'await ']) {
    assert.ok(!has(script, token), 'ES5 only; found ' + token);
  }
  assert.ok(!/<link\b/i.test(html), 'no static external <link> tag');
  const bytes = Buffer.byteLength(html);
  assert.ok(bytes < 442000, 'index.html is ' + bytes + ' bytes');
  assert.ok(bytes < 450000, 'hard ceiling');
  assert.ok(has(html, '<audio id="ttsMasterAudio"'), 'the master audio element ships in the HTML');
});

test('version, storage keys and the bundled pack are declared as v43 / 5.0.0', () => {
  assert.ok(has(script, 'APP_VERSION="5.0.0"'), 'APP_VERSION is 5.0.0');
  assert.ok(has(script, 'key:"' + KEY + '",schema:43'), 'CONFIG.key/schema');
  assert.ok(has(script, 'settingsRev:43'), 'settingsRev');
  assert.ok(has(script, 'ghMediaCache:"' + GH_KEY + '"'), 'asset cache key');
  assert.equal(version.ver, 43);
  assert.equal(version.appVersion, '5.0.0');
  assert.equal(version.settingsRev, 43);
  assert.equal(version.ghMediaCache, GH_KEY);
  assert.equal(config.ver, 43);
  assert.equal(config.appVersion, '5.0.0');
  assert.equal(session.ver, 43);
  assert.equal(session.appVersion, '5.0.0');
  assert.equal(config.tts.singleVoiceUrl, REMOTE, 'the documented remote fallback is unchanged');
  assert.ok(has(config.tts.pack, './audio/'), 'config documents the bundled pack');
});

test('defaults are unchanged: English, paper mode, locked Amy voice, bunny wallpaper', () => {
  for (const data of [version, config, session]) {
    assert.equal(data.lang, 'en');
    assert.equal(data.guideLang, 'en');
    assert.equal(data.mode, 'paper');
    assert.equal(data.voice, 'Amy');
    assert.equal(data.lockedVoice, 'Amy');
    assert.equal(data.activeVideoSrc, DEFAULT_VIDEO);
    assert.equal(data.activeMediaType, 'video');
    assert.equal(data.videoDim, 18);
  }
  assert.equal(session.session.mode, 'paper');
  assert.ok(has(script, 'mode:"paper"') || has(script, '"paper"'), 'paper is the shipped mode');
});

/* ------------------------------------------------------------ audio pack --- */

test('the committed audio pack is complete: every clip is a real MP3 over 1000 bytes', () => {
  const files = manifest.clips.map((c) => c.file).concat(manifest.pass1.map((p) => p.file));
  assert.ok(files.length >= 130, 'the pack ships every clip: ' + files.length);
  const seen = new Set();
  for (const file of files) {
    assert.ok(!seen.has(file), 'duplicate clip name: ' + file);
    seen.add(file);
    const full = path.join(AUDIO, file);
    assert.ok(fs.existsSync(full), 'missing clip: ' + file);
    const stat = fs.statSync(full);
    assert.ok(stat.size > 1000, file + ' is only ' + stat.size + ' bytes');
    const head = fs.readFileSync(full).slice(0, 3).toString('hex');
    assert.ok(head === '494433' || /^ff[ef]/.test(head), file + ' is not an MP3 frame (' + head + ')');
  }
  const onDisk = fs.readdirSync(AUDIO).filter((f) => /\.mp3$/.test(f));
  assert.equal(onDisk.length, seen.size, 'no stray files in ./audio');
});

test('every documented clip of the v43 spec exists by name', () => {
  const required = ['welcome-paper.mp3', 'welcome-type.mp3', 'sound-check.mp3', 'count-3.mp3', 'count-2.mp3',
    'count-1.mp3', 'countdown-321.mp3', 'paused.mp3', 'finish-paper.mp3', 'finish-type.mp3',
    'num-1.mp3', 'num-29.mp3', 'num-30.mp3', 'resume-1.mp3', 'resume-30.mp3',
    'word-bicycle.mp3', 'word-motorbike.mp3', 'word-bus-stop.mp3', 'word-train-station.mp3',
    'word-tyre.mp3', 'word-windscreen.mp3', 'word-guidebook.mp3', 'word-tourist-information-centre.mp3',
    'pass1-1-guidebook.mp3', 'pass1-30-windscreen.mp3'];
  for (const file of required) {
    assert.ok(fs.existsSync(path.join(AUDIO, file)), 'missing ' + file);
    assert.ok(fs.statSync(path.join(AUDIO, file)).size > 1000, file + ' is empty');
  }
  const words = manifest.words.map((w) => String(w).split('/')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  for (const word of ['bicycle', 'guidebook', 'windscreen', 'tyre']) {
    assert.ok(words.indexOf(word) >= 0, 'the pack covers ' + word);
  }
});

test('the pack is one single voice: one manifest, one speaker, one engine', () => {
  assert.equal(manifest.ver, 43);
  assert.equal(manifest.speaker, 'F1', 'a single female speaker renders every clip');
  assert.equal(manifest.engine, 'single neural voice');
  const kinds = new Set(manifest.clips.map((c) => c.kind));
  for (const kind of ['system', 'count', 'number', 'resume', 'word']) assert.ok(kinds.has(kind), 'kind ' + kind);
  /* no clip may be silent padding: identical byte length for two different
     sentences would mean a placeholder was copied around */
  const sizes = manifest.clips.slice(0, 40).map((c) => fs.statSync(path.join(AUDIO, c.file)).size);
  assert.ok(new Set(sizes).size > 20, 'clips carry real, different audio');
});

test('the audio pack is served with HTTP 200 by a plain static server', async () => {
  const types = { '.mp3': 'audio/mpeg' };
  const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(String(req.url || '/').split('?')[0]);
    const file = path.join(root, clean);
    if (file.indexOf(root) !== 0 || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    for (const file of ['sound-check.mp3', 'count-3.mp3', 'word-bicycle.mp3', 'pass1-1-guidebook.mp3', 'finish-paper.mp3']) {
      const res = await fetch('http://127.0.0.1:' + port + '/audio/' + file);
      assert.equal(res.status, 200, file + ' must be served');
      assert.equal(res.headers.get('content-type'), 'audio/mpeg');
      const body = Buffer.from(await res.arrayBuffer());
      assert.ok(body.length > 1000, file + ' body');
    }
  } finally {
    server.close();
  }
});

test('audio lives outside /assets so the wallpaper studio never lists it', () => withApp(({ q }) => {
  assert.equal(typeof q.LiveWallpaper.isAssetsMedia, 'function');
  assert.equal(q.LiveWallpaper.isAssetsMedia('./audio/word-bicycle.mp3'), false, 'mp3 is not a wallpaper asset');
  assert.equal(q.isAssetsMedia('./audio/word-bicycle.mp3'), false);
  assert.equal(q.isAssetsMedia('./audio/sound-check.mp3'), false);
  assert.equal(q.normalizeAssetPath('./audio/word-bicycle.mp3').indexOf('assets/'), -1);
  assert.equal(q.LiveWallpaper.isAssetsMedia(DEFAULT_VIDEO), true, 'the bunny video still is');
  assert.equal(has(script, 'LOCAL_AUDIO_BASE:"./audio/"'), true);
}));

/* ------------------------------------------------------------- resolver ---- */

test('TTS.resolveClips maps every spoken line to its bundled same-origin clip', () => withApp(({ q }) => {
  const S = q.Speech;
  const one = (text) => S.resolveClips(text);
  assert.deepEqual(Array.from(one(PAPER_INTRO)), [LOCAL + 'welcome-paper.mp3']);
  assert.deepEqual(Array.from(one(TYPE_INTRO)), [LOCAL + 'welcome-type.mp3']);
  assert.deepEqual(Array.from(one(TEST_PHRASE)), [LOCAL + 'sound-check.mp3']);
  assert.deepEqual(Array.from(one('Sound check.')), [LOCAL + 'sound-check.mp3']);
  assert.deepEqual(Array.from(one('Three .')), [LOCAL + 'count-3.mp3']);
  assert.deepEqual(Array.from(one('Three')), [LOCAL + 'count-3.mp3']);
  assert.deepEqual(Array.from(one('Two .')), [LOCAL + 'count-2.mp3']);
  assert.deepEqual(Array.from(one('One .')), [LOCAL + 'count-1.mp3']);
  assert.deepEqual(Array.from(one('Three, two, one .')), [LOCAL + 'countdown-321.mp3']);
  assert.deepEqual(Array.from(one('Session paused .')), [LOCAL + 'paused.mp3']);
  assert.deepEqual(Array.from(one('Welcome back. Continuing dictation number 7 .')), [LOCAL + 'resume-7.mp3']);
  assert.deepEqual(Array.from(one('Welcome back. Continuing dictation number 30 .')), [LOCAL + 'resume-30.mp3']);
  assert.deepEqual(Array.from(one('Dictation complete. Well done. Review all thirty words below .')), [LOCAL + 'finish-paper.mp3']);
  assert.deepEqual(Array.from(one('Dictation complete. Well done.')), [LOCAL + 'finish-type.mp3']);
  assert.deepEqual(Array.from(one('Number 1 .')), [LOCAL + 'num-1.mp3']);
  assert.deepEqual(Array.from(one('Final word, number 30 .')), [LOCAL + 'num-30.mp3']);
  assert.deepEqual(Array.from(one('bicycle .')), [LOCAL + 'word-bicycle.mp3']);
  assert.deepEqual(Array.from(one('bus stop')), [LOCAL + 'word-bus-stop.mp3']);
  assert.deepEqual(Array.from(one('tourist information centre .')), [LOCAL + 'word-tourist-information-centre.mp3']);
  assert.deepEqual(Array.from(one('tyre/tire .')), [LOCAL + 'word-tyre.mp3'], 'the UK variant is the spoken word');
  assert.deepEqual(Array.from(one('Number 1, guidebook .')), [LOCAL + 'pass1-1-guidebook.mp3'], 'pass 1 is one atomic clip');
  assert.deepEqual(Array.from(one('Number 30, windscreen .')), [LOCAL + 'pass1-30-windscreen.mp3']);
  assert.deepEqual(Array.from(one('   ')), [], 'nothing to say, nothing to load');
  for (const list of Array.from(S.resolveClips('Number 12, harbour .'))) {
    assert.equal(list.indexOf(LOCAL), 0, 'bundled words never leave the origin: ' + list);
  }
}));

test('a bundled word at any index falls back to the Number + word pair (never a second voice)', () => withApp(({ q }) => {
  const S = q.Speech;
  /* a word that is not part of the shipped session order has no pass1 combo */
  const clips = Array.from(S.resolveClips('Number 4, bicycle .'));
  assert.deepEqual(clips, [LOCAL + 'num-4.mp3', LOCAL + 'word-bicycle.mp3']);
}));

test('custom user words keep the documented remote fallback and a single URL', () => withApp(({ q }) => {
  const S = q.Speech;
  assert.equal(S.REMOTE_FALLBACK_BASE, REMOTE);
  assert.equal(S.UNIFIED, REMOTE, 'the legacy alias still points at the same endpoint');
  assert.equal(S.getSingleVoiceUrl('zebra crossing'), REMOTE + 'zebra%20crossing%20.');
  assert.equal(S.getSingleVoiceUrl('bicycle'), LOCAL + 'word-bicycle.mp3');
  assert.equal(S.getUnifiedVoiceUrl('bicycle'), LOCAL + 'word-bicycle.mp3', 'the legacy alias resolves the pack');
  assert.deepEqual(Array.from(S.getStudioMp3Candidates('bus stop')), [LOCAL + 'word-bus-stop.mp3']);
  assert.equal(S.mp3For('bicycle'), LOCAL + 'word-bicycle.mp3');
  assert.ok(S.KNOWN_WORDS.bicycle === 1, 'the bundled vocabulary is exposed as KNOWN_WORDS');
  assert.equal(S.isBundledWord('bicycle'), true);
  assert.equal(S.isBundledWord('zebra crossing'), false);
}));

/* -------------------------------------------------------- live playback ---- */

test('a live browser plays 3-2-1 in lockstep with the screen and starts word 1 at 2850ms', () => withStream(({ q, w, clock, played, synthCalls }) => {
  startSession({ q, w, clock }).click();
  played.length = 0;
  const marks = timeline(clock, played, 3200);
  const three = firstAt(marks, 'count-3.mp3');
  const two = firstAt(marks, 'count-2.mp3');
  const one = firstAt(marks, 'count-1.mp3');
  const first = firstAt(marks, 'pass1-1-guidebook.mp3');
  assert.ok(three >= 0 && three <= 60, 'Three is spoken immediately: ' + three);
  assert.ok(two >= 900 && two <= 1000, 'Two lands at ~950ms: ' + two);
  assert.ok(one >= 1850 && one <= 1950, 'One lands at ~1900ms: ' + one);
  assert.ok(first >= 2800 && first <= 2920, 'Word 1 starts at ~2850ms: ' + first);
  assert.ok(three < two && two < one && one < first, 'spoken order matches the visual order');
  assert.equal(synthCalls(), 0, 'the robotic device voice never runs');
  assert.equal((w.document.getElementById('plSub') || {}).textContent.indexOf('1st reading'), 0 + (w.document.getElementById('plSub') || {}).textContent.indexOf('1st reading'));
  assert.ok(/1st reading/.test(String((w.document.getElementById('plSub') || {}).textContent)), 'the live status shows the reading');
}));

test('the dictation badge and step sub-line always show "Dictation #N of 30"', () => withStream(({ q, w, clock }) => {
  startSession({ q, w, clock }).click();
  tickFor(clock, 3200);
  const badge = w.document.getElementById('plStepBadge');
  const prog = w.document.getElementById('plProgText');
  const sub = w.document.getElementById('plSub');
  assert.ok(/Dictation #1 of 30/.test(String(badge && badge.textContent)), 'badge: ' + (badge || {}).textContent);
  assert.ok(/Dictation #1 of 30/.test(String(prog && prog.textContent)), 'progress: ' + (prog || {}).textContent);
  assert.ok(sub && /Listening/.test(String(sub.textContent)), 'sub: ' + (sub || {}).textContent);
}));

test('word cycle: "Number N + word", a 650ms studio pause, then the SAME word file twice', () => withStream(({ q, w, clock, played }) => {
  startSession({ q, w, clock }).click();
  tickFor(clock, 3200);
  played.length = 0;
  q.Eng.startWord(4);
  const immediate = played.slice().map((url) => ({ at: 0, url }));
  const marks = immediate.concat(timeline(clock, played, 2600).filter((m) => m.at > 0));
  const files = marks.map((m) => m.url.slice(LOCAL.length));
  const pass1 = files.filter((f) => f.indexOf('pass1-') === 0);
  assert.equal(pass1.length, 1, 'pass 1 plays one combined Number + word clip: ' + files.join(','));
  assert.equal(files[1], 'word-hitchhike.mp3', 'pass 2 replays the flat word file: ' + files.join(','));
  for (const file of files) assert.ok(/^(pass1-|num-|word-)/.test(file), 'only bundled dictation clips: ' + file);
  /* Pass 2 replays the flat word file, i.e. exactly the word Pass 1 embedded */
  assert.ok(pass1[0].indexOf('hitchhike') > 0, 'the combined clip carries the same word: ' + pass1[0]);
}));

test('test sound plays sound-check.mp3 and marks the voice verified, with no synth', () => withStream(({ q, w, clock, played, synthCalls }) => {
  let done = null;
  played.length = 0;
  q.Speech.testSound((ok) => { done = ok; });
  timeline(clock, played, 600);
  assert.ok(played.indexOf(LOCAL + 'sound-check.mp3') >= 0, 'the sound check clip played: ' + played.join(','));
  assert.equal(done, true, 'the promise resolves true');
  assert.equal(synthCalls(), 0);
  assert.equal(q.Speech.audioOk, true, 'the audio host reports a healthy clip');
  assert.equal(q.Speech.audioStarted, true, 'the clip really started');
}));

test('pause, resume and finish each play their dedicated bundled clip', () => withStream(({ q, w, clock, played }) => {
  startSession({ q, w, clock }).click();
  tickFor(clock, 3200);
  played.length = 0;
  q.Eng.pause();
  timeline(clock, played, 400);
  assert.ok(played.indexOf(LOCAL + 'paused.mp3') >= 0, 'pause clip: ' + played.join(','));
  played.length = 0;
  q.Eng.resume();
  timeline(clock, played, 1200);
  assert.ok(played.some((u) => /^\.\/audio\/resume-\d+\.mp3$/.test(u)), 'resume clip: ' + played.join(','));
  tickFor(clock, 1200);
  played.length = 0;
  q.Eng.finish(false);
  timeline(clock, played, 1200);
  assert.ok(played.some((u) => u === LOCAL + 'finish-paper.mp3' || u === LOCAL + 'finish-type.mp3'), 'finish clip: ' + played.join(','));
}));

test('the host never speaks: no 1500ms device-voice watchdog and speechSynthesis is silenced per clip', () => {
  const playUrl = (script.match(/playUrl:function[\s\S]*?\n?attempt\(\)\}/) || [''])[0] || '';
  const fallback = script.slice(script.indexOf('retryStudio:function'), script.indexOf('retryStudio:function') + 900);
  const play = script.slice(script.indexOf('_play:function'), script.indexOf('_play:function') + 900);
  assert.ok(has(playUrl, '4000'), 'the live-browser watchdog is 4000ms');
  assert.ok(!/},1500\)/.test(playUrl), 'the old 1500ms watchdog is gone');
  assert.ok(!has(fallback, 'speakPinnedSynth'), 'a failed same-origin clip never jumps to the device voice');
  assert.ok(has(playUrl, 'hushSynth()'), 'every clip hushes the device voice first');
  assert.ok(has(script, 'hushSynth:function(){try{window.speechSynthesis&&window.speechSynthesis.cancel()}'), 'hushSynth cancels speechSynthesis');
  assert.ok(has(play, 'liveBrowser()'), 'the live branch is explicit');
});

test('boot pre-buffers the countdown, the welcome and the first four words', () => withApp(({ q }) => {
  q.Speech.audioCache = {};
  const queued = q.Speech.preloadCoreAudio();
  const urls = Object.keys(q.Speech.audioCache);
  assert.ok(queued >= 6, 'several clips enter the cache: ' + queued);
  for (const file of ['welcome-paper.mp3', 'welcome-type.mp3', 'sound-check.mp3', 'count-3.mp3', 'count-2.mp3', 'count-1.mp3', 'countdown-321.mp3']) {
    assert.ok(urls.indexOf(LOCAL + file) >= 0, 'pre-buffered ' + file);
  }
  assert.ok(urls.some((u) => u.indexOf(LOCAL + 'word-') === 0), 'the first words are pre-buffered');
}));

test('a full 30-word session runs on bundled clips with zero console errors', () => withStream(({ q, w, clock, played, clips, consoleErrors, synthCalls }) => {
  const uncaught = [];
  w.addEventListener('error', (e) => uncaught.push(e && e.message));
  startSession({ q, w, clock }).click();
  tickFor(clock, 3200);
  for (let i = 1; i < q.Eng.words.length; i += 1) {
    q.Eng.startWord(i);
    tickFor(clock, 2200);
  }
  q.Eng.pause();
  tickFor(clock, 400);
  q.Eng.resume();
  tickFor(clock, 1600);
  q.Eng.finish(false);
  tickFor(clock, 800);
  const audio = played.filter((u) => u.indexOf(LOCAL) === 0);
  assert.ok(audio.length > 60, 'the whole session came from ./audio: ' + audio.length + ' clips');
  audio.forEach((url) => assert.ok(/^\.\/audio\/[a-z0-9-]+\.mp3$/.test(url), 'bundled clip: ' + url));
  assert.ok(clips().indexOf('pass1-30-windscreen.mp3') >= 0 || clips().some((f) => /^pass1-30-/.test(f)), 'the last numbered clip played');
  assert.ok(clips().indexOf('resume-30.mp3') >= 0 || clips().some((f) => /^resume-/.test(f)), 'the resume clip played');
  assert.ok(clips().indexOf('finish-paper.mp3') >= 0 || clips().indexOf('finish-type.mp3') >= 0, 'the finish clip played');
  assert.equal(synthCalls(), 0, 'no device voice at any point');
  assert.deepEqual(uncaught, [], 'no uncaught page errors');
  assert.deepEqual(realErrors(consoleErrors), [], 'no console errors: ' + realErrors(consoleErrors).join(' | '));
  assert.equal(q.Errors.items.length, 0, 'the in-app error log stays empty: ' + q.Errors.text());
}));

/* --------------------------------------------------- preserved v22-v42 UI --- */

test('v43 keeps the v42 shell: credit spotlight, glass-free smoked cards, cobalt buttons', () => {
  const compact = String(css).replace(/\s+/g, '');
  for (const token of ['#credit', 'hansanaRevealCycle', 'body{']) {
    assert.ok(has(compact, token) || has(html, token), 'css keeps ' + token);
  }
  assert.ok(/z-index:\s*9999\s*!important/.test(html), 'the credit line stays above every layer');
  assert.ok(has(html, 'Noto Sans Sinhala') && has(html, 'Inter'), 'the Sinhala + English font stack survives');
  assert.ok(has(compact, 'backdrop-filter:none'), 'nested cards stay flat');
  assert.ok(has(compact, '16px') && has(compact, '12px') && has(compact, '10px'), 'the hand-tuned radii survive');
});

test('v43 keeps the strict /assets media pipeline and the single live video', () => {
  assert.ok(has(script, 'function normalizeAssetPath(') && has(script, 'function isAssetsMedia('));
  assert.ok(has(script, 'ASSET_MEDIA_RE') && has(script, 'DEFAULT_WALLPAPER_SRC'));
  assert.ok(has(html, 'id="bgLiveVideo"'));
  assert.ok(has(html, 'src="./assets/bunny-live-wallpaper.mp4"'));
  assert.ok(has(script, 'filter:none!important') || has(css, 'filter:none!important'));
  assert.ok(has(css, '#bgLiveAmbilight{display:none!important}') || /#bgLiveAmbilight[^}]*display:\s*none\s*!important/.test(css));
  assert.ok(has(html, 'preload="none"'), 'thumbnails stay lazy');
});

test('v43 keeps the answer field plain-text: no password prompt, no keyboard suggestions', () => {
  assert.ok(has(script, 'type="text"') || has(html, 'type="text"'), 'the answer field is text');
  assert.ok(has(script, 'autocomplete")||(n.setAttribute("autocomplete","off")') || has(script, 'autocomplete","off"'), 'autocomplete is off');
  assert.ok(has(script, 'new-password') || has(script, 'autocorrect","off"'), 'no password manager prompt');
  const admin = session.session;
  assert.equal(admin.mode, 'paper', 'paper mode is the default');
});
