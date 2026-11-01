/* Why does audit-v42 stop seeing clips after the ready sheet was skipped? */
var http = require("http");
var fs = require("fs");
var path = require("path");
var ROOT = path.resolve(__dirname, "../..");
var { chromium } = require(path.join(ROOT, "tests/node_modules/playwright-core"));
var serverChromium = require(path.join(ROOT, "tests/node_modules/@sparticuz/chromium"));
require(path.join(ROOT, "tests/chromium-env.cjs")).ensureChromiumLibs();

var srv = http.createServer(function (req, resp) {
  var p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  var f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { resp.statusCode = 404; resp.end("nf"); return; }
  resp.setHeader("content-type", /\.js$/.test(f) ? "text/javascript" : /\.json$/.test(f) ? "application/json" : "text/html");
  resp.setHeader("cache-control", "no-store");
  fs.createReadStream(f).pipe(resp);
});

(async function () {
  await new Promise(function (r) { srv.listen(0, "127.0.0.1", r); });
  var port = srv.address().port;
  var browser = await chromium.launch({
    headless: true,
    executablePath: process.env.SDP_BROWSER_BIN || await serverChromium.executablePath(),
    args: serverChromium.args.filter(function (a) { return ["--single-process", "--disable-web-security", "--allow-running-insecure-content", "--disable-site-isolation-trials"].indexOf(a) < 0; })
  });
  var ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  var page = await ctx.newPage();
  /* mirror audit-v42: block the network but keep the page */
  await page.route("https://**/*", function (route) { return route.abort(); });
  await page.addInitScript(function () {
    window.__clips = [];
    Object.defineProperty(window, "__hookClips", { value: true });
  });
  await page.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  console.log("clipHook=" + await page.evaluate(function () { return !!window.__clips; }));
  await page.evaluate(function () {
    var g = document.querySelector("#guideSheet .shead button");
    if (g) g.click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(function () { document.getElementById("btnStart").click(); });
  for (var i = 0; i < 8; i++) {
    await page.waitForTimeout(700);
    var s = await page.evaluate(function () {
      var C = window.SDPCore || {};
      return {
        st: C.Eng && C.Eng.st, idx: C.Eng && C.Eng.idx,
        clips: (window.__clips || []).length,
        last: (window.__clips || []).slice(-3).map(function (c) { return String(c.url).slice(0, 80); }),
        layer: !!document.querySelector("#layers .layer"),
        sheet: !!document.querySelector("#sheets .sheet:not(.hidden)"),
        status: (document.getElementById("plStatus") || {}).textContent
      };
    });
    console.log("t" + i + " " + JSON.stringify(s).slice(0, 320));
  }
  await browser.close();
  srv.close();
})().catch(function (e) { console.log("FAILED " + e.stack); process.exit(1); });
