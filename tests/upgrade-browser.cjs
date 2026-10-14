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
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
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
async function check(name,fn){try{await fn();results.push({test:name,status:'PASS'});}catch(e){results.push({test:name,status:'FAIL',detail:e.stack});}}
(async()=>{
 const browser=await pw[engine].launch(engine==='chromium'&&!process.env.SDP_BROWSER_STANDARD?{executablePath:await packaged.executablePath(),args:packaged.args.filter(a=>a!=='--single-process')}:{headless:true});
 const viewports=engine==='webkit'?[[320,568],[360,640],[390,844],[768,1024],[1280,800],[375,667],[430,932],[667,375],[844,390],[932,430]]:[[320,568],[360,640],[390,844],[768,1024],[1280,800]];
 for(const [width,height] of viewports)await check(engine+' admin single sticky header '+width+'x'+height+' and reduced viewport',async()=>{
  const {context,page,errors}=await boot(browser,width,'gb',height);
  try{
   await unlock(page);assert.equal(errors.length,0);
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
   const kdf=await page.evaluate(()=>JSON.parse(localStorage.getItem('sdp.v1')).admin.pinKdf);
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
   await page.getByRole('button',{name:'Save & Publish to All Students',exact:true}).click();
   await page.locator('#toasts').getByText(/Saved & published to all students/).waitFor();
   const d=await page.evaluate(()=>JSON.parse(localStorage.getItem('sdp.v1')));
   assert.equal(d.lists[0].publishedWords.length,29);assert.equal(d.lists[0].publishedWords[0].w,'free time');
   assert.ok(d.lists[0].publishedWords.every(x=>/--_gb_1\.mp3$/.test(x.audio||'')),'every published word keeps a British MP3: '+JSON.stringify(d.lists[0].publishedWords.slice(0,2)));
   assert.ok(d.lists[0].published&&d.lists[0].publishedVersion>=1,'publish flags');
   const words=Array.from({length:200},(_,i)=>'word'+String.fromCharCode(97+(i/26|0))+String.fromCharCode(97+i%26));
   await ta.fill(words.join(', '));await page.locator('[data-preview-row="199"]').waitFor();assert.equal(await page.locator('[data-preview-row]').count(),200);
   await page.getByRole('button',{name:'Lock now',exact:true}).first().click();await unlock(page);
   assert.equal(errors.length,0);
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
   await page.waitForFunction(()=>/Your turn|tap Next|Next in/.test(document.querySelector('#plStatus').textContent));
   const spoken=await page.evaluate(()=>window.__spoken),langs=await page.evaluate(()=>window.__langs);
   if(scenario==='none'){
    /* no synthesised voice at all: the learner still gets the chime and the text, and
       nothing is spoken in a foreign accent. */
    assert.deepEqual(spoken,[]);assert.deepEqual(await page.evaluate(()=>window.__langs),[]);
    assert.match((await page.locator('#plStatus').textContent()).trim(),/Your turn|tap Next|Next in/);
   } else if(scenario==='us'){
    /* v2.0.0 never blocks: dictionary MP3, then the cloud stream, then the device voice.
       Every utterance is tagged en-GB, so a US voice is never used silently. */
    assert.ok(spoken.length>0,'the fallback tiers keep speaking: '+JSON.stringify(spoken.slice(0,3)));
    assert.ok(langs.length&&langs.every(l=>l==='en-GB'),'every utterance is tagged en-GB: '+JSON.stringify(langs.slice(0,3)));
   } else {
    assert.equal(spoken.filter(t=>t==='appointment').length,2);
    assert(spoken.includes('Number 1.'));assert(!spoken.some(t=>t.includes('dentist appointment')));
    assert.ok(langs.every(l=>l==='en-GB'),'the UK voice is asked for en-GB: '+JSON.stringify(langs.slice(0,3)));
   }
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('sdp.v1')).snapshot);assert.equal(before.index,0);
   await page.reload();await page.locator('#homeTitle').waitFor();
   const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('sdp.v1')).snapshot);assert.equal(after.listId,before.listId);assert.equal(after.index,before.index);
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
