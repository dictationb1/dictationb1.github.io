/* ============================================================================
 * P4 — Bug 5: no "Are you ready?" sheet, no split-screen legacy controls,
 * no auto-scroll away from #sdpCockpitCard.
 * ========================================================================== */
var p = require("./patchlib.cjs");
var L = p.open("data/learning-tools.js", ["</script>"]);

/* ------------------------------------------------------------------- CSS --- */
var CSS = [
  ".layer.player .lens{display:none!important;visibility:hidden!important}",
  ".layer.player .lbody{overflow-y:auto!important;scroll-behavior:auto!important;-webkit-overflow-scrolling:touch!important}",
  "#sdpLegacyPlayerDock{position:fixed!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;visibility:hidden!important}",
  "#sdpCockpitCard > *:not(#sdpEdgeBar):not(#sdpCockpitHeaderRow):not(#sdpCockpitStage):not(#sdpCockpitDock):not(#sdpCockpitFoot){display:none!important;visibility:hidden!important}",
  "#sdpCockpitCard{display:flex!important;flex-direction:column!important;gap:10px!important;padding:12px 14px!important;background:#18181B!important;border:1px solid rgba(255,255,255,0.09)!important;border-radius:18px!important;box-shadow:none!important;position:relative!important;overflow:hidden!important}",
  "#sdpCockpitCard #plWord{font-size:1.6rem!important;font-weight:800!important;color:#FAFAFA!important;letter-spacing:-0.02em!important;margin:6px 0!important;display:block!important}",
  "#sdpCockpitFoot{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important}",
  "#sdpFinishBtn{min-height:32px!important;border-radius:999px!important;border:1px solid rgba(255,255,255,0.12)!important;background:#18181B!important;color:#A1A1AA!important;font-size:11.5px!important;font-weight:700!important;padding:4px 12px!important;cursor:pointer!important}"
].join("\\n");

L.rep(
  "append v60.4 cockpit css",
  "\n    return l;\n  }",
  "\n    l.push('" + CSS.replace(/'/g, "\\u0027") + "');\n    return l;\n  }",
  1
);

