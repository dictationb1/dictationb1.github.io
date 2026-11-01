#!/usr/bin/env node
'use strict';
// Usage: node .work/v61/peek.cjs <file> <needle> [before=200] [after=800] [nth=1]
var fs = require('fs');
var file = process.argv[2], needle = process.argv[3];
var before = +(process.argv[4] || 200), after = +(process.argv[5] || 800), nth = +(process.argv[6] || 1);
var src = fs.readFileSync(file, 'utf8');
var idx = -1, hit = 0;
while (true) { idx = src.indexOf(needle, idx + 1); if (idx < 0) break; if (++hit === nth) break; }
if (idx < 0) { console.error('NOT FOUND: ' + needle + ' (occurrences: ' + (hit - 1) + ')'); process.exit(1); }
console.log('[' + file + ' @' + idx + ' occurrence ' + hit + ' / total ' + (src.split(needle).length - 1) + ']');
console.log(src.slice(Math.max(0, idx - before), idx + needle.length + after));
