/* ============================================================================
 * P2 — Bugs 1, 2, 3, 6, 8: Speech.say string guard, solid full-bleed topbar,
 * static #creditDocked, legacy v58 chrome suppression, data-v60-ready lift.
 * ========================================================================== */
var p = require("./patchlib.cjs");

/* ---------------------------------------------------------- learning-tools */
var L = p.open("data/learning-tools.js", ["</script>"]);

/* Bug 6 root cause: say(text) passed a bare string as Speech.say items, so the
   legacy player looped over every character ("T","h","i","s",...). */
L.rep(
  "say() passes an array",
  "      if (sp && typeof sp.say === 'function') { sp.say(String(text), slow ? 0.72 : 1); return; }",
  "      if (sp && typeof sp.say === 'function') { sp.say([String(text)], { rate: slow ? 0.72 : 1 }, function () {}); return; }",
  1
);

/* CSS overrides are appended to the END of #sdpNextGenCss so they win the
   cascade against the earlier v60 rules that caused the video regressions. */
var CSS = [
  "/* ---- v60 / 9.0.0.4 live-video audit fixes ---- */",
  ".topbar,.topbar.glass{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;max-width:none!important;height:56px!important;min-height:56px!important;margin:0!important;padding:0 14px!important;background:#09090B!important;border:0!important;border-bottom:1px solid rgba(255,255,255,0.09)!important;border-radius:0!important;box-shadow:0 4px 16px rgba(0,0,0,0.6)!important;z-index:120!important;transform:none!important;display:flex!important;align-items:center!important;justify-content:space-between!important;box-sizing:border-box!important;overflow:hidden!important}",
  "#sdpBrandCluster{display:flex!important;flex-direction:row!important;align-items:center!important;gap:10px!important;min-width:0!important;flex:1 1 auto!important;position:static!important;background:transparent!important;border:0!important;box-shadow:none!important}",
  "#sdpBrandText{display:flex!important;flex-direction:column!important;justify-content:center!important;min-width:0!important;line-height:1.15!important;gap:1px!important;position:static!important}",
  "#brandName{position:static!important;display:block!important;font-size:14px!important;font-weight:750!important;color:#FAFAFA!important;letter-spacing:-0.01em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;margin:0!important;padding:0!important;background:none!important;border:0!important}",
  "#brandSub{position:static!important;display:block!important;font-size:10px!important;font-weight:600!important;color:#A1A1AA!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;margin:0!important;padding:0!important}",
  "#sdpVerPill{position:static!important;font-size:9.5px!important;font-weight:800!important;letter-spacing:.04em!important;color:#38BDF8!important;background:#0C2D3E!important;border-radius:6px!important;padding:1px 5px!important;margin-left:6px!important;display:inline-block!important;line-height:1.3!important;vertical-align:middle!important}",
  "#creditDocked{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;display:flex!important;align-items:center!important;justify-content:center!important;width:-moz-fit-content!important;width:fit-content!important;margin:18px auto 6px!important;pointer-events:none!important;z-index:1!important;font-size:10.5px!important;font-weight:650!important;color:#71717A!important;background:#121215!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:999px!important;padding:4px 12px!important}",
  "#staticFooter,.v58-footer,.v58-home-footer,.v58-session-prog,.v58-offline-card,.v58-bento{display:none!important;visibility:hidden!important}",
  "[data-v60-legacy=\"1\"]{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}"
].join("\\n");

L.rep(
  "append v60.4 chrome css",
  "\n    return l;\n  }",
  "\n    l.push('" + CSS.replace(/'/g, "\\u0027") + "');\n    return l;\n  }",
  1
);

