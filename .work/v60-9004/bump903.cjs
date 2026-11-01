/* P1: version 9.0.0.4 stamps for shipped non-HTML scripts. */
var p = require("./patchlib.cjs");
var f = process.argv[2];
var expect = +process.argv[3];
var o = p.open(f, []);
o.rep("stamps " + f, "9.0.0.3", "9.0.0.4", expect);
o.save(900000);
