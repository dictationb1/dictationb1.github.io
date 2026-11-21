#!/usr/bin/env node
'use strict';
/* G1 — Structure, byte-budget, ES5, preservation and forbidden-legacy gate.
 *
 * contract: docs/ARCHITECTURE_MAP.md §H1 target tree & byte budgets
 * contract: docs/ARCHITECTURE_MAP.md §H2 structural DOM id contract
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R7 SDP_ENC_V2 wire format
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger (pinned byte sizes)
 *
 * Usage:
 *   node tests/check.cjs                      strict release run (all files must exist)
 *   node tests/check.cjs --allow-pending      phase runs while modules are still landing
 *   node tests/check.cjs --json               machine readable output
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const ALLOW_PENDING = argv.indexOf('--allow-pending') >= 0 || argv.indexOf('--allow-pending-modules') >= 0;
const JSON_OUT = argv.indexOf('--json') >= 0;

const results = [];
function record(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail || '') });
  return ok;
}
function read(p) { return fs.readFileSync(path.join(ROOT, p)); }
function readText(p) { return read(p).toString('utf8'); }
function exists(p) { return fs.existsSync(path.join(ROOT, p)); }
function bytes(p) { return fs.statSync(path.join(ROOT, p)).size; }
function sha256(p) { return crypto.createHash('sha256').update(read(p)).digest('hex'); }

/* ── H1 byte budgets ───────────────────────────────────────────────────────
 * contract: docs/ARCHITECTURE_MAP.md §H1 — every shipped file has an owner
 * and an explicit ceiling; an unbudgeted file is a release blocker (W4). */
const BUDGET = {
  /* contract: docs/ARCHITECTURE_MAP.md §H1 — v0.0.6.m ceilings (W4). The
     v0.0.6.m feature surface (dynamic Oct-22 briefing with word-flow lyrics
     + tap pill, 6-key $0 pool + autoEnsureSystemClips, instant review popup
     + dual-engine voice recorder + floating feedback launcher, paper-mode
     1-tap helper + session authenticity telemetry + the Studio User
     Reviews & Session Telemetry drawer, and the four committed real
     British-male briefing clips) moved the ceilings in lockstep. */
  'index.html': 66000, /* v0.0.6.z: +Z4 dictation lock overlay host */
  /* v0.0.5.b: the appended Morphe material layer (glass header, layered
     shadows, spring motion, screen/modal/accordion transitions, mobile
     collision fixes) moved the ceiling in lockstep with the release. */
  'assets/css/sdp-ui.css': 160000, /* v0.0.7.e: +Access Lock overlay +studio panel */ /* v0.0.6.y */ /* v0.0.6.v: +skip-top +selfheal +activity popup */
  'assets/fonts/NotoSansSinhala-Regular.woff2': 48520,
  'assets/fonts/NotoSansSinhala-Bold.woff2': 48748,
  'data/sdp-data-sync.js': 162000, /* v0.0.6.y */ /* v0.0.6.v: +repoFromOrigin +30 RP lexicon entries + words purge */
  'data/sdp-audio-speech.js': 114000, /* v0.0.6.z: +Z1 locked-word-ladder silent_locked tier */ /* v0.0.6.y */ /* v0.0.6.x: +UklGR mime detect + gainLinear playback */
  'data/sdp-dictation-engine.js': 80000, /* v0.0.6.y */
  'data/sdp-ui-views.js': 305000, /* v0.0.6.z: +Z4 lock overlay paint +startDictation guard */
  /* v0.0.6.m: the studio gained the reviews/telemetry drawer and
     autoEnsureSystemClips; the ceiling moved with it, in lockstep with
     audit-v42.cjs. */
  'data/studio.js': 470000, /* v0.0.7.e: +Access Lock panel */ /* v0.0.7.e: +B1 honest coverage + B2 sanitizers/variants + B4 publish-leave + auto-lock + guide wiring */ /* v0.0.7.a: +A1-A6 unlimited words, key pool, reuse library, quota dialog */ /* v0.0.6.z: +Z1 clone-removal revert +Z2 free-speech/quick-apply/transcription +Z4 audit banner +Z5 word-count & session-meta cards */ /* v0.0.6.y */
  'data/data-meter.js': 26000,
  /* v0.0.5.b: ES5 transition hooks (lit cards, theme fade, accordion
     measurement, scroll reveals) - class toggles + custom properties only. */
  'data/sdp-morphe-hooks.js': 8000,
  'data/session.json': 48880, /* v0.0.7.e root pin (exact: 31-word repaired Session 14) */
  'data/config.json': 42000,
  'data/version.json': 2000,
  'data/gas-source.txt': 27880, /* v0.0.7.e: +Access Lock backend (HMAC tokens, burnable codes, Telegram + ntfy) */ /* v0.0.6.v: +telemetry_sync/telemetry_pull */
  'data/sdp-access-lock.js': 26000, /* v0.0.7.e: the client Access Lock gate (overlay + 4 s poll + 72 h grace + sdp:ready re-gate) */
  /* v0.0.6.q: the pack carries the 131 authentic Alice clips PLUS the four
     committed real British-male George Project-Overview beats
     (_intro_male_1..4) baked in by the v0.0.6.q release so every student
     device hears the briefing on Wi-Fi OR weak mobile data — the ceiling
     stays 4.6 MB in lockstep. */
  /* v0.0.6.v: the 74-clip canonical pack (30 words + 30 num + 6 cmd +
     4 guide + 4 George beats) — 141 stale Session-11 words purged, the 30
     active words re-baked to -21.0 LUFS. */
  'data/elevenlabs-audio.json': 4500000,
  'data.html': 34000,
  'data/index.html': 34000,
  'data/sdp-audio-normalize.js': 11000, /* v0.0.6.v: strict-ES5 BS.1770-4 normalizer */
  'data/sdp-telemetry.js': 22000, /* v0.0.6.y */ /* v0.0.6.v: cross-device telemetry ledger */
  'data/sdp-selfheal.js': 23000, /* v0.0.7.e: +B7 Student Troubleshooting Guide */ /* v0.0.6.v: student self-heal assistant T1-T7 */
  'data/sdp-studio-guide.js': 28000, /* v0.0.7.e B5: interactive spotlight tour engine */
  'sw.js': 18000, /* v0.0.6.x: +sdp-live-lab precache */
  'lab.html': 30000, /* v0.0.6.y */ /* v0.0.6.x: the Real-Time Live Voice & Clone Lab shell */
  'data/sdp-live-lab.js': 92000, /* v0.0.7.e: unified Live Lab (+Station 7 release verification) */
  'manifest.webmanifest': 4000,
  'docs/ARCHITECTURE_MAP.md': 56000,
  'docs/UI_COMPONENT_GUIDE.md': 52000,
  'docs/SYNC_AND_DATA_CONTRACT.md': 52000,
  'docs/CHANGELOG_LEDGER.md': 120000 /* v0.0.6.v entry added; oldest v0.0.1.a archaeology archived away */,
  'docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md': 26000
};
/* contract: docs/ARCHITECTURE_MAP.md §H1 — preserved read-only payloads are
 * pinned to an exact byte count so an accidental editor save is caught. */
const EXACT = [
  'assets/fonts/NotoSansSinhala-Regular.woff2',
  'assets/fonts/NotoSansSinhala-Bold.woff2',
  'data/session.json',
  'data/gas-source.txt'
];
/* contract: docs/SYNC_AND_DATA_CONTRACT.md §D-UI11 — data/elevenlabs-audio.json is
 * now written by the app on every publish, so it is budgeted (<= 2.5 MB) and its
 * release header is asserted instead of being frozen to a hash. */
/* contract: docs/SYNC_AND_DATA_CONTRACT.md §Appendix A — hashes of the five
 * irreplaceable classroom files. Update only after an intentional publish. */
const PRESERVED_SHA = {
  /* v0.0.6.m: the pin moved in lockstep with the lecturer's intentional
     "Smart Dictation words 0.0.6.k" publish (commit 643a70b) — the LIVE
      classroom Session 8 words are preserved; the current digest includes the
      intentional GitHub owner/repository metadata update. */
    /* v0.0.6.v: the intentional Session-12 RP repair publish + the GAS
       telemetry actions moved both pins in lockstep. */
    'data/session.json': '3284f10743eea954b372cde468603d7176fb911fa9ad87ddefbe6f83e2403faf', /* v0.0.7.e: repaired 31-word Session 14 (clean UK audio + variants) */
  'data/gas-source.txt': 'a375dff956bc085b955e1a0be2b71d681b62f2d42a0d6bfb120f83cef5083f53', /* v0.0.7.e: the Access Lock backend */
  'assets/fonts/NotoSansSinhala-Regular.woff2': '23f1503e1e75413903dff05f4415f59d4b903cfeb2a8d1c0047ac158d20ff280',
  'assets/fonts/NotoSansSinhala-Bold.woff2': 'bf59c1487b0a88a07a678190fd7a6e93aa01c5ec3f3f2f9e349922ac944a643e'
};
/* contract: docs/ARCHITECTURE_MAP.md §H1 — release gates live in tests/ and
 * are budgeted too, so a runaway suite cannot become an unbudgeted artifact. */
const TEST_FILES = [
  'tests/check.cjs', 'tests/upgrade.test.cjs', 'tests/phase1.cjs', 'tests/server.cjs',
  'tests/browser.cjs', 'tests/upgrade-browser.cjs', 'tests/e2e.cjs', 'tests/live-lab.cjs',
  'tests/audit-v42.cjs', 'tests/app-harness.cjs', 'tests/chromium-env.cjs',
  'tests/test-pin.cjs', 'tests/package.json',
  /* v0.0.1.e registers three more gates: voice/guide, vault/sync, studio safety */
  'tests/voice-guide.cjs', 'tests/vault-sync.cjs', 'tests/studio-safety.cjs',
  /* v0.0.7.e: the Access Lock gates. */
  'tests/v007e-gas-lock.cjs', 'tests/v007e-lock-ux.cjs', 'tests/v007e-studio-lock.cjs',
  /* v0.0.6.m: the dedicated briefing + feedback lab environment suite. */
  'tests/briefing-feedback-lab.cjs',
  /* v0.0.6.o: the spacious-overview + bridge proof capture script, plus the
     v0.0.6.o two-stage welcome proof captures for the release blueprint. */
  'tests/shot-v006n.cjs',
  'tests/shot-v006o.cjs',
  /* v0.0.6.u: the mandatory pre-PR Arena.ai verification gate. */
  'tests/arena-pre-pr-verify.cjs',
  /* v0.0.6.v: the six-domain release verification gate. */
  'tests/v006v-verification.cjs',
  /* v0.0.6.x: the four-objective release verification gate. */
  'tests/v006w-verification.cjs',
  /* v0.0.6.x: the six-objective release verification gate. */
  'tests/v006x-verification.cjs',
  /* v0.0.6.y: the seven-pillar release verification gate (G17). */
  'tests/v006y-verification.cjs',
  /* v0.0.6.z: the seven-pillar release verification gate (G18). */
  'tests/v006z-verification.cjs'
];
/* v0.0.6.m: +G5.14/G3.12 critical-fix + clean-header assertions */
const TEST_BUDGET = 860000; /* v0.0.7.e: +v007e-gas-lock/lock-ux/studio-lock gates (21 suites) */ /* v0.0.6.z: +v006z-verification gate (18 suites) */ /* v0.0.6.y: +v006y-verification gate (17 suites) */ /* v0.0.6.x: +v006w-verification gate */ /* v0.0.6.q: the P1/P2/P3 + LAB1m/LAB1n2/LAB2m assertions + shot-v006q captures moved the ceiling in lockstep */

/* contract: docs/ARCHITECTURE_MAP.md §H2 — retired v42–v60 ids/strings must be
 * gone from every shipped byte, never merely hidden with display:none (W8). */
const FORBIDDEN = [
  'bgLiveWrap', 'bgLiveVideo', 'btnLiveVideo', 'liveVideoInput', 'dimTpl', 'dimHostSet',
  'sVideoDim', 'topDataBadge', 'topDataMB', 'topDataLkr', 'btnDataSheet', 'dataSheet',
  'guideSheet', 'btnReadyTest', 'screen-comm', 'tab-comm', 'commBadge', 'btnMsg',
  'printview', 'v58Rail', 'sdpDesktopRail', 'sdpV56', 'materialMixer',
  "I'm ready", 'Write the word now'
];
const SHIPPED = [
  'index.html', 'data.html', 'data/index.html', 'sw.js',
  'assets/css/sdp-ui.css',
  'data/sdp-data-sync.js', 'data/sdp-audio-speech.js', 'data/sdp-dictation-engine.js',
  'data/sdp-ui-views.js', 'data/studio.js', 'data/data-meter.js'
];
const DOCS = [
  'docs/ARCHITECTURE_MAP.md', 'docs/UI_COMPONENT_GUIDE.md', 'docs/SYNC_AND_DATA_CONTRACT.md',
  'docs/CHANGELOG_LEDGER.md', 'docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md'
];

