var fs = require("fs");
var file = process.argv[2], needle = process.argv[3];
var radius = +process.argv[4] || 140, maxHits = +process.argv[5] || 5;
var s = fs.readFileSync(file, "utf8"), i = -1, shown = 0;
while (shown < maxHits && (i = s.indexOf(needle, i + 1)) >= 0) {
  shown++;
  console.log("@" + i + ": " + s.slice(Math.max(0, i - radius), i + needle.length + radius).replace(/\n/g, "\\n"));
}
console.log("shown " + shown + " | total occurrences " + (s.split(needle).length - 1));
