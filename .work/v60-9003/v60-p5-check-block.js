/* ------------------------------------------------------------------
 * v60 Next-Gen DOM wiring (JSDOM, no browser)
 * ------------------------------------------------------------------ */
{
  const { harness } = require('./app-harness.cjs');
  const app = harness(null, {});
  try {
    app.w.eval(learn);
    app.clock.tick(2500);
    const doc = app.w.document;
    const C = app.w.SDPCore;
    for (const id of ['sdpHomeGreeting', 'sdpHeroConfigChips', 'sdpHomeStatsRow', 'sdpQuickPracticeGrid', 'microToastLoad', 'creditPill', 'creditDocked', 'sdpDesktopRail']) {
      if (!doc.getElementById(id)) throw Error('v60 home chrome missing #' + id);
    }
    C.Screens.dict();
    app.clock.tick(80);
    if (!doc.getElementById('sdpWordFilterRow')) throw Error('v60 #sdpWordFilterRow missing after Screens.dict()');
    if (!doc.querySelectorAll('#dictList .sdp-word-card.v59-dict-card').length) throw Error('v60 dictionary cards missing');
    C.Screens.settings();
    app.clock.tick(80);
    const box = doc.getElementById('sdpNextGenSettings');
    const body = doc.getElementById('setBody');
    const acc = doc.getElementById('sdpAppearanceAccordion');
    if (!box) throw Error('v60 #sdpNextGenSettings missing');
    if (doc.getElementById('screen-set').firstElementChild !== box) throw Error('v60 settings must be the first child of #screen-set');
    if (box.contains(body)) throw Error('#setBody must live in the accordion, not in the priority panel');
    if (!body || !body.closest('details#sdpAppearanceAccordion')) throw Error('#setBody must be inside details#sdpAppearanceAccordion');
    if (!acc || acc.open !== false) throw Error('the appearance accordion must start collapsed');
    for (const id of ['sdpSegMode', 'sdpSegSpeed', 'sdpSegRepeats', 'sdpRangeWait', 'sdpToggleAutoSentence', 'sdpSegLang', 'rateRange', 'volRange', 'repeatsSelect', 'readSentenceToggle', 'writeSecsRange', 'bitrateSelect']) {
      if (!doc.getElementById(id)) throw Error('v60 settings control missing #' + id);
    }
    const v57 = doc.getElementById('sdpV57Css'), v58 = doc.getElementById('sdpV58Css'), ng = doc.getElementById('sdpNextGenCss');
    if (!v57 || !v57.disabled || v57.textContent !== '/* v60 neutralised */') throw Error('#sdpV57Css must be neutralised');
    if (!v58 || !v58.disabled) throw Error('#sdpV58Css must be neutralised');
    if (!ng || doc.head.lastElementChild !== ng) throw Error('#sdpNextGenCss must be the last style in <head>');
    console.log('v60 next-gen DOM: PASS');
  } finally { app.close(); }
}
