/* v55 / 6.1.0 release gate - guaranteed cross-device key & voice sync.
   Every check below drives the real shipped code: the inline bootstrap of index.html
   plus data/studio.js. Nothing here is mocked at the module level - only window.fetch,
   window.XMLHttpRequest and IndexedDB availability are faked, exactly like a phone. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const { harness } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const STUDIO = fs.readFileSync(path.join(ROOT, 'data', 'studio.js'), 'utf8');
const KEY = 'sdp.v55_guaranteed_device_sync';
const OLD_KEY = 'sdp.v54_encrypted_universal_sync';
const VOICE = 'Xb7hH8MSUJpSbSDYk0k2';
const MODEL = 'eleven_flash_v2_5';
const VER = '6.1.0';
const SCHEMA = 55;
const PIN = '78987898';
const LECTURER_KEY = 'sk_test_lecturer_key_12345';
const GH_TOKEN = 'ghp_test_github_token_9876';
const WALL = './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';
const WALLS = [WALL, 'assets/wallpaper-hooded.mp4', './assets/bunny-live-wallpaper.mp4', './assets/wandering-live-wallpaper.mp4'];
const KEYS_TOPIC = 'https://ntfy.sh/dictationb1_sdp_keys_v55';
const WORDS_TOPIC = 'https://ntfy.sh/dictationb1_sdp_words_v55';
const AUDIO_TOPIC = 'https://ntfy.sh/dictationb1_sdp_audio_v55';
const GH_TOKEN_URL = 'https://github.com/settings/tokens/new?description=Smart+Dictation+Player+Permanent+Sync&scopes=repo';
const EL_KEYS_URL = 'https://elevenlabs.io/app/settings/api-keys';
const PRE_EDIT_WARNING = 'Please complete the Step-by-Step Sync Setup';
const VERIFIED_LINE = '100% Cross-Device Permanent GitHub & ElevenLabs Sync ACTIVE';

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
function settle(app, n) {
  var i = 0;
  for (i = 0; i < (n || 6); i++) { app.clock.tick(80); }
  return new Promise(function (resolve) {
    var left = n || 6;
    function step() { left -= 1; if (left <= 0) { resolve(); return; } app.clock.tick(80); setImmediate(step); }
    setImmediate(step);
  });
}
function utf8b64(s) { return Buffer.from(String(s), 'utf8').toString('base64'); }
function bytes(s) { return Buffer.byteLength(String(s), 'utf8'); }

function boot(options) {
  options = options || {};
  const state = {
    calls: [], posts: [], puts: [], tts: [], docs: Object.assign({}, options.docs || {}),
    github: Object.assign({}, options.github || {}), keysFeed: options.keysFeed || '',
    wordsFeed: options.wordsFeed || '', audioFeed: options.audioFeed || '', startKeys: -1, subscriptions: 0
  };
  const handle = harness(options.seed, {
    before: function (w) {
      state.startKeys = w.localStorage.length;
      if (options.raw) { w.localStorage.setItem(options.rawKey || OLD_KEY, JSON.stringify(options.raw)); }
      w.fetch = function (url, init) {
        const target = String(url && url.url ? url.url : url);
        const method = String((init && init.method) || 'GET').toUpperCase();
        const body = init && init.body ? String(init.body) : '';
        state.calls.push({ method: method, url: target, body: body, headers: init ? init.headers : undefined });
        if (method === 'POST' && {}.hasOwnProperty.call({}, 'x') === false) {
          if (/ntfy\.sh|script\.google\.com|elevenlabs/.test(target) === false || /ntfy\.sh/.test(target)) {
            state.posts.push({ url: target, body: body, headers: init ? init.headers : undefined, hasHeaders: !!(init && init.headers) });
          }
        }
        if (/api\.elevenlabs\.io\/v1\/user\/subscription/.test(target)) { state.subscriptions += 1; return reply(200, { tier: 'free', character_count: 250, character_limit: 10000 }); }
        if (/api\.elevenlabs\.io\/v1\/text-to-speech/.test(target)) { state.tts.push({ url: target, text: (JSON.parse(body || '{}').text || '') }); return reply(200, 'mp3'); }
        if (/translate\.googleapis/.test(target)) { return reply(200, [[['සිංහල අර්ථය']]]); }
        if (/dictionaryapi\.dev/.test(target)) {
          return reply(200, [{
            word: 'afraid', phonetic: '/əˈfreɪd/',
            phonetics: [{ text: '/əˈfreɪd/', audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/afraid-uk.mp3' }],
            meanings: [{ partOfSpeech: 'adjective', definitions: [{ definition: 'Feeling fear or anxiety; frightened.', example: 'She was never afraid of speaking in public.' }] }]
          }]);
        }
        if (method === 'POST' && /ntfy\.sh/.test(target)) { return reply(200, { id: 'msg' }); }
        if (method === 'GET' && /sdp_keys_v55\/json/.test(target)) { return reply(200, state.keysFeed); }
        if (method === 'GET' && /sdp_words_v55\/json/.test(target)) { return reply(200, state.wordsFeed); }
        if (method === 'GET' && /sdp_audio_v55\/json/.test(target)) { return reply(200, state.audioFeed); }
        if (/api\.github\.com\/repos\//.test(target)) {
          const rel = target.replace(/^.*\/contents\//, '').replace(/\?.*$/, '');
          if (!{}.hasOwnProperty.call(state.github, rel)) { return reply(404, null); }
          const text = typeof state.github[rel] === 'string' ? state.github[rel] : JSON.stringify(state.github[rel]);
          return reply(200, { content: utf8b64(text), encoding: 'base64', sha: 'sha-api-' + rel });
        }
        if (/script\.google\.com/.test(target)) { return reply(200, { ok: true }); }
        const doc = Object.keys(state.docs).filter(function (k) { return target.indexOf(k) > -1; })[0];
        if (doc) { return reply(200, state.docs[doc]); }
        return reply(404, null);
      };
      function FauxXHR() { this.readyState = 0; this.status = 0; this.responseText = ''; this._cb = null; this.timeout = 0; }
      FauxXHR.prototype.open = function (method, url) { this.method = method; this.url = url; };
      FauxXHR.prototype.setRequestHeader = function () {};
      FauxXHR.prototype.send = function (body) {
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
  const app = { state: state, w: handle.w, q: handle.q, clock: handle.clock, consoleErrors: handle.consoleErrors, close: handle.close };
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
function docText(put) { return Buffer.from(String(put.body.content || ''), 'base64').toString('utf8'); }
function putFor(app, rel) { return app.state.puts.filter(function (p) { return new RegExp('/' + rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$').test(p.url); }); }

/* ---------------------------------------------------------------- metadata */
test('v55 metadata: every published document is 6.1.0 / schema 55 with an encrypted vault', function () {
  ['data/version.json', 'data/config.json', 'data/session.json', 'data/elevenlabs-audio.json'].forEach(function (f) {
    const d = readJson(f);
    assert.equal(d.ver, 55, f + ' ver');
    assert.equal(d.appVersion, VER, f + ' appVersion');
    assert.equal(d.schema, SCHEMA, f + ' schema');
    assert.equal(d.settingsRev, SCHEMA, f + ' settingsRev');
    assert.equal(d.key, KEY, f + ' storage key');
    assert.equal(d.adminPin, PIN, f + ' admin pin');
    assert.equal(typeof d.syncRev, 'number', f + ' syncRev');
    assert.equal(String(d.vaultCiphertext).indexOf('SDP_ENC_V1:'), 0, f + ' encrypted vault envelope');
    assert.equal(/sk_[A-Za-z0-9]{6,}|ghp_[A-Za-z0-9]{6,}|xi-api-key/.test(String(d.vaultCiphertext)), false, f + ' no cleartext secret');
    assert.ok(WALLS.indexOf(d.activeVideoSrc) > -1, f + ' hooded wallpaper: ' + d.activeVideoSrc);
  });
  const config = readJson('data/config.json');
  assert.equal(config.keysTopic, KEYS_TOPIC, 'config.json documents the keys relay');
  assert.equal(config.wordsTopic, WORDS_TOPIC, 'config.json documents the words relay');
  const vault = readJson('data/elevenlabs-audio.json');
  assert.equal(vault.strictAdminOnly, true, 'the credit lock is on');
  assert.equal(vault.voiceId, VOICE);
  assert.equal(vault.modelId, MODEL);
  assert.equal(typeof vault.clips, 'object');
  const session = readJson('data/session.json');
  assert.ok(Array.isArray(session.words) && session.words.length === 30, 'the published word list travels in session.json');
  assert.ok(Array.isArray(session.pastSessions), 'pastSessions travel too');
});

