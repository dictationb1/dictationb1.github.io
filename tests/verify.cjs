'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert');
const acorn=require('acorn');
const {root,html,scripts}=require('./upgrade-harness.cjs');
for(const [name,source] of Object.entries(scripts())) {
 const r=cp.spawnSync(process.execPath,['--check'],{input:source,encoding:'utf8'});
 assert.equal(r.status,0,name+' node --check failed');
 acorn.parse(source,{ecmaVersion:2017});
 console.log('PASS '+name+': node --check and ES2017 parse');
}
assert(Buffer.byteLength(html)<=450000);
assert(!/\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval)\b|new\s+Function\s*\(/.test(html));
assert(html.includes('key: "sdp.v1"'));
console.log('PASS app size: '+Buffer.byteLength(html)+' bytes; sdp.v1 unchanged; no HTML-string injection or eval');
// Read the historical value only in memory. Never print it or put it in a fixture.
const base=cp.execFileSync('git',['show','427bedd6cde077007fbc6792863544095bebc2c8:index.html'],{cwd:root,maxBuffer:1000000}).toString();
const old=base.match(/pinHash = Sha.hex\("sdp.v1:" \+ salt \+ ":(\d+)"/)[1];
const files=cp.execFileSync('git',['ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
let checked=0;
for(const name of files) {
 const bytes=fs.readFileSync(path.join(root,name));
 if(bytes.includes(0))continue;
 assert(!bytes.toString().includes(old),'historical credential remains in '+name);
 assert(!/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/.test(bytes.toString()),'possible token in '+name);
 checked++;
}
console.log('PASS old seed value and GitHub token pattern scan: '+checked+' tracked text files; values not printed');
console.log('Scope: this is a narrow static scan, not a server-security or external-host audit.');
