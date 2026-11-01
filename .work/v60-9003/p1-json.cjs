/* P1 step 1 — version stamps in JSON metadata files (no root version.json exists). */
var fs = require("fs");

var OLD = "9.0.0.1", NEW = "9.0.0.3";
var files = ["data/version.json", "data/config.json", "data/session.json", "data/elevenlabs-audio.json", "data/media-manifest.json"];

function ensureStringField(obj, key, value) {
  obj[key] = value;
}

files.forEach(function (f) {
  var src = fs.readFileSync(f, "utf8");
  var before = src;
  src = src.split(OLD).join(NEW);
  var d = JSON.parse(src);
  ensureStringField(d, "appVersion", NEW);
  if (Object.prototype.hasOwnProperty.call(d, "version")) d.version = NEW;
  d.ver = 60;
  if (Object.prototype.hasOwnProperty.call(d, "schema")) d.schema = 60;
  if (Object.prototype.hasOwnProperty.call(d, "settingsRev")) d.settingsRev = 60;
  if (f === "data/elevenlabs-audio.json") {
    d.modelId = "eleven_flash_v2_5";
    if (!d.voiceId) d.voiceId = "Xb7hH8MSUJpSbSDYk0k2";
  }
  if (f === "data/config.json") {
    if (!d.defaults) throw new Error("config.json lost defaults");
    d.defaults.perf = "auto";
    d.defaults.wallpaperVideo = false;
  }
  var out = JSON.stringify(d, null, 2) + "\n";
  /* keep the original trailing-newline shape */
  if (before.slice(-1) !== "\n") out = JSON.stringify(d, null, 2);
  JSON.parse(out);
  fs.writeFileSync(f, out);
  console.log("stamped " + f + " (" + Buffer.byteLength(before) + " -> " + Buffer.byteLength(out) + ")");
});
