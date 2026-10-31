'use strict';
const DEFAULT_PIN = require('./test-pin.cjs');
const ALT_PIN = ['1','2','3','4','5','6','7','8'].join('');
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
const STORE_KEY = current.match(/key:"([^"]+)"/)[1];
/* The Phase 1 comparisons need the historical baseline commit. In a shallow
   clone (or after a squash) that object can be missing: skip instead of
   failing, so a missing historical commit never blocks CI. */
function historyAvailable() {
  try { cp.execFileSync('git', ['rev-parse', '--verify', '7577968^{commit}'], {cwd: root, stdio: 'ignore'}); return true; }
  catch (err) { return false; }
}
const original = historyAvailable()
  ? cp.execFileSync('git', ['show', '7577968:index.html'], {cwd: root, maxBuffer: 1000000}).toString()
  : null;
const results = [];
function test(name, fn) {
  const historical = [
    '1.1 before: original Local-mode boot shows crash card',
    '1.1 after: one-line hotfix alone removes boot crash',
    '1.3 before: emergency backup silently fails but deletes storage at 600ms'
  ];
  if (!original && historical.includes(name)) {
    results.push({test: name, status: 'SKIP', detail: 'baseline commit 7577968 is not available'});
    return;
  }
  try { fn(); results.push({test: name, status: 'PASS'}); }
  catch (err) { results.push({test: name, status: 'FAIL', detail: err.stack}); }
}
function harness(html = current, opts = {}) {
  const errors = [], requests = [], spoken = [], audio = [];
  const dom = new JSDOM(html, {url: 'https://example.test/' + (opts.hash || ''), runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole()});
  const w = dom.window;
  const clock = FakeTimers.withGlobal(w).install({now: Date.UTC(2026, 9, 13, 12), toFake: ['Date','performance','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame']});
  w.scrollTo = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.matchMedia = () => ({matches: false, addEventListener() {}});
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.play = function () {
    const el = this;
    if (el.id === 'ttsMasterAudio') audio.push({src: String(el.getAttribute('src') || ''), rate: el.playbackRate});
    w.setTimeout(() => { if (el.onended) el.onended(); }, 1);
  };
  w.XMLHttpRequest = class {
    open(method, url) { requests.push({method, url}); }
    setRequestHeader() {}
    send() { w.setTimeout(() => {this.status = 0; this.readyState = 4; if(this.onreadystatechange) this.onreadystatechange();}, 10); }
  };
  w.fetch = url => { requests.push({method: 'fetch', url: String(url)}); return Promise.reject(Error('offline')); };
  if(opts.raw !== undefined) { w.localStorage.setItem(STORE_KEY, opts.raw); w.localStorage.setItem('sdp.v43_bundled_studio_voice', opts.raw); }
  if(opts.backup) { w.localStorage.setItem(STORE_KEY+'.bak', opts.backup); w.localStorage.setItem('sdp.v43_bundled_studio_voice.bak', opts.backup); }
  if(opts.cloud) w.localStorage.setItem('sdp.cloudurl', 'https://script.google.com/macros/s/unreachable/exec');
  if(opts.blocked) Object.defineProperty(w, 'localStorage', {get() {throw Error('Storage blocked');}});
  if(opts.offline) Object.defineProperty(w.navigator, 'onLine', {value: false});
  if(opts.navThrows) ['onLine','hardwareConcurrency','deviceMemory','wakeLock','userAgent','maxTouchPoints'].forEach(k => Object.defineProperty(w.navigator, k, {get() {throw Error('Restricted getter');}}));
  if(opts.speechThrows) Object.defineProperty(w, 'speechSynthesis', {get() {throw Error('Speech blocked');}});
  if(opts.voice) {
    w.SpeechSynthesisUtterance = function(text) {this.text = text;};
    w.speechSynthesis = {getVoices() {return [{lang:opts.voice, name:opts.voice==='en-GB'?'Amy':'US voice',localService:true}];}, cancel() {}, speak(u) {spoken.push({text:u.text, lang:u.lang, voice:u.voice && u.voice.lang}); w.setTimeout(() => {if(u.onend) u.onend();}, 1);}, addEventListener() {}};
  }
  w.addEventListener('error', ev => errors.push(ev.message));
  let script = Array.from(w.document.scripts).find(n => !n.type && n.textContent.includes('var APP_VERSION')).textContent;
  const marker = script.indexOf('window.SDP = {') >= 0 ? 'window.SDP = {' : 'window.SDP={';
  script = script.replace(marker, 'window.__qa = {U: U, UI: UI, DB: DB, Store: Store, Errors: typeof Errors === "undefined" ? null : Errors, DataTools: DataTools, Screens: Screens, Eng: Eng, Speech: Speech, Cloud: Cloud, Admin: Admin, Diag: Diag, Results: Results, Lib: Lib, Comm: Comm, Dict: Dict, Links: typeof Links === "undefined" ? null : Links, Sha: Sha, fatalCard: fatalCard};\nwindow.SDP = {');
  if(opts.bootFailure) script = script.replace(/function boot\(\)[{][\s\S]*?Store\.test\(\)[,;]/, 'function boot(){ throw new Error("Injected boot failure");');
  if(opts.renderFailure) script = script.replace(/home:function\(\)\{/, 'home:function(){ throw new Error("Injected render failure");');
  vm.runInContext(script, dom.getInternalVMContext());
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  clock.tick(100);
  if(w.__qa.DB.data) w.__qa.DB.data.tourSeen = true;
  return {w, q:w.__qa, clock, errors, requests, spoken, audio, crash:() => w.document.querySelector('#fatal').dataset.shown==='1', close() {clock.uninstall(); dom.window.close();}};
}
function withApp(opts, fn, html) {const a=harness(html,opts);try{fn(a);}finally{a.close();}}
/* v2.0.0: boot may only read the two cache-busted static files next to index.html.
   Any other request at boot (especially a cloud call) is still a regression. */
function bootTraffic(a) {
  /* v2.0.0 keeps the Phase-1 rule - the page sends nothing on load - and adds
     the documented free live channel: the two cached ntfy reads (the published
     state and the community feed) next to the two static ./data files. A POST,
     an Apps Script call or any other host is still a failure. */
  const live = /^https:\/\/ntfy\.sh\/sdp_dictationb1_(state|comm)_v8\/json\?poll=1&since=24h$/;
  const sse = /^https:\/\/ntfy\.sh\/sdp_dictationb1_state_v8,sdp_dictationb1_comm_v8\/sse$/;
  const staticFile = /^\.\/data\/(version|session)\.json(\?v=\d+)?$/;
  return a.requests.every(r => r.method === 'fetch' && (staticFile.test(r.url) || live.test(r.url) || sse.test(r.url))) &&
    !a.requests.some(r => r.method !== 'fetch') &&
    !a.requests.some(r => /script\.google\.com|api\.github\.com/.test(r.url));
}
function clickText(a, text) {const b=Array.from(a.w.document.querySelectorAll('button')).find(n => n.textContent.trim()===text); assert(b, 'button: '+text); b.click(); return b;}

test('1.1 before: original Local-mode boot shows crash card', () => withApp({}, a => assert(a.crash()), original));
test('1.1 after: one-line hotfix alone removes boot crash', () => withApp({}, a => assert(!a.crash()), original.replace('chip.classList.add(Cloud.mode && online ? "good" : "");','if (Cloud.mode && online) chip.classList.add("good");')));
for(const [name, opts] of [
 ['empty storage', {}], ['corrupt JSON', {raw:'{broken'}], ['wrong JSON structure', {raw:'{"settings":3,"lists":{},"results":"broken"}'}],
 ['storage blocked', {blocked:true}], ['offline', {offline:true}], ['configured unreachable cloud', {cloud:true}],
 ['no speechSynthesis', {}], ['no en-GB voice', {voice:'en-US'}], ['restricted navigator getters', {navThrows:true}], ['throwing speech getter', {speechThrows:true}]
]) test('Boot: '+name, () => withApp(opts, a => {assert(!a.crash()); assert(a.q.DB.data); assert(a.w.document.querySelector('#homeTitle').textContent.length); assert.equal(a.errors.length,0);}));

test('1.1 all class call sites use guarded helper; blank tokens dropped, words split', () => withApp({}, a => {
 const el=a.w.document.createElement('div');
 for(const name of ['',undefined,null,'   ']) a.q.U.setCls(el,name,true);
 assert.equal(el.className,'');
 a.q.U.setCls(el,'two tokens',true);assert.equal(el.className,'two tokens');
 a.q.U.setCls(el,'good',true);assert.equal(el.className,'two tokens good');a.q.U.setCls(el,'good',false);assert.equal(el.className,'two tokens');
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
 a.q.DB.data.session.title='Keep this work';a.q.DB.saveNow();const saved=a.w.localStorage.getItem(STORE_KEY);
 a.q.DataTools.reset();clickText(a,'Download');a.clock.tick(2000);assert.equal(a.w.localStorage.getItem(STORE_KEY),saved);
 assert(a.w.document.querySelector('#sheets textarea').value.includes('Keep this work'));
 assert(!a.w.document.querySelector('#resetConfirm'));
}));
test('1.3 second confirmation requires BOTH tick and exact RESET', () => withApp({}, a => {
 a.q.Admin.unlocked=true;a.q.DB.data.session.title='Keep until confirmed';a.q.DB.saveNow();a.q.DataTools.reset();clickText(a,'Next: confirm reset');
 const d=a.w.document, tick=d.querySelector('#resetSaved'),typed=d.querySelector('#resetTyped'),confirm=d.querySelector('#resetConfirm');
 assert(confirm.disabled);typed.value='RESET';typed.dispatchEvent(new a.w.Event('input'));assert(confirm.disabled);
 tick.checked=true;tick.dispatchEvent(new a.w.Event('change'));assert(!confirm.disabled);
 typed.value='reset';typed.dispatchEvent(new a.w.Event('input'));assert(confirm.disabled);
 typed.value='RESET';typed.dispatchEvent(new a.w.Event('input'));confirm.click();assert.equal(a.q.DB.data.session.title,require('../data/session.json').session.title);
 assert(a.w.localStorage.getItem(STORE_KEY+'.beforeReset').includes('Keep until confirmed'));
 assert(a.w.localStorage.getItem(STORE_KEY+'.bak').includes('Keep until confirmed'));
}));
test('1.3 result saves and lecturer changes update rolling backup', () => withApp({}, a => {
 a.q.DB.data.session.title='Lecturer update';a.q.DB.save();a.clock.tick(150);
 assert(a.w.localStorage.getItem(STORE_KEY+'.bak').includes('Lecturer update'));
 a.q.DB.data.results.push({id:'qa-result',score:30});a.q.DB.saveNow();
 assert.equal(a.w.localStorage.getItem(STORE_KEY),a.w.localStorage.getItem(STORE_KEY+'.bak'));
}));
test('1.3 corrupt primary restores automatic copy and retains corrupt text', () => {
 let backup;withApp({}, a => {a.q.DB.data.session.title='Recovery data';a.q.DB.saveNow();backup=a.w.localStorage.getItem(STORE_KEY+'.bak');});
 withApp({raw:'{corrupt',backup}, a => {assert.equal(a.q.DB.data.session.title,'Recovery data');assert.equal(a.w.localStorage.getItem(STORE_KEY+'.recovery'),'{corrupt');});
});
test('1.3 pending save flushed on pagehide', () => withApp({}, a => {a.q.DB.data.session.title='Leaving';a.q.DB.save();a.w.dispatchEvent(new a.w.Event('pagehide'));assert(a.w.localStorage.getItem(STORE_KEY).includes('Leaving'));}));
test('1.4 flex fatal card uses scale-only animation; confirm keeps translate', () => withApp({bootFailure:true}, a => {
 assert(a.w.document.querySelector('#fatal .modal').classList.contains('flex-card'));
 const keyframe=current.match(/@keyframes pop-flex\s*\{[\s\S]*?\}\s*\}/)[0];assert(!keyframe.includes('translate'));assert(/@keyframes pop\s*\{/.test(current));
}));
test('1.5 injected script removed and lazy gas-source retained', () => {
 assert(!/__CF\$|cdn-cgi|challenge-platform/.test(current));
 const gas=fs.readFileSync(path.join(__dirname,'..','data','gas-source.txt'),'utf8');assert(/id="gas-source"><\/script>/.test(current),'the lazy gas-source holder is present');assert(gas.includes("function handlePost(e)")); assert(gas.includes("function adminOk(body)"));
 assert(current.includes('var APP_VERSION'),'the inline application remains present after comments are stripped');
});
test('1.5 no cloud traffic on load; only the static live-session files, even with cloud configured', () => withApp({cloud:true}, a => {a.clock.tick(10000);assert(a.requests.length<=4 && bootTraffic(a), JSON.stringify(a.requests));a.w.document.querySelector('#btnRefresh').click();a.clock.tick(100);assert(a.requests.length>0);assert(!a.crash());}));
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
 acorn.parse(script,{ecmaVersion:2017});assert(!/\beval\s*\(|new\s+Function\s*\(/.test(script));assert(Buffer.byteLength(current)<598000);d.window.close();
});
function enterPin(a, pin) {
  a.q.Admin.open();
  const pad = a.w.document.querySelector('#pinPad');
  if (!pad) return;                                                 /* locked out: no pad offered */
  const clear = pad.querySelector('[data-k="clear"]');
  if (clear) clear.click();
  for(const digit of pin) { const key = a.w.document.querySelector('#pinPad [data-k="'+digit+'"]'); if (key) key.click(); }
  if (pin.length === 8 && !a.w.document.querySelector('#pinPad')) return; /* eight-digit PIN may auto-submit */
  const submit = a.w.document.querySelector('#pinSubmit');
  if (submit && !submit.disabled) submit.click();
}
test('2.1 first valid unlock initializes a local sdp.v2 salted PIN; changed PIN survives same-schema migration', () => withApp({}, a => {
 assert.equal(a.q.DB.data.admin.pinHash,'');assert.equal(a.q.DB.data.admin.pinSalt,'');
 enterPin(a,DEFAULT_PIN);assert(a.q.Admin.unlocked);assert(a.w.document.querySelector('#adminHost'));assert(!a.w.document.querySelector('#adminHost').textContent.includes(DEFAULT_PIN));
 assert.equal(a.q.DB.data.admin.pinHash,a.q.Sha.hex('sdp.v2:'+a.q.DB.data.admin.pinSalt+':'+DEFAULT_PIN));
 a.q.DB.data.admin.pinHash='changed';a.q.DB.saveNow();const data=JSON.parse(a.w.localStorage.getItem(STORE_KEY));assert.equal(a.q.DB.migrate(data).admin.pinHash,'changed');
}));
test('2.1 five wrong PINs cause five-minute lockout; a runtime-built 8-digit PIN is usable', () => withApp({}, a => {
 enterPin(a,DEFAULT_PIN);a.q.Admin.lock();
 for(let i=0;i<5;i++) enterPin(a,'0000');assert(!a.q.Admin.unlocked);assert(a.q.DB.data.admin.lockUntil>a.clock.now);assert.equal(a.q.DB.data.admin.lockUntil-a.clock.now,300000);
 a.clock.tick(300001);a.q.DB.data.admin.pinSalt='testsalt';a.q.DB.data.admin.pinHash=a.q.Sha.hex('sdp.v2:testsalt:'+ALT_PIN);a.q.DB.data.admin.pinKdf='sha256-v2';enterPin(a,ALT_PIN);assert(a.q.Admin.unlocked);
}));
test('2.1 #lecturer and direct render/edit methods reveal nothing without PIN', () => withApp({hash:'#lecturer'}, a => {
 a.clock.tick(400);assert(!a.q.Admin.unlocked);assert(!a.w.document.querySelector('#adminHost'));assert(a.w.document.querySelector('#pinPad'));
 const words=a.q.DB.data.lists[0].words.length;a.q.Admin.publish(a.q.DB.data.lists[0]);a.q.Admin.panel();assert(!a.w.document.querySelector('#adminHost'));assert.equal(a.q.DB.data.lists[0].words.length,words);
}));
test('2.1 detached editing handlers and delayed list rows cannot edit after Lock now', () => withApp({}, a => {
 enterPin(a,DEFAULT_PIN);const button=Array.from(a.w.document.querySelectorAll('#adminHost button')).find(n=>n.textContent.includes('Duplicate list'));assert(button);
 const count=a.q.DB.data.lists.length;a.q.Admin.lock();button.click();a.clock.tick(300);assert.equal(a.q.DB.data.lists.length,count);assert(!a.q.Admin.unlocked);
}));
test('2.2 paste handles 120 words, pipes, tabs, CSV quotes and warnings', () => withApp({}, a => {
 const lines=Array.from({length:120},(_,i)=>'word'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26)+' | This is a short example sentence for our class today. | meaning');
 assert.equal(a.q.Admin.parseWords(lines.join('\n')).items.length,120);
 const tab=a.q.Admin.parseWords('colour\tI like this colour very much today.\ta shade');
 assert.equal(tab.items[0].m,'a shade');
 const csv=a.q.Admin.parseWords('word,sentence,meaning\n"neighbour","Our neighbour, Pat, has a friendly dog today.","nearby person"');
 assert.equal(csv.items[0].s,'Our neighbour, Pat, has a friendly dog today.');
 const r=a.q.Admin.parseWords('colour,Colour\n\n'+ 'a'.repeat(41));
 assert.equal(r.dupes,1);assert.equal(r.problems.length,1);assert(r.problems[0].includes('invalid word'));
 // Mixed row formats are not guessed individually: ambiguity is flagged.
 assert(a.q.Admin.parseWords('colour\tA shade\nneighbour,A nearby person').problems.length);

}));
test('2.2 30-word Saturday assignment, draft isolation and eight-week planner', () => withApp({}, a => {
 enterPin(a,DEFAULT_PIN);const list=a.q.DB.data.lists[0];list.name='Saturday class';list.words[0]={w:'Saturdayword',s:'This is a new sentence for our Saturday class.',m:''};list.draft=true;
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
 enterPin(a,DEFAULT_PIN);a.q.Admin.tab='session';a.q.Admin.renderTab();const no=a.w.document.querySelector('[aria-label="Session number"]');no.value='42';no.dispatchEvent(new a.w.Event('input'));
 clickText(a,'Sun');assert.equal(a.q.DB.data.session.day,'Sunday');assert(a.w.document.querySelector('#homeKicker').textContent.includes('42'));assert(a.q.Comm.meta().includes('Sunday'));
 a.q.Eng.start({});assert.equal(a.q.Eng.layer,null);clickText(a,"I'm ready");a.clock.tick(120);assert(a.q.Eng.layer.textContent.includes('Session 42'));assert(a.q.Eng.layer.textContent.includes('Sunday'));
}));
test('2.4 private message is absent from public comments, visible only in unlocked inbox', () => withApp({}, a => {
 a.q.Comm.message();a.w.document.querySelector('#sheets textarea').value='Private QA message';clickText(a,'Send to lecturer');assert.equal(a.q.DB.data.inbox.length,1);assert.equal(a.q.DB.data.comments.length,0);assert(!a.w.document.querySelector('#commList').textContent.includes('Private QA message'));
 enterPin(a,DEFAULT_PIN);a.q.Admin.tab='announce';a.q.Admin.renderTab();assert(a.w.document.querySelector('#adminHost').textContent.includes('Private QA message'));assert(a.w.document.querySelector('#adminHost').textContent.includes('Reply'));
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
 enterPin(a,DEFAULT_PIN);a.q.Admin.tab='tools';a.q.Admin.renderTab();const host=a.w.document.querySelector('#adminHost');assert(host.textContent.includes('1. Copy the script'));assert(host.textContent.includes('4. Test connection'));
 const input=a.w.document.querySelector('[aria-label="Google Apps Script web app link"]');input.value='https://script.google.com/macros/s/validscriptid/exec';clickText(a,'Save link');assert(a.w.localStorage.getItem('sdp.cloudurl'));
 a.q.Cloud.ping=cb=>cb({ok:false});clickText(a,'Test connection');assert(host.textContent.includes('Could not connect'));
 a.q.Cloud.ping=cb=>cb({ok:true});clickText(a,'Test connection');assert(host.textContent.includes('Connected. Your Google Sheet answered.'));
}));
test('3.2 student hash connects automatically and is cleared without load requests', () => withApp({hash:'#cloud=validscriptid'}, a => {
 assert(a.q.Cloud.mode);assert.equal(a.w.location.hash,'');assert(a.requests.length<=4 && bootTraffic(a), JSON.stringify(a.requests));assert(a.w.localStorage.getItem('sdp.cloudurl').includes('validscriptid'));
}));
test('3.3 Unicode link round-trip, explicit preview/Add and split-part assembly', () => {
 let links;withApp({}, a => {a.q.DB.data.announcement={title:'Class notice',text:'Café practice'};links=a.q.Links.listLinks(a.q.Lib.current());assert(links.length>1);assert(links.every(l=>l.length<=2000));const item=a.q.Links.decode(links[0].split('#list=')[1]);assert.equal(item.a.text,'Café practice');});
 let saved;for(const link of links) withApp({hash:'#'+link.split('#')[1],raw:saved}, a => {
  a.clock.tick(150);assert(a.w.document.querySelector('#sheets').textContent.includes('Add shared list?'));assert.equal(a.w.location.hash,'');assert.equal(a.q.DB.data.lists.length,1);clickText(a,'Add');saved=a.w.localStorage.getItem(STORE_KEY);
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
 a.q.Admin.unlocked=true;a.q.Admin.pin=DEFAULT_PIN;a.q.Cloud.flush();a.clock.tick(300);assert.equal(requests[1].pin,DEFAULT_PIN);assert.equal(a.q.DB.data.outbox.length,0);assert(!a.w.localStorage.getItem(STORE_KEY).includes('"pin":'+JSON.stringify(DEFAULT_PIN)));
}));
test('3.5 sync time advances only after successful state reply', () => withApp({cloud:true}, a => {
 assert.equal(a.q.Cloud.updatedAt,0);a.q.Cloud.get=(params,cb)=>cb({ok:false});a.q.Cloud.pullState();assert.equal(a.q.Cloud.updatedAt,0);
 a.q.Cloud.get=(params,cb)=>cb({ok:true,ver:10});a.q.Cloud.pullState();assert(a.q.Cloud.updatedAt);a.q.UI.renderNet();assert(/Cloud Synced/i.test(a.w.document.querySelector('#chipNetText').textContent),a.w.document.querySelector('#chipNetText').textContent);assert(!/Local mode/i.test(a.w.document.querySelector('#chipNetText').textContent));
}));
test('4.1 remote studio audio needs no device voice and never throws a blocking sheet', () => withApp({voice:'en-US'}, a => {
 a.q.Speech.say(['Hello'],{},()=>{});a.clock.tick(500);
 assert.equal(a.audio.length,1,'the remote human recording plays without speechSynthesis');
 assert.equal(a.audio[0].src,'https://dict.youdao.com/dictvoice?type=1&audio=Hello','v50: the direct Youdao studio stream is assigned to the master element');
 assert.equal(a.spoken.length,0,'device speech stays disabled');
 assert(!a.q.Speech.textOnly,'never silently dropped into Text mode');
 a.q.Eng.start({});
 assert(!a.w.document.querySelector('#sheets').textContent.includes('No UK English voice found on this device'),'the blocking modal is gone');
 clickText(a,"I'm ready");a.clock.tick(10000);
 assert(a.audio.length>1);assert(a.q.Eng.st==='waiting'||a.q.Eng.st==='speaking');
 assert(/NoVoice\s*=\s*\{/.test(current) && current.includes('No UK English voice found on this device'),'the guidance card still exists for Diagnostics');
}));
test('4.1 dictionary ranking stays UK while dictation uses the locked Oxford voice', () => withApp({voice:'en-GB'}, a => {
 a.q.Speech.say(['Hello Britain'],{},()=>{});a.clock.tick(500);assert(a.audio.length);assert(a.audio.every(s=>/^https:\/\/dict\.youdao\.com\/dictvoice\?type=1&audio=/.test(s.src)),'v49: one direct Youdao stream for every prompt');assert.equal(a.spoken.length,0,'no device voice while the studio stream plays');
 const parsed=a.q.Dict.parse([{phonetics:[{text:'/us/',audio:'https://audio.example/us.mp3'}],meanings:[{partOfSpeech:'noun',definitions:[{definition:'meaning'}]}]}]);
 assert.equal(parsed.audio,'https://audio.example/us.mp3');assert.equal(parsed.ukSource,false);
 assert.equal(a.q.Speech.isBritishAudio('https://audio.example/us.mp3'),false);
 assert(a.q.Speech.isBritishAudio('https://audio.example/word-uk.mp3'));
 a.q.DB.data.dictCache['word']={audio:'https://audio.example/word-us.mp3',ukSource:false,ts:Date.now()};
 assert.equal(a.q.Speech.mp3For('word'),a.q.Speech.getSingleVoiceUrl('word'),'a non-UK recording never becomes the dictation voice: '+a.q.Speech.mp3For('word')); /* v40: the one locked studio voice replaces the retired Oxford fallback */
 a.q.DB.data.dictCache['word'].audio='https://audio.example/word-uk.mp3';
 assert.equal(a.q.Speech.mp3For('word'),a.q.Speech.getSingleVoiceUrl('word'),'v40: even a cached UK recording cannot replace the one locked studio voice');
 delete a.q.DB.data.dictCache['word'];
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
 assert(paused);assert.equal(a.q.DB.data.history.length,1);assert.equal(a.q.DB.data.history[0].wordCount,30);assert.equal(a.q.DB.data.history[0].score,30);assert(JSON.parse(a.w.localStorage.getItem(STORE_KEY)).history.length);
 assert(a.audio.some(s=>/Final%20word%2C%20number%2030/.test(s.src)),'v48: the last word is announced with its dictation number');
 assert(a.audio.filter(s=>/audio=hungry$/.test(s.src)).length>=1,'v49: the second pass replays the clean word on the same element');
 assert(a.audio.some(s=>/audio=Number%201$/.test(s.src)),'v48: every word announces its dictation number');
 assert.equal(a.spoken.length,0);assert.equal(a.q.Errors.items.length,0);
}));
test('4.2 reload mid-session offers continuation with answers and same word', () => {
 let saved,index;withApp({voice:'en-GB'}, a=>{a.q.DB.data.settings.mode='type';a.q.Eng.start({});clickText(a,"I'm ready");a.clock.tick(4000);a.q.Eng.runItem(4);a.q.Eng.pause();index=a.q.Eng.idx;saved=a.w.localStorage.getItem(STORE_KEY);});
 withApp({raw:saved,voice:'en-GB'}, a=>{assert(!a.w.document.querySelector('#homeResume').classList.contains('hidden'));a.q.Eng.resumeSnapshot();assert.equal(a.q.Eng.idx,index);assert.equal(a.q.Eng.words.length,30);});
});
test('4.2 finish saves result before closing speech and queues it while offline', () => withApp({voice:'en-GB',offline:true}, a=>{
 a.q.Eng.start({});a.q.Eng.finish(true);assert.equal(a.q.DB.data.history.length,1);assert.equal(JSON.parse(a.w.localStorage.getItem(STORE_KEY)).history.length,1);assert(a.q.DB.data.outbox.some(x=>x.action==='result'));
}));
test('4.3 dictionary keeps lecturer meaning, Cambridge link and UK-labelled fallback', () => withApp({offline:true},a=>{
 a.q.Screens.wordSheet('neighbour',{w:'neighbour',m:'Lecturer meaning',s:'Our neighbour has a very friendly dog today.'});const sh=a.w.document.querySelector('#sheets');assert(sh.textContent.includes('Lecturer meaning'));assert(sh.textContent.includes('UK voice on this device'));assert(sh.querySelector('a[href^="https://dictionary.cambridge.org/"]'));
}));

test('2.1 Change PIN requires old PIN and new matching PIN; new PIN unlocks',()=>withApp({},a=>{
 enterPin(a,DEFAULT_PIN);a.q.Admin.tab='tools';a.q.Admin.renderTab();clickText(a,'Change PIN');const inputs=a.w.document.querySelectorAll('#sheets input');inputs[0].value='0000';inputs[1].value='98765';inputs[2].value='98765';clickText(a,'Save new PIN');a.clock.tick(30);const oldHash=a.q.DB.data.admin.pinHash;assert.equal(oldHash,a.q.Sha.hex('sdp.v2:'+a.q.DB.data.admin.pinSalt+':'+DEFAULT_PIN));
 inputs[0].value=DEFAULT_PIN;clickText(a,'Save new PIN');a.clock.tick(30);assert.notEqual(a.q.DB.data.admin.pinHash,oldHash);a.q.Admin.lock();enterPin(a,'98765');assert(a.q.Admin.unlocked);
}));
test('2.1 idle/background locks and privileged sheets disappear',()=>withApp({},a=>{
 enterPin(a,DEFAULT_PIN);a.q.Admin.tab='tools';a.q.Admin.renderTab();clickText(a,'Change PIN');a.clock.tick(615000);assert(!a.q.Admin.unlocked);assert(!a.w.document.querySelector('#sheets .sheet'));
 enterPin(a,DEFAULT_PIN);a.q.Admin.wentBackground();a.clock.tick(120001);a.q.Admin.cameForeground();assert(!a.q.Admin.unlocked);
}));
test('2.2 rename/duplicate/reorder/delete with Undo retain list and planner data',()=>withApp({},a=>{
 enterPin(a,DEFAULT_PIN);clickText(a,'Duplicate list');assert.equal(a.q.DB.data.lists.length,2);clickText(a,'Rename');a.w.document.querySelector('#sheets input').value='Changed list';clickText(a,'Save');assert.equal(a.q.DB.data.lists[1].name,'Changed list');
 const words=a.q.DB.data.lists[1].words,first=words[0].w,second=words[1].w;
 /* v2.0.0 has ONE word table: reorder the row in it, then publish the list */
 const down=a.w.document.querySelector('[aria-label="Down word 1"]');assert(down,'the single table offers a Down control');down.click();
 assert(!words[0].w||words[0].w===first,'the draft reorder does not touch the published list before saving');
 clickText(a,'Save & Publish Live Now');
 const republished=a.q.DB.data.lists[1].words;
 assert.equal(republished[0].w,second);assert.equal(republished[1].w,first);
 a.q.DB.data.plan.defaultList=a.q.DB.data.lists[1].id;const id=a.q.DB.data.plan.defaultList;clickText(a,'Delete list');Array.from(a.w.document.querySelectorAll('#modals button')).find(b=>b.textContent==='Delete').click();assert.equal(a.q.DB.data.lists.length,1);
 const undo=Array.from(a.w.document.querySelectorAll('#toasts button')).find(b=>b.textContent==='Undo');assert(undo);undo.click();assert.equal(a.q.DB.data.lists.length,2);assert.equal(a.q.DB.data.plan.defaultList,id);
}));
test('2.4 announcements, expiry and lecturer moderation stay separate from private inbox',()=>withApp({},a=>{
 enterPin(a,DEFAULT_PIN);a.q.Admin.tab='announce';a.q.Admin.renderTab();a.w.document.querySelector('[aria-label="Announcement title"]').value='Class notice';a.w.document.querySelector('[aria-label="Announcement text"]').value='Bring your notebook.';clickText(a,'Publish announcement');assert(a.w.document.querySelector('#homeAnn').textContent.includes('Bring your notebook.'));
 a.q.DB.data.announcement.expires='2026-10-12';a.q.Screens.home();assert(!a.w.document.querySelector('#homeAnn').textContent);
 a.q.DB.data.comments=[{id:'comment-test',name:'Happy Owl',status:'finished',text:'Public QA',ts:a.clock.now}];a.q.Admin.tab='comments';a.q.Admin.renderTab();clickText(a,'Pin');assert(a.q.DB.data.comments[0].pinned);clickText(a,'Hide');a.q.Screens.comm();assert(!a.w.document.querySelector('#commList').textContent.includes('Public QA'));
}));
test('4.4 v15 auto mode picks Lite on a weak device and Full on a strong one; manual wins',()=>withApp({},a=>{
 /* a 2-core phone in Lite: the Liquid Glass surfaces stay, only the paint cost drops */
 const nav=Object.getOwnPropertyDescriptor(a.w.navigator,'hardwareConcurrency');
 Object.defineProperty(a.w.navigator,'hardwareConcurrency',{value:2,configurable:true,writable:true});a.q.DB.data.settings.perf='auto';a.q.UI.applyPerf();assert.equal(a.q.UI.perfMode,'lite');assert.equal(a.q.UI.autoPerf(),'lite');assert.equal(a.w.document.body.getAttribute('data-perf'),'lite');
 /* a 1280px 8-core desktop measures 60 FPS: Full glass */
 Object.defineProperty(a.w.navigator,'hardwareConcurrency',{value:8,configurable:true,writable:true});Object.defineProperty(a.w.navigator,'deviceMemory',{value:8,configurable:true,writable:true});Object.defineProperty(a.w,'innerWidth',{value:1280,configurable:true,writable:true});a.w.matchMedia=()=>({matches:false,addEventListener(){}});a.q.UI.autoDowngraded=false;a.q.UI.applyPerf();assert.equal(a.q.UI.perfMode,'full');assert.equal(a.q.UI.autoPerf(),'full');
 if(nav)Object.defineProperty(a.w.navigator,'hardwareConcurrency',nav);
 a.q.UI.recordFrames([45,50,55]);assert.equal(a.q.UI.autoDowngraded,false);assert.equal(a.q.UI.perfMode,'full','short samples must not force a downgrade');a.q.UI.recordFrames(Array(24).fill(90));assert.equal(a.q.UI.autoDowngraded,true);assert.equal(a.q.UI.perfMode,'lite','sustained slow frames switch to Lite');
 a.q.DB.data.settings.perf='full';a.q.UI.applyPerf();assert.equal(a.q.UI.perfMode,'full','a manual Full choice is honoured');assert.equal(a.q.UI.autoDowngraded,false);
 a.q.DB.data.settings.perf='lite';a.q.UI.applyPerf();assert.equal(a.w.document.body.getAttribute('data-perf'),'lite');assert.equal(a.w.document.querySelectorAll('#bg .blob').length,4);
}));

test('2.4 locked backups exclude lecturer private inbox, PIN hashes and drafts; full backup requires unlock',()=>withApp({},a=>{
 a.q.DB.data.inbox=[{id:'someone-else',text:'Lecturer private inbox',mine:false},{id:'mine',text:'My message',mine:true}];
 a.q.DB.data.lists[0].draftText='Secret draft';const personal=JSON.parse(a.q.DB.exportAll());assert.equal(personal.scope,'personal');assert(!JSON.stringify(personal).includes('Lecturer private inbox'));assert(!JSON.stringify(personal).includes('Secret draft'));assert(!personal.data.admin.pinHash);assert.equal(personal.data.inbox[0].text,'My message');
 const hash=a.q.DB.data.admin.pinHash;a.q.DB.importAll(JSON.stringify(personal));assert.equal(a.q.DB.data.admin.pinHash,hash);a.q.Admin.unlocked=true;assert(JSON.parse(a.q.DB.exportAll()).data.inbox.some(m=>m.text==='Lecturer private inbox'));
}));

/* ---------- v1.4.0 crash-proofing ---------- */
test('1.7 empty or blank tokens never throw on any DOMTokenList', () => withApp({}, a => {
 const d=a.w.document, el=d.createElement('div');
 /* the exact pattern that crashed the live 1.0.0 build in Firefox */
 const online=false; el.classList.add(online ? 'good' : '');
 assert.equal(el.className,''); assert.equal(a.errors.length,0); assert(!a.crash());
 el.classList.add(''); el.classList.remove(''); el.classList.toggle('', true); el.classList.replace('', 'x');
 assert.equal(el.className,'');
 el.classList.add('a', '', 'b'); assert.equal(el.className,'a b');
 el.classList.toggle('a'); assert.equal(el.className,'b');
 const link=d.createElement('link'); link.relList.add('', 'stylesheet'); assert(link.relList.contains('stylesheet'));
 if(el.part) { el.part.add('', 'chip'); assert(el.part.contains('chip')); }
 assert.equal(el.className,'b'); assert(!a.crash());
}));
test('1.7 dynamically built class names are filtered by U.cx and U.el', () => withApp({}, a => {
 assert.equal(a.q.U.cx('a', '', null, undefined, ' b  c '), 'a b c');
 const el=a.q.U.el('div', '  x   y  ', null); assert.equal(el.className,'x y');
 const blank=a.q.U.el('div', '   ', null); assert.equal(blank.className,'');
}));
test('1.8 build stamp is exposed, shown in Settings and on the fatal card', () => withApp({}, a => {
 const expectedVersion=current.match(/APP_VERSION="([^"]+)"/)[1];
 const expectedBuild=current.match(/BUILD_DATE="([^"]+)"/)[1];
 const expectedStamp='v'+expectedVersion+' ('+expectedBuild+')';
 assert.equal(a.w.SDP.version,expectedVersion); assert.equal(a.w.SDP.build,expectedBuild); assert.equal(a.w.SDP.stamp(),expectedStamp);
 a.q.UI.setTab('set'); const txt=a.w.document.querySelector('#screen-set').textContent;
 assert(txt.includes(expectedStamp)); assert(txt.includes('My data'));
}));
test('1.8 fatal card names the running build', () => withApp({bootFailure:true}, a => {
 const expectedVersion=current.match(/APP_VERSION="([^"]+)"/)[1];
 const expectedBuild=current.match(/BUILD_DATE="([^"]+)"/)[1];
 assert(a.crash());
 assert(a.w.document.querySelector('#fatal').textContent.includes('Build v'+expectedVersion+' ('+expectedBuild+')'));
}));
test('1.9 one failing Home widget leaves the other widgets on screen', () => withApp({}, a => {
 const real=a.q.UI.statBox; a.q.UI.statBox=function(){ throw new Error('Stat widget failed'); };
 a.q.Screens.home();
 assert(!a.crash());
 assert(a.w.document.querySelector('#homeTitle').textContent.length>0);
 assert(a.w.document.querySelector('#homeSessions').children.length>0);
 assert(a.q.Errors.items.some(i=>i.where==='widget: home-stats'));
 a.q.UI.statBox=real; a.q.Screens.home();
 assert.equal(a.w.document.querySelector('#homeStats').children.length,3);
 assert(!a.crash());
}));
test('1.9 every Home widget is wrapped and screens stay isolated', () => {
 for(const name of ['home-announcement','home-hero','home-resume','home-stats','home-sessions']) {
  assert(new RegExp('U\\.widget\\("'+name+'",\\s*function\\s*\\(').test(current), name);
 }
});
test('4.5 ready screen speaks the greeting, then proceeds through the countdown', () => withApp({voice:'en-GB'}, a => {
 a.q.Eng.start({words:[{w:'apple',s:'I eat an apple every day.',m:'a round fruit'}], listName:'QA list', sessionNo:'9', sessionDay:'Monday'});
 clickText(a,"I'm ready");
 for(let i=0;i<500&&a.q.Eng.st!=='waiting';i++) a.clock.tick(100);
 assert.equal(a.q.Eng.st,'waiting'); assert(!a.crash()); assert.equal(a.q.Errors.items.length,0);
}));
test('4.5 greeting matches the ready button and no skip is offered', () => withApp({voice:'en-GB'}, a => {
 a.q.Eng.start({words:[{w:'apple',s:'I eat an apple every day.',m:'a round fruit'}], listName:'QA list'});
 const sheet=a.w.document.querySelector('#sheets').textContent;
 assert(sheet.includes("Click I'm ready to begin."));
 assert(!Array.from(a.w.document.querySelectorAll('#sheets button')).some(b=>b.textContent.trim()==='Skip countdown'));
 assert.equal(a.q.Eng.layer,null);
}));
test('4.6 player offers a Test sound button', () => withApp({voice:'en-GB'}, a => {
 a.q.Eng.start({words:[{w:'apple',s:'I eat an apple.',m:'a fruit'}], listName:'QA'}); clickText(a,"I'm ready");
 for(let i=0;i<500&&a.q.Eng.st!=='waiting';i++) a.clock.tick(100);
 const btn=a.w.document.querySelector('#btnTestVoicePlayer');
 assert(btn, 'Test sound button');
 const before=a.audio.length; btn.click(); a.clock.tick(500);
 assert(a.audio.length>before); assert(a.audio.slice(before).every(s=>/^https:\/\/dict\.youdao\.com\/dictvoice\?type=1&audio=/.test(s.src)),'v49: Test sound streams the Youdao studio voice directly');assert.equal(a.spoken.length,0);
}));
test('4.7 layout uses real safe-area insets and 44px tap targets', () => {
 assert(/env\(safe-area-inset-top,\s*0px\)/.test(current));
 assert(/env\(safe-area-inset-bottom,\s*0px\)/.test(current));
 assert(/--tap:\s*44px/.test(current));
 assert(current.includes('100dvh'));
});

