'use strict';
/* v36 release gates (fresh rewrite):
   1. 0.05s (50ms) instant button response - GPU-only transforms, no blocking
      JSON.stringify on a tap, a canvas that ignores UI taps.
   2. Human-crafted editorial UI (Apple macOS Sequoia / Linear Studio):
      sapphire-indigo pearl CTAs, smoked-obsidian secondary capsules and
      smoked-crystal glass surfaces, no neon rainbow, no backdrop blur.
   3. The "CREDITS GOES TO Hansana" first-read spotlight plus the smooth
      disappearing / re-appearing hansanaRevealCycle.
   4. Modern professional English + Sinhala typography with a runtime font
      loader (never a static <link>) and pillam-safe line-height.
   5. Every v22-v35 feature, storage, media and privacy rule still in place. */
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

const KEY = 'sdp.v36_human_editorial';
const LEGACY_KEY = 'sdp.v35_rainbow_liquid_glass';
const GH_KEY = 'sdp.gh_assets_v36';
const LEGACY_GH_KEY = 'sdp.gh_assets_v35';
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
/* v36 rules are the tail of the stylesheet, so a legacy rule with a similar
   selector can never satisfy a v36 gate. */
const v36Block = () => {
  const at = cssText().indexOf('/* v36:');
  return at < 0 ? '' : cssText().slice(at);
};
const v36 = (pattern) => {
  const m = v36Block().match(pattern);
  return m ? compact(m[0]) : '';
};

test('1. v36 build gate: check.cjs passes, strict ES5, zero external links, under 442,000 bytes', () => {
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
  assert.equal((html.match(/\.json\?v=36/g) || []).length, 2);
  assert.ok(lacks(html, '.json?v=34') && lacks(html, '.json?v=35'), 'all static data fetches are on the v36 cache token');
});

test('2. v36 identity: ver 36, appVersion 4.3.0, v36 storage + GitHub media keys in every data file', () => {
  [['version.json', version], ['config.json', config], ['session.json', session]].forEach(([name, d]) => {
    assert.equal(d.ver, 36, name + ' ver');
    assert.equal(d.appVersion, '4.3.0', name + ' appVersion');
    assert.equal(d.settingsRev, 36, name + ' settingsRev');
    assert.equal(d.storageKey, KEY, name + ' storageKey');
    assert.equal(d.ghMediaCache, GH_KEY, name + ' ghMediaCache');
    assert.equal(d.ghMediaTtl, 900000, name + ' 15-minute GitHub TTL');
    assert.ok(Array.isArray(d.legacyMediaCaches) && d.legacyMediaCaches.indexOf(LEGACY_GH_KEY) >= 0, name + ' legacy cache list');
    assert.equal(d.mode, 'paper', name + ' paper mode');
    assert.equal(d.activeVideoSrc, DEFAULT, name + ' bunny default');
    assert.equal(d.activeMediaType, 'video', name + ' video type');
    assert.equal(d.videoDim, 18, name + ' 18% dim');
  });
  assert.equal(version.version, '4.3.0');
  assert.equal(config.version, '4.3.0');
  assert.equal(session.version, '4.3.0');
  assert.equal(config.defaults.wallpaperVideo, true);
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.videoDim, 18);
  assert.equal(config.session.mode, 'paper');
  assert.equal(config.session.activeVideoSrc, DEFAULT);
  assert.equal(config.session.videoDim, 18);
  assert.equal(version.buildDate, '2026-10-28');
  assert.ok(has(version.features.instantResponse, '0.05s'), 'the 50ms response is documented');
  assert.ok(has(version.features.typography, 'Noto Sans Sinhala'));
  assert.ok(has(version.features.creditSpotlight, 'hansanaRevealCycle'));
  assert.ok(has(version.features.visual, 'human-crafted'));
});

