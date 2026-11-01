var e = require("./patchlib.cjs").open("tests/e2e.cjs", ["rec(", "async function"]);
e.rep("resume-debug2",
  "  console.error('[debug] resume', JSON.stringify({ resumeVisible, resumeText, snap: p2 }));",
  "  console.error('[debug] resume', JSON.stringify({ resumeVisible, resumeText, snap: p2, chain: await page.evaluate(() => { const r = document.getElementById('homeResume'); const out = []; let q = r; while (q && q !== document.body) { const cs = getComputedStyle(q); out.push((q.id || q.nodeName) + ':' + cs.display + ':' + cs.visibility + ':' + Math.round(q.getBoundingClientRect().height)); q = q.parentElement; } return out; }) }));",
  1);
e.save(60000);
console.log("ok");
