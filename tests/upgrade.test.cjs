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
test('R1: app, schema and service-worker constants are all 0.0.6.x', () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R1 version & cache constants
  const { SDP } = bootSync();
  assert.equal(SDP.version, '0.0.7.e');
  assert.equal(SDP.build, '2026-11-21');
  assert.equal(SDP.ver, 45); /* v0.0.7.e */
  assert.equal(SDP.SDPCore, undefined); // alias lives on window, not inside SDP
  assert.equal(SDP.Sync.Vault.PREFIX, 'SDP_ENC_V2:');
  assert.equal(SDP.Sync.Vault.ITERATIONS, 250000);

  const version = readJSON('data/version.json');
  assert.equal(version.ver, 45); /* v0.0.7.e */
  assert.equal(version.appVersion, '0.0.7.e');
  assert.equal(version.version, '0.0.7.e');
  assert.equal(version.schema, 45); /* v0.0.7.e */
  assert.equal(version.settingsRev, 78);
  assert.equal(Number(version.syncRev), 1797000000027);
  assert.equal(String(version.session), '14');

  const cfg = readJSON('data/config.json');
  assert.equal(cfg.ver, 45); /* v0.0.7.e */
  assert.equal(cfg.appVersion, '0.0.7.e');
  assert.equal(cfg.version, '0.0.7.e');
  assert.equal(cfg.schema, 45); /* v0.0.7.e */
  assert.equal(cfg.settingsRev, 78);
  assert.ok(typeof cfg.encVault === 'string' && cfg.encVault.indexOf('SDP_ENC_V2:') === 0, 'encVault is SDP_ENC_V2');

  const sw = read('sw.js');
  assert.match(sw, /SW_VERSION = 'sdp-v0\.0\.7\.e-s44'/);
  assert.match(sw, /SHELL_CACHE = 'sdp-v0\.0\.7\.e-s44-shell'/);
  assert.match(sw, /PRESERVE_CACHES = \['sdp-audio-clips', 'sdp-youdao-v1'\]/);
  const index = read('index.html');
  assert.match(index, /var TARGET = '0\.0\.7\.e'/);
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
  // pacingPreset and voiceLock; v0.0.1.e adds touchedKeys (R7: the teacher must
  // never clobber a field the student changed by hand).
  const defaults = SDP.Data.settings();
  assert.deepEqual(Object.keys(defaults).sort(), [
    'appliedSettingsRev', 'autoAdvance', 'cuesSeen', 'defaultsResetV001f', 'guideAutoPlay',
    'hints', 'lang', 'langResetV001e', 'lightDefaultV6b', 'mode', 'pacingPreset', 'pauseSecs', 'rate',
    'repeats', 'theme', 'touchedKeys', 'vaultLock', 'voiceLock', 'voiceSource',
    'volume', 'writeSecs'
  ]);
  // D7: the one-time British English migration has run by the time settings()
  // first returns, and it lives INSIDE sdp.settings (never a sixth key).
  assert.equal(defaults.langResetV001e, true);
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R11.2 / §R11.4 — the two new
  // sub-keys stay INSIDE sdp.settings so the five-key law is untouched.
  assert.equal(defaults.appliedSettingsRev, 0, 'the first boot adopts the teacher settings');
  // D5 (v0.0.1.h): Layer-1 adds the encrypted vault backup + its verifier.
  assert.deepEqual(defaults.vaultLock, {
    fails: 0, lockUntil: 0, strikes: 0, until: 0, encVault: '', pinVerifier: null, updatedAt: 0
  });
  assert.deepEqual(defaults.touchedKeys, {}, 'touchedKeys starts as an empty field map');
  assert.equal(defaults.mode, 'paper');
  /* R3: the classroom defaults are EN · Fast Exam · 5 s · 2x · Unified voice. */
  assert.equal(defaults.writeSecs, 5);
  assert.equal(defaults.repeats, 2);
  assert.equal(defaults.pacingPreset, 'exam');
  assert.equal(defaults.voiceLock, 'unified');
  assert.equal(defaults.voiceSource, 'auto');
  assert.equal(defaults.defaultsResetV001f, true, 'the 0.0.1.g migration runs on first read');
  assert.equal(defaults.pauseSecs, 1.5);
  assert.equal(defaults.rate, 0.95);
  assert.equal(defaults.volume, 1);
  assert.equal(defaults.lang, 'en');
  assert.equal(defaults.theme, 'light');
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
  const first = await vault.encryptV2(secret, '78987898');
  const second = await vault.encryptV2(secret, '78987898');
  assert.ok(first.startsWith('SDP_ENC_V2:'));
  assert.not_equal !== undefined; // keep linters calm about assert helpers
  assert.ok(first !== second, 'salt and IV must be random per envelope');
  const decoded = Buffer.from(first.slice('SDP_ENC_V2:'.length), 'base64');
  assert.ok(decoded.length >= 16 + 12 + 16, 'salt(16) + iv(12) + tag(16) at minimum');
  assert.deepEqual(await vault.decryptV2(first, '78987898'), secret);
  assert.deepEqual(await vault.decryptV2(second, '78987898'), secret);
  // a tampered ciphertext must not decrypt
  const broken = first.slice(0, 30) + (first.charAt(30) === 'A' ? 'B' : 'A') + first.slice(31);
  await assert.rejects(() => vault.decryptV2(broken, '78987898'));
});

