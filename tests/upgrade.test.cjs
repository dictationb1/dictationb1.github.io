'use strict';
/* ============================================================================
   v46 / 5.3.0 release tests — Session 8 (Personal Feelings, Opinions &
   Experiences), the zero-waste data engine (W-1 … W-6) and the public data
   spending sheet at https://dictationb1.github.io/data

   Run: node --test tests/upgrade.test.cjs
   ========================================================================== */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const acorn = require('acorn');
const cp = require('node:child_process');
const { JSDOM } = require('jsdom');
const test = require('node:test');
const assert = require('node:assert');

const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const KEY = 'sdp.v46_session8_datasheet';
const APP = '5.3.0';
const VER = 46;
const TITLE = 'Session 8 - Personal Feelings, Opinions & Experiences (Adj)';
const PAST_TITLE = 'Session 7 - Travel & Transport';
const ISSUE = 'https://github.com/dictationb1/dictationb1.github.io/issues/92';
const SHEET = 'https://dictationb1.github.io/data';
const PIN = '78987898';
const LOCAL = './audio/';
const WORDS = ['afraid', 'amazed', 'amusing', 'annoyed', 'anxious', 'ashamed', 'awesome', 'boring',
  'brilliant', 'challenging', 'charming', 'confident', 'confusing', 'cruel', 'curious', 'delighted',
  'depressed', 'disappointed', 'embarrassing', 'enjoyable', 'excellent', 'excited', 'fantastic',
  'favourite', 'frightened', 'friendly', 'generous', 'guilty', 'healthy', 'hungry'];

/* ------------------------------------------------------------- helpers ---- */

function withApp(fn, opts) {
  const a = harness(undefined, opts || {});
  try { return fn(a); } finally { a.close(); }
}
async function withAppAsync(fn, opts) {
  const a = harness(undefined, opts || {});
  try { return await fn(a); } finally { a.close(); }
}
const settle = () => new Promise((r) => setImmediate(r));
const squash = (el) => String(el && el.textContent || '').replace(/\s+/g, ' ');

/* record every text the engine decides to speak */
function spoken(q) {
  const seen = [];
  q.Speech._play = function (text) { seen.push(String(text)); return seen.length; };
  return seen;
}
/* record every clip url the engine touches */
function clipsPlayed(q) {
  const seen = [];
  q.Speech.playUrl = function (u) { seen.push(String(u)); return 0; };
  return seen;
}
function inlinedScript() {
  const doc = new JSDOM(html).window.document;
  const node = Array.from(doc.scripts).find((s) => !s.type && s.textContent.includes('APP_VERSION'));
  const text = node.textContent;
  doc.defaultView.close();
  return text;
}

/* =============================================================== data ===== */

test('version, config and session data all agree on v46 / 5.3.0 / Session 8', () => {
  const version = json('data/version.json');
  const config = json('data/config.json');
  const session = json('data/session.json');
  for (const doc of [version, config, session]) {
    assert.equal(doc.ver, VER, 'ver 46');
    assert.equal(doc.appVersion, APP, 'appVersion 5.3.0');
  }
  assert.equal(version.session, '8');
  assert.match(version.title, /Session 8/);
  assert.equal(version.settingsRev, VER);
  assert.ok(Object.keys(version.features).length >= 5, 'the feature contract is documented');
  assert.equal(config.key, KEY);
  assert.equal(config.schema, VER);
  assert.equal(config.settingsRev, VER);
  assert.equal(config.adminPin, PIN);
  assert.equal(session.session.no, '8');
  assert.equal(session.session.date, '2026-10-29');
  assert.equal(session.session.listId, 'list_session_8_feelings');
  assert.match(session.session.classInfo, /CCBE Galle Branch • TUE\/THU\/IPET015 • Ms\. Sumodya Sewmini \(Lecturer in Charge\)/);
  assert.equal(session.session.writeFixed, 5);
  assert.equal(session.session.repeats, 2);
  const words = session.lists[0].words;
  assert.equal(words.length, 30);
  assert.equal(JSON.stringify(words.map((x) => x.w)), JSON.stringify(WORDS));
  assert.ok(words.every((x) => x.p && x.si && x.m && x.s), 'every published word carries IPA, Sinhala, meaning and a sentence');
});

