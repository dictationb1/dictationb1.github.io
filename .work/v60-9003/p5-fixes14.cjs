var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("resume-stack",
  "    l.push('#homeResume{display:block!important;visibility:visible!important;height:auto!important;max-height:none!important;opacity:1!important}');",
  "    l.push('#homeResume{display:block!important;visibility:visible!important;height:auto!important;max-height:none!important;opacity:1!important;position:relative!important;z-index:6!important}');",
  1);
p.save(260000);
console.log("ok");
