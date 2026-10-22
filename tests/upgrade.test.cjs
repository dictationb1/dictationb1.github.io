/* Release 2.0.0 (ver 9) - Session 7 "Travel & Transport" (22/10/2026).
   Written from scratch with fs.writeFileSync for the v9 unified-voice release.

   v9 locks 100% of the dictation audio to ONE single British female
   professor voice (AWS Polly "Amy", en-GB) so a male and a female speaker
   can never alternate inside a dictation:
     1. Speech.say / Dict.speak / Speech.spell route EVERY utterance -
        "Are you ready?", "3", "2", "1", "Number 1.", single words,
        multi-word phrases and spelling letters - through #sdpAudio with
        the voice=Amy Streamelements URL; the only failover is the Google
        Translate en-GB female TTS, and only if "Amy" fails to load;
     2. Oxford/dictionary MP3s are never played during dictation (half of
        those recordings are spoken by a man), and window.speechSynthesis
        is only the offline/last-resort fallback with male voices purged;
     3. Eng.buildBeats() emits EXACTLY st.repeats word-say beats (2 by
        default - never 3 or 4) and Speech.say() keeps the strict
        single-engine mutex (partDone / audioStarted, no qi-- retry), so
        #sdpAudio and window.speechSynthesis never both speak one beat;
     4. the next word's voice=Amy URL is preloaded during the 5-second
        writing countdown, so every word plays with 0 ms delay. */
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
const UNIFIED_VOICE = 'British Female Professor Voice (Amy \u00b7 en-GB)';

const sayBeats = function (beats) {
  return Array.from(beats).filter(function (b) { return b.t === 'say'; });
};
const wordBeats = function (beats) {
  return Array.from(beats).filter(function (b) { return b.t === 'say' && b.isWord; });
};
/* every source the unified engine is allowed to use */
const isUnifiedFemaleUrl = function (src) {
  return /voice=Amy|translate_tts/.test(src);
};
const isMaleOrDictionaryUrl = function (src) {
  return /ssl\.gstatic|dictionaryapi|wikimedia|_gb_1|-uk\.mp3|voice=Emma|Daniel|Ryan|George/i.test(src);
};

test('release metadata: version 2.0.0, data ver 9+, Session 7 defaults', function () {
  assert.equal(versionJson.version, '2.0.0');
  assert.ok(Number(versionJson.ver) >= 9, 'data ver is 9 or newer');
  assert.ok(Number(versionJson.settingsRev) >= 9, 'settings revision is 9 or newer');
  assert.equal(versionJson.session, '7');
  assert.equal(versionJson.title, APP);

  assert.equal(configJson.version, '2.0.0');
  assert.ok(Number(configJson.ver) >= 9);
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
  assert.ok(Number(sessionJson.ver) >= 9);
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
    assert.ok(html.includes(word), 'index.html has ' + word);
  }
  assert.ok(html.includes(APP), 'index.html names the session');
  assert.ok(html.includes('var SAMPLE_LIST_ID = "' + LIST_ID + '"'));
  assert.ok(html.includes('CCBE Galle Branch'), 'index.html names the branch');
});

test('index.html carries the v9 key, schema, unified Amy voice, credits and sync hooks', function () {
  assert.ok(html.includes('APP_VERSION = "2.0.0"'));
  assert.ok(html.includes('key: "sdp.v9_session7",'));
  assert.ok(html.includes('schema: 9,'));
  assert.ok(html.includes('settingsRev: 9,'));
  assert.ok(html.includes('settingsRev < 9'));
  assert.ok(html.includes('writeFixed: 5'));
  assert.ok(html.includes('sentence: false'));
  assert.ok(html.includes('repeats: 2'));
  assert.ok(html.includes('rate: 0.88'));
  assert.ok(html.includes('id="sdpAudio"'));
  assert.ok(html.includes('preload="auto"'));
  assert.ok(html.includes('playsinline'));
  /* the one unified British female professor voice */
  assert.ok(html.includes('voice=Amy'), 'primary unified British female voice');
  assert.ok(html.includes('api.streamelements.com/kappa/v2/speech'));
  assert.ok(html.includes('translate.google.com/translate_tts'), 'female en-GB failover');
  assert.ok(html.includes('tl=en-GB'));
  assert.ok(html.indexOf('voice=Emma') < 0, 'no second TTS voice in the chain');
  assert.ok(html.includes('British Female Professor Voice (Amy \\u00b7 en-GB)'), 'Settings shows the unified voice');
  /* real-time ntfy.sh sync */
  assert.ok(html.includes('ntfy.sh'));
  assert.ok(html.includes('sdp_dictationb1_state_v8'));
  assert.ok(html.includes('EventSource'));
  assert.ok(html.includes('cancelAnimationFrame'));
  assert.ok(html.includes('Save & Publish Live Now'));
  /* creator credits */
  assert.ok(html.includes('Hansana'));
  assert.ok(html.includes('Ayya01'));
  assert.ok(html.includes('Lesandu'));
  assert.ok(html.includes('Sumodya Sewmini'));
  assert.ok(html.includes('\u0dc3\u0dd2\u0d82\u0dc4\u0dbd'));
  /* Sinhala is stored as \u escapes inside the single-file app */
  assert.ok(html.includes('\\u0db7\\u0dcf\\u0dbb\\u0d9a\\u0dcf\\u0dbb \\u0d9a\\u0dae\\u0dd2\\u0d9a\\u0dcf\\u0da0\\u0dcf\\u0dbb\\u0dca\\u0dba'),
    'the full Sinhala credit line');
  /* Admin PIN 7898 stays the seeded convenience-lock PIN */
  assert.equal(require('./test-pin.cjs'), '7898');
});