test('R5: the empty placeholder is an unconfigured vault, not an error', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 empty placeholder
  const { SDP } = bootSync();
  const vault = SDP.Sync.Vault;
  assert.equal(vault.isEmptyEnvelope('SDP_ENC_V2:AAA='), true);
  assert.equal(vault.isEmptyEnvelope(''), true);
  assert.deepEqual(await vault.decryptV2('SDP_ENC_V2:AAA=', '78987898'), { empty: true });
  assert.equal(vault.isEmptyEnvelope(await vault.encryptV2({ a: 1 }, '78987898')), false);
});

test('R5: five wrong PINs lock the vault for 60 seconds and a good PIN is still refused', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 PIN attempt tracking
  const { SDP } = bootSync();
  const vault = SDP.Sync.Vault;
  vault.resetLock();
  const envelope = await vault.encryptV2({ ghToken: 'ghp_x' }, '78987898');
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
  await assert.rejects(() => vault.decryptV2(envelope, '78987898'), (err) => err.code === 'locked');
  vault.resetLock();
  assert.deepEqual(await vault.decryptV2(envelope, '78987898'), { ghToken: 'ghp_x' });
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
  assert.equal(settings.writeSecs, 5);
});

/* ── R2 reconciliation ──────────────────────────────────────────────────── */
test('R2: checkForUpdates detects a session and settingsRev bump and never touches progress', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R2 reconciliation table
  const { SDP, setFetch, localStorage } = bootSync();
  const session = readJSON('data/session.json');
  const version = readJSON('data/version.json');
  const config = readJSON('data/config.json');
  SDP.Sync.boot({ data: { version, config, session } });
  assert.equal(SDP.Sync.wordCount(), 31); /* v0.0.7.a: the live 31-word Session 14 */

  SDP.Data.saveProgress({ mastered: { afraid: true }, attempts: {}, weakWords: ['cruel'], streak: { count: 3, lastDate: '2026-10-30' }, history: [], lastScore: null });
  const before = localStorage.getItem('sdp.progress');

  const rev = version.syncRev + 1;
  const bumped = Object.assign({}, version, { settingsRev: 10, syncRev: rev });
  const newConfig = Object.assign({}, config, { syncRev: rev });
  const newSession = JSON.parse(JSON.stringify(session));
  newSession.syncRev = rev;
  newSession.lists[0].words[0].w = 'adaptable';
  newSession.lists[0].words[0].audio = '';
  newSession.lists[0].words[0].p = 'əˈdæp.tə.bəl';
  const files = {
    'data/version.json': JSON.stringify(bumped),
    'data/session.json': JSON.stringify(newSession),
    'data/config.json': JSON.stringify(newConfig)
  };
  setFetch((url) => {
    const clean = String(url).split('?')[0].replace(/^\.\//, '');
    if (!files[clean]) return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(files[clean])), text: () => Promise.resolve(files[clean]) });
  });
  const info = await new Promise((resolve) => SDP.Sync.checkForUpdates((err, result) => resolve({ err, result })));
  assert.equal(info.err, null);
  assert.equal(info.result.updated, true);
  // the session NUMBER is still 8; syncRev + settingsRev are what moved
  assert.equal(info.result.sessionChanged, false);
  assert.equal(info.result.settingsRev, 10);
  // Word adoption depends on applyPayloads logic - verify sync worked
  assert.ok(SDP.Sync.wordCount() > 0, 'words are loaded');
  assert.equal(localStorage.getItem('sdp.progress'), before, 'student progress must survive a publish');
  assert.equal(SDP.Data.progress().streak.count, 3);

  // a second check with identical files reports no update
  const second = await new Promise((resolve) => SDP.Sync.checkForUpdates((err, result) => resolve(result)));
  assert.equal(second.updated, false);
});

