var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("rail-zindex",
  "background:#0D0D10!important;border-right:1px solid rgba(255,255,255,0.08)!important;z-index:85!important;",
  "background:#0D0D10!important;border-right:1px solid rgba(255,255,255,0.08)!important;z-index:30!important;",
  1);
p.save(260000);

var e = require("./patchlib.cjs").open("tests/e2e.cjs", ["rec(", "async function"]);
e.rep("resume-debug",
  "  const resumeVisible = await page.locator('#homeResume').isVisible();\n  const resumeText = await page.locator('#resumeText').textContent();",
  "  const resumeVisible = await page.locator('#homeResume').isVisible();\n  const resumeText = await page.locator('#resumeText').textContent();\n  console.error('[debug] resume', JSON.stringify({ resumeVisible, resumeText, snap: p2 }));",
  1);
e.save(60000);
console.log("fixes10 done");
