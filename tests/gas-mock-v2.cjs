const fs=require('fs'),vm=require('vm'),http=require('http');
function createMock(html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8')){
const source=html.match(/<script type="text\/plain" id="gas-source">([\s\S]*?)<\/script>/)[1];
const tables={},cache={},properties={ADMIN_PIN:process.env.SDP_TEST_PIN || 'test-only-pin'};
let now=Date.UTC(2026,9,13,12);
function sheet(name){if(tables[name])return tables[name];const rows=[];
 const s={getLastRow:()=>rows.length,getLastColumn:()=>Math.max(0,...rows.map(r=>r.length)),setFrozenRows(){},appendRow:r=>rows.push(r.slice()),deleteRow:r=>rows.splice(r-1,1),deleteRows:(r,n)=>rows.splice(r-1,n),getRange(r,c,n=1,m=1){return{getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>(rows[r+i-1]||[])[c+j-1]===undefined?'':rows[r+i-1][c+j-1]));},setValues(values){values.forEach((line,i)=>{if(!rows[r+i-1])rows[r+i-1]=[];line.forEach((v,j)=>rows[r+i-1][c+j-1]=v);});},setValue(v){if(!rows[r-1])rows[r-1]=[];rows[r-1][c-1]=v;}}},_rows:rows};tables[name]=s;return s;}
class DateMock extends Date {constructor(...args){super(...(args.length?args:[now]));} static now(){return now;}}
const context=vm.createContext({Date:DateMock,PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k]})},CacheService:{getScriptCache:()=>({get:k=>cache[k]&&cache[k].until>now?cache[k].value:null,put:(k,v,secs)=>{cache[k]={value:String(v),until:now+secs*1000};}})},SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>tables[n]||null,insertSheet:sheet})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Session:{getScriptTimeZone:()=> 'UTC'},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({text,setMimeType(){return this;}})},Utilities:{getUuid:()=>require('crypto').randomUUID(),formatDate:d=>d.toISOString().slice(0,10),base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url'),computeDigest:(a,s)=>Array.from(require('crypto').createHash('sha256').update(s).digest()),DigestAlgorithm:{SHA_256:'SHA_256'}}});
vm.runInContext(source,context);

function post(body){return context.handlePost({postData:{contents:JSON.stringify(body)}});}
function get(body){return context.handleGet({parameter:body});}
return {context,tables,cache,properties,post,get,advance:ms=>{now+=ms;},setDate:ts=>{now=ts;}};
}
function serve(mock,port=0){return new Promise(resolve=>{const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');let text='';req.on('data',c=>text+=c);req.on('end',()=>{try{const result=req.method==='POST'?mock.post(JSON.parse(text||'{}')):mock.get(Object.fromEntries(new URL(req.url,'http://mock').searchParams));res.end(JSON.stringify(result));}catch(e){res.statusCode=500;res.end(JSON.stringify({ok:false,err:e.message}));}});});server.listen(port,'0.0.0.0',()=>resolve(server));});}
module.exports={createMock,serve};
if(require.main===module)serve(createMock(),Number(process.env.PORT||8787)).then(s=>console.log('Mock web app on '+s.address().port));
