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
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.7.e');
        w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e' })); } });
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
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.7.e');
        w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e' })); } });
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

  /* ── 3. R2 (F3): the Guide 4.0 spotlight — one card, four dots ───────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §3 Guide 4.0 spotlight
  {
    const app = await createApp({ before(w) {
      w.localStorage.removeItem('sdp.guide_seen');
      w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e' }));
    } });
    const steps = app.qa('#guideSteps .guide-step');
    check('G10.3a the hidden step list carries exactly four sentences', steps.length === 4, steps.length);
    check('G10.3b the step list is screen-reader only, never the visible card',
      !!app.byId('guideSteps') && app.byId('guideSteps').hidden === true);
    const modal = app.byId('guideModal');
    /* v0.0.6.x — the NO-BOOT-INTERRUPTION law: neither the briefing nor the
       guide opens on boot; the guide opens on demand (#btnGuideTop / Start). */
    check('G10.3c the guide stays closed on boot (the no-boot-interruption law) and opens on demand',
      !!modal && modal.hidden === true &&
      (app.byId('btnGuideTop').click(), app.byId('guideModal').hidden === false),
      modal ? (modal.hidden + '/' + modal.className) : 'missing');
    app.byId('btnGuideClose').click();
    check('G10.3d the spotlight renders Step 1 of 4 and the first sentence',
      app.byId('guideStepTag').textContent === 'Step 1 of 4' &&
      app.byId('guideStepText').textContent === 'Press Start Dictation to begin.',
      app.byId('guideStepTag').textContent + ' | ' + app.byId('guideStepText').textContent);
    check('G10.3e four dots ship and exactly the first is active',
      app.qa('#guideDots .guide-dot').length === 4 &&
      app.qa('#guideDots .guide-dot.is-active').length === 1 &&
      app.qa('#guideDots .guide-dot')[0].classList.contains('is-active') &&
      app.qa('#guideDots .guide-dot')[0].getAttribute('aria-current') === 'step');
    /* F3: the card must never expose badge/clutter text as the spoken line. */
    check('G10.3f the spotlight text is one clean sentence, never card chrome',
      !/Auto pause|Listen twice\. Write in five|Step \d of 4/.test(app.byId('guideStepText').textContent) &&
      app.byId('guideStepText').textContent.split('.').filter(Boolean).length === 1,
      app.byId('guideStepText').textContent);
    const footButtons = Array.from(app.q('#guideModal .modal-foot').querySelectorAll('button')).map((b) => b.id);
    check('G10.3g the guide carries exactly two buttons',
      /* v0.0.6.q Pillar 3: Exit is on the LEFT, ▶ Click Start Dictation Now on the RIGHT. */
      JSON.stringify(footButtons) === JSON.stringify(['btnGuideClose', 'btnGuideSkipStart']), footButtons.join(','));
    check('G10.3h the retired step/next/replay controls are gone',
      app.byId('guideNextStep') === null && app.byId('guideReplayStep') === null && app.byId('guideSpeak') === null);
    app.byId('guideLangPill').click();
    check('G10.3i the language pill re-paints the SAME step in Sinhala',
      app.byId('guideStepTag').textContent.indexOf('පියවර') === 0 &&
      /[\u0D80-\u0DFF]/.test(app.byId('guideStepText').textContent),
      app.byId('guideStepTag').textContent + ' | ' + app.byId('guideStepText').textContent.slice(0, 30));
    app.byId('guideLangPill').click();
    /* D-G1: a narration failure must surface, never be swallowed. */
    const viewSrc = require('node:fs').readFileSync(path.join(ROOT, 'data/sdp-ui-views.js'), 'utf8');
    const at = viewSrc.indexOf('function startGuideNarration');
    const block = viewSrc.slice(at, at + 2600);
    check('G10.3j a narration failure surfaces a toast and the tap banner',
      /catch\s*\(\s*e\s*\)\s*\{[\s\S]{0,500}?showGuideTapBanner\(\)/.test(block) &&
      /console\.error/.test(block));
    check('G10.3k every narration callback re-checks the run id (no F2 loop)',
      /runId !== guideState\.guideRunId/.test(block) && /guideState\.guideRunId \+= 1/.test(viewSrc));
    app.byId('btnGuideClose').click();
    check('G10.3l closing hides the modal and stamps the visit',
      app.byId('guideModal').hidden === true && app.w.localStorage.getItem('sdp.guide_seen') === '0.0.7.e');
    app.close();
  }

  /* ── 4. R2: no 700 ms Youdao watchdog, no tap-restart loop ───────────── */
  // contract: docs/CHANGELOG_LEDGER.md §R2 — the watchdog and the loop are dead
  {
    const viewSrc = require('node:fs').readFileSync(path.join(ROOT, 'data/sdp-ui-views.js'), 'utf8');
    check('G10.4a the 700 ms watchdog never ships again', !/armGuideWatchdog/.test(viewSrc) && !/\}, 700\);/.test(viewSrc));
    check('G10.4b a banner tap resumes the CURRENT step, never step 1',
      /startGuideNarration\(guideState\.activeStep\)/.test(viewSrc) &&
      !/onGuideBannerTap[\s\S]{0,400}?startGuideNarration\(0\)/.test(viewSrc));
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.7.e');
        w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e' })); } });
    app.byId('btnReplayGuide').click();
    await app.settle(4);
    const banner = app.byId('guideTapBanner');
    check('G10.4c the tap banner exists and starts hidden while narration is healthy',
      !!banner && banner.hidden === true && app.byId('guideModal').hidden === false,
      banner ? String(banner.hidden) : 'missing');
    /* the banner explains what to tap */
    app.SDP.Views.showGuideTapBanner();
    check('G10.4d the banner explains what to tap',
      /voice|sound|tap/i.test(banner.textContent), banner.textContent.slice(0, 80));
    /* tapping primes audio once and hides itself — it never restarts step 1 */
    banner.dispatchEvent(new app.w.MouseEvent('click', { bubbles: true }));
    await app.settle(6);
    check('G10.4e tapping the banner primes speech and hides itself',
      app.SDP.Speech.isUnlocked() === true &&
      (banner.hidden === true || banner.classList.contains('hidden')));
    app.close();
  }

  /* ── 5. R4: the voice lock preference is honoured ───────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 unified / custom
  {
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.7.e');
        /* appliedSettingsRev pins the student's own lock against adoption. */
        w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e', voiceLock: 'custom', voiceSource: 'native', lang: 'en', langResetV001e: true, defaultsResetV001f: true, appliedSettingsRev: 99 }));
      }
    });
    check('G10.5a a custom voice lock is preserved, not overwritten',
      app.SDP.Data.settings().voiceLock === 'custom', app.SDP.Data.settings().voiceLock);
    check('G10.5b the settings screen exposes the lock selector', !!app.byId('setVoiceLock'));
    app.close();
  }

  /* ── 6. R9: the 900 ms cold-boot autoplay affordance ─────────────────── */
  // contract: docs/CHANGELOG_LEDGER.md §R9 guideAutoplayBanner
  {
    const app = await createApp({ before(w) {
      w.localStorage.removeItem('sdp.guide_seen');
      w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e' }));
    } });
    /* v0.0.6.x: open the guide on demand before asserting its internals. */
    app.byId('btnGuideTop').click();
    await app.settle(2);
    const banner = app.byId('guideAutoplayBanner');
    check('G10.6a the autoplay banner ships in the guide modal',
      !!banner && app.byId('guideModal').hidden === false, !!banner);
    check('G10.6b it starts hidden so it cannot nag a working device',
      !!banner && (banner.hidden === true || banner.classList.contains('hidden')));
    app.SDP.Views.showGuideAutoplayBanner();
    check('G10.6c it can be shown with the translated affordance text',
      app.SDP.Views.guideAutoplayBannerVisible() === true &&
      /tap/i.test(banner.textContent), banner.textContent);
    app.SDP.Views.hideGuideAutoplayBanner();
    check('G10.6d and hidden again the moment speech starts',
      app.SDP.Views.guideAutoplayBannerVisible() === false);
    check('G10.6e both languages carry the string',
      /tap/i.test(app.SDP.STRINGS_EN.guideAutoplayBanner) &&
      /[\u0D80-\u0DFF]/.test(app.SDP.STRINGS_SI.guideAutoplayBanner));
    app.close();
  }

  /* ── 7. R1 (F1): the ghost-voice kill switch ─────────────────────────── */
  // contract: docs/CHANGELOG_LEDGER.md §v0.0.5.c — Session paused. once, zero late "Afraid."
  {
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.7.e');
        w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e', mode: 'paper', writeSecs: 5, repeats: 2, pauseSecs: 0.5, autoAdvance: true,
          rate: 1, volume: 1, lang: 'en', theme: 'dark', guideAutoPlay: false,
          voiceLock: 'unified', appliedSettingsRev: 99, defaultsResetV001f: true
        }));
      }
    });
    app.byId('btnStart').click();
    await app.settle(4);
    check('G10.7a Start opens a live listening beat', /Listen Carefully/.test(app.byId('beatStateText').textContent),
      app.byId('beatStateText').textContent);
    app.SDP.Engine.pause();
    await app.settle(4);
    const said = app.SDP.Speech.lastUtterances();
    check('G10.7b pausing during listening speaks "Session paused." exactly once',
      said.filter((l) => l === 'Session paused.').length === 1 && said[said.length - 1] === 'Session paused.',
      JSON.stringify(said));
    check('G10.7c the beat is frozen and the cockpit says so',
      app.SDP.Engine.isPaused() === true && /Paused/.test(app.byId('beatStateText').textContent),
      app.SDP.Engine.isPaused() + ' / ' + app.byId('beatStateText').textContent);
    /* F1: every pending repeat chain, number cue and word clip must stay dead. */
    const stopAt = said.length;
    await app.advance(8000);
    await app.settle(4);
    const tail = app.SDP.Speech.lastUtterances().slice(stopAt);
    check('G10.7d no late word/repeat cue leaks after the pause (F1)',
      tail.every((l) => !/Afraid|Number \d|Preparing lesson/.test(l)), JSON.stringify(tail));
    app.close();
  }

  /* ── 8. R3: the classroom opening cue chain ──────────────────────────── */
  // contract: docs/CHANGELOG_LEDGER.md §v0.0.5.c — cmd.preparing → num.N → the word
  {
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.7.e');
        w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e', mode: 'paper', writeSecs: 5, repeats: 2, pauseSecs: 0.5, autoAdvance: true,
          rate: 1, volume: 1, lang: 'en', theme: 'dark', guideAutoPlay: false,
          voiceLock: 'unified', appliedSettingsRev: 99, defaultsResetV001f: true
        }));
      }
    });
    app.byId('btnStart').click();
    await app.settle(4);
    let sawWriting = false, writeText = '';
    for (let i = 0; i < 48; i++) {
      await app.advance(250);
      if (app.SDP.Engine.state() === 'writing') { sawWriting = true; writeText = app.byId('beatStateText').textContent; break; }
    }
    const said = app.SDP.Speech.lastUtterances();
    /* v0.0.6.x: "Number 1." plays through the unified ELEVEN clip tier (the
       committed num.1 MP3) rather than speechSynthesis, so the utterance log
       carries the command; the number itself is heard via the clip ladder. */
    check('G10.8a the lesson opens with cmd.preparing (the num.1 take rides the unified clip tier)',
      said[0] === 'Preparing lesson. Listen carefully.',
      JSON.stringify(said.slice(0, 3)));
    check('G10.8b the chain then hands over to the write window',
      sawWriting && /Write Word #1 in Your Book/.test(writeText),
      app.SDP.Engine.state() + ' / ' + writeText);
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
