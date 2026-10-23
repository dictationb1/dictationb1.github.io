/* Smart Dictation Player 2.5.0 (schema 17) release verification.
   Regenerated from scratch with fs.writeFileSync for this release: the complete
   "Type my answers" experience with the animated Liquid Glass tick mark, live
   letter slots, streak pill and smart timer assist, on top of every v16 upgrade
   (swan badge, see-through title, Settings mixer, sliding capsules, 60 FPS). */
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
const tests = [];

function test(name, fn) { tests.push({ name, fn }); }
function boot() { return harness(); }
function fire(a, el, type) {
  el.dispatchEvent(new a.w.Event(type, { bubbles: true, cancelable: true }));
}
function enter(a, el) {
  el.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
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
  return a.w.document;
}

/* ------------------------------------------------------- release integrity */

test('single-file budget, strict ES5 and zero external assets', function () {
  assert.ok(Buffer.byteLength(html) < 450000, 'under the 450,000-byte gate');
  assert.ok(Buffer.byteLength(html) < 442000, 'under the 442,000-byte target');
  const script = appScript();
  acorn.parse(script, { ecmaVersion: 5 });
  assert.equal(/<link\b/i.test(html), false, 'no <link> tags at all');
  assert.equal(/@import/i.test(html), false, 'no CSS imports');
  assert.equal(/<script[^>]+src=/i.test(html), false, 'no external scripts');
  assert.equal(script.indexOf('=>'), -1, 'no arrow functions');
  assert.equal(script.indexOf(String.fromCharCode(96)), -1, 'no template literals');
  assert.equal(/\basync\s+function/.test(script), false, 'no async functions');
});

test('v17 / 2.5.0 metadata is consistent across the app and data files', function () {
  for (const data of [version, config, session]) assert.ok(Number(data.ver) >= 17, 'ver >= 17');
  assert.equal(version.appVersion, '2.5.0');
  assert.equal(version.version, '2.5.0');
  assert.equal(version.settingsRev, 17);
  assert.equal(version.session, '7');
  assert.equal(version.title, TITLE);
  assert.equal(version.buildDate, '2026-10-23');
  assert.equal(config.appVersion, '2.5.0');
  assert.equal(config.settingsRev, 17);
  assert.equal(config.listId, LIST_ID);
  assert.equal(session.appVersion, '2.5.0');
  has('var APP_VERSION="2.5.0"');
  has('key:"sdp.v17_type_tick"');
  const a = boot();
  try {
    assert.equal(a.q.CONFIG.key, 'sdp.v17_type_tick');
    assert.equal(a.q.CONFIG.schema, 17);
    assert.equal(a.q.CONFIG.settingsRev, 17);
    assert.equal(a.w.SDP.version, '2.5.0');
    assert.ok(a.w.document.body.getAttribute('data-perf'));
  } finally { a.close(); }
});

test('Session 7 keeps all 30 Travel & Transport words, 5s timer, 2 repeats and Amy', function () {
  assert.deepEqual(session.lists[0].words.map((w) => w.w), WORDS);
  assert.equal(session.session.title, TITLE);
  assert.equal(session.session.no, '7');
  assert.equal(session.session.day, 'Thursday');
  assert.equal(session.session.date, '2026-10-22');
  assert.equal(session.lists[0].id, LIST_ID);
  assert.equal(session.lists[0].published, true);
  for (const w of session.lists[0].words) {
    assert.ok(w.m && w.m.length > 10, w.w + ' meaning');
    assert.ok(w.s && w.s.length > 10, w.w + ' sentence');
    assert.match(w.audio || '', /^https:\/\/.+\.mp3$/i);
  }
  const a = boot();
  try {
    const list = a.q.Lib.current();
    assert.equal(list.words.length, 30);
    assert.equal(list.words[0].w, 'guidebook');
    assert.equal(list.words[29].w, 'windscreen');
    assert.equal(a.q.DB.data.settings.writeFixed, 5);
    assert.equal(a.q.DB.data.settings.repeats, 2);
    assert.equal(config.defaults.writeFixed, 5);
    assert.equal(config.defaults.repeats, 2);
    assert.match(config.tts.primary, /Amy/);
    assert.match(config.tts.primary, /en-GB/);
  } finally { a.close(); }
});

/* --------------------------------------------- v17 type mode: smart matcher */

