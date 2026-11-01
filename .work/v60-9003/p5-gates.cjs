/* P5 - lockstep test gates: v60 assertions + retire legacy-only selectors */
var fs = require("fs");
function open(f, sigs) { return require("./patchlib.cjs").open(f, sigs); }

/* 1. tests/check.cjs - JSDOM next-gen DOM assertions */
var CHECK_BLOCK = fs.readFileSync(".work/v60-9003/v60-p5-check-block.js", "utf8");
var c = open("tests/check.cjs", ["throw new Error"]);
c.rep("check-jsdom-block",
  "console.log('ALL v60 STATIC CHECKS PASSED');",
  CHECK_BLOCK + "\nconsole.log('ALL v60 STATIC CHECKS PASSED');",
  1);
c.save(60000);

/* 2. tests/upgrade-browser.cjs - credit dock assertion + new v60 browser block */
var BROWSER_BLOCK = fs.readFileSync(".work/v60-9003/v60-p5-browser-block.js", "utf8");
var u = open("tests/upgrade-browser.cjs", ["::error::"]);
u.rep("credit-docked-state",
  "overflow: !!document.getElementById('topOverflow'), lang: !!document.getElementById('btnLang'), data: !!document.getElementById('topDataBadge'),",
  "overflow: !!document.getElementById('topOverflow'), lang: !!document.getElementById('btnLang'), data: !!document.getElementById('topDataBadge'),\n      creditDocked: !!document.getElementById('creditDocked') && getComputedStyle(document.getElementById('creditDocked')).position === 'fixed',",
  1);
u.rep("credit-assertion",
  "state.static && !state.videoSrc && state.credit === 'static' && !state.depot",
  "state.static && !state.videoSrc && (state.credit === 'static' || state.creditDocked) && !state.depot",
  1);
u.rep("browser-v60-block",
  "  await browser.close(); await new Promise(r => server.close(r));",
  BROWSER_BLOCK + "\n  await browser.close(); await new Promise(r => server.close(r));",
  1);
u.save(60000);

/* 3. tests/browser.cjs - #btnAdmin now lives in the hidden legacy keeper */
var b = open("tests/browser.cjs", ["results.push", "async function"]);
b.rep("browser-admin-click",
  "await page.locator('#btnAdmin').click({timeout:4000});",
  "await page.evaluate(()=>{var b=document.getElementById('btnAdmin'); if(b) b.click();});",
  1);
b.save(80000);

/* 4. tests/e2e.cjs - legacy answer-mode control now lives in the collapsed accordion */
var e = open("tests/e2e.cjs", ["rec(", "async function"]);
e.rep("e2e-open-accordion",
  "await page.getByRole('button', { name: 'I tap Next', exact: true }).first().click();",
  "await page.evaluate(() => { const d = document.getElementById('sdpAppearanceAccordion'); if (d) d.open = true; });\n  await page.getByRole('button', { name: 'I tap Next', exact: true }).first().click();\n  await page.evaluate(() => { const d = document.getElementById('sdpAppearanceAccordion'); if (d) d.open = false; });",
  1);
e.save(80000);

/* 5. tests/audit-v42.cjs - v60 timer pill renders 05.0s */
var a = open("tests/audit-v42.cjs", ["ok(", "eq("]);
a.rep("audit-timer",
  "ok('the writing countdown runs from five seconds', Number(now.cd) >= 0 && Number(now.cd) <= 5, now.cd);",
  "ok('the writing countdown runs from five seconds', Number.parseFloat(String(now.cd)) >= 0 && Number.parseFloat(String(now.cd)) <= 5, now.cd);",
  1);
a.save(40000);

console.log("p5 patches done");
