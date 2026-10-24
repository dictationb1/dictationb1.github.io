/* Smart Dictation Player 2.7.0 (schema 19) release verification.
   Written from scratch in one clean fs.writeFileSync pass for the v19 release:
   - the ready sheet now keeps ONE far-right close cross (no #btnReadyClose and
     no #btnNotReady duplicate exit buttons) and still exits Home in one tap;
   - the custom in-app keyboard (#ansVkb and the Keyboard toggle) is gone: the
     student always gets the native Gboard / Samsung / Helakuru / iOS keyboard
     in strict incognito mode through a password-IME input plus the plain-text
     #ansMirror overlay;
   - every v18 feature stays intact: animated tick, false-answer streak
     breakdown, coral cross, side-by-side diff card, swan badge, see-through
     hero title, Settings-only material mixer and sliding capsules. */
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
const STORE_KEY = 'sdp.v19_incog';
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
function fire(a, el, type) {
  el.dispatchEvent(new a.w.Event(type, { bubbles: true, cancelable: true }));
}
function click(a, el) {
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
  return found[found.length - 1].replace(/^<script>/, '').replace(/<\/script>$/, '');
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
  assert.ok(skip, 'the ready sheet still offers Skip countdown');
  click(a, skip);
  a.clock.tick(4000);
  return doc;
}
function answer(a, doc, value) {
  const inp = doc.getElementById('ansInput');
  assert.ok(inp, '#ansInput exists');
  inp.focus();
  inp.value = value;
  inp.dispatchEvent(new a.w.Event('input', { bubbles: true }));
  return inp;
}

/* ------------------------------------------------------- release integrity */

test('single-file budget, strict ES5, zero external assets', function () {
  assert.ok(Buffer.byteLength(html) < 450000, 'under the 450,000-byte gate');
  const script = appScript();
  acorn.parse(script, { ecmaVersion: 5 });
  assert.equal(/<link\b/i.test(html), false, 'no <link> tags at all');
  assert.equal(/@import/i.test(html), false, 'no CSS imports');
  assert.equal(/<script[^>]+src=/i.test(html), false, 'no external scripts');
  assert.equal(script.indexOf('=>'), -1, 'no arrow functions');
  assert.equal(script.indexOf(String.fromCharCode(96)), -1, 'no template literals');
  assert.equal(/\basync\s+function/.test(script), false, 'no async functions');
  assert.equal(/\bawait\s/.test(script), false, 'no await');
  assert.equal(/<link\b/i.test(homeMarkup()), false, 'Home ships no external stylesheet');
});

test('v19 / 2.7.0 metadata is consistent across the app and data files', function () {
  for (const data of [version, config, session]) assert.ok(Number(data.ver) >= 19, 'ver >= 19');
  assert.equal(version.appVersion, '2.7.0');
  assert.equal(version.version, '2.7.0');
  assert.equal(version.settingsRev, 19);
  assert.equal(version.session, '7');
  assert.equal(version.title, TITLE);
  assert.equal(config.appVersion, '2.7.0');
  assert.equal(config.version, '2.7.0');
  assert.equal(config.settingsRev, 19);
  assert.equal(config.listId, LIST_ID);
  assert.equal(config.storageKey, STORE_KEY);
  assert.equal(session.appVersion, '2.7.0');
  assert.equal(session.ver, 19);
  has('var APP_VERSION="2.7.0"');
  has('key:"sdp.v19_incog"');
  has('schema:19');
  const a = boot();
  try {
    assert.equal(a.q.CONFIG.key, STORE_KEY);
    assert.equal(a.q.CONFIG.schema, 19);
    assert.equal(a.q.CONFIG.settingsRev, 19);
    assert.equal(a.q.DB.data.settingsRev, 19);
    assert.equal(a.w.SDP.version, '2.7.0');
    const legacy = JSON.parse(JSON.stringify(a.q.DB.data));
    legacy.settingsRev = 18;
    legacy.settings.vkb = true;
    const lifted = a.q.DB.migrate(legacy);
    assert.equal(lifted.settingsRev, 19, 'an 18 save lifts to schema 19');
    assert.equal('vkb' in lifted.settings, false, 'the removed keyboard preference is dropped');
  } finally { a.close(); }
});

