/* Release 2.0.0 (ver 7) - Session 7 "Travel & Transport" (22/10/2026).
   Written from scratch for v7: repository data, in-app defaults, the migration
   that drops every older cache, the 5 second timer, the four-tier British
   female audio chain, the bilingual EN | සිංහල shell, the Welcome Guide, the
   paste pipeline and the paper-mode self-check. */
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

test('release metadata: version 2.0.0, data ver 7, Session 7 defaults', function () {
  assert.equal(versionJson.version, '2.0.0');
  assert.equal(Number(versionJson.ver), 7);
  assert.equal(Number(versionJson.settingsRev), 7);
  assert.equal(versionJson.session, '7');
  assert.equal(versionJson.title, APP);

  assert.equal(configJson.version, '2.0.0');
  assert.equal(Number(configJson.ver), 7);
  assert.equal(configJson.listId, LIST_ID);
  assert.equal(configJson.session.no, '7');
  assert.equal(configJson.session.day, 'Thursday');
  assert.equal(configJson.session.date, '2026-10-22');
  assert.equal(configJson.session.title, APP);
  assert.equal(configJson.session.branch, 'CCBE Galle Branch');
  assert.deepEqual(configJson.classDays, ['Thursday']);
  assert.deepEqual(configJson.live, {
    state: 'https://ntfy.sh/sdp_dictationb1_state_v7',
    community: 'https://ntfy.sh/sdp_dictationb1_comm_v7',
    inbox: 'https://ntfy.sh/sdp_dictationb1_inbox_v7'
  });
  assert.equal(configJson.defaults.writeMode, 'fixed');
  assert.equal(configJson.defaults.writeFixed, 5);
  assert.equal(configJson.defaults.sentence, false);
  assert.equal(configJson.defaults.repeats, 2);
  assert.equal(configJson.defaults.rate, 0.85);
  assert.equal(configJson.defaults.numbers, true);
  assert.equal(configJson.defaults.mode, 'paper');
  assert.equal(configJson.defaults.pauseWord, 1.2);
  assert.equal(configJson.defaults.pauseSent, 1.6);
  assert.match(configJson.credits.en, /Created by Hansana/);
  assert.match(configJson.credits.si, /Hansana/);
  assert.equal(configJson.credits.lecturerInCharge, 'Sumodya Sewmini');
});

test('session.json holds exactly the 30 Travel & Transport words', function () {
  assert.equal(Number(sessionJson.ver), 7);
  assert.equal(sessionJson.session.no, '7');
  assert.equal(sessionJson.session.day, 'Thursday');
  assert.equal(sessionJson.session.date, '2026-10-22');
  assert.equal(sessionJson.session.title, APP);
  assert.equal(sessionJson.session.listId, LIST_ID);
  assert.equal(sessionJson.lists.length, 1);
  assert.equal(sessionJson.lists[0].id, LIST_ID);
  assert.equal(sessionJson.lists[0].name, APP);
  assert.equal(sessionJson.lists[0].words.length, 30);
  assert.deepEqual(sessionJson.lists[0].words.map(function (w) { return w.w; }), TRAVEL);
  for (const word of sessionJson.lists[0].words) {
    assert.ok(word.m && word.m.length > 8, word.w + ' has a British meaning');
    assert.ok(word.s && word.s.length > 15, word.w + ' has a B1 example sentence');
    assert.match(word.audio, /^https:\/\/.+\.mp3$/, word.w + ' has a UK audio URL');
  }
  /* only Session 7 survives: no older list, plan date or word is left behind */
  const words = sessionJson.lists.map(function (l) { return l.words.map(function (w) { return w.w; }); }).flat();
  for (const gone of ['travel', 'transport', 'athlete', 'hobbies', 'appointment', 'badminton', 'rainbow']) {
    assert.ok(words.indexOf(gone) < 0, 'old word removed: ' + gone);
  }
  assert.equal(sessionJson.plan.filter(function (p) { return p.key === 'd2026-10-22'; }).length, 1);
  assert.equal(sessionJson.plan.filter(function (p) { return p.key === 'd2026-10-19'; }).length, 0);
});

