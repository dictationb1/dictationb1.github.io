var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("hide-anatomy-home",
  "    l.push('body.sdp-no-resume #homeResume{display:none!important}');",
  "    l.push('body.sdp-no-resume #homeResume{display:none!important}');\n    l.push('#screen-home .anatomy-stage{display:none!important}');",
  1);
p.rep("resume-inline-z",
  "        rsR.style.setProperty('opacity', '1', 'important');",
  "        rsR.style.setProperty('opacity', '1', 'important');\n        rsR.style.setProperty('position', 'relative', 'important');\n        rsR.style.setProperty('z-index', '6', 'important');",
  1);
p.save(260000);
console.log("ok");
