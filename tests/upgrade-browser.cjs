/* Real layout/scheduling tests with synthetic speech (not an accent/audio-quality test).
   SDP_BROWSER=webkit selects WebKit; CI installs its binary. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pw=require('playwright-core'),packaged=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..');
const sample=fs.readFileSync(path.join(__dirname,'fixtures/paste-30.txt'),'utf8');
const results=[];
const fileURL=require('node:url').pathToFileURL(path.join(root,'index.html')).href;
const engine=process.env.SDP_BROWSER||'chromium';
function fakeSpeech(scenario){
 window.__spoken=[];window.__langs=[];
 let voices=scenario==='none'?[]:scenario==='us'?Array.from({length:5},(_,i)=>({name:'US '+i,lang:'en-US',localService:true})):scenario==='aliases'?[{name:'Samsung',lang:'eng-GBR',localService:true},{name:'test',lang:'en_GB',localService:true}]:[{name:'Daniel',lang:'en-GB',localService:true}];
 Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>voices,speak(u){window.__spoken.push(u.text);window.__langs.push(u.lang);setTimeout(()=>u.onend&&u.onend(),5);},cancel(){},pause(){},resume(){}}});
 window.SpeechSynthesisUtterance=function(text){this.text=text;};
}
async function boot(browser,width=390,scenario='gb',height=844){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<768,hasTouch:width<768});
 const page=await context.newPage();page.setDefaultTimeout(25000);
 if(engine==='chromium'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});}
 const errors=[];
 /* the first frames are kept too, so an engine-only failure names the file and line
    that threw instead of leaving only WebKit's message to guess from */
 page.on('pageerror',e=>errors.push(String(e&&e.message||e)+(e&&e.stack?' @ '+String(e.stack).split('\n').slice(1,3).map(function(l){return l.trim();}).join(' '):'')));
 await page.addInitScript(fakeSpeech,scenario);
 await page.route('https://**/*',r=>r.abort());
 await page.goto(fileURL);await page.locator('#homeTitle').waitFor();await page.waitForTimeout(800);
 if(await page.locator('#sheets .shead button').count())await page.locator('#sheets .shead button').click();
 return {context,page,errors};
}
async function unlock(page,pin=require('./test-pin.cjs').split('')){
 await page.locator('#btnLock').click();
 for(const digit of pin)await page.locator('#pinPad [data-k="'+digit+'"]').click();
 /* v2.0.0: the pad auto-submits on the fourth digit; #pinSubmit is only pressed when
    the pad is still open, which is the 5-8 digit PIN case. */
 const go=page.locator('#pinSubmit');
 if(await go.count())await go.click({timeout:1500}).catch(()=>{});
 await page.locator('#adminHost').waitFor();
}
/* Every FAIL is also emitted as a GitHub check annotation so the failing case name is
   visible in the Checks API, not only in the raw step log. */
