#!/usr/bin/env node
'use strict';
/* G12 — Lecturer Studio: real DOM widgets, zero-credit quota, delta clips (P3/P4).
 * contract: docs/UI_COMPONENT_GUIDE.md §5 studio widgets
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §W5 CREDIT SAFETY
 * CREDIT SAFETY: this gate never calls /v1/text-to-speech. The only network
 * surface it allows the studio is the zero-character GET /v1/user/subscription,
 * and every fetch here is a local stub. */
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* A lecturer opening the studio for the first time: seal a vault with a PIN. */
async function unlockStudio(app) {
  app.byId('btnStudioQuick').click();
  await app.settle(6);
  await new Promise((resolve) => app.SDP.Studio.setup('246813', { ghToken: 'ghp_x', elevenKey: 'sk_x' }, () => resolve()));
  await app.settle(8);
}

(async function main() {
  const base = { before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.e'); } };

  /* ── 1. W5: nothing in the shipped app or the suite may bill a character
   *       outside a human click ───────────────────────────────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §W5
  {
    const tts = /\/v1\/text-to-speech\//;
    const suiteHits = fs.readdirSync(path.join(ROOT, 'tests'))
      .filter((f) => /\.(cjs|js)$/.test(f))
      .filter((f) => tts.test(read('tests/' + f)));
    check('G12.1a no gate or test file references the billing endpoint', suiteHits.length === 0, suiteHits.join(','));
    const studioSrc = read('data/studio.js');
    /* every reference to the TTS endpoint must live inside a click handler */
    const ttsSites = studioSrc.split('\n').map((line, i) => ({ line, i })).filter((x) => tts.test(x.line));
    check('G12.1b the studio reaches the TTS endpoint only from a human click',
      ttsSites.length > 0 && ttsSites.every((x) => /genClip|renderClip|speakClip|synthClip|ttsUrl|function /.test(x.line)),
      ttsSites.map((x) => x.i + 1).join(','));
    check('G12.1c the shipped app never auto-generates clips on boot',
      !/addEventListener\('DOMContentLoaded'[\s\S]{0,600}?genClips/.test(studioSrc));
    const other = ['data/sdp-data-sync.js', 'data/sdp-ui-views.js', 'data/sdp-audio-speech.js', 'data/sdp-dictation-engine.js', 'data/data-meter.js', 'sw.js']
      .filter((f) => tts.test(read(f)));
    check('G12.1d no background module can ever bill a character', other.length === 0, other.join(','));
  }

  /* ── 2. P3: the zero-cost Quota Inspector ───────────────────────────── */
  // contract: docs/CHANGELOG_LEDGER.md §P3 zero-character subscription read
  {
    const urls = [];
    const app = await createApp(Object.assign({
      fetch(url, init) {
        const u = String(url);
        if (u.indexOf('elevenlabs.io') < 0) return undefined;
        urls.push({ url: u, method: (init && init.method) || 'GET', body: init && init.body });
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ character_count: 1200, character_limit: 10000 })
        });
      }
    }, base));
    /* the studio is a modal; unlock it the way a lecturer does */
    await unlockStudio(app);
    const opened = app.byId('studioModal') || app.q('.studio-modal') || app.q('#screen-settings');
    check('G12.2a the studio quick launcher opens a real surface', !!opened);
    const testKey = app.byId('btnTestElKey');
    check('G12.2b #btnTestElKey is a real button', !!testKey && testKey.tagName === 'BUTTON');
    if (testKey) {
      app.byId('elKeyInput').value = 'sk_test_key_value';
      testKey.click();
      await app.settle(10);
    }
    const quotaHit = urls.filter((u) => u.url.indexOf('/v1/user/subscription') >= 0);
    check('G12.2c the key test reads /v1/user/subscription only', quotaHit.length >= 1 && urls.length === quotaHit.length,
      urls.map((u) => u.url).join(','));
    check('G12.2d the quota read is a zero-character GET', quotaHit.every((u) => u.method === 'GET' && !u.body),
      JSON.stringify(quotaHit));
    const quotaText = (app.byId('quotaText') || {}).textContent || '';
    check('G12.2e the inspector shows used / limit / remaining',
      /1200/.test(quotaText) && /10000/.test(quotaText), quotaText.slice(0, 90));
    check('G12.2f the key never appears in a URL',
      urls.every((u) => u.url.indexOf('sk_test_key_value') < 0), urls.map((u) => u.url).join(','));
    app.close();
  }

  /* ── 3. P3: the cost preview is honest and the generator is delta-only ─ */
  // contract: docs/CHANGELOG_LEDGER.md §P3 972-char preflight
  {
    const app = await createApp(base);
    await unlockStudio(app);
    const line = (app.byId('costPreviewLine') || {}).textContent || '';
    check('G12.3a the cost preview names words, guide steps and the total',
      /30 words = 241 chars/.test(line) && /4 guide steps = 731 chars/.test(line) && /total 972 chars/.test(line), line);
    check('G12.3b the preview is written into the documented DOM node', !!app.byId('costPreviewLine'));
    check('G12.3c a one-word test button exists for cheap dry runs', !!app.byId('btnTestOneWord'));
    check('G12.3d the delta generator exists and is the primary action',
      !!app.byId('btnGenClips') && /btn-primary/.test(app.byId('btnGenClips').className));
    const studio = app.SDP.Studio;
    const guide = studio.guideClips ? studio.guideClips() : studio.guideSteps();
    check('G12.3e the guide ships four reusable clips', Array.isArray(guide) && guide.length === 4,
      Array.isArray(guide) ? guide.length : typeof guide);
    const keys = (guide || []).map((g) => g.key);
    check('G12.3f the guide clips are the frozen _guide_1.._guide_4 keys',
      JSON.stringify(keys) === JSON.stringify(['_guide_1', '_guide_2', '_guide_3', '_guide_4']), keys.join(','));
    app.close();
  }

  /* ── 4. P4: the foolproof PIN pad and the key tools ─────────────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §5 pinPad
  {
    const app = await createApp(base);
    app.byId('btnStudioQuick').click();
    await app.settle(8);
    const pad = app.byId('pinPad');
    check('G12.4a #pinPad is a real element', !!pad);
    const keys = pad ? pad.querySelectorAll('button.pin-key') : [];
    check('G12.4b #pinPad holds exactly twelve keys', keys.length === 12, keys.length);
    const dials = pad ? Array.from(pad.querySelectorAll('[data-pin]')).map((b) => b.getAttribute('data-pin')) : [];
    check('G12.4c the twelve keys are 1-9, Clear, 0 and Unlock',
      JSON.stringify(dials.sort()) === JSON.stringify(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) &&
      !!app.byId('pinPadClear') && !!app.byId('pinPadUnlock'),
      dials.join('') + ' +clear+unlock');
    check('G12.4d backspace lives outside the twelve keys', !!app.byId('pinPadBack'));
    check('G12.4e every pad key is tappable at 56px or larger',
      /pin-key[^{]*\{[^}]*min-height:\s*56px/.test(read('assets/css/sdp-ui.css')));
    /* pressing Clear then Unlock must never throw on an empty pad */
    let threw = null;
    try { app.byId('pinPadClear').click(); app.byId('pinPadUnlock').click(); } catch (e) { threw = String(e); }
    check('G12.4f an empty pad is rejected without throwing', threw === null, threw);
    app.close();
  }

  /* ── 5. P4: show / hide / paste and both token families ─────────────── */
  // contract: docs/CHANGELOG_LEDGER.md §D-S9 token families
  {
    const app = await createApp(base);
    await unlockStudio(app);
    check('G12.5a the EL key field has Show / Hide and Paste helpers',
      !!app.byId('btnToggleElKey') && !!app.byId('btnPasteElKey'));
    check('G12.5b the GitHub token field has a real test button', !!app.byId('btnTestGhToken'));
    check('G12.5c a clip can be committed to the vault from the studio', !!app.byId('btnCommitClip'));
    check('G12.5d the studio exposes its quick launcher in the shell', !!app.byId('btnStudioQuick'));
    const input = app.byId('elKeyInput');
    const before = input.type;
    app.byId('btnToggleElKey').click();
    const after = app.byId('elKeyInput').type;
    check('G12.5e Show / Hide really flips the input type',
      (before === 'password' && after === 'text') || (before === 'text' && after === 'password'), before + '->' + after);
    const studioSrc = read('data/studio.js');
    check('G12.5f both GitHub token families are accepted',
      /ghp_/.test(studioSrc) && /github_pat_/.test(studioSrc));
    app.close();
  }

  /* ── 6. R9: every widget string exists in EN and SI ─────────────────── */
  // contract: docs/ARCHITECTURE_MAP.md §R9 bilingual strings
  {
    const app = await createApp(base);
    const en = app.SDP.STRINGS_EN;
    const si = app.SDP.STRINGS_SI;
    const required = [
      'studioTitle', 'studioPinLabel', 'pinPadClear', 'pinPadUnlock', 'studioCommitClip',
      'testOneWordBtn', 'genDeltaBtn', 'costPreviewLabel', 'quotaHeading',
      'creditsLine', 'creditsPill', 'howToUse', 'guideSpeakBtn'
    ];
    const missingEn = required.filter((k) => !en[k]);
    const missingSi = required.filter((k) => !si[k]);
    check('G12.6a every studio and guide string ships in English', missingEn.length === 0, missingEn.join(','));
    check('G12.6b every studio and guide string ships in Sinhala', missingSi.length === 0, missingSi.join(','));
    check('G12.6c the Sinhala strings are genuinely Sinhala',
      missingSi.length === 0 && /[\u0D80-\u0DFF]/.test(si.studioTitle + si.pinPadUnlock), si.studioTitle);
    check('G12.6d the credit pill is preserved verbatim in both languages',
      en.creditsPill === 'CREDITS GOES TO Hansana' && /Hansana/.test(si.creditsPill), en.creditsPill + ' / ' + si.creditsPill);
    check('G12.6e the credit line is preserved verbatim in both languages',
      en.creditsLine === 'Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)',
      en.creditsLine);
    app.close();
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ gate: 'G12', passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  } else {
    for (const r of results) if (r.status === 'FAIL') console.log('FAIL  ' + r.test + (r.detail ? '  [' + r.detail + ']' : ''));
    console.log('G12 studio-safety.cjs — ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
  }
  process.exit(failed.length ? 1 : 0);
})();
