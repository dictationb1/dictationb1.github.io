/* Smart Dictation Player 2.2.0 (schema 14) release verification.
   This file is regenerated as a complete suite; it never patches app source. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const json = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const version = json('version.json');
const config = json('config.json');
const session = json('session.json');
const PIN = require('./test-pin.cjs');

const TITLE = 'Session 7 - Travel & Transport';
const LIST_ID = 'list_session_7_travel';
const WORDS = [
  'guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration',
  'journey', 'luggage', 'machine', 'mechanic', 'nationality', 'on business',
  'on vacation', 'overnight', 'passenger', 'public transport', 'reception',
  'reservation', 'road sign', 'signpost', 'spaceship', 'suitcase',
  'tourist information centre', 'traffic lights', 'tunnel', 'tyre/tire',
  'vehicle', 'visa', 'waiting room', 'windscreen'
];
const CREDIT = 'Created by Hansana · Idea given by Ayya01 (Lesandu) · Lecturer in Charge: Sumodya Sewmini';
const tests = [];

function test(name, fn) { tests.push({ name, fn }); }
function boot() { return harness(); }
function fire(a, el, type) {
  el.dispatchEvent(new a.w.Event(type, { bubbles: true, cancelable: true }));
}
function slide(a, id, value) {
  const el = a.w.document.getElementById(id);
  assert.ok(el, '#' + id + ' exists');
  el.value = String(value);
  fire(a, el, 'input');
  return el;
}
function device(a, options) {
  const p = options || {};
  if (p.width) Object.defineProperty(a.w, 'innerWidth', { value: p.width, configurable: true });
  if (p.cores) Object.defineProperty(a.w.navigator, 'hardwareConcurrency', { value: p.cores, configurable: true });
  if (p.memory) Object.defineProperty(a.w.navigator, 'deviceMemory', { value: p.memory, configurable: true });
  if (p.saveData) Object.defineProperty(a.w.navigator, 'connection', { value: { saveData: true, effectiveType: '3g' }, configurable: true });
  a.w.matchMedia = (query) => ({
    matches: (p.media || []).some((part) => query.indexOf(part) >= 0),
    addEventListener() {}
  });
  return a;
}
function flush() { return new Promise((resolve) => setImmediate(resolve)); }
function has(token, label) { assert.ok(html.indexOf(token) >= 0, label || token); }

/* ---------------------------------------------------------- release data */

test('v14 / 2.2.0 metadata and automatic performance defaults are consistent', function () {
  for (const data of [version, config, session]) assert.ok(Number(data.ver) >= 14, 'ver >= 14');
  assert.equal(version.appVersion, '2.2.0');
  assert.equal(version.version, '2.2.0');
  assert.equal(version.settingsRev, 14);
  assert.equal(version.session, '7');
  assert.equal(version.title, TITLE);
  assert.equal(version.updatedAt, '2026-10-23T00:00:00Z');
  assert.equal(config.appVersion, '2.2.0');
  assert.equal(config.version, '2.2.0');
  assert.equal(config.settingsRev, 14);
  assert.equal(config.listId, LIST_ID);
  assert.deepEqual(config.session, {
    no: '7', day: 'Thursday', date: '2026-10-22', title: TITLE,
    listId: LIST_ID, branch: 'CCBE Galle Branch',
    display: 'SESSION 7 · 22/10/2026 · CCBE GALLE BRANCH'
  });
  assert.equal(config.defaults.perf, 'auto');
  assert.equal(config.defaults.theme, 'dark');
  assert.equal(config.defaults.writeMode, 'fixed');
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.sentence, false);
  assert.equal(config.defaults.glassTint, 0);
  assert.equal(config.performance.probeMs, 1200);
  assert.equal(config.performance.medianBudgetMs, 19);
  assert.equal(config.dataSaving.preload, 'none');
  assert.equal(config.dataSaving.audioReuse, true);
  assert.match(config.tts.primary, /Amy/);
  assert.equal(config.credits.en, CREDIT);
  has('APP_VERSION = "2.2.0"');
  has('key: "sdp.v14_liquid"');
  has('schema: 14');
  has('settingsRev: 14');
});

