#!/usr/bin/env node
'use strict';
// Usage: node .work/v61/strgen.cjs "Sinhala text" -> prints ASCII-only ES5 string literal
function toAsciiLiteral(input) {
  var out = '';
  for (var i = 0; i < input.length; i++) {
    var c = input.charCodeAt(i);
    out += (c > 126 || c < 32) ? '\\u' + ('000' + c.toString(16)).slice(-4).toUpperCase() : input[i];
  }
  return "'" + out.replace(/'/g, "\\'") + "'";
}
module.exports = { toAsciiLiteral: toAsciiLiteral };
if (require.main === module) {
  console.log(toAsciiLiteral(process.argv.slice(2).join(' ')));
}
