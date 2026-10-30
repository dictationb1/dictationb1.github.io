/* v54 / 6.0.0 release gate - PIN-encrypted cross-device API key & settings sync.
   Written from scratch for v54: the old v53 file is gone, and every check below
   drives the real shipped code (index.html inline bootstrap + data/studio.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { harness } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const STUDIO = fs.readFileSync(path.join(ROOT, 'data', 'studio.js'), 'utf8');
const KEY = 'sdp.v54_encrypted_universal_sync';
const OLD_KEY = 'sdp.v53_github_voice_sync';
const VOICE = 'Xb7hH8MSUJpSbSDYk0k2';
const MODEL = 'eleven_flash_v2_5';
const VER = '6.0.0';
const PIN = '78987898';
const LECTURER_KEY = 'sk_test_lecturer_key_12345';
const WALL = './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';
const WALLS = [WALL, 'assets/wallpaper-hooded.mp4'];
const VAULT_TOPIC = 'https://ntfy.sh/dictationb1_sdp_vault_v54';
const AUDIO_TOPIC = 'https://ntfy.sh/dictationb1_sdp_audio_v54';

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function reply(status, body) {
  return Promise.resolve({
    ok: status < 400,
    status: status,
    json: function () { return Promise.resolve(body); },
    text: function () { return Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)); },
    arrayBuffer: function () { return Promise.resolve(new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0]).buffer); }
  });
}
function flush() { return new Promise(function (r) { setImmediate(r); }); }
async function settle(app, n) {
  for (let i = 0; i < (n || 5); i++) { app.clock.tick(60); await flush(); }
}
function pack(clipKey, text, b64) {
  const p = { version: 54, voiceId: VOICE, modelId: MODEL, clips: {} };
  p.clips[clipKey] = { text: text, voiceId: VOICE, modelId: MODEL, audio: 'data:audio/mpeg;base64,' + b64 };
  return p;
}

/* boot() builds a complete fake network: the repository JSON, the ntfy relay,
   Apps Script, ElevenLabs, the dictionary and the GitHub contents API. */
