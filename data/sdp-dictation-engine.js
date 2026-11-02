/*! Smart Dictation Player — dictation engine (v0.0.1.e)
 * Strict ES5, dependency free.
 * contract: docs/ARCHITECTURE_MAP.md §R2 priority #3 single integrated cockpit
 * contract: docs/ARCHITECTURE_MAP.md §R4 focus & input law
 * contract: docs/ARCHITECTURE_MAP.md §R5 beat state machine */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;

  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function now() { return Date.now(); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function setText(el, text) { if (el) el.textContent = str(text); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function settings() {
    try { return SDP.Data.settings(); } catch (e) { return { mode: 'paper', writeSecs: 8, repeats: 3, pauseSecs: 1.5, autoAdvance: true }; }
  }
  function t(key, fallback) {
    try { if (SDP.Views && SDP.Views.t) return SDP.Views.t(key, fallback); } catch (e) {}
    return fallback === undefined ? key : fallback;
  }

  var RING_R = 34;
  var RING_C = 2 * Math.PI * RING_R; /* 213.63 */
  var TICK_MS = 100;

  var E = {
    phase: 'idle',
    pausedPhase: '',
    mode: 'paper',
    index: 0,
    items: [],
    hints: { pos: false, first: false, si: false, sentence: false },
    writeSecs: 8,
    repeats: 3,
    pauseSecs: 1.5,
    autoAdvance: true,
    repeatsDone: 0,
    repeatsTotal: 1,
    phaseEnd: 0,
    invertConfirmUntil: 0,
    phaseMs: 0,
    remainingMs: 0,
    deadline: 0,
    ticker: null,
    repeatTimer: null,
    epoch: 0,
    retryOnly: false,
    sessionNo: '8',
    finished: false,
    startedAt: 0
  };

  var els = {};
  function el(name) {
    if (!els[name]) els[name] = byId(name);
    return els[name];
  }
  function refreshEls() { els = {}; }

  function state() { return E.phase; }
  function items() { return E.items; }
  function current() { return E.items[E.index] || null; }

  /* ── scoring helpers ────────────────────────────────────────────────── */
  function isCorrectItem(item) {
    if (!item) return false;
    if (item.correct !== null && item.correct !== undefined) return !!item.correct;
    if (E.mode === 'typing') return normalize(item.typed) === normalize(item.w);
    return item.marked === 'correct';
  }
  function normalize(text) {
    return str(text).replace(/^\s+|\s+$/g, '').toLowerCase().replace(/\s+/g, ' ');
  }
  function scored() {
    var correct = 0, i;
    for (i = 0; i < E.items.length; i++) if (isCorrectItem(E.items[i])) correct += 1;
    return { correct: correct, total: E.items.length };
  }

  function buildModel() {
    var out = [], i;
    for (i = 0; i < E.items.length; i++) {
      var item = E.items[i];
      out.push({
        i: item.i, w: item.w, typed: item.typed, correct: isCorrectItem(item),
        marked: item.marked, si: item.word ? item.word.si : '', pos: item.word ? item.word.pos : '',
        origIndex: item.origIndex
      });
    }
    return { mode: E.mode, items: out, retryOnly: E.retryOnly, sessionNo: E.sessionNo };
  }

  /* ── ring / bar / readouts ──────────────────────────────────────────── */
  function ringColor() {
    if (E.phase === 'listening') return '#38BDF8';
    if (E.phase === 'writing') return (E.remainingMs <= 3000 ? '#F59E0B' : '#10B981');
    return '#A1A1AA';
  }
  function paint(frac) {
    var ring = el('beatRing');
    if (ring) {
      var f = Math.max(0, Math.min(1, frac));
      ring.setAttribute('stroke-dasharray', String(Math.round(RING_C * 100) / 100));
      ring.setAttribute('stroke-dashoffset', String(Math.round(RING_C * (1 - f) * 100) / 100));
      ring.setAttribute('stroke', ringColor());
      ring.style.stroke = ringColor();
    }
    var bar = el('beatBar');
    if (bar) {
      bar.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
      bar.style.backgroundColor = ringColor();
    }
    var secs = el('beatSeconds');
    if (secs) setText(secs, pad2(Math.max(0, Math.ceil(E.remainingMs / 1000))) + 's');
  }

  function setStateText() {
    var node = el('beatStateText');
    if (!node) return;
    if (E.phase === 'paused') { setText(node, t('pausedBeat', 'Paused')); return; }
    if (E.phase === 'finished') { setText(node, t('finishedBeat', 'Finished — check your answers')); return; }
    if (E.phase === 'idle') { setText(node, t('readyBeat', 'Ready')); return; }
    if (E.phase === 'listening') {
      var rep = E.repeatShown || 1;
      setText(node, t('listeningBeat', 'Listening') + ' · ' + t('repeatWord', 'Repeat') + ' ' + rep + ' / ' + E.repeats);
    } else if (E.phase === 'writing') {
      var left = Math.max(0, Math.ceil(E.remainingMs / 1000));
      setText(node, t('writeNowBeat', 'Write Now') + ' · ' + left + 's ' + t('remainingWord', 'remaining'));
    }
  }

  function updateMeta() {
    var item = current();
    setText(el('cockpitProgress'), (E.index + 1) + ' / ' + (E.items.length || 30));
    var badge = el('wordPosBadge');
    /* D-E4: a retry run is labelled as a retry, and still shows the original
       Session # so a student can find the word in their exercise book. */
    if (E.retryOnly) {
      var pos = item && item.word && item.word.pos ? ' · ' + item.word.pos : '';
      var orig = item && item.origIndex !== undefined ? ' · Session ' + str(E.sessionNo) + ' #' + (Number(item.origIndex) + 1) : '';
      setText(badge, 'Retry · Word ' + (E.index + 1) + ' of ' + (E.items.length || 0) + pos + orig);
      badge.className = 'badge badge-retry';
    } else {
      setText(badge, item && item.word && item.word.pos ? item.word.pos : '—');
      badge.className = 'badge';
    }
    var title = el('sessionTitle');
    if (title && SDP.Sync && SDP.Sync.sessionTitle) setText(title, SDP.Sync.sessionTitle());
  }

  /* ── hints ──────────────────────────────────────────────────────────── */
  function renderHints() {
    var item = current();
    var word = item && item.word ? item.word : { w: '', pos: '', si: '', s: '' };
    var host = el('hintChips');
    var out = byId('hintOutput');
    if (!host) return;
    if (!out) {
      out = doc.createElement('div');
      out.id = 'hintOutput';
      out.className = 'hint-output';
      if (host.parentNode) host.parentNode.insertBefore(out, host.nextSibling);
    }
    var lines = [];
    if (E.hints.pos && word.pos) lines.push(t('hintPos', 'Word type') + ': ' + word.pos);
    if (E.hints.first && word.w) {
      var letters = str(word.w).split('');
      var masked = [];
      for (var i = 0; i < letters.length; i++) masked.push(i === 0 ? letters[i] : (/[a-zA-Z]/.test(letters[i]) ? '_' : letters[i]));
      lines.push(t('hintFirst', 'First letter') + ': ' + masked.join(' '));
    }
    if (E.hints.si && word.si) lines.push(word.si);
    if (E.hints.sentence && word.s) {
      var blanked = str(word.s).replace(new RegExp('\\b' + str(word.w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'ig'), '_____');
      lines.push(blanked);
    }
    var html = '';
    for (var j = 0; j < lines.length; j++) html += '<p class="hint-chip-out">' + escapeHtml(lines[j]) + '</p>';
    out.innerHTML = html;
    out.hidden = lines.length === 0;
    var chips = host.querySelectorAll ? host.querySelectorAll('[data-hint]') : [];
    for (var c = 0; c < chips.length; c++) {
      var key = chips[c].getAttribute('data-hint');
      chips[c].setAttribute('aria-pressed', E.hints[key] ? 'true' : 'false');
    }
  }
  function escapeHtml(text) {
    return str(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toggleHint(name) {
    if (!name) return;
    E.hints[name] = !E.hints[name];
    renderHints();
  }
  function cycleHint() {
    var order = ['pos', 'first', 'si', 'sentence'], i;
    for (i = 0; i < order.length; i++) {
      if (!E.hints[order[i]]) { E.hints[order[i]] = true; renderHints(); return order[i]; }
    }
    for (i = 0; i < order.length; i++) E.hints[order[i]] = false;
    renderHints();
    return '';
  }

  /* ── typing input law (R4) ──────────────────────────────────────────── */
  function mountInput() {
    var stage = el('beatStage');
    if (!stage) return null;
    var input = byId('typeInput');
    if (E.mode !== 'typing') {
      if (input && input.parentNode) input.parentNode.removeChild(input);
      return null;
    }
    if (!input) {
      input = doc.createElement('input');
      input.id = 'typeInput';
      input.type = 'text';
      input.className = 'type-input';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('aria-label', 'Type the word you hear');
      input.value = '';
      stage.appendChild(input);
    }
    var item = current();
    if (input) input.value = item ? str(item.typed) : '';
    return input;
  }
  function unmountInput() {
    var input = byId('typeInput');
    if (input && input.parentNode) input.parentNode.removeChild(input);
  }
  function focusInputOnce() {
    /* The ONLY focus call in the whole app, typing mode only (R4). */
    if (E.mode !== 'typing') return;
    var input = byId('typeInput');
    if (!input || typeof input.focus !== 'function') return;
    try { input.focus({ preventScroll: true }); } catch (e) { try { input.focus(); } catch (e2) {} }
  }
  function submitTyped() {
    /* Typing-mode submit: Enter works in listening or writing, because a fast
       student may finish typing before the listening window closes. */
    var input = byId('typeInput');
    var item = current();
    if (!input || !item) return false;
    item.typed = input.value;
    saveDraft();
    if (E.index >= E.items.length - 1) { finish(); return true; }
    goNext();
    return true;
  }
  function bindInput() {
    var input = byId('typeInput');
    if (!input || input._sdpBound) return;
    input._sdpBound = true;
    input.addEventListener('input', function () {
      var item = current();
      if (item) item.typed = input.value;
      saveDraft();
    });
    input.addEventListener('keydown', function (ev) {
      var key = ev && (ev.key || ev.keyCode);
      if (key !== 'Enter' && key !== 13) return;
      if (ev && ev.preventDefault) ev.preventDefault();
      if (E.mode !== 'typing') return;
      if (E.phase !== 'listening' && E.phase !== 'writing') return;
      submitTyped();
    });
  }

  /* ── phase machine ──────────────────────────────────────────────────── */
  /* ENG-02: the 0.5 s slider position used to become a 2.0 s gap because of a
     hard 1500 ms floor. 0.5 s → 800 ms, 1.5 s → 1800 ms, 3 s → 3300 ms. */
  function repeatGapMs() {
    return Math.max(600, Math.round(Number(E.pauseSecs || 0) * 1000) + 300);
  }
  function listenMs() {
    return Math.max(1200, repeatGapMs() * Math.max(1, E.repeats));
  }

  function stopTicker() {
    if (E.ticker) { global.clearInterval(E.ticker); E.ticker = null; }
    if (E.repeatTimer) { global.clearTimeout(E.repeatTimer); E.repeatTimer = null; }
  }
  function startTicker() {
    stopTicker();
    E.ticker = global.setInterval(tick, TICK_MS);
  }

  function tick() {
    /* F2: while the final repetition is still speaking, keep the listening
       phase alive (polling on the 100ms ticker) so the writing countdown
       never starts mid-audio; hard cap at +2000 ms past phase end. */
    if (E.phase === 'listening' && E.waitingForSpeech) {
      /* D-E1: one timestamp field only. onPhaseEnd() writes E.waitSince; this
         path must read the same field. v0.0.1.b read E.phaseStart here, which
         was already >2000 ms old on any listening phase longer than 2 s, so the
         grace window expired instantly and writing cut the final repeat off. */
      if (!E.waitSince) E.waitSince = now();
      /* ENG-01: 8 s of grace (re-armed per repeat) instead of 2 s, so audio on
         a slow 3G phone is never cut off mid-word. */
      if (now() - E.waitSince >= 8000) { E.waitingForSpeech = false; E.waitSince = 0; enterWriting(); return; }
      if (SDP.Speech && SDP.Speech.isSpeaking && SDP.Speech.isSpeaking()) {
        /* D-E3: paint the true remaining listening fraction, not a constant. */
        var leftMs = Math.max(0, E.deadline - now());
        paint(E.phaseMs ? leftMs / E.phaseMs : 0);
        setStateText();
        return;
      }
      E.waitingForSpeech = false;
      E.waitSince = 0;
      enterWriting();
      return;
    }
    if (E.phase !== 'listening' && E.phase !== 'writing') return;
    var left = E.deadline - now();
    if (left < 0) left = 0;
    E.remainingMs = left;
    paint(E.phaseMs ? left / E.phaseMs : 0);
    setStateText();
    if (left <= 0) {
      /* ENG-01: a pending repeat always buys the listening phase more time. */
      if (E.phase === 'listening' && E.repeatsDone < E.repeatsTotal) {
        extendListening();
        return;
      }
      onPhaseEnd();
    }
  }

  /* ENG-01: one shared extender so a repeat can never be truncated by the
     original listening deadline (clip load + play + gap + 1.8 s of slack). */
  function extendListening() {
    var until = now() + repeatGapMs() + 1800;
    if (until > E.deadline) {
      E.deadline = until;
      E.phaseMs = Math.max(E.phaseMs, E.deadline - (E.phaseStart || now()));
      E.remainingMs = E.deadline - now();
    }
    E.phaseEnd = E.deadline;
    return E.deadline;
  }

  function onPhaseEnd() {
    if (E.phase === 'listening') {
      /* F2: wait for in-flight speech before the writing window opens. */
      if (SDP.Speech && SDP.Speech.isSpeaking && SDP.Speech.isSpeaking()) {
        E.waitingForSpeech = true;
        E.waitSince = now();
        return;
      }
      E.waitSince = 0;
      enterWriting();
      return;
    }
    if (E.phase === 'writing') {
      saveDraft();
      if (E.autoAdvance) {
        if (E.index + 1 >= E.items.length) finish();
        else enterWord(E.index + 1);
      } else {
        pause();
      }
    }
  }

  function enterListening() {
    E.phase = 'listening';
    E.phaseStart = now();
    E.epoch += 1;
    E.phaseMs = listenMs();
    E.remainingMs = E.phaseMs;
    E.deadline = now() + E.phaseMs;
    E.repeatShown = 1;
    E.repeatsDone = 0;
    E.repeatsTotal = Math.max(1, Number(E.repeats) || 1);
    E.phaseEnd = E.deadline;
    E.waitSince = 0;
    E.waitingForSpeech = false;
    paint(1);
    setStateText();
    speakRepeats(E.epoch);
    startTicker();
  }

  /* D-E2: repeats used to be scheduled by a blind timer, so a slow dictionary
     clip or a long Alice clip overlapped the next repetition. Every repeat now
     waits for the previous one to finish, then holds the configured gap.
     A bounded fallback timer guarantees the chain never stalls if a speech
     backend forgets to call back. */
  function speakRepeats(epoch) {
    var done = 0;
    var gap = repeatGapMs();
    function scheduleNext() {
      if (epoch !== E.epoch || E.phase !== 'listening') return;
      if (done >= E.repeats) return;
      if (E.repeatTimer) { global.clearTimeout(E.repeatTimer); E.repeatTimer = null; }
      E.repeatTimer = global.setTimeout(fire, gap);
    }
    function fire() {
      E.repeatTimer = null;
      if (epoch !== E.epoch || E.phase !== 'listening') return;
      var item = current();
      if (!item) return;
      done += 1;
      E.repeatsDone = done;
      E.repeatsTotal = Math.max(1, Number(E.repeats) || 1);
      E.repeatShown = Math.min(done, E.repeats);
      /* ENG-01: every pending repeat re-arms the grace window and pushes the
         listening deadline out by one gap plus 1.8 s. */
      if (E.repeatsDone < E.repeatsTotal) {
        extendListening();
        E.waitSince = 0;
      }
      setStateText();
      var settled = false;
      var guard = global.setTimeout(function () { if (!settled) { settled = true; scheduleNext(); } }, Math.max(2600, gap + estimatePlayMs(item)));
      function after() {
        if (settled) return;
        settled = true;
        global.clearTimeout(guard);
        if (E.repeatsDone < E.repeatsTotal) extendListening();
        scheduleNext();
      }
      try {
        if (SDP.Speech && SDP.Speech.playWord) SDP.Speech.playWord(item.word, {}, after);
        else after();
      } catch (e) { after(); }
    }
    fire();
  }
  function estimatePlayMs(item) {
    var word = str(item && item.word ? (item.word.w || item.word) : '');
    return 600 + 90 * word.length;
  }

  function enterWriting() {
    if (E.repeatTimer) { global.clearTimeout(E.repeatTimer); E.repeatTimer = null; }
    E.phase = 'writing';
    E.phaseMs = Math.max(3, Number(E.writeSecs) || 8) * 1000;
    E.remainingMs = E.phaseMs;
    E.deadline = now() + E.phaseMs;
    paint(1);
    setStateText();
    mountInput();
    bindInput();
    focusInputOnce();
    startTicker();
  }

  function enterWord(index) {
    if (index < 0) index = 0;
    if (index >= E.items.length) { finish(); return; }
    E.index = index;
    E.finished = false;
    E.hints = { pos: false, first: false, si: false, sentence: false };
    updateMeta();
    renderHints();
    mountInput();
    if (E.startedAt === 0) E.startedAt = now();
    saveDraft();
    enterListening();
  }

  function pause() {
    if (E.phase !== 'listening' && E.phase !== 'writing') return;
    E.pausedPhase = E.phase;
    E.remainingMs = Math.max(0, E.deadline - now());
    E.phase = 'paused';
    stopTicker();
    try { if (SDP.Speech) SDP.Speech.stop(); } catch (e) {}
    paint(E.phaseMs ? E.remainingMs / E.phaseMs : 0);
    setStateText();
  }

  /* F1: resume into 'writing' remounts/binds #typeInput and preserves any
     partial typed text; resume into 'listening' bumps the epoch and
     restarts the current word's repeat schedule from repeat 1 with a fresh
     listening deadline. */
  function resume() {
    if (E.phase !== 'paused') return;
    var back = E.pausedPhase === 'writing' ? 'writing' : 'listening';
    E.phase = back;
    if (back === 'writing') {
      E.deadline = now() + E.remainingMs;
      startTicker();
      paint(E.phaseMs ? E.remainingMs / E.phaseMs : 1);
      setStateText();
      mountInput();
      bindInput();
      focusInputOnce();
    } else {
      E.epoch += 1;
      E.phaseMs = listenMs();
      E.remainingMs = E.phaseMs;
      E.deadline = now() + E.phaseMs;
      E.repeatShown = 1;
      paint(1);
      setStateText();
      startTicker();
      speakRepeats(E.epoch);
    }
  }

  function togglePlayPause() {
    if (E.phase === 'paused') { resume(); return 'resumed'; }
    if (E.phase === 'idle') { if (E.items.length) enterWord(E.index); return 'started'; }
    if (E.phase === 'finished') return 'finished';
    pause();
    return 'paused';
  }

  function repeatWord() {
    var item = current();
    if (!item || !SDP.Speech) return;
    try { SDP.Speech.playWord(item.word, {}, noop); } catch (e) {}
  }

  function goNext() {
    if (E.index + 1 >= E.items.length) { finish(); return; }
    enterWord(E.index + 1);
  }
  function goPrev() {
    if (E.index <= 0) { enterWord(0); return; }
    enterWord(E.index - 1);
  }
  /* R7 Smart Board jumper: tap any word number on the board; pause the
     current word, remount at the chosen index and enter listening. */
  function jumpTo(index) {
    if (index < 0) index = 0;
    if (index >= E.items.length) return false;
    if (E.phase !== 'idle' && E.phase !== 'finished') pause();
    E.index = index;
    saveDraft();
    enterWord(E.index);
    return true;
  }

  function setMode(mode, silent) {
    E.mode = mode === 'typing' ? 'typing' : 'paper';
    if (!silent) {
      try { SDP.Data.saveSettings({ mode: E.mode }); } catch (e) {}
      if (SDP.Views && SDP.Views.applyModePills) SDP.Views.applyModePills(E.mode);
    }
    if (E.mode === 'typing') { mountInput(); bindInput(); }
    else unmountInput();
    return E.mode;
  }
  function toggleMode() {
    setMode(E.mode === 'typing' ? 'paper' : 'typing');
    if (E.phase === 'writing') focusInputOnce();
    return E.mode;
  }

  /* ── draft resume (R8 sdp.session) ─────────────────────────────────── */
  function saveDraft() {
    try {
      if (!SDP.Data || E.finished || !E.items.length) return;
      var answers = {}, i;
      for (i = 0; i < E.items.length; i++) {
        var item = E.items[i];
        if (item.typed || item.marked) answers[item.w] = { typed: item.typed, marked: item.marked };
      }
      SDP.Data.saveSession({
        sessionId: str(E.sessionNo), index: E.index, mode: E.mode,
        answers: answers, updatedAt: now()
      });
    } catch (e) {}
  }

  /* ── results & self-check table ─────────────────────────────────────── */
  function grade() {
    var i;
    for (i = 0; i < E.items.length; i++) {
      var item = E.items[i];
      if (E.mode === 'typing') {
        item.correct = normalize(item.typed) === normalize(item.w);
        item.marked = item.correct ? 'correct' : 'missed';
      } else {
        if (item.marked !== 'correct' && item.marked !== 'missed') item.marked = 'correct';
        item.correct = item.marked === 'correct';
      }
    }
  }

  function paintPaperNotice() {
    var panel = el('resultsPanel');
    if (!panel) return false;
    var node = el('paperModeNotice');
    if (!node && panel.querySelector && doc.createElement) {
      node = doc.createElement('p');
      node.id = 'paperModeNotice';
      node.className = 'paper-notice';
      node.setAttribute('role', 'status');
      var table = panel.querySelector('.table-wrap');
      if (table && table.parentNode) table.parentNode.insertBefore(node, table);
      else panel.appendChild(node);
    }
    if (!node) return false;
    /* D-E5: paper mode starts every word as "correct" because nothing was
       typed. Say so, instead of silently handing out a perfect score. */
    node.hidden = E.mode !== 'paper';
    node.textContent = E.mode === 'paper' ? 'Paper Mode: Tap any word you missed to mark ✗' : '';
    return true;
  }

  function renderResults() {
    var body = doc && doc.querySelector ? doc.querySelector('#resultsTable tbody') : null;
    if (!body) return;
    paintPaperNotice();
    var html = '', i;
    for (i = 0; i < E.items.length; i++) {
      var item = E.items[i];
      var correct = isCorrectItem(item);
      var typed = str(item.typed);
      var diff = '';
      var yourWord = '—';
      if (typed) yourWord = typed;
      if (E.mode === 'typing' && typed && !correct) diff = '<span class="r-diff">' + escapeHtml(typed) + '</span>';
      /* D-E4: in a retry run the row number alone is meaningless — show the
         original Session # so the word can be found in the book. */
      var idxLabel = E.retryOnly && item.origIndex !== undefined
        ? 'S' + str(E.sessionNo) + ' #' + (Number(item.origIndex) + 1)
        : str(i + 1);
      html += '<tr data-row="' + i + '" class="' + (correct ? 'is-correct' : 'is-missed') + '"' +
        (E.retryOnly && item.origIndex !== undefined ? ' data-orig="' + (Number(item.origIndex) + 1) + '"' : '') + '>' +
        '<td class="r-idx">' + idxLabel + '</td>' +
        '<td class="r-word">' + (diff || escapeHtml(yourWord)) + '</td>' +
        '<td class="r-correct">' + escapeHtml(item.w) + (item.word && item.word.si ? ' <span class="word-si">' + escapeHtml(item.word.si) + '</span>' : '') + '</td>' +
        '<td><button type="button" class="mark-btn" data-mark="correct" data-row-index="' + i + '" aria-pressed="' + (item.marked === 'correct') + '">✅ ' + escapeHtml(t('markCorrect', 'Correct')) + '</button> ' +
        '<button type="button" class="mark-btn" data-mark="missed" data-row-index="' + i + '" aria-pressed="' + (item.marked === 'missed') + '">❌ ' + escapeHtml(t('markMissed', 'Missed')) + '</button></td>' +
        '</tr>';
    }
    body.innerHTML = html;
    paintScore();
  }

  function paintScore() {
    var score = scored();
    setText(el('scoreValue'), score.correct + ' / ' + score.total);
    var pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    setText(el('scorePct'), pct + '%');
    return { score: score, pct: pct };
  }

  function mark(index, markState) {
    var item = E.items[index];
    if (!item) return null;
    item.marked = markState === 'missed' ? 'missed' : 'correct';
    item.correct = item.marked === 'correct';
    var row = doc && doc.querySelector ? doc.querySelector('#resultsTable tr[data-row="' + index + '"]') : null;
    if (row) {
      row.className = item.correct ? 'is-correct' : 'is-missed';
      var buttons = row.querySelectorAll ? row.querySelectorAll('.mark-btn') : [];
      for (var b = 0; b < buttons.length; b++) {
        buttons[b].setAttribute('aria-pressed', String(buttons[b].getAttribute('data-mark') === item.marked));
      }
    }
    paintScore();
    syncMastery();
    return item;
  }
  function markAll() {
    var i;
    for (i = 0; i < E.items.length; i++) E.items[i].marked = 'correct';
    for (i = 0; i < E.items.length; i++) E.items[i].correct = true;
    renderResults();
    syncMastery();
  }
  /* ENG-07: one stray Smart Board tap used to score 0/30. The first tap only
     arms the action; the second one inside 3 s actually inverts every row. */
  function toggleMissed() {
    var i;
    if (!E.invertConfirmUntil || E.invertConfirmUntil <= now()) {
      E.invertConfirmUntil = now() + 3000;
      var btn = byId('btnToggleMissed');
      if (btn) {
        btn.setAttribute('data-confirm-arm', '1');
        btn.setAttribute('aria-pressed', 'true');
      }
      if (SDP.Views && SDP.Views.showToast) {
        try { SDP.Views.showToast(t('invertConfirmToast', 'Tap Invert marks again within 3s to confirm')); } catch (e) {}
      }
      return 'armed';
    }
    E.invertConfirmUntil = 0;
    var armed = byId('btnToggleMissed');
    if (armed) {
      armed.setAttribute('data-confirm-arm', '0');
      armed.setAttribute('aria-pressed', 'false');
    }
    for (i = 0; i < E.items.length; i++) {
      E.items[i].marked = E.items[i].marked === 'missed' ? 'correct' : 'missed';
      E.items[i].correct = E.items[i].marked === 'correct';
    }
    renderResults();
    syncMastery();
    return 'inverted';
  }

  /* After the first save, mark changes update mastery/weak words only: the
     attempt counters and the streak are never inflated by tapping (R8). */
  function syncMastery() {
    if (!SDP.Data) return;
    try {
      var progress = SDP.Data.progress();
      var score = scored();
      var i;
      for (i = 0; i < E.items.length; i++) {
        var item = E.items[i];
        var key = str(item.w).toLowerCase();
        if (!key) continue;
        /* The first save counted one attempt per word; flipping a mark must
           move the correct counter by exactly the delta, never add attempts. */
        var attempt = progress.attempts[key];
        if (attempt) {
          var want = isCorrectItem(item) ? 1 : 0;
          var have = item.attemptCorrect ? 1 : 0;
          if (want !== have) {
            attempt.correct = Math.max(0, (Number(attempt.correct) || 0) + want - have);
            item.attemptCorrect = want === 1;
            progress.attempts[key] = attempt;
          }
        }
        if (isCorrectItem(item)) {
          progress.mastered[key] = true;
          var at = progress.weakWords.indexOf(key);
          if (at >= 0) progress.weakWords.splice(at, 1);
        } else {
          delete progress.mastered[key];
          if (progress.weakWords.indexOf(key) < 0) progress.weakWords.push(key);
        }
      }
      progress.lastScore = {
        correct: score.correct, total: score.total,
        pct: score.total ? Math.round((score.correct / score.total) * 100) : 0,
        mode: E.mode, at: now()
      };
      SDP.Data.saveProgress(progress);
      if (SDP.Views && SDP.Views.renderHome) SDP.Views.renderHome();
    } catch (e) {}
  }

  function showResults(show) {
    var panel = el('resultsPanel');
    if (panel) panel.hidden = !show;
  }

  function finish() {
    if (!E.items.length) return;
    stopTicker();
    E.epoch += 1;
    E.phase = 'finished';
    E.finished = true;
    E.remainingMs = 0;
    try { if (SDP.Speech) SDP.Speech.stop(); } catch (e) {}
    paint(0);
    setStateText();
    grade();
    renderResults();
    showResults(true);
    try {
      if (SDP.Data) {
        SDP.Data.recordResult(buildModel());
        SDP.Data.clearSession();
      }
      for (var ai = 0; ai < E.items.length; ai++) E.items[ai].attemptCorrect = isCorrectItem(E.items[ai]);
    } catch (e) {}
    if (SDP.Views && SDP.Views.renderHome) { try { SDP.Views.renderHome(); } catch (e) {} }
    if (SDP.Views && SDP.Views.onFinished) { try { SDP.Views.onFinished(buildModel()); } catch (e) {} }
    if (doc && doc.getElementById && doc.getElementById('resultsPanel')) {
      try { doc.getElementById('resultsPanel').scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
    return buildModel();
  }

  function missedWords() {
    var out = [], i;
    for (i = 0; i < E.items.length; i++) if (!isCorrectItem(E.items[i])) out.push(E.items[i].word);
    return out;
  }

  function retryMissedOnly() {
    var words = missedWords();
    if (!words.length) return { ok: false, reason: 'nothing_missed' };
    start({ words: words, mode: E.mode, retryOnly: true });
    return { ok: true, count: words.length };
  }

  function startNewSession() {
    var words = SDP.Sync && SDP.Sync.words ? SDP.Sync.words() : [];
    start({ words: words, mode: E.mode, retryOnly: false });
    return { ok: true, count: words.length };
  }

  function applySettings() {
    var conf = settings();
    /* ENG-03: the student's saved default hint toggles used to be ignored. */
    if (isObj(conf.hints)) {
      E.hints = {
        pos: conf.hints.pos !== false && conf.hints.pos !== undefined ? !!conf.hints.pos : false,
        first: !!conf.hints.first,
        si: !!conf.hints.si,
        sentence: !!conf.hints.sentence
      };
    }
    E.writeSecs = Math.max(3, Number(conf.writeSecs) || 8);
    E.repeats = Math.min(5, Math.max(1, Number(conf.repeats) || 3));
    E.pauseSecs = Number(conf.pauseSecs) || 1.5;
    E.autoAdvance = conf.autoAdvance !== false;
    E.mode = conf.mode === 'typing' ? 'typing' : 'paper';
  }

  function start(opts) {
    opts = opts || {};
    applySettings();
    if (opts.mode) E.mode = opts.mode === 'typing' ? 'typing' : 'paper';
    if (opts.writeSecs) E.writeSecs = Math.max(3, Number(opts.writeSecs));
    var words = opts.words && opts.words.length ? opts.words : (SDP.Sync && SDP.Sync.words ? SDP.Sync.words() : []);
    E.sessionNo = SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8';
    E.items = [];
    var i;
    /* D-E4: keep the word's position in the live session so a retry run can
       show "Session 8 #12" instead of renumbering 1..N and losing the place. */
    var sessionWords = SDP.Sync && SDP.Sync.words ? SDP.Sync.words() : [];
    var sessionIndexOf = {};
    for (i = 0; i < sessionWords.length; i++) {
      var key = str(sessionWords[i] && sessionWords[i].w).toLowerCase();
      if (key && sessionIndexOf[key] === undefined) sessionIndexOf[key] = i;
    }
    for (i = 0; i < words.length; i++) {
      var word = words[i] || {};
      var wkey = str(word.w).toLowerCase();
      var origIndex = (word.i && !opts.retryOnly) ? (Number(word.i) - 1) : sessionIndexOf[wkey];
      if (origIndex === undefined) origIndex = i;
      E.items.push({ i: i + 1, w: str(word.w), typed: '', correct: null, marked: null, word: word, origIndex: origIndex });
    }
    if (opts.answers && typeof opts.answers === 'object') {
      /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R8 — sdp.session resume */
      for (i = 0; i < E.items.length; i++) {
        var saved = opts.answers[E.items[i].w];
        if (!saved) continue;
        E.items[i].typed = str(saved.typed);
        E.items[i].marked = saved.marked === 'missed' ? 'missed' : (saved.marked === 'correct' ? 'correct' : null);
      }
    }
    E.retryOnly = !!opts.retryOnly;
    E.index = Math.min(Math.max(0, Number(opts.startIndex) || 0), Math.max(0, E.items.length - 1));
    E.finished = false;
    E.startedAt = now();
    refreshEls();
    showResults(false);
    setMode(E.mode, !!opts.silentMode);
    updateMeta();
    if (!E.items.length) {
      E.phase = 'idle';
      setText(el('beatStateText'), t('noWords', 'No words loaded yet'));
      return null;
    }
    enterWord(E.index);
    return buildModel();
  }

  function stop() {
    stopTicker();
    E.epoch += 1;
    E.phase = 'idle';
    E.finished = false;
    try { if (SDP.Speech) SDP.Speech.stop(); } catch (e) {}
    return state();
  }

  function bind() {
    refreshEls();
    var map = [
      ['btnPrev', goPrev],
      ['btnPlayPause', togglePlayPause],
      ['btnNext', goNext],
      ['btnRepeat', repeatWord],
      ['btnHint', cycleHint],
      ['btnModeSwitch', toggleMode],
      ['btnFinish', finish],
      ['btnMarkAll', markAll],
      ['btnToggleMissed', toggleMissed],
      ['btnRetryMissed', retryMissedOnly],
      ['btnNewSession', startNewSession]
    ];
    for (var i = 0; i < map.length; i++) {
      (function (id, fn) {
        var node = byId(id);
        if (!node || node._sdpBound) return;
        node._sdpBound = true;
        node.addEventListener('click', function (ev) {
          if (ev && ev.preventDefault) ev.preventDefault();
          try { fn(); } catch (e) {}
        });
      })(map[i][0], map[i][1]);
    }
    var host = byId('hintChips');
    if (host && !host._sdpBound) {
      host._sdpBound = true;
      host.addEventListener('click', function (ev) {
        var target = ev && ev.target;
        while (target && target !== host && !(target.getAttribute && target.getAttribute('data-hint'))) target = target.parentNode;
        if (target && target !== host && target.getAttribute) toggleHint(target.getAttribute('data-hint'));
      });
    }
    var table = byId('resultsTable');
    if (table && !table._sdpBound) {
      table._sdpBound = true;
      table.addEventListener('click', function (ev) {
        var target = ev && ev.target;
        while (target && target !== table && !(target.getAttribute && target.getAttribute('data-row-index'))) target = target.parentNode;
        if (!target || target === table || !target.getAttribute) return;
        var idx = Number(target.getAttribute('data-row-index'));
        mark(idx, target.getAttribute('data-mark'));
      });
    }
    return true;
  }

  var Engine = {
    start: start,
    stop: stop,
    bind: bind,
    state: state,
    items: items,
    current: current,
    model: buildModel,
    score: scored,
    mark: mark,
    markAll: markAll,
    toggleMissed: toggleMissed,
    retryMissedOnly: retryMissedOnly,
    startNewSession: startNewSession,
    missedWords: missedWords,
    finish: finish,
    pause: pause,
    resume: resume,
    togglePlayPause: togglePlayPause,
    next: goNext,
    prev: goPrev,
    jumpTo: jumpTo,
    repeat: repeatWord,
    toggleHint: toggleHint,
    cycleHint: cycleHint,
    setMode: setMode,
    submitTyped: submitTyped,
    toggleMode: toggleMode,
    applySettings: applySettings,
    renderResults: renderResults,
    renderHints: renderHints,
    saveDraft: saveDraft,
    refreshEls: refreshEls,
    stateText: function () { var n = byId('beatStateText'); return n ? n.textContent : ''; },
    repaintState: function () { setStateText(); return true; },
    ringColor: ringColor,
    config: function () {
      return { writeSecs: E.writeSecs, repeats: E.repeats, pauseSecs: E.pauseSecs, autoAdvance: E.autoAdvance, mode: E.mode, index: E.index, phase: E.phase };
    }
  };

  SDP.Engine = Engine;
})(typeof window !== 'undefined' ? window : this);
