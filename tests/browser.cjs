const TEST_PIN = String(require('crypto').randomInt(100000, 999999));
const WRONG_PIN = String((Number(TEST_PIN) + 1) % 1000000).padStart(6, '0');
const NEW_PIN = String(require('crypto').randomInt(10000000, 99999999));
const {chromium}=require('playwright-core');
const serverChromium=require('@sparticuz/chromium');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const artifacts=process.env.SDP_QA_OUTPUT || require('os').tmpdir();
async function createPin(page) {
 await page.locator('#btnLock').click();
 for(let step=0;step<2;step++) {for(const n of TEST_PIN) await page.locator('#pinPad [data-k="'+n+'"]').click();await page.locator('#pinSubmit').click();}
 await page.locator('#adminHost').waitFor();
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SDP_BROWSER_BIN || await serverChromium.executablePath(),args:serverChromium.args.filter(a=>!["--single-process","--disable-web-security","--allow-running-insecure-content","--disable-site-isolation-trials"].includes(a))});
 const results=[];
 for(const width of [390,320,768]) {
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1});
  const page=await context.newPage(),requests=[],errors=[];
  page.on('request',r=>{if(r.url().startsWith('http'))requests.push(r.url())});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForTimeout(1500);
  results.push({test:'Chromium '+width+'px boot and zero load network',status:errors.length===0&&requests.length===0&&!await page.locator('#fatal').isVisible()?'PASS':'FAIL',errors,requests});
  await page.locator('#sheets .shead button').click();
  await createPin(page);
  await page.waitForTimeout(300);results.push({test:'Chromium '+width+'px PIN unlock and no horizontal page overflow',status:await page.locator('#adminHost').isVisible() && await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)?'PASS':'FAIL'});
  await page.getByRole('button',{name:'Session',exact:true}).click();
  await page.getByLabel('Session number',{exact:true}).fill('19');await page.getByRole('button',{name:'Sun',exact:true}).click();
  await page.getByRole('button',{name:'Lock',exact:true}).first().click();
  results.push({test:'Chromium '+width+'px session update visible on Home',status:(await page.locator('#homeKicker').textContent()).includes('19')&&(await page.locator('#homeKicker').textContent()).includes('Sunday')?'PASS':'FAIL'});
  if(width===390) await page.screenshot({path:path.join(artifacts,'home-390.png'),fullPage:true});
  await context.close();
 }
 {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);await page.waitForTimeout(900);await page.locator('#sheets .shead button').click();
  await createPin(page);
  await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Settings & tools',exact:true}).click();await page.getByRole('button',{name:'Share this list (no server)',exact:true}).click();
  const originals=await page.locator('#sheets textarea').allTextContents();await page.getByRole('button',{name:'Shorter links (newer phones)',exact:true}).click();
  await page.getByRole('heading',{name:'Shorter links — use originals for older phones',exact:true}).waitFor();
  const compressed=await page.locator('#sheets textarea').allTextContents();
  results.push({test:'Chromium native CompressionStream creates shorter links and retains original fallback',status:compressed.length===originals.length&&compressed.some(l=>l.includes('#list=z.'))&&compressed.join('').length<originals.join('').length?'PASS':'FAIL'});
  for(const link of compressed) {await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href+'#'+link.split('#')[1]);await page.getByRole('button',{name:'Add',exact:true}).click();}
  const words=await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('sdp.v1'));return d.lists.find(l=>l.id===d.plan.pinned).words.length;});
  results.push({test:'Chromium native DecompressionStream preview/Add assembles the full 30-word list',status:words===30?'PASS':'FAIL'});await context.close();
 }
 for (const scenario of ['empty','corrupt','blocked','offline','unreachable','no-speech','no-UK']) {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(scenario=>{
   if(scenario==='corrupt')localStorage.setItem('sdp.v1','{broken');
   if(scenario==='blocked')Object.defineProperty(window,'localStorage',{get(){throw Error('Blocked storage');}});
   if(scenario==='offline')Object.defineProperty(navigator,'onLine',{get(){return false;}});
   if(scenario==='unreachable')localStorage.setItem('sdp.cloudurl','https://script.google.com/macros/s/unreachable/exec');
   if(scenario==='no-speech')Object.defineProperty(window,'speechSynthesis',{value:undefined});
   if(scenario==='no-UK'){Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'US voice',lang:'en-US',localService:true}],addEventListener(){},speak(){},cancel(){}}});}
  },scenario);
  await page.route('https://**/*',route=>route.abort());await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);await page.waitForTimeout(400);
  results.push({test:'Chromium boot: '+scenario,status:errors.length===0&&!await page.locator('#fatal').isVisible()?'PASS':'FAIL',errors});await context.close();
 }
 // Original animated fatal card: record before geometry.
 {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  const base=require('child_process').execFileSync('git',['show','7577968:index.html'],{cwd:root,maxBuffer:1000000}).toString();
  await page.route('https://**/*',route=>route.abort());await page.setContent(base);await page.waitForTimeout(400);
  const box=await page.locator('#fatal .modal').boundingBox();results.push({test:'Original Chromium fatal card is off-screen (before evidence)',status:box&&box.x<0?'PASS':'FAIL',box});await context.close();
 }
 // Force a genuine boot exception, so measure the actual animated fatal-card geometry.
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
 let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('  Store.test();\n  DB.load();','  throw new Error("QA boot failure");\n  Store.test();\n  DB.load();');
 await page.setContent(html);await page.waitForTimeout(500);
 const box=await page.locator('#fatal .flex-card').boundingBox();
 results.push({test:'Chromium 390px Full-mode fatal card centred and within viewport after animation',status:box&&box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<=844&&Math.abs(box.x+box.width/2-195)<2?'PASS':'FAIL',box});
 await page.screenshot({path:path.join(artifacts,'fatal-390.png')});
 console.log(JSON.stringify(results,null,2));await browser.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
