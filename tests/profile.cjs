/* Repeatable lab measurement; not a real-device or 4G performance claim. */
const fs=require('node:fs'), path=require('node:path');
const {chromium}=require('playwright-core');
require('./chromium-env.cjs').ensureChromiumLibs();
const packaged=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await packaged.executablePath(),args:packaged.args.filter(a=>!['--single-process','--disable-web-security','--allow-running-insecure-content','--disable-site-isolation-trials'].includes(a))});
 const context=await browser.newContext({viewport:{width:360,height:640}});
 const page=await context.newPage(), cdp=await context.newCDPSession(page);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
 await page.addInitScript(()=>{
   window.__longTasks=[];
   new PerformanceObserver(list=>list.getEntries().forEach(e=>window.__longTasks.push({start:e.startTime,duration:e.duration}))).observe({type:'longtask',buffered:true});
 });
 await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing',transferMode:'ReturnAsStream'});
 await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);
 await page.locator('#homeTitle').waitFor({state:'attached'});
 const homeVisibleMs=await page.evaluate(()=>performance.now());
 await page.waitForTimeout(2500);
 /* The guide has separate Stop Audio and Close controls. Wait for the actual
    delayed first-run guide, then dismiss it before using the app underneath. */
 const closeGuide=page.locator('#guideSheet .shead button[aria-label="Close"]');
 await closeGuide.waitFor({state:'visible',timeout:12000});
 await closeGuide.evaluate(button=>button.click());
 await page.locator('#homeTitle').waitFor({state:'visible'});
 await page.locator('#btnAdmin').click();
 for(const n of require('./test-pin.cjs').split(''))await page.locator('#pinPad [data-k="'+n+'"]').click();
 const go=page.locator('#pinSubmit');
 if(await go.count())await go.click({timeout:1500}).catch(()=>{});
 await page.locator('#adminHost').waitFor({timeout:6000});
 await page.locator('#adminHost').waitFor();
 const words=Array.from({length:200},(_,i)=>'word'+String.fromCharCode(97+(i/26|0))+String.fromCharCode(97+i%26)).join(', ');
 await page.getByLabel('Word list text',{exact:true}).fill(words);
 await page.waitForTimeout(900);
 await page.locator('#adminHost').evaluate(el=>{el.parentElement.scrollTop=400;});
 await page.waitForTimeout(2200);
 const metrics=await page.evaluate(()=>({longTasks:window.__longTasks,mode:document.body.dataset.perf,bytes:document.documentElement.outerHTML.length}));
 metrics.homeVisibleMs=homeVisibleMs;
 const traceDone=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
 await cdp.send('Tracing.end');const {stream}=await traceDone;
 const label=process.env.SDP_PROFILE_LABEL||'after';
 const output=path.join(__dirname,'artifacts');fs.mkdirSync(output,{recursive:true});
 const file=fs.createWriteStream(path.join(output,label+'-trace.json'));
 while(true){const chunk=await cdp.send('IO.read',{handle:stream});file.write(chunk.data);if(chunk.eof)break;}
 file.end();await cdp.send('IO.close',{handle:stream});
 fs.writeFileSync(path.join(output,label+'-profile.json'),JSON.stringify(metrics,null,2));
 console.log(JSON.stringify({label,homeVisibleMs,mode:metrics.mode,longTasks:metrics.longTasks.length,maxLongTaskMs:Math.max(0,...metrics.longTasks.map(x=>x.duration)),trace:'tests/artifacts/'+label+'-trace.json'},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
