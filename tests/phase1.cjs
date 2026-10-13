'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const vm = require('vm');
const assert = require('assert');
const {JSDOM, VirtualConsole} = require('jsdom');
const acorn = require('acorn');
const FakeTimers = require('@sinonjs/fake-timers');
const root = path.resolve(__dirname, '..');
const current = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const original = cp.execFileSync('git', ['show', '7577968:index.html'], {cwd: root, maxBuffer: 1000000}).toString();
const results = [];
function test(name, fn) {
  try { fn(); results.push({test: name, status: 'PASS'}); }
  catch (err) { results.push({test: name, status: 'FAIL', detail: err.stack}); }
}
function harness(html = current, opts = {}) {
  const errors = [], requests = [], spoken = [];
  const dom = new JSDOM(html, {url: 'https://example.test/' + (opts.hash || ''), runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole()});
  const w = dom.window;
  const clock = FakeTimers.withGlobal(w).install({now: Date.UTC(2026, 9, 13, 12), toFake: ['Date','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame']});
  w.scrollTo = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.matchMedia = () => ({matches: false, addEventListener() {}});
  w.XMLHttpRequest = class {
    open(method, url) { requests.push({method, url}); }
    setRequestHeader() {}
    send() { w.setTimeout(() => {this.status = 0; this.readyState = 4; if(this.onreadystatechange) this.onreadystatechange();}, 10); }
  };
  w.fetch = () => { requests.push({method: 'fetch'}); return Promise.reject(Error('offline')); };
  if(opts.raw !== undefined) w.localStorage.setItem('sdp.v1', opts.raw);
  if(opts.backup) w.localStorage.setItem('sdp.v1.bak', opts.backup);
  if(opts.cloud) w.localStorage.setItem('sdp.cloudurl', 'https://script.google.com/macros/s/unreachable/exec');
  if(opts.blocked) Object.defineProperty(w, 'localStorage', {get() {throw Error('Storage blocked');}});
  if(opts.offline) Object.defineProperty(w.navigator, 'onLine', {value: false});
  if(opts.navThrows) ['onLine','hardwareConcurrency','deviceMemory','wakeLock','userAgent','maxTouchPoints'].forEach(k => Object.defineProperty(w.navigator, k, {get() {throw Error('Restricted getter');}}));
  if(opts.speechThrows) Object.defineProperty(w, 'speechSynthesis', {get() {throw Error('Speech blocked');}});
  if(opts.voice) {
    w.SpeechSynthesisUtterance = function(text) {this.text = text;};
    w.speechSynthesis = {getVoices() {return [{lang:opts.voice, name:opts.voice==='en-GB'?'Daniel':'US voice',localService:true}];}, cancel() {}, speak(u) {spoken.push({text:u.text, lang:u.lang, voice:u.voice && u.voice.lang}); w.setTimeout(() => {if(u.onend) u.onend();}, 1);}, addEventListener() {}};
  }
  w.addEventListener('error', ev => errors.push(ev.message));
  let script = Array.from(w.document.scripts).find(n => !n.type && n.textContent.includes('var APP_VERSION')).textContent;
  script = script.replace('window.SDP = {', 'window.__qa = {U: U, UI: UI, DB: DB, Store: Store, Errors: typeof Errors === "undefined" ? null : Errors, DataTools: DataTools, Screens: Screens, Eng: Eng, Speech: Speech, Cloud: Cloud, Admin: Admin, Diag: Diag, Results: Results, Lib: Lib, Comm: Comm, Dict: Dict, Links: typeof Links === "undefined" ? null : Links, Sha: Sha, fatalCard: fatalCard};\nwindow.SDP = {');
  if(opts.bootFailure) script = script.replace('  Store.test();\n  DB.load();', '  throw new Error("Injected boot failure");\n  Store.test();\n  DB.load();');
  if(opts.renderFailure) script = script.replace('  home: function () {', '  home: function () { throw new Error("Injected render failure");');
  vm.runInContext(script, dom.getInternalVMContext());
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  clock.tick(100);
  if(w.__qa.DB.data) w.__qa.DB.data.tourSeen = true;
  return {w, q:w.__qa, clock, errors, requests, spoken, crash:() => w.document.querySelector('#fatal').dataset.shown==='1', close() {clock.uninstall(); dom.window.close();}};
}
function withApp(opts, fn, html) {const a=harness(html,opts);try{fn(a);}finally{a.close();}}
function clickText(a, text) {const b=Array.from(a.w.document.querySelectorAll('button')).find(n => n.textContent.trim()===text); assert(b, 'button: '+text); b.click(); return b;}

