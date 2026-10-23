/* Release 2.0.0 (ver 10) - Session 7 "Travel & Transport" (22/10/2026).
   Written cleanly from scratch. Asserts the Apple WWDC25 Liquid Glass
   material system in index.html plus 100% of the Session 7 dictation
   features (single British female professor voice Amy, 30 words, credits,
   ntfy.sh sync, Admin PIN 7898, Save & Publish Live Now). */

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

/* The exact 30 Session 7 words, in order. */
const TRAVEL = [
  'guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration',
  'journey', 'luggage', 'machine', 'mechanic', 'nationality', 'on business',
  'on vacation', 'overnight', 'passenger', 'public transport', 'reception',
  'reservation', 'road sign', 'signpost', 'spaceship', 'suitcase',
  'tourist information centre', 'traffic lights', 'tunnel', 'tyre/tire',
  'vehicle', 'visa', 'waiting room', 'windscreen'
];

const APP = 'Session 7 - Travel & Transport';
const LIST_ID = 'list_session_7_travel';
const CREDIT = 'Created by Hansana \u00b7 Idea given by Ayya01 (Lesandu) \u00b7 Lecturer in Charge: Sumodya Sewmini';

test('release metadata: version 2.0.0, data ver 10+, Session 7 defaults', function () {
  assert.equal(versionJson.version, '2.0.0');
  assert.ok(Number(versionJson.ver) >= 10, 'data ver is 10 or newer');
  assert.ok(Number(versionJson.settingsRev) >= 10, 'settings revision is 10 or newer');
  assert.equal(versionJson.session, '7');
  assert.equal(versionJson.title, APP);

  assert.equal(configJson.version, '2.0.0');
  assert.ok(Number(configJson.ver) >= 10);
  assert.equal(configJson.listId, LIST_ID);
  assert.equal(configJson.session.no, '7');
  assert.equal(configJson.session.date, '2026-10-22');
  assert.equal(configJson.session.title, APP);
  assert.equal(configJson.session.branch, 'CCBE Galle Branch');
  assert.equal(configJson.defaults.writeMode, 'fixed');
  assert.equal(configJson.defaults.writeFixed, 5);
  assert.equal(configJson.defaults.sentence, false);
  assert.equal(configJson.defaults.repeats, 2);
  assert.equal(configJson.defaults.rate, 0.88);
  assert.equal(configJson.defaults.numbers, true);
  assert.equal(configJson.defaults.mode, 'paper');
  assert.match(configJson.credits.en, /Created by Hansana/);
  assert.equal(configJson.credits.lecturerInCharge, 'Sumodya Sewmini');
  assert.match(String(configJson.tts.primary), /Amy/);
  assert.match(configJson.live.state, /^https:\/\/ntfy\.sh\/sdp_dictationb1_state_v8$/);
  assert.match(configJson.live.community, /^https:\/\/ntfy\.sh\/sdp_dictationb1_comm_v8$/);
  assert.match(configJson.live.inbox, /^https:\/\/ntfy\.sh\/sdp_dictationb1_inbox_v8$/);
});

test('session.json holds exactly the 30 Travel & Transport words', function () {
  assert.ok(Number(sessionJson.ver) >= 10);
  assert.equal(sessionJson.session.no, '7');
  assert.equal(sessionJson.session.date, '2026-10-22');
  assert.equal(sessionJson.session.title, APP);
  assert.equal(sessionJson.session.listId, LIST_ID);
  assert.equal(sessionJson.lists.length, 1);
  assert.equal(sessionJson.lists[0].name, APP);
  assert.equal(sessionJson.lists[0].words.length, 30);
  assert.deepEqual(sessionJson.lists[0].words.map(function (w) { return w.w; }), TRAVEL);
  for (const word of sessionJson.lists[0].words) {
    assert.ok(word.m && word.m.length > 8, word.w + ' has a British meaning');
    assert.ok(word.s && word.s.length > 15, word.w + ' has a B1 example sentence');
    assert.match(word.audio, /^https:\/\/.+\.mp3$/, word.w + ' has a UK audio URL');
  }
  const words = sessionJson.lists.map(function (l) { return l.words.map(function (w) { return w.w; }); }).flat();
  for (const gone of ['athlete', 'hobbies', 'appointment', 'badminton', 'rainbow']) {
    assert.ok(words.indexOf(gone) < 0, 'old word removed: ' + gone);
  }
  assert.equal(sessionJson.plan.filter(function (p) { return p.key === 'd2026-10-22'; }).length, 1);
});

test('all 30 words are in both session.json and index.html', function () {
  for (const word of TRAVEL) {
    assert.ok(sessionJson.lists[0].words.some(function (w) { return w.w === word; }), 'session.json has ' + word);
    assert.ok(html.indexOf(word) >= 0, 'index.html has ' + word);
  }
  assert.ok(html.indexOf(APP) >= 0, 'index.html names the session');
  assert.ok(html.indexOf('var SAMPLE_LIST_ID = "' + LIST_ID + '"') >= 0);
  assert.ok(html.indexOf('CCBE Galle Branch') >= 0, 'index.html names the branch');
});

