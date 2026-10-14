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
