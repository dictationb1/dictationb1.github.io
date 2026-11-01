'use strict';
var fs=require('fs'),acorn=require('./node-acorn.cjs');
var src=fs.readFileSync('index.html','utf8'),s=src.indexOf('<script>')+8,e=src.indexOf('</script>',s),js=src.slice(s,e);var ast=acorn.parse(js,{ecmaVersion:5,ranges:true});
function walk(n,fn){if(!n||typeof n!=='object')return;if(n.type)fn(n);for(var k in n){var v=n[k];if(Array.isArray(v))v.forEach(function(x){walk(x,fn);});else if(v&&typeof v==='object')walk(v,fn);}}
var root=ast.body[0].expression; if(root.type==='UnaryExpression')root=root.argument;console.log('script',s,e,'length',js.length,'root',root.type);
var body=root.callee?root.callee.body:root.body;
console.log('top-level expressions:',body.body.length);
body.body.forEach(function(n,i){var text=js.slice(n.start,n.end);console.log(i,n.type,n.start,n.end,text.slice(0,125).replace(/\n/g,' '));});
var ids={},refs={};walk(ast,function(n){if(n.type==='Literal'&&typeof n.value==='string'){var m=/^#([A-Za-z][\w-]*)$/.exec(n.value);if(m)refs[m[1]]=(refs[m[1]]||0)+1;}});
var shell=src.slice(src.indexOf('<body'),s);(shell.match(/\bid="([^"]+)"/g)||[]).forEach(function(x){ids[x.slice(5,-1)]=1;});console.log('Referenced missing IDs:',Object.keys(refs).filter(function(x){return !ids[x];}).join(' '));
console.log('Templates:',(src.match(/<template id="[^"]+"/g)||[]));
console.log('Head:',src.slice(0,src.indexOf('<style')).replace(/\n/g,' ').slice(0,2000));
console.log('Script tail:',src.slice(e).slice(0,200));
fs.writeFileSync('.work/v61/p2-refs.json',JSON.stringify(refs,null,2));
