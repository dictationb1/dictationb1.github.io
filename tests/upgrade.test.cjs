/* Release 2.0.0 (ver 12): the full Apple_liquid.html WWDC25 Liquid Glass stage
   on desktop AND on a 360px phone, with Session 7 - Travel & Transport intact.
   This file is regenerated from scratch on every release (fs.writeFileSync, no
   regex surgery on the app source) and only reads index.html and data/*.json. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const readData = function (name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
};
const versionJson = readData('version.json');
const configJson = readData('config.json');
const sessionJson = readData('session.json');
const APP = 'Session 7 - Travel & Transport';
const LIST_ID = 'list_session_7_travel';
const TRAVEL = [
  'guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration',
  'journey', 'luggage', 'machine', 'mechanic', 'nationality', 'on business',
  'on vacation', 'overnight', 'passenger', 'public transport', 'reception',
  'reservation', 'road sign', 'signpost', 'spaceship', 'suitcase',
  'tourist information centre', 'traffic lights', 'tunnel', 'tyre/tire',
  'vehicle', 'visa', 'waiting room', 'windscreen'
];

/* Every CSS rule whose selector list mentions .glass, with its declarations. */
function glassRules(source) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(source))) {
    if (/(^|,|\s)\.glass(\s|,|:|\.|$)/.test(match[1])) rules.push({ selector: match[1].trim(), body: match[2] });
  }
  return rules;
}

test('release metadata is 2.0.0 / ver 12 with dark full-glass defaults', function () {
  assert.equal(versionJson.version, '2.0.0');
  assert.ok(Number(versionJson.ver) >= 12, 'ver >= 12');
  assert.ok(Number(versionJson.settingsRev) >= 12, 'settingsRev >= 12');
  assert.equal(versionJson.session, '7');
  assert.equal(versionJson.title, APP);
  assert.equal(configJson.version, '2.0.0');
  assert.ok(Number(configJson.ver) >= 12, 'config ver >= 12');
  assert.equal(configJson.listId, LIST_ID);
  assert.equal(configJson.session.no, '7');
  assert.equal(configJson.session.date, '2026-10-22');
  assert.equal(configJson.session.title, APP);
  assert.equal(configJson.session.branch, 'CCBE Galle Branch');
  assert.equal(configJson.session.display, 'SESSION 7 · 22/10/2026 · CCBE GALLE BRANCH');
  assert.equal(configJson.defaults.theme, 'dark');
  assert.equal(configJson.defaults.perf, 'full');
  assert.equal(configJson.defaults.writeMode, 'fixed');
  assert.equal(configJson.defaults.writeFixed, 5);
  assert.equal(configJson.defaults.sentence, false);
  assert.equal(configJson.defaults.repeats, 2);
  assert.equal(configJson.defaults.rate, 0.88);
  assert.equal(configJson.defaults.numbers, true);
  assert.equal(configJson.defaults.mode, 'paper');
  assert.match(configJson.credits.en, /Created by Hansana/);
  assert.match(configJson.credits.en, /Ayya01 \(Lesandu\)/);
  assert.match(String(configJson.tts.primary), /Amy/);
  assert.ok(configJson.live.state.startsWith('https://ntfy.sh/'));
});

test('session.json contains exactly the requested 30 Session 7 words', function () {
  assert.ok(Number(sessionJson.ver) >= 12);
  assert.equal(sessionJson.session.no, '7');
  assert.equal(sessionJson.session.date, '2026-10-22');
  assert.equal(sessionJson.lists.length, 1);
  assert.equal(sessionJson.lists[0].id, LIST_ID);
  assert.equal(sessionJson.lists[0].name, APP);
  assert.equal(sessionJson.lists[0].words.length, 30);
  assert.deepEqual(sessionJson.lists[0].words.map(function (w) { return w.w; }), TRAVEL);
  for (const word of sessionJson.lists[0].words) {
    assert.ok(word.m && word.m.length > 8, word.w + ' meaning');
    assert.ok(word.s && word.s.length > 15, word.s + ' sentence');
    assert.match(word.audio, /^https:\/\/.+\.mp3$/, word.w + ' audio');
  }
  for (const word of TRAVEL) assert.ok(html.indexOf(word) >= 0, 'index has ' + word);
});

