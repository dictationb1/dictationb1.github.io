/* P3b: the legacy `.glass` gradient outranks the sheet rule, so the topbar must
   be painted with inline !important declarations (beats every author rule). */
var p = require("./patchlib.cjs");
var L = p.open("data/learning-tools.js", ["</script>"]);

L.rep(
  "topbar inline paint",
  "    var cluster = $('#sdpBrandCluster');\n    if (!cluster) return;",
  "    try {\n" +
    "      bar.style.setProperty('position', 'fixed', 'important');\n" +
    "      bar.style.setProperty('top', '0', 'important');\n" +
    "      bar.style.setProperty('left', '0', 'important');\n" +
    "      bar.style.setProperty('right', '0', 'important');\n" +
    "      bar.style.setProperty('width', '100%', 'important');\n" +
    "      bar.style.setProperty('max-width', 'none', 'important');\n" +
    "      bar.style.setProperty('height', '56px', 'important');\n" +
    "      bar.style.setProperty('margin', '0', 'important');\n" +
    "      bar.style.setProperty('padding', '0 14px', 'important');\n" +
    "      bar.style.setProperty('background', '#09090B', 'important');\n" +
    "      bar.style.setProperty('background-color', '#09090B', 'important');\n" +
    "      bar.style.setProperty('background-image', 'none', 'important');\n" +
    "      bar.style.setProperty('border', '0', 'important');\n" +
    "      bar.style.setProperty('border-bottom', '1px solid rgba(255,255,255,0.09)', 'important');\n" +
    "      bar.style.setProperty('border-radius', '0', 'important');\n" +
    "      bar.style.setProperty('box-shadow', '0 4px 16px rgba(0,0,0,0.6)', 'important');\n" +
    "      bar.style.setProperty('backdrop-filter', 'none', 'important');\n" +
    "      bar.style.setProperty('transform', 'none', 'important');\n" +
    "      bar.style.setProperty('z-index', '120', 'important');\n" +
    "      bar.style.setProperty('box-sizing', 'border-box', 'important');\n" +
    "    } catch (eStyle) {}\n" +
    "    var cluster = $('#sdpBrandCluster');\n    if (!cluster) return;",
  1
);

L.save(300000);
console.log("p3b done");
