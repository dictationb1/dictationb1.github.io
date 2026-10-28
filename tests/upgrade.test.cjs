'use strict';
/* v34 release gates: strict-ES5 single-file app, ultra-highlighted buttons,
   controls, cards and typography over the zero-lag live video, the untouched
   one-stream `/assets/` wallpaper engine and every v22-v33 feature. */
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
const KEY = 'sdp.v34_highlighted_ui';
const LEGACY_KEY = 'sdp.v33_zero_lag';
const GH_KEY = 'sdp.gh_assets_v34';
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
/* v34 rules live at the end of the sheet; the helpers return the LAST match so a
   legacy base rule with the same selector can never satisfy (or hide) a v34 gate. */
const lastRule = (pattern) => {
  const all = cssText().match(new RegExp(pattern.source, 'g'));
  return all ? all[all.length - 1] : '';
};
const exactRule = (selector) => {
  const m = cssText().match(new RegExp('(?:^|[};])\\s*' + selector + '\\{[^}]*\\}'));
  return m ? m[0] : '';
};
const v34 = (pattern) => {
  const body = cssText().slice(cssText().indexOf('/* v34:'));
  const m = body.match(pattern);
  return m ? m[0] : '';
};

test('1. v34 build gate: check.cjs passes, strict ES5, zero external links, well under 442,000 bytes', () => {
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
  assert.equal((html.match(/\.json\?v=34/g) || []).length, 2);
  assert.ok(lacks(html, '.json?v=33'), 'all static data fetches are on the v34 cache token');
});

