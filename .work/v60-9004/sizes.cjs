var fs = require('fs'), assert = require('assert');
var files = ['index.html','data.html','data/index.html','data/learning-tools.js','data/studio.js','sw.js'];
files.forEach(function(file){ console.log(file + ': ' + fs.statSync(file).size + ' bytes'); });
assert(fs.statSync('index.html').size <= Math.min(598000,484800+15000));
assert(fs.statSync('data.html').size <= 60000);
assert(fs.statSync('data/index.html').size <= 60000);
assert(fs.readFileSync('data.html').equals(fs.readFileSync('data/index.html')));
console.log('Size and byte-identity checks PASS');