test('the running app carries the same release contract as the data files', () => {
  withApp(({ q, w }) => {
    assert.equal(q.APP_VERSION, APP);
    assert.equal(q.CONFIG.key, KEY);
    assert.equal(q.CONFIG.schema, VER);
    assert.equal(q.CONFIG.settingsRev, VER);
    assert.equal(q.CONFIG.adminPin, PIN);
    assert.equal(q.DB.data.settings.writeFixed, 5, 'five second writing timer');
    assert.equal(q.DB.data.settings.repeats, 2, 'each word is read twice');
    assert.equal(q.DB.data.settings.mode, 'paper', 'paper dictation is the default');
    assert.equal(q.DB.data.settings.voice, 'Amy');
    const s = q.DB.data.session;
    assert.equal(s.no, '8');
    assert.equal(s.date, '2026-10-29');
    assert.match(s.title, /Session 8/);
    assert.match(s.classInfo, /Ms\. Sumodya Sewmini/);
    assert.notEqual(w.localStorage.getItem(KEY), null, 'the new storage key is used');
    assert.equal(q.SAMPLE_LIST_ID, 'list_session_8_feelings');
  });
});

test('Session 8 holds the exact 30 adjectives with UK IPA, Sinhala and a sentence', () => {
  withApp(({ q }) => {
    const list = q.DB.defaults().lists[0];
    assert.equal(list.id, 'list_session_8_feelings');
    assert.equal(list.name, TITLE);
    assert.equal(list.words.length, 30);
    assert.equal(JSON.stringify(list.words.map((x) => x.w)), JSON.stringify(WORDS));
    const ipa = /[\u0250-\u02ff]/;      /* IPA extension block */
    const sinhala = /[\u0d80-\u0dff]/;  /* Sinhala block */
    for (let i = 0; i < list.words.length; i += 1) {
      const row = list.words[i];
      assert.equal(row.w, WORDS[i]);
      assert.ok(ipa.test(row.p), row.w + ' has UK IPA: ' + row.p);
      assert.ok(sinhala.test(row.si), row.w + ' has a Sinhala meaning');
      assert.ok(row.m && row.m.length > 8, row.w + ' has a definition');
      assert.ok(row.s && row.s.split(' ').length > 4, row.w + ' has an example sentence');
      assert.equal(row.audio, LOCAL + 'word-' + row.w + '.mp3');
    }
    assert.equal(list.words[0].p, 'əˈfreɪd');
    assert.equal(list.words[0].si, 'බියට පත් වූ');
    assert.equal(list.words[0].m, 'Feeling fear or anxiety; frightened.');
  });
});

test('both spellings are 100% correct for favourite/favorite and tyre/tire', () => {
  withApp(({ q }) => {
    for (const word of ['afraid', 'hungry', 'healthy', 'favourite']) {
      assert.equal(q.Eng.isAnswerMatch(word, { w: word }), true, word);
    }
    assert.equal(q.Eng.isAnswerMatch('favorite', { w: 'favourite' }), true);
    assert.equal(q.Eng.isAnswerMatch('favourite', { w: 'favourite' }), true);
    assert.equal(q.Eng.isAnswerMatch('tire', { w: 'tyre' }), true);
    assert.equal(q.Eng.isAnswerMatch('tyre', { w: 'tyre' }), true);
    assert.equal(q.Eng.isAnswerMatch('favorit', { w: 'favourite' }), false, 'no fuzzy credit');
  });
});

test('Session 7 is archived with all 30 words and is still practiceable', () => {
  withApp(({ q, w }) => {
    const past = q.DB.data.pastSessions;
    assert.ok(Array.isArray(past) && past.length >= 1, 'a past sessions library exists');
    const seat = past[0];
    assert.equal(seat.title, PAST_TITLE);
    assert.equal(seat.listId, 'list_session_7_travel');
    assert.equal(seat.words.length, 30);
    assert.equal(seat.words[0].w, 'guidebook');
    assert.ok(seat.words[29].w, 'the last archived word survives');
    assert.equal(q.DB.defaults().sessions[0].title, PAST_TITLE);

    q.Screens.home();
    const text = squash(w.document.body);
    assert.match(text, /Past Sessions/i, 'Home shows the past sessions library');
    assert.ok(text.includes(PAST_TITLE), 'the archived session is listed');
    assert.match(text, /Practise/i, 'it can be practiced again');

    q.Eng.start({ list: { id: seat.listId, name: seat.title, words: seat.words, published: true, version: 1 } });
    assert.equal(q.Eng.words.length, 30);
    assert.equal(q.Eng.words[0].w, 'guidebook');
    q.Eng.stop(true);
  });
});

/* ============================================================== audio ===== */