test('all 30 words are in both session.json and index.html', function () {
  for (const word of TRAVEL) {
    assert.ok(html.includes(word), 'index.html has ' + word);
  }
  assert.ok(html.includes(APP), 'index.html names the session');
  assert.ok(html.includes('var SAMPLE_LIST_ID = "' + LIST_ID + '"'));
  assert.ok(!html.includes('list_session_6_travel'), 'no Session 6 list id remains');
  assert.ok(!html.includes('Session 6 - Travel & Transport'), 'no Session 6 title remains');
});

test('index.html carries the v7 key, schema, timer, credits and audio/sync hooks', function () {
  assert.ok(html.includes('APP_VERSION = "2.0.0"'));
  assert.ok(html.includes('key: "sdp.v7_session7",'));
  assert.ok(html.includes('schema: 7,'));
  assert.ok(html.includes('settingsRev: 7,'));
  assert.ok(html.includes('settingsRev < 7'));
  assert.ok(html.includes('writeFixed: 5'));
  assert.ok(html.includes('sentence: false'));
  assert.ok(html.includes('repeats: 2'));
  assert.ok(html.includes('pauseWord: 1.2'));
  assert.ok(html.includes('pauseSent: 1.6'));
  assert.ok(html.includes('var STRINGS_SI'));
  assert.ok(html.includes('id="btnLang"'));
  assert.ok(html.includes('id="creditBar"'));
  assert.ok(html.includes('id="homeCredits"'));
  assert.ok(html.includes('id="sdpAudio"'));
  assert.ok(html.includes('preload="auto"'));
  assert.ok(html.includes('playsinline'));
  assert.ok(html.includes('crossorigin="anonymous"'));
  assert.ok(html.includes('voice=Amy'));
  assert.ok(html.includes('voice=Emma'));
  assert.ok(html.includes('ntfy.sh'));
  assert.ok(html.includes('sdp_dictationb1_state_v7'));
  assert.ok(html.includes('cancelAnimationFrame'));
  assert.ok(html.includes('translate.google.com/translate_tts'));
  assert.ok(html.includes('api.streamelements.com/kappa/v2/speech'));
  assert.ok(html.includes('api.dictionaryapi.dev'));
  assert.ok(html.includes('wikimedia.org'));
  assert.ok(html.includes('Save & Publish Live Now'));
  assert.ok(html.includes('Created by Hansana'));
  assert.ok(html.includes('Sumodya Sewmini'));
});

test('in-app defaults: Session 7 list, 5 second timer, paper mode, English shell', function () {
  const a = harness();
  try {
    const q = a.q, d = q.DB.data;
    assert.equal(q.CONFIG.key, 'sdp.v7_session7');
    assert.equal(q.CONFIG.schema, 7);
    assert.equal(d.settingsRev, 7);
    assert.equal(d.lists.length, 1);
    assert.equal(d.lists[0].id, LIST_ID);
    assert.equal(d.lists[0].name, APP);
    assert.equal(d.lists[0].words.length, 30);
    assert.deepEqual(Array.from(d.lists[0].words, function (w) { return w.w; }), TRAVEL);
    assert.equal(d.session.no, '7');
    assert.equal(d.session.day, 'Thursday');
    assert.equal(d.session.date, '2026-10-22');
    assert.equal(d.session.listId, LIST_ID);
    assert.equal(d.session.title, APP);
    assert.equal(d.settings.lang, 'en');
    assert.equal(d.settings.writeMode, 'fixed');
    assert.equal(d.settings.writeFixed, 5);
    assert.equal(d.settings.sentence, false);
    assert.equal(d.settings.repeats, 2);
    assert.equal(d.settings.rate, 0.85);
    assert.equal(d.settings.numbers, true);
    assert.equal(d.settings.mode, 'paper');
    assert.equal(d.settings.pauseWord, 1.2);
    assert.equal(d.settings.pauseSent, 1.6);
    assert.equal(q.defaultData().tourSeen, false, 'a new install shows the Welcome Guide');
  } finally { a.close(); }
});