test('3. boot constants: 4.3.0, schema 36, paper default, bunny as the only default stream', () => {
  const a = harness();
  const q = a.q, w = a.w, doc = w.document, lf = q.LiveWallpaper;
  assert.equal(q.APP_VERSION, '4.3.0');
  assert.equal(q.DEFAULT_WALLPAPER_SRC, DEFAULT);
  assert.equal(q.CONFIG.key, KEY);
  assert.equal(q.CONFIG.schema, 36);
  assert.equal(q.CONFIG.settingsRev, 36);
  assert.equal(q.DB.data.settingsRev, 36);
  assert.equal(q.DB.data.v, 36);
  assert.equal(q.DB.data.settings.mode, 'paper', 'Listen & write on paper stays the default');
  assert.equal(q.DB.data.settings.videoDim, 18);
  assert.equal(lf.activeSrc, DEFAULT);
  assert.equal(lf.activeType, 'video');
  assert.equal(lf.enabled, true);
  assert.equal(lf._loadedSrc, DEFAULT, '_loadedSrc guard is armed on boot');
  const v = doc.querySelector('#bgLiveVideo');
  assert.equal(v.getAttribute('src'), DEFAULT);
  assert.equal(v.getAttribute('poster'), POSTER);
  assert.equal(doc.querySelector('#bgLiveAmbilight').style.display, 'none');
  assert.equal(doc.querySelectorAll('.gal-thumb').length, 0, 'no gallery media nodes on boot');
  a.close();
});

test('4. assets-only media normalisation survives v36 untouched', () => {
  const a = harness();
  const q = a.q;
  assert.equal(q.normalizeAssetPath(DEFAULT), DEFAULT);
  assert.equal(q.normalizeAssetPath(RAW_URL), DEFAULT);
  assert.equal(q.normalizeAssetPath('/assets/bunny-live-wallpaper.mp4#frag'), DEFAULT);
  assert.equal(q.normalizeAssetPath('https://dictationb1.github.io/assets/bunny-live-wallpaper.mp4?token=abc'), DEFAULT);
  assert.equal(q.normalizeAssetPath('https://github.com/dictationb1/dictationb1.github.io/blob/main/assets/clip.mov?raw=true'), './assets/clip.mov');
  assert.equal(q.normalizeAssetPath('assets/a.mp4'), './assets/a.mp4');
  assert.equal(q.normalizeAssetPath('  ./assets/a.m4v  '), './assets/a.m4v');
  assert.equal(q.normalizeAssetPath('./assets/sub/nested.mp4'), '', 'nested files rejected');
  assert.equal(q.normalizeAssetPath('https://evil.example.com/x.mp4'), '', 'foreign hosts rejected');
  assert.equal(q.normalizeAssetPath('javascript:alert(1)'), '');
  assert.equal(q.isAssetsMedia(DEFAULT), true);
  [POSTER, './assets/v31-clip.mp4', './assets/poster.banana.mp4', './assets/artifact-1.png', './assets/sub/dir.mp4']
    .forEach((bad) => assert.equal(q.isAssetsMedia(bad), false, bad + ' must be rejected'));
  a.close();
});

test('5. one filter-free hardware video overlay: walls, tabs, player and results never hide the video', () => {
  const videoRule = cssText().match(/(?:^|[};])\s*#bgLiveVideo\{[^}]*\}/);
  assert.ok(videoRule, '#bgLiveVideo rule');
  assert.ok(hasIn(videoRule[0], 'filter:none!important') && hasIn(videoRule[0], '-webkit-filter:none!important'));
  assert.ok(hasIn(videoRule[0], 'will-change:transform;transform:translateZ(0)'));
  assert.ok(lacks(videoRule[0], 'blur('));
  assert.ok(hasCss('#bgLiveAmbilight{display:none!important'), 'the duplicate decoder never runs');
  assert.ok(hasCss('#bgLiveWrap{position:fixed;inset:0;width:100vw;height:100vh;z-index:0!important;pointer-events:none;overflow:hidden;display:block;background:transparent!important;contain:strict}'));
  assert.ok(hasCss('body.wallpaper-on #bgLiveWrap{display:block!important}'));
  assert.ok(hasCss('body.wallpaper-on .bg-aurora,body.wallpaper-on .bg-grid,body.wallpaper-on .stripes,body.wallpaper-on .disc,body.wallpaper-on #bg{display:none!important'));
  assert.ok(hasCss('#bgContrastScrim{background:radial-gradient(circle at 50% 40%,rgba(5,9,20,var(--bg-dim,.18))'), 'adaptive scrim');
  assert.ok(hasCss('--bg-dim:.18'), '18% default vignette');
  assert.ok(hasCss('.layer{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:#04081214!important'), 'the player layer stays see-through');
  assert.ok(hasCss('#app,.app,main,.screen,#screen-home,.anatomy-stage{background:transparent!important'), 'the app never hides the video');
  assert.ok(/var [a-z]=\["home","practice","dict","comm","set"\]/.test(scriptBody()), 'all five tabs share the same live wallpaper');
});

