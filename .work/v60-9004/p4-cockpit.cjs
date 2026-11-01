var lib=require('./patchlib.cjs'), p=lib.open('data/learning-tools.js');
p.rep('seven paper slots','for (var i = 0; i < 8; i++) slots.appendChild','for (var i = 0; i < 7; i++) slots.appendChild',1);
p.rep('visible next label',"var skip = mk('button', null, 'sdpSkipBtn', T4('skip'));","var skip = mk('button', null, 'sdpSkipBtn', 'Next');",1);
p.rep('word map heading',"      wm.appendChild(grid);","      var wmHead = mk('div', 'sdp-wordmap-head');\n      wmHead.appendChild(mk('b', null, null, 'Word map'));\n      wmHead.appendChild(mk('span', null, 'sdpWordMapCount', '1 / ' + total));\n      wm.appendChild(wmHead);\n      wm.appendChild(grid);",1);
p.rep('retire all player layout clutter',"    hideLegacyPlayerButtons(card);\n    syncCockpit(eng, null, null);","    cleanCockpitLayout(layer, card, eng);\n    hideLegacyPlayerButtons(card);\n    syncCockpit(eng, null, null);",1);
var helper=[
"  function cleanCockpitLayout(layer, card, eng) {",
"    var e = eng || Eng(), old = $('#sdpPlayerLegacy', layer);",
"    if (!old) { old = mk('div', null, 'sdpPlayerLegacy'); layer.appendChild(old); }",
"    var legacy = $$('.ctrlgrid,.lfoot,#plCount,#plBars,#plProgressDots,[data-voice-pill]', layer);",
"    var fill = $('#plFill', layer);",
"    if (fill && fill.parentNode) legacy.push(fill.parentNode);",
"    for (var i = 0; i < legacy.length; i++) if (legacy[i].parentNode !== old) old.appendChild(legacy[i]);",
"    var cardOld = $('#sdpCockpitLegacy', card);",
"    if (!cardOld) { cardOld = mk('div', null, 'sdpCockpitLegacy'); card.appendChild(cardOld); }",
"    var children = Array.prototype.slice.call(card.children);",
"    var allowed = /^(sdpEdgeBar|sdpCockpitHeaderRow|sdpCockpitStage|sdpCockpitDock|sdpCockpitFoot|sdpCockpitLegacy)$/;",
"    for (var j = 0; j < children.length; j++) if (!allowed.test(children[j].id)) cardOld.appendChild(children[j]);",
"    card.setAttribute('data-show-word', e && e.showWord ? '1' : '0');",
"    var word = $('#plWord', layer), stage = $('#sdpCockpitStage', card);",
"    if (word && stage) {",
"      if (e && e.showWord) { stage.insertBefore(word, stage.firstChild); word.style.setProperty('display', 'block', 'important'); }",
"      else { cardOld.appendChild(word); word.style.setProperty('display', 'none', 'important'); }",
"    }",
"    var lhead = $('.lhead', layer);",
"    if (lhead && !$('#sdpPlayerHeader', lhead)) {",
"      var eye = lhead.querySelector('button[aria-pressed]'), close = $('#btnPlayerClose', lhead);",
"      var header = mk('div', null, 'sdpPlayerHeader'), brand = mk('div', 'sdp-player-brand');",
"      brand.appendChild(mk('span', 'sdp-player-swan', null, '\uD83E\uDDA2'));",
"      var titles = mk('div'); titles.appendChild(mk('b', null, null, 'Dictation'));",
"      titles.appendChild(mk('small', null, 'sdpPlayerSession', 'Session ' + String(e.sessionNo || '8') + ' \u00B7 ' + String(e.listName || 'Feelings (Adj)')));",
"      brand.appendChild(titles); header.appendChild(brand);",
"      var actions = mk('div', 'sdp-player-actions');",
"      if (eye) actions.appendChild(eye);",
"      var finish = mk('button', 'sdp-btn', 'sdpFinishBtn', 'Finish'); finish.type = 'button';",
"      finish.setAttribute('aria-label', 'Finish early');",
"      on(finish, 'click', function () { e.finishEarly(); }); actions.appendChild(finish);",
"      if (close) actions.appendChild(close);",
"      header.appendChild(actions);",
"      while (lhead.firstChild) old.appendChild(lhead.firstChild);",
"      lhead.appendChild(header);",
"    }",
"    var hiddenButtons = $$('button,input', old);",
"    for (var k = 0; k < hiddenButtons.length; k++) hiddenButtons[k].tabIndex = -1;",
"    var body = $('.lbody', layer); if (body) body.scrollTop = 0; layer.scrollTop = 0;",
"  }",
""
].join('\n');
p.rep('cockpit cleanup helper','  function headRowAfter(card, node) {',helper+'  function headRowAfter(card, node) {',1);
p.rep('counters and scroll sync',"    var cells = $$('#sdpWordMap i', layer);",[
"    txt($('#sdpCountCorrect b', layer), String(e.liveCorrectCount || 0));",
"    txt($('#sdpCountMissed b', layer), String(e.liveWrongCount || 0));",
"    txt($('#sdpCountStreak b', layer), String(e.liveStreakCount || 0));",
"    txt($('#sdpWordMapCount', layer), Math.min(totalWords, idx + 1) + ' / ' + totalWords);",
"    var scrollBody = $('.lbody', layer); if (scrollBody) scrollBody.scrollTop = 0; layer.scrollTop = 0;",
"    var cells = $$('#sdpWordMap i', layer);"
].join('\n'),1);
p.rep('direct student start but callable legacy ready sheet',"    if (typeof e.openPlayer === 'function') {\n      var op = e.openPlayer;",[
"    if (typeof e.readyScreen === 'function') {",
"      var readyScreen = e.readyScreen;",
"      e.readyScreen = function () {",
"        if (!this._openingReady || W.__SDP_SKIP_READY__ === false) return readyScreen.apply(this, arguments);",
"        var self = this, seq = this.runId, sp = core() && core().Speech;",
"        if (sp && sp.unlock) sp.unlock();",
"        this.st = 'speaking'; this.phase = 'ready'; this.paused = false;",
"        this.openPlayer();",
"        var readyNum = $('#readyNum'); if (!readyNum) { readyNum = mk('span', null, 'readyNum'); keep(readyNum); }",
"        readyNum.textContent = '0';",
"        this.after(150, function () { if (self.layer && self.runId === seq && self.st === 'speaking') { self.requestWake(); self.runItem(0); } });",
"        return this;",
"      };",
"      var readySpeech = e.speakReadyInstructions;",
"      e.speakReadyInstructions = function () {",
"        if (this._openingReady && W.__SDP_SKIP_READY__ !== false) return;",
"        if (readySpeech) return readySpeech.apply(this, arguments);",
"      };",
"    }",
"    if (typeof e.openPlayer === 'function') {",
"      var op = e.openPlayer;"
].join('\n'),1);
var css=[
'#sdpPlayerLegacy,#sdpCockpitLegacy,.layer.player .ctrlgrid,.layer.player .lfoot{position:fixed!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important}',
'.layer.player .lens{display:none!important}.layer.player .lbody{overflow-y:auto!important;scroll-behavior:auto!important;padding:10px 14px 18px!important}.layer.player .lbody>.stack{width:100%!important;gap:0!important}.layer.player{z-index:200!important;background:#09090B!important;top:0!important;bottom:0!important;margin-top:0!important}.layer.player .lhead{height:64px!important;min-height:64px!important;padding:10px 14px!important;background:#09090B!important;box-sizing:border-box!important}',
'#sdpPlayerHeader{display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;gap:8px!important}.sdp-player-brand{display:flex!important;align-items:center!important;gap:9px!important;min-width:0!important}.sdp-player-swan{width:32px!important;height:32px!important;display:flex!important;align-items:center!important;justify-content:center!important;flex:none!important;background:#0C2D3E!important;border-radius:10px!important}.sdp-player-brand b{display:block!important;color:#FAFAFA!important;font-size:14px!important}#sdpPlayerSession{display:block!important;font-size:10px!important;color:#A1A1AA!important;max-width:180px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.sdp-player-actions{display:flex!important;align-items:center!important;gap:5px!important;flex:none!important}.sdp-player-actions button{height:32px!important;min-height:32px!important}',
'#sdpCockpitCard{margin:0!important;flex:none!important;width:100%!important;box-sizing:border-box!important}#sdpCockpitCard>#plWord,#sdpCockpitCard>#plHint,#sdpCockpitCard>#plWake,#sdpCockpitCard>.v58-word-pill{display:none!important}#sdpCockpitStage #plWord{font-size:26px!important;line-height:1.2!important;margin:0!important}#sdpCockpitCard[data-show-word="0"] #plWord{display:none!important}#sdpLetterSlots i{width:36px!important;height:44px!important;border-radius:8px!important}.sdp-wordmap-head{display:flex!important;justify-content:space-between!important;color:#A1A1AA!important;font-size:11px!important;margin-bottom:10px!important}#sdpEdgeBar{height:4px!important}'
];
p.rep('final player layout CSS',"    return l;\n  }\n\n  /* --------------------------------------------------- style cascade control */",css.map(function(s){return '    l.push('+JSON.stringify(s)+');';}).join('\n')+"\n    return l;\n  }\n\n  /* --------------------------------------------------- style cascade control */",1);
p.save(400000);
p=lib.open('index.html',['</html>','<body','<script']);
p.rep('preserve plCount instead of deleting ID','(i=U.$("#plCount",l))&&i.parentNode&&i.parentNode.removeChild(i)','(i=U.$("#plCount",l))&&(i.style.cssText="position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden;opacity:0")',1);
p.save(598000);
