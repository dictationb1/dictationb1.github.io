/* P1: index.html version bump + #sdpPrePaintCloak (Bug 1 zero-FOUC), data.html bump. */
var fs = require("fs");
var p = require("./patchlib.cjs");

/* ---------- index.html ---------- */
/* signature tokens must be invariant: a new <style> node is intentionally added. */
var h = p.open("index.html", ["</html>", "<body", "<script"]);
h.rep("index version stamps", "9.0.0.3", "9.0.0.4", 6);
h.rep(
  "pre-paint cloak after sdpSwBoot",
  "catch(e){}})();</script><meta name=\"viewport\"",
  "catch(e){}})();setTimeout(function(){try{if(document.body)document.body.setAttribute(\"data-v60-ready\",\"1\");}catch(e9){}},900);</script>" +
    "<style id=\"sdpPrePaintCloak\">" +
    "html,body{background:#09090B!important;color:#FAFAFA!important}" +
    "body:not([data-v60-ready=\"1\"]) #app,body:not([data-v60-ready=\"1\"]) .topbar,body:not([data-v60-ready=\"1\"]) #tabbar{opacity:0!important;pointer-events:none!important}" +
    "</style>" +
    "<meta name=\"viewport\"",
  1
);
h.save(598000);

/* ---------- data.html ---------- */
var d = p.open("data.html", ["</html>", "<body", "<script"]);
d.rep("data.html version", "9.0.0.3", "9.0.0.4", 1);
d.save(60000);

/* ---------- data/index.html must be byte-identical ---------- */
fs.copyFileSync("data.html", "data/index.html");
console.log("copied data.html -> data/index.html");
console.log("p1-html done");
