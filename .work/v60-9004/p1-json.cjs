/* P1: bump metadata JSON stamps to 9.0.0.4 (ver 60) without reformatting. */
var fs = require("fs");
var files = ["data/version.json", "data/config.json", "data/session.json", "data/elevenlabs-audio.json", "data/media-manifest.json"];
files.forEach(function (f) {
  var t = fs.readFileSync(f, "utf8");
  var n = t.split("9.0.0.3").length - 1;
  if (n !== 2) throw new Error("CONFIG FAIL [" + f + "]: expected 2 x 9.0.0.3, found " + n);
  var out = t.split("9.0.0.3").join("9.0.0.4");
  var o = JSON.parse(out);
  if (o.ver !== 60 || o.appVersion !== "9.0.0.4" || o.version !== "9.0.0.4" || o.schema !== 60 || o.settingsRev !== 60) {
    throw new Error("STAMP FAIL [" + f + "]");
  }
  fs.writeFileSync(f + ".tmp", out);
  fs.renameSync(f + ".tmp", f);
  console.log("ok   " + f + " 9.0.0.3 -> 9.0.0.4 x" + n);
});
console.log("p1-json done");
