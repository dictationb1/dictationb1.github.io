var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("resume-first-child",
  "        if (hostS && rsR.parentNode !== hostS) hostS.appendChild(rsR);",
  "        if (hostS && rsR.parentNode !== hostS) hostS.insertBefore(rsR, hostS.firstChild);",
  1);
p.save(260000);
console.log("ok");
