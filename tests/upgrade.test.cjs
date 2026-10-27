'use strict';
/* v32 release gates: strict-ES5 single-file app, normalised /assets/ media,
   guaranteed bunny playback, ultra-clear glass through every screen, and every
   v22-v31 dictation, typing, search, credit, guide, ambilight and 120 FPS feature. */
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
const KEY = 'sdp.v32_crystal_video';
const DEFAULT = './assets/bunny-live-wallpaper.mp4';
const RAW_URL = 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-live-wallpaper.mp4?v=32#t=1.2';
const title = 'Session 7 - Travel & Transport';
const words = ['guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration',
  'journey', 'luggage', 'machine', 'mechanic', 'nationality', 'on business', 'on vacation',
  'overnight', 'passenger', 'public transport', 'reception', 'reservation', 'road sign',
  'signpost', 'spaceship', 'suitcase', 'tourist information centre', 'traffic lights',
  'tunnel', 'tyre/tire', 'vehicle', 'visa', 'waiting room', 'windscreen'];
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const has = (s) => assert.ok(html.includes(s), 'missing ' + s);
const lacks = (s) => assert.ok(!html.includes(s), 'unexpected ' + s);

function stubbed(a, rows) {
  const calls = [];
  a.w.XMLHttpRequest = function () {
    const self = this;
    this.open = function (m, u) { calls.push(String(u)); };
    this.setRequestHeader = function () {};
    this.send = function () {
      self.readyState = 4; self.status = 200;
      self.responseText = JSON.stringify(rows || []);
      if (self.onreadystatechange) self.onreadystatechange();
    };
    this.abort = function () {};
  };
  return calls;
}

