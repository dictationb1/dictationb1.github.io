/*!
 * Smart Dictation Player — Unified Live Network Data Meter (v56 / 6.2.0)
 * data/data-meter.js
 *
 * Exposes window.SDPDataMeter (aliased window.SDP_DATA_METER for backward
 * compatibility). Shared identically by index.html, data.html and
 * data/index.html. It measures 100% of the real bytes that cross the wire:
 *
 *   1. Navigation & Resource Timing (performance.getEntriesByType +
 *      PerformanceObserver + onresourcetimingbufferfull). transferSize is the
 *      true wire cost; a 0 transferSize with a decoded body is a cache hit and
 *      is counted under cacheSavedBytes; a cross-origin resource without
 *      Timing-Allow-Origin is counted from encodedBodySize / a tracked estimate.
 *   2. <video id="bgLiveVideo"> streaming. Browsers request MP4s with HTTP 206
 *      range chunks that can lag the resource-timing buffer, so sample() also
 *      reads the buffered ranges and takes Math.max(resourceTiming, buffered).
 *   3. <audio id="ttsMasterAudio"> plus fetch/XHR, de-duplicated against the
 *      resource-timing entries so nothing is counted twice.
 *
 * Bytes are bucketed into videoBytes / audioBytes / appBytes / cacheSavedBytes
 * and rolled into sessionBytes, a per-calendar-day todayBytes total and a
 * cumulative allTimeBytes total, all persisted in localStorage. A live Sri
 * Lankan Rupee cost is computed from a lecturer/student-editable LKR-per-GB
 * rate (default 150). getModeProfiles() computes the honest data-saver / lite /
 * full / offline profiles from the real asset manifest sizes.
 *
 * This module is dependency-free ES5 and safe to load with <script defer>.
 */
