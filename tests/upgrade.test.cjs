/* Smart Dictation Player 3.1.0 (schema 23) release verification.
   Full-viewport living sumi swan plus every v22 dictation regression gate. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const json = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const version = json('version.json');
const config = json('config.json');
const session = json('session.json');
const TITLE = 'Session 7 - Travel & Transport';
const LIST_ID = 'list_session_7_travel';
const STORE_KEY = 'sdp.v23_sumi_swan';
const WORDS = [
  'guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration',
  'journey', 'luggage', 'machine', 'mechanic', 'nationality', 'on business',
  'on vacation', 'overnight', 'passenger', 'public transport', 'reception',
  'reservation', 'road sign', 'signpost', 'spaceship', 'suitcase',
  'tourist information centre', 'traffic lights', 'tunnel', 'tyre/tire',
  'vehicle', 'visa', 'waiting room', 'windscreen'
];
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function boot() { return harness(); }
function click(a, el) {
  assert.ok(el, 'button to click exists');
  el.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function has(token, label) { assert.ok(html.indexOf(token) >= 0, label || token); }
function lacks(token, label) { assert.equal(html.indexOf(token), -1, label || token); }
function cssText() { return html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>')); }
function rule(selector) {
  const css = cssText();
  let at = css.indexOf(selector);
  while (at >= 0 && !/^\s*\{/.test(css.slice(at + selector.length))) at = css.indexOf(selector, at + 1);
  assert.ok(at >= 0, 'CSS rule exists: ' + selector);
  const end = css.indexOf('}', at);
  return css.slice(at, end + 1);
}
function homeMarkup() {
  const start = html.indexOf('<section class="screen" id="screen-home"');
  return html.slice(start, html.indexOf('</section>', start));
}
function appScript() {
  const found = html.match(/<script>([\s\S]*?)<\/script>/g);
  return found[found.length - 1].slice(8, -9);
}
function typeBoot(a) {
  a.q.DB.data.settings.mode = 'type';
  a.q.Eng.start({});
  a.clock.tick(50);
  return a.w.document;
}
function startPlaying(a) {
  const doc = typeBoot(a);
  const skip = Array.from(doc.querySelectorAll('#sheets button')).find((b) => b.textContent.trim() === 'Skip countdown');
  assert.ok(skip, 'the ready sheet offers Skip countdown');
  click(a, skip);
  a.clock.tick(4000);
  assert.ok(doc.getElementById('ansInput'), 'the native typing input is rendered');
  return doc;
}
function typeChar(a, inp, ch) {
  inp.value = ' ' + ch;
  inp.dispatchEvent(new a.w.Event('input', { bubbles: true }));
}
function inputEvent(a, inp, inputType) {
  const ev = new a.w.Event('input', { bubbles: true, cancelable: true });
  if (inputType) ev.inputType = inputType;
  inp.dispatchEvent(ev);
  return ev;
}
function primaryTourButton(doc) {
  const button = doc.querySelector('#sheets .sfoot .btn.primary');
  assert.ok(button, 'the tour primary action exists');
  return button;
}

/* Release integrity and v23 metadata. */
test('single-file budget, strict ES5 and zero external assets', function () {
  const bytes = Buffer.byteLength(html);
  assert.ok(bytes < 442000, 'index.html stays under 442,000 bytes (now ' + bytes + ')');
  const script = appScript();
  acorn.parse(script, { ecmaVersion: 5 });
  assert.equal(/<link\b/i.test(html), false, 'no <link> tags');
  assert.equal(/@import/i.test(html), false, 'no CSS imports');
  assert.equal(/<script[^>]+src=/i.test(html), false, 'no external scripts');
  assert.equal(script.indexOf('=>'), -1, 'no arrow functions');
  assert.equal(script.indexOf(String.fromCharCode(96)), -1, 'no template literals');
  assert.equal(/\basync\s+function/.test(script), false, 'no async functions');
  assert.equal(/\bawait\s/.test(script), false, 'no await');
  assert.equal(/\bconst\s/.test(script), false, 'no const declarations');
  assert.equal(/\blet\s/.test(script), false, 'no let declarations');
});

