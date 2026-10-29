const DEFAULT_PIN = require('./test-pin.cjs');
const {chromium}=require('playwright-core');
const serverChromium=require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const artifacts=process.env.SDP_QA_OUTPUT || require('os').tmpdir();
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SDP_BROWSER_BIN || await serverChromium.executablePath(),args:serverChromium.args.filter(a=>!["--single-process","--disable-web-security","--allow-running-insecure-content","--disable-site-isolation-trials"].includes(a))});
 const results=[];
 /* Failing cases are also emitted as GitHub check annotations so the Checks API shows
    them, not only the raw step log. */
 function annotate(){for(const r of results)if(r.status==='FAIL')console.log('::error::'+r.test.replace(/%/g,'%25')+' :: '+String(r.detail||(r.errors&&JSON.stringify(r.errors))||'').replace(/\r?\n/g,' | ').slice(0,900));}
 /* v2.0.0: the PIN pad submits itself on the fourth digit, so #pinSubmit is only
    pressed when the pad is still open (a 5-8 digit PIN). Closing the sheet that is
    already gone used to hang this suite. */
 async function closeSheet(page){if(await page.locator('#sheets .shead button[aria-label="Close"]').count())await page.locator('#sheets .shead button[aria-label="Close"]').click();}
 async function unlockPin(page){
  await page.locator('#btnAdmin').click();
  for(const n of DEFAULT_PIN)await page.locator('#pinPad [data-k="'+n+'"]').click();
  const go=page.locator('#pinSubmit');
  if(await go.count())await go.click({timeout:1500}).catch(()=>{});
  await page.locator('#adminHost').waitFor({timeout:6000});
 }
 for(const width of [390,320,768]) {
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1});
  const page=await context.newPage(),requests=[],posts=[],errors=[];
  page.on('request',r=>{if(r.url().startsWith('http'))requests.push(r.url());if(r.method()!=='GET')posts.push(r.method()+' '+r.url())});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForTimeout(1500);
  /* v2.0.0 may only read its two cache-busted static files (relative to a
     file:// page, so not even http) plus the two documented read-only live
     channel reads - the cached ntfy state and community feeds - at boot.
     Nothing is ever POSTed, and no Apps Script, GitHub or other host is
     contacted: publishing and completions wait for a real user action. */
  const live=/^https:\/\/ntfy\.sh\/sdp_dictationb1_(state|comm)_v[0-9]+\/json\?poll=1&since=24h$/;
  const sse=/^https:\/\/ntfy\.sh\/sdp_dictationb1_state_v[0-9]+,sdp_dictationb1_comm_v[0-9]+\/sse$/;
  const staticOk=/(^|\/)data\/(session|version)\.json(\?v=\d+)?$/;const strays=requests.filter(u=>!staticOk.test(u)&&!live.test(u)&&!sse.test(u));
  const otherHosts=requests.filter(u=>!staticOk.test(u)&&!/^https:\/\/ntfy\.sh\//.test(u));
  results.push({test:'Chromium '+width+'px boot and zero load network',status:errors.length===0&&strays.length===0&&otherHosts.length===0&&posts.length===0&&!await page.locator('#fatal').isVisible()?'PASS':'FAIL',errors,requests,posts});
  await closeSheet(page);
  await unlockPin(page);
  await page.waitForTimeout(300);results.push({test:'Chromium '+width+'px PIN unlock and no horizontal page overflow',status:await page.locator('#adminHost').isVisible() && await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)?'PASS':'FAIL'});
  await page.getByRole('button',{name:'Session',exact:true}).click();
  await page.getByLabel('Session number',{exact:true}).fill('19');await page.getByRole('button',{name:'Sun',exact:true}).click();
  await page.getByRole('button',{name:'Lock now',exact:true}).first().click();
  /* v6 kicker: "SESSION 19 · 19 OCT 2026" (the class day lives in the session,
     not in the kicker), so check the new session number, the date and the day. */
  const kicker = (await page.locator('#homeKicker').textContent()).toLowerCase();
  const day = await page.evaluate(()=>{try{return (JSON.parse(localStorage.getItem('sdp.v49_working_sound_system')||localStorage.getItem('sdp.v46_session8_datasheet')||localStorage.getItem('sdp.v44_apple_liquid_complete') || localStorage.getItem('sdp.v21_guide_start')||'{}').session||{}).day||''}catch(e){return ''}});
  results.push({test:'Chromium '+width+'px session update visible on Home',status:kicker.includes('19')&&/\d{2}\/\d{2}\/\d{4}/.test(kicker)&&kicker.includes('ccbe galle branch')&&day==='Sunday'?'PASS':'FAIL'});
  if(width===390) await page.screenshot({path:path.join(artifacts,'artifact-home.png'),fullPage:true});
  await context.close();
 }
 {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);await page.waitForTimeout(900);await closeSheet(page);
  await unlockPin(page);
  await page.getByRole('button',{name:'Settings & tools',exact:true}).click();await page.getByRole('button',{name:'Share this list (no server)',exact:true}).click();
  const originals=await page.locator('#sheets textarea').allTextContents();await page.getByRole('button',{name:'Shorter links (newer phones)',exact:true}).click();
  await page.getByRole('heading',{name:'Shorter links — use originals for older phones',exact:true}).waitFor();
  const compressed=await page.locator('#sheets textarea').allTextContents();
  results.push({test:'Chromium native CompressionStream creates shorter links and retains original fallback',status:compressed.length===originals.length&&compressed.some(l=>l.includes('#list=z.'))&&compressed.join('').length<originals.join('').length?'PASS':'FAIL'});
  for(const link of compressed) {await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href+'#'+link.split('#')[1]);await page.getByRole('button',{name:'Add',exact:true}).click();}
  const words=await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem('sdp.v49_working_sound_system')||localStorage.getItem('sdp.v46_session8_datasheet')||localStorage.getItem('sdp.v44_apple_liquid_complete') || localStorage.getItem('sdp.v21_guide_start')||localStorage.getItem('sdp.v4_tue20')||localStorage.getItem('sdp.v1')||'null')||(window.DB&&window.DB.data);
    if(!d||!d.lists) return -1;
    const l=d.lists.find(x=>x.id===(d.plan&&d.plan.pinned))||d.lists.find(x=>x.id===(d.session&&d.session.listId))||d.lists[0];
    return l?l.words.length:-1;
  });
  results.push({test:'Chromium native DecompressionStream preview/Add assembles the full 30-word list',status:words===30?'PASS':'FAIL'});await context.close();
 }
 for (const scenario of ['empty','corrupt','blocked','offline','unreachable','no-speech','no-UK']) {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(scenario=>{
   if(scenario==='corrupt'){localStorage.setItem('sdp.v49_working_sound_system','{broken');localStorage.setItem('sdp.v44_apple_liquid_complete','{broken');localStorage.setItem('sdp.v21_guide_start','{broken');localStorage.setItem('sdp.v4_tue20','{broken');localStorage.setItem('sdp.v1','{broken');}
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
  let base;
  try {
    base=require('child_process').execFileSync('git',['show','7577968:index.html'],{cwd:root,maxBuffer:1000000}).toString();
  } catch(e) {
    base=null;
  }
  if (base) {
    await page.route('https://**/*',route=>route.abort());await page.setContent(base);await page.waitForTimeout(400);
    const box=await page.locator('#fatal .modal').boundingBox();results.push({test:'Original Chromium fatal card is off-screen (before evidence)',status:box&&box.x<0?'PASS':'FAIL',box});
  } else {
    results.push({test:'Original Chromium fatal card is off-screen (before evidence)',status:'SKIP',detail:'historical baseline commit 7577968 is unavailable'});
  }
  await context.close();
 }
 {
  /* v33 gate: the bundled bunny MP4 really decodes and autoplays in Chromium,
     and the zero-blur glass never hides it behind the Home hero. */
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);
  let ok=false,state={};
  try {
   await page.waitForFunction(()=>{const v=document.getElementById('bgLiveVideo');
    return v&&v.readyState>=2&&v.paused===false&&v.videoWidth>0;},null,{timeout:12000});
   state=await page.evaluate(()=>{const v=document.getElementById('bgLiveVideo');
    const hero=getComputedStyle(document.getElementById('homeHero'));
    return {readyState:v.readyState,paused:v.paused,videoWidth:v.videoWidth,
     filter:getComputedStyle(v).filter,opacity:getComputedStyle(v).opacity,
     src:v.getAttribute('src'),wrap:getComputedStyle(document.getElementById('bgLiveWrap')).display,
     heroBg:hero.backgroundColor,heroImg:hero.backgroundImage,heroBlur:hero.backdropFilter||hero.webkitBackdropFilter,
     scrim:getComputedStyle(document.getElementById('bgContrastScrim')).backgroundImage};});
   ok=state.readyState>=2&&state.paused===false&&state.videoWidth>0&&
    state.filter==='none'&&state.opacity==='1'&&
    state.src==='./assets/bunny-live-wallpaper.mp4'&&state.wrap!=='none'&&
    /linear-gradient/.test(state.heroImg)&&/8, 14, 28/.test(state.heroImg)&&
    state.heroBlur==='none'&&
    errors.length===0;
  } catch(e){state.error=String(e);}
  results.push({test:'Chromium v44 live bunny video decodes and autoplays behind optical glass',status:ok?'PASS':'FAIL',detail:state,errors});
  await context.close();
 }
 {
  /* v37 gate: the architectural interface is measured in the real engine, so a
     lost !important rule or a resurrected 999px pill cannot hide behind text. */
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForTimeout(900);await closeSheet(page);
  let v37={},ok=false;
  try {
   v37=await page.evaluate(()=>{
    const cs=(el)=>{if(!el)return null;const s=getComputedStyle(el);
     return {bg:s.backgroundColor,img:s.backgroundImage,fg:s.color,radius:s.borderRadius,weight:s.fontWeight,
      border:s.borderColor,shadow:s.boxShadow,textShadow:s.textShadow,stroke:s.webkitTextStrokeWidth||'',
      blur:s.backdropFilter||s.webkitBackdropFilter||'none',z:s.zIndex};};
    return {primary:cs(document.querySelector('.btn.pri')||document.getElementById('btnStart')),
     ghost:cs(document.getElementById('btnTheme')),seg:cs(document.getElementById('segMode')),
     tab:cs(document.querySelector('#tabbar button[aria-selected=true]')),
     thumb:cs(document.getElementById('tabInd')),segThumb:cs(document.querySelector('.seg .thumb')),
     tabbar:cs(document.getElementById('tabbar')),
     hero:cs(document.getElementById('homeHero')),title:cs(document.getElementById('homeTitle')),
     credit:cs(document.getElementById('credit')),video:cs(document.getElementById('bgLiveVideo'))};
   });
   const gradient=(m)=>!!m&&/linear-gradient/.test(m.img);
   ok=!!(gradient(v37.primary)&&/37, 99, 235/.test(v37.primary.img)&&v37.primary.fg==='rgb(255, 255, 255)'&&
      v37.primary.radius==='12px'&&Number(v37.primary.weight)>=600&&v37.primary.shadow!=='none'&&v37.primary.blur==='none')&&
    !!(gradient(v37.ghost)&&v37.ghost.fg==='rgb(248, 250, 252)'&&v37.ghost.radius==='12px')&&
    !!(gradient(v37.seg)&&v37.seg.radius==='12px'&&v37.seg.blur==='none')&&
    !!(v37.tab&&v37.tab.fg==='rgb(255, 255, 255)')&&
    !!(gradient(v37.thumb)&&v37.thumb.radius==='10px')&&
    !!(gradient(v37.segThumb)&&v37.segThumb.radius==='10px')&&
    !!(gradient(v37.tabbar)&&v37.tabbar.radius==='18px'&&v37.tabbar.shadow!=='none'&&v37.tabbar.blur==='none')&&
    !!(gradient(v37.hero)&&v37.hero.radius==='18px'&&v37.hero.shadow!=='none'&&v37.hero.blur==='none')&&
    !!(v37.title&&v37.title.img==='none'&&/rgb\(2[0-9]{2}, 2[0-9]{2}, 2[0-9]{2}\)/.test(v37.title.fg))&&
    !!(gradient(v37.credit)&&v37.credit.radius==='18px'&&v37.credit.z==='9999'&&/255, 221, 139/.test(v37.credit.border))&&
    !!(v37.video&&v37.video.blur==='none')&&errors.length===0;
  } catch(e){v37.error=String(e);}
  results.push({test:'Chromium v44 optical glass: gradients, specular shadows, rounded controls, readable text and no backdrop blur',status:ok?'PASS':'FAIL',detail:v37,errors});
  await context.close();
 }
 for (const relative of ['data.html','data/index.html']) {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  await page.goto(require('url').pathToFileURL(path.join(root,relative)).href);
  await page.locator('#wordRows tr').first().waitFor();
  await page.locator('#modeLite').click();
  await page.locator('#sessionsRange').evaluate(el=>{el.value='30';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#langSi').click();
  await page.locator('#langEn').click();
  await page.locator('#videoToggle').click();
  const report=await page.evaluate(()=>{
   const credit=getComputedStyle(document.getElementById('credit')),glass=getComputedStyle(document.querySelector('.glass'));
   const audio=document.getElementById('ttsMasterAudio'),video=document.getElementById('bgLiveVideo');
   document.querySelector('.play-word').click();
   return {rows:document.querySelectorAll('#wordRows tr').length,total:document.getElementById('totalMB').textContent,
    saved:document.getElementById('savedMB').textContent,z:credit.zIndex,animation:credit.animationName,
    blur:glass.backdropFilter||glass.webkitBackdropFilter||'none',overflow:document.documentElement.scrollWidth<=innerWidth,
    video:video.getAttribute('src'),videoOff:document.getElementById('videoToggle').getAttribute('aria-pressed'),
    audio:audio.getAttribute('src'),cross:audio.hasAttribute('crossorigin'),referrer:audio.getAttribute('referrerpolicy')};
  });
  const expectedSrc=relative==='data/index.html'?'../assets/bunny-live-wallpaper.mp4':'./assets/bunny-live-wallpaper.mp4';
  const passed=errors.length===0&&report.rows===30&&report.total==='1.025 MB'&&report.saved==='25.38 MB'&&
   report.z==='9999'&&report.animation==='hansanaCinemaCycle'&&report.blur==='none'&&report.overflow&&
   report.video===expectedSrc&&report.videoOff==='false'&&String(report.audio||'')==='https://dict.youdao.com/dictvoice?type=1&audio=afraid%20.'&&!report.cross&&report.referrer==='no-referrer';
  results.push({test:'Chromium public interactive data report: '+relative,status:passed?'PASS':'FAIL',detail:report,errors});
  await context.close();
 }
 // Force a genuine boot exception, so measure the actual animated fatal-card geometry.
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
 let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/function boot\(\)[{][\s\S]*?Store\.test\(\)[,;]/, 'function boot(){ throw new Error("QA boot failure");');
 await page.setContent(html);await page.waitForTimeout(500);
 const box=await page.locator('#fatal .flex-card').boundingBox();
 results.push({test:'Chromium 390px Full-mode fatal card centred and within viewport after animation',status:box&&box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<=844&&Math.abs(box.x+box.width/2-195)<2?'PASS':'FAIL',box});
 await page.screenshot({path:path.join(artifacts,'artifact-fatal.png')});
 console.log(JSON.stringify(results,null,2));annotate();await browser.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);console.log('::error::'+String(e&&e.stack||e).replace(/\r?\n/g,' | ').replace(/%/g,'%25').slice(0,900));process.exit(1)});
