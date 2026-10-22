/* Release v2.0.0 (v6) - Session 6 "Travel & Transport".
   Written from scratch for v6: repository data, in-app defaults, the migration
   that drops every older cache, the 5 second timer, the four-tier British audio
   chain, the paste pipeline and the paper-mode self-check. */
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

/* The exact 30 Session 6 words, in order. */
const TRAVEL = [
  'travel', 'transport', 'abroad', 'accommodation', 'ambulance', 'announcement',
  'arrival', 'astronaut', 'backpacking', 'baggage', 'boarding pass', 'brochure',
  'canal', 'capital city', 'crossroads', 'currency', 'customs', 'delayed',
  'deliver', 'departure', 'destination', 'direction', 'documents',
  "driver's licence", 'embassy', 'exchange rate', 'ferry', 'flight', 'foreign', 'guest'
];

const APP = 'Session 6 - Travel & Transport';
const LIST_ID = 'list_session_6_travel';

test('release metadata: version 2.0.0, data ver 6', () => {
  assert.equal(versionJson.version, '2.0.0');
  assert.ok(Number(versionJson.ver) >= 6, 'version.json ver is ' + versionJson.ver);
  assert.equal(Number(configJson.ver), 6);
  assert.equal(Number(sessionJson.ver), 6);
  assert.equal(configJson.version, '2.0.0');
  assert.equal(configJson.listId, LIST_ID);
  assert.deepEqual(configJson.live, {
    state: 'https://ntfy.sh/sdp_dictationb1_state_v6',
    community: 'https://ntfy.sh/sdp_dictationb1_comm_v6',
    inbox: 'https://ntfy.sh/sdp_dictationb1_inbox_v6'
  });
  assert.equal(configJson.defaults.writeFixed, 5);
  assert.equal(configJson.defaults.sentence, false);
  assert.equal(configJson.defaults.repeats, 2);
  assert.equal(configJson.defaults.rate, 0.85);
  assert.equal(configJson.defaults.numbers, true);
  assert.equal(configJson.defaults.mode, 'paper');
  assert.equal(configJson.session.no, '6');
  assert.equal(configJson.session.date, '2026-10-19');
  assert.equal(configJson.session.title, APP);
});

test('session.json holds exactly the 30 Travel & Transport words', () => {
  assert.equal(sessionJson.session.no, '6');
  assert.equal(sessionJson.session.day, 'Tuesday');
  assert.equal(sessionJson.session.date, '2026-10-19');
  assert.equal(sessionJson.session.listId, LIST_ID);
  assert.equal(sessionJson.lists.length, 1);
  assert.equal(sessionJson.lists[0].id, LIST_ID);
  assert.equal(sessionJson.lists[0].name, APP);
  assert.equal(sessionJson.lists[0].words.length, 30);
  assert.deepEqual(sessionJson.lists[0].words.map(w => w.w), TRAVEL);
  for (const word of sessionJson.lists[0].words) {
    assert.ok(word.m && word.m.length > 8, word.w + ' has a British meaning');
    assert.ok(word.s && word.s.length > 15, word.w + ' has a B1 example sentence');
    assert.match(word.audio, /^https:\/\/.+\/(?:[a-z_]+)--_gb_1\.mp3$/, word.w + ' has a UK audio URL');
  }
  /* every word that named an older list is gone */
  for (const gone of ['appointment', 'hobbies', 'athlete', 'badminton', 'rainbow']) {
    assert.ok(!sessionJson.lists[0].words.some(w => w.w === gone), 'old word removed: ' + gone);
  }
});

test('all 30 words are in both session.json and index.html', () => {
  const inApp = sessionJson.lists[0].words.map(w => w.w);
  for (const word of TRAVEL) {
    assert.ok(inApp.includes(word), 'session.json has ' + word);
    assert.ok(html.toLowerCase().includes(word.toLowerCase()), 'index.html has ' + word);
  }
  assert.ok(html.includes(APP), 'index.html names the session');
  assert.ok(html.includes('var SAMPLE_LIST_ID = "' + LIST_ID + '"'));
});

