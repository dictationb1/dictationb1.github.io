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
  /* the four-digit PIN auto-submits; editing re-arms it; Enter always submits what is in the box */
  assert.deepEqual(seen, ['7898', '7891', '7891']);
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
test('v2: hot writes skip the duplicate backup copy, real changes keep it', () => {
  const DB = a.q.DB;
  a.w.localStorage.removeItem('sdp.v1.bak');
  DB.saveNow();
  assert(a.w.localStorage.getItem('sdp.v1.bak'), 'a real save keeps one recovery copy');
  a.w.localStorage.removeItem('sdp.v1.bak');
  DB.save(true);                       /* the light save used by word steps */
  a.clock.tick(300);
  assert.equal(a.w.localStorage.getItem('sdp.v1.bak'), null, 'a light save writes one key only');
  DB.save();
  a.clock.tick(300);
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
  assert.deepEqual(version, { ver: 3, version: '2.0.0', buildDate: '2026-10-14', updatedAt: 1791957352000 });
  assert.equal(cfg.appName, 'Smart Dictation');
  assert.equal(cfg.level, 'B1');
  assert.deepEqual(cfg.classDays, ['Tuesday', 'Wednesday']);
  assert.deepEqual(cfg.defaults, { sentence: false, repeats: 2, rate: 0.85, numbers: true });
  assert.equal(cfg.ver, 3);
  assert.equal(cfg.version, '2.0.0');
  assert.deepEqual(cfg.live, {
    state: 'https://ntfy.sh/sdp_dictationb1_state_v2',
    community: 'https://ntfy.sh/sdp_dictationb1_comm_v2',
    inbox: 'https://ntfy.sh/sdp_dictationb1_inbox_v2'
  });
  assert.equal(session.ok, true);
  assert.equal(session.ver, 3);
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

test('v2: a skipped countdown never lets the ready greeting cut the first beat', () => {
  const q = a.q, said = [], realSay = q.Speech.say, realSupported = q.Speech.supported;
  q.Speech.supported = true;
  q.Speech.say = function (parts, opts, cb) { said.push(String((parts && parts[0]) || '')); return realSay.call(q.Speech, parts, opts, cb); };
  q.DB.data.settings.numbers = true;
  try {
    q.Eng.start({});
    a.clock.tick(40);
    const skip = Array.from(a.w.document.querySelectorAll('#sheets button')).find(b => /Skip countdown/.test(b.textContent));
    assert(skip, 'the ready sheet offers Skip countdown');
    const before = said.length;
    skip.click();
    a.clock.tick(900);   /* the greeting is scheduled 260 ms after the sheet opens */
    const run = said.slice(before);
    assert.equal(run[0], 'Number 1.', 'the run opens with its own number: ' + JSON.stringify(run));
    assert(!run.some(t => /ready\?|pen and paper|begin\?/i.test(t)),
      'the greeting never speaks over a run that already started (say() bumps the token): ' + JSON.stringify(run));
  } finally {
    q.Speech.say = realSay; q.Speech.supported = realSupported;
    if (q.Eng.pause) q.Eng.pause();
    if (q.Eng.stop) q.Eng.stop(true);
    q.Eng.st = 'idle';
    q.UI.closeSheet();
    a.clock.tick(50);
  }
});

test('v2: the DOM token guard splits, trims and never throws on any input', () => {
  const d = a.w.document;
  const tryAdd = v => {
    const el = d.createElement('div');
    try { el.classList.add(v); return { cls: el.className, threw: false }; }
    catch (err) { return { cls: String(err && err.message || err), threw: true }; }
  };
  assert.deepEqual(tryAdd('a  b\tc'), { cls: 'a b c', threw: false });
  assert.deepEqual(tryAdd('  padded \n'), { cls: 'padded', threw: false });
  assert.deepEqual(tryAdd(''), { cls: '', threw: false });
  assert.deepEqual(tryAdd('   '), { cls: '', threw: false });
  assert.deepEqual(tryAdd(['glass', 'card']), { cls: 'glass,card', threw: false });
  assert.deepEqual(tryAdd(0), { cls: '0', threw: false });
  assert.deepEqual(tryAdd(null), { cls: '', threw: false });
  const hostile = d.createElement('div');
  hostile.className = 'keep me';
  assert.deepEqual(tryAdd({ toString() { throw Error('nope'); } }).threw, false);
  const el = d.createElement('div');
  el.classList.add('one', 'two three');
  el.classList.remove('two');
  assert.deepEqual(Array.from(el.classList), ['one', 'three'], 'multiple tokens per call still work');
  assert.equal(hostile.className, 'keep me');
});

/* ================= v2.0.0 live class channel (ntfy.sh) ================= */
function stubFetch(w, handler) {
  const calls = [];
  const before = w.fetch;
  w.fetch = (url, opts) => {
    calls.push({ url: String(url), opts: opts || {} });
    return Promise.resolve(handler(String(url), opts || {}));
  };
  return { calls, restore() { w.fetch = before; } };
}
const flush = async (a, ms = 300, rounds = 4) => {
  for (let i = 0; i < rounds; i++) { a.clock.tick(ms); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
};

test('live: publishing posts the whole session to the state topic', async () => {
  const { Cloud, DB } = a.q;
  setOnline(a.w, true);
  const body = { kind: 'state', publishedAt: Date.now(), ver: 3, session: { no: '4' }, lists: [{ id: 'x', words: [] }] };
  let sent = null;
  const f = stubFetch(a.w, () => { sent = null; return { ok: true, text: () => Promise.resolve('') }; });
  try {
    await new Promise(resolve => Cloud.publishLive(body, resolve));
    const call = f.calls[f.calls.length - 1];
    assert.equal(call.url, 'https://ntfy.sh/sdp_dictationb1_state_v2');
    assert.equal(call.opts.method, 'POST');
    assert.equal(call.opts.cache, 'no-store');
    const payload = JSON.parse(call.opts.body);
    assert.equal(payload.kind, 'state');
    assert.equal(typeof payload.publishedAt, 'number');
    assert(payload.publishedAt > 0);
  } finally { f.restore(); }
  assert(Cloud.syncedAt > 0, 'a verified sync time is recorded');
});

test('live: the newest published payload wins and drives the Home header', async () => {
  const { Cloud, DB, Lib } = a.q;
  setOnline(a.w, true);
  const older = { kind: 'state', publishedAt: 1000, ver: 3,
    session: { no: '2', day: 'Monday', date: '2026-10-05', title: 'Old list', listId: 'list_live' },
    lists: [{ id: 'list_live', name: 'Old list', version: 1, published: true, words: [{ w: 'old', s: '', m: '' }] }], plan: [] };
  const newer = { kind: 'state', publishedAt: 5000, ver: 3,
    session: { no: '4', day: 'Wednesday', date: '2026-10-14', title: 'Session 4 words', listId: 'list_live' },
    lists: [{ id: 'list_live', name: 'Session 4 words', version: 7, published: true, words: [{ w: 'hobbies', s: 'x.', m: 'y.' }, { w: 'torch', s: 'z.', m: 'w.' }] }], plan: [] };
  const feed = [older, newer].map(m => JSON.stringify({ id: 'i', event: 'message', topic: 'sdp_dictationb1_state_v2', message: JSON.stringify(m) })).join('\n');
  const f = stubFetch(a.w, url => url.indexOf('/json?poll=1&since=all') > 0 ? { ok: true, text: () => Promise.resolve(feed), json: () => Promise.resolve({}) } : { ok: true, text: () => Promise.resolve('') });
  try {
    Cloud.stateAt = 0;
    await new Promise(resolve => Cloud.pollTopic('sdp_dictationb1_state_v2', resolve));
  } finally { f.restore(); }
  assert.equal(DB.data.session.no, '4', 'the newer payload wins, the cached older one never overwrites it');
  assert.equal(DB.data.session.day, 'Wednesday');
  assert.equal(DB.data.session.title, 'Session 4 words');
  assert.equal(a.q.DB.findList(DB.data, 'list_live').words.length, 2);
  assert(/^Session 4/.test(Lib.sessionLabel()), Lib.sessionLabel());
  assert.equal(Cloud.stateAt, 5000);
  DB.data.lists = DB.data.lists.filter(l => l.id !== 'list_live');
  DB.data.plan.defaultList = 'list_sample_b1';
  DB.data.session.no = '1'; DB.data.session.title = 'B1 Leisure & Hobbies (30 words)';
  DB.data.session.listId = 'list_sample_b1'; DB.data.session.date = '2026-10-14';
  DB.saveNow();
});

test('live: the SSE stream is opened on both topics and merges a completion', async () => {
  const { Cloud, DB } = a.q;
  setOnline(a.w, true);
  const seen = [];
  const before = a.w.EventSource;
  const f = stubFetch(a.w, () => ({ ok: true, text: () => Promise.resolve('') }));
  a.w.EventSource = function (url) {
    seen.push(String(url));
    this.close = () => { this.closed = true; };
    a.w.__es = this;
  };
  try {
    Cloud.live.sse = null;
    Cloud.liveOpen();
    assert.equal(seen.length, 1);
    assert(seen[0].startsWith('https://ntfy.sh/sdp_dictationb1_state_v2,sdp_dictationb1_comm_v2/sse'), seen[0]);
    const comm = { kind: 'comm', publishedAt: 9000, results: [{ id: 'cloud-res-1', ts: 9000, sessionNo: '1', wordCount: 30, score: 27, percent: 90, deviceType: 'Android', ukVoice: true, name: 'Student Q' }], comments: [{ id: 'cloud-c-1', ts: 9000, name: 'Student Q', status: 'finished', text: 'Completed Session 1 \u00b7 Score: 27/30 (90%)', meta: 'Android' }] };
    a.w.__es.onmessage({ data: JSON.stringify({ event: 'message', topic: 'sdp_dictationb1_comm_v2', message: JSON.stringify(comm) }) });
    assert(DB.data.results.some(r => r.id === 'cloud-res-1'), 'the live completion is stored as a real student result');
    assert(DB.data.comments.some(c => c.id === 'cloud-c-1'), 'and it appears in Community straight away');
    assert(Cloud.syncedAt > 0);
    DB.data.results = DB.data.results.filter(r => r.id !== 'cloud-res-1');
    DB.data.comments = DB.data.comments.filter(c => c.id !== 'cloud-c-1');
    Cloud.liveClose();
  } finally { a.w.EventSource = before; f.restore(); DB.saveNow(); }
});

test('live: the outbox is flushed over the live topics, never stuck at 1 waiting', async () => {
  const { Cloud, DB } = a.q;
  setOnline(a.w, true);
  Cloud.mode = false;
  const wasOutbox = DB.data.outbox;
  DB.data.outbox = [{ id: 'j1', action: 'publish', listId: 'list_sample_b1' }, { id: 'j2', action: 'comment', cid: 'c-x' }, { id: 'j3', action: 'inbox' }];
  const f = stubFetch(a.w, () => ({ ok: true, text: () => Promise.resolve('') }));
  try {
    Cloud.flushLive();
    await flush(a, 200, 6);
  } finally { f.restore(); }
  const topics = f.calls.map(c => c.url);
  assert(topics.includes('https://ntfy.sh/sdp_dictationb1_state_v2'), topics.join(','));
  assert(topics.includes('https://ntfy.sh/sdp_dictationb1_comm_v2'), topics.join(','));
  assert(topics.includes('https://ntfy.sh/sdp_dictationb1_inbox_v2'), topics.join(','));
  assert.equal(DB.data.outbox.length, 0, 'nothing is left waiting');
  DB.data.outbox = wasOutbox;
  Cloud.live.posting = false;
  DB.saveNow();
});

test('live: the status chip tells the truth in every state', async () => {
  const { UI, Cloud, DB } = a.q;
  const text = () => a.w.document.getElementById('chipNetText').textContent;
  const wasOutbox = DB.data.outbox;
  DB.data.outbox = [];
  Cloud.url = ''; Cloud.mode = false; Cloud.fails = 0; Cloud.syncedAt = 0; Cloud.live.at = 0; Cloud.live.posting = false;
  setOnline(a.w, true);
  UI.renderNet();
  assert(/^Online \u00b7 Live B1 Session/.test(text()), text());
  assert(a.w.document.getElementById('chipNet').className.includes('good'));
  Cloud.syncedAt = a.w.Date.now() - 5000;   /* the app clock, not the Node clock */
  UI.renderNet();
  assert(/Synced (just now|[0-9]+ min ago)/.test(text()), text());
  DB.data.outbox = [{ id: 'w1', action: 'comment' }];
  UI.renderNet();
  assert(/1 waiting/.test(text()), text());
  DB.data.outbox = [];
  Cloud.live.posting = true;
  UI.renderNet();
  assert(/^Syncing\u2026/.test(text()), text());
  Cloud.live.posting = false;
  setOnline(a.w, false);
  UI.renderNet();
  assert.equal(text(), 'Offline \u00b7 Saved on device');
  setOnline(a.w, true);
  DB.data.outbox = wasOutbox;
  DB.saveNow();
});

test('live: a list named "Session 4 words" drives the session number, a manual one is kept', () => {
  const { Admin, DB, Lib } = a.q;
  const wasUnlocked = Admin.unlocked; Admin.unlocked = true;
  const list = { id: 'list_s4', name: 'Session 4 words', words: [], version: 1, published: false, draft: true };
  DB.data.lists.push(list);
  const wasOutbox = DB.data.outbox; DB.data.outbox = [];
  try {
    Admin.saveAll(list, [{ w: 'hobbies', s: 'x.', m: 'y.', audio: a.q.ukMp3('hobbies') }], ['2026-10-14'], null);
    assert.equal(DB.data.session.no, '4');
    assert(/^Session 4/.test(Lib.sessionLabel()), Lib.sessionLabel());
    assert(DB.data.session.day, 'the weekday is real');
    Admin.manualSession = true;
    const manual = { id: 'list_s5', name: 'Session 5 words', words: [], version: 1, published: false, draft: true };
    DB.data.lists.push(manual);
    DB.data.session.no = '9';
    Admin.saveAll(manual, [{ w: 'torch', s: 'x.', m: 'y.', audio: a.q.ukMp3('torch') }], [], null);
    assert.equal(DB.data.session.no, '9', 'a session number set with the +/- buttons is never overwritten');
    assert.equal(Admin.manualSession, false, 'the flag is one-shot');
  } finally {
    DB.data.lists = DB.data.lists.filter(l => l.id !== 'list_s4' && l.id !== 'list_s5');
    DB.data.plan.defaultList = 'list_sample_b1';
    DB.data.session.listId = 'list_sample_b1';
    DB.data.session.no = '1';
    DB.data.outbox = wasOutbox;
    Admin.unlocked = wasUnlocked;
    DB.saveNow();
  }
});

test('audio: a blocked British TTS host fails over to the open backup stream', async () => {
  const { Speech } = a.q;
  setOnline(a.w, true);
  const seen = [];
  const orig = Speech.playAudio;
  const wasSupported = Speech.supported, wasVoices = Speech.ukVoices, wasTextOnly = Speech.textOnly;
  Speech.playAudio = (src, rate, ms, cb) => { seen.push(src); cb(seen.length > 1); };
  Speech.supported = false; Speech.ukVoices = []; Speech.textOnly = false;
  try {
    assert.deepEqual(Array.from(Speech.streamSources('torch')), [
      'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-GB&q=torch',
      'https://api.streamelements.com/kappa/v2/speech?voice=Amy&text=torch'
    ]);
    let res = null;
    Speech.say(['torch'], { mp3: false }, r => { res = r; });
    a.clock.tick(400);
    assert.equal(seen.length, 2, seen.join(' | '));
    assert(seen[1].indexOf('streamelements') > 0);
    assert(res && res.ok === true, 'the fallback stream still counts as success');
  } finally {
    Speech.playAudio = orig; Speech.supported = wasSupported; Speech.ukVoices = wasVoices; Speech.textOnly = wasTextOnly;
  }
});

test('dictionary: every real example sentence is kept, not just 8-to-14 word ones', () => {
  const { Dict } = a.q;
  const short = Dict.parse([{ word: 'torch', phonetics: [{ audio: 'https://x.test/torch-uk.mp3', text: '/t\u0254\u02d0t\u0283/' }],
    meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a small light you carry', example: 'Take a torch.' }] }] }]);
  assert.equal(short.example, 'Take a torch.', 'a short real sentence is not thrown away');
  assert.equal(short.audio, 'https://x.test/torch-uk.mp3');
  assert.equal(short.ipa, 't\u0254\u02d0t\u0283');
  const secondary = Dict.parse([{ word: 'torch', meanings: [
    { definitions: [{ definition: 'a light' }] },
    { definitions: [{ definition: 'a stick with fire', example: 'They carried a burning torch through the village at night.' }] }
  ] }]);
  assert.equal(secondary.example, 'They carried a burning torch through the village at night.', 'a secondary sense supplies the example');
  assert(Dict.parse([{ word: 'x', phonetics: [], meanings: [] }]) === null);
});

test('performance: the per-word snapshot is debounced and flushed, never doubled', () => {
  const { Eng, DB } = a.q;
  const src = html.match(/saveSnapshot: function \(\) \{[\s\S]*?\n  \},/)[0];
  assert.equal(src.includes('.bak'), false);
  assert(/setTimeout/.test(src) && /flushSnapshot/.test(src));
  const wasSt = Eng.st;
  delete DB.data.snapshot;
  Eng.st = 'waiting';
  try {
    Eng.saveSnapshot();
    a.clock.tick(200);
    assert.equal(DB.data.snapshot, undefined, 'nothing is written inside the debounce window');
    a.clock.tick(400);
    assert(DB.data.snapshot && DB.data.snapshot.words, 'the snapshot lands after the debounce');
    delete DB.data.snapshot;
    Eng.saveSnapshot();
    Eng.flushSnapshot();
    assert(DB.data.snapshot && DB.data.snapshot.savedAt, 'a finish or publish flushes it immediately');
  } finally { Eng.st = wasSt; delete DB.data.snapshot; DB.saveNow(); }
});

test('class stats: real student completions only, never the lecturer history', () => {
  const { Admin, DB } = a.q;
  const wasUnlocked = Admin.unlocked; Admin.unlocked = true;
  const wasResults = DB.data.results, wasHistory = DB.data.history;
  const host = a.w.document.createElement('div');
  try {
    DB.data.results = [];
    DB.data.history = [{ id: 'own-1', ts: Date.now(), score: 30, wordCount: 30, percent: 100, sessionNo: '1', deviceType: 'Mac', ukVoice: true }];
    Admin.tabStats(host);
    assert(/No student results yet/.test(host.textContent), host.textContent.slice(0, 200));
    assert.equal(host.querySelectorAll('.statbar').length, 0, 'no invented session bars');
    DB.data.results = [
      { id: 'r1', ts: Date.now(), name: 'A', sessionNo: '1', wordCount: 30, score: 24, percent: 80, deviceType: 'Android', ukVoice: false },
      { id: 'r2', ts: Date.now(), name: 'B', sessionNo: '1', wordCount: 30, score: 30, percent: 100, deviceType: 'iPhone', ukVoice: true }
    ];
    const host2 = a.w.document.createElement('div');
    Admin.tabStats(host2);
    assert(/2 student completions from 2 students/.test(host2.textContent), host2.textContent.slice(0, 300));
    assert(/90%/.test(host2.textContent), 'the real average 90% is shown');
    assert(/never counted as class results/.test(host2.textContent), 'the lecturer history is labelled, not mixed in');
    assert.equal(host2.querySelectorAll('.statbar .col').length, 1, 'one real session bar');
  } finally {
    DB.data.results = wasResults; DB.data.history = wasHistory; Admin.unlocked = wasUnlocked; DB.saveNow();
  }
});

test('static: the live engine, the shared audio element and the single word table ship in ES5', () => {
  const script = Array.from(a.w.document.scripts).find(s => !s.type && s.textContent.includes('var APP_VERSION')).textContent;
  require('acorn').parse(script, { ecmaVersion: 5 });
  assert(html.includes('ntfy.sh'), 'the free live channel is wired in');
  assert.equal((html.match(/EventSource\(/g) || []).length, 1);
  assert(html.includes('/json?poll=1&since=all'));
  assert(html.includes('crossorigin="anonymous"'));
  assert(!/Reorder words \(/.test(html), 'the duplicate 30-row table is gone');
  assert(html.includes('Save & Publish Live'));
  const words = html.match(/Admin\.tabWords = function \(host\) \{[\s\S]*?\nAdmin\.publish = function/)[0];
  assert(words.includes('Save & Publish to All Students'));
  assert(words.includes('self.setBadge(badge, parsed)'));
  assert(!/8 <= /.test(html) && !/length >= 8/.test(html), 'the 8-to-14 word sentence filter is gone');
  assert(Buffer.byteLength(html) < 450000);
});

test.after(()=>a.close());
module.exports={sample};
