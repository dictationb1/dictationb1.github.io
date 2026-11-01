var fs=require('fs'), h=require('../../tests/app-harness.cjs').harness();
try {
  h.q.Screens.settings();
  console.log('legacy settings cards:');
  Array.prototype.forEach.call(h.w.document.querySelector('#setBody').children,function(n){
    console.log(JSON.stringify({tag:n.tagName,id:n.id,cls:n.className,heading:(n.querySelector('h3')||{}).textContent,ids:Array.prototype.map.call(n.querySelectorAll('[id]'),function(x){return x.id;})}));
  });
  console.log('SDPCore available: '+!!h.w.SDPCore);
  h.w.eval(fs.readFileSync('data/learning-tools.js','utf8')); h.clock.tick(180);
  h.q.UI.setTab('dict');
  console.log('dict words='+h.w.document.querySelectorAll('.sdp-word-card').length+' screen='+h.w.document.querySelector('#screen-dict').className);
} finally {h.close();}