test('Session 7 retains the exact 30-word Travel & Transport assignment', function () {
  assert.equal(session.appVersion, '2.2.0');
  assert.equal(session.session.no, '7');
  assert.equal(session.session.date, '2026-10-22');
  assert.equal(session.session.branch, 'CCBE Galle Branch');
  assert.equal(session.lists.length, 1);
  const list = session.lists[0];
  assert.equal(list.id, LIST_ID);
  assert.equal(list.name, TITLE);
  assert.equal(list.words.length, 30);
  assert.deepEqual(list.words.map((word) => word.w), WORDS);
  for (const word of list.words) {
    assert.ok(word.m.length > 8, word.w + ' definition');
    assert.ok(word.s.length > 15, word.w + ' example');
    assert.match(word.audio, /^https:\/\/.+\.mp3$/, word.w + ' UK MP3');
    has(word.w, 'embedded word ' + word.w);
  }
  has('SAMPLE_LIST_ID = "list_session_7_travel"');
});

/* ------------------------------------------------------ static UI contract */

test('the floating Hansana badge, sheen, ping and liquid tint engine are shipped', function () {
  const required = [
    'id="credit"', 'class="credit glass"', 'credits goes to', '<b>Hansana</b>',
    'creditLoop', 'UI.initCreditBadge', 'initCreditBadge();', '@keyframes sheen',
    '@keyframes ping', '.credit.in .ring', '.credit::after', '.credit.snap',
    '💧 Created by Hansana · Idea given by Ayya01 (Lesandu) · Lecturer in Charge: Sumodya Sewmini',
    '.seg-tint', '.seg-ind', 'tint-clear', 'tint-frost', 'tint-smoke', 'setTint',
    'data-tint="0"', 'data-tint="1"', 'data-tint="2"', 'tint-morph',
    '.stripes', '.disc', 'id="orb"', 'id="sBlur"', '--gb', '--fill',
    'radial-gradient(circle, var(--blob-color) 0%, transparent 70%)',
    '#grain { display: none !important; }', 'body[data-perf="lite"] { --gb: 8px; --gs: 1.35; --gbr: 1.02; }'
  ];
  for (const token of required) has(token);
  assert.equal((html.match(/id="credit"/g) || []).length, 1);
  assert.equal((html.match(/id="sdpAudio"/g) || []).length, 1);
  assert.equal(html.indexOf('filter: blur(85px)'), -1);
  assert.equal(html.indexOf('contain: content'), -1);
  assert.equal(html.indexOf('contain: paint'), -1);
  assert.doesNotMatch(html, /<link[\s>]/i, 'zero external link tags');
  assert.doesNotMatch(html, /fonts\.googleapis|cdn\.jsdelivr|unpkg\.com/i);
  has('preload="none"');
  has('voice=Amy');
  has('translate.google.com/translate_tts');
  has('tl=en-GB');
});

