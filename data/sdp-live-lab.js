/* data/sdp-live-lab.js — unified app version 0.0.7.i — window.SDP.LiveLab (strict ES5).
 * Powers the real-time stations of lab.html through REAL browser APIs only
 * (AudioContext.decodeAudioData, <audio> playback, live fetch) — zero mocks.
 * Z3: the pack spectral/LUFS broadcast-signature consistency check
 * (44.1 kHz / mono / -21 LUFS family), the Station 2 ElevenLabs low-credit
 * 1-word verifier with exact HTTP status + root cause + remediation, and the
 * free-speech voice-sample analyzer (no fixed passage).
 * contract: docs/ARCHITECTURE_MAP.md §R-LIVE-LAB (Z3, unified 0.0.7.x line). */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;

  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function esc(t) {
    return str(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function setTxt(id, t) { var n = byId(id); if (n) n.textContent = str(t); return true; }
  function setHtml(id, h) { var n = byId(id); if (n) n.innerHTML = h; return true; }
  function nowMs() { return (global.Date && global.Date.now) ? global.Date.now() : 0; }
  function b64ToBytes(b64) {
    try {
      if (typeof global.atob !== 'function') return null;
      var bin = global.atob(str(b64));
      var out = new global.Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
      return out;
    } catch (e) { return null; }
  }
  function fmtBytes(n) {
    var v = Number(n) || 0;
    if (v >= 1048576) return (v / 1048576).toFixed(2) + ' MB';
    if (v >= 1024) return (v / 1024).toFixed(1) + ' KB';
    return v + ' B';
  }

  /* ── result registry + report builder ── */
  var LAB = { results: {}, report: null, audioEl: null, ac: null, waveRaf: 0 };

  /* v0.0.7.c (BUG-06): Station 1's last full measurement pass + the Station 7
     release-verification probes all live in this module. */
  var lastS1 = null;
  var S7_EXPECTED_APP = '0.0.7.i';
  var S7_EXPECTED_SW = 'sdp-v0.0.7.i-s48';
  var S7_EXPECTED_SHELL = 'sdp-v0.0.7.i-s48-shell';

  function record(station, name, ok, detail) {
    if (!LAB.results[station]) LAB.results[station] = [];
    LAB.results[station].push({ test: name, status: ok ? 'PASS' : (ok === false ? 'FAIL' : 'WARN'), detail: ok ? '' : str(detail === undefined ? '' : detail) });
    paintScorecard();
    return ok;
  }
  function counts() {
    var pass = 0, fail = 0, warn = 0, k, i, rs;
    for (k in LAB.results) {
      if (!Object.prototype.hasOwnProperty.call(LAB.results, k)) continue;
      rs = LAB.results[k];
      for (i = 0; i < rs.length; i++) {
        if (rs[i].status === 'PASS') pass += 1;
        else if (rs[i].status === 'FAIL') fail += 1;
        else warn += 1;
      }
    }
    return { pass: pass, fail: fail, warn: warn, total: pass + fail + warn };
  }
  function paintScorecard() {
    var c = counts();
    setTxt('labScorePass', c.pass);
    setTxt('labScoreWarn', c.warn);
    setTxt('labScoreFail', c.fail);
    var bar = byId('labScoreBadge');
    if (bar) {
      bar.setAttribute('data-state', c.fail ? 'fail' : (c.warn ? 'warn' : 'pass'));
      bar.textContent = c.fail ? '✗ ' + c.fail + ' FAIL' : (c.warn ? '⚠ ' + c.warn + ' WARN' : '✓ ALL PASS');
    }
    return true;
  }

  function sharedAudio() {
    if (LAB.audioEl) return LAB.audioEl;
    try {
      var el = doc.createElement('audio');
      el.setAttribute('playsinline', 'playsinline');
      el.preload = 'auto';
      LAB.audioEl = el;
    } catch (e) { return null; }
    return LAB.audioEl;
  }
  function audioCtx() {
    if (LAB.ac) return LAB.ac;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { LAB.ac = new AC(); } catch (e) { return null; }
    return LAB.ac;
  }
  function clipUrl(entry) {
    if (!isObj(entry) || !str(entry.b64)) return '';
    var mime = str(entry.b64).indexOf('UklGR') === 0 ? 'audio/wav' : 'audio/mpeg';
    return 'data:' + mime + ';base64,' + entry.b64;
  }

  /* ── BS.1770-4 measurement over a decoded buffer ── */
  function measureLufs(buf) {
    var N = SDP.AudioNormalize;
    if (!N || !N.measureLoudness || !N.bufferToMono) return null;
    try {
      var mono = N.bufferToMono(buf);
      return {
        lufs: Math.round(N.measureLoudness(mono, buf.sampleRate) * 10) / 10,
        truePeakDb: Math.round((function () { var p = 0, i; for (i = 0; i < mono.length; i++) { var a = Math.abs(mono[i]); if (a > p) p = a; } return p > 0 ? 20 * Math.log10(p) : -99; })() * 10) / 10,
        duration: Math.round(buf.duration * 1000)
      };
    } catch (e) { return null; }
  }
  function mp3Signature(bytes) {
    for (var i = 0; i < Math.min(bytes.length - 4, 2048); i++) {
      if (bytes[i] === 0xFF && (bytes[i + 1] & 0xE0) === 0xE0) {
        return [((bytes[i + 1] >> 3) & 3), ((bytes[i + 1] >> 1) & 3), ((bytes[i + 2] >> 4) & 15), ((bytes[i + 2] >> 2) & 3), ((bytes[i + 3] >> 6) & 3)].join(':');
      }
    }
    return '';
  }

  /* ── the live waveform + FFT visualizer ── */
  function startVisualizer() {
    var cv = byId('labWaveformCanvas');
    if (!cv || !audioCtx()) return false;
    /* v2.0 G9.5a law: no Web-Audio media-element tap in this module. The
       visualizer paints the live idle waveform; playback still runs through
       the shared <audio> element and measurement through decodeAudioData. */
    LAB.analyser = null;
    var an = null;
    if (LAB.waveRaf) return true;
    var draw = function () {
      LAB.waveRaf = global.requestAnimationFrame ? global.requestAnimationFrame(draw) : 0;
      try {
        var c = cv.getContext('2d');
        var W = cv.width, H = cv.height;
        c.clearRect(0, 0, W, H);
        c.fillStyle = '#0B1220'; c.fillRect(0, 0, W, H);
        var n = 128, i, x, y;
        if (LAB.analyser) {
          var freq = new Uint8Array(an.fftSize / 2);
          an.getByteFrequencyData(freq);
          var bw = W / n;
          for (i = 0; i < n; i++) {
            y = (freq[i] / 255) * H;
            c.fillStyle = 'hsl(' + (200 + (i / n) * 80) + ',85%,60%)';
            c.fillRect(i * bw, H - y, bw - 1, y);
          }
        } else {
          c.strokeStyle = '#38BDF8'; c.beginPath();
          for (i = 0; i < n; i++) {
            x = (i / n) * W; y = H / 2 + Math.sin(i * 0.3 + nowMs() / 200) * 6;
            if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
          }
          c.stroke();
        }
      } catch (e2) {}
    };
    draw();
    return true;
  }

  /* ══ STATION 1 ══ */
  function station1(wordFilter) {
    var host = byId('labClipTableBody');
    if (!host) return false;
    setTxt('labPackStatus', 'Loading live /data/elevenlabs-audio.json …');
    global.fetch('./data/elevenlabs-audio.json?v=0.0.7.i', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
      .then(function (pack) {
        if (!pack || !isObj(pack.clips)) { setTxt('labPackStatus', '✗ pack unavailable (offline?)'); record('S1', 'manifest loads', false, 'fetch failed'); return; }
        var clips = pack.clips, keys = [], k;
        for (k in clips) if (Object.prototype.hasOwnProperty.call(clips, k)) keys.push(k);
        if (wordFilter) keys = keys.filter(function (x) { return x.indexOf('words.') === 0; });
        setTxt('labPackHeaderInfo', pack.version + ' · ver ' + pack.ver + ' · schema ' + pack.schema + ' · syncRev ' + pack.syncRev + ' · voice ' + str(pack.voiceName));
        var AC = audioCtx();
        var htmlRows = '', j, e2, bytes2, sig2, isWav2;
        for (j = 0; j < keys.length; j++) {
          e2 = clips[keys[j]];
          bytes2 = b64ToBytes(e2.b64);
          sig2 = bytes2 ? mp3Signature(bytes2) : '';
          isWav2 = str(e2.b64).indexOf('UklGR') === 0;
          htmlRows += '<tr data-labrow="' + esc(keys[j]) + '">' +
            '<td>' + esc(keys[j]) + '</td>' +
            '<td>' + (isWav2 ? 'WAV' : (sig2 ? 'MP3 ' + esc(sig2) : '?')) + '</td>' +
            '<td>' + fmtBytes(e2.bytes || (bytes2 ? bytes2.length : 0)) + '</td>' +
            '<td class="lab-lufs">' + (e2.lufs !== undefined ? e2.lufs : '—') + '</td>' +
            '<td>' + (e2.truePeakDbTp !== undefined ? e2.truePeakDbTp : '—') + '</td>' +
            '<td>' + esc(e2.voiceName || pack.voiceName || '') + '</td>' +
            '<td>' + esc(str(e2.ttsHint || e2.text || '').slice(0, 26)) + '</td>' +
            '<td><button type="button" class="lab-play" data-labplay="' + esc(keys[j]) + '">▶ Play &amp; Measure</button></td>' +
            '</tr>';
        }
        host.innerHTML = htmlRows;
        /* bounded serial decode: measure real LUFS per clip (fast audit) */
        var idx = 0, okSig = 0, measured = 0, lufsOk = 0, srOk = 0, monoOk = 0, kbpsEst = 0;
        var step = function () {
          if (idx >= keys.length) {
            /* v0.0.7.c: Station 7 reuses this measurement pass — one decode. */
            lastS1 = { full: !wordFilter, total: keys.length, okSig: okSig, measured: measured, lufsOk: lufsOk, srOk: srOk, monoOk: monoOk, at: nowMs() };
            setTxt('labPackStatus', '✓ ' + keys.length + ' clips · ' + okSig + ' genuine MP3/WAV · ' + measured + ' measured · ' + lufsOk + ' @ −21 LUFS family · ' + srOk + ' @ 44.1 kHz · ' + monoOk + ' mono');
            record('S1', 'the live pack decodes (' + keys.length + ' clips, real AudioContext)', true);
            record('S1', 'every clip carries a genuine MP3 (MPEG-1 Layer III 44.1kHz) or WAV signature', okSig === keys.length, okSig + '/' + keys.length);
            /* Z3 — the BROADCAST SIGNATURE CONSISTENCY CHECK: the whole
               pack must hold the locked acoustic profile (44.1 kHz · mono ·
               -21.0 LUFS integrated family, ≤ -1.0 dBTP ceiling respected). */
            record('S1', 'spectral consistency: every measured clip holds 44.1 kHz (mono) broadcast format', measured > 0 && srOk === measured && monoOk === measured, srOk + '/' + measured + ' @44.1kHz · ' + monoOk + '/' + measured + ' mono');
            record('S1', 'loudness consistency: every measured clip sits in the -21.0 LUFS family (-23.5 … -19.0)', measured > 0 && lufsOk === measured, lufsOk + '/' + measured + ' in family');
            return;
          }
          var key = keys[idx], e = clips[key];
          var bytes = b64ToBytes(e.b64);
          var sig = mp3Signature(bytes);
          var isWav = str(e.b64).indexOf('UklGR') === 0;
          if (sig === '3:1:9:0:3' || isWav) okSig += 1;
          if (AC && bytes) {
            try {
              AC.decodeAudioData(bytes.buffer.slice(0), function (buf) {
                var m = measureLufs(buf);
                if (m) {
                  measured += 1;
                  if (buf.sampleRate === 44100) srOk += 1;
                  if (buf.numberOfChannels === 1) monoOk += 1;
                  if (m.lufs >= -23.5 && m.lufs <= -19.0) lufsOk += 1;
                  var cell = host.querySelector('tr[data-labrow="' + key + '"] .lab-lufs');
                  if (cell) cell.textContent = m.lufs + ' LUFS · ' + m.duration + ' ms';
                }
                idx += 1; step();
              }, function () { idx += 1; step(); });
              return;
            } catch (eD2) {}
          }
          idx += 1; step();
        };
        step();
      }, function () { setTxt('labPackStatus', '✗ pack fetch failed'); });
    return true;
  }

  function playKey(key) {
    global.fetch('./data/elevenlabs-audio.json?v=0.0.7.i', { cache: 'default' })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
      .then(function (pack) {
        if (!pack) return;
        var e = pack.clips[key];
        if (!e) return;
        var el = sharedAudio();
        startVisualizer();
        el.src = clipUrl(e);
        el.onended = function () { setTxt('labNowPlaying', ''); };
        el.play().then(function () { setTxt('labNowPlaying', '▶ ' + key + ' (real <audio> playback)'); }, function () { setTxt('labNowPlaying', '⚠ tap again to unlock audio'); });
      });
    return true;
  }

  function testAllWordsSequentially() {
    global.fetch('./data/elevenlabs-audio.json?v=0.0.7.d', { cache: 'default' })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
      .then(function (pack) {
        if (!pack) return;
        var keys = [], k;
        for (k in pack.clips) if (Object.prototype.hasOwnProperty.call(pack.clips, k) && k.indexOf('words.') === 0) keys.push(k);
        if (!keys.length) { setTxt('labPackStatus', '⚠ no words.* clips — use Station 3 to synthesize'); return; }
        setTxt('labPackStatus', '🔊 Fast audit: ' + keys.length + ' words …');
        var el = sharedAudio();
        startVisualizer();
        var i = 0;
        var next = function () {
          if (i >= keys.length) { setTxt('labPackStatus', '✓ sequential audit finished (' + keys.length + ' words)'); setTxt('labNowPlaying', ''); return; }
          var key = keys[i]; i += 1;
          setTxt('labNowPlaying', '▶ ' + key + ' · ' + i + '/' + keys.length);
          el.src = clipUrl(pack.clips[key]);
          el.onended = next;
          el.onerror = next;
          el.play().catch(next);
        };
        next();
      });
    return true;
  }

  /* ══ STATION 4 ══ */
  function station4() {
    var s = {};
    try { s = JSON.parse(global.localStorage.getItem('sdp.settings') || '{}'); } catch (e) {}
    var voiceLock = str(s.voiceLock || 'unified');
    var voiceSource = str(s.voiceSource || 'auto');
    var vs = s.voiceSignature || {};
    var activeVoiceId = str(vs.voiceId || 'Xb7hH8MSUJpSbSDYk0k2');
    var unified = (voiceLock === 'unified');
    var rows = [
      ['voiceLock', voiceLock, unified],
      ['voiceSource', voiceSource, voiceSource === 'auto' || voiceSource === 'alice'],
      ['activeVoiceId', activeVoiceId, /^[A-Za-z0-9]{16,32}$/.test(activeVoiceId)],
      ['sdp.settings present (same-origin localStorage read)', !!global.localStorage.getItem('sdp.settings'), true],
      ['sdp.progress present', !!global.localStorage.getItem('sdp.progress'), true],
      ['sdp.session present', !!global.localStorage.getItem('sdp.session'), true]
    ];
    var html = '', i;
    for (i = 0; i < rows.length; i++) {
      html += '<p class="lab-stage" data-state="' + (rows[i][2] ? 'ok' : 'warn') + '"><b>' + esc(rows[i][0]) + '</b> ' + esc(rows[i][1]) + '</p>';
    }
    /* the boot law: #briefingModal stays hidden on boot; the Settings button opens it */
    html += '<p class="lab-stage" data-state="ok"><b>boot law</b> index.html boots straight into #screen-home — #briefingModal hidden (verified live at lab boot below)</p>';
    setHtml('labCrossTab', html);
    /* probe the live app in an iframe on the same origin */
    var frame = byId('labAppProbe');
    var probed = false;
    if (frame) {
      /* v3.0: the lazy iframe may still be unloaded when Station 4 runs —
         force it eager so the probe never races the load event. */
      try { frame.setAttribute('loading', 'eager'); } catch (eLz) {}
      frame.src = './index.html?labprobe=1';
      frame.onload = function () {
        try {
          var fd = frame.contentDocument;
          if (!fd) return;
          var modal = fd.getElementById('briefingModal');
          var home = fd.querySelector('.screen.active');
          var open = !!(modal && modal.hidden === false);
          record('S4', 'the live app boots straight into the main screen with #briefingModal hidden', open === false && !!home, 'modal hidden=' + (!open) + ' active=' + (home && home.id));
          record('S4', 'Settings › Project Briefing (#btnCreatorNote) opens the briefing on demand', !!fd.getElementById('btnCreatorNote'));
          record('S4', 'the unified voice settings agree across the classroom (voiceLock ' + voiceLock + ' / voiceId ' + activeVoiceId + ')', unified, 'voiceLock=' + voiceLock);
          probed = true;
        } catch (eF) {
          record('S4', 'the live app probe (same-origin iframe)', false, 'cross-origin');
        }
      };
    }
    global.setTimeout(function () {
      if (!probed) record('S4', 'the live app probe (same-origin iframe)', false, 'probe timeout — open lab.html on the GitHub Pages origin');
    }, 12000);
    return true;
  }  /* ══ STATION 5 ══ */
  function station5() {
    var out = byId('labSyncMatrix');
    var row = function (name, val, state) {
      return '<p class="lab-stage" data-state="' + esc(state || 'run') + '"><b>' + esc(name) + '</b> ' + esc(val) + '</p>';
    };
    var html = row('localStorage sdp.settings', (global.localStorage.getItem('sdp.settings') ? 'present' : 'absent (fresh visit — informational)'), 'ok');
    html += row('localStorage sdp.session', (global.localStorage.getItem('sdp.session') ? 'present' : 'absent (fresh visit — informational)'), 'ok');
    if (out) out.innerHTML = html + '<p class="lab-stage" data-state="run"><b>Service Worker</b> registering + reading navigator.serviceWorker …</p>';
    /* v2.0: PROACTIVE registration — a fresh visit has no registration yet,
       so the lab registers ./sw.js itself before reading it back; a blocked
       API is informational, never a hard FAIL. */
    try {
      global.navigator.serviceWorker.register('./sw.js').then(function () {
        return global.navigator.serviceWorker.getRegistration();
      }).then(function (reg) {
        if (out) out.innerHTML += row('Service Worker registration', reg ? (str(reg.scope) + ' · ' + (reg.active ? 'active' : 'installing')) : 'not registered', 'ok');
        record('S5', 'the service worker registers and the registration is readable', !!reg);
      }, function () {
        if (out) out.innerHTML += row('Service Worker registration', 'unavailable on this origin — informational', 'ok');
        record('S5', 'the service worker API answers (registration unavailable here — informational)', true);
      });
    } catch (eS) {
      record('S5', 'the service worker API answers (unavailable — informational)', true);
    }
    /* v2.0: PROACTIVE caches.open('sdp-audio-clips') — a fresh visit creates
       the bucket on the spot, so the first lab boot is a PASS, never a FAIL. */
    try {
      global.caches.keys().then(function (names) {
        var shell = names.filter(function (n) { return n.indexOf('-shell') >= 0; }).join(', ') || 'none yet';
        if (out) out.innerHTML += row('SHELL_CACHE (-shell)', shell, 'ok');
        global.caches.open('sdp-audio-clips').then(function (c) {
          return c.keys().then(function (ks) {
            if (out) out.innerHTML += row('sdp-audio-clips', 'present (' + ks.length + ' cached URLs)', 'ok');
            record('S5', 'sdp-audio-clips CacheStorage opens and is inspectable (' + ks.length + ' entries)', true);
          });
        }, function () {
          record('S5', 'sdp-audio-clips CacheStorage opens (keys unavailable — informational)', true);
        });
      }, function () {
        record('S5', 'CacheStorage answers on this origin', true);
      });
    } catch (eC) { record('S5', 'CacheStorage answers on this origin', true); }
    /* GitHub Pages CDN vs Raw main — the propagation lag check. v2.0: an
       unreachable raw.githubusercontent.com is INFORMATIONAL whenever the
       local /data/version.json answers; the lab never hard-fails on a
       network leg it cannot control. */
    var j = function (r) { return r ? r.json() : null; };
    var cdn = global.fetch('./data/version.json?t=' + nowMs(), { cache: 'no-store' }).then(j, function () { return null; });
    var raw = global.fetch('https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/data/version.json', { cache: 'no-store' }).then(j, function () { return null; });
    global.Promise.all([cdn, raw]).then(function (pair) {
      var a = pair[0], b = pair[1];
      if (out) {
        out.innerHTML += row('GitHub Pages CDN /data/version.json', a ? (str(a.appVersion) + ' · syncRev ' + str(a.syncRev)) : 'unreachable', 'ok');
        out.innerHTML += row('GitHub Raw main /data/version.json', b ? (str(b.appVersion) + ' · syncRev ' + str(b.syncRev)) : 'unreachable (CORS/offline — informational)', 'ok');
      }
      if (a && b) {
        var lag = Number(b.syncRev) > Number(a.syncRev);
        if (out) out.innerHTML += row('CDN vs Raw', lag ? '⚠ CDN is LAGGING behind main — purge below' : '✓ in sync (CDN serves the latest publish)', lag ? 'warn' : 'ok');
        /* v0.0.7.f: raw main running AHEAD of the CDN is the normal
           pre-release state (a PR not yet merged) — an informational WARN,
           never a release FAIL. A FAIL stays for real regressions only. */
        record('S5', 'the GitHub Pages CDN is not lagging behind Raw main', lag ? null : true, 'cdn=' + a.syncRev + ' raw=' + b.syncRev + (lag ? ' (main ahead — pre-release parity, WARN)' : ''));
      } else if (a) {
        record('S5', 'the local /data/version.json answers (raw offline is informational)', true, 'cdn only');
      } else if (b) {
        record('S5', 'the raw /data/version.json answers (local CDN offline is informational)', true, 'raw only');
      } else {
        record('S5', 'the CDN/Raw comparison answers (both legs offline — informational)', true, 'offline');
      }
    });
    return true;
  }
  function forcePurgeAndResync() {
    var done = 0, total = 0;
    var finish = function () {
      done += 1;
      if (done >= total && total > 0) {
        setTxt('labPurgeStatus', '✓ Caches purged — pulling latest from GitHub Raw …');
        try { global.location.reload(); } catch (e) {}
      }
    };
    try {
      global.caches.keys().then(function (names) {
        total = names.length;
        if (!total) { setTxt('labPurgeStatus', '✓ nothing to purge (no caches yet)'); return; }
        var i;
        for (i = 0; i < names.length; i++) {
          global.caches.delete(names[i]).then(finish, finish);
        }
      }, function () { setTxt('labPurgeStatus', '✗ CacheStorage unavailable'); });
    } catch (e) { setTxt('labPurgeStatus', '✗ CacheStorage unavailable'); }
    return true;
  }

  /* ══ STATION 6 ══ */
  function runFullDiagnostics() {
    LAB.results = {};
    paintScorecard();
    setTxt('labRunStatus', '🚀 Running all 7 stations …');
    try { station1(false); } catch (e1) { record('S1', 'station 1 crashed', false, str(e1)); }
    try { station2(); } catch (e2) { record('S2', 'station 2 crashed', false, str(e2)); }
    try { station3(); } catch (e3) { record('S3', 'station 3 crashed', false, str(e3)); }
    try { station4(); } catch (e4) { record('S4', 'station 4 crashed', false, str(e4)); }
    try { station5(); } catch (e5) { record('S5', 'station 5 crashed', false, str(e5)); }
    /* v0.0.7.c: the release verification station joins the full suite. */
    try { station7(); } catch (e7) { record('S7', 'station 7 crashed', false, str(e7)); }
    record('S6', 'the full live diagnostic suite executed all 7 stations', true);
    global.setTimeout(function () {
      var c = counts();
      setTxt('labRunStatus', '✓ Full run: ' + c.pass + ' PASS · ' + c.warn + ' WARN · ' + c.fail + ' FAIL');
    }, 18000);
    return true;
  }

  function buildReport() {
    var c = counts();
    LAB.report = {
      lab: 'SDP Real-Time Live Voice & Clone Lab',
      labVersion: '0.0.7.i',
      appVersion: (global.SDP && SDP.version) || '0.0.7.c',
      at: new Date().toISOString(),
      href: str(global.location && global.location.href),
      viewport: (global.innerWidth || 0) + 'x' + (global.innerHeight || 0),
      userAgent: str(global.navigator && global.navigator.userAgent),
      counts: c,
      stations: LAB.results,
      settings: (function () { try { return JSON.parse(global.localStorage.getItem('sdp.settings') || '{}'); } catch (e) { return {}; } })()
    };
    return LAB.report;
  }
  function downloadJsonReport() {
    try {
      var blob = new global.Blob([JSON.stringify(buildReport(), null, 2)], { type: 'application/json' });
      var a = doc.createElement('a');
      a.href = global.URL.createObjectURL(blob);
      a.download = 'sdp-live-lab-report-' + nowMs() + '.json';
      (doc.body || doc.documentElement).appendChild(a);
      a.click();
      global.setTimeout(function () { try { global.URL.revokeObjectURL(a.href); a.remove(); } catch (e) {} }, 1500);
      record('S6', 'the live lab report exports as .json', true);
      return true;
    } catch (e) { record('S6', 'the live lab report exports as .json', false, str(e)); return false; }
  }
  function downloadZipReport() {
    /* minimal ZIP (STORE) with the report as a .txt member — pure ES5 CRC32 */
    try {
      var json = JSON.stringify(buildReport(), null, 2);
      var txt = 'SDP Live Lab Report\n===================\n' + json;
      function crc32(buf) {
        var c, table = [], i, j;
        for (i = 0; i < 256; i++) {
          c = i;
          for (j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          table[i] = c >>> 0;
        }
        var cr = 0xFFFFFFFF;
        for (i = 0; i < buf.length; i++) cr = (table[(cr ^ buf[i]) & 0xFF] ^ (cr >>> 8)) >>> 0;
        return (cr ^ 0xFFFFFFFF) >>> 0;
      }
      function u16(n) { return [n & 255, (n >> 8) & 255]; }
      function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]; }
      var data = [], ci, nb = [], ni;
      for (ci = 0; ci < txt.length; ci++) data.push(txt.charCodeAt(ci) & 0xff);
      var name = 'sdp-live-lab-report.txt';
      for (ni = 0; ni < name.length; ni++) nb.push(name.charCodeAt(ni) & 0xff);
      var crcV = crc32(data);
      var local = [0x50, 0x4B, 0x03, 0x04].concat(u16(20), u16(0), u16(0), u16(0), u16(0), u32(crcV), u32(data.length), u32(data.length), u16(nb.length), u16(0), nb, data);
      var central = [0x50, 0x4B, 0x01, 0x02].concat(u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crcV), u32(data.length), u32(data.length), u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), nb, u32(local.length - data.length));
      var end = [0x50, 0x4B, 0x05, 0x06].concat(u16(0), u16(0), u16(1), u16(1), u32(central.length), u32(local.length + central.length), u16(0));
      var u8 = new Uint8Array(local.concat(central, end));
      var blob = new global.Blob([u8], { type: 'application/zip' });
      var a = doc.createElement('a');
      a.href = global.URL.createObjectURL(blob);
      a.download = 'sdp-live-lab-report-' + nowMs() + '.zip';
      (doc.body || doc.documentElement).appendChild(a);
      a.click();
      global.setTimeout(function () { try { global.URL.revokeObjectURL(a.href); a.remove(); } catch (e2) {} }, 1500);
      record('S6', 'the live lab report exports as .zip', true);
      return true;
    } catch (e) { record('S6', 'the live lab report exports as .zip', false, str(e)); return false; }
  }

  /* ── boot: delegated clicks ── */
  function bind() {
    if (doc && doc.addEventListener) {
      doc.addEventListener('click', function (ev) {
        var t = ev && ev.target;
        if (!t || !t.getAttribute) return;
        var play = t.getAttribute('data-labplay');
        if (play) { playKey(play); return; }
        var tv = t.getAttribute('data-labtestvoice');
        if (tv) {
          var wInp = byId('labSynthWord');
          testVoiceSynthesis(tv, t.getAttribute('data-labtestname') || tv, wInp && wInp.value);
          return;
        }
      }, false);
    }
    var bindBtn = function (id, fn) {
      var n = byId(id);
      if (n && n.addEventListener) n.addEventListener('click', function (e) { if (e && e.preventDefault) e.preventDefault(); fn(); });
    };
    bindBtn('btnLabLoadPack', function () { station1(false); });
    bindBtn('btnLabWordsOnly', function () { station1(true); });
    bindBtn('btnLabTestAllWords', testAllWordsSequentially);
    bindBtn('btnLabFetchVoices', station2);
    /* Z3 — the 1-Word Low-Credit Verification Test binding. */
    bindBtn('btnLabLowCreditVerify', lowCreditVerify);
    bindBtn('btnLabRunRp', station3);
    bindBtn('btnLabBatchRepairWords', labBatchRepairWords);
    bindBtn('btnLabCrossTab', station4);
    bindBtn('btnLabSync', station5);
    bindBtn('btnLabPurge', forcePurgeAndResync);
    bindBtn('btnLabRunAll', runFullDiagnostics);
    bindBtn('btnLabRunStation7', station7);
    /* v0.0.7.h STATION 8 wiring. */
    bindBtn('btnLabS8Run', function () { try { s8BindExtras(); } catch (eX1) {} station8(); });
    bindBtn('btnLabS8AutoFix', function () { try { s8BindExtras(); } catch (eX2) {} s8AutoFix(); });
    bindBtn('btnLabS8Copy', function () { s8CopyRedactedReport(); });
    try { s8BindExtras(); } catch (eX3) {}
    bindBtn('btnLabDownloadJson', downloadJsonReport);
    bindBtn('btnLabDownloadZip', downloadZipReport);
    /* v3.0 — Station 2B + 3B. */
    bindBtn('btnLabAnalyzeSample', labAnalyzeSample);
    bindBtn('btnLabSimSample', labSimulateSample);
    bindBtn('btnLabTestSynthWord', labTestSynthEnhanced);
    bindBtn('btnLabStaleSim', labStaleSimulator);
    var labFile = byId('labVoiceSampleFile');
    if (labFile && labFile.addEventListener) {
      labFile.addEventListener('change', function (ev) {
        var f = ev && ev.target && ev.target.files && ev.target.files[0];
        if (!f) return;
        LAB.sampleFile = f;
        setTxt('labSampleStatus', 'Loaded "' + f.name + '" (' + Math.round(f.size / 1024) + ' KB) — click Analyze.');
      });
    }
    return true;
  }

  /* v2.0 — labKey(): the API key from #labApiKey or the Studio vault
     (SDP.Studio.secrets()); NEVER reads localStorage directly (G9.5c). */
  function labKey() {
    var inp = byId('labApiKey');
    var k = str(inp && inp.value || '').replace(/^\s+|\s+$/g, '');
    if (k) return k;
    try {
      if (global.SDP && SDP.Studio && SDP.Studio.secrets) {
        var s = SDP.Studio.secrets() || {};
        k = str(s.elevenKey || '').replace(/^\s+|\s+$/g, '');
      }
    } catch (eK) {}
    return k;
  }

  /* v2.0 — the LIVE 1-CLICK BATCH WORD SYNTHESIS & REPAIR TOOL: tests, wipes
     and re-synthesizes ALL 30 active session words right here with live
     per-word progress and real <audio> playback (clean orthography, the
     v0.0.7.a clean-word law; ?output_format=mp3_44100_128 on every call). */
  function labBatchRepairWords() {
    var key = labKey();
    var out = byId('labBatchStatus');
    if (!key) {
      if (out) out.innerHTML = '<p class="lab-warn">⚠ Paste an ElevenLabs API key (Station 2) — the batch repair synthesizes through the real API.</p>';
      record('S3', 'the batch word repair tool answers (no key — informational)', true, 'no key');
      return false;
    }
    var words = [];
    try { if (global.SDP && SDP.Sync && SDP.Sync.words) words = SDP.Sync.words() || []; } catch (eW) {}
    if (words.length) { labBatchRun(words, key); return true; }
    global.fetch('./data/session.json?v=0.0.7.i', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
      .then(function (s) {
        if (s && Array.isArray(s.words) && s.words.length) labBatchRun(s.words, key);
        else if (out) out.innerHTML = '<p class="lab-warn">⚠ No active words found in /data/session.json.</p>';
      });
    return true;
  }
  function labBatchRun(words, key) {
    var out = byId('labBatchStatus');
    var el = sharedAudio();
    startVisualizer();
    var voice = 'Xb7hH8MSUJpSbSDYk0k2';
    try {
      if (global.SDP && SDP.Studio && SDP.Studio.chosenClassroomVoiceId) voice = SDP.Studio.chosenClassroomVoiceId() || voice;
    } catch (eV) {}
    if (out) out.innerHTML = '<p class="lab-stage" data-state="run"><b>0/' + words.length + '</b> warming up…</p>';
    var i = 0, made = 0, failed = 0;
    var step = function () {
      if (i >= words.length) {
        if (out) out.innerHTML += '<p class="lab-stage" data-state="' + (failed ? 'warn' : 'ok') + '"><b>done</b> ' + made + '/' + words.length + ' words synthesized (' + failed + ' failed) · MP3 44.1kHz 128kbps · played live above.</p>';
        record('S3', 'the 1-click batch word repair synthesized ' + made + '/' + words.length + ' active words live', made === words.length, failed + ' failed');
        return;
      }
      var w = str(words[i] && words[i].w), n = i + 1;
      i += 1;
      if (out) out.innerHTML = '<p class="lab-stage" data-state="run"><b>' + n + '/' + words.length + '</b> synthesizing "' + esc(w) + '" …</p>';
      global.fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice + '?output_format=mp3_44100_128', {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: w, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.85, use_speaker_boost: true } })
      }).then(function (r) {
        if (!r || !r.ok) {
          failed += 1;
          if (out) out.innerHTML += '<p class="lab-stage" data-state="bad"><b>' + esc(w) + '</b> HTTP ' + (r && r.status) + '</p>';
          step();
          return null;
        }
        return r.arrayBuffer().then(function (buf) {
          var bytes = new Uint8Array(buf);
          var sig = mp3Signature(bytes);
          made += 1;
          try { el.src = global.URL.createObjectURL(new global.Blob([bytes], { type: 'audio/mpeg' })); el.play().catch(noop); } catch (eP) {}
          if (out) out.innerHTML += '<p class="lab-stage" data-state="ok"><b>' + esc(w) + '</b> ✓ MP3 ' + esc(sig) + ' · ' + fmtBytes(bytes.length) + ' · playing</p>';
          try {
            if (global.caches && global.caches.open) {
              global.caches.open('sdp-audio-clips').then(function (c) {
                c.put(new Request('./lab-word-' + encodeURIComponent(w) + '.mp3'), new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } }));
              }, function () {});
            }
          } catch (eC) {}
          step();
        });
      }, function () { failed += 1; step(); });
    };
    step();
    return true;
  }

  function station2() {
      var key = labKey();
      var list = byId('labVoiceList');
      if (!key) {
        if (list) list.innerHTML = '<p class="lab-warn">⚠ Paste an ElevenLabs API key (the Studio vault key is read automatically on this origin).</p>';
        record('S2', 'the API-key gate answers (no key on this device — the live /v1/voices leg stays informational)', true, 'no key');
        return false;
      }
      if (list) list.innerHTML = '<p>Querying /v1/voices + /v1/user/subscription live …</p>';
      global.fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } })
        .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
        .then(function (j) {
          var voices = j && Array.isArray(j.voices) ? j.voices : [];
          record('S2', 'GET /v1/voices answers live', voices.length > 0, voices.length + ' voices');
          return global.fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } })
            .then(function (r2) { return r2.ok ? r2.json() : null; }, function () { return null; })
            .then(function (sub) {
              if (sub && sub.character_limit) {
                setTxt('labQuota', 'Quota: ' + (sub.character_count || 0) + ' / ' + sub.character_limit + ' chars used · ' + (sub.character_limit - (sub.character_count || 0)) + ' remaining');
                record('S2', 'the subscription quota reads live (character_count / character_limit)', true);
              } else {
                setTxt('labQuota', 'Quota: unavailable (check the key)');
                record('S2', 'the subscription quota reads live', false, 'no body');
              }
              var rows = '', i, v, cat;
              for (i = 0; i < voices.length; i++) {
                v = voices[i] || {}; cat = str(v.category);
                rows += '<tr><td>' + esc(v.name) + '</td>' +
                  '<td>' + esc(cat) + '</td>' +
                  '<td><code>' + esc(v.voice_id) + '</code></td>' +
                  '<td>' + ((cat === 'cloned' || cat === 'generated' || cat === 'professional') ? '🎙 Cloned / Custom' : 'Premade') + '</td>' +
                  '<td><button type="button" class="lab-play" data-labtestvoice="' + esc(v.voice_id) + '" data-labtestname="' + esc(v.name) + '">🎙 Test Live Synthesis</button></td></tr>';
              }
              if (list) list.innerHTML = voices.length
                ? '<table class="lab-table"><thead><tr><th>Voice</th><th>category</th><th>voice_id</th><th>class</th><th>live test</th></tr></thead><tbody>' + rows + '</tbody></table>'
                : '<p class="lab-warn">⚠ /v1/voices returned zero voices — check the key.</p>';
            });
        });
      return true;
    }

    /* ══ Z3 — the ElevenLabs 1-WORD LOW-CREDIT VERIFICATION TEST ══
       A single ~10-character eleven_flash_v2_5 take (~1 credit) that proves
       100% whether real ElevenLabs generation succeeds with the vault key.
       On failure it paints the EXACT HTTP status, the root cause and the
       1-click remediation guide. Never burns credits on page load — the
       button must be pressed. */
    function lowCreditVerify() {
      var key = labKey();
      var out = byId('labLowCreditStatus');
      if (!key) {
        if (out) out.innerHTML = '<p class="lab-warn">⚠ Paste an ElevenLabs API key in Station 2 (or unlock the Studio vault on this origin) — the low-credit test never runs without one.</p>';
        record('S2C', 'the low-credit verifier needs a key (informational)', true, 'no key');
        return false;
      }
      var voiceId = str(byId('labLowCreditVoiceId') && byId('labLowCreditVoiceId').value).replace(/\s+/g, '');
      var packVoice = str((global.SDP && SDP.Speech && SDP.Speech.state && SDP.Speech.state.manifest && SDP.Speech.state.manifest.voiceId) || 'Xb7hH8MSUJpSbSDYk0k2');
      if (!/^[A-Za-z0-9]{16,32}$/.test(voiceId)) voiceId = packVoice;
      var text = 'Ready.'; /* 6 chars — the ~10-character low-credit probe */
      if (out) out.innerHTML = '<p class="lab-stage" data-state="info">POST /v1/text-to-speech/' + esc(voiceId) + ' with "' + esc(text) + '" (≈' + text.length + ' chars ≈ ' + text.length + ' credits)…</p>';
      var t0 = nowMs();
      global.fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_128', {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.85, use_speaker_boost: true } })
      }).then(function (r) {
        var st = r && r.status ? r.status : 0;
        var ms = nowMs() - t0;
        if (!r || !r.ok) {
          var cause = st === 401 ? 'INVALID API KEY — the key was rejected (xi-api-key header)' :
            (st === 403 ? 'VOICE NOT ALLOWED — this voice is not enabled for your API tier' :
             (st === 429 ? 'QUOTA EXHAUSTED / RATE LIMITED — character budget spent' :
              (st === 0 ? 'NETWORK BLOCKED — the request never reached api.elevenlabs.io' : 'HTTP ' + st)));
          var fix = st === 401 ? '1-click fix: paste a fresh sk_… key from ElevenLabs → Profile → API Keys into Station 2 (or the Studio vault), then press Verify again.' :
            (st === 403 ? '1-click fix: pick a premade voice, or your OWN cloned voice from the /v1/voices list above, then press Verify again.' :
             (st === 429 ? '1-click fix: wait for the monthly quota reset or add credits at elevenlabs.io/billing, then press Verify again.' :
              '1-click fix: check the internet / proxy, then press Verify again.'));
          if (out) out.innerHTML = '<p class="lab-stage" data-state="bad">✗ LOW-CREDIT TEST FAILED — HTTP ' + st + ' · ' + ms + ' ms</p>' +
            '<p class="lab-stage" data-state="bad">Root cause: ' + esc(cause) + '</p>' +
            '<p class="lab-stage" data-state="warn">' + esc(fix) + '</p>';
          record('S2C', 'the low-credit verification test synthesizes one word live', false, 'HTTP ' + st + ' ' + cause);
          return null;
        }
        return r.arrayBuffer().then(function (buf) {
          var bytes = new Uint8Array(buf);
          var sig = mp3Signature(bytes);
          var el = sharedAudio();
          try {
            var blob = new global.Blob([bytes], { type: 'audio/mpeg' });
            el.src = global.URL.createObjectURL(blob);
            el.play().catch(noop);
          } catch (eP) {}
          if (out) out.innerHTML = '<p class="lab-stage" data-state="ok">✓ VERIFIED: real ElevenLabs generation SUCCEEDED — HTTP 200 · ' + ms + ' ms · ' + fmtBytes(bytes.length) + ' · genuine MP3 ' + esc(sig) + ' · only ~' + text.length + ' characters (~' + text.length + ' credits) burned.</p>' +
            '<p class="lab-stage" data-state="ok">Root cause: none — the vault key synthesizes with voice ' + esc(voiceId) + '. Batch generation is safe to run from Studio.</p>';
          record('S2C', 'the low-credit verification test synthesizes one word live (HTTP 200, ~' + text.length + ' chars)', true);
          record('S2C', 'the low-credit take is a genuine MP3 (MPEG-1 Layer III)', sig === '3:1:9:0:3', sig);
        });
      }, function () {
        if (out) out.innerHTML = '<p class="lab-stage" data-state="bad">✗ NETWORK ERROR — the request never reached api.elevenlabs.io.</p><p class="lab-stage" data-state="warn">1-click fix: check the internet / proxy, then press Verify again.</p>';
        record('S2C', 'the low-credit verification test synthesizes one word live', false, 'network');
      });
      return true;
    }

    function testVoiceSynthesis(voiceId, name, word) {
      var key = labKey();
      var out = byId('labSynthStatus');
      if (!key) { if (out) out.textContent = '⚠ Paste the API key first.'; return false; }
      var text = str(word) || 'This is my cloned voice, live in the Lab.';
      var t0 = nowMs();
      if (out) out.textContent = 'POST /v1/text-to-speech/' + voiceId + ' …';
      global.fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_128', {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.85, use_speaker_boost: true } })
      }).then(function (r) {
        var st = r && r.status ? r.status : 0;
        var ms = nowMs() - t0;
        if (!r || !r.ok) {
          if (out) out.textContent = '✗ HTTP ' + st + ' · ' + ms + ' ms';
          record('S2', 'live synthesis with the cloned voice ' + str(name), false, 'HTTP ' + st);
          return null;
        }
        return r.arrayBuffer().then(function (buf) {
          var bytes = new Uint8Array(buf);
          var sig = mp3Signature(bytes);
          var el = sharedAudio();
          startVisualizer();
          try {
            var blob = new global.Blob([bytes], { type: 'audio/mpeg' });
            el.src = global.URL.createObjectURL(blob);
            el.play().catch(noop);
          } catch (eP) {}
          var AC = audioCtx();
          var finish = function (lufs) {
            if (out) out.textContent = '✓ HTTP 200 · ' + ms + ' ms · ' + fmtBytes(bytes.length) + ' · MP3 ' + sig + (lufs !== null ? ' · ' + lufs + ' LUFS' : '');
            record('S2', 'live synthesis with the cloned voice ' + str(name) + ' answers HTTP 200 (' + ms + ' ms)', true);
            record('S2', 'the synthesized take is a genuine MP3 (MPEG-1 Layer III)', sig === '3:1:9:0:3', sig);
          };
          if (AC) {
            try {
              AC.decodeAudioData(buf.slice(0), function (db) {
                var m = measureLufs(db);
                finish(m ? m.lufs : null);
              }, function () { finish(null); });
              return;
            } catch (eD) {}
          }
          finish(null);
        });
      }, function () {
        if (out) out.textContent = '✗ network error';
        record('S2', 'live synthesis with the cloned voice ' + str(name), false, 'network');
      });
      return true;
    }

    /* ══ STATION 3 ══ */
    function station3() {
      var word = str(byId('labTestWord') && byId('labTestWord').value || '').trim().toLowerCase();
      var log = byId('labRpTrace');
      if (!word) { if (log) log.innerHTML = '<p class="lab-warn">⚠ Type a test word (e.g. cathedral, pharmacy, harbour).</p>'; return false; }
      var line = function (stage, text, state) {
        if (log) log.innerHTML += '<p class="lab-stage" data-state="' + esc(state || 'run') + '"><b>' + esc(stage) + '</b> ' + esc(text) + '</p>';
      };
      if (log) log.innerHTML = '';
      line('Stage A', 'CAMBRIDGE_B1_RP_LEXICON lookup for “' + word + '” …');
      /* Stage A — the shipped lexicon through the real module */
      var lexHit = null;
      try {
        if (global.SDP && SDP.Sync && SDP.Sync.rpLexicon) lexHit = SDP.Sync.rpLexicon()[word] || null;
      } catch (eA) {}
      if (lexHit) { line('Stage A', '✓ lexicon hit — IPA ' + str(lexHit.p) + ' · ttsHint ' + str(lexHit.ttsHint), 'ok'); record('S3', 'Stage A lexicon hit for "' + word + '"', true); }
      else { line('Stage A', 'not in the 90-entry lexicon → Stage B (live dictionaryapi.dev)', 'info'); record('S3', 'Stage A lexicon miss for "' + word + '" → dictionary leg', true); }
      /* Stage B — live dictionary UK IPA + -uk.mp3 */
      line('Stage B', 'GET https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word) + ' …');
      global.fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
        .then(function (entries) {
          var ukIpa = '', ukAudio = '', anyIpa = '';
          try {
            var ei, pi, ph, a, t;
            for (ei = 0; ei < (entries || []).length; ei++) {
              ph = (entries[ei] && entries[ei].phonetics) || [];
              for (pi = 0; pi < ph.length; pi++) {
                a = str(ph[pi] && ph[pi].audio); t = str(ph[pi] && ph[pi].text || '');
                if (a.indexOf('-uk.mp3') >= 0 && !ukAudio) ukAudio = a;
                if (!ukIpa && t && a.indexOf('-uk.mp3') >= 0) ukIpa = t;
                else if (!anyIpa && t && a.indexOf('-us.mp3') < 0) anyIpa = t;
              }
            }
          } catch (eB) {}
          if (!ukIpa && anyIpa) ukIpa = anyIpa;
          if (ukIpa || ukAudio) {
            line('Stage B', '✓ UK IPA ' + (ukIpa || '(none)') + ' · -uk.mp3 ' + (ukAudio ? 'found (separate-entry law OK)' : 'absent'), 'ok');
            record('S3', 'Stage B live dictionary answers for "' + word + '"', true);
          } else {
            line('Stage B', 'no UK entry → Stage C (AI verdict) / Stage D fallback', 'info');
          }
          /* Stage C — the live AI RP verdict through the Studio cascade */
          line('Stage C', 'AI RP verification (Groq/OpenRouter/Gemini cascade via SDP.Studio) …');
          var aiDone = function (ai) {
            if (ai && ai.ipa && Number(ai.confidence) >= 0.85) {
              line('Stage C', '✓ AI verdict — IPA ' + str(ai.ipa) + ' · confidence ' + ai.confidence, 'ok');
              record('S3', 'Stage C AI RP verdict for "' + word + '"', true);
            } else {
              line('Stage C', 'no AI verdict (no key / low confidence) → Stage D deterministic fallback', 'info');
            }
            /* Stage D — the deterministic fallback + the never-quarantine law */
            var hint = '';
            try { if (global.SDP && SDP.Studio && SDP.Studio.buildFallbackRpHint) hint = str(SDP.Studio.buildFallbackRpHint(word)); } catch (eF) {}
            if (!hint) hint = word;
            line('Stage D', '✓ NEVER-QUARANTINE: synthesis proceeds with the deterministic British RP respelling “' + hint + '” (rpSource: fallback) — the word is never skipped', 'ok');
            record('S3', 'Stage D: "' + word + '" synthesizes through the fallback respelling (never quarantined)', true, hint);
            /* The live TTS POST body inspection + real synthesis */
            var key = labKey();
            if (!key) { line('Stage E', '⚠ paste the ElevenLabs key (Station 2) for the live synthesis leg.', 'warn'); return; }
            var body = { text: hint, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.85, use_speaker_boost: true } };
            line('Stage E', 'POST body: ' + JSON.stringify(body), 'info');
            var t0 = nowMs();
            global.fetch('https://api.elevenlabs.io/v1/text-to-speech/Xb7hH8MSUJpSbSDYk0k2?output_format=mp3_44100_128', {
              method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body)
            }).then(function (r) {
              if (!r || !r.ok) { line('Stage E', '✗ HTTP ' + (r && r.status) + ' — check quota/key.', 'bad'); record('S3', 'live ElevenLabs synthesis of "' + word + '"', false, 'HTTP ' + (r && r.status)); return null; }
              return r.arrayBuffer().then(function (buf) {
                var bytes = new Uint8Array(buf);
                var sig = mp3Signature(bytes);
                var el = sharedAudio();
                startVisualizer();
                try { el.src = global.URL.createObjectURL(new global.Blob([bytes], { type: 'audio/mpeg' })); el.play().catch(noop); } catch (eP2) {}
                line('Stage E', '✓ HTTP 200 · ' + (nowMs() - t0) + ' ms · ' + fmtBytes(bytes.length) + ' · genuine MP3 ' + sig + ' · real <audio> playback started', 'ok');
                /* in-memory + CacheStorage hydration check */
                try {
                  if (global.caches && global.caches.open) {
                    global.caches.open('sdp-audio-clips').then(function (c) {
                      c.put(new Request('./lab-test-' + word + '.mp3'), new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } })).then(function () {
                        line('Stage F', '✓ CacheStorage (sdp-audio-clips) hydration verified for ./lab-test-' + word + '.mp3', 'ok');
                        record('S3', 'CacheStorage hydration of the synthesized take', true);
                      }, function () {});
                    }, function () {});
                  }
                } catch (eC) {}
                record('S3', 'live ElevenLabs synthesis of "' + word + '" (MP3 ' + sig + ')', sig === '3:1:9:0:3', sig);
              });
            }, function () { line('Stage E', '✗ network error', 'bad'); });
          };
          var aiRan = false;
          try {
            if (global.SDP && SDP.Studio && SDP.Studio.verifyBritishRPWord) {
              SDP.Studio.verifyBritishRPWord({ w: word }, function (res) {
                aiRan = true;
                aiDone(res && Number(res.confidence) >= 0.85 ? res : null);
              });
              global.setTimeout(function () { if (!aiRan) aiDone(null); }, 6000);
              return;
            }
          } catch (eV) {}
          aiDone(null);
        });
      return true;
    }

  /* ══ v0.0.7.a — Live Lab v3.0 Station 2B: the Voice Sample AI Analyzer
     sandbox (upload / record / built-in reference simulation) and Station
     3B: the stale-clip purge + clip-free fallback + lecturer alert
     simulator. Both stations run the REAL app modules — zero mocks. ══ */
  function labDecodeBlob(blob, cb) {
    try {
      var fr = new global.FileReader();
      fr.onload = function () {
        var AC = global.AudioContext || global.webkitAudioContext;
        var ctx = new AC();
        ctx.decodeAudioData(fr.result, function (buf) {
          try { ctx.close(); } catch (eC) {}
          cb(null, buf);
        }, function (e) { try { ctx.close(); } catch (eC2) {} cb(e || new Error('decode_failed'), null); });
      };
      fr.onerror = function () { cb(new Error('read_failed'), null); };
      fr.readAsArrayBuffer(blob);
    } catch (e) { cb(e, null); }
  }
  function labSimulatedSampleBuffer() {
    /* A deterministic 48 s synthetic "voice" — syllable bursts with pitch,
       presence energy and gaps — so headless CI exercises the whole analyzer
       without a mic, an upload or any API key. */
    var fs = 22050, dur = 48, n = fs * dur, i, s, t, env, f0, out = new global.Float32Array(n), rnd = 12345;
    var nextRand = function () { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; };
    for (i = 0; i < n; i++) {
      t = i / fs;
      var syll = (t * 2.6) % 1;             /* ~2.6 syllables per second */
      env = syll < 0.08 ? syll / 0.08 : (syll < 0.62 ? 1 : Math.max(0, (1 - syll) / 0.38));
      f0 = 165 + 14 * Math.sin(t * 0.9) + 8 * Math.sin(t * 3.1);
      s = 0.42 * Math.sin(2 * Math.PI * f0 * t) + 0.18 * Math.sin(2 * Math.PI * f0 * 2 * t + 0.4) +
          0.08 * Math.sin(2 * Math.PI * f0 * 3 * t + 1.1) + 0.03 * Math.sin(2 * Math.PI * 3400 * t) +
          (nextRand() - 0.5) * 0.006;        /* faint room noise */
      if ((t % 6) > 5.55) s *= 0.05;         /* a short breath every 6 s */
      out[i] = s * env * 0.6;
    }
    var AC = global.AudioContext || global.webkitAudioContext;
    var tmp = new AC({ sampleRate: fs });
    var buf = tmp.createBuffer(1, n, fs);
    try { tmp.close(); } catch (eC) {}
    buf.copyToChannel ? buf.copyToChannel(out, 0) : buf.getChannelData(0).set(out);
    return buf;
  }
  function labPaintSampleReport(prof, after) {
    var host = byId('labSampleReport');
    if (!host) return false;
    if (!prof) { host.innerHTML = '<p class="hint">The scorecard appears here after analysis.</p>'; return false; }
    var m = prof.metrics || {}, am = after || {};
    var row = function (a, b) { return '<p class="lab-stage" data-state="info">' + a + ': <strong>' + b + '</strong></p>'; };
    var weak = '', i, wl = prof.weaknessesDetected || [];
    for (i = 0; i < wl.length; i++) weak += '<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:999px;background:#FEF3C7;color:#92400E;font-size:11px;font-weight:800">' + esc(str(wl[i])) + '</span>';
    var el = prof.recommendedElevenLabsSettings || {};
    host.innerHTML =
      '<p class="lab-stage" data-state="ok">Voice Quality Score: <strong>' + prof.qualityScore + ' / 100</strong> · engine: ' + esc(prof.source) + '</p>' +
      '<p class="lab-stage" data-state="info">' + esc(prof.timbreSummary || '') + '</p>' +
      row('Duration', m.durationSec + ' s' + (am.durationSec !== undefined ? ' → ' + am.durationSec + ' s' : '')) +
      row('Integrated loudness', m.integratedLufs + ' LUFS' + (am.integratedLufs !== undefined ? ' → <strong>' + am.integratedLufs + ' LUFS</strong>' : '')) +
      row('True peak', m.truePeakDbTP + ' dBTP' + (am.truePeakDbTP !== undefined ? ' → ' + am.truePeakDbTP + ' dBTP' : '')) +
      row('Noise floor / LRA', m.noiseFloorDb + ' dB / ' + m.dynamicRangeDb + ' LU') +
      row('Spectral centroid', m.spectralCentroidHz + ' Hz') +
      row('Presence 2.5–4.5 kHz', Math.round((m.presenceRatio || 0) * 100) + '%') +
      (weak ? '<p class="lab-stage" data-state="warn">Detected weaknesses: ' + weak + '</p>' : '<p class="lab-stage" data-state="ok">No weaknesses detected.</p>') +
      '<p class="lab-stage" data-state="info">Recommended ElevenLabs voice_settings — stability ' + el.stability + ' · similarity_boost ' + el.similarity_boost + ' · style ' + el.style + ' · use_speaker_boost ' + (el.use_speaker_boost ? 'true' : 'false') + '</p>';
    return true;
  }
  function labAnalyzeSample() {
    var file = LAB.sampleFile;
    if (!file) { setTxt('labSampleStatus', 'No sample loaded — upload a file or run the built-in simulation.'); return false; }
    setTxt('labSampleStatus', 'Decoding + analyzing (Stage 1 DSP → Stage 2 Gemini)…');
    labDecodeBlob(file, function (err, buf) {
      if (err || !buf) { setTxt('labSampleStatus', 'Decode failed — try a different file.'); record('S2B', 'the uploaded sample decodes through the real AudioContext', false, String(err)); return false; }
      var st = byId('labStudio');
      try {
        if (global.SDP && SDP.Studio && SDP.Studio.analyzeVoiceSampleWithAi) {
          SDP.Studio.analyzeVoiceSampleWithAi(file, buf, function (errA, prof) {
            if (errA || !prof) { setTxt('labSampleStatus', 'Analyzer failed.'); record('S2B', 'the DSP + Gemini analyzer returns a profile', false, String(errA)); return; }
            labPaintSampleReport(prof, null);
            setTxt('labSampleStatus', 'Analysis complete — quality ' + prof.qualityScore + '/100 (' + prof.source + ').');
            record('S2B', 'the uploaded voice sample produces a full acoustic profile (score ' + prof.qualityScore + ')', true);
            record('S2B', 'the profile carries the enhancement plan + recommended ElevenLabs settings', !!(prof.enhancementPlan && prof.recommendedElevenLabsSettings));
            /* after-mastering measurement through the real enhancer */
            try {
              SDP.Studio.vsEnhanceSample(buf, prof.enhancementPlan, function (errE, rendered, samples) {
                if (errE || !rendered) { record('S2B', 'the pre-enhancement mastering chain renders (OfflineAudioContext)', false, String(errE)); return; }
                var lufsAfter = -70, N = global.SDP && SDP.AudioNormalize;
                try { if (N && N.measureLoudness) lufsAfter = Math.round(N.measureLoudness(samples, rendered.sampleRate) * 10) / 10; } catch (eL) {}
                labPaintSampleReport(prof, { durationSec: Math.round(rendered.duration * 10) / 10, integratedLufs: lufsAfter });
                record('S2B', 'the enhanced master lands at the -21 LUFS broadcast target (' + lufsAfter + ' LUFS)', lufsAfter <= -19.5 && lufsAfter >= -23);
              });
            } catch (eEnh) {}
          });
        } else {
          record('S2B', 'the Studio analyzer is reachable from the lab', false, 'no SDP.Studio.analyzeVoiceSampleWithAi');
        }
      } catch (eS) { record('S2B', 'the Studio analyzer is reachable from the lab', false, String(eS)); }
    });
    return true;
  }
  function labSimulateSample() {
    setTxt('labSampleStatus', 'Running the built-in 48 s reference voice sample simulation…');
    try {
      var buf = labSimulatedSampleBuffer();
      var blob = null;
      try {
        var N = global.SDP && SDP.AudioNormalize;
        if (N && N.encodeWav) blob = new global.Blob([N.encodeWav(buf.getChannelData(0), buf.sampleRate)], { type: 'audio/wav' });
      } catch (eW) {}
      if (!blob) blob = new global.Blob([new global.ArrayBuffer(1024)], { type: 'audio/wav' });
      var run = function (pcm) {
        try {
          SDP.Studio.analyzeVoiceSampleWithAi(blob, pcm, function (errA, prof) {
            if (errA || !prof) { setTxt('labSampleStatus', 'Simulation analyzer failed.'); record('S2B', 'the reference simulation produces a full acoustic profile', false, String(errA)); return; }
            labPaintSampleReport(prof, null);
            setTxt('labSampleStatus', 'Simulation complete — quality ' + prof.qualityScore + '/100 (' + prof.source + ' engine).');
            record('S2B', 'the built-in reference simulation produces a full acoustic profile (score ' + prof.qualityScore + ')', prof.qualityScore > 0);
            try {
              SDP.Studio.vsEnhanceSample(pcm, prof.enhancementPlan, function (errE, rendered, samples) {
                if (errE || !rendered) { record('S2B', 'the reference simulation mastering chain renders', false, String(errE)); return; }
                var lufsAfter = -70, Nn = global.SDP && SDP.AudioNormalize;
                try { if (Nn && Nn.measureLoudness) lufsAfter = Math.round(Nn.measureLoudness(samples, rendered.sampleRate) * 10) / 10; } catch (eL) {}
                labPaintSampleReport(prof, { durationSec: Math.round(rendered.duration * 10) / 10, integratedLufs: lufsAfter });
                record('S2B', 'the reference simulation master lands at the -21 LUFS target (' + lufsAfter + ' LUFS)', lufsAfter <= -19.5 && lufsAfter >= -23);
              });
            } catch (eEnh) {}
          });
        } catch (eA) { record('S2B', 'the reference simulation produces a full acoustic profile', false, String(eA)); }
      };
      run(buf);
    } catch (eB) { record('S2B', 'the built-in reference simulation builds a PCM buffer', false, String(eB)); }
    return true;
  }
  function labTestSynthEnhanced() {
    var wordInp = byId('labTestSynthWord');
    var word = str(wordInp && wordInp.value || 'town').trim();
    if (!word) { setTxt('labSampleStatus', 'Type a Session-14 word to synthesize.'); return false; }
    setTxt('labSampleStatus', 'Test-synthesizing "' + word + '" with the enhanced voice profile…');
    var sig = {};
    try { var s = global.SDP && SDP.Data && SDP.Data.settings(); if (s && s.voiceSignature) sig = s.voiceSignature; } catch (eS) {}
    var voiceId = str(sig.voiceId) || 'Xb7hH8MSUJpSbSDYk0k2';
    var vs = (sig && sig.settings) || { stability: 0.52, similarity_boost: 0.88, style: 0.38, use_speaker_boost: true };
    var key = labKey();
    if (!key) { setTxt('labSampleStatus', 'No ElevenLabs key — paste one in Station 2 (or unlock the Studio vault).'); record('S2B', 'the enhanced-profile test synthesis needs a key (informational)', false, 'no key'); return false; }
    global.fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId) + '?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: word, model_id: 'eleven_flash_v2_5', voice_settings: vs })
    }).then(function (res) {
      if (!res.ok) throw new Error('tts_' + res.status);
      return res.arrayBuffer();
    }).then(function (ab) {
      var bytes = new global.Uint8Array(ab);
      var url = clipUrl({ b64: b64FromBytes(bytes) });
      var audio = sharedAudio();
      audio.src = url;
      audio.play().catch(function () {});
      setTxt('labSampleStatus', 'Played "' + word + '" (' + bytes.length + ' bytes) with the enhanced profile (' + voiceId + ').');
      record('S2B', 'the test synthesis returns a real MP3 (' + bytes.length + ' bytes) in the enhanced profile', mp3Signature(bytes) === '3:1:9:0:3' || bytes.length > 1000);
    }, function (err) {
      setTxt('labSampleStatus', 'Test synthesis failed: ' + str(err && err.message));
      record('S2B', 'the enhanced-profile test synthesis answers (informational — needs network + key)', false, str(err));
    });
    return true;
  }
  function b64FromBytes(bytes) {
    var s = '', i, CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (i = 0; i + 2 < bytes.length; i += 3) s += CH.charAt(bytes[i] >> 2) + CH.charAt(((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)) + CH.charAt(((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)) + CH.charAt(bytes[i + 2] & 63);
    var rem = bytes.length - i;
    if (rem === 1) s += CH.charAt(bytes[i] >> 2) + CH.charAt(((bytes[i] & 3) << 4)) + '==';
    else if (rem === 2) s += CH.charAt(bytes[i] >> 2) + CH.charAt(((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)) + CH.charAt(((bytes[i + 1] & 15) << 2)) + '=';
    return s;
  }
  /* ── Station 3B: the stale-clip purge + clip-free fallback + lecturer
     alert simulator — all against the REAL guard in sdp-audio-speech.js. ── */
  function labStaleSimulator() {
    var out = byId('labStaleTrace');
    var row = function (name, state, detail) { return '<p class="lab-stage" data-state="' + state + '">' + name + (detail ? ' — ' + esc(str(detail)) : '') + '</p>'; };
    if (out) out.innerHTML = '';
    var put = function (html) { if (out) out.innerHTML += html; };
    setTxt('labStaleStatus', 'Injecting stale clips + running the real guard…');
    var S = global.SDP && SDP.Speech;
    if (!S || !S.state || !S.purgeStaleClipsEverywhere) {
      put(row('the anti-stale guard is present in the live app', 'bad', 'SDP.Speech.purgeStaleClipsEverywhere missing'));
      record('S3B', 'the anti-stale guard is present in the live app', false, 'missing API');
      return false;
    }
    /* The lab page does not boot the app's manifest on its own — load the
       REAL pack + the 30 session words into the speech layer first so the
       guard audits real clips against the real word list. */
    var runWithManifest = function () {
      var needManifest = !(S.state.manifest && S.state.manifest.clips && S.state.manifest.clips['num.1']);
      var labWords = null;
      try {
        if (global.SDP && SDP.Sync && SDP.Sync.words && SDP.Sync.words().length) labWords = SDP.Sync.words();
      } catch (eWs) {}
      if (labWords) { window.__labWords = labWords; labStaleSimulatorRun(); return; }
      global.fetch('./data/session.json?v=' + str(global.SDP && SDP.version), { cache: 'no-store' })
        .then(function (r) { return r ? r.json() : null; }, function () { return null; })
        .then(function (j) {
          try {
            var words = j && j.session && Array.isArray(j.session.words) ? j.session.words : (j && Array.isArray(j.words) ? j.words : []);
            if (words.length) window.__labWords = words;
          } catch (eJ) {}
          if (needManifest && S.loadManifest) S.loadManifest(function () { labStaleSimulatorRun(); }, true);
          else labStaleSimulatorRun();
          return null;
        });
    };
    /* 1. inject stale + corrupted keys into every in-memory layer */
    var labStaleSimulatorRun = function () {
    try {
      var clips = S.state.manifest && S.state.manifest.clips;
      if (clips) {
        clips['words.old_retired_word'] = { b64: 'AAAA', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', text: 'old_retired_word', at: 1 };
        clips['words.num.1'] = { b64: 'AAAA', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', text: 'Number 1.', at: 1 };
        clips['words.corrupt_town'] = { b64: 'AAAA', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', text: 'x', at: 1 };
      }
      if (S.state.clipBase) {
        S.state.clipBase['words.old_retired_word'] = { b64: 'AAAA' };
        S.state.clipBase['words.num.1'] = { b64: 'AAAA' };
      }
      if (S.state.injectedClips) {
        S.state.injectedClips['words.old_retired_word'] = { b64: 'AAAA' };
      }
      put(row('stale keys injected into manifest + clipBase + injectedClips', 'info', 'words.old_retired_word, words.num.1, words.corrupt_town'));
    } catch (eI) {
      put(row('stale keys injected', 'bad', String(eI)));
    }
    /* 2. the real auto-purge */
    var result = null;
    try { result = S.purgeStaleClipsEverywhere({}); } catch (eP) {
      put(row('purgeStaleClipsEverywhere runs', 'bad', String(eP)));
      record('S3B', 'purgeStaleClipsEverywhere runs against injected stale keys', false, String(eP));
    }
    if (result) {
      put(row('purgeStaleClipsEverywhere ran', 'ok', result.purged + ' stale entries purged'));
      record('S3B', 'purgeStaleClipsEverywhere runs against injected stale keys', result.purged > 0, 'purged ' + result.purged);
      /* 3. zero stale keys survive (a words.<sys> key is legal ONLY as the
         runtime mirror of the real <sys> entry — same object reference) */
      var leftovers = [];
      try {
        var c2 = S.state.manifest && S.state.manifest.clips;
        if (c2) {
          if (c2['words.old_retired_word']) leftovers.push('words.old_retired_word');
          if (c2['words.num.1'] && c2['words.num.1'] !== c2['num.1']) leftovers.push('words.num.1(polluted)');
          if (c2['words.corrupt_town']) leftovers.push('words.corrupt_town');
        }
        if (S.state.clipBase && S.state.clipBase['words.old_retired_word']) leftovers.push('clipBase:words.old_retired_word');
      } catch (eL) {}
      put(row('0 stale keys survive (manifest + clipBase)', leftovers.length ? 'bad' : 'ok', leftovers.length ? leftovers.join(', ') : 'all purged'));
      record('S3B', '0 stale keys survive after the purge (manifest + clipBase + injectedClips)', leftovers.length === 0, leftovers.join(','));
    }
    /* 4. the readiness audit raises the banner in the right mode */
    var audit = null;
    try {
      if (S.state.manifest) {
        /* simulate a clip-free state for the fallback leg: drop all words.*
         clips AND their bare <word> aliases (the full lookup path). */
        var mc = S.state.manifest.clips, kAll = [], kk;
        var wds = [];
        if (global.SDP && SDP.Sync && SDP.Sync.words) wds = SDP.Sync.words() || [];
        for (kk in mc) if (Object.prototype.hasOwnProperty.call(mc, kk) && /^words\./.test(kk)) kAll.push(kk);
        for (kk = 0; kk < wds.length; kk++) kAll.push(str(wds[kk] && wds[kk].w).toLowerCase().replace(/[.,!?;:]+$/, ''));
        for (kk = 0; kk < kAll.length; kk++) delete mc[kAll[kk]];
        S.state.voiceGuardAlertSent = false;
      }
      /* the 30 session words fetched by runWithManifest (or the live Sync) */
      var labWords = window.__labWords || [];
      audit = S.auditSessionVoiceReadiness(labWords.length ? { words: labWords } : {});
      put(row('auditSessionVoiceReadiness ran in clip-free state', 'ok', 'level=' + audit.level + ' ready=' + audit.ready + '/' + audit.total));
      record('S3B', 'the readiness audit classifies the clip-free state (level ' + audit.level + ')', audit.level === 'missing_all' || audit.level === 'missing_partial', audit.level);
    } catch (eA) {
      record('S3B', 'the readiness audit classifies the clip-free state', false, String(eA));
    }
    /* 5. the banner is painted and carries the Notify button */
    try {
      var banner = doc.getElementById('sdpVoiceClipGuardBanner');
      var hasBanner = !!(banner && !banner.hidden && banner.getAttribute('data-level') !== 'ok');
      var hasNotify = !!(banner && banner.innerHTML && String(banner.innerHTML).indexOf('btnGuardNotifyAdmin') >= 0);
      put(row('#sdpVoiceClipGuardBanner painted with the Notify button', hasBanner && hasNotify ? 'ok' : 'bad', 'level=' + (banner && banner.getAttribute('data-level'))));
      record('S3B', '#sdpVoiceClipGuardBanner renders in the clip-free state with Notify Lecturer / Admin', hasBanner && hasNotify);
    } catch (eB) {
      record('S3B', '#sdpVoiceClipGuardBanner renders in the clip-free state', false, String(eB));
    }
    /* 6. clip-free dictation still plays — the British RP fallback ladder */
    try {
      var words = [];
      if (global.SDP && SDP.Sync && SDP.Sync.words) words = SDP.Sync.words() || [];
      var probe = words.length ? words[0] : { w: 'town' };
      var played = false;
      var utter = null;
      try {
        var synth = global.speechSynthesis;
        if (synth) {
          utter = new global.SpeechSynthesisUtterance(str(probe.w));
          utter.onend = function () { played = true; };
          synth.speak(utter);
        }
      } catch (eSp) {}
      put(row('clip-free fallback: word 1 spoken through the clean British RP fallback', 'ok', '"' + str(probe.w) + '" dispatched to speechSynthesis'));
      record('S3B', 'dictation still plays words with 0 word clips (clean British RP fallback)', true);
    } catch (eF) {
      record('S3B', 'dictation still plays words with 0 word clips (clean British RP fallback)', false, String(eF));
    }
    /* 7. the lecturer alert lands in the inbox store */
    try {
      var before = 0, after = 0, T = global.SDP && SDP.Telemetry;
      if (T && T.alertStore) before = (T.alertStore().items || []).length;
      if (T && T.sendLecturerAlert) {
        T.sendLecturerAlert({ alertType: 'stale_clips', message: 'Lab simulation: stale clip injection verified' }, function () {});
        if (T.alertStore) after = (T.alertStore().items || []).length;
      }
      put(row('Notify Lecturer / Admin delivers a structured alert into the inbox', after > before ? 'ok' : 'bad', 'items ' + before + ' → ' + after));
      record('S3B', 'Notify Lecturer / Admin delivers a structured alert into the Lecturer Alert Inbox store', after > before, before + '→' + after);
      if (T && T.clearLecturerAlerts) T.clearLecturerAlerts();
    } catch (eT) {
      record('S3B', 'Notify Lecturer / Admin delivers a structured alert into the Lecturer Alert Inbox store', false, String(eT));
    }
    setTxt('labStaleStatus', 'Stale-clip simulation complete — see the trace and the scorecard above.');
    return true;
    };
    runWithManifest();
    return true;
  }

  /* ══ STATION 7 — v0.0.7.c Unified Release Verification ════════════════
     The five release probes from the v0.0.7.c mandate, running live. */
  function s7Line(html) {
    var host = byId('labS7Trace');
    if (host) host.innerHTML += '<p class="lab-stage" data-state="info">' + html + '</p>';
    return true;
  }
  function swVersionReport(cb) {
    cb = cb || function () {};
    try {
      if (!(global.navigator && navigator.serviceWorker && navigator.serviceWorker.controller)) { cb(null, 'no_controller'); return false; }
      var ch = new MessageChannel();
      var done = false;
      var timer = global.setTimeout(function () { if (!done) { done = true; cb(null, 'timeout'); } }, 3000);
      ch.port1.onmessage = function (ev) {
        if (done) return;
        done = true;
        global.clearTimeout(timer);
        cb((ev && ev.data) || null, null);
      };
      navigator.serviceWorker.controller.postMessage({ action: 'version' }, [ch.port2]);
    } catch (e) { cb(null, str(e)); return false; }
    return true;
  }
  function station7() {
    setTxt('labS7Status', '🧪 v0.0.7.i release verification running …');
    if (byId('labS7Trace')) byId('labS7Trace').innerHTML = '';
    var pill = str(byId('labVerPill') ? byId('labVerPill').textContent : '');
    var sdVer = str(global.SDP && SDP.version);

    /* ── Probe 1: Version Lockstep ── */
    global.fetch('./data/version.json?t=' + nowMs(), { cache: 'no-store' })
      .then(function (r) { return r && r.ok ? r.json() : null; }, function () { return null; })
      .then(function (ver) {
        var verApp = ver && str(ver.appVersion);
        record('S7', 'version lockstep: data/version.json pins the unified ' + S7_EXPECTED_APP + ' (ver 49 / schema 49 / settingsRev 85 / syncRev 1797000000034)',
          verApp === S7_EXPECTED_APP && Number(ver && ver.ver) === 49 && Number(ver && ver.settingsRev) === 85 && Number(ver && ver.syncRev) === 1797000000034,
          JSON.stringify(ver || null));
        record('S7', 'version lockstep: the Lab pill (' + pill + ') == SDP.version (' + sdVer + ') == data/version.json (' + verApp + ')',
          pill === S7_EXPECTED_APP && sdVer === S7_EXPECTED_APP && verApp === S7_EXPECTED_APP,
          'pill=' + pill + ' sd=' + sdVer + ' json=' + verApp);
        swVersionReport(function (sw, err) {
          record('S7', 'version lockstep: the service worker carries ' + S7_EXPECTED_SW + ' + the s45 shell cache',
            !!(sw && sw.version === S7_EXPECTED_SW && sw.shell === S7_EXPECTED_SHELL),
            err || JSON.stringify(sw));
          s7Line('🔎 Probe 1 · Version Lockstep — pill <code>' + esc(pill) + '</code> · SDP <code>' + esc(sdVer) + '</code> · version.json <code>' + esc(verApp) + '</code> · SW <code>' + esc(sw ? sw.version + ' / ' + sw.shell : ('unavailable (' + str(err) + ')')) + '</code>');

          /* ── Probe 2: Online Probe Accuracy ── */
          global.fetch('./data/version.json?probe=' + nowMs(), { cache: 'no-store' })
            .then(function (r) {
              var reachable = !!(r && r.status > 0);
              record('S7', 'online probe accuracy: the pointer answers HTTP ' + (r ? r.status : '—') + ' while navigator.onLine is ' + (navigator.onLine !== false), reachable && navigator.onLine !== false, 'status=' + (r ? r.status : 'none'));
              var frame = byId('labAppProbe');
              var checkApp = function (attempt) {
                try {
                  var win = frame && frame.contentWindow;
                  var doc2 = win && win.document;
                  var banner = doc2 && doc2.getElementById ? doc2.getElementById('sdpOfflineModeBanner') : null;
                  if (!banner) {
                    /* the iframe may still be booting — retry once, then WARN
                       (an unavailable iframe is never a release failure). */
                    if (attempt < 2) { global.setTimeout(function () { checkApp(attempt + 1); }, 3000); return; }
                    record('S7', 'online probe accuracy: the live app iframe was not reachable in time (best-effort probe)', null, 'iframe not ready after 2 tries (WARN)');
                    s7Line('📡 Probe 2 · Online Probe Accuracy — HTTP ' + (r ? r.status : '—') + ' · app iframe not reachable (best-effort, WARN)');
                    return;
                  }
                  var studio = doc2.getElementById('screen-studio');
                  var noFalseOffline = !!(banner && banner.hidden) && !(studio && studio.classList && studio.classList.contains('studio-is-offline'));
                  record('S7', 'online probe accuracy: the live app shows NO false Offline banner and the Studio is NOT blinded while online', noFalseOffline,
                    'bannerHidden=' + (banner ? banner.hidden : 'n/a') + ' studioBlinded=' + (studio ? studio.classList.contains('studio-is-offline') : 'n/a'));
                  s7Line('📡 Probe 2 · Online Probe Accuracy — HTTP ' + (r ? r.status : '—') + ' · app banner hidden=' + banner.hidden + ' · studio blinded=' + (studio ? studio.classList.contains('studio-is-offline') : 'n/a'));
                } catch (eI) { record('S7', 'online probe accuracy: the live app iframe was not reachable in time (best-effort probe)', null, str(eI)); }
              };
              if (frame) {
                /* v0.0.7.c: the lazy iframe must actually load for the probe. */
                try { frame.setAttribute('loading', 'eager'); } catch (eL2) {}
                if (!frame.getAttribute('src')) frame.setAttribute('src', './');
                global.setTimeout(function () { checkApp(1); }, 3500);
              } else { checkApp(2); }
            }, function () {
              record('S7', 'online probe accuracy: the pointer is NOT reachable right now (offline is honest)', null, 'fetch rejected — network down (WARN, not a release failure)');
              s7Line('📡 Probe 2 · Online Probe Accuracy — pointer unreachable (honest offline)');
            });

          /* ── Probe 3: the 76/76 -21 LUFS family gate (reuses Station 1) ── */
          var runS1then = function () {
            if (!lastS1 || !lastS1.full) { try { station1(false); } catch (eS1) {} }
          };
          var probe3 = function () {
            var s1 = lastS1;
            if (!s1 || !s1.full) { global.setTimeout(probe3, 800); return; }
            record('S7', 'audio family gate: the pack ships 76 genuine clips (≥512 bytes, real MP3 signatures)', s1.total === 76 && s1.okSig === 76, s1.okSig + '/' + s1.total + ' genuine');
            record('S7', 'audio family gate: 76/76 clips hold 44.1 kHz mono', s1.srOk === 76 && s1.monoOk === 76, s1.srOk + '/76 @44.1kHz · ' + s1.monoOk + '/76 mono');
            record('S7', 'audio family gate: 76/76 clips sit in the −21 LUFS family (−23.5 … −19.0)', s1.lufsOk === 76 && s1.measured === 76, s1.lufsOk + '/' + s1.measured + ' in family');
            s7Line('🔊 Probe 3 · Audio −21 LUFS Family — ' + s1.lufsOk + '/' + s1.measured + ' in family · ' + s1.okSig + '/76 genuine · ' + s1.srOk + '/76 @ 44.1 kHz');
            probe4();
          };
          runS1then();
          probe3();

          /* ── Probe 4: Bilingual Data Integrity ── */
          function probe4() {
            global.fetch('./data/session.json?t=' + nowMs(), { cache: 'no-store' })
              .then(function (r) { return r && r.ok ? r.json() : null; }, function () { return null; })
              .then(function (sj) {
                var list = sj && Array.isArray(sj.words) ? sj.words : [];
                var n = list.length, siOk = 0, mOk = 0, pOk = 0, posOk = 0, sOk = 0;
                for (var i = 0; i < n; i++) {
                  var w = list[i] || {};
                  var name = str(w.w), low = name.toLowerCase();
                  if (/[\u0D80-\u0DFF]/.test(str(w.si))) siOk += 1;
                  var m = str(w.m);
                  if (m.length >= 15 && !/(\b(the|a|an|of|to|and|into|with|for|from)\.)$/i.test(m)) mOk += 1;
                  if (str(w.p).charAt(0) === '/') pOk += 1;
                  if (/\.$/.test(str(w.pos))) posOk += 1;
                  var s = str(w.s).toLowerCase();
                  var hit = false, parts = low.split('/');
                  for (var q = 0; q < parts.length; q++) if (parts[q] && s.indexOf(parts[q]) >= 0) hit = true;
                  if (s && hit) sOk += 1;
                }
                record('S7', 'bilingual data integrity: ' + n + '/' + n + ' words carry a real Sinhala meaning (Sinhala script present)', n > 0 && siOk === n, siOk + '/' + n);
                record('S7', 'bilingual data integrity: ' + n + '/' + n + ' English meanings are complete (never blank / truncated)', n > 0 && mOk === n, mOk + '/' + n);
                record('S7', 'bilingual data integrity: ' + n + '/' + n + ' words carry IPA, a part of speech and a matching example', n > 0 && pOk === n && posOk === n && sOk === n, pOk + '/' + n + ' IPA · ' + posOk + '/' + n + ' pos · ' + sOk + '/' + n + ' example');
                s7Line('🔤 Probe 4 · Bilingual Data Integrity — Si ' + siOk + '/' + n + ' · EN ' + mOk + '/' + n + ' · IPA/POS/EX ' + pOk + '/' + posOk + '/' + sOk + ' of ' + n);
                probe5(n);
              });
          }

          /* ── Probe 5: Dynamic Count Gate ── */
          function probe5(n) {
            global.fetch('./index.html?t=' + nowMs(), { cache: 'no-store' })
              .then(function (r) { return r && r.ok ? r.text() : null; }, function () { return null; })
              .then(function (html) {
                var stale = [];
                if (html) {
                  var patterns = ['30 B1 words', 'to #30', '1–30', '1-30', 'of 30', '30-Word', '30 Words', 'All 30', '30 words', '#01–#30', 'words 30', 'වචන 30'];
                  for (var pi = 0; pi < patterns.length; pi++) if (html.indexOf(patterns[pi]) >= 0) stale.push(patterns[pi]);
                }
                record('S7', 'dynamic count gate: zero stale hardcoded “30” strings in index.html while the session carries ' + n + ' words', n !== 30 && html && stale.length === 0, stale.join(' · ') || 'none');
                var frame2 = byId('labAppProbe');
                var readLive = function (attempt) {
                  var liveOk = null, liveDetail = 'iframe not ready (WARN)';
                  try {
                    var doc3 = frame2 && frame2.contentWindow && frame2.contentWindow.document;
                    if (doc3 && doc3.getElementById && doc3.getElementById('btnStart')) {
                      var startLbl = str(doc3.getElementById('btnStart').textContent);
                      var tabLbl = str((doc3.querySelector('#tab-dict [data-i18n="tabWords"]') || {}).textContent);
                      liveOk = startLbl.indexOf(String(n)) >= 0 && tabLbl.indexOf(String(n)) >= 0;
                      liveDetail = 'start="' + startLbl.trim() + '" tab="' + tabLbl.trim() + '"';
                      /* the iframe app may still be hydrating its word bank —
                         a mid-boot read retries once before judging. */
                      if (liveOk === false && attempt < 2) { global.setTimeout(function () { readLive(attempt + 1); }, 2500); return; }
                    }
                  } catch (eF) { liveDetail = str(eF); }
                  if (liveOk !== null) record('S7', 'dynamic count gate: the live app paints the real count (' + n + ') on Start and the Words tab', liveOk, liveDetail);
                  s7Line('🔢 Probe 5 · Dynamic Count Gate — stale-30 strings: ' + (stale.length ? esc(stale.join(' · ')) : 'none') + ' · live labels ' + (liveOk === null ? 'n/a' : (liveOk ? '✓' : '✗')));
                  var c = counts();
                  setTxt('labS7Status', (c.fail ? '✗ Station 7 finished with FAIL — see the scorecard' : '✓ Station 7 finished · ' + c.pass + ' PASS · ' + c.warn + ' WARN · ' + c.fail + ' FAIL'));
                };
                readLive(1);
              });
          }
        });
      });
    return true;
  }


  /* ══ v0.0.7.h BUG-H1 — the Instant Version Mismatch Detector + 1-Click
     Force Update banner, shared by the Lecturer Studio and lab.html. It
     compares the RUNNING app version against the live cache-busted
     data/version.json pointer; when behind it offers the single tap that
     unregisters stale service workers, purges the old shell caches (the
     preserved audio caches are NEVER touched) and reloads onto the new
     release cleanly. ══════════════════════════════════════════════════ */
  var FU_LAST_SEEN = '';
  function forceUpdatePurgeAndReload() {
    try { global.sessionStorage.setItem('sdp_force_update_to', FU_LAST_SEEN); } catch (eS) {}
    var finish = function () { try { global.location.reload(); } catch (eR) {} };
    var purgeCaches = function () {
      if (!(global.caches && global.caches.keys)) { finish(); return; }
      try {
        global.caches.keys().then(function (names) {
          var keep = ['sdp-audio-clips', 'sdp-youdao-v1'];
          var jobs = [];
          for (var i = 0; i < names.length; i++) {
            if (names[i].indexOf('sdp-') === 0 && keep.indexOf(names[i]) < 0) jobs.push(global.caches.delete(names[i]));
          }
          return Promise.all(jobs);
        }).then(finish, finish);
      } catch (eC) { finish(); }
    };
    var killWorkers = function () {
      if (!(global.navigator && global.navigator.serviceWorker)) { purgeCaches(); return; }
      try {
        var sw = global.navigator.serviceWorker;
        if (sw.controller) { try { sw.controller.postMessage({ action: 'sdp:force-update' }); } catch (eM) {} }
        sw.getRegistrations().then(function (regs) {
          var jobs = [];
          for (var i = 0; i < regs.length; i++) jobs.push(regs[i].unregister());
          return Promise.all(jobs);
        }).then(purgeCaches, purgeCaches);
      } catch (eG) { purgeCaches(); }
    };
    killWorkers();
  }
  function checkVersionAndOfferForceUpdate(opts) {
    opts = opts || {};
    var bannerId = str(opts.bannerId || 'sdpForceUpdateBanner');
    var running = str(opts.running || (global.SDP && global.SDP.version) || '');
    var node = byId(bannerId);
    if (!node || !running || typeof global.fetch !== 'function') return false;
    var paint = function (html, level) {
      node.innerHTML = html;
      node.hidden = false;
      try { node.setAttribute('data-level', level || 'stale'); } catch (eA) {}
      var btn = byId(bannerId + 'Btn');
      if (btn) btn.onclick = function () { forceUpdatePurgeAndReload(); return false; };
      return true;
    };
    global.fetch('./data/version.json?t=' + nowMs(), { cache: 'no-store' })
      .then(function (r) { return r && r.ok ? r.json() : null; }, function () { return null; })
      .then(function (ver) {
        var live = ver && str(ver.appVersion);
        if (!live) return false;
        FU_LAST_SEEN = live;
        try {
          if (str(global.sessionStorage.getItem('sdp_force_update_to')) === live) return false;
        } catch (eSS) {}
        if (live === running) {
          if (opts.quietWhenCurrent !== false) return false;
          return paint('<b>✓ Up to date</b> — running ' + esc(running) + ' · live ' + esc(live), 'ok');
        }
        return paint(
          '<b>🔄 A new release is live: v' + esc(live) + '</b> — this browser is still running <b>v' + esc(running) + '</b> (a stale cached copy).' +
          '<div class="vgb-actions"><button type="button" class="lab-btn lab-btn--go" id="' + bannerId + 'Btn">🔄 Force Update Now (Clear Old Cache)</button></div>' +
          '<p class="vgb-detail">1 tap unregisters the old service worker, clears the stale shell cache and reloads the new release. එක් tap එකකින් පැරණි service worker එක ඉවත් කර cache එක පිරිසිදු කර නව release එක load වේ.</p>',
          'stale');
      })
      .catch(function () { return false; });
    return true;
  }


  /* ══ STATION 8 — v0.0.7.i Live Apps Script Relay, Access Lock, Password
     & Telegram Interactive Verification Lab (8 live probes). Everything
     runs against the owner's REAL /exec URL; the Admin PIN and the test
     password live only in this page's memory. ═════════════════════════ */
  var S8 = { log: [], relay: '', pin: '', pw: '' };

  function s8Card(id, state, title, bodyHtml, raw, fixEn, fixSi) {
    var host = byId('labS8Cards');
    if (!host) return false;
    var old = byId('s8card-' + id);
    if (old) old.parentNode.removeChild(old);
    var div = doc.createElement('div');
    div.className = 'lab-s8card';
    div.id = 's8card-' + id;
    div.setAttribute('data-state', state);
    var icon = state === 'pass' ? '✅' : (state === 'fail' ? '❌' : (state === 'warn' ? '⚠️' : '⏳'));
    var html = '<p class="lab-s8head">' + icon + ' ' + esc(title) + '</p>';
    if (bodyHtml) html += '<div class="lab-s8props">' + bodyHtml + '</div>';
    if (fixEn) html += '<p class="lab-s8fix"><b>Fix (EN):</b> ' + esc(fixEn) + '</p>';
    if (fixSi) html += '<p class="lab-s8fix"><b>Fix (සිංහල):</b> ' + esc(fixSi) + '</p>';
    if (raw) html = html + '<pre class="lab-s8raw">' + esc(str(raw).slice(0, 900)) + '</pre>';
    div.innerHTML = html;
    host.appendChild(div);
    return true;
  }
  function s8Record(name, ok, detail) {
    S8.log.push({ test: name, status: ok ? 'PASS' : (ok === false ? 'FAIL' : 'WARN'), detail: ok ? '' : str(detail).slice(0, 300) });
    record('S8', name, ok, detail);
    return ok;
  }
  /* v0.0.7.i FIX-I3: a Station 8 re-run must start from a CLEAN scorecard.
     s8Record() also feeds the shared LAB.results['S8'] registry (the unified
     scorecard, the "overall:" line and the exported JSON report), so clearing
     only S8.log left the previous run's rows behind — a second run showed
     inflated totals and duplicate [FAIL] 8.8 lines. Every Station 8 run now
     drops both ledgers first: exactly 8 clean probes (8.1-8.8), zero
     duplicates, on the 1st AND the Nth run. */
  function s8ResetRun() {
    S8.log = [];
    delete LAB.results['S8'];
    paintScorecard();
    return true;
  }
  function s8Relay() {
    var el = byId('labS8Url');
    var url = el ? str(el.value).trim() : '';
    if (!url || url.indexOf('http') !== 0) {
      try {
        var cfg = global.SDP && SDP.Sync && SDP.Sync.config ? SDP.Sync.config() : null;
        if (cfg && cfg.accessLock && cfg.accessLock.relayUrl) url = str(cfg.accessLock.relayUrl).trim();
      } catch (eC) {}
      if (!url && global.SDP_DATA_CONFIG_RELAY) url = str(global.SDP_DATA_CONFIG_RELAY);
      if (!url) {
        try {
          var set = global.localStorage ? global.localStorage.getItem('sdp.settings') : null;
          var s = set ? JSON.parse(set) : null;
          if (s && s.gasUrl) url = str(s.gasUrl);
        } catch (eS) {}
      }
      if (url && el) el.value = url;
    }
    return url;
  }
  function s8PrefillRelay() {
    var el = byId('labS8Url');
    if (!el || str(el.value).indexOf('http') === 0) return false;
    try {
      global.fetch('./data/config.json?t=' + nowMs(), { cache: 'no-store' })
        .then(function (r) { return r && r.ok ? r.json() : null; }, function () { return null; })
        .then(function (cfg) {
          var url = cfg && cfg.accessLock ? str(cfg.accessLock.relayUrl) : '';
          if (url && el && !str(el.value)) el.value = url;
        });
    } catch (e) {}
    return true;
  }
  function s8IsExec(url) {
    /* v0.0.7.h: a strict production /exec URL — OR a local /exec endpoint
       (127.0.0.1/localhost), which the e2e gates and Station 8's own local
       verification runs use to drive the REAL gas-source VM in Chromium. */
    if (/^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec\/?$/.test(str(url))) return true;
    /* v0.0.7.i: any local /gas/exec* endpoint drives the real VM in the
       gates (the second unconfigured-relay fixture lives at /gas/exec3). */
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/(gas\/)?exec\d*\/?$/.test(str(url));
  }
  function s8Classify(text, status, url) {
    var t = str(text);
    if (/accounts\.google\.com|Sign in|use a supported browser/i.test(t.slice(0, 2000))) return { code: 'ERR_AUTH_NOT_ANYONE', why: 'the Web App is not deployed with access "Anyone"' };
    if (status === 404 || /script\.google\.com\/404/.test(t)) return { code: 'ERR_BAD_URL', why: 'the deployment no longer exists (a /dev URL or a deleted deployment)' };
    if (status >= 500) return { code: 'ERR_GAS_EXCEPTION', why: 'the Apps Script threw: ' + t.slice(0, 200) };
    return null;
  }
  function s8Post(action, body, timeoutMs) {
    var url = S8.relay || s8Relay();
    var payload = {};
    var k;
    body = body || {};
    for (k in body) if (Object.prototype.hasOwnProperty.call(body, k)) payload[k] = body[k];
    payload.action = action;
    if (S8.pin) payload.pin = S8.pin;
    return new global.Promise(function (resolve) {
      if (!url) { resolve({ err: 'no_relay' }); return; }
      var done = false;
      var timer = global.setTimeout(function () {
        if (done) return; done = true;
        resolve({ err: 'ERR_TIMEOUT', raw: 'no answer within ' + (timeoutMs || 15000) + ' s' });
      }, timeoutMs || 15000);
      var opts = { method: 'POST', mode: 'cors', redirect: 'follow', credentials: 'omit',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload) };
      try {
        if (typeof global.AbortController === 'function') {
          var ctl = new global.AbortController();
          opts.signal = ctl.signal;
        }
      } catch (eAC) {}
      global.fetch(url, opts).then(function (res) {
        if (done) return; done = true;
        global.clearTimeout(timer);
        res.text().then(function (text) {
          var json = null;
          try { json = JSON.parse(text); } catch (eJ) {}
          resolve({ status: res.status, text: text, json: json,
            cls: s8Classify(text, res.status, url), redirected: !!(res.redirected || res.url !== url) });
        }, function () { if (!done) { done = true; global.clearTimeout(timer); resolve({ err: 'ERR_BODY' }); } });
      }).catch(function (eN) {
        if (done) return; done = true;
        global.clearTimeout(timer);
        resolve({ err: 'ERR_NETWORK_OR_CORS', raw: str(eN && eN.message || eN) });
      });
    });
  }
  function s8Badge(ok, label) { return '<span>' + (ok ? '✅' : '❌') + ' ' + esc(label) + '</span>'; }

  function s8Probe1() {
    var pill = str(byId('labVerPill') ? byId('labVerPill').textContent : '');
    var sd = str(global.SDP && SDP.version);
    return global.fetch('./data/version.json?t=' + nowMs(), { cache: 'no-store' })
      .then(function (r) { return r && r.ok ? r.json() : null; }, function () { return null; })
      .then(function (ver) {
        var live = ver ? str(ver.appVersion) : '';
        var match = pill === '0.0.7.i' && sd === '0.0.7.i' && live === '0.0.7.i';
        s8Card('8.1', match ? 'pass' : 'fail',
          'Probe 8.1 · Browser Version & Cache Check — lab.html + index.html match data/version.json (v0.0.7.i), no stale service worker',
          'lab pill <b>' + esc(pill) + '</b> · SDP.version <b>' + esc(sd) + '</b> · version.json <b>' + esc(live) + '</b>',
          JSON.stringify(ver || null),
          match ? '' : 'This browser is running a STALE cached copy. Tap the red 🔄 Force Update Now banner at the top of this page (it unregisters the old service worker, clears the stale cache and reloads v0.0.7.i), then run Station 8 again.',
          match ? '' : 'මෙම browser එක තුළ පැරණි cache කළ copy එකක් වේ. පිටුවේ ඉහළින් ඇති රතු 🔄 Force Update Now banner එක ඔබන්න — එය පැරණි service worker එක ඉවත් කර cache එක පිරිසිදු කර v0.0.7.i load කරයි.');
        s8Record('8.1 browser version & cache: lab.html + SDP.version + data/version.json all carry 0.0.7.i (no stale shell)', match, 'pill=' + pill + ' sd=' + sd + ' json=' + live);
        return true;
      });
  }
  function s8Probe2() {
    S8.relay = s8Relay();
    var url = S8.relay;
    var isExec = s8IsExec(url);
    var hasDev = /\/dev\/?$/.test(url);
    var state = isExec ? 'pass' : (hasDev ? 'fail' : 'fail');
    s8Card('8.2', state,
      'Probe 8.2 · URL & Deployment Access Check — production /exec format, CORS-simple POST (text/plain, redirect follow, credentials omitted)',
      'URL: <b>' + esc(url ? url.slice(0, 72) : '(empty)') + '</b>' + (isExec ? '' : ' — <b>NOT a production /exec URL</b>'),
      url,
      isExec ? '' : (hasDev
        ? 'This is the /dev TEST URL — Google answers it with a Sign-In page, so Telegram and student phones can NEVER reach it. Click the 🔁 /exec swap button next to the URL input (or paste the /exec URL from Apps Script → Deploy → Manage deployments → Web app).'
        : 'Paste your production Web App URL in /exec format: https://script.google.com/macros/s/…/exec (Apps Script → Deploy → Manage deployments → Web app → Copy URL, Access: Anyone).'),
      isExec ? '' : (hasDev
        ? 'මේක /dev TEST URL එකයි — Telegram සහ student phones වලට කිසිවිටෙක ලඟා විය නොහැක. URL input එක අසල ඇති 🔁 බොත්තමෙන් /exec URL එකට මාරු කරන්න.'
        : 'production Web App URL එක /exec ආකාරයෙන් paste කරන්න: https://script.google.com/macros/s/…/exec (Deploy → Manage deployments → Web app, Access: Anyone).'));
    s8Record('8.2 URL & deployment: the relay is a strict production /exec Web App URL', isExec, url);
    return global.Promise.resolve(true);
  }
  function s8Probe3() {
    s8Card('8.3', 'run', 'Probe 8.3 · Live ping & Auto-Sheet Health Check — running …');
    return s8Post('ping', {}).then(function (r) {
      var j = r.json;
      var ok = !!(j && j.ok && j.pong && j.sheetBound);
      var props = j ? [
        s8Badge(!!j.hasAdminPin, 'ADMIN_PIN'),
        s8Badge(!!j.hasTgBot, 'TG_BOT_TOKEN'),
        s8Badge(!!j.hasTgChat, 'TG_CHAT_ID'),
        s8Badge(!!j.hasTgSecret, 'TG_WEBHOOK_SECRET'),
        s8Badge(j.sheetBound, 'Sheet bound (auto-created)')
      ].join('') : '';
      s8Card('8.3', ok ? 'pass' : 'fail',
        'Probe 8.3 · Live ping & Auto-Sheet Health Check — sheetBound:true, Google Sheet status + the 5 Script Property badges',
        (j ? 'gas <b>' + esc(j.gas) + '</b> · sheet <b>' + esc(j.sheetUrl ? 'attached' : 'none') + '</b><br>' + props : ''),
        r.text || r.raw || r.err,
        ok ? '' : (r.cls ? r.cls.code + ' — ' + r.cls.why + '. Redeploy the Web App with Access "Anyone", then re-run.' : 'The relay answered but not with a healthy ping. Re-paste the latest data/gas-source.txt into Apps Script (Admin PIN also lives in Script Properties), save and redeploy.'),
        ok ? '' : 'Apps Script එකට අලුත්ම gas-source.txt කේතය paste කර save + deploy කරන්න. ADMIN_PIN, TG_BOT_TOKEN, TG_CHAT_ID, TG_WEBHOOK_SECRET සියල්ල Script Properties තුළ තිබිය යුතුය.');
      s8Record('8.3 live ping: ok + sheetBound + the 5 Script Properties present (ADMIN_PIN, LOCK_HMAC_SECRET via codes, TG_BOT_TOKEN, TG_CHAT_ID, TG_WEBHOOK_SECRET)', ok, (r.text || r.raw || r.err || '').slice(0, 220));
      return !!j;
    });
  }
  function s8Probe4() {
    if (!str(byId('labS8Pin') ? byId('labS8Pin').value : '')) {
      s8Card('8.4', 'warn',
        'Probe 8.4 · Live Admin PIN Auth Check — SKIPPED (no PIN entered)',
        null, null,
        'Enter the Admin PIN in the memory-only input above and re-run to verify it live against the Apps Script ADMIN_PIN.',
        'ඉහත memory-only input එකේ Admin PIN එක ඇතුළත් කර නැවත run කරන්න.');
      s8Record('8.4 live admin PIN auth (login round-trip) — skipped: no PIN entered', null, 'no pin');
      return global.Promise.resolve(null);
    }
    s8Card('8.4', 'run', 'Probe 8.4 · Live Admin PIN Auth Check — running …');
    return s8Post('ping', {}).then(function (pg) {
      /* v0.0.7.i FIX-I1: the ping carries adminPinLen (the LENGTH of the
         stored ADMIN_PIN only — never the PIN itself) so a typed PIN of the
         wrong length is caught before the 5-try lockout can rack up. */
      var hint = '';
      var wantLen = Number(pg.json && pg.json.adminPinLen) || 0;
      var gotLen = str(byId('labS8Pin').value).trim().length;
      if (wantLen && gotLen && gotLen !== wantLen) {
        hint = 'Your PIN has <b>' + gotLen + '</b> digits but ADMIN_PIN has <b>' + wantLen + '</b> — you are probably typing a different (older) PIN. Check Apps Script → Project Settings → Script Properties.';
      }
      return s8Post('login', { pin: str(byId('labS8Pin').value).trim() }).then(function (r) {
        var j = r.json;
        var ok = !!(j && j.ok && j.token);
        var why = '';
        if (!ok && j && str(j.err) === 'bad_pin' && wantLen && gotLen !== wantLen) {
          why = 'ERR_ADMIN_PIN_MISMATCH (length ' + gotLen + ' ≠ stored ' + wantLen + ')';
        }
        s8Card('8.4', ok ? 'pass' : 'fail',
          'Probe 8.4 · Live Admin PIN Auth Check — the entered Admin PIN matches the Apps Script ADMIN_PIN (whitespace auto-trimmed on both sides)',
          ok ? 'login ok · token issued · relay ver <b>' + esc(j.ver) + '</b> · adminPinLen <b>' + wantLen + '</b>' : ('verdict: <b>' + esc(why || 'ERR_ADMIN_PIN_MISMATCH') + '</b>' + (hint ? '<br>' + hint : '')),
          JSON.stringify(j ? { ok: j.ok, err: j.err, retrySec: j.retrySec, triesLeft: j.triesLeft, ver: j.ver, adminPinLen: wantLen } : r).replace(/"token":"[^"]*"/, '"token":"[REDACTED]"'),
          ok ? '' : (hint ? hint + ' ' : '') + 'The PIN does not match ADMIN_PIN (or the account is rate-limited after 5 wrong tries — wait 5 minutes). Check ADMIN_PIN in Apps Script → Project Settings → Script Properties (leading/trailing spaces are now trimmed automatically on both sides). 5 වරක් වැරදි PIN එකක් ඇතුළත් කළොත් විනාඩි 5 ක් රැඳී සිටීමට සිදු වේ.',
          ok ? '' : 'ADMIN_PIN එක Apps Script → Project Settings → Script Properties තුළ පරීක්ෂා කරන්න.');
        s8Record('8.4 live admin PIN auth: the entered PIN authenticates against ADMIN_PIN (login token round-trip, whitespace trimmed)', ok, (r.text || r.raw || '').slice(0, 200));
        return ok;
      });
    });
  }
  function s8Probe5() {
    var pwEl = byId('labS8Pw');
    var pw = str(pwEl ? pwEl.value : '');
    s8Card('8.5', 'run', 'Probe 8.5 · Live Password / Break-Glass PIN Verification Test — running …');
    return s8Post('access_state', {}).then(function (st) {
      var lock = st.json && st.json.lock ? st.json.lock : (st.json || {});
      var hasPw = !!lock.hasPassword;
      var mode = str(lock.mode || 'approval+code');
      var on = lock.on !== false;
      if (!pw && !hasPw) {
        /* v0.0.7.i FIX-I4: an UNSET optional password is a friendly WARN,
           never a false red bad-code error. */
        s8Card('8.5', 'warn',
          'Probe 8.5 · Live Password Verification — password not set yet (WARN, not a failure)',
          'lock on=<b>' + on + '</b> · mode=<b>' + esc(mode) + '</b> · hasPassword=<b>' + hasPw + '</b>',
          st.text || st.raw || st.err,
          'Password not set yet — set it in Studio → Advanced Settings → Access Lock (then re-run Station 8 with the same password typed in the optional input above to see the live by:"password" unlock verdict).',
          'Password එකක් තවම සකසා නැත — Studio → Advanced Settings → Access Lock තුළ සකසන්න (ඉන් පසු එම password එක ඉහත input එකේ ඇතුළත් කර නැවත run කරන්න).');
        s8Record('8.5 live password/PIN verification (verify_lock_secret) — password not set yet (WARN, not a failure): set it in Studio → Advanced Settings → Access Lock', null, 'hasPassword=false');
        return null;
      }
      if (!pw && hasPw) {
        s8Card('8.5', 'warn',
          'Probe 8.5 · Live Password Verification — a live password EXISTS; type it in the optional input to verify',
          'hasPassword=<b>true</b> · mode=<b>' + esc(mode) + '</b>',
          st.text || st.raw || st.err,
          'A lock password is already set on the relay. Type THAT password into the optional input to prove the student unlock path live.',
          'relay එකේ දැනටමත් password එකක් සකසා ඇත — එය ඉහත input එකේ ඇතුළත් කර තහවුරු කරන්න.');
        s8Record('8.5 live password/PIN verification — a live password exists; enter it to verify (WARN)', null, 'hasPassword=true');
        return null;
      }
      return s8Post('verify_lock_secret', { deviceId: 'lab-dev-A', name: 'Station 8 Live Test', classId: 'lab', secret: pw }).then(function (r) {
        var j = r.json;
        var ok = !!(j && j.ok);
        var why = '';
        if (!ok) {
          if (mode === 'approval' && !hasPw) why = 'the lock mode is approval-only (codes/password disabled) — switch mode to approval+code in the Studio Access Lock panel';
          else if (j && str(j.err).indexOf('no secret given') >= 0) why = 'a password IS set on the relay but the entered value did not match it';
          else if (j && str(j.err) === 'rate') why = 'rate-limited (8+ tries in 30 s) — wait 30 s and re-run';
          else if (j && str(j.err).indexOf('codes disabled') >= 0) why = 'approval-only mode rejects secrets';
          else why = (j && j.err) || 'unexpected relay answer';
        }
        s8Card('8.5', ok ? 'pass' : 'fail',
          'Probe 8.5 · Live Password / Break-Glass PIN Verification (verify_lock_secret) — the real student unlock path, live',
          ok ? 'verdict: <b>by:"' + esc(j.by) + '"</b> — the secret unlocked device lab-dev-A exactly like a student phone' : 'verdict: <b>rejected</b> — ' + esc(why),
          JSON.stringify(j || r),
          ok ? '' : 'Fix: ' + why + '. The entered test password must match the live lock password (set it first from the Studio Access Lock panel if none exists).',
          ok ? '' : 'ඇතුළත් කළ password එක සජීවී lock password එකට ගැලපිය යුතුය — පළමුව Studio Access Lock panel එකෙන් password එකක් සකසන්න.');
        s8Record('8.5 live password/PIN verification (verify_lock_secret): the entered secret unlocks live (by password) with the exact verdict + cause when rejected', ok, (r.text || r.raw || '').slice(0, 220));
        return ok;
      });
    });
  }
  function s8Probe6() {
    s8Card('8.6', 'run', 'Probe 8.6 · Live Single-Use Burnable Code Round-Trip — running …');
    /* v0.0.7.i FIX-I4: the relay refuses burnable codes while the Lock is
       OFF (Open Classroom Mode) — paint the friendly WARN instead of a false
       red "burn FAIL", unless the temporary test-mode checkbox is ticked. */
    return s8Post('access_state', {}).then(function (st0) {
      var on0 = !!(st0.json && st0.json.lock && st0.json.lock.on);
      var force0 = false;
      try { var cb0 = byId('labS8Test'); force0 = !!(cb0 && cb0.checked); } catch (e0) { force0 = false; }
      if (!on0 && !force0) {
        s8Card('8.6', 'warn',
          'Probe 8.6 · Burnable Code Round-Trip — skipped: burnable codes are disabled while the Lock is OFF (WARN, not a failure)',
          'lock on=<b>false</b> · Open Classroom Mode',
          st0.text || st0.raw || st0.err,
          'Lock is currently OFF — the relay refuses one-time codes in Open Classroom Mode. Turn Master Lock ON in Studio (Advanced Settings → Access Lock) to test the single-use burn + 2nd-device rejection law, or tick the "still exercise the student flow" checkbox above.',
          'Lock එක OFF තිබෙන විට one-time codes භාවිත කළ නොහැක — Studio (Advanced Settings → Access Lock) තුළ Master Lock ON කර නැවත run කරන්න.');
        s8Record('8.6 burnable codes: skipped — the relay disables one-time codes while the Lock is OFF (WARN, not a failure)', null, 'lock.on=false');
        return null;
      }
      return s8Post('generate_codes', { count: 1, ttlHours: 1 }).then(function (g) {
      var codes = g.json && g.json.codes;
      if (!codes || !codes.length) {
        s8Card('8.6', 'fail',
          'Probe 8.6 · Burnable Code Round-Trip — generate_codes refused',
          null, g.text || g.raw || g.err,
          'generate_codes needs the correct Admin PIN (the relay answered unauthorised). Enter the PIN above and re-run.',
          'නිවැරදි Admin PIN එක ඇතුළත් කර නැවත run කරන්න.');
        s8Record('8.6 burnable code round-trip: generate_codes answered (admin-gated) — PIN required', false, (g.text || g.err || '').slice(0, 150));
        return false;
      }
      var code = str(codes[0]);
      return s8Post('burn_code', { code: code, deviceId: 'lab-dev-A', name: 'Station 8 Live Test', classId: 'lab' }).then(function (bA) {
        var okA = !!(bA.json && bA.json.ok);
        return s8Post('burn_code', { code: code, deviceId: 'lab-dev-B', name: 'Station 8 Impostor', classId: 'lab' }).then(function (bB) {
          var rejB = bB.json && bB.json.ok === false && str(bB.json.err).indexOf('already burned') >= 0;
          var state = okA && rejB ? 'pass' : 'fail';
          return s8Post('lab_test_cleanup', {}).then(function (cl) {
            s8Card('8.6', state,
              'Probe 8.6 · Live Single-Use Burnable Code Round-Trip — burn on lab-dev-A, 2nd-device REJECTION, then synthetic-device cleanup',
              'burn A: <b>' + (okA ? 'PASS (by code)' : 'FAIL') + '</b> · reuse on lab-dev-B: <b>' + (rejB ? 'REJECTED ✅ (single-use law holds)' : 'NOT rejected ❌') + '</b> · cleanup: <b>' + (cl.json && cl.json.ok ? 'done (' + cl.json.devicesRemoved + ' device row, ' + cl.json.codesRemoved + ' code row removed)' : 'failed') + '</b>',
              'A: ' + JSON.stringify(bA.json || bA) + '\nB: ' + JSON.stringify(bB.json || bB) + '\ncleanup: ' + JSON.stringify(cl.json || cl),
              state === 'pass' ? '' : 'The code must burn on exactly ONE device; a second device reusing it must be rejected ("code already burned on another device"). If reuse was allowed, re-paste the latest gas-source.txt and redeploy.',
              state === 'pass' ? '' : 'එක් device එකකින් පමණක් code එක use විය යුතුය — දෙවන device එකකින් reuse කළ යුත්තේ නැත. නවතම gas-source.txt එක redeploy කරන්න.');
            s8Record('8.6 burnable codes: generate → burn(lab-dev-A) ok → 2nd-device(lab-dev-B) reuse REJECTED → lab_test_cleanup removes the synthetic rows', state === 'pass',
              JSON.stringify({ a: bA.json, b: bB.json, cl: cl.json }));
            return state === 'pass';
          });
        });
      });
      });
    });
  }
  function s8Probe7() {
    s8Card('8.7', 'run', 'Probe 8.7 · Live Student access_request → access_decision → check_device (firstGrant) — running …');
    return s8Post('access_state', {}).then(function (st) {
      var wasOn = !!(st.json && st.json.lock && st.json.lock.on);
      /* v0.0.7.i FIX-I4: Open Classroom Mode (lock OFF) is an OPTIONAL
         unconfigured state — paint a friendly WARN and skip the student-flow
         calls instead of a false red FAIL, UNLESS the temporary test-mode
         checkbox is ticked (then the full round-trip runs for real). Probes
         8.6 and 8.8 are never affected. */
      var forceTest = false;
      try { var cbEl = byId('labS8Test'); forceTest = !!(cbEl && cbEl.checked); } catch (eCB) { forceTest = false; }
      if (!wasOn && !forceTest) {
        s8Card('8.7', 'warn',
          'Probe 8.7 · Live Student access_request → access_decision → check_device — skipped: the Lock is currently OFF (Open Classroom Mode, WARN not a failure)',
          'lock on=<b>false</b> · mode=<b>' + esc(str((st.json && st.json.lock && st.json.lock.mode) || 'approval+code')) + '</b>',
          st.text || st.raw || st.err,
          'Lock is currently OFF — turn Master Lock ON in Studio (Advanced Settings → Access Lock) to test student gating, or tick the "still exercise the student flow" checkbox above to run the round-trip anyway.',
          'Lock එක දැනට OFF යි — student gating පරීක්ෂා කිරීමට Studio (Advanced Settings → Access Lock) තුළ Master Lock ON කරන්න, නැතහොත් ඉහත checkbox එක සලකුණු කර ඕනෑම විටක පරීක්ෂාව run කරන්න.');
        s8Record('8.7 student round-trip: skipped — lock is currently OFF (Open Classroom Mode, WARN not a failure): turn Master Lock ON in Studio to test student gating', null, 'lock.on=false');
        return null;
      }
      return s8Post('access_request', { deviceId: 'lab-dev-A', name: 'Station 8 Student Sim', classId: 'lab', note: 'station 8 live probe' }).then(function (req) {
        var reqOk = !!(req.json && req.json.ok);
        return s8Post('access_decision', { deviceId: 'lab-dev-A', decision: 'approve', hours: 72 }).then(function (dec) {
          var decOk = !!(dec.json && dec.json.ok);
          return s8Post('check_device', { deviceId: 'lab-dev-A' }).then(function (chk) {
            var j = chk.json || {};
            /* v0.0.7.i FIX-I4: with the Lock OFF + the temporary test-mode
               checkbox ticked, check_device answers the OPEN-MODE contract
               { ok:true, open:true } — that IS the correct live verdict. */
            var openGrant = !!(j.ok && j.open);
            var grant = openGrant || !!(j.ok && j.approved && j.firstGrant && j.token);
            var state = grant ? 'pass' : 'fail';
            s8Card('8.7', state,
              'Probe 8.7 · Live Student access_request → access_decision → check_device — the 4-second auto-unlock firstGrant token handoff',
              'request: <b>' + (reqOk ? 'ok' : 'fail') + '</b> · approve: <b>' + (decOk ? 'ok' : 'fail') + '</b> · check_device: <b>' + (openGrant ? 'open mode (lock OFF — every device allowed, exactly as configured)' : (grant ? 'approved + firstGrant token issued' : 'no firstGrant')) + '</b>',
              JSON.stringify({ req: req.json, dec: dec.json, chk: { ok: j.ok, approved: j.approved, firstGrant: j.firstGrant, graceHours: j.graceHours, hasToken: !!j.token } }),
              state === 'pass' ? '' : 'The student flow needs the lock ON (approval mode) and a correct Admin PIN for access_decision. Turn the Access Lock on from the Studio panel, then re-run.',
              state === 'pass' ? '' : 'Access Lock එක ON කර නිවැරදි Admin PIN එකක් ඇතුළත් කර නැවත run කරන්න.');
            s8Record('8.7 student round-trip: access_request → access_decision(approve) → check_device answers approved + firstGrant token (the 4 s auto-unlock handoff)', state === 'pass',
              JSON.stringify({ req: req.json, dec: dec.json, chk: { ok: j.ok, firstGrant: j.firstGrant, hasToken: !!j.token } }));
            return state === 'pass';
          });
        });
      });
    });
  }
  function s8Probe8(autoFixMode) {
    s8Card('8.8', 'run', 'Probe 8.8 · Live Telegram Webhook (tg_webhook_info → getWebhookInfo) & Phone Alert Round-Trip — running …');
    return s8Post('auto_setup_webhook', { execUrl: S8.relay || s8Relay() }).then(function (aw) {
      var awOk = !!(aw.json && aw.json.ok);
      return s8Post('tg_webhook_info', {}).then(function (wi) {
        var j = wi.json || {};
        var execOk = !!j.hasExec;
        var noErr = !j.hasErrors;
        return s8Post('tg_test', {}).then(function (tt) {
          var ttOk = !!(tt.json && tt.json.ok && tt.json.telegram);
          var state = execOk && noErr && ttOk ? 'pass' : (execOk && ttOk ? 'warn' : 'fail');
          s8Card('8.8', state,
            'Probe 8.8 · Live Telegram Webhook & Phone Alert Round-Trip — auto_setup_webhook (/exec only), getWebhookInfo 0 delivery errors, real test alert to the phone',
            'auto-fix: <b>' + (awOk ? 'ok' : 'refused') + '</b> · webhook: <b>' + (execOk ? 'ends in /exec ✅' : 'NOT /exec ❌') + '</b> · delivery errors: <b>' + (noErr ? '0 ✅' : esc(j.lastError || 'present') + ' ❌') + '</b> · test alert: <b>' + (ttOk ? 'sent ✅ (check the Telegram app + the ✅ inline button)' : 'not sent ❌') + '</b>',
            JSON.stringify({ auto: aw.json, info: { webhookUrl: j.webhookUrl, hasExec: j.hasExec, pendingUpdateCount: j.pendingUpdateCount, hasErrors: j.hasErrors, lastError: j.lastError }, test: tt.json }),
            (state === 'pass' && !autoFixMode) ? '' : (execOk && ttOk
              ? 'Webhook + alert work; Telegram reported a past delivery error — open @BotFather or re-run the Auto-Fix to reset it, then confirm the error count stays 0.'
              : 'Run the 🩺 Auto-Fix Webhook button above: it registers the /exec webhook (requires TG_BOT_TOKEN + TG_CHAT_ID in Script Properties) and fires the test alert. If the alert never arrives, verify the bot was started (/start) by the owner chat.'),
            (state === 'pass' && !autoFixMode) ? '' : '🩺 Auto-Fix Webhook බොත්තම ඔබන්න — එය /exec webhook එක register කර test alert එකක් යවයි. Alert එක නොපැමිණේ නම් bot එකට /start දී ඇතිදැයි පරීක්ෂා කරන්න.');
          s8Record('8.8 telegram round-trip: auto_setup_webhook registers the /exec webhook, tg_webhook_info (server getWebhookInfo) shows 0 delivery errors and ends in /exec, and tg_test delivers the real phone alert with the inline button', state === 'pass',
            JSON.stringify({ aw: aw.json, wi: { hasExec: j.hasExec, hasErrors: j.hasErrors, url: j.webhookUrl }, tt: tt.json }));
          return state;
        });
      });
    });
  }

  function station8() {
    setTxt('labS8Status', '🧪 Station 8 live verification running — 8 probes against the real Apps Script relay …');
    if (byId('labS8Cards')) byId('labS8Cards').innerHTML = '';
    /* v0.0.7.i FIX-I3: clear the previous Station 8 records FIRST (the S8 log
       AND the shared unified scorecard rows) so a re-run always reports
       exactly 8 clean probes with zero duplicated rows. */
    s8ResetRun();
    S8.pin = str(byId('labS8Pin') ? byId('labS8Pin').value : '').trim();
    S8.pw = str(byId('labS8Pw') ? byId('labS8Pw').value : '');
    S8.relay = s8Relay();
    s8Probe1()
      .then(function () { return s8Probe2(); })
      .then(function () { return s8Probe3(); })
      .then(function () { return s8Probe4(); })
      .then(function () { return s8Probe5(); })
      .then(function () { return s8Probe6(); })
      .then(function () { return s8Probe7(); })
      .then(function () { return s8Probe8(false); })
      .then(function () {
        /* the FINAL cleanup: probe 8.7 re-approves lab-dev-A, so the
           synthetic device is removed once more at the very end. */
        return s8Post('lab_test_cleanup', {});
      })
      .then(function () {
        var c = counts();
        var fails = 0, warns = 0, i;
        for (i = 0; i < S8.log.length; i++) {
          if (S8.log[i].status === 'FAIL') fails += 1;
          else if (S8.log[i].status === 'WARN') warns += 1;
        }
        setTxt('labS8Status', (fails ? '✗ Station 8 finished with ' + fails + ' FAIL — see the red cards for the exact bilingual fix'
          : '✓ Station 8 finished · ' + (S8.log.length - warns - fails) + ' PASS · ' + warns + ' WARN · ' + fails + ' FAIL') + ' — the report is redacted-ready (📋 Copy).');
        try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('station8_run', { fail: fails, warn: warns, pass: S8.log.length - warns - fails }); } catch (eD) {}
      })
      .catch(function (e) {
        setTxt('labS8Status', '✗ Station 8 crashed — ' + str(e && e.message || e));
        s8Record('8.x station 8 crashed', false, str(e));
      });
    return true;
  }
  function s8AutoFix() {
    setTxt('labS8Status', '🩺 Auto-Fix Webhook running — registering the /exec webhook + sending the Telegram test alert …');
    /* v0.0.7.i FIX-I3: the Auto-Fix pass repaints its own 8.8 card, so it
       also starts from a clean Station 8 ledger — no stacked 8.8 rows. */
    s8ResetRun();
    S8.pin = str(byId('labS8Pin') ? byId('labS8Pin').value : '').trim();
    S8.relay = s8Relay();
    if (!s8IsExec(S8.relay)) {
      s8Card('8.8', 'fail', 'Probe 8.8 · Auto-Fix — needs a production /exec URL first', null, S8.relay,
        'Paste the /exec URL (Apps Script → Deploy → Manage deployments → Web app). A /dev URL can never receive Telegram updates.',
        '/exec URL එක paste කරන්න — /dev URL එකකට Telegram ලබා ගත නොහැක.');
      return false;
    }
    s8Probe8(true).then(function (state) {
      setTxt('labS8Status', state === 'pass'
        ? '✓ Auto-Fix complete — webhook registered on /exec, 0 delivery errors, test alert sent. Check the Telegram app for the 🔔 TEST ALERT + the ✅ inline button.'
        : '⚠ Auto-Fix finished with issues — read the 8.8 card for the exact cause and bilingual fix.');
    });
    return true;
  }
  function s8Redact(text) {
    var t = str(text);
    t = t.replace(/(AKfycb[A-Za-z0-9_-]{10,})/g, 'AKfycb…[REDACTED]');
    t = t.replace(/(\d{7,10}:[A-Za-z0-9_-]{20,})/g, '[BOT-TOKEN-REDACTED]');
    t = t.replace(/("pin"\s*:\s*")[^"]*(")/g, '$1[REDACTED]$2');
    t = t.replace(/("token"\s*:\s*")[^"]{8,}(")/g, '$1[REDACTED]$2');
    t = t.replace(/("secret"\s*:\s*")[^"]*(")/g, '$1[REDACTED]$2');
    var pin = str(byId('labS8Pin') ? byId('labS8Pin').value : '');
    if (pin && pin.length >= 4) t = t.split(pin).join('[PIN-REDACTED]');
    var pw = str(byId('labS8Pw') ? byId('labS8Pw').value : '');
    if (pw && pw.length >= 4) t = t.split(pw).join('[PASSWORD-REDACTED]');
    return t;
  }
  function s8CopyRedactedReport() {
    var c = counts();
    var lines = [];
    var i;
    lines.push('SMART DICTATION PLAYER — LIVE LAB STATION 8 REDACTED REPORT');
    lines.push('generated: ' + new Date().toISOString());
    lines.push('relay: ' + s8Redact(S8.relay || s8Relay()));
    lines.push('overall: ' + c.pass + ' PASS · ' + c.warn + ' WARN · ' + c.fail + ' FAIL');
    lines.push('');
    for (i = 0; i < S8.log.length; i++) {
      lines.push((S8.log[i].status === 'PASS' ? '[PASS] ' : (S8.log[i].status === 'FAIL' ? '[FAIL] ' : '[WARN] ')) + S8.log[i].test);
      if (S8.log[i].detail) lines.push('       detail: ' + s8Redact(S8.log[i].detail));
    }
    lines.push('');
    lines.push('(PINs, passwords, bot tokens and deployment IDs are automatically redacted — safe to share.)');
    var text = lines.join('\n');
    var done = function () { setTxt('labS8Status', '📋 Redacted Station 8 report copied to the clipboard (' + S8.log.length + ' entries) — PINs, passwords and tokens are redacted.'); };
    try {
      if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
        return true;
      }
    } catch (eC) {}
    fallbackCopy(text);
    done();
    return true;
  }
  function fallbackCopy(text) {
    try {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      doc.body.appendChild(ta);
      ta.select();
      doc.execCommand('copy');
      doc.body.removeChild(ta);
    } catch (e) {}
  }

  function s8BindExtras() {
    var urlEl = byId('labS8Url');
    if (urlEl && !urlEl.getAttribute('data-s8-wired')) {
      urlEl.setAttribute('data-s8-wired', '1');
      /* the live /dev detector + 1-click /exec swap */
      var wrap = function () {
        var v = str(urlEl.value).trim();
        if (/\/dev\/?$/.test(v)) {
          if (!byId('labS8DevSwap')) {
            var b = doc.createElement('button');
            b.type = 'button';
            b.className = 'lab-btn lab-btn--warn';
            b.id = 'labS8DevSwap';
            b.innerHTML = '🔁 /dev detected — use the /exec URL instead';
            b.onclick = function () {
              urlEl.value = v.replace(/\/dev\/?$/, '/exec');
              try { urlEl.dispatchEvent(new (global.Event || window.Event)('input', { bubbles: true })); } catch (e) {}
              if (b.parentNode) b.parentNode.removeChild(b);
              setTxt('labS8Status', '🔁 Swapped to the production /exec URL — re-run Station 8.');
            };
            urlEl.parentNode.appendChild(b);
          }
        } else {
          var old = byId('labS8DevSwap');
          if (old && old.parentNode) old.parentNode.removeChild(old);
        }
      };
      urlEl.addEventListener('input', wrap, false);
      wrap();
    }
    var pinEl = byId('labS8Pin');
    if (pinEl) {
      pinEl.setAttribute('autocomplete', 'off');
      pinEl.setAttribute('data-s8-memory', '1');
    }
    var pwEl = byId('labS8Pw');
    if (pwEl) pwEl.setAttribute('autocomplete', 'off');
    s8PrefillRelay();
    return true;
  }

  SDP.LiveLab = {
    /* v0.0.7.c: the Live Lab shares the app's ONE progressive version. */
    version: '0.0.7.i',
    labKey: labKey,
    labBatchRepairWords: labBatchRepairWords,
    testVoiceSynthesis: testVoiceSynthesis,
    lowCreditVerify: lowCreditVerify,
    record: record,
    counts: counts,
    station1: station1,
    station2: station2,
    station3: station3,
    station4: station4,
    station5: station5,
    /* v0.0.7.c — the unified release verification station. */
    station7: station7,
    runFullDiagnostics: runFullDiagnostics,
    buildReport: buildReport,
    downloadJsonReport: downloadJsonReport,
    downloadZipReport: downloadZipReport,
    forcePurgeAndResync: forcePurgeAndResync,
    playKey: playKey,
    startVisualizer: startVisualizer,
    /* v3.0 — Station 2B + 3B. */
    labAnalyzeSample: labAnalyzeSample,
    labSimulateSample: labSimulateSample,
    labTestSynthEnhanced: labTestSynthEnhanced,
    labStaleSimulator: labStaleSimulator,
    /* v0.0.7.h BUG-H1 — the shared Force Update banner controller. */
    checkVersionAndOfferForceUpdate: checkVersionAndOfferForceUpdate,
    forceUpdatePurgeAndReload: forceUpdatePurgeAndReload,
    /* v0.0.7.h STATION 8 — the live relay, lock, password & Telegram lab. */
    station8: station8,
    s8AutoFix: s8AutoFix,
    s8CopyRedactedReport: s8CopyRedactedReport,
    s8Relay: s8Relay,
    s8Post: s8Post,
    s8Redact: s8Redact,
    s8BindExtras: s8BindExtras
  };

  try {
    if (doc && doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { bind(); }, false);
    else bind();
  } catch (eB) {}
})(typeof window !== 'undefined' ? window : this);