/* Patch logic block inserted just before the boot() comment. */
var CODE = [
  "  /* ======================= v60 / 9.0.0.4 live-video regression fixes === */",
  "  function v604Keeper() {",
  "    var box = $('#sdpLegacyKeeper');",
  "    if (!box) { box = keep(mk('div', null, 'sdpLegacyKeeper')); }",
  "    return box;",
  "  }",
  "  /* Bug 2: .topbar must contain ONLY #sdpBrandCluster + #sdpTopActions. */",
  "  function v604SweepTopbar() {",
  "    var bar = $('.topbar');",
  "    if (!bar) return;",
  "    var kids = [], i, n, id;",
  "    for (i = 0; i < bar.children.length; i++) kids.push(bar.children[i]);",
  "    for (i = 0; i < kids.length; i++) {",
  "      n = kids[i];",
  "      id = String(n.id || '');",
  "      if (id === 'sdpBrandCluster' || id === 'sdpTopActions') continue;",
  "      keep(n);",
  "    }",
  "    var cluster = $('#sdpBrandCluster');",
  "    if (!cluster) return;",
  "    var textbox = $('#sdpBrandText');",
  "    if (!textbox) { textbox = mk('div', null, 'sdpBrandText'); cluster.appendChild(textbox); }",
  "    var name = $('#brandName'), sub = $('#brandSub'), j;",
  "    if (name && name.parentNode !== textbox) textbox.appendChild(name);",
  "    if (sub && sub.parentNode !== textbox) textbox.appendChild(sub);",
  "    if (name) { for (j = 0; j < name.children.length; j++) { if (name.children[j].id !== 'sdpVerPill') {} } }",
  "    if (name && !$('#sdpVerPill')) {",
  "      var pill = mk('span', null, 'sdpVerPill', 'v' + V.id);",
  "      pill.setAttribute('aria-label', 'version ' + V.ver);",
  "      if (name.parentNode) name.parentNode.appendChild(pill);",
  "    }",
  "  }",
  "  /* Bug 8: hide any legacy block that still renders the v58 footer/progress. */",
  "  function v604LegacyText() {",
  "    var screens = ['screen-home', 'screen-dict', 'screen-comm', 'screen-set'];",
  "    var bad = ['Session progress', 'Smart Dictation Player v58'];",
  "    var i, j, k, scr, kids, all, n, t, tag;",
  "    for (i = 0; i < screens.length; i++) {",
  "      scr = $('#' + screens[i]);",
  "      if (!scr) continue;",
  "      kids = [];",
  "      all = [];",
  "      for (j = 0; j < scr.children.length; j++) kids.push(scr.children[j]);",
  "      for (j = 0; j < kids.length; j++) {",
  "        all.push(kids[j]);",
  "        for (k = 0; k < kids[j].children.length; k++) all.push(kids[j].children[k]);",
  "      }",
  "      for (j = 0; j < all.length; j++) {",
  "        n = all[j];",
  "        if (!n || n.nodeType !== 1) continue;",
  "        if (n.id === 'sdpNextGenSettings' || n.id === 'sdpCockpitCard' || n.id === 'creditDocked') continue;",
  "        tag = String(n.tagName || '').toLowerCase();",
  "        if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') continue;",
  "        t = String(n.textContent || '').replace(/^\\s+/, '').slice(0, 40);",
  "        for (k = 0; k < bad.length; k++) {",
  "          if (t.indexOf(bad[k]) === 0) {",
  "            n.setAttribute('data-v60-legacy', '1');",
  "            try { n.style.display = 'none'; } catch (e1) {}",
  "          }",
  "        }",
  "      }",
  "    }",
  "  }",
  "  /* Bug 3: #creditDocked lives in the #screen-home scroll flow, never fixed. */",
  "  function v604Credit() {",
  "    var cd = $('#creditDocked');",
  "    if (!cd) return;",
  "    var home = $('#screen-home');",
  "    if (home && cd.parentNode !== home) home.appendChild(cd);",
  "    try {",
  "      cd.style.position = 'static';",
  "      cd.style.transform = 'none';",
  "      cd.style.left = 'auto';",
  "      cd.style.right = 'auto';",
  "      cd.style.top = 'auto';",
  "      cd.style.bottom = 'auto';",
  "      cd.style.display = 'flex';",
  "      cd.style.margin = '18px auto 6px';",
  "    } catch (e1) {}",
  "  }",
  "  /* Bug 6: Speech.say(items) requires an array; coerce a bare string. */",
  "  function v604Speech() {",
  "    var C = core();",
  "    if (!C) return;",
  "    var sp = C.Speech;",
  "    if (!sp || typeof sp.say !== 'function' || sp.__v604Say) return;",
  "    var orig = sp.say;",
  "    sp.say = function (items, opts, cb) {",
  "      if (typeof items === 'string') items = [items];",
  "      return orig.call(this, items, opts, cb);",
  "    };",
  "    sp.__v604Say = true;",
  "  }",
  "  function v604All() {",
  "    try { v604Speech(); } catch (e1) {}",
  "    try { v604SweepTopbar(); } catch (e2) {}",
  "    try { v604Credit(); } catch (e3) {}",
  "    try { v604LegacyText(); } catch (e4) {}",
  "    try { if (D.body) D.body.setAttribute('data-v60-ready', '1'); } catch (e5) {}",
  "  }",
  ""
].join("\n");

L.rep(
  "insert v60.4 fix block",
  "  /* ---------------------------------------------------------------- boot */",
  CODE + "  /* ---------------------------------------------------------------- boot */",
  1
);

L.rep(
  "boot calls the fix block",
  "    try { wrapSettings(); wrapDict(); wrapCockpit(); } catch (e) {}\n    W.setTimeout(showLoadToast, 700);",
  "    try { wrapSettings(); wrapDict(); wrapCockpit(); } catch (e) {}\n" +
    "    try { v604Keeper(); v604All(); } catch (e0) {}\n" +
    "    W.setTimeout(function () { try { v604All(); } catch (e1) {} }, 900);\n" +
    "    W.setTimeout(function () { try { v604All(); } catch (e2) {} }, 2000);\n" +
    "    W.setTimeout(function () { try { v604All(); } catch (e3) {} }, 4000);\n" +
    "    W.setTimeout(showLoadToast, 700);",
  1
);

L.save(300000);
console.log("p2-chrome-audio done");
