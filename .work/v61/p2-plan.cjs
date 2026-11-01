'use strict';
var fs=require('fs'),acorn=require('./node-acorn.cjs'),h=fs.readFileSync('index.html','utf8'),off=h.indexOf('<script>')+8,src=h.slice(off,h.indexOf('</script>',off)),ast=acorn.parse(src,{ecmaVersion:5}),root=ast.body[0].expression.argument.callee.body.body;
function list(title,arr){console.log('\n'+title);arr.forEach(function(n,i){console.log(i,n.type,n.start,n.end,src.slice(n.start,n.start+160).replace(/\n/g,' '));});}
var seq=root[33].expression.expressions;list('final sequence',seq);
seq.forEach(function(n,i){if(n.type==='CallExpression'&&n.callee.type==='FunctionExpression'&&src.slice(n.start,n.end).indexOf('sdpV57Css')>=0)list('runtime '+i,n.callee.body.body);});
var n=root[29].expression.argument.callee.body.body;list('visual patch',n.slice(0,80));