test('Session 7 keeps all 30 Travel & Transport words, 5s timer, 2 repeats and Amy', function () {
  assert.deepEqual(session.lists[0].words.map((w) => w.w), WORDS);
  assert.equal(session.session.title, TITLE);
  assert.equal(session.session.no, '7');
  assert.equal(session.session.day, 'Thursday');
  assert.equal(session.lists[0].id, LIST_ID);
  assert.equal(session.lists[0].published, true);
  for (const w of session.lists[0].words) {
    assert.ok(w.m && w.m.length > 10, w.w + ' meaning');
    assert.ok(w.s && w.s.length > 10, w.w + ' sentence');
    assert.match(w.audio || '', /^https:\/\/.+\.mp3$/i);
  }
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.match(config.tts.primary, /Amy/);
  assert.match(config.tts.primary, /en-GB/);
  const a = boot();
  try {
    const list = a.q.Lib.current();
    assert.equal(list.words.length, 30);
    assert.equal(list.words[0].w, 'guidebook');
    assert.equal(list.words[25].w, 'tyre/tire');
    assert.equal(list.words[29].w, 'windscreen');
    assert.equal(a.q.DB.data.settings.writeFixed, 5);
    assert.equal(a.q.DB.data.settings.repeats, 2);
  } finally { a.close(); }
});

/* ------------------------------------------ ready sheet without duplicates */

