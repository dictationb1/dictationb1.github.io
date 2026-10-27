'use strict';

/* v30 release gates: the bunny video is the 100% default, every repo video and
   photo is auto-discovered with a real thumbnail, no invented fallback cards
   exist, words stay readable over any wallpaper, plus every v22-v29 dictation,
   typing, search, credit, guide and 120 FPS regression gate. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const acorn = require('acorn');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const json = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const version = json('version.json');
const config = json('config.json');
const session = json('session.json');
const key = 'sdp.v30_studio';
const DEFAULT = './assets/bunny-live-wallpaper.mp4';
const title = 'Session 7 - Travel & Transport';
const words = ['guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration',
  'journey', 'luggage', 'machine', 'mechanic', 'nationality', 'on business', 'on vacation',
  'overnight', 'passenger', 'public transport', 'reception', 'reservation', 'road sign',
  'signpost', 'spaceship', 'suitcase', 'tourist information centre', 'traffic lights',
  'tunnel', 'tyre/tire', 'vehicle', 'visa', 'waiting room', 'windscreen'];
const has = (s) => assert.ok(html.includes(s), 'missing ' + s);
const lacks = (s) => assert.ok(!html.includes(s), 'unexpected ' + s);
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
function cssRule(selector) {
  const pos = css.indexOf(selector + '{');
  assert.ok(pos >= 0, 'CSS rule exists: ' + selector);
  return css.slice(pos, css.indexOf('}', pos) + 1);
}
function click(a, node) {
  assert.ok(node, 'button exists');
  node.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function enterType(a) {
  a.q.DB.data.settings.mode = 'type';
  a.q.Eng.start({});
  a.clock.tick(50);
  return a.w.document;
}
function playing(a) {
  const doc = enterType(a);
  const skip = Array.from(doc.querySelectorAll('#sheets button')).find((b) => b.textContent.trim() === 'Skip countdown');
  click(a, skip);
  a.clock.tick(4000);
  assert.ok(doc.getElementById('ansInput'));
  return doc;
}
function typeChar(a, input, char) {
  input.value = ' ' + char;
  input.dispatchEvent(new a.w.Event('input', { bubbles: true }));
}
/* GitHub contents API + recursive tree API, both with realistic response shapes. */
function stubGitHub(a, tree, contents) {
  const calls = [];
  a.w.XMLHttpRequest = function () {
    this.open = function (m, u) { calls.push(String(u)); this._u = String(u); };
    this.setRequestHeader = function () {};
    this.send = function () {
      this.readyState = 4;
      this.status = 200;
      this.responseText = JSON.stringify(this._u.indexOf('/contents/assets') >= 0 ? (contents || []) : { tree: tree || [] });
      if (this.onreadystatechange) this.onreadystatechange();
    };
    this.abort = function () {};
  };
  return calls;
}
function trackedMedia() {
  let out = [];
  try {
    out = cp.execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split('\n').filter((p) => /\.(mp4|webm|mov|m4v|webp|jpe?g|png|gif|avif)$/i.test(p));
  } catch (e) { out = []; }
  return out;
}


