/* ============================================================================
 * P3 — Bug 4 (blank Words tab), Bug 7 (Settings leaks), Practice styling,
 * plus a deeper legacy-text sweep for Bug 8.
 * ========================================================================== */
var p = require("./patchlib.cjs");
var L = p.open("data/learning-tools.js", ["</script>"]);

/* ---------------------------------------------------------------- extra CSS */
var CSS = [
  "/* ---- v60 / 9.0.0.4 words + settings + practice ---- */",
  "#screen-dict:not(.hidden){display:block!important;opacity:1!important;visibility:visible!important}",
  "#screen-dict #dictList,#dictList{display:flex!important;flex-direction:column!important;gap:10px!important;min-height:200px!important;opacity:1!important;visibility:visible!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}",
  "#dictList .sdp-word-card,#dictList .wordcard,#dictList .v59-dict-card{display:flex!important;flex-direction:column!important;opacity:1!important;visibility:visible!important;background:#18181B!important;border:1px solid rgba(255,255,255,0.09)!important;border-radius:14px!important;padding:12px 14px!important;box-shadow:none!important;min-height:64px!important}",
  "#sdpWordFilterRow{display:flex!important;gap:6px!important;flex-wrap:wrap!important;margin:8px 0 10px!important}",
  "#sdpWordFilterRow button{min-height:32px!important;border-radius:999px!important;border:1px solid rgba(255,255,255,0.12)!important;background:#18181B!important;color:#A1A1AA!important;font-size:11.5px!important;font-weight:700!important;padding:4px 12px!important}",
  "#sdpWordFilterRow button[aria-pressed=\"true\"]{background:#38BDF8!important;border-color:#38BDF8!important;color:#062530!important}",
  "#screen-set > *:not(#sdpNextGenSettings){display:none!important;visibility:hidden!important}",
  "#pasteHelper,#sdpPasteHelper{display:none!important}",
  "#sdpAppearanceAccordion{display:block!important;width:100%!important;margin-top:12px!important;background:#18181B!important;border:1px solid rgba(255,255,255,0.09)!important;border-radius:14px!important;padding:0!important;overflow:hidden!important}",
  "#sdpAppearanceAccordion > summary{cursor:pointer!important;padding:14px 16px!important;font-size:11px!important;font-weight:800!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:#A1A1AA!important;list-style:none!important}",
  "#sdpAppearanceAccordion[open] > summary{border-bottom:1px solid rgba(255,255,255,0.08)!important;color:#FAFAFA!important}",
  "#sdpAppearanceAccordion > *:not(summary){padding:0 14px!important}",
  "#sdpAppearanceAccordion > *:not(summary):last-child{padding-bottom:14px!important}",
  ".v58-mastery-card,.v58-session-prog,.v58-footer,.v58-home-footer{display:none!important;visibility:hidden!important}",
  "#screen-comm .card,#screen-comm .glass,#screen-comm .wordcard,#screen-comm .v58-tile{background:#18181B!important;border:1px solid rgba(255,255,255,0.09)!important;border-radius:14px!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
  "#screen-comm .chip,#screen-comm .sdp-btn{background:#18181B!important;border:1px solid rgba(255,255,255,0.12)!important;color:#A1A1AA!important;box-shadow:none!important;border-radius:999px!important}",
  "#screen-comm .chip.on,#screen-comm .chip[aria-pressed=\"true\"],#screen-comm .sdp-btn.primary,#screen-comm [aria-pressed=\"true\"]{background:#38BDF8!important;border-color:#38BDF8!important;color:#062530!important}"
].join("\\n");

L.rep(
  "append v60.4 words/settings css",
  "\n    return l;\n  }",
  "\n    l.push('" + CSS.replace(/'/g, "\\u0027") + "');\n    return l;\n  }",
  1
);

