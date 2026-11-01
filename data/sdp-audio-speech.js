/*! Smart Dictation Player — speech & audio pipeline (v0.0.1.a)
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
    lastTier: '',
    lastUtterances: [],
    speaking: false,
    queueId: 0,
    audioEl: null
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
      try { el.setAttribute('crossorigin', 'anonymous'); } catch (e) {}
      if (doc.body) doc.body.appendChild(el);
    }
    state.audioEl = el;
    return el;
  }

  function stopAll() {
    state.queueId += 1;
    state.speaking = false;
    try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) {}
    var el = state.audioEl || (doc && doc.getElementById ? doc.getElementById('sdpSharedAudio') : null);
    if (el) { try { el.pause(); } catch (e) {} }
  }

  /* ── browser voice selection (en-GB first) ──────────────────────────── */
  function pickVoice(lang) {
    var synth = global.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') return null;
    var voices = [];
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
    var i, v;
    var want = str(lang || 'en-GB').toLowerCase();
    var prefer = ['alice', 'serena', 'kate', 'google uk english female', 'female'];
    for (i = 0; i < prefer.length; i++) {
      for (var j = 0; j < voices.length; j++) {
        v = voices[j];
        if (!v || !v.lang) continue;
        if (str(v.lang).toLowerCase().replace('_', '-').indexOf('en') !== 0) continue;
        if (str(v.name).toLowerCase().indexOf(prefer[i]) >= 0) return v;
      }
    }
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      if (v && v.lang && str(v.lang).toLowerCase().replace('_', '-') === want) return v;
    }
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      if (v && v.lang && str(v.lang).toLowerCase().indexOf('en-gb') === 0) return v;
    }
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      if (v && v.lang && str(v.lang).toLowerCase().indexOf('en') === 0) return v;
    }
    return null;
  }

  function estimateMs(text) {
    /* Headless/test fallback: a believable speaking window, always bounded. */
    return Math.max(420, Math.min(9000, 62 * str(text).length));
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
    var rate = Math.min(1.2, Math.max(0.7, Number(opts.rate || conf.rate) || 0.95));
    var volume = Math.min(1, Math.max(0, opts.volume === undefined ? (isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) : Number(opts.volume)));
    var synth = global.speechSynthesis;
    var Utter = global.SpeechSynthesisUtterance;
    var at = 0;

    function next() {
      if (myId !== state.queueId) return;
      if (at >= queue.length) {
        state.speaking = false;
        cb(null);
        return;
      }
      var line = queue[at];
      at += 1;
      if (synth && Utter) {
        var utter = new Utter(line);
        utter.lang = opts.lang || 'en-GB';
        utter.rate = rate;
        utter.volume = volume;
        utter.pitch = 1;
        var voice = pickVoice(utter.lang);
        if (voice) utter.voice = voice;
        var advanced = false;
        var guard = global.setTimeout(function () {
          if (advanced || myId !== state.queueId) return;
          advanced = true;
          next();
        }, estimateMs(line) + 2200);
        utter.onend = function () {
          if (advanced) return;
          advanced = true;
          global.clearTimeout(guard);
          next();
        };
        utter.onerror = function () {
          if (advanced) return;
          advanced = true;
          global.clearTimeout(guard);
          next();
        };
        state.speaking = true;
        try { synth.speak(utter); } catch (e) { utter.onerror(); }
      } else {
        /* No speech engine (headless, tests, locked-down browsers): keep the
           rhythm with a bounded timer so callbacks always resolve. */
        state.speaking = true;
        global.setTimeout(next, estimateMs(line));
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
      el.src = url;
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
  function loadManifest(cb) {
    cb = cb || noop;
    if (state.manifest) { cb(null, state.manifest); return; }
    if (state.manifestRequested) { cb(null, null); return; }
    state.manifestRequested = true;
    if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return; }
    try {
      global.fetch('./data/elevenlabs-audio.json?t=' + nowMs(), { cache: 'no-store' })
        .then(function (res) { return res && res.ok ? res.json() : null; })
        .then(function (data) {
          state.manifest = data && isObj(data) ? data : { clips: {} };
          cb(null, state.manifest);
        }, function () { cb(new Error('manifest_failed')); });
    } catch (e) { cb(new Error('manifest_failed')); }
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

  /* Tier resolution is exposed so the audio audit can prove the order. */
  function resolveTiers(word) {
    var w = isObj(word) ? word : { w: word };
    var s = sync();
    var lecturer = s && s.getClipUrl ? str(s.getClipUrl(w)) : str(w.clipUrl);
    var eleven = clipFromManifest(w);
    var dictionary = str(w.audio);
    var tiers = [];
    var conf = settings();
    var source = str(conf.voiceSource || 'auto');
    if (lecturer) tiers.push({ tier: 'lecturer', url: lecturer });
    if (eleven && source !== 'device') tiers.push({ tier: 'eleven', url: eleven });
    if (dictionary && source !== 'device') tiers.push({ tier: 'dictionary', url: dictionary });
    tiers.push({ tier: 'tts', url: '' });
    return tiers;
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
        say([str(word && word.w ? word.w : word)], { rate: opts.rate, volume: opts.volume }, function () { cb(null); });
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

  /* Voice test: the whole sentence as a single utterance. */
  function testVoice(cb) {
    var conf = settings();
    say('This is Alice, ready for your CCBE B1 dictation session.', { rate: conf.rate, volume: conf.volume }, cb);
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
    loadManifest: loadManifest,
    pickVoice: pickVoice,
    sharedAudio: sharedAudio,
    lastTier: function () { return state.lastTier; },
    lastUtterances: function () { return state.lastUtterances.slice(); },
    isSpeaking: function () { return !!state.speaking; },
    hasSynth: function () { return !!(global.speechSynthesis && global.SpeechSynthesisUtterance); }
  };

  SDP.Speech = Speech;
})(typeof window !== 'undefined' ? window : this);
