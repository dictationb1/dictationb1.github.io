'use strict';

/* v31 release gates.
   The wallpaper studio is strictly limited to files saved directly inside
   /assets/, ./assets/bunny-live-wallpaper.mp4 is the 100% default active video
   and the live video stays visible behind the Home screen, every tab, the
   .layer Dictation Player and the Results screen. Every v22-v30 dictation,
   typing, search, credit, guide, ambilight and 120 FPS gate is kept. */
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
const key = 'sdp.v31_assets_only';
const DEFAULT = './assets/bunny-live-wallpaper.mp4';
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
const ASSET_RE = /^(\.\/)?assets\/[^\/]+\.(mp4|webm|mov|m4v|jpg|jpeg|png|webp|gif|avif)$/i;
const isAsset = (src) => ASSET_RE.test(String(src || '')) &&
  !/(-poster|poster|thumb|fatal|home-390|test|spec|icon)/i.test(String(src || '').split('/').pop());
function lastRule(selector) {
  const at = css.lastIndexOf(selector + '{');
  assert.ok(at >= 0, 'CSS rule exists: ' + selector);
  return css.slice(at, css.indexOf('}', at) + 1);
}
function click(a, node) {
  assert.ok(node, 'button exists');
  node.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function openPlayer(a) {
  const doc = a.w.document;
  a.q.DB.data.settings.mode = 'type';
  a.q.Eng.start({});
  a.clock.tick(60);
  const skip = Array.from(doc.querySelectorAll('#sheets button'))
    .find((b) => b.textContent.trim() === 'Skip countdown');
  click(a, skip);
  a.clock.tick(4000);
  assert.ok(doc.getElementById('ansInput'), 'the dictation player opened');
  return doc;
}
const stubbed = (a, rows) => {
  const calls = [];
  a.w.XMLHttpRequest = function () {
    const self = this;
    this.open = function (m, u) { calls.push(String(u)); self._u = String(u); };
    this.setRequestHeader = function () {};
    this.send = function () {
      self.readyState = 4;
      self.status = 200;
      self.responseText = JSON.stringify(rows || []);
      if (self.onreadystatechange) self.onreadystatechange();
    };
    this.abort = function () {};
  };
  return calls;
};

test('v31 build: strict ES5, self-contained and under the 442,000-byte mark', () => {
  acorn.parse(script, { ecmaVersion: 5 });
  assert.ok(Buffer.byteLength(html) < 442000, 'actual bytes: ' + Buffer.byteLength(html));
  assert.doesNotMatch(html, /<link\b|<script[^>]+src=|@import/i);
  assert.doesNotMatch(script, /\b(?:const|let)\s|=>|\basync\s+function\b|\bawait\s|`/);
  assert.equal(html.match(/<script>/g).length, 1, 'one executable inline script');
  assert.equal(html.match(/<script type="text\/plain"/g).length, 1, 'one inert Apps Script source');
});

test('v31 metadata: ver 31, appVersion 3.9.0, paper mode and the bunny wallpaper', () => {
  for (const d of [version, config, session]) {
    assert.ok(Number(d.ver) >= 31, 'ver is 31');
    assert.equal(d.settingsRev, 31);
    assert.equal(d.appVersion, '3.9.0');
    assert.equal(d.version, '3.9.0');
    assert.equal(d.mode, 'paper');
    assert.equal(d.activeVideoSrc, DEFAULT);
    assert.equal(d.activeMediaType, 'video');
    assert.equal(d.videoPlaylistMode, 'loop');
    assert.deepEqual(d.repoFallbacks, []);
    assert.ok(Array.isArray(d.repoMedia) && d.repoMedia.length >= 1);
    assert.equal(d.repoMedia[0].src, DEFAULT);
    assert.equal(d.repoMedia[0].type, 'video');
    d.repoMedia.forEach((m) => assert.ok(isAsset(m.src), 'assets only: ' + m.src));
    assert.ok(!JSON.stringify(d).includes('fatal-390'));
    assert.ok(!JSON.stringify(d).includes('home-390'));
    assert.ok(!JSON.stringify(d).includes('qa/evidence'));
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
  has('var APP_VERSION="3.9.0"');
  has('var DEFAULT_WALLPAPER_SRC="./assets/bunny-live-wallpaper.mp4"');
  has('key:"' + key + '"');
  has('schema:31');
  has('settingsRev:31');
  has('resetToV31:function');
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
  const a = harness();
  try {
    const d = a.q.DB.data;
    assert.equal(d.settings.mode, 'paper');
    assert.equal(d.settings.writeFixed, 5);
    assert.equal(d.settings.repeats, 2);
    assert.equal(a.q.SAMPLE_WORDS.length, 30);
    assert.equal(a.q.SAMPLE_WORDS.map((w) => w.w).join('|'), words.join('|'));
    assert.equal(a.w.document.querySelector('#segMode [data-mode="paper"]').getAttribute('aria-selected'), 'true');
    assert.equal(a.q.CONFIG.ttsBackupHost.indexOf('voice=Amy') > 0, true);
  } finally { a.close(); }
});

test('bunny-live-wallpaper.mp4 is the 100% default active video and plays on boot', () => {
  has('DEFAULT_WALLPAPER_SRC="./assets/bunny-live-wallpaper.mp4"');
  assert.ok(isAsset(DEFAULT));
  const a = harness();
  try {
    const lf = a.q.LiveWallpaper;
    assert.equal(a.q.CONFIG.repoMedia[0].src, DEFAULT);
    assert.equal(a.q.CONFIG.repoMedia[0].type, 'video');
    assert.equal(a.q.DB.data.settings.activeVideoSrc, DEFAULT);
    assert.equal(a.q.DB.data.settings.activeMediaType, 'video');
    assert.equal(lf.activeSrc, DEFAULT);
    assert.equal(lf.activeType, 'video');
    assert.equal(lf.enabled, true);
    assert.equal(lf.mediaList[0].src, DEFAULT);
    assert.equal(lf.mediaList[0].title, 'Bunny Live Wallpaper');
    const video = a.w.document.querySelector('#bgLiveVideo');
    assert.ok(video, 'the live video element');
    assert.equal(video.getAttribute('src'), DEFAULT);
    assert.ok(a.w.document.querySelector('#bgLiveAmbilight'), 'the synchronized ambilight');
    assert.equal(a.w.document.querySelectorAll('#bgLiveVideo source').length, 1);
    assert.equal(a.w.document.querySelector('#bgLiveVideo source').getAttribute('src'), DEFAULT);
    assert.equal(a.w.document.body.classList.contains('wallpaper-on'), true);
    lf.openGallerySheet();
    a.clock.tick(120);
    const cards = a.w.document.querySelectorAll('#videoGalleryList .video-gallery-item');
    assert.equal(cards.length, 1, 'one real repository card');
    assert.equal(a.w.document.querySelector('.gal-title').textContent, 'Bunny Live Wallpaper');
    const badge = a.w.document.querySelector('.video-gallery-badge');
    assert.equal(badge.textContent, '✓ Active Now');
    assert.equal(badge.style.display, 'inline-flex');
    assert.equal(a.w.document.querySelectorAll('.video-gallery-badge').length, 1);
  } finally { a.close(); }
});

test('stale Fatal 390 / Home 390 selections are reset to the bunny video', () => {
  const a = harness();
  try {
    const q = a.q;
    const stale = { lists: [], settingsRev: 30, v: 30, settings: { activeVideoSrc: './qa/evidence/fatal-390.png', activeMediaType: 'image', videoPlaylistMode: 'bogus' } };
    const migrated = q.DB.migrate(stale);
    assert.equal(migrated.settings.activeVideoSrc, DEFAULT);
    assert.equal(migrated.settings.activeMediaType, 'video');
    assert.equal(migrated.settings.videoPlaylistMode, 'loop');
    assert.equal(migrated.settingsRev, 31);
    const direct = q.DB.resetToV31({ lists: [], settingsRev: 29, v: 29, settings: { activeVideoSrc: './qa/evidence/home-390.png', activeMediaType: 'image' } }, q.DB.defaults());
    assert.equal(direct.settings.activeVideoSrc, DEFAULT);
    assert.equal(direct.settings.activeMediaType, 'video');
    assert.equal(direct.settingsRev, 31);
    assert.equal(direct.v, 31);
    q.DB.data.settings.activeVideoSrc = './qa/evidence/home-390.png';
    q.DB.data.settings.activeMediaType = 'image';
    q.LiveWallpaper.init();
    assert.equal(q.LiveWallpaper.activeSrc, DEFAULT, 'init forces the bunny video');
    assert.equal(q.LiveWallpaper.activeType, 'video');
    assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
    assert.equal(q.isAssetsMedia('./qa/evidence/fatal-390.png'), false);
    assert.equal(q.isAssetsMedia('./assets/bunny-poster.webp'), false, 'posters are helpers, not wallpapers');
    assert.equal(q.isAssetsMedia('./assets/bunny-live-wallpaper.mp4'), true);
  } finally { a.close(); }
});

test('CONFIG.repoMedia and LiveWallpaper.mediaList hold only /assets/ files', () => {
  lacks('fatal-390.png');
  lacks('home-390.png');
  lacks('qa/evidence');
  lacks('git/trees/main?recursive=1');
  lacks('repoTreeUrl');
  lacks('Fallback path');
  has('contents/assets');
  has('only the assets folder');
  lacks('the full GitHub tree');
  has('ghMediaCache:"sdp.gh_assets_v31"');
  has('legacyMediaCaches:["sdp.gh_media_v30","sdp.gh_videos_cache"]');
  const a = harness();
  try {
    const q = a.q;
    assert.equal(q.CONFIG.repoContentsUrl, 'https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/assets');
    assert.equal(q.CONFIG.ghMediaCache, 'sdp.gh_assets_v31');
    assert.equal(q.CONFIG.repoMediaPaths.join('|'), DEFAULT);
    q.CONFIG.repoMedia.forEach((m) => assert.ok(isAsset(m.src), 'repo media: ' + m.src));
    q.LiveWallpaper.mediaList.forEach((m) => {
      assert.ok(isAsset(m.src), 'runtime media: ' + m.src);
      assert.equal(m.folder, 'assets');
    });
    assert.equal(q.LiveWallpaper.mediaList.filter((m) => /fatal|home-390/i.test(m.src)).length, 0);
    q.LiveWallpaper.mediaList.forEach((m) => assert.ok(!/fatal|home-390|poster/i.test(m.title), 'clean title: ' + m.title));
  } finally { a.close(); }
});

test('discoverGitHubMedia reads only contents/assets and rejects posters and screenshots', () => {
  const a = harness();
  try {
    const q = a.q;
    const calls = stubbed(a, [
      { name: 'bunny-live-wallpaper.mp4', path: 'assets/bunny-live-wallpaper.mp4', type: 'file' },
      { name: 'extra.webp', path: 'assets/extra.webp', type: 'file' },
      { name: 'bunny-poster.webp', path: 'assets/bunny-poster.webp', type: 'file' },
      { name: 'thumb.png', path: 'assets/thumb.png', type: 'file' },
      { name: 'test-shot.png', path: 'assets/test-shot.png', type: 'file' },
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
    assert.equal(q.LiveWallpaper.mediaList[0].src, DEFAULT, 'bunny is always first');
    srcs.forEach((s) => assert.ok(isAsset(s), 'assets only: ' + s));
    assert.ok(a.w.localStorage.getItem('sdp.gh_assets_v31'), 'the v31 cache is written');
    assert.equal(a.w.localStorage.getItem('sdp.gh_media_v30'), null);
    assert.equal(a.w.localStorage.getItem('sdp.gh_videos_cache'), null);
    q.LiveWallpaper.discoverGitHubMedia(false, function () {});
    a.clock.tick(20);
    assert.equal(calls.length, 1, 'the five-minute cache is reused');
  } finally { a.close(); }
});

test('the .layer Dictation Player and Results screen are translucent over the live video', () => {
  const layerAt = css.indexOf('.layer{position:fixed;inset:0;');
  assert.ok(layerAt >= 0, 'the v31 .layer rule exists');
  const layer = css.slice(layerAt, css.indexOf('}', layerAt) + 1);
  assert.match(layer, /position:fixed/);
  assert.match(layer, /z-index:60/);
  assert.match(layer, /background: rgba\(4, 8, 18, 0\.16\) !important/);
  assert.match(layer, /-webkit-backdrop-filter: none !important/);
  assert.match(layer, /backdrop-filter: none !important/);
  assert.ok(css.includes('body[data-theme="light"] .layer,:root[data-theme="light"] .layer{background: rgba(232, 236, 244, 0.22) !important}'), 'light theme keeps the video visible');
  assert.ok(css.includes('body.layer-open #app{visibility:hidden}'), 'the Home screen gets out of the way instead of stacking over the video');
  has('U.setCls(document.body,"layer-open",!0)');
  has('U.setCls(document.body,"layer-open",!1)');
  lacks('U.el("div","player-backdrop"');
  lacks('U.el("div","player-orb"');
  const a = harness();
  try {
    const q = a.q;
    const doc = openPlayer(a);
    const player = doc.querySelector('.layer');
    assert.ok(player, 'the Dictation Player layer');
    assert.equal(player.querySelectorAll('.stripes, .disc, .player-backdrop').length, 0);
    q.Results.open({ listId: q.SAMPLE_LIST_ID, answers: [], total: 0, correct: 0 });
    a.clock.tick(80);
    const layers = doc.querySelectorAll('.layer');
    assert.ok(layers.length >= 2, 'the Results layer opened too');
    assert.equal(doc.body.classList.contains('layer-open'), true, 'the Home screen hides while a layer is open');
    layers.forEach((node) => assert.equal(node.querySelectorAll('.stripes, .disc, .player-backdrop').length, 0));
  } finally { a.close(); }
});

test('the live wallpaper video is never hidden or paused by .layer or .sheet', () => {
  const a = harness();
  try {
    const q = a.q;
    const doc = a.w.document;
    const video = doc.querySelector('#bgLiveVideo');
    assert.ok(video);
    let pauses = 0;
    const realPause = video.pause.bind(video);
    video.pause = function () { pauses += 1; return realPause(); };
    q.UI.openWelcomeGuide();
    a.clock.tick(120);
    assert.ok(doc.querySelector('#sheets .sheet'), 'the User Guide sheet opened');
    assert.equal(pauses, 0, 'the guide never pauses the wallpaper');
    q.UI.closeSheet();
    a.clock.tick(40);
    openPlayer(a);
    assert.equal(pauses, 0, 'the Dictation Player never pauses the wallpaper');
    assert.equal(q.LiveWallpaper.enabled, true);
    assert.equal(q.LiveWallpaper.activeSrc, DEFAULT);
    assert.equal(doc.body.classList.contains('wallpaper-on'), true);
    assert.equal(doc.querySelector('#bgLiveWrap').style.display, '');
    assert.equal(video.parentNode, doc.querySelector('#bgLiveWrap'));
    assert.equal(doc.querySelectorAll('#bgLiveWrap #bgLiveVideo').length, 1);
  } finally { a.close(); }
});

test('Home .anatomy-stage, tiles, scrim and bento cards let the video shine through', () => {
  has('<div class="lg-hero"><div class="anatomy-stage"><div class="glass card hero" id="homeHero">');
  lacks('<div class="stripes" aria-hidden="true"></div><div class="disc" aria-hidden="true"></div>');
  assert.ok(css.includes('.anatomy-stage{background: transparent !important;border: 0 !important;box-shadow: none !important;padding: 0 !important}'));
  assert.ok(css.includes('body.wallpaper-on .anatomy-stage{background:transparent !important}'));
  assert.match(css, /#screen-home \.stripes,#screen-home \.disc,\.layer \.stripes,\.layer \.disc,\.layer \.player-backdrop,\.player-backdrop\{display:none !important\}/);
  assert.match(lastRule('.tile::before'), /opacity:0\.38 !important/);
  assert.match(css, /\.tile\{background-color:rgba\(8,13,28,\.38\) !important\}/);
  assert.match(css, /\.bento-sessions\{background:rgba\(10,42,45,\.28\) !important\}/);
  const scrim = lastRule('.scrim');
  assert.match(scrim, /background: rgba\(4, 8, 18, 0\.35\) !important/);
  assert.match(scrim, /backdrop-filter:blur\(4px\)/);
  assert.match(css, /body\[data-theme="dark"\]\{--glass-tint:rgba\(8, 13, 28, \.62\)\}/);
  const a = harness();
  try {
    const doc = a.w.document;
    assert.equal(doc.querySelectorAll('#screen-home .stripes, #screen-home .disc').length, 0);
    assert.ok(doc.querySelector('#homeHero.glass'), 'the hero glass sits over the video');
  } finally { a.close(); }
});

test('words and controls stay crystal clear inside frosted .glass cards', () => {
  const glassRule = '.glass,.wordcard.glass,.card.glass,.topbar.glass,#tabbar.glass{background-color:var(--glass-tint);' +
    '-webkit-backdrop-filter:blur(var(--gb)) saturate(var(--gs)) brightness(var(--gbr));' +
    'backdrop-filter:blur(var(--gb)) saturate(var(--gs)) brightness(var(--gbr));text-shadow:0 1px 3px rgba(0, 0, 0, .75)}';
  assert.ok(css.includes(glassRule), 'the v31 frosted glass rule');
  has('--gb:14px');
  has('#bgContrastScrim');
  has('--bg-dim');
  has('#sVideoDim');
  has('.wordcard.glass');
  has('#tabbar.glass');
  const a = harness();
  try {
    const q = a.q;
    q.LiveWallpaper.setDim(50);
    assert.equal(a.w.document.documentElement.style.getPropertyValue('--bg-dim'), '0.50');
    assert.equal(q.DB.data.settings.videoDim, 50);
    q.LiveWallpaper.applyDim();
    assert.equal(q.DB.data.settings.videoDim, 50);
    assert.ok(q.LiveWallpaper.dimControl(), 'the live dimmer control');
  } finally { a.close(); }
});

test('synchronized ambilight and the sleeping 120 FPS neon canvas are intact', () => {
  has('id="bgLiveAmbilight"');
  has('id="bgLiveCanvas"');
  has('id="bgLivePhotoAmbilight"');
  has('rafId=null');
  has('#ff6f61');
  has('#53c7f0');
  has('wake:function');
  has('sleep:function');
  has('draw:function');
  has('syncAmbilight');
  has('playAmbilight');
  const a = harness();
  try {
    const lf = a.q.LiveWallpaper;
    assert.equal(lf.rafId, null, 'the canvas sleeps at 0% CPU when idle');
    assert.equal(typeof lf.wake, 'function');
    assert.equal(typeof lf.sleep, 'function');
    lf.pulseAudio();
    assert.equal(lf.ripples.length, 0, 'no rings without a 2d context');
  } finally { a.close(); }
});

test('paper answer mode is the default in the app, the data and the segmented control', () => {
  has('mode:"paper"');
  has('data-mode="paper" aria-selected="true"');
  assert.equal(config.defaults.mode, 'paper');
  assert.equal(version.mode, 'paper');
  assert.equal(session.mode, 'paper');
  assert.equal(session.session.mode, 'paper');
  const a = harness();
  try {
    assert.equal(a.q.DB.data.settings.mode, 'paper');
    assert.equal(a.q.DB.defaults().settings.mode, 'paper');
    const seg = a.w.document.querySelector('#segMode');
    assert.equal(seg.querySelector('[data-mode="paper"]').getAttribute('aria-selected'), 'true');
    assert.equal(seg.querySelector('[data-mode="type"]').getAttribute('aria-selected'), 'false');
  } finally { a.close(); }
});

test('the Hansana credit badge is always visible with the swan pill', () => {
  has('id="credit"');
  assert.match(css, /\.credit\{[^}]*z-index:9999!important/);
  has('#credit{z-index:9999 !important}');
  has('UI.showCreditNow');
  has('guide-credit-pill');
  has('CREDITS GOES TO');
  has('Hansana');
  const a = harness();
  try {
    assert.equal(typeof a.q.UI.showCreditNow, 'function');
    const credit = a.w.document.querySelector('#credit');
    assert.ok(credit, 'the swan badge');
    assert.match(credit.textContent, /Hansana/);
    a.q.UI.showCreditNow();
    assert.equal(credit.classList.contains('in'), true);
    a.q.UI.openWelcomeGuide();
    a.clock.tick(80);
    assert.ok(a.w.document.querySelector('#sheets .guide-credit-pill'));
  } finally { a.close(); }
});

test('the User Guide "Start practising" button unlocks audio and starts the dictation', () => {
  has('UI.startPractisingFromGuide');
  has('btnGuideStart');
  has('startPractising');
  const a = harness();
  try {
    const q = a.q;
    assert.equal(typeof q.UI.startPractisingFromGuide, 'function');
    q.UI.startPractisingFromGuide();
    a.clock.tick(300);
    assert.equal(q.DB.data.guideSeen, true);
    assert.equal(q.DB.data.tourSeen, true);
    assert.equal(q.Eng.st, 'ready');
    assert.ok(a.w.document.querySelector('#layers .layer'), 'the dictation player layer opened');
  } finally { a.close(); }
});

test('no save-password popup, no keyboard suggestions and a resetting IME buffer', () => {
  has('inp.type="text"');
  has('inp.setAttribute("autocomplete","off")');
  has('inp.value=" "');
  has('ansMirrorText');
  has('.ans-caret');
  lacks('inp.type="password"');
  lacks('new-password');
  lacks('ansVkb');
  lacks('current-password');
  const a = harness();
  try {
    const doc = openPlayer(a);
    const input = doc.getElementById('ansInput');
    assert.equal(input.type, 'text');
    assert.equal(input.getAttribute('autocomplete'), 'off');
    assert.ok(doc.getElementById('ansMirrorText'), 'the plain-text mirror');
    assert.ok(doc.querySelector('.ans-caret'), 'the caret');
    assert.equal(doc.querySelectorAll('input[type="password"]').length, 0);
  } finally { a.close(); }
});

test('tick, streak breakdown, cross, diffChars compare and tyre/tire matching', () => {
  ['#ansTick', '#plTickHero', '#ansWrong', '#plWrongHero', '#ansCompare', 'diffChars', 'streak-broken',
    '💔 Streak Broken! (0)', 'tick-ring', 'hero-tick-path', 'hero-cross-line', 'cmp-ok', 'cmp-miss'].forEach(has);
  has('tire:"tyre"');
  has('tyre/tire');
  has('is-correct');
  const list = session.lists.find((l) => l.id === 'list_session_7_travel');
  assert.ok(list.words.some((w) => w.w === 'tyre/tire'));
  const a = harness();
  try {
    const q = a.q;
    const current = q.Lib.current();
    const hits = q.Lib.searchWords('tyre', current.words, current.id).map((w) => w.w);
    assert.equal(hits.join('|'), 'tyre/tire');
  } finally { a.close(); }
});

test('the "Are you ready?" sheet keeps a single far-right exit', () => {
  has('Eng.cancelReadyAndExit');
  lacks('btnReadyClose');
  lacks('btnNotReady');
  const a = harness();
  try {
    const q = a.q;
    q.Eng.start({});
    a.clock.tick(120);
    const sheet = a.w.document.querySelector('#sheets .sheet');
    assert.ok(sheet, 'the ready sheet');
    assert.match(sheet.querySelector('h2').textContent, /Are you ready/i);
    assert.equal(sheet.querySelectorAll('.shead button[aria-label="Close"]').length, 1, 'one far-right close cross');
    assert.equal(sheet.querySelectorAll('button').length, sheet.querySelectorAll('.sbody button, .sfoot button').length + 1);
    assert.equal(a.w.document.querySelectorAll('#sheets .sheet .shead button[aria-label="Close"]').length, 1);
    assert.equal(typeof q.Eng.cancelReadyAndExit, 'function');
  } finally { a.close(); }
});

test('instant search index and the Session 7 list render', () => {
  has('Lib.buildSearchIndex');
  has('Lib.searchWords');
  has('prepareSearchIndex');
  has('id="dictSearch"');
  const a = harness();
  try {
    const q = a.q;
    const current = q.Lib.current();
    assert.equal(current.words.length, 30);
    assert.equal(q.Lib.searchWords('luggage', current.words, current.id).map((w) => w.w).join('|'), 'luggage');
    assert.equal(q.Lib.searchWords('', current.words, current.id).length, 30);
    q.Screens.dict();
    a.clock.tick(60);
    assert.equal(a.w.document.querySelectorAll('#dictList .listrow').length, 30);
  } finally { a.close(); }
});

test('hollow hero title, Settings-only mixer, sliding capsules and PIN 7898', () => {
  has('id="homeTitle"');
  assert.match(html, /<span id="homeTitle" class="liquid-glass-text hollow">Session 7 - Travel &amp; Transport</);
  has('#tabInd');
  has('id="tabInd"');
  has('lgStage');
  has('materialMixer');
  has('pinHash');
  has('pinSalt');
  assert.equal(require('./test-pin.cjs'), '7898', 'the public convenience PIN verifier still unlocks 7898');
  const a = harness();
  try {
    const q = a.q;
    const doc = a.w.document;
    q.Screens.home();
    a.clock.tick(60);
    assert.equal(doc.querySelector('#screen-home #lgStage'), null, 'no mixer on Home');
    q.UI.setTab('set');
    a.clock.tick(80);
    assert.ok(doc.querySelector('#screen-set #lgStage'), 'the Material Mixer lives in Settings');
    assert.ok(doc.querySelector('#screen-set #orb'));
    assert.ok(doc.querySelector('#screen-set #materialMixer'));
    assert.ok(doc.querySelector('#tabbar #tabInd'), 'the sliding dock capsule');
    assert.ok(doc.querySelector('#segMode .thumb'), 'the sliding segment capsule');
  } finally { a.close(); }
});

test('every v22-v30 feature token and guard is still present in the v31 build', () => {
  ['repoMedia', 'mediaList', 'discoverGitHubMedia', 'contents/assets', 'openGallerySheet',
    'gal-thumb', 'gal-preview', 'video-gallery-badge', 'Next Wallpaper', 'Refresh from GitHub',
    'encodeURI(', 'item.path', 'sdp.gh_assets_v31', 'sdp_wallpaper_db', 'activeMediaType', 'videoDim',
    'bgLiveVideo', 'bgLiveAmbilight', 'bgLiveCanvas', 'bgContrastScrim', 'bgLivePhoto',
    'sVideoDim', '--bg-dim', 'wallpaperVideo', 'videoPlaylistMode', 'syncAmbilight',
    'startPractisingFromGuide', 'guide-credit-pill', 'cancelReadyAndExit', 'buildSearchIndex',
    'searchWords', 'diffChars', 'ansCompare', 'streak-broken', 'plTickHero', 'plWrongHero',
    'ansMirrorText', 'ans-caret', 'inp.value=" "', 'autocomplete","off")',
    'tabInd', 'segSync', 'lgStage', 'materialMixer', 'hollow', 'DEFAULT_WALLPAPER_SRC',
    'resetToV31', 'sanitiseWallpaper', 'isAssetsMedia'].forEach(has);
  lacks('<link');
  lacks('inp.type="password"');
  assert.equal(html.match(/<script>/g).length, 1);
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
