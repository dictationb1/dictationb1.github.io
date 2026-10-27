'use strict';
/* v33 release gates: strict-ES5 single-file app, one hardware-overlay video with
   zero blur glass and a zero-bandwidth gallery, normalised /assets/ media,
   guaranteed bunny playback, 15-minute GitHub cache and every v22-v32 feature. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs2 = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const acorn = require('acorn');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const json = (name) => JSON.parse(fs2.readFileSync(path.join(root, 'data', name), 'utf8'));
const version = json('version.json');
const config = json('config.json');
const session = json('session.json');
const KEY = 'sdp.v33_zero_lag';
const GH_KEY = 'sdp.gh_assets_v33';
const DEFAULT = './assets/bunny-live-wallpaper.mp4';
const POSTER = './assets/bunny-poster.webp';
const HOODED = './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';
const RAW_URL = 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-live-wallpaper.mp4?v=33#t=1.2';

const has = (s, t) => s.indexOf(t) >= 0;
const lacks = (s, t) => s.indexOf(t) < 0;
const cssText = () => {
  const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
};
const scriptBody = () => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  return m ? m[1] : '';
};
const settingsOf = (d) => d.settings || (d.session && d.session.settings) || d.defaults || d;

test('1. v33 build: project check gate passes, strict ES5, zero external links, under 442,000 bytes', () => {
  cp.execSync('node tests/check.cjs', { cwd: root, stdio: 'pipe' });
  const size = Buffer.byteLength(html, 'utf8');
  assert.ok(size < 442000, 'index.html must stay below 442,000 bytes (now ' + size + ')');
  assert.ok(size < 450000);
  assert.equal((html.match(/<script/g) || []).length, 2);
  assert.ok(has(html, '<script type="text/plain" id="gas-source">'), 'the Apps Script source stays inert');
  assert.equal((html.match(/<link/g) || []).length, 0, 'zero external <link> tags');
  assert.ok(!/rel=["']?stylesheet/.test(html));
  assert.ok(!/<source[\s>]/i.test(html), 'no <source> tags anywhere');
  const body = scriptBody();
  acorn.parse(body, { ecmaVersion: 5 });
  assert.ok(!/\bconst\s|\blet\s|=>|\x60|\basync\b|\bawait\b/.test(body), 'strict ES5 vocabulary only');
  const tag = html.match(/<video id="bgLiveVideo"[^>]*>/)[0];
  assert.ok(has(tag, 'src="' + DEFAULT + '"'));
  assert.ok(has(tag, 'poster="' + POSTER + '"'));
  assert.ok(has(tag, 'autoplay') && has(tag, 'muted') && has(tag, 'playsinline'));
  assert.ok(!/[?&](t|v)=/.test(tag), 'no cache-busting query on the media URL');
  const ambi = html.match(/<video id="bgLiveAmbilight"[^>]*>/)[0];
  assert.ok(has(ambi, 'preload="none"') && lacks(ambi, 'src='), 'ambilight is markup-only and never loads a stream');
  const tpl = html.match(/<template id="galMediaTpl">[\s\S]*?<\/template>/)[0];
  assert.ok(has(tpl, 'preload="none"') && has(tpl, 'data-src=""') && has(tpl, 'loading="lazy"'));
  assert.equal((html.match(/\.json\?v=33/g) || []).length, 2);
  assert.ok(lacks(html, '?v=32'), 'all static data fetches are on the v33 cache token');
});

test('2. v33 metadata across version.json, config.json and session.json', () => {
  [['version', version], ['config', config], ['session', session]].forEach(([name, d]) => {
    assert.equal(d.ver, 33, name + ' ver');
    assert.equal(d.appVersion, '4.0.0', name + ' appVersion');
    assert.equal(d.settingsRev, 33, name + ' settingsRev');
    assert.equal(d.storageKey, KEY, name + ' storageKey');
    assert.equal(d.ghMediaCache, GH_KEY, name + ' ghMediaCache');
    assert.equal(d.ghMediaTtl, 900000, name + ' 15-minute GitHub TTL');
    assert.ok(Array.isArray(d.legacyMediaCaches) && d.legacyMediaCaches.indexOf('sdp.gh_assets_v32') >= 0, name + ' legacy cache list');
    const s = settingsOf(d);
    assert.equal(s.mode, 'paper', name + ' paper mode');
    assert.equal(s.activeVideoSrc, DEFAULT, name + ' bunny default');
    assert.equal(s.activeMediaType, 'video', name + ' video type');
    assert.equal(s.videoDim, 14, name + ' 14% dim');
  });
  assert.equal(version.version, '4.0.0');
  assert.equal(config.version, '4.0.0');
  assert.equal(session.version, '4.0.0');
  assert.equal(config.defaults.wallpaperVideo, true);
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.ok(has(html, 'voice=Amy'), 'Amy en-GB online voice retained');
});

test('3. normalizeAssetPath / isAssetsMedia: every URL form becomes ./assets/<file>, helpers rejected', () => {
  const a = harness();
  const q = a.q;
  assert.equal(q.normalizeAssetPath(DEFAULT), DEFAULT);
  assert.equal(q.normalizeAssetPath(RAW_URL), DEFAULT);
  assert.equal(q.normalizeAssetPath('/assets/bunny-live-wallpaper.mp4#frag'), DEFAULT);
  assert.equal(q.normalizeAssetPath('https://dictationb1.github.io/assets/bunny-live-wallpaper.mp4?token=abc'), DEFAULT);
  assert.equal(q.normalizeAssetPath('https://github.com/dictationb1/dictationb1.github.io/blob/main/assets/clip.mov?raw=true'), './assets/clip.mov');
  assert.equal(q.normalizeAssetPath('http://localhost:8000/assets/a.webm'), './assets/a.webm');
  assert.equal(q.normalizeAssetPath('http://127.0.0.1:8000/assets/a.mp4'), './assets/a.mp4');
  assert.equal(q.normalizeAssetPath('assets/a.mp4'), './assets/a.mp4');
  assert.equal(q.normalizeAssetPath('  ./assets/a.m4v  '), './assets/a.m4v');
  assert.equal(q.normalizeAssetPath('./assets/sub/nested.mp4'), '', 'nested files rejected');
  assert.equal(q.normalizeAssetPath('https://evil.example.com/x.mp4'), '', 'foreign hosts rejected');
  assert.equal(q.normalizeAssetPath('javascript:alert(1)'), '');
  assert.equal(q.normalizeAssetPath(''), '');
  assert.equal(q.isAssetsMedia(DEFAULT), true);
  [
    POSTER, './assets/v31-clip.mp4', './assets/v32-clip.mp4', './assets/v33-clip.mp4',
    './assets/poster.banana.mp4', './assets/test-fixture.mp4', './assets/artifact-1.png',
    './assets/thumb-1.jpg', './assets/fatal-390.png', './assets/home-390.png',
    './assets/spec-shot.webp', './assets/icon-tiny.png', './assets/sub/dir.mp4'
  ].forEach((bad) => assert.equal(q.isAssetsMedia(bad), false, bad + ' must be rejected'));
  a.close();
});

test('4. boot: bunny is the 100% default video, single overlay plays, gallery DOM and gallery streams do not exist yet', () => {
  const a = harness();
  const q = a.q, w = a.w, doc = w.document, lf = q.LiveWallpaper;
  assert.equal(q.APP_VERSION, '4.0.0');
  assert.equal(q.CONFIG.key, KEY);
  assert.equal(q.CONFIG.schema, 33);
  assert.equal(q.CONFIG.settingsRev, 33);
  assert.equal(q.DB.data.settingsRev, 33);
  assert.equal(q.DB.data.v, 33);
  assert.equal(lf.activeSrc, DEFAULT);
  assert.equal(lf.activeType, 'video');
  assert.equal(lf.enabled, true);
  assert.equal(lf._loadedSrc, DEFAULT, '_loadedSrc guard is armed on boot');
  const v = doc.querySelector('#bgLiveVideo');
  assert.equal(v.getAttribute('src'), DEFAULT);
  assert.equal(v.getAttribute('poster'), POSTER);
  assert.ok(!v.getAttribute('src').match(/[?&]/));
  const ambi = doc.querySelector('#bgLiveAmbilight');
  assert.ok(ambi, 'ambilight element remains in the DOM');
  assert.equal(ambi.getAttribute('src'), null);
  assert.equal(ambi.querySelectorAll('source').length, 0);
  assert.equal(ambi.style.display, 'none');
  assert.equal(doc.querySelector('#videoGalleryList'), null, 'no gallery DOM on boot');
  assert.equal(doc.querySelectorAll('.gal-thumb').length, 0, 'no gallery media nodes on boot');
  a.close();
});

test('5. lazy gallery: poster image for the bunny, zero-bandwidth video cards, preview loads only on tap', () => {
  const a = harness();
  const q = a.q, w = a.w, doc = w.document, lf = q.LiveWallpaper;
  lf.openGallerySheet();
  a.clock.tick(120);
  const host = doc.querySelector('#videoGalleryList');
  assert.ok(host, 'gallery is built only when the sheet opens');
  const cards = host.querySelectorAll('.video-gallery-item');
  assert.equal(cards.length, 1);
  const bunny = cards[0];
  const img = bunny.querySelector('img.gal-thumb');
  assert.ok(img, 'the postered clip renders an <img>, not a streaming video');
  assert.equal(img.getAttribute('src'), POSTER);
  assert.equal(img.getAttribute('loading'), 'lazy');
  assert.equal(bunny.querySelectorAll('video.gal-thumb').length, 0);
  const bunnyPreview = bunny.querySelector('.gal-preview-btn');
  assert.equal(bunnyPreview.style.display, 'none', 'postered clips do not offer a stream preview');
  const status = doc.querySelector('#galStreamStatus');
  assert.ok(status && /Playing/.test(status.textContent), 'streaming status indicator is live');
  const savedList = lf.mediaList.slice();
  lf.mediaList.push({ id: 'gh_hooded', title: 'Hooded', src: HOODED, type: 'video', folder: 'assets', poster: '', origin: 'github' });
  lf.renderGalleryList();
  const vids = host.querySelectorAll('video.gal-thumb');
  assert.equal(vids.length, 1);
  const remote = vids[0];
  assert.equal(remote.getAttribute('preload'), 'none');
  assert.equal(remote.hasAttribute('src'), false, 'inactive clip carries no src until preview');
  assert.equal(remote.getAttribute('data-src'), HOODED);
  let loads = 0;
  remote.load = function () { loads++; };
  remote.play = function () { return null; };
  const buttons = host.querySelectorAll('.gal-preview-btn');
  assert.equal(buttons.length, 2);
  assert.notEqual(buttons[1].style.display, 'none');
  buttons[1].click();
  assert.equal(remote.getAttribute('src'), HOODED);
  assert.equal(remote.getAttribute('preload'), 'auto');
  assert.equal(loads, 1, 'preview starts exactly one load');
  buttons[1].click();
  assert.equal(loads, 1, 'a second preview tap never reloads the same clip');
  lf.mediaList = savedList;
  a.close();
});

test('6. applyPublishedVideo / ensurePlaying / _loadedSrc never reload an already playing video', () => {
  const a = harness();
  const q = a.q, w = a.w, lf = q.LiveWallpaper;
  const v = w.document.querySelector('#bgLiveVideo');
  let loads = 0;
  v.load = function () { loads++; };
  lf._loadedSrc = DEFAULT;
  v.setAttribute('src', DEFAULT);
  lf.applyPublishedVideo(DEFAULT);
  assert.equal(loads, 0);
  assert.equal(lf._loadedSrc, DEFAULT);
  lf.ensurePlaying();
  assert.equal(loads, 0);
  lf.applyVideo(DEFAULT);
  assert.equal(loads, 0, 're-applying the same src skips load()');
  lf.applyPublishedVideo('https://evil.example.net/x.mp4');
  assert.equal(lf.activeSrc, DEFAULT, 'foreign published URLs fall back to the bunny');
  assert.equal(lf.selectMedia(HOODED), true);
  assert.equal(v.getAttribute('src'), HOODED);
  assert.equal(lf._loadedSrc, HOODED);
  assert.equal(loads, 1, 'switching clips loads the new stream exactly once');
  lf.applyVideo(HOODED);
  assert.equal(loads, 1);
  assert.doesNotThrow(() => { lf.recoverVideo(); lf.recoverVideo(); });
  a.clock.tick(4001);
  assert.doesNotThrow(() => { lf.recoverVideo(); }, 'stall recovery is throttled to one attempt per 4s');
  assert.doesNotThrow(() => { v.dispatchEvent(new w.Event('stalled')); v.dispatchEvent(new w.Event('waiting')); });
  a.close();
});

test('7. DB.syncRemote never installs a non-assets wallpaper and always re-triggers playback', () => {
  const a = harness();
  const q = a.q, lf = q.LiveWallpaper;
  const out = q.DB.syncRemote({ activeVideoSrc: 'https://evil.example.net/steal.mp4' });
  assert.equal(out, DEFAULT);
  assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
  assert.equal(lf.activeSrc, DEFAULT);
  const out2 = q.DB.syncRemote({ session: { activeVideoSrc: RAW_URL } });
  assert.equal(out2, DEFAULT);
  const out3 = q.DB.syncRemote({ defaults: { activeVideoSrc: HOODED }, videoDim: 42 });
  assert.equal(out3, HOODED);
  assert.equal(q.DB.data.settings.videoDim, 42);
  assert.equal(lf.activeSrc, HOODED);
  assert.equal(q.DB.data.settings.activeMediaType, 'video');
  a.close();
});

test('8. v33 CSS: one filter-free hardware overlay, hidden ambilight, zero-blur glass with the exact tint tokens', () => {
  const css = cssText();
  const videoRule = css.match(/#bgLiveVideo\{[^}]*\}/)[0];
  assert.ok(has(videoRule, 'filter:none !important'));
  assert.ok(has(videoRule, '-webkit-filter:none !important'));
  assert.ok(has(videoRule, 'will-change:transform;transform:translateZ(0)'));
  assert.ok(lacks(videoRule, 'blur(') && lacks(videoRule, 'brightness('));
  assert.ok(has(css, '#bgLiveAmbilight{display:none !important;'));
  const glassRule = css.match(/\.glass:not\(#materialMixer\)[^}]*rgba\(6, 10, 22, 0\.30\)[^}]*\}/)[0];
  assert.ok(has(glassRule, '.wordcard.glass') && has(glassRule, '.topbar.glass') && has(glassRule, '#tabbar.glass'));
  assert.ok(has(glassRule, 'background: rgba(6, 10, 22, 0.30) !important'));
  assert.ok(has(glassRule, 'backdrop-filter: none !important'));
  assert.ok(has(glassRule, 'border: 1px solid rgba(255, 255, 255, 0.22) !important'));
  assert.ok(has(glassRule, 'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28) !important'));
  const lightRule = css.match(/:root\[data-theme="light"\] \.glass:not\(#materialMixer\)[^}]*\}/)[0];
  assert.ok(has(lightRule, 'background: rgba(255, 255, 255, 0.34) !important'));
  assert.ok(has(lightRule, 'backdrop-filter: none !important'));
  assert.ok(has(css, 'background: rgba(4, 8, 18, 0.08) !important'));
  assert.ok(has(css, '.scrim{background: rgba(4, 8, 18, 0.18) !important'));
  assert.ok(has(css, '--bg-dim:0.14'));
  assert.ok(has(css, 'text-shadow:0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.98) !important'), 'dark text shadow kept');
  assert.ok(has(css, 'text-shadow:0 1px 6px rgba(255, 255, 255, 0.95) !important'), 'light text shadow kept');
  assert.ok(lacks(css, 'blur(4px) saturate(140%)'));
  assert.ok(lacks(css, 'brightness(1.02)'));
  assert.ok((css.match(/backdrop-filter: none !important/g) || []).length >= 5);
});

test('9. discoverGitHubMedia: contents/assets only, 15-minute cache under sdp.gh_assets_v33, legacy caches purged', () => {
  const a = harness();
  const q = a.q, w = a.w, lf = q.LiveWallpaper;
  const rows = [
    { type: 'file', name: 'hooded_red_eyes_live_wallpaper_1080p_loop.mp4', path: 'assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4', download_url: 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4?token=zz' },
    { type: 'file', name: 'mountains.webp', path: 'assets/mountains.webp', download_url: 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/mountains.webp' },
    { type: 'file', name: 'bunny-poster.webp', path: 'assets/bunny-poster.webp', download_url: 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-poster.webp' },
    { type: 'file', name: 'v32-legacy.mp4', path: 'assets/v32-legacy.mp4', download_url: 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/v32-legacy.mp4' },
    { type: 'file', name: 'test-fixture.mov', path: 'assets/test-fixture.mov', download_url: 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/test-fixture.mov' },
    { type: 'dir', name: 'nested', path: 'assets/nested' }
  ];
  const calls = [];
  w.XMLHttpRequest = function () {
    this.open = (m, u) => { this.url = u; calls.push(u); };
    this.setRequestHeader = () => {};
    this.abort = () => {};
    this.send = () => { this.readyState = 4; this.status = 200; this.responseText = JSON.stringify(rows); this.onreadystatechange(); };
  };
  let done = 0;
  lf.discoverGitHubMedia(true, () => { done++; });
  assert.equal(done, 1);
  assert.deepEqual(calls, ['https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/assets']);
  const srcs = lf.mediaList.map((m) => m.src);
  assert.ok(srcs.indexOf(HOODED) >= 0, 'remote mp4 normalised and listed');
  assert.ok(srcs.indexOf('./assets/mountains.webp') >= 0, 'remote photo listed');
  assert.ok(srcs.every((s) => !s.match(/[?#]/)), 'no query strings or fragments on media URLs');
  assert.ok(srcs.every((s) => q.isAssetsMedia(s)), 'every listed file is an /assets/ media file');
  assert.equal(srcs.indexOf('./assets/bunny-poster.webp'), -1);
  assert.equal(srcs.indexOf('./assets/v32-legacy.mp4'), -1);
  assert.equal(srcs.indexOf('./assets/test-fixture.mov'), -1);
  const cached = JSON.parse(w.localStorage.getItem(GH_KEY));
  assert.ok(cached && cached.at, 'cache written under the v33 key with a timestamp');
  lf.discoverGitHubMedia(false, () => {});
  assert.equal(calls.length, 1, 'a warm 15-minute cache means zero new requests');
  a.clock.tick(900001);
  lf.discoverGitHubMedia(false, () => {});
  assert.equal(calls.length, 2, 'after 15 minutes the cache is stale and refetches');
  w.localStorage.setItem('sdp.gh_assets_v32', 'old');
  w.localStorage.setItem('sdp.gh_videos_cache', 'older');
  lf.purgeLegacyCaches();
  assert.equal(w.localStorage.getItem('sdp.gh_assets_v32'), null);
  assert.equal(w.localStorage.getItem('sdp.gh_videos_cache'), null);
  assert.ok(w.localStorage.getItem(GH_KEY), 'the v33 cache itself is never purged');
  a.close();
});

test('10. Session 7 keeps all 30 travel words, the 5s timer, x2 repeats and the Amy en-GB voice', () => {
  const list = session.lists.filter((l) => l.id === 'list_session_7_travel')[0];
  assert.ok(list, 'Session 7 list present');
  assert.equal(list.version, '4.0.0');
  const words = list.words.map((x) => x.w);
  assert.equal(words.length, 30);
  ['guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration', 'journey',
   'luggage', 'machine', 'mechanic', 'nationality', 'on business', 'on vacation', 'overnight',
   'passenger', 'public transport', 'reception', 'reservation', 'road sign', 'signpost',
   'spaceship', 'suitcase', 'tourist information centre', 'traffic lights', 'tunnel',
   'tyre/tire', 'vehicle', 'visa', 'waiting room', 'windscreen'].forEach((wrd) =>
    assert.ok(words.indexOf(wrd) >= 0, wrd + ' missing from Session 7'));
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.ok(has(html, 'ttsBackupHost') && has(html, 'voice=Amy'));
});

test('11. v33 migration resets stale Fatal 390 / Home 390 selections back to the bunny video', () => {
  const a = harness();
  const q = a.q;
  const stale = () => ({
    v: 32, settingsRev: 32,
    settings: { mode: 'paper', activeVideoSrc: './qa/evidence/fatal-390.png', activeMediaType: 'photo', videoDim: 60 },
    lists: [], results: {}, comments: [], inbox: []
  });
  const out = q.DB.migrate(stale());
  assert.equal(out.settings.activeVideoSrc, DEFAULT);
  assert.equal(out.settings.activeMediaType, 'video');
  assert.equal(out.settings.videoDim, 14);
  assert.equal(out.settingsRev, 33);
  assert.equal(out.v, 33);
  const direct = stale();
  q.DB.resetToV33(direct, {});
  assert.equal(direct.settings.activeVideoSrc, DEFAULT);
  assert.equal(direct.settings.activeMediaType, 'video');
  assert.equal(direct.settingsRev, 33);
  const good = q.DB.migrate({
    v: 33, settingsRev: 33,
    settings: { mode: 'paper', activeVideoSrc: HOODED, activeMediaType: 'video', videoDim: 14 },
    lists: [], results: {}
  });
  assert.equal(good.settings.activeVideoSrc, HOODED, 'a valid current-rev assets clip is not touched');
  assert.equal(typeof q.DB.resetToV33, 'function');
  a.close();
});

test('12. the 0-75 dimmer defaults to 14 and writes --bg-dim', () => {
  const a = harness();
  const q = a.q, w = a.w, lf = q.LiveWallpaper;
  const node = lf.dimControl();
  const input = node.querySelector('#sVideoDim');
  assert.equal(input.min, '0');
  assert.equal(input.max, '75');
  assert.equal(input.value, '14');
  lf.setDim(42);
  assert.equal(q.DB.data.settings.videoDim, 42);
  assert.equal(w.document.documentElement.style.getPropertyValue('--bg-dim'), '0.42');
  lf.setDim(999);
  assert.equal(q.DB.data.settings.videoDim, 75);
  lf.setDim(-8);
  assert.equal(q.DB.data.settings.videoDim, 0);
  lf.setDim(14);
  a.close();
});

test('13. sheets, settings and the Dictation Player layer never hide or pause the live video', () => {
  const a = harness();
  const q = a.q, w = a.w, lf = q.LiveWallpaper;
  const v = w.document.querySelector('#bgLiveVideo');
  let pauses = 0;
  v.pause = function () { pauses++; };
  lf.openGallerySheet();
  a.clock.tick(120);
  assert.equal(lf.enabled, true);
  q.UI.closeSheet();
  a.clock.tick(60);
  assert.equal(pauses, 0, 'closing a sheet does not pause the video');
  assert.equal(v.style.opacity, '1');
  q.Screens.settings();
  a.clock.tick(60);
  assert.equal(pauses, 0, 'the settings screen does not pause the video');
  assert.equal(lf.activeSrc, DEFAULT);
  a.close();
});

test('14. every v22-v33 feature token and guard is still present in the v33 build', () => {
  [
    '#bgLiveWrap', '#bgLiveAmbilight', '#bgLiveVideo', '#bgLiveCanvas', '#bgContrastScrim',
    '#bgLivePhoto', '#liveVideoInput', 'video-gallery-badge',
    'syncAmbilight:function(){}', 'playAmbilight:function(){}',
    'renderGallery:function', 'previewThumb:function', 'renderGalleryList:function',
    'startPractisingFromGuide', 'diffChars', 'streak-broken', 'plTickHero', 'plWrongHero',
    'ansMirrorText', 'ans-caret', 'materialMixer', 'CREDITS GOES TO',
    'tire:"tyre"', 'tyre/tire', 'navigator.serviceWorker', 'sdp_wallpaper_db',
    'wake:function', 'sleep:function', 'draw:function', 'rafId:null',
    '💔 Streak Broken! (0)', 'guide-credit-pill', 'cancelReadyAndExit',
    'inp.value=" "', 'autocomplete","off")', 'tabInd', 'segSync', 'lgStage', 'hollow',
    'sanitiseWallpaper', 'syncRemote', 'buildSearchIndex', 'searchWords', 'ansCompare',
    'Next Wallpaper', 'Refresh from GitHub', 'resetToV33:function',
    'sdp.v33_zero_lag', 'sdp.gh_assets_v33', '_loadedSrc', 'adaptPerformance:function',
    'gal-preview-btn', 'bindStreamStatus:function', 'recoverVideo:function',
    'liteFx:function', 'markPlaying:function', '?v=33'
  ].forEach((token) => assert.ok(has(html, token), 'missing token: ' + token));
  [
    'backdrop-filter: blur(4px)', 'backdrop-filter:blur(4px)', 'brightness(1.02)',
    'blur(4px) saturate(140%)'
  ].forEach((token) => assert.ok(lacks(html, token), 'legacy token must be gone: ' + token));
});

test('15. no media file is tracked outside the assets folder', () => {
  const exts = /\.(mp4|webm|mov|m4v|jpe?g|png|webp|gif|avif)$/i;
  const skip = new Set(['.git', 'node_modules']);
  const offenders = [];
  const walk = (dir) => fs2.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (skip.has(entry.name)) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (exts.test(entry.name) && path.relative(path.join(root, 'assets'), full).startsWith('..')) {
      offenders.push(path.relative(root, full));
    }
  });
  walk(root);
  assert.deepEqual(offenders, []);
});

test('16. performance adaptation: low-end detection, lite ripple caps, passive listeners and visibility pause', () => {
  const a = harness();
  const q = a.q, lf = q.LiveWallpaper;
  assert.equal(typeof lf.adaptPerformance, 'function');
  assert.equal(typeof lf.lowEnd, 'boolean');
  lf.adaptPerformance();
  assert.equal(lf.liteFx(), lf.lowEnd || q.UI.perfMode === 'lite');
  const prev = q.UI.perfMode;
  q.UI.perfMode = 'lite';
  assert.equal(lf.liteFx(), true);
  q.UI.perfMode = prev;
  assert.ok(has(html, 'var cap=this.liteFx()?12:20'), 'lite ripple cap is 12 particles');
  assert.ok(has(html, 'addSpark:function(e,t,n,i,a){if(this.liteFx())return;'), 'sparks are disabled in lite');
  assert.ok(has(html, 'for(s=0;s<(lite?1:3);s++)'), 'lite clicks emit a single ring');
  assert.ok(has(html, 'OPTS={passive:!0}'));
  assert.ok(has(html, '"touchstart"!==t&&"touchmove"!==t&&"scroll"!==t||(a.passive=!0)'), 'touch/scroll listeners are passive by default');
  assert.ok(has(html, 'U.on(document,"visibilitychange"'), 'visibilitychange is bound');
  assert.ok(/visibilitychange"[^]*?t\.pause\(\)/.test(html), 'the video pauses when the tab hides');
  assert.ok(has(html, 'hardwareConcurrency') && has(html, 'deviceMemory') && has(html, 'saveData'));
  a.close();
});

test('17. admin PIN gate still returns 7898 and the media assets exist at the v33 byte budgets', () => {
  const pin = require('./test-pin.cjs');
  assert.equal(pin, '7898');
  const mp4 = fs2.statSync(path.join(root, 'assets', 'bunny-live-wallpaper.mp4')).size;
  const poster = fs2.statSync(path.join(root, 'assets', 'bunny-poster.webp')).size;
  assert.ok(mp4 > 0 && mp4 <= 1600000, 'bunny mp4 must stay around 1.0-1.6 MB (' + mp4 + ' bytes)');
  assert.ok(poster > 0 && poster < 30000, 'poster must stay under 30 KB (' + poster + ' bytes)');
});
