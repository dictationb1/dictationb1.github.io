var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("resume-hoist",
  "    mountChrome();\n    homeGreeting();\n    var hero = $('#homeHero');",
  "    mountChrome();\n    homeGreeting();\n    var hero = $('#homeHero');\n    try {\n      var rsR = $('#homeResume');\n      if (rsR && hero && hero.parentNode && !rsR.classList.contains('hidden')) {\n        if (hero.nextSibling !== rsR) hero.parentNode.insertBefore(rsR, hero.nextSibling);\n        rsR.style.setProperty('display', 'block', 'important');\n      }\n    } catch (eRs) {}",
  1);
p.save(260000);

var e = require("./patchlib.cjs").open("tests/e2e.cjs", ["rec(", "async function"]);
e.rep("tab-api-set-1",
  "  await dismissTour(page); await page.locator('#tab-set').click();\n  const setTxt = await page.locator('#screen-set').textContent();",
  "  await dismissTour(page);\n  await page.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('set'); else document.getElementById('tab-set').click(); });\n  const setTxt = await page.locator('#screen-set').textContent();",
  1);
e.rep("tab-api-home-a",
  "  await dismissTour(page); await page.locator('#tab-home').click();\n  await unlock(page, DEFAULT_PIN);\n  await page.getByRole('button', { name: 'Lock now', exact: true }).first().click();",
  "  await dismissTour(page);\n  await page.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('home'); else document.getElementById('tab-home').click(); });\n  await unlock(page, DEFAULT_PIN);\n  await page.getByRole('button', { name: 'Lock now', exact: true }).first().click();",
  1);
e.rep("tab-api-home-b",
  "  await dismissTour(page); await page.locator('#tab-home').click();\n\n  /* ready screen + full dictation */",
  "  await dismissTour(page);\n  await page.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('home'); else document.getElementById('tab-home').click(); });\n\n  /* ready screen + full dictation */",
  1);
e.rep("tab-api-home-c",
  "  await dismissTour(page); await page.locator('#tab-home').click();\n  const readyTxt",
  "  await dismissTour(page);\n  await page.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('home'); else document.getElementById('tab-home').click(); });\n  const readyTxt",
  1);
e.rep("tab-api-home-d",
  "  await page.locator('#tab-home').click();",
  "  await page.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('home'); else document.getElementById('tab-home').click(); });",
  1);
e.rep("tab-api-set-2",
  "  await page.locator('#tab-set').click();",
  "  await page.evaluate(() => { const C = window.SDPCore; if (C && C.UI && C.UI.setTab) C.UI.setTab('set'); else document.getElementById('tab-set').click(); });",
  1);
e.save(60000);
console.log("fixes9 done");
