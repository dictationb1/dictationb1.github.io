var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "window.SDP_applyLang"]);

p.rep("boot-schedule",
  "  if (D.readyState === 'loading') on(D, 'DOMContentLoaded', function () { W.setTimeout(boot, 40); });\n  else W.setTimeout(boot, 40);",
  "  function kick() { W.setTimeout(boot, 30); }\n  if (D.readyState === 'loading') on(D, 'DOMContentLoaded', kick);\n  kick();",
  1);

p.rep("boot-retry-guard",
  "    if (!D.body) { W.setTimeout(boot, 60); return; }",
  "    if (!D.body) { V.retries = (V.retries || 0) + 1; if (V.retries < 200) W.setTimeout(boot, 60); return; }",
  1);

p.save(240000);
