/* P3 probe: what does #tab-dict do, and why is #dictList empty? */
var fs = require("fs");
var path = require("path");
var ROOT = path.resolve(__dirname, "../..");
process.chdir(ROOT);
var harness = require(path.join(ROOT, "tests/app-harness.cjs")).harness;
var learn = fs.readFileSync(path.join(ROOT, "data/learning-tools.js"), "utf8");

var app = harness(null, {});
app.w.eval(learn);
app.clock.tick(2500);
var doc = app.w.document, C = app.w.SDPCore;

function state(tag) {
  var sd = doc.getElementById("screen-dict");
  var dl = doc.getElementById("dictList");
  var cards = doc.querySelectorAll("#dictList .sdp-word-card");
  console.log(tag + " | screen-dict.class=" + (sd ? sd.className : "MISSING") +
    " | dictList.children=" + (dl ? dl.children.length : -1) +
    " | cards=" + cards.length +
    " | first=" + JSON.stringify(cards.length ? cards[0].textContent.replace(/\s+/g, " ").slice(0, 70) : ""));
}
try { console.log("Lib.current words = " + (C && C.Lib && C.Lib.current() && C.Lib.current().words ? C.Lib.current().words.length : "n/a")); } catch (e) { console.log("Lib.current err " + e.message); }
try { console.log("DB.data.lists = " + (C && C.DB && C.DB.data && C.DB.data.lists ? C.DB.data.lists.length + " lists, first=" + (C.DB.data.lists[0] && C.DB.data.lists[0].words ? C.DB.data.lists[0].words.length : "?") + " words" : "n/a")); } catch (e) { console.log("DB err " + e.message); }
state("boot");
try { C.Screens.dict(); } catch (e) { console.log("Screens.dict threw " + e.message); }
state("after Screens.dict()");
var tab = doc.getElementById("tab-dict");
if (tab) { tab.dispatchEvent(new app.w.MouseEvent("click", { bubbles: true })); }
app.clock.tick(300);
state("after #tab-dict click");
try { console.log("UI.tab=" + C.UI.tab); } catch (e) {}
console.log("ready attr=" + doc.body.getAttribute("data-v60-ready"));
app.close();
