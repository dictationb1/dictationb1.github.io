/* Smart Dictation Player 2.9.0 (schema 21) release verification.
   This suite is authored as a clean v21 rewrite. It exercises the real ES5
   application in jsdom: Guide/Tour auto-start, the v20 native-input shield,
   one-tap ready exits, animated answer feedback, and liquid-glass UI. */
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
const STORE_KEY = 'sdp.v21_guide_start';
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
function rule(selector) {
  const at = html.indexOf(selector + ' {');
  assert.ok(at >= 0, 'CSS rule exists: ' + selector);
  const end = html.indexOf('}', at);
  return html.slice(at, end + 1);
}
function homeMarkup() {
  const start = html.indexOf('<section class="screen" id="screen-home"');
  const end = html.indexOf('</section>', start);
  return html.slice(start, end);
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

/* ------------------------------------------------------- release integrity */

test('single-file budget, strict ES5 and zero external assets', function () {
  const bytes = Buffer.byteLength(html);
  assert.ok(bytes < 440000, 'index.html stays under 440,000 bytes (now ' + bytes + ')');
  assert.ok(bytes < 450000, 'index.html stays under the hard 450,000-byte gate');
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

test('v21 / 2.9.0 metadata and v20 storage migration are consistent', function () {
  for (const data of [version, config, session]) assert.ok(Number(data.ver) >= 21, 'ver >= 21');
  for (const data of [version, config, session]) assert.equal(data.appVersion, '2.9.0');
  assert.equal(version.version, '2.9.0');
  assert.equal(config.version, '2.9.0');
  assert.equal(session.version, '2.9.0');
  assert.equal(version.settingsRev, 21);
  assert.equal(config.settingsRev, 21);
  assert.equal(session.settingsRev, 21);
  assert.equal(version.session, '7');
  assert.equal(version.title, TITLE);
  assert.equal(config.listId, LIST_ID);
  assert.equal(config.storageKey, STORE_KEY);
  assert.equal(session.ver, 21);
  has('var APP_VERSION="2.9.0"');
  has('key:"sdp.v21_guide_start"');
  has('schema:21');
  has('settingsRev:21');
  has('"sdp.v20_nopass","sdp.v19_incog"');
  const a = boot();
  try {
    assert.equal(a.q.CONFIG.key, STORE_KEY);
    assert.equal(a.q.CONFIG.schema, 21);
    assert.equal(a.q.CONFIG.settingsRev, 21);
    assert.equal(a.q.DB.data.v, 21);
    assert.equal(a.q.DB.data.settingsRev, 21);
    assert.ok(a.w.localStorage.getItem(STORE_KEY), 'the v21 store is written');
  } finally { a.close(); }
});

test('Session 7 keeps all 30 words, 5s timer, 2 repeats and Amy', function () {
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
  has('writeFixed:5');
  has('repeats:2');
  has('voice=Amy');
  has('British Female Professor Voice (Amy · en-GB)');
  const a = boot();
  try {
    assert.equal(a.q.DB.data.settings.writeFixed, 5);
    assert.equal(a.q.DB.data.settings.repeats, 2);
    assert.equal(a.q.DB.data.lists[0].words.length, 30);
    assert.equal(a.q.SAMPLE_WORDS.length, 30);
  } finally { a.close(); }
});

/* ------------------------------------------- Guide and Tour auto-start flow */

test('User Guide Start practising unlocks audio, closes the guide and launches Eng.start on Home', function () {
  has('UI.startPractisingFromGuide=function');
  has('go.id="btnGuideStart"');
  has('UI.startPractisingFromGuide();');
  has('Eng.start({});');
  has('Speech.unlock();');
  const a = boot();
  try {
    const doc = a.w.document;
    const order = [];
    const unlock = a.q.Speech.unlock;
    const start = a.q.Eng.start;
    a.q.Speech.unlock = function () { order.push('unlock'); return unlock.apply(this, arguments); };
    a.q.Eng.start = function () { order.push('start'); return start.apply(this, arguments); };
    a.q.DB.data.tourSeen = false;
    a.q.DB.data.guideSeen = false;
    a.q.DB.saveNow();
    a.q.UI.openWelcomeGuide();
    const go = doc.getElementById('btnGuideStart');
    assert.ok(go, 'the primary Guide CTA exists');
    assert.equal(go.textContent.trim(), 'Start practising');
    assert.equal(go.className, 'btn primary xl block');
    assert.equal(go.querySelector('svg use').getAttribute('href'), '#i-play');
    click(a, go);
    assert.deepEqual(order, ['unlock', 'start'], 'audio unlock and Eng.start run synchronously in the click');
    assert.equal(a.q.UI.tab, 'home');
    assert.equal(doc.getElementById('screen-home').classList.contains('hidden'), false);
    assert.equal(a.q.Eng.st, 'ready', 'Start dictation has launched');
    assert.equal(a.q.Eng.words.length, 30);
    assert.equal(doc.querySelectorAll('#layers .layer').length, 1, 'the player layer is open');
    assert.equal(doc.getElementById('btnGuideStart'), null, 'the guide is gone');
    assert.match(doc.querySelector('#sheets .sheet').textContent, /Are you ready\?/, 'the ready sheet replaces it');
    assert.equal(a.q.DB.data.tourSeen, true);
    assert.equal(a.q.DB.data.guideSeen, true);
    const saved = JSON.parse(a.w.localStorage.getItem(STORE_KEY));
    assert.equal(saved.tourSeen, true);
    assert.equal(saved.guideSeen, true);
  } finally { a.close(); }
});

test('Guide close never starts dictation; Sinhala CTA, Settings and first run stay wired', function () {
  const a = boot();
  try {
    const doc = a.w.document;
    a.q.UI.setLang('si');
    a.q.UI.openWelcomeGuide();
    const go = doc.getElementById('btnGuideStart');
    assert.equal(go.textContent.trim(), 'පුහුණුව ආරම්භ කරන්න');
    click(a, doc.querySelector('#sheets .shead button'));
    assert.equal(doc.querySelectorAll('#sheets .sheet').length, 0);
    assert.equal(doc.querySelectorAll('#layers .layer').length, 0);
    assert.equal(a.q.Eng.st, 'idle', 'the far-right cross only closes the guide');
    assert.equal(a.q.DB.data.guideSeen, false, 'closing does not mark the CTA as used');

    a.q.UI.setLang('en');
    a.q.UI.setTab('set');
    const settingsGuide = Array.from(doc.querySelectorAll('#screen-set button')).find((b) => b.textContent.trim() === 'User Guide / උපදෙස්');
    assert.ok(settingsGuide, 'Settings has User Guide / උපදෙස්');
    click(a, settingsGuide);
    assert.ok(doc.getElementById('btnGuideStart'), 'Settings opens the same auto-start guide');
    click(a, doc.querySelector('#sheets .shead button'));

    a.q.DB.data.tourSeen = false;
    a.q.firstRunTour();
    assert.ok(doc.getElementById('btnGuideStart'), 'first run opens the same guide CTA');
    click(a, doc.querySelector('#sheets .shead button'));
    assert.equal(a.q.Eng.st, 'idle');
  } finally { a.close(); }
});

test('classic runTour final Start practising card also launches Eng.start', function () {
  has('function runTour(){');
  has('n===cards.length-1');
  has('S.doneTour');
  const a = boot();
  try {
    const doc = a.w.document;
    a.q.UI.runTour();
    assert.match(doc.querySelector('#sheets .sheet').textContent, /\(1\/3\)/);
    assert.equal(primaryTourButton(doc).textContent.trim(), 'Next');
    click(a, primaryTourButton(doc));
    a.clock.tick(130);
    assert.match(doc.querySelector('#sheets .sheet').textContent, /\(2\/3\)/);
    click(a, primaryTourButton(doc));
    a.clock.tick(130);
    const go = doc.getElementById('btnGuideStart');
    assert.ok(go, 'the final tour card uses the same CTA id');
    assert.equal(go.textContent.trim(), 'Start practising');
    click(a, go);
    assert.equal(a.q.UI.tab, 'home');
    assert.equal(a.q.Eng.st, 'ready');
    assert.equal(doc.querySelectorAll('#layers .layer').length, 1);
    assert.match(doc.querySelector('#sheets .sheet').textContent, /Are you ready\?/);
    assert.equal(a.q.DB.data.tourSeen, true);
    assert.equal(a.q.DB.data.guideSeen, true);
  } finally { a.close(); }
});

/* ------------------------------------------------------- ready sheet, no VKB */

test('ready sheet has two actions and cross, scrim and Escape all exit in one tap', function () {
  lacks('btnReadyClose', 'no middle close button');
  lacks('btnNotReady', 'no Not ready exit button');
  lacks('Not ready', 'no Not ready label');
  has('Eng.cancelReadyAndExit=function');
  for (const how of ['cross', 'scrim', 'escape']) {
    const a = boot();
    try {
      const doc = typeBoot(a);
      assert.equal(a.q.Eng.st, 'ready');
      const exits = doc.querySelectorAll('#sheets .shead button');
      assert.equal(exits.length, 1, 'one far-right header cross');
      assert.equal(exits[0].getAttribute('aria-label'), 'Close');
      const actions = Array.from(doc.querySelectorAll('#sheets .sfoot button')).map((b) => b.textContent.trim());
      assert.deepEqual(actions, ["I'm ready", 'Skip countdown']);
      if (how === 'cross') click(a, exits[0]);
      else if (how === 'scrim') click(a, doc.querySelector('#sheets .scrim'));
      else doc.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      a.clock.tick(120);
      assert.equal(a.q.Eng.st, 'idle', how + ': engine stops');
      assert.equal(a.q.Eng.layer, null, how + ': player closes');
      assert.equal(doc.querySelectorAll('#sheets .sheet').length, 0, how + ': sheet closes');
      assert.equal(doc.querySelectorAll('#layers .layer').length, 0, how + ': layer stack empties');
      assert.equal(doc.getElementById('screen-home').classList.contains('hidden'), false, how + ': Home returns');
      assert.equal(a.q.DB.data.snapshot, undefined, how + ': uncommitted snapshot is dropped');
    } finally { a.close(); }
  }
});

test('native text input has every anti-password and anti-suggestion attribute; no custom keyboard', function () {
  lacks('ansVkb');
  lacks('btnToggleVkb');
  lacks('btnVkbToggle');
  lacks('buildVkb');
  lacks('vkb-key');
  lacks('ans-vkb');
  has('inp.type="text"');
  has('inp.setAttribute("autocomplete","off")');
  has('Eng.syncInputMirror=function');
  has('Eng.onTypeInputUpdate=function');
  has('id="ansMirror"');
  has('id="ansMirrorText"');
  assert.equal(html.indexOf('new-password'), -1, 'never new-password');
  assert.equal(html.indexOf('current-password'), -1, 'never current-password');
  assert.equal(/inp\.type\s*=\s*"password"/.test(html), false, 'answer input is never password');
  const inputCss = rule('#ansInput');
  assert.match(inputCss, /color:transparent !important/);
  assert.match(inputCss, /-webkit-text-fill-color:transparent !important/);
  assert.match(inputCss, /caret-color:transparent !important/);
  assert.match(inputCss, /background:transparent !important/);
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const expected = {
      autocomplete: 'off', inputmode: 'text', autocorrect: 'off', autocapitalize: 'none',
      spellcheck: 'false', 'aria-autocomplete': 'none', 'data-lpignore': 'true',
      'data-1p-ignore': 'true', 'data-bwignore': 'true', 'data-form-type': 'other',
      'data-gramm': 'false'
    };
    assert.equal(inp.type, 'text');
    for (const key of Object.keys(expected)) assert.equal(inp.getAttribute(key), expected[key], key);
    assert.match(inp.name, /^sdp_field_\d{1,12}$/);
    assert.equal(inp.form, null);
    assert.equal(inp.hasAttribute('placeholder'), false);
    assert.equal(inp.value, ' ');
    assert.equal(inp.parentNode.id, 'ansWrap');
    assert.ok(doc.getElementById('ansMirror'));
    assert.ok(doc.getElementById('ansMirrorText'));
    assert.ok(doc.querySelector('#ansMirror .ans-caret'));
    assert.equal(doc.getElementById('ansVkb'), null);
    assert.equal(doc.getElementById('btnToggleVkb'), null);
  } finally { a.close(); }
});

/* -------------------------------------- single-space IME sentinel and mirror */

test('single-space buffer, mirror, Backspace, deletion and captureAnswer stay in sync', function () {
  has('self.typedAnswer');
  has('inp.value=" "');
  has('insertReplacementText');
  has('deleteContentBackward');
  has('this.answers[this.idx]=this.typedAnswer||""');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const mirror = doc.getElementById('ansMirrorText');
    assert.match(mirror.textContent, /Type the word you hear/);
    assert.equal(mirror.className, 'ans-placeholder');
    let built = '';
    for (const ch of a.q.Eng.currentWord().w.slice(0, 3)) {
      built += ch;
      typeChar(a, inp, ch);
      assert.equal(inp.value, ' ', 'the native buffer is reset after ' + built);
      assert.equal(a.q.Eng.typedAnswer, built);
      assert.equal(mirror.textContent, built);
      assert.equal(a.q.Eng.answers[a.q.Eng.idx], built);
    }
    inp.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    assert.equal(a.q.Eng.typedAnswer, built.slice(0, -1));
    inp.value = '';
    inputEvent(a, inp, 'deleteContentBackward');
    assert.equal(a.q.Eng.typedAnswer, built.slice(0, -2));
    assert.equal(inp.value, ' ');
    inp.value = 'abc';
    inputEvent(a, inp);
    assert.equal(a.q.Eng.typedAnswer, 'abc', 'programmatic whole-value assignment is accepted');
    assert.equal(mirror.textContent, 'abc');
    assert.equal(inp.value, ' ');
    a.q.Eng.captureAnswer();
    assert.equal(a.q.Eng.answers[a.q.Eng.idx], 'abc');
  } finally { a.close(); }
});

test('replacement suggestions, paste and drop never enter typedAnswer', function () {
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    typeChar(a, inp, 'g');
    const before = a.q.Eng.typedAnswer;
    for (const kind of ['insertReplacementText', 'insertFromPaste', 'insertFromDrop']) {
      inp.value = ' guidebook';
      inputEvent(a, inp, kind);
      assert.equal(a.q.Eng.typedAnswer, before, kind + ' is rejected');
      assert.equal(inp.value, ' ', kind + ' restores the sentinel');
      assert.match(doc.getElementById('ansFeedback').textContent, /blocked/);
    }
    const bi = new a.w.Event('beforeinput', { bubbles: true, cancelable: true });
    bi.inputType = 'insertReplacementText';
    inp.dispatchEvent(bi);
    assert.equal(bi.defaultPrevented, true);
    for (const kind of ['paste', 'drop']) {
      const ev = new a.w.Event(kind, { bubbles: true, cancelable: true });
      inp.dispatchEvent(ev);
      assert.equal(ev.defaultPrevented, true, kind + ' is prevented');
    }
  } finally { a.close(); }
});

