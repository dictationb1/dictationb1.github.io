/* P1 step 4 — version assertions in the no-browser test suites + data-meter stamp */
function open(f, sigs) { return require("./patchlib.cjs").open(f, sigs); }

function bump0(p, label) { p.regex(label, /0\.0\.1/g, function () { return "0.0.3"; }, 1); }

var c = open("tests/check.cjs", ["throw new Error", "console.log"]);
bump0(c, "check-version");
c.rep("check-sw", "var VERSION = 'sdp-v60'/", "var VERSION = 'sdp-v60-9\\.0\\.0\\.3'/", 1);
c.save(40000);

var u = open("tests/upgrade.test.cjs", ["assert", "require("]);
bump0(u, "upgrade-version");
u.rep("upgrade-sw", "VERSION = 'sdp-v60'", "VERSION = 'sdp-v60-9.0.0.3'", 1);
u.save(80000);

var s = open("tests/server.cjs", ["assert", "require("]);
bump0(s, "server-version");
s.rep("server-studio", "data/studio.js?v=60", "data/studio.js?v=9.0.0.3", 1);
s.save(40000);

var m = open("data/data-meter.js", ["METER_VERSION"]);
m.rep("meter-version", "METER_VERSION = '9.0.0.1'", "METER_VERSION = '9.0.0.3'", 1);
m.save(40000);

console.log("done");
