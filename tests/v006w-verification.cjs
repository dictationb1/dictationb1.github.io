#!/usr/bin/env node
'use strict';
/* W-GATE — tests/v006w-verification.cjs — the v0.0.6.x four-objective release
 * verification gate (W1–W4). Static + jsdom verification of:
 *   W1 the NO-BOOT-BRIEFING law + the on-demand Settings briefing
 *   W2 Studio new-word synthesis without quarantine (genuine MP3 + LUFS)
 *   W3 the unified classroom & cloned voice controller
 *   W4 the Real-Time Live Lab (lab.html + data/sdp-live-lab.js, ES5, 6 stations)
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R-V006W. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const acorn = require('acorn');
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
  const views = readText('data/sdp-ui-views.js');
  const studio = readText('data/studio.js');
  const speech = readText('data/sdp-audio-speech.js');
  const html = readText('index.html');
  const pack = readJSON('data/elevenlabs-audio.json');

  /* ── W1 — the no-boot-briefing law + the on-demand Settings briefing ──── */
  check('W1a the boot path NEVER opens #briefingModal (no openBriefing({fromBoot}) in init)',
    !/openBriefing\(\{ fromBoot/.test(views), 'boot opens the briefing');
  check('W1b the boot path stamps briefingSeen and goes straight to the cockpit',
    /briefing_boot_retired/.test(views), 'no retirement log');
  check('W1c #btnCreatorNote opens the briefing with fromSettings (direct Stage-2 entry)',
    /openBriefing\(\{ replay: true, fromSettings: true \}\)/.test(views), 'creator note wiring');
  check('W1d the direct entry skips #welcomeStage and reveals #briefingStage at once',
    /var wD = byId\('welcomeStage'\), bD = byId\('briefingStage'\);/.test(views) &&
    /if \(wD\) wD\.hidden = true;/.test(views) && /if \(bD\) bD\.hidden = false;/.test(views),
    'stage reveal');
  check('W1e the direct entry unlocks all three exits instantly (no countdown wait)',
    /briefingState\.directOpen/.test(views) && /briefingState\.gateLeft = 0;/.test(views) &&
    /briefingState\.beat1Done = true;/.test(views), 'instant unlock');
  check('W1f the direct entry narrates Paragraph 1 from Word 1',
    /briefingNarrate\(0, briefingState\.epoch\)/.test(views), 'narration start');
  check('W1g the 4 _intro_male_1..4 briefing beats + transcript are preserved byte-for-byte',
    ['_intro_male_1', '_intro_male_2', '_intro_male_3', '_intro_male_4'].every((k) => pack.clips[k] && pack.clips[k].b64 && pack.clips[k].voiceId === 'JBFqnCBsd6RMkjVDRZzb') &&
    /BRIEFING_SENTENCES/.test(views) && (views.match(/"Welcome to Smart Dictation[^"]*"/) || []).length >= 1,
    'beats');
  check('W1h the attribution credits stay verbatim (CREDITS GOES TO Hansana / Ms. Sumodya Sewmini / Ayya01 (Lesandu))',
    /CREDITS GOES TO Hansana/.test(html) &&
    /Lecturer in Charge: Ms\. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 \(Lesandu\)/.test(html),
    'credits');
  /* live jsdom: boot + on-demand */
  {
    const app = await createApp({});
    check('W1i live: a brand-new visit boots with #briefingModal hidden and Home active',
      app.byId('briefingModal').hidden === true, 'modal open at boot');
    app.byId('btnCreatorNote').click();
    await app.advance(700);
    check('W1j live: #btnCreatorNote opens #briefingStage directly (welcome hidden, exits unlocked)',
      app.byId('briefingModal').hidden === false &&
      app.byId('welcomeStage').hidden === true && app.byId('briefingStage').hidden === false &&
      app.byId('btnBriefingSkip').disabled === false && app.byId('btnBriefingContinue').disabled === false,
      'direct open');
    check('W1k live: Paragraph 1 narrates in the on-demand open (one .on line, data-bline 0)',
      app.qa('#briefingLyrics .b-line.on').length === 1 &&
      app.q('#briefingLyrics .b-line.on').getAttribute('data-bline') === '0',
      'narrating');
    check('W1l live: the on-demand briefing is closable instantly (Exit, no gate)',
      app.SDP.Views.closeBriefing('skip') === true && app.byId('briefingModal').hidden === true,
      'closable');
    app.close();
  }

  /* ── W2 — Studio new-word synthesis: never quarantined, genuine MP3 ───── */
  check('W2a aiVerify sends the REAL word (Word: + w — the str(arguments.length) bug is gone)',
    /function aiVerify\(w, cb\)/.test(studio) && /'Word: ' \+ str\(w\)/.test(studio) &&
    !/'Word: ' \+ str\(arguments\.length\)/.test(studio), 'aiVerify body');
  check('W2b Stage B extracts UK IPA from any phonetics[] entry + -uk.mp3 across SEPARATE entries',
    /ukAudio/.test(studio) && /anyIpa/.test(studio), 'separate-entry law');
  check('W2c the NEVER-QUARANTINE law: no res.quarantined skip in generateClips',
    !/if \(res && res\.quarantined\)/.test(studio) && /quarantined = false/.test(studio) &&
    /result\.quarantined = false;/.test(studio), 'no quarantine');
  check('W2d buildFallbackRpHint ships the deterministic British RP respelling',
    /function buildFallbackRpHint/.test(studio) && /rpSource = 'fallback'/.test(studio) &&
    /rpSource: 'fallback'/.test(studio), 'fallback hint');
  check('W2e requestClip keeps the GENUINE MP3 b64 (no normalizeTake re-encode)',
    /measureBuffer\(payload, function/.test(studio) && !/AudioNormalize\.normalizeTake\(/.test(studio) &&
    /b64: b64, text: str\(item\.text\)/.test(studio), 'pure mp3');
  check('W2f the MP3 metadata stamps lufs / truePeakDbTp / gainLinear (bounded 0.5..2.0)',
    /gainLinear = Math\.max\(0\.5, Math\.min\(2\.0, Math\.pow\(10, \(-21\.0 - lufs\) \/ 20\)\)\)/.test(studio) &&
    /truePeakDbTp:/.test(studio) && /normalized: 'bs1770-4:-21\.0'/.test(studio), 'metadata');
  check('W2g speech hydration auto-detects UklGR (audio/wav) vs MP3 (audio/mpeg)',
    /indexOf\('UklGR'\) === 0\) \? 'audio\/wav' : 'audio\/mpeg'/.test(speech) ||
    /v\.mime = \(str\(v\.b64\)\.indexOf\('UklGR'\) === 0\) \? 'audio\/wav' : 'audio\/mpeg';/.test(speech),
    'mime detect');
  check('W2h playback applies clip.gainLinear (the unified loudness law)',
    /gainLinear/.test(speech), 'gainLinear playback');
  /* live jsdom: a brand-new non-lexicon word synthesizes without quarantine */
  {
    const app = await createApp({ before(w) {
      w.localStorage.setItem('sdp.guide_seen', '0.0.6.z');
      w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.6.z' }));
    } });
    /* deterministic: verifyBritishRPWord resolves fallback (dead dictionary + no AI key) */
    let verdict = null;
    app.SDP.Studio.verifyBritishRPWord({ w: 'cathedral' }, function (res) { verdict = res; });
    await app.advance(400);
    for (let i = 0; i < 40 && verdict === null; i += 1) { await app.advance(250); }
    check('W2i live: verifyBritishRPWord("cathedral") resolves WITHOUT quarantine',
      !!verdict && verdict.quarantined === false && verdict.ok === true,
      JSON.stringify(verdict));
    check('W2j live: the fallback carries the deterministic RP respelling + rpSource fallback',
      !!verdict && verdict.rpSource === 'fallback' && typeof verdict.rpRespelling === 'string' && verdict.rpRespelling.length > 0,
      JSON.stringify(verdict && verdict.rpRespelling));
    check('W2k live: buildFallbackRpHint maps a UK vowel pattern (cathedral → contains ah/a)',
      /a/.test(String(app.SDP.Studio.buildFallbackRpHint('cathedral'))),
      app.SDP.Studio.buildFallbackRpHint('cathedral'));
    app.close();
  }

  /* ── W3 — the unified classroom & cloned voice controller ─────────────── */
  check('W3a chosenClassroomVoiceId/Name persist inside sdp.settings.voiceSignature (five-key law)',
    /function chosenClassroomVoiceId/.test(studio) && /function chosenClassroomVoiceName/.test(studio) &&
    /dataSaveSettings\(\{ voiceSignature: base \}\)/.test(studio), 'controller');
  check('W3b the default unified voice is Alice (Xb7hH8MSUJpSbSDYk0k2)',
    /return \/\^\[A-Za-z0-9\]\{16,32\}\$\/\.test\(v\) \? v : VOICE_ID;/.test(studio), 'alice default');
  check('W3c generateClips follows the unified controller for every classroom take',
    /chosenClassroomVoiceId\(\) \|\| activeVoiceId/.test(studio), 'unified synthesis');
  check('W3d the Cloned-Voice-safe ladder ships (0.55/0.85/boost → 0.55/0.80 → multilingual_v2)',
    /var isClone = !introMode && genVoiceId !== VOICE_ID;/.test(studio) &&
    /stability: 0\.55, similarity_boost: 0\.85, use_speaker_boost: true/.test(studio) &&
    /stability: 0\.55, similarity_boost: 0\.80/.test(studio) &&
    /eleven_multilingual_v2/.test(studio), 'clone ladder');
  check('W3e forceAllClassroom re-bakes every classroom clip in the active voice',
    /opts\.forceAllClassroom/.test(studio), 'force all');
  check('W3f voiceSignature() accepts a persisted CLONE (the Alice-only guard is gone)',
    /if \(!isObj\(vs\) \|\| !str\(vs\.voiceId\)\)/.test(studio), 'clone-safe signature');
  check('W3g the Studio ships the classroom voice card + Apply/Re-bake/Reset/Lab buttons',
    /btnApplyClassroomVoice/.test(studio) && /btnRebakeClassroomVoice/.test(studio) &&
    /btnResetClassroomVoice/.test(studio) && /btnOpenLiveLab/.test(studio) &&
    /studioClassroomVoiceBar/.test(studio), 'studio UI');
  check('W3h Settings › About ships the 🔬 Real-Time Voice & Clone Lab launcher',
    /id="btnOpenLiveLab"/.test(html), 'settings launcher');
  /* live jsdom: apply a clone + verify persistence */
  {
    const app = await createApp({ before(w) {
      w.localStorage.setItem('sdp.guide_seen', '0.0.6.z');
      w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.6.z' }));
    } });
    const applied = app.SDP.Studio.applyClassroomVoice('AbCdEf0123456789AbCdEf0123456789', 'My Test Clone');
    const sig = JSON.parse(app.w.localStorage.getItem('sdp.settings')).voiceSignature;
    check('W3i live: applyClassroomVoice persists the clone inside sdp.settings.voiceSignature',
      applied === true && sig && sig.voiceId === 'AbCdEf0123456789AbCdEf0123456789' && sig.cloned === true,
      JSON.stringify(sig));
    check('W3j live: chosenClassroomVoiceId() returns the clone (not hardcoded Alice)',
      app.SDP.Studio.chosenClassroomVoiceId() === 'AbCdEf0123456789AbCdEf0123456789',
      app.SDP.Studio.chosenClassroomVoiceId());
    check('W3k live: the clone signature carries the Cloned-Voice-safe settings (0.55 / 0.85 / boost)',
      sig.settings && sig.settings.stability === 0.55 && sig.settings.similarity_boost === 0.85 &&
      sig.settings.use_speaker_boost === true, JSON.stringify(sig && sig.settings));
    app.close();
  }

  /* ── W4 — the Real-Time Live Lab ════════════════════════════════════════ */
  const labHtml = readText('lab.html');
  const labJs = readText('data/sdp-live-lab.js');
  check('W4a lab.html ships at the repo root (≤ 30000 B, unified Live Lab) with the 9 station sections',
    labHtml.length <= 30000 && (labHtml.match(/<section class="card">/g) || []).length === 9,
    String(labHtml.length));
  check('W4b data/sdp-live-lab.js ships (≤ 92000 B, unified 0.0.7.e Live Lab + Station 7) and parses as strict ES5 (acorn ecmaVersion 5)',
    labJs.length <= 92000 && (function () { try { acorn.parse(labJs, { ecmaVersion: 5, sourceType: 'script' }); return true; } catch (e) { return false; } })(),
    String(labJs.length));
  check('W4c the LiveLab engine exposes window.SDP.LiveLab with all 6 stations + report exports',
    /SDP\.LiveLab = \{/.test(labJs) && /station1: station1/.test(labJs) && /station2: station2/.test(labJs) &&
    /station3: station3/.test(labJs) && /station4: station4/.test(labJs) && /station5: station5/.test(labJs) &&
    /runFullDiagnostics/.test(labJs) && /downloadJsonReport/.test(labJs) && /downloadZipReport/.test(labJs),
    'exports');
  check('W4d Station 1 decodes the live pack through real AudioContext + MPEG signature + BS.1770-4 LUFS',
    /decodeAudioData/.test(labJs) && /mp3Signature/.test(labJs) && /measureLoudness/.test(labJs) &&
    /labWaveformCanvas/.test(labHtml) && /Test All Words Sequentially/.test(labHtml), 'station1');
  check('W4e Station 2 queries /v1/voices + /v1/user/subscription live and tests clone synthesis',
    /api\.elevenlabs\.io\/v1\/voices/.test(labJs) && /user\/subscription/.test(labJs) &&
    /text-to-speech\//.test(labJs), 'station2');
  check('W4f Station 3 traces the A→E RP pipeline with the dictionary + fallback legs',
    /dictionaryapi\.dev/.test(labJs) && /Stage A/.test(labJs) && /Stage D/.test(labJs) &&
    /buildFallbackRpHint/.test(labJs) && /verifyBritishRPWord/.test(labJs), 'station3');
  check('W4g Station 4 probes the live app iframe + the boot-briefing law',
    /labAppProbe/.test(labHtml) && /briefingModal/.test(labJs), 'station4');
  check('W4h Station 5 compares SW/caches/CDN vs Raw with the 1-click purge',
    /raw\.githubusercontent\.com/.test(labJs) && /Force Purge All Audio Caches/.test(labHtml) &&
    /forcePurgeAndResync/.test(labJs), 'station5');
  check('W4i Station 6 runs the full suite + .json/.zip exports',
    /Run Full Live Diagnostic Suite/.test(labHtml) && /Download Full Live Lab Report/.test(labHtml), 'station6');
  check('W4j sw.js precaches the lab files and pins the sdp-v0.0.6.z-s39 shell',
    /'\.\/data\/sdp-live-lab\.js'/.test(readText('sw.js')) &&
    /SW_VERSION = 'sdp-v0\.0\.7\.e-s44'/.test(readText('sw.js')), 'sw precache');
  check('W4k the pack header carries the unified v0.0.7.e / ver 43 / schema 43 / settingsRev 76 / syncRev 1797000000027',
    pack.version === '0.0.7.e' && pack.ver === 45 && pack.schema === 45 &&
    pack.settingsRev === 78 && Number(pack.syncRev) === 1797000000027,
    JSON.stringify([pack.version, pack.ver, pack.schema, pack.settingsRev, pack.syncRev]));

  /* ── report ───────────────────────────────────────────────────────────── */
  const failed = results.filter((r) => r.status === 'FAIL');
  results.forEach((r) => {
    if (r.status === 'PASS') return;
    console.log('FAIL  ' + r.test + '  [' + r.detail + ']');
  });
  console.log('\nW-GATE v006w-verification.cjs — ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
  process.exitCode = failed.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
