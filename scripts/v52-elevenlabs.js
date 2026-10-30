/* SECTION 52 - ELEVENLABS ONE-TIME STUDIO VOICE VAULT (v52) */
var EV52 = {
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    modelId: "eleven_flash_v2_5",
    endpoint: "https://api.elevenlabs.io/v1/text-to-speech/",
    query: "?output_format=mp3_44100_64",
    subscription: "https://api.elevenlabs.io/v1/user/subscription",
    dataUrl: "./data/elevenlabs-audio.json",
    dbName: "sdp_elevenlabs_vault_v1",
    store: "clips",
    cache: "sdp-elevenlabs-v52",
    cachePrefix: "/__elevenlabs/",
    cost: {
        eleven_flash_v2_5: 0.5,
        eleven_multilingual_v2: 1
    },
    settings: {
        stability: 0.45,
        similarity_boost: 0.85,
        style: 0.5,
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
        id: "ThT5KcBeYPX3keUQqHPh",
        name: "Dorothy",
        label: "Dorothy · British Pleasant Studio Woman"
    } ],
    models: [ {
        id: "eleven_flash_v2_5",
        name: "eleven_flash_v2_5 (0.5x Credit Saver)"
    }, {
        id: "eleven_multilingual_v2",
        name: "eleven_multilingual_v2 (1x HD Studio)"
    } ]
};

function evTrim(v) {
    return String(null == v ? "" : v).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

/* Deterministic 32-bit FNV-1a hash so the same text always maps to one clip. */
function evHash(v) {
    var s = String(null == v ? "" : v), a = 2166136261, b = 5381, i, c;
    for (i = 0; i < s.length; i++) {
        c = s.charCodeAt(i);
        a = ((a ^ c) * 16777619) >>> 0;
        b = ((b * 33) ^ c) >>> 0;
    }
    return a.toString(36) + b.toString(36);
}

function evB64(bytes) {
    var s = "", i, n = 8192;
    for (i = 0; i < bytes.length; i += n) s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + n, bytes.length)));
    try {
        return window.btoa(s);
    } catch (e) {
        return "";
    }
}

function evDataUrl(bytes) {
    var b = evB64(bytes);
    return b ? "data:audio/mpeg;base64," + b : "";
}

function evBlob(url) {
    var m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(String(url || "")), raw, out, i;
    if (!m) return null;
    try {
        raw = m[2] ? window.atob(m[3]) : window.unescape(m[3]);
    } catch (e) {
        return null;
    }
    out = new Uint8Array(raw.length);
    for (i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i) & 255;
    try {
        return new Blob([ out ], {
            type: m[1] || "audio/mpeg"
        });
    } catch (e) {
        return null;
    }
}