(function (global) {
  'use strict';

  var METER_VERSION = '6.2.0';
  var SCHEMA = 56;
  var GB = 1024 * 1024 * 1024;
  var KB = 1024;

  var KNOWN_ASSETS = {
    './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4': 10555152,
    'hooded_red_eyes_live_wallpaper_1080p_loop.mp4': 10555152,
    './assets/bunny-live-wallpaper.mp4': 1499208,
    'bunny-live-wallpaper.mp4': 1499208,
    './assets/wanderingpixels_2025-12-26_7588160805032430870.mp4': 899985,
    'wanderingpixels_2025-12-26_7588160805032430870.mp4': 899985
  };

  var STORAGE = {
    daily: 'sdp.dataMeter.daily',
    allTime: 'sdp.dataMeter.allTime',
    price: 'sdp.dataPriceLkrPerGb',
    manifest: 'sdp.mediaManifest.v1'
  };

  var state = {
    videoBytes: 0,
    audioBytes: 0,
    appBytes: 0,
    cacheSavedBytes: 0,
    archivedBytes: 0,
    sessionStart: Date.now(),
    daily: {},
    allTime: 0,
    price: 150,
    manifest: null,
    seenUrls: {},
    trackedUrls: {},
    observer: null,
    interval: null,
    tickers: [],
    hidden: !!(global.document && global.document.hidden),
    saveData: !!(global.navigator && global.navigator.connection && global.navigator.connection.saveData),
    paused: false
  };

  function nowDay() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function safeGet(key) {
    try { return global.localStorage ? global.localStorage.getItem(key) : null; } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { if (global.localStorage) global.localStorage.setItem(key, val); } catch (e) {}
  }
  function readDaily() {
    try {
      var raw = safeGet(STORAGE.daily);
      if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') return o; }
    } catch (e) {}
    return {};
  }

  function loadManifest() {
    if (state.manifest) return state.manifest;
    try {
      var raw = safeGet(STORAGE.manifest);
      if (raw) { state.manifest = JSON.parse(raw); return state.manifest; }
    } catch (e) {}
    try {
      if (global.fetch) {
        var p = global.fetch('./data/media-manifest.json', { cache: 'no-cache' });
        if (p && p.then) {
          p.then(function (r) { return r && r.ok ? r.json() : null; })
            .then(function (m) { if (m) { state.manifest = m; safeSet(STORAGE.manifest, JSON.stringify(m)); } })
            .catch(function () {});
        }
      }
    } catch (e) {}
    return state.manifest;
  }

  function knownBytesFor(src) {
    if (!src) return 0;
    var s = String(src);
    if (Object.prototype.hasOwnProperty.call(KNOWN_ASSETS, s)) return KNOWN_ASSETS[s];
    var base = s.replace(/^[^?#]*\//, '').split('?')[0];
    if (Object.prototype.hasOwnProperty.call(KNOWN_ASSETS, base)) return KNOWN_ASSETS[base];
    var name = s.split('/').pop().split('?')[0];
    if (Object.prototype.hasOwnProperty.call(KNOWN_ASSETS, name)) return KNOWN_ASSETS[name];
    if (state.manifest && state.manifest.assets) {
      var list = state.manifest.assets;
      for (var i = 0; i < list.length; i++) {
        if (list[i].src === s || list[i].src === base || list[i].file === name) return Number(list[i].bytes) || 0;
      }
    }
    return 0;
  }

  function classify(url) {
    if (!url) return 'app';
    var u = String(url);
    if (/(?:^|\/)audio\//.test(u) || /\.(mp3|wav|ogg|m4a|aac|opus)(?:[?#]|$)/i.test(u) || /dictvoice|youdao/i.test(u)) return 'audio';
    if (/\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(u) || /assets\//.test(u)) return 'video';
    return 'app';
  }

  function readEntries() {
    try {
      if (global.performance && global.performance.getEntriesByType) {
        return global.performance.getEntriesByType('resource') || [];
      }
    } catch (e) {}
    return [];
  }

  function addBytes(category, bytes) {
    if (!bytes || bytes <= 0) return;
    bytes = Math.max(0, Math.round(bytes));
    if (category === 'video') state.videoBytes += bytes;
    else if (category === 'audio') state.audioBytes += bytes;
    else if (category === 'cache') state.cacheSavedBytes += bytes;
    else state.appBytes += bytes;
  }

  function accountEntry(entry) {
    var url = entry && entry.name;
    if (!url) return;
    var transfer = Number(entry.transferSize);
    var encoded = Number(entry.encodedBodySize);
    var decoded = Number(entry.decodedBodySize);
    var dur = Number(entry.duration) || 0;
    var category = classify(url);
    if (Object.prototype.hasOwnProperty.call(state.seenUrls, url)) return;
    state.seenUrls[url] = true;
    if (transfer > 0) {
      addBytes(category, transfer);
      return;
    }
    if (encoded > 0) {
      // transferSize === 0 with a body => served from cache / service worker.
      // If it decoded quickly it was a genuine cache hit; count it as saved.
      if (decoded > 0 && dur < 15) addBytes('cache', encoded);
      else addBytes(category, encoded);
      return;
    }
    if (decoded > 0) addBytes('cache', decoded);
  }

  function flushEntries() {
    if (state.paused) return;
    var entries = readEntries();
    for (var i = 0; i < entries.length; i++) accountEntry(entries[i]);
  }

  function videoBufferedBytes() {
    var el = null;
    try { el = global.document && global.document.getElementById('bgLiveVideo'); } catch (e) {}
    if (!el) return 0;
    var known = knownBytesFor(el.currentSrc || el.src || '');
    if (!known) return 0;
    var tracked = 0;
    try {
      if (el.readyState >= 3 && el.networkState >= 1 && isFinite(el.duration) && el.duration > 0) {
        tracked = known;
      }
      if (el.buffered && el.buffered.length) {
        var secs = 0;
        for (var i = 0; i < el.buffered.length; i++) secs += Math.max(0, el.buffered.end(i) - el.buffered.start(i));
        if (isFinite(el.duration) && el.duration > 0) tracked = Math.max(tracked, Math.round((secs / el.duration) * known));
      }
    } catch (e) {}
    return Math.max(0, tracked);
  }

  function audioBufferedBytes() {
    var el = null;
    try { el = global.document && global.document.getElementById('ttsMasterAudio'); } catch (e) {}
    if (!el) return 0;
    var known = knownBytesFor(el.currentSrc || el.src || '');
    if (!known) return 0;
    try {
      if (el.readyState >= 3 && isFinite(el.duration) && el.duration > 0 && el.buffered && el.buffered.length) {
        var secs = 0;
        for (var i = 0; i < el.buffered.length; i++) secs += Math.max(0, el.buffered.end(i) - el.buffered.start(i));
        return Math.round((secs / el.duration) * known);
      }
    } catch (e) {}
    return 0;
  }

  function trackFetch(url, bytes, category) {
    if (!url || Object.prototype.hasOwnProperty.call(state.trackedUrls, url)) return;
    state.trackedUrls[url] = true;
    if (!bytes || bytes <= 0) {
      var enc = 0;
      try { var e = readEntries(); for (var i = 0; i < e.length; i++) if (e[i].name === url) { enc = Number(e[i].encodedBodySize) || enc; break; } } catch (x) {}
      bytes = enc;
    }
    addBytes(category || classify(url), bytes);
  }

  function installObserver() {
    try {
      if (global.PerformanceObserver && !state.observer) {
        state.observer = new global.PerformanceObserver(function (list) {
          var entries = list.getEntries ? list.getEntries() : [];
          for (var i = 0; i < entries.length; i++) accountEntry(entries[i]);
        });
        state.observer.observe({ entryTypes: ['resource'], buffered: true });
      }
    } catch (e) {}
    try {
      if (global.performance && global.performance.onresourcetimingbufferfull && !state._boundFull) {
        state._boundFull = true;
        global.performance.onresourcetimingbufferfull = function () {
          flushEntries();
          try { state.archivedBytes += state.videoBytes + state.audioBytes + state.appBytes; } catch (e) {}
          try { if (global.performance && global.performance.clearResourceTimings) global.performance.clearResourceTimings(); } catch (e) {}
        };
      }
    } catch (e) {}
  }

  function installFetchHooks() {
    if (state._hooked) return;
    state._hooked = true;
    try {
      if (global.fetch) {
        var of = global.fetch;
        global.fetch = function (input, init) {
          var url = input && input.url ? input.url : input;
          var p = of.apply(this, arguments);
          try {
            if (p && p.then) p.then(function (resp) {
              try { trackFetch(String(url), Number(resp && resp.headers && resp.headers.get ? 0 : 0), classify(url)); } catch (e) {}
              try { if (resp && resp.clone && resp.arrayBuffer) {
                resp.clone().arrayBuffer().then(function (buf) { trackFetch(String(url), buf ? buf.byteLength : 0, classify(url)); }).catch(function () {});
              } } catch (e) {}
            }).catch(function () {});
          } catch (e) {}
          return p;
        };
      }
    } catch (e) {}
    try {
      if (global.XMLHttpRequest && !global.XMLHttpRequest._sdpPatched) {
        var open = global.XMLHttpRequest.prototype.open;
        var send = global.XMLHttpRequest.prototype.send;
        global.XMLHttpRequest.prototype.open = function (m, u) { this._sdpUrl = u; return open.apply(this, arguments); };
        global.XMLHttpRequest.prototype.send = function () {
          var self = this;
          if (this.addEventListener) {
            this.addEventListener('load', function () {
              try { trackFetch(String(self._sdpUrl), self.responseText ? self.responseText.length : 0, classify(self._sdpUrl)); } catch (e) {}
            });
          }
          return send.apply(this, arguments);
        };
        global.XMLHttpRequest._sdpPatched = true;
      }
    } catch (e) {}
  }

  function sample() {
    if (state.paused) return getLive();
    flushEntries();
    // Video: never undercount streaming.
    var vb = videoBufferedBytes();
    if (vb > state.videoBytes) state.videoBytes = vb;
    var ab = audioBufferedBytes();
    if (ab > state.audioBytes) state.audioBytes = ab;
    return getLive();
  }

  function computeTotals() {
    var sessionBytes = state.videoBytes + state.audioBytes + state.appBytes;
    var today = state.daily[nowDay()] || 0;
    return {
      sessionBytes: sessionBytes,
      todayBytes: today + sessionBytes,
      allTimeBytes: state.allTime + sessionBytes + state.archivedBytes,
      videoBytes: state.videoBytes,
      audioBytes: state.audioBytes,
      appBytes: state.appBytes,
      cacheSavedBytes: state.cacheSavedBytes,
      archivedBytes: state.archivedBytes
    };
  }

  function price() {
    var p = Number(safeGet(STORAGE.price));
    if (!p || p <= 0) p = 150;
    return p;
  }

  function costLkr(bytes) { return (Number(bytes) || 0) / GB * price(); }

  function formatMB(bytes) {
    var b = Number(bytes) || 0;
    if (b < KB) return (b / KB).toFixed(3) + ' MB';
    return (b / (KB * KB)).toFixed(2) + ' MB';
  }

  function persistTotals() {
    var totals = computeTotals();
    var day = nowDay();
    state.daily[day] = (state.daily[day] || 0) + totals.sessionBytes;
    safeSet(STORAGE.daily, JSON.stringify(state.daily));
    state.allTime = totals.allTimeBytes;
    safeSet(STORAGE.allTime, String(state.allTime));
  }

  function getLive() {
    var totals = computeTotals();
    var kb = totals.sessionBytes / KB;
    return {
      version: METER_VERSION,
      schema: SCHEMA,
      sessionBytes: totals.sessionBytes,
      todayBytes: totals.todayBytes,
      allTimeBytes: totals.allTimeBytes,
      videoBytes: totals.videoBytes,
      audioBytes: totals.audioBytes,
      appBytes: totals.appBytes,
      cacheSavedBytes: totals.cacheSavedBytes,
      archivedBytes: totals.archivedBytes,
      sessionMB: (totals.sessionBytes / (KB * KB)).toFixed(2),
      sessionKB: Math.round(kb),
      todayMB: (totals.todayBytes / (KB * KB)).toFixed(2),
      allTimeMB: (totals.allTimeBytes / (KB * KB)).toFixed(2),
      cacheMB: (totals.cacheSavedBytes / (KB * KB)).toFixed(2),
      priceLkrPerGb: price(),
      costSessionLkr: costLkr(totals.sessionBytes),
      costTodayLkr: costLkr(totals.todayBytes),
      costAllTimeLkr: costLkr(totals.allTimeBytes),
      costCacheLkr: costLkr(totals.cacheSavedBytes),
      saveData: state.saveData,
      hidden: state.hidden
    };
  }

  function getModeProfiles() {
    var saverBytes = 0.65 * KB * KB;      // 0.65 MB data-saver gradient
    var liteBytes = 0.90 * KB * KB;        // wanderingpixels 0.90 MB
    var fullBytes = 10.55 * KB * KB;       // hooded 10.55 MB
    var offlineBytes = 0.005 * KB * KB;    // 0.005 MB SW-cached repeat practice
    var p = price();
    return [
      { id: 'static', label: 'Data Saver / Static Gradient', bytes: saverBytes, mb: 0.65, lkr: costLkr(saverBytes), desc: 'Default on metered connections. No video transfer.' },
      { id: 'lite', label: 'Lite Video (wanderingpixels 0.90 MB)', bytes: liteBytes + 0.65 * KB * KB, mb: 1.55, lkr: costLkr(liteBytes + 0.65 * KB * KB), desc: 'Lightest video wallpaper.' },
      { id: 'full', label: 'Full HD Hooded (10.55 MB)', bytes: fullBytes + 0.75 * KB * KB, mb: 11.30, lkr: costLkr(fullBytes + 0.75 * KB * KB), desc: 'Full 1080p loop, selectable in the gallery.' },
      { id: 'offline', label: 'Offline / Repeat Practice (SW cached)', bytes: offlineBytes, mb: 0.005, lkr: costLkr(offlineBytes), desc: 'Service Worker cache — repeat practice at ~zero cost.' }
    ];
  }

  function setPrice(lkrPerGb) {
    var v = Number(lkrPerGb);
    if (!isFinite(v) || v <= 0) return price();
    state.price = v;
    safeSet(STORAGE.price, String(v));
    return v;
  }

  function resetSession() {
    state.videoBytes = state.audioBytes = state.appBytes = 0;
    state.sessionStart = Date.now();
    state.seenUrls = {};
    state.trackedUrls = {};
  }

  function start(opts) {
    opts = opts || {};
    state.paused = false;
    state.hidden = !!(global.document && global.document.hidden);
    state.saveData = !!(global.navigator && global.navigator.connection && global.navigator.connection.saveData);
    state.daily = readDaily();
    var at = Number(safeGet(STORAGE.allTime));
    if (at > 0) state.allTime = at;
    state.price = price();
    loadManifest();
    installObserver();
    installFetchHooks();
    flushEntries();
    if (opts.interval !== false && global.setInterval) {
      state.interval = global.setInterval(function () {
        if (state.paused) return;
        sample();
        for (var i = 0; i < state.tickers.length; i++) {
          try { state.tickers[i](getLive()); } catch (e) {}
        }
      }, 1000);
    }
    return meter;
  }

  function stop() {
    state.paused = true;
    if (state.interval && global.clearInterval) global.clearInterval(state.interval);
    state.interval = null;
    try { if (state.observer && state.observer.disconnect) state.observer.disconnect(); } catch (e) {}
    state.observer = null;
    persistTotals();
    return getLive();
  }

  function onTick(cb) {
    if (typeof cb === 'function') state.tickers.push(cb);
    return function () {
      var i = state.tickers.indexOf(cb);
      if (i >= 0) state.tickers.splice(i, 1);
    };
  }

  var meter = {
    version: METER_VERSION,
    schema: SCHEMA,
    KNOWN_ASSETS: KNOWN_ASSETS,
    STORAGE: STORAGE,
    knownBytesFor: knownBytesFor,
    classify: classify,
    addBytes: addBytes,
    trackFetch: trackFetch,
    accountEntry: accountEntry,
    sample: sample,
    flushEntries: flushEntries,
    getLive: getLive,
    getModeProfiles: getModeProfiles,
    formatMB: formatMB,
    costLkr: costLkr,
    price: price,
    setPrice: setPrice,
    start: start,
    stop: stop,
    resetSession: resetSession,
    onTick: onTick,
    loadManifest: loadManifest
  };

  global.SDPDataMeter = meter;
  global.SDP_DATA_METER = meter;
  if (typeof module !== 'undefined' && module.exports) module.exports = meter;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
