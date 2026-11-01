/* P1 step 3 — index.html + data.html version stamps, next-gen body class, #sdpSwBoot */
var fs = require("fs");
var p = require("./patchlib.cjs").open("index.html", ["</html>", "<body"]);

p.rep("app-version", 'APP_VERSION="9.0.0.1"', 'APP_VERSION="9.0.0.3"', 1);
p.rep("vault-version", '{version:59,appVersion:"9.0.0.1"', '{version:60,appVersion:"9.0.0.3"', 1);
p.rep("payload-version", '{ver:59,appVersion:"9.0.0.1"', '{ver:60,appVersion:"9.0.0.3"', 1);
p.rep("learning-tools-query", 'src="./data/learning-tools.js" defer', 'src="./data/learning-tools.js?v=9.0.0.3" defer', 1);
p.rep("studio-query", 'file:"./data/studio.js?v=60"', 'file:"./data/studio.js?v=9.0.0.3"', 1);
p.rep("body-class", '<body class="wallpaper-on tint-clear"', '<body class="sdp-nextgen tint-clear"', 1);

var BOOT = [
  '<script id="sdpSwBoot">',
  '(function(){try{var V="9.0.0.3",K="sdp_sw_ver";var LS=window.localStorage;var seen="";',
  'try{seen=(LS&&LS.getItem(K))||"";}catch(e0){}if(seen===V)return;',
  'try{if(LS)LS.setItem(K,V);}catch(e1){}',
  'try{if(window.caches&&window.caches.keys){window.caches.keys().then(function(ks){',
  'for(var i=0;i<ks.length;i++){var k=ks[i];',
  'if(k.indexOf(V)===-1&&k!=="sdp-youdao-v1"){try{window.caches["delete"](k);}catch(e2){}}}});}}catch(e3){}',
  'try{var SWN=navigator.serviceWorker;if(SWN&&SWN.getRegistrations){SWN.getRegistrations().then(function(rs){',
  'for(var j=0;j<rs.length;j++){try{rs[j].update();}catch(e4){}}',
  'try{SWN.addEventListener("controllerchange",function(){location.reload();},{once:true});}catch(e5){}});}}catch(e6){}',
  '}catch(e){}})();',
  '</script>'
].join("");

/* charset meta stays first for encoding safety; the boot script follows immediately. */
p.rep("sw-boot", '<head><meta charset="utf-8">', '<head><meta charset="utf-8">' + BOOT, 1);

p.save(598000);

var d = require("./patchlib.cjs").open("data.html", ["</html>", "<body", "<script"]);
d.rep("data-release", "v60 \u00B7 APP_VERSION 9.0.0.1", "v60 \u00B7 APP_VERSION 9.0.0.3", 1);
d.save(60000);

fs.copyFileSync("data.html", "data/index.html");
console.log("copied data.html -> data/index.html");