test('glass and badge transitions remain enabled in both performance modes', function () {
  has('transition: background-color .48s cubic-bezier(.2, .9, .25, 1.35), box-shadow .48s cubic-bezier(.2, .9, .25, 1.35), -webkit-backdrop-filter .48s ease, backdrop-filter .48s ease, transform .45s cubic-bezier(.2, .9, .25, 1.35);');
  has('transition: transform .48s cubic-bezier(.2, .9, .25, 1.35), background .35s ease;');
  has('animation: sheen 3.6s ease-in-out 1.2s infinite;');
  has('animation: ping 1.3s ease-out .15s 1;');
  has('body.tint-frost .glass');
  has('body.tint-smoke .glass');
  has('body.tint-frost[data-perf] .glass');
  has('body.tint-smoke[data-perf] .glass');
  const liteRules = Array.from(html.matchAll(/body\[data-perf="lite"\][^{}]+\{[^{}]*\}/g), (m) => m[0]);
  assert.ok(liteRules.length >= 4, 'Lite rules exist');
  for (const rule of liteRules) {
    if (rule.indexOf('.credit') >= 0) assert.doesNotMatch(rule, /animation:\s*none|transition:\s*none/);
  }
  assert.doesNotMatch(html, /body\[data-perf="lite"\]\s+(?:#credit|\.credit)/);
  has('body[data-perf="lite"] .blob, body[data-perf="lite"] .bubble, body[data-perf="lite"] .chip-a, body[data-perf="lite"] .chip-b { animation: none !important; }');
  has('blur(var(--gb)) saturate(var(--gs)) brightness(var(--gbr))');
});

/* --------------------------------------------------------- automatic Lite */

test('Auto Lite covers small, touch, constrained and data-saver devices', function () {
  const scenarios = [
    [{ width: 390, cores: 8, memory: 8 }, 'lite', 'phone'],
    [{ width: 1280, cores: 8, memory: 8, media: ['(pointer: coarse)'] }, 'lite', 'touch'],
    [{ width: 1280, cores: 4, memory: 8 }, 'lite', 'CPU'],
    [{ width: 1280, cores: 8, memory: 4 }, 'lite', 'RAM'],
    [{ width: 1280, cores: 8, memory: 8, saveData: true }, 'lite', 'Data Saver'],
    [{ width: 1280, cores: 8, memory: 8, media: ['prefers-reduced-motion'] }, 'lite', 'reduced motion'],
    [{ width: 1280, cores: 8, memory: 8 }, 'full', 'strong desktop']
  ];
  for (const [prefs, expected, label] of scenarios) {
    const a = boot();
    try {
      device(a, prefs);
      assert.equal(a.q.UI.autoPerf(), expected, label);
    } finally { a.close(); }
  }
});

test('the single 1.2 second frame probe stops and downgrades above 19ms', function () {
  const a = boot();
  try {
    const ui = a.q.UI;
    assert.equal(ui.frameWatchStarted, true);
    let pending = null, requests = 0, cancelled = 0, calls = 0;
    a.w.requestAnimationFrame = function (cb) { requests++; pending = cb; return requests; };
    a.w.cancelAnimationFrame = function () { cancelled++; };
    ui.frameWatchStarted = false;
    ui.frameProbe(function () { calls++; });
    let now = 0;
    for (let i = 0; i < 120 && pending; i++) {
      const cb = pending;
      pending = null;
      now += 16.7;
      cb(now);
    }
    assert.equal(calls, 1);
    assert.equal(pending, null);
    assert.ok(cancelled >= 1);
    assert.ok(requests >= 60 && requests <= 80, 'one startup window: ' + requests);
    device(a, { width: 1280, cores: 8, memory: 8 });
    a.q.DB.data.settings.perf = 'auto';
    ui.autoDowngraded = false;
    ui.recordFrames([16, 16.6, 17, 16.2]);
    assert.equal(ui.perfMode, 'full');
    ui.recordFrames([42, 48, 55, 60]);
    assert.equal(ui.autoDowngraded, true);
    assert.equal(ui.perfMode, 'lite');
    assert.equal(a.w.document.body.getAttribute('data-perf'), 'lite');
  } finally { a.close(); }
});

test('manual Lite / Full switching retains the glass controls', function () {
  const a = boot();
  try {
    const doc = a.w.document, ui = a.q.UI;
    device(a, { width: 1280, cores: 8, memory: 8 });
    ui.setPerf('full');
    assert.equal(doc.body.getAttribute('data-perf'), 'full');
    doc.getElementById('btnPerf').click();
    assert.equal(a.q.DB.data.settings.perf, 'lite');
    assert.equal(doc.body.getAttribute('data-perf'), 'lite');
    assert.equal(doc.getElementById('btnPerf').textContent, '⚡ Lite');
    assert.ok(doc.getElementById('credit'));
    assert.ok(doc.querySelector('.seg-tint .seg-ind'));
    doc.getElementById('btnPerf').click();
    assert.equal(doc.body.getAttribute('data-perf'), 'full');
    doc.querySelector('#segPerf [data-perf="auto"]').click();
    assert.equal(a.q.DB.data.settings.perf, 'auto');
    assert.equal(a.q.DB.data.settingsRev, 14);
  } finally { a.close(); }
});

/* ---------------------------------------------------------- credit badge */

test('creditLoop enters, holds for 5200ms, exits and repeats with spring timing', function () {
  const a = boot();
  try {
    const credit = a.w.document.getElementById('credit');
    a.clock.tick(249);
    assert.ok(!credit.classList.contains('in'));
    a.clock.tick(1); // initial harness 100ms + 250ms = 350ms
    assert.ok(credit.classList.contains('in'));
    assert.ok(!credit.classList.contains('out'));
    a.clock.tick(5199);
    assert.ok(credit.classList.contains('in'));
    a.clock.tick(1);
    assert.ok(credit.classList.contains('out'));
    assert.ok(!credit.classList.contains('in'));
    a.clock.tick(899);
    assert.ok(credit.classList.contains('out'));
    a.clock.tick(1);
    assert.ok(!credit.classList.contains('out'));
    a.clock.tick(350);
    assert.ok(credit.classList.contains('in'), 'the loop enters again');
    assert.ok(!credit.classList.contains('snap'));
  } finally { a.close(); }
});

test('badge hover/touch pauses, leaving resumes, and clicking shows full credits', function () {
  const a = boot();
  try {
    const doc = a.w.document, credit = doc.getElementById('credit');
    a.clock.tick(250);
    fire(a, credit, 'mouseenter');
    a.clock.tick(12000);
    assert.ok(credit.classList.contains('in'), 'hover keeps the badge visible');
    fire(a, credit, 'mouseleave');
    a.clock.tick(350);
    assert.ok(credit.classList.contains('in'));
    fire(a, credit, 'pointerdown');
    credit.click();
    assert.ok(doc.getElementById('toasts').textContent.indexOf(CREDIT) >= 0);
    assert.ok(doc.getElementById('toasts').textContent.indexOf('💧') >= 0);
    a.clock.tick(7000);
    assert.ok(credit.classList.contains('in'), 'pointer inspection pauses the exit timer');
    fire(a, credit, 'mouseleave');
    a.clock.tick(350);
    assert.ok(credit.classList.contains('in'));
  } finally { a.close(); }
});

/* --------------------------------------------------------- tint and mixer */

test('setTint morphs without re-rendering, synchronises every pill and persists 0/1/2', function () {
  const a = boot();
  try {
    const doc = a.w.document, q = a.q;
    q.UI.setTab('set');
    const settingsContent = doc.getElementById('setBody').firstChild;
    q.UI.setTab('home');
    const hero = doc.getElementById('homeHero');
    const mixer = doc.getElementById('materialMixer');
    assert.equal(doc.querySelectorAll('.seg-tint').length, 2, 'Home and Settings pills');

    q.UI.setTint(1, true);
    assert.equal(doc.getElementById('homeHero'), hero, 'Home DOM is retained');
    assert.equal(doc.getElementById('materialMixer'), mixer);
    assert.equal(doc.getElementById('setBody').firstChild, settingsContent, 'Settings DOM is retained');
    assert.ok(doc.body.classList.contains('tint-frost'));
    assert.ok(!doc.body.classList.contains('tint-clear'));
    assert.ok(doc.body.classList.contains('tint-morph'));
    assert.equal(q.DB.data.settings.glassTint, 1);
    for (const ind of doc.querySelectorAll('.seg-tint .seg-ind')) assert.equal(ind.style.transform, 'translateX(100%)');
    for (const host of doc.querySelectorAll('.seg-tint')) {
      assert.equal(host.querySelector('[data-tint="1"]').classList.contains('active'), true);
      assert.equal(host.querySelector('[data-tint="1"]').getAttribute('aria-pressed'), 'true');
      assert.equal(host.querySelectorAll('button.active').length, 1);
    }
    a.clock.tick(419);
    assert.ok(doc.body.classList.contains('tint-morph'));
    a.clock.tick(1);
    assert.ok(!doc.body.classList.contains('tint-morph'));

    doc.querySelector('#setBody [data-tint="2"]').click();
    assert.ok(doc.body.classList.contains('tint-smoke'));
    assert.equal(q.DB.data.settings.glassTint, 2);
    q.DB.saveNow();
    q.DB.load();
    q.UI.setTint(q.DB.data.settings.glassTint, false);
    assert.ok(doc.body.classList.contains('tint-smoke'), 'saved tint restores');
    doc.querySelector('#segTint [data-tint="0"]').click();
    assert.ok(doc.body.classList.contains('tint-clear'));
    assert.equal(q.DB.data.settings.glassTint, 0);
  } finally { a.close(); }
});

test('Home and Settings range sliders update live --fill progress and survive renders', function () {
  const a = boot();
  try {
    const doc = a.w.document, q = a.q, st = q.DB.data.settings;
    device(a, { width: 1280, cores: 8, memory: 8 });
    const blur = slide(a, 'sBlur', 34);
    const sat = slide(a, 'sSat', 210);
    const brt = slide(a, 'sBrt', 110);
    assert.ok(Math.abs(parseFloat(blur.style.getPropertyValue('--fill')) - 83.3333) < 0.01);
    assert.equal(sat.style.getPropertyValue('--fill'), '68.75%');
    assert.equal(brt.style.getPropertyValue('--fill'), '50%');
    assert.equal(doc.documentElement.style.getPropertyValue('--gb'), '34px');
    assert.equal(doc.documentElement.style.getPropertyValue('--gs'), '2.10');
    assert.equal(doc.documentElement.style.getPropertyValue('--gbr'), '1.10');
    assert.equal(st.glassBlur, 34);
    assert.equal(st.glassSat, 210);
    assert.equal(st.glassBrt, 110);

    const oldMixer = doc.getElementById('materialMixer');
    const fresh = oldMixer.cloneNode(true);
    oldMixer.parentNode.replaceChild(fresh, oldMixer);
    q.Screens.home();
    slide(a, 'sBlur', 28);
    assert.equal(doc.documentElement.style.getPropertyValue('--gb'), '28px');
    assert.equal(doc.getElementById('outBlur').textContent, '28px');

    q.UI.setTab('set');
    const settingsRanges = doc.querySelectorAll('#setBody .ctl input[type="range"]');
    assert.equal(settingsRanges.length, 3);
    for (const input of settingsRanges) {
      assert.ok(input.style.getPropertyValue('--fill').endsWith('%'));
      input.value = input.max;
      fire(a, input, 'input');
      assert.equal(input.style.getPropertyValue('--fill'), '100%');
    }
    q.UI.setLang('si');
    q.UI.setLang('en');
    q.UI.setTab('home');
    doc.querySelector('#segTint [data-tint="1"]').click();
    assert.ok(doc.body.classList.contains('tint-frost'));
  } finally { a.close(); }
});

test('the draggable orb and fine-pointer dock remain bound', function () {
  const a = boot();
  try {
    const doc = a.w.document, q = a.q;
    device(a, { width: 1280, cores: 8, memory: 8, media: ['(hover: hover) and (pointer: fine)'] });
    q.UI.setPerf('full');
    const stage = doc.getElementById('lgStage'), orb = doc.getElementById('orb');
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 420 });
    Object.defineProperty(orb, 'offsetWidth', { configurable: true, value: 140 });
    Object.defineProperty(orb, 'offsetHeight', { configurable: true, value: 140 });
    orb.getBoundingClientRect = () => ({ left: parseFloat(orb.style.left) || 0, top: parseFloat(orb.style.top) || 0, width: 140, height: 140 });
    orb.style.left = '180px'; orb.style.top = '60px';
    function pointer(type, x, y) {
      const event = new a.w.Event(type, { bubbles: true, cancelable: true });
      event.pointerId = 1; event.clientX = x; event.clientY = y;
      orb.dispatchEvent(event);
    }
    pointer('pointerdown', 220, 100);
    pointer('pointermove', 280, 150);
    pointer('pointerup', 280, 150);
    assert.equal(orb.style.left, '240px');
    assert.equal(orb.style.top, '110px');
    orb.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    assert.equal(orb.style.left, '252px');

    const dock = doc.getElementById('tabbar');
    const buttons = Array.from(dock.querySelectorAll('button'));
    buttons.forEach((button, i) => { button.getBoundingClientRect = () => ({ left: i * 90, width: 88 }); });
    const move = new a.w.Event('pointermove', { bubbles: true });
    move.pointerType = 'mouse'; move.clientX = 44;
    dock.dispatchEvent(move);
    a.clock.tick(40);
    assert.match(buttons[0].style.transform, /scale\(1\.280\)/);
    const touch = new a.w.Event('pointermove', { bubbles: true });
    touch.pointerType = 'touch'; touch.clientX = 44;
    dock.dispatchEvent(touch);
    assert.equal(buttons[0].style.transform, '');
  } finally { a.close(); }
});

