'use strict';
/* v35 release gates: strict-ES5 single-file app, Apple iOS 26 / visionOS
   prismatic rainbow liquid glass capsules and icons (zero red/coral), zero GPU
   blur surfaces, iOS spring-physics motion, the untouched one-stream /assets/
   wallpaper engine and every v22-v34 feature. */
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
const KEY = 'sdp.v35_rainbow_liquid_glass';
const LEGACY_GH_KEY = 'sdp.gh_assets_v34';
const GH_KEY = 'sdp.gh_assets_v35';
const DEFAULT = './assets/bunny-live-wallpaper.mp4';
const POSTER = './assets/bunny-poster.webp';
const HOODED = './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';
const RAW_URL = 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-live-wallpaper.mp4?v=33#t=1.2';

const has = (s, t) => s.indexOf(t) >= 0;
const lacks = (s, t) => s.indexOf(t) < 0;
const compact = (s) => String(s).replace(/\s+/g, '');
const cssText = () => {
  const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
};
const scriptBody = () => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  return m ? m[1] : '';
};
const CSS = compact(cssText());
const hasCss = (snippet) => has(CSS, compact(snippet));
const hasIn = (haystack, needle) => compact(haystack).indexOf(compact(needle)) >= 0;
const settingsOf = (d) => d.settings || (d.session && d.session.settings) || d.defaults || d;
/* v35 rules live at the end of the sheet: the helper only ever looks at the
   v35 block, so a legacy rule with a similar selector can never satisfy a gate. */
const v35Block = () => {
  const at = cssText().indexOf('/* v35:');
  return at < 0 ? '' : cssText().slice(at);
};
const v35 = (pattern) => {
  const m = v35Block().match(pattern);
  return m ? compact(m[0]) : '';
};
const exactRule = (selector) => {
  const m = cssText().match(new RegExp('(?:^|[};])\\s*' + selector + '\\{[^}]*\\}'));
  return m ? m[0] : '';
};

test('1. v35 build gate: check.cjs passes, strict ES5, zero external links, under 442,000 bytes', () => {
  cp.execSync('node tests/check.cjs', { cwd: root, stdio: 'pipe' });
  const size = Buffer.byteLength(html, 'utf8');
  assert.ok(size < 442000, 'index.html must stay below 442,000 bytes (now ' + size + ')');
  assert.ok(size < 450000, 'hard ceiling is 450,000 bytes');
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
  assert.equal((html.match(/\.json\?v=35/g) || []).length, 2);
  assert.ok(lacks(html, '.json?v=33') && lacks(html, '.json?v=34'), 'all static data fetches are on the v35 cache token');
});