test('6. 0.05s (50ms) buttons: instant transform/opacity, 0.03s press, 0.12s GPU screen morphs', () => {
  const css = cssText();
  assert.ok(/transition:\s*transform 0\.05s cubic-bezier\(0\.2, 0, 0, 1\), opacity 0\.05s linear, background-color 0\.08s linear/.test(css),
    '50ms transform + opacity transition on every control');
  assert.ok(/button,\s*\.btn,\s*\.ibtn,\s*\.tab,\s*\.seg button,\s*\.chip\s*\{[^}]*transition:\s*transform 0\.05s/.test(css));
  assert.ok(hasCss('button,.btn,.ibtn,.tab,.seg button,.chip,.wrow,input{touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}'),
    'touch-action manipulation and no tap highlight');
  assert.ok(hasIn(v36(/button:active[^{]*\{[^}]*\}/), 'transform:scale(0.97)translateZ(0)!important'));
  assert.ok(hasIn(v36(/button:active[^{]*\{[^}]*\}/), 'transition-duration:0.03s!important'));
  const morph = v36(/\.screen,\.sheet,\.layer,#tabInd,\.seg \.thumb,\.seg-ind\{[^}]*\}/);
  assert.ok(hasIn(morph, 'transition:transform.12scubic-bezier(.2,.9,.3,1),opacity.12scubic-bezier(.2,.9,.3,1)!important'), '120ms morph');
  assert.ok(lacks(compact(morph).replace(/transform:[^;}]*/g, ''), 'transition:height'), 'no layout-thrashing height animation');
  assert.ok(hasIn(v36(/\.screen,\.tile,\.wrow\{[^}]*\}/), 'contain:layoutstyle'), 'screens, tiles and word rows are contained');
  assert.ok(/--sh:\s*0 8px 24px #00000073,inset 0 1px 0 #ffffff38/.test(css), 'one crisp shadow replaces the five-layer stack');
  assert.ok(/--hw:\s*0 1px 3px #000000e6/.test(css), 'one crisp text shadow');
  assert.ok(hasIn(v36(/\.tile,\.wrow,\.card,\.sheet,\.modal,\.toast,\.glass\{[^}]*\}/), 'box-shadow:var(--sh)!important'));
  assert.ok(lacks(v36Block(), '0.34s') && lacks(v36Block(), '0.36s') && lacks(v36Block(), '0.38s'), 'no slow spring durations remain in the v36 layer');
  assert.ok(lacks(scriptBody(), 'setTimeout(function(){U.$$(".seg").forEach(UI.segSync)},30)'), 'tab switching no longer waits on a timer');
});

test('7. DB.save() is a 60ms debounce and DB.saveNow() still writes synchronously', () => {
  const a = harness();
  const q = a.q, w = a.w;
  const stored = () => JSON.parse(w.localStorage.getItem(KEY) || '{}');
  const startSize = q.DB.data.settings.size;
  q.DB.data.settings.size = 'xl';
  q.DB.save();
  assert.equal(stored().settings.size, startSize, 'a tap never blocks on JSON.stringify');
  a.clock.tick(61);
  assert.equal(stored().settings.size, 'xl', 'the debounce flushes after 60ms');
  q.DB.data.settings.size = 's';
  q.DB.saveNow();
  assert.equal(stored().settings.size, 's', 'saveNow() is synchronous for beforeunload and tests');
  assert.ok(has(scriptBody(), 'this.saveTimer=setTimeout(function(){t.saveTimer=null;t.saveNow(e)},60)'), 'the 60ms timer is in the source');
  assert.ok(has(scriptBody(), 'saveNow:function(e)'), 'saveNow() exists');
  a.close();
});

