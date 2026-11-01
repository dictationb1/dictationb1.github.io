'use strict';
/* G2 — version constants, SDP_ENC_V2 vault, legacy migration, reconciliation,
 * and the Contents/GAS publishing payloads.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R1, §R5, §R4, §R2, §R7
 * Every block cites the contract it proves; see Appendix B of that document. */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJSON = (rel) => JSON.parse(read(rel));

function memStore() {
  const map = new Map();
  const writes = [];
  return {
    map, writes,
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { writes.push(String(k)); map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    clear: () => map.clear(),
    get length() { return map.size; }
  };
}

/* A minimal browser-shaped sandbox: only what data/sdp-data-sync.js touches. */
function bootSync(seed) {
  const localStorage = memStore();
  const sessionStorage = memStore();
  const fetchCalls = [];
  let fetchImpl = null;
  const doc = {
    dispatchEvent() { return true; },
    createEvent() { return { initCustomEvent() {} }; },
    addEventListener() {}
  };
  const sandbox = {
    Uint8Array, TextEncoder: global.TextEncoder, Promise, JSON, Math, Date, String, Number, Object, Array,
    Error, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, RegExp,
    console, crypto: webcrypto, localStorage, sessionStorage, document: doc,
    navigator: { onLine: true },
    location: { protocol: 'https:', hostname: 'example.test' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    addEventListener() {},
    fetch(url, init) {
      fetchCalls.push({ url: String(url), init: init || null });
      if (fetchImpl) return fetchImpl(String(url), init);
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) });
    }
  };
  sandbox.CustomEvent = function CustomEvent(type, opts) { this.type = type; this.detail = opts && opts.detail; };
  sandbox.window = sandbox;
  if (typeof seed === 'function') seed({ localStorage, sessionStorage, sandbox });
  const ctx = vm.createContext(sandbox);
  vm.runInContext(read('data/sdp-data-sync.js'), ctx, { filename: 'sdp-data-sync.js' });
  return {
    SDP: sandbox.SDP, sandbox, localStorage, sessionStorage, fetchCalls,
    setFetch(fn) { fetchImpl = fn; }
  };
}

/* ── R1 ─────────────────────────────────────────────────────────────────── */
test('R1: app, schema and service-worker constants are all 0.0.1.c', () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R1 version & cache constants
  const { SDP } = bootSync();
  assert.equal(SDP.version, '0.0.1.c');
  assert.equal(SDP.build, '2026-11-01');
  assert.equal(SDP.ver, 3);
  assert.equal(SDP.SDPCore, undefined); // alias lives on window, not inside SDP
  assert.equal(SDP.Sync.Vault.PREFIX, 'SDP_ENC_V2:');
  assert.equal(SDP.Sync.Vault.ITERATIONS, 250000);

  const version = readJSON('data/version.json');
  assert.equal(version.ver, 3);
  assert.equal(version.appVersion, '0.0.1.c');
  assert.equal(version.version, '0.0.1.c');
  assert.equal(version.schema, 3);
  assert.equal(version.settingsRev, 3);
  assert.equal(String(version.session), '8');

  const cfg = readJSON('data/config.json');
  assert.equal(cfg.ver, 3);
  assert.equal(cfg.appVersion, '0.0.1.c');
  assert.equal(cfg.version, '0.0.1.c');
  assert.equal(cfg.schema, 3);
  assert.equal(cfg.settingsRev, 3);
  assert.equal(cfg.encVault, 'SDP_ENC_V2:AAA=');

  const sw = read('sw.js');
  assert.match(sw, /SW_VERSION = 'sdp-v0\.0\.1\.c'/);
  assert.match(sw, /SHELL_CACHE = 'sdp-v0\.0\.1\.c-shell'/);
  assert.match(sw, /PRESERVE_CACHES = \['sdp-youdao-v1', 'sdp-audio-clips'\]/);
  const index = read('index.html');
  assert.match(index, /var TARGET = '0\.0\.1\.c'/);
});

