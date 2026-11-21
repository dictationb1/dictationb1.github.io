/* data/sdp-selfheal.js — v0.0.6.v
 * The student self-heal assistant (strict ES5). Exposed as
 * window.SDP.SelfHeal. Owns #sdpSelfHealModal and the seven triggers
 * (T1 manifest load timeout/abort, T2 MEDIA_ERR_* on a word clip,
 * T3 tier fall-through to tts, T4 long-frame lag, T5 SW version mismatch,
 * T6 storage quota, T7 extension interference) with exact plain-English
 * copy and 1-tap actions. Every trigger logs an incident into
 * SDP.Telemetry.recordIncident(...) (five-key law: incidents nest inside
 * sdp.settings.telemetry).
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R-SELFHEAL (v0.0.6.v). */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var REARM_MS = 300000; /* one popup per trigger-type per 5 minutes */
  var armed = { T1: true, T2: true, T3: true, T4: true, T5: true, T6: true, T7: true };

  function byId(id) {
    try { return global.document.getElementById(id); } catch (e) { return null; }
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var COPY = {
    T1: { title: 'Voice clips are still loading',
      body: "Voice clips did not finish loading because of a slow internet connection. Tap 'Reload Voice Clips' or refresh the page to fix this immediately.",
      actions: [['reload', '🔄 Reload Voice Clips'], ['refresh', '↻ Refresh Page'], ['troubleshoot', '🛠 Open Troubleshooting Guide']] },
    T2: { title: 'One word did not load correctly',
      body: "This word's voice file did not load correctly. Tap 'Switch to Backup Audio' to hear it in the backup voice, or 'Reload Voice Clips' to try again.",
      actions: [['backup', '🔊 Switch to Backup Audio'], ['reload', '🔄 Reload Voice Clips'], ['troubleshoot', '🛠 Open Troubleshooting Guide']] },
    T3: { title: 'Using the backup voice',
      body: "Voice clips are not available right now — the backup voice is being used. Tap 'Reload Voice Clips' to restore the clear British voice.",
      actions: [['reload', '🔄 Reload Voice Clips'], ['troubleshoot', '🛠 Open Troubleshooting Guide']] },
    T4: { title: 'The app feels slow',
      body: "The app feels slow on this phone. Tap 'Refresh Page' to clear it, or continue — your progress is saved.",
      actions: [['refresh', '↻ Refresh Page'], ['dismiss', 'Continue']] },
    T5: { title: 'A new version is ready',
      body: "A new version is ready. Tap 'Refresh Page' to update — it takes one reload.",
      actions: [['refresh', '↻ Refresh Page']] },
    T6: { title: 'Storage is full',
      body: "Storage is full on this phone. Tap 'Clear Old Audio' to free space — your session and progress are kept.",
      actions: [['clear', 'Clear Old Audio']] },
    T7: { title: 'A browser extension may be changing this page',
      body: 'A browser extension may be changing this page. Try disabling it for this site.',
      actions: [['dismiss', 'Got it']] }
  };

  function ensureModal() {
    var m = byId('sdpSelfHealModal');
    if (m) return m;
    try {
      var div = global.document.createElement('div');
      div.id = 'sdpSelfHealModal';
      div.className = 'modal selfheal-modal';
      div.setAttribute('role', 'dialog');
      div.setAttribute('aria-modal', 'true');
      div.setAttribute('aria-labelledby', 'sdpSelfHealTitle');
      div.setAttribute('aria-hidden', 'true');
      div.hidden = true;
      div.innerHTML = '<div class="modal-card selfheal-card">' +
        '<div class="modal-head"><h2 id="sdpSelfHealTitle">Smart Dictation · Quick Fix</h2></div>' +
        '<p id="sdpSelfHealBody" class="selfheal-body" role="status" aria-live="polite"></p>' +
        '<div class="modal-foot selfheal-foot" id="sdpSelfHealActions"></div>' +
        '</div>';
      (global.document.body || global.document.documentElement).appendChild(div);
      div.addEventListener('click', function (ev) {
        if (ev && ev.target === div) hide();
      }, false);
      return div;
    } catch (e) { return null; }
  }

  function hide() {
    var m = byId('sdpSelfHealModal');
    if (!m) return false;
    m.hidden = true;
    m.setAttribute('aria-hidden', 'true');
    if (m.classList) m.classList.remove('is-open');
    return true;
  }

  function show(type, detail) {
    var copy = COPY[type];
    if (!copy) return false;
    if (!armed[type]) return false;
    armed[type] = false;
    global.setTimeout(function () { armed[type] = true; }, REARM_MS);
    var m = ensureModal();
    if (!m) return false;
    var title = byId('sdpSelfHealTitle'), body = byId('sdpSelfHealBody'), foot = byId('sdpSelfHealActions');
    if (title) title.textContent = copy.title;
    if (body) body.textContent = copy.body;
    if (foot) {
      var html = '', i;
      for (i = 0; i < copy.actions.length; i++) {
        html += '<button type="button" class="btn ' + (i === 0 ? 'btn-go' : 'btn-ghost') +
          '" data-selfheal-act="' + esc(copy.actions[i][0]) + '">' + esc(copy.actions[i][1]) + '</button>';
      }
      foot.innerHTML = html;
      var btns = foot.getElementsByTagName('button');
      for (i = 0; i < btns.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () { runAction(btn.getAttribute('data-selfheal-act') || '', type, detail || {}); }, false);
        })(btns[i]);
      }
    }
    m.hidden = false;
    m.setAttribute('aria-hidden', 'false');
    if (m.classList) m.classList.add('is-open');
    try {
      if (SDP.Telemetry && SDP.Telemetry.recordIncident) SDP.Telemetry.recordIncident('selfheal_' + type, detail || {});
    } catch (e) {}
    try {
      if (SDP.Diagnostics && SDP.Diagnostics.log) SDP.Diagnostics.log('selfheal_show', { type: type });
    } catch (e2) {}
    return true;
  }

  /* The 1-tap healing actions. */
  function runAction(act, type, detail) {
    var result = 'ok';
    try {
      if (act === 'refresh') {
        global.location.reload();
        result = 'reloading';
      } else if (act === 'reload') {
        if (SDP.Sync && SDP.Sync.purgeStaleBriefingClips) {
          try { SDP.Sync.purgeStaleBriefingClips({ words: true }); } catch (eP) {}
        }
        if (SDP.Speech && SDP.Speech.reloadManifest) {
          SDP.Speech.reloadManifest(function (err) {
            hide();
            if (err && SDP.Telemetry && SDP.Telemetry.recordIncident) {
              SDP.Telemetry.recordIncident('selfheal_' + type + '_retry_failed', { lastErr: String(err && err.message || err) });
            }
          }, true);
          result = 'reloading_clips';
        } else { hide(); result = 'no_speech'; }
      } else if (act === 'backup') {
        try {
          if (SDP.Data && SDP.Data.saveSettings) SDP.Data.saveSettings({ includeDictionary: true, voiceSource: 'auto' });
        } catch (eS) {}
        hide();
        result = 'backup_audio_on';
      } else if (act === 'clear') {
        try {
          if (global.caches && global.caches.keys) {
            global.caches.keys().then(function (names) {
              var i;
              for (i = 0; i < names.length; i++) {
                if (String(names[i]).indexOf('sdp-audio-clips') === 0 || String(names[i]).indexOf('sdp-youdao') === 0) {
                  global.caches.delete(names[i]);
                }
              }
            }, function () {});
          }
        } catch (eC) {}
        hide();
        result = 'old_audio_cleared';
      } else if (act === 'troubleshoot') {
        hide();
        showTroubleshoot(detail && detail.section ? detail.section : (type === 'T5' ? 'stale' : 'missing'));
        result = 'troubleshoot_opened';
      } else {
        hide();
        result = 'dismissed';
      }
    } catch (e) { result = 'error'; }
    /* v0.0.7.f Pillar 4: every 1-tap self-heal fix run reaches the Lecturer's
       Telegram (the GAS side throttles + batches to protect the quotas). */
    try {
      if (global.SDP && SDP.Telemetry && SDP.Telemetry.pushEvent) {
        SDP.Telemetry.pushEvent('troubleshoot', { action: '1-tap fix: ' + act, detail: type + ' → ' + result, appVersion: String(global.SDP && global.SDP.version || '') });
      }
    } catch (eTG) {}
    try {
      if (SDP.Diagnostics && SDP.Diagnostics.log) SDP.Diagnostics.log('selfheal_action', { type: type, action: act, result: result });
    } catch (e2) {}
  }

  /* T4 — long-frame lag monitor: 4 rAF deltas > 350 ms within 10 s on active screens. */
  function bindLagMonitor() {
    if (!global.requestAnimationFrame) return;
    var hits = [], firstAt = 0, lastT = 0;
    function tick(t) {
      var bm = byId('briefingModal'), gm = byId('guideModal');
      var modalBusy = (bm && !bm.hidden) || (gm && !gm.hidden) || (global.document && global.document.hidden);
      if (modalBusy) {
        hits = []; firstAt = 0; lastT = t;
      } else if (lastT && (t - lastT) > 350 && (t - lastT) < 5000) {
        if (!firstAt) firstAt = t;
        if (t - firstAt > 10000) { hits = []; firstAt = 0; }
        hits.push(t - lastT);
        if (hits.length >= 4) { show('T4', { lagMs: Math.round(hits[hits.length - 1]) }); hits = []; firstAt = 0; }
      }
      lastT = t;
      global.requestAnimationFrame(tick);
    }
    try { global.requestAnimationFrame(tick); } catch (e) {}
  }

  /* T6 — storage quota guard. */
  function bindStorageGuard() {
    try {
      var probe = '_sdp_quota_probe_' + Date.now();
      global.localStorage.setItem(probe, 'x'.repeat(64));
      global.localStorage.removeItem(probe);
    } catch (e) {
      show('T6', { lastErr: String(e && e.message || e) });
    }
  }

  /* T7 — extension interference heuristics. */
  function bindExtensionGuard() {
    try {
      var html = global.document.documentElement;
      var darkInjected = html && (html.getAttribute('data-darkreader-mode') || html.getAttribute('data-lightsite') ||
        (global.document.querySelector && global.document.querySelector('darkreader-style, style[data-dm]')));
      var translated = html && (html.getAttribute('class') || '').indexOf('translated') >= 0;
      if (darkInjected || translated) show('T7', { extension: darkInjected ? 'dark-mode' : 'translate' });
    } catch (e) {}
  }

  function boot() {
    ensureModal();
    /* v0.0.6.v: arm lag, storage, and extension probes AFTER the first-visit
       welcome + briefing flow (15 s) so the modal never intercepts the
       Project Briefing on a cold load. */
    global.setTimeout(function () { bindLagMonitor(); bindStorageGuard(); bindExtensionGuard(); }, 15000);
    /* T5 — SW version mismatch. */
    try {
      if (global.navigator && global.navigator.serviceWorker && global.navigator.serviceWorker.getRegistration) {
        global.navigator.serviceWorker.getRegistration().then(function (reg) {
          try {
            if (reg && reg.waiting) show('T5', {});
          } catch (e) {}
        }, function () {});
      }
    } catch (e) {}
  }

  /* ══ v0.0.7.b B7 — THE STUDENT TROUBLESHOOTING GUIDE (#sdpTroubleshootModal).
     A student-first, mobile-first contextual guide: four plain-language
     sections (offline & uncached clips · missing/corrupted clip · audio
     blocked · stale version) each with real 1-tap fixes. Bilingual by law:
     every section shows English AND Sinhala. Opened automatically by the
     SelfHeal triggers (T1/T2/T3 offer it) and manually from the Offline
     banner's Get Help button and the Feedback / Quick-Help drawer. ══ */
  var TS_COPY = {
    offline: {
      title: 'Offline — voice clips that are not cached cannot play',
      titleSi: 'ඕෆ්ලයින් — සුරැකා නැති හඬ පට වාදනය විය නොහැක',
      body: 'You are offline or have no mobile data. Words whose voice clips were saved earlier still play; new words need the internet. Reconnect Wi-Fi or mobile data, then tap Reload Voice Clips — the red offline banner clears itself the moment real internet returns.',
      bodySi: 'ඔබ ඕෆ්ලයින් ය, නැතිනම් මොබයිල් ඩේටා නැත. කලින් සුරැකි වචනවල හඬ පට වාදනය වේ; අලුත් වචනවලට අන්තර්ජාලය අවශ්‍ය ය. Wi-Fi හෝ ඩේටා නැවත සම්බන්ධ කර, Reload Voice Clips ඔබන්න — සැබෑ අන්තර්ජාලය ලැබුණු මොහොතේ රතු ඕෆ්ලයින් බැනරය තමන්ම අතුරුදන් වේ.',
      actions: [['reload', '🔄 Reload Voice Clips'], ['refresh', '↻ 1-Tap Refresh Page']]
    },
    missing: {
      title: 'A voice clip is missing or corrupted',
      titleSi: 'හඬ පටයක් මඟ හැරී ඇත හෝ හානි වී ඇත',
      body: "This word's audio was not generated or did not download correctly (it can also happen right after the lecturer adds new words). Tap Reload Voice Clips to re-download the pack, refresh the page, or Notify Lecturer so the missing word is regenerated in the unified British voice.",
      bodySi: "මෙම වචනයේ හඬ ජනනය වී නැත නැතිනම් බාගත වී නැත (ගුරුවරයා අලුත් වචන එක් කළ ගමන් ද සිදු විය හැක). පැකේජය නැවත බාගත කිරීමට Reload Voice Clips ඔබන්න, පිටුව refresh කරන්න, නැතිනම් නැවත ජනනය වන පිටිපත්තට Notify Lecturer ඔබන්න.",
      actions: [['reload', '🔄 Reload Voice Clips'], ['refresh', '↻ 1-Tap Refresh Page'], ['notify', '📢 Notify Lecturer']]
    },
    audio: {
      title: 'Sound is muted or blocked by the browser',
      titleSi: 'හඬ නිහඬ කර ඇත නැතිනම් බ්‍රව්සරය වහින් ඇත',
      body: "Mobile browsers block sound until you interact with the page. Check the phone's media volume (not just the ringtone), then tap Unlock Audio & Test Sound — you should hear the app's voice immediately.",
      bodySi: "ඔබ පිටුව සමඟ ක්‍රියා කරන තුරු ජංගම බ්‍රව්සර හඬ වහයි. දුරකථනයේ මීඩියා ශබ්දය (රිංටෝන් නොවේ) පරීක්ෂා කර, Unlock Audio & Test Sound ඔබන්න — යෙදුමේ හඬ ක්ෂණිකව ඇසෙයි.",
      actions: [['unlock', '🔊 Unlock Audio & Test Sound']]
    },
    stale: {
      title: 'You are on an old version / stale cache',
      titleSi: 'ඔබ පැරණි අනුවාදයක / පැරණි කෑශ් එකක සිටියි',
      body: 'Your copy of the app is older than the latest release. Tap Clear Cache & Refresh — one reload brings the newest words, voices and fixes. Your saved progress is never deleted.',
      bodySi: 'ඔබේ යෙදුම නවතම නිකුතුවට වඩා පැරණි ය. Clear Cache & Refresh ඔබන්න — එක් reload එකකින් අලුත්ම වචන, හඬ සහ නිවැරදි කිරීම් ලැබේ. ඔබේ සුරැකි ප්‍රගතිය කිසිවිටෙක මකා නොදැමේ.',
      actions: [['clearfull', '🧹 Clear Cache & Refresh to Latest Version']]
    }
  };
  var tsOrder = ['offline', 'missing', 'audio', 'stale'];

  function ensureTroubleshootModal() {
    var m = byId('sdpTroubleshootModal');
    if (m) return m;
    try {
      var div = global.document.createElement('div');
      div.id = 'sdpTroubleshootModal';
      div.className = 'modal selfheal-modal troubleshoot-modal';
      div.setAttribute('role', 'dialog');
      div.setAttribute('aria-modal', 'true');
      div.setAttribute('aria-labelledby', 'sdpTroubleshootTitle');
      div.setAttribute('aria-hidden', 'true');
      div.hidden = true;
      div.innerHTML = '<div class="modal-card selfheal-card ts-card">' +
        '<div class="modal-head"><h2 id="sdpTroubleshootTitle">🛠 Student Troubleshooting Guide · ගැටලු නිරාකරණ මාර්ගෝපදේශය</h2></div>' +
        '<div id="sdpTroubleshootBody" class="selfheal-body ts-body"></div>' +
        '<div class="modal-foot selfheal-foot"><button type="button" class="btn btn-go" data-ts-act="close">✓ Done</button></div>' +
        '</div>';
      (global.document.body || global.document.documentElement).appendChild(div);
      div.addEventListener('click', function (ev) {
        if (ev && ev.target === div) hideTroubleshoot();
      }, false);
      var done = div.querySelector('[data-ts-act="close"]');
      if (done) done.addEventListener('click', function () { hideTroubleshoot(); }, false);
      return div;
    } catch (e) { return null; }
  }
  function hideTroubleshoot() {
    var m = byId('sdpTroubleshootModal');
    if (!m) return false;
    m.hidden = true;
    m.setAttribute('aria-hidden', 'true');
    if (m.classList) m.classList.remove('is-open');
    return true;
  }
  function showTroubleshoot(section) {
    var m = ensureTroubleshootModal();
    if (!m) return false;
    var host = byId('sdpTroubleshootBody');
    if (!host) return false;
    /* v0.0.7.f Pillar 4: the guide-open event reaches the Lecturer. */
    try {
      if (global.SDP && SDP.Telemetry && SDP.Telemetry.pushEvent) {
        SDP.Telemetry.pushEvent('troubleshoot', { action: 'guide opened', detail: 'section ' + String(section || 'general'), appVersion: String(global.SDP && global.SDP.version || '') });
      }
    } catch (eTG) {}
    var html = '', i, k;
    for (i = 0; i < tsOrder.length; i++) {
      k = tsOrder[i];
      var c = TS_COPY[k];
      if (!c) continue;
      html += '<details class="ts-sec"' + (k === section ? ' open' : '') + '>' +
        '<summary>' + esc(c.title) + '<span class="ts-si" lang="si">' + esc(c.titleSi) + '</span></summary>' +
        '<p>' + esc(c.body) + '</p>' +
        '<p lang="si" class="ts-si-body">' + esc(c.bodySi) + '</p>' +
        '<div class="btnrow ts-actions">';
      for (var a = 0; a < c.actions.length; a++) {
        html += '<button type="button" class="btn ' + (a === 0 ? 'btn-go' : 'btn-ghost') + '" data-ts-act="' + esc(c.actions[a][0]) + '" data-ts-sec="' + esc(k) + '">' + esc(c.actions[a][1]) + '</button>';
      }
      html += '</div></details>';
    }
    host.innerHTML = html;
    var btns = host.getElementsByTagName('button');
    for (i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          tsRunAction(btn.getAttribute('data-ts-act') || '', btn.getAttribute('data-ts-sec') || '');
        }, false);
      })(btns[i]);
    }
    m.hidden = false;
    m.setAttribute('aria-hidden', 'false');
    if (m.classList) m.classList.add('is-open');
    try {
      if (SDP.Diagnostics && SDP.Diagnostics.log) SDP.Diagnostics.log('troubleshoot_show', { section: section || 'all' });
    } catch (eL) {}
    return true;
  }
  function unlockAudioTest() {
    var done = false;
    try {
      if (SDP.Speech && SDP.Speech.sayCue) { SDP.Speech.sayCue('cmd.preparing', function () {}); done = true; }
    } catch (e) {}
    if (!done) {
      try {
        var Ctx = global.AudioContext || global.webkitAudioContext;
        if (Ctx) {
          var ac = new Ctx();
          var osc = ac.createOscillator();
          var gain = ac.createGain();
          osc.connect(gain); gain.connect(ac.destination);
          gain.gain.value = 0.07; osc.frequency.value = 523.25;
          osc.start();
          global.setTimeout(function () { try { osc.stop(); ac.close(); } catch (e2) {} }, 420);
          done = true;
        }
      } catch (e3) {}
    }
    return done;
  }
  function clearCacheAndRefresh() {
    var reloadNow = function () { try { global.location.reload(); } catch (e) { global.location.href = global.location.href; } };
    try { global.sessionStorage.removeItem('sdp_upgraded_to'); } catch (eS) {}
    if (global.caches && global.caches.keys) {
      global.caches.keys().then(function (ks) {
        var outs = [], i;
        for (i = 0; i < ks.length; i++) {
          (function (k) {
            if (String(k).indexOf('sdp-') === 0 && k !== 'sdp-youdao-v1' && k !== 'sdp-audio-clips') outs.push(global.caches.delete(k));
          })(ks[i]);
        }
        if (outs.length && global.Promise && global.Promise.all) global.Promise.all(outs).then(reloadNow, reloadNow);
        else reloadNow();
      }, reloadNow);
    } else reloadNow();
    return true;
  }
  function notifyLecturer(section) {
    try {
      if (SDP.Telemetry && SDP.Telemetry.sendLecturerAlert) {
        SDP.Telemetry.sendLecturerAlert({
          alertType: 'user_message',
          message: 'Student opened the Troubleshooting Guide (section: ' + String(section || 'general') + ') and asked for help with voice clips.'
        });
        return true;
      }
    } catch (e) {}
    return false;
  }
  function tsRunAction(act, section) {
    var result = 'ok';
    try {
      if (act === 'reload') {
        runAction('reload', 'T1', {});
        result = 'reloading_clips';
      } else if (act === 'refresh') {
        global.location.reload();
        result = 'reloading';
      } else if (act === 'notify') {
        notifyLecturer(section);
        result = 'lecturer_notified';
      } else if (act === 'unlock') {
        result = unlockAudioTest() ? 'audio_unlocked' : 'no_audio_api';
      } else if (act === 'troubleshoot') {
        hide();
        showTroubleshoot(detail && detail.section ? detail.section : (type === 'T5' ? 'stale' : 'missing'));
        result = 'troubleshoot_opened';
      } else if (act === 'clearfull') {
        clearCacheAndRefresh();
        result = 'cache_cleared_reloading';
      } else {
        hideTroubleshoot();
        result = 'closed';
      }
    } catch (e) { result = 'error'; }
    try {
      if (SDP.Diagnostics && SDP.Diagnostics.log) SDP.Diagnostics.log('troubleshoot_action', { section: section, action: act, result: result });
    } catch (e2) {}
    return true;
  }

  SDP.SelfHeal = {
    version: '1.1.0',
    show: show,
    hide: hide,
    triggers: COPY,
    boot: boot,
    rearm: function (type) { armed[type] = true; },
    /* v0.0.7.b B7: the Student Troubleshooting Guide. */
    showTroubleshoot: showTroubleshoot,
    hideTroubleshoot: hideTroubleshoot,
    unlockAudioTest: unlockAudioTest,
    clearCacheAndRefresh: clearCacheAndRefresh
  };

  try {
    if (global.document && global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { boot(); }, false);
    } else { boot(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
