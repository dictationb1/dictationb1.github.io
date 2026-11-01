var h=require('../../tests/app-harness.cjs').harness();
try{
 h.q.Eng.start({}); h.q.Eng.skipReady(); var l=h.q.Eng.layer;
 console.log('layer tag/id/class='+l.tagName+'/'+l.id+'/'+l.className);
 function walk(n,depth){
  if(depth>3)return;
  Array.prototype.forEach.call(n.children,function(x){
   console.log(Array(depth+1).join('  ')+x.tagName+'#'+x.id+'.'+x.className+' '+(x.children.length?'':String(x.textContent||'').slice(0,65)));
   walk(x,depth+1);
  });
 }
 walk(l,0);
}finally{h.close();}
