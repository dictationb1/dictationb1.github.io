var fs = require('fs');
var files = ['data/version.json','data/config.json','data/session.json','data/elevenlabs-audio.json','data/media-manifest.json'];
files.forEach(function(file){
  var d = JSON.parse(fs.readFileSync(file,'utf8'));
  d.ver = 60; d.version = '9.0.0.4'; d.appVersion = '9.0.0.4'; d.schema = 60; d.settingsRev = 60;
  fs.writeFileSync(file, JSON.stringify(d,null,2)+'\n');
  console.log('stamped '+file);
});
fs.copyFileSync('data/version.json','version.json');
console.log('created root version.json from canonical data/version.json');
