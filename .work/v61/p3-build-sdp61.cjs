'use strict';
var fs=require('fs'),acorn=require('./node-acorn.cjs');
var body=fs.readFileSync('.work/v61/p3-module.js','utf8');
// Lift only the proven, pure spelling/syllable algorithms from the retired module.
var old=fs.readFileSync('.work/v61/learning.baseline.js','utf8'),ast=acorn.parse(old,{ecmaVersion:5}),pieces=[];
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&n.left.object.name==='Learn'&&['levenshteinOps','syllablesOf'].indexOf(n.left.property.name)>=0)pieces.push(old.slice(n.start,n.end+1).split('Learn.').join('L.'));Object.keys(n).forEach(function(k){var v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);});}walk(ast);
body=body.replace('/*PRESERVED_ALGORITHMS*/',pieces.join('\n'));
var out="'use strict';\n/* SDP61: single learning/UI owner. All frames are built synchronously. */\n(function(){\n"+body+"\n}());\n";
out=out.replace(/[^\x00-\x7F]/g,function(c){return '\\u'+('000'+c.charCodeAt(0).toString(16)).slice(-4).toUpperCase();});
acorn.parse(out,{ecmaVersion:5});new Function(out);
if(Buffer.byteLength(out)>120000)throw Error('SDP61 exceeds byte cap: '+Buffer.byteLength(out));
var ot=acorn.parse(out,{ecmaVersion:5}),syncNames={mount:1,home:1,dict:1,settings:1,refresh:1,applyLang:1,wordCard:1,practice:1,renderTool:1};
function scan(n,fn){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)fn=n.id.name;if(n.type==='FunctionExpression')fn='event';if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&/^(setTimeout|setInterval|requestAnimationFrame|MutationObserver)$/.test(n.callee.name)&&syncNames[fn])throw Error('pre-mount timer in '+fn);Object.keys(n).forEach(function(k){var v=n[k];if(Array.isArray(v))v.forEach(function(x){scan(x,fn);});else if(v&&typeof v==='object')scan(v,fn);});}scan(ot,'top');
fs.writeFileSync('data/learning-tools.js',out);console.log('SDP61 generated: '+Buffer.byteLength(out)+' bytes; ES5 and pre-mount timer checks PASS');
