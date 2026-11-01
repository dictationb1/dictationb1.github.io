/* P3 — append the v60 Next-Gen chrome + home module to data/learning-tools.js */
var fs = require("fs");
var MOD = fs.readFileSync(".work/v60-9003/v60-p3-home.js", "utf8");
var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion"]);
p.regex("append-v60-module", /()$/, function () { return "\n" + MOD; }, 1);
p.save(240000);
