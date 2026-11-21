#!/usr/bin/env node
'use strict';
/* X-GATE — tests/v006x-verification.cjs — the v0.0.6.x six-defect release
 * verification gate (X1–X6):
 *   X1 the CLEAN-WORD TTS law (no pseudo-phonetics ever reach a TTS engine)
 *   X2 ?output_format=mp3_44100_128 on every classroom TTS request
 *   X3 the 74-clip Session-14 pack (3:1:9:0:3 MP3, sha1 pins) + the 90-word lexicon
 *   X4 the stale-word purge (commit + applyManifest + #btnForceRegenWords)
 *   X5 the unified Studio Voice & Clone Control Center
 *   X6 Live Lab v2.0 (IIFE scope, G9.5a, fresh-visit ALL PASS in real Chromium)
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R-V006X. */
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

function mp3Signature(buf) {
  for (let i = 0; i < Math.min(buf.length - 4, 4096); i++) {
    if (buf[i] === 0xFF && (buf[i + 1] & 0xE0) === 0xE0) {
      return [((buf[i + 1] >> 3) & 3), ((buf[i + 1] >> 1) & 3), ((buf[i + 2] >> 4) & 15), ((buf[i + 2] >> 2) & 3), ((buf[i + 3] >> 6) & 3)].join(':');
    }
  }
  return '';
}

