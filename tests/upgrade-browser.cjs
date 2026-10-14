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
 window.__spoken=[];
 let voices=scenario==='none'?[]:scenario==='us'?Array.from({length:5},(_,i)=>({name:'US '+i,lang:'en-US',localService:true})):scenario==='aliases'?[{name:'Samsung',lang:'eng-GBR',localService:true},{name:'test',lang:'en_GB',localService:true}]:[{name:'Daniel',lang:'en-GB',localService:true}];
 Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>voices,speak(u){window.__spoken.push(u.text);setTimeout(()=>u.onend&&u.onend(),5);},cancel(){},pause(){},resume(){}}});
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
 await page.locator('#pinSubmit').click();await page.locator('#adminHost').waitFor();
}
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
   await page.getByText('I read this as: 30 words (plain list)',{exact:true}).waitFor();
   await page.locator('[data-preview-row="29"]').waitFor();
   await page.getByLabel('Word 1',{exact:true}).fill('free time');
   await page.getByLabel('Down word 1',{exact:true}).click();
   assert.equal(await page.getByLabel('Word 2',{exact:true}).inputValue(),'free time');
   await page.getByLabel('Delete word 1',{exact:true}).click();
   assert.equal(await page.getByLabel('Word 1',{exact:true}).inputValue(),'free time');
   await page.getByRole('button',{name:'Publish to students',exact:true}).click();
   assert.match(await page.locator('#modals').textContent(),/29 words.*Session/);
   await page.getByRole('button',{name:'Publish now',exact:true}).click();
   const d=await page.evaluate(()=>JSON.parse(localStorage.getItem('sdp.v1')));
   assert.equal(d.lists[0].publishedWords.length,29);assert.equal(d.lists[0].publishedWords[0].w,'free time');
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
   if(scenario==='us'||scenario==='none')await page.getByRole('button',{name:'Continue in Text mode',exact:true}).click();
   await page.getByRole('button',{name:"I'm ready",exact:true}).waitFor();
   await page.getByRole('button',{name:'Skip countdown',exact:true}).click();
   await page.waitForFunction(()=>/Your turn|tap Next|Next in/.test(document.querySelector('#plStatus').textContent));
   const spoken=await page.evaluate(()=>window.__spoken);
   if(scenario==='us'||scenario==='none')assert.deepEqual(spoken,[]);
   else{
    assert.equal(spoken.filter(t=>t==='appointment').length,2);
    assert(spoken.includes('Number 1.'));assert(!spoken.some(t=>t.includes('dentist appointment')));
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
 console.log(JSON.stringify(results,null,2));if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
