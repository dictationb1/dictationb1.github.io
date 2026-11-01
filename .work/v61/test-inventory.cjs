'use strict';
var fs=require('fs');
['browser','upgrade-browser','e2e','phase1','server','live-lab','audit-v42'].forEach(function(f){var s=fs.readFileSync('tests/'+f+'.cjs','utf8');console.log('\n### '+f);var lines=s.split('\n');var out=[];lines.forEach(function(l,i){if(/\b(test|step|check|assert)\s*\(/.test(l)||/9\.0\.0|v60|v59|v58|listen\(|executablePath|PORT|baseUrl|BASE_URL/.test(l)){out.push((i+1)+': '+l.slice(0,240));}});console.log(out.slice(0,150).join('\n'));console.log('total matches='+out.length);});