test('v23 / 3.1.0 metadata, storage migration and paper default are consistent', function () {
  for (const data of [version, config, session]) {
    assert.ok(Number(data.ver) >= 23, 'ver >= 23');
    assert.equal(data.appVersion, '3.1.0');
    assert.equal(data.version, '3.1.0');
    assert.equal(data.settingsRev, 23);
    assert.equal(data.mode, 'paper');
  }
  assert.equal(version.version, '3.1.0');
  assert.equal(config.version, '3.1.0');
  assert.equal(session.version, '3.1.0');
  assert.equal(session.ver, 23);
  assert.equal(version.session, '7');
  assert.equal(version.title, TITLE);
  assert.equal(config.listId, LIST_ID);
  assert.equal(config.storageKey, STORE_KEY);
  has('var APP_VERSION="3.1.0"');
  has('key:"sdp.v23_sumi_swan"');
  has('schema:23');
  has('settingsRev:23');
  has('"sdp.v22_paper_default","sdp.v21_guide_start","sdp.v20_nopass"');
  const a = boot();
  try {
    assert.equal(a.q.CONFIG.key, STORE_KEY);
    assert.equal(a.q.CONFIG.schema, 23);
    assert.equal(a.q.CONFIG.settingsRev, 23);
    assert.equal(a.q.DB.data.v, 23);
    assert.equal(a.q.DB.data.settingsRev, 23);
    assert.equal(a.q.DB.data.settings.mode, 'paper');
    assert.ok(a.w.localStorage.getItem(STORE_KEY), 'the v23 store is written');
    const old = JSON.parse(JSON.stringify(a.q.DB.data));
    old.settings.mode = 'type'; old.settingsRev = 22; old.v = 22;
    const migrated = a.q.DB.migrate(old);
    assert.equal(migrated.settings.mode, 'paper', 'v23 migration preserves paper as the default');
    assert.equal(migrated.settingsRev, 23);
    assert.equal(migrated.v, 23);
  } finally { a.close(); }
});

test('Session 7 keeps all 30 words, 5s timer, 2 repeats and unified Amy en-GB audio', function () {
  const words = session.lists[0].words.map((w) => w.w);
  assert.equal(words.length, 30, 'exactly 30 words');
  for (const word of WORDS) assert.ok(words.indexOf(word) >= 0, 'word present: ' + word);
  assert.equal(session.lists[0].id, LIST_ID);
  assert.equal(session.session.title, TITLE);
  assert.equal(config.defaults.writeMode, 'fixed');
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.match(config.tts.primary, /Amy/);
  assert.match(config.tts.primary, /en-GB/);
  assert.equal(config.dataSaving.audioReuse, true);
  assert.equal(config.dataSaving.dictionaryFromMemory, true);
  has('writeFixed:5'); has('repeats:2'); has('voice=Amy');
  has('British Female Professor Voice (Amy \u00b7 en-GB)');
  const a = boot();
  try {
    assert.equal(a.q.DB.data.settings.writeFixed, 5);
    assert.equal(a.q.DB.data.settings.repeats, 2);
    assert.equal(a.q.DB.data.lists[0].words.length, 30);
    assert.equal(a.q.SAMPLE_WORDS.length, 30);
  } finally { a.close(); }
});

test('default answer mode is Listen & write on paper', function () {
  has('data-mode="paper" aria-selected="true"');
  has('Listen &amp; write on paper');
  has('data-mode="type" aria-selected="false"');
  has('mode:"paper"');
  const segStart = html.indexOf('id="segMode"');
  assert.ok(segStart >= 0);
  assert.ok(html.slice(segStart, segStart + 800).includes('data-mode="paper" aria-selected="true"'));
  assert.equal(config.defaults.mode, 'paper');
  const a = boot();
  try { assert.equal(a.q.DB.data.settings.mode, 'paper'); } finally { a.close(); }
});

/* Full-viewport SwanStage static and runtime gates. */
test('SwanStage is an edge-to-edge 100vw x 100vh stage with one unbroken 1920 x 1080 spline', function () {
  has('id="swan-stage-wrap"'); has('id="swan-ink-canvas"'); has('id="swan-vector-stage"');
  has('viewBox="0 0 1920 1080"'); has('preserveAspectRatio="xMidYMid slice"');
  has('id="swanMasterPath"'); has('一筆白鳥 · Hansana'); has('墨');
  has('window.SwanStage='); has('DURATION=12000'); has('Math.min(window.devicePixelRatio||1,2)');
  has('function ribbon('); has('destination-out'); has('createRadialGradient'); has('0.00018');
  for (const token of ['[1,0,1800,380,680', '[2,1800,3200,620,410', '[3,3360,4080,510,340',
    '[4,6200,7000,940,740', '[5,7180,7980,1460,390', '[6,11500,12000,420,790']) has(token);
  assert.equal(/\.(?:easel|paper)\b/i.test(cssText()), false, 'no easel or paper CSS box');
  const a = boot();
  try {
    const doc = a.w.document;
    const wrap = doc.getElementById('swan-stage-wrap');
    const canvas = doc.getElementById('swan-ink-canvas');
    const svg = doc.getElementById('swan-vector-stage');
    assert.equal(wrap.parentNode, doc.body, 'stage mounts directly inside body');
    assert.equal(canvas.parentNode, wrap); assert.equal(svg.parentNode, wrap);
    const style = a.w.getComputedStyle(wrap);
    assert.equal(style.position, 'fixed'); assert.equal(style.width, '100vw'); assert.equal(style.height, '100vh');
    assert.equal(style.pointerEvents, 'none'); assert.equal(style.zIndex, '0'); assert.equal(style.overflow, 'hidden');
    const canvasStyle = a.w.getComputedStyle(canvas);
    assert.equal(canvasStyle.position, 'absolute'); assert.equal(canvasStyle.width, '100vw'); assert.equal(canvasStyle.height, '100vh');
    const master = doc.getElementById('swanMasterPath');
    assert.equal((master.getAttribute('d').match(/M/g) || []).length, 1, 'single continuous Move command');
    assert.ok((master.getAttribute('d').match(/C/g) || []).length >= 14, 'all cubic stages are present');
    assert.equal(doc.querySelector('.easel,.paper'), null);
    assert.equal(doc.getElementById('swan-cinnabar-seal').textContent, '墨');
  } finally { a.close(); }
});

