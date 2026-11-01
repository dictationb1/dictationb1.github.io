/* Inspect v60 DOM structure that the video bugs complain about. */
var fs = require("fs");
var path = require("path");
var ROOT = path.resolve(__dirname, "../..");
process.chdir(ROOT);
var harness = require(path.join(ROOT, "tests/app-harness.cjs")).harness;
var learn = fs.readFileSync(path.join(ROOT, "data/learning-tools.js"), "utf8");

var app = harness(null, {});
app.w.eval(learn);
app.clock.tick(2500);
var doc = app.w.document;

function desc(n) {
  var id = n.id ? "#" + n.id : "";
  var cl = n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\s+/).join(".") : "";
  var txt = (n.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
  var st = app.w.getComputedStyle(n);
  return (n.tagName.toLowerCase() + id + cl + " [" + st.display + "/" + st.position + "] " + JSON.stringify(txt));
}
function dump(sel, label) {
  var host = doc.querySelector(sel);
  console.log("\n== " + label + " (" + sel + ") " + (host ? "children=" + host.children.length : "MISSING"));
  if (!host) return;
  Array.prototype.forEach.call(host.children, function (c, i) { console.log("   " + i + ": " + desc(c)); });
}
dump(".topbar", "topbar");
dump("#screen-home", "screen-home");
dump("#screen-set", "screen-set");
dump("#screen-dict", "screen-dict");
console.log("\n== ids present ==");
["sdpLegacyKeeper", "sdpBrandCluster", "sdpTopActions", "creditDocked", "sdpNextGenSettings", "setBody", "sdpAppearanceAccordion", "staticFooter", "sdpTestVoice", "dictList"].forEach(function (id) {
  var n = doc.getElementById(id);
  console.log("  " + id + ": " + (n ? "yes parent=" + (n.parentNode ? (n.parentNode.id || n.parentNode.className || n.parentNode.tagName) : "-") : "NO"));
  if (n && id === "screen-set") {}
});
var st = doc.getElementById("screen-set");
if (st) {
  console.log("\n== screen-set children ==");
  Array.prototype.forEach.call(st.children, function (c) { console.log("   " + desc(c)); });
}
var dl = doc.getElementById("dictList");
if (dl) console.log("\ndictList children=" + dl.children.length + " text=" + JSON.stringify((dl.textContent || "").trim().slice(0, 60)));
console.log("\nconsoleErrors=" + JSON.stringify(app.consoleErrors.slice(0, 3)));
app.close();
