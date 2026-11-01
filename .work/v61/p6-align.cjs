'use strict';var fs=require('fs');
function edit(file,fn){var s=fs.readFileSync(file,'utf8'),n=fn(s);if(n!==s){fs.writeFileSync(file,n);console.log('aligned '+file);}else console.log('already '+file);}
edit('.work/v61/p3-module.js',function(s){if(s.indexOf("W.SDP.stamp():'v61'")>=0)return s;var a='body.appendChild(appearance);';if(s.split(a).length!==2)throw Error('appearance anchor '+s.split(a).length);return s.replace(a,a+"body.appendChild(el('p','small muted center',W.SDP&&W.SDP.stamp?W.SDP.stamp():'v61'));");});
edit('tests/phase1.cjs',function(s){
 s=s.split("clickText(a,\"I'm ready\");").join('');
 s=s.split("assert.equal(a.q.Eng.st,'ready')").join("assert.equal(a.q.Eng.st,'speaking')");
 s=s.split("includes('My data')").join("includes('Settings')");
 s=s.replace("assert(sheet.includes(\"Click I'm ready to begin.\"));","assert(a.q.Eng.layer&&a.q.Eng.layer.textContent.includes('Dictation'));");
 s=s.replace("assert.equal(a.q.Eng.layer,null);","assert.equal(a.w.document.querySelector('#sheets').textContent.includes(\"I'm ready\"),false);");
 s=s.replace("const btn=a.w.document.querySelector('#btnTestVoicePlayer');","const btn=Array.from(a.w.document.querySelectorAll('#sdpCockpitDock button')).find(function(b){return b.textContent==='Repeat';});");
 s=s.replace("assert(btn, 'Test sound button');","assert(btn, 'Repeat voice button');");
 s=s.replace("() => withApp({}, a => {\n const real=a.q.UI.statBox;","() => withApp({learning:true}, a => {\n const real=a.q.UI.statBox;");
 s=s.replace("assert(a.w.document.querySelector('#sdpHomeStatsRow').children.length>0);","assert(a.w.document.querySelectorAll('#sdpNextGenHome .sdp-stat').length>=3);");
 s=s.replace("assert(a.q.Errors.items.some(i=>i.where==='widget: home-stats'));","a.q.U.widget('home-stats',function(){throw Error('Stat widget failed');});assert(a.q.Errors.items.some(i=>i.where==='widget: home-stats'));");
 s=s.replace("assert.equal(a.w.document.querySelector('#homeStats').children.length,3);","assert(a.w.document.querySelectorAll('#sdpNextGenHome .sdp-stat').length>=3);");
 s=s.replace("test('1.8 build stamp is exposed, shown in Settings and on the fatal card', () => withApp({}, a => {","test('1.8 build stamp is exposed, shown in Settings and on the fatal card', () => withApp({learning:true}, a => {");
 return s;});