function evFmt(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

var ElevenVault = {
    version: 52,
    sharedMap: {},
    memMap: {},
    metaMap: {},
    inflight: {},
    stats: {
        generatedCount: 0,
        sharedHits: 0,
        localHits: 0,
        creditsSaved: 0,
        characters: 0,
        failures: 0
    },
    _db: null,
    _dbOpen: 0,
    _dbWait: [],
    normalize: evTrim,
    hashText: evHash,
    _set: function() {
        try {
            DB.data.settings = DB.data.settings || {};
            return DB.data.settings;
        } catch (e) {
            return {};
        }
    },
    apiKey: function() {
        try {
            return String(this._set().elevenLabsKey || "");
        } catch (e) {
            return "";
        }
    },
    hasKey: function() {
        return !!this.apiKey();
    },
    enabled: function() {
        return this.hasKey() || this.clipCount() > 0;
    },
    setApiKey: function(key) {
        try {
            this._set().elevenLabsKey = String(key || "");
            DB.saveNow();
        } catch (e) {}
        return this.apiKey();
    },
    voiceId: function() {
        try {
            return String(this._set().elevenLabsVoiceId || EV52.voiceId);
        } catch (e) {
            return EV52.voiceId;
        }
    },
    setVoiceId: function(id) {
        try {
            this._set().elevenLabsVoiceId = evTrim(id) || EV52.voiceId;
            DB.saveNow();
        } catch (e) {}
        return this.voiceId();
    },
    modelId: function() {
        try {
            return String(this._set().elevenLabsModelId || EV52.modelId);
        } catch (e) {
            return EV52.modelId;
        }
    },
    setModelId: function(id) {
        try {
            this._set().elevenLabsModelId = evTrim(id) || EV52.modelId;
            DB.saveNow();
        } catch (e) {}
        return this.modelId();
    },
    creditRate: function() {
        return EV52.cost[this.modelId()] || 1;
    },
    keyFor: function(text) {
        return "el_" + this.voiceId() + "_" + evHash(this.normalize(text));
    },
    clipCount: function() {
        var k, seen = {}, n = 0;
        for (k in this.sharedMap) if (this.sharedMap[k] && !seen[k]) seen[k] = n++;
        for (k in this.memMap) if (this.memMap[k] && !seen[k]) seen[k] = n++;
        return n;
    },
    read: function(entry) {
        if (!entry) return "";
        return "string" == typeof entry ? entry : String(entry.audio || entry.dataUrl || entry.url || entry.clip || "");
    },
    syncClip: function(text) {
        var key = this.keyFor(text);
        return this.read(this.memMap[key]) || this.read(this.sharedMap[key]) || "";
    },
    loadShared: function(done) {
        var self = this;
        this.applyShared = function(payload) {
            var clips = payload && payload.clips, key;
            if (!clips || "object" != typeof clips) return false;
            for (key in clips) {
                if (!Object.prototype.hasOwnProperty.call(clips, key)) continue;
                var clip = self.read(clips[key]);
                if (clip) self.sharedMap[key] = clip;
            }
            return true;
        };
        if (!window.fetch) return done && done(false);
        try {
            window.fetch(EV52.dataUrl, {
                cache: "no-cache"
            }).then(function(r) {
                return r && r.ok ? r.json() : null;
            }).then(function(payload) {
                done && done(!!self.applyShared(payload));
            }, function() {
                done && done(false);
            });
        } catch (e) {
            done && done(false);
        }
    },
    _open: function(cb) {
        var self = this;
        if (2 === this._dbOpen) return cb && cb(this._db);
        this._dbWait.push(cb);
        if (1 === this._dbOpen) return;
        this._dbOpen = 1;
        function flush(database) {
            var wait = self._dbWait;
            self._dbWait = [];
            self._db = database || null;
            self._dbOpen = 2;
            for (var i = 0; i < wait.length; i++) try {
                wait[i] && wait[i](self._db);
            } catch (e) {}
        }
        try {
            if (!window.indexedDB) return flush(null);
            var request = window.indexedDB.open(EV52.dbName, 1);
            request.onupgradeneeded = function(event) {
                try {
                    var database = event.target.result;
                    if (!database.objectStoreNames.contains(EV52.store)) database.createObjectStore(EV52.store, {
                        keyPath: "key"
                    });
                } catch (e) {}
            };
            request.onsuccess = function(event) {
                flush(event.target.result);
            };
            request.onerror = function() {
                flush(null);
            };
        } catch (e) {
            flush(null);
        }
    },
    idbGet: function(key, cb) {
        this._open(function(database) {
            if (!database) return cb && cb("");
            try {
                var r = database.transaction(EV52.store, "readonly").objectStore(EV52.store).get(key);
                r.onsuccess = function(event) {
                    cb && cb(event.target.result && String(event.target.result.dataUrl) || "");
                };
                r.onerror = function() {
                    cb && cb("");
                };
            } catch (e) {
                cb && cb("");
            }
        });
    },
    idbPut: function(record, cb) {
        this._open(function(database) {
            if (!database) return cb && cb(false);
            try {
                var r = database.transaction(EV52.store, "readwrite").objectStore(EV52.store).put(record);
                r.onsuccess = function() {
                    cb && cb(true);
                };
                r.onerror = function() {
                    cb && cb(false);
                };
            } catch (e) {
                cb && cb(false);
            }
        });
    },
    idbAll: function(cb) {
        var rows = [];
        this._open(function(database) {
            if (!database) return cb && cb(rows);
            try {
                var r = database.transaction(EV52.store, "readonly").objectStore(EV52.store).openCursor();
                r.onsuccess = function(event) {
                    var cursor = event.target.result;
                    if (!cursor) return cb && cb(rows);
                    rows.push(cursor.value);
                    cursor.continue();
                };
                r.onerror = function() {
                    cb && cb(rows);
                };
            } catch (e) {
                cb && cb(rows);
            }
        });
    },
    cacheUrl: function(key) {
        var origin = "";
        try {
            origin = String(window.location.origin || "");
        } catch (e) {}
        return /^https?:\/\//i.test(origin) ? origin + EV52.cachePrefix + key : EV52.cachePrefix + key;
    },
    cacheGet: function(key, cb) {
        var self = this;
        try {
            if (!window.caches || !window.caches.open) return cb && cb("");
            window.caches.open(EV52.cache).then(function(cache) {
                return cache.match(self.cacheUrl(key));
            }).then(function(response) {
                if (!response) return cb && cb("");
                return response.arrayBuffer().then(function(buffer) {
                    cb && cb(evDataUrl(new Uint8Array(buffer)));
                });
            }, function() {
                cb && cb("");
            });
        } catch (e) {
            cb && cb("");
        }
    },
    cachePut: function(key, blob, cb) {
        var self = this;
        try {
            if (!blob || !window.caches || !window.caches.open) return cb && cb(false);
            window.caches.open(EV52.cache).then(function(cache) {
                return cache.put(new Request(self.cacheUrl(key)), new Response(blob, {
                    headers: {
                        "Content-Type": "audio/mpeg"
                    }
                }));
            }).then(function() {
                cb && cb(true);
            }, function() {
                cb && cb(false);
            });
        } catch (e) {
            cb && cb(false);
        }
    },
    readLocal: function(key, cb) {
        var self = this;
        if (this.memMap[key]) return cb && cb(this.memMap[key]);
        this.idbGet(key, function(found) {
            if (found) {
                self.memMap[key] = found;
                self.stats.localHits++;
                return cb && cb(found);
            }
            self.cacheGet(key, function(cached) {
                if (cached) {
                    self.memMap[key] = cached;
                    self.stats.localHits++;
                }
                cb && cb(cached || "");
            });
        });
    },
    storeClip: function(key, text, dataUrl, meta) {
        var record = {
            key: key,
            text: String(text || ""),
            voiceId: meta && meta.voiceId || this.voiceId(),
            modelId: meta && meta.modelId || this.modelId(),
            dataUrl: dataUrl,
            ts: Date.now()
        };
        this.memMap[key] = dataUrl;
        this.metaMap[key] = record;
        this.idbPut(record);
        this.cachePut(key, evBlob(dataUrl));
        return record;
    },
    generate: function(text, cb) {
        var self = this, spoken = this.normalize(text), key = this.keyFor(spoken), apiKey = this.apiKey();
        if (!spoken) return cb && cb("empty", ""), false;
        if (!apiKey) return cb && cb("nokey", ""), false;
        if (this.inflight[key]) {
            this.inflight[key].push(cb);
            return true;
        }
        this.inflight[key] = [ cb ];
        function finish(err, dataUrl) {
            var wait = self.inflight[key] || [], i;
            delete self.inflight[key];
            for (i = 0; i < wait.length; i++) try {
                wait[i] && wait[i](err, dataUrl);
            } catch (e) {}
        }
        if (!window.fetch) return finish("nofetch", ""), false;
        try {
            window.fetch(EV52.endpoint + this.voiceId() + EV52.query, {
                method: "POST",
                headers: {
                    "xi-api-key": apiKey,
                    "Content-Type": "application/json",
                    Accept: "audio/mpeg"
                },
                body: JSON.stringify({
                    text: spoken,
                    model_id: this.modelId(),
                    voice_settings: {
                        stability: EV52.settings.stability,
                        similarity_boost: EV52.settings.similarity_boost,
                        style: EV52.settings.style,
                        use_speaker_boost: EV52.settings.use_speaker_boost
                    }
                })
            }).then(function(response) {
                if (!response || !response.ok) throw new Error("elevenlabs " + (response ? response.status : "offline"));
                return response.arrayBuffer();
            }).then(function(buffer) {
                var dataUrl = evDataUrl(new Uint8Array(buffer));
                if (!dataUrl) throw new Error("empty clip");
                self.storeClip(key, spoken, dataUrl);
                self.stats.generatedCount++;
                self.stats.characters += spoken.length;
                self.stats.creditsSaved += spoken.length * self.creditRate();
                finish(null, dataUrl);
            }).then(null, function() {
                self.stats.failures++;
                finish("error", "");
            });
        } catch (e) {
            finish("error", "");
        }
        return true;
    },
    resolve: function(text, cb) {
        var self = this, spoken = this.normalize(text), key = this.keyFor(spoken), known = "";
        if (!spoken) return cb && cb("empty", "");
        known = this.read(this.sharedMap[key]) || this.read(this.memMap[key]);
        if (known) {
            this.stats.sharedHits++;
            return cb && cb(null, known);
        }
        this.readLocal(key, function(local) {
            if (local) return cb && cb(null, local);
            if (!self.apiKey()) return cb && cb("nokey", "");
            self.generate(spoken, cb);
        });
    },
    playClip: function(dataUrl, text, token, cb, rate) {
        if ("function" != typeof Speech._playUrl) return cb && cb(false), false;
        Speech._playUrl(dataUrl, text, "en", token, cb, rate || 1);
        return true;
    },
    speakText: function(text, lang, token, cb, rate, fallback) {
        var self = this, spoken = this.normalize(text), clip = "";
        if (!spoken || "si" === lang) return false;
        clip = this.syncClip(spoken);
        if (clip) {
            this.stats.sharedHits++;
            this.playClip(clip, spoken, token, cb, rate);
            return true;
        }
        if (!this.apiKey()) return false;
        this.resolve(spoken, function(err, dataUrl) {
            if (token !== Speech._seqToken) return cb && cb(false);
            if (dataUrl) return self.playClip(dataUrl, spoken, token, cb, rate);
            if ("function" == typeof fallback) fallback();
            else cb && cb(false);
        });
        return true;
    },
    spellingText: function(word) {
        var clean = String(word || "").toLowerCase().replace(/[^a-z]/g, ""), names = Speech.letterNames || {}, out = [], i;
        if (!clean) return "";
        for (i = 0; i < clean.length; i++) out.push(names[clean.charAt(i)] || clean.charAt(i));
        return out.join(", ") + ". " + clean;
    },
    planTexts: function(kind) {
        var texts = [], words = [], self = this, i, guide;
        function add(value) {
            var spoken = self.normalize(value);
            if (spoken && texts.indexOf(spoken) < 0) texts.push(spoken);
        }
        try {
            var list = Lib.current();
            words = list && list.words || [];
        } catch (e) {
            words = [];
        }
        if (!words.length) try {
            words = DB.data.lists[0] && DB.data.lists[0].words || [];
        } catch (e) {}
        add("Three.");
        add("Two.");
        add("One.");
        add(Speech.instructionPhrase("paper"));
        add(Speech.instructionPhrase("type"));
        add("Sound check. Number 1.");
        add("Session paused.");
        add("Welcome back. Continuing dictation number 1.");
        add("Dictation complete. Well done. Review all thirty words below");
        for (i = 1; i <= words.length; i++) add("Number " + i);
        for (i = 0; i < words.length; i++) {
            add(words[i] && (words[i].w || words[i]));
            if ("full" !== kind) continue;
            add(words[i] && (words[i].s || words[i].ex));
            add(self.spellingText(words[i] && words[i].w));
        }
        if ("full" === kind) try {
            guide = (typeof GUIDE !== "undefined" && GUIDE && GUIDE.en) || [];
            for (i = 0; i < guide.length; i++) add("string" == typeof guide[i] ? guide[i] : guide[i] && (guide[i].text || guide[i].t));
        } catch (e) {}
        return texts;
    },
    estimate: function(texts) {
        var i, missing = [], cached = 0, characters = 0;
        for (i = 0; i < texts.length; i++) if (this.syncClip(texts[i])) cached++;
        else {
            missing.push(texts[i]);
            characters += texts[i].length;
        }
        return {
            total: texts.length,
            cached: cached,
            missing: missing,
            characters: characters,
            credits: characters * this.creditRate()
        };
    },
    generateBatch: function(texts, progress, done) {
        var self = this, plan = this.estimate(texts), i = 0, made = 0, failed = 0;
        function report() {
            progress && progress("Checking Vault… " + plan.cached + " cached (0 credits), generating " + plan.missing.length + " new clips… [" + Math.min(i, plan.missing.length) + "/" + plan.missing.length + "]", i, plan);
        }
        function step() {
            if (i >= plan.missing.length) {
                report();
                done && done({
                    generated: made,
                    failed: failed,
                    cached: plan.cached,
                    characters: plan.characters
                });
                return;
            }
            var spoken = plan.missing[i];
            i++;
            report();
            self.generate(spoken, function(err) {
                if (err) failed++;
                else made++;
                step();
            });
        }
        report();
        step();
        return plan;
    },
    allClips: function(cb) {
        var self = this, out = {}, k;
        function merge(map) {
            for (var key in map) if (map[key]) {
                var clip = self.read(map[key]);
                if (clip) out[key] = clip;
            }
        }
        merge(this.sharedMap);
        merge(this.memMap);
        this.idbAll(function(rows) {
            for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].key && rows[i].dataUrl && !out[rows[i].key]) out[rows[i].key] = rows[i].dataUrl;
            cb && cb(out);
        });
    },
    exportPayload: function(cb) {
        var self = this;
        this.allClips(function(clips) {
            var payload = {
                version: 52,
                appVersion: "5.8.0",
                voiceId: self.voiceId(),
                modelId: self.modelId(),
                generatedAt: new Date().toISOString(),
                clips: {}
            }, key;
            for (key in clips) if (clips[key]) payload.clips[key] = {
                text: self.metaMap[key] && self.metaMap[key].text || "",
                voiceId: self.metaMap[key] && self.metaMap[key].voiceId || self.voiceId(),
                modelId: self.metaMap[key] && self.metaMap[key].modelId || self.modelId(),
                audio: clips[key]
            };
            cb && cb(payload);
        });
    },
    exportJson: function(cb) {
        this.exportPayload(function(payload) {
            var link, url;
            cb && cb(payload);
            try {
                url = URL.createObjectURL(new Blob([ JSON.stringify(payload, null, 2) ], {
                    type: "application/json"
                }));
                link = document.createElement("a");
                link.href = url;
                link.download = "elevenlabs-audio.json";
                link.style.display = "none";
                (document.body || document.documentElement).appendChild(link);
                link.click();
                setTimeout(function() {
                    try {
                        URL.revokeObjectURL(url);
                        link.parentNode && link.parentNode.removeChild(link);
                    } catch (e) {}
                }, 1500);
            } catch (e) {}
        });
        return true;
    },
    importPayload: function(payload, cb) {
        var clips = payload && payload.clips, key, count = 0;
        if (!clips || "object" != typeof clips) return cb && cb(0), 0;
        for (key in clips) {
            var clip = this.read(clips[key]);
            if (!clip) continue;
            this.sharedMap[key] = clip;
            this.storeClip(key, clips[key] && clips[key].text, clip, clips[key]);
            count++;
        }
        cb && cb(count);
        return count;
    },
    voiceName: function() {
        var id = this.voiceId(), i;
        for (i = 0; i < EV52.voices.length; i++) if (EV52.voices[i].id === id) return EV52.voices[i].name;
        return "Custom";
    },
    verifyKey: function(key, cb) {
        var apiKey = String(key || this.apiKey() || "");
        if (!apiKey) return cb && cb("nokey", null), false;
        if (!window.fetch) return cb && cb("nofetch", null), false;
        try {
            window.fetch(EV52.subscription, {
                headers: {
                    "xi-api-key": apiKey
                }
            }).then(function(response) {
                return response && response.ok ? response.json() : null;
            }).then(function(data) {
                if (!data) return cb && cb("error", null);
                var limit = Number(data.character_limit) || 1e4, used = Number(data.character_count) || 0;
                cb && cb(null, {
                    tier: String(data.tier || "free"),
                    used: used,
                    limit: limit,
                    remaining: Math.max(0, limit - used)
                });
            }, function() {
                cb && cb("error", null);
            });
        } catch (e) {
            cb && cb("error", null);
        }
        return true;
    },
    statusText: function(info) {
        var tier = info && info.tier || "free", limit = info && info.limit || 1e4, remaining = void 0 === (info && info.remaining) ? Math.max(0, limit - (info && info.used || 0)) : info.remaining;
        return "✓ Connected · Tier: " + tier.charAt(0).toUpperCase() + tier.slice(1) + " · Remaining Credits: " + evFmt(remaining) + " / " + evFmt(limit) + " · Vault Clips Cached: " + this.clipCount();
    },
    boot: function() {
        try {
            var settings = this._set();
            settings.elevenLabsKey = settings.elevenLabsKey || "";
            settings.elevenLabsVoiceId = settings.elevenLabsVoiceId || EV52.voiceId;
            settings.elevenLabsModelId = settings.elevenLabsModelId || EV52.modelId;
        } catch (e) {}
        this.loadShared(function() {});
        this._open(function() {});
        return this;
    }
};

