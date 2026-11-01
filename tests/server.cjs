const DEFAULT_PIN = require('./test-pin.cjs');
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),acorn=require('acorn');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
/* v46: the Apps Script source lives next to the page (data/gas-source.txt) and
   is fetched only when a lecturer unlocks admin, so the QA reads the file. */
const inline=html.match(/<script type="text\/plain" id="gas-source">([\s\S]*?)<\/script>/)[1];
const source=inline.trim()?inline:fs.readFileSync(require('path').join(__dirname,'../data/gas-source.txt'),'utf8');
const tables={},cache={},properties={ADMIN_PIN:DEFAULT_PIN};
let now=Date.UTC(2026,9,13,12);
function sheet(name){if(tables[name])return tables[name];const rows=[];
 const s={getLastRow:()=>rows.length,getLastColumn:()=>Math.max(0,...rows.map(r=>r.length)),setFrozenRows(){},appendRow:r=>rows.push(r.slice()),deleteRow:r=>rows.splice(r-1,1),deleteRows:(r,n)=>rows.splice(r-1,n),getRange(r,c,n=1,m=1){return{getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>(rows[r+i-1]||[])[c+j-1]===undefined?'':rows[r+i-1][c+j-1]));},setValues(values){values.forEach((line,i)=>{if(!rows[r+i-1])rows[r+i-1]=[];line.forEach((v,j)=>rows[r+i-1][c+j-1]=v);});},setValue(v){if(!rows[r-1])rows[r-1]=[];rows[r-1][c-1]=v;}}},_rows:rows};tables[name]=s;return s;}
class DateMock extends Date {static now(){return now;}}
const context=vm.createContext({Date:DateMock,PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k]})},CacheService:{getScriptCache:()=>({get:k=>cache[k]&&cache[k].until>now?cache[k].value:null,put:(k,v,secs)=>{cache[k]={value:String(v),until:now+secs*1000};}})},SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>tables[n]||null,insertSheet:sheet})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{base64EncodeWebSafe:()=> 'mock-token',computeDigest:()=>[],DigestAlgorithm:{SHA_256:'SHA_256'}}});
vm.runInContext(source,context);
const results=[];
function test(name,fn){try{fn();results.push({test:name,status:'PASS'});}catch(e){results.push({test:name,status:'FAIL',detail:e.stack});}}
function post(body){return context.handlePost({postData:{contents:JSON.stringify(body)}});}
test('Apps Script ES2017 syntax',()=>acorn.parse(source,{ecmaVersion:2017}));
test('Server rejects unauthenticated publish/inbox/moderation; public reads exclude inbox',()=>{
 assert.equal(post(null).err,'unauthorised');assert.equal(post([]).err,'unauthorised');
 for(const action of ['publish','readInbox','moderate','inbox','announce'])assert.equal(post({action}).err,'unauthorised');
 const state=context.handleGet({parameter:{action:'state'}});assert(!state.inbox);assert(!context.handleGet({parameter:{action:'comments'}}).inbox);
});
test('Server PIN: correct PIN succeeds, five wrong tries lock for five minutes',()=>{
 assert(post({action:'login',pin:DEFAULT_PIN}).ok);for(let i=0;i<5;i++)assert(!post({action:'login',pin:'0000'}).ok);
 assert.equal(post({action:'login',pin:DEFAULT_PIN}).err,'locked');now+=300001;assert(post({action:'login',pin:DEFAULT_PIN}).ok);
});
test('Server 1200-word list stores multiple cells under 40K, reads all words/version/plan/session',()=>{
 const words=Array.from({length:1200},(_,i)=>({w:'word'+i,s:'This is a useful sentence for the class today.',m:'a useful word'}));
 const result=post({action:'publish',pin:DEFAULT_PIN,listId:'qa-list',name:'QA class',words,session:{no:'42',day:'Saturday',date:'2026-10-17',title:'Class test',ready:['Ready?'],praise:['Well done']},contact:{whatsapp:'441234567890',email:'teacher@example.test'},defaults:{pauseWord:2},plan:[{key:'w5',listId:'qa-list'},{key:'default',listId:'qa-list'}]});assert(result.ok);
 for(const r of tables.Lists._rows.slice(1))assert(r[2].length<40000);
 delete cache.state;const state=context.readState();assert.equal(state.lists[0].words.length,1200);assert.equal(state.session.no,'42');assert.equal(state.session.ready[0],'Ready?');assert.equal(state.contact.email,'teacher@example.test');assert.equal(state.defaults.pauseWord,2);
 const result2=post({action:'publish',pin:DEFAULT_PIN,listId:'qa-list',name:'QA class v2',words:words.slice(0,30)});assert.equal(result2.version,2);delete cache.state;assert.equal(context.readState().lists[0].words.length,30);
});
test('Server comments sanitize links/digits/formulas and stable retry ids do not duplicate',()=>{
 const body={action:'comment',cid:'comment-unique-id',deviceId:'qa-device',name:'=IMPORTXML()',status:'problem',text:'Hello https://spam.test 07123456789',meta:'Session 42 · Saturday'};
 const r=post(body);assert(r.ok);const retry=post(body);assert(retry.ok&&retry.dup);assert.equal(tables.Comments._rows.length,2);assert(tables.Comments._rows[1][2].startsWith("'="));assert(!tables.Comments._rows[1][4].includes('spam.test'));assert(!tables.Comments._rows[1][4].includes('07123456789'));
});
test('Server message stays private; authorised inbox read/reply/mark read/delete work',()=>{
 const r=post({action:'message',cid:'message-unique-id',deviceId:'qa-device-two',name:'Happy Owl',text:'Private QA message',cat:'Question'});assert(r.ok);
 assert(!JSON.stringify(context.readState()).includes('Private QA message'));assert(!JSON.stringify(context.readComments(true)).includes('Private QA message'));
 assert(post({action:'inbox',pin:DEFAULT_PIN,op:'reply',id:r.id,text:'Private reply'}).ok);const inbox=post({action:'readInbox',pin:DEFAULT_PIN}).inbox;assert.equal(inbox[0].reply,'Private reply');
 assert(post({action:'inbox',pin:DEFAULT_PIN,op:'read',id:r.id}).ok);assert(post({action:'readInbox',pin:DEFAULT_PIN}).inbox[0].read);assert(post({action:'inbox',pin:DEFAULT_PIN,op:'delete',id:r.id}).ok);assert.equal(post({action:'readInbox',pin:DEFAULT_PIN}).inbox.length,0);
});
test('Server failed multi-cell publish leaves committed words/version intact and can retry',()=>{
 const table=tables.Lists,original=table.appendRow;let count=0;
 table.appendRow=function(row){count++;if(count===2)throw Error('Simulated Google quota failure');return original(row);};
 const words=Array.from({length:1200},(_,i)=>({w:'safe'+i,s:'This is a useful sentence for our class to practise today.',m:'a useful word'}));
 assert.throws(()=>post({action:'publish',pin:DEFAULT_PIN,listId:'qa-list',name:'Failed version',words}),/quota/);
 table.appendRow=original;delete cache.state;let state=context.readState();assert.equal(state.lists[0].words.length,30);assert.equal(state.lists[0].version,2);
 assert(post({action:'publish',pin:DEFAULT_PIN,listId:'qa-list',name:'Retry',words}).ok);delete cache.state;state=context.readState();assert.equal(state.lists[0].words.length,1200);assert.equal(state.lists[0].version,3);
});

