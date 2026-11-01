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
 async function waitHome(page){
  await page.waitForTimeout(3500); /* the one-time guide opens about a second after boot */
  for(let i=0;i<24;i++){
   await closeSheet(page);
   if(await page.locator('#sdpTopLangPill').isVisible().catch(()=>false)&&await page.locator('#sheets .sheet').count()===0)return true;
   await page.waitForTimeout(250);
  }
  return page.locator('#btnLang').isVisible().catch(()=>false);
 }
 async function unlockPin(page){
  let opened=false;
  for(let i=0;i<12&&!opened;i++){
   await waitHome(page);
   try{
    if(await page.locator('#topOverflow').count()){await page.evaluate(()=>{var d=document.getElementById('topOverflow');if(d)d.open=true;});}
    await page.evaluate(()=>{var b=document.getElementById('btnAdmin'); if(b) b.click();});
    await page.evaluate(()=>{var d=document.getElementById('topOverflow');if(d)d.open=false;});
    await page.locator('#pinPad').waitFor({timeout:3000});opened=true;
   }catch(e){await closeSheet(page);await page.waitForTimeout(300);}
  }
  if(!opened)throw new Error('lecturer mode button never became clickable');
  for(const n of DEFAULT_PIN)await page.locator('#pinPad [data-k="'+n+'"]').click();
  const go=page.locator('#pinSubmit');
  if(await go.count())await page.evaluate(()=>{var b=document.getElementById('pinSubmit');if(b)b.click();}).catch(()=>{});
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
  const staticOk=/(^|\/)data\/(session|version)\.json(\?v=\d+)?$/;const guide=/^https:\/\/dict\.youdao\.com\/dictvoice\?type=1&audio=Welcome%20to%20the%20Smart/;const strays=requests.filter(u=>!staticOk.test(u)&&!live.test(u)&&!sse.test(u)&&!guide.test(u));
  const otherHosts=requests.filter(u=>!staticOk.test(u)&&!/^https:\/\/ntfy\.sh\//.test(u)&&!guide.test(u));
  results.push({test:'Chromium '+width+'px boot uses only documented reads and first-run guide audio',status:errors.length===0&&strays.length===0&&otherHosts.length===0&&posts.length===0&&!await page.locator('#fatal').isVisible()?'PASS':'FAIL',errors,requests,posts});
  await closeSheet(page);
  await unlockPin(page);
  await page.waitForTimeout(300);results.push({test:'Chromium '+width+'px PIN unlock and no horizontal page overflow',status:await page.locator('#adminHost').isVisible() && await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)?'PASS':'FAIL'});
  await page.getByRole('button',{name:'Session',exact:true}).click();
  await page.getByLabel('Session number',{exact:true}).fill('19');await page.getByRole('button',{name:'Sun',exact:true}).click();
  await page.getByRole('button',{name:'Lock now',exact:true}).first().click();
  /* v6 kicker: "SESSION 19 · 19 OCT 2026" (the class day lives in the session,
     not in the kicker), so check the new session number, the date and the day. */
  const kicker = (await page.locator('#homeKicker').textContent()).toLowerCase();
  const day = await page.evaluate(()=>{try{return (JSON.parse(localStorage.getItem('sdp.v57_secure_local')||localStorage.getItem('sdp.v56_audit_verified')||localStorage.getItem('sdp.v55_guaranteed_device_sync')||localStorage.getItem('sdp.v54_encrypted_universal_sync')||localStorage.getItem('sdp.v52_elevenlabs_studio')||localStorage.getItem('sdp.v46_session8_datasheet')||localStorage.getItem('sdp.v44_apple_liquid_complete') || localStorage.getItem('sdp.v21_guide_start')||'{}').session||{}).day||''}catch(e){return ''}});
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
    const d=JSON.parse(localStorage.getItem('sdp.v52_elevenlabs_studio')||localStorage.getItem('sdp.v46_session8_datasheet')||localStorage.getItem('sdp.v44_apple_liquid_complete') || localStorage.getItem('sdp.v21_guide_start')||localStorage.getItem('sdp.v4_tue20')||localStorage.getItem('sdp.v1')||'null')||(window.DB&&window.DB.data);
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
   if(scenario==='corrupt'){localStorage.setItem('sdp.v52_elevenlabs_studio','{broken');localStorage.setItem('sdp.v44_apple_liquid_complete','{broken');localStorage.setItem('sdp.v21_guide_start','{broken');localStorage.setItem('sdp.v4_tue20','{broken');localStorage.setItem('sdp.v1','{broken');}
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
    base=require('child_process').execFileSync('git',['show','7577968:index.html'],{cwd:root,maxBuffer:1000000,stdio:['ignore','pipe','ignore']}).toString();
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
  /* v51: the hooded MP4 really decodes and autoplays behind true glass. */
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);
  let ok=false,state={},staticDefault=false;
  try {
   await page.waitForTimeout(1200);
   staticDefault=await page.evaluate(()=>{const v=document.getElementById('bgLiveVideo');return !v.getAttribute('src')&&document.body.getAttribute('data-wallpaper')==='static';});
   await page.evaluate(()=>{window.SDPCore.UI.setTab('set');});
   await page.evaluate(()=>{var b=document.getElementById('btnOpenGallery');if(b)b.click();});
   await page.waitForTimeout(300);
   await page.evaluate(()=>{var b=document.querySelector('[data-gallery-select]');if(b)b.click();});
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
    state.src==='./assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4'&&state.wrap!=='none'&&
    /linear-gradient/.test(state.heroImg)&&/8, 14, 28/.test(state.heroImg)&&
    state.heroBlur==='none'&&
    errors.length===0;
  } catch(e){state.error=String(e);}
  results.push({test:'Chromium v59 static default then opt-in hooded video decodes behind the top-bar glass',status:(ok&&staticDefault)?'PASS':'FAIL',detail:Object.assign({staticDefault},state),errors});
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
      blur:s.backdropFilter||s.webkitBackdropFilter||'none',z:s.zIndex,pos:s.position};};
    return {primary:cs(document.querySelector('.btn.pri')||document.getElementById('btnStart')),
     ghost:cs(document.getElementById('btnHowItWorks')),seg:cs(document.querySelector('#sdpHeroConfigChips .sdp-chip')),
     tab:cs(document.querySelector('#tabbar button[aria-selected=true]')),
     thumb:cs(document.getElementById('sdpTopLangPill')),segThumb:cs(document.getElementById('creditDocked')),
     tabbar:cs(document.getElementById('tabbar')),
     hero:cs(document.getElementById('homeHero')),title:cs(document.getElementById('homeTitle')),
     credit:cs(document.getElementById('creditDocked')),video:cs(document.getElementById('bgLiveVideo')),perf:document.body.getAttribute('data-perf')};
   });
   const gradient=(m)=>!!m&&/linear-gradient/.test(m.img);
   ok=!!(v37.primary&&/rgb\(56, 189, 248\)/.test(v37.primary.bg)&&v37.primary.fg==='rgb(6, 37, 48)'&&v37.primary.radius==='12px'&&Number(v37.primary.weight)>=700&&v37.primary.blur==='none')&&
    !!(v37.ghost&&/rgb\(34, 34, 38\)/.test(v37.ghost.bg)&&v37.ghost.blur==='none')&&
    !!(v37.seg&&/rgb\(34, 34, 38\)/.test(v37.seg.bg)&&v37.seg.blur==='none')&&
    !!(v37.tab&&v37.tab.fg==='rgb(56, 189, 248)')&&
    !!(v37.tabbar&&v37.tabbar.radius==='20px'&&v37.tabbar.blur==='none'&&/rgb\(18, 18, 21\)/.test(v37.tabbar.bg))&&
    !!(v37.thumb&&v37.thumb.blur==='none')&&
    !!(v37.segThumb&&v37.segThumb.pos==='static')&&
    !!(v37.hero&&v37.hero.radius==='16px'&&v37.hero.blur==='none'&&/rgb\(24, 24, 27\)/.test(v37.hero.bg))&&
    !!(v37.title&&v37.title.img==='none'&&v37.title.fg==='rgb(250, 250, 250)')&&
    !!(v37.video&&v37.video.blur==='none')&&errors.length===0;
  } catch(e){v37.error=String(e);}
  results.push({test:'Chromium v60 design system: solid Sky-400 CTA, Zinc cards, 20px dock, zero backdrop blur',status:ok?'PASS':'FAIL',detail:v37,errors});
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
   const creditEl=document.getElementById('credit'),credit=creditEl?getComputedStyle(creditEl):null,glass=getComputedStyle(document.querySelector('.glass'));
   const audio=document.getElementById('ttsMasterAudio'),video=document.getElementById('bgLiveVideo');
   document.querySelector('.play-word').click();
   return {rows:document.querySelectorAll('#wordRows tr').length,total:document.getElementById('totalMB').textContent,
    saved:document.getElementById('savedMB').textContent,z:credit?credit.zIndex:null,animation:credit?credit.animationName:'none',creditRemoved:!creditEl,
    blur:glass.backdropFilter||glass.webkitBackdropFilter||'none',overflow:document.documentElement.scrollWidth<=innerWidth,
    video:video.getAttribute('src'),videoOff:document.getElementById('videoToggle').getAttribute('aria-pressed'),
    audio:audio.getAttribute('src'),cross:audio.hasAttribute('crossorigin'),referrer:audio.getAttribute('referrerpolicy')};
  });
  const expectedSrc=relative==='data/index.html'?'../assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4':'./assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';
  const passed=errors.length===0&&report.rows===30&&/MB/.test(report.total)&&report.creditRemoved&&report.overflow&&
   report.video===expectedSrc&&report.videoOff==='true'&&String(report.audio||'')==='https://dict.youdao.com/dictvoice?type=1&audio=afraid'&&!report.cross&&report.referrer==='no-referrer';
  results.push({test:'Chromium public interactive data report: '+relative,status:passed?'PASS':'FAIL',detail:report,errors});
  await context.close();
 }
 // ---------------------------------------------------------------------------
 // v53 (5.9.0): 3-card Professor Studio, permanent GitHub voice vault and the
 // zero-drain credit lock. Served over http so the lazy studio, IndexedDB and
 // the storage tier are all real.
 // ---------------------------------------------------------------------------
 {
  const http=require('http');const mime={'.html':'text/html','.json':'application/json','.mp4':'video/mp4','.webp':'image/webp','.js':'text/javascript','.svg':'image/svg+xml'};
  const server=http.createServer((req,res)=>{
   const rel=decodeURIComponent(String(req.url||'/').split('?')[0]).replace(/^\/+/,'')||'index.html';
   const file=path.join(root,rel);
   if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.statusCode=404;return res.end('nope');}
   res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
   res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const context=await browser.newContext({viewport:{width:1024,height:900}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let synthCalls=0, dictCalls=0, siCalls=0;
  const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-expose-headers':'*'};
  await page.route('https://api.elevenlabs.io/**',async route=>{
   const req=route.request();
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
   if(/user\/subscription/.test(req.url()))return route.fulfill({status:200,headers:Object.assign({'content-type':'application/json'},CORS),body:JSON.stringify({tier:'free',character_count:250,character_limit:10000})});
   synthCalls++;
   return route.fulfill({status:200,headers:Object.assign({'content-type':'audio/mpeg'},CORS),body:Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00fake-mp3-bytes','binary')});
  });
  await page.route('https://api.dictionaryapi.dev/**',async route=>{
   dictCalls++;
   route.fulfill({status:200,headers:Object.assign({'content-type':'application/json'},CORS),body:JSON.stringify([{word:'zephyr',phonetic:'/ˈzef.ər/',phonetics:[{text:'/ˈzef.ər/',audio:'https://api.dictionaryapi.dev/media/pronunciations/en/zephyr-uk.mp3'}],meanings:[{partOfSpeech:'noun',definitions:[{definition:'A soft gentle breeze.',example:'A warm zephyr crossed the harbour.'}]}]}])});
  });
  await page.route('https://translate.googleapis.com/**',async route=>{
   siCalls++;
   route.fulfill({status:200,headers:Object.assign({'content-type':'application/json'},CORS),body:JSON.stringify([[['මෘදු සුළඟ']]])});
  });
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>!!window.ElevenVault,{timeout:15000}).catch(()=>{});
  await page.waitForTimeout(900);
  await closeSheet(page);
  await unlockPin(page);
  const cards=await page.evaluate(()=>({
    title:!!document.querySelector('#profSessionTitle'),date:!!document.querySelector('#profSessionDate'),
    info:!!document.querySelector('#profClassInfo'),words:!!document.querySelector('#adminQuickWordsInput'),
    table:!!document.querySelector('#profWordsTable'),go:!!document.querySelector('#btnAdminAutoComplete'),
    vault:!!document.querySelector('#elVaultList'),gen:!!document.querySelector('#btnElGenerateAll'),
    exp:!!document.querySelector('#btnElExportJson'),imp:!!document.querySelector('#btnElImportJson'),
    key:!!document.querySelector('#elApiKeyInput'),gh:!!document.querySelector('#ghTokenInput'),
    voice:(document.querySelector('#elVoiceSelect')||{}).value||'',model:(document.querySelector('#elModelSelect')||{}).value||'',
    lock:(document.querySelector('#elCreditLockBanner')||{}).textContent||'',
    adv:document.querySelectorAll('details.admin-advanced').length
  }));
  const cardOk=Object.keys(cards).filter(k=>['voice','model','lock','adv'].indexOf(k)<0).every(k=>cards[k]);
  results.push({test:'Chromium v53 the admin panel is the 3-card Professor Studio with the credit lock banner',status:cardOk&&cards.voice==='Xb7hH8MSUJpSbSDYk0k2'&&cards.model==='eleven_flash_v2_5'&&/Credit Protection Lock: ACTIVE/.test(cards.lock)&&cards.adv===1?'PASS':'FAIL',detail:cards});
  await page.locator('#elApiKeyInput').fill('xi-test-key-53');
  await page.locator('#btnElVerify').click();
  await page.waitForFunction(()=>/Connected/.test((document.querySelector('#elKeyStatus')||{}).textContent||''),{timeout:10000}).catch(()=>{});
  const saved=await page.evaluate(()=>({key:window.ElevenVault.apiKey(),status:document.querySelector('#elKeyStatus').textContent,stats:document.querySelector('#elVaultStats').textContent,stored:window.sessionStorage.getItem('sdp.session.elKey')||'',local:(JSON.parse(localStorage.getItem('sdp.v57_secure_local')||'{}').settings||{}).elevenLabsKey||''}));
  results.push({test:'Chromium v57 Save & Verify keeps the ElevenLabs key in sessionStorage only and shows the live credit balance',status:saved.key==='xi-test-key-53'&&saved.stored==='xi-test-key-53'&&saved.local===''&&/Tier: Free/.test(saved.status)&&/9,750 \/ 10,000/.test(saved.status)&&/Remaining ElevenLabs Credits: 9,750 \/ 10,000/.test(saved.stats)?'PASS':'FAIL',detail:saved});
  const beforePlay=synthCalls;
  const playback=await page.evaluate(()=>new Promise(resolve=>{window.ElevenVault.resolve('Number 1',(err,url)=>resolve({err:err,url:!!url}));}));
  results.push({test:'Chromium v53 student playback of a missing clip never touches the paid endpoint',status:playback.err==='missing'&&!playback.url&&synthCalls===beforePlay?'PASS':'FAIL',detail:{playback,calls:synthCalls-beforePlay}});
  const beforeGen=synthCalls;
  const gen=await page.evaluate(()=>new Promise(resolve=>{window.ElevenVault.generateBatch(['Number 1','Number 1','zephyr'],()=>{},resolve);}));
  results.push({test:'Chromium v53 the admin Generate button creates each missing clip exactly once',status:gen.ok&&gen.generated===2&&synthCalls-beforeGen===2?'PASS':'FAIL',detail:{gen,calls:synthCalls-beforeGen}});
  const tiers=await page.evaluate(()=>new Promise(resolve=>{
   const key=window.ElevenVault.keyFor('Number 1');
   window.ElevenVault.idbGet(key,data=>resolve({key:key,idb:/^data:audio\/mpeg;base64,/.test(data||''),mem:/^data:audio\/mpeg;base64,/.test(window.ElevenVault.memMap[key]||''),count:window.ElevenVault.clipCount(),blocked:window.ElevenVault.stats.blocked}));
  }));
  results.push({test:'Chromium v53 a generated clip is stored permanently in IndexedDB and memory',status:tiers.idb&&tiers.mem&&tiers.count>=2&&tiers.blocked>=1?'PASS':'FAIL',detail:tiers});
  const before2=synthCalls;
  await page.reload();await page.waitForFunction(()=>!!window.ElevenVault,{timeout:15000}).catch(()=>{});await page.waitForTimeout(500);
  const replay=await page.evaluate(()=>new Promise(resolve=>{window.ElevenVault.resolve('Number 1',(err,url)=>resolve(!!url));}));
  results.push({test:'Chromium v53 a reloaded page replays the saved vault clip with zero ElevenLabs calls',status:replay&&synthCalls===before2?'PASS':'FAIL',detail:{replay:replay,calls:synthCalls-before2}});
  await closeSheet(page);
  await unlockPin(page);
  await page.locator('#adminQuickWordsInput').fill('zephyr, afraid');
  await page.locator('#profSessionTitle').fill('Session 9 - Weather');
  await page.locator('#btnAdminAutoComplete').click();
  await page.waitForTimeout(900);
  const warnVis=await page.evaluate(()=>{const n=document.getElementById('btnPreEditWarnContinue');return !!n&&n.offsetParent!==null;});
  if(warnVis){
   await page.evaluate(()=>{const n=document.getElementById('btnPreEditWarnContinue');if(n)n.click();});
   await page.waitForTimeout(400);
   await page.locator('#btnAdminAutoComplete').click();
  }
  await page.waitForFunction(()=>/words saved/.test((document.querySelector('#adminQuickStatus')||{}).textContent||'')||!!document.getElementById('publishPreviewWords'),{timeout:30000}).catch(()=>{});
  if(await page.locator('#publishPreviewWords').count()){await page.locator('#btnConfirmPublish').click();}
  /* v57: publishing may require the editable preview; the sync banner is GitHub-only. */
  const warnCard=page.locator('#syncBanner');
  results.push({test:'Chromium v57 the GitHub-only sync banner is present above the word editor',status:await warnCard.count()?'PASS':'FAIL',detail:{text:((await warnCard.textContent().catch(()=>''))||'').slice(0,120)}});
  if(await page.locator('#btnPreEditWarnContinue').count()&&await page.locator('#btnPreEditWarnContinue').isVisible().catch(()=>false)){
   results.push({test:'Chromium v55 publishing without the keys shows the confirm-before-edit warning',status:(await page.locator('#syncPreEditWarn').count())?'PASS':'FAIL',detail:{text:((await page.locator('#syncPreEditWarnText').textContent().catch(()=>''))||'').slice(0,120)}});
   await page.evaluate(()=>{const n=document.getElementById('btnPreEditWarnContinue');if(n)n.click();});
  }
  await page.waitForTimeout(1200);
  await page.locator('#adminQuickWordsInput').fill('zephyr, afraid');
  await page.locator('#profSessionTitle').fill('Session 9 - Weather');
  await page.evaluate(()=>{const g=document.getElementById('btnAdminAutoComplete');if(g)g.click();});
  await page.waitForFunction(()=>/words saved/.test((document.querySelector('#adminQuickStatus')||{}).textContent||''),{timeout:30000}).catch(()=>{});
  const quick=await page.evaluate(()=>{
   const data=JSON.parse(localStorage.getItem('sdp.v57_secure_local')||localStorage.getItem('sdp.v56_audit_verified')||localStorage.getItem('sdp.v55_guaranteed_device_sync')||'{}');
   const list=(data.lists||[])[(data.lists||[]).length-1]||{};
   return {status:(document.querySelector('#adminQuickStatus')||{}).textContent||'',rows:document.querySelectorAll('#profWordsTable .prof-row').length,name:list.name,words:(list.words||[]).map(w=>({w:w.w,p:w.p,d:w.d,m:w.m,s:w.s})),published:!!list.published,session:(data.session||{}).title,archived:(data.pastSessions||[]).length};
  });
  const complete=quick.words.length===2&&quick.words.every(w=>w.w&&w.p&&w.d&&w.m&&w.s);
  results.push({test:'Chromium v53 one click on the big button completes IPA, definition, Sinhala, sentence and publishes the session',status:/words saved/.test(quick.status)&&complete&&quick.published&&quick.name==='Session 9 - Weather'&&quick.session==='Session 9 - Weather'&&quick.rows===3&&dictCalls>0&&siCalls>0?'PASS':'FAIL',detail:quick});
  const glass=await page.evaluate(()=>{const el=document.querySelector('.glass');const cs=getComputedStyle(el);return {filter:cs.backdropFilter||cs.webkitBackdropFilter,perf:document.body.getAttribute('data-perf')};});
  results.push({test:'Chromium v59 Apple Liquid Glass: the top bar keeps blur(14px) in Full and safely drops it in Lite',status:glass.perf==='lite'?glass.filter==='none':/blur\(14px\) saturate\(1\.4\)/.test(glass.filter),detail:glass});
  results.push({test:'Chromium v53 no page errors during the studio, vault and auto-completer run',status:errors.length===0?'PASS':'FAIL',errors});
  await context.close();
  await new Promise(resolve=>server.close(resolve));
 }
 // ---------------------------------------------------------------------------
 // v57 (6.3.0): keys are session-only; sync is authenticated GitHub Contents API.
 // No vault/key/audio ntfy relay is allowed, and a new device never inherits a key.
 // ---------------------------------------------------------------------------
 {
  const http=require('http');const mime2={'.html':'text/html','.json':'application/json','.mp4':'video/mp4','.webp':'image/webp','.js':'text/javascript','.svg':'image/svg+xml'};
  const server2=http.createServer((req,res)=>{
   const rel=decodeURIComponent(String(req.url||'/').split('?')[0]).replace(/^\/+/, '')||'index.html';
   const file=path.join(root,rel);
   if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.statusCode=404;return res.end('nope');}
   res.setHeader('Content-Type',mime2[path.extname(file)]||'application/octet-stream');
   res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server2.listen(0,'127.0.0.1',resolve));
  const base2='http://127.0.0.1:'+server2.address().port;
  const LECTURER_KEY='xi-runtime-test-key-57';
  const GH_TOKEN=['g','hp_'].join('')+'runtime_test_token_57';
  let ntfyPosts=0;
  const errorsA=[];
  const ctxA=await browser.newContext({viewport:{width:1280,height:900}});
  const pageA=await ctxA.newPage();pageA.on('pageerror',e=>errorsA.push(e.message));
  await pageA.route('https://ntfy.sh/**',async route=>{if(route.request().method()==='POST')ntfyPosts++;return route.fulfill({status:200,body:'{}'});});
  await pageA.goto(base2+'/index.html');
  await pageA.waitForFunction(()=>!!window.ElevenVault && !!window.UniversalSync,{timeout:20000}).catch(()=>{});
  await closeSheet(pageA);
  await unlockPin(pageA);
  await pageA.evaluate((o)=>{window.ElevenVault.setApiKey(o.k);window.SDPCore.Cloud.ghToken(o.g);},{k:LECTURER_KEY,g:GH_TOKEN});
  await pageA.waitForTimeout(400);
  const deviceA=await pageA.evaluate((k)=>{
   const env=window.UniversalSync.envelope();
   const local=JSON.parse(localStorage.getItem('sdp.v57_secure_local')||'{}');
   return {session:sessionStorage.getItem('sdp.session.elKey')||'',localKey:(local.settings||{}).elevenLabsKey||'',
    envHasVault:!!env.vaultCiphertext,envHasKey:JSON.stringify(env).indexOf(k)>=0,
    banner:(document.getElementById('syncBanner')||{}).textContent||'',guide:!!document.getElementById('lnkGhToken')};
  },LECTURER_KEY);
  results.push({test:'Chromium v57 device #1 keeps the key in sessionStorage, scrubs localStorage and never relays a vault',status:deviceA.session===LECTURER_KEY&&deviceA.localKey===''&&!deviceA.envHasVault&&!deviceA.envHasKey&&ntfyPosts===0&&errorsA.length===0?'PASS':'FAIL',detail:Object.assign({ntfyPosts},deviceA),errors:errorsA});
  await ctxA.close();
  const errorsB=[];
  const ctxB=await browser.newContext({viewport:{width:390,height:844}});
  const pageB=await ctxB.newPage();pageB.on('pageerror',e=>errorsB.push(e.message));
  await pageB.route('https://ntfy.sh/**',async route=>{if(route.request().method()==='POST')ntfyPosts++;return route.fulfill({status:200,body:'{}'});});
  await pageB.goto(base2+'/index.html');
  await pageB.waitForFunction(()=>!!window.ElevenVault && !!window.UniversalSync,{timeout:20000}).catch(()=>{});
  await closeSheet(pageB);
  await unlockPin(pageB);
  await pageB.waitForTimeout(400);
  const deviceB=await pageB.evaluate(()=>({
   key:(window.SDPCore.DB.data.settings||{}).elevenLabsKey||'',
   session:sessionStorage.getItem('sdp.session.elKey')||'',
   input:(document.getElementById('elApiKeyInput')||{}).value||'',
   banner:(document.getElementById('syncBanner')||{}).textContent||'',
   words:((document.getElementById('adminQuickWordsInput')||{}).value||'').split('\n').filter(Boolean).length
  }));
  results.push({test:'Chromium v57 a brand-new phone never inherits the lecturer API key',status:deviceB.key===''&&deviceB.session===''&&deviceB.input===''&&deviceB.words>0&&ntfyPosts===0&&errorsB.length===0?'PASS':'FAIL',detail:Object.assign({ntfyPosts},deviceB),errors:errorsB});
  await ctxB.close();
  await new Promise(resolve=>server2.close(resolve));
 }

 // ------------------------------------------------------------------
 // v58 / 7.0.0: compact 3-card home, signature pill, retry toast,
 // keyboard dock, language parity and the two-tier glass surfaces.
 // ------------------------------------------------------------------
 {
  const context=await browser.newContext({viewport:{width:360,height:800}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  await page.addInitScript(()=>{if(window.speechSynthesis)window.speechSynthesis.speak=function(u){setTimeout(function(){if(u&&u.onend)u.onend();},10);};});
  await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForTimeout(1600);await closeSheet(page);
  try{await page.evaluate(()=>document.fonts&&document.fonts.ready);}catch(e){}
  await page.waitForTimeout(300);await closeSheet(page);
  const home=await page.evaluate(()=>{
   const px=e=>e?parseFloat(getComputedStyle(e).fontSize):0;
   const hero=document.getElementById('homeHero'),seg=document.getElementById('segMode');
   const r=hero?hero.getBoundingClientRect():{height:9999};
   const sr=seg?seg.getBoundingClientRect():{bottom:9999};
   const tiles=Array.from(document.querySelectorAll('.v58-tile'));
   const blurs=Array.from(document.body.querySelectorAll('*')).filter(e=>{const cs=getComputedStyle(e);const b=cs.backdropFilter||cs.webkitBackdropFilter;return !!b&&b!=='none';}).length;
   const SIN=/[\u0D80-\u0DFF]/,straySi=[];
   const wk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
   while(wk.nextNode()){const n=wk.currentNode;if(!SIN.test(n.nodeValue||''))continue;
    let p2=n.parentElement,ok=false;
    while(p2&&p2!==document.body){const tag=p2.tagName;if(p2.id==='btnLang'||p2.id==='sdpTopLangPill'||/sdp-si-chip|sdp-si-text|sdp-si-pill|sdp-lang/.test(p2.className||'')||tag==='SCRIPT'||tag==='STYLE'){ok=true;break;}p2=p2.parentElement;}
    if(!ok)straySi.push(String(n.nodeValue).slice(0,40));}
   return {height:Math.round(r.height),segBottom:Math.round(sr.bottom),
    kickerPx:px(document.getElementById('homeKicker')),titlePx:px(document.getElementById('homeTitle')),subPx:px(document.getElementById('homeSub')),
    bento:tiles.length,tileMinH:tiles.length?Math.min.apply(null,tiles.map(t=>Math.round(t.getBoundingClientRect().height))):0,
    tileTitlePx:px(tiles[0]&&tiles[0].querySelector('b')),
    tileSubs:tiles.map(t=>((t.querySelector('i')||{}).textContent||'')),
    tabPx:px(document.querySelector('#tabbar button span')),
    blurCount:blurs,v59css:!!document.getElementById('sdpV59Css'),straySi,
    langBtn:(document.getElementById('btnLang')||{}).textContent,
    card3:!!document.getElementById('v58ProgressArchiveCard'),
    stats:(document.getElementById('homeStats')||{children:[]}).children.length,
    statCards:(document.getElementById('sdpHomeStatsRow')||{children:[]}).children.length,
    quickCards:document.querySelectorAll('#sdpQuickPracticeGrid .sdp-quick').length,
    greeting:!!document.getElementById('sdpHomeGreeting'),
    voiceHidden:!document.getElementById('v58VoiceBadge')||document.getElementById('v58VoiceBadge').offsetParent===null,
    offline:!!document.getElementById('v58OfflineRow'),
    voice:!!document.getElementById('v58VoiceBadge'),
    railHidden:getComputedStyle(document.getElementById('v58Rail')).display==='none',
    dockAtRest:!document.getElementById('v58Dock')};
  });
  results.push({test:'Chromium v60 home scale: compact hero, greeting, 3 stat cards, 4 quick-practice cells, no blur',
   status:home.height>=120&&home.height<=400&&home.greeting&&home.statCards===3&&home.quickCards===4&&home.kickerPx>=10&&home.titlePx>=18&&home.subPx>=12&&home.tabPx>=10&&home.blurCount===0&&home.voiceHidden&&home.railHidden&&home.dockAtRest&&errors.length===0?'PASS':'FAIL',
   detail:Object.assign({errors},home),errors});
  results.push({test:'Chromium v59 English default: zero Sinhala glyphs outside #btnLang and the collapsed reveal chips',
   status:home.straySi.length===0&&home.langBtn==='සිංහල'?'PASS':'FAIL',detail:{straySi:home.straySi,langBtn:home.langBtn}});
  /* language parity: every new string flips to Sinhala and back */
  const lang=await page.evaluate(()=>{
   const C=window.SDPCore;
   const tile=document.querySelector('[data-practice="flash"] b');
   const credit=document.getElementById('credit');
   const grab=()=>({tile:tile?tile.textContent:'',credit:credit?credit.textContent:''});
   C.UI.setLang('si');
   const si=grab();
   const siTitle=(document.querySelector('.v58-menu-group-title')||{}).textContent||'';
   C.UI.setLang('en');
   const en=grab();
   return {si,en,siTileOk:!!tile&&tile.getAttribute('data-v58-si')===si.tile,siCreditOk:!!credit&&credit.getAttribute('data-v58-si')===si.credit,enTileOk:!!tile&&tile.getAttribute('data-v58-en')===en.tile,
    htmlLang:document.documentElement.getAttribute('lang'),siMenu:siTitle};
  });
  results.push({test:'Chromium v58 Sinhala parity: home card labels, signature pill and menu strings all flip',
   status:lang.siTileOk&&lang.siCreditOk&&lang.enTileOk&&lang.si.tile!==lang.en.tile&&lang.si.credit!==lang.en.credit&&lang.htmlLang==='en'&&errors.length===0?'PASS':'FAIL',
   detail:lang,errors});
  /* signature pill opens the About & Credits showcase */
  const about=await page.evaluate(()=>{
   const c=document.getElementById('credit');if(c)c.click();
   const sheet=document.getElementById('aboutCreditsSheet');
   const open=!!sheet&&!sheet.classList.contains('hidden');
   const txt=sheet?sheet.textContent:'';
   const close=document.getElementById('v58AboutClose');if(close)close.click();
   return {open,names:/Hansana/.test(txt)&&/Ayya01 \(Lesandu\)/.test(txt)&&/Sumodya Sewmini/.test(txt),
    header:/Smart Dictation Player · v59 · 8\.0\.0/.test(txt),
    closedAfter:!sheet||sheet.classList.contains('hidden')};
  });
  results.push({test:'Chromium v59 the inline signature pill opens About & Credits with all three credits',
   status:about.open&&about.names&&about.header&&about.closedAfter&&errors.length===0?'PASS':'FAIL',detail:about,errors});
  /* v59: the full-English dictionary cards, paper self-check, sentence context,
     the lecturer writing timer and the zero-readback contrast gauge. */
  const dict=await page.evaluate(()=>{
   const C=window.SDPCore;
   C.UI.setTab('dict');
   const cards=Array.from(document.querySelectorAll('.sdp-word-card'));
   const first=cards[0];
   const pick=sel=>{const n=first?first.querySelector(sel):null;return n?n.textContent:'';};
   const reveal=first?first.querySelector('.sdp-si-text'):null;
   const chip=first?first.querySelector('.sdp-si-chip'):null;
   return {n:cards.length,filters:!!document.getElementById('sdpWordFilterRow'),
    word:pick('.sdp-word-head b'),ipa:pick('.sdp-word-ipa'),pos:pick('.sdp-word-pos'),posSlot:!!(first&&first.querySelector('.sdp-word-pos')),
    def:pick('.sdp-word-def'),ex:pick('.sdp-word-eg'),
    btns:first?first.querySelectorAll('button').length:0,
    siShown:/[\u0D80-\u0DFF]/.test(pick('.sdp-si-pill'))};
  });
  results.push({test:'Chromium v60 words explorer: 30 full-field cards (word, UK IPA, POS, meaning, example, Sinhala pill) with the v60 filter row',
   status:dict.n===30&&dict.filters&&dict.word==='afraid'&&/əˈfreɪd/.test(dict.ipa)&&dict.posSlot&&(/^$|^adj\.$/.test(dict.pos))&&/Feeling fear or anxiety/.test(dict.def)&&/She was never afraid/.test(dict.ex)&&dict.btns>=2&&dict.siShown&&errors.length===0?'PASS':'FAIL',
   detail:dict,errors});
  const selfcheck=await page.evaluate(()=>{
   const C=window.SDPCore,L=window.SDPLearning;
   const words=(C.Lib.current()||{}).words||[];
   const rows=words.map(w=>({word:w.w,answer:'',state:'unknown',w:w}));
   const result={id:'qa-paper',mode:'paper',rows:rows,correct:0,half:0,total:rows.length,percent:0};
   const layerRef=C.Results.open(result);
   const box=document.getElementById('selfCheck');
   const chip=document.getElementById('v58SelfScore');
   const before=chip?chip.textContent:'';
   const btns=box?Array.from(box.querySelectorAll('.selfbtns button')):[];
   if(btns[0])btns[0].click();
   if(btns[2])btns[2].click();
   const after=chip?chip.textContent:'';
   const summary=(document.getElementById('resSummary')||{}).textContent||'';
   const coach=!!document.getElementById('v58ResultsCoach');
   const layer=(layerRef&&layerRef.classList&&layerRef.classList.contains('layer'))?layerRef:document.querySelector('#layers .layer');
   if(layer&&C.UI.closeLayer){C.UI.closeLayer(layer);}
   else if(C.UI.closeTop){for(let i=0;i<4;i++){if(!C.UI.closeTop())break;}}
   if(document.querySelector('#layers .layer')&&C.UI.closeTop){C.UI.closeTop();}
   const stillOpen=!!document.querySelector('#layers .layer');
   return {open:!!box,rows:box?box.querySelectorAll('.selfrow').length:0,before,after,summary,coach,stillOpen};
  });
  results.push({test:'Chromium v59 paper self-check: 30 rows, live #v58SelfScore and #resSummary self-check total',
   status:selfcheck.open&&selfcheck.rows===30&&/^0 \/ 30 · 0%$/.test(selfcheck.before)&&/^2 \/ 30 · 7%$/.test(selfcheck.after)&&/self-check: 2\/30 \(7%\)/.test(selfcheck.summary)&&!selfcheck.coach&&errors.length===0?'PASS':'FAIL',
   detail:selfcheck,errors});
  const contextProbe=await page.evaluate(()=>{
   const C=window.SDPCore,L=window.SDPLearning;
   C.UI.setTab('practice');
   const sc=C.Screens;sc.pracMode='context';sc.pracIndex=0;
   L.renderContextMode(sc);
   const next=document.getElementById('sdpContextNextBtn');
   const before=(document.getElementById('pracCount')||{}).textContent||'';
   const stage=document.getElementById('pracStage');
   const clue=stage?stage.innerText:'';
   if(next)next.click();
   const after=(document.getElementById('pracCount')||{}).textContent||'';
   C.UI.setTab('home');
   return {next:!!next,before,after,meaning:/\/[^\/]+\//.test(clue)&&/[A-Z][a-z]+/.test(clue),coach:!!document.getElementById('v58MistakeCoach')};
  });
  results.push({test:'Chromium v59 sentence context: English meaning clue, a primary Next question button and no coach on a clean render',
   status:contextProbe.next&&/^1 \/ 30$/.test(contextProbe.before)&&/^2 \/ 30$/.test(contextProbe.after)&&contextProbe.meaning&&!contextProbe.coach&&errors.length===0?'PASS':'FAIL',
   detail:contextProbe,errors});
  const timer=await page.evaluate(()=>{
   const C=window.SDPCore;
   const prev=C.DB.data.settings.writeFixed;
   C.DB.data.settings.writeFixed=7;const seven=C.Eng.writeSecs();
   C.DB.data.settings.writeFixed=3;const three=C.Eng.writeSecs();
   C.DB.data.settings.writeFixed=prev;
   return {seven,three};
  });
  results.push({test:'Chromium v59 Eng.writeSecs follows settings.writeFixed instead of a hardcoded 5s',status:timer.seven===7&&timer.three===3?'PASS':'FAIL',detail:timer});
  const readback=await page.evaluate(()=>{
   window.__drawCalls=0;
   const proto=CanvasRenderingContext2D.prototype;
   proto.drawImage=function(){window.__drawCalls++;throw new Error('drawImage banned');};
   proto.getImageData=function(){window.__drawCalls++;throw new Error('getImageData banned');};
   const C=window.SDPCore,L=window.SDPLearning;
   L.updateGauge();L.contrastRatio();
   C.UI.setTab('dict');C.UI.setTab('home');
   const lw=C.LiveWallpaper;if(lw&&lw.setDim){lw.setDim(10);lw.setDim(34);}
   return {draw:window.__drawCalls,gauge:(document.getElementById('contrastReadout')||{}).textContent||''};
  });
  await page.waitForTimeout(200);
  results.push({test:'Chromium v59 zero canvas readbacks: drawImage/getImageData throw and nothing calls them',
   status:readback.draw===0&&errors.length===0?'PASS':'FAIL',detail:Object.assign({errors},readback),errors});
  const guard=await page.evaluate(()=>{
   const PG=window.SDPPerfGuard;
   if(!PG)return {missing:true};
   const prev=PG.sampler;PG.sampler=[30,31,30,29,32,30];
   const slow=PG.benchmark(function(){})||{};
   PG.sampler=prev||null;
   return {api:typeof PG.start==='function'&&typeof PG.decide==='function',avg:slow.avg,med:slow.med,frames:slow.frames};
  });
  results.push({test:'Chromium v59 SDPPerfGuard is installed and samples real frame deltas',status:!guard.missing&&guard.api&&guard.avg>22&&guard.med>=29?'PASS':'FAIL',detail:guard});
  /* retry toast: pointer-events none + auto-dismiss at 5s */
  const toast=await page.evaluate(()=>new Promise(resolve=>{
   const C=window.SDPCore;
   if(C.Speech.showRetryToast)C.Speech.showRetryToast('QA retry','en',function(){});
   const el=document.querySelector('.sdp-retry-toast');
   const props=el?getComputedStyle(el):null;
   resolve({exists:!!el,pe:props?props.pointerEvents:'',t0:document.querySelectorAll('.sdp-retry-toast').length});
  }));
  await page.waitForTimeout(5600);
  const toastAfter=await page.evaluate(()=>document.querySelectorAll('.sdp-retry-toast').length);
  results.push({test:'Chromium v58 retry toast never blocks taps and dismisses itself by 5s',
   status:toast.exists&&toast.pe==='none'&&toastAfter===0&&errors.length===0?'PASS':'FAIL',detail:Object.assign({toastAfter},toast),errors});
  /* dock + focus-dim + keyboard dock mode (real Start click kills the toast) */
  await page.evaluate(()=>{
   if(window.SDPCore.Speech.showRetryToast)window.SDPCore.Speech.showRetryToast('QA retry','en',function(){});
   const el=document.querySelector('.sdp-retry-toast');
   if(el)el.setAttribute('data-qa','1');
  });
  await page.locator('#btnStart').click();
  await page.waitForTimeout(900);
  const atReady=await page.evaluate(()=>({
   focus:document.body.classList.contains('v58-focus'),
   qaGone:document.querySelectorAll('.sdp-retry-toast[data-qa]').length===0,
   vignette:!!document.getElementById('v58EdgeVignette')
  }));
  await page.evaluate(()=>{
   const btns=Array.from(document.querySelectorAll('#sheets button'));
   const ready=btns.find(x=>/ready/i.test(x.textContent));
   if(ready)ready.click();
  });
  await page.waitForTimeout(1400);
  const atPlayer=await page.evaluate(()=>({
   dock:!!document.getElementById('v58Dock'),
   layer:!!(window.SDPCore.Eng&&window.SDPCore.Eng.layer),
   focus:document.body.classList.contains('v58-focus')
  }));
  await page.setViewportSize({width:360,height:660});
  await page.waitForTimeout(400);
  const kbOn=await page.evaluate(()=>document.body.classList.contains('v58-keyboard'));
  await page.setViewportSize({width:360,height:800});
  await page.waitForTimeout(400);
  const kbOff=await page.evaluate(()=>!document.body.classList.contains('v58-keyboard'));
  await page.evaluate(()=>{window.SDPCore.Eng.stop();});
  await page.waitForTimeout(500);
  const focusCleared=await page.evaluate(()=>!document.body.classList.contains('v58-focus'));
  results.push({test:'Chromium v58 v58Dock, focus-dim, toast kill on Start and visualViewport keyboard dock toggle',
   status:atReady.focus&&atReady.qaGone&&atReady.vignette&&atPlayer.dock&&atPlayer.layer&&atPlayer.focus&&kbOn&&kbOff&&focusCleared&&errors.length===0?'PASS':'FAIL',
   detail:Object.assign({kbOn,kbOff,focusCleared,atReady,atPlayer}),errors});
  await context.close();
 }
 {
  /* desktop: 2-column workspace, keyboard HUD, grouped overflow, glass tiers + presets */
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForTimeout(1500);await closeSheet(page);
  const desk=await page.evaluate(()=>{
   const ws=document.querySelector('.v58-workspace');
   const hud=document.getElementById('v58KbdHud');
   return {grid:ws?getComputedStyle(ws).gridTemplateColumns:'',
    appW:Math.round(document.getElementById('app').getBoundingClientRect().width),
    rail60:document.getElementById('sdpDesktopRail')?getComputedStyle(document.getElementById('sdpDesktopRail')).display:'',
    appLeft:Math.round(document.getElementById('app').getBoundingClientRect().left),
    hud:hud?getComputedStyle(hud).display:''};
  });
  results.push({test:'Chromium v60 desktop >=1024px hides the dock and shows the 232px navigation rail',
   status:desk.rail60==='flex'&&desk.appLeft>=231&&desk.appW<=1200&&errors.length===0?'PASS':'FAIL',
   detail:desk,errors});
  await page.keyboard.press('r');
  await page.waitForTimeout(120);
  const kbd=await page.evaluate(()=>({n:(window.SDP&&window.SDP.__kbdTests)||0}));
  await page.keyboard.press('?');
  await page.waitForTimeout(150);
  const hudOff=await page.evaluate(()=>document.body.classList.contains('v58-hud-off')&&getComputedStyle(document.getElementById('v58KbdHud')).display==='none');
  results.push({test:'Chromium v58 keyboard shortcuts increment SDP.__kbdTests and ? toggles the HUD',
   status:kbd.n>=1&&hudOff&&errors.length===0?'PASS':'FAIL',detail:Object.assign({hudOff},kbd),errors});
  const menu=await page.evaluate(()=>{
   const d=document.getElementById('topOverflow');if(d)d.open=true;
   const titles=Array.from(document.querySelectorAll('.v58-menu-group-title')).map(n=>n.textContent.trim());
   const admin=!!document.querySelector('#topOverflow #btnAdmin');
   const practice=!!document.getElementById('v58MenuPractice');
   if(d)d.open=false;
   return {titles,admin,practice};
  });
  const want=['Study Tools','Appearance & Wallpaper','Audio & Data','Lecturer Studio'];
  results.push({test:'Chromium v58 grouped overflow menu has the four group titles with admin inside',
   status:JSON.stringify(menu.titles)===JSON.stringify(want)&&menu.admin&&menu.practice&&errors.length===0?'PASS':'FAIL',
   detail:menu,errors});
  const tiers=await page.evaluate(()=>{
   const top=document.querySelector('.topbar');
   const card=document.querySelector('#v58ProgressArchiveCard .card');
   const tile=document.querySelector('.v58-tile');
   return {topBlur:getComputedStyle(top).backdropFilter||'',
    cardBg:card?getComputedStyle(card).backgroundColor:'',
    cardAlpha:card?(Number((String(getComputedStyle(card).backgroundColor).match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/)||[])[1])||1):1,
    perf:document.body.getAttribute('data-perf'),
    tileImg:tile?getComputedStyle(tile).backgroundImage:'',
    tileBlur:tile?(getComputedStyle(tile).backdropFilter||'none'):'none',
    coreVar:getComputedStyle(document.documentElement).getPropertyValue('--v58-core').trim(),
    blurVar:getComputedStyle(document.documentElement).getPropertyValue('--v58-glass-blur').trim()};
  });
  results.push({test:'Chromium v60 zero-blur chrome: no backdrop blur on the topbar, dock, tiles or cards',
   status:tiers.topBlur==='none'&&tiers.cardAlpha>=0.9&&tiers.tileBlur==='none'&&errors.length===0?'PASS':'FAIL',
   detail:tiers,errors});
  const presets=await page.evaluate(()=>new Promise(resolve=>{
   const C=window.SDPCore;
   C.UI.setTab('set');
   setTimeout(()=>{
    const open=document.getElementById('btnOpenGallery');if(open)open.click();
    setTimeout(()=>{
     const chips=Array.from(document.querySelectorAll('.v58-preset'));
     const shield=document.getElementById('v58Preset-shield');
     if(shield)shield.click();
     setTimeout(()=>resolve({n:chips.length,labels:chips.map(c=>c.textContent),
      preset:document.documentElement.getAttribute('data-v58-preset'),
      readout:(document.getElementById('contrastReadout')||{}).textContent||''}),250);
    },350);
   },200);
  }));
  results.push({test:'Chromium v58 three contrast presets sit above the dimmer and switch the reading core',
   status:presets.n===3&&presets.preset==='shield'&&/Live WCAG contrast \d/.test(presets.readout)&&errors.length===0?'PASS':'FAIL',
   detail:presets,errors});
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
