'use strict';
var fs=require('fs'), cp=require('child_process');
var files=['index.html','data/learning-tools.js','data/studio.js','data/data-meter.js','data.html','data/index.html','sw.js'];
var needles=['sdpV57Css','sdpV58Css','sdpLearnCss','sdpV59Css','sdpDataSheetCss','sdpNextGenCss','v604All','creditDocked','setTimeout\\(','MutationObserver','Screens.home','Speech.say','wrapTabset\\|wrapHome\\|wrapPaint\\|wrapSettings\\|wrapDict\\|wrapCockpit','guide-si-'];
function run(args){return cp.spawnSync(args[0],args.slice(1),{encoding:'utf8'}).stdout.trim();}
var out='# P0 measured anchor inventory\n\nHEAD: '+run(['git','rev-parse','HEAD'])+'\n\n## Baseline bytes\n\n```\n'+run(['wc','-c'].concat(files))+'\n```\n\n## Matching-line counts (`grep -c`) and occurrence totals\n\n';
['index.html','data/learning-tools.js'].forEach(function(f){out+='### '+f+'\n\n';needles.forEach(function(n){var c=run(['grep','-c',n,f]);var src=fs.readFileSync(f,'utf8');var raw=n.replace(/\\\(/g,'(').replace(/\\\|/g,'|');var total=raw.indexOf('|')>=0?raw.split('|').reduce(function(a,b){return a+src.split(b).length-1;},0):src.split(raw).length-1;out+='- `'+n+'`: lines='+c+', occurrences='+total+'\n';});});
out+='\n## Baseline comparison without switching branches\n\n';
['ef6cdfa','3066550'].forEach(function(rev){out+='### '+rev+'\n';files.forEach(function(f){out+='- '+f+': '+run(['git','rev-parse',rev+':'+f])+'\n';});});
fs.writeFileSync('.work/v61/anchors.md',out);
console.log(out);
