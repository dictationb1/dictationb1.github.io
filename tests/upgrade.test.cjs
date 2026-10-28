'use strict';
/* v44 release gate: ES5/size, migrations, the neural pack, player flow,
   accessible controls, bilingual narration, and cancellation. Real-browser
   rendering and real audio playback are also exercised by the browser audits. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const acorn = require('acorn');
const cp = require('node:child_process');
const os = require('node:os');
const { harness, html } = require('./app-harness.cjs');
const root = path.resolve(__dirname, '..');
const manifest = require('../scripts/audio-manifest.json');
const json = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', name + '.json'), 'utf8'));
const config = json('config'), version = json('version'), session = json('session');
const inline = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
const LOCAL = './audio/';
const key = 'sdp.v44_apple_liquid_complete';
const cache = 'sdp.gh_assets_v44';
const cleanErrors = (list) => list.filter((m) => !/^Not implemented:/i.test(String(m)));
const plain = (o) => JSON.parse(JSON.stringify(o));
function app(fn) { const a = harness(); try { return fn(a); } finally { a.close(); } }
function stream(fn) {
  return app((a) => {
    const { w, q, clock } = a;
    if (w.document.querySelector('#sheets .sheet')) q.UI.closeSheet();
    Object.defineProperty(w.navigator, 'userAgent', { value:'Mozilla/5.0 Chrome/124 Safari/537.36', configurable:true });
    const played = [];
    let pauses = 0, synth = 0;
    w.speechSynthesis = { getVoices(){return [];}, cancel(){}, pause(){}, resume(){}, addEventListener(){}, speak(){synth++;} };
    w.SpeechSynthesisUtterance = function (text) { this.text = text; };
    w.HTMLMediaElement.prototype.load = function () {};
    w.HTMLMediaElement.prototype.pause = function () { pauses++; };
    w.HTMLMediaElement.prototype.play = function () {
      const el = this, src = String(el.getAttribute('src') || '');
      if (!/\.mp3(?:\?|$)/.test(src)) return Promise.resolve();
      const ended = el.onended, playing = el.onplaying;
      played.push({ src, at:w.Date.now(), rate:el.playbackRate });
      w.setTimeout(() => { if (playing && el.onplaying === playing) playing(); }, 5);
      w.setTimeout(() => { if (ended && el.onended === ended) ended(); }, /guide-/.test(src) ? 20000 : 60);
      return Promise.resolve();
    };
    q.Speech.supported = true;
    q.Speech.stop();
    return fn(Object.assign(a, {played, pauses:()=>pauses, synth:()=>synth, files:()=>played.map(x=>x.src.replace(LOCAL,''))}));
  });
}
function start(a) {
  const { q, w } = a;
  q.Eng.start({});
  const ready = w.document.querySelector('#btnReadyGo');
  assert.ok(ready, 'ready button');
  return ready;
}
function go(a) { start(a).click(); a.clock.tick(2600); assert.equal(a.q.Eng.st,'waiting'); }
function button(w, text) {
  return Array.from(w.document.querySelectorAll('button')).find(b => b.textContent.trim() === text);
}
function fileList(a) { return a.played.map(x => x.src.slice(LOCAL.length)); }
function press(w, key) { w.document.body.dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})); }

test('single page is strict ES5, node-checkable, unlinked and below the release size limit', () => {
  assert.ok(inline && inline.length > 100000);
  assert.doesNotThrow(() => acorn.parse(inline, {ecmaVersion:5}));
  const file = path.join(os.tmpdir(), 'sdp-v44-es5-' + process.pid + '.js');
  try { fs.writeFileSync(file, inline); cp.execFileSync(process.execPath, ['--check',file]); } finally { fs.unlinkSync(file); }
  assert.ok(Buffer.byteLength(html) < 442000, 'bytes: ' + Buffer.byteLength(html));
  assert.ok(!/<link\b/i.test(html));
  assert.match(html, /<audio id="ttsMasterAudio"/);
});

test('all release data and runtime agree on v44, 5.1.0, cache and settings', () => app(({q}) => {
  assert.equal(q.APP_VERSION,'5.1.0'); assert.equal(q.CONFIG.schema,44);
  assert.equal(q.CONFIG.settingsRev,44); assert.equal(q.CONFIG.key,key); assert.equal(q.CONFIG.ghMediaCache,cache);
  for (const data of [config, version, session]) {
    assert.equal(data.ver,44); assert.equal(data.schema,44); assert.equal(data.settingsRev,44); assert.equal(data.appVersion,'5.1.0');
    assert.equal(data.storageKey,key); assert.equal(data.ghMediaCache,cache);
  }
  assert.equal(config.wallpaper.ghMediaCache,cache);
  assert.equal(config.tts.englishVoice,'en-GB-SoniaNeural');
  assert.equal(config.tts.sinhalaGuideVoice,'si-LK-ThiliniNeural');
  assert.equal(config.tts.silenceBetweenRepeatsMs,650); assert.equal(config.tts.slowPlaybackRate,0.72);
  assert.equal(q.DB.data.settings.writeFixed,5); assert.equal(q.DB.data.settings.mode,'paper');
}));

test('v43 data and the old default PIN migrate without deleting work or replacing custom PINs', () => app(({q}) => {
  const old = plain(q.defaultData()); old.v=43; old.settingsRev=43;
  old.session.title='Keep my lesson'; old.history=[{id:'keep-result',score:7}];
  old.admin={pinSalt:'c56a80f01b264e39',pinHash:'5cc8204af44727a4da3b0d615fb32939b0f86d8b660efaaf9772fde9d753428b',pinKdf:'sha256'};
  const migrated=q.DB.migrate(old);
  assert.equal(migrated.v,44); assert.equal(migrated.settingsRev,44); assert.equal(migrated.session.title,'Keep my lesson');
  assert.equal(migrated.history[0].id,'keep-result'); assert.equal(migrated.settings.adminPin,'78987898');
  assert.notEqual(migrated.admin.pinHash,'5cc8204af44727a4da3b0d615fb32939b0f86d8b660efaaf9772fde9d753428b');
  const custom=plain(q.defaultData()); custom.settingsRev=43;custom.admin={pinSalt:'my-salt',pinHash:'custom-hash',pinKdf:'sha256'};
  assert.equal(q.DB.migrate(custom).admin.pinHash,'custom-hash');
}));

test('the eight-digit numeric PIN field handles keyboard-style input and unlocks', () => app(({q,w,clock}) => {
  if (w.document.querySelector('#sheets .sheet')) q.UI.closeSheet();
  q.Admin.pad('local',null);
  const field=w.document.querySelector('#adminPinInput');
  assert.ok(field); assert.equal(field.maxLength,8); assert.equal(field.getAttribute('inputmode'),'numeric');
  field.value='78987898'; field.dispatchEvent(new w.Event('input',{bubbles:true}));
  clock.tick(100); const submit=w.document.querySelector('#pinSubmit'); if (submit) submit.click();
  clock.tick(100); assert.equal(q.Admin.unlocked,true); assert.ok(w.document.querySelector('#adminHost'));
}));

test('the manifest contains all 174 real recordings in the intended neural voices', () => {
  assert.equal(manifest.ver,44); assert.equal(manifest.englishVoice,'en-GB-SoniaNeural');
  assert.equal(manifest.sinhalaVoice,'si-LK-ThiliniNeural'); assert.equal(manifest.words.length,34); assert.equal(manifest.clips.length,174);
  const seen=new Set();
  for (const clip of manifest.clips) {
    assert.ok(!seen.has(clip.file),clip.file); seen.add(clip.file);
    assert.equal(clip.voice,clip.file==='guide-si.mp3'?'si-LK-ThiliniNeural':'en-GB-SoniaNeural');
    const file=path.join(root,'audio',clip.file); assert.ok(fs.statSync(file).size>1000,clip.file);
    const head=fs.readFileSync(file).slice(0,3).toString('hex'); assert.ok(head==='494433'||/^ff[ef]/.test(head),clip.file);
  }
  for (let n=1;n<=30;n++) { assert.ok(seen.has('num-'+n+'.mp3')); assert.ok(seen.has('resume-'+n+'.mp3')); }
  for (const f of ['guide-en.mp3','guide-si.mp3','welcome-paper.mp3','welcome-type.mp3','count-1.mp3','sound-check.mp3']) assert.ok(seen.has(f),f);
  assert.equal(fs.readdirSync(path.join(root,'audio')).filter(f=>/\.mp3$/.test(f)).length,seen.size);
});

test('every bundled word has separate word, sentence and spelling recordings', () => app(({q}) => {
  const files=new Set(manifest.clips.map(c=>c.file));
  for (const word of manifest.words) {
    const slug=q.Speech.toSlug(word);
    for (const prefix of ['word-','sent-','spell-']) assert.ok(files.has(prefix+slug+'.mp3'),word+' '+prefix);
    assert.equal(q.Speech.getSingleVoiceUrl(word),LOCAL+'word-'+slug+'.mp3');
  }
}));

test('a plain static server serves the audio files locally', async () => {
  const server=http.createServer((req,res)=>{
    const name=path.basename(decodeURIComponent(req.url)); const file=path.join(root,'audio',name);
    if (!fs.existsSync(file)) {res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'audio/mpeg'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
    for (const file of ['guide-en.mp3','guide-si.mp3','word-guidebook.mp3','sent-guidebook.mp3','spell-guidebook.mp3']) {
      const result=await new Promise((resolve,reject)=>http.get({host:'127.0.0.1',port:server.address().port,path:'/audio/'+file},res=>{let bytes=0;res.on('data',c=>bytes+=c.length);res.on('end',()=>resolve([res.statusCode,res.headers['content-type'],bytes]));}).on('error',reject));
      assert.equal(result[0],200);assert.equal(result[1],'audio/mpeg');assert.ok(result[2]>1000);
    }
  } finally { await new Promise(r=>server.close(r)); }
});

test('numbered phrases map dynamically to the number and correct word, including slash spellings', () => app(({q}) => {
  const S=q.Speech;
  assert.deepEqual(Array.from(S.resolveClips('Number 1, guidebook .')),[LOCAL+'num-1.mp3',LOCAL+'word-guidebook.mp3']);
  assert.deepEqual(Array.from(S.resolveClips('Number 2, bicycle .')),[LOCAL+'num-2.mp3',LOCAL+'word-bicycle.mp3']);
  assert.equal(S.toSlug('tyre/tire'),'tyre');
  assert.equal(S.getSingleVoiceUrl('bus stop'),LOCAL+'word-bus-stop.mp3');
  assert.match(S.getSingleVoiceUrl('zebra crossing'),/^https:\/\/dict\.youdao\.com\/dictvoice\?/);
}));

test('ready copy matches the spoken welcome, with no player or skip until ready', () => stream(a => {
  const {q,w,clock,played}=a; const b=start(a); clock.tick(70);
  assert.match(w.document.querySelector('#readyInstruction').textContent,/Click I'm ready to begin/);
  assert.match(b.textContent,/I'm ready/); assert.equal(q.Eng.layer,null);
  assert.equal(w.document.querySelectorAll('#layers .layer').length,0);
  assert.equal(button(w,'Skip countdown'),undefined);
  assert.ok(fileList(a).includes('welcome-paper.mp3'));
  assert.equal(w.document.querySelector('#voiceTestPill'),null);
}));

test('3-2-1 waits for the prior clip and then plays number + word + word', () => stream(a => {
  const {q,clock,played}=a; const b=start(a); clock.tick(70); played.length=0; b.click();
  clock.tick(2600);
  const files=fileList(a); assert.deepEqual(files.slice(0,6),['count-3.mp3','count-2.mp3','count-1.mp3','num-1.mp3','word-guidebook.mp3','word-guidebook.mp3']);
  assert.ok(played[1].at-played[0].at>=500); assert.ok(played[2].at-played[1].at>=500);
  assert.ok(played[5].at-played[4].at>=710,'60ms clip + 650ms gap');
  assert.equal(q.Eng.st,'waiting'); assert.equal(q.Eng.countdown.left,5); assert.equal(a.synth(),0);
}));

test('a delayed first-run guide never replaces a ready session', () => stream(a => {
  a.q.DB.data.tourSeen=false; start(a); a.clock.tick(1200);
  assert.ok(a.w.document.querySelector('#readySheet')); assert.equal(a.w.document.querySelector('#guideSheet'),null);
  assert.equal(a.q.Eng.st,'ready');
}));

test('closing during the countdown cancels pending speech and word playback', () => stream(a => {
  const {q,clock,played}=a; start(a).click(); clock.tick(200); q.Eng.stop(false); clock.tick(5000);
  const files=fileList(a); assert.ok(files.includes('count-3.mp3'));
  assert.ok(!files.includes('count-2.mp3')); assert.ok(!files.includes('num-1.mp3'));
  assert.equal(q.Eng.st,'idle');
}));

test('the active list and each word determine the audio after navigation and reordering', () => stream(a => {
  const {q,clock,played}=a; go(a);
  for (const i of [1,5,0,29,3]) {
    played.length=0; q.Eng.startWord(i); clock.tick(1000);
    const entry=q.Eng.currentWord(); const slug=q.Speech.toSlug(entry.w); const files=fileList(a);
    assert.deepEqual(files.slice(0,3),['num-'+(i+1)+'.mp3','word-'+slug+'.mp3','word-'+slug+'.mp3']);
    assert.equal(q.Eng.currentSlug,slug);
  }
  q.Eng.order=q.Eng.order.slice().reverse(); played.length=0; q.Eng.startWord(0); clock.tick(1000);
  assert.equal(q.Eng.currentWord().w,'windscreen');
  assert.deepEqual(fileList(a).slice(0,3),['num-1.mp3','word-windscreen.mp3','word-windscreen.mp3']);
}));

test('the writing timer lasts five seconds after the second reading', () => stream(a => {
  const {q,clock}=a;go(a); const index=q.Eng.idx;
  assert.equal(q.Eng.countdown.left,5); clock.tick(4000);
  assert.equal(q.Eng.idx,index); assert.equal(q.Eng.countdown.left,1);
  clock.tick(1100); assert.equal(q.Eng.idx,index+1);
}));

test('sentence, spelling and slower controls interrupt and restart the timer', () => stream(a => {
  const {q,w,clock,played}=a;go(a);
  played.length=0;q.Eng.speakSentence();
  assert.equal(fileList(a)[0],'sent-guidebook.mp3');
  const hint=w.document.querySelector('#plSub').textContent;
  assert.ok(hint.includes('_______'),hint); assert.ok(!/guidebook/i.test(hint),hint);
  clock.tick(100); assert.equal(q.Eng.st,'waiting'); assert.equal(q.Eng.countdown.left,5);
  played.length=0;q.Eng.spellIt(); assert.equal(fileList(a)[0],'spell-guidebook.mp3');
  assert.match(w.document.querySelector('#plSub').textContent,/G · U · I/);clock.tick(100);
  played.length=0;q.Eng.speakSlow(); assert.equal(fileList(a)[0],'word-guidebook.mp3');
  assert.equal(played[0].rate,0.72);clock.tick(100);assert.equal(q.Speech.master().playbackRate,1);
  assert.equal(q.Eng.countdown.left,5);
}));

test('repeat, previous, restart, finish confirmation and progress dots work', () => stream(a => {
  const {q,w,clock,played}=a;go(a);q.Eng.startWord(2);clock.tick(1000);
  played.length=0;q.Eng.replayWord();clock.tick(1000);assert.equal(q.Eng.idx,2);assert.equal(fileList(a)[0],'num-3.mp3');
  q.Eng.prev();clock.tick(1000);assert.equal(q.Eng.idx,1);
  q.Eng.restart(); const restart=Array.from(w.document.querySelectorAll('#modals button')).find(b=>b.textContent.trim()==='Restart');
  assert.ok(restart,'restart confirmation');restart.click();clock.tick(1000);assert.equal(q.Eng.idx,0);assert.equal(q.Eng.answers.length,0);
  assert.equal(w.document.querySelectorAll('#plProgressDots .progress-dot').length,30);
  assert.match(w.document.querySelector('#plCategory').textContent,/travel & transport/i);
  assert.equal(w.document.querySelector('#plCount'),null); assert.equal(w.document.querySelector('[data-voice-pill]'),null);
  assert.equal(w.document.querySelector('#plStepBadge'),null);
  q.Eng.finishEarly(); assert.ok(button(w,'Finish now'));button(w,'Finish now').click();clock.tick(100);
  assert.equal(q.DB.data.history.length,1);
}));

test('long custom lists use grouped progress dots and their own category', () => stream(a => {
  const {q,w}=a;go(a);
  q.Eng.words=Array.from({length:1200},(_,i)=>({w:'custom'+i,category:'Animals'}));
  q.Eng.order=q.Eng.words.map((_,i)=>i);q.Eng.idx=600;q.Eng.paintProg();
  assert.equal(w.document.querySelectorAll('#plProgressDots .progress-dot').length,30);
  assert.equal(w.document.querySelectorAll('#plProgressDots .progress-dot.done').length,15);
  assert.match(w.document.querySelector('#plProgressDots').getAttribute('aria-label'),/601 of 1200/);
  assert.match(w.document.querySelector('#plCategory').textContent,/Animals/);
}));

test('keyboard shortcuts trigger helpers and navigation, but not when typing', () => stream(a => {
  const {q,w,clock,played}=a;go(a);
  played.length=0;press(w,'s');assert.equal(played[0].rate,0.72);clock.tick(100);
  played.length=0;press(w,'e');assert.equal(fileList(a)[0],'sent-guidebook.mp3');clock.tick(100);
  played.length=0;press(w,'l');assert.equal(fileList(a)[0],'spell-guidebook.mp3');clock.tick(100);
  press(w,'ArrowRight');clock.tick(1000);assert.equal(q.Eng.idx,1);
  press(w,'ArrowLeft');clock.tick(1000);assert.equal(q.Eng.idx,0);
  const input=w.document.createElement('input');w.document.body.appendChild(input);played.length=0;
  input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'s',bubbles:true}));assert.equal(played.length,0);
  press(w,'Escape');assert.equal(q.Eng.st,'idle');
}));

test('guide opens with English audio, changes to Sinhala, replays, stops and cleans up', () => stream(a => {
  const {q,w,played}=a;played.length=0;q.UI.openGuide();
  assert.equal(fileList(a)[0],'guide-en.mp3');assert.equal(q.UI.guidePlaying,true);
  assert.ok(w.document.querySelector('#btnGuideAudio').textContent.includes('Stop'));
  q.UI.setGuideLang('si');assert.ok(fileList(a).includes('guide-si.mp3'));
  assert.equal(q.DB.data.settings.guideLang,'si');assert.equal(w.document.querySelector('#guideBody').getAttribute('lang'),'si');
  w.document.querySelector('#btnGuideAudio').click();assert.equal(q.UI.guidePlaying,false);
  w.document.querySelector('#btnGuideAudio').click();assert.equal(q.UI.guidePlaying,true);
  const before=a.pauses();q.UI.closeSheet();assert.equal(q.UI.guidePlaying,false);assert.ok(a.pauses()>before);
  assert.equal(w.document.querySelector('#guideSheet'),null);
}));

test('all 30 words complete on the bundled voice without unexpected errors', () => stream(a => {
  const {q,w,clock,played,consoleErrors}=a;const uncaught=[];
  w.addEventListener('error',e=>uncaught.push(e.message));go(a);
  for(let i=1;i<30;i++) {q.Eng.startWord(i);clock.tick(1000);}
  q.Eng.finish(false);clock.tick(100);
  const files=fileList(a);assert.ok(files.includes('num-30.mp3'));assert.ok(files.includes('word-windscreen.mp3'));
  assert.ok(files.includes('finish-paper.mp3'));assert.ok(played.length>=90);
  assert.equal(a.synth(),0);assert.deepEqual(uncaught,[]);assert.deepEqual(cleanErrors(consoleErrors),[]);
  assert.equal(q.Errors.items.length,0);
}));

test('online non-headless browsers can inject the English and Sinhala font stylesheet', () => app(({w}) => {
  const style=w.document.getElementById('sdpDynamicFonts');
  assert.ok(style); assert.match(style.textContent,/Noto\+Sans\+Sinhala/); assert.match(style.textContent,/Inter/);
}));

test('credit, responsive glass, background video and reduced-motion support remain present', () => {
  for (const token of ['id="credit"','hansanaCinemaCycle','prefers-reduced-motion','Noto Sans Sinhala','id="bgLiveVideo"','bunny-live-wallpaper.mp4','progress-dots']) assert.ok(html.includes(token),token);
  assert.match(html,/z-index:9999!important/);
});
