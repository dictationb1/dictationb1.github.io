/* P5 fixes: SW boot guard, targeted legacy player button hiding, lockstep test tweaks */
var fs = require("fs");

/* 1. index.html #sdpSwBoot - never touch the Service Worker API outside http(s) and swallow rejections */
var h = require("./patchlib.cjs").open("index.html", ["</html>", "<body", "<script", "<style"]);
var BOOT = [
  '<script id="sdpSwBoot">',
  '(function(){try{var V="9.0.0.3",K="sdp_sw_ver";var LS=window.localStorage;var seen="";',
  'try{seen=(LS&&LS.getItem(K))||"";}catch(e0){}if(seen===V)return;',
  'try{if(LS)LS.setItem(K,V);}catch(e1){}',
  'var SECURE=/^https?:$/.test(String(location.protocol));',
  'try{if(SECURE&&window.caches&&window.caches.keys){window.caches.keys().then(function(ks){',
  'for(var i=0;i<ks.length;i++){var k=ks[i];',
  'if(k.indexOf(V)===-1&&k!=="sdp-youdao-v1"){try{window.caches["delete"](k);}catch(e2){}}}})["catch"](function(){});}}catch(e3){}',
  'try{var SWN=SECURE&&navigator.serviceWorker;if(SWN&&SWN.getRegistrations){SWN.getRegistrations().then(function(rs){',
  'for(var j=0;j<rs.length;j++){try{rs[j].update();}catch(e4){}}',
  'try{SWN.addEventListener("controllerchange",function(){location.reload();},{once:true});}catch(e5){}})["catch"](function(){});}}catch(e6){}',
  '}catch(e){}})();',
  '</script>'
].join("");
h.regex("sw-boot-secure", /<script id="sdpSwBoot">[\s\S]*?<\/script>/, function () { return BOOT; }, 1);
h.save(598000);

/* 2. learning-tools.js - hide only the duplicate legacy helper buttons, never #plPlay/#plBars */
var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion"]);
var oldFn = [
  "  var KEEP_PLAYER = { sdpCockpitCard: 1, sdpCockpitHeaderRow: 1, sdpCockpitStage: 1, sdpCockpitDock: 1, sdpCockpitFoot: 1, sdpEdgeBar: 1 };",
  "  function hideLegacyPlayerButtons(card) {",
  "    var kids = card.children;",
  "    for (var i = 0; i < kids.length; i++) {",
  "      var k = kids[i];",
  "      if (!k || KEEP_PLAYER[k.id]) continue;",
  "      if (k.querySelector && k.querySelector('#ansInput')) continue;",
  "      if (k.querySelector && k.querySelector('button')) { k.style.display = 'none'; }",
  "    }",
  "  }"
].join("\n");
var newFn = [
  "  var DUP_BTN = /^(repeat word|repeat sentence|slower|spell it|previous|pause|test sound|finish early|restart)$/i;",
  "  function hideLegacyPlayerButtons(card) {",
  "    var btns = card.querySelectorAll('button'), i;",
  "    for (i = 0; i < btns.length; i++) {",
  "      var b = btns[i];",
  "      if (b.id === 'sdpPauseBtn' || b.id === 'sdpSkipBtn') continue;",
  "      if (b.closest && b.closest('#sdpCockpitDock,#sdpCockpitFoot')) continue;",
  "      var label = String(b.textContent || '').replace(/\\s+/g, ' ').replace(/^[^A-Za-z]+/, '').trim();",
  "      if (DUP_BTN.test(label)) b.style.display = 'none';",
  "    }",
  "  }"
].join("\n");
p.rep("player-buttons", oldFn, newFn, 1);
p.save(260000);

/* 3. tests/browser.cjs - home readiness marker is the v60 language pill (the legacy chip is retired) */
var b = require("./patchlib.cjs").open("tests/browser.cjs", ["results.push", "async function"]);
b.rep("wait-home-marker",
  "if(await page.locator('#btnLang').isVisible().catch(()=>false)&&await page.locator('#sheets .sheet').count()===0)return true;",
  "if(await page.locator('#sdpTopLangPill').isVisible().catch(()=>false)&&await page.locator('#sheets .sheet').count()===0)return true;",
  1);
b.save(80000);

/* 4. tests/e2e.cjs - let the v60 settings panel settle before opening the appearance accordion */
var e = require("./patchlib.cjs").open("tests/e2e.cjs", ["rec(", "async function"]);
e.rep("e2e-settle",
  "await page.evaluate(() => { const d = document.getElementById('sdpAppearanceAccordion'); if (d) d.open = true; });",
  "await page.waitForTimeout(500);\n  await page.evaluate(() => { const d = document.getElementById('sdpAppearanceAccordion'); if (d) d.open = true; });",
  1);
e.save(80000);
console.log("p5 fixes done");
