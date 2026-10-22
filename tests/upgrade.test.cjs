/* Release 2.0.0 (ver 8) - Session 7 "Travel & Transport" (22/10/2026).
   Written from scratch for v8. It locks down the three root causes of the
   "word is spoken 3 or 4 times" bug:
     1. Eng.buildBeats() emits EXACTLY st.repeats word-say beats (2 by default)
        and never one leading word beat plus a repeat loop;
     2. Speech.say() keeps a strict single-engine lock per utterance, so a
        beat that already produced sound is never re-spoken by the device
        synthesiser, and the old retry never rewinds the queue;
     3. a started British recording owns its beat (no fallback echo).
   It also pins the studio British female voice (Polly Amy en-GB), the zero
   lag preload, the 5 second timer, the bilingual shell, the credits and the
   real-time ntfy sync. */
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
const CREDIT_SI = '\u0db1\u0dd2\u0dbb\u0dca\u0db8\u0dcf\u0dab\u0dba: Hansana \u00b7 \u0d85\u0daf\u0dc4\u0dc3: Ayya01 (Lesandu) \u00b7 \u0db7\u0dcf\u0dbb\u0d9a\u0dcf\u0dbb \u0d9a\u0dae\u0dd2\u0d9a\u0dcf\u0da0\u0dcf\u0dbb\u0dca\u0dba: Sumodya Sewmini';

const sayBeats = function (beats) {
  return Array.from(beats).filter(function (b) { return b.t === 'say'; });
};
const wordBeats = function (beats) {
  return Array.from(beats).filter(function (b) { return b.t === 'say' && b.isWord; });
};

test('release metadata: version 2.0.0, data ver 8, Session 7 defaults', function () {
  assert.equal(versionJson.version, '2.0.0');
  assert.ok(Number(versionJson.ver) >= 8, 'data ver is 8 or newer');
  assert.ok(Number(versionJson.settingsRev) >= 8, 'settings revision is 8 or newer');
  assert.equal(versionJson.session, '7');
  assert.equal(versionJson.title, APP);

  assert.equal(configJson.version, '2.0.0');
  assert.ok(Number(configJson.ver) >= 8);
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
  assert.match(configJson.live.state, /^https:\/\/ntfy\.sh\/sdp_dictationb1_state_v8$/);
  assert.match(configJson.live.community, /^https:\/\/ntfy\.sh\/sdp_dictationb1_comm_v8$/);
  assert.match(configJson.live.inbox, /^https:\/\/ntfy\.sh\/sdp_dictationb1_inbox_v8$/);
});

test('session.json holds exactly the 30 Travel & Transport words', function () {
  assert.ok(Number(sessionJson.ver) >= 8);
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
  /* only Session 7 survives: no older list, plan date or word is left behind */
  const words = sessionJson.lists.map(function (l) { return l.words.map(function (w) { return w.w; }); }).flat();
  for (const gone of ['athlete', 'hobbies', 'appointment', 'badminton', 'rainbow']) {
    assert.ok(words.indexOf(gone) < 0, 'old word removed: ' + gone);
  }
  assert.equal(sessionJson.plan.filter(function (p) { return p.key === 'd2026-10-22'; }).length, 1);
});

test('all 30 words are in both session.json and index.html', function () {
  for (const word of TRAVEL) {
    assert.ok(html.includes(word), 'index.html has ' + word);
  }
  assert.ok(html.includes(APP), 'index.html names the session');
  assert.ok(html.includes('var SAMPLE_LIST_ID = "' + LIST_ID + '"'));
  assert.ok(html.includes('CCBE Galle Branch'), 'index.html names the branch');
});

