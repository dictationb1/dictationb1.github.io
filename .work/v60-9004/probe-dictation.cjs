/* P4 probe: what happens when the student taps Start dictation? */
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
  page.on("pageerror", function (e) { console.log("PAGEERROR " + e.message.slice(0, 200)); });
  await page.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  async function closeAll() {
    return page.evaluate(function () {
      var n = 0;
      var btns = document.querySelectorAll("#sheets .shead button");
      for (var i = 0; i < btns.length; i++) { try { btns[i].click(); n++; } catch (e) {} }
      var s = document.querySelectorAll("#sheets .sheet");
      for (var j = 0; j < s.length; j++) { try { s[j].classList.add("hidden"); } catch (e) {} }
      var sc = document.querySelectorAll(".scrim");
      for (var k = 0; k < sc.length; k++) { try { sc[k].classList.add("hidden"); } catch (e) {} }
      try { document.body.classList.remove("sheet-open"); } catch (e) {}
      return n;
    });
  }
  await closeAll();
  await page.waitForTimeout(400);

  console.log("STEP1 ready=" + await page.evaluate(function () { return document.body.getAttribute("data-v60-ready") + " appOpacity=" + getComputedStyle(document.getElementById("app")).opacity; }));

  await page.evaluate(function () { var b = document.getElementById("btnStart"); if (b) b.click(); });
  await page.waitForTimeout(2500);
  var snap1 = await page.evaluate(function () {
    var sheets = document.querySelectorAll("#sheets .sheet");
    var info = [];
    for (var i = 0; i < sheets.length; i++) {
      info.push({ cls: sheets[i].className, hidden: sheets[i].classList.contains("hidden"), text: (sheets[i].textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) });
    }
    var layers = document.querySelectorAll(".layer");
    var linfo = [];
    for (var j = 0; j < layers.length; j++) linfo.push({ cls: layers[j].className, display: getComputedStyle(layers[j]).display, kids: layers[j].children.length });
    return {
      sheetOpen: document.body.classList.contains("sheet-open"), sheets: info, layers: linfo,
      readyNum: (document.getElementById("readyNum") || {}).textContent, eng: (function () { try { return { st: window.SDPCore.Eng.st, layer: !!(window.SDPCore.Eng.layer) }; } catch (e) { return e.message; } })()
    };
  });
  console.log("STEP2 " + JSON.stringify(snap1).slice(0, 1200));

  /* nothing to click: the cockpit must already be live (Bug 5 fix) */
  await page.waitForTimeout(1500);
  var snap2 = await page.evaluate(function () {
    var layer = document.querySelector(".layer");
    var card = document.getElementById("sdpCockpitCard");
    var body = layer ? layer.querySelector(".lbody") : null;
    var grid = layer ? layer.querySelector(".ctrlgrid") : null;
    return {
      layer: !!layer,
      layerCls: layer ? layer.className : null,
      card: !!card,
      cardTop: card ? Math.round(card.getBoundingClientRect().top) : -1,
      lbodyScrollTop: body ? body.scrollTop : -1,
      gridTop: grid ? Math.round(grid.getBoundingClientRect().top) : -1,
      gridH: grid ? Math.round(grid.getBoundingClientRect().height) : -1,
      chain: card ? (function () { var out = [], n = card; while (n && n !== document.body) { var r = n.getBoundingClientRect(); var cs = getComputedStyle(n); out.push((n.id || n.className || n.tagName) + " top=" + Math.round(r.top) + " h=" + Math.round(r.height) + " pad=" + cs.paddingTop + " disp=" + cs.display + " just=" + cs.justifyContent); n = n.parentNode; } return out; })() : [],
      wordCardKids: card ? Array.prototype.map.call(card.children, function (c) { return (c.id || c.className) + "[" + getComputedStyle(c).display + "]"; }) : [],
      st: (function () { try { return window.SDPCore.Eng.st; } catch (e) { return "err"; } })()
    };
  });
  console.log("STEP3 " + JSON.stringify(snap2).slice(0, 2000));

  await page.waitForTimeout(2500);
  var snap3 = await page.evaluate(function () {
    var layer = document.querySelector(".layer");
    var body = layer ? layer.querySelector(".lbody") : null;
    var card = document.getElementById("sdpCockpitCard");
    return {
      scrollTop: body ? body.scrollTop : -1, scrollHeight: body ? body.scrollHeight : -1,
      cardTop: card ? Math.round(card.getBoundingClientRect().top) : -1,
      st: (function () { try { return window.SDPCore.Eng.st; } catch (e) { return "err"; } })()
    };
  });
  console.log("STEP4 " + JSON.stringify(snap3));
  await browser.close();
  srv.close();
})().catch(function (e) { console.log("FAILED " + e.stack); process.exit(1); });
