'use strict';
/* v61 release contract: one static UI, one extracted engine, no wrapper layers. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),acorn=require('acorn');
const ROOT=path.resolve(__dirname,'..');fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
function read(f){return fs.readFileSync(path.join(ROOT,f),'utf8');}
function es5(src,label){acorn.parse(src,{ecmaVersion:5});new Function(src);if(!/^\s*['"]use strict['"];/.test(src))throw Error(label+' lacks strict directive');}
function parseES5(f,label){const s=read(f);es5(s,label);fs.writeFileSync(path.join(__dirname,'artifacts',label+'.js'),s);cp.execFileSync(process.execPath,['--check',path.join(__dirname,'artifacts',label+'.js')],{stdio:'inherit'});return s;}
function budget(f,max){const n=Buffer.byteLength(read(f));if(n>max)throw Error(f+' '+n+' > '+max);console.log(f+': '+n+' / '+max+' bytes');}
const INDEX=read('index.html');budget('index.html',110000);
const CORE=fs.existsSync(path.join(ROOT,'data/app-core.js'))?parseES5('data/app-core.js','app-core'):'';
const APP_SRC=INDEX+'\n'+CORE;
const learn=parseES5('data/learning-tools.js','learning-tools');budget('data/learning-tools.js',120000);
const studio=parseES5('data/studio.js','studio');budget('data/studio.js',110000);
const meterSrc=parseES5('data/data-meter.js','meter');const sw=parseES5('sw.js','sw');
for(const f of ['data.html','data/index.html']){budget(f,60000);const h=read(f);for(const m of h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){if(!/src=/.test(m[1])&&m[2].trim())acorn.parse(m[2],{ecmaVersion:5});}}
if(read('data.html')!==read('data/index.html'))throw Error('transparency routes differ');
const boot=/<script id="sdpSwBoot">([\s\S]*?)<\/script>/.exec(INDEX);if(!boot)throw Error('missing sdpSwBoot');es5(boot[1],'sdpSwBoot');
/* Secret/PIN gate: every shipped file, every test, and the rest of the repo. */
const SCAN_FILES = [
  'README.md', 'CHANGELOG.md', 'index.html', 'data.html', 'data/index.html',
  'data/app-core.js', 'data/studio.js', 'data/data-meter.js', 'data/learning-tools.js', 'sw.js',
  'data/config.json', 'data/session.json', 'data/version.json',
  'data/elevenlabs-audio.json', 'data/media-manifest.json', 'tests/test-pin.cjs'
];
const COMPROMISED_PIN = ['78', '98', '78', '98'].join('');
const COMPROMISED_HASH = ['17842399970b3f0f', 'a32f82c833a22477', 'd03223dfd6317d10', '31c123ab6ea38250'].join('');
function scanFile(rel) {
  const s = read(rel);
  if (s.includes(COMPROMISED_PIN)) throw Error(rel + ' contains the compromised default PIN');
  if (s.includes(COMPROMISED_HASH)) throw Error(rel + ' contains the seeded default PIN hash');
  if (/"adminPin"\s*:\s*"[^"]+"/.test(s)) throw Error(rel + ' contains a non-empty adminPin JSON literal');
  if (/(?:sk_|ghp_)[A-Za-z0-9_-]{16,}/.test(s)) throw Error(rel + ' contains a live-looking token literal');
}
SCAN_FILES.forEach(scanFile);
const tracked = cp.execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
tracked.filter(f => /\.(?:html|js|cjs|json|md|webmanifest|txt)$/i.test(f)).forEach(scanFile);
for (const f of ['data/config.json', 'data/session.json', 'data/version.json', 'data/elevenlabs-audio.json']) {
  const d = JSON.parse(read(f));
  if (d.adminPin || d.vaultCiphertext || d.keysTopic || d.wordsTopic || d.audioTopic) throw Error(f + ' still ships a PIN/vault/relay field');
}

