/* P4 - insert the cockpit / settings / words / i18n block inside the v60 module */
var fs = require("fs");
var P4 = fs.readFileSync(".work/v60-9003/v60-p4-screens.js", "utf8");
var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion"]);

var tail = "  W.setTimeout(function () { try { wrapTabset(); wrapHome(); wrapPaint(); } catch (e) {} }, 1200);\n})();";
p.rep("insert-p4-block",
  tail,
  "  W.setTimeout(function () { try { wrapTabset(); wrapHome(); wrapPaint(); } catch (e) {} }, 1200);\n\n" + P4 +
  "\n  W.setTimeout(function () { try { wrapSettings(); wrapDict(); wrapCockpit(); } catch (e) {} }, 1300);\n})();",
  1);

p.rep("boot-wraps",
  "    W.setTimeout(showLoadToast, 700);",
  "    try { wrapSettings(); wrapDict(); wrapCockpit(); } catch (e) {}\n    W.setTimeout(showLoadToast, 700);",
  1);

p.save(260000);
