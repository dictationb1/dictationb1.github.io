var b = require("./patchlib.cjs").open("tests/browser.cjs", ["results.push", "async function"]);
b.rep("oneclick-visible-check",
  "  if(await page.locator('#btnPreEditWarnContinue').count()){\n   await page.locator('#btnPreEditWarnContinue').click();\n   await page.waitForTimeout(300);\n   await page.locator('#btnAdminAutoComplete').click();\n  }",
  "  const warnVis=await page.evaluate(()=>{const n=document.getElementById('btnPreEditWarnContinue');return !!n&&n.offsetParent!==null;});\n  if(warnVis){\n   await page.evaluate(()=>{const n=document.getElementById('btnPreEditWarnContinue');if(n)n.click();});\n   await page.waitForTimeout(400);\n   await page.locator('#btnAdminAutoComplete').click();\n  }",
  1);
b.save(80000);
console.log("ok");