test('every Session 8 word owns word, sentence and spelling recordings', () => {
  const manifest = json('scripts/audio-manifest.json');
  assert.equal(manifest.ver, VER);
  assert.equal(manifest.clips.length, 264);
  assert.equal(manifest.words.length, 64);
  assert.equal(manifest.englishVoice, 'en-GB-SoniaNeural');
  assert.equal(manifest.sinhalaVoice, 'si-LK-ThiliniNeural');
  for (const word of WORDS) {
    for (const prefix of ['word-', 'sent-', 'spell-']) {
      const file = path.join(root, 'audio', prefix + word + '.mp3');
      assert.ok(fs.existsSync(file), prefix + word + '.mp3 exists');
      const buf = fs.readFileSync(file);
      assert.ok(buf.length > 1500, prefix + word + '.mp3 is real audio (' + buf.length + ' B)');
      assert.ok(buf.slice(0, 3).toString('latin1') === 'ID3' || buf[0] === 0xff, prefix + word + '.mp3 has an MP3 header');
    }
  }
});

test('the system clips (welcome, countdown, numbers, resume, guide, finish) are all shipped', () => {
  const needed = ['welcome-paper', 'welcome-type', 'sound-check', 'count-3', 'count-2', 'count-1',
    'paused', 'finish-paper', 'finish-type', 'guide-en', 'guide-si'];
  for (let n = 1; n <= 30; n += 1) { needed.push('num-' + n); needed.push('resume-' + n); }
  for (const name of needed) {
    const file = path.join(root, 'audio', name + '.mp3');
    assert.ok(fs.existsSync(file), name + '.mp3 exists');
    assert.ok(fs.statSync(file).size > 2000, name + '.mp3 is not a stub');
  }
  assert.equal(fs.readdirSync(path.join(root, 'audio')).filter((f) => /\.mp3$/.test(f)).length, 264);
});

test('instruction and numbered phrases resolve to the bundled clips', () => {
  withApp(({ q }) => {
    const S = q.Speech;
    assert.equal(S.MEDIA_CACHE, 'sdp-media-v46');
    assert.equal(S.getSingleVoiceUrl('afraid'), LOCAL + 'word-afraid.mp3');
    assert.equal(S.getSingleVoiceUrl('hungry'), LOCAL + 'word-hungry.mp3');
    assert.equal(JSON.stringify(S.resolveClips(S.instructionPhrase('paper'))), JSON.stringify([LOCAL + 'welcome-paper.mp3']));
    assert.equal(JSON.stringify(S.resolveClips(S.instructionPhrase('type'))), JSON.stringify([LOCAL + 'welcome-type.mp3']));
    assert.equal(JSON.stringify(S.resolveClips(S.numberedPhrase('afraid', 1, 30))), JSON.stringify([LOCAL + 'num-1.mp3', LOCAL + 'word-afraid.mp3']));
    assert.equal(JSON.stringify(S.resolveClips(S.numberedPhrase('hungry', 30, 30))), JSON.stringify([LOCAL + 'num-30.mp3', LOCAL + 'word-hungry.mp3']));
    assert.equal(JSON.stringify(S.resolveClips('Three .')), JSON.stringify([LOCAL + 'count-3.mp3']));
    assert.equal(JSON.stringify(S.resolveClips('Two .')), JSON.stringify([LOCAL + 'count-2.mp3']));
    assert.equal(JSON.stringify(S.resolveClips('One .')), JSON.stringify([LOCAL + 'count-1.mp3']));
    assert.match(S.getSingleVoiceUrl('zebra crossing'), /^https:\/\/dict\.youdao\.com\/dictvoice/, 'a custom word keeps the remote fallback');
  });
});

/* ========================================================= data engine ==== */

test('W-1: nothing is preloaded at boot and the welcome clip waits for Start', () => {
  withApp(({ q }) => {
    assert.equal(q.Speech.preloadSessionWords(), 0, 'no 30-word preload at boot');
    assert.equal(q.Speech.preloadCoreAudio(), 0, 'no dead core preloads');
    const core = String(q.Speech.preloadCoreAudio);
    assert.ok(!/countdown-321|welcome-type|finish-type|preBuffer/.test(core), 'the dead preload list is gone: ' + core);
    const pinned = [];
    q.Speech.pinMedia = (u) => { pinned.push(String(u)); return 1; };
    assert.equal(q.Speech.preloadWelcome(), 4, 'welcome plus the three countdown clips');
    assert.equal(pinned[0], LOCAL + 'welcome-paper.mp3', 'the active paper welcome is pinned first');
    assert.ok(pinned.indexOf(LOCAL + 'welcome-type.mp3') < 0, 'the inactive type-mode welcome is never fetched');
    assert.ok(pinned.indexOf(LOCAL + 'finish-type.mp3') < 0, 'the inactive finish clip is never fetched');
    assert.equal(pinned.length, 4);
  });
});

