const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const FakeTimers=require('@sinonjs/fake-timers');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
function harness(seed,opts={}){
 const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 const w=dom.window;
 const clock=FakeTimers.withGlobal(w).install({now:Date.UTC(2026,9,14,12),toFake:['Date','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame']});
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLCanvasElement.prototype.getContext=()=>null;
 if(seed)w.localStorage.setItem('sdp.v1',JSON.stringify(seed));
 if(opts.crypto)Object.defineProperty(w,'crypto',{value:require('node:crypto').webcrypto});
 const script=Array.from(w.document.scripts).find(s=>!s.type&&s.textContent.includes('var APP_VERSION')).textContent.replace('window.SDP = {','window.__qa = {Admin:Admin,DB:DB,Speech:Speech,UI:UI,Eng:Eng,Lib:Lib,NoVoice:NoVoice,defaultData:defaultData}; window.SDP = {');
 vm.runInContext(script,dom.getInternalVMContext());w.document.dispatchEvent(new w.Event('DOMContentLoaded'));clock.tick(100);w.__qa.DB.data.tourSeen=true;
 return {w,q:w.__qa,clock,close(){clock.uninstall();dom.window.close();}};
}
module.exports={harness,html};
