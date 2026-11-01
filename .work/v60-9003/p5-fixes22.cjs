var fs = require("fs");
var f = "tests/e2e.cjs";
var t = fs.readFileSync(f, "utf8");
var re = /\n  console\.error\('\[debug\] resume'[\s\S]*?\n/;
var m = t.match(re);
if (m) { t = t.replace(m[0], "\n"); fs.writeFileSync(f, t); console.log("debug removed, size", t.length); }
else console.log("no debug line found");
