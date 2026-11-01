'use strict';
/* v59 / 8.0.0 regression gate. Test PINs and token prefixes are constructed at
 * runtime; no shipped/default PIN or live-looking token literal is committed. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const acorn = require('acorn');
const { harness } = require('./app-harness.cjs');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const INDEX = read('index.html');
const CORE = fs.existsSync(path.join(ROOT,'data/app-core.js'))?read('data/app-core.js'):'';
const APP_SRC=INDEX+'\n'+CORE;
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

test('v59 metadata, ES5 single-file budget and identical transparency routes', () => {
  for (const f of ['data/config.json', 'data/session.json', 'data/version.json', 'data/elevenlabs-audio.json', 'data/media-manifest.json']) {
    const d = JSON.parse(read(f)); assert.equal(d.ver, 61, f); assert.equal(d.appVersion, '9.0.1.0', f);
    assert.ok(!d.adminPin && !d.vaultCiphertext, f + ' has no public PIN/vault');
  }
  assert.ok(APP_SRC.includes('APP_VERSION="9.0.1.0"'));
  assert.ok(Buffer.byteLength(INDEX) <= 110000);
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


test('service worker v59 slices cached full video responses into HTTP 206 ranges', async () => {
  const src = read('sw.js');
  assert.ok(src.includes("VERSION = 'sdp-v61-9.0.1.0'"));
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

/* ---------------- v58 / 7.0.0 additions ---------------- */
test('v58 meter: durable buffer high-water mark is preserved', () => {
  const env = freshMeter();
  env.w.localStorage.setItem('sdp.mediaManifest.v1', read('data/media-manifest.json'));
  const v = env.w.document.getElementById('bgLiveVideo');
  v.src = './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';
  let bufEnd = 40;
  Object.defineProperties(v, { readyState: { value: 4, configurable: true }, networkState: { value: 1, configurable: true }, duration: { value: 100, configurable: true }, buffered: { configurable: true, value: { length: 1, start: () => 0, end: () => bufEnd } } });
  env.m.start({ interval: false });
  const first = env.m.videoBufferedBytes();
  assert.equal(first, Math.round(10555152 * 0.4));
  bufEnd = 10;
  env.m.sample();
  assert.ok(env.m.getLive().videoBytes >= first, 'videoBytes keeps the buffered high-water');
  env.m.stop();
  const stored = JSON.parse(env.w.localStorage.getItem(env.m.STORAGE.buffer) || '{}');
  assert.ok(Object.keys(stored).some(k => stored[k] >= first), 'high-water mark persisted');
  env.dom.window.close();
});

test('v58 meter: five LKR plans, setPlan/getPlan and ≈-formatted LKR', () => {
  const env = freshMeter(); const m = env.m; m.start({ interval: false });
  const plans = m.getPlans();
  assert.deepEqual(Array.from(plans, p => p.lkr), [49, 99, 150, 220, 0]);
  assert.deepEqual(Array.from(plans, p => p.id), ['student-lite', 'study', 'family', 'classroom', 'custom']);
  m.setPlan('study');
  assert.equal(m.getPlanId(), 'study');
  assert.equal(m.price(), 99);
  assert.equal(m.getPlanLabel(), 'Study Pack · LKR 99.00/GB');
  assert.ok(/Study Pack — LKR 99\.00\/GB/.test(m.getPlan().chip));
  const live = m.getLive();
  assert.equal(live.planId, 'study');
  assert.ok(/Study Pack/.test(live.planLabel));
  assert.match(String(live.cacheSavedLkr), /^≈/);
  assert.match(String(live.estimatedTodayLkr), /^≈/);
  assert.equal(m.toLKR(1e9), 99);
  assert.equal(m.formatLKR(0.5), '≈K 0.50');
  assert.match(m.formatLKR(1e12), /L/);
  m.setPlan('student-lite');
  assert.equal(m.toLKR(1e9), 49);
  m.setPrice(149.9); m.setPlan('custom');
  assert.equal(m.price(), 149.9);
  assert.ok(/Custom · LKR 149\.90\/GB/.test(m.getPlanLabel()));
  env.dom.window.close();
});

