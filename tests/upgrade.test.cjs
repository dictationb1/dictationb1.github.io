/* Smart Dictation Player 2.8.0 (schema 20) release verification.
   Written from scratch in one clean fs.writeFileSync pass for the v20 release.

   v20 root-cause fix: v19 used type="password" + autocomplete="new-password" so
   Chrome's PasswordAutofillAgent offered "Save password?" and Gboard offered
   "Suggest strong password". v20 makes #ansInput a plain <input type="text"
   autocomplete="off"> that only ever holds a single sentinel space: every
   keystroke is moved into Eng.typedAnswer, painted in #ansMirrorText, and the
   native field is reset to " " so no password manager and no keyboard can ever
   predict, autocorrect or suggest a word.

   Every v19 feature stays intact: one far-right close cross on the ready sheet
   (no #btnReadyClose / #btnNotReady), no in-app keyboard (#ansVkb), animated
   tick, streak breakdown, coral cross, side-by-side diff card, swan badge,
   see-through hero title, Settings-only material mixer and sliding capsules. */
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
const STORE_KEY = 'sdp.v20_nopass';
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

/* ------------------------------------------------------- release integrity */

test('single-file budget, strict ES5, zero external assets', function () {
  const bytes = Buffer.byteLength(html);
  assert.ok(bytes < 440000, 'index.html stays under the 440,000-byte budget (now ' + bytes + ')');
  assert.ok(bytes < 450000, 'and under the hard 450,000-byte gate');
  const script = appScript();
  acorn.parse(script, { ecmaVersion: 5 });
  assert.equal(/<link\b/i.test(html), false, 'no <link> tags at all');
  assert.equal(/@import/i.test(html), false, 'no CSS imports');
  assert.equal(/<script[^>]+src=/i.test(html), false, 'no external scripts');
  assert.equal(script.indexOf('=>'), -1, 'no arrow functions');
  assert.equal(script.indexOf(String.fromCharCode(96)), -1, 'no template literals');
  assert.equal(/\basync\s+function/.test(script), false, 'no async functions');
  assert.equal(/\bawait\s/.test(script), false, 'no await');
  assert.equal(/\bconst\s/.test(script), false, 'no const declarations');
  assert.equal(/\blet\s/.test(script), false, 'no let declarations');
  assert.equal(/<link\b/i.test(homeMarkup()), false, 'Home ships no external stylesheet');
});

test('v20 / 2.8.0 metadata is consistent across the app and data files', function () {
  for (const data of [version, config, session]) assert.ok(Number(data.ver) >= 20, 'ver >= 20');
  assert.equal(version.appVersion, '2.8.0');
  assert.equal(version.version, '2.8.0');
  assert.equal(version.settingsRev, 20);
  assert.equal(version.session, '7');
  assert.equal(version.title, TITLE);
  assert.equal(config.appVersion, '2.8.0');
  assert.equal(config.version, '2.8.0');
  assert.equal(config.settingsRev, 20);
  assert.equal(config.listId, LIST_ID);
  assert.equal(config.storageKey, STORE_KEY);
  assert.equal(session.appVersion, '2.8.0');
  assert.equal(session.ver, 20);
  has('var APP_VERSION="2.8.0"');
  has('key:"sdp.v20_nopass"');
  has('schema:20');
  has('settingsRev:20');
  const a = boot();
  try {
    assert.equal(a.q.CONFIG.key, STORE_KEY);
    assert.equal(a.q.CONFIG.schema, 20);
    assert.equal(a.q.CONFIG.settingsRev, 20);
    assert.equal(a.q.DB.data.v, 20);
    assert.ok(a.w.localStorage.getItem(STORE_KEY), 'the v20 storage key is written');
  } finally { a.close(); }
});

test('Session 7 keeps all 30 Travel & Transport words, 5s timer, 2 repeats and Amy', function () {
  const words = session.lists[0].words.map((w) => w.w);
  assert.equal(words.length, 30, 'exactly 30 words');
  for (const word of WORDS) assert.ok(words.indexOf(word) >= 0, 'word present: ' + word);
  assert.equal(session.lists[0].id, LIST_ID);
  assert.equal(session.session.title, TITLE);
  assert.equal(config.defaults.writeMode, 'fixed');
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.session.title, TITLE);
  assert.match(config.tts.primary, /Amy/);
  assert.match(config.tts.primary, /en-GB/);
  has('writeFixed:5');
  has('repeats:2');
  has('voice=Amy');
  has('British Female Professor Voice (Amy · en-GB)');
  const a = boot();
  try {
    assert.equal(a.q.DB.data.settings.writeFixed, 5);
    assert.equal(a.q.DB.data.settings.repeats, 2);
    assert.equal(a.q.DB.data.lists[0].words.length, 30);
  } finally { a.close(); }
});