test('variable-pressure canvas renderer completes 12 seconds then draws pulses, ripples and feathers', function () {
  const calls = { fill: 0, stroke: 0, ellipse: 0, clearRect: 0 };
  const gradient = { addColorStop: function () {} };
  const context = new Proxy({
    createRadialGradient: function () { return gradient; },
    createLinearGradient: function () { return gradient; }
  }, {
    get: function (target, key) {
      if (key in target) return target[key];
      if (typeof key === 'string') {
        target[key] = function () { if (key in calls) calls[key]++; };
        return target[key];
      }
      return undefined;
    },
    set: function (target, key, value) { target[key] = value; return true; }
  });
  const a = harness(null, { canvasContext: context });
  try {
    const canvas = a.w.document.getElementById('swan-ink-canvas');
    assert.ok(canvas.width > 0 && canvas.height > 0, 'high-DPI canvas is sized to the viewport');
    a.clock.tick(12100);
    assert.ok(calls.clearRect > 20, 'choreography repaints continuously');
    assert.ok(calls.fill > 100, 'variable ribbon, halo and brush tip are filled');
    assert.ok(calls.stroke > 20, 'specular rim and living pulse stream are stroked');
    a.w.document.dispatchEvent(new a.w.MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 400 }));
    a.w.SwanStage.pulseAudio(); a.w.SwanStage.celebrateStreak(5); a.clock.tick(500);
    assert.ok(calls.ellipse > 0, 'pointer and audio wake render concentric ellipses');
  } finally { a.close(); }
});

test('window.SwanStage exposes all five APIs and Replay Ink restarts art without interrupting dictation', function () {
  const a = boot();
  try {
    const swan = a.w.SwanStage;
    assert.ok(swan, 'global controller exists');
    for (const name of ['init', 'replay', 'pulseAudio', 'celebrateStreak', 'syncTheme']) assert.equal(typeof swan[name], 'function', name);
    const doc = typeBoot(a);
    const button = doc.getElementById('btnSwanReplay');
    assert.ok(button); assert.match(button.textContent, /🦢 Replay Ink/);
    assert.ok(button.closest('.topbar.glass'));
    let replays = 0;
    swan.replay = function () { replays++; };
    click(a, button);
    assert.equal(replays, 1, 'one tap replays the 12-second painting');
    assert.equal(a.q.Eng.st, 'ready', 'dictation state is untouched');
    assert.equal(doc.querySelectorAll('#layers .layer').length, 1, 'player remains open');
    swan.init(); swan.pulseAudio(); swan.celebrateStreak(3);
  } finally { a.close(); }
});

test('theme sync selects midnight liquid glass or warm kraft sumi palettes', function () {
  has('#0a0f1e'); has('#53c7f0'); has('#e6c47f'); has('#ead7ae'); has('#111827');
  has('SwanStage.syncTheme(mode');
  const a = boot();
  try {
    const wrap = a.w.document.getElementById('swan-stage-wrap');
    a.q.DB.data.settings.theme = 'light'; a.q.UI.applyTheme();
    assert.equal(wrap.getAttribute('data-swan-theme'), 'light');
    const lightColour = wrap.style.backgroundColor;
    assert.ok(lightColour, 'warm kraft background colour is applied');
    a.q.DB.data.settings.theme = 'dark'; a.q.UI.applyTheme();
    assert.equal(wrap.getAttribute('data-swan-theme'), 'dark');
    assert.ok(wrap.style.backgroundColor, 'midnight background colour is applied');
    assert.notEqual(wrap.style.backgroundColor, lightColour);
    a.w.SwanStage.syncTheme('light', 'kraft');
    assert.equal(wrap.getAttribute('data-swan-theme'), 'light');
  } finally { a.close(); }
});

test('Speech.say and Speech.playSmartAudio automatically radiate SwanStage audio pulses', function () {
  has('SwanStage.pulseAudio()');
  const a = boot();
  try {
    let pulses = 0;
    a.w.SwanStage.pulseAudio = function () { pulses++; };
    a.q.Speech.say(['Hello Britain'], {}, function () {});
    assert.equal(pulses, 1, 'say pulses immediately when queued');
    a.q.Speech.playSmartAudio('Guidebook', 0.88, function () {});
    assert.equal(pulses, 2, 'smart audio inherits the same pulse hook');
  } finally { a.close(); }
});

