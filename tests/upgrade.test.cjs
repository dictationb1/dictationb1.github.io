const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,html}=require('./app-harness.cjs');
const crypto=require('node:crypto');
const sample=`hobbies, leisure, barbecue, camping, collection, cruise,
dancing, drawing, facilities, festival, fiction, gallery,
go shopping, guitar, hire, hike, holidays, jogging,
magazine, musician, nightlife, painting, party,
photograph, picnic, quiz, sculpture, sightseeing,
sunbathe, torch`;
const expected=sample.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
const fixtures=[
 ['exact lecturer paste',sample,expected],
 ['CRLF',sample.replace(/\n/g,'\r\n'),expected],
 ['CR only','apple\rpear',['apple','pear']],
 ['trailing commas','apple,pear,,,',['apple','pear']],
 ['commas all lines','apple,pear\nplum,peach',['apple','pear','plum','peach']],
 ['semicolons','apple; pear; go shopping',['apple','pear','go shopping']],
 ['inline bullets','• apple • pear • go shopping',['apple','pear','go shopping']],
 ['mixed separators','apple, pear; plum\n• peach',['apple','pear','plum','peach']],
 ['smart double quotes','“apple”, “pear”',['apple','pear']],
 ['smart apostrophes','traveller’s cheque',['traveller\'s cheque']],
 ['numbers','1. apple\n2) pear\n3: plum',['apple','pear','plum']],
 ['numbers after comma','1. apple, 2. pear',['apple','pear']],
 ['hyphen bullets','- apple\n- pear',['apple','pear']],
 ['asterisk bullets','* apple\n* pear',['apple','pear']],
 ['dash bullets','– apple\n— pear',['apple','pear']],
 ['hyphenated','part-time, check-in',['part-time','check-in']],
 ['one per line','apple\npear',['apple','pear']],
 ['literal word is not a CSV header','word',['word']],
 ['empty','',[]],
 ['spaces only',' \n\t ',[]],
 ['blank lines','\napple\n\npear\n',['apple','pear']],
 ['BOM','\ufeffapple,pear',['apple','pear']],
 ['deduplicate case','Apple,apple,APPLE, pear',['Apple','pear'],1,2],
 ['preserve multi-word','go shopping, take a break',['go shopping','take a break']],
 ['tab Excel','apple\tI eat one every day.\ta fruit\npear\tWe grow pears at home.\ta fruit',['apple','pear'],'columns'],
 ['pipe columns','apple | I like it. | fruit\npear | I eat it. | fruit',['apple','pear'],'columns'],
 ['two pipe columns','apple | I eat apples.\npear | I eat pears.',['apple','pear'],'columns'],
 ['CSV header short sentence','word,sentence,meaning\napple,Eat apples.,fruit',['apple'],'columns'],
 ['CSV reordered header','meaning,word,sentence\nfruit,apple,Eat apples.',['apple'],'columns'],
 ['CSV quoted comma','word,sentence,meaning\napple,"Red, green or yellow.",fruit',['apple'],'columns'],
 ['CSV escaped quote','word,sentence,meaning\napple,"She says ""eat apples"".",fruit',['apple'],'columns'],
 ['CSV multiline quoted cell','word,sentence,meaning\napple,"I eat apples\nevery day.",fruit',['apple'],'columns'],
 ['CSV inferred sentence','apple,I eat apples every day.,fruit\npear,I eat pears at home.,fruit',['apple','pear'],'columns'],
 ['short CSV never columns','apple,pear,plum\npeach,lemon,lime',['apple','pear','plum','peach','lemon','lime']],
 ['CSV empty trailing cells with header','word,sentence,meaning\napple,,\npear,,',['apple','pear'],'columns'],
 ['200 words',Array.from({length:200},(_,i)=>'word'+String.fromCharCode(97+(i/26|0))+String.fromCharCode(97+i%26)).join(','),null],
 ['apostrophes',"traveller's cheque, don't",["traveller's cheque","don't"]],
 ['accented words','café, résumé',['café','résumé']]
];
const a=harness();
for(const [name,input,words,mode,dupes] of fixtures)test('paste: '+name,()=>{
 const r=a.q.Admin.parseWords(input);
 assert.deepEqual(Array.from(r.items,x=>x.w),words||Array.from({length:200},(_,i)=>'word'+String.fromCharCode(97+(i/26|0))+String.fromCharCode(97+i%26)));
 assert.equal(r.mode,mode==='columns'?'columns':'plain list');assert.equal(r.problems.length,0);assert.equal(r.dupes,dupes||0);
});
test('paste: lecturer fixture has exactly 30 and no lost phrases',()=>{assert.equal(expected.length,30);assert.equal(a.q.Admin.parseWords(sample).items[12].w,'go shopping');});
test('paste: explicit switch, extra cells flagged rather than silently saved',()=>{const r=a.q.Admin.parseWords('apple,pear,plum,peach','columns');assert.equal(r.mode,'columns');assert.equal(r.problems.length,1);});
test('paste: unclosed quotes, invalid symbols and empty column word flagged',()=>{
 assert(a.q.Admin.parseWords('"apple,pear').problems.length);
 assert.equal(a.q.Admin.parseWords('apple2, <script>, '+ 'a'.repeat(41)).problems.length,3);
 assert(a.q.Admin.parseWords('word,sentence,meaning\n,example,meaning').problems.length);
});
test('paste: inconsistent tab/CSV columns require correction',()=>{assert(a.q.Admin.parseWords('apple\tA fruit\npear,A fruit').problems.length);});
test('paste: round trip retains meaning without sentence and quoted text',()=>{
 const input=[{w:'apple',s:'',m:'fruit'},{w:'pear',s:'She says "try it, please".',m:'fruit'}];
 assert.deepEqual(JSON.parse(JSON.stringify(a.q.Admin.parseWords(a.q.Admin.wordsText(input)).items)),input);
});
test('schema 2: old student data and custom PIN survive; defaults change only once',()=>{
 const seed=JSON.parse(JSON.stringify(a.q.DB.data));seed.v=1;seed.settings.sentence=true;seed.settings.repeats=3;
 seed.admin.pinSalt='old';seed.admin.pinHash=crypto.createHash('sha256').update('sdp.v1:old:2468').digest('hex');
 seed.history=[{id:'own-history',answers:['synthetic QA answer']}];seed.outbox=[{id:'queued',action:'result'}];seed.snapshot={words:[{w:'apple'}],index:0};
 const b=harness(seed);
 try{
  const d=b.q.DB.data;assert.equal(d.v,2);assert.equal(d.settings.sentence,false);assert.equal(d.settings.repeats,2);
  for(const key of ['admin','history','outbox','snapshot','lists','plan'])assert.deepEqual(JSON.parse(JSON.stringify(d[key])),seed[key]);
  assert.equal(b.w.localStorage.getItem('sdp.v1.before-v2'),JSON.stringify(seed));
  d.settings.sentence=true;d.settings.repeats=3;b.q.DB.migrate(d);assert.equal(d.settings.sentence,true);assert.equal(d.settings.repeats,3);
  assert.equal(JSON.parse(b.w.localStorage.getItem('sdp.v1')).v,2);
 }finally{b.close();}
});
test('dictation: default beats are Number, word, word; optional sentence opt-in',()=>{
 const {Eng,DB}=a.q;Eng.words=[{w:'apple',s:'I eat apples every day.'}];Eng.order=[0];
 assert.deepEqual(Array.from(Eng.buildBeats(0).filter(b=>b.t==='say'),b=>b.text),['Number 1.','apple','apple']);
 assert(Eng.buildBeats(0).find(b=>b.t==='write').secs>=4);assert.equal(DB.data.settings.rate,0.85);
 DB.data.settings.sentence=true;assert(Eng.buildBeats(0).some(b=>b.text==='I eat apples every day.'));DB.data.settings.sentence=false;
});
for(const lang of ['en-GB','en_GB','en-UK','eng-GBR','en-GB-x-test'])test('UK voice: '+lang,()=>assert(a.q.Speech.isUK({lang,name:'test'})));
for(const name of ['UK English','British','Daniel','Kate','Serena','Hazel','George','Susan','Libby','Sonia','Ryan'])test('UK voice name: '+name,()=>assert(a.q.Speech.isUK({lang:'en',name})));
test('UK voice: named hints never override explicit US/other locale',()=>{for(const lang of ['en-US','en-AU','en-IN','fr-FR'])assert.equal(a.q.Speech.isUK({lang,name:'Daniel British'}),false);});
test('UK voice: vanished voices clear stale selection',()=>{
 a.q.Speech.supported=true;a.w.speechSynthesis={getVoices:()=>[{lang:'en_GB',name:'Daniel'}]};a.q.Speech.readVoices();assert(a.q.Speech.chosen);
 a.w.speechSynthesis.getVoices=()=>[];a.q.Speech.readVoices();assert.equal(a.q.Speech.chosen,null);a.q.Speech.supported=false;
});
test('PIN: shipped HTML has only precomputed verifier, default still verifies',()=>{
 const pin=require('./test-pin.cjs');assert.equal(html.includes(pin),false);
 assert.equal(a.q.DB.data.admin.pinHash,crypto.createHash('sha256').update('sdp.v1:'+a.q.DB.data.admin.pinSalt+':'+pin).digest('hex'));
});
test('PIN: PBKDF2 matches independent Node derivation and rejects unavailable crypto',async()=>{
 const b=harness(null,{crypto:true});
 try{
  const hash=await new Promise(resolve=>b.q.Admin.hashPin('2468','fixedsalt',resolve,'pbkdf2-sha256'));
  assert.equal(hash,crypto.pbkdf2Sync('2468','sdp.v1:fixedsalt',120000,32,'sha256').toString('hex'));
  a.q.Admin.hashPin('2468','fixedsalt',value=>assert.equal(value,null),'pbkdf2-sha256');
 }finally{b.close();}
});
test('performance: live median downgrade persists, manual Full respected',()=>{
 const {UI,DB}=a.q;UI.autoDowngraded=false;DB.data.settings.perf='auto';UI.recordFrames([16,16,17,16]);assert(!UI.autoDowngraded);
 UI.recordFrames([25,30,26,28]);assert.equal(UI.perfMode,'lite');UI.recordFrames([16,16,16]);assert.equal(UI.perfMode,'lite');
 DB.data.settings.perf='full';UI.applyPerf();assert.equal(UI.perfMode,'full');DB.data.settings.perf='auto';
});
test('class dates: today plus next four Tuesdays/Wednesdays over year boundary',()=>{
 const dates=Array.from(a.q.Admin.classDates(new Date(2026,11,30,12)));assert.deepEqual(dates,['2026-12-30','2027-01-05','2027-01-06','2027-01-12','2027-01-13']);
});
test('static: app is ES5 syntax, under 450KB, no runtime dependency',()=>{
 const script=Array.from(a.w.document.scripts).find(s=>!s.type&&s.textContent.includes('var APP_VERSION')).textContent;
 require('acorn').parse(script,{ecmaVersion:5});assert(Buffer.byteLength(html)<450000);assert.equal(a.w.document.querySelectorAll('script[src]').length,0);
});
test.after(()=>a.close());
module.exports={sample};