/* ------------------------------------------------------------- settings fix */
var CODE = [
  "  /* Bug 7: nothing but #sdpNextGenSettings may render in #screen-set. */",
  "  function v604Settings() {",
  "    var host = $('#screen-set');",
  "    if (!host) return;",
  "    var ng = $('#sdpNextGenSettings');",
  "    var acc = $('#sdpAppearanceAccordion');",
  "    if (!ng) return;",
  "    if (!acc) {",
  "      acc = mk('details', null, 'sdpAppearanceAccordion');",
  "      acc.appendChild(mk('summary', null, null, T4('p3')));",
  "      ng.appendChild(acc);",
  "    }",
  "    var kids = [], i, n, id;",
  "    for (i = 0; i < host.children.length; i++) kids.push(host.children[i]);",
  "    for (i = 0; i < kids.length; i++) {",
  "      n = kids[i];",
  "      if (!n || n === ng) continue;",
  "      id = String(n.id || '');",
  "      if (id === 'sdpAppearanceAccordion') continue;",
  "      if (acc && n.parentNode !== acc) acc.appendChild(n);",
  "      try { n.style.display = 'none'; } catch (e1) {}",
  "      n.setAttribute('data-v60-legacy', '1');",
  "    }",
  "  }",
  "  /* Bug 8: climb from a legacy seed to the whole legacy block, then hide it. */",
  "  function v604HideBlock(seed) {",
  "    if (!seed || seed.nodeType !== 1) return;",
  "    var n = seed, best = seed, p, t;",
  "    while (n && n.parentNode && n.parentNode.nodeType === 1) {",
  "      p = n.parentNode;",
  "      if (!p || p === D.body) break;",
  "      if (p.id === 'app' || p.id === 'screen-home' || p.id === 'screen-dict' || p.id === 'screen-comm' || p.id === 'screen-set') break;",
  "      if (/\\bscreen\\b/.test(String(p.className || ''))) break;",
  "      t = String(p.textContent || '').replace(/^\\s+/, '');",
  "      if (!/^(Session progress|Smart Dictation Player v58)/.test(t)) break;",
  "      best = p;",
  "      n = p;",
  "    }",
  "    best.setAttribute('data-v60-legacy', '1');",
  "    try { best.style.display = 'none'; } catch (e2) {}",
  "  }",
  "  function v604LegacyBlocks() {",
  "    var roots = ['#screen-home', '#screen-dict', '#screen-comm', '#screen-set'];",
  "    var i, j, all, n, first, txt;",
  "    for (i = 0; i < roots.length; i++) {",
  "      var host = $(roots[i]);",
  "      if (!host || !host.querySelectorAll) continue;",
  "      all = host.querySelectorAll('*');",
  "      for (j = 0; j < all.length; j++) {",
  "        n = all[j];",
  "        if (n.getAttribute && n.getAttribute('data-v60-legacy') === '1') continue;",
  "        first = '';",
  "        for (var k = 0; k < n.childNodes.length; k++) {",
  "          if (n.childNodes[k].nodeType === 3) { first = String(n.childNodes[k].nodeValue || '').replace(/^\\s+/, ''); break; }",
  "          if (n.childNodes[k].nodeType === 1) break;",
  "        }",
  "        if (!first) continue;",
  "        txt = first.slice(0, 32);",
  "        if (/^(Session progress|Smart Dictation Player v58)/.test(txt)) v604HideBlock(n);",
  "      }",
  "    }",
  "    var stat = $('#staticFooter');",
  "    if (stat) stat.setAttribute('data-v60-legacy', '1');",
  "  }",
  "  /* Bug 4: the Words tab must always render synchronously. */",
  "  function v604Words() {",
  "    var tab = $('#tab-dict');",
  "    if (tab && !tab.__v604Dict) {",
  "      on(tab, 'click', function () {",
  "        try { var u = UI(); if (u && u.setTab) u.setTab('dict'); } catch (e1) {}",
  "        var sd = $('#screen-dict');",
  "        if (sd) {",
  "          try { sd.className = String(sd.className || '').replace(/\\bhidden\\b/g, '').replace(/\\s+/g, ' ').replace(/^\\s+|\\s+$/g, ''); } catch (e2) {}",
  "          try { sd.style.display = 'block'; sd.style.opacity = '1'; sd.style.visibility = 'visible'; } catch (e3) {}",
  "        }",
  "        try { var s = Screens(); if (s && s.dict) s.dict(); } catch (e4) {}",
  "      });",
  "      tab.__v604Dict = true;",
  "    }",
  "  }",
  ""
].join("\n");

L.rep(
  "insert v60.4 settings/words block",
  "  function v604All() {",
  CODE + "  function v604All() {",
  1
);

L.rep(
  "v604All runs the new fixes",
  "    try { v604LegacyText(); } catch (e4) {}",
  "    try { v604LegacyText(); } catch (e4) {}\n" +
    "    try { v604Settings(); } catch (e6) {}\n" +
    "    try { v604LegacyBlocks(); } catch (e7) {}\n" +
    "    try { v604Words(); } catch (e8) {}",
  1
);

L.save(300000);
console.log("p3-words-settings done");