/* Guide and tour auto-start flow. */
test('User Guide Start practising unlocks audio, closes the guide and launches Eng.start on Home', function () {
  has('UI.startPractisingFromGuide=function'); has('go.id="btnGuideStart"');
  has('UI.startPractisingFromGuide();'); has('Eng.start({})'); has('Speech.unlock();');
  const a = boot();
  try {
    const doc = a.w.document, order = [];
    const unlock = a.q.Speech.unlock, start = a.q.Eng.start;
    a.q.Speech.unlock = function () { order.push('unlock'); return unlock.apply(this, arguments); };
    a.q.Eng.start = function () { order.push('start'); return start.apply(this, arguments); };
    a.q.DB.data.tourSeen = false; a.q.DB.data.guideSeen = false; a.q.DB.saveNow();
    a.q.UI.openWelcomeGuide();
    const go = doc.getElementById('btnGuideStart');
    assert.ok(go); assert.equal(go.textContent.trim(), 'Start practising');
    assert.equal(go.className, 'btn primary xl block');
    assert.equal(go.querySelector('svg use').getAttribute('href'), '#i-play');
    click(a, go);
    assert.deepEqual(order, ['unlock', 'start']);
    assert.equal(a.q.UI.tab, 'home');
    assert.equal(doc.getElementById('screen-home').classList.contains('hidden'), false);
    assert.equal(a.q.Eng.st, 'ready'); assert.equal(a.q.Eng.words.length, 30);
    assert.equal(doc.querySelectorAll('#layers .layer').length, 1);
    assert.equal(doc.getElementById('btnGuideStart'), null);
    assert.match(doc.querySelector('#sheets .sheet').textContent, /Are you ready\?/);
    assert.equal(a.q.DB.data.tourSeen, true); assert.equal(a.q.DB.data.guideSeen, true);
    const saved = JSON.parse(a.w.localStorage.getItem(STORE_KEY));
    assert.equal(saved.tourSeen, true); assert.equal(saved.guideSeen, true);
  } finally { a.close(); }
});

test('Guide close never starts dictation; Sinhala CTA, Settings and first run stay wired', function () {
  const a = boot();
  try {
    const doc = a.w.document;
    a.q.UI.setLang('si'); a.q.UI.openWelcomeGuide();
    const go = doc.getElementById('btnGuideStart');
    assert.equal(go.textContent.trim(), 'පුහුණුව ආරම්භ කරන්න');
    click(a, doc.querySelector('#sheets .shead button'));
    assert.equal(doc.querySelectorAll('#sheets .sheet').length, 0);
    assert.equal(doc.querySelectorAll('#layers .layer').length, 0);
    assert.equal(a.q.Eng.st, 'idle'); assert.equal(a.q.DB.data.guideSeen, false);
    a.q.UI.setLang('en'); a.q.UI.setTab('set');
    const settingsGuide = Array.from(doc.querySelectorAll('#screen-set button')).find((b) => b.textContent.trim() === 'User Guide / උපදෙස්');
    assert.ok(settingsGuide); click(a, settingsGuide);
    assert.ok(doc.getElementById('btnGuideStart'));
    click(a, doc.querySelector('#sheets .shead button'));
    a.q.DB.data.tourSeen = false; a.q.firstRunTour();
    assert.ok(doc.getElementById('btnGuideStart'));
    click(a, doc.querySelector('#sheets .shead button'));
    assert.equal(a.q.Eng.st, 'idle');
  } finally { a.close(); }
});

test('classic runTour final Start practising card also launches Eng.start', function () {
  has('function runTour(){'); has('n===cards.length-1'); has('S.doneTour');
  const a = boot();
  try {
    const doc = a.w.document; a.q.UI.runTour();
    assert.match(doc.querySelector('#sheets .sheet').textContent, /\(1\/3\)/);
    assert.equal(primaryTourButton(doc).textContent.trim(), 'Next');
    click(a, primaryTourButton(doc)); a.clock.tick(130);
    assert.match(doc.querySelector('#sheets .sheet').textContent, /\(2\/3\)/);
    click(a, primaryTourButton(doc)); a.clock.tick(130);
    const go = doc.getElementById('btnGuideStart');
    assert.ok(go); assert.equal(go.textContent.trim(), 'Start practising'); click(a, go);
    assert.equal(a.q.UI.tab, 'home'); assert.equal(a.q.Eng.st, 'ready');
    assert.equal(doc.querySelectorAll('#layers .layer').length, 1);
    assert.match(doc.querySelector('#sheets .sheet').textContent, /Are you ready\?/);
    assert.equal(a.q.DB.data.tourSeen, true); assert.equal(a.q.DB.data.guideSeen, true);
  } finally { a.close(); }
});

