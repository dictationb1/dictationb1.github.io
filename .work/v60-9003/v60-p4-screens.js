  /* ============================================================
     P4 - Next-Gen cockpit, priority settings, words explorer, i18n
     (inserted inside the v60 module so it shares every helper above)
     ============================================================ */

  /* extra CSS for P4 controls */
  V.extraCss = V.extraCss || [];

  var L4 = {
    p1: ['PRIORITY 1 \u00B7 DICTATION & LEARNING', '\u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DD4\u0D9B\u0DAD\u0DCF 1 \u00B7 \u0DA9\u0DD2\u0D9A\u0DCA\u0DA7\u0DDA\u0DC2\u0DB1\u0DCA \u0DC3\u0DC4 \u0D89\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8'],
    p2: ['PRIORITY 2 \u00B7 VOICE & AUDIO CHECK', '\u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DD4\u0D9B\u0DAD\u0DCF 2 \u00B7 \u0DC4\u0DAC \u0DB4\u0DBB\u0DD3\u0D9A\u0DCA\u0DC2\u0DCF\u0DC0'],
    p3: ['PRIORITY 3 \u00B7 APPEARANCE (OPTIONAL)', '\u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DD4\u0D9B\u0DAD\u0DCF 3 \u00B7 \u0DB4\u0DD9\u0DB1\u0DD4\u0DB8'],
    mode: ['Answer mode', '\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 \u0D9A\u0DCA\u200D\u0DBB\u0DB8\u0DBA'],
    speed: ['Reading speed', '\u0D9A\u0DD2\u0DBA\u0DC0\u0DD3\u0DB8\u0DDA \u0DC0\u0DDA\u0D9C\u0DBA'],
    reps: ['Repeats per word', '\u0DC0\u0DA0\u0DB1\u0DBA\u0DA7 \u0DB1\u0DD0\u0DC0\u0DAD \u0D9C\u0DAB\u0DB1'],
    wait: ['Writing time', '\u0DBD\u0DD2\u0DBA\u0DB1 \u0DC0\u0DDA\u0DBD\u0DCF\u0DC0'],
    sentence: ['Read the sentence too', '\u0DC0\u0DCF\u0D9A\u0DCA\u0DBA\u0DBA\u0DAF \u0D9A\u0DD2\u0DBA\u0DC0\u0DB1\u0DCA\u0DB1'],
    lang: ['Language', '\u0DB7\u0DCF\u0DC2\u0DCF\u0DC0'],
    test: ['Test voice', '\u0DC4\u0DAC \u0DB4\u0DBB\u0DD3\u0D9A\u0DCA\u0DC2\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1'],
    volume: ['Volume', '\u0DC1\u0DB6\u0DCA\u0DAF\u0DBA'],
    paper: ['\uD83D\uDCDD Paper', '\uD83D\uDCDD \u0D9A\u0DA9\u0DAF\u0DCF\u0DC3\u0DD2'],
    typing: ['\u2328\uFE0F Typing', '\u2328\uFE0F \u0DBA\u0DDC\u0DAF\u0DB1\u0DCA\u0DB1'],
    slow: ['0.75\u00D7 Slow', '0.75\u00D7 \u0DC3\u0DD9\u0DB8\u0DD2\u0DB1\u0DCA'],
    clear: ['0.90\u00D7 Clear', '0.90\u00D7 \u0DB4\u0DD0\u0DC4\u0DD0\u0DAF\u0DD2\u0DBD\u0DD2'],
    normal: ['1.0\u00D7 Normal', '1.0\u00D7 \u0DC3\u0DCF\u0DB8\u0DCF\u0DB1\u0DCA\u200D\u0DBA'],
    english: ['English', '\u0D89\u0D82\u0D9C\u0DCA\u200D\u0DBB\u0DD3\u0DC3\u0DD2'],
    sinhala: ['\u0DC3\u0DD2\u0D82\u0DC4\u0DBD', '\u0DC3\u0DD2\u0D82\u0DC4\u0DBD'],
    voice: ['\uD83C\uDDEC\uD83C\uDDE7 Alice \u00B7 UK Studio Voice', '\uD83C\uDDEC\uD83C\uDDE7 Alice \u00B7 \u0DB6\u0DCA\u200D\u0DBB\u0DD2\u0DAD\u0DCF\u0DB1\u0DCA\u200D\u0DBA \u0DC3\u0DCA\u0DA7\u0DD4\u0DA9\u0DD2\u0DBA\u0DDD \u0DC4\u0DAC'],
    all: ['All', '\u0DC3\u0DD2\u0DBA\u0DBD\u0DCA\u0DBD'],
    weakf: ['Weak', '\u0DAF\u0DD4\u0DB6\u0DBD'],
    masteredf: ['Mastered', '\u0DB4\u0DCA\u200D\u0DBB\u0DB7\u0DD4'],
    az: ['A\u2013Z', 'A\u2013Z'],
    wordOf: ['Word {n} of {t}', '\u0DC0\u0DA0\u0DB1\u0DBA {n} / {t}'],
    dictation: ['DICTATION {n}', '\u0DA9\u0DD2\u0D9A\u0DCA\u0DA7\u0DDA\u0DC2\u0DB1\u0DCA {n}'],
    caption: ['Write on paper \u00B7 the word was read twice', '\u0D9A\u0DA9\u0DAF\u0DCF\u0DC3\u0DD2\u0DBA\u0DDA \u0DBD\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1 \u00B7 \u0DC0\u0DA0\u0DB1\u0DBA \u0DAF\u0DD9\u0DB6\u0DCF\u0DBB\u0D9A\u0DCA \u0D9A\u0DD2\u0DBA\u0DC0\u0DCF \u0D87\u0DAD'],
    correct: ['CORRECT', '\u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2'],
    missed: ['MISSED', '\u0DC0\u0DD0\u0DBB\u0DAF\u0DD4\u0DAB\u0DD2'],
    streakL: ['STREAK', '\u0DBB\u0DD0\u0D9A\u0DD2\u0DBA'],
    repeat: ['Repeat', '\u0DB1\u0DD0\u0DC0\u0DAD'],
    slower: ['Slower', '\u0DC3\u0DD9\u0DB8\u0DD2\u0DB1\u0DCA'],
    sent: ['Sentence', '\u0DC0\u0DCF\u0D9A\u0DCA\u0DBA\u0DBA'],
    spell: ['Spell it', '\u0D85\u0D9A\u0DD4\u0DBB\u0DD4'],
    pause: ['Pause', '\u0DB1\u0DC0\u0DAD\u0DB1\u0DCA\u0DB1'],
    skip: ['Skip', '\u0DB8\u0D9C\u0DC4\u0DD0\u0DBB\u0DB1\u0DCA\u0DB1'],
    footVoice: ['\uD83C\uDDEC\uD83C\uDDE7 Alice \u00B7 studio voice \u00B7 0.90\u00D7', '\uD83C\uDDEC\uD83C\uDDE7 Alice \u00B7 \u0DC3\u0DCA\u0DA7\u0DD4\u0DA9\u0DD2\u0DBA\u0DDD \u0DC4\u0DAC \u00B7 0.90\u00D7'],
    listening: ['Listening', '\u0D85\u0DC3\u0DB1\u0DCA\u0DB1'],
    writing: ['Writing time', '\u0DBD\u0DD2\u0DBA\u0DB1 \u0DC0\u0DDA\u0DBD\u0DCF\u0DC0'],
    reveal: ['Reveal', '\u0DB4\u0DD9\u0DB1\u0DCA\u0DC0\u0DB1\u0DCA\u0DB1'],
    waiting: ['Get ready', '\u0DC3\u0DD6\u0DAF\u0DCF\u0DB1\u0DB8\u0DCA']
  };
  function T4(key) { var pair = L4[key]; if (!pair) return String(key); return V.lang === 'si' ? pair[1] : pair[0]; }
  function fill(tpl, n, t) { return String(tpl).replace('{n}', String(n)).replace('{t}', String(t)); }

  /* ------------------------------------------------------------------ words */
  function wordList() {
    var out = [];
    try {
      var lib = Lib();
      var cur = lib && lib.current ? lib.current() : null;
      if (cur && cur.words && cur.words.length) out = cur.words.slice();
    } catch (e) {}
    if (!out.length) {
      try {
        var d = DB();
        var lists = (d && d.data && d.data.lists) || [];
        for (var i = 0; i < lists.length && !out.length; i++) {
          if (lists[i] && lists[i].words && lists[i].words.length) out = lists[i].words.slice();
        }
      } catch (e2) {}
    }
    return out;
  }
  function weakSet() {
    var set = {};
    try {
      var L = W.SDPLearning;
      var w = L && L.loadWeakWords ? L.loadWeakWords() : null;
      if (w) for (var k in w) if (Object.prototype.hasOwnProperty.call(w, k)) set[String(k).toLowerCase()] = 1;
    } catch (e) {}
    return set;
  }
  function masteredSet() {
    var set = {};
    try {
      var L = W.SDPLearning;
      var m = L && L.loadMasteredWords ? L.loadMasteredWords() : null;
      if (m) for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) set[String(k).toLowerCase()] = 1;
    } catch (e) {}
    return set;
  }
  function say(text, slow) {
    try {
      var sp = core() && core().Speech;
      if (sp && typeof sp.speak === 'function') { sp.speak(String(text), slow ? { rate: 0.72 } : undefined); return; }
      if (sp && typeof sp.say === 'function') { sp.say(String(text), slow ? 0.72 : 1); return; }
      if (W.speechSynthesis && W.SpeechSynthesisUtterance) {
        var u = new W.SpeechSynthesisUtterance(String(text));
        u.rate = slow ? 0.72 : 1;
        u.lang = 'en-GB';
        W.speechSynthesis.speak(u);
      }
    } catch (e) {}
  }

  /* --------------------------------------------------------------- settings */
  function setSetting(key, value) {
    var d = DB();
    if (!d || !d.data) return;
    if (!d.data.settings) d.data.settings = {};
    d.data.settings[key] = value;
    try { if (d.save) d.save(); } catch (e) {}
    try { if (d.saveNow) d.saveNow(); } catch (e) {}
  }
  function syncLegacy(sel, value, evt) {
    var n = $(sel);
    if (!n) return;
    try {
      if (n.type === 'checkbox') n.checked = !!value;
      else n.value = String(value);
      var e = D.createEvent('HTMLEvents');
      e.initEvent(evt || 'change', true, false);
      n.dispatchEvent(e);
    } catch (err) {}
  }
  function seg(id, defs, currentIndex, onPick) {
    var box = mk('div', 'sdp-seg', id);
    box.setAttribute('role', 'group');
    for (var i = 0; i < defs.length; i++) {
      (function (idx) {
        var b = mk('button', null, id + '-' + idx, defs[idx]);
        b.type = 'button';
        b.setAttribute('aria-pressed', idx === currentIndex ? 'true' : 'false');
        on(b, 'click', function () {
          var kids = box.children;
          for (var j = 0; j < kids.length; j++) kids[j].setAttribute('aria-pressed', j === idx ? 'true' : 'false');
          onPick(idx);
        });
        box.appendChild(b);
      })(i);
    }
    return box;
  }
  function row(id, labelText, hintText, control) {
    var r = mk('div', 'sdp-row', id);
    var left = mk('div');
    left.appendChild(mk('span', 'sdp-lbl', null, labelText));
    if (hintText) left.appendChild(mk('span', 'sdp-hint', null, hintText));
    r.appendChild(left);
    r.appendChild(control);
    return r;
  }
  function renderNextGenSettings() {
    var host = $('#screen-set');
    if (!host) return;
    var box = $('#sdpNextGenSettings');
    if (!box) { box = mk('div', null, 'sdpNextGenSettings'); }
    if (host.firstElementChild !== box) host.insertBefore(box, host.firstChild);
    var st = settingsData();
    while (box.firstChild) box.removeChild(box.firstChild);

    var card1 = mk('div', 'sdp-card', 'sdpPriority1');
    card1.appendChild(mk('div', 'sdp-card-head')).appendChild(mk('b', null, null, T4('p1')));
    card1.appendChild(row('sdpRowMode', T4('mode'), null,
      seg('sdpSegMode', [T4('paper'), T4('typing')], st.mode === 'type' ? 1 : 0, function (idx) {
        setSetting('mode', idx === 1 ? 'type' : 'paper');
        syncLegacy('#segMode', null);
        var legacySeg = $('#segMode');
        if (legacySeg) {
          var btns = legacySeg.querySelectorAll('button');
          if (btns[idx]) { try { btns[idx].click(); } catch (e) {} }
        }
        try { renderNextGenHome(); } catch (e) {}
      })));
    card1.appendChild(row('sdpRowSpeed', T4('speed'), null,
      seg('sdpSegSpeed', [T4('slow'), T4('clear'), T4('normal')], Number(st.rate) <= 0.8 ? 0 : (Number(st.rate) >= 0.99 ? 2 : 1), function (idx) {
        var rate = idx === 0 ? 0.75 : (idx === 1 ? 0.9 : 1);
        setSetting('rate', rate);
        syncLegacy('#rateRange', rate, 'input');
        try { renderNextGenHome(); } catch (e) {}
      })));
    card1.appendChild(row('sdpRowRepeats', T4('reps'), null,
      seg('sdpSegRepeats', ['1\u00D7', '2\u00D7', '3\u00D7'], Math.max(0, Math.min(2, (Number(st.repeats) || 2) - 1)), function (idx) {
        var reps = idx + 1;
        setSetting('repeats', reps);
        syncLegacy('#repeatsSelect', reps);
        try { renderNextGenHome(); } catch (e) {}
      })));
    var waitVal = Number(st.writeFixed) || 8;
    var waitBox = mk('div');
    waitBox.style.display = 'flex';
    waitBox.style.alignItems = 'center';
    waitBox.style.gap = '8px';
    var range = mk('input', null, 'sdpRangeWait');
    range.type = 'range';
    range.min = '3';
    range.max = '15';
    range.step = '1';
    range.value = String(Math.max(3, Math.min(15, waitVal)));
    range.setAttribute('aria-label', T4('wait'));
    var waitPill = mk('span', 'sdp-val', 'sdpWaitVal', String(range.value) + ' s');
    on(range, 'input', function () {
      var v = Number(range.value) || 8;
      txt(waitPill, v + ' s');
      setSetting('writeMode', 'fixed');
      setSetting('writeFixed', v);
      syncLegacy('#writeSecsRange', v, 'input');
      try { renderNextGenHome(); } catch (e) {}
    });
    waitBox.appendChild(range);
    waitBox.appendChild(waitPill);
    card1.appendChild(row('sdpRowWait', T4('wait'), null, waitBox));

    var autoOn = st.readSentence === true;
    var sw = mk('button', 'sdp-switch', 'sdpToggleAutoSentence');
    sw.type = 'button';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-pressed', autoOn ? 'true' : 'false');
    sw.appendChild(mk('i'));
    on(sw, 'click', function () {
      var next = sw.getAttribute('aria-pressed') !== 'true';
      sw.setAttribute('aria-pressed', next ? 'true' : 'false');
      setSetting('readSentence', next);
      syncLegacy('#readSentenceToggle', next);
    });
    card1.appendChild(row('sdpRowSentence', T4('sentence'), null, sw));
    card1.appendChild(row('sdpRowLang', T4('lang'), null,
      seg('sdpSegLang', [T4('english'), T4('sinhala')], V.lang === 'si' ? 1 : 0, function (idx) {
        var lang = idx === 1 ? 'si' : 'en';
        setSetting('lang', lang);
        try { var u = UI(); if (u && u.setLang) u.setLang(lang); } catch (e) {}
        applyLang(lang);
        try { renderNextGenSettings(); } catch (e) {}
      })));
    box.appendChild(card1);

    var card2 = mk('div', 'sdp-card', 'sdpPriority2');
    card2.appendChild(mk('div', 'sdp-card-head')).appendChild(mk('b', null, null, T4('p2')));
    var vrow = mk('div', 'sdp-row');
    var vleft = mk('div');
    vleft.appendChild(mk('span', 'sdp-lbl', null, T4('voice')));
    vleft.appendChild(mk('span', 'sdp-hint', null, 'en-GB \u00B7 eleven_flash_v2_5'));
    var testBtn = mk('button', 'sdp-btn primary', 'sdpTestVoice', T4('test'));
    testBtn.type = 'button';
    on(testBtn, 'click', function () { say('This is Alice. Your dictation voice is ready.', false); });
    vrow.appendChild(vleft);
    vrow.appendChild(testBtn);
    card2.appendChild(vrow);
    var volBox = mk('div');
    volBox.style.display = 'flex';
    volBox.style.alignItems = 'center';
    volBox.style.gap = '8px';
    var vol = mk('input', null, 'sdpVolRange');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '100';
    vol.step = '5';
    vol.value = String(Math.round((Number(st.volume) || 1) * 100));
    vol.setAttribute('aria-label', T4('volume'));
    var volPill = mk('span', 'sdp-val', 'sdpVolVal', vol.value + '%');
    on(vol, 'input', function () {
      txt(volPill, vol.value + '%');
      setSetting('volume', (Number(vol.value) || 100) / 100);
      syncLegacy('#volRange', vol.value, 'input');
    });
    volBox.appendChild(vol);
    volBox.appendChild(volPill);
    card2.appendChild(row('sdpRowVolume', T4('volume'), null, volBox));
    box.appendChild(card2);

    var acc = $('#sdpAppearanceAccordion');
    if (!acc) {
      acc = mk('details', null, 'sdpAppearanceAccordion');
      acc.appendChild(mk('summary', null, null, T4('p3')));
      box.appendChild(acc);
    } else if (acc.parentNode !== box) {
      box.appendChild(acc);
    }
    acc.open = false;
    var setBody = $('#setBody');
    if (setBody && setBody.parentNode !== acc) acc.appendChild(setBody);
  }
  W.SDP_NEXTGEN_SETTINGS_REFRESH = function () { try { renderNextGenSettings(); } catch (e) {} };

  function wrapSettings() {
    var s = Screens();
    if (!s || s.__v60Settings) return;
    var orig = s.settings;
    if (typeof orig === 'function') {
      s.settings = function () {
        var out = orig.apply(this, arguments);
        try { renderNextGenSettings(); } catch (e) {}
        return out;
      };
      s.__v60Settings = true;
    }
    if (typeof s.set === 'function' && !s.__v60Set) {
      var os = s.set;
      s.set = function () {
        var out2 = os.apply(this, arguments);
        try { renderNextGenSettings(); } catch (e) {}
        return out2;
      };
      s.__v60Set = true;
    }
  }

  /* ------------------------------------------------------------------ words */
  var wordFilter = 'all';
  function ensureFilterRow() {
    var host = $('#screen-dict');
    if (!host) return null;
    var rowEl = $('#sdpWordFilterRow');
    if (rowEl) return rowEl;
    rowEl = mk('div', null, 'sdpWordFilterRow');
    rowEl.setAttribute('role', 'group');
    rowEl.setAttribute('aria-label', 'Word filters');
    var defs = [['all', T4('all')], ['weak', T4('weakf')], ['mastered', T4('masteredf')], ['az', T4('az')]];
    for (var i = 0; i < defs.length; i++) {
      (function (key, label) {
        var b = mk('button', null, 'sdpFilter-' + key, label);
        b.type = 'button';
        b.setAttribute('data-filter', key);
        b.setAttribute('aria-pressed', wordFilter === key ? 'true' : 'false');
        on(b, 'click', function () {
          wordFilter = key;
          var kids = rowEl.children;
          for (var j = 0; j < kids.length; j++) kids[j].setAttribute('aria-pressed', kids[j].getAttribute('data-filter') === key ? 'true' : 'false');
          renderWordCards();
        });
        rowEl.appendChild(b);
      })(defs[i][0], defs[i][1]);
    }
    var search = $('#dictSearch');
    var anchor = null;
    if (search) { var p = search; while (p && p !== host && p.parentNode !== host) p = p.parentNode; anchor = p; }
    if (anchor && anchor.parentNode === host) host.insertBefore(rowEl, anchor.nextSibling);
    else host.insertBefore(rowEl, host.firstChild);
    return rowEl;
  }
  function renderWordCards() {
    var list = $('#dictList');
    if (!list) return;
    ensureFilterRow();
    var words = wordList();
    var q = '';
    var search = $('#dictSearch');
    if (search && search.value) q = String(search.value).toLowerCase();
    var weak = weakSet(), mastered = masteredSet();
    var shown = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i] || {};
      var key = String(w.w || '').toLowerCase();
      if (q && key.indexOf(q) < 0) continue;
      if (wordFilter === 'weak' && !weak[key]) continue;
      if (wordFilter === 'mastered' && !mastered[key]) continue;
      shown.push({ w: w, i: i });
    }
    if (wordFilter === 'az') {
      shown.sort(function (a, b) { return String(a.w.w || '').toLowerCase() < String(b.w.w || '').toLowerCase() ? -1 : 1; });
    }
    list.textContent = '';
    for (var k = 0; k < shown.length; k++) list.appendChild(wordCard(shown[k].w, shown[k].i + 1));
    if (!shown.length) {
      var empty = mk('p', 'tiny muted', null, 'No words match this filter.');
      list.appendChild(empty);
    }
  }
  function wordCard(w, num) {
    var card = mk('div', 'sdp-word-card wordcard v59-dict-card');
    card.setAttribute('data-word', String(w.w || ''));
    card.appendChild(mk('span', 'sdp-word-num', null, String(num)));
    var body = mk('div', 'sdp-word-body');
    var head = mk('div', 'sdp-word-head');
    head.appendChild(mk('b', null, null, String(w.w || '')));
    if (w.p) head.appendChild(mk('span', 'v59-ipa', null, '/' + String(w.p) + '/'));
    if (w.pos) head.appendChild(mk('span', 'v59-pos', null, String(w.pos)));
    body.appendChild(head);
    if (w.m) body.appendChild(mk('div', 'sdp-word-def', null, String(w.m)));
    if (w.s) {
      var eg = mk('div', 'sdp-word-eg');
      var s = String(w.s);
      var target = String(w.w || '');
      var idx = target ? s.toLowerCase().indexOf(target.toLowerCase()) : -1;
      if (idx >= 0) {
        eg.appendChild(D.createTextNode(s.slice(0, idx)));
        eg.appendChild(mk('b', null, null, s.slice(idx, idx + target.length)));
        eg.appendChild(D.createTextNode(s.slice(idx + target.length)));
      } else {
        eg.textContent = s;
      }
      body.appendChild(eg);
    }
    if (w.si) body.appendChild(mk('span', 'sdp-si-pill si-text', null, '\u0DC3\u0DD2\u0D82\u0DC4\u0DBD \u00B7 ' + String(w.si)));
    card.appendChild(body);
    var acts = mk('div', 'sdp-word-acts');
    var play = mk('button', null, null, '\u25B6');
    play.type = 'button';
    play.setAttribute('aria-label', 'Play ' + String(w.w || ''));
    on(play, 'click', function () { say(w.w, false); });
    var slow = mk('button', null, null, '\uD83D\uDC22');
    slow.type = 'button';
    slow.setAttribute('aria-label', 'Play ' + String(w.w || '') + ' slowly');
    on(slow, 'click', function () { say(w.w, true); });
    acts.appendChild(play);
    acts.appendChild(slow);
    card.appendChild(acts);
    return card;
  }
  function wrapDict() {
    var s = Screens();
    if (!s || s.__v60Dict || typeof s.dict !== 'function') return;
    var orig = s.dict;
    s.dict = function () {
      var out = orig.apply(this, arguments);
      try { renderWordCards(); } catch (e) {}
      return out;
    };
    s.__v60Dict = true;
  }

  /* ---------------------------------------------------------------- cockpit */
  function pad2(n) { var s = String(Math.max(0, Math.round(n))); return s.length < 2 ? '0' + s : s; }
  function cockpitLayer(eng) {
    var e = eng || Eng();
    if (!e || !e.layer) return null;
    var layer = e.layer;
    if (layer.nodeType !== 1) return null;
    if (!layer.className || String(layer.className).indexOf('player') < 0) {
      try { var p = layer.querySelector('.layer.player') || $(('.layer.player')); if (p) layer = p; } catch (err) {}
    }
    return layer;
  }
  function decorateCockpit(eng) {
    var layer = cockpitLayer(eng);
    if (!layer) return;
    var card = layer.querySelector('.wordcard');
    if (!card) return;
    card.id = 'sdpCockpitCard';
    if (!$('#sdpEdgeBar', card)) {
      var bar = mk('div', null, 'sdpEdgeBar');
      bar.appendChild(mk('span', null, 'sdpEdgeBarFill'));
      card.insertBefore(bar, card.firstChild);
    }
    if (!$('#sdpCockpitHeaderRow', card)) {
      var headRow = mk('div', null, 'sdpCockpitHeaderRow');
      headRow.appendChild(mk('span', null, 'sdpCockpitWordOf', fill(T4('wordOf'), 1, 1)));
      var status = $('#plStatus', card);
      var pill = mk('div', null, 'sdpTimerPill');
      var num = $('#cdNum', card) || $('#cdNum', layer);
      var ring = $('#cdFg', card) || $('#cdFg', layer);
      var ringSvg = ring;
      while (ringSvg && ringSvg.nodeName && String(ringSvg.nodeName).toLowerCase() !== 'svg') ringSvg = ringSvg.parentNode;
      if (ringSvg && String(ringSvg.nodeName).toLowerCase() === 'svg') pill.appendChild(ringSvg);
      else pill.appendChild(mk('span', null, null, '\u25CB'));
      if (num) pill.appendChild(num);
      headRow.appendChild(status || mk('span', null, 'plStatus', T4('writing')));
      headRow.appendChild(pill);
      var stepEl = $('#plStep', card);
      if (stepEl && stepEl.parentNode === card) card.insertBefore(headRow, stepEl.nextSibling);
      else card.insertBefore(headRow, card.firstChild.nextSibling ? card.firstChild.nextSibling : null);
    }
    if (!$('#sdpCockpitStage', card)) {
      var stage = mk('div', null, 'sdpCockpitStage');
      stage.appendChild(mk('div', null, 'sdpCockpitKicker', fill(T4('dictation'), 1)));
      var slots = mk('div', null, 'sdpLetterSlots');
      for (var i = 0; i < 8; i++) slots.appendChild(mk('i'));
      stage.appendChild(slots);
      var ansWrap = $('#ansInput', card);
      var ansDeck = ansWrap;
      while (ansDeck && ansDeck !== card && !(ansDeck.className && String(ansDeck.className).indexOf('ans-') === 0)) ansDeck = ansDeck.parentNode;
      if (ansWrap && ansDeck && ansDeck !== card) { slots.style.display = 'none'; stage.appendChild(ansDeck); }
      stage.appendChild(mk('div', null, 'sdpCockpitCaption', T4('caption')));
      headRowAfter(card, stage);
    }
    if (!$('#sdpCockpitDock', card)) {
      var dock = mk('div', null, 'sdpCockpitDock');
      var e2 = Eng() || {};
      dockButton(dock, 'sdpDockRepeat', '\u21BA', T4('repeat'), function () { try { e2.repeatWord(); } catch (e) {} });
      dockButton(dock, 'sdpDockSlower', '\uD83D\uDC22', T4('slower'), function () { try { e2.slower(); } catch (e) {} });
      dockButton(dock, 'sdpDockSentence', '\uD83D\uDD8A', T4('sent'), function () { try { e2.repeatSentence(); } catch (e) {} });
      dockButton(dock, 'sdpDockSpell', '\uD83D\uDD24', T4('spell'), function () { try { e2.spellWord(); } catch (e) {} });
      var stageEl = $('#sdpCockpitStage', card);
      if (stageEl && stageEl.parentNode === card) card.insertBefore(dock, stageEl.nextSibling);
      else card.appendChild(dock);
    }
    if (!$('#sdpCockpitFoot', card)) {
      var foot = mk('div', null, 'sdpCockpitFoot');
      foot.appendChild(mk('span', null, 'sdpCockpitVoice', T4('footVoice')));
      var acts = mk('div', 'sdp-foot-acts');
      var e3 = Eng() || {};
      var pause = mk('button', null, 'sdpPauseBtn', T4('pause'));
      pause.type = 'button';
      on(pause, 'click', function () { try { e3.playPause(); } catch (e) {} });
      var skip = mk('button', null, 'sdpSkipBtn', T4('skip'));
      skip.type = 'button';
      on(skip, 'click', function () { try { e3.next(); } catch (e) {} });
      acts.appendChild(pause);
      acts.appendChild(skip);
      foot.appendChild(acts);
      card.appendChild(foot);
    }
    /* counters + word map live after the card inside the layer */
    if (!$('#sdpCockpitCounters', layer)) {
      var counters = mk('div', null, 'sdpCockpitCounters');
      counters.appendChild(statCard('sdpCountCorrect', '0', T4('correct'), 'ok'));
      counters.appendChild(statCard('sdpCountMissed', '0', T4('missed'), 'warn'));
      counters.appendChild(statCard('sdpCountStreak', '0', T4('streakL'), ''));
      var cardParent = card.parentNode || layer;
      if (cardParent.insertBefore) cardParent.insertBefore(counters, card.nextSibling);
    }
    if (!$('#sdpWordMapCard', layer)) {
      var wm = mk('div', null, 'sdpWordMapCard');
      var grid = mk('div', null, 'sdpWordMap');
      var total = (eng && eng.words && eng.words.length) || wordList().length || 30;
      for (var j = 1; j <= total; j++) grid.appendChild(mk('i', null, 'sdpWordCell' + j, String(j)));
      wm.appendChild(grid);
      var holder = $('#sdpCockpitCounters', layer);
      if (holder && holder.parentNode) holder.parentNode.insertBefore(wm, holder.nextSibling);
      else layer.appendChild(wm);
    }
    hideLegacyPlayerButtons(card);
    syncCockpit(eng, null, null);
    return card;
  }
  function headRowAfter(card, node) {
    var headRow = $('#sdpCockpitHeaderRow', card);
    if (headRow && headRow.parentNode === card) card.insertBefore(node, headRow.nextSibling);
    else card.appendChild(node);
  }
  function dockButton(dock, id, glyph, label, fn) {
    var b = mk('button', null, id);
    b.type = 'button';
    b.appendChild(mk('span', null, null, glyph));
    b.appendChild(mk('span', null, null, label));
    on(b, 'click', fn);
    dock.appendChild(b);
    return b;
  }
  var KEEP_PLAYER = { sdpCockpitCard: 1, sdpCockpitHeaderRow: 1, sdpCockpitStage: 1, sdpCockpitDock: 1, sdpCockpitFoot: 1, sdpEdgeBar: 1 };
  function hideLegacyPlayerButtons(card) {
    var kids = card.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (!k || KEEP_PLAYER[k.id]) continue;
      if (k.querySelector && k.querySelector('#ansInput')) continue;
      if (k.querySelector && k.querySelector('button')) { k.style.display = 'none'; }
    }
  }
  function syncCockpit(eng, sec, total) {
    var e = eng || Eng();
    var layer = cockpitLayer(e);
    if (!layer) return;
    var totalWords = (e && e.words && e.words.length) || wordList().length || 30;
    var idx = e && typeof e.idx === 'number' ? e.idx : 0;
    var wordOf = $('#sdpCockpitWordOf', layer);
    if (wordOf) wordOf.textContent = fill(T4('wordOf'), Math.min(totalWords, idx + 1), totalWords);
    var kicker = $('#sdpCockpitKicker', layer);
    if (kicker) kicker.textContent = fill(T4('dictation'), Math.min(totalWords, idx + 1));
    var num = $('#cdNum', layer);
    if (num) {
      var val = sec === null || sec === undefined ? Number(num.textContent) : Number(sec);
      if (!isNaN(val)) num.textContent = pad2(val) + '.0s';
    }
    var phase = String((e && (e.phase || e.st)) || '');
    var fillBar = $('#sdpEdgeBarFill', layer);
    var status = $('#plStatus', layer);
    var color = '#38BDF8', label = T4('listening');
    if (phase === 'waiting' || phase === 'write' || phase === 'writing') { color = '#FBBF24'; label = T4('writing'); }
    else if (phase === 'reveal') { color = '#4ADE80'; label = T4('reveal'); }
    else if (phase === 'idle' || phase === 'ready') { color = '#38BDF8'; label = T4('waiting'); }
    if (fillBar) fillBar.style.background = color;
    if (status && status.parentNode && status.parentNode.id === 'sdpCockpitHeaderRow') {
      status.textContent = '\u25CF ' + label;
      status.style.background = color === '#38BDF8' ? 'rgba(56,189,248,0.14)' : (color === '#4ADE80' ? 'rgba(74,222,128,0.14)' : 'rgba(251,191,36,0.14)');
      status.style.color = color;
    }
    var cells = $$('#sdpWordMap i', layer);
    for (var i = 0; i < cells.length; i++) {
      if (i === idx) cells[i].className = 'now';
      else cells[i].className = '';
    }
  }
  function wrapCockpit() {
    var e = Eng();
    if (!e || e.__v60Cockpit) return;
    if (typeof e.openPlayer === 'function') {
      var op = e.openPlayer;
      e.openPlayer = function () {
        var out = op.apply(this, arguments);
        try { decorateCockpit(this); } catch (err) {}
        return out;
      };
    }
    if (typeof e.paintCountdown === 'function') {
      var pc = e.paintCountdown;
      e.paintCountdown = function (left, total) {
        var out2 = pc.apply(this, arguments);
        try { syncCockpit(this, left, total); } catch (err) {}
        return out2;
      };
    }
    if (typeof e.paint === 'function' && !e.__v60CockpitPaint) {
      var pa = e.paint;
      e.paint = function () {
        var out3 = pa.apply(this, arguments);
        try { if (this && this.layer) decorateCockpit(this); } catch (err) {}
        return out3;
      };
      e.__v60CockpitPaint = true;
    }
    e.__v60Cockpit = true;
  }
