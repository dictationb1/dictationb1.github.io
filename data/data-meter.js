/*! Smart Dictation Player — Live Network & Cost Meter (v57 / 6.3.0).
 * ES5, dependency-free. Resource Timing is measured; opaque dictionary audio
 * and complete-session profiles are explicitly labelled estimates. */
(function (global) {
  'use strict';
  var METER_VERSION = '6.3.0', SCHEMA = 57, KB = 1024, MB = KB * KB, GB = KB * MB;
  var AUDIO_ESTIMATE = 11000;
  var STORAGE = { daily: 'sdp.dataMeter.daily', allTime: 'sdp.dataMeter.allTime', price: 'sdp.dataPriceLkrPerGb', manifest: 'sdp.mediaManifest.v1' };
  var KNOWN_ASSETS = {};
  var persistedSession = 0;
  var state = {
    videoBytes: 0, audioBytes: 0, appBytes: 0, cacheSavedBytes: 0,
    estimatedAudioBytes: 0, resourceVideoBytes: 0, videoBufferedSources: {},
    archivedBytes: 0, _archivedResourceBytes: 0, sessionStart: Date.now(),
    daily: {}, allTime: 0, manifest: null, seenUrls: {}, seenEntries: {},
    trackedUrls: {}, fetchPending: {}, audioPlayTimes: {}, tickers: [],
    observer: null, interval: null, paused: false, started: false,
    hidden: !!(global.document && global.document.hidden),
    saveData: !!(global.navigator && global.navigator.connection && global.navigator.connection.saveData)
  };
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function safeGet(k) { try { return global.localStorage && global.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { if (global.localStorage) global.localStorage.setItem(k, v); } catch (e) {} }
  function nowDay() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function readDaily() { try { var o = JSON.parse(safeGet(STORAGE.daily) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  function assetName(src) { return String(src || '').split('?')[0].split('#')[0].split('/').pop(); }
  function loadManifest() {
    if (state.manifest) return state.manifest;
    try { var cached = JSON.parse(safeGet(STORAGE.manifest) || 'null'); if (cached && cached.assets) state.manifest = cached; } catch (e) {}
    if (canNetwork()) {
      try {
        global.fetch(manifestUrl(), { cache: 'no-cache' }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (m) {
          if (m && m.assets) { state.manifest = m; safeSet(STORAGE.manifest, JSON.stringify(m)); indexManifest(); }
        })['catch'](function () {});
      } catch (e) {}
    }
    indexManifest();
    return state.manifest;
  }
  function canNetwork() {
    try { return !!global.fetch && global.location.protocol !== 'file:' && !/HeadlessChrome|jsdom/i.test(global.navigator.userAgent || ''); } catch (e) { return false; }
  }
  function manifestUrl() {
    return './data/media-manifest.json';
  }
  function indexManifest() {
    var list = state.manifest && state.manifest.assets || [], i;
    KNOWN_ASSETS = {};
    for (i = 0; i < list.length; i++) if (list[i].bytes > 0) {
      KNOWN_ASSETS[list[i].src] = Number(list[i].bytes);
      KNOWN_ASSETS[list[i].file || assetName(list[i].src)] = Number(list[i].bytes);
    }
  }
  function knownBytesFor(src) {
    if (!src) return 0;
    loadManifest();
    var name = assetName(src);
    return Number(own(KNOWN_ASSETS, String(src)) ? KNOWN_ASSETS[String(src)] : own(KNOWN_ASSETS, name) ? KNOWN_ASSETS[name] : 0) || 0;
  }
  function isDictionaryAudio(url) { return /dict\.youdao\.com\/dictvoice/i.test(String(url || '')); }
  function classify(url) {
    var u = String(url || '');
    if (isDictionaryAudio(u) || /(?:^|\/)audio\//.test(u) || /\.(mp3|wav|ogg|m4a|aac|opus)(?:[?#]|$)/i.test(u)) return 'audio';
    if (/\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(u)) return 'video';
    if (/\.(jpg|jpeg|png|webp|gif|avif|svg)(?:[?#]|$)/i.test(u)) return 'app';
    if (/\/assets\//.test(u)) return 'video';
    return 'app';
  }
  function addBytes(category, bytes) {
    bytes = Math.round(Number(bytes) || 0);
    if (bytes <= 0) return;
    if (category === 'video') state.videoBytes += bytes;
    else if (category === 'audio') state.audioBytes += bytes;
    else if (category === 'cache') state.cacheSavedBytes += bytes;
    else state.appBytes += bytes;
  }
  function readEntries() { try { return global.performance && global.performance.getEntriesByType ? global.performance.getEntriesByType('resource') || [] : []; } catch (e) { return []; } }
  function recordAudioPlay(url, cached) {
    if (!isDictionaryAudio(url)) return 0;
    var now = Date.now(), last = state.audioPlayTimes[url] || 0;
    if (now - last < 300) return 0;
    state.audioPlayTimes[url] = now;
    addBytes(cached ? 'cache' : 'audio', AUDIO_ESTIMATE);
    if (!cached) state.estimatedAudioBytes += AUDIO_ESTIMATE;
    return AUDIO_ESTIMATE;
  }
  function accountEntry(entry) {
    if (!entry || !entry.name || state.paused) return;
    var url = String(entry.name), key = url + '|' + entry.startTime + '|' + entry.duration;
    if (own(state.seenEntries, key)) return;
    state.seenEntries[key] = true;
    state.seenUrls[url] = true;
    var transfer = Number(entry.transferSize) || 0, encoded = Number(entry.encodedBodySize) || 0;
    var category = classify(url), pending = state.fetchPending[url];
    if (transfer > 0) {
      if (pending && pending.length) {
        var estimate = pending.shift();
        addBytes(category, transfer - estimate);
        if (estimate > transfer) {
          if (category === 'video') state.videoBytes = Math.max(0, state.videoBytes - (estimate - transfer));
          else if (category === 'audio') state.audioBytes = Math.max(0, state.audioBytes - (estimate - transfer));
          else state.appBytes = Math.max(0, state.appBytes - (estimate - transfer));
        }
        if (!pending.length) delete state.fetchPending[url];
      } else addBytes(category, transfer);
      if (category === 'video') state.resourceVideoBytes += transfer;
      return;
    }
    if (encoded > 0) { addBytes('cache', encoded); return; }
    if (isDictionaryAudio(url)) recordAudioPlay(url, false);
    else if (Number(entry.decodedBodySize) > 0) addBytes('cache', entry.decodedBodySize);
  }
  function flushEntries() { if (state.paused) return; var entries = readEntries(), i; for (i = 0; i < entries.length; i++) accountEntry(entries[i]); }
  function videoBufferedBytes() {
    var el;
    try { el = global.document && global.document.getElementById('bgLiveVideo'); } catch (e) {}
    if (!el) return 0;
    var known = knownBytesFor(el.currentSrc || el.src || '');
    if (!known || !isFinite(el.duration) || el.duration <= 0 || !el.buffered) return 0;
    var secs = 0, i;
    try { for (i = 0; i < el.buffered.length; i++) secs += Math.max(0, el.buffered.end(i) - el.buffered.start(i)); } catch (e) { return 0; }
    var frac = Math.min(1, Math.max(0, secs / el.duration));
    return Math.round(frac * known);
  }
  function trackFetch(url, bytes, category) {
    url = String(url || ''); bytes = Math.max(0, Math.round(Number(bytes) || 0));
    if (!url || !bytes) return;
    category = category || classify(url);
    if (!state.fetchPending[url]) state.fetchPending[url] = [];
    state.fetchPending[url].push(bytes);
    state.trackedUrls[url] = bytes;
    addBytes(category, bytes);
  }
  function installObserver() {
    try {
      if (global.PerformanceObserver && !state.observer) {
        state.observer = new global.PerformanceObserver(function (list) {
          var entries = list.getEntries(), i; for (i = 0; i < entries.length; i++) accountEntry(entries[i]);
        });
        state.observer.observe({ entryTypes: ['resource'], buffered: true });
      }
      if (global.performance) {
        var previous = global.performance.onresourcetimingbufferfull;
        global.performance.onresourcetimingbufferfull = function () {
          flushEntries();
          state._archivedResourceBytes = state.videoBytes + state.audioBytes + state.appBytes;
          state.archivedBytes = state._archivedResourceBytes;
          state.seenUrls = {}; state.seenEntries = {};
          try { global.performance.clearResourceTimings(); } catch (e) {}
          if (typeof previous === 'function') try { previous(); } catch (e) {}
        };
      }
    } catch (e) {}
  }
  function installFetchHooks() {
    if (state._hooked) return;
    state._hooked = true;
    try {
      if (global.fetch) {
        var original = global.fetch;
        global.fetch = function (input) {
          var url = String(input && input.url ? input.url : input), p = original.apply(this, arguments);
          if (p && p.then) p.then(function (resp) {
            var length = 0;
            try { length = Number((resp && resp.headers && resp.headers.get && resp.headers.get('content-length')) || 0); } catch (e) {}
            if (length > 0) trackFetch(url, length, classify(url));
            else if (resp && resp.clone && resp.arrayBuffer) {
              try { resp.clone().arrayBuffer().then(function (buf) { trackFetch(url, buf && buf.byteLength, classify(url)); })['catch'](function () {}); } catch (e) {}
            }
          })['catch'](function () {});
          return p;
        };
      }
      if (global.XMLHttpRequest && !global.XMLHttpRequest._sdpPatched) {
        var open = global.XMLHttpRequest.prototype.open, send = global.XMLHttpRequest.prototype.send;
        global.XMLHttpRequest.prototype.open = function (m, u) { this._sdpUrl = u; return open.apply(this, arguments); };
        global.XMLHttpRequest.prototype.send = function () {
          var self = this;
          this.addEventListener('load', function () {
            var length = 0;
            try { length = Number(self.getResponseHeader('content-length')) || 0; } catch (e) {}
            if (!length) try { length = new Blob([self.response || self.responseText || '']).size; } catch (e) {}
            trackFetch(self._sdpUrl, length, classify(self._sdpUrl));
          });
          return send.apply(this, arguments);
        };
        global.XMLHttpRequest._sdpPatched = true;
      }
    } catch (e) {}
  }
  function sample() {
    if (state.paused) return getLive();
    flushEntries();
    var el = null, vb = videoBufferedBytes();
    try { el = global.document && global.document.getElementById('bgLiveVideo'); } catch (e) {}
    if (el && vb) { var src = assetName(el.currentSrc || el.src); state.videoBufferedSources[src] = Math.max(state.videoBufferedSources[src] || 0, vb); }
    var buffered = 0, k;
    for (k in state.videoBufferedSources) if (own(state.videoBufferedSources, k)) buffered += state.videoBufferedSources[k];
    state.videoBytes = Math.max(state.resourceVideoBytes, buffered);
    return getLive();
  }
  function computeTotals() {
    var sessionBytes = state.videoBytes + state.audioBytes + state.appBytes;
    var unpersisted = Math.max(0, sessionBytes - persistedSession);
    return { sessionBytes: sessionBytes, todayBytes: (Number(state.daily[nowDay()]) || 0) + unpersisted,
      allTimeBytes: state.allTime + unpersisted, videoBytes: state.videoBytes, audioBytes: state.audioBytes,
      appBytes: state.appBytes, cacheSavedBytes: state.cacheSavedBytes, archivedBytes: state.archivedBytes,
      estimatedAudioBytes: state.estimatedAudioBytes };
  }
  function price() { var p = Number(safeGet(STORAGE.price)); return isFinite(p) && p > 0 ? p : 150; }
  function costLkr(bytes) { return (Number(bytes) || 0) / GB * price(); }
  function formatMB(bytes) {
    var b = Math.max(0, Number(bytes) || 0);
    if (b < KB) return Math.round(b) + ' B';
    if (b < MB) return (b / KB).toFixed(1) + ' KB (' + (b / MB).toFixed(2) + ' MB)';
    return (b / MB).toFixed(2) + ' MB';
  }
  function formatBytes(bytes) { return formatMB(bytes); }
  function persistTotals() {
    var totals = computeTotals(), delta = Math.max(0, totals.sessionBytes - persistedSession);
    if (delta > 0) { var day = nowDay(); state.daily[day] = (Number(state.daily[day]) || 0) + delta; persistedSession = totals.sessionBytes; }
    state.allTime = Math.max(state.allTime || 0, (state.allTime || 0) + delta);
    safeSet(STORAGE.daily, JSON.stringify(state.daily)); safeSet(STORAGE.allTime, String(state.allTime));
  }
  function getLive() {
    var t = computeTotals();
    return { version: METER_VERSION, schema: SCHEMA, sessionBytes: t.sessionBytes, todayBytes: t.todayBytes, allTimeBytes: t.allTimeBytes,
      videoBytes: t.videoBytes, audioBytes: t.audioBytes, appBytes: t.appBytes, cacheSavedBytes: t.cacheSavedBytes,
      archivedBytes: t.archivedBytes, estimatedAudioBytes: t.estimatedAudioBytes,
      sessionMB: (t.sessionBytes / MB).toFixed(2), sessionKB: Math.round(t.sessionBytes / KB),
      todayMB: (t.todayBytes / MB).toFixed(2), allTimeMB: (t.allTimeBytes / MB).toFixed(2), cacheMB: (t.cacheSavedBytes / MB).toFixed(2),
      priceLkrPerGb: price(), costSessionLkr: costLkr(t.sessionBytes), costTodayLkr: costLkr(t.todayBytes),
      costAllTimeLkr: costLkr(t.allTimeBytes), costCacheLkr: costLkr(t.cacheSavedBytes),
      audioLabel: 'Measured + ~11 KB/word cross-origin audio estimate', saveData: state.saveData, hidden: state.hidden };
  }
  function getModeProfiles() {
    var m = loadManifest() || {}, list = m.assets || [], i, profiles = [];
    var shell = Number(m.appShellBytes) || 0, audio = Number(m.audioBytesPerWord) || AUDIO_ESTIMATE;
    var sessionAudio = audio * ((Number(m.sessionWords) || 30) + (Number(m.numberCues) || 31));
    for (i = 0; i < list.length; i++) if (list[i].src || list[i].id === 'static') {
      var bytes = shell + sessionAudio + (Number(list[i].bytes) || 0);
      profiles.push({ id: list[i].id, label: list[i].label, assetBytes: Number(list[i].bytes) || 0,
        bytes: bytes, mb: Number((bytes / MB).toFixed(2)), lkr: costLkr(bytes),
        kind: 'Estimated (Profile)', desc: 'Estimated (Profile): manifest video + app shell + one uncached reading per word/number. Repeats use cache.' });
    }
    profiles.push({ id: 'offline', label: 'Offline / cached repeat practice', assetBytes: 0, bytes: 0, mb: 0, lkr: 0,
      kind: 'Estimated (Profile)', desc: 'Estimated (Profile): fully cached practice; version checks may still use data.' });
    return profiles;
  }
  function setPrice(v) { v = Number(v); if (isFinite(v) && v > 0) safeSet(STORAGE.price, String(v)); return price(); }
  function resetSession() {
    state.videoBytes = state.audioBytes = state.appBytes = state.cacheSavedBytes = 0;
    state.estimatedAudioBytes = state.resourceVideoBytes = state.archivedBytes = state._archivedResourceBytes = 0;
    state.videoBufferedSources = {}; state.sessionStart = Date.now(); persistedSession = 0;
    state.seenUrls = {}; state.seenEntries = {}; state.trackedUrls = {}; state.fetchPending = {}; state.audioPlayTimes = {};
  }
  function start(opts) {
    opts = opts || {};
    if (state.started && !state.paused) return meter;
    state.started = true; state.paused = false; state.daily = readDaily(); state.allTime = Number(safeGet(STORAGE.allTime)) || 0;
    loadManifest(); installObserver(); installFetchHooks(); flushEntries();
    if (opts.interval !== false && !state.interval) state.interval = global.setInterval(function () {
      if (state.paused) return;
      var live = sample(), i; for (i = 0; i < state.tickers.length; i++) try { state.tickers[i](live); } catch (e) {}
    }, 1000);
    if (!state._lifeBound) {
      state._lifeBound = true;
      try {
        global.document.addEventListener('visibilitychange', function () { state.hidden = !!global.document.hidden; persistTotals(); });
        global.addEventListener('pagehide', persistTotals);
      } catch (e) {}
    }
    return meter;
  }
  function stop() {
    flushEntries(); state.paused = true;
    if (state.interval) global.clearInterval(state.interval); state.interval = null;
    try { if (state.observer) state.observer.disconnect(); } catch (e) {} state.observer = null;
    persistTotals(); return getLive();
  }
  function onTick(cb) { if (typeof cb === 'function') state.tickers.push(cb); return function () { var i = state.tickers.indexOf(cb); if (i >= 0) state.tickers.splice(i, 1); }; }
  var meter = { version: METER_VERSION, schema: SCHEMA, ver: SCHEMA, appVersion: METER_VERSION, KNOWN_ASSETS: KNOWN_ASSETS, STORAGE: STORAGE,
    knownBytesFor: knownBytesFor, classify: classify, addBytes: addBytes, trackFetch: trackFetch, accountEntry: accountEntry,
    videoBufferedBytes: videoBufferedBytes, recordAudioPlay: recordAudioPlay, sample: sample, flushEntries: flushEntries,
    getLive: getLive, getModeProfiles: getModeProfiles, formatMB: formatMB, formatBytes: formatBytes, costLkr: costLkr,
    price: price, setPrice: setPrice, start: start, stop: stop, resetSession: resetSession, onTick: onTick, loadManifest: loadManifest,
    persistTotals: persistTotals };
  global.SDPDataMeter = meter; global.SDP_DATA_METER = meter;
  if (typeof module !== 'undefined' && module.exports) module.exports = meter;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