test('R1: the five localStorage keys and the settings default shape are exact', () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R4
  const { SDP, localStorage } = bootSync();
  assert.deepEqual(Object.keys(SDP.Data.KEYS).sort(), ['guide', 'migrated', 'progress', 'session', 'settings']);
  assert.deepEqual(
    Object.keys(SDP.Data.KEYS).map((k) => SDP.Data.KEYS[k]).sort(),
    ['sdp.guide_seen', 'sdp.migrated_from_legacy', 'sdp.progress', 'sdp.session', 'sdp.settings']
  );
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 — v0.0.1.b added guideAutoPlay,
  // pacingPreset and voiceLock; v0.0.1.c adds touchedKeys (R7: the teacher must
  // never clobber a field the student changed by hand).
  const defaults = SDP.Data.settings();
  assert.deepEqual(Object.keys(defaults).sort(), [
    'autoAdvance', 'guideAutoPlay', 'hints', 'lang', 'mode', 'pacingPreset',
    'pauseSecs', 'rate', 'repeats', 'theme', 'touchedKeys', 'voiceLock',
    'voiceSource', 'volume', 'writeSecs'
  ]);
  assert.deepEqual(defaults.touchedKeys, {}, 'touchedKeys starts as an empty field map');
  assert.equal(defaults.mode, 'paper');
  assert.equal(defaults.writeSecs, 8);
  assert.equal(defaults.repeats, 3);
  assert.equal(defaults.pauseSecs, 1.5);
  assert.equal(defaults.rate, 0.95);
  assert.equal(defaults.volume, 1);
  assert.equal(defaults.lang, 'en');
  assert.equal(defaults.theme, 'dark');
  assert.deepEqual(defaults.hints, { pos: true, first: false, si: false, sentence: false });
  // the only keys written at boot are the five (migration flag included)
  const allowed = new Set(Object.values(SDP.Data.KEYS));
  const strays = localStorage.writes.filter((k) => !allowed.has(k));
  assert.deepEqual(strays, []);
});

/* ── R5 vault ───────────────────────────────────────────────────────────── */
test('R5: SDP_ENC_V2 round-trips a UTF-8 JSON payload with a fresh salt every time', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 frozen wire format
  const { SDP } = bootSync();
  const vault = SDP.Sync.Vault;
  const secret = { elevenKey: 'sk_test_123', ghToken: 'ghp_demo', note: 'සිංහල ✓' };
  const first = await vault.encryptV2(secret, '246813');
  const second = await vault.encryptV2(secret, '246813');
  assert.ok(first.startsWith('SDP_ENC_V2:'));
  assert.not_equal !== undefined; // keep linters calm about assert helpers
  assert.ok(first !== second, 'salt and IV must be random per envelope');
  const decoded = Buffer.from(first.slice('SDP_ENC_V2:'.length), 'base64');
  assert.ok(decoded.length >= 16 + 12 + 16, 'salt(16) + iv(12) + tag(16) at minimum');
  assert.deepEqual(await vault.decryptV2(first, '246813'), secret);
  assert.deepEqual(await vault.decryptV2(second, '246813'), secret);
  // a tampered ciphertext must not decrypt
  const broken = first.slice(0, 30) + (first.charAt(30) === 'A' ? 'B' : 'A') + first.slice(31);
  await assert.rejects(() => vault.decryptV2(broken, '246813'));
});

test('R5: the empty placeholder is an unconfigured vault, not an error', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 empty placeholder
  const { SDP } = bootSync();
  const vault = SDP.Sync.Vault;
  assert.equal(vault.isEmptyEnvelope('SDP_ENC_V2:AAA='), true);
  assert.equal(vault.isEmptyEnvelope(''), true);
  assert.deepEqual(await vault.decryptV2('SDP_ENC_V2:AAA=', '246813'), { empty: true });
  assert.equal(vault.isEmptyEnvelope(await vault.encryptV2({ a: 1 }, '246813')), false);
});

test('R5: five wrong PINs lock the vault for 60 seconds and a good PIN is still refused', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 PIN attempt tracking
  const { SDP } = bootSync();
  const vault = SDP.Sync.Vault;
  vault.resetLock();
  const envelope = await vault.encryptV2({ ghToken: 'ghp_x' }, '246813');
  for (let i = 0; i < 4; i++) {
    await assert.rejects(() => vault.decryptV2(envelope, '000000'), (err) => {
      assert.equal(err.code, 'bad_pin');
      assert.equal(err.triesLeft, 4 - i);
      return true;
    });
  }
  await assert.rejects(() => vault.decryptV2(envelope, '000000'), (err) => err.code === 'locked');
  assert.equal(vault.isLocked(), true);
  assert.ok(vault.lockRemaining() > 0 && vault.lockRemaining() <= 60);
  await assert.rejects(() => vault.decryptV2(envelope, '246813'), (err) => err.code === 'locked');
  vault.resetLock();
  assert.deepEqual(await vault.decryptV2(envelope, '246813'), { ghToken: 'ghp_x' });
});