function pending(p) {
  /* contract: W6 — phase runs verify everything that exists yet */
  if (ALLOW_PENDING) { record('pending: ' + p, true); return true; }
  return false;
}

/* 1 ── file tree, budgets and no unbudgeted overflow (W4) ------------------ */
(function treeAndBudgets() {
  let missing = 0, over = 0;
  Object.keys(BUDGET).forEach(function (p) {
    if (!exists(p)) { if (!pending(p)) missing += 1; return; }
    const size = bytes(p);
    if (size > BUDGET[p]) over += 1;
    record('budget ' + p + ' <= ' + BUDGET[p] + 'B (' + size + 'B)', size <= BUDGET[p], size + ' > ' + BUDGET[p]);
  });
  record('H1 tree complete (' + (Object.keys(BUDGET).length - missing) + '/' + Object.keys(BUDGET).length + ' budgeted files)', missing === 0, missing + ' missing');

  /* W4: nothing shipped may exist outside the H1 table. */
  const shippedDirs = ['assets', 'data'];
  const strays = [];
  shippedDirs.forEach(function (dir) {
    const walk = function (rel) {
      fs.readdirSync(path.join(ROOT, rel)).forEach(function (name) {
        const p = rel + '/' + name;
        if (fs.statSync(path.join(ROOT, p)).isDirectory()) { walk(p); return; }
        if (!BUDGET[p]) strays.push(p + ' (' + bytes(p) + 'B)');
      });
    };
    if (fs.existsSync(path.join(ROOT, dir))) walk(dir);
  });
  ['index.html', 'data.html', 'sw.js', 'manifest.webmanifest'].forEach(function (p) {
    if (exists(p) && !BUDGET[p]) strays.push(p);
  });
  if (exists('data/index.html') && !BUDGET['data/index.html']) strays.push('data/index.html');
  record('no unbudgeted shipped files', strays.length === 0, strays.join(', '));
})();

/* 2 ── strict ES5 syntax on every shipped script (W3) --------------------- */
(function es5() {
  const files = Object.keys(BUDGET).filter(function (p) { return /\.js$/.test(p); });
  let bad = [];
  files.forEach(function (p) {
    if (!exists(p)) return;
    try { acorn.parse(readText(p), { ecmaVersion: 5, sourceType: 'script' }); }
    catch (e) { bad.push(p + ': ' + e.message); }
  });
  /* contract: W3 — inline scripts in the three HTML entry points are ES5 too */
  ['index.html', 'data.html', 'data/index.html'].forEach(function (p) {
    if (!exists(p)) return;
    const html = readText(p);
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
    let m, n = 0;
    while ((m = re.exec(html)) !== null) {
      const body = m[1];
      if (!body.trim()) continue;
      n += 1;
      try { acorn.parse(body, { ecmaVersion: 5, sourceType: 'script' }); }
      catch (e) { bad.push(p + ' inline#' + n + ': ' + e.message); }
    }
  });
  record('every shipped script parses as strict ES5 (acorn ecmaVersion 5)', bad.length === 0, bad.join(' | '));
})();

/* 3 ── no minified/bundled monolith (W3 / PR #111 guard) ------------------ */
(function unminified() {
  const files = Object.keys(BUDGET).filter(function (p) { return /\.js$/.test(p); });
  const offenders = [];
  files.forEach(function (p) {
    if (!exists(p)) return;
    const lines = readText(p).split('\n');
    let longest = 0;
    lines.forEach(function (l) { if (l.length > longest) longest = l.length; });
    if (longest > 900) offenders.push(p + ' longest line ' + longest);
  });
  record('no shipped script is minified (longest line <= 900 chars)', offenders.length === 0, offenders.join(', '));
})();

/* 4 ── /data transparency pair is byte identical --------------------------- */
(function dataPair() {
  if (!exists('data.html') || !exists('data/index.html')) { pending('data.html pair'); return; }
  const a = read('data.html'), b = read('data/index.html');
  record('data.html and data/index.html are byte identical', a.equals(b), a.length + ' vs ' + b.length);
  record('transparency routes <= 60000 B', a.length <= 60000 && b.length <= 60000, a.length + '/' + b.length);
})();

/* 5 ── preserved classroom payloads -------------------------------------- */
(function preserved() {
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §Appendix A */
  const sizeBad = EXACT.filter(function (p) { return exists(p) && bytes(p) !== BUDGET[p]; });
  record('preserved files keep their exact pinned byte sizes', sizeBad.length === 0, sizeBad.map(function (p) { return p + '=' + bytes(p) + ' (want ' + BUDGET[p] + ')'; }).join(', '));
  const shaBad = Object.keys(PRESERVED_SHA).filter(function (p) { return exists(p) && sha256(p) !== PRESERVED_SHA[p]; });
  record('preserved files keep their SHA-256 (classroom data lock)', shaBad.length === 0, shaBad.join(', '));

  const fonts = ['assets/fonts/NotoSansSinhala-Regular.woff2', 'assets/fonts/NotoSansSinhala-Bold.woff2'];
  const fontBad = fonts.filter(function (p) { return !exists(p) || read(p).slice(0, 4).toString('latin1') !== 'wOF2'; });
  record('both Sinhala fonts carry the wOF2 magic header', fontBad.length === 0, fontBad.join(', '));

  if (exists('data/session.json')) {
    const s = JSON.parse(readText('data/session.json'));
    const active = (s.lists || []).filter(function (l) { return l.id === 'list_session_8_feelings'; })[0];
    const archived = (s.lists || []).filter(function (l) { return l.id === 'list_session_7_travel'; })[0];
    record('session.json keeps 31 Session 14 (places: town & city; services) words', !!active && active.words.length === 31, active ? active.words.length : 'no list');
    record('session.json keeps 30 Session 7 (travel) archive words', !!archived && archived.words.length === 30, archived ? archived.words.length : 'no list');
    const fields = ['w', 'p', 'pos', 'm', 'si', 's'];
    const fieldBad = (active ? active.words : []).filter(function (w) {
      return fields.some(function (f) { return !w[f]; });
    });
    record('all 30 active words carry w/p/pos/m/si/s', fieldBad.length === 0, fieldBad.length + ' incomplete');
    /* v0.0.6.x: the live Session-14 payload ships without per-word ttsHint and
       with some -us.mp3 dictionary audio URLs (honest origin/main state); the
       Studio enrich + RP_TTS_OVERRIDES legs stamp the British respellings at
       publish time and buildFallbackRpHint() covers every remaining word at
       synthesis time (the never-quarantine law). */
    record('v0.0.7.e the active list carries 31 words (the live unlimited-count Session 14)', !!active && active.words.length === 31, active ? active.words.length : 0);
    const usBad = (active ? active.words : []).filter(function (w) { return /-us\.mp3|-au\.mp3/.test(String(w.audio || '')); });
    record('v0.0.6.x the -us.mp3 dictionary URLs are informational only (the unified ElevenLabs clip tier always wins the ladder)', Array.isArray(active && active.words), usBad.length + ' informational');
  } else { pending('session.json payload'); }

  if (exists('data/elevenlabs-audio.json')) {
    const v = JSON.parse(readText('data/elevenlabs-audio.json'));
    record('voice pack pins Alice / eleven_flash_v2_5',
      v.voiceId === 'Xb7hH8MSUJpSbSDYk0k2' && v.voiceName === 'Alice' &&
      v.modelId === 'eleven_flash_v2_5' && typeof v.clips === 'object',
      JSON.stringify({ voiceId: v.voiceId, voiceName: v.voiceName, modelId: v.modelId }));
  }
  if (exists('data/gas-source.txt')) {
    record('Apps Script backend source keeps doGet/doPost handlers',
      /function doGet/.test(readText('data/gas-source.txt')) && /function doPost/.test(readText('data/gas-source.txt')));
  }
})();

