'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright-core');
const executable = require('@sparticuz/chromium');
const randomPin = String(require('crypto').randomInt(100000,999999));
const root = path.resolve(__dirname,'..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/v1.4.0.json')));
const paste = 'hobbies, leisure, barbecue, camping, collection, cruise,\ndancing, drawing, facilities, festival, fiction, gallery,\ngo shopping, guitar, hire, hike, holidays, jogging,\nmagazine, musician, nightlife, painting, party,\nphotograph, picnic, quiz,\nsunbathe, torch';
(async () => {
 const browser=await chromium.launch({executablePath:process.env.SDP_BROWSER_BIN || await executable.executablePath(),headless:true,args:executable.args.filter(a=>!['--single-process','--disable-web-security','--allow-running-insecure-content','--disable-site-isolation-trials'].includes(a))});
 let passed=0;
 try {
  for(const theme of ['light','dark']) for(const width of [320,360,390,430,768]) {
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1});
   try {
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    await page.addInitScript(({fixture,theme,width}) => {
     fixture.tourSeen=true;fixture.settings.theme=theme;fixture.settings.size='xl';fixture.settings.perf=width===360?'lite':'full';
     localStorage.setItem('sdp.v1',JSON.stringify(fixture));
    },{fixture,theme,width});
    await page.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);
    await page.locator('#btnLock').click();
    assert((await page.locator('#sheets').textContent()).includes('Create'));
    for(let step=0;step<2;step++) {
     for(const digit of randomPin) await page.locator('#pinPad [data-k="'+digit+'"]').click();
     await page.locator('#pinSubmit').click();
    }
    await page.locator('#adminHost').waitFor();
    await page.locator(".lecturer").evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished)));
    const boxes=await page.evaluate(() => {
     const b=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right,scroll:e.scrollWidth,client:e.clientWidth};};
     const tabs=Array.from(document.querySelectorAll('.admintabs button')).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height,width:r.width,scroll:e.scrollWidth,client:e.clientWidth,text:e.textContent};});
     return{head:b('.lecturer .lhead'),notice:b('.lecturer .unlockedbar'),tabs:b('.admintabs'),body:b('.lecturer .lbody'),card:b('#adminHost > .card'),buttons:tabs,view:innerWidth};
    });
    assert(boxes.head.bottom<=boxes.notice.y+1,'header overlaps notice');
    assert(boxes.notice.bottom<=boxes.tabs.y+1,'notice overlaps tabs');
    assert(boxes.tabs.bottom<=boxes.card.y+1,'tabs overlap card');
    assert.equal(boxes.buttons.length,4);
    for(let i=0;i<4;i++) {
     const b=boxes.buttons[i];assert(b.height>=43.9,'small tab target: '+b.height);assert(b.x>=0&&b.right<=width,'tab outside screen');
     assert(b.scroll<=b.client+1,'tab text is clipped: '+JSON.stringify(b));assert.equal(b.y,boxes.buttons[0].y,'tabs wrap');
     if(i)assert(boxes.buttons[i-1].right<=b.x+1,'tabs overlap');
    }
    assert(boxes.body.scroll<=boxes.body.client+1,'lecturer body scrolls sideways');
    const textarea=page.getByLabel('Word list text',{exact:true});
    await textarea.fill(paste);
    await page.getByText('28 items read → 28 words · 0 duplicates removed · 0 skipped',{exact:true}).waitFor();
    const details=await textarea.evaluate(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize),autocapitalize:e.getAttribute('autocapitalize'),spellcheck:e.getAttribute('spellcheck')}));
    assert(details.height>=844*0.45-1);assert(details.font>=16);assert.equal(details.autocapitalize,'off');assert.equal(details.spellcheck,'false');
    const headAfter=await page.locator('.lecturer .lhead').boundingBox();assert.equal(Math.round(headAfter.y),Math.round(boxes.head.y));
    if(width===320&&theme==='dark')await page.screenshot({path:path.join(__dirname,'artifacts/phase1-320-dark.png')});
    await textarea.fill('torch, flashlight');
    await page.getByRole('button',{name:'Treat as word, meaning',exact:true}).click();
    assert.equal(await textarea.inputValue(),'torch | | flashlight');
    await page.getByRole('button',{name:'Undo',exact:true}).last().click();
    assert.equal(await textarea.inputValue(),'torch, flashlight');
    await page.getByRole('button',{name:'More',exact:true}).click();
    for(const name of ['Comments','Class stats','Settings & tools']) {
     await page.getByRole('button',{name,exact:true}).click();
     assert((await page.locator('#adminHost').textContent()).length>100);
    }
    await page.getByRole('button',{name:'Lock',exact:true}).click();
    assert.equal(await page.locator('#adminHost').count(),0);
    assert.deepStrictEqual(errors,[]);
    passed++;console.log('PASS Chromium '+width+' px / '+theme+' / XL: four tabs, no header overlap or sideways clipping, paste 28, meaning hint + Undo, More, Lock, zero console errors');
   } finally { await context.close(); }
  }
 } finally { await browser.close(); }
 console.log('Upgrade browser matrix: '+passed+' passed, 0 failed. Chromium only, not iPhone Safari.');
})().catch(e=>{console.error(String(e.stack).split(randomPin).join('[throwaway value]'));process.exitCode=1;});
