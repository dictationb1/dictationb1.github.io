/* v60 smoke test: build the Next-Gen UI inside JSDOM and report what exists. */
var fs = require("fs"), path = require("path");
var { harness } = require("../../tests/app-harness.cjs");
var LEARN = fs.readFileSync(path.resolve(__dirname, "../../data/learning-tools.js"), "utf8");

var app = harness(null, {});
var w = app.w, doc = w.document;
var errs = [];
try { w.eval(LEARN); } catch (e) { errs.push("eval: " + e.message); }
app.clock.tick(2000);

function report() {
  var ids = ["sdpHomeGreeting", "sdpHeroConfigChips", "sdpHomeStatsRow", "sdpQuickPracticeGrid", "sdpBrandCluster",
    "sdpTopActions", "sdpDesktopRail", "creditDocked", "creditPill", "microToastLoad", "sdpLegacyKeeper",
    "sdpNextGenCss", "sdpV57Css", "sdpV58Css", "tab-dictate", "tab-prac", "tab-comm", "tab-home", "tab-set"];
  var out = [];
  ids.forEach(function (id) { out.push(id + "=" + (doc.getElementById(id) ? "Y" : "N")); });
  console.log("IDS " + out.join(" "));
  var head = doc.head;
  console.log("head last = " + (head.lastElementChild && head.lastElementChild.id));
  var a = doc.getElementById("sdpV57Css"), b = doc.getElementById("sdpV58Css");
  console.log("v57 disabled=" + (a && a.disabled) + " text=" + JSON.stringify(a && a.textContent.slice(0, 22)));
  console.log("v58 disabled=" + (b && b.disabled));
  console.log("body class = " + JSON.stringify(doc.body.className));
  console.log("keeper children = " + (doc.getElementById("sdpLegacyKeeper") ? doc.getElementById("sdpLegacyKeeper").children.length : -1));
  console.log("homeKicker = " + JSON.stringify((doc.getElementById("homeKicker") || {}).textContent));
  console.log("homeSub = " + JSON.stringify((doc.getElementById("homeSub") || {}).textContent));
  console.log("btnStartText = " + JSON.stringify((doc.getElementById("btnStartText") || {}).textContent));
  try {
    w.SDPCore.Screens.dict();
    console.log("dictList children = " + doc.getElementById("dictList").children.length);
    w.SDPCore.Screens.settings();
    console.log("setBody children = " + doc.getElementById("setBody").children.length);
    w.SDPCore.UI.setTab("set");
    console.log("after setTab(set) #sdpNextGenSettings = " + !!doc.getElementById("sdpNextGenSettings"));
    w.SDPCore.UI.setTab("comm");
    console.log("setTab(comm) screen-comm hidden = " + /\bhidden\b/.test(doc.getElementById("screen-comm").className));
    w.SDPCore.UI.setTab("home");
    console.log("setTab(dictate) ok");
    w.SDPCore.UI.setTab("dictate");
  } catch (e) { console.log("ERR nav: " + e.message); }
  try { w.SDP_applyLang("si"); console.log("si greeting = " + JSON.stringify(doc.getElementById("sdpHomeGreetingL").textContent)); w.SDP_applyLang("en"); } catch (e) { console.log("ERR lang: " + e.message); }
  console.log("errors:", errs.slice(0, 3));
  console.log("consoleErrors:", app.consoleErrors.slice(0, 5));
}
report();
app.close();
/* ---- P4 section ---- */
(function () {
  var fs = require("fs"), path = require("path");
  var { harness } = require("../../tests/app-harness.cjs");
  var LEARN = fs.readFileSync(path.resolve(__dirname, "../../data/learning-tools.js"), "utf8");
  var app = harness(null, {});
  var w = app.w, doc = w.document;
  try { w.eval(LEARN); } catch (e) { console.log("EVAL ERR " + e.message); }
  app.clock.tick(2500);
  var C = w.SDPCore;
  try { C.UI.setTab("set"); } catch (e) { console.log("ERR setTab " + e.message); }
  app.clock.tick(50);
  var box = doc.getElementById("sdpNextGenSettings");
  console.log("settings box:", !!box, "isFirst:", doc.getElementById("screen-set").firstElementChild === box);
  var acc = doc.getElementById("sdpAppearanceAccordion");
  console.log("accordion:", !!acc, "open:", acc && acc.open, "setBody inside:", !!(doc.getElementById("setBody") && doc.getElementById("setBody").closest("details#sdpAppearanceAccordion")));
  ["sdpSegMode", "sdpSegSpeed", "sdpSegRepeats", "sdpRangeWait", "sdpToggleAutoSentence", "sdpSegLang", "sdpTestVoice", "rateRange", "volRange", "repeatsSelect", "readSentenceToggle", "writeSecsRange", "bitrateSelect"].forEach(function (id) {
    if (!doc.getElementById(id)) console.log("MISSING " + id);
  });
  try { doc.getElementById("sdpSegSpeed").children[0].click(); } catch (e) { console.log("ERR speed " + e.message); }
  console.log("rate after click:", C.DB.data.settings.rate);
  try { C.UI.setTab("dict"); } catch (e) { console.log("ERR dicttab " + e.message); }
  app.clock.tick(50);
  console.log("filter row:", !!doc.getElementById("sdpWordFilterRow"), "cards:", doc.querySelectorAll("#dictList .sdp-word-card").length, "si pills:", doc.querySelectorAll("#dictList .v59-si-pill, #dictList .sdp-si-pill").length, "ipa:", doc.querySelectorAll("#dictList .v59-ipa").length);
  try { C.UI.setTab("home"); } catch (e) { console.log("ERR hometab " + e.message); }
  try { C.Eng.start({}); app.clock.tick(20); if (C.Eng.skipReady) C.Eng.skipReady(); else C.Eng.start({}); } catch (e) { console.log("ERR engstart " + e.message); }
  app.clock.tick(100);
  ["sdpCockpitCard", "sdpEdgeBar", "sdpTimerPill", "sdpCockpitDock", "sdpWordMapCard", "sdpCockpitCounters", "cdNum", "plStatus", "cdFg", "ansInput"].forEach(function (id) {
    console.log("cockpit " + id + "=" + (doc.getElementById(id) ? "Y" : "N"));
  });
  var card = doc.getElementById("sdpCockpitCard");
  console.log("card inside layer:", !!(card && card.closest(".layer.player")));
  console.log("errors:", app.consoleErrors.filter(function (m) { return !/Not implemented/.test(m); }).slice(0, 6));
  app.close();
})();