/* ------------------------------------------------------------ low data */

test('DictAPI answers all Session 7 entries from memory with phon/pos/def/ex and zero fetches', function () {
  const a = boot();
  try {
    let fetches = 0;
    a.w.fetch = function () { fetches++; return Promise.reject(new Error('offline')); };
    assert.equal(a.q.DictAPI, a.q.Dict);
    for (const word of WORDS) {
      let result = null;
      const returned = a.q.DictAPI.lookup(word, (entry) => { result = entry; });
      assert.equal(returned, result, 'embedded lookup returns the entry');
      assert.ok(result && result.embedded, word);
      assert.ok(result.phon.length > 2, word + ' phon');
      assert.ok(result.pos.length > 2, word + ' pos');
      assert.ok(result.def.length > 8, word + ' def');
      assert.ok(result.ex.length > 15, word + ' ex');
      assert.equal(result.ipa, result.phon);
      assert.equal(result.meaning, result.def);
      assert.equal(result.example, result.ex);
    }
    assert.equal(fetches, 0);
    a.q.DictAPI.lookup('tyre', (entry) => assert.ok(entry && entry.def));
    a.q.DictAPI.lookup('tire', (entry) => assert.ok(entry && entry.def));
    assert.equal(fetches, 0, 'spelling alternatives are embedded too');
  } finally { a.close(); }
});

