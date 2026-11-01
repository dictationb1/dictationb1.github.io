/* ============================================================================
   Smart Dictation Player — v58 / 7.0.0 learning-tools.js
   Eight learning features + V58 navigation & focus controllers.
   ES5 only. Zero network writes. Ships with the static GitHub Pages build.
   - 9.1 Levenshtein Diff Coach (markMissed / markCorrect)
   - 9.2 Weak-Words Bank (sdp.weakWords.v1 -> sdp.masteredWords.v1 after 3 streak)
   - 9.3 Paper-Mode Self-Check + A4 printable study sheet (#btnPrintStudySheet)
   - 9.4 Syllable Spotlight + orb halo (.v58-orb-halo)
   - 9.5 Sentence Context Mode (pracMode 'context')
   - 9.6 Speak & Compare (mic mirror, per-attempt blob URLs revoked)
   - 9.7 Offline Pack Downloader (sdp-youdao-v1)
   - 9.8 Lecturer top-10 remediation (#btnBuildRemediationSession)
   ========================================================================== */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  var D = W && W.document;
  var Learn = {};
  W.SDPLearning = Learn;

  /* ---------- shared helpers ---------- */
  function core() { return W.SDPCore || null; }
  function UI() { var c = core(); return c && c.UI; }
  function Eng() { var c = core(); return c && c.Eng; }
  function Lib() { var c = core(); return c && c.Lib; }
  function Speech() { var c = core(); return c && c.Speech; }
  function DB() { var c = core(); return c && c.DB; }
  function $(sel, root) { try { return (root || D).querySelector(sel); } catch (e) { return null; } }
  function $$(sel, root) { try { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); } catch (e) { return []; } }
  function on(node, ev, fn, capture) {
    if (!node || !node.addEventListener) return;
    /* v59 R5: every scroll / touch listener is passive so it can never block the compositor. */
    var passive = /^(scroll|touchstart|touchmove|wheel|mousewheel)$/i.test(String(ev));
    try { node.addEventListener(ev, fn, passive ? { passive: true, capture: !!capture } : !!capture); }
    catch (e) { try { node.addEventListener(ev, fn, !!capture); } catch (e2) {} }
  }
  function toast(msg, opts) { try { var u = UI(); if (u && u.toast) u.toast(msg, opts || {}); } catch (e) {} }
  function guard(fn, where) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (err) { try { if (W.SDPCore && W.SDPCore.Errors) W.SDPCore.Errors.report(err, where); } catch (e) {} return undefined; }
    };
  }
  /* v58 mini-i18n: dynamic + static new UI flips via data-v58-en / data-v58-si. */
  function currentLang() { try { var d = DB(); return (d && d.data && d.data.settings && d.data.settings.lang) === 'si' ? 'si' : 'en'; } catch (e) { return 'en'; } }
  Learn.T = function (en, si) { return currentLang() === 'si' ? si : en; };
  Learn.tag = function (el, en, si) {
    if (!el) return el;
    try {
      el.setAttribute('data-v58-en', en);
      el.setAttribute('data-v58-si', si);
      el.textContent = Learn.T(en, si);
    } catch (e) {}
    return el;
  };
  Learn.applyLang = function () {
    try {
      var nodes = $$('[data-v58-en]');
      for (var i = 0; i < nodes.length; i++) {
        var en = nodes[i].getAttribute('data-v58-en'), si = nodes[i].getAttribute('data-v58-si');
        if (si != null) nodes[i].textContent = Learn.T(en, si);
      }
    } catch (e) {}
  };
  var normW = function (w) {
    w = String(w == null ? '' : w).toLowerCase().split('/')[0].replace(/[^a-z\u0D80-\u0DFF']/g, '').trim();
    return w;
  };

  /* =========================================================
     Weak-words bank (9.2)
     ========================================================= */
  var WKEY = 'sdp.weakWords.v1';
  var MKEY = 'sdp.masteredWords.v1';
  Learn.loadWeakWords = function () { try { return JSON.parse(localStorage.getItem(WKEY) || '{}') || {}; } catch (e) { return {}; } };
  Learn.loadMasteredWords = function () { try { return JSON.parse(localStorage.getItem(MKEY) || '{}') || {}; } catch (e) { return {}; } };
  Learn.saveWeakWords = function (obj) { try { localStorage.setItem(WKEY, JSON.stringify(obj || {})); } catch (e) {} };
  Learn.saveMasteredWords = function (obj) { try { localStorage.setItem(MKEY, JSON.stringify(obj || {})); } catch (e) {} };
  Learn.weakCount = function () { var n = 0, w = Learn.loadWeakWords(); for (var k in w) if (Object.prototype.hasOwnProperty.call(w, k)) n++; return n; };
  Learn.markMissed = guard(function (word) {
    var w = normW(word); if (!w) return 0;
    var all = Learn.loadWeakWords();
    var entry = all[w] || { count: 0, streak: 0, firstMissed: Date.now(), lastMissed: 0 };
    entry.count = (entry.count || 0) + 1;
    entry.streak = 0;
    entry.lastMissed = Date.now();
    all[w] = entry;
    Learn.saveWeakWords(all);
    var mastered = Learn.loadMasteredWords();
    if (mastered[w]) { delete mastered[w]; Learn.saveMasteredWords(mastered); }
    Learn.syncWeakBadge();
    Learn.syncRail();
    return entry.count;
  }, 'v58.markMissed');
  Learn.markCorrect = guard(function (word) {
    var w = normW(word); if (!w) return false;
    var all = Learn.loadWeakWords();
    var entry = all[w];
    if (!entry) return false;
    entry.streak = (entry.streak || 0) + 1;
    entry.lastCorrect = Date.now();
    if (entry.streak >= 3) {
      delete all[w];
      var mastered = Learn.loadMasteredWords();
      var m = mastered[w] || { count: 0, firstMissed: entry.firstMissed || 0 };
      m.count = (m.count || 0) + 1;
      m.graduatedAt = Date.now();
      mastered[w] = m;
      Learn.saveMasteredWords(mastered);
      Learn.saveWeakWords(all);
      toast('⭐ ' + word + ' mastered! Moving to Mastered Words.', { icon: 'i-check' });
      Learn.syncWeakBadge();
      Learn.syncRail();
      return true;
    }
    Learn.saveWeakWords(all);
    Learn.syncWeakBadge();
    return false;
  }, 'v58.markCorrect');
  /* Find the full word object for a plain word (current list, then any list, then synth). */
  Learn.wordFor = function (word) {
    var w = normW(word);
    var pools = [];
    try { var eng = Eng(); if (eng && eng.words && eng.words.length) pools.push(eng.words); } catch (e) {}
    try { var lib = Lib(); if (lib && lib.current && lib.current()) pools.push(lib.current().words || []); } catch (e) {}
    try { var db = DB(); if (db && db.data && db.data.lists) { for (var i = 0; i < db.data.lists.length; i++) pools.push(db.data.lists[i].words || []); } } catch (e) {}
    for (var p = 0; p < pools.length; p++) {
      var words = pools[p] || [];
      for (var j = 0; j < words.length; j++) {
        if (normW(words[j].w || words[j].word) === w) return words[j];
      }
    }
    return { w: word, si: '', p: '', pos: '', m: '', s: '', audio: 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(word) };
  };
  Learn.getWeakWords = function () {
    var all = Learn.loadWeakWords();
    var out = [];
    for (var k in all) if (Object.prototype.hasOwnProperty.call(all, k)) {
      var e = all[k] || {};
      out.push({ word: k, count: e.count || 0, streak: e.streak || 0, lastMissed: e.lastMissed || e.firstMissed || 0, obj: Learn.wordFor(k) });
    }
    out.sort(function (a, b) { return b.count - a.count || a.word.localeCompare(b.word); });
    return out;
  };
  Learn.syncWeakBadge = guard(function () {
    var badge = $('#weakWordsCountBadge');
    if (!badge) return;
    var n = Learn.weakCount();
    badge.textContent = n ? String(n) : '';
    try { badge.classList[n ? 'remove' : 'add']('hidden'); } catch (e) {}
  }, 'v58.syncWeakBadge');
  Learn.drillWeakWords = guard(function () {
    var weak = Learn.getWeakWords();
    if (!weak.length) { toast('No weak words yet — finish a session first.', { icon: 'i-info' }); return; }
    var eng = Eng();
    if (!eng || !eng.start) return;
    var words = [];
    for (var i = 0; i < weak.length; i++) {
      var o = weak[i].obj || {};
      o.w = o.w || weak[i].word;
      words.push(o);
    }
    /* close any open layers, then start a focused weak-words session */
    try {
      var u = UI();
      if (u && u.closeTop) { for (var c = 0; c < 8; c++) { if (u.closeTop()) break; } }
      var open = $('#layers .layer'); if (open && u && u.closeLayer) u.closeLayer(open);
    } catch (e) {}
    eng.start({ list: { name: 'My Weak Words', id: 'v58-weak', words: words }, listName: 'My Weak Words · ' + words.length + ' words', mode: 'type' });
    toast('Drilling ' + words.length + ' weak words — your first language! 🎯', { icon: 'i-target' });
  }, 'v58.drillWeakWords');
  /* Weak-Words view (Home tile / Dictionary tab / Overflow). */
  Learn.openWeakWords = guard(function () {
    var u = UI(); if (!u || !u.sheet) return;
    var host = u.sheet({ title: Learn.T('⭐ My Weak Words · ', '⭐ මගේ දුර්වල වචන · ') + Learn.weakCount(), sub: Learn.T('Missed words live here until you spell them correctly 3 times in a row.', 'වැරදුණු වචන මෙහි ඉතිරි වේ — අඛණ්ඩව 3 වරක් නිවැරදිව ලියුම් කරන තුරු.') });
    var weak = Learn.getWeakWords();
    var list = D.createElement('div');
    if (!weak.length) {
      var empty = D.createElement('p');
      empty.className = 'small muted';
      empty.textContent = 'No weak words yet. Every missed spelling lands here automatically — then you drill it until it graduates. 🌱';
      list.appendChild(empty);
    }
    for (var i = 0; i < weak.length; i++) {
      (function (entry) {
        var row = D.createElement('div');
        row.className = 'listrow';
        var box = D.createElement('div');
        var b = D.createElement('b'); b.textContent = entry.obj && entry.obj.w ? entry.obj.w : entry.word;
        var sub = D.createElement('div');
        sub.className = 'tiny muted';
        var streakTxt = entry.streak ? 'streak ' + entry.streak + '/3' : 'not streaked yet';
        sub.textContent = 'missed ×' + entry.count + ' · ' + streakTxt + (entry.obj && entry.obj.si && currentLang() === 'si' ? ' · ' + entry.obj.si : '');
        box.appendChild(b); box.appendChild(sub);
        var play = D.createElement('button');
        play.type = 'button'; play.className = 'btn icon soft'; play.setAttribute('aria-label', 'Play ' + entry.word);
        play.textContent = '🔊';
        on(play, 'click', function () { try { Speech().playWord(entry.obj.w || entry.word, 1, function () {}); } catch (e) {} });
        row.appendChild(box); row.appendChild(play);
        list.appendChild(row);
      })(weak[i]);
    }
    host.appendChild(list);
    var drill = D.createElement('button');
    drill.type = 'button'; drill.className = 'btn pri block'; drill.id = 'v58SheetDrill';
    Learn.tag(drill, '🎯 Drill My Weak Words (' + weak.length + ')', '🎯 දුර්වල වචන පුහුණු කරන්න (' + weak.length + ')');
    on(drill, 'click', function () { Learn.drillWeakWords(); });
    host.appendChild(drill);
    var masteredBtn = D.createElement('button');
    masteredBtn.type = 'button'; masteredBtn.className = 'btn soft block'; masteredBtn.id = 'v58SheetMastered';
    var mcount = 0, mastered = Learn.loadMasteredWords();
    for (var mk in mastered) if (Object.prototype.hasOwnProperty.call(mastered, mk)) mcount++;
    Learn.tag(masteredBtn, '🏆 Mastered Words (' + mcount + ')', '🏆 ප්‍රගතිමත් වචන (' + mcount + ')');
    on(masteredBtn, 'click', function () {
      var names = [];
      for (var k in mastered) if (Object.prototype.hasOwnProperty.call(mastered, k)) names.push(k);
      toast(names.length ? 'Mastered: ' + names.slice(0, 12).join(', ') + (names.length > 12 ? '…' : '') : 'Nothing graduated yet.', { icon: 'i-check', ms: 6e3 });
    });
    host.appendChild(masteredBtn);
  }, 'v58.openWeakWords');

  /* =========================================================
     9.1 Levenshtein Diff Coach
     ========================================================= */
  Learn.levenshteinOps = function (target, typed) {
    target = String(target == null ? '' : target);
    typed = String(typed == null ? '' : typed);
    var a = target.toLowerCase(), b = typed.toLowerCase();
    var m = a.length, n = b.length;
    var d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    var ops = [];
    i = m; j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)) {
        if (a.charAt(i - 1) !== b.charAt(j - 1)) ops.push({ op: 'replace', at: i, from: a.charAt(i - 1), to: b.charAt(j - 1) });
        i--; j--;
      } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.push({ op: 'insert', at: i, from: '', to: b.charAt(j - 1) }); i--; }
      else { ops.push({ op: 'delete', at: i, from: a.charAt(i - 1), to: '' }); j--; }
    }
    ops.reverse();
    return ops;
  };
  /* Typed coach feedback string: '3 letters off' | 'Almost — 1 letter off' | 'Keep going — N letters off' */
  Learn.diffFeedback = function (target, typed) {
    var ops = Learn.levenshteinOps(target, typed);
    var n = ops.length;
    if (!n) return 'Spot on';
    if (n === 1) {
      var o = ops[0];
      if (o.op === 'replace') return 'Almost — swap "' + o.from + '" for "' + o.to + '"';
      if (o.op === 'delete') return 'Almost — "' + o.to + '" is extra, remove it';
      return 'Almost — "' + o.from + '" is missing, add it';
    }
    return n + ' letters off — try again';
  };
  /* Render the diff HTML for a target word vs typed answer (safe: escapes both). */
  Learn.diffHTML = function (target, typed) {
    var ops = Learn.levenshteinOps(target, typed);
    var t = String(target == null ? '' : target), out = '', pos = 0, i;
    function esc(ch) { return ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch; }
    var applied = [];
    for (i = 0; i < ops.length; i++) {
      var o = ops[i];
      if (o.op === 'insert') applied.push({ at: o.at - 1, kind: 'ins', ch: o.to });
      else if (o.op === 'replace') applied.push({ at: o.at - 1, kind: 'rep', ch: o.from });
      else applied.push({ at: o.at - 1, kind: 'del', ch: o.from });
    }
    for (i = 0; i < applied.length; i++) {
      var a = applied[i];
      if (a.at < pos) { /* overlapping op: render inline mark anyway */ }
      if (a.at > pos) out += esc(t.slice(pos, a.at));
      if (a.kind === 'ins') { out += '<span class="v58-ins">[' + esc(a.ch) + ']</span>'; }
      else if (a.kind === 'del') { out += '<span class="v58-del">' + esc(a.ch) + '<b>×</b></span>'; }
      else { out += '<span class="v58-swap">' + esc(a.ch) + '</span>'; }
      pos = Math.max(pos, a.at + 1);
    }
    out += esc(t.slice(pos));
    return out;
  };
  /* Build (or refresh) the inline mistake coach element. */
  Learn.renderMistakeCoach = guard(function (wordObj, typedAns, host) {
    var target = String((wordObj && (wordObj.w || wordObj.word)) || wordObj || '');
    var typed = String(typedAns || '');
    var node = $('#v58MistakeCoach');
    if (!node) {
      if (!host) return null;
      node = D.createElement('div');
      node.id = 'v58MistakeCoach';
      node.className = 'v58-coach';
      node.setAttribute('role', 'status');
      host.appendChild(node);
    }
    node.innerHTML = '';
    var head = D.createElement('div');
    head.className = 'v58-coach-head';
    head.innerHTML = '<b>' + Learn.diffHTML(target, typed) + '</b><span class="v58-coach-note">' + Learn.diffFeedback(target, typed) + '</span>';
    node.appendChild(head);
    var foot = D.createElement('div');
    foot.className = 'tiny muted';
    var ipa = (wordObj && wordObj.p) ? ' /' + wordObj.p + '/' : '';
    var si = (wordObj && wordObj.si) ? ' · සිංහල: ' + wordObj.si : '';
    var meaning = (wordObj && (wordObj.m || wordObj.d)) ? ' · meaning: ' + (wordObj.m || wordObj.d) : '';
    foot.textContent = 'Target: ' + target + ipa + meaning + si + ' — every miss lands in ⭐ My Weak Words. ✏️';
    node.appendChild(foot);
    try { node.classList.remove('hidden'); } catch (e) {}
    return node;
  }, 'v58.renderMistakeCoach');
  Learn.hideMistakeCoach = function () { var n = $('#v58MistakeCoach'); if (n) { try { n.classList.add('hidden'); } catch (e) {} } };

  /* =========================================================
     9.3 Paper self-check + printable study sheet
     ========================================================= */
  Learn.renderPaperSelfCheck = guard(function (result, layerHost) {
    if (!result || !result.rows || !result.rows.length || !layerHost) return null;
    var box = D.createElement('div');
    box.className = 'v58-selfcheck glass card';
    box.id = 'v58SelfCheck';
    var head = D.createElement('div');
    head.className = 'spread';
    head.innerHTML = '<h3>🧾 Paper self-check</h3><span class="chip" id="v58SelfScore">— / ' + result.rows.length + '</span>';
    box.appendChild(head);
    var note = D.createElement('p');
    note.className = 'tiny muted';
    note.textContent = 'Tap ✓ if you wrote it correctly, ✗ if you missed it. Misses feed the weak-words bank — anonymous, on this phone only.';
    box.appendChild(note);
    var state = [];
    function refresh() {
      var ok = 0;
      for (var i = 0; i < state.length; i++) if (state[i] === 'ok') ok++;
      var pct = Math.round(100 * ok / Math.max(1, state.length));
      var chip = $('#v58SelfScore', box);
      if (chip) chip.textContent = ok + ' / ' + state.length + ' · ' + pct + '%';
      result.score = ok;
      result.percent = pct;
      var sum = $('#resSummary');
      if (sum) {
        var tail = ' · self-check ' + ok + '/' + state.length + ' (' + pct + '%)';
        if (sum.getAttribute('data-v58-scored') !== tail) { sum.setAttribute('data-v58-scored', tail); }
      }
    }
    for (var i = 0; i < result.rows.length; i++) {
      (function (row, idx) {
        state[idx] = row.state === 'ok' ? 'ok' : 'miss';
        var r = D.createElement('div');
        r.className = 'v58-selfrow';
        var w = D.createElement('span');
        w.className = 'v58-selfword';
        w.innerHTML = '<b>' + (row.state === 'ok' ? '✓' : '✗') + '</b> ' + (Learn.diffHTML(row.word, row.answer || '') || row.word) + (row.si ? ' <i class="muted">· ' + row.si + '</i>' : '');
        var btns = D.createElement('span');
        btns.className = 'v58-selfbtns';
        var okB = D.createElement('button');
        okB.type = 'button'; okB.className = 'btn sm soft'; okB.setAttribute('aria-label', 'Got it: ' + row.word); okB.textContent = '✓ Got It';
        var missB = D.createElement('button');
        missB.type = 'button'; missB.className = 'btn sm soft'; missB.setAttribute('aria-label', 'Missed it: ' + row.word); missB.textContent = '✗ Missed It';
        on(okB, 'click', function () { state[idx] = 'ok'; Learn.markCorrect(row.word); okB.classList.add('good'); missB.classList.remove('warn'); refresh(); });
        on(missB, 'click', function () { state[idx] = 'miss'; Learn.markMissed(row.word); missB.classList.add('warn'); okB.classList.remove('good'); refresh(); });
        btns.appendChild(okB); btns.appendChild(missB);
        r.appendChild(w); r.appendChild(btns);
        box.appendChild(r);
      })(result.rows[i], i);
    }
    layerHost.appendChild(box);
    refresh();
    return box;
  }, 'v58.renderPaperSelfCheck');
  /* A4 printable study sheet — writes #printview and prints. */
  Learn.printStudySheet = guard(function () {
    var pv = $('#printview');
    if (!pv) return;
    var lib = Lib();
    var list = (lib && lib.current && lib.current()) || { name: '', words: [] };
    var db = DB();
    var settings = (db && db.data && db.data.settings) || {};
    var sess = (db && db.data && db.data.session) || {};
    var words = list.words || [];
    var head = D.createElement('div');
    head.className = 'pv-head';
    head.textContent = 'CCBE Galle Branch · B1 · Session ' + (sess.no || '8') + ' · ' + (sess.date || '29/10/2026') + ' · Student Name: _______________';
    pv.innerHTML = '';
    var h1 = D.createElement('h1');
    h1.textContent = 'Smart Dictation Practice Sheet — ' + (list.name || 'Word list');
    var sub = D.createElement('div');
    sub.className = 'pv-sub';
    sub.textContent = 'Words: ' + words.length + ' · UK IPA & Sinhala meanings · write each word twice';
    pv.appendChild(head); pv.appendChild(h1); pv.appendChild(sub);
    var table = D.createElement('table');
    table.className = 'pv-table';
    var thead = D.createElement('thead');
    thead.innerHTML = '<tr><th>#</th><th>English Word</th><th>UK IPA</th><th>POS</th><th>Sinhala Meaning (සිංහල තේරුම)</th></tr>';
    table.appendChild(thead);
    var tb = D.createElement('tbody');
    for (var i = 0; i < words.length; i++) {
      var w = words[i] || {};
      var tr = D.createElement('tr');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + String(w.w || '') + '</td><td>' + (w.p ? '/' + w.p + '/' : '') + '</td><td>' + String(w.pos || '') + '</td><td>' + String(w.si || w.m || '') + '</td>';
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    pv.appendChild(table);
    var linesH = D.createElement('h2');
    linesH.textContent = 'Writing practice';
    pv.appendChild(linesH);
    var lines = D.createElement('div');
    lines.className = 'lines';
    for (var j = 0; j < words.length; j++) {
      var line = D.createElement('div');
      line.className = 'pv-line';
      line.innerHTML = '<span>' + (j + 1) + '.</span><i></i>';
      lines.appendChild(line);
    }
    pv.appendChild(lines);
    var key = D.createElement('div');
    key.className = 'pv-key';
    var kh = D.createElement('h2');
    kh.textContent = 'Answer Key & Example Sentences';
    key.appendChild(kh);
    var ol = D.createElement('ol');
    for (var k = 0; k < words.length; k++) {
      var ww = words[k] || {};
      var li = D.createElement('li');
      li.textContent = (ww.w || '') + (ww.p ? ' /' + ww.p + '/' : '') + (ww.m ? ' — ' + ww.m : '') + (ww.si ? ' — ' + ww.si : '') + (ww.s ? ' — “' + ww.s + '”' : '');
      ol.appendChild(li);
    }
    key.appendChild(ol);
    pv.appendChild(key);
    W.print();
  }, 'v58.printStudySheet');

  /* =========================================================
     9.4 Syllable spotlight + orb halo
     ========================================================= */
  Learn.syllablesOf = function (word) {
    var w = String(word == null ? '' : word).toLowerCase().split('/')[0].replace(/[^a-z]/g, '');
    if (!w) return [String(word || '')];
    var v = 'aeiouy', groups = [], i, n = w.length;
    for (i = 0; i < n; i++) {
      if (v.indexOf(w.charAt(i)) >= 0) {
        var j = i; while (j < n && v.indexOf(w.charAt(j)) >= 0) j++;
        groups.push([i, j]); i = j - 1;
      }
    }
    if (groups.length <= 1) return [w];
    var out = [], prevEnd = 0;
    for (var g = 0; g < groups.length; g++) {
      var start = prevEnd;
      var end = groups[g][1];
      if (g < groups.length - 1) {
        var nextStart = groups[g + 1][0];
        var cons = nextStart - end;
        if (cons > 1) end += cons - 1;
      }
      out.push(w.slice(start, end));
      prevEnd = end;
    }
    var last = groups[groups.length - 1][1];
    if (last < w.length) out[out.length - 1] += w.slice(last);
    for (var q = 0; q < out.length; q++) if (!out[q]) return [w];
    if (out.join('') !== w) return [w];
    return out;
  };
  Learn.spotlightEl = function () {
    var el = $('#v58SyllableSpotlight');
    if (!el) {
      el = D.createElement('div');
      el.id = 'v58SyllableSpotlight';
      el.className = 'v58-syllables';
      el.setAttribute('aria-live', 'polite');
      (D.body || D.documentElement).appendChild(el);
    }
    return el;
  };
  Learn.startSyllableSpotlight = guard(function (wordObj, durationMs) {
    var raw = String((wordObj && (wordObj.w || wordObj.word)) || wordObj || '');
    var syl = Learn.syllablesOf(raw);
    var host = Learn.spotlightEl();
    host.innerHTML = '';
    var chips = [];
    for (var i = 0; i < syl.length; i++) {
      var c = D.createElement('span');
      c.className = 'v58-syl-chip';
      c.textContent = syl[i];
      host.appendChild(c);
      chips.push(c);
    }
    try { host.classList.remove('hidden'); } catch (e) {}
    var step = Math.max(140, (durationMs || 900) / Math.max(1, chips.length));
    var reduced = false;
    try { reduced = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    var idx = 0;
    if (Learn._sylTimer) { clearInterval(Learn._sylTimer); Learn._sylTimer = null; }
    if (Learn._sylHide) { clearTimeout(Learn._sylHide); Learn._sylHide = null; }
    function tick() {
      for (var k = 0; k < chips.length; k++) { try { chips[k].classList[k === idx ? 'add' : 'remove']('on'); } catch (e) {} }
      idx++;
      if (idx >= chips.length) {
        clearInterval(Learn._sylTimer); Learn._sylTimer = null;
        Learn._sylHide = setTimeout(function () { try { host.classList.add('hidden'); } catch (e) {} }, 420);
      }
    }
    tick();
    if (!reduced) Learn._sylTimer = setInterval(tick, step);
    return chips.length;
  }, 'v58.startSyllableSpotlight');
  /* Orb halo: AnalyserNode -> <=30fps transform halo around the speaker orb. */
  Learn.attachOrbHalo = guard(function (layer) {
    if (!layer) return;
    var orb = $('#btnReplay', layer) || $('#btnTestVoicePlayer', layer);
    if (!orb || orb.getAttribute('data-v58-orb')) return;
    orb.setAttribute('data-v58-orb', '1');
    var halo = D.createElement('span');
    halo.className = 'v58-orb-halo';
    halo.setAttribute('aria-hidden', 'true');
    var host = orb.parentNode;
    if (host && getComputedStyle(host).position === 'static') { try { host.style.position = 'relative'; } catch (e) {} }
    orb.style.position = 'relative';
    orb.appendChild(halo);
  }, 'v58.attachOrbHalo');
  Learn._haloLast = 0;
  Learn.haloFrame = guard(function (ts) {
    var halo = $('.v58-orb-halo');
    var analyser = W.SDPLearning._analyser;
    var audio = $('#ttsMasterAudio');
    var playing = !!(audio && !audio.paused && !audio.ended && audio.currentTime > 0);
    var perf = 'full';
    try { perf = DB().data.settings.perf; } catch (e) {}
    var reduced = false;
    try { reduced = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (!halo || !analyser || !playing || perf !== 'full' || reduced) {
      if (halo) { try { halo.style.transform = 'scale(1)'; halo.style.opacity = '0'; } catch (e) {} }
      return;
    }
    if (ts - Learn._haloLast < 33) return; /* <=30fps */
    Learn._haloLast = ts;
    try {
      var bins = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(bins);
      var sum = 0;
      for (var i = 0; i < bins.length; i++) sum += bins[i];
      var level = Math.min(1, (sum / Math.max(1, bins.length)) / 128);
      halo.style.transform = 'scale(' + (1 + level * 0.55).toFixed(3) + ')';
      halo.style.opacity = String(0.25 + level * 0.65);
    } catch (e) {}
  }, 'v58.haloFrame');
  /* v59 A6: the halo only animates while audio is actually playing. When the
     player is idle or the audio is paused/ended the loop stops and never
     schedules another frame, so the Home screen burns zero rAF time. */
  Learn.haloShouldRun = function () {
    var audio = $('#ttsMasterAudio');
    var playing = !!(audio && !audio.paused && !audio.ended && audio.currentTime > 0);
    var st = (Eng() && Eng().st) || 'idle';
    var perf = 'full';
    try { perf = DB().data.settings.perf; } catch (e) {}
    var reduced = false;
    try { reduced = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    return playing && st !== 'idle' && perf === 'full' && !reduced && !!(D && D.querySelector('.v58-orb-halo'));
  };
  Learn._haloLoop = function (ts) {
    Learn._haloTicks = (Learn._haloTicks || 0) + 1;
    try { Learn.haloFrame(ts || Date.now()); } catch (e) {}
    if (!Learn.haloShouldRun()) { Learn._haloRunning = false; return; }
    try { W.requestAnimationFrame(Learn._haloLoop); } catch (e) { Learn._haloRunning = false; }
  };
  Learn.startHalo = function () {
    if (Learn._haloRunning) return;
    Learn._haloRunning = true;
    try { W.requestAnimationFrame(Learn._haloLoop); } catch (e) { Learn._haloRunning = false; }
  };
  Learn.stopHalo = function () {
    Learn._haloRunning = false;
    var halo = $('.v58-orb-halo');
    if (halo) { try { halo.style.transform = 'scale(1)'; halo.style.opacity = '0'; } catch (e) {} }
  };

  /* v59 R6: the halo is driven by playback events and the media clock only.
     No AnalyserNode, no MediaElementSource, no canvas readback — a cross-origin
     dict.youdao.com <audio> element can therefore never be silenced on Android
     Chrome or iOS Safari. */
  Learn.haloFrame = guard(function () {
    var halo = $('.v58-orb-halo');
    if (!halo) return;
    var audio = $('#ttsMasterAudio');
    var playing = !!(audio && !audio.paused && !audio.ended);
    if (!playing) {
      try { halo.style.opacity = '0'; halo.style.transform = 'scale(1)'; } catch (e) {}
      return;
    }
    var t = Number(audio.currentTime) || 0;
    var level = 0.35 + 0.35 * Math.abs(Math.sin(t * 3.2));
    try {
      halo.style.transform = 'scale(' + (1 + level * 0.45).toFixed(3) + ')';
      halo.style.opacity = String(0.2 + level * 0.6);
    } catch (e) {}
  }, 'v59.haloFrame');

  /* =========================================================
     9.5 Sentence Context Mode
     ========================================================= */
  Learn.blankSentence = function (sentence, word) {
    var s = String(sentence || '');
    var w = String(word || '').split('/')[0].trim();
    if (!s || !w) return s;
    try {
      var esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^a-z])';
      return s.replace(new RegExp(esc, 'gi'), '_______');
    } catch (e) { return s; }
  };
  Learn.renderContextMode = guard(function (screens) {
    var stage = $('#pracStage');
    var lib = Lib();
    var list = (lib && lib.current && lib.current()) || { words: [] };
    var words = list.words || [];
    var count = $('#pracCount');
    if (count) count.textContent = words.length ? '1 / ' + words.length : '0 / 0';
    var chips = $$('#pracMode button');
    for (var c = 0; c < chips.length; c++) {
      var sel = chips[c].getAttribute('data-p') === 'context';
      chips[c].setAttribute('aria-selected', sel ? 'true' : 'false');
      chips[c].setAttribute('aria-pressed', sel ? 'true' : 'false');
    }
    if (!stage) return false;
    stage.innerHTML = '';
    if (!words.length) {
      var none = D.createElement('p');
      none.className = 'muted';
      none.textContent = 'No list loaded yet.';
      stage.appendChild(none);
      return true;
    }
    var idx = ((screens && screens.pracIndex) || 0) % words.length;
    var word = words[idx];
    var blank = Learn.blankSentence(word.s, word.w);
    var card = D.createElement('div');
    card.className = 'glass card v58-context-card';
    card.innerHTML = '<div class="tiny muted">📖 Sentence Context · fill the gap</div><p class="v58-context-sentence">' + blank + '</p>';
    var hint = D.createElement('div');
    hint.className = 'tiny muted';
    hint.textContent = (word.p ? '/' + word.p + '/ · ' : '') + (word.si || word.m || '');
    card.appendChild(hint);
    stage.appendChild(card);
    /* 4 choices */
    var choices = [];
    choices.push(word);
    var pool = [];
    for (var i = 0; i < words.length; i++) if (i !== idx) pool.push(words[i]);
    pool.sort(function () { return Math.random() - 0.5; });
    for (var p2 = 0; p2 < 3 && p2 < pool.length; p2++) choices.push(pool[p2]);
    choices.sort(function () { return Math.random() - 0.5; });
    var row = D.createElement('div');
    row.className = 'v58-context-choices';
    row.id = 'v58ContextChoices';
    for (var k = 0; k < choices.length; k++) {
      (function (choice, pos) {
        var b = D.createElement('button');
        b.type = 'button';
        b.className = 'btn soft';
        b.textContent = (pos + 1) + '. ' + (choice.w || '');
        on(b, 'click', function () { Learn.answerContext(word, choice, row); });
        row.appendChild(b);
      })(choices[k], k);
    }
    stage.appendChild(row);
    /* typed fallback with the 9.1 coach */
    var typedRow = D.createElement('div');
    typedRow.className = 'v58-context-typed';
    var input = D.createElement('input');
    input.type = 'text';
    input.id = 'v58ContextInput';
    input.setAttribute('aria-label', 'Type the missing word');
    input.placeholder = '…or type the missing word';
    var check = D.createElement('button');
    check.type = 'button'; check.className = 'btn pri'; check.textContent = 'Check';
    var speak = D.createElement('button');
    speak.type = 'button'; speak.className = 'btn soft'; speak.textContent = '🔊 Hear sentence';
    on(speak, 'click', function () {
      try { Speech().speakStudioText(String(word.s || word.w || ''), 'en', function () {}); } catch (e) {}
    });
    on(check, 'click', function () { Learn.answerContextTyped(word, input.value, row); });
    on(input, 'keydown', function (e) { if (e && e.key === 'Enter') { e.preventDefault(); Learn.answerContextTyped(word, input.value, row); } });
    typedRow.appendChild(input); typedRow.appendChild(check); typedRow.appendChild(speak);
    stage.appendChild(typedRow);
    Learn._contextWord = word;
    Learn._contextChoices = row;
    return true;
  }, 'v58.renderContextMode');
  Learn.answerContext = guard(function (word, choice, row) {
    var right = normW(choice.w) === normW(word.w);
    var btns = $$('button', row);
    for (var i = 0; i < btns.length; i++) {
      var isRight = normW(btns[i].textContent.replace(/^\d+\.\s*/, '')) === normW(word.w);
      try { btns[i].classList[isRight ? 'add' : 'remove']('good'); } catch (e) {}
      if (!isRight && normW(btns[i].textContent.replace(/^\d+\.\s*/, '')) === normW(choice.w)) { try { btns[i].classList.add('warn'); } catch (e) {} }
    }
    if (right) {
      Learn.markCorrect(word.w);
      toast('✅ ' + word.w + ' — correct! ' + (word.s || ''), { icon: 'i-check' });
      try { Speech().speakStudioText(String(word.s || word.w), 'en', function () {}); } catch (e) {}
    } else {
      Learn.markMissed(word.w);
      Learn.renderMistakeCoach(word, choice.w || '', $('#pracStage'));
    }
  }, 'v58.answerContext');
  Learn.answerContextTyped = guard(function (word, typed, row) {
    var right = normW(typed) === normW(word.w);
    if (right) {
      Learn.markCorrect(word.w);
      toast('✅ ' + word.w + ' — correct!', { icon: 'i-check' });
      var host = $('#pracStage');
      if (host) Learn.renderMistakeCoach(word, typed, host);
    } else {
      Learn.markMissed(word.w);
      var host2 = $('#pracStage');
      if (host2) Learn.renderMistakeCoach(word, typed, host2);
    }
  }, 'v58.answerContextTyped');

  /* =========================================================
     9.6 Speak & Compare (mic mirror)
     ========================================================= */
  Learn.recordAndCompare = guard(function (wordObj) {
    var word = String((wordObj && (wordObj.w || wordObj.word)) || '');
    if (!word) return;
    if (!W.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('🎤 Mic compare needs a modern browser (MediaRecorder). Try Chrome or Firefox.', { icon: 'i-alert', ms: 6e3 });
      return;
    }
    if (Learn._mirrorUrl) { try { URL.revokeObjectURL(Learn._mirrorUrl); } catch (e) {} Learn._mirrorUrl = null; }
    if (Learn._mirrorStream) { try { Learn._mirrorStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} Learn._mirrorStream = null; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      Learn._mirrorStream = stream;
      var chunks = [];
      var rec = new MediaRecorder(stream);
      rec.ondataavailable = function (e) { if (e && e.data) chunks.push(e.data); };
      rec.onstop = function () {
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        var blob = new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'audio/webm' });
        var url = URL.createObjectURL(blob);
        Learn._mirrorUrl = url; /* revoked on the next attempt, never leaked */
        var studio = D.createElement('audio');
        var mine = D.createElement('audio');
        var studioUrl = (wordObj && wordObj.audio) || ('https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(word));
        studio.src = studioUrl; studio.preload = 'auto';
        mine.src = url; mine.preload = 'auto';
        studio.onended = function () { try { mine.play(); } catch (e) {} };
        studio.play();
      };
      rec.start();
      toast('🎤 Listening — say “' + word + '” after the studio voice.', { icon: 'i-mic' });
      setTimeout(function () { try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {} }, 2600);
    }, function () {
      toast('🎤 Microphone unavailable. Tap the mic icon again and allow mic access — or use ✏️ Typing Mode. / මයික්රෝෆෝනය ලබාගත නොහැකි විය.', { icon: 'i-alert', ms: 6e3 });
    });
  }, 'v58.recordAndCompare');

  /* =========================================================
     9.7 Offline Pack Downloader -> sdp-youdao-v1
     ========================================================= */
  Learn.downloadOfflinePack = guard(function () {
    var fill = $('#v58OfflineFill');
    var text = $('#v58OfflineText');
    var lib = Lib();
    var list = (lib && lib.current && lib.current()) || { words: [] };
    var words = list.words || [];
    if (!words.length) { toast('No word list loaded yet.', { icon: 'i-info' }); return; }
    if (!W.caches) { toast('Offline packs need a secure context (https).', { icon: 'i-alert' }); return; }
    if (Learn._offlineBusy) return;
    Learn._offlineBusy = true;
    var done = 0, total = words.length;
    function step() {
      done++;
      if (fill) { try { fill.style.width = Math.round(100 * done / total) + '%'; } catch (e) {} }
      if (text) { try { text.textContent = done + '/' + total + ' words saved offline ✓'; } catch (e) {} }
      if (done >= total) {
        Learn._offlineBusy = false;
        try {
          var db = DB();
          db.data.settings.offlineReadyAt = Date.now();
          db.data.settings.offlineReadyCount = total;
          db.save();
        } catch (e) {}
        toast('📥 Offline pack ready: ' + total + ' word clips in sdp-youdao-v1.', { icon: 'i-check', ms: 6e3 });
        /* fonts ride along into the media cache */
        try {
          W.caches.open('sdp-v58-media').then(function (cache) {
            return Promise.all([
              cache.add('./assets/fonts/NotoSansSinhala-Regular.woff2'),
              cache.add('./assets/fonts/NotoSansSinhala-Bold.woff2')
            ]);
          }).catch(function () {});
        } catch (e) {}
      }
    }
    W.caches.open('sdp-youdao-v1').then(function (cache) {
      var pending = total;
      if (!pending) { Learn._offlineBusy = false; return; }
      for (var i = 0; i < words.length; i++) {
        (function (w) {
          var url = w.audio || ('https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(w.w));
          cache.match(url).then(function (hit) {
            if (hit) { step(); return; }
            return W.fetch(url, { mode: 'no-cors', credentials: 'omit' }).then(function (res) {
              if (res) return cache.put(url, res.clone());
            }).catch(function () { /* offline: still counts toward progress; retry any time */ }).then(step);
          }).catch(step);
        })(words[i] || {});
      }
    }).catch(function () { Learn._offlineBusy = false; });
  }, 'v58.downloadOfflinePack');
  Learn.syncOfflineRow = guard(function () {
    var fill = $('#v58OfflineFill');
    var text = $('#v58OfflineText');
    if (!fill || !text) return;
    var settings = (DB() && DB().data && DB().data.settings) || {};
    var lib = Lib();
    var words = ((lib && lib.current && lib.current()) || { words: [] }).words || [];
    if (settings.offlineReadyAt) {
      try { fill.style.width = '100%'; } catch (e) {}
      text.textContent = (settings.offlineReadyCount || words.length) + '/30 words saved offline ✓ · re-download anytime';
    } else {
      try { fill.style.width = '0%'; } catch (e) {}
      text.textContent = words.length + ' word clips can be saved offline';
    }
  }, 'v58.syncOfflineRow');

  /* =========================================================
     V58 Navigation controllers — VV dock, keyboard HUD, focus dim
     ========================================================= */
  Learn.VV = {
    vv: W.visualViewport,
    _initialInnerHeight: (W.innerHeight || 800),
    enabled: function () {
      var s = (DB() && DB().data && DB().data.settings) || {};
      if (s.vkb === false || s.vkb === 0) return false;
      /* v59 R6: the keyboard dock is a safety feature, so Lite mode keeps it. */
      return true;
    },
    layout: guard(function () {
      if (!D.body) return;
      if (!Learn.VV.enabled()) { try { D.body.classList.remove('v58-keyboard'); } catch (e) {} return; }
      var vv = W.visualViewport || { height: W.innerHeight || 800, offsetTop: 0 };
      var kb = (W.innerHeight || 800) - vv.height - vv.offsetTop;
      var act = D.activeElement;
      var typingFocus = !!(act && (act.id === 'ansInput' || (act.closest && act.closest('.layer')))) ||
        !!(Eng() && Eng().layer && Eng().mode === 'type');
      if (typingFocus) {
        var drop = Learn.VV._initialInnerHeight - (W.innerHeight || 800);
        if (drop > kb) kb = drop;
      }
      /* small-viewport simulated keyboards count too (tests & split-screen) */
      var small = (W.innerWidth || 360) <= 560;
      if (small) {
        var dropSmall = Learn.VV._initialInnerHeight - (W.innerHeight || 800);
        if (dropSmall > kb) kb = dropSmall;
      }
      var active = kb > 120;
      try { D.body.classList.toggle('v58-keyboard', active); } catch (e) {
        if (active) D.body.classList.add('v58-keyboard'); else D.body.classList.remove('v58-keyboard');
      }
      Learn.attachDock();
    }, 'v58.VV.layout'),
    attachDock: guard(function () {
      var dock = $('#v58Dock');
      if (dock) return dock;
      var eng = Eng();
      if (!eng || !eng.layer) return null;
      var stack = $('.lbody .stack', eng.layer) || $('.lbody', eng.layer) || eng.layer;
      if (stack) stack.id = 'v58Dock';
      return stack;
    }, 'v58.VV.attachDock'),
    isKeyboardOpen: function () { return !!(D.body && D.body.classList.contains('v58-keyboard')); }
  };
  Learn.toggleKeyboardMode = function (force) {
    var on = typeof force === 'boolean' ? force : !Learn.VV.isKeyboardOpen();
    try { D.body.classList.toggle('v58-keyboard', on); } catch (e) {}
    return on;
  };

  /* ---- focus-dim (6b) ---- */
  Learn.syncFocus = guard(function () {
    var eng = Eng();
    if (!eng || !D.body) return;
    var active = !!(eng.st && eng.st !== 'idle' && eng.st !== 'finished' && (eng.layer || eng.st === 'ready'));
    var hasResults = !!$('#layers .layer .scorering') || !!$('#layers .layer #resSummary');
    if (active && !hasResults) {
      try { D.body.classList.add('v58-focus'); } catch (e) {}
    } else {
      try { D.body.classList.remove('v58-focus'); } catch (e) {}
    }
    var v = $('#bgLiveVideo');
    if (v) {
      try {
        var s = (DB() && DB().data && DB().data.settings) || {};
        var reduced = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (active) {
          if (s.pauseVideoWhileWriting) { if (!v.paused) v.pause(); }
          else if (!reduced) { v.playbackRate = 0.4; }
        } else {
          if (!v.paused && v.playbackRate !== 1) v.playbackRate = 1;
        }
      } catch (e) {}
    }
  }, 'v58.syncFocus');

  /* ---- contrast gauge + presets (6c/6d) ---- */
  Learn.relLum = function (r, g, b) {
    function f(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  /* v59 A5: zero readback. The old implementation drew a 1x1 copy of the
     wallpaper video into a canvas and called getImageData — that forced a GPU
     readback on every gauge tick and tainted Android Chrome. The gauge is now
     pure O(1) arithmetic from a precomputed wallpaper luminance. */
  Learn.sampleVideo = function () { return null; };
  Learn.wallpaperLuminance = function () {
    var bright = false;
    try { bright = D.documentElement.getAttribute('data-theme') === 'light' || (D.body && D.body.getAttribute('data-theme') === 'light'); } catch (e) {}
    var v = $('#bgLiveVideo');
    var playing = false;
    try { playing = !!(v && !v.paused && !v.ended && v.readyState >= 2); } catch (e) {}
    /* Static wallpaper is the dim 0.22 default; a live video frame peaks at 0.72. */
    return playing ? 0.72 : (bright ? 0.66 : 0.22);
  };
  Learn.contrastRatio = function () {
    var lw = (core() && core().LiveWallpaper) || null;
    var dim = 34;
    try { dim = lw && lw.dimValue ? Number(lw.dimValue()) : Number((DB().data.settings.videoDim) || 34); } catch (e) {}
    var a = Math.max(0, Math.min(100, dim)) / 100;
    var lr = false;
    try { lr = (D.documentElement.getAttribute('data-theme') === 'light') || (D.body.getAttribute('data-theme') === 'light'); } catch (e) {}
    /* v59: no canvas, no video readback — pure arithmetic WCAG composite. */
    var wallpaperL = Learn.wallpaperLuminance();
    var scrimL = lr ? 0.90 : 0.015;
    var bgL = wallpaperL * (1 - a) + scrimL * a;
    var strong = false;
    try { strong = D.documentElement.getAttribute('data-v58-preset') === 'shield'; } catch (e) {}
    var coreA = strong ? 0.97 : 0.94;
    var coreL = lr ? 1 : 0.012;
    var outL = coreL * coreA + bgL * (1 - coreA);
    var fgL = lr ? 0.015 : 0.965;
    var hi = Math.max(fgL, outL), lo = Math.min(fgL, outL);
    return { ratio: (hi + 0.05) / (lo + 0.05), dim: dim, lum: outL };
  };
  Learn.updateGauge = guard(function () {
    var lw = (core() && core().LiveWallpaper) || null;
    var host = $('#dimHostSet') || $('#dimHostSheet');
    var node = $('#contrastReadout');
    if (!node && host) {
      node = D.createElement('p');
      node.id = 'contrastReadout';
      node.className = 'tiny muted';
      host.appendChild(node);
    }
    if (!node) return;
    var g = Learn.contrastRatio();
    var lvl = g.ratio >= 7 ? 'AAA ✓' : (g.ratio >= 4.5 ? 'AA ✓' : 'warning: below 4.5:1');
    var tail = g.ratio >= 4.5 ? ' · readable' : '';
    node.textContent = 'Live WCAG contrast ' + g.ratio.toFixed(1) + ':1 · ' + lvl + tail;
    /* keep preset chips in sync */
    var s = (DB() && DB().data && DB().data.settings) || {};
    var preset = s.contrastPreset || 'balanced';
    var chips = $$('.v58-preset');
    for (var i = 0; i < chips.length; i++) chips[i].setAttribute('aria-pressed', chips[i].getAttribute('data-preset') === preset ? 'true' : 'false');
    try { D.documentElement.setAttribute('data-v58-preset', preset); } catch (e) {}
  }, 'v58.updateGauge');
  Learn.PRESETS = {
    low: { dim: 12, en: '🌙 Low Light (Dim)', si: '🌙 අඩු ආලෝකය (Dim)' },
    balanced: { dim: 34, en: '⚖️ Balanced Glass (WCAG AAA)', si: '⚖️ සමතුලිත වීදුරු (WCAG AAA)' },
    shield: { dim: 68, en: '🛡️ Bright-Day Shield', si: '🛡️ දීප්තිමත් දින ආවරණය' }
  };
  Learn.applyPreset = guard(function (preset) {
    var def = Learn.PRESETS[preset];
    if (!def) return;
    var db = DB(); if (!db || !db.data) return;
    db.data.settings.contrastPreset = preset;
    try { db.save(); } catch (e) {}
    try { D.documentElement.setAttribute('data-v58-preset', preset); } catch (e) {}
    var lw = (core() && core().LiveWallpaper) || null;
    if (lw && lw.setDim) lw.setDim(def.dim);
    Learn.updateGauge();
  }, 'v58.applyPreset');
  Learn.buildPresets = function () {
    var box = D.createElement('div');
    box.className = 'v58-presets';
    box.id = 'v58ContrastPresets';
    box.setAttribute('aria-label', 'Contrast presets');
    var order = ['low', 'balanced', 'shield'];
    for (var i = 0; i < order.length; i++) {
      (function (key) {
        var def = Learn.PRESETS[key];
        var b = D.createElement('button');
        b.type = 'button';
        b.className = 'v58-preset';
        b.id = 'v58Preset-' + key;
        b.setAttribute('data-preset', key);
        Learn.tag(b, def.en + ' (' + def.dim + '%)', def.si + ' (' + def.dim + '%)');
        on(b, 'click', function () { Learn.applyPreset(key); });
        box.appendChild(b);
      })(order[i]);
    }
    return box;
  };

  /* =========================================================
     Workspace rail (4a) + mastery (5a)
     ========================================================= */
  Learn.buildRail = guard(function () {
    var rail = $('#v58Rail');
    if (!rail || rail.getAttribute('data-v58-built')) return;
    rail.setAttribute('data-v58-built', '1');
    rail.innerHTML =
      '<div class="glass card"><div class="spread"><h3>Live Session Progress</h3><span class="chip" id="v58RailMastery">0%</span></div>' +
      '<div class="v58-railrow"><span>Words completed</span><b id="v58RailDone">0 / 30</b></div>' +
      '<div class="v58-railrow"><span>Correct</span><b id="v58RailCorrect" style="color:#54e0b4">0</b></div>' +
      '<div class="v58-railrow"><span>Missed</span><b id="v58RailMissed" style="color:#ff7286">0</b></div>' +
      '<div class="bar" id="v58RailBar" aria-hidden="true"><i style="width:0%"></i></div>' +
      '<div class="v58-navgrid" id="v58WordNavGrid" aria-label="Word navigation"></div></div>' +
      '<div class="glass card"><div class="spread"><h3>Audio queue</h3><span class="chip">British 🇬🇧</span></div><div id="v58RailQueue"><p class="tiny muted">Start a session to see the next words.</p></div></div>';
  }, 'v58.buildRail');
  Learn.syncRail = guard(function () {
    Learn.buildRail();
    var eng = Eng();
    var total = 30, done = 0, correct = 0, missed = 0;
    var words = [];
    if (eng && eng.layer && eng.words && eng.words.length) {
      words = eng.words;
      total = Math.min(words.length, 30);
      done = Math.min(eng.idx + (eng.st === 'finished' ? 1 : 0), total);
      correct = eng.liveCorrectCount || 0;
      missed = eng.liveWrongCount || 0;
    } else {
      var db = DB();
      var last = db && db.data && db.data.results && db.data.results.length ? db.data.results[db.data.results.length - 1] : null;
      if (last) { total = Math.min(last.wordCount || last.rows && last.rows.length || 30, 30); correct = last.score || 0; missed = Math.max(0, (last.wordCount || 0) - (last.score || 0)); done = last.wordCount ? total : 0; }
    }
    var mastery = done ? Math.round(100 * correct / Math.max(1, done + missed)) : 0;
    var set = function (id, txt) { var n = $('#' + id); if (n) { try { n.textContent = txt; } catch (e) {} } };
    set('v58RailDone', done + ' / ' + total);
    set('v58RailCorrect', String(correct));
    set('v58RailMissed', String(missed));
    set('v58RailMastery', mastery + '%');
    set('v58MasteryChip', correct + ' / ' + total);
    var bar = $('#v58RailBar i'); if (bar) { try { bar.style.width = mastery + '%'; } catch (e) {} }
    var mbar = $('#v58MasteryBar i'); if (mbar) { try { mbar.style.width = mastery + '%'; } catch (e) {} }
    /* nav grid */
    var grid = $('#v58WordNavGrid');
    if (grid) {
      var html = '';
      for (var i = 1; i <= total; i++) {
        var cls = 'v58-navchip';
        if (eng && eng.layer && i - 1 === eng.idx) cls += ' v58-nav-cur';
        else if (i <= done) cls += (eng && (eng.hard || []).indexOf && (eng.hard || []).indexOf(i - 1) >= 0) ? ' v58-nav-miss' : ' v58-nav-done';
        html += '<button type="button" class="' + cls + '" data-v58-nav="' + i + '" aria-label="Word ' + i + '">' + i + '</button>';
      }
      grid.innerHTML = html;
    }
    /* audio queue: next 3 words + cache badges */
    var queue = $('#v58RailQueue');
    if (queue && eng && eng.words && eng.words.length) {
      var qhtml = '';
      for (var k = 0; k < 3; k++) {
        var idx = ((eng.idx || 0) + k) % eng.words.length;
        var w = eng.words[idx];
        if (!w) continue;
        qhtml += '<div class="v58-railrow"><span>' + (w.w || '') + '</span><span class="chip" data-v58-cache="' + (w.audio || '') + '">…</span></div>';
      }
      queue.innerHTML = qhtml || '<p class="tiny muted">Queue empty.</p>';
      if (W.caches) {
        var chips = $$('[data-v58-cache]', queue);
        for (var c = 0; c < chips.length; c++) {
          (function (chip) {
            var url = chip.getAttribute('data-v58-cache');
            if (!url) { chip.textContent = 'READY'; return; }
            W.caches.match(url).then(function (hit) { try { chip.textContent = hit ? 'CACHED ✓' : 'READY'; } catch (e) {} }).catch(function () { try { chip.textContent = 'READY'; } catch (e) {} });
          })(chips[c]);
        }
      }
    }
    Learn.syncWeakBadge();
    Learn.syncOfflineRow();
  }, 'v58.syncRail');

  /* =========================================================
     Overflow regroup (5b)
     ========================================================= */
  Learn.regroupOverflow = guard(function () {
    var menu = $('#topOverflow .overflow-menu');
    if (!menu || menu.getAttribute('data-v58-regroup')) return;
    menu.setAttribute('data-v58-regroup', '1');
    var byId = {};
    var leftovers = [];
    var kids = Array.prototype.slice.call(menu.children);
    for (var i = 0; i < kids.length; i++) {
      var id = kids[i].id || '';
      if (id) byId[id] = kids[i]; else leftovers.push(kids[i]);
    }
    function group(title, titleSi) {
      var g = D.createElement('div');
      g.className = 'v58-menu-group';
      var t = D.createElement('div');
      t.className = 'v58-menu-group-title';
      Learn.tag(t, title, titleSi);
      g.appendChild(t);
      return g;
    }
    function add(g, node) { if (node) g.appendChild(node); }
    function menuBtn(id, label, labelSi, handler) {
      var b = D.createElement('button');
      b.type = 'button';
      b.id = id;
      b.className = 'btn soft block';
      Learn.tag(b, label, labelSi);
      on(b, 'click', function () { try { $('#topOverflow').open = false; } catch (e) {} handler(); });
      return b;
    }
    var g1 = group('Study Tools', 'අධ්‍යයන මෙවලම්');
    add(g1, byId.btnGuideTop);
    add(g1, menuBtn('v58MenuPractice', '🎮 Practice Hub', '🎮 පුහුණු මධ්‍යස්ථානය', function () { try { UI().setTab('practice'); } catch (e) {} }));
    add(g1, menuBtn('v58MenuWeak', '⭐ My Weak Words', '⭐ මගේ දුර්වල වචන', function () { Learn.openWeakWords(); }));
    add(g1, menuBtn('v58MenuOffline', '📥 Download for Offline', '📥 ඔෆ්ලයින් බාගන්න', function () { Learn.downloadOfflinePack(); }));
    add(g1, menuBtn('v58MenuPrint', '🖨️ Print Study Sheet (A4)', '🖨️ අධ්‍යයන පත්‍රය (A4)', function () { Learn.printStudySheet(); }));
    var g2 = group('Appearance & Wallpaper', 'පෙනුම සහ බිත්තිකඩය');
    add(g2, byId.btnLiveVideo);
    add(g2, byId.btnTheme);
    add(g2, byId.btnPerf);
    add(g2, menuBtn('v58MenuPresets', '🌗 Contrast Presets', '🌗 ප්‍රතිවිරුද්ධතා පූර්ව සැකසුම්', function () {
      try { UI().setTab('set'); } catch (e) {}
      setTimeout(function () {
        var open = $('#btnOpenGallery');
        if (open) { try { open.click(); return; } catch (e) {} }
        toast('Open Settings → Wallpaper for contrast presets.', { icon: 'i-info' });
      }, 120);
    }));
    var g3 = group('Audio & Data', 'ශබ්දය සහ දත්ත');
    add(g3, menuBtn('v58MenuDataSheet', '📊 Data & LKR Sheet', '📊 දත්ත සහ LKR පත්‍රය', function () {
      var u = UI();
      if (u && u.openDataSheet) u.openDataSheet();
      else if ($('#topDataBadge')) { try { $('#topDataBadge').click(); } catch (e) {} }
    }));
    add(g3, byId.chipNet);
    add(g3, byId.btnRefresh);
    var g4 = group('Lecturer Studio', 'කථිකාචාර්ය ශාලාව');
    add(g4, byId.btnAdmin);
    menu.innerHTML = '';
    menu.appendChild(g1); menu.appendChild(g2); menu.appendChild(g3); menu.appendChild(g4);
    for (var f = 0; f < leftovers.length; f++) menu.appendChild(leftovers[f]);
  }, 'v58.regroupOverflow');

  /* ---- overflow close behaviours ---- */
  Learn.closeOverflow = function () {
    var d = $('#topOverflow');
    if (d && d.open) { try { d.open = false; } catch (e) {} return true; }
    return false;
  };

  /* =========================================================
     About & Credits (7)
     ========================================================= */
  Learn.openAbout = guard(function () {
    var sheet = $('#aboutCreditsSheet');
    var scrim = $('#aboutCreditsScrim');
    if (!sheet || !scrim) return;
    try { scrim.classList.remove('hidden'); sheet.classList.remove('hidden'); } catch (e) {}
    try { sheet.scrollTop = 0; } catch (e) {}
    /* populate from data/config.json -> credits when reachable (static fallback already in DOM) */
    if (!Learn._creditsLoaded) {
      try {
        /* static file:// pages keep the embedded fallback text (fetch is unsupported there) */
        var proto = (W.location && W.location.protocol) || '';
        if (proto === 'file:' || typeof W.fetch !== 'function') { throw new Error('no-fetch'); }
        W.fetch('./data/config.json', { cache: 'force-cache' }).then(function (r) { return r.json(); }).then(function (cfg) {
          var credits = cfg && cfg.credits;
          if (!credits) return;
          Learn._creditsLoaded = true;
          var set = function (id, txt) { var n = $('#' + id); if (n && txt) { try { n.textContent = txt; } catch (e) {} } };
          set('v58CreditCreator', credits.createdBy);
          set('v58CreditIdea', credits.ideaBy);
          set('v58CreditLecturer', credits.lecturerInCharge);
          set('v58CreditCreatorRole', 'Design, engineering & the Liquid Glass experience · නිර්මාණය සහ සංවර්ධනය');
          set('v58CreditIdeaRole', 'The original idea that started this project · අදහස හා මූලිකත්වය');
          set('v58CreditLecturerRole', 'CCBE Galle Branch · TUE/THU/IPET015 · භාරකාර කථිකාචාර්ය');
        }).catch(function () {});
      } catch (e) {}
    }
  }, 'v58.openAbout');
  Learn.closeAbout = function () {
    var sheet = $('#aboutCreditsSheet');
    var scrim = $('#aboutCreditsScrim');
    try { if (sheet) sheet.classList.add('hidden'); if (scrim) scrim.classList.add('hidden'); } catch (e) {}
  };

  /* =========================================================
     Retry toast guarantees (3d)
     ========================================================= */
  Learn.killRetryToasts = function () {
    var t = $$('.sdp-retry-toast');
    for (var i = 0; i < t.length; i++) { try { t[i].parentNode.removeChild(t[i]); } catch (e) {} }
  };

  /* =========================================================
     Keyboard HUD + shortcuts (4b)
     ========================================================= */
  Learn.inPlayer = function () { var eng = Eng(); return !!(eng && eng.layer); };
  Learn.handleKey = guard(function (e) {
    if (!e) return;
    var k = e.key;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    var tag = t && t.tagName;
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable);
    if (k === 'Escape') { Learn.closeOverflow(); return; }
    if (typing) return;
    if (k === '?' || (k === '/' && e.shiftKey)) {
      e.preventDefault();
      try { D.body.classList.toggle('v58-hud-off'); } catch (err) {}
      window.SDP = window.SDP || {};
      window.SDP.__kbdTests = (window.SDP.__kbdTests || 0) + 1;
      return;
    }
    window.SDP = window.SDP || {};
    window.SDP.__kbdTests = (window.SDP.__kbdTests || 0) + 1;
    var playerOpen = Learn.inPlayer();
    var lower = typeof k === 'string' ? k.toLowerCase() : '';
    function click(id) {
      var b = $('#' + id) || (playerOpen && Learn.layer() && $('#' + id, Learn.layer()));
      if (b) { try { b.click(); return true; } catch (err) {} }
      return false;
    }
    if (!playerOpen) return;
    if (k === ' ') {
      e.preventDefault();
      if (!click('btnPause')) { try { Eng().togglePause(); } catch (err) {} }
    } else if (lower === 'r') { if (!click('btnReplay')) { try { Eng().repeatWord(); } catch (err) {} } }
    else if (lower === 's') { if (!click('btnSlow')) { try { Eng().slower(); } catch (err) {} } }
    else if (lower === 'e') { if (!click('btnSentence')) { try { Eng().repeatSentence(); } catch (err) {} } }
    else if (lower === 'l') { if (!click('btnSpell')) { try { Eng().spellWord(); } catch (err) {} } }
    else if (k === 'Enter') {
      var input = Learn.layer() && $('#ansInput', Learn.layer());
      if (input) { e.preventDefault(); try { Eng().submitTypeAnswer(); } catch (err) {} }
    } else if (/^[1-4]$/.test(k)) {
      var host = $('#v58ContextChoices') || (Screens() && Screens().pracMode === 'quiz' ? $('#pracStage') : null);
      if (host) {
        var btns = $$('button', host);
        var pick = btns[Number(k) - 1];
        if (pick) { try { pick.click(); } catch (err) {} }
      }
    }
  }, 'v58.handleKey');
  Learn.layer = function () { var eng = Eng(); return (eng && eng.layer) || null; };
  function Screens() { var c = core(); return c && c.Screens; }

  /* =========================================================
     Wiring hooks (deferred, after SDPCore exists)
     ========================================================= */
  function hookLang() {
    var u = UI();
    if (!u || !u.setLang || u.__v58Lang) return;
    var sl = u.setLang;
    u.setLang = function () {
      var out = sl.apply(this, arguments);
      try { Learn.applyLang(); } catch (e) {}
      return out;
    };
    u.__v58Lang = true;
  }
  function hookScreens() {
    var s = Screens(); if (!s) return;
    if (!s.__v58Home && s.home) {
      var home = s.home;
      s.home = guard(function () {
        var out = home.apply(this, arguments);
        try { Learn.syncRail(); Learn.syncOfflineRow(); } catch (e) {}
        return out;
      }, 'v58.screens.home');
      s.__v58Home = true;
    }
    if (!s.__v58Practice && s.practice) {
      var prac = s.practice;
      s.practice = guard(function () {
        var screens = s;
        if (screens.pracMode === 'context') {
          try { Learn.renderContextMode(screens); return; } catch (e) {}
        }
        var out = prac.apply(this, arguments);
        try {
          /* quiz misses via capture-phase delegation */
          var stage = $('#pracStage');
          if (stage && !stage.getAttribute('data-v58-quiz')) {
            stage.setAttribute('data-v58-quiz', '1');
            on(stage, 'click', function (ev) {
              try {
                if (screens.pracMode !== 'quiz') return;
                var lib = Lib();
                var words = ((lib && lib.current && lib.current()) || { words: [] }).words || [];
                var idx = ((screens.pracIndex || 0) % Math.max(1, words.length));
                var w = words[idx];
                if (!w) return;
                var btn = ev.target && ev.target.closest ? ev.target.closest('button') : null;
                if (!btn) return;
                var label = String(btn.textContent || '').replace(/^\d+\.\s*/, '').trim();
                if (normW(label) === normW(w.w)) Learn.markCorrect(w.w);
                else if (/^(Yes|No)\b/.test(label)) { /* skip binary rows */ }
                else Learn.markMissed(w.w);
              } catch (e2) {}
            }, true);
          }
        } catch (e) {}
        return out;
      }, 'v58.screens.practice');
      s.__v58Practice = true;
    }
    if (!s.__v58Settings && s.settings) {
      var set = s.settings;
      s.settings = guard(function () {
        var out = set.apply(this, arguments);
        try {
          var body = $('#setBody');
          if (body) {
            var old = $('#v58SetExtras');
            if (old && old.parentNode) old.parentNode.removeChild(old);
            var extras = D.createElement('div');
            extras.id = 'v58SetExtras';
            extras.className = 'stack';
            var aboutCard = D.createElement('div');
            aboutCard.className = 'glass card';
            var bTitle = D.createElement('h3');
            bTitle.textContent = '🦢 About & Credits';
            var bSub = D.createElement('p');
            bSub.className = 'small muted';
            bSub.textContent = 'Hansana · Ayya01 (Lesandu) · Ms. Sumodya Sewmini · Session 8 · B1';
            var bBtn = D.createElement('button');
            bBtn.type = 'button';
            bBtn.id = 'v58AboutPill';
            bBtn.className = 'btn soft block';
            Learn.tag(bBtn, '🦢 Crafted by Hansana · CCBE Galle', '🦢 නිර්මාණය: Hansana · CCBE Galle');
            on(bBtn, 'click', function () { Learn.openAbout(); });
            Learn.tag(bTitle, '🦢 About & Credits', '🦢 ගැන සහ ස්තුති');
            aboutCard.appendChild(bTitle); aboutCard.appendChild(bSub); aboutCard.appendChild(bBtn);
            extras.appendChild(aboutCard);
            body.appendChild(extras);
          }
        } catch (e) {}
        return out;
      }, 'v58.screens.settings');
      s.__v58Settings = true;
    }
    if (!s.__v58Dict && s.dict) {
      var dict = s.dict;
      s.dict = guard(function () {
        var out = dict.apply(this, arguments);
        try {
          var host = $('#dictList');
          if (host && !$('#v58DictWeakBtn')) {
            var b = D.createElement('button');
            b.type = 'button';
            b.id = 'v58DictWeakBtn';
            b.className = 'btn soft block';
            Learn.tag(b, '⭐ My Weak Words (' + Learn.weakCount() + ')', '⭐ මගේ දුර්වල වචන (' + Learn.weakCount() + ')');
            on(b, 'click', function () { Learn.openWeakWords(); });
            host.parentNode.insertBefore(b, host);
          }
        } catch (e) {}
        return out;
      }, 'v58.screens.dict');
      s.__v58Dict = true;
    }
  }

  function hookResults() {
    var c = core(); if (!c || !c.Results) return;
    var R = c.Results;
    if (!R.__v58Open && R.open) {
      var open = R.open;
      R.open = guard(function () {
        var out = open.apply(this, arguments);
        try {
          var result = arguments[0];
          var layer = out && out.classList && out.classList.contains('layer') ? out : ($('#layers .layer', D) || out);
          var host = (layer && (layer.querySelector('.lbody') || layer)) || null;
          if (result && result.rows && host) {
            if (result.mode === 'paper') Learn.renderPaperSelfCheck(result, host);
            /* 9.1 coach wired into results review rows */
            var wrong = [];
            for (var i = 0; i < result.rows.length; i++) if (result.rows[i].state !== 'ok') wrong.push(result.rows[i]);
            if (wrong.length) {
              var box = D.createElement('div');
              box.id = 'v58ResultsCoach';
              box.className = 'v58-coach results-coach';
              var title = D.createElement('h3');
              title.textContent = '🧩 Mistake breakdown (' + wrong.length + ')';
              box.appendChild(title);
              for (var j = 0; j < wrong.length; j++) {
                var r = wrong[j];
                var line = D.createElement('div');
                line.className = 'v58-coach-head';
                line.innerHTML = '<b>' + Learn.diffHTML(r.word, r.answer || '') + '</b><span class="v58-coach-note">' + Learn.diffFeedback(r.word, r.answer || '') + '</span>';
                box.appendChild(line);
              }
              host.appendChild(box);
            }
            /* drill button — works for type AND paper mode */
            if (wrong.length) {
              var drill = D.createElement('button');
              drill.type = 'button';
              drill.id = 'btnDrillWeak';
              drill.className = 'btn pri block';
              drill.textContent = '🎯 Drill My Weak Words (' + Learn.weakCount() + ')';
              on(drill, 'click', function () { Learn.drillWeakWords(); });
              host.appendChild(drill);
            }
            var printBtn = D.createElement('button');
            printBtn.type = 'button';
            printBtn.id = 'btnPrintStudySheet';
            printBtn.className = 'btn soft block';
            printBtn.textContent = '🖨️ Printable study sheet (A4)';
            on(printBtn, 'click', function () { Learn.printStudySheet(); });
            host.appendChild(printBtn);
          }
          Learn.syncRail();
        } catch (e) {}
        return out;
      }, 'v58.results.open');
      R.__v58Open = true;
    }
  }

  function hookEng() {
    var c = core(); if (!c || !c.Eng) return;
    var E = c.Eng;
    function wrap(name, after, where) {
      var fn = E[name];
      if (typeof fn !== 'function' || (E['__v58_' + name])) return;
      E[name] = guard(function () {
        var out = fn.apply(this, arguments);
        try { after.call(this, out, arguments); } catch (e) {}
        return out;
      }, where);
      E['__v58_' + name] = true;
    }
    wrap('start', function () { setTimeout(function () { try { Learn.syncRail(); Learn.attachDock(); Learn.syncFocus(); } catch (e) {} }, 60); });
    wrap('startWord', function () { try { Learn.syncRail(); Learn.hideMistakeCoach(); } catch (e) {} });
    wrap('paint', function () { try { Learn.syncRail(); Learn.attachDock(); } catch (e) {} });
    wrap('next', function () { try { Learn.killRetryToasts(); Learn.syncRail(); } catch (e) {} });
    wrap('stop', function () { try { D.body.classList.remove('v58-focus'); D.body.classList.remove('v58-keyboard'); Learn.killRetryToasts(); Learn.syncRail(); } catch (e) {} });
    wrap('slower', function () {
      try {
        var t = this.currentWord();
        if (t) Learn.startSyllableSpotlight(t, 1600);
      } catch (e) {}
    }, 'v58.eng.slower');
    wrap('spellWord', function () {
      try {
        var t = this.currentWord();
        if (t) Learn.startSyllableSpotlight(t, 2200);
      } catch (e) {}
    }, 'v58.eng.spell');
    wrap('onTypeWrong', function () {
      try {
        var t = this.currentWord();
        var input = this.layer && $('#ansInput', this.layer);
        var typed = this.typedAnswer || (input && input.value) || '';
        if (t) {
          Learn.markMissed(t.w || t.word || '');
          var fb = $('#ansFeedback', this.layer);
          var host = (fb && fb.parentNode) || this.layer;
          Learn.renderMistakeCoach(t, typed, host);
        }
      } catch (e) {}
    }, 'v58.eng.typeWrong');
    wrap('onTypeCorrect', function () {
      try {
        var t = this.currentWord();
        if (t) { Learn.markCorrect(t.w || t.word || ''); Learn.hideMistakeCoach(); }
      } catch (e) {}
    }, 'v58.eng.typeCorrect');
    if (!E.__v58OpenPlayer && E.openPlayer) {
      var op = E.openPlayer;
      E.openPlayer = guard(function () {
        var out = op.apply(this, arguments);
        try {
          var layer = this.layer || out || null;
          Learn.VV.attachDock();
          Learn.attachOrbHalo(layer);
        } catch (e) {}
        return out;
      }, 'v58.eng.openPlayer');
      E.__v58OpenPlayer = true;
    }
  }

  function hookSpeech() {
    var sp = Speech(); if (!sp) return;
    if (!sp.__v58Gain && typeof sp.ensureGain === 'function') {
      var eg = sp.ensureGain;
      sp.ensureGain = guard(function () {
        var out = eg.apply(this, arguments);
        try {
          var gain = this._gain;
          var ctx = this._audioCtx || this.ctx || this.audioCtx || null;
          if (gain && ctx && !gain.__v58Analyser) {
            var analyser = ctx.createAnalyser();
            analyser.fftSize = 128;
            analyser.smoothingTimeConstant = 0.82;
            try { gain.disconnect(); } catch (e) {}
            gain.connect(analyser);
            analyser.connect(ctx.destination);
            gain.__v58Analyser = analyser;
            Learn._analyser = analyser;
            if (!Learn._haloStarted) { Learn._haloStarted = true; try { W.requestAnimationFrame(Learn._haloLoop); } catch (e) {} }
          }
        } catch (e) {}
        return out;
      }, 'v58.speech.ensureGain');
      sp.__v58Gain = true;
    }
    if (!sp.__v58Retry && typeof sp.showRetryToast === 'function') {
      var srt = sp.showRetryToast;
      sp.showRetryToast = guard(function () {
        var out = srt.apply(this, arguments);
        setTimeout(function () { Learn.killRetryToasts(); }, 5000);
        return out;
      }, 'v58.speech.retry');
      sp.__v58Retry = true;
    }
  }

  function hookWallpaper() {
    var c = core(); if (!c || !c.LiveWallpaper) return;
    var lw = c.LiveWallpaper;
    if (!lw.__v58Dim && typeof lw.setDim === 'function') {
      var sd = lw.setDim;
      lw.setDim = guard(function () {
        var out = sd.apply(this, arguments);
        try { Learn.updateGauge(); } catch (e) {}
        return out;
      }, 'v58.lw.setDim');
      lw.__v58Dim = true;
    }
    if (!lw.__v58Ctrl && typeof lw.dimControl === 'function') {
      var dc = lw.dimControl;
      lw.dimControl = guard(function () {
        var node = dc.apply(this, arguments);
        try {
          if (node && !$('#v58ContrastPresets', node)) {
            var presets = Learn.buildPresets();
            var anchor = $('.dim-row', node) || node.firstChild;
            node.insertBefore(presets, anchor);
          }
        } catch (e) {}
        return node;
      }, 'v58.lw.dimControl');
      lw.__v58Ctrl = true;
    }
  }

  /* ---- home tile + static wiring ---- */
  function wireStatic() {
    on($('#credit'), 'click', function () { Learn.openAbout(); });
    on($('#v58AboutClose'), 'click', function () { Learn.closeAbout(); });
    on($('#aboutCreditsScrim'), 'click', function () { Learn.closeAbout(); });
    on($('#v58OfflineBtn'), 'click', function () { Learn.downloadOfflinePack(); });
    on($('#v58MenuPrint'), 'click', function () { Learn.printStudySheet(); });
    var tiles = $$('[data-v58-practice]');
    for (var i = 0; i < tiles.length; i++) {
      (function (tile) {
        on(tile, 'click', function () {
          var kind = tile.getAttribute('data-v58-practice');
          try {
            if (kind === 'weak') { Learn.openWeakWords(); return; }
            if (kind === 'audio') { UI().setTab('dict'); return; }
            UI().setTab('practice');
            var s = Screens();
            if (!s) return;
            if (kind === 'flash') {
              s.pracMode = 'flash';
              var seg = $('#pracMode');
              if (seg) { try { UI().segValue(seg, 'flash'); } catch (e) {} }
              s.practice();
            } else if (kind === 'quiz') {
              s.pracMode = 'quiz';
              var seg2 = $('#pracMode');
              if (seg2) { try { UI().segValue(seg2, 'quiz'); } catch (e) {} }
              s.practice();
            }
          } catch (e) {}
        });
      })(tiles[i]);
    }
    var comm = $('[data-v58-goto="comm"]');
    on(comm, 'click', function () { try { UI().setTab('comm'); } catch (e) {} });
    /* voice badge follows the live speech settings */
    var badge = $('#v58VoiceBadge');
    if (badge) {
      try {
        var sp = Speech();
        var voiceName = sp && sp.voiceName ? sp.voiceName() : null;
        var name = voiceName || '🇬🇧 Alice';
        if (name.indexOf('🇬🇧') !== 0 && name.indexOf('🇺🇸') !== 0) name = '🇬🇧 ' + name;
        badge.textContent = name;
      } catch (e) {}
    }
    /* one-time iOS audio unlock */
    var unlocked = false;
    function unlockOnce() {
      if (unlocked) return;
      unlocked = true;
      try { var sp2 = Speech(); if (sp2 && sp2.ensureGain) sp2.ensureGain(); } catch (e) {}
      try {
        if (W.speechSynthesis && W.SpeechSynthesisUtterance) {
          /* iOS needs a (silent) first utterance to unlock its audio engine;
             other platforms never touch speechSynthesis from a bare tap. */
          var ua = String((W.navigator && W.navigator.userAgent) || '');
          if (/iPhone|iPad|iPod/.test(ua)) {
            var u = new W.SpeechSynthesisUtterance(' ');
            u.volume = 0;
            W.speechSynthesis.speak(u);
          }
        }
      } catch (e) {}
    }
    on(D, 'touchend', unlockOnce, true);
    on(D, 'pointerdown', unlockOnce, true);
    on(D, 'keydown', Learn.handleKey);
    /* retry toast killers */
    on(D, 'click', function (ev) {
      try {
        var t = ev && ev.target;
        if (t && t.closest && t.closest('.sdp-retry-toast')) return;
        if (t && (t.closest('button') || (t.closest && t.closest('.btn')))) Learn.killRetryToasts();
      } catch (e) {}
    }, true);
    /* click-outside closes overflow */
    on(D, 'click', function (ev) {
      try {
        var d = $('#topOverflow');
        if (d && d.open) {
          var t = ev && ev.target;
          if (!(t && t.closest && (t.closest('#topOverflow') || t.closest('#btnMore')))) d.open = false;
        }
      } catch (e) {}
    }, true);
    /* observe layer opens -> kill toasts + dock */
    try {
      var layers = $('#layers');
      if (layers && W.MutationObserver) {
        var obs = new W.MutationObserver(function () { Learn.killRetryToasts(); Learn.VV.attachDock(); });
        obs.observe(layers, { childList: true });
      }
    } catch (e) {}
    /* viewport observers */
    on(W, 'resize', function () { try { Learn.VV.layout(); } catch (e) {} });
    on(W, 'orientationchange', function () { try { Learn.VV.layout(); } catch (e) {} });
    try {
      if (W.visualViewport) {
        on(W.visualViewport, 'resize', function () { try { Learn.VV.layout(); } catch (e) {} });
        on(W.visualViewport, 'scroll', function () { try { Learn.VV.layout(); } catch (e) {} });
      }
    } catch (e) {}
    on(D, 'focusin', function () { setTimeout(function () { try { Learn.VV.layout(); } catch (e) {} }, 50); });
    /* persisted preset */
    try {
      var db = DB();
      if (db && db.data && db.data.settings) {
        if (!db.data.settings.contrastPreset) {
          db.data.settings.contrastPreset = 'balanced';
          if (db.data.settings.videoDim === 18) { db.data.settings.videoDim = 34; var lw = (core() && core().LiveWallpaper); if (lw && lw.setDim) lw.setDim(34); }
          db.save();
        }
        try { D.documentElement.setAttribute('data-v58-preset', db.data.settings.contrastPreset); } catch (e) {}
      }
    } catch (e) {}
  }

  function boot() {
    if (!D || !core()) {
      Learn._bootTries = (Learn._bootTries || 0) + 1;
      if (Learn._bootTries < 250) setTimeout(boot, 60);
      return;
    }
    try {
      /* styles for dynamic widgets */
      var st = D.createElement('style');
      st.id = 'sdpLearnCss';
      st.textContent = [
        '.v58-coach{margin:10px 0;padding:10px 12px;border-radius:var(--v58-r-sm);border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05)}',
        '.v58-coach h3{font-size:.92rem;margin-bottom:6px}',
        '.v58-coach-head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;padding:3px 0;font-size:.86rem}',
        '.v58-coach-note{opacity:.85;font-size:.76rem}',
        '.v58-del{text-decoration:line-through;color:#ff7286}.v58-del b{font-size:.66rem}',
        '.v58-ins{color:#5cd0f4;font-weight:700}',
        '.v58-swap{background:rgba(255,114,134,.18);border-radius:4px;padding:0 2px;color:#ffb3bd}',
        '.v58-coach.hidden{display:none!important}',
        '.v58-selfcheck{margin-top:12px}',
        '.v58-selfrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.07)}',
        '.v58-selfword{font-size:.86rem;min-width:0}',
        '.v58-selfbtns{display:flex;gap:6px}.v58-selfbtns .btn{min-height:40px!important;padding:4px 10px;font-size:.72rem}',
        '.v58-syllables{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:48;display:flex;gap:6px;pointer-events:none}',
        '.v58-syllables.hidden{display:none!important}',
        '.v58-syl-chip{padding:6px 12px;border-radius:999px;background:rgba(6,10,22,.9);border:1px solid rgba(255,255,255,.18);color:#dbe7ff;font-weight:700;font-size:.92rem;transition:all .18s var(--v58-spring)}',
        '.v58-syl-chip.on{background:linear-gradient(135deg,#5cd0f4,#3ce0b8);color:#062530;transform:translateY(-2px) scale(1.06);box-shadow:0 8px 20px rgba(60,224,184,.45)}',
        '.v58-orb-halo{position:absolute;inset:-8px;border-radius:50%;pointer-events:none;border:2px solid rgba(103,232,249,.55);box-shadow:0 0 18px rgba(103,232,249,.45);opacity:0;transform:scale(1);z-index:1}',
        '.v58-context-card{margin-bottom:12px}',
        '.v58-context-sentence{font-size:1.12rem;font-weight:700;line-height:1.9;margin:8px 0}',
        '.v58-context-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}',
        '.v58-context-typed{display:flex;gap:8px;flex-wrap:wrap}',
        '.v58-context-typed input{flex:1 1 160px;min-height:48px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:var(--fg)}',
        '.pv-line{display:flex;gap:6pt;align-items:flex-end;margin:3pt 0}',
        '.pv-line span{min-width:16pt;font-size:9.5pt}',
        '.pv-line i{flex:1;border-bottom:1px solid #666;height:16pt;display:block}',
        'body[data-perf=lite] .v58-orb-halo{display:none!important}'
      ].join('\n');
      (D.head || D.documentElement).appendChild(st);
    } catch (e) {}
    hookScreens();
    hookLang();
    hookResults();
    hookEng();
    hookSpeech();
    hookWallpaper();
    wireStatic();
    try { Learn.regroupOverflow(); } catch (e) {}
    try { Learn.syncRail(); Learn.syncWeakBadge(); Learn.syncOfflineRow(); Learn.VV.layout(); Learn.updateGauge(); } catch (e) {}
    try {
      var s = Screens();
      if (s && s.home) { /* refresh widgets once more after first paint */ setTimeout(function () { try { Learn.syncRail(); } catch (e) {} }, 250); }
    } catch (e) {}
  }
  if (D && D.readyState === 'loading') on(D, 'DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
/* ============================================================================
   Smart Dictation Player — v59 / 8.0.0
   Human-Scale Spacious Design System, SDPPerfGuard, one unified UI.applyLang()
   engine, the Full-English dictionary cards and every learning-tool fix (F1-F8).

   Everything v59 needs lives in THIS file, so index.html adds zero bytes of CSS
   and stays far below its byte budget. Strict ES5: var + function only.
   ========================================================================== */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : null;
  if (!W) return;
  var D = W.document;
  if (!D) return;
  var Learn = W.SDPLearning;
  if (!Learn) { Learn = W.SDPLearning = {}; }

  var SINHALA = /[\u0D80-\u0DFF]/;
  var SINHALA_RUN = /[\u0D80-\u0DFF][\u0D80-\u0DFF\u200D ]*/g;

  function core() { return W.SDPCore || null; }
  function UI() { var c = core(); return c && c.UI; }
  function DB() { var c = core(); return c && c.DB; }
  function Lib() { var c = core(); return c && c.Lib; }
  function Eng() { var c = core(); return c && c.Eng; }
  function Screens() { var c = core(); return c && c.Screens; }
  function Speech() { var c = core(); return c && c.Speech; }
  function Util() { var c = core(); return c && c.U; }
  function $(sel, root) { try { return (root || D).querySelector(sel); } catch (e) { return null; } }
  function $$(sel, root) { try { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); } catch (e) { return []; } }
  function el(tag, cls, txt) {
    var n = D.createElement(tag || 'div');
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function on(node, ev, fn, capture) {
    if (!node || !node.addEventListener) return;
    var passive = /^(scroll|touchstart|touchmove|wheel|mousewheel)$/i.test(String(ev));
    try { node.addEventListener(ev, fn, passive ? { passive: true, capture: !!capture } : !!capture); }
    catch (e) { try { node.addEventListener(ev, fn, !!capture); } catch (e2) {} }
  }
  function toast(msg, opts) { try { var u = UI(); if (u && u.toast) u.toast(msg, opts || {}); } catch (e) {} }
  function guard(fn, where) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (err) { try { var c = core(); if (c && c.Errors) c.Errors.report(err, where); } catch (e) {} return undefined; }
    };
  }
  function norm(w) {
    return String(w == null ? '' : w).toLowerCase().split('/')[0].replace(/[^a-z\u0D80-\u0DFF']/g, '').trim();
  }
  function lang() {
    try { var db = DB(); return (db && db.data && db.data.settings && db.data.settings.lang) === 'si' ? 'si' : 'en'; }
    catch (e) { return 'en'; }
  }
  function T(en, si) { return lang() === 'si' ? si : en; }
  function tag(node, en, si) {
    if (!node) return node;
    try { node.setAttribute('data-v58-en', en); if (si != null) node.setAttribute('data-v58-si', si); node.textContent = T(en, si); } catch (e) {}
    return node;
  }
  function settings() { try { return DB().data.settings; } catch (e) { return {}; } }

  var V59 = Learn.v59 = Learn.v59 || {};
  V59.version = '8.0.0';
  V59.cssCleanup = { removedRules: 0, removedDecls: 0, scanned: 0 };
  V59.puritySweeps = 0;
  V59.dictCardCount = 0;
  V59.ready = false;

  /* ==========================================================================
     3A. Runtime CSS cleanup + the v59 Human-Scale Spacious Design System
     ========================================================================== */

  /* Split a stylesheet into top-level rule chunks with balanced braces. */
  function splitRules(css) {
    var out = [], i = 0, n = css.length, depth = 0, start = 0, preEnd = -1;
    while (i < n) {
      var ch = css.charAt(i);
      if (ch === '{') { if (depth === 0) preEnd = i; depth++; }
      else if (ch === '}') {
        if (depth > 0) depth--;
        if (depth === 0 && preEnd >= 0) {
          out.push({ prelude: css.slice(start, preEnd), body: css.slice(preEnd + 1, i) });
          start = i + 1; preEnd = -1;
        }
      }
      i++;
    }
    if (start < n) out.push({ prelude: '', body: css.slice(start) });
    return out;
  }

  var CRUSH_MQ = /@media[^{]*max-width\s*:\s*560px/i;
  var BASE_RULE = /\.modal|\.wordcard|\.topbar|#tabbar|\.wrow/;

  function cleanSheet(css) {
    var rules = splitRules(String(css || '')), i, r, pre, body, drops = 0, out = [];
    for (i = 0; i < rules.length; i++) {
      r = rules[i];
      pre = String(r.prelude || '');
      body = String(r.body || '');
      if (!pre) { out.push(pre + '{' + body + '}'); continue; }
      /* (a) the hero-crushing 560px media block */
      if (CRUSH_MQ.test(pre)) { V59.cssCleanup.removedRules++; drops++; continue; }
      var low = pre.toLowerCase().replace(/\s+/g, ' ');
      /* (b) .tiny{font-size:11px!important} — text below 14px is banned */
      if (/(^|,|\s)\.tiny(\s*,|\s*$)/.test(low) && /font-size\s*:\s*1[01]px/i.test(body)) {
        V59.cssCleanup.removedRules++; drops++; continue;
      }
      /* (c) Tier-A glass blur on chips / tiles / soft buttons */
      if (/(^|,|\s)\.(chip|tile|btn|btn-soft)(\s*,|\s*$)/.test(low)) {
        body = body.replace(/(^|;)\s*(?:-webkit-)?backdrop-filter\s*:\s*var\(--v58-glass-blur\)[^;}]*/gi, function () { V59.cssCleanup.removedDecls++; return ''; });
      }
      /* (d) the base overdraw rule that blurred every card, button and row */
      body = body.replace(/(^|;)\s*(?:-webkit-)?backdrop-filter\s*:\s*var\(--bd\)[^;}]*/gi, function () { V59.cssCleanup.removedDecls++; return ''; });
      if (BASE_RULE.test(low) && /backdrop-filter\s*:\s*var\(--v58-glass-blur\)/i.test(body)) {
        body = body.replace(/(^|;)\s*(?:-webkit-)?backdrop-filter\s*:\s*var\(--v58-glass-blur\)[^;}]*/gi, function () { V59.cssCleanup.removedDecls++; return ''; });
      }
      /* (e) any surviving sub-14px font floor inside these legacy sheets */
      body = body.replace(/font-size\s*:\s*(?:0?\.[0-7]\d*rem|1[0-3](?:\.\d+)?px)/gi, function (m0) {
        V59.cssCleanup.removedDecls++;
        return /px/i.test(m0) ? 'font-size:14px' : 'font-size:.875rem';
      });
      if (!body.replace(/[\s;]/g, '')) { V59.cssCleanup.removedRules++; drops++; continue; }
      out.push(pre + '{' + body + '}');
    }
    V59.cssCleanup.scanned++;
    return out.join('\n');
  }

  var V59_CSS = [
    ':root{',
    '  --fs-body:16px;--fs-meta:14px;--fs-ipa:19px;--fs-def:17px;--fs-tile:17px;',
    '  --fs-hero:clamp(24px,6vw,36px);--fs-word:clamp(32px,9vw,52px);',
    '  --sp-card:22px;--sp-gap:16px;--sp-btn:12px;',
    '  --v59-card:rgba(13,20,38,.94);--v59-card-2:rgba(18,27,50,.92);',
    '  --v58-glass-blur:blur(14px) saturate(1.4);',
    '  --v59-line:rgba(255,255,255,.14);--v59-shadow:0 14px 34px -14px rgba(2,6,23,.7);',
    '}',
    /* strictly <= 4 blurred elements on screen: .topbar, #tabbar and open scrims.
       The universal :not() chain outranks every legacy !important blur rule. */
    ':root body *:not(.topbar):not(#tabbar):not(.scrim):not(#aboutCreditsScrim):not(.v58-scrim){',
    '  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;',
    '}',
    ':root body .tile,:root body .wrow,:root body .listrow,:root body .card,:root body .sheet,',
    ':root body .modal,:root body .v58-tile,:root body .v58-preset,:root body .v58-credit-card,',
    ':root body #credit,:root body #homeHero{',
    '  background:var(--v59-card-2)!important;border:1px solid var(--v59-line)!important;',
    '  box-shadow:var(--v59-shadow)!important;',
    '}',
    /* buttons and chips keep their liquid gradients — only the blur is gone */
    ':root body .btn,:root body .btn-soft,:root body .chip{',
    '  background-color:rgba(18,27,50,.86)!important;border:1px solid var(--v59-line)!important;',
    '  box-shadow:var(--v59-shadow)!important;',
    '}',
    '.topbar,#tabbar{backdrop-filter:blur(14px) saturate(1.4)!important;-webkit-backdrop-filter:blur(14px) saturate(1.4)!important}',
    '.scrim,#aboutCreditsScrim,.v58-scrim{backdrop-filter:blur(14px) saturate(1.4)!important;-webkit-backdrop-filter:blur(14px) saturate(1.4)!important}',
    /* a blurred bar is its own stacking context, so lift it above #tabbar (z 50)
       and keep the overflow popover clear of the bottom bar */
    '.topbar{position:relative;z-index:60!important}',
    '#topOverflow .overflow-menu{z-index:120!important;max-height:calc(100vh - 190px)!important;padding-bottom:16px!important}',
    '.top-controls .btn,.top-controls .chip{min-height:40px!important;padding:4px 8px!important}',
    '#btnLang{min-height:40px!important}',
    'body[data-perf="lite"] *,body[data-perf="lite"] .topbar,body[data-perf="lite"] #tabbar,body[data-perf="lite"] .scrim{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    /* typography floors: nothing below 14px anywhere in the chrome */
    '.tiny,.small,.v58-menu-group-title,.v58-credit-card i,.v58-railrow .badge,.chip,.lbl,',
    '#tabbar button span,.top-controls .chip,#contrastReadout{font-size:var(--fs-meta)!important}',
    /* spacious hero: 360x800 phone AND 1366x768 desktop above the fold */
    '#homeHero.hero{padding:20px!important}',
    '#homeHero .kicker{font-size:12px!important;letter-spacing:.08em!important;margin-bottom:6px!important}',
    '#homeHero h1,#homeTitle{font-size:clamp(23px,5.5vw,34px)!important;line-height:1.22!important;margin:6px 0!important}',
    '#homeHero #homeSub{font-size:15px!important;line-height:1.5!important;white-space:normal!important;overflow:visible!important;text-overflow:unset!important}',
    '#btnStart{min-height:56px!important;font-size:17px!important;font-weight:700!important}',
    '.seg#segMode button{min-height:48px!important;font-size:15px!important}',
    /* large practice bento tiles */
    '.v58-bento{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}',
    '.v58-tile{min-height:102px!important;padding:15px 14px!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;align-items:flex-start!important;gap:8px!important}',
    '.v58-tile .v58-tile-ico{font-size:28px!important;line-height:1!important}',
    '.v58-tile-t b{font-size:17px!important;font-weight:800!important;display:block!important}',
    '.v58-tile-t i{font-size:14px!important;font-style:normal!important;opacity:.88!important;display:block!important;margin-top:3px!important}',
    '@media (min-width:1024px){',
    '  #homeHero.hero{padding:20px 24px!important}',
    '  #homeHero h1,#homeTitle{font-size:clamp(26px,2.4vw,34px)!important}',
    '  .v58-workspace{display:grid!important;grid-template-columns:minmax(0,1fr) 336px!important;gap:18px!important;align-items:start!important}',
    '  .v58-tile{min-height:106px!important}',
    '  #v58KbdHud{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}',
    '}',
    /* dictation player, context mode and print sheet */
    '#ansInput{font-size:20px!important;min-height:52px!important}',
    '.v58-context-sentence{font-size:19px!important;line-height:1.6!important}',
    '.v58-context-choices .btn{min-height:52px!important;font-size:16px!important}',
    '.v58-syl-chip{font-size:16px!important}',
    '.pv-table{font-size:10.5pt!important}.pv-table th{font-size:9.5pt!important}',
    '.listrow,.wrow,.v59-dict-card{contain-intrinsic-size:1px 110px}',
    /* ---- v59 Full-English word card ---- */
    '.v59-dict-card{padding:16px 16px 14px;margin:10px 0;border-radius:18px;background:var(--v59-card);border:1px solid var(--v59-line);box-shadow:var(--v59-shadow)}',
    '.v59-dict-head{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px}',
    '.v59-idx{font-size:14px;font-weight:800;opacity:.72;min-width:26px}',
    '.v59-word{font-size:22px;font-weight:800;margin:0;letter-spacing:.01em}',
    '.v59-ipa{font-size:19px!important;color:#7fe6ff;background:rgba(60,224,184,.12);border:1px solid rgba(60,224,184,.34);border-radius:999px;padding:2px 10px}',
    '.v59-pos{font-size:14px;opacity:.85;border:1px solid var(--v59-line);border-radius:8px;padding:1px 7px}',
    '.v59-def{font-size:17px;line-height:1.55;margin:9px 0 6px}',
    '.v59-ex{font-size:17px;font-style:italic;line-height:1.5;opacity:.92;margin:0 0 10px}',
    '.v59-actions{display:flex;flex-wrap:wrap;gap:8px}',
    '.v59-actions .btn{min-height:44px;font-size:15px}',
    '.v59-si-text{display:block;margin-top:8px;font-size:17px;line-height:1.6;color:#ffd479}',
    '.v59-si-chip[aria-expanded="false"]+.v59-si-text{display:none}',
    '.v59-dict-filters{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 10px}',
    '.v59-dict-filters .btn{min-height:44px;font-size:15px}',
    '.v59-dict-filters .btn[aria-pressed="true"]{background:linear-gradient(135deg,#5cd0f4,#3ce0b8)!important;color:#04222c!important;font-weight:800}',
    /* paper self-check + confirmation states */
    '.v58-selfcheck .v58-selfrow{padding:10px 0}',
    '.v58-selfrow .v59-selfmeta{display:block;font-size:14px;opacity:.85;margin-top:3px}',
    '.v59-context-ok{margin:10px 0;padding:12px 14px;border-radius:14px;background:rgba(60,224,184,.16);border:1px solid rgba(60,224,184,.45);color:#b8ffe9;font-weight:700;font-size:16px}',
    '.v59-context-hint{font-size:15px;line-height:1.6}',
    '.v59-mic-panel{margin-top:12px;padding:12px;border-radius:14px;background:var(--v59-card);border:1px solid var(--v59-line)}',
    '.v59-mic-panel .btn{min-height:48px;font-size:15px}',
    '.v59-print-note{font-size:12px}'
  ].join('\n');

  function injectCss() {
    try {
      if ($('#sdpV59Css')) return;
      var st = D.createElement('style');
      st.id = 'sdpV59Css';
      st.textContent = V59_CSS;
      (D.head || D.documentElement).appendChild(st);
    } catch (e) {}
  }

  V59.cleanLegacyCss = guard(function () {
    var ids = ['sdpV57Css', 'sdpV58Css'], i;
    for (i = 0; i < ids.length; i++) {
      try {
        var node = D.getElementById(ids[i]);
        if (!node || node.__v59cleaned) continue;
        var next = cleanSheet(node.textContent || '');
        node.textContent = next;
        node.__v59cleaned = true;
      } catch (e) {}
    }
    return V59.cssCleanup;
  }, 'v59.cleanLegacyCss');

  /* Every practice tile carries a bold title AND a one-line subtitle. */
  var BENTO_SUBS = {
    flash: ['Flip & learn all 30 words', 'වචන 30 ම පෙරළා ඉගෙන ගන්න'],
    quiz: ['Pick the right meaning', 'නිවැරදි අර්ථය තෝරන්න'],
    audio: ['Listen to the full list', 'සම්පූර්ණ ලැයිස්තුව අසන්න'],
    weak: ['Drill until they graduate', 'දියුණු වන තුරු පුහුණු වන්න']
  };
  V59.ensureBentoTiles = guard(function () {
    var tiles = $$('.v58-tile[data-v58-practice]'), i;
    for (i = 0; i < tiles.length; i++) {
      try {
        var kind = tiles[i].getAttribute('data-v58-practice');
        var def = BENTO_SUBS[kind];
        if (!def) continue;
        var wrap = $('.v58-tile-t', tiles[i]) || tiles[i];
        var sub = $('i', wrap);
        if (!sub) { sub = el('i'); wrap.appendChild(sub); }
        if (!sub.getAttribute('data-v58-en')) tag(sub, def[0], def[1]);
      } catch (e) {}
    }
  }, 'v59.ensureBentoTiles');

  /* ==========================================================================
     3B. One unified UI.applyLang() engine (EN is pure English, SI is full Sinhala)
     ========================================================================== */

  function isAllowedSinhala(node) {
    var el2 = node && node.parentElement;
    while (el2 && el2 !== D.body) {
      try {
        if (el2.id === 'btnLang') return true;
        var cls = String(el2.className || '');
        if (/\bv59-si-chip\b/.test(cls) || /\bv59-si-text\b/.test(cls)) return true;
        if (el2.getAttribute && el2.getAttribute('data-v59-sinhala') === '1') return true;
        if (/^(SCRIPT|STYLE|TEMPLATE)$/.test(el2.tagName)) return true;
      } catch (e) {}
      el2 = el2.parentElement;
    }
    return false;
  }

  /* Belt and braces: if any legacy string still carries Sinhala while English
     is active, strip it so the screen is provably 100% English. */
  V59.puritySweep = guard(function () {
    var l = lang();
    if (l !== 'en') return 0;
    var walker, count = 0, nodes = [];
    try {
      walker = D.createTreeWalker(D.body, 4 /* SHOW_TEXT */, null, false);
      while (walker.nextNode()) {
        var n = walker.currentNode;
        if (!n || !SINHALA.test(n.nodeValue || '')) continue;
        if (isAllowedSinhala(n)) continue;
        nodes.push(n);
      }
    } catch (e) { return 0; }
    for (var i = 0; i < nodes.length; i++) {
      var txt = String(nodes[i].nodeValue || '');
      var next = txt.replace(SINHALA_RUN, '').replace(/\s*[\/·|]\s*(?=[\s]*$)/, '').replace(/\s{2,}/g, ' ');
      nodes[i].nodeValue = next.replace(/^[\s\/·|]+/, '').replace(/[\s\/·|]+$/, '');
      count++;
    }
    if (count) V59.puritySweeps++;
    return count;
  }, 'v59.puritySweep');

  V59.syncI18n = guard(function () {
    var l = lang(), i, nodes, btn;
    try {
      D.documentElement.setAttribute('lang', l);
      D.documentElement.setAttribute('data-lang', l);
    } catch (e) {}
    nodes = $$('[data-v58-en]');
    for (i = 0; i < nodes.length; i++) {
      try {
        var en = nodes[i].getAttribute('data-v58-en');
        var si = nodes[i].getAttribute('data-v58-si');
        nodes[i].textContent = (l === 'si' && si) ? si : en;
      } catch (e) {}
    }
    nodes = $$('[data-en]');
    for (i = 0; i < nodes.length; i++) {
      try {
        var en2 = nodes[i].getAttribute('data-en');
        var si2 = nodes[i].getAttribute('data-si');
        if (en2 != null) nodes[i].textContent = (l === 'si' && si2) ? si2 : en2;
      } catch (e) {}
    }
    btn = $('#btnLang');
    if (btn) {
      try {
        btn.textContent = l === 'si' ? 'EN' : 'සිංහල';
        btn.setAttribute('aria-pressed', l === 'si' ? 'true' : 'false');
        btn.setAttribute('aria-label', l === 'si' ? 'Switch to English' : 'සිංහලට මාරු කරන්න');
      } catch (e) {}
    }
    V59.ensureBentoTiles();
    V59.refreshDynamic();
    if (l === 'en') V59.puritySweep();
  }, 'v59.syncI18n');

  function installLangEngine() {
    var u = UI();
    if (!u || u.__v59Lang) return;
    var orig = u.applyLang;
    u.applyLang = function () {
      var out;
      try { if (orig) out = orig.apply(this, arguments); } catch (e) {}
      try { V59.syncI18n(); } catch (e) {}
      return out;
    };
    u.__v59Lang = true;
  }

  /* ==========================================================================
     3C. Full-English dictionary cards + filter tabs
     ========================================================================== */

  function allWordMap() {
    var map = {}, lists = [], i, j, ws;
    try { lists = (DB() && DB().data && DB().data.lists) || []; } catch (e) { lists = []; }
    for (i = 0; i < lists.length; i++) {
      ws = (lists[i] && lists[i].words) || [];
      for (j = 0; j < ws.length; j++) if (ws[j] && ws[j].w) map[norm(ws[j].w)] = ws[j];
    }
    return map;
  }
  function currentList() {
    try {
      var lib = Lib();
      var cur = lib && lib.current && lib.current();
      if (cur && cur.words && cur.words.length) return cur;
    } catch (e) {}
    var map = allWordMap(), out = [], k;
    for (k in map) if (Object.prototype.hasOwnProperty.call(map, k)) out.push(map[k]);
    return { name: 'Session 8', words: out };
  }
  function sessionWords() { return (currentList().words || []).slice(); }
  /* The embedded sample list ships without a part of speech, so v59 knows the
     adjective set of this session and falls back to the UK POS table after it. */
  var ADJ_WORDS = ('afraid amazed amusing annoyed anxious ashamed awesome boring brilliant ' +
    'challenging charming confident confusing cruel curious delighted depressed disappointed ' +
    'embarrassing enjoyable excellent excited fantastic favourite frightened friendly generous ' +
    'guilty healthy hungry').split(' ');
  function posFor(ob, embeddedPos) {
    if (ob && ob.pos) return ob.pos;
    var k = norm(ob && ob.w);
    if (k && ADJ_WORDS.indexOf(k) >= 0) return 'adj.';
    return embeddedPos || '';
  }
  function enrichWord(ob) {
    if (!ob || !ob.w) return ob;
    var pos = posFor(ob, '');
    if (ob.p && pos && ob.m) return mergeWord(ob, { pos: pos });
    try {
      var c = core();
      var d = c && c.Dict;
      if (d && d.embedded) {
        var e = d.embedded(ob.w);
        if (e) return mergeWord({ w: ob.w, p: e.ipa || e.phon || '', pos: posFor(ob, e.pos), m: e.def || '', s: e.ex || '', si: ob.si, audio: e.audio || ob.audio }, ob);
      }
    } catch (er) {}
    return mergeWord(ob, { pos: pos });
  }
  function wordObjFor(w) {
    var map = allWordMap();
    return enrichWord(map[norm(w)] || { w: String(w || '') });
  }
  function weakSet() {
    var set = {}, w = Learn.loadWeakWords ? Learn.loadWeakWords() : {};
    for (var k in w) if (Object.prototype.hasOwnProperty.call(w, k)) set[k] = w[k];
    return set;
  }
  function masteredSet() {
    var set = {}, m = Learn.loadMasteredWords ? Learn.loadMasteredWords() : {};
    for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) set[k] = m[k];
    return set;
  }

  function playWord(word, rate) {
    try {
      var sp = Speech();
      if (sp && sp.playWord) { sp.playWord(word, rate || 1, function () {}); return; }
    } catch (e) {}
    try {
      var audio = $('#ttsMasterAudio') || el('audio');
      audio.src = 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(word);
      audio.volume = Math.max(0, Math.min(1, Number(settings().volume == null ? 1 : settings().volume)));
      audio.playbackRate = rate || 1;
      var pr = audio.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (e) {}
  }

  function siChipText() { return T('🇱🇰 Sinhala meaning', '🇱🇰 සිංහල අර්ථය'); }

  function mergeWord(base, over) {
    var out = {}, k;
    base = base || {};
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    over = over || {};
    for (k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      var v = over[k];
      if (v == null || v === '') continue;
      out[k] = v;
    }
    return out;
  }

  function buildCard(word, index) {
    var original = (word && typeof word === 'object' && word.w) ? word : { w: word };
    var w = mergeWord(wordObjFor(original.w), original);
    var card = el('div', 'v59-dict-card');
    card.setAttribute('data-word', w.w || '');
    var head = el('div', 'v59-dict-head');
    head.appendChild(el('span', 'v59-idx', '#' + index));
    var h = el('h3', 'v59-word', String(w.w || ''));
    head.appendChild(h);
    if (w.p) head.appendChild(el('span', 'v59-ipa', '/' + String(w.p) + '/'));
    if (w.pos) head.appendChild(el('span', 'v59-pos', String(w.pos)));
    card.appendChild(head);
    if (w.m) card.appendChild(el('p', 'v59-def', String(w.m)));
    if (w.s) card.appendChild(el('p', 'v59-ex', '“' + String(w.s) + '”'));
    var actions = el('div', 'v59-actions');
    var listen = el('button', 'btn sm soft', T('🔊 Listen', '🔊 අසන්න'));
    listen.type = 'button';
    listen.setAttribute('aria-label', 'Listen to ' + (w.w || ''));
    on(listen, 'click', function () { playWord(w.w, 1); });
    var slow = el('button', 'btn sm soft', '🐢 0.72×');
    slow.type = 'button';
    slow.setAttribute('aria-label', 'Play ' + (w.w || '') + ' slowly');
    on(slow, 'click', function () { playWord(w.w, 0.72); });
    var mic = el('button', 'btn sm soft', T('🎤 Speak & Compare', '🎤 කථා කර සසඳන්න'));
    mic.type = 'button';
    on(mic, 'click', function () { Learn.recordAndCompare(w); });
    actions.appendChild(listen); actions.appendChild(slow); actions.appendChild(mic);
    var si = String(w.si || '');
    if (si) {
      var chip = el('button', 'btn sm soft v59-si-chip');
      chip.type = 'button';
      var expanded = lang() === 'si';
      chip.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      chip.textContent = lang() === 'si' ? si : siChipText();
      var reveal = el('span', 'v59-si-text', si);
      reveal.setAttribute('data-v59-sinhala', '1');
      reveal.style.display = expanded ? 'block' : 'none';
      chip.setAttribute('aria-controls', '');
      on(chip, 'click', function () {
        var openNow = chip.getAttribute('aria-expanded') === 'true';
        chip.setAttribute('aria-expanded', openNow ? 'false' : 'true');
        reveal.style.display = openNow ? 'none' : 'block';
        chip.textContent = openNow ? siChipText() : si;
        if (openNow && lang() === 'si') chip.textContent = si;
      });
      actions.appendChild(chip);
      card.appendChild(actions);
      card.appendChild(reveal);
    } else {
      card.appendChild(actions);
    }
    return card;
  }

  function dictFilters() {
    var host = $('#v59DictFilters');
    if (host) return host;
    var listBox = $('#dictList');
    if (!listBox || !listBox.parentNode) return null;
    host = el('div', 'v59-dict-filters');
    host.id = 'v59DictFilters';
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Word filters');
    var screens = Screens();
    var filter = (screens && screens.v59Filter) || 'all';
    var weakN = Learn.weakCount ? Learn.weakCount() : 0;
    var mN = 0, mk, mm = Learn.loadMasteredWords ? Learn.loadMasteredWords() : {};
    for (mk in mm) if (Object.prototype.hasOwnProperty.call(mm, mk)) mN++;
    var defs = [
      ['all', T('All 30 Words (' + sessionWords().length + ')', 'වචන 30 ම (' + sessionWords().length + ')')],
      ['weak', '⭐ ' + T('My Weak Words (' + weakN + ')', 'මගේ දුර්වල වචන (' + weakN + ')')],
      ['mastered', '✓ ' + T('Mastered (' + mN + ')', 'දියුණු වූ (' + mN + ')')]
    ];
    for (var i = 0; i < defs.length; i++) {
      (function (key, label) {
        var b = el('button', 'btn sm soft', label);
        b.type = 'button';
        b.id = 'v59Filter-' + key;
        b.setAttribute('data-v59-filter', key);
        b.setAttribute('aria-pressed', filter === key ? 'true' : 'false');
        on(b, 'click', function () {
          var s = Screens();
          if (s) s.v59Filter = key;
          V59.renderDictCards();
        });
        host.appendChild(b);
      })(defs[i][0], defs[i][1]);
    }
    listBox.parentNode.insertBefore(host, listBox);
    return host;
  }

  V59.renderDictCards = guard(function () {
    var host = $('#dictList');
    if (!host) return 0;
    var screens = Screens();
    var filter = (screens && screens.v59Filter) || 'all';
    var q = '';
    try { q = String(($('#dictSearch') || {}).value || '').toLowerCase().trim(); } catch (e) {}
    var words = [], i, k;
    if (filter === 'weak') {
      var weak = weakSet();
      for (k in weak) if (Object.prototype.hasOwnProperty.call(weak, k)) words.push(wordObjFor(k));
    } else if (filter === 'mastered') {
      var mast = masteredSet();
      for (k in mast) if (Object.prototype.hasOwnProperty.call(mast, k)) words.push(wordObjFor(k));
    } else {
      words = sessionWords();
    }
    var forCard = [];
    for (i = 0; i < words.length; i++) forCard.push(words[i]);
    if (q) {
      var filtered = [];
      for (i = 0; i < words.length; i++) {
        var ob = wordObjFor(words[i] && (words[i].w || words[i]));
        var hay = [ob.w, ob.m, ob.si, ob.pos].join(' ').toLowerCase();
        if (hay.indexOf(q) >= 0) filtered.push(ob);
      }
      words = filtered;
    }
    if (!words.length) {
      dictFilters();
      return 0;
    }
    /* rebuild the filter strip (counts change as words graduate) */
    var strip = $('#v59DictFilters');
    if (strip && strip.parentNode) strip.parentNode.removeChild(strip);
    host.innerHTML = '';
    for (i = 0; i < words.length; i++) host.appendChild(buildCard(forCard[i], i + 1));
    if (filter === 'all') {
      var note = el('p', 'small muted', T('All 30 words of this session, with UK IPA, English meaning and an example sentence.', ''));
      host.appendChild(note);
    }
    dictFilters();
    V59.dictCardCount = words.length;
    return words.length;
  }, 'v59.renderDictCards');

  function hookDict() {
    var s = Screens();
    if (!s || s.__v59Dict || typeof s.dict !== 'function') return;
    var orig = s.dict;
    s.dict = guard(function () {
      var out = orig.apply(this, arguments);
      try {
        if (!s.v59Filter) s.v59Filter = 'all';
        V59.renderDictCards();
      } catch (e) {}
      return out;
    }, 'v59.screens.dict');
    s.__v59Dict = true;
  }

  V59.refreshDynamic = guard(function () {
    try {
      var u = UI(), s = Screens();
      var tab = (u && u.tab) || (s && s.tab) || '';
      if (tab === 'dict') V59.renderDictCards();
    } catch (e) {}
    try {
      var sheet = $('#v58SelfCheck');
      if (sheet && sheet.__v59refresh) sheet.__v59refresh();
    } catch (e) {}
  }, 'v59.refreshDynamic');

  /* ==========================================================================
     3D-1. F3 Paper self-check (30 rows, live #v58SelfScore + #resSummary)
     ========================================================================== */

  function summaryBase(sum) {
    var base = '';
    try { base = sum.getAttribute('data-v59-base'); } catch (e) {}
    if (!base) {
      base = String(sum.textContent || '');
      var cut = base.indexOf(' · self-check:');
      if (cut >= 0) base = base.slice(0, cut);
      try { sum.setAttribute('data-v59-base', base); } catch (e) {}
    }
    return base;
  }

  function writeSummary(correct, total) {
    var sum = $('#resSummary');
    if (!sum) return '';
    var base = summaryBase(sum);
    var pct = Math.round(100 * correct / Math.max(1, total));
    var text = base + ' · self-check: ' + correct + '/' + total + ' (' + pct + '%)';
    try { sum.textContent = text; } catch (e) {}
    return text;
  }

  Learn.renderPaperSelfCheck = guard(function (result, layerHost) {
    if (!result || !result.rows || !result.rows.length || !layerHost) return null;
    var existing = $('#v58SelfCheck', layerHost);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var box = el('div', 'v58-selfcheck glass card');
    box.id = 'v58SelfCheck';
    var head = el('div', 'spread');
    var title = el('h3', null, '🧾 ' + T('Paper self-check', 'කොළ ස්වයං පරීක්ෂාව'));
    var chip = el('span', 'chip', '0 / ' + result.rows.length + ' · 0%');
    chip.id = 'v58SelfScore';
    head.appendChild(title); head.appendChild(chip);
    box.appendChild(head);
    var note = el('p', 'tiny muted', 'Tap ✓ Got It if you wrote the word correctly, ✗ Missed It if you did not. Misses feed the weak-words bank — anonymous, on this phone only.');
    box.appendChild(note);
    var state = [], rows = result.rows, i;
    for (i = 0; i < rows.length; i++) state[i] = rows[i] && rows[i].state === 'ok' ? 'ok' : 'miss';
    function refresh() {
      var ok = 0, j;
      for (j = 0; j < state.length; j++) if (state[j] === 'ok') ok++;
      var pct = Math.round(100 * ok / Math.max(1, state.length));
      chip.textContent = ok + ' / ' + state.length + ' · ' + pct + '%';
      chip.setAttribute('aria-label', 'Self-check score ' + ok + ' of ' + state.length);
      result.score = ok;
      result.percent = pct;
      Learn._selfCheck = { ok: ok, total: state.length };
      writeSummary(ok, state.length);
    }
    box.__v59refresh = refresh;
    for (i = 0; i < rows.length; i++) {
      (function (row, idx) {
        var obj = (row && row.w) || wordObjFor(row && row.word);
        var r = el('div', 'v58-selfrow');
        var w = el('span', 'v58-selfword');
        var b = el('b', null, '✗');
        w.appendChild(b);
        w.appendChild(D.createTextNode(' ' + String((row && row.word) || (obj && obj.w) || '')));
        if (obj && obj.p) w.appendChild(el('span', 'chip', '/' + obj.p + '/'));
        if (obj && obj.m) w.appendChild(el('span', 'v59-selfmeta', String(obj.m)));
        if (obj && obj.si && lang() === 'si') w.appendChild(el('span', 'v59-selfmeta', String(obj.si)));
        var btns = el('span', 'v58-selfbtns');
        var okB = el('button', 'btn sm soft', '✓ ' + T('Got It', 'නිවැරදියි'));
        okB.type = 'button'; okB.setAttribute('aria-label', 'Got it: ' + ((row && row.word) || ''));
        var missB = el('button', 'btn sm soft', '✗ ' + T('Missed It', 'වැරදියි'));
        missB.type = 'button'; missB.setAttribute('aria-label', 'Missed it: ' + ((row && row.word) || ''));
        function paint() {
          var good = state[idx] === 'ok';
          b.textContent = good ? '✓' : '✗';
          try { okB.classList[good ? 'add' : 'remove']('good'); } catch (e) {}
          try { missB.classList[good ? 'remove' : 'add']('warn'); } catch (e) {}
        }
        on(okB, 'click', function () {
          state[idx] = 'ok';
          try { if (Learn.markCorrect) Learn.markCorrect((row && row.word) || (obj && obj.w) || ''); } catch (e) {}
          paint(); refresh();
        });
        on(missB, 'click', function () {
          state[idx] = 'miss';
          try { if (Learn.markMissed) Learn.markMissed((row && row.word) || (obj && obj.w) || ''); } catch (e) {}
          paint(); refresh();
        });
        btns.appendChild(okB); btns.appendChild(missB);
        r.appendChild(w); r.appendChild(btns);
        box.appendChild(r);
        paint();
      })(rows[i], i);
    }
    layerHost.appendChild(box);
    refresh();
    return box;
  }, 'v59.renderPaperSelfCheck');

  /* ==========================================================================
     3D-2. F3/D10 Print / Save the A4 study sheet – all six columns
     ========================================================================== */

  Learn.printStudySheet = guard(function () {
    var pv = $('#printview');
    if (!pv) return;
    var list = currentList();
    var db = DB();
    var sess = (db && db.data && db.data.session) || {};
    var words = list.words || [];
    var title = sess.title || list.name || 'Session 8';
    var date = sess.date || '2026-10-29';
    pv.innerHTML = '';
    var head = el('div', 'pv-head', 'CCBE Galle Branch · B1 · Session ' + (sess.no || '8') + ' · ' + date + ' · Student Name: _______________');
    pv.appendChild(head);
    pv.appendChild(el('h1', null, 'Smart Dictation Practice Sheet — ' + title));
    var sub = el('div', 'pv-sub', 'Words: ' + words.length + ' · UK IPA · part of speech · English meaning · Sinhala meaning');
    pv.appendChild(sub);
    var table = el('table', 'pv-table');
    var thead = el('thead');
    thead.innerHTML = '<tr><th>#</th><th>English Word</th><th>UK IPA</th><th>Part of Speech</th>' +
      '<th>English Meaning</th><th>Sinhala Meaning (සිංහල තේරුම)</th></tr>';
    table.appendChild(thead);
    var tb = el('tbody');
    var i, w, tr;
    for (i = 0; i < words.length; i++) {
      w = words[i] || {};
      tr = el('tr');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + String(w.w || '') + '</td><td>' +
        (w.p ? '/' + String(w.p) + '/' : '') + '</td><td>' + String(w.pos || '') + '</td><td>' +
        String(w.m || '') + '</td><td>' + String(w.si || '') + '</td>';
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    pv.appendChild(table);
    pv.appendChild(el('h2', null, 'Writing practice'));
    var lines = el('div', 'lines');
    for (i = 0; i < words.length; i++) {
      var line = el('div', 'pv-line');
      line.innerHTML = '<span>' + (i + 1) + '.</span><i></i>';
      lines.appendChild(line);
    }
    pv.appendChild(lines);
    var key = el('div', 'pv-key');
    key.appendChild(el('h2', null, 'Answer Key & Example Sentences'));
    var ol = el('ol');
    for (i = 0; i < words.length; i++) {
      w = words[i] || {};
      var li = el('li', null, String(w.w || '') + (w.p ? ' /' + w.p + '/' : '') +
        (w.pos ? ' (' + w.pos + ')' : '') + (w.m ? ' — ' + w.m : '') +
        (w.si ? ' — ' + w.si : '') + (w.s ? ' — “' + w.s + '”' : ''));
      ol.appendChild(li);
    }
    key.appendChild(ol);
    pv.appendChild(key);
    try { W.print(); } catch (e) {}
  }, 'v59.printStudySheet');

  /* ==========================================================================
     3D-3. F5 Sentence Context Mode (meaning clue, Next question, green correct)
     ========================================================================== */

  function contextStage() { return $('#pracStage'); }

  function advanceContext(screens) {
    var s = screens || Screens();
    if (!s) return;
    var words = sessionWords();
    if (!words.length) return;
    s.pracIndex = ((Number(s.pracIndex) || 0) + 1) % words.length;
    Learn.renderContextMode(s);
  }

  Learn.renderContextMode = guard(function (screens) {
    var s = screens || Screens();
    var stage = contextStage();
    var words = sessionWords();
    var count = $('#pracCount');
    if (count) count.textContent = words.length ? (((Number(s && s.pracIndex) || 0) % words.length) + 1) + ' / ' + words.length : '0 / 0';
    var chips = $$('#pracMode button'), c;
    for (c = 0; c < chips.length; c++) {
      var sel = chips[c].getAttribute('data-p') === 'context';
      chips[c].setAttribute('aria-selected', sel ? 'true' : 'false');
      chips[c].setAttribute('aria-pressed', sel ? 'true' : 'false');
    }
    if (!stage) return false;
    stage.innerHTML = '';
    if (!words.length) {
      stage.appendChild(el('p', 'muted', 'No list loaded yet.'));
      return true;
    }
    var idx = ((s && Number(s.pracIndex)) || 0) % words.length;
    var word = words[idx];
    var blank = Learn.blankSentence(word.s, word.w);
    var card = el('div', 'glass card v58-context-card');
    card.appendChild(el('div', 'tiny muted', '📖 ' + T('Sentence Context · fill the gap', 'වාක්ය සන්දර්භය · හිස් තැන පුරන්න')));
    card.appendChild(el('p', 'v58-context-sentence', blank));
    var hintText;
    if (lang() === 'si') hintText = (word.p ? '/' + word.p + '/ · ' : '') + (word.si || word.m || '');
    else hintText = (word.p ? '/' + word.p + '/ · ' : '') + (word.m || '');
    card.appendChild(el('div', 'v59-context-hint', hintText));
    stage.appendChild(card);
    var choices = [word], pool = [], i;
    for (i = 0; i < words.length; i++) if (i !== idx) pool.push(words[i]);
    pool.sort(function () { return Math.random() - 0.5; });
    for (i = 0; i < 3 && i < pool.length; i++) choices.push(pool[i]);
    choices.sort(function () { return Math.random() - 0.5; });
    var row = el('div', 'v58-context-choices');
    row.id = 'v58ContextChoices';
    for (i = 0; i < choices.length; i++) {
      (function (choice, pos) {
        var b = el('button', 'btn soft', (pos + 1) + '. ' + (choice.w || ''));
        b.type = 'button';
        on(b, 'click', function () { Learn.answerContext(word, choice, row); });
        row.appendChild(b);
      })(choices[i], i);
    }
    stage.appendChild(row);
    var typedRow = el('div', 'v58-context-typed');
    var input = el('input');
    input.type = 'text';
    input.id = 'v58ContextInput';
    input.setAttribute('aria-label', 'Type the missing word');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'none');
    input.placeholder = T('…or type the missing word', '…හෝ හිස් තැනට වචනය ටයිප් කරන්න');
    var check = el('button', 'btn pri', T('Check', 'පරීක්ෂා කරන්න'));
    check.type = 'button';
    check.id = 'v58ContextCheck';
    var speak = el('button', 'btn soft', T('🔊 Hear sentence', '🔊 වාක්යය අසන්න'));
    speak.type = 'button';
    on(speak, 'click', function () {
      try { Speech().speakStudioText(String(word.s || word.w || ''), 'en', function () {}); } catch (e) {}
    });
    on(check, 'click', function () { Learn.answerContextTyped(word, input.value, row); });
    on(input, 'keydown', function (e) {
      if (e && e.key === 'Enter') { e.preventDefault(); Learn.answerContextTyped(word, input.value, row); }
    });
    typedRow.appendChild(input); typedRow.appendChild(check); typedRow.appendChild(speak);
    stage.appendChild(typedRow);
    /* always-present primary Next question control (D3 fix) */
    var next = el('button', 'btn pri block', 'Next question →');
    next.type = 'button';
    next.id = 'v58ContextNextBtn';
    next.setAttribute('aria-label', 'Next question');
    on(next, 'click', function () { advanceContext(s); });
    stage.appendChild(next);
    Learn._contextWord = word;
    Learn._contextChoices = row;
    return true;
  }, 'v59.renderContextMode');

  function contextCorrect(word, host) {
    var box = el('div', 'v59-context-ok');
    box.id = 'v59ContextOk';
    box.textContent = '✓ ' + T('Correct!', 'නිවැරදියි!') + ' ' + String(word.w || '') + (word.p ? ' · /' + word.p + '/' : '');
    var stage = host || contextStage();
    if (stage) stage.appendChild(box);
    try { if (Learn.hideMistakeCoach) Learn.hideMistakeCoach(); } catch (e) {}
    try { if (Learn.markCorrect) Learn.markCorrect(word.w); } catch (e) {}
    try { Speech().speakStudioText(String(word.s || word.w || ''), 'en', function () {}); } catch (e) {}
    setTimeout(function () {
      try {
        if (Screens() && Screens().pracMode === 'context') advanceContext(Screens());
      } catch (e) {}
    }, 1200);
  }

  Learn.answerContext = guard(function (word, choice, row) {
    var right = norm(choice.w) === norm(word.w);
    var btns = $$('button', row), i;
    for (i = 0; i < btns.length; i++) {
      var label = norm(String(btns[i].textContent || '').replace(/^\d+\.\s*/, ''));
      var isRight = label === norm(word.w);
      try { btns[i].classList.add(isRight ? 'good' : 'soft'); } catch (e) {}
      if (!isRight && label === norm(choice.w)) { try { btns[i].classList.add('warn'); } catch (e) {} }
      if (isRight) { try { btns[i].classList.add('good'); } catch (e) {} }
    }
    if (right) { contextCorrect(word, contextStage()); return; }
    try { if (Learn.markMissed) Learn.markMissed(word.w); } catch (e) {}
    Learn.renderMistakeCoach(word, choice && choice.w || '', contextStage());
  }, 'v59.answerContext');

  Learn.answerContextTyped = guard(function (word, typed, row) {
    var right = norm(typed) === norm(word.w);
    if (right) { contextCorrect(word, contextStage()); return; }
    try { if (Learn.markMissed) Learn.markMissed(word.w); } catch (e) {}
    Learn.renderMistakeCoach(word, typed, contextStage());
  }, 'v59.answerContextTyped');

  /* ==========================================================================
     3D-4. F6 Speak & Compare (explicit play buttons, iOS-safe MIME)
     ========================================================================== */

  Learn.recordAndCompare = guard(function (wordObj) {
    var word = String((wordObj && (wordObj.w || wordObj.word)) || '');
    if (!word) {
      try { var cw = Eng() && Eng().currentWord && Eng().currentWord(); word = String((cw && (cw.w || cw.word)) || ''); } catch (e) {}
    }
    if (!word) return;
    var nav = W.navigator || {};
    if (!W.MediaRecorder || !nav.mediaDevices || !nav.mediaDevices.getUserMedia) {
      toast(T('🎤 Speak & Compare needs a modern browser with MediaRecorder. Your voice is never uploaded.',
        '🎤 මෙම විශේෂාංගය සඳහා නවීන බ්‍රව්සරයක් අවශ්‍යයි. ඔබේ හඬ කිසිවිටෙක උඩුගත නොවේ.'), { icon: 'i-alert', ms: 6000 });
      return;
    }
    if (Learn._mirrorUrl) { try { W.URL.revokeObjectURL(Learn._mirrorUrl); } catch (e) {} Learn._mirrorUrl = null; }
    if (Learn._mirrorStream) { try { Learn._mirrorStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} Learn._mirrorStream = null; }
    var mime = (W.MediaRecorder.isTypeSupported && W.MediaRecorder.isTypeSupported('audio/mp4')) ? 'audio/mp4' : 'audio/webm';
    nav.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      Learn._mirrorStream = stream;
      var chunks = [];
      var rec;
      try { rec = new W.MediaRecorder(stream, { mimeType: mime }); }
      catch (e) { rec = new W.MediaRecorder(stream); }
      rec.ondataavailable = function (e) { if (e && e.data) chunks.push(e.data); };
      rec.onstop = function () {
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        var type = (chunks[0] && chunks[0].type) || mime;
        var blob = new W.Blob(chunks, { type: type });
        var url = W.URL.createObjectURL(blob);
        Learn._mirrorUrl = url;
        var old = $('#v59MicPanel');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var panel = el('div', 'v59-mic-panel');
        panel.id = 'v59MicPanel';
        panel.appendChild(el('p', 'small muted', T('Your recording is ready — compare it with the studio voice.', 'ඔබේ පටිගත කිරීම සූදානම් — මැදිරි හඬ සමඟ සසඳන්න.')));
        var mineAudio = el('audio');
        mineAudio.id = 'v59MyRecording';
        mineAudio.preload = 'auto';
        mineAudio.src = url;
        var studioUrl = (wordObj && wordObj.audio) || ('https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(word));
        var row = el('div', 'btn-row tight');
        var both = el('button', 'btn pri', T('▶ Play Studio → My Voice', '▶ මැදිරි හඬ → මගේ හඬ'));
        both.type = 'button';
        on(both, 'click', function () {
          /* R6: plain <audio> element, never createMediaElementSource on a
             cross-origin dict.youdao.com file (it would silence Android/iOS). */
          var studio = $('#v59StudioCompare') || el('audio');
          studio.id = 'v59StudioCompare';
          studio.preload = 'auto';
          studio.crossOrigin = null;
          studio.src = studioUrl;
          studio.volume = Math.max(0, Math.min(1, Number(settings().volume == null ? 1 : settings().volume)));
          studio.onended = function () { try { mineAudio.play(); } catch (e) {} };
          var p = studio.play();
          if (p && p.catch) p.catch(function () { try { mineAudio.play(); } catch (e) {} });
        });
        var mine = el('button', 'btn soft', T('▶ Play my recording', '▶ මගේ පටිගත කිරීම අසන්න'));
        mine.type = 'button';
        mine.id = 'v59PlayMine';
        on(mine, 'click', function () { try { mineAudio.currentTime = 0; mineAudio.play(); } catch (e) {} });
        row.appendChild(both); row.appendChild(mine);
        panel.appendChild(row);
        panel.appendChild(mineAudio);
        var host = (Eng() && Eng().layer && (($('.lbody', Eng().layer) || Eng().layer))) || D.body;
        host.appendChild(panel);
        toast('🎤 ' + T('Recording captured. Tap ▶ Play my recording to hear it.', 'පටිගත කිරීම සුරකින ලදී.'), { icon: 'i-mic' });
      };
      rec.start();
      toast('🎤 ' + T('Listening — say “' + word + '” after the studio voice.', '🎤 “' + word + '” කියන්න.'), { icon: 'i-mic' });
      setTimeout(function () { try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {} }, 2600);
    }, function () {
      toast(T('🎤 Microphone unavailable. Allow mic access in your browser settings — or use the typing mode.',
        '🎤 මයික්‍රෝෆෝනය ලබාගත නොහැකි විය. බ්‍රව්සර් සැකසුම්වලින් අවසර දෙන්න.'), { icon: 'i-alert', ms: 6000 });
    });
  }, 'v59.recordAndCompare');

  /* ==========================================================================
     3D-5. F7 Offline pack: only real cache writes count as saved
     ========================================================================== */

  Learn.downloadOfflinePack = guard(function () {
    var fill = $('#v58OfflineFill');
    var text = $('#v58OfflineText');
    var words = sessionWords();
    if (!words.length) { toast('No word list loaded yet.', { icon: 'i-info' }); return; }
    if (!W.caches) { toast('Offline packs need a secure context (https).', { icon: 'i-alert' }); return; }
    if (Learn._offlineBusy) return;
    Learn._offlineBusy = true;
    var total = words.length, saved = 0, done = 0;
    function progress() {
      if (fill) { try { fill.style.width = Math.round(100 * done / Math.max(1, total)) + '%'; } catch (e) {} }
      if (text) { try { text.textContent = done + '/' + total + ' checked · ' + saved + '/' + total + ' saved offline ✓'; } catch (e) {} }
    }
    progress();
    W.caches.open('sdp-youdao-v1').then(function (cache) {
      var i = 0;
      function next() {
        if (i >= words.length) { finish(); return; }
        var w = words[i++] || {};
        var url = w.audio || ('https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(w.w));
        done++;
        var chain;
        try {
          chain = cache.match(url).then(function (hit) {
            if (hit) { saved++; progress(); return true; }
            return W.fetch(url, { mode: 'no-cors', credentials: 'omit' }).then(function (res) {
              if (!res) return false;
              return cache.put(url, res.clone()).then(function () { saved++; progress(); return true; },
                function () { progress(); return false; });
            });
          });
        } catch (e) { chain = null; }
        Promise.resolve(chain).then(function () { progress(); next(); }, function () { progress(); next(); });
      }
      next();
    }).catch(function () { Learn._offlineBusy = false; toast('Offline packs need a secure context (https).', { icon: 'i-alert' }); });
    function finish() {
      Learn._offlineBusy = false;
      progress();
      try {
        var db = DB();
        if (db && db.data && db.data.settings) {
          db.data.settings.offlineReadyCount = saved;
          db.data.settings.offlineReadyTotal = total;
          db.data.settings.offlineReadyAt = saved >= total ? Date.now() : 0;
          if (db.save) db.save();
        }
      } catch (e) {}
      if (saved >= total) toast('📥 Offline pack ready: ' + saved + '/' + total + ' word clips in sdp-youdao-v1.', { icon: 'i-check', ms: 6000 });
      else toast('📥 Saved ' + saved + ' of ' + total + ' clips — the rest need a connection. Tap again to retry.', { icon: 'i-alert', ms: 6000 });
      try {
        W.caches.open('sdp-v59-media').then(function (cache) {
          return Promise.all([
            cache.add('./assets/fonts/NotoSansSinhala-Regular.woff2'),
            cache.add('./assets/fonts/NotoSansSinhala-Bold.woff2')
          ]);
        }).catch(function () {});
      } catch (e) {}
    }
  }, 'v59.downloadOfflinePack');

  Learn.syncOfflineRow = guard(function () {
    var fill = $('#v58OfflineFill');
    var text = $('#v58OfflineText');
    if (!fill || !text) return;
    var s = settings();
    var total = sessionWords().length;
    var count = Number(s.offlineReadyCount) || 0;
    if (count > 0) {
      try { fill.style.width = Math.round(100 * count / Math.max(1, total)) + '%'; } catch (e) {}
      text.textContent = count + '/' + total + ' word clips saved offline ✓ · re-download anytime';
    } else {
      try { fill.style.width = '0%'; } catch (e) {}
      text.textContent = total + ' word clips can be saved offline';
    }
  }, 'v59.syncOfflineRow');

  /* ==========================================================================
     3E. window.SDPPerfGuard — keep the UI at 60 fps, memoised
     ========================================================================== */

  function reduceDeltas(deltas) {
    var arr = (deltas || []).slice(0).sort(function (a, b) { return a - b; });
    if (!arr.length) return { avg: 0, med: 0, slow3: 0, frames: 0, lite: false };
    var sum = 0, i;
    for (i = 0; i < arr.length; i++) sum += arr[i];
    var slow = 0;
    for (i = 0; i < arr.length; i++) if (arr[i] > 32) slow++;
    var med = arr[Math.floor(arr.length / 2)];
    return {
      avg: sum / arr.length,
      med: med,
      slow3: arr.length ? (slow / arr.length) * 100 : 0,
      frames: arr.length
    };
  }

  var PG = W.SDPPerfGuard = {
    KEY: 'sdp.perfGuard.v1',
    SLOW_AVG: 22,
    SLOW_MED: 25,
    SLOW3: 32,
    stats: null,
    _busy: false,
    sampler: null,
    memo: function () {
      try { return JSON.parse(W.localStorage.getItem(PG.KEY) || 'null'); } catch (e) { return null; }
    },
    writeMemo: function (obj) {
      try { W.localStorage.setItem(PG.KEY, JSON.stringify(obj)); } catch (e) {}
    },
    /* Pure decision function — unit-testable without a browser frame loop. */
    decide: function (r) {
      r = r || {};
      var slow = (Number(r.avg) > PG.SLOW_AVG) || (Number(r.med) > PG.SLOW_MED) || (Number(r.slow3) > PG.SLOW3);
      r.lite = !!slow;
      var s = settings();
      var userChosen = s && s.perfChosenBy === 'user';
      PG.stats = r;
      if (slow && !userChosen) PG.applyLite(r);
      return r;
    },
    applyLite: function (r) {
      var db = DB(), u = UI(), s = (db && db.data && db.data.settings) || null;
      try {
        if (s) {
          if (s.perfChosenBy === 'user') return false;
          s.perf = 'lite';
          s.perfChosenBy = 'guard';
          if (db && db.save) db.save();
        }
      } catch (e) {}
      try { if (u && typeof u.setPerfSilent === 'function') u.setPerfSilent('lite'); } catch (e) {}
      try { if (u && u.applyPerf) u.applyPerf(); } catch (e) {}
      try {
        if (D.body) D.body.setAttribute('data-perf', 'lite');
        D.documentElement.setAttribute('data-perf', 'lite');
      } catch (e) {}
      PG.writeMemo({ mode: 'lite', at: Date.now(), avg: r && r.avg, med: r && r.med, slow3: r && r.slow3 });
      toast('⚡ 60 FPS Smooth Mode auto-enabled', { icon: 'i-target', ms: 3400 });
      return true;
    },
    benchmark: function (done) {
      var max = 90, deltas = [], last = 0, count = 0;
      /* injected samples (tests) always resolve immediately */
      if (PG.sampler && PG.sampler.length) {
        var rr = reduceDeltas(PG.sampler.slice(0));
        PG.stats = rr;
        if (typeof done === 'function') done(rr);
        return rr;
      }
      if (PG._busy) return PG.stats;
      function finish() {
        PG._busy = false;
        var r = reduceDeltas(deltas);
        PG.stats = r;
        if (typeof done === 'function') done(r);
        return r;
      }
      var raf = W.requestAnimationFrame;
      if (typeof raf !== 'function') {
        /* very old engines: approximate with a short timer chain, then stop */
        var t0 = 0;
        function tickTimer() {
          var now = Date.now();
          if (t0) deltas.push(now - t0);
          t0 = now;
          if (++count >= 40) { finish(); return; }
          setTimeout(tickTimer, 16);
        }
        tickTimer();
        return null;
      }
      function frame(ts) {
        if (last) deltas.push(ts - last);
        last = ts;
        if (++count >= max) { finish(); return; }
        try { raf.call(W, frame); } catch (e) { finish(); }
      }
      try { raf.call(W, frame); } catch (e) { PG._busy = false; }
      return null;
    },
    /* Boot entry: start(UIref, DBref) — normalises the legacy default, honours a
       saved memo and samples exactly one 90-frame window, then stops forever. */
    start: function (u, db) {
      try {
        var memo = PG.memo();
        var s = (db && db.data && db.data.settings) || null;
        if (!s) { try { s = settings(); } catch (e) { s = null; } }
        if (!s) return;
        if (s.perf === 'full' && s.perfChosenBy !== 'user') {
          s.perf = 'auto';
          s.perfChosenBy = s.perfChosenBy || 'auto';
          try { if (db && db.save) db.save(); } catch (e) {}
          try { if (u && u.applyPerf) u.applyPerf(); } catch (e) {}
        }
        if (memo && memo.mode === 'lite' && s.perfChosenBy !== 'user') {
          PG.applyLite({ avg: memo.avg, med: memo.med, slow3: memo.slow3, memo: true });
          return;
        }
        var run = function () {
          var go = function () {
            PG.benchmark(function (r) { PG.decide(r); });
          };
          if (W.setTimeout) W.setTimeout(go, 700);
        };
        if (D.readyState === 'complete') run();
        else {
          try { W.addEventListener('load', run, { passive: true }); } catch (e) { run(); }
        }
      } catch (e) {}
    }
  };

  function normalizePerf() {
    try {
      var db = DB();
      if (!db || !db.data || !db.data.settings) return;
      var s = db.data.settings;
      if (s.perfChosenBy == null) s.perfChosenBy = '';
      if (s.perf === 'full' && s.perfChosenBy !== 'user') {
        s.perf = 'auto';
        s.perfChosenBy = 'auto';
        if (db.save) db.save();
        try { if (UI() && UI().applyPerf) UI().applyPerf(); } catch (e) {}
      }
    } catch (e) {}
  }

  /* ==========================================================================
     R5/R6: event-driven updates, no idle rAF, no idle intervals, safe dock
     ========================================================================== */

  V59.clampDock = guard(function () {
    if (!D.body || !D.body.classList.contains('v58-keyboard')) return;
    var dock = $('#v58Dock') || $('#v58KbdHud');
    if (!dock) return;
    var bar = $('.topbar');
    var bottom = bar && bar.getBoundingClientRect ? bar.getBoundingClientRect().bottom : 0;
    var rect = dock.getBoundingClientRect ? dock.getBoundingClientRect() : null;
    if (!rect || !rect.height) return;
    /* Android soft keyboard: never translate the dock above the top bar */
    if (rect.top < bottom + 6) {
      var shift = (bottom + 6) - rect.top;
      try { dock.style.transform = 'translateY(' + Math.round(shift) + 'px)'; } catch (e) {}
    } else {
      try { dock.style.transform = ''; } catch (e) {}
    }
  }, 'v59.clampDock');

  function wireAudioEvents() {
    var audio = $('#ttsMasterAudio');
    if (!audio || audio.__v59Halo) return;
    audio.__v59Halo = true;
    on(audio, 'playing', function () { Learn.startHalo(); });
    on(audio, 'timeupdate', function () { if (!Learn._haloRunning) Learn.startHalo(); });
    on(audio, 'pause', function () { Learn.stopHalo(); });
    on(audio, 'ended', function () { Learn.stopHalo(); });
    on(audio, 'emptied', function () { Learn.stopHalo(); });
  }

  function hookEngFocus() {
    var e = Eng();
    if (!e || e.__v59Focus) return;
    var start = e.start, stop = e.stop;
    if (typeof start === 'function') {
      e.start = guard(function () {
        var out = start.apply(this, arguments);
        try { Learn.syncFocus(); V59.clampDock(); } catch (err) {}
        return out;
      }, 'v59.eng.start.focus');
    }
    if (typeof stop === 'function') {
      e.stop = guard(function () {
        var out = stop.apply(this, arguments);
        try { Learn.stopHalo(); Learn.syncFocus(); } catch (err) {}
        return out;
      }, 'v59.eng.stop.focus');
    }
    e.__v59Focus = true;
  }

  function hookScreensSet() {
    var s = Screens();
    if (!s || s.__v59Set) return;
    s.__v59Set = true;
    if (typeof s.set === 'function') {
      var set = s.set;
      s.set = guard(function () {
        var out = set.apply(this, arguments);
        try {
          Learn.updateGauge();
          Learn.syncFocus();
          Learn.regroupOverflow();
          V59.ensureBentoTiles();
          var u = UI();
          if ((this && this.tab === 'dict') || (u && u.tab === 'dict')) V59.renderDictCards();
        } catch (e) {}
        return out;
      }, 'v59.screens.set');
    }
  }

  function hookFinishSummary() {
    var e = Eng();
    if (!e || e.__v59Summary || typeof e.speakFinishSummary !== 'function') return;
    var orig = e.speakFinishSummary;
    e.speakFinishSummary = guard(function () {
      var out = orig.apply(this, arguments);
      try {
        if (Learn._selfCheck) writeSummary(Learn._selfCheck.ok, Learn._selfCheck.total);
      } catch (err) {}
      return out;
    }, 'v59.eng.speakFinishSummary');
    e.__v59Summary = true;
  }

  function hookResultsPaper() {
    var c = core();
    if (!c || !c.Results || c.Results.__v59Paper) return;
    var open = c.Results.open;
    if (typeof open !== 'function') return;
    c.Results.open = guard(function () {
      var result = arguments[0];
      var out = open.apply(this, arguments);
      try {
        if (result && result.mode === 'paper') {
          /* paper mode is self-marked, so a 30-line "breakdown" is noise */
          var coach = $('#v58ResultsCoach');
          if (coach && coach.parentNode) coach.parentNode.removeChild(coach);
        }
        if (result && result.rows && result.rows.length && $('[data-v59-results]')) { /* noop */ }
      } catch (e) {}
      return out;
    }, 'v59.results.open');
    c.Results.__v59Paper = true;
  }

  V59.wireEvents = guard(function () {
    wireAudioEvents();
    hookEngFocus();
    hookScreensSet();
    hookResultsPaper();
    hookFinishSummary();
    on(W, 'resize', function () { try { Learn.updateGauge(); Learn.regroupOverflow(); V59.clampDock(); } catch (e) {} }, true);
    on(W, 'scroll', function () { try { V59.clampDock(); } catch (e) {} }, true);
    try {
      if (W.visualViewport) {
        on(W.visualViewport, 'resize', function () { try { V59.clampDock(); } catch (e) {} });
        on(W.visualViewport, 'scroll', function () { try { V59.clampDock(); } catch (e) {} });
      }
    } catch (e) {}
    var theme = $('#btnTheme');
    on(theme, 'click', function () { setTimeout(function () { try { Learn.updateGauge(); } catch (e) {} }, 40); });
    var perfBtn = $('#btnPerf');
    on(perfBtn, 'click', function () { setTimeout(function () { try { Learn.updateGauge(); } catch (e) {} }, 40); });
    /* focus changes inside the player keep the dock visible on mobile keyboards */
    on(D, 'focusin', function () { setTimeout(function () { try { V59.clampDock(); } catch (e) {} }, 60); });
  }, 'v59.wireEvents');

  /* ==========================================================================
     Boot
     ========================================================================== */

  function boot() {
    if (!D || !core()) {
      V59._tries = (V59._tries || 0) + 1;
      if (V59._tries < 100) setTimeout(boot, 60);
      return;
    }
    injectCss();
    V59.cleanLegacyCss();
    V59.ensureBentoTiles();
    installLangEngine();
    normalizePerf();
    hookDict();
    hookResultsPaper();
    V59.wireEvents();
    try { if (UI() && UI().applyLang) UI().applyLang(); } catch (e) {}
    try { V59.syncI18n(); } catch (e) {}
    try { Learn.syncOfflineRow(); Learn.updateGauge(); Learn.syncFocus(); } catch (e) {}
    
  /* ============================================================
     SDPVersion — continuous 9.0.x.y release progression
     9.0.0.1 -> 9.0.0.2 -> ... -> 9.0.0.9 -> 9.0.1.0 -> 9.0.1.1
     ============================================================ */
  window.SDPVersion = {
    family: '9.0',
    current: '9.0.0.2',
    parse: function (v) {
      var m = /^9\.0\.(\d+)(?:\.(\d+))?$/.exec(String(v || '9.0.0.1'));
      return { major: 9, minor: 0, patch: Number(m && m[1] ? m[1] : 0), build: Number(m && m[2] ? m[2] : 1) };
    },
    bumpPatch: function (currentVersion) {
      var p = this.parse(currentVersion || this.current);
      if (p.build < 9) { p.build++; }
      else { p.build = 1; p.patch++; }
      var next = '9.0.' + p.patch + '.' + p.build;
      this.current = next;
      return next;
    },
    isValid: function (v) { return /^9\.0\.\d+(\.\d+)?$/.test(String(v || '')); }
  };

  /* ============================================================
     SDP.microToastLoad — whisper-quiet load micro-notification
     Includes navigation transferSize so the 485 KB document is counted.
     ============================================================ */
  Learn.microToastLoad = function () {
    /* v9.0.0.2: the whisper-quiet pill is owned by the NextGen layer so the
       measured bytes, the copy and the auto-dismiss timings stay in one place. */
    try {
      if (window.SDPNextGen && window.SDPNextGen.mountMicroToast) return window.SDPNextGen.mountMicroToast();
    } catch (e) {}
    return null;
  };

  /* ============================================================
     SDP.creditPill — animated 🦢 Credits Goes To Hansana live pill
     ============================================================ */
  Learn.creditPill = function () {
    /* v9.0.0.2: 🦢 CREDITS GOES TO Hansana — animated pill, then the quiet
       docked footer badge (#creditDocked) takes over. */
    try {
      if (window.SDPNextGen && window.SDPNextGen.mountCredit) return window.SDPNextGen.mountCredit();
    } catch (e) {}
    return null;
  };
  Learn.dockCreditPill = function () {
    try {
      if (window.SDPNextGen && window.SDPNextGen.showDockedCredit) return window.SDPNextGen.showDockedCredit();
    } catch (e) {}
    return null;
  };

  /* ============================================================
     #sdpNextGenCss — Next-Gen shadcn/ui Zinc/Sky design system
     Injected at runtime by learning-tools.js (index.html adds 0 CSS bytes)
     ============================================================ */
  Learn.sdpNextGenCss = function () {
    try {
      if ($('#sdpNextGenCss')) return;
      var st = D.createElement('style');
      st.id = 'sdpNextGenCss';
      st.textContent = [
        ':root{--sdp-zinc-950:#09090b;--sdp-zinc-900:#18181b;--sdp-zinc-800:#27272a;--sdp-sky-400:#38bdf8;--sdp-emerald:#4ade80;--sdp-amber:#fbbf24;--sdp-border:1px solid rgba(255,255,255,0.09);--sdp-tap:48px}',
        'html[lang=en]{--font:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
        'html[lang=si]{--font:"Noto Sans Sinhala",Inter,sans-serif;line-height:1.75}',
        '.topbar,.topbar.glass{position:fixed!important;top:0!important;left:0!important;right:0!important;height:54px!important;min-height:54px!important;max-width:100%!important;margin:0!important;padding:0 14px!important;border-radius:0!important;background:rgba(24,24,27,0.88)!important;backdrop-filter:blur(14px) saturate(1.4)!important;-webkit-backdrop-filter:blur(14px) saturate(1.4)!important;border-bottom:1px solid rgba(255,255,255,0.09)!important;z-index:60!important}',
        '#app{padding-top:calc(66px + env(safe-area-inset-top,0px))!important;padding-bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}',
        '.v60-cockpit-bar{position:absolute;top:0;left:0;right:0;height:4px;border-radius:0;z-index:1}',
        '.v60-cockpit-bar.sky{background:linear-gradient(90deg,#38bdf8,#38bdf8)}',
        '.v60-cockpit-bar.amber{background:linear-gradient(90deg,#fbbf24,#fbbf24)}',
        '.v60-cockpit-bar.emerald{background:linear-gradient(90deg,#4ade80,#4ade80)}',
        '.v60-cockpit-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px}',
        '.v60-cockpit-pill{height:34px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);background:rgba(24,24,27,0.72);display:inline-flex;align-items:center;gap:8px;padding:0 10px;font-variant-numeric:tabular-nums}',
        '#cdNum{font-variant-numeric:tabular-nums;font-weight:700}',
        '#ring{width:26px!important;height:26px!important}',
        '.v60-credit-live{position:fixed;top:62px;left:50%;transform:translateX(-50%);z-index:55;pointer-events:none!important}',
        '.v60-credit-dock{position:static!important;transform:none!important;pointer-events:auto!important}',
        'body.v58-keyboard #tabbar{pointer-events:auto!important;opacity:1!important}',
        '@media (prefers-reduced-motion: reduce){.v60-credit-live{animation:none!important;transition:none!important}}'
      ].join('\n');
      (D.head || D.documentElement).appendChild(st);
    } catch (e) {}
  };

  /* ============================================================
     SDPOfflineDB — IndexedDB learner store (sdp-learner-v1)
     with localStorage mirror fallback
     ============================================================ */
  window.SDPOfflineDB = {
    DB_NAME: 'sdp-learner-v1',
    STORES: ['results', 'weakWords', 'outbox'],
    _db: null,
    _open: function (cb) {
      try {
        if (!W.indexedDB) { cb(null); return; }
        var req = W.indexedDB.open(this.DB_NAME, 1);
        req.onupgradeneeded = function (ev) {
          var db = ev.target.result, i;
          for (i = 0; i < this.STORES.length; i++) {
            if (!db.objectStoreNames.contains(this.STORES[i])) db.createObjectStore(this.STORES[i], { keyPath: 'id' });
          }
        }.bind(this);
        req.onsuccess = function (ev) { this._db = ev.target.result; cb(this._db); }.bind(this);
        req.onerror = function () { cb(null); };
      } catch (e) { cb(null); }
    },
    _store: function (db, name, mode, cb) {
      try { var tx = db.transaction([name], mode || 'readonly'); cb(tx.objectStore(name)); } catch (e) { cb(null); }
    },
    put: function (storeName, item, cb) {
      this._open(function (db) {
        if (!db) { try { this._lsPut(storeName, item); if (cb) cb(); } catch (e) { if (cb) cb(); } return; }
        this._store(db, storeName, 'readwrite', function (store) {
          if (!store) { if (cb) cb(); return; }
          try { var r = store.put({ id: String(item.id || Date.now()), data: item, ts: Date.now() }); r.onsuccess = function () { try { this._lsPut(storeName, item); } catch (e) {} if (cb) cb(); }.bind(this); r.onerror = function () { if (cb) cb(); }; } catch (e) { if (cb) cb(); }
        }.bind(this));
      }.bind(this));
    },
    get: function (storeName, id, cb) {
      this._open(function (db) {
        if (!db) { if (cb) cb(this._lsGet(storeName, id)); return; }
        this._store(db, storeName, 'readonly', function (store) {
          if (!store) { if (cb) cb(null); return; }
          try { var r = store.get(String(id)); r.onsuccess = function () { if (cb) cb(r.result && r.result.data ? r.result.data : null); }; r.onerror = function () { if (cb) cb(null); }; } catch (e) { if (cb) cb(null); }
        }.bind(this));
      }.bind(this));
    },
    _lsKey: function (storeName, id) { return 'sdp.idb.' + storeName + '.' + String(id); },
    _lsPut: function (storeName, item) { try { W.localStorage.setItem(this._lsKey(storeName, item.id || Date.now()), JSON.stringify({ data: item, ts: Date.now() })); } catch (e) {} },
    _lsGet: function (storeName, id) { try { var raw = W.localStorage.getItem(this._lsKey(storeName, id)); if (!raw) return null; var o = JSON.parse(raw); return o && o.data ? o.data : null; } catch (e) { return null; } },
    mirrorWeak: function () {
      try {
        var weak = Learn.loadWeakWords ? Learn.loadWeakWords() : {}, k;
        for (k in weak) if (Object.prototype.hasOwnProperty.call(weak, k)) this.put('weakWords', { word: k, entry: weak[k], ts: Date.now() });
      } catch (e) {}
    },
    hydrateWeak: function () {
      try {
        var stored = W.localStorage.getItem('sdp.weakWords.v1');
        if (!stored || stored === '{}') return false;
        return true;
      } catch (e) { return false; }
    }
  };
V59.ready = true;
    try { PG.start(UI(), DB()); } catch (e) {}
  }

  if (D.readyState === 'loading') on(D, 'DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
/* ============================================================================
   Smart Dictation Player — v9.0.0.2 (build 60) Next-Gen "Hurubuhuti" layer
   ----------------------------------------------------------------------------
   Mockups 6.1 – 6.8 (SDP_NextGen_Audit_Report pages 15–21):
     6.1/6.7  Home: greeting, hero card, 3-stat strip, 2x2 quick practice
     6.2/6.8  Cockpit: 4px edge bar, 34px timer pill, helper dock, 30-word map
     6.3/6.4  Settings: dictation-first 3-tier hierarchy (EN + සිංහල)
     6.5      Words explorer: full-field numbered cards, zero truncation
     6.6      Whisper-quiet load micro-toast + animated Hansana credit pill
   ----------------------------------------------------------------------------
   STRICT ES5. No const/let/arrow/template literals/class/async/spread.
   Runs as an additive IIFE after the learning-tools module so the legacy
   engines (Eng / UI / Results / Store / Media / Screens) are untouched.
   ========================================================================== */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!W) return;
  var D = W.document;
  var VERSION = '9.0.0.2';
  var BUILD = 60;
  var NG = {};
  W.SDPNextGen = NG;

  /* ---------------- tiny DOM helpers ---------------- */
  function $(sel, root) { try { return (root || D).querySelector(sel); } catch (e) { return null; } }
  function $$(sel, root) { try { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); } catch (e) { return []; } }
  function on(node, ev, fn, cap) {
    if (!node || !node.addEventListener) return;
    var passive = /^(scroll|touchstart|touchmove|wheel|mousewheel)$/i.test(String(ev));
    try { node.addEventListener(ev, fn, passive ? { passive: true, capture: !!cap } : !!cap); }
    catch (e) { try { node.addEventListener(ev, fn, !!cap); } catch (e2) {} }
  }
  function mk(tag, cls, text) {
    var el = D.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = String(text);
    return el;
  }
  function core() { return W.SDPCore || null; }
  function DB() { var c = core(); return c && c.DB ? c.DB : null; }
  function UI() { var c = core(); return c && c.UI ? c.UI : null; }
  function Screen() { var c = core(); return c && c.Screens ? c.Screens : null; }
  function Learn() { return W.SDPLearning || null; }
  function guard(fn, where) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (err) { try { if (W.SDPCore && W.SDPCore.Errors) W.SDPCore.Errors.report(err, where); } catch (e) {} }
    };
  }
  function settings() {
    var d = DB();
    try { if (d && d.data && d.data.settings) return d.data.settings; } catch (e) {}
    return {};
  }
  function saveSettings() {
    var d = DB();
    try { if (d) { if (d.save) d.save(); else if (d.saveNow) d.saveNow(); } } catch (e) {}
  }
  function lang() {
    try { return String(settings().lang || 'en') === 'si' ? 'si' : 'en'; } catch (e) { return 'en'; }
  }
  function lset(key) { return lang() === 'si' ? SDP_SI_DICT[key] : ''; }
  function t(en, si) { return lang() === 'si' ? si : en; }
  function toast(msg, opts) {
    try { var u = UI(); if (u && u.toast) u.toast(msg, opts || {}); } catch (e) {}
  }

  /* ==========================================================================
     0. migrateToV60 — preserve every byte of learner progress
     ========================================================================== */
  NG.migrateToV60 = guard(function () {
    try {
      if (W.localStorage.getItem('sdp_migrated_v60_2') === VERSION) return true;
      /* the learner keys stay exactly as they are: sdp.v1 (DB), weak/mastered
         banks, history. Nothing is renamed or dropped. */
      var explicit = W.localStorage.getItem('sdp_wp_explicit_v60') === '1';
      var d = DB();
      if (d && d.data && d.data.settings) {
        d.data.settings.theme = d.data.settings.theme || 'dark';
        d.data.settings.nextGen = VERSION;
        try { if (!explicit) d.data.settings.wallpaperOn = false; } catch (e) {}
        try { saveSettings(); } catch (e) {}
      }
      if (!explicit && D.body) {
        D.body.classList.remove('wallpaper-on');
        D.body.classList.remove('photo-mode');
      }
      W.localStorage.setItem('sdp_migrated_v60_2', VERSION);
      W.localStorage.setItem('sdp_migrated_v60', VERSION);
      return true;
    } catch (e) { return false; }
  }, 'nextgen.migrateToV60');

  function customWallpaperExplicit() {
    try { return W.localStorage.getItem('sdp_wp_explicit_v60') === '1'; } catch (e) { return false; }
  }

  /* ==========================================================================
     1. neutraliseLegacyStyles — #sdpV57Css / #sdpV58Css can never win again
     ========================================================================== */
  var LEGACY_STYLE_IDS = ['sdpV57Css', 'sdpV58Css'];

  NG.neutraliseLegacyStyles = guard(function () {
    var i, node, changed = 0;
    for (i = 0; i < LEGACY_STYLE_IDS.length; i++) {
      try {
        node = D.getElementById(LEGACY_STYLE_IDS[i]);
        if (!node) continue;
        if (node.getAttribute('data-ng-off') !== VERSION) {
          node.setAttribute('data-ng-off', VERSION);
          node.setAttribute('media', 'not all');
          node.textContent = '/* neutralised by v9.0.0.2 NextGen UI */';
          node.disabled = true;
          changed++;
        }
      } catch (e) {}
    }
    /* keep the Next-Gen sheet as the very last <style> in <head> */
    try {
      var ng = D.getElementById('sdpNextGenCss');
      if (ng && D.head) {
        var styles = D.head.getElementsByTagName('style');
        if (styles.length && styles[styles.length - 1] !== ng) D.head.appendChild(ng);
      }
    } catch (e) {}
    /* wallpaper is opt-in only */
    try {
      if (D.body && !customWallpaperExplicit()) {
        if (D.body.classList.contains('wallpaper-on')) {
          D.body.classList.remove('wallpaper-on');
          changed++;
        }
        if (D.body.classList.contains('photo-mode')) D.body.classList.remove('photo-mode');
      }
    } catch (e) {}
    return changed;
  }, 'nextgen.neutraliseLegacyStyles');

  /* the wallpaper is opt-in: applying one from Priority 3 records the explicit
     choice and re-enables the wallpaper layers (whisper-quiet, never automatic) */
  NG.markWallpaperExplicit = function () {
    try {
      W.localStorage.setItem('sdp_wp_explicit_v60', '1');
      if (D.body) {
        D.body.classList.add('sdp-custom-wp-active');
        D.body.classList.add('wallpaper-on');
      }
    } catch (e) {}
  };
  NG.clearWallpaperExplicit = function () {
    try {
      W.localStorage.removeItem('sdp_wp_explicit_v60');
      if (D.body) {
        D.body.classList.remove('sdp-custom-wp-active');
        D.body.classList.remove('wallpaper-on');
      }
    } catch (e) {}
  };
  NG.wireWallpaperChoice = function () {
    try {
      if (NG.__wiredWp) return;
      NG.__wiredWp = true;
      on(D, 'click', function (ev) {
        var t = ev && ev.target;
        if (!t || !t.closest) return;
        if (t.closest('#btnStaticWallpaper,#btnResetVideo')) {
          NG.clearWallpaperExplicit();
          return;
        }
        if (t.closest('[data-gallery-select],[data-gallery-apply],#btnToggleVideo,#btnNextWallpaper,[data-wallpaper-apply],#btnPickVideoFile,#btnPickVideoFileSet')) NG.markWallpaperExplicit();
      }, true);
      /* a stored explicit choice re-enables the layers on boot */
      if (customWallpaperExplicit() && D.body) D.body.classList.add('sdp-custom-wp-active');
    } catch (e) {}
  };

  NG.observeLegacyStyles = function () {
    try {
      if (!W.MutationObserver || !D.head || NG.__observing) return;
      NG.__observing = true;
      var mo = new W.MutationObserver(function () { NG.neutraliseLegacyStyles(); });
      mo.observe(D.head, { childList: true, subtree: true, characterData: true });
      var bodyObs = new W.MutationObserver(function () {
        if (!customWallpaperExplicit() && D.body && D.body.classList.contains('wallpaper-on')) {
          D.body.classList.remove('wallpaper-on');
        }
      });
      if (D.body) bodyObs.observe(D.body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
  };

  /* ==========================================================================
     2. #sdpNextGenCss — Zinc-950 / Sky-400 "හුරුබුහුටි" design system
     ========================================================================== */
  var NEXTGEN_CSS = [
    /* ---- tokens ---- */
    ':root{',
    '  --bg-canvas:#09090B;--bg-card:#18181B;--bg-elevated:#27272A;--bg-glass:rgba(24,24,27,0.88);',
    '  --border-subtle:rgba(255,255,255,0.08);--border-focus:#38BDF8;',
    '  --text-primary:#FAFAFA;--text-secondary:#A1A1AA;--text-muted:#71717A;',
    '  --accent-primary:#38BDF8;--accent-hover:#0EA5E9;--accent-soft:rgba(56,189,248,0.14);',
    '  --status-listen:#38BDF8;--status-write:#FBBF24;--status-review:#4ADE80;--status-danger:#F87171;',
    '  --radius-card:16px;--radius-ctl:12px;--radius-pill:9999px;',
    '  --font-sans:"Plus Jakarta Sans","Inter","Noto Sans Sinhala",system-ui,-apple-system,sans-serif;',
    '  --font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;',
    '  --sdp-zinc-950:#09090B;--sdp-zinc-900:#18181B;--sdp-zinc-800:#27272A;',
    '  --sdp-sky-400:#38BDF8;--sdp-emerald:#4ADE80;--sdp-amber:#FBBF24;--sdp-red:#F87171;',
    '}',
    /* ---- global reset / solid surfaces ---- */
    'html,body{background:#09090B !important;color:#FAFAFA !important;font-family:var(--font-sans) !important;margin:0;padding:0;overflow-x:hidden !important;background-image:none !important;}',
    'body{--fg:#FAFAFA;--muted:#A1A1AA;--ink-2:#A1A1AA;--ink-3:#71717A;--line:#ffffff14;--line-2:#ffffff0f;--bg1:#09090B;--bg2:#09090B;}',
    'body.sdp-nextgen #bg,body.sdp-nextgen .bg-aurora,body.sdp-nextgen .bg-grid,body.sdp-nextgen .stripes,body.sdp-nextgen .disc{display:none !important;opacity:0 !important;}',
    'body:not(.sdp-custom-wp-active) #wallpaperBg,body:not(.sdp-custom-wp-active) .wallpaper-layer,',
    'body:not(.sdp-custom-wp-active) #bgLiveWrap,body:not(.sdp-custom-wp-active) #bgLiveVideo,',
    'body:not(.sdp-custom-wp-active) #bgLivePhoto,body:not(.sdp-custom-wp-active) #v58EdgeVignette,',
    'body:not(.sdp-custom-wp-active) #bgContrastScrim,body:not(.sdp-custom-wp-active) #bgLiveCanvas,',
    'body:not(.sdp-custom-wp-active) #bgLivePhotoAmbilight,body:not(.sdp-custom-wp-active) .ambient-blobs,',
    'body:not(.sdp-custom-wp-active) .bg-blobs{display:none !important;opacity:0 !important;visibility:hidden !important;}',
    '.glass,.card,#homeHero,.sheet,.layer,.wordcard,.modal,.v58-tile,.v59-dict-card,#tabbar,.topbar{',
    '  backdrop-filter:none !important;-webkit-backdrop-filter:none !important;',
    '}',
    '.glass,.card,#homeHero,.sheet,.layer,.wordcard,.modal{',
    '  background:#18181B !important;border:1px solid rgba(255,255,255,0.08) !important;',
    '  border-radius:16px !important;box-shadow:0 4px 20px rgba(0,0,0,0.35) !important;color:#FAFAFA !important;',
    '}',
    '.glass:after,.glass:before{display:none !important;}',
    'body.sdp-nextgen .btn,body.sdp-nextgen button{font-family:var(--font-sans) !important;box-shadow:none !important;transform:none !important;}',
    'body.sdp-nextgen .btn.primary{background:#38BDF8 !important;color:#09090B !important;border:0 !important;font-weight:700 !important;}',
    'body.sdp-nextgen .btn.soft,body.sdp-nextgen .btn.ghost{background:#27272A !important;color:#FAFAFA !important;border:1px solid rgba(255,255,255,0.10) !important;}',
    'body.sdp-nextgen .chip{background:#18181B !important;border:1px solid rgba(255,255,255,0.10) !important;color:#A1A1AA !important;border-radius:999px !important;}',
    '/* Sinhala typography */',
    '[lang="si"] .si-text,body.lang-si .si-text,.sdp-si-pill,.sdp-si-meaning,.si-text,',
    'html[lang="si"] .sdp-hero-title,html[lang="si"] .sdp-sec-title{line-height:1.62 !important;letter-spacing:0.01em !important;word-break:keep-all;overflow-wrap:anywhere;}',
    '/* legacy chrome that must never show again */',
    '#topDataBadge,#topDataBadge.chip{display:none !important;visibility:hidden !important;pointer-events:none !important;}',
    '#app .topbar .top-controls{display:none !important;}',
    '#app .topbar .brand{display:none !important;}',
    '#v58EdgeVignette,#v58HomeFooter,#homeCredits,#v58VoiceBadge,#homeMeta{display:none !important;}',
    '#v58PracticeBento,#v58ProgressArchiveCard,#v58ArchiveDisclosure,#v58CommunityDisclosure{display:none !important;}',
    '#btnGuide,.hero-credit{display:none !important;}',
    '#homeKicker,#homeTitle,#homeSub{position:absolute !important;width:1px !important;height:1px !important;overflow:hidden !important;clip:rect(0 0 0 0) !important;white-space:nowrap !important;}',
    '#credit{display:none !important;position:static !important;transform:none !important;}',
    '#v58KbdHud{display:none !important;}',
    '/* ---- 54px topbar ---- */',
    '.topbar,.topbar.glass{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;margin:0 !important;',
    '  height:54px !important;min-height:54px !important;max-height:54px !important;max-width:100% !important;',
    '  padding:0 14px !important;border-radius:0 !important;display:flex !important;align-items:center !important;',
    '  justify-content:space-between !important;background:rgba(9,9,11,0.92) !important;',
    '  border:0 !important;border-bottom:1px solid rgba(255,255,255,0.07) !important;box-shadow:none !important;z-index:60 !important;}',
    '#sdpBrand{display:flex;align-items:center;gap:9px;min-width:0;}',
    '#sdpBrandMark{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#38BDF8,#0284C7);',
    '  display:flex;align-items:center;justify-content:center;font-size:16px;flex:none;box-shadow:0 2px 10px rgba(56,189,248,0.28);}',
    '#sdpBrandStack{display:flex;flex-direction:column;min-width:0;line-height:1.15;}',
    '#sdpBrandRow{display:flex;align-items:center;gap:5px;}',
    '#sdpBrandTitle{font-size:14px;font-weight:700;color:#FAFAFA;letter-spacing:-0.01em;white-space:nowrap;}',
    '#sdpBrandPill{font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;background:rgba(56,189,248,0.16);color:#38BDF8;line-height:1.5;}',
    '#sdpBrandSub{font-size:11px;color:#71717A;white-space:nowrap;}',
    '#sdpTopCluster{display:flex;align-items:center;gap:7px;flex:none;}',
    '#sdpTopVoiceBtn,#btnOpenSettingsTop{width:34px;height:34px;border-radius:10px;background:#18181B;',
    '  border:1px solid rgba(255,255,255,0.10);color:#FAFAFA;display:inline-flex;align-items:center;justify-content:center;',
    '  font-size:15px;cursor:pointer;padding:0;line-height:1;}',
    '#sdpTopVoiceBtn{background:rgba(56,189,248,0.12) !important;border:1px solid rgba(56,189,248,0.35) !important;color:#38BDF8;}',
    '#sdpTopLangPill{height:34px;padding:0 11px;border-radius:999px;background:#18181B;border:1px solid rgba(255,255,255,0.10);',
    '  color:#A1A1AA;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;line-height:1;}',
    '#sdpTopLangPill b{color:#FAFAFA;font-weight:700;}',
    '#sdpTopLangPill[data-lang="si"] b:first-child{color:#A1A1AA;font-weight:600;}',
    '#sdpTopLangPill[data-lang="si"] b:last-child{color:#FAFAFA;font-weight:700;}',
    '#app{padding-top:66px !important;padding-bottom:calc(78px + env(safe-area-inset-bottom,0px)) !important;}',
    /* ---- mobile 5-tab bar ---- */
    '#tabbar,#tabbar.glass{position:fixed !important;left:0 !important;right:0 !important;bottom:0 !important;top:auto !important;',
    '  height:60px !important;min-height:60px !important;max-height:60px !important;margin:0 !important;padding:0 !important;',
    '  border-radius:0 !important;background:rgba(9,9,11,0.95) !important;border:0 !important;',
    '  border-top:1px solid rgba(255,255,255,0.08) !important;display:grid !important;',
    '  grid-template-columns:repeat(5,1fr) !important;z-index:60 !important;box-shadow:none !important;',
    '  transform:none !important;width:100% !important;max-width:100% !important;}',
    '#tabbar .tab-ind{display:none !important;}',
    '#tabbar button{display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;',
    '  gap:3px !important;background:transparent !important;border:0 !important;border-radius:0 !important;padding:0 !important;',
    '  min-height:60px !important;color:#71717A !important;font-size:10px !important;font-weight:600 !important;line-height:1.1 !important;}',
    '#tabbar button svg{width:20px !important;height:20px !important;opacity:0.9;}',
    '#tabbar button[aria-selected="true"]{color:#38BDF8 !important;}',
    '#tabbar button[aria-selected="true"] svg{color:#38BDF8;}',
    '#tabbar button span{font-size:10px !important;white-space:nowrap;}',
    '#commBadge{display:none !important;}',
    /* ---- desktop 232px rail ---- */
    '#sdpDesktopRail{display:none;}',
    '@media (min-width:1024px){',
    '  #tabbar,#tabbar.glass{display:none !important;}',
    '  .topbar,.topbar.glass{left:232px !important;width:calc(100% - 232px) !important;}',
    '  #sdpDesktopRail{display:flex !important;position:fixed;top:0;left:0;bottom:0;width:232px;background:#0D0D10;',
    '    border-right:1px solid rgba(255,255,255,0.08);padding:18px 14px;flex-direction:column;justify-content:space-between;z-index:70;}',
    '  #app{margin-left:232px !important;max-width:calc(100vw - 232px) !important;padding:72px 28px 36px !important;}',
    '  /* full-screen reading layers start to the right of the rail so nothing is',
    '     ever hidden behind it, and the rail itself sits under every overlay */',
    '  #layers .layer{left:232px !important;right:0 !important;}',
    '  #sdpDesktopRail{z-index:55 !important;}',
    '}',
    '#sdpRailBrand{display:flex;align-items:center;gap:9px;margin-bottom:18px;}',
    '#sdpRailNav{display:flex;flex-direction:column;gap:4px;}',
    '#sdpRailNav button{display:flex !important;align-items:center;gap:10px;width:100%;height:40px;padding:0 11px !important;',
    '  border-radius:10px !important;background:transparent !important;border:1px solid transparent !important;',
    '  color:#A1A1AA !important;font-size:13px !important;font-weight:600 !important;cursor:pointer;text-align:left;justify-content:flex-start !important;}',
    '#sdpRailNav button[aria-current="true"]{background:rgba(56,189,248,0.14) !important;color:#38BDF8 !important;border:1px solid rgba(56,189,248,0.3) !important;}',
    '#creditDockedDesktop{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#FDE68A;',
    '  padding:7px 10px;border-radius:999px;background:rgba(251,191,36,0.10);border:1px solid rgba(251,191,36,0.28);justify-content:center;}',
    /* ---- home: greeting / hero / stats / quick practice ---- */
    '#screen-home .v58-workspace{display:block !important;}',
    '#sdpHomeGreeting{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 10px;}',
    '#sdpGreetText{font-size:16px;font-weight:700;color:#FAFAFA;}',
    '#sdpGreetSession{font-size:12px;color:#A1A1AA;white-space:nowrap;}',
    '#homeHero{position:relative;padding:18px !important;margin-bottom:12px !important;border-radius:16px !important;}',
    '.anatomy-stage{padding:0 !important;margin:0 !important;}',
    '.lg-hero{margin:0 !important;}',
    '#sdpHeroIdleView{display:block;}',
    '.sdp-hero-kicker{display:inline-block;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#38BDF8;text-transform:uppercase;}',
    '.sdp-hero-title{font-size:20px;font-weight:800;line-height:1.25;color:#FAFAFA;margin:6px 0 4px;letter-spacing:-0.01em;}',
    '.sdp-hero-sub{font-size:12.5px;color:#A1A1AA;margin:0 0 12px;line-height:1.5;}',
    '#sdpHeroConfigChips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;}',
    '#sdpHeroConfigChips .sdp-chip{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:999px;',
    '  background:#27272A;border:1px solid rgba(255,255,255,0.08);color:#A1A1AA;font-size:11.5px;font-weight:600;cursor:pointer;}',
    '.hero-actions{display:flex !important;flex-direction:column !important;gap:8px !important;}',
    '#btnStart{width:100% !important;height:48px !important;min-height:48px !important;border-radius:12px !important;',
    '  background:#38BDF8 !important;color:#09090B !important;font-weight:700 !important;font-size:15px !important;',
    '  display:flex !important;align-items:center !important;justify-content:space-between !important;padding:0 16px !important;',
    '  border:0 !important;box-shadow:none !important;gap:10px !important;}',
    '#btnStart svg{width:18px !important;height:18px !important;flex:none;color:#09090B;}',
    '#btnStartText{flex:1 1 auto;text-align:left;}',
    '#sdpStartEta{font-size:12px;font-weight:600;opacity:0.85;white-space:nowrap;}',
    '#btnHowItWorks{width:100%;height:38px;min-height:38px;border-radius:10px;background:rgba(255,255,255,0.03);',
    '  border:1px solid rgba(255,255,255,0.08);color:#A1A1AA;font-size:12.5px;font-weight:600;cursor:pointer;}',
    '#segMode{display:none !important;}',
    '#v58OfflineRow{display:none !important;}',
    '#sdpHomeStatsRow{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;}',
    '.sdp-stat{background:#18181B;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 11px;min-width:0;}',
    '.sdp-stat-label{font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.sdp-stat-value{font-size:16px;font-weight:800;color:#FAFAFA;margin-top:2px;line-height:1.2;}',
    '.sdp-stat.ok .sdp-stat-value{color:#4ADE80;}',
    '.sdp-stat.warn .sdp-stat-value{color:#FBBF24;}',
    '#sdpQuickWrap{margin-bottom:14px;}',
    '.sdp-sec-title{font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#71717A;font-weight:700;margin:4px 0 8px;}',
    '#sdpQuickPracticeGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}',
    '.sdp-qp{display:flex;flex-direction:column;gap:3px;align-items:flex-start;text-align:left;padding:11px 12px;',
    '  background:#18181B;border:1px solid rgba(255,255,255,0.08);border-radius:12px;color:#FAFAFA;cursor:pointer;',
    '  min-height:70px;justify-content:center;position:relative;}',
    '.sdp-qp b{font-size:13px;font-weight:700;line-height:1.25;}',
    '.sdp-qp i{font-style:normal;font-size:11px;color:#71717A;line-height:1.4;}',
    '.sdp-qp-ico{font-size:16px;line-height:1;}',
    '.sdp-qp .sdp-badge{position:absolute;top:8px;right:8px;font-size:10px;font-weight:800;color:#FBBF24;',
    '  background:rgba(251,191,36,0.14);border:1px solid rgba(251,191,36,0.34);border-radius:999px;padding:0 6px;line-height:16px;}',
    /* ---- cockpit ---- */
    '#sdpEdgeBar{position:absolute;top:0;left:0;right:0;height:4px;background:rgba(255,255,255,0.06);overflow:hidden;border-radius:16px 16px 0 0;z-index:3;}',
    '#sdpEdgeBarFill{height:100%;width:0;background:#38BDF8;transition:width 0.15s linear,background-color 0.2s ease;}',
    '#sdpEdgeBar.is-listen #sdpEdgeBarFill{background:#38BDF8;}',
    '#sdpEdgeBar.is-write #sdpEdgeBarFill{background:#FBBF24;}',
    '#sdpEdgeBar.is-review #sdpEdgeBarFill{background:#4ADE80;}',
    '#sdpCockpitHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:2px 0 10px;flex-wrap:nowrap;}',
    '#sdpCockpitHead #plCount{font-size:13px;font-weight:700;color:#FAFAFA;font-variant-numeric:tabular-nums;margin:0;}',
    '#sdpPhasePill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;',
    '  background:rgba(56,189,248,0.14);color:#38BDF8;border:1px solid rgba(56,189,248,0.3);white-space:nowrap;}',
    '#sdpPhasePill .dot{width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;}',
    '#sdpPhasePill.is-write{background:rgba(251,191,36,0.14);color:#FBBF24;border-color:rgba(251,191,36,0.3);}',
    '#sdpPhasePill.is-review{background:rgba(74,222,128,0.14);color:#4ADE80;border-color:rgba(74,222,128,0.3);}',
    '#sdpTimerPill{position:static !important;width:auto !important;height:34px !important;display:inline-flex !important;',
    '  align-items:center !important;gap:7px !important;padding:0 10px !important;border-radius:999px !important;',
    '  background:#27272A !important;border:1px solid rgba(255,255,255,0.10) !important;flex:none;}',
    '#sdpTimerPill .countdown{position:static !important;width:auto !important;height:auto !important;display:inline-flex !important;',
    '  align-items:center !important;gap:6px !important;background:none !important;border:0 !important;margin:0 !important;padding:0 !important;}',
    '#sdpTimerPill .countdown svg{width:20px !important;height:20px !important;}',
    '#sdpTimerPill #cdNum{font-family:var(--font-mono) !important;font-variant-numeric:tabular-nums;font-size:13px;font-weight:700;',
    '  color:#FBBF24;position:static !important;margin:0 !important;padding:0 !important;line-height:1;}',
    '#sdpTimerPill .countdown svg{display:none;}',
    '#sdpTimerPill #cdNum{min-width:34px;text-align:right;}',
    '.layer .lbody .wordcard{padding:14px !important;position:relative;overflow:hidden;}',
    '.layer .lbody .wordcard #plStatus{display:none !important;}',
    '#plStep,#plStepBadge,#plBars{display:none !important;}',
    '#plWord{font-size:34px !important;font-weight:800 !important;color:#FAFAFA !important;letter-spacing:-0.01em;}',
    '#plSub,#plHint,#plCategory{color:#A1A1AA !important;font-size:12.5px !important;}',
    '#plProgText{display:none !important;}',
    '#plFill{background:#38BDF8 !important;}',
    '.layer .lbody .row:has(.lens){display:none !important;}',
    '.lens{display:none !important;}',
    '.countdown{display:none !important;}',
    '#plProgressDots{display:none !important;}',
    '#ansSlots{display:flex !important;flex-wrap:wrap;gap:6px;justify-content:center;}',
    '#ansSlots .slot,.ans-slots .slot{width:36px !important;height:42px !important;border-radius:8px !important;',
    '  border:1px solid rgba(255,255,255,0.14) !important;background:#09090B !important;color:#FAFAFA !important;font-size:19px !important;}',
    '#ansInput{background:#09090B !important;border:1px solid rgba(255,255,255,0.14) !important;border-radius:12px !important;',
    '  color:#FAFAFA !important;height:48px !important;font-size:19px !important;}',
    '#sdpHelperDock{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px;}',
    '#sdpHelperDock button{display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;',
    '  gap:3px;height:46px;min-height:46px;border-radius:10px;background:#27272A !important;border:1px solid rgba(255,255,255,0.08) !important;',
    '  color:#FAFAFA !important;font-size:10.5px !important;font-weight:600 !important;cursor:pointer;padding:0 4px !important;line-height:1.15;}',
    '#sdpHelperDock button:active{background:#3f3f46 !important;}',
    '#sdpCockpitFoot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;}',
    '#sdpCockpitFoot .sdp-voice{font-size:11px;color:#71717A;}',
    '#sdpCockpitFoot .sdp-actions{display:flex;gap:6px;}',
    '#sdpCockpitFoot .sdp-actions button{width:36px;height:36px;border-radius:10px;background:#27272A;border:1px solid rgba(255,255,255,0.10);',
    '  color:#FAFAFA;font-size:14px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;}',
    '#sdpDictLivePanel{margin-top:12px;}',
    '#sdpLiveCounters{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;}',
    '.sdp-live{background:#18181B;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:8px 10px;text-align:center;}',
    '.sdp-live i{display:block;font-style:normal;font-size:9.5px;font-weight:700;letter-spacing:0.06em;color:#71717A;text-transform:uppercase;}',
    '.sdp-live b{display:block;font-size:15px;font-weight:800;color:#FAFAFA;margin-top:1px;}',
    '.sdp-live.ok b{color:#4ADE80;}.sdp-live.warn b{color:#FBBF24;}',
    '#sdpWordMapCard{background:#18181B;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:11px;}',
    '#sdpWordMapTitle{font-size:10.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;margin-bottom:8px;}',
    '#sdpWordMap{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;}',
    '.sdp-wm{display:flex;align-items:center;justify-content:center;height:24px;border-radius:6px;background:#27272A;',
    '  color:#71717A;font-size:10.5px;font-weight:700;border:1px solid transparent;font-variant-numeric:tabular-nums;}',
    '.sdp-wm.done{color:#4ADE80;border-color:rgba(74,222,128,0.45);background:rgba(74,222,128,0.10);}',
    '.sdp-wm.cur{border:1.5px solid #38BDF8;background:rgba(56,189,248,0.18);color:#FAFAFA;box-shadow:0 0 0 2px rgba(56,189,248,0.15);}',
    '.sdp-wm.missed{color:#FBBF24;border-color:rgba(251,191,36,0.45);background:rgba(251,191,36,0.10);}',
    /* ---- settings ---- */
    '#screen-set{padding-bottom:24px;}',
    '#sdpNextGenSettings{display:flex;flex-direction:column;gap:12px;margin-bottom:14px;}',
    '.sdp-set-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:2px 2px 0;}',
    '.sdp-set-title{font-size:20px;font-weight:800;color:#FAFAFA;letter-spacing:-0.01em;}',
    '.sdp-set-sub{color:#38BDF8;font-size:12px;font-weight:600;}',
    '.sdp-tier{background:#18181B;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;}',
    '.sdp-tier-head{display:flex;align-items:center;gap:8px;padding:12px 14px 6px;}',
    '.sdp-tier-head b{font-size:10.5px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;color:#38BDF8;}',
    '.sdp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-top:1px solid rgba(255,255,255,0.06);}',
    '.sdp-row:first-of-type{border-top:0;}',
    '.sdp-row-l{min-width:0;flex:1 1 auto;}',
    '.sdp-row-t{font-size:13.5px;font-weight:600;color:#FAFAFA;line-height:1.35;}',
    '.sdp-row-s{font-size:11.5px;color:#71717A;line-height:1.4;margin-top:1px;}',
    '.sdp-row-r{flex:none;display:flex;align-items:center;gap:6px;}',
    '.sdp-seg{display:inline-flex;background:#09090B;border:1px solid rgba(255,255,255,0.10);border-radius:10px;padding:3px;gap:2px;}',
    '.sdp-seg button{border:0;background:transparent !important;color:#A1A1AA !important;font-size:11.5px !important;font-weight:600 !important;',
    '  padding:5px 9px !important;border-radius:7px !important;cursor:pointer;white-space:nowrap;min-height:26px !important;line-height:1.2 !important;}',
    '.sdp-seg button[aria-pressed="true"]{background:#38BDF8 !important;color:#09090B !important;font-weight:700 !important;}',
    '.sdp-value{font-size:12px;font-weight:700;color:#38BDF8;white-space:nowrap;min-width:34px;text-align:right;}',
    '#sdpRangeWait{width:100%;accent-color:#38BDF8;min-height:24px;}',
    '.sdp-range-wrap{width:100%;max-width:220px;}',
    '.sdp-scale{display:flex;justify-content:space-between;font-size:10px;color:#71717A;margin-top:-2px;}',
    '.sdp-toggle{position:relative;width:42px;height:24px;border-radius:999px;background:#27272A;border:1px solid rgba(255,255,255,0.12);cursor:pointer;padding:0;flex:none;}',
    '.sdp-toggle:after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#A1A1AA;transition:transform 0.15s ease,background 0.15s ease;}',
    '.sdp-toggle[aria-checked="true"]{background:rgba(56,189,248,0.30);border-color:#38BDF8;}',
    '.sdp-toggle[aria-checked="true"]:after{transform:translateX(18px);background:#38BDF8;}',
    '#sdpVoiceCard .sdp-voice-name{font-size:13px;font-weight:700;color:#FAFAFA;}',
    '#sdpVoiceTestBtn{height:34px;border-radius:10px;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.35);',
    '  color:#38BDF8;font-size:12px;font-weight:700;padding:0 12px;cursor:pointer;}',
    '#sdpOfflineLine{font-size:11.5px;color:#4ADE80;}',
    '#sdpAppearanceAccordion{background:#18181B;border:1px solid rgba(255,255,255,0.08);border-radius:16px;margin-top:4px;overflow:hidden;}',
    '#sdpAppearanceAccordion>summary{list-style:none;cursor:pointer;padding:13px 14px;font-size:12.5px;font-weight:700;color:#A1A1AA;display:flex;align-items:center;gap:8px;}',
    '#sdpAppearanceAccordion>summary::-webkit-details-marker{display:none;}',
    '#sdpAppearanceAccordion>summary::after{content:"▾";margin-left:auto;transition:transform .2s ease;}',
    '#sdpAppearanceAccordion[open]>summary::after{transform:rotate(180deg);}',
    '#sdpAppearanceAccordion>summary{border-bottom:1px solid transparent;}',
    '#sdpAppearanceAccordion[open]>summary{border-bottom-color:rgba(255,255,255,0.08);}',
    '#sdpAppearanceBody{padding:10px 12px 14px;display:flex;flex-direction:column;gap:10px;}',
    '#sdpAppearanceBody #btnAdmin{display:inline-flex !important;width:auto !important;height:36px;padding:0 12px;',
    '  border-radius:10px;background:#27272A !important;color:#FAFAFA !important;border:1px solid rgba(255,255,255,0.12) !important;align-items:center;gap:6px;}',
    '#sdpAppearanceBody #btnAdmin svg{width:16px;height:16px;}',
    /* ---- words explorer ---- */
    '#sdpWordsHead{background:#18181B;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:14px;margin-bottom:10px;}',
    '#sdpWordsTitle{font-size:18px;font-weight:800;color:#FAFAFA;letter-spacing:-0.01em;}',
    '#sdpWordsSub{font-size:11.5px;color:#71717A;margin-top:2px;}',
    '#sdpWordFilterRow{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}',
    '#sdpWordFilterRow button{height:28px;padding:0 11px;border-radius:999px;background:#27272A;border:1px solid rgba(255,255,255,0.08);',
    '  color:#A1A1AA;font-size:11.5px;font-weight:600;cursor:pointer;}',
    '#sdpWordFilterRow button[aria-pressed="true"]{background:rgba(56,189,248,0.16);border-color:rgba(56,189,248,0.4);color:#38BDF8;}',
    '#dictSearch{background:#09090B !important;border:1px solid rgba(255,255,255,0.10) !important;border-radius:10px !important;',
    '  color:#FAFAFA !important;height:40px;padding:0 12px;width:100%;}',
    '#dictList>.v59-dict-card,.v59-dict-card{position:relative;padding:14px 14px 14px 46px !important;margin:8px 0 !important;',
    '  border-radius:14px !important;background:#18181B !important;border:1px solid rgba(255,255,255,0.08) !important;',
    '  box-shadow:none !important;white-space:normal !important;overflow:visible !important;text-overflow:unset !important;}',
    '.v59-dict-card .v59-idx{position:absolute;top:14px;left:12px;width:28px;height:28px;border-radius:8px;background:#27272A;',
    '  display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;color:#A1A1AA;padding:0;}',
    '.v59-dict-card .v59-word{font-size:17px !important;font-weight:700 !important;color:#FAFAFA !important;}',
    '.v59-dict-card .v59-ipa{font-family:var(--font-mono) !important;font-size:13px !important;color:#38BDF8 !important;',
    '  background:none !important;border:0 !important;padding:0 !important;}',
    '.v59-dict-card .v59-pos{font-size:12px !important;font-style:italic;color:#71717A !important;border:0 !important;background:none !important;padding:0 !important;}',
    '.v59-dict-card .v59-def,.v59-dict-card .v59-ex{display:block !important;white-space:normal !important;overflow:visible !important;',
    '  -webkit-line-clamp:unset !important;text-overflow:unset !important;max-height:none !important;}',
    '.v59-dict-card .v59-def{font-size:13.5px !important;color:#D4D4D8 !important;line-height:1.48 !important;margin-top:4px !important;}',
    '.v59-dict-card .v59-ex{font-size:13px !important;color:#A1A1AA !important;line-height:1.48 !important;font-style:normal !important;margin-top:4px !important;}',
    '.v59-dict-card .v59-ex strong{color:#FAFAFA;font-weight:700;}',
    '.v59-dict-card .v59-actions{margin-top:8px;gap:8px !important;flex-wrap:wrap !important;}',
    '.v59-dict-card .v59-actions .btn{width:36px;height:36px;min-height:36px !important;padding:0 !important;border-radius:50% !important;',
    '  font-size:0 !important;overflow:hidden;}',
    '.v59-dict-card .v59-actions .btn svg{width:16px;height:16px;}',
    '.v59-si-chip.button,.v59-si-chip{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:999px;',
    '  background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.30);color:#7dd3fc;font-size:11.5px;font-weight:600;line-height:1.62;}',
    '.v59-si-text{font-size:13px !important;line-height:1.62 !important;color:#FDE68A !important;margin-top:6px !important;}',
    '.sdp-si-pill{display:inline-flex;align-items:center;gap:5px;min-height:26px;padding:2px 10px;margin-top:8px;border-radius:999px;',
    '  background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.30);color:#7dd3fc;font-size:11.5px;font-weight:600;cursor:pointer;line-height:1.62;}',
    '.sdp-si-pill[aria-expanded="true"]{background:rgba(253,230,138,0.12);border-color:rgba(253,230,138,0.34);color:#FDE68A;}',
    '.sdp-word-num{position:absolute;top:14px;left:12px;width:28px;height:28px;border-radius:8px;background:#27272A;',
    '  display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;color:#A1A1AA;}',
    /* ---- micro toast + credit pill ---- */
    '#microToastLoad{position:fixed;left:14px;bottom:72px;z-index:90;max-width:220px;height:26px;padding:0 10px;border-radius:999px;',
    '  background:rgba(24,24,27,0.92);border:1px solid rgba(255,255,255,0.09);font-size:11px;color:#A1A1AA;',
    '  display:inline-flex;align-items:center;gap:6px;pointer-events:none;transition:opacity .4s ease,transform .4s ease;white-space:nowrap;}',
    '#microToastLoad.out{opacity:0;transform:translateY(6px);}',
    '#creditPill{position:fixed;left:50%;bottom:72px;transform:translateX(-50%);z-index:85;pointer-events:none !important;',
    '  padding:6px 16px;border-radius:999px;background:linear-gradient(90deg,rgba(251,191,36,0.18),rgba(56,189,248,0.18),rgba(251,191,36,0.18));',
    '  background-size:200% 100%;animation:sdpCreditShift 6s linear infinite;border:1px solid rgba(251,191,36,0.45);color:#FDE68A;',
    '  font-size:11.5px;font-weight:800;letter-spacing:0.06em;box-shadow:0 6px 24px rgba(0,0,0,0.45);white-space:nowrap;',
    '  transition:opacity .45s ease,transform .45s ease;}',
    '#creditPill.out{opacity:0;transform:translate(-50%,8px) scale(0.92);}',
    '#creditDocked{position:fixed;left:50%;bottom:68px;transform:translateX(-50%);z-index:84;pointer-events:none;',
    '  font-size:10px;font-weight:700;letter-spacing:0.05em;color:#FDE68A;background:rgba(24,24,27,0.88);',
    '  border:1px solid rgba(251,191,36,0.28);border-radius:999px;padding:3px 11px;opacity:0;transition:opacity .4s ease;white-space:nowrap;}',
    '#creditDocked.on{opacity:1;}',
    '@keyframes sdpCreditShift{0%{background-position:0% 50%}100%{background-position:200% 50%}}',
    '@media (min-width:1024px){#creditPill{bottom:26px;}#creditDocked{display:none;}#microToastLoad{left:246px;bottom:20px;}}',
    '#sdpConfettiCanvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:120;}',
    /* ---- cascade enforcement -------------------------------------------------
       index.html ships ID+pseudo-class !important gradients (#homeHero:not(#x),
       .glass:not(#credit):not(#materialMixer)) that out-rank a plain #id rule.
       Those rules stay in the document for the legacy engines, so the Next-Gen
       surface is re-asserted here with (2,0,2) specificity and longhands. */
    'html body #homeHero:not(#sdpCascadeGuard),html body .glass:not(#sdpCascadeGuard),',
    'html body .card:not(#sdpCascadeGuard):not(#materialMixer),html body .sheet:not(#sdpCascadeGuard),',
    'html body .layer:not(#sdpCascadeGuard),html body .wordcard:not(#sdpCascadeGuard),',
    'html body .modal:not(#sdpCascadeGuard),html body .v58-tile:not(#sdpCascadeGuard),',
    'html body .v59-dict-card:not(#sdpCascadeGuard),html body .sdp-qp:not(#sdpCascadeGuard),',
    'html body .sdp-stat:not(#sdpCascadeGuard),html body .sdp-tier:not(#sdpCascadeGuard){',
    '  background:#18181B !important;background-color:#18181B !important;background-image:none !important;',
    '  border:1px solid rgba(255,255,255,0.08) !important;border-radius:16px !important;',
    '  box-shadow:0 4px 20px rgba(0,0,0,0.35) !important;color:#FAFAFA !important;',
    '  backdrop-filter:none !important;-webkit-backdrop-filter:none !important;',
    '}',
    'html body #sdpWordMapCard:not(#sdpCascadeGuard),html body #sdpDictLivePanel .sdp-live:not(#sdpCascadeGuard){',
    '  background:#18181B !important;background-image:none !important;border:1px solid rgba(255,255,255,0.08) !important;',
    '  border-radius:12px !important;box-shadow:none !important;backdrop-filter:none !important;',
    '}',
    'html body #app .topbar:not(#sdpCascadeGuard){background:rgba(9,9,11,0.92) !important;background-image:none !important;',
    '  border:0 !important;border-bottom:1px solid rgba(255,255,255,0.07) !important;border-radius:0 !important;',
    '  box-shadow:none !important;backdrop-filter:none !important;}',
    'html body #tabbar:not(#sdpCascadeGuard){background:rgba(9,9,11,0.95) !important;background-image:none !important;transform:none !important;',
    '  border:0 !important;border-top:1px solid rgba(255,255,255,0.08) !important;border-radius:0 !important;',
    '  box-shadow:none !important;backdrop-filter:none !important;}',
    'html body #btnStart:not(#sdpCascadeGuard){background:#38BDF8 !important;background-image:none !important;color:#09090B !important;',
    '  border:0 !important;box-shadow:none !important;}',
    'html body .sdp-seg button[aria-pressed="true"]:not(#sdpCascadeGuard){background:#38BDF8 !important;background-image:none !important;color:#09090B !important;}',
    '/* safety rule lost when #sdpV58Css is neutralised: a retry toast never blocks taps */',
    'html body .sdp-retry-toast:not(#sdpCascadeGuard){pointer-events:none !important;z-index:45 !important;bottom:84px !important;}',
    'html body .v58-tile:not(#sdpCascadeGuard){display:none !important;}',
    'html body #app .topbar:not(#sdpCascadeGuard){transform:none !important;}',
    'html body .v58-scrim:not(#sdpCascadeGuard),html body .scrim:not(#sdpCascadeGuard){backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}',
    'html body .v59-si-chip:not(#sdpCascadeGuard),html body .sdp-si-pill:not(#sdpCascadeGuard){background:rgba(56,189,248,0.12) !important;background-image:none !important;}',
    'html body #credit:not(#sdpCascadeGuard){display:none !important;}',
    '/* ---- reward chip ---- */',
    '.sdp-grad-chip{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#4ADE80;',
    '  background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.34);border-radius:999px;padding:4px 10px;margin:6px 0;}',
    '@media (max-width:480px){',
    '  .sdp-seg button{padding:5px 6px !important;font-size:11px !important;}',
    '  #sdpBrandSub{display:none;}',
    '  #sdpWordMap{gap:3px;}.sdp-wm{height:21px;font-size:9.5px;}',
    '}',
    '@media (prefers-reduced-motion:reduce){*{animation-duration:0.001s !important;transition-duration:0.001s !important;}}'
  ].join('\n');

  NG.css = NEXTGEN_CSS;

  NG.injectCss = guard(function () {
    var st = D.getElementById('sdpNextGenCss');
    if (!st) {
      st = mk('style');
      st.id = 'sdpNextGenCss';
      st.setAttribute('data-build', String(BUILD));
      st.textContent = NEXTGEN_CSS;
    }
    try { (D.head || D.documentElement).appendChild(st); } catch (e) {}
    return st;
  }, 'nextgen.injectCss');

  /* ==========================================================================
     3. Sinhala dictionary (natural, no broken strings)
     ========================================================================== */
  var SDP_SI_DICT = {
    app_subtitle: 'CCBE ගාල්ල ශාඛාව · B1 අසා ලිවීමේ පුහුණුව',
    nav_home: 'මුල් පිටුව',
    nav_words: 'වචන 30',
    nav_dictate: 'අසා ලිවීම',
    nav_practice: 'පුහුණුව',
    nav_settings: 'සැකසුම්',
    cta_start_dictation: '▶ අසා ලිවීම අරඹන්න',
    cta_how_it_works: 'භාවිතා කරන ආකාරය · තත් 60 මගපෙන්වීම',
    mode_paper: '📝 කඩදාසියේ ලියන්න',
    mode_typing: '⌨️ ඇප් එකේ ටයිප් කරන්න',
    phase_listen: '● සවන් දෙන්න',
    phase_write: '● දැන් ලියන්න',
    phase_check: '● පිළිතුර පරීක්ෂා කරන්න',
    word_counter: 'වචනය {cur} / {total}',
    btn_repeat: 'නැවත අසන්න',
    btn_slower: 'සෙමින් අසන්න',
    btn_sentence: 'උදාහරණ වාක්‍යය',
    btn_hint: 'අකුරු ඉඟිය',
    btn_pause: 'විරාමය',
    btn_resume: 'නැවත අරඹන්න',
    btn_next: 'ඊළඟ වචනය',
    btn_finish: 'අවසන් කරන්න',
    stat_streak: 'දින පෙළ',
    stat_mastered: 'ප්‍රගුණ කළ වචන',
    stat_weak: 'දුර්වල වචන',
    settings_title: 'සැකසුම්',
    settings_sub: 'පළමුව අසා ලිවීම · සැමවිටම',
    settings_p1: 'ප්‍රමුඛතාව 1 · අසා ලිවීම සහ ඉගෙනුම',
    settings_p2: 'ප්‍රමුඛතාව 2 · හඬ සහ ශ්‍රව්‍ය පරීක්ෂාව',
    settings_p3: 'ප්‍රමුඛතාව 3 · පෙනුම සහ අමතර සැකසුම්',
    set_mode_label: 'ලියන ආකාරය',
    set_mode_sub: 'ඔබ පිළිතුරු ලියන ආකාරය',
    set_speed_label: 'හඬ වේගය',
    set_repeats_label: 'වචනයක් කී වරදීද',
    set_wait_label: 'එක් වචනයකට ලියන කාලය',
    set_wait_sub: 'වචනය කියවූ පසු ලිවීමට ලැබෙන කාලය',
    set_autosent_label: 'උදාහරණ වාක්‍ය කියවන්න',
    set_autosent_sub: 'වචනය පෙන්වූ පසු උදාහරණ වාක්‍යය කියවන්න',
    set_lang_label: 'භාෂාව',
    set_lang_sub: 'බොත්තම් සහ විස්තර සඳහා භාෂාව',
    speed_slow: '0.75× සෙමින්',
    speed_clear: '0.90× පැහැදිලිව',
    speed_normal: '1.0× සාමාන්‍ය',
    toast_load_used: '⚡ පූරණය සඳහා {size} භාවිතා විය',
    toast_load_cached: '⚡ 0 KB · ඔෆ්ලයින් සූදානම්'
  };
  W.SDP_SI_DICT = SDP_SI_DICT;

  function siText(key, vars) {
    var out = SDP_SI_DICT[key] || '';
    if (vars) {
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) out = out.split('{' + k + '}').join(String(vars[k]));
      }
    }
    return out;
  }
  NG.t = function (en, si) { return t(en, si); };
  NG.si = siText;

  /* ==========================================================================
     4. window.SDP_applyLang — flips EVERY Next-Gen node + legacy data-i18n nodes
     ========================================================================== */
  NG.applyLang = guard(function (langCode) {
    var l = langCode === 'si' ? 'si' : 'en', i, nodes;
    try {
      D.documentElement.setAttribute('lang', l);
      D.documentElement.setAttribute('data-lang', l);
      if (D.body) { D.body.className = String(D.body.className || '').replace(/\blang-(si|en)\b/g, '').trim() + ' lang-' + l; }
    } catch (e) {}
    /* Next-Gen nodes advertise their own bilingual pair */
    nodes = $$('[data-ng-en]');
    for (i = 0; i < nodes.length; i++) {
      try {
        nodes[i].textContent = l === 'si' ? (nodes[i].getAttribute('data-ng-si') || nodes[i].getAttribute('data-ng-en')) : nodes[i].getAttribute('data-ng-en');
      } catch (e) {}
    }
    /* legacy nodes that follow the v58 pair */
    nodes = $$('[data-v58-en]');
    for (i = 0; i < nodes.length; i++) {
      try {
        var en = nodes[i].getAttribute('data-v58-en');
        var si = nodes[i].getAttribute('data-v58-si');
        if (en != null) nodes[i].textContent = l === 'si' && si ? si : en;
      } catch (e) {}
    }
    /* legacy [data-i18n] nodes are owned by index.html's UI.applyLang */
    try { var u = UI(); if (u && u.applyLang && !NG.__inApply) { NG.__inApply = true; u.applyLang(); NG.__inApply = false; } } catch (e) {}
    /* topbar language pill + settings segment reflect the state */
    try {
      var pill = $('#sdpTopLangPill');
      if (pill) {
        pill.setAttribute('data-lang', l);
        pill.setAttribute('aria-label', l === 'si' ? 'Switch to English' : 'සිංහල භාෂාවට මාරු වන්න');
      }
      var seg = $('#sdpSegLang');
      if (seg) {
        var bs = seg.getElementsByTagName('button');
        for (i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-lang') === l ? 'true' : 'false');
      }
    } catch (e) {}
    try { NG.refreshHome(); NG.refreshSettingsValues(); } catch (e) {}
    return l;
  }, 'nextgen.applyLang');

  W.SDP_applyLang = function (l) { return NG.applyLang(l); };

  NG.setLang = guard(function (l) {
    var st = settings();
    st.lang = l === 'si' ? 'si' : 'en';
    st.guideLang = st.lang;
    saveSettings();
    NG.applyLang(st.lang);
    toast(st.lang === 'si' ? 'භාෂාව සිංහල බවට වෙනස් විය' : 'Interface language: English', { ms: 1600 });
    return st.lang;
  }, 'nextgen.setLang');

  /* ==========================================================================
     5. Topbar — 54px single tier, brand + exactly 3 utility controls
     ========================================================================== */
  function speakSample() {
    try {
      var sp = core() && core().Speech;
      var text = 'Alice studio voice ready';
      if (sp && sp.speakSingle) { sp.speakSingle(text); return true; }
      if (W.speechSynthesis && W.SpeechSynthesisUtterance) {
        W.speechSynthesis.speak(new W.SpeechSynthesisUtterance(text));
        return true;
      }
    } catch (e) {}
    return false;
  }

  NG.mountTopbar = guard(function () {
    var bar = $('.topbar');
    if (!bar) return false;
    if (!$('#sdpBrand')) {
      var brand = mk('div');
      brand.id = 'sdpBrand';
      var mark = mk('span');
      mark.id = 'sdpBrandMark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '\uD83E\uDD62';
      var stack = mk('div');
      stack.id = 'sdpBrandStack';
      var row = mk('div');
      row.id = 'sdpBrandRow';
      var title = mk('b');
      title.id = 'sdpBrandTitle';
      title.setAttribute('data-ng-en', 'Smart Dictation');
      title.setAttribute('data-ng-si', 'Smart Dictation');
      title.textContent = 'Smart Dictation';
      var pill = mk('span', '', 'v60');
      pill.id = 'sdpBrandPill';
      row.appendChild(title);
      row.appendChild(pill);
      var sub = mk('span');
      sub.id = 'sdpBrandSub';
      sub.setAttribute('data-ng-en', 'CCBE Galle Branch');
      sub.setAttribute('data-ng-si', 'CCBE \u0D9C\u0DCF\u0DBD\u0DCA\u0DBD \u0DC1\u0DCF\u0D9B\u0DCF\u0DC0');
      sub.textContent = 'CCBE Galle Branch';
      stack.appendChild(row);
      stack.appendChild(sub);
      brand.appendChild(mark);
      brand.appendChild(stack);
      bar.insertBefore(brand, bar.firstChild);
    }
    if (!$('#sdpTopCluster')) {
      var cluster = mk('div');
      cluster.id = 'sdpTopCluster';
      var voice = mk('button');
      voice.id = 'sdpTopVoiceBtn';
      voice.type = 'button';
      voice.textContent = '\uD83C\uDF99\uFE0F';
      voice.setAttribute('aria-label', 'Voice check — play a sample in the active studio voice');
      voice.setAttribute('title', 'Voice check');
      on(voice, 'click', function () {
        var ok = speakSample();
        toast(ok ? '🎙️ Alice studio voice ready' : 'Voice engine is warming up…', { ms: 1800 });
      });
      var langPill = mk('button');
      langPill.id = 'sdpTopLangPill';
      langPill.type = 'button';
      langPill.setAttribute('data-lang', 'en');
      var bEn = mk('b', '', 'EN');
      var sep = mk('span', '', '·');
      sep.style.opacity = '0.5';
      var bSi = mk('b', '', 'සිංහල');
      langPill.appendChild(bEn);
      langPill.appendChild(sep);
      langPill.appendChild(bSi);
      on(langPill, 'click', function () { NG.setLang(lang() === 'si' ? 'en' : 'si'); });
      var gear = mk('button');
      gear.id = 'btnOpenSettingsTop';
      gear.type = 'button';
      gear.textContent = '\u2699\uFE0F';
      gear.setAttribute('aria-label', 'Open settings');
      gear.setAttribute('title', 'Settings');
      on(gear, 'click', function () {
        try { var u = UI(); if (u && u.setTab) u.setTab('set'); } catch (e) {}
      });
      cluster.appendChild(voice);
      cluster.appendChild(langPill);
      cluster.appendChild(gear);
      bar.appendChild(cluster);
    }
    return true;
  }, 'nextgen.mountTopbar');

  /* ==========================================================================
     6. Navigation — 5 mobile tabs + 232px desktop rail
     ========================================================================== */
  var TABS = {
    'tab-home': ['Home', 'මුල් පිටුව', 'home'],
    'tab-dict': ['Words', 'වචන 30', 'dict'],
    'tab-comm': ['Dictate', 'අසා ලිවීම', 'dictate'],
    'tab-practice': ['Practice', 'පුහුණුව', 'practice'],
    'tab-set': ['Settings', 'සැකසුම්', 'set']
  };
  var RAIL_ICONS = { home: '\uD83C\uDFE0', dict: '\uD83D\uDCD6', dictate: '\uD83C\uDFA7', practice: '\uD83C\uDFAF', set: '\u2699\uFE0F' };

  function goto(tab) {
    var u = UI();
    try {
      if (tab === 'dictate') {
        if (u && u.setTab) u.setTab('home');
        setTimeout(function () {
          try {
            var hero = $('#homeHero');
            if (hero && hero.scrollIntoView) hero.scrollIntoView({ block: 'start' });
            var start = $('#btnStart');
            if (start && start.focus) start.focus();
          } catch (e) {}
        }, 60);
        return;
      }
      if (u && u.setTab) u.setTab(tab);
    } catch (e) {}
  }

  NG.mountTabs = guard(function () {
    var i, btn, def, span, use;
    for (var id in TABS) {
      if (!Object.prototype.hasOwnProperty.call(TABS, id)) continue;
      btn = D.getElementById(id);
      if (!btn) continue;
      def = TABS[id];
      if (btn.getAttribute('data-ng-tab') !== VERSION) {
        btn.setAttribute('data-ng-tab', VERSION);
        span = btn.getElementsByTagName('span')[0];
        if (span) {
          span.removeAttribute('data-i18n');
          span.setAttribute('data-ng-en', def[0]);
          span.setAttribute('data-ng-si', def[1]);
          span.textContent = lang() === 'si' ? def[1] : def[0];
        }
        if (def[2] === 'dictate') {
          use = btn.getElementsByTagName('use')[0];
          if (use) {
            try { use.setAttribute('href', '#i-mic'); } catch (e) {}
            try { use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#i-mic'); } catch (e) {}
          }
        }
      }
    }
    /* mockup 6.1 order: Home · Words · Dictate · Practice · Settings */
    var dictate = D.getElementById('tab-comm');
    var practice = D.getElementById('tab-practice');
    var tabbar = D.getElementById('tabbar');
    if (dictate && practice && tabbar && dictate.nextElementSibling !== practice) {
      try { tabbar.insertBefore(dictate, practice); } catch (e) {}
    }
    /* Dictate tab never opens the community screen */
    var dt = D.getElementById('tab-comm');
    if (dt && dt.getAttribute('data-ng-wired') !== VERSION) {
      dt.setAttribute('data-ng-wired', VERSION);
      on(dt, 'click', function (ev) {
        try { if (ev && ev.preventDefault) ev.preventDefault(); if (ev && ev.stopPropagation) ev.stopPropagation(); } catch (e) {}
        goto('dictate');
      }, true);
    }
    return true;
  }, 'nextgen.mountTabs');

  NG.mountRail = guard(function () {
    if ($('#sdpDesktopRail')) return true;
    var rail = mk('aside');
    rail.id = 'sdpDesktopRail';
    rail.className = 'sdp-desktop-rail';
    rail.setAttribute('aria-label', 'Main Navigation');
    var top = mk('div');
    var brand = mk('div');
    brand.id = 'sdpRailBrand';
    var m = mk('span');
    m.id = 'sdpBrandMark';
    m.textContent = '\uD83E\uDD62';
    var bs = mk('div');
    bs.id = 'sdpBrandStack';
    var br = mk('div');
    br.id = 'sdpBrandRow';
    var bt = mk('b');
    bt.id = 'sdpBrandTitle';
    bt.textContent = 'Smart Dictation';
    var bp = mk('span', '', 'v60');
    bp.id = 'sdpBrandPill';
    br.appendChild(bt);
    br.appendChild(bp);
    var bsub = mk('span');
    bsub.id = 'sdpBrandSub';
    bsub.setAttribute('data-ng-en', 'CCBE Galle Branch');
    bsub.setAttribute('data-ng-si', 'CCBE \u0D9C\u0DCF\u0DBD\u0DCA\u0DBD \u0DC1\u0DCF\u0D9B\u0DCF\u0DC0');
    bsub.textContent = 'CCBE Galle Branch';
    bs.appendChild(br);
    bs.appendChild(bsub);
    brand.appendChild(m);
    brand.appendChild(bs);
    top.appendChild(brand);
    var nav = mk('div');
    nav.id = 'sdpRailNav';
    var items = [['home', 'Home', 'මුල් පිටුව'], ['dict', 'Words', 'වචන 30'], ['dictate', 'Dictate', 'අසා ලිවීම'], ['practice', 'Practice', 'පුහුණුව'], ['set', 'Settings', 'සැකසුම්']];
    for (var i = 0; i < items.length; i++) {
      (function (it) {
        var b = mk('button');
        b.type = 'button';
        b.setAttribute('data-rail', it[0]);
        var ico = mk('span', 'sdp-rail-ico', RAIL_ICONS[it[0]]);
        ico.style.fontSize = '15px';
        var label = mk('span');
        label.setAttribute('data-ng-en', it[1]);
        label.setAttribute('data-ng-si', it[2]);
        label.textContent = lang() === 'si' ? it[2] : it[1];
        b.appendChild(ico);
        b.appendChild(label);
        on(b, 'click', function () { goto(it[0]); NG.syncRail(); });
        nav.appendChild(b);
      })(items[i]);
    }
    top.appendChild(nav);
    rail.appendChild(top);
    var bottom = mk('div');
    bottom.id = 'creditDockedDesktop';
    bottom.textContent = '\uD83E\uDD62 Crafted by Hansana';
    rail.appendChild(bottom);
    try { D.body.appendChild(rail); } catch (e) {}
    return true;
  }, 'nextgen.mountRail');

  NG.syncRail = function () {
    var tab = 'home';
    try { var u = UI(); if (u && u.tab) tab = u.tab === 'comm' ? 'dictate' : u.tab; } catch (e) {}
    var btns = $$('#sdpRailNav button'), i;
    for (i = 0; i < btns.length; i++) btns[i].setAttribute('aria-current', btns[i].getAttribute('data-rail') === tab ? 'true' : 'false');
  };

  /* ==========================================================================
     7. Home — greeting, next-gen hero, config chips, stats, quick practice
     ========================================================================== */
  function sessionNo() {
    try {
      var d = DB();
      if (d && d.data && d.data.session && d.data.session.no) return String(d.data.session.no);
    } catch (e) {}
    return '8';
  }
  function wordCount() {
    try {
      var d = DB();
      if (d && d.data && d.data.lists) {
        for (var i = 0; i < d.data.lists.length; i++) {
          if (d.data.lists[i].id === d.data.plan.defaultList) return (d.data.lists[i].words || []).length;
        }
        if (d.data.lists[0]) return (d.data.lists[0].words || []).length;
      }
    } catch (e) {}
    return 30;
  }
  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return ['Good morning, Student', 'සුභ උදෑසනක්, ශිෂ්‍යයා'];
    if (h < 17) return ['Good afternoon, Student', 'සුභ දවසක්, ශිෂ්‍යයා'];
    return ['Good evening, Student', 'සුභ සන්ධ්‍යාවක්, ශිෂ්‍යයා'];
  }
  function countMastered() {
    var n = 0, k;
    try {
      var L = Learn();
      if (L && L.loadMasteredWords) {
        var m = L.loadMasteredWords() || {};
        for (k in m) if (Object.prototype.hasOwnProperty.call(m, k)) n++;
        return n;
      }
    } catch (e) {}
    try {
      var raw = W.localStorage.getItem('sdp.masteredWords.v1');
      if (raw) { var o = JSON.parse(raw); for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) n++; }
    } catch (e) {}
    return n;
  }
  function countWeak() {
    try {
      var L = Learn();
      if (L && L.weakCount) return L.weakCount();
      var raw = W.localStorage.getItem('sdp.weakWords.v1');
      if (raw) {
        var o = JSON.parse(raw), n = 0, k;
        for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) n++;
        return n;
      }
    } catch (e) {}
    return 0;
  }
  function streakDays() {
    var keys = ['sdp_gam_v2', 'sdp.streak.v1'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = W.localStorage.getItem(keys[i]);
        if (!raw) continue;
        var o = JSON.parse(raw);
        if (o && typeof o.streak === 'number') return o.streak;
        if (o && typeof o.days === 'number') return o.days;
      } catch (e) {}
    }
    try {
      var d = DB();
      if (d && d.data && d.data.gam && typeof d.data.gam.streak === 'number') return d.data.gam.streak;
    } catch (e) {}
    return 0;
  }

  NG.mountHome = guard(function () {
    var home = $('#screen-home');
    var hero = $('#homeHero');
    if (!home || !hero) return false;
    /* greeting bar */
    if (!$('#sdpHomeGreeting')) {
      var g = mk('div');
      g.id = 'sdpHomeGreeting';
      var gt = mk('div');
      gt.id = 'sdpGreetText';
      var gs = mk('span');
      gs.id = 'sdpGreetSession';
      g.appendChild(gt);
      g.appendChild(gs);
      var stage = hero.parentNode || home;
      stage.insertBefore(g, hero);
    }
    /* hero idle view */
    if (!$('#sdpHeroIdleView')) {
      var view = mk('div');
      view.id = 'sdpHeroIdleView';
      var kicker = mk('span', 'sdp-hero-kicker');
      kicker.id = 'sdpHeroKicker';
      var title = mk('h1', 'sdp-hero-title');
      title.id = 'sdpHeroTitle';
      var sub = mk('p', 'sdp-hero-sub');
      sub.id = 'sdpHeroSub';
      var chips = mk('div');
      chips.id = 'sdpHeroConfigChips';
      view.appendChild(kicker);
      view.appendChild(title);
      view.appendChild(sub);
      view.appendChild(chips);
      hero.insertBefore(view, hero.firstChild);
      var mo = null;
      try {
        if (W.MutationObserver) {
          mo = new W.MutationObserver(function () { NG.refreshHome(); });
          ['homeKicker', 'homeTitle', 'homeSub'].forEach(function (id) {
            var n = D.getElementById(id);
            if (n) mo.observe(n, { childList: true, characterData: true, subtree: true });
          });
        }
      } catch (e) {}
    }
    /* CTA extras */
    var start = $('#btnStart');
    if (start && !$('#sdpStartEta')) {
      var eta = mk('span', '', '≈ 6 min');
      eta.id = 'sdpStartEta';
      start.appendChild(eta);
    }
    var actions = start && start.parentNode;
    if (actions && !$('#btnHowItWorks')) {
      var how = mk('button');
      how.id = 'btnHowItWorks';
      how.type = 'button';
      how.setAttribute('data-ng-en', 'How it works · 60s guide');
      how.setAttribute('data-ng-si', 'භාවිතා කරන ආකාරය · තත් 60 මගපෙන්වීම');
      how.textContent = t('How it works · 60s guide', 'භාවිතා කරන ආකාරය · තත් 60 මගපෙන්වීම');
      on(how, 'click', function () {
        var gbtn = $('#btnGuide');
        if (gbtn) { try { gbtn.click(); return; } catch (e) {} }
        toast(t('Tip: listen, write, then check.', 'ඉඟිය: අසන්න, ලියන්න, පසුව පරීක්ෂා කරන්න.'), { ms: 2600 });
      });
      actions.insertBefore(how, start.nextSibling);
    }
    /* 3-stat strip */
    if (!$('#sdpHomeStatsRow')) {
      var row = mk('div');
      row.id = 'sdpHomeStatsRow';
      var defs = [
        ['sdpStatStreak', '☆ STREAK', 'දින පෙළ', ''],
        ['sdpStatMastered', 'MASTERED', 'ප්‍රගුණ කළ', 'ok'],
        ['sdpStatWeak', 'WEAK WORDS', 'දුර්වල වචන', 'warn']
      ];
      for (var i = 0; i < defs.length; i++) {
        (function (d0) {
          var card = mk('div', 'sdp-stat ' + d0[3]);
          card.id = d0[0];
          var lab = mk('div', 'sdp-stat-label');
          lab.setAttribute('data-ng-en', d0[1]);
          lab.setAttribute('data-ng-si', d0[2]);
          lab.textContent = lang() === 'si' ? d0[2] : d0[1];
          var val = mk('div', 'sdp-stat-value', '–');
          card.appendChild(lab);
          card.appendChild(val);
          row.appendChild(card);
        })(defs[i]);
      }
      var host = hero.parentNode || home;
      host.insertBefore(row, hero.nextSibling);
    }
    /* quick practice 2x2 */
    if (!$('#sdpQuickPracticeGrid')) {
      var wrap = mk('div');
      wrap.id = 'sdpQuickWrap';
      var head = mk('div', 'sdp-sec-title');
      head.setAttribute('data-ng-en', 'QUICK PRACTICE');
      head.setAttribute('data-ng-si', 'ඉක්මන් පුහුණුව');
      head.textContent = t('QUICK PRACTICE', 'ඉක්මන් පුහුණුව');
      var grid = mk('div');
      grid.id = 'sdpQuickPracticeGrid';
      var tiles = [
        ['flash', '🃏', 'Flashcards', 'ෆ්ලෑෂ් කාඩ්', 'word → meaning', 'වචනය → තේරුම'],
        ['quiz', '✨', 'Quiz', 'ප්‍රශ්නාවලිය', '4 choices', 'තේරීම් 4'],
        ['context', '🧩', 'Sentence gap', 'වාක්‍ය හිස්තැන්', 'fill the blank', 'හිස්තැන පුරවන්න'],
        ['weak', '⭐', 'Weak words', 'දුර්වල වචන', 'drill & graduate', 'පුහුණු වන්න']
      ];
      for (var j = 0; j < tiles.length; j++) {
        (function (tl) {
          var b = mk('button', 'sdp-qp');
          b.type = 'button';
          b.setAttribute('data-qp', tl[0]);
          var ico = mk('span', 'sdp-qp-ico', tl[1]);
          ico.style.color = tl[0] === 'quiz' ? '#4ADE80' : (tl[0] === 'context' ? '#C4B5FD' : (tl[0] === 'weak' ? '#FBBF24' : '#38BDF8'));
          var bTitle = mk('b');
          bTitle.setAttribute('data-ng-en', tl[2]);
          bTitle.setAttribute('data-ng-si', tl[3]);
          bTitle.textContent = lang() === 'si' ? tl[3] : tl[2];
          var bSub = mk('i');
          bSub.setAttribute('data-ng-en', tl[4]);
          bSub.setAttribute('data-ng-si', tl[5]);
          bSub.textContent = lang() === 'si' ? tl[5] : tl[4];
          b.appendChild(ico);
          b.appendChild(bTitle);
          b.appendChild(bSub);
          if (tl[0] === 'weak') {
            var badge = mk('span', 'sdp-badge', '0');
            badge.id = 'sdpQuickWeakBadge';
            b.appendChild(badge);
          }
          on(b, 'click', function () { startPractice(tl[0]); });
          grid.appendChild(b);
        })(tiles[j]);
      }
      wrap.appendChild(head);
      wrap.appendChild(grid);
      var bento = $('#v58PracticeBento');
      var host2 = bento ? bento.parentNode : (hero.parentNode || home);
      host2.insertBefore(wrap, bento || null);
    }
    NG.refreshHome();
    return true;
  }, 'nextgen.mountHome');

  function startPractice(kind) {
    try {
      if (kind === 'weak') {
        var L = Learn();
        if (L && L.openWeakWords) { L.openWeakWords(); return; }
      }
      var legacyKind = kind === 'context' ? 'audio' : kind;
      var tile = $('[data-v58-practice="' + legacyKind + '"]');
      if (tile) { tile.click(); if (kind !== 'context') return; }
      if (kind === 'context') {
        var u = UI();
        if (u && u.setTab) u.setTab('practice');
        var s = Screen();
        if (s) {
          s.pracMode = 'context';
          try { if (u && u.segValue && $('#pracMode')) u.segValue($('#pracMode'), 'context'); } catch (e) {}
          try { s.practice(); } catch (e) {}
        }
      }
    } catch (e) {}
  }

  NG.refreshHome = guard(function () {
    var gt = $('#sdpGreetText'), gs = $('#sdpGreetSession');
    var gr = greeting();
    if (gt) gt.textContent = lang() === 'si' ? gr[1] : gr[0];
    if (gs) gs.textContent = t('Session ' + sessionNo(), 'සැසිය ' + sessionNo());
    var kicker = $('#sdpHeroKicker');
    if (kicker) {
      var kRaw = ($('#homeKicker') && $('#homeKicker').textContent) || '';
      var bits = kRaw.split('·');
      var tail = bits.length > 1 ? String(bits[bits.length - 1]).replace(/[●\s]+/g, ' ').trim() : 'CCBE Galle Branch';
      kicker.textContent = '● SESSION ' + sessionNo() + ' · ' + wordCount() + ' ' + (lang() === 'si' ? 'විශේෂණ' : 'ADJECTIVES');
      kicker.setAttribute('title', tail);
    }
    var title = $('#sdpHeroTitle');
    var src = $('#homeTitle');
    if (title && src) {
      var txt = String(src.textContent || '').replace(/^Session\s*\d+\s*[-–]\s*/i, '').trim();
      if (txt) title.textContent = txt;
    }
    var sub = $('#sdpHeroSub');
    if (sub) {
      var st = settings();
      var rateTxt = Number(st.rate || 0.96).toFixed(2);
      sub.textContent = lang() === 'si'
        ? (wordCount() + ' වචන · බ්‍රිතාන්‍ය ඉංග්‍රීසි · 🇬🇧 Alice හඬ')
        : (wordCount() + ' adjectives · UK English · 🇬🇧 Alice studio voice · ' + rateTxt + '×');
    }
    /* config chips */
    var chips = $('#sdpHeroConfigChips');
    if (chips) {
      var st2 = settings();
      var mode = st2.mode === 'type' ? 'type' : 'paper';
      var items = [
        ['m', mode === 'type' ? '⌨️ Typing mode' : '📝 Paper mode', mode === 'type' ? '⌨️ ටයිප් මාදිලිය' : '📝 කඩදාසි මාදිලිය'],
        ['s', '🕓 ' + Number(st2.rate || 0.96).toFixed(2) + '×', '🕓 ' + Number(st2.rate || 0.96).toFixed(2) + '×'],
        ['r', '↻ ×' + Number(st2.repeats || 2) + ' repeats', '↻ ×' + Number(st2.repeats || 2) + ' වරක්'],
        ['w', Number(st2.writeFixed || 5) + 's write', Number(st2.writeFixed || 5) + 'ත ලියන්න']
      ];
      chips.innerHTML = '';
      for (var i = 0; i < items.length; i++) {
        (function (it) {
          var c = mk('button', 'sdp-chip');
          c.type = 'button';
          c.setAttribute('data-chip', it[0]);
          c.textContent = lang() === 'si' ? it[2] : it[1];
          on(c, 'click', function () {
            try { var u = UI(); if (u && u.setTab) u.setTab('set'); } catch (e) {}
          });
          chips.appendChild(c);
        })(items[i]);
      }
    }
    /* stats */
    var masterEl = $('#sdpStatMastered .sdp-stat-value');
    var weakEl = $('#sdpStatWeak .sdp-stat-value');
    var streakEl = $('#sdpStatStreak .sdp-stat-value');
    if (streakEl) streakEl.textContent = t(streakDays() + ' days', streakDays() + ' දින');
    if (masterEl) masterEl.textContent = countMastered() + ' / ' + wordCount();
    if (weakEl) weakEl.textContent = String(countWeak());
    var qw = $('#sdpQuickWeakBadge');
    if (qw) qw.textContent = String(countWeak());
    var eta = $('#sdpStartEta');
    if (eta) {
      var mins = Math.max(3, Math.round(wordCount() * 0.2));
      eta.textContent = t('≈ ' + mins + ' min', '≈ ' + mins + ' මිනි');
    }
    return true;
  }, 'nextgen.refreshHome');

  /* ==========================================================================
     8. Cockpit — 4px edge bar, 34px timer pill, helper dock, 30-word map
     ========================================================================== */
  function eng() { var c = core(); return c && c.Eng ? c.Eng : null; }

  function cockpitNumbers() {
    var e = eng(), cur = 1, total = wordCount();
    try {
      if (e) {
        if (e.words && e.words.length) total = e.words.length;
        cur = (Number(e.idx) || 0) + 1;
      }
    } catch (x) {}
    if (cur > total) cur = total;
    return { cur: cur, total: total };
  }

  function setPhase(phase) {
    var bar = $('#sdpEdgeBar'), pill = $('#sdpPhasePill'), fill = $('#sdpEdgeBarFill');
    var cls = phase === 'write' ? 'write' : (phase === 'review' ? 'review' : 'listen');
    if (bar) {
      bar.className = 'is-' + cls;
      bar.setAttribute('data-phase', cls);
    }
    if (pill) {
      pill.className = cls === 'write' ? 'is-write' : (cls === 'review' ? 'is-review' : 'is-listen');
      var label = pill.getElementsByTagName('span')[1] || pill;
      var txt = cls === 'write' ? t('Writing time', 'දැන් ලියන්න') : (cls === 'review' ? t('Review', 'පිරික්සන්න') : t('Listening', 'සවන් දෙන්න'));
      var dot = pill.querySelector('.dot');
      pill.innerHTML = '';
      var d = mk('span', 'dot');
      d.setAttribute('aria-hidden', 'true');
      pill.appendChild(d);
      var lab = mk('span', '', txt);
      lab.setAttribute('data-ng-en', cls === 'write' ? 'Writing time' : (cls === 'review' ? 'Review' : 'Listening'));
      lab.setAttribute('data-ng-si', cls === 'write' ? 'දැන් ලියන්න' : (cls === 'review' ? 'පිරික්සන්න' : 'සවන් දෙන්න'));
      pill.appendChild(lab);
      pill.setAttribute('aria-live', 'polite');
    }
    if (fill) {
      var e = eng();
      var pct = 0;
      try { pct = e && e.words && e.words.length ? Math.round(((Number(e.idx) || 0) / e.words.length) * 100) : 0; } catch (x) {}
      fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }
  }

  function buildWordMap(total) {
    var map = $('#sdpWordMap');
    if (!map) return null;
    if (Number(map.getAttribute('data-total')) === Number(total)) return map;
    map.setAttribute('data-total', String(total));
    map.innerHTML = '';
    for (var i = 1; i <= total; i++) {
      var p = mk('span', 'sdp-wm', String(i));
      p.setAttribute('data-i', String(i));
      map.appendChild(p);
    }
    return map;
  }

  function syncWordMap(cur, total) {
    var map = buildWordMap(total);
    if (!map) return;
    var pills = map.getElementsByTagName('span'), i, n;
    for (i = 0; i < pills.length; i++) {
      n = i + 1;
      pills[i].className = 'sdp-wm' + (n < cur ? ' done' : (n === cur ? ' cur' : ''));
    }
    var counter = $('#sdpWordCounter');
    if (counter) {
      counter.textContent = lang() === 'si'
        ? siText('word_counter', { cur: cur, total: total })
        : 'Word ' + cur + ' of ' + total;
    }
  }

  var PHASE_TICK = null;
  function detectPhase() {
    var e = eng();
    var cd = $('#cdNum');
    var txt = cd ? String(cd.textContent || '').trim() : '';
    var numeric = /^\d/.test(txt);
    if (e) {
      try {
        if (e.st === 'finished' || e.st === 'review') return 'review';
        if (numeric) return 'write';
        return 'listen';
      } catch (x) {}
    }
    return numeric ? 'write' : 'listen';
  }

  NG.syncCockpit = guard(function () {
    var head = $('#sdpCockpitHead');
    if (!head) return false;
    var nums = cockpitNumbers();
    setPhase(detectPhase());
    syncWordMap(nums.cur, nums.total);
    var live = $('#sdpLiveCounters');
    if (live) {
      var okEl = $('#sdpLiveCorrect'), missEl = $('#sdpLiveMissed'), strEl = $('#sdpLiveStreak');
      var okTxt = ($('#plCorrectCount') && $('#plCorrectCount').textContent) || '✓ 0 Correct';
      var missTxt = ($('#plWrongCount') && $('#plWrongCount').textContent) || '✗ 0 Wrong';
      var strTxt = ($('#plStreakCount') && $('#plStreakCount').textContent) || '🔥 0 Streak';
      if (okEl) okEl.textContent = String(okTxt).replace(/[^\d]/g, '') || '0';
      if (missEl) missEl.textContent = String(missTxt).replace(/[^\d]/g, '') || '0';
      if (strEl) strEl.textContent = String(strTxt).replace(/[^\d]/g, '') || '0';
    }
    return true;
  }, 'nextgen.syncCockpit');

  function bindClick(id, fn) {
    var n = D.getElementById(id);
    if (!n || n.getAttribute('data-ng-bound') === VERSION) return;
    n.setAttribute('data-ng-bound', VERSION);
    on(n, 'click', function (ev) {
      try { if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {}
      fn(n);
    });
  }

  NG.mountCockpit = guard(function () {
    var layer = $('#layers .layer');
    if (!layer) return false;
    var card = $('.wordcard', layer) || $('.lbody .card', layer);
    if (!card) return false;
    /* legacy control grid gets stable ids for the helper dock */
    var grid = $('.ctrlgrid', layer);
    if (grid) {
      var gb = grid.getElementsByTagName('button');
      if (gb[1] && !gb[1].id) gb[1].id = 'btnSentence';
      if (gb[2] && !gb[2].id) gb[2].id = 'btnSlow';
      if (gb[3] && !gb[3].id) gb[3].id = 'btnSpell';
      if (gb[0] && !gb[0].id) gb[0].id = 'btnRepeat';
      if (gb[7] && !gb[7].id) gb[7].id = 'btnNextWord';
    }
    /* 4px edge bar */
    if (!$('#sdpEdgeBar')) {
      var bar = mk('div');
      bar.id = 'sdpEdgeBar';
      bar.className = 'is-listen';
      var fill = mk('div');
      fill.id = 'sdpEdgeBarFill';
      bar.appendChild(fill);
      card.insertBefore(bar, card.firstChild);
    }
    /* cockpit head: word X of N · phase pill · 34px timer pill */
    if (!$('#sdpCockpitHead')) {
      var head = mk('div');
      head.id = 'sdpCockpitHead';
      var counter = mk('div');
      counter.id = 'sdpWordCounter';
      counter.textContent = 'Word 1 of ' + wordCount();
      var pill = mk('span');
      pill.id = 'sdpPhasePill';
      pill.className = 'is-listen';
      var dot = mk('span', 'dot');
      dot.setAttribute('aria-hidden', 'true');
      var lab = mk('span', '', t('Listening', 'සවන් දෙන්න'));
      lab.setAttribute('data-ng-en', 'Listening');
      lab.setAttribute('data-ng-si', 'සවන් දෙන්න');
      pill.appendChild(dot);
      pill.appendChild(lab);
      var timer = mk('div');
      timer.id = 'sdpTimerPill';
      var cd = $('.countdown', layer);
      if (cd) timer.appendChild(cd);
      head.appendChild(counter);
      head.appendChild(pill);
      head.appendChild(timer);
      card.insertBefore(head, card.firstChild.nextSibling || null);
    }
    /* helper dock */
    if (!$('#sdpHelperDock')) {
      var dock = mk('div');
      dock.id = 'sdpHelperDock';
      var defs = [
        ['repeat', '↻', 'Repeat', 'නැවත', 'btnRepeat'],
        ['slow', '🐢', 'Slower', 'සෙමින්', 'btnSlow'],
        ['sentence', '💬', 'Sentence', 'වාක්‍යය', 'btnSentence'],
        ['spell', '🔤', 'Spell it', 'අකුරු ඉඟිය', 'btnSpell']
      ];
      for (var i = 0; i < defs.length; i++) {
        (function (d0) {
          var b = mk('button');
          b.type = 'button';
          b.setAttribute('data-helper', d0[0]);
          var ico = mk('span', '', d0[1]);
          ico.style.fontSize = '14px';
          ico.style.lineHeight = '1';
          var lb = mk('span');
          lb.setAttribute('data-ng-en', d0[2]);
          lb.setAttribute('data-ng-si', d0[3]);
          lb.textContent = lang() === 'si' ? d0[3] : d0[2];
          b.appendChild(ico);
          b.appendChild(lb);
          on(b, 'click', function () {
            var target = D.getElementById(d0[4]);
            if (target) { try { target.click(); } catch (e) {} }
          });
          dock.appendChild(b);
        })(defs[i]);
      }
      card.appendChild(dock);
    }
    /* footer row */
    if (!$('#sdpCockpitFoot')) {
      var foot = mk('div');
      foot.id = 'sdpCockpitFoot';
      var voice = mk('div', 'sdp-voice');
      var rateTxt = Number(settings().rate || 0.96).toFixed(2);
      voice.textContent = '🇬🇧 Alice · studio voice · ' + rateTxt + '×';
      var actions = mk('div', 'sdp-actions');
      var play = $('#plPlay', layer);
      if (play) actions.appendChild(play);
      var skip = mk('button');
      skip.id = 'sdpBtnNext';
      skip.type = 'button';
      skip.textContent = '⏭';
      skip.setAttribute('aria-label', t('Next word', 'ඊළඟ වචනය'));
      on(skip, 'click', function () {
        var nx = $('#btnNextWord');
        if (nx) { try { nx.click(); } catch (e) {} }
      });
      var end = mk('button');
      end.id = 'sdpBtnEnd';
      end.type = 'button';
      end.textContent = '⏹';
      end.setAttribute('aria-label', t('Finish', 'අවසන් කරන්න'));
      on(end, 'click', function () {
        var fe = $('#btnFinishEarly');
        if (fe) { try { fe.click(); } catch (e) {} }
      });
      actions.appendChild(skip);
      actions.appendChild(end);
      foot.appendChild(voice);
      foot.appendChild(actions);
      card.appendChild(foot);
    }
    /* live counters + 30-word map, below the cockpit card */
    var body = $('.lbody', layer);
    if (body && !$('#sdpDictLivePanel')) {
      var panel = mk('div');
      panel.id = 'sdpDictLivePanel';
      var live = mk('div');
      live.id = 'sdpLiveCounters';
      var liveDefs = [['sdpLiveCorrect', 'Correct', 'නිවැරදි', ''], ['sdpLiveMissed', 'Missed', 'මගහැරුණු', 'warn'], ['sdpLiveStreak', 'Streak', 'අඛණ්ඩ', 'ok']];
      for (var k = 0; k < liveDefs.length; k++) {
        (function (ld) {
          var box = mk('div', 'sdp-live ' + ld[3]);
          box.id = ld[0] + 'Box';
          var i2 = mk('i');
          i2.setAttribute('data-ng-en', ld[1]);
          i2.setAttribute('data-ng-si', ld[2]);
          i2.textContent = lang() === 'si' ? ld[2] : ld[1];
          var b2 = mk('b', '', '0');
          b2.id = ld[0];
          box.appendChild(i2);
          box.appendChild(b2);
          live.appendChild(box);
        })(liveDefs[k]);
      }
      var mapCard = mk('div');
      mapCard.id = 'sdpWordMapCard';
      var mapTitle = mk('div');
      mapTitle.id = 'sdpWordMapTitle';
      mapTitle.setAttribute('data-ng-en', 'Word map');
      mapTitle.setAttribute('data-ng-si', 'වචන සිතියම');
      mapTitle.textContent = t('Word map', 'වචන සිතියම');
      var map = mk('div');
      map.id = 'sdpWordMap';
      mapCard.appendChild(mapTitle);
      mapCard.appendChild(map);
      panel.appendChild(live);
      panel.appendChild(mapCard);
      var stack = $('.stack', body);
      if (stack && stack.parentNode) stack.parentNode.insertBefore(panel, stack.nextSibling);
      else body.appendChild(panel);
    }
    NG.syncCockpit();
    if (!PHASE_TICK) {
      try {
        PHASE_TICK = new W.MutationObserver(function () { NG.syncCockpit(); });
        var cd2 = $('#cdNum');
        if (cd2) PHASE_TICK.observe(cd2, { childList: true, characterData: true, subtree: true });
        var layerNode = $('#layers');
        if (layerNode) PHASE_TICK.observe(layerNode, { childList: true });
      } catch (e) { PHASE_TICK = null; }
    }
    return true;
  }, 'nextgen.mountCockpit');

  /* ==========================================================================
     9. Settings — dictation first, 3-tier hierarchy, wallpapers last
     ========================================================================== */
  function rowNode(labelEn, labelSi, subEn, subSi, right) {
    var row = mk('div', 'sdp-row');
    var left = mk('div', 'sdp-row-l');
    var tt = mk('div', 'sdp-row-t');
    tt.setAttribute('data-ng-en', labelEn);
    tt.setAttribute('data-ng-si', labelSi);
    tt.textContent = lang() === 'si' ? labelSi : labelEn;
    left.appendChild(tt);
    if (subEn) {
      var ss = mk('div', 'sdp-row-s');
      ss.setAttribute('data-ng-en', subEn);
      ss.setAttribute('data-ng-si', subSi || subEn);
      ss.textContent = lang() === 'si' ? (subSi || subEn) : subEn;
      left.appendChild(ss);
    }
    var rr = mk('div', 'sdp-row-r');
    if (right) rr.appendChild(right);
    row.appendChild(left);
    row.appendChild(rr);
    return row;
  }

  function segNode(id, options, current, onPick) {
    var seg = mk('div', 'sdp-seg');
    seg.id = id;
    seg.setAttribute('role', 'group');
    for (var i = 0; i < options.length; i++) {
      (function (opt) {
        var b = mk('button');
        b.type = 'button';
        b.setAttribute('data-v', String(opt.v));
        b.setAttribute('aria-pressed', String(opt.v) === String(current) ? 'true' : 'false');
        b.setAttribute('data-ng-en', opt.en);
        b.setAttribute('data-ng-si', opt.si || opt.en);
        b.textContent = lang() === 'si' ? (opt.si || opt.en) : opt.en;
        on(b, 'click', function () { onPick(opt.v, seg); });
        seg.appendChild(b);
      })(options[i]);
    }
    return seg;
  }

  function syncSeg(id, value) {
    var seg = D.getElementById(id);
    if (!seg) return;
    var bs = seg.getElementsByTagName('button'), i;
    for (i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(bs[i].getAttribute('data-v')) === String(value) ? 'true' : 'false');
  }

  NG.selectMode = function (mode) {
    var m = mode === 'type' ? 'type' : 'paper';
    var st = settings();
    st.mode = m;
    saveSettings();
    var btn = $('#segMode button[data-mode="' + m + '"]');
    if (btn) { try { btn.click(); } catch (e) {} }
    syncSeg('sdpSegMode', m);
    NG.refreshHome();
    return m;
  };

  NG.mountSettings = guard(function () {
    var screen = $('#screen-set');
    if (!screen) return false;
    if (!$('#sdpNextGenSettings')) {
      var host = mk('div');
      host.id = 'sdpNextGenSettings';
      var head = mk('div', 'sdp-set-head');
      var title = mk('div', 'sdp-set-title');
      title.setAttribute('data-ng-en', 'Settings');
      title.setAttribute('data-ng-si', SDP_SI_DICT.settings_title);
      title.textContent = t('Settings', SDP_SI_DICT.settings_title);
      var sub = mk('div', 'sdp-set-sub');
      sub.setAttribute('data-ng-en', 'Dictation first · always');
      sub.setAttribute('data-ng-si', SDP_SI_DICT.settings_sub);
      sub.textContent = t('Dictation first · always', SDP_SI_DICT.settings_sub);
      head.appendChild(title);
      head.appendChild(sub);
      host.appendChild(head);

      /* ---- PRIORITY 1 ---- */
      var tier1 = mk('div', 'sdp-tier');
      tier1.id = 'sdpTier1';
      var t1h = mk('div', 'sdp-tier-head');
      var t1b = mk('b');
      t1b.setAttribute('data-ng-en', 'PRIORITY 1 · DICTATION & LEARNING');
      t1b.setAttribute('data-ng-si', SDP_SI_DICT.settings_p1);
      t1b.textContent = t('PRIORITY 1 · DICTATION & LEARNING', SDP_SI_DICT.settings_p1);
      t1h.appendChild(t1b);
      tier1.appendChild(t1h);

      var st = settings();
      tier1.appendChild(rowNode(
        'Practice mode', SDP_SI_DICT.set_mode_label,
        'Where you write your answers', SDP_SI_DICT.set_mode_sub,
        segNode('sdpSegMode', [
          { v: 'paper', en: '📝 Paper', si: '📝 කඩදාසියේ' },
          { v: 'type', en: '⌨️ Typing', si: '⌨️ ඇප් එකේ' }
        ], st.mode === 'type' ? 'type' : 'paper', function (v) { NG.selectMode(v); })
      ));

      tier1.appendChild(rowNode(
        'Voice speed', SDP_SI_DICT.set_speed_label, '', '',
        segNode('sdpSegSpeed', [
          { v: '0.75', en: '0.75× Slow', si: SDP_SI_DICT.speed_slow },
          { v: '0.9', en: '0.90× Clear', si: SDP_SI_DICT.speed_clear },
          { v: '1', en: '1.0× Normal', si: SDP_SI_DICT.speed_normal }
        ], String(Number(st.rate || 0.96) >= 0.98 ? '1' : (Number(st.rate || 0.96) <= 0.8 ? '0.75' : '0.9')), function (v) {
          var s2 = settings();
          s2.rate = Number(v) >= 1 ? 1 : (Number(v) <= 0.8 ? 0.75 : 0.9);
          saveSettings();
          syncSeg('sdpSegSpeed', v);
          NG.refreshHome();
          var r = D.getElementById('rate');
          if (r) { try { r.value = String(s2.rate); if (r.dispatchEvent) r.dispatchEvent(new W.Event('input', { bubbles: true })); } catch (e) {} }
          toast(t('Voice speed ' + Number(v).toFixed(2) + '×', 'හඬ වේගය ' + Number(v).toFixed(2) + '×'), { ms: 1400 });
        })
      ));

      tier1.appendChild(rowNode(
        'Word repeats', SDP_SI_DICT.set_repeats_label, '', '',
        segNode('sdpSegRepeats', [
          { v: '1', en: '1×', si: '1× වරක්' },
          { v: '2', en: '2×', si: '2× දෙවරක්' },
          { v: '3', en: '3×', si: '3× තුන් වරක්' }
        ], String(Number(st.repeats || 2)), function (v) {
          var s3 = settings();
          s3.repeats = Number(v) || 1;
          saveSettings();
          syncSeg('sdpSegRepeats', v);
          NG.refreshHome();
          var sel = D.getElementById('repeatsSelect');
          if (sel) { try { sel.value = String(s3.repeats); if (sel.dispatchEvent) sel.dispatchEvent(new W.Event('change', { bubbles: true })); } catch (e) {} }
        })
      ));

      var waitWrap = mk('div', 'sdp-range-wrap');
      var waitValue = mk('div', 'sdp-value', Number(st.writeFixed || 5) + ' s');
      waitValue.id = 'sdpWaitValue';
      var range = mk('input');
      range.type = 'range';
      range.id = 'sdpRangeWait';
      range.min = '3';
      range.max = '15';
      range.step = '1';
      range.value = String(Number(st.writeFixed || 5));
      range.setAttribute('aria-label', 'Writing time per word in seconds');
      var scale = mk('div', 'sdp-scale');
      scale.appendChild(mk('span', '', '3s'));
      scale.appendChild(mk('span', '', '9s'));
      scale.appendChild(mk('span', '', '15s'));
      on(range, 'input', function () {
        var s4 = settings();
        s4.writeFixed = Math.max(3, Math.min(15, Number(range.value) || 5));
        s4.writeMode = 'fixed';
        saveSettings();
        waitValue.textContent = s4.writeFixed + ' s';
        NG.refreshHome();
      });
      on(range, 'change', function () {
        var s5 = settings();
        s5.writeFixed = Math.max(3, Math.min(15, Number(range.value) || 5));
        saveSettings();
        toast(t(s5.writeFixed + 's to write each word', 'එක් වචනයකට තත් ' + s5.writeFixed + 'ක්'), { ms: 1400 });
      });
      waitWrap.appendChild(waitValue);
      waitWrap.appendChild(range);
      waitWrap.appendChild(scale);
      var waitRow = rowNode('Writing time per word', SDP_SI_DICT.set_wait_label, 'The pause after each word', SDP_SI_DICT.set_wait_sub, waitWrap);
      waitRow.id = 'sdpRowWait';
      tier1.appendChild(waitRow);

      var toggle = mk('button', 'sdp-toggle');
      toggle.id = 'sdpToggleAutoSentence';
      toggle.type = 'button';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', st.sentence ? 'true' : 'false');
      on(toggle, 'click', function () {
        var s6 = settings();
        var on2 = !(s6.sentence === true);
        s6.sentence = on2;
        saveSettings();
        toggle.setAttribute('aria-checked', on2 ? 'true' : 'false');
        try {
          var box = D.getElementById('sentence');
          if (box && box.type === 'checkbox') { box.checked = on2; if (box.dispatchEvent) box.dispatchEvent(new W.Event('change', { bubbles: true })); }
        } catch (e) {}
      });
      tier1.appendChild(rowNode('Auto-read example sentence', SDP_SI_DICT.set_autosent_label,
        'After the word is revealed', SDP_SI_DICT.set_autosent_sub, toggle));

      tier1.appendChild(rowNode('Interface language', SDP_SI_DICT.set_lang_label,
        'Buttons & explanations', SDP_SI_DICT.set_lang_sub,
        segNode('sdpSegLang', [
          { v: 'en', en: 'English', si: 'English' },
          { v: 'si', en: 'සිංහල', si: 'සිංහල' }
        ], lang(), function (v) { NG.setLang(v); })));
      host.appendChild(tier1);

      /* ---- PRIORITY 2 ---- */
      var tier2 = mk('div', 'sdp-tier');
      tier2.id = 'sdpVoiceCard';
      var t2h = mk('div', 'sdp-tier-head');
      var t2b = mk('b');
      t2b.setAttribute('data-ng-en', 'PRIORITY 2 · VOICE & AUDIO CHECK');
      t2b.setAttribute('data-ng-si', SDP_SI_DICT.settings_p2);
      t2b.textContent = t('PRIORITY 2 · VOICE & AUDIO CHECK', SDP_SI_DICT.settings_p2);
      t2h.appendChild(t2b);
      tier2.appendChild(t2h);
      var testBtn = mk('button', '', '🔊 Test Voice');
      testBtn.id = 'sdpVoiceTestBtn';
      testBtn.type = 'button';
      testBtn.setAttribute('data-ng-en', '🔊 Test Voice');
      testBtn.setAttribute('data-ng-si', '🔊 හඬ පරීක්ෂා කරන්න');
      testBtn.textContent = t('🔊 Test Voice', '🔊 හඬ පරීක්ෂා කරන්න');
      on(testBtn, 'click', function () {
        var legacy = D.getElementById('btnTestVoice') || D.getElementById('btnTestVoicePlayer');
        if (legacy) { try { legacy.click(); return; } catch (e) {} }
        speakSample();
      });
      var voiceRow = mk('div', 'sdp-row');
      var voiceLeft = mk('div', 'sdp-row-l');
      var vn = mk('div', 'sdp-voice-name', '🇬🇧 Alice · UK Studio Neural · Ready');
      var ol = mk('div');
      ol.id = 'sdpOfflineLine';
      ol.textContent = wordCount() + ' / ' + wordCount() + ' words ready offline';
      voiceLeft.appendChild(vn);
      voiceLeft.appendChild(ol);
      var voiceRight = mk('div', 'sdp-row-r');
      voiceRight.appendChild(testBtn);
      voiceRow.appendChild(voiceLeft);
      voiceRow.appendChild(voiceRight);
      tier2.appendChild(voiceRow);
      host.appendChild(tier2);

      screen.insertBefore(host, screen.firstChild);
    }
    /* legacy settings wall lives inside the collapsed Priority 3 accordion */
    var accordion = D.getElementById('sdpAppearanceAccordion');
    if (!accordion) {
      accordion = mk('details');
      accordion.id = 'sdpAppearanceAccordion';
      var summary = mk('summary');
      summary.setAttribute('data-ng-en', '🎨 Appearance, Themes, Wallpapers & Teacher Studio (Optional)');
      summary.setAttribute('data-ng-si', '🎨 පෙනුම, පසුබිම් රූප සහ ගුරු මැදිරිය (අමතර)');
      summary.textContent = t('🎨 Appearance, Themes, Wallpapers & Teacher Studio (Optional)', '🎨 පෙනුම, පසුබිම් රූප සහ ගුරු මැදිරිය (අමතර)');
      var body = mk('div');
      body.id = 'sdpAppearanceBody';
      accordion.appendChild(summary);
      accordion.appendChild(body);
      var ng = $('#sdpNextGenSettings');
      if (ng && ng.parentNode) ng.parentNode.insertBefore(accordion, ng.nextSibling);
      else screen.appendChild(accordion);
    }
    var ab = D.getElementById('sdpAppearanceBody');
    var setBody = D.getElementById('setBody');
    if (ab && setBody && setBody.parentNode !== ab) ab.appendChild(setBody);
    var adminBtn = D.getElementById('btnAdmin');
    if (ab && adminBtn && adminBtn.parentNode !== ab) {
      var adminRow = mk('div', 'sdp-row');
      var al = mk('div', 'sdp-row-l');
      var at = mk('div', 'sdp-row-t');
      at.textContent = t('Lecturer admin & studio', 'ගුරු පරිපාලනය සහ මැදිරිය');
      al.appendChild(at);
      var ar = mk('div', 'sdp-row-r');
      ar.appendChild(adminBtn);
      adminRow.appendChild(al);
      adminRow.appendChild(ar);
      ab.insertBefore(adminRow, ab.firstChild);
    }
    /* class comments stay reachable without stealing one of the five tabs */
    if (ab && !D.getElementById('sdpOpenCommunity')) {
      var commRow = mk('div', 'sdp-row');
      var commLeft = mk('div', 'sdp-row-l');
      var commTitle = mk('div', 'sdp-row-t');
      commTitle.setAttribute('data-ng-en', 'Class comments');
      commTitle.setAttribute('data-ng-si', 'පන්ති සටහන්');
      commTitle.textContent = t('Class comments', 'පන්ති සටහන්');
      var commSub = mk('div', 'sdp-row-s');
      commSub.setAttribute('data-ng-en', 'Read and post with your class');
      commSub.setAttribute('data-ng-si', 'ඔබේ පන්තිය සමඟ කියවා සටහන් දමන්න');
      commSub.textContent = t('Read and post with your class', 'ඔබේ පන්තිය සමඟ කියවා සටහන් දමන්න');
      commLeft.appendChild(commTitle);
      commLeft.appendChild(commSub);
      var commRight = mk('div', 'sdp-row-r');
      var commBtn = mk('button');
      commBtn.id = 'sdpOpenCommunity';
      commBtn.type = 'button';
      commBtn.className = 'btn sm soft';
      commBtn.textContent = t('Open', 'විවෘත කරන්න');
      on(commBtn, 'click', function () { try { var u2 = UI(); if (u2 && u2.setTab) u2.setTab('comm'); } catch (e) {} });
      commRight.appendChild(commBtn);
      commRow.appendChild(commLeft);
      commRow.appendChild(commRight);
      ab.appendChild(commRow);
    }
    var offRow = D.getElementById('v58OfflineRow');
    if (offRow && ab && offRow.parentNode !== ab) ab.appendChild(offRow);
    NG.refreshSettingsValues();
    return true;
  }, 'nextgen.mountSettings');

  NG.refreshSettingsValues = guard(function () {
    var st = settings();
    syncSeg('sdpSegMode', st.mode === 'type' ? 'type' : 'paper');
    syncSeg('sdpSegSpeed', String(Number(st.rate || 0.96) >= 0.98 ? '1' : (Number(st.rate || 0.96) <= 0.8 ? '0.75' : '0.9')));
    syncSeg('sdpSegRepeats', String(Number(st.repeats || 2)));
    syncSeg('sdpSegLang', lang());
    var range = D.getElementById('sdpRangeWait');
    if (range) range.value = String(Number(st.writeFixed || 5));
    var wv = D.getElementById('sdpWaitValue');
    if (wv) wv.textContent = Number(st.writeFixed || 5) + ' s';
    var tog = D.getElementById('sdpToggleAutoSentence');
    if (tog) tog.setAttribute('aria-checked', st.sentence ? 'true' : 'false');
    var ol = D.getElementById('sdpOfflineLine');
    if (ol) ol.textContent = t(wordCount() + ' / ' + wordCount() + ' words ready offline', 'වචන ' + wordCount() + ' / ' + wordCount() + ' ඔෆ්ලයින් සූදානම්');
    return true;
  }, 'nextgen.refreshSettingsValues');

  /* ==========================================================================
     10. Words explorer — full-field numbered cards, zero truncation
     ========================================================================== */
  function applyWordFilter() {
    var list = $('#dictList');
    if (!list) return;
    var cards = $$('.v59-dict-card', list);
    var filter = NG.wordFilter || 'all';
    var L = Learn();
    var weak = {}, mastered = {};
    try { if (L && L.loadWeakWords) weak = L.loadWeakWords() || {}; } catch (e) {}
    try { if (L && L.loadMasteredWords) mastered = L.loadMasteredWords() || {}; } catch (e) {}
    var arr = cards.slice();
    if (filter === 'az') {
      arr.sort(function (a, b) {
        return String(a.getAttribute('data-word') || '').toLowerCase() < String(b.getAttribute('data-word') || '').toLowerCase() ? -1 : 1;
      });
      for (var s = 0; s < arr.length; s++) list.appendChild(arr[s]);
    }
    for (var i = 0; i < cards.length; i++) {
      var w = String(cards[i].getAttribute('data-word') || '').toLowerCase();
      var show = true;
      if (filter === 'weak') show = Object.prototype.hasOwnProperty.call(weak, w);
      else if (filter === 'mastered') show = Object.prototype.hasOwnProperty.call(mastered, w);
      cards[i].style.display = show ? '' : 'none';
      /* Sinhala reveal pill styling + copy */
      var chip = $('.v59-si-chip', cards[i]);
      if (chip) {
        chip.classList.add('sdp-si-pill');
        var expanded = chip.getAttribute('aria-expanded') === 'true';
        if (!chip.getAttribute('data-ng-label')) {
          chip.setAttribute('data-ng-label', VERSION);
          chip.textContent = expanded ? 'සිංහල · තේරුම පෙන්වන්න' : 'සිංහල · Tap to reveal';
        }
      }
    }
  }
  NG.wordFilter = 'all';
  NG.applyWordFilter = guard(applyWordFilter, 'nextgen.applyWordFilter');

  NG.mountWords = guard(function () {
    var screen = $('#screen-dict');
    if (!screen) return false;
    var stack = $('.stack', screen) || screen;
    if (!$('#sdpWordsHead')) {
      var head = mk('div');
      head.id = 'sdpWordsHead';
      var title = mk('div');
      title.id = 'sdpWordsTitle';
      title.setAttribute('data-ng-en', 'Words');
      title.setAttribute('data-ng-si', 'වචන මාලාව');
      title.textContent = t('Words', 'වචන මාලාව');
      var sub = mk('div');
      sub.id = 'sdpWordsSub';
      sub.textContent = t('Session ' + sessionNo() + ' · ' + wordCount() + ' adjectives', 'සැසිය ' + sessionNo() + ' · විශේෂණ ' + wordCount());
      var filters = mk('div');
      filters.id = 'sdpWordFilterRow';
      var defs = [['all', 'All', 'සියල්ල'], ['weak', 'Weak', 'දුර්වල'], ['mastered', 'Mastered', 'ප්‍රගුණ කළ'], ['az', 'A–Z', 'A–Z']];
      for (var i = 0; i < defs.length; i++) {
        (function (d0) {
          var b = mk('button');
          b.type = 'button';
          b.setAttribute('data-filter', d0[0]);
          b.setAttribute('aria-pressed', d0[0] === 'all' ? 'true' : 'false');
          b.setAttribute('data-ng-en', d0[1]);
          b.setAttribute('data-ng-si', d0[2]);
          b.textContent = lang() === 'si' ? d0[2] : d0[1];
          on(b, 'click', function () {
            NG.wordFilter = d0[0];
            var bs = $$('#sdpWordFilterRow button'), j;
            for (j = 0; j < bs.length; j++) bs[j].setAttribute('aria-pressed', bs[j] === b ? 'true' : 'false');
            applyWordFilter();
          });
          filters.appendChild(b);
        })(defs[i]);
      }
      head.appendChild(title);
      head.appendChild(sub);
      head.appendChild(filters);
      stack.insertBefore(head, stack.firstChild);
    }
    var search = $('#dictSearch');
    if (search) {
      search.setAttribute('placeholder', t('🔍 Search a word, meaning or sentence…', 'වචනයක්, තේරුමක් හෝ වාක්‍යයක් සොයන්න…'));
      search.setAttribute('aria-label', 'Search words');
    }
    var list = $('#dictList');
    if (list && list.getAttribute('data-ng-obs') !== VERSION) {
      list.setAttribute('data-ng-obs', VERSION);
      try {
        if (W.MutationObserver) {
          var mo = new W.MutationObserver(function () { applyWordFilter(); });
          mo.observe(list, { childList: true });
        }
      } catch (e) {}
    }
    applyWordFilter();
    return true;
  }, 'nextgen.mountWords');

  /* ==========================================================================
     11. Whisper-quiet load micro-toast + animated Hansana credit pill
     ========================================================================== */
  function loadBytes() {
    var total = 0, entries, i, nav;
    try {
      entries = W.performance && W.performance.getEntriesByType ? W.performance.getEntriesByType('resource') : [];
      for (i = 0; i < entries.length; i++) {
        total += Number(entries[i].transferSize || entries[i].encodedBodySize || 0);
      }
      nav = W.performance && W.performance.getEntriesByType ? W.performance.getEntriesByType("navigation") : [];
      if (nav && nav.length) total += Number(nav[0].transferSize || nav[0].encodedBodySize || 0);
    } catch (e) { total = 0; }
    return total;
  }

  NG.mountMicroToast = guard(function () {
    if ($('#microToastLoad')) return true;
    var bytes = loadBytes();
    var txt;
    if (!bytes) {
      var cached = false;
      try { cached = !!(W.performance && W.performance.getEntriesByType && W.performance.getEntriesByType('resource').length); } catch (e) {}
      bytes = cached ? 0 : 356352;
    }
    if (bytes <= 0) {
      txt = t(SDP_SI_DICT.toast_load_cached.replace('⚡ ', '⚡ '), SDP_SI_DICT.toast_load_cached);
      txt = lang() === 'si' ? SDP_SI_DICT.toast_load_cached : '⚡ 0 KB · Offline ready';
    } else if (bytes < 1048576) {
      var kb = (bytes / 1024).toFixed(0) + ' KB';
      txt = lang() === 'si' ? siText('toast_load_used', { size: kb }) : '⚡ ' + kb + ' used on load';
    } else {
      var mb = (bytes / 1048576).toFixed(2) + ' MB';
      txt = lang() === 'si' ? siText('toast_load_used', { size: mb }) : '⚡ ' + mb + ' used on load';
    }
    var pill = mk('div');
    pill.id = 'microToastLoad';
    pill.setAttribute('role', 'status');
    pill.setAttribute('aria-live', 'polite');
    pill.textContent = txt;
    try { (D.body || D.documentElement).appendChild(pill); } catch (e) { return false; }
    setTimeout(function () { try { pill.classList.add('out'); } catch (e) {} }, 3500);
    setTimeout(function () { try { pill.hidden = true; } catch (e) {} }, 3900);
    return true;
  }, 'nextgen.mountMicroToast');

  NG.mountCredit = guard(function () {
    var reduced = false;
    try { reduced = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    if (!$('#creditPill')) {
      var pill = mk('div');
      pill.id = 'creditPill';
      pill.setAttribute('aria-hidden', 'true');
      pill.textContent = '\uD83E\uDD62 CREDITS GOES TO Hansana';
      try { (D.body || D.documentElement).appendChild(pill); } catch (e) {}
      setTimeout(function () {
        try { pill.classList.add('out'); } catch (e) {}
        NG.showDockedCredit();
      }, reduced ? 60 : 3800);
    }
    if (!$('#creditDocked')) {
      var dock = mk('div');
      dock.id = 'creditDocked';
      dock.textContent = '\uD83E\uDD62 Crafted by Hansana';
      try { (D.body || D.documentElement).appendChild(dock); } catch (e) {}
    }
    return true;
  }, 'nextgen.mountCredit');

  NG.showDockedCredit = function () {
    var dock = D.getElementById('creditDocked');
    if (dock) dock.classList.add('on');
  };

  /* ==========================================================================
     12. Session celebration — confetti + graduated chip + practice-missed
     ========================================================================== */
  NG.confetti = function (ms) {
    try {
      if (!D.body) return false;
      var canvas = D.getElementById('sdpConfettiCanvas');
      if (!canvas) {
        canvas = mk('canvas');
        canvas.id = 'sdpConfettiCanvas';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.width = Math.max(320, W.innerWidth || 360);
        canvas.height = Math.max(480, W.innerHeight || 640);
        D.body.appendChild(canvas);
      }
      var ctx = canvas.getContext ? canvas.getContext('2d') : null;
      if (!ctx || !ctx.fillRect) return false;
      var colors = ['#38BDF8', '#4ADE80', '#FBBF24', '#F87171', '#FAFAFA'];
      var parts = [], i;
      for (i = 0; i < 90; i++) {
        parts.push({
          x: canvas.width / 2,
          y: canvas.height / 2.6,
          vx: (Math.random() - 0.5) * 7,
          vy: (Math.random() - 0.9) * 6,
          r: 2 + Math.random() * 3,
          c: colors[i % colors.length],
          a: 1
        });
      }
      var start = Date.now(), dur = Number(ms) || 1800;
      function frame() {
        var elapsed = Date.now() - start;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var k = 0; k < parts.length; k++) {
          var p = parts[k];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.12;
          p.a = Math.max(0, 1 - elapsed / dur);
          ctx.globalAlpha = p.a;
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x, p.y, p.r * 2, p.r * 2);
        }
        ctx.globalAlpha = 1;
        if (elapsed < dur && W.requestAnimationFrame) W.requestAnimationFrame(frame);
        else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
      }
      if (W.requestAnimationFrame) W.requestAnimationFrame(frame);
      return true;
    } catch (e) { return false; }
  };

  NG.celebrate = guard(function (missed) {
    NG.confetti(1800);
    var host = $('#layers .layer .lbody') || $('#sheets .sheet .sbody') || $('#screen-home');
    if (!host || $('#sdpGradChip')) return;
    var chip = mk('div', 'sdp-grad-chip');
    chip.id = 'sdpGradChip';
    chip.textContent = t('🎓 Graduated today', '🎓 අද ප්‍රගුණ කළා');
    host.insertBefore(chip, host.firstChild);
    if (missed && missed.length) {
      var btn = mk('button');
      btn.id = 'sdpPracticeMissed';
      btn.type = 'button';
      btn.className = 'btn sm soft';
      btn.textContent = t('Practice ' + missed.length + ' missed words now', 'මගහැරුණු වචන ' + missed.length + 'ක් දැන් පුහුණු වන්න');
      on(btn, 'click', function () {
        var L = Learn();
        try {
          if (L && L.openWeakWords) { L.openWeakWords(); return; }
        } catch (e) {}
        goto('practice');
      });
      chip.appendChild(document.createTextNode(' '));
      chip.appendChild(btn);
    }
  }, 'nextgen.celebrate');

  /* ==========================================================================
     13. SDPOfflineDB — IndexedDB learner store (sdp_offline_v60) + LRU mirror
     ========================================================================== */
  W.SDPOfflineDB = {
    DB_NAME: 'sdp_offline_v60',
    DB_VERSION: 1,
    STORES: ['kv', 'history'],
    _db: null,
    _open: function (cb) {
      var self = this;
      try {
        if (!W.indexedDB) { cb(null); return; }
        if (self._db) { cb(self._db); return; }
        var req = W.indexedDB.open(self.DB_NAME, self.DB_VERSION);
        req.onupgradeneeded = function (ev) {
          var db = ev.target.result, i;
          for (i = 0; i < self.STORES.length; i++) {
            if (!db.objectStoreNames.contains(self.STORES[i])) db.createObjectStore(self.STORES[i], { keyPath: 'id' });
          }
        };
        req.onsuccess = function (ev) { self._db = ev.target.result; cb(self._db); };
        req.onerror = function () { cb(null); };
      } catch (e) { cb(null); }
    },
    _put: function (store, item, cb) {
      var self = this;
      self._open(function (db) {
        if (!db) { self._lsPut(store, item); if (cb) cb(false); return; }
        try {
          var tx = db.transaction([store], 'readwrite');
          tx.objectStore(store).put({ id: String(item.id), data: item, ts: Date.now() });
          tx.oncomplete = function () { self._lsPut(store, item); if (cb) cb(true); };
          tx.onerror = function () { if (cb) cb(false); };
        } catch (e) { self._lsPut(store, item); if (cb) cb(false); }
      });
    },
    put: function (store, item, cb) { this._put(store || 'kv', item, cb); },
    get: function (store, id, cb) {
      var self = this;
      self._open(function (db) {
        if (!db) { if (cb) cb(self._lsGet(store, id)); return; }
        try {
          var req = db.transaction([store], 'readonly').objectStore(store).get(String(id));
          req.onsuccess = function () { if (cb) cb(req.result && req.result.data ? req.result.data : null); };
          req.onerror = function () { if (cb) cb(self._lsGet(store, id)); };
        } catch (e) { if (cb) cb(self._lsGet(store, id)); }
      });
    },
    _lsKey: function (store, id) { return 'sdp.idb.v60.' + store + '.' + String(id); },
    _lsPut: function (store, item) {
      try { W.localStorage.setItem(this._lsKey(store, item.id), JSON.stringify({ data: item, ts: Date.now() })); } catch (e) {}
    },
    _lsGet: function (store, id) {
      try { var raw = W.localStorage.getItem(this._lsKey(store, id)); if (!raw) return null; var o = JSON.parse(raw); return o && o.data ? o.data : null; } catch (e) { return null; }
    },
    /* mirror the learner keys so a cleared localStorage can be hydrated */
    mirror: function () {
      var keys = ['sdp_sr_v2', 'sdp_gam_v2', 'sdp_wrong_words', 'sdp_hist', 'sdp.weakWords.v1', 'sdp.masteredWords.v1'];
      for (var i = 0; i < keys.length; i++) {
        try {
          var raw = W.localStorage.getItem(keys[i]);
          if (raw == null) continue;
          this._put('kv', { id: keys[i], raw: raw }, null);
        } catch (e) {}
      }
    },
    hydrate: function (cb) {
      var self = this, keys = ['sdp_sr_v2', 'sdp_gam_v2', 'sdp_wrong_words', 'sdp_hist', 'sdp.weakWords.v1', 'sdp.masteredWords.v1'], done = 0;
      function finish() { done++; if (done >= keys.length && cb) cb(done); }
      for (var i = 0; i < keys.length; i++) {
        (function (key) {
          try {
            if (W.localStorage.getItem(key) != null) { finish(); return; }
          } catch (e) {}
          self.get('kv', key, function (rec) {
            try { if (rec && rec.raw) W.localStorage.setItem(key, rec.raw); } catch (e) {}
            finish();
          });
        })(keys[i]);
      }
    },
    history: function (entry, cb) { this._put('history', entry, cb); }
  };

  /* ==========================================================================
     14. Boot + observers
     ========================================================================== */
  var BOOTED = false;

  function hookEngines() {
    try {
      var e = eng();
      if (e && !e.__ngOpen) {
        e.__ngOpen = true;
        var orig = e.openPlayer;
        if (typeof orig === 'function') {
          e.openPlayer = function () {
            var r = orig.apply(this, arguments);
            try { NG.mountCockpit(); } catch (x) {}
            return r;
          };
        }
        var origStart = e.startWord;
        if (typeof origStart === 'function') {
          e.startWord = function () {
            var r = origStart.apply(this, arguments);
            try { NG.mountCockpit(); NG.syncCockpit(); } catch (x) {}
            return r;
          };
        }
      }
    } catch (e) {}
    try {
      var u = UI();
      if (u && !u.__ngTab) {
        u.__ngTab = true;
        var origTab = u.setTab;
        if (typeof origTab === 'function') {
          u.setTab = function (tab) {
            var r = origTab.apply(this, arguments);
            try {
              if (tab === 'set') NG.mountSettings();
              if (tab === 'home') NG.mountHome();
              if (tab === 'dict') NG.mountWords();
              NG.syncRail();
            } catch (x) {}
            return r;
          };
        }
        var origLang = u.applyLang;
        if (typeof origLang === 'function') {
          u.applyLang = function () {
            var r = origLang.apply(this, arguments);
            try { if (!NG.__inApply) NG.applyLang(lang()); } catch (x) {}
            return r;
          };
        }
      }
    } catch (e) {}
    try {
      var res = core() && core().Results;
      if (res && !res.__ngCelebrate) {
        res.__ngCelebrate = true;
        var origFinish = res.finish;
        if (typeof origFinish === 'function') {
          res.finish = function () {
            var r = origFinish.apply(this, arguments);
            try {
              var missed = [];
              var e2 = eng();
              if (e2 && e2.words) {
                for (var i = 0; i < e2.words.length; i++) {
                  var rec = e2.words[i];
                  if (rec && (rec.wrong || rec.missed)) missed.push(rec.w || rec.word);
                }
              }
              NG.celebrate(missed);
              var odb = W.SDPOfflineDB;
              if (odb) {
                try {
                  odb.mirror();
                  odb.history({ id: 'session-' + sessionNo() + '-' + Date.now(), ts: Date.now(), total: (e2 && e2.words ? e2.words.length : 0) }, null);
                } catch (x) {}
              }
            } catch (x) {}
            return r;
          };
        }
      }
    } catch (e) {}
  }

  function mountAll() {
    NG.injectCss();
    NG.neutraliseLegacyStyles();
    NG.mountTopbar();
    NG.mountTabs();
    NG.mountRail();
    NG.mountSettings();
    NG.mountHome();
    NG.mountWords();
    NG.applyLang(lang());
    NG.syncRail();
    NG.mountCockpit();
    try { hookEngines(); } catch (e) {}
    return true;
  }
  NG.mountAll = guard(mountAll, 'nextgen.mountAll');

  function boot() {
    if (BOOTED) { mountAll(); return; }
    BOOTED = true;
    NG.migrateToV60();
    NG.injectCss();
    NG.neutraliseLegacyStyles();
    NG.observeLegacyStyles();
    NG.wireWallpaperChoice();
    try { if (D.body) D.body.classList.add('sdp-nextgen'); } catch (e) {}
    mountAll();
    NG.mountMicroToast();
    NG.mountCredit();
    hookEngines();
    try {
      var odb = W.SDPOfflineDB;
      if (odb) { odb.hydrate(function () {}); setTimeout(function () { try { odb.mirror(); } catch (e) {} }, 2500); }
    } catch (e) {}
    /* the app builds screens lazily — keep the Next-Gen layer in sync */
    try {
      if (W.MutationObserver && D.getElementById('layers')) {
        var mo = new W.MutationObserver(function () { NG.mountCockpit(); });
        mo.observe(D.getElementById('layers'), { childList: true });
      }
    } catch (e) {}
    try {
      if (W.MutationObserver && D.getElementById('screen-set')) {
        var mo2 = new W.MutationObserver(function () { NG.mountSettings(); });
        mo2.observe(D.getElementById('screen-set'), { childList: true });
      }
    } catch (e) {}
    setTimeout(function () { try { NG.neutraliseLegacyStyles(); NG.mountCockpit(); NG.applyLang(lang()); } catch (e) {} }, 900);
    setTimeout(function () { try { NG.neutraliseLegacyStyles(); } catch (e) {} }, 2500);
  }

  NG.version = VERSION;
  NG.build = BUILD;
  NG.boot = boot;
  NG.loadBytes = loadBytes;

  if (D.readyState === 'loading') {
    on(D, 'DOMContentLoaded', function () { setTimeout(boot, 0); });
  } else {
    setTimeout(boot, 0);
  }
  on(W, 'load', function () {
    try { NG.neutraliseLegacyStyles(); NG.mountCockpit(); } catch (e) {}
  });
})();
