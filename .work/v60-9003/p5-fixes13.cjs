var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("resume-inline-visible",
  "        rsR.style.setProperty('display', 'block', 'important');",
  "        rsR.style.setProperty('display', 'block', 'important');\n        rsR.style.setProperty('visibility', 'visible', 'important');\n        rsR.style.setProperty('opacity', '1', 'important');\n        rsR.removeAttribute('aria-hidden');\n        try { var ancs = rsR.parentNode; while (ancs && ancs !== D.body) { var stc = ancs.getAttribute && ancs.getAttribute('style'); if (stc && /visibility:\\s*hidden/.test(stc)) ancs.style.setProperty('visibility', 'visible', 'important'); ancs = ancs.parentNode; } } catch (eAnc) {}",
  1);
p.save(260000);
console.log("ok");
