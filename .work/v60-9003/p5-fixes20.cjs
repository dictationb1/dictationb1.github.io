var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("resume-pointer",
  "position:relative!important;z-index:6!important}');",
  "position:relative!important;z-index:6!important;pointer-events:auto!important}');\n    l.push('#homeResume *{pointer-events:auto!important}');",
  1);
p.save(260000);
console.log("ok");
