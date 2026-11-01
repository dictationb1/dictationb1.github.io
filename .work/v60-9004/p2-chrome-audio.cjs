var lib = require('./patchlib.cjs');
var p = lib.open('data/learning-tools.js', ['/* ============================================================================']);
p.rep('retire legacy rail refresh timers','Learn.syncRail = guard(function () {','Learn.syncRail = guard(function () {\n    if (W.SDP_NEXTGEN_V60) return;',1);
p.rep('retire legacy rail injection','Learn.buildRail = guard(function () {','Learn.buildRail = guard(function () {\n    if (W.SDP_NEXTGEN_V60) return;',1);
p.rep('retire legacy offline refresh','Learn.syncOfflineRow = guard(function () {','Learn.syncOfflineRow = guard(function () {\n    if (W.SDP_NEXTGEN_V60) return;',2);
p.rep('retire legacy bento injection','V59.ensureBentoTiles = guard(function () {','V59.ensureBentoTiles = guard(function () {\n    if (W.SDP_NEXTGEN_V60) return;',1);
p.rep('keeper important display',"      box.style.display = 'none';","      box.style.setProperty('display', 'none', 'important');",1);
p.rep('only clean topbar children',"      var legacyControls = $('.topbar .row.top-controls');\n      if (legacyControls) keep(legacyControls);",[
"      var oldChildren = Array.prototype.slice.call(bar.childNodes);",
"      for (var ci = 0; ci < oldChildren.length; ci++) {",
"        var child = oldChildren[ci];",
"        if (child.id !== 'sdpBrandCluster' && child.id !== 'sdpTopActions') keep(child);",
"      }"
].join('\n'),1);
p.rep('voice top action label',"mic.setAttribute('aria-label', 'Start dictation by voice');","mic.setAttribute('aria-label', 'Test Alice voice');",1);
p.rep('voice top action',"on(mic, 'click', function () { startDictation(); });","on(mic, 'click', testVoice);",1);
p.rep('credit in home flow',"      D.body.appendChild(cd);","      var creditHome = $('#screen-home');\n      if (creditHome) creditHome.appendChild(cd);",1);
p.rep('credit always last and retire legacy text',"    if (!$('#creditPill')) {","    var homeCredit = $('#creditDocked'), homeScreen = $('#screen-home');\n    if (homeCredit && homeScreen) homeScreen.appendChild(homeCredit);\n    retireLegacyText();\n    if (!$('#creditPill')) {",1);
p.rep('normalize shared say options',"sp.say(String(text), slow ? 0.72 : 1);","sp.say([String(text)], { rate: slow ? 0.72 : 0.9, volume: 1 }, function () {});",1);
p.rep('voice test alias and safe array',"    on(testBtn, 'click', function () { say('This is Alice. Your dictation voice is ready.', false); });\n    vrow.appendChild(vleft);\n    vrow.appendChild(testBtn);",[
"    var testWrap = mk('span', null, 'sdpBtnTestVoice');",
"    testWrap.appendChild(testBtn);",
"    on(testWrap, 'click', testVoice);",
"    vrow.appendChild(vleft);",
"    vrow.appendChild(testWrap);"
].join('\n'),1);
var helpers = [
"  function normalizeSpeech() {",
"    var c = core(), targets = [c && c.Speech, W.Speech];",
"    for (var i = 0; i < targets.length; i++) {",
"      var sp = targets[i];",
"      if (!sp || typeof sp.say !== 'function' || sp.__v60ArraySay) continue;",
"      (function (speech, origSay) {",
"        speech.say = function (items, opts, cb) {",
'          if (typeof items === "string") items = [items];',
"          return origSay.call(this, items, opts, cb);",
"        };",
"        speech.__v60ArraySay = true;",
"      })(sp, sp.say);",
"    }",
"  }",
"  function testVoice() {",
"    normalizeSpeech();",
"    var sp = core() && core().Speech;",
"    if (sp && sp.say) sp.say([\"This is Alice, your UK English dictation voice.\"], { rate: 0.9, volume: 1 }, function () {});",
"  }",
"  function retireLegacyText() {",
"    var nodes = $$('div,footer', D.body);",
"    for (var i = 0; i < nodes.length; i++) {",
"      var el = nodes[i], text = String(el.textContent || '').replace(/^\\s+/, '');",
"      if (/^(app|screen-home|screen-dict|screen-comm|screen-set|sdpLegacyKeeper)$/.test(el.id || '')) continue;",
"      if (/^(Session progress|Smart Dictation Player v58)/.test(text)) el.style.setProperty('display', 'none', 'important');",
"    }",
"  }",
"  normalizeSpeech();",
""
].join('\n');
p.rep('speech and legacy cleanup helpers','  function mountChrome() {',helpers+'  function mountChrome() {',1);
var css = [
'.topbar,.topbar.glass{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;max-width:none!important;height:56px!important;min-height:56px!important;margin:0!important;padding:0 14px!important;background:#09090B!important;border:none!important;border-bottom:1px solid rgba(255,255,255,0.09)!important;border-radius:0!important;box-shadow:0 4px 16px rgba(0,0,0,0.6)!important;z-index:120!important;transform:none!important;display:flex!important;align-items:center!important;justify-content:space-between!important;box-sizing:border-box!important}',
'#creditDocked{position:static!important;transform:none!important;display:flex!important;align-items:center!important;justify-content:center!important;width:fit-content!important;margin:18px auto 6px!important;pointer-events:none!important}',
'#staticFooter,.v58-footer,.v58-session-prog,.v58-offline-card,#v58OfflineRow,#screen-home>*:not(#homeAnn):not(#homeResume):not(#sdpHomeGreeting):not(#homeHero):not(#sdpHomeStatsRow):not(#sdpQuickPracticeGrid):not(#creditDocked){display:none!important}'
];
p.rep('final chrome cascade',"    return l;\n  }\n\n  /* --------------------------------------------------- style cascade control */",css.map(function(s){return '    l.push('+JSON.stringify(s)+');';}).join('\n')+"\n    return l;\n  }\n\n  /* --------------------------------------------------- style cascade control */",1);
p.rep('named v60 mount',"  function boot() {\n    if (!D.body)","  function mountNextGenUI() {\n    if (!D.body)",1);
p.rep('mount retry',"if (V.retries < 200) W.setTimeout(boot, 60)","if (V.retries < 200) W.setTimeout(mountNextGenUI, 60)",1);
p.rep('v60 kick',"function kick() { W.setTimeout(boot, 30); }","function kick() { W.setTimeout(mountNextGenUI, 30); }",1);
p.rep('lift after complete mount',"    W.setTimeout(showLoadToast, 700);",'    normalizeSpeech();\n    retireLegacyText();\n    document.body.setAttribute("data-v60-ready", "1");\n    W.setTimeout(showLoadToast, 700);',1);
p.save(400000);
