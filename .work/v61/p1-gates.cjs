'use strict';
var fs=require('fs'), path=require('path'), cp=require('child_process');
function read(f){return fs.readFileSync(f,'utf8');}function write(f,s){fs.writeFileSync(f,s);}function rep(s,a,b,want){var n=s.split(a).length-1;if(want!=null&&n!==want)throw Error('anchor '+a.slice(0,80)+' count '+n);return s.split(a).join(b);}
var check=read('tests/check.cjs');
var secret=check.slice(check.indexOf('/* Secret/PIN gate:'),check.indexOf('console.log(\'secret gate:'));
secret=secret.replace("'data/studio.js', 'data/data-meter.js'", "'data/app-core.js', 'data/studio.js', 'data/data-meter.js'");
var prefix=`'use strict';
/* v61 release contract: one static UI, one extracted engine, no wrapper layers. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),acorn=require('acorn');
const ROOT=path.resolve(__dirname,'..');fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
function read(f){return fs.readFileSync(path.join(ROOT,f),'utf8');}
function es5(src,label){acorn.parse(src,{ecmaVersion:5});new Function(src);if(!/^\\s*['"]use strict['"];/.test(src))throw Error(label+' lacks strict directive');}
function parseES5(f,label){const s=read(f);es5(s,label);fs.writeFileSync(path.join(__dirname,'artifacts',label+'.js'),s);cp.execFileSync(process.execPath,['--check',path.join(__dirname,'artifacts',label+'.js')],{stdio:'inherit'});return s;}
function budget(f,max){const n=Buffer.byteLength(read(f));if(n>max)throw Error(f+' '+n+' > '+max);console.log(f+': '+n+' / '+max+' bytes');}
const INDEX=read('index.html');budget('index.html',110000);
const CORE=fs.existsSync(path.join(ROOT,'data/app-core.js'))?parseES5('data/app-core.js','app-core'):'';
const APP_SRC=INDEX+'\\n'+CORE;
const learn=parseES5('data/learning-tools.js','learning-tools');budget('data/learning-tools.js',120000);
const studio=parseES5('data/studio.js','studio');budget('data/studio.js',110000);
const meterSrc=parseES5('data/data-meter.js','meter');const sw=parseES5('sw.js','sw');
for(const f of ['data.html','data/index.html']){budget(f,60000);const h=read(f);for(const m of h.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/g)){if(!/src=/.test(m[1])&&m[2].trim())acorn.parse(m[2],{ecmaVersion:5});}}
if(read('data.html')!==read('data/index.html'))throw Error('transparency routes differ');
const boot=/<script id="sdpSwBoot">([\\s\\S]*?)<\\/script>/.exec(INDEX);if(!boot)throw Error('missing sdpSwBoot');es5(boot[1],'sdpSwBoot');
`;
var gates=`
/* Architecture replaces, rather than supplements, the old UI. */
const legacy=['sdpV57Css','sdpV58Css','sdpLearnCss','sdpV59Css','sdpDataSheetCss','sdpNextGenCss','v604All','v604SweepTopbar','v604Keeper','sdpLegacyPlayerDock','sdpPrePaintCloak','data-v60-legacy','data-v58-en','data-v58-si','v58-sig-pill','v58-tile','v59-dict-card'];
for(const f of ['index.html','data/app-core.js','data/learning-tools.js']){const s=read(f);for(const m of legacy)if(s.includes(m))throw Error('LEGACY_ABSENT '+f+': '+m);if(/createElement\\(['"]style['"]\\)/.test(s))throw Error('runtime CSS injection: '+f);}
const UI_SRC=APP_SRC+'\\n'+learn;
for(const m of ['id="sdpCss"','data-v61-ready','sdpWordFilterRow','sdp-word-card','sdpCockpitCard','sdpEdgeBar','sdpTimerPill','sdpCockpitDock','sdpWordMapCard','sdpNextGenSettings','sdpAppearanceAccordion','guideSheet','creditFoot','creditDocked','levenshteinOps','markMissed','markCorrect','v58SelfScore','resSummary','audio/mp4','Play my recording','offlineReadyCount'])if(!UI_SRC.includes(m))throw Error('V61_PRESENT: '+m);
if((INDEX.match(/<style\\b/g)||[]).length!==1)throw Error('exactly one static stylesheet required');
if(!/#creditDocked\\{[^}]*position:static/.test(INDEX))throw Error('credit must be static');
if(!/typeof e==="string"/.test(CORE)||!/typeof items==="string"/.test(CORE))throw Error('Speech string-to-array guard missing');
for(const id of ['app','sdpBrandCluster','brandName','brandSub','sdpTopActions','sdpTopVoiceBtn','sdpTopLangPill','btnLang','btnGuideTop','btnOpenSettingsTop','chipNet','tabbar','tab-home','tab-dict','tab-comm','tab-set','screen-home','homeAnn','homeResume','sdpHomeGreeting','homeHero','homeKicker','homeTitle','homeSub','sdpHeroConfigChips','btnStart','btnStartText','btnGuide','sdpHomeStatsRow','sdpQuickPracticeGrid','screen-dict','dictSearch','sdpWordFilterRow','dictList','screen-comm','screen-practice','btnCompose','screen-set','sdpNextGenSettings','setBody','sdpAppearanceAccordion','layers','sheets','modals','toasts','dataSheet','guideSheet','ttsMasterAudio'])if(!UI_SRC.includes(id))throw Error('protected identifier: '+id);
if(!/\\.\\/data\\/app-core\\.js/.test(sw)||!/\\.\\/data\\/learning-tools\\.js/.test(sw))throw Error('modules missing from SHELL');
if(/guide-si-[1-6]\\.mp3/.test(sw)||/guide-si-[1-6]\\.mp3/.test(learn))throw Error('fake guide stubs must not ship');
if(!/sdp-youdao-v1/.test(sw)||!/sdp-youdao-v1/.test(learn))throw Error('audio cache key missing');
if(!/NotoSansSinhala-Regular\\.woff2/.test(INDEX)||!/NotoSansSinhala-Bold\\.woff2/.test(INDEX))throw Error('local Sinhala fonts missing');
for(const f of ['assets/fonts/NotoSansSinhala-Regular.woff2','assets/fonts/NotoSansSinhala-Bold.woff2']){const b=fs.readFileSync(path.join(ROOT,f));if(b.length>60000||b.slice(0,4).toString()!=='wOF2')throw Error('invalid font '+f);}
if(!/window\\.ElevenVault\\s*=/.test(studio)||!/adminGenerateMissing/.test(studio)||!/strictAdminOnly/.test(studio)||!/fetchOnce:function/.test(studio.replace(/\\s/g,'')))throw Error('vault security API missing');
if(!/SDPDataMeter\\s*=/.test(meterSrc)||!/SDP_DATA_METER\\s*=/.test(meterSrc)||!/PerformanceObserver/.test(meterSrc)||!/transferSize/.test(meterSrc)||!/getModeProfiles/.test(meterSrc))throw Error('meter API missing');
if(!/caches\\.match/.test(sw))throw Error('offline cache strategy missing');
`;
var metadata=`
for(const f of ['version.json','data/version.json','data/config.json','data/session.json','data/elevenlabs-audio.json','data/media-manifest.json']){const d=JSON.parse(read(f));if(d.ver!==61||d.version!=='9.0.1.0'||d.appVersion!=='9.0.1.0'||d.schema!==61||d.settingsRev!==61)throw Error('v61 metadata mismatch '+f);}
if(!APP_SRC.includes('APP_VERSION="9.0.1.0"')||!sw.includes("VERSION = 'sdp-v61-9.0.1.0'")||!sw.includes("APP_VERSION = '9.0.1.0'"))throw Error('runtime/SW stamp mismatch');
if(!/METER_VERSION = '9\\.0\\.1\\.0', SCHEMA = 61/.test(meterSrc))throw Error('meter stamp mismatch');
if(!read('data.html').includes('v61 \\u00b7 APP_VERSION 9.0.1.0'))throw Error('data headline mismatch');
const manifest=JSON.parse(read('manifest.webmanifest'));if(!manifest.name||manifest.display!=='standalone'||manifest.theme_color!=='#09090B')throw Error('manifest theme mismatch');
if(!/sdp\\.v2:/.test(APP_SRC)||!/isUnlockedOnThisDevice/.test(APP_SRC)||!/iterations: ?250000/.test(APP_SRC)||!/SDP_ENC_V2/.test(APP_SRC))throw Error('PIN/PBKDF2/AES invariant missing');
if(/\\.createMediaElementSource\\s*\\(/.test(APP_SRC+learn))throw Error('MediaElementSource is forbidden');
if(!/perf:"auto"/.test(APP_SRC)||!/perfChosenBy="user"/.test(APP_SRC))throw Error('performance defaults missing');
var wsBody=/Eng\\.writeSecs=function\\(\\)\\{([^}]*)\\}/.exec(APP_SRC);if(!wsBody||!wsBody[1].includes('writeFixed')||!/Math\\.max\\(3,\\s*Math\\.min\\(60/.test(wsBody[1]))throw Error('lecturer writing timer missing');
if(!/rows:t\\.map\\(function\\(w\\)\\{return\\{word:/.test(APP_SRC)||!/mode:"paper"/.test(APP_SRC))throw Error('paper result mapping missing');
if(!/encVault/.test(read('data/config.json'))||!/SDP_ENC_V2:/.test(read('data/config.json')))throw Error('encrypted config missing');
if(!/eleven_flash_v2_5/.test(studio)||!/eleven_flash_v2_5/.test(read('data/elevenlabs-audio.json')))throw Error('studio model missing');
if(/\\.drawImage\\s*\\(|\\.getImageData\\s*\\(/.test(learn))throw Error('canvas readback forbidden');
if(!/SDPPerfGuard/.test(learn)||!/benchmark: function/.test(learn)||!/decide: function/.test(learn))throw Error('performance guard missing');
if(!/sdp_offline_v60/.test(learn)||!/sdp\\.v56_audit_verified/.test(learn))throw Error('storage compatibility missing');
if(!/microToastLoad/.test(learn)||!/getEntriesByType\\("navigation"\\)/.test(learn))throw Error('honest transfer telemetry missing');
console.log('LEGACY_ABSENT, V61_PRESENT, ES5, byte caps, metadata and security: PASS');
{
 const {harness}=require('./app-harness.cjs');const app=harness(null,{learning:true});
 try{const doc=app.w.document;if(doc.body.getAttribute('data-v61-ready')!=='1')throw Error('mount not synchronous');if(doc.querySelectorAll('style').length>2)throw Error('runtime style injection');
 app.q.Screens.dict();if(doc.querySelectorAll('#dictList .sdp-word-card').length!==app.q.Lib.current().words.length)throw Error('Words did not mount synchronously');
 app.q.Screens.settings();const box=doc.getElementById('sdpNextGenSettings'),body=doc.getElementById('setBody'),acc=doc.getElementById('sdpAppearanceAccordion');if(!box||!body||!acc||acc.open||!body.closest('#sdpAppearanceAccordion')||box.children.length!==3)throw Error('three-group settings contract failed');
 for(const id of ['rateRange','volRange','repeatsSelect','readSentenceToggle','writeSecsRange','bitrateSelect','btnAdmin','btnTheme','btnPerf'])if(!doc.getElementById(id))throw Error('missing setting '+id);
 if(doc.querySelectorAll('#repeatsSelect').length!==1||doc.getElementById('pasteHelper'))throw Error('duplicate/leaked settings');
 console.log('synchronous JSDOM mount, Words and Settings: PASS');}finally{app.close();}
}
console.log('ALL v61 STATIC CHECKS PASSED');
`;
write('tests/check.cjs',prefix+secret+gates+metadata);
var h=read('tests/app-harness.cjs');h=rep(h,"const rawScript=Array.from(w.document.scripts).find(s=>!s.type&&s.textContent.includes('var APP_VERSION')).textContent;", "const rawScript=fs.existsSync(path.resolve(__dirname,'../data/app-core.js'))?fs.readFileSync(path.resolve(__dirname,'../data/app-core.js'),'utf8'):Array.from(w.document.scripts).find(s=>!s.type&&s.textContent.includes('var APP_VERSION')).textContent;");
h=rep(h,"return {w,q:w.__qa,clock,consoleErrors,", "if(opts.learning){vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../data/learning-tools.js'),'utf8'),dom.getInternalVMContext());}\n return {w,q:w.__qa,clock,consoleErrors,");write('tests/app-harness.cjs',h);
var u=read('tests/upgrade.test.cjs');u=u.split('9.0.0.4').join('9.0.1.0').split('sdp-v60-').join('sdp-v61-').replace(/d\.ver, 60/g,'d.ver, 61').replace('<= 600000','<= 110000');
u=rep(u,"const INDEX = read('index.html');","const INDEX = read('index.html');\nconst CORE = fs.existsSync(path.join(ROOT,'data/app-core.js'))?read('data/app-core.js'):'';\nconst APP_SRC=INDEX+'\\n'+CORE;");
u=u.replace("assert.ok(INDEX.includes('APP_VERSION=\"9.0.1.0\"'));","assert.ok(APP_SRC.includes('APP_VERSION=\"9.0.1.0\"'));");
u=u.replace(/const dom = new JSDOM\('<!doctype html><html><body><\/body><\/html>', \{ url: 'https:\/\/example.test\/', runScripts: 'outside-only' \}\);\n  const w = dom.window;\n  try \{\n    vm.runInContext\(src, dom.getInternalVMContext\(\)\);/g,"const app = harness(null, {});\n  const w = app.w;\n  try {\n    w.eval(src);");
u=u.replace("const dom = new JSDOM('<!doctype html><html><body><p id=\"resSummary\">Well done! That is the end of the dictation.</p><div id=\"host\"></div></body></html>', { url: 'https://example.test/', runScripts: 'outside-only' });\n  const w = dom.window;\n  try {\n    vm.runInContext(src, dom.getInternalVMContext());", "const app = harness(null, {});\n  const w = app.w;\n  try {\n    const summary=w.document.createElement('p');summary.id='resSummary';summary.textContent='Well done! That is the end of the dictation.';w.document.body.appendChild(summary);const host=w.document.createElement('div');host.id='host';w.document.body.appendChild(host);\n    w.eval(src);");
u=u.split('} finally { try { w.close(); } catch (e) {} }').join('} finally { app.close(); }');
u=u.replace("assert.equal(w.document.body.getAttribute('data-perf'), null);","assert.equal(w.document.body.getAttribute('data-perf'), 'auto');");
u=u.split('#v58SelfCheck .v58-selfrow').join('#selfCheck .selfrow').split('#v58SelfCheck .v58-selfbtns button').join('#selfCheck .selfbtns button');
u=u.replace("['v59-dict-card', 'v59-ipa', 'v59-pos', 'v59-def', 'v59-ex', 'v59-si-chip', 'v59DictFilters', 'All 30 Words']","['sdp-word-card', 'sdp-word-ipa', 'sdp-word-pos', 'sdp-word-def', 'sdp-word-ex', 'sdp-si-chip', 'sdpWordFilterRow', 'data-filter']");
u=u.replace('v58ContextNextBtn','sdpContextNextBtn').replace('v59-context-ok','sdp-context-ok');
u += `\ntest('v61 single mount exposes the extracted engine, all six tools and honest audio states',()=>{const app=harness(null,{learning:true});try{assert.equal(app.w.document.body.getAttribute('data-v61-ready'),'1');assert.ok(app.w.SDPCore.Eng);assert.ok(app.w.SDPLearning);assert.ok(app.w.document.getElementById('guideSheet'));assert.ok(learnMarkers());}finally{app.close();}function learnMarkers(){return ['Flashcards','4-Choice Quiz','Sentence Gap','Weak Words Drill','Speak & Compare','Audio List'].every(x=>read('data/learning-tools.js').includes(x));}});\ntest('v61 Speech.say accepts whole-string input without spelling letters',()=>{const app=harness(null,{});try{let captured=[];app.q.Speech._speakInternal=function(text){captured.push(text);};app.q.Speech.say('hello',{},function(){});assert.deepEqual(captured,['hello']);}finally{app.close();}});\n`;
write('tests/upgrade.test.cjs',u);
// All remaining suites use the same extracted source and release stamps.
['browser','upgrade-browser','e2e','phase1','server','live-lab','audit-v42'].forEach(function(f){var p='tests/'+f+'.cjs',s=read(p);s=s.split('9.0.0.4').join('9.0.1.0').split('sdp-v60-').join('sdp-v61-').replace(/\.ver,60\b/g,'.ver,61').replace(/\.ver !== 60\b/g,'.ver !== 61').replace(/\.ver!==60\b/g,'.ver!==61').replace(/ver !== 60\b/g,'ver !== 61').replace(/ver!==60\b/g,'ver!==61');
s=s.split('data-v58-practice="flash"').join('data-practice="flash"').split('.v58-plan-chip').join('.sdp-plan-chip').split('v58NetworkPanel').join('sdpNetworkPanel').split('v58CachePanel').join('sdpCachePanel').split('v58ContextNextBtn').join('sdpContextNextBtn').split('v58SelfCheck').join('selfCheck').split('v58-selfrow').join('selfrow').split('v58-selfbtns').join('selfbtns').split('v59-dict-card').join('sdp-word-card').split('v59-ipa').join('sdp-word-ipa').split('v59-pos').join('sdp-word-pos').split('v59-def').join('sdp-word-def').split('v59-ex').join('sdp-word-ex').split('v59-si-chip').join('sdp-si-chip').split('v59-si-text').join('sdp-si-text').split('data-v60-ready').join('data-v61-ready');
if(f==='phase1'){
 s=rep(s,"const current = fs.readFileSync(path.join(root, 'index.html'), 'utf8');","const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');\nconst enginePath=path.join(root,'data/app-core.js');const engineSource=fs.existsSync(enginePath)?fs.readFileSync(enginePath,'utf8'):'';const current=indexSource+'\\n'+engineSource;");
 s=rep(s,"const inline=html.match", "const inline=html.match");
 s=s.replace("function harness(html = current, opts = {}) {","function harness(html = indexSource, opts = {}) {");
 s=rep(s,"let script = Array.from(w.document.scripts).find(n => !n.type && n.textContent.includes('var APP_VERSION')).textContent;","let script = html===indexSource && engineSource ? engineSource : Array.from(w.document.scripts).find(n => !n.type && n.textContent.includes('var APP_VERSION')).textContent;");
 s=s.replace("assert(current.includes('var APP_VERSION'),'the inline application remains present after comments are stripped');","assert(engineSource.includes('var APP_VERSION'),'the extracted application ships');");
 s=s.replace("assert(Buffer.byteLength(current)<598000)","assert(Buffer.byteLength(indexSource)<=110000);assert(Buffer.byteLength(engineSource)<=420000)");
 s=s.replace("a.q.Eng.start({});assert.equal(a.q.Eng.layer,null);clickText(a,\"I'm ready\");","a.q.Eng.start({});assert.ok(a.q.Eng.layer);");
 s=s.replace("assert(a.w.document.querySelector('#homeSessions').children.length>0);","assert(a.w.document.querySelector('#sdpHomeStatsRow').children.length>0);");
 s=s.replace("assert(txt.includes('My data'));","assert(txt.includes('My data'));");
 }
if(f==='server'){s=s.replace("const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');","const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8')+'\\n'+(fs.existsSync(require('path').join(__dirname,'../data/app-core.js'))?fs.readFileSync(require('path').join(__dirname,'../data/app-core.js'),'utf8'):'');");s=s.replace("html.length < 600000","Buffer.byteLength(fs.readFileSync(require('path').join(__dirname,'../index.html'))) <= 110000");}
if(f==='e2e'||f==='browser'||f==='upgrade-browser'){s=s.replace("const b = document.getElementById('btnAdmin'); if (b) b.click();", "const a = document.getElementById('sdpAppearanceAccordion'); if (a) a.open=true; const b = document.getElementById('btnAdmin'); if (b) b.click();");}
write(p,s);});
// The new probes use a real browser, no pre-mount waiting, and exact DOM contracts.
var probes=read('.work/v61/v61-browser-probes.txt');var ub=read('tests/upgrade-browser.cjs');ub=rep(ub,'  await browser.close(); await new Promise(r => server.close(r));',probes+'\n  await browser.close(); await new Promise(r => server.close(r));');write('tests/upgrade-browser.cjs',ub);
console.log('P1 gates rewritten; existing PIN, vault, meter, publishing and learning tests retained.');