test('v55 index.html stays one ES5 file under the 440 KB budget and ships the keys relay', function () {
  const size = Buffer.byteLength(INDEX, 'utf8');
  assert.ok(size < 440000, 'index.html is ' + size + ' bytes (target < 440,000)');
  assert.ok(size < 448000, 'hard ceiling 448,000');
  assert.equal(/<link\b/i.test(INDEX), false, 'no external <link>');
  assert.equal((INDEX.match(/<script[^>]+src=/g) || []).length, 0, 'no static script src');
  assert.ok(INDEX.indexOf('APP_VERSION="6.1.0"') > -1, 'APP_VERSION 6.1.0');
  assert.ok(INDEX.indexOf(KEY) > -1, 'v55 storage key');
  assert.ok(INDEX.indexOf('data/studio.js?v=55') > -1, 'lazy studio loader v55');
  assert.ok(INDEX.indexOf('window.EncryptedVault') > -1, 'EncryptedVault ships inline');
  assert.ok(INDEX.indexOf('SDP_ENC_V1:') > -1, 'vault prefix inline');
  assert.ok(INDEX.indexOf('dictationb1_sdp_keys_v55') > -1, 'the <600 byte keys relay is documented inline');
  assert.equal((INDEX.match(/api\.elevenlabs\.io/g) || []).length, 0, 'no paid endpoint on the student page');
  acorn.parse(INDEX.match(/<script>([\s\S]*?)<\/script>/)[1], { ecmaVersion: 5 });
  assert.equal(/APP_VERSION="6\.1\.0"/.test(INDEX), true, 'version literal is not templated');
});

