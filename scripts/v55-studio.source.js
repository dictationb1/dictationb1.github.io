/* SECTION 60 - v55 STRICT ZERO-DRAIN ELEVENLABS VAULT (playback never spends a credit) */
(function () {
  var C = {
    v: 55, voiceId: "Xb7hH8MSUJpSbSDYk0k2", modelId: "eleven_flash_v2_5",
    tts: "https://api.elevenlabs.io/v1/text-to-speech/", q: "?output_format=mp3_44100_64",
    sub: "https://api.elevenlabs.io/v1/user/subscription", file: "./data/elevenlabs-audio.json",
    db: "sdp_elevenlabs_vault_v1", store: "clips",
    cost: { eleven_flash_v2_5: 0.5, eleven_multilingual_v2: 1 },
    set: { stability: 0.45, similarity_boost: 0.85, style: 0.5, use_speaker_boost: true },
    voices: [
      { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", label: "Alice · British RP Professional Educator Woman (default)" },
      { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", label: "Charlotte · British Expressive Studio Woman" },
      { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", label: "Lily · British RP Warm Narrator Woman" },
      { id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy", label: "Dorothy · British Pleasant Studio Woman" }
    ],
    models: [{ id: "eleven_flash_v2_5", name: "eleven_flash_v2_5 (0.5x Credit Saver)" }, { id: "eleven_multilingual_v2", name: "eleven_multilingual_v2 (1x HD Studio)" }]
  };
  function cl(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, ""); }
  function hs(s) {
    var i, d, a = 2166136261, b = 5381, t = String(s == null ? "" : s);
    for (i = 0; i < t.length; i++) { d = t.charCodeAt(i); a = (16777619 * (a ^ d)) >>> 0; b = (33 * b ^ d) >>> 0; }
    return a.toString(36) + b.toString(36);
  }
  function num(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function durl(u8) {
    var s = "", i;
    for (i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + 8192, u8.length)));
    try { s = window.btoa(s); } catch (e) { return ""; }
    return s ? "data:audio/mpeg;base64," + s : "";
  }
  /* v55: the < 600 byte keys envelope lives in the studio (index.html stays lean).
     The inline vault keeps encrypt/decrypt/payload/applyRemoteVault; these three add the tiny wire record. */
  (function extendVault() {
    var EV = window.EncryptedVault, PIN = "78987898";
    if (!EV || EV.keyEnvelope) { return; }
    /* the wire record: ONLY elevenLabsKey + ghToken + the voice pair + syncRev, no words and no
       settings that already travel in data/config.json, so the ciphertext always stays tiny. */
    EV.keyPayload = function () {
      var s = DB.data.settings = DB.data.settings || {};
      return {
        r: Number(DB.data.syncRev) || 0,
        k: String(s.elevenLabsKey || ""),
        v: String(s.elevenLabsVoiceId || C.voiceId),
        m: String(s.elevenLabsModelId || C.modelId),
        g: String((Cloud.ghToken && Cloud.ghToken()) || ""),
        p: PIN
      };
    };
    /* CORS-simple relay envelope: only syncRev + vaultCiphertext + sessionTitle + sessionDate */
    EV.keyEnvelope = function (stamp) {
      var ses = DB.data.session = DB.data.session || {}, p;
      if (stamp) { DB.data.syncRev = Date.now(); }
      p = this.keyPayload();
      p.r = Number(DB.data.syncRev) || Date.now();
      DB.data.vaultCiphertext = this.encrypt(p, PIN);
      DB.data.keyRev = p.r;
      return {
        syncRev: p.r, vaultCiphertext: DB.data.vaultCiphertext,
        sessionTitle: String(ses.title || ""), sessionDate: String(ses.date || "")
      };
    };
    EV.fullEnvelope = function (rev) {
      var p = this.payload();
      p.syncRev = Number(rev) || Number(DB.data.syncRev) || Date.now();
      return { syncRev: p.syncRev, vaultCiphertext: this.encrypt(p, PIN), sessionTitle: String(p.sessionTitle || ""), sessionDate: String(p.sessionDate || "") };
    };
  })();
  var gestureSeen = false;
  function markGesture() {
    gestureSeen = true;
    try {
      document.removeEventListener("pointerdown", markGesture, true);
      document.removeEventListener("keydown", markGesture, true);
      document.removeEventListener("touchstart", markGesture, true);
    } catch (e) {}
  }
  try {
    document.addEventListener("pointerdown", markGesture, true);
    document.addEventListener("keydown", markGesture, true);
    document.addEventListener("touchstart", markGesture, true);
  } catch (e) {}
  var V = {
    version: 55, strictAdminOnly: true, adminBusy: false, sharedMap: {}, memMap: {}, metaMap: {}, flight: {}, _inflight: {},
    playOnce: 0, generated: 0,
    hits: 0, blocked: 0, made: 0, _db: null, _open: 0, _wait: [],
    stats: { generatedCount: 0, sharedHits: 0, localHits: 0, creditsSaved: 0, characters: 0, failures: 0, blocked: 0 },
    norm: cl, hash: hs, num: num,
    cfg: function () { try { DB.data.settings = DB.data.settings || {}; return DB.data.settings; } catch (e) { return {}; } },
    apiKey: function () { return String(this.cfg().elevenLabsKey || ""); },
    hasKey: function () { return !!this.apiKey(); },
    setApiKey: function (k) { this.cfg().elevenLabsKey = cl(k); DB.saveNow(); return this.apiKey(); },
    vid: function () { return String(this.cfg().elevenLabsVoiceId || C.voiceId); },
    setVid: function (v) { this.cfg().elevenLabsVoiceId = cl(v) || C.voiceId; DB.saveNow(); return this.vid(); },
    mid: function () { return String(this.cfg().elevenLabsModelId || C.modelId); },
    setMid: function (v) { this.cfg().elevenLabsModelId = cl(v) || C.modelId; DB.saveNow(); return this.mid(); },
    rate: function () { return C.cost[this.mid()] || 1; },
    vname: function () { var i, id = this.vid(); for (i = 0; i < C.voices.length; i++) if (C.voices[i].id === id) return C.voices[i].name; return "Custom"; },
    keyFor: function (t) { return "el_" + this.vid() + "_" + hs(cl(t)); },
    url: function (x) { return x ? (typeof x === "string" ? x : String(x.audio || x.dataUrl || x.url || "")) : ""; },
    find: function (t) { var k = this.keyFor(t); return this.url(this.memMap[k]) || this.url(this.sharedMap[k]) || ""; },
    count: function () {
      var k, seen = {}, n = 0, own = Object.prototype.hasOwnProperty;
      for (k in this.sharedMap) { if (this.sharedMap[k] && !own.call(seen, k)) { seen[k] = 1; n++; } }
      for (k in this.memMap) { if (this.memMap[k] && !own.call(seen, k)) { seen[k] = 1; n++; } }
      return n;
    },
    bytes: function (u) { return u ? Math.round(String(u).length * 0.75) : 0; },
    kb: function (n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; },
    apply: function (p) {
      var k, c2, u, n = 0, clips = p && (p.clips || p);
      if (!clips || typeof clips !== "object") return 0;
      for (k in clips) {
        if (!Object.prototype.hasOwnProperty.call(clips, k)) continue;
        c2 = clips[k];
        u = this.url(c2);
        if (!u) continue;
        this.sharedMap[k] = u;
        this.metaMap[k] = { text: (c2 && c2.text) || (this.metaMap[k] && this.metaMap[k].text) || "", voiceId: (c2 && c2.voiceId) || this.vid() };
        n++;
      }
      return n;
    },
    loadShared: function (cb) {
      var self = this;
      cb = cb || function () {};
      if (!window.fetch || String(window.location && window.location.protocol) === "file:") { cb(0); return; }
      try {
        window.fetch(C.file + "?v=55", { cache: "no-cache" }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) { cb(self.apply(d)); }, function () { cb(0); });
      } catch (e) { cb(0); }
    },
    open: function (cb) {
      var self = this, req;
      if (this._open === 2) { cb(this._db); return; }
      this._wait.push(cb);
      if (this._open === 1) return;
      this._open = 1;
      function fin(db) {
        var w = self._wait, i;
        self._wait = []; self._db = db; self._open = 2;
        for (i = 0; i < w.length; i++) { try { w[i](db); } catch (e) {} }
      }
      try {
        if (!window.indexedDB) { fin(null); return; }
        req = window.indexedDB.open(C.db, 1);
        req.onupgradeneeded = function (e) { try { var db = e.target.result; if (!db.objectStoreNames.contains(C.store)) db.createObjectStore(C.store, { keyPath: "key" }); } catch (x) {} };
        req.onsuccess = function (e) { fin(e.target.result); };
        req.onerror = function () { fin(null); };
      } catch (e) { fin(null); }
    },
    idb: function (mode, key, rec, cb) {
      var self = this;
      this.open(function (db) {
        if (!db) { cb(null); return; }
        try {
          var st = db.transaction(C.store, mode === "put" ? "readwrite" : mode === "get" ? "readonly" : "readwrite").objectStore(C.store);
          var rq = mode === "get" ? st.get(key) : mode === "put" ? st.put(rec) : st.delete(key);
          rq.onsuccess = function (e) { cb(mode === "get" ? (e.target.result && String(e.target.result.dataUrl) || "") : true); };
          rq.onerror = function () { cb(null); };
        } catch (e) { cb(null); }
      });
    },
    idbGet: function (k, cb) { this.idb("get", k, null, cb); },
    idbPut: function (r, cb) { this.idb("put", r.key, r, cb || function () {}); },
    idbDel: function (k, cb) { this.idb("del", k, null, cb || function () {}); },
    idbAll: function (cb) {
      var out = [];
      this.open(function (db) {
        if (!db) { cb(out); return; }
        try {
          var cur = db.transaction(C.store, "readonly").objectStore(C.store).openCursor();
          cur.onsuccess = function (e) { var r = e.target.result; if (!r) { cb(out); return; } out.push(r.value); r.continue(); };
          cur.onerror = function () { cb(out); };
        } catch (e) { cb(out); }
      });
    },
    local: function (k, cb) {
      var self = this;
      if (this.memMap[k]) { cb(this.memMap[k]); return; }
      this.idbGet(k, function (u) { if (u) self.memMap[k] = u; cb(u || ""); });
    },
    save: function (k, text, u) {
      var rec = { key: k, text: String(text || ""), voiceId: this.vid(), modelId: this.mid(), dataUrl: u, ts: Date.now() };
      this.memMap[k] = u;
      this.metaMap[k] = rec;
      this.idbPut(rec);
      return rec;
    },
    /* v55: a headless automated browser never spends credits; a real phone never falls back. */
    automated: function () {
      try { return /HeadlessChrome|PhantomJS/i.test(String((window.navigator && window.navigator.userAgent) || "")); } catch (e) { return false; }
    },
    /* a clip is only ever fetched after a real user gesture (never on boot, never in the background) */
    gestureOn: function () { return gestureSeen; },
    allowFetchNow: function () { gestureSeen = true; return true; },
    /* v55 SMART CROSS-DEVICE PLAYBACK
       Check 1 (0 credits): memMap / sharedMap (data/elevenlabs-audio.json) / IndexedDB -> play now.
       Check 2 (once, then free forever): the PIN-decrypted elevenLabsKey that arrived from device #1
               generates the clip ONCE (deduped by clip key), stores it in IndexedDB + sharedMap, plays it
               immediately and schedules a GitHub commit of data/elevenlabs-audio.json. */
    playOrFetchOnce: function (t, lang, tok, cb, rate) {
      var self = this, p = cl(t), k, u;
      if (!p || lang === "si") { return false; }
      k = this.keyFor(p);
      u = this.url(this.sharedMap[k]) || this.url(this.memMap[k]);
      if (u) { this.hits++; this.stats.sharedHits++; this.play(u, p, tok, cb, rate); return true; }
      if (!this.hasKey() || this.automated() || !gestureSeen) { return this.speak(p, lang, tok, cb, rate); }
      this.local(k, function (f) {
        if (f) { self.hits++; self.stats.localHits++; self.play(f, p, tok, cb, rate); return; }
        self.fetchOnce(p, function (e, got) {
          if (got) { self.playOnce++; self.play(got, p, tok, cb, rate); return; }
          try {
            if (typeof Speech._legacyPlayText === "function") { Speech._legacyPlayText.call(Speech, p, lang, tok, cb, rate); return; }
          } catch (x) {}
          if (typeof cb === "function") { cb(false); }
        });
      });
      return true;
    },
    /* one paid request per text per device, then the clip is permanent everywhere */
    fetchOnce: function (t, cb) {
      var self = this, p = cl(t), k = this.keyFor(p), tok = this.apiKey(), existing;
      cb = cb || function () {};
      if (!p) { cb("empty", ""); return false; }
      existing = this.url(this.sharedMap[k]) || this.url(this.memMap[k]);
      if (existing) { cb(null, existing); return true; }
      if (this._inflight[k]) { this._inflight[k].push(cb); return true; }
      if (!tok) { cb("nokey", ""); return false; }
      if (!window.fetch) { cb("nofetch", ""); return false; }
      this._inflight[k] = [cb];
      function fin(e, u) {
        var w = self._inflight[k] || [], i;
        delete self._inflight[k];
        for (i = 0; i < w.length; i++) { try { w[i](e, u); } catch (x) {} }
      }
      try {
        window.fetch(C.tts + this.vid() + C.q, {
          method: "POST",
          headers: { "xi-api-key": tok, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({ text: p, model_id: this.mid(), voice_settings: C.set })
        }).then(function (r) { if (!r || !r.ok) { throw Error("elevenlabs " + (r ? r.status : "offline")); } return r.arrayBuffer(); }).then(function (b) {
          var u = durl(new Uint8Array(b));
          if (!u) { throw Error("empty clip"); }
          self.save(k, p, u);
          self.sharedMap[k] = u;
          self.made++;
          self.generated++;
          self.stats.generatedCount++;
          self.stats.characters += p.length;
          self.stats.creditsSaved += p.length * self.rate();
          try {
            if (window.UniversalSync && window.UniversalSync.scheduleAudioRepoCommit) { window.UniversalSync.scheduleAudioRepoCommit(); }
          } catch (x) {}
          fin(null, u);
        }).then(null, function () { self.stats.failures++; fin("error", ""); });
      } catch (e) { fin("error", ""); }
      return true;
    },
    /* READ ONLY: student playback can never reach the paid endpoint. */
    resolve: function (t, cb) {
      var self = this, k = this.keyFor(t), u;
      if (!cl(t)) { cb("empty", ""); return; }
      u = this.url(this.sharedMap[k]) || this.url(this.memMap[k]);
      if (u) { this.hits++; this.stats.sharedHits++; cb(null, u); return; }
      this.local(k, function (f) { if (f) { self.stats.localHits++; cb(null, f); return; } self.blocked++; self.stats.blocked++; cb("missing", ""); });
    },
    play: function (u, t, tok, cb, rate) {
      if (typeof Speech._playUrl !== "function") { if (cb) cb(false); return false; }
      Speech._playUrl(u, t, "en", tok, cb, rate || Speech.desiredRate || 1);
      return true;
    },
    speak: function (t, lang, tok, cb, rate, fb) {
      var p = cl(t), u;
      if (!p || lang === "si") return false;
      u = this.find(p);
      if (u) { this.hits++; this.stats.sharedHits++; this.play(u, p, tok, cb, rate); return true; }
      /* no permanent clip: hand straight back to the streaming reader (0 credits) */
      if (typeof fb === "function") { fb(); return true; }
      if (cb) cb(false);
      return false;
    },
    spell: function (w) {
      var i, s = String(w || "").toLowerCase().replace(/[^a-z]/g, ""), n = Speech.letterNames || {}, o = [];
      if (!s) return "";
      for (i = 0; i < s.length; i++) o.push(n[s.charAt(i)] || s.charAt(i));
      return o.join(", ") + ". " + s;
    },
    texts: function (scope) {
      var self = this, out = [], w = [], i, g;
      function add(t) { var x = cl(t); if (x && out.indexOf(x) < 0) out.push(x); }
      try { w = (Lib.current() || {}).words || []; } catch (e) { w = []; }
      if (!w.length) { try { w = DB.data.lists[0].words || []; } catch (e) { w = []; } }
      add("Three."); add("Two."); add("One.");
      add(Speech.instructionPhrase("paper")); add(Speech.instructionPhrase("type"));
      add("Sound check. Number 1."); add("Session paused.");
      add("Welcome back. Continuing dictation number 1.");
      add("Dictation complete. Well done. Review all thirty words below");
      for (i = 1; i <= w.length; i++) add("Number " + i);
      for (i = 0; i < w.length; i++) {
        add(w[i] && (w[i].w || w[i]));
        if (scope === "full") { add(w[i] && (w[i].s || w[i].ex)); add(this.spell(w[i] && w[i].w)); }
      }
      if (scope === "full") {
        try { g = (typeof GUIDE !== "undefined" && GUIDE && GUIDE.en) || []; } catch (e) { g = []; }
        for (i = 0; i < g.length; i++) add(typeof g[i] === "string" ? g[i] : g[i] && (g[i].text || g[i].t));
      }
      return out;
    },
    plan: function (scope) {
      var t = this.texts(scope), miss = [], ch = 0, hit = 0, i;
      for (i = 0; i < t.length; i++) { if (this.find(t[i])) hit++; else { miss.push(t[i]); ch += t[i].length; } }
      return { total: t.length, cached: hit, missing: miss, characters: ch, credits: ch * this.rate() };
    },
    /* The ONLY function that calls api.elevenlabs.io/v1/text-to-speech — reached from the Admin Generate button */
    gen: function (t, cb) {
      var self = this, p = cl(t), k = this.keyFor(p), tok = this.apiKey();
      cb = cb || function () {};
      if (!p) { cb("empty", ""); return false; }
      /* ZERO-DRAIN LOCK: only a running admin generation cycle may reach the paid endpoint. */
      if (this.strictAdminOnly && !this.adminBusy) { this.blocked++; this.stats.blocked++; cb("locked", ""); return false; }
      if (!tok) { cb("nokey", ""); return false; }
      if (this.flight[k]) { this.flight[k].push(cb); return true; }
      function fin(e, u) {
        var w = self.flight[k] || [], i;
        delete self.flight[k];
        for (i = 0; i < w.length; i++) { try { w[i](e, u); } catch (x) {} }
      }
      this.flight[k] = [cb];
      if (!window.fetch) { fin("nofetch", ""); return false; }
      try {
        window.fetch(C.tts + this.vid() + C.q, {
          method: "POST",
          headers: { "xi-api-key": tok, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({ text: p, model_id: this.mid(), voice_settings: C.set })
        }).then(function (r) { if (!r || !r.ok) throw Error("elevenlabs " + (r ? r.status : "offline")); return r.arrayBuffer(); }).then(function (b) {
          var u = durl(new Uint8Array(b));
          if (!u) throw Error("empty clip");
          self.save(k, p, u);
          self.made++;
          self.stats.generatedCount++;
          self.stats.characters += p.length;
          self.stats.creditsSaved += p.length * self.rate();
          fin(null, u);
        }).then(null, function () { self.stats.failures++; fin("error", ""); });
      } catch (e) { fin("error", ""); }
      return true;
    },
    generate: function (t, cb) { return this.gen(t, cb); },
    adminGenerateMissing: function (scope, prog, done) {
      var self = this, p, i = 0, made = 0, bad = 0;
      if (scope && typeof scope === "object" && typeof scope.length === "number") {
        var miss = [], cached = 0, ch = 0, j, t2;
        for (j = 0; j < scope.length; j++) {
          t2 = cl(scope[j]);
          if (!t2) continue;
          if (this.find(t2)) { cached++; continue; }
          if (miss.indexOf(t2) > -1) continue;
          miss.push(t2); ch += t2.length;
        }
        p = { total: scope.length, cached: cached, missing: miss, characters: ch, credits: ch * this.rate() };
      } else p = this.plan(scope || "session");
      prog = prog || function () {};
      done = done || function () {};
      function next() {
        if (i >= p.missing.length) {
          self.adminBusy = false;
          prog("Vault complete · " + made + " new clips · " + p.cached + " already saved (0 credits)");
          done({ ok: true, generated: made, failed: bad, cached: p.cached, characters: p.characters, missing: p.missing.length });
          return;
        }
        var t = p.missing[i++];
        prog("Generating " + i + "/" + p.missing.length + " · " + t);
        self.gen(t, function (e) { if (e) bad++; else made++; next(); });
      }
      if (!this.hasKey()) { done({ ok: false, err: "nokey", generated: 0, cached: p.cached, missing: p.missing.length }); return false; }
      this.adminBusy = true;
      prog("Checking the vault · " + p.cached + " saved clips are replayed for 0 credits");
      next();
      return true;
    },
    generateBatch: function (t, prog, done) { return this.adminGenerateMissing(t, prog, done); },
    clips: function (cb) {
      var self = this, out = {}, k;
      function pull(m) { for (k in m) if (m[k]) { var u = self.url(m[k]); if (u) out[k] = u; } }
      pull(this.sharedMap); pull(this.memMap);
      this.idbAll(function (rows) {
        var i;
        for (i = 0; i < rows.length; i++) if (rows[i] && rows[i].key && rows[i].dataUrl && !out[rows[i].key]) out[rows[i].key] = rows[i].dataUrl;
        cb(out);
      });
    },
    payload: function (cb) {
      var self = this;
      this.clips(function (c2) {
        var k, p = { version: 55, ver: 55, appVersion: "6.1.0", schema: 55, settingsRev: 55, key: "sdp.v55_guaranteed_device_sync", adminPin: "78987898", strictAdminOnly: true, voiceId: self.vid(), modelId: self.mid(), generatedAt: new Date().toISOString(), clips: {} };
        for (k in c2) if (c2[k]) p.clips[k] = { text: (self.metaMap[k] && self.metaMap[k].text) || "", voiceId: self.vid(), modelId: self.mid(), audio: c2[k] };
        cb(p);
      });
    },
    exportJson: function (done) {
      this.payload(function (p) {
        var u, a;
        if (done) done(p);
        try {
          u = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }));
          a = document.createElement("a");
          a.href = u; a.download = "elevenlabs-audio.json"; a.style.display = "none";
          (document.body || document.documentElement).appendChild(a);
          a.click();
          setTimeout(function () { try { URL.revokeObjectURL(u); if (a.parentNode) a.parentNode.removeChild(a); } catch (e) {} }, 1500);
        } catch (e) {}
      });
    },
    importPayload: function (p, cb) {
      var n = this.apply(p);
      cb = cb || function () {};
      if (!n) { cb(0); return 0; }
      this.push(function () { cb(n); });
      return n;
    },
    del: function (k, cb) {
      var self = this;
      delete this.sharedMap[k]; delete this.memMap[k]; delete this.metaMap[k];
      this.idbDel(k, function () { self.push(function () { if (cb) cb(true); }); });
    },
    delAll: function (cb) {
      var self = this;
      cb = cb || function () {};
      this.sharedMap = {}; this.memMap = {}; this.metaMap = {};
      this.idbAll(function (rows) {
        var left = rows.length, i;
        if (!left) { self.push(cb); return; }
        for (i = 0; i < rows.length; i++) self.idbDel(rows[i].key, function () { if (--left <= 0) self.push(cb); });
      });
    },
    /* permanent cross-device storage: GitHub contents API + Cloud sync */
    push: function (cb) {
      var self = this;
      cb = cb || function () {};
      this.payload(function (p) {
        var files = [{ p: "data/elevenlabs-audio.json", text: JSON.stringify(p, null, 2) + "\n" }];
        if (Cloud.ghToken && Cloud.ghToken()) { Cloud.commitFiles(files, "voice pack: " + Object.keys(p.clips).length + " permanent clips", cb); return; }
        if (Cloud.publish) { Cloud.publish({ voicepack: p }, function (r) { cb(r); }); return; }
        cb({ ok: false, err: "no sync link" });
      });
    },
    saveToGitHub: function (cb) { return this.push(cb); },
    verify: function (k, cb) {
      var tok = String(k || this.apiKey() || "");
      cb = cb || function () {};
      if (!tok) { cb("nokey", null); return false; }
      if (!window.fetch) { cb("nofetch", null); return false; }
      try {
        window.fetch(C.sub, { headers: { "xi-api-key": tok } }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
          if (!d) { cb("error", null); return; }
          var lim = Number(d.character_limit) || 10000, use = Number(d.character_count) || 0;
          cb(null, { tier: String(d.tier || "free"), used: use, limit: lim, remaining: Math.max(0, lim - use) });
        }, function () { cb("error", null); });
      } catch (e) { cb("error", null); }
      return true;
    },
    verifyKey: function (k, cb) { return this.verify(k, cb); },
    status: function (c2) {
      var tier = (c2 && c2.tier) || "free", lim = (c2 && c2.limit) || 10000;
      var left = c2 && c2.remaining !== undefined ? c2.remaining : Math.max(0, lim - ((c2 && c2.used) || 0));
      return "✓ Connected · Tier: " + tier.charAt(0).toUpperCase() + tier.slice(1) + " · Remaining ElevenLabs Credits: " + num(left) + " / " + num(lim) + " · Saved Permanent Voice Clips: " + this.count();
    },
    statusText: function (c2) { return this.status(c2); },
    warm: function () {
      var self = this;
      this.idbAll(function (rows) {
        var i;
        for (i = 0; i < rows.length; i++) if (rows[i] && rows[i].key && rows[i].dataUrl && !self.memMap[rows[i].key]) self.memMap[rows[i].key] = rows[i].dataUrl;
      });
    },
    boot: function () {
      var s = this.cfg();
      this.warm();
      s.elevenLabsKey = s.elevenLabsKey || "";
      s.elevenLabsVoiceId = s.elevenLabsVoiceId || C.voiceId;
      s.elevenLabsModelId = s.elevenLabsModelId || C.modelId;
      this.loadShared(function () {});
      return this;
    }
  };
  V.voiceId = V.vid; V.setVoiceId = V.setVid; V.modelId = V.mid; V.setModelId = V.setMid;
  V.creditRate = V.rate; V.voiceName = V.vname; V.speakText = V.speak; V.spellText = V.spell;
  V.clipCount = V.count; V.deleteClip = V.del; V.deleteAll = V.delAll; V.syncClip = V.find;
  V.loadSharedVault = V.loadShared;
  V.setKey = V.setApiKey; V.applyShared = V.apply; V.exportPayload = V.payload;
  V.planTexts = V.texts; V.saveToGitHub = V.push; V.importVault = V.importPayload;
   V.hasKey = V.hasKey;
  /* the documented v55 vault API names */
  V.voiceId = V.vid; V.setVoiceId = V.setVid; 
  V.modelId = V.mid; V.setModelId = V.setMid;
  V.creditRate = V.rate; V.voiceName = V.vname;
  V.speakText = V.speak; V.spellText = V.spell;
  V.clipCount = V.count; V.syncClip = V.find;
  V.deleteClip = V.del; V.deleteAll = V.delAll;
  V.applyShared = V.apply; V.exportPayload = V.payload;
  V.planTexts = V.texts; V.saveToGitHub = V.push;
  V.loadSharedVault = V.loadShared;
  V.setKey = V.setApiKey;
  window.ElevenVault = V;
  window.EV53 = C;
  window.EV55 = window.EV55 || C;
  window.EV = V;
  Speech.hashText = hs;
  Speech.elevenVault = V;
  var oldText = Speech._playText, oldWord = Speech.playWord;
  Speech._legacyPlayText = oldText;
  Speech._legacyPlayWord = oldWord;
  Speech._playText = function (t, lang, tok, cb, r) {
    var self = this, ok = false, l = lang === "si" ? "si" : "en";
    function legacy() { oldText.call(self, t, lang, tok, cb, r); }
    try {
      if (V.hasKey() && l === "en") { ok = V.playOrFetchOnce(t, l, tok, cb, r); }
      else { ok = V.speak(t, l, tok, cb, r, legacy); }
    } catch (e) { ok = false; }
    if (!ok) { legacy(); }
  };
  Speech.playWord = function (w, r, cb) {
    var self = this, x = this.cleanWordOnly(w), tok = this._seqToken, ok = false;
    if (!x) { if (cb) cb(false); return tok; }
    try {
      if (V.hasKey()) { ok = V.playOrFetchOnce(x, "en", tok, cb, r); }
      else { ok = V.speak(x, "en", tok, cb, r, function () { oldWord.call(self, x, r, cb); }); }
    } catch (e) { ok = false; }
    return ok ? tok : oldWord.call(this, x, r, cb);
  };
})();