/* Always-visible Hansana credit. */
test('#credit stays at z-index 9999 with showCreditNow throughout Guide, language and Tour', function () {
  const creditRule = rule('.credit');
  assert.match(creditRule, /z-index:9999\s*!important/);
  assert.match(creditRule, /position:fixed/); assert.match(creditRule, /pointer-events:auto/);
  has('id="credit"'); has('class="credit glass"'); has('z-index:9999 !important');
  has('UI.showCreditNow=function'); has('UI.showCreditNow()');
  const openGuideIdx = html.indexOf('openWelcomeGuide:function');
  const showIdx = html.indexOf('UI.showCreditNow', openGuideIdx);
  assert.ok(showIdx > openGuideIdx && showIdx - openGuideIdx < 500);
  const applyLangIdx = html.indexOf('applyLang:function');
  const showInLang = html.indexOf('UI.showCreditNow', applyLangIdx);
  assert.ok(showInLang > applyLangIdx && showInLang - applyLangIdx < 800);
  const runTourIdx = html.indexOf('function runTour');
  assert.ok(html.indexOf('UI.showCreditNow', runTourIdx) > runTourIdx);
  const startIdx = html.indexOf('UI.startPractisingFromGuide');
  const showInStart = html.indexOf('UI.showCreditNow', startIdx);
  assert.ok(showInStart > startIdx && showInStart - startIdx < 400);
  const a = boot();
  try {
    a.q.UI.openWelcomeGuide(); a.clock.tick(200);
    const credit = a.w.document.getElementById('credit');
    assert.ok(credit); assert.equal(a.w.getComputedStyle(credit).zIndex, '9999');
    assert.ok(credit.classList.contains('in'));
    a.q.UI.setLang('si'); a.clock.tick(200); assert.ok(credit.classList.contains('in'));
    a.q.UI.closeSheet(); a.q.UI.runTour(); a.clock.tick(100); assert.ok(credit.classList.contains('in'));
    click(a, primaryTourButton(a.w.document)); a.clock.tick(200); assert.ok(credit.classList.contains('in'));
  } finally { a.close(); }
});

test('guide-credit-pill with animated Hansana swan renders inside User Guide and Tour', function () {
  has('guide-credit-pill'); has('UI.guideCreditPill=function'); has('CREDITS GOES TO'); has('Hansana');
  const a = boot();
  try {
    a.q.UI.openWelcomeGuide();
    let sheet = a.w.document.querySelector('#sheets .sheet');
    let pill = sheet.querySelector('.guide-credit-pill');
    assert.ok(pill); assert.ok(pill.querySelector('.c-swan'));
    assert.match(pill.textContent, /Hansana/); assert.match(pill.textContent, /Ayya01/);
    assert.ok(pill.classList.contains('glass'));
    a.q.UI.setLang('si'); a.q.UI.closeSheet(); a.q.UI.openWelcomeGuide();
    sheet = a.w.document.querySelector('#sheets .sheet'); pill = sheet.querySelector('.guide-credit-pill');
    assert.match(pill.textContent, /Hansana/);
    assert.ok(/Sumodya|භාරකාර/.test(pill.textContent));
    a.q.UI.closeSheet(); a.q.UI.runTour();
    sheet = a.w.document.querySelector('#sheets .sheet'); assert.ok(sheet.querySelector('.guide-credit-pill'));
    click(a, primaryTourButton(a.w.document)); a.clock.tick(130);
    sheet = a.w.document.querySelector('#sheets .sheet'); assert.ok(sheet.querySelector('.guide-credit-pill'));
  } finally { a.close(); }
});

/* Ready sheet and native typing. */
test('ready sheet has two actions and cross, scrim and Escape all exit in one tap', function () {
  lacks('btnReadyClose'); lacks('btnNotReady'); lacks('Not ready'); lacks('ansVkb');
  has('Eng.cancelReadyAndExit=function');
  for (const how of ['cross', 'scrim', 'escape']) {
    const a = boot();
    try {
      const doc = typeBoot(a); assert.equal(a.q.Eng.st, 'ready');
      const exits = doc.querySelectorAll('#sheets .shead button');
      assert.equal(exits.length, 1); assert.equal(exits[0].getAttribute('aria-label'), 'Close');
      const actions = Array.from(doc.querySelectorAll('#sheets .sfoot button')).map((b) => b.textContent.trim());
      assert.deepEqual(actions, ["I'm ready", 'Skip countdown']);
      if (how === 'cross') click(a, exits[0]);
      else if (how === 'scrim') click(a, doc.querySelector('#sheets .scrim'));
      else doc.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      a.clock.tick(120);
      assert.equal(a.q.Eng.st, 'idle'); assert.equal(a.q.Eng.layer, null);
      assert.equal(doc.querySelectorAll('#sheets .sheet').length, 0);
      assert.equal(doc.querySelectorAll('#layers .layer').length, 0);
      assert.equal(doc.getElementById('screen-home').classList.contains('hidden'), false);
      assert.equal(a.q.DB.data.snapshot, undefined);
    } finally { a.close(); }
  }
});