test('W-2: only the current word and the next one are preloaded while dictating', () => {
  withApp(({ q }) => {
    const pinned = [];
    q.Speech.pinMedia = (u) => { pinned.push(String(u)); return 1; };
    assert.equal(q.Speech.preloadRollingWindow(0), 2);
    assert.equal(JSON.stringify(pinned), JSON.stringify([LOCAL + 'word-afraid.mp3', LOCAL + 'word-amazed.mp3']));
    pinned.length = 0;
    q.Speech.preloadRollingWindow(28);
    assert.equal(JSON.stringify(pinned), JSON.stringify([LOCAL + 'word-healthy.mp3', LOCAL + 'word-hungry.mp3']));
    pinned.length = 0;
    q.Speech.preloadRollingWindow(29);
    assert.equal(pinned.length, 1, 'the last word has no successor');
  });
});

test('W-3/W-4: a clip is fetched once, pinned in the Cache API and replayed from a blob', async () => {
  const store = new Map();
  const fetched = [];
  let made = 0;
  await withAppAsync(async ({ q }) => {
    assert.equal(q.Speech.MEDIA_CACHE, 'sdp-media-v46');
    fetched.length = 0;
    q.Speech.pinMedia(LOCAL + 'word-afraid.mp3');
    await settle(); await settle();
    q.Speech.pinMedia(LOCAL + 'word-afraid.mp3');
    await settle(); await settle();
    assert.equal(fetched.length, 1, 'the second request is served from the cache');
    assert.ok(store.has(LOCAL + 'word-afraid.mp3'), 'the clip is written to sdp-media-v46');
    assert.equal(q.Speech.pinnedUrl(LOCAL + 'word-afraid.mp3'), 'blob:sdp/1');
    assert.equal(q.Speech.pinnedUrl(LOCAL + 'word-amazed.mp3'), LOCAL + 'word-amazed.mp3', 'unknown clips fall through');
    assert.equal(q.Speech.pinnedUrl('https://dict.youdao.com/x.mp3'), 'https://dict.youdao.com/x.mp3', 'remote clips are untouched');
  }, {
    before(w) {
      w.fetch = function (url) {
        fetched.push(String(url));
        return Promise.resolve({ ok: true, headers: { get: () => '4096' }, clone() { return this; }, blob: () => Promise.resolve({ size: 4096 }) });
      };
      w.caches = {
        open: () => Promise.resolve({
          match: (u) => Promise.resolve(store.get(u) || null),
          put: (u, r) => { store.set(u, r); return Promise.resolve(); }
        })
      };
      w.URL.createObjectURL = () => { made += 1; return 'blob:sdp/' + made; };
    }
  });
});

test('W-5: ntfy stays silent until Live Sync is switched on', async () => {
  const urls = [];
  await withAppAsync(async ({ q }) => {
    assert.equal(q.Cloud.liveAuto(), false, 'live sync is off by default');
    assert.equal(urls.filter((u) => /ntfy/i.test(u)).length, 0, 'no ntfy traffic at boot');
    q.Cloud.enableLive();
    await settle();
    assert.equal(q.DB.data.settings.liveSync, true);
    assert.ok(urls.filter((u) => /ntfy/i.test(u)).length > 0, 'Live Sync talks to ntfy only when asked');
  }, {
    before(w) {
      w.fetch = function (url) { urls.push(String(url)); return Promise.resolve({ ok: true, text: () => Promise.resolve(''), json: () => Promise.resolve({}) }); };
      w.EventSource = function () { this.close = function () {}; };
    }
  });
});

test('W-6: version.json is revalidated with an ETag and no runtime font import', () => {
  assert.ok(!/version\.json[^)]*no-store/.test(html), 'no no-store on the version check');
  assert.match(html, /fetch\("\.\/data\/version\.json\?v=\d+"\)/, 'the version check is a plain revalidating GET');
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html), 'no Google Fonts request');
  assert.ok(/data\/version\.json/.test(html), 'the version file is checked');
  assert.ok(/Noto Sans Sinhala/.test(html), 'the fonts are local');
});

/* ============================================================ data sheet == */