test('single-file app remains strict ES5, self-contained, and under 440KB', () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  acorn.parse(script, { ecmaVersion: 5 });
  assert.ok(Buffer.byteLength(html) < 440000, 'actual bytes: ' + Buffer.byteLength(html));
  assert.doesNotMatch(html, /<link\b|<script[^>]+src=|@import/i);
  assert.doesNotMatch(script, /\b(?:const|let)\s|=>|\basync\s+function|\bawait\s|`/);
  assert.doesNotMatch(css, /\.glass\{[^}]*\bcontain\s*:/);
});

test('v30 metadata, bunny default, paper mode and resetToV30 migration preserve learner data', () => {
  for (const d of [version, config, session]) {
    assert.ok(Number(d.ver) >= 30);
    assert.equal(d.settingsRev, 30);
    assert.equal(d.appVersion, '3.8.0');
    assert.equal(d.version, '3.8.0');
    assert.equal(d.mode, 'paper');
    assert.equal(d.activeVideoSrc, DEFAULT);
    assert.equal(d.activeMediaType, 'video');
    assert.equal(d.videoPlaylistMode, 'loop');
    assert.ok(!('swan' in d));
    assert.deepEqual(d.repoFallbacks, []);
    assert.ok(Array.isArray(d.repoMedia) && d.repoMedia.length >= 1);
    assert.equal(d.repoMedia[0].src, DEFAULT);
    assert.equal(d.repoMedia[0].type, 'video');
  }
  assert.equal(config.storageKey, key);
  assert.equal(config.defaults.mode, 'paper');
  assert.equal(config.defaults.wallpaperVideo, true);
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.activeVideoSrc, DEFAULT);
  assert.equal(config.defaults.activeMediaType, 'video');
  assert.equal(config.defaults.videoPlaylistMode, 'loop');
  assert.equal(config.defaults.videoDim, 34);
  has('var APP_VERSION="3.8.0"');
  has('var DEFAULT_WALLPAPER_SRC="./assets/bunny-live-wallpaper.mp4"');
  has('key:"' + key + '"');has('schema:30');has('settingsRev:30');has('resetToV30:function');
  has('data-mode="paper" aria-selected="true"');has('Listen &amp; write on paper');
  const a = harness();
  try {
    assert.equal(a.q.CONFIG.key, key);
    assert.equal(a.q.CONFIG.schema, 30);
    assert.equal(a.q.CONFIG.settingsRev, 30);
    assert.equal(a.q.CONFIG.repoFallbacks.length, 0);
    assert.equal(a.q.DB.data.settingsRev, 30);
    assert.equal(a.q.DB.data.v, 30);
    assert.equal(a.q.DB.data.settings.mode, 'paper');
    assert.equal(a.q.DB.defaults().settings.mode, 'paper');
    assert.equal(a.q.DB.defaults().settings.activeVideoSrc, DEFAULT);
    assert.equal(a.q.DB.data.settings.wallpaperVideo, true);
    assert.equal(a.q.DB.data.settings.videoPlaylistMode, 'loop');
    assert.equal(a.q.DB.data.settings.activeMediaType, 'video');
    assert.equal(a.q.DB.data.settings.videoDim, 34);
    assert.equal(a.q.CONFIG.repoMedia[0].src, DEFAULT);
    assert.equal(a.w.LiveWallpaper.mediaList[0].src, DEFAULT);
    assert.ok(a.w.localStorage.getItem(key));

    /* A v27 learner is migrated straight to v30 with the paper + bunny default. */
    const old = JSON.parse(JSON.stringify(a.q.DB.data));
    old.v = 27;old.settingsRev = 27;old.settings.mode = 'type';
    old.settings.activeVideoSrc = './a-video-that-does-not-exist.mp4';
    old.profile.nickname = 'Returning learner';old.admin.pinHash = 'already-changed';
    old.history = [{ id: 'saved-history', wordCount: 30 }];
    old.lists.push({ id: 'custom-list', name: 'Lecture', published: true, words: [{ w: 'custom' }] });
    old.plan.pinned = 'custom-list';
    const raw = JSON.stringify(old);
    a.w.localStorage.clear();
    a.w.localStorage.setItem('sdp.v27_clean_fast', raw);
    a.w.localStorage.setItem('sdp.v27_clean_fast.bak', raw);
    a.q.DB.load();
    const saved = JSON.parse(a.w.localStorage.getItem(key));
    assert.equal(saved.v, 30);assert.equal(saved.settingsRev, 30);
    assert.equal(saved.settings.mode, 'paper');
    assert.equal(saved.settings.wallpaperVideo, true);
    assert.equal(saved.settings.activeVideoSrc, DEFAULT);
    assert.equal(saved.settings.activeMediaType, 'video');
    assert.equal(saved.settings.videoPlaylistMode, 'loop');
    assert.equal(saved.settings.videoDim, 34);
    assert.equal(saved.profile.nickname, 'Returning learner');
    assert.equal(saved.admin.pinHash, 'already-changed');
    assert.equal(saved.history[0].id, 'saved-history');
    assert.ok(saved.lists.some((list) => list.id === 'custom-list' && list.words[0].w === 'custom'));
    assert.ok(saved.lists.some((list) => list.id === 'list_session_7_travel'));
    assert.equal(saved.plan.pinned, 'custom-list');
    assert.equal(JSON.parse(a.w.localStorage.getItem(key + '.bak')).profile.nickname, 'Returning learner');

    /* The v29 storage key is a first-class legacy source; user choices survive. */
    const v29 = JSON.parse(JSON.stringify(a.q.DB.data));
    v29.v = 29;v29.settingsRev = 29;v29.settings.mode = 'type';
    v29.profile.nickname = 'V29 learner';
    a.w.localStorage.clear();
    a.w.localStorage.setItem('sdp.v29_gh_videos', JSON.stringify(v29));
    a.q.DB.load();
    assert.equal(a.q.DB.data.v, 30);
    assert.equal(a.q.DB.data.settingsRev, 30);
    assert.equal(a.q.DB.data.settings.mode, 'type');
    assert.equal(a.q.DB.data.settings.activeVideoSrc, DEFAULT);
    assert.equal(a.q.DB.data.profile.nickname, 'V29 learner');

    saved.settings.mode = 'type';saved.settings.wallpaperVideo = false;
    assert.equal(a.q.DB.migrate(saved).settings.mode, 'type', 'v30 user choice persists');
    assert.equal(a.q.DB.migrate(saved).settings.wallpaperVideo, false, 'wallpaper-off choice persists');
  } finally { a.close(); }
});

test('corrupt v28 primary recovers from the rolling backup and reaches v30', () => {
  const a = harness();
  try {
    const old = JSON.parse(JSON.stringify(a.q.DB.data));
    old.v = 28;old.settingsRev = 28;old.profile.nickname = 'Backup learner';
    a.w.localStorage.clear();
    a.w.localStorage.setItem('sdp.v28_live_video', '{broken');
    a.w.localStorage.setItem('sdp.v28_live_video.bak', JSON.stringify(old));
    a.q.DB.load();
    assert.equal(a.q.DB.data.profile.nickname, 'Backup learner');
    assert.equal(a.w.localStorage.getItem(key + '.recovery'), '{broken');
    assert.equal(a.q.DB.data.settingsRev, 30);
    assert.equal(a.q.DB.data.settings.activeVideoSrc, DEFAULT);
  } finally { a.close(); }
});

test('Session 7 has all 30 ordered words, five seconds, two repeats and Amy en-GB', () => {
  assert.deepEqual(session.lists[0].words.map((w) => w.w), words);
  assert.equal(session.session.title, title);
  assert.equal(config.defaults.writeMode, 'fixed');
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.sentence, false);
  assert.match(config.tts.primary, /Amy.*en-GB/);
  assert.equal(config.dataSaving.audioReuse, true);
  assert.equal(require('./test-pin.cjs'), '7898');
  has('voice=Amy');
  const a = harness();
  try {
    assert.equal(a.q.SAMPLE_WORDS.length, 30);
    assert.equal(a.q.Lib.current().words.length, 30);
    a.q.Eng.start({});
    const beats = a.q.Eng.buildBeats(0);
    assert.equal(beats.filter((b) => b.isWord).length, 2);
    assert.equal(beats.filter((b) => b.isSentence).length, 0);
    assert.equal(beats.find((b) => b.t === 'write').secs, 5);
    assert.ok(beats.filter((b) => b.isWord).every((b) => b.text === 'guidebook'));
    assert.match(a.q.Speech.amyUrl('guidebook'), /voice=Amy/);
  } finally { a.close(); }
});

test('speech repeats reuse the prepared audio element source', () => {
  const a = harness();
  try {
    let source = '', sets = 0, plays = 0;
    const audio = { readyState: 4, currentTime: 0, canPlayType() { return 'probably'; }, pause() {},
      play() { plays++; this.currentTime = 0.5; if (this.onplaying) this.onplaying(); } };
    Object.defineProperty(audio, 'src', { get() { return source; }, set(v) { sets++; source = v; } });
    a.q.Speech.el = () => audio;
    const src = a.q.Speech.amyUrl('guidebook');
    let ended = 0;
    a.q.Speech.playOnce(src, 0.88, 6000, (ok) => { if (ok) ended++; });audio.onended();
    a.q.Speech.playOnce(src, 0.88, 6000, (ok) => { if (ok) ended++; });audio.onended();
    assert.equal(sets, 1);assert.equal(plays, 2);assert.equal(ended, 2);
  } finally { a.close(); }
});

test('v30 stage: bunny video first, photo layers, contrast scrim, canvas and real GitHub media', () => {
  assert.match(cssRule('#bgLiveWrap'), /position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;overflow:hidden/);
  assert.match(cssRule('#bgLiveWrap'), /contain:strict/);
  assert.match(cssRule('#bgLiveAmbilight'), /inset:-48px;width:calc\(100vw \+ 96px\);height:calc\(100vh \+ 96px\)/);
  assert.match(cssRule('#bgLiveAmbilight'), /filter:blur\(34px\) saturate\(1\.55\) brightness\(\.68\)|filter:blur\(34px\) saturate\(1\.55\) brightness\(0\.68\)/);
  assert.match(cssRule('#app'), /position:relative;z-index:2;background:transparent!important/);
  assert.match(cssRule('body.wallpaper-on .glass,body.wallpaper-on[data-perf=lite] .glass'), /background-color:var\(--glass-tint\)/);
  assert.match(cssRule('.credit'), /z-index:9999!important/);
  assert.match(cssRule('#bgLiveCanvas'), /z-index:2/);
  assert.match(cssRule('#bgContrastScrim'), /z-index:1/);
  assert.match(cssRule('#bgContrastScrim'), /var\(--bg-dim, 0\.34\)/);
  assert.match(cssRule('#bgLiveVideo'), /z-index:0/);
  assert.match(cssRule('#bgLivePhoto'), /animation:photoBreathe/);
  assert.match(html, /body\[data-theme="light"\] #bgContrastScrim\{[^}]*rgba\(232, 236, 244/);
  assert.match(html, /body\[data-theme="dark"\]\{--glass-tint:rgba\(8, 13, 28, \.64\);--inset-hi:rgba\(255, 255, 255, \.48\)\}/);
  assert.match(html, /body\[data-theme="dark"\] \.card,body\[data-theme="dark"\] \.listrow,body\[data-theme="dark"\] \.wordcard\{text-shadow:/);
  assert.match(html, /#lgStage \.chip-a\{top:12px;left:12px\}/);
  assert.match(html, /#lgStage \.chip-b\{bottom:12px;right:12px\}/);
  for (const token of ['swanMasterPath', 'window.SwanStage', '一筆白鳥', '墨', 'bgSwanVideo', 'swan-ink-canvas', 'Fallback path', '☁ Fallback']) lacks(token);
  for (const token of ['id="bgLiveWrap"', 'id="bgLiveAmbilight"', 'id="bgLiveVideo"', 'id="bgLivePhoto"',
    'id="bgLivePhotoAmbilight"', 'id="bgContrastScrim"', 'id="bgLiveCanvas"', 'id="btnLiveVideo"',
    'id="liveVideoInput"', 'id="btnScanGhVideos"', 'id="btnPickVideoFile"', 'id="sVideoDim"',
    'id="galMediaTpl"', 'id="dimTpl"', 'class="gal-thumb"', '#t=1.2', 'preload="metadata"',
    'loading="lazy"', 'var DEFAULT_WALLPAPER_SRC', './assets/bunny-live-wallpaper.mp4',
    './bunny-live-wallpaper.mp4', './assets/bunny-poster.webp', 'video-gallery-list',
    'repoMedia', 'mediaList', 'discoverGitHubMedia', 'contents/assets', 'openGallerySheet',
    'window.LiveWallpaper', 'init:function', 'fitVideo:function', 'wake:function', 'onClick:function',
    'onSwipe:function', 'pulseAudio:function', 'celebrateStreak:function', 'loadCustomFile:function',
    'encodeURI(', 'item.path', 'sdp.gh_media_v30', 'sdp_wallpaper_db']) has(token);
  assert.ok(fs.statSync(path.join(root, 'assets', 'bunny-live-wallpaper.mp4')).size > 10000);
  assert.ok(fs.statSync(path.join(root, 'assets', 'bunny-poster.webp')).size > 1000);
  const a = harness();
  try {
    const doc = a.w.document, lw = a.w.LiveWallpaper, stage = doc.getElementById('bgLiveWrap');
    assert.ok(lw);assert.equal(typeof lw.init, 'function');
    assert.equal(stage.previousElementSibling.id, 'bg');
    assert.equal(stage.nextElementSibling.id, 'liveVideoInput');
    assert.equal(stage.getAttribute('aria-hidden'), 'true');
    for (const id of ['bgLiveCanvas', 'bgLiveVideo', 'bgLiveAmbilight', 'bgLivePhoto', 'bgLivePhotoAmbilight', 'bgContrastScrim'])
      assert.equal(doc.getElementById(id).parentElement, stage, id + ' is inside #bgLiveWrap');
    assert.equal(doc.getElementById('bgLiveAmbilight').getAttribute('aria-hidden'), 'true');
    assert.equal(doc.getElementById('bgLiveAmbilight').getAttribute('preload'), 'metadata');
    assert.equal(doc.getElementById('bgLivePhoto').getAttribute('aria-hidden'), 'true');
    assert.equal(doc.getElementById('bgLivePhoto').getAttribute('alt'), '');
    assert.equal(doc.getElementById('bgContrastScrim').getAttribute('aria-hidden'), 'true');
    assert.equal(doc.querySelectorAll('#bgLiveVideo source').length, 2, 'only real paths, no invented fallbacks');
    assert.equal(doc.querySelector('#bgLiveVideo source').getAttribute('src'), DEFAULT);
    assert.equal(doc.querySelectorAll('#bgLiveVideo source')[1].getAttribute('src'), './bunny-live-wallpaper.mp4');
    assert.equal(doc.getElementById('bgLiveVideo').muted, true);
    assert.equal(doc.getElementById('bgLiveVideo').loop, true);
    assert.equal(doc.getElementById('bgLiveVideo').getAttribute('preload'), 'auto');
    assert.match(lw.video.getAttribute('src') || lw.video.src, /bunny-live-wallpaper\.mp4/, 'boot loads the default video');
    assert.match(lw.ambilight.getAttribute('src') || lw.ambilight.src, /bunny-live-wallpaper\.mp4/);
    assert.equal(lw.activeSrc, DEFAULT);
    assert.equal(lw.activeType, 'video');
    assert.equal(lw.mediaList[0].src, DEFAULT);
    assert.equal(lw.enabled, true);
    assert.equal(a.w.SwanStage, undefined);
    assert.equal(a.q.Errors.items.length, 0);
  } finally { a.close(); }
});

test('portrait 9:16 on a 16:9 PC uses contain, feather mask and glowing ambilight; mobile/landscape use cover', () => {
  const a = harness();
  try {
    const w = a.w, lw = w.LiveWallpaper, video = lw.video, amb = lw.ambilight;
    let ambPauses = 0, ambPlays = 0;
    amb.pause = function () { ambPauses++; };
    amb.play = function () { ambPlays++; return { catch() {} }; };
    Object.defineProperty(video, 'videoWidth', { value: 478, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 850, configurable: true });
    Object.defineProperty(w, 'innerWidth', { value: 1920, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: 1080, configurable: true });
    video.dispatchEvent(new w.Event('loadedmetadata'));
    assert.equal(video.style.objectFit, 'contain');
    assert.equal(video.style.objectPosition, 'center center');
    assert.match(video.style.maskImage, /linear-gradient\(90deg, transparent 0%/);
    assert.match(video.style.webkitMaskImage, /rgba\(0,0,0,.2\) 22%/);
    assert.equal(amb.style.opacity, '0.78');
    assert.match(amb.getAttribute('src') || amb.src, /bunny-live-wallpaper\.mp4/);
    assert.ok(ambPlays > 0, 'ambilight plays in sync');

    Object.defineProperty(w, 'innerWidth', { value: 390, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: 844, configurable: true });
    w.dispatchEvent(new w.Event('resize'));
    assert.equal(video.style.objectFit, 'cover');
    assert.equal(video.style.maskImage, 'none');
    assert.equal(video.style.webkitMaskImage, 'none');
    assert.equal(amb.style.opacity, '0');
    assert.ok(ambPauses > 0, 'ambilight is paused on mobile to save battery');

    Object.defineProperty(video, 'videoWidth', { value: 1920, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true });
    Object.defineProperty(w, 'innerWidth', { value: 1920, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: 1080, configurable: true });
    video.dispatchEvent(new w.Event('canplay'));
    assert.equal(video.style.objectFit, 'cover');
    assert.equal(video.style.maskImage, 'none');
    assert.equal(amb.style.opacity, '0');
  } finally { a.close(); }
});

test('canplay/autoplay and first-gesture unlock run in Lite AND Full; off is explicit', () => {
  const a = harness();
  try {
    const w = a.w, lw = w.LiveWallpaper, video = lw.video;
    let plays = 0, pauses = 0;
    video.play = function () { plays++;return { catch() {} }; };
    video.pause = function () { pauses++; };
    a.q.DB.data.settings.perf = 'lite';a.q.UI.applyPerf();
    const before = plays;
    video.dispatchEvent(new w.Event('loadeddata'));
    assert.equal(plays > before, true);
    assert.equal(video.style.opacity, '0.88');
    assert.equal(w.document.body.dataset.perf, 'lite');
    a.q.DB.data.settings.perf = 'full';a.q.UI.applyPerf();
    video.dispatchEvent(new w.Event('canplay'));
    assert.equal(video.style.opacity, '0.88');
    assert.equal(w.document.body.dataset.perf, 'full');
    lw.setEnabled(false);
    assert.equal(lw.enabled, false);assert.ok(pauses > 0);
    assert.equal(video.style.opacity, '0');
    assert.equal(a.q.DB.data.settings.wallpaperVideo, false);
    lw.setEnabled(true);
    assert.equal(a.q.DB.data.settings.wallpaperVideo, true);
    assert.ok(plays > before + 1);
    w.document.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
    assert.ok(plays > before + 2, 'the first gesture retries play when paused');
  } finally { a.close(); }
});

test('topbar opens the GitHub gallery; Settings and gallery keep one native device picker', () => {
  const a = harness();
  try {
    stubGitHub(a, []);
    const doc = a.w.document, input = doc.getElementById('liveVideoInput');let picks = 0;
    input.click = function () { picks++; };
    click(a, doc.getElementById('btnLiveVideo'));
    assert.ok(doc.querySelector('#sheets .video-gallery-list'), 'gallery sheet opens from #btnLiveVideo');
    assert.ok(doc.getElementById('btnScanGhVideos'));
    assert.ok(doc.getElementById('btnPickVideoFile'));
    click(a, doc.getElementById('btnPickVideoFile'));
    assert.equal(picks, 1);
    a.q.UI.closeSheet();
    a.q.UI.setTab('set');
    const settings = doc.getElementById('setBody');
    assert.match(settings.firstElementChild.textContent, /Live Wallpaper Video/);
    assert.ok(doc.querySelector('#screen-set #lgStage'));
    assert.equal(doc.querySelector('#screen-home #lgStage'), null);
    assert.ok(doc.getElementById('btnOpenGallery'));
    assert.ok(doc.getElementById('btnScanGhVideosSet'));
    click(a, doc.getElementById('btnOpenGallery'));
    assert.ok(doc.querySelector('#sheets .video-gallery-list'), 'Settings opens the studio sheet');
    a.q.UI.closeSheet();
    click(a, doc.getElementById('btnPickVideoFileSet'));
    assert.equal(picks, 2);
    click(a, doc.getElementById('btnToggleVideo'));
    assert.equal(a.w.LiveWallpaper.enabled, false);
    assert.equal(doc.getElementById('btnToggleVideo').textContent, 'Play Live Video');
    click(a, doc.getElementById('btnResetVideo'));
    assert.equal(a.w.LiveWallpaper.enabled, true);
    assert.equal(doc.getElementById('btnToggleVideo').textContent, 'Pause Live Video');
  } finally { a.close(); }
});

test('MP4/WebM object URL plays immediately, persists as Blob in IDB, restores and resets', () => {
  let stored = null, keySeen = '', revocations = 0, plays = 0;
  function install(a) {
    const lw = a.w.LiveWallpaper;
    a.w.URL.createObjectURL = function () { return 'blob:wallpaper-' + (++plays); };
    a.w.URL.revokeObjectURL = function () { revocations++; };
    lw.video.load = function () {};
    lw.video.play = function () { return { catch() {} }; };
    lw.video.pause = function () {};
    lw.openDB = function (cb) {
      const db = {close() {},transaction() {
        const tx = {objectStore(store) {
          assert.equal(store, 'videos');return {
            put(file, key) { keySeen = key;stored = file;a.w.setTimeout(() => tx.oncomplete && tx.oncomplete(), 0); },
            get(key) {keySeen = key;const req = {};a.w.setTimeout(() => {req.result = stored;req.onsuccess && req.onsuccess();tx.oncomplete && tx.oncomplete();}, 0);return req;},
            delete(key) {keySeen = key;stored = null;a.w.setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);}
          };
        }};return tx;
      }};cb(db);
    };
    return lw;
  }
  const a = harness();
  try {
    const lw = install(a);
    const file = new a.w.File(['video bytes'], 'WhatsApp Video 2026-10-27 at 07.32.25.mp4', { type: 'video/mp4' });
    assert.equal(lw.loadCustomFile(file), true);
    assert.match(lw.video.src, /^blob:wallpaper-/);
    assert.equal(lw.source, 'custom');
    a.clock.tick(1);
    assert.equal(keySeen, 'custom_bg');assert.equal(stored, file);
    assert.equal(lw.loadCustomFile(new a.w.File(['webm'], 'clip.webm', { type: 'video/webm' })), true);
    assert.ok(revocations >= 1, 'previous object URL is released');
    a.clock.tick(1);
    const b = harness();
    try {
      const lw2 = install(b);
      lw2.restoreCustom();b.clock.tick(1);
      assert.equal(lw2.source, 'custom');
      assert.match(lw2.video.src, /^blob:wallpaper-/);
      assert.equal(lw2.name, 'clip.webm');
      lw2.resetDefault();b.clock.tick(1);
      assert.equal(lw2.source, 'default');assert.match(lw2.video.getAttribute('src') || lw2.video.src, /bunny-live-wallpaper\.mp4/);
      assert.equal(stored, null);assert.equal(keySeen, 'custom_bg');
    } finally { b.close(); }
  } finally { a.close(); }
});

test('canvas draws three rings/eight sparks for a click, swipe/audio/gold for events, then fully sleeps', () => {
  const a = harness();
  try {
    const w = a.w, lw = w.LiveWallpaper;
    let clears = 0, strokes = 0, fills = 0, frames = 0;
    const ctx = {setTransform() {}, clearRect() {clears++;}, beginPath() {}, arc() {}, stroke() {strokes++;}, fill() {fills++;}};
    lw.ctx = ctx;lw.resizeCanvas();
    a.clock.tick(3000);
    const original = w.requestAnimationFrame.bind(w);
    w.requestAnimationFrame = function (cb) {frames++;return original(cb);};
    const idleFrames = frames;a.clock.tick(2000);
    assert.equal(frames, idleFrames);
    function touch(kind, x, y) {
      const event = new w.Event(kind, { bubbles: true });
      event.pointerType = 'touch';event.pointerId = 3;event.button = 0;
      event.clientX = x;event.clientY = y;
      w.document.dispatchEvent(event);
    }
    touch('pointerdown', 100, 100);
    touch('pointermove', 102, 180);
    touch('pointercancel', 102, 180);
    assert.equal(lw.ripples.length, 0, 'a vertical touch scroll never starts an effect');
    assert.equal(frames, idleFrames, 'no canvas frame is queued for scrolling');
    lw.onClick(120, 190);
    assert.equal(lw.ripples.length, 3);assert.equal(lw.sparks.length, 8);
    assert.notEqual(lw.rafId, null);
    a.clock.tick(16);assert.ok(strokes >= 1);assert.ok(fills >= 1);
    lw.onSwipe(170, 220);assert.ok(lw.ripples.length >= 4);
    lw.pulseAudio();assert.ok(lw.ripples.length >= 7);
    lw.celebrateStreak();assert.ok(lw.ripples.some((ring) => ring.color === '#ffc247'));
    a.clock.tick(1500);
    assert.equal(lw.ripples.length, 0);assert.equal(lw.sparks.length, 0);
    assert.equal(lw.rafId, null);assert.ok(clears > 1);
    const stopped = frames;a.clock.tick(4000);
    w.dispatchEvent(new w.Event('scroll'));a.clock.tick(200);
    assert.equal(frames, stopped, 'zero new canvas frames at idle or scrolling');
  } finally { a.close(); }
});

test('cached search covers every word, variants, definitions, my words and mistakes', () => {
  has('buildSearchIndex:function');has('searchWords:function');has('searchIndex');
  const a = harness();
  try {
    const lib = a.q.Lib, list = lib.current();
    assert.equal(list.words.length, 30);
    for (const word of list.words) assert.ok(lib.searchWords(word.w.split('/')[0], list.words, list.id).some((x) => x.w === word.w), word.w);
    assert.ok(lib.searchWords('tire', list.words, list.id).some((x) => x.w === 'tyre/tire'));
    assert.ok(lib.searchWords('museums', list.words, list.id).some((x) => x.w === 'guidebook'));
    const rows = lib.searchIndex.rows;lib.searchWords('jour', list.words, list.id);
    assert.equal(lib.searchIndex.rows, rows);
    lib.addMyWord('wonderful');lib.addMistake('harbour');
    assert.equal(lib.searchWords('wonder', lib.mywords(), 'my')[0].w, 'wonderful');
    assert.equal(lib.searchWords('harb', lib.mistakes(), 'mistakes')[0].w, 'harbour');
    lib.searchWords('guide', list.words, list.id);
    assert.ok(lib.searchIndexes[list.id]);assert.ok(lib.searchIndexes.my);assert.ok(lib.searchIndexes.mistakes);
    list.words[4].m = 'unusual token for editing';a.q.DB.save();
    assert.equal(lib.searchWords('unusual token', list.words, list.id)[0].w, 'hitchhike');
    a.q.UI.setTab('dict');
    const input = a.w.document.getElementById('dictSearch');
    input.value = 'tire';input.dispatchEvent(new a.w.Event('input', { bubbles: true }));
    assert.match(a.w.document.getElementById('dictList').textContent, /tyre/i);
    input.value = 'guidebook';input.dispatchEvent(new a.w.Event('input', { bubbles: true }));
    assert.match(a.w.document.getElementById('dictList').textContent, /guidebook/i);
  } finally { a.close(); }
});

test('guide start, persistent Hansana credit and Settings-only mixer remain', () => {
  has('UI.showCreditNow=function');has('guide-credit-pill');has('UI.startPractisingFromGuide=function');
  has('id="tabInd"');has('id="homeStats"');has('anatomy-stage');
  assert.match(cssRule('#homeTitle,.liquid-glass-text'), /color:transparent!important/);
  assert.match(cssRule('#homeTitle,.liquid-glass-text'), /-webkit-text-stroke:1\.75px/);
  const a = harness();
  try {
    const doc = a.w.document, credit = doc.getElementById('credit');
    a.clock.tick(13000);assert.ok(credit.classList.contains('in'));
    a.q.UI.setTab('set');
    assert.equal(doc.querySelector('#screen-home #lgStage'), null);
    for (const id of ['lgStage', 'orb', 'sBlur', 'sSat', 'sBrt']) assert.ok(doc.querySelector('#screen-set #' + id), id);
    assert.match(doc.querySelector('#screen-set .seg-tint').textContent, /Clear[\s\S]*Frost[\s\S]*Smoke/);
    assert.match(doc.querySelector('#screen-set .seg-perf').textContent, /Auto[\s\S]*Lite[\s\S]*Full/);
    assert.match(doc.getElementById('tabInd').style.transform, /translate3d\(400%/);
    const actions = [], unlock = a.q.Speech.unlock, start = a.q.Eng.start;
    a.q.Speech.unlock = function () {actions.push('unlock');return unlock.apply(this, arguments);};
    a.q.Eng.start = function () {actions.push('start');return start.apply(this, arguments);};
    a.q.UI.openWelcomeGuide();assert.ok(doc.querySelector('#sheets .guide-credit-pill'));
    assert.match(doc.querySelector('#sheets .guide-credit-pill').textContent, /Hansana/);
    click(a, doc.getElementById('btnGuideStart'));
    assert.deepEqual(actions, ['unlock', 'start']);
    assert.equal(a.q.UI.tab, 'home');assert.equal(a.q.Eng.st, 'ready');
    assert.equal(a.q.Eng.words.length, 30);
    assert.match(doc.querySelector('#sheets .sheet').textContent, /Are you ready\?/);
    assert.ok(credit.classList.contains('in'));
    for (const id of ['chipNet', 'btnLang', 'btnGuideTop', 'btnPerf', 'btnLiveVideo', 'btnTheme', 'btnRefresh', 'btnAdmin'])
      assert.ok(doc.querySelector('.topbar #' + id), id);
  } finally { a.close(); }
});

test('ready sheet has ONE far-right exit by cross, scrim and Escape', () => {
  for (const token of ['btnReadyClose', 'btnNotReady', 'ansVkb', 'btnToggleVkb']) lacks(token);
  has('Eng.cancelReadyAndExit=function');
  for (const method of ['cross', 'scrim', 'escape']) {
    const a = harness();
    try {
      const doc = enterType(a), exits = doc.querySelectorAll('#sheets .shead button');
      assert.equal(a.q.Eng.st, 'ready');assert.equal(exits.length, 1);
      assert.equal(exits[0].getAttribute('aria-label'), 'Close');
      if (method === 'cross') click(a, exits[0]);
      else if (method === 'scrim') click(a, doc.querySelector('#sheets .scrim'));
      else doc.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      a.clock.tick(120);
      assert.equal(a.q.Eng.st, 'idle');assert.equal(a.q.Eng.layer, null);
      assert.equal(doc.querySelectorAll('#sheets .sheet').length, 0);
      assert.equal(doc.querySelectorAll('#layers .layer').length, 0);
    } finally { a.close(); }
  }
});

test('plain-text answer input uses one-space IME buffer and no password/autofill/VKB', () => {
  has('inp.type="text"');has('inp.setAttribute("autocomplete","off")');
  has('typedAnswer');has('syncInputMirror');has('ansMirrorText');has('ans-caret');
  assert.doesNotMatch(html, /inp\.type\s*=\s*"password"|new-password|current-password/);
  const a = harness();
  try {
    const doc = playing(a), input = doc.getElementById('ansInput');
    assert.equal(input.type, 'text');assert.equal(input.getAttribute('autocomplete'), 'off');
    assert.equal(input.getAttribute('autocorrect'), 'off');assert.equal(input.getAttribute('spellcheck'), 'false');
    assert.equal(input.form, null);assert.equal(input.value, ' ');
    assert.ok(doc.querySelector('#ansMirror .ans-caret'));
    for (const c of 'gui') typeChar(a, input, c);
    assert.equal(input.value, ' ');assert.equal(a.q.Eng.typedAnswer, 'gui');
    assert.equal(doc.getElementById('ansMirrorText').textContent, 'gui');
    input.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    assert.equal(a.q.Eng.typedAnswer, 'gu');
    input.value = '';input.dispatchEvent(new a.w.Event('input', { bubbles: true }));
    assert.equal(input.value, ' ');
    for (const kind of ['insertReplacementText', 'insertFromPaste', 'insertFromDrop']) {
      const ev = new a.w.Event('beforeinput', { bubbles: true, cancelable: true });ev.inputType = kind;
      input.dispatchEvent(ev);assert.equal(ev.defaultPrevented, true);
    }
    for (const kind of ['paste', 'drop']) {
      const ev = new a.w.Event(kind, { bubbles: true, cancelable: true });input.dispatchEvent(ev);
      assert.equal(ev.defaultPrevented, true);
    }
  } finally { a.close(); }
});

test('tick, gold streak, cross, broken streak and side-by-side correction still score', () => {
  has('Eng.onTypeCorrect=function');has('Eng.onTypeWrong=function');
  has('function diffChars');has('this.after(1050');has('this.after(2100');
  has('ansTick');has('plTickHero');has('ansWrong');has('plWrongHero');has('ansCompare');has('streak-broken');
  const a = harness();
  try {
    const doc = playing(a), input = doc.getElementById('ansInput');
    let chimes = 0, celebrations = 0, tones = 0;
    a.q.UI.playTickChime = function () {chimes++;};
    a.w.LiveWallpaper.celebrateStreak = function () {celebrations++;};
    for (const c of a.q.Eng.currentWord().w) typeChar(a, input, c);
    assert.equal(a.q.Eng.wordSolved, true);
    assert.equal(a.q.Eng.liveCorrectCount, 1);assert.equal(a.q.Eng.liveStreakCount, 1);
    assert.equal(chimes, 1);assert.equal(celebrations, 1);
    assert.ok(doc.getElementById('ansTick').classList.contains('is-correct'));
    assert.ok(doc.getElementById('plTickHero').classList.contains('is-correct'));
    assert.ok(doc.querySelectorAll('#ansSlots .slot-done').length > 0);
    a.clock.tick(1049);assert.equal(a.q.Eng.idx, 0);
    a.clock.tick(2);assert.equal(a.q.Eng.idx, 1);
    const target = a.q.Eng.currentWord().w, spoken = [];
    a.q.UI.playWrongTone = function () {tones++;};
    a.q.Speech.say = function (parts) {spoken.push(parts.join(' '));};
    for (const c of 'zzzz') typeChar(a, input, c);
    input.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal(a.q.Eng.wordWrong, true);assert.equal(a.q.Eng.liveStreakCount, 0);
    assert.equal(a.q.Eng.liveWrongCount, 1);assert.equal(tones, 1);
    assert.deepEqual(spoken, [target.split('/')[0]]);
    assert.ok(doc.getElementById('ansWrong').classList.contains('is-wrong'));
    assert.ok(doc.getElementById('plWrongHero').classList.contains('is-wrong'));
    assert.match(doc.getElementById('plStreakCount').textContent, /Streak Broken! \(0\)/);
    assert.match(doc.getElementById('ansCompare').textContent, /Your answer:[\s\S]*Correct UK spelling/);
    assert.ok(a.q.DB.data.mistakes.some((m) => m.w === target.toLowerCase()));
    a.clock.tick(2099);assert.equal(a.q.Eng.idx, 1);
    a.clock.tick(2);assert.equal(a.q.Eng.idx, 2);
    a.q.Eng.onTypeWrong('timeout');
    assert.match(doc.getElementById('ansFeedback').textContent, /Time up/);
  } finally { a.close(); }
});

test('final typed answer, tyre/tire variants and paper self-scoring remain', () => {
  const a = harness();
  try {
    const target = session.lists[0].words[25];
    for (const answer of ['tyre', 'tire', 'tyre/tire', ' TIRE ']) assert.equal(a.q.Eng.isAnswerMatch(answer, target), true);
    assert.equal(a.q.Eng.isAnswerMatch('tyres', target), false);
    assert.equal(a.q.Eng.isPrefixMatch('tir', target), true);
    const doc = playing(a);
    a.q.Eng.runItem(29);a.clock.tick(4500);
    const input = doc.getElementById('ansInput');
    for (const c of 'windscreen') typeChar(a, input, c);
    a.clock.tick(1051);
    assert.equal(a.q.DB.data.history.length, 1);
    const row = a.q.DB.data.history[0].rows[29];
    assert.equal(row.word, 'windscreen');assert.equal(row.ans, 'windscreen');assert.equal(row.state, 'ok');
    const list = [{ w: 'harbour', s: '', m: '' }, { w: 'journey', s: '', m: '' }];
    const rec = { id: 'paper-test', mode: 'paper', percent: 0, score: 0, wordCount: 2,
      rows: [{ state: '' }, { state: '' }], durationSec: 10, listName: title,
      sessionNo: '7', sessionDay: 'Thursday', sessionDate: '2026-10-27' };
    a.q.Results.open(rec, list, [0, 1]);
    const find = (label) => Array.from(doc.querySelectorAll('#layers button')).find((b) => b.textContent.trim() === label);
    click(a, find('All right'));assert.equal(rec.score, 2);assert.equal(rec.percent, 100);
    click(a, find('Reset'));assert.equal(rec.score, 0);
    assert.equal(a.q.Errors.items.length, 0);
  } finally { a.close(); }
});

test('cloud status distinguishes GAS reply from live-only activity', () => {
  const a = harness();
  try {
    const c = a.q.Cloud, label = () => a.w.document.getElementById('chipNetText').textContent;
    c.mode = true;c.updatedAt = 1000;c.live.at = 1000;c.live.ok = true;
    a.q.UI.renderNet();assert.match(label(), /Online · Live Sync/);assert.doesNotMatch(label(), /Cloud Synced/);
    c.gasAt = 2000;a.q.UI.renderNet();assert.match(label(), /Cloud Synced/);
    a.q.DB.data.outbox.push({ id: 'pending' });a.q.UI.renderNet();assert.match(label(), /Syncing/);
    c.setUrl('');assert.equal(c.gasAt, 0);
  } finally { a.close(); }
});

test('every saved repository media file is intact, discovered and bunny is first; zero fake fallbacks', () => {
  lacks('Fallback path');
  assert.ok(!/☁ Fallback/.test(html));
  const files = trackedMedia();
  assert.ok(files.length >= 3, 'git ls-files sees the saved media');
  const videos = files.filter((p) => /\.(mp4|webm|mov|m4v)$/i.test(p));
  assert.ok(videos.length >= 1);
  const a = harness();
  try {
    const cfg = a.q.CONFIG, lw = a.w.LiveWallpaper;
    assert.equal(cfg.repoVideos[0].src, DEFAULT);
    assert.equal(cfg.repoMedia[0].src, DEFAULT);
    assert.equal(lw.mediaList[0].src, DEFAULT);
    assert.equal(lw.fallbackVideos().length, 0);
    assert.equal(cfg.repoFallbacks.length, 0);
    const srcs = cfg.repoMedia.map((m) => m.src);
    for (const f of files) {
      assert.ok(fs.statSync(path.join(root, f)).size > 0, f + ' is intact');
      if (/\.(mp4|webm|mov|m4v)$/i.test(f)) assert.ok(srcs.indexOf('./' + encodeURI(f)) >= 0, f + ' is discovered');
    }
    for (const d of [version, config, session]) {
      assert.equal(d.repoMedia[0].src, DEFAULT);
      assert.deepEqual(d.repoFallbacks, []);
      assert.equal(d.repoMedia.length, cfg.repoMedia.length);
    }
    /* Every card is backed by a REAL file on disk, never an invented path. */
    for (const m of lw.mediaList) {
      assert.ok(/\.(mp4|webm|mov|m4v|jpe?g|png|webp|gif|avif)$/i.test(m.src), m.src);
      assert.ok(m.type === 'video' || m.type === 'image', m.src + ' has a type');
      assert.ok(m.title && m.title.length, m.src + ' has a title');
      const rel = decodeURIComponent(m.src.replace(/^\.\//, '').split('#')[0]);
      assert.ok(fs.existsSync(path.join(root, rel)), m.src + ' exists in the repository');
    }
    /* A non-media blob never becomes a card. */
    stubGitHub(a, [{ type: 'blob', path: 'README.md' }, { type: 'tree', path: 'assets' },
      { type: 'blob', path: 'assets/bunny-live-wallpaper.mp4' }], []);
    lw.discoverGitHubMedia(true, function () {});
    assert.ok(!lw.mediaList.some((m) => /README\.md/.test(m.src)));
    assert.ok(!lw.mediaList.some((m) => /Fallback/i.test(m.title)));
    assert.ok(lw.mediaList.every((m) => /^(\.\/|blob:)/.test(m.src)));
  } finally { a.close(); }
});

test('discoverGitHubMedia scans contents/assets + the git tree, merges videos AND photos, caches 5 minutes and force-refreshes', () => {
  has('discoverGitHubMedia:function');has('requestMedia:function');has('collectPaths:function');
  has('repoContentsUrl');has('ghMediaCache');has('sdp.gh_media_v30');has('ghMediaTtl');
  has('encodeURI(');has('item.path');
  const a = harness();
  try {
    const tree = [
      { type: 'blob', path: 'assets/bunny-live-wallpaper.mp4' },
      { type: 'blob', path: 'assets/bunny-poster.webp' },
      { type: 'blob', path: 'assets/Beach Sunset.jpg' },
      { type: 'blob', path: 'videos/My Clip.mp4' },
      { type: 'blob', path: 'media/swan-lake.webm' },
      { type: 'blob', path: 'assets/notes.txt' },
      { type: 'tree', path: 'assets' }
    ];
    const contents = [
      { type: 'file', name: 'Lake Boat.gif', path: 'assets/Lake Boat.gif' },
      { type: 'file', name: 'City Lights.avif', path: 'assets/City Lights.avif' },
      { type: 'file', name: 'bunny-live-wallpaper.mp4', path: 'assets/bunny-live-wallpaper.mp4' }
    ];
    const calls = stubGitHub(a, tree, contents);
    const lw = a.w.LiveWallpaper;
    let list = null;
    lw.discoverGitHubMedia(true, function (v) { list = v; });
    assert.equal(calls.length, 2, 'BOTH GitHub endpoints are queried');
    assert.ok(calls.some((u) => u === 'https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/assets'));
    assert.ok(calls.some((u) => u === 'https://api.github.com/repos/dictationb1/dictationb1.github.io/git/trees/main?recursive=1'));
    assert.equal(list[0].src, DEFAULT, 'bunny remains index 0');
    const bySrc = {};list.forEach((m) => { bySrc[m.src] = m; });
    assert.equal(bySrc['./assets/Beach%20Sunset.jpg'].type, 'image');
    assert.equal(bySrc['./assets/Lake%20Boat.gif'].type, 'image');
    assert.equal(bySrc['./assets/City%20Lights.avif'].type, 'image');
    assert.equal(bySrc['./videos/My%20Clip.mp4'].type, 'video');
    assert.equal(bySrc['./media/swan-lake.webm'].type, 'video');
    assert.match(bySrc['./videos/My%20Clip.mp4'].title, /My Clip/);
    assert.equal(bySrc['./assets/Beach%20Sunset.jpg'].folder, 'assets');
    assert.ok(!bySrc['./assets/bunny-poster.webp'], 'a poster helper for an existing video is not a fake card');
    assert.ok(!Object.keys(bySrc).some((s) => /notes\.txt/.test(s)), 'non-media blobs are filtered');
    assert.equal(list.filter((m) => m.src === DEFAULT).length, 1, 'no duplicates across both endpoints');
    assert.ok(a.w.localStorage.getItem('sdp.gh_media_v30'), 'five-minute cache is written');
    let cached = null;
    lw.discoverGitHubMedia(false, function (v) { cached = v; });
    assert.equal(calls.length, 2, 'fresh cache avoids new requests');
    assert.ok(cached.length >= list.length);
    a.clock.tick(300001);
    lw.discoverGitHubMedia(false, function () {});
    assert.equal(calls.length, 4, 'cache expires after five minutes');
    lw.discoverGitHubMedia(true, function () {});
    assert.equal(calls.length, 6, 'forceRefresh bypasses the cache immediately');
    a.w.document.getElementById('btnRefresh').click();
    assert.equal(calls.length, 8, 'topbar #btnRefresh forces a fresh scan');
    lw.openGallerySheet();
    const scan = a.w.document.getElementById('btnScanGhVideos');
    assert.ok(scan);
    click(a, scan);
    assert.equal(calls.length, 10, '🔄 Refresh from GitHub forces a fresh scan');
    assert.equal(a.q.Errors.items.length, 0);
  } finally { a.close(); }
});

test('studio cards show real 16:9 video/photo thumbnails, one Apply button, one header Next Wallpaper and three playlist modes', () => {
  const a = harness();
  try {
    stubGitHub(a, [{ type: 'blob', path: 'videos/My Clip.mp4' }, { type: 'blob', path: 'assets/Blue Lake.png' }], []);
    const doc = a.w.document, lw = a.w.LiveWallpaper;
    lw.openGallerySheet();
    const list = doc.querySelector('#sheets .video-gallery-list');
    assert.ok(list);
    const cards = Array.from(list.querySelectorAll('.video-gallery-item'));
    assert.ok(cards.length >= 4, 'every discovered video and photo is listed');
    for (const card of cards) {
      const preview = card.querySelector('.gal-preview');
      assert.ok(preview, 'top 16:9 preview box');
      const thumb = preview.querySelector('.gal-thumb');
      assert.ok(thumb, 'real visual thumbnail');
      if (thumb.tagName === 'VIDEO') {
        assert.match(thumb.getAttribute('src'), /#t=1\.2$/, 'shows a real video frame at 1.2s');
        assert.equal(thumb.getAttribute('preload'), 'metadata');
        assert.equal(thumb.getAttribute('muted'), '');
        assert.equal(thumb.getAttribute('loop'), '');
        assert.equal(thumb.getAttribute('playsinline'), '');
      } else {
        assert.equal(thumb.tagName, 'IMG');
        assert.equal(thumb.getAttribute('loading'), 'lazy');
        assert.ok(thumb.getAttribute('alt'), 'photo has an alt label');
        assert.ok(thumb.getAttribute('src'));
      }
      assert.match(card.querySelector('.gal-kind').textContent, /(🎬 Video|🖼️ Photo) · Saved in repository/);
      assert.equal(card.querySelectorAll('.video-gallery-actions button').length, 1, 'single clean action button');
      assert.ok(!Array.from(card.querySelectorAll('button')).some((b) => /Next Video/.test(b.textContent)), 'no duplicate Next Video per card');
    }
    assert.ok(doc.querySelector('.video-gallery-badge'));
    assert.equal(doc.querySelector('.video-gallery-badge').textContent, '✓ Active Now');
    assert.equal(doc.querySelectorAll('#sheets button#btnNextWallpaper').length, 1, 'one Next Wallpaper in the header');
    assert.ok(Array.from(doc.querySelectorAll('#sheets button')).some((b) => b.textContent.trim() === '⏭ Next Wallpaper'));
    assert.ok(Array.from(doc.querySelectorAll('#sheets button')).some((b) => b.textContent.trim() === '✓ Active Wallpaper'));
    assert.ok(Array.from(doc.querySelectorAll('#sheets button')).some((b) => b.textContent.trim() === '▶ Apply Wallpaper'));
    assert.equal(doc.querySelector('#sheets .video-gallery-badge').style.display, 'inline-flex');
    const seg = doc.querySelector('#sheets .seg.gallery-seg');
    assert.ok(seg);
    assert.deepEqual(Array.from(seg.querySelectorAll('button')).map((b) => b.textContent),
      ['🔂 Loop Single Video', '🔁 Auto-Cycle All GitHub Media', '⏸ Video Off']);
    const pick = Array.from(doc.querySelectorAll('[data-gallery-select]')).find((b) => b.getAttribute('data-gallery-select').indexOf('Blue%20Lake') >= 0);
    assert.ok(pick, 'GitHub photo is selectable');
    click(a, pick);
    assert.equal(lw.activeSrc, './assets/Blue%20Lake.png');
    assert.equal(lw.activeType, 'image');
    assert.equal(a.q.DB.data.settings.activeMediaType, 'image');
    assert.equal(doc.getElementById('bgLivePhoto').getAttribute('src'), './assets/Blue%20Lake.png');
    assert.equal(doc.getElementById('bgLivePhoto').style.opacity, '0.92');
    assert.equal(lw.video.style.opacity, '0');
    const cycle = Array.from(seg.querySelectorAll('button')).find((b) => b.textContent === '🔁 Auto-Cycle All GitHub Media');
    click(a, cycle);
    assert.equal(lw.playlistMode, 'cycle');
    assert.equal(a.q.DB.data.settings.videoPlaylistMode, 'cycle');
    assert.equal(lw.video.loop, false);
    const off = Array.from(seg.querySelectorAll('button')).find((b) => b.textContent === '⏸ Video Off');
    click(a, off);
    assert.equal(lw.enabled, false);
    assert.equal(lw.ambilight.style.opacity, '0');
    const loop = Array.from(seg.querySelectorAll('button')).find((b) => b.textContent === '🔂 Loop Single Video');
    click(a, loop);
    assert.equal(lw.enabled, true);
    assert.equal(lw.video.loop, true);
  } finally { a.close(); }
});

test('auto-cycle advances videos on ended and photos every 12s; loop/off modes persist', () => {
  const a = harness();
  try {
    const lw = a.w.LiveWallpaper;
    lw.mediaList = [
      { id: 'v1', title: 'Bunny', src: DEFAULT, type: 'video', folder: 'assets', poster: '', origin: 'repo' },
      { id: 'v2', title: 'Sunset', src: './assets/Sunset.jpg', type: 'image', folder: 'assets', poster: '', origin: 'github' },
      { id: 'v3', title: 'Clip', src: './videos/My%20Clip.mp4', type: 'video', folder: 'videos', poster: '', origin: 'github' }
    ];
    lw.videos = lw.mediaList;
    lw.activeSrc = DEFAULT;lw.activeType = 'video';
    lw.setPlaylistMode('cycle');
    assert.equal(lw.video.loop, false);
    assert.equal(a.q.DB.data.settings.videoPlaylistMode, 'cycle');
    lw.onEnded();a.clock.tick(320);
    assert.equal(lw.activeSrc, './assets/Sunset.jpg');
    assert.equal(lw.activeType, 'image');
    assert.equal(a.q.DB.data.settings.activeMediaType, 'image');
    assert.notEqual(lw.photoTimer, null, 'photo gets a 12-second timer');
    a.clock.tick(11900);
    assert.equal(lw.activeSrc, './assets/Sunset.jpg', 'photo stays for twelve seconds');
    a.clock.tick(400);a.clock.tick(320);
    assert.equal(lw.activeSrc, './videos/My%20Clip.mp4');
    assert.equal(lw.activeType, 'video');
    assert.equal(lw.photoTimer, null, 'video has no photo timer');
    lw.onEnded();a.clock.tick(320);
    assert.equal(lw.activeSrc, DEFAULT, 'playlist wraps around');
    lw.setPlaylistMode('off');
    assert.equal(lw.enabled, false);
    assert.equal(a.q.DB.data.settings.videoPlaylistMode, 'off');
    assert.equal(lw.photoTimer, null);
    lw.setPlaylistMode('loop');
    assert.equal(lw.enabled, true);
    assert.equal(lw.video.loop, true);
    assert.equal(a.q.DB.data.settings.videoPlaylistMode, 'loop');
  } finally { a.close(); }
});

test('lecturer publish carries activeVideoSrc to students through repo and live state', () => {
  const a = harness();
  try {
    a.q.DB.data.settings.activeVideoSrc = './videos/My%20Clip.mp4';
    a.q.DB.data.settings.videoPlaylistMode = 'cycle';
    const payload = a.q.Cloud.repoPayload();
    assert.equal(payload.session.activeVideoSrc, './videos/My%20Clip.mp4');
    assert.equal(payload.session.videoPlaylistMode, 'cycle');
    assert.equal(payload.version.activeVideoSrc, './videos/My%20Clip.mp4');
    assert.ok(Array.isArray(payload.version.repoVideos) && payload.version.repoVideos.length >= 1);
    a.q.Cloud.applyRepo({ activeVideoSrc: './assets/bunny-live-wallpaper.mp4', videoPlaylistMode: 'loop' });
    assert.equal(a.q.DB.data.settings.activeVideoSrc, './assets/bunny-live-wallpaper.mp4');
    assert.equal(a.w.LiveWallpaper.activeSrc, './assets/bunny-live-wallpaper.mp4');
    a.q.Cloud.applyState({ activeVideoSrc: './videos/My%20Clip.mp4' });
    assert.equal(a.q.DB.data.settings.activeVideoSrc, './videos/My%20Clip.mp4');
    assert.equal(a.w.LiveWallpaper.activeSrc, './videos/My%20Clip.mp4');
  } finally { a.close(); }
});

test('all v22-v29 feature tokens and guards are still present in the v30 build', () => {
  for (const token of [
    'id="credit"', 'z-index:9999!important', 'UI.showCreditNow=function', 'guide-credit-pill',
    'UI.startPractisingFromGuide=function', 'id="btnGuideStart"', 'Eng.cancelReadyAndExit=function',
    'inp.type="text"', 'inp.setAttribute("autocomplete","off")', 'typedAnswer', 'syncInputMirror',
    'ansMirrorText', 'ans-caret', 'ansTick', 'plTickHero', 'ansWrong', 'plWrongHero',
    'ansCompare', 'streak-broken', 'function diffChars', 'this.after(1050', 'this.after(2100',
    'buildSearchIndex:function', 'searchWords:function', 'searchIndex', 'id="tabInd"', 'id="homeTitle"',
    'id="segMode"', 'id="lgStage"', 'voice=Amy', 'requestAnimationFrame', 'rafId', 'wake:function',
    'sleep:function', 'onClick:function', 'onSwipe:function', 'pulseAudio:function', 'celebrateStreak:function',
    'data-mode="paper" aria-selected="true"', 'Listen &amp; write on paper', 'activeVideoSrc',
    'videoPlaylistMode', 'applyPublishedVideo', 'discoverGitHubVideos', 'treeVideos', 'mergePaths',
    'btnScanGhVideosSet', 'btnPickVideoFileSet', 'btnToggleVideo', 'btnResetVideo',
    'DEFAULT_WALLPAPER_SRC', 'discoverGitHubMedia', 'mediaList', 'bgContrastScrim', 'bgLivePhoto',
    'bgLivePhotoAmbilight', 'sVideoDim', '--bg-dim', 'gal-thumb', 'gal-preview', 'repoMedia',
    'contents/assets', 'sdp.gh_media_v30', 'activeMediaType', 'videoDim',
    '🎬 Video', '🖼️ Photo', '✓ Active Now', '⏭ Next Wallpaper', '🔄 Refresh from GitHub'
  ]) has(token);
  for (const token of ['btnReadyClose', 'btnNotReady', 'ansVkb', 'btnToggleVkb', 'swanMasterPath',
    'window.SwanStage', '一筆白鳥', 'bgSwanVideo', 'new-password', 'Fallback path', '☁ Fallback']) lacks(token);
  assert.doesNotMatch(html, /inp\.type\s*=\s*"password"|new-password|current-password/);
  assert.equal(config.defaults.mode, 'paper');
  assert.equal(session.session.mode, 'paper');
  assert.equal(version.mode, 'paper');
  for (const d of [version, config, session]) {
    assert.equal(d.activeVideoSrc, DEFAULT);
    assert.equal(d.mode, 'paper');
    assert.ok(d.ver >= 30);
  }
});

test('Word Contrast / Video Dimmer slider drives --bg-dim live in both Settings and the studio', () => {
  assert.match(cssRule('#bgContrastScrim'), /background:radial-gradient\(circle at 50% 40%,rgba\(5, 9, 20, var\(--bg-dim, 0\.34\)\)/);
  assert.match(cssRule('#setBody .wallpaper-controls'), /display:flex;flex-wrap:wrap;gap:8px/);
  assert.match(html, /<input type="range" id="sVideoDim" min="10" max="75" step="1" value="34"/);
  const a = harness();
  try {
    const doc = a.w.document, lw = a.w.LiveWallpaper;
    assert.equal(doc.documentElement.style.getPropertyValue('--bg-dim'), '0.34', 'default 34% dimmer is applied on boot');
    a.q.UI.setTab('set');
    const settingsDim = doc.querySelector('#setBody #sVideoDim');
    assert.ok(settingsDim, 'Settings has the live dimmer');
    assert.equal(settingsDim.min, '10');assert.equal(settingsDim.max, '75');
    assert.equal(settingsDim.value, '34');
    const row = doc.querySelector('#setBody .wallpaper-controls');
    assert.ok(row);
    assert.equal(row.children.length, 5, 'five wallpaper buttons never clip');
    settingsDim.value = '60';
    settingsDim.dispatchEvent(new a.w.Event('input', { bubbles: true }));
    assert.equal(a.q.DB.data.settings.videoDim, 60);
    assert.equal(doc.documentElement.style.getPropertyValue('--bg-dim'), '0.60');
    assert.equal(doc.body.style.getPropertyValue('--bg-dim'), '0.60');
    assert.equal(doc.querySelector('#setBody .dim-value').textContent, '60%');
    lw.setDim(10);
    assert.equal(a.q.DB.data.settings.videoDim, 10, 'clamped at 10%');
    lw.setDim(75);
    assert.equal(doc.documentElement.style.getPropertyValue('--bg-dim'), '0.75', 'clamped at 75%');
    lw.openGallerySheet();
    const studioDim = doc.querySelector('#sheets #sVideoDim');
    assert.ok(studioDim, 'the studio shows the same live dimmer');
    studioDim.value = '48';
    studioDim.dispatchEvent(new a.w.Event('input', { bubbles: true }));
    assert.equal(a.q.DB.data.settings.videoDim, 48);
    assert.equal(doc.querySelector('#sheets .dim-value').textContent, '48%');
    assert.ok(doc.getElementById('bgContrastScrim'), 'scrim sits above any wallpaper');
    a.q.UI.closeSheet();
    assert.ok(doc.querySelector('#setBody #sVideoDim'), 'slider returns to Settings when the sheet closes');
    assert.equal(a.q.Errors.items.length, 0);
  } finally { a.close(); }
});

test('photo wallpaper fades in with a synchronized portrait ambilight; video fades back in on selection', () => {
  const a = harness();
  try {
    const w = a.w, doc = w.document, lw = w.LiveWallpaper;
    const photo = doc.getElementById('bgLivePhoto'), amb = doc.getElementById('bgLivePhotoAmbilight');
    assert.ok(photo && amb);
    assert.equal(photo.parentElement, doc.getElementById('bgLiveWrap'));
    assert.equal(amb.parentElement, doc.getElementById('bgLiveWrap'));
    Object.defineProperty(photo, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(photo, 'naturalHeight', { value: 1400, configurable: true });
    Object.defineProperty(w, 'innerWidth', { value: 1920, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: 1080, configurable: true });
    lw.mediaList = [
      { id: 'v1', title: 'Bunny', src: DEFAULT, type: 'video', folder: 'assets', poster: '', origin: 'repo' },
      { id: 'p1', title: 'Portrait', src: './assets/portrait.png', type: 'image', folder: 'assets', poster: '', origin: 'github' }
    ];
    lw.videos = lw.mediaList;
    lw.selectMedia('./assets/portrait.png');
    assert.equal(lw.activeType, 'image');
    assert.equal(photo.getAttribute('src'), './assets/portrait.png');
    assert.equal(amb.getAttribute('src'), './assets/portrait.png');
    assert.equal(photo.style.opacity, '0.92');
    assert.equal(lw.video.style.opacity, '0', 'video is hidden for a photo');
    assert.equal(lw.ambilight.style.opacity, '0');
    photo.dispatchEvent(new w.Event('load'));
    assert.equal(photo.style.objectFit, 'contain', 'portrait photo is fully visible on a widescreen PC');
    assert.match(photo.style.maskImage, /linear-gradient\(90deg, transparent 0%/);
    assert.equal(amb.style.opacity, '0.78', 'blurred ambilight fills the side bars');
    assert.ok(/#bgLivePhotoAmbilight\{[^}]*filter:blur\(34px\)/.test(html), 'photo ambilight is blurred');
    Object.defineProperty(w, 'innerWidth', { value: 390, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: 844, configurable: true });
    w.dispatchEvent(new w.Event('resize'));
    assert.equal(photo.style.objectFit, 'cover');
    assert.equal(amb.style.opacity, '0', 'ambilight sleeps on mobile');
    lw.selectMedia(DEFAULT);
    assert.equal(lw.activeType, 'video');
    assert.equal(photo.style.opacity, '0');
    assert.equal(amb.style.opacity, '0');
    assert.match(lw.video.getAttribute('src') || lw.video.src, /bunny-live-wallpaper\.mp4/);
    assert.equal(a.q.DB.data.settings.activeMediaType, 'video');
    assert.equal(a.q.Errors.items.length, 0);
  } finally { a.close(); }
});

test('bunny default loads and plays in Lite and Full with the widescreen ambilight primed', () => {
  const a = harness();
  try {
    const w = a.w, lw = w.LiveWallpaper, video = lw.video;
    let plays = 0;
    video.play = function () { plays++; return { catch() {} }; };
    video.pause = function () {};
    assert.equal(lw.activeSrc, DEFAULT);
    assert.match(video.getAttribute('src') || video.src, /bunny-live-wallpaper\.mp4/);
    assert.match(lw.ambilight.getAttribute('src') || lw.ambilight.src, /bunny-live-wallpaper\.mp4/);
    a.q.DB.data.settings.perf = 'lite';a.q.UI.applyPerf();
    const before = plays;
    video.dispatchEvent(new w.Event('loadeddata'));
    assert.ok(plays > before, 'Lite mode plays the default video');
    assert.equal(video.style.opacity, '0.88');
    assert.equal(w.document.body.dataset.perf, 'lite');
    a.q.DB.data.settings.perf = 'full';a.q.UI.applyPerf();
    video.dispatchEvent(new w.Event('canplay'));
    assert.equal(video.style.opacity, '0.88', 'Full mode plays the default video');
    assert.equal(w.document.body.dataset.perf, 'full');
    Object.defineProperty(w, 'innerWidth', { value: 1920, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: 1080, configurable: true });
    Object.defineProperty(video, 'videoWidth', { value: 478, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 850, configurable: true });
    video.dispatchEvent(new w.Event('loadedmetadata'));
    assert.equal(video.style.objectFit, 'contain');
    assert.equal(lw.ambilight.style.opacity, '0.78');
    assert.match(lw.ambilight.getAttribute('src') || lw.ambilight.src, /bunny-live-wallpaper\.mp4/);
    assert.equal(a.q.Errors.items.length, 0);
  } finally { a.close(); }
});

test('no invented fallback paths in the shipped data or the runtime media list', () => {
  for (const d of [version, config, session]) {
    assert.deepEqual(d.repoFallbacks, []);
    const text = JSON.stringify(d);
    for (const fake of ['./live-wallpaper.mp4', './media.mp4', './assets/swan-lake.mp4', 'Fallback path'])
      assert.ok(!text.includes(fake), fake + ' must not ship as a fallback');
    assert.equal(d.repoContentsUrl, 'https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/assets');
    assert.equal(d.ghMediaCache, 'sdp.gh_media_v30');
    assert.equal(d.ghMediaTtl, 300000);
  }
  const a = harness();
  try {
    const lw = a.w.LiveWallpaper;
    assert.equal(lw.fallbackVideos().length, 0);
    assert.ok(lw.mediaList.every((m) => m.origin === 'repo' || m.origin === 'github'));
    /* The old v29 helper still works, but never invents a card. */
    stubGitHub(a, [], []);
    let list = null;
    lw.discoverGitHubVideos(function (v) { list = v; }, true);
    assert.ok(list.length >= 1);
    assert.ok(!list.some((m) => /Fallback/i.test(m.title)));
  } finally { a.close(); }
});
