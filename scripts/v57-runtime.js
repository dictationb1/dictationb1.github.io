/* v57 runtime repair. This source is inlined inside the app closure by
 * scripts/build-v57.cjs; it is not a separate browser dependency. ES5 only. */
(function () {
  'use strict';
  var SessionSecrets = {
    get: function (name) { try { return window.sessionStorage.getItem('sdp.session.' + name) || ''; } catch (e) { return ''; } },
    set: function (name, value) { try { if (value) window.sessionStorage.setItem('sdp.session.' + name, String(value)); else window.sessionStorage.removeItem('sdp.session.' + name); } catch (e) {} },
    clear: function () { this.set('elKey', ''); this.set('ghToken', ''); this.set('admin', ''); }
  };
  window.SDPSessionSecrets = SessionSecrets;
  var migrateBeforeSecurity = DB.migrate;
  DB.migrate = function (data) {
    var previous = Number(data && data.settingsRev) || 0;
    var result = migrateBeforeSecurity.apply(this, arguments) || data;
    result.settings = result.settings || {};
    result.admin = result.settings;
    if (previous < 57 || result.settings.pinKdf !== 'sha256-v2') {
      result.settings.pinHash = ''; result.settings.pinSalt = ''; result.settings.pinKdf = 'sha256-v2';
      result.settings.fails = 0; result.settings.lockUntil = 0;
    }
    result.settingsRev = 57; result.v = 57;
    return result;
  };
  function isAdmin() { return !!(Admin && Admin.unlocked && DB.data && DB.data.settings && DB.data.settings.pinHash); }
  Admin.isUnlockedOnThisDevice = function () {
    var marked = false;
    try { marked = SessionSecrets.get('admin') === '1'; } catch (e) {}
    return isAdmin() && marked;
  };
  function stripSecrets(value, capture) {
    var k, child;
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (k = 0; k < value.length; k++) stripSecrets(value[k], capture); return; }
    for (k in value) if (Object.prototype.hasOwnProperty.call(value, k)) {
      if (k === 'adminPin' || k === 'elevenLabsKey' || k === 'ghToken' || k === 'elKey' || k === 'xiApiKey') {
        if (capture && value[k]) SessionSecrets.set(k === 'ghToken' ? 'ghToken' : 'elKey', value[k]);
        delete value[k];
      } else if (typeof value[k] === 'string' && /(?:sk_|ghp_)[A-Za-z0-9_-]{16,}/.test(value[k])) {
        value[k] = value[k].replace(/(?:sk_|ghp_)[A-Za-z0-9_-]{16,}/g, '[removed]');
      } else if (value[k] && typeof value[k] === 'object') stripSecrets(value[k], capture);
    }
  }
  function scrubStorage(capture) {
    var keys = [], i, key, raw, obj;
    try {
      for (i = 0; i < window.localStorage.length; i++) { key = window.localStorage.key(i); if (key && /^sdp\./.test(key)) keys.push(key); }
      for (i = 0; i < keys.length; i++) {
        key = keys[i]; raw = window.localStorage.getItem(key);
        if (!raw || !/^\s*[\[{]/.test(raw)) continue;
        try { obj = JSON.parse(raw); stripSecrets(obj, capture); window.localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
      }
    } catch (e) {}
  }
  var saveBeforeSecurity = DB.saveNow;
  DB.saveNow = function () {
    stripSecrets(this.data, false);
    scrubStorage(false);
    return saveBeforeSecurity.apply(this, arguments);
  };
  var loadBeforeSecurity = DB.load;
  DB.load = function () {
    var active = SessionSecrets.get('admin') === '1', result;
    scrubStorage(active);
    result = loadBeforeSecurity.apply(this, arguments);
    stripSecrets(this.data, active);
    return result;
  };
  var exportBeforeSecurity = DB.exportAll;
  DB.exportAll = function () {
    var doc = JSON.parse(exportBeforeSecurity.apply(this, arguments));
    stripSecrets(doc, false);
    if (doc.data) { doc.data.vaultCiphertext = ''; doc.data.admin = {}; if (doc.data.settings) { delete doc.data.settings.pinHash; delete doc.data.settings.pinSalt; } }
    return JSON.stringify(doc, null, 1);
  };
  Cloud.ghToken = function (value) {
    if (typeof value === 'undefined') return isAdmin() ? SessionSecrets.get('ghToken') : '';
    if (!isAdmin()) return '';
    SessionSecrets.set('ghToken', String(value || '').replace(/^\s+|\s+$/g, ''));
    return SessionSecrets.get('ghToken');
  };
  var unlockBeforeSecurity = Admin.unlock, lockBeforeSecurity = Admin.lock;
  Admin.unlock = function () {
    if (!DB.data.settings.pinHash) return false;
    SessionSecrets.set('admin', '1');
    var result = unlockBeforeSecurity.apply(this, arguments);
    try { EncryptedVault.applyRemoteVault(DB.data.vaultCiphertext, this.pin, function () {}); } catch (e) {}
    return result;
  };
  Admin.lock = function () { SessionSecrets.clear(); return lockBeforeSecurity.apply(this, arguments); };
  try { window.addEventListener('pagehide', function () { SessionSecrets.clear(); }); } catch (e) {}

  /* The public repository carries lessons and clips, never a key vault. */
  var vault = window.EncryptedVault;
  vault.PIN = '';
  vault.encrypt = function () { return null; };
  vault.isVault = function (s) { return typeof s === 'string' && (s.indexOf('SDP_ENC_V2:') === 0 || s.indexOf('SDP_ENC_V1:') === 0); };
  vault.publicPayload = function () { return { ver: 57, appVersion: '6.3.0', syncRev: Number(DB.data.syncRev) || 0 }; };
  vault.keyEnvelope = function () { return this.publicPayload(); };
  vault.fullEnvelope = function () { return this.publicPayload(); };
  vault.payload = function () {
    return { syncRev: Number(DB.data.syncRev) || 0, activeVideoSrc: String(DB.data.settings.activeVideoSrc || ''),
      videoDim: Number(DB.data.settings.videoDim), mode: String(DB.data.settings.mode || 'paper'),
      writeFixed: Number(DB.data.settings.writeFixed) || 5, repeats: Number(DB.data.settings.repeats) || 2 };
  };
  vault.localEnvelopeAsync = function (pin) { return this.encryptAsync(this.payload(), pin); };
  vault.applyRemoteVault = function (cipher, pin, done) {
    var self = this, once = U.once(done || function () {});
    if (!Admin.isUnlockedOnThisDevice() || !pin || !this.isVault(cipher)) { once(null); return Promise.resolve(null); }
    var legacy = cipher.indexOf('SDP_ENC_V1:') === 0;
    if (legacy && DB.data.vaultMigrated) { once(null); return Promise.resolve(null); }
    return Promise.resolve().then(function () {
      return legacy ? self.decrypt(cipher, pin) : self.decryptAsync(cipher, pin);
    }).then(function (plain) {
      if (!plain || !Admin.isUnlockedOnThisDevice()) { once(null); return null; }
      if (plain.elevenLabsKey) SessionSecrets.set('elKey', plain.elevenLabsKey);
      if (plain.ghToken) SessionSecrets.set('ghToken', plain.ghToken);
      DB.data.vaultMigrated = true;
      return self.encryptAsync(self.payload(), pin).then(function (v2) {
        DB.data.vaultCiphertext = v2 || '';
        stripSecrets(DB.data, false); DB.saveNow(); once(plain); return plain;
      });
    })['catch'](function () { once(null); return null; });
  };
  var commitBeforeSecurity = Cloud.commitFiles;
  Cloud.commitFiles = function (files, message, done) {
    done = done || function () {};
    if (!Admin.isUnlockedOnThisDevice() || !this.ghToken()) { done({ ok: false, err: 'Unlock Lecturer Mode and connect GitHub on this tab first.' }); return false; }
    var needsPreview = false, fi;
    for (fi = 0; fi < (files || []).length; fi++) if (/data\/(session|config)\.json$/.test(String(files[fi].p || ''))) needsPreview = true;
    if (needsPreview && !this.__sdpPreviewDone && window.SDPPublishPreview) {
      var self = this;
      window.SDPPublishPreview(function (list) {
        if (!list) { done({ ok: false, err: 'Publish cancelled.' }); return; }
        self.__sdpPreviewDone = true;
        Cloud.commitFiles(files, message, function (r) { self.__sdpPreviewDone = false; done(r); });
      });
      return true;
    }
    var i, text;
    for (i = 0; i < (files || []).length; i++) {
      text = String(files[i].text || '');
      if (/"(?:adminPin|elevenLabsKey|ghToken|vaultCiphertext)"\s*:\s*"[^"]+"/.test(text) || /(?:sk_|ghp_)[A-Za-z0-9_-]{16,}/.test(text)) {
        done({ ok: false, err: 'Public commit blocked: secret or key vault detected.' }); return false;
      }
    }
    return commitBeforeSecurity.call(this, files, message, done);
  };
  scrubStorage(SessionSecrets.get('admin') === '1');

  function updateTopData(live) {
    var mb = document.getElementById('topDataMB'), lkr = document.getElementById('topDataLkr');
    var si = DB.data && DB.data.settings && DB.data.settings.lang === 'si';
    if (mb) mb.textContent = live.sessionMB + ' MB';
    if (lkr) lkr.textContent = (si ? 'රු. ' : 'Rs. ') + live.costSessionLkr.toFixed(2);
    var btn = document.getElementById('btnDataSheet') || document.getElementById('topDataBadge');
    if (btn) btn.setAttribute('aria-label', 'Open live data sheet: ' + live.sessionMB + ' MB, ' + live.costSessionLkr.toFixed(2) + ' LKR');
  }
  var bootBeforeData = boot;
  boot = function () {
    var result = bootBeforeData.apply(this, arguments), M = window.SDPDataMeter || window.SDP_DATA_METER;
    if (M && typeof M.start === 'function') {
      M.start(); updateTopData(M.getLive());
      if (!window.__sdpTopDataTick) { window.__sdpTopDataTick = M.onTick(updateTopData); }
    }
    return result;
  };
})();
