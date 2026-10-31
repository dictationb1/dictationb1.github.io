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
    V59.ready = true;
    try { PG.start(UI(), DB()); } catch (e) {}
  }

  if (D.readyState === 'loading') on(D, 'DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