/* ------------------------------------------------------------------- JS ---- */
var CODE = [
  "  /* Bug 5.1: student dictation starts in the cockpit, not the ready sheet. */",
  "  function v604Ready() {",
  "    var e = Eng();",
  "    if (!e || e.__v604Ready || typeof e.skipReady !== 'function') return;",
  "    e.__v604Ready = true;",
  "    var origReady = e.readyScreen;",
  "    e.readyScreen = function () {",
  "      var self = this;",
  "      if (W.__SDP_SKIP_READY__ === false) { return origReady ? origReady.apply(this, arguments) : undefined; }",
  "      var C = core();",
  "      try { if (C && C.Speech && C.Speech.unlock) C.Speech.unlock(); } catch (e1) {}",
  "      try { if (C && C.UI && C.UI.closeSheet) C.UI.closeSheet(); } catch (e2) {}",
  "      W.setTimeout(function () {",
  "        try { if (self && (self.st === 'ready' || self.st === 'idle')) self.skipReady(); } catch (e3) {}",
  "      }, 150);",
  "      return undefined;",
  "    };",
  "  }",
  "  /* Bug 5.2 / 5.3: legacy player chrome leaves the layout, card stays on top. */",
  "  function v604PlayerChrome(eng) {",
  "    var e = eng || Eng();",
  "    var layer = cockpitLayer(e);",
  "    if (!layer) return;",
  "    var dock = layer.querySelector('#sdpLegacyPlayerDock');",
  "    if (!dock) {",
  "      dock = mk('div', null, 'sdpLegacyPlayerDock');",
  "      dock.id = 'sdpLegacyPlayerDock';",
  "      dock.setAttribute('aria-hidden', 'true');",
  "      layer.appendChild(dock);",
  "    }",
  "    var junk = layer.querySelectorAll('.ctrlgrid, .lfoot, .lens, #plCount, #plBars');",
  "    for (var i = 0; i < junk.length; i++) {",
  "      if (junk[i].parentNode !== dock) dock.appendChild(junk[i]);",
  "    }",
  "    var fill = layer.querySelector('#plFill');",
  "    if (fill && fill.parentNode && fill.parentNode !== dock) {",
  "      var par = fill.parentNode;",
  "      if (String(par.className || '').indexOf('bar') >= 0) dock.appendChild(par);",
  "    }",
  "    var card = layer.querySelector('#sdpCockpitCard') || layer.querySelector('.wordcard');",
  "    if (card) {",
  "      var keep = { sdpEdgeBar: 1, sdpCockpitHeaderRow: 1, sdpCockpitStage: 1, sdpCockpitDock: 1, sdpCockpitFoot: 1 };",
  "      var kids = [], j, n;",
  "      for (j = 0; j < card.children.length; j++) kids.push(card.children[j]);",
  "      for (j = 0; j < kids.length; j++) {",
  "        n = kids[j];",
  "        if (keep[String(n.id || '')]) { try { n.style.removeProperty('display'); } catch (e4) {} continue; }",
  "        n.setAttribute('data-v60-legacy', '1');",
  "        try { n.style.setProperty('display', 'none', 'important'); } catch (e5) {}",
  "      }",
  "      var word = card.querySelector('#plWord');",
  "      var stage = card.querySelector('#sdpCockpitStage');",
  "      if (word) {",
  "        if (e && e.showWord && stage) {",
  "          if (word.parentNode !== stage) stage.appendChild(word);",
  "          try { word.style.setProperty('display', 'block', 'important'); } catch (e6) {}",
  "        } else {",
  "          try { word.style.setProperty('display', 'none', 'important'); } catch (e7) {}",
  "        }",
  "      }",
  "      var foot = card.querySelector('#sdpCockpitFoot');",
  "      if (foot && !card.querySelector('#sdpFinishBtn')) {",
  "        var fin = mk('button', null, 'sdpFinishBtn', T4('finish'));",
  "        fin.id = 'sdpFinishBtn';",
  "        fin.type = 'button';",
  "        on(fin, 'click', function () { try { if (e && e.finishEarly) e.finishEarly(); } catch (e8) {} });",
  "        foot.insertBefore(fin, foot.firstChild);",
  "      }",
  "    }",
  "    var body = layer.querySelector('.lbody');",
  "    if (body) {",
  "      try {",
  "        body.style.setProperty('scroll-behavior', 'auto', 'important');",
  "        body.style.setProperty('overflow-y', 'auto', 'important');",
  "        if (body.scrollTop) body.scrollTop = 0;",
  "      } catch (e9) {}",
  "    }",
  "  }",
  "  function v604Player() {",
  "    var e = Eng();",
  "    if (!e || e.__v604Player) return;",
  "    e.__v604Player = true;",
  "    if (typeof e.openPlayer === 'function') {",
  "      var op = e.openPlayer;",
  "      e.openPlayer = function () {",
  "        var out = op.apply(this, arguments);",
  "        try { v604PlayerChrome(this); } catch (e1) {}",
  "        return out;",
  "      };",
  "    }",
  "    if (typeof e.paint === 'function') {",
  "      var pa = e.paint;",
  "      e.paint = function () {",
  "        var out2 = pa.apply(this, arguments);",
  "        try { v604PlayerChrome(this); } catch (e2) {}",
  "        return out2;",
  "      };",
  "    }",
  "    if (typeof e.paintCountdown === 'function') {",
  "      var pc = e.paintCountdown;",
  "      e.paintCountdown = function () {",
  "        var out3 = pc.apply(this, arguments);",
  "        try { v604PlayerChrome(this); } catch (e3) {}",
  "        return out3;",
  "      };",
  "    }",
  "  }",
  ""
].join("\n");

L.rep(
  "insert v60.4 cockpit block",
  "  function v604All() {",
  CODE + "  function v604All() {",
  1
);

L.rep(
  "v604All runs cockpit fixes",
  "    try { v604Words(); } catch (e8) {}",
  "    try { v604Words(); } catch (e8) {}\n" +
    "    try { v604Ready(); } catch (e9) {}\n" +
    "    try { v604Player(); } catch (e10) {}\n" +
    "    try { v604PlayerChrome(); } catch (e11) {}",
  1
);

L.save(300000);
console.log("p4-cockpit done");
