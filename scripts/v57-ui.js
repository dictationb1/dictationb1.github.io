/* v57 / 6.3.0 P1-P3 UI + voice wiring. Injected inside the app closure. ES5 only. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function $(s) { return doc.querySelector(s); }
  function money(v) { return (DB.data.settings.lang === 'si' ? 'රු. ' : 'Rs. ') + (Number(v) || 0).toFixed(2); }
  function clamp(v, a, b) { v = Number(v); if (!isFinite(v)) v = a; return v < a ? a : v > b ? b : v; }
  function conn() { return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null; }
  function lowData() { var c = conn(); return !!(c && (c.saveData || /(^|-)2g$|slow-2g|3g/i.test(String(c.effectiveType || '')))); }
  function canNet() { try { return !(window.__SDP_QA__ || /HeadlessChrome|jsdom/i.test(navigator.userAgent) || location.protocol === 'file:'); } catch (e) { return false; } }

  /* ---------- readability / phone layout ---------- */
  var css = el('style'); css.id = 'sdpV57Css';
  css.textContent = [
    ':root{--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans Sinhala","Iskoola Pota",Helvetica,Arial,sans-serif;--tap:44px}',
    'body,input,select,textarea,button{font-family:var(--font)}',
    '.sheet,.modal,.card,.wordcard{background:rgba(10,14,24,.94)!important}',
    '[data-theme="light"] .sheet,[data-theme="light"] .modal,[data-theme="light"] .card,[data-theme="light"] .wordcard{background:rgba(255,255,255,.95)!important}',
    '.muted,.tiny,.small.secondary,.lbl{opacity:.86}',
    'body[data-perf="lite"] *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    'button,.btn,.ibtn,.tab,.chip,select,input[type=checkbox]+span{min-height:44px}',
    '.tiny{font-size:11px!important}',
    '#credit,.hero-credit,#brandSub,.credit-cycle{display:none!important}',
    '#topOverflow{position:relative}#topOverflow>summary{list-style:none;cursor:pointer;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px}',
    '#topOverflow>summary::-webkit-details-marker{display:none}',
    '#topOverflow .overflow-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:80;display:grid;gap:8px;padding:10px;min-width:210px;background:rgba(10,14,24,.97);border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.45)}',
    '#contrastReadout{font-size:12px;margin-top:6px}#contrastReadout.warn{color:var(--warn,#ffb020)}',
    '.sdp-retry-toast{position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:120;display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:14px;background:rgba(20,24,36,.97);border:1px solid rgba(255,255,255,.18);color:#fff}',
    '.sdp-radar{width:100%;max-width:320px;height:220px;margin:8px auto;display:block}',
    '@media (max-width:640px){.topbar{padding-top:calc(6px + env(safe-area-inset-top,0px))}.app,#app{padding-top:calc(64px + env(safe-area-inset-top,0px))}#brandName{font-size:13px;letter-spacing:.08em}#brandName em{display:none}.top-controls{gap:6px}.top-controls .chip{font-size:11px;padding:6px 8px}#tabbar{bottom:calc(6px + env(safe-area-inset-bottom,0px))}}',
    '.seg[role="group"] button[aria-pressed]{min-width:44px}',
    '#pasteHelper{position:sticky;bottom:0;display:block;padding:8px 10px;margin-top:8px;border-radius:10px;background:rgba(92,208,244,.12);font-size:12px}'
  ].join('\n');
  (doc.head || root).appendChild(css);

  /* ---------- static-first wallpaper + real contrast ---------- */
  var manifestAssets = null;
  function loadManifest(cb) {
    if (manifestAssets) return cb(manifestAssets);
    try {
      var cached = localStorage.getItem('sdp.mediaManifest.v1');
      if (cached) { manifestAssets = JSON.parse(cached); return cb(manifestAssets); }
    } catch (e) {}
    if (!canNet() || !window.fetch) return cb(null);
    fetch('./data/media-manifest.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      manifestAssets = j; try { localStorage.setItem('sdp.mediaManifest.v1', JSON.stringify(j)); } catch (e) {}
      cb(j);
    }).catch(function () { cb(null); });
  }
  function assetBytes(src) {
    var m = manifestAssets && manifestAssets.assets || [], i;
    for (i = 0; i < m.length; i++) if (m[i].src === src || ('./' + m[i].src) === src) return Number(m[i].bytes) || 0;
    return 0;
  }
  LiveWallpaper.applyStatic = function () {
    this.activeType = 'static'; this.enabled = false; this.playlistMode = 'off';
    try { if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); this.video.style.opacity = '0'; } } catch (e) {}
    try { if (this.photo) this.photo.style.opacity = '0'; } catch (e) {}
    if (doc.body) { U.setCls(doc.body, 'wallpaper-on', false); U.setCls(doc.body, 'photo-mode', false); doc.body.setAttribute('data-wallpaper', 'static'); }
    this.showState && this.showState(); this.renderControls && this.renderControls();
  };
  LiveWallpaper.setStatic = function (save) {
    DB.data.settings.wallpaperMode = 'static'; DB.data.settings.wallpaperVideo = false; DB.data.settings.videoPlaylistMode = 'off'; DB.data.settings.activeMediaType = 'static';
    if (save !== false) DB.save();
    this.applyStatic(); paintContrast();
  };
  var origApplyActive = LiveWallpaper.applyActive;
  LiveWallpaper.applyActive = function () { if (this.activeType === 'static' || DB.data.settings.wallpaperMode === 'static') return this.applyStatic(); return origApplyActive.apply(this, arguments); };
  var origSelectMedia = LiveWallpaper.selectMedia;
  LiveWallpaper.selectMedia = function (src, opts) { DB.data.settings.wallpaperMode = 'video'; DB.data.settings.wallpaperVideo = true; this.enabled = true; this.playlistMode = DB.data.settings.videoPlaylistMode || 'loop'; var r = origSelectMedia.apply(this, arguments); paintContrast(); return r; };

  function luminance(dim) { var base = 0.22; return base * (1 - clamp(dim, 0, 100) / 100); }
  function contrastRatio(dim) { var L = luminance(dim); return (1.0 + 0.05) / (L + 0.05); }
  function paintContrast() {
    var dim = LiveWallpaper.dimValue ? LiveWallpaper.dimValue() : 18, ratio = contrastRatio(dim), node = $('#contrastReadout');
    if (!node) {
      var host = $('#dimHostSet') || $('#dimHostSheet');
      if (host) { node = el('p', 'small'); node.id = 'contrastReadout'; node.setAttribute('role', 'status'); host.appendChild(node); }
    }
    if (node) {
      node.textContent = 'WCAG contrast ' + ratio.toFixed(2) + ':1 · dim ' + dim + '%' + (ratio < 4.5 ? ' — warning: below 4.5:1' : ' — readable');
      node.className = 'small' + (ratio < 4.5 ? ' warn' : '');
    }
  }
  var origSetDim = LiveWallpaper.setDim;
  LiveWallpaper.setDim = function (v, silent) { var r = origSetDim.call(this, clamp(v, 0, 100), silent); paintContrast(); return r; };

  LiveWallpaper.openGallerySheet = function () {
    var self = this;
    loadManifest(function () {
      UI.sheet({
        title: 'Wallpaper gallery — opt-in downloads',
        body: function (body) {
          body.appendChild(el('p', 'small muted', 'Static Gradient is the default and uses 0 MB of video. Previewing or applying a video downloads the exact file size shown. Save Data / 2G / 3G immediately returns to Static.'));
          var staticBtn = el('button', 'btn primary', 'Static Gradient · 0 MB'); staticBtn.type = 'button'; staticBtn.id = 'btnStaticWallpaper';
          staticBtn.addEventListener('click', function () { self.setStatic(true); UI.toast('Static Gradient active · 0 MB video'); });
          body.appendChild(staticBtn);
          var list = el('div', 'video-gallery-list'); list.id = 'videoGalleryList';
          var media = self.baseMedia ? self.baseMedia() : [], i;
          for (i = 0; i < media.length; i++) (function (m) {
            var bytes = assetBytes(m.src) || Number(m.bytes) || 0, mb = (bytes / 1048576).toFixed(2);
            var row = el('div', 'video-gallery-item'); row.appendChild(el('b', 'gal-title', m.title || m.src));
            row.appendChild(el('span', 'gal-kind tiny muted', (m.type === 'image' ? 'Photo' : 'Video') + ' · ' + mb + ' MB (' + bytes.toLocaleString() + ' bytes)'));
            var apply = el('button', 'btn sm soft', 'Apply Wallpaper'); apply.type = 'button'; apply.setAttribute('data-gallery-select', m.src);
            apply.addEventListener('click', function () { if (lowData()) { self.setStatic(true); UI.toast('Save Data / slow network: staying on Static Gradient.'); return; } self.selectMedia(m.src, { type: m.type }); self.renderGalleryList && self.renderGalleryList(); });
            row.appendChild(apply); list.appendChild(row);
          })(media[i]);
          body.appendChild(list);
          var dimHost = el('div', 'dim-host'); dimHost.id = 'dimHostSheet'; dimHost.appendChild(self.dimControl()); body.appendChild(dimHost); paintContrast();
        }
      });
    });
  };

  /* ---------- voice: GainNode volume, committed clips, cache, presets ---------- */
  Speech._gain = null; Speech._compressor = null;
  Speech.ensureGain = function () {
    if (this._gain || !canNet()) return this._gain;
    try {
      var AC = window.AudioContext || window.webkitAudioContext, audio = this.master();
      if (!AC || !audio || audio.__sdpSource) return null;
      var ctx = new AC(), src = ctx.createMediaElementSource(audio), comp = ctx.createDynamicsCompressor(), gain = ctx.createGain();
      comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      src.connect(comp); comp.connect(gain); gain.connect(ctx.destination);
      audio.__sdpSource = src; this._audioCtx = ctx; this._compressor = comp; this._gain = gain; this.applyVolume();
    } catch (e) { this._gain = null; }
    return this._gain;
  };
  Speech.applyVolume = function () {
    var v = clamp(DB.data.settings.volume, 0, 1), audio = this.master();
    try { if (this._gain) { this._gain.gain.value = v; audio.volume = 1; } else audio.volume = v; } catch (e) {}
    return v;
  };
  var origUnlock = Speech.unlock;
  Speech.unlock = function () { var r = origUnlock.apply(this, arguments); this.ensureGain(); this.applyVolume(); return r; };

  var committed = {};
  function loadCommitted() {
    if (!canNet() || !window.fetch) return;
    fetch('./data/elevenlabs-audio.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { committed = j && j.clips || {}; }).catch(function () {});
  }
  function clipKey(text) { return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function resolveClip(text, cb) {
    var k = clipKey(text), c = committed[k];
    if (c && (c.dataUrl || c.url || c.base64)) return cb(c.dataUrl || c.url || ('data:audio/mpeg;base64,' + c.base64));
    if (window.ElevenVault && window.ElevenVault.resolve) {
      try { window.ElevenVault.resolve(text, function (err, url) { cb(!err && url ? url : null); }); return; } catch (e) {}
    }
    cb(null);
  }
  var origPlayWord = Speech.playWord;
  Speech.playWord = function (word, rate, cb) {
    var self = this, token = this._seqToken;
    resolveClip(word, function (url) {
      if (token !== self._seqToken) return;
      if (url) self._playUrl(url, self.cleanWordOnly(word), 'en', token, cb, rate || self.desiredRate || 1);
      else origPlayWord.call(self, word, rate, cb);
    });
    return token;
  };
  var origPlayText = Speech._playText;
  Speech._playText = function (text, lang, token, cb, rate) {
    var self = this;
    if (lang !== 'si' && /^number\s+\d+/i.test(String(text || ''))) {
      resolveClip(text, function (url) {
        if (token !== self._seqToken) return;
        if (url) self._playUrl(url, text, 'en', token, cb, rate || 1);
        else origPlayText.call(self, text, lang, token, cb, rate);
      });
      return;
    }
    return origPlayText.apply(this, arguments);
  };
  Speech.showRetryToast = function (text, lang, rate) {
    var old = $('.sdp-retry-toast'); if (old && old.parentNode) old.parentNode.removeChild(old);
    var box = el('div', 'sdp-retry-toast'); box.setAttribute('role', 'alert');
    box.appendChild(el('span', 'small', 'Audio failed — tap Retry / ශ්‍රව්‍යය අසාර්ථකයි — නැවත උත්සාහ කරන්න'));
    var btn = el('button', 'btn sm primary', 'Retry'); btn.type = 'button';
    btn.addEventListener('click', function () { if (box.parentNode) box.parentNode.removeChild(box); Speech.speakStudioText(text || '', lang || 'en', function () {}); });
    box.appendChild(btn); doc.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 8000);
  };

  /* durable Youdao cache + prewarm */
  var origPlayUrl = Speech._playUrl;
  Speech._playUrl = function (url, text, lang, token, cb, rate, fallback) {
    var self = this, u = String(url || '');
    if (!/dict\.youdao\.com/i.test(u) || !canNet() || !window.caches || lowData()) return origPlayUrl.apply(this, arguments);
    caches.open('sdp-youdao-v1').then(function (cache) {
      return cache.match(u).then(function (hit) {
        if (hit) return hit.blob().then(function (b) { origPlayUrl.call(self, URL.createObjectURL(b), text, lang, token, cb, rate, fallback); });
        return fetch(u, { mode: 'no-cors', referrerPolicy: 'no-referrer' }).then(function (r) {
          try { cache.put(u, r.clone()); } catch (e) {}
          return r.blob ? r.blob() : null;
        }).then(function (b) { if (b && b.size) origPlayUrl.call(self, URL.createObjectURL(b), text, lang, token, cb, rate, fallback); else origPlayUrl.apply(self, [url, text, lang, token, cb, rate, fallback]); });
      });
    }).catch(function () { origPlayUrl.apply(self, [url, text, lang, token, cb, rate, fallback]); });
  };
  Speech.prewarmYoudao = function (words) {
    if (!canNet() || !window.caches || lowData() || !words || !words.length) return;
    caches.open('sdp-youdao-v1').then(function (cache) {
      var i, url;
      for (i = 0; i < Math.min(words.length, 30); i++) {
        url = 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(String(words[i].w || words[i].word || words[i]));
        (function (u) { cache.match(u).then(function (hit) { if (!hit) fetch(u, { mode: 'no-cors', referrerPolicy: 'no-referrer' }).then(function (r) { try { cache.put(u, r.clone()); } catch (e) {} }).catch(function () {}); }); })(url);
      }
    }).catch(function () {});
  };

  /* settings: bitrate + voice presets + paste helper */
  var origSettings = Screens.settings;
  Screens.settings = function () {
    var r = origSettings.apply(this, arguments), host = $('#screen-set'), voiceCard, sel, presets, i, helper;
    if (!host) return r;
    voiceCard = host.querySelector('#rateRange'); voiceCard = voiceCard ? voiceCard.closest('.card, .glass, section, div') : null;
    var anchor = host.querySelector('#volRange'); if (anchor && anchor.parentNode) {
      sel = el('select'); sel.id = 'bitrateSelect'; sel.setAttribute('aria-label', 'Audio bitrate');
      [['192', '192 kbps — best quality'], ['128', '128 kbps — balanced'], ['64', '64 kbps — saves data']].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; sel.appendChild(op); });
      sel.value = String(DB.data.settings.audioBitrate || 128);
      sel.addEventListener('change', function () { DB.data.settings.audioBitrate = Number(sel.value); DB.save(); });
      anchor.parentNode.appendChild(el('label', 'lbl', 'Audio bitrate')); anchor.parentNode.appendChild(sel);
      presets = el('div', 'btn-row tight'); presets.id = 'voicePresets';
      [['Natural', 'natural'], ['Slow & clear', 'slow'], ['Exam', 'exam']].forEach(function (p) {
        var b = el('button', 'btn sm soft', p[0]); b.type = 'button'; b.setAttribute('data-voice-preset', p[1]);
        b.addEventListener('click', function () {
          DB.data.settings.voicePreset = p[1];
          DB.data.settings.rate = p[1] === 'slow' ? 0.7 : p[1] === 'exam' ? 0.85 : 0.96;
          DB.data.settings.repeats = p[1] === 'exam' ? 3 : 2; DB.save(); Screens.settings();
        });
        presets.appendChild(b);
      });
      anchor.parentNode.appendChild(presets);
    }
    if (!host.querySelector('#repeatsSelect')) {
      var rs = el('select'); rs.id = 'repeatsSelect'; rs.setAttribute('aria-label', 'Word repeats');
      [['1','Once'],['2','Twice'],['3','Three times']].forEach(function(o){var op=el('option',null,o[1]);op.value=o[0];rs.appendChild(op);});
      rs.value = String(DB.data.settings.repeats || 2);
      rs.addEventListener('change', function(){ DB.data.settings.repeats = clamp(rs.value,1,3); DB.save(); });
      var dictCard = host.querySelector('#writeSecsRange'); dictCard = dictCard ? dictCard.parentNode : host;
      dictCard.appendChild(el('label','lbl','Word repeats')); dictCard.appendChild(rs);
    }
    helper = $('#pasteHelper');
    if (!helper) { helper = el('p', 'tiny muted'); helper.id = 'pasteHelper'; helper.textContent = 'Paste blocked? Tap and hold the word box, then choose Paste. / අලවන්න බැරි නම් වචන කොටුව අල්ලාගෙන Paste තෝරන්න.'; host.appendChild(helper); }
    paintContrast();
    return r;
  };

  /* ---------- header: language + live data + overflow ---------- */
  function buildHeader() {
    var controls = $('.top-controls'); if (!controls || $('#topOverflow')) return;
    var overflow = el('details', 'top-overflow'); overflow.id = 'topOverflow';
    var sum = el('summary', 'btn icon ghost', '⋯'); sum.setAttribute('aria-label', 'More controls'); overflow.appendChild(sum);
    var menu = el('div', 'overflow-menu');
    ['btnLiveVideo', 'chipNet', 'btnGuideTop', 'btnPerf', 'btnTheme', 'btnRefresh', 'btnAdmin'].forEach(function (id) {
      var n = doc.getElementById(id); if (n) menu.appendChild(n);
    });
    overflow.appendChild(menu); controls.appendChild(overflow);
    var dataBtn = doc.getElementById('topDataBadge'); if (dataBtn) { dataBtn.id = 'topDataBadge'; dataBtn.setAttribute('aria-label', 'Open live data sheet'); }
  }

  /* ---------- publish preview ---------- */
  function currentWords() {
    try { var p = Cloud.repoPayload(); return (p.session && p.session.words || []).map(function (w) { return typeof w === 'string' ? w : w.w || w.word || ''; }); } catch (e) { return []; }
  }
  function openPublishPreview(cb) {
    var words = currentWords(), ta, count;
    UI.sheet({
      title: 'Confirm publish — edit the 30 words first',
      body: function (body) {
        body.appendChild(el('p', 'small muted', 'Students receive exactly what is below. Edit, add or remove lines, then confirm. Nothing is published until you press Confirm.'));
        ta = el('textarea'); ta.id = 'publishPreviewWords'; ta.rows = 14; ta.value = words.join('\n'); ta.setAttribute('aria-label', 'Editable publish preview words');
        count = el('p', 'small'); count.id = 'publishPreviewCount'; body.appendChild(ta); body.appendChild(count);
        function paint() { var n = ta.value.split(/\n+/).filter(function (x) { return x.trim(); }).length; count.textContent = n + ' words' + (n === 30 ? ' ✓' : ' — expected 30'); }
        ta.addEventListener('input', paint); paint();
        var row = el('div', 'btn-row'); var ok = el('button', 'btn primary', 'Confirm publish'); ok.type = 'button'; ok.id = 'btnConfirmPublish';
        var cancel = el('button', 'btn soft', 'Cancel'); cancel.type = 'button';
        ok.addEventListener('click', function () {
          var list = ta.value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
          if (!list.length) { UI.toast('Add at least one word.'); return; }
          try {
            var payload = Cloud.repoPayload(), target = DB.data.lists && DB.data.lists[0], i;
            if (target) { target.words = list.map(function (w) { return { w: w, s: '', m: '' }; }); DB.saveNow(); }
          } catch (e) {}
          ta.__confirmed = true; UI.closeSheet(); cb(list);
        });
        cancel.addEventListener('click', function () { UI.closeSheet(); cb(null); });
        row.appendChild(ok); row.appendChild(cancel); body.appendChild(row);
      },
      onClose: function () { if (ta && !ta.__confirmed) cb(null); }
    });
  }
  window.SDPPublishPreview = openPublishPreview;
  var origGhPublish = Cloud.ghPublish;
  Cloud.ghPublish = function (cb) {
    if (!Admin.isUnlockedOnThisDevice || !Admin.isUnlockedOnThisDevice()) return cb && cb({ ok: false, err: 'Lecturer unlock required.' });
    openPublishPreview(function (list) { if (!list) return cb && cb({ ok: false, err: 'Publish cancelled.' }); Cloud.__sdpPreviewDone = true; origGhPublish.call(Cloud, function (r) { Cloud.__sdpPreviewDone = false; cb && cb(r); }); });
  };

  /* ---------- results: anonymous missed words + lecturer radar/CSV ---------- */
  function weaknessRows(result) {
    var rows = result.rows || [], buckets = {}, i, r, key;
    for (i = 0; i < rows.length; i++) {
      r = rows[i]; key = String(r.word || r.w || '?').charAt(0).toLowerCase();
      if (!buckets[key]) buckets[key] = { total: 0, wrong: 0 };
      buckets[key].total++; if (r.state && r.state !== 'ok') buckets[key].wrong++;
    }
    return Object.keys(buckets).sort().map(function (k) { return { label: k.toUpperCase(), total: buckets[k].total, wrong: buckets[k].wrong, pct: buckets[k].total ? Math.round(100 * buckets[k].wrong / buckets[k].total) : 0 }; });
  }
  function drawRadar(canvas, rows) {
    var ctx = canvas.getContext && canvas.getContext('2d'); if (!ctx || !rows.length) return;
    var w = canvas.width = 320, h = canvas.height = 220, cx = w / 2, cy = h / 2 + 8, R = 78, n = rows.length, i, a;
    ctx.clearRect(0, 0, w, h); ctx.strokeStyle = 'rgba(140,160,200,.5)'; ctx.fillStyle = 'rgba(92,208,244,.25)';
    for (i = 1; i <= 4; i++) { ctx.beginPath(); for (var j = 0; j <= n; j++) { a = -Math.PI / 2 + 2 * Math.PI * (j % n) / n; var rr = R * i / 4; ctx[j ? 'lineTo' : 'moveTo'](cx + rr * Math.cos(a), cy + rr * Math.sin(a)); } ctx.stroke(); }
    ctx.beginPath();
    for (i = 0; i <= n; i++) { a = -Math.PI / 2 + 2 * Math.PI * (i % n) / n; var v = R * (rows[i % n].pct / 100); ctx[i ? 'lineTo' : 'moveTo'](cx + v * Math.cos(a), cy + v * Math.sin(a)); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#cfe3ff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    for (i = 0; i < n; i++) { a = -Math.PI / 2 + 2 * Math.PI * i / n; ctx.fillText(rows[i].label + ' ' + rows[i].pct + '%', cx + (R + 18) * Math.cos(a), cy + (R + 18) * Math.sin(a)); }
  }
  var origResultsOpen = Results.open;
  Results.open = function (result, a, b) {
    var r = origResultsOpen.apply(this, arguments);
    try {
      var layer = UI.topLayer && UI.topLayer(), body = layer && layer.querySelector('.layer-body, .body, .sheet-body') || layer;
      if (body && !body.querySelector('#lecturerWeakness')) {
        var panel = el('div', 'card pad-s'); panel.id = 'lecturerWeakness';
        var missed = (result.rows || []).filter(function (x) { return x.state && x.state !== 'ok'; }).map(function (x) { return x.word || x.w; });
        panel.appendChild(el('h3', null, 'Missed words (anonymous)'));
        panel.appendChild(el('p', 'small', 'Overall error rate: ' + Math.round(100 * missed.length / ((result.rows || []).length || 1)) + '%'));
        panel.appendChild(el('p', 'small', missed.length ? missed.join(', ') : 'None — well done.'));
        if (Admin.isUnlockedOnThisDevice && Admin.isUnlockedOnThisDevice()) {
          var rows = weaknessRows(result), canvas = el('canvas', 'sdp-radar'); canvas.id = 'weaknessRadar';
          panel.appendChild(el('h3', null, 'Lecturer weakness radar — error %')); panel.appendChild(canvas);
          var table = el('div', 'stack'); rows.forEach(function (x) { table.appendChild(el('p', 'tiny', x.label + ': ' + x.wrong + '/' + x.total + ' errors (' + x.pct + '%)')); });
          panel.appendChild(table);
          var csv = el('button', 'btn sm soft', 'Export CSV'); csv.type = 'button'; csv.id = 'btnExportWeaknessCsv';
          csv.addEventListener('click', function () {
            var text = 'letter,total,errors,error_percent\n' + rows.map(function (x) { return [x.label, x.total, x.wrong, x.pct].join(','); }).join('\n');
            var blob = new Blob([text], { type: 'text/csv' }), url = URL.createObjectURL(blob), link = el('a'); link.href = url; link.download = 'weakness.csv'; doc.body.appendChild(link); link.click(); setTimeout(function () { URL.revokeObjectURL(url); link.remove(); }, 500);
          });
          panel.appendChild(csv); body.appendChild(panel);
          setTimeout(function () { drawRadar(canvas, rows); }, 30);
        }
      }
    } catch (e) {}
    return r;
  };

  /* ---------- boot wiring ---------- */
  function afterBoot() {
    buildHeader(); loadCommitted(); paintContrast();
    if (!DB.data.settings.wallpaperMode) DB.data.settings.wallpaperMode = 'static';
    if (DB.data.settings.wallpaperMode === 'static' || lowData()) LiveWallpaper.setStatic(false);
    var c = conn(); if (c && c.addEventListener) c.addEventListener('change', function () { if (lowData()) LiveWallpaper.setStatic(false); });
    if (UI.showCreditNow) UI.showCreditNow = function () {};
    try { var list = DB.data.lists && DB.data.lists[0]; if (list && list.words) Speech.prewarmYoudao(list.words); } catch (e) {}
    var footer = $('#staticFooter');
    if (!footer) { footer = el('footer', 'tiny muted center'); footer.id = 'staticFooter'; footer.style.padding = '18px 12px calc(90px + env(safe-area-inset-bottom,0px))'; footer.textContent = 'Smart Dictation Player v57 · Created by Hansana · Idea by Ayya01 (Lesandu) · Lecturer: Sumodya Sewmini'; (doc.getElementById('app') || doc.body).appendChild(footer); }
  }
  var prevBoot = boot;
  boot = function () { var r = prevBoot.apply(this, arguments); try { afterBoot(); } catch (e) {} return r; };
})();