test('the shared audio element replays its buffer and keeps the Amy/en-GB failover', function () {
  const a = boot();
  try {
    const speech = a.q.Speech, audio = a.w.document.getElementById('sdpAudio');
    assert.equal(audio.getAttribute('preload'), 'none');
    const first = speech.streamSources('guidebook');
    assert.match(first[0], /voice=Amy/);
    assert.match(first[1], /tl=en-GB/);
    let srcSets = 0, plays = 0;
    Object.defineProperty(audio, 'canPlayType', { configurable: true, value: () => 'probably' });
    Object.defineProperty(audio, 'readyState', { configurable: true, get: () => 2 });
    Object.defineProperty(audio, 'src', { configurable: true, get: () => first[0], set: () => { srcSets++; } });
    audio.play = function () { plays++; return Promise.resolve(); };
    audio.pause = function () {};
    speech.playOnce(first[0], 0.88, 6000, function () {});
    assert.equal(srcSets, 0, 'same source is not reassigned');
    assert.equal(plays, 1);
    assert.equal(audio.currentTime, 0);
    speech.playOnce(speech.streamSources('harbour')[1], 0.88, 6000, function () {});
    assert.equal(srcSets, 1, 'a new word loads once');
    assert.equal(typeof speech.playSmartAudio, 'function');
    has('}, 3500);');
    speech.voices = [{ name: 'Daniel', lang: 'en-GB' }];
    assert.equal(speech.anyEnglish(), null, 'male fallback is forbidden');
    speech.voices.push({ name: 'Microsoft Sonia', lang: 'en-GB' });
    assert.equal(speech.anyEnglish().name, 'Microsoft Sonia');
  } finally { a.close(); }
});