test('index.html carries the v8 key, schema, timer, credits, Amy voice and sync hooks', function () {
  assert.ok(html.includes('APP_VERSION = "2.0.0"'));
  assert.ok(html.includes('key: "sdp.v8_session7",'));
  assert.ok(html.includes('schema: 8,'));
  assert.ok(html.includes('settingsRev: 8,'));
  assert.ok(html.includes('settingsRev < 8'));
  assert.ok(html.includes('writeFixed: 5'));
  assert.ok(html.includes('sentence: false'));
  assert.ok(html.includes('repeats: 2'));
  assert.ok(html.includes('rate: 0.88'));
  assert.ok(html.includes('id="sdpAudio"'));
  assert.ok(html.includes('preload="auto"'));
  assert.ok(html.includes('playsinline'));
  assert.ok(html.includes('voice=Amy'), 'primary British female Polly voice');
  assert.ok(html.includes('voice=Emma'), 'British female failover');
  assert.ok(html.includes('translate.google.com/translate_tts'));
  assert.ok(html.includes('api.streamelements.com/kappa/v2/speech'));
  assert.ok(html.includes('api.dictionaryapi.dev'));
  assert.ok(html.includes('ntfy.sh'));
  assert.ok(html.includes('sdp_dictationb1_state_v8'));
  assert.ok(html.includes('EventSource'));
  assert.ok(html.includes('cancelAnimationFrame'));
  assert.ok(html.includes('Save & Publish Live Now'));
  assert.ok(html.includes('Hansana'));
  assert.ok(html.includes('Ayya01'));
  assert.ok(html.includes('Lesandu'));
  assert.ok(html.includes('Sumodya Sewmini'));
  assert.ok(html.includes('\u0dc3\u0dd2\u0d82\u0dc4\u0dbd'));
  /* Sinhala is stored as \u escapes inside the single-file app */
  assert.ok(html.includes('\\u0db7\\u0dcf\\u0dbb\\u0d9a\\u0dcf\\u0dbb \\u0d9a\\u0dae\\u0dd2\\u0d9a\\u0dcf\\u0da0\\u0dcf\\u0dbb\\u0dca\\u0dba'),
    'the full Sinhala credit line (' + CREDIT_SI + ')');
});

test('in-app defaults: Session 7 list, 5 second timer, 2 repeats, paper mode', function () {
  const a = harness();
  try {
    const q = a.q, d = q.DB.data;
    assert.equal(q.CONFIG.key, 'sdp.v8_session7');
    assert.equal(q.CONFIG.schema, 8);
    assert.equal(d.settingsRev, 8);
    assert.equal(d.lists.length, 1);
    assert.equal(d.lists[0].id, LIST_ID);
    assert.equal(d.lists[0].name, APP);
    assert.equal(d.lists[0].words.length, 30);
    assert.deepEqual(Array.from(d.lists[0].words, function (w) { return w.w; }), TRAVEL);
    assert.equal(d.session.no, '7');
    assert.equal(d.session.date, '2026-10-22');
    assert.equal(d.session.title, APP);
    assert.equal(d.settings.lang, 'en');
    assert.equal(d.settings.writeMode, 'fixed');
    assert.equal(d.settings.writeFixed, 5);
    assert.equal(d.settings.sentence, false);
    assert.equal(d.settings.repeats, 2);
    assert.equal(d.settings.rate, 0.88);
    assert.equal(d.settings.numbers, true);
    assert.equal(d.settings.mode, 'paper');
    assert.equal(q.defaultData().tourSeen, false, 'a new install shows the Welcome Guide');
  } finally { a.close(); }
});

test('Home hero, header subtitle and About show the Session 7 credits', function () {
  const a = harness();
  try {
    const doc = a.w.document;
    assert.equal(doc.querySelector('#homeKicker').textContent, 'SESSION 7 \u00b7 22/10/2026 \u00b7 CCBE GALLE BRANCH');
    assert.equal(doc.querySelector('#homeTitle').textContent, APP);
    assert.equal(doc.querySelector('#creditBar').textContent.trim(), CREDIT);
    assert.equal(doc.querySelector('#homeCredits').textContent.trim(), CREDIT);
    assert.equal(doc.querySelector('#brandCredit').textContent.trim(), CREDIT);
    a.q.UI.setTab('set');
    assert.ok(doc.querySelector('#screen-set').textContent.indexOf(CREDIT) >= 0, 'About carries the credit');
  } finally { a.close(); }
});