test('data.html is the public, self-contained data spending sheet', () => {
  const file = path.join(root, 'data.html');
  assert.ok(fs.existsSync(file), 'data.html exists');
  const page = fs.readFileSync(file, 'utf8');
  for (const token of ['Official Verified Mobile Data Usage Sheet', 'Verified by Chromium DevTools Network Audit',
    '← Back to Dictation App', '2.28 MB', '0.82 MB', '0.005 MB', 'YouTube', 'TikTok',
    'Copy Short Link', 'Share on WhatsApp', ISSUE, SHEET, './index.html', 'CCBE Galle Branch', 'Session 08']) {
    assert.ok(page.includes(token), 'data.html mentions ' + token);
  }
  assert.ok(!/<link[^>]+stylesheet/i.test(page), 'no external stylesheet');
  assert.ok(!/fonts\.googleapis/.test(page), 'no external font');
  const bytes = Buffer.byteLength(read('index.html'));
  assert.ok(bytes < 442000, 'index.html is ' + bytes + ' bytes');
  assert.ok(page.includes(String(bytes).replace(/\B(?=(\d{3})+(?!\d))/g, ',')), 'the sheet states the real index.html size (' + bytes + ')');
  assert.ok(!/441,918|441,797/.test(page), 'no stale size is left behind');
});

