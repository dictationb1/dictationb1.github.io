'use strict';
/* v57 / 6.3.0 regression gate. Test PINs and token prefixes are constructed at
 * runtime; no shipped/default PIN or live-looking token literal is committed. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { harness } = require('./app-harness.cjs');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const INDEX = read('index.html');
const STUDIO = read('data/studio.js');
const TEST_PIN = require('./test-pin.cjs');
const TEST_KEY = ['s', 'k_'].join('') + 'runtime_test_key_not_live';
const TEST_GH = ['g', 'hp_'].join('') + 'runtime_test_token_not_live';

function clickUnlock(app, pin) {
  app.q.Admin.open(); app.clock.tick(20);
  const doc = app.w.document;
  for (const digit of pin) {
    const b = doc.querySelector('#pinPad [data-k="' + digit + '"]');
    assert.ok(b, 'PIN pad digit ' + digit); b.click();
  }
  doc.getElementById('pinSubmit').click(); app.clock.tick(20);
}
function freshMeter(opts) {
  delete require.cache[require.resolve('../data/data-meter.js')];
  const dom = new JSDOM('<!doctype html><html><body><video id="bgLiveVideo"></video><audio id="ttsMasterAudio"></audio></body></html>', { url: 'https://example.test/', runScripts: 'outside-only' });
  const w = dom.window;
  w.localStorage.clear();
  if (opts && opts.before) opts.before(w);
  vm.runInContext(read('data/data-meter.js'), dom.getInternalVMContext());
  return { w, m: w.SDPDataMeter, dom };
}

test('v57 metadata, ES5 single-file budget and identical transparency routes', () => {
  for (const f of ['data/config.json', 'data/session.json', 'data/version.json', 'data/elevenlabs-audio.json', 'data/media-manifest.json']) {
    const d = JSON.parse(read(f)); assert.equal(d.ver, 57, f); assert.equal(d.appVersion, '6.3.0', f);
    assert.ok(!d.adminPin && !d.vaultCiphertext, f + ' has no public PIN/vault');
  }
  assert.ok(INDEX.includes('APP_VERSION="6.3.0"'));
  assert.ok(Buffer.byteLength(INDEX) <= 600000);
  assert.equal(read('data.html'), read('data/index.html'));
  assert.ok(read('data.html').includes('./data/data-meter.js'));
  assert.ok(!/<video[^>]*\bsrc=/.test(read('data.html')), '/data must not download video by default');
});

test('first lecturer unlock creates a local sdp.v2 salted hash; later unlocks verify it', () => {
  const app = harness(null, { crypto: true });
  try {
    const st = app.q.DB.data.settings;
    assert.equal(st.pinHash, ''); assert.equal(st.pinSalt, '');
    clickUnlock(app, TEST_PIN);
    assert.equal(app.q.Admin.unlocked, true);
    assert.ok(/^[a-f0-9]{64}$/.test(st.pinHash));
    assert.equal(st.pinHash, require('node:crypto').createHash('sha256').update('sdp.v2:' + st.pinSalt + ':' + TEST_PIN).digest('hex'));
    assert.ok(!app.w.localStorage.getItem(app.q.CONFIG.key).includes(TEST_PIN));
    app.q.Admin.lock(); assert.equal(app.q.Admin.isUnlockedOnThisDevice(), false);
    clickUnlock(app, '1111'); assert.equal(app.q.Admin.unlocked, false);
    clickUnlock(app, TEST_PIN); assert.equal(app.q.Admin.isUnlockedOnThisDevice(), true);
  } finally { app.close(); }
});

test('raw lecturer keys are scrubbed from localStorage and live only in the unlocked tab session', () => {
  const app = harness(null, { crypto: true });
  try {
    app.q.DB.data.settings.elevenLabsKey = TEST_KEY;
    app.q.DB.saveNow();
    assert.ok(!app.w.localStorage.getItem(app.q.CONFIG.key).includes(TEST_KEY));
    assert.equal(app.q.Cloud.ghToken(), '');
    clickUnlock(app, TEST_PIN);
    app.q.Cloud.ghToken(TEST_GH);
    assert.equal(app.w.sessionStorage.getItem('sdp.session.ghToken'), TEST_GH);
    assert.ok(!JSON.stringify(app.w.localStorage).includes(TEST_GH));
    app.q.Admin.lock();
    assert.equal(app.w.sessionStorage.getItem('sdp.session.ghToken'), null);
  } finally { app.close(); }
});

test('ElevenVault.fetchOnce/gen are null/locked for students and playback never auto-generates', () => {
  const app = harness(null, { crypto: true });
  try {
    app.w.eval(STUDIO);
    const V = app.w.ElevenVault; let paid = 0;
    app.w.fetch = function (url) { if (String(url).includes('api.elevenlabs.io')) paid++; return Promise.reject(Error('offline')); };
    assert.equal(V.fetchOnce('Number 31'), null);
    assert.equal(V.gen('Number 31', function () {}), false);
    V.playOrFetchOnce('anxious', 'en', 1, function () {}, 1);
    app.clock.tick(20);
    assert.equal(paid, 0, 'student playback must not call ElevenLabs');
    clickUnlock(app, TEST_PIN);
    V.setApiKey(TEST_KEY);
    assert.equal(V.apiKey(), TEST_KEY);
    assert.ok(!app.w.localStorage.getItem(app.q.CONFIG.key).includes(TEST_KEY));
  } finally { app.close(); }
});

test('SDP_ENC_V2 AES-GCM round-trips with random salt/IV; V1 writing is disabled', async () => {
  const app = harness(null, { crypto: true });
  try {
    const EV = app.w.EncryptedVault, plain = { hello: 'world', n: 3 };
    const a = await EV.encryptAsync(plain, TEST_PIN), b = await EV.encryptAsync(plain, TEST_PIN);
    assert.ok(a.startsWith('SDP_ENC_V2:')); assert.notEqual(a, b);
    assert.equal(JSON.stringify(await EV.decryptAsync(a, TEST_PIN)), JSON.stringify(plain));
    assert.equal(await EV.decryptAsync(a, '0000'), null);
    assert.equal(EV.encrypt(plain, TEST_PIN), null, 'no new V1 vaults');
  } finally { app.close(); }
});

test('videoBufferedBytes uses the buffered fraction even when readyState is high', () => {
  const env = freshMeter();
  env.w.localStorage.setItem('sdp.mediaManifest.v1', read('data/media-manifest.json'));
  const v = env.w.document.getElementById('bgLiveVideo');
  v.src = './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';
  Object.defineProperties(v, { readyState: { value: 4 }, networkState: { value: 1 }, duration: { value: 100 }, buffered: { value: { length: 1, start: () => 0, end: () => 20 } } });
  env.m.start({ interval: false });
  assert.equal(env.m.videoBufferedBytes(), Math.round(10555152 * 0.2));
  assert.ok(env.m.getLive().videoBytes < 10555152);
  env.dom.window.close();
});

test('persistTotals adds only the positive delta across repeated stop/visibility saves', () => {
  const env = freshMeter(); const m = env.m;
  m.start({ interval: false }); m.addBytes('app', 1000);
  m.stop(); m.stop(); m.start({ interval: false }); m.addBytes('app', 500); m.stop();
  const day = Object.keys(JSON.parse(env.w.localStorage.getItem(m.STORAGE.daily)))[0];
  assert.equal(JSON.parse(env.w.localStorage.getItem(m.STORAGE.daily))[day], 1500);
  assert.equal(Number(env.w.localStorage.getItem(m.STORAGE.allTime)), 1500);
  m.resetSession(); m.addBytes('app', 10); m.stop();
  assert.equal(JSON.parse(env.w.localStorage.getItem(m.STORAGE.daily))[day], 1510);
  env.dom.window.close();
});

test('meter formats B/KB/MB, estimates opaque Youdao plays, and archives buffer-full timings', () => {
  const env = freshMeter(); const m = env.m; m.start({ interval: false });
  assert.equal(m.formatMB(512), '512 B');
  assert.equal(m.formatMB(2048), '2.0 KB (0.00 MB)');
  assert.equal(m.formatMB(1048576), '1.00 MB');
  m.accountEntry({ name: 'https://dict.youdao.com/dictvoice?type=1&audio=anxious', transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, startTime: 1, duration: 5 });
  assert.equal(m.getLive().estimatedAudioBytes, 11000);
  m.addBytes('app', 100);
  env.w.performance.onresourcetimingbufferfull();
  assert.ok(m.getLive().archivedBytes >= 100);
  assert.deepEqual(m._state ? m._state.seenUrls : {}, {});
  env.dom.window.close();
});

test('mode profiles come from the media manifest and LKR presets update cost', () => {
  const env = freshMeter(); const m = env.m;
  env.w.localStorage.setItem(m.STORAGE.manifest, read('data/media-manifest.json'));
  m.start({ interval: false });
  const profiles = m.getModeProfiles(), hooded = profiles.find(p => p.id === 'hooded'), staticP = profiles.find(p => p.id === 'static');
  assert.equal(hooded.assetBytes, 10555152); assert.equal(staticP.assetBytes, 0);
  assert.ok(hooded.bytes > staticP.bytes); assert.ok(hooded.desc.includes('Estimated'));
  m.setPrice(49); assert.equal(m.price(), 49); assert.ok(Math.abs(m.costLkr(1073741824) - 49) < 1e-9);
  env.dom.window.close();
});


test('service worker v57 slices cached full video responses into HTTP 206 ranges', async () => {
  const src = read('sw.js');
  assert.ok(src.includes("VERSION = 'sdp-v57'"));
  const store = new Map();
  const caches = { open: async () => ({ match: async k => store.get(String(k)) || null, put: async (k, v) => { store.set(String(k), v); } }) };
  const listeners = {};
  const self = { location: { origin: 'https://example.test' }, addEventListener: (n, f) => { listeners[n] = f; }, skipWaiting: () => {}, clients: { claim: () => {} } };
  vm.runInNewContext(src, { self, caches, URL, Headers, Response, Promise, fetch: async () => { throw Error('offline'); } });
  const full = new Response(new Uint8Array([0,1,2,3,4,5,6,7,8,9]), { status: 200, headers: { 'Content-Length': '10', 'Content-Type': 'video/mp4' } });
  store.set('https://example.test/assets/clip.mp4', full);
  let answered = null;
  listeners.fetch({ request: { method: 'GET', url: 'https://example.test/assets/clip.mp4', headers: new Headers({ Range: 'bytes=2-5' }) }, respondWith: p => { answered = p; }, waitUntil: () => {} });
  const res = await answered;
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('Content-Range'), 'bytes 2-5/10');
  assert.deepEqual(Array.from(new Uint8Array(await res.arrayBuffer())), [2,3,4,5]);
});

test('meter classifies posters as images and keeps cross-origin audio labelled as an estimate', () => {
  const env = freshMeter(); const m = env.m; m.start({ interval: false });
  m.accountEntry({ name: 'https://example.test/assets/hooded-poster.webp', transferSize: 5000, encodedBodySize: 5000, decodedBodySize: 5000, startTime: 1, duration: 1 });
  m.accountEntry({ name: 'https://dict.youdao.com/dictvoice?type=1&audio=afraid', transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, startTime: 2, duration: 1 });
  const live = m.getLive();
  assert.equal(live.videoBytes, 0, 'a poster is not video');
  assert.equal(live.estimatedAudioBytes, 11000);
  assert.ok(/estimate/i.test(live.audioLabel));
  env.dom.window.close();
});

test('publish preview is mandatory and cancel never commits session files', () => {
  const app = harness(null, { crypto: true });
  try {
    app.w.eval(STUDIO);
    clickUnlock(app, TEST_PIN);
    app.q.Cloud.ghToken(TEST_GH);
    let result = null, puts = 0;
    app.w.fetch = function (url, init) { if (init && init.method === 'PUT') puts++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ content: { sha: 'x' } }) }); };
    app.q.Cloud.commitFiles([{ p: 'data/session.json', text: '{"words":[]}' }], 'qa', r => { result = r; });
    app.clock.tick(50);
    const ta = app.w.document.getElementById('publishPreviewWords');
    assert.ok(ta, 'editable preview opens');
    assert.equal(puts, 0);
    const cancel = Array.from(app.w.document.querySelectorAll('#sheets button')).find(b => /Cancel/.test(b.textContent));
    cancel.click(); app.clock.tick(50);
    assert.equal(result.ok, false); assert.equal(puts, 0);
  } finally { app.close(); }
});