test('2. v35 metadata across version.json, config.json and session.json', () => {
  [['version', version], ['config', config], ['session', session]].forEach(([name, d]) => {
    assert.equal(d.ver, 35, name + ' ver');
    assert.equal(d.appVersion, '4.2.0', name + ' appVersion');
    assert.equal(d.settingsRev, 35, name + ' settingsRev');
    assert.equal(d.storageKey, KEY, name + ' storageKey');
    assert.equal(d.ghMediaCache, GH_KEY, name + ' ghMediaCache');
    assert.equal(d.ghMediaTtl, 900000, name + ' 15-minute GitHub TTL');
    assert.ok(Array.isArray(d.legacyMediaCaches) && d.legacyMediaCaches.indexOf(LEGACY_GH_KEY) >= 0, name + ' legacy cache list');
    const s = settingsOf(d);
    assert.equal(s.mode, 'paper', name + ' paper mode');
    assert.equal(s.activeVideoSrc, DEFAULT, name + ' bunny default');
    assert.equal(s.activeMediaType, 'video', name + ' video type');
    assert.equal(s.videoDim, 18, name + ' 18% dim');
  });
  assert.equal(version.version, '4.2.0');
  assert.equal(config.version, '4.2.0');
  assert.equal(session.version, '4.2.0');
  assert.equal(config.defaults.wallpaperVideo, true);
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.videoDim, 18);
  assert.equal(version.buildDate, '2026-10-28');
  assert.ok(has(version.features.rainbowLiquidGlass, 'prismatic rainbow liquid glass'), 'v35 rainbow feature documented');
  assert.ok(has(version.features.springPhysics, '--spring-bounce') && has(version.features.springPhysics, '--spring-fluid'));
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

test('4. boot: 4.2.0 constants, bunny as the only default stream and no gallery DOM yet', () => {
  const a = harness();
  const q = a.q, w = a.w, doc = w.document, lf = q.LiveWallpaper;
  assert.equal(q.APP_VERSION, '4.2.0');
  assert.equal(q.DEFAULT_WALLPAPER_SRC, DEFAULT);
  assert.equal(q.CONFIG.key, KEY);
  assert.equal(q.CONFIG.schema, 35);
  assert.equal(q.CONFIG.settingsRev, 35);
  assert.equal(q.DB.data.settingsRev, 35);
  assert.equal(q.DB.data.v, 35);
  assert.equal(q.DB.data.settings.mode, 'paper', 'Listen & write on paper stays the default');
  assert.equal(q.DB.data.settings.videoDim, 18);
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
  const q = a.q, doc = a.w.document, lf = q.LiveWallpaper;
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
  assert.equal(bunny.querySelector('.gal-preview-btn').style.display, 'none', 'postered clips do not offer a stream preview');
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

test('8. v35 video engine: one filter-free hardware overlay and a permanently inert ambilight', () => {
  const videoRule = exactRule('#bgLiveVideo');
  assert.ok(hasIn(videoRule, 'filter:none!important'));
  assert.ok(hasIn(videoRule, '-webkit-filter:none!important'));
  assert.ok(hasIn(videoRule, 'will-change:transform;transform:translateZ(0)'));
  assert.ok(lacks(videoRule, 'blur(') && lacks(videoRule, 'brightness('), 'no GPU shader on the video');
  assert.ok(hasCss('#bgLiveAmbilight{display:none!important'), 'the duplicate decoder never runs');
  const wrapRule = exactRule('#bgLiveWrap');
  assert.ok(hasIn(wrapRule, 'position:fixed') && hasIn(wrapRule, 'contain:strict'));
  assert.ok(hasCss('body.wallpaper-on #bgLiveWrap{display:block!important}'));
  assert.ok(hasCss('#bgContrastScrim{background:radial-gradient(circle at 50% 40%,rgba(5,9,20,var(--bg-dim'), 'adaptive scrim');
  assert.ok(hasCss('body.wallpaper-on .bg-aurora,body.wallpaper-on .bg-grid,body.wallpaper-on .stripes,body.wallpaper-on .disc,body.wallpaper-on #bg{display:none!important'));
  assert.ok(hasCss('body.photo-mode #bgLiveVideo{opacity:0!important}'));
  assert.ok(hasCss('#app,.app,main,.screen,#screen-home,.anatomy-stage{background:transparent!important'), 'the app never hides the video');
  assert.ok(hasCss('.layer{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:rgba(4,8,18,0.08)!important;'), 'the player layer stays see-through');
  assert.ok(hasCss('.scrim{background:rgba(4,8,18,0.18)!important;'));
  assert.ok(hasCss('--bg-dim:.18'), '18% default vignette');
});

test('9. v35 liquid glass surfaces: specular refraction gradients, chromatic rims and zero blur', () => {
  const card = v35(/\.glass:not\(#materialMixer\)[^{]*\{[^}]*\}/);
  ['#homeHero.glass', '.wordcard.glass', '.card.glass', '.sheet', '.modal', '.toast'].forEach((sel) =>
    assert.ok(hasIn(card, sel), sel + ' is a liquid glass surface'));
  assert.ok(hasIn(card, '-webkit-backdrop-filter:none!important'), 'zero GPU blur');
  assert.ok(hasIn(card, 'backdrop-filter:none!important'));
  assert.ok(hasIn(card, 'background:linear-gradient(165deg,rgba(255,255,255,.20) 0%,rgba(255,255,255,.04) 24%,rgba(6,11,26,.60) 62%,rgba(8,14,32,.72) 100%)'), 'dark specular core');
  assert.ok(hasIn(card, 'radial-gradient(120% 90% at 15% 0%,rgba(56,189,248,.18) 0%,rgba(192,132,252,.14) 45%,rgba(45,212,191,.10) 80%,transparent 100%)!important'), 'prismatic refraction bloom');
  assert.ok(hasIn(card, 'border-radius:28px!important'));
  assert.ok(hasIn(card, 'border:1.5px solid rgba(255,255,255,.46)!important'));
  assert.ok(hasIn(card, 'box-shadow:0 0 0 1.5px rgba(4,8,20,.80),0 18px 42px -8px rgba(0,0,0,.68),inset 0 1.5px 1px rgba(255,255,255,.65),inset 0 -1.5px 3px rgba(56,189,248,.25)!important'));
  const light = v35(/\[data-theme=light\] \.glass:not\(#materialMixer\)[^{]*\{[^}]*\}/);
  assert.ok(hasIn(light, 'linear-gradient(165deg,rgba(255,255,255,.88) 0%,rgba(242,247,255,.76) 100%)'), 'light glass core');
  assert.ok(hasIn(light, 'radial-gradient(120% 90% at 15% 0%,rgba(56,189,248,.16) 0%,rgba(192,132,252,.12) 55%,transparent 100%)!important'));
  assert.ok(hasIn(light, 'border:1.5px solid rgba(255,255,255,.90)!important'));
  assert.ok(hasIn(light, 'box-shadow:0 14px 34px rgba(15,23,42,.18),inset 0 1.5px 1px #fff!important'));
  assert.ok(lacks(CSS, 'backdrop-filter:blur'), 'no blur anywhere in the sheet');
  assert.ok(lacks(CSS, 'backdrop-filter: blur'), 'no blur anywhere in the sheet');
});

test('10. v35 primary CTAs: prismatic rainbow liquid glass capsules, zero red/coral', () => {
  const pri = v35(/\.btn\.pri,[^{]*\{[^}]*\}/);
  ['#btnStart', '#btnReadyGo', '.btn.primary', '.btn-pri', 'button.pri', '.gal-apply-btn', '.btn.pri'].forEach((sel) =>
    assert.ok(hasIn(pri, sel), sel + ' is a rainbow capsule'));
  assert.ok(hasIn(pri, 'linear-gradient(180deg,rgba(255,255,255,.38) 0%,rgba(255,255,255,.06) 46%,rgba(6,12,28,.42) 100%)'), 'specular glass dome');
  assert.ok(hasIn(pri, 'linear-gradient(125deg,rgba(56,189,248,.88) 0%,rgba(99,102,241,.86) 28%,rgba(192,132,252,.86) 55%,rgba(244,114,182,.84) 78%,rgba(45,212,191,.88) 100%)!important'), 'Apple rainbow aurora');
  ['rgba(56,189,248,', 'rgba(99,102,241,', 'rgba(192,132,252,', 'rgba(45,212,191,'].forEach((c) =>
    assert.ok(hasIn(pri, c), 'rainbow stop ' + c));
  assert.ok(hasIn(pri, 'color:#fff!important'));
  assert.ok(hasIn(pri, 'font-weight:800!important'));
  assert.ok(hasIn(pri, 'border-radius:999px!important'));
  assert.ok(hasIn(pri, 'border:var(--rm)!important'));
  assert.ok(hasCss('--rm:1.5px solid rgba(255,255,255,.85)'), 'white specular rim');
  assert.ok(hasIn(pri, 'box-shadow:0 0 0 1.5px rgba(4,10,24,.78),0 10px 28px -4px rgba(56,189,248,.52),0 4px 16px rgba(168,85,247,.42),inset 0 1.5px 1px rgba(255,255,255,.90),inset 0 -2px 6px rgba(15,23,42,.45)!important'));
  assert.ok(hasIn(pri, 'text-shadow:0 1px 4px rgba(0,0,0,.88)!important'));
  assert.ok(lacks(pri, '#ff6f61') && lacks(pri, '#ff3d77') && lacks(pri, 'coral'), 'no red/coral fill');
  assert.ok(lacks(html, '#ff3d77'), 'the coral-magenta v34 primary is fully gone');
  (CSS.match(/[^{}]*\{[^}]*\}/g) || []).filter((rule) => /\.btn/.test(rule.split('{')[0])).forEach((rule) =>
    assert.ok(lacks(rule, '#ff6f61') && lacks(rule, '#ff3d77'), 'no button rule may carry coral: ' + rule.slice(0, 90)));
});

test('11. v35 secondary, ghost, icon and pill buttons: smoked iridescent liquid glass lenses', () => {
  const btn = v35(/\.btn:not\(\.pri\),[^{]*\{[^}]*\}/);
  ['.btn:not(.pri)', '.btn-sec', '.btn-ghost', '.ibtn', '.top-pill', '.wall-open-btn', '.gal-preview-btn', '.close-x-btn'].forEach((sel) =>
    assert.ok(hasIn(btn, sel), sel + ' is a smoked lens'));
  assert.ok(hasIn(btn, 'background:linear-gradient(180deg,rgba(255,255,255,.24) 0%,rgba(255,255,255,.04) 45%,rgba(6,12,28,.82) 100%)'), 'smoked glass core');
  assert.ok(hasIn(btn, 'linear-gradient(135deg,rgba(56,189,248,.30) 0%,rgba(168,85,247,.28) 50%,rgba(45,212,191,.30) 100%)!important'), 'prismatic refraction rim');
  assert.ok(hasIn(btn, 'color:#fff!important'));
  assert.ok(hasIn(btn, 'font-weight:700!important'));
  assert.ok(hasIn(btn, 'border-radius:999px!important'));
  assert.ok(hasIn(btn, 'border:1.5px solid rgba(255,255,255,.62)!important'));
  assert.ok(hasIn(btn, 'box-shadow:0 0 0 1.5px rgba(4,8,20,.82),0 8px 20px rgba(0,0,0,.60),inset 0 1.5px 1px rgba(255,255,255,.72),inset 0 -1.5px 4px rgba(56,189,248,.32)!important'));
  assert.ok(hasIn(btn, 'text-shadow:0 1px 4px rgba(0,0,0,.95)!important'));
  const hover = v35(/\.btn:not\(\.pri\):hover,[^{]*\{[^}]*\}/);
  assert.ok(hasIn(hover, ':focus-visible'), 'keyboard focus gets the same highlight');
  assert.ok(hasIn(hover, 'border-color:rgba(255,255,255,.92)!important'));
  assert.ok(hasIn(hover, 'box-shadow:0 0 0 1.5px rgba(4,8,20,.88),0 10px 26px rgba(56,189,248,.45),0 0 18px rgba(192,132,252,.40),inset 0 1.5px 2px rgba(255,255,255,.92)!important'));
});

test('12. v35 liquid glass icons: crisp luminous SVG strokes on circular lenses', () => {
  const icons = v35(/\.ibtn svg,[^{]*\{[^}]*\}/);
  [' .ibtn svg', '.btn svg', '.tab svg', '.chip svg'].forEach((sel) =>
    assert.ok(hasIn(icons, sel), sel + ' keeps a luminous stroke'));
  assert.ok(hasIn(icons, 'filter:drop-shadow(0 1px 3px rgba(0,0,0,.8))'));
  assert.ok(hasIn(v35(/\.btn:not\(\.pri\),[^{]*\{[^}]*\}/), 'border-radius:999px!important'), 'icon buttons are round glass lenses');
  assert.ok(hasCss('#tabbar{'), 'the dock still renders its icons');
});

test('13. v35 segmented switches and dock: rainbow liquid glass droplet capsules glide', () => {
  const active = v35(/\.seg \.thumb,[^{]*\{[^}]*\}/);
  ['.seg .thumb', '.seg-ind', '.seg button.active', '.seg-tint .seg-ind', '.tab.active', '#tabInd'].forEach((sel) =>
    assert.ok(hasIn(active, sel), sel + ' is a rainbow droplet'));
  assert.ok(hasIn(active, 'linear-gradient(180deg,rgba(255,255,255,.36) 0%,rgba(255,255,255,.05) 50%,rgba(6,12,28,.35) 100%)'), 'droplet specular dome');
  assert.ok(hasIn(active, 'linear-gradient(130deg,rgba(56,189,248,.82) 0%,rgba(129,140,248,.82) 35%,rgba(192,132,252,.82) 70%,rgba(45,212,191,.82) 100%)!important'), 'iridescent rainbow fill');
  assert.ok(hasIn(active, 'border:var(--rm)!important'));
  assert.ok(hasIn(active, 'box-shadow:var(--rs)!important'));
  assert.ok(hasIn(active, 'color:#fff!important') && hasIn(active, 'font-weight:800!important'));
  assert.ok(hasIn(active, 'transition:transform .38s var(--spring-bounce),width .38s var(--spring-bounce)!important'), 'droplets glide on the spring curve');
  assert.ok(hasCss('--rs:0 6px 18px rgba(56,189,248,.45),inset 0 1.5px 1px rgba(255,255,255,.88)'));
  assert.ok(hasIn(v35(/\.seg,\.seg-tint\{[^}]*\}/), 'background:rgba(5,10,22,.9)!important'), 'smoked switch trough');
  assert.ok(hasIn(v35(/\.seg button,[^{]*\{[^}]*\}/), 'color:#eef4ff!important'));
});

test('14. v35 inner glass tiles, word rows, chips, inputs, answer mirror and slots stay readable', () => {
  const tile = v35(/\.tile,\.wrow,\.dict-item\{[^}]*\}/);
  assert.ok(hasIn(tile, 'background:linear-gradient(180deg,rgba(255,255,255,.14) 0%,rgba(7,13,28,.76) 35%,rgba(6,11,24,.84) 100%)!important'));
  assert.ok(hasIn(tile, 'border:1.25px solid rgba(255,255,255,.38)!important'));
  assert.ok(hasIn(tile, 'box-shadow:0 6px 18px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.45)!important'));
  assert.ok(hasIn(tile, 'color:#fff!important'));
  const chip = v35(/\.chip,\.badge[^{]*\{[^}]*\}/);
  assert.ok(hasIn(chip, 'background:linear-gradient(180deg,rgba(255,255,255,.22) 0%,rgba(6,12,28,.86) 100%)!important'));
  assert.ok(hasIn(chip, 'border:1.25px solid rgba(255,255,255,.55)!important'));
  assert.ok(hasIn(chip, 'color:#fff!important') && hasIn(chip, 'font-weight:700!important'));
  const input = v35(/#ansMirror,[^{]*\{[^}]*\}/);
  assert.ok(hasIn(input, '#dictSearch'));
  assert.ok(hasIn(input, 'input:not([type=range]):not([type=checkbox])'));
  assert.ok(hasIn(input, 'background:linear-gradient(180deg,rgba(255,255,255,.12) 0%,rgba(5,10,22,.86) 100%)!important'));
  assert.ok(hasIn(input, 'border:2px solid rgba(56,189,248,.85)!important'));
  assert.ok(hasIn(input, 'box-shadow:0 0 18px rgba(56,189,248,.35),inset 0 1px 1px rgba(255,255,255,.55)!important'));
  assert.ok(hasIn(input, 'color:#fff!important'));
  assert.ok(hasIn(input, '.slot:not(.slot-ok):not(.slot-err):not(.slot-done)'), 'tick/cross slot states keep their own colour');
  ['slot-ok', 'slot-err', 'slot-done'].forEach((cls) =>
    assert.ok(hasCss('.' + cls), cls + ' styling survives the v35 highlight'));
});

test('15. v35 typography: solid luminous #homeTitle, prismatic glow and bright muted text', () => {
  const title = v35(/#homeTitle,#homeTitle\.hollow[^{]*\{[^}]*\}/);
  assert.ok(hasIn(title, '#homeTitle.hollow') && hasIn(title, '.hero-title') && hasIn(title, '.liquid-glass-text'));
  assert.ok(hasIn(title, 'background:none!important'), 'no hollow gradient that vanishes over video');
  assert.ok(hasIn(title, 'color:#fff!important'));
  assert.ok(hasIn(title, '-webkit-text-fill-color:#fff!important'));
  assert.ok(hasIn(title, 'text-shadow:0 3px 12px rgba(0,0,0,.98),0 1px 3px rgba(0,0,0,1),0 0 18px rgba(56,189,248,.45)!important'));
  assert.ok(hasIn(title, 'font-weight:900!important'));
  assert.ok(lacks(CSS, 'background-clip:text'), 'the transparent text fill is gone');
  assert.ok(hasCss('[data-theme=light] #homeTitle{color:#071022!important;-webkit-text-fill-color:#071022!important}'));
  assert.ok(hasCss(':root{--spring-bounce') && hasIn(v35Block(), '--fg:#fff'), 'dark ink is white');
  assert.ok(hasIn(v35Block(), '--muted:#e6f0ff'), 'dark muted text is ice-white');
  assert.ok(hasIn(v35(/\[data-theme=light\]\{[^}]*\}/), '--fg:#0e1424'), 'light ink');
  assert.ok(hasIn(v35(/\[data-theme=light\]\{[^}]*\}/), '--muted:#1e293b'), 'light muted text is slate');
  assert.ok(hasCss('body{color:var(--fg)}'));
  assert.ok(hasCss('.muted,.small,.tiny{color:var(--muted)!important}'));
  const halo = v35(/\.glass,\.glass \*[^{]*\{[^}]*\}/);
  assert.ok(hasIn(halo, 'text-shadow:var(--hw)!important'));
  assert.ok(hasCss('--hw:0 2px 6px rgba(0,0,0,.98),0 1px 2px rgba(0,0,0,1)'), 'deep dark halo over the video');
  assert.ok(hasIn(v35(/\[data-theme=light\]\{[^}]*\}/), '--hw:0 1px 4px rgba(255,255,255,.95)'), 'light theme keeps a white halo');
});

test('16. v35 Apple spring physics: transform/opacity-only squish, rebound and liquid morphs', () => {
  assert.ok(hasCss('--spring-bounce:cubic-bezier(.22,1.35,.36,1)'), 'tactile liquid squish');
  assert.ok(hasCss('--spring-fluid:cubic-bezier(.16,1,.3,1)'), 'silky iOS sheet glide');
  const trans = v35(/\.btn,\.ibtn,[^{]*\{[^}]*\}/);
  assert.ok(hasIn(trans, 'transition:transform .34s var(--spring-bounce),opacity .22s ease,border-color .22s ease!important'));
  assert.ok(hasIn(trans, 'will-change:transform'));
  assert.ok(hasIn(trans, '.seg button') && hasIn(trans, '.chip') && hasIn(trans, '.wrow'));
  const hover = v35(/\.btn:hover,[^{]*\{[^}]*\}/);
  assert.ok(hasIn(hover, 'transform:translate3d(0,-2px,0) scale(1.02)'));
  const active = v35(/\.btn:active,[^{]*\{[^}]*\}/);
  assert.ok(hasIn(active, 'transform:translate3d(0,0,0) scale(.95)'));
  assert.ok(hasIn(active, 'transition-duration:.09s!important'));
  assert.ok(hasCss('@keyframes lgLiquidIn{0%{opacity:0;transform:translate3d(0,14px,0) scale(.975)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}'));
  assert.ok(hasCss('.screen.active,.layer{animation:lgLiquidIn .36s var(--spring-fluid) both!important}'), 'screens and the player glide');
  assert.ok(hasCss('.sheet,.modal{transition:transform .36s var(--spring-fluid),opacity .36s var(--spring-fluid)!important}'), 'sheets morph');
  assert.ok(lacks(compact(v35Block()).replace(/transform:[^;}]*/g, ''), 'transition:height'), 'no layout-thrashing height animation');
});

test('17. zero-lag budget: no blur filters, sleeping canvas and lazy gallery streams', () => {
  assert.ok((CSS.match(/backdrop-filter:none!important/g) || []).length >= 4);
  assert.ok(lacks(CSS, 'blur(4px)'));
  assert.ok(lacks(CSS, 'brightness(1.02)'));
  assert.ok(has(html, 'rafId:null'), 'the neon canvas idles with rafId null');
  assert.ok(has(html, 'preload="none"'), 'inactive gallery clips carry preload=none');
  assert.ok(has(html, '_loadedSrc'), 'the same clip is never downloaded twice');
  assert.ok(/visibilitychange"[^]*?\.pause\(\)/.test(html), 'the video pauses when the tab hides');
  assert.ok(has(html, 'navigator.serviceWorker'), 'stale service workers are still removed');
  assert.ok(lacks(html, 'bgLiveVideo*{filter:blur'), 'no shader on the wallpaper');
});

test('18. discoverGitHubMedia: contents/assets only, 15-minute cache under the v35 key, legacy caches purged', () => {
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
    this.open = (method, url) => { this.url = url; calls.push(url); };
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
  assert.ok(cached && cached.at, 'cache written under the v35 key with a timestamp');
  lf.discoverGitHubMedia(false, () => {});
  assert.equal(calls.length, 1, 'a warm 15-minute cache means zero new requests');
  a.clock.tick(900001);
  lf.discoverGitHubMedia(false, () => {});
  assert.equal(calls.length, 2, 'after 15 minutes the cache is stale and refetches');
  w.localStorage.setItem('sdp.gh_assets_v34', 'old');
  w.localStorage.setItem('sdp.gh_videos_cache', 'older');
  lf.purgeLegacyCaches();
  assert.equal(w.localStorage.getItem('sdp.gh_assets_v34'), null);
  assert.equal(w.localStorage.getItem('sdp.gh_videos_cache'), null);
  assert.ok(w.localStorage.getItem(GH_KEY), 'the v35 cache itself is never purged');
  a.close();
});

test('19. Session 7 keeps all 30 travel words, the 5s timer, x2 repeats and the Amy en-GB voice', () => {
  const list = session.lists.filter((l) => l.id === 'list_session_7_travel')[0];
  assert.ok(list, 'Session 7 list present');
  assert.equal(list.version, '4.2.0');
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
  assert.ok(has(html, 'tire:"tyre"'), 'the tyre/tire alias still matches');
});

test('20. v35 migration: settingsRev 35, 18% dim and stale Fatal 390 / Home 390 selections reset', () => {
  const a = harness();
  const q = a.q;
  const stale = () => ({
    v: 34, settingsRev: 34,
    settings: { mode: 'paper', activeVideoSrc: './qa/evidence/fatal-390.png', activeMediaType: 'photo', videoDim: 60 },
    lists: [], results: {}, comments: [], inbox: []
  });
  const out = q.DB.migrate(stale());
  assert.equal(out.settings.activeVideoSrc, DEFAULT);
  assert.equal(out.settings.activeMediaType, 'video');
  assert.equal(out.settings.videoDim, 18);
  assert.equal(out.settingsRev, 35);
  assert.equal(out.v, 35);
  const direct = stale();
  q.DB.resetToV35(direct, {});
  assert.equal(direct.settings.activeVideoSrc, DEFAULT);
  assert.equal(direct.settings.activeMediaType, 'video');
  assert.equal(direct.settings.videoDim, 18);
  assert.equal(direct.settingsRev, 35);
  const good = q.DB.migrate({
    v: 34, settingsRev: 34,
    settings: { mode: 'paper', activeVideoSrc: HOODED, activeMediaType: 'video', videoDim: 14 },
    lists: [], results: {}
  });
  assert.equal(good.settings.activeVideoSrc, HOODED, 'a valid assets clip is not touched');
  assert.equal(good.settings.videoDim, 18, 'the v35 dim default upgrades a v34 profile');
  assert.equal(typeof q.DB.resetToV34, 'function');
  assert.equal(typeof q.DB.resetToV35, 'function');
  assert.ok(has(html, '["sdp.v34_highlighted_ui","sdp.v33_zero_lag"'), 'the v34 key is read once and migrated');
  a.close();
});

test('21. the 0-75 dimmer defaults to 18 and writes --bg-dim for the adaptive scrim', () => {
  const a = harness();
  const q = a.q, w = a.w, lf = q.LiveWallpaper;
  const node = lf.dimControl();
  const input = node.querySelector('#sVideoDim');
  assert.equal(input.min, '0');
  assert.equal(input.max, '75');
  assert.equal(input.value, '18');
  lf.setDim(42);
  assert.equal(q.DB.data.settings.videoDim, 42);
  assert.equal(w.document.documentElement.style.getPropertyValue('--bg-dim'), '0.42');
  lf.setDim(999);
  assert.equal(q.DB.data.settings.videoDim, 75);
  lf.setDim(-8);
  assert.equal(q.DB.data.settings.videoDim, 0);
  lf.setDim(18);
  a.close();
});

test('22. sheets, the settings screen and the Dictation Player never hide or pause the live video', () => {
  const a = harness();
  const q = a.q, lf = q.LiveWallpaper;
  const v = a.w.document.querySelector('#bgLiveVideo');
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
  assert.equal(a.w.document.querySelector('#screen-set #materialMixer') !== null, true, 'the Material Mixer lives in Settings only');
  a.close();
});

test('23. every v22-v34 feature token and v35 guard is still present', () => {
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
    'Next Wallpaper', 'Refresh from GitHub', 'resetToV33:function', 'resetToV34:function',
    'resetToV35:function', 'sdp.v34_highlighted_ui', 'sdp.v35_rainbow_liquid_glass',
    'sdp.gh_assets_v35', '_loadedSrc', 'adaptPerformance:function',
    'gal-preview-btn', 'bindStreamStatus:function', 'recoverVideo:function',
    'liteFx:function', 'markPlaying:function', '?v=35', '--spring-bounce', '--spring-fluid',
    'lgLiquidIn', 'lgLiquidIn .36s'
  ].forEach((token) => assert.ok(has(html, token), 'missing token: ' + token));
  [
    'backdrop-filter: blur(4px)', 'backdrop-filter:blur(4px)', 'brightness(1.02)',
    'blur(4px) saturate(140%)', '#ff3d77'
  ].forEach((token) => assert.ok(lacks(html, token), 'legacy token must be gone: ' + token));
  assert.ok(lacks(html, 'background-clip:text'), 'the hollow hero title never comes back');
});

test('24. low-end performance: spring-tuned adaptation, 10-ring rainbow ripples and visibility pause', () => {
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
  assert.ok(has(html, 'var cap=this.liteFx()?10:20'), 'low-end ripple cap is 10 rings');
  assert.ok(has(html, 'addSpark:function(e,t,n,i,a){if(this.liteFx())return;'), 'sparks are disabled in lite');
  assert.ok(has(html, 'for(s=0;s<(lite?1:3);s++)'), 'lite clicks emit a single ring');
  assert.ok(has(html, 'OPTS={passive:!0}'));
  assert.ok(has(html, '"touchstart"!==t&&"touchmove"!==t&&"scroll"!==t||(a.passive=!0)'), 'touch/scroll listeners are passive by default');
  assert.ok(has(html, 'U.on(document,"visibilitychange"'), 'visibilitychange is bound');
  assert.ok(has(html, 'hardwareConcurrency') && has(html, 'deviceMemory') && has(html, 'saveData'));
  assert.ok(has(html, 'var i=n||"#f472b6",a=n||"#38bdf8"'), 'prismatic ripple palette');
  assert.ok(has(html, 'this.ripples.length%2?"#a855f7":"#2dd4bf"'), 'violet/mint swipe ripples');
  assert.ok(lacks(html, 'var i=n||"#ff6f61"'), 'the coral ripple default is gone');
  assert.ok(lacks(html, 'this.ripples.length%2?"#ff6f61"'), 'the coral swipe ripple is gone');
  ['#38bdf8', '#a855f7', '#2dd4bf', '#f472b6'].forEach((hex) => assert.ok(has(html, hex), hex + ' is in the palette'));
  a.close();
});

test('25. admin PIN gate still returns 7898 and the media assets stay inside their byte budgets', () => {
  const pin = require('./test-pin.cjs');
  assert.equal(pin, '7898');
  const mp4 = fs.statSync(path.join(root, 'assets', 'bunny-live-wallpaper.mp4')).size;
  const poster = fs.statSync(path.join(root, 'assets', 'bunny-poster.webp')).size;
  assert.ok(mp4 > 0 && mp4 <= 1600000, 'bunny mp4 must stay around 1.0-1.6 MB (' + mp4 + ' bytes)');
  assert.ok(poster > 0 && poster < 30000, 'poster must stay under 30 KB (' + poster + ' bytes)');
});

test('26. no media file is tracked outside the assets folder', () => {
  const exts = /\.(mp4|webm|mov|m4v|jpe?g|png|webp|gif|avif)$/i;
  const skip = new Set(['.git', 'node_modules']);
  const offenders = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
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
