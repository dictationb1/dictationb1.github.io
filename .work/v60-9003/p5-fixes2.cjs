/* P5 fixes round 2: live session data in the v60 hero + lockstep legacy-visual tests */
var p = require("./patchlib.cjs").open("data/learning-tools.js", ["window.SDPVersion"]);

/* 1. data-driven kicker / title / sub */
p.rep("hero-session-data",
  "    var hero = $('#homeHero');\n    if (hero) {\n      txt($('#homeKicker', hero), T('kicker'));\n      txt($('#homeTitle', hero), T('title'));\n      txt($('#homeSub', hero), T('sub'));",
  "    var hero = $('#homeHero');\n    if (hero) {\n      var sess = {};\n      try { var dbx = DB(); sess = (dbx && dbx.data && dbx.data.session) || {}; } catch (eSess) {}\n      var sessNo = String(sess.no || '8');\n      var sessDate = '';\n      try {\n        var raw = String(sess.date || '');\n        var mDate = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(raw);\n        sessDate = mDate ? (mDate[3] + '/' + mDate[2] + '/' + mDate[1]) : raw;\n      } catch (eDate) {}\n      var sessBranch = String(sess.branch || 'CCBE Galle Branch');\n      var sessTitle = String(sess.title || '').replace(/^Session\\s*\\d+\\s*[-\\u2013\\u2014]\\s*/i, '');\n      txt($('#homeKicker', hero), '\\u25CF SESSION ' + sessNo + (sessDate ? ' \\u00B7 ' + sessDate : '') + ' \\u00B7 ' + sessBranch.toUpperCase());\n      txt($('#homeTitle', hero), sessTitle || T('title'));\n      var wordTotal = wordList().length || 30;\n      txt($('#homeSub', hero), wordTotal + (V.lang === 'si' ? ' \\u0DC0\\u0DA0\\u0DB1' : ' adjectives') + ' \\u00B7 ' + (V.lang === 'si' ? '\\u0DB6\\u0DCA\\u200D\\u0DBB\\u0DD2\\u0DA7\\u0DCF\\u0DB1\\u0DCA\\u200D\\u0DBA \\u0D89\\u0D82\\u0D9C\\u0DCA\\u200D\\u0DBB\\u0DD3\\u0DC3\\u0DD2' : 'UK English') + ' \\u00B7 \\uD83C\\uDDEC\\uD83C\\uDDE7 Alice studio voice');",
  1);
p.save(260000);

/* 2. tests/browser.cjs - v60 design system replaces the v59 liquid-glass measurement */
var b = require("./patchlib.cjs").open("tests/browser.cjs", ["results.push", "async function"]);
b.rep("v60-glass-ghost",
  "ghost:cs(document.getElementById('btnTheme')),seg:cs(document.getElementById('segMode')),",
  "ghost:cs(document.getElementById('btnHowItWorks')),seg:cs(document.querySelector('#sdpHeroConfigChips .sdp-chip')),",
  1);
b.rep("v60-glass-thumbs",
  "thumb:cs(document.getElementById('tabInd')),segThumb:cs(document.querySelector('.seg .thumb')),",
  "thumb:cs(document.getElementById('sdpTopLangPill')),segThumb:cs(document.getElementById('creditDocked')),",
  1);
b.rep("v60-glass-credit",
  "credit:document.getElementById('credit')?cs(document.getElementById('credit')):null",
  "credit:cs(document.getElementById('creditDocked'))",
  1);