/* SECTION 60B lives in scripts/v55-completer.js */

/* SECTION 61 - v55 PERMANENT GITHUB REPOSITORY + CLOUD CROSS-DEVICE SYNC */
(function () {
  var V = window.ElevenVault, KEY = "sdp.v55_guaranteed_device_sync", UV = window.UniversalSync, EV = window.EncryptedVault;
  function vaultBits() {
    var o = {};
    try { o.syncRev = Number(DB.data.syncRev) || 0; o.vaultCiphertext = String(DB.data.vaultCiphertext || ""); } catch (e) { o.syncRev = 0; o.vaultCiphertext = ""; }
    return o;
  }
  function versionDoc() {
    return {
      ver: 55, appVersion: "6.1.0", version: "6.1.0", buildDate: BUILD_DATE, schema: 55, settingsRev: 55, key: KEY, storageKey: KEY,
      adminPin: "78987898", updatedAt: new Date().toISOString(), updatedAtMs: Date.now(), voiceId: V.vid(), voiceName: V.vname(), modelId: V.mid(),
      activeVideoSrc: DEFAULT_WALLPAPER_SRC, activeMediaType: "video", videoPlaylistMode: "loop",
      voicePack: V.count(), creditLock: "student playback replays saved clips only",
      syncRev: vaultBits().syncRev, vaultCiphertext: vaultBits().vaultCiphertext
    };
  }
  function configDoc() {
    var s = DB.data, list = null;
    try { list = Lib.current() || (s.lists && s.lists[0]) || null; } catch (e) { list = null; }
    list = list || {};
    return {
      appName: "Smart Dictation", appVersion: "6.1.0", ver: 55, version: "6.1.0", schema: 55, settingsRev: 55, key: KEY,
      classDays: [2, 4], level: "B1", adminPin: "78987898", repoOwner: CONFIG.repoOwner, repoName: CONFIG.repoName,
      activeVideoSrc: DEFAULT_WALLPAPER_SRC, activeMediaType: "video", videoPlaylistMode: "loop", perf: "full",
      session: {
        no: (s.session && s.session.no) || "1", day: (s.session && s.session.day) || "", date: (s.session && s.session.date) || U.dateKey(new Date()),
        title: (s.session && s.session.title) || list.name || "", listId: list.id || "", classInfo: (s.session && s.session.classInfo) || "",
        branch: (s.session && s.session.branch) || "CCBE Galle Branch", activeVideoSrc: DEFAULT_WALLPAPER_SRC, videoPlaylistMode: "loop", perf: "full"
      },
      defaults: { sentence: false, repeats: 2, rate: 0.96, numbers: true, mode: "paper", writeMode: "fixed", writeFixed: 5, pauseWord: 1.2, pauseSent: 1.6, theme: "dark", perf: "full", glassTint: 0, wallpaperVideo: true, activeVideoSrc: DEFAULT_WALLPAPER_SRC, videoPlaylistMode: "loop" },
      listId: list.id || "",
      syncRev: vaultBits().syncRev, vaultCiphertext: vaultBits().vaultCiphertext,
      words: (list.words || []).map(function (w) { return { w: w.w || w, p: w.p || "", m: w.m || w.d || "", si: w.si || "", s: w.s || "", audio: w.audio || "" }; })
    };
  }
  window.GitHubSync = {
    repo: function () { return CONFIG.repoOwner + "/" + CONFIG.repoName; },
    hasToken: function () { return !!Cloud.ghToken(); },
    token: function (v) { if (v !== undefined) Cloud.ghToken(String(v).replace(/^\s+|\s+$/g, "")); return Cloud.ghToken(); },
    saveToken: function (v) { return this.token(v); },
    files: function () {
      var p = Cloud.repoPayload();
      return [{ p: "data/session.json", text: JSON.stringify(p.session, null, 2) + "\n" }, { p: "data/version.json", text: JSON.stringify(versionDoc(), null, 2) + "\n" }, { p: "data/config.json", text: JSON.stringify(configDoc(), null, 2) + "\n" }];
    },
    commitFiles: function (f, m, cb) { return Cloud.commitFiles(f, m, cb); },
    commitAll: function (m, cb) {
      var f = this.files();
      V.payload(function (p) { f.push({ p: "data/elevenlabs-audio.json", text: JSON.stringify(p, null, 2) + "\n" }); Cloud.commitFiles(f, m, cb); });
      return true;
    },
    test: function (cb) {
      var tok = Cloud.ghToken();
      cb = cb || function () {};
      if (!tok) { cb({ ok: false, err: "Paste a GitHub token with Contents: write first." }); return false; }
      Cloud.ghApi(Cloud.ghPath("data/version.json"), "GET", null, tok, function (r) {
        cb(r && r.ok ? { ok: true, repo: CONFIG.repoOwner + "/" + CONFIG.repoName } : { ok: false, err: (r && r.err) || "cannot read the repository" });
      });
      return true;
    }
  };
  /* PUT /repos/dictationb1/dictationb1.github.io/contents/<path> with the current sha */
  Cloud.commitFiles = function (files, msg, cb) {
    var tok = this.ghToken(), self = this, bad = [], i = 0;
    cb = cb || function () {};
    if (!tok) { cb({ ok: false, err: "Paste a GitHub token with Contents: write first." }); return false; }
    if (!files || !files.length) { cb({ ok: true, committed: 0 }); return true; }
    function step() {
      if (i >= files.length) { cb({ ok: !bad.length, committed: files.length - bad.length, err: bad.join(" ") }); return; }
      var f = files[i], url = self.ghPath(f.p);
      self.ghApi(url, "GET", null, tok, function (r) {
        var body = { message: msg || "v55: publish from the professor studio", content: self.b64utf8(f.text), branch: "main" };
        if (r && r.ok && r.res && r.res.content) body.sha = r.res.content.sha;
        self.ghApi(url, "PUT", body, tok, function (w) {
          if (!w || !w.ok) bad.push(f.p + ": " + ((w && w.err) || "failed"));
          i++;
          step();
        });
      });
    }
    step();
    return true;
  };
  Cloud.publish = function (extra, cb) {
    var p = Cloud.repoPayload(), body = { action: "publish", state: p.session, version: p.version }, k;
    if (typeof extra === "function") { cb = extra; extra = null; }
    for (k in extra || {}) if (Object.prototype.hasOwnProperty.call(extra, k)) body[k] = extra[k];
    if (!this.mode) { if (cb) cb({ ok: false, err: "no cloud link" }); return false; }
    this.post(body, function (r) { if (cb) cb(r || { ok: false }); });
    return true;
  };
  Cloud.fetchRemote = function (cb) {
    cb = cb || function () {};
    if (!this.mode) { cb({ ok: false, err: "no cloud link" }); return false; }
    this.get({ action: "state" }, function (r) {
      if (r && r.ok) {
        if (r.voicepack) { try { V.apply(r.voicepack); } catch (e) {} }
        Cloud.applyState(r);
      }
      cb(r || { ok: false });
    });
    return true;
  };
  Cloud.ghPublish = function (cb) {
    var f = GitHubSync.files();
    V.payload(function (p) { f.push({ p: "data/elevenlabs-audio.json", text: JSON.stringify(p, null, 2) + "\n" }); Cloud.commitFiles(f, "v55: publish words + permanent voice vault", cb); });
  };
  /* boot: the permanent voice vault and the remote class state arrive on their own
     (DB.syncRemote already applies a pulled state, so it is reused, not replaced) */
  try {
    V.boot();
    V.loadShared(function () {
      try { if (Cloud.fetchRemote && Cloud.mode) Cloud.fetchRemote(function () {}); } catch (e) {}
    });
  } catch (e) {}
  window.Publisher = {
    saveAll: function (prog, cb) {
      var f = GitHubSync.files(), note = [];
      cb = cb || function () {};
      if (prog) prog("Saving the word list to GitHub and the cloud…");
      V.payload(function (p) {
        f.push({ p: "data/elevenlabs-audio.json", text: JSON.stringify(p, null, 2) + "\n" });
        function cloud() {
          Cloud.publish({ voicepack: p }, function (r) {
            note.push(r && r.ok ? "Cloud sync sent" : "Saved on this device — add a GitHub token so every phone updates");
            cb({ ok: true, note: note.join(" · ") });
          });
        }
        if (Cloud.ghToken()) {
          Cloud.commitFiles(f, "v55: publish session words + permanent voice vault", function (r) {
            note.push(r && r.ok ? "GitHub repository updated" : "GitHub: " + ((r && r.err) || "not configured"));
            cloud();
          });
          return;
        }
        cloud();
      });
      return true;
    }
  };
})();