test('migrate: any pre-v8 cache is replaced and the guide is shown again', function () {
  const a = harness();
  try {
    const q = a.q;
    const old = JSON.parse(JSON.stringify(q.defaultData()));
    old.settingsRev = 7;
    old.v = 7;
    old.tourSeen = true;
    old.lists = [{ id: 'list_session_6_travel', name: 'Session 6 - Travel & Transport', version: 2, published: true,
      words: [{ w: 'travel', s: 'We travel by train every day.', m: 'to make a journey' }] }];
    old.plan = { weekdays: ['', '', '', '', '', '', ''], dates: { '2026-10-19': 'list_session_6_travel' }, pinned: 'list_session_6_travel', defaultList: 'list_session_6_travel' };
    old.session = { no: '6', day: 'Tuesday', autoDay: false, date: '2026-10-19', title: 'Session 6 - Travel & Transport', listId: 'list_session_6_travel' };
    old.snapshot = { idx: 7 };
    old.sessions = [{ id: 'past' }];
    old.outbox = [{ action: 'comment' }];
    const d = q.DB.migrate(old);
    assert.equal(d.settingsRev, 8);
    assert.equal(d.v, 8);
    assert.equal(d.lists.length, 1);
    assert.equal(d.lists[0].name, APP);
    assert.equal(d.lists[0].words.length, 30);
    assert.equal(d.lists[0].words[0].w, 'guidebook');
    assert.equal(d.settings.writeFixed, 5);
    assert.equal(d.settings.writeMode, 'fixed');
    assert.equal(d.settings.sentence, false);
    assert.equal(d.settings.repeats, 2);
    assert.equal(d.settings.rate, 0.88);
    assert.equal(d.session.no, '7');
    assert.equal(d.session.date, '2026-10-22');
    assert.equal(d.tourSeen, false, 'the bilingual Welcome Guide is shown again');
    assert.ok(!('snapshot' in d), 'snapshot dropped');
    assert.equal(d.sessions.length, 0);
    assert.equal(d.outbox.length, 0);
    assert.ok(!d.lists.some(function (l) { return l.words.some(function (w) { return w.w === 'athlete'; }); }));
  } finally { a.close(); }
});

test('BUG 1: buildBeats() says the word EXACTLY twice and never 3 or 4 times', function () {
  const a = harness();
  try {
    const q = a.q;
    q.Eng.words = Array.from(q.DB.data.lists[0].words);
    q.Eng.order = q.Eng.words.map(function (_, i) { return i; });
    const beats = q.Eng.buildBeats(0);
    const words = wordBeats(beats);
    assert.equal(words.length, 2, 'exactly two word-say beats, got ' + words.length);
    assert.equal(words[0].text, 'guidebook');
    assert.equal(words[1].text, 'guidebook');
    /* the number prompt is its own single beat, before the word */
    const nums = sayBeats(beats).filter(function (b) { return b.isNum; });
    assert.equal(nums.length, 1);
    assert.equal(nums[0].text, 'Number 1.');
    assert.equal(sayBeats(beats)[0].isNum, true, 'the number comes first');
    assert.equal(sayBeats(beats).length, 3, 'number + the word twice');
    assert.ok(!sayBeats(beats).some(function (b) { return b.text === q.DB.data.lists[0].words[0].s; }),
      'the sentence waits for its own stage');
    /* a pause between the two readings, then the 5 second writing timer */
    const seq = Array.from(beats, function (b) { return b.t; });
    assert.deepEqual(seq, ['say', 'wait', 'say', 'wait', 'say', 'write']);
    const write = beats[beats.length - 1];
    assert.equal(write.t, 'write');
    assert.equal(write.secs, 5);
    /* "tyre/tire" is spoken as "tyre", never "tyre slash tire" */
    q.Eng.order = [25];
    const tyre = wordBeats(q.Eng.buildBeats(25));
    assert.deepEqual(tyre.map(function (b) { return b.text; }), ['tyre', 'tyre']);
    /* a different repeat setting is respected exactly, with no hidden extra */
    q.Eng.order = [0];
    q.DB.data.settings.repeats = 1;
    assert.equal(wordBeats(q.Eng.buildBeats(0)).length, 1);
    q.DB.data.settings.repeats = 3;
    assert.equal(wordBeats(q.Eng.buildBeats(0)).length, 3);
    q.DB.data.settings.repeats = 2;
    q.DB.data.settings.numbers = false;
    const plain = q.Eng.buildBeats(0);
    assert.equal(sayBeats(plain).length, 2, 'numbers off: the word only, twice');
    assert.equal(wordBeats(plain).length, 2);
    /* with the sentence switched on it is read once, after both word beats */
    q.DB.data.settings.numbers = true;
    q.DB.data.settings.sentence = true;
    const withSentence = q.Eng.buildBeats(0);
    const order = Array.from(sayBeats(withSentence), function (b) { return b.isNum ? 'N' : (b.isSentence ? 'S' : 'W'); });
    assert.deepEqual(order, ['N', 'W', 'W', 'S']);
    assert.equal(wordBeats(withSentence).length, 2, 'the sentence never adds a third word reading');
  } finally { a.close(); }
});

