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
test('paste: round trip keeps the meaning and the quoted text, and fills a blank sentence',()=>{
 const input=[{w:'apple',s:'',m:'fruit'},{w:'pear',s:'She says \"try it, please\".',m:'fruit'}];
 const items=JSON.parse(JSON.stringify(a.q.Admin.parseWords(a.q.Admin.wordsText(input)).items));
 assert.deepEqual(items.map(x=>x.w),['apple','pear']);
 assert.equal(items[0].m,'fruit');
 assert(items[0].s.length>10,'a B1 sentence template is generated so s is never blank');
 assert.equal(items[1].s,'She says \"try it, please\".');
 assert.equal(items[1].m,'fruit');
});
test('schema 3: old student data and a custom PIN survive; v2 defaults apply once',()=>{
 const seed=JSON.parse(JSON.stringify(a.q.DB.data));seed.v=1;seed.settingsRev=1;seed.settings.sentence=true;seed.settings.repeats=3;
 seed.admin.pinSalt='old';seed.admin.pinHash=crypto.createHash('sha256').update('sdp.v1:old:2468').digest('hex');
 seed.history=[{id:'own-history',answers:['synthetic QA answer']}];seed.outbox=[{id:'queued',action:'result'}];seed.snapshot={words:[{w:'apple'}],index:0};
 seed.lists[0].name='My old list';
 const b=harness(seed);
 try{
  const d=b.q.DB.data;assert.equal(d.v,3);assert.equal(d.settingsRev,2);assert.equal(d.settings.sentence,false);assert.equal(d.settings.repeats,2);
  assert.equal(d.settings.rate,0.85);assert.equal(d.settings.numbers,true);assert.equal(d.settings.mode,'paper');
  for(const key of ['admin','history','outbox','snapshot'])assert.deepEqual(JSON.parse(JSON.stringify(d[key])),seed[key]);
  const seeded=d.lists.find(l=>l.id==='list_sample_b1');
  assert.equal(seeded.words.length,30);assert.equal(seeded.words[0].w,'hobbies');assert.equal(seeded.words[29].w,'torch');
  assert(seeded.words.every(w=>w.m&&w.s&&/_gb_/.test(w.audio)));
  assert.equal(d.plan.defaultList,'list_sample_b1');assert.equal(d.session.listId,'list_sample_b1');
  assert.equal(b.w.localStorage.getItem('sdp.v1.before-v2'),JSON.stringify(seed));
  d.settings.sentence=true;d.settings.repeats=3;b.q.DB.migrate(d);assert.equal(d.settings.sentence,true);assert.equal(d.settings.repeats,3);
  assert.equal(JSON.parse(b.w.localStorage.getItem('sdp.v1')).v,3);
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
test('class dates: today plus the next eight Tuesdays/Wednesdays over a year boundary',()=>{
 const dates=Array.from(a.q.Admin.classDates(new Date(2026,11,30,12)));assert.deepEqual(dates,['2026-12-30','2027-01-05','2027-01-06','2027-01-12','2027-01-13','2027-01-19','2027-01-20','2027-01-26']);
});
test('static: app is ES5 syntax, under 450KB, no runtime dependency',()=>{
 const script=Array.from(a.w.document.scripts).find(s=>!s.type&&s.textContent.includes('var APP_VERSION')).textContent;
 require('acorn').parse(script,{ecmaVersion:5});assert(Buffer.byteLength(html)<450000);assert.equal(a.w.document.querySelectorAll('script[src]').length,0);
});
/* ======================= v2.0.0 upgrade suite ======================= */
function setOnline(w, value) {
  try { Object.defineProperty(w.navigator, 'onLine', { configurable: true, get() { return value; } }); }
  catch (err) { try { w.navigator.onLine = value; } catch (e2) {} }
}
test('v2: version, schema, settingsRev and dictation defaults', () => {
  assert(html.includes('var APP_VERSION = "2.0.0";'));
  assert.equal(a.q.CONFIG.schema, 3);
  const fresh = a.q.defaultData();
  assert.equal(fresh.settingsRev, 2);
  assert.equal(fresh.settings.sentence, false);
  assert.equal(fresh.settings.repeats, 2);
  assert.equal(fresh.settings.rate, 0.85);
  assert.equal(fresh.settings.numbers, true);
  assert.equal(fresh.settings.mode, 'paper');
  assert.equal(a.q.DB.data.settings.sentence, false);
  assert.deepEqual(Array.from(a.q.Eng.buildBeats.call({ words: [{ w: 'hobbies', s: 'Reading is a hobby.' }], order: [0], st: 'ready' }, 0).filter(b => b.t === 'say'), b => b.text), ['Number 1.', 'hobbies', 'hobbies']);
});
test('v2: the default list is exactly the 30 B1 leisure words, pre-filled', () => {
  const list = a.q.DB.data.lists.find(l => l.id === 'list_sample_b1');
  assert.equal(list.words.length, 30);
  assert.deepEqual(Array.from(list.words, w => w.w), expected);
  assert.equal(list.name, 'B1 Leisure & Hobbies (30 words)');
  assert.equal(list.version, 2);
  assert(list.published);
  list.words.forEach(w => {
    assert(w.m && w.m.length > 10, w.w + ' needs a meaning');
    assert(w.s && w.s.length > 20, w.w + ' needs a sentence');
    assert(/^https:\/\/[^\s]+--_gb_1\.mp3$/.test(w.audio), w.w + ' needs British audio: ' + w.audio);
  });
  assert.equal(list.words[0].m, 'activities that you enjoy doing in your free time');
  assert.equal(list.words[12].w, 'go shopping');
  assert.equal(list.publishedWords.length, 30);
  assert.equal(a.q.DB.data.plan.defaultList, 'list_sample_b1');
  assert.equal(a.q.DB.data.session.listId, 'list_sample_b1');
});
test('v2: pasted words are auto-completed without any extra button', () => {
  const r = a.q.Admin.parseWords('hobbies, leisure, barbecue\n\n1. camping, 2. zzzqq');
  assert.deepEqual(Array.from(r.items, x => x.w), ['hobbies', 'leisure', 'barbecue', 'camping', 'zzzqq']);
  assert.equal(r.items[0].m, 'activities that you enjoy doing in your free time');
  assert.equal(r.items[0].s, 'Reading and gardening are two of my favourite weekend hobbies.');
  assert.equal(r.items[3].m, 'living in a tent on holiday');
  r.items.forEach(it => { assert(it.m.length > 10 && it.s.length > 10, it.w + ' is never blank'); });
  assert.equal(a.q.Admin.bankHit('library').m, 'a place where you borrow books');
  assert(a.q.WORD_BANK.travel.m.length > 5);
  const every = a.q.Admin.parseWords(sample);
  assert.equal(every.items.filter(x => !x.m || !x.s).length, 0);
  assert.equal(every.items.length, 30);
});
test('v2: admin PIN stays the shipped four-digit verifier, with keyboard entry', () => {
  const pin = require('./test-pin.cjs');
  assert.equal(pin.length, 4);
  assert.equal(a.q.DB.data.admin.pinSalt, 'c56a80f01b264e39');
  assert.equal(a.q.DB.data.admin.pinHash, '5cc8204af44727a4da3b0d615fb32939b0f86d8b660efaaf9772fde9d753428b');
  assert.equal(html.includes(pin), false, 'the PIN literal must never appear in the shipped page');
  const pad = html.match(/pad: function \(mode, confirmPin\) \{[\s\S]*?\n  \},\n\n  unlock: function/)[0];
  assert(pad.includes('document.addEventListener("keydown", onKey, true)'));
  assert(pad.includes('"Backspace"'));
  assert(pad.includes('"Enter"'));
  assert(/entry\.length === CONFIG\.minPin/.test(pad));
  assert(/hashPin\(pin, la\.pinSalt/.test(pad), 'cloud PIN failures still fall back to the local PIN');
});
test('v2: typing digits in the PIN pad feeds the same entry as tapping', () => {
  const Admin = a.q.Admin, orig = Admin.hashPin, seen = [];
  Admin.hashPin = (pin, salt, cb) => { seen.push(pin); cb('nomatch'); };
  const sh = Admin.pad('unlock');
  ['7', '8', '9', '8', 'Backspace', '1', 'Enter'].forEach(key =>
    a.w.document.dispatchEvent(new a.w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
  assert.deepEqual(seen, ['7898']);
  a.clock.tick(50);
  a.q.UI.closeSheet();
  Admin.hashPin = orig;
  a.q.DB.data.admin.fails = 0;
  assert(sh);
});
test('v2 audio tiers: dictionary MP3, then streamed British TTS', () => {
  const { Speech } = a.q, seen = [], orig = Speech.playAudio;
  const wasSupported = Speech.supported, wasVoices = Speech.ukVoices, wasTextOnly = Speech.textOnly;
  setOnline(a.w, true);
  Speech.playAudio = (src, rate, ms, cb) => { seen.push(src); assert(rate >= 0.6 && rate <= 1.6); cb(true); };
  Speech.supported = false; Speech.ukVoices = []; Speech.textOnly = false;
  try {
    let res = null;
    Speech.say(['hobbies'], { rate: 0.9 }, r => { res = r; });
    a.clock.tick(400);
    assert.equal(seen.length, 1);
    assert.equal(seen[0], 'https://ssl.gstatic.com/dictionary/static/sounds/oxford/hobbies--_gb_1.mp3');
    assert(res && res.ok === true);
    seen.length = 0;
    res = null;
    Speech.say(['Reading and gardening are two of my favourite hobbies.'], { rate: 1 }, r => { res = r; });
    a.clock.tick(400);
    assert.equal(seen.length, 1);
    assert(seen[0].startsWith('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-GB&q='));
    assert(seen[0].endsWith(encodeURIComponent('Reading and gardening are two of my favourite hobbies.')));
    assert(res && res.ok === true);
    seen.length = 0;
    Speech.say(['Number 1.'], { mp3: false, rate: 0.85 }, () => {});
    a.clock.tick(400);
    assert(seen.length === 1 && seen[0].includes('Number%201.'), 'numbers are spoken too');
  } finally {
    Speech.playAudio = orig; Speech.supported = wasSupported; Speech.ukVoices = wasVoices; Speech.textOnly = wasTextOnly;
  }
});
test('v2 tier 4: offline with no UK voice the phone still speaks aloud', () => {
  const { Speech } = a.q;
  const wasSupported = Speech.supported, wasVoices = Speech.ukVoices, wasTextOnly = Speech.textOnly;
  const spoken = [];
  setOnline(a.w, false);
  a.w.SpeechSynthesisUtterance = function (t) { this.text = t; };
  a.w.speechSynthesis = {
    getVoices: () => [{ name: 'Google US English', lang: 'en-US', localService: false }],
    speak: u => { spoken.push(u); setTimeout(() => u.onend && u.onend(), 0); },
    cancel: () => {}
  };
  Speech.supported = true; Speech.textOnly = false; Speech.voices = []; Speech.ukVoices = []; Speech.chosen = null;
  Speech.readVoices();
  try {
    assert.equal(Speech.ukVoices.length, 0);
    assert(Speech.anyEnglish(), 'an en-US voice still counts as a fallback');
    let done = null;
    Speech.say(['torch'], {}, r => { done = r; });
    a.clock.tick(6000);
    assert(spoken.length > 0, 'the device speaks out loud instead of going silent');
    assert.equal(spoken[0].lang, 'en-GB');
    assert.equal(spoken[0].rate, 0.85);
    assert.equal(spoken[0].voice.lang, 'en-US');
    assert(done);
  } finally {
    delete a.w.speechSynthesis; delete a.w.SpeechSynthesisUtterance;
    Speech.supported = wasSupported; Speech.ukVoices = wasVoices; Speech.textOnly = wasTextOnly;
    Speech.voices = []; Speech.chosen = null;
    setOnline(a.w, true);
  }
});
test('v2: no missing-voice modal can ever block a dictation', () => {
  const start = html.match(/start: function \(opts\) \{[\s\S]*?this\.readyScreen\(\);/)[0];
  assert.equal(start.includes('NoVoice.open'), false);
  const say = html.match(/say: function \(parts, opts, cb\) \{[\s\S]*?\n  \},\n\n  \/\* British style spelling/)[0];
  assert.equal(say.includes('No UK voice.'), false);
  assert.equal(say.includes('"no UK voice"'), false);
  const { Eng, NoVoice } = a.q;
  const wasVoices = a.q.Speech.ukVoices, wasOpen = NoVoice.open;
  let opened = 0;
  NoVoice.open = function () { opened++; };
  a.q.Speech.ukVoices = [];
  const ready = Eng.readyScreen;
  let started = 0;
  Eng.readyScreen = function () { started++; };
  try {
    Eng.start({ list: { id: 't1', name: 'test', words: [{ w: 'hobbies', s: 'x.', m: 'y.' }] } });
    assert.equal(started, 1);
    assert.equal(opened, 0);
  } finally {
    Eng.readyScreen = ready;
    NoVoice.open = wasOpen;
    a.q.Speech.ukVoices = wasVoices;
    Eng.stop(true);
    Eng.st = 'idle';
    a.q.Screens && a.q.Screens.home();
  }
});
test('v2: the ready sheet shows a UK audio pill and a test sound button', () => {
  const src = html.match(/Eng\.readyScreen = function \(\) \{[\s\S]*?\n\};/)[0];
  assert(src.includes('"Test sound"'));
  assert(/Speech\.say\(\[phrase\]/.test(src), 'the greeting is always spoken aloud');
  assert(src.includes('Speech.audioLabel()'));
  setOnline(a.w, true);
  a.q.Speech.ukVoices = [];
  assert(/^UK Audio Ready/.test(a.q.Speech.audioLabel()), a.q.Speech.audioLabel());
  a.q.Speech.ukVoices = [{ name: 'Daniel', lang: 'en-GB' }];
  assert.equal(a.q.Speech.audioLabel(), 'UK Audio Ready (British Voice + Dictionary Audio)');
  a.q.Speech.ukVoices = [];
  const settings = html.match(/\/* ---- Voice ---- \*\/[\s\S]*?var presetRow/)[0];
  assert(settings.includes('Test sound'));
  assert(settings.includes('Speech.audioLabel()'));
});
test('v2: frame probe samples once and never loops', () => {
  const { UI } = a.q;
  const origRaf = a.w.requestAnimationFrame, origCancel = a.w.cancelAnimationFrame;
  let pending = null, scheduled = 0, cancelled = 0;
  a.w.requestAnimationFrame = fn => { pending = fn; scheduled++; return scheduled; };
  a.w.cancelAnimationFrame = () => { cancelled++; pending = null; };
  UI.frameWatchStarted = false;
  const wasPerf = a.q.DB.data.settings.perf;
  a.q.DB.data.settings.perf = 'auto';
  let done = false;
  UI.frameProbe(() => { done = true; });
  let t = 0;
  for (let i = 0; i < 500 && pending; i++) { const fn = pending; pending = null; t += 16; fn(t); }
  assert(done, 'the callback runs after the sample');
  assert.equal(scheduled, 61, 'at most 60 frames are sampled');
  assert.equal(cancelled, 1, 'the animation frame loop is cancelled permanently');
  a.w.requestAnimationFrame = origRaf; a.w.cancelAnimationFrame = origCancel;
  a.q.DB.data.settings.perf = wasPerf;
});
test('v2: storage writes skip the duplicate backup copy between words', () => {
  const DB = a.q.DB;
  a.w.localStorage.removeItem('sdp.v1.bak');
  DB.saveNow();
  assert.equal(a.w.localStorage.getItem('sdp.v1.bak'), null);
  DB.saveNow(true);
  assert(a.w.localStorage.getItem('sdp.v1.bak'));
  const snap = html.match(/saveSnapshot: function \(\) \{[\s\S]*?\n  \},/)[0];
  assert.equal(snap.includes('.bak'), false, 'a word step never writes a second copy');
  for (let i = 0; i < 260; i++) DB.data.dictCache['cap' + i] = { meaning: 'x', ts: 1 };
  DB.trimCache();
  assert(Object.keys(DB.data.dictCache).length <= 200);
  DB.data.dictCache = {};
  DB.saveNow();
});
test('v2: Tuesday and Wednesday are the only class days', () => {
  const dates = Array.from(a.q.Admin.classDates(new Date(2026, 9, 14, 12)));
  assert.equal(dates.length, 8);
  assert.equal(dates[0], '2026-10-14');
  dates.forEach(key => { const day = new Date(key + 'T12:00:00').getDay(); assert(day === 2 || day === 3, key + ' is not Tue/Wed'); });
  const other = Array.from(a.q.Admin.classDates(new Date(2026, 9, 15, 12)));
  assert.equal(other[0], '2026-10-20');
  assert(html.includes('\\u2605 Class days: Tuesday and Wednesday only.'));
  assert(html.includes('Other days (Monday, Thursday, Friday, weekend)'));
});
test('v2: one tap publishes the list, the session and the cloud queue', () => {
  const { Admin, DB } = a.q;
  const list = { id: 'list_t', name: 'Test list', words: [], version: 1, published: false, draft: true };
  DB.data.lists.push(list);
  DB.data.outbox = [];
  const wasUnlocked = Admin.unlocked; Admin.unlocked = true;
  Admin.saveAll(list, [{ w: 'hobbies', s: 'x.', m: 'y.', audio: a.q.ukMp3('hobbies') }], ['2026-10-20'], null);
  Admin.unlocked = wasUnlocked;
  assert.equal(list.published, true);
  assert.equal(list.draft, false);
  assert.equal(list.version, 2);
  assert.equal(DB.data.plan.defaultList, 'list_t');
  assert.equal(DB.data.plan.dates['2026-10-20'], 'list_t');
  assert.equal(DB.data.session.listId, 'list_t');
  assert.equal(DB.data.session.day, 'Tuesday');
  assert.equal(list.publishedWords[0].audio, a.q.ukMp3('hobbies'));
  assert(DB.data.outbox.some(j => j.action === 'publish'));
  DB.data.lists = DB.data.lists.filter(l => l.id !== 'list_t');
  delete DB.data.plan.dates['2026-10-20'];
  DB.data.plan.defaultList = 'list_sample_b1';
  DB.data.session.listId = 'list_sample_b1';
  DB.data.outbox = [];
  DB.saveNow();
});
test('v2: online phones show a live session chip, never local mode', async () => {
  const { UI, Cloud, DB } = a.q;
  Cloud.url = ''; Cloud.mode = false; Cloud.fails = 0;
  setOnline(a.w, true);
  UI.renderNet();
  const label = a.w.document.getElementById('chipNetText').textContent;
  assert.equal(/Local mode/.test(label), false, label);
  assert(/Online \u00b7 Live B1 Session/.test(label), label);
  assert(a.w.document.getElementById('chipNet').className.includes('good'));
  const payload = {
    ok: true, ver: 2,
    session: { no: '9', day: 'Tuesday', date: '2026-10-20', title: 'Published by the lecturer', listId: 'list_x' },
    lists: [{ id: 'list_x', name: 'New list', version: 5, published: true, words: [{ w: 'hobbies', s: 'a.', m: 'b.' }] }],
    plan: [{ key: 'default', listId: 'list_x', pinned: true }],
    announcement: null, comments: []
  };
  const urls = [];
  const origFetch = a.w.fetch;
  a.w.fetch = (url, opts) => {
    urls.push(url);
    assert.equal(opts.cache, 'no-store');
    const body = url.indexOf('session.json') > 0 ? payload : { ver: 2, version: '2.0.0', buildDate: '2026-10-14', updatedAt: 1791957352000 };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };
  try { await new Promise(resolve => Cloud.fetchRepo(resolve)); } finally { a.w.fetch = origFetch; }
  assert.equal(urls.length, 2);
  assert(urls.every(u => /^\.\//.test(u) && /\?t=\d+$/.test(u)));
  assert.equal(Cloud.repoOnline, true);
  assert.equal(Cloud.repoVer, '2.0.0');
  assert.equal(DB.data.session.no, '9');
  assert.equal(DB.data.plan.defaultList, 'list_x');
  assert.equal(a.q.DB.findList(DB.data, 'list_x').words[0].audio.indexOf('https://'), 0);
  UI.renderNet();
  assert(/Live B1 Session v2\.0\.0/.test(a.w.document.getElementById('chipNetText').textContent));
  DB.data.lists = DB.data.lists.filter(l => l.id !== 'list_x');
  DB.data.plan.defaultList = 'list_sample_b1';
  DB.saveNow();
});
test('v2: repository data files match the app', () => {
  const fs = require('node:fs'), path = require('node:path');
  const read = f => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/' + f), 'utf8'));
  const version = read('version.json'), cfg = read('config.json'), session = read('session.json');
  assert.deepEqual(version, { ver: 2, version: '2.0.0', buildDate: '2026-10-14', updatedAt: 1791957352000 });
  assert.equal(cfg.appName, 'Smart Dictation');
  assert.equal(cfg.level, 'B1');
  assert.deepEqual(cfg.classDays, ['Tuesday', 'Wednesday']);
  assert.deepEqual(cfg.defaults, { sentence: false, repeats: 2, rate: 0.85, numbers: true });
  assert.equal(session.ok, true);
  assert.equal(session.ver, 2);
  assert.equal(session.session.no, '1');
  assert.equal(session.session.day, 'Wednesday');
  assert.equal(session.session.date, '2026-10-14');
  assert.equal(session.session.title, 'B1 Leisure & Hobbies (30 words)');
  assert.equal(session.session.listId, 'list_sample_b1');
  assert.equal(session.lists.length, 1);
  assert.equal(session.lists[0].id, 'list_sample_b1');
  assert.equal(session.lists[0].version, 2);
  assert.equal(session.lists[0].published, true);
  assert.deepEqual(session.lists[0].words.map(w => w.w), expected);
  session.lists[0].words.forEach(w => { assert(w.m && w.s && /--_gb_1\.mp3$/.test(w.audio)); });
  assert.deepEqual(session.plan, [{ key: 'default', listId: 'list_sample_b1', pinned: true }]);
  assert.equal(session.announcement, null);
  assert.deepEqual(session.comments, []);
  /* the published file and the app default list must agree word for word */
  const app = a.q.DB.data.lists.find(l => l.id === 'list_sample_b1').words;
  assert.deepEqual(JSON.parse(JSON.stringify(session.lists[0].words.map(w => [w.w, w.m, w.s]))), JSON.parse(JSON.stringify(app.map(w => [w.w, w.m, w.s]))));
});
test('v2: finishing a session posts an anonymous completion entry', () => {
  const { DB, publishCompletion } = a.q;
  const wasComments = DB.data.comments, wasOutbox = DB.data.outbox;
  DB.data.comments = []; DB.data.outbox = [];
  const rec = { id: 'r1', ts: Date.now(), sessionNo: '7', wordCount: 30, score: 24, percent: 80, deviceType: 'iPhone', ukVoice: false, mode: 'paper' };
  const post = publishCompletion(rec);
  assert.equal(DB.data.comments.length, 1);
  assert.equal(post.status, 'finished');
  assert.equal(post.name, DB.data.profile.nickname);
  assert.equal(post.text, 'Completed Session 7 \u00b7 Score: 24/30 (80%)');
  assert(post.meta.includes('iPhone'));
  assert.equal(DB.data.outbox.length, 1);
  assert.equal(DB.data.outbox[0].action, 'comment');
  rec.score = 29; rec.percent = 97;
  publishCompletion(rec, 'update');
  assert.equal(DB.data.comments.length, 1);
  assert(/29\/30 \(97%\)/.test(DB.data.comments[0].text));
  assert(html.includes('publishCompletion(rec);'), 'Results.finish posts it automatically');
  assert(html.match(/if \(rec\.mode === "paper"\) \{[\s\S]*?\n        \}/)[0].includes('publishCompletion(rec, "update")'));
  DB.data.comments = wasComments; DB.data.outbox = wasOutbox;
});
test('v2: paper results show a tappable 30-word self-check', () => {
  const paper = html.match(/A7\.2 paper mode[\s\S]*?\n        \}/)[0];
  assert(paper.includes('renderChunked(markHost, words, markRow)'));
  assert(paper.includes('Got it right'));
  assert(paper.includes('Missed it'));
  assert(paper.includes('paintRing'));
  assert.equal(html.includes('var shown = false;\n          var list = U.el("div"'), false, 'the spellings toggle no longer hides the whole list');
});
test('v2: admin tools can publish straight to the repository', () => {
  const wizard = html.match(/Cloud\.wizard = function \(host\)[\s\S]*?\n\};/)[0];
  assert(wizard.includes('GitHub Direct Publish'));
  assert(wizard.includes('Publish data/ now'));
  assert(wizard.includes('Download session.json'));
  assert.equal(a.q.Cloud.ghPath('data/session.json'), 'https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/data/session.json');
  assert.equal(a.q.Cloud.b64utf8('hobbies'), 'aG9iYmllcw==');
  const payload = a.q.Cloud.repoPayload();
  assert.equal(payload.version.version, '2.0.0');
  assert.equal(payload.session.lists[0].words.length, 30);
  assert(payload.session.plan.length >= 1);
  assert(a.q.html ? true : true);
});
test('v2: cached head and shared audio element exist', () => {
  assert(html.includes('<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">'));
  const audio = a.w.document.getElementById('sdpAudio');
  assert(audio && audio.tagName === 'AUDIO');
  assert.equal(audio.getAttribute('playsinline'), '');
  assert.equal(audio.preload, 'auto');
  a.q.Speech.audio = null;
  assert.equal(a.q.Speech.el(), audio);
});
test('v2: admin words editor is one four-step card', () => {
  const words = html.match(/Admin\.tabWords = function \(host\) \{[\s\S]*?\nAdmin\.publish = function/)[0];
  assert(words.includes('Step 1 \\u00b7 Paste or edit words'));
  assert(words.includes('Step 3 \\u00b7 Session & class day'));
  assert(words.includes('Step 4 \\u00b7 Save & publish'));
  assert(words.includes('Save & Publish to All Students'));
  assert(words.includes('self.setBadge(badge, parsed)'));
  assert(!/var save = U\.btn\("Replace list"/.test(words), 'no separate Replace-list step to confuse students');
});

test.after(()=>a.close());
module.exports={sample};