test('the glass engine has no containment boundary on any glass surface', function () {
  assert.ok(html.indexOf('contain: content') < 0, 'no contain: content anywhere');
  assert.ok(html.indexOf('contain:paint') < 0, 'no contain:paint anywhere');
  assert.ok(html.indexOf('contain: paint') < 0, 'no contain: paint anywhere');
  for (const rule of glassRules(html)) {
    assert.ok(!/contain\s*:/.test(rule.body), '.glass rule must not contain: ' + rule.selector);
  }
  assert.ok(html.indexOf('-webkit-backdrop-filter: blur(var(--gb, 22px)) saturate(var(--gs, 1.7)) brightness(var(--gbr, 1.03))') >= 0,
    'the four-layer glass recipe stays intact');
});

test('the layout is a centred canvas with a floating top pill and a floating bottom dock', function () {
  assert.ok(html.indexOf('max-width: 1140px') >= 0, '#app max width');
  assert.ok(html.indexOf('padding: calc(82px + var(--safe-t)) 20px calc(104px + var(--safe-b))') >= 0, '#app padding');
  assert.ok(html.indexOf('grid-template-columns: 232px') < 0, 'the old sidebar grid is gone');
  assert.match(html, /\.topbar\.glass \{ position: fixed; top: calc\(12px \+ var\(--safe-t\)\); left: 50%; transform: translateX\(-50%\)/);
  assert.ok(html.indexOf('width: min(1100px, calc(100vw - 20px))') >= 0, 'the top pill clamps to the viewport');
  assert.match(html, /#tabbar \{position: fixed; z-index: 50;/);
  assert.ok(html.indexOf('bottom: calc(12px + var(--safe-b))') >= 0, 'the dock floats above the safe area');
  assert.ok(html.indexOf('width: min(460px, calc(100vw - 20px))') >= 0, 'the dock clamps to the viewport');
  assert.ok(html.indexOf('display: flex; flex-direction: row; gap: 6px; padding: 7px 10px; border-radius: 999px;') >= 0,
    'the dock is a horizontal pill at every width');
  assert.ok(html.indexOf('transform-origin: 50% 100%') >= 0, 'dock magnification origin');
  assert.ok(html.indexOf('initDockMagnification') >= 0, 'dock magnification is wired');
});

test('home and player carry the colour-refracting Apple_liquid.html surfaces', function () {
  const required = [
    'class="anatomy-stage"', 'class="stripes"', 'class="disc"',
    'repeating-linear-gradient(115deg, rgba(127,214,247,.40) 0 22px',
    'radial-gradient(circle at 35% 30%, #ff6f61, #7a1f4a)',
    'id="orb"', 'id="lgStage"', 'id="sBlur"', 'id="sSat"', 'id="sBrt"',
    'id="outBlur"', 'id="outSat"', 'id="outBrt"', 'id="segTint"',
    'class="hollow"', 'class="lg-hero"', 'Liquid Glass', 'Material Mixer',
    'lg-warp', '--gb', '--gs', '--gbr', '--aqua', '--mint', '@keyframes rise',
    'initLiquidPlayground', 'pointerdown', 'pointermove',
    'player-backdrop', 'player-orb', 'bento-sessions', 'statbox-in',
    'linear-gradient(140deg, #0d3a4a, #123a67)',
    'linear-gradient(150deg, #6b1f3c, #8a3d1c)',
    'radial-gradient(circle at 20% 10%, rgba(143,123,255,.5), transparent 55%), linear-gradient(150deg, #241e52, #3d2260)',
    'repeating-linear-gradient(120deg, rgba(57,212,184,.18) 0 14px, transparent 14px 34px), linear-gradient(150deg, #0d4a41, #14635b)',
    'background: linear-gradient(135deg, #5cd0f4, #3ce0b8); color: #062530;',
    'background: rgba(10,15,30,.74)', 'blur(20px)',
    'Hansana', 'Ayya01', 'Lesandu', 'සිංහල', 'voice=Amy',
    'api.streamelements.com/kappa/v2/speech', 'translate.google.com/translate_tts',
    'tl=en-GB', 'writeFixed: 5', 'sentence: false', 'repeats: 2',
    'data-theme="dark" data-perf="full"', 'id="themeBtn"', 'id="homeStats"',
    'id="homeSessions"', 'id="chipNetText"', 'id="btnLock"', 'id="tabbar"',
    'ntfy.sh', 'EventSource', 'Save & Publish Live Now', 'id="sdpAudio"'
  ];
  for (const token of required) assert.ok(html.indexOf(token) >= 0, 'missing: ' + token);
  assert.ok(html.indexOf('APP_VERSION = "2.0.0"') >= 0);
  assert.ok(html.indexOf('key: "sdp.v12_liquid",') >= 0);
  assert.ok(html.indexOf('schema: 12,') >= 0);
  assert.ok(html.indexOf('settingsRev: 12,') >= 0);
  assert.ok(html.indexOf('settingsRev < 12') >= 0);
  assert.ok(html.indexOf('resetToV12') >= 0);
  assert.ok(html.indexOf('<html lang="en-GB" data-theme="dark" data-perf="full"') >= 0);
  assert.ok(html.indexOf('<body data-theme="dark" data-perf="full">') >= 0);
  assert.equal((html.match(/id="sdpAudio"/g) || []).length, 1);
  assert.equal((html.match(/class="bubble bubble-/g) || []).length, 4);
  assert.equal(require('./test-pin.cjs'), '7898');
  assert.doesNotMatch(html, /<link[\s>]/i, 'no external link tags');
});

test('high contrast is a real boolean, never the truthy string "off"', function () {
  assert.ok(html.indexOf('hc: false') >= 0, 'the default is the boolean false');
  assert.ok(html.indexOf('hc: "off"') < 0, 'the truthy "off" string is gone');
  const a = harness();
  try {
    assert.equal(a.q.DB.data.settings.hc, false);
    assert.equal(a.w.document.documentElement.getAttribute('data-hc'), 'off');
    a.q.DB.data.settings.hc = true;
    a.q.UI.applyHc();
    assert.equal(a.w.document.documentElement.getAttribute('data-hc'), 'on');
    a.q.DB.data.settings.hc = 'off';
    assert.equal(a.q.UI.applyHc() || a.w.document.documentElement.getAttribute('data-hc'), 'off');
  } finally {
    a.close();
  }
});

test('mobile 360px-430px rules keep the top bar and orb stage inside the viewport', function () {
  assert.ok(html.indexOf('@media (max-width: 860px)') >= 0, '860px breakpoint');
  assert.ok(html.indexOf('@media (max-width: 520px)') >= 0, '520px breakpoint');
  assert.match(html, /@media \(max-width: 860px\) \{[\s\S]*?\.lg-hero \{ grid-template-columns: minmax\(0,1fr\); gap: 16px; \}/);
  assert.match(html, /@media \(max-width: 860px\) \{[\s\S]*?#lgStage\.stage \{ min-height: 330px;/);
  assert.match(html, /\.topbar\.glass \{ flex-wrap: nowrap; overflow-x: auto; padding: 6px 10px;/);
  assert.match(html, /@media \(max-width: 520px\) \{ \.topbar \.brand \.t \{ display: none; \}/);
  assert.ok(html.indexOf('#lgStage.stage { position: relative; min-height: 470px; border-radius: 32px; overflow: hidden;') >= 0,
    'the orb stage clips its own overflow');
});

test('destructive old Lite/theme overrides are absent', function () {
  assert.ok(html.indexOf('body * { -webkit-backdrop-filter: none !important') < 0);
  assert.ok(html.indexOf('body[data-perf="lite"] .blob { display: none }') < 0);
  assert.doesNotMatch(html, /backdrop-filter:\s*none\s*!important/i);
  assert.doesNotMatch(html, /box-shadow:\s*none\s*!important/i);
  assert.doesNotMatch(html, /(?:#grain|\.blob)[^{]*\{[^}]*display:\s*none/i);
  assert.doesNotMatch(html, /hardwareConcurrency\s*<=\s*4[^;]*settings\.perf\s*=\s*"lite"/);
  assert.ok(html.indexOf('body[data-perf="lite"] .blob { animation-play-state: paused !important; }') >= 0);
});

test('in-app v12 defaults, migration and the unified Amy voice are correct', function () {
  const a = harness();
  try {
    const q = a.q, d = q.DB.data;
    assert.equal(q.CONFIG.key, 'sdp.v12_liquid');
    assert.equal(q.CONFIG.schema, 12);
    assert.equal(q.CONFIG.settingsRev, 12);
    assert.equal(d.settingsRev, 12);
    assert.equal(d.settings.theme, 'dark');
    assert.equal(d.settings.perf, 'full');
    assert.equal(d.settings.writeMode, 'fixed');
    assert.equal(d.settings.writeFixed, 5);
    assert.equal(d.settings.sentence, false);
    assert.equal(d.settings.repeats, 2);
    assert.equal(d.settings.rate, 0.88);
    assert.equal(d.settings.numbers, true);
    assert.equal(d.settings.mode, 'paper');
    assert.equal(d.lists.length, 1);
    assert.equal(d.lists[0].name, APP);
    assert.equal(d.lists[0].words.length, 30);
    assert.deepEqual(Array.from(d.lists[0].words, function (w) { return w.w; }), TRAVEL);
    assert.equal(d.session.no, '7');
    assert.equal(d.session.date, '2026-10-22');
    assert.equal(d.session.branch, 'CCBE Galle Branch');
    assert.ok(a.w.document.getElementById('sdpAudio'));

    const old = q.defaultData();
    old.settingsRev = 11;
    old.settings.theme = 'auto';
    old.settings.perf = 'auto';
    const migrated = q.DB.migrate(old);
    assert.equal(migrated.settings.theme, 'dark');
    assert.equal(migrated.settings.perf, 'full');
    assert.equal(migrated.settingsRev, 12);
    const manual = q.defaultData();
    manual.settings.theme = 'light';
    manual.settings.perf = 'lite';
    const kept = q.DB.migrate(manual);
    assert.equal(kept.settings.theme, 'light', 'manual Light remains available');
    assert.equal(kept.settings.perf, 'lite', 'manual Lite remains available');

    const sources = q.Speech.streamSources('tourist information centre');
    assert.equal(sources.length, 2);
    assert.equal(sources[0], 'https://api.streamelements.com/kappa/v2/speech?voice=Amy&text=tourist%20information%20centre');
    assert.equal(sources[1], 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-GB&q=tourist%20information%20centre');
    q.Speech.voices = [{ name: 'Daniel', lang: 'en-GB' }];
    assert.equal(q.Speech.anyEnglish(), null, 'a known male offline voice is filtered');
    q.Speech.voices.push({ name: 'Microsoft Sonia', lang: 'en-GB' });
    assert.equal(q.Speech.anyEnglish().name, 'Microsoft Sonia');
  } finally {
    a.close();
  }
});

test('theme and performance never auto-downgrade; only manual Lite is honoured', function () {
  const a = harness();
  try {
    const q = a.q, doc = a.w.document;
    q.DB.data.settings.theme = 'auto';
    q.UI.applyTheme();
    assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark');
    assert.equal(doc.body.getAttribute('data-theme'), 'dark');
    q.DB.data.settings.theme = 'light';
    q.UI.applyTheme();
    assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');
    assert.equal(doc.body.getAttribute('data-theme'), 'light');
    assert.equal(doc.getElementById('themeBtn').textContent, '☾');
    doc.getElementById('themeBtn').click();
    assert.equal(q.DB.data.settings.theme, 'dark');
    assert.equal(doc.body.getAttribute('data-theme'), 'dark');
    assert.equal(doc.getElementById('themeBtn').textContent, '☀');

    q.DB.data.settings.perf = 'auto';
    q.UI.autoDowngraded = true;
    q.UI.frameMs = 80;
    assert.equal(q.UI.autoPerf(), 'full');
    q.UI.recordFrames([45, 50, 55]);
    assert.equal(q.UI.perfMode, 'full');
    assert.equal(q.UI.autoDowngraded, false);
    assert.equal(doc.body.getAttribute('data-perf'), 'full');
    q.DB.data.settings.perf = 'lite';
    q.UI.applyPerf();
    assert.equal(q.UI.perfMode, 'lite');
    assert.equal(doc.body.getAttribute('data-perf'), 'lite');
    assert.equal(doc.querySelectorAll('#bg .blob').length, 4);
    assert.ok(doc.getElementById('grain'));
  } finally {
    a.close();
  }
});

test('live mixer, tint, draggable orb and dock magnification work', function () {
  const a = harness();
  try {
    const w = a.w, doc = w.document, root = doc.documentElement;
    function input(id, value) {
      const el = doc.getElementById(id);
      el.value = String(value);
      el.dispatchEvent(new w.Event('input', { bubbles: true }));
    }
    input('sBlur', 34);
    input('sSat', 210);
    input('sBrt', 110);
    assert.equal(root.style.getPropertyValue('--gb'), '34px');
    assert.equal(root.style.getPropertyValue('--gs'), '2.1');
    assert.equal(root.style.getPropertyValue('--gbr'), '1.1');
    assert.equal(doc.getElementById('outBlur').textContent, '34px');
    assert.equal(doc.getElementById('outSat').textContent, '2.1×');
    assert.equal(doc.getElementById('outBrt').textContent, '1.1');
    doc.querySelector('#segTint [data-tint="frost"]').click();
    assert.ok(doc.body.classList.contains('tint-frost'));
    doc.querySelector('#segTint [data-tint="smoke"]').click();
    assert.ok(!doc.body.classList.contains('tint-frost'));
    assert.ok(doc.body.classList.contains('tint-smoke'));
    doc.querySelector('#segTint [data-tint="clear"]').click();
    assert.ok(!doc.body.classList.contains('tint-smoke'));

    const stage = doc.getElementById('lgStage'), orb = doc.getElementById('orb');
    stage.getBoundingClientRect = function () { return { left: 0, top: 0, width: 500, height: 420 }; };
    Object.defineProperty(orb, 'offsetWidth', { configurable: true, value: 140 });
    Object.defineProperty(orb, 'offsetHeight', { configurable: true, value: 140 });
    orb.getBoundingClientRect = function () {
      return { left: parseFloat(orb.style.left) || 0, top: parseFloat(orb.style.top) || 0, width: 140, height: 140 };
    };
    orb.style.left = '180px';
    orb.style.top = '60px';
    function pointer(type, x, y) {
      const event = new w.Event(type, { bubbles: true, cancelable: true });
      event.pointerId = 1;
      event.clientX = x;
      event.clientY = y;
      orb.dispatchEvent(event);
    }
    pointer('pointerdown', 220, 100);
    pointer('pointermove', 280, 150);
    pointer('pointerup', 280, 150);
    assert.equal(orb.style.left, '240px');
    assert.equal(orb.style.top, '110px');
    assert.ok(!orb.classList.contains('dragging'));
    orb.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    assert.equal(orb.style.left, '252px');

    const dock = doc.getElementById('tabbar');
    const buttons = Array.from(dock.querySelectorAll('button'));
    buttons.forEach(function (button, i) {
      button.getBoundingClientRect = function () { return { left: i * 90, width: 88 }; };
    });
    const move = new w.Event('pointermove', { bubbles: true });
    move.pointerType = 'mouse';
    move.clientX = 44;
    dock.dispatchEvent(move);
    assert.match(buttons[0].style.transform, /scale\(1\.280\)/);
    dock.dispatchEvent(new w.Event('pointerleave'));
    assert.equal(buttons[0].style.transform, '');
  } finally {
    a.close();
  }
});

test('rendered Home keeps the stage anatomy, bento tiles and exact Session 7 copy', function () {
  const a = harness();
  try {
    const doc = a.w.document;
    const ids = ['homeHero', 'homeKicker', 'homeTitle', 'homeSub', 'homeMeta', 'btnStart',
      'btnStartText', 'btnGuide', 'segMode', 'homeStats', 'homeSessions', 'chipNet',
      'chipNetText', 'btnLock', 'tabbar', 'lgStage', 'orb', 'materialMixer'];
    for (const id of ids) assert.ok(doc.getElementById(id), '#' + id);
    assert.equal(doc.getElementById('homeKicker').textContent, 'SESSION 7 · 22/10/2026 ● CCBE GALLE BRANCH');
    assert.equal(doc.getElementById('homeTitle').textContent, APP);
    assert.equal(doc.getElementById('homeSub').textContent, '30 words · 5s timer · Word ×2 · British Female Professor Voice (Amy · en-GB)');
    assert.equal(doc.getElementById('btnGuide').textContent, 'User Guide / උපදෙස්');
    assert.equal(doc.querySelectorAll('#homeStats .statbox').length, 3);
    assert.equal(doc.querySelectorAll('#homeStats .statbox .glass.statbox-in').length, 3);
    assert.equal(doc.querySelectorAll('#lgStage .bubble').length, 4);
    assert.ok(doc.querySelector('.anatomy-stage > #homeHero'), 'the hero sits inside the anatomy stage');
    assert.ok(doc.querySelector('.anatomy-stage > .stripes'), 'stripes behind the hero');
    assert.ok(doc.querySelector('.anatomy-stage > .disc'), 'the coral disc behind the hero');
    assert.ok(doc.querySelector('#screen-home .bento-sessions #homeSessions'), 'past sessions sit on the mint bento tile');
    assert.match(doc.querySelector('.topbar').className, /glass/);
    assert.match(doc.getElementById('brandName').textContent, /SMART\/DICTATION/);
    assert.ok(doc.querySelector('.hero-credit').textContent.indexOf('Hansana') >= 0);
    assert.ok(doc.querySelector('.hero-credit').textContent.indexOf('Ayya01 (Lesandu)') >= 0);
  } finally {
    a.close();
  }
});

test('the Dictation Player layer opens with its own stripes and warm orb backdrop', function () {
  const a = harness();
  try {
    const doc = a.w.document;
    a.q.Eng.openPlayer();
    const back = doc.querySelector('#layers .layer .player-backdrop');
    assert.ok(back, 'the player backdrop exists');
    assert.ok(back.querySelector('.stripes'), 'stripes behind the word card');
    assert.ok(back.querySelector('.player-orb'), 'the warm orb behind the word card');
    assert.ok(doc.querySelector('#layers .layer .wordcard.glass'), 'the word card is still glass');
    assert.ok(doc.querySelector('#layers .layer .lens button'), 'the lens play button exists');
    assert.ok(doc.querySelector('#layers .layer .ctrlgrid'), 'the full control grid is preserved');
    a.q.UI.closeLayer(a.q.Eng.layer);
  } finally {
    a.close();
  }
});
