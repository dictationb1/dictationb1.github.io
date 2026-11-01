var fs = require("fs");
var b = require("./patchlib.cjs").open("tests/browser.cjs", ["results.push", "async function"]);
b.rep("admin-flash-model", "cards.model==='eleven_multilingual_v2'", "cards.model==='eleven_flash_v2_5'", 1);
b.rep("apple-glass-v60",
  "status:glass.perf==='lite'?glass.filter==='none':/blur\\(14px\\) saturate\\(1\\.4\\)/.test(glass.filter)",
  "status:glass.filter==='none'", 1);
b.rep("apple-glass-v60-title",
  "test:'Chromium v59 Apple Liquid Glass: the top bar keeps blur(14px) in Full and safely drops it in Lite'",
  "test:'Chromium v60 flat chrome: the top bar ships zero backdrop blur in every performance mode'", 1);
b.rep("dict-fields",
  "   return {n:cards.length,filters:!!document.getElementById('v59DictFilters'),\n    word:pick('.v59-word'),ipa:pick('.v59-ipa'),pos:pick('.v59-pos'),\n    def:pick('.v59-def'),ex:pick('.v59-ex'),\n    btns:first?first.querySelectorAll('button').length:0,\n    siHidden:reveal?reveal.getBoundingClientRect().height===0:false,\n    chipCollapsed:chip?chip.getAttribute('aria-expanded')==='false'};",
  "   return {n:cards.length,filters:!!document.getElementById('sdpWordFilterRow'),\n    word:pick('.sdp-word-head b'),ipa:pick('.v59-ipa'),pos:pick('.v59-pos'),\n    def:pick('.sdp-word-def'),ex:pick('.sdp-word-eg'),\n    btns:first?first.querySelectorAll('button').length:0,\n    siShown:/\\u0D80/.test(pick('.sdp-si-pill'))};", 1);
b.rep("dict-status",
  "dict.btns>=4&&dict.siHidden&&dict.chipCollapsed&&errors.length===0?'PASS':'FAIL',",
  "dict.btns>=2&&dict.siShown&&errors.length===0?'PASS':'FAIL',", 1);
b.rep("dict-title",
  "test:'Chromium v59 dictionary: 30 full-English cards (word, UK IPA, POS, meaning, example) with collapsed Sinhala reveal'",
  "test:'Chromium v60 words explorer: 30 full-field cards (word, UK IPA, POS, meaning, example, Sinhala pill) with the v60 filter row'", 1);
b.rep("desktop-fields",
  "    rail:document.getElementById('v58Rail')?getComputedStyle(document.getElementById('v58Rail')).display:'',",
  "    rail60:document.getElementById('sdpDesktopRail')?getComputedStyle(document.getElementById('sdpDesktopRail')).display:'',\n    appLeft:Math.round(document.getElementById('app').getBoundingClientRect().left),", 1);
b.rep("desktop-status",
  "status:/336px/.test(desk.grid)&&desk.appW<=1181&&desk.rail==='flex'&&desk.hud==='flex'&&errors.length===0?'PASS':'FAIL',",
  "status:desk.rail60==='flex'&&desk.appLeft>=231&&desk.appW<=1200&&errors.length===0?'PASS':'FAIL',", 1);
b.rep("desktop-title",
  "test:'Chromium v58 desktop >=1024px renders the 2-column workspace with rail and keyboard HUD'",
  "test:'Chromium v60 desktop >=1024px hides the dock and shows the 232px navigation rail'", 1);
b.rep("single-blur-status",
  "status:(tiers.perf==='lite'?tiers.topBlur==='none':/blur\\(14px\\) saturate\\(1\\.4\\)/.test(tiers.topBlur))&&tiers.cardAlpha>=0.9&&tiers.tileBlur==='none'&&/\\.94/.test(tiers.coreVar)&&/blur\\(14px\\)/.test(tiers.blurVar)&&errors.length===0?'PASS':'FAIL',",
  "status:tiers.topBlur==='none'&&tiers.cardAlpha>=0.9&&tiers.tileBlur==='none'&&errors.length===0?'PASS':'FAIL',", 1);
b.rep("single-blur-title",
  "test:'Chromium v59 single-blur chrome: only .topbar/#tabbar blur, every card a flat 92% reading core'",
  "test:'Chromium v60 zero-blur chrome: no backdrop blur on the topbar, dock, tiles or cards'", 1);
b.rep("oneclick-retry",
  "  await page.locator('#btnAdminAutoComplete').click();\n  await page.waitForFunction(()=>/words saved/",
  "  await page.locator('#btnAdminAutoComplete').click();\n  await page.waitForTimeout(900);\n  if(await page.locator('#btnPreEditWarnContinue').count()){\n   await page.locator('#btnPreEditWarnContinue').click();\n   await page.waitForTimeout(300);\n   await page.locator('#btnAdminAutoComplete').click();\n  }\n  await page.waitForFunction(()=>/words saved/", 1);
b.save(80000);
console.log("browser lockstep done");