test('v58 meter: cached audio counts as savings only; estimates are labelled ≈', () => {
  const env = freshMeter(); const m = env.m; m.start({ interval: false });
  const before = m.getLive();
  m.recordAudioPlay('https://dict.youdao.com/dictvoice?type=1&audio=brave', true);
  const afterHit = m.getLive();
  assert.equal(afterHit.audioBytes, before.audioBytes, 'cache hit never raises audioBytes');
  assert.equal(afterHit.sessionBytes, before.sessionBytes, 'cache hit never raises session totals');
  assert.equal(afterHit.cacheSavedBytes, before.cacheSavedBytes + 11000, 'cache hit raises savings');
  m.recordAudioPlay('https://dict.youdao.com/dictvoice?type=1&audio=brave2', false);
  const afterNet = m.getLive();
  assert.equal(afterNet.audioBytes, before.audioBytes + 11000, 'network play still measures audio');
  assert.match(afterNet.audioLabel, /≈/);
  m.trackFetch('https://example.test/slow.mp4', 5000, 'video');
  assert.ok(m.getLive().videoBytes >= 5000);
  env.dom.window.close();
});

test('v58 meter: daily buckets prune to the newest 30 days', () => {
  const env = freshMeter(); const m = env.m;
  const stored = {};
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    stored[d.toISOString().slice(0, 10)] = 1000;
  }
  env.w.localStorage.setItem(m.STORAGE.daily, JSON.stringify(stored));
  env.w.localStorage.setItem(m.STORAGE.allTime, '40000');
  m.start({ interval: false });
  m.addBytes('app', 500);
  m.stop();
  const after = JSON.parse(env.w.localStorage.getItem(m.STORAGE.daily));
  assert.equal(Object.keys(after).length, 30, 'newest 30 daily buckets kept');
  assert.equal(Number(env.w.localStorage.getItem(m.STORAGE.allTime)), 40500, 'all-time survives pruning');
  env.dom.window.close();
});

test('v58 learning-tools: ES5, SDPLearning API and weak-word streak graduation', () => {
  const src = read('data/learning-tools.js');
  acorn.parse(src, { ecmaVersion: 5 });
  const app = harness(null, {});
  const w = app.w;
  try {
    w.eval(src);
    const L = w.SDPLearning;
    assert.ok(L, 'window.SDPLearning exposed');
    for (const api of ['levenshteinOps', 'diffFeedback', 'markMissed', 'markCorrect', 'getWeakWords', 'renderPaperSelfCheck', 'printStudySheet', 'startSyllableSpotlight', 'recordAndCompare', 'downloadOfflinePack', 'renderMistakeCoach', 'openWeakWords', 'drillWeakWords']) {
      assert.equal(typeof L[api], 'function', api);
    }
    const ops = L.levenshteinOps('brave', 'brav');
    assert.equal(ops.length, 1);
    assert.ok(['insert', 'delete', 'replace'].indexOf(ops[0].op) >= 0, ops[0].op);
    const fb = L.diffFeedback('confident', 'confidnt');
    assert.ok(/letters off|Almost/.test(fb), fb);
    L.markMissed('embarrassing');
    L.markMissed('embarrassing');
    let weak = L.getWeakWords();
    assert.equal(weak.length, 1);
    assert.equal(weak[0].count, 2);
    assert.equal(weak[0].streak, 0);
    assert.equal(L.markCorrect('embarrassing'), false);
    assert.equal(L.markCorrect('embarrassing'), false);
    assert.equal(L.markCorrect('embarrassing'), true, '3rd consecutive correct graduates');
    weak = L.getWeakWords();
    assert.equal(weak.length, 0, 'graduated out of the weak bank');
    const mastered = JSON.parse(w.localStorage.getItem('sdp.masteredWords.v1'));
    assert.ok(mastered.embarrassing, 'mastered bank keeps the word');
    assert.equal(L.syllablesOf('confident').join(''), 'confident');
  } finally {
    try { w.close(); } catch (e) {}
  }
});

