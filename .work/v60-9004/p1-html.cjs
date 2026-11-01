var fs = require('fs'), lib = require('./patchlib.cjs');
var p = lib.open('index.html',['</html>','<body','<script']);
p.rep('index version','9.0.0.3','9.0.0.4',6);
p.rep('cloak safety before SW early return','<script id="sdpSwBoot">(function(){try{','<script id="sdpSwBoot">(function(){setTimeout(function(){if(document.body)document.body.setAttribute("data-v60-ready","1");},900);try{',1);
p.rep('head prepaint cloak','</script><meta name="viewport"','</script><style id="sdpPrePaintCloak">html,body{background:#09090B!important;color:#FAFAFA!important}body:not([data-v60-ready="1"]) #app,body:not([data-v60-ready="1"]) .topbar,body:not([data-v60-ready="1"]) #tabbar{opacity:0!important;pointer-events:none!important}</style><meta name="viewport"',1);
p.save(598000);
p = lib.open('data.html',['</html>','<body','<script']);
p.rep('data route version','9.0.0.3','9.0.0.4',1); p.save(60000);
fs.copyFileSync('data.html','data/index.html');
[['sw.js',5,12000],['data/data-meter.js',1,60000],['data/learning-tools.js',3,400000],['data/studio.js',1,160000]].forEach(function(entry){
  var q=lib.open(entry[0]); q.rep('version '+entry[0],'9.0.0.3','9.0.0.4',entry[1]); q.save(entry[2]);
});
['tests/check.cjs','tests/upgrade.test.cjs','tests/server.cjs'].forEach(function(file){
  var q=lib.open(file);
  ['9.0.0.3','9\\.0\\.0.3','9\\.0\\.0\\.3'].forEach(function(old){
    var n=q.count(old); if(n) q.rep('version assertions '+file,old,old.slice(0,-1)+'4',n);
  });
  q.save(50000);
});