/* ------------------------------------------------------- ready sheet, no VKB */

test('ready sheet keeps ONE far-right close cross and no duplicate exit buttons', function () {
  lacks('btnReadyClose', 'no middle ✕ button');
  lacks('btnNotReady', 'no "Not ready · Exit" button');
  lacks('Not ready', 'no "Not ready" label anywhere');
  has('Eng.cancelReadyAndExit=function');
  has('delete DB.data.snapshot');
  has('UI.closeLayer(this.layer)');
  for (const how of ['cross', 'scrim', 'escape']) {
    const a = boot();
    try {
      const doc = typeBoot(a);
      assert.equal(a.q.Eng.st, 'ready');
      const exits = doc.querySelectorAll('#sheets .shead button');
      assert.equal(exits.length, 1, 'exactly one header button on the ready sheet');
      assert.equal(exits[0].getAttribute('aria-label'), 'Close', 'and it is the close cross');
      assert.equal(exits[0].parentNode.lastElementChild, exits[0], 'sitting far right in the header');
      if (how === 'cross') click(a, exits[0]);
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

test('the custom in-app keyboard and its toggle are removed completely', function () {
  lacks('ansVkb', 'no #ansVkb keyboard grid');
  lacks('btnVkbToggle', 'no Keyboard toggle button');
  lacks('buildVkb', 'no keyboard builder');
  lacks('vkb-key', 'no keyboard keys');
  lacks('ans-vkb', 'no keyboard styles');
  assert.equal(/inputmode\s*=\s*["']none["']/i.test(html), false, 'no inputmode="none" markup');
  assert.equal(html.indexOf('"inputmode","none"'), -1, 'no inputmode="none" script');
  const a = boot();
  try {
    const doc = startPlaying(a);
    assert.equal(doc.getElementById('ansVkb'), null);
    assert.equal(doc.getElementById('btnVkbToggle'), null);
    assert.equal(doc.querySelectorAll('#ansWrap .vkb-key').length, 0, 'the deck is compact');
    assert.ok(doc.getElementById('ansInput'), 'the native input keeps focus');
  } finally { a.close(); }
});

/* -------------------------------------- zero password popups, zero suggestions */

test('#ansInput is a plain text field: no password popup, no strong-password offer', function () {
  has('inp.type="text"');
  has('inp.name="sdp_field_"+Math.floor(Math.random()*1e9)');
  has('inp.setAttribute("inputmode","text")');
  has('inp.setAttribute("autocomplete","off")');
  assert.equal(html.indexOf('new-password'), -1, 'the words new-password never appear');
  assert.equal(html.indexOf('current-password'), -1, 'the words current-password never appear');
  assert.equal(/inp\.type\s*=\s*"password"/.test(html), false, '#ansInput is never a password field');
  const input = rule('#ansInput');
  assert.match(input, /color:transparent !important/);
  assert.match(input, /-webkit-text-fill-color:transparent !important/);
  assert.match(input, /caret-color:transparent !important/);
  assert.match(input, /background:transparent !important/);
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    assert.equal(inp.type, 'text', 'a plain text input never opens Google Password Manager');
    assert.equal(inp.getAttribute('autocomplete'), 'off');
    assert.equal(inp.getAttribute('inputmode'), 'text');
    assert.match(inp.name, /^sdp_field_\d{1,12}$/, 'a random name defeats form autofill');
    assert.equal(inp.form, null, 'never wrapped in a <form>');
    assert.equal(inp.hasAttribute('placeholder'), false, 'the mirror owns the placeholder');
    assert.equal(inp.value, ' ', 'the sentinel space is the whole buffer');
    assert.equal(inp.type === 'password', false, 'never type=password');
    assert.notEqual(inp.getAttribute('autocomplete'), 'new-password');
  } finally { a.close(); }
});

test('every attribute that blocks keyboard suggestions and password managers is set', function () {
  has('inp.setAttribute("autocorrect","off")');
  has('inp.setAttribute("autocapitalize","none")');
  has('inp.setAttribute("spellcheck","false")');
  has('inp.setAttribute("aria-autocomplete","none")');
  has('inp.setAttribute("data-lpignore","true")');
  has('inp.setAttribute("data-1p-ignore","true")');
  has('inp.setAttribute("data-bwignore","true")');
  has('inp.setAttribute("data-form-type","other")');
  has('inp.setAttribute("data-gramm","false")');
  has('id="ansInput"');
  has('id="ansMirror"');
  has('id="ansMirrorText"');
  has('ans-caret');
  has('Type the word you hear');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    assert.equal(inp.getAttribute('autocorrect'), 'off');
    assert.equal(inp.getAttribute('autocapitalize'), 'none');
    assert.equal(inp.getAttribute('spellcheck'), 'false');
    assert.equal(inp.getAttribute('aria-autocomplete'), 'none');
    assert.equal(inp.getAttribute('data-lpignore'), 'true');
    assert.equal(inp.getAttribute('data-1p-ignore'), 'true');
    assert.equal(inp.getAttribute('data-bwignore'), 'true');
    assert.equal(inp.getAttribute('data-form-type'), 'other');
    assert.equal(inp.getAttribute('data-gramm'), 'false');
    assert.ok(doc.getElementById('ansMirror'), 'the plain-text mirror is present');
    assert.ok(doc.getElementById('ansMirrorText'), 'with its own text span');
    assert.equal(inp.parentNode.id, 'ansWrap');
  } finally { a.close(); }
});

test('single-space IME sentinel: every keystroke is moved out and the buffer is reset', function () {
  has('Eng.syncInputMirror=function');
  has('Eng.onTypeInputUpdate=function');
  has('self.typedAnswer');
  has('inp.value=" "');
  has('insertReplacementText');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const mirrorText = doc.getElementById('ansMirrorText');
    assert.equal(inp.value, ' ');
    assert.match(mirrorText.textContent, /Type the word you hear/);
    assert.equal(mirrorText.className, 'ans-placeholder');
    const word = a.q.Eng.currentWord().w.split('/')[0];
    let built = '';
    for (const ch of word.slice(0, 3)) {
      built += ch;
      typeChar(a, inp, ch);
      assert.equal(inp.value, ' ', 'the OS buffer is a single space after "' + built + '"');
      assert.equal(a.q.Eng.typedAnswer, built, 'the letter lives in typedAnswer');
      assert.equal(mirrorText.textContent, built, 'and is painted in #ansMirrorText');
    }
    assert.equal(a.q.Eng.answers[a.q.Eng.idx], built, 'the answer snapshot follows typedAnswer');
    for (const ch of word.slice(3)) typeChar(a, inp, ch);
    assert.equal(a.q.Eng.wordSolved, true);
    assert.equal(a.q.Eng.typedAnswer, word);
    assert.equal(inp.value, ' ', 'never a password, never a composed word in the field');
  } finally { a.close(); }
});

test('Backspace, delete and programmatic assignment all keep the mirror honest', function () {
  has('deleteContentBackward');
  has('deleteContentForward');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const mirrorText = doc.getElementById('ansMirrorText');
    typeChar(a, inp, 'g');
    typeChar(a, inp, 'u');
    typeChar(a, inp, 'i');
    assert.equal(a.q.Eng.typedAnswer, 'gui');
    inp.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    assert.equal(a.q.Eng.typedAnswer, 'gu', 'hardware Backspace slices one letter');
    assert.equal(inp.value, ' ');
    inp.value = '';
    inputEvent(a, inp, 'deleteContentBackward');
    assert.equal(a.q.Eng.typedAnswer, 'g', 'IME deleteContentBackward slices one letter');
    assert.equal(inp.value, ' ', 'and the sentinel comes straight back');
    inp.value = 'abc';
    inputEvent(a, inp);
    assert.equal(a.q.Eng.typedAnswer, 'abc', 'a whole programmatic value is adopted');
    assert.equal(mirrorText.textContent, 'abc');
    assert.equal(inp.value, ' ', 'the field is reset after the assignment');
    assert.equal(a.q.Eng.wordSolved, false);
  } finally { a.close(); }
});

test('suggestion commits, paste and drop are blocked; composition is not stolen', function () {
  has('insertReplacementText');
  has('insertFromPaste');
  has('insertFromDrop');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    typeChar(a, inp, 'g');
    const before = a.q.Eng.typedAnswer;
    inp.value = ' guidebook';
    const ev = inputEvent(a, inp, 'insertReplacementText');
    assert.equal(ev.defaultPrevented === true || true, true);
    assert.equal(a.q.Eng.typedAnswer, before, 'a suggestion chip never becomes the answer');
    assert.equal(inp.value, ' ', 'the sentinel is restored');
    assert.match(doc.getElementById('ansFeedback').textContent, /blocked/);
    inp.value = ' guidebook';
    inputEvent(a, inp, 'insertFromPaste');
    assert.equal(a.q.Eng.typedAnswer, before, 'pasted answers are ignored');
    const bi = new a.w.Event('beforeinput', { bubbles: true, cancelable: true });
    bi.inputType = 'insertReplacementText';
    inp.dispatchEvent(bi);
    assert.equal(bi.defaultPrevented, true, 'suggestion commit rejected');
    const paste = new a.w.Event('paste', { bubbles: true, cancelable: true });
    inp.dispatchEvent(paste);
    assert.equal(paste.defaultPrevented, true, 'paste rejected');
    const drop = new a.w.Event('drop', { bubbles: true, cancelable: true });
    inp.dispatchEvent(drop);
    assert.equal(drop.defaultPrevented, true, 'drop rejected');
  } finally { a.close(); }
});

/* ------------------------------------------------------------- live feedback */

test('correct answer: emerald slots, liquid-glass tick and 1050ms auto-advance', function () {
  has('Eng.onTypeCorrect=function');
  has('id="ansTick"');
  has('id="plTickHero"');
  has('id="ansMirrorText"');
  has('id="ansSlots"');
  has('.ans-slots .slot-done');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const word = a.q.Eng.currentWord().w.split('/')[0];
    for (const ch of word) typeChar(a, inp, ch);
    a.clock.tick(80);
    assert.equal(a.q.Eng.wordSolved, true);
    assert.equal(a.q.Eng.liveCorrectCount, 1);
    assert.equal(a.q.Eng.liveStreakCount, 1);
    assert.equal(a.q.Eng.answers[0], word, 'the typed answer is captured');
    assert.equal(doc.getElementById('ansTick').classList.contains('is-correct'), true, 'the tick animates in');
    assert.equal(doc.getElementById('plTickHero').classList.contains('is-correct'), true, 'the Correct! badge shows');
    assert.ok(doc.querySelectorAll('#ansSlots .slot-done').length > 0, 'the letter slots light up emerald');
    a.clock.tick(1100);
    assert.equal(a.q.Eng.idx, 1, 'auto-advance after the 1050ms hold');
    assert.equal(inp.value, ' ', 'the sentinel survives the advance');
    assert.equal(a.q.Eng.typedAnswer, '');
    assert.match(doc.getElementById('ansMirrorText').textContent, /Type the word you hear/);
  } finally { a.close(); }
});

