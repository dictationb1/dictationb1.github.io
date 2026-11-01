var SDPC = window.SDPCore || {};

var DB = SDPC.DB, Speech = SDPC.Speech, UI = SDPC.UI, U = SDPC.U, Lib = SDPC.Lib, Admin = SDPC.Admin, Cloud = SDPC.Cloud, CONFIG = SDPC.CONFIG, GUIDE = SDPC.GUIDE || [], Store = SDPC.Store, Screens = SDPC.Screens, DEFAULT_WALLPAPER_SRC = SDPC.DEFAULT_WALLPAPER_SRC, BUILD_DATE = SDPC.BUILD_DATE, wordRow = SDPC.wordRow, SAMPLE_WORDS = SDPC.SAMPLE_WORDS || [], WORD_BANK = SDPC.WORD_BANK || {}, Dict = SDPC.Dict, APP_VERSION = SDPC.APP_VERSION;

window.SDPCoreV53 = SDPC;

window.SDPCoreV55 = SDPC;

window.SDPCoreV54 = SDPC;

(function () {
  'use strict';
  var C = window.SDPCore || {}, DB = C.DB, Cloud = C.Cloud, CONFIG = C.CONFIG;
  function admin() { return !!(C.Admin && C.Admin.isUnlockedOnThisDevice && C.Admin.isUnlockedOnThisDevice()); }
  function canNet() { try { return !!window.fetch && location.protocol !== 'file:' && !/HeadlessChrome|jsdom/i.test(navigator.userAgent || ''); } catch (e) { return false; } }
  function token() { return admin() && Cloud.ghToken ? Cloud.ghToken() : ''; }
  var SYNC = {
    version: 59, appVersion: '8.0.0', staticFiles: ['./data/config.json', './data/session.json', './data/elevenlabs-audio.json'],
    repoApi: 'https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/',
    keysTopic: '', wordsTopic: '', audioTopic: '', vaultTopic: '', rev: 0, lastSaved: 0, lastPull: 0,
    lastChannels: [], notes: [], busy: false, pushing: false, timer: null, audioTimer: null,
    live: function () { return !/HeadlessChrome|jsdom/i.test(navigator.userAgent || ''); }, canNet: canNet,
    gasUrl: function () { return String(CONFIG.gasUrl || ''); },
    keyBody: function () { return JSON.stringify({ ver: 59, appVersion: '8.0.0', syncRev: Number(DB.data.syncRev) || 0 }); },
    envelope: function () { return { ver: 59, appVersion: '8.0.0', syncRev: Number(DB.data.syncRev) || 0 }; },
    wordBodies: function () { return []; },
    applyEnvelope: function () { return null; },
    status: function () {
      var key = !!(window.SDPSessionSecrets && admin() && window.SDPSessionSecrets.get('elKey')), gh = !!token();
      return { key: key, token: gh, verified: key && gh, rev: Number(DB.data.syncRev) || 0, keyBytes: 0,
        clips: window.ElevenVault ? window.ElevenVault.count() : 0 };
    },
    banner: function () {
      var st = this.status(), el = document.getElementById('syncBanner');
      var text = 'v59 · Keys stay in this unlocked tab only · GitHub: ' + (st.token ? 'connected' : 'not connected') + ' · Saved clips: ' + st.clips;
      if (el) { el.textContent = text; el.className = 'small ' + (st.verified ? 'good' : ''); }
      return text;
    },
    setNote: function (s) { this.notes.unshift(String(s || '')); this.notes.length = Math.min(this.notes.length, 6); return s; },
    githubRead: function (path, cb) {
      cb = cb || function () {};
      if (!canNet()) { cb(''); return false; }
      window.fetch(this.repoApi + path + '?ref=main', { cache: 'no-store', headers: token() ? { Authorization: 'token ' + token() } : {} })
        .then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
          var text = '';
          try { if (d && d.content) text = decodeURIComponent(escape(atob(String(d.content).replace(/\s/g, '')))); } catch (e) {}
          cb(text);
        })['catch'](function () { cb(''); });
      return true;
    },
    pushAll: function (reason, cb) {
      cb = cb || function () {};
      if (!admin()) { cb({ ok: false, err: 'locked', channels: [] }); return false; }
      if (/clip|voice|audio/i.test(String(reason || '')) && window.ElevenVault) {
        window.ElevenVault.push(cb); return true;
      }
      this.lastSaved = Date.now(); this.lastChannels = ['local-session']; this.banner();
      cb({ ok: true, rev: Number(DB.data.syncRev) || 0, channels: this.lastChannels }); return true;
    },
    pullAll: function (cb) {
      cb = cb || function () {};
      if (!canNet()) { cb({ ok: false, reason: 'local-only' }); return false; }
      var self = this;
      if (window.ElevenVault) window.ElevenVault.loadShared(function (n) { self.lastPull = Date.now(); self.banner(); cb({ ok: true, clips: n, key: false }); });
      else cb({ ok: false });
      return true;
    },
    scheduleAudioRepoCommit: function (delay) {
      var self = this;
      if (!token() || !window.ElevenVault) return false;
      if (this.audioTimer) clearTimeout(this.audioTimer);
      this.audioTimer = setTimeout(function () { self.audioTimer = null; window.ElevenVault.push(function () {}); }, Number(delay) || 1500);
      return true;
    },
    boot: function () { this.banner(); this.pullAll(function () {}); return this; },
    touch: function () { return false; },
    time: function (rev) { try { return new Date(Number(rev) || Date.now()).toLocaleString(); } catch (e) { return String(Date.now()); } },
    sync: function () { this.pullAll(function () {}); }
  };
  window.UniversalSync = SYNC;
  CONFIG.keysTopic = CONFIG.wordsTopic = CONFIG.audioTopic = CONFIG.vaultTopic = '';
})();

