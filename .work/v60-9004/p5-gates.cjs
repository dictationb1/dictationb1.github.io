/* ============================================================================
 * P5 — regression assertions for the 8 live-video bugs.
 * ========================================================================== */
var p = require("./patchlib.cjs");

/* ------------------------------------------------------------- check.cjs --- */
var C = p.open("tests/check.cjs", ["require("]);
C.rep(
  "v60.4 static markers",
  "if (!/encVault/.test(read('data/config.json')) || !/SDP_ENC_V2:/.test(read('data/config.json'))) throw Error('config.json must carry encVault: SDP_ENC_V2:...');",
  "if (!/encVault/.test(read('data/config.json')) || !/SDP_ENC_V2:/.test(read('data/config.json'))) throw Error('config.json must carry encVault: SDP_ENC_V2:...');\n" +
    "/* v60 / 9.0.0.4 - zero-FOUC cloak and the 8 live-video fixes. */\n" +
    "if (!/id=\"sdpPrePaintCloak\"/.test(INDEX)) throw Error('index.html must ship the #sdpPrePaintCloak zero-FOUC style');\n" +
    "if (!/data-v60-ready/.test(INDEX) || !/data-v60-ready/.test(learn)) throw Error('the pre-paint cloak must be lifted by data-v60-ready');\n" +
    "if (!/typeof items === ['\"]string['\"]/.test(learn)) throw Error('Speech.say must coerce a bare string into an array');\n" +
    "if (!/v604PlayerChrome/.test(learn) || !/sdpLegacyPlayerDock/.test(learn)) throw Error('the cockpit must move the legacy .ctrlgrid/.lfoot out of layout');\n" +
    "if (!/#creditDocked\\{position:static/.test(learn.replace(/\\s+/g, ''))) throw Error('#creditDocked must be statically positioned');\n" +
    "if (!/sdpAppearanceAccordion/.test(learn)) throw Error('settings must keep #sdpAppearanceAccordion');\n" +
    "if (!/sdpTestVoice/.test(learn)) throw Error('the Test voice control must exist');\n" +
    "console.log('v60.4 FOUC/video-bug markers: PASS');",
  1
);
C.save(60000);

/* ------------------------------------------------------ upgrade-browser.cjs */
var U = p.open("tests/upgrade-browser.cjs", ["async function", "await ctx.close"]);

/* Bug 3 changed the contract: #creditDocked must never be position:fixed again. */
U.rep(
  "creditDocked must be static",
  "creditDocked: !!document.getElementById('creditDocked') && getComputedStyle(document.getElementById('creditDocked')).position === 'fixed',",
  "creditDocked: !!document.getElementById('creditDocked') && getComputedStyle(document.getElementById('creditDocked')).position === 'static',",
  1
);

/* Extra cockpit measurements for Bug 5. */
U.rep(
  "cockpit scroll metrics",
  "          resolve({\n            card: vis('sdpCockpitCard'), edge: vis('sdpEdgeBar'), timer: vis('sdpTimerPill'),",
  "          const lbody = document.querySelector('#layers .lbody');\n" +
    "          const cardNode = document.getElementById('sdpCockpitCard');\n" +
    "          const grid = document.querySelector('#layers .ctrlgrid');\n" +
    "          const foot = document.querySelector('#layers .lfoot');\n" +
    "          const gRect = grid ? grid.getBoundingClientRect() : null;\n" +
    "          const fRect = foot ? foot.getBoundingClientRect() : null;\n" +
    "          resolve({\n" +
    "            lbodyScroll: lbody ? lbody.scrollTop : -1,\n" +
    "            lbodyHeight: lbody ? Math.round(lbody.scrollHeight) : -1,\n" +
    "            cardTop: cardNode ? Math.round(cardNode.getBoundingClientRect().top) : -1,\n" +
    "            cardFullyVisible: cardNode ? (cardNode.getBoundingClientRect().top >= 0 && cardNode.getBoundingClientRect().bottom <= (window.innerHeight + 1)) : false,\n" +
    "            gridOnscreen: gRect ? (gRect.top < window.innerHeight && gRect.bottom > 0) : false,\n" +
    "            footOnscreen: fRect ? (fRect.top < window.innerHeight && fRect.bottom > 0) : false,\n" +
    "            sheetOpen: !!document.querySelector('#sheets .sheet:not(.hidden)'),\n" +
    "            card: vis('sdpCockpitCard'), edge: vis('sdpEdgeBar'), timer: vis('sdpTimerPill'),",
  1
);

U.rep(
  "cockpit push includes Bug 5 metrics",
  "    push('v60 active dictation shows the cockpit card, edge bar, timer pill, dock and word map',\n      cockpit.card && cockpit.edge && cockpit.timer && cockpit.dock && cockpit.map && cockpit.lensGone, cockpit);",
  "    push('v60 active dictation shows the cockpit card, edge bar, timer pill, dock and word map',\n      cockpit.card && cockpit.edge && cockpit.timer && cockpit.dock && cockpit.map && cockpit.lensGone, cockpit);\n" +
    "    push('v60.4 Bug5: no ready sheet, .lbody never scrolls, cockpit card stays in view and legacy .ctrlgrid/.lfoot are off-layout',\n" +
    "      !cockpit.sheetOpen && cockpit.lbodyScroll === 0 && cockpit.cardTop < 240 && cockpit.cardFullyVisible && !cockpit.gridOnscreen && !cockpit.footOnscreen && cockpit.lbodyHeight < 1200, cockpit);",
  1
);