test('Home hero shows Session 7, 22/10/2026, the branch, 30 words and the credit', function () {
  const a = harness();
  try {
    const doc = a.w.document;
    assert.equal(doc.querySelector('#homeKicker').textContent, 'SESSION 7 \u00b7 22/10/2026 \u00b7 CCBE GALLE BRANCH');
    assert.equal(doc.querySelector('#homeTitle').textContent, APP);
    assert.equal(doc.querySelector('#homeSub').textContent, '30 words \u00b7 5s timer \u00b7 Created by Hansana \u00b7 Idea by Ayya01 (Lesandu)');
    assert.equal(doc.querySelector('#creditBar').textContent.trim(), CREDIT);
    assert.equal(doc.querySelector('#homeCredits').textContent.trim(), CREDIT);
  } finally { a.close(); }
});

test('migrate: any pre-v7 cache is replaced, snapshots and queues are dropped', function () {
  const a = harness();
  try {
    const q = a.q;
    const old = JSON.parse(JSON.stringify(q.defaultData()));
    old.settingsRev = 6;
    old.v = 6;
    old.tourSeen = true;
    old.lists = [{ id: 'list_session_6_travel', name: 'Session 6 - Travel & Transport', version: 2, published: true,
      words: [{ w: 'travel', s: 'We travel by train every day.', m: 'to make a journey' }] }];
    old.plan = { weekdays: ['', '', '', '', '', '', ''], dates: { '2026-10-19': 'list_session_6_travel' }, pinned: 'list_session_6_travel', defaultList: 'list_session_6_travel' };
    old.session = { no: '6', day: 'Tuesday', autoDay: false, date: '2026-10-19', title: 'Session 6 - Travel & Transport', listId: 'list_session_6_travel' };
    old.snapshot = { idx: 7 };
    old.sessions = [{ id: 'past' }];
    old.outbox = [{ action: 'comment' }];
    old.history = [{ id: 'personal-run', score: 20, wordCount: 30 }];
    const d = q.DB.migrate(old);
    assert.equal(d.settingsRev, 7);
    assert.equal(d.v, 7);
    assert.equal(d.lists.length, 1);
    assert.equal(d.lists[0].id, LIST_ID);
    assert.equal(d.lists[0].name, APP);
    assert.equal(d.lists[0].words.length, 30);
    assert.equal(d.lists[0].words[0].w, 'guidebook');
    assert.equal(d.settings.writeFixed, 5);
    assert.equal(d.settings.writeMode, 'fixed');
    assert.equal(d.settings.sentence, false);
    assert.equal(d.session.no, '7');
    assert.equal(d.session.date, '2026-10-22');
    assert.equal(d.session.day, 'Thursday');
    assert.equal(d.session.title, APP);
    assert.equal(d.session.listId, LIST_ID);
    assert.equal(d.plan.pinned, LIST_ID);
    assert.equal(d.plan.defaultList, LIST_ID);
    assert.equal(d.plan.dates['2026-10-22'], LIST_ID);
    assert.ok(!('snapshot' in d), 'snapshot dropped');
    assert.equal(d.sessions.length, 0, 'past sessions dropped');
    assert.equal(d.outbox.length, 0, 'outbox dropped');
    assert.equal(d.tourSeen, false, 'the bilingual Welcome Guide is shown again');
    assert.equal(d.history.length, 1, 'the student keeps their own practice history');
    assert.ok(!d.lists.some(function (l) { return l.words.some(function (w) { return w.w === 'athlete'; }); }), 'old words dropped');
  } finally { a.close(); }
});

