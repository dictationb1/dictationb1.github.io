/*! data/sdp-access-lock.js — v0.0.7.e — window.SDP.AccessLock (strict ES5).
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.e
 * The Private Web App Access Lock client (Architecture D — Hybrid Smart
 * Classroom Gate). When the Lecturer arms the Master Lock the whole web app
 * stops at a bilingual full-screen Entry Lock BEFORE any student data paints:
 *   · Request Access — Name + Class/ID + a random deviceId + a salted,
 *     non-identifying device-fingerprint hash travels to the Apps Script
 *     relay; Hansana's phone answers with 1-tap Telegram Approve/Reject
 *     (ntfy.sh fallback); the student screen polls quietly every 4 s and
 *     auto-unlocks in place. The student NEVER sees a reusable master PIN.
 *   · Enter Code / Password (collapsible) — single-use burnable 6-digit
 *     student codes (bound to the FIRST device that uses them) or the
 *     owner-configured Access Lock Password (never stored raw client-side).
 *   · Device-bound session token — HMAC-SHA256 signed by the backend and
 *     kept in localStorage with the 72 h Offline Grace law: an approved
 *     classroom device keeps working through weak/offline Sri Lankan mobile
 *     signal; the periodic online heartbeat verifies the revocation list.
 * Secrets law: this module ships ZERO tokens, passwords or keys; it only
 * carries the relay URL (a public Apps Script endpoint) from Studio secrets
 * or config.json. */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;

  /* ── constants ───────────────────────────────────────────────────────── */
  var STORE_KEY = 'sdp.access_lock'; /* R4a: the ONE Access Lock localStorage key */
  var POLL_MS = 4000; /* the quiet 4-second auto-unlock poll */
  var HEARTBEAT_MS = 120000; /* periodic online revocation heartbeat */
  var GRACE_MS = 72 * 60 * 60 * 1000; /* the 72 h Offline Grace ceiling */
  var FP_SALT = 'sdp-e-salt-v1'; /* salted, non-identifying fingerprint hash */

  /* ── tiny helpers (ES5 only) ─────────────────────────────────────────── */
  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function nowMs() { return (global.Date && global.Date.now) ? global.Date.now() : 0; }
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function esc(t) {
    return str(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function hex2(n) { return ('0' + n.toString(16)).slice(-2); }

  function randomHex(n) {
    var out = '', i;
    for (i = 0; i < n; i++) {
      try {
        var b = new global.Uint8Array(1);
        global.crypto.getRandomValues(b);
        out += hex2(b[0]);
      } catch (e) { out += hex2(Math.floor(Math.random() * 256)); }
    }
    return out;
  }

  /* SHA-256 of the fingerprint string via WebCrypto (async), FNV fallback. */
  function fnv1a(s) {
    var h = 0x811c9dc5, i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) & 0xffffffff;
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function sha256Hex(text) {
    var api = global.crypto && global.crypto.subtle;
    if (!api || !api.digest) return Promise.reject(new Error('no_webcrypto'));
    var bytes = new global.Uint8Array(text.length), i;
    for (i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
    return api.digest('SHA-256', bytes).then(function (buf) {
      var out = '', u = new global.Uint8Array(buf), j;
      for (j = 0; j < u.length; j++) out += hex2(u[j]);
      return out;
    });
  }

  /* ── bilingual strings (EN | SI) ─────────────────────────────────────── */
  var L = {
    en: {
      title: '🔒 Private Web App — Access Locked',
      sub: 'This classroom app is private. Ask your lecturer for access.',
      name: 'Your Name',
      namePh: 'e.g. Kasun Perera',
      classId: 'Class / ID',
      classIdPh: 'e.g. B1-TUE-04',
      request: 'Request Access',
      requesting: 'Request sent — waiting for the lecturer\u2019s approval…',
      approved: '✓ Access approved — welcome!',
      rejected: '✗ Request rejected. Please talk to your lecturer.',
      rate: 'Too many tries — please wait a minute.',
      net: 'Cannot reach the classroom server. Retry in a moment.',
      codeToggle: 'Have a code or password? Enter it here',
      codeLabel: '6-digit code or access password',
      codeGo: 'Unlock with code',
      codeBad: 'That code is not valid on this device.',
      lecturer: 'Lecturer Studio',
      offline: 'Offline — approved devices keep working for up to 72 hours',
      brand: 'Smart Dictation Player'
    },
    si: {
      title: '🔒 පෞද්ගලික වෙබ් යෙදුම — ප්\u200dරවේශය අගුළු ලා ඇත',
      sub: 'මෙම පන්ති යෙදුම පෞද්ගලිකයි. ප්\u200dරවේශය සඳහා ඔබේ කථිකාචාර්\u200dයාගෙන් ඉල්ලන්න.',
      name: 'ඔබේ නම',
      namePh: 'උදා. කසුන් පෙ\u200dරේරා',
      classId: 'පන්තිය / හැඳුනුම',
      classIdPh: 'උදා. B1-TUE-04',
      request: 'ප්\u200dරවේශය ඉල්ලන්න',
      requesting: 'ඉල්ලීම යවා ඇත — කථිකාචාර්\u200dය අනුමත කරන තුරු රැඳී සිටින්න…',
      approved: '✓ ප්\u200dරවේශය අනුමත — සාදර ගෝරව පිළිගනිමු!',
      rejected: '✗ ඉල්ලීම ප්\u200dරතික්ෂේපිතයි. කරුණාකර ඔබේ කථිකාචාර්\u200dයා සමඟ කතා කරන්න.',
      rate: 'උත්සාහ ගණන වැඩියි — මිනිත්තුවක් රැඳී සිටින්න.',
      net: 'පන්ති සේවාදානයට සම්බන්ධ විය නොහැක. මොහොතකින් නැවත උත්සාහ කරන්න.',
      codeToggle: 'කේතයක් හෝ මුර-පදයක් තිබේද? මෙහි ඇතුළත් කරන්න',
      codeLabel: 'අංක 6ක කේතය හෝ ප්\u200dරවේශ මුර-පදය',
      codeGo: 'කේතයෙන් අගුළු හරින්න',
      codeBad: 'එම කේතය මෙම උපාංගයේ වලංගු නොවේ.',
      lecturer: 'කථිකාචාර්\u200dය ම෰ක්\u200dස්ටුඩියෝ',
      offline: 'ඕෆ්ලයින් — අනුමත උපාංග පැය 72ක් දක්වා වැඩ කරයි',
      brand: 'ස්මාර්ට් ඩික්ටේෂන් ප්\u200dලේයර්'
    }
  };
  function lang() {
    try {
      var s = global.localStorage && JSON.parse(global.localStorage.getItem('sdp.settings') || '{}');
      if (s && s.lang === 'si') return 'si';
    } catch (e) {}
    try {
      var cfg = global.SDP && SDP.Sync && SDP.Sync.config && SDP.Sync.config();
      if (cfg && cfg.lang === 'si') return 'si';
    } catch (e2) {}
    return 'en';
  }
  function t(key) { return L[lang()][key] || L.en[key] || key; }

  /* ── state (the ONE R4a localStorage key) ───────────────────────────── */
  var state = {
    armed: false, /* the lock overlay is up */
    lockOn: false, /* last known cloud master state */
    deviceId: '',
    fp: '',
    name: '',
    classId: '',
    token: '',
    grantedAt: 0,
    lastHeartbeat: 0,
    pending: false
  };
  function load() {
    try {
      var raw = global.localStorage.getItem(STORE_KEY);
      var saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved === 'object') {
        state.deviceId = str(saved.deviceId);
        state.fp = str(saved.fp);
        state.token = str(saved.token);
        state.grantedAt = Number(saved.grantedAt) || 0;
        state.lastHeartbeat = Number(saved.lastHeartbeat) || 0;
      }
    } catch (e) {}
    if (!state.deviceId) {
      state.deviceId = 'sdp_d_' + randomHex(8);
      save();
    }
    return state;
  }
  function save() {
    try {
      global.localStorage.setItem(STORE_KEY, JSON.stringify({
        deviceId: state.deviceId, fp: state.fp, token: state.token,
        grantedAt: state.grantedAt, lastHeartbeat: state.lastHeartbeat
      }));
    } catch (e) {}
  }

  /* ── the salted, non-identifying device fingerprint ──────────────────── */
  function fingerprint(cb) {
    cb = cb || noop;
    if (state.fp) { cb(state.fp); return; }
    var nav = global.navigator || {};
    var screen_ = global.screen || {};
    var raw = [
      nav.language || '', (nav.languages || []).join(','),
      screen_.width || 0, screen_.height || 0, global.devicePixelRatio || 0,
      new Date().getTimezoneOffset(), nav.hardwareConcurrency || 0,
      (nav.userAgent || '').length
    ].join('|');
    sha256Hex(FP_SALT + '|' + raw).then(function (hex) {
      state.fp = hex.slice(0, 24); save(); cb(state.fp);
    }, function () {
      state.fp = 'fnv-' + fnv1a(FP_SALT + '|' + raw); save(); cb(state.fp);
    });
  }

  /* ── the relay URL (public endpoint; never a secret) ─────────────────── */
  function relayUrl() {
    /* v0.0.7.e: the sdp.settings gasUrl (five-key law) is read FIRST so the
       gate can run before any Studio unlock — the same relay URL the Studio
       and telemetry use. */
    try {
      var st = global.localStorage ? JSON.parse(global.localStorage.getItem('sdp.settings') || '{}') : null;
      if (st && st.gasUrl) return str(st.gasUrl);
    } catch (eS0) {}
    try {
      if (global.SDP && SDP.Studio && SDP.Studio.secrets) {
        var u = str(SDP.Studio.secrets().gasUrl);
        if (u) return u;
      }
    } catch (e) {}
    try {
      var cfg = global.SDP && SDP.Sync && SDP.Sync.config && SDP.Sync.config();
      if (cfg && cfg.accessLock && cfg.accessLock.relayUrl) return str(cfg.accessLock.relayUrl);
    } catch (e2) {}
    return '';
  }
  function relay(body, cb) {
    cb = cb || noop;
    var url = relayUrl();
    if (!url || typeof global.fetch !== 'function') { cb(new Error('no_relay'), null); return; }
    global.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(body)
    }).then(function (res) { return res && res.json ? res.json() : null; })
      .then(function (data) { cb(null, data); })
      .catch(function (e) { cb(e || new Error('relay_failed'), null); });
  }

  /* ── the full-screen lock overlay (pre-data paint) ──────────────────── */
  function overlayMarkup() {
    return '<div id="sdpAccessLock" class="sdp-access-lock" role="alertdialog" aria-modal="true" aria-labelledby="sdpAccessLockTitle">' +
      '<div class="sdp-access-card">' +
      '<p class="sdp-access-brand">' + esc(t('brand')) + '</p>' +
      '<h1 id="sdpAccessLockTitle" class="sdp-access-title">' + esc(t('title')) + '</h1>' +
      '<p class="sdp-access-sub">' + esc(t('sub')) + '</p>' +
      '<div class="sdp-access-form">' +
      '<label class="sdp-access-lbl" for="sdpAccessName">' + esc(t('name')) + '</label>' +
      '<input id="sdpAccessName" class="sdp-access-input" type="text" autocomplete="off" maxlength="40" placeholder="' + esc(t('namePh')) + '">' +
      '<label class="sdp-access-lbl" for="sdpAccessClass">' + esc(t('classId')) + '</label>' +
      '<input id="sdpAccessClass" class="sdp-access-input" type="text" autocomplete="off" maxlength="24" placeholder="' + esc(t('classIdPh')) + '">' +
      '<button id="sdpAccessRequestBtn" type="button" class="sdp-access-btn sdp-access-btn--go">' + esc(t('request')) + '</button>' +
      '</div>' +
      '<p id="sdpAccessStatus" class="sdp-access-status" role="status" aria-live="polite"></p>' +
      '<details id="sdpAccessCodePath" class="sdp-access-codepath">' +
      '<summary class="sdp-access-codesum">' + esc(t('codeToggle')) + '</summary>' +
      '<div class="sdp-access-form">' +
      '<label class="sdp-access-lbl" for="sdpAccessCode">' + esc(t('codeLabel')) + '</label>' +
      '<input id="sdpAccessCode" class="sdp-access-input" type="password" autocomplete="off" maxlength="32" inputmode="numeric">' +
      '<button id="sdpAccessCodeBtn" type="button" class="sdp-access-btn">' + esc(t('codeGo')) + '</button>' +
      '</div>' +
      '</details>' +
      '<p id="sdpAccessOffline" class="sdp-access-offline" hidden>' + esc(t('offline')) + '</p>' +
      '<a id="sdpAccessLecturerLink" class="sdp-access-lecturer" href="#studio" onclick="return false;">🗝️ ' + esc(t('lecturer')) + '</a>' +
      '</div></div>';
  }

  function mountOverlay() {
    if (byId('sdpAccessLock')) return true;
    var host = doc.body || doc.documentElement;
    if (!host) return false;
    /* paint the overlay BEFORE the app data loads: hide every screen shell */
    try { doc.body.setAttribute('data-access-lock', '1'); } catch (e) {}
    var holder = doc.createElement('div');
    holder.innerHTML = overlayMarkup();
    host.appendChild(holder.firstChild);
    try {
      var app = byId('app');
      if (app) app.setAttribute('hidden', 'hidden');
    } catch (e2) {}
    wireOverlay();
    return true;
  }
  function unmountOverlay() {
    var node = byId('sdpAccessLock');
    if (node && node.parentNode) node.parentNode.removeChild(node);
    try { doc.body.removeAttribute('data-access-lock'); } catch (e) {}
    try {
      var app = byId('app');
      if (app) app.removeAttribute('hidden');
    } catch (e2) {}
    /* the app shell is structured as top-level <main>/sections — unhide all */
    try {
      var mains = doc.querySelectorAll ? doc.querySelectorAll('main, #app > *') : [];
      for (var i = 0; i < mains.length; i++) mains[i].removeAttribute('hidden');
    } catch (e3) {}
  }
  function status(text, kind) {
    var node = byId('sdpAccessStatus');
    if (!node) return;
    node.textContent = str(text);
    node.setAttribute('data-state', kind || '');
  }

  /* ── actions ─────────────────────────────────────────────────────────── */
  function requestAccess() {
    var nameNode = byId('sdpAccessName');
    var classNode = byId('sdpAccessClass');
    state.name = str(nameNode && nameNode.value).trim();
    state.classId = str(classNode && classNode.value).trim();
    if (!state.name) { status(t('name'), 'bad'); return; }
    status(t('requesting'), '');
    state.pending = true;
    fingerprint(function (fp) {
      relay({
        action: 'access_request',
        name: state.name, classId: state.classId,
        deviceId: state.deviceId, fp: fp
      }, function (err, out) {
        if (err || !out) { status(t('net'), 'bad'); return; }
        if (out.err === 'rate') { status(t('rate'), 'bad'); return; }
        if (out.skip === 'open') { grant('open'); return; }
        startPoll();
      });
    });
  }

  var pollTimer = null, pollCount = 0;
  function startPoll() {
    stopPoll();
    pollTimer = global.setInterval(function () {
      pollCount += 1;
      relay({ action: 'check_device', deviceId: state.deviceId, token: state.token }, function (err, out) {
        if (err || !out) return; /* offline: keep polling quietly */
        if (out.approved) { if (out.token) { state.token = str(out.token); state.grantedAt = nowMs(); save(); } stopPoll(); grant('approved'); }
        else if (out.err === 'revoked') { stopPoll(); status(t('rejected'), 'bad'); }
      });
      /* the poll also refreshes the config-side state (LOCK ON→OFF flips) */
      if (pollCount % 5 === 0) refreshState();
    }, POLL_MS);
  }
  function stopPoll() { if (pollTimer) { global.clearInterval(pollTimer); pollTimer = null; } }

  function enterCode() {
    var node = byId('sdpAccessCode');
    var code = str(node && node.value).trim();
    if (!code) return;
    fingerprint(function (fp) {
      relay({
        action: 'verify_lock_secret',
        deviceId: state.deviceId, fp: fp,
        name: state.name, classId: state.classId,
        secret: code
      }, function (err, out) {
        if (err || !out) { status(t('net'), 'bad'); return; }
        if (out.err === 'rate') { status(t('rate'), 'bad'); return; }
        if (out.ok) { if (out.token) { state.token = str(out.token); state.grantedAt = nowMs(); save(); } grant(out.by || 'secret'); return; }
        status(out.err === 'invalid code' || out.err === 'code already burned on another device (single-use law)' ? t('codeBad') : t('codeBad'), 'bad');
      });
    });
  }

  function grant(by) {
    state.grantedAt = nowMs();
    state.lastHeartbeat = nowMs();
    state.pending = false;
    save();
    status(t('approved'), 'ok');
    global.setTimeout(function () {
      stopHeartbeat();
      unmountOverlay();
      state.armed = false;
      startHeartbeat();
      try {
        if (global.SDP && SDP.Views && SDP.Views.repaintAll) SDP.Views.repaintAll();
      } catch (e) {}
      try {
        var ev = doc.createEvent ? doc.createEvent('CustomEvent') : null;
        if (ev) { ev.initCustomEvent('sdp:access-granted', false, false, { by: by }); doc.dispatchEvent(ev); }
      } catch (e2) {}
    }, 600);
  }

  /* ── 72 h offline grace + periodic heartbeat ─────────────────────────── */
  var heartbeatTimer = null;
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = global.setInterval(heartbeat, HEARTBEAT_MS);
    global.setTimeout(heartbeat, 800);
  }
  function stopHeartbeat() { if (heartbeatTimer) { global.clearInterval(heartbeatTimer); heartbeatTimer = null; } }
  function heartbeat() {
    if (!state.token || !state.grantedAt) return;
    if (nowMs() - state.grantedAt > GRACE_MS) { /* the 72 h offline ceiling */
      state.token = ''; state.grantedAt = 0; save();
      arm(true);
      return;
    }
    relay({ action: 'check_device', deviceId: state.deviceId, token: state.token }, function (err, out) {
      if (err || !out) {
        /* offline: show the grace note once, keep the session alive */
        var note = byId('sdpAccessOffline');
        if (note) note.hidden = false;
        return;
      }
      state.lastHeartbeat = nowMs(); save();
      if (out.approved) {
        var note2 = byId('sdpAccessOffline');
        if (note2) note2.hidden = true;
        return;
      }
      if (out.err === 'revoked' || out.err === 'expired' || out.err === 'bad token') {
        /* instant remote revoke / expiry: re-lock immediately */
        state.token = ''; state.grantedAt = 0; save();
        arm(true);
      }
    });
  }

  /* ── the gate: called on boot, before any data paints ────────────────── */
  function refreshState(cb) {
    cb = cb || noop;
    relay({ action: 'access_state' }, function (err, out) {
      if (err || !out || !out.lock) { cb(false, null); return; }
      state.lockOn = !!out.lock.on;
      cb(false, out.lock);
    });
  }
  function gate(cb) {
    cb = cb || noop;
    load();
    if (!state.token || !state.grantedAt) {
      /* no device-bound grant on this browser: ask the cloud if locked */
      refreshState(function (_e, lock) {
        if (lock && lock.on) { arm(true); cb(true, 'locked'); return; }
        cb(false, lock ? 'open' : 'unknown');
      });
      return;
    }
    /* a stored grant exists: honour the 72 h offline grace first, verify online */
    if (nowMs() - state.grantedAt > GRACE_MS) {
      state.token = ''; state.grantedAt = 0; save();
      refreshState(function (_e, lock) {
        if (lock && lock.on) { arm(true); cb(true, 'expired'); return; }
        cb(false, 'open');
      });
      return;
    }
    refreshState(function (_e, lock) {
      if (lock && !lock.on) { cb(false, 'open'); return; } /* LOCK OFF: open to all */
      if (lock && lock.on) {
        /* online: verify the token against the revocation list */
        relay({ action: 'check_device', deviceId: state.deviceId, token: state.token }, function (err, out) {
          if (out && out.approved) { startHeartbeat(); cb(false, 'granted'); return; }
          if (err || !out) { startHeartbeat(); cb(false, 'grace'); return; } /* offline grace */
          state.token = ''; state.grantedAt = 0; save();
          arm(true);
          cb(true, out.err || 'revoked');
        });
        return;
      }
      startHeartbeat();
      cb(false, 'grace');
    });
  }
  function arm(syncCloud) {
    state.armed = true;
    mountOverlay();
    if (syncCloud !== false) refreshState(function () {});
  }

  /* ── overlay wiring (ES5 DOM only) ──────────────────────────────────── */
  function wireOverlay() {
    function on(id, evt, fn) {
      var node = byId(id);
      if (node) node[evt === 'click' ? 'onclick' : 'on' + evt] = fn;
    }
    on('sdpAccessRequestBtn', 'click', requestAccess);
    on('sdpAccessCodeBtn', 'click', enterCode);
    on('sdpAccessCode', 'keydown', function (ev) {
      ev = ev || global.event;
      if (ev && ev.keyCode === 13) enterCode();
    });
    /* the subtle Lecturer Studio owner entry: jumps to the studio tab so the
       owner can ALWAYS reach Lecturer Admin Studio → Advanced Settings to
       toggle LOCK OFF, even on a brand-new phone while LOCK ON is active. */
    on('sdpAccessLecturerLink', 'click', function (ev) {
      ev = ev || global.event;
      if (ev && ev.preventDefault) ev.preventDefault();
      try {
        var tab = byId('tab-studio');
        if (tab) tab.click();
        var rail = byId('rail-studio');
        if (rail && !tab) rail.click();
      } catch (e) {}
      try {
        var evn = doc.createEvent('CustomEvent');
        if (evn) { evn.initCustomEvent('sdp:access-lecturer-entry', false, false, {}); doc.dispatchEvent(evn); }
      } catch (e2) {}
      return false;
    });
  }

  /* ── public API ──────────────────────────────────────────────────────── */
  SDP.AccessLock = {
    version: '0.0.7.e',
    key: STORE_KEY,
    gate: gate,
    arm: arm,
    disarm: function () { stopPoll(); stopHeartbeat(); unmountOverlay(); state.armed = false; return true; },
    isArmed: function () { return !!(state.armed || byId('sdpAccessLock')); },
    state: function () {
      return {
        armed: state.armed, lockOn: state.lockOn, deviceId: state.deviceId,
        fp: state.fp, token: state.token, grantedAt: state.grantedAt,
        lastHeartbeat: state.lastHeartbeat, pending: state.pending,
        withinGrace: !!state.token && (nowMs() - state.grantedAt) <= GRACE_MS
      };
    },
    requestAccess: requestAccess,
    enterCode: enterCode,
    fingerprint: fingerprint,
    heartbeat: heartbeat,
    refreshState: refreshState,
    deviceId: function () { load(); return state.deviceId; },
    strings: function () { return { en: L.en, si: L.si }; }
  };

  /* boot: when the DOM exists, run the gate once (LOCK OFF passes silently). */
  function boot() { gate(); }
  /* v0.0.7.e: the first gate runs pre-data (config may not be loaded yet, so a
     missing relay reads as unknown). When SDP.Sync finishes booting it emits
     sdp:ready — re-run the gate so a late config.accessLock / relay URL is
     honoured and an armed overlay is removed if the cloud says LOCK OFF. */
  function onReady() { if (state.armed) { refreshState(function (e, lock) { if (lock && !lock.on) { unmountOverlay(); state.armed = false; } }); } }
  if (doc && doc.addEventListener) {
    doc.addEventListener('sdp:ready', function () { try { onReady(); } catch (eR) {} }, false);
  }
  if (doc) {
    if (doc.readyState === 'loading' && doc.body === null) doc.addEventListener('DOMContentLoaded', function () { boot(); }, false);
    else boot();
    /* v0.0.7.e FIX: a defer script at the end of body can evaluate while
       readyState is still 'loading' WITH a body present — the DOMContentLoaded
       listener would then fire correctly, but some embedded webviews deliver
       'interactive' before body parsing finishes. The belt-and-braces fallback
       runs the gate once more on the next tick; gate() is idempotent (an armed
       overlay never repaints twice, an open app passes silently). */
    global.setTimeout(function () { try { if (!state.armed && !byId('sdpAccessLock')) gate(); } catch (eFB) {} }, 900);
  }
})(typeof window !== 'undefined' ? window : this);
