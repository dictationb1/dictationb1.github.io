#!/usr/bin/env node
'use strict';
// Usage as CLI: node .work/v61/patchlib.cjs <file> <exact-old> <exact-new> [expected-count=1]
// Usage as module: var patchlib = require('./patchlib.cjs'); patchlib.rep(file, oldS, newS, want);
var fs = require('fs');
function rep(file, oldS, newS, want) {
  want = want == null ? 1 : +want;
  var src = fs.readFileSync(file, 'utf8');
  var parts = src.split(oldS);
  var found = parts.length - 1;
  if (found !== want) {
    throw new Error('ABORT [' + file + ']: ' + JSON.stringify(oldS.slice(0, 60)) + ' found ' + found + 'x, expected ' + want);
  }
  var out = parts.join(newS);
  fs.writeFileSync(file + '.tmp', out);
  fs.renameSync(file + '.tmp', file);
  console.log('OK: replaced ' + found + ' occurrence(s) in ' + file);
  return found;
}
function killRange(file, startNeedle, endNeedle, want) {
  want = want == null ? 1 : +want;
  var src = fs.readFileSync(file, 'utf8');
  var done = 0, out = [], cur = 0;
  while (done < want) {
    var s = src.indexOf(startNeedle, cur);
    if (s < 0) break;
    var e = src.indexOf(endNeedle, s + startNeedle.length);
    if (e < 0) throw new Error('ABORT [' + file + ']: endNeedle not found after startNeedle');
    out.push(src.slice(cur, s));
    cur = e + endNeedle.length;
    done++;
  }
  if (done !== want) throw new Error('ABORT [' + file + ']: expected ' + want + ' range(s), killed ' + done);
  out.push(src.slice(cur));
  var res = out.join('');
  fs.writeFileSync(file + '.tmp', res);
  fs.renameSync(file + '.tmp', file);
  console.log('OK: killed ' + done + ' range(s) in ' + file);
  return done;
}
module.exports = { rep: rep, killRange: killRange };
if (require.main === module && process.argv[2]) {
  rep(process.argv[2], process.argv[3], process.argv[4], +(process.argv[5] || 1));
}