test('repository sync reads version once and downloads session only for a newer ver', async function () {
  const a = boot();
  try {
    const calls = [];
    a.w.fetch = function (url) {
      const u = String(url); calls.push(u);
      if (u === './data/version.json') return Promise.resolve({ ok: true, json: () => Promise.resolve(version) });
      if (u === './data/session.json') return Promise.resolve({ ok: true, json: () => Promise.resolve(session) });
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    };
    a.q.DB.data.ver = 0;
    a.q.Cloud.repoFetched = false;
    a.q.Cloud.fetchRepo(function () {});
    await flush();
    assert.equal(calls[0], './data/version.json');
    assert.ok(calls.includes('./data/session.json'));
    assert.ok(!calls.some((u) => u.includes('?t=')));
    assert.ok(a.q.DB.data.ver >= 14);

    calls.length = 0;
    a.q.Cloud.repoFetched = false;
    a.q.Cloud.fetchRepo(function () {});
    await flush();
    assert.deepEqual(calls, ['./data/version.json']);

    calls.length = 0;
    a.q.Cloud.repoFetched = true;
    a.q.Cloud.fetchRepo(function () {});
    await flush();
    assert.deepEqual(calls, []);

    calls.length = 0;
    a.q.Cloud.fetchRepo(function () {}, true);
    await flush();
    assert.deepEqual(calls, ['./data/version.json'], 'forced refresh still avoids an equal-version session download');
  } finally { a.close(); }
});

/* ------------------------------------------------------- preserved app */