/* SECTION 62 - v55 PROFESSOR STUDIO (three cards + the cross-device sync bar) */
(function () {
  var V = window.ElevenVault, C = window.EV53 || window.EV54 || window.EV55, cards = 0, UV = window.UniversalSync, EV = window.EncryptedVault;
  var TABS = [["words", "📚 Words & planner"], ["session", "🗓️ Session"], ["announce", "📣 Announce & inbox"], ["comments", "💬 Comments"], ["stats", "📊 Class stats"], ["tools", "🛠️ Settings & tools"]];
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function $(id, host) { return (host || document).querySelector("#" + id); }
  function say(el, txt, good) { if (el) { el.textContent = txt; el.className = "small " + (good ? "good" : ""); } }
  function open(host, html) { var box = Admin.card(host, ""); box.insertAdjacentHTML("beforeend", html); return box; }
  function title(box, text) { try { box.parentNode.insertBefore(U.el("h3", null, text), box); } catch (e) {} }
  function words() {
    var l = null;
    try { l = Lib.current(); } catch (e) { l = null; }
    if (!l) { try { l = DB.data.lists[0]; } catch (e) { l = null; } }
    return (l && l.words) || [];
  }
  function parse(txt) {
    try { return window.AdminAutoEnrich.parse(txt); } catch (e) {
      return String(txt || "").split(/[\n,;|]+/).map(function (w) { return String(w).replace(/^\s+|\s+$/g, "").toLowerCase(); }).filter(function (w) { return !!w; });
    }
  }

  /* ---- v55 PRE-EDIT SYNC WARNING CARD + BILINGUAL STEP-BY-STEP SETUP GUIDE ---- */
  var GH_TOKEN_URL = "https://github.com/settings/tokens/new?description=Smart+Dictation+Player+Permanent+Sync&scopes=repo";
  var EL_KEYS_URL = "https://elevenlabs.io/app/settings/api-keys";
  var PRE_EDIT_WARNING = "⚠️ Warning: GitHub Token / ElevenLabs Key is not connected yet! Please complete the Step-by-Step Sync Setup right above so your voice clips and words save permanently to GitHub for all student devices.";
  var VERIFIED_LINE = "✓ 100% Cross-Device Permanent GitHub & ElevenLabs Sync ACTIVE · Keys Encrypted (SDP_ENC_V1) · All Student Devices Synced";
  var WARN_LINE = "⚠️ Action Required Before Editing: Connect Your ElevenLabs Key & GitHub Token for 100% Cross-Device Permanent Sync!";
  function guideLang() {
    var l = "";
    try { l = String((DB.data.settings || {}).guideLang || "en"); } catch (e) { l = "en"; }
    return l === "si" ? "si" : "en";
  }
  function guideHtml(lang) {
    var en = lang !== "si";
    function li(txt) { return "<li style=\"color:#f8fafc\">" + txt + "</li>"; }
    function step(n, title) { return '<h4 style="margin:12px 0 4px;color:#fcd34d;font-size:.95rem">' + n + "</h4>"; }
    var h = "";
    if (en) {
      h += '<p class="small" style="margin:0 0 6px;color:#f8fafc"><strong>The 60-second one-time setup (do it once on this PC):</strong></p>';
      h += step("Step 1 — Get Your ElevenLabs API Key (Free 10,000 Credits)", "");
      h += "<ol class=\"small\" style=\"margin:0 0 0 18px\">" +
        li('<a id="lnkElKeys" href="' + EL_KEYS_URL + '" target="_blank" rel="noopener" style="font-weight:700;color:#ffd166;text-decoration:underline">🔗 1. Open ElevenLabs API Keys Page</a>') +
        li('Click <strong>"Create API Key"</strong>, copy the key (starts with <code>sk_…</code>), and paste it into the <strong>ElevenLabs API Key</strong> box in Card 3 below.') +
        "</ol>";
      h += step("Step 2 — Get Your GitHub Token (Required Once so Voice Clips &amp; Words Save Permanently to GitHub for All Devices)", "");
      h += "<ol class=\"small\" style=\"margin:0 0 0 18px\">" +
        li('<a id="lnkGhToken" href="' + GH_TOKEN_URL + '" target="_blank" rel="noopener" style="font-weight:700;color:#ffd166;text-decoration:underline">🔗 2. Open GitHub Token Creator (Pre-Filled)</a> — the <code>repo</code> permission is already ticked for you.') +
        li('Set <strong>Expiration</strong> to <strong>"No expiration"</strong>, scroll to the bottom, and click the green <strong>"Generate token"</strong> button.') +
        li('Copy the token (starts with <code>ghp_…</code>), and paste it into the <strong>GitHub Personal Access Token</strong> box in Card 3 below.') +
        "</ol>";
      h += step("Step 3 — Lock &amp; Sync to All Devices", "");
      h += "<ol class=\"small\" style=\"margin:0 0 0 18px\">" +
        li('Click <strong>"🔒 Save, Encrypt &amp; Sync Keys + Generate Voice Pack to All Devices"</strong> below.') +
        li("That single button verifies both keys, encrypts both into <code>vaultCiphertext</code> (<code>SDP_ENC_V1:…</code>), pushes the &lt; 600 byte packet straight to <code>ntfy.sh/dictationb1_sdp_keys_v55</code>, commits <code>data/config.json</code> + <code>data/session.json</code> to GitHub, and generates any missing Session 8 ElevenLabs clips into <code>data/elevenlabs-audio.json</code> — so every device gets both the encrypted keys and the ElevenLabs voice instantly.") +
        "</ol>";
    } else {
      h += '<p class="small" style="margin:0 0 6px;color:#f8fafc"><strong>තත්පර 60ක එක් වරක් කරන සැකසුම (මෙම පරිගණකයේ එක් වරක් පමණක් කරන්න):</strong></p>';
      h += step("පියවර 1 — ඔබේ ElevenLabs API යතුර ලබා ගන්න (නොමිලේ ක්‍රෙඩිට් 10,000)", "");
      h += "<ol class=\"small\" style=\"margin:0 0 0 18px\">" +
        li('<a id="lnkElKeys" href="' + EL_KEYS_URL + '" target="_blank" rel="noopener" style="font-weight:700;color:#ffd166;text-decoration:underline">🔗 1. ElevenLabs API යතුරු පිටුව විවෘත කරන්න</a>') +
        li('<strong>"Create API Key"</strong> ක්ලික් කර, යතුර copy කර (<code>sk_…</code> ලෙස ආරම්භ වේ), පහළ Card 3 හි <strong>ElevenLabs API Key</strong> කොටුවට paste කරන්න.') +
        "</ol>";
      h += step("පියවර 2 — ඔබේ GitHub Token ලබා ගන්න (හඬ පටි සහ වචන සියලු උපාංග සඳහා GitHub හි ස්ථිරව සුරැකීමට එක් වරක් අවශ්‍යයි)", "");
      h += "<ol class=\"small\" style=\"margin:0 0 0 18px\">" +
        li('<a id="lnkGhToken" href="' + GH_TOKEN_URL + '" target="_blank" rel="noopener" style="font-weight:700;color:#ffd166;text-decoration:underline">🔗 2. GitHub Token Creator (කලින් පිරවූ) විවෘත කරන්න</a> — <code>repo</code> අවසරය දැනටමත් තෝරා ඇත.') +
        li('<strong>Expiration</strong> → <strong>"No expiration"</strong> තෝරන්න, පහළට scroll කර හරිත <strong>"Generate token"</strong> බොත්තම ක්ලික් කරන්න.') +
        li('යතුර copy කර (<code>ghp_…</code> ලෙස ආරම්භ වේ), පහළ Card 3 හි <strong>GitHub Personal Access Token</strong> කොටුවට paste කරන්න.') +
        "</ol>";
      h += step("පියවර 3 — Lock &amp; Sync සියලු උපාංග සඳහා", "");
      h += "<ol class=\"small\" style=\"margin:0 0 0 18px\">" +
        li('පහළ <strong>"🔒 Save, Encrypt &amp; Sync Keys + Generate Voice Pack to All Devices"</strong> ක්ලික් කරන්න.') +
        li("එම එකම බොත්තම යතුරු දෙකම තහවුරු කර, <code>SDP_ENC_V1:…</code> ලෙස සංකේතනය කර, &lt; 600 byte packet එක <code>ntfy.sh/dictationb1_sdp_keys_v55</code> වෙත යවයි, <code>data/config.json</code> + <code>data/session.json</code> GitHub වෙත commit කරයි, සහ ඉතිරි Session 8 ElevenLabs හඬ පටි <code>data/elevenlabs-audio.json</code> වෙත සාදා commit කරයි — එවිට සෑම උපාංගයකටම සංකේතිත යතුරු සහ ElevenLabs හඬ වහාම ලැබේ.") +
        "</ol>";
    }
    return h;
  }
  function syncReady() {
    var tok = "";
    try { tok = String((Cloud.ghToken && Cloud.ghToken()) || ""); } catch (e) { tok = ""; }
    return !!V.apiKey() && !!tok;
  }
  function scrollTo(el) {
    if (!el) { return false; }
    try { if (typeof el.scrollIntoView === "function") { el.scrollIntoView({ behavior: "smooth", block: "start" }); return true; } } catch (e) {}
    return false;
  }
  function showPreEditWarning(onContinue) {
    var layer = document.getElementById("syncPreEditWarn"), txt;
    try { window.__sdpPreEditWarning = PRE_EDIT_WARNING; } catch (e) {}
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "syncPreEditWarn";
      layer.setAttribute("role", "alertdialog");
      layer.setAttribute("aria-modal", "true");
      layer.setAttribute("style", "position:fixed;left:0;right:0;top:0;bottom:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,10,17,.66);");
      layer.innerHTML = '<div class="modal flex-card" style="position:relative;transform:none;left:auto;top:auto;max-width:470px;border:2px solid #f59e0b;border-radius:16px;padding:16px;background:linear-gradient(145deg, rgba(120,53,15,.94), rgba(15,23,42,.96));">' +
        '<h3 style="margin:0 0 8px">⚠️ Sync Setup Required Before Editing</h3>' +
        '<p class="small" id="syncPreEditWarnText" style="margin:0 0 12px"></p>' +
        '<div class="btn-row tight"><button class="btn primary" type="button" id="btnPreEditWarnSetup">🔒 Take me to the Step-by-Step Setup</button>' +
        '<button class="btn soft" type="button" id="btnPreEditWarnContinue">Continue anyway (not permanent)</button>' +
        '<button class="btn soft" type="button" id="btnPreEditWarnClose">Close</button></div></div>';
      (document.body || document.documentElement).appendChild(layer);
      var go = document.getElementById("btnPreEditWarnSetup"), close = document.getElementById("btnPreEditWarnClose"), next = document.getElementById("btnPreEditWarnContinue");
      if (go) {
        go.onclick = function () {
          layer.style.display = "none";
          scrollTo(document.getElementById("adminSyncWarningCard"));
        };
      }
      if (close) { close.onclick = function () { layer.style.display = "none"; }; }
      if (next) {
        next.onclick = function () {
          layer.style.display = "none";
          window.__sdpWarnAcknowledged = true;
          if (typeof onContinue === "function") { try { onContinue(); } catch (e) {} }
        };
      }
    }
    if (typeof onContinue === "function") {
      var again = document.getElementById("btnPreEditWarnContinue");
      if (again) { again.onclick = function () { layer.style.display = "none"; window.__sdpWarnAcknowledged = true; onContinue(); }; }
    }
    txt = document.getElementById("syncPreEditWarnText");
    if (txt) { txt.textContent = PRE_EDIT_WARNING; }
    layer.style.display = "flex";
    scrollTo(document.getElementById("adminSyncWarningCard"));
    try { if (UI && UI.toast) { UI.toast("⚠️ Add the ElevenLabs key and the GitHub token first — then your words and voice save to GitHub for every device.", { icon: "i-warn", ms: 7000 }); } } catch (e) {}
    return true;
  }
  function saveAllAndSync(btn) {
    var keyEl = document.getElementById("elApiKeyInput"), tokEl = document.getElementById("ghTokenInput");
    var key = keyEl ? String(keyEl.value || "").replace(/^\s+|\s+$/g, "") : "";
    var tok = tokEl ? String(tokEl.value || "").replace(/^\s+|\s+$/g, "") : "";
    var st = document.getElementById("adminSyncState");
    key = key || V.apiKey();
    tok = tok || String((Cloud.ghToken && Cloud.ghToken()) || "");
    if (!key || !tok) {
      if (st) { st.textContent = "⚠️ Both the ElevenLabs API key (sk_…) and the GitHub token (ghp_…) are required before the vault can sync."; }
      showPreEditWarning();
      return false;
    }
    V.setApiKey(key);
    try { if (Cloud.ghToken) { Cloud.ghToken(tok); } } catch (e) {}
    if (btn) { btn.disabled = true; }
    if (st) { st.textContent = "🔒 Encrypting both keys with your PIN (SDP_ENC_V1) · pushing the < 600 byte relay packet to ntfy.sh/dictationb1_sdp_keys_v55 …"; }
    if (UV) {
      UV.pushAll("save-and-sync-keys", function (r) {
        var ch = (r && r.channels) ? r.channels.join(" · ") : "";
        if (st) { st.textContent = "✓ Keys encrypted and pushed" + (ch ? " · " + ch : "") + " · generating any missing voice clips…"; }
        try { refreshSync(); } catch (e) {}
      });
    }
    V.adminGenerateMissing("session", function (t) {
      if (st) { st.textContent = "🎙️ " + t; }
    }, function (r) {
      V.push(function (sv) {
        if (btn) { btn.disabled = false; }
        if (st) {
          st.textContent = "✓ " + r.generated + " new clips · " + r.cached + " already saved · " + (sv && sv.ok ? "committed to GitHub data/elevenlabs-audio.json" : "saved here, will commit with the next GitHub token save") + " · encrypted keys are live on every device.";
        }
        if (UV) { UV.pushAll("voice-clips", function () { try { refreshSync(); } catch (e) {} }); }
        try { Admin.renderTab(); } catch (e) {}
        try { UI.toast("✓ Keys + voice pack synced to every device", { icon: "i-check" }); } catch (e) {}
      });
    });
    return true;
  }
  function syncWarningCard(host) {
    var ready = syncReady(), el = document.createElement("div"), lang = guideLang(), clips = 0;
    try { clips = V.count(); } catch (e) { clips = 0; }
    el.id = "adminSyncWarningCard";
    el.setAttribute("role", "status");
    el.setAttribute("data-state", ready ? "verified" : "warn");
    el.setAttribute("style", ready
      ? "border: 2px solid #34d399 !important; background: linear-gradient(145deg, rgba(6, 78, 59, 0.78), rgba(15, 23, 42, 0.92)) !important; border-radius: 18px; padding: 14px 16px; margin: 0 0 14px; box-shadow: 0 10px 30px rgba(16,185,129,0.22);"
      : "border: 2px solid #f59e0b !important; background: linear-gradient(145deg, rgba(120, 53, 15, 0.78), rgba(15, 23, 42, 0.92)) !important; border-radius: 18px; padding: 14px 16px; margin: 0 0 14px; box-shadow: 0 10px 30px rgba(245,158,11,0.22);");
    el.innerHTML =
      '<p class="small" id="adminSyncHeadline" style="margin:0 0 8px;font-weight:700;line-height:1.45;color:' + (ready ? '#a7f3d0' : '#fde68a') + '">' + esc(ready ? VERIFIED_LINE : WARN_LINE) + '</p>' +
      '<p class="tiny" id="adminSyncExplain" style="margin:0 0 10px;line-height:1.5;color:#e2e8f0">' + esc(ready
        ? "Your ElevenLabs key and GitHub token are encrypted (SDP_ENC_V1) and travel through ntfy.sh/dictationb1_sdp_keys_v55 (under 600 bytes, no CORS preflight) plus data/config.json, so any phone or laptop gets the key in about 0.1 seconds. Voice clips are permanent in data/elevenlabs-audio.json — playback on every device uses 0 credits."
        : "Right now, your changes or voice clips are not permanently linked to GitHub. Complete the 2-minute one-time setup below once — then your keys will be encrypted (SDP_ENC_V1) and synced to all your devices automatically forever!") + '</p>' +
      '<div class="btn-row tight" style="margin:0 0 6px">' +
      '<button class="btn sm soft" type="button" id="btnSyncGuideLang">' + (lang === "si" ? "🇬🇧 Show English Guide" : "🇱🇰 සිංහල උපදෙස් පෙන්වන්න") + '</button>' +
      '<span class="chip" id="adminSyncChip" style="font-size:.72rem;color:#f8fafc">' + esc("Sync: " + (V.apiKey() ? "ElevenLabs key ✓" : "ElevenLabs key ✗") + " · " + (String((Cloud.ghToken && Cloud.ghToken()) || "") ? "GitHub token ✓" : "GitHub token ✗") + " · Clips: " + clips) + '</span></div>' +
      '<div id="syncGuideBody" data-lang="' + lang + '" style="color:#f8fafc">' + guideHtml(lang) + '</div>' +
      '<p class="small" id="adminSyncState" role="status" style="margin:8px 0 0;color:#fde68a"></p>' +
      '<button class="btn primary block" type="button" id="btnSaveAndSyncAll" style="margin-top:8px">🔒 Save, Encrypt &amp; Sync Keys + Generate Voice Pack to All Devices</button>';
    host.insertBefore(el, host.firstChild || null);
    var toggle = document.getElementById("btnSyncGuideLang"), save = document.getElementById("btnSaveAndSyncAll");
    if (toggle) {
      toggle.onclick = function () {
        var next = guideLang() === "si" ? "en" : "si", body = document.getElementById("syncGuideBody");
        try { DB.data.settings.guideLang = next; DB.saveNow(); } catch (e) {}
        if (body) { body.setAttribute("data-lang", next); body.innerHTML = guideHtml(next); }
        toggle.textContent = next === "si" ? "🇬🇧 Show English Guide" : "🇱🇰 සිංහල උපදෙස් පෙන්වන්න";
      };
    }
    if (save) { save.onclick = function () { return saveAllAndSync(save); }; }
    return el;
  }

  function syncBar(host) {
    var txt = "✓ 100% Synced Across All Devices · Last Saved: " + (UV ? UV.time(DB.data.syncRev || 0) : "—") +
      " · API Key: " + (V.apiKey() ? "Saved & Encrypted" : "Not set") + " · Voice Clips: " + (V.count() < 10 ? "0" : "") + V.count();
    var box = open(host, '<p class="small good" id="syncBanner" role="status">' + esc(txt) + '</p>' +
      '<p class="tiny muted" id="syncDetail">Every save in Lecturer Mode is encrypted with your PIN and pushed to the Cloud relay, the GitHub repository and the shared clip relay, so phones, tablets and other PCs get the same API key, words and voice clips within a second.</p>' +
      '<button class="btn primary block" type="button" id="btnForceSync">🔄 Sync Now Across All Devices</button>');
    title(box, "🛰️ Cross-Device Sync — Encrypted API Keys, Words & Voice Clips");
    var go = $("btnForceSync", box);
    go.onclick = function () {
      var spot = $("syncDetail", box);
      go.disabled = true;
      if (spot) spot.textContent = "Pulling the newest encrypted settings from every device…";
      if (!UV) { go.disabled = false; if (spot) spot.textContent = "The sync engine is still loading — try again in a second."; return; }
      UV.pullAll(function (r) {
        UV.pushAll("force-sync", function () {
          go.disabled = false;
          refreshSync();
          if (spot) spot.textContent = "✓ " + (r && r.rev ? "Pulled revision " + r.rev + " · " : "") + "Pushed this device again. API key and clips are encrypted before they leave the device.";
          try { EV.paint(); } catch (e) {}
        });
      });
    };
    cards++;
    return box;
  }

  function refreshSync() {
    var el = document.getElementById("syncBanner");
    try {
      var card = document.getElementById("adminSyncWarningCard");
      if (card) {
        var ready = syncReady(), chip = document.getElementById("adminSyncChip");
        card.setAttribute("data-state", ready ? "verified" : "warn");
        if (chip) { chip.textContent = "Sync: " + (V.apiKey() ? "ElevenLabs key ✓" : "ElevenLabs key ✗") + " · " + (String((Cloud.ghToken && Cloud.ghToken()) || "") ? "GitHub token ✓" : "GitHub token ✗") + " · Clips: " + V.count(); }
      }
    } catch (e) {}
    if (!el) return "";
    var txt = UV ? UV.banner() : "✓ 100% Synced Across All Devices · API Key: " + (V.apiKey() ? "Saved & Encrypted" : "Not set") + " · Voice Clips: " + V.count();
    if (UV) { el.textContent = txt; el.className = "small good"; }
    return txt;
  }

  function card1(host) {
    var s = DB.data.session || {}, w = words(), i, row;
    var box = open(host, '<p class="tiny muted">Type or paste only the words. IPA, the English definition, the Sinhala meaning, an example sentence and the published session are completed for you, the previous week is archived, and every student device gets the new list.</p>' +
      '<label class="field"><span class="lbl">Session title</span><input id="profSessionTitle" type="text" placeholder="Session 8 - Personal Feelings, Opinions &amp; Experiences (Adj)" value="' + esc(s.title || "") + '"></label>' +
      '<label class="field"><span class="lbl">Session date</span><input id="profSessionDate" type="date" value="' + esc(s.date || U.dateKey(new Date())) + '"></label>' +
      '<label class="field"><span class="lbl">Class / lecturer info</span><input id="profClassInfo" type="text" placeholder="CCBE Galle Branch • TUE/THU/IPET015 • Ms. Sumodya Sewmini" value="' + esc(s.classInfo || "CCBE Galle Branch • TUE/THU/IPET015 • Ms. Sumodya Sewmini") + '"></label>' +
      '<label class="field"><span class="lbl">The weekly word list — one word per line (or commas)</span><textarea id="adminQuickWordsInput" aria-label="Dictation words" placeholder="afraid&#10;amazed&#10;amusing" style="min-height:170px;font-size:16px;font-family:ui-monospace,Menlo,Consolas,monospace">' + esc(w.map(function (x) { return x.w || x; }).join("\n")) + '</textarea></label>' +
      '<div class="btn-row tight"><span class="chip good" id="profWordCount" role="status">0 words in list</span><button class="btn sm soft" type="button" id="btnProfClearWords">🧹 Clear List</button></div>' +
      '<details class="field-details"><summary>👀 Preview the completed table (#1..#30 · word · UK IPA · Sinhala meaning · example · play · delete)</summary><div class="prof-table" id="profWordsTable"></div></details>' +
      '<p class="small" id="adminQuickStatus" role="status" style="margin-top:10px">The list above is ready — press the big button once.</p>' +
      '<button class="btn primary block xl" type="button" id="btnAdminAutoComplete" style="margin-top:8px">🚀 Save Words, Auto-Complete Meanings &amp; Publish to All Devices</button>');
    title(box, "📝 Step 1: Professor Weekly Word List Editor (One-Click Auto-Complete & Publish)");
    var area = $("adminQuickWordsInput", box), pill = $("profWordCount", box), table = $("profWordsTable", box), note = $("adminQuickStatus", box), go = $("btnAdminAutoComplete", box);
    function count() { pill.textContent = parse(area.value).length + " words in list"; }
    function st(txt, good) { say($("adminQuickStatus"), txt, good); }
    function paint() {
      var html = "", j;
      count();
      if (!w.length) { table.innerHTML = '<p class="tiny muted">No saved words yet — type them above and press the big button.</p>'; return; }
      html = '<div class="prof-row head"><span>#</span><span>Word</span><span>UK IPA</span><span>Sinhala meaning</span><span>Example sentence</span><span></span></div>';
      for (j = 0; j < w.length; j++) {
        row = w[j] || {};
        html += '<div class="prof-row"><span class="mono">#' + (j + 1) + '</span><span class="strong">' + esc(row.w || row) + '</span><span>' + esc(row.p || "—") + '</span><span>' + esc(row.si || row.m || "—") + '</span><span class="tiny">' + esc(row.s || row.ex || "—") + '</span><span class="row tight"><button class="btn sm ghost" type="button" data-play="' + j + '" aria-label="Play ' + esc(row.w || "word") + '">🔊</button><button class="btn sm ghost" type="button" data-del="' + j + '" aria-label="Remove ' + esc(row.w || "word") + '">🗑️</button></span></div>';
      }
      table.innerHTML = html;
    }
    table.onclick = function (ev) {
      var t = ev.target, p = t.getAttribute && t.getAttribute("data-play"), d = t.getAttribute && t.getAttribute("data-del");
      if (p != null) { try { Speech.playWord((w[Number(p)] || {}).w, 0.72); } catch (e) {} }
      if (d != null) {
        var lines = area.value.split("\n").filter(function (x) { return String(x).replace(/^\s+|\s+$/g, ""); });
        lines.splice(Number(d), 1);
        area.value = lines.join("\n");
        count();
      }
    };
    area.oninput = count;
    $("btnProfClearWords", box).onclick = function () { area.value = ""; count(); st("List cleared — type or paste the new words.", false); };
    function publishNow() {
      var list = parse(area.value), meta, no = parseInt(String((DB.data.session && DB.data.session.no) || "1").replace(/[^0-9]/g, ""), 10) || 1;
      if (!list.length) { st("Please type at least one dictation word first.", false); return; }
      go.disabled = true;
      st("Working through your words…", false);
      meta = { title: $("profSessionTitle", box).value, date: $("profSessionDate", box).value, classInfo: $("profClassInfo", box).value, no: String(no + 1) };
      window.AdminAutoEnrich.run(list, meta, function (t) { st(t, false); }, function (r) {
        if (!r || !r.ok) { go.disabled = false; st("No readable words were found. Use commas or new lines with plain English words.", false); return; }
        try { DB.data.session.classInfo = meta.classInfo; if (meta.title) DB.data.session.title = meta.title; DB.saveNow(); } catch (e) {}
        window.Publisher.saveAll(function (t) { st(t, false); }, function (sv) {
          if (UV) { UV.pushAll("words-and-settings"); }
          try { Admin.renderTab(); } catch (e) {}
          st("✓ " + list.length + " words saved · IPA, meanings, Sinhala & sentences filled · " + ((sv && sv.note) || "published"), true);
          try { UI.toast("Session published · " + list.length + " words completed", { icon: "i-check" }); } catch (e) {}
        });
      });
    }
    go.onclick = function () {
      /* v55: warn BEFORE publishing when the keys are missing - the lecturer can fix it in 60 s
         or explicitly continue without permanent cross-device sync. */
      if (!syncReady() && !window.__sdpWarnAcknowledged) { showPreEditWarning(publishNow); return; }
      publishNow();
    };
    paint();
    cards++;
    return box;
  }

  function card2(host) {
    var box = open(host, '<p class="small good" id="elCreditLockBanner" role="status">🔒 Credit Protection Lock: ACTIVE — 0 credits are ever used during student playback. Clips generate ONLY once when you click Generate below and stay saved permanently until deleted.</p>' +
      '<p class="chip good" id="elCreditBadge" role="status" style="margin:6px 0 10px">Saved Permanent Voice Clips: 0</p>' +
      '<p class="tiny muted" id="elVaultStats"></p><p class="tiny muted" id="elGenProgress" role="status"></p>' +
      '<button class="btn primary block" type="button" id="btnElGenerateAll" style="margin-top:10px">⚡ Generate &amp; Save Missing Clips to GitHub Now</button>' +
      '<div class="btn-row tight"><button class="btn soft block" type="button" id="btnElExportJson">📥 Download data/elevenlabs-audio.json</button><button class="btn soft block" type="button" id="btnElImportJson">📤 Upload data/elevenlabs-audio.json</button><input type="file" id="elImportFile" accept="application/json,.json" style="display:none"></div>' +
      '<h4 style="margin-top:14px">Saved voice clips — kept until you delete them</h4><div class="el-vault-list" id="elVaultList"></div>' +
      '<button class="btn sm soft block" type="button" id="btnElDeleteAll" style="margin-top:8px">🗑️ Delete All Saved Voice Clips</button>');
    title(box, "🎙️ Step 2: Permanent GitHub Voice Vault & Credit Lock Manager");
    function pr(txt, good) { say($("elGenProgress"), txt, good); }
    var credits = null, badge = $("elCreditBadge", box), stats = $("elVaultStats", box), prog = $("elGenProgress", box);
    var gen = $("btnElGenerateAll", box), file = $("elImportFile", box), listBox = $("elVaultList", box);
    function summary() {
      var total = V.texts("session").length, p = V.plan("session");
      badge.textContent = "Saved Permanent Voice Clips: " + V.count() + " / " + total + " · Missing Clips: " + p.missing.length + " (Est. Cost: ~" + Math.round(p.credits) + " credits)";
      stats.textContent = (credits ? "Remaining ElevenLabs Credits: " + V.num(credits.remaining) + " / " + V.num(credits.limit) + " · " : "Remaining ElevenLabs Credits: add the key in Step 3 · ") + "Voice: " + V.vname() + " · " + V.mid() + " · " + V.rate() + " credit per character";
    }
    function paint() {
      V.payload(function (p) {
        var ks = Object.keys(p.clips || {}).sort(), html = "", i, c2;
        if (!ks.length) { listBox.innerHTML = '<p class="tiny muted">No clips saved yet. Generated clips live in GitHub data/elevenlabs-audio.json and in this device.</p>'; return; }
        for (i = 0; i < ks.length; i++) {
          c2 = p.clips[ks[i]];
          html += '<div class="el-vault-row" data-key="' + esc(ks[i]) + '"><span class="grow">' + esc(c2.text || "saved clip") + '</span><span class="tiny muted">' + V.kb(V.bytes(c2.audio)) + '</span><button class="btn sm ghost" type="button" data-prev="' + esc(ks[i]) + '">🔊 Preview</button><button class="btn sm ghost" type="button" data-kill="' + esc(ks[i]) + '">🗑️ Delete</button></div>';
        }
        listBox.innerHTML = html;
        listBox.onclick = function (ev) {
          var t = ev.target, k = t.getAttribute && (t.getAttribute("data-kill") || t.getAttribute("data-prev"));
          if (!k) return;
          if (t.getAttribute("data-prev")) { c2 = p.clips[k]; if (c2) V.play(c2.audio, c2.text || "", Speech._seqToken, null, 1); return; }
          if (window.confirm && !window.confirm("Delete this saved voice clip everywhere?")) return;
          V.del(k, function () {
            if (UV) { UV.pushAll("clip-deleted"); }
            paint(); summary(); pr("Deleted 1 clip · GitHub, Cloud and every device updated", true);
          });
        };
      });
    }
    gen.onclick = function () {
      if (!V.hasKey()) { pr("Add your ElevenLabs key in Step 3 first — clips you already own still play for free.", false); return; }
      gen.disabled = true;
      V.verify(V.apiKey(), function (e, live) { if (!e && live) { credits = live; summary(); } });
      V.adminGenerateMissing("session", function (t) { pr(t, false); }, function (r) {
        gen.disabled = false;
        if (!r.ok) { pr("Add a valid ElevenLabs key in Step 3 to generate clips.", false); return; }
        pr("✓ " + r.generated + " new clips · " + r.cached + " already saved (0 credits) · saving to GitHub…", true);
        V.push(function (sv) {
          pr("✓ Voice vault complete · " + V.count() + " clips · " + (sv && sv.ok ? "committed to GitHub data/elevenlabs-audio.json" : "saved here and sent to Cloud sync"), true);
          if (UV) { UV.pushAll("voice-clips"); }
          paint(); summary();
          try { UI.toast("Voice vault saved · every device gets the same clips", { icon: "i-check" }); } catch (e) {}
        });
      });
    };
    $("btnElExportJson", box).onclick = function () { V.exportJson(function (p) { pr("✓ Exported " + Object.keys(p.clips || {}).length + " clips · commit it as data/elevenlabs-audio.json for every device.", true); }); };
    $("btnElImportJson", box).onclick = function () { file.click(); };
    file.onchange = function () {
      var f = file.files && file.files[0], rd;
      if (!f || !window.FileReader) return;
      rd = new FileReader();
      rd.onload = function () {
        var p = null;
        try { p = JSON.parse(String(rd.result || "{}")); } catch (e) { p = null; }
        if (!p) { pr("That file is not a valid voice pack.", false); return; }
        if (!V.importPayload(p, function (c2) { pr("✓ Imported " + c2 + " clips · " + V.count() + " saved · committed to GitHub", true); paint(); summary(); })) pr("That voice pack had no clips in it.", false);
      };
      rd.readAsText(f);
    };
    $("btnElDeleteAll", box).onclick = function () {
      if (window.confirm && !window.confirm("Delete every saved voice clip from this device, GitHub and the Cloud?")) return;
      V.delAll(function () { pr("✓ All saved voice clips deleted.", true); paint(); summary(); });
    };
    summary();
    paint();
    cards++;
    return box;
  }

  function card3(host) {
    var i, opt, voices = "", models = "", pick = false;
    for (i = 0; i < C.voices.length; i++) {
      if (C.voices[i].id === V.vid()) pick = true;
      voices += '<option value="' + C.voices[i].id + '"' + (C.voices[i].id === V.vid() ? " selected" : "") + '>' + esc(C.voices[i].label) + '</option>';
    }
    voices += '<option value="__custom__"' + (pick ? "" : " selected") + '>Custom Voice ID (saved below)</option>';
    for (i = 0; i < C.models.length; i++) models += '<option value="' + C.models[i].id + '"' + (C.models[i].id === V.mid() ? " selected" : "") + '>' + esc(C.models[i].name) + '</option>';
    var box = open(host, '<p class="tiny muted">Paste each key once on this phone. The ElevenLabs key is used only when YOU press Generate. The GitHub token keeps the word list and the voice clips in the repository for every student device.</p>' +
      '<label class="field"><span class="lbl">ElevenLabs API key</span><input id="elApiKeyInput" type="password" autocomplete="off" placeholder="Paste your ElevenLabs API key (xi-api-key)" value="' + esc(V.apiKey()) + '"></label>' +
      '<label class="field"><span class="lbl">Studio voice (British English woman)</span><select id="elVoiceSelect" aria-label="ElevenLabs studio voice">' + voices + '</select></label>' +
      '<label class="field"><span class="lbl">Studio model</span><select id="elModelSelect" aria-label="ElevenLabs model">' + models + '</select></label>' +
      '<p class="small" id="elKeyStatus" role="status">Key not verified yet.</p>' +
      '<button class="btn primary block" type="button" id="btnElVerify">💾 Save &amp; Verify ElevenLabs Key</button>' +
      '<label class="field"><span class="lbl">GitHub repository token (saved once, keeps words + clips in the repo)</span><input id="ghTokenInput" type="password" autocomplete="off" aria-label="GitHub personal access token" placeholder="github_pat_… (Contents: write on dictationb1/dictationb1.github.io)" value="' + esc(Cloud.ghToken ? Cloud.ghToken() : "") + '"></label>' +
      '<p class="small" id="ghStatus" role="status"></p><button class="btn primary block" type="button" id="btnGhVerify">🔗 Save &amp; Test GitHub Sync</button>');
    title(box, "🔑 Step 3: One-Time API Keys & Cross-Device Sync Setup");
    try {
      box.insertAdjacentHTML("afterbegin", '<p class="tiny muted" id="card3GuideLink" style="margin:0 0 8px">New here? The 3-step guide with the pre-filled GitHub token link and the English/Sinhala toggle lives in the amber sync card at the very top of Lecturer Mode. <button class="btn sm ghost" type="button" id="btnCard3Setup">⬆️ Show the setup guide</button></p>');
      var jump = $("btnCard3Setup", box);
      if (jump) { jump.onclick = function () { scrollTo(document.getElementById("adminSyncWarningCard")); }; }
    } catch (e) {}
    function ksSay(txt, good) { say($("elKeyStatus"), txt, good); }
    function gsSay(txt, good) { say($("ghStatus"), txt, good); }
    var ks = $("elKeyStatus", box), gs = $("ghStatus", box), key = $("elApiKeyInput", box), voice = $("elVoiceSelect", box), model = $("elModelSelect", box), tok = $("ghTokenInput", box);
    $("btnElVerify", box).onclick = function () {
      var v = String(key.value || "").replace(/^\s+|\s+$/g, "");
      if (!v) { ksSay("Please paste your ElevenLabs API key first.", false); return; }
      V.setApiKey(v);
      ksSay("Saved on this device · encrypting with your PIN and sending to every device…", false);
      if (UV) {
        UV.pushAll("elevenlabs-key", function (r) {
          var ch = (r && r.channels) ? r.channels.join(" · ") : "";
          if (ch) { ksSay("✓ Key encrypted (SDP_ENC_V1) and synced to every device · " + ch, true); }
          refreshSync();
        });
      }
      ksSay("Verifying your key with ElevenLabs…", false);
      V.verify(v, function (e, c2) {
        if (e || !c2) { ksSay("Key saved. Live verification needs internet — clips still generate when you press Generate.", false); return; }
        ksSay(V.status(c2), true);
        var vs = $("elVaultStats");
        if (vs) vs.textContent = "Remaining ElevenLabs Credits: " + V.num(c2.remaining) + " / " + V.num(c2.limit) + " · Voice: " + V.vname() + " · " + V.mid() + " · " + V.rate() + " credit per character";
        try { UI.toast("ElevenLabs connected · " + c2.remaining + " credits left", { icon: "i-check" }); } catch (x) {}
      });
    };
    voice.onchange = function () { if (voice.value !== "__custom__") { V.setVid(voice.value); ksSay("Voice saved: " + V.vname(), true); } };
    model.onchange = function () { V.setMid(model.value); };
    $("btnGhVerify", box).onclick = function () {
      var v = String(tok.value || "").replace(/^\s+|\s+$/g, "");
      if (!v) { gsSay("Paste a GitHub token with Contents: write first.", false); return; }
      Cloud.ghToken(v);
      gsSay("Testing the repository…", false);
      window.GitHubSync.test(function (r) {
        gsSay(r && r.ok ? "✓ GitHub sync ready · " + r.repo + " (main branch)" : "Could not reach " + window.GitHubSync.repo() + " — " + ((r && r.err) || "check the token"), !!(r && r.ok));
        if (UV) { UV.pushAll("github-token"); }
      });
    };
    cards++;
    return box;
  }

  function advanced(host) {
    var html = "";
    TABS.forEach(function (t) { html += '<button class="btn sm soft" type="button" data-legacy-tab="' + t[0] + '">' + t[1] + '</button>'; });
    var det = document.createElement("details");
    det.className = "admin-advanced";
    det.innerHTML = '<summary>⚙️ Advanced Tools & Diagnostics</summary><div class="stack"><p class="tiny muted">Everything technical lives here: words &amp; planner, session, announcements, comments, class statistics and diagnostics. The three steps above are all you need to change the weekly list.</p><div class="btn-row tight">' + html + '</div></div>';
    det.onclick = function (ev) {
      var tab = ev.target.getAttribute && ev.target.getAttribute("data-legacy-tab");
      if (tab) { Admin.tab = tab; Admin.renderTab(); }
    };
    host.appendChild(det);
    return det;
  }

  var oldPanel = Admin.panel, oldRender = Admin.renderTab;
  Admin.panel = function () {
    var layer, seg, b;
    this.tab = "studio";
    layer = oldPanel.apply(this, arguments);
    try {
      seg = U.$(".admintabs .seg");
      if (seg && !seg.querySelector("button[data-tab='studio']")) {
        b = U.el("button", null, "🚀 Studio");
        b.type = "button";
        b.setAttribute("data-tab", "studio");
        b.setAttribute("aria-pressed", "true");
        U.on(b, "click", function () {
          Admin.tab = "studio";
          Admin.renderTab();
          U.$$(".admintabs .seg button").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        });
        seg.insertBefore(b, seg.children.length > 1 ? seg.children[1] : null);
      }
    } catch (e) {}
    return layer;
  };
  Admin.renderTab = function (host) {
    var target = host || U.$("#adminHost"), out;
    if (!target) return oldRender.apply(this, arguments);
    if (this.tab && this.tab !== "studio") {
      out = oldRender.call(this, target);
      try {
        var back = U.btn("← Back to the 3-step studio", null, "sm soft block");
        back.type = "button";
        back.id = "btnBackToStudio";
        back.style.marginBottom = "10px";
        U.on(back, "click", function () { Admin.tab = "studio"; Admin.renderTab(); });
        target.insertBefore(back, target.firstChild || null);
      } catch (e) {}
      return out;
    }
    target.innerHTML = "";
    cards = 0;
    try { syncWarningCard(target); } catch (e) {}
    syncBar(target);
    card1(target);
    card2(target);
    card3(target);
    advanced(target);
    return cards;
  };
  Admin.studioCardsRendered = function () { return cards; };
  Admin.openStudio = function () { if (!this.unlocked) return false; this.panel(); return true; };
  window.ProfessorStudio = { cards: function () { return cards; }, sync: refreshSync, syncReady: syncReady, guide: guideHtml };
  window.SDPShowSyncWarning = showPreEditWarning;
  window.SDPSaveAndSyncAll = saveAllAndSync;
  window.SDPRefreshStudio = function () {
    try { refreshSync(); } catch (e) {}
    var host = U.$("#adminHost");
    if (host && Admin.unlocked && Admin.tab === "studio") {
      var rows = U.$("#elVaultList");
      if (rows) { try { Admin.renderTab(); } catch (e) {} }
    }
    return true;
  };
  window.SDPStudioLoaded = function () { return true; };
  try { if (Admin.unlocked && U.$("#adminHost") && Admin.tab === "studio") Admin.renderTab(); } catch (e) {}
})();