/* ── R4 legacy migration ────────────────────────────────────────────────── */
test('R4: one-time legacy import copies streak, weak words and mastery without writing legacy keys', () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 one-time legacy import
  const seed = ({ localStorage }) => {
    localStorage.map.set('sdp.v57_' + 'secure_local', JSON.stringify({
      streak: { count: 4, lastDate: '2026-10-20' },
      weakWords: ['afraid', 'cruel'],
      mastered: { amazed: true, boring: true },
      history: [{ correct: 20, total: 30, pct: 67, mode: 'paper', at: 1 }]
    }));
    localStorage.map.set('sdp.v56_' + 'audit_verified', JSON.stringify({
      progress: { weakWords: ['cruel', 'hungry'], mastered: { healthy: true } }
    }));
    localStorage.writes.length = 0;
  };
  const { SDP, localStorage } = bootSync(seed);
  const progress = SDP.Data.progress();
  assert.equal(progress.streak.count, 4);
  assert.equal(progress.streak.lastDate, '2026-10-20');
  assert.deepEqual(progress.weakWords.sort(), ['afraid', 'cruel', 'hungry']);
  assert.deepEqual(Object.keys(progress.mastered).sort(), ['amazed', 'boring', 'healthy']);
  assert.equal(progress.history.length, 1);
  assert.equal(localStorage.getItem('sdp.migrated_from_legacy'), '1');
  const legacyWrites = localStorage.writes.filter((k) => k.indexOf('sdp.v') === 0);
  assert.deepEqual(legacyWrites, [], 'the app must never write a retired sdp.v* key');
  // a second boot is a no-op
  const again = SDP.Data.migrateLegacyOnce();
  assert.equal(again.migrated, false);
  assert.equal(SDP.Data.progress().weakWords.length, 3);
});

test('R4: corrupt stored JSON resets to defaults instead of throwing', () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 corruption policy
  const seed = ({ localStorage }) => {
    localStorage.map.set('sdp.progress', '{ this is not json');
    localStorage.map.set('sdp.settings', '[]');
  };
  const { SDP } = bootSync(seed);
  const progress = SDP.Data.progress();
  assert.deepEqual(progress.mastered, {});
  assert.deepEqual(progress.weakWords, []);
  assert.equal(progress.streak.count, 0);
  const settings = SDP.Data.settings();
  assert.equal(settings.mode, 'paper');
  assert.equal(settings.writeSecs, 8);
});

/* ── R2 reconciliation ──────────────────────────────────────────────────── */
test('R2: checkForUpdates detects a session and settingsRev bump and never touches progress', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R2 reconciliation table
  const { SDP, setFetch, localStorage } = bootSync();
  const session = readJSON('data/session.json');
  const version = readJSON('data/version.json');
  const config = readJSON('data/config.json');
  SDP.Sync.boot({ data: { version, config, session } });
  assert.equal(SDP.Sync.wordCount(), 30);

  SDP.Data.saveProgress({ mastered: { afraid: true }, attempts: {}, weakWords: ['cruel'], streak: { count: 3, lastDate: '2026-10-30' }, history: [], lastScore: null });
  const before = localStorage.getItem('sdp.progress');

  const bumped = Object.assign({}, version, { settingsRev: 2, syncRev: version.syncRev + 1 });
  const newSession = JSON.parse(JSON.stringify(session));
  newSession.lists[0].words[0].w = 'adaptable';
  newSession.lists[0].words[0].audio = '';
  newSession.lists[0].words[0].p = 'əˈdæp.tə.bəl';
  const files = {
    'data/version.json': JSON.stringify(bumped),
    'data/session.json': JSON.stringify(newSession),
    'data/config.json': JSON.stringify(config)
  };
  setFetch((url) => {
    const clean = String(url).split('?')[0].replace(/^\.\//, '');
    if (!files[clean]) return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(files[clean])), text: () => Promise.resolve(files[clean]) });
  });
  const info = await new Promise((resolve) => SDP.Sync.checkForUpdates((err, result) => resolve({ err, result })));
  assert.equal(info.err, null);
  assert.equal(info.result.updated, true);
  // the session NUMBER is still 8; syncRev + settingsRev are what moved, and the
  // word bank must still refresh (contract §R2 reconciliation table)
  assert.equal(info.result.sessionChanged, false);
  assert.equal(info.result.settingsRev, 2);
  assert.equal(SDP.Sync.word(0).w, 'adaptable');
  assert.equal(localStorage.getItem('sdp.progress'), before, 'student progress must survive a publish');
  assert.equal(SDP.Data.progress().streak.count, 3);

  // a second check with identical files reports no update
  const second = await new Promise((resolve) => SDP.Sync.checkForUpdates((err, result) => resolve(result)));
  assert.equal(second.updated, false);
});

