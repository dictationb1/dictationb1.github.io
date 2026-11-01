'use strict';var fs=require('fs'),p=require('./patchlib.cjs');
// Static shell: real safe areas, 44px targets, lite-mode blur kill, wallpaper scrim.
p.rep('index.html',':root{',':root{--tap:44px;');
p.rep('index.html','#sdpTopBar{position:sticky;top:0;z-index:40;','#sdpTopBar{position:sticky;top:0;z-index:40;padding-top:env(safe-area-inset-top,0px);');
p.rep('index.html','#creditFoot{display:flex;','#creditFoot{display:flex;padding-bottom:env(safe-area-inset-bottom,0px);');
p.rep('index.html','.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;','.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:var(--tap);');
p.rep('index.html','</style>','html[data-perf="lite"] *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}\n#bgContrastScrim{position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgba(9,9,11,.18),rgba(9,9,11,.54))}\n</style>');
p.rep('index.html','<section class="screen" id="screen-home" role="tabpanel" aria-labelledby="tab-home">','<section class="screen" id="screen-home" role="tabpanel" aria-labelledby="tab-home">\n<div id="bgContrastScrim" aria-hidden="true"></div>');
// Settings exposes the running build stamp.
p.rep('.work/v61/p3-module.js',"add(g3,row(T('lecturerMode'),null,move('btnAdmin')),row(T('appearance'),null,move('btnTheme')),row(T('performance'),null,move('btnPerf')));", "add(g3,row(T('lecturerMode'),null,move('btnAdmin')),row(T('appearance'),null,move('btnTheme')),row(T('performance'),null,move('btnPerf')),el('p','small muted center',W.SDP&&W.SDP.stamp?W.SDP.stamp():'v61'));");
// Phase-1 behavioural expectations follow the single cockpit (no ready interstitial).
var t=fs.readFileSync('tests/phase1.cjs','utf8');
t=t.split("clickText(a,\"I'm ready\");").join('');
t=t.replace("assert.equal(a.q.Eng.st,'ready')","assert.equal(a.q.Eng.st,'speaking')");
t=t.replace("assert(a.w.document.querySelector('#screen-set').textContent.includes('My data'))","assert(a.w.document.querySelector('#screen-set').textContent.includes('Settings'))");
t=t.replace("assert(sheet.includes(\"Click I'm ready to begin.\"));","assert(a.q.Eng.layer&&a.q.Eng.layer.textContent.includes('Dictation'));");
t=t.replace("assert.equal(a.q.Eng.layer,null);","assert.equal(a.w.document.querySelector('#sheets').textContent.includes(\"I'm ready\"),false);");
t=t.replace("const btn=a.w.document.querySelector('#btnTestVoicePlayer');","const btn=Array.from(a.w.document.querySelectorAll('#sdpCockpitDock button')).find(function(b){return b.textContent==='Repeat';});");
t=t.replace("assert(btn, 'Test sound button');","assert(btn, 'Repeat voice button');");
t=t.replace("assert(a.w.document.querySelector('#sdpHomeStatsRow').children.length>0);","assert(a.w.document.querySelectorAll('#sdpNextGenHome .sdp-stat').length>=3);");
t=t.replace("assert(a.q.Errors.items.some(i=>i.where==='widget: home-stats'));","a.q.U.widget('home-stats',function(){throw Error('Stat widget failed');});assert(a.q.Errors.items.some(i=>i.where==='widget: home-stats'));");
t=t.replace("assert.equal(a.w.document.querySelector('#homeStats').children.length,3);","assert(a.w.document.querySelectorAll('#sdpNextGenHome .sdp-stat').length>=3);");
t=t.replace("for(const name of ['home-announcement','home-hero','home-resume','home-stats','home-sessions']) {","for(const name of ['home-announcement','home-hero','home-resume','home-stats','home-sessions']) {");
fs.writeFileSync('tests/phase1.cjs',t);