test('getTargetVariants and isAnswerMatch accept every spelling of tyre/tire', function () {
  has('Eng.getTargetVariants=function');
  has('Eng.isAnswerMatch=function');
  const a = boot();
  try {
    const Eng = a.q.Eng;
    const variants = (wObj) => Array.prototype.slice.call(Eng.getTargetVariants(wObj));
    assert.deepEqual(variants({ w: 'tyre/tire' }), ['tyre/tire', 'tyre', 'tire']);
    assert.deepEqual(variants({ w: ' Tourist   Information Centre ' }), ['tourist information centre']);
    assert.deepEqual(variants({ w: 'public transport' }), ['public transport']);
    assert.equal(Eng.isAnswerMatch('tyre', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isAnswerMatch('tire', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isAnswerMatch('tyre/tire', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isAnswerMatch('  Tyre ', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isAnswerMatch('TIRE', { w: 'tyre/tire' }), true);
    assert.equal(Eng.isAnswerMatch('tyres', { w: 'tyre/tire' }), false);
    assert.equal(Eng.isAnswerMatch('', { w: 'tyre/tire' }), false);
    assert.equal(Eng.isAnswerMatch('tourist information centre', { w: 'tourist information centre' }), true);
    assert.equal(Eng.isAnswerMatch('tourist information center', { w: 'tourist information centre' }), false);
  } finally { a.close(); }
});

/* ------------------------------------------- v17 type mode: Liquid Glass UI */

test('Type mode builds the Liquid Glass answer deck with pill, slots, tick and check button', function () {
  has('Eng.onTypeCorrect=function');
  has('playTickChime:function');
  has('UI.playTickChime();');
  has('tick.id="ansTick"');
  has('hero.id="plTickHero"');
  has('slots.id="ansSlots"');
  has('pill.id="plLiveScore"');
  has('checkBtn.id="ansCheckBtn"');
  has('feedback.id="ansFeedback"');
  has('ans-input-wrap');
  has('is-correct');
  has('@keyframes tickPulse');
  has('slot-done');
  assert.match(rule('.ans-input-wrap'), /border-radius:999px/);
  assert.match(rule('.ans-input-wrap'), /transition:box-shadow \.4s cubic-bezier\(\.2,\.9,\.25,1\.35\)/);
  assert.match(rule('.ans-input-wrap.is-correct'), /inset 0 0 0 2px #39d4b8/);
  assert.match(rule('.ans-input-wrap.is-correct'), /transform:scale\(1\.02\)/);
  assert.match(rule('.ans-tick'), /opacity:0/);
  assert.match(rule('.ans-tick'), /transform:scale\(\.3\) rotate\(-25deg\)/);
  assert.match(rule('.ans-tick.is-correct'), /opacity:1/);
  assert.match(rule('.ans-tick .tick-bg'), /fill:url\(#dgC\)/);
  assert.match(rule('.ans-tick .tick-check'), /stroke-dasharray:28/);
  assert.match(rule('.ans-tick.is-correct .tick-check'), /stroke-dashoffset:0/);
  assert.match(rule('.pl-tick-hero'), /opacity:0/);
  assert.match(rule('.pl-tick-hero.is-correct'), /opacity:1/);
  assert.equal(rule('.pl-tick-hero svg'), '.pl-tick-hero svg {width:24px;height:24px;}');
  assert.match(rule('.pl-tick-hero .hero-tick-circle'), /fill:#39d4b8/);
  assert.match(rule('.pl-tick-hero.is-correct .hero-tick-path'), /stroke-dashoffset:0/);
  assert.ok(html.indexOf('id="dgC"') >= 0, 'the tick gradient is defined');
  const a = boot();
  try {
    const doc = typeBoot(a);
    const deck = doc.querySelector('.ans-deck.glass');
    assert.ok(deck, 'the deck is a glass container');
    const pill = doc.getElementById('plLiveScore');
    assert.ok(pill.classList.contains('ans-score-pill'));
    assert.equal(doc.getElementById('plCorrectCount').textContent, '\u2713 0 Correct');
    assert.equal(doc.getElementById('plStreakCount').textContent, '\ud83d\udd25 0 Streak');
    const slots = doc.getElementById('ansSlots');
    assert.ok(slots.classList.contains('ans-slots'));
    assert.equal(slots.querySelectorAll('.ans-hint-chip').length, 1);
    assert.equal(slots.querySelector('.ans-hint-chip').textContent, '9 letters');
    assert.equal(slots.querySelectorAll('.slot').length, 9, 'guidebook has nine slots');
    const wrap = doc.getElementById('ansWrap');
    assert.ok(wrap.classList.contains('ans-input-wrap'));
    const inp = doc.getElementById('ansInput');
    assert.ok(inp.classList.contains('ansinput'));
    assert.equal(inp.placeholder, 'Type the word you hear\u2026');
    assert.equal(wrap.contains(inp), true);
    const tick = doc.getElementById('ansTick');
    assert.ok(tick.classList.contains('ans-tick'));
    assert.ok(tick.querySelector('.tick-ring'));
    assert.ok(tick.querySelector('svg .tick-bg'));
    assert.equal(tick.querySelector('svg .tick-check').getAttribute('d'), 'M10.5 18.5L15.8 23.8L25.8 13.2');
    assert.equal(wrap.contains(tick), true);
    const chk = doc.getElementById('ansCheckBtn');
    assert.equal(chk.textContent, 'Check \u2713');
    assert.equal(wrap.contains(chk), true);
    const fb = doc.getElementById('ansFeedback');
    assert.ok(fb);
    assert.equal(fb.getAttribute('role'), 'status');
    const hero = doc.querySelector('.wordcard #plTickHero.pl-tick-hero');
    assert.ok(hero, 'the hero tick lives on the word card');
    assert.ok(hero.querySelector('svg .hero-tick-circle'));
    assert.equal(hero.querySelector('svg .hero-tick-path').getAttribute('d'), 'M16.5 28.8L24.5 36.8L39.8 20.5');
    assert.match(hero.textContent, /Correct!/);
  } finally { a.close(); }
});

test('letter slots light up aqua for hits, amber for misses and show the word gap', function () {
  const a = boot();
  try {
    const doc = typeBoot(a);
    const inp = doc.getElementById('ansInput');
    inp.value = 'gu';
    fire(a, inp, 'input');
    let slots = doc.querySelectorAll('#ansSlots .slot');
    assert.equal(slots.length, 9);
    assert.equal(slots[0].className, 'slot slot-ok');
    assert.equal(slots[0].textContent, 'g');
    assert.equal(slots[1].className, 'slot slot-ok');
    assert.equal(slots[2].className, 'slot');
    inp.value = 'gx';
    fire(a, inp, 'input');
    slots = doc.querySelectorAll('#ansSlots .slot');
    assert.equal(slots[1].className, 'slot slot-err');
    assert.equal(slots[1].textContent, 'x');
    a.q.Eng.runItem(15);
    const chip = doc.querySelector('#ansSlots .ans-hint-chip');
    assert.equal(chip.textContent, '2 words \u00b7 16 letters');
    assert.equal(doc.querySelectorAll('#ansSlots .slot').length, 15);
    assert.equal(doc.querySelectorAll('#ansSlots .slot-gap').length, 1, 'a visual gap splits the words');
  } finally { a.close(); }
});

test('a correct answer pops the animated tick, chimes, scores the streak and auto-advances', function () {
  const a = boot();
  try {
    let started = 0;
    a.w.AudioContext = function () {
      this.currentTime = 0;
      this.destination = {};
      this.resume = function () {};
      this.createOscillator = function () {
        return { type: '', frequency: { value: 0 }, connect: function () {}, start: function () { started++; }, stop: function () {} };
      };
      this.createGain = function () {
        return { gain: { setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} }, connect: function () {} };
      };
    };
    const doc = typeBoot(a);
    const inp = doc.getElementById('ansInput');
    a.q.Eng.runItem(25);
    assert.equal(a.q.Eng.currentWord().w, 'tyre/tire');
    inp.value = 'tire';
    fire(a, inp, 'input');
    const Eng = a.q.Eng;
    assert.equal(Eng.wordSolved, true);
    assert.equal(Eng.answers[25], 'tire');
    assert.equal(Eng.liveCorrectCount, 1);
    assert.equal(Eng.liveStreakCount, 1);
    assert.equal(doc.getElementById('ansWrap').className, 'ans-input-wrap is-correct');
    assert.ok(doc.querySelector('.wordcard').classList.contains('is-correct'));
    assert.equal(doc.getElementById('ansTick').className, 'ans-tick is-correct');
    assert.equal(doc.getElementById('plTickHero').className, 'pl-tick-hero is-correct');
    assert.equal(doc.getElementById('plWord').textContent, 'tyre/tire');
    assert.ok(doc.getElementById('plWord').classList.contains('solved-glow'));
    assert.ok(doc.getElementById('plHint').textContent.length > 5, 'IPA and meaning are revealed');
    assert.equal(doc.getElementById('ansFeedback').textContent, '\u2713 Correct! Spot on!');
    assert.equal(doc.getElementById('plCorrectCount').textContent, '\u2713 1 Correct');
    assert.equal(doc.getElementById('plStreakCount').textContent, '\ud83d\udd25 1 Streak');
    assert.equal(doc.getElementById('ansCheckBtn').textContent, 'Next \u2192');
    const done = doc.querySelectorAll('#ansSlots .slot-done');
    assert.equal(done.length, 4, 'the primary UK spelling tyre has four slots');
    assert.equal(done[1].style.animationDelay, '45ms', 'the wave pop is staggered');
    assert.equal(started, 3, 'playTickChime rings a three-note crystal chime');
    a.clock.tick(1050);
    assert.equal(Eng.idx, 26, 'the player auto-advances after the tick animation');
    assert.equal(Eng.wordSolved, false);
    assert.equal(doc.getElementById('ansWrap').className, 'ans-input-wrap');
    assert.equal(doc.getElementById('ansTick').className, 'ans-tick');
    assert.equal(doc.getElementById('plTickHero').className, 'pl-tick-hero');
    assert.equal(doc.getElementById('ansCheckBtn').textContent, 'Check \u2713');
    assert.equal(doc.getElementById('ansFeedback').textContent, '');
  } finally { a.close(); }
});

test('Sinhala students get the Sinhala celebration', function () {
  const a = boot();
  try {
    const doc = typeBoot(a);
    a.q.DB.data.settings.lang = 'si';
    const inp = doc.getElementById('ansInput');
    inp.value = 'guidebook';
    fire(a, inp, 'input');
    assert.equal(a.q.Eng.wordSolved, true);
    assert.equal(doc.getElementById('ansFeedback').textContent, '\u2713 \u0db1\u0dd2\u0dc0\u0dd0\u0dbb\u0daf\u0dd2\u0dba\u0dd2!');
  } finally { a.close(); }
});

test('the 1-tap Check button submits exactly like Enter', function () {
  const a = boot();
  try {
    const doc = typeBoot(a);
    const inp = doc.getElementById('ansInput');
    inp.value = 'guidebook';
    doc.getElementById('ansCheckBtn').click();
    assert.equal(a.q.Eng.wordSolved, true);
    assert.equal(a.q.Eng.answers[0], 'guidebook');
    assert.equal(doc.getElementById('ansTick').className, 'ans-tick is-correct');
  } finally { a.close(); }
});

test('a wrong Enter shakes once with a helpful hint and the second Enter skips', function () {
  const a = boot();
  try {
    const doc = typeBoot(a);
    const inp = doc.getElementById('ansInput');
    a.q.Eng.runItem(2);
    assert.equal(a.q.Eng.currentWord().w, 'harbour');
    inp.value = 'harbor';
    fire(a, inp, 'input');
    assert.equal(a.q.Eng.wordSolved, false);
    enter(a, inp);
    assert.equal(a.q.Eng.triedWrongOnce, true);
    assert.equal(doc.getElementById('ansWrap').className, 'ans-input-wrap is-wrong');
    assert.equal(doc.getElementById('ansFeedback').textContent,
      'Keep trying \u00b7 Starts with \'ha\u2026\' (7 chars) \u2014 press Enter again to skip');
    a.clock.tick(400);
    assert.equal(doc.getElementById('ansWrap').className, 'ans-input-wrap', 'the shake clears after 400ms');
    enter(a, inp);
    assert.equal(a.q.Eng.idx, 3, 'the second Enter moves on');
    assert.equal(a.q.Eng.liveStreakCount, 0, 'and resets the streak');
    assert.equal(doc.getElementById('plStreakCount').textContent, '\ud83d\udd25 0 Streak');
    a.q.Eng.runItem(4);
    inp.value = '';
    enter(a, inp);
    assert.equal(a.q.Eng.idx, 5, 'Enter on an empty answer skips straight away');
  } finally { a.close(); }
});

test('an American spelling is answered with the UK spelling hint', function () {
  const a = boot();
  try {
    a.q.DB.data.settings.mode = 'type';
    a.q.Eng.start({ list: { name: 'US test', words: [{ w: 'colour', m: 'a hue', s: 'The colour of the bus is bright red today.' }] } });
    const doc = a.w.document;
    const inp = doc.getElementById('ansInput');
    inp.value = 'color';
    fire(a, inp, 'input');
    enter(a, inp);
    assert.equal(doc.getElementById('ansFeedback').textContent, 'American spelling \u2014 UK spelling: colour');
    assert.equal(a.q.Eng.idx, 0, 'the hint does not skip the word');
  } finally { a.close(); }
});

test('the smart typing assist bumps a low countdown back to 4 seconds', function () {
  has('countdown.bump');
  const a = boot();
  try {
    a.q.DB.data.settings.mode = 'type';
    a.q.DB.data.settings.advance = 'auto';
    a.q.Eng.start({});
    a.q.Eng.runItem(0);
    a.q.Eng.runId++;
    a.q.Speech.supported = true;
    a.q.Speech.textOnly = false;
    a.q.Eng.runBeat(a.q.Eng.beats.length - 1);
    assert.equal(a.q.Eng.st, 'waiting');
    assert.equal(typeof a.q.Eng.countdown.bump, 'function');
    a.clock.tick(3000);
    const doc = a.w.document;
    assert.equal(doc.getElementById('cdNum').textContent, '2');
    const inp = doc.getElementById('ansInput');
    inp.value = 'g';
    fire(a, inp, 'input');
    assert.equal(doc.getElementById('cdNum').textContent, '4', 'typing never gets cut off below 4s');
    a.clock.tick(1000);
    assert.equal(doc.getElementById('cdNum').textContent, '3', 'the countdown resumes from the bump');
  } finally { a.close(); }
});

/* --------------------------------------------------- v17 results and scoring */

test('scoreTypeMode scores tyre, tire and tyre/tire all as ok', function () {
  const a = boot();
  try {
    const words = [
      { w: 'tyre/tire', m: 'a rubber ring', s: 'The tyre is new.' },
      { w: 'public transport', m: 'buses and trains', s: 'I use public transport.' },
      { w: 'visa', m: 'a travel document', s: 'My visa is ready.' }
    ];
    const res = a.q.Results.scoreTypeMode(words, [0, 1, 2], ['tire', 'public transport', '']);
    assert.equal(res.rows[0].state, 'ok');
    assert.equal(res.rows[1].state, 'ok');
    assert.equal(res.rows[2].state, 'empty');
    assert.equal(res.correct, 2);
    assert.equal(res.total, 3);
    assert.equal(a.q.Results.scoreTypeMode(words, [0], ['tyre']).rows[0].state, 'ok');
    assert.equal(a.q.Results.scoreTypeMode(words, [0], ['tyre/tire']).rows[0].state, 'ok');
    assert.equal(a.q.Results.scoreTypeMode(words, [0], ['tyres']).rows[0].state, 'wrong');
  } finally { a.close(); }
});

test('the Results review glows a tick on every ok row and offers Practise Missed Words Only', function () {
  has('row-tick');
  has('Practise Missed Words Only');
  const a = boot();
  try {
    const words = [
      { w: 'tyre/tire', m: 'a rubber ring', s: 'The tyre is new.' },
      { w: 'public transport', m: 'buses and trains', s: 'I use public transport.' },
      { w: 'visa', m: 'a travel document', s: 'My visa is ready.' }
    ];
    const order = [0, 1, 2];
    const res = a.q.Results.scoreTypeMode(words, order, ['tire', 'public transport', '']);
    const rec = {
      id: 'r17', date: '2026-10-14', ts: Date.now(), sessionNo: '7', sessionDay: 'Thursday',
      sessionDate: '2026-10-22', sessionTitle: TITLE, listName: TITLE, listId: LIST_ID,
      mode: 'type', wordCount: 3, score: 2, percent: 67, durationSec: 90,
      voiceName: 'Amy', ukVoice: true, deviceType: 'desktop', selfScored: false, rows: res.rows
    };
    a.q.Results.open(rec, words, order);
    const doc = a.w.document;
    assert.equal(doc.querySelectorAll('.row-tick').length, 2, 'one glowing tick per ok row');
    assert.ok(doc.querySelector('.row-tick .row-tick-bg'));
    assert.equal(doc.querySelector('.row-tick .row-tick-path').getAttribute('d'), 'M10.5 18.5L15.8 23.8L25.8 13.2');
    assert.ok(doc.querySelectorAll('.listrow .diff').length >= 3, 'every row keeps the character diff');
    assert.ok(doc.body.textContent.indexOf('Practise Missed Words Only') >= 0, 'the 1-tap practise button appears');
  } finally { a.close(); }
});

/* ------------------------------------------------------------- swan badge */

test('the animated swan replaces the water drop inside #credit', function () {
  has('class="c-swan"');
  has('class="swan-group"');
  has('class="swan-wing"');
  has('class="swan-ripple"');
  has('@keyframes swanFloat');
  has('@keyframes swanWing');
  has('@keyframes swanRipple');
  has('id="swanBody"');
  has('id="swanWing"');
  lacks('c-drop', 'the old water drop is gone');
  lacks('\u{1F4A7}', 'no water-drop emoji anywhere');
  assert.equal((html.match(/id="credit"/g) || []).length, 1, 'exactly one #credit');
  assert.equal((html.match(/class="c-swan"/g) || []).length, 1, 'exactly one swan');
  const credit = html.slice(html.indexOf('<div class="credit glass" id="credit"'), html.indexOf('<span class="c-text">'));
  assert.match(credit, /role="note"/);
  assert.match(credit, /aria-label="Credits go to Hansana"/);
  has('<small>credits goes to</small><b>Hansana</b>');
});

test('the floating credit and its swan animate in Full and Lite', function () {
  const swan = rule('.c-swan');
  assert.match(swan, /width:32px/);
  assert.match(swan, /height:32px/);
  assert.match(swan, /drop-shadow/);
  assert.match(rule('.c-swan .swan-group'), /animation:swanFloat 3s ease-in-out infinite !important/);
  assert.match(rule('.c-swan .swan-wing'), /animation:swanWing 2\.2s ease-in-out infinite alternate !important/);
  assert.match(rule('.c-swan .swan-ripple'), /animation:swanRipple 2\.6s ease-out infinite !important/);
  for (const sel of ['body[data-perf="lite"] .credit::after', 'body[data-perf="lite"] .credit.in .ring',
    'body[data-perf="lite"] .c-swan .swan-group', 'body[data-perf="lite"] .c-swan .swan-wing',
    'body[data-perf="lite"] .c-swan .swan-ripple']) {
    assert.match(rule(sel), /animation:[^;]+!important/, sel + ' keeps animating in Lite');
  }
  const lite = html.match(/body\[data-perf="lite"\][^{]*\{[^{}]*\}/g) || [];
  for (const block of lite) {
    assert.equal(/animation:\s*none[^;]*!important/.test(block) && /credit|c-swan/.test(block), false, 'Lite never freezes the credit');
  }
  const a = boot();
  try {
    const credit = a.w.document.getElementById('credit');
    assert.ok(credit, '#credit exists');
    assert.ok(credit.querySelector('.c-swan .swan-group'));
    assert.ok(credit.querySelector('.swan-wing'));
    assert.ok(credit.querySelector('.swan-ripple'));
    assert.equal(credit.querySelector('.c-drop'), null);
    a.clock.tick(350);
    assert.ok(credit.classList.contains('in'), 'the badge still floats in');
    a.clock.tick(5200);
    assert.ok(credit.classList.contains('out'), 'and floats back out');
    credit.click();
    assert.match(a.w.document.getElementById('toasts').textContent, /Created by Hansana/);
  } finally { a.close(); }
});

/* ------------------------------------------------------- liquid glass title */

test('#homeTitle wears the see-through Liquid Glass font with no hollow span', function () {
  const title = rule('#homeTitle,.liquid-glass-text');
  assert.match(title, /-webkit-text-stroke:1\.75px/);
  assert.match(title, /color:transparent !important/);
  assert.match(title, /-webkit-background-clip:text/);
  assert.match(title, /background-clip:text/);
  assert.match(title, /font-size:clamp\(2\.2rem,5vw,4rem\)/);
  assert.match(rule('body[data-theme="light"] #homeTitle,body[data-theme="light"] .liquid-glass-text'), /-webkit-text-stroke/);
  has('class="liquid-glass-text"');
  lacks('class="hollow"', 'the extra "Liquid Glass" words are gone');
  lacks('<span class="hollow">Liquid Glass</span>');
  assert.equal(homeMarkup().indexOf('Liquid Glass'), -1, 'the hero never repeats "Liquid Glass"');
  assert.equal(homeMarkup().indexOf('hollow'), -1, 'no hollow span in the hero');
  const a = boot();
  try {
    const el = a.w.document.getElementById('homeTitle');
    assert.equal(el.className, 'liquid-glass-text');
    assert.equal(el.textContent, TITLE);
    assert.equal(a.w.document.getElementById('homeHero').textContent.indexOf('Liquid Glass'), -1);
    const shown = a.q.Lib.current();
    const raw = a.q.DB.data.lists.filter((l) => l.id === shown.id)[0];
    raw.name = 'Travel & Transport - week 7';
    raw.publishedName = raw.name;
    a.q.Screens.home();
    assert.equal(el.textContent, 'Travel & Transport - week 7');
    assert.equal(el.className, 'liquid-glass-text');
  } finally { a.close(); }
});

/* ------------------------------------------------ material mixer in settings */

test('#lgStage lives in Settings and never in Home', function () {
  assert.equal(/<div[^>]+id="lgStage"/.test(html), false, 'the stage is built by Screens.settings(), not static markup');
  assert.equal(homeMarkup().indexOf('lgStage'), -1, 'Home markup has no stage');
  assert.equal(homeMarkup().indexOf('materialMixer'), -1, 'Home markup has no mixer');
  has('host.appendChild(UI.liquidStage())');
  has('liquidStage:function');
  has('UI.bindLiquidControls(host);');
  const a = boot();
  try {
    const doc = a.w.document;
    assert.equal(doc.querySelector('#screen-home #lgStage'), null, 'Home has no stage after boot');
    assert.equal(doc.querySelector('#screen-home #materialMixer'), null, 'Home has no mixer');
    a.q.Screens.home();
    assert.equal(doc.querySelector('#screen-home #lgStage'), null, 'Home stays clean after a re-render');
    a.q.UI.setTab('set');
    const set = doc.getElementById('screen-set');
    const stage = set.querySelector('#lgStage');
    assert.ok(stage, 'Settings hosts the stage');
    assert.equal(set.querySelector('#setBody').firstElementChild, stage, 'the stage is first in Settings');
    assert.ok(stage.classList.contains('stage'));
    assert.equal(stage.querySelectorAll('.bubble').length, 4);
    assert.ok(stage.querySelector('#orb'));
    assert.ok(stage.querySelector('#materialMixer.glass.panel'));
    assert.match(stage.querySelector('#materialMixer').textContent, /Liquid Glass/);
    assert.match(stage.textContent, /Material Mixer/);
    assert.ok(stage.querySelector('#sBlur') && stage.querySelector('#sSat') && stage.querySelector('#sBrt'));
    assert.equal(stage.querySelectorAll('#segTint button').length, 3);
    assert.equal(stage.querySelectorAll('#segTint .seg-ind').length, 1);
    assert.equal(stage.querySelectorAll('#segPerf button').length, 3);
    assert.equal(stage.querySelectorAll('#segPerf .thumb').length, 1);
    assert.match(stage.querySelector('.chip-a').textContent, /\u{1F9A2} Liquid Glass: Live/u);
    assert.match(stage.querySelector('.chip-b').textContent, /Amy UK Voice/);
    assert.equal(doc.querySelectorAll('#lgStage').length, 1, 'exactly one stage in the document');
  } finally { a.close(); }
});

test('every Settings mixer control is live and persists', function () {
  const a = boot();
  try {
    const doc = a.w.document;
    a.q.UI.setTab('set');
    const blur = doc.getElementById('sBlur');
    blur.value = '26';
    fire(a, blur, 'input');
    assert.equal(doc.documentElement.style.getPropertyValue('--gb'), '26px');
    assert.equal(a.q.DB.data.settings.glassBlur, 26);
    const sat = doc.getElementById('sSat');
    sat.value = '210';
    fire(a, sat, 'input');
    assert.equal(doc.documentElement.style.getPropertyValue('--gs'), '2.10');
    assert.equal(doc.getElementById('outSat').textContent, '2.1\u00d7');
    const brt = doc.getElementById('sBrt');
    brt.value = '111';
    fire(a, brt, 'input');
    assert.equal(doc.documentElement.style.getPropertyValue('--gbr'), '1.11');

    doc.querySelector('#segTint [data-tint="1"]').click();
    assert.ok(doc.body.classList.contains('tint-frost'));
    assert.equal(doc.querySelector('#segTint .seg-ind').style.transform, 'translate3d(100%, 0, 0)');
    assert.equal(a.q.DB.data.settings.glassTint, 1);
    doc.querySelector('#segTint [data-tint="2"]').click();
    assert.ok(doc.body.classList.contains('tint-smoke'));
    assert.equal(doc.querySelector('#segTint .seg-ind').style.transform, 'translate3d(200%, 0, 0)');
    doc.querySelector('#segTint [data-tint="0"]').click();
    assert.ok(doc.body.classList.contains('tint-clear'));

    doc.querySelector('#segPerf [data-perf="lite"]').click();
    assert.equal(doc.body.getAttribute('data-perf'), 'lite');
    assert.equal(a.q.DB.data.settings.perf, 'lite');
    assert.match(doc.getElementById('perfStatus').textContent, /Lite/);
    doc.querySelector('#segPerf [data-perf="full"]').click();
    assert.equal(doc.body.getAttribute('data-perf'), 'full');

    a.q.DB.data.settings.glassBlur = 31;
    a.q.DB.data.settings.glassSat = 190;
    a.q.DB.data.settings.glassBrt = 107;
    a.q.DB.data.settings.glassTint = 2;
    a.q.UI.applyGlassSettings();
    assert.equal(doc.documentElement.style.getPropertyValue('--gb'), '31px');
    assert.equal(doc.documentElement.style.getPropertyValue('--gs'), '1.90');
    assert.equal(doc.documentElement.style.getPropertyValue('--gbr'), '1.07');
    assert.ok(doc.body.classList.contains('tint-smoke'));
    has('UI.applyGlassSettings();');
    a.q.Screens.settings();
    assert.equal(doc.getElementById('sBlur').value, '31', 'a re-render restores the saved blur');
    assert.equal(doc.getElementById('sSat').value, '190');
  } finally { a.close(); }
});

test('the orb drags, snaps to keys and stays inside the Settings stage', function () {
  const a = boot();
  try {
    const doc = a.w.document;
    a.q.UI.setTab('set');
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
    orb.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.ok(parseFloat(orb.style.left) >= 0 && parseFloat(orb.style.left) <= 360);
    assert.equal(orb.getAttribute('tabindex'), '0');
    assert.match(orb.getAttribute('aria-label'), /Glowing orb/);
  } finally { a.close(); }
});

/* ------------------------------------------------------- sliding capsules */

test('the dock capsule glides with one translate3d layer', function () {
  const capsule = rule('#tabInd,.tab-ind');
  assert.match(capsule, /transform \.48s cubic-bezier\(\.2,\.9,\.25,1\.35\)/);
  assert.match(capsule, /!important/);
  assert.match(capsule, /will-change:transform/);
  assert.equal((html.match(/id="tabInd"/g) || []).length, 1);
  has('class="tab-ind" id="tabInd"');
  const a = boot();
  try {
    const doc = a.w.document, ind = doc.getElementById('tabInd');
    const buttons = Array.from(doc.querySelectorAll('#tabbar button[data-tab]'));
    a.q.UI.setTab('comm');
    assert.equal(ind.style.transform, 'translate3d(300%, 0, 0)');
    assert.equal(buttons.length, 5);
    a.q.UI.setTab('set');
    assert.equal(ind.style.transform, 'translate3d(400%, 0, 0)');
    a.q.UI.setTab('home');
    assert.equal(ind.style.transform, 'translate3d(0%, 0, 0)');
    assert.equal(doc.querySelectorAll('#tabbar button[data-tab]').length, 5, 'the dock is never rebuilt');
  } finally { a.close(); }
});

test('every .seg and tint capsule slides without rebuilding its bar', function () {
  const thumb = rule('.seg .thumb,.seg-tint .seg-ind');
  assert.match(thumb, /transform \.48s cubic-bezier\(\.2,\.9,\.25,1\.35\)/);
  assert.match(thumb, /box-shadow:inset 0 1\.5px 0 rgba\(255,255,255,\.65\),inset 0 0 0 1\.5px rgba\(155,180,255,\.52\)/);
  assert.match(thumb, /!important/);
  has('segSync:function');
  has('seg-tint');
  has('seg-ind');
  const a = boot();
  try {
    const doc = a.w.document;
    const seg = doc.getElementById('segMode');
    assert.equal(seg.querySelectorAll('button').length, 2);
    seg.querySelector('[data-mode="type"]').click();
    assert.equal(doc.getElementById('segMode'), seg, 'the seg is not recreated on click');
    assert.equal(seg.querySelector('[data-mode="type"]').getAttribute('aria-selected'), 'true');
    assert.match(seg.querySelector('.thumb').style.transform, /^translate3d\(/);
    assert.equal(a.q.DB.data.settings.mode, 'type', 'the mode pill drives "Type my answers"');
    a.q.UI.setTab('set');
    const tint = doc.getElementById('segTint');
    tint.querySelector('[data-tint="2"]').click();
    assert.equal(doc.getElementById('segTint'), tint, 'the tint capsule is not recreated');
    assert.match(tint.querySelector('.seg-ind').style.transform, /^translate3d\(200%/);
    assert.equal(doc.querySelectorAll('#tabbar .tab-ind').length, 1);
  } finally { a.close(); }
});

/* --------------------------------------------------------- 60 FPS engine */

test('nested glass is flattened, chrome is promoted and blobs are pre-blurred', function () {
  const flat = rule('.glass .glass,.tile .glass,.glass .tile');
  assert.match(flat, /backdrop-filter:none !important/);
  const layers = rule('.topbar.glass,#tabbar.glass,#credit.glass');
  assert.match(layers, /backface-visibility:hidden/);
  assert.match(layers, /-webkit-backface-visibility:hidden/);
  assert.match(rule('#grain'), /display:none !important/);
  has('.blob {filter:none !important;}');
  assert.match(rule('.blob'), /radial-gradient\(circle,var\(--blob-color\) 0%,transparent 70%\)/);
  assert.equal(html.indexOf('filter: blur(85px)'), -1, 'no 85px blob blur');
  const lite = rule('body[data-perf="lite"]');
  assert.match(lite, /--gb:8px/);
  const a = boot();
  try {
    assert.equal(a.w.document.querySelectorAll('#bg .blob').length, 4);
    a.q.UI.setPerf('lite');
    assert.equal(a.w.document.body.getAttribute('data-perf'), 'lite');
    assert.ok(a.w.document.getElementById('credit').querySelector('.c-swan'));
    a.q.UI.setPerf('full');
    assert.equal(a.w.document.body.getAttribute('data-perf'), 'full');
  } finally { a.close(); }
});

/* ------------------------------------------------------------- data path */

test('DictAPI answers all 30 words from memory with zero requests', function () {
  const a = boot();
  try {
    let fetches = 0;
    a.w.fetch = function () { fetches++; return Promise.reject(new Error('offline')); };
    assert.equal(a.q.DictAPI, a.q.Dict);
    for (const word of WORDS) {
      let result = null;
      const returned = a.q.DictAPI.lookup(word, (entry) => { result = entry; });
      assert.equal(returned, result, 'embedded lookup is synchronous');
      assert.ok(result && result.embedded, word);
      assert.ok(result.phon.length > 2, word + ' phon');
      assert.ok(result.def.length > 8, word + ' def');
      assert.ok(result.ex.length > 15, word + ' ex');
    }
    assert.equal(fetches, 0, 'no network request for Session 7 words');
  } finally { a.close(); }
});

test('the shared #sdpAudio element replays from currentTime 0 on Repeat #2', function () {
  const a = boot();
  try {
    const doc = a.w.document, speech = a.q.Speech;
    assert.equal(doc.querySelectorAll('#sdpAudio').length, 1);
    const audio = doc.getElementById('sdpAudio');
    assert.equal(audio.getAttribute('preload'), 'none');
    const first = speech.streamSources('guidebook');
    assert.match(first[0], /voice=Amy/);
    assert.match(first[1], /tl=en-GB/);
    let srcSets = 0, plays = 0;
    audio.currentTime = 7;
    Object.defineProperty(audio, 'canPlayType', { configurable: true, value: () => 'probably' });
    Object.defineProperty(audio, 'readyState', { configurable: true, get: () => 2 });
    Object.defineProperty(audio, 'src', { configurable: true, get: () => first[0], set: () => { srcSets++; } });
    audio.play = function () { plays++; return Promise.resolve(); };
    audio.pause = function () {};
    speech.playOnce(first[0], 0.88, 6000, function () {});
    assert.equal(srcSets, 0, 'same source is not reassigned');
    assert.equal(plays, 1);
    assert.equal(audio.currentTime, 0, 'Repeat #2 rewinds the buffer');
    speech.playOnce(speech.streamSources('harbour')[1], 0.88, 6000, function () {});
    assert.equal(srcSets, 1, 'a new word loads once');
    assert.equal(typeof speech.playSmartAudio, 'function');
    has('same=!!src&&a.src===src&&a.readyState>=2');
    has('a.currentTime=0');
    has('},3500);');
  } finally { a.close(); }
});

/* ------------------------------------------------------------ migration */

test('a v15 save moves to the sdp.v17_type_tick key without losing results', function () {
  const a = boot();
  try {
    const seed = JSON.parse(JSON.stringify(a.q.DB.data));
    seed.settingsRev = 15;
    seed.v = 15;
    seed.settings.glassBlur = 22;
    seed.settings.glassSat = 180;
    seed.settings.glassBrt = 104;
    seed.settings.glassTint = 1;
    seed.results.push({ id: 'legacy_result', score: 27, wordCount: 30, ts: 1, listId: seed.plan.defaultList });
    a.w.localStorage.setItem('sdp.v15_liquid', JSON.stringify(seed));
    a.w.localStorage.removeItem('sdp.v17_type_tick');
    a.q.DB.load();
    assert.equal(a.q.DB.data.settingsRev, 17);
    assert.equal(a.q.DB.data.v, 17);
    assert.ok(a.q.DB.data.results.some((r) => r.id === 'legacy_result'), 'results survive');
    assert.equal(a.q.DB.data.settings.glassBlur, 22);
    assert.equal(a.q.DB.data.settings.glassTint, 1);
    assert.equal(a.q.DB.data.settings.writeFixed, 5);
    assert.equal(a.q.DB.data.settings.repeats, 2);
    assert.ok(a.q.DB.data.admin.pinHash);
    assert.ok(a.w.localStorage.getItem('sdp.v17_type_tick'), 'the new key is written');
  } finally { a.close(); }
});

test('a v16 swan save is lifted to v17 with every setting intact', function () {
  const a = boot();
  try {
    const seed = JSON.parse(JSON.stringify(a.q.DB.data));
    seed.settingsRev = 16;
    seed.v = 16;
    seed.settings.glassBlur = 18;
    seed.settings.perf = 'lite';
    seed.results.push({ id: 'swan_result', score: 30, wordCount: 30, ts: 2, listId: seed.plan.defaultList });
    a.w.localStorage.setItem('sdp.v16_swan', JSON.stringify(seed));
    a.w.localStorage.removeItem('sdp.v17_type_tick');
    a.q.DB.load();
    assert.equal(a.q.DB.data.settingsRev, 17);
    assert.equal(a.q.DB.data.v, 17);
    assert.equal(a.q.DB.data.settings.glassBlur, 18);
    assert.equal(a.q.DB.data.settings.perf, 'lite');
    assert.ok(a.q.DB.data.results.some((r) => r.id === 'swan_result'), 'swan-era results survive');
    assert.ok(a.w.localStorage.getItem('sdp.v17_type_tick'), 'the v17 key is written');
  } finally { a.close(); }
});

/* --------------------------------------------------------------- credits */

test('full credits stay in the Hero, Welcome Guide and Settings About', function () {
  const a = boot();
  try {
    const doc = a.w.document;
    assert.match(doc.querySelector('.hero-credit').textContent, /\u{1F9A2}/u);
    assert.match(doc.querySelector('.hero-credit').textContent, /Created by Hansana/);
    assert.match(doc.querySelector('.hero-credit').textContent, /Ayya01 \(Lesandu\)/);
    a.q.UI.setTab('set');
    const txt = doc.getElementById('screen-set').textContent;
    assert.match(txt, /Created by Hansana/);
    assert.match(txt, /Sumodya Sewmini/);
    assert.match(a.q.T('creditFull'), /Hansana/);
    a.q.UI.setLang('si');
    assert.match(a.q.T('creditFull'), /[\u0d80-\u0dff]/);
    assert.match(a.q.STRINGS_SI.creditFull, /[\u0d80-\u0dff]/);
  } finally { a.close(); }
});

test('Home still renders the bento stats and past sessions under the hero', function () {
  const a = boot();
  try {
    const doc = a.w.document;
    assert.equal(doc.querySelectorAll('#homeStats .statbox').length, 3);
    assert.ok(doc.querySelector('.lg-hero .anatomy-stage #homeHero'));
    assert.ok(doc.querySelector('.lg-hero .anatomy-stage .stripes'));
    assert.ok(doc.querySelector('.lg-hero .anatomy-stage .disc'));
    assert.equal(doc.querySelector('#screen-home .stage'), null);
    assert.ok(doc.getElementById('homeSessions'));
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