(function() {
    var C = {
        v: 60,
        voiceId: "Xb7hH8MSUJpSbSDYk0k2",
        modelId: "eleven_flash_v2_5",
        tts: "https://api.elevenlabs.io/v1/text-to-speech/",
        q: "?output_format=mp3_44100_128",
        sub: "https://api.elevenlabs.io/v1/user/subscription",
        file: "./data/elevenlabs-audio.json",
        db: "sdp_elevenlabs_vault_v1",
        store: "clips",
        cost: {
            eleven_flash_v2_5: .5,
            eleven_multilingual_v2: 1
        },
        set: {
            stability: .45,
            similarity_boost: .85,
            style: .5,
            use_speaker_boost: true
        },
        voices: [ {
            id: "Xb7hH8MSUJpSbSDYk0k2",
            name: "Alice",
            label: "Alice · British RP Professional Educator Woman (default)"
        }, {
            id: "XB0fDUnXU5powFXDhCwa",
            name: "Charlotte",
            label: "Charlotte · British Expressive Studio Woman"
        }, {
            id: "pFZP5JQG7iQjIQuC4Bku",
            name: "Lily",
            label: "Lily · British RP Warm Narrator Woman"
        }, {
            id: "EXAVITQu4vr4xnSDxMaL",
            name: "Daniel",
            label: "Daniel · British RP Male Educator"
        }, {
            id: "bIHbvDHMWzoRXdEyNcxw",
            name: "George",
            label: "George · British Male Narrator"
        }, {
            id: "ThT5KcBeYPX3keUQqHPh",
            name: "Dorothy",
            label: "Dorothy · British Pleasant Studio Woman"
        } ],
        models: [ {
            id: "eleven_flash_v2_5",
            name: "eleven_flash_v2_5 (0.5x Credit Saver · default)"
        }, {
            id: "eleven_multilingual_v2",
            name: "eleven_multilingual_v2 (1x HD Studio)"
        } ],
        formats: [ {
            id: "mp3_44100_128",
            name: "128 kbps Studio"
        }, {
            id: "mp3_44100_192",
            name: "192 kbps HD"
        }, {
            id: "mp3_44100_64",
            name: "64 kbps Saver"
        } ]
    };
    function cl(s) {
        return String(s == null ? "" : s).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    }
    function hs(s) {
        var i, d, a = 2166136261, b = 5381, t = String(s == null ? "" : s);
        for (i = 0; i < t.length; i++) {
            d = t.charCodeAt(i);
            a = 16777619 * (a ^ d) >>> 0;
            b = (33 * b ^ d) >>> 0;
        }
        return a.toString(36) + b.toString(36);
    }
    function num(n) {
        return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    function durl(u8) {
        var s = "", i;
        for (i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + 8192, u8.length)));
        try {
            s = window.btoa(s);
        } catch (e) {
            return "";
        }
        return s ? "data:audio/mpeg;base64," + s : "";
    }
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
        version: 58,
        strictAdminOnly: true,
        adminBusy: false,
        sharedMap: {},
        memMap: {},
        metaMap: {},
        flight: {},
        _inflight: {},
        playOnce: 0,
        generated: 0,
        hits: 0,
        blocked: 0,
        made: 0,
        _db: null,
        _open: 0,
        _wait: [],
        stats: {
            generatedCount: 0,
            sharedHits: 0,
            localHits: 0,
            creditsSaved: 0,
            characters: 0,
            failures: 0,
            blocked: 0
        },
        norm: cl,
        hash: hs,
        num: num,
        cfg: function() {
            try {
                DB.data.settings = DB.data.settings || {};
                return DB.data.settings;
            } catch (e) {
                return {};
            }
        },
        apiKey: function() {
            return window.Admin && window.Admin.isUnlockedOnThisDevice && window.Admin.isUnlockedOnThisDevice() && window.SDPSessionSecrets ? window.SDPSessionSecrets.get('elKey') : '';
        },
        hasKey: function() { return !!this.apiKey(); },
        setApiKey: function(k) {
            if (!window.Admin || !window.Admin.isUnlockedOnThisDevice || !window.Admin.isUnlockedOnThisDevice()) return '';
            window.SDPSessionSecrets.set('elKey', cl(k)); return this.apiKey();
        },
        vid: function() {
            return String(this.cfg().elevenLabsVoiceId || C.voiceId);
        },
        setVid: function(v) {
            this.cfg().elevenLabsVoiceId = cl(v) || C.voiceId;
            DB.saveNow();
            return this.vid();
        },
        mid: function() {
            return String(this.cfg().elevenLabsModelId || C.modelId);
        },
        setMid: function(v) {
            this.cfg().elevenLabsModelId = cl(v) || C.modelId;
            DB.saveNow();
            return this.mid();
        },
        fmt: function() {
            return String(this.cfg().elevenLabsFormat || C.formats[0].id);
        },
        setFmt: function(v) {
            this.cfg().elevenLabsFormat = cl(v) || C.formats[0].id;
            DB.saveNow();
            return this.fmt();
        },
        rate: function() {
            return C.cost[this.mid()] || 1;
        },
        vname: function() {
            var i, id = this.vid();
            for (i = 0; i < C.voices.length; i++) if (C.voices[i].id === id) return C.voices[i].name;
            return "Custom";
        },
        keyFor: function(t) {
            return "el_" + this.vid() + "_" + hs(cl(t));
        },
        url: function(x) {
            return x ? typeof x === "string" ? x : String(x.audio || x.dataUrl || x.url || "") : "";
        },
        find: function(t) {
            var k = this.keyFor(t);
            return this.url(this.memMap[k]) || this.url(this.sharedMap[k]) || "";
        },
        count: function() {
            var k, seen = {}, n = 0, own = Object.prototype.hasOwnProperty;
            for (k in this.sharedMap) {
                if (this.sharedMap[k] && !own.call(seen, k)) {
                    seen[k] = 1;
                    n++;
                }
            }
            for (k in this.memMap) {
                if (this.memMap[k] && !own.call(seen, k)) {
                    seen[k] = 1;
                    n++;
                }
            }
            return n;
        },
        bytes: function(u) {
            return u ? Math.round(String(u).length * .75) : 0;
        },
        kb: function(n) {
            return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
        },
        apply: function(p) {
            var k, c2, u, n = 0, clips = p && (p.clips || p);
            if (!clips || typeof clips !== "object") return 0;
            for (k in clips) {
                if (!Object.prototype.hasOwnProperty.call(clips, k)) continue;
                c2 = clips[k];
                u = this.url(c2);
                if (!u) continue;
                this.sharedMap[k] = u;
                this.metaMap[k] = {
                    text: c2 && c2.text || this.metaMap[k] && this.metaMap[k].text || "",
                    voiceId: c2 && c2.voiceId || this.vid()
                };
                n++;
            }
            return n;
        },
        loadShared: function(cb) {
            var self = this;
            cb = cb || function() {};
            if (!window.fetch || String(window.location && window.location.protocol) === "file:") {
                cb(0);
                return;
            }
            try {
                window.fetch(C.file + "?v=58", {
                    cache: "no-cache"
                }).then(function(r) {
                    return r && r.ok ? r.json() : null;
                }).then(function(d) {
                    cb(self.apply(d));
                }, function() {
                    cb(0);
                });
            } catch (e) {
                cb(0);
            }
        },
        open: function(cb) {
            var self = this, req;
            if (this._open === 2) {
                cb(this._db);
                return;
            }
            this._wait.push(cb);
            if (this._open === 1) return;
            this._open = 1;
            function fin(db) {
                var w = self._wait, i;
                self._wait = [];
                self._db = db;
                self._open = 2;
                for (i = 0; i < w.length; i++) {
                    try {
                        w[i](db);
                    } catch (e) {}
                }
            }
            try {
                if (!window.indexedDB) {
                    fin(null);
                    return;
                }
                req = window.indexedDB.open(C.db, 1);
                req.onupgradeneeded = function(e) {
                    try {
                        var db = e.target.result;
                        if (!db.objectStoreNames.contains(C.store)) db.createObjectStore(C.store, {
                            keyPath: "key"
                        });
                    } catch (x) {}
                };
                req.onsuccess = function(e) {
                    fin(e.target.result);
                };
                req.onerror = function() {
                    fin(null);
                };
            } catch (e) {
                fin(null);
            }
        },
        idb: function(mode, key, rec, cb) {
            var self = this;
            this.open(function(db) {
                if (!db) {
                    cb(null);
                    return;
                }
                try {
                    var st = db.transaction(C.store, mode === "put" ? "readwrite" : mode === "get" ? "readonly" : "readwrite").objectStore(C.store);
                    var rq = mode === "get" ? st.get(key) : mode === "put" ? st.put(rec) : st.delete(key);
                    rq.onsuccess = function(e) {
                        cb(mode === "get" ? e.target.result && String(e.target.result.dataUrl) || "" : true);
                    };
                    rq.onerror = function() {
                        cb(null);
                    };
                } catch (e) {
                    cb(null);
                }
            });
        },
        idbGet: function(k, cb) {
            this.idb("get", k, null, cb);
        },
        idbPut: function(r, cb) {
            this.idb("put", r.key, r, cb || function() {});
        },
        idbDel: function(k, cb) {
            this.idb("del", k, null, cb || function() {});
        },
        idbAll: function(cb) {
            var out = [];
            this.open(function(db) {
                if (!db) {
                    cb(out);
                    return;
                }
                try {
                    var cur = db.transaction(C.store, "readonly").objectStore(C.store).openCursor();
                    cur.onsuccess = function(e) {
                        var r = e.target.result;
                        if (!r) {
                            cb(out);
                            return;
                        }
                        out.push(r.value);
                        r.continue();
                    };
                    cur.onerror = function() {
                        cb(out);
                    };
                } catch (e) {
                    cb(out);
                }
            });
        },
        local: function(k, cb) {
            var self = this;
            if (this.memMap[k]) {
                cb(this.memMap[k]);
                return;
            }
            this.idbGet(k, function(u) {
                if (u) self.memMap[k] = u;
                cb(u || "");
            });
        },
        save: function(k, text, u) {
            var rec = {
                key: k,
                text: String(text || ""),
                voiceId: this.vid(),
                modelId: this.mid(),
                dataUrl: u,
                ts: Date.now()
            };
            this.memMap[k] = u;
            this.metaMap[k] = rec;
            this.idbPut(rec);
            return rec;
        },
        automated: function() {
            try {
                return /HeadlessChrome|PhantomJS/i.test(String(window.navigator && window.navigator.userAgent || ""));
            } catch (e) {
                return false;
            }
        },
        gestureOn: function() {
            return gestureSeen;
        },
        allowFetchNow: function() {
            gestureSeen = true;
            return true;
        },
        playOrFetchOnce: function(t, lang, tok, cb, rate) {
            // Playback is cache-only for everyone. Paid generation is a separate,
            // explicitly authenticated lecturer action, never a playback miss path.
            return this.speak(t, lang, tok, cb, rate);
        },
        fetchOnce: function(text, cb) {
            if (!this.strictAdminOnly) return null;
            if (!window.Admin || typeof window.Admin.isUnlockedOnThisDevice !== "function" || !window.Admin.isUnlockedOnThisDevice()) return null;
            return this.gen(text, typeof cb === "function" ? cb : function () {});
        },
        resolve: function(t, cb) {
            var self = this, k = this.keyFor(t), u;
            if (!cl(t)) {
                cb("empty", "");
                return;
            }
            u = this.url(this.sharedMap[k]) || this.url(this.memMap[k]);
            if (u) {
                this.hits++;
                this.stats.sharedHits++;
                cb(null, u);
                return;
            }
            this.local(k, function(f) {
                if (f) {
                    self.stats.localHits++;
                    cb(null, f);
                    return;
                }
                self.blocked++;
                self.stats.blocked++;
                cb("missing", "");
            });
        },
        play: function(u, t, tok, cb, rate) {
            if (typeof Speech._playUrl !== "function") {
                if (cb) cb(false);
                return false;
            }
            Speech._playUrl(u, t, "en", tok, cb, rate || Speech.desiredRate || 1);
            return true;
        },
        speak: function(t, lang, tok, cb, rate, fb) {
            var p = cl(t), u;
            if (!p || lang === "si") return false;
            u = this.find(p);
            if (u) {
                this.hits++;
                this.stats.sharedHits++;
                this.play(u, p, tok, cb, rate);
                return true;
            }
            if (typeof fb === "function") {
                fb();
                return true;
            }
            if (cb) cb(false);
            return false;
        },
        spell: function(w) {
            var i, s = String(w || "").toLowerCase().replace(/[^a-z]/g, ""), n = Speech.letterNames || {}, o = [];
            if (!s) return "";
            for (i = 0; i < s.length; i++) o.push(n[s.charAt(i)] || s.charAt(i));
            return o.join(", ") + ". " + s;
        },
        texts: function(scope) {
            var self = this, out = [], w = [], i, g;
            function add(t) {
                var x = cl(t);
                if (x && out.indexOf(x) < 0) out.push(x);
            }
            try {
                w = (Lib.current() || {}).words || [];
            } catch (e) {
                w = [];
            }
            if (!w.length) {
                try {
                    w = DB.data.lists[0].words || [];
                } catch (e) {
                    w = [];
                }
            }
            add("Three.");
            add("Two.");
            add("One.");
            add(Speech.instructionPhrase("paper"));
            add(Speech.instructionPhrase("type"));
            add("Sound check. Number 1.");
            add("Session paused.");
            add("Welcome back. Continuing dictation number 1.");
            add("Dictation complete. Well done. Review all thirty words below");
            for (i = 1; i <= Math.max(31, w.length); i++) add("Number " + i);
            for (i = 0; i < w.length; i++) {
                add(w[i] && (w[i].w || w[i]));
                if (scope === "full") {
                    add(w[i] && (w[i].s || w[i].ex));
                    add(this.spell(w[i] && w[i].w));
                }
            }
            if (scope === "full") {
                try {
                    g = typeof GUIDE !== "undefined" && GUIDE && GUIDE.en || [];
                } catch (e) {
                    g = [];
                }
                for (i = 0; i < g.length; i++) add(typeof g[i] === "string" ? g[i] : g[i] && (g[i].text || g[i].t));
            }
            return out;
        },
        plan: function(scope) {
            var t = this.texts(scope), miss = [], ch = 0, hit = 0, i;
            for (i = 0; i < t.length; i++) {
                if (this.find(t[i])) hit++; else {
                    miss.push(t[i]);
                    ch += t[i].length;
                }
            }
            return {
                total: t.length,
                cached: hit,
                missing: miss,
                characters: ch,
                credits: ch * this.rate()
            };
        },
        gen: function(t, cb) {
            var self = this, p = cl(t), k = this.keyFor(p), tok = this.apiKey();
            cb = cb || function() {};
            if (!p) {
                cb("empty", "");
                return false;
            }
            if (!this.strictAdminOnly || !window.Admin || typeof window.Admin.isUnlockedOnThisDevice !== "function" || !window.Admin.isUnlockedOnThisDevice()) {
                this.blocked++;
                this.stats.blocked++;
                cb("locked", "");
                return false;
            }
            if (!tok) {
                cb("nokey", "");
                return false;
            }
            if (this.flight[k]) {
                this.flight[k].push(cb);
                return true;
            }
            function fin(e, u) {
                var w = self.flight[k] || [], i;
                delete self.flight[k];
                for (i = 0; i < w.length; i++) {
                    try {
                        w[i](e, u);
                    } catch (x) {}
                }
            }
            this.flight[k] = [ cb ];
            if (!window.fetch) {
                fin("nofetch", "");
                return false;
            }
            try {
                window.fetch(C.tts + this.vid() + "?output_format=" + this.fmt(), {
                    method: "POST",
                    headers: {
                        "xi-api-key": tok,
                        "Content-Type": "application/json",
                        Accept: "audio/mpeg"
                    },
                    body: JSON.stringify({
                        text: p,
                        model_id: this.mid(),
                        voice_settings: C.set
                    })
                }).then(function(r) {
                    if (!r || !r.ok) throw Error("elevenlabs " + (r ? r.status : "offline"));
                    return r.arrayBuffer();
                }).then(function(b) {
                    var u = durl(new Uint8Array(b));
                    if (!u) throw Error("empty clip");
                    self.save(k, p, u);
                    self.made++;
                    self.stats.generatedCount++;
                    self.stats.characters += p.length;
                    self.stats.creditsSaved += p.length * self.rate();
                    fin(null, u);
                }).then(null, function() {
                    self.stats.failures++;
                    fin("error", "");
                });
            } catch (e) {
                fin("error", "");
            }
            return true;
        },
        generate: function(t, cb) {
            return this.gen(t, cb);
        },
        adminGenerateMissing: function(scope, prog, done) {
            var self = this, p, i = 0, made = 0, bad = 0;
            if (scope && typeof scope === "object" && typeof scope.length === "number") {
                var miss = [], cached = 0, ch = 0, j, t2;
                for (j = 0; j < scope.length; j++) {
                    t2 = cl(scope[j]);
                    if (!t2) continue;
                    if (this.find(t2)) {
                        cached++;
                        continue;
                    }
                    if (miss.indexOf(t2) > -1) continue;
                    miss.push(t2);
                    ch += t2.length;
                }
                p = {
                    total: scope.length,
                    cached: cached,
                    missing: miss,
                    characters: ch,
                    credits: ch * this.rate()
                };
            } else p = this.plan(scope || "session");
            prog = prog || function() {};
            done = done || function() {};
            function next() {
                if (i >= p.missing.length) {
                    self.adminBusy = false;
                    prog("Vault complete · " + made + " new clips · " + p.cached + " already saved (0 credits)");
                    done({
                        ok: true,
                        generated: made,
                        failed: bad,
                        cached: p.cached,
                        characters: p.characters,
                        missing: p.missing.length
                    });
                    return;
                }
                var t = p.missing[i++];
                prog("Generating " + i + "/" + p.missing.length + " · " + t);
                self.gen(t, function(e) {
                    if (e) bad++; else made++;
                    next();
                });
            }
            if (!window.Admin || !window.Admin.isUnlockedOnThisDevice || !window.Admin.isUnlockedOnThisDevice() || !this.hasKey()) {
                done({
                    ok: false,
                    err: "locked-or-nokey",
                    generated: 0,
                    cached: p.cached,
                    missing: p.missing.length
                });
                return false;
            }
            this.adminBusy = true;
            prog("Checking the vault · " + p.cached + " saved clips are replayed for 0 credits");
            next();
            return true;
        },
        generateBatch: function(t, prog, done) {
            return this.adminGenerateMissing(t, prog, done);
        },
        clips: function(cb) {
            var self = this, out = {}, k;
            function pull(m) {
                for (k in m) if (m[k]) {
                    var u = self.url(m[k]);
                    if (u) out[k] = u;
                }
            }
            pull(this.sharedMap);
            pull(this.memMap);
            this.idbAll(function(rows) {
                var i;
                for (i = 0; i < rows.length; i++) if (rows[i] && rows[i].key && rows[i].dataUrl && !out[rows[i].key]) out[rows[i].key] = rows[i].dataUrl;
                cb(out);
            });
        },
        payload: function(cb) {
            var self = this;
            this.clips(function(c2) {
                var k, p = {
                    version: 59, ver: 59, appVersion: "8.0.0", schema: 59, settingsRev: 59,
                    strictAdminOnly: true, voiceId: self.vid(), modelId: self.mid(),
                    generatedAt: new Date().toISOString(), clips: {}
                };
                for (k in c2) if (c2[k]) p.clips[k] = {
                    text: self.metaMap[k] && self.metaMap[k].text || "",
                    voiceId: self.vid(),
                    modelId: self.mid(),
                    audio: c2[k]
                };
                cb(p);
            });
        },
        exportJson: function(done) {
            this.payload(function(p) {
                var u, a;
                if (done) done(p);
                try {
                    u = URL.createObjectURL(new Blob([ JSON.stringify(p, null, 2) ], {
                        type: "application/json"
                    }));
                    a = document.createElement("a");
                    a.href = u;
                    a.download = "elevenlabs-audio.json";
                    a.style.display = "none";
                    (document.body || document.documentElement).appendChild(a);
                    a.click();
                    setTimeout(function() {
                        try {
                            URL.revokeObjectURL(u);
                            if (a.parentNode) a.parentNode.removeChild(a);
                        } catch (e) {}
                    }, 1500);
                } catch (e) {}
            });
        },
        importPayload: function(p, cb) {
            var n = this.apply(p);
            cb = cb || function() {};
            if (!n) {
                cb(0);
                return 0;
            }
            this.push(function() {
                cb(n);
            });
            return n;
        },
        del: function(k, cb) {
            var self = this;
            delete this.sharedMap[k];
            delete this.memMap[k];
            delete this.metaMap[k];
            this.idbDel(k, function() {
                self.push(function() {
                    if (cb) cb(true);
                });
            });
        },
        delAll: function(cb) {
            var self = this;
            cb = cb || function() {};
            this.sharedMap = {};
            this.memMap = {};
            this.metaMap = {};
            this.idbAll(function(rows) {
                var left = rows.length, i;
                if (!left) {
                    self.push(cb);
                    return;
                }
                for (i = 0; i < rows.length; i++) self.idbDel(rows[i].key, function() {
                    if (--left <= 0) self.push(cb);
                });
            });
        },
        push: function(cb) {
            cb = cb || function () {};
            if (!window.Admin || !window.Admin.isUnlockedOnThisDevice || !window.Admin.isUnlockedOnThisDevice()) { cb({ ok:false, err:"locked" }); return false; }
            this.payload(function(p) {
                if (!Cloud.ghToken || !Cloud.ghToken()) { cb({ ok:false, err:"Connect a fine-grained GitHub Contents token first." }); return; }
                Cloud.commitFiles([{ p:"data/elevenlabs-audio.json", text:JSON.stringify(p,null,2)+"\n" }], "v59: permanent studio voice clips", cb);
            });
            return true;
        },
        saveToGitHub: function(cb) {
            return this.push(cb);
        },
        verify: function(k, cb) {
            if (!window.Admin || !window.Admin.isUnlockedOnThisDevice || !window.Admin.isUnlockedOnThisDevice()) { if (cb) cb("locked", null); return false; }
            var tok = String(k || this.apiKey() || "");
            cb = cb || function() {};
            if (!tok) {
                cb("nokey", null);
                return false;
            }
            if (!window.fetch) {
                cb("nofetch", null);
                return false;
            }
            try {
                window.fetch(C.sub, {
                    headers: {
                        "xi-api-key": tok
                    }
                }).then(function(r) {
                    return r && r.ok ? r.json() : null;
                }).then(function(d) {
                    if (!d) {
                        cb("error", null);
                        return;
                    }
                    var lim = Number(d.character_limit) || 1e4, use = Number(d.character_count) || 0;
                    cb(null, {
                        tier: String(d.tier || "free"),
                        used: use,
                        limit: lim,
                        remaining: Math.max(0, lim - use)
                    });
                }, function() {
                    cb("error", null);
                });
            } catch (e) {
                cb("error", null);
            }
            return true;
        },
        verifyKey: function(k, cb) {
            return this.verify(k, cb);
        },
        status: function(c2) {
            var tier = c2 && c2.tier || "free", lim = c2 && c2.limit || 1e4;
            var left = c2 && c2.remaining !== undefined ? c2.remaining : Math.max(0, lim - (c2 && c2.used || 0));
            return "✓ Connected · Tier: " + tier.charAt(0).toUpperCase() + tier.slice(1) + " · Remaining ElevenLabs Credits: " + num(left) + " / " + num(lim) + " · Saved Permanent Voice Clips: " + this.count();
        },
        statusText: function(c2) {
            return this.status(c2);
        },
        warm: function() {
            var self = this;
            this.idbAll(function(rows) {
                var i;
                for (i = 0; i < rows.length; i++) if (rows[i] && rows[i].key && rows[i].dataUrl && !self.memMap[rows[i].key]) self.memMap[rows[i].key] = rows[i].dataUrl;
            });
        },
        boot: function() {
            var s = this.cfg();
            this.warm();
            s.elevenLabsKey = s.elevenLabsKey || "";
            s.elevenLabsVoiceId = s.elevenLabsVoiceId || C.voiceId;
            s.elevenLabsModelId = s.elevenLabsModelId || C.modelId;
            this.loadShared(function() {});
            return this;
        }
    };
    V.voiceId = V.vid;
    V.setVoiceId = V.setVid;
    V.modelId = V.mid;
    V.setModelId = V.setMid;
    V.creditRate = V.rate;
    V.voiceName = V.vname;
    V.speakText = V.speak;
    V.spellText = V.spell;
    V.clipCount = V.count;
    V.deleteClip = V.del;
    V.deleteAll = V.delAll;
    V.syncClip = V.find;
    V.loadSharedVault = V.loadShared;
    V.setKey = V.setApiKey;
    V.applyShared = V.apply;
    V.exportPayload = V.payload;
    V.planTexts = V.texts;
    V.saveToGitHub = V.push;
    V.importVault = V.importPayload;
    V.hasKey = V.hasKey;
    V.voiceId = V.vid;
    V.setVoiceId = V.setVid;
    V.modelId = V.mid;
    V.setModelId = V.setMid;
    V.creditRate = V.rate;
    V.voiceName = V.vname;
    V.speakText = V.speak;
    V.spellText = V.spell;
    V.clipCount = V.count;
    V.syncClip = V.find;
    V.deleteClip = V.del;
    V.deleteAll = V.delAll;
    V.applyShared = V.apply;
    V.exportPayload = V.payload;
    V.planTexts = V.texts;
    V.saveToGitHub = V.push;
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
    Speech._playText = function(t, lang, tok, cb, r) {
        var self = this, ok = false, l = lang === "si" ? "si" : "en";
        function legacy() {
            oldText.call(self, t, lang, tok, cb, r);
        }
        try {
            if (V.hasKey() && l === "en") {
                ok = V.playOrFetchOnce(t, l, tok, cb, r);
            } else {
                ok = V.speak(t, l, tok, cb, r, legacy);
            }
        } catch (e) {
            ok = false;
        }
        if (!ok) {
            legacy();
        }
    };
    Speech.playWord = function(w, r, cb) {
        var self = this, x = this.cleanWordOnly(w), tok = this._seqToken, ok = false;
        if (!x) {
            if (cb) cb(false);
            return tok;
        }
        try {
            if (V.hasKey()) {
                ok = V.playOrFetchOnce(x, "en", tok, cb, r);
            } else {
                ok = V.speak(x, "en", tok, cb, r, function() {
                    oldWord.call(self, x, r, cb);
                });
            }
        } catch (e) {
            ok = false;
        }
        return ok ? tok : oldWord.call(this, x, r, cb);
    };
})();