test('writeSecs() is exactly 5 seconds in every new install', function () {
  const a = harness();
  try {
    const q = a.q;
    q.Eng.words = Array.from(q.DB.data.lists[0].words);
    q.Eng.order = [0];
    const beats = q.Eng.buildBeats(0);
    const beat = Array.from(beats).filter(function (b) { return b.t === 'write'; })[0];
    assert.ok(beat, 'a write beat exists');
    assert.equal(beat.secs, 5);
    /* the word beat speaks "tyre", never the written slash form */
    const sayBeats = Array.from(beats).filter(function (b) { return b.t === 'say'; });
    q.Eng.order = [25];
    const tyreBeats = Array.from(q.Eng.buildBeats(25)).filter(function (b) { return b.t === 'say' && b.word; });
    assert.equal(tyreBeats[0].text, 'tyre');
    assert.equal(tyreBeats[0].word, 'tyre');
    assert.equal(sayBeats.length, 3, 'number + the word twice by default');
    /* the sentence is never read unless the lecturer turns it on */
    assert.ok(!sayBeats.some(function (b) { return b.text === q.DB.data.lists[0].words[0].s; }));
  } finally { a.close(); }
});

test('typed marking accepts tyre, tire and tyre/tire as 100% correct', function () {
  const a = harness();
  try {
    const q = a.q;
    q.DB.data.settings.usSpelling = 'half';
    assert.equal(q.Results.answerState('tyre', 'tyre/tire'), 'ok');
    assert.equal(q.Results.answerState('tire', 'tyre/tire'), 'ok');
    assert.equal(q.Results.answerState('tyre/tire', 'tyre/tire'), 'ok');
    assert.equal(q.Results.answerState('Tyre', 'tyre/tire'), 'ok');
    assert.equal(q.Results.answerState('tier', 'tyre/tire'), 'wrong');
    assert.equal(q.Results.answerState('', 'tyre/tire'), 'empty');
    assert.equal(q.Results.answerState('Guidebook', 'guidebook'), 'ok');
    const scored = q.Results.scoreTypeMode([{ w: 'tyre/tire' }, { w: 'guidebook' }], [0, 1], ['tire', 'guidebook']);
    assert.equal(scored.correct, 2, 'both words are fully correct');
    assert.equal(scored.total, 2);
  } finally { a.close(); }
});