/* ------------------------------------------------------------- live feedback */

test('correct answer animates tick and slots, chimes, preserves the answer and advances at 1050ms', function () {
  has('Eng.onTypeCorrect=function');
  has('id="ansTick"');
  has('id="plTickHero"');
  has('.ans-slots .slot-done');
  has('this.after(1050');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const word = a.q.Eng.currentWord().w.split('/')[0];
    let chimes = 0;
    a.q.UI.playTickChime = function () { chimes++; };
    for (const ch of word) typeChar(a, inp, ch);
    assert.equal(a.q.Eng.wordSolved, true);
    assert.equal(a.q.Eng.liveCorrectCount, 1);
    assert.equal(a.q.Eng.liveStreakCount, 1);
    assert.equal(a.q.Eng.answers[0], word);
    assert.equal(chimes, 1);
    assert.equal(doc.getElementById('ansTick').classList.contains('is-correct'), true);
    assert.equal(doc.getElementById('plTickHero').classList.contains('is-correct'), true);
    assert.ok(doc.querySelectorAll('#ansSlots .slot-done').length > 0);
    a.clock.tick(1000);
    assert.equal(a.q.Eng.idx, 0, 'still holding before 1050ms');
    a.clock.tick(100);
    assert.equal(a.q.Eng.idx, 1, 'auto-advanced after 1050ms');
    assert.equal(a.q.Eng.answers[0], word, 'advancing does not erase the captured answer');
    assert.equal(a.q.Eng.typedAnswer, '');
    assert.equal(inp.value, ' ');
    assert.match(doc.getElementById('ansMirrorText').textContent, /Type the word you hear/);
  } finally { a.close(); }
});