(function() {
    var V = window.ElevenVault, KEY = "sdp.v55_guaranteed_device_sync", UV = window.UniversalSync, EV = window.EncryptedVault;
    function vaultBits() {
        var o = {};
        try {
            o.syncRev = Number(DB.data.syncRev) || 0;
            o.vaultCiphertext = String(DB.data.vaultCiphertext || "");
        } catch (e) {
            o.syncRev = 0;
            o.vaultCiphertext = "";
        }
        return o;
    }
    function versionDoc() {
        return {
            ver: 55,
            appVersion: "6.1.0",
            version: "6.1.0",
            buildDate: BUILD_DATE,
            schema: 55,
            settingsRev: 58,
            key: KEY,
            storageKey: KEY,
            
            updatedAt: (new Date).toISOString(),
            updatedAtMs: Date.now(),
            voiceId: V.vid(),
            voiceName: V.vname(),
            modelId: V.mid(),
            activeVideoSrc: DEFAULT_WALLPAPER_SRC,
            activeMediaType: "video",
            videoPlaylistMode: "loop",
            voicePack: V.count(),
            creditLock: "student playback replays saved clips only",
            syncRev: Number(DB.data.syncRev) || 0,
            
        };
    }
    function configDoc() {
        var s = DB.data, list = null;
        try {
            list = Lib.current() || s.lists && s.lists[0] || null;
        } catch (e) {
            list = null;
        }
        list = list || {};
        return {
            appName: "Smart Dictation",
            appVersion: "6.1.0",
            ver: 55,
            version: "6.1.0",
            schema: 55,
            settingsRev: 58,
            key: KEY,
            classDays: [ 2, 4 ],
            level: "B1",
            
            repoOwner: CONFIG.repoOwner,
            repoName: CONFIG.repoName,
            activeVideoSrc: DEFAULT_WALLPAPER_SRC,
            activeMediaType: "video",
            videoPlaylistMode: "loop",
            perf: "full",
            session: {
                no: s.session && s.session.no || "1",
                day: s.session && s.session.day || "",
                date: s.session && s.session.date || U.dateKey(new Date),
                title: s.session && s.session.title || list.name || "",
                listId: list.id || "",
                classInfo: s.session && s.session.classInfo || "",
                branch: s.session && s.session.branch || "CCBE Galle Branch",
                activeVideoSrc: DEFAULT_WALLPAPER_SRC,
                videoPlaylistMode: "loop",
                perf: "full"
            },
            defaults: {
                sentence: false,
                repeats: 2,
                rate: .96,
                numbers: true,
                mode: "paper",
                writeMode: "fixed",
                writeFixed: 5,
                pauseWord: 1.2,
                pauseSent: 1.6,
                theme: "dark",
                perf: "full",
                glassTint: 0,
                wallpaperVideo: true,
                activeVideoSrc: DEFAULT_WALLPAPER_SRC,
                videoPlaylistMode: "loop"
            },
            listId: list.id || "",
            syncRev: Number(DB.data.syncRev) || 0,
            
            words: (list.words || []).map(function(w) {
                return {
                    w: w.w || w,
                    p: w.p || "",
                    m: w.m || w.d || "",
                    si: w.si || "",
                    s: w.s || "",
                    audio: w.audio || ""
                };
            })
        };
    }
    window.GitHubSync = {
        repo: function() {
            return CONFIG.repoOwner + "/" + CONFIG.repoName;
        },
        hasToken: function() {
            return !!Cloud.ghToken();
        },
        token: function(v) {
            if (v !== undefined) Cloud.ghToken(String(v).replace(/^\s+|\s+$/g, ""));
            return Cloud.ghToken();
        },
        saveToken: function(v) {
            return this.token(v);
        },
        files: function() {
            var p = Cloud.repoPayload();
            return [ {
                p: "data/session.json",
                text: JSON.stringify(p.session, null, 2) + "\n"
            }, {
                p: "data/version.json",
                text: JSON.stringify(versionDoc(), null, 2) + "\n"
            }, {
                p: "data/config.json",
                text: JSON.stringify(configDoc(), null, 2) + "\n"
            } ];
        },
        commitFiles: function(f, m, cb) {
            return Cloud.commitFiles(f, m, cb);
        },
        commitAll: function(m, cb) {
            var f = this.files();
            V.payload(function(p) {
                f.push({
                    p: "data/elevenlabs-audio.json",
                    text: JSON.stringify(p, null, 2) + "\n"
                });
                Cloud.commitFiles(f, m, cb);
            });
            return true;
        },
        test: function(cb) {
            var tok = Cloud.ghToken();
            cb = cb || function() {};
            if (!tok) {
                cb({
                    ok: false,
                    err: "Paste a GitHub token with Contents: write first."
                });
                return false;
            }
            Cloud.ghApi(Cloud.ghPath("data/version.json"), "GET", null, tok, function(r) {
                cb(r && r.ok ? {
                    ok: true,
                    repo: CONFIG.repoOwner + "/" + CONFIG.repoName
                } : {
                    ok: false,
                    err: r && r.err || "cannot read the repository"
                });
            });
            return true;
        }
    };
    Cloud.commitFiles = function(files, msg, cb) {
        var tok = this.ghToken(), self = this, bad = [], i = 0;
        var A = window.SDPCore && window.SDPCore.Admin;
        cb = cb || function() {};
        if (!tok || !A || !A.isUnlockedOnThisDevice || !A.isUnlockedOnThisDevice()) {
            cb({ ok: false, err: "Unlock Lecturer Mode and connect GitHub on this tab first." });
            return false;
        }
        if (!files || !files.length) { cb({ ok: true, committed: 0 }); return true; }
        var si, txt, needsPreview = false;
        for (si = 0; si < files.length; si++) {
            txt = String(files[si].text || "");
            if (/"(?:adminPin|elevenLabsKey|ghToken|vaultCiphertext)"\s*:\s*"[^"]+"/.test(txt) || /(?:sk_|ghp_)[A-Za-z0-9_-]{16,}/.test(txt)) {
                cb({ ok: false, err: "Public commit blocked: secret or key vault detected." }); return false;
            }
            if (/data\/(session|config)\.json$/.test(String(files[si].p || ""))) needsPreview = true;
        }
        if (needsPreview && !this.__sdpPreviewDone && window.SDPPublishPreview) {
            window.SDPPublishPreview(function (list) {
                if (!list) { cb({ ok: false, err: "Publish cancelled." }); return; }
                self.__sdpPreviewDone = true;
                Cloud.commitFiles(files, msg, function (r) { self.__sdpPreviewDone = false; cb(r); });
            });
            return true;
        }
        function step() {
            if (i >= files.length) { cb({ ok: !bad.length, committed: files.length - bad.length, err: bad.join(" ") }); return; }
            var f = files[i], url = self.ghPath(f.p);
            self.ghApi(url, "GET", null, tok, function(r) {
                var body = { message: msg || "v59: publish from the professor studio (GitHub only)", content: self.b64utf8(f.text), branch: "main" };
                if (r && r.ok && r.res && r.res.content) body.sha = r.res.content.sha;
                self.ghApi(url, "PUT", body, tok, function(w) {
                    if (!w || !w.ok) bad.push(f.p + ": " + (w && w.err || "failed"));
                    i++; step();
                });
            });
        }
        step();
        return true;
    };
    Cloud.publish = function(extra, cb) {
        var p = Cloud.repoPayload(), body = {
            action: "publish",
            state: p.session,
            version: p.version
        }, k;
        if (typeof extra === "function") {
            cb = extra;
            extra = null;
        }
        for (k in extra || {}) if (Object.prototype.hasOwnProperty.call(extra, k)) body[k] = extra[k];
        if (!this.mode) {
            if (cb) cb({
                ok: false,
                err: "no cloud link"
            });
            return false;
        }
        this.post(body, function(r) {
            if (cb) cb(r || {
                ok: false
            });
        });
        return true;
    };
    Cloud.fetchRemote = function(cb) {
        cb = cb || function() {};
        if (!this.mode) {
            cb({
                ok: false,
                err: "no cloud link"
            });
            return false;
        }
        this.get({
            action: "state"
        }, function(r) {
            if (r && r.ok) {
                if (r.voicepack) {
                    try {
                        V.apply(r.voicepack);
                    } catch (e) {}
                }
                Cloud.applyState(r);
            }
            cb(r || {
                ok: false
            });
        });
        return true;
    };
    Cloud.ghPublish = function(cb) {
        var f = GitHubSync.files();
        V.payload(function(p) {
            f.push({
                p: "data/elevenlabs-audio.json",
                text: JSON.stringify(p, null, 2) + "\n"
            });
            Cloud.commitFiles(f, "v59: publish words + committed voice clips (GitHub only)", cb);
        });
    };
    try {
        V.boot();
        V.loadShared(function() {
            try {
                if (Cloud.fetchRemote && Cloud.mode) Cloud.fetchRemote(function() {});
            } catch (e) {}
        });
    } catch (e) {}
    window.Publisher = {
        saveAll: function(prog, cb) {
            var f = GitHubSync.files(), note = [];
            cb = cb || function() {};
            if (prog) prog("Saving the word list to GitHub and the cloud…");
            V.payload(function(p) {
                f.push({
                    p: "data/elevenlabs-audio.json",
                    text: JSON.stringify(p, null, 2) + "\n"
                });
                function cloud() {
                    Cloud.publish({
                        voicepack: p
                    }, function(r) {
                        note.push(r && r.ok ? "Cloud sync sent" : "Saved on this device — add a GitHub token so every phone updates");
                        cb({
                            ok: true,
                            note: note.join(" · ")
                        });
                    });
                }
                if (Cloud.ghToken()) {
                    Cloud.commitFiles(f, "v55: publish session words + permanent voice vault", function(r) {
                        note.push(r && r.ok ? "GitHub repository updated" : "GitHub: " + (r && r.err || "not configured"));
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

(function() {
    var V = window.ElevenVault, C = window.EV53 || window.EV54 || window.EV55, cards = 0, UV = window.UniversalSync, EV = window.EncryptedVault;
    var TABS = [ [ "words", "📚 Words & planner" ], [ "session", "🗓️ Session" ], [ "announce", "📣 Announce & inbox" ], [ "comments", "💬 Comments" ], [ "stats", "📊 Class stats" ], [ "tools", "🛠️ Settings & tools" ] ];
    function esc(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function $(id, host) {
        return (host || document).querySelector("#" + id);
    }
    function say(el, txt, good) {
        if (el) {
            el.textContent = txt;
            el.className = "small " + (good ? "good" : "");
        }
    }
    function open(host, html) {
        var box = Admin.card(host, "");
        box.insertAdjacentHTML("beforeend", html);
        return box;
    }
    function title(box, text) {
        try {
            box.parentNode.insertBefore(U.el("h3", null, text), box);
        } catch (e) {}
    }
    function words() {
        var l = null;
        try {
            l = Lib.current();
        } catch (e) {
            l = null;
        }
        if (!l) {
            try {
                l = DB.data.lists[0];
            } catch (e) {
                l = null;
            }
        }
        return l && l.words || [];
    }
    function parse(txt) {
        try {
            return window.AdminAutoEnrich.parse(txt);
        } catch (e) {
            return String(txt || "").split(/[\n,;|]+/).map(function(w) {
                return String(w).replace(/^\s+|\s+$/g, "").toLowerCase();
            }).filter(function(w) {
                return !!w;
            });
        }
    }
    var GH_TOKEN_URL = "https://github.com/settings/tokens/new?description=Smart+Dictation+Player+Permanent+Sync&scopes=repo";
    var EL_KEYS_URL = "https://elevenlabs.io/app/settings/api-keys";
    var PRE_EDIT_WARNING = "⚠️ Warning: GitHub Token / ElevenLabs Key is not connected yet! Please complete the Step-by-Step Sync Setup right above so your voice clips and words save permanently to GitHub for all student devices.";
    var VERIFIED_LINE = "✓ 100% Cross-Device Permanent GitHub & ElevenLabs Sync ACTIVE · Keys Encrypted (SDP_ENC_V2) · All Student Devices Synced";
    var WARN_LINE = "⚠️ Action Required Before Editing: Connect Your ElevenLabs Key & GitHub Token for 100% Cross-Device Permanent Sync!";
    function guideLang() {
        var l = "";
        try {
            l = String((DB.data.settings || {}).guideLang || "en");
        } catch (e) {
            l = "en";
        }
        return l === "si" ? "si" : "en";
    }
    function guideHtml(lang) {
        var si = lang === 'si';
        return '<div class="stack small"><p><strong>' + (si ? 'ආරක්ෂිත GitHub සැකසුම' : 'Secure GitHub setup') + '</strong></p>' +
          '<ol><li>' + (si ? 'GitHub හි fine-grained token එකක් සාදන්න.' : 'Create a fine-grained GitHub token.') + '</li>' +
          '<li>' + (si ? 'කල් ඉකුත්වීම දින 90ක් ලෙස සකසන්න.' : 'Set expiration to 90 days.') + '</li>' +
          '<li>' + (si ? 'dictationb1/dictationb1.github.io ගබඩාව පමණක් තෝරන්න.' : 'Select only dictationb1/dictationb1.github.io.') + '</li>' +
          '<li>Contents: Read and write.</li></ol>' +
          '<p>' + (si ? 'යතුරු මෙම unlocked tab එකේ sessionStorage හි පමණි. ඒවා GitHub, ntfy හෝ වෙනත් උපාංග වෙත නොයවයි. සිසුන්ට committed හඬ පටි නොමිලේ භාවිත කළ හැක.' : 'Keys stay in this unlocked tab’s sessionStorage only. They are never committed or relayed to other devices. Students play committed clips without spending credits.') + '</p>' +
          '<p><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained tokens</a></p></div>';
    }
    function syncReady() {
        var tok = "";
        try {
            tok = String(Cloud.ghToken && Cloud.ghToken() || "");
        } catch (e) {
            tok = "";
        }
        return !!V.apiKey() && !!tok;
    }
    function scrollTo(el) {
        if (!el) {
            return false;
        }
        try {
            if (typeof el.scrollIntoView === "function") {
                el.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
                return true;
            }
        } catch (e) {}
        return false;
    }
    function showPreEditWarning(onContinue) {
        var layer = document.getElementById("syncPreEditWarn"), txt;
        try {
            window.__sdpPreEditWarning = PRE_EDIT_WARNING;
        } catch (e) {}
        if (!layer) {
            layer = document.createElement("div");
            layer.id = "syncPreEditWarn";
            layer.setAttribute("role", "alertdialog");
            layer.setAttribute("aria-modal", "true");
            layer.setAttribute("style", "position:fixed;left:0;right:0;top:0;bottom:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,10,17,.66);");
            layer.innerHTML = '<div class="modal flex-card" style="position:relative;transform:none;left:auto;top:auto;max-width:470px;border:2px solid #f59e0b;border-radius:16px;padding:16px;background:linear-gradient(145deg, rgba(120,53,15,.94), rgba(15,23,42,.96));">' + '<h3 style="margin:0 0 8px">⚠️ Sync Setup Required Before Editing</h3>' + '<p class="small" id="syncPreEditWarnText" style="margin:0 0 12px"></p>' + '<div class="btn-row tight"><button class="btn primary" type="button" id="btnPreEditWarnSetup">🔒 Take me to the Step-by-Step Setup</button>' + '<button class="btn soft" type="button" id="btnPreEditWarnContinue">Continue anyway (not permanent)</button>' + '<button class="btn soft" type="button" id="btnPreEditWarnClose">Close</button></div></div>';
            (document.body || document.documentElement).appendChild(layer);
            var go = document.getElementById("btnPreEditWarnSetup"), close = document.getElementById("btnPreEditWarnClose"), next = document.getElementById("btnPreEditWarnContinue");
            if (go) {
                go.onclick = function() {
                    layer.style.display = "none";
                    scrollTo(document.getElementById("adminSyncWarningCard"));
                };
            }
            if (close) {
                close.onclick = function() {
                    layer.style.display = "none";
                };
            }
            if (next) {
                next.onclick = function() {
                    layer.style.display = "none";
                    window.__sdpWarnAcknowledged = true;
                    if (typeof onContinue === "function") {
                        try {
                            onContinue();
                        } catch (e) {}
                    }
                };
            }
        }
        if (typeof onContinue === "function") {
            var again = document.getElementById("btnPreEditWarnContinue");
            if (again) {
                again.onclick = function() {
                    layer.style.display = "none";
                    window.__sdpWarnAcknowledged = true;
                    onContinue();
                };
            }
        }
        txt = document.getElementById("syncPreEditWarnText");
        if (txt) {
            txt.textContent = PRE_EDIT_WARNING;
        }
        layer.style.display = "flex";
        scrollTo(document.getElementById("adminSyncWarningCard"));
        try {
            if (UI && UI.toast) {
                UI.toast("⚠️ Add the ElevenLabs key and the GitHub token first — then your words and voice save to GitHub for every device.", {
                    icon: "i-warn",
                    ms: 7e3
                });
            }
        } catch (e) {}
        return true;
    }
    function saveAllAndSync(btn) {
        if (!Admin.isUnlockedOnThisDevice()) return false;
        var keyEl = document.getElementById('elApiKeyInput'), tokEl = document.getElementById('ghTokenInput'), st = document.getElementById('adminSyncState');
        if (keyEl && keyEl.value) V.setApiKey(keyEl.value);
        if (tokEl && tokEl.value) Cloud.ghToken(tokEl.value);
        if (btn) btn.disabled = true;
        if (st) st.textContent = 'Keys are active only in this unlocked tab. Generating missing session clips…';
        V.adminGenerateMissing('session', function (t) { if (st) st.textContent = t; }, function (r) {
            V.push(function (sv) {
                if (btn) btn.disabled = false;
                if (st) st.textContent = (sv && sv.ok ? '✓ Clips committed to GitHub. ' : 'Clips saved locally; connect GitHub to publish. ') + 'Keys were not published.';
                refreshSync();
            });
        });
        return true;
    }
    function syncBar(host) {
        var txt = "v58 · GitHub-only clip sync · Keys stay in this unlocked tab · Last Saved: " + (UV && UV.time ? UV.time(DB.data.syncRev || 0) : "—") + " · API Key: " + (V.apiKey() ? "In this tab only" : "Not set") + " · Voice Clips: " + V.count();
        var box = open(host, '<p class="small good" id="syncBanner" role="status">' + esc(txt) + "</p>" + '<p class="tiny muted" id="syncDetail">Keys stay in this unlocked tab only. Reviewed lessons and generated clips are published through the authenticated GitHub Contents API.</p>' + '<button class="btn primary block" type="button" id="btnForceSync">🔄 Sync Now Across All Devices</button>');
        title(box, "🛰️ v58 GitHub Sync — Committed Voice Clips (keys stay in this tab)");
        var go = $("btnForceSync", box);
        go.onclick = function() {
            var spot = $("syncDetail", box);
            go.disabled = true;
            if (spot) spot.textContent = "Pulling the newest encrypted settings from every device…";
            if (!UV) {
                go.disabled = false;
                if (spot) spot.textContent = "The sync engine is still loading — try again in a second.";
                return;
            }
            UV.pullAll(function(r) {
                UV.pushAll("force-sync", function() {
                    go.disabled = false;
                    refreshSync();
                    if (spot) spot.textContent = "✓ " + (r && r.rev ? "Pulled revision " + r.rev + " · " : "") + "Pushed this device again. API key and clips are encrypted before they leave the device.";
                    try {
                        EV.paint();
                    } catch (e) {}
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
                if (chip) {
                    chip.textContent = "Sync: " + (V.apiKey() ? "ElevenLabs key ✓" : "ElevenLabs key ✗") + " · " + (String(Cloud.ghToken && Cloud.ghToken() || "") ? "GitHub token ✓" : "GitHub token ✗") + " · Clips: " + V.count();
                }
            }
        } catch (e) {}
        if (!el) return "";
        var txt = UV ? UV.banner() : "v58 · GitHub-only clip sync · API Key: " + (V.apiKey() ? "In this tab only" : "Not set") + " · Voice Clips: " + V.count();
        if (UV) {
            el.textContent = txt;
            el.className = "small good";
        }
        return txt;
    }
    function card1(host) {
        var s = DB.data.session || {}, w = words(), i, row;
        var box = open(host, '<p class="tiny muted">Type or paste only the words. IPA, the English definition, the Sinhala meaning, an example sentence and the published session are completed for you, the previous week is archived, and every student device gets the new list.</p>' + '<label class="field"><span class="lbl">Session title</span><input id="profSessionTitle" type="text" placeholder="Session 8 - Personal Feelings, Opinions &amp; Experiences (Adj)" value="' + esc(s.title || "") + '"></label>' + '<label class="field"><span class="lbl">Session date</span><input id="profSessionDate" type="date" value="' + esc(s.date || U.dateKey(new Date)) + '"></label>' + '<label class="field"><span class="lbl">Class / lecturer info</span><input id="profClassInfo" type="text" placeholder="CCBE Galle Branch • TUE/THU/IPET015 • Ms. Sumodya Sewmini" value="' + esc(s.classInfo || "CCBE Galle Branch • TUE/THU/IPET015 • Ms. Sumodya Sewmini") + '"></label>' + '<label class="field"><span class="lbl">The weekly word list — one word per line (or commas)</span><textarea id="adminQuickWordsInput" aria-label="Dictation words" placeholder="afraid&#10;amazed&#10;amusing" style="min-height:170px;font-size:16px;font-family:ui-monospace,Menlo,Consolas,monospace">' + esc(w.map(function(x) {
            return x.w || x;
        }).join("\n")) + "</textarea></label>" + '<div class="btn-row tight"><span class="chip good" id="profWordCount" role="status">0 words in list</span><button class="btn sm soft" type="button" id="btnProfClearWords">🧹 Clear List</button></div>' + '<details class="field-details"><summary>👀 Preview the completed table (#1..#30 · word · UK IPA · Sinhala meaning · example · play · delete)</summary><div class="prof-table" id="profWordsTable"></div></details>' + '<p class="small" id="adminQuickStatus" role="status" style="margin-top:10px">The list above is ready — press the big button once.</p>' + '<button class="btn primary block xl" type="button" id="btnAdminAutoComplete" style="margin-top:8px">🚀 Save Words, Auto-Complete Meanings &amp; Publish to All Devices</button>');
        title(box, "📝 Step 1: Professor Weekly Word List Editor (One-Click Auto-Complete & Publish)");
        var area = $("adminQuickWordsInput", box), pill = $("profWordCount", box), table = $("profWordsTable", box), note = $("adminQuickStatus", box), go = $("btnAdminAutoComplete", box);
        function count() {
            pill.textContent = parse(area.value).length + " words in list";
        }
        function st(txt, good) {
            say($("adminQuickStatus"), txt, good);
        }
        function paint() {
            var html = "", j;
            count();
            if (!w.length) {
                table.innerHTML = '<p class="tiny muted">No saved words yet — type them above and press the big button.</p>';
                return;
            }
            html = '<div class="prof-row head"><span>#</span><span>Word</span><span>UK IPA</span><span>Sinhala meaning</span><span>Example sentence</span><span></span></div>';
            for (j = 0; j < w.length; j++) {
                row = w[j] || {};
                html += '<div class="prof-row"><span class="mono">#' + (j + 1) + '</span><span class="strong">' + esc(row.w || row) + "</span><span>" + esc(row.p || "—") + "</span><span>" + esc(row.si || row.m || "—") + '</span><span class="tiny">' + esc(row.s || row.ex || "—") + '</span><span class="row tight"><button class="btn sm ghost" type="button" data-play="' + j + '" aria-label="Play ' + esc(row.w || "word") + '">🔊</button><button class="btn sm ghost" type="button" data-del="' + j + '" aria-label="Remove ' + esc(row.w || "word") + '">🗑️</button></span></div>';
            }
            table.innerHTML = html;
        }
        table.onclick = function(ev) {
            var t = ev.target, p = t.getAttribute && t.getAttribute("data-play"), d = t.getAttribute && t.getAttribute("data-del");
            if (p != null) {
                try {
                    Speech.playWord((w[Number(p)] || {}).w, .72);
                } catch (e) {}
            }
            if (d != null) {
                var lines = area.value.split("\n").filter(function(x) {
                    return String(x).replace(/^\s+|\s+$/g, "");
                });
                lines.splice(Number(d), 1);
                area.value = lines.join("\n");
                count();
            }
        };
        area.oninput = count;
        $("btnProfClearWords", box).onclick = function() {
            area.value = "";
            count();
            st("List cleared — type or paste the new words.", false);
        };
        function publishNow() {
            var list = parse(area.value), meta, no = parseInt(String(DB.data.session && DB.data.session.no || "1").replace(/[^0-9]/g, ""), 10) || 1;
            if (!list.length) {
                st("Please type at least one dictation word first.", false);
                return;
            }
            go.disabled = true;
            st("Working through your words…", false);
            meta = {
                title: $("profSessionTitle", box).value,
                date: $("profSessionDate", box).value,
                classInfo: $("profClassInfo", box).value,
                no: String(no + 1)
            };
            window.AdminAutoEnrich.run(list, meta, function(t) {
                st(t, false);
            }, function(r) {
                if (!r || !r.ok) {
                    go.disabled = false;
                    st("No readable words were found. Use commas or new lines with plain English words.", false);
                    return;
                }
                try {
                    DB.data.session.classInfo = meta.classInfo;
                    if (meta.title) DB.data.session.title = meta.title;
                    DB.saveNow();
                } catch (e) {}
                window.Publisher.saveAll(function(t) {
                    st(t, false);
                }, function(sv) {
                    if (UV) {
                        UV.pushAll("words-and-settings");
                    }
                    try {
                        Admin.renderTab();
                    } catch (e) {}
                    st("✓ " + list.length + " words saved · IPA, meanings, Sinhala & sentences filled · " + (sv && sv.note || "published"), true);
                    try {
                        UI.toast("Session published · " + list.length + " words completed", {
                            icon: "i-check"
                        });
                    } catch (e) {}
                });
            });
        }
        go.onclick = function() {
            if (!syncReady() && !window.__sdpWarnAcknowledged) {
                showPreEditWarning(publishNow);
                return;
            }
            publishNow();
        };
        paint();
        cards++;
        return box;
    }
    function card2(host) {
        var box = open(host, '<p class="small good" id="elCreditLockBanner" role="status">🔒 Credit Protection Lock: ACTIVE — 0 credits are ever used during student playback. Clips generate ONLY once when you click Generate below and stay saved permanently until deleted.</p>' + '<p class="chip good" id="elCreditBadge" role="status" style="margin:6px 0 10px">Saved Permanent Voice Clips: 0</p>' + '<p class="tiny muted" id="elVaultStats"></p><p class="tiny muted" id="elGenProgress" role="status"></p>' + '<button class="btn primary block" type="button" id="btnElGenerateAll" style="margin-top:10px">⚡ Generate &amp; Save Missing Clips to GitHub Now</button>' + '<div class="btn-row tight"><button class="btn soft block" type="button" id="btnElExportJson">📥 Download data/elevenlabs-audio.json</button><button class="btn soft block" type="button" id="btnElImportJson">📤 Upload data/elevenlabs-audio.json</button><input type="file" id="elImportFile" accept="application/json,.json" style="display:none"></div>' + '<h4 style="margin-top:14px">Saved voice clips — kept until you delete them</h4><div class="el-vault-list" id="elVaultList"></div>' + '<button class="btn sm soft block" type="button" id="btnElDeleteAll" style="margin-top:8px">🗑️ Delete All Saved Voice Clips</button>');
        title(box, "🎙️ Step 2: Permanent GitHub Voice Vault & Credit Lock Manager");
        function pr(txt, good) {
            say($("elGenProgress"), txt, good);
        }
        var credits = null, badge = $("elCreditBadge", box), stats = $("elVaultStats", box), prog = $("elGenProgress", box);
        var gen = $("btnElGenerateAll", box), file = $("elImportFile", box), listBox = $("elVaultList", box);
        function summary() {
            var total = V.texts("session").length, p = V.plan("session");
            badge.textContent = "Saved Permanent Voice Clips: " + V.count() + " / " + total + " · Missing Clips: " + p.missing.length + " (Est. Cost: ~" + Math.round(p.credits) + " credits)";
            stats.textContent = (credits ? "Remaining ElevenLabs Credits: " + V.num(credits.remaining) + " / " + V.num(credits.limit) + " · " : "Remaining ElevenLabs Credits: add the key in Step 3 · ") + "Voice: " + V.vname() + " · " + V.mid() + " · " + V.rate() + " credit per character";
        }
        function paint() {
            V.payload(function(p) {
                var ks = Object.keys(p.clips || {}).sort(), html = "", i, c2;
                if (!ks.length) {
                    listBox.innerHTML = '<p class="tiny muted">No clips saved yet. Generated clips live in GitHub data/elevenlabs-audio.json and in this device.</p>';
                    return;
                }
                for (i = 0; i < ks.length; i++) {
                    c2 = p.clips[ks[i]];
                    html += '<div class="el-vault-row" data-key="' + esc(ks[i]) + '"><span class="grow">' + esc(c2.text || "saved clip") + '</span><span class="tiny muted">' + V.kb(V.bytes(c2.audio)) + '</span><button class="btn sm ghost" type="button" data-prev="' + esc(ks[i]) + '">🔊 Preview</button><button class="btn sm ghost" type="button" data-kill="' + esc(ks[i]) + '">🗑️ Delete</button></div>';
                }
                listBox.innerHTML = html;
                listBox.onclick = function(ev) {
                    var t = ev.target, k = t.getAttribute && (t.getAttribute("data-kill") || t.getAttribute("data-prev"));
                    if (!k) return;
                    if (t.getAttribute("data-prev")) {
                        c2 = p.clips[k];
                        if (c2) V.play(c2.audio, c2.text || "", Speech._seqToken, null, 1);
                        return;
                    }
                    if (window.confirm && !window.confirm("Delete this saved voice clip everywhere?")) return;
                    V.del(k, function() {
                        if (UV) {
                            UV.pushAll("clip-deleted");
                        }
                        paint();
                        summary();
                        pr("Deleted 1 clip · GitHub, Cloud and every device updated", true);
                    });
                };
            });
        }
        gen.onclick = function() {
            if (!V.hasKey()) {
                pr("Add your ElevenLabs key in Step 3 first — clips you already own still play for free.", false);
                return;
            }
            gen.disabled = true;
            V.verify(V.apiKey(), function(e, live) {
                if (!e && live) {
                    credits = live;
                    summary();
                }
            });
            V.adminGenerateMissing("session", function(t) {
                pr(t, false);
            }, function(r) {
                gen.disabled = false;
                if (!r.ok) {
                    pr("Add a valid ElevenLabs key in Step 3 to generate clips.", false);
                    return;
                }
                pr("✓ " + r.generated + " new clips · " + r.cached + " already saved (0 credits) · saving to GitHub…", true);
                V.push(function(sv) {
                    pr("✓ Voice vault complete · " + V.count() + " clips · " + (sv && sv.ok ? "committed to GitHub data/elevenlabs-audio.json" : "saved here and sent to Cloud sync"), true);
                    if (UV) {
                        UV.pushAll("voice-clips");
                    }
                    paint();
                    summary();
                    try {
                        UI.toast("Voice vault saved · every device gets the same clips", {
                            icon: "i-check"
                        });
                    } catch (e) {}
                });
            });
        };
        $("btnElExportJson", box).onclick = function() {
            V.exportJson(function(p) {
                pr("✓ Exported " + Object.keys(p.clips || {}).length + " clips · commit it as data/elevenlabs-audio.json for every device.", true);
            });
        };
        $("btnElImportJson", box).onclick = function() {
            file.click();
        };
        file.onchange = function() {
            var f = file.files && file.files[0], rd;
            if (!f || !window.FileReader) return;
            rd = new FileReader;
            rd.onload = function() {
                var p = null;
                try {
                    p = JSON.parse(String(rd.result || "{}"));
                } catch (e) {
                    p = null;
                }
                if (!p) {
                    pr("That file is not a valid voice pack.", false);
                    return;
                }
                if (!V.importPayload(p, function(c2) {
                    pr("✓ Imported " + c2 + " clips · " + V.count() + " saved · committed to GitHub", true);
                    paint();
                    summary();
                })) pr("That voice pack had no clips in it.", false);
            };
            rd.readAsText(f);
        };
        $("btnElDeleteAll", box).onclick = function() {
            if (window.confirm && !window.confirm("Delete every saved voice clip from this device, GitHub and the Cloud?")) return;
            V.delAll(function() {
                pr("✓ All saved voice clips deleted.", true);
                paint();
                summary();
            });
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
            voices += '<option value="' + C.voices[i].id + '"' + (C.voices[i].id === V.vid() ? " selected" : "") + ">" + esc(C.voices[i].label) + "</option>";
        }
        voices += '<option value="__custom__"' + (pick ? "" : " selected") + ">Custom Voice ID (saved below)</option>";
        for (i = 0; i < C.models.length; i++) models += '<option value="' + C.models[i].id + '"' + (C.models[i].id === V.mid() ? " selected" : "") + ">" + esc(C.models[i].name) + "</option>";
        var box = open(host, '<p class="tiny muted">Paste each key once on this phone. The ElevenLabs key is used only when YOU press Generate. The GitHub token keeps the word list and the voice clips in the repository for every student device.</p>' + '<label class="field"><span class="lbl">ElevenLabs API key</span><input id="elApiKeyInput" type="password" autocomplete="off" placeholder="Paste your ElevenLabs API key (xi-api-key)" value="' + esc(V.apiKey()) + '"></label>' + '<label class="field"><span class="lbl">Studio voice (British English woman)</span><select id="elVoiceSelect" aria-label="ElevenLabs studio voice">' + voices + "</select></label>" + '<label class="field"><span class="lbl">Studio model</span><select id="elModelSelect" aria-label="ElevenLabs model">' + models + "</select></label>" + '<p class="small" id="elKeyStatus" role="status">Key not verified yet.</p>' + '<button class="btn primary block" type="button" id="btnElVerify">💾 Save &amp; Verify ElevenLabs Key</button>' + '<label class="field"><span class="lbl">GitHub repository token (saved once, keeps words + clips in the repo)</span><input id="ghTokenInput" type="password" autocomplete="off" aria-label="GitHub personal access token" placeholder="github_pat_… (Contents: write on dictationb1/dictationb1.github.io)" value="' + esc(Cloud.ghToken ? Cloud.ghToken() : "") + '"></label>' + '<p class="small" id="ghStatus" role="status"></p><button class="btn primary block" type="button" id="btnGhVerify">🔗 Save &amp; Test GitHub Sync</button>');
        title(box, "🔑 Step 3: One-Time API Keys & Cross-Device Sync Setup");
        try {
            box.insertAdjacentHTML("afterbegin", '<p class="tiny muted" id="card3GuideLink" style="margin:0 0 8px">New here? The 3-step guide with the pre-filled GitHub token link and the English/Sinhala toggle lives in the amber sync card at the very top of Lecturer Mode. <button class="btn sm ghost" type="button" id="btnCard3Setup">⬆️ Show the setup guide</button></p>');
            var jump = $("btnCard3Setup", box);
            if (jump) {
                jump.onclick = function() {
                    scrollTo(document.getElementById("adminSyncWarningCard"));
                };
            }
        } catch (e) {}
        function ksSay(txt, good) {
            say($("elKeyStatus"), txt, good);
        }
        function gsSay(txt, good) {
            say($("ghStatus"), txt, good);
        }
        var ks = $("elKeyStatus", box), gs = $("ghStatus", box), key = $("elApiKeyInput", box), voice = $("elVoiceSelect", box), model = $("elModelSelect", box), tok = $("ghTokenInput", box);
        $("btnElVerify", box).onclick = function() {
            var v = String(key.value || "").replace(/^\s+|\s+$/g, "");
            if (!v) {
                ksSay("Please paste your ElevenLabs API key first.", false);
                return;
            }
            V.setApiKey(v);
            ksSay("Active in this unlocked tab only · never published…", false);
            if (UV) {
                UV.pushAll("elevenlabs-key", function(r) {
                    var ch = r && r.channels ? r.channels.join(" · ") : "";
                    if (ch) {
                        ksSay("✓ Key active in this tab only · " + ch, true);
                    }
                    refreshSync();
                });
            }
            ksSay("Verifying your key with ElevenLabs…", false);
            V.verify(v, function(e, c2) {
                if (e || !c2) {
                    ksSay("Key saved. Live verification needs internet — clips still generate when you press Generate.", false);
                    return;
                }
                ksSay(V.status(c2), true);
                var vs = $("elVaultStats");
                if (vs) vs.textContent = "Remaining ElevenLabs Credits: " + V.num(c2.remaining) + " / " + V.num(c2.limit) + " · Voice: " + V.vname() + " · " + V.mid() + " · " + V.rate() + " credit per character";
                try {
                    UI.toast("ElevenLabs connected · " + c2.remaining + " credits left", {
                        icon: "i-check"
                    });
                } catch (x) {}
            });
        };
        voice.onchange = function() {
            if (voice.value !== "__custom__") {
                V.setVid(voice.value);
                ksSay("Voice saved: " + V.vname(), true);
            }
        };
        model.onchange = function() {
            V.setMid(model.value);
        };
        $("btnGhVerify", box).onclick = function() {
            var v = String(tok.value || "").replace(/^\s+|\s+$/g, "");
            if (!v) {
                gsSay("Paste a GitHub token with Contents: write first.", false);
                return;
            }
            Cloud.ghToken(v);
            gsSay("Testing the repository…", false);
            window.GitHubSync.test(function(r) {
                gsSay(r && r.ok ? "✓ GitHub sync ready · " + r.repo + " (main branch)" : "Could not reach " + window.GitHubSync.repo() + " — " + (r && r.err || "check the token"), !!(r && r.ok));
                if (UV) {
                    UV.pushAll("github-token");
                }
            });
        };
        cards++;
        return box;
    }
    /* v58 / 9.8 — anonymous word-level weakness aggregation + remediation. */
    function weaknessTop10() {
        var attempts = {}, misses = {}, i, j, h, rows, row, w, out = [], wm = (DB.data.mistakes || []);
        rows = DB.data.history || [];
        for (i = 0; i < rows.length; i++) {
            h = rows[i] || {};
            var hrows = h.rows || [];
            for (j = 0; j < hrows.length; j++) {
                row = hrows[j] || {};
                w = String(row.word || row.w || "").toLowerCase().split("/")[0].replace(/[^a-z\u0D80-\u0DFF']/g, "").trim();
                if (!w) continue;
                attempts[w] = (attempts[w] || 0) + 1;
                if (row.state && row.state !== "ok") misses[w] = (misses[w] || 0) + 1;
            }
        }
        for (i = 0; i < wm.length; i++) {
            w = String((wm[i] && wm[i].w) || "").toLowerCase().trim();
            if (!w) continue;
            if (!attempts[w]) attempts[w] = 1;
            if (!misses[w]) misses[w] = 1;
        }
        for (w in misses) {
            if (Object.prototype.hasOwnProperty.call(misses, w)) {
                out.push({ word: w, misses: misses[w], attempts: Math.max(misses[w], attempts[w] || 1) });
            }
        }
        out.sort(function(a, b) { return b.misses - a.misses || a.word.localeCompare(b.word); });
        return out.slice(0, 10);
    }
    function remediationDrillText(w) {
        return 'Flashcards \u2192 4-Choice Quiz \u2192 type-drill x3 for "' + w + '" (3-streak graduates)';
    }
    function card4(host) {
        var box = open(host, '<p class="tiny muted">Anonymous word-level mistake counts from past results on this device. No names, no accounts \u2014 words only.</p>' + '<div id="adminWeaknessTop" class="prof-table"></div>' + '<div class="btn-row tight"><button class="btn sm soft" type="button" id="btnExportWeaknessTop10">\u2b07\ufe0f Export top-10 CSV (col E: suggested_remediation_drill)</button><button class="btn sm primary" type="button" id="btnBuildRemediationSession">🛠️ Build Remediation Session</button></div>' + '<p class="tiny muted" id="remediationStatus" role="status"></p>');
        title(box, "📊 Step 4: Class weakness & remediation (top 10)");
        var host2 = $("adminWeaknessTop", box), note = $("remediationStatus", box);
        function top() { return weaknessTop10(); }
        function paint() {
            var list = top(), i, html = "<p class=\"tiny muted\">word \u00b7 misses / attempts \u00b7 error %</p>";
            if (!list.length) html += "<p class=\"small\">No missed words recorded yet \u2014 run a few dictations and the pattern shows up here.</p>";
            for (i = 0; i < list.length; i++) {
                html += "<p class=\"small\"><b>" + esc(list[i].word) + "</b> \u00b7 " + list[i].misses + "/" + list[i].attempts + " \u00b7 " + Math.round(100 * list[i].misses / Math.max(1, list[i].attempts)) + "%</p>";
            }
            host2.innerHTML = html;
            return list;
        }
        var list = paint();
        var csv = $("btnExportWeaknessTop10", box);
        csv.addEventListener("click", function() {
            var rows = top(), lines = ["word,attempts,misses,error_percent,suggested_remediation_drill"], i;
            for (i = 0; i < rows.length; i++) {
                var r = rows[i], pct = Math.round(100 * r.misses / Math.max(1, r.attempts));
                lines.push([r.word, r.attempts, r.misses, pct, '"' + remediationDrillText(r.word) + '"'].join(","));
            }
            var blob = new Blob([lines.join("\n")], { type: "text/csv" }), url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            a.download = "weakness-top10.csv";
            document.body.appendChild(a);
            a.click();
            setTimeout(function() { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 500);
        });
        var build = $("btnBuildRemediationSession", box);
        build.addEventListener("click", function() {
            var rows = top();
            if (!rows.length) {
                note.textContent = "Nothing to remediate yet \u2014 no misses recorded.";
                return;
            }
            var words = [], i, pool = DB.data.lists || [], j, k;
            for (i = 0; i < rows.length; i++) {
                var found = null;
                for (j = 0; j < pool.length && !found; j++) {
                    var wl = pool[j].words || [];
                    for (k = 0; k < wl.length; k++) {
                        var cw = String(wl[k].w || "").toLowerCase().split("/")[0];
                        if (cw === rows[i].word) { found = wl[k]; break; }
                    }
                }
                words.push(found || { w: rows[i].word, s: "", m: "", p: "", si: "" });
            }
            var area = $("adminQuickWordsInput");
            if (area) {
                area.value = words.map(function(x) { return x.w; }).join("\n");
                try {
                    var ev;
                    if (typeof Event === "function") { ev = new Event("input", { bubbles: true }); }
                    else { ev = document.createEvent("UIEvents"); ev.initUIEvent("input", true, false, window); }
                    area.dispatchEvent(ev);
                } catch (e) {}
                note.textContent = "Top " + words.length + " weak words loaded into Step 1 \u2014 press the big publish button to send the remediation list to every device.";
            } else {
                var listObj = { id: "v58-remediation", name: "Remediation Drill (top " + words.length + ")", words: words, published: false };
                var replaced = false;
                for (j = 0; j < pool.length; j++) if (pool[j].id === "v58-remediation") { pool[j] = listObj; replaced = true; }
                if (!replaced) pool.push(listObj);
                try { DB.saveNow(); } catch (e) { DB.save(); }
                note.textContent = "Remediation list saved (v58-remediation, " + words.length + " words).";
            }
        });
        cards++;
        return box;
    }
    function advanced(host) {
        var html = "";
        TABS.forEach(function(t) {
            html += '<button class="btn sm soft" type="button" data-legacy-tab="' + t[0] + '">' + t[1] + "</button>";
        });
        var det = document.createElement("details");
        det.className = "admin-advanced";
        det.innerHTML = '<summary>⚙️ Advanced Tools & Diagnostics</summary><div class="stack"><p class="tiny muted">Everything technical lives here: words &amp; planner, session, announcements, comments, class statistics and diagnostics. The three steps above are all you need to change the weekly list.</p><div class="btn-row tight">' + html + "</div></div>";
        det.onclick = function(ev) {
            var tab = ev.target.getAttribute && ev.target.getAttribute("data-legacy-tab");
            if (tab) {
                Admin.tab = tab;
                Admin.renderTab();
            }
        };
        host.appendChild(det);
        return det;
    }
    var oldPanel = Admin.panel, oldRender = Admin.renderTab;
    Admin.panel = function() {
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
                U.on(b, "click", function() {
                    Admin.tab = "studio";
                    Admin.renderTab();
                    U.$$(".admintabs .seg button").forEach(function(o) {
                        o.setAttribute("aria-pressed", o === b ? "true" : "false");
                    });
                });
                seg.insertBefore(b, seg.children.length > 1 ? seg.children[1] : null);
            }
        } catch (e) {}
        return layer;
    };
    Admin.renderTab = function(host) {
        var target = host || U.$("#adminHost"), out;
        if (!target) return oldRender.apply(this, arguments);
        if (this.tab && this.tab !== "studio") {
            out = oldRender.call(this, target);
            try {
                var back = U.btn("← Back to the 3-step studio", null, "sm soft block");
                back.type = "button";
                back.id = "btnBackToStudio";
                back.style.marginBottom = "10px";
                U.on(back, "click", function() {
                    Admin.tab = "studio";
                    Admin.renderTab();
                });
                target.insertBefore(back, target.firstChild || null);
            } catch (e) {}
            return out;
        }
        target.innerHTML = "";
        cards = 0;
        try {
            syncWarningCard(target);
        } catch (e) {}
        syncBar(target);
        card1(target);
        card2(target);
        card3(target);
        try {
            card4(target);
        } catch (e) {}
        advanced(target);
        return cards;
    };
    Admin.studioCardsRendered = function() {
        return cards;
    };
    Admin.openStudio = function() {
        if (!this.unlocked) return false;
        this.panel();
        return true;
    };
    window.ProfessorStudio = {
        cards: function() {
            return cards;
        },
        sync: refreshSync,
        syncReady: syncReady,
        guide: guideHtml
    };
    window.SDPShowSyncWarning = showPreEditWarning;
    window.SDPSaveAndSyncAll = saveAllAndSync;
    window.SDPRefreshStudio = function() {
        try {
            refreshSync();
        } catch (e) {}
        var host = U.$("#adminHost");
        if (host && Admin.unlocked && Admin.tab === "studio") {
            var rows = U.$("#elVaultList");
            if (rows) {
                try {
                    Admin.renderTab();
                } catch (e) {}
            }
        }
        return true;
    };
    window.SDPStudioLoaded = function() {
        return true;
    };
    try {
        if (Admin.unlocked && U.$("#adminHost") && Admin.tab === "studio") Admin.renderTab();
    } catch (e) {}
})();

(function () {
  'use strict';
  var C = window.SDPCore || {}, DB = C.DB, Cloud = C.Cloud, CONFIG = C.CONFIG, U = C.U, Lib = C.Lib;
  function admin() { return !!(C.Admin && C.Admin.isUnlockedOnThisDevice && C.Admin.isUnlockedOnThisDevice()); }
  function stamp(o) { o.ver = 58; o.schema = 58; o.settingsRev = 58; o.appVersion = '7.0.0'; o.version = '7.0.0'; o.updatedAt = new Date().toISOString(); return o; }
  function publicConfig() {
    var s = DB.data.settings || {}, n = DB.data.session || {};
    return stamp({ appName: 'Smart Dictation', level: 'B1', repoOwner: CONFIG.repoOwner, repoName: CONFIG.repoName,
      session: { no: n.no || '', date: n.date || '', title: n.title || '', listId: n.listId || '', classInfo: n.classInfo || '' },
      defaults: { wallpaperVideo: false, activeVideoSrc: '', videoDim: 18, rate: Number(s.rate) || .96, volume: Number(s.volume),
        repeats: Number(s.repeats) || 2, readSentence: !!s.readSentence, writeFixed: Number(s.writeFixed) || 5, mode: s.mode || 'paper' } });
  }
  var GH = {
    repo: function () { return CONFIG.repoOwner + '/' + CONFIG.repoName; },
    hasToken: function () { return !!(admin() && Cloud.ghToken()); },
    token: function (v) { if (typeof v !== 'undefined') Cloud.ghToken(v); return Cloud.ghToken(); },
    saveToken: function (v) { return this.token(v); },
    files: function () {
      var p = Cloud.repoPayload();
      return [{ p: 'data/session.json', text: JSON.stringify(stamp(p.session), null, 2) + '\n' },
        { p: 'data/version.json', text: JSON.stringify(stamp(p.version), null, 2) + '\n' },
        { p: 'data/config.json', text: JSON.stringify(publicConfig(), null, 2) + '\n' }];
    },
    commitFiles: function (files, message, cb) { return Cloud.commitFiles(files, message, cb); },
    commitAll: function (message, cb) {
      var files = this.files();
      if (!window.ElevenVault) return Cloud.commitFiles(files, message, cb);
      window.ElevenVault.payload(function (p) { files.push({ p: 'data/elevenlabs-audio.json', text: JSON.stringify(p, null, 2) + '\n' }); Cloud.commitFiles(files, message, cb); });
      return true;
    },
    test: function (cb) {
      cb = cb || function () {};
      if (!this.hasToken()) { cb({ ok: false, err: 'Unlock Lecturer Mode and add a fine-grained Contents token for this repository.' }); return false; }
      Cloud.ghApi(Cloud.ghPath('data/version.json'), 'GET', null, Cloud.ghToken(), function (r) { cb({ ok: !!(r && r.ok), repo: GH.repo(), err: r && r.err }); });
      return true;
    }
  };
  window.GitHubSync = GH;
  window.StudioSync = {
    version: 58,
    keyBody: function () { return JSON.stringify({ ver: 59, appVersion: '8.0.0' }); },
    wordsBodies: function () { return []; },
    clipDoc: function () {
      var V = window.ElevenVault, out = { ver: 59, appVersion: '8.0.0', strictAdminOnly: true, clips: {} }, k;
      if (V) for (k in V.sharedMap) if (Object.prototype.hasOwnProperty.call(V.sharedMap, k)) out.clips[k] = { audio: V.sharedMap[k], text: V.metaMap[k] && V.metaMap[k].text || '', voiceId: V.vid(), modelId: V.mid() };
      return out;
    },
    mergeClips: function (doc) { return window.ElevenVault && doc ? window.ElevenVault.apply(doc) : 0; },
    applyWordsDoc: function (doc) {
      if (!doc || !doc.words || Number(doc.syncRev || doc.ver) <= Number(DB.data.syncRev || 0)) return 0;
      var n = window.EncryptedVault.applyWords(doc.words, doc.listName); if (n) { DB.data.syncRev = Number(doc.syncRev || doc.ver); DB.saveNow(); } return n;
    },
    push: function (env, reason, cb) { GH.commitAll('v58: reviewed lecturer publication', cb || function () {}); },
    clips: function (clips, cb) { if (window.ElevenVault) window.ElevenVault.push(cb); else if (cb) cb({ ok: false }); }
  };
})();

(function() {
    function F(s) {
        return String(s == null ? "" : s).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    }
    var X = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ], Q = {
        status: "",
        lastWords: [],
        parse: function(e) {
            var t, n, i = String(e || "").split(/[\n,;|]+/), s = [], o = {};
            for (t = 0; t < i.length; t++) (n = F(i[t]).replace(/^[0-9]+[.)\-\s]*/, "").replace(/[.?!:]+$/, "").toLowerCase()) && /^[a-z][a-z' \-]*$/.test(n) && !o[n] && (o[n] = 1, 
            s.push(n));
            return s;
        },
        lexicon: function(e) {
            var t, n, i, s, o = String(e || "").toLowerCase(), a = [];
            for (t = 0; t < SAMPLE_WORDS.length; t++) if (String(SAMPLE_WORDS[t].w || "").toLowerCase() === o) return SAMPLE_WORDS[t];
            try {
                a = (DB.data.lists || []).concat(DB.data.pastSessions || []);
            } catch (e) {
                a = [];
            }
            for (t = 0; t < a.length; t++) for (i = a[t] && a[t].words || [], n = 0; n < i.length; n++) if ((s = i[n]) && String(s.w || "").toLowerCase() === o) return s;
            return s = o.replace(/[^a-z' \-]/g, ""), WORD_BANK && WORD_BANK[s] || null;
        },
        sentenceFor: function(e, t) {
            var n = String(e || "").toLowerCase(), i = String(t || "").toLowerCase();
            return /verb/.test(i) ? "She decided to " + n + " before the end of the lesson." : /adverb/.test(i) ? "He finished the dictation " + n + " and checked every word." : /noun/.test(i) ? "The lecturer wrote the word " + n + " on the whiteboard." : /adject/.test(i) ? "Everyone felt " + n + " after the long journey to Galle." : 'Our English class used the word "' + n + '" in a short sentence today.';
        },
        sinhala: function(e, t) {
            var n = "", i = null;
            try {
                i = this.lexicon(e);
            } catch (e) {}
            if (n = i && (i.si || "") || "", !window.fetch) return t && t(n);
            try {
                window.fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=si&dt=t&q=" + encodeURIComponent(e)).then(function(e) {
                    return e && e.ok ? e.json() : null;
                }).then(function(e) {
                    t && t(F(e && e[0] && e[0][0] && e[0][0][0]) || n);
                }).then(null, function() {
                    t && t(n);
                });
            } catch (e) {
                t && t(n);
            }
        },
        english: function(e, t) {
            var n = null;
            try {
                n = this.lexicon(e);
            } catch (e) {}
            var i = {
                ipa: n && (n.p || n.ipa) || "",
                meaning: n && (n.d || n.m) || "",
                example: n && n.s || "",
                pos: n && n.t || ""
            };
            if (!window.fetch || void 0 === Dict || !Dict.lookup) return t && t(i);
            try {
                Dict.lookup(e, function(e) {
                    t && t(e ? {
                        ipa: i.ipa || e.ipa || "",
                        meaning: i.meaning || e.meaning || "",
                        example: i.example || e.example || "",
                        pos: i.pos || e.pos || ""
                    } : i);
                });
            } catch (e) {
                t && t(i);
            }
        },
        enrich: function(e, t) {
            var n = this, i = F(e).toLowerCase();
            this.english(i, function(e) {
                n.sinhala(i, function(s) {
                    var o = F(e.meaning) || "a B1 word you can use in your own sentence: " + i, a = F(e.example) || n.sentenceFor(i, e.pos);
                    t && t({
                        w: i,
                        p: F(e.ipa).replace(/^\/+|\/+$/g, ""),
                        d: o,
                        m: s || o,
                        si: s || "",
                        s: a,
                        ex: a,
                        t: e.pos || "",
                        def: o
                    });
                });
            });
        },
        enrichAll: function(e, t, n) {
            var i = this, s = this.parse(e), o = [], a = 0;
            function r() {
                if (a >= s.length) return n && n(o);
                var e = s[a++];
                t && t("Completing " + a + "/" + s.length + " · " + e + "…"), i.enrich(e, function(e) {
                    o.push(e), r();
                });
            }
            return r(), s;
        },
        archiveCurrent: function() {
            var e, t, n = DB.data, i = null;
            try {
                i = Lib.current();
            } catch (e) {}
            if (!i || !i.words || !i.words.length) return null;
            for (e = {
                no: n.session && n.session.no || "",
                day: n.session && n.session.day || "",
                date: n.session && n.session.date || U.dateKey(new Date),
                title: i.name,
                listName: i.name,
                listId: i.id,
                archived: !0,
                words: i.words.map(function(e) {
                    return wordRow(e);
                })
            }, n.pastSessions = n.pastSessions || [], t = 0; t < n.pastSessions.length; t++) if (n.pastSessions[t] && n.pastSessions[t].listId === e.listId && n.pastSessions[t].date === e.date) return e;
            return n.pastSessions.unshift(e), n.pastSessions.length > 40 && (n.pastSessions.length = 40), 
            e;
        },
        publish: function(e, t, n) {
            var i = DB.data, s = t || {}, o = F(s.title) || "Session " + (s.no || i.session.no || "1") + " words", a = U.validDate(s.date), r = a ? U.dateKey(a) : U.dateKey(new Date), l = new Date(r + "T12:00:00"), c = null;
            if (!e || !e.length) return n && n(null), null;
            this.archiveCurrent(), c = {
                id: U.uid("list"),
                name: o,
                words: e,
                version: 1,
                published: !1,
                draft: !0,
                updatedAt: Date.now()
            }, i.lists.push(c), i.plan = i.plan || {
                weekdays: [],
                dates: {},
                pinned: "",
                defaultList: ""
            }, i.plan.dates = i.plan.dates || {}, i.plan.dates[r] = c.id, i.plan.pinned = c.id, 
            i.plan.defaultList = i.plan.defaultList || c.id, i.session.no = F(s.no) || i.session.no || "1", 
            i.session.title = o, i.session.date = r, isFinite(l.getTime()) && (i.session.day = X[U.weekdayIndex(l)] || i.session.day), 
            i.session.listId = c.id, i.session.ready = [];
            try {
                Admin.publish(c, !0);
            } catch (e) {}
            c.published || (c.published = !0, c.draft = !1, c.version = (c.version || 1) + 1, 
            c.updatedAt = Date.now(), c.publishedWords = c.words.map(function(e) {
                return wordRow(e);
            }), c.publishedName = c.name, c.publishedVersion = c.version, i.sessions = i.sessions || [], 
            i.sessions.unshift({
                no: i.session.no || "",
                day: i.session.day || "",
                date: r,
                title: o,
                listId: c.id,
                listName: o,
                version: c.version,
                words: c.publishedWords
            }), i.sessions.length > 10 && (i.sessions.length = 10)), DB.saveNow();
            try {
                Screens.home();
            } catch (e) {}
            return n && n(c), c;
        },
        run: function(e, t, n, i) {
            var s = this, o = n || function() {};
            return o("Reading the words you typed…"), this.enrichAll(e, o, function(e) {
                if (!e.length) return i && i({
                    ok: !1,
                    words: []
                });
                o("Publishing " + e.length + " words as a new session…"), s.publish(e, t, function(t) {
                    if (s.lastWords = e, s.status = "✓ " + e.length + " words completed · IPA, definition, Sinhala meaning & sentence filled · Session published", 
                    !window.ElevenVault.hasKey()) return i && i({
                        ok: !0,
                        words: e,
                        list: t,
                        audio: null
                    });
                    var n, a = [];
                    for (n = 0; n < e.length; n++) a.push(e[n].w);
                    window.ElevenVault.generateBatch(a, o, function(n) {
                        i && i({
                            ok: !0,
                            words: e,
                            list: t,
                            audio: n
                        });
                    });
                });
            }), !0;
        }
    };
    window.AdminAutoEnrich = Q, window.F = window.F || F;
})();
/* ------------------------------------------------------------------
   SDP_ENC_V2 vault helpers (v60 / 9.0.0.3)
   PBKDF2-SHA256 with 250000 iterations; the AES-GCM envelope itself
   lives in index.html (window.EncryptedVault). These are the studio-side
   markers plus thin, fail-safe delegates so a locked student device never
   derives a key or touches the network.
   ------------------------------------------------------------------ */
(function (global) {
  'use strict';
  var SDP_ENC_V2 = { tag: 'SDP_ENC_V2:', kdf: 'PBKDF2', hash: 'SHA-256', iterations: 250000, cipher: 'AES-GCM', bits: 256 };
  function getVault() {
    try {
      var v = global.ElevenVault;
      if (!v) return null;
      if (typeof v.stats === 'function') return v.stats();
      if (typeof v.count === 'function') return { clips: v.count(), voiceId: v.voiceId ? v.voiceId() : '', modelId: v.modelId ? v.modelId() : '' };
      return null;
    } catch (e) { return null; }
  }
  function saveVault(payload, pin, cb) {
    var out = null;
    try {
      var ev = global.EncryptedVault;
      if (ev && typeof ev.encryptV2 === 'function' && payload && pin) out = ev.encryptV2(payload, pin);
      else if (ev && typeof ev.encrypt === 'function' && payload && pin) out = ev.encrypt(payload, pin);
    } catch (e) { out = null; }
    if (typeof cb === 'function') { try { cb(out); } catch (e2) {} }
    return out;
  }
  global.SDP_ENC_V2 = SDP_ENC_V2;
  global.SDPEncV2 = { params: SDP_ENC_V2, getVault: getVault, saveVault: saveVault };
})((typeof window !== 'undefined') ? window : {});
