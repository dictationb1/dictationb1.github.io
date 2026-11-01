/* Real-Chromium probe for the 8 video bugs. usage: node .work/v60-9004/probe.cjs */
var http = require("http");
var fs = require("fs");
var path = require("path");
var ROOT = path.resolve(__dirname, "../..");
var { chromium } = require(path.join(ROOT, "tests/node_modules/playwright-core"));
var serverChromium = require(path.join(ROOT, "tests/node_modules/@sparticuz/chromium"));
require(path.join(ROOT, "tests/chromium-env.cjs")).ensureChromiumLibs();

var TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".svg": "image/svg+xml" };

function serve() {
  return new Promise(function (res) {
    var srv = http.createServer(function (req, resp) {
      var p = decodeURIComponent(req.url.split("?")[0]);
      if (p === "/") p = "/index.html";
      var f = path.join(ROOT, p);
      if (f.indexOf(ROOT) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { resp.statusCode = 404; resp.end("nf"); return; }
      resp.setHeader("content-type", TYPES[path.extname(f)] || "application/octet-stream");
      resp.setHeader("cache-control", "no-store");
      fs.createReadStream(f).pipe(resp);
    });
    srv.listen(0, "127.0.0.1", function () { res(srv); });
  });
}

(async function main() {
  var srv = await serve();
  var port = srv.address().port;
  var browser = await chromium.launch({
    headless: true,
    executablePath: process.env.SDP_BROWSER_BIN || await serverChromium.executablePath(),
    args: serverChromium.args.filter(function (a) {
      return ["--single-process", "--disable-web-security", "--allow-running-insecure-content", "--disable-site-isolation-trials"].indexOf(a) < 0;
    })
  });
  var ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  var page = await ctx.newPage();
  page.on("pageerror", function (e) { console.log("PAGEERROR " + e.message); });
  await page.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  /* dismiss the one-time guide / any sheet so body.sheet-open stops hiding #app */
  for (var pass = 0; pass < 6; pass++) {
    var closed = await page.evaluate(function () {
      var n = 0;
      var btns = document.querySelectorAll("#sheets .shead button[aria-label=\"Close\"], #sheets .shead button");
      for (var i = 0; i < btns.length; i++) { try { btns[i].click(); n++; } catch (e) {} }
      if (window.SDPCore && SDPCore.UI && SDPCore.UI.closeSheets) { try { SDPCore.UI.closeSheets(); } catch (e) {} }
      return n;
    });
    await page.waitForTimeout(350);
    if (!closed) break;
  }
  await page.waitForTimeout(400);

  var out = {};
  out.bug1 = await page.evaluate(function () {
    var cloak = document.getElementById("sdpPrePaintCloak");
    var app = document.getElementById("app");
    return {
      ready: document.body.getAttribute("data-v60-ready"),
      cloakInHead: !!(cloak && cloak.parentNode === document.head),
      appOpacity: app ? getComputedStyle(app).opacity : "no-app",
      appVisible: app ? app.getBoundingClientRect().height > 0 : false
    };
  });

  out.bug2 = await page.evaluate(function () {
    var bar = document.querySelector(".topbar");
    var r = bar.getBoundingClientRect();
    var vis = [];
    for (var i = 0; i < bar.children.length; i++) {
      var c = bar.children[i];
      var cs = getComputedStyle(c);
      if (cs.display !== "none" && cs.visibility !== "hidden") vis.push(c.id || c.className);
    }
    return {
      width: Math.round(r.width), innerWidth: window.innerWidth, top: Math.round(r.top),
      position: getComputedStyle(bar).position, bg: getComputedStyle(bar).backgroundColor,
      children: bar.children.length, visible: vis,
      leaked: !!document.querySelector(".topbar #btnLock, .topbar #chipNet")
    };
  });

  out.bug3 = await page.evaluate(function () {
    var cd = document.getElementById("creditDocked");
    if (!cd) return "MISSING";
    var cs = getComputedStyle(cd);
    return { position: cs.position, parent: cd.parentNode.id || cd.parentNode.className, display: cs.display };
  });

  /* Bug 4: Words tab */
  await page.evaluate(function () { var t = document.getElementById("tab-dict"); if (t) t.click(); });
  await page.waitForTimeout(600);
  out.bug4 = await page.evaluate(function () {
    var sd = document.getElementById("screen-dict");
    var cards = document.querySelectorAll("#dictList .sdp-word-card");
    var vis = 0, tall = 0;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (r.height > 0 && getComputedStyle(cards[i]).display !== "none") vis++;
      if (r.height > 60) tall++;
    }
    var lr = document.getElementById("dictList") ? document.getElementById("dictList").getBoundingClientRect() : null;
    return {
      screenClass: sd ? sd.className : "MISSING",
      screenDisplay: sd ? getComputedStyle(sd).display : "-",
      cards: cards.length, visibleCards: vis, tallCards: tall,
      listHeight: lr ? Math.round(lr.height) : -1
    };
  });

  /* Bug 5/8: legacy home text + dictation cockpit */
  out.bug8 = await page.evaluate(function () {
    var bad = [];
    var all = document.querySelectorAll("#screen-home *, #screen-home");
    for (var i = 0; i < all.length; i++) {
      var n = all[i];
      if (n.children.length > 3) continue;
      var t = (n.textContent || "").replace(/^\s+/, "").slice(0, 34);
      if (/^(Session progress|Smart Dictation Player v58)/.test(t) && getComputedStyle(n).display !== "none") {
        bad.push((n.id || n.className || n.tagName) + " :: " + t);
      }
    }
    return bad.slice(0, 5);
  });

  out.bug6 = await page.evaluate(function () {
    var btn = document.getElementById("sdpTestVoice");
    return btn ? "present" : "missing";
  });

  /* open settings */
  await page.evaluate(function () {
    var t = document.getElementById("tab-set"); if (t) t.click();
  });
  await page.waitForTimeout(900);
  out.bug7 = await page.evaluate(function () {
    var host = document.getElementById("screen-set");
    var ng = document.getElementById("sdpNextGenSettings");
    var vis = [], acc = document.getElementById("sdpAppearanceAccordion");
    for (var i = 0; i < host.children.length; i++) {
      var c = host.children[i];
      vis.push({ id: c.id || c.className, display: getComputedStyle(c).display });
    }
    return {
      hasNextGen: !!ng, children: vis,
      accordion: acc ? "present open=" + acc.open + " parent=" + acc.parentNode.id : "missing",
      setBodyParent: document.getElementById("setBody") ? document.getElementById("setBody").parentNode.id || document.getElementById("setBody").parentNode.tagName : "missing"
    };
  });

  /* dictation cockpit */
  out.startProbe = await page.evaluate(async function () {
    var log = [];
    var b = document.getElementById("btnStart");
    log.push("btnStart=" + (b ? "present" : "missing"));
    if (b) b.click();
    await new Promise(function (r) { setTimeout(r, 1800); });
    log.push("layer=" + !!document.querySelector(".layer.player"));
    var sheet = document.querySelector("#sheets .sheet:not(.hidden)");
    log.push("sheetOpen=" + !!sheet);
    var ready = document.getElementById("readyNum");
    log.push("readyNum=" + (ready ? ready.textContent : "none"));
    var again = document.querySelector("#sheets .sheet:not(.hidden) .btn");
    if (sheet) { /* legacy Are-you-ready sheet: click the first primary action */
      var go = sheet.querySelector(".btn.pri, .btn.pri.block, .btn");
      if (go) { try { go.click(); log.push("clickedReady=" + go.textContent.slice(0, 20)); } catch (e) {} }
    }
    await new Promise(function (r) { setTimeout(r, 1800); });
    log.push("layer2=" + !!document.querySelector(".layer.player"));
    return log;
  });
  await page.waitForTimeout(1200);
  out.bug5 = await page.evaluate(function () {
    var layer = document.querySelector(".layer.player");
    var body = layer ? layer.querySelector(".lbody") : null;
    var card = document.getElementById("sdpCockpitCard");
    var grid = layer ? layer.querySelector(".ctrlgrid") : null;
    var foot = layer ? layer.querySelector(".lfoot") : null;
    var gr = grid ? grid.getBoundingClientRect() : null;
    var fr = foot ? foot.getBoundingClientRect() : null;
    var cr = card ? card.getBoundingClientRect() : null;
    return {
      err: window.__engErr || null,
      layerPresent: !!layer,
      lbodyScrollTop: body ? body.scrollTop : -1,
      lbodyScrollHeight: body ? body.scrollHeight : -1,
      cardTop: cr ? Math.round(cr.top) : -1,
      cardVisible: cr ? cr.height > 0 && cr.top < 844 : false,
      gridInViewport: gr ? (gr.top < 844 && gr.bottom > 0) : null,
      footInViewport: fr ? (fr.top < 844 && fr.bottom > 0) : null
    };
  });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  srv.close();
})().catch(function (e) { console.log("PROBE FAILED " + (e && e.stack)); process.exit(1); });