test('wrong answer shows cross and diff, breaks streak, records mistake, speaks once and holds 2100ms', function () {
  has('Eng.onTypeWrong=function');
  has('id="ansWrong"');
  has('id="plWrongHero"');
  has('id="ansCompare"');
  has('streak-broken');
  has('Streak Broken! (0)');
  has('function diffChars');
  has('this.after(2100');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const first = a.q.Eng.currentWord().w.split('/')[0];
    for (const ch of first) typeChar(a, inp, ch);
    a.clock.tick(1200);
    assert.equal(a.q.Eng.idx, 1);
    assert.equal(a.q.Eng.liveStreakCount, 1);
    const target = a.q.Eng.currentWord().w;
    let tones = 0;
    const spoken = [];
    a.q.UI.playWrongTone = function () { tones++; };
    a.q.Speech.say = function (parts) { spoken.push(parts.join(' ')); };
    for (const ch of 'zzzz') typeChar(a, inp, ch);
    inp.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    a.clock.tick(60);
    assert.equal(a.q.Eng.wordWrong, true);
    assert.equal(a.q.Eng.liveStreakCount, 0);
    assert.equal(a.q.Eng.liveWrongCount, 1);
    assert.equal(tones, 1);
    assert.deepEqual(spoken, [target.split('/')[0]], 'the correct word is spoken clearly once');
    assert.equal(doc.getElementById('ansWrong').classList.contains('is-wrong'), true);
    assert.equal(doc.getElementById('plWrongHero').classList.contains('is-wrong'), true);
    assert.match(doc.getElementById('plStreakCount').className, /streak-broken/);
    assert.match(doc.getElementById('plStreakCount').textContent, /Streak Broken! \(0\)/);
    assert.match(doc.getElementById('ansCompare').className, /is-open/);
    assert.match(doc.getElementById('ansCompare').textContent, /Your answer/);
    assert.match(doc.getElementById('ansCompare').textContent, /Correct UK spelling/);
    assert.match(doc.getElementById('ansCheckBtn').textContent, /Got it → Next/);
    assert.equal(a.q.DB.data.mistakes.some((m) => m.w === target.toLowerCase()), true);
    assert.equal(inp.value, ' ');
    a.clock.tick(1500);
    assert.equal(a.q.Eng.idx, 1, 'correction remains before 2100ms');
    a.clock.tick(700);
    assert.equal(a.q.Eng.idx, 2, 'correction advances after 2100ms');
  } finally { a.close(); }
});

