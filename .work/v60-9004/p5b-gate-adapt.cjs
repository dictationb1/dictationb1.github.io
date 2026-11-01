/* ============================================================================
 * P5b — adapt the three gates whose assertions encode the OLD buggy contract:
 *   G5 browser.cjs  : #creditDocked used to be position:fixed (Bug 3 says static)
 *   G7 e2e.cjs      : the "Are you ready?" sheet is gone (Bug 5)
 *   G9 audit-v42.cjs: clickReady() must tolerate the skipped ready sheet
 * ========================================================================== */
var p = require("./patchlib.cjs");

/* ------------------------------------------------------------------ G5 ---- */
var B = p.open("tests/browser.cjs", ["results.push", "async(", "page.evaluate"]);
B.rep(
  "creditDocked is static now",
  "    !!(v37.segThumb&&v37.segThumb.pos==='fixed')&&",
  "    !!(v37.segThumb&&v37.segThumb.pos==='static')&&",
  1
);
B.save(120000);

/* ------------------------------------------------------------------ G7 ---- */
var E = p.open("tests/e2e.cjs", ["function ", "rec(", "page.evaluate"]);
E.rep(
  "e2e: Start dictation opens the cockpit",
  "  /* ready screen + full dictation */\n" +
    "  await page.locator('#btnStart').click();\n" +
    "  const readyTxt = await page.locator('#sheets').textContent();\n" +
    "  rec(label + ' \"Are you ready?\" screen without a skip control',\n" +
    "    /Are you ready/.test(readyTxt) && /pen and paper/i.test(readyTxt) &&\n" +
    "    await page.getByRole('button', { name: 'Skip countdown', exact: true }).count() === 0 && await page.locator('#layers .layer').count() === 0);\n" +
    "  await page.getByRole('button', { name: \"I'm ready\", exact: true }).click();\n" +
    "  await page.waitForSelector('#layers button', { state: 'visible' });",
  "  /* v60.4 / Bug 5: Start dictation opens the Cockpit directly - the legacy\n" +
    "     \"Are you ready?\" bottom sheet is bypassed (no skip control either). */\n" +
    "  await page.locator('#btnStart').click();\n" +
    "  await page.waitForSelector('#layers .layer', { state: 'visible', timeout: 15000 });\n" +
    "  await page.waitForTimeout(600);\n" +
    "  const readyVisible = await page.getByRole('button', { name: \"I'm ready\", exact: true }).isVisible().catch(() => false);\n" +
    "  rec(label + ' Start dictation opens the Cockpit directly without a ready sheet',\n" +
    "    !readyVisible && await page.locator('#sdpCockpitCard').count() > 0 &&\n" +
    "    await page.getByRole('button', { name: 'Skip countdown', exact: true }).count() === 0);\n" +
    "  await page.waitForSelector('#layers button', { state: 'visible' });",
  1
);
E.save(120000);

/* ------------------------------------------------------------------ G9 ---- */
var A = p.open("tests/audit-v42.cjs", ["require(", "await page.", "const "]);
A.regex(
  "audit: clickReady tolerates the skipped sheet",
  /(\/I\['[^'\]]*'\]m ready\/\.test\(x\.textContent\)\), null, \{ timeout: )20000( \}\);)/g,
  function (m, pre, post) { return pre + "4000" + " }).catch(() => {});"; },
  1
);
A.save(120000);
console.log("p5b-gate-adapt done");