test('v59 learning-tools: SDPPerfGuard decides lite from slow frames and memoises it', () => {
  const src = read('data/learning-tools.js');
  const app = harness(null, {});
  const w = app.w;
  try {
    w.eval(src);
    const PG = w.SDPPerfGuard;
    assert.ok(PG, 'window.SDPPerfGuard exposed');
    assert.equal(typeof PG.start, 'function');
    assert.equal(typeof PG.benchmark, 'function');
    assert.equal(typeof PG.decide, 'function');
    /* a 16.7ms frame budget is healthy */
    const fast = PG.decide({ avg: 16.666, med: 16.7, slow3: 0 });
    assert.equal(fast.lite, false, '60fps frames never downgrade');
    assert.equal(w.document.body.getAttribute('data-perf'), 'auto');
    /* simulated 30ms/frame rAF: avg > 22 && med > 25 && slow3 > 32 */
    const slow = PG.decide({ avg: 30, med: 30, slow3: 100 });
    assert.equal(slow.lite, true, 'slow frames downgrade to lite');
    assert.equal(w.document.body.getAttribute('data-perf'), 'lite', 'body data-perf=lite');
    assert.equal(w.document.documentElement.getAttribute('data-perf'), 'lite');
    const memo = JSON.parse(w.localStorage.getItem('sdp.perfGuard.v1'));
    assert.equal(memo.mode, 'lite');
    /* benchmark() accepts an injected sampler so no browser frame loop is needed */
    PG.sampler = [16, 16, 17, 16, 16];
    const r = PG.benchmark(function () {});
    assert.equal(r.frames, 5);
    assert.ok(r.avg < 22 && r.med <= 17);
    PG.sampler = null;
  } finally { app.close(); }
});

