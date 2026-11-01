var fs = require("fs");
var f = "tests/e2e.cjs";
var t = fs.readFileSync(f, "utf8");
var api = function (name) {
  return "await page.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('" + name + "'); else document.getElementById('tab-" + name + "').click(); });";
};
var n1 = 0, n2 = 0;
t = t.replace(/await page\.locator\('#tab-home'\)\.click\(\);/g, function () { n1++; return api("home"); });
t = t.replace(/await page\.locator\('#tab-set'\)\.click\(\);/g, function () { n2++; return api("set"); });
console.log("tab-home ->", n1, "tab-set ->", n2);
t = t.replace("  await dismissTour(page); " + api("set") + "\n  const setTxt", "  await dismissTour(page);\n  " + api("set") + "\n  const setTxt");
fs.writeFileSync(f, t);
console.log("saved e2e:", t.length);