test('native text input blocks password saves and suggestions; no custom keyboard exists', function () {
  for (const token of ['ansVkb', 'btnToggleVkb', 'btnVkbToggle', 'buildVkb', 'vkb-key', 'ans-vkb']) lacks(token);
  has('inp.type="text"'); has('inp.setAttribute("autocomplete","off")');
  has('Eng.syncInputMirror=function'); has('Eng.onTypeInputUpdate=function');
  has('id="ansMirror"'); has('id="ansMirrorText"');
  assert.equal(html.includes('new-password'), false); assert.equal(html.includes('current-password'), false);
  assert.equal(/inp\.type\s*=\s*"password"/.test(html), false);
  const inputCss = rule('#ansInput');
  assert.match(inputCss, /color:transparent\s*!important/);
  assert.match(inputCss, /-webkit-text-fill-color:transparent\s*!important/);
  assert.match(inputCss, /caret-color:transparent\s*!important/);
  assert.match(inputCss, /background:(?:transparent|0 0)\s*!important/);
  const a = boot();
  try {
    const doc = startPlaying(a), inp = doc.getElementById('ansInput');
    const expected = {
      autocomplete: 'off', inputmode: 'text', autocorrect: 'off', autocapitalize: 'none',
      spellcheck: 'false', 'aria-autocomplete': 'none', 'data-lpignore': 'true',
      'data-1p-ignore': 'true', 'data-bwignore': 'true', 'data-form-type': 'other', 'data-gramm': 'false'
    };
    assert.equal(inp.type, 'text');
    for (const key of Object.keys(expected)) assert.equal(inp.getAttribute(key), expected[key], key);
    assert.match(inp.name, /^sdp_field_\d{1,12}$/); assert.equal(inp.form, null);
    assert.equal(inp.hasAttribute('placeholder'), false); assert.equal(inp.value, ' ');
    assert.equal(inp.parentNode.id, 'ansWrap');
    assert.ok(doc.getElementById('ansMirror')); assert.ok(doc.getElementById('ansMirrorText'));
    assert.ok(doc.querySelector('#ansMirror .ans-caret'));
    assert.equal(doc.getElementById('ansVkb'), null); assert.equal(doc.getElementById('btnToggleVkb'), null);
  } finally { a.close(); }
});

test('single-space IME buffer, mirror, Backspace, deletion and captureAnswer stay in sync', function () {
  has('self.typedAnswer'); has('inp.value=" "'); has('insertReplacementText'); has('deleteContentBackward');
  has('this.answers[this.idx]=this.typedAnswer||""');
  const a = boot();
  try {
    const doc = startPlaying(a), inp = doc.getElementById('ansInput'), mirror = doc.getElementById('ansMirrorText');
    assert.match(mirror.textContent, /Type the word you hear/); assert.equal(mirror.className, 'ans-placeholder');
    let built = '';
    for (const ch of a.q.Eng.currentWord().w.slice(0, 3)) {
      built += ch; typeChar(a, inp, ch);
      assert.equal(inp.value, ' '); assert.equal(a.q.Eng.typedAnswer, built);
      assert.equal(mirror.textContent, built); assert.equal(a.q.Eng.answers[a.q.Eng.idx], built);
    }
    inp.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    assert.equal(a.q.Eng.typedAnswer, built.slice(0, -1));
    inp.value = ''; inputEvent(a, inp, 'deleteContentBackward');
    assert.equal(a.q.Eng.typedAnswer, built.slice(0, -2)); assert.equal(inp.value, ' ');
    inp.value = 'abc'; inputEvent(a, inp);
    assert.equal(a.q.Eng.typedAnswer, 'abc'); assert.equal(mirror.textContent, 'abc');
    a.q.Eng.captureAnswer(); assert.equal(a.q.Eng.answers[a.q.Eng.idx], 'abc');
  } finally { a.close(); }
});

test('replacement suggestions, paste and drop never enter typedAnswer', function () {
  const a = boot();
  try {
    const doc = startPlaying(a), inp = doc.getElementById('ansInput');
    typeChar(a, inp, 'g'); const before = a.q.Eng.typedAnswer;
    for (const kind of ['insertReplacementText', 'insertFromPaste', 'insertFromDrop']) {
      inp.value = ' guidebook'; inputEvent(a, inp, kind);
      assert.equal(a.q.Eng.typedAnswer, before, kind); assert.equal(inp.value, ' ');
      assert.match(doc.getElementById('ansFeedback').textContent, /blocked/);
    }
    const bi = new a.w.Event('beforeinput', { bubbles: true, cancelable: true });
    bi.inputType = 'insertReplacementText'; inp.dispatchEvent(bi); assert.equal(bi.defaultPrevented, true);
    for (const kind of ['paste', 'drop']) {
      const ev = new a.w.Event(kind, { bubbles: true, cancelable: true }); inp.dispatchEvent(ev);
      assert.equal(ev.defaultPrevented, true, kind);
    }
  } finally { a.close(); }
});

