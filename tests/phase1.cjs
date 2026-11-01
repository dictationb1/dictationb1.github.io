#!/usr/bin/env node
'use strict';
/* G3 — jsdom behavioural and regression gate for the v0.0.1.b shell.
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
        w.localStorage.setItem('sdp.guide_seen', '0.0.1.b');
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
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.b'); } });
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
    check('G3.3e closing stores sdp.guide_seen = "0.0.1.b"', app.w.localStorage.getItem('sdp.guide_seen') === '0.0.1.b');
    check('G3.3f the modal is hidden after closing', app.byId('guideModal').hidden === true);
    check('G3.3g no fake guide audio stubs exist', !fs.existsSync(path.join(ROOT, 'assets/audio/guide-si-1.mp3')));
    check('G3.3h the header guide button reopens it', (app.byId('btnGuideTop').click(), app.byId('guideModal').hidden === false));
    app.byId('btnGuideClose').click();
    // a returning visitor is not interrupted
    const again = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.b'); } });
    check('G3.3i returning students are not interrupted by the guide', again.byId('guideModal').hidden === true);
    again.close();
    app.close();
  }

  /* ── 4. paper run, marking, resume, typing run ──────────────────────── */
  // contract: docs/ARCHITECTURE_MAP.md §R5 beat machine + §7 results
  {
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.1.b');
        w.localStorage.setItem('sdp.settings', JSON.stringify({ mode: 'paper', writeSecs: 3, repeats: 1, pauseSecs: 0.5, autoAdvance: true, rate: 1, volume: 1, lang: 'en', theme: 'dark' }));
      }
    });
    check('G3.4a boot loads the 30-word active list', app.SDP.Sync.wordCount() === 30, app.SDP.Sync.wordCount());
    app.byId('btnStart').click();
    check('G3.4b Start opens the cockpit screen', app.q('.screen.active').id === 'screen-player');
    check('G3.4c paper mode has no #typeInput in the DOM', app.byId('typeInput') === null);
    check('G3.4d the beat starts in listening', /Listening/.test(app.byId('beatStateText').textContent), app.byId('beatStateText').textContent);
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
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.b'); } });
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
      tail === 'Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 / Lesandu', tail);
    check('G3.5i the credits pill reads CREDITS GOES TO Hansana',
      app.q('#creditFoot .credits-pill').textContent === 'CREDITS GOES TO Hansana',
      app.q('#creditFoot .credits-pill').textContent);
    app.close();
  }

  /* ── 6. settings order and the studio accordion ─────────────────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §student-first settings order
  {
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.b'); } });
    const order = app.SDP.Views.settingsOrder();
    check('G3.6a settings has exactly six sections', order.length === 6, order.join(','));
    check('G3.6b About is the fifth section and the studio accordion stays last',
      order[4] === 'aboutCard' && order[5] === 'studioAccordion', order.join(','));
    check('G3.6c the studio accordion is collapsed by default', app.byId('studioAccordion').open === false);
    check('G3.6d the repeats select is built once with 1x-5x', app.byId('setRepeats').options.length === 5, app.byId('setRepeats').options.length);
    app.byId('btnTestVoice').click();
    const said = app.SDP.Speech.lastUtterances();
    check('G3.6e Test Voice speaks one whole sentence', said.length === 1 && /This is Alice, ready for your CCBE B1 dictation session\./.test(said[0]), JSON.stringify(said));
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
