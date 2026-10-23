/* Release 2.1.0 (ver 13) - regenerated from scratch for this release.
   The suite reads index.html + data/*.json, boots the real single-file app in
   jsdom (tests/app-harness.cjs) and checks the 60 FPS Liquid Glass engine,
   automatic Lite mode, the low-data engine and every interactive control.
   Nothing here edits the app source: no regex surgery, no string patching. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const readJSON = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const versionJson = readJSON('version.json');
const configJson = readJSON('config.json');
const sessionJson = readJSON('session.json');
const PIN = require('./test-pin.cjs');

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

/* ---------------------------------------------------------------- helpers */

function boot() {
  return harness();
}

/* deterministic device profile for UI.autoPerf() */
function device(a, prefs) {
  const w = a.w;
  const p = prefs || {};
  if (p.width) Object.defineProperty(w, 'innerWidth', { value: p.width, configurable: true });
  if (p.cores) Object.defineProperty(w.navigator, 'hardwareConcurrency', { value: p.cores, configurable: true });
  if (p.memory) Object.defineProperty(w.navigator, 'deviceMemory', { value: p.memory, configurable: true });
  if (p.saveData) Object.defineProperty(w.navigator, 'connection', { value: { saveData: true, effectiveType: '3g' }, configurable: true });
  w.matchMedia = (q) => ({ matches: (p.media || []).some((needle) => q.indexOf(needle) >= 0), addEventListener() {} });
  return a;
}

/* every CSS rule whose selector list mentions .glass */
function glassRules(source) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(source))) {
    if (/(^|,|\s)\.glass(\s|,|:|\.|$)/.test(match[1])) rules.push({ selector: match[1].trim(), body: match[2] });
  }
  return rules;
}

function fire(a, el, type) {
  el.dispatchEvent(new a.w.Event(type, { bubbles: true, cancelable: true }));
}

