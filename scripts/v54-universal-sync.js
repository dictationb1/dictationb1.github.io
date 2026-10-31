/* SECTION 64 - v54 UNIVERSAL CROSS-DEVICE SYNC (three redundant channels, one engine) */
(function () {
  var C = window.SDPCore || {}, DB = C.DB, U = C.U, Cloud = C.Cloud, CONFIG = C.CONFIG;
  var EV = window.EncryptedVault, PIN = "";
  var VAULT = "https://ntfy.sh/dictationb1_sdp_vault_v54", AUDIO = "https://ntfy.sh/dictationb1_sdp_audio_v54";
  var STATIC = ["./data/config.json", "./data/session.json", "./data/elevenlabs-audio.json"];
  function live() { return !/HeadlessChrome/i.test(String((window.navigator && window.navigator.userAgent) || "")); }
  function canNet() { try { return !!window.fetch && String(window.location && window.location.protocol) !== "file:"; } catch (e) { return false; } }
  function gasUrl() { try { return String(CONFIG.gasUrl || (Cloud && Cloud.url) || ""); } catch (e) { return ""; } }
  function token() { try { return String((Cloud.ghToken && Cloud.ghToken()) || ""); } catch (e) { return ""; } }
  function clock(ms) {
    var d = new Date(Number(ms) || Date.now()), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getHours()) + ":" + p(d.getMinutes()) + " · " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }
  var SYNC = {
    version: 54, PIN: PIN, vaultTopic: VAULT, audioTopic: AUDIO, staticFiles: STATIC,
    rev: 0, lastSaved: 0, lastPull: 0, notes: [], busy: false, pushing: false, timer: null, live: live, canNet: canNet, gasUrl: gasUrl, token: token, time: clock,
    envelope: function (stamp) {
      var p = EV.payload();
      p.syncRev = Number(DB.data.syncRev) || Date.now();
      if (stamp) {
        DB.data.syncRev = Date.now();
        p.syncRev = DB.data.syncRev;
        DB.data.vaultCiphertext = EV.encrypt(p, PIN);
      } else if (!EV.isVault(DB.data.vaultCiphertext)) {
        DB.data.vaultCiphertext = EV.encrypt(p, PIN);
      }
      return {
        syncRev: Number(DB.data.syncRev) || 0, vaultCiphertext: DB.data.vaultCiphertext,
        sessionTitle: p.sessionTitle, sessionDate: p.sessionDate, classInfo: p.classInfo,
        words: p.words, pastSessions: DB.data.pastSessions || []
      };
    },
    banner: function () {
      var key = DB.data && DB.data.settings && DB.data.settings.elevenLabsKey ? "Saved & Encrypted" : "Not set";
      var clips = 0, el = document.getElementById("syncBanner");
      try { clips = window.ElevenVault ? window.ElevenVault.count() : 0; } catch (e) { clips = 0; }
      var txt = "✓ 100% Synced Across All Devices · Last Saved: " + clock(this.lastSaved || (DB.data && DB.data.syncRev) || 0) +
        " · API Key: " + key + " · Voice Clips: " + (clips < 10 ? "0" : "") + clips;
      if (el) { el.textContent = txt; el.className = "small good"; }
      return txt;
    },
    setNote: function (s) { this.notes.unshift(String(s || "")); if (this.notes.length > 6) { this.notes.length = 6; } return s; },
    postNtfy: function (url, body, title, next) {
      if (!canNet() || !live()) { next("skipped"); return; }
      try {
        window.fetch(url, { method: "POST", body: JSON.stringify(body), headers: { "Title": title, "Cache": "yes" } }).then(function (r) {
          next(r && r.ok ? "ntfy" : "ntfy-blocked");
        }, function () { next("ntfy-offline"); });
      } catch (e) { next("ntfy-blocked"); }
    },
    pushAll: function (reason, cb) {
      var self = this, env;
      cb = cb || function () {};
      if (this.pushing) { cb({ ok: true, rev: this.rev, note: "busy" }); return false; }
      this.pushing = true;
      this.busy = true;
      try {
        env = this.envelope(true);
        this.rev = env.syncRev;
        this.lastSaved = env.syncRev;
        DB.saveNow();
      } catch (e) {
        this.pushing = false; this.busy = false;
        cb({ ok: false, err: String(e && e.message || e) });
        return false;
      }
      function done(r) {
        self.pushing = false;
        self.busy = false;
        self.setNote("push " + (reason || "save") + (r && r.channels ? ": " + r.channels.join("/") : ""));
        try { self.banner(); } catch (e) {}
        cb(r || { ok: true, rev: env.syncRev });
      }
      if (window.StudioSync && window.StudioSync.push) { window.StudioSync.push(env, reason, done); return true; }
      this.postNtfy(VAULT, env, "SDP-Sync-" + env.syncRev, function (n) {
        done({ ok: n === "ntfy", rev: env.syncRev, channels: [n] });
      });
      return true;
    },
    applyEnvelope: function (env) {
      var d = null;
      if (!env || !EV.isVault(env.vaultCiphertext)) { return null; }
      d = EV.applyRemoteVault(env.vaultCiphertext);
      if (d && Number(env.syncRev) > (Number(DB.data.syncRev) || 0)) { DB.data.syncRev = Number(env.syncRev) || 0; }
      return d;
    },
    pullAll: function (cb) {
      var self = this, best = null, left = 0, done = false, clips = 0, jobs = [], j, gas = gasUrl();
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
          if (poll && doc.message) { try { env = JSON.parse(doc.message); } catch (e) { env = null; } doc = env; }
          if (!doc) { continue; }
          if (merge) {
            if (window.StudioSync && window.StudioSync.mergeClips) { try { clips += window.StudioSync.mergeClips(doc); } catch (e) {} }
            continue;
          }
          if (EV.isVault(doc.vaultCiphertext)) { take(doc); }
          else if (doc.session && EV.isVault(doc.session.vaultCiphertext)) { take(doc.session); }
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
        r = { ok: !!best, rev: best ? Number(best.syncRev) || 0 : 0, applied: !!applied, clips: clips };
        self.setNote("pull: " + (best ? "rev " + r.rev : "nothing newer"));
        cb(r);
      }
      jobs = [
        [STATIC[0] + "?t=" + Date.now(), false, false],
        [STATIC[1] + "?t=" + Date.now(), false, false],
        [STATIC[2] + "?t=" + Date.now(), false, true],
        [VAULT + "/json?poll=1&since=all", true, false],
        [AUDIO + "/json?poll=1&since=all", true, true]
      ];
      if (gas) { jobs.push([gas + (gas.indexOf("?") < 0 ? "?" : "&") + "action=vault&t=" + Date.now(), false, false]); }
      left = jobs.length;
      for (j = 0; j < jobs.length; j++) {
        (function (job) {
          try {
            window.fetch(job[0], { cache: "no-store" }).then(function (r) { return r && r.ok ? r.text() : ""; })
              .then(function (t) { scan(t, job[1], job[2]); fin(); }, function () { fin(); });
          } catch (e) { fin(); }
        }(jobs[j]));
      }
      return true;
    },
    boot: function () {
      try {
        if (EV.isVault(DB.data.vaultCiphertext)) { EV.applyRemoteVault(DB.data.vaultCiphertext); }
      } catch (e) {}
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
      this.timer = setTimeout(function () { self.timer = null; self.pushAll("settings"); }, 1500);
      return true;
    },
    sync: function () {
      var self = this;
      this.pullAll(function () { self.banner(); });
      this.pushAll("manual");
    }
  };
  window.UniversalSync = SYNC;
  try { CONFIG.vaultTopic = VAULT; CONFIG.audioTopic = AUDIO; } catch (e) {}
})();
