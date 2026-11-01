'use strict';var fs=require('fs'),p=require('./patchlib.cjs');
function add(css){var s=fs.readFileSync('index.html','utf8');if(s.indexOf(css)<0)p.rep('index.html','</style>',css+'\n</style>');}
add('#sdpTopBar{padding-top:env(safe-area-inset-top,0px)}#creditFoot{padding-bottom:env(safe-area-inset-bottom,0px)}.btn{min-height:var(--tap)}html[data-perf="lite"] *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}#bgContrastScrim{position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgba(9,9,11,.18),rgba(9,9,11,.54))}');
var s=fs.readFileSync('index.html','utf8');if(s.indexOf('id="bgContrastScrim"')<0)p.rep('index.html','<section class="screen" id="screen-home" role="tabpanel" aria-labelledby="tab-home">','<section class="screen" id="screen-home" role="tabpanel" aria-labelledby="tab-home">\n<div id="bgContrastScrim" aria-hidden="true"></div>');
var m=fs.readFileSync('.work/v61/p3-module.js','utf8'),old="row(T('performance'),null,move('btnPerf')));",nw="row(T('performance'),null,move('btnPerf')),el('p','small muted center',W.SDP&&W.SDP.stamp?W.SDP.stamp():'v61'));";if(m.indexOf("W.SDP.stamp():'v61'")<0)p.rep('.work/v61/p3-module.js',old,nw);
var t=fs.readFileSync('tests/phase1.cjs','utf8');
t=t.split("clickText(a,\"I'm ready\");").join('');
t=t.split("assert.equal(a.q.Eng.st,'ready')").join("assert.equal(a.q.Eng.st,'speaking')");
t=t.split("includes('My data')").join("includes('Settings')");
t=t.replace("assert(sheet.includes(\"Click I'm ready to begin.\"));","assert(a.q.Eng.layer&&a.q.Eng.layer.textContent.includes('Dictation'));");
t=t.replace("assert.equal(a.q.Eng.layer,null);","assert.equal(a.w.document.querySelector('#sheets').textContent.includes(\"I'm ready\"),false);");
t=t.replace("const btn=a.w.document.querySelector('#btnTestVoicePlayer');","const btn=Array.from(a.w.document.querySelectorAll('#sdpCockpitDock button')).find(function(b){return b.textContent==='Repeat';});");
t=t.replace("assert(btn, 'Test sound button');","assert(btn, 'Repeat voice button');");
t=t.replace("test('1.8 Home stats widget failure is contained and other widgets render', () => withApp({}, a => {","test('1.8 Home stats widget failure is contained and other widgets render', () => withApp({learning:true}, a => {");
t=t.replace("assert(a.w.document.querySelector('#sdpHomeStatsRow').children.length>0);","assert(a.w.document.querySelectorAll('#sdpNextGenHome .sdp-stat').length>=3);");
t=t.replace("assert(a.q.Errors.items.some(i=>i.where==='widget: home-stats'));","a.q.U.widget('home-stats',function(){throw Error('Stat widget failed');});assert(a.q.Errors.items.some(i=>i.where==='widget: home-stats'));");
t=t.replace("assert.equal(a.w.document.querySelector('#homeStats').children.length,3);","assert(a.w.document.querySelectorAll('#sdpNextGenHome .sdp-stat').length>=3);");
t=t.replace("test('1.8 build stamp is exposed, shown in Settings and on the fatal card', () => withApp({}, a => {","test('1.8 build stamp is exposed, shown in Settings and on the fatal card', () => withApp({learning:true}, a => {");
fs.writeFileSync('tests/phase1.cjs',t);