(async function main() {
  const studio = readText('data/studio.js');
  const speech = readText('data/sdp-audio-speech.js');
  const labJs = readText('data/sdp-live-lab.js');
  const labHtml = readText('lab.html');
  const sw = readText('sw.js');
  const pack = readJSON('data/elevenlabs-audio.json');
  const session = readJSON('data/session.json');

  /* ── X1 — the CLEAN-WORD TTS law ─────────────────────────────────────── */
  check('X1a buildQueue() speaks the clean word — only curated RP_TTS_OVERRIDES heterophones may be respelled',
    /ttsText: str\(RP_TTS_OVERRIDES\[text\.toLowerCase\(\)\] \|\| text\)/.test(studio) &&
    !/w\.ttsHint \|\| RP_TTS_OVERRIDES\[text\.toLowerCase\(\)\] \|\| text/.test(studio),
    'buildQueue ttsText');
  check('X1b requestClip() POSTs clean item.text (never item.ttsText, never a hyphenated pseudo-phonetic)',
    /text: str\(RP_TTS_OVERRIDES\[str\(item\.text\)\.toLowerCase\(\)\] \|\| item\.text\)/.test(studio) &&
    !/text: str\(item\.ttsText \|\| item\.text\)/.test(studio),
    'requestClip body');
  check('X1c the RP verifier never overwrites the spoken text (rpRespelling is display-only)',
    !/item\.ttsText = res\.rpRespelling;/.test(studio) && /rpRespelling is display-only/i.test(studio),
    'verifier');
  check('X1d resynthWmRow() browser-TTS preview speaks the clean word too',
    /SDP\.Speech\.say\(\[str\(RP_TTS_OVERRIDES\[str\(word\.w\)\.toLowerCase\(\)\] \|\| word\.w\)\]/.test(studio) &&
    !/SDP\.Speech\.say\(\[str\(list\[idx\]\.ttsHint\) \|\| str\(word\.w\)\]/.test(studio),
    'resynth preview');
  check('X1e buildFallbackRpHint() survives as a DISPLAY-ONLY guide (W2d law) and ttsHint ships in session.json',
    /function buildFallbackRpHint/.test(studio) && /rpSource = 'fallback'/.test(studio) &&
    session.words.every((w) => typeof w.p === 'string' && w.p.length > 2),
    'hint display');

  /* ── X2 — the broadcast output-format law ────────────────────────────── */
  check('X2a EVERY non-timestamped requestClip() URL appends ?output_format=mp3_44100_128',
    /var url = \(introMode && attempt === 0\) \? \(genUrl \+ '\/with-timestamps\?output_format=mp3_44100_128'\)/.test(studio) &&
    /genUrl \+ \(genUrl\.indexOf\('\?'\) >= 0 \? '&' : '\?'\) \+ 'output_format=mp3_44100_128'/.test(studio) &&
    !/\(introMode \? \(genUrl \+ '\?output_format=mp3_44100_128'\) : genUrl\)/.test(studio),
    'requestClip url');
  check('X2b the Live Lab synthesis legs all pin mp3_44100_128 (batch repair, clone test, Stage E)',
    (labJs.match(/output_format=mp3_44100_128/g) || []).length >= 3,
    String((labJs.match(/output_format=mp3_44100_128/g) || []).length));

  /* ── X3 — the 74-clip Session-14 pack + the 90-word lexicon ──────────── */
  {
    const clips = pack.clips || {};
    const keys = Object.keys(clips);
    const count = (re) => keys.filter((k) => re.test(k)).length;
    check('X3a the pack ships exactly the 76 canonical clips (31 words + 31 num + 6 cmd + 4 guide + 4 intro)',
      keys.length === 76 && count(/^words\./) === 31 && count(/^num\.\d+$/) === 31 &&
      count(/^cmd\./) === 6 && count(/^guide\.en\./) === 4 && count(/^_intro_male_[1-4]$/) === 4,
      String(keys.length));
    const sessionWords = session.words.map((w) => String(w.w).toLowerCase());
    const missing = sessionWords.filter((w) => !clips['words.' + w]);
    check('X3b every one of the 31 active Session-14 words has a clip (communications through technology)',
      missing.length === 0, missing.join(','));
    let badSig = [], badHash = [], badVoice = [];
    for (const k of keys) {
      const e = clips[k];
      const buf = Buffer.from(e.b64, 'base64');
      if (mp3Signature(buf) !== '3:1:9:0:3') badSig.push(k + ':' + mp3Signature(buf));
      const want = 'sha1:' + crypto.createHash('sha1').update(e.text + '|' + e.voiceId + '|' + e.modelId).digest('hex');
      if (e.hash !== want) badHash.push(k);
      if (e.voiceId !== 'Xb7hH8MSUJpSbSDYk0k2' && !/^_intro_male_/.test(k)) badVoice.push(k);
    }
    check('X3c all 74 clips carry the genuine MPEG-1 Layer III 44.1kHz 128kbps mono signature 3:1:9:0:3',
      badSig.length === 0, badSig.slice(0, 4).join(','));
    check('X3d every clip pins its sha1(text|voiceId|modelId) content hash',
      badHash.length === 0, badHash.slice(0, 4).join(','));
    check('X3e every classroom clip is stamped the unified Alice voice (Xb7hH8MSUJpSbSDYk0k2)',
      badVoice.length === 0, badVoice.join(','));
    /* the 90-word lexicon */
    const sync = readText('data/sdp-data-sync.js');
    const i = sync.indexOf('CAMBRIDGE_B1_RP_LEXICON = {');
    let depth = 0, end = -1;
    for (let k2 = sync.indexOf('{', i); k2 < sync.length; k2++) {
      if (sync[k2] === '{') depth += 1;
      else if (sync[k2] === '}') { depth -= 1; if (depth === 0) { end = k2; break; } }
    }
    const lex = vm.runInNewContext('(' + sync.slice(sync.indexOf('{', i), end + 1) + ')');
    const lexKeys = Object.keys(lex);
    const missingLex = sessionWords.filter((w) => !lex[w]);
    check('X3f CAMBRIDGE_B1_RP_LEXICON carries all 90 entries (Sessions 11 + 12 + 14)',
      lexKeys.length === 90, String(lexKeys.length));
    check('X3g every active Session-14 word ships complete p + pos + m + si + s in session.json (the v0.0.7.e repaired-data law)',
      session.words.every((w) => /^\//.test(String(w.p)) && /\.$/.test(String(w.pos)) && String(w.m).length >= 15 && /[\u0D80-\u0DFF]/.test(String(w.si)) && String(w.s).length > 10),
      missingLex.join(','));
    check('X3h session.json words carry the repaired Cambridge IPA + natural B1 sentences + clean UK audio URLs (no -us/-au.mp3)',
      session.words.every((w) => /^\/.*\/$/.test(String(w.p)) && String(w.s).length > 20) &&
      session.words.every((w) => String(w.audio || '').indexOf('-us.mp3') < 0 && String(w.audio || '').indexOf('-au.mp3') < 0),
      'session words');
  }

  /* ── X4 — the stale-word purge ───────────────────────────────────────── */
  check('X4a purgeStaleWordsFromPack() gates voicePackPayload() AND commitVoicePack()',
    /function purgeStaleWordsFromPack/.test(studio) &&
    /base\.clips = purgeStaleWordsFromPack\(packClipsForDisk\(\), currentWords\(\)\);/.test(studio) &&
    /try \{ purgeStaleWordsFromPack\(ST\.voicePack\.clips, currentWords\(\)\); \} catch \(ePW\) \{\}/.test(studio),
    'purge wiring');
  check('X4b applyManifest() drops old words.* keys when the incoming wordsRev advances (no resurrection)',
    /var wordsAdvance = Number\(next\.wordsRev \|\| 0\) > Number\(state\.manifestWordsRev \|\| 0\);/.test(speech) &&
    /if \(wordsAdvance && \/\^words\\\.\/\.test\(k\)\) continue;/.test(speech),
    'applyManifest');
  check('X4c #btnForceRegenWords wipes pack + clipBase + CacheStorage and re-synthesizes the 30 active words',
    /btnForceRegenWords/.test(studio) && /btn\('btnForceRegenWords'/.test(studio) &&
    /delete ST\.voicePack\.clips\[keys\[k\]\]/.test(studio) &&
    /delete base\[bk\[b\]\]/.test(studio) &&
    /caches\.open\('sdp-audio-clips'\)/.test(studio) &&
    /generateClips\(\{ force: true, keys: wk \}/.test(studio),
    'force regen');
  check('X4d the pack header advances wordsRev (1797000000027) so older packs purge their stale words',
    Number(pack.wordsRev) === 1797000000027 && Number(pack.syncRev) === 1797000000027,
    String(pack.wordsRev));

  /* ── X5 — the unified Voice & Clone Control Center ───────────────────── */
  check('X5a #studioCardClassroomVoice is the single control center with the unified voice dropdown',
    /id="studioClassroomVoiceSelect"/.test(studio) && /Alice — Energetic British RP Female \(Default\)/.test(studio) &&
    /id="studioClassroomCustomVoiceId"/.test(studio),
    'dropdown');
  check('X5b the four canonical actions ship (Apply / Wipe & Re-Generate 30 Words / Re-Bake 70 Clips / Open Live Lab)',
    /btnApplyClassroomVoice/.test(studio) && /btnForceRegenWords/.test(studio) &&
    /btnRebakeClassroomVoice/.test(studio) && /btnOpenLiveLab/.test(studio),
    'actions');
  check('X5c 🔄 Fetch My Cloned Voices populates BOTH selectors and auto-selects the cloned voice',
    /btnFetchClassroomClonedVoices/.test(studio) &&
    /byId\('studioBriefingVoiceSelect'\)/.test(studio) &&
    /if \(cloneId\) cSel\.value = cloneId;/.test(studio) && /if \(cloneId\) bSel\.value = 'id:' \+ cloneId;/.test(studio),
    'fetch wiring');
  check('X5d the retired briefing card keeps every DOM id inside the Advanced drawer',
    /function briefingVoicesCardMarkup\(\)/.test(studio) &&
    /briefingVoicesCardMarkup\(\) \+ settingsCardMarkup\(\)/.test(studio) &&
    ['studioCardBriefingVoices', 'studioBriefingVoiceSelect', 'studioBriefingCustomVoiceId', 'btnFetchClonedVoices',
     'btnStudioBriefingVoices', 'btnPreviewBriefingBeat', 'studioBriefingVoiceBar'].every((id) => studio.indexOf(id) >= 0),
    'briefing ids');
  check('X5e the voice lock bar is dynamic (never a stale "Locked: Alice" badge with a clone active)',
    /id="studioVoiceLockBar"/.test(studio) && /'🟢 Active Cloned Voice: ' \+ chosenClassroomVoiceName\(\)/.test(studio),
    'lock bar');
  /* live jsdom: the unified card + drawer render coherently after unlock-less mount */
  {
    const app = await createApp({ before(w) {
      w.localStorage.setItem('sdp.guide_seen', '0.0.6.z');
      w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.6.z' }));
    } });
    check('X5f live: chosenClassroomVoiceId() defaults to Alice; a clone applies + persists (five-key law)',
      app.SDP.Studio.chosenClassroomVoiceId() === 'Xb7hH8MSUJpSbSDYk0k2' &&
      app.SDP.Studio.applyClassroomVoice('AbCdEf0123456789AbCdEf0123456789', 'X Clone') === true &&
      app.SDP.Studio.chosenClassroomVoiceId() === 'AbCdEf0123456789AbCdEf0123456789',
      app.SDP.Studio.chosenClassroomVoiceId());
    app.close();
  }

  /* ── X6 — Live Lab v2.0 ──────────────────────────────────────────────── */
  check('X6a lab.html ships 9 stations (unified 0.0.7.e: +Station 2B +Station 3B +Station 7) + the 1-click batch word repair tool',
    (labHtml.match(/<section class="card">/g) || []).length === 9 && /STATION 2B/.test(labHtml) && /STATION 3B/.test(labHtml) &&
    /btnLabBatchRepairWords/.test(labHtml) && /labBatchStatus/.test(labHtml) && /STATION 7/.test(labHtml) &&
    /v4\.0/.test(labHtml) === false && /0\.0\.6\.z/.test(labHtml) === false,
    'lab shell');
  check('X6b sdp-live-lab.js parses as strict ES5 with every station INSIDE the IIFE and labKey() defined',
    (function () { try { acorn.parse(labJs, { ecmaVersion: 5, sourceType: 'script' }); return true; } catch (e) { return false; } })() &&
    /function labKey\(\)/.test(labJs) &&
    labJs.indexOf('function labKey') < labJs.indexOf('function station2') &&
    labJs.indexOf('function station3') < labJs.indexOf("})(typeof window !== 'undefined' ? window : this);") &&
    /function station2\(\)/.test(labJs) && /function station3\(\)/.test(labJs),
    'IIFE scope');
  check('X6c the G9.5a law holds (no Web-Audio media-element tap) and labKey never reads localStorage',
    labJs.indexOf('createMediaElementSource') < 0 && !/localStorage\.getItem\('sdp\.studio'\)/.test(labJs) &&
    /SDP\.Studio\.secrets/.test(labJs),
    'g9.5');
  check('X6d Station 5 proactively registers ./sw.js + opens sdp-audio-clips and treats offline raw as informational',
    /serviceWorker\.register\('\.\/sw\.js'\)/.test(labJs) &&
    /caches\.open\('sdp-audio-clips'\)/.test(labJs) &&
    /raw offline is informational/.test(labJs),
    'station5');
  check('X6e SDP.LiveLab exports the unified 0.0.7.e with the low-credit verifier + batch repair + the no-key legs are informational (never a fresh-visit FAIL)',
    /version: '0\.0\.7\.e'/.test(labJs) && /lowCreditVerify: lowCreditVerify/.test(labJs) && /labBatchRepairWords: labBatchRepairWords/.test(labJs) && /labStaleSimulator: labStaleSimulator/.test(labJs) && /labSimulateSample: labSimulateSample/.test(labJs) &&
    /no key on this device — the live \/v1\/voices leg stays informational/.test(labJs),
    'exports');
  check('X6f sw.js precaches the lab files and pins the sdp-v0.0.6.z-s39 shell',
    /'\.\/data\/sdp-live-lab\.js'/.test(sw) && /SW_VERSION = 'sdp-v0\.0\.7\.e-s44'/.test(sw),
    'sw pin');

  /* X6g — the real-Chromium boot: lab.html opens ✓ ALL PASS (0 FAIL) */
  {
    let chromiumOk = false, chromiumDetail = 'not run';
    try {
      const { chromium } = require('playwright-core');
      const serverChromium = require('@sparticuz/chromium');
      require('./chromium-env.cjs').ensureChromiumLibs();
      const { start } = require('./static-server.cjs');
      const server = await start({ root: ROOT });
      const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
      const args = serverChromium.args.filter((a) => ![
        '--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'
      ].includes(a));
      const browser = await chromium.launch({ headless: true, executablePath, args });
      try {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const page = await ctx.newPage();
        await ctx.route('**/*', (route) => {
          const url = route.request().url();
          if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
          return route.abort(); /* hermetic: external legs must be informational */
        });
        await page.goto(server.origin + '/lab.html', { waitUntil: 'domcontentloaded' });
        const read = () => page.evaluate(() => ({
          badge: (document.getElementById('labScoreBadge') || {}).textContent || '',
          state: (document.getElementById('labScoreBadge') || {}).getAttribute('data-state') || '',
          pass: (document.getElementById('labScorePass') || {}).textContent || '',
          warn: (document.getElementById('labScoreWarn') || {}).textContent || '',
          fail: (document.getElementById('labScoreFail') || {}).textContent || '',
          pack: (document.getElementById('labPackStatus') || {}).textContent || ''
        }));
        let s = await read();
        for (let t = 0; t < 90 && !(s.state && s.fail === '0' && s.pack.indexOf('✓') === 0); t++) {
          await page.waitForTimeout(500);
          s = await read();
        }
        check('X6g real Chromium: lab.html boots with ALL PASS / 0 FAIL and all 76 clips decoded',
          s.state === 'pass' && s.fail === '0' && s.warn === '0' && s.badge.indexOf('ALL PASS') >= 0 && s.pack.indexOf('76 clips') >= 0,
          JSON.stringify(s));
        /* the full 6-station run must also stay at 0 FAIL */
        await page.click('#btnLabRunAll');
        for (let t = 0; t < 50; t++) { await page.waitForTimeout(500); s = await read(); if (s.fail !== '0') break; }
        for (let t = 0; t < 20 && s.warn !== '0'; t++) { await page.waitForTimeout(500); s = await read(); }
        chromiumOk = s.state === 'pass' && s.fail === '0';
        chromiumDetail = JSON.stringify(s);
        check('X6h real Chromium: the FULL 6-station diagnostic run stays ALL PASS (0 FAIL)',
          chromiumOk, chromiumDetail);
        await ctx.close();
      } finally {
        await browser.close();
        await server.close();
      }
    } catch (eCh) {
      check('X6g real Chromium: lab.html boots with ALL PASS / 0 FAIL and all 76 clips decoded', false, String(eCh).slice(0, 200));
    }
  }

  /* ── report ───────────────────────────────────────────────────────────── */
  const failed = results.filter((r) => r.status === 'FAIL');
  results.forEach((r) => { if (r.status !== 'PASS') console.log('FAIL  ' + r.test + '  [' + r.detail + ']'); });
  console.log('\nX-GATE v006x-verification.cjs — ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
  process.exitCode = failed.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