/* Animated live feedback and SwanStage celebrations. */
test('correct answer animates tick, slots and chime, celebrates streak and advances at 1050ms', function () {
  has('Eng.onTypeCorrect=function'); has('id="ansTick"'); has('id="plTickHero"');
  has('.ans-slots .slot-done'); has('this.after(1050'); has('SwanStage.celebrateStreak(this.liveStreakCount)');
  const a = boot();
  try {
    const doc = startPlaying(a), inp = doc.getElementById('ansInput');
    const word = a.q.Eng.currentWord().w.split('/')[0];
    let chimes = 0; const celebrations = [];
    a.q.UI.playTickChime = function () { chimes++; };
    a.w.SwanStage.celebrateStreak = function (n) { celebrations.push(n); };
    for (const ch of word) typeChar(a, inp, ch);
    assert.equal(a.q.Eng.wordSolved, true); assert.equal(a.q.Eng.liveCorrectCount, 1);
    assert.equal(a.q.Eng.liveStreakCount, 1); assert.equal(a.q.Eng.answers[0], word);
    assert.equal(chimes, 1); assert.deepEqual(celebrations, [1]);
    assert.ok(doc.getElementById('ansTick').classList.contains('is-correct'));
    assert.ok(doc.getElementById('plTickHero').classList.contains('is-correct'));
    assert.ok(doc.querySelectorAll('#ansSlots .slot-done').length > 0);
    a.clock.tick(1000); assert.equal(a.q.Eng.idx, 0);
    a.clock.tick(100); assert.equal(a.q.Eng.idx, 1);
    assert.equal(a.q.Eng.answers[0], word); assert.equal(a.q.Eng.typedAnswer, ''); assert.equal(inp.value, ' ');
    assert.match(doc.getElementById('ansMirrorText').textContent, /Type the word you hear/);
  } finally { a.close(); }
});

test('paper checklist completion sends one golden surge and resets only when completion changes', function () {
  has('swanComplete'); has('SwanStage.celebrateStreak(n)');
  const a = boot();
  try {
    const words = [{ w: 'harbour', s: '', m: '' }, { w: 'journey', s: '', m: '' }];
    const rec = { id: 'swan-paper-test', mode: 'paper', percent: 0, score: 0, wordCount: 2,
      rows: [{ state: '' }, { state: '' }], durationSec: 10, listName: TITLE,
      sessionNo: '7', sessionDay: 'Thursday', sessionDate: '2026-10-26' };
    a.q.Results.open(rec, words, [0, 1]);
    const doc = a.w.document, celebrations = [];
    a.w.SwanStage.celebrateStreak = function (n) { celebrations.push(n); };
    const find = (label) => Array.from(doc.querySelectorAll('#layers button')).find((b) => b.textContent.trim() === label);
    click(a, find('All right')); assert.deepEqual(celebrations, [2]);
    click(a, find('All right')); assert.deepEqual(celebrations, [2], 'no duplicate celebration');
    click(a, find('Reset')); click(a, find('All right')); assert.deepEqual(celebrations, [2, 2]);
  } finally { a.close(); }
});

test('wrong answer shows cross and diff, breaks streak, records mistake, speaks once and holds 2100ms', function () {
  has('Eng.onTypeWrong=function'); has('id="ansWrong"'); has('id="plWrongHero"'); has('id="ansCompare"');
  has('streak-broken'); has('Streak Broken! (0)'); has('function diffChars'); has('this.after(2100');
  const a = boot();
  try {
    const doc = startPlaying(a), inp = doc.getElementById('ansInput');
    const first = a.q.Eng.currentWord().w.split('/')[0];
    for (const ch of first) typeChar(a, inp, ch);
    a.clock.tick(1200); assert.equal(a.q.Eng.idx, 1); assert.equal(a.q.Eng.liveStreakCount, 1);
    const target = a.q.Eng.currentWord().w; let tones = 0; const spoken = [];
    a.q.UI.playWrongTone = function () { tones++; };
    a.q.Speech.say = function (parts) { spoken.push(parts.join(' ')); };
    for (const ch of 'zzzz') typeChar(a, inp, ch);
    inp.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    a.clock.tick(60);
    assert.equal(a.q.Eng.wordWrong, true); assert.equal(a.q.Eng.liveStreakCount, 0);
    assert.equal(a.q.Eng.liveWrongCount, 1); assert.equal(tones, 1);
    assert.deepEqual(spoken, [target.split('/')[0]]);
    assert.ok(doc.getElementById('ansWrong').classList.contains('is-wrong'));
    assert.ok(doc.getElementById('plWrongHero').classList.contains('is-wrong'));
    assert.match(doc.getElementById('plStreakCount').className, /streak-broken/);
    assert.match(doc.getElementById('plStreakCount').textContent, /Streak Broken! \(0\)/);
    assert.match(doc.getElementById('ansCompare').className, /is-open/);
    assert.match(doc.getElementById('ansCompare').textContent, /Your answer/);
    assert.match(doc.getElementById('ansCompare').textContent, /Correct UK spelling/);
    assert.match(doc.getElementById('ansCheckBtn').textContent, /Got it → Next/);
    assert.equal(a.q.DB.data.mistakes.some((m) => m.w === target.toLowerCase()), true);
    assert.equal(inp.value, ' ');
    a.clock.tick(1500); assert.equal(a.q.Eng.idx, 1);
    a.clock.tick(700); assert.equal(a.q.Eng.idx, 2);
  } finally { a.close(); }
});

