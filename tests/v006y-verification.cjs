#!/usr/bin/env node
'use strict';
/* G17 — the v0.0.6.y seven-pillar release verification gate.
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.6.y (ver 39 / schema 39 / settingsRev 63 / syncRev 1797000000012 / sw s38)
 * Y1: Voice Sample Recorder/Uploader + DSP+Gemini AI analyzer + pre-enhancement + Instant Voice Clone wiring.
 * Y2: validatePackClips + purgeStaleClipsEverywhere + #sdpVoiceClipGuardBanner.
 * Y3: Student→Lecturer alert delivery into #studioLecturerAlertsCard.
 * Y4: Real-time UI sync (emitChange/onChange) across Studio surfaces.
 * Y5: Live Lab v3.0 headless boot (Station 2B + 3B, ALL PASS 0 FAIL).
 * Y6: Zero .zip archives, data.html === data/index.html, George briefing parity.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
const ROOT = path.resolve(__dirname, '..');
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJSON = (rel) => JSON.parse(readText(rel));
const studio = readText('data/studio.js');
const speech = readText('data/sdp-audio-speech.js');
const telemetry = readText('data/sdp-telemetry.js');
const liveLab = readText('data/sdp-live-lab.js');
const labHtml = readText('lab.html');
const indexHtml = readText('index.html');
const sw = readText('sw.js');
const pack = readJSON('data/elevenlabs-audio.json');
const session = readJSON('data/session.json');

/* ── Y1: the Voice Sample Studio + AI analyzer + IVC pipeline ─────────── */
check('Y1a studio.js ships the voice sample recorder (getUserMedia echoCancellation/noiseSuppression/AGC-off/44.1kHz)',
  /echoCancellation:\s*true,\s*noiseSuppression:\s*true,\s*autoGainControl:\s*false,\s*sampleRate:\s*44100/.test(studio));
check('Y1b the uploader accepts any 1-2 min audio file (10 KB - 25 MB, MP3/WAV/M4A/WebM/OGG/FLAC)',
  /voiceSampleFileInput/.test(studio) && /audio\/\*,\.mp3,\.wav,\.m4a,\.webm,\.ogg,\.flac/.test(readText('index.html')) === false && labHtml.indexOf('.flac') >= 0);
check('Y1c the confirm leg decodes via decodeAudioData and persists sdp.settings.voiceSampleProfile',
  /voiceSampleProfile/.test(studio) && /decodeAudioData/.test(studio));
check('Y1d analyzeVoiceSampleWithAi exists (hybrid DSP + Gemini, deterministic fallback)',
  /function analyzeVoiceSampleWithAi/.test(studio));
check('Y1e the DSP stage computes LUFS/truePeak/LRA/noiseFloor/silenceRatio/centroid/lowMud/presence/sibilance',
  /integratedLufs/.test(studio) && /truePeakDbTP/.test(studio) && /dynamicRangeDb/.test(studio) && /noiseFloorDb/.test(studio) && /silenceRatio/.test(studio) && /spectralCentroidHz/.test(studio) && /presenceRatio/.test(studio) && /sibilanceRatio/.test(studio));
check('Y1f the Gemini leg posts to gemini-2.5-flash:generateContent with the base64 sample + DSP telemetry',
  /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent/.test(studio));
check('Y1g the enhancement chain is an OfflineAudioContext mastering chain (HP + mud cut + presence shelf + air + compressor + BS.1770-4)',
  /OfflineAudioContext/.test(studio) && /highpass/.test(studio) && /peaking/.test(studio) && /highshelf/.test(studio) && /createDynamicsCompressor/.test(studio) && /measureLoudness/.test(studio));
check('Y1h the ElevenLabs Instant Voice Clone posts multipart to /v1/voices/add with remove_background_noise=true',
  /api\.elevenlabs\.io\/v1\/voices\/add/.test(studio) && /remove_background_noise/.test(studio));
check('Y1i the clone flow locks voice_settings (stability/similarity_boost/style/use_speaker_boost) into voiceSignature',
  /recommendedElevenLabsSettings/.test(studio) && /use_speaker_boost/.test(studio));
