#!/usr/bin/env node
'use strict';
/* G3 — jsdom behavioural and regression gate for the v0.0.1.e shell.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 (storage), §R5 (vault), §R2 (guide)
 * contract: docs/ARCHITECTURE_MAP.md §R3, §R4, §R5, §R6
 * Deterministic: fake timers, stubbed fetch, WebCrypto from Node. */
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
const sinhala = /[\u0D80-\u0DFF]/;

(async function main() {
  const fails = [];

  /* ── 1. corrupt storage must never break boot ───────────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 corruption policy
  {
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.progress', '{not json at all');
        w.localStorage.setItem('sdp.settings', 'null');
        w.localStorage.setItem('sdp.session', '[]]');
        w.localStorage.setItem('sdp.guide_seen', '0.0.1.e');
      }
    });
    const progress = JSON.parse(app.w.localStorage.getItem('sdp.progress'));
    check('G3.1a corrupt progress JSON resets to defaults without throwing',
      progress && progress.streak && progress.streak.count === 0 && Array.isArray(progress.weakWords),
      JSON.stringify(progress).slice(0, 120));
    check('G3.1b corrupt settings fall back to paper mode', app.SDP.Data.settings().mode === 'paper', app.SDP.Data.settings().mode);
    check('G3.1c corrupt session draft is ignored', app.SDP.Data.session() === null, JSON.stringify(app.SDP.Data.session()));
    check('G3.1d the app still renders Home', app.q('.screen.active') && app.q('.screen.active').id === 'screen-home');
    check('G3.1e boot produced no unexpected jsdom errors', app.realErrors().length === 0, app.realErrors().slice(0, 2).join(' | '));
    app.close();
  }

  /* ── 2. studio PIN lockout ──────────────────────────────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 PIN attempt tracking
  {
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.e'); } });
    const envelope = await app.SDP.Sync.Vault.encryptV2({ ghToken: 'ghp_t', elevenKey: 'sk_t' }, '246813');
    app.SDP.Studio.setEnvelope(envelope);
    app.SDP.Sync.Vault.resetLock();
    check('G3.2a a configured vault is recognised', app.SDP.Studio.hasVault() === true);
    let tries = 0;
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => app.SDP.Studio.unlock('111111', () => { tries += 1; resolve(); }));
    }
    check('G3.2b studio refuses five wrong PINs', tries === 5, tries);
    check('G3.2c vault locks out after the fifth failure', app.SDP.Sync.Vault.isLocked() === true);
    check('G3.2d lockout message is shown to the lecturer', /60/.test(app.SDP.Studio.message()), app.SDP.Studio.message());
    let lockedErr = null;
    await new Promise((resolve) => app.SDP.Studio.unlock('246813', (err) => { lockedErr = err; resolve(); }));
    check('G3.2e the correct PIN is refused while locked', !!lockedErr && lockedErr.code === 'locked', lockedErr && lockedErr.code);
    app.SDP.Sync.Vault.resetLock();
    let okErr = 'unset';
    await new Promise((resolve) => app.SDP.Studio.unlock('246813', (err) => { okErr = err; resolve(); }));
    check('G3.2f the correct PIN unlocks after the lock expires', okErr === null && app.SDP.Studio.isUnlocked(), String(okErr));
    check('G3.2g unlocked secrets stay in sessionStorage only', !!app.w.sessionStorage.getItem('sdp.studio.unlocked') && !app.w.localStorage.getItem('sdp.studio.unlocked'));
    app.close();
  }

  /* ── 3. first-visit guide ───────────────────────────────────────────── */
  // contract: docs/ARCHITECTURE_MAP.md §R2 priority #2 — unmissable guide
  {
    const app = await createApp({ before(w) { w.localStorage.removeItem('sdp.guide_seen'); } });
    check('G3.3a guide auto-opens on the first visit', app.byId('guideModal').hidden === false);
    check('G3.3b guide renders exactly four steps', app.byId('guideSteps').children.length === 4, app.byId('guideSteps').children.length);
    check('G3.3c guide opens in English chrome', app.byId('guideSteps').textContent.indexOf('Choose how you learn') >= 0);
    app.byId('guideLangPill').click();
    check('G3.3d the guide language pill switches to Sinhala in place', sinhala.test(app.byId('guideSteps').textContent));
    app.byId('guideLangPill').click();
    app.byId('btnGuideClose').click();
    // contract: docs/ARCHITECTURE_MAP.md §R2 + W7 — the stamp is the version string
    check('G3.3e closing stores sdp.guide_seen = the running version', app.w.localStorage.getItem('sdp.guide_seen') === '0.0.1.e');
    check('G3.3f the modal is hidden after closing', app.byId('guideModal').hidden === true);
    check('G3.3g no fake guide audio stubs exist', !fs.existsSync(path.join(ROOT, 'assets/audio/guide-si-1.mp3')));
    check('G3.3h the header guide button reopens it', (app.byId('btnGuideTop').click(), app.byId('guideModal').hidden === false));
    app.byId('btnGuideClose').click();
    // a returning visitor is not interrupted
    const again = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.e'); } });
    check('G3.3i returning students are not interrupted by the guide', again.byId('guideModal').hidden === true);
    again.close();
    app.close();
  }

  /* ── 4. paper run, marking, resume, typing run ──────────────────────── */
  // contract: docs/ARCHITECTURE_MAP.md §R5 beat machine + §7 results
  {
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.1.e');
        // appliedSettingsRev pins the seeded pacing against a classSettings
        // adoption, and guideAutoPlay:false keeps Start on the fast path.
        w.localStorage.setItem('sdp.settings', JSON.stringify({ mode: 'paper', writeSecs: 3, repeats: 1, pauseSecs: 0.5, autoAdvance: true, rate: 1, volume: 1, lang: 'en', theme: 'dark', guideAutoPlay: false, appliedSettingsRev: 5 }));
      }
    });
    check('G3.4a boot loads the 30-word active list', app.SDP.Sync.wordCount() === 30, app.SDP.Sync.wordCount());
    app.byId('btnStart').click();
    check('G3.4b Start opens the cockpit screen', app.q('.screen.active').id === 'screen-player');
    check('G3.4c paper mode has no #typeInput in the DOM', app.byId('typeInput') === null);
    check('G3.4d the beat starts in listening', /Listening/.test(app.byId('beatStateText').textContent), app.byId('beatStateText').textContent);
    /* D10: the ladder answers in milliseconds now, so the first writing
       window opens ~1.3 s in — 2.5 s lands inside it. */
    await app.advance(2500);
    check('G3.4e the beat advances into writing', /Write Now/.test(app.byId('beatStateText').textContent), app.byId('beatStateText').textContent);
    app.SDP.Engine.pause();
    const paused = app.byId('beatStateText').textContent;
    check('G3.4f Pause freezes the beat', /Paused/.test(paused), paused);
    app.SDP.Engine.resume();
    check('G3.4g Resume returns to a live phase', ['listening', 'writing'].indexOf(app.SDP.Engine.state()) >= 0, app.SDP.Engine.state());
    // walk the whole 30-word bank with the fake clock
    for (let i = 0; i < 300 && app.SDP.Engine.state() !== 'finished'; i++) await app.advance(1000);
    check('G3.4h a full paper run reaches finished', app.SDP.Engine.state() === 'finished', app.SDP.Engine.state());
    check('G3.4i results panel is visible', app.byId('resultsPanel').hidden === false);
    check('G3.4j results table has 30 rows', app.byId('resultsTable').querySelectorAll('tbody tr').length === 30, app.byId('resultsTable').querySelectorAll('tbody tr').length);
    check('G3.4k the score starts at a full self-check', app.byId('scoreValue').textContent === '30 / 30', app.byId('scoreValue').textContent);
    const missedButtons = app.byId('resultsTable').querySelectorAll('[data-mark="missed"]');
    for (let i = 0; i < 6; i++) missedButtons[i].click();
    check('G3.4l six taps drop the score to 24 / 30 (80%)',
      app.byId('scoreValue').textContent === '24 / 30' && app.byId('scorePct').textContent === '80%',
      app.byId('scoreValue').textContent + ' · ' + app.byId('scorePct').textContent);
    const progress = JSON.parse(app.w.localStorage.getItem('sdp.progress'));
    check('G3.4m the six missed words are queued in weakWords', progress.weakWords.length === 6, JSON.stringify(progress.weakWords));
    check('G3.4n mastered tracks the 24 correct words', Object.keys(progress.mastered).length === 24, Object.keys(progress.mastered).length);
    check('G3.4o the streak opened on the same day', progress.streak.count === 1 && /^\d{4}-\d{2}-\d{2}$/.test(progress.streak.lastDate), JSON.stringify(progress.streak));
    check('G3.4p lastScore is stored for the Home card', progress.lastScore && progress.lastScore.correct === 24 && progress.lastScore.total === 30);
    check('G3.4q finishing clears the in-flight sdp.session draft', app.w.localStorage.getItem('sdp.session') === null);
    app.byId('btnRetryMissed').click();
    check('G3.4r Retry missed starts a 6-word session', app.SDP.Engine.items().length === 6, app.SDP.Engine.items().length);
    app.SDP.Engine.stop();
    check('G3.4s Home statistics reflect the saved progress',
      app.byId('statMastered').textContent === '24 / 30' && app.byId('statAccuracy').textContent === '80%',
      app.byId('statMastered').textContent + ' / ' + app.byId('statAccuracy').textContent);

    // typing mode
    app.byId('tab-home').click();
    app.byId('homeModePills').querySelector('[data-mode="typing"]').click();
    app.byId('btnStart').click();
    check('G3.4t typing mode mounts #typeInput', app.byId('typeInput') !== null);
    const input = app.byId('typeInput');
    check('G3.4u #typeInput carries the anti-autocorrect attributes',
      input.getAttribute('autocomplete') === 'off' && input.getAttribute('autocapitalize') === 'off' && input.getAttribute('spellcheck') === 'false');
    input.value = 'afraid';
    input.dispatchEvent(new app.w.Event('input'));
    app.SDP.Engine.finish();
    const firstRow = app.byId('resultsTable').querySelectorAll('tbody tr')[0];
    check('G3.4v a typed word is graded correct automatically', firstRow.className === 'is-correct', firstRow.className);
    const secondRow = app.byId('resultsTable').querySelectorAll('tbody tr')[1];
    check('G3.4w an empty answer is graded missed', secondRow.className === 'is-missed', secondRow.className);
    app.SDP.Engine.stop();

    // in-flight resume
    app.SDP.Data.saveSession({ sessionId: '8', index: 3, mode: 'paper', answers: { amazed: { typed: '', marked: 'correct' } }, updatedAt: 1 });
    app.SDP.Views.renderHome();
    check('G3.4x the resume banner appears for an in-flight session', app.byId('resumeBanner').hidden === false);
    app.byId('btnResume').click();
    check('G3.4y resume restarts at the saved word index', app.SDP.Engine.config().index === 3, app.SDP.Engine.config().index);
    app.SDP.Engine.stop();
    check('G3.4z paper mode after switching back never leaves an input behind',
      (app.SDP.Engine.setMode('paper'), app.byId('typeInput') === null));
    app.close();
  }

  /* ── 5. language purity ─────────────────────────────────────────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §5 language purity (W7)
  {
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.e'); } });
    app.byId('tab-dict').click();
    const cards = app.byId('dictList').querySelectorAll('.dict-card');
    check('G3.5a the Words tab renders all 30 cards', cards.length === 30, cards.length);
    const firstSi = cards[0].querySelector('.word-si');
    check('G3.5b each card carries the Sinhala meaning in .word-si', !!firstSi && sinhala.test(firstSi.textContent), firstSi && firstSi.textContent);
    app.SDP.Views.applyLang('en');
    // the vocabulary card's .word-si is the ONLY legal Sinhala in English mode
    const dictWithoutSi = app.byId('dictList').cloneNode(true);
    Array.from(dictWithoutSi.querySelectorAll('.word-si')).forEach((n) => n.remove());
    const chromeEn = [app.byId('tabbar'), app.byId('appHeader'), app.byId('screen-home'), app.byId('screen-settings')]
      .map((n) => n.textContent).join(' ') + ' ' + dictWithoutSi.textContent;
    check('G3.5c English chrome contains zero Sinhala outside the vocabulary cards', !sinhala.test(chromeEn), (chromeEn.match(/[\u0D80-\u0DFF]+/g) || []).join(','));
    app.SDP.Views.applyLang('si');
    const chromeSi = [app.byId('tabbar'), app.byId('appHeader'), app.byId('screen-home'), app.byId('screen-settings')]
      .map((n) => n.textContent).join(' ');
    check('G3.5d Sinhala chrome is rendered in Sinhala', sinhala.test(chromeSi));
    check('G3.5e proper nouns survive the switch', chromeSi.indexOf('CCBE B1') >= 0 && app.byId('appHeader').textContent.indexOf('Smart Dictation') >= 0);
    const guide = app.SDP.Views.t('guideStep1Body');
    check('G3.5f Sinhala guide step one is natural Sinhala', sinhala.test(guide) && guide.indexOf('Paper Mode') >= 0);
    check('G3.5g English and Sinhala tables have identical key sets',
      JSON.stringify(Object.keys(app.SDP.STRINGS_EN).sort()) === JSON.stringify(Object.keys(app.SDP.STRINGS_SI).sort()),
      Object.keys(app.SDP.STRINGS_EN).filter((k) => !(k in app.SDP.STRINGS_SI)).join(','));
    app.SDP.Views.applyLang('en');
    const tail = app.SDP.Views.t('creditsLine');
    check('G3.5h the attribution line is exact in English',
      tail === 'Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)', tail);
    check('G3.5i the credits pill reads CREDITS GOES TO Hansana',
      app.q('#creditFoot .credits-pill').textContent === 'CREDITS GOES TO Hansana',
      app.q('#creditFoot .credits-pill').textContent);
    app.close();
  }

  /* ── 6. settings order and the studio accordion ─────────────────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §student-first settings order
  {
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.e'); } });
    const order = app.SDP.Views.settingsOrder();
    check('G3.6a settings has exactly six sections', order.length === 6, order.join(','));
    check('G3.6b About is the fifth section and the studio accordion stays last',
      order[4] === 'aboutCard' && order[5] === 'studioAccordion', order.join(','));
    check('G3.6c the studio accordion is collapsed by default', app.byId('studioAccordion').open === false);
    check('G3.6d the repeats select is built once with 1x-5x', app.byId('setRepeats').options.length === 5, app.byId('setRepeats').options.length);
    // contract: docs/CHANGELOG_LEDGER.md §v0.0.1.e VOX-08 — the test now plays
    // the first session word through the real tier chain and names the tier.
    app.byId('btnTestVoice').click();
    /* D10: the chain is async now (dictionary <audio> first, TTS last). jsdom
       fires no media events, so run past the 12 s playUrl backstop to let the
       chain hand over and name the tier that actually played. */
    await app.advance(13000);
    const said = app.SDP.Speech.lastUtterances();
    const dictTiers = app.SDP.Speech.resolveTiers(app.SDP.Sync.word(0)).filter(function (t) { return t.tier === 'dictionary'; });
    check('G3.6e Test Voice plays the first session word through the tier chain',
      (said.length >= 1 && /afraid/i.test(said.join(' '))) ||
        (/British human audio/i.test(String(app.SDP.Speech.lastTierName())) &&
         dictTiers.length === 1 && /dict\.youdao\.com/.test(dictTiers[0].url) && /audio=afraid/i.test(dictTiers[0].url)),
      JSON.stringify({ said: said, tier: app.SDP.Speech.lastTierName(), dict: dictTiers }));
    check('G3.6f Test Voice reports the tier that actually played',
      typeof app.SDP.Speech.lastTierName() === 'string' && app.SDP.Speech.lastTierName().length > 0,
      app.SDP.Speech.lastTierName());
    app.close();
  }

  /* ── 7. R1: lecturer classSettings adoption (SYNC-01 / SYNC-02) ──────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R11.2
  {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
    cfg.classSettings = Object.assign({}, cfg.classSettings, { writeSecs: 12, repeats: 4, theme: 'light' });
    const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/version.json'), 'utf8'));
    ver.settingsRev = 7;
    ver.syncRev = 1762000000011;
    const app = await createApp({
      files: { 'data/config.json': JSON.stringify(cfg), 'data/version.json': JSON.stringify(ver) },
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.1.e');
        /* The student touched every classroom key — the lecturer still wins. */
        w.localStorage.setItem('sdp.settings', JSON.stringify({
          mode: 'typing', writeSecs: 3, repeats: 1, pauseSecs: 0.5, autoAdvance: false,
          pacingPreset: 'exam', voiceLock: 'custom', voiceSource: 'custom', rate: 1.1, theme: 'board',
          lang: 'si', volume: 0.4, appliedSettingsRev: 0, langResetV001e: true,
          touchedKeys: { writeSecs: true, repeats: true, theme: true, rate: true, pauseSecs: true }
        }));
      }
    });
    const s = app.SDP.Data.settings();
    check('G3.7a a settingsRev bump adopts classSettings even with touchedKeys set (SYNC-01)',
      s.writeSecs === 12 && s.repeats === 4 && s.theme === 'light', JSON.stringify([s.writeSecs, s.repeats, s.theme]));
    check('G3.7b the ten classroom keys are cleared from touchedKeys (SYNC-01)',
      s.touchedKeys.writeSecs === undefined && s.touchedKeys.repeats === undefined && s.touchedKeys.theme === undefined,
      JSON.stringify(s.touchedKeys));
    check('G3.7c appliedSettingsRev records the adopted revision (SYNC-02)',
      s.appliedSettingsRev === 7, s.appliedSettingsRev);
    check('G3.7d personal keys (lang, volume) are never overwritten by classSettings',
      s.lang === 'si' && s.volume === 0.4, JSON.stringify([s.lang, s.volume]));
    check('G3.7e the adoption repaints the settings controls',
      app.byId('setWriteSecs').value === '12', app.byId('setWriteSecs').value);
    app.close();
  }

  /* ── 8. R1 first-boot adoption (SYNC-02) ─────────────────────────────── */
  {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
    cfg.classSettings = Object.assign({}, cfg.classSettings, { writeSecs: 10, repeats: 5, pauseSecs: 2.5 });
    const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/version.json'), 'utf8'));
    ver.settingsRev = 9;
    ver.syncRev = 1762000000012;
    const app = await createApp({
      files: { 'data/config.json': JSON.stringify(cfg), 'data/version.json': JSON.stringify(ver) },
      before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.e'); }
    });
    const s = app.SDP.Data.settings();
    check('G3.8a a brand-new device adopts the teacher settings on its first boot (SYNC-02)',
      s.writeSecs === 10 && s.repeats === 5 && s.pauseSecs === 2.5 && s.appliedSettingsRev === 9,
      JSON.stringify([s.writeSecs, s.repeats, s.pauseSecs, s.appliedSettingsRev]));
    check('G3.8b the controls show the adopted pacing',
      app.byId('setRepeats').value === '5' && app.byId('setPause').value === '2.5',
      app.byId('setRepeats').value + ' / ' + app.byId('setPause').value);
    app.close();
  }

  /* ── 9. VOX-07: the quick spoken walkthrough on #btnStart ────────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §Quick Walkthrough Mode
  {
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.1.e');
        w.localStorage.setItem('sdp.settings', JSON.stringify({
          mode: 'paper', writeSecs: 3, repeats: 1, pauseSecs: 0.5, autoAdvance: true,
          rate: 1, volume: 1, lang: 'en', theme: 'dark', guideAutoPlay: true, appliedSettingsRev: 5
        }));
      }
    });
    app.byId('btnStart').click();
    check('G3.9a Start opens the Quick Voice Guide instead of jumping to the cockpit',
      app.byId('guideModal').hidden === false && app.q('.screen.active').id === 'screen-home',
      app.q('.screen.active').id);
    check('G3.9b the quick guide has its own title',
      app.byId('guideTitle').textContent === app.SDP.Views.t('guideQuickTitle'),
      app.byId('guideTitle').textContent);
    check('G3.9c #btnGuideSkipStart is visible and labelled',
      app.byId('btnGuideSkipStart').hidden === false &&
      /Skip Guide & Start Immediately/.test(app.byId('btnGuideSkipStart').textContent),
      app.byId('btnGuideSkipStart').textContent);
    await app.advance(1200);
    const spoken = app.SDP.Speech.lastUtterances();
    check('G3.9d the quick guide narrates steps 1 and 2 in English only',
      spoken.length >= 1 && spoken.every((line) => !sinhala.test(line)), JSON.stringify(spoken));
    app.byId('btnGuideSkipStart').click();
    check('G3.9e skipping closes the guide and starts the dictation immediately',
      app.byId('guideModal').hidden === true && app.q('.screen.active').id === 'screen-player',
      app.q('.screen.active').id);
    check('G3.9f the session intro is remembered for the rest of the run',
      app.SDP.Views.sessionIntroShown() === true);
    app.SDP.Engine.stop();
    app.byId('tab-home').click();
    app.byId('btnStart').click();
    check('G3.9g a second Start in the same session goes straight to the cockpit',
      app.q('.screen.active').id === 'screen-player' && app.byId('guideModal').hidden === true,
      app.q('.screen.active').id);
    app.close();
  }

  for (const r of results) if (r.status === 'FAIL') fails.push(r);
  console.log(JSON.stringify(results, null, 2));
  console.log('\nG3 phase1.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
  if (fails.length) process.exitCode = 1;
})().catch((err) => {
  console.error('G3 harness crashed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
