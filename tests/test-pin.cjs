/* Test-only recovery of a PUBLIC four-digit convenience-lock verifier.
   No default PIN literal or production secret belongs in fixtures/workflows.
   This also demonstrates why a static-page PIN is not access control. */
const {createHash}=require('node:crypto');
const html=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../index.html'),'utf8');
const salt=html.match(/admin\.pinSalt\s*=\s*"([a-f0-9]+)";/)[1];
const hash=html.match(/admin\.pinHash\s*=\s*"([a-f0-9]+)";/)[1];
let value;
for(let n=0;n<10000;n++){
 const candidate=String(n).padStart(4,'0');
 if(createHash('sha256').update('sdp.v1:'+salt+':'+candidate).digest('hex')===hash){value=candidate;break;}
}
if(!value)throw Error('Default four-digit verifier fixture cannot be recovered');
module.exports=value;
