/* SECTION 64 - v55 UNIVERSAL CROSS-DEVICE SYNC
   Channel 1: ntfy.sh/dictationb1_sdp_keys_v55 - a CORS-SIMPLE < 600 byte POST that carries only
              { syncRev, vaultCiphertext, sessionTitle, sessionDate }. No custom headers at all,
              so the browser never sends an OPTIONS preflight and ntfy NEVER converts the payload
              into an attachment (that is the 4,096-byte trap that broke v54).
   Channel 2: ntfy.sh/dictationb1_sdp_words_v55 - the compact word list, chunked under 3,500 bytes,
              again with zero custom headers.
   Channel 3: api.github.com contents reads (0.05 s after a commit) so a second device never has to
              wait 60-90 s for the GitHub Pages CDN to rebuild data/config.json.
   Channel 4: the permanent GitHub commit + the Apps Script cloud, exactly as before. */
(function () {
  var C = window.SDPCore || {}, DB = C.DB, U = C.U, Cloud = C.Cloud, CONFIG = C.CONFIG;
  var EV = window.EncryptedVault, PIN = "";
  var KEYS = "https://ntfy.sh/dictationb1_sdp_keys_v55";
  var WORDS = "https://ntfy.sh/dictationb1_sdp_words_v55";
  var AUDIO = "https://ntfy.sh/dictationb1_sdp_audio_v55";
  var STATIC = ["./data/config.json", "./data/session.json", "./data/elevenlabs-audio.json"];
  var REPO = "https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/";
  var MAX_KEY_BYTES = 1000, MAX_WORD_CHUNK = 3500;
  function live() { return !/HeadlessChrome/i.test(String((window.navigator && window.navigator.userAgent) || "")); }
  function canNet() { try { return !!window.fetch && String(window.location && window.location.protocol) !== "file:"; } catch (e) { return false; } }
  function gasUrl() { try { return String(CONFIG.gasUrl || (Cloud && Cloud.url) || ""); } catch (e) { return ""; } }
  function token() { try { return String((Cloud.ghToken && Cloud.ghToken()) || ""); } catch (e) { return ""; } }
  function clock(ms) {
    var d = new Date(Number(ms) || Date.now()), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getHours()) + ":" + p(d.getMinutes()) + " · " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }
  function bytes(s) { try { return encodeURIComponent(String(s || "")).replace(/%[0-9A-F]{2}/g, ".").length; } catch (e) { return String(s || "").length; } }
  function b64utf8(s) {
    var bin = "", out = "", i, j;
    try { bin = window.atob(String(s || "").replace(/[^A-Za-z0-9+/=]/g, "")); } catch (e) { return ""; }
    for (i = 0; i < bin.length; i += 1024) {
      var chunk = [];
      for (j = i; j < Math.min(i + 1024, bin.length); j++) { chunk.push(bin.charCodeAt(j)); }
      try { out += decodeURIComponent(escape(String.fromCharCode.apply(null, chunk))); } catch (e) { out += String.fromCharCode.apply(null, chunk); }
    }
    return out;
  }
  function wordsCompact() {
    var list = null, out = [], i, w;
    try { list = C.Lib && C.Lib.current ? C.Lib.current() : null; } catch (e) { list = null; }
    if (!list || !list.words || !list.words.length) { try { list = (DB.data.lists && DB.data.lists[0]) || null; } catch (e) { list = null; } }
    if (!list || !list.words) { return out; }
    for (i = 0; i < list.words.length; i++) {
      w = list.words[i] || {};
      out.push({ w: String(w.w || w), p: String(w.p || ""), d: String(w.d || ""), m: String(w.m || w.si || ""), s: String(w.s || w.ex || "") });
    }
    return out;
  }
  var SYNC = {
    version: 55, PIN: PIN, keysTopic: KEYS, wordsTopic: WORDS, audioTopic: AUDIO, vaultTopic: KEYS,
    staticFiles: STATIC, repoApi: REPO, maxKeyBytes: MAX_KEY_BYTES, maxWordChunk: MAX_WORD_CHUNK,
    rev: 0, lastSaved: 0, lastPull: 0, lastKeyBytes: 0, lastChannels: [], lastKeyBody: "",
    notes: [], busy: false, pushing: false, timer: null, audioTimer: null, live: live, canNet: canNet, gasUrl: gasUrl, token: token, time: clock, bytes: bytes,
    /* every relay POST is CORS-simple: method + body only, never a custom header */
    post: function (url, body, next) {
      next = next || function () {};
      if (!canNet() || !live()) { next("skipped"); return false; }
      try {
        window.fetch(url, { method: "POST", body: String(body) }).then(function (r) {
          next(r && r.ok ? "relay" : "relay-blocked");
        }, function () { next("relay-offline"); });
      } catch (e) { next("relay-blocked"); }
      return true;
    },
    keyBody: function (stamp) {
      var env = EV.keyEnvelope(stamp !== false);
      var body = JSON.stringify({
        syncRev: env.syncRev, vaultCiphertext: env.vaultCiphertext,
        sessionTitle: env.sessionTitle, sessionDate: env.sessionDate
      });
      this.lastKeyBody = body;
      this.lastKeyBytes = bytes(body);
      this.rev = env.syncRev;
      return body;
    },
    wordBodies: function (rev) {
      if (window.StudioSync && window.StudioSync.wordsBodies) { try { return window.StudioSync.wordsBodies(rev); } catch (e) {} }
      var words = wordsCompact(), out = [], chunk = [], i, item;
      for (i = 0; i < words.length; i++) {
        item = words[i];
        chunk.push(item);
        if (bytes(JSON.stringify({ syncRev: rev, chunk: out.length, total: 0, words: chunk })) > MAX_WORD_CHUNK && chunk.length > 1) {
          chunk.pop();
          out.push(chunk);
          chunk = [item];
        }
      }
      if (chunk.length) { out.push(chunk); }
      var bodies = [];
      for (i = 0; i < out.length; i++) {
        bodies.push(JSON.stringify({ syncRev: rev, chunk: i, total: out.length, words: out[i] }));
      }
      return bodies;
    },
    envelope: function (stamp) {
      var env = EV.keyEnvelope(stamp !== false), full = EV.fullEnvelope(env.syncRev);
      return {
        syncRev: env.syncRev, vaultCiphertext: full.vaultCiphertext, keyCiphertext: env.vaultCiphertext,
        sessionTitle: env.sessionTitle, sessionDate: env.sessionDate,
        classInfo: (DB.data.session && DB.data.session.classInfo) || "",
        words: wordsCompact(), pastSessions: DB.data.pastSessions || []
      };
    },
    applyEnvelope: function (env) {
      var d = null;
      if (!env || !EV.isVault(env.vaultCiphertext)) { return null; }
      d = EV.applyRemoteVault(env.vaultCiphertext);
      if (d && Number(env.syncRev) > (Number(DB.data.syncRev) || 0)) { DB.data.syncRev = Number(env.syncRev) || 0; }
      return d;
    },
    status: function () {
      var s = {};
      try { s = (DB.data && DB.data.settings) || {}; } catch (e) { s = {}; }
      return {
        key: !!String(s.elevenLabsKey || ""), token: !!token(), rev: Number(DB.data.syncRev) || 0,
        verified: !!String(s.elevenLabsKey || "") && !!token(), keyBytes: this.lastKeyBytes,
        clips: (function () { try { return window.ElevenVault ? window.ElevenVault.count() : 0; } catch (e) { return 0; } }())
      };
    },
    banner: function () {
      var st = this.status(), el = document.getElementById("syncBanner");
      var txt = "✓ 100% Synced Across All Devices · Last Saved: " + clock(this.lastSaved || st.rev) +
        " · API Key: " + (st.key ? "Saved & Encrypted" : "Not set") +
        " · GitHub Token: " + (st.token ? "Connected" : "Not set") +
        " · Voice Clips: " + (st.clips < 10 ? "0" : "") + st.clips;
      if (el) { el.textContent = txt; el.className = "small " + (st.verified ? "good" : ""); }
      return txt;
    },
    setNote: function (s) { this.notes.unshift(String(s || "")); if (this.notes.length > 6) { this.notes.length = 6; } return s; },
    /* ---- instant GitHub API read: 0.05 s after the commit, no CDN wait ---- */
    githubRead: function (path, cb) {
      cb = cb || function () {};
      var url = REPO + path + "?ref=main&t=" + Date.now(), init = { cache: "no-store" }, tok = token();
      if (tok) { init.headers = { "Authorization": "token " + tok }; }
      if (!canNet()) { cb(""); return false; }
      try {
        window.fetch(url, init).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
          var txt = "";
          if (d && d.content) { txt = b64utf8(String(d.content)); }
          else if (d && d.raw) { txt = String(d.raw); }
          cb(txt);
        }, function () { cb(""); });
      } catch (e) { cb(""); }
      return true;
    },
    pushAll: function (reason, cb) {
      var self = this, env;
      cb = cb || function () {};
      if (this.pushing) { cb({ ok: true, rev: this.rev, note: "busy", channels: this.lastChannels }); return false; }
      this.pushing = true;
      this.busy = true;
      try {
        this.keyBody(true);
        env = this.envelope(false);
        this.lastSaved = env.syncRev;
        DB.saveNow();
      } catch (e) {
        this.pushing = false; this.busy = false;
        cb({ ok: false, err: String((e && e.message) || e) });
        return false;
      }
      function done(r) {
        self.pushing = false;
        self.busy = false;
        self.lastChannels = (r && r.channels) || [];
        self.setNote("push " + (reason || "save") + (self.lastChannels.length ? ": " + self.lastChannels.join("/") : ""));
        try { self.banner(); } catch (e) {}
        cb(r || { ok: true, rev: env.syncRev, channels: self.lastChannels });
      }
      if (window.StudioSync && window.StudioSync.push) { window.StudioSync.push(env, reason, done); return true; }
      this.post(KEYS, this.lastKeyBody, function (n) { done({ ok: n === "relay", rev: env.syncRev, channels: [n] }); });
      return true;
    },
    pullAll: function (cb) {
      var self = this, best = null, left = 0, done = false, clips = 0, words = 0, jobs = [], j, gas = gasUrl();
      cb = cb || function () {};
      if (!canNet()) { cb({ ok: false, reason: "local-only" }); return false; }
      this.busy = true;
      function take(env) {
        if (!env || !EV.isVault(env.vaultCiphertext)) { return; }
        if (!best || (Number(env.syncRev) || 0) > (Number(best.syncRev) || 0)) { best = env; }
      }
      function scan(text, poll, merge) {
        var lines = poll ? String(text || "").split("\n") : [String(text || "")], i, doc, env;
        for (i = 0; i < lines.length; i++) {
          if (!lines[i]) { continue; }
          try { doc = JSON.parse(lines[i]); } catch (e) { continue; }
          if (!doc) { continue; }
          if (poll && doc.message) {
            /* a truncated/attachment message can never crash the pull - it is skipped */
            try { env = JSON.parse(doc.message); } catch (e) { env = null; }
            doc = env;
          }
          if (!doc) { continue; }
          if (merge) {
            if (window.StudioSync && window.StudioSync.mergeClips) { try { clips += window.StudioSync.mergeClips(doc); } catch (e) {} }
            continue;
          }
          if (doc.words && !EV.isVault(doc.vaultCiphertext)) {
            /* the compact word relay: applied once every chunk of the newest revision arrived */
            if (window.StudioSync && window.StudioSync.applyWordsDoc) { try { words += window.StudioSync.applyWordsDoc(doc); } catch (e) {} }
            continue;
          }
          if (EV.isVault(doc.vaultCiphertext)) { take(doc); }
          else if (doc.session && EV.isVault(doc.session.vaultCiphertext)) { take(doc.session); }
          else if (doc.config && EV.isVault(doc.config.vaultCiphertext)) { take(doc.config); }
        }
      }
      function fin() {
        var r, applied = null;
        left--;
        if (left > 0 || done) { return; }
        done = true;
        self.busy = false;
        self.lastPull = Date.now();
        if (best) { applied = self.applyEnvelope(best); }
        try { self.banner(); } catch (e) {}
        r = { ok: !!best, rev: best ? Number(best.syncRev) || 0 : 0, applied: !!applied, clips: clips, words: words, key: applied ? !!applied.key : false };
        self.setNote("pull: " + (best ? "rev " + r.rev : "nothing newer"));
        try { EV.paint(); } catch (e) {}
        cb(r);
      }
      function job(url, poll, merge, init) {
        left++;
        try {
          window.fetch(url, init || { cache: "no-store" }).then(function (r) { return r && r.ok ? r.text() : ""; })
            .then(function (t) { scan(t, poll, merge); fin(); }, function () { fin(); });
        } catch (e) { fin(); }
      }
      left = 0;
      job(KEYS + "/json?poll=1&since=all", true, false);
      job(WORDS + "/json?poll=1&since=all", true, false);
      job(AUDIO + "/json?poll=1&since=all", true, true);
      job(STATIC[0] + "?t=" + Date.now(), false, false);
      job(STATIC[1] + "?t=" + Date.now(), false, false);
      job(STATIC[2] + "?t=" + Date.now(), false, true);
      /* the instant repository read: api.github.com is authoritative the moment the commit lands.
         The response is a base64 contents envelope, so it is decoded before it reaches scan(). */
      for (j = 0; j < STATIC.length; j++) {
        (function (rel, mergeClips) {
          left++;
          self.githubRead(rel, function (txt) {
            if (txt) { scan(txt, false, mergeClips); }
            fin();
          });
        }(STATIC[j].replace(/^\.\//, ""), j === 2));
      }
      if (gas) { job(gas + (gas.indexOf("?") < 0 ? "?" : "&") + "action=vault&t=" + Date.now(), false, false); }
      return true;
    },
    /* background commit of data/elevenlabs-audio.json after a clip was generated on ANY device */
    scheduleAudioRepoCommit: function (delay) {
      var self = this;
      if (!token() || !Cloud || !Cloud.commitFiles) { return false; }
      if (this.audioTimer) { clearTimeout(this.audioTimer); }
      this.audioTimer = setTimeout(function () {
        self.audioTimer = null;
        try {
          var doc = window.StudioSync && window.StudioSync.clipDoc ? window.StudioSync.clipDoc() : null;
          if (!doc) { return; }
          Cloud.commitFiles([{ p: "data/elevenlabs-audio.json", text: JSON.stringify(doc, null, 2) + "\n" }], "v55: permanent voice clip from a synced device", function () {});
        } catch (e) {}
      }, Number(delay) || 1200);
      return true;
    },
    boot: function () {
      try { if (EV.isVault(DB.data.vaultCiphertext)) { EV.applyRemoteVault(DB.data.vaultCiphertext); } } catch (e) {}
      try { EV.paint(); } catch (e) {}
      this.banner();
      this.pullAll(function () {});
      return this;
    },
    touch: function () {
      var self = this;
      if (!C.Admin || !C.Admin.unlocked || this.pushing) { return false; }
      if (window.SDPStudioReady && !window.SDPStudioReady()) { return false; }
      if (this.timer) { clearTimeout(this.timer); }
      this.timer = setTimeout(function () { self.timer = null; self.pushAll("settings"); }, 900);
      return true;
    },
    sync: function () {
      var self = this;
      this.pullAll(function () { self.banner(); });
      this.pushAll("manual");
    }
  };
  window.UniversalSync = SYNC;
  try {
    CONFIG.keysTopic = KEYS; CONFIG.wordsTopic = WORDS; CONFIG.audioTopic = AUDIO; CONFIG.vaultTopic = KEYS;
  } catch (e) {}
})();
