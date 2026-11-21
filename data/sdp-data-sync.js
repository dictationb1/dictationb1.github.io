/*! Smart Dictation Player — storage, sync & SDP_ENC_V2 vault (v0.0.2.a)
 * Strict ES5, dependency free, no build step.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R1, §R7, §R8, §R9
 * contract: docs/ARCHITECTURE_MAP.md §R6 two-layer sync */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  SDP.version = '0.0.7.e';
  SDP.build = '2026-11-21';
  SDP.ver = 45; /* v0.0.7.e */
  global.SDPCore = SDP;

  var doc = global.document;
  var APP_VERSION = '0.0.7.e'; /* v0.0.7.e */
  var SCHEMA = 42;
  var SETTINGS_REV = 78; /* v0.0.7.e */
  /* D1 guard: the in-session upgrade reload fires at most once per version. */
  var appVersionChanged = false;
  /* D5 guard: visibilitychange / focus are registered at most once per load. */
  var watchVisBound = false;
  var watchFocusBound = false;

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function nowMs() { return (global.Date && global.Date.now) ? global.Date.now() : 0; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function trim(s) { return str(s).replace(/^\s+|\s+$/g, ''); }
  function normClipKey(k) { return str(k).trim().toLowerCase().replace(/[.,!?;:]+$/, ''); }
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

  /* R1/R2 sub-keys: appliedSettingsRev, vaultLock, touchedKeys, cachedVault and
     cachedVaultSyncRev all live INSIDE sdp.settings so the five-key R8
     localStorage law stays 100% intact (W7). */
  function defaultSettings() {
    return {
      mode: 'paper', writeSecs: 5, repeats: 2, pauseSecs: 1.5, autoAdvance: true,
      voiceSource: 'auto', rate: 0.95, volume: 1, lang: 'en', theme: 'light',
      /* Start goes straight to the cockpit unless the lecturer opts the
         walkthrough in (guideAutoPlay: true); the boot guide is unaffected. */
      guideAutoPlay: false, pacingPreset: 'exam', voiceLock: 'unified',
      hints: { pos: true, first: false, si: false, sentence: false },
      /* D9 (v0.0.2.a): which screens already showed their amber STEP cue. It
         lives INSIDE sdp.settings, so the five-key localStorage law holds. */
      cuesSeen: {},
      appliedSettingsRev: 0,
      defaultsResetV001f: false,
      /* v0.0.6.c: one-time Light-Default upgrade flag (inside sdp.settings). */
      lightDefaultV6b: true,
      /* D5 (v0.0.1.h): Layer-1 — the encrypted vault backup and its PIN
         verifier live INSIDE sdp.settings.vaultLock (W4: still five keys). */
      vaultLock: {
        fails: 0, lockUntil: 0, strikes: 0, until: 0,
        encVault: '', pinVerifier: null, updatedAt: 0
      }
    };
  }
  /* The ten keys the lecturer's config.classSettings owns (R1). */
  var CLASS_SETTING_KEYS = [
    'mode', 'writeSecs', 'repeats', 'pauseSecs', 'autoAdvance',
    'pacingPreset', 'voiceLock', 'voiceSource', 'rate', 'theme'
  ];
  function defaultProgress() {
    return { mastered: {}, attempts: {}, weakWords: [], streak: { count: 0, lastDate: '' }, history: [], lastScore: null };
  }

  var store = (function () {
    var ok = true;
    /* Shape-only detection: the app never writes a probe key, so the five R8
       keys stay the only writes this module can ever make. */
    try {
      ok = !!(global.localStorage && typeof global.localStorage.getItem === 'function' &&
        typeof global.localStorage.setItem === 'function');
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

  /* D17: version.json carries `version` as a STRING ('0.0.1.e'); some older
     payloads nested an object. One shared parser keeps every reader honest. */
  function parseRemoteAppVer(v) {
    if (isObj(v)) return str(v.appVersion || (isObj(v.version) ? (v.version.appVersion || v.version.version) : v.version));
    return str(typeof v === 'string' ? v : '');
  }

  var Data = {
    KEYS: KEYS,
    available: store.available,
    defaultSettings: defaultSettings,
    defaultProgress: defaultProgress,

    settings: function () {
      var raw = readJSON(KEYS.settings, {});
      var s = mergeSettings(defaultSettings(), raw);
      if (s.mode !== 'paper' && s.mode !== 'typing') s.mode = 'paper';
      /* R3 / D9: writeSecs is the classroom writing window; older payloads
         named the same field intervalSec, so both are accepted (5 s default). */
      s.writeSecs = Math.min(20, Math.max(3, Number(s.writeSecs || s.intervalSec) || 5));
      s.repeats = Math.min(5, Math.max(1, Number(s.repeats) || 2));
      s.pauseSecs = Math.min(3, Math.max(0.5, Number(s.pauseSecs) || 1.5));
      s.rate = Math.min(1.2, Math.max(0.7, Number(s.rate) || 0.95));
      s.volume = Math.min(1, Math.max(0, isNaN(Number(s.volume)) ? 1 : Number(s.volume)));
      if (s.lang !== 'si') s.lang = 'en';
      /* D7 / R3: the one-time v0.0.1.e boot migration. Devices left on 'si' by
         an older release wake up in professional British English exactly once
         (langResetV001e lives INSIDE sdp.settings, never as a sixth R4 key);
         after it has run, a student's own EN | SI choice always wins. */
      if (s.langResetV001e !== true) {
        s.lang = 'en';
        s.langResetV001e = true;
        writeJSON(KEYS.settings, s);
      }
      /* R3 / D9: the one-time v0.0.1.f classroom-defaults migration. Every
         device that upgraded from 0.0.1.e wakes up on the agreed classroom
         pacing — EN · Fast Exam · 5 s write · 2 repeats · Unified British
         voice — exactly once. The flag lives INSIDE sdp.settings, so the
         five-key localStorage law (W4) is never broken by a sixth key. */
      if (s.defaultsResetV001f !== true) {
        s.lang = 'en';
        s.pacingPreset = 'exam';
        s.writeSecs = 5;
        s.repeats = 2;
        s.voiceLock = 'unified';
        s.defaultsResetV001f = true;
        if (!isObj(s.touchedKeys)) s.touchedKeys = {};
        delete s.touchedKeys.pacingPreset;
        delete s.touchedKeys.writeSecs;
        delete s.touchedKeys.repeats;
        delete s.touchedKeys.voiceLock;
        writeJSON(KEYS.settings, s);
      }
      /* D-UI3: 'board' is a real theme; v0.0.6.a heals an unknown value to
         the mandatory light default instead of dark. */
      if (s.theme !== 'dark' && s.theme !== 'board') s.theme = 'light';
      /* v0.0.6.b (S1): the one-time Light-Default upgrade, scope-safe. Only a
         legacy stored object (appliedSettingsRev 1–30) that the student never
         personalised (touchedKeys.theme absent) wakes up in the Daylight
         palette; every explicit Light/Dark/Board choice — a seeded
         sdp.settings, the board preset, #btnTheme or #setTheme — always wins.
         The flag lives INSIDE sdp.settings, so the five-key R8 law holds (W4). */
      if (raw.lightDefaultV6b !== true && Object.keys(raw).length > 0 &&
          Number(raw.appliedSettingsRev) > 0 && Number(raw.appliedSettingsRev) < 31 &&
          !(raw.touchedKeys && raw.touchedKeys.theme)) {
        s.theme = 'light';
        s.lightDefaultV6b = true;
        writeJSON(KEYS.settings, s);
      }
      s.lightDefaultV6b = true;
      /* R7: which settings the student changed by hand. A remote settingsRev
         bump overrides touchedKeys for the ten classroom keys (R1/SYNC-01). */
      if (!isObj(s.touchedKeys)) s.touchedKeys = {};
      /* D9: a malformed cuesSeen is healed to an empty map, never a sixth key. */
      if (!isObj(s.cuesSeen) || Array.isArray(s.cuesSeen)) s.cuesSeen = {};
      s.appliedSettingsRev = Math.max(0, Number(s.appliedSettingsRev) || 0);
      if (!isObj(s.vaultLock)) s.vaultLock = { fails: 0, lockUntil: 0, strikes: 0 };
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

    /* D3 / W7: sdp.guide_seen is a version stamp ("0.0.1.b"), not a boolean.
       The guide (re)opens whenever the stored stamp differs from APP_VERSION,
       so returning 0.0.1.a users with "1" stored see it again on upgrade. */
    getGuideSeenVersion: function () { return store.get(KEYS.guide) || ''; },
    isGuideSeen: function () { return store.get(KEYS.guide) === APP_VERSION; },
    guideSeen: function () { return store.get(KEYS.guide) === APP_VERSION; },
    markGuideSeen: function () { store.set(KEYS.guide, APP_VERSION); },

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
    MAX_FAILS: 5,
    LOCK_MS: 60000,
    HARD_LOCK_MS: 300000,
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

  /* SEC-04: the brute-force lockout lives inside sdp.settings.vaultLock, so
     reloading the page can never reset a 5-attempt / 60 s (or 300 s) timer. */
  function persistedVaultLock() {
    var out = { fails: 0, lockUntil: 0, strikes: 0, until: 0, encVault: '', pinVerifier: null, updatedAt: 0 };
    try {
      var s = Data.settings();
      var raw = isObj(s.vaultLock) ? s.vaultLock : {};
      out.fails = Math.max(0, Number(raw.fails) || 0);
      out.lockUntil = Math.max(0, Number(raw.lockUntil) || 0);
      out.strikes = Math.max(0, Number(raw.strikes) || 0);
      out.until = Math.max(0, Number(raw.until) || out.lockUntil);
      /* D5: the encrypted envelope + verifier must survive every lock write. */
      out.encVault = str(raw.encVault);
      out.pinVerifier = isObj(raw.pinVerifier) ? raw.pinVerifier : null;
      out.updatedAt = Math.max(0, Number(raw.updatedAt) || 0);
    } catch (e) {}
    if (out.fails > VAULT.fails) VAULT.fails = out.fails;
    if (out.lockUntil > VAULT.lockUntil) VAULT.lockUntil = out.lockUntil;
    if (out.fails < VAULT.fails) out.fails = VAULT.fails;
    if (out.lockUntil < VAULT.lockUntil) out.lockUntil = VAULT.lockUntil;
    return out;
  }
  function storeVaultLock(patch) {
    var lock = persistedVaultLock(), k;
    for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) lock[k] = patch[k];
    if (lock.until !== undefined) lock.until = Number(lock.lockUntil) || 0;
    VAULT.fails = Number(lock.fails) || 0;
    VAULT.lockUntil = Number(lock.lockUntil) || 0;
    try { Data.saveSettings({ vaultLock: lock }); } catch (e) {}
    return lock;
  }
  /* D8: boot-time self-heal — a released config.json that lost its envelope is
     repaired from the Layer-1 backup inside sdp.settings.vaultLock. */
  function healVaultFromLayerOne() {
    try {
      var lock = persistedVaultLock();
      var env = str(lock.encVault);
      if (env.indexOf('SDP_ENC_V2:') !== 0 || VAULT.isEmptyEnvelope(env)) return false;
      var cfg = state.config;
      if (!isObj(cfg)) return false;
      var cfgEnv = str(cfg.encVault);
      var realCfg = cfgEnv.indexOf('SDP_ENC_V2:') === 0 && !VAULT.isEmptyEnvelope(cfgEnv);
      var lockRev = Number(lock.updatedAt) || 0;
      var cfgRev = Number(cfg.syncRev || 0) || 0;
      if (realCfg && !(lockRev > cfgRev)) return false;
      cfg.encVault = env;
      if (isObj(lock.pinVerifier)) cfg.pinVerifier = lock.pinVerifier;
      try { Data.saveSettings({ cachedVault: env, cachedVaultSyncRev: lockRev || Date.now() }); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  function recordVaultFail() {
    var lock = persistedVaultLock();
    lock.fails = (Number(lock.fails) || 0) + 1;
    if (lock.fails >= VAULT.MAX_FAILS) {
      lock.strikes = (Number(lock.strikes) || 0) + 1;
      lock.fails = 0;
      lock.lockUntil = nowMs() + (lock.strikes >= 2 ? VAULT.HARD_LOCK_MS : VAULT.LOCK_MS);
    }
    storeVaultLock(lock);
    return lock;
  }
  function vaultLockNow() { return persistedVaultLock(); }

  /* SEC-03: PBKDF2-SHA256 pin verifier (250,000 iterations). The PIN itself
     never leaves the device; config.json only carries salt + derived hash. */
  function deriveVerifierHash(pin, saltB64, iterations) {
    var api = subtle();
    if (!api) return Promise.reject(new Error('webcrypto_unavailable'));
    var salt = b64decode(str(saltB64));
    var rounds = Number(iterations) || VAULT.ITERATIONS;
    return api.importKey('raw', utf8Encode(str(pin)), { name: 'PBKDF2' }, false, ['deriveBits'])
      .then(function (base) {
        return api.deriveBits({ name: 'PBKDF2', salt: salt, iterations: rounds, hash: 'SHA-256' }, base, 256);
      })
      .then(function (bits) { return b64encode(new global.Uint8Array(bits)); });
  }
  function constantTimeEqual(a, b) {
    var x = str(a), y = str(b);
    if (!x || !y || x.length !== y.length) return false;
    var diff = 0, i;
    for (i = 0; i < x.length; i++) diff |= (x.charCodeAt(i) ^ y.charCodeAt(i));
    return diff === 0;
  }

  var Vault = {
    PREFIX: VAULT.PREFIX,
    ITERATIONS: VAULT.ITERATIONS,
    available: function () { return !!subtle() && typeof global.Uint8Array === 'function'; },
    isLocked: function () { return nowMs() < persistedVaultLock().lockUntil; },
    lockRemaining: function () { return Math.max(0, Math.ceil((persistedVaultLock().lockUntil - nowMs()) / 1000)); },
    failures: function () { return persistedVaultLock().fails; },
    strikes: function () { return persistedVaultLock().strikes; },
    resetLock: function () {
      VAULT.fails = 0;
      VAULT.lockUntil = 0;
      return storeVaultLock({ fails: 0, lockUntil: 0, strikes: 0 });
    },
    recordFail: recordVaultFail,

    /* SEC-03: compute a { algo, iterations, salt, hash } verifier for a PIN. */
    computePinVerifier: function (pin, saltB64) {
      var salt = str(saltB64);
      var fresh = !salt;
      var saltBytes = fresh ? randomBytes(VAULT.SALT) : b64decode(salt);
      var saltOut = fresh ? b64encode(saltBytes) : salt;
      return deriveVerifierHash(pin, saltOut, VAULT.ITERATIONS).then(function (hash) {
        return { algo: 'PBKDF2-SHA256', iterations: VAULT.ITERATIONS, salt: saltOut, hash: hash };
      });
    },
    /* SEC-03 / SEC-04: constant-time verification; failures feed the lockout. */
    verifyPinVerifier: function (pin, verifier) {
      var v = isObj(verifier) ? verifier : null;
      if (!v || !str(v.salt) || !str(v.hash)) return Promise.resolve(false);
      if (Vault.isLocked()) {
        var locked = new Error('locked');
        locked.code = 'locked';
        locked.retrySec = Vault.lockRemaining();
        return Promise.reject(locked);
      }
      return deriveVerifierHash(pin, v.salt, Number(v.iterations) || VAULT.ITERATIONS).then(function (hash) {
        var ok = constantTimeEqual(hash, str(v.hash));
        if (ok) { Vault.resetLock(); return true; }
        var lock = recordVaultFail();
        if (lock.lockUntil > nowMs()) {
          var err = new Error('locked');
          err.code = 'locked';
          err.retrySec = Math.ceil((lock.lockUntil - nowMs()) / 1000);
          throw err;
        }
        var bad = new Error('bad_pin');
        bad.code = 'bad_pin';
        bad.triesLeft = Math.max(0, VAULT.MAX_FAILS - lock.fails);
        throw bad;
      }, function (e) { if (e && e.code) throw e; return false; });
    },

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
        Vault.resetLock();
        return JSON.parse(utf8Decode(new global.Uint8Array(plain)));
      }, function (e) {
        if (e && e.code === 'locked') throw e;
        /* SEC-04: the counter is persisted, so a reload cannot clear it. */
        var lock = recordVaultFail();
        if (lock.lockUntil > nowMs()) {
          var lockErr = new Error('locked');
          lockErr.code = 'locked';
          lockErr.retrySec = Math.ceil((lock.lockUntil - nowMs()) / 1000);
          throw lockErr;
        }
        var err = new Error('bad_pin');
        err.code = 'bad_pin';
        err.triesLeft = Math.max(0, VAULT.MAX_FAILS - lock.fails);
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

  /* ══ SDP.Diagnostics — v0.0.6.j Pillar 3: privacy-safe ring buffer ══════
   * Non-personal troubleshooting events (audio tier fallbacks, clip load
   * errors, pronunciation flags, session completion stats, viewport/device
   * responsiveness) and student reviews live in ONE bounded ring inside
   * sdp.settings — the five-key R8 law holds. Reviews are sealed with the
   * same SDP_ENC_V2 AES-GCM envelope as the vault, under a device-local
   * key, BEFORE they are ever stored: nothing readable ever hits disk. */
  var DIAG_MAX_RING = 160;
  var DIAG_MAX_REVIEWS = 40;
  var DIAG_SLOT = 'sdpDiag';
  var diagState = { loaded: false, ring: [], reviews: [], key: '', timer: 0, lastPersist: 0 };

  /* ══ v0.0.6.j Pillar 3: pure-ES5 CRC32/STORE .zip writer (no library) ══
   * The Studio diagnostics export builds a real standard .zip entirely
   * in-browser: table-driven CRC-32, STORE method (no compression), UTF-8
   * names and bodies — zero external bytes, no build step. */
  var CRC_TABLE = (function () {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32Bytes(bytes) {
    var c = 0xFFFFFFFF, i;
    for (i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zipUtf8(text) {
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
  function zipU16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
  function zipU32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }
  function zipStore(files) {
    /* files: [{name, text}] -> Uint8Array of a valid STORE-method .zip. */
    var locals = [], centrals = [], offset = 0, i, f, data, crc, nameB, local, central, out, at;
    for (i = 0; i < files.length; i++) {
      f = files[i];
      data = zipUtf8(f.text);
      crc = crc32Bytes(data);
      nameB = zipUtf8(str(f.name));
      local = [].concat(
        [0x50, 0x4B, 0x03, 0x04], zipU16(20), zipU16(0), zipU16(0), zipU16(0), zipU16(0),
        zipU32(crc), zipU32(data.length), zipU32(data.length), zipU16(nameB.length), zipU16(0), nameB, data);
      central = [].concat(
        [0x50, 0x4B, 0x01, 0x02], zipU16(20), zipU16(20), zipU16(0), zipU16(0), zipU16(0), zipU16(0),
        zipU32(crc), zipU32(data.length), zipU32(data.length), zipU16(nameB.length),
        zipU16(0), zipU16(0), zipU16(0), zipU16(0), zipU32(0), zipU32(offset), nameB);
      locals = locals.concat(local);
      centrals = centrals.concat(central);
      offset += local.length;
    }
    out = [].concat(locals, centrals,
      [0x50, 0x4B, 0x05, 0x06], zipU16(0), zipU16(0), zipU16(files.length), zipU16(files.length),
      zipU32(centrals.length), zipU32(offset), zipU16(0));
    var arr = new global.Array(out.length), j;
    for (j = 0; j < out.length; j++) arr[j] = out[j] & 0xFF;
    return new global.Uint8Array(arr);
  }

  function diagLoad() {
    if (diagState.loaded) return diagState;
    diagState.loaded = true;
    var s = Data.settings();
    var raw = isObj(s) ? s[DIAG_SLOT] : null;
    if (isObj(raw)) {
      diagState.ring = Array.isArray(raw.ring) ? raw.ring.slice(0, DIAG_MAX_RING) : [];
      diagState.reviews = Array.isArray(raw.reviews) ? raw.reviews.slice(0, DIAG_MAX_REVIEWS) : [];
      diagState.key = str(raw.k);
      diagState.lastUiSnapshot = isObj(raw.lastUiSnapshot) ? raw.lastUiSnapshot : null;
    }
    return diagState;
  }
  function diagPersistNow() {
    diagState.lastPersist = nowMs();
    if (diagState.timer) { global.clearTimeout(diagState.timer); diagState.timer = 0; }
    try {
      var patch = {};
      patch[DIAG_SLOT] = { ring: diagState.ring, reviews: diagState.reviews, k: diagState.key, lastUiSnapshot: diagState.lastUiSnapshot || null };
      Data.saveSettings(patch);
    } catch (e) {
      /* v0.0.6.m: a voice-note review can outgrow the localStorage quota —
         drop the OLDEST sealed reviews (never the ring) until it fits, so
         one large clip never wipes the whole diagnostics vault. */
      var guard = 0;
      while (diagState.reviews.length > 1 && guard < 40) {
        guard += 1;
        diagState.reviews = diagState.reviews.slice(1);
        try {
          var retry = {};
          retry[DIAG_SLOT] = { ring: diagState.ring, reviews: diagState.reviews, k: diagState.key, lastUiSnapshot: diagState.lastUiSnapshot || null };
          Data.saveSettings(retry);
          return;
        } catch (e2) {}
      }
    }
  }
  function diagPersistThrottled() {
    if (diagState.timer) return;
    diagState.timer = global.setTimeout(function () { diagState.timer = 0; diagPersistNow(); }, 3500);
  }
  function diagKey() {
    diagLoad();
    if (!diagState.key) {
      diagState.key = b64encode(randomBytes(24));
      diagPersistNow();
    }
    return diagState.key;
  }

  var Diagnostics = {
    MAX_RING: DIAG_MAX_RING,
    MAX_REVIEWS: DIAG_MAX_REVIEWS,
    log: function (kind, data) {
      try {
        diagLoad();
        diagState.ring.push({ k: str(kind), d: (data === undefined ? null : data), at: new Date().toISOString(), t: nowMs() });
        if (diagState.ring.length > DIAG_MAX_RING) diagState.ring = diagState.ring.slice(diagState.ring.length - DIAG_MAX_RING);
        diagPersistThrottled();
      } catch (e) {}
      return true;
    },
    captureReview: function (payload) {
      diagLoad();
      var envelopePromise;
      try {
        envelopePromise = Vault.encryptV2(payload === undefined ? {} : payload, diagKey());
      } catch (e) { envelopePromise = null; }
      if (!envelopePromise) return false;
      envelopePromise.then(function (envelope) {
        diagState.reviews.push(str(envelope));
        if (diagState.reviews.length > DIAG_MAX_REVIEWS) diagState.reviews = diagState.reviews.slice(diagState.reviews.length - DIAG_MAX_REVIEWS);
        diagState.ring.push({ k: 'review_captured', d: { encrypted: true }, at: new Date().toISOString(), t: nowMs() });
        diagPersistNow();
        /* v0.0.6.m FIX 4: guaranteed local + cloud persistence — the sealed
           envelope is ALSO pushed to the Apps Script cloud relay (when the
           creator configured one) so nothing is ever lost, even if the
           device later clears its storage. */
        try { Data.pushReviewEnvelope(str(envelope)); } catch (e0) {}
      }, function () {});
      return true;
    },
    reviewCount: function () { diagLoad(); return diagState.reviews.length; },
    reviewEnvelopes: function () { diagLoad(); return diagState.reviews.slice(); },
    decryptReviews: function () {
      diagLoad();
      var list = diagState.reviews, out = [];
      var chain = Promise.resolve();
      list.forEach(function (envelope) {
        chain = chain.then(function () {
          return Vault.decryptV2(envelope, diagState.key).then(function (obj) {
            out.push({ ok: true, review: obj });
          }, function (err) {
            out.push({ ok: false, error: str(err && err.message) });
          });
        });
      });
      return chain.then(function () { return out; });
    },
    ring: function () { diagLoad(); return diagState.ring.slice(); },
    summary: function () {
      diagLoad();
      var kinds = {}, i, first = '', last = '';
      for (i = 0; i < diagState.ring.length; i++) {
        var k = str(diagState.ring[i].k);
        kinds[k] = (kinds[k] || 0) + 1;
        if (!first) first = str(diagState.ring[i].at);
        last = str(diagState.ring[i].at);
      }
      var s = Data.settings();
      return {
        events: diagState.ring.length, reviews: diagState.reviews.length,
        kinds: kinds, firstAt: first, lastAt: last,
        viewport: { w: global.innerWidth || 0, h: global.innerHeight || 0 },
        appVersion: APP_VERSION, schema: SCHEMA, settingsRev: SETTINGS_REV,
        lang: isObj(s) ? str(s.lang) : 'en'
      };
    },
    /* ══ v0.0.6.m FIX 4: the automatic full UI + DOM + Cache + Audio
       snapshot. Captured and sealed (AES-GCM SDP_ENC_V2) inside every
       review — send AND skip — so the creator can inspect the exact screen
       geometry, cache state and audio pipeline at the moment the student
       sent the feedback. Privacy law: geometry and counters only, never
       input values or personal data. */
    captureFullUiSnapshot: function () {
      var snap = { takenAt: new Date().toISOString(), appVersion: APP_VERSION };
      /* ui — visual & DOM geometry state */
      var ui = { screen: '', viewport: {}, elements: {} };
      try {
        ui.screen = str(SDP.Views && SDP.Views.currentTab ? SDP.Views.currentTab() : (doc.querySelector && doc.querySelector('.screen.on') ? str(doc.querySelector('.screen.on').id) : ''));
      } catch (e0) {}
      try {
        ui.viewport = {
          w: global.innerWidth || 0, h: global.innerHeight || 0,
          dpr: global.devicePixelRatio || 1,
          overflowX: !!(doc.documentElement && global.innerWidth && doc.documentElement.scrollWidth > global.innerWidth)
        };
      } catch (e1) {}
      try {
        var s = Data.settings();
        ui.theme = isObj(s) ? str(s.theme) : 'light';
        ui.lang = isObj(s) ? str(s.lang) : 'en';
        ui.mode = isObj(s) ? str(s.mode) : '';
      } catch (e2) {}
      var RECT_IDS = ['appHeader', 'ringWrap', 'btnPlayPause', 'tabbar', 'briefingModal', 'reviewPopupCard'];
      for (var ri = 0; ri < RECT_IDS.length; ri++) {
        var id = RECT_IDS[ri], node = doc.getElementById ? doc.getElementById(id) : null;
        if (!node) { ui.elements[id] = { present: false }; continue; }
        var r = { present: true, hidden: !!node.hidden, visible: !!(node.offsetWidth || node.offsetHeight) };
        try {
          if (node.getBoundingClientRect) {
            var box = node.getBoundingClientRect();
            r.rect = { x: Math.round(box.left), y: Math.round(box.top), w: Math.round(box.width), h: Math.round(box.height) };
          }
        } catch (e3) {}
        ui.elements[id] = r;
      }
      snap.ui = ui;
      /* cache — service worker & storage health */
      var cache = { swActive: false, caches: {}, localStorage: {}, introPresent: false };
      try { cache.swActive = !!(global.navigator && global.navigator.serviceWorker && global.navigator.serviceWorker.controller); } catch (e4) {}
      try {
        if (global.caches && global.caches.keys) {
          var names = [];
          global.caches.keys().then(function (ks) {
            /* resolved later; the snapshot keeps the synchronous view */
          }, function () {});
        }
      } catch (e5) {}
      try {
        if (doc && doc.sdpCacheCounts) cache.caches = doc.sdpCacheCounts;
      } catch (e6) {}
      try {
        var counted = 0;
        for (var li = 0; li < global.localStorage.length && counted < 40; li++) {
          var lk = global.localStorage.key(li);
          var lv = '';
          try { lv = global.localStorage.getItem(lk) || ''; } catch (e7) {}
          cache.localStorage[str(lk)] = lv.length;
          counted += 1;
        }
      } catch (e8) {}
      try {
        cache.sessionRev = Number(Data.settings && Data.settings().sessionRev || 0) || 0;
      } catch (e9) {}
      try { cache.settingsRev = SETTINGS_REV; } catch (e10) {}
      try {
        var stg = Data.settings();
        cache.sessionRev = isObj(stg) ? Number(stg.sessionRev || 0) : 0;
        cache.settingsRev = isObj(stg) ? Number(stg.settingsRev || 0) || SETTINGS_REV : SETTINGS_REV;
      } catch (e11) {}
      try {
        cache.voicePackClipsCount = (SDP.Speech && SDP.Speech.clipCount) ? SDP.Speech.clipCount() : 0;
      } catch (e12) {}
      try {
        var man = SDP.Speech && SDP.Speech.clipManifest ? SDP.Speech.clipManifest() : null;
        cache.introPresent = !!(man && man.clips && (man.clips['_intro_male_1'] || man.clips['intro.en.0']));
      } catch (e13) {}
      snap.cache = cache;
      /* audio — speech & mic pipeline health */
      var audio = {};
      try { audio.lastTierName = (SDP.Speech && SDP.Speech.lastTierName) ? SDP.Speech.lastTierName() : ''; } catch (e14) {}
      try { audio.voicesCount = (SDP.Speech && SDP.Speech.getVoicesSafe) ? SDP.Speech.getVoicesSafe().length : (global.speechSynthesis ? (global.speechSynthesis.getVoices() || []).length : 0); } catch (e15) {}
      try { audio.micReleased = (SDP.Speech && SDP.Speech.micReleased) ? !!SDP.Speech.micReleased() : true; } catch (e16) {}
      var errs = [];
      try {
        var ring = Diagnostics.ring();
        for (var ei = ring.length - 1; ei >= 0 && errs.length < 10; ei--) {
          var ev = ring[ei];
          if (ev && (str(ev.k).indexOf('audio') === 0 || str(ev.k) === 'tier_fallback')) errs.push({ k: str(ev.k), d: ev.d, at: str(ev.at) });
        }
      } catch (e17) {}
      audio.recentAudioErrors = errs;
      snap.audio = audio;
      /* The captured snapshot also rides the settings-based diagnostics
         vault summary on the next summary() call. */
      diagState.lastUiSnapshot = snap;
      diagPersistThrottled();
      return snap;
    },
    lastUiSnapshot: function () { diagLoad(); return diagState.lastUiSnapshot || null; },
    sessionSnapshot: function () {
      var words = [];
      try { if (SDP.Sync && SDP.Sync.words) words = SDP.Sync.words(); } catch (e) {}
      var s = Data.settings();
      return {
        appVersion: APP_VERSION, takenAt: new Date().toISOString(),
        sessionNo: str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : ''),
        sessionTitle: str(SDP.Sync && SDP.Sync.sessionTitle ? SDP.Sync.sessionTitle() : ''),
        wordCount: words.length,
        words: words.map(function (w) { return { w: str(w.w), p: str(w.p), pos: str(w.pos), si: str(w.si) }; }),
        pacing: {
          mode: isObj(s) ? str(s.mode) : '', writeSecs: isObj(s) ? s.writeSecs : 0,
          repeats: isObj(s) ? s.repeats : 0, pauseSecs: isObj(s) ? s.pauseSecs : 0,
          rate: isObj(s) ? s.rate : 0, voiceLock: isObj(s) ? str(s.voiceLock) : ''
        }
      };
    },
    configSnapshot: function () {
      var clips = 0;
      try { if (SDP.Speech && SDP.Speech.clipCount) clips = SDP.Speech.clipCount(); } catch (e) {}
      return {
        appVersion: APP_VERSION, ver: SDP.ver, build: SDP.build,
        schema: SCHEMA, settingsRev: SETTINGS_REV, takenAt: new Date().toISOString(),
        voicePackClips: clips,
        online: !(typeof navigator !== 'undefined' && navigator.onLine === false),
        userAgent: str(global.navigator && global.navigator.userAgent).slice(0, 160)
      };
    },
    clearAll: function () {
      diagState.ring = []; diagState.reviews = [];
      diagPersistNow();
      return true;
    },
    /* The pure ES5 zip writer used by the Studio diagnostics export. */
    zipStore: zipStore,
    crc32Bytes: crc32Bytes,
    /* Assemble the six documented artifacts for the Studio .zip export. */
    buildDiagFiles: function () {
      var summary = Diagnostics.summary();
      var files = [
        { name: 'diagnostics-log.json', text: JSON.stringify({ appVersion: APP_VERSION, exportedAt: new Date().toISOString(), summary: summary, events: Diagnostics.ring() }, null, 2) },
        { name: 'session-snapshot.json', text: JSON.stringify(Diagnostics.sessionSnapshot(), null, 2) },
        { name: 'config-snapshot.json', text: JSON.stringify(Diagnostics.configSnapshot(), null, 2) }
      ];
      return Diagnostics.decryptReviews().then(function (list) {
        list = Array.isArray(list) ? list : [];
        /* v0.0.6.m Pillar 4: the dedicated session-authenticity artifact —
           every captured session with its Genuine / Rapid-Skip / Incomplete
           verdict, duration, completion and rapid-skip counts, plus the
           aggregate summary the Studio drawer shows. */
        var sessions = [], counts = { GENUINE_FULL: 0, RAPID_SKIP_SUSPECT: 0, PARTIAL_INCOMPLETE: 0 };
        list.forEach(function (row) {
          if (!row || !row.ok || !isObj(row.review)) return;
          var rv = row.review;
          var tel = isObj(rv.telemetry) ? rv.telemetry : null;
          if (tel && counts[str(tel.authenticityStatus)] !== undefined) counts[str(tel.authenticityStatus)] += 1;
          sessions.push({
            at: str(rv.at), skipped: !!rv.skipped, source: str(rv.source || ''),
            pills: Array.isArray(rv.pills) ? rv.pills.slice() : [],
            hasVoiceClip: !!(rv.voiceClip && str(rv.voiceClip.b64)),
            voiceSecs: rv.voiceClip ? Number(rv.voiceClip.secs) || 0 : 0,
            text: str(rv.text || ''),
            telemetry: tel
          });
        });
        files.push({ name: 'session-telemetry.json', text: JSON.stringify({
          note: 'Authenticity analysis of every captured session — sealed AES-GCM (SDP_ENC_V2) at capture; decrypted inside the unlocked Lecturer Studio.',
          appVersion: APP_VERSION,
          exportedAt: new Date().toISOString(),
          summary: { sessions: sessions.length, genuine: counts.GENUINE_FULL, rapidSkip: counts.RAPID_SKIP_SUSPECT, partial: counts.PARTIAL_INCOMPLETE },
          sessions: sessions
        }, null, 2) });
        files.push({ name: 'student-reviews.json', text: JSON.stringify({
          note: 'Decrypted inside the unlocked Lecturer Studio — AES-GCM (SDP_ENC_V2) at capture.',
          count: list.length, reviews: list
        }, null, 2) });
        /* v0.0.6.m FIX 4: the full UI + DOM + Cache + Audio snapshot artifact —
           every sealed review with its captured uiSnapshot, plus the device's
           latest snapshot, so the .zip carries the complete picture. */
        var snaps = [];
        list.forEach(function (row) {
          if (!row || !row.ok || !isObj(row.review)) return;
          if (isObj(row.review.uiSnapshot)) snaps.push({ at: str(row.review.at), source: str(row.review.source || ''), uiSnapshot: row.review.uiSnapshot });
        });
        files.push({ name: 'ui-snapshots.json', text: JSON.stringify({
          note: 'Full UI + DOM geometry + CacheStorage + audio-pipeline snapshot sealed inside every review (v0.0.6.m FIX 4). Privacy: geometry and counters only.',
          appVersion: APP_VERSION,
          exportedAt: new Date().toISOString(),
          count: snaps.length,
          latest: Diagnostics.lastUiSnapshot(),
          snapshots: snaps
        }, null, 2) });
        files.push({ name: 'README-DIAGNOSTICS.txt', text: Diagnostics.readmeText(summary) });
        return { files: files, summary: summary };
      });
    },
    readmeText: function (summary) {
      return 'SMART DICTATION PLAYER — DIAGNOSTICS & PROJECT ANALYSIS\r\n' +
        'Version: ' + APP_VERSION + ' · Exported: ' + new Date().toISOString() + '\r\n\r\n' +
        'WHAT IS IN THIS ARCHIVE\r\n' +
        '  diagnostics-log.json — every captured troubleshooting event (audio tier fallbacks,\r\n' +
        '      clip load errors, pronunciation flags, session completion stats, viewport and\r\n' +
        '      device responsiveness). Non-personal, privacy-safe, bounded ring buffer.\r\n' +
        '  student-reviews.json — post-session voice/text reviews, decrypted here inside the\r\n' +
        '      unlocked Lecturer Studio (AES-GCM end-to-end encrypted at capture).\r\n' +
        '  session-telemetry.json — the authenticity analysis of every captured session\r\n' +
        '      (GENUINE_FULL / RAPID_SKIP_SUSPECT / PARTIAL_INCOMPLETE with duration,\r\n' +
        '      words completed, rapid-skip counts and marked words), captured on BOTH\r\n' +
        '      "Send Review" and "Skip — No Thanks".\r\n' +
        '  session-snapshot.json — the current 30 classroom words and pacing.\r\n' +
        '  config-snapshot.json — version, schema, voice pack and device state (no secrets).\r\n\r\n' +
        'SUMMARY\r\n' +
        '  Diagnostic events: ' + summary.events + '\r\n' +
        '  Encrypted student reviews: ' + summary.reviews + '\r\n' +
        '  First event: ' + (summary.firstAt || '—') + '\r\n' +
        '  Last event: ' + (summary.lastAt || '—') + '\r\n\r\n' +
        'PRIVACY\r\n' +
        '  Reviews were encrypted on the student device before storage; keys, PINs and\r\n' +
        '  personal identifiers are never written to this archive.\r\n' +
        '  — Hansana, creator of Smart Dictation Player (github.com/dictationb1)\r\n';
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
    /* D15/D17 (v0.0.1.h): the syncRev of the session.json actually adopted, and
       the retry flag for a publish whose session leg could not be delivered. */
    sessionRev: 0,
    deferredSession: false,
    online: (typeof global.navigator !== 'undefined' && global.navigator.onLine !== false)
  };
  var listeners = [];
  /* v0.0.6.z Pillar 4 (Y4): the reactive change bus (emitChange/onChange). */
  var changeListeners = [];
  var bootCallbacks = [];
  var booting = false;
  var booted = false;
  var liveTimer = null;

  /* ══ D1 / D2: verified payload adoption (v0.0.1.f) ════════════════════
   * A fetched payload is only usable for a sync tick when it proves it was
   * built for the pointer we are adopting: its own syncRev must be >= the
   * winning version.json syncRev. The checked-in data/session.json is a
   * preserved classroom payload whose own syncRev predates the pointer, so a
   * session is also accepted when it is the SAME session number as the winner
   * and still carries a full 30-word baseline. Anything else is stale. */
  function payloadWords(payload) {
    if (!isObj(payload)) return [];
    var lists = payload.lists, words = [], i;
    if (Array.isArray(lists)) {
      for (i = 0; i < lists.length; i++) {
        var list = lists[i] || {};
        if (list.active && Array.isArray(list.words) && list.words.length) { words = list.words; break; }
      }
      if (!words.length) {
        for (i = 0; i < lists.length; i++) {
          if (isObj(lists[i]) && Array.isArray(lists[i].words) && lists[i].words.length) { words = lists[i].words; break; }
        }
      }
    }
    if (!words.length && Array.isArray(payload.words)) words = payload.words;
    return words;
  }
  function payloadSessionNo(payload) {
    if (!isObj(payload)) return '';
    if (isObj(payload.session) && payload.session.no !== undefined) return str(payload.session.no);
    return str(payload.session || payload.sessionNo || '');
  }
  /* The active list of a session payload, or null. */
  function activeListOf(payload) {
    var lists = isObj(payload) && Array.isArray(payload.lists) ? payload.lists : [];
    var i, list = null;
    for (i = 0; i < lists.length; i++) {
      if (isObj(lists[i]) && lists[i].active && Array.isArray(lists[i].words) && lists[i].words.length) { list = lists[i]; break; }
    }
    if (!list) {
      for (i = 0; i < lists.length; i++) {
        if (isObj(lists[i]) && Array.isArray(lists[i].words) && lists[i].words.length) { list = lists[i]; break; }
      }
    }
    return list;
  }
  /* D16: is this session payload the very list already adopted? */
  function sameActiveList(payload) {
    try {
      var curList = state.list, nextList = activeListOf(payload);
      if (!isObj(curList) || !isObj(nextList)) return false;
      if (str(curList.id) !== str(nextList.id)) return false;
      var curLen = Array.isArray(curList.words) ? curList.words.length : 0;
      var nextLen = Array.isArray(nextList.words) ? nextList.words.length : 0;
      if (curLen !== nextLen) return false;
      return str(curList.updatedAt) === str(nextList.updatedAt);
    } catch (e) { return false; }
  }
  function verifyPayloadLeg(payload, kind, targetSyncRev, remoteVersion) {
    if (!isObj(payload)) return false;
    var target = Number(targetSyncRev) || 0;
    var rev = Number(payload.syncRev);
    if (!isNaN(rev) && rev >= target) return true;
    if (kind !== 'session') return false;
    /* D16 (v0.0.1.h): a settings-only or keys-only publish never rewrites
       session.json, so an absent / older syncRev must not hold sync hostage.
       Two proofs are accepted: */
    var want = isObj(remoteVersion) ? str(remoteVersion.session) : '';
    var have = payloadSessionNo(payload);
    var words = payloadWords(payload);
    /* 1) the SAME classroom session with at least one active word (>= 1, not
          >= 30 — a 25-word session must never lock up the class). */
    var sessionMatches = !(want && have && want !== have);
    if (sessionMatches && words.length >= 1) return true;
    /* 2) byte-for-byte the list already adopted (id + length + updatedAt). */
    if (sameActiveList(payload)) return true;
    return false;
  }
  /* D2: one reader for both sources. FRESH mode (post-publish refresh, the
   * default) races the same-origin Pages CDN (6 s) against the
   * raw.githubusercontent.com edge (5 s); the payload with the higher syncRev
   * wins and raw breaks a tie — a freshly published pack is heard while the
   * Pages CDN still serves yesterday's clips. Never a mixed pair.
   * v0.0.6.q PILLAR 1: BOOT mode (opts.fresh !== true) reads ONLY the
   * same-origin cache-first leg and settles the instant it answers — on weak
   * mobile data the Service Worker resolves it in < 30 ms and no 5 s raw
   * race may hold the voice pack hostage. Freshness after boot is owned by
   * the tiny version.json watcher, which escalates to a fresh refresh only
   * when a pointer actually moved. */
  function fetchFreshDataJson(relPath, cb, opts) {
    cb = cb || noop;
    var o = isObj(opts) ? opts : {};
    var path = str(relPath).replace(/^\.?\/+/, '');
    if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
    if (o.fresh !== true) {
      fetchJSON('./' + path, function (err, data) {
        if (err || !isObj(data)) { cb(err || new Error('no_data')); return; }
        cb(null, { ok: true, json: data, source: 'origin' });
      });
      return true;
    }
    var pending = 2, settled = false, origin = null, originErr = null, raw = null, rawErr = null;
    function finish() {
      if (settled) return;
      pending -= 1;
      if (pending > 0) return;
      settled = true;
      var originOk = !!origin, rawOk = !!raw;
      if (!originOk && !rawOk) { cb(originErr || rawErr || new Error('no_data')); return; }
      var oRev = originOk ? (Number(origin.syncRev) || 0) : -1;
      var rRev = rawOk ? (Number(raw.syncRev) || 0) : -1;
      var useRaw = rawOk && (!originOk || rRev > oRev || (rRev === oRev && rRev > 0));
      cb(null, { ok: true, json: useRaw ? raw : origin, source: useRaw ? 'raw' : 'origin' });
    }
    fetchJSON('./' + path, function (err, data) {
      if (!err && isObj(data)) origin = data; else originErr = err || new Error('bad_response');
      finish();
    }, { fresh: true });
    Sync.fetchRawMainJson(path, function (err, data) {
      if (!err && isObj(data)) raw = data; else rawErr = err || new Error('raw_failed');
      finish();
    });
    return true;
  }
  /* D3 / D4 / D5: the adoption chain is one function so no caller can adopt
   * payloads without reloading the voice manifest and repainting every view.
   * While a beat is live the chain is deferred to the end of that beat, so a
   * remote settings bump never cuts a word off mid-speech. */
  var deferredRefresh = [];
  function engineActive() {
    try { return !!(SDP.Engine && SDP.Engine.isActive && SDP.Engine.isActive()); } catch (e) { return false; }
  }
  function runRefreshChain() {
    try { if (SDP.Speech && SDP.Speech.reloadManifest) SDP.Speech.reloadManifest(noop); } catch (e) {}
    try { if (SDP.Views && SDP.Views.renderAll) SDP.Views.renderAll(); } catch (e) {}
    return true;
  }
  function adoptionChain() {
    if (engineActive()) { deferredRefresh.push(runRefreshChain); return 'deferred'; }
    runRefreshChain();
    return 'applied';
  }
  function flushDeferredRefresh() {
    if (!deferredRefresh.length) return 0;
    var queue = deferredRefresh.slice();
    deferredRefresh = [];
    for (var i = 0; i < queue.length; i++) { try { queue[i](); } catch (e) {} }
    return queue.length;
  }

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

  /* ══ v0.0.6.q PILLAR 1 — the LOW-MOBILE-DATA cache law ══════════════════
   * The v0.0.6.n/o cache-bust law (?v=<ver>&t=<tick> + cache:'no-store' on
   * every data JSON) forced a weak 2G/slow-3G Sri Lankan phone to re-download
   * the ~3 MB voice pack on EVERY boot: the fetch outran the SW shell cache,
   * timed out after 6 s and left SDP.Speech with an EMPTY pack — all 131
   * Alice clips vanished and the clock fell back to robotic TTS.
   * The v0.0.6.q law splits the two worlds:
   *   - BOOT payloads (session.json, config.json, elevenlabs-audio.json) are
   *     fetched CACHE-FIRST: only the release version ?v=<APP_VERSION> — no
   *     tick, cache:'default' — so the Service Worker / HTTP cache answers in
   *     < 30 ms even on 0-bar mobile data.
   *   - Only the tiny 428-byte data/version.json pointer keeps
   *     cache:'no-store' + the tick, with a 2500 ms budget (fresh leg). A
   *     pointer timeout is silent: the cached payloads keep serving.
   *   - Post-publish refresh legs (pullVerified / fetchFreshDataJson with
   *     {fresh:true}) also carry the tick + no-store — they run in the
   *     background AFTER the UI is already live, so freshness never blocks
   *     boot and a slow leg can never blank the in-memory pack. */
  function fetchJSON(url, cb, opts) {
    var o = isObj(opts) ? opts : {};
    var fresh = o.fresh === true;
    var done = false;
    function finish(err, data) {
      if (done) return;
      done = true;
      cb(err, data);
    }
    if (typeof global.fetch !== 'function') { finish(new Error('no_fetch')); return; }
    try {
      var bust = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + APP_VERSION + (fresh ? '&t=' + nowMs() : '');
      global.fetch(bust, { cache: fresh ? 'no-store' : 'default' })
        .then(function (res) { return res && res.ok ? res.json() : null; })
        .then(function (data) { finish(data ? null : new Error('bad_response'), data); },
          function () { finish(new Error('fetch_failed')); });
    } catch (e) { finish(new Error('fetch_failed')); }
    /* A hung network must never freeze the boot. contract: docs/ARCHITECTURE_MAP.md §R6
       Fresh pointer reads (version.json) get the tight 2500 ms mobile-data
       budget; cache-first boot reads keep the classic 6 s window because the
       SW cache answers long before it ever fires.
       v0.0.6.t PILLAR 3C: the multi-megabyte data/elevenlabs-audio.json gets
       a 25 s budget on BOTH legs — a fresh Cloned-Voice pack download on weak
       mobile data was aborted mid-flight by the old 2.5 s / 5 s walls, so
       other devices never received the creator's new briefing voice. */
    /* v0.0.7.c (BUG-01): fresh pointer reads get 4 s (was 2.5 s) — on
       Sri Lankan mobile data a single slow TLS round-trip no longer reads
       as a timeout; the probe + 2-strike law handles the rest. */
    var budgetMs = fresh ? 4000 : 6000;
    if (/elevenlabs-audio\.json/i.test(url)) budgetMs = 25000;
    global.setTimeout(function () { finish(new Error('timeout')); }, budgetMs);
  }

  /* v0.0.6.t PILLAR 4B — the CAMBRIDGE B1 BRITISH RP LEXICON. The shipped
    data/session.json is SHA-256 locked (17ea1593…), so its broken US IPA,
     wrong meanings and template sentences are corrected HERE, at runtime,
     keyed by the lower-cased word. Each entry carries p/pos/m/s (the clean
     Cambridge B1 British values), the optional ttsHint RP respelling, and a
     `d` pin of the EXACT shipped session.json defaults: a field is only
     replaced while the runtime value still equals its shipped default, so
     any custom Lecturer edit in Studio is 100% preserved. */
  var CAMBRIDGE_B1_RP_LEXICON = {
  /* v0.0.6.v — SESSION 12 (PLACES & BUILDINGS): the 30 active British RP
     entries, same shape as the entertainment set (p = Cambridge UK IPA,
     ttsHint = RP respelling spoken by buildQueue). */
  "buildings": { p: "/\u02c8b\u026al.d\u026a\u014bz/", pos: "noun.",
    m: "Structures such as houses, offices and schools.",
    s: "The tallest buildings are in the city centre.",
    ttsHint: "BIL-dingz",
    d: { p: "/\u02c8b\u028cl.d\u026a\u014bz/" } },
  "apartment block": { p: "/\u0259\u02c8p\u0251\u02d0t.m\u0259nt \u02ccbl\u0252k/", pos: "noun.",
    m: "A large building divided into many flats.",
    s: "She lives on the top floor of a modern apartment block.",
    ttsHint: "uh-PAART-muhnt blok",
    d: { p: "/\u0259\u02c8p\u0251\u02d0rt.m\u0259nt bl\u0251\u02d0k/" } },
  "castle": { p: "/\u02c8k\u0251\u02d0.s\u0259l/", pos: "noun.",
    m: "A strong building from long ago, often with thick walls and towers.",
    s: "The old stone castle stands on a hill above the town.",
    ttsHint: "KAA-suhl",
    d: { p: "/\u02c8k\u00e6s.\u0259l/" } },
  "clinic": { p: "/\u02c8kl\u026an.\u026ak/", pos: "noun.",
    m: "A small place where doctors treat people who are not staying overnight.",
    s: "He went to the local clinic for a routine check-up.",
    ttsHint: "KLIN-ik",
    d: { p: "/\u02c8kl\u026an.\u026ak/" } },
  "cottage": { p: "/\u02c8k\u0252t.\u026ad\u0292/", pos: "noun.",
    m: "A small house, usually in the countryside.",
    s: "They spent the weekend in a quiet country cottage.",
    ttsHint: "KOT-ij",
    d: { p: "/\u02c8k\u0251\u02d0.t\u026ad\u0292/" } },
  "department store": { p: "/d\u026a\u02c8p\u0251\u02d0t.m\u0259nt \u02ccst\u0254\u02d0/", pos: "noun.",
    m: "A large shop divided into sections selling different kinds of goods.",
    s: "You can buy clothes and furniture in the department store.",
    ttsHint: "di-PAART-muhnt stor",
    d: { p: "/d\u026a\u02c8p\u0251\u02d0rt.m\u0259nt st\u0254\u02d0r/" } },
  "elevator": { p: "/\u02c8el.\u026a.ve\u026a.t\u0259/", pos: "noun.",
    m: "A machine that carries people up and down a building (UK: lift).",
    s: "We took the elevator to the fifth floor of the hotel.",
    ttsHint: "EL-i-vay-tuh",
    d: { p: "/\u02c8el.\u0259.ve\u026a.t\u025a/" } },
  "grocery store": { p: "/\u02c8\u0261r\u0252s.\u0259r.i \u02ccst\u0254\u02d0/", pos: "noun.",
    m: "A shop that sells food and household items.",
    s: "Please pick up some fresh milk from the grocery store.",
    ttsHint: "GROSS-uh-ree stor",
    d: { p: "/\u02c8\u0261ro\u028a.s\u0259ri st\u0254\u02d0r/" } },
  "library": { p: "/\u02c8la\u026a.br\u0259r.i/", pos: "noun.",
    m: "A place where you can borrow and read books.",
    s: "Students borrow books and study quietly in the library.",
    ttsHint: "LY-bruh-ree",
    d: { p: "/\u02c8la\u026a.brer.i/" } },
  "palace": { p: "/\u02c8p\u00e6l.\u026as/", pos: "noun.",
    m: "A very large, grand house where a king or queen lives.",
    s: "Tourists gathered outside the royal palace at noon.",
    ttsHint: "PAL-is",
    d: { p: "/\u02c8p\u00e6l.\u026as/" } },
  "police station": { p: "/p\u0259\u02c8li\u02d0s \u02ccste\u026a.\u0283\u0259n/", pos: "noun.",
    m: "The office where police officers work and people report crimes.",
    s: "She reported the lost wallet at the nearest police station.",
    ttsHint: "puh-LEES stay-shuhn",
    d: { p: "/p\u0259\u02c8li\u02d0s \u02ccste\u026a.\u0283\u0259n/" } },
  "post office": { p: "/\u02ccp\u0259\u028ast \u02c8\u0252f.\u026as/", pos: "noun.",
    m: "The place where you buy stamps and send letters and parcels.",
    s: "I need to go to the post office to send this parcel.",
    ttsHint: "pohst OF-is",
    d: { p: "/\u02cco\u028ast \u02c8\u0251\u02d0.f\u026as/" } },
  "prison": { p: "/\u02c8pr\u026az.\u0259n/", pos: "noun.",
    m: "A place where people are kept as punishment for crimes.",
    s: "The former island prison is now a historical museum.",
    ttsHint: "PRIZ-uhn",
    d: { p: "/\u02c8pr\u026az.\u0259n/" } },
  "railway station": { p: "/\u02c8re\u026al.we\u026a \u02ccste\u026a.\u0283\u0259n/", pos: "noun.",
    m: "A place where trains stop so people can get on and off.",
    s: "Our train leaves from the main railway station at six.",
    ttsHint: "RAYL-way stay-shuhn",
    d: { p: "/\u02c8re\u026al.we\u026a \u02ccste\u026a.\u0283\u0259n/" } },
  "stadium": { p: "/\u02c8ste\u026a.di.\u0259m/", pos: "noun.",
    m: "A large sports ground with seats for many spectators.",
    s: "Fifty thousand fans filled the stadium for the final match.",
    ttsHint: "STAY-dee-uhm",
    d: { p: "/\u02c8ste\u026a.di.\u0259m/" } },
  "supermarket": { p: "/\u02c8su\u02d0.p\u0259\u02ccm\u0251\u02d0.k\u026at/", pos: "noun.",
    m: "A large shop where you choose food yourself and pay at the exit.",
    s: "The large supermarket stays open until ten every evening.",
    ttsHint: "SOO-puh-maa-kit",
    d: { p: "/\u02c8su\u02d0.p\u025a\u02ccm\u0251\u02d0r.k\u0259t/" } },
  "university": { p: "/\u02ccju\u02d0.n\u026a\u02c8v\u025c\u02d0.s\u0259.ti/", pos: "noun.",
    m: "A place of higher education where people study for degrees.",
    s: "Her brother is studying engineering at university.",
    ttsHint: "yoo-ni-VUR-si-tee",
    d: { p: "/\u02ccju\u02d0.n\u0259\u02c8v\u025d\u02d0.s\u0259.ti/" } },
  "countryside": { p: "/\u02c8k\u028cn.tri.sa\u026ad/", pos: "noun.",
    m: "Land outside towns and cities, with fields, trees and villages.",
    s: "We enjoyed a long walk through the green countryside.",
    ttsHint: "KUN-tree-syd",
    d: { p: "/\u02c8k\u028cn.tri.sa\u026ad/" } },
  "campsite": { p: "/\u02c8k\u00e6mp.sa\u026at/", pos: "noun.",
    m: "A place where people stay in tents or caravans on holiday.",
    s: "We pitched our tent at a shaded campsite near the lake.",
    ttsHint: "KAMP-syt",
    d: { p: "/\u02c8k\u00e6mp.sa\u026at/" } },
  "canal": { p: "/k\u0259\u02c8n\u00e6l/", pos: "noun.",
    m: "A man-made waterway for boats to travel along.",
    s: "Narrow boats travel slowly along the historic canal.",
    ttsHint: "kuh-NAL",
    d: { p: "/k\u0259\u02c8n\u00e6l/" } },
  "cliff": { p: "/kl\u026af/", pos: "noun.",
    m: "A high, steep face of rock, often by the sea.",
    s: "Seabirds nested along the high chalk cliff above the sea.",
    ttsHint: "KLIF",
    d: { p: "/kl\u026af/" } },
  "field": { p: "/fi\u02d0ld/", pos: "noun.",
    m: "An area of open land, often with grass or crops.",
    s: "Horses were grazing in the sunny field behind the farm.",
    ttsHint: "FEELD",
    d: { p: "/fi\u02d0ld/" } },
  "harbour": { p: "/\u02c8h\u0251\u02d0.b\u0259/", pos: "noun.",
    m: "A protected area of water where boats stop and shelter.",
    s: "Fishing boats returned safely to the harbour before dusk.",
    ttsHint: "HAA-buh",
    d: { p: "/\u02c8h\u0251\u02d0r.b\u025a/" } },
  "island": { p: "/\u02c8a\u026a.l\u0259nd/", pos: "noun.",
    m: "A piece of land completely surrounded by water.",
    s: "You can reach the small island by ferry in twenty minutes.",
    ttsHint: "EYE-luhnd",
    d: { p: "/\u02c8a\u026a.l\u0259nd/" } },
  "mountain": { p: "/\u02c8ma\u028an.t\u0259n/", pos: "noun.",
    m: "A very high hill, often with rocky slopes.",
    s: "Snow covered the peak of the highest mountain all winter.",
    ttsHint: "MOWN-tuhn",
    d: { p: "/\u02c8ma\u028an.t\u0259n/" } },
  "ocean": { p: "/\u02c8\u0259\u028a.\u0283\u0259n/", pos: "noun.",
    m: "A very large area of salt water between continents.",
    s: "Warm currents flow across the vast Atlantic Ocean.",
    ttsHint: "OH-shuhn",
    d: { p: "/\u02c8o\u028a.\u0283\u0259n/" } },
  "region": { p: "/\u02c8ri\u02d0.d\u0292\u0259n/", pos: "noun.",
    m: "A large area of a country or the world.",
    s: "This coastal region is famous for its tea and spices.",
    ttsHint: "REE-juhn",
    d: { p: "/\u02c8ri\u02d0.d\u0292\u0259n/" } },
  "scenery": { p: "/\u02c8si\u02d0.n\u0259r.i/", pos: "noun.",
    m: "The natural beauty you see around you, such as hills and trees.",
    s: "The train journey offers breathtaking mountain scenery.",
    ttsHint: "SEE-nuh-ree",
    d: { p: "/\u02c8si\u02d0.n\u0259r.i/" } },
  "stream": { p: "/stri\u02d0m/", pos: "noun.",
    m: "A small, narrow river.",
    s: "Clear cold water flowed down the narrow mountain stream.",
    ttsHint: "STREEM",
    d: { p: "/stri\u02d0m/" } },
  "valley": { p: "/\u02c8v\u00e6l.i/", pos: "noun.",
    m: "The low land between two hills or mountains, often with a river.",
    s: "A thick morning mist settled over the quiet river valley.",
    ttsHint: "VAL-ee",
    d: { p: "/\u02c8v\u00e6l.i/" } },

    "entertainment": { p: "/ˌen.təˈteɪn.mənt/", pos: "noun.",
      m: "Shows, films, music, or performances that give people pleasure and enjoyment.",
      s: "There is plenty of live entertainment in the city centre every weekend.",
      d: { p: "/ˈɛn.tɚˈteɪn.mənt/", pos: "noun.",
        m: "An activity designed to give pleasure, enjoyment, diversion, amusement, or relaxation to an audience, no matter whether the audience participates passively as in watching opera or a movie, or actively as in games.",
        s: "We saw a entertainment near the station." } },
    "media": { p: "/ˈmiː.di.ə/", pos: "noun.",
      m: "Television, radio, newspapers, and the internet as ways of sharing news and information.",
      s: "The event was widely reported across social media and television.",
      d: { p: "/ˈmiːdɪə/", pos: "noun.",
        m: "The middle layer of the wall of a blood vessel or lymph vessel which is composed of connective and muscular tissue.",
        s: "We saw a media near the station." } },
    "action": { p: "/ˈæk.ʃən/", pos: "noun.",
      m: "Exciting physical events in a story, film, or play.",
      s: "My brother loves watching exciting action films at the cinema.",
      d: { p: "/ˈæk.ʃən/", pos: "noun.",
        m: "Something done so as to accomplish a purpose.",
        s: "Knead bread with a rocking action." } },
    "actress": { p: "/ˈæk.trəs/", pos: "noun.",
      m: "A woman who performs a character on stage, on television, or in films.",
      s: "The young actress won an award for her performance in the play.",
      d: { p: "/ˈak.tɹəs/", pos: "noun.",
        m: "A female who performs on the stage or in films.",
        s: "We saw a actress near the station." } },
    "admission": { p: "/ədˈmɪʃ.ən/", pos: "noun.",
      m: "The money that you pay to enter a museum, concert, or theatre.",
      s: "Museum admission is free for school students on Fridays.",
      d: { p: "/ædˈmɪʃ.ən/", pos: "noun.",
        m: "The act or practice of admitting.",
        s: "I request admission for two adults" } },
    "adventure": { p: "/ədˈven.tʃə/", pos: "noun.",
      m: "An unusual, exciting, and sometimes daring experience or journey.",
      s: "The children read an exciting adventure story about exploring an island.",
      d: { p: "/ˈædventɜː/", pos: "n.",
        m: "A adventure.",
        s: "We saw a adventure near the station." } },
    "advertisement": { p: "/ədˈvɜː.tɪs.mənt/", pos: "noun.",
      m: "A notice, picture, or short film telling people about a product, job, or service.",
      s: "We saw an advertisement for the summer music festival in the newspaper.", ttsHint: "ad-ver-tiss-ment",
      d: { p: "/ədˈvɜːtɪsmənt/", pos: "noun.",
        m: "A commercial solicitation designed to sell some commodity, service or similar.",
        s: "Companies try to sell their products using advertisements in form of placards, television spots and print publications." } },
    "audience": { p: "/ˈɔː.di.əns/", pos: "noun.",
      m: "The group of people gathered together in one place to watch or listen to a play, film, or concert.",
      s: "The audience clapped loudly at the end of the concert.",
      d: { p: "/ˈɔːdi.əns/", pos: "noun.",
        m: "A group of people within hearing; specifically, a large gathering of people listening to or watching a performance, speech, etc.",
        s: "We joined the audience just as the lights went down." } },
    "bestseller": { p: "/ˌbestˈsel.ə/", pos: "noun.",
      m: "A new book or other product that has bought by a very large number of people.",
      s: "Her latest detective novel quickly became an international bestseller.",
      d: { p: "/ˈbestselə/", pos: "noun.",
        m: "A book or other product that has sold in large numbers.",
        s: "We saw a bestseller near the station." } },
    "cartoon": { p: "/kɑːˈtuːn/", pos: "noun.",
      m: "An animated film or a humorous drawing in a newspaper or magazine.",
      s: "My little sister watches her favourite cartoon every Saturday morning.",
      d: { p: "/kɑːˈtuːn/", pos: "noun.",
        m: "A humorous drawing, often with a caption, or a strip of such drawings.",
        s: "We saw a cartoon near the station." } },
    "celebrity": { p: "/səˈleb.rə.ti/", pos: "noun.",
      m: "A famous person, especially in entertainment, television, or sport.",
      s: "A well-known television celebrity opened the new school library.",
      d: { p: "/sɪˈlɛbɹɪti/", pos: "noun.",
        m: "A rite or ceremony.",
        s: "We saw a celebrity near the station." } },
    "channel": { p: "/ˈtʃæn.əl/", pos: "noun.",
      m: "A television station and the programmes that it broadcasts.",
      s: "Which television channel is showing the wildlife documentary tonight?",
      d: { p: "/ˈtʃænəl/", pos: "noun.",
        m: "The physical confine of a river or slough, consisting of a bed and banks.",
        s: "The water coming out of the waterwheel created a standing wave in the channel." } },
    "circus": { p: "/ˈsɜː.kəs/", pos: "noun.",
      m: "A travelling show with acrobats, clowns, and performers, usually held in a large tent.",
      s: "The circus will be performing in our town next week.",
      d: { p: "/ˈsɜːkəs/", pos: "noun.",
        m: "A traveling company of performers that may include acrobats, clowns, trained animals, and other novelty acts, that gives shows usually in a circular tent.",
        s: "The circus will be in town next week." } },
    "classical music": { p: "/ˌklæs.ɪ.kəl ˈmjuː.zɪk/", pos: "noun.",
      m: "Serious traditional music written by composers such as Mozart and Beethoven.",
      s: "Listening to classical music helps me concentrate while studying.",
      d: { p: "/ˈklæsɪkæl ˈmʌsɪk/", pos: "noun.",
        m: "Music of the classical period; the music of Mozart, Haydn, etc; the musical period before the romantic.",
        s: "The story was very classical music to read." } },
    "comedy": { p: "/ˈkɒm.ə.di/", pos: "noun.",
      m: "A play, film, or television programme that is intended to make people laugh.",
      s: "We watched a very funny British comedy at the theatre last night.",
      d: { p: "/ˈkɒmədi/", pos: "noun.",
        m: "A choric song of celebration or revel, especially in Ancient Greece.",
        s: "Why would you be watching comedy when there are kids starving right now?" } },
    "competition": { p: "/ˌkɒm.pəˈtɪʃ.ən/", pos: "noun.",
      m: "An organized event in which people try to win a prize by being the best.",
      s: "She entered the school singing competition and won first prize.",
      d: { p: "/ˌkɒmpəˈtɪʃən/", pos: "noun.",
        m: "The action of competing.",
        s: "The competition for this job is strong." } },
    "concert": { p: "/ˈkɒn.sət/", pos: "noun.",
      m: "A live performance of music by one or more musicians or singers.",
      s: "We bought tickets for the Friday evening orchestra concert.",
      d: { p: "/ˈkɒnsət/", pos: "noun.",
        m: "Agreement in a design or plan; union formed by mutual communication of opinions and views; accordance in a scheme; harmony; simultaneous action.",
        s: "I'm going to the rock concert on Friday." } },
    "disco": { p: "/ˈdɪs.kəʊ/", pos: "noun.",
      m: "A party or club where people dance to recorded pop music.",
      s: "The school organized a disco in the main hall at the end of term.",
      d: { p: "/ˈdɪskəʊ/", pos: "noun.",
        m: "A genre of dance music that was popular in the 1970s, characterized by elements of soul music with a strong Latin-American beat and often accompanied by pulsating lights.",
        s: "We saw a disco near the station." } },
    "display": { p: "/dɪˈspleɪ/", pos: "noun.",
      m: "A public arrangement of things or a show for people to look at and enjoy.",
      s: "Everyone gathered in the park to watch the colourful gymnastics display.",
      d: { p: "/ˈdɪspleɪ/", pos: "adj.",
        m: "Having the quality of being display.",
        s: "The story was very display to read." } },
    "documentary": { p: "/ˌdɒk.jəˈmen.tər.i/", pos: "noun.",
      m: "A film or television programme that gives real facts about a subject.",
      s: "We watched an interesting documentary about ocean wildlife.",
      d: { p: "/ˌdɒk.jəˈmɛn.tɹi/", pos: "noun.",
        m: "A film, TV program, publication etc. which presents a social, political, scientific or historical subject in a factual or informative manner.",
        s: "The story was very documentary to read." } },
    "drawing": { p: "/ˈdrɔː.ɪŋ/", pos: "noun.",
      m: "A picture made with a pencil, pen, or crayon rather than paint.",
      s: "She showed the art teacher a detailed pencil drawing of the old station.",
      d: { p: "/ˈdɹɔ.(w)ɪŋ(ɡ)/", pos: "verb.",
        m: "To move or develop something.",
        s: "She had to draw upon her experience to solve the problem." } },
    "exhibition": { p: "/ˌek.sɪˈbɪʃ.ən/", pos: "noun.",
      m: "A public display of paintings, photographs, or other objects of interest.",
      s: "Our class visited a photography exhibition at the national gallery.",
      d: { p: "/ˈekshɪbɪʃn/", pos: "n.",
        m: "A exhibition.",
        s: "We saw a exhibition near the station." } },
    "festival": { p: "/ˈfes.tɪ.vəl/", pos: "noun.",
      m: "A special day or period with public concerts, plays, and celebrations.",
      s: "Thousands of visitors came to the annual summer music festival.",
      d: { p: "/ˈfɛstəvəl/", pos: "noun.",
        m: "An event or community gathering, usually staged by a local community, which centers on some theme, sometimes on some unique aspect of the community.",
        s: "The story was very festival to read." } },
    "film maker": { p: "/ˈfɪlm ˌmeɪ.kə/", pos: "noun.",
      m: "A person who directs or produces films for the cinema or television.",
      s: "The young film maker won a prize for his short documentary.",
      d: { p: "/ˈfɪlm ˈmækə/", pos: "n.",
        m: "A film maker.",
        s: "We saw a film maker near the station." } },
    "fireworks": { p: "/ˈfaɪə.wɜːks/", pos: "noun.",
      m: "Small containers that explode with bright colours and loud noises in the night sky.",
      s: "Bright fireworks lit up the harbour at midnight.",
      d: { p: "/ˈfaɪ̯.ə.wɜːks/", pos: "noun.",
        m: "A device using gunpowder and other chemicals which, when lit, emits a combination of coloured flames, sparks, whistles or bangs, and sometimes made to rocket high into the sky before exploding, used for entertainment or celebration.",
        s: "Commercial firework displays are commonly launched from boats or other vessels" } },
    "folk music": { p: "/ˈfəʊk ˌmjuː.zɪk/", pos: "noun.",
      m: "Traditional music from a particular country or region passed down through generations.",
      s: "The band played traditional Sri Lankan and British folk music.",
      d: { p: "/ˈfɒlk ˈmʌsɪk/", pos: "noun.",
        m: "Any genre of music originating from the ethnic community of a specific region, often passed down through oral tradition, without recorded songwriters and possessing a clear purpose or social function.",
        s: "The story was very folk music to read." } },
    "guitarist": { p: "/ɡɪˈtɑː.rɪst/", pos: "noun.",
      m: "A musician who plays the guitar.",
      s: "The lead guitarist played a wonderful solo during the concert.",
      d: { p: "/ˈɡʌɪtɑːɪst/", pos: "noun.",
        m: "Someone who plays a guitar.",
        s: "We saw a guitarist near the station." } },
    "headphones": { p: "/ˈhed.fəʊnz/", pos: "noun.",
      m: "A pair of small speakers worn over the ears to listen to audio privately.",
      s: "Please wear your headphones during the dictation practice session.",
      d: { p: "/ˈhiːdfɒnz/", pos: "noun.",
        m: "A pair of speakers worn over or in the ears so only the wearer can hear the sound.",
        s: "We saw a headphones near the station." } },
    "hero": { p: "/ˈhɪə.rəʊ/", pos: "noun.",
      m: "A person who is admired for doing something very brave or good, or the main male character in a story.",
      s: "The brave firefighter was praised as a local hero.",
      d: { p: "/ˈhɛɹ.oʊ/", pos: "noun.",
        m: "Somebody who possesses great bravery and carries out extraordinary or noble deeds.",
        s: "Let's discuss how to play if the hero has KK, and there's an ace on board." } },
    "heroine": { p: "/ˈher.əʊ.ɪn/", pos: "noun.",
      m: "A woman who is admired for bravery, or the main female character in a book or film.",
      s: "The heroine of the novel solved the mystery with courage and intelligence.",
      d: { p: "/ˈhɛɹoʊɪn/", pos: "noun.",
        m: "A female hero.",
        s: "We saw a heroine near the station." } },
  

    /* v0.0.6.z — SESSION 14 (PLACES: TOWN & CITY; SERVICES): the 30 active
     British RP entries (90 total with Sessions 11 + 12) so Stage A
     resolves every live Session-14 word instantly, offline. */
  "town": { p: "/taʊn/", pos: "noun.", ttsHint: "TAWN", d: { p: "/taʊn/" } },
  "airport": { p: "/ˈeə.pɔːt/", pos: "noun.", ttsHint: "EAIR-port", d: { p: "/ˈer.pɔːrt/" } },
  "bridge": { p: "/brɪdʒ/", pos: "noun.", ttsHint: "BRIJ", d: { p: "/brɪdʒ/" } },
  "cash machine": { p: "/ˈkæʃ məˌʃiːn/", pos: "noun.", ttsHint: "KASH muh-sheen", d: { p: "/ˈkæʃ məˌʃiːn/" } },
  "cashpoint": { p: "/ˈkæʃ.pɔɪnt/", pos: "noun.", ttsHint: "KASH-poynt", d: { p: "/ˈkæʃ.pɔɪnt/" } },
  "city centre": { p: "/ˌsɪt.i ˈsen.tə/", pos: "noun.", ttsHint: "SIT-ee sen-tuh", d: { p: "/ˈsɪt.i ˈsen.t̬ɚ/" } },
  "crossroads": { p: "/ˈkrɒs.rəʊdz/", pos: "noun.", ttsHint: "KROSS-rohdz", d: { p: "/ˈkrɔːs.roʊdz/" } },
  "fountain": { p: "/ˈfaʊn.tɪn/", pos: "noun.", ttsHint: "FOWN-tin", d: { p: "/ˈfaʊn.tɪn/" } },
  "monument": { p: "/ˈmɒn.jʊ.mənt/", pos: "noun.", ttsHint: "MON-yoo-muhnt", d: { p: "/ˈmɑːn.jə.mənt/" } },
  "pavement": { p: "/ˈpeɪv.mənt/", pos: "noun.", ttsHint: "PAYV-muhnt", d: { p: "/ˈpeɪv.mənt/" } },
  "petrol station": { p: "/ˈpet.rəl ˌsteɪ.ʃən/", pos: "noun.", ttsHint: "PET-ruhl stay-shuhn", d: { p: "/ˈpet.rəl ˌsteɪ.ʃən/" } },
  "roundabout": { p: "/ˈraʊnd.ə.baʊt/", pos: "noun.", ttsHint: "ROWND-uh-bowt", d: { p: "/ˈraʊnd.ə.baʊt/" } },
  "shopping centre": { p: "/ˈʃɒp.ɪŋ ˌsen.tə/", pos: "noun.", ttsHint: "SHOP-ing sen-tuh", d: { p: "/ˈʃɑː.pɪŋ ˈsen.t̬ɚ/" } },
  "square": { p: "/skweə/", pos: "noun.", ttsHint: "SKWEAIR", d: { p: "/skwer/" } },
  "street": { p: "/striːt/", pos: "noun.", ttsHint: "STREET", d: { p: "/striːt/" } },
  "subway": { p: "/ˈsʌb.weɪ/", pos: "noun.", ttsHint: "SUB-way", d: { p: "/ˈsʌb.weɪ/" } },
  "tunnel": { p: "/ˈtʌn.əl/", pos: "noun.", ttsHint: "TUN-uhl", d: { p: "/ˈtʌn.əl/" } },
  "turning": { p: "/ˈtɜː.nɪŋ/", pos: "noun.", ttsHint: "TUR-ning", d: { p: "/ˈtɝː.nɪŋ/" } },
  "services": { p: "/ˈsɜː.vɪ.sɪz/", pos: "noun.", ttsHint: "SUR-vi-siz", d: { p: "/ˈsɝː.vɪ.sɪz/" } },
  "bank": { p: "/bæŋk/", pos: "noun.", ttsHint: "BANGK", d: { p: "/bæŋk/" } },
  "cafe": { p: "/ˈkæf.eɪ/", pos: "noun.", ttsHint: "KAF-ay", d: { p: "/kæˈfeɪ/" } },
  "cafeteria": { p: "/ˌkæf.əˈtɪə.ri.ə/", pos: "noun.", ttsHint: "kaf-uh-TEER-ee-uh", d: { p: "/ˌkæf.əˈtɪr.i.ə/" } },
  "cinema": { p: "/ˈsɪn.ə.mə/", pos: "noun.", ttsHint: "SIN-uh-muh", d: { p: "/ˈsɪn.ə.mə/" } },
  "dentist": { p: "/ˈden.tɪst/", pos: "noun.", ttsHint: "DEN-tist", d: { p: "/ˈden.tɪst/" } },
  "gallery": { p: "/ˈɡæl.ər.i/", pos: "noun.", ttsHint: "GAL-uh-ree", d: { p: "/ˈɡæl.ɚ.i/" } },
  "hairdresser": { p: "/ˈheəˌdres.ə/", pos: "noun.", ttsHint: "HEAIR-dres-uh", d: { p: "/ˈherˌdres.ɚ/" } },
  "museum": { p: "/mjuːˈziː.əm/", pos: "noun.", ttsHint: "myoo-ZEE-uhm", d: { p: "/mjuˈziː.əm/" } },
  "restaurant": { p: "/ˈres.trɒnt/", pos: "noun.", ttsHint: "RES-tront", d: { p: "/ˈres.tə.rɑːnt/" } },
  "theatre": { p: "/ˈθɪə.tə/", pos: "noun.", ttsHint: "THEE-uh-tuh", d: { p: "/ˈθiː.ə.t̬ɚ/" } },
  "tourist information": { p: "/ˈtʊə.rɪst ˌɪn.fəˈmeɪ.ʃən/", pos: "noun.", ttsHint: "TOOR-ist in-fuh-may-shuhn", d: { p: "/ˈtʊr.ɪst ˌɪn.fɚˈmeɪ.ʃən/" } },
  };
  /* v0.0.6.t PILLAR 4B — runtime Cambridge B1 British RP normalization.
     data/session.json stays byte-identical on disk (SHA-256 locked); the
     lexicon above repairs the shipped US IPA / broken meaning / template
     sentence fields ONLY while they still equal their shipped defaults, and
     any US/AU .mp3 dictionary fallback URL is rewritten to the British
     (type=1) Youdao dictionary voice so the fallback tier is 100% UK. */
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
      clip: trim(w.clip),
      ttsHint: trim(w.ttsHint)
    };
    /* v0.0.7.b B2: the UK pronunciation-variant hints survive normalization. */
    if (Array.isArray(w.pronunciationVariants) && w.pronunciationVariants.length > 1) {
      word.pronunciationVariants = w.pronunciationVariants.slice(0, 4);
    }
    var lexKey = str(word.w).trim().toLowerCase();
    var L = CAMBRIDGE_B1_RP_LEXICON[lexKey];
    if (L && isObj(L.d)) {
      if (str(L.d.p) === str(w.p || '')) word.p = str(L.p);
      if (str(L.d.pos) === str(w.pos || '')) word.pos = str(L.pos);
      if (str(L.d.m) === str(w.m || '')) word.m = str(L.m);
      if (str(L.d.s) === str(w.s || '')) word.s = str(L.s);
      if (!word.ttsHint && str(L.ttsHint)) word.ttsHint = str(L.ttsHint);
    }
    if (word.audio && /-(us|au)\.mp3($|\?)/i.test(word.audio) && word.w) {
      word.audio = 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(word.w);
    }
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

  /* R1 / SYNC-01 / SYNC-02: a lecturer settingsRev bump overrides the student's
   * touchedKeys for the ten classroom keys. Personal keys (lang, guideAutoPlay,
   * volume, hints) and sdp.progress are NEVER touched here. */
  function adoptRemoteSettings(remoteCfg, remoteSettingsRev) {
    var cfg = isObj(remoteCfg) ? remoteCfg : {};
    var source = isObj(cfg.classSettings) ? cfg.classSettings : (isObj(cfg.defaults) ? cfg.defaults : null);
    if (!source) return false;
    var rev = Number(remoteSettingsRev === undefined ? cfg.settingsRev : remoteSettingsRev) || 0;
    var current = Data.settings();
    if (rev <= (Number(current.appliedSettingsRev) || 0)) return false;
    var patch = { appliedSettingsRev: rev }, changed = false, k, key;
    for (k = 0; k < CLASS_SETTING_KEYS.length; k++) {
      key = CLASS_SETTING_KEYS[k];
      if (source[key] === undefined || source[key] === null) continue;
      if (current[key] === source[key]) continue;
      patch[key] = source[key];
      changed = true;
    }
    var touched = isObj(current.touchedKeys) ? current.touchedKeys : {};
    var kept = {};
    for (k in touched) {
      if (!Object.prototype.hasOwnProperty.call(touched, k)) continue;
      if (CLASS_SETTING_KEYS.indexOf(k) < 0) kept[k] = touched[k];
    }
    patch.touchedKeys = kept;
    Data.saveSettings(patch);
    try { if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings(); } catch (e) {}
    try { if (SDP.Views && SDP.Views.renderAll) SDP.Views.renderAll(); } catch (e) {}
    emit('sdp:teacher-updated', { settingsRev: rev, applied: Object.keys(patch), changed: changed });
    return true;
  }

  /* v0.0.6.d (D1): the fingerprint of the ACTIVE word list. applyPayloads()
     compares it before/after so a changed word list can refresh a stuck
     cockpit even when no stale draft exists (engine running or paused). */
  function wordsSignatureOf(list) {
    var arr = Array.isArray(list) ? list : [], out = [], i;
    for (i = 0; i < arr.length; i++) {
      var w = arr[i] || {};
      out.push(str(typeof w === 'string' ? w : (w.w || w.word || '')).trim().toLowerCase());
    }
    return out.join('|');
  }

  function applyPayloads(version, config, session) {
    var prevWordSig = (state.words && state.words.length) ? wordsSignatureOf(state.words) : '';
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
    /* v0.0.7.a A1 — the boot word-cap follows the PUBLISHED session
       (session.wordCount / wordCountMode), never a hard 30. A 31-word or
       55-word custom session loads in full on every student device; the
       historical 30 remains the default only when nothing was published. */
    var bootCap = Number(ses.session && ses.session.wordCount) || Number(ses.wordCount) || 0;
    if (!bootCap || bootCap < 5) bootCap = 30;
    state.words = list ? list.words.slice(0, bootCap).map(normalizeWord) : [];
    /* v0.0.4.b BUG-4: a stale sdp.session draft from an older word list must
       never resurrect its old words when a new session payload arrives. */
    try {
      var rawDraft = global.localStorage && global.localStorage.getItem ? global.localStorage.getItem('sdp.session') : null;
      if (rawDraft && state.words.length) {
        var oldDraft = JSON.parse(rawDraft), want = [], wi;
        for (wi = 0; wi < state.words.length; wi++) {
          var ww = state.words[wi] || {};
          want.push(str(ww.w || ww.word || ww).trim().toLowerCase());
        }
        var wantSig = want.join('|'), stale = false;
        if (oldDraft && oldDraft.wordsSig && oldDraft.wordsSig !== wantSig) stale = true;
        if (oldDraft && !oldDraft.wordsSig && isObj(oldDraft.answers)) {
          var okMap = {}, wi2;
          for (wi2 = 0; wi2 < want.length; wi2++) okMap[want[wi2]] = 1;
          for (var ak in oldDraft.answers) {
            if (Object.prototype.hasOwnProperty.call(oldDraft.answers, ak) && !okMap[str(ak).trim().toLowerCase()]) { stale = true; break; }
          }
        }
        if (stale && global.SDP && global.SDP.Data && global.SDP.Data.clearSession) global.SDP.Data.clearSession();
      }
    } catch (e) {}
    state.sessionTitle = str((ses.session && ses.session.title) || ver.title || 'Session ' + state.sessionNo);
    state.classInfo = str((ses.session && ses.session.classInfo) || cfg.classInfo || '');
    state.announcement = ses.announcement || null;
    state.pastSessions = Array.isArray(ses.pastSessions) ? ses.pastSessions : [];
    state.settingsRev = Number(ver.settingsRev || 0);
    state.syncRev = Number(ver.syncRev || 0);
    /* SYNC-02: adopt on the very first boot too (appliedSettingsRev starts at 0),
       never gated on a previous revision being present. */
    var appliedRev = 0;
    try { appliedRev = Number(Data.settings().appliedSettingsRev) || 0; } catch (e) { appliedRev = 0; }
    /* D10 (v0.0.2.a): the adoption test is MONOTONIC — no release literal and
       no settingsRev clamp may ever pin appliedSettingsRev to one number. */
    if (state.settingsRev > appliedRev) adoptRemoteSettings(cfg, state.settingsRev);
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
    /* D8: repair a released config.json that lost its vault. */
    try { healVaultFromLayerOne(); } catch (e) {}
    state.ready = state.words.length > 0;
    /* v0.0.6.d (D1): the active word list CHANGED under a running or paused
       cockpit (local publish, one-click master setup, settings broadcast or a
       remote adoption). Clear the stale draft, reset the engine to a clean
       Word #1 cockpit and announce the refresh — never keep dictating the old
       words. Skipped on the very first boot (no previous list). */
    try {
      var nextSig = wordsSignatureOf(state.words);
      if (prevWordSig && nextSig && prevWordSig !== nextSig) {
        if (global.SDP && global.SDP.Data && global.SDP.Data.clearSession) global.SDP.Data.clearSession();
        emit('sdp:words-refresh', { words: state.words.length });
      }
    } catch (e2) {}
  }

  function finishBoot(err, info) {
    booting = false;
    var cbs = bootCallbacks.slice();
    bootCallbacks = [];
    for (var i = 0; i < cbs.length; i++) { try { cbs[i](err || null, info || state); } catch (e) {} }
    if (!err) notify('ready', state);
  }
  /* v0.0.6.r Pillar 1 — the PACK-SYNCREV REVALIDATION LAW: when the freshly
   * settled data/version.json carries a syncRev NEWER than the voice-pack
   * manifest this device booted with (or than the last pack rev it pulled,
   * recorded in localStorage), the pack is reloaded immediately through the
   * fresh origin-vs-raw race — so every other browser, incognito window or
   * student phone downloads the newly committed Cloned Voice pack the
   * moment the version.json pointer advances, never minutes later. */
  function maybeRevalidateVoicePack() {
    try {
      var remote = state.version || {};
      var rev = Number(remote.syncRev || 0);
      if (!(rev > 0)) return false;
      var lastPulled = 0;
      try {
        if (global.localStorage && global.localStorage.getItem) lastPulled = Number(global.localStorage.getItem('sdp.last_pack_syncrev')) || 0;
      } catch (eL) { lastPulled = 0; }
      /* fast exit: this device already pulled this pointer (or newer) — the
         cache-first boot read owns the pack, zero extra network. */
      if (!(rev > lastPulled)) return false;
      /* DEFERRED compare: wait for the boot manifest read (cache-first, the
         low-mobile-data law) to settle BEFORE deciding, so the revalidation
         can compare the pointer against the LOADED pack instead of racing
         (and hijacking) the boot read into a fresh no-store pull. */
      var tries = 0;
      var tick = function () {
        var packRev = 0;
        try {
          if (global.SDP && global.SDP.Speech && global.SDP.Speech.clipManifest && global.SDP.Speech.clipManifest()) {
            packRev = Number(global.SDP.Speech.clipManifest().syncRev || 0) || 0;
          }
        } catch (eS) { packRev = 0; }
        if (packRev > 0) {
          if (rev > packRev) {
            try {
              if (global.localStorage && global.localStorage.setItem) global.localStorage.setItem('sdp.last_pack_syncrev', String(rev));
            } catch (eW) {}
            try {
              if (global.SDP && global.SDP.Speech && global.SDP.Speech.reloadManifest) global.SDP.Speech.reloadManifest(noop, true);
            } catch (eR) {}
          } else {
            try {
              if (global.localStorage && global.localStorage.setItem) global.localStorage.setItem('sdp.last_pack_syncrev', String(Math.max(rev, packRev)));
            } catch (eW2) {}
          }
          return true;
        }
        tries += 1;
        if (tries < 40) global.setTimeout(tick, 350);
        return false;
      };
      global.setTimeout(tick, 600);
      return true;
    } catch (e) {}
    return false;
  }

  var Sync = {
    state: state,
    listen: listen,
    /* v0.0.6.z Pillar 4 (Y4): the reactive event bus — the Studio clip
       table, pack dashboard, coverage matrix, Words screen and the running
       dictation engine all repaint within the same tick on every change. */
    emitChange: function (kind, detail) {
      var ls = changeListeners, i;
      for (i = 0; i < ls.length; i++) {
        try { ls[i](str(kind || 'change'), detail || {}); } catch (e) {}
      }
      emit('sdp:change', { kind: str(kind || 'change'), detail: detail || {} });
      return true;
    },
    onChange: function (fn) {
      if (typeof fn !== 'function') return function () {};
      changeListeners.push(fn);
      return function () {
        var at = changeListeners.indexOf(fn);
        if (at >= 0) changeListeners.splice(at, 1);
      };
    },
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
    wordsSignatureOf: wordsSignatureOf,

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
      var pending = 3, results = {}, failed = 0, settled = false;
      function settle(slot, err, data) {
        if (settled) return; /* D-S11: a late fetch can never settle twice */
        if (err) failed += 1;
        results[slot] = data;
        pending -= 1;
        if (pending > 0) return;
        settled = true;
        applyPayloads(results.version, results.config, results.session);
        state.source = failed === 3 ? 'offline' : 'network';
        /* v0.0.6.r: the voice pack re-pulls the moment the pointer advanced. */
        try { maybeRevalidateVoicePack(); } catch (eRev) {}
        finishBoot(state.ready ? null : new Error('no_words'), state);
      }
      /* v0.0.6.q PILLAR 1: only the 428-byte version.json pointer is fetched
         fresh (no-store + tick, 2500 ms) — the session/config legs are
         CACHE-FIRST (?v=<release>, cache:'default') so the SW shell cache
         answers instantly on weak mobile data and a slow leg can never
         blank the cockpit. */
      fetchJSON('./data/version.json', function (e, d) { settle('version', e, d); }, { fresh: true });
      fetchJSON('./data/config.json', function (e, d) { settle('config', e, d); });
      fetchJSON('./data/session.json', function (e, d) { settle('session', e, d); });
    },

    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 instant propagation */
    /* R1 Verified Payload Adoption (D1/D2): whatever source wins the
       version.json clock race, every payload leg must PROVE it belongs to that
       pointer (Number(json.syncRev) >= targetSyncRev, or the preserved 30-word
       baseline session). A leg that fails, times out or comes back stale is
       retried once against the other source (raw <-> origin); if it still
       cannot deliver, state.version is NOT advanced, so the next watch tick
       retries cleanly instead of silently skipping a published update.
       The Never-Red law still holds: ok:false only when both version sources
       fail — Brave Shields, CORS blocks and timeouts are non-fatal. */
    checkForUpdates: function (cb) {
      cb = cb || noop;
      if (typeof global.fetch !== 'function') { cb(null, { ok: false, error: 'no_fetch', changed: false }); return; }
      var pending = 2, cdnVersion = null, cdnErr = null, rawVersion = null, rawFailed = false, settled = false;
      function joined() {
        if (settled) return;
        pending -= 1;
        if (pending > 0) return;
        settled = true;
        proceed();
      }
      /* v0.0.6.q PILLAR 1: the watcher reads only the tiny pointer fresh; a
         pointer timeout on weak mobile data is non-fatal (Never-Red law). */
      fetchJSON('./data/version.json', function (err, data) { cdnErr = err; cdnVersion = err ? null : data; joined(); }, { fresh: true });
      Sync.fetchRawMainJson('data/version.json', function (err, data) {
        if (err || !data) rawFailed = true; else rawVersion = data;
        joined();
      });
      function proceed() {
        var rawRev = Number((rawVersion && rawVersion.syncRev) || 0);
        var cdnRev = Number((cdnVersion && cdnVersion.syncRev) || 0);
        /* A source that failed or was blocked can never win the clock race. */
        var useRaw = cdnVersion ? (!rawFailed && rawRev > cdnRev) : (!!rawVersion && !rawFailed);
        var remote = useRaw ? rawVersion : cdnVersion;
        var result = { updated: false, session: null, appVersion: null };
        if (!remote) {
          var cdnCode = cdnErr && String(cdnErr.message) === 'timeout' ? 'timeout' : (cdnErr && cdnErr.message === 'no_fetch' ? 'no_fetch' : 'bad_response');
          var code = cdnVersion || rawVersion ? cdnCode : (cdnErr && cdnErr.message === 'no_fetch' ? 'no_fetch' : cdnCode);
          cb(null, { ok: false, error: code, changed: false }); return;
        }
        var local = state.version || {};
        var sessionChanged = str(remote.session) !== str(local.session);
        var settingsChanged = Number(remote.settingsRev || 0) !== Number(local.settingsRev || 0);
        var newer = Number(remote.syncRev || 0) > Number(local.syncRev || 0);
        var targetSyncRev = Number(remote.syncRev || 0);
        /* SYNC-04 / D17: share one parser for the remote app version. */
        var remoteAppVer = parseRemoteAppVer(remote);
        var appChanged = !!remoteAppVer && remoteAppVer !== APP_VERSION;
        state.lastCheck = nowMs();
        var primarySource = useRaw ? 'raw' : 'origin';
        state.lastCheckSource = primarySource;
        result.session = str(remote.session);
        result.appVersion = str(remote.appVersion || remoteAppVer);
        result.appVersionChanged = appChanged;
        if (!sessionChanged && !settingsChanged && !newer && !appChanged) {
          cb(null, { ok: true, error: null, changed: false, updated: false, session: result.session, appVersion: result.appVersion, source: primarySource });
          return;
        }
        if (appChanged) {
          var already = '';
          try { already = sessionStorage.getItem('sdp_upgraded_to') || ''; } catch (e) { already = ''; }
          if (already !== remoteAppVer) {
            appVersionChanged = true;
            Sync.triggerVersionUpgrade(remoteAppVer);
          }
        }
        /* D-S7: an envelope published a second ago must not be missed because
           the CDN still serves yesterday's config.json — so a stale leg is
           retried against the other source instead of being accepted. */
        /* D17 (v0.0.1.h): a settings-only / keys-only publish touches only
           config.json + version.json, so the 46 KB session.json must NOT be
           re-pulled on a 3G student phone. The publisher stamps
           version.payloadFiles, which lets the reader prove the case; a legacy
           header (no payloadFiles) falls back to the safe "always pull". */
        var wroteSession = true;
        if (Array.isArray(remote.payloadFiles)) {
          wroteSession = remote.payloadFiles.indexOf('data/session.json') >= 0;
        }
        var needSession = Boolean(sessionChanged ||
          str(remote.session || '') !== str(local.session || '') ||
          state.deferredSession || wroteSession);
        var needConfig = settingsChanged || newer || !state.config;
        var waiting = (needSession ? 1 : 0) + (needConfig ? 1 : 0) + 1;
        var got = { version: remote, session: null, config: null };
        var failedLegs = [];
        var usedSources = {};
        function fetchLeg(source, path, done) {
          if (source === 'raw') { Sync.fetchRawMainJson(path, done); return; }
          /* v0.0.6.q PILLAR 1: refresh legs run AFTER a syncRev advance was
             proven by the pointer, with the UI already live — they stay fresh
             (tick + no-store) so the CDN cannot answer yesterday's payload. */
          fetchJSON('./' + path, done, { fresh: true });
        }
        function pullVerified(path, kind, assign, done) {
          var alternate = primarySource === 'raw' ? 'origin' : 'raw';
          /* v0.0.7.c (BUG-01 #2): a throwing verifier can never swallow the
             callback — settle() must ALWAYS run, or the whole check hangs. */
          function verified(data) {
            try { return verifyPayloadLeg(data, kind, targetSyncRev, remote); }
            catch (eV) { return false; }
          }
          function attempt(source, retried) {
            fetchLeg(source, path, function (err, data) {
              try {
                if (!err && verified(data)) {
                  assign(data);
                  usedSources[kind] = source;
                  done(true);
                  return;
                }
              } catch (eA) { /* fall through to retry/fail */ }
              if (!retried) { attempt(alternate, true); return; }
              done(false);
            });
          }
          attempt(primarySource, false);
        }
        function settle() {
          waiting -= 1;
          if (waiting > 0) return;
          /* D15 (v0.0.1.h): config.json is SOVEREIGN. If config + version were
             delivered, this publish is adopted even when the session leg failed
             — one missing 46 KB file can no longer hold settings, keys and the
             encrypted vault hostage behind a stale_payload loop. */
          var configOk = failedLegs.indexOf('data/config.json') < 0;
          if (!configOk) {
            /* Without config.json nothing may advance: keep the old pointer so
               the next 25 s tick retries this publish. */
            state.lastCheckSource = primarySource;
            cb(null, {
              ok: true, error: 'stale_payload', changed: false, updated: false, deferred: true,
              retry: failedLegs.slice(), session: str(local.session),
              appVersion: result.appVersion, source: primarySource
            });
            return;
          }
          var sessionOk = failedLegs.indexOf('data/session.json') < 0;
          state.deferredSession = !sessionOk;
          if (got.session) state.sessionRev = Number(got.session.syncRev) || Number(state.sessionRev || 0);
          /* R7 (D11): config.json is sovereign, but the SESSION POINTER only
             moves when session.json itself verified. The words on screen stay
             the last delivered 30; the pointer is retried on the next tick. */
          var appliedVersion = got.version || remote;
          if (!sessionOk) {
            appliedVersion = JSON.parse(JSON.stringify(appliedVersion || {}));
            appliedVersion.session = str(local.session);
          }
          applyPayloads(appliedVersion, got.config, got.session || state.session);
          /* R7: the full chain, in one place. */
          try { adoptRemoteSettings(got.config, Number(remote.settingsRev || 0)); } catch (e) {}
          var chainState = adoptionChain();
          if (!sessionOk) {
            /* D11 / Never-Red: a REQUIRED leg that could not prove its syncRev
               is reported honestly as stale_payload (never silently skipped)
               while the verified config + version are already adopted. */
            state.lastCheckSource = primarySource;
            cb(null, {
              ok: false, error: 'stale_payload', changed: true, updated: true, deferred: true,
              deferredSession: true, retry: ['data/session.json'],
              session: str(local.session), settingsRev: remote.settingsRev,
              appVersion: result.appVersion, source: primarySource,
              payloadSources: usedSources, chain: chainState
            });
            return;
          }
          var detail = {
            session: state.sessionNo, sessionChanged: sessionChanged,
            settingsChanged: settingsChanged, syncRev: remote.syncRev,
            appVersionChanged: appChanged, source: primarySource,
            payloadSources: usedSources, chain: chainState
          };
          notify('update', detail);
          /* Student progress is never touched here (G8). */
          cb(null, {
            ok: true, error: null, changed: true, updated: true, session: state.sessionNo,
            sessionChanged: sessionChanged, settingsRev: remote.settingsRev,
            appVersionChanged: appChanged, source: primarySource,
            payloadSources: usedSources, chain: chainState,
            /* D15: the next 25 s watch tick retries session.json. */
            deferredSession: !!state.deferredSession,
            retry: state.deferredSession ? ['data/session.json'] : []
          });
        }
        if (needSession) pullVerified('data/session.json', 'session', function (d) { got.session = d; }, function (ok) { if (!ok) failedLegs.push('data/session.json'); settle(); });
        if (needConfig) pullVerified('data/config.json', 'config', function (d) { got.config = d; }, function (ok) { if (!ok) failedLegs.push('data/config.json'); settle(); });
        settle();
      }
    },

    /* D2: the shared dual-source reader, used by the watcher, SDP.Speech's
       manifest loader and the Studio voice pack loader. */
    fetchFreshDataJson: fetchFreshDataJson,
    rpLexicon: function () { return CAMBRIDGE_B1_RP_LEXICON; },
    verifyPayloadLeg: verifyPayloadLeg,
    adoptionChain: adoptionChain,
    /* Called by the engine at the end of every beat / on pause / on finish so
       a deferred adoption lands exactly between words, never mid-word. */
    flushDeferred: flushDeferredRefresh,
    deferredCount: function () { return deferredRefresh.length; },

    /* D1: in-session version upgrade — honest badge, toast, cache purge,
       single reload, then the boot guard stops a second one. */
    triggerVersionUpgrade: function (nextVersion) {
      if (sessionStorage.getItem('sdp_upgraded_to') === String(nextVersion)) return false;
      try { sessionStorage.setItem('sdp_upgraded_to', String(nextVersion)); } catch (e) {}
      appVersionChanged = true;
      notify('version-upgrade', { version: String(nextVersion) });
      try {
        var node = doc && doc.getElementById && doc.getElementById('sdpDataToast');
        /* v0.0.6.i: the sleek Samsung One-UI progress capsule — a calm
           "🔄 Updating to vX — refreshing automatically…" instead of a blunt
           reload line. Idle devices auto-reload cleanly exactly once; the
           sdp_upgraded_to guard (checked above) is G6.4. */
        if (node) { node.textContent = '🔄 Updating to v' + String(nextVersion) + ' — refreshing automatically…'; node.hidden = false; if (node.classList) node.classList.remove('toast-hidden'); }
      } catch (e) {}
      try {
        if (window.caches && caches.keys) {
          caches.keys().then(function (ks) {
            return Promise.all(ks.map(function (k) {
              if (k.indexOf('sdp-') === 0 && k !== 'sdp-youdao-v1' && k !== 'sdp-audio-clips') {
                return caches.delete(k);
              }
              return Promise.resolve(false);
            }));
          });
        }
      } catch (e) {}
      /* v0.0.6.n cache-bust law (RC2 fix): a version upgrade must ALSO purge
         every stale briefing/guide voice clip from the preserved audio cache
         so no device can ever replay an earlier version's cached narration. */
      try { Sync.purgeStaleBriefingClips(); } catch (ePurge) {}
      setTimeout(function () { try { location.reload(); } catch (e) {} }, 400);
      return true;
    },

    /* ══ v0.0.6.n FIX 2 (RECOMMENDATION 2) — the stale audio purge law ══
     * purgeStaleBriefingClips(): deletes from caches.open('sdp-audio-clips')
     * every _intro_male_* / guide.en.* / _guide_* entry and any stale
     * elevenlabs-audio manifest body. The next briefing open re-fetches the
     * pack (v0.0.6.q: cache-first at boot, fresh after a proven syncRev bump)
     * and re-primes from the CURRENT BRIEFING_SENTENCES — an old cached
     * voice can never play. Returns a promise resolving to the number of
     * purged cache entries. */
    purgeStaleBriefingClips: function (opts) {
      opts = opts || {};
      var purged = 0;
      var done = null;
      var p = new Promise(function (resolve) { done = resolve; });
      /* v0.0.6.v — wordsRev advance purge: when the incoming manifest's
         wordsRev differs from the stored one (or the caller forces
         opts.words), every non-active words.* entry leaves the
         sdp-audio-clips cache AND state.clipBase (blob URLs revoked). */
      var wordsToo = false;
      var activeWords = {};
      try {
        var manifest = (SDP.Speech && SDP.Speech.state && SDP.Speech.state.manifest) || state.manifest || null;
        var storedRev = Number(state.wordsRev || 0);
        var incomingRev = Number((manifest && manifest.wordsRev) || (opts.manifest && opts.manifest.wordsRev) || 0);
        if (opts.words === true || (incomingRev > 0 && incomingRev !== storedRev)) {
          wordsToo = true;
          state.wordsRev = incomingRev;
          var wlist = (state.words && state.words.length) ? state.words : [];
          var wi;
          for (wi = 0; wi < wlist.length; wi++) activeWords['words.' + str(wlist[wi] && wlist[wi].w).toLowerCase()] = 1;
        }
      } catch (eRev) { wordsToo = !!opts.words; }
      if (wordsToo) {
        try {
          var base = state.clipBase || {};
          for (var bk in base) {
            if (!Object.prototype.hasOwnProperty.call(base, bk)) continue;
            if (bk.indexOf('words.') === 0 && !activeWords[bk]) {
              try {
                var ent = base[bk];
                if (ent && ent.url && ent.url.indexOf('blob:') === 0 && global.URL && global.URL.revokeObjectURL) global.URL.revokeObjectURL(ent.url);
              } catch (eU) {}
              delete base[bk];
              try { delete base[bk.replace(/^words\./, '')]; } catch (eD) {}
              purged += 1;
            }
          }
        } catch (eB) {}
      }
      try {
        if (!global.caches || !global.caches.open) { done(purged); return p; }
        global.caches.open('sdp-audio-clips').then(function (cache) {
          return cache.keys().then(function (reqs) {
            var staleRe = /(_intro_male_|guide\.en\.|_guide_|elevenlabs-audio)/i;
            if (wordsToo) staleRe = /(_intro_male_|guide\.en\.|_guide_|elevenlabs-audio|words\.)/i;
            var jobs = [];
            for (var i = 0; i < reqs.length; i++) {
              (function (req) {
                var url = String(req && req.url || '');
                if (!url || !staleRe.test(url)) return;
                if (wordsToo && /words\./i.test(url)) {
                  var mm = url.match(/words\.([a-z0-9%20-]+)/i);
                  if (mm && activeWords['words.' + mm[1].toLowerCase()]) return;
                }
                jobs.push(cache.delete(req).then(function (ok) { if (ok) purged += 1; }, function () {}));
              })(reqs[i]);
            }
            return Promise.all(jobs);
          });
        }).then(function () {
          try {
            if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('stale_audio_purged', { purged: purged, ver: APP_VERSION });
          } catch (e0) {}
          done(purged);
        }, function () { done(purged); });
      } catch (e) { done(purged); }
      return p;
    },

    /* SYNC-05 + D5: one cheap raw.githubusercontent.com read every 25 s; the
       full reconciliation happens on a real pointer move or badge tap. A
       returning tab or a regained window focus re-checks immediately, so a
       board that slept through the lunch break catches up in one tick. */
    startWatch: function (ms) {
      Sync.stopWatch();
      liveTimer = global.setInterval(function () {
        if (doc && doc.visibilityState === 'hidden') return;
        Sync.checkForUpdates(Sync.handleWatchResult);
      }, ms || 25000);
      if (doc && doc.addEventListener && !watchVisBound) {
        watchVisBound = true;
        doc.addEventListener('visibilitychange', function () {
          if (doc.visibilityState === 'visible') Sync.checkForUpdates(Sync.handleWatchResult);
        }, false);
      }
      /* D5: window focus joins visibilitychange — bound exactly once. */
      if (global.addEventListener && !watchFocusBound) {
        watchFocusBound = true;
        global.addEventListener('focus', function () {
          Sync.checkForUpdates(Sync.handleWatchResult);
        }, false);
      }
    },
    stopWatch: function () { if (liveTimer) { global.clearInterval(liveTimer); liveTimer = null; } },
    /* D16: every 30 s tick and every visibilitychange result is published,
       never discarded. Views listens for 'sdp:sync-status'; Sync.onWatchTick
       receives the same (err, result) pair for tooling. */
    handleWatchResult: function (err, result) {
      if (typeof Sync.onWatchTick === 'function') {
        try { Sync.onWatchTick(err, result); } catch (e) {}
      }
      emit('sdp:sync-status', { err: err || null, result: isObj(result) ? result : null });
    },

    /* ── audio clip resolution (no fake stubs are ever shipped) ─────────── */
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 tier 1 */
    getClipUrl: function (word) {
      var w = isObj(word) ? word : { w: word };
      if (w.clipUrl) return str(w.clipUrl);
      if (w.clip) return 'assets/audio/' + str(w.clip).replace(/^assets\/audio\//, '');
      var key = normClipKey(str(w.w));
      var bare = key.replace(/^words\./, '');
      if (key && state.clips[key]) return state.clips[key];
      if (bare && state.clips[bare]) return state.clips[bare];
      if (bare && state.clips['words.' + bare]) return state.clips['words.' + bare];
      if (w.i && state.clips['#' + w.i]) return state.clips['#' + w.i];
      return '';
    },

    /* ── publishing plumbing (Contents API + CORS-simple GAS relay) ────── */
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 publishing */
    /* v0.0.6.v — DYNAMIC REPOSITORY ORIGIN DERIVATION: the owner is read
       from the serving hostname first (owner.github.io), then the config
       repoContentsUrl, then the config fallback — so a renamed or forked
       repository never breaks publishing or the raw-CDN read path. */
    repoFromOrigin: function () {
      var cfg = state.config || {};
      var host = '';
      try { host = str(global.location && global.location.hostname); } catch (eH) { host = ''; }
      var m = host && host.match(/^([a-z0-9-]+)\.github\.io$/i);
      if (m) return { owner: m[1], name: host, source: 'hostname' };
      var um = str(cfg.repoContentsUrl || '').match(/repos\/([^\/]+)\/([^\/]+)\//);
      if (um) return { owner: um[1], name: um[2], source: 'config-url' };
      return {
        owner: str(cfg.repoOwner || 'dictationb1'),
        name: str(cfg.repoName || 'dictationb1.github.io'),
        source: 'config-fallback'
      };
    },
    repo: function () { return Sync.repoFromOrigin(); },
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
      /* D7: the GET status is inspected too, so a 401/403 can never be
         reported as a phantom write failure. Extra args stay additive. */
      global.fetch(Sync.contentsUrl(path) + '?ref=main&t=' + nowMs(), {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + str(token), Accept: 'application/vnd.github+json' }
      }).then(function (res) {
        var status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
        if (!res || typeof res.json !== 'function') return { status: status, data: null };
        return res.json().then(function (data) { return { status: status, data: data }; },
          function () { return { status: status, data: null }; });
      }).then(function (out) {
        var data = out && out.data;
        var status = Number(out && out.status) || 0;
        if (data && data.sha) { cb(null, data.sha, status, isObj(data) ? str(data.message) : ''); return; }
        /* v0.0.6.t PILLAR 3B — GitHub's GET /contents/<file> endpoint has a
           HARD 1 MB (1,048,576-byte) response limit: data/elevenlabs-audio.json
           is multi-megabyte, so the direct GET returns HTTP 403 with
           errors[0].code === "too_large" and data.sha === undefined. The
           parent-directory listing has NO per-file size limit (entries carry
           { name, path, sha, size } for files up to 100 MB), so it resolves
           the sha for ANY oversized file. */
        var tooLarge = status === 403 || status === 422 || (data && Array.isArray(data.errors));
        if (tooLarge) { Sync.getFileShaViaDir(path, token, cb); return; }
        cb(null, '', status, isObj(data) ? str(data.message) : '');
      }).catch(function (e) { cb(e || new Error('sha_failed'), '', 0, ''); });
    },
    /* PILLAR 3B fallback leg: GET /repos/{owner}/{repo}/contents/<dir> and
       match the wanted file inside the directory array. */
    getFileShaViaDir: function (path, token, cb) {
      cb = cb || noop;
      var cleanPath = str(path).replace(/^\/+/, '');
      var slash = cleanPath.lastIndexOf('/');
      var dir = slash > 0 ? cleanPath.slice(0, slash) : '';
      var fileName = slash > 0 ? cleanPath.slice(slash + 1) : cleanPath;
      if (!dir || typeof global.fetch !== 'function') { cb(null, '', 0, ''); return; }
      global.fetch(Sync.contentsUrl(dir) + '?ref=main&t=' + nowMs(), {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + str(token), Accept: 'application/vnd.github+json' }
      }).then(function (res) {
        var status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
        if (!res || typeof res.json !== 'function') return { status: status, data: null };
        return res.json().then(function (data) { return { status: status, data: data }; },
          function () { return { status: status, data: null }; });
      }).then(function (out) {
        var data = out && out.data;
        if (data && Array.isArray(data)) {
          for (var i = 0; i < data.length; i++) {
            var entry = data[i];
            if (isObj(entry) && (str(entry.path) === cleanPath || str(entry.name) === fileName) && entry.sha) {
              cb(null, str(entry.sha), 200, '');
              return;
            }
          }
        }
        cb(null, '', Number(out && out.status) || 0, isObj(data) ? str(data.message) : '');
      }).catch(function (e) { cb(e || new Error('sha_dir_failed'), '', 0, ''); });
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
    /* Binary clip commit (base64 already in hand, e.g. a MediaRecorder blob). */
    commitClipFile: function (path, base64, message, token, cb) {
      cb = cb || noop;
      if (!token) { cb(new Error('no_token')); return; }
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return; }
      Sync.getFileSha(path, token, function (err, sha) {
        var payload = { message: str(message || 'Smart Dictation clip'), content: str(base64), branch: 'main' };
        if (sha && !err) payload.sha = str(sha);
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
          .then(null, function (e) { cb(e || new Error('commit_failed')); });
      });
    },

    /* D6: the keys relay never carries the lecturer PIN in the JSON body.
       Body: { action: 'publish', app: 'sdp', ver } only. */
    /* ══ D-S5: strictly sequential Contents API publisher ═══════════════
     * v0.0.1.b fired three PUTs with Promise.all. GitHub moves the branch ref
     * on every commit, so the 2nd and 3rd PUT arrived with a stale blob sha and
     * failed with HTTP 409 Conflict — which is why a lecturer's session (and
     * sometimes the encrypted keys) silently never reached the repository.
     * Here one file is committed at a time: fresh sha -> PUT -> await the
     * commit response -> next file, with exactly one 409 retry, and
     * data/version.json always LAST so no device ever sees a version stamp
     * pointing at a session that has not landed yet. */
    /* R6/D7: every GitHub HTTP status becomes one human sentence. No raw
       status, no raw JSON `message` and no `commit_failed` reaches the DOM. */
    publishErrorText: function (status, ghMsg) {
      var s = Number(status) || 0, text;
      if (s === 401) text = 'GitHub token expired or revoked (401)';
      else if (s === 403) text = 'GitHub token lacks write access (403)';
      else if (s === 404) text = 'Repository or path not found (404)';
      else if (s === 409) text = 'Concurrent edit conflict (409)';
      else if (s === 413) text = 'Payload too large for the Contents API (413)';
      else if (s === 422) text = 'Payload rejected (422)';
      else if (s >= 500) text = 'GitHub server error (' + s + ')';
      else text = 'Network problem — check your internet and try again';
      var note = str(ghMsg);
      if (note && text.indexOf(note) < 0) text += ' · ' + note;
      return text;
    },

    /* v0.0.6.t PILLAR 3B — the Git Data API large-blob commit path. The
       Contents API PUT /contents/<file> rejects multi-megabyte JSON bodies
       (HTTP 413 payload-too-large, 422 or 502 even WITH a valid sha), which
       is exactly what broke every Cloned-Voice publish of the ~3.5 MB
       data/elevenlabs-audio.json on v0.0.6.s. The Git Data API has no such
       wall: POST /git/blobs (base64) -> GET /git/refs/heads/main ->
       GET /git/commits/<head> -> POST /git/trees (base_tree + new blob) ->
       POST /git/commits -> PATCH /git/refs/heads/main. */
    commitViaGitDataApi: function (path, base64Content, message, token, cb) {
      cb = cb || noop;
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return; }
      if (!token) { cb(new Error('no_token')); return; }
      var repo = Sync.repo();
      var api = 'https://api.github.com/repos/' + repo.owner + '/' + repo.name;
      var headers = { Authorization: 'Bearer ' + str(token), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
      function gh(method, url, body) {
        return global.fetch(url, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
          .then(function (res) {
            return res.json().then(function (data) { return { ok: !!res.ok, status: Number(res.status) || 0, data: data }; },
              function () { return { ok: false, status: Number(res.status) || 0, data: null }; });
          });
      }
      var blobSha = '', headSha = '', baseTreeSha = '';
      gh('POST', api + '/git/blobs', { content: str(base64Content), encoding: 'base64' })
        .then(function (out) {
          if (!out.ok || !(out.data && out.data.sha)) throw Object.assign(new Error('blob_failed'), { status: out.status });
          blobSha = str(out.data.sha);
          return gh('GET', api + '/git/refs/heads/main');
        })
        .then(function (out) {
          if (!out.ok || !(out.data && out.data.object && out.data.object.sha)) throw Object.assign(new Error('ref_failed'), { status: out.status });
          headSha = str(out.data.object.sha);
          return gh('GET', api + '/git/commits/' + headSha);
        })
        .then(function (out) {
          if (!out.ok || !(out.data && out.data.tree && out.data.tree.sha)) throw Object.assign(new Error('commit_failed'), { status: out.status });
          baseTreeSha = str(out.data.tree.sha);
          return gh('POST', api + '/git/trees', {
            base_tree: baseTreeSha,
            tree: [{ path: str(path).replace(/^\/+/, ''), mode: '100644', type: 'blob', sha: blobSha }]
          });
        })
        .then(function (out) {
          if (!out.ok || !(out.data && out.data.sha)) throw Object.assign(new Error('tree_failed'), { status: out.status });
          return gh('POST', api + '/git/commits', {
            message: str(message || ('Smart Dictation publish ' + APP_VERSION)),
            tree: str(out.data.sha),
            parents: [headSha],
            committer: { name: 'Smart Dictation Studio', email: 'studio@users.noreply.github.com' }
          });
        })
        .then(function (out) {
          if (!out.ok || !(out.data && out.data.sha)) throw Object.assign(new Error('commit_failed'), { status: out.status });
          return gh('PATCH', api + '/git/refs/heads/main', { sha: str(out.data.sha), force: false });
        })
        .then(function (out) {
          if (!out.ok) throw Object.assign(new Error('ref_update_failed'), { status: out.status });
          cb(null, { via: 'git-data-api', path: str(path) });
        })
        .catch(function (e) { cb(e || new Error('git_data_api_failed')); });
    },

    publishFilesSequential: function (files, token, onFileStatus, cb, opts) {
      onFileStatus = onFileStatus || noop;
      cb = cb || noop;
      opts = isObj(opts) ? opts : {};
      var list = Array.isArray(files) ? files.slice() : [];
      if (!token) { cb(new Error('no_token'), { ok: false, published: 0, failed: list.length }); return false; }
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch'), { ok: false, published: 0, failed: list.length }); return false; }
      /* Hard ordering law: version.json last, everything else in given order. */
      var head = [], tail = [], i;
      for (i = 0; i < list.length; i++) {
        var item = list[i] || {};
        if (str(item.path).indexOf('data/version.json') >= 0) tail.push(item);
        else head.push(item);
      }
      var queue = head.concat(tail);
      var at = 0, published = 0, failedList = [], errorsList = [];
      /* D16: one 5xx / network retry after 2 s (50 ms when a gate passes it). */
      var retryDelayMs = Number(opts.retryDelayMs) >= 0 ? Number(opts.retryDelayMs) : 2000;
      function finish() {
        var err = null;
        if (failedList.length) {
          err = new Error('publish_partial');
          err.reason = errorsList.length ? str(errorsList[0].message) : Sync.publishErrorText(0, '');
          err.status = errorsList.length ? Number(errorsList[0].status) || 0 : 0;
          err.errors = errorsList.slice();
        }
        cb(err, {
          ok: failedList.length === 0,
          published: published,
          failed: failedList.slice(),
          errors: errorsList.slice(),
          reason: err ? err.reason : '',
          order: queue.map(function (f) { return str(f.path); })
        });
      }
      function failFile(file, status, ghMsg) {
        var reason = Sync.publishErrorText(status, ghMsg);
        errorsList.push({ path: file.path, status: Number(status) || 0, message: reason });
        failedList.push(file.path);
        onFileStatus(file.path, false, reason);
      }
      function readResponse(res) {
        var status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
        if (!res || typeof res.json !== 'function') return Promise.resolve({ status: status, data: null });
        return res.json().then(function (data) { return { status: status, data: data }; },
          function () { return { status: status, data: null }; });
      }
      function step() {
        if (at >= queue.length) { finish(); return; }
        var file = queue[at];
        at += 1;
        if (!file || !file.path) { step(); return; }
        putOne(file, {});
      }
      function putOne(file, flags) {
        flags = flags || {};
        Sync.getFileSha(file.path, token, function (err, sha, getStatus, getMsg) {
          var body = Sync.buildContentsCommitPayload(file.path, str(file.content), file.message, err ? '' : sha);
          var req;
          try {
            req = global.fetch(Sync.contentsUrl(file.path), {
              method: 'PUT',
              headers: {
                Authorization: 'Bearer ' + str(token),
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(body)
            });
          } catch (e) {
            req = Promise.reject(e || new Error('network_error'));
          }
          if (!req || typeof req.then !== 'function') req = Promise.reject(new Error('network_error'));
          req.then(readResponse, function () { return { status: 0, data: null, network: true }; })
            .then(function (out) {
              var status = Number(out && out.status) || 0;
              var data = out && out.data;
              var ghMsg = isObj(data) ? str(data.message) : '';
              if (status >= 200 && status < 300 && data && data.content && data.content.sha) {
                published += 1;
                onFileStatus(file.path, true, null);
                step();
                return;
              }
              /* v0.0.4.b: up to three fresh-SHA retries on a branch-ref race (409).
                 Production callers may pace them with opts.retryDelayMs (250 ms). */
              if (status === 409 && Number(flags.tries || 0) < 3) {
                var nextFlags = { conflict: true, transient: flags.transient, tries: Number(flags.tries || 0) + 1 };
                var pace = opts.retryDelayMs === undefined ? 250 : Number(opts.retryDelayMs);
                if (pace > 0) global.setTimeout(function () { putOne(file, nextFlags); }, pace);
                else putOne(file, nextFlags);
                return;
              }
              /* D16: one delayed retry with a fresh GET sha on 5xx / network. */
              if ((status === 0 || status >= 500) && !flags.transient) {
                global.setTimeout(function () {
                  putOne(file, { conflict: flags.conflict, transient: true });
                }, retryDelayMs);
                return;
              }
              /* v0.0.6.t PILLAR 3B: a multi-megabyte payload (the voice pack)
                 that the Contents API rejects with 413 / 422 / 502 even with
                 a valid sha is committed through the Git Data API instead —
                 blobs -> refs -> commits -> trees -> commits -> PATCH ref —
                 so Cloned-Voice packs reach GitHub 100% reliably. */
              if ((status === 413 || status === 422 || status === 502) && !flags.gitDataApi) {
                var b64body = '';
                try { b64body = b64encode(utf8Encode(str(file.content))); } catch (eB64) { b64body = ''; }
                if (b64body) {
                  Sync.commitViaGitDataApi(file.path, b64body, file.message, token, function (gErr) {
                    if (!gErr) {
                      published += 1;
                      onFileStatus(file.path, true, null);
                      step();
                      return;
                    }
                    failFile(file, status, ghMsg + ' · git-data-api: ' + str(gErr.message));
                    step();
                  });
                  return;
                }
              }
              if (status === 0 && (getStatus === 401 || getStatus === 403)) status = Number(getStatus) || 0;
              failFile(file, status, ghMsg || (status === 0 ? str(getMsg) : ''));
              step();
            });
        });
      }
      step();
      return true;
    },

    /* ══ SYNC-05: the 30 s watcher reads ONLY this file ═════════════════
     * raw.githubusercontent.com is a static CDN edge with no rate limit, so a
     * classroom of boards can poll it all day. api.github.com allows 60
     * requests per hour per IP and is therefore never touched by the timer. */
    fetchRawMainJson: function (relPath, cb) {
      cb = cb || noop;
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
      var repo = Sync.repo();
      var path = str(relPath).replace(/^\.?\/+/, '');
      var url = 'https://raw.githubusercontent.com/' + repo.owner + '/' + repo.name + '/main/' + path + '?t=' + nowMs();
      var done = false;
      function finish(err, data) {
        if (done) return;
        done = true;
        cb(err, data);
      }
      function attemptFetch(u, retried) {
        try {
          global.fetch(u, { cache: 'no-store' })
            .then(function (res) { return res && res.ok && res.json ? res.json() : null; })
            .then(function (data) {
              if (data) { finish(null, data); return; }
              /* v0.0.6.v — sync_origin_healed: a 404/error with a non-hostname
                 derivation re-derives from the hostname ONCE and retries. */
              if (!retried && repo.source !== 'hostname') {
                var healed = Sync.repoFromOrigin();
                if (healed.source === 'hostname' && (healed.owner !== repo.owner || healed.name !== repo.name)) {
                  try { if (SDP.Diagnostics) SDP.Diagnostics.log('sync_origin_healed', { from: repo.owner, to: healed.owner }); } catch (eL) {}
                  attemptFetch('https://raw.githubusercontent.com/' + healed.owner + '/' + healed.name + '/main/' + path + '?t=' + nowMs(), true);
                  return;
                }
              }
              finish(new Error('raw_unavailable'));
            }, function () { finish(new Error('raw_failed')); });
        } catch (e) { finish(new Error('raw_failed')); }
      }
      attemptFetch(url, false);
      /* v0.0.6.t PILLAR 3C: the raw-CDN leg of a fresh voice-pack download
         needs the same 25 s budget on mobile data (version.json keeps 5 s). */
      global.setTimeout(function () { finish(new Error('raw_timeout')); }, /elevenlabs-audio\.json/i.test(path) ? 25000 : 5000);
      return true;
    },

    /* The timer tick: read version.json from raw main (CDN fallback) and only
       escalate to a full checkForUpdates() when a pointer actually moved. */
    pollVersionTick: function (cb) {
      cb = cb || noop;
      function compare(remote) {
        if (!remote) { cb(null, { ok: false, error: 'bad_response', changed: false }); return; }
        var local = state.version || {};
        var applied = 0;
        try { applied = Number(Data.settings().appliedSettingsRev) || 0; } catch (e) { applied = 0; }
        var remoteAppVer = parseRemoteAppVer(remote);
        var moved = Number(remote.syncRev || 0) > Number(local.syncRev || 0) ||
          Number(remote.settingsRev || 0) > applied ||
          (!!remoteAppVer && remoteAppVer !== APP_VERSION);
        if (!moved) {
          state.lastCheck = nowMs();
          state.lastCheckSource = 'raw';
          cb(null, { ok: true, error: null, changed: false, checked: true, source: 'raw' });
          return;
        }
        Sync.checkForUpdates(cb);
      }
      Sync.fetchRawMainJson('data/version.json', function (err, data) {
        if (!err && data) { compare(data); return; }
        fetchJSON('./data/version.json', function (err2, data2) {
          if (err2 || !data2) { cb(err2 || err || new Error('bad_response'), { ok: false, changed: false }); return; }
          compare(data2);
        }, { fresh: true });
      });
    },

    /* ══ Studio-only token-bearing read (D5): students never call this. The
     * Contents API answers while the Pages CDN rebuilds; without a token the
     * caller degrades to the same raw CDN every student uses. */
    fetchRawGitHubJson: function (path, cb, token) {
      cb = cb || noop;
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
      var repo = Sync.repo();
      var url = 'https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/contents/' +
        str(path).replace(/^\/+/, '') + '?ref=main&t=' + nowMs();
      var headers = { Accept: 'application/vnd.github+json' };
      if (token) headers.Authorization = 'Bearer ' + str(token);
      var done = false;
      function finish(err, data) {
        if (done) return;
        done = true;
        cb(err, data);
      }
      try {
        global.fetch(url, { cache: 'no-store', headers: headers })
          .then(function (res) { return res && res.ok && res.json ? res.json() : null; })
          .then(function (data) {
            if (!data || !data.content) { finish(new Error('raw_unavailable')); return; }
            var text = '';
            try {
              text = utf8Decode(b64decode(str(data.content)));
            } catch (e) { text = ''; }
            if (!text) { finish(new Error('raw_unavailable')); return; }
            var parsed = null;
            try { parsed = JSON.parse(text); } catch (e) { finish(new Error('raw_bad_json')); return; }
            finish(null, parsed);
          }, function () { finish(new Error('raw_failed')); });
      } catch (e) { finish(new Error('raw_failed')); return false; }
      global.setTimeout(function () { finish(new Error('raw_timeout')); }, 5000);
      return true;
    },

    /* D-S8: the PIN is a local unlock secret and must never enter a JSON body
       that leaves the device. The parameter is accepted and deliberately
       ignored so no caller can smuggle it back in. */
    buildKeysRelayPayload: function (action) {
      return JSON.stringify({ action: str(action || 'status'), app: 'sdp', ver: APP_VERSION });
    },
    publishWordsChunked: function (words, limitBytes) {
      var cap = Number(limitBytes) || 39000;
      var chunks = [], current = [], size = 2, i;
      var list = Array.isArray(words) ? words : [];
      for (i = 0; i < list.length; i++) {
        var item = list[i] || {};
        var line = JSON.stringify({ w: str(item.w), p: str(item.p), pos: str(item.pos), m: str(item.m), si: str(item.si), s: str(item.s) });
        /* Sinhala is 3 bytes per glyph in UTF-8, so the limit is measured in
           encoded bytes, exactly like the Apps Script cell budget. */
        var added = utf8Encode(line).length + 1;
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
    /* v0.0.6.m FIX 4: push a sealed review envelope to the cloud relay.
       The preserved Apps Script schema (addMessage: text<=600, meta<=200)
       cannot carry a multi-KB AES-GCM envelope, so the cloud copy carries
       the digest (chips + text preview + envelope head) and the FULL
       envelope stays durable through the local sdpDiag vault, the Studio
       .zip export and the creator's GitHub publish path. */
    pushReviewEnvelope: function (envelope, cb) {
      cb = cb || noop;
      var head = str(envelope);
      var relayUrl = '';
      try {
        if (global.SDP && SDP.Studio && SDP.Studio.secrets) relayUrl = str(SDP.Studio.secrets().gasUrl || '');
      } catch (e0) {}
      if (!relayUrl && state.config && state.config.live && state.config.live.state) {
        /* fall back to the configured live-state relay topic */
        relayUrl = str(state.config.live.state);
      }
      if (!relayUrl) { cb(new Error('no_relay')); return false; }
      var body = {
        action: 'message',
        name: 'Smart Dictation ' + APP_VERSION,
        cat: 'review',
        text: 'Sealed student review (SDP_ENC_V2) — full envelope kept on-device and in the Studio export.',
        contact: '',
        meta: head.slice(0, 200)
      };
      Data.postRelay(relayUrl, JSON.stringify(body), function (err, data) {
        try {
          Diagnostics.log('review_cloud_push', { ok: !err, relay: relayUrl.slice(0, 60) });
        } catch (e1) {}
        cb(err, data);
      });
      return true;
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

    /* D8: bounded live-state poll — 8 second timeout, clean /json?poll=1 URL,
       never hangs a low-end phone on a dead relay. */
    pollLiveState: function (cb) {
      cb = cb || noop;
      var cfg = state.config || {};
      var topic = cfg.live && cfg.live.state ? cfg.live.state : '';
      if (!topic || typeof global.fetch !== 'function') { cb(new Error('no_live')); return; }
      var done = false, timer = null;
      function finish(err, data) { if (done) return; done = true; if (timer) global.clearTimeout(timer); cb(err, data); }
      timer = global.setTimeout(function () { finish(new Error('timeout')); }, 8000);
      global.fetch(topic + '/json?poll=1', { cache: 'no-store' })
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
          finish(null, latest);
        })
        .catch(function (e) { finish(e || new Error('live_failed')); });
    },

    /* D1: download the 30 word-audio URLs into the SW audio caches so a
       1–2 GB Android can practise fully offline. Posts sdp:cache-words to the
       SW controller; falls back to a direct Cache API fetch in JSDOM or when
       the controller is not yet attached. */
    downloadOfflineAudio: function (words, onProgress, cb) {
      cb = cb || noop; onProgress = onProgress || noop;
      var urls = [], i, w;
      for (i = 0; i < (words || []).length; i++) {
        w = words[i] || {};
        var url = str(w.clipUrl || w.audio || '');
        if (url) urls.push(url);
      }
      var done = 0, settled = false;
      function report() { try { onProgress(done, urls.length); } catch (e) {} }
      function finish() {
        if (settled) return; settled = true;
        cb(null, { cached: done, total: urls.length });
      }
      if (!urls.length) { finish(); return; }
      if (global.navigator && global.navigator.serviceWorker && global.navigator.serviceWorker.controller) {
        global.navigator.serviceWorker.controller.postMessage({ type: 'sdp:cache-words', urls: urls });
        var listener = function (ev) {
          var d = ev && ev.data;
          if (d && d.type === 'sdp:cache-progress') {
            done = Number(d.cached) || 0; report();
            if (done >= Number(d.total || urls.length)) {
              global.navigator.serviceWorker.removeEventListener('message', listener);
              finish();
            }
          }
        };
        global.navigator.serviceWorker.addEventListener('message', listener, false);
        global.setTimeout(function () { finish(); }, 20000);
        return;
      }
      /* Direct cache fallback: SW-less browsers and headless test harnesses. */
      var pending = urls.length;
      for (i = 0; i < urls.length; i++) {
        (function (url) {
          try {
            global.caches.open('sdp-youdao-v1').then(function (cache) {
              return global.fetch(url).then(function (res) {
                if (res && (res.ok || res.type === 'opaque')) {
                  try { cache.put(url, res.clone()); } catch (e) {}
                }
                return res;
              }, function () { return null; });
            }).then(function () {
              done += 1; report();
              if (done >= pending) finish();
            }, function () {
              done += 1; report();
              if (done >= pending) finish();
            });
          } catch (e) {
            done += 1; report();
            if (done >= pending) finish();
          }
        })(urls[i]);
      }
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
  /* v0.0.6.j Pillar 3: the privacy-safe diagnostics ring buffer + the
     encrypted student-review capture the Studio .zip exports. */
  SDP.Diagnostics = Diagnostics;
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