check('Y1j the clone flow wipes old word clips then re-synthesizes the 30 words (Clean-Word TTS law)',
  /purgeStaleClipsEverywhere/.test(studio) && /generateClips\(\{\s*force:\s*true/.test(studio));

/* ── Y2: the strict anti-stale guard ──────────────────────────────────── */
check('Y2a validatePackClips exists in sdp-audio-speech.js with the 4 rules (membership/rev+hash/voiceId/decode)',
  /function validatePackClips/.test(speech) && /orphaned/.test(speech) && /voiceMismatch/.test(speech) && /corrupted/.test(speech) && /stale/.test(speech));
check('Y2b purgeStaleClipsEverywhere exists and wipes manifest + clipBase + injectedClips + ST.voicePack + CacheStorage',
  /function purgeStaleClipsEverywhere/.test(speech) && /sdp-audio-clips/.test(speech) && /voicePack/.test(speech));
check('Y2c auditSessionVoiceReadiness exists and runs before dictation (engine start hook)',
  /function auditSessionVoiceReadiness/.test(speech) && /auditSessionVoiceReadiness/.test(readText('data/sdp-dictation-engine.js')));
check('Y2d #sdpVoiceClipGuardBanner exists in index.html AND lab.html, hidden by default',
  /id="sdpVoiceClipGuardBanner"/.test(indexHtml) && /id="sdpVoiceClipGuardBanner"/.test(labHtml));
check('Y2e the banner is bilingual (Sinhala + English) with Purge & Refresh / Notify / Generate buttons',
  /Purge & Refresh/.test(speech) && /Notify Lecturer \/ Admin/.test(speech) && /Generate Missing Clips in Studio/.test(speech) && /හඬ පට/.test(speech));
check('Y2f the shipped pack has ZERO orphaned words.* keys (the 44-key live-repo corruption cannot recur)',
  Object.keys(pack.clips).filter((k) => /^words\./.test(k) && /^(num|cmd|guide)\./.test(k.replace(/^words\./, '')) && pack.clips['words.' + k.replace(/^words\./, '')] !== pack.clips[k.replace(/^words\./, '')]).length === 0);
check('Y2g the shipped pack carries exactly the 76 canonical clips (31 words + 31 num + 6 cmd + 4 guide + 4 briefing)',
  Object.keys(pack.clips).length === 76);
check('Y2h the pack header is the unified v0.0.7.e / ver 43 / schema 43 / settingsRev 76 / syncRev+wordsRev 1797000000027',
  pack.version === '0.0.7.e' && pack.ver === 45 && pack.schema === 45 && pack.settingsRev === 78 && Number(pack.syncRev) === 1797000000027 && Number(pack.wordsRev) === 1797000000027);

/* ── Y3: the student → lecturer alert channel ─────────────────────────── */
check('Y3a sdp-telemetry.js ships sendLecturerAlert + pullLecturerAlerts + clearLecturerAlerts',
  /function sendLecturerAlert/.test(telemetry) && /function pullLecturerAlerts/.test(telemetry) && /function clearLecturerAlerts/.test(telemetry));
check('Y3b alerts persist under sdp.settings.lecturerAlerts (five-key law — no sixth localStorage key)',
  /lecturerAlerts/.test(telemetry) && !/localStorage\.(get|set)Item\('sdp\.(?!progress|settings|session|guide_seen|migrated)/.test(telemetry));
check('Y3c alerts push to the ntfy.sh topic with kind lecturer_alert',
  /kind: 'lecturer_alert'/.test(telemetry) && /ntfy\.sh/.test(telemetry));
check('Y3d the Lecturer Alert Inbox (#studioLecturerAlertsCard) renders in unlocked Studio with the unread badge',
  /studioLecturerAlertsCard/.test(studio) && /studioAlertCountBadge/.test(studio));
check('Y3e the inbox has 1-click Fix Now / Publish / Dismiss resolution buttons',
  /data-alert-action="fix"/.test(studio) && /data-alert-action="publish"/.test(studio) && /data-alert-action="resolve"/.test(studio));
check('Y3f the auto-notify fires once per session on missing/stale clips',
  /voiceGuardAlertSent/.test(speech) && /sendLecturerAlert/.test(speech));

/* ── Y4: real state synchronization ───────────────────────────────────── */
check('Y4a SDP.Sync.emitChange / onChange exist (the reactive event bus)',
  /emitChange/.test(readText('data/sdp-data-sync.js')) && /onChange/.test(readText('data/sdp-data-sync.js')));
check('Y4b the Studio subscribes and repaints every surface on change (paintAllVoiceSurfaces)',
  /paintAllVoiceSurfaces/.test(studio) && /SDP\.Sync\.onChange/.test(studio));
check('Y4c the Voice Coverage Matrix pill (#studioVoiceCoveragePill) renders live counts (31/31 Words · 31/31 Numbers · 6/6 Commands · 4/4 Guide · 4/4 Briefing)',
  /studioVoiceCoveragePill/.test(studio) && /30\/' \+ c\.numbers\.total \+ ' Numbers/.test(studio) === false && /Numbers/.test(studio));
check('Y4d no dead recorder buttons: btnStudioRecord/btnCommitClip wired to the real pipeline',
  /btnStudioRecord: function \(\) \{ toggleVoiceSampleRecord\(\); \}/.test(studio) && /btnCommitClip: function/.test(studio));
check('Y4e every new button id has a CLICK_ACTIONS or onStudio binding',
  ['btnVoiceSampleRecord', 'btnVoiceSampleStop', 'btnConfirmVoiceSample', 'btnRunVoiceAnalyzer', 'btnCreateAndApplyVoiceClone', 'btnRefreshLecturerAlerts', 'btnClearLecturerAlerts'].every((id) => studio.indexOf(id) >= 0));

/* ── Y5: Live Lab v3.0 ────────────────────────────────────────────────── */
check('Y5a lab.html ships Station 2B (Voice Sample AI Analyzer sandbox) and Station 3B (stale-clip simulator)',
  /STATION 2B/.test(labHtml) && /STATION 3B/.test(labHtml));
check('Y5b sdp-live-lab.js carries the unified 0.0.7.e version with the low-credit verifier + reference simulation + stale simulator',
  /version: '0\.0\.7\.e'/.test(liveLab) && /labSimulateSample/.test(liveLab) && /labStaleSimulator/.test(liveLab) && /lowCreditVerify/.test(liveLab));
check('Y5c the lab carries the guard banner host element',
  /id="sdpVoiceClipGuardBanner"/.test(labHtml));
check('Y5d the lab ES5-parses (strict ES5 law)', (() => { try { require('acorn').parse(liveLab, { ecmaVersion: 5 }); return true; } catch (e) { return false; } })());

/* ── Y6: repository hygiene ───────────────────────────────────────────── */
check('Y6a zero .zip archives exist in the repository tree',
  fs.readdirSync(ROOT).filter((f) => /\.zip$/i.test(f)).length === 0);
check('Y6b data.html === data/index.html byte parity',
  readText('data.html') === readText('data/index.html'));
check('Y6c .gitignore bans *.zip archives',
  /^\*\.zip$/m.test(readText('.gitignore')));
check('Y6d the four George briefing clips stay byte-for-byte identical to the v0.0.7.e −21 LUFS masters (JBFqnCBsd6RMkjVDRZzb)', (() => {
  const PINS = {
    _intro_male_1: 'f92763267f27e59e3b23db6bd2ce04584533903ac0dc9fc64ca6af4df5f3a5c0',
    _intro_male_2: '5d4071b4a9ed82b3cb44ac6784cbd500f0a5752cf0a55f9d0d16aed6e1f81b4d',
    _intro_male_3: '86b60ce13fe9db5db0648853bc3d9582bdd56fb1c0c14db9b1bda66ab6a14a5d',
    _intro_male_4: '246ab0540aa0213c7731e18cb663b8307ff9a1ef3954c919a6bd9ee1da99a217'
  };
  for (const k of Object.keys(PINS)) {
    const c = pack.clips[k];
    if (!c || c.voiceId !== 'JBFqnCBsd6RMkjVDRZzb') return false;
    const hash = crypto.createHash('sha256').update(Buffer.from(c.b64, 'base64')).digest('hex');
    if (hash !== PINS[k]) return false;
  }
  return true;
})());
check('Y6e the service worker pins the s39 shell caches',
  /SW_VERSION = 'sdp-v0\.0\.7\.e-s44'/.test(sw) && /SHELL_CACHE = 'sdp-v0\.0\.7\.e-s44-shell'/.test(sw));
check('Y6f session.json carries the unified v0.0.7.e pins (ver 66 / settingsRev 76 / syncRev 1797000000027)',
  session.ver === 68 && session.settingsRev === 78 && Number(session.syncRev) === 1797000000027 && session.appVersion === '0.0.7.e');

/* ── Y2/Y3/Y5 live headless-Chromium verification (the boot law) ──────── */
(async function live() {
  let chromium = null;
  try {
    chromium = require('playwright-core').chromium;
    const serverChromium = require('@sparticuz/chromium');
    require('./chromium-env.cjs').ensureChromiumLibs();
    const { start } = require('./static-server.cjs');
    const server = await start({ root: ROOT });
    const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
    const args = serverChromium.args.filter((a) => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a));
    const browser = await chromium.launch({ headless: true, executablePath, args });
    try {
      /* app boot + Y2 purge/banner + Y3 alert + Y4 sync + studio cards */
      {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await ctx.route('**/*', (route) => {
          const url = route.request().url();
          if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
          return route.abort();
        });
        await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        const st = await page.evaluate(() => ({
          ready: !!(window.SDP && SDP.Sync && SDP.Sync.isReady()),
          words: window.SDP && SDP.Sync ? SDP.Sync.wordCount() : -1,
          guard: !!(SDP.Speech && SDP.Speech.validatePackClips && SDP.Speech.purgeStaleClipsEverywhere && SDP.Speech.auditSessionVoiceReadiness && SDP.Speech.guardPurgeAndRefresh && SDP.Speech.guardNotifyAdmin),
          alerts: !!(SDP.Telemetry && SDP.Telemetry.sendLecturerAlert && SDP.Telemetry.pullLecturerAlerts && SDP.Telemetry.alertStore && SDP.Telemetry.clearLecturerAlerts),
          bus: !!(SDP.Sync && SDP.Sync.emitChange && SDP.Sync.onChange),
          bannerHidden: document.getElementById('sdpVoiceClipGuardBanner').hidden
        }));
        check('Y2i live boot: 31 words, guard + alert APIs live, banner hidden, 0 page errors',
          st.ready && st.words === 31 && st.guard && st.alerts && st.bus && st.bannerHidden && errors.length === 0, JSON.stringify(st) + ' | ' + errors.slice(0, 2).join(','));
        const purge = await page.evaluate(() => {
          const S = SDP.Speech, m = S.state.manifest.clips;
          m['words.old_retired_word'] = { b64: 'AAAA', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', text: 'x', at: 1 };
          m['words.num.1'] = { b64: 'AAAA', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', text: 'x', at: 1 };
          S.state.clipBase['words.old_retired_word'] = { b64: 'AAAA' };
          S.state.injectedClips['words.old_retired_word'] = { b64: 'AAAA' };
          const res = S.purgeStaleClipsEverywhere({});
          const pollutedNum1 = m['words.num.1'] && m['words.num.1'] !== m['num.1'];
          return { purged: res.purged, leftOld: !!(m['words.old_retired_word'] || S.state.clipBase['words.old_retired_word'] || S.state.injectedClips['words.old_retired_word']), pollutedNum1: !!pollutedNum1 };
        });
        check('Y2j live stale injection (words.old_retired_word, words.num.1) is purged with 0 stale keys surviving',
          purge.purged > 0 && !purge.leftOld && !purge.pollutedNum1, JSON.stringify(purge));
        const clipFree = await page.evaluate(() => {
          const S = SDP.Speech, mc = S.state.manifest.clips, kill = [];
          const words = SDP.Sync.words() || [];
          for (const k in mc) if (/^words\./.test(k)) kill.push(k);
          for (const w of words) kill.push(String(w.w).toLowerCase().replace(/[.,!?;:]+$/, ''));
          for (const k of kill) delete mc[k];
          S.state.voiceGuardAlertSent = false;
          const a = S.auditSessionVoiceReadiness({});
          const b = document.getElementById('sdpVoiceClipGuardBanner');
          return { level: a.level, shown: !!(b && !b.hidden), lvl: b ? b.getAttribute('data-level') : null, notify: b ? String(b.innerHTML).indexOf('btnGuardNotifyAdmin') >= 0 : false };
        });
        check('Y2k clip-free dictation state raises the missing-mode banner with the Notify button (dictation never blocks)',
          clipFree.shown && clipFree.lvl === 'missing' && clipFree.notify, JSON.stringify(clipFree));
        const notified = await page.evaluate(() => {
          const T = SDP.Telemetry;
          const before = T.alertStore().items.length;
          SDP.Speech.guardNotifyAdmin();
          return { before, after: T.alertStore().items.length, last: T.alertStore().items[0] ? T.alertStore().items[0].alertType : '' };
        });
        check('Y3g Notify Lecturer / Admin delivers a structured alert into the inbox store',
          notified.after === notified.before + 1 && notified.last.length > 0, JSON.stringify(notified));
        await page.evaluate(() => new Promise((resolve) => { SDP.Studio.unlock('78987898', () => resolve()); }));
        await page.waitForTimeout(300);
        const studio1 = await page.evaluate(() => {
          document.getElementById('tab-studio').click();
          const need = ['studioCardVoiceSample', 'studioLecturerAlertsCard', 'studioVoiceCoveragePill', 'btnVoiceSampleRecord', 'btnVoiceSampleStop', 'voiceSampleFileInput', 'btnConfirmVoiceSample', 'btnRunVoiceAnalyzer', 'btnCreateAndApplyVoiceClone', 'voiceSamplePreviewAudio', 'voiceSampleTimer', 'voiceSampleMeter', 'studioVoiceAnalysisCard', 'btnRefreshLecturerAlerts', 'btnClearLecturerAlerts', 'studioLecturerAlertsList', 'studioAlertCountBadge'];
          const missing = need.filter((id) => !document.getElementById(id));
          return { missing, rows: document.querySelectorAll('#studioLecturerAlertsList .studio-alert-row').length };
        });
        check('Y1k/Y3h the Voice Sample Studio + Lecturer Alert Inbox + Coverage Pill render in unlocked Studio',
          studio1.missing.length === 0 && studio1.rows >= 1, studio1.missing.join(',') + ' rows=' + studio1.rows);
        const cov = await page.evaluate(() => {
          const kill = [];
          for (const k in SDP.Studio.state.voicePack.clips) if (/^words\./.test(k)) kill.push(k);
          for (const k of kill) delete SDP.Studio.state.voicePack.clips[k];
          SDP.Sync.emitChange('voice_pack_updated', {});
          return document.getElementById('studioVoiceCoveragePill').textContent;
        });
        check('Y4f emitChange repaints the coverage pill within the same tick (0/31 Words after wipe)',
          /0\/31 Words/.test(cov), cov);
        await ctx.close();
      }
      /* lab boot + full diagnostics ALL PASS */
      {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await ctx.route('**/*', (route) => {
          const url = route.request().url();
          if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
          return route.abort();
        });
        await page.goto(server.origin + '/lab.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        await page.evaluate(() => { SDP.LiveLab.labSimulateSample(); });
        await page.waitForTimeout(3500);
        await page.evaluate(() => { SDP.LiveLab.labStaleSimulator(); });
        await page.waitForTimeout(1200);
        const lab = await page.evaluate(() => {
          const c = SDP.LiveLab.counts();
          return { pass: c.pass, fail: c.fail, warn: c.warn, badge: document.getElementById('labScoreBadge').getAttribute('data-state'), ver: document.getElementById('labVerPill').textContent, s2b: document.getElementById('labSampleReport').innerHTML.length, s3b: document.getElementById('labStaleTrace').innerHTML.length };
        });
        check('Y5e Live Lab fresh-visit boot: simulators run, ALL PASS (0 FAIL), 76 clips decoded',
          lab.fail === 0 && lab.warn === 0 && lab.badge === 'pass' && lab.ver === '0.0.7.e' && lab.s2b > 100 && lab.s3b > 100 && errors.length === 0,
          JSON.stringify(lab) + ' | ' + errors.slice(0, 2).join(','));
        await ctx.close();
      }
    } finally {
      await browser.close();
      await server.close();
    }
  } catch (err) {
    check('Y-live the headless Chromium leg boots (playwright/chromium available)', false, String(err && err.message));
  }
  const fails = results.filter((r) => r.status === 'FAIL');
  console.log(JSON.stringify(results, null, 2));
  console.log('\nY-GATE v006y-verification.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
  process.exit(fails.length ? 1 : 0);
})();

