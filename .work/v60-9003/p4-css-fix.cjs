var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion"]);
p.rep("lens-scope",
  "l.push('.layer.player .lens{display:none!important;visibility:hidden!important;pointer-events:none!important}');",
  "l.push('.layer .lens,.layer.player .lens{display:none!important;visibility:hidden!important;pointer-events:none!important}');",
  1);
p.save(260000);
