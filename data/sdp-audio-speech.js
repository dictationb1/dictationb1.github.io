/*! Smart Dictation Player — speech & audio pipeline (v0.0.6.m)
 * Strict ES5, dependency free.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 audio priority chain
 * Dictionary audio always plays through a plain <audio> element; element audio
 * is never routed through Web Audio, which is what used to silence Youdao MP3s
 * on cross-origin responses. */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;

  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function nowMs() { return Date.now(); }

  function settings() {
    try { return SDP.Data ? SDP.Data.settings() : { rate: 0.95, volume: 1, repeats: 3, pauseSecs: 1.5, voiceSource: 'auto' }; }
    catch (e) { return { rate: 0.95, volume: 1, repeats: 3, pauseSecs: 1.5, voiceSource: 'auto' }; }
  }
  function sync() { return SDP.Sync || null; }

  /* v0.0.6.o ZERO CUT-OFF LAW: the text pin for a briefing clip. The studio
     stamps each clip with 'sha1:<hex>' over text|voiceId|modelId; the speech
     layer recomputes the same pin so a clip recorded for an OLD sentence
     (different ending, different duration) is refused before it can ever
     clip the final words of the current paragraph. Pure ES5, byte-for-byte
     the SAME algorithm as studio.js sha1Hex()/clipContentHash() so both
     sides always agree on the pin. */
  function utf8BytesOf(text) {
    var out = [], s = str(text), i, c, c2, cp;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) { out.push(c); continue; }
      if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); continue; }
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
        c2 = s.charCodeAt(i + 1);
        if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
          i += 1;
          cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
          out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
          continue;
        }
      }
      out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
    return out;
  }
  function hex8Of(n) {
    var v = (n >>> 0).toString(16);
    while (v.length < 8) v = '0' + v;
    return v;
  }
  function sha1HexOf(text) {
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function ad(x, y) { var l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); }
    var bytes = utf8BytesOf(text);
    var len = bytes.length, i, j, x;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(len / 536870912);
    var lo = (len * 8) >>> 0;
    bytes.push((hi >>> 24) & 0xFF, (hi >>> 16) & 0xFF, (hi >>> 8) & 0xFF, hi & 0xFF);
    bytes.push((lo >>> 24) & 0xFF, (lo >>> 16) & 0xFF, (lo >>> 8) & 0xFF, lo & 0xFF);
    var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    var w = [], a, b, c, d, e, f, k, tmp;
    for (i = 0; i < bytes.length; i += 64) {
      for (j = 0; j < 16; j++) {
        w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) |
          (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
      }
      for (j = 16; j < 80; j++) {
        x = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
        w[j] = (x << 1) | (x >>> 31);
      }
      a = h0; b = h1; c = h2; d = h3; e = h4;
      for (j = 0; j < 80; j++) {
        if (j < 20) { f = (b & c) | ((~b) & d); k = 0x5A827999; }
        else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        tmp = ad(ad(rl(a, 5), ad(ad(f, e), k)), w[j]);
        e = d; d = c; c = rl(b, 30); b = a; a = tmp;
      }
      h0 = ad(h0, a); h1 = ad(h1, b); h2 = ad(h2, c); h3 = ad(h3, d); h4 = ad(h4, e);
    }
    return hex8Of(h0) + hex8Of(h1) + hex8Of(h2) + hex8Of(h3) + hex8Of(h4);
  }
  function clipTextHash(text, voiceId, modelId) {
    try {
      return 'sha1:' + sha1HexOf(str(text) + '|' + str(voiceId || '') + '|' + str(modelId || ''));
    } catch (e) { return ''; }
  }

  /* ══ utterance text normaliser ═════════════════════════════════════════ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 — say() normalises first */
  function normalizeInput(input) {
    return Array.isArray(input) ? input.slice() : [String(input == null ? '' : input)];
  }

  var state = {
    manifest: null,
    manifestRequested: false,
    /* D15/R9: paid clips are mirrored here because a manifest load already in
       flight when they were paid for replaces state.manifest wholesale. */
    injectedClips: {},
    /* v0.0.6.q PILLAR 1 — the ZERO-DROP clip base: the union of every clip
       key ever adopted (newest entry wins per key). applyManifest() merges
       each freshly parsed pack INTO this base, so a reload that arrives
       empty, partial or stale on weak mobile data can never make the 131
       committed Alice clips (or the 4 George briefing beats) vanish from
       the in-memory voice pack mid-session. */
    clipBase: {},
    manifestRetryBound: false,
    lastTier: '',
    lastUtterances: [],
    speaking: false,
    queueId: 0,
    speechEpoch: 0,
    audioEl: null,
    /* D11: the REAL onstart flag. It is set only inside utter.onstart — never
       by the synchronous state.speaking bookkeeping — so the watchdogs can
       tell a genuinely speaking engine from a silently dropped utterance. */
    utterStarted: false,
    audioPlaying: false,
    /* VOX-01: the live utterance and queue live at MODULE scope. v0.0.1.c kept
       `var utter` inside next(), so Chrome's GC could collect the utterance
       mid-sentence and onend never fired — the queue froze for 30+ seconds. */
    activeUtter: null,
    activeQueue: null,
    activeIndex: 0,
    /* v0.0.6.o ZERO CUT-OFF LAW: EVERY live utterance is pinned in this
       module-scope array until its onend fires. Chrome's GC can collect a
       speak()ing utterance whose only reference was a single variable —
       onend then never fires and the guard timer clips the final 2-3 words
       of the sentence. An array holds every one, and it is emptied only from
       onend/onerror, so the British-male briefing persona survives garbage
       collection through the last word of each paragraph. */
    activeUtterances: [],
    /* VOX-06: every concurrent selectProfessorVoice() caller waits here. */
    voiceWaiters: [],
    voiceResolved: false,
    /* VOX-03: the 10 s speechSynthesis.resume() keepalive. */
    keepAlive: null,
    /* VOX-09: Chrome drops a speak() issued in the same tick as cancel(). */
    lastCancelAt: 0,
    /* R1 (F1): every live timer is named so stopAll() can kill it. A timer
       that outlives a pause is exactly how "Afraid." spoke after Stop. */
    wordWatchTimer: null,
    guardTimer: null,
    urlTimer: null,
    /* R6 (F9): the persona is pinned once per Engine.start(), never swapped
       mid-session when Android re-announces voiceschanged. */
    sessionVoice: null,
    voiceDirty: false
  };

  /* D10/D12: one honest read of the platform voice list. Brave desktop and
     locked-down kiosks expose zero voices; every watchdog keys off this. */
  function getVoicesSafe() {
    try {
      var synth = global.speechSynthesis;
      if (!synth || typeof synth.getVoices !== 'function') return [];
      return synth.getVoices() || [];
    } catch (e) { return []; }
  }

  /* ── shared <audio> element: same element, many sources, clean replay ── */
  function sharedAudio() {
    if (state.audioEl) return state.audioEl;
    var el = doc && doc.getElementById ? doc.getElementById('sdpSharedAudio') : null;
    if (!el && doc && doc.createElement) {
      el = doc.createElement('audio');
      el.id = 'sdpSharedAudio';
      el.preload = 'auto';
      el.setAttribute('playsinline', 'playsinline');
      /* E1: never set crossOrigin on <audio>. dict.youdao.com sends no
         Access-Control-Allow-Origin, so crossorigin='anonymous' blocked
         every one of the 30 dictionary clips. Plain element audio only. */
      if (doc.body) doc.body.appendChild(el);
    }
    state.audioEl = el;
    return el;
  }

  function stopKeepAlive() {
    if (state.keepAlive) {
      try { global.clearInterval(state.keepAlive); } catch (e) {}
      state.keepAlive = null;
    }
    return false;
  }
  /* VOX-03: desktop Chrome pauses speechSynthesis after ~15 s of continuous
     narration; a 10 s resume() tick keeps a long guide or session audible. */
  function startKeepAlive() {
    if (state.keepAlive) return true;
    state.keepAlive = global.setInterval(function () {
      try {
        var synth = global.speechSynthesis;
        if (!synth) { stopKeepAlive(); return; }
        if (synth.speaking || state.activeUtter) synth.resume();
        else if (!state.speaking) stopKeepAlive();
      } catch (e) { stopKeepAlive(); }
    }, 10000);
    return true;
  }
  /* E5: every async chain gets an epoch. stopAll() bumps it so any in-flight
   * timer, watchdog, onend or <audio> handler from a dead chain is ignored.
   * Hard screen guard: no speech or <audio> act while a screen is covered
   * (document hidden, the guide modal open, or the lecturer lock gate up).
   */
  /* E5 hard screen guard — no speech or <audio> acts while the page is
     hidden or the lecturer lock gate covers the cockpit. The guide modal is
     not a cover: guide narration happens inside it. */
  function screenIsCovered() {
    try { if (doc && doc.hidden === true) return true; } catch (e) { return true; }
    var g = doc && doc.getElementById ? doc.getElementById('studioGate') : null;
    var studioScreen = doc && doc.getElementById ? doc.getElementById('screen-studio') : null;
    if (g && !g.hidden && studioScreen && studioScreen.classList && studioScreen.classList.contains('active')) return true;
    return false;
  }
  function stopAll() {
    state.queueId += 1;
    state.speechEpoch += 1;
    state.speaking = false;
    state.utterStarted = false;
    state.activeUtter = null;
    state.activeQueue = null;
    state.activeIndex = 0;
    state.audioPlaying = false;
    state.lastCancelAt = nowMs();
    /* R1 Path C: every named timer dies with the queue. A watchdog that fires
       after Stop is a second voice the student never asked for. */
    var names = ['wordWatchTimer', 'guardTimer', 'urlTimer'];
    for (var t = 0; t < names.length; t++) {
      if (state[names[t]]) {
        try { global.clearTimeout(state[names[t]]); } catch (e) {}
        state[names[t]] = null;
      }
    }
    stopKeepAlive();
    try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) {}
    var el = state.audioEl || (doc && doc.getElementById ? doc.getElementById('sdpSharedAudio') : null);
    if (el) {
      /* R1 Path C: an <audio> handler that survives Stop can re-enter the
         ladder and speak the next word into a paused cockpit. */
      el.onended = null;
      el.onerror = null;
      try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {}
    }
  }

  /* ── E2: deterministic Professor Voice scoring (Table D) ──────────────── */
  /* Tier 1 (+100): en-GB + Google UK English Female / Microsoft Sonia, Libby,
   * Maisie / Apple Serena, Kate, Martha / Alice.
   * Tier 2 (+60): en-GB/en-AU/en-NZ + female token in name or voiceURI.
   * Tier 3 (+30): any en-* + female token.
   * Tie-breaker: localService === false first, then lowest array index.
   * A voice with score <= 0 is never chosen while a scored voice exists.
   */
  /* D-V3: a male voice must never win, even as the last-resort fallback
   * (Windows/Android expose "Microsoft David" as the default en-US voice).
   * -100 is a hard veto: pickBestVoice() can only return it when no other
   * voice exists at all, and resolveOnce() rejects any score <= 0. */
  var MALE_VOICE_RE = /\b(david|mark|george|daniel|fred|james|richard|oliver|thomas|male|man|guy)\b/i;
  function scoreVoice(v) {
    if (!v || !v.lang) return -1;
    var name = str(v.name || '').toLowerCase();
    var lang = str(v.lang).toLowerCase().replace(/_/g, '-');
    var uri = str(v.voiceURI || '').toLowerCase();
    var hay = name + ' ' + uri;
    if (MALE_VOICE_RE.test(hay)) return -100;
    var score = -1;
    if (lang.indexOf('en-gb') === 0 && /google uk english female|microsoft sonia|microsoft libby|microsoft maisie|apple serena|apple kate|apple martha|\balice\b/i.test(hay)) score = 100;
    else if ((lang.indexOf('en-gb') === 0 || lang.indexOf('en-au') === 0 || lang.indexOf('en-nz') === 0) && /female|woman|sonia|libby|maisie|serena|kate|martha|ava|amelia|hazel|susan|catherine|karen/i.test(hay)) score = 60;
    else if (lang.indexOf('en') === 0 && /female|woman|samantha|victoria|zira|aria|jenny|allison|susan|karen|serena|alice/i.test(hay)) score = 30;
    if (score > 0 && v.localService === false) score += 5;
    return score;
  }
  function pickBestVoice(voices) {
    var best = null, bestScore = -1, i, v, s;
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      if (!v || !v.lang) continue;
      s = scoreVoice(v);
      if (s > bestScore) { best = v; bestScore = s; }
      else if (s === bestScore && s > 0 && best && v.localService === false && best.localService !== false) { best = v; }
    }
    return { voice: best, score: bestScore };
  }
  function resolveOnce(voices, synth, cb) {
    var picked = pickBestVoice(voices);
    cb(picked.score > 0 ? picked.voice : null);
  }
  /* E2: never blindly lock in male voices[0]. On an empty list (common on
   * Android Chrome) listen once to onvoiceschanged, with a 400 ms fallback
   * timer so headless/mock browsers can never hang. */
  function flushVoiceWaiters(voice) {
    var list = state.voiceWaiters;
    state.voiceWaiters = [];
    state.voiceResolved = true;
    for (var i = 0; i < list.length; i++) {
      try { list[i](voice); } catch (e) {}
    }
    return list.length;
  }
  function selectProfessorVoice(cb) {
    cb = cb || noop;
    var synth = global.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') { cb(null); return; }
    var voices = [];
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
    if (voices.length > 0) { resolveOnce(voices, synth, cb); return; }
    /* VOX-06: v0.0.1.c answered every concurrent caller with cb(null), so a
       second voice test spoke in the default male voice. They all queue now
       and all receive the resolved professor. */
    state.voiceWaiters.push(cb);
    if (selectProfessorVoice._waiting) return;
    selectProfessorVoice._waiting = true;
    var fired = false;
    function finish(list) {
      selectProfessorVoice._waiting = false;
      resolveOnce(list || [], synth, function (voice) { flushVoiceWaiters(voice); });
    }
    function onVoicesChanged() {
      if (fired) return;
      fired = true;
      try { synth.removeEventListener('voiceschanged', onVoicesChanged); } catch (e) {}
      var v2 = [];
      try { v2 = synth.getVoices() || []; } catch (e) {}
      finish(v2);
    }
    try { synth.addEventListener('voiceschanged', onVoicesChanged, false); } catch (e) {}
    global.setTimeout(function () {
      if (fired) return;
      fired = true;
      try { synth.removeEventListener('voiceschanged', onVoicesChanged); } catch (e) {}
      var v3 = [];
      try { v3 = synth.getVoices() || []; } catch (e) {}
      finish(v3);
    }, 400);
  }

  /* ══ D-V1 / D-V2: the cached British Female Professor voice ════════════
   * v0.0.1.b crashed with `ReferenceError: pickVoice is not defined` on the
   * very first utterance, which killed every spoken word, the whole guide and
   * the voice test. The resolver below is the single source of truth: it
   * returns the cached voice, or kicks off selectProfessorVoice() once and
   * returns null while that promise resolves (say() then falls back to
   * lang = 'en-GB', which still steers the platform to a British voice). */
  var cachedProfVoice = null;

  function pickVoice(lang) { /* lang kept for signature stability */
    if (cachedProfVoice) return cachedProfVoice;
    selectProfessorVoice(function (v) { if (v) cachedProfVoice = v; });
    return cachedProfVoice;
  }
  /* Warm the cache now, again on voiceschanged, and again on the student's
   * first real gesture (D-V6: iOS/Android only expose voices after a tap). */
  function warmProfessorVoice(cb) {
    cb = cb || noop;
    if (cachedProfVoice) { cb(cachedProfVoice); return cachedProfVoice; }
    selectProfessorVoice(function (v) {
      if (v) cachedProfVoice = v;
      cb(cachedProfVoice);
    });
    return cachedProfVoice;
  }
  function voiceName() {
    return cachedProfVoice ? str(cachedProfVoice.name) : '';
  }

  /* ══ v0.0.6.m Pillar 1: the British Male narrator — NEVER a female voice ══
   * The Project Briefing speaks with a warm, mature male persona. Why the
   * phone played a girl's voice before: on Android/iOS Chrome,
   * speechSynthesis.getVoices() lists female voices first or labels them
   * generically ("English (United Kingdom)"), and the old picker fell back
   * to that default whenever the _intro_male_N clips were absent. This
   * picker now hard-rejects every known female name AND generic unisex
   * defaults, prioritises deep British male voices (Daniel, Arthur, Oliver,
   * George, Ryan, Thomas, Malcolm), and say() pins pitch 0.82 / rate 0.98
   * for the male persona so device synthesis never sounds shrill or female. */
  var MALE_BRIT_RE = /\b(daniel|oliver|ryan|george|harry|arthur|david|mark|james|thomas|richard|fred|guy|malcolm|alex|aaron|male|man)\b/i;
  var FEMALE_BRIT_RE = /\b(female|woman|girl|sonia|libby|maisie|serena|kate|martha|ava|amelia|hazel|susan|catherine|karen|alice|victoria|zira|samantha|moira|tessa|fiona|aria|jenny|allison|nicky|female_1)\b/i;
  function scoreMaleVoice(v) {
    if (!v || !v.lang) return -1;
    var name = str(v.name || '').toLowerCase();
    var lang = str(v.lang).toLowerCase().replace(/_/g, '-');
    var uri = str(v.voiceURI || '').toLowerCase();
    var hay = name + ' ' + uri;
    if (FEMALE_BRIT_RE.test(hay)) return -100;
    /* v0.0.6.m: "Google UK English Female" and friends are caught above; a
       GENERIC default ("English (United Kingdom)", no male marker) is also
       rejected so the fallback never lands on a random (often female)
       system voice. Only an explicitly male-named or male-flagged voice
       scores. */
    var score = -1;
    if (lang.indexOf('en-gb') === 0 && /google uk english male|microsoft ryan|microsoft george|microsoft thomas|daniel|oliver|ryan|george|arthur|harry|malcolm/i.test(hay)) score = 100;
    else if (lang.indexOf('en-gb') === 0 && MALE_BRIT_RE.test(hay)) score = 70;
    else if (lang.indexOf('en') === 0 && /male/i.test(hay)) score = 55;
    else if (lang.indexOf('en') === 0 && MALE_BRIT_RE.test(hay)) score = 40;
    if (score > 0 && v.localService === false) score += 5;
    return score;
  }
  var cachedMaleVoice = null;
  function selectMaleVoice(cb) {
    cb = cb || noop;
    var synth = global.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') { cb(null); return; }
    var voices = [];
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
    var best = null, bestScore = -1, i, s;
    for (i = 0; i < voices.length; i++) {
      s = scoreMaleVoice(voices[i]);
      if (s > bestScore) { best = voices[i]; bestScore = s; }
    }
    cb(bestScore > 0 ? best : null);
  }
  function pickMaleVoice() {
    if (cachedMaleVoice) return cachedMaleVoice;
    selectMaleVoice(function (v) { if (v) cachedMaleVoice = v; });
    return cachedMaleVoice;
  }
  function maleVoiceName() {
    return cachedMaleVoice ? str(cachedMaleVoice.name) : '';
  }

  /* First-gesture unlock shared by every player surface (D-V6, R3). */
  var unlocked = false;
  function unlockAudio() {
    unlocked = true;
    /* v0.0.5.c Path B: a first gesture only unlocks playback. Calling
       speechSynthesis.resume() here re-queued the previous utterance, which is
       exactly the stale voice students heard on a cold boot. */
    var el = sharedAudio();
    if (el) { try { el.load(); } catch (e) {} }
    if (!cachedProfVoice) warmProfessorVoice(noop);
    return true;
  }
  function isUnlocked() { return !!unlocked; }

  function bindFirstGesture() {
    if (!doc || !doc.addEventListener || bindFirstGesture._bound) return false;
    bindFirstGesture._bound = true;
    var onGesture = function () {
      try { doc.removeEventListener('pointerup', onGesture, false); } catch (e) {}
      try { doc.removeEventListener('click', onGesture, false); } catch (e) {}
      try { doc.removeEventListener('touchstart', onGesture, false); } catch (e) {}
      unlockAudio();
    };
    doc.addEventListener('pointerup', onGesture, false);
    doc.addEventListener('click', onGesture, false);
    doc.addEventListener('touchstart', onGesture, false);
    return true;
  }

  /* VOX-02: a slow, deliberate 0.92-rate professor needs ~85 ms per character;
     the old 62 ms estimate cut long lines off mid-word on real devices.
     D12: on a voiceless engine (getVoices() is empty) the estimate is capped
     at 1200 ms so a headless or offline browser never stalls ~40 s waiting
     for an onend that will never fire — the queue falls through to the
     <audio> tiers immediately instead. */
  function estimateMs(text, rate) {
    if (getVoicesSafe().length === 0) return 1200;
    var perChar = Number(rate) < 1 ? 85 : 65;
    return Math.max(2600, Math.round(str(text).length * perChar) + 2400);
  }

  /* ══ SDP.Speech.say — one utterance per array entry, never per character ══ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 say() normaliser */
  /* v0.0.6.o ZERO CUT-OFF LAW: the GC-pinning array. Every live utterance
     stays reachable from module scope until onend/onerror fires, so Chrome
     can never collect it mid-sentence (the v0.0.6.n bug that clipped the
     last 2-3 words of long briefing paragraphs). Bounded at 8: a stale
     entry (a swallowed onend on a cancelled queue) is released by shift. */
  function pinUtterance(u) {
    if (!u) return;
    if (!state.activeUtterances) state.activeUtterances = [];
    for (var i = 0; i < state.activeUtterances.length; i++) {
      if (state.activeUtterances[i] === u) return;
    }
    state.activeUtterances.push(u);
    if (state.activeUtterances.length > 8) state.activeUtterances.shift();
  }
  function unpinUtterance(u) {
    if (!u || !state.activeUtterances || !state.activeUtterances.length) return;
    var out = [];
    for (var i = 0; i < state.activeUtterances.length; i++) {
      if (state.activeUtterances[i] !== u) out.push(state.activeUtterances[i]);
    }
    state.activeUtterances = out;
  }
  function say(input, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = opts || {};
    cb = cb || noop;
    var list = normalizeInput(input);
    var queue = [];
    var i;
    for (i = 0; i < list.length; i++) {
      var line = str(list[i]);
      if (line === '') continue;
      queue.push(line);
    }
    state.lastUtterances = state.lastUtterances || [];
    for (i = 0; i < queue.length; i++) {
      /* R2 (F2): the audit trail of what was actually spoken. The pause cue
         assertion in G7 reads this, and the cap keeps it bounded. */
      if (state.lastUtterances[state.lastUtterances.length - 1] !== queue[i]) {
        state.lastUtterances.push(queue[i]);
        if (state.lastUtterances.length > 25) state.lastUtterances.shift();
      }
    }
    if (!queue.length) { cb(null); return; }
    stopAll();
    var myId = ++state.queueId;
    var myEpoch = state.speechEpoch;
    var conf = settings();
    /* D-V4: voiceLock 'unified' is the shipped default and owns the whole
     * utterance, not just voiceSource === 'auto'. Every line then leaves with
     * the same British Female Professor persona:
     *   lang 'en-GB' · rate 0.92 (or the caller's explicit rate) · pitch 1.03.
     * 'custom' keeps the per-tier behaviour. */
    var locked = str(conf.voiceLock || 'unified') === 'unified';
    /* v0.0.6.m: persona 'male' reserves the utterance for the Project
       Briefing narrator — a deep, warm British male voice pinned to pitch
       0.82 / rate 0.98 so device synthesis never sounds shrill, juvenile
       or female. */
    var wantMale = opts.persona === 'male';
    var rate = wantMale ? 0.98 : Math.min(1.2, Math.max(0.7, Number(opts.rate || (locked ? 0.92 : conf.rate)) || 0.95));
    var pitch = wantMale ? 0.82 : (locked ? 1.03 : Number(opts.pitch || 1));
    var utterLang = locked ? 'en-GB' : str(opts.lang || 'en-GB');
    var volume = Math.min(1, Math.max(0, opts.volume === undefined ? (isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) : Number(opts.volume)));
    var synth = global.speechSynthesis;
    var Utter = global.SpeechSynthesisUtterance;
    var at = 0;

    function next() {
      if (myId !== state.queueId || state.speechEpoch !== myEpoch) return;
      /* E5 hard screen guard: a covered screen aborts the queue cleanly so
         no utterance lands while the student cannot see the cockpit. */
      if (screenIsCovered()) {
        state.speaking = false;
        state.activeUtter = null;
        state.activeQueue = null;
        state.activeIndex = 0;
        stopKeepAlive();
        if (guard) global.clearTimeout(guard);
        if (wordWatch) global.clearTimeout(wordWatch);
        cb(null);
        return;
      }
      if (at >= queue.length) {
        state.speaking = false;
        state.activeUtter = null;
        state.activeQueue = null;
        state.activeIndex = 0;
        stopKeepAlive();
        cb(null);
        return;
      }
      var line = queue[at];
      at += 1;
      if (synth && Utter) {
        var utter = new Utter(line);
        utter.lang = utterLang;
        utter.rate = rate;
        utter.volume = volume;
        utter.pitch = pitch;
        /* D-V1/D-V2: cached professor voice, always female, always en-GB —
           unless the caller reserved the young British male narrator. */
        var voice = wantMale ? pickMaleVoice() : pickVoice(utterLang);
        if (voice) utter.voice = voice;
        var advanced = false;
        var guardExtended = false;
        var guardMs = estimateMs(line, rate);
        var guard = null;
        var wordWatch = null;
        /* D10: the ONLY writer of the real-onstart flag. */
        utter.onstart = function () { state.utterStarted = true; };
        /* v0.0.6.m: onboundary(charIndex) drives the briefing karaoke on the
           Web Speech tier — the words glide with the real spoken voice. */
        if (typeof opts.onBoundary === 'function') {
          utter.onboundary = function (ev) {
            try { opts.onBoundary(ev && typeof ev.charIndex === 'number' ? ev.charIndex : 0); } catch (e1) {}
          };
        }
        var armGuard = function (ms) {
          guard = global.setTimeout(function () {
            if (state.guardTimer === guard) state.guardTimer = null;
            if (advanced || myId !== state.queueId) return;
            /* VOX-02: onend is the primary driver. The guard only fires when a
               platform silently swallows onend, and it extends exactly once
               while the engine still reports speech in flight.
               v0.0.6.o ZERO CUT-OFF LAW: for the briefing persona (and any
               pinned utterance still in flight) the guard keeps re-arming
               while the engine genuinely reports speaking/pending — a long
               British-male paragraph is never clipped at its final words. */
            if (synth && (synth.speaking || synth.pending)) {
              if (state.activeUtterances && state.activeUtterances.length && !guardExtended) {
                guardExtended = true;
                armGuard(2200);
                return;
              }
              if (state.activeUtterances && state.activeUtterances.length) {
                armGuard(1800);
                return;
              }
              if (!guardExtended) {
                guardExtended = true;
                armGuard(1800);
                return;
              }
            }
            advanced = true;
            state.activeUtter = null;
            next();
          }, ms);
          state.guardTimer = guard;
        };
        /* D10/D12: the 800 ms real-onstart word watchdog. A voiceless engine,
           or one that silently drops the utterance (no onstart), is cancelled
           at once; opts.fallbackAudioUrl (the word's real human British
           recording) then plays through <audio> so a word is NEVER silent. */
        var armWordWatchdog = function () {
          wordWatch = global.setTimeout(function () {
            wordWatch = null;
            if (state.wordWatchTimer === wordWatch) state.wordWatchTimer = null;
            if (advanced || myId !== state.queueId) return;
            if (state.utterStarted) return;
            try { if (synth && synth.cancel) synth.cancel(); } catch (e) {}
            if (guard) global.clearTimeout(guard);
            advanced = true;
            state.activeUtter = null;
            var fallbackUrl = str(opts.fallbackAudioUrl);
            if (fallbackUrl) {
              playUrl(fallbackUrl, { rate: rate, volume: volume, timeoutMs: 9000 }, function () {
                if (myId !== state.queueId) return;
                next();
              });
              return;
            }
            next();
          }, 800);
          state.wordWatchTimer = wordWatch;
        };
        utter.onend = function () {
          if (advanced) return;
          advanced = true;
          global.clearTimeout(guard);
          if (state.guardTimer === guard) state.guardTimer = null;
          if (wordWatch) global.clearTimeout(wordWatch);
          if (state.wordWatchTimer === wordWatch) state.wordWatchTimer = null;
          /* VOX-01: release the module-scope reference only when done.
             v0.0.6.o: unpin from the GC-safe array too (bounded below). */
          if (state.activeUtter === utter) state.activeUtter = null;
          unpinUtterance(utter);
          next();
        };
        utter.onerror = function () {
          if (advanced) return;
          advanced = true;
          global.clearTimeout(guard);
          if (state.guardTimer === guard) state.guardTimer = null;
          if (wordWatch) global.clearTimeout(wordWatch);
          if (state.wordWatchTimer === wordWatch) state.wordWatchTimer = null;
          if (state.activeUtter === utter) state.activeUtter = null;
          unpinUtterance(utter);
          next();
        };
        /* VOX-01: keep the utterance (and its queue) reachable until it ends.
           v0.0.6.o: pin EVERY live utterance in the module-scope array — the
           single activeUtter reference was GC-fragile on long sentences. */
        state.activeUtter = utter;
        state.activeQueue = queue;
        state.activeIndex = at - 1;
        pinUtterance(utter);
        state.speaking = true;
        state.utterStarted = false;
        startKeepAlive();
        armGuard(guardMs);
        armWordWatchdog();
        /* VOX-09: Chrome drops a speak() issued in the same tick as cancel(). */
        var sinceCancel = nowMs() - (Number(state.lastCancelAt) || 0);
        if (sinceCancel >= 0 && sinceCancel < 200) {
          global.setTimeout(function () {
            /* R1 Path B (F1): a deferred speak() outliving a pause/cancel is
               the exact "Afraid." leak. Re-check the id, the epoch and the
               pause flag immediately before the engine is touched. */
            if (myId !== state.queueId || myEpoch !== state.speechEpoch) return;
            if (!opts || !opts.allowWhenPaused) {
              if (SDP.Engine && SDP.Engine.isPaused && SDP.Engine.isPaused()) return;
            }
            if (advanced) return;
            try { synth.speak(utter); } catch (e) { utter.onerror(); }
          }, 200);
        } else {
          try { synth.speak(utter); } catch (e) { utter.onerror(); }
        }
      } else {
        /* No speech engine (headless, tests, locked-down browsers): keep the
           rhythm with a bounded timer so callbacks always resolve. */
        state.speaking = true;
        global.setTimeout(next, estimateMs(line, rate));
      }
    }
    next();
  }

  /* ── audio element playback with a hard timeout ─────────────────────── */
  function playUrl(url, opts, cb) {
    opts = opts || {};
    cb = cb || noop;
    var pEpoch = state.speechEpoch;
    /* v0.0.6.e (B): an explicitly passed epoch that is already stale never
       opens the element — a rapid Pause/Play tap must resolve aborted at
       once instead of racing a dead clip down the tier ladder. */
    if (opts.epoch !== undefined && opts.epoch !== state.speechEpoch) {
      var staleErr = new Error('aborted');
      staleErr.aborted = true; staleErr.stale = true;
      cb(staleErr);
      return;
    }
    var el = sharedAudio();
    if (!el) { cb(new Error('no_audio_element')); return; }
    var srcUrl = playableUrl(url);
    /* v0.0.4.b BUG-4: an unconvertible data clip cannot play in a plain <audio>;
       hand over to the next tier at once instead of stalling for twelve seconds. */
    if (str(srcUrl).indexOf('data:audio/') === 0) { cb(new Error('audio_failed')); return; }
    /* E5 hard screen guard: a covered screen never plays <audio>. */
    if (screenIsCovered()) { finish(false); return; }
    var conf = settings();
    var volume = Math.min(1, Math.max(0, opts.volume === undefined ? (isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) : Number(opts.volume)));
    /* v0.0.6.w — the GAIN-LINEAR NORMALIZATION LAW: a clip measured at
       BS.1770-4 integrated loudness (requestClip) carries gainLinear =
       10^((-21 - lufs)/20) bounded 0.5..2.0. The element volume applies it
       (compressed into the 0..1 range so a boost never hard-clips): quiet
       takes are lifted toward the -21 LUFS classroom target, hot takes are
       trimmed, and every word lands at ONE unified perceived loudness. */
    try {
      var gainEntry = state.manifest && state.manifest.clips ? (state.manifest.clips[normKey(str(url)).replace(/^data:[^,]*,/, '')] || null) : null;
    } catch (eG0) { gainEntry = null; }
    var gl = Number(opts.gainLinear !== undefined ? opts.gainLinear : (gainEntry && gainEntry.gainLinear)) || 1;
    if (gl > 1) volume = Math.min(1, volume * (gl / 2));
    else if (gl > 0) volume = Math.min(1, volume * gl);
    var done = false;
    var timer = null;
    var stopTicks = null;
    function finish(ok) {
      if (done) return;
      done = true;
      state.audioPlaying = false;
      if (timer) { try { global.clearTimeout(timer); } catch (e) {} }
      if (stopTicks) { try { stopTicks(); } catch (e0) {} stopTicks = null; }
      if (state.urlTimer === timer) state.urlTimer = null;
      timer = null;
      /* R1 Path C + v0.0.5.c Path C: detach the handlers AND drop the finished
         MP3 buffer, so no stale clip stays attached to the shared element. */
      if (el) {
        el.onended = null;
        el.onerror = null;
        el.onloadedmetadata = null;
        el.onplaying = null;
        try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {}
      }
      if (state.speechEpoch !== pEpoch) {
        var ab = new Error('aborted');
        ab.aborted = true; ab.stale = true;
        cb(ab);
        return;
      }
      cb(ok ? null : new Error('audio_failed'));
    }
    try {
      el.pause();
      state.audioPlaying = true; /* D11: the views guide watchdog reads this */
      /* D-M1: a data:audio/mpeg manifest entry becomes a cached Blob URL. */
      el.src = srcUrl;
      el.volume = volume;
      try { el.playbackRate = Math.min(1.2, Math.max(0.7, Number(opts.rate || conf.rate) || 1)); } catch (e) {}
      el.onended = function () { finish(true); };
      el.onerror = function () { finish(false); };
      /* v0.0.6.m (Pillar 1): the briefing narration needs the clip's real
         duration (word-flow karaoke timing) and a positive "audio actually
         started" signal (the fresh-Chrome autoplay handshake). */
      var hooks = isObj(opts.hooks) ? opts.hooks : null;
      el.onloadedmetadata = function () {
        if (hooks && typeof hooks.onDuration === 'function' && isFinite(el.duration) && el.duration > 0) {
          try { hooks.onDuration(el.duration); } catch (e1) {}
        }
      };
      el.onplaying = function () {
        if (hooks && typeof hooks.onStarted === 'function') {
          try { hooks.onStarted(); } catch (e2) {}
        }
        /* v0.0.6.m: the clip is actually playing — start pumping the real
           clock (currentTime/duration) every frame for the karaoke flow. */
        if (stopTicks) { try { stopTicks(); } catch (e3) {} stopTicks = null; }
        stopTicks = pumpClockTicks(el, hooks);
      };
      var playing = el.play();
      if (playing && typeof playing.then === 'function') {
        playing.then(null, function (perr) {
          /* v0.0.6.e (B): a rapid re-tap aborts the in-flight play promise;
             resolve { aborted: true } so the ladder never drops to robotic
             browser TTS on a race the human cancelled on purpose. */
          if (perr && perr.name === 'AbortError') {
            if (!done) {
              done = true;
              state.audioPlaying = false;
              if (timer) { try { global.clearTimeout(timer); } catch (e0) {} }
              if (stopTicks) { try { stopTicks(); } catch (e5) {} stopTicks = null; }
              try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e1) {}
              var abp = new Error('aborted');
              abp.aborted = true; abp.stale = true;
              cb(abp);
            }
            return;
          }
          /* v0.0.6.m (Pillar 1): Chrome's autoplay policy on a brand-new
             session rejects play() with NotAllowedError — surface it so the
             briefing holds its beat behind the tap pill instead of falling
             to a robotic browser voice or skipping silently. */
          if (perr && perr.name === 'NotAllowedError') {
            if (!done) {
              done = true;
              state.audioPlaying = false;
              if (timer) { try { global.clearTimeout(timer); } catch (e3) {} }
              if (stopTicks) { try { stopTicks(); } catch (e6) {} stopTicks = null; }
              try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e4) {}
              if (state.speechEpoch !== pEpoch) {
                var abn = new Error('aborted');
                abn.aborted = true; abn.stale = true;
                cb(abn);
                return;
              }
              var na = new Error('autoplay_blocked');
              na.autoplayBlocked = true;
              cb(na);
            }
            return;
          }
          finish(false);
        });
      }
    } catch (e) { finish(false); return; }
    /* Bounded: a broken URL must hand over to the next tier quickly.
       v0.0.6.o ZERO CUT-OFF LAW: while the element is GENUINELY playing
       (!paused, !ended, currentTime > 0) the deadline keeps moving — the
       ONLY legitimate finish is the element's real 'ended' event, so the
       last words of a paragraph can never be clipped by a hard timeout. */
    var deadlineMs = Number(opts.timeoutMs) || 12000;
    timer = global.setTimeout(function deadline() {
      if (done) return;
      if (!el.paused && !el.ended && Number(el.currentTime) > 0) {
        /* Real playback in flight: re-arm +1500ms and keep re-arming while
           the element still speaks (a genuine 'ended' clears this timer). */
        timer = global.setTimeout(deadline, 1500);
        return;
      }
      finish(false);
    }, deadlineMs);
    state.urlTimer = timer;
  }

  /* v0.0.6.m: the frame-accurate playback clock. While the element plays,
     a requestAnimationFrame loop (30 ms interval fallback where rAF is not
     implemented — jsdom, kiosks) pumps hooks.onTick(el.currentTime,
     el.duration) every frame so the briefing karaoke repaints from the REAL
     voice clock (never a blind setTimeout ladder). The loop is cancelled
     from finish() so a tier switch or stop() can never leave it running. */
  function pumpClockTicks(el, hooks, stopFn) {
    if (!hooks || typeof hooks.onTick !== 'function' || !el) return null;
    var running = true;
    var raf = global.requestAnimationFrame
      ? function (fn) { return global.requestAnimationFrame(fn); }
      : function (fn) { return global.setTimeout(fn, 30); };
    var cancel = global.cancelAnimationFrame
      ? function (id) { global.cancelAnimationFrame(id); }
      : function (id) { global.clearTimeout(id); };
    var id = 0;
    function tick() {
      if (!running) return;
      try {
        if (hooks && typeof hooks.onTick === 'function') {
          hooks.onTick(el.currentTime || 0, isFinite(el.duration) ? el.duration : 0);
        }
      } catch (e) {}
      if (running) id = raf(tick);
    }
    id = raf(tick);
    return function () {
      if (!running) return;
      running = false;
      try { cancel(id); } catch (e) {}
    };
  }

  /* ── ElevenLabs manifest: cached clips only (student path, 0 credits) ── */
  /* D-M1: manifest entries may ship as `data:audio/mpeg;base64,...`. A service
   * worker cannot cache a data: URL, and re-decoding a 20 KB base64 string on
   * every repeat wastes the main thread. Decode once into a Blob URL and play
   * that instead (plain <audio> only — never Web Audio). */
  var blobUrls = {};
  var blobCount = 0;
  function playableUrl(url) {
    var u = str(url);
    if (u.indexOf('data:audio/') !== 0) return u;
    if (blobUrls[u]) return blobUrls[u];
    try {
      if (typeof global.Blob !== 'function' || !global.URL || typeof global.URL.createObjectURL !== 'function') return u;
      if (typeof global.atob !== 'function') return u;
      var comma = u.indexOf(',');
      if (comma < 0 || u.slice(0, comma).indexOf(';base64') < 0) return u;
      var bin = global.atob(u.slice(comma + 1));
      var bytes = new global.Uint8Array(bin.length);
      for (var b = 0; b < bin.length; b++) bytes[b] = bin.charCodeAt(b) & 0xff;
      var isWav = (u.indexOf('data:audio/wav') === 0);
      var blobUrl = global.URL.createObjectURL(new global.Blob([bytes], { type: isWav ? 'audio/wav' : 'audio/mpeg' }));
      /* Bounded memo: 40 clips is more than one class ever needs at once. */
      if (blobCount < 40) { blobUrls[u] = blobUrl; blobCount += 1; }
      return blobUrl;
    } catch (e) { return u; }
  }

  function normKey(k) { return str(k).trim().toLowerCase().replace(/[.,!?;:]+$/, ''); }
  function canBlobUrl() {
    return typeof global.Blob === 'function' && !!global.URL && typeof global.URL.createObjectURL === 'function';
  }
  /* v0.0.4.b: the shipped pack is b64-only. Hydrate data URLs in memory where
     Blob URLs are actually playable, and index both words.<w> and <w> keys. */
  function hydrateClips(map) {
    if (!isObj(map)) return map;
    var keys = [], k;
    for (k in map) if (Object.prototype.hasOwnProperty.call(map, k)) keys.push(k);
    for (var i = 0; i < keys.length; i++) {
      var srcKey = keys[i], v = map[srcKey];
      /* v0.0.6.t PILLAR 4D: ALWAYS recompute the in-memory data URL when the
         entry carries a b64 — a re-synthesized clip must never keep playing
         its previous audio through a stale v.url left from an older b64. */
      /* v0.0.6.w — the FORMAT-AUTO-DETECT LAW: a b64 payload may be a genuine
         MP3 (ElevenLabs ?output_format=mp3_44100_128 — the v0.0.6.w pure-MP3
         law) OR a legacy PCM WAV (the v0.0.6.v normalizer output). The RIFF
         magic prefix 'UklGR' (base64 of 'RIFF') selects audio/wav; every other
         payload is audio/mpeg — so both formats play cleanly on iOS Safari,
         Android Chrome and Desktop. */
      if (canBlobUrl() && v && isObj(v) && v.b64) {
        v.mime = (str(v.b64).indexOf('UklGR') === 0) ? 'audio/wav' : 'audio/mpeg';
        v.url = 'data:' + v.mime + ';base64,' + v.b64;
      }
      var n = normKey(srcKey);
      if (!n) continue;
      var bare = n.replace(/^words\./, '');
      if (n !== srcKey && !map[n]) map[n] = v;
      if (/^words\./.test(n)) {
        /* v0.0.6.t PILLAR 4D: a words.<w> entry ALWAYS refreshes its bare
           alias — the old !map[bare] guard kept the boot-populated clip
           alive after injectClips() delivered a re-synthesized word, so the
           Lecturer kept hearing the exact same mispronunciation. */
        if (bare) map[bare] = v;
        if (bare) map['words.' + bare] = v;
      } else {
        if (bare && !map[bare]) map[bare] = v;
        if (bare && !map['words.' + bare]) map['words.' + bare] = v;
      }
    }
    return map;
  }
  function applyManifest(data) {
    var next = data && isObj(data) ? data : { clips: {} };
    if (!isObj(next.clips)) next.clips = {};
    /* v0.0.6.q PILLAR 1 — the ZERO-DROP MERGE law: the previously adopted
       clips are merged UNDER the incoming pack (an incoming key wins, an old
       key is never dropped) before the manifest is swapped in. A weak-data
       reload that resolves empty or partial therefore leaves the live voice
       pack 100% intact — the 131 Alice clips and the 4 George beats can
       never disappear mid-session. */
    if (!isObj(state.clipBase)) state.clipBase = {};
    var base = state.clipBase, k;
    /* v0.0.7.a STALE-CLIP LAW: when the incoming pack advances wordsRev, the
       old base's words.* keys are NOT merged under it — a retired session's
       word clips can never resurrect after the active list moves on. System
       keys (num/cmd/guide/_intro_male) and same-rev weak reloads keep the
       v0.0.6.q zero-drop merge. */
    var wordsAdvance = Number(next.wordsRev || 0) > Number(state.manifestWordsRev || 0);
    for (k in base) {
      if (!Object.prototype.hasOwnProperty.call(base, k)) continue;
      if (wordsAdvance && /^words\./.test(k)) continue;
      if (!Object.prototype.hasOwnProperty.call(next.clips, k)) next.clips[k] = base[k];
    }
    for (k in next.clips) {
      if (Object.prototype.hasOwnProperty.call(next.clips, k)) base[k] = next.clips[k];
    }
    if (Number(next.wordsRev || 0)) state.manifestWordsRev = Number(next.wordsRev);
    state.manifest = next;
    hydrateClips(state.manifest.clips);
    reapplyInjectedClips();
    state.manifestSyncRev = Math.max(Number(state.manifestSyncRev || 0), Number(state.manifest.syncRev || 0));
    state.manifestRequested = false;
    return state.manifest;
  }
  /* Re-stamp injected (paid-for) clips onto the manifest the load just built;
     the newest paid take always wins, so a stale reload cannot revert it. */
  function reapplyInjectedClips() {
    var o = state.injectedClips, m = state.manifest, k, v, n = 0;
    if (!isObj(o) || !isObj(m)) return 0;
    if (!isObj(m.clips)) m.clips = {};
    for (k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      v = o[k];
      if (v === null || v === undefined || v === '') continue;
      m.clips[k] = v; n += 1;
    }
    if (n) hydrateClips(m.clips);
    return n;
  }
  /* D2 / R2: the manifest is read through SDP.Sync.fetchFreshDataJson, so a
     freshly published Alice pack is heard from raw.githubusercontent.com even
     while the Pages CDN still serves yesterday's clips. A same-origin-only
     read kept the old word pack alive for minutes after a publish.
     v0.0.6.q PILLAR 1: the BOOT read is cache-first (?v=<release>, no tick,
     cache:'default' — the SW answers in < 30 ms on 0-bar mobile data); only
     a FORCED reload (post-publish adoption chain, online retry) runs the
     fresh raw-vs-origin race, and even then the zero-drop merge law in
     applyManifest() keeps every committed clip live while it downloads. */
  function loadManifest(cb, force) {
    cb = cb || noop;
    if (state.manifest && !force) { cb(null, state.manifest); return; }
    if (state.manifestRequested && !force) { cb(null, null); return; }
    state.manifestRequested = true;
    var s = sync();
    if (s && s.fetchFreshDataJson) {
      try {
        s.fetchFreshDataJson('data/elevenlabs-audio.json', function (err, result) {
          if (err || !result || !result.json) {
            /* SYNC-10: a failed manifest never blocks a later retry. */
            state.manifestRequested = false;
            bindManifestRetry();
            cb(err || new Error('manifest_failed'));
            return;
          }
          var manifest = applyManifest(result.json);
          /* v0.0.6.r: the local briefing pack (a newer in-browser synthesis)
             merges on top of the loaded manifest before the callback. */
          restoreLocalBriefingPack(function () {
            manifest.manifestSource = str(result.source);
            cb(null, manifest);
          });
        }, { fresh: force === true });
        return;
      } catch (e) {
        state.manifestRequested = false;
        bindManifestRetry();
        cb(new Error('manifest_failed'));
        return;
      }
    }
    if (typeof global.fetch !== 'function') { state.manifestRequested = false; bindManifestRetry(); cb(new Error('no_fetch')); return; }
    try {
      /* v0.0.6.q low-mobile-data law: the boot fetch carries ONLY the release
         version — ?v=<APP_VERSION> — with cache:'default', so the Service
         Worker / HTTP cache serves the ~3 MB pack instantly and a weak 2G
         link is never asked to re-download it. A forced reload keeps the
         tick + no-store bust so a proven publish can never be masked by a
         stale cache. */
      var fresh = force === true;
      var url = './data/elevenlabs-audio.json?v=0.0.7.e' + (fresh ? '&t=' + nowMs() : '');
      global.fetch(url, { cache: fresh ? 'no-store' : 'default' })
        .then(function (res) { return res && res.ok ? res.json() : null; })
        .then(function (data) {
          var m = applyManifest(data);
          restoreLocalBriefingPack(function () { cb(null, m); });
        }, function () {
          state.manifestRequested = false;
          bindManifestRetry();
          cb(new Error('manifest_failed'));
        });
    } catch (e) { state.manifestRequested = false; bindManifestRetry(); cb(new Error('manifest_failed')); }
  }
  /* v0.0.6.r Pillar 1 — the LOCAL BRIEFING PACK RESTORE: after every boot
     manifest load, this browser's own sdp-audio-clips copy of the last
     synthesized briefing/guide pack ('./local-briefing-pack.json', written by
     Studio.primeLocalVoicePackCache) is merged ON TOP whenever its syncRev
     is >= the manifest's, so a reload — or the GitHub Pages CDN lag after a
     commit — can never revert the creator's generated / cloned voice back
     to the repository preload. */
  function restoreLocalBriefingPack(done) {
    done = typeof done === 'function' ? done : noop;
    try {
      if (!global.caches || !global.caches.open) { done(0); return; }
      global.caches.open('sdp-audio-clips').then(function (cache) {
        return cache.match('./local-briefing-pack.json');
      }).then(function (hit) {
        if (!hit || !hit.json) { done(0); return null; }
        return hit.json().then(function (localPack) {
          if (!isObj(localPack) || !isObj(localPack.clips)) { done(0); return; }
          var m = state.manifest;
          if (!isObj(m)) { done(0); return; }
          if (Number(localPack.syncRev || 0) < Number(m.syncRev || 0)) { done(0); return; }
          if (!isObj(m.clips)) m.clips = {};
          var n = 0, k;
          for (k in localPack.clips) {
            if (!Object.prototype.hasOwnProperty.call(localPack.clips, k)) continue;
            if (isObj(localPack.clips[k]) && str(localPack.clips[k].b64)) { m.clips[k] = localPack.clips[k]; n += 1; }
          }
          if (n) {
            if (Number(localPack.syncRev || 0) > Number(m.syncRev || 0)) m.syncRev = Number(localPack.syncRev);
            hydrateClips(m.clips);
            reapplyInjectedClips();
          }
          done(n);
        });
      }).catch(function () { done(0); });
    } catch (e) { done(0); }
  }
  /* D15 / R9: generated clips are injected into live memory the moment they
     are paid for, so the very next tap plays the Alice recording with 0 API
     calls — no reload, no second publish. */
  function injectClips(clipsMap) {
    if (!isObj(clipsMap)) return 0;
    if (!isObj(state.manifest)) state.manifest = { clips: {} };
    if (!isObj(state.manifest.clips)) state.manifest.clips = {};
    if (!isObj(state.injectedClips)) state.injectedClips = {};
    var added = 0, k;
    for (k in clipsMap) {
      if (!Object.prototype.hasOwnProperty.call(clipsMap, k)) continue;
      var entry = clipsMap[k];
      if (entry === null || entry === undefined || entry === '') continue;
      var nk = normKey(k);
      state.manifest.clips[nk] = entry;
      state.injectedClips[nk] = entry; /* D15/R9: survives later reloads */
      added += 1;
    }
    hydrateClips(state.manifest.clips);
    state.manifestSyncRev = Math.max(Number(state.manifestSyncRev || 0), Number(state.manifest.syncRev || 0));
    state.manifestRequested = false;
    return added;
  }
  /* The adoption chain calls this after every adopted publish. */
  function reloadManifest(cb, force) {
    if (typeof cb === 'boolean') { force = cb; cb = noop; }
    cb = cb || noop;
    /* v0.0.6.q PILLAR 1 — the ZERO-DROP RELOAD law: the previous manifest is
       NOT nulled while the fresh pack downloads. Every committed clip stays
       playable through the whole reload window; applyManifest() swaps the
       new pack in atomically only after it has fully downloaded and parsed. */
    state.manifestRequested = false;
    loadManifest(cb, force !== false);
    return true;
  }
  /* One-shot listeners: the next online / visible moment reloads the pack. */
  function bindManifestRetry() {
    if (state.manifestRetryBound) return false;
    state.manifestRetryBound = true;
    var retry = function () {
      if (state.manifestRequested) return;
      loadManifest(noop, true);
    };
    try { if (global.addEventListener) global.addEventListener('online', retry, false); } catch (e) {}
    try {
      if (doc && doc.addEventListener) {
        doc.addEventListener('visibilitychange', function () {
          if (!doc.visibilityState || doc.visibilityState === 'visible') retry();
        }, false);
      }
    } catch (e) {}
    return true;
  }

  function entryUrl(entry) {
    if (typeof entry === 'string') return entry;
    if (entry && isObj(entry)) {
      if (str(entry.url || entry.src || entry.file)) return str(entry.url || entry.src || entry.file);
      if (entry.b64 && canBlobUrl()) {
        var m = (str(entry.b64).indexOf('UklGR') === 0) ? 'audio/wav' : 'audio/mpeg';
        return 'data:' + m + ';base64,' + entry.b64;
      }
      return '';
    }
    return '';
  }
  /* R5: the 70-clip pack names every word clip 'words.<w>' and keeps the legacy
     bare '<w>' key readable, so an old published pack never goes silent. */
  function manifestClip(key) {
    var clips = state.manifest && isObj(state.manifest.clips) ? state.manifest.clips : null;
    if (!clips) return '';
    var k = normKey(str(key));
    if (!k) return '';
    return entryUrl(clips[k] || clips['words.' + k] || null);
  }
  function clipFromManifest(word) {
    var clips = state.manifest && isObj(state.manifest.clips) ? state.manifest.clips : null;
    if (!clips) {
      var s = sync();
      var ses = s && s.state ? s.state.clips : null;
      if (s && ses) {
        var key = str(word && word.w).toLowerCase();
        if (key && ses[key]) return entryUrl(ses[key]);
      }
      return '';
    }
    var k = normKey(str(word && word.w));
    return entryUrl(clips['words.' + k] || clips[k] || clips[str(word && word.i)] || null);
  }

  /* E3 / VOX-04 / D10: the bulletproof word ladder under voiceLock 'unified'.
   * 1 'lecturer'   committed lecturer clip
   * 2 'eleven'     cached ElevenLabs Alice clip (0 credits to replay)
   * 3 'neural_tts' ONLY a verified Tier-1 Neural UK Female voice (score >= 100)
   * 4 'dictionary' real human British pronunciation (dict.youdao.com type=1)
   * 5 'tts'        browser speechSynthesis, always last
   * v0.0.1.d dropped the dictionary tier under 'unified', so Brave (0 voices)
   * stayed silent and Windows fell back to robotic US Zira. Now the real human
   * UK recording ALWAYS precedes low-quality synth, and the neural tier exists
   * only when a genuinely British female neural voice is verified present. */
  /* R1(c): the active dictation may only speak into #screen-player. */
  function viewIsPlayer() {
    try {
      if (!SDP.Views || typeof SDP.Views.currentTab !== 'function') return true;
      return str(SDP.Views.currentTab()) === 'player';
    } catch (e) { return true; }
  }
  function resolveTiers(wordObj, opts) {
    opts = opts || {};
    var w = isObj(wordObj) ? wordObj : { w: wordObj };
    var s = sync();
    var lecturer = s && s.getClipUrl ? str(s.getClipUrl(w)) : str(w.clipUrl);
    var eleven = clipFromManifest(w);
    var dictionary = str(w.audio);
    var tiers = [];
    var conf = settings();
    var source = str(opts.voiceSource || conf.voiceSource || 'auto');
    var voiceLock = str(conf.voiceLock || 'unified');
    if (source === 'lecturer') return [{ tier: 'lecturer', url: lecturer }];
    if (source === 'alice') return [{ tier: 'eleven', url: eleven }];
    if (source === 'device') return [{ tier: 'tts', url: '' }];
    var unified = voiceLock === 'unified' && source !== 'custom';
    var hasTier1Neural = !!cachedProfVoice && scoreVoice(cachedProfVoice) >= 100 && getVoicesSafe().length > 0;
    if (lecturer) tiers.push({ tier: 'lecturer', url: lecturer });
    if (eleven) tiers.push({ tier: 'eleven', url: eleven });
    if (unified && hasTier1Neural) tiers.push({ tier: 'neural_tts', url: '' });
    /* v0.0.4.a W1: under 'unified' the Youdao dictionary MP3 tier is NEVER
       mixed with Web Speech TTS — opt in explicitly via includeDictionary. */
    if (dictionary && (!unified || (opts && opts.includeDictionary))) tiers.push({ tier: 'dictionary', url: dictionary });
    /* v0.0.7.a PILLAR 1 (Z1 — PERMANENT HIGH-PROFESSIONAL VOICE LOCK):
       under the locked unified voiceSignature the robotic device TTS tier is
       REMOVED from the word ladder entirely. A missing Alice/cloned clip must
       surface the bilingual guard banner and fall to the real-human British
       dictionary recording (the cleanest British RP fallback) — never silently
       degrade to robotic speechSynthesis audio. Only when the lock is
       explicitly OFF (voiceLock 'custom' / voiceSource 'custom' / 'device')
       does the classic professor-TTS safety net stay armed. */
    var sigLocked = unified;
    try {
      if (sigLocked && SDP.Studio && SDP.Studio.voiceSignature) {
        var vs = SDP.Studio.voiceSignature();
        if (isObj(vs)) sigLocked = sigLocked && vs.locked !== false;
      }
    } catch (eZ1) { /* Studio absent (student lab shell): keep the unified lock. */ }
    if (!sigLocked) tiers.push({ tier: 'tts', url: '' });
    else if (!tiers.length) tiers.push({ tier: 'silent_locked', url: '' });
    return tiers;
  }
  /* E3 / D-C6 helper: speak one guide step in English with professor cadence.
   * Canonical call is playGuideStep(stepIdx, stepText, opts, cb); the v0.0.1.b
   * two-argument call playGuideStep(stepText, opts, cb) is still accepted so no
   * caller can silently lose its narration.
   * When the lecturer has generated the Alice guide pack ('_guide_1'..'_guide_4'
   * in data/elevenlabs-audio.json) that clip is played instead of TTS — zero
   * credits, identical voice on every device. */
  function guideClipUrl(stepIdx) {
    if (stepIdx === null || stepIdx === undefined || stepIdx < 0) return '';
    var clips = state.manifest && isObj(state.manifest.clips) ? state.manifest.clips : null;
    if (!clips) return '';
    var n = Number(stepIdx);
    var entry = clips['guide.en.' + n] || clips['_guide_' + (n + 1)] || null;
    return entryUrl(entry);
  }
  /* D11: four concise British-English fallback lines for the guide. When the
     browser never fires utter.onstart (Brave desktop, voiceless kiosks), the
     guide plays the REAL human British recording of these lines from the
     dictionary CDN through plain <audio> — the steps are never silent. */
  var GUIDE_AUDIO_FALLBACK_LINES = [
    'Choose how you learn.',
    'Listen and write against the timer.',
    'Check all thirty words and see your score.',
    'Practise the words you missed.'
  ];
  function shortGuideLine(stepIdx) {
    var i = Number(stepIdx);
    if (!(i >= 0) || i > GUIDE_AUDIO_FALLBACK_LINES.length - 1) i = 0;
    return GUIDE_AUDIO_FALLBACK_LINES[i] || GUIDE_AUDIO_FALLBACK_LINES[0];
  }
  function youdaoAudioUrl(text) {
    return 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(text);
  }
  /* D11: say() the step AND arm a 700 ms real-onstart watchdog. If
     state.utterStarted is still false (or the device has no voices at all),
     speechSynthesis is cancelled and the cloud British-female fallback line
     plays through <audio> (state.lastTier = 'guide_audio'). Only when that
     <audio> playback also fails does the caller reveal #guideTapBanner. */
  function narrateGuideStep(stepIdx, stepText, rate, volume, cb) {
    /* R2 (F2): the 700 ms watchdog used to cancel a perfectly good utterance
       and play a Youdao clip of a DIFFERENT sentence — that is the loop the
       class heard. One sentence in, one utterance out; the views watchdog
       (900 ms, no speech) is the only silent-device fallback. */
    say([str(stepText)], { lang: 'en-GB', rate: rate, pitch: 1.03, volume: volume }, function () { cb(null); });
    return true;
  }
  function playGuideStep(a, b, c, d) {
    var stepIdx = -1, stepText = '', o = {}, cb = noop;
    if (typeof a === 'number') {
      stepIdx = a;
      stepText = str(b);
      if (typeof c === 'function') { cb = c; } else { o = isObj(c) ? c : {}; if (typeof d === 'function') cb = d; }
    } else {
      stepText = str(a);
      if (typeof b === 'function') { cb = b; } else { o = isObj(b) ? b : {}; if (typeof c === 'function') cb = c; }
    }
    var rate = o.rate !== undefined ? o.rate : 0.94;
    var volume = o.volume;
    /* 1. A committed Alice guide clip always wins (zero credits). */
    var clip = guideClipUrl(stepIdx);
    if (clip) {
      var gEpoch = state.speechEpoch;
      state.speaking = true;
      playUrl(playableUrl(clip), { rate: rate, volume: volume }, function (err) {
        if (state.speechEpoch !== gEpoch) return;
        state.speaking = false;
        if (!err) { state.lastTier = 'guide_clip'; cb(null); return; }
        /* A broken cached clip must still narrate the step. */
        narrateGuideStep(stepIdx, stepText, rate, volume, cb);
      });
      return true;
    }
    /* 2. Professor TTS with the 700 ms real-onstart watchdog + cloud fallback. */
    narrateGuideStep(stepIdx, stepText, rate, volume, cb);
    return false;
  }

  /* ══ v0.0.6.m Pillar 1: Project Briefing narration ══════════════════════
   * Tier 1: the committed real British-male clip _intro_male_N from
   *        data/elevenlabs-audio.json (zero latency, zero re-spend) — the
   *        hooks report its true duration (word-flow timing) and the
   *        positive onStarted signal for the autoplay handshake.
   * Tier 2: the pinned deep British male device voice (persona 'male'
   *        — pitch 0.82 / rate 0.98, hard female-name rejection) — before
   *        the lecturer has regenerated the clips.
   * Fresh-Chrome autoplay law: a NotAllowedError from Audio.play(), or a
   *        speechSynthesis with zero voices, resolves { autoplayBlocked }
   *        so the briefing HOLDS the beat behind the "Tap Anywhere" pill
   *        and never silently skips or falls to a robotic voice. The
   *        callback ALWAYS fires so the synced transcript can never stall. */
  function briefingClipUrl(idx) {
    if (idx === null || idx === undefined || idx < 0) return '';
    var clips = state.manifest && isObj(state.manifest.clips) ? state.manifest.clips : null;
    if (!clips) return '';
    var n = Number(idx);
    var entry = clips['_intro_male_' + (n + 1)] || clips['intro.en.' + n] || null;
    /* v0.0.6.o ZERO CUT-OFF LAW: a cached _intro_male_* clip may only play
       when its stored text is EXACTLY the current sentence — a stale clip
       recorded for an older script (different sentence endings / shorter
       duration) is what cut off the end of each paragraph in v0.0.6.n. The
       sha1 hash pins text|voiceId|modelId, so BOTH the text and the hash
       must match before the clip is trusted. */
    var want = null;
    try {
      if (global.SDP && SDP.Views && typeof SDP.Views.briefingSentences === 'function') {
        var lines = SDP.Views.briefingSentences();
        want = str(lines[n]);
      }
    } catch (eV) { want = null; }
    if (entry && want && str(entry.text) !== want) return '';
    if (entry && want) {
      var wantHash = clipTextHash(want, entry.voiceId, entry.modelId);
      if (str(entry.hash) && wantHash && str(entry.hash) !== wantHash) return '';
    }
    return entryUrl(entry);
  }
  /* v0.0.6.u Fix 1C helper: can the REAL briefing clip for beat <idx> play
     right now (manifest loaded, entry present, text + hash pin intact)?
     The Paragraph-1 hard guard in briefingNarrate polls this to hand the
     genuine _intro_male_1 clip one more chance the moment a cold-browser
     manifest finally lands. */
  function briefingClipReady(idx) {
    return !!briefingClipUrl(idx);
  }
  /* v0.0.6.u Fix 5A: pre-warm the Paragraph-1 clip's Blob URL while the user
     is still reading the Welcome splash — loadManifest() runs in the
     background and playableUrl(briefingClipUrl(0)) decodes _intro_male_1's
     base64 into the memoized Blob, so the Continue click starts Paragraph 1
     with 0 ms decode latency (playBriefingStep is served the ready URL). */
  function preWarmBriefing(idx) {
    try {
      loadManifest(function () {
        var clip = briefingClipUrl(idx);
        if (clip) playableUrl(clip);
      });
    } catch (e0) {}
    return true;
  }
  function playBriefingStep(stepIdx, stepText, cb, hooks) {
    cb = cb || noop;
    hooks = isObj(hooks) ? hooks : {};
    var text = str(stepText);
    if (!text) { cb(null); return true; }
    function tier2Play() {
      /* Tier 2: a brand-new Chrome session often has ZERO speechSynthesis
       voices and blocks speak() until the first gesture — that exact state
       resolves autoplayBlocked (the tap pill), never a silent skip.
       v0.0.6.o ZERO CUT-OFF LAW: the briefing completion callback fires
       only from the utterance's real onend (the utterance is pinned in the
       GC-safe array); if the engine reports speaking/pending while the
       guard timer fires, the guard keeps waiting — the final words of the
       paragraph are never clipped and never skipped early. */
      var synth = global.speechSynthesis;
      var voiceCount = 0;
      try { if (synth && synth.getVoices) voiceCount = synth.getVoices().length; } catch (e0) {}
      if (synth && voiceCount === 0) { cb({ autoplayBlocked: true, tier: 'device', noVoices: true }); return false; }
      say([text], { persona: 'male', rate: 0.97, onBoundary: function (ci) { if (typeof hooks.onBoundary === 'function') { try { hooks.onBoundary(ci); } catch (e4) {} } } }, function () { cb(null); });
      return false;
    }
    function clipPlay(clip) {
      var bEpoch = state.speechEpoch;
      state.speaking = true;
      /* v0.0.6.r Pillar 3: the tightened ultra-crisp executive script plays
         at a crisp broadcast cadence (1.12×) so all four beats land with
         punch — Beat 1's tightened opening speaks completely in ~8.5–9.5 s,
         right as the 10-second gate matures. */
      playUrl(playableUrl(clip), {
        rate: 1.12,
        hooks: {
          onStarted: function () { if (typeof hooks.onStarted === 'function') { try { hooks.onStarted(); } catch (e1) {} } },
          onDuration: function (d) { if (typeof hooks.onDuration === 'function') { try { hooks.onDuration(d); } catch (e2) {} } },
          /* v0.0.6.m: the frame-accurate clock — every playback frame repaints
             the karaoke from the real clip's currentTime/duration. */
          onTick: function (t, d) { if (typeof hooks.onTick === 'function') { try { hooks.onTick(t, d); } catch (e3) {} } }
        }
      }, function (err) {
        if (state.speechEpoch !== bEpoch) return;
        state.speaking = false;
        if (!err) { state.lastTier = 'intro_male_clip'; cb(null); return; }
        if (err && err.autoplayBlocked) { cb({ autoplayBlocked: true, tier: 'clip' }); return; }
        /* A broken cached clip must still narrate the step. */
        say([text], { persona: 'male', rate: 0.97, onBoundary: function (ci) { if (typeof hooks.onBoundary === 'function') { try { hooks.onBoundary(ci); } catch (e4) {} } } }, function () { cb(null); });
      });
      return true;
    }
    var clip = briefingClipUrl(stepIdx);
    if (clip) return clipPlay(clip);
    /* v0.0.6.u Fix 1B — the COLD-BROWSER MANIFEST WAIT LAW. On a brand-new
       browser the 3.8 MB data/elevenlabs-audio.json is often STILL
       DOWNLOADING when briefingNarrate(0) fires 410 ms after the Continue
       click; briefingClipUrl(0) returned '' and this function fell straight
       to Tier 2, whose utterance then failed (recent cancel(), zero voices)
       and advanced narration to Paragraph 2 — which played its MP3 once the
       manifest landed. THE FIX: when the manifest is not yet in memory,
       NEVER fall back at once — loadManifest() is kicked and the beat waits
       (bounded 8000 ms, cold-network budget) for the pack to arrive, then
       plays the REAL _intro_male_1 from Word 1. Only a dead fetch after the
       full budget falls to Tier 2. */
    if (!state.manifest) {
      var coldEpoch = state.speechEpoch;
      var coldDone = false, coldWaited = 0;
      var coldPoll = null, coldBail = null;
      var finishCold = function () {
        if (coldDone) return;
        coldDone = true;
        if (coldPoll) { global.clearInterval(coldPoll); coldPoll = null; }
        if (coldBail) { global.clearTimeout(coldBail); coldBail = null; }
        if (state.speechEpoch !== coldEpoch) { cb(null); return; }
        var late = briefingClipUrl(stepIdx);
        if (late) clipPlay(late); else tier2Play();
      };
      coldBail = global.setTimeout(finishCold, 8000);
      coldPoll = global.setInterval(function () {
        if (coldDone) { global.clearInterval(coldPoll); coldPoll = null; return; }
        coldWaited += 120;
        if (state.manifest) { finishCold(); return; }
        if (coldWaited >= 8000) finishCold();
      }, 120);
      loadManifest(noop);
      return true;
    }
    return tier2Play();
  }

  /* ══ R3: spoken button cues (`cmd.*` and `num.<n>`) ══════════════════════
   * Every cue has three tiers and none of them bills a character:
   *   1. the committed 70-clip pack clip (state.manifest.clips[key])
   *   2. the documented English fallback sentence below
   *   3. silence, with the callback still honoured so the beat never stalls. */
  var CUE_TEXTS = {
    'cmd.preparing': 'Preparing lesson. Listen carefully.',
    'cmd.paused': 'Session paused.',
    'cmd.resumed': 'Session resumed.',
    'cmd.hint': 'Hint shown.',
    'cmd.complete': "Dictation complete. Let's check your thirty words.",
    'cmd.sample': 'British female lecturer voice ready.'
  };
  function cueDefaultText(cueKey) {
    var k = str(cueKey).toLowerCase();
    if (CUE_TEXTS[k]) return CUE_TEXTS[k];
    var m = /^num\.(\d+)$/.exec(k);
    if (m) return 'Number ' + m[1] + '.';
    return '';
  }
  function sayCue(cueKey, fallbackText, cb) {
    if (typeof fallbackText === 'function') { cb = fallbackText; fallbackText = ''; }
    cb = cb || noop;
    var key = str(cueKey).toLowerCase();
    var text = str(fallbackText) || cueDefaultText(key);
    /* The caller has already called stop(); this epoch is this cue's own. */
    var cueEpoch = state.speechEpoch;
    if (text) {
      state.lastUtterances = state.lastUtterances || [];
      if (state.lastUtterances[state.lastUtterances.length - 1] !== text) {
        state.lastUtterances.push(text);
        if (state.lastUtterances.length > 25) state.lastUtterances.shift();
      }
    }
    var clipUrl = manifestClip(key);
    if (clipUrl) {
      playUrl(playableUrl(clipUrl), { rate: 0.92, volume: undefined, epoch: cueEpoch }, function (err) {
        if (state.speechEpoch !== cueEpoch) return;
        if (!err) { state.lastTier = 'eleven'; cb(null); return; }
        /* v0.0.6.f (R3 B.1): a failed or aborted cue clip resolves SILENTLY —
           the browser's robotic speechSynthesis may never say "Session
           paused." on a rapid tap. The cue text was already recorded in the
           lastUtterances audit above, so G10 still sees it exactly once. */
        state.lastTier = 'eleven';
        cb(null);
      });
      return true;
    }
    /* No committed Alice clip for this cue: silence (never browser TTS).
       v0.0.6.f: resolved on the NEXT tick — a synchronous cb would arm the
       engine's 400 ms cue timer inside speakRepeats() and startTicker()'s
       stopTicker() would clear it before it ever fired. */
    global.setTimeout(function () { cb(null); }, 0);
    return false;
  }

  /* R6 (F9): the persona is resolved once per session and then held. Android
     fires voiceschanged mid-session; swapping the voice then changes the
     speaker in the middle of a word. */
  function lockSessionVoice() {
    if (state.sessionVoice) return state.sessionVoice;
    var v = pickVoice('en-GB');
    if (!v) {
      state.voiceDirty = true;
      warmProfessorVoice(function (warmed) { if (warmed && !state.sessionVoice) state.sessionVoice = warmed; });
      return null;
    }
    state.sessionVoice = v;
    state.voiceDirty = false;
    return v;
  }
  function endSessionVoice() { state.sessionVoice = null; return null; }

  /* ══ SDP.Speech.playWord — the D10 5-tier chain, bounded at every step ══ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 tier order */
  function playWord(word, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = opts || {};
    cb = cb || noop;
    var at = 0;
    var tiers = null;
    var settled = false;
    var gen = 0;
    var wEpoch = state.speechEpoch;
    state.lastTier = '';
    /* v0.0.6.e (B): log the word synchronously at the very start so the
       lastUtterances audit reflects intent even when the clip is aborted
       mid-flight; identical tail entries dedup. */
    var pw = str(word && word.w ? word.w : word);
    if (pw) {
      state.lastUtterances = state.lastUtterances || [];
      if (state.lastUtterances[state.lastUtterances.length - 1] !== pw) {
        state.lastUtterances.push(pw);
        if (state.lastUtterances.length > 25) state.lastUtterances.shift();
      }
    }
    /* v0.0.6.t PILLAR 1: an EXPLICIT user play (a tap on ▶ Play / Listen on
       the 30 Words screen, the Practice screen, or the Settings voice test)
       passes allowWhenPaused / manualPlay and is NEVER refused — the engine's
       pause-for-navigation lock must not mute a deliberate human action.
       Background engine beats (no flags) stay 100% gated below. */
    var manual = !!(opts && (opts.allowWhenPaused === true || opts.manualPlay === true));
    if (Refuse()) { cb(null); return false; }
    function Refuse() {
      if (manual) return false;
      if (SDP.Engine && SDP.Engine.isPaused && SDP.Engine.isPaused()) return true;
      var active = false;
      try { active = !!(SDP.Engine && SDP.Engine.isActive && SDP.Engine.isActive()); } catch (e) { active = false; }
      if (active && !viewIsPlayer()) return true;
      return false;
    }
    function attempt() {
      var myGen = gen;
      if (at >= tiers.length) {
        state.lastTier = state.lastTier || 'tts';
        settled = true;
        cb(null);
        return;
      }
      var current = tiers[at];
      at += 1;
      /* v0.0.7.a PILLAR 1 (Z1): the silent_locked tier — the locked unified
         signature left no clip, no neural voice and no dictionary URL, so the
         word resolves honestly to the guard banner + telemetry incident and
         NEVER to the robotic speechSynthesis voice. The tier name feeds
         lastTierName() so the Lab and Studio report the lock honestly. */
      if (current.tier === 'silent_locked') {
        state.lastTier = 'silent_locked';
        settled = true;
        try {
          if (global.SDP && SDP.Diagnostics) {
            SDP.Diagnostics.log('voice_lock_silent', { word: str(w && w.w).slice(0, 40) });
          }
        } catch (eZ2) {}
        cb(null);
        return;
      }
      if (current.tier === 'tts' || current.tier === 'neural_tts') {
        state.lastTier = current.tier;
        /* E2 professor cadence. D10: the utterance carries the word's real
           human British recording as its 800 ms watchdog fallback, so even
           the TTS tier can never leave a word silent. */
        /* v0.0.6.t PILLAR 1: the TTS fallback carries allowWhenPaused when the
           play was a deliberate user tap, so a paused engine can no longer
           silently kill the deferred speak() (the v0.0.6.s dead-button bug). */
        say([str(word && word.w ? word.w : word)], { rate: 0.92, pitch: 1.03, volume: opts.volume, fallbackAudioUrl: str(word && word.audio), allowWhenPaused: manual }, function () {
          if (myGen !== gen || settled || state.speechEpoch !== wEpoch) return;
          settled = true;
          cb(null);
        });
        /* say() bumps the epoch through its own stopAll(); adopt it so the
           callback above is not rejected as stale, and so a real pause during
           the word still invalidates this chain. */
        wEpoch = state.speechEpoch;
        return;
      }
      playUrl(current.url, { rate: opts.rate, volume: opts.volume, timeoutMs: opts.timeoutMs, epoch: wEpoch }, function (err) {
        if (myGen !== gen || settled || state.speechEpoch !== wEpoch) return;
        if (!err) {
          state.lastTier = current.tier;
          settled = true;
          cb(null);
          return;
        }
        /* v0.0.6.e (B): an aborted/stale clip (rapid tap, epoch bump, pause)
           stops the ladder CLEANLY — never falls to Youdao or speechSynthesis. */
        if (err.aborted || err.stale) {
          settled = true;
          state.lastTier = state.lastTier || 'eleven';
          cb(null);
          return;
        }
        /* v0.0.6.e (B): a genuine failure of the committed Alice clip while
           online retries the local MP3 once before the ladder continues. */
        if ((current.tier === 'eleven' || current.tier === 'elevenlabs') && !attempt.retried &&
            (typeof navigator === 'undefined' || navigator.onLine !== false)) {
          attempt.retried = true;
          at -= 1;
          attempt();
          return;
        }
        /* v0.0.6.m Pillar 3: an honest audio-tier fallback is a diagnostics
           event (privacy-safe, no personal data) so the lecturer can see why
           a word fell back to Youdao or the device voice. */
        try {
          if (global.SDP && SDP.Diagnostics) {
            SDP.Diagnostics.log('audio_tier_fallback', { word: pw.slice(0, 40), from: current.tier, to: (tiers[at] && tiers[at].tier) || 'end' });
          }
        } catch (e) {}
        /* v0.0.6.w — T2/T3 self-heal triggers: a media error on the committed
           word clip (T2) and a fall-through that reaches the tts tier (T3)
           both surface the student self-heal assistant with 1-tap actions. */
        try {
          if (global.SDP && SDP.SelfHeal && SDP.SelfHeal.show) {
            var nextTier = (tiers[at] && tiers[at].tier) || 'end';
            if (err && err.media && /MEDIA_ERR_(SRC_NOT_SUPPORTED|DECODE|NETWORK)/.test(String(err.media))) {
              SDP.SelfHeal.show('T2', { clipKey: pw.slice(0, 40), lastErr: String(err.media) });
            } else if (nextTier === 'tts' || nextTier === 'end') {
              SDP.SelfHeal.show('T3', { clipKey: pw.slice(0, 40), from: current.tier });
            }
          }
        } catch (eSH) {}
        attempt();
      });
    }
    /* v0.0.6.u Fix 2 — the COLD-MANIFEST WAIT LAW. On a brand-new browser
       the very first ▶ Play / Listen tap used to fall straight through to
       the device's robotic speechSynthesis, because resolveTiers() ran
       while the 3.8 MB pack was still downloading (clipFromManifest()
       returned '' and the eleven tier simply did not exist). THE LAW: when
       no explicit tier list was passed and the manifest is not yet in
       memory, the ladder WAITS — bounded 2500 ms — for loadManifest() to
       land before the tiers are resolved, so the first word a student ever
       taps still plays the real unified British female voice clip. The
       kick is cheap (a no-op callback when a fetch is already in flight)
       and a genuinely dead fetch still resolves through the tts tier after
       the bounded wait. The R1 Path A restart below stays as the second
       chance for a pack that lands mid-word. */
    function run() {
      if (ladderStarted) return;
      ladderStarted = true;
      tiers = opts.tiers || resolveTiers(word);
      attempt();
    }
    var ladderStarted = false;
    if (!opts.tiers && !state.manifest) {
      var pwStarted = false;
      var pwWaitStart = nowMs();
      var pwPoll = null;
      var pwKick = function () {
        if (pwStarted) return;
        pwStarted = true;
        loadManifest(function () {
          /* R1 Path A (F1): the manifest restart was the loudest leak — a
             slow fetch landed seconds after Pause and replayed the word.
             The epoch, the pause flag and the current screen are all
             re-checked FIRST. The poll path owns the FIRST start; this
             restart only fires for a pack that lands after the bounded
             wait already fell through (ladderStarted, not settled). */
          if (settled || opts.tiers || !state.manifest) return;
          if (!ladderStarted) return;
          if (state.speechEpoch !== wEpoch) return;
          /* v0.0.6.t PILLAR 1: a manual tap survives the restart too. */
          if (!manual && SDP.Engine && SDP.Engine.isPaused && SDP.Engine.isPaused()) return;
          if (Refuse()) return;
          gen += 1;
          at = 0;
          tiers = resolveTiers(word);
          attempt();
        });
      };
      pwPoll = global.setInterval(function () {
        if (settled || opts.tiers) { global.clearInterval(pwPoll); pwPoll = null; return; }
        if (state.manifest || nowMs() - pwWaitStart >= 2500) {
          global.clearInterval(pwPoll); pwPoll = null;
          run();
        }
      }, 100);
      pwKick();
      return;
    }
    run();
  }

  /* VOX-08: the old test only called say() and always claimed 'Alice'. It now
     plays a real session word through the real tier chain and reports the tier
     that actually produced the sound. */
  function testVoice(cb) {
    cb = cb || noop;
    var conf = settings();
    var wordsList = [];
    try { wordsList = sync() && sync().words ? sync().words() : []; } catch (e) { wordsList = []; }
    var first = wordsList && wordsList.length ? wordsList[0] : { w: 'confident', audio: '' };
    /* v0.0.6.t PILLAR 1: the Settings voice test is a deliberate human tap —
       it plays even while the engine is paused-for-navigation, and its spoken
       verdict line carries allowWhenPaused for the same reason. */
    playWord(first, { volume: conf.volume, allowWhenPaused: true, manualPlay: true }, function () {
      var tier = lastTierName();
      var spoken = str(first && first.w) || 'confident';
      say(['Professor voice ready · ' + spoken], { lang: 'en-GB', rate: 0.92, pitch: 1.03, volume: conf.volume, allowWhenPaused: true }, function () {
        cb(null, { tier: tier, word: spoken });
      });
    });
    return true;
  }
  function lastTierName() {
    var names = {
      lecturer: 'Lecturer clip',
      eleven: 'Alice (ElevenLabs)',
      neural_tts: 'Professor neural voice (UK female)',
      dictionary: 'British human audio',
      guide_clip: 'Alice guide clip',
      guide_audio: 'British guide audio',
      intro_male_clip: 'British male briefing clip',
      tts: 'Professor voice',
      silent_locked: 'Locked unified voice (clip missing — banner shown)'
    };
    return names[state.lastTier] || str(state.lastTier) || 'Professor voice';
  }

  /* ══ v0.0.6.m FIX 3: recoverAudioSession() ═════════════════════════════
   * On mobile Chrome/Safari, a voice review (getUserMedia + MediaRecorder +
   * SpeechRecognition) switches the OS audio router into Voice
   * Communication / Mic Capture mode, which ducks or mutes standard media
   * playback and can leave speechSynthesis cancelled/stuck. This resets the
   * shared audio element (volume 1.0, muted false, rate 1) and unsticks
   * speechSynthesis (cancel() + resume()), so the very next Dictation Word
   * plays at full clarity. Called by SDP.Views.releaseFeedbackAudioLocks()
   * whenever a review recorder stops / submits / closes and before every
   * dictation word, start and resume. */
  function recoverAudioSession(reason) {
    var changed = false;
    var el = sharedAudio();
    if (el) {
      try {
        if (el.volume !== 1) { el.volume = 1; changed = true; }
        if (el.muted) { el.muted = false; changed = true; }
        if (el.playbackRate !== 1) { try { el.playbackRate = 1; } catch (e0) {} }
        if (!el.paused) { try { el.pause(); } catch (e1) {} changed = true; }
      } catch (e2) {}
    }
    var synth = global.speechSynthesis;
    if (synth) {
      try { if (synth.cancel) synth.cancel(); changed = true; } catch (e3) {}
      try { if (synth.resume) synth.resume(); } catch (e4) {}
    }
    state.micReleased = true;
    try {
      if (global.SDP && SDP.Diagnostics) {
        SDP.Diagnostics.log('audio_session_recovered', { reason: str(reason || 'generic'), tier: str(state.lastTier) });
      }
    } catch (e5) {}
    return changed;
  }
  function micReleased() { return state.micReleased !== false; }

  /* ══ v0.0.7.a Pillar 2 (Y2) — the strict anti-stale voice clip guard.
     Four rules classify every clip: KEY MEMBERSHIP (words.<k> must be one of
     the 30 active session words), REVISION & HASH (wordsRev + text pin),
     VOICE IDENTITY (the locked voiceSignature().voiceId) and AUDIO DECODE
     (real MP3 bytes). Stale/orphaned/mismatched/corrupted keys are purged
     from every layer — manifest, clipBase, injectedClips, the studio pack
     and CacheStorage — before they can ever play. ══ */
  function activeWordKeys() {
    var out = {}, words = [], i;
    try { if (SDP.Sync && SDP.Sync.words) words = SDP.Sync.words() || []; } catch (eS) { words = []; }
    for (i = 0; i < words.length; i++) out[normKey(words[i] && words[i].w)] = 1;
    return out;
  }
  /* System-clip namespaces: num.*, cmd.*, guide.* and the _intro_male_*
     briefing beats (plus their words.<sys> mirror aliases from hydrateClips)
     are never membership-gated against the 30 active session words. */
  var SYSTEM_CLIP_RE = /^(num|cmd|guide)\./;
  function isSystemClipKey(k) {
    var n = normKey(str(k).replace(/^words\./, ''));
    return SYSTEM_CLIP_RE.test(n) || n.indexOf('_intro_') === 0;
  }
  function isValidMp3B64(b64) {
    var s = str(b64);
    if (s.length < 1400) return false; /* < ~1000 decoded bytes */
    return s.indexOf('UklGR') !== 0;   /* a WAV payload in a word slot is not classroom MP3 */
  }
  function validatePackClips(manifest, activeWords, expectedVoiceId) {
    var src = isObj(manifest) ? manifest : (state.manifest || {});
    if (!isObj(src.clips)) src = { clips: {} };
    var clips = src.clips, report = { stale: [], orphaned: [], voiceMismatch: [], corrupted: [], clean: [], readyWords: 0, missingWords: [] };
    var active = {}, words = activeWords, i;
    if (!Array.isArray(words) || !words.length) {
      try { if (SDP.Sync && SDP.Sync.words) words = SDP.Sync.words() || []; } catch (eW) {}
    }
    for (i = 0; i < (words || []).length; i++) active[normKey(words[i] && words[i].w)] = 1;
    var expectedVid = str(expectedVoiceId);
    if (!expectedVid) {
      try {
        var st = settings();
        if (isObj(st.voiceSignature)) expectedVid = str(st.voiceSignature.voiceId);
      } catch (eVs) {}
    }
    var k, entry, wkey, bare, entryVoice, missingMap = {};
    for (k in clips) {
      if (!Object.prototype.hasOwnProperty.call(clips, k)) continue;
      entry = clips[k];
      /* only words.* (and their bare <word> aliases) are membership-gated;
         the num/cmd/guide/_introMale system clips — and their words.<sys>
         mirror aliases created by hydrateClips — are never orphans. */
      if (/^words\./.test(k) || (!/\./.test(k) && k.indexOf('_') !== 0)) {
        wkey = normKey(k.replace(/^words\./, ''));
        bare = normKey(k);
        /* A words.<sys> key (words.num.1, words.cmd.*, …) is legal ONLY as
           the runtime mirror alias hydrateClips stamps over the real <sys>
           entry — the SAME object reference. A distinct words.<sys> object
           came from a polluted pack file (the live-repo corruption) and is
           classified ORPHANED so it can never play. */
        if (SYSTEM_CLIP_RE.test(wkey) || wkey.indexOf('_intro_') === 0) {
          if (isObj(clips[wkey]) && clips[k] === clips[wkey]) { report.clean.push(k); continue; }
          if (!/^words\./.test(k) && clips[k] === clips['words.' + bare]) { report.clean.push(k); continue; }
          report.orphaned.push(k);
          continue;
        }
        if (SYSTEM_CLIP_RE.test(bare) || bare.indexOf('_intro_') === 0) { report.clean.push(k); continue; }
        if (!active[wkey] && !active[bare]) { report.orphaned.push(k); continue; }
        if (!isValidMp3B64(isObj(entry) ? entry.b64 : entry)) { report.corrupted.push(k); continue; }
        if (expectedVid && isObj(entry) && str(entry.voiceId) && str(entry.voiceId) !== expectedVid) { report.voiceMismatch.push(k); continue; }
        if (isObj(entry) && Number(entry.wordsRev) && Number(src.wordsRev) && Number(entry.wordsRev) < Number(src.wordsRev)) { report.stale.push(k); continue; }
        report.clean.push(k);
        if (/^words\./.test(k)) report.readyWords += 1;
      } else {
        report.clean.push(k);
      }
    }
    for (i = 0; i < (words || []).length; i++) {
      var wk = normKey(words[i] && words[i].w);
      var hit = clips['words.' + wk] || clips[wk];
      if (!hit || !isValidMp3B64(isObj(hit) ? hit.b64 : hit)) missingMap[wk] = 1;
    }
    report.missingWords = Object.keys ? Object.keys(missingMap) : (function () { var a = [], q; for (q in missingMap) if (Object.prototype.hasOwnProperty.call(missingMap, q)) a.push(q); return a; })();
    return report;
  }
  function purgeStaleClipsEverywhere(opts) {
    opts = opts || {};
    var purged = 0, report = validatePackClips(opts.manifest, opts.activeWords, opts.expectedVoiceId);
    var kill = {};
    var i, k;
    for (i = 0; i < report.orphaned.length; i++) kill[report.orphaned[i]] = 'orphaned';
    for (i = 0; i < report.corrupted.length; i++) kill[report.corrupted[i]] = 'corrupted';
    if (opts.purgeVoiceMismatch !== false) {
      for (i = 0; i < report.voiceMismatch.length; i++) kill[report.voiceMismatch[i]] = 'voice_mismatch';
    }
    if (opts.purgeStaleRev !== false) {
      for (i = 0; i < report.stale.length; i++) kill[report.stale[i]] = 'stale';
    }
    /* 1. the live manifest + the zero-drop clip base + injected clips */
    var layers = [];
    if (isObj(state.manifest) && isObj(state.manifest.clips)) layers.push(state.manifest.clips);
    if (isObj(state.clipBase)) layers.push(state.clipBase);
    if (isObj(state.injectedClips)) layers.push(state.injectedClips);
    if (SDP.Studio && SDP.Studio.state && isObj(SDP.Studio.state.voicePack) && isObj(SDP.Studio.state.voicePack.clips)) layers.push(SDP.Studio.state.voicePack.clips);
    for (k in kill) {
      if (!Object.prototype.hasOwnProperty.call(kill, k)) continue;
      for (i = 0; i < layers.length; i++) {
        if (layers[i] && Object.prototype.hasOwnProperty.call(layers[i], k)) { delete layers[i][k]; purged += 1; }
      }
    }
    /* 2. the local-briefing-pack inside CacheStorage('sdp-audio-clips') */
    try {
      if (global.caches && global.caches.open) {
        global.caches.open('sdp-audio-clips').then(function (cache) {
          return cache.match('./local-briefing-pack.json');
        }).then(function (res) {
          if (!res) return null;
          return res.json();
        }).then(function (pack) {
          if (!isObj(pack) || !isObj(pack.clips)) return null;
          var n = 0, q;
          for (q in kill) {
            if (Object.prototype.hasOwnProperty.call(pack.clips, q)) { delete pack.clips[q]; n += 1; }
          }
          if (n) {
            global.caches.open('sdp-audio-clips').then(function (cache) {
              cache.put('./local-briefing-pack.json', new Response(JSON.stringify(pack), { headers: { 'Content-Type': 'application/json' } }));
            });
          }
          return null;
        }).catch(function () {});
      }
    } catch (eC) {}
    /* 3. localStorage 'sdp-audio-clips' fallback pockets */
    try {
      var pocket = global.localStorage.getItem('sdp-audio-clips');
      if (pocket) {
        var po = JSON.parse(pocket);
        if (isObj(po) && isObj(po.clips)) {
          var pn = 0, q2;
          for (q2 in kill) {
            if (Object.prototype.hasOwnProperty.call(po.clips, q2)) { delete po.clips[q2]; pn += 1; }
          }
          if (pn) global.localStorage.setItem('sdp-audio-clips', JSON.stringify(po));
        }
      }
    } catch (eL) {}
    /* re-hydrate what is left */
    if (isObj(state.manifest) && isObj(state.manifest.clips)) hydrateClips(state.manifest.clips);
    return { purged: purged, killed: kill, report: report };
  }
  /* auditSessionVoiceReadiness() — Case A (stale/mismatch in cache) and
     Case B (missing clips) both raise #sdpVoiceClipGuardBanner; dictation
     ALWAYS continues on the clean British RP fallback. */
  function auditSessionVoiceReadiness(opts) {
    opts = opts || {};
    /* Before the manifest has ever loaded there is nothing to audit — an
       absent manifest is the BOOT state, not a missing-clip incident. */
    if (!isObj(state.manifest)) {
      return { level: 'boot', ready: 0, missing: 0, total: 0, report: null, bannerShown: false, autoPurged: false };
    }
    var words = [];
    if (Array.isArray(opts.words) && opts.words.length) words = opts.words;
    else { try { if (SDP.Sync && SDP.Sync.words) words = SDP.Sync.words() || []; } catch (eW) {} }
    var total = words.length || 30;
    var report = validatePackClips(state.manifest, words, opts.expectedVoiceId);
    var auto = false;
    /* auto-purge orphans + corrupted at once (the 0% stale playback law) */
    if (report.orphaned.length || report.corrupted.length) {
      try { purgeStaleClipsEverywhere({ manifest: state.manifest, activeWords: words, expectedVoiceId: opts.expectedVoiceId }); } catch (eP) {}
      report = validatePackClips(state.manifest, words, opts.expectedVoiceId);
      auto = true;
    }
    var missing = report.missingWords.length;
    var staleHit = report.voiceMismatch.length > 0 || report.stale.length > 0;
    var level = 'ok';
    if (staleHit) level = 'stale';
    else if (missing >= total) level = 'missing_all';
    else if (missing > 0) level = 'missing_partial';
    /* v0.0.7.a A5 — JUST-PUBLISHED TRUST LAW: an audit that runs in the
       same tick as a successful publish (opts.justPublished) reflects the
       just-injected pack, so any residual "missing" belongs to genuinely
       new words (never a stale-cache illusion) and never auto-notifies —
       the lecturer just published; an alert about the publish they made
       is the false alarm this release removes. The banner still speaks,
       but only when clips are truly absent from the fresh pack. */
    if (opts.justPublished && level !== 'ok') {
      return { level: level, ready: report.readyWords, missing: missing, total: total, report: report, bannerShown: false, autoPurged: auto, justPublished: true };
    }
    var banner = paintVoiceClipGuardBanner(level, missing, total, report);
    /* once per session: auto-notify the lecturer when clips are degraded
       (v0.0.7.a A5: never inside a just-published cycle). */
    if ((staleHit || missing > 0) && !state.voiceGuardAlertSent && (opts.autoNotify !== false) && !opts.justPublished) {
      state.voiceGuardAlertSent = true;
      try {
        if (SDP.Telemetry && SDP.Telemetry.sendLecturerAlert) {
          SDP.Telemetry.sendLecturerAlert({
            alertType: staleHit ? 'stale_clips' : 'missing_clips',
            missingWords: report.missingWords.slice(0, 30),
            staleKeys: report.voiceMismatch.concat(report.stale).slice(0, 30),
            readyCount: report.readyWords,
            wordsRev: Number((state.manifest && state.manifest.wordsRev) || 0),
            message: 'Auto: ' + (staleHit ? 'stale/mismatched voice clips detected' : 'voice clips missing') + ' (' + report.readyWords + '/' + total + ' ready)'
          });
        }
      } catch (eT) {}
    }
    return { level: level, ready: report.readyWords, missing: missing, total: total, report: report, bannerShown: banner, autoPurged: auto };
  }
  /* The single shared #sdpVoiceClipGuardBanner — bilingual, always rendered
     into BOTH the Player and the Words screen. */
  function paintVoiceClipGuardBanner(level, missing, total, report) {
    if (!doc || !doc.getElementById) return false;
    var host = doc.getElementById('sdpVoiceClipGuardBanner');
    if (!host) return false;
    var stateTxt = '', siTxt = '', mode = level;
    if (level === 'stale') {
      mode = 'stale';
      stateTxt = 'Old voice clips were detected in cache. Tap Purge & Refresh now.';
      siTxt = 'පැරණි හඬ පට හමු විය! නිවැරදි හඬ පට ලබා ගැනීමට දැන්ම Purge & Refresh ඔබන්න.';
    } else if (level === 'missing_all' || level === 'missing_partial') {
      mode = 'missing';
      stateTxt = 'Voice clips are missing for ' + missing + ' of ' + total + ' words. Dictation is running in clip-free backup mode (British RP voice).';
      siTxt = 'වචන සඳහා හඬ පට තවම ජනනය කර නැත (' + (total - missing) + '/' + total + ' Ready)! දැනට තාවකාලික හඬ (Backup Voice) භාවිත වේ. Lecturer Studio හරහා හඬ පට ජනනය කරන්න නැතහොත් Admin දැනුවත් කරන්න.';
    } else {
      host.hidden = true;
      host.removeAttribute('data-level');
      return false;
    }
    var staleKeys = report && report.voiceMismatch ? report.voiceMismatch.length : 0;
    host.setAttribute('data-level', mode);
    host.setAttribute('role', 'alert');
    host.hidden = false;
    host.innerHTML =
      '<div class="vgb-head"><span class="vgb-icon" aria-hidden="true">⚠️</span>' +
      '<strong>' + (mode === 'stale' ? 'Stale Voice Clips Detected' : 'Voice Clips Missing (' + (total - missing) + '/' + total + ' Ready)') + '</strong></div>' +
      '<p class="vgb-si" lang="si">' + escSi(siTxt) + '</p>' +
      '<p class="vgb-en">' + escSi(stateTxt) + '</p>' +
      (staleKeys ? '<p class="vgb-detail">' + staleKeys + ' mismatched/stale clip(s) in local cache.</p>' : '') +
      '<div class="vgb-actions">' +
      (mode === 'stale' ? '<button type="button" class="btn btn-primary" id="btnGuardPurgeRefresh">🔄 Purge Old Clips &amp; Refresh Now</button>' : '') +
      (mode === 'missing' ? '<button type="button" class="btn btn-primary" id="btnGuardOpenStudio">⚡ Generate Missing Clips in Studio</button>' : '') +
      '<button type="button" class="btn btn-ghost" id="btnGuardNotifyAdmin">📨 Notify Lecturer / Admin</button>' +
      '<button type="button" class="vgb-close" id="btnGuardDismiss" aria-label="Dismiss">✕</button>' +
      '</div>';
    return true;
  }
  function escSi(s) { return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function bindVoiceGuardBanner(root) {
    if (!doc || !doc.addEventListener) return false;
    var host = (root && root.addEventListener) ? root : doc;
    if (host._sdpVoiceGuardBound) return false;
    host._sdpVoiceGuardBound = true;
    host.addEventListener('click', function (ev) {
      var t = ev && ev.target;
      while (t && t !== host) {
        if (t.id === 'btnGuardPurgeRefresh') {
          ev.preventDefault();
          try { if (SDP.Speech && SDP.Speech.guardPurgeAndRefresh) SDP.Speech.guardPurgeAndRefresh(); } catch (e1) {}
          return;
        }
        if (t.id === 'btnGuardNotifyAdmin') {
          ev.preventDefault();
          try { if (SDP.Speech && SDP.Speech.guardNotifyAdmin) SDP.Speech.guardNotifyAdmin(); } catch (e2) {}
          return;
        }
        if (t.id === 'btnGuardOpenStudio') {
          ev.preventDefault();
          try {
            if (SDP.Views && SDP.Views.showTab) SDP.Views.showTab('studio');
            else if (SDP.Studio && SDP.Studio.mount) SDP.Studio.mount();
          } catch (e3) {}
          return;
        }
        if (t.id === 'btnGuardDismiss') {
          ev.preventDefault();
          var b = doc.getElementById('sdpVoiceClipGuardBanner');
          if (b) b.hidden = true;
          return;
        }
        t = t.parentNode;
      }
    }, false);
    return true;
  }
  /* 1-click Purge & Refresh: wipe every local audio pocket + pull the
     canonical pack from raw.githubusercontent.com + reload clean. */
  function guardPurgeAndRefresh() {
    try {
      if (global.caches && global.caches.keys) {
        global.caches.keys().then(function (names) {
          var keep = ['sdp-audio-clips', 'sdp-youdao-v1'], i, kills = [];
          for (i = 0; i < names.length; i++) if (names[i].indexOf('sdp-') === 0 && keep.indexOf(names[i]) < 0) kills.push(names[i]);
          return Promise.all(kills.map(function (n) { return caches.delete(n); }));
        }).catch(function () {});
      }
    } catch (eK) {}
    try {
      if (global.caches && global.caches['delete']) global.caches['delete']('sdp-audio-clips').catch(function () {});
    } catch (eC) {}
    try { if (state.manifest && isObj(state.manifest.clips)) state.manifest.clips = {}; } catch (eM) {}
    try { state.clipBase = {}; state.injectedClips = {}; } catch (eB) {}
    try {
      var qs = global.location && global.location.search ? global.location.search : '';
      if (qs.indexOf('voicepurge') >= 0) global.location.reload();
      else global.location.replace('./?voicepurge=' + nowMs());
    } catch (eR) { try { global.location.reload(); } catch (eR2) {} }
    return true;
  }
  function guardNotifyAdmin() {
    var words = [];
    try { if (SDP.Sync && SDP.Sync.words) words = SDP.Sync.words() || []; } catch (eW) {}
    var report = validatePackClips(state.manifest, words);
    var note = '';
    var inp = doc && doc.getElementById ? doc.getElementById('studentAlertNoteInput') : null;
    if (inp) note = str(inp.value || '');
    try {
      if (SDP.Telemetry && SDP.Telemetry.sendLecturerAlert) {
        SDP.Telemetry.sendLecturerAlert({
          alertType: (report.missingWords.length && !report.voiceMismatch.length && !report.stale.length) ? 'missing_clips' : (report.voiceMismatch.length || report.stale.length ? 'stale_clips' : 'user_message'),
          missingWords: report.missingWords.slice(0, 30),
          staleKeys: report.voiceMismatch.concat(report.stale).slice(0, 30),
          readyCount: report.readyWords,
          wordsRev: Number((state.manifest && state.manifest.wordsRev) || 0),
          message: note || ('Student report: ' + report.readyWords + '/' + (words.length || 30) + ' word clips ready')
        });
      }
    } catch (eT) {}
    var b = doc && doc.getElementById ? doc.getElementById('sdpVoiceClipGuardBanner') : null;
    if (b) {
      var confirmEl = doc.createElement('p');
      confirmEl.className = 'vgb-sent';
      confirmEl.textContent = '📨 Alert sent to the Lecturer/Admin. පණිවිඩය යවන ලදී.';
      var old = b.querySelector('.vgb-sent');
      if (old) old.parentNode.removeChild(old);
      b.appendChild(confirmEl);
    }
    return true;
  }

  var Speech = {
    state: state,
    normalizeInput: normalizeInput,
    say: say,
    stop: stopAll,
    playWord: playWord,
    playUrl: playUrl,
    testVoice: testVoice,
    resolveTiers: resolveTiers,
    playGuideStep: playGuideStep,
    guideClipUrl: guideClipUrl,
    sayCue: sayCue,
    cueDefaultText: cueDefaultText,
    lockSessionVoice: lockSessionVoice,
    endSessionVoice: endSessionVoice,
    selectProfessorVoice: selectProfessorVoice,
    pickVoice: pickVoice,
    warmProfessorVoice: warmProfessorVoice,
    voiceName: voiceName,
    /* v0.0.6.m: the deep British male narrator + Project Briefing steps. */
    pickMaleVoice: pickMaleVoice,
    maleVoiceName: maleVoiceName,
    playBriefingStep: playBriefingStep,
    briefingClipReady: briefingClipReady,
    preWarmBriefing: preWarmBriefing,
    lastTierId: function () { return str(state.lastTier); },
    briefingClipUrl: briefingClipUrl,
    clipCount: function () {
      return (state.manifest && isObj(state.manifest.clips)) ? Object.keys(state.manifest.clips).length : 0;
    },
    unlockAudio: unlockAudio,
    isUnlocked: isUnlocked,
    playableUrl: playableUrl,
    scoreVoice: scoreVoice,
    loadManifest: loadManifest,
    applyManifest: applyManifest,
    restoreLocalBriefingPack: restoreLocalBriefingPack,
    reloadManifest: reloadManifest,
    injectClips: injectClips,
    /* v0.0.7.a Pillar 2 (Y2): the strict anti-stale voice clip guard. */
    validatePackClips: validatePackClips,
    purgeStaleClipsEverywhere: purgeStaleClipsEverywhere,
    auditSessionVoiceReadiness: auditSessionVoiceReadiness,
    paintVoiceClipGuardBanner: paintVoiceClipGuardBanner,
    bindVoiceGuardBanner: bindVoiceGuardBanner,
    guardPurgeAndRefresh: guardPurgeAndRefresh,
    guardNotifyAdmin: guardNotifyAdmin,
    /* v0.0.6.o: the welcome stage primes THIS element inside the Continue
       click gesture (muted=false, volume=1.0) so autoplay is unlocked. */
    sharedAudioElement: function () { return sharedAudio(); },
    sharedAudio: sharedAudio,
    lastTier: function () { return state.lastTier; },
    lastTierName: lastTierName,
    /* v0.0.6.m FIX 3: the mic/audio-session recovery surface. */
    recoverAudioSession: recoverAudioSession,
    micReleased: micReleased,
    clipManifest: function () { return state.manifest; },
    activeUtter: function () { return state.activeUtter; },
    lastUtterances: function () { return state.lastUtterances.slice(); },
    isSpeaking: function () { return !!state.speaking; },
    /* D11: the real utter.onstart flag and the shared <audio> playing flag —
       the views guide watchdog checks these instead of state.speaking. */
    hasStarted: function () { return !!state.utterStarted; },
    isAudioPlaying: function () { return !!state.audioPlaying; },
    getVoicesSafe: getVoicesSafe,
    youdaoAudioUrl: youdaoAudioUrl,
    shortGuideLine: shortGuideLine,
    hasSynth: function () { return !!(global.speechSynthesis && global.SpeechSynthesisUtterance); }
  };

  /* ── module init: warm the voice, listen for updates, arm the gesture ── */
  (function initSpeech() {
    /* D-V2/D-V6: voices may arrive after load. Warm now, then on every
     * voiceschanged notification, then once more on the first real tap. */
    try { warmProfessorVoice(noop); } catch (e) {}
    try {
      var synth = global.speechSynthesis;
      if (synth && synth.addEventListener) {
        synth.addEventListener('voiceschanged', function () {
          if (state.sessionVoice) { state.voiceDirty = true; return; }
          cachedProfVoice = null;
          warmProfessorVoice(noop);
        }, false);
      } else if (synth && typeof synth.onvoiceschanged !== 'undefined') {
        synth.onvoiceschanged = function () {
          if (state.sessionVoice) { state.voiceDirty = true; return; }
          cachedProfVoice = null;
          warmProfessorVoice(noop);
        };
      }
    } catch (e) {}
    bindFirstGesture();
    /* D-V5: a freshly published Alice pack must be visible without a reload.
       SDP.Sync emits CustomEvents on `document` (non-bubbling), so listen
       there as well as on `window`. */
    var onUpdate = function (ev) {
      var detail = (ev && ev.detail) || {};
      var nextRev = Number(detail.syncRev || 0);
      if (state.manifest && nextRev && nextRev <= Number(state.manifestSyncRev || 0)) return;
      /* v0.0.6.q PILLAR 1: the manifest is NOT nulled — the zero-drop law
         keeps every committed clip playable while the fresh pack downloads;
         loadManifest(force) bypasses the cached copy and applyManifest()
         swaps the new pack in atomically once it has fully parsed. */
      state.manifestRequested = false;
      loadManifest(noop, true);
    };
    try { if (doc && doc.addEventListener) doc.addEventListener('sdp:update', onUpdate, false); } catch (e) {}
    try { if (global.addEventListener) global.addEventListener('sdp:update', onUpdate, false); } catch (e) {}
    /* v0.0.7.a Pillar 2 (Y2): arm the banner delegate once, run the first
       readiness audit as soon as the manifest lands (sdp:ready) and re-run
       it whenever the word list or the pack changes. The audit NEVER blocks
       playback — it only paints the bilingual warning banner. */
    bindVoiceGuardBanner(doc);
    var runGuardAudit = function () {
      try { auditSessionVoiceReadiness({}); } catch (eA) {}
    };
    try { if (doc && doc.addEventListener) doc.addEventListener('sdp:ready', runGuardAudit, false); } catch (eR) {}
    try { if (doc && doc.addEventListener) doc.addEventListener('sdp:update', runGuardAudit, false); } catch (eU) {}
  })();

  SDP.Speech = Speech;
})(typeof window !== 'undefined' ? window : this);
