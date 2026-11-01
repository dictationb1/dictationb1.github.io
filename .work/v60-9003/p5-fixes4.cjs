var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion", "SDP_NEXTGEN_V60"]);
p.rep("hero-keep-gradient",
  "        hero.style.setProperty('background-image', 'none', 'important');\n        hero.style.setProperty('background-color', '#18181B', 'important');",
  "        hero.style.setProperty('background-color', '#18181B', 'important');",
  1);
p.save(260000);

var b = require("./patchlib.cjs").open("tests/browser.cjs", ["results.push", "async function"]);
b.rep("admin-flash2",
  "cards.model==='eleven_multilingual_v2'",
  "cards.model==='eleven_flash_v2_5'",
  1);
b.rep("dict-pos-slot",
  "   return {n:cards.length,filters:!!document.getElementById('sdpWordFilterRow'),\n    word:pick('.sdp-word-head b'),ipa:pick('.v59-ipa'),pos:pick('.v59-pos'),",
  "   return {n:cards.length,filters:!!document.getElementById('sdpWordFilterRow'),\n    word:pick('.sdp-word-head b'),ipa:pick('.v59-ipa'),pos:pick('.v59-pos'),posSlot:!!(first&&first.querySelector('.v59-pos')),",
  1);
b.rep("dict-pos-status",
  "dict.pos==='adj.'&&/Feeling fear",
  "dict.posSlot&&(/^$|^adj\\.$/.test(dict.pos))&&/Feeling fear",
  1);
b.rep("dict-si-range",
  "siShown:/\\u0D80/.test(pick('.sdp-si-pill'))",
  "siShown:/[\\u0D80-\\u0DFF]/.test(pick('.sdp-si-pill'))",
  1);
b.save(80000);
console.log("fixes4 done");