test('v58 release metadata: public JSON is secret-free, GitHub-only studio and AES-GCM v2 runtime ship together',()=>{
 const read=f=>JSON.parse(fs.readFileSync(require('path').join(__dirname,'..',f),'utf8'));
 for(const f of ['data/version.json','data/config.json','data/session.json','data/elevenlabs-audio.json']){const d=read(f);assert.equal(d.ver,60,f);assert.equal(d.appVersion,'9.0.0.2',f);assert.ok(d.adminPin===undefined||d.adminPin==='',f);assert.ok(!d.vaultCiphertext,f+' no public vault');assert.ok(!d.keysTopic&&!d.wordsTopic&&!d.audioTopic,f+' no relays');}
 const vault=read('data/elevenlabs-audio.json');assert.equal(vault.voiceId,'Xb7hH8MSUJpSbSDYk0k2');assert.equal(vault.modelId,'eleven_flash_v2_5');assert.equal(vault.strictAdminOnly,true);assert.equal(typeof vault.clips,'object');
 const studio=fs.readFileSync(require('path').join(__dirname,'..','data','studio.js'),'utf8');
 assert.ok(html.includes('sdp.v57_secure_local'));assert.ok(html.includes('APP_VERSION="9.0.0.2"'));assert.ok(html.includes('data/studio.js?v=9.0.0.2'));assert.ok(html.includes('window.EncryptedVault'));assert.ok(html.includes('SDP_ENC_V2:'));
 assert.ok(!/dictationb1_sdp_(keys|words|audio)_v[0-9]+/.test(html),'index has no vault/audio relays');
 assert.ok(!/dictationb1_sdp_(keys|words|audio)_v[0-9]+/.test(studio),'studio has no vault/audio relays');
 assert.ok(studio.includes('sdp_elevenlabs_vault_v1'));assert.ok(studio.includes('api.elevenlabs.io/v1/text-to-speech'));
 assert.ok(studio.includes('adminGenerateMissing'));assert.ok(studio.includes('Cloud.commitFiles'));assert.ok(studio.includes('window.GitHubSync'));assert.ok(studio.includes('window.UniversalSync'));assert.ok(studio.includes('playOrFetchOnce'));assert.ok(studio.includes('isUnlockedOnThisDevice'));
 assert.ok(html.length < 600000, 'index.html stays under the published byte ceiling');
});
console.log(JSON.stringify(results,null,2));if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
