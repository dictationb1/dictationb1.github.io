#!/usr/bin/env node
'use strict';
/* G10 — the voice spine and the Guide 2.0 narration journey (workstream P1).
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 unified professor voice
 * contract: docs/UI_COMPONENT_GUIDE.md §3 Guide 2.0
 * Deterministic: jsdom + fake timers + a scripted speechSynthesis stub. No
 * network, no live TTS, no credits. */
const path = require('node:path');
const { createApp } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}

/* A believable platform voice list: two British females, one British male that
 * must never win, one American female, and a decoy with no lang at all. */
function fakeVoices() {
  return [
    { name: 'Daniel', lang: 'en-GB', localService: false, voiceURI: 'Daniel' },
    { name: 'Google UK English Female', lang: 'en-GB', localService: false, voiceURI: 'Google UK English Female' },
    { name: 'Alice', lang: 'en-GB', localService: true, voiceURI: 'Alice' },
    { name: 'Samantha', lang: 'en-US', localService: true, voiceURI: 'Samantha' },
    { name: 'Broken', voiceURI: 'Broken' }
  ];
}

function installVoices(app, list) {
  /* jsdom exposes no speechSynthesis; define it so the resolver sees a device. */
  const spoken = [];
  const synth = {
    speaking: false,
    paused: false,
    getVoices: () => list,
    speak: (u) => { spoken.push(u); },
    cancel: () => {},
    pause: () => { synth.paused = true; },
    resume: () => { synth.paused = false; },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  Object.defineProperty(app.w, 'speechSynthesis', { value: synth, configurable: true, writable: true });
  return { spoken, synth };
}

(async function main() {
  /* ── 1. D-V1: the ReferenceError that killed v0.0.1.b ────────────────── */
  // contract: docs/CHANGELOG_LEDGER.md §D-V1 — pickVoice must always be a function
  {
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.d'); } });
    check('G10.1a the speech module exports pickVoice as a function',
      typeof app.SDP.Speech.pickVoice === 'function');
    let picked = 'unset';
    let threw = null;
    try { picked = app.SDP.Speech.pickVoice('en-GB'); } catch (e) { threw = String(e && e.name); }
    check('G10.1b pickVoice never throws when the device has no voices yet',
      threw === null, threw);
    check('G10.1c pickVoice resolves to null (never undefined) while warming',
      picked === null, String(picked));
    app.close();
  }

  /* ── 2. D-V2: one unified British female professor, male names banned ── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 male-name blacklist
  {
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.d'); } });
    const list = fakeVoices();
    installVoices(app, list);
    await new Promise((resolve) => app.SDP.Speech.selectProfessorVoice((v) => { app.w.__picked = v; resolve(); }));
    const picked = app.w.__picked;
    check('G10.2a the unified voice resolver returns a voice', !!picked, String(picked && picked.name));
    check('G10.2b a British female voice wins the unified lock',
      !!picked && /female|alice/i.test(picked.name) && /en-GB/i.test(picked.lang),
      picked && (picked.name + ' / ' + picked.lang));
    check('G10.2c every blacklisted male name scores -100',
      list.filter((v) => /^(Daniel|Fred|George|Mark|David)$/.test(v.name))
        .every((v) => app.SDP.Speech.scoreVoice(v) === -100),
      JSON.stringify(list.map((v) => [v.name, app.SDP.Speech.scoreVoice(v)])));
    check('G10.2d a voice with no lang can never be selected',
      app.SDP.Speech.scoreVoice({ name: 'Broken', voiceURI: 'Broken' }) < 0);
    check('G10.2e an en-US voice still loses to the en-GB professor',
      app.SDP.Speech.scoreVoice({ name: 'Samantha', lang: 'en-US' }) <
      app.SDP.Speech.scoreVoice({ name: 'Google UK English Female', lang: 'en-GB' }));
    app.close();
  }

  /* ── 3. R3: Guide 2.0 auto-opens, speaks step 1, and advances ────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §3 guide step machine
  {
    const app = await createApp({ before(w) { w.localStorage.removeItem('sdp.guide_seen'); } });
    const steps = app.qa('.guide-step');
    check('G10.3a the guide ships exactly four steps', steps.length === 4, steps.length);
    const modal = app.byId('guideModal');
    check('G10.3b the guide auto-opens for a first-time student',
      !!modal && modal.hidden === false && modal.classList.contains('is-open'),
      modal ? (modal.hidden + '/' + modal.className) : 'missing');
    check('G10.3c step 1 is the active step', app.qa('.guide-step.guide-active').length === 1 &&
      app.q('.guide-step.guide-active').getAttribute('data-step') === '0');
    /* the tap banner is the D-V6 fallback: it must exist but stay hidden while
     * narration is healthy */
    const banner = app.byId('guideTapBanner');
    check('G10.3d #guideTapBanner is a real element and starts hidden',
      !!banner && (banner.hidden === true || banner.classList.contains('hidden')));
    app.byId('guideNextStep').click();
    await app.settle(6);
    check('G10.3e "next" advances to step 2 exactly once',
      app.q('.guide-step.guide-active').getAttribute('data-step') === '1',
      app.q('.guide-step.guide-active').getAttribute('data-step'));
    app.byId('guideReplayStep').click();
    await app.settle(4);
    check('G10.3f "replay" stays on the current step',
      app.q('.guide-step.guide-active').getAttribute('data-step') === '1');
    app.byId('guideSpeak').click();
    await app.settle(4);
    check('G10.3g #guideSpeak restarts narration from step 1',
      app.q('.guide-step.guide-active').getAttribute('data-step') === '0',
      app.q('.guide-step.guide-active').getAttribute('data-step'));
    /* D-G1: the v0.0.1.b `catch (e) {}` swallowed every narration failure. The
     * honest failure path is the banner + the documented pause/resume pair. */
    const viewSrc = require('node:fs').readFileSync(path.join(ROOT, 'data/sdp-ui-views.js'), 'utf8');
    const at = viewSrc.indexOf('function startGuideNarration');
    const block = viewSrc.slice(at, at + 2600);
    check('G10.3h a narration failure surfaces a toast and the tap banner',
      /catch\s*\(\s*e\s*\)\s*\{[\s\S]{0,500}?showGuideTapBanner\(\)/.test(block) &&
      /console\.error/.test(block));
    app.close();
  }

  /* ── 4. R3: a silenced device falls back to the tap banner ──────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §3 600 ms watchdog
  {
    /* A device whose audio is blocked: playGuideStep accepts the call but never
       starts or completes, which is exactly what Chrome does before a gesture. */
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.d'); } });
    app.SDP.Speech.playGuideStep = function () { return false; };
    /* re-open the guide with a blocked engine: openGuide() arms the 600 ms
       watchdog, and nothing will ever report "speaking" */
    app.byId('btnReplayGuide').click();
    await app.settle(6);
    const hiddenFirst = app.byId('guideTapBanner').hidden;
    await app.advance(900);
    const banner = app.byId('guideTapBanner');
    check('G10.4a a silent device reveals the tap banner within the watchdog',
      hiddenFirst === true && banner.hidden === false && !banner.classList.contains('hidden'),
      banner ? (hiddenFirst + '->' + banner.hidden + '/' + banner.className) : 'missing');
    check('G10.4b the banner explains what to tap',
      !!banner && /voice|sound|tap/i.test(banner.textContent), banner && banner.textContent.slice(0, 80));
    /* tapping the banner primes the audio engine and starts from step 1 */
    banner.dispatchEvent(new app.w.MouseEvent('click', { bubbles: true }));
    await app.settle(6);
    check('G10.4c tapping the banner primes speech and hides itself',
      app.SDP.Speech.isUnlocked() === true &&
      (banner.hidden === true || banner.classList.contains('hidden')));
    app.close();
  }

  /* ── 5. R4: the voice lock preference is honoured ───────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 unified / custom
  {
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.1.d');
        /* appliedSettingsRev pins the student's own lock against adoption. */
        w.localStorage.setItem('sdp.settings', JSON.stringify({ voiceLock: 'custom', voiceSource: 'native', lang: 'en', appliedSettingsRev: 4 }));
      }
    });
    check('G10.5a a custom voice lock is preserved, not overwritten',
      app.SDP.Data.settings().voiceLock === 'custom', app.SDP.Data.settings().voiceLock);
    check('G10.5b the settings screen exposes the lock selector', !!app.byId('setVoiceLock'));
    app.close();
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ gate: 'G10', passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  } else {
    for (const r of results) if (r.status === 'FAIL') console.log('FAIL  ' + r.test + (r.detail ? '  [' + r.detail + ']' : ''));
    console.log('G10 voice-guide.cjs — ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
  }
  process.exit(failed.length ? 1 : 0);
})();