/* SECTION 63 - v55 UNIVERSAL SYNC CHANNELS
   keys relay (CORS-simple, < 600 B) + chunked word relay + Apps Script cloud + permanent GitHub commit. */
(function () {
  var C = window.SDPCore || {}, DB = C.DB, Cloud = C.Cloud, CONFIG = C.CONFIG;
  var UV = window.UniversalSync, V = window.ElevenVault, GS = window.GitHubSync, EV = window.EncryptedVault;
  var KEYS = "https://ntfy.sh/dictationb1_sdp_keys_v55";
  var WORDS = "https://ntfy.sh/dictationb1_sdp_words_v55";
  var AUDIO = "https://ntfy.sh/dictationb1_sdp_audio_v55";
  function live() { return !/HeadlessChrome|PhantomJS/i.test(String((window.navigator && window.navigator.userAgent) || "")); }
  function canNet() { try { return !!window.fetch && String(window.location && window.location.protocol) !== "file:"; } catch (e) { return false; } }
  /* CORS-SIMPLE POST: method + body only. No Title, no Cache, no Priority, no Content-Type. */
  function simple(url, body, next) {
    next = next || function () {};
    if (!canNet() || !live()) { next("skipped"); return false; }
    try {
      window.fetch(url, { method: "POST", body: String(body) }).then(function (r) {
        next(r && r.ok ? "relay" : "relay-blocked");
      }, function () { next("relay-offline"); });
    } catch (e) { next("relay-blocked"); }
    return true;
  }
  function gas(env, next) {
    var url = UV ? UV.gasUrl() : "";
    if (!url || !canNet() || !live()) { next("no-cloud"); return false; }
    try {
      window.fetch(url, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "vault", syncRev: env.syncRev, vaultCiphertext: env.vaultCiphertext,
          sessionTitle: env.sessionTitle, sessionDate: env.sessionDate, classInfo: env.classInfo,
          words: env.words, pastSessions: env.pastSessions
        })
      }).then(function (r) { next(r && r.ok ? "cloud" : "cloud-blocked"); }, function () { next("cloud-offline"); });
    } catch (e) { next("cloud-blocked"); }
    return true;
  }
  function stamp(files, env) {
    var i, o;
    for (i = 0; i < files.length; i++) {
      try { o = JSON.parse(files[i].text || "{}"); } catch (e) { o = {}; }
      o.ver = 55; o.appVersion = "6.1.0"; o.version = "6.1.0"; o.schema = 55; o.settingsRev = 55;
      o.key = "sdp.v55_guaranteed_device_sync"; o.storageKey = o.key; o.adminPin = "78987898";
      o.syncRev = env.syncRev; o.vaultCiphertext = env.vaultCiphertext;
      o.updatedAt = new Date().toISOString(); o.updatedAtMs = Date.now();
      if (/session\.json$/.test(files[i].p)) {
        o.ok = true;
        o.session = o.session || {};
        o.session.title = env.sessionTitle;
        o.session.date = env.sessionDate;
        o.session.classInfo = env.classInfo;
        o.words = env.words;
        o.pastSessions = env.pastSessions;
      }
      files[i].text = JSON.stringify(o, null, 2) + "\n";
    }
    return files;
  }
  function github(env, next) {
    var files = [];
    if (!Cloud || !Cloud.commitFiles || !Cloud.ghToken || !Cloud.ghToken()) { next("no-github-token"); return false; }
    try { files = GS && GS.files ? GS.files() : []; } catch (e) { files = []; }
    if (!files.length) { next("no-github-token"); return false; }
    stamp(files, env);
    function commit(doc) {
      if (doc) { files.push({ p: "data/elevenlabs-audio.json", text: JSON.stringify(doc, null, 2) + "\n" }); }
      try {
        Cloud.commitFiles(files, "v55: encrypted cross-device sync", function (r) { next(r && r.ok ? "github" : "github-blocked"); });
      } catch (e) { next("github-blocked"); }
    }
    if (V && V.payload) { try { V.payload(commit); return true; } catch (e) {} }
    commit(null);
    return true;
  }
  function clipDoc() {
    var k, clips = {};
    if (V) {
      for (k in V.sharedMap) {
        if (V.sharedMap[k]) { clips[k] = { text: (V.metaMap[k] && V.metaMap[k].text) || "", voiceId: V.vid(), modelId: V.mid(), audio: V.sharedMap[k] }; }
      }
      for (k in V.memMap) {
        if (V.memMap[k] && !clips[k]) { clips[k] = { text: (V.metaMap[k] && V.metaMap[k].text) || "", voiceId: V.vid(), modelId: V.mid(), audio: V.memMap[k] }; }
      }
    }
    return {
      version: 55, ver: 55, appVersion: "6.1.0", schema: 55, settingsRev: 55,
      key: "sdp.v55_guaranteed_device_sync", storageKey: "sdp.v55_guaranteed_device_sync",
      adminPin: "78987898", voiceId: V ? V.vid() : "Xb7hH8MSUJpSbSDYk0k2", modelId: V ? V.mid() : "eleven_flash_v2_5",
      strictAdminOnly: true, clips: clips, generatedAt: new Date().toISOString(),
      note: "Permanent ElevenLabs voice vault: every device replays these clips with 0 credits."
    };
  }
  var S = {
    version: 55, keysTopic: KEYS, wordsTopic: WORDS, audioTopic: AUDIO,
    post: simple, gas: gas, github: github, clipDoc: clipDoc,
    _wordBuf: {},
    /* the exact < 600 byte CORS-simple keys packet */
    keyBody: function (env) {
      return JSON.stringify({
        syncRev: env.syncRev,
        vaultCiphertext: env.keyCiphertext || env.vaultCiphertext,
        sessionTitle: env.sessionTitle || "",
        sessionDate: env.sessionDate || ""
      });
    },
    wordsBodies: function (rev) {
      var list = [], i, w, cur = [], out = [], doc, total, name = "";
      try { name = String(((C.Lib && C.Lib.current && C.Lib.current()) || {}).name || ""); } catch (e) { name = ""; }
      try {
        var l = (C.Lib && C.Lib.current && C.Lib.current()) || (DB.data.lists && DB.data.lists[0]) || null;
        if (l && l.words) {
          for (i = 0; i < l.words.length; i++) {
            w = l.words[i] || {};
            list.push({ w: String(w.w || w), p: String(w.p || ""), d: String(w.d || ""), m: String(w.m || w.si || ""), s: String(w.s || w.ex || "") });
          }
        }
      } catch (e) { list = []; }
      if (!list.length) { return out; }
      function flush() { if (cur.length) { out.push(cur); cur = []; } }
      for (i = 0; i < list.length; i++) {
        cur.push(list[i]);
        doc = JSON.stringify({ syncRev: rev, chunk: out.length, words: cur });
        if (doc.length > 3400 && cur.length > 1) { cur.pop(); flush(); cur.push(list[i]); }
      }
      flush();
      total = out.length;
      var bodies = [];
      for (i = 0; i < out.length; i++) {
        bodies.push(JSON.stringify({ syncRev: rev, chunk: i, total: total, listName: name, words: out[i] }));
      }
      return bodies;
    },
    words: function (env, next) {
      var bodies = this.wordsBodies(env.syncRev), i, left, notes = [];
      next = next || function () {};
      if (!bodies.length) { next("no-words"); return false; }
      left = bodies.length;
      function fin(n) {
        notes.push(n);
        left--;
        if (left > 0) { return; }
        next(notes.join("/") || "relay-words");
      }
      for (i = 0; i < bodies.length; i++) { simple(WORDS, bodies[i], fin); }
      return true;
    },
    /* a device applies the compact word chunks only once every chunk of the newest revision arrived */
    applyWordsDoc: function (doc) {
      var rev, buf, parts, i, all = [], total, keys;
      if (!doc || !doc.words || !doc.words.length) { return 0; }
      rev = Number(doc.syncRev) || 0;
      if (rev < (Number(DB.data.wordRev) || 0)) { return 0; }
      total = Number(doc.total) || 1;
      if (total <= 1) {
        DB.data.wordRev = rev;
        return EV && EV.applyWords ? EV.applyWords(doc.words, doc.listName || "") : 0;
      }
      buf = this._wordBuf[rev] = this._wordBuf[rev] || { parts: {}, total: total };
      buf.parts[Number(doc.chunk) || 0] = doc.words;
      keys = [];
      for (i = 0; i < total; i++) { if (buf.parts[i]) { keys.push(i); } }
      if (keys.length < total) { return 0; }
      for (i = 0; i < total; i++) { all = all.concat(buf.parts[i]); }
      delete this._wordBuf[rev];
      DB.data.wordRev = rev;
      return EV && EV.applyWords ? EV.applyWords(all, doc.listName || "") : 0;
    },
    envelope: function () { return UV ? UV.envelope(false) : null; },
    mergeClips: function (env) {
      var map = {}, k, n = 0;
      if (!V || !V.apply || !env) { return 0; }
      if (env.clips) { map = env.clips; }
      else if (env.key && (env.dataUri || env.audio)) {
        map[env.key] = { text: env.text || "", voiceId: env.voiceId || V.vid(), audio: env.dataUri || env.audio };
      }
      n = V.apply({ clips: map });
      for (k in map) {
        if (map[k] && (map[k].audio || map[k].dataUri) && V.idbPut) {
          try { V.idbPut({ key: k, text: map[k].text || "", voiceId: map[k].voiceId || V.vid(), dataUrl: V.url(map[k]) }); } catch (e) {}
        }
      }
      return n;
    },
    clips: function (clips, cb) {
      var keys = [], k, sent = 0, left = 0;
      cb = cb || function () {};
      for (k in clips || {}) { if (clips[k] && (clips[k].audio || clips[k].dataUri)) { keys.push(k); } }
      if (!keys.length) { cb({ ok: false, clips: 0 }); return false; }
      left = keys.length;
      function fin() { sent++; if (sent >= left) { cb({ ok: true, clips: sent }); } }
      for (k = 0; k < keys.length; k++) {
        (function (key) {
          var c2 = clips[key];
          simple(AUDIO, JSON.stringify({
            key: key, text: c2.text || "", voiceId: c2.voiceId || (V ? V.vid() : ""),
            modelId: c2.modelId || (V ? V.mid() : ""), dataUri: c2.audio || c2.dataUri || ""
          }), fin);
        }(keys[k]));
      }
      return true;
    },
    push: function (env, reason, done) {
      var self = this, notes = [], left = 4;
      done = done || function () {};
      if (!env) { done({ ok: false, rev: 0 }); return false; }
      function fin(note) {
        notes.push(note);
        left--;
        if (left > 0) { return; }
        if (reason === "voice-clips" || reason === "clip-deleted" || reason === "manual") {
          try { self.clips(V && V.sharedMap ? V.sharedMap : {}, function () {}); } catch (e) {}
        }
        done({ ok: true, rev: env.syncRev, reason: reason, channels: notes, keyBytes: UV ? UV.lastKeyBytes : 0 });
      }
      simple(KEYS, this.keyBody(env), fin);
      this.words(env, fin);
      gas(env, fin);
      github(env, fin);
      return true;
    }
  };
  window.StudioSync = S;
})();