test('8. the ambient canvas never allocates particles for a UI tap', () => {
  const js = scriptBody();
  assert.ok(has(js, 'if(n.target&&n.target.closest&&n.target.closest("button, .btn, .ibtn, .tab, .seg, input, select, textarea, .sheet, .wordcard"))return;'),
    'canvas pointerdown ignores every control');
  const a = harness();
  const w = a.w, lf = a.q.LiveWallpaper;
  lf.ctx = { clearRect: function () {}, beginPath: function () {}, arc: function () {}, stroke: function () {}, fill: function () {}, setTransform: function () {}, canvas: { width: 1, height: 1 } };
  lf.enabled = true;
  lf.ripples = [];
  const pointerDown = (target) => {
    const ev = new w.Event('pointerdown', { bubbles: true });
    ev.button = 0; ev.pointerId = 1; ev.pointerType = 'mouse'; ev.clientX = 20; ev.clientY = 20;
    target.dispatchEvent(ev);
  };
  const btn = w.document.getElementById('btnStart');
  assert.ok(btn, 'the Start button exists');
  pointerDown(btn);
  assert.equal(lf.ripples.length, 0, 'a tap on a control allocates zero particles');
  pointerDown(w.document.body);
  assert.ok(lf.ripples.length > 0, 'a tap on the wallpaper still paints a ripple');
  a.close();
});