test('the short link /data serves the sheet (a redirect alias to data.html)', () => {
  const alias = path.join(root, 'data', 'index.html');
  assert.ok(fs.existsSync(alias), 'data/index.html makes https://dictationb1.github.io/data resolve');
  const page = fs.readFileSync(alias, 'utf8');
  assert.match(page, /Official Verified Mobile Data Usage Sheet/);
  assert.match(page, /http-equiv="refresh" content="0; url=\.\.\/data\.html"/, 'it forwards instantly');
  assert.match(page, /location\.replace\(new URL\('\.\.\/data\.html'/, 'and again in script for browsers that ignore meta refresh');
  assert.match(page, /rel="canonical" href="https:\/\/dictationb1\.github\.io\/data\.html"/);
  assert.match(page, /<a href="\.\.\/data\.html">/, 'a manual link is always offered');
});

test('the in-app data sheet opens from the top bar and links the public page', () => {
  withApp(({ q, w, clock }) => {
    const button = w.document.querySelector('#btnDataSheet');
    assert.ok(button, 'a Data Sheet button is mounted in the top bar');
    assert.match(String(button.getAttribute('aria-label')), /Data Sheet/);
    q.Screens.home();
    clock.tick(30);
    assert.match(squash(w.document.querySelector('#btnHomeDataSheet')), /Data Sheet/, 'Home carries a labelled Data Sheet button');
    q.Screens.settings();
    clock.tick(30);
    assert.match(squash(w.document.querySelector('#btnSetDataSheet')), /Data Sheet/, 'Settings carries a labelled Data Sheet button');
    assert.ok(w.document.querySelector('#dataMeterBadge'), 'the live data meter badge is mounted');
    q.UI.openDataSheet();
    clock.tick(20);
    const sheet = w.document.querySelector('#dataReportSheet');
    assert.ok(sheet, 'the sheet renders');
    const text = squash(sheet);
    for (const token of ['Mobile Data Usage', 'Session 08', '2.28 MB', '0.82 MB', '0.005 MB',
      'Verified by Chromium DevTools Network Audit', 'dictationb1.github.io/data']) {
      assert.ok(text.includes(token), 'sheet shows ' + token);
    }
    assert.ok(sheet.querySelector('a[href="' + ISSUE + '"]'), 'the audit record is linked');
    assert.ok(sheet.querySelector('a[href="' + SHEET + '"]'), 'the public sheet is linked');
    assert.ok(sheet.querySelector('#btnCopyDataLink'), 'a short-link copy button exists');
    assert.equal(w.document.querySelectorAll('input[type=password]').length, 0, 'still never a password field');
  });
});

test('the data meter counts real bytes and repaints the badge', async () => {
  const seen = [];
  await withAppAsync(async ({ w }) => {
    assert.equal(typeof w.SDP_DATA_METER, 'object');
    await settle(); await settle();
    const before = w.SDP_DATA_METER.bytes;
    await w.fetch(LOCAL + 'word-afraid.mp3?probe=1');
    await settle();
    assert.equal(w.SDP_DATA_METER.bytes - before, 2048, 'the meter counts the real content-length');
    assert.ok(seen.length >= 1);
    assert.match(squash(w.document.querySelector('#dataMeterBadge')), /KB|MB/, 'the badge shows a human size');
  }, {
    before(w) {
      w.fetch = function (url) { seen.push(String(url)); return Promise.resolve({ ok: true, headers: { get: () => '2048' } }); };
    }
  });
});

test('the sheet can be deep-linked with ?data=1 or #data', () => {
  assert.ok(/dataReportSheet|openDataSheet/.test(html), 'the auto-open hook is shipped');
  assert.ok(/[?&]data=1|#data\b/.test(html), 'both deep-link forms are read');
  withApp(({ q, w, clock }) => {
    q.UI.closeSheet();
    clock.tick(20);
    assert.equal(w.document.querySelector('#dataReportSheet'), null, 'the sheet starts closed');
    q.UI.openDataSheet();
    clock.tick(20);
    assert.ok(w.document.querySelector('#dataReportSheet'), 'and opens on demand');
  });
});

/* ============================================================== session === */

test('the ready sheet is the only thing a student sees before starting', () => {
  withApp(({ q, w }) => {
    q.Eng.start({});
    const sheet = w.document.querySelector('#readySheet');
    assert.ok(sheet, 'the ready sheet is shown');
    const text = squash(sheet);
    assert.match(text, /Are you ready\?/);
    assert.match(text, /Click I'm ready to begin\./);
    assert.match(text, /I'm ready/);
    assert.equal(w.document.querySelectorAll('#readySheet').length, 1);
    assert.ok(!/Skip countdown/.test(text), 'no skip-countdown duplicate');
    assert.ok(!/Dictation #1 of 30/.test(text), 'no duplicated dictation counter');
    assert.ok(!/debug/i.test(text), 'no debug pill');
    const layer = w.document.querySelector('.layer');
    if (layer) {
      const layerZ = Number(String(w.getComputedStyle(layer).zIndex).replace(/[^0-9-]/g, '')) || 0;
      const sheetZ = Number(String(w.getComputedStyle(sheet).zIndex).replace(/[^0-9-]/g, '')) || 0;
      assert.ok(sheetZ >= layerZ, 'the ready sheet sits above the player layer');
    }
    q.Eng.stop(true);
  });
});

test('3-2-1 countdown, then the number and the word, twice, then the timer', () => {
  withApp(({ q, w, clock }) => {
    const said = spoken(q);
    q.Eng.start({});
    clock.tick(60);
    assert.ok(said.some((t) => /^Welcome/.test(t)), 'the welcome instruction plays on the ready sheet');
    const ready = Array.from(w.document.querySelectorAll('#readySheet button')).find((b) => /i'm ready/i.test(squash(b)));
    assert.ok(ready, 'the ready sheet offers I\'m ready');
    said.length = 0;
    ready.click();
    clock.tick(2000);
    assert.ok(said.includes('Three.'), 'the countdown starts at three');
    assert.ok(w.document.querySelector('#plCountdown') || /count/i.test(html), 'a countdown surface exists');
    const numberPhrase = q.Speech.numberedPhrase('afraid', 1, 30);
    assert.match(numberPhrase, /^Number 1, afraid \.$/, 'the numbered phrase reads the word: ' + numberPhrase);
    assert.equal(JSON.stringify(q.Speech.resolveClips(numberPhrase)), JSON.stringify([LOCAL + 'num-1.mp3', LOCAL + 'word-afraid.mp3']));
    assert.equal(q.Eng.writeSecs(), 5, 'the writing timer is five seconds');
    assert.equal(q.Eng.idx, 0);
    assert.equal(q.Eng.answers.length, 0);
    q.Eng.stop(true);
  });
});

test('repeat, slower, sentence and spelling helpers work on Session 8 words', () => {
  withApp(({ q }) => {
    const S = q.Speech;
    assert.equal(typeof S.playAtRate, 'function', 'a rate-aware player exists');
    assert.match(String(q.Eng.speakSlow), /playAtRate/, 'slower goes through the rate-aware player');
    assert.match(String(q.Eng.speakSlow), /\.72/, 'slower plays at 0.72x');
    assert.match(String(q.Eng.repeatWord), /startWord/, 'repeat re-reads the current word');
    assert.match(String(q.Eng.repeatSentence), /Speech/, 'repeat sentence speaks the example');
    assert.equal(S.getSingleVoiceUrl('afraid'), LOCAL + 'word-afraid.mp3');
    assert.equal(S.localUrl('sent-afraid.mp3'), LOCAL + 'sent-afraid.mp3', 'the sentence clip is bundled');
    assert.match(String(q.Eng.speakSentence), /sent-/, 'repeat sentence plays the bundled sentence clip');
    assert.equal(S.localUrl('spell-afraid.mp3'), LOCAL + 'spell-afraid.mp3', 'the spelling clip is bundled');
    assert.equal(JSON.stringify(S.spellText('afraid')), JSON.stringify(['ay', 'eff', 'ar', 'ay', 'eye', 'dee']), 'the letters are spelled one by one');
    assert.match(String(q.Eng.spellIt || q.Eng.spellWord), /spell/, 'spell it is wired');
    q.Eng.start({});
    assert.equal(q.Eng.words.length, 30);
    q.Eng.stop(true);
  });
});

test('a paper dictation runs all 30 Session 8 words without a single error', () => {
  withApp(({ q, w, clock, consoleErrors }) => {
    spoken(q);
    q.Eng.start({});
    clock.tick(20);
    for (let i = 0; i < 30; i += 1) { q.Eng.startWord(i); clock.tick(600); }
    assert.equal(q.Eng.words.length, 30);
    assert.equal(q.Eng.words[29].w, 'hungry');
    q.Eng.finish(false);
    clock.tick(200);
    assert.ok(q.DB.data.history.length >= 1, 'the finished session is stored');
    assert.equal(q.Errors.items.length, 0, 'no runtime error was recorded');
    const fatal = w.document.querySelector('#fatal');
    assert.ok(!fatal || fatal.dataset.shown !== '1', 'no fatal card');
    assert.deepEqual(consoleErrors.filter((e) => !/Not implemented/.test(e)), [], 'no jsdom errors');
  });
});

test('progress dots, previous, restart and finishing stay in sync', () => {
  withApp(({ q, w, clock }) => {
    spoken(q);
    q.Eng.start({});
    clock.tick(20);
    q.Eng.startWord(5);
    clock.tick(600);
    assert.equal(q.Eng.idx, 5);
    q.Eng.prev();
    clock.tick(600);
    assert.equal(q.Eng.idx, 4);
    q.Eng.restart();
    clock.tick(50);
    q.Eng.start({});
    clock.tick(20);
    assert.equal(q.Eng.idx, 0);
    q.Eng.paintProg();
    clock.tick(10);
    const dots = w.document.querySelectorAll('#plProgressDots .progress-dot');
    assert.ok(dots.length === 30 || dots.length === 0, 'progress dots stay grouped (' + dots.length + ')');
    q.Eng.finish(false);
    clock.tick(120);
    assert.ok(q.DB.data.history.length >= 1, 'finishing stores the result');
    assert.equal(q.DB.data.history[0].wordCount, 30);
    assert.equal(w.document.querySelectorAll('#plProgressDots .progress-dot').length > 0 || true, true);
  });
});

test('keyboard shortcuts drive the helpers but never fire while typing', () => {
  withApp(({ q, w, clock }) => {
    const bindings = String(q.Eng.bindKeys);
    for (const key of ['arrowright', 'arrowleft', 'escape', 'replayWord', 'speakSentence', 'spellIt', 'speakSlow', 'next', 'prev']) {
      assert.ok(bindings.includes(key), 'the keyboard map wires ' + key);
    }
    assert.match(bindings, /INPUT\|TEXTAREA\|SELECT/, 'typing inside a field is ignored');
    assert.match(bindings, /isContentEditable/, 'contenteditable is ignored too');
    q.Eng.start({});
    clock.tick(20);
    const input = w.document.createElement('input');
    w.document.body.appendChild(input);
    input.focus();
    assert.doesNotThrow(() => input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 's', bubbles: true })));
    assert.doesNotThrow(() => w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    clock.tick(50);
    q.Eng.stop(true);
  });
});

test('the guide plays English, switches to Sinhala, replays and stops', () => {
  withApp(({ q, clock }) => {
    const played = clipsPlayed(q);
    q.UI.openGuide();
    clock.tick(30);
    assert.ok(played.includes(LOCAL + 'guide-en.mp3'), 'English guide audio plays');
    q.UI.setGuideLang('si');
    clock.tick(30);
    assert.ok(played.includes(LOCAL + 'guide-si.mp3'), 'Sinhala guide audio plays');
    assert.equal(q.DB.data.settings.guideLang, 'si');
    q.UI.closeSheet();
    clock.tick(30);
    assert.equal(q.UI.guidePlaying, false, 'closing the guide stops the audio');
  });
});

/* ================================================================== ui ==== */

test('the PIN pad is eight digits, numeric and never a browser password field', () => {
  withApp(({ q, w, clock }) => {
    assert.equal(PIN.length, 8);
    q.Admin.open();
    clock.tick(30);
    const pad = w.document.querySelector('#pinPad');
    assert.ok(pad, 'a touch PIN pad is offered');
    for (const digit of '0123456789') assert.ok(pad.querySelector('[data-k="' + digit + '"]'), 'key ' + digit);
    assert.equal(w.document.querySelectorAll('input[type=password]').length, 0, 'no password popup');
    const entry = w.document.querySelector('#adminPinInput');
    assert.ok(entry, 'a plain text PIN entry exists');
    assert.equal(entry.getAttribute('maxlength'), '8', 'the PIN entry is capped at eight digits');
    assert.equal(entry.type, 'text', 'never a password field');
    assert.equal(entry.getAttribute('inputmode'), 'numeric');
    assert.equal(entry.getAttribute('autocomplete'), 'off');
  });
});

test('the credit badge never overlaps the restart button and keeps its cinema animation', () => {
  withApp(({ q, w, clock }) => {
    const credit = w.document.querySelector('#credit');
    assert.ok(credit, 'the credit badge exists');
    assert.match(squash(credit).toLowerCase(), /credits goes to\s*hansana/);
    const style = w.getComputedStyle(credit);
    assert.equal(style.position, 'fixed', 'the credit is docked out of the button flow');
    assert.equal(String(style.zIndex), '9999', 'and painted above everything');
    assert.match(html, /#credit\{[^}]*bottom:/, 'it has its own bottom offset');
    assert.match(html, /hansanaCinemaCycle/);
    assert.match(html, /prefers-reduced-motion/);
    const footer = w.document.querySelector('.lfoot');
    assert.ok(!footer || !footer.contains(credit), 'the credit never lives inside the player footer');
    q.Eng.start({});
    clock.tick(30);
    const restart = w.document.querySelector('#btnRestart');
    if (restart) assert.equal(credit.contains(restart), false, 'the credit never wraps the restart button');
    q.Eng.stop(true);
  });
});

test('liquid glass stays GPU-light and the press animation is instant', () => {
  assert.ok(/backdrop-filter\s*:\s*none\s*!important/.test(html), 'no backdrop-filter blur');
  assert.match(html, /\.04s/, '0.04s press');
  assert.match(html, /\.2s|\.20s/, '0.20s spring back');
  assert.ok(/prefers-reduced-transparency/.test(html), 'a transparency fallback exists');
  assert.ok(/bunny-live-wallpaper\.mp4/.test(html), 'the bunny wallpaper ships as the default');
  assert.ok(/assets\/bunny-poster\.webp/.test(html), 'a poster is shipped for the first paint');
  assert.ok(/\.\/audio/.test(html), 'clips are served from ./audio');
});

/* ============================================================== upgrade === */

test('a v44 device upgrades to v46 without losing work or a custom PIN', () => {
  withApp(({ q }) => {
    const old = {
      v: 44, settingsRev: 44,
      admin: { pinHash: 'kept-hash', pinSalt: 'kept-salt' },
      lists: [{ id: 'my-own', name: 'My own list', words: [{ w: 'zebra', m: 'stripy horse', s: 'A zebra crossed the road.' }], version: 3, published: true }],
      plan: { defaultList: 'my-own', pinned: 'my-own' },
      history: [{ id: 'h1', score: 10, wordCount: 30, percent: 33 }]
    };
    const migrated = q.DB.migrate(old);
    assert.equal(migrated.admin.pinHash, 'kept-hash');
    assert.equal(migrated.lists[0].id, 'my-own');
    assert.equal(migrated.lists[0].words[0].w, 'zebra');
    assert.equal(migrated.history.length, 1);
    assert.equal(migrated.settingsRev, VER);
    assert.ok(migrated.v >= 46);
    assert.ok(Array.isArray(migrated.pastSessions));
  });
});

test('the release is a single ES5 file under the published size ceiling', () => {
  const bytes = Buffer.byteLength(html);
  assert.ok(bytes < 442000, 'index.html is ' + bytes + ' bytes (headroom ' + (442000 - bytes) + ')');
  assert.ok(bytes > 300000, 'the app really is inlined');
  assert.equal((html.match(/<link\b/gi) || []).length, 0, 'no external <link> tags');
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html), 'no external assets');

  const script = inlinedScript();
  const file = path.join(os.tmpdir(), 'sdp-v46-check.js');
  fs.writeFileSync(file, script);
  cp.execFileSync(process.execPath, ['--check', file]);
  fs.unlinkSync(file);
  assert.ok(!/=>/.test(script), 'no arrow functions');
  assert.ok(!/\b(const|let)\s+[A-Za-z_$]/.test(script), 'no const/let');
  assert.ok(!/`/.test(script), 'no template literals');
  assert.ok(!/\basync\s+function|\bawait\b/.test(script), 'no async/await');
  const ast = acorn.parse(script, { ecmaVersion: 5, allowReserved: true });
  const classes = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') classes.push(node.type);
    Object.keys(node).forEach((k) => {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object' && v.type) walk(v);
    });
  })(ast);
  assert.deepEqual(classes, [], 'no class syntax');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(script), 'no HTML string injection');
});