b.regex("v60-glass-assert",
  /   ok=!!\(gradient\(v37\.primary\)[\s\S]*?\(v37\.perf!=='lite'\|\|v37\.hero\.blur==='none'\)&&errors\.length===0;/,
  function () {
    return [
      "   ok=!!(v37.primary&&/rgb\\(56, 189, 248\\)/.test(v37.primary.bg)&&v37.primary.fg==='rgb(6, 37, 48)'&&v37.primary.radius==='12px'&&Number(v37.primary.weight)>=700&&v37.primary.blur==='none')&&",
      "    !!(v37.ghost&&/rgb\\(34, 34, 38\\)/.test(v37.ghost.bg)&&v37.ghost.blur==='none')&&",
      "    !!(v37.seg&&/rgb\\(34, 34, 38\\)/.test(v37.seg.bg)&&v37.seg.blur==='none')&&",
      "    !!(v37.tab&&v37.tab.fg==='rgb(56, 189, 248)')&&",
      "    !!(v37.tabbar&&v37.tabbar.radius==='20px'&&v37.tabbar.blur==='none'&&/rgb\\(18, 18, 21\\)/.test(v37.tabbar.bg))&&",
      "    !!(v37.thumb&&v37.thumb.blur==='none')&&",
      "    !!(v37.segThumb&&v37.segThumb.pos==='fixed')&&",
      "    !!(v37.hero&&v37.hero.radius==='16px'&&v37.hero.blur==='none'&&/rgb\\(24, 24, 27\\)/.test(v37.hero.bg))&&",
      "    !!(v37.title&&v37.title.img==='none'&&v37.title.fg==='rgb(250, 250, 250)')&&",
      "    !!(v37.video&&v37.video.blur==='none')&&errors.length===0;"
    ].join("\n");
  }, 1);
b.rep("v60-glass-title",
  "test:'Chromium v59 liquid glass: gradients, specular shadows, rounded controls, readable text and blur only on the chrome'",
  "test:'Chromium v60 design system: solid Sky-400 CTA, Zinc cards, 20px dock, zero backdrop blur'",
  1);
b.save(80000);

/* 3. tests/browser.cjs - v60 home scale instead of the retired v58 bento metrics */
var b2 = require("./patchlib.cjs").open("tests/browser.cjs", ["results.push", "async function"]);
b2.rep("v60-home-extra-fields",
  "stats:(document.getElementById('homeStats')||{children:[]}).children.length,",
  "stats:(document.getElementById('homeStats')||{children:[]}).children.length,\n    statCards:(document.getElementById('sdpHomeStatsRow')||{children:[]}).children.length,\n    quickCards:document.querySelectorAll('#sdpQuickPracticeGrid .sdp-quick').length,\n    greeting:!!document.getElementById('sdpHomeGreeting'),\n    voiceHidden:!document.getElementById('v58VoiceBadge')||document.getElementById('v58VoiceBadge').offsetParent===null,",
  1);
b2.regex("v60-home-status",
  /   status:home\.height>=460&&home\.height<=1050[\s\S]*?errors\.length===0\?'PASS':'FAIL',/,
  function () {
    return "   status:home.height>=120&&home.height<=400&&home.greeting&&home.statCards===3&&home.quickCards===4&&home.kickerPx>=10&&home.titlePx>=18&&home.subPx>=12&&home.tabPx>=10&&home.blurCount===0&&home.voiceHidden&&home.railHidden&&home.dockAtRest&&errors.length===0?'PASS':'FAIL',";
  }, 1);
b2.rep("v60-home-title",
  "test:'Chromium v59 human-scale home: 460-1050px hero, kicker/title/sub floors, >=92px bento tiles with subtitles, <=4 blurred elements'",
  "test:'Chromium v60 home scale: compact hero, greeting, 3 stat cards, 4 quick-practice cells, no blur'",
  1);
b2.rep("v60-si-scope",
  "if(p2.id==='btnLang'||/v59-si-chip|v59-si-text/.test(p2.className||'')||tag==='SCRIPT'||tag==='STYLE'){ok=true;break;}",
  "if(p2.id==='btnLang'||p2.id==='sdpTopLangPill'||/v59-si-chip|v59-si-text|sdp-si-pill|sdp-lang/.test(p2.className||'')||tag==='SCRIPT'||tag==='STYLE'){ok=true;break;}",
  1);
b2.save(80000);

/* 4. tests/audit-v42.cjs - the v60 pause control replaces the retired lens play button */
var a = require("./patchlib.cjs").open("tests/audit-v42.cjs", ["ok(", "eq("]);
a.regex("audit-pause-btn",
  /await page\.click\('#plPlay'\);/g,
  function () { return "await page.evaluate(() => { const b = document.getElementById('sdpPauseBtn'); if (b) b.click(); });"; },
  2);
a.save(40000);
console.log("p5 fixes 2 done");
