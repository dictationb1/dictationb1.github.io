var e = require("./patchlib.cjs").open("tests/e2e.cjs", ["rec(", "async function"]);
e.rep("e2e-model",
  "vault.model === 'eleven_multilingual_v2'",
  "vault.model === 'eleven_flash_v2_5'",
  1);
e.save(60000);
console.log("ok");