test('ready sheet: both green-circled duplicate exit buttons are gone', function () {
  lacks('btnReadyClose', 'no duplicate #btnReadyClose in the header');
  lacks('btnNotReady', 'no bottom #btnNotReady exit button');
  lacks('Not ready · Exit', 'the bottom exit label is gone');
  const a = boot();
  try {
    const doc = typeBoot(a);
    assert.equal(doc.getElementById('btnReadyClose'), null);
    assert.equal(doc.getElementById('btnNotReady'), null);
    assert.equal(doc.querySelectorAll('#sheets .shead button').length, 1, 'one far-right close cross only');
    const foot = Array.from(doc.querySelectorAll('#sheets .sfoot button')).map((b) => b.textContent.trim());
    assert.deepEqual(foot, ["I'm ready", 'Skip countdown'], 'the footer keeps exactly two actions');
    assert.equal(html.indexOf('onClose:function(){\ndocument.removeEventListener("keydown",onEsc);\nif(self.st==="ready")self.cancelReadyAndExit();') >= 0, true, 'the sheet onClose returns Home');
    assert.match(html, /Eng\.cancelReadyAndExit=function\(\)\{/);
    assert.match(html, /delete DB\.data\.snapshot/);
    assert.match(html, /UI\.closeLayer\(this\.layer\)/);
  } finally { a.close(); }
});

test('ready sheet: the far-right cross, the scrim and Escape each exit Home in one tap', function () {
  for (const how of ['cross', 'scrim', 'escape']) {
    const a = boot();
    try {
      const doc = typeBoot(a);
      assert.equal(a.q.Eng.st, 'ready');
      if (how === 'cross') click(a, doc.querySelector('#sheets .shead button'));
      else if (how === 'scrim') click(a, doc.querySelector('#sheets .scrim'));
      else doc.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      a.clock.tick(120);
      assert.equal(a.q.Eng.st, 'idle', how + ': the engine stops');
      assert.equal(a.q.Eng.layer, null, how + ': the player layer closes');
      assert.equal(doc.querySelectorAll('#sheets .sheet').length, 0, how + ': the sheet closes');
      assert.equal(doc.querySelectorAll('#layers .layer').length, 0, how + ': the layer stack is empty');
      assert.equal(doc.getElementById('screen-home').classList.contains('hidden'), false, how + ': Home is back');
      assert.equal(a.q.DB.data.snapshot, undefined, how + ': the uncommitted snapshot is dropped');
    } finally { a.close(); }
  }
});

/* ----------------------------------- native keyboard only, strict incognito */

test('the custom in-app keyboard and its toggle are removed completely', function () {
  lacks('ansVkb', 'no #ansVkb keyboard grid');
  lacks('btnVkbToggle', 'no Keyboard toggle button');
  lacks('buildVkb', 'no keyboard builder');
  lacks('vkb-key', 'no keyboard keys');
  lacks('ans-vkb', 'no keyboard styles');
  assert.equal(/inputmode\s*=\s*["']none["']/i.test(html), false, 'no inputmode="none" markup');
  assert.equal(html.indexOf('"inputmode","none"'), -1, 'no inputmode="none" script');
  has('Eng.isAnswerMatch=function');
  const a = boot();
  try {
    const doc = startPlaying(a);
    assert.equal(doc.getElementById('ansVkb'), null);
    assert.equal(doc.getElementById('btnVkbToggle'), null);
    assert.equal(doc.querySelectorAll('#ansWrap .vkb-key').length, 0, 'the deck is compact');
    assert.ok(doc.getElementById('ansInput'), 'the native input keeps focus');
  } finally { a.close(); }
});

test('#ansInput is a stealth password IME asking for native incognito mode', function () {
  has('inp.type="password"');
  has('inp.name="sdp_incog_"+Math.floor(Math.random()*1e9)');
  has('inp.setAttribute("inputmode","latin")');
  has('inp.setAttribute("autocomplete","new-password")');
  has('inp.setAttribute("data-1p-ignore","true")');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    assert.equal(inp.type, 'password', 'only the password IME forces no suggestions');
    assert.equal(inp.getAttribute('inputmode'), 'latin');
    assert.equal(inp.getAttribute('autocomplete'), 'new-password');
    assert.equal(inp.getAttribute('autocorrect'), 'off');
    assert.equal(inp.getAttribute('autocapitalize'), 'none');
    assert.equal(inp.getAttribute('spellcheck'), 'false');
    assert.equal(inp.getAttribute('aria-autocomplete'), 'none');
    assert.equal(inp.getAttribute('data-lpignore'), 'true');
    assert.equal(inp.getAttribute('data-1p-ignore'), 'true');
    assert.equal(inp.getAttribute('data-form-type'), 'other');
    assert.match(inp.name, /^sdp_incog_\d{1,12}$/);
    assert.equal(inp.form, null, 'never wrapped in a <form>');
    assert.equal(inp.hasAttribute('placeholder'), false, 'the mirror owns the placeholder');
  } finally { a.close(); }
});

test('#ansMirror paints crisp plain letters behind the invisible password dots', function () {
  has('id="ansMirror"');
  has('id="ansMirrorText"');
  has('mirror.id="ansMirror"');
  has('mirrorText.id="ansMirrorText"');
  has('Type the word you hear');
  has('ans-caret');
  const input = rule('#ansInput');
  assert.match(input, /color:transparent !important/);
  assert.match(input, /-webkit-text-fill-color:transparent !important/);
  assert.match(input, /caret-color:transparent !important/);
  assert.match(input, /font:600 16px\/1\.4 "Manrope"/);
  const mirror = rule('.ans-mirror');
  assert.match(mirror, /left:18px/);
  assert.match(mirror, /right:110px/);
  assert.match(mirror, /pointer-events:none/);
  const caret = rule('.ans-caret');
  assert.match(caret, /width:2px;height:18px;background:var\(--aqua\)/);
  assert.match(caret, /animation:blink 1s steps\(2\) infinite/);
  assert.match(rule('.ans-mirror.is-focused .ans-caret'), /display:inline-block/);
  assert.match(rule('@keyframes blink'), /opacity/);
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const mirror = doc.getElementById('ansMirror');
    const mirrorText = doc.getElementById('ansMirrorText');
    assert.ok(mirror && mirrorText, 'the mirror exists in #ansWrap');
    assert.equal(inp.parentNode.id, 'ansWrap');
    assert.equal(mirror.parentNode.id, 'ansWrap');
    assert.equal(mirror.getAttribute('aria-hidden'), 'true');
    assert.ok(mirror.querySelector('.ans-caret'), 'the aqua caret lives in the mirror');
    assert.match(mirrorText.textContent, /Type the word you hear/);
    assert.ok(mirrorText.querySelector('.ans-placeholder'), 'empty state shows the placeholder span');
    answer(a, doc, 'zzz');
    assert.equal(mirrorText.textContent, 'zzz', 'typed letters are mirrored instantly');
    assert.equal(inp.value, 'zzz');
    assert.match(mirror.className, /is-focused/);
    inp.value = '';
    fire(a, inp, 'input');
    assert.match(mirrorText.textContent, /Type the word you hear/, 'the placeholder returns');
  } finally { a.close(); }
});

test('the mirror clears before advancing and never shows password dots', function () {
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const mirrorText = doc.getElementById('ansMirrorText');
    const word = a.q.Eng.currentWord().w.split('/')[0];
    answer(a, doc, word);
    a.clock.tick(80);
    assert.equal(a.q.Eng.wordSolved, true);
    assert.equal(doc.getElementById('ansTick').classList.contains('is-correct'), true);
    a.clock.tick(1200);
    assert.equal(a.q.Eng.idx, 1, 'the next word is ready');
    assert.equal(inp.value, '', 'the native field is emptied');
    assert.match(mirrorText.textContent, /Type the word you hear/, 'the mirror resets to the placeholder');
    assert.equal(inp.type, 'password');
  } finally { a.close(); }
});

