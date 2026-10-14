'use strict';
const assert = require('assert');
const {performance} = require('perf_hooks');
const {app} = require('./upgrade-harness.cjs');
const a = app(), parse = text => a.q.Admin.parseWords(text);
let count = 0, failed = 0;
function test(name, fn) { try { fn(); count++; console.log('PASS ' + name); } catch(e) { failed++; console.log('FAIL ' + name + ': ' + e.message); } }
function invariant(r) { assert.equal(r.read, r.items.length + r.dupes + r.skipped); }
function words(text, expected) { const r=parse(text); invariant(r); assert.deepStrictEqual(Array.from(r.items,x=>x.w),expected); return r; }
try {
 test('one per line and one long comma-separated paragraph', () => {
  words('torch\nhire\ngo shopping',['torch','hire','go shopping']);
  words('torch, hire, go shopping,',['torch','hire','go shopping']);
 });
 test('semicolon, CRLF, phone-wrapped lines, bullets and numbering', () => {
  words('1. Torch; 2) hire;\r\n• go shopping\r\n- picnic\n— quiz\n\n',['Torch','hire','go shopping','picnic','quiz']);
 });
 test('pipe and TAB rows; missing sentence does not erase meaning', () => {
  const r=words('torch | Take your torch when we go outside. | a small light\nhire\tWe hire a car for our summer holiday.\tpay to use\nquiz | | a game of questions',['torch','hire','quiz']);
  assert.equal(r.items[2].s,''); assert.equal(r.items[2].m,'a game of questions');
 });
 test('CSV header, quoted comma, escaped quotes, semicolon CSV', () => {
  const r=words('word,sentence,meaning\n"torch","Take your torch, and follow me outside.","a small light"\n"hire","We say ""hire"" when we pay to use something.","pay to use"',['torch','hire']);
  assert.equal(r.items[0].s,'Take your torch, and follow me outside.');
  assert(r.items[1].s.includes('"hire"')); assert.equal(r.format,'csv');
  assert.equal(parse('word;sentence;meaning\ntorch;;a small light').items[0].m,'a small light');
 });
 test('sentence heuristics, not a three-column assumption', () => {
  const r=words('torch, Take your torch when we go outside, a light',['torch']);
  assert.equal(r.items[0].m,'a light');
  assert.equal(parse('torch, Come here.').items[0].s,'Come here.');
  words('hobbies, leisure, barbecue, camping',['hobbies','leisure','barbecue','camping']);
 });
 test('two-item hint is explicit and default preserves both words', () => {
  const r=words('torch, flashlight',['torch','flashlight']);
  assert.equal(r.hints.length,1); assert.equal(r.hints[0].line,1);
  assert.equal(r.hints[0].m,'flashlight');
 });
 test('smart quotes, non-breaking spaces, invisible text and soft hyphens', () => {
  const r=words('\ufeff“torch”,“Take your torch when we go outside.”,“a light”\r\ngo\u00a0 shopping\npic\u00adnic\nhi\u200bre',['torch','go shopping','picnic','hire']);
  assert.equal(r.items[0].m,'a light');
 });
 test('preserve case, spelling and order; list every duplicate', () => {
  const r=words('Color, torch\ncolor\nTorch',['Color','torch']);
  assert.equal(r.dupes,2); assert.equal(r.problems.filter(x=>x.includes('duplicate removed')).length,2);
  assert(r.problems.some(x=>x.includes('American spelling kept')));
 });
 test('malformed rows, junk and extra columns have visible reasons', () => {
  const r=parse('---\n123\n<img>\n"unclosed, quote\nword | sentence | meaning | extra\n'+'a'.repeat(41));
  invariant(r); assert.equal(r.items.length,0); assert.equal(r.skipped,6); assert.equal(r.problems.length,6);
  assert(r.problems.some(x=>x.includes('extra')));
 });
 test('no silent field truncation; blank lines and trailing separators ignored', () => {
  const r=parse('torch | '+ 'a'.repeat(501) +' | light\n\n\nquiz,,,\n');
  invariant(r); assert.equal(r.skipped,1); assert.equal(r.read,2); assert.equal(r.items[0].w,'quiz');
 });
 test('200-word bound accounts for every excess item', () => {
  const text=Array.from({length:235},(_,i)=>'word'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26)).join(',');
  const r=parse(text); invariant(r); assert.equal(r.read,235); assert.equal(r.items.length,200); assert.equal(r.skipped,35); assert.equal(r.problems.length,35);
 });
 test('randomised accounting invariant over 1000 mixed inputs', () => {
  let seed=0x35cabe;
  function rand(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
  const samples=['torch','hire','go shopping','quiz','<junk>','23','a'.repeat(42),'','word | sentence | meaning | extra','"bad quote'];
  for(let n=0;n<1000;n++) {
   const cells=Array.from({length:rand(80)+1},()=>samples[rand(samples.length)]);
   const r=parse(cells.join([',',';','\n','\r\n'][rand(4)])); invariant(r);
   assert(r.items.length<=200); assert(r.problems.length>=r.dupes+r.skipped);
  }
 });
 test('5000 lines under 50 ms on this Node host (ten runs after warm-up)', () => {
  const text=Array.from({length:5000},(_,i)=>'word'+String.fromCharCode(97+Math.floor(i/676)%26)+String.fromCharCode(97+Math.floor(i/26)%26)+String.fromCharCode(97+i%26)).join('\n');
  for(let i=0;i<3;i++)parse(text);
  const times=[];for(let i=0;i<10;i++){const t=performance.now(),r=parse(text);times.push(performance.now()-t);invariant(r);assert.equal(r.read,5000);}
  const worst=Math.max(...times);console.log('5000-line parser maximum: '+worst.toFixed(2)+' ms');assert(worst<50);
 });
} finally { a.close(); }
console.log('Parser tests: '+count+' passed, '+failed+' failed.');if(failed)process.exitCode=1;
