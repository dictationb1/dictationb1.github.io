var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("resume-append-home",
  "        if (hero.nextSibling !== rsR) hero.parentNode.insertBefore(rsR, hero.nextSibling);",
  "        var hostS = $('#screen-home');\n        if (hostS && rsR.parentNode !== hostS) hostS.appendChild(rsR);",
  1);
p.save(260000);
console.log("ok");
