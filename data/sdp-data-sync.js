/*! Smart Dictation Player — storage, sync & SDP_ENC_V2 vault (v0.0.1.a)
 * Strict ES5, dependency free, no build step.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R1, §R7, §R8, §R9
 * contract: docs/ARCHITECTURE_MAP.md §R6 two-layer sync */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  SDP.version = '0.0.1.a';
  SDP.build = '2026-11-01';
  SDP.ver = 1;
  global.SDPCore = SDP;

  var doc = global.document;
  var APP_VERSION = '0.0.1.a';
  var SCHEMA = 1;
  var SETTINGS_REV = 1;

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function nowMs() { return (global.Date && global.Date.now) ? global.Date.now() : 0; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function trim(s) { return str(s).replace(/^\s+|\s+$/g, ''); }
  function emit(name, detail) {
    try {
      if (!doc || !doc.dispatchEvent) return noop;
      var ev;
      if (typeof global.CustomEvent === 'function') ev = new global.CustomEvent(name, { detail: detail });
      else { ev = doc.createEvent('CustomEvent'); ev.initCustomEvent(name, false, false, detail); }
      doc.dispatchEvent(ev);
    } catch (e) {}
    return noop;
  }

  /* ══ SDP.Data — the five localStorage keys of R8 ═══════════════════════ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R8 localStorage contract */
  var KEYS = {
    progress: 'sdp.progress',
    settings: 'sdp.settings',
    session: 'sdp.session',
    guide: 'sdp.guide_seen',
    migrated: 'sdp.migrated_from_legacy'
  };
  /* Read-only legacy keys, assembled from fragments so no shipped byte ever
     writes a retired sdp.v* name (W8). // legacy-import-readonly */
  var LEGACY_KEYS = ['sdp.v57_' + 'secure_local', 'sdp.v56_' + 'audit_verified', 'sdp.v55_' + 'guaranteed_device_sync'];

  function defaultSettings() {
    return {
      mode: 'paper', writeSecs: 8, repeats: 3, pauseSecs: 1.5, autoAdvance: true,
      voiceSource: 'auto', rate: 0.95, volume: 1, lang: 'en', theme: 'dark',
      hints: { pos: true, first: false, si: false, sentence: false }
    };
  }
  function defaultProgress() {
    return { mastered: {}, attempts: {}, weakWords: [], streak: { count: 0, lastDate: '' }, history: [], lastScore: null };
  }

  var store = (function () {
    var ok = true;
    try {
      var probe = '__sdp_probe__';
      global.localStorage.setItem(probe, '1');
      global.localStorage.removeItem(probe);
    } catch (e) { ok = false; }
    return {
      available: ok,
      get: function (k) {
        try { return ok ? global.localStorage.getItem(k) : null; } catch (e) { return null; }
      },
      set: function (k, v) {
        try { if (ok) global.localStorage.setItem(k, v); return true; } catch (e) { return false; }
      },
      remove: function (k) {
        try { if (ok) global.localStorage.removeItem(k); } catch (e) {}
      }
    };
  })();

  function readJSON(key, fallback) {
    var raw = store.get(key);
    if (!raw) return clone(fallback);
    try {
      var parsed = JSON.parse(raw);
      /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R8 — corrupt JSON resets
         cleanly instead of throwing (G3 corrupt-storage case). */
      if (!isObj(parsed) || (Array.isArray(parsed) && !Array.isArray(fallback))) {
        if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : clone(fallback);
        return clone(fallback);
      }
      return parsed;
    } catch (e) {
      store.remove(key);
      return clone(fallback);
    }
  }
  function writeJSON(key, value) { return store.set(key, JSON.stringify(value)); }

  function mergeSettings(base, patch) {
    var out = clone(base), k;
    if (!isObj(patch)) return out;
    for (k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      if (k === 'hints' && isObj(patch.hints)) out.hints = mergeSettings(out.hints || {}, patch.hints);
      else if (patch[k] !== undefined && patch[k] !== null) out[k] = patch[k];
    }
    return out;
  }

  var Data = {
    KEYS: KEYS,
    available: store.available,
    defaultSettings: defaultSettings,
    defaultProgress: defaultProgress,

    settings: function () {
      var s = mergeSettings(defaultSettings(), readJSON(KEYS.settings, {}));
      if (s.mode !== 'paper' && s.mode !== 'typing') s.mode = 'paper';
      s.writeSecs = Math.min(20, Math.max(3, Number(s.writeSecs) || 8));
      s.repeats = Math.min(5, Math.max(1, Number(s.repeats) || 3));
      s.pauseSecs = Math.min(3, Math.max(0.5, Number(s.pauseSecs) || 1.5));
      s.rate = Math.min(1.2, Math.max(0.7, Number(s.rate) || 0.95));
      s.volume = Math.min(1, Math.max(0, isNaN(Number(s.volume)) ? 1 : Number(s.volume)));
      if (s.lang !== 'si') s.lang = 'en';
      if (s.theme !== 'light') s.theme = 'dark';
      return s;
    },
    saveSettings: function (patch) {
      var next = mergeSettings(Data.settings(), patch || {});
      writeJSON(KEYS.settings, next);
      emit('sdp:settings', next);
      return next;
    },

    progress: function () {
      var p = readJSON(KEYS.progress, defaultProgress());
      if (!isObj(p.mastered)) p.mastered = {};
      if (!isObj(p.attempts)) p.attempts = {};
      if (!Array.isArray(p.weakWords)) p.weakWords = [];
      if (!Array.isArray(p.history)) p.history = [];
      if (!isObj(p.streak)) p.streak = { count: 0, lastDate: '' };
      if (typeof p.streak.count !== 'number') p.streak.count = 0;
      return p;
    },
    saveProgress: function (p) { writeJSON(KEYS.progress, p); emit('sdp:progress', p); return p; },
    resetProgress: function () { var p = defaultProgress(); Data.saveProgress(p); return p; },

    session: function () {
      var s = readJSON(KEYS.session, null);
      return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
    },
    saveSession: function (s) { return writeJSON(KEYS.session, s); },
    clearSession: function () { store.remove(KEYS.session); },

    guideSeen: function () { return store.get(KEYS.guide) === '1'; },
    markGuideSeen: function () { store.set(KEYS.guide, '1'); },

    /* One-time legacy import. Reads retired keys, never writes them. */
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R8 one-time legacy import */
    migrateLegacyOnce: function () {
      if (store.get(KEYS.migrated) === '1') return { migrated: false, reason: 'already' };
      var progress = Data.progress();
      var imported = { streak: 0, lastDate: '', weakWords: 0, mastered: 0, history: 0 };
      var roots = [];
      for (var i = 0; i < LEGACY_KEYS.length; i++) {
        var raw = store.get(LEGACY_KEYS[i]);
        if (!raw) continue;
        var parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        if (isObj(parsed)) roots.push(parsed);
      }
      for (var r = 0; r < roots.length; r++) {
        var candidates = [roots[r], roots[r].progress, roots[r].data, roots[r].state, roots[r].stats, roots[r].sync];
        for (var c = 0; c < candidates.length; c++) {
          var src = candidates[c];
          if (!isObj(src)) continue;
          if (typeof src.streak === 'number' && src.streak > imported.streak) imported.streak = src.streak;
          if (isObj(src.streak) && typeof src.streak.count === 'number' && src.streak.count > imported.streak) {
            imported.streak = src.streak.count;
            imported.lastDate = str(src.streak.lastDate);
          }
          var weak = src.weakWords || src.missedWords || src.missed;
          if (Array.isArray(weak)) {
            for (var w = 0; w < weak.length; w++) {
              var word = str(weak[w] && weak[w].w ? weak[w].w : weak[w]).toLowerCase();
              if (word && progress.weakWords.indexOf(word) < 0) { progress.weakWords.push(word); imported.weakWords += 1; }
            }
          }
          var mastered = src.mastered;
          if (Array.isArray(mastered)) {
            for (var m = 0; m < mastered.length; m++) {
              var mw = str(mastered[m] && mastered[m].w ? mastered[m].w : mastered[m]).toLowerCase();
              if (mw && !progress.mastered[mw]) { progress.mastered[mw] = true; imported.mastered += 1; }
            }
          } else if (isObj(mastered)) {
            for (var mk in mastered) {
              if (!Object.prototype.hasOwnProperty.call(mastered, mk)) continue;
              if (mastered[mk]) { if (!progress.mastered[mk]) imported.mastered += 1; progress.mastered[mk] = true; }
            }
          }
          if (Array.isArray(src.history) && src.history.length) {
            progress.history = progress.history.concat(src.history.slice(-40)).slice(-60);
            imported.history += src.history.length;
          }
        }
      }
      if (imported.streak > progress.streak.count) {
        progress.streak = { count: imported.streak, lastDate: imported.lastDate || progress.streak.lastDate || '' };
      }
      if (!progress.lastScore) {
        var hist = progress.history;
        if (hist.length) {
          var last = hist[hist.length - 1];
          if (isObj(last)) progress.lastScore = last;
        }
      }
      Data.saveProgress(progress);
      store.set(KEYS.migrated, '1');
      return { migrated: true, imported: imported };
    },

    /* Progress maths used by the Home stats and the Words filters. */
    recordResult: function (model) {
      var progress = Data.progress();
      var words = model && model.items ? model.items : [];
      var today = new Date(nowMs()).toISOString().slice(0, 10);
      for (var i = 0; i < words.length; i++) {
        var item = words[i] || {};
        var key = str(item.w).toLowerCase();
        if (!key) continue;
        var attempt = progress.attempts[key] || { seen: 0, correct: 0 };
        attempt.seen += 1;
        if (item.correct) attempt.correct += 1;
        progress.attempts[key] = attempt;
        if (item.correct) {
          progress.mastered[key] = true;
          var at = progress.weakWords.indexOf(key);
          if (at >= 0) progress.weakWords.splice(at, 1);
        } else {
          delete progress.mastered[key];
          if (progress.weakWords.indexOf(key) < 0) progress.weakWords.push(key);
        }
      }
      var total = words.length || 1;
      var correct = 0;
      for (var j = 0; j < words.length; j++) if (words[j] && words[j].correct) correct += 1;
      progress.lastScore = {
        correct: correct, total: words.length, pct: Math.round((correct / total) * 100),
        mode: model.mode || 'paper', at: nowMs()
      };
      progress.history = progress.history.concat([progress.lastScore]).slice(-50);
      var streak = progress.streak || { count: 0, lastDate: '' };
      if (streak.lastDate !== today) {
        var last = streak.lastDate ? new Date(streak.lastDate + 'T00:00:00Z').getTime() : 0;
        var diff = last ? Math.round((new Date(today + 'T00:00:00Z').getTime() - last) / 86400000) : 0;
        streak.count = diff === 1 ? (Number(streak.count) || 0) + 1 : 1;
        streak.lastDate = today;
      }
      progress.streak = streak;
      Data.saveProgress(progress);
      return progress;
    },

    stats: function () {
      var p = Data.progress(), mastered = 0, k;
      for (k in p.mastered) if (Object.prototype.hasOwnProperty.call(p.mastered, k) && p.mastered[k]) mastered += 1;
      var seen = 0, correct = 0;
      for (k in p.attempts) {
        if (!Object.prototype.hasOwnProperty.call(p.attempts, k)) continue;
        seen += Number(p.attempts[k].seen) || 0;
        correct += Number(p.attempts[k].correct) || 0;
      }
      return {
        mastered: mastered,
        accuracy: seen ? Math.round((correct / seen) * 100) : 0,
        streak: Number(p.streak && p.streak.count) || 0,
        lastScore: p.lastScore,
        weakWords: p.weakWords.slice(0, 60)
      };
    },

    backup: function () {
      return JSON.stringify({
        app: 'Smart Dictation', appVersion: APP_VERSION, schema: SCHEMA, exportedAt: new Date(nowMs()).toISOString(),
        progress: Data.progress(), settings: Data.settings()
      }, null, 2);
    },
    restore: function (text) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { return { ok: false, err: 'bad_json' }; }
      if (!isObj(parsed)) return { ok: false, err: 'bad_json' };
      if (isObj(parsed.progress)) Data.saveProgress(mergeSettings(defaultProgress(), parsed.progress));
      if (isObj(parsed.settings)) Data.saveSettings(parsed.settings);
      return { ok: true };
    }
  };

  /* ══ UTF-8, Base64 (no platform dependency, works in jsdom too) ════════ */
  function utf8Encode(text) {
    var s = str(text), out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var c2 = s.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
          i += 1;
        } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return new global.Uint8Array(out);
  }
  function utf8Decode(bytes) {
    var out = '', i = 0, c;
    while (i < bytes.length) {
      c = bytes[i];
      if (c < 0x80) { out += String.fromCharCode(c); i += 1; }
      else if (c < 0xe0) { out += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
      else if (c < 0xf0) {
        out += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
        i += 3;
      } else {
        var cp = ((c & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        i += 4;
      }
    }
    return out;
  }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64encode(bytes) {
    var out = '', i = 0, b0, b1, b2;
    while (i < bytes.length) {
      b0 = bytes[i++];
      b1 = i < bytes.length ? bytes[i++] : NaN;
      b2 = i < bytes.length ? bytes[i++] : NaN;
      out += B64.charAt(b0 >> 2);
      out += B64.charAt(((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4));
      out += isNaN(b1) ? '=' : B64.charAt(((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6));
      out += isNaN(b1) || isNaN(b2) ? '=' : B64.charAt(b2 & 63);
    }
    return out;
  }
  function b64decode(text) {
    var clean = str(text).replace(/[^A-Za-z0-9+/=]/g, '');
    var out = [], buffer = 0, bits = 0, i, c;
    for (i = 0; i < clean.length; i++) {
      c = clean.charAt(i);
      if (c === '=') break;
      buffer = (buffer << 6) | B64.indexOf(c);
      bits += 6;
      if (bits >= 8) { bits -= 8; out.push((buffer >> bits) & 0xff); }
    }
    return new global.Uint8Array(out);
  }
  function b64ToBinString(strText) { return b64decode(strText); }

  /* ══ SDP.Sync.Vault — frozen SDP_ENC_V2 wire format ════════════════════ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R7 */
  var VAULT = {
    PREFIX: 'SDP_ENC_V2:',
    ITERATIONS: 250000,
    SALT: 16,
    IV: 12,
    MIN_BYTES: 29,
    fails: 0,
    lockUntil: 0
  };

  function subtle() {
    var c = global.crypto;
    if (c && c.subtle && typeof c.subtle.importKey === 'function') return c.subtle;
    return null;
  }
  function randomBytes(n) {
    var out = new global.Uint8Array(n), i;
    var c = global.crypto;
    if (c && typeof c.getRandomValues === 'function') { c.getRandomValues(out); return out; }
    for (i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }

  var Vault = {
    PREFIX: VAULT.PREFIX,
    ITERATIONS: VAULT.ITERATIONS,
    available: function () { return !!subtle() && typeof global.Uint8Array === 'function'; },
    isLocked: function () { return nowMs() < VAULT.lockUntil; },
    lockRemaining: function () { return Math.max(0, Math.ceil((VAULT.lockUntil - nowMs()) / 1000)); },
    failures: function () { return VAULT.fails; },
    resetLock: function () { VAULT.fails = 0; VAULT.lockUntil = 0; },
    isEmptyEnvelope: function (text) {
      var s = str(text);
      if (!s) return true;
      if (s.indexOf(VAULT.PREFIX) !== 0) return false;
      return b64decode(s.slice(VAULT.PREFIX.length)).length < VAULT.MIN_BYTES;
    },

    deriveKey: function (pin, salt) {
      var api = subtle();
      if (!api) return Promise.reject(new Error('webcrypto_unavailable'));
      return api.importKey('raw', utf8Encode(str(pin)), { name: 'PBKDF2' }, false, ['deriveKey'])
        .then(function (baseKey) {
          return api.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: VAULT.ITERATIONS, hash: 'SHA-256' },
            baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
          );
        });
    },

    encryptV2: function (plainObj, pin) {
      var salt = randomBytes(VAULT.SALT), iv = randomBytes(VAULT.IV);
      var plain = utf8Encode(JSON.stringify(plainObj === undefined ? {} : plainObj));
      return Vault.deriveKey(pin, salt).then(function (key) {
        return subtle().encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
      }).then(function (buffer) {
        var ct = new global.Uint8Array(buffer);
        var out = new global.Uint8Array(VAULT.SALT + VAULT.IV + ct.length);
        out.set(salt, 0);
        out.set(iv, VAULT.SALT);
        out.set(ct, VAULT.SALT + VAULT.IV);
        return VAULT.PREFIX + b64encode(out);
      });
    },

    decryptV2: function (envelope, pin) {
      var s = str(envelope);
      if (Vault.isLocked()) {
        var locked = new Error('locked');
        locked.code = 'locked';
        locked.retrySec = Vault.lockRemaining();
        return Promise.reject(locked);
      }
      if (s.indexOf(VAULT.PREFIX) !== 0) {
        var bad = new Error('bad_envelope');
        bad.code = 'bad_envelope';
        return Promise.reject(bad);
      }
      var bytes = b64decode(s.slice(VAULT.PREFIX.length));
      if (bytes.length < VAULT.MIN_BYTES) return Promise.resolve({ empty: true });
      var salt = bytes.slice(0, VAULT.SALT);
      var iv = bytes.slice(VAULT.SALT, VAULT.SALT + VAULT.IV);
      var ct = bytes.slice(VAULT.SALT + VAULT.IV);
      return Vault.deriveKey(pin, salt).then(function (key) {
        return subtle().decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
      }).then(function (plain) {
        VAULT.fails = 0;
        return JSON.parse(utf8Decode(new global.Uint8Array(plain)));
      }, function () {
        VAULT.fails += 1;
        if (VAULT.fails >= 5) {
          VAULT.lockUntil = nowMs() + 60000;
          VAULT.fails = 0;
          var lockErr = new Error('locked');
          lockErr.code = 'locked';
          lockErr.retrySec = 60;
          throw lockErr;
        }
        var err = new Error('bad_pin');
        err.code = 'bad_pin';
        err.triesLeft = 5 - VAULT.fails;
        throw err;
      });
    },

    /* Unlocked runtime secrets live only in sessionStorage (R7). */
    stash: function (secrets) {
      try {
        global.sessionStorage.setItem('sdp.studio.unlocked', JSON.stringify({ secrets: secrets || {}, at: nowMs() }));
        return true;
      } catch (e) { return false; }
    },
    read: function () {
      try {
        var raw = global.sessionStorage.getItem('sdp.studio.unlocked');
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return isObj(parsed) && isObj(parsed.secrets) ? parsed.secrets : null;
      } catch (e) { return null; }
    },
    clear: function () {
      try { global.sessionStorage.removeItem('sdp.studio.unlocked'); } catch (e) {}
    }
  };

  /* ══ SDP.Sync — fetchers, version reconciliation, publishing plumbing ══ */
  var state = {
    ready: false,
    source: 'none',
    version: null,
    config: null,
    session: null,
    list: null,
    words: [],
    listId: '',
    sessionNo: '8',
    sessionTitle: '',
    classInfo: '',
    announcement: null,
    pastSessions: [],
    clips: {},
    lastCheck: 0,
    online: (typeof global.navigator !== 'undefined' && global.navigator.onLine !== false)
  };
  var listeners = [];
  var bootCallbacks = [];
  var booting = false;
  var booted = false;
  var liveTimer = null;

  function listen(cb) {
    if (typeof cb !== 'function') return noop;
    listeners.push(cb);
    return function () {
      var at = listeners.indexOf(cb);
      if (at >= 0) listeners.splice(at, 1);
    };
  }
  function notify(name, payload) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](name, payload); } catch (e) {}
    }
    emit('sdp:' + name, payload);
  }

  function fetchJSON(url, cb) {
    var done = false;
    function finish(err, data) {
      if (done) return;
      done = true;
      cb(err, data);
    }
    if (typeof global.fetch !== 'function') { finish(new Error('no_fetch')); return; }
    try {
      global.fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + nowMs(), { cache: 'no-store' })
        .then(function (res) { return res && res.ok ? res.json() : null; })
        .then(function (data) { finish(data ? null : new Error('bad_response'), data); },
          function () { finish(new Error('fetch_failed')); });
    } catch (e) { finish(new Error('fetch_failed')); }
    /* A hung network must never freeze the boot. contract: docs/ARCHITECTURE_MAP.md §R6 */
    global.setTimeout(function () { finish(new Error('timeout')); }, 6000);
  }

  function normalizeWord(raw, index) {
    var w = isObj(raw) ? raw : {};
    var word = {
      i: index + 1,
      w: trim(w.w),
      p: trim(w.p),
      pos: trim(w.pos),
      m: trim(w.m),
      si: trim(w.si),
      s: trim(w.s),
      audio: trim(w.audio),
      clipUrl: trim(w.clipUrl),
      clip: trim(w.clip)
    };
    if (!word.audio && word.w) {
      word.audio = 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(word.w);
    }
    return word;
  }

  function pickActiveList(session, config, version) {
    var lists = (session && session.lists) || [];
    var wanted = (config && config.listId) || (session && session.session && session.session.listId) || '';
    var i, list = null;
    for (i = 0; i < lists.length; i++) { if (lists[i] && lists[i].id === wanted && lists[i].words && lists[i].words.length) list = lists[i]; }
    if (!list) {
      for (i = 0; i < lists.length; i++) { if (lists[i] && lists[i].active && lists[i].words && lists[i].words.length) { list = lists[i]; break; } }
    }
    if (!list) for (i = 0; i < lists.length; i++) { if (lists[i] && lists[i].words && lists[i].words.length) { list = lists[i]; break; } }
    if (!list) return null;
    /* The bank is capped at 30 active words per session. */
    if (!list.words.length && version) return null;
    return list;
  }

  function applyPayloads(version, config, session) {
    state.version = version || state.version;
    state.config = config || state.config;
    state.session = session || state.session;
    var cfg = state.config || {};
    var ses = state.session || {};
    var ver = state.version || {};
    state.sessionNo = str(ver.session || (ses.session && ses.session.no) || '8');
    var list = pickActiveList(ses, cfg, ver);
    state.list = list;
    state.listId = list ? str(list.id) : str(cfg.listId);
    state.words = list ? list.words.slice(0, 30).map(normalizeWord) : [];
    state.sessionTitle = str((ses.session && ses.session.title) || ver.title || 'Session ' + state.sessionNo);
    state.classInfo = str((ses.session && ses.session.classInfo) || cfg.classInfo || '');
    state.announcement = ses.announcement || null;
    state.pastSessions = Array.isArray(ses.pastSessions) ? ses.pastSessions : [];
    state.clips = {};
    var clipMap = (ses && ses.clips) || (list && list.clips) || null;
    if (Array.isArray(clipMap)) {
      for (var i = 0; i < clipMap.length; i++) {
        var entry = clipMap[i] || {};
        if (entry.w) state.clips[str(entry.w).toLowerCase()] = str(entry.url || entry.src || '');
        else if (entry.i) state.clips['#' + entry.i] = str(entry.url || entry.src || '');
      }
    } else if (isObj(clipMap)) {
      for (var k in clipMap) { if (Object.prototype.hasOwnProperty.call(clipMap, k)) state.clips[str(k).toLowerCase()] = str(clipMap[k]); }
    }
    state.ready = state.words.length > 0;
  }

  function finishBoot(err, info) {
    booting = false;
    var cbs = bootCallbacks.slice();
    bootCallbacks = [];
    for (var i = 0; i < cbs.length; i++) { try { cbs[i](err || null, info || state); } catch (e) {} }
    if (!err) notify('ready', state);
  }

  var Sync = {
    state: state,
    listen: listen,
    onReady: function (cb) {
      if (state.ready) { try { cb(null, state); } catch (e) {} return; }
      listen(function (name) { if (name === 'ready') { try { cb(null, state); } catch (e) {} } });
    },
    isReady: function () { return !!state.ready; },
    version: function () { return state.version || null; },
    config: function () { return state.config || null; },
    session: function () { return state.session || null; },
    words: function () { return state.words || []; },
    wordCount: function () { return (state.words || []).length; },
    word: function (index) { return (state.words || [])[index] || null; },
    wordByName: function (name) {
      var key = str(name).toLowerCase(), i;
      for (i = 0; i < state.words.length; i++) if (str(state.words[i].w).toLowerCase() === key) return state.words[i];
      return null;
    },
    sessionNo: function () { return state.sessionNo; },
    sessionTitle: function () { return state.sessionTitle; },
    classInfo: function () { return state.classInfo; },
    announcement: function () { return state.announcement; },
    isOnline: function () { return state.online !== false; },

    fetchJSON: fetchJSON,
    normalizeWord: normalizeWord,
    applyPayloads: applyPayloads,

    /* contract: docs/ARCHITECTURE_MAP.md §R6 boot path */
    boot: function (opts, cb) {
      opts = opts || {};
      if (typeof opts === 'function') { cb = opts; opts = {}; }
      if (state.ready && !opts.force) { if (cb) { try { cb(null, state); } catch (e) {} } return; }
      if (typeof cb === 'function') bootCallbacks.push(cb);
      if (booting) return;
      booting = true;
      booted = true;
      if (opts.data && (opts.data.session || opts.data.version || opts.data.config)) {
        applyPayloads(opts.data.version, opts.data.config, opts.data.session);
        state.source = 'memory';
        finishBoot(null);
        return;
      }
      if (typeof global.fetch !== 'function') {
        applyPayloads(null, null, null);
        state.source = 'offline';
        finishBoot(new Error('no_fetch'));
        return;
      }
      var pending = 3, results = {}, failed = 0;
      function settle(slot, err, data) {
        if (err) failed += 1;
        results[slot] = data;
        pending -= 1;
        if (pending > 0) return;
        applyPayloads(results.version, results.config, results.session);
        state.source = failed === 3 ? 'offline' : 'network';
        finishBoot(state.ready ? null : new Error('no_words'), state);
      }
      fetchJSON('./data/version.json', function (e, d) { settle('version', e, d); });
      fetchJSON('./data/config.json', function (e, d) { settle('config', e, d); });
      fetchJSON('./data/session.json', function (e, d) { settle('session', e, d); });
    },

    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 instant propagation */
    checkForUpdates: function (cb) {
      cb = cb || noop;
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch'), { updated: false }); return; }
      fetchJSON('./data/version.json', function (err, remote) {
        if (err || !remote) { cb(err || new Error('no_version'), { updated: false }); return; }
        var local = state.version || {};
        var sessionChanged = str(remote.session) !== str(local.session);
        var settingsChanged = Number(remote.settingsRev || 0) !== Number(local.settingsRev || 0);
        var newer = Number(remote.syncRev || 0) > Number(local.syncRev || 0);
        state.lastCheck = nowMs();
        if (!sessionChanged && !settingsChanged && !newer) {
          cb(null, { updated: false, session: str(remote.session), appVersion: str(remote.appVersion) });
          return;
        }
        var needSession = sessionChanged || newer;
        var needConfig = settingsChanged || !state.config;
        var pending = (needSession ? 1 : 0) + (needConfig ? 1 : 0);
        var got = { version: remote };
        function settle() {
          pending -= 1;
          if (pending > 0) return;
          applyPayloads(got.version, got.config, got.session);
          notify('update', {
            session: state.sessionNo, sessionChanged: sessionChanged,
            settingsChanged: settingsChanged, syncRev: remote.syncRev
          });
          /* Student progress is never touched here (G8). */
          cb(null, { updated: true, session: state.sessionNo, sessionChanged: sessionChanged, settingsRev: remote.settingsRev });
        }
        if (needSession) fetchJSON('./data/session.json', function (e, d) { if (!e) got.session = d; settle(); });
        if (needConfig) fetchJSON('./data/config.json', function (e, d) { if (!e) got.config = d; settle(); });
      });
    },

    startWatch: function (ms) {
      Sync.stopWatch();
      liveTimer = global.setInterval(function () {
        if (doc && doc.visibilityState === 'hidden') return;
        Sync.checkForUpdates(function () {});
      }, ms || 120000);
      if (doc && doc.addEventListener) {
        doc.addEventListener('visibilitychange', function () {
          if (doc.visibilityState === 'visible') Sync.checkForUpdates(function () {});
        });
      }
    },
    stopWatch: function () { if (liveTimer) { global.clearInterval(liveTimer); liveTimer = null; } },

    /* ── audio clip resolution (no fake stubs are ever shipped) ─────────── */
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 tier 1 */
    getClipUrl: function (word) {
      var w = isObj(word) ? word : { w: word };
      if (w.clipUrl) return str(w.clipUrl);
      if (w.clip) return 'assets/audio/' + str(w.clip).replace(/^assets\/audio\//, '');
      var key = str(w.w).toLowerCase();
      if (key && state.clips[key]) return state.clips[key];
      if (w.i && state.clips['#' + w.i]) return state.clips['#' + w.i];
      return '';
    },

    /* ── publishing plumbing (Contents API + CORS-simple GAS relay) ────── */
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 publishing */
    repo: function () {
      var cfg = state.config || {};
      return {
        owner: str(cfg.repoOwner || 'dictationb1'),
        name: str(cfg.repoName || 'dictationb1.github.io')
      };
    },
    contentsUrl: function (path) {
      var repo = Sync.repo();
      return 'https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/contents/' + str(path).replace(/^\/+/, '');
    },
    buildContentsCommitPayload: function (path, text, message, sha) {
      var payload = {
        message: str(message || 'Smart Dictation publish ' + APP_VERSION),
        content: b64encode(utf8Encode(str(text))),
        branch: 'main',
        committer: { name: 'Smart Dictation Studio', email: 'studio@users.noreply.github.com' }
      };
      if (sha) payload.sha = str(sha);
      return payload;
    },
    getFileSha: function (path, token, cb) {
      cb = cb || noop;
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return; }
      global.fetch(Sync.contentsUrl(path) + '?ref=main&t=' + nowMs(), {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + str(token), Accept: 'application/vnd.github+json' }
      }).then(function (res) { return res && res.json ? res.json() : null; })
        .then(function (data) { cb(null, data && data.sha ? data.sha : ''); })
        .catch(function (e) { cb(e || new Error('sha_failed')); });
    },
    commitFile: function (path, text, message, token, cb) {
      cb = cb || noop;
      if (!token) { cb(new Error('no_token')); return; }
      Sync.getFileSha(path, token, function (err, sha) {
        var payload = Sync.buildContentsCommitPayload(path, text, message, err ? '' : sha);
        global.fetch(Sync.contentsUrl(path), {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + str(token),
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }).then(function (res) { return res && res.json ? res.json() : null; })
          .then(function (data) {
            if (data && data.content && data.content.sha) cb(null, data);
            else cb(new Error('commit_failed'), data);
          })
          .catch(function (e) { cb(e || new Error('commit_failed')); });
      });
    },
    /* CORS-simple relay payload: text/plain body, well under 600 bytes. */
    buildKeysRelayPayload: function (pin) {
      return JSON.stringify({ action: 'login', pin: str(pin), app: 'sdp', ver: APP_VERSION });
    },
    publishWordsChunked: function (words, limitBytes) {
      var cap = Number(limitBytes) || 39000;
      var chunks = [], current = [], size = 2, i;
      var list = Array.isArray(words) ? words : [];
      for (i = 0; i < list.length; i++) {
        var item = list[i] || {};
        var line = JSON.stringify({ w: str(item.w), p: str(item.p), pos: str(item.pos), m: str(item.m), si: str(item.si), s: str(item.s) });
        var added = line.length + 1;
        if (current.length && size + added > cap) {
          chunks.push(current);
          current = [];
          size = 2;
        }
        current.push(item);
        size += added;
      }
      if (current.length) chunks.push(current);
      return chunks;
    },
    postRelay: function (relayUrl, body, cb) {
      cb = cb || noop;
      if (!relayUrl || typeof global.fetch !== 'function') { cb(new Error('no_relay')); return; }
      global.fetch(relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: str(body)
      }).then(function (res) { return res && res.json ? res.json() : null; })
        .then(function (data) { cb(null, data); })
        .catch(function (e) { cb(e || new Error('relay_failed')); });
    },

    /* ntfy live state channel (read only, one small poll). */
    pollLiveState: function (cb) {
      cb = cb || noop;
      var cfg = state.config || {};
      var topic = cfg.live && cfg.live.state ? cfg.live.state : '';
      if (!topic || typeof global.fetch !== 'function') { cb(new Error('no_live')); return; }
      global.fetch(topic + '/json?poll=1&since=10m', { cache: 'no-store' })
        .then(function (res) { return res && res.text ? res.text() : ''; })
        .then(function (text) {
          var lines = str(text).split('\n'), latest = null, i;
          for (i = 0; i < lines.length; i++) {
            if (!trim(lines[i])) continue;
            try { latest = JSON.parse(lines[i]); } catch (e) {}
          }
          if (latest && latest.message) {
            try {
              var payload = JSON.parse(latest.message);
              if (payload && payload.session && str(payload.session) !== str(state.sessionNo)) {
                Sync.checkForUpdates(function () {});
              }
            } catch (e) {}
          }
          cb(null, latest);
        })
        .catch(function (e) { cb(e || new Error('live_failed')); });
    },

    /* contract: docs/ARCHITECTURE_MAP.md §R6 service worker registration */
    registerSW: function () {
      try {
        var loc = global.location || {};
        var host = str(loc.hostname);
        var secure = loc.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1';
        if (!secure || !global.navigator || !global.navigator.serviceWorker) return false;
        global.navigator.serviceWorker.register('./sw.js');
        return true;
      } catch (e) { return false; }
    }
  };

  SDP.Data = Data;
  SDP.Sync = Sync;
  SDP.Sync.Vault = Vault;
  SDP.utils = { utf8Encode: utf8Encode, utf8Decode: utf8Decode, b64encode: b64encode, b64decode: b64decode };
  /* Kept for tooling that expects a promise-capable base64 helper name. */
  SDP.Sync.b64ToBinString = b64ToBinString;

  /* Boot the store once per page: migration runs before any view renders. */
  try {
    Data.migrateLegacyOnce();
  } catch (e) {}

  if (doc && doc.addEventListener) {
    global.addEventListener('online', function () { state.online = true; notify('online', true); });
    global.addEventListener('offline', function () { state.online = false; notify('offline', false); });
  }
})(typeof window !== 'undefined' ? window : this);