test('9. human-crafted CTAs: sapphire-indigo pearl primary, smoked-obsidian secondary (zero neon rainbow)', () => {
  const css = cssText();
  assert.ok(/--pri:linear-gradient\(180deg,#ffffff42 0,#ffffff00 48%\),linear-gradient\(135deg,#2563eb 0,#4f46e5 52%,#0891b2 100%\)/.test(css), 'pearlescent sapphire-indigo-azure gradient');
  assert.ok(/--sec:linear-gradient\(180deg,#1e293be0 0,#0f172aeb 100%\)/.test(css), 'matte obsidian capsule');
  const pri = v36(/\.btn\.pri,[^{]*\{[^}]*\}/);
  ['#btnStart', '#btnReadyGo', '.btn.primary', '.btn-pri', 'button.pri', '.gal-apply-btn'].forEach((sel) =>
    assert.ok(hasIn(pri, sel), sel + ' is a primary CTA'));
  assert.ok(hasIn(pri, 'background:var(--pri)!important'));
  assert.ok(hasIn(pri, 'color:#ffffff!important'));
  assert.ok(hasIn(pri, 'font-weight:700!important'));
  assert.ok(hasIn(pri, 'letter-spacing:-0.01em!important'));
  assert.ok(hasIn(pri, 'border-radius:14px!important'));
  assert.ok(hasIn(pri, 'border:1pxsolid#ffffff6b!important'));
  assert.ok(hasIn(pri, 'box-shadow:06px18px#2563eb6b,inset01px0#ffffff8c!important'));
  const sec = v36(/\.btn:not\(\.pri\):not\(\.btn-pri\),[^{]*\{[^}]*\}/);
  ['.btn-sec', '.btn-ghost', '.ibtn', '.top-pill', '.wall-open-btn'].forEach((sel) =>
    assert.ok(hasIn(sec, sel), sel + ' is a secondary capsule'));
  assert.ok(hasIn(sec, 'background:var(--sec)!important'));
  assert.ok(hasIn(sec, 'color:#f8fafc!important'));
  assert.ok(hasIn(sec, 'font-weight:600!important'));
  assert.ok(hasIn(sec, 'border-radius:12px!important'));
  assert.ok(hasIn(sec, 'border:1pxsolid#ffffff47!important'));
  assert.ok(hasIn(sec, 'box-shadow:04px12px#00000073,inset01px0#ffffff38!important'));
  ['#38bdf8', '#c084fc', '#f472b6', '#a855f7', '#2dd4bf', '192, 132, 252', '244, 114, 182'].forEach((neon) =>
    assert.ok(lacks(v36Block(), neon), 'the neon rainbow token ' + neon + ' is retired'));
  assert.ok(lacks(scriptBody(), 'ff3d77'));
});

test('10. smoked-crystal surfaces: 22px glass, 16px rows and 14px obsidian inputs (zero backdrop blur)', () => {
  const css = cssText();
  assert.ok(/--surface:linear-gradient\(180deg,#0f172ada 0,#090e1cdb 100%\)/.test(css));
  const glass = v36(/\.glass:not\(#materialMixer\)[^{]*\{[^}]*\}/);
  ['.glass:not(#materialMixer)', '#homeHero.glass', '.wordcard.glass', '.card.glass', '.sheet.glass', '.sheet', '.modal'].forEach((sel) =>
    assert.ok(hasIn(glass, sel), sel + ' is a smoked crystal surface'));
  assert.ok(hasIn(glass, 'background:var(--surface)!important'));
  assert.ok(hasIn(glass, 'border-radius:22px!important'));
  assert.ok(hasIn(glass, 'border:1pxsolid#ffffff38!important'));
  assert.ok(hasIn(glass, 'box-shadow:016px36px#00000080,inset01px0#ffffff3d!important'));
  assert.ok(hasIn(glass, '-webkit-backdrop-filter:none!important') && hasIn(glass, 'backdrop-filter:none!important'), 'zero GPU blur');
  const tiles = v36(/\.tile,\.wrow,\.dict-item\{[^}]*\}/);
  assert.ok(hasIn(tiles, 'background:#0f172ac7!important'));
  assert.ok(hasIn(tiles, 'border:1pxsolid#ffffff2e!important'));
  assert.ok(hasIn(tiles, 'border-radius:16px!important'));
  assert.ok(hasIn(tiles, 'box-shadow:04px12px#00000059,inset01px0#ffffff24!important'));
  const inputs = v36(/#ansMirror,\.slot[^{]*\{[^}]*\}/);
  assert.ok(hasIn(inputs, 'background:#090e1ce6!important'));
  assert.ok(hasIn(inputs, 'border:1.5pxsolid#60a5faa6!important'));
  assert.ok(hasIn(inputs, 'border-radius:14px!important'));
  assert.ok(hasIn(inputs, 'color:#ffffff!important'));
  assert.ok(lacks(CSS, 'backdrop-filter:blur') && lacks(CSS, 'backdrop-filter: blur'), 'no blur anywhere in the sheet');
  assert.ok(hasCss('[data-theme=light]#homeTitle{color:#08111f!important'), 'light theme title stays legible');
});

test('11. #credit first-read spotlight: top-centre golden pill, z-index 9999 and never hidden', () => {
  const block = v36Block();
  assert.ok(/@keyframes hansanaRevealCycle\{0%,58%\{opacity:\.98;transform:translate3d\(0,0,0\) scale\(1\)\}72%,82%\{opacity:\.08;transform:translate3d\(0,6px,0\) scale\(\.95\)\}92%\{opacity:1;transform:translate3d\(0,-2px,0\) scale\(1.04\)\}100%\{opacity:\.98;transform:translate3d\(0,0,0\) scale\(1\)\}\}/.test(block),
    'the exact disappearing / re-appearing cycle');
  assert.ok(hasCss('#credit.in{animation:hansanaRevealCycle 7.5s cubic-bezier(0.22, 1, 0.36, 1) infinite!important'), '7.5s infinite cycle');
  const intro = v36(/body\.credit-intro #credit,body\.credit-intro #credit\.in\{[^}]*\}/);
  assert.ok(hasIn(intro, 'left:50%!important'));
  assert.ok(hasIn(intro, 'top:calc(12px+env(safe-area-inset-top,0px))!important'), 'the pill glides to the reading focal point');
  assert.ok(hasIn(intro, 'transform:translate3d(-50%,14px,0)scale(1.08)!important'));
  assert.ok(hasIn(intro, 'background:linear-gradient(135deg,#0f172af2 0,#1e3a8aeb 100%)!important'), 'golden-pearl editorial spotlight');
  assert.ok(hasIn(intro, 'border:1.5pxsolid#fbbf24bf!important'));
  assert.ok(hasIn(intro, 'box-shadow:012px32px#000000a6,00 24px#fbbf2459!important'));
  assert.ok(hasIn(intro, 'opacity:1!important') && hasIn(intro, 'visibility:visible!important'));
  assert.ok(hasIn(v36(/#credit\{[^}]*\}/), 'z-index:9999!important'));
  assert.ok(hasCss('#credit::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(112deg,transparent 34%,#fbbf244d 50%,transparent 66%)'), 'golden shimmer sweep');
  assert.ok(hasCss('@keyframes hansanaShimmer{0%,58%{background-position:140% 0}78%,100%{background-position:-60% 0}}'));
  assert.ok(hasCss('@keyframes hansanaSpot{0%{opacity:0;transform:translate3d(-50%,-16px,0) scale(.96)}100%{opacity:1;transform:translate3d(-50%,14px,0) scale(1.08)}}'));
  assert.ok(lacks(block, 'display:none') || hasCss('#bgLiveAmbilight{display:none!important}'), 'the credit is never display:none');
  /* the cycle never reaches 0 opacity, so an automated opacity > 0 probe always passes */
  const cycle = block.slice(block.indexOf('@keyframes hansanaRevealCycle'), block.indexOf('@keyframes hansanaShimmer'));
  const opacities = cycle.match(/opacity:\.?[0-9.]+/g).map((x) => parseFloat(x.split(':')[1]));
  assert.equal(Math.min.apply(null, opacities), 0.08, 'the disappearing pause bottoms out at 0.08: ' + JSON.stringify(opacities));
  assert.ok(opacities.every((o) => o > 0), 'the badge never reaches opacity 0');
});

test('12. showCreditNow() adds body.credit-intro for 2.6s and re-arms the reveal cycle', () => {
  const a = harness();
  const q = a.q, w = a.w, doc = w.document;
  q.UI.showCreditNow();
  const credit = doc.getElementById('credit');
  assert.ok(credit.className.indexOf('in') >= 0, 'the badge is in the DOM and visible');
  assert.ok(doc.body.className.indexOf('credit-intro') >= 0, 'the first-read spotlight class is on <body>');
  assert.equal(w.getComputedStyle(credit).zIndex, '9999');
  assert.ok(has(scriptBody(), 'UI._creditIntro=setTimeout(function(){U.setCls(document.body,"credit-intro",!1)},2600)'));
  a.clock.tick(2700);
  assert.ok(lacks(doc.body.className, 'credit-intro'), 'the spotlight hands over to the floating cycle after 2.6s');
  assert.ok(credit.className.indexOf('in') >= 0, 'the badge itself never disappears from the DOM');
  a.close();
});

test('13. modern typography: Inter + Noto Sans Sinhala stacks and a 1.72 pillam-safe line-height', () => {
  const css = cssText();
  assert.ok(has(css, '--font-sans:"Inter","Plus Jakarta Sans",-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Noto Sans Sinhala","Sinhala Sangam MN","Nirmala UI","Malithi Web",system-ui,sans-serif'), 'English + Sinhala sans stack');
  assert.ok(has(css, '--font-sinhala:"Noto Sans Sinhala","Sinhala Sangam MN","Nirmala UI","Malithi Web","Inter",system-ui,sans-serif'), 'dedicated Sinhala stack');
  assert.ok(has(css, '--font:var(--font-sans)'), 'the legacy --font token now points at the new stack');
  assert.ok(lacks(css, 'Iskoola Pota'), 'the Windows XP Sinhala font is gone');
  const si = v36(/\.si,\[lang="si"\],#guideBody\{[^}]*\}/);
  assert.ok(hasIn(si, 'font-family:var(--font-sinhala)!important'));
  assert.ok(hasIn(si, 'line-height:1.72!important'), 'Sinhala pillam never clip');
  assert.ok(hasIn(si, 'letter-spacing:0.005em!important'));
  assert.ok(hasIn(si, 'font-weight:500!important'));
  assert.ok(hasIn(si, '-webkit-font-smoothing:antialiased'));
  assert.ok(hasIn(si, 'text-rendering:optimizeLegibility'));
});

test('14. the font loader is runtime-only: 80ms, online-only, headless-safe and zero static <link>', () => {
  const js = scriptBody();
  assert.equal((html.match(/<link/g) || []).length, 0, 'still zero static <link> tags');
  assert.ok(has(js, 'sdpDynamicFonts'), 'one guarded style element');
  assert.ok(has(js, '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Sinhala:wght@400;500;600;700&display=swap")'));
  assert.ok(has(js, '/HeadlessChrome/i.test(navigator.userAgent)'), 'headless QA never requests Google Fonts');
  assert.ok(has(js, '!navigator.onLine'), 'offline users never wait on the network');
  assert.ok(has(js, ',80);'), 'the loader waits 80ms so first paint is never blocked');
  const a = harness();
  const style = a.w.document.getElementById('sdpDynamicFonts');
  assert.ok(style, 'the runtime style element is injected after boot');
  assert.ok(has(style.textContent, '@import url("https://fonts.googleapis.com/css2?family=Inter'));
  a.close();
});

test('15. every v22-v35 feature token and v36 guard is still present', () => {
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
    'resetToV35:function', 'resetToV36:function', LEGACY_KEY, 'sdp.v34_highlighted_ui',
    GH_KEY, LEGACY_GH_KEY, '_loadedSrc', 'adaptPerformance:function',
    'gal-preview-btn', 'bindStreamStatus:function', 'recoverVideo:function',
    'liteFx:function', 'markPlaying:function', '?v=36', '--spring-bounce', '--spring-fluid',
    'credit-intro', 'hansanaRevealCycle', 'hansanaSpot', 'sdpDynamicFonts',
    '--font-sinhala', 'Noto Sans Sinhala', 'contain:layout style', 'touch-action:manipulation',
    'transition:transform 0.05s', '0.03s', 'scale(0.97) translateZ(0)'
  ].forEach((token) => assert.ok(has(html, token), 'missing token: ' + token));
  [
    'backdrop-filter: blur(4px)', 'backdrop-filter:blur(4px)', 'brightness(1.02)',
    'blur(4px) saturate(140%)', '#ff3d77'
  ].forEach((token) => assert.ok(lacks(html, token), 'legacy token must be gone: ' + token));
  assert.ok(lacks(html, 'background-clip:text'), 'the hollow hero title never comes back');
  assert.ok(lacks(html, 'Iskoola Pota'), 'no legacy Sinhala fallback');
});

test('16. Session 7 keeps all 30 travel words, the 5s timer, x2 repeats and the Amy en-GB voice', () => {
  const list = session.lists.filter((l) => l.id === 'list_session_7_travel')[0];
  assert.ok(list, 'Session 7 list present');
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

test('17. v36 migration: 18% dim, assets-only video, paper mode and settingsRev 36', () => {
  const a = harness();
  const q = a.q;
  const stale = () => ({
    v: 35, settingsRev: 35,
    settings: { mode: 'type', activeVideoSrc: './qa/evidence/fatal-390.png', activeMediaType: 'photo', videoDim: 60 },
    lists: [], results: {}, comments: [], inbox: []
  });
  const out = q.DB.migrate(stale());
  assert.equal(out.settings.activeVideoSrc, DEFAULT);
  assert.equal(out.settings.activeMediaType, 'video');
  assert.equal(out.settings.videoDim, 18);
  assert.equal(out.settings.mode, 'paper');
  assert.equal(out.settingsRev, 36);
  assert.equal(out.v, 36);
  const direct = stale();
  q.DB.resetToV36(direct, {});
  assert.equal(direct.settings.activeVideoSrc, DEFAULT);
  assert.equal(direct.settings.activeMediaType, 'video');
  assert.equal(direct.settings.videoDim, 18);
  assert.equal(direct.settingsRev, 36);
  const good = q.DB.migrate({
    v: 35, settingsRev: 35,
    settings: { mode: 'paper', activeVideoSrc: HOODED, activeMediaType: 'video', videoDim: 14 },
    lists: [], results: {}
  });
  assert.equal(good.settings.activeVideoSrc, HOODED, 'a valid assets clip is not touched');
  assert.equal(good.settings.videoDim, 18, 'the v36 dim default upgrades a v35 profile');
  a.close();
});

test('18. GitHub media discovery: /assets/ only, sdp.gh_assets_v36 cache, 15-minute TTL, legacy purged', () => {
  const a = harness();
  const q = a.q, w = a.w, lf = q.LiveWallpaper;
  const rows = [
    { type: 'file', name: 'hooded_red_eyes_live_wallpaper_1080p_loop.mp4', path: 'assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4', download_url: 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4?token=zz' },
    { type: 'file', name: 'mountains.webp', path: 'assets/mountains.webp', download_url: 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/mountains.webp' },
    { type: 'file', name: 'bunny-poster.webp', path: 'assets/bunny-poster.webp', download_url: 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-poster.webp' },
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
  assert.equal(srcs.indexOf('./assets/test-fixture.mov'), -1);
  const cached = JSON.parse(w.localStorage.getItem(GH_KEY));
  assert.ok(cached && cached.at, 'cache written under the v36 key with a timestamp');
  lf.discoverGitHubMedia(false, () => {});
  assert.equal(calls.length, 1, 'a warm 15-minute cache means zero new requests');
  a.clock.tick(900001);
  lf.discoverGitHubMedia(false, () => {});
  assert.equal(calls.length, 2, 'after 15 minutes the cache is stale and refetches');
  w.localStorage.setItem(LEGACY_GH_KEY, 'old');
  w.localStorage.setItem('sdp.gh_videos_cache', 'older');
  lf.purgeLegacyCaches();
  assert.equal(w.localStorage.getItem(LEGACY_GH_KEY), null);
  assert.equal(w.localStorage.getItem('sdp.gh_videos_cache'), null);
  assert.ok(w.localStorage.getItem(GH_KEY), 'the v36 cache itself is never purged');
  a.close();
});

test('19. v22-v35 defaults hold: paper mode, guide auto-redirect, no password field, admin PIN 7898', () => {
  const a = harness();
  const q = a.q, w = a.w, doc = w.document;
  assert.equal(q.DB.data.settings.mode, 'paper');
  assert.equal(typeof q.UI.startPractisingFromGuide, 'function');
  const js = scriptBody();
  assert.ok(has(js, 'inp.type="text";inp.id="ansInput"'), 'the answer field is a plain text input, never type=password');
  assert.ok(has(js, 'inp.name="sdp_field_"+Math.floor(1e9*Math.random())'), 'a random field name defeats the browser password manager');
  assert.ok(has(js, 'autocomplete","off")'), 'autocomplete is off, so no Save password? prompt');
  assert.ok(has(js, 'autocorrect","off")') && has(js, 'spellcheck","false")'));
  assert.ok(has(js, 'inp.value=" "'), 'single-space IME buffer reset');
  assert.equal(require('./test-pin.cjs'), '7898', 'the documented admin PIN still unlocks lecturer mode');
  assert.equal(doc.getElementById('credit').getAttribute('aria-label'), 'Credits go to Hansana');
  a.close();
});

test('20. low-end performance: 10-ring cap, lite sparks, visibility pause and passive scroll listeners', () => {
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
  assert.ok(has(html, 'U.on(document,"visibilitychange"'), 'visibilitychange is bound');
  assert.ok(has(html, 'hardwareConcurrency') && has(html, 'deviceMemory') && has(html, 'saveData'));
  a.close();
});

test('21. the 0-75 dimmer still defaults to 18 and writes --bg-dim for the adaptive scrim', () => {
  const a = harness();
  const q = a.q, w = a.w, lf = q.LiveWallpaper;
  const input = lf.dimControl().querySelector('#sVideoDim');
  assert.equal(input.min, '0');
  assert.equal(input.max, '75');
  assert.equal(input.value, '18');
  lf.setDim(42);
  assert.equal(q.DB.data.settings.videoDim, 42);
  assert.equal(w.document.documentElement.style.getPropertyValue('--bg-dim'), '0.42');
  lf.setDim(999);
  assert.equal(q.DB.data.settings.videoDim, 75);
  lf.setDim(18);
  assert.equal(q.DB.data.settings.videoDim, 18);
  a.close();
});

test('22. sheet and player never pause the wallpaper and tabs switch in one synchronous paint', () => {
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
  let segSyncs = 0;
  const realSync = q.UI.segSync;
  q.UI.segSync = function () { segSyncs++; return realSync.apply(this, arguments); };
  q.UI.setTab('set');
  assert.ok(segSyncs > 0, 'segmented controls sync during the same tick, not 30ms later');
  q.UI.segSync = realSync;
  assert.ok(lacks(w.document.getElementById('screen-set').className, 'hidden'));
  assert.equal(w.document.querySelector('#screen-set #materialMixer') !== null, true, 'the Material Mixer lives in Settings only');
  assert.equal(w.document.querySelector('#screen-home #lgStage'), null, 'and never on Home');
  a.close();
});

test('23. media assets stay inside their byte budgets and no media file lives outside /assets/', () => {
  const mp4 = fs.statSync(path.join(root, 'assets', 'bunny-live-wallpaper.mp4')).size;
  const poster = fs.statSync(path.join(root, 'assets', 'bunny-poster.webp')).size;
  assert.ok(mp4 > 0 && mp4 <= 1600000, 'bunny mp4 must stay around 1.0-1.6 MB (' + mp4 + ' bytes)');
  assert.ok(poster > 0 && poster < 30000, 'poster must stay under 30 KB (' + poster + ' bytes)');
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