test('index.html carries the v6 key, schema, timer and audio/sync hooks', () => {
  assert.ok(html.includes('APP_VERSION = "2.0.0"'));
  assert.ok(html.includes('key: "sdp.v6_travel",'));
  assert.ok(html.includes('schema: 6,'));
  assert.ok(html.includes('settingsRev: 6,'));
  assert.ok(html.includes('settingsRev < 6'));
  assert.ok(html.includes('writeFixed: 5'));
  assert.ok(html.includes('sentence: false'));
  assert.ok(html.includes('repeats: 2'));
  assert.ok(html.includes('pauseWord: 1.2'));
  assert.ok(html.includes('pauseSent: 1.6'));
  assert.ok(html.includes('id="sdpAudio"'));
  assert.ok(html.includes('preload="auto"'));
  assert.ok(html.includes('playsinline'));
  assert.ok(html.includes('crossorigin="anonymous"'));
  assert.ok(html.includes('ntfy.sh'));
  assert.ok(html.includes('cancelAnimationFrame'));
  assert.ok(html.includes('translate.google.com/translate_tts'));
  assert.ok(html.includes('api.streamelements.com/kappa/v2/speech'));
  assert.ok(html.includes('api.dictionaryapi.dev'));
  assert.ok(html.includes('common.wikimedia.org') || html.includes('wikimedia.org'));
  assert.ok(html.includes('Save & Publish Live Now'));
});

test('in-app defaults: Session 6 list, 5 second timer, paper mode', () => {
  const a = harness();
  try {
    const q = a.q, d = q.DB.data;
    assert.equal(q.CONFIG.key, 'sdp.v6_travel');
    assert.equal(q.CONFIG.schema, 6);
    assert.equal(d.settingsRev, 6);
    assert.equal(d.lists.length, 1);
    assert.equal(d.lists[0].id, LIST_ID);
    assert.equal(d.lists[0].name, APP);
    assert.equal(d.lists[0].words.length, 30);
    assert.deepEqual(Array.from(d.lists[0].words, w => w.w), TRAVEL);
    assert.equal(d.session.no, '6');
    assert.equal(d.session.day, 'Tuesday');
    assert.equal(d.session.date, '2026-10-19');
    assert.equal(d.session.listId, LIST_ID);
    assert.equal(d.settings.writeMode, 'fixed');
    assert.equal(d.settings.writeFixed, 5);
    assert.equal(d.settings.sentence, false);
    assert.equal(d.settings.repeats, 2);
    assert.equal(d.settings.rate, 0.85);
    assert.equal(d.settings.numbers, true);
    assert.equal(d.settings.mode, 'paper');
    assert.equal(d.settings.pauseWord, 1.2);
    assert.equal(d.settings.pauseSent, 1.6);
  } finally { a.close(); }
});

test('Home hero shows Session 6, 19 Oct 2026 and 30 words with a 5s timer', () => {
  const a = harness();
  try {
    const doc = a.w.document;
    assert.equal(doc.querySelector('#homeKicker').textContent, 'SESSION 6 \u00b7 19 OCT 2026');
    assert.equal(doc.querySelector('#homeTitle').textContent, APP);
    assert.equal(doc.querySelector('#homeSub').textContent, '30 words \u00b7 5s timer');
  } finally { a.close(); }
});