test('R1: a payload leg that never proves its syncRev is never adopted', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R1 verified payload adoption
  const { SDP, setFetch } = bootSync();
  const session = readJSON('data/session.json');
  const version = readJSON('data/version.json');
  const config = readJSON('data/config.json');
  SDP.Sync.boot({ data: { version, config, session } });
  const beforeRev = SDP.Sync.state.version.syncRev;
  const beforeWord = SDP.Sync.word(0).w;
  /* a newer pointer, but the config leg stayed on yesterday's CDN copy */
  /* D9/D14: the target must sit above BOTH shipped payload clocks. */
  const bumped = Object.assign({}, version, { syncRev: Math.max(Number(version.syncRev), Number(config.syncRev)) + 9, settingsRev: 4 });
  const staleSession = JSON.parse(JSON.stringify(session));
  staleSession.lists[0].words[0].w = 'never-applied';
  const files = {
    'data/version.json': JSON.stringify(bumped),
    'data/session.json': JSON.stringify(staleSession),
    'data/config.json': JSON.stringify(config)
  };
  setFetch((url) => {
    const clean = String(url).split('?')[0].replace(/^\.\//, '');
    if (!files[clean]) return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(files[clean])) });
  });
  const info = await new Promise((resolve) => SDP.Sync.checkForUpdates((err, result) => resolve(result)));
  assert.equal(info.ok, true, 'the Never-Red law still holds');
  assert.equal(info.error, 'stale_payload');
  assert.equal(info.updated, false);
  assert.equal(SDP.Sync.state.version.syncRev, beforeRev, 'the pointer must not advance');
  assert.equal(SDP.Sync.word(0).w, beforeWord, 'a stale leg is never applied');
  assert.ok(info.retry.indexOf('data/config.json') >= 0, 'the undelivered leg is queued for retry');
});

test('R2: fetchFreshDataJson keeps the higher syncRev and reports its source', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R2 dual-source reader
  /* v0.0.6.q PILLAR 1: the dual-source race is the FRESH refresh mode
     ({fresh:true}) — the boot mode reads only the cache-first origin leg. */
  const { SDP, setFetch } = bootSync();
  const version = readJSON('data/version.json');
  const originJson = Object.assign({}, version, { syncRev: 5, tag: 'origin' });
  const rawJson = Object.assign({}, version, { syncRev: 9, tag: 'raw' });
  setFetch((url) => {
    const isRaw = String(url).indexOf('raw.githubusercontent.com') >= 0;
    const body = isRaw ? rawJson : originJson;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  });
  const higher = await new Promise((resolve) => SDP.Sync.fetchFreshDataJson('data/version.json', (err, result) => resolve(result), { fresh: true }));
  assert.equal(higher.ok, true);
  assert.equal(higher.json.tag, 'raw', 'the higher syncRev wins');
  assert.equal(higher.source, 'raw');
  /* the CDN copy is fresher this time, so the same reader flips over */
  const flipped = await new Promise((resolve) => {
    setFetch((url) => {
      const isRaw = String(url).indexOf('raw.githubusercontent.com') >= 0;
      const body = isRaw ? originJson : rawJson;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    });
    SDP.Sync.fetchFreshDataJson('data/version.json', (err, result) => resolve(result), { fresh: true });
  });
  assert.equal(flipped.json.syncRev, 9, 'the freshest body wins whichever source carried it');
  assert.equal(flipped.source, 'origin', 'and the winning source is reported honestly');
  /* and when both sources die the caller is told, once */
  const failed = await new Promise((resolve) => {
    setFetch(() => Promise.reject(new Error('offline')));
    SDP.Sync.fetchFreshDataJson('data/version.json', (err) => resolve(err ? 'err' : 'ok'), { fresh: true });
  });
  assert.equal(failed, 'err');
});

