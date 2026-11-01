var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("stage-pe",
  "    l.push('#screen-home .anatomy-stage{display:none!important}');",
  "    l.push('body:not(.sdp-no-resume) #screen-home .anatomy-stage{pointer-events:none!important}');",
  1);
p.save(260000);
console.log("ok");
