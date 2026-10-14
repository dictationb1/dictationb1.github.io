const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),acorn=require('acorn');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const dir=path.join(__dirname,'artifacts');fs.mkdirSync(dir,{recursive:true});
const file=path.join(dir,'app.js');fs.writeFileSync(file,script);
cp.execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
acorn.parse(script,{ecmaVersion:5});
if(Buffer.byteLength(html)>450000)throw Error('index.html exceeds the 450,000-byte budget');
console.log('node --check: PASS; ES5 syntax: PASS; index.html '+Buffer.byteLength(html)+' / 450000 bytes');
