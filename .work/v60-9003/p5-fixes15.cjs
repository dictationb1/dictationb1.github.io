var e = require("./patchlib.cjs").open("tests/e2e.cjs", ["rec(", "async function"]);
e.rep("stage-debug",
  "return out; }) }));",
  "return out.concat(['STAGE:' + (function(){ const s = document.querySelector('.anatomy-stage'); const out2 = []; if (!s) return 'none'; let q = s; while (q && q !== document.body) { const cs = getComputedStyle(q); out2.push((q.id || q.nodeName + '.' + String(q.className).slice(0,18)) + ':' + cs.position + ':' + cs.zIndex + ':' + cs.display); q = q.parentElement; } return out2.join(' > '); })()]); }) }));",
  1);
e.save(60000);
console.log("ok");
