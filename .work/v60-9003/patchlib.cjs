var fs = require("fs");
exports.open = function (file, sigTokens) {
  var orig = fs.readFileSync(file, "utf8"), src = orig;
  function sig(s) { return (sigTokens || []).map(function (t) { return s.split(t).length; }).join("/"); }
  return {
    count: function (needle) { return src.split(needle).length - 1; },
    rep: function (label, from, to, expected) {
      var parts = src.split(from), n = parts.length - 1;
      if (n !== expected) { throw new Error("PATCH FAIL [" + label + "]: expected " + expected + " match(es), found " + n); }
      src = parts.join(to);
      console.log("ok   " + label + " x" + n);
    },
    regex: function (label, re, fn, minHits) {
      var n = 0;
      src = src.replace(re, function () { n++; return fn.apply(null, arguments); });
      if (n < (minHits || 1)) { throw new Error("PATCH FAIL [" + label + "]: regex matched " + n); }
      console.log("ok   " + label + " x" + n);
    },
    save: function (maxBytes) {
      var size = Buffer.byteLength(src, "utf8");
      if (size > maxBytes) { throw new Error("SIZE FAIL " + size + " > " + maxBytes + " (nothing written)"); }
      if (sig(src) !== sig(orig)) { throw new Error("STRUCTURE FAIL: signature counts changed (nothing written)"); }
      fs.writeFileSync(file + ".tmp", src);
      fs.renameSync(file + ".tmp", file);
      console.log("saved " + file + ": " + Buffer.byteLength(orig, "utf8") + " -> " + size + " bytes");
    }
  };
};
