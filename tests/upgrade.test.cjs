'use strict';

/* v27 release and v22 dictation regressions. Run directly or with node --test. */
const test = require('node:test');
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
const key = 'sdp.v27_clean_fast';
const title = 'Session 7 - Travel & Transport';
const words = ['guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration',
  'journey', 'luggage', 'machine', 'mechanic', 'nationality', 'on business', 'on vacation',
  'overnight', 'passenger', 'public transport', 'reception', 'reservation', 'road sign',
  'signpost', 'spaceship', 'suitcase', 'tourist information centre', 'traffic lights',
  'tunnel', 'tyre/tire', 'vehicle', 'visa', 'waiting room', 'windscreen'];
const has = (s) => assert.ok(html.includes(s), 'missing ' + s);
const lacks = (s) => assert.ok(!html.includes(s), 'unexpected ' + s);
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
function cssRule(selector) {
  const pos = css.indexOf(selector + '{');
  assert.ok(pos >= 0, 'CSS rule exists: ' + selector);
  return css.slice(pos, css.indexOf('}', pos) + 1);
}
function click(a, el) {
  assert.ok(el, 'button exists');
  el.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function enterType(a) {
  a.q.DB.data.settings.mode = 'type';
  a.q.Eng.start({});
  a.clock.tick(50);
  return a.w.document;
}
function playing(a) {
  const doc = enterType(a);
  const skip = Array.from(doc.querySelectorAll('#sheets button')).find((b) => b.textContent.trim() === 'Skip countdown');
  click(a, skip);
  a.clock.tick(4000);
  assert.ok(doc.getElementById('ansInput'));
  return doc;
}
function typeChar(a, inp, ch) {
  inp.value = ' ' + ch;
  inp.dispatchEvent(new a.w.Event('input', { bubbles: true }));
}
function inputEvent(a, inp, type) {
  const ev = new a.w.Event('input', { bubbles: true, cancelable: true });
  if (type) ev.inputType = type;
  inp.dispatchEvent(ev);
  return ev;
}

test('single-file app is ES5, self-contained, and well below its size budget', () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  acorn.parse(script, { ecmaVersion: 5 });
  assert.ok(Buffer.byteLength(html) < 435000, 'actual bytes: ' + Buffer.byteLength(html));
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(css, /@import/i);
  assert.doesNotMatch(script, /\b(?:const|let)\s|=>|\basync\s+function|\bawait\s|`/);
});

test('metadata, schema, storage key and paper default are consistent', () => {
  for (const d of [version, config, session]) {
    assert.ok(Number(d.ver) >= 27);
    assert.equal(d.settingsRev, 27);
    assert.equal(d.appVersion, '3.5.0');
    assert.equal(d.version, '3.5.0');
    assert.equal(d.mode, 'paper');
    assert.ok(!('swan' in d));
  }
  assert.equal(config.storageKey, key);
  assert.equal(config.defaults.mode, 'paper');
  has('var APP_VERSION="3.5.0"'); has('key:"' + key + '"'); has('schema:27');
  has('settingsRev:27'); has('resetToV27:function');
  has('data-mode="paper" aria-selected="true"'); has('Listen &amp; write on paper');
  const a = harness();
  try {
    assert.equal(a.q.CONFIG.key, key);
    assert.equal(a.q.CONFIG.schema, 27);
    assert.equal(a.q.CONFIG.settingsRev, 27);
    assert.equal(a.q.DB.data.settingsRev, 27);
    assert.equal(a.q.DB.data.v, 27);
    assert.equal(a.q.DB.data.settings.mode, 'paper');
    assert.equal(a.q.DB.defaults().settings.mode, 'paper');
    assert.ok(a.w.localStorage.getItem(key));
  } finally { a.close(); }
});

test('v26 migration preserves history, custom lists, PIN and backup while resetting paper', () => {
  const a = harness();
  try {
    const old = JSON.parse(JSON.stringify(a.q.DB.data));
    old.v = 26; old.settingsRev = 26; old.settings.mode = 'type';
    old.profile.nickname = 'Returning learner';
    old.admin.pinHash = 'already-changed';
    old.history = [{ id: 'saved-history', score: 12, wordCount: 30 }];
    old.lists = [{ id: 'custom-list', name: 'Lecturer list', published: true, words: [{ w: 'custom', m: 'original meaning', s: 'original sentence' }] }];
    old.plan.pinned = 'custom-list';
    const raw = JSON.stringify(old);
    a.w.localStorage.clear();
    a.w.localStorage.setItem('sdp.v26_live_wall', raw);
    a.w.localStorage.setItem('sdp.v26_live_wall.bak', raw);
    a.q.DB.load();
    const saved = JSON.parse(a.w.localStorage.getItem(key));
    assert.equal(saved.v, 27); assert.equal(saved.settingsRev, 27);
    assert.equal(saved.settings.mode, 'paper');
    assert.equal(saved.profile.nickname, 'Returning learner');
    assert.equal(saved.admin.pinHash, 'already-changed');
    assert.equal(saved.history[0].id, 'saved-history');
    assert.ok(saved.lists.some((list) => list.id === 'custom-list' && list.words[0].w === 'custom'));
    assert.ok(saved.lists.some((list) => list.id === 'list_session_7_travel'));
    assert.equal(saved.plan.pinned, 'custom-list');
    assert.ok(a.w.localStorage.getItem(key + '.bak'));
    const reloaded = a.q.DB.migrate(JSON.parse(JSON.stringify(saved)));
    reloaded.settings.mode = 'type';
    assert.equal(a.q.DB.migrate(reloaded).settings.mode, 'type', 'v27 user choice persists after migration');
  } finally { a.close(); }
});

test('corrupt v26 primary recovers from its legacy rolling backup', () => {
  const a = harness();
  try {
    const old = JSON.parse(JSON.stringify(a.q.DB.data));
    old.v = 26; old.settingsRev = 26; old.profile.nickname = 'Backup learner';
    a.w.localStorage.clear();
    a.w.localStorage.setItem('sdp.v26_live_wall', '{broken');
    a.w.localStorage.setItem('sdp.v26_live_wall.bak', JSON.stringify(old));
    a.q.DB.load();
    assert.equal(a.q.DB.data.profile.nickname, 'Backup learner');
    assert.equal(a.w.localStorage.getItem(key + '.recovery'), '{broken');
    assert.equal(a.q.DB.data.settingsRev, 27);
  } finally { a.close(); }
});

test('Session 7 has all 30 ordered words, five seconds, two repeats and Amy en-GB', () => {
  assert.deepEqual(session.lists[0].words.map((w) => w.w), words);
  assert.equal(session.session.title, title);
  assert.equal(config.defaults.writeMode, 'fixed');
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.sentence, false);
  assert.match(config.tts.primary, /Amy.*en-GB/);
  assert.equal(config.dataSaving.audioReuse, true);
  assert.equal(require('./test-pin.cjs'), '7898');
  has('voice=Amy');
  const a = harness();
  try {
    assert.equal(a.q.SAMPLE_WORDS.length, 30);
    assert.equal(a.q.Lib.current().words.length, 30);
    a.q.Eng.start({});
    const beats = a.q.Eng.buildBeats(0);
    assert.equal(beats.filter((b) => b.isWord).length, 2);
    assert.equal(beats.filter((b) => b.isSentence).length, 0);
    assert.equal(beats.find((b) => b.t === 'write').secs, 5);
    assert.ok(beats.filter((b) => b.isWord).every((b) => b.text === 'guidebook'));
    assert.match(a.q.Speech.amyUrl('guidebook'), /voice=Amy/);
  } finally { a.close(); }
});

test('playing the same prepared audio twice reuses the element source', () => {
  const a = harness();
  try {
    let source = '', sets = 0, plays = 0;
    const audio = { readyState: 4, currentTime: 0, canPlayType() { return 'probably'; }, pause() {},
      play() { plays++; this.currentTime = 0.5; if (this.onplaying) this.onplaying(); } };
    Object.defineProperty(audio, 'src', { get() { return source; }, set(v) { sets++; source = v; } });
    a.q.Speech.el = () => audio;
    const src = a.q.Speech.amyUrl('guidebook');
    let ended = 0;
    a.q.Speech.playOnce(src, 0.88, 6000, (ok) => { if (ok) ended++; });
    audio.onended();
    a.q.Speech.playOnce(src, 0.88, 6000, (ok) => { if (ok) ended++; });
    audio.onended();
    assert.equal(sets, 1, 'repeat does not reassign or reload the source');
    assert.equal(plays, 2); assert.equal(ended, 2);
  } finally { a.close(); }
});

test('the full-screen drawing engine, video, replay and all callbacks are gone', () => {
  for (const token of ['swan-stage-wrap', 'swan-ink-canvas', 'swan-vector-stage', 'swanMasterPath',
    'bgSwanVideo', 'btnSwanReplay', 'SwanStage', 'LiveStage', 'swan-inscription', 'swan-cinnabar-seal',
    '一筆白鳥', '墨', 'bunny-live-wallpaper', 'bunny-poster']) lacks(token);
  const a = harness();
  try {
    assert.equal(a.w.SwanStage, undefined);
    assert.equal(a.w.LiveStage, undefined);
    assert.equal(a.w.document.querySelector('canvas, #bg video'), null);
    assert.equal(a.q.Errors.items.length, 0);
  } finally { a.close(); }
});

test('four static soft colour fields remain and animation-frame work stops at idle', () => {
  for (const value of ['#53c7f0', '#ff6f61', '#ffc247', '#8f7bff', '#0a0f1e', '#e8ecf4']) has(value);
  has('radial-gradient(circle,var(--blob-color)');
  assert.match(cssRule('#bg'), /background:var\(--bg1\)/);
  assert.doesNotMatch(css, /#bg\[data-anim=on\] \.blob/);
  const a = harness();
  try {
    assert.equal(a.w.document.querySelectorAll('#bg .blob').length, 4);
    const original = a.w.requestAnimationFrame.bind(a.w);
    let requests = 0;
    a.w.requestAnimationFrame = function (cb) { requests++; return original(cb); };
    a.clock.tick(3000); // the finite startup performance probe has completed
    const atRest = requests;
    a.clock.tick(5000);
    assert.equal(requests, atRest, 'no new animation frames during idle');
    assert.equal(a.w.document.getElementById('bg').getAttribute('data-anim'), 'off');
    assert.equal(a.q.Errors.items.length, 0);
  } finally { a.close(); }
});

test('cached search covers every word, variants, definitions, my words and mistakes', () => {
  has('buildSearchIndex:function'); has('searchWords:function'); has('searchIndex');
  const a = harness();
  try {
    const lib = a.q.Lib;
    const list = lib.current();
    assert.equal(list.words.length, 30);
    for (const word of list.words) {
      assert.ok(lib.searchWords(word.w.split('/')[0], list.words, list.id).some((x) => x.w === word.w), word.w);
    }
    assert.ok(lib.searchWords('tire', list.words, list.id).some((x) => x.w === 'tyre/tire'));
    assert.ok(lib.searchWords('museums', list.words, list.id).some((x) => x.w === 'guidebook'));
    const rows = lib.searchIndex.rows;
    lib.searchWords('jour', list.words, list.id);
    assert.equal(lib.searchIndex.rows, rows, 'successive searches reuse the precomputed rows');
    lib.addMyWord('wonderful'); lib.addMistake('harbour');
    assert.equal(lib.searchWords('wonder', lib.mywords(), 'my')[0].w, 'wonderful');
    assert.equal(lib.searchWords('harb', lib.mistakes(), 'mistakes')[0].w, 'harbour');
    lib.searchWords('guide', list.words, list.id);
    assert.ok(lib.searchIndexes[list.id]);
    assert.ok(lib.searchIndexes.my); assert.ok(lib.searchIndexes.mistakes);
    // An edit to a middle row with unchanged length must invalidate stale tokens.
    list.words[4].m = 'unusual token for editing';
    a.q.DB.save();
    assert.equal(lib.searchWords('unusual token', list.words, list.id)[0].w, 'hitchhike');
  } finally { a.close(); }
});

test('dictionary results update synchronously on input', () => {
  const a = harness();
  try {
    a.q.UI.setTab('dict');
    const doc = a.w.document;
    const input = doc.getElementById('dictSearch');
    input.value = 'tire';
    input.dispatchEvent(new a.w.Event('input', { bubbles: true }));
    assert.match(doc.getElementById('dictList').textContent, /tyre/i);
    input.value = 'guidebook';
    input.dispatchEvent(new a.w.Event('input', { bubbles: true }));
    assert.match(doc.getElementById('dictList').textContent, /guidebook/i);
    assert.doesNotMatch(doc.getElementById('dictList').textContent, /tyre/i);
  } finally { a.close(); }
});

test('guide start unlocks speech, closes the guide, opens Home and launches dictation', () => {
  has('UI.startPractisingFromGuide=function');
  const a = harness();
  try {
    const actions = [];
    const unlock = a.q.Speech.unlock, start = a.q.Eng.start;
    a.q.Speech.unlock = function () { actions.push('unlock'); return unlock.apply(this, arguments); };
    a.q.Eng.start = function () { actions.push('start'); return start.apply(this, arguments); };
    a.q.UI.setTab('set'); a.q.UI.openWelcomeGuide();
    assert.ok(a.w.document.querySelector('#sheets .guide-credit-pill'));
    click(a, a.w.document.getElementById('btnGuideStart'));
    assert.deepEqual(actions, ['unlock', 'start']);
    assert.equal(a.q.UI.tab, 'home');
    assert.equal(a.q.Eng.st, 'ready');
    assert.equal(a.q.Eng.words.length, 30);
    assert.equal(a.w.document.getElementById('btnGuideStart'), null);
    assert.match(a.w.document.querySelector('#sheets .sheet').textContent, /Are you ready\?/);
  } finally { a.close(); }
});

test('credit stays visible beyond one cycle and is also present in the guide and tour', () => {
  assert.match(cssRule('.credit'), /z-index:9999!important/);
  has('UI.showCreditNow=function'); has('guide-credit-pill');
  const a = harness();
  try {
    const credit = a.w.document.getElementById('credit');
    a.clock.tick(13000);
    assert.ok(credit.classList.contains('in'));
    a.q.UI.openWelcomeGuide();
    assert.ok(credit.classList.contains('in'));
    assert.match(a.w.document.querySelector('#sheets .guide-credit-pill').textContent, /Hansana/);
    a.q.UI.closeSheet(); a.q.UI.runTour();
    assert.ok(a.w.document.querySelector('#sheets .guide-credit-pill'));
    assert.ok(credit.classList.contains('in'));
  } finally { a.close(); }
});

test('ready-sheet cross, scrim and Escape each close sheet and player in one action', () => {
  for (const token of ['btnReadyClose', 'btnNotReady', 'ansVkb', 'btnToggleVkb']) lacks(token);
  has('Eng.cancelReadyAndExit=function');
  for (const method of ['cross', 'scrim', 'escape']) {
    const a = harness();
    try {
      const doc = enterType(a);
      assert.equal(a.q.Eng.st, 'ready');
      const exits = doc.querySelectorAll('#sheets .shead button');
      assert.equal(exits.length, 1);
      assert.equal(exits[0].getAttribute('aria-label'), 'Close');
      if (method === 'cross') click(a, exits[0]);
      else if (method === 'scrim') click(a, doc.querySelector('#sheets .scrim'));
      else doc.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      a.clock.tick(120);
      assert.equal(a.q.Eng.st, 'idle'); assert.equal(a.q.Eng.layer, null);
      assert.equal(doc.querySelectorAll('#sheets .sheet').length, 0);
      assert.equal(doc.querySelectorAll('#layers .layer').length, 0);
    } finally { a.close(); }
  }
});

test('native text input uses the single-space buffer and synchronised mirror', () => {
  has('inp.type="text"'); has('inp.setAttribute("autocomplete","off")');
  has('typedAnswer'); has('syncInputMirror');
  assert.doesNotMatch(html, /inp\.type\s*=\s*"password"|new-password|current-password/);
  const a = harness();
  try {
    const doc = playing(a), inp = doc.getElementById('ansInput');
    assert.equal(inp.type, 'text'); assert.equal(inp.getAttribute('autocomplete'), 'off');
    assert.equal(inp.getAttribute('autocorrect'), 'off');
    assert.equal(inp.getAttribute('spellcheck'), 'false');
    assert.equal(inp.form, null); assert.equal(inp.value, ' ');
    assert.ok(doc.querySelector('#ansMirror .ans-caret'));
    typeChar(a, inp, 'g'); typeChar(a, inp, 'u'); typeChar(a, inp, 'i');
    assert.equal(inp.value, ' '); assert.equal(a.q.Eng.typedAnswer, 'gui');
    assert.equal(doc.getElementById('ansMirrorText').textContent, 'gui');
    assert.equal(a.q.Eng.answers[a.q.Eng.idx], 'gui');
    inp.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    assert.equal(a.q.Eng.typedAnswer, 'gu');
    inp.value = ''; inputEvent(a, inp, 'deleteContentBackward');
    assert.equal(a.q.Eng.typedAnswer, 'g'); assert.equal(inp.value, ' ');
  } finally { a.close(); }
});

test('replacement suggestions, paste and drop are blocked', () => {
  const a = harness();
  try {
    const doc = playing(a), inp = doc.getElementById('ansInput');
    typeChar(a, inp, 'g');
    for (const kind of ['insertReplacementText', 'insertFromPaste', 'insertFromDrop']) {
      const before = new a.w.Event('beforeinput', { bubbles: true, cancelable: true });
      before.inputType = kind; inp.dispatchEvent(before); assert.equal(before.defaultPrevented, true);
      inp.value = ' guidebook'; inputEvent(a, inp, kind);
      assert.equal(a.q.Eng.typedAnswer, 'g'); assert.equal(inp.value, ' ');
    }
    for (const kind of ['paste', 'drop']) {
      const ev = new a.w.Event(kind, { bubbles: true, cancelable: true }); inp.dispatchEvent(ev);
      assert.equal(ev.defaultPrevented, true);
    }
  } finally { a.close(); }
});

test('correct typing shows tick, completed slots and chime then advances after 1050ms', () => {
  has('Eng.onTypeCorrect=function'); has('this.after(1050');
  const a = harness();
  try {
    const doc = playing(a), inp = doc.getElementById('ansInput');
    let chimes = 0; a.q.UI.playTickChime = function () { chimes++; };
    const first = a.q.Eng.currentWord().w.split('/')[0];
    for (const ch of first) typeChar(a, inp, ch);
    assert.equal(a.q.Eng.wordSolved, true);
    assert.equal(a.q.Eng.liveCorrectCount, 1); assert.equal(a.q.Eng.liveStreakCount, 1);
    assert.equal(chimes, 1);
    assert.ok(doc.getElementById('ansTick').classList.contains('is-correct'));
    assert.ok(doc.getElementById('plTickHero').classList.contains('is-correct'));
    assert.ok(doc.querySelectorAll('#ansSlots .slot-done').length > 0);
    a.clock.tick(1049); assert.equal(a.q.Eng.idx, 0);
    a.clock.tick(2); assert.equal(a.q.Eng.idx, 1);
  } finally { a.close(); }
});

test('the final typed answer is retained when the run is scored', () => {
  const a = harness();
  try {
    const doc = playing(a);
    a.q.Eng.runItem(29);
    a.clock.tick(4500);
    const inp = doc.getElementById('ansInput');
    for (const ch of 'windscreen') typeChar(a, inp, ch);
    assert.equal(a.q.Eng.wordSolved, true);
    a.clock.tick(1051);
    assert.equal(a.q.DB.data.history.length, 1);
    const row = a.q.DB.data.history[0].rows[29];
    assert.equal(row.word, 'windscreen');
    assert.equal(row.ans, 'windscreen');
    assert.equal(row.state, 'ok');
  } finally { a.close(); }
});

test('incorrect and timed-out answers break streak, show comparison, speak once and hold', () => {
  has('Eng.onTypeWrong=function'); has('streak-broken'); has('function diffChars'); has('this.after(2100');
  const a = harness();
  try {
    const doc = playing(a), inp = doc.getElementById('ansInput');
    for (const ch of a.q.Eng.currentWord().w) typeChar(a, inp, ch);
    a.clock.tick(1100); assert.equal(a.q.Eng.liveStreakCount, 1);
    const target = a.q.Eng.currentWord().w;
    let tones = 0; const spoken = [];
    a.q.UI.playWrongTone = function () { tones++; };
    a.q.Speech.say = function (parts) { spoken.push(parts.join(' ')); };
    for (const ch of 'zzzz') typeChar(a, inp, ch);
    inp.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal(a.q.Eng.wordWrong, true); assert.equal(a.q.Eng.liveStreakCount, 0);
    assert.equal(a.q.Eng.liveWrongCount, 1); assert.equal(tones, 1);
    assert.deepEqual(spoken, [target.split('/')[0]]);
    assert.ok(doc.getElementById('ansWrong').classList.contains('is-wrong'));
    assert.ok(doc.getElementById('plWrongHero').classList.contains('is-wrong'));
    assert.match(doc.getElementById('plStreakCount').textContent, /Streak Broken! \(0\)/);
    assert.match(doc.getElementById('ansCompare').textContent, /Your answer:[\s\S]*Correct UK spelling/);
    assert.match(doc.getElementById('ansCheckBtn').textContent, /Got it → Next/);
    assert.ok(a.q.DB.data.mistakes.some((m) => m.w === target.toLowerCase()));
    a.clock.tick(2099); assert.equal(a.q.Eng.idx, 1);
    a.clock.tick(2); assert.equal(a.q.Eng.idx, 2);
    a.q.Eng.onTypeWrong('timeout');
    assert.equal(a.q.Eng.liveStreakCount, 0);
    assert.match(doc.getElementById('plStreakCount').textContent, /Streak Broken! \(0\)/);
    assert.match(doc.getElementById('ansFeedback').textContent, /Time up/);
  } finally { a.close(); }
});

test('slash spelling variants match tyre/tire', () => {
  const a = harness();
  try {
    const target = session.lists[0].words[25];
    for (const answer of ['tyre', 'tire', 'tyre/tire', ' TIRE ']) assert.equal(a.q.Eng.isAnswerMatch(answer, target), true);
    assert.equal(a.q.Eng.isAnswerMatch('tyres', target), false);
    assert.equal(a.q.Eng.isPrefixMatch('tir', target), true);
  } finally { a.close(); }
});

test('paper self-scoring still updates its checklist without wallpaper callbacks', () => {
  const a = harness();
  try {
    const list = [{ w: 'harbour', s: '', m: '' }, { w: 'journey', s: '', m: '' }];
    const rec = { id: 'paper-test', mode: 'paper', percent: 0, score: 0, wordCount: 2,
      rows: [{ state: '' }, { state: '' }], durationSec: 10, listName: title,
      sessionNo: '7', sessionDay: 'Thursday', sessionDate: '2026-10-27' };
    a.q.Results.open(rec, list, [0, 1]);
    const find = (label) => Array.from(a.w.document.querySelectorAll('#layers button')).find((b) => b.textContent.trim() === label);
    click(a, find('All right')); assert.equal(rec.score, 2); assert.equal(rec.percent, 100);
    click(a, find('Reset')); assert.equal(rec.score, 0);
    assert.equal(a.q.Errors.items.length, 0);
  } finally { a.close(); }
});

test('cloud status distinguishes a successful GAS reply from live-only activity', () => {
  const a = harness();
  try {
    const c = a.q.Cloud;
    const label = () => a.w.document.getElementById('chipNetText').textContent;
    c.mode = true;
    c.updatedAt = 1000; // a live-channel state can also update this field
    c.live.at = 1000;
    c.live.ok = true;
    a.q.UI.renderNet();
    assert.match(label(), /Online · Live Sync/);
    assert.doesNotMatch(label(), /Cloud Synced/);
    c.gasAt = 2000; // set by a successful GAS state response
    a.q.UI.renderNet();
    assert.match(label(), /Cloud Synced/);
    a.q.DB.data.outbox.push({ id: 'pending' });
    a.q.UI.renderNet();
    assert.match(label(), /Syncing/);
    c.setUrl('');
    assert.equal(c.gasAt, 0);
  } finally { a.close(); }
});

test('hollow hero, stat tiles, Settings-only mixer and sliding dock remain intact', () => {
  assert.match(cssRule('#homeTitle,.liquid-glass-text'), /-webkit-text-stroke:1\.75px/);
  assert.match(cssRule('#homeTitle,.liquid-glass-text'), /color:transparent!important/);
  assert.match(cssRule('#homeTitle,.liquid-glass-text'), /-webkit-background-clip:text/);
  has('id="tabInd"'); has('id="homeStats"'); has('anatomy-stage');
  const a = harness();
  try {
    const doc = a.w.document;
    assert.equal(doc.getElementById('homeTitle').textContent, title);
    assert.ok(doc.getElementById('homeTitle').classList.contains('liquid-glass-text'));
    assert.ok(doc.getElementById('homeTitle').classList.contains('hollow'));
    assert.doesNotMatch(doc.getElementById('homeTitle').textContent, /Liquid Glass/);
    assert.equal(doc.querySelectorAll('#homeStats .statbox').length, 3);
    assert.equal(doc.querySelector('#screen-home #lgStage'), null);
    a.q.UI.setTab('set'); a.clock.tick(100);
    for (const id of ['lgStage', 'orb', 'sBlur', 'sSat', 'sBrt']) assert.ok(doc.querySelector('#screen-set #' + id), id);
    assert.match(doc.querySelector('#screen-set .seg-tint').textContent, /Clear[\s\S]*Frost[\s\S]*Smoke/);
    assert.match(doc.querySelector('#screen-set .seg-perf').textContent, /Auto[\s\S]*Lite[\s\S]*Full/);
    assert.match(doc.getElementById('tabInd').style.transform, /translate3d\(400%/);
    a.q.UI.setTab('dict');
    assert.match(doc.getElementById('tabInd').style.transform, /translate3d\(100%/);
    for (const id of ['chipNet', 'btnLang', 'btnGuideTop', 'btnPerf', 'btnTheme', 'btnRefresh', 'btnAdmin'])
      assert.ok(doc.querySelector('.topbar #' + id), id);
  } finally { a.close(); }
});