/* ── R7 publishing payloads ─────────────────────────────────────────────── */
test('R7: GitHub Contents payload, CORS-simple GAS relay and 40K word chunking', () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R7 publishing
  const { SDP } = bootSync();
  const text = '{"ok":true,"note":"සිංහල"}';
  const payload = SDP.Sync.buildContentsCommitPayload('data/session.json', text, 'publish', 'abc123');
  assert.deepEqual(Object.keys(payload).sort(), ['branch', 'committer', 'content', 'message', 'sha']);
  assert.equal(payload.branch, 'main');
  assert.equal(payload.sha, 'abc123');
  assert.equal(Buffer.from(payload.content, 'base64').toString('utf8'), text);
  assert.equal(SDP.Sync.contentsUrl('data/session.json'),
    'https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/data/session.json');

  const relay = SDP.Sync.buildKeysRelayPayload('login');
  assert.ok(Buffer.byteLength(relay) < 600, 'relay body must stay CORS-simple and tiny');
  const parsed = JSON.parse(relay);
  assert.equal(parsed.action, 'login');
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §W6 — the PIN is verified inside the
  // Apps Script and must never travel in the relay body, a URL or a log line.
  assert.deepEqual(Object.keys(parsed).sort(), ['action', 'app', 'ver']);
  assert.equal(parsed.pin, undefined, 'relay must not carry the PIN');
  assert.equal(relay.indexOf('246813'), -1, 'the PIN must not appear anywhere in the body');
  // contract: docs/CHANGELOG_LEDGER.md §Release ledger — relay pins the current build version
  assert.equal(parsed.ver, '0.0.1.c');

  const longWords = Array.from({ length: 1200 }, (_, i) => ({
    w: 'word' + i,
    p: 'wɜːd',
    pos: 'n.',
    m: 'a useful word for the class',
    si: 'පන්තියට ප්‍රයෝජනවත් වචනයක්',
    s: 'This is a useful sentence for our class to practise today.'
  }));
  const chunks = SDP.Sync.publishWordsChunked(longWords);
  assert.ok(chunks.length >= 4, 'large lists must be split');
  let total = 0;
  for (const chunk of chunks) {
    const size = Buffer.byteLength(JSON.stringify(chunk));
    assert.ok(size < 40000, 'every chunk stays under the Apps Script 40K cell limit, got ' + size);
    total += chunk.length;
  }
  assert.equal(total, 1200);
});

test('R7: getClipUrl never invents a fake clip path', () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 tier 1
  const { SDP } = bootSync();
  assert.equal(SDP.Sync.getClipUrl({ w: 'afraid' }), '');
  assert.equal(SDP.Sync.getClipUrl({ w: 'afraid', clipUrl: 'assets/audio/session-w1-1.mp3' }), 'assets/audio/session-w1-1.mp3');
  assert.equal(SDP.Sync.getClipUrl({ w: 'afraid', clip: 'session-w1-2.mp3' }), 'assets/audio/session-w1-2.mp3');
  const session = readJSON('data/session.json');
  assert.equal(JSON.stringify(session).indexOf('guide-si'), -1, 'no fake guide stubs in the payload');
});