window.ElevenVault = ElevenVault;
window.EV52 = EV52;
Speech.hashText = evHash;
Speech.elevenVault = ElevenVault;

/* Single voice pipeline: vault clip first, one-time ElevenLabs generation, then
   the classic British studio stream. */
(function() {
    var legacyText = Speech._playText, legacyWord = Speech.playWord;
    Speech._legacyPlayText = legacyText;
    Speech._legacyPlayWord = legacyWord;
    Speech._playText = function(text, lang, token, cb, rate) {
        var self = this, handled = false;
        try {
            handled = ElevenVault.speakText(text, "si" === lang ? "si" : "en", token, cb, rate || 1, function() {
                legacyText.call(self, text, lang, token, cb, rate);
            });
        } catch (e) {
            handled = false;
        }
        if (!handled) legacyText.call(this, text, lang, token, cb, rate);
    };
    Speech.playWord = function(word, rate, cb) {
        var self = this, clean = this.cleanWordOnly(word), token = this._seqToken, handled = false;
        if (!clean) return cb && cb(false), token;
        try {
            handled = ElevenVault.speakText(clean, "en", token, cb, rate || this.desiredRate || 1, function() {
                legacyWord.call(self, clean, rate, cb);
            });
        } catch (e) {
            handled = false;
        }
        return handled ? token : legacyWord.call(this, clean, rate, cb);
    };
})();