test('suggestion commits, paste and drop are still blocked', function () {
  has('insertReplacementText');
  has('insertFromPaste');
  has('insertFromDrop');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const blocked = (type, data) => {
      const ev = new a.w.Event('beforeinput', { bubbles: true, cancelable: true });
      ev.inputType = type;
      if (data !== undefined) ev.data = data;
      inp.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    assert.equal(blocked('insertReplacementText', 'letter'), true, 'suggestion chip rejected');
    assert.equal(blocked('insertFromPaste', 'pasted'), true, 'paste rejected');
    assert.equal(blocked('insertFromDrop'), true, 'drop rejected');
    assert.equal(blocked('insertCompositionText', 'two'), true, 'multi-character commit rejected');
    const paste = new a.w.Event('paste', { bubbles: true, cancelable: true });
    inp.dispatchEvent(paste);
    assert.equal(paste.defaultPrevented, true, 'paste event rejected');
    const drop = new a.w.Event('drop', { bubbles: true, cancelable: true });
    inp.dispatchEvent(drop);
    assert.equal(drop.defaultPrevented, true, 'drop event rejected');
  } finally { a.close(); }
});

/* ------------------------------------------------ smart answer matching */

test('tyre, tire and tyre/tire all match word #26', function () {
  has('Eng.getTargetVariants=function');
  has('Eng.isAnswerMatch=function');
  has('Eng.isPrefixMatch=function');
  const a = boot();
  try {
    const Eng = a.q.Eng;
    const variants = (wObj) => Array.prototype.slice.call(Eng.getTargetVariants(wObj));
    assert.deepEqual(variants({ w: 'tyre/tire' }), ['tyre/tire', 'tyre', 'tire']);
    assert.deepEqual(variants({ w: ' Tourist   Information Centre ' }), ['tourist information centre']);
    assert.equal(Eng.isAnswerMatch('tyre', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isAnswerMatch('tire', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isAnswerMatch('tyre/tire', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isAnswerMatch('  TIRE ', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isAnswerMatch('tyres', { w: 'tyre/tire' }), false);
    assert.equal(Eng.isAnswerMatch('', { w: 'tyre/tire' }), false);
    assert.equal(Eng.isPrefixMatch('tyr', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isPrefixMatch('tir', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isPrefixMatch('xx', { w: 'tyre/tire' }), false);
    assert.equal(Eng.isPrefixMatch('', { w: 'tyre/tire' }), true);
  } finally { a.close(); }
});

/* --------------------------------------- tick, streak breakdown and diff card */

test('tick mark, false-answer streak breakdown and coral cross stay intact', function () {
  has('Eng.onTypeCorrect=function');
  has('Eng.onTypeWrong=function');
  has('id="ansTick"');
  has('id="ansWrong"');
  has('id="plTickHero"');
  has('id="plWrongHero"');
  has('id="ansCompare"');
  has('streak-broken');
  has('Streak Broken! (0)');
  has('function diffChars');
  has('UI.playTickChime');
  has('UI.playWrongTone');
  has('.ans-slots .slot-done');
  has('};/* SECTION 14 - RESULTS */');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const word = a.q.Eng.currentWord().w.split('/')[0];
    answer(a, doc, word);
    a.clock.tick(80);
    assert.equal(a.q.Eng.liveCorrectCount, 1);
    assert.equal(a.q.Eng.liveStreakCount, 1);
    assert.equal(doc.getElementById('ansTick').classList.contains('is-correct'), true, 'the emerald tick animates');
    assert.equal(doc.getElementById('plTickHero').classList.contains('is-correct'), true, 'the Correct! hero shows');
    assert.ok(doc.querySelectorAll('#ansSlots .slot-done').length > 0, 'letter slots light up');
    a.clock.tick(1200);
    answer(a, doc, 'zzzz');
    a.clock.tick(60);
    doc.getElementById('ansInput').dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    a.clock.tick(60);
    assert.equal(a.q.Eng.wordWrong, true);
    assert.equal(a.q.Eng.liveStreakCount, 0, 'the streak breaks to zero');
    assert.equal(doc.getElementById('ansWrong').classList.contains('is-wrong'), true, 'the coral cross shows');
    assert.equal(doc.getElementById('plWrongHero').classList.contains('is-wrong'), true, 'the Incorrect hero shows');
    const streak = doc.getElementById('plStreakCount');
    assert.match(streak.className, /streak-broken/);
    assert.match(streak.textContent, /Streak Broken! \(0\)/);
    const compare = doc.getElementById('ansCompare');
    assert.match(compare.className, /is-open/);
    assert.match(compare.textContent, /Correct UK spelling/);
    assert.match(compare.textContent, /Your answer/);
  } finally { a.close(); }
});

/* -------------------------------------------------------------- v18 visuals */

test('swan badge, see-through hero title, Settings-only mixer and capsules', function () {
  has('.c-swan');
  has('@keyframes swanFloat');
  has('@keyframes swanWing');
  has('@keyframes swanRipple');
  has('<span class="c-text"><small>credits goes to</small><b>Hansana</b></span>');
  has('id="homeTitle"');
  has('liquid-glass-text');
  assert.match(rule('#homeTitle,.liquid-glass-text'), /-webkit-text-stroke:1\.75px/);
  assert.match(rule('#homeTitle,.liquid-glass-text'), /color:transparent !important/);
  assert.equal(homeMarkup().indexOf('Liquid Glass'), -1, 'no "Liquid Glass" label after the title');
  assert.equal(homeMarkup().indexOf('lgStage'), -1, 'the mixer never renders on Home');
  has('id="tabInd"');
  has('.seg .thumb,.seg-tint .seg-ind');
  has('@keyframes slotWave');
  const a = boot();
  try {
    const doc = a.w.document;
    assert.ok(doc.querySelector('#credit .c-swan'), 'the swimming swan badge renders');
    assert.equal(doc.querySelector('#homeTitle').textContent, TITLE);
    assert.equal(doc.querySelector('#homeTitle').className, 'liquid-glass-text');
    a.q.Screens.settings();
    a.clock.tick(300);
    assert.ok(doc.querySelector('#screen-set #lgStage'), 'the material mixer lives in Settings');
    assert.equal(doc.querySelector('#screen-home #lgStage'), null, 'and only in Settings');
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