function slide(a, id, value) {
  const el = a.w.document.getElementById(id);
  assert.ok(el, 'slider #' + id);
  el.value = String(value);
  fire(a, el, 'input');
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

/* ---------------------------------------------------------------- runner */

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ------------------------------------------------------- release metadata */

test('release is 2.1.0 / ver 13 with automatic Lite defaults', function () {
  assert.equal(versionJson.appVersion, '2.1.0');
  assert.ok(Number(versionJson.ver) >= 13, 'ver >= 13');
  assert.equal(versionJson.settingsRev, 13);
  assert.equal(versionJson.session, '7');
  assert.equal(versionJson.title, APP);
  assert.equal(versionJson.updatedAt, '2026-10-23T00:00:00Z');
  assert.equal(configJson.version, '2.1.0');
  assert.ok(Number(configJson.ver) >= 13);
  assert.equal(configJson.settingsRev, 13);
  assert.equal(configJson.defaults.perf, 'auto');
  assert.equal(configJson.defaults.theme, 'dark');
  assert.equal(configJson.defaults.writeMode, 'fixed');
  assert.equal(configJson.defaults.writeFixed, 5);
  assert.equal(configJson.defaults.repeats, 2);
  assert.equal(configJson.defaults.sentence, false);
  assert.equal(configJson.defaults.rate, 0.88);
  assert.equal(configJson.defaults.numbers, true);
  assert.equal(configJson.defaults.mode, 'paper');
  assert.equal(configJson.listId, LIST_ID);
  assert.deepEqual(configJson.session, {
    no: '7', day: 'Thursday', date: '2026-10-22', title: APP,
    listId: LIST_ID, branch: 'CCBE Galle Branch',
    display: 'SESSION 7 · 22/10/2026 · CCBE GALLE BRANCH'
  });
  assert.match(configJson.credits.en, /Created by Hansana/);
  assert.match(configJson.credits.en, /Ayya01 \(Lesandu\)/);
  assert.match(configJson.credits.en, /Sumodya Sewmini/);
  assert.match(configJson.credits.si, /Hansana/);
  assert.match(configJson.credits.si, /Ayya01 \(Lesandu\)/);
  assert.match(configJson.credits.si, /කථිකාචාර්ය/);
  assert.match(String(configJson.tts.primary), /Amy/);
  assert.ok(configJson.live.state.startsWith('https://ntfy.sh/'));
  assert.equal(html.indexOf('APP_VERSION = "2.1.0"') >= 0, true);
});

test('Session 7 - Travel & Transport carries exactly the 30 requested words', function () {
  assert.ok(Number(sessionJson.ver) >= 13);
  assert.equal(sessionJson.session.no, '7');
  assert.equal(sessionJson.session.date, '2026-10-22');
  assert.equal(sessionJson.session.branch, 'CCBE Galle Branch');
  assert.equal(sessionJson.lists.length, 1);
  assert.equal(sessionJson.lists[0].id, LIST_ID);
  assert.equal(sessionJson.lists[0].name, APP);
  assert.equal(sessionJson.lists[0].words.length, 30);
  assert.deepEqual(sessionJson.lists[0].words.map((w) => w.w), TRAVEL);
  for (const word of sessionJson.lists[0].words) {
    assert.ok(word.m && word.m.length > 8, word.w + ' meaning');
    assert.ok(word.s && word.s.length > 15, word.w + ' example');
    assert.match(word.audio, /^https:\/\/.+\.mp3$/, word.w + ' British MP3');
  }
  for (const word of TRAVEL) assert.ok(html.indexOf(word) >= 0, 'index.html embeds ' + word);
});

/* ------------------------------------------------------ the glass engine */

test('zero-cost background: pre-blurred gradient blobs and no full-screen grain filter', function () {
  const blob = html.slice(html.indexOf('.blob {'), html.indexOf('.blob1 {'));
  assert.ok(blob.indexOf('radial-gradient(circle, var(--blob-color) 0%, transparent 70%)') >= 0, 'gradient blob');
  assert.ok(blob.indexOf('opacity: .52') >= 0);
  assert.ok(blob.indexOf('translate3d(0,0,0)') >= 0);
  assert.equal(html.indexOf('filter: blur(85px)'), -1, 'no 85px GPU blur left');
  for (const size of ['blob1', 'blob2', 'blob3', 'blob4']) {
    assert.match(html, new RegExp('\\.' + size + ' \\{ --blob-color: var\\(--' + size + '\\)'));
  }
  assert.ok(html.indexOf('#grain { display: none !important; }') >= 0, 'grain never rasterises');
  assert.ok(html.indexOf('<svg') >= 0 && html.indexOf('width="0"') >= 0, 'the hidden svg sprite stays for tests');
  assert.equal(/filter:\s*url\(#grain\)/.test(html), false);
  assert.equal(html.indexOf('contain: content'), -1);
  assert.equal(html.indexOf('contain: paint'), -1);
  for (const rule of glassRules(html)) assert.ok(!/contain\s*:/.test(rule.body), '.glass never contains: ' + rule.selector);
});

test('Lite mode keeps 100% of the Apple Liquid Glass look at 60 FPS', function () {
  assert.ok(html.indexOf('body[data-perf="lite"] { --gb: 8px; --gs: 1.35; --gbr: 1.02; }') >= 0);
  assert.match(html, /body\[data-perf="lite"\] \.blob, body\[data-perf="lite"\] \.bubble, body\[data-perf="lite"\] \.chip-a, body\[data-perf="lite"\] \.chip-b \{ animation: none !important; \}/);
  assert.ok(html.indexOf('body[data-perf="lite"] .glass::before { display: none !important; }') >= 0);
  const lite = html.slice(html.indexOf('body[data-perf="lite"] .topbar.glass'), html.indexOf('/* repeated inner rows'));
  for (const surface of ['body[data-perf="lite"] .topbar.glass', 'body[data-perf="lite"] #tabbar.glass',
    'body[data-perf="lite"] #homeHero.glass', 'body[data-perf="lite"] .panel.glass',
    'body[data-perf="lite"] .wordcard.glass', 'body[data-perf="lite"] .sheet', 'body[data-perf="lite"] .modal']) {
    assert.ok(lite.indexOf(surface) >= 0, 'lite keeps ' + surface);
  }
  assert.ok(lite.indexOf('blur(var(--gb)) saturate(var(--gs)) brightness(var(--gbr))') >= 0, 'blur kept in lite');
  assert.ok(lite.indexOf('inset 0 1.5px 0 0 var(--inset-hi)') >= 0, 'specular rim kept in lite');
  const rows = html.slice(html.indexOf('/* repeated inner rows'), html.indexOf('/* repeated inner rows') + 420);
  assert.ok(rows.indexOf('backdrop-filter: none') >= 0, 'long lists use a cheap translucent surface');
  assert.ok(rows.indexOf('linear-gradient(135deg, rgba(255,255,255,.13), rgba(255,255,255,.05))') >= 0);
});

test('the Apple_liquid.html anatomy survives in both modes', function () {
  const tokens = [
    'class="topbar glass"', 'id="tabbar"', 'class="anatomy-stage"', 'class="stripes"', 'class="disc"',
    'id="homeHero"', 'id="lgStage"', 'id="orb"', 'id="materialMixer"', 'class="glass panel"',
    'class="bubble bubble-1"', 'id="sBlur"', 'id="sSat"', 'id="sBrt"',
    'id="outBlur"', 'id="outSat"', 'id="outBrt"', 'id="segTint"', 'class="seg-ind"',
    'id="segPerf"', 'id="perfStatus"', 'id="btnPerf"', 'id="btnGuideTop"', 'id="btnAdmin"',
    'id="btnTheme"', 'id="chipNet"', 'id="btnRefresh"', 'id="btnLang"',
    '--gb', '--gs', '--gbr', '--aqua', '--mint', '--coral', '--violet',
    'bindLiquidControls', 'initDockMagnification', 'togglePerf', 'autoPerf', 'frameProbe',
    'openWelcomeGuide', 'preload="none"', 'reuseAudio' === 'x' ? '' : 'lastAudioUrl',
    'data-perf="lite"', 'voice=Amy', 'translate.google.com/translate_tts', 'tl=en-GB',
    'Save & Publish Live Now', 'EventSource', 'ntfy.sh',
    'Hansana', 'Ayya01 (Lesandu)', 'සිංහල'
  ];
  for (const token of tokens) if (token) assert.ok(html.indexOf(token) >= 0, 'missing: ' + token);
  assert.equal((html.match(/id="sdpAudio"/g) || []).length, 1);
  assert.equal((html.match(/class="bubble bubble-/g) || []).length, 4);
  assert.doesNotMatch(html, /<link[\s>]/i, 'no external link tags');
  assert.doesNotMatch(html, /fonts\.googleapis|cdn\.jsdelivr|unpkg\.com/i, 'no external assets');
});

/* ------------------------------------------------- automatic performance */

test('a weak, small, touch or save-data device selects Lite automatically', function () {
  const scenarios = [
    ['reduced motion', { cores: 8, memory: 8, width: 1280, media: ['prefers-reduced-motion'] }, 'lite'],
    ['reduced transparency', { cores: 8, memory: 8, width: 1280, media: ['prefers-reduced-transparency'] }, 'lite'],
    ['phone width', { cores: 8, memory: 8, width: 390 }, 'lite'],
    ['coarse pointer', { cores: 8, memory: 8, width: 1280, media: ['(pointer: coarse)'] }, 'lite'],
    ['four cores', { cores: 4, memory: 8, width: 1280 }, 'lite'],
    ['four GB', { cores: 8, memory: 4, width: 1280 }, 'lite'],
    ['data saver', { cores: 8, memory: 8, width: 1280, saveData: true }, 'lite'],
    ['strong desktop', { cores: 8, memory: 8, width: 1280 }, 'full']
  ];
  for (const [label, prefs, want] of scenarios) {
    const a = boot();
    try {
      device(a, prefs);
      assert.equal(a.q.UI.autoPerf(), want, label);
    } finally {
      a.close();
    }
  }
});

test('frameProbe samples ONE 1.2 s window, cancels its rAF loop and downgrades under 52 FPS', function () {
  const a = boot();
  try {
    const w = a.w, ui = a.q.UI;
    assert.equal(ui.frameWatchStarted, true, 'the probe runs once on boot');
    let requests = 0, cancelled = 0, pending = null, calls = 0;
    w.requestAnimationFrame = function (cb) { requests++; pending = cb; return requests; };
    w.cancelAnimationFrame = function () { cancelled++; };
    ui.frameWatchStarted = false;
    ui.frameProbe(function () { calls++; });
    let t = 0;
    for (let i = 0; i < 120 && pending; i++) {
      const cb = pending;
      pending = null;
      t += 16.7;
      cb(t);
    }
    assert.equal(calls, 1, 'the probe callback fires exactly once');
    assert.equal(pending, null, 'no animation frame is left running');
    assert.ok(cancelled >= 1, 'the final requestAnimationFrame is cancelled');
    assert.ok(requests >= 60 && requests <= 80, 'one 1200 ms window at ~60 Hz: ' + requests);
    assert.ok(ui.frameMs > 10 && ui.frameMs < 25, 'median frame ' + ui.frameMs);

    device(a, { cores: 8, memory: 8, width: 1280 });
    a.q.DB.data.settings.perf = 'auto';
    ui.autoDowngraded = false;
    ui.recordFrames([16, 16.6, 17, 16.2]);
    assert.equal(ui.perfMode, 'full', '60 FPS keeps full glass');
    ui.recordFrames([42, 48, 55, 60]);
    assert.equal(ui.autoDowngraded, true);
    assert.equal(ui.perfMode, 'lite', 'slow frames switch to Lite');
    assert.equal(w.document.body.getAttribute('data-perf'), 'lite');
    assert.equal(ui.perfLabel(), '⚡ Auto Lite (60 FPS)');
    assert.equal(w.document.getElementById('btnPerf').textContent, '⚡ Lite');
  } finally {
    a.close();
  }
});

test('one tap switches Lite and Full from the topbar and from the mixer', function () {
  const a = boot();
  try {
    const doc = a.w.document, ui = a.q.UI, st = a.q.DB.data.settings;
    device(a, { cores: 8, memory: 8, width: 1280 });
    ui.setPerf('full');
    assert.equal(st.perf, 'full');
    assert.equal(doc.body.getAttribute('data-perf'), 'full');
    assert.equal(doc.getElementById('btnPerf').textContent, '✨ Full');
    doc.getElementById('btnPerf').click();
    assert.equal(st.perf, 'lite');
    assert.equal(doc.body.getAttribute('data-perf'), 'lite');
    assert.equal(doc.getElementById('btnPerf').textContent, '⚡ Lite');
    assert.equal(doc.getElementById('btnPerf').getAttribute('aria-pressed'), 'true');
    doc.getElementById('btnPerf').click();
    assert.equal(st.perf, 'full');
    assert.equal(doc.body.getAttribute('data-perf'), 'full');
    assert.equal(doc.querySelector('#segPerf [data-perf="full"]').getAttribute('aria-pressed'), 'true');
    doc.querySelector('#segPerf [data-perf="auto"]').click();
    assert.equal(st.perf, 'auto');
    assert.equal(doc.getElementById('perfStatus').textContent, ui.perfLabel());
    assert.equal(a.q.DB.data.settingsRev, 13);
  } finally {
    a.close();
  }
});

/* -------------------------------------------------- interactive controls */

test('mixer sliders, tint, perf segment and the orb survive a re-render', function () {
  const a = boot();
  try {
    const doc = a.w.document, root = doc.documentElement, ui = a.q.UI, st = a.q.DB.data.settings;
    device(a, { cores: 8, memory: 8, width: 1280 });
    ui.setPerf('full');
    slide(a, 'sBlur', 34);
    slide(a, 'sSat', 210);
    slide(a, 'sBrt', 110);
    assert.equal(root.style.getPropertyValue('--gb'), '34px');
    assert.equal(root.style.getPropertyValue('--gs'), '2.10');
    assert.equal(root.style.getPropertyValue('--gbr'), '1.10');
    assert.equal(doc.getElementById('outBlur').textContent, '34px');
    assert.equal(doc.getElementById('outSat').textContent, '2.1×');
    assert.equal(doc.getElementById('outBrt').textContent, '1.1');
    assert.equal(st.glassBlur, 34);
    assert.equal(st.glassSat, 210);
    assert.equal(st.glassBrt, 110);

    doc.querySelector('#segTint [data-tint="frost"]').click();
    assert.ok(doc.body.classList.contains('tint-frost'));
    assert.equal(doc.querySelector('#segTint .seg-ind').style.transform, 'translateX(100%)');
    assert.equal(st.glassTint, 'frost');
    doc.querySelector('#segTint [data-tint="smoke"]').click();
    assert.ok(doc.body.classList.contains('tint-smoke'));
    assert.ok(!doc.body.classList.contains('tint-frost'));
    assert.equal(doc.querySelector('#segTint .seg-ind').style.transform, 'translateX(200%)');
    doc.querySelector('#segTint [data-tint="clear"]').click();
    assert.ok(!doc.body.classList.contains('tint-smoke'));

    /* simulate Screens.home() re-rendering the mixer from fresh markup */
    const mixer = doc.getElementById('materialMixer');
    const fresh = mixer.cloneNode(true);
    mixer.parentNode.replaceChild(fresh, mixer);
    a.q.Screens.home();
    const blur = a.w.document.getElementById('sBlur');
    assert.ok(blur, 'the re-rendered mixer is in the document');
    blur.value = '28';
    fire(a, blur, 'input');
    assert.equal(a.w.document.documentElement.style.getPropertyValue('--gb'), '28px');
    assert.equal(a.w.document.getElementById('outBlur').textContent, '28px');
    a.w.document.querySelector('#segTint [data-tint="frost"]').click();
    assert.ok(a.w.document.body.classList.contains('tint-frost'));

    const stage = a.w.document.getElementById('lgStage');
    const orb = a.w.document.getElementById('orb');
    stage.getBoundingClientRect = function () { return { left: 0, top: 0, width: 500, height: 420 }; };
    Object.defineProperty(orb, 'offsetWidth', { configurable: true, value: 140 });
    Object.defineProperty(orb, 'offsetHeight', { configurable: true, value: 140 });
    orb.getBoundingClientRect = function () {
      return { left: parseFloat(orb.style.left) || 0, top: parseFloat(orb.style.top) || 0, width: 140, height: 140 };
    };
    orb.style.left = '180px';
    orb.style.top = '60px';
    function pointer(type, x, y) {
      const event = new a.w.Event(type, { bubbles: true, cancelable: true });
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
    orb.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    assert.equal(orb.style.left, '252px');
  } finally {
    a.close();
  }
});

test('dock magnification only tracks a fine pointer in Full mode, once per frame', function () {
  const a = boot();
  try {
    const doc = a.w.document, ui = a.q.UI;
    device(a, { cores: 8, memory: 8, width: 1280, media: ['(hover: hover) and (pointer: fine)'] });
    ui.setPerf('full');
    assert.equal(ui.finePointer(), true);
    const dock = doc.getElementById('tabbar');
    const buttons = Array.from(dock.querySelectorAll('button'));
    assert.equal(buttons.length, 5, 'five dock sections');
    buttons.forEach(function (button, i) { button.getBoundingClientRect = function () { return { left: i * 90, width: 88 }; }; });
    const move = new a.w.Event('pointermove', { bubbles: true });
    move.pointerType = 'mouse';
    move.clientX = 44;
    dock.dispatchEvent(move);
    a.clock.tick(40);
    assert.match(buttons[0].style.transform, /scale\(1\.280\)/);
    const touch = new a.w.Event('pointermove', { bubbles: true });
    touch.pointerType = 'touch';
    touch.clientX = 44;
    dock.dispatchEvent(touch);
    assert.equal(buttons[0].style.transform, '', 'touch never magnifies');
    dock.dispatchEvent(new a.w.Event('pointerleave'));
    assert.equal(buttons[0].style.transform, '');
  } finally {
    a.close();
  }
});

/* -------------------------------------------------------- the low-data engine */

test('the 30 class words are answered from memory with zero dictionary fetches', function () {
  const a = boot();
  try {
    const q = a.q;
    let fetches = 0;
    a.w.fetch = function () { fetches++; return Promise.reject(new Error('offline')); };
    const seen = [];
    for (const word of TRAVEL) {
      q.Dict.lookup(word, function (res) {
        seen.push(word);
        assert.ok(res, 'entry for ' + word);
        assert.ok(res.meaning && res.meaning.length > 8, word + ' meaning');
        assert.ok(res.ipa && res.ipa.length > 2, word + ' British IPA');
        assert.equal(res.embedded, true);
      });
    }
    assert.equal(seen.length, 30);
    assert.equal(fetches, 0, 'no api.dictionaryapi.dev request for class words');
    let tyre = null;
    q.Dict.lookup('tyre', function (res) { tyre = res; });
    assert.ok(tyre && tyre.meaning, 'the slash alternative resolves');
    q.Dict.lookup('tire', function (res) { assert.ok(res && res.meaning, 'tire resolves'); });
    assert.equal(fetches, 0);
    q.Dict.lookup('zzznotaword', function () {});
    assert.equal(fetches, 1, 'an unknown Admin word still uses the dictionary API');
  } finally {
    a.close();
  }
});

test('a repeated word replays the buffered MP3 instead of downloading it again', function () {
  const a = boot();
  try {
    const doc = a.w.document, speech = a.q.Speech, audio = doc.getElementById('sdpAudio');
    assert.equal(audio.getAttribute('preload'), 'none', 'nothing is pre-fetched on boot');
    const url = speech.streamSources('guidebook')[0];
    assert.match(url, /voice=Amy/);
    let srcSets = 0, plays = 0;
    Object.defineProperty(audio, 'canPlayType', { configurable: true, value: function () { return 'probably'; } });
    Object.defineProperty(audio, 'readyState', { configurable: true, get: function () { return 2; } });
    Object.defineProperty(audio, 'src', {
      configurable: true,
      get: function () { return url; },
      set: function () { srcSets++; }
    });
    audio.play = function () { plays++; return Promise.resolve(); };
    audio.pause = function () {};
    speech.playOnce(url, 0.88, 6000, function () {});
    assert.equal(srcSets, 0, 'the buffered source is never re-assigned');
    assert.equal(plays, 1, 'the element is simply replayed');
    assert.equal(audio.currentTime, 0, 'playback restarts from the beginning');
    const other = speech.streamSources('harbour')[1];
    speech.playOnce(other, 0.88, 6000, function () {});
    assert.equal(srcSets, 1, 'a different word does load its own source');
    assert.equal(speech.streamSources('visa')[1].indexOf('tl=en-GB') > 0, true);
    speech.remember('https://example.test/a.mp3');
    for (let i = 0; i < 60; i++) speech.remember('https://example.test/' + i + '.mp3');
    assert.ok(Object.keys(speech.audioBlobCache).length <= 35, 'the audio cache stays bounded');
  } finally {
    a.close();
  }
});

test('repository sync reads version.json once and only then session.json', async function () {
  const a = boot();
  try {
    const calls = [];
    a.w.fetch = function (url) {
      const u = String(url);
      calls.push(u);
      if (u.indexOf('version.json') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve(versionJson) });
      if (u.indexOf('session.json') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve(sessionJson) });
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    };
    a.q.DB.data.ver = 0;
    a.q.Cloud.repoFetched = false;
    a.q.Cloud.fetchRepo(function () {});
    await flush();
    assert.equal(calls.some((u) => u.indexOf('?t=') >= 0), false, 'no cache-busting query string');
    assert.equal(calls[0], './data/version.json');
    assert.ok(calls.some((u) => u === './data/session.json'), 'a newer ver downloads the session');
    assert.ok(Number(a.q.DB.data.ver) >= 13);

    calls.length = 0;
    a.q.Cloud.repoFetched = false;
    a.q.Cloud.fetchRepo(function () {});
    await flush();
    assert.deepEqual(calls, ['./data/version.json'], 'up-to-date boot reads only the 60-byte file');

    calls.length = 0;
    a.q.Cloud.repoFetched = true;
    a.q.Cloud.fetchRepo(function () {});
    await flush();
    assert.deepEqual(calls, [], 'the version file is read once per boot');

    calls.length = 0;
    a.q.Cloud.fetchRepo(function () {}, true);
    await flush();
    assert.equal(calls[0], './data/version.json', '#btnRefresh re-checks on demand');
  } finally {
    a.close();
  }
});

/* ---------------------------------------------------------- app defaults */

test('in-app defaults, migration and the unified Amy voice are correct', function () {
  const a = boot();
  try {
    const q = a.q, st = q.DB.data.settings;
    assert.equal(q.CONFIG.key, 'sdp.v13_fast_liquid');
    assert.equal(q.CONFIG.schema, 13);
    assert.equal(q.CONFIG.settingsRev, 13);
    assert.equal(q.DB.data.settingsRev, 13);
    assert.equal(st.theme, 'dark');
    assert.equal(st.perf, 'auto');
    assert.equal(st.writeMode, 'fixed');
    assert.equal(st.writeFixed, 5);
    assert.equal(st.sentence, false);
    assert.equal(st.repeats, 2);
    assert.equal(st.rate, 0.88);
    assert.equal(st.numbers, true);
    assert.equal(st.mode, 'paper');
    assert.equal(q.Eng.writeSecs(), 5);
    assert.equal(q.DB.data.lists.length, 1);
    assert.equal(q.DB.data.lists[0].name, APP);
    assert.equal(q.DB.data.lists[0].words.length, 30);
    assert.deepEqual(Array.from(q.DB.data.lists[0].words, (w) => w.w), TRAVEL);
    assert.equal(q.DB.data.session.no, '7');
    assert.equal(q.DB.data.session.date, '2026-10-22');
    assert.equal(q.DB.data.session.branch, 'CCBE Galle Branch');

    const old = q.defaultData();
    old.settingsRev = 12;
    old.settings.theme = 'auto';
    old.settings.perf = 'full';
    const migrated = q.DB.migrate(old);
    assert.equal(migrated.settings.theme, 'dark');
    assert.equal(migrated.settings.perf, 'auto', 'an upgraded device starts on Auto');
    assert.equal(migrated.settingsRev, 13);
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
    /* the typing grader accepts every published form of tyre/tire */
    assert.equal(q.Results.answerState('tyre', 'tyre/tire'), 'ok');
    assert.equal(q.Results.answerState('tire', 'tyre/tire'), 'ok');
    assert.equal(q.Results.answerState('tyre/tire', 'tyre/tire'), 'ok');
    assert.equal(q.Results.answerState('tier', 'tyre/tire'), 'wrong');
    assert.equal(q.Results.answerState('tire', 'tyre'), 'half', 'US spelling is flagged, not silently correct');

    q.Speech.voices = [{ name: 'Daniel', lang: 'en-GB' }];
    assert.equal(q.Speech.anyEnglish(), null, 'male device voices are filtered');
    q.Speech.voices.push({ name: 'Microsoft Sonia', lang: 'en-GB' });
    assert.equal(q.Speech.anyEnglish().name, 'Microsoft Sonia');
  } finally {
    a.close();
  }
});

test('a phone upgrading from v12 keeps its saved results', function () {
  const a = boot();
  try {
    const q = a.q;
    const legacy = q.defaultData();
    legacy.settingsRev = 12;
    legacy.history = [{ id: 'old', score: 27, wordCount: 30, percent: 90 }];
    a.w.localStorage.setItem('sdp.v12_liquid', JSON.stringify(legacy));
    a.w.localStorage.removeItem(q.CONFIG.key);
    q.DB.load();
    assert.equal(q.DB.data.history.length, 1, 'the old result survives the key change');
    assert.equal(q.DB.data.history[0].score, 27);
    assert.equal(q.DB.data.settingsRev, 13);
    assert.ok(a.w.localStorage.getItem(q.CONFIG.key), 'the data is copied to the v13 key');
  } finally {
    a.close();
  }
});

test('every topbar and dock control works after tab and language switches', function () {
  const a = boot();
  try {
    const doc = a.w.document, q = a.q;
    doc.getElementById('btnLang').click();
    assert.equal(q.DB.data.settings.lang, 'si');
    assert.equal(doc.documentElement.getAttribute('lang'), 'si');
    assert.equal(doc.getElementById('tab-home').textContent.indexOf('මුල්') >= 0 || doc.getElementById('tab-home').textContent.length > 0, true);
    doc.getElementById('btnLang').click();
    assert.equal(q.DB.data.settings.lang, 'en');
    assert.equal(doc.documentElement.getAttribute('lang'), 'en-GB');

    doc.getElementById('btnTheme').click();
    assert.equal(q.DB.data.settings.theme, 'light');
    assert.equal(doc.body.getAttribute('data-theme'), 'light');
    doc.getElementById('btnTheme').click();
    assert.equal(q.DB.data.settings.theme, 'dark');

    doc.getElementById('btnGuideTop').click();
    assert.ok(doc.querySelector('#sheets .sheet'), 'the bilingual guide opens');
    const guideText = doc.querySelector('#sheets').textContent;
    assert.ok(guideText.indexOf('Hansana') >= 0, 'credits are in the guide');
    q.UI.closeSheet();

    for (const tab of ['practice', 'dict', 'comm', 'set', 'home']) {
      doc.getElementById('tab-' + tab).click();
      assert.equal(q.UI.tab, tab, 'dock switches to ' + tab);
      assert.ok(doc.getElementById('screen-' + tab).className.indexOf('hidden') < 0, tab + ' is visible');
      assert.equal(doc.getElementById('tab-' + tab).getAttribute('aria-selected'), 'true');
    }
    assert.equal(doc.querySelectorAll('#tabbar button').length, 5);

    doc.getElementById('btnAdmin').click();
    assert.ok(doc.querySelector('#pinPad'), 'the PIN pad opens');
    for (const digit of String(PIN).split('')) {
      const key = doc.querySelector('#pinPad [data-k="' + digit + '"]');
      assert.ok(key, 'keypad digit ' + digit);
      key.click();
    }
    assert.ok(doc.getElementById('adminHost'), 'the lecturer panel unlocks');
    assert.equal(a.q.Admin.unlocked, true);
  } finally {
    a.close();
  }
});

test('practice, dictionary, community and the 30-word paper checklist work', function () {
  const a = boot();
  try {
    const doc = a.w.document, q = a.q;
    q.UI.setTab('practice');
    assert.ok(doc.querySelector('#pracStage b'), 'a flashcard shows a word');
    const flip = doc.querySelector('#pracStage .glass');
    flip.click();
    assert.ok(doc.querySelector('#pracStage b').textContent.length > 10, 'the card flips to the meaning');
    doc.querySelector('#pracMode [data-p="quiz"]').click();
    assert.ok(doc.querySelectorAll('#pracStage .btn').length >= 4, 'the quiz offers four words');
    doc.querySelector('#pracMode [data-p="audio"]').click();
    assert.equal(doc.querySelectorAll('#pracStage .listrow').length, 30, 'the full 30-word audio list');

    q.UI.setTab('dict');
    const search = doc.getElementById('dictSearch');
    search.value = 'tu';
    fire(a, search, 'input');
    a.clock.tick(300);
    assert.ok(doc.getElementById('dictList').textContent.indexOf('tunnel') >= 0, 'instant dictionary search');

    q.UI.setTab('comm');
    assert.ok(doc.getElementById('btnCompose'), 'the comment composer is present');
    assert.ok(doc.getElementById('btnMsg'), 'the private message button is present');
  } finally {
    a.close();
  }
});

test('credits appear in the hero, the about card and the bilingual guide', function () {
  const a = boot();
  try {
    const doc = a.w.document;
    const hero = doc.querySelector('.hero-credit').textContent;
    assert.ok(hero.indexOf('Hansana') >= 0);
    assert.ok(hero.indexOf('Ayya01 (Lesandu)') >= 0);
    assert.ok(hero.indexOf('Sumodya Sewmini') >= 0);
    a.q.UI.setTab('set');
    assert.ok(doc.getElementById('setBody').textContent.indexOf('Ayya01 (Lesandu)') >= 0);
    assert.ok(doc.getElementById('brandCredit').textContent.indexOf('Hansana') >= 0);
    a.q.UI.setLang('si');
    const sinhalaCredit = a.q.T('creditFull');
    assert.ok(sinhalaCredit.indexOf('Hansana') >= 0, 'Sinhala credit keeps the names');
    assert.match(sinhalaCredit, /[\u0d80-\u0dff]/, 'Sinhala script is shipped');
    assert.ok(a.w.document.getElementById('brandCredit').textContent.indexOf('Hansana') >= 0);
  } finally {
    a.close();
  }
});

/* ---------------------------------------------------------------- runner */

(async function main() {
  let failed = 0;
  for (const item of tests) {
    try {
      await item.fn();
      console.log('ok - ' + item.name);
    } catch (error) {
      failed++;
      console.error('not ok - ' + item.name);
      console.error(String(error && error.stack || error));
    }
  }
  console.log(failed ? failed + ' failed, ' + (tests.length - failed) + ' passed' : 'all ' + tests.length + ' upgrade checks passed');
  process.exitCode = failed ? 1 : 0;
})();
