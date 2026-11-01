/* Which CSS rules actually win on #app / .topbar / its children / #creditDocked? */
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
  var page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  var res = await page.evaluate(function () {
    var targets = { app: "#app", topbar: ".topbar", cluster: "#sdpBrandCluster", actions: "#sdpTopActions", credit: "#creditDocked" };
    var out = {};
    var sheets = [];
    for (var i = 0; i < document.styleSheets.length; i++) sheets.push(document.styleSheets[i]);
    function walk(rules, sheetName, hits, els) {
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        if (r.cssRules && !r.selectorText) { walk(r.cssRules, sheetName, hits, els); continue; }
        if (!r.selectorText) continue;
        var decl = r.style;
        var props = [];
        ["opacity", "display", "visibility", "background", "background-color", "position", "width", "color", "transform", "pointer-events"].forEach(function (p) {
          var v = decl.getPropertyValue(p);
          if (v) props.push(p + ":" + v + (decl.getPropertyPriority(p) ? "!" : ""));
        });
        if (!props.length) continue;
        Object.keys(els).forEach(function (k) {
          var el = els[k];
          if (!el) return;
          var sel = r.selectorText;
          var parts = sel.split(",");
          for (var s = 0; s < parts.length; s++) {
            try { if (el.matches(parts[s].trim())) { hits[k].push(sheetName + " {" + parts[s].trim() + "} " + props.join(" ")); break; } } catch (e) {}
          }
        });
      }
    }
    var els = {};
    Object.keys(targets).forEach(function (k) { els[k] = document.querySelector(targets[k]); });
    var hits = {}; Object.keys(targets).forEach(function (k) { hits[k] = []; });
    for (var i = 0; i < sheets.length; i++) {
      var sh = sheets[i];
      var name = (sh.ownerNode && sh.ownerNode.id) || ("sheet" + i);
      var rules = null;
      try { rules = sh.cssRules; } catch (e) { continue; }
      if (rules) walk(rules, name, hits, els);
    }
    Object.keys(hits).forEach(function (k) { out[k] = hits[k].slice(-8); });
    var bar = document.querySelector(".topbar");
    out.topbarKids = [];
    for (var c = 0; c < bar.children.length; c++) {
      var cs = getComputedStyle(bar.children[c]);
      out.topbarKids.push({ id: bar.children[c].id, display: cs.display, vis: cs.visibility, opacity: cs.opacity, cls: bar.children[c].className });
    }
    return out;
  });
  console.log(JSON.stringify(res, null, 1).slice(0, 6000));
  await browser.close();
  srv.close();
})().catch(function (e) { console.log("FAILED " + e.stack); process.exit(1); });