test('tyre, tire and tyre/tire all match word #26', function () {
  has('Eng.isAnswerMatch=function');
  const a = boot();
  try {
    const Eng = a.q.Eng;
    const variants = Array.prototype.slice.call(Eng.getTargetVariants({ w: 'tyre/tire' }));
    assert.deepEqual(variants, ['tyre/tire', 'tyre', 'tire']);
    for (const answer of ['tyre', 'tire', 'tyre/tire', '  TIRE ']) {
      assert.equal(Eng.isAnswerMatch(answer, { w: 'tyre/tire' }), true, answer);
      assert.equal(Eng.isAnswerMatch(answer, session.lists[0].words[25]), true, answer + ' against session word #26');
    }
    assert.equal(Eng.isAnswerMatch('tyres', { w: 'tyre/tire' }), false);
    assert.equal(Eng.isAnswerMatch('', { w: 'tyre/tire' }), false);
    assert.equal(Eng.isPrefixMatch('tyr', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isPrefixMatch('tir', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isPrefixMatch('xx', { w: 'tyre/tire' }), false);
  } finally { a.close(); }
});

/* ------------------------------------------------------ liquid glass and 60 FPS */

test('swan stays below overlays; hollow hero, Settings-only mixer and sliding capsules remain', function () {
  has('.c-swan');
  has('@keyframes swanFloat');
  has('@keyframes swanWing');
  has('@keyframes swanRipple');
  has('<span class="c-text"><small>credits goes to</small><b>Hansana</b></span>');
  has('id="tabInd"');
  has('.seg .thumb,.seg-tint .seg-ind');
  has('.glass .glass');
  has('#grain {display:none !important;}');
  has('.blob {filter:none !important;}');
  has('will-change:transform');
  assert.match(rule('.credit'), /z-index:35/);
  assert.match(rule('.layer'), /z-index:60/);
  assert.match(rule('.sheet'), /z-index:70/);
  assert.match(rule('#homeTitle,.liquid-glass-text'), /-webkit-text-stroke:1\.75px/);
  assert.match(rule('#homeTitle,.liquid-glass-text'), /color:transparent !important/);
  assert.match(rule('#homeTitle,.liquid-glass-text'), /-webkit-background-clip:text/);
  assert.equal(homeMarkup().indexOf('Liquid Glass'), -1, 'no Liquid Glass label after the hero title');
  assert.equal(homeMarkup().indexOf('lgStage'), -1, 'the mixer is not on Home');
  const a = boot();
  try {
    const doc = a.w.document;
    assert.ok(doc.querySelector('#credit .c-swan'));
    assert.equal(doc.querySelector('#homeTitle').textContent, TITLE);
    assert.equal(doc.querySelector('#homeTitle').className, 'liquid-glass-text');
    for (const mode of ['lite', 'full']) {
      a.q.DB.data.settings.perf = mode;
      a.q.UI.applyPerf();
      assert.ok(doc.querySelector('#credit.credit.glass .c-swan'), 'swan remains active in ' + mode);
    }
    a.q.Screens.settings();
    a.clock.tick(300);
    for (const id of ['lgStage', 'orb', 'sBlur', 'sSat', 'sBrt']) {
      assert.ok(doc.querySelector('#screen-set #' + id), 'Settings mixer has #' + id);
    }
    assert.match(doc.querySelector('#screen-set .seg-tint').textContent, /Clear[\s\S]*Frost[\s\S]*Smoke/);
    assert.match(doc.querySelector('#screen-set .seg-perf').textContent, /Auto[\s\S]*Lite 60FPS[\s\S]*Full/);
    assert.equal(doc.querySelector('#screen-home #lgStage'), null);
    assert.ok(doc.getElementById('tabInd'));
  } finally { a.close(); }
});

/* ------------------------------------------------------------- run suite */

let failed = 0;
for (const item of tests) {
  try {
    item.fn();
    console.log('# ok - ' + item.name);
  } catch (error) {
    failed++;
    console.log('# not ok - ' + item.name);
    console.log('#   ' + String((error && error.stack) || error).split('\n').join('\n#   '));
  }
}
if (failed) {
  console.log('# ' + failed + ' of ' + tests.length + ' upgrade checks failed');
  process.exit(1);
}
console.log('# all ' + tests.length + ' upgrade checks passed');
