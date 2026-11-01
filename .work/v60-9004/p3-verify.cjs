var fs=require('fs'),assert=require('assert'),h=require('../../tests/app-harness.cjs').harness();
try{
  h.q.Screens.settings(); h.w.eval(fs.readFileSync('data/learning-tools.js','utf8')); h.clock.tick(200);
  h.q.UI.setTab('set'); h.q.Screens.settings(); h.w.SDP_NEXTGEN_SETTINGS_REFRESH();
  ['setBody','rateRange','volRange','repeatsSelect','readSentenceToggle','writeSecsRange','bitrateSelect'].forEach(function(id){assert(h.w.document.getElementById(id),id);});
  assert(h.w.document.querySelector('#sdpAppearanceAccordion #setBody'));
  h.q.UI.setTab('dict');
  assert.equal(h.w.document.querySelectorAll('#dictList .sdp-word-card').length,30);
  h.clock.tick(1600);
  assert.equal(h.w.document.querySelectorAll('#dictList .sdp-word-card').length,30);
  console.log('P3 repeated settings refresh, preserved controls and 30 synchronous/persistent Words cards: PASS');
  console.log('IPA cards='+h.w.document.querySelectorAll('#dictList .v59-ipa').length+'; POS cards='+h.w.document.querySelectorAll('#dictList .v59-pos').length);
}finally{h.close();}