test('in-app defaults: Session 7 list, 5 second timer, 2 repeats, paper mode', function () {
  const a = harness();
  try {
    const q = a.q, d = q.DB.data;
    assert.equal(q.CONFIG.key, 'sdp.v9_session7');
    assert.equal(q.CONFIG.schema, 9);
    assert.equal(d.settingsRev, 9);
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

test('migrate: pre-v9 caches are reinstalled and male device voices are purged', function () {
  const a = harness();
  try {
    const q = a.q;
    const old = JSON.parse(JSON.stringify(q.defaultData()));
    old.settingsRev = 7;
    old.v = 7;
    old.tourSeen = true;
    old.settings.voiceName = 'Daniel';
    old.lists = [{ id: 'list_session_6_travel', name: 'Session 6 - Travel & Transport', version: 2, published: true,
      words: [{ w: 'travel', s: 'We travel by train every day.', m: 'to make a journey' }] }];
    old.plan = { weekdays: ['', '', '', '', '', '', ''], dates: { '2026-10-19': 'list_session_6_travel' }, pinned: 'list_session_6_travel', defaultList: 'list_session_6_travel' };
    old.session = { no: '6', day: 'Tuesday', autoDay: false, date: '2026-10-19', title: 'Session 6 - Travel & Transport', listId: 'list_session_6_travel' };
    old.snapshot = { idx: 7 };
    old.sessions = [{ id: 'past' }];
    old.outbox = [{ action: 'comment' }];
    const d = q.DB.migrate(old);
    assert.equal(d.settingsRev, 9);
    assert.equal(d.v, 9);
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
    assert.equal(d.settings.voiceName, '', 'the male Daniel voice is purged');

    /* every mandated male name is purged, on every migrate() */
    for (const male of ['Daniel', 'Oliver', 'Arthur', 'George', 'Ryan', 'Male UK voice', 'David', 'Mark', 'James', 'Thomas', 'Fred', 'Alex', 'Aaron']) {
      const d2 = q.DB.migrate(JSON.parse(JSON.stringify(q.defaultData())));
      d2.settings.voiceName = male;
      const done = q.DB.migrate(d2);
      assert.equal(done.settings.voiceName, '', 'male voice purged: ' + male);
      assert.equal(done.settingsRev, 9);
    }
    /* a women's voice is NEVER purged - "Female" contains "male" but must survive */
    for (const female of ['Microsoft Sonia', 'Google UK English Female', 'Microsoft Libby', 'Maisie']) {
      const d3 = q.DB.migrate(JSON.parse(JSON.stringify(q.defaultData())));
      d3.settings.voiceName = female;
      const done = q.DB.migrate(d3);
      assert.equal(done.settings.voiceName, female, 'female voice kept: ' + female);
    }
    assert.equal(q.Speech.isMaleName('Daniel'), true);
    assert.equal(q.Speech.isMaleName('Ryan'), true);
    assert.equal(q.Speech.isMaleName('George'), true);
    assert.equal(q.Speech.isMaleName('Google UK English Female'), false);
    assert.equal(q.Speech.isMaleName('Microsoft Sonia'), false);
  } finally { a.close(); }
});

test('BUG 1: buildBeats() says the word EXACTLY twice and never 3 or 4 times', function () {
  const a = harness();
  try {
    const q = a.q;
    assert.equal(q.DB.data.settings.repeats, 2, 'default repeats is 2');
    assert.equal(q.DB.data.settings.sentence, false, 'default sentence is off');
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
    /* say Number -> wait 400 -> say word -> wait 1200 -> say word -> write 5s */
    const seq = Array.from(beats, function (b) { return b.t; });
    assert.deepEqual(seq, ['say', 'wait', 'say', 'wait', 'say', 'write']);
    assert.equal(beats[1].ms, 400, '400 ms after the number prompt');
    assert.equal(beats[3].ms, 1200, 'pauseWord (1.2 s) between the two readings');
    const write = beats[beats.length - 1];
    assert.equal(write.t, 'write');
    assert.equal(write.secs, 5, '5-second writing countdown');
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
    q.DB.data.settings.sentence = false;
  } finally { a.close(); }
});

test('UNIFIED VOICE: every part is spoken by the one Amy female voice on #sdpAudio', function () {
  const a = harness();
  try {
    const q = a.q, w = a.w;
    /* the device synthesiser must stay completely silent while online audio works */
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
    const played = [];
    q.Speech.playAudio = function (src, rate, ms, cb) { played.push(src); cb(true, true); };

    const parts = [
      'Are you ready?', '3', '2', '1', 'Number 1.', 'guidebook', 'on business',
      'tourist information centre', 'tyre/tire',
      'Well done! That is the end of the dictation. Now check your answers.'
    ];
    for (let i = 0; i < parts.length; i++) {
      q.Speech.say([parts[i]], {}, function () {});
      a.clock.tick(3000);
    }
    q.Speech.spell('visa', function () {});
    a.clock.tick(3000);

    /* one play per part (6 spelling parts: word + 4 letters + word) */
    assert.equal(played.length, parts.length + 6, 'played ' + played.length + ' sources');
    for (const src of played) {
      assert.ok(isUnifiedFemaleUrl(src), 'unified female source: ' + src);
      assert.ok(!isMaleOrDictionaryUrl(src), 'no male/dictionary source: ' + src);
    }
    assert.ok(played.every(function (src) { return /voice=Amy/.test(src); }),
      'voice=Amy leads every single utterance');
    assert.ok(played.some(function (src) { return /text=tyre/.test(src); }), '"tyre/tire" is spoken as "tyre"');
    assert.ok(played.some(function (src) { return /text=Number%201\./.test(src); }), 'the number prompt uses Amy');
    assert.ok(played.some(function (src) { return /text=tourist%20information%20centre/.test(src); }), 'phrases use Amy');
    assert.ok(played.some(function (src) { return /text=vee/.test(src); }), 'spelling letters use Amy');
    assert.deepEqual(deviceSpoken, [], 'window.speechSynthesis never speaks while online audio works');
    assert.equal(q.Speech.lastTier, 'polly-amy');
  } finally { a.close(); }
});

test('UNIFIED VOICE: Amy failover is only the Google en-GB female TTS', function () {
  const a = harness();
  try {
    const q = a.q;
    const sources = q.Speech.streamSources('Number 3.');
    assert.equal(sources.length, 2, 'exactly two unified sources');
    assert.match(sources[0], /voice=Amy/);
    assert.match(sources[1], /translate_tts/);
    const wordSources = q.Speech.streamSources('tyre/tire');
    assert.match(wordSources[0], /text=tyre/);
    assert.match(wordSources[1], /[?&]q=tyre/);
    /* an attached Oxford MP3 URL can never enter the playback chain */
    assert.equal(q.Speech.streamSources('guidebook').length, 2);
    assert.ok(!q.Speech.streamSources('guidebook').some(isMaleOrDictionaryUrl));

    /* Amy fails to load: only then does the Google female failover play */
    const played = [];
    q.Speech.playAudio = function (src, rate, ms, cb) {
      played.push(src);
      if (/voice=Amy/.test(src)) cb(false, false); else cb(true, true);
    };
    q.Speech.say(['Number 2.'], {}, function () {});
    a.clock.tick(3000);
    assert.equal(played.length, 2, 'Amy once, Google failover once - nothing else');
    assert.match(played[0], /voice=Amy/);
    assert.match(played[1], /translate_tts/);
  } finally { a.close(); }
});

test('BUG 2: one engine per beat - no retry rewind, no fallback echo', function () {
  /* the old bug: a retry rewound the queue index and spoke the same item again */
  assert.ok(html.indexOf('qi--') < 0, 'the queue is never rewound');
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
    /* unified audio really starts: the device voice must stay silent */
    q.Speech.playAudio = function (src, rate, ms, cb) { played.push(src); cb(true, true); };
    q.Speech.say(['guidebook'], { word: 'guidebook' }, function () { calls++; });
    a.clock.tick(4000);
    assert.equal(calls, 1, 'the completion callback runs once');
    assert.equal(played.length, 1, 'exactly one source was played');

    /* nothing played: both unified sources are offered once and the part moves on */
    played = [];
    calls = 0;
    q.Speech.playAudio = function (src, rate, ms, cb) { played.push(src); cb(false, false); };
    q.Speech.say(['harbour'], { word: 'harbour' }, function () { calls++; });
    a.clock.tick(4000);
    assert.equal(calls, 1);
    assert.equal(played.length, 2, 'Amy and the Google failover - each once');

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

    /* the audio is sounding when the 2400 ms guard expires: the device
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

test('Speech.pick() excludes male voices whenever a female voice exists', function () {
  const a = harness();
  try {
    const q = a.q;
    /* British female beats a male en-GB voice */
    q.Speech.voices = [{ name: 'Daniel', lang: 'en-GB', localService: true }, { name: 'Microsoft Sonia', lang: 'en-GB', localService: true }];
    q.Speech.ukVoices = q.Speech.voices.slice(0);
    assert.equal(q.Speech.pick().name, 'Microsoft Sonia');
    /* the mandated British female ranking decides between women */
    q.Speech.ukVoices = [
      { name: 'Daniel', lang: 'en-GB', localService: true },
      { name: 'Microsoft Maisie Online (Natural)', lang: 'en-GB', localService: false },
      { name: 'Microsoft Libby', lang: 'en-GB', localService: true }
    ];
    assert.equal(q.Speech.pick().name, 'Microsoft Libby', 'the rank order is Sonia > Libby > Maisie > ...');
    q.Speech.ukVoices = [
      { name: 'Ryan', lang: 'en-GB', localService: true },
      { name: 'Google UK English Female', lang: 'en-GB', localService: false }
    ];
    assert.equal(q.Speech.pick().name, 'Google UK English Female');
    /* a saved male voiceName is never honoured */
    q.DB.data.settings.voiceName = 'Daniel';
    q.Speech.ukVoices = [{ name: 'Daniel', lang: 'en-GB', localService: true }, { name: 'Microsoft Hazel', lang: 'en-GB', localService: true }];
    assert.equal(q.Speech.pick().name, 'Microsoft Hazel');
    q.DB.data.settings.voiceName = '';
    /* only when the device has NO female voice at all may a male en-GB
       voice keep the dictation from going silent */
    q.Speech.ukVoices = [{ name: 'Daniel', lang: 'en-GB', localService: true }];
    assert.equal(q.Speech.pick().name, 'Daniel');
    /* the rank list itself is exactly the mandated one */
    assert.deepEqual(Array.from(q.Speech.femaleRank), [
      'Microsoft Sonia', 'Microsoft Libby', 'Maisie', 'Google UK English Female',
      'Serena', 'Kate', 'Martha', 'Stephanie', 'Shelley', 'Microsoft Hazel'
    ]);
  } finally { a.close(); }
});

test('Settings \u2192 Voice shows the unified British Female Professor voice', function () {
  const a = harness();
  try {
    const q = a.q, doc = a.w.document;
    q.UI.setTab('set');
    const text = doc.querySelector('#screen-set').textContent;
    assert.ok(text.indexOf(UNIFIED_VOICE) >= 0, 'the active unified voice is shown');
    assert.ok(text.indexOf('Offline device voice (fallback only)') >= 0, 'the device picker is only a fallback');
  } finally { a.close(); }
});

test('preload: the next word is fetched as a voice=Amy URL during the write countdown', function () {
  assert.ok(html.includes('preload: function (text)'));
  assert.ok(html.includes('this.preloadNext();'), 'the write beat starts the preload');
  assert.ok(html.includes('U.clamp(o.rate || (DB.data ? DB.data.settings.rate : 0.88), 0.65, 1.15)'),
    'sdpAudio.playbackRate uses the unified clamp');
  const a = harness();
  try {
    const q = a.q;
    const el = q.Speech.preload('guidebook');
    assert.ok(el, 'a preload element is created');
    assert.match(String(el.src || ''), /voice=Amy/, 'the preloaded URL is the unified Amy voice');
    q.Eng.words = Array.from(q.DB.data.lists[0].words);
    q.Eng.order = q.Eng.words.map(function (_, i) { return i; });
    q.Eng.idx = 0;
    q.Eng.preloadNext();
    assert.ok(q.Speech.preloadCache['handlebars'], 'the next word is preloaded during the writing step');
    assert.match(String(q.Speech.preloadCache['handlebars'].src || ''), /voice=Amy/);
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
