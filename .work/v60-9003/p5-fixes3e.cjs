var b = require("./patchlib.cjs").open("tests/browser.cjs", ["results.push", "async function"]);
b.rep("warn-guard",
  "  if(await page.locator('#btnPreEditWarnContinue').count()){",
  "  if(await page.locator('#btnPreEditWarnContinue').count()&&await page.locator('#btnPreEditWarnContinue').isVisible().catch(()=>false)){", 1);
b.rep("warn-click",
  "   await page.locator('#btnPreEditWarnContinue').click();",
  "   await page.evaluate(()=>{const n=document.getElementById('btnPreEditWarnContinue');if(n)n.click();});", 1);
b.save(80000);
console.log("ok");
