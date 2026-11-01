function open(f, sigs) { return require("./patchlib.cjs").open(f, sigs); }
function fix(f, sigs) {
  var p = open(f, sigs);
  try { p.regex("plain", /0\.0\.1/g, function () { return "0.0.3"; }); } catch (e) { console.log("no plain left in " + f); }
  p.regex("escaped", /\\\.0\\\.0\.1/g, function () { return "\\.0\\.0.3"; }, 1);
  p.save(80000);
}
fix("tests/check.cjs", ["throw new Error", "console.log"]);
fix("tests/upgrade.test.cjs", ["assert", "require("]);
fix("tests/server.cjs", ["assert", "require("]);
console.log("done");
