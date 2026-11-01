var fs=require('fs'),assert=require('assert'),h=require('../../tests/app-harness.cjs').harness();
try{
 h.w.eval(fs.readFileSync('data/learning-tools.js','utf8')); h.clock.tick(200);
 var e=h.q.Eng, starts=0, run=e.runItem;
 e.runItem=function(i){starts++;this.idx=i;};
 e.start({}); assert(e.layer,'student start opens player synchronously');
 assert(!h.w.document.querySelector('#readySheet'),'student start bypasses ready modal');
 h.clock.tick(160); assert.equal(starts,1,'150ms direct start'); e.runItem=run;
 ['plCount','plBars','plFill','plStatus','plWord','plHint','plRing','plPlay','cdFg','cdNum'].forEach(function(id){assert(h.w.document.getElementById(id),'preserved '+id);});
 var l=e.layer,card=l.querySelector('#sdpCockpitCard');
 assert(card); assert(l.querySelector('#sdpPlayerLegacy .ctrlgrid')); assert(l.querySelector('#sdpPlayerLegacy .lfoot'));
 assert(l.querySelector('#sdpCockpitCounters')); assert.equal(l.querySelectorAll('#sdpWordMap i').length,30);
 assert.equal(l.querySelectorAll('#sdpLetterSlots i').length,7);
 assert.equal(h.w.getComputedStyle(h.w.document.getElementById('creditDocked')).position,'static');
 l.querySelector('.lbody').scrollTop=500;e.paint();assert.equal(l.querySelector('.lbody').scrollTop,0);
 e.showWord=false;e.paint();assert(l.querySelector('#sdpCockpitLegacy #plWord'));
 e.showWord=true;e.paint();assert(l.querySelector('#sdpCockpitStage #plWord'));
 e.stop(false);e.st='ready';e.readyScreen();assert(h.w.document.querySelector('#readySheet'),'direct legacy readyScreen remains callable');
 console.log('P4 direct student start, legacy-ready call, preserved player IDs, off-flow legacy controls, seven slots, map, reveal and paint scroll reset: PASS');
}catch(err){console.error(err);process.exitCode=1;}finally{h.close();}