function boot(options) {
  options = options || {};
  const state = { calls: [], tts: [], posts: [], puts: [], xhr: [], docs: {}, ntfy: {}, startKeys: -1 };
  Object.assign(state.docs, options.docs || {});
  const handle = harness(options.seed, {
    before: function (w) {
      state.startKeys = w.localStorage.length;
      if (options.raw) { w.localStorage.setItem(options.rawKey || OLD_KEY, JSON.stringify(options.raw)); }
      w.fetch = function (url, init) {
        const target = String(url && url.url ? url.url : url);
        const method = String((init && init.method) || 'GET').toUpperCase();
        const body = init && init.body ? String(init.body) : '';
        state.calls.push(method + ' ' + target);
        if (method === 'POST') { state.posts.push({ url: target, body: body, headers: (init && init.headers) || {} }); }
        if (/api\.elevenlabs\.io\/v1\/user\/subscription/.test(target)) return reply(200, { tier: 'free', character_count: 250, character_limit: 10000 });
        if (/api\.elevenlabs\.io/.test(target)) { state.tts.push(target); return reply(200, 'mp3'); }
        if (/translate\.googleapis/.test(target)) return reply(200, [[['සිංහල අර්ථය']]]);
        if (/dictionaryapi\.dev/.test(target)) return reply(200, [{
          word: 'afraid', phonetic: '/əˈfreɪd/',
          phonetics: [{ text: '/əˈfreɪd/', audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/afraid-uk.mp3' }],
          meanings: [{ partOfSpeech: 'adjective', definitions: [{ definition: 'Feeling fear or anxiety; frightened.', example: 'She was never afraid of speaking in public.' }] }]
        }]);
        if (method === 'POST' && /ntfy\.sh\/(dictationb1_sdp_vault_v54|dictationb1_sdp_audio_v54)/.test(target)) return reply(200, { id: 'msg' });
        if (method === 'GET' && /ntfy\.sh\/dictationb1_sdp_vault_v54\/json/.test(target)) return reply(200, options.vaultFeed || '');
        if (method === 'GET' && /ntfy\.sh\/dictationb1_sdp_audio_v54\/json/.test(target)) return reply(200, options.audioFeed || '');
        if (/script\.google\.com/.test(target)) return reply(200, { ok: true });
        const doc = Object.keys(state.docs).filter(function (k) { return target.indexOf(k) > -1; })[0];
        if (doc) return reply(200, state.docs[doc]);
        if (/elevenlabs-audio\.json/.test(target)) return reply(200, options.vault || { version: 54, clips: {} });
        return reply(404, null);
      };
      function FauxXHR() { this.readyState = 0; this.status = 0; this.responseText = ''; this._cb = null; this.timeout = 0; }
      FauxXHR.prototype.open = function (method, url) { this.method = method; this.url = url; };
      FauxXHR.prototype.setRequestHeader = function () {};
      FauxXHR.prototype.send = function (body) {
        state.xhr.push({ method: this.method, url: this.url, body: body || null });
        const isGet = this.method === 'GET';
        this.readyState = 4;
        this.status = isGet ? 200 : 201;
        if (!isGet) { state.puts.push({ url: this.url, body: JSON.parse(body || '{}') }); }
        this.responseText = JSON.stringify(isGet ? { content: { sha: 'sha-old' } } : { content: { sha: 'sha-new' } });
        if (this._cb) { this._cb(); }
      };
      Object.defineProperty(FauxXHR.prototype, 'onreadystatechange', { set: function (fn) { this._cb = fn; }, get: function () { return this._cb; } });
      w.XMLHttpRequest = FauxXHR;
      if (options.before) { options.before(w); }
    }
  });
  const app = { state: state, w: handle.w, q: handle.q, clock: handle.clock, close: handle.close };
  if (options.noStudio !== true) { app.w.eval(STUDIO); }
  return app;
}

function renderStudio(app) {
  app.q.Admin.unlocked = true;
  app.q.Admin.tab = 'studio';
  let host = app.w.document.getElementById('adminHost');
  if (!host) {
    host = app.w.document.createElement('div');
    host.id = 'adminHost';
    app.w.document.body.appendChild(host);
  }
  app.q.Admin.renderTab(host);
  return host;
}
function unlock(app) { app.q.Admin.unlocked = true; app.q.Admin.pin = PIN; app.q.Admin.tab = 'studio'; }

/* ---------------------------------------------------------------- metadata */
test('v54 metadata: every published document is 6.0.0 / schema 54 with an encrypted vault', function () {
  ['data/version.json', 'data/config.json', 'data/session.json', 'data/elevenlabs-audio.json'].forEach(function (f) {
    const d = readJson(f);
    assert.equal(d.ver, 54, f + ' ver');
    assert.equal(d.appVersion, VER, f + ' appVersion');
    assert.equal(d.schema, 54, f + ' schema');
    assert.equal(d.settingsRev, 54, f + ' settingsRev');
    assert.equal(d.key, KEY, f + ' storage key');
    assert.equal(d.adminPin, PIN, f + ' admin pin');
    assert.equal(typeof d.syncRev, 'number', f + ' syncRev');
    assert.equal(d.vaultCiphertext.indexOf('SDP_ENC_V1:'), 0, f + ' encrypted vault envelope');
    assert.equal(/sk_[A-Za-z0-9]{6,}|ghp_[A-Za-z0-9]{6,}|xi-api-key/.test(d.vaultCiphertext), false, f + ' no cleartext secret');
    assert.ok(WALLS.indexOf(d.activeVideoSrc) > -1, f + ' hooded wallpaper: ' + d.activeVideoSrc);
  });
  const vault = readJson('data/elevenlabs-audio.json');
  assert.equal(vault.strictAdminOnly, true);
  assert.equal(vault.voiceId, VOICE);
  assert.equal(vault.modelId, MODEL);
  assert.equal(typeof vault.clips, 'object');
  const session = readJson('data/session.json');
  assert.ok(Array.isArray(session.words) && session.words.length === 30, 'the published word list travels in session.json');
  assert.ok(Array.isArray(session.pastSessions), 'pastSessions travel too');
});

test('v54 index.html stays one ES5 file well under the published byte ceiling', function () {
  assert.ok(INDEX.length < 438000, 'index.html is ' + INDEX.length + ' bytes');
  assert.ok(INDEX.length < 448000, 'hard ceiling');
  assert.equal(/<link\b/i.test(INDEX), false, 'no external <link>');
  assert.equal((INDEX.match(/<script[^>]+src=/g) || []).length, 0, 'no static script src');
  assert.ok(INDEX.indexOf('APP_VERSION="6.0.0"') > -1, 'APP_VERSION 6.0.0');
  assert.ok(INDEX.indexOf(KEY) > -1, 'v54 storage key');
  assert.ok(INDEX.indexOf('data/studio.js?v=54') > -1, 'lazy studio loader');
  assert.ok(INDEX.indexOf('window.EncryptedVault') > -1, 'EncryptedVault ships inline');
  assert.ok(INDEX.indexOf('SDP_ENC_V1:') > -1, 'vault prefix inline');
  assert.equal((INDEX.match(/api\.elevenlabs\.io/g) || []).length, 0, 'no paid endpoint on the student page');
  require('acorn').parse(INDEX.match(/<script>([\s\S]*?)<\/script>/)[1], { ecmaVersion: 5 });
});

test('v54 data/studio.js is ES5 and ships the whole studio plus the sync engine', function () {
  assert.equal(/async function|await\s|=>|`/.test(STUDIO), false, 'no async/await, arrows or template literals');
  ['window.ElevenVault', 'window.AdminAutoEnrich', 'window.GitHubSync', 'window.Publisher', 'window.ProfessorStudio',
    'window.UniversalSync', 'window.StudioSync', 'Cloud.commitFiles', 'Cloud.publish', 'Cloud.fetchRemote',
    VAULT_TOPIC, AUDIO_TOPIC].forEach(function (name) {
    assert.ok(STUDIO.indexOf(name) > -1, name + ' missing');
  });
});

/* ------------------------------------------------------------------- vault */
test('v54 EncryptedVault encrypts with the PIN and never leaks the API key', function () {
  const app = boot({ noStudio: true });
  try {
    const EV = app.w.EncryptedVault;
    assert.equal(typeof EV, 'object', 'EncryptedVault is published');
    assert.equal(EV.PREFIX, 'SDP_ENC_V1:');
    const payload = {
      syncRev: 1700000000000, elevenLabsKey: LECTURER_KEY, elevenLabsVoiceId: VOICE,
      elevenLabsModel: MODEL, ghToken: 'ghp_test_github_token_9876', adminPin: PIN,
      activeVideoSrc: WALL, videoDim: 18, mode: 'paper', writeFixed: 5, repeats: 2,
      sessionTitle: 'Session 9 - Weather', sessionDate: '2026-11-05',
      classInfo: 'CCBE Galle Branch • TUE/THU/IPET015', words: [{ w: 'zephyr', si: 'මෘදු සුළඟ' }]
    };
    const cipher = EV.encrypt(payload, PIN);
    assert.equal(cipher.indexOf('SDP_ENC_V1:'), 0, 'prefixed ciphertext');
    assert.equal(cipher.indexOf(LECTURER_KEY), -1, 'no plaintext API key');
    assert.equal(cipher.indexOf('sk_'), -1, 'no raw sk_ substring');
    assert.equal(cipher.indexOf('ghp_'), -1, 'no raw ghp_ substring');
    assert.equal(/[^A-Za-z0-9_-]/.test(cipher.slice('SDP_ENC_V1:'.length)), false, 'URL-safe base64 only');
    assert.equal(EV.encrypt(payload, PIN), cipher, 'deterministic for the same PIN');
    const back = EV.decrypt(cipher, PIN);
    assert.deepEqual(back, payload, 'round trip keeps every field (including Sinhala)');
    assert.equal(EV.decrypt(cipher, '00000000'), null, 'a wrong PIN cannot decrypt');
    assert.equal(EV.decrypt('SDP_ENC_V1:not-a-vault', PIN), null, 'garbage is rejected');
    assert.equal(EV.isVault(cipher), true);
    assert.equal(EV.isVault('sk_test_lecturer_key_12345'), false);
  } finally { app.close(); }
});

/* -------------------------------------------------- device #1 -> device #2 */
test('v54 device #1 saves the API key once and device #2 shows it in Lecturer Mode', async function () {
  /* ---------- Device #1: the lecturer's PC ---------- */
  const one = boot();
  let envelope = null;
  try {
    const host = renderStudio(one);
    const field = host.querySelector('#elApiKeyInput');
    assert.ok(field, '#elApiKeyInput exists');
    field.value = LECTURER_KEY;
    host.querySelector('#btnElVerify').click();
    await settle(one, 10);

    assert.equal(one.q.DB.data.settings.elevenLabsKey, LECTURER_KEY, 'the key is saved locally');
    const stored = JSON.parse(one.w.localStorage.getItem(KEY) || '{}');
    assert.equal(stored.settings.elevenLabsKey, LECTURER_KEY, 'localStorage holds the key for this PC');
    assert.equal(String(stored.vaultCiphertext || '').indexOf('SDP_ENC_V1:'), 0, 'the encrypted vault is stored');

    envelope = one.w.UniversalSync.envelope(false);
    assert.equal(String(envelope.vaultCiphertext).indexOf('SDP_ENC_V1:'), 0, 'envelope carries the ciphertext');
    assert.equal(String(envelope.vaultCiphertext).indexOf(LECTURER_KEY), -1, 'the envelope carries no plaintext key');
    assert.ok(Number(envelope.syncRev) > 0, 'syncRev is stamped');

    /* Channel 1: the zero-config relay receives the encrypted envelope */
    const relayed = one.state.posts.filter(function (p) { return p.url === VAULT_TOPIC; });
    assert.ok(relayed.length >= 1, 'the ntfy.sh relay was posted');
    assert.equal(relayed[0].headers.Title.indexOf('SDP-Sync-'), 0, 'the push title carries the revision');
    assert.equal(relayed[0].body.indexOf(LECTURER_KEY), -1, 'the relayed body carries no plaintext key');
    assert.equal(JSON.parse(relayed[0].body).vaultCiphertext.indexOf('SDP_ENC_V1:'), 0, 'the relayed body is an envelope');
  } finally { one.close(); }

  /* ---------- Device #2: a brand-new browser with empty storage ---------- */
  const two = boot({
    docs: {
      'data/config.json': { ver: 54, appVersion: VER, key: KEY, syncRev: envelope.syncRev, vaultCiphertext: envelope.vaultCiphertext }
    }
  });
  try {
    assert.equal(two.state.startKeys, 0, 'device #2 starts with empty storage');
    two.w.UniversalSync.boot();
    await settle(two, 12);
    assert.equal(two.q.DB.data.settings.elevenLabsKey, LECTURER_KEY, 'the API key arrived from data/config.json');

    const host = renderStudio(two);
    unlock(two);
    two.w.EncryptedVault.paint();
    assert.equal(host.querySelector('#elApiKeyInput').value, LECTURER_KEY, 'the key is visible in Lecturer Mode on device #2');
    assert.equal(two.w.localStorage.getItem(KEY) !== null, true, 'device #2 saved the settings locally');
    /* the single click sync button exists at the top of Lecturer Mode */
    assert.ok(host.querySelector('#btnForceSync'), '#btnForceSync');
    assert.match(host.querySelector('#syncBanner').textContent, /100% Synced Across All Devices/);
    assert.match(host.querySelector('#syncBanner').textContent, /API Key: Saved & Encrypted/);
    assert.match(host.querySelector('#syncBanner').textContent, /Voice Clips: \d\d/);
  } finally { two.close(); }
});

test('v54 a locked envelope is rejected on a device that does not hold the PIN', function () {
  const app = boot({ noStudio: true });
  try {
    const EV = app.w.EncryptedVault;
    const cipher = EV.encrypt({ syncRev: Date.now(), elevenLabsKey: LECTURER_KEY }, PIN);
    assert.equal(EV.decrypt(cipher, '98765432'), null, 'only the lecturer PIN opens the vault');
    assert.equal(EV.applyRemoteVault('SDP_ENC_V1:broken', PIN), null, 'corrupt ciphertext is ignored');
    assert.equal(app.q.DB.data.settings.elevenLabsKey || '', '', 'nothing was applied');
  } finally { app.close(); }
});

test('v54 tampering with one ciphertext byte invalidates the vault (MAC check)', function () {
  const app = boot({ noStudio: true });
  try {
    const EV = app.w.EncryptedVault, cipher = EV.encrypt({ syncRev: 1, elevenLabsKey: LECTURER_KEY }, PIN);
    const chars = cipher.slice('SDP_ENC_V1:'.length).split('');
    chars[chars.length - 3] = chars[chars.length - 3] === 'A' ? 'B' : 'A';
    assert.equal(EV.decrypt('SDP_ENC_V1:' + chars.join(''), PIN), null, 'a tampered body fails the MAC');
  } finally { app.close(); }
});

/* --------------------------------------------------- triple channel push */
test('v54 every lecturer save pushes the relay, the Cloud backend and GitHub in parallel', async function () {
  const app = boot();
  try {
    app.q.CONFIG.gasUrl = 'https://script.google.com/macros/s/AKfycbzfakefakefake/exec';
    app.w.Cloud.ghToken('ghp_test_github_token_9876');
    const host = renderStudio(app);
    host.querySelector('#elApiKeyInput').value = LECTURER_KEY;
    host.querySelector('#btnElVerify').click();
    await settle(app, 14);

    assert.ok(app.state.posts.some(function (p) { return p.url === VAULT_TOPIC; }), 'channel 1: ntfy relay');
    const gas = app.state.posts.filter(function (p) { return /script\.google\.com/.test(p.url); });
    assert.ok(gas.length >= 1, 'channel 1b: Apps Script Cloud');
    assert.equal(gas[0].headers['Content-Type'], 'text/plain;charset=utf-8', 'CORS-safe content type');
    assert.equal(gas[0].body.indexOf(LECTURER_KEY), -1, 'the Cloud never receives the plaintext key');

    assert.ok(app.state.puts.length >= 4, 'channel 2: four repository files');
    const paths = app.state.puts.map(function (p) { return p.url.replace(/^.*\/contents\//, ''); });
    ['data/session.json', 'data/version.json', 'data/config.json', 'data/elevenlabs-audio.json'].forEach(function (p) {
      assert.ok(paths.indexOf(p) > -1, p + ' committed: ' + paths.join(','));
    });
    assert.equal(app.state.puts[0].body.branch, 'main');
    const config = app.state.puts.filter(function (p) { return /config\.json$/.test(p.url); })[0].body;
    const decoded = Buffer.from(config.content, 'base64').toString('utf8');
    assert.ok(decoded.indexOf('SDP_ENC_V1:') > -1, 'config.json carries the encrypted vault');
    assert.ok(decoded.indexOf(LECTURER_KEY) === -1, 'config.json carries no plaintext key');
    const sessionDoc = JSON.parse(Buffer.from(app.state.puts.filter(function (p) { return /session\.json$/.test(p.url); })[0].body.content, 'base64').toString('utf8'));
    assert.equal(typeof sessionDoc.syncRev, 'number', 'session.json carries syncRev');
    assert.ok(sessionDoc.vaultCiphertext.indexOf('SDP_ENC_V1:') === 0, 'session.json carries the vault');
    assert.ok(Array.isArray(sessionDoc.words) && sessionDoc.words.length > 0, 'session.json carries the active words');
    assert.ok(Array.isArray(sessionDoc.pastSessions), 'session.json carries pastSessions');
  } finally { app.close(); }
});

test('v54 without any GitHub token the zero-config relay still reaches the other devices', async function () {
  const app = boot();
  try {
    assert.equal(app.w.Cloud.ghToken(), '', 'no token in this scenario');
    const host = renderStudio(app);
    host.querySelector('#elApiKeyInput').value = LECTURER_KEY;
    host.querySelector('#btnElVerify').click();
    await settle(app, 10);
    assert.ok(app.state.posts.some(function (p) { return p.url === VAULT_TOPIC; }), 'the ntfy relay was used');
    assert.equal(app.state.puts.length, 0, 'nothing was committed to GitHub');
    assert.equal(app.w.UniversalSync.notes.join('|').indexOf('no-token') > -1, true, 'the GitHub channel reports no-token');
  } finally { app.close(); }
});

test('v54 the wallpaper and settings change in Lecturer Mode is pushed automatically', async function () {
  const app = boot();
  try {
    app.w.SDPStudioReady = function () { return true; };
    const host = renderStudio(app);
    unlock(app);
    app.q.DB.data.settings.activeVideoSrc = './assets/bunny-live-wallpaper.mp4';
    app.q.DB.data.settings.videoDim = 34;
    app.q.DB.saveNow();
    app.clock.tick(1600);
    await settle(app, 8);
    assert.ok(app.state.posts.some(function (p) { return p.url === VAULT_TOPIC; }), 'a settings save pushes the vault');
    const env = app.w.UniversalSync.envelope(false);
    const back = app.w.EncryptedVault.decrypt(env.vaultCiphertext, PIN);
    assert.equal(back.activeVideoSrc, './assets/bunny-live-wallpaper.mp4', 'the new wallpaper is inside the encrypted payload');
    assert.equal(back.videoDim, 34, 'the new dim level is inside the encrypted payload');
    assert.ok(host.querySelector('#btnForceSync'), 'the sync button stays available');
  } finally { app.close(); }
});

/* ------------------------------------------------------------- pull logic */
test('v54 pullAll applies the highest syncRev and refreshes every lecturer input', async function () {
  const app = boot();
  try {
    const EV = app.w.EncryptedVault;
    const older = EV.encrypt({ syncRev: 1000, elevenLabsKey: 'sk_old_key_0001', sessionTitle: 'Old session' }, PIN);
    const newer = EV.encrypt({
      syncRev: 9000, elevenLabsKey: LECTURER_KEY, elevenLabsVoiceId: VOICE, elevenLabsModel: MODEL,
      sessionTitle: 'Session 9 - Weather', sessionDate: '2026-11-05', classInfo: 'CCBE Galle Branch',
      words: [{ w: 'zephyr', p: 'ˈzef.ər', m: 'a soft breeze', si: 'මෘදු සුළඟ', s: 'A warm zephyr crossed the harbour.' }]
    }, PIN);
    const feed = [
      JSON.stringify({ id: '1', event: 'message', message: JSON.stringify({ syncRev: 1000, vaultCiphertext: older }) }),
      JSON.stringify({ id: '2', event: 'message', message: JSON.stringify({ syncRev: 9000, vaultCiphertext: newer }) })
    ].join('\n') + '\n';
    app.w.fetch = function (url, init) {
      const target = String(url);
      app.state.calls.push(target);
      if (/data\/config\.json/.test(target)) { return reply(200, { ver: 54, syncRev: 500, vaultCiphertext: older }); }
      if (/data\/session\.json/.test(target)) { return reply(200, { ver: 54, syncRev: 400 }); }
      if (/data\/elevenlabs-audio\.json/.test(target)) { return reply(200, { ver: 54, clips: {} }); }
      if (/dictationb1_sdp_vault_v54\/json/.test(target)) { return reply(200, feed); }
      if (/dictationb1_sdp_audio_v54\/json/.test(target)) { return reply(200, ''); }
      if (init && String(init.method || '').toUpperCase() === 'POST') { return reply(200, { ok: true }); }
      return reply(404, null);
    };
    const host = renderStudio(app);
    let result = null;
    app.w.UniversalSync.pullAll(function (r) { result = r; });
    await settle(app, 12);
    assert.ok(result && result.ok, 'the pull completed');
    assert.equal(result.rev, 9000, 'the highest syncRev wins');
    assert.equal(app.q.DB.data.settings.elevenLabsKey, LECTURER_KEY, 'the newest key is applied');
    assert.equal(app.q.DB.data.session.title, 'Session 9 - Weather', 'the newest session is applied');
    assert.equal(app.w.UniversalSync.staticFiles.length, 3, 'config, session and the voice pack are read');
    app.w.EncryptedVault.paint();
    assert.equal(host.querySelector('#elApiKeyInput').value, LECTURER_KEY, '#elApiKeyInput refreshed');
    assert.equal(host.querySelector('#profSessionTitle').value, 'Session 9 - Weather', '#profSessionTitle refreshed');
    assert.match(host.querySelector('#adminQuickWordsInput').value, /zephyr/, '#adminQuickWordsInput refreshed');
  } finally { app.close(); }
});

test('v54 a stale localStorage key never beats a newer remote revision on boot', async function () {
  const seeded = { v: 54, settingsRev: 54, syncRev: 1, settings: { elevenLabsKey: 'sk_stale_key_9999' }, lists: [{ id: 'l1', name: 'Kept', words: [{ w: 'treasure' }] }] };
  const app = boot({ raw: seeded, rawKey: KEY });
  try {
    app.w.UniversalSync.boot();
    await settle(app, 10);
    assert.equal(app.q.DB.data.settings.elevenLabsKey, 'sk_stale_key_9999', 'nothing newer exists yet');
    const fresh = app.w.EncryptedVault.encrypt({ syncRev: Date.now() + 5000, elevenLabsKey: LECTURER_KEY }, PIN);
    app.w.UniversalSync.applyEnvelope({ syncRev: Date.now() + 5000, vaultCiphertext: fresh });
    assert.equal(app.q.DB.data.settings.elevenLabsKey, LECTURER_KEY, 'the newer remote key wins');
    const stale = app.w.EncryptedVault.encrypt({ syncRev: 2, elevenLabsKey: 'sk_old_key_0001' }, PIN);
    app.w.UniversalSync.applyEnvelope({ syncRev: 2, vaultCiphertext: stale });
    assert.equal(app.q.DB.data.settings.elevenLabsKey, LECTURER_KEY, 'an older revision cannot overwrite it');
  } finally { app.close(); }
});

test('v54 empty local key + a remote key is always applied even on an equal revision', function () {
  const app = boot({ noStudio: true });
  try {
    const EV = app.w.EncryptedVault;
    app.q.DB.data.settings.elevenLabsKey = '';
    app.q.DB.data.syncRev = 5000;
    const same = EV.encrypt({ syncRev: 5000, elevenLabsKey: LECTURER_KEY }, PIN);
    assert.ok(EV.applyRemoteVault(same, PIN), 'the key gap is filled');
    assert.equal(app.q.DB.data.settings.elevenLabsKey, LECTURER_KEY);
  } finally { app.close(); }
});

/* ----------------------------------------------------------- clips relay */
test('v54 generated clips travel to the shared relay and land in the vault on the next device', async function () {
  const app = boot();
  try {
    const V = app.w.ElevenVault;
    V.setApiKey('xi-test-key-54');
    const clips = {};
    clips[V.keyFor('Number 1')] = { text: 'Number 1', voiceId: VOICE, audio: 'data:audio/mpeg;base64,AAAA' };
    app.w.StudioSync.clips(clips, function () {});
    await settle(app, 6);
    const posted = app.state.posts.filter(function (p) { return p.url === AUDIO_TOPIC; });
    assert.equal(posted.length, 1, 'the clip was published to the audio relay');
    const record = JSON.parse(posted[0].body);
    assert.equal(record.key, V.keyFor('Number 1'));
    assert.equal(record.text, 'Number 1');
    assert.equal(record.voiceId, VOICE);
    assert.equal(record.dataUri.indexOf('data:audio/mpeg;base64,'), 0);

    const other = boot({ noStudio: true });
    try {
      other.w.eval(STUDIO);
      assert.equal(other.w.ElevenVault.clipCount(), 0, 'the second device starts with no clips');
      other.w.StudioSync.mergeClips(record);
      assert.ok(other.w.ElevenVault.clipCount() >= 1, 'the relayed clip is cached');
      assert.ok(other.w.ElevenVault.find('Number 1').indexOf('data:audio/mpeg') === 0, 'it replays the exact clip');
    } finally { other.close(); }
  } finally { app.close(); }
});

test('v54 the credit lock still refuses to generate outside the admin cycle', async function () {
  const app = boot();
  try {
    const V = app.w.ElevenVault;
    assert.equal(V.strictAdminOnly, true, 'credit lock flag');
    V.setApiKey('xi-test-key');
    let err = null;
    V.generate('Number 1', function (e) { err = e; });
    await settle(app, 4);
    assert.equal(err, 'locked', 'refused while not generating for the professor');
    assert.equal(app.state.tts.length, 0, 'no paid request');
  } finally { app.close(); }
});

test('v54 admin generation still fills only the missing clips', async function () {
  const app = boot();
  try {
    const V = app.w.ElevenVault;
    V.setApiKey('xi-test-key');
    const out = [];
    V.adminGenerateMissing(['Number 1', 'Number 2'], function () {}, function (r) { out.push(r); });
    await settle(app, 8);
    assert.equal(out[0].generated, 2, 'two clips generated once');
    assert.equal(app.state.tts.length, 2, 'two paid requests only');
    const again = [];
    V.adminGenerateMissing(['Number 1', 'Number 2'], function () {}, function (r) { again.push(r); });
    await settle(app, 8);
    assert.equal(again[0].generated, 0, 'nothing regenerated');
    assert.equal(app.state.tts.length, 2, 'no extra credit spent');
  } finally { app.close(); }
});

/* --------------------------------------------------------------- the studio */
test('v54 the 3-step studio, the sync bar and the advanced deck all render', function () {
  const app = boot();
  try {
    const host = renderStudio(app);
    ['syncBanner', 'btnForceSync', 'profSessionTitle', 'profSessionDate', 'profClassInfo', 'adminQuickWordsInput',
      'profWordsTable', 'btnAdminAutoComplete', 'elVaultList', 'btnElGenerateAll', 'btnElExportJson', 'btnElImportJson',
      'elApiKeyInput', 'elVoiceSelect', 'elModelSelect', 'btnElVerify', 'ghTokenInput', 'btnGhVerify',
      'elCreditBadge', 'elCreditLockBanner', 'adminQuickStatus', 'profWordCount'].forEach(function (id) {
      assert.ok(host.querySelector('#' + id), '#' + id + ' missing');
    });
    assert.equal(host.querySelectorAll('details.admin-advanced').length, 1, 'one advanced deck');
    assert.equal(host.querySelector('details.admin-advanced').hasAttribute('open'), false, 'advanced stays collapsed');
    assert.equal(host.querySelector('#adminQuickWordsInput').value.split('\n').length, 30, 'thirty words pre-filled');
    assert.match(host.querySelector('#elCreditLockBanner').textContent, /Credit Protection Lock: ACTIVE/);
    assert.equal(host.querySelector('#elVoiceSelect').value, VOICE);
    assert.equal(host.querySelector('#elModelSelect').value, MODEL);
    assert.match(host.querySelector('#profWordsTable').textContent, /afraid/i, 'the completed preview table is rendered');
    assert.equal(app.w.ProfessorStudio.cards(), 4, 'three steps plus the sync bar');
  } finally { app.close(); }
});

test('v54 the big publish button completes the words and pushes the vault', async function () {
  const app = boot();
  try {
    const host = renderStudio(app);
    const AE = app.w.AdminAutoEnrich;
    assert.deepEqual(AE.parse('afraid, amazed'), ['afraid', 'amazed']);
    host.querySelector('#adminQuickWordsInput').value = 'afraid, amazed';
    host.querySelector('#btnAdminAutoComplete').click();
    await settle(app, 16);
    const list = app.q.DB.data.lists[app.q.DB.data.lists.length - 1];
    assert.equal(list.words.length, 2);
    list.words.forEach(function (w) {
      assert.ok(w.w && w.p && w.d && w.m && w.s, 'completed word: ' + JSON.stringify(w));
    });
    assert.ok(app.state.posts.some(function (p) { return p.url === VAULT_TOPIC; }), 'the words are pushed to every device');
  } finally { app.close(); }
});

/* ------------------------------------------------------------- migrations */
test('v54 a v53 device migrates to 6.0.0 without losing words, keys or wallpaper', function () {
  const seed = {
    v: 53, settingsRev: 53, ver: 53, appVersion: '5.9.0',
    settings: { elevenLabsKey: 'xi-kept-key', perf: 'lite', activeVideoSrc: './assets/bunny-live-wallpaper.mp4', elevenLabsVoiceId: 'XB0fDUnXU5powFXDhCwa' },
    lists: [{ id: 'l1', name: 'Kept', words: [{ w: 'treasure', s: 'A treasure is precious.', m: 'Something valuable.' }] }],
    pastSessions: []
  };
  const app = boot({ raw: seed, rawKey: OLD_KEY, noStudio: true });
  try {
    const d = app.q.DB.data;
    assert.equal(d.v, 54, 'schema bumped');
    assert.equal(d.settingsRev, 54, 'settings revision bumped');
    assert.equal(d.settings.elevenLabsKey, 'xi-kept-key', 'the key survives');
    assert.equal(d.settings.elevenLabsVoiceId, 'XB0fDUnXU5powFXDhCwa', 'the chosen voice survives');
    assert.equal(typeof d.syncRev, 'number', 'syncRev starts at 0');
    assert.equal(d.vaultCiphertext, '', 'no vault yet');
    assert.ok(d.lists.some(function (l) { return l.id === 'l1'; }), 'the personal list survives');
  } finally { app.close(); }
});

test('v54 the old v53 storage key is read once and then written as the v54 key', function () {
  const app = boot({
    raw: { v: 53, settingsRev: 53, settings: { elevenLabsKey: 'xi-legacy' }, lists: [{ id: 'l1', name: 'Old', words: [{ w: 'afraid' }] }] },
    rawKey: OLD_KEY
  });
  try {
    assert.equal(app.q.DB.data.settings.elevenLabsKey, 'xi-legacy', 'legacy key still loads');
    app.q.DB.saveNow();
    assert.ok(app.w.localStorage.getItem(KEY), 'the app writes the v54 key');
    assert.ok(INDEX.indexOf('"sdp.v53_github_voice_sync"') > -1, 'the v53 key stays in the migration list');
  } finally { app.close(); }
});

/* ------------------------------------------------------------- audit fixes */
test('v54 all thirteen audit fixes are still shipped', function () {
  const app = boot();
  try {
    const C = app.q.CONFIG;
    assert.equal(app.q.DEFAULT_WALLPAPER_SRC, WALL, '1 hooded red-eyes wallpaper default');
    assert.equal(C.repoMedia.length, 3, '2 three repository videos');
    assert.ok(/blur\(14px\)/.test(INDEX), '3 real 14px liquid glass');
    assert.ok(INDEX.indexOf('hansanaCinemaCycle') > -1, '4 cinema wallpaper cycle');
    assert.ok(INDEX.indexOf('object-position') > -1, '5 wallpaper object-position');
    assert.ok(app.q.Speech.letterNames && app.q.Speech.letterNames.a, '6 letter names');
    assert.equal(typeof app.q.Speech.instructionPhrase, 'function', '7 instruction phrase');
    assert.equal(typeof app.q.Speech._playUrl, 'function', '8 one audio sink');
    assert.ok(app.w.document.getElementById('btnPause'), '9 one static pause control');
    assert.equal(String(app.q.Speech._seqToken !== undefined), 'true', '10 sequence token');
    assert.ok(INDEX.indexOf('id="credit"') > -1 || INDEX.indexOf('#credit') > -1, '11 single credit spotlight');
    assert.equal(C.adminPin, PIN, '12 admin pin');
    assert.equal(C.settingsRev, 54, '13 settings revision 54');
    assert.equal(C.key, KEY, 'v54 storage key');
    assert.equal(C.appVersion, VER, 'v54 app version');
  } finally { app.close(); }
});

test('v54 booting the app never touches ElevenLabs and never spends a credit', async function () {
  const app = boot();
  try {
    app.w.UniversalSync.boot();
    await settle(app, 10);
    assert.equal(app.state.tts.length, 0, 'no paid request on boot');
    const V = app.w.ElevenVault;
    assert.equal(V.stats.generatedCount, 0, 'nothing generated');
    assert.equal(V.hasKey(), false, 'no key by default');
    assert.equal(V.strictAdminOnly, true, 'the credit lock is on');
  } finally { app.close(); }
});

test('v54 the student page ships zero paid ElevenLabs endpoints and one admin generator', function () {
  assert.equal((INDEX.match(/api\.elevenlabs\.io/g) || []).length, 0, 'the student bundle has no paid endpoint');
  assert.equal((STUDIO.match(/api\.elevenlabs\.io\/v1\/text-to-speech/g) || []).length, 2, 'one code site plus its comment');
  assert.equal((STUDIO.match(/fetch\(C\.tts/g) || []).length, 1, 'a single fetch to the paid endpoint');
  assert.equal((STUDIO.match(/adminGenerateMissing: function/g) || []).length, 1, 'a single admin generator');
  const resolveBody = STUDIO.slice(STUDIO.indexOf('resolve: function'), STUDIO.indexOf('play: function'));
  const speakBody = STUDIO.slice(STUDIO.indexOf('speak: function'), STUDIO.indexOf('spell: function'));
  assert.equal(/gen\(|generate|api\.elevenlabs/.test(resolveBody), false, 'resolve never generates');
  assert.equal(/gen\(|generate|api\.elevenlabs/.test(speakBody), false, 'speak never generates');
});

test('v54 the data report describes the release', function () {
  ['data.html', 'data/index.html'].forEach(function (f) {
    const doc = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(doc.indexOf('v54') > -1, f + ' release pill');
    assert.ok(doc.indexOf('6.0.0') > -1, f + ' app version');
    assert.equal(doc.indexOf('<link'), -1, f + ' has no static <link>');
    assert.ok(doc.indexOf('../assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4') > -1, f + ' hooded wallpaper');
  });
  assert.equal(fs.readFileSync(path.join(ROOT, 'data.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'data/index.html'), 'utf8'), 'the two copies stay identical');
});
