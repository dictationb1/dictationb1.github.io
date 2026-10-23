/* Release 2.0.0 (ver 11): full WWDC25 Liquid Glass Playground + Session 7. */
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

test('release metadata is 2.0.0 / ver 11 with dark full-glass defaults', function () {
  assert.equal(versionJson.version, '2.0.0');
  assert.ok(Number(versionJson.ver) >= 11);
  assert.ok(Number(versionJson.settingsRev) >= 11);
  assert.equal(versionJson.session, '7');
  assert.equal(versionJson.title, APP);
  assert.equal(configJson.version, '2.0.0');
  assert.ok(Number(configJson.ver) >= 11);
  assert.equal(configJson.listId, LIST_ID);
  assert.equal(configJson.session.no, '7');
  assert.equal(configJson.session.date, '2026-10-22');
  assert.equal(configJson.session.title, APP);
  assert.equal(configJson.session.branch, 'CCBE Galle Branch');
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
  assert.ok(Number(sessionJson.ver) >= 11);
  assert.equal(sessionJson.session.no, '7');
  assert.equal(sessionJson.session.date, '2026-10-22');
  assert.equal(sessionJson.lists.length, 1);
  assert.equal(sessionJson.lists[0].id, LIST_ID);
  assert.equal(sessionJson.lists[0].name, APP);
  assert.equal(sessionJson.lists[0].words.length, 30);
  assert.deepEqual(sessionJson.lists[0].words.map(function (w) { return w.w; }), TRAVEL);
  for (const word of sessionJson.lists[0].words) {
    assert.ok(word.m && word.m.length > 8, word.w + ' meaning');
    assert.ok(word.s && word.s.length > 15, word.w + ' sentence');
    assert.match(word.audio, /^https:\/\/.+\.mp3$/, word.w + ' audio');
  }
  for (const word of TRAVEL) assert.ok(html.indexOf(word) >= 0, 'index has ' + word);
});

test('index carries the complete interactive Liquid Glass hero and preserved features', function () {
  const required = [
    'id="orb"', 'id="lgStage"', 'id="sBlur"', 'id="sSat"', 'id="sBrt"',
    'id="outBlur"', 'id="outSat"', 'id="outBrt"', 'id="segTint"',
    'class="hollow"', 'class="lg-hero"', 'Liquid Glass', 'Material Mixer',
    'lg-warp', '--gb', '--gs', '--gbr', '--aqua', '@keyframes rise',
    'initLiquidPlayground', 'initDockMagnification', 'pointerdown', 'pointermove',
    'Hansana', 'Ayya01', 'Lesandu', 'සිංහල', 'voice=Amy',
    'api.streamelements.com/kappa/v2/speech', 'translate.google.com/translate_tts',
    'tl=en-GB', 'writeFixed: 5', 'sentence: false', 'repeats: 2',
    'data-theme="dark" data-perf="full"', 'id="themeBtn"', 'id="homeStats"',
    'id="homeSessions"', 'id="chipNetText"', 'id="btnLock"', 'id="tabbar"',
    'ntfy.sh', 'EventSource', 'Save & Publish Live Now', 'id="sdpAudio"',
    'linear-gradient(140deg, rgba(13,58,74,.65), rgba(18,58,103,.65))',
    'linear-gradient(150deg, rgba(107,31,60,.65), rgba(138,61,28,.65))',
    'linear-gradient(150deg, rgba(36,30,82,.65), rgba(61,34,96,.65))'
  ];
  for (const token of required) assert.ok(html.indexOf(token) >= 0, 'missing: ' + token);
  assert.ok(html.indexOf('APP_VERSION = "2.0.0"') >= 0);
  assert.ok(html.indexOf('key: "sdp.v11_liquid",') >= 0);
  assert.ok(html.indexOf('schema: 11,') >= 0);
  assert.ok(html.indexOf('settingsRev: 11,') >= 0);
  assert.ok(html.indexOf('settingsRev < 11') >= 0);
  assert.equal((html.match(/id="sdpAudio"/g) || []).length, 1);
  assert.equal((html.match(/class="bubble bubble-/g) || []).length, 4);
  assert.equal(require('./test-pin.cjs'), '7898');
  assert.doesNotMatch(html, /<link[\s>]/i, 'no external link tags');
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

test('in-app v11 defaults, migration and unified audio are correct', function () {
  const a = harness();
  try {
    const q = a.q, d = q.DB.data;
    assert.equal(q.CONFIG.key, 'sdp.v11_liquid');
    assert.equal(q.CONFIG.schema, 11);
    assert.equal(q.CONFIG.settingsRev, 11);
    assert.equal(d.settingsRev, 11);
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
    old.settingsRev = 10;
    old.settings.theme = 'auto';
    old.settings.perf = 'auto';
    const migrated = q.DB.migrate(old);
    assert.equal(migrated.settings.theme, 'dark');
    assert.equal(migrated.settings.perf, 'full');
    assert.equal(migrated.settingsRev, 11);
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
    assert.equal(q.Speech.anyEnglish(), null, 'known male offline voice is filtered');
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

test('rendered Home retains every existing control and the exact Session 7 copy', function () {
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
    assert.equal(doc.querySelectorAll('#lgStage .bubble').length, 4);
    assert.match(doc.querySelector('.topbar').className, /glass/);
    assert.match(doc.getElementById('brandName').textContent, /SMART\/DICTATION/);
  } finally {
    a.close();
  }
});
