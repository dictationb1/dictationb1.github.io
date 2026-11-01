var p = require('./patchlib.cjs').open('data/learning-tools.js');
p.rep('Words fallback data','    return out;\n  }\n  function weakSet() {',[
"    if (!out.length) {",
"      var raw = W.WORDS_DATA || [], publicDB = W.DB && W.DB.data;",
"      var publicLists = publicDB && publicDB.lists;",
"      if (publicLists && publicLists[0] && publicLists[0].words) out = publicLists[0].words.slice();",
"      if (!out.length && Object.prototype.toString.call(raw) === '[object Array]') out = raw.slice();",
"      if (!out.length && raw.words) out = raw.words.slice();",
"    }",
"    return out;",
"  }",
"  function weakSet() {"
].join('\n'),1);
p.rep('preserve accordion and every legacy control across refresh',"    var st = settingsData();\n    while (box.firstChild) box.removeChild(box.firstChild);","    var st = settingsData();\n    var preservedAcc = $('#sdpAppearanceAccordion');\n    if (preservedAcc) host.appendChild(preservedAcc);\n    while (box.firstChild) box.removeChild(box.firstChild);",1);
p.rep('move every settings sibling into optional accordion',"    var setBody = $('#setBody');\n    if (setBody && setBody.parentNode !== acc) acc.appendChild(setBody);",[
"    rehomeSettings();",
"    if (!host.__v60SettingsWatch && W.MutationObserver) {",
"      host.__v60SettingsWatch = new W.MutationObserver(function () { rehomeSettings(); });",
"      host.__v60SettingsWatch.observe(host, { childList: true });",
"    }"
].join('\n'),1);
p.rep('settings rehome helper','  function wrapSettings() {',[
"  function rehomeSettings() {",
"    var host = $('#screen-set'), box = $('#sdpNextGenSettings'), acc = $('#sdpAppearanceAccordion');",
"    if (!host || !box || !acc) return;",
"    var nodes = Array.prototype.slice.call(host.children);",
"    for (var i = 0; i < nodes.length; i++) {",
"      if (nodes[i] !== box && nodes[i] !== acc) acc.appendChild(nodes[i]);",
"    }",
"    var legacy = $$('#setBody > *', acc);",
"    for (var j = 0; j < legacy.length; j++) {",
"      var h = legacy[j].querySelector('h3'), title = String(h && h.textContent || '');",
"      if (legacy[j].id !== 'lgStage' && !/Appearance|Wallpaper|Studio/i.test(title)) legacy[j].style.setProperty('display', 'none', 'important');",
"    }",
"    var extras = Array.prototype.slice.call(acc.children);",
"    for (var k = 0; k < extras.length; k++) {",
"      var ex = extras[k];",
"      if (ex.tagName === 'SUMMARY' || ex.id === 'setBody' || /studio/i.test(ex.id)) continue;",
"      var eh = ex.querySelector('h3');",
"      if (!/Appearance|Wallpaper|Studio/i.test(String(eh && eh.textContent || ''))) ex.style.setProperty('display', 'none', 'important');",
"    }",
"  }",
"",
"  function wrapSettings() {"
].join('\n'),1);
p.rep('prepare sticky search and preserve legacy tabs','    var rowEl = $(\'#sdpWordFilterRow\');\n    if (rowEl) return rowEl;',[
"    var searchInput = $('#dictSearch'), dictList = $('#dictList'), searchRow = $('#sdpWordSearchRow');",
"    if (!searchRow) searchRow = mk('div', null, 'sdpWordSearchRow');",
"    if (searchInput && searchInput.parentNode !== searchRow) searchRow.appendChild(searchInput);",
"    if (dictList && dictList.parentNode !== host) host.appendChild(dictList);",
"    host.insertBefore(searchRow, dictList || host.firstChild);",
"    var legacyTabs = $('#dictTabs'); if (legacyTabs) keep(legacyTabs);",
"    var oldStacks = $$('#screen-dict > .stack');",
"    for (var si = 0; si < oldStacks.length; si++) keep(oldStacks[si]);",
"    var rowEl = $('#sdpWordFilterRow');",
"    if (rowEl) { host.insertBefore(rowEl, dictList); return rowEl; }"
].join('\n'),1);
p.rep('filter strip before all word cards',"    var search = $('#dictSearch');\n    var anchor = null;\n    if (search) { var p = search; while (p && p !== host && p.parentNode !== host) p = p.parentNode; anchor = p; }\n    if (anchor && anchor.parentNode === host) host.insertBefore(rowEl, anchor.nextSibling);\n    else host.insertBefore(rowEl, host.firstChild);","    host.insertBefore(rowEl, dictList || null);",1);
p.rep('string fallback word entries',"      var w = words[i] || {};\n      var key = String(w.w || '').toLowerCase();","      var w = words[i] || {};\n      if (typeof w === 'string') w = { w: w };\n      var key = String(w.w || '').toLowerCase();",1);
p.rep('Words sync return count',"      list.appendChild(empty);\n    }\n  }\n  function wordCard", "      list.appendChild(empty);\n    }\n    return shown.length;\n  }\n  function wordCard",1);
p.rep('Words synchronous sole render owner',"    var orig = s.dict;\n    s.dict = function () {\n      var out = orig.apply(this, arguments);\n      try { renderWordCards(); } catch (e) {}\n      return out;\n    };\n    s.__v60Dict = true;",[
"    s.__v60LegacyDict = s.dict;",
"    s.dict = function () { return renderWordCards(); };",
"    s.__v60Dict = true;"
].join('\n'),1);
p.rep('force Words tab visible and synchronous',"      try { mountChrome(); if (name === 'home') renderNextGenHome(); } catch (e) {}",[
"      try {",
"        mountChrome();",
"        if (name === 'home') renderNextGenHome();",
"        if (name === 'dict') {",
"          var dictScreen = $('#screen-dict');",
"          if (dictScreen) { dictScreen.classList.remove('hidden'); dictScreen.style.display = 'block'; }",
"          var dictScreens = Screens(); if (dictScreens && dictScreens.dict) dictScreens.dict();",
"        } else { var inactiveDict = $('#screen-dict'); if (inactiveDict) inactiveDict.style.removeProperty('display'); }",
"        if (name === 'set') rehomeSettings();",
"      } catch (e) {}"
].join('\n'),1);
var css = [
'#screen-dict:not(.hidden){display:block!important;opacity:1!important;visibility:visible!important}#screen-dict #dictList{display:flex!important;flex-direction:column!important;gap:10px!important;min-height:200px!important;opacity:1!important;visibility:visible!important}',
'#sdpWordSearchRow{position:sticky!important;top:66px!important;z-index:10!important;background:#09090B!important;padding:8px 0!important}#dictSearch{width:100%!important}#sdpWordFilterRow{margin-bottom:10px!important}',
'#screen-set>*:not(#sdpNextGenSettings){display:none!important}',
'#screen-comm .card,#screen-practice .card,#pracStage{background:#18181B!important;border:1px solid rgba(255,255,255,0.09)!important;box-shadow:none!important;border-radius:16px!important}#screen-practice .seg,#screen-comm .seg{background:#18181B!important;border:1px solid rgba(255,255,255,0.09)!important;border-radius:12px!important}#screen-practice .seg button,#screen-comm .seg button{background:transparent!important;color:#A1A1AA!important;border-radius:999px!important}#screen-practice .seg button[aria-selected="true"],#screen-practice .seg button[aria-pressed="true"],#screen-comm .seg button[aria-selected="true"]{background:#38BDF8!important;color:#062530!important}#screen-practice .seg .thumb,#screen-comm .seg .thumb{display:none!important}'
];
p.rep('final Words settings practice CSS',"    return l;\n  }\n\n  /* --------------------------------------------------- style cascade control */",css.map(function(s){return '    l.push('+JSON.stringify(s)+');';}).join('\n')+"\n    return l;\n  }\n\n  /* --------------------------------------------------- style cascade control */",1);
p.save(400000);