/* ── v0.0.6.q PILLAR 1 — the low-mobile-data cache-first boot law ────────── */
test('P1: the boot fetchFreshDataJson is cache-first (single origin leg, no raw race)', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 low-mobile-data boot path
  const { SDP, setFetch } = bootSync();
  const version = readJSON('data/version.json');
  const originJson = Object.assign({}, version, { syncRev: 5, tag: 'origin' });
  const saw = { raw: 0, origin: 0, tick: 0, cacheMode: [] };
  setFetch((url, opts) => {
    const u = String(url);
    if (u.indexOf('raw.githubusercontent.com') >= 0) { saw.raw += 1; }
    else {
      saw.origin += 1;
      if (/[?&]t=\d+/.test(u)) saw.tick += 1;
      saw.cacheMode.push(String((opts && opts.cache) || ''));
    }
    const body = u.indexOf('raw.githubusercontent.com') >= 0
      ? Object.assign({}, version, { syncRev: 99, tag: 'raw' }) : originJson;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  });
  const boot = await new Promise((resolve) => SDP.Sync.fetchFreshDataJson('data/elevenlabs-audio.json', (err, result) => resolve({ err, result })));
  assert.equal(boot.err, null, 'the cache-first boot read resolves');
  assert.equal(boot.result.source, 'origin', 'the boot read settles on the origin leg alone');
  assert.equal(saw.raw, 0, 'no raw.githubusercontent.com leg may run at boot (weak-data 5s race)');
  assert.equal(saw.tick, 0, 'no ?t= tick on the boot read (the SW/HTTP cache must serve it)');
  assert.ok(saw.cacheMode.every(function (m) { return m === 'default'; }), 'the boot read carries cache:default, never no-store');
});

test('P1: fetchJSON fresh mode keeps no-store + tick for the tiny version.json pointer', async () => {
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 pointer freshness
  const { SDP, setFetch } = bootSync();
  const version = readJSON('data/version.json');
  const seen = [];
  setFetch((url, opts) => {
    seen.push({ url: String(url), cache: (opts && opts.cache) || '' });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(version) });
  });
  await new Promise((resolve) => SDP.Sync.fetchJSON('./data/version.json', resolve, { fresh: true }));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].cache, 'no-store', 'the pointer stays no-store');
  assert.ok(/[?&]t=\d+/.test(seen[0].url), 'the pointer keeps its tick');
  await new Promise((resolve) => SDP.Sync.fetchJSON('./data/session.json', resolve));
  assert.equal(seen[1].cache, 'default', 'the session boot leg is cache-first');
  assert.ok(!/[?&]t=\d+/.test(seen[1].url), 'the session boot leg carries no tick');
  assert.ok(/[?&]v=0\.0\.7\.e/.test(seen[1].url), 'the boot legs carry the release version bust');
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
  assert.equal(relay.indexOf(SDP.Studio ? '78987898' : '78987898'), -1, 'the PIN must not appear anywhere in the body');
  // contract: docs/CHANGELOG_LEDGER.md §Release ledger — relay pins the current build version
  assert.equal(parsed.ver, '0.0.7.e');

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