test('2. v34 metadata across version.json, config.json and session.json', () => {
  [['version', version], ['config', config], ['session', session]].forEach(([name, d]) => {
    assert.equal(d.ver, 34, name + ' ver');
    assert.equal(d.appVersion, '4.1.0', name + ' appVersion');
    assert.equal(d.settingsRev, 34, name + ' settingsRev');
    assert.equal(d.storageKey, KEY, name + ' storageKey');
    assert.equal(d.ghMediaCache, GH_KEY, name + ' ghMediaCache');
    assert.equal(d.ghMediaTtl, 900000, name + ' 15-minute GitHub TTL');
    assert.ok(Array.isArray(d.legacyMediaCaches) && d.legacyMediaCaches.indexOf('sdp.gh_assets_v33') >= 0, name + ' legacy cache list');
    const s = settingsOf(d);
    assert.equal(s.mode, 'paper', name + ' paper mode');
    assert.equal(s.activeVideoSrc, DEFAULT, name + ' bunny default');
    assert.equal(s.activeMediaType, 'video', name + ' video type');
    assert.equal(s.videoDim, 18, name + ' 18% dim');
  });
  assert.equal(version.version, '4.1.0');
  assert.equal(config.version, '4.1.0');
  assert.equal(session.version, '4.1.0');
  assert.equal(config.defaults.wallpaperVideo, true);
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.videoDim, 18);
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

test('4. boot: 4.1.0 constants, bunny as the only default stream and no gallery DOM yet', () => {
  const a = harness();
  const q = a.q, w = a.w, doc = w.document, lf = q.LiveWallpaper;
  assert.equal(q.APP_VERSION, '4.1.0');
  assert.equal(q.DEFAULT_WALLPAPER_SRC, DEFAULT);
  assert.equal(q.CONFIG.key, KEY);
  assert.equal(q.CONFIG.schema, 34);
  assert.equal(q.CONFIG.settingsRev, 34);
  assert.equal(q.DB.data.settingsRev, 34);
  assert.equal(q.DB.data.v, 34);
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

test('8. v34 video engine: one filter-free hardware overlay and a permanently inert ambilight', () => {
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

test('9. v34 cards: high-contrast see-through stage with zero backdrop blur (dark and light)', () => {
  const cardRule = compact(v34(/\.glass:not\(#materialMixer\)[^{]*\{[^}]*\}/));
  assert.ok(hasIn(cardRule, 'backdrop-filter:none!important'), 'zero GPU blur -> frame time < 1ms');
  assert.ok(hasIn(cardRule, '-webkit-backdrop-filter:none!important'));
  assert.ok(hasIn(cardRule, '#homeHero.glass') && hasIn(cardRule, '.wordcard.glass') && hasIn(cardRule, '.card.glass'));
  assert.ok(hasIn(cardRule, 'background-color:var(--hc2)!important'));
  assert.ok(hasIn(cardRule, 'background-image:var(--hg)!important'));
  assert.ok(hasIn(cardRule, 'border:var(--hbd2)!important'));
  assert.ok(hasIn(cardRule, 'box-shadow:var(--hsh)!important'));
  assert.ok(hasCss('--hc2:rgba(6,11,24,.62)'), 'dark card base');
  assert.ok(hasCss('--hg:linear-gradient(180deg,rgba(6,11,24,.62),rgba(8,14,30,.5) 50%,rgba(6,11,24,.68))'));
  assert.ok(hasCss('--hbd2:1.5px solid rgba(255,255,255,.38)'));
  assert.ok(hasCss('--hsh:0 0 0 1.5px rgba(4,8,18,.8),0 14px 36px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.3)'));
  assert.ok(hasCss('--hc2:rgba(255,255,255,.82)'), 'light card base');
  assert.ok(hasCss('--hg:linear-gradient(180deg,rgba(255,255,255,.82),rgba(245,248,255,.74))'));
  assert.ok(hasCss('--hbd2:1.5px solid rgba(15,35,75,.35)'));
  assert.ok(hasCss('--hsh:0 12px 32px rgba(0,0,0,.22)'));
  assert.ok(lacks(compact(cssText()), 'backdrop-filter:blur'), 'no blur anywhere in the sheet');
});

test('10. v34 primary actions: coral-magenta fill, white rim and a dark outer contrast ring', () => {
  const pri = compact(v34(/\.btn\.pri[^{]*\{[^}]*\}/));
  ['#btnStart', '#btnReadyGo', '.btn.primary', '.btn-pri', 'button.pri', '.gal-apply-btn'].forEach((sel) =>
    assert.ok(hasIn(pri, sel), sel + ' must be highlighted'));
  assert.ok(hasIn(pri, 'background-color:#ff3d77!important'));
  assert.ok(hasIn(pri, 'background-image:linear-gradient(135deg,#ff6f61,#ff3d77 55%,#ff8a47)!important'));
  assert.ok(hasIn(pri, 'color:#fff!important'));
  assert.ok(hasIn(pri, 'font-weight:800!important'));
  assert.ok(hasIn(pri, 'border:1.5px solid rgba(255,255,255,.9)!important'));
  assert.ok(hasIn(pri, 'box-shadow:0 0 0 2px rgba(4,8,18,.85),0 8px 24px rgba(255,61,119,.65),inset 0 1px 1px rgba(255,255,255,.6)!important'));
  assert.ok(hasIn(pri, 'text-shadow:0 1px 3px rgba(0,0,0,.9)!important'));
});

test('11. v34 secondary, ghost, icon, pill and player buttons: obsidian capsule + glowing cyan rim', () => {
  const btn = compact(v34(/\.btn,\.btn-sec[^{]*\{[^}]*\}/));
  ['.btn-sec', '.btn-ghost', '.ibtn', '.top-pill', '.wall-open-btn', '.gal-preview-btn', '.close-x-btn'].forEach((sel) =>
    assert.ok(hasIn(btn, sel), sel + ' must be highlighted'));
  assert.ok(hasIn(btn, 'background-color:var(--hf)!important'));
  assert.ok(hasIn(btn, 'color:var(--hfg)!important'));
  assert.ok(hasIn(btn, 'font-weight:700!important'));
  assert.ok(hasIn(btn, 'border:var(--hbd)!important'));
  assert.ok(hasIn(btn, 'box-shadow:var(--hs)!important'));
  assert.ok(hasIn(btn, 'text-shadow:var(--ht)!important'));
  assert.ok(hasCss('--hf:rgba(8,14,30,.88)'));
  assert.ok(hasCss('--hfg:#fff'));
  assert.ok(hasCss('--hbd:1.5px solid rgba(83,199,240,.78)'));
  assert.ok(hasCss('--hs:0 0 0 1.5px rgba(4,8,18,.85),0 6px 16px rgba(0,0,0,.72),0 0 12px rgba(83,199,240,.28),inset 0 1px 0 rgba(255,255,255,.28)'));
  assert.ok(hasCss('--ht:0 1px 3px rgba(0,0,0,.95)'));
  const hover = compact(v34(/\.btn:hover[^{]*\{[^}]*\}/));
  assert.ok(hasIn(hover, 'background-color:var(--hfb)!important'));
  assert.ok(hasIn(hover, 'border-color:#53c7f0!important'));
  assert.ok(hasIn(hover, 'box-shadow:var(--hh)!important'));
  assert.ok(hasIn(hover, ':focus-visible') && hasIn(hover, ':active'));
  assert.ok(hasCss('--hfb:rgba(14,25,52,.96)'));
  assert.ok(hasCss('--hh:0 0 0 2px rgba(4,8,18,.9),0 8px 22px rgba(0,0,0,.85),0 0 18px rgba(83,199,240,.6)'));
  assert.ok(hasCss('--hf:rgba(255,255,255,.94)'), 'light mode capsule');
  assert.ok(hasCss('--hfg:#071022'), 'light mode ink');
  assert.ok(hasCss('--hbd:1.5px solid rgba(15,35,75,.55)'));
  assert.ok(hasCss('--hs:0 4px 14px rgba(0,0,0,.25)'));
  assert.ok(hasCss('--ht:none'));
});

test('12. v34 segmented switches, dock and top bar pop out with neon borders and a glowing active tab', () => {
  const seg = compact(v34(/\.seg,\.seg-tint\{[^}]*\}/));
  assert.ok(hasIn(seg, 'background-color:rgba(5,10,22,.9)!important'));
  assert.ok(hasIn(seg, 'border:1.5px solid rgba(255,255,255,.4)!important'));
  assert.ok(hasIn(seg, 'box-shadow:0 6px 18px rgba(0,0,0,.7),inset 0 2px 6px rgba(0,0,0,.8)!important'));
  assert.ok(hasCss('.seg button,.seg-tint button,#tabbar button{color:#eef4ff!important;font-weight:700!important;text-shadow:var(--ht)!important}'));
  const active = compact(v34(/\.seg \.thumb,[^{]*\{[^}]*\}/));
  assert.ok(hasIn(active, '.seg-ind') && hasIn(active, '.seg .on'));
  assert.ok(hasIn(active, 'background-color:#3b82f6!important'));
  assert.ok(hasIn(active, 'background-image:linear-gradient(135deg,#53c7f0,#3b82f6 55%,#6366f1)!important'));
  assert.ok(hasIn(active, 'color:#fff!important'));
  assert.ok(hasIn(active, 'font-weight:800!important'));
  assert.ok(hasIn(active, 'border:1px solid rgba(255,255,255,.88)!important'));
  assert.ok(hasIn(active, 'box-shadow:0 4px 14px rgba(59,130,246,.7)!important'));
  const bar = compact(v34(/\.topbar\.glass,#tabbar\.glass\{[^}]*\}/));
  assert.ok(hasIn(bar, 'background-color:rgba(6,11,24,.86)!important'));
  assert.ok(hasIn(bar, 'border:1.5px solid rgba(255,255,255,.34)!important'));
  assert.ok(hasIn(bar, 'box-shadow:0 10px 28px rgba(0,0,0,.75)!important'));
  const tab = compact(v34(/\.tab\.active,#tabInd,[^{]*\{[^}]*\}/));
  assert.ok(hasIn(tab, 'border:1.5px solid #53c7f0!important'));
  assert.ok(hasIn(tab, 'box-shadow:0 0 14px rgba(83,199,240,.45)!important'));
  assert.ok(hasIn(tab, 'color:#fff!important'));
  assert.ok(hasIn(tab, 'font-weight:800!important'));
});

test('13. v34 tiles, chips, inputs, answer mirror and letter slots are 100% readable', () => {
  const tile = compact(v34(/\.tile,\.wrow[^{]*\{[^}]*\}/));
  assert.ok(hasIn(tile, 'background-color:var(--hif2)!important'));
  assert.ok(hasIn(tile, 'border:1.5px solid rgba(83,199,240,.42)!important'));
  assert.ok(hasIn(tile, 'box-shadow:0 6px 18px rgba(0,0,0,.55)!important'));
  assert.ok(hasIn(tile, 'color:var(--hfg)!important'));
  assert.ok(hasCss('--hif2:rgba(7,13,28,.78)'));
  const chip = compact(v34(/\.chip,\.badge[^{]*\{[^}]*\}/));
  assert.ok(hasIn(chip, 'background-color:var(--hcf)!important'));
  assert.ok(hasIn(chip, 'border:1px solid rgba(255,255,255,.45)!important'));
  assert.ok(hasIn(chip, 'color:var(--hfg)!important'));
  assert.ok(hasIn(chip, 'font-weight:700!important'));
  assert.ok(hasIn(chip, 'box-shadow:0 2px 8px rgba(0,0,0,.65)!important'));
  assert.ok(hasCss('--hcf:rgba(8,15,32,.9)'));
  const input = compact(v34(/#ansMirror[^{]*\{[^}]*\}/));
  assert.ok(hasIn(input, '#dictSearch'));
  assert.ok(hasIn(input, 'input:not([type=range]):not([type=checkbox]):not([type=radio])'));
  assert.ok(hasIn(input, 'background-color:var(--hif)!important'));
  assert.ok(hasIn(input, 'border:2px solid #53c7f0!important'));
  assert.ok(hasIn(input, 'color:var(--hfg)!important'));
  assert.ok(hasIn(input, 'font-weight:700!important'));
  assert.ok(hasIn(input, 'box-shadow:0 0 16px rgba(83,199,240,.35),0 6px 18px rgba(0,0,0,.75)!important'));
  assert.ok(hasCss('--hif:rgba(5,10,22,.88)'));
  assert.ok(hasIn(input, '.slot:not(.slot-ok):not(.slot-err):not(.slot-done)'), 'tick/cross slot states keep their own colour');
  ['slot-ok', 'slot-err', 'slot-done'].forEach((cls) =>
    assert.ok(hasCss('.' + cls), cls + ' styling survives the v34 highlight'));
});

test('14. v34 typography: solid luminous #homeTitle, cyan outline, dark halo and bright muted text', () => {
  const title = compact(v34(/#homeTitle,#homeTitle\.hollow[^{]*\{[^}]*\}/));
  assert.ok(hasIn(title, '#homeTitle.hollow') && hasIn(title, '.hero-title') && hasIn(title, '.liquid-glass-text'));
  assert.ok(hasIn(title, 'color:#fff!important'));
  assert.ok(hasIn(title, '-webkit-text-fill-color:#fff!important'));
  assert.ok(hasIn(title, '-webkit-text-stroke:.5px rgba(83,199,240,.7)!important'));
  assert.ok(hasIn(title, 'text-shadow:0 3px 12px rgba(0,0,0,.98),0 1px 3px rgba(0,0,0,1),0 0 18px rgba(83,199,240,.45)!important'));
  assert.ok(hasIn(title, 'font-weight:900!important'));
  assert.ok(hasIn(title, 'background:none!important'), 'no hollow gradient that vanishes over video');
  assert.ok(lacks(CSS, 'background-clip:text'), 'the transparent text fill is gone');
  assert.ok(hasCss(':root[data-theme=light] #homeTitle,:root[data-theme=light] .hero-title,:root[data-theme=light] .liquid-glass-text{color:#071022!important;-webkit-text-fill-color:#071022!important'));
  assert.ok(hasCss('--fg:#fff'));
  assert.ok(hasCss('--muted:#e4eeff'), 'dark muted text is ice-white');
  assert.ok(hasCss('--fg:#0e1424'));
  assert.ok(hasCss('--muted:#1e293b'), 'light muted text is slate');
  assert.ok(hasCss('body{color:var(--fg)}'));
  assert.ok(hasCss('.muted,.small,.tiny{color:var(--muted)!important}'));
  const halo = compact(v34(/\.glass,\.glass \*:not\(#homeTitle\)[^{]*\{[^}]*\}/));
  assert.ok(hasIn(halo, '.wordcard *') && hasIn(halo, '.layer *') && hasIn(halo, '.sheet *') && hasIn(halo, '.topbar *') && hasIn(halo, '.tile *'));
  assert.ok(hasIn(halo, 'text-shadow:var(--hw)!important'));
  assert.ok(hasCss('--hw:0 2px 6px rgba(0,0,0,.98),0 1px 2px rgba(0,0,0,1)'));
  assert.ok(hasCss('--hw:0 1px 4px rgba(255,255,255,.95)'), 'light theme keeps a white halo');
});

test('15. zero-lag budget: no blur filters, sleeping canvas and lazy gallery streams', () => {
  assert.ok((compact(cssText()).match(/backdrop-filter:none!important/g) || []).length >= 4);
  assert.ok(lacks(compact(cssText()), 'blur(4px)'));
  assert.ok(lacks(compact(cssText()), 'brightness(1.02)'));
  assert.ok(has(html, 'rafId:null'), 'the neon canvas idles with rafId null');
  assert.ok(has(html, 'preload="none"'), 'inactive gallery clips carry preload=none');
  assert.ok(has(html, '_loadedSrc'), 'the same clip is never downloaded twice');
  assert.ok(/visibilitychange"[^]*?\.pause\(\)/.test(html), 'the video pauses when the tab hides');
  assert.ok(has(html, 'navigator.serviceWorker'), 'stale service workers are still removed');
  assert.ok(lacks(html, 'bgLiveVideo*{filter:blur'), 'no shader on the wallpaper');
});

test('16. discoverGitHubMedia: contents/assets only, 15-minute cache under the v34 key, legacy caches purged', () => {
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
  assert.ok(cached && cached.at, 'cache written under the v34 key with a timestamp');
  lf.discoverGitHubMedia(false, () => {});
  assert.equal(calls.length, 1, 'a warm 15-minute cache means zero new requests');
  a.clock.tick(900001);
  lf.discoverGitHubMedia(false, () => {});
  assert.equal(calls.length, 2, 'after 15 minutes the cache is stale and refetches');
  w.localStorage.setItem('sdp.gh_assets_v33', 'old');
  w.localStorage.setItem('sdp.gh_videos_cache', 'older');
  lf.purgeLegacyCaches();
  assert.equal(w.localStorage.getItem('sdp.gh_assets_v33'), null);
  assert.equal(w.localStorage.getItem('sdp.gh_videos_cache'), null);
  assert.ok(w.localStorage.getItem(GH_KEY), 'the v34 cache itself is never purged');
  a.close();
});

test('17. Session 7 keeps all 30 travel words, the 5s timer, x2 repeats and the Amy en-GB voice', () => {
  const list = session.lists.filter((l) => l.id === 'list_session_7_travel')[0];
  assert.ok(list, 'Session 7 list present');
  assert.equal(list.version, '4.1.0');
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

test('18. v34 migration: settingsRev 34, 18% dim and stale Fatal 390 / Home 390 selections reset', () => {
  const a = harness();
  const q = a.q;
  const stale = () => ({
    v: 33, settingsRev: 33,
    settings: { mode: 'paper', activeVideoSrc: './qa/evidence/fatal-390.png', activeMediaType: 'photo', videoDim: 60 },
    lists: [], results: {}, comments: [], inbox: []
  });
  const out = q.DB.migrate(stale());
  assert.equal(out.settings.activeVideoSrc, DEFAULT);
  assert.equal(out.settings.activeMediaType, 'video');
  assert.equal(out.settings.videoDim, 18);
  assert.equal(out.settingsRev, 34);
  assert.equal(out.v, 34);
  const direct = stale();
  q.DB.resetToV34(direct, {});
  assert.equal(direct.settings.activeVideoSrc, DEFAULT);
  assert.equal(direct.settings.activeMediaType, 'video');
  assert.equal(direct.settings.videoDim, 18);
  assert.equal(direct.settingsRev, 34);
  const good = q.DB.migrate({
    v: 33, settingsRev: 33,
    settings: { mode: 'paper', activeVideoSrc: HOODED, activeMediaType: 'video', videoDim: 14 },
    lists: [], results: {}
  });
  assert.equal(good.settings.activeVideoSrc, HOODED, 'a valid current-rev assets clip is not touched');
  assert.equal(good.settings.videoDim, 18, 'the v34 dim default upgrades a v33 profile');
  assert.equal(typeof q.DB.resetToV33, 'function');
  assert.equal(typeof q.DB.resetToV34, 'function');
  assert.ok(has(html, '["sdp.v33_zero_lag","sdp.v32_crystal_video"'), 'the v33 key is still read once and migrated');
  a.close();
});

test('19. the 0-75 dimmer defaults to 18 and writes --bg-dim for the adaptive scrim', () => {
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

test('20. sheets, the settings screen and the Dictation Player never hide or pause the live video', () => {
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

test('21. every v22-v33 feature token and guard is still present in the v34 build', () => {
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
    'sdp.v34_highlighted_ui', 'sdp.gh_assets_v34', '_loadedSrc', 'adaptPerformance:function',
    'gal-preview-btn', 'bindStreamStatus:function', 'recoverVideo:function',
    'liteFx:function', 'markPlaying:function', '?v=34', 'sdp.v33_zero_lag'
  ].forEach((token) => assert.ok(has(html, token), 'missing token: ' + token));
  [
    'backdrop-filter: blur(4px)', 'backdrop-filter:blur(4px)', 'brightness(1.02)',
    'blur(4px) saturate(140%)'
  ].forEach((token) => assert.ok(lacks(html, token), 'legacy token must be gone: ' + token));
  assert.ok(lacks(html, 'background-clip:text'), 'the hollow hero title never comes back');
});

test('22. performance adaptation: low-end detection, lite ripple caps, passive listeners and visibility pause', () => {
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
  assert.ok(has(html, 'hardwareConcurrency') && has(html, 'deviceMemory') && has(html, 'saveData'));
  a.close();
});

test('23. admin PIN gate still returns 7898 and the media assets stay inside their byte budgets', () => {
  const pin = require('./test-pin.cjs');
  assert.equal(pin, '7898');
  const mp4 = fs.statSync(path.join(root, 'assets', 'bunny-live-wallpaper.mp4')).size;
  const poster = fs.statSync(path.join(root, 'assets', 'bunny-poster.webp')).size;
  assert.ok(mp4 > 0 && mp4 <= 1600000, 'bunny mp4 must stay around 1.0-1.6 MB (' + mp4 + ' bytes)');
  assert.ok(poster > 0 && poster < 30000, 'poster must stay under 30 KB (' + poster + ' bytes)');
});

test('24. no media file is tracked outside the assets folder', () => {
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