test('v59: zero canvas readback and pure-arithmetic WCAG contrast gauge', () => {
  const src = read('data/learning-tools.js');
  assert.ok(!/\.drawImage\s*\(/.test(src), 'no drawImage call');
  assert.ok(!/\.getImageData\s*\(/.test(src), 'no getImageData call');
  assert.ok(!/_gaugeCanvas/.test(src), 'the readback canvas is gone');
  const app = harness(null, {});
  const w = app.w;
  try {
    w.eval(src);
    const L = w.SDPLearning;
    const g = L.contrastRatio();
    assert.ok(g && g.ratio > 1, 'contrast ratio computed: ' + (g && g.ratio));
    assert.equal(L.sampleVideo(), null, 'no video sampling');
    assert.equal(typeof L.wallpaperLuminance(), 'number');
  } finally { app.close(); }
});

test('v59 paper self-check renders every word row and updates #v58SelfScore and #resSummary', () => {
  const src = read('data/learning-tools.js');
  const session = JSON.parse(read('data/session.json'));
  const rows = session.words.map(x => ({ word: x.w, answer: '', state: 'unknown', w: x }));
  const app = harness(null, {});
  const w = app.w;
  try {
    const summaryNode=w.document.createElement('p');summaryNode.id='resSummary';summaryNode.textContent='Well done! That is the end of the dictation.';w.document.body.appendChild(summaryNode);const host=w.document.createElement('div');host.id='host';w.document.body.appendChild(host);
    w.eval(src);
    const L = w.SDPLearning;
    const result = { mode: 'paper', rows: rows, correct: 0, half: 0, total: rows.length };
    const box = L.renderPaperSelfCheck(result, w.document.getElementById('host'));
    assert.ok(box, 'self-check rendered');
    assert.equal(w.document.querySelectorAll('#selfCheck .selfrow').length, 30, 'all 30 rows');
    assert.equal(w.document.getElementById('v58SelfScore').textContent, '0 / 30 · 0%');
    const buttons = w.document.querySelectorAll('#selfCheck .selfbtns button');
    assert.equal(buttons.length, 60, 'each row offers Got It and Missed It');
    buttons[0].click();      /* row 1 got it */
    buttons[2].click();      /* row 2 got it */
    buttons[5].click();      /* row 3 missed it */
    assert.equal(w.document.getElementById('v58SelfScore').textContent, '2 / 30 · 7%');
    const summary = w.document.getElementById('resSummary').textContent;
    assert.match(summary, /self-check: 2\/30 \(7%\)/, summary);
    assert.ok(/Well done/.test(summary), 'the original summary text is preserved');
    const weak = JSON.parse(w.localStorage.getItem('sdp.weakWords.v1') || '{}');
    assert.ok(weak[session.words[2].w.split('/')[0]], 'a missed word feeds the weak bank');
  } finally { app.close(); }
});

test('v59 dictionary card source contains the full English word content', () => {
  const src = read('data/learning-tools.js');
  for (const marker of ['sdp-word-card', 'sdp-word-ipa', 'sdp-word-pos', 'sdp-word-def', 'sdp-word-ex', 'sdp-si-chip', 'sdpWordFilterRow', 'data-filter']) {
    assert.ok(src.includes(marker), marker);
  }
  const session = JSON.parse(read('data/session.json'));
  const first = session.words[0];
  assert.equal(first.w, 'afraid');
  assert.equal(first.p, 'əˈfreɪd');
  assert.equal(first.pos, 'adj.');
  assert.ok(/Feeling fear or anxiety/.test(first.m), 'full English meaning ships');
  assert.ok(/She was never afraid/.test(first.s), 'example sentence ships');
});

test('v59 Sentence Context exposes a primary Next question button', () => {
  const src = read('data/learning-tools.js');
  assert.ok(/sdpContextNextBtn/.test(src));
  assert.ok(/Next question/.test(src));
  assert.ok(/sdp-context-ok/.test(src), 'green Correct! confirmation');
  assert.ok(/advanceContext/.test(src));
});

test('v59 Eng.writeSecs honours the lecturer writing timer (writeFixed)', () => {
  const app = harness(null, { crypto: true });
  try {
    app.q.DB.data.settings.writeFixed = 7;
    assert.equal(app.q.Eng.writeSecs(), 7);
    app.q.DB.data.settings.writeFixed = 12;
    assert.equal(app.q.Eng.writeSecs(), 12);
    app.q.DB.data.settings.writeFixed = 0;
    assert.equal(app.q.Eng.writeSecs(), 5, 'falls back to 5 when unset');
  } finally { app.close(); }
});

test('v59 default performance is automatic and a manual choice is remembered', () => {
  const app = harness(null, { crypto: true });
  try {
    assert.equal(app.q.DB.data.settings.perf, 'auto', 'fresh installs are automatic');
    app.q.UI.setPerf('full');
    assert.equal(app.q.DB.data.settings.perfChosenBy, 'user', 'a manual click is a user choice');
    assert.equal(app.q.DB.data.settings.perf, 'full');
  } finally { app.close(); }
});

test('v58 fonts: Noto Sans Sinhala WOFF2 files ship under 60KB each', () => {
  for (const f of ['assets/fonts/NotoSansSinhala-Regular.woff2', 'assets/fonts/NotoSansSinhala-Bold.woff2']) {
    const buf = fs.readFileSync(path.join(ROOT, f));
    assert.ok(buf.length <= 60000, f + ' <= 60KB');
    assert.equal(buf.slice(0, 4).toString('utf8'), 'wOF2', f + ' is WOFF2');
  }
  assert.ok(INDEX.includes('NotoSansSinhala-Regular.woff2') && INDEX.includes('NotoSansSinhala-Bold.woff2'));
  assert.ok(!/<link[^>]*fonts/i.test(INDEX), 'no static font link tags');
});

test('v61 single mount exposes the extracted engine, all six tools and honest audio states',()=>{const app=harness(null,{learning:true});try{assert.equal(app.w.document.body.getAttribute('data-v61-ready'),'1');assert.ok(app.w.SDPCore.Eng);assert.ok(app.w.SDPLearning);assert.ok(app.w.document.getElementById('guideSheet'));assert.ok(learnMarkers());}finally{app.close();}function learnMarkers(){return ['Flashcards','4-Choice Quiz','Sentence Gap','Weak Words Drill','Speak & Compare','Audio List'].every(x=>read('data/learning-tools.js').includes(x));}});
test('v61 Speech.say accepts whole-string input without spelling letters',()=>{const app=harness(null,{});try{let captured=[];app.q.Speech._speakInternal=function(text){captured.push(text);};app.q.Speech.say('hello',{},function(){});assert.deepEqual(captured,['hello']);}finally{app.close();}});
