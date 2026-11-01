const {chromium}=require('/home/user/dictationb1.github.io/tests/node_modules/playwright-core');
const serverChromium=require('/home/user/dictationb1.github.io/tests/node_modules/@sparticuz/chromium');
require('/home/user/dictationb1.github.io/tests/chromium-env.cjs').ensureChromiumLibs();
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:await serverChromium.executablePath(),args:serverChromium.args.filter(a=>!["--single-process","--disable-web-security","--allow-running-insecure-content","--disable-site-isolation-trials"].includes(a))});
 const page=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///home/user/dictationb1.github.io/index.html');
 await page.waitForTimeout(2500);
 const info=await page.evaluate(()=>new Promise(r=>{
   const C=window.SDPCore; C.Eng.start({});
   setTimeout(()=>{ try{C.Eng.skipReady();}catch(e){}
     setTimeout(()=>{
       const pl=document.getElementById('plPlay');
       const chain=[]; let n=pl;
       while(n&&chain.length<7){chain.push(n.nodeName+'#'+(n.id||'')+'.'+(n.className||'')+'|display:'+getComputedStyle(n).display+'|vis:'+(n.offsetParent!==null)); n=n.parentNode;}
       const btns=Array.from(document.querySelectorAll('#layers button')).map(b=>({id:b.id,cls:String(b.className).slice(0,30),txt:String(b.textContent||'').trim().slice(0,24),vis:b.offsetParent!==null,d:getComputedStyle(b).display}));
       r({plPlay:!!pl, chain, btns, kicker:(document.getElementById('homeKicker')||{}).textContent, errors:[]});
     },1200);
   },600);
 }));
 console.log(JSON.stringify(info,null,1).slice(0,3000));
 console.log("pageErrors", errors.slice(0,5));
 await browser.close();
})();
