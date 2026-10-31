/* SECTION 60 - v55 PIN-ENCRYPTED ADMIN VAULT, <600-BYTE KEYS RELAY & UNIVERSAL CROSS-DEVICE SYNC (pure ES5) */
(function () {
  var PIN = "", SALT = "::sdp_galle_v55_salt", PFX = "SDP_ENC_V1:";
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  var KEYS = "https://ntfy.sh/dictationb1_sdp_keys_v55";
  var WORDS = "https://ntfy.sh/dictationb1_sdp_words_v55";
  var AUDIO = "https://ntfy.sh/dictationb1_sdp_audio_v55";
  var CFG = {
    version: 55, appVersion: "6.1.0", schema: 55, settingsRev: 55, key: "sdp.v55_guaranteed_device_sync",
    voiceId: "Xb7hH8MSUJpSbSDYk0k2", modelId: "eleven_flash_v2_5", adminPin: PIN, file: "./data/studio.js?v=55",
    keysTopic: KEYS, wordsTopic: WORDS, audioTopic: AUDIO,
    repoOwner: "dictationb1", repoName: "dictationb1.github.io", branch: "main"
  };
  window.EV55 = CFG;
  window.EV53 = CFG;
  function enc8(s) { try { return unescape(encodeURIComponent(String(s))); } catch (e) { return String(s); } }
  function dec8(s) { try { return decodeURIComponent(escape(String(s))); } catch (e) { return ""; } }
  function b64e(s) {
    var o = "", n = s.length, i, a, b, c;
    for (i = 0; i < n; i += 3) {
      a = s.charCodeAt(i); b = i + 1 < n ? s.charCodeAt(i + 1) : -1; c = i + 2 < n ? s.charCodeAt(i + 2) : -1;
      o += B64.charAt(a >> 2) + B64.charAt(((a & 3) << 4) | (b < 0 ? 0 : b >> 4));
      if (b < 0) { continue; }
      o += B64.charAt(((b & 15) << 2) | (c < 0 ? 0 : c >> 6));
      if (c < 0) { continue; }
      o += B64.charAt(c & 63);
    }
    return o;
  }
  function b64d(s) {
    var o = "", n = s.length, i, a, b, c, d;
    for (i = 0; i < n; i += 4) {
      a = B64.indexOf(s.charAt(i)); b = B64.indexOf(s.charAt(i + 1));
      if (a < 0 || b < 0) { break; }
      c = i + 2 < n ? B64.indexOf(s.charAt(i + 2)) : -1;
      d = i + 3 < n ? B64.indexOf(s.charAt(i + 3)) : -1;
      o += String.fromCharCode((a << 2) | (b >> 4));
      if (c >= 0) { o += String.fromCharCode(((b & 15) << 4) | (c >> 2)); }
      if (c >= 0 && d >= 0) { o += String.fromCharCode(((c & 3) << 6) | d); }
    }
    return o;
  }
  function kdf(pin) {
    var k = String(pin || PIN) + SALT + "::" + PIN, i;
    for (i = 0; i < 8; i++) { k = Sha.hex(k + "|" + i + SALT); }
    return k;
  }
  function stream(key, n) {
    var out = [], i, h, j;
    for (i = 0; out.length < n && i < 8192; i++) {
      h = Sha.hex(key + "#" + i);
      for (j = 0; j < h.length && out.length < n; j += 2) { out.push(parseInt(h.substring(j, j + 2), 16)); }
    }
    return out;
  }
  function macOf(key, s) { return Sha.hex(key + "|sdp-v55-mac|" + s).substring(0, 16); }
  function tagOf(hex) {
    var o = [], i;
    for (i = 0; i < 16; i += 2) { o.push(parseInt(hex.substring(i, i + 2), 16)); }
    return o;
  }
  function chars(list) {
    var o = "", i;
    for (i = 0; i < list.length; i += 2048) { o += String.fromCharCode.apply(null, list.slice(i, i + 2048)); }
    return o;
  }
  /* the compact (keys-only) record travels on a < 600 byte WIRE: short field names keep it tiny */
  function canon(d) {
    if (!d || typeof d !== "object") { return d; }
    if (d.r === undefined || d.elevenLabsKey !== undefined) { return d; }
    return {
      syncRev: Number(d.r) || 0, elevenLabsKey: String(d.k || ""), elevenLabsVoiceId: String(d.v || ""),
      elevenLabsModel: String(d.m || ""), ghToken: String(d.g || ""), activeVideoSrc: String(d.w || ""),
      videoDim: Number(d.d) || 0, mode: String(d.mo || ""), writeFixed: Number(d.wf) || 0, repeats: Number(d.rp) || 0, keysOnly: true
    };
  }
  var EncryptedVault = {
    PREFIX: PFX, PIN: PIN, SALT: SALT, compact: true,
    encrypt: function (payload, pin) {
      var key = kdf(pin), json = JSON.stringify(payload || {}), data = enc8(json), ks = stream(key, data.length), head = tagOf(macOf(key, json)), out = [], i;
      for (i = 0; i < data.length; i++) { out.push((data.charCodeAt(i) ^ ks[i]) & 255); }
      return PFX + b64e(chars(head) + chars(out));
    },
    decrypt: function (cipher, pin) {
      if (typeof cipher !== "string" || cipher.indexOf(PFX) !== 0) { return null; }
      var raw = b64d(cipher.substring(PFX.length)), key, body, ks, plain = "", i, json, obj, tag;
      if (raw.length < 9) { return null; }
      key = kdf(pin);
      body = raw.substring(8);
      ks = stream(key, body.length);
      for (i = 0; i < body.length; i++) { plain += String.fromCharCode((body.charCodeAt(i) ^ ks[i]) & 255); }
      json = dec8(plain);
      try { obj = JSON.parse(json); } catch (e) { return null; }
      if (!obj || typeof obj !== "object") { return null; }
      tag = macOf(key, json);
      for (i = 0; i < 16; i += 2) { if (raw.charCodeAt(i / 2) !== parseInt(tag.substring(i, i + 2), 16)) { return null; } }
      return obj;
    },
    isVault: function (cipher) { return typeof cipher === "string" && cipher.indexOf(PFX) === 0; },
    payload: function () {
      var s = DB.data.settings = DB.data.settings || {}, ses = DB.data.session = DB.data.session || {}, l = null;
      try { l = Lib.current(); } catch (e) { l = null; }
      if (!l) { l = (DB.data.lists && DB.data.lists[0]) || {}; }
      return {
        syncRev: Number(DB.data.syncRev) || 0,
        elevenLabsKey: String(s.elevenLabsKey || ""),
        elevenLabsVoiceId: String(s.elevenLabsVoiceId || CFG.voiceId),
        elevenLabsModel: String(s.elevenLabsModelId || CFG.modelId),
        ghToken: String((Cloud.ghToken && Cloud.ghToken()) || ""),
        adminPin: PIN,
        activeVideoSrc: String(s.activeVideoSrc || DEFAULT_WALLPAPER_SRC),
        videoDim: Number(s.videoDim) || 18,
        mode: String(s.mode || "paper"),
        writeFixed: Number(s.writeFixed) || 5,
        repeats: Number(s.repeats) || 2,
        sessionNo: String(ses.no || ""),
        sessionTitle: String(ses.title || ""),
        sessionDate: String(ses.date || ""),
        classInfo: String(ses.classInfo || CONFIG.classInfo || ""),
        listName: String(l.name || ""),
        words: l.words || []
      };
    },
    applyWords: function (list, name) {
      var l = null, cur = null, out = [], i, w;
      if (!list || !list.length) { return 0; }
      try { cur = Lib.current(); if (cur && cur.id) { l = Lib.byId(cur.id); } } catch (e) { l = null; }
      if (!l) { l = (DB.data.lists && DB.data.lists[0]) || null; }
      if (!l) { return 0; }
      for (i = 0; i < list.length; i++) {
        w = list[i] || {};
        out.push(typeof w === "string" ? { w: w, s: "", m: "" } : {
          w: String(w.w || ""), p: String(w.p || ""), t: String(w.t || w.pos || ""),
          m: String(w.m || w.d || ""), si: String(w.si || w.m || ""), s: String(w.s || w.ex || ""), audio: w.audio || ""
        });
      }
      l.words = out;
      l.publishedWords = out;
      l.published = true;
      l.draft = false;
      if (name) { l.name = String(name); l.publishedName = String(name); }
      l.updatedAt = Date.now();
      return out.length;
    },
    applyRemoteVault: function (cipher, pin) {
      var d = canon(this.decrypt(cipher, pin || PIN)), s, ses, local, rev, fresh, gap, words = 0;
      if (!d) { return null; }
      s = DB.data.settings = DB.data.settings || {};
      ses = DB.data.session = DB.data.session || {};
      local = Number(DB.data.syncRev) || 0;
      rev = Number(d.syncRev) || 0;
      fresh = rev >= local;
      gap = !s.elevenLabsKey && !!d.elevenLabsKey;
      if (!fresh && !gap) { return null; }
      if (d.elevenLabsKey) { s.elevenLabsKey = String(d.elevenLabsKey); }
      if (d.elevenLabsVoiceId) { s.elevenLabsVoiceId = String(d.elevenLabsVoiceId); }
      if (d.elevenLabsModel) { s.elevenLabsModelId = String(d.elevenLabsModel); s.elevenLabsModel = String(d.elevenLabsModel); }
      if (d.ghToken && Cloud.ghToken) { try { Cloud.ghToken(String(d.ghToken)); } catch (e) {} }
      if (d.activeVideoSrc) { s.activeVideoSrc = String(d.activeVideoSrc); }
      if (d.videoDim) { s.videoDim = Number(d.videoDim); }
      if (d.mode) { s.mode = String(d.mode); }
      if (d.writeFixed) { s.writeFixed = Number(d.writeFixed); }
      if (d.repeats) { s.repeats = Number(d.repeats); }
      if (fresh) {
        if (d.sessionTitle) { ses.title = String(d.sessionTitle); }
        if (d.sessionDate) { ses.date = String(d.sessionDate); }
        if (d.classInfo) { ses.classInfo = String(d.classInfo); }
        if (d.words && d.words.length) { words = this.applyWords(d.words, d.listName); }
        DB.data.syncRev = Math.max(local, rev);
      }
      DB.data.vaultCiphertext = String(cipher);
      DB.saveNow();
      try { this.paint(); } catch (e) {}
      return { rev: rev, key: d.elevenLabsKey || "", words: words, fresh: fresh };
    },
    paint: function () {
      var s = (DB.data && DB.data.settings) || {}, ses = (DB.data && DB.data.session) || {}, l = null, words = [], i;
      function set(id, v) { var el = document.getElementById(id); if (el && v !== null && v !== undefined && el.value !== v) { el.value = v; } }
      try { l = Lib.current(); } catch (e) { l = null; }
      for (i = 0; l && l.words && i < l.words.length; i++) { words.push(l.words[i].w || l.words[i]); }
      set("elApiKeyInput", String(s.elevenLabsKey || ""));
      set("elVoiceSelect", String(s.elevenLabsVoiceId || CFG.voiceId));
      set("elModelSelect", String(s.elevenLabsModelId || CFG.modelId));
      if (Cloud.ghToken) { set("ghTokenInput", String(Cloud.ghToken() || "")); }
      set("profSessionTitle", String(ses.title || ""));
      set("profSessionDate", String(ses.date || ""));
      set("profClassInfo", String(ses.classInfo || ""));
      set("adminQuickWordsInput", words.join("\n"));
      try { if (window.SDPRefreshStudio) { window.SDPRefreshStudio(); } } catch (e) {}
      return words.length;
    }
  };
  window.EncryptedVault = EncryptedVault;
  window.AdminVault = EncryptedVault;

  /* ---- schema migration to v55 (keeps every saved word, list and key) ---- */
  var previous = DB.migrate;
  DB.resetToV55 = function (data) {
    var d = data || {}, s = d.settings = d.settings || {};
    s.elevenLabsKey = s.elevenLabsKey || "";
    s.elevenLabsVoiceId = s.elevenLabsVoiceId || CFG.voiceId;
    s.elevenLabsModelId = s.elevenLabsModelId || CFG.modelId;
    s.activeVideoSrc = s.activeVideoSrc || DEFAULT_WALLPAPER_SRC;
    s.activeMediaType = "video";
    s.videoDim = Number(s.videoDim) || 18;
    d.syncRev = Number(d.syncRev) || 0;
    d.vaultCiphertext = String(d.vaultCiphertext || "");
    d.settingsRev = CFG.settingsRev;
    d.v = CFG.schema;
    return d;
  };
  DB.resetToV54 = DB.resetToV55;
  DB.migrate = function (data) {
    var state = previous.call(this, data) || data;
    if (!state) { return state; }
    if ((Number(state.settingsRev) || 0) < CFG.settingsRev) { state = DB.resetToV55(state); }
    state.settingsRev = CFG.settingsRev;
    state.v = CFG.schema;
    return state;
  };
  CONFIG.schema = CFG.schema;
  CONFIG.settingsRev = CFG.settingsRev;
  CONFIG.key = CFG.key;
  CONFIG.appVersion = CFG.appVersion;
  CONFIG.adminPin = PIN;
  CONFIG.gasUrl = CONFIG.gasUrl || "";
  CONFIG.keysTopic = KEYS;
  CONFIG.wordsTopic = WORDS;
  CONFIG.vaultTopic = KEYS;
  CONFIG.audioTopic = AUDIO;
  CONFIG.repoOwner = CONFIG.repoOwner || CFG.repoOwner;
  CONFIG.repoName = CONFIG.repoName || CFG.repoName;

  /* ---- the professor studio still loads on demand from data/studio.js --- */
  var state = 0, waiters = [];
  function done() {
    var list = waiters, i;
    state = 2;
    waiters = [];
    for (i = 0; i < list.length; i++) { try { list[i](); } catch (e) {} }
  }
  function load(cb) {
    var el;
    if (state === 2) { if (cb) { cb(); } return true; }
    if (cb) { waiters.push(cb); }
    if (state === 1) { return false; }
    state = 1;
    try {
      el = document.createElement("script");
      el.src = CFG.file;
      el.async = true;
      el.onload = done;
      el.onerror = function () { state = 0; waiters = []; if (el.parentNode) { el.parentNode.removeChild(el); } };
      (document.head || document.documentElement).appendChild(el);
    } catch (e) { state = 1; waiters = []; }
    return true;
  }
  window.SDPCore = {
    DB: DB, Speech: Speech, UI: UI, U: U, Lib: Lib, Admin: Admin, Cloud: Cloud, CONFIG: CONFIG, GUIDE: GUIDE,
    Store: Store, Screens: Screens, DEFAULT_WALLPAPER_SRC: DEFAULT_WALLPAPER_SRC, BUILD_DATE: BUILD_DATE,
    wordRow: wordRow, SAMPLE_WORDS: SAMPLE_WORDS, WORD_BANK: WORD_BANK, Dict: Dict, APP_VERSION: APP_VERSION,
    EncryptedVault: EncryptedVault, Sha: Sha, EV55: CFG, EV54: CFG, CFG: CFG
  };
  window.SDPStudio = load;
  window.SDPStudioReady = function () { return state === 2; };
  var openPanel = Admin.open;
  Admin.open = function () { load(); return openPanel.apply(this, arguments); };
  var unlockAdmin = Admin.unlock;
  Admin.unlock = function () {
    var r = unlockAdmin.apply(this, arguments);
    try {
      EncryptedVault.applyRemoteVault(DB.data.vaultCiphertext);
      EncryptedVault.paint();
      if (window.UniversalSync) {
        window.UniversalSync.banner();
        window.UniversalSync.pullAll(function () { try { EncryptedVault.paint(); } catch (e) {} });
      }
      setTimeout(function () { try { EncryptedVault.paint(); } catch (e) {} }, 0);
    } catch (e) {}
    return r;
  };
  var saveNow = DB.saveNow;
  DB.saveNow = function () {
    var r = saveNow.apply(this, arguments);
    try { if (window.UniversalSync) { window.UniversalSync.touch(); } } catch (e) {}
    return r;
  };
  try {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && window.UniversalSync) { try { window.UniversalSync.pullAll(function () {}); } catch (e) {} }
    });
  } catch (e) {}
  function start() {
    try {
      if (EncryptedVault.isVault(DB.data.vaultCiphertext)) { EncryptedVault.applyRemoteVault(DB.data.vaultCiphertext); }
    } catch (e) {}
    load(function () {
      try { if (window.UniversalSync) { window.UniversalSync.boot(); } } catch (e) {}
    });
    setTimeout(function () { load(); }, 0);
  }
  try {
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", start); }
    else { setTimeout(start, 0); }
  } catch (e) { setTimeout(start, 0); }
})();
