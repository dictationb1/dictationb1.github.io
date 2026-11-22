/* data/sdp-telemetry.js — v0.0.6.v
 * The cross-device student telemetry ledger (strict ES5). Exposed as
 * window.SDP.Telemetry. A persistent clientId (sdp_u_<16-hex>, built with
 * ('0' + n.toString(16)).slice(-2) — NEVER .padStart), visitCount,
 * totalDwellSec, an APPEND-ONLY sessions[] ledger and incidents[] live
 * INSIDE sdp.settings.telemetry (the five-key localStorage law holds: no
 * sixth key is ever created). pushTelemetryEnvelope() beacons the ledger to
 * https://ntfy.sh/sdp_<owner>_telemetry_v1 + the GAS telemetry_sync action;
 * pullTelemetryLedger() pulls sdp_<owner>_telemetry_v1/json?poll=1&since=all
 * (3.5 s timeout) + GAS telemetry_pull and merges into
 * sdp.settings.telemetryLedger for the Studio activity popup.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R-TELEMETRY (v0.0.6.v). */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var PULL_TIMEOUT_MS = 3500;

  function settings() {
    try { return SDP.Data && SDP.Data.settings ? (SDP.Data.settings() || {}) : {}; } catch (e) { return {}; }
  }
  function saveSettings(patch) {
    try { if (SDP.Data && SDP.Data.saveSettings) SDP.Data.saveSettings(patch); } catch (e) {}
  }
  function log(kind, data) {
    try { if (SDP.Diagnostics && SDP.Diagnostics.log) SDP.Diagnostics.log(kind, data); } catch (e) {}
  }

  /* Strict-ES5 hex padding — no .padStart anywhere in this file. */
  function hex2(n) { return ('0' + n.toString(16)).slice(-2); }

  function randomHex16() {
    var bytes = new Uint8Array(8), i;
    try {
      global.crypto.getRandomValues(bytes);
    } catch (e) {
      for (i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var out = '';
    for (i = 0; i < 8; i++) out += hex2(bytes[i]);
    return out;
  }

  function ledger() {
    var s = settings();
    if (!s.telemetry || typeof s.telemetry !== 'object') {
      s.telemetry = { clientId: 'sdp_u_' + randomHex16(), visitCount: 0, totalDwellSec: 0, sessions: [], incidents: [], lastSyncAt: 0 };
      saveSettings({ telemetry: s.telemetry });
    }
    if (!s.telemetry.clientId) s.telemetry.clientId = 'sdp_u_' + randomHex16();
    if (!Array.isArray(s.telemetry.sessions)) s.telemetry.sessions = [];
    if (!Array.isArray(s.telemetry.incidents)) s.telemetry.incidents = [];
    return s.telemetry;
  }

  function owner() {
    var host = '';
    try { host = String(global.location && global.location.hostname || ''); } catch (e) {}
    var m = host.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (m) return m[1];
    try { return String((settings().repoOwner) || 'dictationb1'); } catch (e) { return 'dictationb1'; }
  }

  function telemetryTopic() { return 'https://ntfy.sh/sdp_' + owner() + '_telemetry_v1'; }

  function deviceClass() {
    var w = 0;
    try { w = global.innerWidth || 0; } catch (e) { w = 0; }
    if (w <= 400) return 'phone';
    if (w <= 900) return 'tablet';
    return 'desktop';
  }

  /* v0.0.7.b B6 — privacy-safe device telemetry: the OS / browser FAMILY
     only (regex-derived, never the raw userAgent string), the physical
     screen size and the live online flag. Zero PII. */
  function osFamily() {
    var ua = '';
    try { ua = String((global.navigator && global.navigator.userAgent) || ''); } catch (e) { ua = ''; }
    if (/windows phone/i.test(ua)) return 'Windows Phone';
    if (/windows/i.test(ua)) return 'Windows';
    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
    if (/mac os x|macintosh/i.test(ua)) return 'macOS';
    if (/cros/i.test(ua)) return 'ChromeOS';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Other';
  }
  function browserFamily() {
    var ua = '';
    try { ua = String((global.navigator && global.navigator.userAgent) || ''); } catch (e) { ua = ''; }
    if (/edg\//i.test(ua)) return 'Edge';
    if (/opr\/|opera/i.test(ua)) return 'Opera';
    if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
    if (/firefox\//i.test(ua)) return 'Firefox';
    if (/chrome\//i.test(ua)) return 'Chrome';
    if (/safari\//i.test(ua)) return 'Safari';
    return 'Other';
  }
  function browserVersion() {
    var ua = '';
    try { ua = String((global.navigator && global.navigator.userAgent) || ''); } catch (e) { ua = ''; }
    var m = ua.match(/(?:chrome|crios|firefox|fxios|edg\/?|opr\/|samsungbrowser)\/(\d+)/i);
    return m ? m[1] : '';
  }
  function tzName() {
    try { return String((global.Intl && global.Intl.DateTimeFormat && global.Intl.DateTimeFormat().resolvedOptions && global.Intl.DateTimeFormat().resolvedOptions().timeZone) || ''); } catch (e) { return ''; }
  }
  function storageHealth() {
    /* honest browser capability: THIS app's own localStorage only — browsers
       never expose other sites' cookies or storage to a web page. */
    var bytes = 0, keys = 0;
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        bytes += (k || '').length + String(global.localStorage.getItem(k) || '').length;
        keys += 1;
      }
    } catch (e) {}
    return (keys ? (bytes < 1024 ? bytes + ' B' : (Math.round(bytes / 102.4) / 10) + ' kB') : 'empty') + ' / ' + keys + ' keys';
  }
  function deviceTelemetry() {
    var sc = global.screen || {};
    var nav = global.navigator || {};
    var pwa = false;
    try { pwa = (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) || (global.navigator && nav.standalone === true); } catch (eP) { pwa = false; }
    var sw = 'none';
    try { if (global.navigator && nav.serviceWorker && nav.serviceWorker.controller) sw = String((nav.serviceWorker.controller.state || 'active')); } catch (eS) { sw = 'none'; }
    return {
      class: deviceClass(),
      dpr: Math.round((global.devicePixelRatio || 1) * 100) / 100,
      vw: global.innerWidth || 0,
      vh: global.innerHeight || 0,
      screen: (Number(sc.width) || 0) + 'x' + (Number(sc.height) || 0),
      os: osFamily(),
      osv: (function () { var m = ''; try { m = String((global.navigator && global.navigator.userAgent) || '').match(/android\s(\d[\d.]*)|cpu\siphone\sos\s(\d[\d_]*)/i); } catch (e) {} return m ? (m[1] || (m[2] || '').replace(/_/g, '.')) : ''; })(),
      browser: browserFamily(),
      browserV: browserVersion(),
      uaClass: (function () { try { return String((global.navigator && global.navigator.userAgent) || '').indexOf('Mobile') >= 0 ? 'mobile UA' : 'desktop UA'; } catch (e) { return ''; } })(),
      lang: (function () { try { return String((global.navigator && global.navigator.language) || ''); } catch (e) { return ''; } })(),
      tz: tzName(),
      online: (function () { try { return global.navigator && global.navigator.onLine !== false; } catch (e) { return true; } })(),
      net: (function () { try { return String((global.navigator && global.navigator.connection && global.navigator.connection.effectiveType) || 'unknown'); } catch (e) { return 'unknown'; } })(),
      downlink: (function () { try { return global.navigator && global.navigator.connection ? Number(global.navigator.connection.downlink) || 0 : 0; } catch (e) { return 0; } })(),
      rtt: (function () { try { return global.navigator && global.navigator.connection ? Number(global.navigator.connection.rtt) || 0 : 0; } catch (e) { return 0; } })(),
      cookies: (function () { try { return global.navigator ? global.navigator.cookieEnabled !== false : true; } catch (e) { return true; } })(),
      storage: storageHealth(),
      pwa: pwa,
      sw: sw,
      appVersion: String(SDP.version || '')
    };
  }

  function sessionStart() {
    var t = ledger();
    var wasFirst = Number(t.visitCount || 0) === 0;
    t.visitCount = Number(t.visitCount || 0) + 1;
    t.__startedAt = Date.now();
    t.__hiddenMs = 0;
    t.__lastVisible = Date.now();
    saveSettings({ telemetry: t });
    log('telemetry_session_start', { sessionNo: t.visitCount, clientId: t.clientId });
    /* v0.0.7.f Pillar 3: the SESSION START Telegram event */
    try { pushEvent('session_start', { sessionNo: String(t.visitCount), visitCount: t.visitCount, firstVisit: wasFirst, mode: (settings().mode || ''), voice: String(settings().voice || '') }); } catch (eP1) {}
    return t;
  }

  function visibilityTick(hidden) {
    var t = ledger();
    if (!t.__startedAt) return;
    if (hidden) {
      t.__hiddenSince = Date.now();
    } else if (t.__hiddenSince) {
      t.__hiddenMs = Number(t.__hiddenMs || 0) + (Date.now() - Number(t.__hiddenSince));
      t.__hiddenSince = 0;
      t.__lastVisible = Date.now();
    }
    saveSettings({ telemetry: t });
  }

  /* APPEND-ONLY: a finished visit is pushed onto sessions[] — never
   * overwriting a prior visit. */
  function sessionEnd(extra) {
    var t = ledger();
    if (!t.__startedAt) return null;
    if (t.__hiddenSince) visibilityTick(true);
    var dwell = Math.max(0, Math.round((Date.now() - Number(t.__startedAt) - Number(t.__hiddenMs || 0)) / 1000));
    var rec = {
      sessionNo: Number(t.visitCount || 0),
      startedAt: Number(t.__startedAt),
      endedAt: Date.now(),
      dwellSec: dwell,
      wordsCompleted: Number(extra && extra.wordsCompleted) || 0,
      score: Number(extra && extra.score) || 0,
      missedWords: Array.isArray(extra && extra.missedWords) ? extra.missedWords.slice(0, 30) : [],
      lagMs: Number(extra && extra.lagMs) || 0,
      audioTierUsed: String((extra && extra.audioTierUsed) || ''),
      rating: Number(extra && extra.rating) || 0,
      reactions: Array.isArray(extra && extra.reactions) ? extra.reactions.slice(0, 12).map(function (r) { return String(r).slice(0, 40); }) : [],
      device: deviceTelemetry()
    };
    t.sessions.push(rec);
    t.totalDwellSec = Number(t.totalDwellSec || 0) + rec.dwellSec;
    t.__startedAt = 0; t.__hiddenMs = 0;
    saveSettings({ telemetry: t });
    /* v0.0.7.b B6 — LIVE beacon: a finished session reaches the Lecturer
       Studio the moment it completes, never only on tab close. */
    try { pushTelemetryEnvelope(function () {}); } catch (ePB) {}
    /* v0.0.7.f Pillar 3: the SESSION END Telegram event (words, score, exact
       dwell time, mode + full device summary for the Lecturer's feed). */
    /* v0.0.7.j FEATURE-J3: name/classId ride the session_end event so the
       ONE daily 👤 User #N card (server-side tgCardUpdate) always shows the
       student's identity — the card replaces the old per-session spam. */
    var _alName = '', _alClass = '';
    try { if (global.SDP && SDP.AccessLock && SDP.AccessLock.state) { var _als = SDP.AccessLock.state(); _alName = String(_als && _als.name || ''); _alClass = String(_als && _als.classId || ''); } } catch (eAL) {}
    try { pushEvent('session_end', { sessionNo: String(rec.sessionNo), words: rec.wordsCompleted, score: rec.score, dwellSec: rec.dwellSec, mode: String(settings().mode || ''), voice: rec.audioTierUsed, device: rec.device, name: _alName, classId: _alClass }); } catch (ePE) {}
    return rec;
  }

  /* v0.0.7.b B6 — stampLastSession(patch): the student feedback path adds
     rating / reaction chips to the just-finished session record so the
     Lecturer Studio sees reactions against real performance. */
  function stampLastSession(patch) {
    var t = ledger();
    if (!t.sessions.length) return null;
    var p = patch && typeof patch === 'object' ? patch : {};
    var last = t.sessions[t.sessions.length - 1];
    if (p.rating) last.rating = Number(p.rating) || 0;
    if (Array.isArray(p.reactions)) last.reactions = p.reactions.slice(0, 12).map(function (r) { return String(r).slice(0, 40); });
    saveSettings({ telemetry: t });
    try { pushTelemetryEnvelope(function () {}); } catch (ePS) {}
    return last;
  }

  /* recordIncident(type, detail) — self-heal incidents ride the ledger. */
  function recordIncident(type, detail) {
    var t = ledger();
    var rec = {
      type: String(type || 'unknown'),
      ts: Date.now(),
      viewport: (global.innerWidth || 0) + 'x' + (global.innerHeight || 0),
      net: (function () { try { return String((global.navigator && global.navigator.connection && global.navigator.connection.effectiveType) || 'unknown'); } catch (e) { return 'unknown'; } })(),
      clipKey: String((detail && detail.clipKey) || ''),
      lastErr: String((detail && detail.lastErr) || '').slice(0, 160),
      recovery: { action: String((detail && detail.recovery && detail.recovery.action) || ''), result: String((detail && detail.recovery && detail.recovery.result) || '') }
    };
    t.incidents.push(rec);
    if (t.incidents.length > 80) t.incidents = t.incidents.slice(-80);
    saveSettings({ telemetry: t });
    log('selfheal_incident', { type: rec.type, clipKey: rec.clipKey });
    return rec;
  }

  function envelope() {
    var t = ledger();
    return {
      action: 'telemetry_sync',
      clientId: t.clientId,
      session: t.sessions.length ? t.sessions[t.sessions.length - 1] : null,
      incidents: t.incidents.slice(-10),
      visitCount: t.visitCount,
      totalDwellSec: t.totalDwellSec,
      appVersion: (SDP.version || ''),
      at: Date.now()
    };
  }

  /* ══ v0.0.7.f Pillar 3/4: the Telegram telemetry event relay (tg_event).
     Every student event — session start/end, activity + dwell time, tab
     leave (sendBeacon), voice errors, troubleshooting, feedback — rides the
     PUBLIC Apps Script relay URL (sdp.settings.gasUrl →
     config.json accessLock.relayUrl) to the Lecturer's Telegram with the
     server-side anti-spam throttle + digest batching. Client-side: events
     fire-and-forget with keepalive, deduped, and NEVER block the student. ══ */
  function gasRelayUrl() {
    try { var s = settings(); if (s && s.gasUrl) return String(s.gasUrl); } catch (e1) {}
    try {
      if (global.SDP && SDP.Sync && SDP.Sync.config && SDP.Sync.config()) {
        var cfg = SDP.Sync.config();
        if (cfg && cfg.accessLock && cfg.accessLock.relayUrl) return String(cfg.accessLock.relayUrl);
      }
    } catch (e2) {}
    return '';
  }
  var evtLast = {}; /* client-side per-kind dedupe (min 3 s between identical kinds) */
  function pushEvent(kind, data) {
    kind = String(kind || '');
    if (!kind) return false;
    var t = ledger();
    var now = Date.now();
    if (evtLast[kind] && now - evtLast[kind] < 3000) return false; /* dedupe race */
    evtLast[kind] = now;
    var url = gasRelayUrl();
    if (!url || typeof global.fetch !== 'function') return false;
    var body = JSON.stringify({
      action: 'tg_event',
      deviceId: (global.SDP && SDP.AccessLock && SDP.AccessLock.deviceId) ? SDP.AccessLock.deviceId() : t.clientId,
      kind: kind,
      data: data && typeof data === 'object' ? data : {}
    });
    try {
      global.fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) {}
    return true;
  }
  function pushEventBeacon(kind, data) {
    /* the pagehide/tab-leave path: sendBeacon survives the tab closing */
    var t = ledger();
    var url = gasRelayUrl();
    if (!url) return false;
    try {
      if (global.navigator && global.navigator.sendBeacon) {
        return global.navigator.sendBeacon(url, JSON.stringify({
          action: 'tg_event',
          deviceId: (global.SDP && SDP.AccessLock && SDP.AccessLock.deviceId) ? SDP.AccessLock.deviceId() : t.clientId,
          kind: kind, data: data || {}
        }));
      }
    } catch (e) {}
    return pushEvent(kind, data);
  }
  function activitySnapshot(screenName) {
    /* the live activity + dwell-time summary the Lecturer receives */
    var t = ledger();
    return {
      screen: screenName || '',
      dwellSec: t.__startedAt ? Math.max(0, Math.round((Date.now() - Number(t.__startedAt) - Number(t.__hiddenMs || 0)) / 1000)) : 0,
      name: (global.SDP && SDP.AccessLock && SDP.AccessLock.state) ? '' : '',
      appVersion: String(SDP.version || '')
    };
  }
  function pushTelemetryEnvelope(cb) {
    cb = cb || function () {};
    var body = JSON.stringify(envelope());
    var topic = telemetryTopic();
    var done = false;
    function finish(err, ok) { if (!done) { done = true; cb(err, ok); } }
    try {
      global.fetch(topic, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body })
        .then(function () {
          var t = ledger(); t.lastSyncAt = Date.now(); saveSettings({ telemetry: t });
          finish(null, true);
        }, function () { finish(new Error('ntfy_push_failed'), false); });
    } catch (e) { finish(e, false); return false; }
    /* GAS telemetry_sync leg (admin-only relay; failures are non-fatal). */
    try {
      var gasUrl = '';
      try { gasUrl = String((settings().gasUrl) || ''); } catch (eG) {}
      if (gasUrl) { try { global.fetch(gasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body }).catch(function () {}); } catch (eGF) {} }
    } catch (e2) {}
    global.setTimeout(function () { finish(new Error('push_timeout'), false); }, 8000);
    return true;
  }

  /* Pull + merge into sdp.settings.telemetryLedger. */
  function pullTelemetryLedger(cb) {
    cb = cb || function () {};
    var topic = telemetryTopic();
    var done = false;
    function finish(err, rows) {
      if (done) return;
      done = true;
      var s = settings();
      var led = s.telemetryLedger;
      if (!led || typeof led !== 'object') led = { users: [], pulledAt: 0 };
      if (Array.isArray(rows)) {
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          if (!r || !r.clientId) continue;
          var u = null, j;
          for (j = 0; j < led.users.length; j++) if (led.users[j].clientId === r.clientId) { u = led.users[j]; break; }
          if (!u) { u = { clientId: r.clientId, sessions: [], incidents: [] }; led.users.push(u); }
          if (r.session && Array.isArray(u.sessions)) {
            var dup = false;
            for (j = 0; j < u.sessions.length; j++) if (u.sessions[j].sessionNo === r.session.sessionNo && u.sessions[j].startedAt === r.session.startedAt) { dup = true; break; }
            if (!dup) u.sessions.push(r.session);
          }
          if (Array.isArray(r.incidents)) {
            for (j = 0; j < r.incidents.length; j++) u.incidents.push(r.incidents[j]);
          }
        }
      }
      var loc = ledger();
      if (loc && loc.clientId && (loc.sessions.length || loc.incidents.length)) {
        var lu = null, k;
        for (k = 0; k < led.users.length; k++) if (led.users[k].clientId === loc.clientId) lu = led.users[k];
        if (!lu) { lu = { clientId: loc.clientId, sessions: loc.sessions.slice(), incidents: loc.incidents.slice() }; led.users.push(lu); }
      }
      led.pulledAt = Date.now();
      saveSettings({ telemetryLedger: led });
      cb(err ? null : led, led);
    }
    function parseNtfy(raw) {
      if (Array.isArray(raw)) return raw;
      var out = [], ls = String(raw || '').split(/\r?\n/), k;
      for (k = 0; k < ls.length; k++) {
        try {
          var o = JSON.parse(ls[k]);
          if (o && typeof o.message === 'string' && o.message.charAt(0) === '{') o = JSON.parse(o.message);
          if (o && o.clientId) out.push(o);
        } catch (eP) {}
      }
      return out;
    }
    try {
      global.fetch(topic + '/json?poll=1&since=all', { method: 'GET' })
        .then(function (res) {
          if (!res || !res.ok) return null;
          return typeof res.text === 'function' ? res.text().then(parseNtfy, function () { return res.json(); }) : res.json();
        })
        .then(function (rows) { finish(null, parseNtfy(rows)); },
              function () { finish(new Error('ntfy_pull_failed'), null); });
    } catch (e) { finish(e, null); return false; }
    global.setTimeout(function () { finish(new Error('pull_timeout'), null); }, PULL_TIMEOUT_MS);
    return true;
  }

  /* ══ v0.0.7.a Pillar 3 (Y3): the Student → Lecturer/Admin alert channel.
     Students hit missing/stale voice clips; the app must (a) record the alert
     under the five-key law (sdp.settings.lecturerAlerts — never a sixth key),
     (b) push it live to the lecturer over ntfy.sh + GAS, and (c) let the
     Lecturer Studio inbox pull everything back in real time. ══ */
  function alertStore() {
    var s = settings();
    var a = s.lecturerAlerts;
    if (!a || typeof a !== 'object' || !Array.isArray(a.items)) a = { items: [], unread: 0, updatedAt: 0 };
    return a;
  }
  function saveAlertStore(a) {
    a.updatedAt = Date.now();
    if (a.items.length > 120) a.items = a.items.slice(-120);
    saveSettings({ lecturerAlerts: a });
    return a;
  }
  /* sendLecturerAlert(payload, cb) — kind: "lecturer_alert". */
  function sendLecturerAlert(payload, cb) {
    cb = cb || function () {};
    payload = payload && typeof payload === 'object' ? payload : {};
    var t = ledger();
    var alertType = String(payload.alertType || 'user_message');
    var validTypes = ['missing_clips', 'stale_clips', 'pronunciation_error', 'user_message'];
    if (validTypes.indexOf(alertType) < 0) alertType = 'user_message';
    var rec = {
      kind: 'lecturer_alert',
      alertType: alertType,
      missingWords: Array.isArray(payload.missingWords) ? payload.missingWords.slice(0, 30).map(function (w) { return String(w).slice(0, 60); }) : [],
      staleKeys: Array.isArray(payload.staleKeys) ? payload.staleKeys.slice(0, 30).map(function (w) { return String(w).slice(0, 80); }) : [],
      readyCount: Number(payload.readyCount || 0),
      wordsRev: Number(payload.wordsRev || 0),
      appVersion: String(SDP.version || ''),
      clientId: t.clientId,
      message: String(payload.message || '').slice(0, 300),
      at: Date.now()
    };
    /* local inbox copy (survives offline; the lecturer reads it on pull) */
    var a = alertStore();
    a.items.push(rec);
    a.unread += 1;
    saveAlertStore(a);
    /* telemetry incidents mirror the alert (bounded ring) */
    recordIncident('lecturer_alert', { clipKey: alertType, lastErr: String(payload.message || '').slice(0, 160), recovery: { action: 'sendLecturerAlert', result: 'queued' } });
    /* live push — best-effort, never blocks the student */
    var body = JSON.stringify(rec);
    var pushed = false;
    try {
      global.fetch(telemetryTopic(), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body })
        .then(function () { pushed = true; }, function () {});
    } catch (e) {}
    try {
      var gasUrl = '';
      try { gasUrl = String((settings().gasUrl) || ''); } catch (eG) {}
      if (gasUrl) { try { global.fetch(gasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body }).catch(function () {}); } catch (eGF) {} }
    } catch (e2) {}
    global.setTimeout(function () { cb(null, rec); }, 0);
    return rec;
  }
  /* pullLecturerAlerts(cb) — merges ntfy rows + local store into the inbox. */
  function pullLecturerAlerts(cb) {
    cb = cb || function () {};
    var a = alertStore();
    function mergeRows(rows) {
      var seen = {}, i, j, r;
      for (i = 0; i < a.items.length; i++) seen[a.items[i].clientId + '@' + a.items[i].at + ':' + a.items[i].alertType] = 1;
      if (Array.isArray(rows)) {
        for (i = 0; i < rows.length; i++) {
          r = rows[i];
          if (!r || r.kind !== 'lecturer_alert' || !r.clientId) continue;
          var key = r.clientId + '@' + Number(r.at || 0) + ':' + String(r.alertType || '');
          if (seen[key]) continue;
          seen[key] = 1;
          a.items.push({
            kind: 'lecturer_alert', alertType: String(r.alertType || 'user_message'),
            missingWords: Array.isArray(r.missingWords) ? r.missingWords.slice(0, 30) : [],
            staleKeys: Array.isArray(r.staleKeys) ? r.staleKeys.slice(0, 30) : [],
            readyCount: Number(r.readyCount || 0), wordsRev: Number(r.wordsRev || 0),
            appVersion: String(r.appVersion || ''), clientId: String(r.clientId),
            message: String(r.message || '').slice(0, 300), at: Number(r.at || Date.now())
          });
          if (!r.__local) a.unread += 1;
        }
      }
      /* sort newest-first, cap, persist */
      a.items.sort(function (x, y) { return (Number(y.at) || 0) - (Number(x.at) || 0); });
      if (a.items.length > 120) a.items = a.items.slice(0, 120);
      saveAlertStore(a);
      cb(null, a);
    }
    try {
      global.fetch(telemetryTopic() + '/json?poll=1&since=12h', { method: 'GET' })
        .then(function (res) {
          if (!res || !res.ok) return [];
          return typeof res.text === 'function' ? res.text().then(function (raw) {
            var out = [], ls = String(raw || '').split(/\r?\n/), k;
            for (k = 0; k < ls.length; k++) {
              try {
                var o = JSON.parse(ls[k]);
                if (o && typeof o.message === 'string' && o.message.charAt(0) === '{') o = JSON.parse(o.message);
                if (o && o.kind === 'lecturer_alert' && o.clientId) out.push(o);
              } catch (eP) {}
            }
            return out;
          }, function () { return []; }) : [];
        }, function () { return []; })
        .then(mergeRows, function () { mergeRows([]); });
    } catch (e) { mergeRows([]); }
    global.setTimeout(function () { mergeRows([]); }, PULL_TIMEOUT_MS + 500);
    return true;
  }
  function clearLecturerAlerts() {
    var a = alertStore();
    a.items = [];
    a.unread = 0;
    saveAlertStore(a);
    return a;
  }
  function markAlertsResolved() {
    var a = alertStore();
    a.unread = 0;
    saveAlertStore(a);
    return a;
  }

  /* Boot binding: session lifecycle + pagehide beacon. */
  function bindLifecycle() {
    /* v0.0.7.f Pillar 4: uncaught JS runtime errors + unhandled rejections
       reach the Lecturer's Telegram (window.onerror / unhandledrejection),
       with the same client-side 3 s dedupe so a burst never floods. */
    try {
      if (global.addEventListener) {
        global.addEventListener('error', function (ev) {
          try {
            pushEvent('app_error', { detail: 'Uncaught error: ' + String((ev && ev.message) || 'unknown').slice(0, 160) + (ev && ev.filename ? ' @ ' + String(ev.filename).split('/').pop() + ':' + (ev.lineno || 0) : '') });
          } catch (e) {}
        }, false);
        global.addEventListener('unhandledrejection', function (ev) {
          try {
            pushEvent('app_error', { detail: 'Unhandled promise rejection: ' + String((ev && ev.reason && (ev.reason.message || ev.reason)) || 'unknown').slice(0, 160) });
          } catch (e) {}
        }, false);
      }
    } catch (eER) {}
    if (global.document && global.document.addEventListener) {
      global.document.addEventListener('visibilitychange', function () {
        visibilityTick(global.document.visibilityState === 'hidden');
      }, false);
    }
    if (global.addEventListener) {
      global.addEventListener('pagehide', function () {
        /* v0.0.7.f Pillar 3: the TAB LEAVE dwell-time Telegram event rides a
           sendBeacon so it survives the tab closing mid-request. */
        try {
          var t = ledger();
          var dwell = t.__startedAt ? Math.max(0, Math.round((Date.now() - Number(t.__startedAt) - Number(t.__hiddenMs || 0)) / 1000)) : 0;
          if (dwell >= 5) pushEventBeacon('tab_leave', { dwellSec: dwell, screen: 'left app', appVersion: String(SDP.version || '') });
        } catch (eTL) {}
        var rec = sessionEnd({});
        if (rec) {
          try {
            if (global.navigator && global.navigator.sendBeacon) {
              global.navigator.sendBeacon(telemetryTopic(), JSON.stringify(envelope()));
              return;
            }
          } catch (e) {}
          try { pushTelemetryEnvelope(function () {}); } catch (e2) {}
        }
      }, false);
    }
    sessionStart();
  }

  SDP.Telemetry = {
    version: '1.3.0',
    ledger: ledger,
    owner: owner,
    telemetryTopic: telemetryTopic,
    sessionStart: sessionStart,
    sessionEnd: sessionEnd,
    stampLastSession: stampLastSession,
    deviceTelemetry: deviceTelemetry,
    recordIncident: recordIncident,
    envelope: envelope,
    pushTelemetryEnvelope: pushTelemetryEnvelope,
    pullTelemetryLedger: pullTelemetryLedger,
    /* v0.0.7.f: the Telegram telemetry event relay (Pillars 3 + 4). */
    pushEvent: pushEvent,
    pushEventBeacon: pushEventBeacon,
    activitySnapshot: activitySnapshot,
    gasRelayUrl: gasRelayUrl,
    /* v0.0.7.a Pillar 3 (Y3): the Student → Lecturer/Admin alert channel. */
    sendLecturerAlert: sendLecturerAlert,
    pullLecturerAlerts: pullLecturerAlerts,
    clearLecturerAlerts: clearLecturerAlerts,
    markAlertsResolved: markAlertsResolved,
    alertStore: alertStore,
    bindLifecycle: bindLifecycle,
    hex2: hex2
  };

  try { bindLifecycle(); } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