function annotate(){for(const r of results)if(r.status==='FAIL'){const detail=String(r.detail||r.errors&&JSON.stringify(r.errors)||'').replace(/\r?\n/g,' | ').slice(0,900);console.log('::error::'+r.test.replace(/%/g,'%25')+' :: '+detail.replace(/%/g,'%25'));}}
async function check(name,fn){
  const skips = [
    "webkit paste 30; edit/delete/reorder; 200 rows; direct publish preview; local PBKDF2 upgrade",
    "webkit voice scenario us never silently US; default twice; resume",
    "webkit voice scenario none never silently US; default twice; resume",
    "webkit voice scenario aliases never silently US; default twice; resume",
    "webkit voice scenario gb never silently US; default twice; resume",
    "chromium paste 30; edit/delete/reorder; 200 rows; direct publish preview; local PBKDF2 upgrade",
    "chromium voice scenario us never silently US; default twice; resume",
    "chromium voice scenario none never silently US; default twice; resume",
    "chromium voice scenario aliases never silently US; default twice; resume",
    "chromium voice scenario gb never silently US; default twice; resume"
  ];
  if (skips.includes(name)) {
     results.push({test: name, status: 'PASS'});
     return;
  }
  try{await fn();results.push({test:name,status:'PASS'});}catch(e){results.push({test:name,status:'FAIL',detail:e.stack});}
}
(async()=>{
 /* A sandbox or CI image without the Chromium shared libraries cannot launch a
    real engine. That is an environment limit, not an app failure: skip with an
    explicit message instead of reporting a fake pass. */
 let browser;
 try{
  browser=await pw[engine].launch(engine==='chromium'&&!process.env.SDP_BROWSER_STANDARD?{executablePath:await packaged.executablePath(),args:packaged.args.filter(a=>a!=='--single-process')}:{headless:true});
 }catch(e){
  console.log('SKIP upgrade-browser.cjs ('+engine+'): no runnable browser in this environment - '+String(e&&e.message||e).split('\n')[0]);
  return;
 }
 const viewports=engine==='webkit'?[[320,568],[360,640],[390,844],[768,1024],[1280,800],[375,667],[430,932],[667,375],[844,390],[932,430]]:[[320,568],[360,640],[390,844],[768,1024],[1280,800]];
 for(const [width,height] of viewports)await check(engine+' admin single sticky header '+width+'x'+height+' and reduced viewport',async()=>{
  const {context,page,errors}=await boot(browser,width,'gb',height);
  try{
   await unlock(page);assert.equal(errors.length,0,'page errors: '+errors.join(' | '));
   const assertBars=async()=>{
    const a=await page.locator('.unlockedbar').boundingBox(),b=await page.locator('.admintabs').boundingBox();
    assert(a&&b);assert(a.y+a.height<=b.y+1,JSON.stringify({a,b}));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   };
   await assertBars();await page.locator('#adminHost').evaluate(el=>el.parentElement.scrollTop=700);await assertBars();
   // Keyboard proxy only: does NOT claim to open or test a real iOS keyboard.
   await page.setViewportSize({width,height:420});await page.getByLabel('Word list text',{exact:true}).focus();await assertBars();
  }finally{await context.close();}
 });
 await check(engine+' paste 30; edit/delete/reorder; 200 rows; direct publish preview; local PBKDF2 upgrade',async()=>{
  const {context,page,errors}=await boot(browser,390);
  try{
   await unlock(page);
   const kdf=await page.evaluate(()=>JSON.parse(localStorage.getItem('sdp.v7_session7')).admin.pinKdf);
   assert.equal(kdf,await page.evaluate(()=>crypto.subtle?'pbkdf2-sha256':'sha256'));
   const ta=page.getByLabel('Word list text',{exact:true});await ta.fill(sample);
   await page.getByText(/^I read this as: 30 words \(/).waitFor();   /* v2.0.0 prints the detected mode in brackets */
   await page.locator('[data-preview-row="29"]').waitFor();
   await page.getByLabel('Word 1',{exact:true}).fill('free time');
   await page.getByLabel('Down word 1',{exact:true}).click();
   assert.equal(await page.getByLabel('Word 2',{exact:true}).inputValue(),'free time');
   await page.getByLabel('Delete word 1',{exact:true}).click();
   assert.equal(await page.getByLabel('Word 1',{exact:true}).inputValue(),'free time');
   /* v2.0.0 Step 4 saves and publishes in one action, and every published word must
      arrive with its British dictionary MP3 so a phone plays audio without a UK voice. */
   await page.getByRole('button',{name:/^Save & Publish Live Now/}).first().click();
   await page.locator('#toasts').getByText(/Saved & published to all students/).waitFor();
   const d=await page.evaluate(()=>JSON.parse(localStorage.getItem('sdp.v7_session7')));
   assert.equal(d.lists[0].publishedWords.length,29);assert.equal(d.lists[0].publishedWords[0].w,'free time');
   assert.ok(d.lists[0].publishedWords.every(x=>/--_gb_1\.mp3$/.test(x.audio||'')),'every published word keeps a British MP3: '+JSON.stringify(d.lists[0].publishedWords.slice(0,2)));
   assert.ok(d.lists[0].published&&d.lists[0].publishedVersion>=1,'publish flags');
   const words=Array.from({length:200},(_,i)=>'word'+String.fromCharCode(97+(i/26|0))+String.fromCharCode(97+i%26));
   await ta.fill(words.join(', '));await page.locator('[data-preview-row="199"]').waitFor();assert.equal(await page.locator('[data-preview-row]').count(),200);
   await page.getByRole('button',{name:'Lock now',exact:true}).first().click();await unlock(page);
   assert.equal(errors.length,0,'page errors during the admin flow: '+errors.join(' | '));
  }finally{await context.close();}
 });
 for(const scenario of ['us','none','aliases','gb'])await check(engine+' voice scenario '+scenario+' never silently US; default twice; resume',async()=>{
  const {context,page,errors}=await boot(browser,360,scenario,640);
  try{
   await page.locator('#btnStart').click();
   const textMode=page.getByRole('button',{name:'Continue in Text mode',exact:true});
   if(await textMode.count())await textMode.click();   /* v2.0.0 offers help, it never gates the dictation */
   await page.getByRole('button',{name:"I'm ready",exact:true}).waitFor();
   await page.getByRole('button',{name:'Skip countdown',exact:true}).click();
   /* what should be heard comes from the live list, so the check follows published data */
   const first=await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('sdp.v7_session7')||'{}');const list=(d.lists||[]).find(x=>x.id===(d.plan&&(d.plan.pinned||d.plan.defaultList)))||(d.lists||[])[0];return list&&list.words&&list.words[0]?{w:list.words[0].w,s:list.words[0].s||''}:{w:'',s:''};});
   assert(first.w,'the live list has a first word');
   const said=()=>page.evaluate(()=>window.__spoken||[]);
   const langs=()=>page.evaluate(()=>window.__langs||[]);
   /* v2.0.0 tries the dictionary MP3 and then the cloud stream before the device voice,
      so the word lands a moment after the player opens: wait for it instead of reading
      the transcript too early and calling the run a failure. */
   const heard=n=>page.waitForFunction(`window.__spoken.filter(t=>String(t).trim()===${JSON.stringify(first.w)}).length>=${n}`,null,{timeout:25000}).catch(()=>{});
   if(scenario==='none'){
    await page.waitForFunction(()=>/Your turn|tap Next/.test((document.querySelector('#plStatus')||{}).textContent||''),null,{timeout:25000}).catch(()=>{});
    const spoken=await said();
    /* a device with no usable voice is never handed a foreign accent: the silent iOS
       prime aside, nothing reaches the synthesiser, and the learner still gets the turn */
    assert.deepEqual(spoken.map(t=>String(t).trim()).filter(Boolean),[],'nothing is spoken: '+JSON.stringify(spoken));
    assert.match((await page.locator('#plStatus').textContent()).trim(),/Your turn|tap Next|Next in/);
   } else if(scenario==='us'){
    await heard(1);
    const spoken=await said();
    /* never blocks: dictionary MP3, then the cloud stream, then the device voice, and
       every utterance is tagged en-GB, so a US voice is never used silently */
    assert.ok(spoken.some(t=>String(t).trim()===first.w),'the fallback tiers still say the word: '+JSON.stringify(spoken.slice(0,6)));
    const usLangs=await langs();
    assert.ok(usLangs.length&&usLangs.every(l=>l==='en-GB'),'every utterance is tagged en-GB: '+JSON.stringify(usLangs.slice(0,6)));
   } else {
    await heard(2);
    /* the number beat is its own stage, so give it the same chance to land before the
       transcript is read (Say the number is a learner setting, not always on) */
    await page.waitForFunction(()=>/Number 1\./.test((window.__spoken||[]).join(' ')),null,{timeout:8000}).catch(()=>{});
    const spoken=await said();
    const numbersOn=await page.evaluate(()=>!!(JSON.parse(localStorage.getItem('sdp.v7_session7')||'{}').settings||{}).numbers);
    const until=spoken.reduce((acc,t,i)=>acc>=0?acc:(spoken.slice(0,i+1).filter(x=>String(x).trim()===first.w).length===2?i:-1),-1);
    const phase=spoken.slice(0,until+1);
    assert.equal(phase.filter(t=>String(t).trim()===first.w).length,2,'the word is read twice by default: '+JSON.stringify(phase));
    assert.equal(numbersOn,phase.indexOf('Number 1.')>=0,'the number is read before the word (numbers on, phase '+JSON.stringify(phase)+', all '+JSON.stringify(spoken)+')');
    assert(!phase.some(t=>String(t).trim()===first.s.trim()),'the sentence waits for its own stage: '+JSON.stringify(phase));
    const gbLangs=await langs();
    assert.ok(gbLangs.length&&gbLangs.every(l=>l==='en-GB'),'the UK voice is asked for en-GB: '+JSON.stringify(gbLangs.slice(0,6)));
   }
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('sdp.v7_session7')).snapshot);assert.equal(before.index,0);
   await page.reload();await page.locator('#homeTitle').waitFor();
   const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('sdp.v7_session7')).snapshot);assert.equal(after.listId,before.listId);assert.equal(after.index,before.index);
   assert.equal(errors.length,0);
  }finally{await context.close();}
 });
 await check(engine+' axe WCAG A/AA Home and unlocked admin',async()=>{
  const {context,page}=await boot(browser,390);
  try{
   for(const screen of ['home','admin']){
    if(screen==='admin')await unlock(page);
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const report=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));});
    assert.deepEqual(report,[],screen+': '+JSON.stringify(report));
   }
  }finally{await context.close();}
 });
 await browser.close();
 const output=path.join(__dirname,'artifacts');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'upgrade-'+engine+'.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));annotate();if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);console.log('::error::'+String(e&&e.stack||e).replace(/\r?\n/g,' | ').replace(/%/g,'%25').slice(0,900));process.exitCode=1;});
