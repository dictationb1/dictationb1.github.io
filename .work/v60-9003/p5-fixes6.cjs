var b = require("./patchlib.cjs").open("tests/browser.cjs", ["results.push", "async function"]);
b.rep("oneclick-refill",
  "  await page.waitForTimeout(1200);\n  await page.evaluate(()=>{const g=document.getElementById('btnAdminAutoComplete');if(g)g.click();});",
  "  await page.waitForTimeout(1200);\n  await page.locator('#adminQuickWordsInput').fill('zephyr, afraid');\n  await page.locator('#profSessionTitle').fill('Session 9 - Weather');\n  await page.evaluate(()=>{const g=document.getElementById('btnAdminAutoComplete');if(g)g.click();});",
  1);
b.save(80000);
console.log("fixes6 done");