test('v55 data/studio.js is ES5 and ships the studio, the CORS-simple relays and playOrFetchOnce', function () {
  assert.equal(/\basync\s+function|await\s|=>|`/.test(STUDIO), false, 'no async/await, arrows or template literals');
  ['window.ElevenVault', 'window.AdminAutoEnrich', 'window.GitHubSync', 'window.Publisher', 'window.ProfessorStudio',
    'window.UniversalSync', 'window.StudioSync', 'Cloud.commitFiles', 'Cloud.publish', 'Cloud.fetchRemote',
    KEYS_TOPIC, WORDS_TOPIC, AUDIO_TOPIC, 'adminSyncWarningCard', 'btnSaveAndSyncAll', 'playOrFetchOnce',
    'GH_TOKENS_URL_PLACEHOLDER'].forEach(function (name) {
    if (name === 'GH_TOKENS_URL_PLACEHOLDER') {
      assert.ok(STUDIO.indexOf(GH_TOKEN_URL) > -1, 'the pre-filled GitHub token link is shipped');
      return;
    }
    assert.ok(STUDIO.indexOf(name) > -1, name + ' missing');
  });
  acorn.parse(STUDIO, { ecmaVersion: 5 });
});

/* ------------------------------------------------------------------- vault */
test('v55 EncryptedVault encrypts with the PIN and never leaks the API key', function () {
  const app = boot({ noStudio: true });
  try {
    const EV = app.w.EncryptedVault;
    assert.equal(typeof EV, 'object', 'EncryptedVault is published');
    assert.equal(EV.PREFIX, 'SDP_ENC_V1:');
    const payload = {
      syncRev: 1700000000000, elevenLabsKey: LECTURER_KEY, elevenLabsVoiceId: VOICE,
      elevenLabsModel: MODEL, ghToken: GH_TOKEN, adminPin: PIN,
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
    assert.deepEqual(EV.decrypt(cipher, PIN), payload, 'round trip keeps every field (including Sinhala)');
    assert.equal(EV.decrypt(cipher, '00000000'), null, 'a wrong PIN cannot decrypt');
    assert.equal(EV.decrypt('SDP_ENC_V1:not-a-vault', PIN), null, 'garbage is rejected');
    assert.equal(EV.isVault(cipher), true);
    assert.equal(EV.isVault('sk_test_lecturer_key_12345'), false);
  } finally { app.close(); }
});

/* ------------------------------------------- FIX #1: the CORS-simple relay */
test('v55 the keys relay POST is a <600 byte CORS-simple packet with zero custom headers', async function () {
  const app = boot();
  try {
    const host = renderStudio(app);
    host.querySelector('#elApiKeyInput').value = LECTURER_KEY;
    host.querySelector('#ghTokenInput').value = GH_TOKEN;
    app.w.Cloud.ghToken(GH_TOKEN);
    app.w.ElevenVault.setApiKey(LECTURER_KEY);
    assert.equal(app.w.SDPSaveAndSyncAll(null), true, 'the one-click save ran');
    await settle(app, 8);

    const keys = app.state.posts.filter(function (p) { return p.url === KEYS_TOPIC; });
    assert.ok(keys.length >= 1, 'the dedicated keys relay received the packet');
    const packet = keys[0];
    assert.equal(packet.hasHeaders, false, 'no custom headers -> no OPTIONS preflight');
    assert.equal(packet.headers, undefined, 'init.headers is undefined');
    assert.ok(bytes(packet.body) < 1000, 'payload is ' + bytes(packet.body) + ' bytes (< 1,000)');
    assert.ok(bytes(packet.body) < 600, 'payload is ' + bytes(packet.body) + ' bytes (< 600 byte design target)');
    assert.equal(packet.body.indexOf(LECTURER_KEY), -1, 'no plaintext API key on the wire');
    assert.equal(packet.body.indexOf(GH_TOKEN), -1, 'no plaintext GitHub token on the wire');
    assert.equal(packet.body.indexOf('sk_'), -1, 'no raw sk_ on the wire');
    assert.equal(packet.body.indexOf('ghp_'), -1, 'no raw ghp_ on the wire');
    assert.deepEqual(Object.keys(JSON.parse(packet.body)).sort(), ['sessionDate', 'sessionTitle', 'syncRev', 'vaultCiphertext'], 'exactly the four documented fields');
    const body = JSON.parse(packet.body);
    assert.equal(body.vaultCiphertext.indexOf('SDP_ENC_V1:'), 0, 'the packet carries the encrypted vault');
    assert.ok(Number(body.syncRev) > 0, 'the packet carries syncRev');

    /* even a 93-character fine-grained GitHub PAT stays far below 600 bytes */
    app.q.DB.data.settings.elevenLabsKey = 'sk_' + new Array(49).join('a');
    app.w.Cloud.ghToken('github_pat_' + new Array(83).join('b'));
    const bigPacket = app.w.UniversalSync.keyBody(true);
    assert.ok(bytes(bigPacket) < 600, 'a 93-character fine-grained token still fits: ' + bytes(bigPacket) + ' bytes');
    assert.equal(bigPacket.indexOf('github_pat_'), -1, 'still no plaintext token');
    assert.equal(bigPacket.indexOf('sk_aaaa'), -1, 'still no plaintext key');

    /* the same key also rides the full GitHub envelope, never as plaintext */
    const config = putFor(app, 'data/config.json');
    assert.ok(config.length >= 1, 'data/config.json was committed');
    assert.equal(docText(config[0]).indexOf(LECTURER_KEY), -1, 'config.json carries no plaintext key');
    assert.ok(docText(config[0]).indexOf('SDP_ENC_V1:') > -1, 'config.json carries the vault');
  } finally { app.close(); }
});

test('v55 the compact word relay is chunked under 3,500 bytes per POST with zero custom headers', async function () {
  const app = boot();
  try {
    renderStudio(app);
    const words = app.q.DB.data.lists[0].words;
    assert.equal(words.length, 30, 'thirty words in the active list');
    const bodies = app.w.UniversalSync.wordBodies(app.w.DB.data.syncRev || 7);
    assert.ok(bodies.length >= 1, 'at least one chunk');
    bodies.forEach(function (b, i) {
      assert.ok(bytes(b) < 3500, 'chunk ' + i + ' is ' + bytes(b) + ' bytes (< 3,500)');
    });
    const joined = [];
    bodies.forEach(function (b) {
      const doc = JSON.parse(b);
      assert.equal(typeof doc.syncRev, 'number', 'chunk carries syncRev');
      assert.equal(doc.total, bodies.length, 'chunk declares the total');
      doc.words.forEach(function (w) {
        assert.deepEqual(Object.keys(w).sort(), ['d', 'm', 'p', 's', 'w'], 'compact word keys { w, p, d, m, s }');
        joined.push(w.w);
      });
    });
    assert.equal(joined.length, 30, 'every word travels');
    assert.equal(joined[0], words[0].w, 'order is preserved');

    app.w.Cloud.ghToken(GH_TOKEN);
    const posted = [];
    app.w.StudioSync.words({ syncRev: 11, sessionTitle: '', sessionDate: '' }, function (n) { posted.push(n); });
    await settle(app, 6);
    const relayed = app.state.posts.filter(function (p) { return p.url === WORDS_TOPIC; });
    assert.ok(relayed.length === bodies.length, 'every chunk was POSTed');
    relayed.forEach(function (p) {
      assert.equal(p.hasHeaders, false, 'no custom headers on the words relay');
      assert.ok(bytes(p.body) < 3500, 'wire chunk stays under 3,500 bytes');
    });
  } finally { app.close(); }
});

/* --------------------------------- FIX #3: instant api.github.com reads (CDN bypass) */
test('v55 pullAll reads api.github.com instantly, bypassing the 60s Pages CDN', async function () {
  const app = boot({ noStudio: true });
  try {
    const EV = app.w.EncryptedVault;
    const cdnDoc = { ver: 55, appVersion: VER, key: KEY, syncRev: 1000, vaultCiphertext: EV.encrypt({ syncRev: 1000, elevenLabsKey: 'sk_cdn_old_key_0001' }, PIN) };
    const freshDoc = { ver: 55, appVersion: VER, key: KEY, syncRev: 9000, vaultCiphertext: EV.encrypt({ r: 9000, k: LECTURER_KEY, v: VOICE, m: MODEL, g: GH_TOKEN, p: PIN, w: WALL, d: 18, mo: 'paper', wf: 5, rp: 2 }, PIN) };
    app.w.eval(STUDIO);
    app.state.docs['data/config.json'] = cdnDoc;
    app.state.github['data/config.json'] = freshDoc;
    app.w.Cloud.ghToken(GH_TOKEN);
    let result = null;
    app.w.UniversalSync.pullAll(function (r) { result = r; });
    await settle(app, 14);
    assert.ok(result && result.ok, 'the pull completed');
    assert.equal(result.rev, 9000, 'the instant GitHub API revision wins over the stale CDN copy');
    assert.equal(app.q.DB.data.settings.elevenLabsKey, LECTURER_KEY, 'the key arrived without waiting for the CDN');
    assert.equal(app.w.Cloud.ghToken(), GH_TOKEN, 'the GitHub token arrived too');
    const ghCalls = app.state.calls.filter(function (c) { return /api\.github\.com\/repos\/dictationb1\/dictationb1\.github\.io\/contents\/data\//.test(c.url); });
    assert.ok(ghCalls.length >= 3, 'config, session and the voice pack are read from the API');
    ghCalls.forEach(function (c) {
      assert.match(c.url, /ref=main/, 'the read pins ref=main');
      assert.match(c.url, /t=\d+/, 'the read is cache-busted');
      assert.ok(c.headers && /^token /.test(c.headers.Authorization), 'the known token raises the rate limit to 5,000/h');
    });
  } finally { app.close(); }
});

test('v55 pullAll survives an ntfy attachment message (item.message is not JSON)', async function () {
  const app = boot({ noStudio: true });
  try {
    const EV = app.w.EncryptedVault;
    const cipher = EV.encrypt({ syncRev: 4000, elevenLabsKey: LECTURER_KEY }, PIN);
    app.w.eval(STUDIO);
    app.state.keysFeed = [
      JSON.stringify({ id: 'a', event: 'message', attachment: { name: 'big.json', url: 'https://ntfy.sh/file/x.txt' }, message: 'triggered' }),
      JSON.stringify({ id: 'b', event: 'message', message: JSON.stringify({ syncRev: 4000, vaultCiphertext: cipher, sessionTitle: 'Session 8', sessionDate: '2026-10-29' }) })
    ].join('\n') + '\n';
    let result = null;
    app.w.UniversalSync.pullAll(function (r) { result = r; });
    await settle(app, 12);
    assert.ok(result && result.ok, 'the pull still completes');
    assert.equal(result.rev, 4000, 'the inline message after the attachment is used');
    assert.equal(app.q.DB.data.settings.elevenLabsKey, LECTURER_KEY, 'the attachment never blocks the key');
  } finally { app.close(); }
});

/* -------------------------------- STEP 2: the pre-edit warning card + guide */
test('v55 Lecturer Mode opens with the amber pre-edit warning card and the EN/SI step-by-step guide', function () {
  const app = boot();
  try {
    const host = renderStudio(app);
    const card = host.querySelector('#adminSyncWarningCard');
    assert.ok(card, '#adminSyncWarningCard is rendered');
    assert.equal(host.firstChild && host.firstChild.tagName ? host.firstChild.id : '', 'adminSyncWarningCard', 'the warning card is the very first thing in #adminHost');
    assert.equal(card.getAttribute('data-state'), 'warn', 'warn state while the keys are missing');
    const style = card.getAttribute('style');
    assert.ok(style.indexOf('border: 2px solid #f59e0b !important') > -1, 'amber-gold border');
    assert.ok(style.indexOf('linear-gradient(145deg, rgba(120, 53, 15, 0.78), rgba(15, 23, 42, 0.92)) !important') > -1, 'amber glass background');
    assert.match(host.querySelector('#adminSyncHeadline').textContent, /Action Required Before Editing/);
    assert.match(host.querySelector('#adminSyncExplain').textContent, /SDP_ENC_V1/);
    assert.match(host.querySelector('#adminSyncExplain').textContent, /2-minute one-time setup/);
    const elLink = host.querySelector('#lnkElKeys');
    assert.ok(elLink, 'the ElevenLabs keys link exists');
    assert.equal(elLink.getAttribute('href'), EL_KEYS_URL);
    assert.equal(elLink.getAttribute('target'), '_blank');
    const ghLink = host.querySelector('#lnkGhToken');
    assert.ok(ghLink, 'the GitHub token link exists');
    assert.equal(ghLink.getAttribute('href'), GH_TOKEN_URL, 'the token link is pre-filled with scopes=repo');
    assert.equal(ghLink.getAttribute('target'), '_blank');
    assert.ok(host.querySelector('#btnSaveAndSyncAll'), '#btnSaveAndSyncAll exists');
    assert.match(host.querySelector('#btnSaveAndSyncAll').textContent, /Save, Encrypt & Sync Keys \+ Generate Voice Pack to All Devices/);
    assert.equal(host.querySelector('#syncGuideBody').getAttribute('data-lang'), 'en');
    assert.match(host.querySelector('#syncGuideBody').textContent, /Step 1/);
    assert.match(host.querySelector('#syncGuideBody').textContent, /No expiration/);
    host.querySelector('#btnSyncGuideLang').click();
    assert.equal(host.querySelector('#syncGuideBody').getAttribute('data-lang'), 'si', 'the Sinhala guide is rendered');
    assert.match(host.querySelector('#syncGuideBody').textContent, /පියවර 1/);
    assert.ok(host.querySelector('#syncGuideBody').textContent.indexOf('පියවර 3') > -1, 'Sinhala instructions');
    host.querySelector('#btnSyncGuideLang').click();
    assert.equal(host.querySelector('#syncGuideBody').getAttribute('data-lang'), 'en', 'the toggle returns to English');
  } finally { app.close(); }
});

test('v55 the pre-edit gate blocks publishing until both keys are connected, then turns emerald', async function () {
  const app = boot();
  try {
    const host = renderStudio(app);
    const before = app.q.DB.data.lists.length;
    host.querySelector('#adminQuickWordsInput').value = 'afraid\namazed';
    host.querySelector('#btnAdminAutoComplete').click();
    await settle(app, 8);
    const modal = app.w.document.getElementById('syncPreEditWarn');
    assert.ok(modal, 'the pre-edit warning alert is shown');
    assert.equal(modal.getAttribute('role'), 'alertdialog', 'it is a real alert dialog');
    assert.match(app.w.document.getElementById('syncPreEditWarnText').textContent, /GitHub Token \/ ElevenLabs Key is not connected yet/);
    assert.match(app.w.document.getElementById('syncPreEditWarnText').textContent, new RegExp(PRE_EDIT_WARNING.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(app.q.DB.data.lists.length, before, 'nothing was published while the keys are missing');
    assert.ok(app.w.document.getElementById('btnPreEditWarnSetup'), 'the "take me to the setup" button exists');

    /* now connect both keys -> the card becomes the emerald verified banner */
    host.querySelector('#elApiKeyInput').value = LECTURER_KEY;
    host.querySelector('#ghTokenInput').value = GH_TOKEN;
    app.w.SDPSaveAndSyncAll(null);
    await settle(app, 12);
    const card = app.w.document.getElementById('adminSyncWarningCard');
    assert.equal(card.getAttribute('data-state'), 'verified', 'verified state');
    const style = card.getAttribute('style');
    assert.ok(style.indexOf('border: 2px solid #34d399 !important') > -1, 'emerald-green border');
    assert.ok(style.indexOf('linear-gradient(145deg, rgba(6, 78, 59, 0.78), rgba(15, 23, 42, 0.92)) !important') > -1, 'emerald glass background');
    assert.match(app.w.document.getElementById('adminSyncHeadline').textContent, /Cross-Device Permanent GitHub & ElevenLabs Sync ACTIVE/);
    assert.ok(app.w.document.getElementById('adminSyncHeadline').textContent.indexOf(VERIFIED_LINE) > -1, 'the exact verified line');
    assert.match(app.w.document.getElementById('adminSyncHeadline').textContent, /SDP_ENC_V1/);
    assert.match(app.w.document.getElementById('adminSyncHeadline').textContent, /All Student Devices Synced/);
  } finally { app.close(); }
});

/* --------- STEP 3: the voice never falls back when the key is synced */
test('v55 #btnSaveAndSyncAll encrypts both keys, generates the missing clips and commits the voice pack', async function () {
  const app = boot();
  try {
    const host = renderStudio(app);
    host.querySelector('#elApiKeyInput').value = LECTURER_KEY;
    host.querySelector('#ghTokenInput').value = GH_TOKEN;
    assert.equal(app.w.SDPSaveAndSyncAll(null), true);
    await settle(app, 24);

    assert.equal(app.q.DB.data.settings.elevenLabsKey, LECTURER_KEY, 'the ElevenLabs key is saved');
    assert.equal(app.w.Cloud.ghToken(), GH_TOKEN, 'the GitHub token is saved');
    assert.equal(String(app.q.DB.data.vaultCiphertext).indexOf('SDP_ENC_V1:'), 0, 'both keys are encrypted into vaultCiphertext');
    const decrypted = app.w.EncryptedVault.decrypt(app.q.DB.data.vaultCiphertext, PIN);
    assert.equal(decrypted.k, LECTURER_KEY, 'the vault carries the ElevenLabs key');
    assert.equal(decrypted.g, GH_TOKEN, 'the vault carries the GitHub token');

    assert.ok(app.state.tts.length > 0, 'the missing voice clips were generated (' + app.state.tts.length + ')');
    const audio = putFor(app, 'data/elevenlabs-audio.json');
    assert.ok(audio.length >= 1, 'data/elevenlabs-audio.json was committed to GitHub');
    const pack = JSON.parse(docText(audio[audio.length - 1]));
    assert.ok(Object.keys(pack.clips).length > 0, 'the committed voice pack carries clips');
    assert.equal(pack.strictAdminOnly, true, 'the pack keeps the credit lock');
    assert.equal(pack.voiceId, VOICE);
    assert.ok(pack.clips[Object.keys(pack.clips)[0]].audio.indexOf('data:audio/mpeg;base64,') === 0, 'clips are permanent data URLs');
    assert.ok(app.state.posts.some(function (p) { return p.url === KEYS_TOPIC; }), 'the tiny keys relay was pushed');
    assert.ok(putFor(app, 'data/config.json').length >= 1, 'data/config.json was committed');
    assert.ok(putFor(app, 'data/session.json').length >= 1, 'data/session.json was committed');
    const keys = app.state.posts.filter(function (p) { return p.url === KEYS_TOPIC; });
    keys.forEach(function (p) { assert.ok(bytes(p.body) < 1000, 'every keys packet stays tiny'); });
    assert.match(app.w.document.getElementById('adminSyncHeadline').textContent, /Cross-Device Permanent GitHub & ElevenLabs Sync ACTIVE/);
  } finally { app.close(); }
});

test('v55 device #2 (empty storage) receives key + token and shows them in Lecturer Mode', async function () {
  /* ---------- device #1: the lecturer PC ---------- */
  const one = boot();
  let envelope = null;
  try {
    const host = renderStudio(one);
    host.querySelector('#elApiKeyInput').value = LECTURER_KEY;
    host.querySelector('#ghTokenInput').value = GH_TOKEN;
    one.w.SDPSaveAndSyncAll(null);
    await settle(one, 20);
    const keys = one.state.posts.filter(function (p) { return p.url === KEYS_TOPIC; });
    assert.ok(keys.length >= 1, 'device #1 posted the tiny keys packet');
    envelope = JSON.parse(keys[0].body);
    assert.ok(bytes(keys[0].body) < 600, 'the packet really is < 600 bytes');
  } finally { one.close(); }
  assert.ok(envelope && envelope.vaultCiphertext, 'an envelope was captured');

  /* ---------- device #2: a brand-new phone with empty storage ---------- */
  const two = boot({
    keysFeed: JSON.stringify({ id: 'k1', event: 'message', message: JSON.stringify(envelope) }) + '\n',
    github: { 'data/config.json': { ver: 55, appVersion: VER, key: KEY, syncRev: envelope.syncRev, vaultCiphertext: envelope.vaultCiphertext } }
  });
  try {
    assert.equal(two.state.startKeys, 0, 'device #2 starts with empty storage');
    two.w.UniversalSync.boot();
    await settle(two, 16);
    assert.equal(two.q.DB.data.settings.elevenLabsKey, LECTURER_KEY, 'the API key arrived through the relay');
    assert.equal(two.w.Cloud.ghToken(), GH_TOKEN, 'the GitHub token arrived through the relay');
    assert.equal(String(two.q.DB.data.vaultCiphertext).indexOf('SDP_ENC_V1:'), 0, 'device #2 stores only ciphertext');

    /* unlock Lecturer Mode with the PIN and render the studio */
    const host = renderStudio(two);
    two.q.Admin.pin = PIN;
    try { two.w.Admin.unlock(); } catch (e) {}
    two.w.EncryptedVault.paint();
    assert.equal(host.querySelector('#elApiKeyInput').value, LECTURER_KEY, '#elApiKeyInput is filled on device #2');
    assert.equal(host.querySelector('#ghTokenInput').value, GH_TOKEN, '#ghTokenInput is filled on device #2');
    assert.match(two.w.document.getElementById('adminSyncHeadline').textContent, /Cross-Device Permanent GitHub & ElevenLabs Sync ACTIVE/);
    assert.match(host.querySelector('#syncBanner').textContent, /API Key: Saved & Encrypted/);
    assert.match(host.querySelector('#syncBanner').textContent, /GitHub Token: Connected/);
  } finally { two.close(); }
});

test('v55 device #2 speaks ElevenLabs from the synced key: one request, deduped, cached, committed', async function () {
  const one = boot();
  let envelope = null;
  try {
    const host = renderStudio(one);
    host.querySelector('#elApiKeyInput').value = LECTURER_KEY;
    host.querySelector('#ghTokenInput').value = GH_TOKEN;
    one.w.SDPSaveAndSyncAll(null);
    await settle(one, 18);
    envelope = JSON.parse(one.state.posts.filter(function (p) { return p.url === KEYS_TOPIC; })[0].body);
  } finally { one.close(); }

  const two = boot({ keysFeed: JSON.stringify({ id: 'k1', event: 'message', message: JSON.stringify(envelope) }) + '\n' });
  try {
    two.w.UniversalSync.boot();
    await settle(two, 12);
    const V = two.w.ElevenVault;
    assert.equal(V.hasKey(), true, 'device #2 holds the decrypted key');
    assert.equal(V.clipCount(), 0, 'and no clips yet');
    assert.equal(typeof V.playOrFetchOnce, 'function', 'the smart playback entry point exists');

    /* a real user tap unlocks the one-time fetch path (boot must never spend a credit) */
    two.w.document.dispatchEvent(new two.w.Event('pointerdown'));
    assert.equal(V.gestureOn(), true, 'the first tap is registered');
    /* first play: exactly one paid request, then the clip is permanent */
    function ttsFor(word) {
      return two.state.tts.filter(function (t) { return t.text === word; });
    }
    two.q.Speech.playWord('afraid', 1);
    await settle(two, 10);
    assert.equal(ttsFor('afraid').length, 1, 'exactly one ElevenLabs request for the missing clip');
    assert.ok(V.find('afraid').indexOf('data:audio/mpeg;base64,') === 0, 'the clip is cached in the permanent vault');

    /* second play: zero credits */
    two.q.Speech.playWord('afraid', 1);
    await settle(two, 8);
    assert.equal(ttsFor('afraid').length, 1, 'the second playback used 0 credits');
    assert.ok(two.state.tts.length <= 2, 'no clip storm: ' + two.state.tts.length + ' request(s) in total');

    /* and the clip is queued for the permanent GitHub voice pack */
    two.clock.tick(2000);
    await settle(two, 10);
    const audio = putFor(two, 'data/elevenlabs-audio.json');
    assert.ok(audio.length >= 1, 'the generated clip was committed to data/elevenlabs-audio.json');
    const pack = JSON.parse(docText(audio[audio.length - 1]));
    assert.ok(pack.clips[V.keyFor('afraid')], 'the committed pack contains the clip');
  } finally { two.close(); }
});

test('v55 student playback without a key never reaches the paid endpoint', async function () {
  const app = boot();
  try {
    const V = app.w.ElevenVault;
    assert.equal(V.strictAdminOnly, true, 'credit lock flag');
    assert.equal(V.hasKey(), false, 'no key on a fresh device');
    let err = null;
    V.generate('Number 1', function (e) { err = e; });
    await settle(app, 4);
    assert.equal(err, 'locked', 'refused outside the professor cycle');
    app.q.Speech.playWord('afraid', 1);
    await settle(app, 6);
    assert.equal(app.state.tts.length, 0, 'zero paid requests on a key-less device');
    assert.equal(V.stats.generatedCount, 0, 'nothing generated');
  } finally { app.close(); }
});

test('v55 admin generation still fills only the missing clips', async function () {
  const app = boot();
  try {
    app.w.Cloud.ghToken(GH_TOKEN);
    const V = app.w.ElevenVault;
    V.setApiKey(LECTURER_KEY);
    const out = [];
    V.adminGenerateMissing(['Number 1', 'Number 2'], function () {}, function (r) { out.push(r); });
    await settle(app, 10);
    assert.equal(out[0].generated, 2, 'two clips generated once');
    assert.equal(app.state.tts.length, 2, 'two paid requests only');
    const again = [];
    V.adminGenerateMissing(['Number 1', 'Number 2'], function () {}, function (r) { again.push(r); });
    await settle(app, 10);
    assert.equal(again[0].generated, 0, 'nothing regenerated');
    assert.equal(app.state.tts.length, 2, 'no extra credit spent');
  } finally { app.close(); }
});

test('v55 a locked envelope is rejected without the PIN and tampering fails the MAC', function () {
  const app = boot({ noStudio: true });
  try {
    const EV = app.w.EncryptedVault;
    const cipher = EV.encrypt({ syncRev: Date.now(), elevenLabsKey: LECTURER_KEY }, PIN);
    assert.equal(EV.decrypt(cipher, '98765432'), null, 'only the lecturer PIN opens the vault');
    assert.equal(EV.applyRemoteVault('SDP_ENC_V1:broken', PIN), null, 'corrupt ciphertext is ignored');
    assert.equal(app.q.DB.data.settings.elevenLabsKey || '', '', 'nothing was applied');
    const chars = cipher.slice('SDP_ENC_V1:'.length).split('');
    chars[chars.length - 3] = chars[chars.length - 3] === 'A' ? 'B' : 'A';
    assert.equal(EV.decrypt('SDP_ENC_V1:' + chars.join(''), PIN), null, 'a tampered body fails the MAC');
  } finally { app.close(); }
});

/* --------------------------------------------------------------- the studio */
test('v55 the 3-card studio, the sync bar, the guide and the advanced deck all render', function () {
  const app = boot();
  try {
    const host = renderStudio(app);
    ['adminSyncWarningCard', 'adminSyncHeadline', 'syncGuideBody', 'btnSyncGuideLang', 'lnkElKeys', 'lnkGhToken',
      'btnSaveAndSyncAll', 'syncBanner', 'btnForceSync', 'profSessionTitle', 'profSessionDate', 'profClassInfo',
      'adminQuickWordsInput', 'profWordsTable', 'btnAdminAutoComplete', 'elVaultList', 'btnElGenerateAll',
      'btnElExportJson', 'btnElImportJson', 'elApiKeyInput', 'elVoiceSelect', 'elModelSelect', 'btnElVerify',
      'ghTokenInput', 'btnGhVerify', 'elCreditBadge', 'elCreditLockBanner', 'adminQuickStatus', 'profWordCount'].forEach(function (id) {
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
    assert.ok(app.w.document.getElementById('elVaultList'), '#elVaultList exists');
  } finally { app.close(); }
});

test('v55 the big publish button completes the words and pushes the vault once the keys are set', async function () {
  const app = boot();
  try {
    const host = renderStudio(app);
    host.querySelector('#elApiKeyInput').value = LECTURER_KEY;
    host.querySelector('#ghTokenInput').value = GH_TOKEN;
    app.w.Cloud.ghToken(GH_TOKEN);
    app.w.ElevenVault.setApiKey(LECTURER_KEY);
    const AE = app.w.AdminAutoEnrich;
    assert.deepEqual(AE.parse('afraid, amazed'), ['afraid', 'amazed']);
    host.querySelector('#adminQuickWordsInput').value = 'afraid, amazed';
    host.querySelector('#btnAdminAutoComplete').click();
    await settle(app, 24);
    const list = app.q.DB.data.lists[app.q.DB.data.lists.length - 1];
    assert.equal(list.words.length, 2);
    list.words.forEach(function (w) {
      assert.ok(w.w && w.p && w.m && w.s, 'completed word: ' + JSON.stringify(w));
    });
    assert.ok(app.state.posts.some(function (p) { return p.url === KEYS_TOPIC; }), 'the words are pushed to every device');
    assert.ok(putFor(app, 'data/session.json').length >= 1, 'the session is committed');
  } finally { app.close(); }
});

/* ------------------------------------------------------- preserved features */
test('v55 every v51-v54 feature and all thirteen audit fixes are still shipped', function () {
  const app = boot();
  try {
    const C = app.q.CONFIG;
    assert.equal(app.q.DEFAULT_WALLPAPER_SRC, WALL, '1 hooded red-eyes wallpaper default');
    assert.equal(C.repoMedia.length, 3, '2 three repository videos');
    assert.ok(/blur\(14px\)/.test(INDEX), '3 real 14px liquid glass');
    assert.ok(/blur\(14px\)/.test(fs.readFileSync(path.join(ROOT, 'data.html'), 'utf8')), '3b liquid glass on the report');
    assert.ok(INDEX.indexOf('hansanaCinemaCycle') > -1, '4 cinema wallpaper cycle');
    assert.ok(INDEX.indexOf('object-position') > -1, '5 wallpaper object-position');
    assert.ok(app.q.Speech.letterNames && app.q.Speech.letterNames.a, '6 letter names');
    assert.equal(typeof app.q.Speech.instructionPhrase, 'function', '7 instruction phrase');
    assert.equal(typeof app.q.Speech._playUrl, 'function', '8 one audio sink');
    assert.ok(app.w.document.getElementById('btnPause'), '9 one static pause control');
    assert.ok(app.w.document.getElementById('btnTestVoice'), '9b one static test-voice control');
    assert.equal(String(app.q.Speech._seqToken !== undefined), 'true', '10 sequence token');
    assert.ok(INDEX.indexOf('id="credit"') > -1 || INDEX.indexOf('#credit') > -1, '11 single credit spotlight');
    assert.ok(/Hansana/.test(INDEX), '11b "CREDITS GOES TO Hansana" spotlight');
    assert.equal(C.adminPin, PIN, '12 admin pin');
    assert.equal(C.settingsRev, SCHEMA, '13 settings revision 55');
    assert.equal(C.key, KEY, 'v55 storage key');
    assert.equal(C.appVersion, VER, 'v55 app version');
    assert.equal(app.w.ElevenVault.strictAdminOnly, true, 'strict credit lock');
    assert.equal(typeof app.q.Eng.spellWord, 'function', 'spell helper');
    assert.equal(typeof app.q.Eng.slower, 'function', 'slower helper');
    assert.equal(typeof app.q.Eng.repeatSentence, 'function', 'repeat sentence helper');
  } finally { app.close(); }
});

test('v55 booting the app never touches ElevenLabs and never spends a credit', async function () {
  const app = boot();
  try {
    app.w.UniversalSync.boot();
    await settle(app, 10);
    assert.equal(app.state.tts.length, 0, 'no paid request on boot');
    assert.equal(app.w.ElevenVault.stats.generatedCount, 0, 'nothing generated');
    assert.equal(app.w.ElevenVault.hasKey(), false, 'no key by default');
  } finally { app.close(); }
});

test('v55 the student page ships zero paid endpoints and the studio has exactly two paid call sites', function () {
  assert.equal((INDEX.match(/api\.elevenlabs\.io/g) || []).length, 0, 'the student bundle has no paid endpoint');
  assert.equal((STUDIO.match(/fetch\(C\.tts/g) || []).length, 2, 'the admin generator and the v55 play-once generator');
  assert.equal((STUDIO.match(/adminGenerateMissing: function/g) || []).length, 1, 'a single admin generator');
  const resolveBody = STUDIO.slice(STUDIO.indexOf('resolve: function'), STUDIO.indexOf('play: function'));
  assert.equal(/C\.tts|api\.elevenlabs/.test(resolveBody), false, 'resolve never generates');
});

/* ------------------------------------------------------------- migrations */
test('v55 a v54 device migrates to 6.1.0 without losing words, keys or wallpaper', function () {
  const seed = {
    v: 54, settingsRev: 54, ver: 54, appVersion: '6.0.0',
    settings: { elevenLabsKey: 'xi-kept-key', perf: 'lite', activeVideoSrc: './assets/bunny-live-wallpaper.mp4', elevenLabsVoiceId: 'XB0fDUnXU5powFXDhCwa' },
    lists: [{ id: 'l1', name: 'Kept', words: [{ w: 'treasure', s: 'A treasure is precious.', m: 'Something valuable.' }] }],
    pastSessions: []
  };
  const app = boot({ raw: seed, rawKey: OLD_KEY, noStudio: true });
  try {
    const d = app.q.DB.data;
    assert.equal(d.v, SCHEMA, 'schema bumped');
    assert.equal(d.settingsRev, SCHEMA, 'settings revision bumped');
    assert.equal(d.settings.elevenLabsKey, 'xi-kept-key', 'the key survives');
    assert.equal(d.settings.elevenLabsVoiceId, 'XB0fDUnXU5powFXDhCwa', 'the chosen voice survives');
    assert.equal(typeof d.syncRev, 'number', 'syncRev starts at 0');
    assert.ok(d.lists.some(function (l) { return l.id === 'l1'; }), 'the personal list survives');
  } finally { app.close(); }
});

test('v55 the v54 storage key is read once and then written as the v55 key', function () {
  const app = boot({
    raw: { v: 54, settingsRev: 54, settings: { elevenLabsKey: 'xi-legacy' }, lists: [{ id: 'l1', name: 'Old', words: [{ w: 'afraid' }] }] },
    rawKey: OLD_KEY
  });
  try {
    assert.equal(app.q.DB.data.settings.elevenLabsKey, 'xi-legacy', 'legacy key still loads');
    app.q.DB.saveNow();
    assert.ok(app.w.localStorage.getItem(KEY), 'the app writes the v55 key');
    assert.ok(INDEX.indexOf('"sdp.v54_encrypted_universal_sync"') > -1, 'the v54 key stays in the migration list');
  } finally { app.close(); }
});

test('v55 the data report describes the release', function () {
  ['data.html', 'data/index.html'].forEach(function (f) {
    const doc = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(doc.indexOf('v55') > -1, f + ' release pill');
    assert.ok(doc.indexOf('6.1.0') > -1, f + ' app version');
    assert.equal(doc.indexOf('<link'), -1, f + ' has no static <link>');
    assert.ok(doc.indexOf('../assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4') > -1, f + ' hooded wallpaper');
  });
  assert.equal(fs.readFileSync(path.join(ROOT, 'data.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'data/index.html'), 'utf8'), 'the two copies stay identical');
});
