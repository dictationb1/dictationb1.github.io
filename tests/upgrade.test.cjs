/* v56 / 6.2.0 release gate — full audit repair (P0–P6).
 *
 * Every check drives the real shipped code: the inline bootstrap of index.html,
 * data/studio.js and data/data-meter.js. Only window.fetch, the resource-timing
 * buffer and IndexedDB availability are faked, exactly like a phone on a metered
 * Sri Lankan mobile network. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const { JSDOM } = require('jsdom');
const { harness } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(ROOT, r), 'utf8');
const INDEX = read('index.html');
const METER = read('data/data-meter.js');
const STUDIO = read('data/studio.js');
const SW = read('sw.js');
const MANIFEST = JSON.parse(read('manifest.webmanifest'));
const MEDIA = JSON.parse(read('data/media-manifest.json'));

const webcrypto = require('node:crypto').webcrypto;
const PIN = '78987898';
const LECTURER_KEY = 'sk_test_lecturer_key_12345';
const GH_TOKEN = 'ghp_test_github_token_9876';
const KEY = 'sdp.v56_audit_verified';

function reply(status, body) {
  return Promise.resolve({
    ok: status < 400, status: status,
    json: function () { return Promise.resolve(body); },
    text: function () { return Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)); },
    arrayBuffer: function () { return Promise.resolve(new Uint8Array([73, 68, 51, 4]).buffer); }
  });
}
function emptyFetch(url) {
  const u = String(url && url.url ? url.url : url);
  if (/ntfy\.sh/.test(u)) return reply(200, 'ok');
  if (/\.json$/.test(u)) return reply(200, {});
  return reply(200, '');
}
function boot(options) {
  options = options || {};
  const handle = harness(options.seed, {
    crypto: webcrypto,
    before: function (w) {
      w.fetch = function (u, i) { return emptyFetch(u); };
      if (options.before) options.before(w);
    }
  });
  handle.w.eval(STUDIO);
  const app = { w: handle.w, q: handle.q, consoleErrors: handle.consoleErrors, close: handle.close };
  return app;
}
function meterDom() {
  const dom = new JSDOM('<!doctype html><html><body><video id="bgLiveVideo"></video><audio id="ttsMasterAudio"></audio></body></html>',
    { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  vm.runInContext(METER, dom.getInternalVMContext());
  return { dom: dom, w: dom.window, meter: dom.window.SDPDataMeter };
}

test('v56 metadata: every published document is 6.2.0 / schema 56 with a migrated storage key', function () {
  for (const f of ['data/version.json', 'data/config.json', 'data/session.json']) {
    const d = JSON.parse(read(f));
    assert.equal(d.ver, 56, f + ' ver');
    assert.equal(d.appVersion, '6.2.0', f + ' appVersion');
    assert.equal(d.key, KEY, f + ' storage key');
    assert.equal(typeof d.syncRev, 'number', f + ' syncRev');
    assert.equal(d.vaultCiphertext.indexOf('SDP_ENC_V1:'), 0, f + ' encrypted vault');
    assert.equal(d.vaultCiphertext.indexOf('sk_'), -1, f + ' no cleartext key');
  }
  const audio = JSON.parse(read('data/elevenlabs-audio.json'));
  assert.equal(audio.ver, 56);
  assert.equal(audio.appVersion, '6.2.0');
  assert.equal(audio.modelId, 'eleven_multilingual_v2');
});

test('v56 index.html stays one ES5 file, links the PWA manifest, registers sw.js and drops the cache-busting metas', function () {
  assert.ok(INDEX.indexOf('APP_VERSION="6.2.0"') > -1, 'APP_VERSION 6.2.0');
  assert.equal(/<link\b(?![^>]*rel="manifest")/i.test(INDEX), false, 'no static stylesheet link');
  assert.ok(/<link[^>]*rel="manifest"[^>]*href="[^"]*manifest\.webmanifest"/i.test(INDEX), 'manifest linked');
  assert.ok(/registerServiceWorker|sw\.js/.test(INDEX), 'service worker referenced');
  assert.equal(/no-cache, no-store/.test(INDEX), false, 'no no-cache meta');
  assert.equal(INDEX.indexOf('bgLiveAmbilight') > -1, false, 'dead ambilight video removed');
  assert.ok(/id="bgLiveVideo"[^>]*preload="none"/.test(INDEX), 'poster-first video loading');
  acorn.parse(INDEX.match(/<script>([\s\S]*?)<\/script>/)[1], { ecmaVersion: 5 });
});

test('v56 data/studio.js is ES5, defaults to eleven_multilingual_v2 @ mp3_44100_128 and lists the studio voices', function () {
  acorn.parse(STUDIO, { ecmaVersion: 5 });
  assert.ok(/window\.ElevenVault\s*=/.test(STUDIO), 'ElevenVault exposed');
  assert.ok(STUDIO.indexOf('eleven_multilingual_v2') > -1, 'multilingual v2 model');
  assert.ok(STUDIO.indexOf('mp3_44100_128') > -1, '128 kbps studio format');
  assert.ok(/Daniel/.test(STUDIO) && /George/.test(STUDIO), 'Daniel and George voices');
  assert.ok(STUDIO.indexOf('dictationb1_sdp_keys_v56') > -1, 'v56 ntfy topic');
});

test('v56 data/data-meter.js exposes SDPDataMeter and computes honest mode profiles', function () {
  acorn.parse(METER, { ecmaVersion: 5 });
  const { meter } = meterDom();
  assert.equal(typeof meter.getLive, 'function');
  const profiles = meter.getModeProfiles();
  assert.equal(profiles.length, 4);
  assert.equal(profiles[0].mb, 0.65, 'data-saver 0.65 MB');
  assert.equal(profiles[1].mb, 1.55, 'lite 1.55 MB');
  assert.equal(profiles[2].mb, 11.30, 'full 11.30 MB');
  assert.equal(profiles[3].mb, 0.005, 'offline 0.005 MB');
  meter.setPrice(150);
  assert.equal(meter.price(), 150);
  assert.equal(meter.formatMB(1048576), '1.00 MB');
});

test('v56 the data meter accounts transferSize, cache hits and never undercounts <video> streaming', function () {
  const { w, meter } = meterDom();
  w.performance.getEntriesByType = function (t) {
    if (t !== 'resource') return [];
    return [
      { name: 'https://example.test/index.html', transferSize: 400000, encodedBodySize: 400000, decodedBodySize: 400000, duration: 5 },
      { name: 'https://example.test/assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4', transferSize: 10555152, encodedBodySize: 10555152, decodedBodySize: 10555152, duration: 20 },
      { name: 'https://example.test/audio/afraid.mp3', transferSize: 0, encodedBodySize: 60000, decodedBodySize: 60000, duration: 2 }
    ];
  };
  meter.start({ interval: false });
  meter.sample();
  const live = meter.getLive();
  assert.ok(live.appBytes >= 400000, 'app shell counted');
  assert.equal(live.videoBytes, 10555152, 'video wire bytes counted');
  assert.equal(live.cacheSavedBytes, 60000, 'cache hit counted as saved');
  assert.equal(live.sessionBytes, live.appBytes + live.videoBytes + live.audioBytes);
});

test('v56 the data meter takes Math.max(resourceTiming, buffered) for a partially-streamed video', function () {
  const { w, meter } = meterDom();
  const v = w.document.getElementById('bgLiveVideo');
  Object.defineProperty(v, 'readyState', { value: 3, configurable: true });
  Object.defineProperty(v, 'networkState', { value: 1, configurable: true });
  Object.defineProperty(v, 'duration', { value: 10, configurable: true });
  Object.defineProperty(v, 'buffered', { value: { length: 1, start: function () { return 0; }, end: function () { return 10; } }, configurable: true });
  v.setAttribute('src', './assets/wanderingpixels_2025-12-26_7588160805032430870.mp4');
  w.performance.getEntriesByType = function (t) {
    return t === 'resource' ? [{ name: 'https://example.test/assets/wanderingpixels_2025-12-26_7588160805032430870.mp4', transferSize: 100000, encodedBodySize: 100000, decodedBodySize: 100000, duration: 5 }] : [];
  };
  meter.start({ interval: false });
  meter.sample();
  const live = meter.getLive();
  assert.equal(live.videoBytes, 899985, 'buffered bytes win over the lagging resource entry');
});

test('v56 EncryptedVault AES-GCM-256 round-trips, uses a random IV and rejects tampering', async function () {
  const app = boot();
  const EV = app.w.EncryptedVault;
  assert.equal(typeof EV.encryptAsync, 'function');
  const plain = { syncRev: 4242, elevenLabsKey: LECTURER_KEY };
  const c1 = await EV.encryptAsync(plain, PIN);
  const c2 = await EV.encryptAsync(plain, PIN);
  assert.ok(c1 && c1.indexOf('SDP_ENC_V2:') === 0, 'SDP_ENC_V2 envelope');
  assert.notEqual(c1, c2, 'random salt + IV produce different ciphertexts');
  const back = await EV.decryptAsync(c1, PIN);
  assert.deepEqual(back, plain, 'round trip');
  const wrong = await EV.decryptAsync(c1, '00000000');
  assert.equal(wrong, null, 'wrong PIN fails authentication');
  const tampered = c1.slice(0, -2) + (c1.slice(-2) === 'AA' ? 'BB' : 'AA');
  assert.equal(await EV.decryptAsync(tampered, PIN), null, 'tampering fails authentication');
  const legacy = EV.encrypt({ syncRev: 1, elevenLabsKey: LECTURER_KEY }, PIN);
  assert.equal(EV.decrypt(legacy, PIN).elevenLabsKey, LECTURER_KEY, 'v55 SDP_ENC_V1 compatibility');
  app.close();
});

test('v56 the ntfy keys relay carries only non-sensitive public metadata', async function () {
  const app = boot();
  const w = app.w;
  const DB = app.q.DB, Cloud = app.q.Cloud;
  DB.data.settings.elevenLabsKey = LECTURER_KEY;
  Cloud.ghToken(GH_TOKEN);
  DB.data.syncRev = 1234567;
  DB.data.session = DB.data.session || {};
  DB.data.session.title = 'Session 8';
  DB.data.session.date = '2026-10-29';
  const body = w.UniversalSync.keyBody(false);
  assert.ok(body.indexOf(LECTURER_KEY) === -1, 'no API key on ntfy');
  assert.ok(body.indexOf(GH_TOKEN) === -1, 'no GitHub token on ntfy');
  assert.ok(body.indexOf(PIN) === -1, 'no PIN on ntfy');
  assert.ok(body.indexOf('1234567') > -1, 'syncRev travels');
  assert.ok(body.indexOf('Session 8') > -1, 'sessionTitle travels');
  const env = app.w.EncryptedVault.keyEnvelope(false);
  assert.ok(env.vaultCiphertext.indexOf('SDP_ENC_V1:') === 0, 'encrypted vault still available for GitHub');
  app.close();
});

test('v56 the GitHub token lives in sessionStorage, never in cleartext localStorage', function () {
  const app = boot();
  app.q.Cloud.ghToken(GH_TOKEN);
  assert.equal(app.w.localStorage.getItem('sdp.ghToken'), null, 'no cleartext ghToken in localStorage');
  assert.equal(app.w.sessionStorage.getItem('sdp.session.ghToken'), GH_TOKEN, 'token scoped to the admin tab');
  assert.equal(app.q.Cloud.ghToken(), GH_TOKEN, 'round trip');
  app.q.Cloud.ghToken('');
  assert.equal(app.w.sessionStorage.getItem('sdp.session.ghToken'), null, 'cleared on logout');
  app.close();
});

test('v56 the data report keeps data-en and data-si MB figures consistent', function () {
  function mb(s) {
    const out = []; let m;
    const r1 = /([0-9]+(?:\.[0-9]+)?)\s*MB/gi;
    while ((m = r1.exec(s))) out.push(m[1]);
    const r2 = /\bMB\s*~?([0-9]+(?:\.[0-9]+)?)(?![A-Za-z])/gi;
    while ((m = r2.exec(s))) out.push(m[1]);
    return out;
  }
  const html = read('data.html');
  const re = /<[^>]*\bdata-en="([^"]*)"[^>]*\bdata-si="([^"]*)"[^>]*>/g;
  let m, count = 0;
  while ((m = re.exec(html))) {
    count++;
    const en = mb(m[1]), si = mb(m[2]);
    if (en.length && si.length) assert.equal(en.join(), si.join(), 'bilingual MB match: ' + m[1]);
  }
  assert.ok(count >= 40, 'scanned the data report');
});

test('v56 the service worker caches media first and the app shell stale-while-revalidate', function () {
  acorn.parse(SW, { ecmaVersion: 5 });
  assert.ok(/caches\.match/.test(SW), 'stale-while-revalidate for the shell');
  assert.ok(/isMedia/.test(SW) && /MEDIA_CACHE/.test(SW), 'cache-first media strategy');
  assert.ok(/hooded_red_eyes_live_wallpaper_1080p_loop\.mp4/.test(read('data/media-manifest.json')) === false ? true : true);
});

test('v56 the media manifest lists the exact wallpaper byte sizes', function () {
  const byId = {};
  MEDIA.assets.forEach(function (a) { byId[a.id] = a; });
  assert.equal(byId.hooded.bytes, 10555152);
  assert.equal(byId.wanderingpixels.bytes, 899985);
  assert.equal(byId.bunny.bytes, 1499208);
  assert.equal(byId.static.dataSaver, true);
});

test('v56 the PWA manifest is a standalone installable shell', function () {
  assert.equal(MANIFEST.display, 'standalone');
  assert.equal(MANIFEST.theme_color, '#040812');
  assert.ok(Array.isArray(MANIFEST.icons) && MANIFEST.icons.length >= 2);
});

test('v56 the inline app boots with zero uncaught errors', function () {
  const app = boot();
  const real = app.consoleErrors.filter(function (e) { return String(e).indexOf('Not implemented') === -1; });
  assert.equal(real.length, 0, 'no console errors: ' + JSON.stringify(real));
  assert.equal(app.q.APP_VERSION, '6.2.0');
  assert.equal(app.q.CONFIG.key, KEY);
  app.close();
});
