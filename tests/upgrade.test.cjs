/* Smart Dictation Player 2.4.0 (schema 16) release verification.
   Regenerated from scratch for this release: an animated swan credit badge, the
   see-through Liquid Glass title font, the Material Mixer moved into Settings
   and the zero-lag 60 FPS engine. Written with fs.writeFileSync, never patched. */
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

test('v16 / 2.4.0 metadata is consistent across the app and data files', function () {
  for (const data of [version, config, session]) assert.ok(Number(data.ver) >= 16, 'ver >= 16');
  assert.equal(version.appVersion, '2.4.0');
  assert.equal(version.version, '2.4.0');
  assert.equal(version.settingsRev, 16);
  assert.equal(version.session, '7');
  assert.equal(version.title, TITLE);
  assert.equal(version.buildDate, '2026-10-23');
  assert.equal(config.appVersion, '2.4.0');
  assert.equal(config.settingsRev, 16);
  assert.equal(config.listId, LIST_ID);
  assert.equal(session.appVersion, '2.4.0');
  has('var APP_VERSION="2.4.0"');
  has('key:"sdp.v16_swan"');
  const a = boot();
  try {
    assert.equal(a.q.CONFIG.key, 'sdp.v16_swan');
    assert.equal(a.q.CONFIG.schema, 16);
    assert.equal(a.q.CONFIG.settingsRev, 16);
    assert.ok(a.w.document.body.getAttribute('data-perf'));
  } finally { a.close(); }
});

test('Session 7 keeps all 30 Travel & Transport words in order', function () {
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
  lacks('dgC', 'the old drop gradient is gone');
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

test('#homeTitle wears the see-through Liquid Glass font', function () {
  const title = rule('#homeTitle,.liquid-glass-text');
  assert.match(title, /-webkit-text-stroke:1\.75px/);
  assert.match(title, /color:transparent !important/);
  assert.match(title, /-webkit-background-clip:text/);
  assert.match(title, /background-clip:text/);
  assert.match(title, /font-size:clamp\(2\.2rem,5vw,4rem\)/);
  assert.match(rule('body[data-theme="light"] #homeTitle,body[data-theme="light"] .liquid-glass-text'), /-webkit-text-stroke/);
  has('class="liquid-glass-text"');
  lacks('class="hollow"', 'the extra "Liquid Glass" words are gone');
  lacks('Liquid Glass</span>');
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
  const a = boot();
  try {
    const doc = a.w.document;
    const seg = doc.getElementById('segMode');
    assert.equal(seg.querySelectorAll('button').length, 2);
    seg.querySelector('[data-mode="type"]').click();
    assert.equal(doc.getElementById('segMode'), seg, 'the seg is not recreated on click');
    assert.equal(seg.querySelector('[data-mode="type"]').getAttribute('aria-selected'), 'true');
    assert.match(seg.querySelector('.thumb').style.transform, /^translate3d\(/);
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

test('a v15 save moves to the sdp.v16_swan key without losing results', function () {
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
    a.w.localStorage.removeItem('sdp.v16_swan');
    a.q.DB.load();
    assert.equal(a.q.DB.data.settingsRev, 16);
    assert.equal(a.q.DB.data.v, 16);
    assert.ok(a.q.DB.data.results.some((r) => r.id === 'legacy_result'), 'results survive');
    assert.equal(a.q.DB.data.settings.glassBlur, 22);
    assert.equal(a.q.DB.data.settings.glassTint, 1);
    assert.equal(a.q.DB.data.settings.writeFixed, 5);
    assert.equal(a.q.DB.data.settings.repeats, 2);
    assert.ok(a.q.DB.data.admin.pinHash);
    assert.ok(a.w.localStorage.getItem('sdp.v16_swan'), 'the new key is written');
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
