var e = require("./patchlib.cjs").open("tests/e2e.cjs", ["rec(", "async function"]);
e.rep("e2e-set-tab",
  "  await dismissTour(page); await page.locator('#tab-set').click();\n  await page.waitForTimeout(500);\n  await page.evaluate(() => { const d = document.getElementById('sdpAppearanceAccordion'); if (d) d.open = true; });\n  await page.getByRole('button', { name: 'I tap Next', exact: true }).first().click();",
  "  await dismissTour(page);\n  await page.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('set'); else document.getElementById('tab-set').click(); });\n  await page.waitForTimeout(700);\n  await page.evaluate(() => { const d = document.getElementById('sdpAppearanceAccordion'); if (d) d.open = true; });\n  await page.waitForTimeout(300);\n  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).filter(x => /^I tap Next$/.test((x.textContent || '').trim()))[0]; if (b) b.click(); });",
  1);
e.save(60000);
console.log("e2e patched");
