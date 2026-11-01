/*! Smart Dictation Player — speech & audio pipeline (v0.0.1.c)
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

  /* ══ utterance text normaliser ═════════════════════════════════════════ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 — say() normalises first */
  function normalizeInput(input) {
    return Array.isArray(input) ? input.slice() : [String(input == null ? '' : input)];
  }

  var state = {
    manifest: null,
    manifestRequested: false,
    manifestRetryBound: false,
    lastTier: '',
    lastUtterances: [],
    speaking: false,
    queueId: 0,
    audioEl: null,
    /* VOX-01: the live utterance and queue live at MODULE scope. v0.0.1.c kept
       `var utter` inside next(), so Chrome's GC could collect the utterance
       mid-sentence and onend never fired — the queue froze for 30+ seconds. */
    activeUtter: null,
    activeQueue: null,
    activeIndex: 0,
    /* VOX-06: every concurrent selectProfessorVoice() caller waits here. */
    voiceWaiters: [],
    voiceResolved: false,
    /* VOX-03: the 10 s speechSynthesis.resume() keepalive. */
    keepAlive: null,
    /* VOX-09: Chrome drops a speak() issued in the same tick as cancel(). */
    lastCancelAt: 0
  };

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
  function stopAll() {
    state.queueId += 1;
    state.speaking = false;
    state.activeUtter = null;
    state.activeQueue = null;
    state.activeIndex = 0;
    state.lastCancelAt = nowMs();
    stopKeepAlive();
    try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) {}
    var el = state.audioEl || (doc && doc.getElementById ? doc.getElementById('sdpSharedAudio') : null);
    if (el) { try { el.pause(); } catch (e) {} }
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

  /* First-gesture unlock shared by every player surface (D-V6, R3). */
  var unlocked = false;
  function unlockAudio() {
    unlocked = true;
    try { if (global.speechSynthesis && global.speechSynthesis.resume) global.speechSynthesis.resume(); } catch (e) {}
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
     the old 62 ms estimate cut long lines off mid-word on real devices. */
  function estimateMs(text, rate) {
    var perChar = Number(rate) < 1 ? 85 : 65;
    return Math.max(2600, Math.round(str(text).length * perChar) + 2400);
  }

  /* ══ SDP.Speech.say — one utterance per array entry, never per character ══ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 say() normaliser */
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
    state.lastUtterances = queue.slice();
    if (!queue.length) { cb(null); return; }
    stopAll();
    var myId = ++state.queueId;
    var conf = settings();
    /* D-V4: voiceLock 'unified' is the shipped default and owns the whole
     * utterance, not just voiceSource === 'auto'. Every line then leaves with
     * the same British Female Professor persona:
     *   lang 'en-GB' · rate 0.92 (or the caller's explicit rate) · pitch 1.03.
     * 'custom' keeps the per-tier behaviour. */
    var locked = str(conf.voiceLock || 'unified') === 'unified';
    var rate = Math.min(1.2, Math.max(0.7, Number(opts.rate || (locked ? 0.92 : conf.rate)) || 0.95));
    var pitch = locked ? 1.03 : Number(opts.pitch || 1);
    var utterLang = locked ? 'en-GB' : str(opts.lang || 'en-GB');
    var volume = Math.min(1, Math.max(0, opts.volume === undefined ? (isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) : Number(opts.volume)));
    var synth = global.speechSynthesis;
    var Utter = global.SpeechSynthesisUtterance;
    var at = 0;

    function next() {
      if (myId !== state.queueId) return;
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
        /* D-V1/D-V2: cached professor voice, always female, always en-GB. */
        var voice = pickVoice(utterLang);
        if (voice) utter.voice = voice;
        var advanced = false;
        var guardExtended = false;
        var guardMs = estimateMs(line, rate);
        var guard = null;
        var armGuard = function (ms) {
          guard = global.setTimeout(function () {
            if (advanced || myId !== state.queueId) return;
            /* VOX-02: onend is the primary driver. The guard only fires when a
               platform silently swallows onend, and it extends exactly once
               while the engine still reports speech in flight. */
            if (synth && (synth.speaking || synth.pending) && !guardExtended) {
              guardExtended = true;
              armGuard(1800);
              return;
            }
            advanced = true;
            state.activeUtter = null;
            next();
          }, ms);
        };
        utter.onend = function () {
          if (advanced) return;
          advanced = true;
          global.clearTimeout(guard);
          /* VOX-01: release the module-scope reference only when done. */
          if (state.activeUtter === utter) state.activeUtter = null;
          next();
        };
        utter.onerror = function () {
          if (advanced) return;
          advanced = true;
          global.clearTimeout(guard);
          if (state.activeUtter === utter) state.activeUtter = null;
          next();
        };
        /* VOX-01: keep the utterance (and its queue) reachable until it ends. */
        state.activeUtter = utter;
        state.activeQueue = queue;
        state.activeIndex = at - 1;
        state.speaking = true;
        startKeepAlive();
        armGuard(guardMs);
        /* VOX-09: Chrome drops a speak() issued in the same tick as cancel(). */
        var sinceCancel = nowMs() - (Number(state.lastCancelAt) || 0);
        if (sinceCancel >= 0 && sinceCancel < 200) {
          global.setTimeout(function () {
            if (myId !== state.queueId) return;
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
    var el = sharedAudio();
    if (!el) { cb(new Error('no_audio_element')); return; }
    var conf = settings();
    var volume = Math.min(1, Math.max(0, opts.volume === undefined ? (isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) : Number(opts.volume)));
    var done = false;
    var timer = null;
    function finish(ok) {
      if (done) return;
      done = true;
      if (timer) global.clearTimeout(timer);
      cb(ok ? null : new Error('audio_failed'));
    }
    try {
      el.pause();
      /* D-M1: a data:audio/mpeg manifest entry becomes a cached Blob URL. */
      el.src = playableUrl(url);
      el.volume = volume;
      try { el.playbackRate = Math.min(1.2, Math.max(0.7, Number(opts.rate || conf.rate) || 1)); } catch (e) {}
      el.onended = function () { finish(true); };
      el.onerror = function () { finish(false); };
      var playing = el.play();
      if (playing && typeof playing.then === 'function') {
        playing.then(null, function () { finish(false); });
      }
    } catch (e) { finish(false); return; }
    /* Bounded: a broken URL must hand over to the next tier quickly. */
    timer = global.setTimeout(function () { finish(false); }, Number(opts.timeoutMs) || 12000);
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
      var blobUrl = global.URL.createObjectURL(new global.Blob([bytes], { type: 'audio/mpeg' }));
      /* Bounded memo: 40 clips is more than one class ever needs at once. */
      if (blobCount < 40) { blobUrls[u] = blobUrl; blobCount += 1; }
      return blobUrl;
    } catch (e) { return u; }
  }

  function loadManifest(cb, force) {
    cb = cb || noop;
    if (state.manifest && !force) { cb(null, state.manifest); return; }
    if (state.manifestRequested && !force) { cb(null, null); return; }
    state.manifestRequested = true;
    if (typeof global.fetch !== 'function') { state.manifestRequested = false; bindManifestRetry(); cb(new Error('no_fetch')); return; }
    try {
      global.fetch('./data/elevenlabs-audio.json?t=' + nowMs(), { cache: 'no-store' })
        .then(function (res) { return res && res.ok ? res.json() : null; })
        .then(function (data) {
          state.manifest = data && isObj(data) ? data : { clips: {} };
          state.manifestSyncRev = Number(state.manifest.syncRev || 0);
          cb(null, state.manifest);
        }, function () {
          /* SYNC-10: a failed manifest never blocks a later retry. */
          state.manifestRequested = false;
          bindManifestRetry();
          cb(new Error('manifest_failed'));
        });
    } catch (e) { state.manifestRequested = false; bindManifestRetry(); cb(new Error('manifest_failed')); }
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

  function clipFromManifest(word) {
    var clips = state.manifest && isObj(state.manifest.clips) ? state.manifest.clips : null;
    if (!clips) {
      var s = sync();
      var ses = s && s.state ? s.state.clips : null;
      if (s && ses) {
        var key = str(word && word.w).toLowerCase();
        if (key && ses[key]) return ses[key];
      }
      return '';
    }
    var k = str(word && word.w).toLowerCase();
    var entry = clips[k] || clips[str(word && word.i)] || null;
    if (typeof entry === 'string') return entry;
    if (entry && isObj(entry)) return str(entry.url || entry.src || entry.file || '');
    return '';
  }

  /* E3 / VOX-04: tier enforcement per voiceSource / voiceLock.
   * lecturer=[1]  alice=[2]  dictionary=[3]  professor TTS=[4]
   * voiceLock 'unified' (the shipped default) returns [1, 2, 4] ONLY: Tier 3
   * dict.youdao.com serves whichever voice it likes (often male, always
   * third-party), which broke the single 25–35 British female persona. Tier 3
   * survives only for an explicit voiceSource/voiceLock of 'custom'. */
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
    /* Lecturer clip -> ElevenLabs Alice clip -> (custom: dictionary) -> TTS. */
    if (lecturer) tiers.push({ tier: 'lecturer', url: lecturer });
    if (eleven) tiers.push({ tier: 'eleven', url: eleven });
    if (dictionary && !unified) tiers.push({ tier: 'dictionary', url: dictionary });
    tiers.push({ tier: 'tts', url: '' });
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
    var entry = clips['_guide_' + (Number(stepIdx) + 1)] || null;
    if (typeof entry === 'string') return str(entry);
    if (entry && isObj(entry)) return str(entry.url || entry.src || entry.file || '');
    return '';
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
    var clip = guideClipUrl(stepIdx);
    if (clip) {
      state.speaking = true;
      playUrl(playableUrl(clip), { rate: rate, volume: volume }, function (err) {
        state.speaking = false;
        if (!err) { cb(null); return; }
        /* A broken cached clip must still narrate the step. */
        say([stepText], { lang: 'en-GB', rate: rate, pitch: 1.03, volume: volume }, cb);
      });
      return true;
    }
    say([stepText], { lang: 'en-GB', rate: rate, pitch: o.pitch !== undefined ? o.pitch : 1.03, volume: volume }, cb);
    return false;
  }

  /* ══ SDP.Speech.playWord — 4-tier chain, bounded at every step ═════════ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 tier order */
  function playWord(word, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = opts || {};
    cb = cb || noop;
    var tiers = opts.tiers || resolveTiers(word);
    var at = 0;
    state.lastTier = '';
    function attempt() {
      if (at >= tiers.length) {
        state.lastTier = state.lastTier || 'tts';
        cb(null);
        return;
      }
      var current = tiers[at];
      at += 1;
      if (current.tier === 'tts') {
        state.lastTier = 'tts';
        /* E2 professor cadence for device/TTS speech. */
        say([str(word && word.w ? word.w : word)], { rate: 0.92, pitch: 1.03, volume: opts.volume }, function () { cb(null); });
        return;
      }
      playUrl(current.url, { rate: opts.rate, volume: opts.volume, timeoutMs: opts.timeoutMs }, function (err) {
        if (!err) {
          state.lastTier = current.tier;
          cb(null);
          return;
        }
        attempt();
      });
    }
    if (!opts.tiers && !state.manifest && !state.manifestRequested) {
      loadManifest(function () { attempt(); });
      return;
    }
    attempt();
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
    playWord(first, { volume: conf.volume }, function () {
      var tier = lastTierName();
      var spoken = str(first && first.w) || 'confident';
      say(['Professor voice ready · ' + spoken], { lang: 'en-GB', rate: 0.92, pitch: 1.03, volume: conf.volume }, function () {
        cb(null, { tier: tier, word: spoken });
      });
    });
    return true;
  }
  function lastTierName() {
    var names = { lecturer: 'Lecturer clip', eleven: 'Alice (ElevenLabs)', dictionary: 'Dictionary', tts: 'Professor voice' };
    return names[state.lastTier] || str(state.lastTier) || 'Professor voice';
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
    selectProfessorVoice: selectProfessorVoice,
    pickVoice: pickVoice,
    warmProfessorVoice: warmProfessorVoice,
    voiceName: voiceName,
    unlockAudio: unlockAudio,
    isUnlocked: isUnlocked,
    playableUrl: playableUrl,
    scoreVoice: scoreVoice,
    loadManifest: loadManifest,
    sharedAudio: sharedAudio,
    lastTier: function () { return state.lastTier; },
    lastTierName: lastTierName,
    activeUtter: function () { return state.activeUtter; },
    lastUtterances: function () { return state.lastUtterances.slice(); },
    isSpeaking: function () { return !!state.speaking; },
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
          cachedProfVoice = null;
          warmProfessorVoice(noop);
        }, false);
      } else if (synth && typeof synth.onvoiceschanged !== 'undefined') {
        synth.onvoiceschanged = function () {
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
      state.manifest = null;
      state.manifestRequested = false;
      loadManifest(noop, true);
    };
    try { if (doc && doc.addEventListener) doc.addEventListener('sdp:update', onUpdate, false); } catch (e) {}
    try { if (global.addEventListener) global.addEventListener('sdp:update', onUpdate, false); } catch (e) {}
  })();

  SDP.Speech = Speech;
})(typeof window !== 'undefined' ? window : this);