/* Architecture replaces, rather than supplements, the old UI. */
const legacy=['sdpV57Css','sdpV58Css','sdpLearnCss','sdpV59Css','sdpDataSheetCss','sdpNextGenCss','v604All','v604SweepTopbar','v604Keeper','sdpLegacyPlayerDock','sdpPrePaintCloak','data-v60-legacy','data-v58-en','data-v58-si','v58-sig-pill','v58-tile','v59-dict-card'];
for(const f of ['index.html','data/app-core.js','data/learning-tools.js']){const s=read(f);for(const m of legacy)if(s.includes(m))throw Error('LEGACY_ABSENT '+f+': '+m);if(/createElement\(['"]style['"]\)/.test(s))throw Error('runtime CSS injection: '+f);}
const UI_SRC=APP_SRC+'\n'+learn;
for(const m of ['id="sdpCss"','data-v61-ready','sdpWordFilterRow','sdp-word-card','sdpCockpitCard','sdpEdgeBar','sdpTimerPill','sdpCockpitDock','sdpWordMapCard','sdpNextGenSettings','sdpAppearanceAccordion','guideSheet','creditFoot','creditDocked','levenshteinOps','markMissed','markCorrect','v58SelfScore','resSummary','audio/mp4','Play my recording','offlineReadyCount'])if(!UI_SRC.includes(m))throw Error('V61_PRESENT: '+m);
if((INDEX.match(/<style\b/g)||[]).length!==1)throw Error('exactly one static stylesheet required');
if(!/#creditDocked\{[^}]*position:static/.test(INDEX))throw Error('credit must be static');
if(!/typeof e==="string"/.test(CORE)||!/typeof items==="string"/.test(CORE))throw Error('Speech string-to-array guard missing');
for(const id of ['app','sdpBrandCluster','brandName','brandSub','sdpTopActions','sdpTopVoiceBtn','sdpTopLangPill','btnLang','btnGuideTop','btnOpenSettingsTop','chipNet','tabbar','tab-home','tab-dict','tab-comm','tab-set','screen-home','homeAnn','homeResume','sdpHomeGreeting','homeHero','homeKicker','homeTitle','homeSub','sdpHeroConfigChips','btnStart','btnStartText','btnGuide','sdpHomeStatsRow','sdpQuickPracticeGrid','screen-dict','dictSearch','sdpWordFilterRow','dictList','screen-comm','screen-practice','btnCompose','screen-set','sdpNextGenSettings','setBody','sdpAppearanceAccordion','layers','sheets','modals','toasts','dataSheet','guideSheet','ttsMasterAudio'])if(!UI_SRC.includes(id))throw Error('protected identifier: '+id);
if(!/\.\/data\/app-core\.js/.test(sw)||!/\.\/data\/learning-tools\.js/.test(sw))throw Error('modules missing from SHELL');
if(/guide-si-[1-6]\.mp3/.test(sw)||/guide-si-[1-6]\.mp3/.test(learn))throw Error('fake guide stubs must not ship');
if(!/sdp-youdao-v1/.test(sw)||!/sdp-youdao-v1/.test(learn))throw Error('audio cache key missing');
if(!/NotoSansSinhala-Regular\.woff2/.test(INDEX)||!/NotoSansSinhala-Bold\.woff2/.test(INDEX))throw Error('local Sinhala fonts missing');
for(const f of ['assets/fonts/NotoSansSinhala-Regular.woff2','assets/fonts/NotoSansSinhala-Bold.woff2']){const b=fs.readFileSync(path.join(ROOT,f));if(b.length>60000||b.slice(0,4).toString()!=='wOF2')throw Error('invalid font '+f);}
if(!/window\.ElevenVault\s*=/.test(studio)||!/adminGenerateMissing/.test(studio)||!/strictAdminOnly/.test(studio)||!/fetchOnce:function/.test(studio.replace(/\s/g,'')))throw Error('vault security API missing');
if(!/SDPDataMeter\s*=/.test(meterSrc)||!/SDP_DATA_METER\s*=/.test(meterSrc)||!/PerformanceObserver/.test(meterSrc)||!/transferSize/.test(meterSrc)||!/getModeProfiles/.test(meterSrc))throw Error('meter API missing');
if(!/caches\.match/.test(sw))throw Error('offline cache strategy missing');

for(const f of ['version.json','data/version.json','data/config.json','data/session.json','data/elevenlabs-audio.json','data/media-manifest.json']){const d=JSON.parse(read(f));if(d.ver!==61||d.version!=='9.0.1.0'||d.appVersion!=='9.0.1.0'||d.schema!==61||d.settingsRev!==61)throw Error('v61 metadata mismatch '+f);}
if(!APP_SRC.includes('APP_VERSION="9.0.1.0"')||!sw.includes("VERSION = 'sdp-v61-9.0.1.0'")||!sw.includes("APP_VERSION = '9.0.1.0'"))throw Error('runtime/SW stamp mismatch');
if(!/METER_VERSION = '9\.0\.1\.0', SCHEMA = 61/.test(meterSrc))throw Error('meter stamp mismatch');
if(!read('data.html').includes('v61 \u00b7 APP_VERSION 9.0.1.0'))throw Error('data headline mismatch');
const manifest=JSON.parse(read('manifest.webmanifest'));if(!manifest.name||manifest.display!=='standalone'||manifest.theme_color!=='#09090B')throw Error('manifest theme mismatch');
if(!/sdp\.v2:/.test(APP_SRC)||!/isUnlockedOnThisDevice/.test(APP_SRC)||!/iterations: ?250000/.test(APP_SRC)||!/SDP_ENC_V2/.test(APP_SRC))throw Error('PIN/PBKDF2/AES invariant missing');
if(/\.createMediaElementSource\s*\(/.test(APP_SRC+learn))throw Error('MediaElementSource is forbidden');
if(!/perf:"auto"/.test(APP_SRC)||!/perfChosenBy="user"/.test(APP_SRC))throw Error('performance defaults missing');
var wsBody=/Eng\.writeSecs=function\(\)\{([^}]*)\}/.exec(APP_SRC);if(!wsBody||!wsBody[1].includes('writeFixed')||!/Math\.max\(3,\s*Math\.min\(60/.test(wsBody[1]))throw Error('lecturer writing timer missing');
if(!/rows:t\.map\(function\(w\)\{return\{word:/.test(APP_SRC)||!/mode:"paper"/.test(APP_SRC))throw Error('paper result mapping missing');
if(!/encVault/.test(read('data/config.json'))||!/SDP_ENC_V2:/.test(read('data/config.json')))throw Error('encrypted config missing');
if(!/eleven_flash_v2_5/.test(studio)||!/eleven_flash_v2_5/.test(read('data/elevenlabs-audio.json')))throw Error('studio model missing');
if(/\.drawImage\s*\(|\.getImageData\s*\(/.test(learn))throw Error('canvas readback forbidden');
if(!/SDPPerfGuard/.test(learn)||!/benchmark:\s*function/.test(learn)||!/decide:\s*function/.test(learn))throw Error('performance guard missing');
if(!/sdp_offline_v60/.test(learn)||!/sdp\.v56_audit_verified/.test(APP_SRC+learn))throw Error('storage compatibility missing');
if(!/microToastLoad/.test(learn)||!/getEntriesByType\("navigation"\)/.test(learn))throw Error('honest transfer telemetry missing');
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