test('BUG 2: one engine per utterance - no retry rewind, no fallback echo', function () {
  /* the old bug: a retry rewound the queue index and spoke the same item again */
  assert.ok(html.indexOf('qi--') < 0, 'the queue is never rewound');
  assert.ok(!/if\s*\(res && res\.err && res\.err !== "canceled" && online/.test(html),
    'the failed device utterance no longer re-enters the streaming tier');
  /* the strict single-engine lock is present */
  assert.ok(html.includes('audioStarted'));
  assert.ok(html.includes('partDone'));
  assert.ok(html.includes('2200'), 'a 2200 ms connection timeout before any sound');
  assert.ok(html.includes('Math.max(6000, ms || 6000)'), 'a generous completion timeout after sound');
  assert.ok(html.includes('audioStarted === false') || html.includes('!audioStarted'),
    'fallback is gated on nothing having been heard');

  const a = harness();
  try {
    const q = a.q;
    let played = [];
    let calls = 0;
    /* a British recording really starts: the device voice must stay silent */
    q.Speech.playAudio = function (src, rate, ms, cb) { played.push(src); cb(true, true); };
    q.Speech.say(['guidebook'], { word: 'guidebook' }, function () { calls++; });
    a.clock.tick(4000);
    assert.equal(calls, 1, 'the completion callback runs once');
    assert.equal(played.length, 1, 'exactly one recording was played');
    assert.equal(q.Speech.lastTier, 'dictionary');

    /* nothing played: every source is offered once and the sentence moves on */
    played = [];
    calls = 0;
    q.Speech.playAudio = function (src, rate, ms, cb) { played.push(src); cb(false, false); };
    q.Speech.say(['harbour'], { word: 'harbour' }, function () { calls++; });
    a.clock.tick(4000);
    assert.equal(calls, 1);
    assert.equal(played.length, 6, 'dictionary MP3, -uk.mp3, Wiktionary, Amy, Emma, Google - each once');

    /* sound started and then errored: it must NOT be spoken a second time */
    played = [];
    calls = 0;
    q.Speech.playAudio = function (src, rate, ms, cb) { played.push(src); cb(false, true); };
    q.Speech.say(['luggage'], { word: 'luggage' }, function () { calls++; });
    a.clock.tick(4000);
    assert.equal(played.length, 1, 'a started recording is never retried by another engine');
    assert.equal(calls, 1);

    /* three parts, three plays, one completion */
    played = [];
    calls = 0;
    q.Speech.playAudio = function (src, rate, ms, cb) { played.push(src); cb(true, true); };
    q.Speech.say(['one', 'two', 'three'], {}, function () { calls++; });
    a.clock.tick(4000);
    assert.equal(played.length, 3);
    assert.equal(calls, 1);

    /* the recording is sounding when the 2400 ms guard expires: the device
       voice must stay silent even though the beat has not ended yet. */
    const w = a.w;
    const deviceSpoken = [];
    Object.defineProperty(w, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: function () { return [{ name: 'Microsoft Sonia', lang: 'en-GB', localService: true }]; },
        speak: function (u) { deviceSpoken.push(u.text); w.setTimeout(function () { if (u.onend) u.onend(); }, 5); },
        cancel: function () {}, pause: function () {}, resume: function () {}
      }
    });
    w.SpeechSynthesisUtterance = function (text) { this.text = text; };
    q.Speech.supported = true;
    q.Speech.textOnly = false;
    q.Speech.ukVoices = [{ name: 'Microsoft Sonia', lang: 'en-GB', localService: true }];
    q.Speech.chosen = q.Speech.ukVoices[0];
    calls = 0;
    q.Speech.playAudio = function (src, rate, ms, cb) {
      q.Speech.audioStarted = true;
      w.setTimeout(function () { cb(true, true); }, 5000);
    };
    q.Speech.say(['journey'], { word: 'journey' }, function () { calls++; });
    a.clock.tick(6000);
    assert.deepEqual(deviceSpoken, [], 'a word that is already sounding is never echoed by the synthesiser');
    assert.equal(calls, 1);
  } finally { a.close(); }
});