/* SECTION 53 - ADMIN ONE-CLICK WORD AUTO-COMPLETER */
var WEEK_52 = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];

var AdminAutoEnrich = {
    status: "",
    lastWords: [],
    parse: function(text) {
        var raw = String(text || "").split(/[\n,;|]+/), out = [], seen = {}, i, word;
        for (i = 0; i < raw.length; i++) {
            word = evTrim(raw[i]).replace(/^[0-9]+[.)\-\s]*/, "").replace(/[.?!:]+$/, "").toLowerCase();
            if (!word || !/^[a-z][a-z' \-]*$/.test(word) || seen[word]) continue;
            seen[word] = 1;
            out.push(word);
        }
        return out;
    },
    lexicon: function(word) {
        var wanted = String(word || "").toLowerCase(), i, j, groups = [], entry, value;
        for (i = 0; i < SAMPLE_WORDS.length; i++) if (String(SAMPLE_WORDS[i].w || "").toLowerCase() === wanted) return SAMPLE_WORDS[i];
        try {
            groups = (DB.data.lists || []).concat(DB.data.pastSessions || []);
        } catch (e) {
            groups = [];
        }
        for (i = 0; i < groups.length; i++) {
            entry = groups[i] && groups[i].words || [];
            for (j = 0; j < entry.length; j++) {
                value = entry[j];
                if (value && String(value.w || "").toLowerCase() === wanted) return value;
            }
        }
        value = wanted.replace(/[^a-z' \-]/g, "");
        return WORD_BANK && WORD_BANK[value] || null;
    },
    sentenceFor: function(word, pos) {
        var lower = String(word || "").toLowerCase(), kind = String(pos || "").toLowerCase();
        if (/verb/.test(kind)) return "She decided to " + lower + " before the end of the lesson.";
        if (/adverb/.test(kind)) return "He finished the dictation " + lower + " and checked every word.";
        if (/noun/.test(kind)) return "The lecturer wrote the word " + lower + " on the whiteboard.";
        if (/adject/.test(kind)) return "Everyone felt " + lower + " after the long journey to Galle.";
        return "Our English class used the word \"" + lower + "\" in a short sentence today.";
    },
    sinhala: function(word, cb) {
        var fallback = "", entry = null;
        try {
            entry = this.lexicon(word);
        } catch (e) {}
        fallback = entry && (entry.si || "") || "";
        if (!window.fetch) return cb && cb(fallback);
        try {
            window.fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=si&dt=t&q=" + encodeURIComponent(word)).then(function(response) {
                return response && response.ok ? response.json() : null;
            }).then(function(data) {
                cb && cb(evTrim(data && data[0] && data[0][0] && data[0][0][0]) || fallback);
            }).then(null, function() {
                cb && cb(fallback);
            });
        } catch (e) {
            cb && cb(fallback);
        }
    },
    english: function(word, cb) {
        var entry = null;
        try {
            entry = this.lexicon(word);
        } catch (e) {}
        var base = {
            ipa: entry && (entry.p || entry.ipa) || "",
            meaning: entry && (entry.d || entry.m) || "",
            example: entry && entry.s || "",
            pos: entry && entry.t || ""
        };
        if (!window.fetch || "undefined" == typeof Dict || !Dict.lookup) return cb && cb(base);
        try {
            Dict.lookup(word, function(found) {
                cb && cb(found ? {
                    ipa: base.ipa || found.ipa || "",
                    meaning: base.meaning || found.meaning || "",
                    example: base.example || found.example || "",
                    pos: base.pos || found.pos || ""
                } : base);
            });
        } catch (e) {
            cb && cb(base);
        }
    },
    enrich: function(word, cb) {
        var self = this, plain = evTrim(word).toLowerCase();
        this.english(plain, function(english) {
            self.sinhala(plain, function(sinhala) {
                var meaning = evTrim(english.meaning) || "a B1 word you can use in your own sentence: " + plain, example = evTrim(english.example) || self.sentenceFor(plain, english.pos);
                cb && cb({
                    w: plain,
                    p: evTrim(english.ipa).replace(/^\/+|\/+$/g, ""),
                    d: meaning,
                    m: sinhala || meaning,
                    si: sinhala || "",
                    s: example,
                    ex: example,
                    t: english.pos || "",
                    def: meaning
                });
            });
        });
    },
    enrichAll: function(text, progress, cb) {
        var self = this, words = this.parse(text), out = [], i = 0;
        function step() {
            if (i >= words.length) return cb && cb(out);
            var word = words[i++];
            progress && progress("Completing " + i + "/" + words.length + " · " + word + "…");
            self.enrich(word, function(entry) {
                out.push(entry);
                step();
            });
        }
        step();
        return words;
    },
    archiveCurrent: function() {
        var data = DB.data, list = null, archived, i;
        try {
            list = Lib.current();
        } catch (e) {}
        if (!list || !list.words || !list.words.length) return null;
        archived = {
            no: data.session && data.session.no || "",
            day: data.session && data.session.day || "",
            date: data.session && data.session.date || U.dateKey(new Date()),
            title: list.name,
            listName: list.name,
            listId: list.id,
            archived: true,
            words: list.words.map(function(entry) {
                return wordRow(entry);
            })
        };
        data.pastSessions = data.pastSessions || [];
        for (i = 0; i < data.pastSessions.length; i++) if (data.pastSessions[i] && data.pastSessions[i].listId === archived.listId && data.pastSessions[i].date === archived.date) return archived;
        data.pastSessions.unshift(archived);
        if (data.pastSessions.length > 40) data.pastSessions.length = 40;
        return archived;
    },
    publish: function(words, meta, cb) {
        var data = DB.data, info = meta || {}, title = evTrim(info.title) || "Session " + (info.no || data.session.no || "1") + " words", picked = U.validDate(info.date), date = picked ? U.dateKey(picked) : U.dateKey(new Date()), stamp = new Date(date + "T12:00:00"), list = null;
        if (!words || !words.length) return cb && cb(null), null;
        this.archiveCurrent();
        list = {
            id: U.uid("list"),
            name: title,
            words: words,
            version: 1,
            published: false,
            draft: true,
            updatedAt: Date.now()
        };
        data.lists.push(list);
        data.plan = data.plan || {
            weekdays: [],
            dates: {},
            pinned: "",
            defaultList: ""
        };
        data.plan.dates = data.plan.dates || {};
        data.plan.dates[date] = list.id;
        data.plan.pinned = list.id;
        data.plan.defaultList = data.plan.defaultList || list.id;
        data.session.no = evTrim(info.no) || data.session.no || "1";
        data.session.title = title;
        data.session.date = date;
        if (isFinite(stamp.getTime())) data.session.day = WEEK_52[U.weekdayIndex(stamp)] || data.session.day;
        data.session.listId = list.id;
        data.session.ready = [];
        try {
            Admin.publish(list, true);
        } catch (e) {}
        if (!list.published) {
            list.published = true;
            list.draft = false;
            list.version = (list.version || 1) + 1;
            list.updatedAt = Date.now();
            list.publishedWords = list.words.map(function(entry) {
                return wordRow(entry);
            });
            list.publishedName = list.name;
            list.publishedVersion = list.version;
            data.sessions = data.sessions || [];
            data.sessions.unshift({
                no: data.session.no || "",
                day: data.session.day || "",
                date: date,
                title: title,
                listId: list.id,
                listName: title,
                version: list.version,
                words: list.publishedWords
            });
            if (data.sessions.length > 10) data.sessions.length = 10;
        }
        DB.saveNow();
        try {
            Screens.home();
        } catch (e) {}
        cb && cb(list);
        return list;
    },
    run: function(wordsText, meta, progress, cb) {
        var self = this, report = progress || function() {};
        report("Reading the words you typed…");
        this.enrichAll(wordsText, report, function(words) {
            if (!words.length) return cb && cb({
                ok: false,
                words: []
            });
            report("Publishing " + words.length + " words as a new session…");
            self.publish(words, meta, function(list) {
                self.lastWords = words;
                self.status = "✓ " + words.length + " words completed · IPA, definition, Sinhala meaning & sentence filled · Session published";
                if (!ElevenVault.hasKey()) return cb && cb({
                    ok: true,
                    words: words,
                    list: list,
                    audio: null
                });
                var texts = [], i;
                for (i = 0; i < words.length; i++) texts.push(words[i].w);
                ElevenVault.generateBatch(texts, report, function(result) {
                    cb && cb({
                        ok: true,
                        words: words,
                        list: list,
                        audio: result
                    });
                });
            });
        });
        return true;
    }
};

window.AdminAutoEnrich = AdminAutoEnrich;

/* SECTION 54 - ADMIN STUDIO CARDS */
(function() {
    var cardCount = 0;

    function node(tag, cls, text) {
        var element = U.el(tag, cls || null, null);
        if (void 0 !== text && null !== text) element.textContent = text;
        return element;
    }

    function make(tag, id, cls, text) {
        var element = node(tag, cls, text);
        element.id = id;
        return element;
    }

    function field(label, control) {
        var wrap = node("label", "field");
        wrap.appendChild(node("span", "lbl", label));
        wrap.appendChild(control);
        return wrap;
    }

    function button(id, label, cls) {
        var element = node("button", "btn " + cls, label);
        element.id = id;
        element.type = "button";
        return element;
    }

    function setText(target, text, good) {
        if (!target) return;
        target.textContent = text;
        if (good) U.setCls(target, "good", true);
    }

    function studio(host) {
        var card = Admin.card(host, "🎙️ ElevenLabs Studio Voice Plugin & Credit Manager"), inner = card, badge, keyInput, voiceSelect, customVoice, modelSelect, progress, importInput, row, row2, row3, i, option, customOption, known = false;
        inner.appendChild(node("p", "tiny muted", "One single British English woman professor voice for the whole app (guide, countdown, numbers, words, sentences, spellings, resume). Every clip is generated only ONE time ever, then replayed from the local vault for 0 credits."));
        badge = make("p", "elCreditBadge", "chip good");
        badge.setAttribute("role", "status");
        badge.style.margin = "6px 0 10px";
        inner.appendChild(badge);
        keyInput = make("input", "elApiKeyInput");
        keyInput.type = "password";
        keyInput.autocomplete = "off";
        keyInput.spellcheck = false;
        keyInput.setAttribute("aria-label", "ElevenLabs API key");
        keyInput.placeholder = "Paste your ElevenLabs API key (xi-api-key)";
        keyInput.value = ElevenVault.apiKey();
        inner.appendChild(field("ElevenLabs API key (this device only)", keyInput));
        row = node("div", "btn-row tight");
        row.style.marginTop = "8px";
        row.appendChild((function() {
            var toggle = button("btnElToggleKey", "👁 Show/Hide", "sm soft");
            U.on(toggle, "click", function() {
                keyInput.type = "password" === keyInput.type ? "text" : "password";
            });
            return toggle;
        })());
        row.appendChild((function() {
            var verify = button("btnElVerify", "💾 Save & Verify Key", "primary");
            U.on(verify, "click", function() {
                var key = evTrim(keyInput.value);
                if (!key) return setText(badge, "Please paste your ElevenLabs API key first.", false);
                ElevenVault.setApiKey(key);
                setText(badge, "Verifying your key with ElevenLabs…");
                ElevenVault.verifyKey(key, function(err, info) {
                    if (err || !info) return setText(badge, "Key saved. Live verification needs internet — clips still generate when online.", false);
                    setText(badge, ElevenVault.statusText(info), true);
                    UI.toast("ElevenLabs connected · " + evFmt(info.remaining) + " credits left", {
                        icon: "i-check"
                    });
                });
            });
            return verify;
        })());
        inner.appendChild(row);
        voiceSelect = make("select", "elVoiceSelect");
        voiceSelect.setAttribute("aria-label", "ElevenLabs studio voice");
        for (i = 0; i < EV52.voices.length; i++) {
            option = node("option", null, EV52.voices[i].label);
            option.value = EV52.voices[i].id;
            if (EV52.voices[i].id === ElevenVault.voiceId()) {
                option.selected = true;
                known = true;
            }
            voiceSelect.appendChild(option);
        }
        customOption = node("option", null, "Custom Voice ID (type below)");
        customOption.value = "__custom__";
        if (!known) customOption.selected = true;
        voiceSelect.appendChild(customOption);
        U.on(voiceSelect, "change", function() {
            if ("__custom__" === voiceSelect.value) return;
            ElevenVault.setVoiceId(voiceSelect.value);
            setText(badge, ElevenVault.statusText(), true);
        });
        inner.appendChild(field("Studio voice (25–35 British English woman)", voiceSelect));
        customVoice = make("input", "elVoiceCustom");
        customVoice.type = "text";
        customVoice.placeholder = "Custom ElevenLabs Voice ID (optional)";
        U.on(customVoice, "change", function() {
            if (evTrim(customVoice.value)) ElevenVault.setVoiceId(evTrim(customVoice.value));
        });
        inner.appendChild(customVoice);
        modelSelect = make("select", "elModelSelect");
        modelSelect.setAttribute("aria-label", "ElevenLabs model");
        for (i = 0; i < EV52.models.length; i++) {
            option = node("option", null, EV52.models[i].name);
            option.value = EV52.models[i].id;
            if (EV52.models[i].id === ElevenVault.modelId()) option.selected = true;
            modelSelect.appendChild(option);
        }
        U.on(modelSelect, "change", function() {
            ElevenVault.setModelId(modelSelect.value);
        });
        inner.appendChild(field("Studio model", modelSelect));
        progress = make("p", "elGenProgress", "tiny muted");
        progress.setAttribute("role", "status");
        progress.textContent = "Vault: " + ElevenVault.clipCount() + " clips cached · replaying them needs 0 credits.";
        inner.appendChild(progress);
        function runBatch(kind) {
            var texts = ElevenVault.planTexts(kind), plan = ElevenVault.estimate(texts);
            if (!ElevenVault.hasKey()) return setText(progress, "Save & verify your ElevenLabs API key first — clips already in the vault still play for free.", false);
            progress.textContent = "Checking Vault… " + plan.cached + " cached (0 credits), generating " + plan.missing.length + " new clips… Estimated cost: " + evFmt(plan.characters) + " characters ≈ " + Math.round(plan.credits) + " credits. [0/" + plan.missing.length + "]";
            ElevenVault.generateBatch(texts, function(text) {
                progress.textContent = text;
            }, function(result) {
                setText(progress, "✓ Vault complete · " + result.generated + " new clips, " + result.cached + " reused (0 credits)" + (result.failed ? " · " + result.failed + " failed" : "") + " · " + ElevenVault.clipCount() + " clips cached", true);
                setText(badge, ElevenVault.statusText(), true);
            });
        }
        row2 = node("div", "btn-row tight");
        row2.style.marginTop = "10px";
        row2.appendChild((function() {
            var missing = button("btnElGenerateAll", "⚡ Generate Missing Session Clips Once (Skip Cached)", "primary block");
            U.on(missing, "click", function() {
                runBatch("session");
            });
            return missing;
        })());
        row2.appendChild((function() {
            var pack = button("btnElGeneratePack", "📦 Generate Full Pack (Words + Numbers + Sentences + Spellings + Guide)", "soft block");
            U.on(pack, "click", function() {
                runBatch("full");
            });
            return pack;
        })());
        inner.appendChild(row2);
        row3 = node("div", "btn-row tight");
        row3.style.marginTop = "8px";
        importInput = make("input", "elImportFile");
        importInput.type = "file";
        importInput.accept = "application/json,.json";
        importInput.style.display = "none";
        row3.appendChild((function() {
            var exportButton = button("btnElExportJson", "📥 Download data/elevenlabs-audio.json (Share Voice Pack to GitHub)", "soft block");
            U.on(exportButton, "click", function() {
                ElevenVault.exportJson(function(payload) {
                    setText(progress, "✓ Exported " + Object.keys(payload.clips || {}).length + " clips · commit the file to data/elevenlabs-audio.json so every student gets the voice pack with 0 API calls.", true);
                });
            });
            return exportButton;
        })());
        row3.appendChild((function() {
            var importButton = button("btnElImportJson", "📤 Import a Voice Pack JSON", "soft block");
            U.on(importButton, "click", function() {
                importInput.click();
            });
            return importButton;
        })());
        U.on(importInput, "change", function() {
            var file = importInput.files && importInput.files[0], reader;
            if (!file || !window.FileReader) return;
            reader = new FileReader();
            reader.onload = function() {
                var payload = null;
                try {
                    payload = JSON.parse(String(reader.result || "{}"));
                } catch (e) {}
                if (!payload) return setText(progress, "That file is not a valid voice pack.", false);
                ElevenVault.importPayload(payload, function(count) {
                    setText(progress, "✓ Imported " + count + " clips (" + ElevenVault.clipCount() + " cached).", true);
                    setText(badge, ElevenVault.statusText(), true);
                });
            };
            reader.readAsText(file);
        });
        row3.appendChild(importInput);
        inner.appendChild(row3);
        inner.appendChild(make("p", "elVaultStats", "tiny muted", "Voice: " + ElevenVault.voiceName() + " · " + ElevenVault.modelId() + " · " + ElevenVault.creditRate() + " credit per character · vault clips are never paid for twice."));
        setText(badge, "Vault ready · " + ElevenVault.clipCount() + " clips cached", true);
        return card;
    }

    function quickWords(host) {
        var card = Admin.card(host, "✨ Quick Dictation Words Input (Type Only Words — Auto-Completes Everything!)"), inner = card, title, date, words, status, go;
        inner.appendChild(node("p", "tiny muted", "Type or paste only the dictation words (commas or new lines). IPA, English definition, Sinhala meaning, example sentence and the published session are completed automatically, and the previous session is archived."));
        title = make("input", "adminQuickSessionTitle");
        title.type = "text";
        title.placeholder = "Session title (for example: Session 9 — Work & Money)";
        inner.appendChild(field("Session title (optional)", title));
        date = make("input", "adminQuickSessionDate");
        date.type = "date";
        try {
            date.value = DB.data.session && DB.data.session.date || U.dateKey(new Date());
        } catch (e) {}
        inner.appendChild(field("Session date (optional)", date));
        words = make("textarea", "adminQuickWordsInput");
        words.placeholder = "afraid, amazed, amusing, annoyed, anxious, ashamed…";
        words.style.minHeight = "150px";
        words.style.fontFamily = "ui-monospace, Menlo, Consolas, monospace";
        words.style.fontSize = "16px";
        words.setAttribute("aria-label", "Dictation words");
        inner.appendChild(field("Dictation words (type only words)", words));
        status = make("p", "adminQuickStatus", "small", AdminAutoEnrich.status || "Type only the words — everything else is automatic.");
        status.setAttribute("role", "status");
        inner.appendChild(status);
        go = button("btnAdminAutoComplete", "✨ Auto-Complete IPA, Meanings, Sentences & Publish Session", "primary block xl");
        go.style.marginTop = "8px";
        U.on(go, "click", function() {
            var text = evTrim(words.value);
            if (!text) return setText(status, "Please type at least one dictation word first.", false);
            go.disabled = true;
            setText(status, "Working through your words…");
            AdminAutoEnrich.run(text, {
                title: evTrim(title.value),
                date: evTrim(date.value),
                no: String((parseInt(String(DB.data.session && DB.data.session.no || "1").replace(/[^0-9]/g, ""), 10) || 1) + 1)
            }, function(message) {
                setText(status, message);
            }, function(result) {
                go.disabled = false;
                if (!result || !result.ok) return setText(status, "No readable words were found. Use commas or new lines with plain English words.", false);
                setText(status, AdminAutoEnrich.status + (result.audio ? " · " + result.audio.generated + " ElevenLabs clips generated" : ""), true);
                UI.toast("Session published · " + result.words.length + " words completed", {
                    icon: "i-check"
                });
                try {
                    Admin.renderTab();
                } catch (e) {}
            });
        });
        inner.appendChild(go);
        return card;
    }

    var baseRenderTab = Admin.renderTab;
    Admin.renderTab = function(host) {
        var done = null, target = host || U.$("#adminHost");
        try {
            done = baseRenderTab.apply(this, arguments);
        } catch (err) {
            try {
                Errors.report(err, "admin tab");
            } catch (e) {}
        }
        if (target) try {
            studio(target).id = "elStudioCard";
            quickWords(target).id = "elQuickWordsCard";
            cardCount++;
        } catch (err) {
            try {
                Errors.report(err, "elevenlabs admin card");
            } catch (e) {}
        }
        return done;
    };
    Admin.studioCardsRendered = function() {
        return cardCount;
    };
    Admin.openStudio = function() {
        if (!this.unlocked) return false;
        this.panel();
        return true;
    };
})();

/* SECTION 55 - v52 STORAGE MIGRATION (keeps every existing student device) */
(function() {
    var baseMigrate = DB.migrate;
    DB.resetToV52 = function(data) {
        var out = data || {};
        out.settings = out.settings || {};
        out.settings.elevenLabsKey = out.settings.elevenLabsKey || "";
        out.settings.elevenLabsVoiceId = out.settings.elevenLabsVoiceId || EV52.voiceId;
        out.settings.elevenLabsModelId = out.settings.elevenLabsModelId || EV52.modelId;
        if (!out.settings.activeVideoSrc || normalizeAssetPath(out.settings.activeVideoSrc) === normalizeAssetPath("./assets/bunny-live-wallpaper.mp4")) out.settings.activeVideoSrc = DEFAULT_WALLPAPER_SRC;
        out.settingsRev = 52;
        out.v = 52;
        return out;
    };
    DB.migrate = function(data) {
        var out = baseMigrate.call(this, data) || data;
        if (!out) return out;
        if ((Number(out.settingsRev) || 0) < 52) out = DB.resetToV52(out);
        out.settingsRev = 52;
        out.v = 52;
        return out;
    };
    CONFIG.schema = 52;
    CONFIG.settingsRev = 52;
    CONFIG.key = "sdp.v52_elevenlabs_studio";
    CONFIG.appVersion = "5.8.0";
})();