test('migrate: any pre-v6 cache is replaced, snapshots and queues are dropped', () => {
  const a = harness();
  try {
    const q = a.q;
    const old = JSON.parse(JSON.stringify(q.defaultData()));
    old.settingsRev = 4;
    old.v = 4;
    old.lists = [{ id: 'list_tue_20_sport', name: 'Tuesday 20th dictation session', version: 3, published: true,
      words: [{ w: 'athlete', s: 'An athlete trains every day.', m: 'a sporty person' }] }];
    old.plan = { weekdays: ['', '', '', '', '', '', ''], dates: {}, pinned: 'list_tue_20_sport', defaultList: 'list_tue_20_sport' };
    old.session = { no: '1', day: 'Tuesday', autoDay: false, date: '2026-10-20', title: 'Tuesday 20th dictation session', listId: 'list_tue_20_sport' };
    old.snapshot = { idx: 7 };
    old.sessions = [{ id: 'past' }];
    old.outbox = [{ action: 'comment' }];
    const d = q.DB.migrate(old);
    assert.equal(d.settingsRev, 6);
    assert.equal(d.v, 6);
    assert.equal(d.lists.length, 1);
    assert.equal(d.lists[0].id, LIST_ID);
    assert.equal(d.lists[0].name, APP);
    assert.equal(d.lists[0].words.length, 30);
    assert.equal(d.lists[0].words[0].w, 'travel');
    assert.equal(d.settings.writeFixed, 5);
    assert.equal(d.settings.sentence, false);
    assert.equal(d.session.no, '6');
    assert.equal(d.session.date, '2026-10-19');
    assert.equal(d.session.title, APP);
    assert.equal(d.session.listId, LIST_ID);
    assert.equal(d.plan.pinned, LIST_ID);
    assert.equal(d.plan.defaultList, LIST_ID);
    assert.equal(d.plan.dates['2026-10-19'], LIST_ID);
    assert.ok(!('snapshot' in d), 'snapshot dropped');
    assert.equal(d.sessions.length, 0, 'past sessions dropped');
    assert.equal(d.outbox.length, 0, 'outbox dropped');
    assert.ok(!d.lists.some(l => l.words.some(w => w.w === 'athlete')), 'old words dropped');
  } finally { a.close(); }
});

test('writeSecs() is exactly 5 seconds in every new install', () => {
  const a = harness();
  try {
    const q = a.q;
    q.Eng.words = Array.from(q.DB.data.lists[0].words);
    q.Eng.order = [0];
    const beats = q.Eng.buildBeats(0);
    const beat = Array.from(beats).filter(b => b.t === 'write')[0];
    assert.ok(beat, 'a write beat exists');
    assert.equal(beat.secs, 5);
    q.DB.data.settings.writeMode = 'auto';
    const secs = q.DB.data.settings;
    assert.equal(secs.writeFixed, 5);
  } finally { a.close(); }
});

test('paste pipeline strips (n)/(v) tags and keeps every word', () => {
  const a = harness();
  try {
    const q = a.q;
    const parsed = q.Admin.parseWords("driver's licence(n)\ntravel (v)\nboarding pass(adj)\ncurrency");
    assert.deepEqual(Array.from(parsed.items, i => i.w), ["driver's licence", 'travel', 'boarding pass', 'currency']);
    assert.equal(parsed.problems.length, 0);
    /* the built-in B1 lexicon still supplies meaning + sentence */
    const travel = parsed.items.filter(i => i.w === 'travel')[0];
    assert.ok(travel.m && travel.s, 'travel enriched from the built-in lexicon');
  } finally { a.close(); }
});

test("marking accepts driver's licence, drivers licence and driver's license", () => {
  const a = harness();
  try {
    const q = a.q;
    q.DB.data.settings.usSpelling = 'half';
    const t = "driver's licence";
    assert.equal(q.Results.answerState("driver's licence", t), 'ok');
    assert.equal(q.Results.answerState('drivers licence', t), 'ok');
    assert.equal(q.Results.answerState("driver's license", t), 'half');
    assert.equal(q.Results.answerState('drivers license', t), 'half');
    assert.equal(q.Results.answerState('driver licence', t), 'wrong');
    assert.equal(q.Results.answerState('', t), 'empty');
    assert.equal(q.Results.answerState('Travel', 'travel'), 'ok');
    assert.equal(q.Results.answerState('colour', 'colour'), 'ok');
  } finally { a.close(); }
});

