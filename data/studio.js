/*! Smart Dictation Player — Lecturer Studio & admin vault (v0.0.1.d)
 * Strict ES5, dependency free.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 publishing, §R7 vault
 * contract: docs/UI_COMPONENT_GUIDE.md §Settings 6th section (collapsed)
 * The studio is the ONLY place that touches a GitHub token or an ElevenLabs
 * key, and only while unlocked; secrets never reach localStorage. */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;
  var VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2';
  var VOICE_MODEL = 'eleven_flash_v2_5';
  var EL_SUBSCRIPTION = 'https://api.elevenlabs.io/v1/user/subscription';
  var GUIDE_KEYS = ['_guide_1', '_guide_2', '_guide_3', '_guide_4'];
  var WORD_CAP = 30;

  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function setText(el, text) { if (el) el.textContent = str(text); }
  function esc(text) {
    return str(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function t(key, fallback) {
    try { if (SDP.Views && SDP.Views.t) return SDP.Views.t(key, fallback); } catch (e) {}
    return fallback === undefined ? key : fallback;
  }
  function en(key) {
    var table = SDP.STRINGS_EN || {};
    return str(table[key]);
  }
  function data() { return SDP.Data || null; }
  function sync() { return SDP.Sync || null; }
  function vault() { return SDP.Sync && SDP.Sync.Vault ? SDP.Sync.Vault : null; }

  /* ══ D-S3: the studio version is READ, never hardcoded ═══════════════════
   * v0.0.1.b shipped `var APP_VERSION = '0.0.1.a'`, so every publish stamped an
   * older version into version.json — and every open device dutifully reloaded
   * itself into the past, in a loop. */
  function appVersion() {
    var v = '';
    try { v = str(global.SDP && global.SDP.version); } catch (e) { v = ''; }
    if (!v) v = str(global.__SDP_BOOT_VERSION__);
    if (!v) {
      /* last resort: the header pill is the boot target rendered into the page */
      var pill = global.document && global.document.getElementById ? global.document.getElementById('sdpVerPill') : null;
      if (pill) v = str(pill.textContent).replace(/^v/i, '').trim();
    }
    return v;
  }
  function schemaVer() {
    var n = 0;
    try { n = Number(global.SDP && global.SDP.ver); } catch (e) { n = 0; }
    return n > 0 ? n : 3;
  }
  /** D-S4: settingsRev only ever moves forward. */
  function nextSettingsRev() {
    var current = 0;
    try { current = Number((sync() && sync().version() && sync().version().settingsRev) || 0); } catch (e) { current = 0; }
    return Math.max(schemaVer(), current + 1);
  }
  /** D19: ONE monotonic publish clock. Every JSON file committed in the same
   * publish (config / session / voice pack / version) is stamped with this
   * same syncRev, so a device can never see a config newer than its version.
   * Date.now() wins unless the previous publish is somehow ahead of it, in
   * which case we step exactly one tick past it. */
  function nextSyncRev() {
    var prev = 0;
    try { prev = Number((sync() && sync().version() && sync().version().syncRev) || 0); } catch (e) { prev = 0; }
    return Math.max(Date.now(), prev + 1);
  }

  var ST = {
    unlocked: false,
    envelope: '',
    secrets: {},
    message: '',
    messageState: '',
    words: [],
    preview: null,
    pendingClip: null,
    lastPublish: null,
    generating: false,
    /* Memory-only, never persisted and never transmitted (W6). It exists so
       "Save keys" can re-encrypt the vault without asking for the PIN twice. */
    pin: '',
    recording: false,
    recorder: null,
    quota: null,
    voicePack: { loaded: false, clips: {}, rev: 0 },
    testStatus: '',
    testState: ''
  };

  /* ══ envelope resolution (D-S7) ════════════════════════════════════════ */
  function cachedVault() {
    try {
      var s = data() && data().settings ? data().settings() : null;
      return s ? str(s.cachedVault) : '';
    } catch (e) { return ''; }
  }
  function cdnEnvelope() {
    var cfg = sync() && sync().config ? sync().config() : null;
    return str(cfg && cfg.encVault);
  }
  function isRealEnvelope(env) {
    var e = str(env);
    if (e.indexOf('SDP_ENC_V2:') !== 0) return false;
    var v = vault();
    if (v && v.isEmptyEnvelope) return !v.isEmptyEnvelope(e);
    return e.length > 32;
  }
  /* Synchronous best answer: memory -> localStorage -> CDN config. */
  function configEnvelope() {
    if (isRealEnvelope(ST.envelope)) return ST.envelope;
    var local = cachedVault();
    if (isRealEnvelope(local)) return local;
    return cdnEnvelope();
  }
  /* Asynchronous full resolution: also asks api.github.com, and lets the
     newest non-empty envelope win (Device B, ~1s after Device A saved keys). */
  function resolveEnvelope(cb) {
    cb = cb || noop;
    var localRev = 0;
    try { localRev = Number((data().settings().cachedVaultSyncRev) || 0); } catch (e) { localRev = 0; }
    var best = { env: '', rev: 0 };
    function consider(env, rev) {
      if (!isRealEnvelope(env)) return;
      if (!best.env || Number(rev || 0) >= best.rev) best = { env: str(env), rev: Number(rev || 0) };
    }
    consider(configEnvelope(), localRev || Date.now());
    var s = sync();
    if (!s || !s.fetchRawGitHubJson) { cb(best.env || configEnvelope()); return best.env; }
    s.fetchRawGitHubJson('data/config.json', function (err, cfg) {
      if (!err && isObj(cfg)) {
        consider(cfg.encVault, Math.max(Number(cfg.settingsRev || 0), Number((sync().version() || {}).syncRev || 0)));
      }
      var cdn = cdnEnvelope();
      consider(cdn, Number((sync().version() || {}).settingsRev || 0));
      ST.envelope = best.env || configEnvelope();
      cb(ST.envelope);
    });
    return configEnvelope();
  }
  function hasVault() { return isRealEnvelope(configEnvelope()); }

  function msg(text, state) {
    ST.message = str(text);
    ST.messageState = state || '';
    var node = byId('studioMsg');
    if (!node) return;
    node.textContent = ST.message;
    if (state) node.setAttribute('data-state', state); else node.removeAttribute('data-state');
  }
  function testStatus(text, state) {
    ST.testStatus = str(text);
    ST.testState = state || '';
    var node = byId('studioTestStatus');
    if (!node) return;
    node.textContent = ST.testStatus;
    if (state) node.setAttribute('data-state', state); else node.removeAttribute('data-state');
  }
  function toast(text) {
    try { if (SDP.Views && SDP.Views.showToast) SDP.Views.showToast(str(text)); } catch (e) {}
  }

  /* ── word parsing: "w | ipa | pos | meaning | sinhala | sentence" ────── */
  function parseWords(text) {
    var lines = str(text).split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = str(lines[i]).replace(/^\s+|\s+$/g, '');
      if (!line || line.charAt(0) === '#') continue;
      var parts = line.indexOf('|') >= 0 ? line.split('|') : line.split('\t');
      for (var p = 0; p < parts.length; p++) parts[p] = str(parts[p]).replace(/^\s+|\s+$/g, '');
      if (!parts[0]) continue;
      out.push({
        w: parts[0], p: parts[1] || '', pos: parts[2] || '', m: parts[3] || '',
        si: parts[4] || '', s: parts[5] || '', audio: parts[6] || ''
      });
    }
    return out;
  }
  function wordsToText(words) {
    var lines = [], i;
    for (i = 0; i < (words || []).length; i++) {
      var w = words[i] || {};
      lines.push([str(w.w), str(w.p), str(w.pos), str(w.m), str(w.si), str(w.s)].join(' | '));
    }
    return lines.join('\n');
  }

  /* ── payload builders (pure, unit-testable, no network) ──────────────── */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §H3 version schema */
  function buildVersionPayload(sessionNo, title, syncRev) {
    var nowIso = new Date().toISOString();
    var version = appVersion();
    return {
      ver: schemaVer(),
      appVersion: version,
      version: version,
      buildDate: nowIso.slice(0, 10),
      schema: schemaVer(),
      settingsRev: nextSettingsRev(),
      session: str(sessionNo || '8'),
      title: str(title || 'Session ' + str(sessionNo || '8')),
      updatedAt: nowIso,
      syncRev: Number(syncRev) || nextSyncRev()
    };
  }
  function buildSessionPayload(words, opts) {
    opts = opts || {};
    var base = sync() && sync().session ? JSON.parse(JSON.stringify(sync().session() || {})) : { ok: true, lists: [] };
    var listId = str(opts.listId || (sync() && sync().state ? sync().state.listId : '') || 'list_session_8_feelings');
    var list = null, i;
    var version = appVersion();
    var lists = Array.isArray(base.lists) ? base.lists : [];
    for (i = 0; i < lists.length; i++) if (lists[i] && lists[i].id === listId) list = lists[i];
    if (!list) {
      list = { id: listId, name: str(opts.title || 'Session ' + version), version: version, session: 'Session ' + version, date: new Date().toISOString().slice(0, 10), active: true, words: [] };
      lists.unshift(list);
    }
    var clean = [];
    for (i = 0; i < (words || []).length; i++) {
      var w = words[i] || {};
      var cleanWord = {
        w: str(w.w), p: str(w.p), pos: str(w.pos), m: str(w.m), si: str(w.si), s: str(w.s)
      };
      /* D19: keep the dictionary pronunciation URL. Stripping it made every
         freshly published word fall to robotic TTS on voiceless browsers —
         the real British human recording must survive a Studio publish. */
      if (str(w.audio)) cleanWord.audio = str(w.audio);
      clean.push(cleanWord);
    }
    list.words = clean;
    list.active = true;
    list.version = version;
    base.lists = lists;
    base.words = clean;
    /* D-L9: the cockpit reads base.session.words; leaving it empty made a
       freshly published session look truncated on the device that pulled it. */
    base.session = isObj(base.session) ? base.session : {};
    base.session.words = clean;
    base.session.no = str(opts.sessionNo || base.session.no || '8');
    base.session.title = str(opts.title || base.session.title || 'Session ' + appVersion());
    base.ok = true;
    base.updatedAt = new Date().toISOString();
    return base;
  }
  function voicePackPayload(syncRev) {
    var base = { version: appVersion(), appVersion: appVersion(), ver: schemaVer(), schema: schemaVer(), settingsRev: nextSettingsRev() };
    var remote = null;
    try { remote = SDP.Speech && SDP.Speech.state ? SDP.Speech.state.manifest : null; } catch (e) { remote = null; }
    if (isObj(remote)) for (var k in remote) if (Object.prototype.hasOwnProperty.call(remote, k) && base[k] === undefined) base[k] = remote[k];
    base.voiceId = VOICE_ID;
    base.modelId = VOICE_MODEL;
    base.clips = ST.voicePack.clips || {};
    base.updatedAt = new Date().toISOString();
    /* D19: same publish clock as config.json / version.json in this commit. */
    base.syncRev = Number(syncRev) || nextSyncRev();
    return base;
  }
  function buildPublishPayloads(words, opts) {
    opts = opts || {};
    var session = buildSessionPayload(words, opts);
    var version = buildVersionPayload(
      opts.sessionNo || (session.session && session.session.no) || '8',
      opts.title || (session.session && session.session.title) || '',
      opts.syncRev || nextSyncRev());
    var cfgBase = sync() && sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
    /* D-S2: v0.0.1.b cloned the remote config and never set encVault, so the
       very next publish erased the lecturer's encrypted keys from GitHub. */
    var env = str(opts.envelope) || (isRealEnvelope(ST.envelope) ? ST.envelope : configEnvelope());
    cfgBase.ver = schemaVer();
    cfgBase.appVersion = appVersion();
    cfgBase.version = appVersion();
    cfgBase.schema = schemaVer();
    cfgBase.settingsRev = Number(version.settingsRev);
    cfgBase.encVault = str(env);
    cfgBase.updatedAt = new Date().toISOString();
    cfgBase.syncRev = Number(version.syncRev);
    return {
      session: session,
      version: version,
      config: cfgBase,
      files: {
        'data/session.json': JSON.stringify(session, null, 2),
        'data/version.json': JSON.stringify(version, null, 2),
        'data/config.json': JSON.stringify(cfgBase, null, 2)
      }
    };
  }

  /* ══ PIN unlock / first-time setup ════════════════════════════════════ */
  function persistEnvelope(envelope) {
    /* D-S1: the encrypted envelope must survive a reload even if the lecturer
       never presses Publish. memory -> localStorage -> live sync config. */
    try {
      data().saveSettings({ cachedVault: str(envelope), cachedVaultSyncRev: Date.now() });
    } catch (e) {}
    try {
      var cfg = sync() && sync().config ? sync().config() : null;
      if (cfg) cfg.encVault = str(envelope);
    } catch (e) {}
    return true;
  }

  /* ══ R1: the ten classroom keys the lecturer owns ═══════════════════════ */
  var CLASS_SETTING_KEYS = [
    'mode', 'writeSecs', 'repeats', 'pauseSecs', 'autoAdvance',
    'pacingPreset', 'voiceLock', 'voiceSource', 'rate', 'theme'
  ];
  function classSettingsSnapshot() {
    var out = {}, conf = {};
    try { conf = data() && data().settings ? data().settings() : {}; } catch (e) { conf = {}; }
    for (var i = 0; i < CLASS_SETTING_KEYS.length; i++) {
      var k = CLASS_SETTING_KEYS[i];
      if (conf[k] !== undefined && conf[k] !== null) out[k] = conf[k];
    }
    return out;
  }
  function buildVaultFiles(cfgBody, versionBody, message) {
    return [
      { path: 'data/config.json', content: JSON.stringify(cfgBody, null, 2), message: str(message || 'Studio vault ' + appVersion()) },
      { path: 'data/version.json', content: JSON.stringify(versionBody, null, 2), message: 'Studio version ' + appVersion() }
    ];
  }
  /* config.json first, version.json LAST (SYNC-03 / SYNC-07). */
  function publishVaultFiles(files, token, cb) {
    cb = cb || noop;
    if (!sync() || !sync().publishFilesSequential) { cb(new Error('no_sync')); return false; }
    return sync().publishFilesSequential(files, token, noop, function (err, info) {
      if (!err) {
        try {
          var cfg = sync().config ? sync().config() : null;
          if (cfg) cfg.settingsRev = nextSettingsRev();
        } catch (e) {}
      }
      cb(err, info);
    });
  }
  /* ══ SYNC-03: save & sync the ten classroom keys to every device ════════
   * Copies the lecturer's live settings into config.classSettings, bumps
   * settingsRev, stamps syncRev and commits config.json + version.json. */
  function saveClassSettings(cb) {
    cb = cb || noop;
    if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
    var conf = classSettingsSnapshot();
    if (!sync() || !sync().publishFilesSequential) { cb(new Error('no_sync')); return { ok: false, reason: 'no_sync' }; }
    var cfgBody = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
    cfgBody.classSettings = conf;
    cfgBody.ver = schemaVer();
    cfgBody.appVersion = appVersion();
    cfgBody.version = appVersion();
    cfgBody.schema = schemaVer();
    var liveVersion = sync().version ? (sync().version() || {}) : {};
    var liveSession = str(liveVersion.session || '8') || '8';
    var liveTitle = str(liveVersion.title || '') || ('Session ' + liveSession);
    var versionBody = buildVersionPayload(liveSession, liveTitle, nextSyncRev());
    var rev = Number(versionBody.settingsRev);
    var nowIso = new Date().toISOString();
    cfgBody.settingsRev = rev;
    cfgBody.updatedAt = nowIso;
    cfgBody.syncRev = Number(versionBody.syncRev);
    var env = (isRealEnvelope(ST.envelope) ? ST.envelope : configEnvelope());
    if (env) cfgBody.encVault = str(env);
    var token = str(ST.secrets.ghToken);
    var last = byId('lecturerSyncLast');
    function stamp(ok, detail) {
      if (!last) return;
      var when = new Date().toISOString().slice(11, 16);
      last.textContent = (ok ? t('lecturerSyncLast') : t('studioPublishFail')) + ' · ' + when +
        (detail ? ' · ' + detail : '');
      last.setAttribute('data-state', ok ? 'ok' : 'bad');
    }
    if (!token) {
      msg(t('studioNoToken'), 'bad');
      stamp(false, 'no token');
      cb(new Error('no_token'));
      return { ok: false, reason: 'no_token', classSettings: conf };
    }
    publishVaultFiles(buildVaultFiles(cfgBody, versionBody, 'Class settings rev ' + rev), token, function (err, info) {
      if (err) { msg(t('studioPublishFail'), 'bad'); stamp(false, 'rev ' + rev); cb(err, info); return; }
      try { if (data() && data().saveSettings) data().saveSettings({ appliedSettingsRev: rev }); } catch (e) {}
      msg(t('studioPublishOk') + ' · Rev #' + rev, 'ok');
      toast(t('lecturerSyncBar') + ' · Rev #' + rev);
      stamp(true, 'Rev #' + rev);
      cb(null, info || { ok: true, settingsRev: rev, classSettings: conf });
    });
    return { ok: true, settingsRev: rev, classSettings: conf };
  }

  function clearVaultLock() {
    try { if (vault() && vault().resetLock) vault().resetLock(); } catch (e) {}
    return true;
  }
  function pinVerifier() {
    var cfg = sync() && sync().config ? sync().config() : null;
    return cfg && isObj(cfg.pinVerifier) ? cfg.pinVerifier : null;
  }
  /* SEC-03: bootstrap unlock. When encVault is the placeholder
     "SDP_ENC_V2:AAA=" there is no envelope to decrypt, so the PIN is proved
     against config.pinVerifier (PBKDF2-SHA256, 250,000 iterations) instead. */
  function unlockWithVerifier(pin, cb) {
    var v = vault();
    var verifier = pinVerifier();
    if (!verifier || !v || !v.verifyPinVerifier) {
      msg(t('studioSetupHint'), '');
      cb(new Error('no_vault'));
      return false;
    }
    v.verifyPinVerifier(pin, verifier).then(function (ok) {
      if (!ok) {
        msg(t('studioBadPin'), 'bad');
        cb(new Error('bad_pin'));
        return;
      }
      ST.unlocked = true;
      ST.envelope = '';
      ST.pin = str(pin);
      ST.secrets = {};
      ST.bootstrapMode = true;
      msg(t('studioUnlock') + ' ✓', 'ok');
      mount();
      loadVoicePack(noop);
      cb(null, ST.secrets);
    }, function (err) {
      if (err && err.code === 'locked') {
        msg(t('studioLockedOut') + ' ' + str(err.retrySec || 60) + ' ' + t('seconds'), 'bad');
      } else {
        msg(t('studioBadPin') + (err && err.triesLeft !== undefined ? ' · ' + err.triesLeft : ''), 'bad');
      }
      cb(err || new Error('bad_pin'));
    });
    return true;
  }
  function unlock(pin, cb) {
    cb = cb || noop;
    var v = vault();
    if (!v) { msg('crypto_unavailable', 'bad'); cb(new Error('crypto_unavailable')); return; }
    var attempt = str(pin).replace(/[^0-9]/g, '');
    if (!attempt) { msg(t('studioBadPin'), 'bad'); cb(new Error('bad_pin')); return; }
    /* SEC-04: the persisted lockout is checked before anything else. */
    if (v.isLocked && v.isLocked()) {
      msg(t('studioLockedOut') + ' ' + v.lockRemaining() + ' ' + t('seconds'), 'bad');
      var early = new Error('locked');
      early.code = 'locked';
      cb(early);
      return;
    }
    resolveEnvelope(function (envelope) {
      if (!isRealEnvelope(envelope)) {
        unlockWithVerifier(attempt, cb);
        return;
      }
      v.decryptV2(envelope, attempt).then(function (secrets) {
        ST.unlocked = true;
        ST.bootstrapMode = false;
        ST.envelope = envelope;
        ST.pin = attempt;
        ST.secrets = isObj(secrets) ? secrets : {};
        if (v.stash) v.stash(ST.secrets);
        clearVaultLock();
        msg(t('studioUnlock') + ' ✓', 'ok');
        mount();
        /* SYNC-11: the paid-for Alice clips must be in memory before the first
           delta generation, otherwise the lecturer pays twice for clip one. */
        loadVoicePack(noop);
        /* SYNC-07 completion: a local envelope that never reached GitHub is
           published now that a token is in hand. */
        autoPublishVault(envelope);
        cb(null, ST.secrets);
      }, function (err) {
        if (err && err.code === 'locked') {
          msg(t('studioLockedOut') + ' ' + str(err.retrySec || 60) + ' ' + t('seconds'), 'bad');
        } else {
          msg(t('studioBadPin') + (err && err.triesLeft !== undefined ? ' · ' + err.triesLeft : ''), 'bad');
        }
        cb(err || new Error('bad_pin'));
      });
    });
  }
  /* SEC-03/SYNC-07: a cached vault with a real envelope while GitHub still
     carries the placeholder means the publish never landed — finish it. */
  function autoPublishVault(envelope) {
    try {
      var token = str(ST.secrets.ghToken);
      var cfg = sync() && sync().config ? sync().config() : null;
      if (!token || !cfg) return false;
      if (isRealEnvelope(str(cfg.encVault))) return false;
      var cfgBody = JSON.parse(JSON.stringify(cfg));
      cfgBody.ver = schemaVer(); cfgBody.appVersion = appVersion(); cfgBody.version = appVersion();
      cfgBody.schema = schemaVer(); cfgBody.encVault = str(envelope);
      cfgBody.updatedAt = new Date().toISOString();
      var liveVersion = sync().version ? (sync().version() || {}) : {};
      var liveSession = str(liveVersion.session || '8') || '8';
      var liveTitle = str(liveVersion.title || '') || ('Session ' + liveSession);
      var versionBody = buildVersionPayload(liveSession, liveTitle, nextSyncRev());
      cfgBody.settingsRev = Number(versionBody.settingsRev);
      cfgBody.syncRev = Number(versionBody.syncRev);
      publishVaultFiles(buildVaultFiles(cfgBody, versionBody, 'Studio vault ' + appVersion()), token, noop);
      return true;
    } catch (e) { return false; }
  }

  /** D-S1/S2/S4: encrypt, persist locally at once, then commit config + version. */
  /* SEC-02: setup() re-seals the vault, so it may only run for an already
     authenticated Lecturer — or for a caller that proves the PIN it is about
     to use (the headless G11 harness). Nothing else can reach this function:
     the locked view renders no setup widget at all (SEC-01). */
  function setupAuthorised(pin, cb) {
    cb = cb || noop;
    if (ST.unlocked) { cb(null, true); return; }
    var v = vault();
    var verifier = pinVerifier();
    if (v && verifier && v.verifyPinVerifier) {
      msg(t('studioAskLecturer'), '');
      v.verifyPinVerifier(str(pin).replace(/[^0-9]/g, ''), verifier).then(function (ok) {
        if (!ok) { cb(new Error('not_unlocked')); return; }
        ST.unlocked = true;
        ST.bootstrapMode = true;
        cb(null, true);
      }, function (err) { cb(err || new Error('not_unlocked')); });
      return;
    }
    msg(t('studioAskLecturer'), '');
    cb(new Error('not_unlocked'));
  }
  function setup(pin, secrets, cb) {
    cb = cb || noop;
    var v = vault();
    if (!v) { cb(new Error('crypto_unavailable')); return; }
    if (str(pin).replace(/[^0-9]/g, '').length < 4) { msg(t('studioBadPin'), 'bad'); cb(new Error('pin_too_short')); return; }
    setupAuthorised(pin, function (authErr) {
      if (authErr) { cb(authErr); return; }
      setupSeal(str(pin).replace(/[^0-9]/g, ''), secrets, cb);
    });
  }
  function setupSeal(pin, secrets, cb) {
    cb = cb || noop;
    var v = vault();
    var secretsIn = isObj(secrets) ? secrets : {};
    v.encryptV2(secretsIn, pin).then(function (envelope) {
      ST.envelope = envelope;
      ST.secrets = secretsIn;
      ST.unlocked = true;
      ST.pin = str(pin);
      if (v.stash) v.stash(ST.secrets);
      persistEnvelope(envelope);
      msg(t('studioEnvelope') + ' ✓', 'ok');
      mount();
      var token = str(secretsIn.ghToken);
      if (!token) {
        toast(t('vaultSavedToast'));
        cb(null, envelope);
        return;
      }
      /* Publish config.json + version.json immediately (version.json last) so a
         reload — or a second device — can unlock before the session is ready. */
      /* SYNC-06: reuse buildVersionPayload() so the live session number and
         title survive every setup publish (they used to be hardcoded '8'). */
      var nowIso = new Date().toISOString();
      var liveVersion = sync() && sync().version ? (sync().version() || {}) : {};
      var liveSession = str(liveVersion.session || (sync() && sync().sessionNo ? sync().sessionNo() : '8')) || '8';
      var liveTitle = str(liveVersion.title || (sync() && sync().sessionTitle ? sync().sessionTitle() : '')) || ('Session ' + liveSession);
      var versionBody = buildVersionPayload(liveSession, liveTitle, nextSyncRev());
      var rev = Number(versionBody.settingsRev);
      var cfgBody = sync() && sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
      cfgBody.ver = schemaVer(); cfgBody.appVersion = appVersion(); cfgBody.version = appVersion();
      cfgBody.schema = schemaVer(); cfgBody.settingsRev = rev; cfgBody.encVault = envelope;
      cfgBody.updatedAt = nowIso; cfgBody.syncRev = versionBody.syncRev;
      var files = buildVaultFiles(cfgBody, versionBody, 'Studio vault ' + appVersion());
      if (!sync() || !sync().publishFilesSequential) { toast(t('vaultSavedToast')); cb(null, envelope); return; }
      publishVaultFiles(files, token, function (err, info) {
        if (err) {
          msg(t('studioPublishFail'), 'bad');
          toast(t('vaultSavedToast'));
          cb(err, envelope);
          return;
        }
        msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
        toast(t('vaultSavedToast') + ' · GitHub');
        cb(null, envelope, info);
      });
    }, function (err) { cb(err || new Error('encrypt_failed')); });
  }

  function lock() {
    ST.unlocked = false;
    ST.secrets = {};
    ST.pin = '';
    try { if (vault()) vault().clear(); } catch (e) {}
    mount();
    paintQuickButton();
    return false;
  }

  function setEnvelope(envelope) { ST.envelope = str(envelope); return ST.envelope; }
  function isUnlocked() { return !!ST.unlocked; }
  function secrets() { return isObj(ST.secrets) ? ST.secrets : {}; }

  /* ══ rendering ════════════════════════════════════════════════════════ */
  function pinDotsMarkup() {
    return '<div id="pinDots" class="pin-dots" aria-hidden="true">' +
      '<span></span><span></span><span></span><span></span><span></span><span></span></div>';
  }
  /* D-L2: the 56px Touch PIN Pad was documented for two releases and never
     rendered. #pinPad holds exactly 12 keys (1-9, Clear, 0, Unlock); the ⌫
     helper sits next to the dots so the grid stays 3 x 4. */
  function pinPadMarkup() {
    var html = '<div id="pinPad" class="pin-pad" role="group" aria-label="' + esc(t('studioPinLabel')) + '">';
    var i;
    for (i = 1; i <= 9; i++) html += '<button type="button" class="pin-key" data-pin="' + i + '">' + i + '</button>';
    html += '<button type="button" class="pin-key pin-key-soft" id="pinPadClear">' + esc(t('pinPadClear')) + '</button>';
    html += '<button type="button" class="pin-key" data-pin="0">0</button>';
    html += '<button type="button" class="pin-key pin-key-primary" id="pinPadUnlock">' + esc(t('pinPadUnlock')) + '</button>';
    html += '</div>';
    return html;
  }
  function keyRowMarkup(inputId, label, placeholder, kind) {
    return '<label class="lbl" for="' + inputId + '">' + esc(label) + '</label>' +
      '<div class="key-row">' +
      '<input id="' + inputId + '" class="input" type="password" autocomplete="off" spellcheck="false" placeholder="' + esc(placeholder) + '">' +
      '<button type="button" class="btn btn-sm" id="btnToggle' + kind + '" aria-pressed="false">' + esc(t('studioShow')) + '</button>' +
      '<button type="button" class="btn btn-sm" id="btnPaste' + kind + '">' + esc(t('studioPaste')) + '</button>' +
      '<button type="button" class="btn btn-sm" id="btnTest' + kind + '">' +
      esc(kind === 'ElKey' ? t('studioTestEl') : t('studioTestGh')) + '</button>' +
      '</div>';
  }
  function keysCardMarkup() {
    return '<div id="studioKeysCard" class="studio-keys">' +
      '<h4 class="studio-h4">' + esc(t('setAudio')) + '</h4>' +
      keyRowMarkup('elKeyInput', 'ElevenLabs API key', 'xi-api-key', 'ElKey') +
      keyRowMarkup('ghTokenInput', 'GitHub token (ghp_… or github_pat_…)', 'ghp_… / github_pat_…', 'GhToken') +
      '<label class="lbl" for="studioGasUrl">Apps Script relay URL</label>' +
      '<input id="studioGasUrl" class="input" type="url" autocomplete="off" placeholder="https://script.google.com/…">' +
      '<label class="lbl" for="newPinInput">' + esc(t('studioPinLabel')) + ' — new (optional)</label>' +
      '<input id="newPinInput" class="input" type="password" inputmode="numeric" autocomplete="off" maxlength="8">' +
      '<label class="lbl" for="confirmPinInput">' + esc(t('studioPinLabel')) + ' — confirm</label>' +
      '<input id="confirmPinInput" class="input" type="password" inputmode="numeric" autocomplete="off" maxlength="8">' +
      '<div class="chip-row">' +
      '<button type="button" class="btn btn-sm" id="btnSaveKeys">' + esc(t('studioSave')) + '</button>' +
      '</div>' +
      '<p id="studioTestStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
      '</div>';
  }
  function quotaCardMarkup() {
    return '<section id="quotaInspectorCard" class="studio-quota">' +
      '<h4 class="studio-h4">' + esc(t('quotaHeading')) + '</h4>' +
      '<p id="quotaText" class="muted" role="status" aria-live="polite">' + esc(t('quotaHeading')) + ' — ' + esc(t('studioTestEl')) + '</p>' +
      '<div class="chip-row">' +
      '<button type="button" class="btn btn-sm" id="btnRefreshQuota">🔄 ' + esc(t('studioTestEl')) + '</button>' +
      '</div>' +
      '<p class="lbl">' + esc(t('costPreviewLabel')) + '</p>' +
      '<p id="costPreviewLine" class="muted">' + esc(costPreviewLine()) + '</p>' +
      '<label class="checkline" for="chkForceRegen"><input type="checkbox" id="chkForceRegen"> <span>' + esc(t('forceRegenLabel')) + '</span></label>' +
      '<div class="chip-row">' +
      '<button type="button" class="btn btn-sm" id="btnTestOneWord">' + esc(t('testOneWordBtn')) + '</button>' +
      '<button type="button" class="btn btn-sm btn-primary" id="btnGenClips">' + esc(t('genDeltaBtn')) + '</button>' +
      '</div>' +
      '<div id="clipPreviewTable" class="studio-preview"></div>' +
      '</section>';
  }
  function unlockedMarkup() {
    var words = ST.words.length ? ST.words : (sync() && sync().words ? sync().words() : []);
    var text = wordsToText(words);
    return '' +
      '<div class="studio-grid">' +
      '<label class="lbl" for="studioWords">' + esc(t('studioEditor')) + '</label>' +
      '<textarea id="studioWords" spellcheck="false" aria-label="' + esc(t('studioEditor')) + '">' + esc(text) + '</textarea>' +
      '<p id="studioCount" class="studio-msg">' + words.length + ' ' + esc(t('studioWordsCount')) + '</p>' +
      '<div class="chip-row">' +
      '<button type="button" class="btn btn-sm" id="btnStudioPreview">' + esc(t('studioPreview')) + '</button>' +
      '<button type="button" class="btn btn-sm btn-primary" id="btnStudioPublish">' + esc(t('studioPublish')) + '</button>' +
      '<button type="button" class="btn btn-sm" id="btnStudioGenerate">' + esc(t('studioGenerate')) + '</button>' +
      '<button type="button" class="btn btn-sm" id="btnStudioLock">' + esc(t('studioLock')) + '</button>' +
      '</div>' +
      '<div id="studioPreview" class="studio-preview"></div>' +
      '<p class="muted">' + esc(t('studioElevenNote')) + '</p>' +
      '<p id="studioMsg" class="studio-msg" role="status" aria-live="polite"></p>' +
      '</div>' +
      keysCardMarkup() +
      quotaCardMarkup() +
      '<div class="studio-record">' +
      '<h4 class="studio-h4">' + esc(t('studioRecord')) + '</h4>' +
      '<div class="chip-row">' +
      '<button type="button" class="btn btn-sm" id="btnStudioRecord">' + esc(t('studioRecord')) + '</button>' +
      '<button type="button" class="btn btn-sm btn-primary" id="btnCommitClip" disabled>' + esc(t('studioCommitClip')) + '</button>' +
      '</div>' +
      '<audio id="recPreviewAudio" controls preload="none" class="rec-preview"></audio>' +
      '</div>';
  }
  /* SEC-01 / SEC-02 / SEC-05: while locked the Studio body renders ONLY the
     masked PIN field, the dot indicator, the 56px 12-key pad, the status line
     and the ask-your-lecturer hint. No API key field, no #setupPin, no
     #studioFirstTimePanel and no word editor may exist in the locked DOM —
     whatever the state of encVault (even the placeholder SDP_ENC_V2:AAA=). */
  function lockedMarkup() {
    return '<div class="pin-row">' +
      '<label class="for-only" for="studioPin">' + esc(t('studioPinLabel')) + '</label>' +
      '<input id="studioPin" class="input" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="' + esc(t('studioPinLabel')) + '">' +
      '<button type="button" class="btn btn-sm" id="pinPadBack" aria-label="Delete last digit">⌫</button>' +
      '</div>' +
      pinDotsMarkup() +
      pinPadMarkup() +
      '<p id="studioMsg" class="studio-msg" role="status" aria-live="polite"></p>' +
      '<p class="studio-hint" data-i18n="studioAskLecturer">' + esc(t('studioAskLecturer')) + '</p>';
  }

  function mount() {
    var host = byId('studioBody');
    if (!host) return false;
    host.innerHTML = ST.unlocked ? unlockedMarkup() : lockedMarkup();
    var msgNode = byId('studioMsg');
    if (msgNode && ST.message) {
      msgNode.textContent = ST.message;
      if (ST.messageState) msgNode.setAttribute('data-state', ST.messageState);
    }
    var testNode = byId('studioTestStatus');
    if (testNode && ST.testStatus) {
      testNode.textContent = ST.testStatus;
      if (ST.testState) testNode.setAttribute('data-state', ST.testState);
    }
    bindDelegated();
    paintPinDots();
    paintClipTable();
    paintQuickButton();
    return true;
  }

  function paintQuickButton() {
    var btn = byId('btnStudioQuick');
    if (!btn) return false;
    btn.textContent = ST.unlocked ? '🔓' : '🔒';
    btn.setAttribute('aria-label', ST.unlocked
      ? 'Lecturer Studio is unlocked — open it'
      : 'Open the Lecturer Studio from Settings');
    btn.setAttribute('data-state', ST.unlocked ? 'unlocked' : 'locked');
    return true;
  }

  function activePinInput() {
    /* SEC-03: locked view has exactly one PIN field. */
    return byId('studioPin');
  }
  function pinValue() { var n = activePinInput(); return n ? str(n.value) : ''; }
  function setPinValue(v) {
    var n = activePinInput();
    if (!n) return '';
    n.value = str(v).replace(/[^0-9]/g, '').slice(0, 8);
    paintPinDots();
    return n.value;
  }
  function appendPin(digit) {
    var next = pinValue() + str(digit).replace(/[^0-9]/g, '');
    setPinValue(next);
    return next;
  }
  function backspacePin() {
    var v = pinValue();
    setPinValue(v.slice(0, Math.max(0, v.length - 1)));
    return pinValue();
  }
  function paintPinDots() {
    var host = byId('pinDots');
    if (!host) return false;
    var dots = host.querySelectorAll ? host.querySelectorAll('span') : [];
    var len = Math.min(dots.length, pinValue().length);
    for (var i = 0; i < dots.length; i++) {
      if (i < len) dots[i].classList.add('on'); else dots[i].classList.remove('on');
    }
    host.setAttribute('data-filled', String(len));
    return true;
  }

  /* ══ D-L7: one delegated listener survives every innerHTML swap ═══════ */
  function bindDelegated() {
    var host = byId('studioAccordion');
    if (!host || host._sdpDelegated) return false;
    host._sdpDelegated = true;
    host.addEventListener('click', onStudioClick, false);
    host.addEventListener('input', onStudioInput, false);
    host.addEventListener('change', onStudioChange, false);
    return true;
  }
  function ownerId(node, stop) {
    var n = node;
    while (n && n !== stop && n !== doc) {
      if (n.id) return n.id;
      n = n.parentNode;
    }
    return '';
  }
  function onStudioInput(ev) {
    var id = ownerId(ev && ev.target, byId('studioAccordion'));
    if (id === 'studioWords') {
      var editor = byId('studioWords');
      ST.words = parseWords(editor ? editor.value : '');
      setText(byId('studioCount'), ST.words.length + ' ' + t('studioWordsCount'));
      setText(byId('costPreviewLine'), costPreviewLine(ST.words));
    } else if (id === 'studioPin' || id === 'setupPin') {
      paintPinDots();
    }
  }
  function onStudioChange(ev) {
    var id = ownerId(ev && ev.target, byId('studioAccordion'));
    if (id === 'chkForceRegen') return true;
    return false;
  }

  function toggleSecretField(inputId, btn) {
    var node = byId(inputId);
    if (!node) return false;
    var showing = node.getAttribute('type') === 'text';
    node.setAttribute('type', showing ? 'password' : 'text');
    if (btn) {
      btn.textContent = showing ? t('studioShow') : t('studioHide');
      btn.setAttribute('aria-pressed', showing ? 'false' : 'true');
    }
    return !showing;
  }
  function pasteInto(inputId, done) {
    var node = byId(inputId);
    if (!node) { done(new Error('no_field')); return; }
    var clip = global.navigator && global.navigator.clipboard;
    if (clip && typeof clip.readText === 'function') {
      clip.readText().then(function (text) {
        node.value = str(text);
        done(null, node.value);
      }, function () { done(new Error('paste_denied')); });
      return;
    }
    done(new Error('paste_unsupported'));
  }

  function onStudioClick(ev) {
    var target = ev && ev.target;
    var id = ownerId(target, byId('studioAccordion'));
    if (!id) return;
    var digit = target && target.getAttribute ? target.getAttribute('data-pin') : null;
    if (digit !== null && digit !== undefined && digit !== '') {
      appendPin(digit);
      if (ev.preventDefault) ev.preventDefault();
      return;
    }
    switch (id) {
      case 'pinPadClear':
        setPinValue('');
        break;
      case 'pinPadBack':
        backspacePin();
        break;
      case 'pinPadUnlock':
      case 'btnStudioUnlock':
        unlock(pinValue(), noop);
        break;
      case 'btnToggleElKey':
        toggleSecretField('elKeyInput', byId('btnToggleElKey'));
        break;
      case 'btnToggleGhToken':
        toggleSecretField('ghTokenInput', byId('btnToggleGhToken'));
        break;
      case 'btnPasteElKey':
        pasteInto('elKeyInput', function (err) { testStatus(err ? 'Clipboard unavailable — paste manually' : 'Pasted the ElevenLabs key', err ? 'bad' : 'ok'); });
        break;
      case 'btnPasteGhToken':
        pasteInto('ghTokenInput', function (err) { testStatus(err ? 'Clipboard unavailable — paste manually' : 'Pasted the GitHub token', err ? 'bad' : 'ok'); });
        break;
      case 'btnTestElKey':
        testElevenLabsKey(fieldValue('elKeyInput') || str(ST.secrets.elevenKey), function (err, data) { onElTest(err, data); });
        break;
      case 'btnTestGhToken':
        testGitHubToken(fieldValue('ghTokenInput') || str(ST.secrets.ghToken), function (err, data) { onGhTest(err, data); });
        break;
      case 'btnRefreshQuota':
        refreshQuota(function (err) {
          if (err) testStatus('Quota check failed: ' + quotaError(err), 'bad');
        });
        break;
      case 'btnTestOneWord':
        generateClips({ singleTest: true }, noop);
        break;
      case 'btnGenClips':
        generateClips({ force: !!(byId('chkForceRegen') && byId('chkForceRegen').checked) }, noop);
        break;
      case 'btnSaveKeys':
        saveKeys();
        break;
      case 'btnStudioSetup':
        doSetup();
        break;
      case 'btnStudioCopyEnv':
        copyEnvelope();
        break;
      case 'btnStudioPreview':
        openPublishPreview();
        break;
      case 'btnStudioPublish':
        publish(noop);
        break;
      case 'btnStudioGenerate':
        generateClips({ force: false }, noop);
        break;
      case 'btnStudioLock':
        lock();
        break;
      case 'btnStudioRecord':
        toggleRecord();
        break;
      case 'btnCommitClip':
        commitClip(str(ST.secrets.ghToken), function (err) {
          msg(err ? t('studioPublishFail') : t('studioCommitClip') + ' ✓', err ? 'bad' : 'ok');
        });
        break;
      default:
        return;
    }
  }
  function fieldValue(id) { var n = byId(id); return n ? str(n.value) : ''; }
  function onElTest(err, result) {
    if (err) { testStatus('❌ ' + quotaError(err), 'bad'); return; }
    var used = Number(result.used || 0), limit = Number(result.limit || 0), left = Number(result.remaining || 0);
    testStatus('✅ ElevenLabs Connected · Used ' + used + ' / Limit ' + limit + ' chars (Remaining: ' + left + ')', 'ok');
    setText(byId('quotaText'), 'Used ' + used + ' / Limit ' + limit + ' chars · Remaining: ' + left);
  }
  function onGhTest(err, result) {
    if (err) { testStatus('❌ ' + ghError(err), 'bad'); return; }
    testStatus('✅ GitHub Connected (' + result.repo + ' · Write OK)', 'ok');
  }

  function doSetup() {
    var pinNode = byId('setupPin');
    var secretsIn = {
      ghToken: fieldValue('ghTokenInput'),
      elevenKey: fieldValue('elKeyInput'),
      gasUrl: fieldValue('studioGasUrl'),
      updatedAt: Date.now()
    };
    setup(pinNode ? pinNode.value : '', secretsIn, function (err, envelope) {
      if (err) return;
      var out = byId('studioEnvelope');
      if (out) out.value = envelope;
    });
  }
  function copyEnvelope() {
    var out = byId('studioEnvelope');
    if (!out) return false;
    if (out.select) { try { out.select(); doc.execCommand('copy'); } catch (e) {} }
    return true;
  }
  function saveKeys() {
    if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); return false; }
    /* SEC-02: a new PIN must be confirmed twice before the vault is re-sealed. */
    var confirmNode = byId('confirmPinInput');
    var wantPin = str(fieldValue('newPinInput') || '').replace(/[^0-9]/g, '');
    if (confirmNode) {
      var confirmPin = str(confirmNode.value).replace(/[^0-9]/g, '');
      if (wantPin.length >= 4 || confirmPin.length) {
        if (wantPin.length < 4 || wantPin.length > 8) { msg(t('studioBadPin'), 'bad'); return false; }
        if (wantPin !== confirmPin) { msg(t('studioPinMismatch'), 'bad'); return false; }
        ST.pin = wantPin;
      }
    }
    var patch = {};
    var el = fieldValue('elKeyInput');
    var gh = fieldValue('ghTokenInput');
    var gas = fieldValue('studioGasUrl');
    if (el) patch.elevenKey = el;
    if (gh) patch.ghToken = gh;
    if (gas) patch.gasUrl = gas;
    patch.updatedAt = Date.now();
    ST.secrets = isObj(ST.secrets) ? ST.secrets : {};
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) ST.secrets[k] = patch[k];
    var pin = str(ST.pin || '');
    var v = vault();
    if (!v || !pin) { msg(t('vaultSavedToast'), 'ok'); return true; }
    if (v.stash) v.stash(ST.secrets);
    var token = str(ST.secrets.ghToken);
    v.encryptV2(ST.secrets, pin).then(function (envelope) {
      ST.envelope = envelope;
      persistEnvelope(envelope);
      /* D13: ALWAYS recompute config.pinVerifier on an explicit save, from the
         salt already published in config.json (a fresh 16-byte salt only when
         no verifier exists yet). The v0.0.1.d code gated this on v.PIN_SALT —
         a property that does not exist on the vault — so the verifier silently
         went stale after every PIN change and a fresh device could not
         bootstrap. Now the published verifier always matches the PIN that
         sealed this vault. */
      var verifierPromise = null;
      var currentVerifier = pinVerifier();
      var currentSalt = currentVerifier && isObj(currentVerifier) ? str(currentVerifier.salt) : '';
      if (v && v.computePinVerifier) {
        verifierPromise = v.computePinVerifier(pin, currentSalt).then(function (verifier) {
          var cfg = sync() && sync().config ? sync().config() : null;
          if (cfg) cfg.pinVerifier = verifier;
          return verifier;
        }, function () { return null; });
      }
      if (!verifierPromise) verifierPromise = Promise.resolve(null);
      verifierPromise.then(function () {
        mount();
        /* SYNC-07: commit the vault to GitHub NOW — localStorage alone meant a
           second device could never unlock (the 0.0.1.c 24-hour bug). */
        if (!token || !sync() || !sync().publishFilesSequential) {
          toast(t('vaultSavedToast'));
          return;
        }
        var cfgBody = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
        cfgBody.ver = schemaVer(); cfgBody.appVersion = appVersion(); cfgBody.version = appVersion();
        cfgBody.schema = schemaVer();
        cfgBody.encVault = envelope;
        cfgBody.encVaultSavedAt = new Date().toISOString();
        cfgBody.updatedAt = new Date().toISOString();
        var liveVersion = sync().version ? (sync().version() || {}) : {};
        var liveSession = str(liveVersion.session || '8') || '8';
        var liveTitle = str(liveVersion.title || '') || ('Session ' + liveSession);
        var versionBody = buildVersionPayload(liveSession, liveTitle, nextSyncRev());
        cfgBody.settingsRev = Number(versionBody.settingsRev);
        cfgBody.syncRev = Number(versionBody.syncRev);
        publishVaultFiles(buildVaultFiles(cfgBody, versionBody, 'Studio vault ' + appVersion()), token, function (err) {
          if (err) {
            msg(t('studioPublishFail'), 'bad');
            toast(t('vaultSavedToast'));
            return;
          }
          msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
          toast('Vault saved · synced to GitHub');
        });
      });
    }, function () { msg(t('studioPublishFail'), 'bad'); });
    return true;
  }

  function currentWords() {
    if (ST.words && ST.words.length) return ST.words;
    return sync() && sync().words ? sync().words() : [];
  }

  /* ── publish preview (no network writes) ────────────────────────────── */
  function publishPreviewWords(words) {
    ST.words = words || currentWords();
    var payloads = buildPublishPayloads(ST.words, {});
    ST.preview = payloads;
    return payloads;
  }
  function openPublishPreview() {
    var payloads = publishPreviewWords(currentWords());
    var host = byId('studioPreview');
    if (!host) return payloads;
    var rows = '';
    for (var i = 0; i < ST.words.length; i++) {
      var w = ST.words[i] || {};
      rows += '<tr><td>' + (i + 1) + '</td><td>' + esc(w.w) + '</td><td>' + esc(w.p) + '</td><td class="word-si">' + esc(w.si) + '</td></tr>';
    }
    host.innerHTML = '<table class="studio-preview-table"><thead><tr><th>#</th><th>w</th><th>IPA</th><th>සිංහල</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="studio-msg">data/session.json · data/config.json · data/elevenlabs-audio.json · data/version.json · ' +
      ST.words.length + ' ' + esc(t('studioWordsCount')) + '</p>';
    return payloads;
  }

  /* ── publishing: sequential Contents API (D-S5) ─────────────────────── */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 publishing */
  /* D13/D19: the pre-publish checklist. Every problem is a plain-language
     string; an empty array means the payload is coherent: words present and
     spelled, pronunciation URLs preserved, the vault envelope carried, the
     PIN verifier published, and syncRev strictly forward under ONE clock. */
  function publishChecklist(payloads) {
    var problems = [];
    var session = isObj(payloads.session) ? payloads.session : {};
    var words = Array.isArray(session.words) ? session.words : [];
    var i;
    if (!words.length) problems.push('session has no words');
    for (i = 0; i < words.length; i++) {
      if (!str(words[i] && words[i].w)) { problems.push('word #' + (i + 1) + ' has no spelling'); break; }
    }
    var cfg = isObj(payloads.config) ? payloads.config : {};
    var env = str(cfg.encVault);
    if (!env) problems.push('vault envelope missing');
    if (!isObj(cfg.pinVerifier) || !str(cfg.pinVerifier.hash)) problems.push('pinVerifier missing');
    var version = isObj(payloads.version) ? payloads.version : {};
    var prevRev = 0;
    try { prevRev = Number((sync() && sync().version() && sync().version().syncRev) || 0); } catch (e) { prevRev = 0; }
    if (!(Number(version.syncRev) > prevRev)) problems.push('syncRev did not move forward');
    if (Number(version.settingsRev) < schemaVer()) problems.push('settingsRev went backwards');
    return problems;
  }
  function publish(cb) {
    cb = cb || noop;
    if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); cb(new Error('locked')); return; }
    var token = str(ST.secrets.ghToken);
    if (!token) { msg(t('studioNoToken'), 'bad'); cb(new Error('no_token')); return; }
    var payloads = buildPublishPayloads(currentWords(), {});
    /* D19: the coherence checklist runs BEFORE anything is committed — a
       broken payload is refused with a plain-language reason instead of being
       pushed to thirty student devices. */
    var problems = publishChecklist(payloads);
    if (problems.length) {
      msg(t('studioPublishFail') + ' · ' + problems.join(' · '), 'bad');
      cb(new Error('checklist_failed'));
      return;
    }
    var message = 'Smart Dictation publish ' + appVersion();
    var files = [
      { path: 'data/session.json', content: payloads.files['data/session.json'], message: message },
      { path: 'data/config.json', content: payloads.files['data/config.json'], message: message }
    ];
    if (ST.voicePack.loaded && ST.voicePack.clips) {
      files.push({ path: 'data/elevenlabs-audio.json', content: JSON.stringify(voicePackPayload(payloads.version.syncRev), null, 2), message: 'Alice voice pack ' + appVersion() });
    }
    files.push({ path: 'data/version.json', content: payloads.files['data/version.json'], message: message });
    if (!sync() || !sync().publishFilesSequential) { msg(t('studioNoToken'), 'bad'); cb(new Error('no_sync')); return; }
    sync().publishFilesSequential(files, token, function (path, ok) {
      if (!ok) msg(t('studioPublishFail') + ' · ' + path, 'bad');
    }, function (err, info) {
      if (err) { cb(err, info); return; }
      ST.lastPublish = { at: Date.now(), files: files.map(function (f) { return f.path; }), version: payloads.version };
      msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
      /* SYNC-09: pushLiveState() posted an unauthenticated relay message that
         gas-source.txt rejects with ADMIN_PIN — it failed silently forever. */
      cb(null, ST.lastPublish);
    });
  }

  /* D-S9: the relay body never carries the lecturer PIN. */
  function pushLiveState(version) {
    var gasUrl = str(ST.secrets.gasUrl);
    if (!gasUrl) return false;
    var body = JSON.stringify({ action: 'publish', app: 'sdp', session: version.session, appVersion: version.appVersion, ver: appVersion() });
    try { sync().postRelay(gasUrl, body, noop); return true; } catch (e) { return false; }
  }

  /* ══ D-C1..C7: credit-safe Alice voice pack ═══════════════════════════ */
  function elevenUrl() { return 'https://api.elevenlabs.io/v1/text-to-speech/' + VOICE_ID; }
  function guideSteps() {
    var out = [], i, title, body;
    for (i = 1; i <= 4; i++) {
      title = en('guideStep' + i + 'Title') || ('Step ' + i);
      body = en('guideStep' + i + 'Body');
      out.push({ key: '_guide_' + i, text: (title + '. ' + body).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '') });
    }
    return out;
  }
  function costPreview(words) {
    var list = Array.isArray(words) ? words : currentWords();
    var wordChars = 0, i;
    for (i = 0; i < Math.min(WORD_CAP, list.length); i++) wordChars += str((list[i] || {}).w).length;
    var steps = guideSteps(), guideChars = 0;
    for (i = 0; i < steps.length; i++) guideChars += steps[i].text.length;
    return { words: wordChars, guide: guideChars, total: wordChars + guideChars, count: Math.min(WORD_CAP, list.length) };
  }
  function costPreviewLine(words) {
    var c = costPreview(words);
    return c.count + ' words = ' + c.words + ' chars · 4 guide steps = ' + c.guide + ' chars · total ' + c.total + ' chars';
  }
  function quotaError(err) {
    var code = Number((err && err.status) || 0);
    if (code === 401) return 'Invalid ElevenLabs key';
    if (code === 402) return 'Quota exhausted — top up or wait for renewal';
    if (code === 429) return 'Rate limited — retrying in 5s';
    return str(err && err.message) || 'network error';
  }
  function ghError(err) {
    var code = Number((err && err.status) || 0);
    if (code === 401) return 'GitHub token rejected (401)';
    if (code === 403) return 'GitHub token lacks write access (403)';
    if (code === 404) return 'Repository or token scope not found (404)';
    return str(err && err.message) || 'network error';
  }
  function withStatus(err, status) { err = err || new Error('http_' + status); err.status = status; return err; }

  /** Zero-cost endpoint: reading the subscription never bills a character. */
  function fetchSubscription(key, cb) {
    cb = cb || noop;
    if (!key) { cb(withStatus(new Error('no_key'), 401)); return false; }
    if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
    try {
      global.fetch(EL_SUBSCRIPTION, {
        method: 'GET',
        headers: { 'xi-api-key': str(key), Accept: 'application/json' },
        cache: 'no-store'
      }).then(function (res) {
        var status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
        if (!res || !res.ok) throw withStatus(new Error('subscription_failed'), status || 0);
        return res.json();
      }).then(function (body) {
        var used = Number(body && body.character_count);
        var limit = Number(body && body.character_limit);
        if (isNaN(used)) used = 0;
        if (isNaN(limit)) limit = 0;
        var result = { used: used, limit: limit, remaining: Math.max(0, limit - used) };
        ST.quota = result;
        cb(null, result);
      }, function (err) { cb(err || new Error('subscription_failed')); });
    } catch (e) { cb(e || new Error('subscription_failed')); return false; }
    return true;
  }
  function testElevenLabsKey(key, cb) {
    cb = cb || noop;
    fetchSubscription(key, function (err, result) {
      if (err) { cb(err); return; }
      var line = '✅ ElevenLabs Connected · Used ' + result.used + ' / Limit ' + result.limit + ' chars (Remaining: ' + result.remaining + ')';
      testStatus(line, 'ok');
      setText(byId('quotaText'), 'Used ' + result.used + ' / Limit ' + result.limit + ' chars · Remaining: ' + result.remaining);
      cb(null, result);
    });
    return true;
  }
  function refreshQuota(cb) {
    cb = cb || noop;
    var key = str(ST.secrets.elevenKey) || fieldValue('elKeyInput');
    fetchSubscription(key, function (err, result) {
      if (err) {
        setText(byId('quotaText'), '❌ ' + quotaError(err));
        testStatus('❌ ' + quotaError(err), 'bad');
        cb(err);
        return;
      }
      var line = 'Used ' + result.used + ' / Limit ' + result.limit + ' chars · Remaining: ' + result.remaining;
      setText(byId('quotaText'), line);
      testStatus('✅ ' + line, 'ok');
      cb(null, result);
    });
    return true;
  }
  /** D-L3: accepts classic ghp_ tokens and fine-grained github_pat_ tokens. */
  function testGitHubToken(token, cb) {
    cb = cb || noop;
    var tk = str(token);
    if (!tk) { cb(withStatus(new Error('no_token'), 401)); return false; }
    if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
    var repo = sync() && sync().repo ? sync().repo() : { owner: 'dictationb1', name: 'dictationb1.github.io' };
    var url = 'https://api.github.com/repos/' + repo.owner + '/' + repo.name;
    try {
      global.fetch(url, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + tk, Accept: 'application/vnd.github+json' },
        cache: 'no-store'
      }).then(function (res) {
        var status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
        if (!res || !res.ok) throw withStatus(new Error('repo_check_failed'), status || 0);
        return res.json();
      }).then(function (body) {
        var perms = (body && body.permissions) || {};
        var canWrite = perms.push === true || perms.admin === true || perms.maintain === true || String(perms.contents || '') === 'write';
        if (!canWrite) { cb(withStatus(new Error('no_write_permission'), 403)); return; }
        var result = { repo: repo.owner + '/' + repo.name, permissions: perms };
        testStatus('✅ GitHub Connected (' + result.repo + ' · Write OK)', 'ok');
        cb(null, result);
      }, function (err) { cb(err || new Error('repo_check_failed')); });
    } catch (e) { cb(e || new Error('repo_check_failed')); return false; }
    return true;
  }

  function arrayBufferToBase64(buffer) {
    var bytes = buffer instanceof global.Uint8Array ? buffer : new global.Uint8Array(buffer);
    var out = '', i, chunk = 0x8000;
    for (i = 0; i < bytes.length; i += chunk) {
      var slice = bytes.subarray ? bytes.subarray(i, i + chunk) : bytes.slice(i, i + chunk);
      out += String.fromCharCode.apply(null, slice);
    }
    if (typeof global.btoa === 'function') return global.btoa(out);
    /* Node/jsdom fallback so the delta generator is testable headlessly. */
    if (typeof Buffer !== 'undefined') return Buffer.from(out, 'binary').toString('base64');
    return '';
  }
  function loadVoicePack(cb) {
    cb = cb || noop;
    if (ST.voicePack.loaded) { cb(null, ST.voicePack); return; }
    if (typeof global.fetch !== 'function') { ST.voicePack.loaded = true; cb(new Error('no_fetch')); return; }
    try {
      global.fetch('./data/elevenlabs-audio.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (res) { return res && res.ok ? res.json() : null; })
        .then(function (pack) {
          if (isObj(pack) && isObj(pack.clips)) ST.voicePack.clips = pack.clips;
          ST.voicePack.rev = Number((pack && pack.syncRev) || 0);
          ST.voicePack.loaded = true;
          cb(null, ST.voicePack);
        }, function () { ST.voicePack.loaded = true; cb(new Error('pack_failed')); });
    } catch (e) { ST.voicePack.loaded = true; cb(e); }
  }
  function clipExists(key) {
    var entry = ST.voicePack.clips ? ST.voicePack.clips[key] : null;
    if (!entry) return false;
    if (typeof entry === 'string') return !!entry;
    return !!(str(entry.b64) || str(entry.url));
  }
  function buildQueue(words, singleTest) {
    var list = (Array.isArray(words) ? words : currentWords()).slice(0, WORD_CAP);
    var queue = [], i;
    for (i = 0; i < list.length; i++) {
      var w = list[i] || {};
      var text = str(w.w);
      if (!text) continue;
      queue.push({ key: text.toLowerCase(), text: text });
      if (singleTest) return queue; /* 1-Word Test: ~8 chars, ~1 credit unit */
    }
    if (singleTest) return queue;
    var steps = guideSteps();
    for (i = 0; i < steps.length; i++) queue.push(steps[i]);
    return queue;
  }

  /** D-C1/C2/C5/C6/C7: generate ONLY the missing clips and actually save them. */
  function generateClips(a, b) {
    var opts = {}, cb = noop;
    if (typeof a === 'function') cb = a;
    else if (Array.isArray(a)) { opts = { words: a }; cb = typeof b === 'function' ? b : noop; }
    else { opts = isObj(a) ? a : {}; cb = typeof b === 'function' ? b : noop; }
    if (!ST.unlocked) { cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
    /* SYNC-11: clipExists() is only honest once the committed pack is loaded. */
    if (!ST.voicePack.loaded) loadVoicePack(noop);
    var apiKey = str(ST.secrets.elevenKey) || fieldValue('elKeyInput');
    if (!apiKey) { msg(t('studioNoToken'), 'bad'); cb(new Error('no_key')); return { ok: false, reason: 'no_key' }; }
    var words = Array.isArray(opts.words) ? opts.words : currentWords();
    /* D-C7: never silently drop words past the 30-word cap. */
    if (words.length > WORD_CAP) {
      msg(str(words.length) + ' words parsed, first 30 used', '');
      toast(str(words.length) + ' words parsed, first 30 used');
    }
    var queue = buildQueue(words, !!opts.singleTest);
    var force = !!opts.force;
    var made = [], skipped = 0, index = 0, calls = 0, stopped = false;
    ST.generating = true;
    function finish(err) {
      if (stopped) return;
      stopped = true;
      ST.generating = false;
      paintClipTable();
      if (err) {
        msg('❌ ' + quotaError(err), 'bad');
        testStatus('❌ ' + quotaError(err), 'bad');
        cb(err, { made: made, skipped: skipped, calls: calls });
        return;
      }
      msg(t('studioGenerate') + ' ✓ ' + made.length + ' · ' + skipped + ' skipped', 'ok');
      testStatus('✅ ' + made.length + ' new · ' + skipped + ' already cached', 'ok');
      if (made.length) commitVoicePack();
      cb(null, { made: made, skipped: skipped, calls: calls });
    }
    function next() {
      if (index >= queue.length) { finish(null); return; }
      var item = queue[index];
      index += 1;
      /* D-C2: Delta Mode — never pay twice for a clip that already exists. */
      if (!force && clipExists(item.key)) { skipped += 1; next(); return; }
      calls += 1;
      requestClip(item, apiKey, function (err, entry) {
        if (err) { finish(err); return; }
        ST.voicePack.clips[item.key] = entry;
        made.push({ key: item.key, text: item.text, bytes: entry.bytes });
        ST.voicePack.loaded = true;
        paintClipTable();
        next();
      }, 0);
    }
    function requestClip(item, key, done, attempt) {
      try {
        global.fetch(elevenUrl(), {
          method: 'POST',
          headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({
            text: item.text,
            model_id: VOICE_MODEL,
            voice_settings: { stability: 0.65, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true }
          })
        }).then(function (res) {
          var status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
          if (!res || !res.ok) {
            /* D-C5: 429 gets exactly one retry, 5 s later. */
            if (status === 429 && attempt < 1) {
              global.setTimeout(function () { requestClip(item, key, done, attempt + 1); }, 5000);
              return null;
            }
            throw withStatus(new Error('tts_failed'), status || 0);
          }
          return res.arrayBuffer ? res.arrayBuffer() : null;
        }).then(function (buffer) {
          if (buffer === null) return; /* retrying */
          if (!buffer) throw new Error('empty_audio');
          var b64 = arrayBufferToBase64(buffer);
          if (!b64) throw new Error('encode_failed');
          done(null, { b64: b64, url: 'data:audio/mpeg;base64,' + b64, bytes: buffer.byteLength, at: Date.now() });
        }, function (err) { done(err || new Error('tts_failed')); });
      } catch (e) { done(e || new Error('tts_failed')); }
    }
    next();
    return { ok: true, started: queue.length, calls: 0 };
  }

  /** Commit the freshly paid-for clips so they can never be lost (D-C1). */
  function commitVoicePack(cb) {
    cb = cb || noop;
    var token = str(ST.secrets.ghToken);
    if (!token || !sync() || !sync().publishFilesSequential) { cb(new Error('no_token')); return false; }
    var files = [{
      path: 'data/elevenlabs-audio.json',
      content: JSON.stringify(voicePackPayload(), null, 2),
      message: 'Alice voice pack ' + appVersion()
    }];
    sync().publishFilesSequential(files, token, noop, cb || noop);
    return true;
  }

  function paintClipTable() {
    var host = byId('clipPreviewTable');
    if (!host) return false;
    var clips = ST.voicePack.clips || {};
    var keys = [], k;
    for (k in clips) if (Object.prototype.hasOwnProperty.call(clips, k)) keys.push(k);
    if (!keys.length) { host.innerHTML = ''; return true; }
    var rows = '';
    for (var i = 0; i < keys.length; i++) {
      var entry = clips[keys[i]] || {};
      var bytes = typeof entry === 'string' ? 0 : Number(entry.bytes || 0);
      rows += '<tr><td>' + esc(keys[i]) + '</td><td>' + (bytes ? bytes + ' B' : 'cached') + '</td></tr>';
    }
    host.innerHTML = '<table class="studio-preview-table"><thead><tr><th>clip</th><th>size</th></tr></thead><tbody>' + rows + '</tbody></table>';
    return true;
  }

  /* ══ lecturer clip recorder (D-L5, D-L8) ══════════════════════════════ */
  function toggleRecord() {
    if (ST.recording) { stopRecord(); return 'stopped'; }
    return startRecord();
  }
  function startRecord() {
    var media = global.navigator && global.navigator.mediaDevices;
    if (!ST.unlocked || !media || typeof global.MediaRecorder !== 'function') {
      msg(t('studioRecord') + ' — microphone unavailable', 'bad');
      return null;
    }
    var btn = byId('btnStudioRecord');
    if (btn) btn.textContent = '⏹ Stop recording';
    ST.recording = true;
    recordClip(0, function (err, clip) {
      ST.recording = false;
      var b = byId('btnStudioRecord');
      if (b) b.textContent = t('studioRecord');
      if (err || !clip) return;
      var commitBtn = byId('btnCommitClip');
      if (commitBtn) commitBtn.disabled = false;
    });
    return { recording: true };
  }
  function stopRecord() {
    var rec = ST.recorder;
    ST.recording = false;
    var btn = byId('btnStudioRecord');
    if (btn) btn.textContent = t('studioRecord');
    if (rec && rec.stop) { try { rec.stop(); } catch (e) {} }
    ST.recorder = null;
    return 'stopped';
  }
  function recordClip(wordIndex, cb) {
    cb = cb || noop;
    var media = global.navigator && global.navigator.mediaDevices;
    if (!ST.unlocked || !media || typeof global.MediaRecorder !== 'function') {
      cb(new Error('no_media_recorder'));
      return null;
    }
    var words = currentWords();
    var word = words[wordIndex] || words[0] || {};
    var path = 'assets/audio/session-w' + (Number(wordIndex) + 1) + '-' + Date.now() + '.mp3';
    media.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [];
      var recorder = new global.MediaRecorder(stream);
      ST.recorder = recorder;
      recorder.ondataavailable = function (ev) { if (ev.data) chunks.push(ev.data); };
      recorder.onstop = function () {
        try { stream.getTracks().forEach(function (track) { track.stop(); }); } catch (e) {}
        var blob = new global.Blob(chunks, { type: 'audio/mpeg' });
        var reader = new global.FileReader();
        reader.onload = function () {
          var raw = str(reader.result);
          var b64 = raw.indexOf(',') >= 0 ? raw.slice(raw.indexOf(',') + 1) : raw;
          ST.pendingClip = { path: path, base64: b64, word: str(word.w) };
          var preview = byId('recPreviewAudio');
          if (preview && typeof global.URL !== 'undefined' && global.URL.createObjectURL) {
            try { preview.src = global.URL.createObjectURL(blob); } catch (e) {}
          }
          msg(t('studioRecord') + ' ✓ ' + path, 'ok');
          cb(null, ST.pendingClip);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
    }, function () {
      ST.recording = false;
      msg(t('studioRecord') + ' — microphone unavailable', 'bad');
      cb(new Error('mic_denied'));
    });
    return { path: path };
  }
  function commitClip(token, cb) {
    cb = cb || noop;
    if (!ST.pendingClip) { cb(new Error('no_clip')); return false; }
    if (!sync() || !sync().commitClipFile) { cb(new Error('no_sync')); return false; }
    sync().commitClipFile(ST.pendingClip.path, ST.pendingClip.base64, 'Lecturer clip ' + ST.pendingClip.word, token, cb);
    return true;
  }

  /* ══ D-L6: the studio must catch up when sync boot lands ══════════════ */
  function onDataReady() {
    if (!ST.words.length) ST.words = sync() && sync().words ? sync().words() : [];
    var editor = byId('studioWords');
    if (editor && !str(editor.value)) {
      var words = ST.words.length ? ST.words : currentWords();
      if (words.length) editor.value = wordsToText(words);
    }
    setText(byId('costPreviewLine'), costPreviewLine());
    if (!ST.unlocked) mount();
    return true;
  }
  function onLangChange() { if (!ST.unlocked) return false; mount(); return true; }
  function refreshEditor() { return onDataReady(); }

  var Studio = {
    state: ST,
    mount: mount,
    init: mount,
    unlock: unlock,
    setup: setup,
    lock: lock,
    isUnlocked: isUnlocked,
    secrets: secrets,
    setEnvelope: setEnvelope,
    hasVault: hasVault,
    configEnvelope: configEnvelope,
    resolveEnvelope: resolveEnvelope,
    persistEnvelope: persistEnvelope,
    parseWords: parseWords,
    wordsToText: wordsToText,
    buildVersionPayload: buildVersionPayload,
    buildSessionPayload: buildSessionPayload,
    buildPublishPayloads: buildPublishPayloads,
    saveClassSettings: saveClassSettings,
    classSettingsSnapshot: classSettingsSnapshot,
    classSettingKeys: CLASS_SETTING_KEYS,
    voicePackPayload: voicePackPayload,
    publishChecklist: publishChecklist,
    nextSyncRev: nextSyncRev,
    openPublishPreview: openPublishPreview,
    publishPreviewWords: publishPreviewWords,
    publish: publish,
    generateClips: generateClips,
    commitVoicePack: commitVoicePack,
    costPreview: costPreview,
    costPreviewLine: costPreviewLine,
    guideSteps: guideSteps,
    loadVoicePack: loadVoicePack,
    fetchSubscription: fetchSubscription,
    testElevenLabsKey: testElevenLabsKey,
    testGitHubToken: testGitHubToken,
    refreshQuota: refreshQuota,
    recordClip: recordClip,
    toggleRecord: toggleRecord,
    stopRecord: stopRecord,
    commitClip: commitClip,
    elevenUrl: elevenUrl,
    voiceId: VOICE_ID,
    voiceModel: VOICE_MODEL,
    appVersion: appVersion,
    appendPin: appendPin,
    backspacePin: backspacePin,
    setPinValue: setPinValue,
    pinValue: pinValue,
    paintPinDots: paintPinDots,
    paintQuickButton: paintQuickButton,
    toggleSecretField: toggleSecretField,
    onDataReady: onDataReady,
    onLangChange: onLangChange,
    refreshEditor: refreshEditor,
    message: function () { return ST.message; },
    testStatusText: function () { return ST.testStatus; }
  };

  SDP.Studio = Studio;

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
    /* D-L6: sync boot can finish after the studio mounts. */
    doc.addEventListener('sdp:ready', function () { try { onDataReady(); } catch (e) {} }, false);
  }
})(typeof window !== 'undefined' ? window : this);