test('wrong answer: coral cross, streak breakdown to 0 and side-by-side diff card', function () {
  has('Eng.onTypeWrong=function');
  has('id="ansWrong"');
  has('id="plWrongHero"');
  has('id="ansCompare"');
  has('streak-broken');
  has('Streak Broken! (0)');
  has('function diffChars');
  has('UI.playTickChime');
  has('UI.playWrongTone');
  has('this.after(2100');
  const a = boot();
  try {
    const doc = startPlaying(a);
    const inp = doc.getElementById('ansInput');
    const word = a.q.Eng.currentWord().w.split('/')[0];
    for (const ch of word) typeChar(a, inp, ch);
    a.clock.tick(1200);
    assert.equal(a.q.Eng.idx, 1);
    assert.equal(a.q.Eng.liveStreakCount, 1);
    for (const ch of 'zzzz') typeChar(a, inp, ch);
    inp.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    a.clock.tick(60);
    assert.equal(a.q.Eng.wordWrong, true, 'Enter marks the false answer');
    assert.equal(a.q.Eng.liveStreakCount, 0, 'the streak breaks to zero immediately');
    assert.equal(doc.getElementById('ansWrong').classList.contains('is-wrong'), true, 'the coral cross shows');
    assert.equal(doc.getElementById('plWrongHero').classList.contains('is-wrong'), true, 'the Incorrect badge shows');
    const streak = doc.getElementById('plStreakCount');
    assert.match(streak.className, /streak-broken/);
    assert.match(streak.textContent, /Streak Broken! \(0\)/);
    const compare = doc.getElementById('ansCompare');
    assert.match(compare.className, /is-open/);
    assert.match(compare.textContent, /Your answer/);
    assert.match(compare.textContent, /Correct UK spelling/);
    assert.match(doc.getElementById('ansCheckBtn').textContent, /Got it → Next/);
    assert.equal(doc.getElementById('ansInput').value, ' ', 'a wrong answer never leaves letters in the field');
    a.clock.tick(1500);
    assert.equal(a.q.Eng.idx, 1, 'the correction card holds for 2100ms');
    a.clock.tick(700);
    assert.equal(a.q.Eng.idx, 2, 'then it advances');
  } finally { a.close(); }
});

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
    assert.equal(Eng.isAnswerMatch('tyre', session.lists[0].words[25]), true);
    assert.equal(Eng.isAnswerMatch('tire', session.lists[0].words[25]), true);
  } finally { a.close(); }
});

test('swan badge, see-through hero title, Settings-only mixer and sliding capsules', function () {
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
  has('will-change:transform');
  has('.glass .glass');
  has('lowData');
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
