var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("kicker-order",
  "txt($('#homeKicker', hero), '\\u25CF SESSION ' + sessNo + (sessDate ? ' \\u00B7 ' + sessDate : '') + ' \\u00B7 ' + sessBranch.toUpperCase());",
  "txt($('#homeKicker', hero), 'SESSION ' + sessNo + (sessDate ? ' \\u00B7 ' + sessDate : '') + ' \\u25CF ' + sessBranch.toUpperCase());",
  1);
p.rep("kicker-i18n",
  "kicker: ['\\u25CF SESSION 8 \\u00B7 29 OCT 2026', '\\u25CF \\u0DC3\\u0DD0\\u0DC3\\u0DD2\\u0DBA 8 \\u00B7 29 \\u0D94\\u0D9A\\u0DCA\\u0DAD\\u0DD6 2026'],",
  "kicker: ['SESSION 8 \\u00B7 29/10/2026', '\\u0DC3\\u0DD0\\u0DC3\\u0DD2\\u0DBA 8 \\u00B7 29/10/2026'],",
  1);
p.save(260000);

var e = require("./patchlib.cjs").open("tests/e2e.cjs", ["rec(", "async function"]);
/* comm screen left the v60 tabbar but the screen itself stays reachable through the UI API */
e.rep("tab-comm-1",
  "  await dismissTour(page); await page.locator('#tab-comm').click();",
  "  await dismissTour(page);\n  await page.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('comm'); else document.getElementById('tab-comm').click(); });",
  1);
e.rep("tab-comm-2",
  "  await page.locator('#tab-comm').click();\n  await page.locator('#btnMsg').click();",
  "  await page.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('comm'); else document.getElementById('tab-comm').click(); });\n  await page.locator('#btnMsg').click();",
  1);
e.rep("tab-comm-3",
  "    await p.locator('#tab-comm').click();\n    await p.locator('#btnCompose').click();",
  "    await p.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('comm'); else document.getElementById('tab-comm').click(); });\n    await p.locator('#btnCompose').click();",
  1);
e.save(60000);
console.log("fixes8 done");