test('British female professor audio: dictionary MP3, Polly Amy, Emma, Google en-GB', function () {
  const a = harness();
  try {
    const q = a.q;
    const list = q.Speech.mp3Candidates('', 'guidebook', 'guidebook');
    assert.match(list[0], /oxford\/guidebook--_gb_1\.mp3$/);
    assert.ok(list.some(function (u) { return /api\.dictionaryapi\.dev\/.*-uk\.mp3$/.test(u); }));
    assert.ok(list.some(function (u) { return /wikimedia\.org\/.*En-uk-guidebook\.ogg$/.test(u); }));

    const sources = q.Speech.streamSources('guidebook', 'guidebook');
    assert.match(sources[0], /oxford\/guidebook--_gb_1\.mp3$/);
    const amy = sources.findIndex(function (u) { return /voice=Amy/.test(u); });
    const emma = sources.findIndex(function (u) { return /voice=Emma/.test(u); });
    const google = sources.findIndex(function (u) { return /translate_tts/.test(u); });
    assert.ok(amy > 0 && emma > amy && google > emma, 'the British female chain is ordered');

    const prompt = q.Speech.streamSources('Number 3.', '');
    assert.match(prompt[0], /voice=Amy/);
    assert.match(prompt[1], /voice=Emma/);
    assert.match(prompt[2], /translate_tts/);

    /* the British female beats a male en-GB voice */
    q.Speech.voices = [{ name: 'Daniel', lang: 'en-GB', localService: true }, { name: 'Microsoft Sonia', lang: 'en-GB', localService: true }];
    q.Speech.ukVoices = q.Speech.voices.slice(0);
    assert.equal(q.Speech.pick().name, 'Microsoft Sonia');
    /* a Natural / Online neural British female wins over everything else */
    q.Speech.ukVoices = [{ name: 'Microsoft Sonia', lang: 'en-GB', localService: true }, { name: 'Microsoft Maisie Online (Natural)', lang: 'en-GB', localService: false }, { name: 'Daniel', lang: 'en-GB', localService: true }];
    assert.equal(q.Speech.pick().name, 'Microsoft Maisie Online (Natural)');
    /* Tier 4 prefers an English female voice, even outside the UK */
    q.Speech.voices = [{ name: 'Alex', lang: 'en-US', localService: true }, { name: 'Samantha', lang: 'en-US', localService: true }];
    assert.equal(q.Speech.anyEnglish().name, 'Samantha');

    assert.equal(q.Speech.speakText('tyre/tire'), 'tyre');
    assert.ok(html.includes('u.pitch = o.pitch === undefined ? 1.05 : o.pitch'), 'a warm British female pitch');
    assert.ok(html.includes('U.clamp(rate || 0.88, 0.65, 1.15)'), 'a natural, never sluggish cadence');
    assert.ok(html.includes('u.lang = "en-GB"'));
    /* zero-lag preload of the next word */
    assert.ok(html.includes('preload: function (text, explicit)'));
    assert.ok(html.includes('this.preloadNext();'));
  } finally { a.close(); }
});

