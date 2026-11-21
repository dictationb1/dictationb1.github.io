/*! data/sdp-studio-guide.js — v1.0.0 (v0.0.7.e)
 * The Interactive Animated Lecturer Studio Guide (strict ES5). Exposed as
 * window.SDP.StudioGuide. A playable spotlight walkthrough — NOT a static
 * document: one target button/card at a time, a smooth glowing ring + shade,
 * a floating tooltip card that scrolls smoothly to each element, Continue →,
 * ← Back, Step X of Y and Exit Tour controls, and two dedicated modes
 * (Simple = daily lecturer tour, Advanced = full admin tour). Defaults to
 * English and switches to natural Sinhala the moment the top EN|SI language
 * switcher changes (body[data-lang]). The auto-prompt law: whenever a new
 * release unlocks the Studio and sdp.settings.studioGuideSeenVersion (the
 * five-key law) does not match SDP.version, a clean welcome card offers
 * Simple Guide / Advanced Guide / Maybe later.
 * contract: docs/ARCHITECTURE_MAP.md §Studio Guide (v0.0.7.b B5). */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;

  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function byId(id) { return doc.getElementById ? doc.getElementById(id) : null; }
  function t(key, fallback) {
    try { if (SDP.Views && SDP.Views.t) return SDP.Views.t(key, fallback); } catch (e) {}
    return fallback === undefined ? key : fallback;
  }
  function isSi() {
    try { return str(doc.body.getAttribute('data-lang')) === 'si'; } catch (e) { return false; }
  }
  function L(en, si) { return isSi() ? si : en; }

  function settings() {
    try { return SDP.Data && SDP.Data.settings ? (SDP.Data.settings() || {}) : {}; } catch (e) { return {}; }
  }
  function saveSettings(patch) {
    try { if (SDP.Data && SDP.Data.saveSettings) SDP.Data.saveSettings(patch); } catch (e) {}
  }

  /* ── The two tour modes ────────────────────────────────────────────────
     target: a CSS selector string resolved against the LIVE studio DOM.
     drawer: a <details> id that must be forced open for the target to be
             visible (the tour opens it; nothing is ever collapsed back
             behind the lecturer's back). */
  var SIMPLE_STEPS = [
    { target: '#studioSecurityBar', drawer: null,
      title: ['Your command bar', 'ඔබේ විධාන තීරුව'],
      body: ['Welcome! This bar is always at the top of Lecturer Admin Studio. 🔴 Publish, Sync &amp; Leave saves everything to GitHub and LOCKS the Studio safely. 🔒 Lock does the same without publishing.',
             'සාදරයෙන් පිළිගනිමු! මෙම තීරුව සැමවිටම කථිකාචාර්ය පරිපාලක ස්ටූඩියෝව මුදුනේ ඇත. 🔴 Publish, Sync &amp; Leave සියල්ල GitHub වෙත සුරැකූ පසු ස්ටූඩියෝව අගුලු ලයි. 🔒 Lock පළ නොකර අගුලු ලයි.'] },
    { target: '#studioCardWords', drawer: null,
      title: ['1 · Type or paste your dictation words', '1 · ඩික්ටේෂන් වචන ලියන්න හෝ පේස්ට් කරන්න'],
      body: ['This is the Words card. Type one word per line, or tap Paste to load a whole list. Confirm Words applies them to the session. Every word gets its British pronunciation, meaning and Sinhala gloss automatically.',
             'මෙය වචන කාඩ්පතයි. එක් පේළියකට එක් වචනය බැගින් ලියන්න, නැතිනම් Paste ඔබලා ලැයිස්තුවක් පූරණය කරන්න. Confirm Words වචන සැසියට යොදයි. සෑම වචනයකටම බ්‍රිතාන්‍ය උච්චාරණය, තේරුම සහ සිංහල අර්ථය ස්වයංක්‍රීයව ලැබේ.'] },
    { target: '#studioCount', drawer: null,
      title: ['2 · Set the word count', '2 · වචන ගණන සකසන්න'],
      body: ['Choose a preset (5–30) or Custom for any number — 31, 55, unlimited. The count persists across lock, unlock and reload, and published sessions follow it exactly.',
             'පෙර සකසන (5–30) තෝරන්න නැතිනම් Custom මගින් ඕනෑම ගණනක් — 31, 55, කිසිදු සීමාවක් නැත. ගණන අගුලු ලෑමේදී, විවෘත කිරීමේදී සහ නැවත පූරණයේදී එලෙසම රැඳේ.'] },
    { target: '#studioSessionMetaCard', drawer: null,
      title: ['3 · Session number, date & topic', '3 · සැසි අංකය, දිනය සහ මාතෘකාව'],
      body: ['Use − and +1 Next Session to set the number — the date and day stay in sync automatically. Type any Session Topic you like, then ✅ Apply Session Metadata.',
             '− සහ +1 Next Session මගින් අංකය සකසන්න — දිනය සහ දවස ස්වයංක්‍රීයව සමමුහූර්ත වේ. කැමති මාතෘකාවක් ලියා ✅ Apply Session Metadata ඔබන්න.'] },
    { target: '#btnGenClips', drawer: null,
      title: ['4 · Generate the missing voice clips', '4 · මඟ හැරුණු හඬ පට ජනනය කරන්න'],
      body: ['⚡ Generate Missing Voice Clips creates every word that is not ready yet — in the ONE unified British voice (Alice), using your ElevenLabs key pool with automatic failover. The ♻️ counter shows how many words reuse saved clips at 0 credits.',
             '⚡ Generate Missing Voice Clips තවම සූදානම් නැති සෑම වචනයක්ම — එකම බ්‍රිතාන්‍ය හඬෙන් (Alice), ඔබේ ElevenLabs යතුරු තටාකයෙන් ස්වයංක්‍රීය අතිරික්තය මගින් — ජනනය කරයි. ♻️ කවුසරය ශුන්‍ය ණයට නැවත භාවිත වන වචන ගණන පෙන්වයි.'] },
    { target: '#btnSsbPublish', drawer: null,
      title: ['5 · Publish, Sync &amp; Leave', '5 · පළ කර, සමමුහූර්ත කර පිටවන්න'],
      body: ['One click publishes the words, the voice pack and the session data to GitHub, verifies success, releases the classroom dictation lock, LOCKS the Studio and returns you to the main app — students get everything instantly.',
             'එක් ක්ලික් එකකින් වචන, හඬ පැකේජය සහ සැසි දත්ත GitHub වෙත පළ වී, සාර්ථකව තහවුරු වී, පන්ති ඩික්ටේෂන් අගුල නිදහස් වී, ස්ටූඩියෝව අගුලු ලා ඔබට ප්‍රධාන යෙදුමට ආපසු යයි — ශිෂ්‍යයන්ට සියල්ල ක්ෂණිකව ලැබේ.'] },
    { target: '#btnSsbLock', drawer: null,
      title: ['6 · Manual lock & the 10-second rule', '6 · අතින් අගුල සහ තත්පර 10 නීතිය'],
      body: ['🔒 Lock closes the Studio at any time. If you walk away without locking, the Studio locks ITSELF after a visible 10-second countdown — students can never reach an unlocked Studio.',
             '🔒 Lock ඕනෑම වෙලාවක ස්ටූඩියෝව වසයි. අගුලු නොලා ඔබ ඉවත් වුවහොත්, දෘශ්‍යමාන තත්පර 10ක ගණන් කිරීමකින් පසු ස්ටූඩියෝව තමන්ම අගුලු ලයි — ශිෂ්‍යයන්ට විවෘත ස්ටූඩියෝවක් කිසිවිටෙක නොලැබේ.'] },
    { target: '#btnStudioActivityPopup', drawer: null,
      title: ['7 · Live Student Activity', '7 · සජීවී ශිෂ්‍ය ක්‍රියාකාරිත්වය'],
      body: ['Tap the 👥 button to see who is practising right now — unique students, devices (phone/tablet/desktop), scores, missed words and error alerts, with JSON/ZIP export.',
             '👥 බොත්තම ඔබා දැන් අභ්‍යාස කරන අය බලන්න — අනන්‍ය ශිෂ්‍යයන්, උපාංග (දුරකථන/ටැබ්ලට්/ඩෙස්ක්ටොප්), ලකුණු, වැරදි වචන සහ දෝෂ ඇඟවීම්, JSON/ZIP නිර්යාත සමඟ.'] }
  ];

  var ADVANCED_STEPS = [
    { target: '#studioKeyPool', drawer: 'studioAdvancedDrawer',
      title: ['ElevenLabs Multi-Key Pool', 'ElevenLabs බහු-යතුරු තටාකය'],
      body: ['Add several ElevenLabs API keys — the pool uses them in order and rotates automatically on 401/402/429 errors, so generation never stops when one key runs out. The chip at the top shows how many keys are ready and how many characters remain.',
             'ElevenLabs API යතුරු කිහිපයක් එක් කරන්න — තටාකය ඒවා අනුපිළිවෙලින් භාවිත කර 401/402/429 දෝෂවලදී ස්වයංක්‍රීයව මාරු වේ, එබැවින් එක් යතුරක් අවසන් වූ විටත් ජනනය නොනවතී. මුදුනේ චිපය සූදානම් යතුරු ගණන සහ ඉතිරි අකුරු පෙන්වයි.'] },
    { target: '#studioAiProvider', drawer: 'studioAdvancedDrawer',
      title: ['Gemini / Groq / LLM engine keys', 'Gemini / Groq / LLM එන්ජිම් යතුරු'],
      body: ['Paste a Gemini, Groq or OpenRouter key here. The AI engine then verifies every word against authoritative Cambridge/Oxford B1 British standards — RP pronunciation, clean meanings, Sinhala glosses and natural example sentences.',
             'Gemini, Groq හෝ OpenRouter යතුරක් මෙහි පේස්ට් කරන්න. AI එන්ජිම සෑම වචනයක්ම කේම්බ්‍රිජ්/ඔක්ස්ෆර්ඩ් B1 බ්‍රිතාන්‍ය ප්‍රමිතීන්ට අනුව තහවුරු කරයි — RP උච්චාරණ, පිරිසිදු අර්ථ, සිංහල අර්ථ සහ ස්වාභාවික උදාහරණ.'] },
    { target: '#studioCardKeys', drawer: 'studioAdvancedDrawer',
      title: ['GitHub token & vault', 'GitHub ටෝකනය සහ වෝල්ට්'],
      body: ['Your GitHub token publishes session data straight to the repository. The PIN you set here encrypts the vault that protects every API key — change it any time with Change PIN.',
             'ඔබේ GitHub ටෝකනය සැසි දත්ත කෙලින්ම රෙපෝසිටරියට පළ කරයි. මෙහි සකසන PIN සෑම API යතුරක්ම ආරක්ෂා කරන වෝල්ට් සංකේතනය කරයි — Change PIN මගින් ඕනෑම වෙලාවක වෙනස් කළ හැක.'] },
    { target: '#studioCardClassroomVoice', drawer: 'studioVoiceDrawer',
      title: ['Unified voice, cloning &amp; revert', 'එක්සත් හඬ, ක්ලෝන කිරීම සහ ආපසු හැරවීම'],
      body: ['The whole app speaks ONE unified high-professional British voice (Alice, the pre-filled Default Voice ID). Record a 30–120 s sample in the Voice Sample Studio, create and apply a clone, or revert to Alice at any time — every word, number, command and guide clip follows.',
             'මුළු යෙදුමම එක් එක්සත් උසස්-වෘත්තීය බ්‍රිතාන්‍ය හඬකින් (Alice, පෙර-පිරූ පෙරනිමි Voice ID) කථා කරයි. Voice Sample Studio හි තත්පර 30–120 සාම්පලයක් පටිගත කර ක්ලෝනයක් සාදා යොදන්න, නැතිනම් ඕනෑම වෙලාවක Alice වෙත ආපසු හරවන්න — සෑම වචන, අංක, විධාන සහ මාර්ගෝපදේශ පටයම අනුගමනය කරයි.'] },
    { target: '#studioCardVoiceSample', drawer: 'studioVoiceDrawer',
      title: ['Voice Sample Studio', 'හඬ සාම්පල ස්ටූඩියෝව'],
      body: ['Record your own voice, analyse it (DSP + AI), enhance it, transcribe it and create a professional cloned voice for the whole classroom — 30–120 seconds is all it takes.',
             'ඔබේම හඬ පටිගත කර, විශ්ලේෂණය කර (DSP + AI), වැඩිදියුණු කර, ලිපිනගත කර, මුළු පන්තියටම වෘත්තීය ක්ලෝන හඬක් සාදන්න — තත්පර 30–120ක් පමණයි අවශ්‍ය.'] },
    { target: '#studioLecturerAlertsCard', drawer: 'studioAlertsDrawer',
      title: ['Live Student Alerts', 'සජීවී ශිෂ්‍ය ඇඟවීම්'],
      body: ['Every missing-clip, stale-clip or pronunciation error a student hits lands here in real time, with one-tap Fix Now and Publish actions. The badge shows the unread count.',
             'ශිෂ්‍යයෙකුට හමුවන සෑම මඟ හැරුණු පට, පැරණි පට හෝ උච්චාරණ දෝෂයක්ම මෙහි ක්ෂණිකව ලැබේ, එක්-තට්ටු Fix Now සහ Publish ක්‍රියා සමඟ. බැජය නොකියවූ ගණන පෙන්වයි.'] },
    { target: '#studioCardDiag', drawer: 'studioAdvancedDrawer',
      title: ['Diagnostics export', 'රෝග විනිශ්චය නිර්යාත'],
      body: ['Download a full diagnostics .zip (logs, settings snapshot, telemetry, UI snapshot) to attach to a support request — everything is privacy-safe.',
             'සම්පූර්ණ රෝග විනිශ්චය .zip එකක් (ලඝු-සටහන්, සැකසුම්, ටෙලිමෙට්‍රි, UI ජායාරූප) බාගන්න — සියල්ල පෞද්ගලිකත්ව-ආරක්ෂිත ය.'] },
    { target: '#studioCardReviews', drawer: 'studioAdvancedDrawer',
      title: ['Student reviews &amp; telemetry', 'ශිෂ්‍ය සමාලෝචන සහ ටෙලිමෙට්‍රි'],
      body: ['Every student review, rating and session-authenticity verdict (Genuine / Rapid-Skip / Incomplete) is collected here with its sealed UI snapshot.',
             'සෑම ශිෂ්‍ය සමාලෝචනයක්, ශ්‍රේණිගත කිරීමක් සහ සැසි-සත්‍යතා තීන්දමක්ම (Genuine / Rapid-Skip / Incomplete) මුද්‍රා තැබූ UI ජායාරූප සමඟ මෙහි රැස් වේ.'] },
    { target: '#btnOpenLiveLab', drawer: null,
      title: ['🔬 Live Lab', '🔬 සජීවී රසායනාගාරය'],
      body: ['The Real-Time Voice &amp; Clone Lab (lab.html) — test voices, listen to every clip, and clone with live meters before applying anything to the classroom.',
             'ක්‍රියාත්මක හඬ සහ ක්ලෝන රසායනාගාරය (lab.html) — පන්තියට යොදන්නට පෙර හඬ පරීක්ෂා කරන්න, සෑම පටයක්ම අසන්න, සජීවී මීටර සමඟ ක්ලෝන කරන්න.'] },
    { target: '#btnChangePin', drawer: null,
      title: ['Change the Studio PIN', 'ස්ටූඩියෝ PIN වෙනස් කරන්න'],
      body: ['Set a new 4–8 digit PIN for the vault. The recovery code 78987898 always works if the PIN is forgotten (it re-locks everything safely).',
             'වෝල්ට් සඳහා නව ඉලක්කම් 4–8 PIN එකක් සකසන්න. PIN අමතක වුවහොත් ප්‍රතිසාධන කේතය 78987898 සැමවිටම ක්‍රියා කරයි (සියල්ල ආරක්ෂිතව නැවත අගුලු ලයි).'] },
    { target: '#btnSsbPublish', drawer: null,
      title: ['Finish: Publish, Sync &amp; Leave', 'අවසානය: පළ කර, සමමුහූර්ත කර පිටවන්න'],
      body: ['That is the full admin tour! Publish, Sync &amp; Leave verifies, publishes, releases dictation and locks the Studio. Re-run this guide any time with the 📘 Studio Guide button.',
             'මෙය සම්පූර්ණ පරිපාලක චාරිකාවයි! Publish, Sync &amp; Leave තහවුරු කර පළ කර ඩික්ටේෂන් නිදහස් කර ස්ටූඩියෝව අගුලු ලයි. 📘 බොත්තමෙන් ඕනෑම වෙලාවක මාර්ගෝපදේශය නැවත ධාවනය කරන්න.'] }
  ];

  /* ── Tour engine state ───────────────────────────────────────────────── */
  var G = { open: false, mode: 'simple', steps: [], index: 0, nodes: [], welcome: null, bound: false };

  function ensureDom() {
    if (G.nodes.length) return true;
    var shade = doc.createElement('div');
    shade.className = 'sdp-guide-shade'; shade.id = 'sdpGuideShade';
    var spot = doc.createElement('div');
    spot.className = 'sdp-guide-spot'; spot.id = 'sdpGuideSpot';
    var tip = doc.createElement('div');
    tip.className = 'sdp-guide-tip'; tip.id = 'sdpGuideTip'; tip.setAttribute('role', 'dialog');
    (doc.body || doc.documentElement).appendChild(shade);
    (doc.body || doc.documentElement).appendChild(spot);
    (doc.body || doc.documentElement).appendChild(tip);
    G.nodes = [shade, spot, tip];
    bindEvents();
    return true;
  }
  function removeDom() {
    for (var i = 0; i < G.nodes.length; i++) {
      try { if (G.nodes[i] && G.nodes[i].parentNode) G.nodes[i].parentNode.removeChild(G.nodes[i]); } catch (e) {}
    }
    G.nodes = [];
  }
  function bindEvents() {
    if (G.bound) return;
    G.bound = true;
    try { doc.addEventListener('keydown', function (ev) {
      var k = ev && ev.key ? str(ev.key).toLowerCase() : '';
      if (!G.open) return;
      if (k === 'escape') { close(true); }
      else if (k === 'arrowright' || k === 'enter') { next(); }
      else if (k === 'arrowleft') { back(); }
    }, false); } catch (e) {}
    try { global.addEventListener('resize', function () { if (G.open) paint(); }, false); } catch (e2) {}
    try { global.addEventListener('scroll', function () { if (G.open) paint(); }, true); } catch (e3) {}
  }

  function resolveTarget(step) {
    if (!step) return null;
    var el = null;
    try { el = doc.querySelector(str(step.target)); } catch (e) { el = null; }
    return el;
  }
  function openDrawerFor(step) {
    if (!step || !step.drawer) return null;
    var d = byId(step.drawer);
    if (d && d.tagName === 'DETAILS' && !d.open) { try { d.open = true; } catch (e) {} return d; }
    return null;
  }

  function visibleSteps(mode) {
    var list = mode === 'advanced' ? ADVANCED_STEPS : SIMPLE_STEPS;
    var out = [], i;
    for (i = 0; i < list.length; i++) {
      if (resolveTarget(list[i]) || byId(list[i].drawer)) out.push(list[i]);
    }
    return out.length ? out : list;
  }

  function open(mode) {
    G.mode = (mode === 'advanced') ? 'advanced' : (mode === 'simple' ? 'simple' : 'chooser');
    if (G.mode === 'chooser') { openChooser(); return true; }
    G.steps = visibleSteps(G.mode);
    G.index = 0;
    G.open = true;
    ensureDom();
    paint();
    return true;
  }
  function openChooser() {
    close(true);
    ensureDom();
    var w = byId('sdpGuideWelcome');
    if (w) { try { w.parentNode.removeChild(w); } catch (e) {} }
    w = doc.createElement('div');
    w.className = 'sdp-guide-welcome';
    w.id = 'sdpGuideWelcome';
    w.setAttribute('role', 'dialog');
    w.innerHTML =
      '<h5>' + escHtml(t('studioGuideTitle', 'Lecturer Studio Guide')) + '</h5>' +
      '<p>' + L('Take the interactive tour — every step highlights the real button.',
                'අන්තර්ක්‍රියාකාරී චාරිකාවට සහභාගි වන්න — සෑම පියවරක්ම සැබෑ බොත්තම ඉස්මතු කරයි.') + '</p>' +
      '<div class="gw-row">' +
      '<button type="button" class="btn btn-primary" data-guide-mode="simple">' + escHtml(t('studioGuideSimple', 'Simple Guide — daily teaching flow')) + '</button>' +
      '<button type="button" class="btn btn-go" data-guide-mode="advanced">' + escHtml(t('studioGuideAdvanced', 'Advanced Guide — every admin control')) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-guide-mode="later">' + escHtml(t('studioGuideLater', 'Maybe later')) + '</button>' +
      '</div>';
    (doc.body || doc.documentElement).appendChild(w);
    w.addEventListener('click', function (ev) {
      var m = ev && ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-guide-mode') : null;
      if (!m) return;
      try { w.parentNode.removeChild(w); } catch (e) {}
      saveSeen();
      if (m === 'simple' || m === 'advanced') open(m);
    }, false);
    G.welcome = w;
    return true;
  }
  function saveSeen() {
    var patch = {};
    patch.studioGuideSeenVersion = str(SDP.version || '');
    saveSettings(patch);
  }

  function close(silent) {
    var w = byId('sdpGuideWelcome');
    if (w) { try { w.parentNode.removeChild(w); } catch (e) {} }
    G.welcome = null;
    G.open = false;
    removeDom();
    if (!silent) saveSeen();
    return true;
  }
  function next() {
    if (!G.open) return false;
    if (G.index + 1 >= G.steps.length) { close(); return 'done'; }
    G.index += 1;
    paint();
    return true;
  }
  function back() {
    if (!G.open || G.index === 0) return false;
    G.index -= 1;
    paint();
    return true;
  }

  function escHtml(s) {
    return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function paint() {
    if (!G.open) return false;
    var step = G.steps[G.index];
    if (!step) { close(true); return false; }
    openDrawerFor(step);
    var el = resolveTarget(step);
    var tip = byId('sdpGuideTip'), spot = byId('sdpGuideSpot');
    if (!tip || !spot) return false;
    /* tooltip content (repainted on every lang change) */
    var title = L(step.title[0], step.title[1]);
    var body = L(step.body[0], step.body[1]);
    tip.innerHTML = '<h5>' + title + '</h5>' +
      '<p>' + body + '</p>' +
      '<div class="gt-row">' +
      '<span class="gt-step">' + L('Step', 'පියවර') + ' ' + (G.index + 1) + ' / ' + G.steps.length + '</span>' +
      (G.index > 0 ? '<button type="button" class="btn btn-sm btn-ghost" data-gt="back">← ' + L('Back', 'ආපසු') + '</button>' : '') +
      '<button type="button" class="btn btn-sm btn-primary" data-gt="next">' + (G.index + 1 >= G.steps.length ? '✓ ' + L('Done', 'අවසානය') : L('Continue →', 'ඉදිරියට →')) + '</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-gt="exit">✕ ' + L('Exit Tour', 'පිටවන්න') + '</button>' +
      '</div>';
    var onTip = function (ev) {
      var a = ev && ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-gt') : null;
      if (a === 'back') back();
      else if (a === 'next') next();
      else if (a === 'exit') close();
    };
    tip.onclick = onTip; /* one live handler, repainted per step */
    /* smooth scroll to the target */
    if (el && el.scrollIntoView) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (eS) { try { el.scrollIntoView(); } catch (eS2) {} }
    }
    /* position after a paint tick so layout settles */
    global.setTimeout(function () { position(el, tip, spot); }, 60);
    try { global.setTimeout(function () { position(el, tip, spot); }, 320); } catch (eT) {}
    return true;
  }

  function position(el, tip, spot) {
    if (!G.open || !tip || !spot) return false;
    var vw = global.innerWidth || 1280, vh = global.innerHeight || 800;
    var r = null;
    if (el && el.getBoundingClientRect) {
      try { r = el.getBoundingClientRect(); } catch (e) { r = null; }
    }
    if (r && (r.width || r.height)) {
      var pad = 8;
      spot.style.top = Math.max(4, Math.floor(r.top - pad)) + 'px';
      spot.style.left = Math.max(4, Math.floor(r.left - pad)) + 'px';
      spot.style.width = Math.max(24, Math.floor(r.width + pad * 2)) + 'px';
      spot.style.height = Math.max(24, Math.floor(r.height + pad * 2)) + 'px';
      spot.hidden = false;
    } else {
      spot.hidden = true;
    }
    /* tooltip: below the spotlight, or above when out of room; always clamped */
    tip.style.visibility = 'hidden';
    tip.hidden = false;
    var tw = tip.offsetWidth || 360, th = tip.offsetHeight || 180;
    var left = Math.max(8, Math.min(vw - tw - 8, Math.floor((vw - tw) / 2)));
    var top;
    if (r && (r.bottom + th + 24 < vh)) top = Math.min(vh - th - 8, Math.floor(r.bottom + 16));
    else if (r && (r.top - th - 16 > 0)) top = Math.max(8, Math.floor(r.top - th - 16));
    else top = Math.max(8, Math.floor((vh - th) / 2));
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.visibility = 'visible';
    return true;
  }

  /* ── The auto-prompt law ─────────────────────────────────────────────── */
  function maybeAutoPrompt() {
    try {
      if (!doc.body) return false;
      var seen = str(settings().studioGuideSeenVersion);
      var cur = str(SDP.version || '');
      if (!cur || seen === cur) return false;
      /* a NEW release (or first run): offer the guide once, on the next tick
         so the studio markup is fully mounted first */
      global.setTimeout(function () {
        try {
          if (SDP.Studio && SDP.Studio.isUnlocked && SDP.Studio.isUnlocked()) openChooser();
        } catch (e) {}
      }, 600);
      return true;
    } catch (e) { return false; }
  }
  function onLangChange() {
    if (G.open) paint();
    var w = byId('sdpGuideWelcome');
    if (w) { openChooser(); } /* repaint the welcome card in the new language */
    return true;
  }
  function state() {
    return { open: G.open, mode: G.mode, index: G.index, total: G.steps.length, version: '1.0.0' };
  }

  SDP.StudioGuide = {
    version: '1.0.0',
    open: open,
    close: close,
    next: next,
    back: back,
    paint: paint,
    isOpen: function () { return !!G.open; },
    state: state,
    maybeAutoPrompt: maybeAutoPrompt,
    onLangChange: onLangChange
  };
})(typeof window !== 'undefined' ? window : this);
