var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("resume-css",
  "    l.push('#sdpDesktopRail{display:none}');",
  "    l.push('#sdpDesktopRail{display:none}');\n    l.push('#homeResume{display:block!important;visibility:visible!important;height:auto!important;max-height:none!important;opacity:1!important}');\n    l.push('body.sdp-no-resume #homeResume{display:none!important}');",
  1);
p.rep("resume-flag",
  "    try {\n      var rsR = $('#homeResume');",
  "    try {\n      var hasSnap = false;\n      try { var dbS = DB(); var sn = dbS && dbS.data && dbS.data.snapshot; hasSnap = !!(sn && sn.words && sn.words.length); } catch (eSn) {}\n      D.body.classList[hasSnap ? 'remove' : 'add']('sdp-no-resume');\n      var rsR = $('#homeResume');",
  1);
p.save(260000);
console.log("fixes11 done");
