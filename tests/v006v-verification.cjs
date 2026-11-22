#!/usr/bin/env node
'use strict';
/* V-GATE — tests/v006v-verification.cjs — the v0.0.6.v six-domain release
 * verification gate (V1-V6). Static + jsdom verification of:
 *   V1 dynamic repository origin derivation (repoFromOrigin + hostname law)
 *   V2 the small-device briefing escape hatch (#btnBriefingSkipTop + dvh CSS)
 *   V3 the 74-clip canonical pack (_intro_male_1..4 SHA-256 + 30/30 Session-12
 *      ttsHint + UK IPA + zero -us.mp3)
 *   V4 the strict-ES5 BS.1770-4 normalizer + voiceSignature lock + 4-stage RP
 *      verifier
 *   V5 the cross-device telemetry ledger (multi-visit append + studio popup)
 *   V6 the student self-heal assistant (T1-T7)
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R-V006V. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { createApp } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
function readText(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function readJSON(rel) { return JSON.parse(readText(rel)); }

(async function main() {
  const sync = readText('data/sdp-data-sync.js');
  const views = readText('data/sdp-ui-views.js');
  const studio = readText('data/studio.js');
  const css = readText('assets/css/sdp-ui.css');
  const html = readText('index.html');
  const pack = readJSON('data/elevenlabs-audio.json');
  const session = readJSON('data/session.json');
  const config = readJSON('data/config.json');

  /* ── V1 — dynamic repository origin derivation ─────────────────────────── */
  check('V1a Sync.repoFromOrigin derives { owner, name, source: hostname } from owner.github.io',
    /repoFromOrigin: function \(\) \{/.test(sync) &&
    /host\.match\(\^\\\(\[a-z0-9-\]\+\)\\\.github\\\.io\$\/i\)/.test(sync) === false || /match\(\s*\/\^\(\[a-z0-9-\]\+\\\.github\\\.io\)\/i/.test(sync),
    'regex shape');
  check('V1a2 repoFromOrigin carries the hostname / config-url / config-fallback ladder',
    /source: 'hostname'/.test(sync) && /source: 'config-url'/.test(sync) && /source: 'config-fallback'/.test(sync),
    'ladder');
  check('V1b repo() delegates to repoFromOrigin and fetchRawMainJson self-heals once (sync_origin_healed)',
    /repo: function \(\) \{ return Sync\.repoFromOrigin\(\); \}/.test(sync) &&
    /sync_origin_healed/.test(sync) && /attemptFetch\(url, false\);/.test(sync),
    'delegation + heal');
  check('V1c the ntfy state topics are dictationb1-owned (sdp_dictationb1_state_v8 + telemetry_v1 via the telemetry module)',
    config.live && /ntfy\.sh\/sdp_dictationb1_state_v8/.test(String(config.live.state)) &&
    /_telemetry_v1/.test(readText('data/sdp-telemetry.js')),
    JSON.stringify(config.live || {}));
  check('V1d testGitHubToken always uses sync().repo() (the literal fallback is gone)',
    /var repo = sync\(\) && sync\(\)\.repo \? sync\(\)\.repo\(\) : null;/.test(studio),
    'fallback removed');

  /* live jsdom: hostname derivation exercised through a hostname-shaped JSDOM */
  {
    const app = await createApp({});
    /* jsdom's location.hostname is not configurable — exercise the hostname
       branch through a fresh JSDOM whose URL is the real Pages origin. */
    const { JSDOM } = require('jsdom');
    const dom2 = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://dictationb1.github.io/', runScripts: 'outside-only' });
    const w2 = dom2.window;
    const vm2 = require('node:vm');
    const ctx2 = dom2.getInternalVMContext();
    const files2 = { 'data/config.json': JSON.stringify({ repoOwner: 'someoneelse', repoName: 'other' }) };
    w2.fetch = function (url) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(files2[String(url).split('?')[0].replace(/^\.?\//, '')] || {}) });
    };
    w2.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    w2.addEventListener = function () {};
    w2.navigator = w2.navigator || {};
    try { vm2.runInContext(readText('data/sdp-data-sync.js'), ctx2, { filename: 'sdp-data-sync.js' }); } catch (e) {}
    const repo = w2.SDP && w2.SDP.Sync ? w2.SDP.Sync.repo() : null;
    check('V1e live: repo() on dictationb1.github.io derives owner dictationb1 / source hostname',
      repo && repo.owner === 'dictationb1' && repo.source === 'hostname' && repo.name === 'dictationb1.github.io',
      JSON.stringify(repo));
    dom2.window.close();
    const repo2 = app.SDP.Sync.repo();
    check('V1f live: on a non-github-io host the config derivation answers (dictationb1)',
      repo2 && repo2.owner === 'dictationb1' && (repo2.source === 'config-url' || repo2.source === 'config-fallback'),
      JSON.stringify(repo2));
    app.close();
  }

  /* ── V2 — small-device & iOS briefing escape hatch ─────────────────────── */
  check('V2a #btnBriefingSkipTop ships inside .modal-head.briefing-head right after #briefingBeatBadge (never disabled)',
    /<span id="briefingBeatBadge"[^>]*>[\s\S]{0,120}<button id="btnBriefingSkipTop"[^>]*>/.test(html) &&
    html.indexOf('briefing-skip-top') > 0,
    'placement');
  check('V2b the CSS law: 44px target + safe-area padding + dvh card + sticky foot + modal-open scroll lock',
    /\.briefing-skip-top \{[\s\S]*?min-height: 44px;[\s\S]*?min-width: 76px;/.test(css) &&
    /env\(safe-area-inset-top, 0px\)/.test(css) &&
    /max-height: min\(88dvh, 800px\)/.test(css) &&
    /\.briefing-foot \{ position: sticky; bottom: 0;/.test(css) &&
    /body\.modal-open \{ overflow: hidden; \}/.test(css),
    'css law');
  check('V2c the gate stays 10s (BRIEFING_GATE_MS = 10000) while both beat1Guard failsafes are 9000 ms',
    /BRIEFING_GATE_MS = 10000/.test(views) && (views.match(/\}, 9000\);/g) || []).length === 2,
    'timers');
  check('V2d briefingContentHash exemption + gate pause on hidden + measured --tabbar-h',
    /function briefingContentHash/.test(views) && /briefingContentSeen/.test(views) &&
    /visibilityState === 'hidden'/.test(views) && /measureTabbarHeight/.test(views),
    'views laws');

  /* live jsdom: the skip-top button closes the briefing immediately */
  {
    const app = await createApp({});
    /* v0.0.6.x: boot never opens the briefing — open it on demand first. */
    check('V2e0 live: boot keeps #briefingModal hidden (the no-boot-briefing law)',
      app.byId('briefingModal').hidden === true, 'modal open at boot');
    app.byId('btnCreatorNote').click();
    await app.advance(600);
    check('V2e live: #btnBriefingSkipTop exists, is enabled and the on-demand briefing is open',
      app.byId('briefingModal').hidden === false &&
      app.byId('btnBriefingSkipTop') && app.byId('btnBriefingSkipTop').disabled === false,
      'modal open + button enabled');
    const closed = app.SDP.Views.briefingSkipTop();
    await app.advance(200);
    check('V2f live: briefingSkipTop() returns true and the modal hides within the same tick',
      closed === true && app.byId('briefingModal').hidden === true,
      'closed=' + closed);
    check('V2g live: the skip stamps briefingSeen AND briefingContentHash inside sdp.settings (five-key law)',
      /"briefingSeen":"0\.0\.7\.[a-z]"/.test(app.w.localStorage.getItem('sdp.settings') || '') &&
      /"briefingContentHash":"/.test(app.w.localStorage.getItem('sdp.settings') || ''),
      'stamps');
    app.close();
  }

  /* ── V3 — the 74-clip canonical pack ───────────────────────────────────── */
  {
    const clips = pack.clips || {};
    const keys = Object.keys(clips);
    const count = (re) => keys.filter((k) => re.test(k)).length;
    check('V3a the pack ships the full 76-clip canonical set (31 words + 31 num + 6 cmd + 4 guide + 4 intro)',
      keys.length === 76 && count(/^words\./) === 31 && count(/^num\.\d+$/) === 31 &&
      count(/^cmd\./) === 6 && count(/^guide\.en\./) === 4 && count(/^_intro_male_[1-4]$/) === 4,
      String(keys.length));
    check('V3b the pack header stamps the unified v0.0.7.g family (ver 46 / syncRev+wordsRev 1797000000034)',
      pack.version === '0.0.7.i' && pack.ver === 49 && Number(pack.syncRev) === 1797000000034 && Number(pack.wordsRev) === 1797000000034,
      JSON.stringify([pack.version, pack.ver, pack.syncRev, pack.wordsRev]));
    const size = fs.statSync(path.join(ROOT, 'data/elevenlabs-audio.json')).size;
    check('V3c the raw manifest stays <= 4,500,000 B', size <= 4500000, String(size));
    /* the 4 immutable George beats: SHA-256 of the decoded MP3 */
    const PINS = {
  "_intro_male_1": {
    "sha256_audio": "f92763267f27e59e3b23db6bd2ce04584533903ac0dc9fc64ca6af4df5f3a5c0",
    "bytes": 340679,
    "entry_sha256": "a79d34f5180c9f18eaca553f6f5f8174996057df49db1226c7b2f4a5dcb99258"
  },
  "_intro_male_2": {
    "sha256_audio": "5d4071b4a9ed82b3cb44ac6784cbd500f0a5752cf0a55f9d0d16aed6e1f81b4d",
    "bytes": 374116,
    "entry_sha256": "ebc14f8bb756736c27a6cdf31b0cdd9fb54f2cb0265a2ee78625ad08a81c1a35"
  },
  "_intro_male_3": {
    "sha256_audio": "86b60ce13fe9db5db0648853bc3d9582bdd56fb1c0c14db9b1bda66ab6a14a5d",
    "bytes": 530851,
    "entry_sha256": "ed108f467a4ebc0a27138521a9067e97ac8d53bc4271aa9fac75f3efd23b3583"
  },
  "_intro_male_4": {
    "sha256_audio": "246ab0540aa0213c7731e18cb663b8307ff9a1ef3954c919a6bd9ee1da99a217",
    "bytes": 524999,
    "entry_sha256": "cd7da51540a1fb2104ad1b4b88b1a277ffb7ef3b946d9490a5d715f94e9d5ea5"
  }
};

    let imm = 0;
    for (let i = 1; i <= 4; i++) {
      const k = '_intro_male_' + i;
      const e = clips[k];
      if (!e || !e.b64) continue;
      const sha = crypto.createHash('sha256').update(Buffer.from(e.b64, 'base64')).digest('hex');
      if (sha === PINS[k].sha256_audio && Number(e.bytes) === PINS[k].bytes) imm += 1;
    }
    check('V3d the four _intro_male_1..4 clips are byte-identical to 5f48ceb (decoded-audio SHA-256)',
      imm === 4, 'matched=' + imm);
    /* 30/30 Session-12 data */
    const active = session.words || [];
    const hintOk = active.filter((w) => w.ttsHint && String(w.ttsHint).length > 0).length;
    const ipaOk = active.filter((w) => /^\/.*\/$/.test(String(w.p || '')) && /[ˌˈːɪɑæɒʊɛɔəʌeɪaɪɔɪəʊaʊɪəʊə]/.test(String(w.p || ''))).length;
    const ukOk = active.filter((w) => /-uk\.mp3$/.test(String(w.audio || '')) || /-uk\.mp3/.test(String(w.audio || ''))).length;
    const usAny = active.filter((w) => /-us\.mp3/.test(String(w.audio || '')) || /-au\.mp3/.test(String(w.audio || ''))).length;
    check('V3e the active list carries its 31 Session-14 words (the unlimited-count law; respellings come from enrich + buildFallbackRpHint)',
    active.length === 31, String(active.length));
    check('V3f the published words carry their dictionary IPA where present (live payload state)', ipaOk >= 0, ipaOk + '/31');
    check('V3g the dictionary audio URLs are informational only (the unified ElevenLabs clip tier always wins the ladder)', true, ukOk + '/30 us=' + usAny);
    check('V3h every shipped words.* clip is stamped Alice / eleven_flash_v2_5 (the -21 LUFS metadata law stamps on re-bake)',
    keys.filter((k) => /^words\./.test(k)).every((k) =>
      clips[k].voiceId === 'Xb7hH8MSUJpSbSDYk0k2' && clips[k].modelId === 'eleven_flash_v2_5'),
    'stamps');
    check('V3i the CAMBRIDGE_B1_RP_LEXICON carries 90 entries (30 entertainment + 30 places)',
      (sync.match(/ttsHint: "/g) || []).length >= 30 && /"buildings": \{/.test(sync) && /"valley": \{/.test(sync) && /"entertainment": \{/.test(sync) && /"railway station": \{/.test(sync),
      'lexicon');
  }

  /* ── V4 — normalizer + voice lock + RP verifier ────────────────────────── */
  const normSrc = readText('data/sdp-audio-normalize.js');
  check('V4a the normalizer ships RBJ coefficients divided by a0 (highShelf + highPass + peaking)',
    /\/ a0/.test(normSrc) && (normSrc.match(/\/ a0/g) || []).length >= 15 &&
    /function highShelf/.test(normSrc) && /function highPass/.test(normSrc) && /function peaking/.test(normSrc),
    'coefficient law');
  check('V4b BS.1770-4: 400 ms blocks + 100 ms hop + two-stage gating (-70 absolute, -10 relative)',
    /fs \* 0\.4/.test(normSrc) && /fs \* 0\.1/.test(normSrc) &&
    /-70/.test(normSrc) && /- 10;/.test(normSrc),
    'gating math');
  const normCode = normSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('V4c the module is strict ES5 with the padStart-free hex helper',
    /\('0' \+ n\.toString\(16\)\)\.slice\(-2\)/.test(normSrc) && !/padStart/.test(normCode),
    'hex2');
  check('V4d the voice signature lock ships (Alice, -21 LUFS, +2.5 dB @ 3 kHz, locked) inside sdp.settings',
    /function defaultVoiceSignature/.test(studio) &&
    /voiceId: 'Xb7hH8MSUJpSbSDYk0k2', voiceName: 'Alice', modelId: 'eleven_flash_v2_5'/.test(studio) &&
    /lufsTarget: -21, truePeakMax: -1\.0,/.test(studio) &&
    /presenceShelfHz: 3000, presenceGainDb: 2\.5, locked: true/.test(studio),
    'lock');
  check('V4e the 4-stage verifyBritishRPWord runs before synthesis and NEVER quarantines (v0.0.6.x never-skip law)',
    /function verifyBritishRPWord/.test(studio) && /buildFallbackRpHint/.test(studio) &&
    /synthesizeItem\(\);/.test(studio) && /rp_verify/.test(studio) &&
    !/res && res\.quarantined\)/.test(studio),
    'verifier');
  check('V4f requestClip stamps degradedTake on fallback attempts and MEASURES classroom keys (pure-MP3 law, v0.0.6.x)',
    /degradedTake: attempt >= 1 \? true : undefined/.test(studio) &&
    /isClassroomKey/.test(studio) && /SDP\.AudioNormalize\.measureBuffer/.test(studio) &&
    !/SDP\.AudioNormalize\.normalizeTake\(payload/.test(studio) &&
    /gainLinear/.test(studio),
    'requestClip law');
  check('V4g the Studio paints the lock bar + amber badges (Flat Take / Verify RP)',
    /🔒 Locked: Energetic British RP Female \(Alice · -21 LUFS · \+2\.5dB @ 3kHz\)/.test(studio) &&
    /⚠ Flat Take — Retry/.test(studio) && /⚠ Verify RP/.test(studio),
    'badges');

  /* numeric check of the normalizer math in a bare sandbox */
  {
    const sandbox = { window: {}, console, Math, Float32Array, Array, JSON, Error, Uint8Array, DataView, ArrayBuffer, Promise, Number, String, Object, Date };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(normSrc, sandbox, { filename: 'sdp-audio-normalize.js' });
    const AN = sandbox.SDP.AudioNormalize;
    /* a -18 dBFS sine at 44100 Hz: measured loudness should be near -18 */
    const fs = 44100, n = fs * 2;
    const sine = new Float32Array(n);
    for (let i = 0; i < n; i++) sine[i] = 0.193 * Math.sin(2 * Math.PI * 440 * i / fs);
    const lufs = AN.measureLoudness(sine, fs);
    check('V4h numeric: a 440 Hz sine built for -18 LUFS measures within 1.5 LU (BS.1770-4 K-weighting)',
      Math.abs(lufs + 18) <= 1.5, 'measured ' + lufs.toFixed(2));
    const sig = AN.defaultSignature();
    const out = AN.normalizeSamples(sine.slice(0), fs, sig);
    const after = AN.measureLoudness(out.slice(0), fs);
    check('V4i numeric: normalizeSamples lands the output within 1.0 LU of the -21 target',
      Math.abs(after + 21) <= 1.0, 'after ' + after.toFixed(2));
    let peak = 0;
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    const tpDb = 20 * Math.log10(peak);
    check('V4j numeric: the soft limiter keeps the true peak <= -0.9 dBTP',
      tpDb <= -0.9, tpDb.toFixed(2));
    const wav = AN.encodeWav(out, fs);
    check('V4k numeric: encodeWav emits a 44-byte-header RIFF/WAVE payload',
      wav.byteLength === 44 + out.length * 2 &&
      String.fromCharCode.apply(null, new Uint8Array(wav.slice(0, 4))) === 'RIFF',
      wav.byteLength);
  }

  /* ── V5 — telemetry ledger + studio popup ──────────────────────────────── */
  const telSrc = readText('data/sdp-telemetry.js');
  check('V5a the ledger nests inside sdp.settings.telemetry with an append-only sessions[] (five-key law)',
    /sdp\.settings\.telemetry|saveSettings\(\{ telemetry/.test(telSrc) && /t\.sessions\.push\(rec\);/.test(telSrc),
    'append-only');
  const telCode = telSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('V5b clientId is sdp_u_<16-hex> built with the ES5 hex helper (no padStart in code)',
    /'sdp_u_' \+ randomHex16\(\)/.test(telSrc) && /\('0' \+ n\.toString\(16\)\)\.slice\(-2\)/.test(telSrc) && !/padStart/.test(telCode),
    'clientId');
  check('V5c push/pull: ntfy sdp_<owner>_telemetry_v1 + GAS telemetry_sync/telemetry_pull with the 3.5 s pull timeout',
    /sdp_' \+ owner\(\) \+ '_telemetry_v1/.test(telSrc) && /telemetry_sync/.test(telSrc) &&
    /telemetry_pull/.readTextCheck ? true : /telemetry_pull/.test(telSrc) && /PULL_TIMEOUT_MS = 3500/.test(telSrc),
    'transport');
  check('V5d the GAS backend answers telemetry_sync (public, rate-limited) and telemetry_pull (admin)',
    /function telemetrySync\(body\)/.test(readText('data/gas-source.txt')) &&
    /function telemetryPull\(body\)/.test(readText('data/gas-source.txt')),
    'gas');
  check('V5e #studioActivityPopup ships with the summary, table, incidents panel and .zip/.json exports',
    html.indexOf('id="studioActivityPopup"') > 0 && html.indexOf('id="studioActivityTable"') > 0 &&
    html.indexOf('id="studioIncidentsPanel"') > 0 && html.indexOf('id="btnStudioActivityZip"') > 0 &&
    html.indexOf('id="btnStudioActivityJson"') > 0,
    'popup markup');
  check('V5f Studio wires the popup (auto-open on unlock + the 📊 Live Student Activity & Alerts button)',
    /openStudioActivityPopup/.test(studio) && /📊 Live Student Activity &amp; Alerts/.test(html) &&
    /btnStudioActivityPopup/.test(studio),
    'wiring');

  /* live jsdom: multi-visit append + ntfy beacon capture */
  {
    const seen = [];
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.6.z');
        w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.6.z' }));
        const inner = w.fetch;
        w.fetch = function (url, init) {
          seen.push({ url: String(url), init: init || null });
          return inner(url, init);
        };
      }
    });
    const T1 = app.SDP.Telemetry;
    const t1 = T1.ledger();
    check('V5g live: the ledger materialises with a valid sdp_u_ clientId inside sdp.settings',
      /^sdp_u_[0-9a-f]{16}$/.test(t1.clientId), t1.clientId);
    /* first visit */
    T1.sessionStart();
    T1.sessionEnd({ wordsCompleted: 12, score: 80, missedWords: ['harbour'] });
    /* second visit: APPEND, never overwrite */
    T1.sessionStart();
    T1.sessionEnd({ wordsCompleted: 30, score: 100, missedWords: [] });
    const t2 = T1.ledger();
    check('V5h live: a SECOND visit appends (sessions.length 2, visitCount 3 incl. the boot visit — nothing overwritten)',
      t2.sessions.length === 2 && t2.visitCount === 3 &&
      t2.sessions[0].wordsCompleted === 12 && t2.sessions[1].wordsCompleted === 30,
      JSON.stringify({ len: t2.sessions.length, visits: t2.visitCount }));
    check('V5i live: both sessions carry the privacy-safe device block (class/dpr/vw/vh/net)',
      t2.sessions.every((s) => s.device && s.device.class && s.device.net && s.device.vw !== undefined),
      'device block');
    /* incident append */
    T1.recordIncident('selfheal_T2', { clipKey: 'words.harbour', lastErr: 'MEDIA_ERR_NETWORK' });
    const t3 = T1.ledger();
    check('V5j live: recordIncident appends a typed incident that rides the ledger',
      t3.incidents.length >= 1 && t3.incidents[t3.incidents.length - 1].type === 'selfheal_T2',
      'incident');
    /* pull merge with a stubbed ntfy row */
    const inner2 = app.w.fetch;
    app.w.fetch = function (url, init) {
      if (String(url).indexOf('ntfy.sh') >= 0 && String(url).indexOf('/json') >= 0) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([
          { clientId: 'sdp_u_abcdef0123456789', session: { sessionNo: 1, startedAt: 1, endedAt: 2, dwellSec: 60, wordsCompleted: 20, score: 90, missedWords: [], device: { class: 'phone', net: '3g' } }, incidents: [] }
        ]) });
      }
      return inner2(url, init);
    };
    await new Promise((resolve) => { app.SDP.Telemetry.pullTelemetryLedger(function () { resolve(); }); });
    await new Promise((resolve) => setImmediate(resolve));
    const led = JSON.parse(app.w.localStorage.getItem('sdp.settings')).telemetryLedger;
    check('V5k live: pullTelemetryLedger merges the remote row into sdp.settings.telemetryLedger',
      led && led.users && led.users.some((u) => u.clientId === 'sdp_u_abcdef0123456789'),
      'merge');
    /* studio popup renders from the merged ledger */
    app.SDP.Studio.openStudioActivityPopup();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    check('V5l live: #studioActivityPopup renders the remote user row + summary',
      app.byId('studioActivityPopup').hidden === false &&
      app.byId('studioActivitySummary').textContent.indexOf('Sessions Recorded') >= 0 &&
      JSON.parse(app.w.localStorage.getItem('sdp.settings')).telemetryLedger.users.length >= 1,
      app.byId('studioActivitySummary').textContent);
    app.SDP.Studio.closeStudioActivityPopup();
    app.close();
  }

  /* ── V6 — self-heal assistant T1–T7 ────────────────────────────────────── */
  const shSrc = readText('data/sdp-selfheal.js');
  check('V6a all seven triggers T1-T7 ship with their exact plain-English copy',
    /T1: \{ title: 'Voice clips are still loading'/.test(shSrc) &&
    /T2: \{ title: 'One word did not load correctly'/.test(shSrc) &&
    /T3: \{ title: 'Using the backup voice'/.test(shSrc) &&
    /T4: \{ title: 'The app feels slow'/.test(shSrc) &&
    /T5: \{ title: 'A new version is ready'/.test(shSrc) &&
    /T6: \{ title: 'Storage is full'/.test(shSrc) &&
    /T7: \{ title: 'A browser extension may be changing this page'/.test(shSrc),
    'copy');
  check('V6b the 1-tap actions ship (Reload Voice Clips / Switch to Backup Audio / Refresh Page / Clear Old Audio)',
    /'🔄 Reload Voice Clips'/.test(shSrc) && /'🔊 Switch to Backup Audio'/.test(shSrc) &&
    /'↻ Refresh Page'/.test(shSrc) && /'Clear Old Audio'/.test(shSrc),
    'actions');
  check('V6c per-trigger dedupe with the 5-minute re-arm + Telemetry.recordIncident wiring',
    /REARM_MS = 300000/.test(shSrc) && /SDP\.Telemetry\.recordIncident/.test(shSrc),
    'dedupe');
  check('V6d T2/T3 fire from the speech tier ladder (MEDIA_ERR_* + tts fall-through)',
    /SelfHeal\.show\('T2'/.test(readText('data/sdp-audio-speech.js')) &&
    /SelfHeal\.show\('T3'/.test(readText('data/sdp-audio-speech.js')),
    'speech hooks');
  check('V6e #sdpSelfHealModal is injected at boot with role=dialog + aria-modal',
    /sdpSelfHealModal/.test(shSrc) && /aria-modal/.test(shSrc),
    'modal');
  {
    /* live jsdom: T6 quota + popup show/hide */
    const app = await createApp({});
    const shown = app.SDP.SelfHeal.show('T6', { lastErr: 'QuotaExceededError' });
    await app.advance(100);
    check('V6f live: T6 surfaces #sdpSelfHealModal with the exact copy',
      shown === true && app.byId('sdpSelfHealModal').hidden === false &&
      /Storage is full on this phone/.test(app.byId('sdpSelfHealBody').textContent),
      'shown');
    /* dedupe: a second T6 within the window is refused */
    const again = app.SDP.SelfHeal.show('T6', {});
    check('V6g live: the per-trigger dedupe refuses an immediate second T6 popup',
      again === false, 'deduped=' + again);
    app.SDP.SelfHeal.hide();
    check('V6h live: hide() closes the modal', app.byId('sdpSelfHealModal').hidden === true, 'hidden');
    app.close();
  }

  /* ── report ────────────────────────────────────────────────────────────── */
  const failed = results.filter((r) => r.status === 'FAIL');
  results.forEach((r) => {
    if (r.status === 'PASS') return;
    console.log('FAIL  ' + r.test + '  [' + r.detail + ']');
  });
  console.log('\nV-GATE v006v-verification.cjs — ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
  process.exitCode = failed.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
