exports.escapeNonAscii = function (str) {
  return String(str).replace(/[\u0080-\uFFFF]/g, function (ch) {
    return "\\u" + ("0000" + ch.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
  });
};
exports.linesToJsExpr = function (lines) {
  return lines.map(function (l) { return exports.escapeNonAscii(JSON.stringify(String(l))); }).join(" + \"\\n\" +\n");
};
