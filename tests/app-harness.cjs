const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const FakeTimers=require('@sinonjs/fake-timers');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
function harness(seed,opts={}){
 const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 const w=dom.window;
 const clock=FakeTimers.withGlobal(w).install({now:Date.UTC(2026,9,14,12),toFake:['Date','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame']});
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLCanvasElement.prototype.getContext=()=>opts.canvasContext||null;
 if(opts.canvasContext)Object.defineProperty(w.performance,'now',{value:function(){return w.Date.now();}});
 if(seed)w.localStorage.setItem('sdp.v1',JSON.stringify(seed));
 if(opts.crypto)Object.defineProperty(w,'crypto',{value:require('node:crypto').webcrypto});
 const script=Array.from(w.document.scripts).find(s=>!s.type&&s.textContent.includes('var APP_VERSION')).textContent.replace('window.SDP = {','window.__qa = {LiveWallpaper:LiveWallpaper,isAssetsMedia:isAssetsMedia,ASSET_MEDIA_RE:ASSET_MEDIA_RE,Errors:typeof Errors==="undefined"?null:Errors,Admin:Admin,DB:DB,Speech:Speech,UI:UI,Eng:Eng,Lib:Lib,NoVoice:NoVoice,defaultData:defaultData,Results:Results,Cloud:Cloud,Dict:Dict,DictAPI:DictAPI,Store:Store,CONFIG:CONFIG,ukMp3:ukMp3,SAMPLE_WORDS:SAMPLE_WORDS,IPA:typeof IPA==="undefined"?null:IPA,SAMPLE_LIST_ID:typeof SAMPLE_LIST_ID==="undefined"?null:SAMPLE_LIST_ID,U:U,Screens:Screens,WORD_BANK:WORD_BANK,publishCompletion:publishCompletion,wordRow:wordRow,T:T,STRINGS_EN:STRINGS_EN,STRINGS_SI:STRINGS_SI,GUIDE:GUIDE,welcomeGuide:welcomeGuide,firstRunTour:firstRunTour}; window.SDP = {');
 vm.runInContext(script,dom.getInternalVMContext());w.document.dispatchEvent(new w.Event('DOMContentLoaded'));clock.tick(100);w.__qa.DB.data.tourSeen=true;
 return {w,q:w.__qa,clock,close(){clock.uninstall();dom.window.close();}};
}
module.exports={harness,html};
