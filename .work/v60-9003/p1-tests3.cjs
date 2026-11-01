function open(f, sigs) { return require("./patchlib.cjs").open(f, sigs); }
var a = open("tests/phase1.cjs", ["assert", "test("]);
a.rep("p1-app-version", 'APP_VERSION="9.0.0.1"', 'APP_VERSION="9.0.0.3"', 1);
a.save(80000);

var b = open("tests/audit-v42.cjs", ["ok(", "eq("]);
b.rep("audit-version", "voice.version, '9.0.0.1'", "voice.version, '9.0.0.3'", 1);
b.save(40000);

var c = open("tests/live-lab.cjs", ["throw Error", "require("]);
c.rep("live-version", "vault.version !== '9.0.0.1'", "vault.version !== '9.0.0.3'", 1);
c.save(40000);

var d = open("data/learning-tools.js", ["window.SDPVersion", "function"]);
d.rep("lt-version", "current: '9.0.0.1',", "current: '9.0.0.3',", 1);
d.save(220000);
console.log("done");