/* New: the eight video-bug assertions. */
var BLOCK = [
  "    /* ---------------- v60 / 9.0.0.4 live-video bug regression block --------- */",
  "    const video = await page.evaluate(async () => {",
  "      const wait = (n) => new Promise((r) => setTimeout(r, n));",
  "      const bar = document.querySelector('.topbar');",
  "      const barRect = bar.getBoundingClientRect();",
  "      const visKids = [];",
  "      for (const c of bar.children) {",
  "        const cs = getComputedStyle(c);",
  "        if (cs.display !== 'none' && cs.visibility !== 'hidden') visKids.push(c.id || c.className);",
  "      }",
  "      const cd = document.getElementById('creditDocked');",
  "      document.getElementById('tab-dict').click();",
  "      await wait(700);",
  "      const cards = document.querySelectorAll('#dictList .sdp-word-card');",
  "      let tall = 0;",
  "      for (const c of cards) if (c.getBoundingClientRect().height > 60) tall++;",
  "      const sd = document.getElementById('screen-dict');",
  "      window.SDPCore.UI.setTab('set');",
  "      await wait(700);",
  "      const testVoice = document.getElementById('sdpTestVoice');",
  "      const toastsBefore = document.querySelectorAll('#toasts .toast').length;",
  "      if (testVoice) testVoice.click();",
  "      await wait(500);",
  "      const toastText = Array.from(document.querySelectorAll('#toasts .toast')).slice(toastsBefore).map((t) => (t.textContent || '').trim()).join(' | ');",
  "      const host = document.getElementById('screen-set');",
  "      const ng = document.getElementById('sdpNextGenSettings');",
  "      const sibs = [];",
  "      if (host) for (const c of host.children) {",
  "        if (c === ng) continue;",
  "        const cs = getComputedStyle(c);",
  "        sibs.push({ id: c.id || c.className, hidden: cs.display === 'none' || cs.visibility === 'hidden' || !!(c.closest && c.closest('details#sdpAppearanceAccordion')) });",
  "      }",
  "      window.SDPCore.UI.setTab('home');",
  "      const legacyVisible = [];",
  "      for (const n of document.querySelectorAll('#screen-home *, #screen-comm *')) {",
  "        if (n.children.length > 3) continue;",
  "        const t = (n.textContent || '').replace(/^\\s+/, '').slice(0, 34);",
  "        if (/^(Session progress|Smart Dictation Player v58)/.test(t) && getComputedStyle(n).display !== 'none') legacyVisible.push(t);",
  "      }",
  "      return {",
  "        ready: document.body.getAttribute('data-v60-ready'),",
  "        cloak: !!document.getElementById('sdpPrePaintCloak'),",
  "        barFull: Math.round(barRect.width) === window.innerWidth && Math.round(barRect.top) === 0,",
  "        barKids: visKids,",
  "        barLeak: !!document.querySelector('.topbar #btnLock') || !!document.querySelector('.topbar #chipNet') || !!document.querySelector('.topbar .brand'),",
  "        creditPos: cd ? getComputedStyle(cd).position : 'missing',",
  "        cards: cards.length, tall, screenVisible: !!sd && getComputedStyle(sd).display !== 'none',",
  "        testVoice: !!testVoice, toastText, settingsSiblings: sibs, legacyVisible",
  "      };",
  "    });",
  "    push('v60.4 Bug1: data-v60-ready is set and the pre-paint cloak ships in <head>', video.ready === '1' && video.cloak, video);",
  "    push('v60.4 Bug2: .topbar is a full-bleed 56px bar with only #sdpBrandCluster + #sdpTopActions and no leaked legacy text',",
  "      video.barFull && video.barKids.length === 2 && video.barKids.indexOf('sdpBrandCluster') >= 0 && video.barKids.indexOf('sdpTopActions') >= 0 && !video.barLeak, video.barKids);",
  "    push('v60.4 Bug3: #creditDocked is statically positioned', video.creditPos === 'static', video.creditPos);",
  "    push('v60.4 Bug4: the Words tab renders >= 25 tall .sdp-word-card items',",
  "      video.screenVisible && video.cards >= 25 && video.tall >= 25, { cards: video.cards, tall: video.tall, visible: video.screenVisible });",
  "    push('v60.4 Bug6: Test voice speaks without raising an error toast', video.testVoice && !/wrong|failed|error/i.test(video.toastText), { testVoice: video.testVoice, toasts: video.toastText });",
  "    push('v60.4 Bug7: every #screen-set sibling of #sdpNextGenSettings is hidden or inside the collapsed accordion',",
  "      video.settingsSiblings.every((s) => s.hidden), video.settingsSiblings);",
  "    push('v60.4 Bug8: no Session progress / Smart Dictation Player v58 block is visible', video.legacyVisible.length === 0, video.legacyVisible);",
  ""
].join("\n");

U.rep(
  "insert video-bug regression block",
  "    push('v60 next-gen UI raises no page errors', errors.length === 0, errors);",
  BLOCK + "    push('v60 next-gen UI raises no page errors', errors.length === 0, errors);",
  1
);

U.save(120000);
console.log("p5-gates done");
