'use strict';
var fs=require('fs'),cp=require('child_process');
var p='.work/v61/PROGRESS.md';
function tail(f){var a=fs.readFileSync(f,'utf8').trim().split('\n');return a.slice(-12).join('\n');}
var text='\n### Dependency installation and gate retry\n\n```text\n'+tail('/tmp/p0-install.log')+'\n```\n\n';
['check','up'].forEach(function(n){var f='/tmp/p0-'+n+'.log';if(fs.existsSync(f))text+='\n'+n+':\n```text\n'+tail(f)+'\n```\n';});
text+='\nNo baseline source files changed in P0.\n';fs.appendFileSync(p,text);
var a='.work/v61/anchors.md';var old=fs.readFileSync(a,'utf8');old=old.replace(/- `setTimeout\\\(`: lines=, occurrences=/g,'- `setTimeout\\(`: lines='+String(cp.spawnSync('grep',['-c','setTimeout(','index.html'],{encoding:'utf8'}).stdout.trim())+', occurrences=');
var lines=old.split('\n'),second=false;for(var i=0;i<lines.length;i++){if(lines[i].indexOf('### data/learning-tools.js')===0)second=true;if(second&&lines[i].indexOf('`setTimeout')>=0){lines[i]=lines[i].replace('lines=,','lines='+cp.spawnSync('grep',['-c','setTimeout(','data/learning-tools.js'],{encoding:'utf8'}).stdout.trim());break;}}
old=lines.join('\n')+'\n`ef6cdfa` is not present in this shallow checkout; no unavailable anchor was guessed. All surgery uses measured 3066550 anchors.\n';fs.writeFileSync(a,old);
console.log('P0 evidence saved');