test('tyre, tire and tyre/tire all match word #26', function () {
  has('Eng.isAnswerMatch=function');
  const a = boot();
  try {
    const Eng = a.q.Eng;
    assert.deepEqual(Array.prototype.slice.call(Eng.getTargetVariants({ w: 'tyre/tire' })), ['tyre/tire', 'tyre', 'tire']);
    for (const answer of ['tyre', 'tire', 'tyre/tire', '  TIRE ']) {
      assert.equal(Eng.isAnswerMatch(answer, { w: 'tyre/tire' }), true, answer);
      assert.equal(Eng.isAnswerMatch(answer, session.lists[0].words[25]), true, answer);
    }
    assert.equal(Eng.isAnswerMatch('tyres', { w: 'tyre/tire' }), false);
    assert.equal(Eng.isAnswerMatch('', { w: 'tyre/tire' }), false);
    assert.equal(Eng.isPrefixMatch('tyr', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isPrefixMatch('tir', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isPrefixMatch('xx', { w: 'tyre/tire' }), false);
  } finally { a.close(); }
});

/* Liquid Glass v22 visual gates. */
test('credit swan, hollow hero, Settings-only mixer and universal sliding capsules remain intact', function () {
  has('.c-swan'); has('@keyframes swanFloat'); has('@keyframes swanWing'); has('@keyframes swanRipple');
  has('<span class="c-text"><small>credits goes to</small><b>Hansana</b></span>'); has('CREDITS GOES TO');
  has('id="tabInd"'); has('.seg .thumb,.seg-tint .seg-ind'); has('.glass .glass'); has('will-change:transform');
  assert.match(rule('.credit'), /z-index:9999\s*!important/);
  assert.match(rule('.layer'), /z-index:60/); assert.match(rule('.sheet'), /z-index:70/);
  assert.match(rule('#homeTitle,.liquid-glass-text'), /-webkit-text-stroke:1\.75px/);
  assert.match(rule('#homeTitle,.liquid-glass-text'), /color:transparent\s*!important/);
  assert.match(rule('#homeTitle,.liquid-glass-text'), /-webkit-background-clip:text/);
  assert.match(rule('#grain'), /display:none\s*!important/);
  assert.match(cssText(), /\.blob\{filter:none!important\}/);
  assert.equal(homeMarkup().includes('Liquid Glass'), false);
  assert.equal(homeMarkup().includes('lgStage'), false);
  const a = boot();
  try {
    const doc = a.w.document;
    assert.ok(doc.querySelector('#credit .c-swan'));
    assert.equal(doc.querySelector('#homeTitle').textContent, TITLE);
    assert.equal(doc.querySelector('#homeTitle').className, 'liquid-glass-text');
    for (const mode of ['lite', 'full']) {
      a.q.DB.data.settings.perf = mode; a.q.UI.applyPerf();
      assert.ok(doc.querySelector('#credit.credit.glass .c-swan'), mode);
    }
    a.q.Screens.settings(); a.clock.tick(300);
    for (const id of ['lgStage', 'orb', 'sBlur', 'sSat', 'sBrt']) assert.ok(doc.querySelector('#screen-set #' + id), id);
    assert.match(doc.querySelector('#screen-set .seg-tint').textContent, /Clear[\s\S]*Frost[\s\S]*Smoke/);
    assert.match(doc.querySelector('#screen-set .seg-perf').textContent, /Auto[\s\S]*Lite 60FPS[\s\S]*Full/);
    assert.equal(doc.querySelector('#screen-home #lgStage'), null);
    assert.ok(doc.getElementById('tabInd'));
  } finally { a.close(); }
});

let failed = 0;
for (const item of tests) {
  try { item.fn(); console.log('# ok - ' + item.name); }
  catch (error) {
    failed++; console.log('# not ok - ' + item.name);
    console.log('#   ' + String((error && error.stack) || error).split('\n').join('\n#   '));
  }
}
if (failed) {
  console.log('# ' + failed + ' of ' + tests.length + ' upgrade checks failed');
  process.exit(1);
}
console.log('# all ' + tests.length + ' upgrade checks passed');
