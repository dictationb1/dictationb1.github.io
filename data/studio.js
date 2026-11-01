/*! Smart Dictation Player — Lecturer Studio & admin vault (v0.0.1.a)
 * Strict ES5, dependency free.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R7 vault, §R6 publishing
 * contract: docs/UI_COMPONENT_GUIDE.md §Settings 5th section (collapsed)
 * The studio is the ONLY place that touches a GitHub token or an ElevenLabs
 * key, and only while unlocked; secrets never reach localStorage. */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;
  var APP_VERSION = '0.0.1.a';
  var VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2';
  var VOICE_MODEL = 'eleven_flash_v2_5';

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
  function data() { return SDP.Data || null; }
  function sync() { return SDP.Sync || null; }
  function vault() { return SDP.Sync && SDP.Sync.Vault ? SDP.Sync.Vault : null; }

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
    generating: false
  };

  /* ── envelope source: config.json is the only public carrier ─────────── */
  function configEnvelope() {
    if (ST.envelope) return ST.envelope;
    var cfg = sync() && sync().config ? sync().config() : {};
    return str(cfg && cfg.encVault);
  }
  function hasVault() {
    var env = configEnvelope();
    if (!env) return false;
    var v = vault();
    return v && !v.isEmptyEnvelope(env);
  }

  function msg(text, state) {
    ST.message = str(text);
    ST.messageState = state || '';
    var node = byId('studioMsg');
    if (!node) return;
    node.textContent = ST.message;
    if (state) node.setAttribute('data-state', state); else node.removeAttribute('data-state');
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
        w: parts[0],
        p: parts[1] || '',
        pos: parts[2] || '',
        m: parts[3] || '',
        si: parts[4] || '',
        s: parts[5] || '',
        audio: parts[6] || ''
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
    return {
      ver: 1,
      appVersion: APP_VERSION,
      version: APP_VERSION,
      buildDate: nowIso.slice(0, 10),
      schema: 1,
      settingsRev: 1,
      session: str(sessionNo || '8'),
      title: str(title || 'Session ' + str(sessionNo || '8')),
      updatedAt: nowIso,
      syncRev: Number(syncRev) || Date.now()
    };
  }
  function buildSessionPayload(words, opts) {
    opts = opts || {};
    var base = sync() && sync().session ? JSON.parse(JSON.stringify(sync().session() || {})) : { ok: true, lists: [] };
    var listId = str(opts.listId || (sync() && sync().state ? sync().state.listId : '') || 'list_session_8_feelings');
    var list = null, i;
    var lists = Array.isArray(base.lists) ? base.lists : [];
    for (i = 0; i < lists.length; i++) if (lists[i] && lists[i].id === listId) list = lists[i];
    if (!list) {
      list = { id: listId, name: str(opts.title || 'Session ' + APP_VERSION), version: '0.0.1.a', session: 'Session ' + APP_VERSION, date: new Date().toISOString().slice(0, 10), active: true, words: [] };
      lists.unshift(list);
    }
    var clean = [];
    for (i = 0; i < (words || []).length; i++) {
      var w = words[i] || {};
      clean.push({
        w: str(w.w), p: str(w.p), pos: str(w.pos), m: str(w.m), si: str(w.si), s: str(w.s)
      });
    }
    list.words = clean;
    list.active = true;
    base.lists = lists;
    base.words = clean;
    if (opts.sessionNo) {
      base.session = base.session || {};
      base.session.no = str(opts.sessionNo);
      base.session.title = str(opts.title || base.session.title || '');
    }
    base.ok = true;
    base.updatedAt = new Date().toISOString();
    return base;
  }
  function buildPublishPayloads(words, opts) {
    opts = opts || {};
    var session = buildSessionPayload(words, opts);
    var version = buildVersionPayload(opts.sessionNo || (session.session && session.session.no) || '8',
      opts.title || (session.session && session.session.title) || '', opts.syncRev || Date.now());
    var cfgBase = sync() && sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
    cfgBase.ver = 1; cfgBase.appVersion = APP_VERSION; cfgBase.version = APP_VERSION;
    cfgBase.schema = 1; cfgBase.settingsRev = 1;
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

  /* ── PIN unlock / first-time setup ──────────────────────────────────── */
  function unlock(pin, cb) {
    cb = cb || noop;
    var v = vault();
    if (!v) { msg('crypto_unavailable', 'bad'); cb(new Error('crypto_unavailable')); return; }
    if (!hasVault()) {
      msg(t('studioSetupHint'), '');
      cb(new Error('no_vault'));
      return;
    }
    if (v.isLocked()) {
      msg(t('studioLockedOut') + ' ' + v.lockRemaining() + ' ' + t('seconds'), 'bad');
      var lockedErr = new Error('locked');
      lockedErr.code = 'locked';
      cb(lockedErr);
      return;
    }
    v.decryptV2(configEnvelope(), pin).then(function (secrets) {
      ST.unlocked = true;
      ST.secrets = isObj(secrets) ? secrets : {};
      if (v.stash) v.stash(ST.secrets);
      msg(t('studioUnlock') + ' ✓', 'ok');
      mount();
      cb(null, ST.secrets);
    }, function (err) {
      if (err && err.code === 'locked') {
        msg(t('studioLockedOut') + ' ' + str(err.retrySec || 60) + ' ' + t('seconds'), 'bad');
      } else {
        msg(t('studioBadPin') + (err && err.triesLeft !== undefined ? ' · ' + err.triesLeft : ''), 'bad');
      }
      cb(err || new Error('bad_pin'));
    });
  }

  function setup(pin, secrets, cb) {
    cb = cb || noop;
    var v = vault();
    if (!v) { cb(new Error('crypto_unavailable')); return; }
    if (str(pin).length < 4) { msg(t('studioBadPin'), 'bad'); cb(new Error('pin_too_short')); return; }
    v.encryptV2(isObj(secrets) ? secrets : {}, pin).then(function (envelope) {
      ST.envelope = envelope;
      ST.secrets = isObj(secrets) ? secrets : {};
      ST.unlocked = true;
      if (v.stash) v.stash(ST.secrets);
      msg(t('studioEnvelope') + ' ✓', 'ok');
      mount();
      cb(null, envelope);
    }, function (err) { cb(err || new Error('encrypt_failed')); });
  }

  function lock() {
    ST.unlocked = false;
    ST.secrets = {};
    try { if (vault()) vault().clear(); } catch (e) {}
    mount();
    return false;
  }

  function setEnvelope(envelope) { ST.envelope = str(envelope); return ST.envelope; }
  function isUnlocked() { return !!ST.unlocked; }
  function secrets() { return isObj(ST.secrets) ? ST.secrets : {}; }

  /* ── rendering ───────────────────────────────────────────────────────── */
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
      '<button type="button" class="btn btn-sm" id="btnStudioRecord">' + esc(t('studioRecord')) + '</button>' +
      '<button type="button" class="btn btn-sm" id="btnStudioLock">' + esc(t('studioLock')) + '</button>' +
      '</div>' +
      '<div id="studioPreview" class="studio-preview"></div>' +
      '<p class="muted">' + esc(t('studioElevenNote')) + '</p>' +
      '<p id="studioMsg" class="studio-msg"></p>' +
      '</div>';
  }
  function lockedMarkup() {
    var known = hasVault();
    var html = '<div class="pin-row">' +
      '<label class="for-only" for="studioPin">' + esc(t('studioPinLabel')) + '</label>' +
      '<input id="studioPin" class="input" type="password" inputmode="numeric" autocomplete="off" placeholder="' + esc(t('studioPinLabel')) + '">' +
      '<button type="button" class="btn btn-primary" id="btnStudioUnlock">' + esc(t('studioUnlock')) + '</button>' +
      '</div>' +
      '<p id="studioMsg" class="studio-msg"></p>';
    if (!known) {
      html += '<details class="studio-setup"><summary>' + esc(t('studioSetup')) + '</summary>' +
        '<p class="muted">' + esc(t('studioSetupHint')) + '</p>' +
        '<div class="studio-grid">' +
        '<label class="lbl" for="studioNewPin">' + esc(t('studioPinLabel')) + '</label>' +
        '<input id="studioNewPin" class="input" type="password" autocomplete="off">' +
        '<label class="lbl" for="studioKeyGh">GitHub token</label>' +
        '<input id="studioKeyGh" class="input" type="password" autocomplete="off">' +
        '<label class="lbl" for="studioKeyEl">ElevenLabs key</label>' +
        '<input id="studioKeyEl" class="input" type="password" autocomplete="off">' +
        '<label class="lbl" for="studioGasUrl">Apps Script relay URL</label>' +
        '<input id="studioGasUrl" class="input" type="url" autocomplete="off">' +
        '<button type="button" class="btn btn-primary" id="btnStudioSetup">' + esc(t('studioSetup')) + '</button>' +
        '<textarea id="studioEnvelope" readonly aria-label="' + esc(t('studioEnvelope')) + '"></textarea>' +
        '<button type="button" class="btn btn-sm" id="btnStudioCopyEnv">' + esc(t('studioCopy')) + '</button>' +
        '</div></details>';
    }
    return html;
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
    bind();
    return true;
  }

  function bind() {
    var unlockBtn = byId('btnStudioUnlock');
    if (unlockBtn && !unlockBtn._sdpBound) {
      unlockBtn._sdpBound = true;
      unlockBtn.addEventListener('click', function () {
        var pin = byId('studioPin');
        unlock(pin ? pin.value : '', noop);
      });
    }
    var setupBtn = byId('btnStudioSetup');
    if (setupBtn && !setupBtn._sdpBound) {
      setupBtn._sdpBound = true;
      setupBtn.addEventListener('click', function () {
        var pin = byId('studioNewPin');
        var secretsIn = {
          ghToken: str((byId('studioKeyGh') || {}).value),
          elevenKey: str((byId('studioKeyEl') || {}).value),
          gasUrl: str((byId('studioGasUrl') || {}).value),
          updatedAt: Date.now()
        };
        setup(pin ? pin.value : '', secretsIn, function (err, envelope) {
          if (err) return;
          var out = byId('studioEnvelope');
          if (out) out.value = envelope;
        });
      });
    }
    var copyBtn = byId('btnStudioCopyEnv');
    if (copyBtn && !copyBtn._sdpBound) {
      copyBtn._sdpBound = true;
      copyBtn.addEventListener('click', function () {
        var out = byId('studioEnvelope');
        if (out && out.select) { try { out.select(); doc.execCommand('copy'); } catch (e) {} }
      });
    }
    var editor = byId('studioWords');
    if (editor && !editor._sdpBound) {
      editor._sdpBound = true;
      editor.addEventListener('input', function () {
        ST.words = parseWords(editor.value);
        setText(byId('studioCount'), ST.words.length + ' ' + t('studioWordsCount'));
      });
    }
    var previewBtn = byId('btnStudioPreview');
    if (previewBtn && !previewBtn._sdpBound) {
      previewBtn._sdpBound = true;
      previewBtn.addEventListener('click', function () { openPublishPreview(); });
    }
    var publishBtn = byId('btnStudioPublish');
    if (publishBtn && !publishBtn._sdpBound) {
      publishBtn._sdpBound = true;
      publishBtn.addEventListener('click', function () { publish(noop); });
    }
    var genBtn = byId('btnStudioGenerate');
    if (genBtn && !genBtn._sdpBound) {
      genBtn._sdpBound = true;
      genBtn.addEventListener('click', function () { generateClips(currentWords(), noop); });
    }
    var recBtn = byId('btnStudioRecord');
    if (recBtn && !recBtn._sdpBound) {
      recBtn._sdpBound = true;
      recBtn.addEventListener('click', function () { recordClip(0, noop); });
    }
    var lockBtn = byId('btnStudioLock');
    if (lockBtn && !lockBtn._sdpBound) {
      lockBtn._sdpBound = true;
      lockBtn.addEventListener('click', function () { lock(); });
    }
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
      '<p class="studio-msg">data/session.json · data/version.json · data/config.json · ' + ST.words.length + ' ' + esc(t('studioWordsCount')) + '</p>';
    return payloads;
  }

  /* ── publishing: Contents API + optional GAS relay / ntfy state ─────── */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 publishing */
  function publish(cb) {
    cb = cb || noop;
    if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); cb(new Error('locked')); return; }
    var token = str(ST.secrets.ghToken);
    if (!token) { msg(t('studioNoToken'), 'bad'); cb(new Error('no_token')); return; }
    var payloads = buildPublishPayloads(currentWords(), {});
    var paths = ['data/session.json', 'data/version.json', 'data/config.json'];
    var pending = paths.length;
    var failed = [];
    function done() {
      pending -= 1;
      if (pending > 0) return;
      if (failed.length) {
        msg(t('studioPublishFail') + ': ' + failed.join(', '), 'bad');
        cb(new Error('publish_failed'), { failed: failed });
        return;
      }
      ST.lastPublish = { at: Date.now(), files: paths, version: payloads.version };
      msg(t('studioPublishOk') + ' · v' + payloads.version.appVersion, 'ok');
      pushLiveState(payloads.version);
      cb(null, ST.lastPublish);
    }
    for (var i = 0; i < paths.length; i++) {
      (function (path) {
        var text = payloads.files[path];
        sync().commitFile(path, text, 'Smart Dictation publish ' + APP_VERSION, token, function (err) {
          if (err) failed.push(path);
          done();
        });
      })(paths[i]);
    }
  }

  function pushLiveState(version) {
    var gasUrl = str(ST.secrets.gasUrl);
    if (!gasUrl) return false;
    var body = JSON.stringify({ action: 'publish', pin: str(ST.secrets.pin || ''), session: version.session, appVersion: version.appVersion });
    try { sync().postRelay(gasUrl, body, noop); return true; } catch (e) { return false; }
  }

  /* ── ElevenLabs batch generation (Alice, flash_v2_5) ────────────────── */
  function elevenUrl() {
    return 'https://api.elevenlabs.io/v1/text-to-speech/' + VOICE_ID;
  }
  function generateClips(words, cb) {
    cb = cb || noop;
    if (!ST.unlocked) { cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
    var apiKey = str(ST.secrets.elevenKey);
    if (!apiKey) { msg(t('studioNoToken'), 'bad'); cb(new Error('no_key')); return { ok: false, reason: 'no_key' }; }
    var list = (words || []).slice(0, 30);
    var made = [];
    var index = 0;
    ST.generating = true;
    function next() {
      if (index >= list.length) {
        ST.generating = false;
        msg(t('studioGenerate') + ' ✓ ' + made.length, 'ok');
        cb(null, made);
        return;
      }
      var word = list[index];
      index += 1;
      if (!word || !word.w) { next(); return; }
      try {
        global.fetch(elevenUrl(), {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({
            text: str(word.w),
            model_id: VOICE_MODEL,
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true }
          })
        }).then(function (res) { return res && res.ok && res.arrayBuffer ? res.arrayBuffer() : null; })
          .then(function (buffer) {
            if (buffer) made.push({ w: str(word.w), bytes: buffer.byteLength });
            next();
          }, function () { next(); });
      } catch (e) { next(); }
    }
    next();
    return { ok: true, started: list.length };
  }

  /* ── lecturer clip recorder (MediaRecorder → Contents API) ──────────── */
  function recordClip(wordIndex, cb) {
    cb = cb || noop;
    var media = global.navigator && global.navigator.mediaDevices;
    if (!ST.unlocked || !media || typeof global.MediaRecorder !== 'function') {
      msg(t('studioRecord') + ' — microphone unavailable', 'bad');
      cb(new Error('no_media_recorder'));
      return null;
    }
    var words = currentWords();
    var word = words[wordIndex] || words[0] || {};
    var path = 'assets/audio/session-w' + (Number(wordIndex) + 1) + '-' + Date.now() + '.mp3';
    media.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [];
      var recorder = new global.MediaRecorder(stream);
      recorder.ondataavailable = function (ev) { if (ev.data) chunks.push(ev.data); };
      recorder.onstop = function () {
        try { stream.getTracks().forEach(function (track) { track.stop(); }); } catch (e) {}
        var blob = new global.Blob(chunks, { type: 'audio/mpeg' });
        var reader = new global.FileReader();
        reader.onload = function () {
          var raw = str(reader.result);
          var b64 = raw.indexOf(',') >= 0 ? raw.slice(raw.indexOf(',') + 1) : raw;
          ST.pendingClip = { path: path, base64: b64, word: str(word.w) };
          msg(t('studioRecord') + ' ✓ ' + path, 'ok');
          cb(null, ST.pendingClip);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      global.setTimeout(function () { try { recorder.stop(); } catch (e) {} }, 4200);
    }, function () {
      msg(t('studioRecord') + ' — microphone unavailable', 'bad');
      cb(new Error('mic_denied'));
    });
    return { path: path };
  }
  function commitClip(token, cb) {
    cb = cb || noop;
    if (!ST.pendingClip) { cb(new Error('no_clip')); return; }
    sync().commitClipFile(ST.pendingClip.path, ST.pendingClip.base64, 'Lecturer clip ' + ST.pendingClip.word, token, cb);
  }

  function onDataReady() {
    if (!ST.words.length) ST.words = sync() && sync().words ? sync().words() : [];
    if (!ST.unlocked) mount();
    return true;
  }
  function onLangChange() { if (!ST.unlocked) return; mount(); return true; }

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
    parseWords: parseWords,
    wordsToText: wordsToText,
    buildVersionPayload: buildVersionPayload,
    buildSessionPayload: buildSessionPayload,
    buildPublishPayloads: buildPublishPayloads,
    openPublishPreview: openPublishPreview,
    publishPreviewWords: publishPreviewWords,
    publish: publish,
    generateClips: generateClips,
    recordClip: recordClip,
    commitClip: commitClip,
    elevenUrl: elevenUrl,
    voiceId: VOICE_ID,
    voiceModel: VOICE_MODEL,
    onDataReady: onDataReady,
    onLangChange: onLangChange,
    message: function () { return ST.message; }
  };

  SDP.Studio = Studio;

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
  }
})(typeof window !== 'undefined' ? window : this);