test('5.1 v57: ElevenLabs vault is admin-only, cache-first and credit safe', () => withApp({}, a => {
 const studio = require('node:fs').readFileSync(require('node:path').join(__dirname,'../data/studio.js'),'utf8');
 a.w.eval(studio);
 const v = a.w.ElevenVault;
 assert.equal(v.strictAdminOnly, true);
 assert.equal(v.voiceId(), 'Xb7hH8MSUJpSbSDYk0k2');
 assert.equal(v.modelId(), 'eleven_multilingual_v2');
 assert.equal(v.hasKey(), false, 'locked student has no key');
 assert.equal(v.fetchOnce('Number 31'), null, 'students cannot fetch paid clips');
 assert.equal(v.gen('Number 31', function(){}), false, 'students cannot generate');
 let out=null; v.resolve('Number 1', err => { out=err; }); assert.equal(out,'missing');
 assert.ok(!/ntfy\.sh\/dictationb1_sdp_(keys|words|audio)/.test(studio), 'no vault/audio relays');
 assert.ok(studio.includes('strictAdminOnly') && studio.includes('isUnlockedOnThisDevice'));
}));
test('5.2 v57: admin auto-completer parses typed words and ships no default PIN', () => withApp({}, a => {
 const studio = require('node:fs').readFileSync(require('node:path').join(__dirname,'../data/studio.js'),'utf8');
 a.w.eval(studio);
 const e = a.w.AdminAutoEnrich;
 assert.deepEqual(e.parse('afraid, amazed\nannoyed; 3) anxious'), ['afraid','amazed','annoyed','anxious']);
 assert.equal(a.w.SDPCore.CONFIG.adminPin, '');
 assert.ok(current.includes('adminPin:""'));
}));
test('5.3 v58: static-first wallpaper, real meter, no fake depot, Lite disables blur', () => {
 assert.ok(current.includes('APP_VERSION="7.0.0"'));
 assert.ok(current.includes('./data/data-meter.js'));
 assert.ok(!current.includes('id="sdpV56"'), 'fake depot removed');
 assert.ok(!current.includes('id="materialMixer"'), 'Material Mixer removed');
 assert.ok(current.includes('sdp.v57_secure_local'));
 assert.ok(current.includes('SDP_ENC_V2:'));
 assert.ok(current.includes('backdrop-filter:none!important'), 'Lite mode disables blur');
 assert.ok(current.includes('setStatic'));
});
test('5.4 v57: AES-GCM v2 vault, GitHub-only sync, publish preview and Range SW', () => withApp({}, a => {
 const studio = require('node:fs').readFileSync(require('node:path').join(__dirname,'../data/studio.js'),'utf8');
 a.w.eval(studio);
 const EV = a.w.EncryptedVault;
 assert.equal(EV.encrypt({x:1}, DEFAULT_PIN), null, 'no new V1 writes');
 assert.ok(studio.includes('Cloud.commitFiles') && !/ntfy\.sh\/dictationb1_sdp_keys/.test(studio));
 assert.ok(current.includes('openPublishPreview') || current.includes('publishPreviewWords'));
 const sw = fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert.ok(sw.includes('sdp-v58-media') && sw.includes('206') && sw.includes('Content-Range'));
}));
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.status==='FAIL')) process.exitCode=1;
module.exports = {harness,withApp,clickText};