test('Welcome Guide: EN | Sinhala selector, credit banner and four bilingual steps', function () {
  const a = harness();
  try {
    const q = a.q, doc = a.w.document;
    assert.equal(doc.querySelector('#btnLang').textContent, 'EN | \u0dc3\u0dd2\u0d82\u0dc4\u0dbd');
    assert.match(doc.querySelector('#btnGuide').textContent, /Guide/);
    q.welcomeGuide();
    let sheet = doc.querySelector('#sheets .sheet');
    assert.ok(sheet, 'the guide opens');
    assert.match(sheet.querySelector('h2').textContent, /Welcome/);
    assert.equal(sheet.querySelectorAll('.seg button').length, 2, 'English | Sinhala at the top');
    assert.match(sheet.textContent, /Created by Hansana/);
    assert.match(sheet.textContent, /Sumodya Sewmini/);
    assert.equal(sheet.querySelectorAll('.guide-step').length, 4);
    assert.match(sheet.textContent, /British female professor voice/);

    q.UI.setLang('si');
    q.welcomeGuide();
    sheet = doc.querySelector('#sheets .sheet');
    assert.equal(sheet.querySelectorAll('.guide-step').length, 4);
    assert.match(sheet.textContent, /\u0d85\u0daf\u0dc4\u0dc3: Ayya01 \(Lesandu\)/);
    assert.match(doc.querySelector('#brandCredit').textContent, /Sumodya Sewmini/);
    /* first run marks the guide as seen so it does not reopen on every boot */
    q.DB.data.tourSeen = false;
    q.firstRunTour();
    assert.equal(q.DB.data.tourSeen, true);
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
    const q = a.q, doc = a.w.document;
    q.DB.data.settings.mode = 'paper';
    q.Eng.start({});
    a.clock.tick(50);
    q.Eng.finish(true);
    a.clock.tick(9000);
    const post = q.DB.data.comments.filter(function (c) { return c.status === 'finished'; })[0];
    assert.ok(post, 'a finished completion was posted');
    assert.match(post.text, /Score: 0\/30/);
    assert.equal(q.DB.data.history[0].mode, 'paper');
    assert.equal(q.DB.data.history[0].wordCount, 30);
    const rows = doc.querySelectorAll('#layers .listrow').length;
    assert.equal(rows, 30, 'rendered ' + rows + ' word rows');
    const labels = Array.from(doc.querySelectorAll('#layers .listrow button')).map(function (b) { return b.getAttribute('aria-label') || ''; });
    assert.ok(labels.some(function (l) { return /^Got it right: guidebook$/.test(l); }));
    assert.ok(labels.some(function (l) { return /^Missed it: windscreen$/.test(l); }));
    const good = Array.from(doc.querySelectorAll('#layers .listrow button')).filter(function (b) { return /^Got it right: guidebook$/.test(b.getAttribute('aria-label') || ''); })[0];
    good.click();
    assert.equal(doc.querySelector('#layers .val').textContent, '1 / 30');
    assert.match(q.DB.data.comments[0].text, /Score: 1\/30/);
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
    q.DB.data.results = [{ id: 'r1', ts: Date.now(), sessionNo: '7', wordCount: 30, score: 27, percent: 90, name: 'Otter', deviceType: 'Android', ukVoice: true, mode: 'paper' }];
    q.Admin.renderTab();
    text = doc.querySelector('#adminHost').textContent;
    assert.match(text, /1 student completion from 1 student/);
    assert.match(text, /90%/);
    assert.ok(html.includes('var rows = (d.results || []).slice(0)'), 'stats read d.results, never history');
  } finally { a.close(); }
});

test('typed marking accepts tyre, tire and tyre/tire as 100% correct', function () {
  const a = harness();
  try {
    const q = a.q;
    assert.equal(q.Results.answerState('tyre', 'tyre/tire'), 'ok');
    assert.equal(q.Results.answerState('tire', 'tyre/tire'), 'ok');
    assert.equal(q.Results.answerState('tier', 'tyre/tire'), 'wrong');
    const scored = q.Results.scoreTypeMode([{ w: 'tyre/tire' }, { w: 'guidebook' }], [0, 1], ['tire', 'guidebook']);
    assert.equal(scored.correct, 2);
    assert.equal(scored.total, 2);
  } finally { a.close(); }
});
