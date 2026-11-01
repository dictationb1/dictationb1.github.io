/* P2 — index.html top-gap checks (already clean) + data/studio.js flash/vault hardening */
var fs = require("fs");
var idx = fs.readFileSync("index.html", "utf8");
console.log("index 140px:", (idx.split("140px").length - 1), "154px:", (idx.split("154px").length - 1),
  "top:calc(68px:", (idx.split("top:calc(68px").length - 1),
  "iterations:250000:", (idx.split("iterations:250000").length - 1),
  "iterations:15e4:", (idx.split("iterations:15e4").length - 1),
  "150000:", (idx.split("150000").length - 1));

var ADD = [
  "",
  "/* ------------------------------------------------------------------",
  "   SDP_ENC_V2 vault helpers (v60 / 9.0.0.3)",
  "   PBKDF2-SHA256 with 250000 iterations; the AES-GCM envelope itself",
  "   lives in index.html (window.EncryptedVault). These are the studio-side",
  "   markers plus thin, fail-safe delegates so a locked student device never",
  "   derives a key or touches the network.",
  "   ------------------------------------------------------------------ */",
  "(function (global) {",
  "  'use strict';",
  "  var SDP_ENC_V2 = { tag: 'SDP_ENC_V2:', kdf: 'PBKDF2', hash: 'SHA-256', iterations: 250000, cipher: 'AES-GCM', bits: 256 };",
  "  function getVault() {",
  "    try {",
  "      var v = global.ElevenVault;",
  "      if (!v) return null;",
  "      if (typeof v.stats === 'function') return v.stats();",
  "      if (typeof v.count === 'function') return { clips: v.count(), voiceId: v.voiceId ? v.voiceId() : '', modelId: v.modelId ? v.modelId() : '' };",
  "      return null;",
  "    } catch (e) { return null; }",
  "  }",
  "  function saveVault(payload, pin, cb) {",
  "    var out = null;",
  "    try {",
  "      var ev = global.EncryptedVault;",
  "      if (ev && typeof ev.encryptV2 === 'function' && payload && pin) out = ev.encryptV2(payload, pin);",
  "      else if (ev && typeof ev.encrypt === 'function' && payload && pin) out = ev.encrypt(payload, pin);",
  "    } catch (e) { out = null; }",
  "    if (typeof cb === 'function') { try { cb(out); } catch (e2) {} }",
  "    return out;",
  "  }",
  "  global.SDP_ENC_V2 = SDP_ENC_V2;",
  "  global.SDPEncV2 = { params: SDP_ENC_V2, getVault: getVault, saveVault: saveVault };",
  "})((typeof window !== 'undefined') ? window : {});",
  ""
].join("\n");

var p = require("./patchlib.cjs").open("data/studio.js", ["window.ElevenVault"]);
p.regex("append-vault-helpers", /()$/, function () { return ADD; }, 1);
p.save(220000);

/* tests/phase1.cjs 5.1 — R9 mandates eleven_flash_v2_5 as the default model. */
var t = require("./patchlib.cjs").open("tests/phase1.cjs", ["assert", "test("]);
t.rep("phase1-default-model", "assert.equal(v.modelId(), 'eleven_multilingual_v2');", "assert.equal(v.modelId(), 'eleven_flash_v2_5');", 1);
t.save(80000);
console.log("done");
