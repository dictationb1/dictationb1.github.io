'use strict';
/* v51 unit contract. Network media is simulated: timing and routing are
   tested here; audible pronunciation and provider availability are not. */
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const acorn = require('acorn');
const { JSDOM } = require('jsdom');
const { harness, html } = require('./app-harness.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const KEY = 'sdp.v51_hooded_liquid_glass';
const HOOD = './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';
const BUNNY = './assets/bunny-live-wallpaper.mp4';
const WANDER = './assets/wanderingpixels_2025-12-26_7588160805032430870.mp4';
const YOUDAO = 'https://dict.youdao.com/dictvoice?type=1&audio=';
const SI = 'https://dict.youdao.com/dictvoice?type=1&le=si&audio=';
const words = ['afraid','amazed','amusing','annoyed','anxious','ashamed','awesome','boring','brilliant','challenging','charming','confident','confusing','cruel','curious','delighted','depressed','disappointed','embarrassing','enjoyable','excellent','excited','fantastic','favourite','frightened','friendly','generous','guilty','healthy','hungry'];

function installMedia(w) {
  w.__plays = []; w.__loads = []; w.__preloads = []; w.__synth = []; w.__voices = [];
  w.HTMLMediaElement.prototype.load = function () {
    if (this.id === 'ttsMasterAudio') w.__loads.push(this.getAttribute('src'));
    else if (this.tagName === 'AUDIO') w.__preloads.push(this.getAttribute('src'));
  };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.play = function () {
    if (this.id === 'ttsMasterAudio') w.__plays.push({src:this.getAttribute('src'), rate:this.playbackRate, defaultRate:this.defaultPlaybackRate});
    return { then() {} };
  };
  w.SpeechSynthesisUtterance = function (text) { this.text = text; };
  Object.defineProperty(w, 'speechSynthesis', { configurable:true, value:{
    getVoices() { return w.__voices; }, cancel() {}, speak(u) { w.__synth.push(u); }, addEventListener() {}
  }});
}
function app(fn, before) {
  const a = harness(undefined, { before(w) { installMedia(w); if (before) before(w); } });
  try { return fn(a); } finally { a.close(); }
}
function end(audio) { assert.equal(typeof audio.onended, 'function', 'audio has an active completion callback'); audio.onended(); }
function makePlayer(a) {
  const E = a.q.Eng;
  E.start({}); E.st = 'speaking'; E.openPlayer(); a.q.UI.closeSheet();
  E.startWord(0);
  return E;
}

test('v51 metadata publishes all videos and complete current and archived sessions', () => {
  for (const file of ['data/config.json','data/session.json','data/version.json']) {
    const d = json(file);
    assert.equal(d.ver,51); assert.equal(d.schema,51); assert.equal(d.settingsRev,51);
    assert.equal(d.appVersion,'5.7.0'); assert.equal(d.key,KEY); assert.equal(d.storageKey,KEY);
    assert.equal(d.activeVideoSrc,HOOD); assert.deepEqual(d.repoMediaPaths,[HOOD,BUNNY,WANDER]);
    assert.deepEqual(d.repoMedia.map(x=>x.id),['media_hooded_red_eyes','media_bunny_live_wallpaper','media_wanderingpixels']);
    assert.equal(d.pastSessions[0].words.length,30); assert.equal(d.pastSessions[0].title,'Session 7 - Travel & Transport');
    assert.doesNotMatch(JSON.stringify(d), /"adminPin"/);
    for (const item of d.repoMedia) assert.ok(fs.statSync(path.join(root,item.poster)).size < 50000);
  }
  assert.deepEqual(json('data/session.json').lists.find(x=>x.id==='list_session_8_feelings').words.map(x=>x.w),words);
});

test('all published pages are ES5, contain no static links and stay below budget', () => {
  for (const file of ['index.html','data.html','data/index.html']) {
    const doc=read(file), script=doc.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(script); acorn.parse(script[1],{ecmaVersion:5}); assert.doesNotMatch(doc,/<link\b/i);
    assert.ok(Buffer.byteLength(doc)<(file==='index.html'?430000:60000));
  }
  assert.equal(read('data.html'),read('data/index.html'));
});

test('v50 migration retains learner data, resets bunny and scrubs PINs from every old copy', () => {
  let seed;
  app(a => { seed=JSON.parse(JSON.stringify(a.q.DB.data)); });
  seed.settingsRev=50; seed.v=50; seed.settings.perf='lite'; seed.settings.activeVideoSrc=BUNNY; seed.settings.adminPin='78987898';
  seed.snapshot={settingsAtStart:{adminPin:'78987898'},words:[{w:'afraid'}]};
  seed.history=[{id:'keep-history'}]; seed.comments=[{id:'keep-comment',text:'hello'}];
  app(a => {
    const d=a.q.DB.data;
    assert.equal(d.v,51); assert.equal(d.settingsRev,51); assert.equal(d.settings.activeVideoSrc,HOOD); assert.equal(d.settings.perf,'lite');
    assert.equal(d.history[0].id,'keep-history'); assert.equal(d.comments[0].id,'keep-comment');
    for (let i=0;i<a.w.localStorage.length;i++) {
      const key=a.w.localStorage.key(i);
      if (key.startsWith('sdp.')) assert.doesNotMatch(a.w.localStorage.getItem(key), /"adminPin"/);
    }
    d.settings.perf='lite';a.q.DB.saveNow();a.q.DB.load();assert.equal(a.q.DB.data.settings.perf,'lite');
    assert.equal(a.q.DB.resetToV51({settings:{activeVideoSrc:'javascript:bad'}}).settings.activeVideoSrc,HOOD);
    assert.equal(a.q.DB.resetToV51({settings:{activeVideoSrc:WANDER}}).settings.activeVideoSrc,WANDER);
  },w=>w.localStorage.setItem('sdp.v50_all_p0_p6_fixed',JSON.stringify(seed)));
});

test('gallery decodes and de-duplicates paths and forced refresh fetches the assets API', () => {
  const requests=[];
  app(a => {
    const L=a.q.LiveWallpaper;
    assert.equal(a.q.DEFAULT_WALLPAPER_SRC,HOOD);assert.equal(L.repoMedia.length,3);assert.ok(L.mediaList.length>=3);
    assert.equal(a.q.normalizeAssetPath('./assets/my%20clip.mp4'), './assets/my clip.mp4');
    L.mergeMediaPaths(['assets/my%20clip.mp4','assets/my clip.mp4'],{},L.mediaList);
    assert.equal(L.mediaList.filter(x=>x.src==='./assets/my clip.mp4').length,1);
    assert.equal(L.findMedia('./assets/my%20clip.mp4').src,'./assets/my clip.mp4');
    let complete=false; L.refreshMedia((items,ok)=>{complete=ok;assert.ok(items.length>=3);});
    assert.equal(complete,true);assert.ok(requests.some(url=>url===a.q.CONFIG.repoContentsUrl));
    const empty=[]; L.ensureDefault(empty); assert.equal(empty[0].id,'media_hooded_red_eyes');assert.match(empty[0].poster,/hooded-poster/);
    const video=a.w.document.getElementById('bgLiveVideo'); L.fitVideo();assert.equal(video.style.objectFit,'cover');
    video.muted=false;video.dispatchEvent(new a.w.Event('volumechange'));assert.equal(video.muted,true);assert.equal(video.defaultMuted,true);
  },w=>{
    w.XMLHttpRequest=function(){this.open=(method,url)=>requests.push(url);this.setRequestHeader=()=>{};this.send=()=>{this.status=200;this.readyState=4;this.responseText=JSON.stringify([{type:'file',path:'assets/new%20clip.mp4'}]);this.onreadystatechange();};};
  });
});

test('forced GitHub refresh queues behind an in-flight scan and reports failure without discarding cache', () => {
  const pending=[];
  app(a => {
    const L=a.q.LiveWallpaper, outcomes=[];
    L.discoverGitHubMedia(false, (items,ok)=>outcomes.push(['scan',ok]));
    L.refreshMedia((items,ok)=>outcomes.push(['refresh',ok,items.some(x=>x.src==='./assets/from cache.mp4')]));
    assert.equal(pending.length,1,'the forced refresh waits for the in-flight scan');
    Object.assign(pending[0],{status:200,readyState:4,responseText:JSON.stringify([{type:'file',path:'assets/from%20cache.mp4'}])});pending[0].onreadystatechange();
    assert.equal(pending.length,2,'a second genuine network request starts');
    Object.assign(pending[1],{status:503,readyState:4,responseText:''});pending[1].onreadystatechange();
    assert.deepEqual(outcomes,[['scan',true],['refresh',false,true]]);
    assert.ok(L.findMedia('./assets/from%20cache.mp4'));
  },w=>{w.XMLHttpRequest=function(){this.open=()=>{};this.setRequestHeader=()=>{};this.send=()=>pending.push(this);};});
});

test('one British provider, pinned synth, 2800ms start timeout and no Sinhala romanisation', () => app(a => {
  const S=a.q.Speech, audio=S.master(), voice={name:'Microsoft Sonia',lang:'en-GB'};
  a.w.__voices.push(voice);S.readVoices();
  for(const word of words) assert.deepEqual(Array.from(S.getRealStudioUrls(word,'en')),[YOUDAO+word]);
  assert.equal(S.getSingleVoiceUrl('ආයුබෝවන්','si'),SI+encodeURIComponent('ආයුබෝවන්'));
  S.stop();S.playWord('afraid',1,()=>{});a.clock.tick(2799);assert.equal(a.w.__synth.length,0);
  a.clock.tick(1);assert.equal(a.w.__synth.length,1);assert.equal(a.w.__synth[0].lang,'en-GB');assert.equal(a.w.__synth[0].voice,voice);
  S.stop();let result=null;S.speakPinnedSynth('ආයුබෝවන්',ok=>{result=ok;},'si',1);assert.equal(result,false);assert.equal(a.w.__synth.length,1);
  const chunks=Array.from(S.sinhalaChunks('පළමු වාක්‍යය. දෙවන වාක්‍යය.'));assert.equal(chunks.length,2);
  assert.equal(audio.getAttribute('referrerpolicy'),'no-referrer');assert.equal(audio.hasAttribute('crossorigin'),false);
}));

test('four-element prebuffer queues countdown, numbers and first two words, then rolls forward', () => app(a => {
  const S=a.q.Speech,E=a.q.Eng; E.start({});
  assert.equal(S._prePool.length,4);
  for(const t of ['Three.','Two.','One.','Number 1','Number 2','afraid','amazed']) assert.ok(S._preSeen[YOUDAO+encodeURIComponent(t)],t);
  assert.ok(S._prePool.every(x=>x.preload==='auto'&&x.getAttribute('referrerpolicy')==='no-referrer'&&!x.hasAttribute('crossorigin')));
  // Complete each slot so that queued URLs also actually receive a load.
  for(let pass=0;pass<4;pass++) S._prePool.forEach(x=>{if(x.oncanplaythrough)x.oncanplaythrough();});
  assert.ok(a.w.__preloads.includes(YOUDAO+'afraid'));assert.ok(a.w.__preloads.includes(YOUDAO+'amazed'));
  E.st='speaking';E.openPlayer();a.q.UI.closeSheet();E.startWord(1);
  assert.ok(S._preSeen[YOUDAO+'Number%203']);assert.ok(S._preSeen[YOUDAO+'amusing']);
}));

test('number, 180ms beat and identical word twice with 650ms studio pause', () => app(a => {
  const S=a.q.Speech,E=makePlayer(a),audio=S.master(),passes=[]; S.stop();S.desiredRate=.72;
  S.speakWordCycle({w:'afraid'},0,()=>{},n=>passes.push(n));
  assert.equal(a.w.__plays.at(-1).src,YOUDAO+'Number%201');assert.equal(E.layer.getAttribute('data-speaking'),'number');end(audio);
  a.clock.tick(179);assert.equal(a.w.__plays.at(-1).src,YOUDAO+'Number%201');a.clock.tick(1);
  assert.equal(a.w.__plays.at(-1).src,YOUDAO+'afraid');assert.equal(a.w.__plays.at(-1).rate,.72);assert.equal(E.layer.getAttribute('data-speaking'),'word-1');end(audio);
  a.clock.tick(649);assert.equal(passes.length,1);a.clock.tick(1);assert.equal(E.layer.getAttribute('data-speaking'),'word-2');
  assert.equal(a.w.__plays.at(-1).src,YOUDAO+'afraid');end(audio);assert.deepEqual(passes,[1,2]);
  assert.match(a.w.document.getElementById('plProgText').textContent,/Dictation #1 of 30/);
  a.q.DB.data.settings.numbers=false;S.speakWordCycle({w:'amazed'},1,()=>{});assert.equal(a.w.__plays.at(-1).src,YOUDAO+'amazed');
}));

test('ready fades speech then runs clock-anchored beats even if cue audio never ends', () => app(a => {
  const E=a.q.Eng,S=a.q.Speech;E.start({});const audio=S.master(),events=[];
  const paint=E.paintCountdown;E.paintCountdown=function(n,total){events.push([n,a.w.performance.now()]);return paint.call(this,n,total);};
  S.speakSingle=function(text){events.push([text,a.w.performance.now()]);};
  E.startWord=function(idx){events.push(['start:'+idx,a.w.performance.now()]);};
  E.readyGo();a.clock.tick(60);assert.ok(audio.volume>0&&audio.volume<1);a.clock.tick(60);
  const t0=events.find(x=>x[0]===3)[1];assert.equal(audio.volume,1);
  a.clock.setSystemTime(a.w.Date.now()+60000); // wall-clock changes must not move the monotonic beats
  a.clock.tick(3000);
  for(const [label,delta] of [[3,0],[2,1000],[1,2000],['start:0',3000]]) assert.equal(events.find(x=>x[0]===label)[1]-t0,delta);
  assert.deepEqual(events.filter(x=>typeof x[0]==='string'&&/^(Three|Two|One)/.test(x[0])).map(x=>x[0]),['Three.','Two.','One.']);
}));

test('all static test buttons share the genuine word pipeline and Pause moves into the player', () => app(a => {
  const ids=['btnTestVoice','btnReadyTest','btnTestVoicePlayer','btnTestVoiceDiag','btnPause'];
  ids.forEach(id=>assert.ok(a.w.document.getElementById(id),id));
  const S=a.q.Speech,audio=S.master();S.testSound();assert.equal(a.w.__plays.at(-1).src,YOUDAO+encodeURIComponent('Sound check. Number 1.'));
  end(audio);assert.equal(a.w.__plays.at(-1).src,YOUDAO+'afraid');end(audio);
  const E=makePlayer(a);assert.ok(E.layer.querySelector('#btnPause'));ids.forEach(id=>assert.equal(a.w.document.querySelectorAll('#'+id).length,1));
  E.stop(false);ids.forEach(id=>assert.ok(a.w.document.getElementById(id),id+' remains present'));
}));

test('helpers interrupt the writing timer, use British names and restart a full five seconds', () => app(a => {
  const E=makePlayer(a),S=a.q.Speech,audio=S.master();S.stop();E.startWrite(E.runId);a.clock.tick(2000);assert.equal(E.countdown.left,3);
  a.w.document.getElementById('btnSpell').click();assert.equal(E.phase,'helper');assert.equal(E.countdown,null);
  assert.equal(a.w.document.getElementById('plSub').textContent,'🔤 Spelling: A · F · R · A · I · D');
  assert.equal(a.w.__plays.at(-1).src,YOUDAO+encodeURIComponent('ay, eff, ar, ay, eye, dee. afraid'));
  if (audio.onplaying) audio.onplaying(); a.clock.tick(3000);assert.equal(E.idx,0);end(audio);assert.equal(E.phase,'write');assert.equal(E.countdown.left,5);
  a.w.document.getElementById('btnSlow').click();assert.equal(S.desiredRate,.72);assert.equal(a.w.__plays.at(-1).rate,.72);end(audio);assert.equal(E.countdown.left,5);
  S.stop();assert.equal(S.desiredRate,.72);
  a.w.document.getElementById('btnSentence').click();assert.equal(E.phase,'helper');assert.match(a.w.document.getElementById('plSub').textContent,/💬/);end(audio);assert.equal(E.countdown.left,5);
  a.w.document.getElementById('btnReplay').click();assert.equal(E.phase,'helper');end(audio);a.clock.tick(180);end(audio);a.clock.tick(650);end(audio);assert.equal(E.countdown.left,5);
  a.clock.tick(4999);assert.equal(E.idx,0);a.clock.tick(1);assert.equal(E.idx,1);
}));

test('pause cancels speech and resume restarts the current word after its prompt', () => app(a => {
  const E=makePlayer(a),audio=a.q.Speech.master();E.pause();assert.equal(E.st,'paused');assert.equal(E.paused,true);
  E.resume();assert.equal(E.phase,'resume');end(audio);assert.equal(E.idx,0);assert.equal(E.st,'speaking');
  assert.equal(a.w.__plays.at(-1).src,YOUDAO+'Number%201');
}));

test('finish renders exactly the same summary that is spoken in paper and type modes', () => {
  for(const mode of ['paper','type']) app(a => {
    const E=makePlayer(a),spoken=[];E.mode=mode;E.answers=mode==='type'?E.words.map((x,i)=>i<15?x.w:'wrong'):[]; if (mode==='type') E.typedAnswer=E.words[0].w;
    a.q.Speech.speakSingle=text=>spoken.push(text);E.finish(false);
    const summary=a.w.document.getElementById('resSummary').textContent;
    assert.equal(summary,mode==='paper'?'Dictation complete. Well done. Review all thirty words below.':'Dictation complete. Well done. Your score is 50 percent.');
    assert.equal(spoken.at(-1),summary);
  });
});

test('guide auto-speaks on first run, stops on close, and credit intro does not restart', () => app(a => {
  const S=a.q.Speech,UI=a.q.UI;a.q.DB.data.tourSeen=false;a.clock.tick(700);
  assert.ok(a.w.document.getElementById('guideSheet'));assert.equal(UI.guidePlaying,true);
  assert.ok(a.w.__plays.some(x=>x.src.includes('Welcome%20to%20the%20Smart')));
  UI.armGuideGesture();
  const button=a.w.document.getElementById('btnGuideAudio');
  button.dispatchEvent(new a.w.Event('pointerdown',{bubbles:true}));button.click();a.clock.tick(0);
  assert.equal(UI.guidePlaying,false,'tapping Stop must not trigger the autoplay gesture retry');
  UI.playGuideAudio();
  const token=S._seqToken;UI.closeSheet('guideSheet');assert.ok(S._seqToken>token);assert.equal(UI.guidePlaying,false);
  a.clock.tick(3200);assert.equal(a.w.document.body.classList.contains('credit-intro'),false);
  UI.showCreditNow();assert.equal(a.w.document.body.classList.contains('credit-intro'),false);assert.equal(UI._creditIntroPlayed,true);
  assert.ok(a.w.document.querySelector('#credit .hansanaSpot'));assert.ok(a.w.document.querySelector('#credit .ring'));
}));

test('wrong PIN feedback is clear and the correct eight-digit PIN still unlocks', () => app(a => {
  const d=a.w.document;a.q.Admin.open();
  for(const digit of '11112222') d.querySelector('#pinPad [data-k="'+digit+'"]').click();
  assert.match(d.getElementById('pinError').textContent,/Incorrect PIN — please enter the 8-digit Admin PIN/);
  for(const digit of '78987898') d.querySelector('#pinPad [data-k="'+digit+'"]').click();
  assert.equal(a.q.Admin.unlocked,true);
}));

test('data route uses the same single stream and rejects English Sinhala fallback', () => {
  const dom=new JSDOM(read('data.html'),{url:'https://example.test/data.html',runScripts:'outside-only',pretendToBeVisual:true});
  try { const w=dom.window;installMedia(w);w.eval(Array.from(w.document.scripts).find(x=>!x.type).textContent);
    assert.deepEqual(Array.from(w.TTS.getRealStudioUrls('afraid','en')),[YOUDAO+'afraid']);
    let ok;w.TTS.speakPinnedSynth('ආයුබෝවන්',value=>{ok=value;},'si',1);assert.equal(ok,false);assert.equal(w.__synth.length,0);
    const video=w.document.getElementById('bgLiveVideo');assert.equal(video.muted,true);assert.equal(video.defaultMuted,true);
  } finally { dom.window.close(); }
});