test('v32 build: strict ES5, zero external links and well under 442,000 bytes', () => {
  acorn.parse(script, { ecmaVersion: 5 });
  assert.ok(Buffer.byteLength(html) < 442000, 'actual bytes: ' + Buffer.byteLength(html));
  assert.doesNotMatch(html, /<link\b|<script[^>]+src=|@import/i);
  assert.doesNotMatch(script, /\b(?:const|let)\s|=>|\basync\s+function\b|\bawait\s|`/);
  assert.equal(html.match(/<script>/g).length, 1, 'one executable inline script');
  assert.equal(html.match(/<script type="text\/plain"/g).length, 1, 'one inert Apps Script source');
  assert.equal((html.match(/<source\b/g) || []).length, 0, 'no <source> children inside the live videos');
  assert.ok(html.includes('<body class="wallpaper-on tint-clear" data-theme="dark"'), 'first-paint wallpaper class');
  assert.match(html, /<video id="bgLiveVideo" class="bg-live-video" src="\.\/assets\/bunny-live-wallpaper\.mp4"[^>]*autoplay[^>]*><\/video>/);
});

test('v32 metadata: ver 32, appVersion 3.9.1, paper mode, 14% dim and the bunny video', () => {
  for (const d of [version, config, session]) {
    assert.ok(Number(d.ver) >= 32, 'ver is 32');
    assert.equal(d.settingsRev, 32);
    assert.equal(d.appVersion, '3.9.1');
    assert.equal(d.version, '3.9.1');
    assert.equal(d.mode, 'paper');
    assert.equal(d.activeVideoSrc, DEFAULT);
    assert.equal(d.activeMediaType, 'video');
    assert.equal(d.videoDim, 14);
    assert.equal(d.videoPlaylistMode, 'loop');
    assert.equal(d.storageKey, KEY);
    assert.deepEqual(d.repoFallbacks, []);
    assert.ok(Array.isArray(d.repoMedia) && d.repoMedia.length >= 1);
    assert.equal(d.repoMedia[0].src, DEFAULT);
    assert.equal(d.repoMedia[0].type, 'video');
    assert.ok(!JSON.stringify(d).includes('fatal-390'));
    assert.ok(!JSON.stringify(d).includes('home-390'));
    assert.ok(!JSON.stringify(d).includes('qa/evidence'));
  }
  assert.equal(config.defaults.mode, 'paper');
  assert.equal(config.defaults.wallpaperVideo, true);
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.activeVideoSrc, DEFAULT);
  assert.equal(config.defaults.activeMediaType, 'video');
  assert.equal(config.defaults.videoDim, 14);
  assert.equal(session.session.mode, 'paper');
  assert.equal(session.session.videoDim, 14);
  has('var APP_VERSION="3.9.1"');
  has('var DEFAULT_WALLPAPER_SRC="' + DEFAULT + '"');
  has('key:"' + KEY + '"');
  has('schema:32');
  has('settingsRev:32');
  has('videoDim:14');
  has('resetToV32:function');
});

test('normalizeAssetPath converts every URL form to ./assets/<file>', () => {
  const a = harness();
  try {
    const q = a.q;
    assert.equal(q.normalizeAssetPath(RAW_URL), DEFAULT);
    assert.equal(q.normalizeAssetPath('assets/bunny-live-wallpaper.mp4'), DEFAULT);
    assert.equal(q.normalizeAssetPath('/assets/bunny-live-wallpaper.mp4?x=1#t=1.2'), DEFAULT);
    assert.equal(q.normalizeAssetPath('./assets/bunny-live-wallpaper.mp4'), DEFAULT);
    assert.equal(q.normalizeAssetPath('https://dictationb1.github.io/assets/bunny-live-wallpaper.mp4?v=32'), DEFAULT);
    assert.equal(q.normalizeAssetPath('http://localhost:8000/assets/extra.webp'), './assets/extra.webp');
    assert.equal(q.normalizeAssetPath('file:///home/user/dictationb1.github.io/assets/bunny-live-wallpaper.mp4'), DEFAULT);
    assert.equal(q.normalizeAssetPath(''), '');
    assert.equal(q.normalizeAssetPath(null), '');
    assert.equal(q.normalizeAssetPath(42), '');
    assert.equal(q.normalizeAssetPath('./qa/evidence/fatal-390.png'), '');
    assert.equal(q.isAssetsMedia(RAW_URL), true);
    assert.equal(q.isAssetsMedia('https://dictationb1.github.io/assets/bunny-live-wallpaper.mp4#t=1.2'), true);
    assert.equal(q.isAssetsMedia('/assets/bunny-live-wallpaper.mp4?v=32'), true);
    assert.equal(q.isAssetsMedia('./qa/evidence/fatal-390.png'), false);
    assert.equal(q.isAssetsMedia('./assets/fatal-390.png'), false);
    assert.equal(q.isAssetsMedia('./assets/home-390.png'), false);
    assert.equal(q.isAssetsMedia('./assets/v31-old.mp4'), false);
    assert.equal(q.isAssetsMedia('./assets/artifact-1.png'), false);
    assert.equal(q.isAssetsMedia('./assets/bunny-poster.webp'), false, 'posters are helpers, not wallpapers');
  } finally { a.close(); }
});

test('bunny-live-wallpaper.mp4 is the 100% default active video and plays on boot', () => {
  const a = harness();
  try {
    const q = a.q, doc = a.w.document, lf = q.LiveWallpaper;
    assert.equal(q.CONFIG.repoMedia[0].src, DEFAULT);
    assert.equal(q.CONFIG.repoMediaPaths.join('|'), DEFAULT);
    assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
    assert.equal(q.DB.data.settings.activeMediaType, 'video');
    assert.equal(q.DB.data.settingsRev, 32);
    assert.equal(q.DB.data.v, 32);
    assert.equal(lf.activeSrc, DEFAULT);
    assert.equal(lf.activeType, 'video');
    assert.equal(lf.enabled, true);
    assert.equal(lf.mediaList[0].src, DEFAULT);
    assert.equal(lf.mediaList[0].title, 'Bunny Live Wallpaper');
    assert.ok(q.CONFIG.repoMedia.every((m) => q.isAssetsMedia(m.src)), 'CONFIG.repoMedia is normalised');
    assert.ok(lf.mediaList.every((m) => q.isAssetsMedia(m.src) && m.folder === 'assets'), 'LiveWallpaper.mediaList is normalised');
    const video = doc.querySelector('#bgLiveVideo');
    assert.ok(video);
    assert.equal(video.getAttribute('src'), DEFAULT);
    assert.equal(video.muted, true);
    assert.equal(video.defaultMuted, true);
    assert.equal(video.loop, true);
    assert.equal(video.autoplay, true);
    assert.equal(video.querySelectorAll('source').length, 0);
    assert.ok(doc.querySelector('#bgLiveAmbilight'), 'the synchronized ambilight');
    assert.equal(doc.body.classList.contains('wallpaper-on'), true);
    assert.equal(typeof lf.ensurePlaying, 'function');
    assert.equal(typeof lf.bindPlaybackGuards, 'function');
    assert.equal(typeof q.DB.syncRemote, 'function');
    lf.openGallerySheet();
    a.clock.tick(120);
    const cards = doc.querySelectorAll('#videoGalleryList .video-gallery-item');
    assert.equal(cards.length, 1, 'one real repository card');
    assert.equal(doc.querySelector('.gal-title').textContent, 'Bunny Live Wallpaper');
    const badge = doc.querySelector('.video-gallery-badge');
    assert.equal(badge.textContent, '✓ Active Now');
    assert.equal(badge.style.display, 'inline-flex');
  } finally { a.close(); }
});

test('applyPublishedVideo / ensurePlaying never reset an already playing video', () => {
  const a = harness();
  try {
    const q = a.q, v = a.w.document.querySelector('#bgLiveVideo');
    let loads = 0, plays = 0, pauses = 0;
    v.load = function () { loads++; };
    v.play = function () { plays++; return null; };
    v.pause = function () { pauses++; };
    q.LiveWallpaper.ensurePlaying();
    q.LiveWallpaper.ensurePlaying();
    assert.equal(loads, 0, 'the bundled src is never reloaded');
    assert.ok(plays >= 2, 'play() is called immediately and from the idempotent guards');
    assert.equal(pauses, 0);
    q.DB.syncRemote({ activeVideoSrc: RAW_URL });
    assert.equal(loads, 0, 'a remote full URL normalises to the same src and does not reset playback');
    assert.equal(q.LiveWallpaper.activeSrc, DEFAULT);
    assert.equal(v.muted, true);
    assert.equal(v.loop, true);
    assert.equal(v.autoplay, true);
    q.LiveWallpaper.applyPublishedVideo('./assets/swan-lake.mp4');
    assert.equal(loads, 1, 'a genuinely different normalised asset is loaded exactly once');
    assert.equal(q.DB.data.settings.activeVideoSrc, './assets/swan-lake.mp4');
    const before = loads;
    q.LiveWallpaper.ensurePlaying();
    assert.equal(loads, before, 'the second ensurePlaying keeps the new src');
  } finally { a.close(); }
});

test('DB.syncRemote never installs a non-assets wallpaper and always re-triggers playback', () => {
  const a = harness();
  try {
    const q = a.q;
    assert.equal(q.DB.syncRemote({ activeVideoSrc: './qa/evidence/fatal-390.png' }), DEFAULT);
    assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
    assert.equal(q.DB.data.settings.activeMediaType, 'video');
    assert.equal(q.LiveWallpaper.activeSrc, DEFAULT);
    assert.equal(q.DB.syncRemote({ activeVideoSrc: RAW_URL }), DEFAULT);
    q.Cloud.applyRepo({ activeVideoSrc: 'https://evil.example/wallpaper.mp4', lists: [] });
    assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
    q.Cloud.applyState({ activeVideoSrc: '/assets/bunny-live-wallpaper.mp4?v=32#t=1.2' });
    assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
    assert.equal(q.LiveWallpaper.ensurePlaying(), undefined, 'ensurePlaying is safe to call repeatedly');
  } finally { a.close(); }
});

test('CSS: full-brightness video and ultra-clear glass in Lite and Full modes', () => {
  assert.ok(css.includes('filter:brightness(1.02) contrast(1.05) saturate(1.12) !important'), 'brightness(1.02)');
  assert.ok(css.includes('opacity:1 !important'), 'the video is fully opaque');
  assert.ok(!css.includes('brightness(0.76)'), 'the old 0.76 dimmer is gone');
  assert.ok(!css.includes('blur(22px)'), 'the old 22px glass blur is gone');
  assert.ok(css.includes('#bgLiveWrap{position:fixed;inset:0;width:100vw;height:100vh;z-index:0 !important;pointer-events:none;overflow:hidden;display:block'));
  assert.ok(css.includes('body.wallpaper-on #bgLiveWrap{display:block !important}'));
  assert.ok(css.includes('body.wallpaper-on .bg-aurora,body.wallpaper-on .bg-grid{display:none !important;opacity:0 !important}'));
  assert.ok(css.includes('--bg-dim:0.14'), 'default 14% vignette');
  assert.ok(css.includes('var(--bg-dim, 0.14)'), 'scrim uses 0.14');
  assert.ok(css.includes('background: rgba(6, 10, 22, 0.28) !important'), 'crystal glass background');
  assert.ok(css.includes('blur(4px) saturate(140%) !important'), 'light 4px glass blur');
  assert.ok(css.includes('body.wallpaper-on[data-perf="lite"] .glass:not(#materialMixer)'), 'Lite mode is clear');
  assert.ok(css.includes('body.wallpaper-on[data-perf="full"] .glass:not(#materialMixer)'), 'Full mode is clear');
  assert.ok(css.includes('#homeHero.glass') && css.includes('.wordcard.glass') && css.includes('.sheet.glass'), 'hero, player and sheets are clear');
  assert.ok(css.includes('rgba(255, 255, 255, 0.32) !important'), 'light theme crystal glass');
  assert.ok(css.includes('background: rgba(4, 8, 18, 0.08) !important'), 'the Dictation Player layer is clear');
  assert.ok(css.includes('background: rgba(4, 8, 18, 0.18) !important'), 'the ready-sheet scrim is clear');
  assert.ok(css.includes('backdrop-filter: none !important'), 'no blur on the layer or scrim');
  assert.ok(css.includes('body.layer-open .app,body.layer-open #app{opacity:0 !important;pointer-events:none !important}'));
  assert.ok(css.includes('body.sheet-open .app > main'));
  assert.ok(css.includes('opacity:0.12 !important'), 'no opaque pseudo overlays');
  assert.ok(css.includes('text-shadow:0 2px 10px rgba(0, 0, 0, 0.95)'), 'razor-sharp dark halo');
  assert.ok(css.includes('text-shadow:0 1px 6px rgba(255, 255, 255, 0.95)'), 'razor-sharp light halo');
  has('#sVideoDim');
  has('#bgContrastScrim');
  has('id="credit"');
  has('#credit{z-index:9999 !important}');
});

test('discoverGitHubMedia normalises download_url and rejects posters, nested files and screenshots', () => {
  const a = harness();
  try {
    const q = a.q;
    const calls = stubbed(a, [
      { name: 'bunny-live-wallpaper.mp4', path: 'assets/bunny-live-wallpaper.mp4', download_url: RAW_URL, type: 'file' },
      { name: 'extra.webp', download_url: 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/extra.webp', type: 'file' },
      { name: 'bunny-poster.webp', path: 'assets/bunny-poster.webp', type: 'file' },
      { name: 'thumb.png', path: 'assets/thumb.png', type: 'file' },
      { name: 'fatal-390.png', path: 'qa/evidence/fatal-390.png', type: 'file' },
      { name: 'home-390.png', path: 'qa/evidence/home-390.png', type: 'file' },
      { name: 'root-video.mp4', path: 'root-video.mp4', type: 'file' },
      { name: 'nested.webp', path: 'assets/deep/nested.webp', type: 'file' }
    ]);
    q.LiveWallpaper.discoverGitHubMedia(true, function () {});
    a.clock.tick(60);
    assert.equal(calls.length, 1, 'one request: ' + JSON.stringify(calls));
    assert.ok(calls[0].indexOf('/contents/assets') > 0);
    assert.ok(!/git\/trees/.test(calls[0]));
    const srcs = q.LiveWallpaper.mediaList.map((m) => m.src);
    assert.equal(srcs.join('|'), [DEFAULT, './assets/extra.webp'].join('|'));
    srcs.forEach((s) => assert.ok(q.isAssetsMedia(s), 'assets only: ' + s));
    assert.equal(q.LiveWallpaper.mediaList.filter((m) => /fatal|home-390|poster/i.test(m.src)).length, 0);
    assert.ok(a.w.localStorage.getItem('sdp.gh_assets_v32'), 'the v32 cache is written');
    assert.equal(a.w.localStorage.getItem('sdp.gh_assets_v31'), null);
    assert.equal(a.w.localStorage.getItem('sdp.gh_media_v30'), null);
    q.LiveWallpaper.discoverGitHubMedia(false, function () {});
    a.clock.tick(20);
    assert.equal(calls.length, 1, 'the five-minute cache is reused');
  } finally { a.close(); }
});

test('Session 7 keeps all 30 words, the 5s timer, x2 repeats and the Amy en-GB voice', () => {
  const list = session.lists.find((l) => l.id === 'list_session_7_travel');
  assert.ok(list, 'Session 7 list');
  assert.equal(list.words.length, 30);
  assert.deepEqual(list.words.map((w) => w.w), words);
  assert.equal(list.words.filter((w) => w.w === 'tyre/tire').length, 1);
  assert.equal(session.session.title, title);
  assert.equal(session.session.no, '7');
  has('writeFixed:5');
  has('repeats:2');
  has('voice=Amy');
  has('Amy · en-GB');
  has(title);
  has('data-mode="paper" aria-selected="true"');
  const a = harness();
  try {
    const q = a.q;
    assert.equal(q.DB.data.settings.mode, 'paper');
    assert.equal(q.DB.data.settings.writeFixed, 5);
    assert.equal(q.DB.data.settings.repeats, 2);
    assert.equal(q.SAMPLE_WORDS.length, 30);
    assert.equal(q.SAMPLE_WORDS.map((w) => w.w).join('|'), words.join('|'));
    assert.equal(q.Lib.searchWords('tyre', q.Lib.current().words, q.SAMPLE_LIST_ID).map((w) => w.w).join('|'), 'tyre/tire');
  } finally { a.close(); }
});

test('v32 migration resets stale Fatal 390 / Home 390 selections to the bunny video', () => {
  const a = harness();
  try {
    const q = a.q;
    const stale = { lists: [], settingsRev: 31, v: 31, settings: { activeVideoSrc: './qa/evidence/fatal-390.png', activeMediaType: 'image', videoPlaylistMode: 'bogus', videoDim: 34 } };
    const migrated = q.DB.migrate(stale);
    assert.equal(migrated.settings.activeVideoSrc, DEFAULT);
    assert.equal(migrated.settings.activeMediaType, 'video');
    assert.equal(migrated.settings.videoPlaylistMode, 'loop');
    assert.equal(migrated.settings.videoDim, 14);
    assert.equal(migrated.settingsRev, 32);
    assert.equal(migrated.v, 32);
    const direct = q.DB.resetToV32({ lists: [], settingsRev: 29, v: 29, settings: { activeVideoSrc: './qa/evidence/home-390.png', activeMediaType: 'image' } }, q.DB.defaults());
    assert.equal(direct.settings.activeVideoSrc, DEFAULT);
    assert.equal(direct.settings.activeMediaType, 'video');
    assert.equal(direct.settingsRev, 32);
    assert.equal(direct.v, 32);
    q.DB.data.settings.activeVideoSrc = './qa/evidence/home-390.png';
    q.DB.data.settings.activeMediaType = 'image';
    q.LiveWallpaper.init();
    assert.equal(q.LiveWallpaper.activeSrc, DEFAULT, 'init forces the bunny video');
    assert.equal(q.LiveWallpaper.activeType, 'video');
    assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
  } finally { a.close(); }
});

test('the 0-75 dimmer defaults to 14 and writes --bg-dim', () => {
  has('min="0" max="75" step="1" value="14"');
  has('14%');
  const a = harness();
  try {
    const q = a.q, lf = q.LiveWallpaper;
    assert.equal(lf.dimValue(), 14);
    const node = lf.dimControl();
    assert.equal(node.querySelector('#sVideoDim').min, '0');
    assert.equal(node.querySelector('#sVideoDim').max, '75');
    assert.equal(node.querySelector('#sVideoDim').value, '14');
    lf.setDim(0);
    assert.equal(a.w.document.documentElement.style.getPropertyValue('--bg-dim'), '0.00');
    assert.equal(q.DB.data.settings.videoDim, 0);
    lf.setDim(50);
    assert.equal(a.w.document.documentElement.style.getPropertyValue('--bg-dim'), '0.50');
    assert.equal(q.DB.data.settings.videoDim, 50);
    lf.applyDim();
    assert.equal(q.DB.data.settings.videoDim, 50);
  } finally { a.close(); }
});

test('sheets and the Dictation Player layer never hide or pause the live video', () => {
  const a = harness();
  try {
    const q = a.q, doc = a.w.document, v = doc.querySelector('#bgLiveVideo');
    let pauses = 0;
    const realPause = v.pause.bind(v);
    v.pause = function () { pauses++; return realPause(); };
    q.UI.openWelcomeGuide();
    a.clock.tick(120);
    assert.ok(doc.querySelector('#sheets .sheet.open'), 'the User Guide sheet is open');
    assert.equal(doc.body.classList.contains('sheet-open'), true);
    q.UI.closeSheet();
    a.clock.tick(40);
    assert.equal(doc.body.classList.contains('sheet-open'), false);
    q.UI.layer({ title: 'QA player', body: function (e) { e.appendChild(doc.createTextNode('word')); } });
    a.clock.tick(60);
    assert.equal(doc.body.classList.contains('layer-open'), true);
    q.UI.closeLayer();
    assert.equal(doc.body.classList.contains('layer-open'), false);
    assert.equal(pauses, 0, 'no screen ever pauses the wallpaper');
    assert.equal(q.LiveWallpaper.enabled, true);
    assert.equal(q.LiveWallpaper.activeSrc, DEFAULT);
    assert.equal(doc.body.classList.contains('wallpaper-on'), true);
  } finally { a.close(); }
});

test('every v22-v31 feature token and guard is still present in the v32 build', () => {
  ['repoMedia', 'mediaList', 'discoverGitHubMedia', 'contents/assets', 'openGallerySheet',
    'gal-thumb', 'video-gallery-badge', 'Next Wallpaper', 'Refresh from GitHub',
    'sdp.gh_assets_v32', 'sdp_wallpaper_db', 'activeMediaType', 'videoDim',
    'bgLiveVideo', 'bgLiveAmbilight', 'bgLiveCanvas', 'bgContrastScrim', 'bgLivePhoto',
    'bgLivePhotoAmbilight', 'sVideoDim', '--bg-dim', 'wallpaperVideo', 'videoPlaylistMode',
    'syncAmbilight', 'playAmbilight', 'rafId:null', 'wake:function', 'sleep:function',
    'draw:function', 'startPractisingFromGuide', 'guide-credit-pill', 'cancelReadyAndExit',
    'buildSearchIndex', 'searchWords', 'diffChars', 'ansCompare', 'streak-broken',
    'plTickHero', 'plWrongHero', '💔 Streak Broken! (0)', 'ansMirrorText', 'ans-caret',
    'inp.value=" "', 'autocomplete","off")', 'tabInd', 'segSync', 'lgStage', 'materialMixer',
    'hollow', 'DEFAULT_WALLPAPER_SRC', 'resetToV32', 'sanitiseWallpaper', 'isAssetsMedia',
    'normalizeAssetPath', 'ensurePlaying', 'syncRemote', 'navigator.serviceWorker',
    '?v=32', 'CREDITS GOES TO', 'Hansana', 'tire:"tyre"', 'tyre/tire'].forEach(has);
  lacks('<link');
  lacks('inp.type="password"');
  lacks('fatal-390.png');
  lacks('home-390.png');
  lacks('qa/evidence');
  assert.equal(require('./test-pin.cjs'), '7898', 'the public convenience PIN verifier still unlocks 7898');
});

test('no media file is tracked outside the assets folder', () => {
  const files = cp.execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter((p) => /\.(mp4|webm|mov|m4v|webp|jpe?g|png|gif|avif)$/i.test(p));
  assert.ok(files.length >= 1);
  files.forEach((p) => {
    assert.ok(/^assets\/[^\/]+$/i.test(p), 'repository media lives in assets/: ' + p);
    assert.ok(!/fatal-390|home-390/i.test(p), 'no test screenshots: ' + p);
  });
  assert.ok(files.indexOf('assets/bunny-live-wallpaper.mp4') >= 0);
  assert.ok(files.indexOf('assets/bunny-poster.webp') >= 0);
});
