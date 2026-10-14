'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const {html, scripts, app} = require('./upgrade-harness.cjs');
const baseline = process.argv.includes('--baseline');
const securityOnly = process.argv.includes('--security');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}
const paste = 'hobbies, leisure, barbecue, camping, collection, cruise,\n' +
 'dancing, drawing, facilities, festival, fiction, gallery,\n' +
 'go shopping, guitar, hire, hike, holidays, jogging,\n' +
 'magazine, musician, nightlife, painting, party,\n' +
 'photograph, picnic, quiz,\nsunbathe, torch';
if (!securityOnly) {
 const a = app(), q = a.q;
 try {
  test('B1: six-line paste reads 28 words without invented fields', () => {
   const r = q.Admin.parseWords(paste);
   assert.equal(r.items.length, 28);
   assert.equal(r.items[0].w, 'hobbies');
   assert.equal(r.items[0].s, ''); assert.equal(r.items[0].m, '');
   assert(r.items.some(x => x.w === 'go shopping'));
   assert.equal(r.problems.length, 0);
   assert.equal(r.read, 28); assert.equal(r.skipped, 0);
  });
  test('B2: lecturer tabs and unlocked banner do not stick over each other', () => {
   for (const cls of ['admintabs', 'unlockedbar']) {
    const rule = html.match(new RegExp('\\.' + cls + ' \\{([^}]+)'))[1];
    assert(!/position:\s*sticky/.test(rule), cls + ' must scroll normally');
   }
  });
  test('B6: default is two readings, no sentence, numbers, rate and pause kept', () => {
   const s = q.defaultData().settings;
   assert.equal(s.sentence, false); assert.equal(s.repeats, 2);
   assert.equal(s.numbers, true); assert.equal(s.rate, 0.85); assert.equal(s.pauseWord, 1.2);
  });
  test('B6: saved v1.4.0 migration keeps settings and Thursday list', () => {
   const d = JSON.parse(fs.readFileSync(__dirname + '/fixtures/v1.4.0.json'));
   const lists = JSON.stringify(d.lists);
   const m = q.DB.migrate(d);
   assert.equal(m.settings.sentence, false);
   assert.equal(m.settings.rate, 0.7); assert.equal(m.settings.theme, 'dark');
   assert.equal(JSON.stringify(m.lists), lists);
   assert.equal(m.plan.weekdays[3], 'thursday');
   m.settings.sentence = true; m.settings.sentenceTouched = true;
   assert.equal(q.DB.migrate(m).settings.sentence, true);
  });
  test('B7: expired override cannot hide the scheduled list', () => {
   const d = q.DB.data, today = q.U.dateKey(new Date());
   d.lists.push({id:'override',name:'Old override',published:true,words:[{w:'torch',s:'',m:''}]});
   d.plan.pinned = 'override'; d.plan.pinnedDate = '2001-01-01';
   d.plan.dates[today] = d.lists[0].id;
   assert.equal(q.Lib.current().id, d.lists[0].id);
   assert.equal(q.Lib.forDate(new Date()).id, d.lists[0].id);
  });
  test('B6: default beat order is number, word, pause, word, writing time', () => {
   q.DB.data = q.defaultData(); q.Eng.words=[{w:'torch',s:'Take your torch when we go outside.',m:''}];q.Eng.order=[0];
   const beats=Array.from(q.Eng.buildBeats(0),b=>({t:b.t,text:b.text,ms:b.ms}));
   assert.deepStrictEqual(beats.map(b=>b.t),['say','wait','say','wait','say','write']);
   assert.deepStrictEqual(beats.filter(b=>b.t==='say').map(b=>b.text),['Number 1.','torch','torch']);
   assert.equal(beats[3].ms,1200);
  });
  test('B6: both sentence switches mark the choice and retain it on migration', () => {
   q.Screens.settings();
   a.w.document.querySelector('#screen-set [aria-label="Read the example sentence"]').click();
   assert.equal(q.DB.data.settings.sentenceTouched,true);assert.equal(q.DB.data.settings.sentence,true);
   assert.equal(q.DB.migrate(q.DB.data).settings.sentence,true);
   q.Admin.unlocked=true;q.Admin.tab='session';q.Admin.panel();
   a.w.document.querySelector('#adminHost [aria-label="Read the example sentence"]').click();
   assert.equal(q.DB.data.settings.sentence,false);assert.equal(q.DB.data.settings.sentenceTouched,true);
  });
  test('B7: legacy override gets today once; reload does not renew it', () => {
   const d=JSON.parse(fs.readFileSync(__dirname+'/fixtures/v1.4.0.json'));
   assert.equal(q.DB.migrate(d).plan.pinnedDate,q.U.dateKey(new Date()));
   d.plan.pinnedDate='2001-01-01';q.DB.migrate(d);assert.equal(d.plan.pinnedDate,'2001-01-01');
   assert.equal(d.plan.pinned,'thursday');
  });
  test('B7: active override, banners, date and weekday resolution; future dates are not pinned', () => {
   q.DB.data=q.defaultData();const d=q.DB.data,today=q.U.dateKey(new Date());
   d.lists.push({id:'override',name:'Today only',published:true,words:[{w:'torch',s:'',m:''}]});
   d.plan.pinned='override';d.plan.pinnedDate=today;d.plan.dates[today]=d.lists[0].id;
   assert.equal(q.Lib.current().id,'override');assert.equal(q.Lib.forDate(new Date()).id,'override');
   const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
   assert.equal(q.Lib.forDate(tomorrow).id,d.lists[0].id);
   q.Screens.home();q.Admin.unlocked=true;q.Admin.panel();
   assert(a.w.document.querySelector('#homeAnn').textContent.includes('Override for today only'));
   assert(a.w.document.querySelector('#adminOverride').textContent.includes('Override for today only'));
   d.plan.pinnedDate='2001-01-01';q.Screens.home();q.Admin.renderTab();
   assert(!a.w.document.querySelector('#homeAnn').textContent.includes('Override for today only'));
   assert.equal(a.w.document.querySelector('#adminOverride').textContent,'');
   assert.equal(q.Lib.current().id,d.lists[0].id);
   delete d.plan.dates[today];d.plan.weekdays[q.U.weekdayIndex(new Date())]='override';
   assert.equal(q.Lib.current().id,'override');
  });
  test('B7: expiry survives cloud round trips, including old servers', () => {
   q.DB.data=q.defaultData();const d=q.DB.data;
   q.Cloud.applyState({plan:[{key:'pinned',listId:d.lists[0].id},{key:'pinnedDate',listId:'2001-01-01'}]});
   assert.equal(d.plan.pinnedDate,'2001-01-01');assert.equal(q.Lib.activeOverride(new Date()),null);
   q.Cloud.applyState({plan:[{key:'pinned',listId:d.lists[0].id}]});
   assert.equal(d.plan.pinnedDate,'2001-01-01');
  });
  test('Local PIN cleanup: load, reset and import never seed a PIN', () => {
   q.DB.reset();assert.equal(q.DB.data.admin.pinHash,'');
   assert(q.DB.importAll(fs.readFileSync(__dirname+'/fixtures/v1.4.0.json','utf8')).ok);
   assert.equal(q.DB.data.admin.pinHash,'');q.DB.load();assert.equal(q.DB.data.admin.pinHash,'');
   let mode;q.Admin.unlocked=false;q.Admin.pad=m=>{mode=m;};q.Admin.open();assert.equal(mode,'create');
  });
 } finally { a.close(); }
}
if (baseline || securityOnly) {
 test('B5: shared admin check counts wrong attempts, not just login', () => {
  const cache = {}, expected = String(crypto.randomInt(100000, 999999));
  const wrong = String((Number(expected) + 1) % 1000000).padStart(6, '0');
  const c = vm.createContext({PropertiesService:{getScriptProperties:() => ({getProperty:() => expected})},
   CacheService:{getScriptCache:() => ({get:k => cache[k] || null,put:(k,v) => {cache[k] = String(v);}})}});
  vm.runInContext(scripts().gas, c);
  for (let i = 0; i < 5; i++) assert.equal(c.adminOk({pin:wrong}), false);
  // Never print either throwaway value, even if this assertion fails.
  assert(Number(cache.adminUntil) > Date.now(), 'wrong attempts did not start a lockout');
 });
}
console.log('Upgrade regression tests: ' + passed + ' passed, ' + failed + ' failed.');
if (!baseline && !securityOnly) console.log('Scope: phase 1 only. B5 server security is not included; run with --security.');
if (failed) process.exitCode = 1;
module.exports = {paste};