test('in-app Session 7 defaults, schema migration and Amy voice are correct', function () {
  const a = boot();
  try {
    const q = a.q, st = q.DB.data.settings;
    assert.equal(q.CONFIG.key, 'sdp.v14_liquid');
    assert.equal(q.CONFIG.schema, 14);
    assert.equal(q.CONFIG.settingsRev, 14);
    assert.equal(q.DB.data.settingsRev, 14);
    assert.equal(st.perf, 'auto');
    assert.equal(st.writeMode, 'fixed');
    assert.equal(st.writeFixed, 5);
    assert.equal(st.repeats, 2);
    assert.equal(st.sentence, false);
    assert.equal(st.glassTint, 0);
    assert.equal(q.Eng.writeSecs(), 5);
    assert.equal(q.DB.data.lists.length, 1);
    assert.deepEqual(Array.from(q.DB.data.lists[0].words, (word) => word.w), WORDS);
    assert.equal(q.Speech.streamSources('tourist information centre')[0],
      'https://api.streamelements.com/kappa/v2/speech?voice=Amy&text=tourist%20information%20centre');
    assert.equal(q.Results.answerState('tire', 'tyre/tire'), 'ok');
    assert.equal(q.Results.answerState('tier', 'tyre/tire'), 'wrong');

    const old = q.defaultData();
    old.settingsRev = 13;
    old.settings.glassTint = 'frost';
    const migrated = q.DB.migrate(old);
    assert.equal(migrated.settingsRev, 14);
    assert.equal(migrated.v, 14);
    assert.equal(migrated.settings.glassTint, 1);
  } finally { a.close(); }
});

test('upgrading v13/v12 storage preserves results and moves to the v14 key', function () {
  const a = boot();
  try {
    const q = a.q;
    const legacy = q.defaultData();
    legacy.settingsRev = 13;
    legacy.history = [{ id: 'old', score: 27, wordCount: 30, percent: 90 }];
    legacy.settings.glassTint = 'smoke';
    a.w.localStorage.setItem('sdp.v13_fast_liquid', JSON.stringify(legacy));
    a.w.localStorage.removeItem(q.CONFIG.key);
    q.DB.load();
    assert.equal(q.DB.data.history[0].score, 27);
    assert.equal(q.DB.data.settingsRev, 14);
    assert.equal(q.DB.data.settings.glassTint, 2);
    assert.ok(a.w.localStorage.getItem('sdp.v14_liquid'));
  } finally { a.close(); }
});

test('bilingual navigation, guide, practice, dictionary, community and Admin PIN 7898 work', function () {
  const a = boot();
  try {
    const doc = a.w.document, q = a.q;
    assert.equal(PIN, '7898');
    doc.getElementById('btnLang').click();
    assert.equal(q.DB.data.settings.lang, 'si');
    assert.equal(doc.documentElement.getAttribute('lang'), 'si');
    doc.getElementById('btnLang').click();
    assert.equal(q.DB.data.settings.lang, 'en');

    doc.getElementById('btnGuideTop').click();
    assert.ok(doc.querySelector('#sheets .sheet'));
    assert.ok(doc.querySelector('#sheets').textContent.includes(CREDIT));
    q.UI.closeSheet();

    q.UI.setTab('practice');
    assert.ok(doc.querySelector('#pracStage b'));
    doc.querySelector('#pracMode [data-p="quiz"]').click();
    assert.ok(doc.querySelectorAll('#pracStage .btn').length >= 4);
    doc.querySelector('#pracMode [data-p="audio"]').click();
    assert.equal(doc.querySelectorAll('#pracStage .listrow').length, 30);

    q.UI.setTab('dict');
    const search = doc.getElementById('dictSearch');
    search.value = 'tu'; fire(a, search, 'input'); a.clock.tick(300);
    assert.ok(doc.getElementById('dictList').textContent.includes('tunnel'));

    q.UI.setTab('comm');
    assert.ok(doc.getElementById('btnCompose'));
    assert.ok(doc.getElementById('btnMsg'));

    doc.getElementById('btnAdmin').click();
    for (const digit of PIN) doc.querySelector('#pinPad [data-k="' + digit + '"]').click();
    assert.equal(q.Admin.unlocked, true);
    assert.ok(doc.getElementById('adminHost'));
  } finally { a.close(); }
});

test('full credits remain in Hero, Welcome Guide and Settings About', function () {
  const a = boot();
  try {
    const doc = a.w.document;
    assert.ok(doc.querySelector('.hero-credit').textContent.includes(CREDIT));
    assert.ok(doc.getElementById('homeCredits').textContent.includes(CREDIT));
    a.q.UI.setTab('set');
    assert.ok(doc.getElementById('setBody').textContent.includes(CREDIT));
    a.q.UI.openWelcomeGuide();
    assert.ok(doc.querySelector('#sheets').textContent.includes(CREDIT));
    a.q.UI.setLang('si');
    assert.ok(a.q.T('creditFull').includes('Hansana'));
    assert.match(a.q.T('creditFull'), /[\u0d80-\u0dff]/);
  } finally { a.close(); }
});

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
