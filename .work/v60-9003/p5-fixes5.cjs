var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("wordcard-pos-slot",
  "    if (w.pos) head.appendChild(mk('span', 'v59-pos', null, String(w.pos)));",
  "    head.appendChild(mk('span', 'v59-pos', null, String(w.pos || w.t || '')));",
  1);
p.save(260000);

var b = require("./patchlib.cjs").open("tests/browser.cjs", ["results.push", "async function"]);
b.rep("oneclick-second-pass",
  "  await page.waitForFunction(()=>/words saved/.test((document.querySelector('#adminQuickStatus')||{}).textContent||''),{timeout:30000}).catch(()=>{});\n  const quick=await page.evaluate(()=>{",
  "  await page.waitForTimeout(1200);\n  await page.evaluate(()=>{const g=document.getElementById('btnAdminAutoComplete');if(g)g.click();});\n  await page.waitForFunction(()=>/words saved/.test((document.querySelector('#adminQuickStatus')||{}).textContent||''),{timeout:30000}).catch(()=>{});\n  const quick=await page.evaluate(()=>{",
  1);
b.save(80000);
console.log("fixes5 done");