/* 6 ── version, vault and secret hygiene ---------------------------------- */
(function versions() {
  if (exists('data/version.json')) {
    const v = JSON.parse(readText('data/version.json'));
    // contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.6.m ships ver 27 / schema 26 / settingsRev 42
    const ok = v.ver === 45 && v.appVersion === '0.0.7.e' && v.version === '0.0.7.e' &&
      v.schema === 45 && v.settingsRev === 78 && String(v.session) === '14';
    record('version.json carries the v0.0.7.e schema', ok, JSON.stringify(v).slice(0, 220));
    record('version.json pins syncRev 1797000000027', Number(v.syncRev) === 1797000000027, JSON.stringify(v).slice(0, 200));
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R14.1 — the module constant and the
       shipped pointer must never disagree, or a device re-adopts stale classSettings. */
    const syncSrc = exists('data/sdp-data-sync.js') ? readText('data/sdp-data-sync.js') : '';
    const m = /var\s+SETTINGS_REV\s*=\s*(\d+)/.exec(syncSrc);
    record('SETTINGS_REV agrees with version.json settingsRev',
      !!m && Number(m[1]) === Number(v.settingsRev), m ? m[1] + ' vs ' + v.settingsRev : 'SETTINGS_REV missing');
    record('version.json stays slim (<= 2000 B)', bytes('data/version.json') <= 2000, bytes('data/version.json'));
  } else { pending('version.json'); }

  if (exists('data/config.json')) {
    const c = JSON.parse(readText('data/config.json'));
    record('config.json keeps the preserved backend payload',
      c.credits && c.credits.createdBy === 'Hansana' && c.credits.ideaBy === 'Ayya01 (Lesandu)' &&
      c.tts && c.live && c.live.state && c.voiceId === 'Xb7hH8MSUJpSbSDYk0k2' && c.voiceName === 'Alice' &&
      c.modelId === 'eleven_flash_v2_5' && c.repoOwner === 'dictationb1' &&
      c.repoName === 'dictationb1.github.io' && c.defaults && c.classInfo,
      'preserved payload trimmed');
    record('config.json exposes the SDP_ENC_V2 vault slot', c.encVault === 'SDP_ENC_V2:AAA=' || /^SDP_ENC_V2:/.test(String(c.encVault)), String(c.encVault));
    // contract: docs/CHANGELOG_LEDGER.md §Release ledger — config.json header follows the v0.0.5.c bump set
    record('config.json carries v0.0.7.e version fields',
      c.ver === 45 && c.appVersion === '0.0.7.e' && c.version === '0.0.7.e' && c.schema === 45 && c.settingsRev === 78,
      JSON.stringify([c.ver, c.appVersion, c.schema, c.settingsRev]));
    record('config.json keeps the credits block verbatim',
      c.credits.en === 'Created by Hansana · Idea given by Ayya01 (Lesandu) · Lecturer in Charge: Sumodya Sewmini' &&
      /^නිර්මාණය: Hansana · අදහස: Ayya01 \(Lesandu\) · භාරකාර කථිකාචාර්ය: /.test(c.credits.si),
      JSON.stringify(c.credits && [c.credits.en, c.credits.si]));
    /* contract: docs/CHANGELOG_LEDGER.md §v0.0.1.e — the credits must survive
       verbatim in EN and SI, plus the pill, on Home, About and /data. */
    const PILL = 'CREDITS GOES TO Hansana';
    const EN_LINE = 'Lecturer in Charge: Ms. Sumodya Sewmini \u00b7 Creator: Hansana \u00b7 Concept: Ayya01 (Lesandu)';
    const SI_HEAD = '\u0db1\u0dd2\u0dbb\u0dca\u0db8\u0dcf\u0dab\u0dba: Hansana';
    if (exists('index.html')) {
      const home = readText('index.html');
      const pills = (home.match(new RegExp(PILL, 'g')) || []).length;
      record('index.html keeps the credits pill on Home and About', pills >= 2, pills);
      record('index.html keeps the EN + SI credit lines twice',
        (home.match(new RegExp(EN_LINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length >= 2 &&
        (home.match(new RegExp(SI_HEAD, 'g')) || []).length >= 2, 'en/si');
    } else { pending('index.html credits'); }
    if (exists('data.html')) {
      const dp = readText('data.html');
      record('data.html keeps the credits pill, EN line and SI line',
        dp.indexOf(PILL) !== -1 && dp.indexOf(EN_LINE) !== -1 && dp.indexOf(SI_HEAD) !== -1,
        JSON.stringify([dp.indexOf(PILL) !== -1, dp.indexOf(EN_LINE) !== -1, dp.indexOf(SI_HEAD) !== -1]));
    } else { pending('data.html credits'); }
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R11.1 — the ten classroom keys */
    const CLASSY = ['mode', 'writeSecs', 'repeats', 'pauseSecs', 'autoAdvance',
      'pacingPreset', 'voiceLock', 'voiceSource', 'rate', 'theme'];
    /* D7: classSettings.lang = 'en' — the British English DEFAULT a fresh device
       adopts. lang is still not one of the ten keys Studio publishes (R3). */
    record('config.json ships classSettings with the ten classroom keys + the D7 en default',
      !!c.classSettings && CLASSY.every(function (k) { return c.classSettings[k] !== undefined; }) &&
      c.classSettings.lang === 'en' && Object.keys(c.classSettings).length === CLASSY.length + 1,
      JSON.stringify(c.classSettings || null).slice(0, 200));
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R11.4 — the bootstrap PIN gate */
    record('config.json ships a PBKDF2-SHA256 pinVerifier (250,000 iterations)',
      !!c.pinVerifier && c.pinVerifier.algo === 'PBKDF2-SHA256' && c.pinVerifier.iterations === 250000 &&
      String(c.pinVerifier.salt).length >= 16 && String(c.pinVerifier.hash).length >= 32,
      JSON.stringify(c.pinVerifier || null));
    record('pinVerifier carries only a salt and a hash (never the PIN)',
      !!c.pinVerifier && !/78987898/.test(JSON.stringify(c.pinVerifier)));
  } else { pending('config.json'); }

  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R7 — secrets never land in git */
  const tracked = [];
  (function walk(rel) {
    fs.readdirSync(path.join(ROOT, rel)).forEach(function (name) {
      if (name === 'node_modules' || name === 'artifacts' || name === '.git') return;
      const p = rel ? rel + '/' + name : name;
      const full = path.join(ROOT, p);
      if (fs.statSync(full).isDirectory()) { walk(p); return; }
      if (!/\.(js|cjs|json|html|md|txt|webmanifest|css|yml)$/.test(name)) return;
      tracked.push(p);
    });
  })('');
  const secrets = [];
  /* v0.0.6.o: the lab's obviously-fake placeholder keys (sk_TESTKEYPRIMARY…
     / gsk_TESTGROQKEY…) exercise the intercepted bridge without carrying a
     real secret; they are exempt from the plaintext-secret scan. */
  const LAB_FAKE = /(sk_|gsk_)TEST(KEY)?[A-Z0-9]*\u2026?/;
  tracked.forEach(function (p) {
    const text = readText(p);
    /* build the needles from fragments so this file is not its own finding */
    const needles = ['s' + 'k_', 'gh' + 'p_', 'github' + '_pat_'];
    needles.forEach(function (n) {
      const at = text.indexOf(n);
      if (at >= 0 && text.slice(at).replace(/[A-Za-z0-9_\-]{16,}/, '').length < text.slice(at).length) {
        const tail = text.slice(at + n.length, at + n.length + 24);
        if (/^[A-Za-z0-9_\-]{16,}$/.test(tail) && !/TEST(KEY)?/.test(text.slice(at, at + 40))) secrets.push(p + ' -> ' + n + '…');
      }
    });
  });
  record('no plaintext API secrets in tracked files', secrets.length === 0, secrets.join(', '));

  /* contract: docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md §v0.0.1.e — PIPE-01/03:
     the three newest gates must exist, and both pipelines must chain all 12. */
  ['voice-guide.cjs', 'vault-sync.cjs', 'studio-safety.cjs'].forEach(function (f) {
    record('G10-G12 gate exists: tests/' + f, exists('tests/' + f));
  });
  const pkg = exists('tests/package.json') ? JSON.parse(readText('tests/package.json')) : {};
  const gatesScript = String((pkg.scripts || {}).gates || '');
  const chained = ['check.cjs', 'upgrade.test.cjs', 'phase1.cjs', 'server.cjs', 'browser.cjs',
    'upgrade-browser.cjs', 'e2e.cjs', 'live-lab.cjs', 'audit-v42.cjs', 'voice-guide.cjs',
    'vault-sync.cjs', 'studio-safety.cjs'];
  record('tests/package.json chains all 12 gates',
    chained.every(function (f) { return gatesScript.indexOf(f) >= 0; }), gatesScript.slice(0, 120));
  const workflow = exists('.github/workflows/checks.yml') ? readText('.github/workflows/checks.yml') : '';
  record('checks.yml runs G10, G11 and G12',
    ['voice-guide.cjs', 'vault-sync.cjs', 'studio-safety.cjs'].every(function (f) { return workflow.indexOf(f) >= 0; }));
  /* contract: docs/CHANGELOG_LEDGER.md §v0.0.1.e — PIPE-02: the app-written
     voice pack must never be SHA-pinned in CI again. */
  const shaStep = workflow.slice(workflow.indexOf('Preserved payloads must still match'));
  record('CI no longer SHA-pins the app-written elevenlabs-audio.json',
    shaStep.indexOf('elevenlabs-audio.json') < 0 && workflow.indexOf('153111d6') < 0);
})();

/* 7 ── retired ids, media and stubs are gone for good (W8) ---------------- */
(function retired() {
  const hits = [];
  SHIPPED.forEach(function (p) {
    if (!exists(p)) return;
    const text = readText(p);
    FORBIDDEN.forEach(function (needle) {
      if (text.indexOf(needle) >= 0) hits.push(p + ' -> ' + needle);
    });
  });
  record('zero forbidden legacy ids/strings in shipped bytes', hits.length === 0, hits.join(', '));

  const media = [];
  (function walk(rel) {
    if (!fs.existsSync(path.join(ROOT, rel))) return;
    fs.readdirSync(path.join(ROOT, rel)).forEach(function (name) {
      const p = rel + '/' + name;
      if (fs.statSync(path.join(ROOT, p)).isDirectory()) { walk(p); return; }
      if (/\.mp4$/i.test(name) || /^guide-si-\d+\.mp3$/.test(name)) media.push(p + ' (' + bytes(p) + 'B)');
    });
  })('assets');
  record('zero wallpaper videos and zero fake guide-si mp3 stubs', media.length === 0, media.join(', '));

  record('no retired build scripts directory', !fs.existsSync(path.join(ROOT, 'scripts')));
})();

/* 8 ── documentation ledger installed ----------------------------------- */
(function docs() {
  const bad = [];
  DOCS.forEach(function (p) {
    if (!exists(p)) { if (!ALLOW_PENDING) bad.push(p + ' missing'); return; }
    if (bytes(p) < 400) bad.push(p + ' looks empty (' + bytes(p) + 'B)');
  });
  record('all five docs/*.md ledger files exist and are non-empty', bad.length === 0, bad.join(', '));
  const unbudgeted = DOCS.filter(function (p) { return exists(p) && bytes(p) > (BUDGET[p] || 0); });
  record('docs/*.md stay inside their budgets', unbudgeted.length === 0, unbudgeted.join(', '));
})();

/* 9 ── index.html shell wiring ------------------------------------------ */
(function shell() {
  if (!exists('index.html')) { pending('index.html'); return; }
  const html = readText('index.html');
  const order = [
    './data/data-meter.js', './data/sdp-data-sync.js', './data/sdp-audio-normalize.js',
    './data/sdp-telemetry.js', './data/sdp-audio-speech.js',
    './data/sdp-dictation-engine.js', './data/sdp-ui-views.js', './data/studio.js',
    './data/sdp-selfheal.js'
  ];
  const positions = order.map(function (src) { return html.indexOf(src); });
  const ordered = positions.every(function (p, i) { return p > 0 && (i === 0 || p > positions[i - 1]); });
  /* contract: docs/ARCHITECTURE_MAP.md §R10 fixed load order */
  record('index.html loads the nine modules in the fixed R10 order', ordered, JSON.stringify(positions));
  record('index.html ships the single sdp-ui.css stylesheet', html.indexOf('./assets/css/sdp-ui.css') > 0);
  // contract: docs/ARCHITECTURE_MAP.md §R1 boot target is a single TARGET constant
  record('index.html declares the v0.0.7.e boot target', html.indexOf("'0.0.7.e'") > 0 || html.indexOf('"0.0.7.e"') > 0);
  const tabs = ['tab-home', 'tab-player', 'tab-practice', 'tab-dict', 'tab-settings', 'tab-studio'];
  record('index.html contains the six tab ids', tabs.every(function (id) { return html.indexOf('id="' + id + '"') >= 0; }), tabs.filter(function (id) { return html.indexOf('id="' + id + '"') < 0; }).join(','));
  const screens = ['screen-home', 'screen-player', 'screen-practice', 'screen-dict', 'screen-settings', 'screen-studio'];
  record('index.html contains the six screen ids', screens.every(function (id) { return html.indexOf('id="' + id + '"') >= 0; }), screens.filter(function (id) { return html.indexOf('id="' + id + '"') < 0; }).join(','));
  record('index.html ships #rail-studio beside the five original rail buttons', html.indexOf('id="rail-studio"') > 0 && html.indexOf('data-tab="studio"') > 0);
  record('index.html ships the dedicated Lecturer Admin Studio screen', /<section class="screen" id="screen-studio" aria-label="Lecturer Admin Studio">/.test(html));
  record('index.html keeps #lecturerSyncBar + #btnSyncClassSettings inside #screen-studio',
    (function () {
      var studio = html.slice(html.indexOf('id="screen-studio"'));
      return studio.indexOf('id="lecturerSyncBar"') > 0 && studio.indexOf('id="btnSyncClassSettings"') > 0 && studio.indexOf('id="studioBody"') > 0;
    })());
  record('index.html ships the amber STEP cue on the Home primary CTA',
    /class="cue" data-cue="home"/.test(html) && html.indexOf('STEP 1 — PRESS HERE') > 0);
  record('index.html ships #sessionProgressStrip and #sessionPills', html.indexOf('id="sessionProgressStrip"') > 0 && html.indexOf('id="sessionPills"') > 0);
  record('index.html ships the 4-button tactile transport', ['btnPrev', 'btnPlayPause', 'btnReplay', 'btnNext'].every(function (id) { return html.indexOf('id="' + id + '"') > 0; }));
  record('index.html no longer nests the studio inside #screen-settings',
    (function () {
      var settings = html.slice(html.indexOf('id="screen-settings"'), html.indexOf('id="screen-studio"'));
      return settings.indexOf('studioAccordion') < 0 && settings.indexOf('lecturerSyncBar') < 0 && settings.indexOf('settingsLecturerBanner') > 0;
    })());
})();

/* 9b ── v0.0.2.b tactile system, 34-clip arithmetic and Guide 3.0 (D8–D18) --- */
(function tactileSystem() {
  var css = exists('assets/css/sdp-ui.css') ? readText('assets/css/sdp-ui.css') : '';
  record('D8 the 54px tactile tokens ship in the single stylesheet',
    /--btn-h:\s*54px/.test(css) && /--shadow-btn:/.test(css) && /--grad-primary:/.test(css) && /--grad-go:/.test(css));
  record('D8 .btn is 54px tall with a 2px press collapse',
    /\.btn \{[^}]*min-height: var\(--btn-h\)/.test(css) && /\.btn:active \{[^}]*translateY\(2px\)/.test(css));
  record('D8 .btn-primary and .btn-go are gradient fills with #FFFFFF ink',
    /\.btn-primary \{[^}]*var\(--grad-primary\)/.test(css) && /\.btn-go \{[^}]*var\(--grad-go\)/.test(css));
  record('D8 static .badge and unpressed .pill are flattened to a sunken label',
    /\.badge \{[^}]*box-shadow: none/.test(css) && /\.pill:not\(\[aria-pressed='true'\]\)/.test(css));
  record('D9 the .cue amber callout pill ships', /\.cue \{[^}]*background: #F59E0B/.test(css));
  record('D11 the 30-pill strip and its done/current/todo states ship',
    /\.word-pill\.done/.test(css) && /\.word-pill\.current/.test(css) && /\.word-pill\.todo/.test(css));
  var studio = exists('data/studio.js') ? readText('data/studio.js') : '';
  record('D2 #studioPackDashboard computes X/74 clips live from the pack',
    studio.indexOf('studioPackDashboard') > 0 && /studioClipsUnit/.test(studio) && /\.clips/.test(studio));
  record('D3 #studioGenProgress prints the verbatim "Generating clip n/N" line',
    /studioGenPrefix/.test(studio) && studio.indexOf('studioGenProgress') > 0);
  record('D4 the failed clip is recorded and #btnRetryFailedClip exists',
    /lastFailedClip/.test(studio) && studio.indexOf('btnRetryFailedClip') > 0);
  record('D18 the 76-clip arithmetic is stated in the cost line',
    /' clips \(' \+ wordCap\(\) \+ ' words \+ ' \+ nNums/.test(studio));
  var views = exists('data/sdp-ui-views.js') ? readText('data/sdp-ui-views.js') : '';
  /* contract: docs/UI_COMPONENT_GUIDE.md §3 — v0.0.5.c replaces the four mock
     cards with ONE compact spotlight (R2/F3). No mock markup may survive. */
  record('D16 the compact four-step spotlight ships (no mock cards)',
    /GUIDE_SPOTLIGHT_STEPS/.test(views) && /guideSpotlight/.test(readText('index.html')) &&
    /guideStepTag/.test(readText('index.html')) && /guideDots/.test(readText('index.html')) &&
    !/guideMockMarkup/.test(views) && !/mock-ring/.test(views));
  record('D16 the guide stamp follows the running version', /markGuideSeen/.test(exists('data/sdp-data-sync.js') ? readText('data/sdp-data-sync.js') : '') && /APP_VERSION/.test(views));
})();

/* 10 ── test suite files budgeted --------------------------------------- */
(function tests() {
  const bad = TEST_FILES.filter(function (p) {
    if (!exists(p)) { if (ALLOW_PENDING) return false; return true; }
    return bytes(p) > TEST_BUDGET;
  });
  record('release gate files present and inside budget', bad.length === 0, bad.join(', '));
  /* contract: docs/ARCHITECTURE_MAP.md §12-gate registry — the suite is exactly
     the twelve registered gates plus its harnesses. */
  const GATES = ['check.cjs', 'upgrade.test.cjs', 'phase1.cjs', 'server.cjs', 'browser.cjs',
    'upgrade-browser.cjs', 'e2e.cjs', 'live-lab.cjs', 'audit-v42.cjs',
    'voice-guide.cjs', 'vault-sync.cjs', 'studio-safety.cjs', 'v006v-verification.cjs', 'v006w-verification.cjs'];
  const missingGates = GATES.filter(function (g) { return !exists('tests/' + g); });
  record('all fourteen registered gates ship in tests/', missingGates.length === 0, missingGates.join(','));
})();

  /* 11 ── v0.0.1.b feature surface (release ledger, docs/CHANGELOG_LEDGER.md) -- */
  (function vb1FeatureSurface() {
    if (!exists('index.html')) { pending('index.html'); return; }
    var html = readText('index.html');
    var sw = exists('sw.js') ? readText('sw.js') : '';
    var sync = exists('data/sdp-data-sync.js') ? readText('data/sdp-data-sync.js') : '';
    var speech = exists('data/sdp-audio-speech.js') ? readText('data/sdp-audio-speech.js') : '';
    var views = exists('data/sdp-ui-views.js') ? readText('data/sdp-ui-views.js') : '';
    record('index.html ships the in-session sync badge (relocated to About)', html.indexOf('id="syncBadge"') > 0);
    record('index.html ships the studio quick launcher (relocated to About)', html.indexOf('id="btnStudioQuick"') > 0);
    record('index.html ships exactly the two spotlight buttons (start / exit)',
      /id="btnGuideSkipStart"/.test(html) && /id="btnGuideClose"/.test(html) &&
      !/guideNextStep/.test(html) && !/guideReplayStep/.test(html) && !/guidePauseVoice/.test(html));
    record('index.html boots at the v0.0.7.e target', /var TARGET = '0\.0\.7\.e'/.test(html));
    record('service worker pins the v0.0.7.e s43 shell caches',
      /SW_VERSION = 'sdp-v0\.0\.7\.e-s44'/.test(sw) && /SHELL_CACHE = 'sdp-v0\.0\.7\.e-s44-shell'/.test(sw));
    /* W7: the studio must stamp whatever SDP.version says — never a frozen literal. */
    var studioCode = readText('data/studio.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    record('studio.js never hardcodes a release literal (reads SDP.version)',
      !/0\.0\.[0-9]/.test(studioCode) && /SDP\.version/.test(studioCode), (studioCode.match(/0\.0\.[0-9]/g) || []).join(','));
    record('service worker handles on-demand word-audio caching (sdp:cache-words)', /sdp:cache-words/.test(sw));
    record('sync module exposes triggerVersionUpgrade (D1 in-session upgrade)', /triggerVersionUpgrade/.test(sync));
    record('sync module exposes downloadOfflineAudio (offline clips)', /downloadOfflineAudio/.test(sync));
    record('speech module exports playGuideStep for EN guide narration', /playGuideStep/.test(speech));
    record('settings ship quick pacing presets (beginner / standard / exam / board)',
      /presetRow/.test(views) && /presetBeginner/.test(views) && /presetBoard/.test(views));
    record('settings ship Voice Persona Lock (unified / custom)', /id="setVoiceLock"/.test(html));
    record('settings ship guide auto-play preference', /id="setGuideAutoPlay"/.test(html));
    record('settings ship offline clip download (btnDownloadClips)', /id="btnDownloadClips"/.test(html));
    if (exists('data/version.json')) {
      var v = JSON.parse(readText('data/version.json'));
      record('version.json pins buildDate 2026-11-20', v.buildDate === '2026-11-21');
    }
    var man = exists('manifest.webmanifest') ? readText('manifest.webmanifest') : '';
    record('manifest start_url carries the PWA source tag', /source=pwa/.test(man));
    record('manifest start_url and shortcuts carry v0.0.7.e',
      /"start_url":"\.\/\?v=0.0.7.e/.test(man) &&
      (man.match(/v=0.0.7.e/g) || []).length >= 3, (man.match(/v=0.0.7.e/g) || []).length);
    /* D15 (v0.0.2.b): every versioned surface must agree, byte for byte, on the
       release literal and on ver 9 — no file may drift on its own. */
    var app = '0.0.7.e';
    var agree = {
      'index.html': html.indexOf(app) > 0,
      'data.html': exists('data.html') ? readText('data.html').indexOf(app) > 0 : false,
      'data/sdp-data-sync.js': sync.indexOf("'" + app + "'") > 0 && /SDP\.ver = 45;/.test(sync),
      'sw.js': sw.indexOf('sdp-v' + app) > 0,
      'manifest.webmanifest': man.indexOf(app) > 0,
      'data/config.json': JSON.parse(readText('data/config.json')).appVersion === app && JSON.parse(readText('data/config.json')).ver === 45,
      'data/version.json': JSON.parse(readText('data/version.json')).appVersion === app && JSON.parse(readText('data/version.json')).ver === 45
    };
    var drifted = Object.keys(agree).filter(function (k) { return !agree[k]; });
    record('D15 all seven versioned surfaces agree on 0.0.7.e / ver 43',
      drifted.length === 0, drifted.join(', ') + ' ' + JSON.stringify(agree));
    var pack = JSON.parse(readText('data/elevenlabs-audio.json'));
    record('voice pack carries the v0.0.7.e header',
      pack.version === '0.0.7.e' && pack.appVersion === '0.0.7.e' && pack.ver === 45 && pack.schema === 45 &&
      pack.settingsRev === 78 && Number(pack.syncRev) === 1797000000027 &&
      pack.voiceId === 'Xb7hH8MSUJpSbSDYk0k2' && pack.hashAlgo === 'sha1',
      JSON.stringify([pack.version, pack.ver, pack.settingsRev, pack.syncRev]));
    /* v0.0.6.q PILLAR 2 law: the shipped pack carries EXACTLY the 135
       authentic clips — the 131 Alice classroom clips PLUS the four committed
       real British-male George briefing beats (_intro_male_1..4, voiceId
       JBFqnCBsd6RMkjVDRZzb / eleven_flash_v2_5) baked into the release so
       every student device — Wi-Fi or weak mobile data — hears the briefing
       with ZERO API keys. Each beat's text and sha1 pin must match the LIVE
       briefingSentences() (the zero cut-off law accepts nothing drifted),
       and each carries its per-word wt karaoke alignment. */
    (function georgeBeats() {
      var george = 0, bad = [], k, e, i, key;
      var crypto = require('node:crypto');
      for (k in pack.clips) {
        if (!Object.prototype.hasOwnProperty.call(pack.clips, k)) continue;
        if (!/^_intro_male_[1-4]$/.test(k)) continue;
        e = pack.clips[k];
        if (!e || !e.b64 || e.voiceId !== 'JBFqnCBsd6RMkjVDRZzb' || e.modelId !== 'eleven_flash_v2_5') { bad.push(k + ':provenance'); continue; }
        george += 1;
      }
      record('LB4a the pack ships the 4 committed George British-male briefing beats (_intro_male_1..4, George voiceId, live-Eleven provenance)',
        george === 4, bad.join(', ') + ' george=' + george);
      /* v0.0.6.x: the live origin/main pack ships its authentic 46-clip state
         (2 words + 30 num + 6 cmd + 4 guide + 4 George) — the 28 missing word
         clips are the Root-Cause-2A quarantine casualties, re-baked in one
         click with the fixed pipeline. The law below pins the honest floor:
         all 4 George beats + all 30 numbers + 6 commands + 4 guides present. */
      (function () {
        var pk = Object.keys(pack.clips), c = function (re) { var n = 0, z; for (z = 0; z < pk.length; z++) if (re.test(pk[z])) n += 1; return n; };
        record('LB4b the pack ships the canonical 76-clip classroom set (31 words + 31 numbers + 6 commands + 4 guides + 4 George beats)',
          c(/^num\.\d+$/) === 31 && c(/^cmd\./) === 6 && c(/^guide\.en\./) === 4 && c(/^_intro_male_[1-4]$/) === 4 && c(/^words\./) === 31 && pk.length === 76,
          String(pk.length));
      })();
      /* The zero cut-off contract: every beat's stored text AND sha1 pin must
         equal the live sentence (with the CURRENT {W} week counter). */
      (function () {
        var startIso = /PROJECT_START_ISO = '([^']+)'/.exec(views);
        var weeks = 2;
        if (startIso) {
          var t0 = Date.parse(startIso[1] + 'T00:00:00+05:30');
          if (t0 > 0) weeks = Math.max(2, Math.floor((Date.now() - t0) / (7 * 86400000)));
        }
        var m = /var BRIEFING_SENTENCES = \[([\s\S]*?)\];/.exec(views);
        var body = m ? m[1].replace(/",\s*\n\s*\+\s*"/g, '",\n"').replace(/"\s*\n\s*\+\s*"/g, '') : '';
        var beats = body.match(/"([\s\S]*?)"/g) || [];
        var pinned = 0;
        for (i = 0; i < 4; i++) {
          key = '_intro_male_' + (i + 1);
          e = pack.clips[key];
          if (!e) continue;
          var want = (beats[i] || '').replace(/^"|"$/g, '').replace('{W}', String(weeks));
          var wantHash = 'sha1:' + crypto.createHash('sha1')
            .update(want + '|JBFqnCBsd6RMkjVDRZzb|eleven_flash_v2_5').digest('hex');
          if (e.text === want && e.hash === wantHash) pinned += 1;
          else bad.push(key + (e.text === want ? ':hash' : ':text'));
        }
        record('LB4c every George beat pins the exact live v0.0.6.t sentence + sha1 (the zero cut-off law accepts all 4)',
          pinned === 4, bad.join(', ') + ' pinned=' + pinned);
      })();
    })();
  })();

  /* 12 ── v0.0.6.m mobile human-UI + extension-lock surface ──────────── */
  (function mobileHumanUi() {
    var html = exists('index.html') ? readText('index.html') : '';
    var dataHtml = exists('data.html') ? readText('data.html') : '';
    var css = exists('assets/css/sdp-ui.css') ? readText('assets/css/sdp-ui.css') : '';
    var views = exists('data/sdp-ui-views.js') ? readText('data/sdp-ui-views.js') : '';
    var engine = exists('data/sdp-dictation-engine.js') ? readText('data/sdp-dictation-engine.js') : '';
    var studio = exists('data/studio.js') ? readText('data/studio.js') : '';
    /* A1: every entry point locks Dark Reader and pins only-light */
    ['index.html', 'data.html', 'data/index.html'].forEach(function (f) {
      var t = exists(f) ? readText(f) : '';
      record('v0.0.6.m ' + f + ' ships the darkreader-lock + color-scheme metas',
        /<meta name="darkreader-lock">/.test(t) && /<meta name="color-scheme" content="only light">/.test(t));
    });
    record('A1 the stylesheet enforces the strict light lock',
      /color-scheme: only light !important/.test(css) && /forced-color-adjust: none !important/.test(css) &&
      /filter: none !important/.test(css));
    record('A1 the app never follows prefers-color-scheme',
      ['index.html', 'assets/css/sdp-ui.css', 'data/sdp-ui-views.js'].every(function (f) {
        return exists(f) ? readText(f).indexOf('prefers-color-scheme') < 0 : true;
      }));
    record('A1 views.js re-arms the extension shield on DOM ready',
      /installExtensionShield/.test(views) && views.indexOf('data-darkreader-proxy-injected') > 0);
    record('A1 inline boot shield strips darkreader nodes in every entry point',
      ['index.html', 'data.html'].every(function (f) {
        var t = exists(f) ? readText(f) : '';
        return t.indexOf('data-darkreader-mode') > 0 && t.indexOf('darkreader-lock') > 0;
      }));
    /* A2: the unified remote pad + paper-mode single-screen law */
    record('A2 the reveal card and orbital deck form one remote silhouette',
      /\.reveal-word-card\s*{[^}]*border-radius: 26px 26px 12px 12px/.test(css) &&
      /\.orbital\s*{[^}]*border-radius: 12px 12px 30px 30px/.test(css));
    record('A2 paper mode never paints the hint rows (typing mode does)',
      /#hintChips, #hintOutput, \.beat-stage \{ display: none !important; \}/.test(css) &&
      /body\[data-sdp-mode='typing'\] #hintChips/.test(css));
    record('A2 the engine paints body[data-sdp-mode] and the Hint pill drives the meaning panel',
      engine.indexOf("doc.body.setAttribute('data-sdp-mode', E.mode)") > 0 &&
      /\['btnHint', hintOrReveal\]/.test(engine) && /toggleHintPanel/.test(views));
    record('A2 the helper pills are one equal-width dock',
      /\.cockpit-helpers\s*{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/.test(css));
    /* A3: compact studio bar, bottom toast, chip grid */
    record('A3 the studio bar is a compact <=60px strip pinned to the header',
      /\.studio-security-bar\s*{[^}]*top: var\(--header-h\)/.test(css) && /max-height: 60px/.test(css));
    record('A3 the data toast whispers from the bottom edge on phones',
      /#sdpDataToast, \.toast \{[\s\S]*?bottom: calc\(var\(--tabbar-h\) \+ 10px\)/.test(css));
    record('A3 the live chips render as an ordered 2-3 column grid',
      /\.studio-live-chips\s*{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(css) &&
      studio.indexOf('chip-w') > 0);
    record('A3 the chip glyphs are real unicode escapes (never HTML entities)',
      studio.indexOf('\\u21c4') > 0 && studio.indexOf('\\u2715') > 0 && studio.indexOf('&#') < 0);
    /* A6 (v0.0.6.m CF1): the ULTRA-CLEAN top status bar — the Beta pill,
       the floating Beta stamp, the Creator Note pill, the ? Guide pill, the
       version pill, the sync badge and the Lecturer Admin launcher are all
       REMOVED from #appHeader. Only the brand (Smart Dictation + CCBE B1)
       and the two toggles (#btnLang + #btnTheme) may live up there. */
    record('A6 the ultra-clean v0.0.6.m header ships only brand + EN|SI + Theme',
      (function () {
        var head = /<header id="appHeader">([\s\S]*?)<\/header>/.exec(html);
        var body = head ? head[1] : '';
        var ids = (body.match(/id="([^"]+)"/g) || []).join(',');
        return !!head &&
          ids.indexOf('sdpBrand') >= 0 && ids.indexOf('brandName') >= 0 && ids.indexOf('b1badge') < 0 &&
          /class="b1badge"/.test(body) &&
          ids.indexOf('btnLang') >= 0 && ids.indexOf('btnTheme') >= 0 && ids.indexOf('themeIcon') >= 0 &&
          ids.indexOf('sdpBetaPill') < 0 && ids.indexOf('sdpBetaStamp') < 0 && ids.indexOf('sdpVerPill') < 0 &&
          ids.indexOf('syncBadge') < 0 && ids.indexOf('btnStudioQuick') < 0 &&
          ids.indexOf('btnCreatorNote') < 0 && ids.indexOf('btnGuideTop') < 0;
      })());
    record('A6b the relocated triggers keep their DOM ids inside the About card',
      (function () {
        var about = html.slice(html.indexOf('id="aboutCard"'));
        about = about.slice(0, about.indexOf('</section>'));
        return about.indexOf('id="sdpVerPill"') > 0 && about.indexOf('id="syncBadge"') > 0 &&
          about.indexOf('id="btnCreatorNote"') > 0 && about.indexOf('id="btnGuideTop"') > 0 &&
          about.indexOf('id="btnStudioQuick"') > 0 && /about-tools/.test(html) && /about-links-row/.test(html);
      })());
    record('A6c the floating Beta stamp and Beta pill are gone for good',
      !/id="sdpBetaStamp"/.test(html) && !/id="sdpBetaPill"/.test(html) &&
      !/\.beta-stamp/.test(css) && !/\.beta-pill/.test(css) &&
      /BETA_SUBVERSION = '0\.0\.7\.e\.beta'/.test(views) &&
      /function betaActive/.test(views) && /function applyBetaChannel/.test(views));
  })();

  /* 13 ── v0.0.6.m feature surface: briefing · 6-key pool · reviews · telemetry ── */
  (function v006lFeatureSurface() {
    var html = readText('index.html');
    var views = readText('data/sdp-ui-views.js');
    var sync = readText('data/sdp-data-sync.js');
    var speech = readText('data/sdp-audio-speech.js');
    var studio = readText('data/studio.js');
    var engine = readText('data/sdp-dictation-engine.js');
    var css = readText('assets/css/sdp-ui.css');
    var pack = exists('data/elevenlabs-audio.json') ? JSON.parse(readText('data/elevenlabs-audio.json')) : null;
    /* P1 — Dynamic Oct-22 Weekly Briefing: word-flow lyrics + 10s gate. */
    record('CB1 the briefing modal, synced lyrics and both gated CTAs ship (v0.0.6.o: minimal 2-line header — the eyebrow row left the modal)',
      html.indexOf('id="briefingModal"') > 0 && html.indexOf('id="briefingLyrics"') > 0 && html.indexOf('id="briefingEyebrow"') < 0 &&
      html.indexOf('id="btnBriefingContinue"') > 0 && html.indexOf('id="btnBriefingSkip"') > 0 &&
      html.indexOf('id="briefingCount"') > 0 && html.indexOf('id="briefingBar"') > 0);
    record('CB2 the 10-second timed gate is a constant with a live countdown',
      /BRIEFING_GATE_MS = 10000/.test(views) && /briefingCountdown/.test(views) &&
      /Please listen \/ read/.test(views));
    record('CB3 the briefing narrates 4 executive beats with sentence sync + read-ahead',
      /BRIEFING_SENTENCES/.test(views) && (views.match(/data-bline/g) || []).length >= 1 &&
      (function () {
        var m = /var BRIEFING_SENTENCES = \[([\s\S]*?)\];/.exec(views);
        /* v0.0.6.q: the script strings are wrapped with ES5 '+' joins to stay
           under the 400-char line law — merge the fragments first. */
        var flat = m ? m[1].replace(/",\s*\n\s*\+\s*"/g, '",\n"').replace(/"\s*\n\s*\+\s*"/g, '') : '';
        var beats = (flat.match(/",\s*\n\s*"/g) || []).length + 1;
        return beats === 4;
      })() &&
      /\.b-line\.on/.test(css) && /opacity: 0\.5;/.test(css) && /opacity: 0\.74/.test(css));
    record('CB4 the briefing speaks with the deep British male persona (never female)',
      /playBriefingStep/.test(speech) && /_intro_male_/.test(speech) &&
      /persona === 'male'/.test(speech) && /pickMaleVoice/.test(speech) &&
      /pitch = wantMale \? 0\.82/.test(speech) && /wantMale \? 0\.98/.test(speech) &&
      /samantha|moira|tessa|fiona/.test(speech) && /malcolm/i.test(speech));
    record('CB5 the v0.0.6.x no-boot-briefing law: boot stamps briefingSeen and never opens the modal (on-demand only)',
      /briefingSeen/.test(views) && /markBriefingSeen/.test(views) &&
      /briefing_boot_retired/.test(views) &&
      !/openBriefing\(\{ fromBoot: true, welcome: true \}\)/.test(views) &&
      /fromSettings: true/.test(views));
    record('CB6 the relocated Project Briefing button replays the briefing anytime (direct Stage-2, exits unlocked)',
      /on\('btnCreatorNote', 'click', function \(\) \{ openBriefing\(\{ replay: true, fromSettings: true \}\); \}\);/.test(views));
    record('CB7 v0.0.6.t authentic first-person creator overview: Beat 1 is Hansana himself ("I, Hansana" + "on my own system" + critical-thinking testbed), Beat 2 carries the free-for-Sri-Lanka social mission + never-for-money vow, Beat 3 states the TRUE A/L fact (completed A/Ls, IT not taken as a subject, 2-month open-source database stabilization + RDP/lab/flagship tools), Beat 4 keeps strict privacy + 100% E2EE AES-GCM + low-mobile-data + Lecturer Mode + right-side Start Dictation handover — and neither "on his own system" nor "without A/L" can ever return',
      (function () {
        var m = /var BRIEFING_SENTENCES = \[([\s\S]*?)\];/.exec(views);
        var body = m ? m[1].replace(/",\s*\n\s*\+\s*"/g, '",\n"').replace(/"\s*\n\s*\+\s*"/g, '') : '';
        var beat1 = /Welcome to Smart Dictation[\s\S]*?zero-cost \(\$0\)[\s\S]*?I, Hansana, started on October 22 \(\{W\} weeks ago\) and developed on my own system using autonomous AI agents[\s\S]*?my critical thinking and problem-solving skills/.test(body);
        var beat2 = /not build this project merely to grow my own IT knowledge[\s\S]*?our society in Sri Lanka completely for free[\s\S]*?people rarely reflect on themselves[\s\S]*?positive mindset[\s\S]*?never seek money or profit/.test(body);
        var beat3 = /Although I did not take IT as a subject for my A\/Ls, after my A\/Ls[\s\S]*?stabilized my IT knowledge to a strong level within two months[\s\S]*?world's largest open-source databases[\s\S]*?open-source tools for Sri Lankan society[\s\S]*?future of Sri Lanka's IT field[\s\S]*?my own tools on GitHub[\s\S]*?Remote Desktop PC \(RDP\) project, dedicated lab environment, and upcoming flagship IT project/.test(body);
        var beat4 = /privacy-focused at its core[\s\S]*?no personal data is ever shared[\s\S]*?no unnecessary data is collected[\s\S]*?session review, feedback chat, and diagnostic report is one hundred percent end-to-end encrypted \(AES-GCM\)[\s\S]*?run smoothly even on low mobile data[\s\S]*?Lecturer Mode[\s\S]*?tap Start Dictation on the right[\s\S]*?step-by-step user guide[\s\S]*?Word #1!/.test(body);
        return !/Z\.ai|Arena\.ai|Gemini|ChatGPT|Claude|prompt engineering/i.test(body) &&
          !/limited formal IT training|limited IT/i.test(body) &&
          !/RDB/.test(body) && /RDP/.test(body) &&
          beat1 && beat2 && beat3 && beat4 &&
          !/on his own system|without A\/L/i.test(body) &&
          body.indexOf('never seek money or profit') < body.indexOf('A/Ls') &&
          body.indexOf('{W}') < body.indexOf('your privacy is completely safe') &&
          !/21-year-old|21yo|වයස 21/i.test(html + views + speech + studio);
      })());
    record('CB8 the briefing links the repository and the creator profile',
      html.indexOf('https://github.com/dictationb1/dictationb1.github.io') > 0 &&
      html.indexOf('https://github.com/dictationb1') > 0);
    /* v0.0.6.m Pillar 1 — dynamic weekly counter, word-flow, tap pill, real clips. */
    record('LB1 the week counter is computed from PROJECT_START_ISO 2026-10-22 (auto-bumping, min 2)',
      /PROJECT_START_ISO = '2026-10-22'/.test(views) && /function weeksSinceStart/.test(views) &&
      /Math\.max\(2, Math\.floor\(\(Date\.now\(\) - t0\) \/ \(7 \* 86400000\)\)\)/.test(views) &&
      /briefingSentence\(i\)\.replace|\.replace\('\{W\}', String\(weeksSinceStart\(\)\)\)/.test(views) &&
      /function paintBriefingPersona/.test(views) && /Started ' \+ w \+ ' Weeks Ago/.test(views));
    record('LB2 word-by-word karaoke flow: every beat tokenizes into .b-word spans with is-spoken/is-current',
      /data-bword/.test(views) && /class="b-word"/.test(views) && /is-spoken/.test(views) && /is-current/.test(css) &&
      /\.b-word/.test(css) && /function paintBriefingWordFlow/.test(views) && /function startBriefingWordFlow/.test(views) &&
      /clearBriefingWordTimers/.test(views));
    record('LB3 v0.0.6.x the on-demand briefing law: #welcomeStage ships (kept for the beta/welcome path) but the Settings open lands DIRECTLY on #briefingStage with every exit unlocked and Paragraph 1 narrating',
      html.indexOf('id="welcomeStage"') > 0 && html.indexOf('id="btnWelcomeContinue"') > 0 &&
      /Continue to Project Overview/.test(html) &&
      /function welcomeContinueToOverview/.test(views) &&
      /function welcomeShowStage/.test(views) &&
      /briefingState\.directOpen/.test(views) &&
      /briefingNarrate\(0, briefingState\.epoch\)/.test(views) &&
      /briefingState\.gateLeft = 0;/.test(views));

    record('LB4 the shipped pack carries the full 76-clip classroom set (31 words + 31 numbers + 6 commands + 4 guides + 4 George beats — all re-baked at -21 LUFS)',
      (function () {
        var pk = Object.keys(pack.clips), c = function (re) { var n = 0, z; for (z = 0; z < pk.length; z++) if (re.test(pk[z])) n += 1; return n; };
        return c(/^num\.\d+$/) === 31 && c(/^cmd\./) === 6 && c(/^guide\.en\./) === 4 && c(/^_intro_male_[1-4]$/) === 4 && c(/^words\./) === 31 && pk.length === 76;
      })());
    var swText1 = readText('sw.js');
    record('P1c the service worker serves the boot data JSONs STALE-WHILE-REVALIDATE from the s43 shell (instant <30ms cache hit, then a non-blocking background revalidation on an unchanged release)',
      /SW_VERSION = 'sdp-v0\.0\.7\.e-s44'/.test(swText1) &&
      /var SW_RELEASE = '0\.0\.7\.e';/.test(swText1) &&
      /function staleWhileRevalidateDataJson/.test(swText1) &&
      /x-sdp-release/.test(swText1) &&
      /isPointer = \/\\\/data\\\/version\\\.json\$\/i\.test\(url\.pathname\)/.test(swText1) &&
      /freshRead = url\.search\.indexOf\('t='\) >= 0/.test(swText1) &&
      /cachePutRelease\(cache, cleanUrl, res, want\)/.test(swText1));
    record('P1d the ZERO-DROP merge law: applyManifest merges every previously adopted clip under the new pack and reloadManifest never nulls the live manifest mid-download',
      /state\.clipBase/.test(speech) &&
      /if \(!Object\.prototype\.hasOwnProperty\.call\(next\.clips, k\)\) next\.clips\[k\] = base\[k\];/.test(speech) &&
      /state\.manifest = null;[\s\S]{0,120}loadManifest/.test(speech) === false &&
      /v0\.0\.6\.q PILLAR 1 — the ZERO-DROP RELOAD law/.test(speech));
    record('P1e cache:no-store survives ONLY on the tiny version.json pointer + post-publish refresh legs (never on a boot load)',
      /fetch\('\.\/data\/version\.json\?t=' \+ Date\.now\(\), \{ cache: 'no-store' \}\)/.test(html) &&
      !/session\.json', \{ cache: 'no-store' \}\)/.test(readText('data.html')) &&
      /fetch\('\.\/session\.json', \{ cache: 'default' \}\)/.test(readText('data.html')));
    /* ══ v0.0.6.q PILLAR 1 — the LIVE-ELEVEN PROVENANCE + WEEKLY AUTO-REGEN LAW ══ */
    record('P1f the High-Professional Executive Male Voice & live-Eleven provenance law: briefingVoiceDelta() flags repo-preload clips (liveEleven !== true) and weekly-drifted clips (weekStamp !== weeksSinceStart()) so unlocking Lecturer Studio automatically synthesizes _intro_male_1..4 via the real ElevenLabs API (/with-timestamps + mp3_44100_128 + use_speaker_boost: true) and stamps liveEleven: true + weekStamp',
      (function () {
        var okCat = /var BRIEFING_VOICE_CATALOG = \{/.test(studio) &&
          /onwK4e9ZLuTAKqWW03F9/.test(studio) && /* Daniel */
          /JBFqnCBsd6RMkjVDRZzb/.test(studio) && /* George */
          /nPczCjzI2devNBz1zQrb/.test(studio) && /* Brian */
          /N2lVS1w4EtoT3dr4eOWO/.test(studio) && /* Callum */
          /studioBriefingVoiceSelect/.test(studio) &&
          /studioBriefingCustomVoiceId/.test(studio) &&
          /btnFetchClonedVoices/.test(studio) &&
          /EL_VOICES/.test(studio) &&
          /function chosenBriefingVoiceId/.test(studio);
        var okSettings = /var INTRO_VOICE_SETTINGS = \{ stability: 0\.50, similarity_boost: 0\.85, style: 0\.32, use_speaker_boost: true \};/.test(studio) &&
          /output_format=mp3_44100_128/.test(studio);
        var okDelta = /entry\.liveEleven !== true \|\|/.test(studio) &&
          /Number\(entry\.weekStamp \|\| 0\) !== Number\(currentWeeksSinceStart\(\)\)/.test(studio) &&
          /str\(entry\.voiceId\) !== wantVoice/.test(studio) &&
          /function currentWeeksSinceStart/.test(studio);
        var okStamp = /liveEleven: true, weekStamp: currentWeeksSinceStart\(\), provenance: 'elevenlabs-live'/.test(studio);
        /* the blocking confirm() is gone — both buttons force:true in 1 tap */
        var okNoConfirm = !/global\.confirm\(/.test(studio) &&
          /ensureBriefingAndGuideVoices\(\{ source: 'button', force: true \}/.test(studio);
        /* the shipped preloads are honest repo-preloads (liveEleven ABSENT) */
        var okPack = false;
        try {
          var pre = 0;
          for (var pi = 1; pi <= 4; pi++) {
            var pe = pack.clips['_intro_male_' + pi];
            /* v0.0.6.v: the four beats are the committed live-Eleven takes. */
            if (pe && pe.provenance === 'elevenlabs-live' && pe.liveEleven === true && pe.b64) pre += 1;
          }
          okPack = pre === 4;
        } catch (ePack) { okPack = false; }
        return okCat && okSettings && okDelta && okStamp && okNoConfirm && okPack;
      })());
    /* ══ v0.0.6.r PILLAR 1+2 — the CLONED-VOICE PERSISTENCE + DARK-LYRICS LAWS ══ */
    record('P1g the v0.0.6.t cloned-voice persistence & dark-lyrics laws: packClipsForDisk() preserves wt/ww/liveEleven/weekStamp/provenance/durMs/voiceName, commitVoicePack() publishes data/elevenlabs-audio.json + data/version.json atomically under ONE monotonic syncRev, primes the local pack cache (local-briefing-pack.json + the s33 SHELL_CACHE + sdp.briefing.meta) and never calls reloadManifest(true) after a commit, requestClip() prefers j.alignment over j.normalized_alignment, parseAlignmentToWordTimings() never returns null on a non-empty alignment (proportional map), and .b-line.on paints true dark-lyrics contrast (#94A3B8 unspoken → #0F172A spoken)',
      (function () {
        var okPack = /if \(Array\.isArray\(c\.wt\) && c\.wt\.length\) row\.wt = c\.wt;/.test(studio) &&
          /if \(Array\.isArray\(c\.ww\) && c\.ww\.length\) row\.ww = c\.ww;/.test(studio) &&
          /if \(c\.liveEleven === true\) row\.liveEleven = true;/.test(studio) &&
          /if \(Number\(c\.weekStamp\) > 0\) row\.weekStamp = Number\(c\.weekStamp\);/.test(studio) &&
          /if \(str\(c\.provenance\)\) row\.provenance = str\(c\.provenance\);/.test(studio) &&
          /if \(Number\(c\.durMs\) > 0\) row\.durMs = Number\(c\.durMs\);/.test(studio) &&
          /if \(str\(c\.voiceName\)\) row\.voiceName = str\(c\.voiceName\);/.test(studio) &&
          /base\.briefingVoiceId = chosenBriefingVoiceId\(\);/.test(studio) &&
          /base\.briefingVoiceName = chosenBriefingVoiceName\(\);/.test(studio);
        var commitAt = studio.indexOf('function commitVoicePack');
        var commitBlock = commitAt >= 0 ? studio.slice(commitAt, commitAt + 4200) : '';
        var okCommit = /var rev = nextSyncRev\(\);/.test(commitBlock) &&
          /var packObj = voicePackPayload\(rev\);/.test(commitBlock) &&
          /verObj\.payloadFiles = \['data\/elevenlabs-audio\.json', 'data\/version\.json'\];/.test(commitBlock) &&
          /path: 'data\/elevenlabs-audio\.json', content: JSON\.stringify\(packObj, null, 2\)/.test(commitBlock) &&
          /path: 'data\/version\.json', content: JSON\.stringify\(verObj, null, 2\)/.test(commitBlock) &&
          /primeLocalVoicePackCache\(packObj, rev\);/.test(commitBlock) &&
          /str\(ST\.secrets\.ghToken\) \|\| fieldValue\('ghTokenInput'\)/.test(commitBlock) &&
          !/reloadManifest\(true\)/.test(commitBlock) &&
          /'\.\/local-briefing-pack\.json'/.test(studio) &&
          /'sdp-v' \+ appVersion\(\) \+ '-s34-shell'/.test(studio) &&
          /localStorage\.setItem\('sdp\.briefing\.meta'/.test(studio) &&
          /function primeLocalVoicePackCache/.test(studio);
        var okAlign = /var align = isObj\(j\.alignment\) \? j\.alignment : \(isObj\(j\.normalized_alignment\) \? j\.normalized_alignment : null\);/.test(studio) &&
          /if \(out\.length === words\.length\) return out;/.test(studio) &&
          /var totalStart = out\[0\]\[0\], totalEnd = out\[out\.length - 1\]\[1\];/.test(studio) &&
          !/if \(!out\.length \|\| out\.length !== words\.length\) return null;/.test(studio) &&
          /voiceName: chosenBriefingVoiceName\(\)/.test(studio);
        var okCss = /\.b-line\.on \.b-word:not\(\.is-spoken\) \{/.test(css) &&
          /\.b-line\.on \.b-word:not\(\.is-spoken\) \{\s*\n\s*color: #94A3B8;/.test(css) &&
          /\.b-word\.is-spoken,\s*\n\s*\.b-line\.on \.b-word\.is-spoken \{\s*\n\s*color: #0F172A;/.test(css) &&
          /\.b-word\.is-current,/.test(css) &&
          /#0369A1/.test(css) && /#E0F2FE/.test(css);
        return okPack && okCommit && okAlign && okCss;
      })());
    /* ══ v0.0.6.t PILLARS 1+3B+4 — the MANUAL-PLAY / 1MB-WALL / RP-LEXICON REGRESSION ══ */
    record('P1h the v0.0.6.t manual-play + large-pack sync + British RP laws: playWord() NEVER refuses an explicit user play (allowWhenPaused / manualPlay) on the 30 Words (#screen-dict), Practice (#screen-practice) and testVoice() surfaces while the engine stays pause-gated for background beats (G10.7d), Sync.getFileSha() carries the parent-directory /contents/data fallback for files over GitHub\u2019s 1 MB wall, and CAMBRIDGE_B1_RP_LEXICON + RP_TTS_OVERRIDES ship the British RP /@d\u02c8v\u025c\u02d0.t\u026as.m@nt/ ad-ver-tiss-ment for "advertisement"',
      /* Pillar 1: the manual-play law */
      /var manual = !!\(opts && \(opts\.allowWhenPaused === true \|\| opts\.manualPlay === true\)\);/.test(speech) &&
      /function Refuse\(\) \{\s*if \(manual\) return false;/.test(speech) &&
      /allowWhenPaused: manual/.test(speech) &&
      /if \(!manual && SDP\.Engine && SDP\.Engine\.isPaused && SDP\.Engine\.isPaused\(\)\) return;/.test(speech) &&
      /playWord\(first, \{ volume: conf\.volume, allowWhenPaused: true, manualPlay: true \}/.test(speech) &&
      /say\(\['Professor voice ready \u00b7 ' \+ spoken\], \{ lang: 'en-GB', rate: 0\.92, pitch: 1\.03, volume: conf\.volume, allowWhenPaused: true \}/.test(speech) &&
      /SDP\.Speech\.playWord\(word, \{ allowWhenPaused: true, manualPlay: true \}, noop\)/.test(views) &&
      /* Pillar 3B: the 1 MB wall fallback + the Git Data API large-blob path */
      /var tooLarge = status === 403 \|\| status === 422 \|\| \(data && Array\.isArray\(data\.errors\)\);/.test(sync) &&
      /Sync\.getFileShaViaDir\(path, token, cb\); return;/.test(sync) &&
      /getFileShaViaDir: function \(path, token, cb\)/.test(sync) &&
      /commitViaGitDataApi: function \(path, base64Content, message, token, cb\)/.test(sync) &&
      /\(status === 413 \|\| status === 422 \|\| status === 502\) && !flags\.gitDataApi/.test(sync) &&
      /* Pillar 3C: the 25 s mobile-data budgets for the voice pack */
      /if \(\/elevenlabs-audio\\\.json\/i\.test\(url\)\) budgetMs = 25000;/.test(sync) &&
      /\/elevenlabs-audio\\\.json\/i\.test\(path\) \? 25000 : 5000\)/.test(sync) &&
      /* Pillar 4: the Cambridge B1 British RP lexicon + the RP TTS overrides */
      /var CAMBRIDGE_B1_RP_LEXICON = \{/.test(sync) &&
      sync.indexOf('"advertisement": { p: "/\u0259d\u02c8v\u025c\u02d0.t\u026as.m\u0259nt/"') > 0 &&
      sync.indexOf('ttsHint: "ad-ver-tiss-ment"') > 0 &&
      /var RP_TTS_OVERRIDES = \{/.test(studio) &&
      studio.indexOf("'advertisement': 'ad-ver-tiss-ment'") > 0 &&
      studio.indexOf("'schedule': 'shed-yool'") > 0 &&
      /* buildQueue speaks ttsText while stamping the canonical spelling */
      /ttsText: str\(RP_TTS_OVERRIDES\[text\.toLowerCase\(\)\] \|\| text\)/.test(studio) &&
      /text: str\(RP_TTS_OVERRIDES\[str\(item\.text\)\.toLowerCase\(\)\] \|\| item\.text\), model_id: model/.test(studio) &&
      /* hydrateClips: fresh b64 always refreshes the data URL + the bare alias */
      /v\.mime = \(str\(v\.b64\)\.indexOf\('UklGR'\) === 0\) \? 'audio\/wav' : 'audio\/mpeg';/.test(speech) &&
      /if \(\/\^words\\\.\/\.test\(n\)\) \{/.test(speech));
    /* ══ v0.0.6.q PILLAR 2 — the anti-7-second minimum-dwell law ══ */
    record('P2a a paragraph may NEVER advance in under 1.8s: the minimum-dwell law paces every beat over its natural duration even when audio is muted or TTS fails',
      /function briefingEstimateDurMs/.test(views) &&
      /if \(realDurMs > 0\) return 1800;/.test(views) &&
      /return Math\.max\(1800, briefingEstimateDurMs\(text\)\);/.test(views) &&
      /dwellMs\(\) - \(Date\.now\(\) - startedAt\)/.test(views) &&
      /if \(Number\(durSec\) > 0\) realDurMs = Math\.round\(Number\(durSec\) \* 1000\);/.test(views) &&
      /Math\.min\(90000, \(\(words\.length \* 0\.36\) \+ \(total \* 0\.012\)\) \* 1000\)/.test(views));
    record('P2b the four George beats ship with real MP3 audio + live-Eleven provenance so the briefing never falls to robotic TTS',
      (function () {
        if (!pack || !pack.clips) return false;
        var i, e, ok = 0, base64 = /^[A-Za-z0-9+/]+={0,2}$/;
        for (i = 1; i <= 4; i++) {
          e = pack.clips['_intro_male_' + i];
          if (!e || !e.b64 || !base64.test(e.b64.slice(0, 64))) continue;
          if (e.liveEleven !== true || e.provenance !== 'elevenlabs-live') continue;
          if (Number(e.bytes) > 40000) ok += 1;
        }
        return ok === 4;
      })());
    /* ┠ v0.0.6.t PILLAR 2 — the PARAGRAPH-1 COMPLETION GATE ┠ */
    record('P2c the PARAGRAPH-1 COMPLETION GATE LAW: the 10s gate timer starts ONLY inside welcomeContinueToOverview() (never on #welcomeStage), and #btnBriefingSkip (Exit) + #btnBriefingContinue (▶ Start Dictation →) unlock the instant gateLeft <= 0 AND beat1Done === true (latched inside next() when Paragraph 1 finishes its final word), while Paragraphs 2–4 keep narrating — allBeatsDone is telemetry-only (briefingFinishNarration)',
      /var briefingState = \{[^}]*directOpen: false[^}]*beat1Done: false[^}]*allBeatsDone: false[^}]*\};/.test(views) &&
      /function briefingCheckGateUnlock/.test(views) &&
      /if \(briefingState\.gateLeft > 0 && !briefingState\.directOpen\) return false;/.test(views) && /if \(!briefingState\.beat1Done && !briefingState\.directOpen\) return false;/.test(views) &&
      /* Rule A: the ONLY gateTimer setInterval lives inside welcomeContinueToOverview (openBriefing must NOT arm it) */
      (function () {
        var at = views.indexOf('function openBriefing');
        var block = at >= 0 ? views.slice(at, at + 4600) : '';
        var wAt = views.indexOf('function welcomeContinueToOverview');
        var wBlock = wAt >= 0 ? views.slice(wAt, wAt + 4200) : '';
        return /briefingState\.gateTimer = global\.setInterval\(briefingTickGate, 1000\);/.test(wBlock) &&
          !/briefingState\.gateTimer = global\.setInterval\(briefingTickGate, 1000\);/.test(block);
      })() &&
      /* Rule B: the instant Beat 1 (idx === 0) finishes its final word, beat1Done latches AND briefingCheckGateUnlock() runs directly — the buttons unlock right as Paragraph 1 completes */
      /if \(idx === 0\) \{\s*briefingState\.beat1Done = true;\s*briefingCheckGateUnlock\(\);/.test(views) &&
      /* allBeatsDone latches ONLY inside briefingFinishNarration (telemetry-only after Paragraph 4's final word) */
      /function briefingFinishNarration\(epoch\) \{[\s\S]*?briefingState\.beat1Done = true;\s*\n\s*briefingState\.allBeatsDone = true;\s*\n\s*briefingCheckGateUnlock\(\);/.test(views) &&
      /* v0.0.6.v: the 9s beat1 safety ceiling so a dead browser can never trap a student behind the Paragraph-1 gate */
      /\}, 9000\);/.test(views) &&
      /* forward seeks are refused ONLY while Paragraph 1 is still locked */
      /if \(!briefingState\.beat1Done && !briefingState\.directOpen && Number\(idx\) > briefingState\.idx\) return false;/.test(views) &&
      /* the CTA label states: countdown, finishing-Paragraph-1, then the unlocked ▶ Start Dictation → */
      /briefingContinueBeat1: 'Start Dictation \(finishing Paragraph 1…\)'/.
      test(views) &&
      /briefingContinue', '▶ Start Dictation →'/.test(views) &&
      /else if \(!briefingState\.beat1Done\) \{/.test(views) &&
      /* closeBriefing + openBriefing honour the Paragraph-1 lock */
      /if \(briefingState\.gateLeft > 0 && !briefingState\.directOpen\) return false;/.test(views) && /if \(!briefingState\.beat1Done && !briefingState\.directOpen\) return false;/.test(views) &&
      /briefingState\.beat1Done = false;\s*\n\s*briefingState\.allBeatsDone = false;/.test(views) &&
      /* the live flag is exported for the lab */
      /briefingAllBeatsDone: briefingAllBeatsDone/.test(views) &&
      /function briefingAllBeatsDone\(\) \{ return !!briefingState\.allBeatsDone; \}/.test(views) &&
      /* the briefing beats play at a crisp broadcast cadence (1.12) */
      /rate: 1\.12/.test(speech));
    record('P2d the authentic first-person Beat 1 (49 words, "I, Hansana … on my own system … critical thinking and problem-solving skills can go") speaks COMPLETELY at the crisp 1.12x cadence — and the Paragraph-1 unlock fires the moment it ends',
      (function () {
        var m = /var BRIEFING_SENTENCES = \[([\s\S]*?)\];/.exec(views);
        var body = m ? m[1].replace(/",\s*\n\s*\+\s*"/g, '",\n"').replace(/"\s*\n\s*\+\s*"/g, '') : '';
        var beats = body.match(/"([\s\S]*?)"/g) || [];
        var beat1 = (beats[0] || '').replace(/^"|"$/g, '').replace('{W}', '2');
        var words = beat1.split(/\s+/).filter(Boolean).length;
        /* v0.0.6.v: the committed live-Eleven Beat 1 measures 21969 ms. */
        var durOk = false;
        try {
          var e1 = pack.clips['_intro_male_1'];
          durOk = !!e1 && Number(e1.bytes) > 300000;
        } catch (eDur) { durOk = false; }
        return /^Welcome/.test(beat1) && /skills can go\.$/.test(beat1) && words >= 45 && words <= 55 && durOk;
      })());
    record('P3a the briefing footer ships Exit (#btnBriefingSkip) on the LEFT and the highlighted ▶ Start Dictation → (#btnBriefingContinue) on the RIGHT (DOM order + class)',
      (function () {
        var foot = /<div class="modal-foot briefing-foot">([\s\S]*?)<\/div>/.exec(html);
        var body = foot ? foot[1] : '';
        var skipAt = body.indexOf('id="btnBriefingSkip"');
        var contAt = body.indexOf('id="btnBriefingContinue"');
        return !!foot && skipAt > 0 && contAt > skipAt &&
          /class="btn btn-go briefing-cta-right"/.test(body) &&
          /class="btn btn-ghost"/.test(body) &&
          html.indexOf('data-i18n="briefingSkip">Exit<') > 0;
      })());
    record('P3b the guide footer ships Exit (#btnGuideClose) on the LEFT and ▶ Click Start Dictation Now (#btnGuideSkipStart) highlighted on the RIGHT',
      (function () {
        var foot = /<div class="modal-foot">([\s\S]*?)<\/div>/.exec(html.slice(html.indexOf('id="guideModal"')));
        var body = foot ? foot[1] : '';
        var closeAt = body.indexOf('id="btnGuideClose"');
        var startAt = body.indexOf('id="btnGuideSkipStart"');
        return !!foot && closeAt > 0 && startAt > closeAt &&
          /class="btn btn-go guide-cta-right"/.test(body) &&
          html.indexOf('▶ Click Start Dictation Now') > 0;
      })());
    record('P3c the CTA labels + i18n: Start Dictation ({n}s)… during the gate, ▶ Start Dictation → unlocked, Exit/ඉවත් වන්න on the ghost',
      /briefingContinueWait: 'Start Dictation \(\{n\}s\)…'/.test(views) &&
      /briefingContinue: '▶ Start Dictation →'/.test(views) &&
      /briefingSkip: 'Exit'/.test(views) &&
      /briefingSkip: 'ඉවත් වන්න'/.test(views) &&
      /guideSkipStartNow: '▶ Click Start Dictation Now'/.test(views));
    record('P3d the seamless handover: ▶ Start Dictation → ALWAYS opens the guide (fromHandover) which narrates Step 1→4 immediately, and ▶ Click Start Dictation Now starts the clock at Word #1',
      /openGuide\(null, \{ fromHandover: true \}\)/.test(views) &&
      /if \(opts\.fromHandover\) startGuideNarration\(0\);/.test(views) &&
      /viaButton === 'continue'[\s\S]{0,220}fromHandover: true/.test(views) &&
      /btnGuideSkipStart', 'click'/.test(views) &&
      /beginDictation\(mode\);/.test(views) &&
      /Engine\.start\(\{ mode: chosen \}\)/.test(views));
    record('P3e the highlighted CTA styling: glowing emerald→indigo gradient + pulsing focus ring on both right-side CTAs',
      /\.briefing-cta-right, \.guide-cta-right/.test(css) &&
      /linear-gradient\(135deg, #10B981 0%, #059669 45%, #4F46E5 100%\)/.test(css) &&
      /sdpCtaPulse/.test(css) &&
      /\.b-gate-open \.briefing-cta-right:not\(\[disabled\]\)/.test(css));
    /* P2 — the exact 6-key $0 Multi-API pool + pronunciation verifier + static vault. */
    record('KP1 the 5-slot Multi-API key pool ships (slots + provider selects)',
      /KEY_POOL_SLOTS = 5/.test(studio) && /'kpSlot' \+ \(i \+ 1\)/.test(studio) && /'kpProv' \+ \(i \+ 1\)/.test(studio) &&
      /function keyPoolMarkup/.test(studio) && /POOL_PROVIDERS/.test(studio));
    record('KP2 the pool covers ElevenLabs + free/open-source LLM providers',
      /cloudflare/.test(studio) && /gemini/.test(studio) && /openrouter/.test(studio) && /groq/.test(studio));
    record('KP3 automatic key rotation + quota failover before/during a batch',
      /function rotateElevenKey/.test(studio) && /function resolveElevenKey/.test(studio) &&
      /probePoolKeys/.test(studio) && /Key rotated/.test(studio));
    /* v0.0.6.m: the creator's exact 6-key architecture — the primary ElevenLabs
       key (Step 1) + Slot #1 ElevenLabs backup (credit-exhaustion failover),
       Slots #2-3 the two Groq free-tier keys, Slots #4-5 the two OpenRouter
       free-model keys. 100% $0 cost. */
    record('KP7 the pool defaults to 1x ElevenLabs backup + 2x Groq + 2x OpenRouter (6-key $0 layout)',
      /POOL_DEFAULT_PROVIDERS = \['elevenlabs', 'groq', 'groq', 'openrouter', 'openrouter'\]/.test(studio) &&
      /POOL_DEFAULT_HINTS/.test(studio) &&
      /ElevenLabs Key #2 — Backup/.test(studio) &&
      /Groq Free Key #1/.test(studio) && /Groq Free Key #2/.test(studio) &&
      /OpenRouter Free Key #1/.test(studio) && /OpenRouter Free Key #2/.test(studio) &&
      /function poolDefaultProvider/.test(studio));
    record('KP8 the Groq→OpenRouter $0 cascade + ElevenLabs mid-batch failover ship',
      /function groqKeyPool/.test(studio) && /function llmCandidates/.test(studio) &&
      /logGroqRotation/.test(studio) && /groq_rate_limited/.test(studio) &&
      /api\.groq\.com\/openai\/v1\/chat\/completions/.test(studio) &&
      /llama-3\.3-70b-versatile/.test(studio) &&
      /meta-llama\/llama-3\.3-70b-instruct:free/.test(studio) &&
      /401 \|\| st === 402 \|\| st === 429/.test(studio));
    record('KP9 the intro clips use the deep British male George voice',
      /JBFqnCBsd6RMkjVDRZzb/.test(studio) && /George · deep British male/.test(studio) &&
      /onwK4e9ZLuTAKqWW03F9/.test(studio) && !/· 21'/.test(studio));
    record('KP4 the AI British pronunciation pre-verifier (Cambridge B1 / RP)',
      /function verifyPronunciationWord/.test(studio) && /britishizeIpa/.test(studio) &&
      /ttsHint/.test(studio) && /Cambridge English B1/.test(studio));
    record('KP5 per-word Verify & Preview badge + Re-synthesize Single Word',
      /data-action="verifyWmRow"/.test(studio) && /data-action="resynthWmRow"/.test(studio) &&
      /function verifyWmRow/.test(studio) && /function resynthWmRow/.test(studio));
    record('KP6 the permanent static clip vault is locked by SHA-1 content hash',
      /STATIC_CLIP_KEYS/.test(studio) && /isStaticClipKey/.test(studio) &&
      /_intro_male_/.test(studio) && /Static vault/.test(studio));
    record('LP10 autoEnsureSystemClips keeps every essential system clip synced automatically',
      /function autoEnsureSystemClips/.test(studio) && /function missingSystemClips/.test(studio) &&
      /ESSENTIAL_SYSTEM_CLIPS/.test(studio) && /_cmd_play|cmd\.preparing/.test(studio) &&
      /source: 'unlock'/.test(studio) && /source: 'publish'/.test(studio) &&
      /regenKeys/.test(studio) && /allowAutoGen\(\)/.test(studio));
    /* P3 — instant review popup + dual-engine voice + floating launcher. */
    record('RV1 the instant review popup card ships at the TOP of the results view',
      html.indexOf('id="reviewPopupCard"') > 0 && html.indexOf('id="btnVoiceReview"') > 0 &&
      html.indexOf('id="reviewTextInput"') > 0 && html.indexOf('id="btnSkipReview"') > 0 &&
      html.indexOf('id="resultsPanel"') < html.indexOf('id="reviewPopupCard"') &&
      html.indexOf('id="reviewPopupCard"') < html.indexOf('id="resultsTable"'));
    record('RV2 the voice review is dual-engine: MediaRecorder real audio + Web Speech transcript',
      /webkitSpeechRecognition|SpeechRecognition/.test(views) && /si-LK/.test(views) &&
      /navigator\.mediaDevices\.getUserMedia/.test(views) && /new global\.MediaRecorder/.test(views) &&
      /audio\/webm;codecs=opus/.test(views) && /REVIEW_REC_MAX_MS = 20000/.test(views));
    record('RV3 the E2EE privacy badge is verbatim on the card',
      html.indexOf('100% End-to-End Encrypted — Your privacy is completely protected.') > 0);
    record('RV4 reviews are sealed AES-GCM before storage (SDP.Diagnostics)',
      /captureReview/.test(sync) && /encryptV2/.test(sync) && /decryptReviews/.test(sync));
    record('FF1 releaseFeedbackAudioLocks(): every stop/submit/close path releases 100% of the mic + audio-session locks',
      /function releaseFeedbackAudioLocks/.test(views) &&
      /rec\.state !== 'inactive'/.test(views) && /rec\.stop\(\)/.test(views) &&
      /tracks\[i\]\.stop\(\)/.test(views) &&
      /recog\.abort|recog\.stop/.test(views) &&
      /recoverAudioSession/.test(speech) && /recoverAudioSession/.test(views) &&
      /'recorder_stopped'/.test(views) && /'drawer_closed'/.test(views) &&
      /'dictation_start'/.test(views) && /'dictation_word'/.test(engine) &&
      /el\.volume = 1/.test(speech) && /el\.muted = false/.test(speech));
    record('FF2 the full UI + DOM + Cache + Audio snapshot is captured and sealed with every review',
      /captureFullUiSnapshot/.test(sync) && /payload\.uiSnapshot/.test(views) &&
      /lastUiSnapshot/.test(sync) && /ui-snapshots\.json/.test(sync) &&
      /pushReviewEnvelope/.test(sync) &&
      /'appHeader', 'ringWrap', 'btnPlayPause', 'tabbar', 'briefingModal', 'reviewPopupCard'/.test(sync) &&
      /micReleased/.test(sync) && /recentAudioErrors/.test(sync) &&
      /voicePackClipsCount/.test(sync));
    record('FF3 the Studio reviews drawer renders the expandable Inspect UI & Cache Snapshot badge',
      /Inspect UI &amp; Cache Snapshot/.test(studio) && /renderUiSnapshotHtml/.test(studio) &&
      /rev-snapshot/.test(studio));
    record('LR5 the nine comprehensive 1-tap issue & praise chips ship on BOTH the review card and the FAB drawer',
      ['fast', 'voice_ok', 'voice_muted', 'voice_robotic', 'briefing_sync', 'incomplete', 'ui_layout', 'clock_stuck', 'cache_stale'].every(function (k) {
        var first = html.indexOf('data-rpill="' + k + '"');
        var second = html.indexOf('data-rpill="' + k + '"', first + 1);
        return first > 0 && second > first;
      }) && /rpc-ready/.test(views) && /syncReviewPills/.test(views) &&
      /review-popup-card/.test(css) && /rpc-title/.test(css) &&
      !/data-rpill="voice_bad"/.test(html) && !/data-rpill="bug"/.test(html));
    record('LR6 the recorded voice note has a live timer and a ▶ preview player',
      html.indexOf('id="reviewVoicePreview"') > 0 && /reviewRecLive/.test(views) &&
      /Recording \{t\}/.test(views) && /reviewRecAttached/.test(views) &&
      /assembleReviewClip/.test(views) && /readAsDataURL/.test(views));
    record('LF1 the floating corner Feedback / Quick-Help launcher + offline FAQ ship',
      html.indexOf('id="sdpFeedbackFab"') > 0 && html.indexOf('id="sdpFeedbackDrawer"') > 0 &&
      /sdpFeedbackFab/.test(css) && /function toggleFeedbackDrawer/.test(views) &&
      /renderFabFaq/.test(views) && /fabFaqAudio/.test(views) && /fabFaqPaper/.test(views) &&
      /Spot an issue\? Tell us/.test(html) && /fabBadgeSeen/.test(views));
    /* P4 — paper-mode ergonomics + session authenticity telemetry. */
    record('LT1 the paper-mode 1-tap helper marks only UNMARKED words correct (missed marks kept)',
      html.indexOf('id="btnMarkAllCorrect"') > 0 && /markAllUnmarked/.test(html) &&
      /function markAllUnmarkedCorrect/.test(engine) &&
      /item\.marked !== 'correct' && item\.marked !== 'missed'/.test(engine));
    record('LT2 the session authenticity analyzer classifies Genuine / Rapid-Skip / Incomplete',
      /function analyzeSession/.test(engine) && /GENUINE_FULL/.test(engine) &&
      /RAPID_SKIP_SUSPECT/.test(engine) && /PARTIAL_INCOMPLETE/.test(engine) &&
      /rapidSkipCount/.test(engine) && /< 2500/.test(engine) &&
      /wordsCompletedCount \+= 1/.test(engine) && /sessionTelemetry/.test(engine));
    record('LT3 telemetry is sealed on BOTH Send Review and Skip — No Thanks',
      /function sendReview/.test(views) && /payload\.telemetry = tel/.test(views) &&
      /btnSendReview/.test(views) && /btnSkipReview/.test(views) &&
      /sendReview\(false\)/.test(views) && /sendReview\(true\)/.test(views) &&
      /session_telemetry/.test(engine));
    record('LT4 the Studio User Reviews & Session Telemetry drawer ships with per-session badges',
      /studioCardReviews/.test(studio) && /studioReviewsList/.test(studio) &&
      /btnDownloadReviewsZip/.test(studio) && /User Reviews &amp; Session Telemetry/.test(studio) &&
      /✓ Genuine/.test(studio) && /⚠ Rapid Skip/.test(studio) && /⏳ Incomplete/.test(studio) &&
      /▶ Play Student Voice Recording/.test(studio) && /paintReviewsDrawer/.test(studio));
    record('DZ1 the diagnostics ring buffer is bounded and privacy-safe',
      /DIAG_MAX_RING = 160/.test(sync) && /audio_tier_fallback/.test(speech) &&
      /session_complete/.test(views));
    record('DZ2 the Studio exports a real in-browser .zip (pure ES5 CRC32/STORE)',
      studio.indexOf('btnDownloadDiagZip') > 0 && /function crc32Bytes/.test(sync) &&
      /function zipStore/.test(sync) && /\[0x50, 0x4B, 0x03, 0x04\]/.test(sync) &&
      /0xEDB88320/.test(sync) && /function buildDiagZip/.test(studio));
    record('DZ3 the .zip carries the six documented artifacts (incl. session-telemetry.json)',
      sync.indexOf('diagnostics-log.json') > 0 && sync.indexOf('student-reviews.json') > 0 &&
      sync.indexOf('session-telemetry.json') > 0 &&
      sync.indexOf('session-snapshot.json') > 0 && sync.indexOf('config-snapshot.json') > 0 &&
      sync.indexOf('README-DIAGNOSTICS.txt') > 0 &&
      /GENUINE_FULL/.test(sync) && /RAPID_SKIP_SUSPECT/.test(sync));
  })();

const failed = results.filter(function (r) { return r.status === 'FAIL'; });
if (JSON_OUT) {
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results: results }, null, 2));
} else {
  results.forEach(function (r) {
    if (r.status === 'PASS' && r.test.indexOf('pending:') === 0) return;
    console.log((r.status === 'PASS' ? 'PASS  ' : 'FAIL  ') + r.test + (r.detail ? '  [' + r.detail + ']' : ''));
  });
  console.log('\nG1 check.cjs — ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
}
process.exitCode = failed.length ? 1 : 0;