test('1.1 before: original Local-mode boot shows crash card', () => withApp({}, a => assert(a.crash()), original));
test('1.1 after: one-line hotfix alone removes boot crash', () => withApp({}, a => assert(!a.crash()), original.replace('chip.classList.add(Cloud.mode && online ? "good" : "");','if (Cloud.mode && online) chip.classList.add("good");')));
for(const [name, opts] of [
 ['empty storage', {}], ['corrupt JSON', {raw:'{broken'}], ['wrong JSON structure', {raw:'{"settings":3,"lists":{},"results":"broken"}'}],
 ['storage blocked', {blocked:true}], ['offline', {offline:true}], ['configured unreachable cloud', {cloud:true}],
 ['no speechSynthesis', {}], ['no en-GB voice', {voice:'en-US'}], ['restricted navigator getters', {navThrows:true}], ['throwing speech getter', {speechThrows:true}]
]) test('Boot: '+name, () => withApp(opts, a => {assert(!a.crash()); assert(a.q.DB.data); assert(a.w.document.querySelector('#homeTitle').textContent.length); assert.equal(a.errors.length,0);}));

test('1.1 all ten class call sites use guarded helper', () => withApp({}, a => {
 const el=a.w.document.createElement('div');
 for(const name of ['',undefined,null,'two tokens']) a.q.U.setCls(el,name,true);
 a.q.U.setCls(el,'good',true);assert.equal(el.className,'good');a.q.U.setCls(el,'good',false);assert.equal(el.className,'');
 assert.equal((current.match(/\.classList\.(add|remove)\(/g)||[]).length,2);
 assert(!/className\s*\+=/.test(current));
}));
test('1.2 after: late error and rejection do not show fatal card', () => withApp({}, a => {
 a.w.dispatchEvent(new a.w.ErrorEvent('error',{error:new Error('Button failed'),message:'Button failed'}));
 a.w.dispatchEvent(new a.w.CustomEvent('unhandledrejection',{detail:{}}));
 assert(!a.crash());assert.equal(a.q.Errors.items.length,2);
 assert(a.w.document.querySelector('#toasts').textContent.includes('Something small went wrong. Your data is safe.'));
 a.q.UI.setTab('set');assert(a.w.document.querySelector('#screen-set').textContent.includes('My data'));
}));
test('1.2 handler containment, 50-entry limit and Diagnostics', () => withApp({}, a => {
 const b=a.w.document.createElement('button');a.q.U.on(b,'click',()=>{throw Error('Widget failed');});b.click();
 for(let i=0;i<55;i++) a.q.Errors.report(Error('Test '+i),'QA');
 assert.equal(a.q.Errors.items.length,50);assert(!a.crash());a.q.Diag.open();
 assert(a.w.document.querySelector('#sheets').textContent.includes('Copy error log'));
}));
test('1.2 failed screen does not prevent Settings from rendering', () => withApp({renderFailure:true}, a => {assert(!a.crash());assert(a.q.Errors.items.length);a.q.UI.setTab('set');assert(a.w.document.querySelector('#screen-set').textContent.includes('My data'));}));
test('1.2 actual boot failure retains full card and recovery controls', () => withApp({bootFailure:true}, a => {
 assert(a.crash());for(const text of ['Continue anyway','Copy error details','Restore last automatic backup','Save backup / reset']) assert(a.w.document.querySelector('#fatal').textContent.includes(text));
 clickText(a,'Continue anyway');assert(!a.crash());assert(a.q.DB.data);
}));
test('1.3 before: emergency backup silently fails but deletes storage at 600ms', () => withApp({}, a => {
 a.q.DB.saveNow();assert(a.w.localStorage.getItem('sdp.v1'));clickText(a,'Download backup, then reset');a.clock.tick(650);assert.equal(a.w.localStorage.getItem('sdp.v1'),null);
},original));
test('1.3 after: failed download and copy fallback never reset or reload', () => withApp({}, a => {
 a.q.DB.data.session.title='Keep this work';a.q.DB.saveNow();const saved=a.w.localStorage.getItem('sdp.v1');
 a.q.DataTools.reset();clickText(a,'Download');a.clock.tick(2000);assert.equal(a.w.localStorage.getItem('sdp.v1'),saved);
 assert(a.w.document.querySelector('#sheets textarea').value.includes('Keep this work'));
 assert(!a.w.document.querySelector('#resetConfirm'));
}));
test('1.3 second confirmation requires BOTH tick and exact RESET', () => withApp({}, a => {
 a.q.Admin.unlocked=true;a.q.DB.data.session.title='Keep until confirmed';a.q.DB.saveNow();a.q.DataTools.reset();clickText(a,'Next: confirm reset');
 const d=a.w.document, tick=d.querySelector('#resetSaved'),typed=d.querySelector('#resetTyped'),confirm=d.querySelector('#resetConfirm');
 assert(confirm.disabled);typed.value='RESET';typed.dispatchEvent(new a.w.Event('input'));assert(confirm.disabled);
 tick.checked=true;tick.dispatchEvent(new a.w.Event('change'));assert(!confirm.disabled);
 typed.value='reset';typed.dispatchEvent(new a.w.Event('input'));assert(confirm.disabled);
 typed.value='RESET';typed.dispatchEvent(new a.w.Event('input'));confirm.click();assert.equal(a.q.DB.data.session.title,'');
 assert(a.w.localStorage.getItem('sdp.v1.beforeReset').includes('Keep until confirmed'));
 assert(a.w.localStorage.getItem('sdp.v1.bak').includes('Keep until confirmed'));
}));
test('1.3 result saves and lecturer changes update rolling backup', () => withApp({}, a => {
 a.q.DB.data.session.title='Lecturer update';a.q.DB.save();a.clock.tick(150);
 assert(a.w.localStorage.getItem('sdp.v1.bak').includes('Lecturer update'));
 a.q.DB.data.results.push({id:'qa-result',score:30});a.q.DB.saveNow();
 assert.equal(a.w.localStorage.getItem('sdp.v1'),a.w.localStorage.getItem('sdp.v1.bak'));
}));
test('1.3 corrupt primary restores automatic copy and retains corrupt text', () => {
 let backup;withApp({}, a => {a.q.DB.data.session.title='Recovery data';a.q.DB.saveNow();backup=a.w.localStorage.getItem('sdp.v1.bak');});
 withApp({raw:'{corrupt',backup}, a => {assert.equal(a.q.DB.data.session.title,'Recovery data');assert.equal(a.w.localStorage.getItem('sdp.v1.recovery'),'{corrupt');});
});
test('1.3 pending save flushed on pagehide', () => withApp({}, a => {a.q.DB.data.session.title='Leaving';a.q.DB.save();a.w.dispatchEvent(new a.w.Event('pagehide'));assert(a.w.localStorage.getItem('sdp.v1').includes('Leaving'));}));
test('1.4 flex fatal card uses scale-only animation; confirm keeps translate', () => withApp({bootFailure:true}, a => {
 assert(a.w.document.querySelector('#fatal .modal').classList.contains('flex-card'));
 const keyframe=current.match(/@keyframes pop-flex\s*\{[^\n]+/)[0];assert(!keyframe.includes('translate'));assert(current.includes('@keyframes pop {'));
}));
test('1.5 injected script removed, gas-source retained, 20 sections kept', () => {
 assert(!/__CF\$|cdn-cgi|challenge-platform/.test(current));
 const gas=s=>s.match(/<script type="text\/plain" id="gas-source">([\s\S]*?)<\/script>/)[1];assert(gas(current).includes("function handlePost(e)")); assert(gas(current).includes("function adminOk(body)"));
 const sections=Array.from(current.matchAll(/SECTION (\d+) -/g)).map(m=>Number(m[1]));assert.deepEqual(sections,Array.from({length:20},(_,i)=>i+1));
});
test('1.5 zero network requests on load, including configured cloud', () => withApp({cloud:true}, a => {a.clock.tick(10000);assert.equal(a.requests.length,0);a.w.document.querySelector('#btnRefresh').click();a.clock.tick(100);assert(a.requests.length>0);assert(!a.crash());}));
test('1.6 invalid dates and malformed backup import are guarded', () => withApp({}, a => {
 assert(!a.q.U.fmtDate(new a.w.Date('invalid')).includes('NaN'));assert(!a.q.U.fmtTime(new a.w.Date('invalid')).includes('NaN'));
 for(const text of ['null','[]','{"lists":{}}','{bad']) assert.equal(a.q.DB.importAll(text).ok,false);
}));
test('1.6 user strings remain literal text, not executable HTML', () => withApp({}, a => {
 const attack='<img src=x onerror="window.pwned=1">';a.q.DB.data.lists[0].name=attack;a.q.DB.data.lists[0].publishedName=attack;a.q.DB.data.announcement={title:attack,text:attack};a.q.Screens.home();
 assert(a.w.document.querySelector('#homeTitle').textContent.includes(attack));assert(!a.w.document.querySelector('#homeAnn img'));assert(!a.w.pwned);
 assert(!/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(current));
}));
test('Static: node --check, ES2017 parser, no eval, under 450KB', () => {
 const d=new JSDOM(current);const script=Array.from(d.window.document.scripts).find(n=>!n.type&&n.textContent.includes('var APP_VERSION')).textContent;
 const file=path.join(require('os').tmpdir(),'sdp-check.js');fs.writeFileSync(file,script);cp.execFileSync(process.execPath,['--check',file]);fs.unlinkSync(file);
 acorn.parse(script,{ecmaVersion:2017});assert(!/\beval\s*\(|new\s+Function\s*\(/.test(script));assert(Buffer.byteLength(current)<450000);d.window.close();
});
function enterPin(a, pin) {
  a.q.Admin.open(); for(const digit of pin) a.w.document.querySelector('#pinPad [data-k="'+digit+'"]').click(); a.w.document.querySelector('#pinSubmit').click();
}
test('2.1 seeded salted PIN unlocks; existing changed PIN survives migration', () => withApp({}, a => {
 assert(a.q.DB.data.admin.pinSalt);assert.equal(a.q.DB.data.admin.pinHash,require('crypto').createHash('sha256').update('sdp.v1:'+a.q.DB.data.admin.pinSalt+':7898').digest('hex'));assert.equal(a.q.DB.data.admin.pinHash,a.q.Sha.hex('sdp.v1:'+a.q.DB.data.admin.pinSalt+':7898'));
 enterPin(a,'7898');assert(a.q.Admin.unlocked);assert(a.w.document.querySelector('#adminHost'));assert(!a.w.document.querySelector('#adminHost').textContent.includes('7898'));
 a.q.DB.data.admin.pinHash='changed';a.q.DB.saveNow();const data=JSON.parse(a.w.localStorage.getItem('sdp.v1'));assert.equal(a.q.DB.migrate(data).admin.pinHash,'changed');
}));
test('2.1 five wrong PINs cause five-minute lockout; 8-digit PIN is usable', () => withApp({}, a => {
 for(let i=0;i<5;i++) enterPin(a,'0000');assert(!a.q.Admin.unlocked);assert(a.q.DB.data.admin.lockUntil>a.clock.now);assert.equal(a.q.DB.data.admin.lockUntil-a.clock.now,300000);
 a.clock.tick(300001);a.q.DB.data.admin.pinHash=a.q.Sha.hex('sdp.v1:'+a.q.DB.data.admin.pinSalt+':12345678');enterPin(a,'12345678');assert(a.q.Admin.unlocked);
}));
test('2.1 #lecturer and direct render/edit methods reveal nothing without PIN', () => withApp({hash:'#lecturer'}, a => {
 a.clock.tick(400);assert(!a.q.Admin.unlocked);assert(!a.w.document.querySelector('#adminHost'));assert(a.w.document.querySelector('#pinPad'));
 const words=a.q.DB.data.lists[0].words.length;a.q.Admin.publish(a.q.DB.data.lists[0]);a.q.Admin.panel();assert(!a.w.document.querySelector('#adminHost'));assert.equal(a.q.DB.data.lists[0].words.length,words);
}));
test('2.1 detached editing handlers and delayed list rows cannot edit after Lock now', () => withApp({}, a => {
 enterPin(a,'7898');const button=Array.from(a.w.document.querySelectorAll('#adminHost button')).find(n=>n.textContent.includes('Duplicate list'));assert(button);
 const count=a.q.DB.data.lists.length;a.q.Admin.lock();button.click();a.clock.tick(300);assert.equal(a.q.DB.data.lists.length,count);assert(!a.q.Admin.unlocked);
}));
test('2.2 paste handles 120 words, pipes, tabs, CSV quotes and warnings', () => withApp({}, a => {
 const lines=Array.from({length:120},(_,i)=>'word'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26)+' | This is a short example sentence for our class today. | meaning');
 assert.equal(a.q.Admin.parseWords(lines.join('\n')).items.length,120);
 const r=a.q.Admin.parseWords('colour\tI like this colour very much today.\ta shade\n"neighbour","Our neighbour, Pat, has a friendly dog today.","nearby person"\ncolor\ncolour\n\n'+ 'a'.repeat(41));
 assert.equal(r.items[1].s,'Our neighbour, Pat, has a friendly dog today.');assert.equal(r.dupes,1);assert(r.problems.some(x=>x.includes('American')));assert(r.problems.some(x=>x.includes('blank')));assert(r.problems.some(x=>x.includes('longer')));
}));
test('2.2 30-word Saturday assignment, draft isolation and eight-week planner', () => withApp({}, a => {
 enterPin(a,'7898');const list=a.q.DB.data.lists[0];list.name='Saturday class';list.words[0]={w:'Saturdayword',s:'This is a new sentence for our Saturday class.',m:''};list.draft=true;
 assert.notEqual(a.q.Lib.current().words[0].w,'Saturdayword');a.q.DB.data.plan.weekdays[5]=list.id;a.q.Admin.publish(list);
 a.clock.setSystemTime(Date.UTC(2026,9,17,12));a.q.Screens.home();assert.equal(a.q.Lib.current().words.length,30);assert.equal(a.q.Lib.current().words[0].w,'Saturdayword');assert(a.w.document.querySelector('#homeTitle').textContent.includes('Saturday class'));
 assert(a.w.document.querySelector('#adminHost').textContent.includes('Next 8 weeks'));assert(a.w.document.querySelectorAll('#adminHost table').length>=2);
}));
test('2.2 cloud list update stays queued throughout active session', () => withApp({voice:'en-GB'}, a => {
 const list=a.q.Lib.current();a.q.Eng.start({});assert.equal(a.q.Eng.st,'ready');
 a.q.Cloud.applyState({lists:[{id:list.id,name:'New version',version:10,words:[{w:'newword',s:'',m:''}]}]});
 assert(a.q.Cloud.pendingState);assert.equal(a.q.Eng.words.length,30);a.q.Eng.stop(true);assert(!a.q.Cloud.pendingState);assert.equal(a.q.Lib.current().words.length,1);
}));
test('2.3 session typing/day chips update Home, player and comment metadata', () => withApp({voice:'en-GB'}, a => {
 enterPin(a,'7898');a.q.Admin.tab='session';a.q.Admin.renderTab();const no=a.w.document.querySelector('[aria-label="Session number"]');no.value='42';no.dispatchEvent(new a.w.Event('input'));
 clickText(a,'Sun');assert.equal(a.q.DB.data.session.day,'Sunday');assert(a.w.document.querySelector('#homeKicker').textContent.includes('42'));assert(a.q.Comm.meta().includes('Sunday'));
 a.q.Eng.start({});assert(a.q.Eng.layer.textContent.includes('Session 42'));assert(a.q.Eng.layer.textContent.includes('Sunday'));
}));
test('2.4 private message is absent from public comments, visible only in unlocked inbox', () => withApp({}, a => {
 a.q.Comm.message();a.w.document.querySelector('#sheets textarea').value='Private QA message';clickText(a,'Send to lecturer');assert.equal(a.q.DB.data.inbox.length,1);assert.equal(a.q.DB.data.comments.length,0);assert(!a.w.document.querySelector('#commList').textContent.includes('Private QA message'));
 enterPin(a,'7898');a.q.Admin.tab='announce';a.q.Admin.renderTab();assert(a.w.document.querySelector('#adminHost').textContent.includes('Private QA message'));assert(a.w.document.querySelector('#adminHost').textContent.includes('Reply'));
}));
test('2.5 all four anonymous comment statuses persist with safe text and session metadata', () => withApp({}, a => {
 for(const status of ['finished','problem','notdone','comment']) {
  a.q.Comm.composer(status);a.w.document.querySelector('#sheets textarea').value='Hello https://spam.test 07123456789';
  const send=Array.from(a.w.document.querySelectorAll('#sheets button')).find(b=>b.textContent.includes('Post'));assert(send);send.click();a.clock.tick(31000);
 }
 assert.equal(a.q.DB.data.comments.length,4);assert.equal(new Set(a.q.DB.data.comments.map(c=>c.status)).size,4);
 assert(a.q.DB.data.comments.every(c=>!c.text.includes('spam.test')&&!c.text.includes('07123456789')&&c.meta.includes('Session')));
}));
test('3.1 setup wizard has four cards, saved URL and red/green response', () => withApp({}, a => {
 enterPin(a,'7898');a.q.Admin.tab='tools';a.q.Admin.renderTab();const host=a.w.document.querySelector('#adminHost');assert(host.textContent.includes('1. Copy the script'));assert(host.textContent.includes('4. Test connection'));
 const input=a.w.document.querySelector('[aria-label="Google Apps Script web app link"]');input.value='https://script.google.com/macros/s/validscriptid/exec';clickText(a,'Save link');assert(a.w.localStorage.getItem('sdp.cloudurl'));
 a.q.Cloud.ping=cb=>cb({ok:false});clickText(a,'Test connection');assert(host.textContent.includes('Could not connect'));
 a.q.Cloud.ping=cb=>cb({ok:true});clickText(a,'Test connection');assert(host.textContent.includes('Connected. Your Google Sheet answered.'));
}));
test('3.2 student hash connects automatically and is cleared without load requests', () => withApp({hash:'#cloud=validscriptid'}, a => {
 assert(a.q.Cloud.mode);assert.equal(a.w.location.hash,'');assert.equal(a.requests.length,0);assert(a.w.localStorage.getItem('sdp.cloudurl').includes('validscriptid'));
}));
test('3.3 Unicode link round-trip, explicit preview/Add and split-part assembly', () => {
 let links;withApp({}, a => {a.q.DB.data.announcement={title:'Class notice',text:'Café practice'};links=a.q.Links.listLinks(a.q.Lib.current());assert(links.length>1);assert(links.every(l=>l.length<=2000));const item=a.q.Links.decode(links[0].split('#list=')[1]);assert.equal(item.a.text,'Café practice');});
 let saved;for(const link of links) withApp({hash:'#'+link.split('#')[1],raw:saved}, a => {
  a.clock.tick(150);assert(a.w.document.querySelector('#sheets').textContent.includes('Add shared list?'));assert.equal(a.w.location.hash,'');assert.equal(a.q.DB.data.lists.length,1);clickText(a,'Add');saved=a.w.localStorage.getItem('sdp.v1');
 });withApp({raw:saved}, a => {assert.equal(a.q.Lib.current().words.length,30);assert(a.q.Lib.current().id.startsWith('shared_'));assert.equal(a.q.DB.data.announcement.text,'Café practice');});
});
test('3.3 malformed linked data is rejected without a fatal card or list changes', () => withApp({hash:'#list=bad!!'}, a => {a.clock.tick(500);assert(!a.crash());assert.equal(a.q.DB.data.lists.length,1);}));
test('3.4 no-cloud contact offers explicit WhatsApp/Email/Share, private content not public', () => withApp({}, a => {
 a.q.DB.data.lecturerContact={email:'lecturer@example.test',whatsapp:'441234567890'};a.q.Links.contact('Private message');const d=a.w.document;
 assert(d.querySelector('#sheets a[href^="https://wa.me/441234567890"]'));assert(d.querySelector('#sheets a[href^="mailto:lecturer@example.test"]'));assert(d.querySelector('#sheets').textContent.includes('Share sheet'));assert(!d.querySelector('#commList').textContent.includes('Private message'));
}));
test('3.5 outbox auth uses memory-only PIN, skips locked admin items and flushes student items', () => withApp({}, a => {
 a.q.Cloud.mode=true;a.q.Cloud.url='https://script.google.com/macros/s/validscriptid/exec';a.q.DB.data.outbox=[{action:'publish',cid:'admin-job'},{action:'comment',cid:'student-job'}];
 const requests=[];a.q.Cloud.post=(body,cb)=>{requests.push(body);cb({ok:true,id:'server-comment'});};a.q.Cloud.flush();a.clock.tick(300);assert.equal(requests.length,1);assert.equal(requests[0].action,'comment');assert.equal(a.q.DB.data.outbox.length,1);
 a.q.Admin.unlocked=true;a.q.Admin.pin='7898';a.q.Cloud.flush();a.clock.tick(300);assert.equal(requests[1].pin,'7898');assert.equal(a.q.DB.data.outbox.length,0);assert(!a.w.localStorage.getItem('sdp.v1').includes('"pin":"7898"'));
}));
test('3.5 sync time advances only after successful state reply', () => withApp({cloud:true}, a => {
 assert.equal(a.q.Cloud.updatedAt,0);a.q.Cloud.get=(params,cb)=>cb({ok:false});a.q.Cloud.pullState();assert.equal(a.q.Cloud.updatedAt,0);
 a.q.Cloud.get=(params,cb)=>cb({ok:true,ver:10});a.q.Cloud.pullState();assert(a.q.Cloud.updatedAt);a.q.UI.renderNet();assert(a.w.document.querySelector('#chipNetText').textContent.includes('synced'));
}));
test('4.1 no UK voice never invokes speech, Text mode has visible word/manual Next', () => withApp({voice:'en-US'}, a => {
 a.q.Speech.say(['Hello'],{},()=>{});a.clock.tick(500);assert.equal(a.spoken.length,0);a.q.Eng.start({});clickText(a,'Continue in Text mode');clickText(a,"I'm ready");a.clock.tick(10000);assert.equal(a.spoken.length,0);assert(a.q.Eng.showWord);assert.equal(a.q.Eng.idx,0);assert.equal(a.q.Eng.st,'waiting');
}));
test('4.1 UK ranking and utterances stay en-GB; no-UK dictionary audio refused', () => withApp({voice:'en-GB'}, a => {
 a.q.Speech.say(['Hello Britain'],{},()=>{});a.clock.tick(500);assert(a.spoken.length);assert(a.spoken.every(s=>s.lang==='en-GB'&&s.voice==='en-GB'));
 const parsed=a.q.Dict.parse([{phonetics:[{text:'/us/',audio:'https://audio.example/us.mp3'}],meanings:[{partOfSpeech:'noun',definitions:[{definition:'meaning'}]}]}]);assert.equal(parsed.audio,'');assert.equal(parsed.ipa,'');
 const uk=a.q.Dict.parse([{phonetics:[{text:'/us/',audio:'https://audio.example/word-us.mp3'},{text:'/uk/',audio:'https://audio.example/word-uk.mp3'}],meanings:[{partOfSpeech:'noun',definitions:[{definition:'meaning'}]}]}]);assert.equal(uk.ipa,'uk');assert(uk.audio.endsWith('-uk.mp3'));
}));
test('4.2 full 30-word fake-timer dictation, instant marking, pause/resume, result saved', () => withApp({voice:'en-GB'}, a => {
 a.q.DB.data.settings.mode='type';a.q.DB.data.settings.writeMode='fixed';a.q.DB.data.settings.writeFixed=3;
 a.q.Eng.start({});clickText(a,"I'm ready");let paused=false;
 for(let i=0;i<5000&&!a.q.DB.data.history.length;i++) {
  a.clock.tick(100);
  if(a.q.Eng.st==='waiting') {
   const input=a.w.document.querySelector('#ansInput');input.value=a.q.Eng.currentWord().w;input.dispatchEvent(new a.w.Event('input'));
   if(!paused) {const index=a.q.Eng.idx;a.q.Eng.pause();a.clock.tick(1000);assert.equal(a.q.Eng.idx,index);a.q.Eng.resume();paused=true;}
  }
 }
 assert(paused);assert.equal(a.q.DB.data.history.length,1);assert.equal(a.q.DB.data.history[0].wordCount,30);assert.equal(a.q.DB.data.history[0].score,30);assert(JSON.parse(a.w.localStorage.getItem('sdp.v1')).history.length);
 assert(a.spoken.some(s=>s.text==='Number 30.'));assert(a.spoken.filter(s=>s.text==='appointment').length>=2);
 assert(a.spoken.some(s=>s.text.includes('dentist appointment')));assert.equal(a.q.Errors.items.length,0);
}));
test('4.2 reload mid-session offers continuation with answers and same word', () => {
 let saved,index;withApp({voice:'en-GB'}, a=>{a.q.DB.data.settings.mode='type';a.q.Eng.start({});clickText(a,"I'm ready");a.clock.tick(4000);a.q.Eng.runItem(4);a.q.Eng.pause();index=a.q.Eng.idx;saved=a.w.localStorage.getItem('sdp.v1');});
 withApp({raw:saved,voice:'en-GB'}, a=>{assert(!a.w.document.querySelector('#homeResume').classList.contains('hidden'));a.q.Eng.resumeSnapshot();assert.equal(a.q.Eng.idx,index);assert.equal(a.q.Eng.words.length,30);});
});
test('4.2 finish saves result before closing speech and queues it while offline', () => withApp({voice:'en-GB',offline:true}, a=>{
 a.q.Eng.start({});a.q.Eng.finish(true);assert.equal(a.q.DB.data.history.length,1);assert.equal(JSON.parse(a.w.localStorage.getItem('sdp.v1')).history.length,1);assert(a.q.DB.data.outbox.some(x=>x.action==='result'));
}));
test('4.3 dictionary keeps lecturer meaning, Cambridge link and UK-labelled fallback', () => withApp({offline:true},a=>{
 a.q.Screens.wordSheet('neighbour',{w:'neighbour',m:'Lecturer meaning',s:'Our neighbour has a very friendly dog today.'});const sh=a.w.document.querySelector('#sheets');assert(sh.textContent.includes('Lecturer meaning'));assert(sh.textContent.includes('UK voice on this device'));assert(sh.querySelector('a[href^="https://dictionary.cambridge.org/"]'));
}));

test('2.1 Change PIN requires old PIN and new matching PIN; new PIN unlocks',()=>withApp({},a=>{
 enterPin(a,'7898');a.q.Admin.tab='tools';a.q.Admin.renderTab();clickText(a,'Change PIN');const inputs=a.w.document.querySelectorAll('#sheets input');inputs[0].value='0000';inputs[1].value='98765';inputs[2].value='98765';clickText(a,'Save new PIN');const oldHash=a.q.DB.data.admin.pinHash;assert.equal(oldHash,a.q.Sha.hex('sdp.v1:'+a.q.DB.data.admin.pinSalt+':7898'));
 inputs[0].value='7898';clickText(a,'Save new PIN');assert.notEqual(a.q.DB.data.admin.pinHash,oldHash);a.q.Admin.lock();enterPin(a,'98765');assert(a.q.Admin.unlocked);
}));
test('2.1 idle/background locks and privileged sheets disappear',()=>withApp({},a=>{
 enterPin(a,'7898');a.q.Admin.tab='tools';a.q.Admin.renderTab();clickText(a,'Change PIN');a.clock.tick(615000);assert(!a.q.Admin.unlocked);assert(!a.w.document.querySelector('#sheets .sheet'));
 enterPin(a,'7898');a.q.Admin.wentBackground();a.clock.tick(120001);a.q.Admin.cameForeground();assert(!a.q.Admin.unlocked);
}));
test('2.2 rename/duplicate/reorder/delete with Undo retain list and planner data',()=>withApp({},a=>{
 enterPin(a,'7898');clickText(a,'Duplicate list');assert.equal(a.q.DB.data.lists.length,2);clickText(a,'Rename');a.w.document.querySelector('#sheets input').value='Changed list';clickText(a,'Save');assert.equal(a.q.DB.data.lists[1].name,'Changed list');
 const words=a.q.DB.data.lists[1].words,first=words[0].w,second=words[1].w;const down=a.w.document.querySelector('[aria-label="Move down"]');down.click();assert.equal(words[0].w,second);assert.equal(words[1].w,first);
 a.q.DB.data.plan.defaultList=a.q.DB.data.lists[1].id;const id=a.q.DB.data.plan.defaultList;clickText(a,'Delete list');clickText(a,'Delete');assert.equal(a.q.DB.data.lists.length,1);
 const undo=Array.from(a.w.document.querySelectorAll('#toasts button')).find(b=>b.textContent==='Undo');assert(undo);undo.click();assert.equal(a.q.DB.data.lists.length,2);assert.equal(a.q.DB.data.plan.defaultList,id);
}));
test('2.4 announcements, expiry and lecturer moderation stay separate from private inbox',()=>withApp({},a=>{
 enterPin(a,'7898');a.q.Admin.tab='announce';a.q.Admin.renderTab();a.w.document.querySelector('[aria-label="Announcement title"]').value='Class notice';a.w.document.querySelector('[aria-label="Announcement text"]').value='Bring your notebook.';clickText(a,'Publish announcement');assert(a.w.document.querySelector('#homeAnn').textContent.includes('Bring your notebook.'));
 a.q.DB.data.announcement.expires='2026-10-12';a.q.Screens.home();assert(!a.w.document.querySelector('#homeAnn').textContent);
 a.q.DB.data.comments=[{id:'comment-test',name:'Happy Owl',status:'finished',text:'Public QA',ts:a.clock.now}];a.q.Admin.tab='comments';a.q.Admin.renderTab();clickText(a,'Pin');assert(a.q.DB.data.comments[0].pinned);clickText(a,'Hide');a.q.Screens.comm();assert(!a.w.document.querySelector('#commList').textContent.includes('Public QA'));
}));
test('4.4 automatic Lite mode respects slow/low-memory devices and manual setting',()=>withApp({},a=>{
 Object.defineProperty(a.w.navigator,'hardwareConcurrency',{value:2});a.q.DB.data.settings.perf='auto';a.q.UI.applyPerf();assert.equal(a.q.UI.perfMode,'lite');a.q.DB.data.settings.perf='full';a.q.UI.applyPerf();assert.equal(a.q.UI.perfMode,'full');a.q.DB.data.settings.perf='lite';a.q.UI.applyPerf();assert.equal(a.w.document.body.getAttribute('data-perf'),'lite');
}));

test('2.4 locked backups exclude lecturer private inbox, PIN hashes and drafts; full backup requires unlock',()=>withApp({},a=>{
 a.q.DB.data.inbox=[{id:'someone-else',text:'Lecturer private inbox',mine:false},{id:'mine',text:'My message',mine:true}];
 a.q.DB.data.lists[0].draftText='Secret draft';const personal=JSON.parse(a.q.DB.exportAll());assert.equal(personal.scope,'personal');assert(!JSON.stringify(personal).includes('Lecturer private inbox'));assert(!JSON.stringify(personal).includes('Secret draft'));assert(!personal.data.admin.pinHash);assert.equal(personal.data.inbox[0].text,'My message');
 const hash=a.q.DB.data.admin.pinHash;a.q.DB.importAll(JSON.stringify(personal));assert.equal(a.q.DB.data.admin.pinHash,hash);a.q.Admin.unlocked=true;assert(JSON.parse(a.q.DB.exportAll()).data.inbox.some(m=>m.text==='Lecturer private inbox'));
}));

console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.status==='FAIL')) process.exitCode=1;
module.exports = {harness,withApp,clickText};