test('four-tier British female audio: dictionary MP3, Polly Amy, Emma, Google en-GB', function () {
  const a = harness();
  try {
    const q = a.q;
    const list = q.Speech.mp3Candidates('', 'guidebook', 'guidebook');
    assert.match(list[0], /oxford\/guidebook--_gb_1\.mp3$/);
    assert.ok(list.some(function (u) { return /api\.dictionaryapi\.dev\/.*-uk\.mp3$/.test(u); }), 'Free Dictionary UK file');
    assert.ok(list.some(function (u) { return /wikimedia\.org\/.*En-uk-guidebook\.ogg$/.test(u); }), 'Wiktionary En-uk recording');

    const sources = q.Speech.streamSources('guidebook', 'guidebook');
    assert.match(sources[0], /oxford\/guidebook--_gb_1\.mp3$/);
    const amy = sources.findIndex(function (u) { return /voice=Amy/.test(u); });
    const emma = sources.findIndex(function (u) { return /voice=Emma/.test(u); });
    const google = sources.findIndex(function (u) { return /translate_tts/.test(u); });
    assert.ok(amy > 0, 'Polly Amy is in the chain');
    assert.ok(emma > amy, 'Emma fails over after Amy');
    assert.ok(google > emma, 'Google en-GB is the last online voice');

    /* a prompt or number has no dictionary entry: Amy speaks it first */
    const prompt = q.Speech.streamSources('Number 3.', '');
    assert.match(prompt[0], /voice=Amy/);
    assert.match(prompt[1], /voice=Emma/);
    assert.match(prompt[2], /translate_tts/);

    /* the British female professor wins even when a male en-GB voice exists */
    q.Speech.voices = [{ name: 'Daniel', lang: 'en-GB', localService: true }, { name: 'Microsoft Sonia', lang: 'en-GB', localService: true }];
    q.Speech.ukVoices = q.Speech.voices.slice(0);
    assert.equal(q.Speech.pick().name, 'Microsoft Sonia');
    /* Tier 4 prefers an English female voice, even outside the UK */
    q.Speech.voices = [{ name: 'Alex', lang: 'en-US', localService: true }, { name: 'Samantha', lang: 'en-US', localService: true }];
    assert.equal(q.Speech.anyEnglish().name, 'Samantha');

    assert.equal(q.Speech.speakText('tyre/tire'), 'tyre');
    assert.ok(html.includes('u.pitch = o.pitch === undefined ? 1.06 : o.pitch'), 'a warm British female pitch');
    assert.ok(html.includes('u.lang = "en-GB"'));
    assert.ok(html.includes('speechSynthesis'));
    /* no UK voice never blocks or aborts the run */
    assert.ok(!/Eng\.start[\s\S]{0,1500}NoVoice\.open\(/.test(html), 'Eng.start does not gate on NoVoice');
    assert.ok(!/no UK voice[^\n]*return/i.test(html));
  } finally { a.close(); }
});

test('network chip never claims live sync without a real connection', function () {
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

test('paper mode: results list all 30 words as a tap-to-mark self-check', function () {
  const a = harness();
  try {
    const q = a.q, w = a.w, doc = w.document;
    q.DB.data.settings.mode = 'paper';
    q.Eng.start({});
    a.clock.tick(50);
    q.Eng.finish(true);
    a.clock.tick(9000);
    const post = q.DB.data.comments.filter(function (c) { return c.status === 'finished'; })[0];
    assert.ok(post, 'a finished completion was posted');
    assert.equal(q.DB.data.comments[0].status, 'finished');
    assert.match(post.text, /Score: 0\/30/);
    const rec = q.DB.data.history[0];
    assert.equal(rec.mode, 'paper');
    assert.equal(rec.wordCount, 30);
    /* every word is on screen immediately, not chunked in later */
    const rows = doc.querySelectorAll('#layers .listrow').length;
    assert.equal(rows, 30, 'rendered ' + rows + ' word rows');
    const labels = Array.from(doc.querySelectorAll('#layers .listrow button')).map(function (b) { return b.getAttribute('aria-label') || ''; });
    assert.ok(labels.some(function (l) { return /^Got it right: guidebook$/.test(l); }));
    assert.ok(labels.some(function (l) { return /^Missed it: windscreen$/.test(l); }));
    /* tapping updates the ring live and posts the completion again */
    const good = Array.from(doc.querySelectorAll('#layers .listrow button')).filter(function (b) { return /^Got it right: guidebook$/.test(b.getAttribute('aria-label') || ''); })[0];
    good.click();
    assert.equal(doc.querySelector('#layers .val').textContent, '1 / 30');
    assert.match(q.DB.data.comments[0].text, /Score: 1\/30/);
  } finally { a.close(); }
});

test('bilingual shell: EN | \u0dc3\u0dd2\u0d82\u0dc4\u0dbd switches navigation, buttons and credits', function () {
  const a = harness();
  try {
    const q = a.q, doc = a.w.document;
    assert.equal(doc.querySelector('#btnLang').textContent, 'EN | \u0dc3\u0dd2\u0d82\u0dc4\u0dbd');
    q.UI.setLang('si');
    assert.equal(q.DB.data.settings.lang, 'si');
    assert.equal(doc.querySelector('#tab-home span').textContent, '\u0db8\u0dd4\u0dbd\u0dca \u0db4\u0dd2\u0da7\u0dd4\u0dc0');
    assert.equal(doc.querySelector('#tab-dict span').textContent, '\u0dc1\u0db6\u0dca\u0daf\u0d9a\u0ddd\u0dc2\u0dba');
    assert.equal(doc.querySelector('#tab-comm span').textContent, '\u0db4\u0dca\u200d\u0dbb\u0da2\u0dcf\u0dc0');
    assert.equal(doc.querySelector('#tab-set span').textContent, '\u0dc3\u0dd0\u0d9a\u0dc3\u0dd4\u0db8\u0dca');
    assert.equal(doc.querySelector('#btnStartText').textContent, '\u0da9\u0dd2\u0d9a\u0dca\u0da7\u0dda\u0dc2\u0db1\u0dca \u0d86\u0dbb\u0db8\u0dca\u0db7 \u0d9a\u0dbb\u0db1\u0dca\u0db1');
    assert.equal(doc.querySelector('#segMode [data-mode="paper"] span').textContent, '\u0d85\u0dc3\u0dcf \u0d9a\u0ddc\u0dc5\u0dba\u0d9a \u0dbd\u0dd2\u0dba\u0db1\u0dca\u0db1');
    assert.equal(doc.querySelector('#segMode [data-mode="type"] span').textContent, '\u0db4\u0dd2\u0dc5\u0dd2\u0dad\u0dd4\u0dbb\u0dd4 \u0da7\u0dba\u0dd2\u0db4\u0dca \u0d9a\u0dbb\u0db1\u0dca\u0db1');
    assert.match(doc.querySelector('#creditBar').textContent, /\u0db1\u0dd2\u0dbb\u0dca\u0db8\u0dcf\u0dab\u0dba: Hansana/);
    assert.equal(q.T('repeatWord'), '\u0dc0\u0da0\u0db1\u0dba \u0db1\u0dd0\u0dc0\u0dad \u0d85\u0dc3\u0db1\u0dca\u0db1');
    assert.equal(q.T('imReady'), '\u0db8\u0db8 \u0dc3\u0dd6\u0daf\u0dcf\u0db1\u0db8\u0dca');
    q.UI.setLang('en');
    assert.equal(doc.querySelector('#tab-home span').textContent, 'Home');
    assert.equal(doc.querySelector('#creditBar').textContent.trim(), CREDIT);
  } finally { a.close(); }
});

test('Welcome Guide: language selector, credit banner and four bilingual steps', function () {
  const a = harness();
  try {
    const q = a.q, doc = a.w.document;
    q.welcomeGuide();
    let sheet = doc.querySelector('#sheets .sheet');
    assert.ok(sheet, 'the guide opens');
    assert.match(sheet.querySelector('h2').textContent, /Welcome/);
    assert.equal(sheet.querySelectorAll('.seg button').length, 2, 'English | Sinhala at the top');
    assert.match(sheet.textContent, /Created by Hansana/);
    assert.equal(sheet.querySelectorAll('.guide-step').length, 4, 'four steps');
    assert.match(sheet.textContent, /British female professor voice/);

    /* switching language inside the guide rebuilds it in Sinhala */
    q.UI.setLang('si');
    q.welcomeGuide();
    sheet = doc.querySelector('#sheets .sheet');
    assert.equal(sheet.querySelectorAll('.guide-step').length, 4);
    assert.match(sheet.textContent, /\u0d85\u0daf\u0dc4\u0dc3: Ayya01 \(Lesandu\)/);
    assert.match(sheet.querySelectorAll('.guide-step b')[0].textContent, /\u0dc3\u0dd6\u0daf\u0dcf\u0db1\u0db8\u0dca/);
    /* first run marks the guide as seen so it does not reopen on every boot */
    q.DB.data.tourSeen = false;
    q.firstRunTour();
    assert.equal(q.DB.data.tourSeen, true);
  } finally { a.close(); }
});

test('lecturer mode: PIN 7898 and class stats built only from real results', function () {
  const a = harness();
  try {
    const q = a.q, doc = a.w.document;
    assert.equal(require('./test-pin.cjs'), '7898');
    q.DB.data.results = [];
    q.DB.data.history = [{ id: 'mine', score: 25, wordCount: 30, percent: 83 }];
    q.Admin.unlocked = true;
    q.Admin.tab = 'stats';
    q.Admin.panel();
    let text = doc.querySelector('#adminHost').textContent;
    assert.match(text, /No student results yet/);
    assert.ok(text.indexOf('personal session') >= 0);

    q.DB.data.results = [{ id: 'r1', ts: Date.now(), sessionNo: '7', wordCount: 30, score: 27, percent: 90, name: 'Otter', deviceType: 'Android', ukVoice: true, mode: 'paper' }];
    q.Admin.renderTab();
    text = doc.querySelector('#adminHost').textContent;
    assert.match(text, /1 student completion from 1 student/);
    assert.match(text, /90%/);
    assert.ok(html.includes('var rows = (d.results || []).slice(0)'), 'stats read d.results, never history');
  } finally { a.close(); }
});