test('index.html carries the Apple WWDC25 Liquid Glass material system', function () {
  /* live material tokens, controllable from the Settings mixer */
  assert.ok(html.indexOf('--gb') >= 0, 'live blur token --gb');
  assert.ok(html.indexOf('--gs') >= 0, 'live saturate token --gs');
  assert.ok(html.indexOf('--gbr') >= 0, 'live brightness token --gbr');
  assert.ok(html.indexOf('--aqua') >= 0, 'accent token --aqua');
  assert.ok(html.indexOf('--inset-hi') >= 0, 'lit-rim token --inset-hi');
  /* the refraction filter from the hidden SVG defs */
  assert.ok(html.indexOf('lg-warp') >= 0, 'lg-warp warp filter');
  /* 4-layer recipe + pointer-tracked specular */
  assert.ok(html.indexOf('blur(var(--gb') >= 0, 'backdrop blur recipe');
  assert.ok(html.indexOf('inset 0 1px 0 var(--inset-hi)') >= 0, 'inset highlight');
  assert.ok(html.indexOf('inset 0 0 0 1px var(--line)') >= 0, 'lit rim line');
  assert.ok(html.indexOf('inset 0 -14px 28px') >= 0, 'inner glow');
  assert.ok(html.indexOf('radial-gradient(380px circle at var(--mx') >= 0, 'pointer-tracked specular');
  assert.ok(html.indexOf('cancelAnimationFrame') >= 0, 'rAF specular throttle');
  /* ambient scene */
  assert.ok(html.indexOf('blur(85px)') >= 0, '85 px drift blobs');
  assert.ok(html.indexOf('blob4') >= 0, 'fourth drift blob (violet)');
  assert.ok(html.indexOf('feTurbulence') >= 0, 'grain SVG turbulence');
  /* creator credits and language switcher */
  assert.ok(html.indexOf('Hansana') >= 0);
  assert.ok(html.indexOf('Ayya01') >= 0);
  assert.ok(html.indexOf('Lesandu') >= 0);
  assert.ok(html.indexOf('\u0dc3\u0dd2\u0d82\u0dc4\u0dbd') >= 0, 'Sinhala language label');
  /* unified voice chain */
  assert.ok(html.indexOf('voice=Amy') >= 0, 'primary unified British female voice');
  assert.ok(html.indexOf('api.streamelements.com/kappa/v2/speech') >= 0);
  assert.ok(html.indexOf('translate.google.com/translate_tts') >= 0, 'female en-GB failover');
  assert.ok(html.indexOf('tl=en-GB') >= 0);
  assert.ok(html.indexOf('voice=Emma') < 0, 'no second TTS voice in the chain');
  assert.ok(html.indexOf('voice=Daniel') < 0, 'no male voice in the chain');
  assert.ok(html.indexOf('voice=Oliver') < 0);
  assert.ok(html.indexOf('voice=Ryan') < 0);
  assert.ok(html.indexOf('voice=George') < 0);
  /* session defaults written literally in the app */
  assert.ok(html.indexOf('writeFixed: 5') >= 0);
  assert.ok(html.indexOf('sentence: false') >= 0);
  assert.ok(html.indexOf('repeats: 2') >= 0);
  /* shared Amy audio element, real-time sync, one-tap publish */
  assert.ok(html.indexOf('id="sdpAudio"') >= 0);
  assert.ok(html.indexOf('ntfy.sh') >= 0);
  assert.ok(html.indexOf('EventSource') >= 0);
  assert.ok(html.indexOf('Save & Publish Live Now') >= 0);
  assert.ok(html.indexOf(CREDIT) >= 0, 'full creator credit line');
});

test('index.html carries the v10 key, schema and settings revision', function () {
  assert.ok(html.indexOf('APP_VERSION = "2.0.0"') >= 0);
  assert.ok(html.indexOf('key: "sdp.v10_session7",') >= 0);
  assert.ok(html.indexOf('schema: 10,') >= 0);
  assert.ok(html.indexOf('settingsRev: 10,') >= 0);
  assert.ok(html.indexOf('settingsRev < 10') >= 0, 'v10 migration gate present');
  assert.equal(require('./test-pin.cjs'), '7898');
});

test('in-app defaults: Session 7 list, 5 second timer, 2 repeats, paper mode', function () {
  const a = harness();
  try {
    const q = a.q;
    const d = q.DB.data;
    assert.equal(q.CONFIG.key, 'sdp.v10_session7');
    assert.equal(q.CONFIG.schema, 10);
    assert.equal(q.CONFIG.settingsRev, 10);
    assert.equal(d.settingsRev, 10);
    assert.equal(d.settings.theme, 'dark');
    assert.equal(d.settings.writeMode, 'fixed');
    assert.equal(d.settings.writeFixed, 5);
    assert.equal(d.settings.sentence, false);
    assert.equal(d.settings.repeats, 2);
    assert.equal(d.settings.rate, 0.88);
    assert.equal(d.settings.numbers, true);
    assert.equal(d.settings.mode, 'paper');
    assert.equal(d.lists.length, 1);
    assert.equal(d.lists[0].id, LIST_ID);
    assert.equal(d.lists[0].name, APP);
    assert.equal(d.lists[0].words.length, 30);
    assert.equal(JSON.stringify(d.lists[0].words.map(function (w) { return w.w; })), JSON.stringify(TRAVEL));
    assert.equal(d.session.no, '7');
    assert.equal(d.session.date, '2026-10-22');
    assert.equal(d.session.title, APP);
    assert.equal(d.session.branch, 'CCBE Galle Branch');
    assert.equal(d.session.listId, LIST_ID);
    assert.ok(/ntfy\.sh/.test(q.CONFIG.ntfyHost), 'ntfy.sh host configured');
    /* the shared Amy element is in the DOM */
    assert.ok(a.w.document.getElementById('sdpAudio'), '#sdpAudio present');
  } finally {
    a.close();
  }
});