test('four-tier British audio: dictionary MP3, device en-GB, cloud stream, any English', () => {
  const a = harness();
  try {
    const q = a.q;
    const list = q.Speech.mp3Candidates('', 'travel', 'travel');
    assert.match(list[0], /oxford\/travel--_gb_1\.mp3$/);
    assert.ok(list.some(u => /api\.dictionaryapi\.dev\/.*-uk\.mp3$/.test(u)), 'Free Dictionary UK file');
    assert.ok(list.some(u => /wikimedia\.org\/.*En-uk-travel\.ogg$/.test(u)), 'Wiktionary En-uk recording');
    /* a recorded word URL always wins over the CDN */
    const withOwn = q.Speech.mp3Candidates('https://example.org/my_gb_travel.mp3', 'travel', 'travel');
    assert.equal(withOwn[0], 'https://example.org/my_gb_travel.mp3');
    /* a phrase still finds the Oxford UK MP3 */
    assert.match(q.Speech.mp3Candidates('', 'boarding pass', 'boarding pass')[0], /boarding_pass--_gb_1\.mp3$/);
    /* the four tiers are all present in the source */
    assert.ok(html.includes('ukVoices.length === 0') || html.includes('!this.ukVoices.length') || html.includes('self.ukVoices.length'));
    assert.ok(html.includes('u.lang = "en-GB"'));
    assert.ok(html.includes('speechSynthesis'));
    /* no UK voice never blocks or aborts the run: no NoVoice gate in the engine */
    assert.ok(!/Eng\.start[\s\S]{0,1500}NoVoice\.open\(/.test(html), 'Eng.start does not gate on NoVoice');
    assert.ok(!/no UK voice[^\n]*return/i.test(html));
  } finally { a.close(); }
});

test('network chip never claims live sync without a real connection', () => {
  const a = harness();
  try {
    const q = a.q, w = a.w, doc = w.document;
    q.Cloud.live.ok = false;
    q.Cloud.repoOnline = false;
    q.Cloud.syncedAt = 0;
    q.Cloud.live.posting = false;
    q.DB.data.outbox = [];
    q.UI.renderNet();
    assert.equal(doc.querySelector('#chipNetText').textContent, 'Syncing\u2026');
    q.Cloud.live.ok = true;
    q.UI.renderNet();
    assert.match(doc.querySelector('#chipNetText').textContent, /^Online \u00b7 Live Sync/);
    q.Cloud.live.ok = false;
    Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });
    q.UI.renderNet();
    assert.equal(doc.querySelector('#chipNetText').textContent, 'Offline \u00b7 Saved on device');
  } finally { a.close(); }
});

test('paper mode: results list all 30 words as a tap-to-mark self-check', () => {
  const a = harness();
  try {
    const q = a.q, w = a.w;
    q.DB.data.settings.mode = 'paper';
    q.Eng.start({});
    q.Eng.finish(true);
    a.clock.tick(8000);
    /* the completion is posted as a real, finished result */
    const post = q.DB.data.comments.filter(c => c.status === 'finished')[0];
    assert.ok(post, 'a finished completion was posted');
    assert.equal(q.DB.data.comments[0].status, 'finished');
    assert.match(post.text, /Score: 0\/30/);
    const rec = q.DB.data.history[0];
    assert.equal(rec.mode, 'paper');
    assert.equal(rec.wordCount, 30);
    /* the sheet renders one numbered row per word with Correct / Missed buttons */
    const rows = w.document.querySelectorAll('#layers .listrow').length;
    assert.ok(rows >= 30, 'rendered ' + rows + ' word rows');
    const labels = Array.from(w.document.querySelectorAll('#layers .listrow button')).map(b => b.getAttribute('aria-label') || '');
    assert.ok(labels.some(l => /^Got it right: travel$/.test(l)));
    assert.ok(labels.some(l => /^Missed it: guest$/.test(l)));
  } finally { a.close(); }
});
