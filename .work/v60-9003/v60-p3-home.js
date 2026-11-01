/* ============================================================================
   v60 Next-Gen "Hurubuhuti" UI - complete replacement layer (v60 / 9.0.0.3)
   ----------------------------------------------------------------------------
   Appended to data/learning-tools.js. ES5 only. Every label is ASCII in this
   source file (Sinhala / emoji are \uXXXX escapes) so the file stays safe to
   ship through any encoding.
   Replaces the visual layer ONLY: no engine, storage or network behaviour is
   changed here.
   ========================================================================== */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : null;
  var D = W && W.document;
  if (!W || !D) return;

  var V = { id: '60', ver: '9.0.0.3', mounted: false, busy: false, lang: 'en', bootedAt: 0 };
  W.SDP_NEXTGEN_V60 = V;

  /* ---------------------------------------------------------------- helpers */
  function core() { return W.SDPCore || null; }
  function UI() { var c = core(); return c && c.UI; }
  function Eng() { var c = core(); return c && c.Eng; }
  function Screens() { var c = core(); return c && c.Screens; }
  function DB() { var c = core(); return c && c.DB; }
  function Lib() { var c = core(); return c && c.Lib; }
  function $(sel, root) { try { return (root || D).querySelector(sel); } catch (e) { return null; } }
  function $$(sel, root) { try { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); } catch (e) { return []; } }
  function on(node, ev, fn) { if (node && node.addEventListener) node.addEventListener(ev, fn, false); return node; }
  function txt(node, s) { if (node) node.textContent = s; return node; }
  function cls(node, s) { if (node) node.className = s; return node; }
  function mk(tag, className, id, text) {
    var n = D.createElement(tag);
    if (className) n.className = className;
    if (id) n.id = id;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function attr(n, k, v) { if (n && n.setAttribute) n.setAttribute(k, v); return n; }
  function keep(n) {
    var box = $('#sdpLegacyKeeper');
    if (!box) {
      box = mk('div', null, 'sdpLegacyKeeper');
      box.hidden = true;
      box.style.display = 'none';
      (D.body || D.documentElement).appendChild(box);
    }
    if (n && n.parentNode !== box) box.appendChild(n);
    return box;
  }
  function stamp(node, kind) {
    if (!node) return node;
    node.setAttribute('data-sdp-v60', kind || 'node');
    return node;
  }

  /* -------------------------------------------------------- labels (EN / SI) */
  var L = {
    greeting: ['Good evening, Student', '\u0DC3\u0DD4\u0DB7 \u0DC3\u0DB1\u0DCA\u0DB0\u0DCA\u200D\u0DBA\u0DCF\u0DC0\u0D9A\u0DCA, \u0DC3\u0DD2\u0DC3\u0DD4\u0DC0\u0D9C\u0DD9\u0DB1\u0DCA'],
    session: ['Tue \u00B7 Session 8', '\u0D85\u0D9F\u0DC4\u0DBB\u0DD4 \u00B7 \u0DC3\u0DD0\u0DC3\u0DD2\u0DBA 8'],
    kicker: ['\u25CF SESSION 8 \u00B7 29 OCT 2026', '\u25CF \u0DC3\u0DD0\u0DC3\u0DD2\u0DBA 8 \u00B7 29 \u0D94\u0D9A\u0DCA\u0DAD\u0DD6 2026'],
    title: ['Personal Feelings, Opinions & Experiences', '\u0DB4\u0DD0\u0DAD\u0DD2\u0D9A \u0DC4\u0DD0\u0D9F\u0DD3\u0DB8\u0DCA, \u0D85\u0DAF\u0DC4\u0DC3\u0DCA \u0DC4\u0DCF \u0D85\u0DB3\u0DCA\u0DAF\u0DD2\u0DB1\u0DCA'],
    sub: ['30 adjectives \u00B7 UK English \u00B7 \uD83C\uDDEC\uD83C\uDDE7 Alice studio voice',
      '\u0DC0\u0DD2\u0DC1\u0DDA\u0DC2\u0DAB 30 \u00B7 \u0DB6\u0DCA\u200D\u0DBB\u0DD2\u0DAD\u0DCF\u0DB1\u0DCA\u200D\u0DBA \u0D89\u0D82\u0D9C\u0DCA\u200D\u0DBB\u0DD3\u0DC3\u0DD2 \u00B7 \uD83C\uDDEC\uD83C\uDDE7 Alice'],
    paper: ['\u270D\uFE0F Paper mode', '\u270D\uFE0F \u0D9A\u0DB1\u0DCA\u0DAF\u0DDA \u0DBD\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1'],
    typing: ['\u2328\uFE0F Typing mode', '\u2328\uFE0F \u0DBA\u0DDC\u0DAF\u0DB1\u0DCA\u0DB1'],
    start: ['\u25B6 Start dictation', '\u25B6 \u0DA9\u0DD2\u0D9A\u0DCA\u0DA7\u0DDA\u0DC2\u0DB1\u0DCA \u0DB4\u0DCf\u0DBB\u0DB8\u0DCA\u0DB7 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1'],
    est: ['\u2248 6 min', '\u2248 \u0DC0\u0DD2\u0DB1\u0DCF\u0DA9\u0DD2 6'],
    howto: ['How it works \u00B7 60s guide', '\u0DB8\u0DD9\u0DBA \u0D9A\u0DDC\u0DC4\u0DDC\u0DB8\u0DAF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1\u0DDA\u0DAF \u00B7 \u0DB8\u0DD2\u0DB1\u0DD2\u0DAD\u0DCA\u0DAD\u0DD4 60'],
    home: ['Home', '\u0DB8\u0DD4\u0DBD\u0DCA \u0DB4\u0DD2\u0DA7\u0DD4\u0DC0'],
    words: ['Words', '\u0DC0\u0DCA\u200D\u0DBA\u0DC0\u0DC4\u0DCF\u0DBB'],
    dictate: ['Dictate', '\u0DA9\u0DD2\u0D9A\u0DCA\u0DA7\u0DDA\u0DA7\u0DCA'],
    practice: ['Practice', '\u0DB4\u0DD4\u0DB1\u0DBB\u0DCA\u0DA0\u0DBD\u0DCF\u0DC0'],
    settings: ['Settings', '\u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA'],
    streak: ['Streak', '\u0DBB\u0DD0\u0D9A\u0DD2\u0DBA'],
    mastered: ['Mastered', '\u0DB4\u0DCA\u200D\u0DBB\u0DB7\u0DD4'],
    weak: ['Weak words', '\u0DAF\u0DD4\u0DB6\u0DBD \u0DC0\u0DA0\u0DB1'],
    quick: ['QUICK PRACTICE', '\u0D89\u0D9A\u0DCA\u0DB8\u0DB1\u0DCA \u0DB4\u0DD4\u0DB1\u0DBB\u0DCA\u0DA0\u0DBD\u0DCF\u0DC0'],
    flashcards: ['Flashcards', '\u0DC6\u0DCA\u0DBD\u0DD0\u0DC2\u0DCA \u0D9A\u0DCF\u0DA9\u0DCA'],
    quiz: ['Quiz', '\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DCF\u0DC0\u0DBD\u0DD2'],
    gap: ['Sentence gap', '\u0DC0\u0DCF\u0D9A\u0DCA\u0DBA \u0DC4\u0DD2\u0DC3\u0DCA'],
    creditDock: ['\uD83E\uDDA2 Crafted by Hansana', '\uD83E\uDDA2 \u0DB1\u0DD2\u0DBB\u0DCA\u0DB8\u0DCF\u0DAB\u0DBA Hansana'],
    creditPill: ['\uD83E\uDDA2 CREDITS GOES TO Hansana', '\uD83E\uDDA2 \u0D9C\u0DDE\u0DBB\u0DC0\u0DBA Hansana \u0DC3\u0DB3\u0DC4\u0DCF'],
    loaded: ['\u26A1 0.34 MB used on load', '\u26A1 \u0DB4\u0DD2\u0DA7\u0DD4\u0DC0 \u0DB4\u0DD6\u0DB1 \u0DC0\u0DD2\u0DA7 0.34 MB'],
    brand: ['Smart Dictation', 'Smart Dictation'],
    branch: ['CCBE Galle Branch', 'CCBE \u0D9C\u0DCF\u0DBD\u0DCA\u0DBD \u0DC1\u0DCF\u0D9B\u0DCF\u0DC0']
  };
  function T(key) {
    var pair = L[key];
    if (!pair) return '';
    return V.lang === 'si' ? pair[1] : pair[0];
  }

  /* --------------------------------------------------------------- CSS core */
  function cssLines() {
    var l = [];
    l.push(':root{--bg-canvas:#09090B;--bg-card:#18181B;--bg-elevated:#222226;--bg-elevated-2:#27272A;--border-subtle:rgba(255,255,255,0.08);--border-strong:rgba(255,255,255,0.10);--text-primary:#FAFAFA;--text-muted:#A1A1AA;--text-dim:#71717A;--accent-primary:#38BDF8;--accent-ink:#062530;--listen:#38BDF8;--write:#FBBF24;--ok:#4ADE80;--danger:#F87171;--gold:#F5C842;--radius:16px;--tap:44px}');
    l.push('*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}');
    l.push('html,body{background:#09090B!important;color:#FAFAFA}');
    l.push('body{font-family:\'Inter\',system-ui,-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif!important;-webkit-font-smoothing:antialiased}');
    l.push('html[lang="si"] body,[lang="si"],.si-text{font-family:\'Noto Sans Sinhala\',\'Inter\',system-ui,sans-serif!important;line-height:1.65!important}');
    l.push('#cdNum,#sdpTimerPill,#sdpBtnStartEst,.sdp-num,.v60-num{font-variant-numeric:tabular-nums}');
    l.push('.glass,.card,.tile,.chip,.btn,.topbar,.topbar.glass{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}');
    /* legacy clutter inside the topbar / home */
    l.push('.topbar #topDataBadge,.topbar #btnLiveVideo,.topbar #chipNet,.topbar #btnLang,.topbar #btnGuideTop,.topbar #btnPerf,.topbar #btnTheme,.topbar #btnRefresh,.topbar #btnAdmin,.topbar #btnLock,.topbar .v58-more-btn,.topbar #v58MoreBtn,.v58-overflow-pop{display:none!important;visibility:hidden!important;pointer-events:none!important}');
    l.push('#sdpLegacyKeeper,#sdpLegacyKeeper *{display:none!important;visibility:hidden!important;pointer-events:none!important;position:absolute!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}');
    l.push('#screen-home #v58VoiceBadge,#screen-home #homeMeta,#screen-home #segMode,#screen-home #homeStats,#screen-home .v58-bento,#screen-home .v58-rail,#screen-home .v58-kbd-hud,#screen-home #credit.v58-sig-pill,#screen-home .sdp-retry-toast,#screen-home .hero-credit,#screen-home #homeCredits,#screen-home #homeAnn,#screen-home #v58PracticeBento,#screen-home #v58HomeFooter,#screen-home #v58OfflineRow,#screen-home .v58-home-footer,#screen-home .v58-disclosure,#screen-home #homeResume,#screen-home .anatomy-stage:before{display:none!important;visibility:hidden!important;pointer-events:none!important}');
    l.push('@media (max-width:1023px){#screen-home #homeSessions{display:none!important}}');
    /* workspace neutralisation */
    l.push('.v58-workspace,.v58-work-main{display:block!important;width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;grid-template-columns:none!important;background:none!important;border:none!important;box-shadow:none!important;gap:0!important}');
    l.push('.v58-rail,.v58-bento,.v58-kbd-hud{display:none!important}');
    /* topbar */
    l.push('.topbar,.topbar.glass{position:fixed!important;top:0!important;left:0!important;right:0!important;height:54px!important;min-height:54px!important;max-width:100%!important;margin:0!important;padding:0 14px!important;background:#09090B!important;border:none!important;border-bottom:1px solid rgba(255,255,255,0.08)!important;border-radius:0!important;transform:none!important;box-shadow:none!important;z-index:80!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}');
    l.push('.topbar .brand{display:none!important}');
    l.push('#sdpBrandCluster{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important}');
    l.push('#sdpBrandBadge{width:32px!important;height:32px!important;border-radius:10px!important;background:#0C2D3E!important;color:#38BDF8!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:15px!important;flex:none!important}');
    l.push('#sdpBrandText{display:flex!important;flex-direction:column!important;min-width:0!important;line-height:1.15!important}');
    l.push('#brandName{font-size:14px!important;font-weight:750!important;color:#FAFAFA!important;letter-spacing:-0.01em!important;white-space:nowrap!important}');
    l.push('#brandName em{color:#38BDF8!important;font-style:normal!important}');
    l.push('#brandSub{font-size:10.5px!important;font-weight:500!important;color:#71717A!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;display:block!important;margin:0!important}');
    l.push('#sdpVerPill{display:inline-flex!important;align-items:center!important;height:16px!important;padding:0 6px!important;border-radius:999px!important;background:#0C2D3E!important;color:#38BDF8!important;font-size:9.5px!important;font-weight:700!important;margin-left:6px!important;vertical-align:middle!important}');
    l.push('#sdpTopActions{display:flex!important;align-items:center!important;gap:8px!important;flex:none!important}');
    l.push('#sdpTopVoiceBtn,#btnOpenSettingsTop{width:34px!important;height:34px!important;min-height:34px!important;border-radius:11px!important;border:1px solid rgba(255,255,255,0.08)!important;background:#18181B!important;color:#A1A1AA!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;cursor:pointer!important;box-shadow:none!important}');
    l.push('#sdpTopVoiceBtn{background:#38BDF8!important;color:#062530!important;border-color:#38BDF8!important}');
    l.push('#sdpTopVoiceBtn svg{width:17px!important;height:17px!important}');
    l.push('#btnOpenSettingsTop svg{width:17px!important;height:17px!important}');
    l.push('#sdpTopLangPill{height:34px!important;padding:0 10px!important;border-radius:11px!important;border:1px solid rgba(255,255,255,0.08)!important;background:#18181B!important;color:#FAFAFA!important;font-size:11.5px!important;font-weight:600!important;display:inline-flex!important;align-items:center!important;gap:5px!important;cursor:pointer!important;white-space:nowrap!important}');
    l.push('#sdpTopLangPill .on{color:#38BDF8!important}');
    l.push('#sdpTopLangPill .dim{color:#52525B!important}');
    /* app shell */
    l.push('#app{padding-top:66px!important;padding-bottom:96px!important;max-width:520px!important;margin:0 auto!important;display:block!important;background:transparent!important}');
    l.push('#app>.screen{padding:0!important;background:transparent!important}');
    l.push('#screen-home,#screen-dict,#screen-set{display:block!important}');
    l.push('.screen.hidden{display:none!important}');
    /* tabbar (mobile) */
    l.push('#tabbar,.glass#tabbar{position:fixed!important;left:12px!important;right:12px!important;bottom:10px!important;width:auto!important;height:62px!important;padding:5px!important;background:#121215!important;border:1px solid rgba(255,255,255,0.10)!important;border-radius:20px!important;display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:4px!important;transform:none!important;overflow:visible!important;margin:0!important;z-index:75!important;box-shadow:0 10px 30px rgba(0,0,0,0.45)!important}');
    l.push('#tabbar #tabInd,#tabbar .tab-ind{display:none!important}');
    l.push('#tabbar button{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;height:52px!important;min-height:52px!important;border:0!important;border-radius:15px!important;background:transparent!important;color:#71717A!important;font-size:10px!important;font-weight:600!important;letter-spacing:0.01em!important;padding:0!important;box-shadow:none!important;backdrop-filter:none!important}');
    l.push('#tabbar button svg{width:19px!important;height:19px!important}');
    l.push('#tabbar button[aria-selected="true"]{background:#18181B!important;color:#38BDF8!important}');
    l.push('#tabbar #commBadge{display:none!important}');
    /* home: greeting + hero */
    l.push('#screen-home .stack,#screen-home .v58-workspace{background:transparent!important}');
    l.push('#sdpHomeGreeting{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;padding:8px 2px 12px!important}');
    l.push('#sdpHomeGreetingL{font-size:15px!important;font-weight:650!important;color:#FAFAFA!important;letter-spacing:-0.01em!important}');
    l.push('#sdpHomeGreetingR{font-size:11px!important;font-weight:600!important;color:#71717A!important;white-space:nowrap!important}');
    l.push('#homeHero,.glass.card.hero,#homeHero.glass.card.hero{background:#18181B!important;background-image:none!important;border:1px solid rgba(255,255,255,0.09)!important;border-radius:16px!important;padding:16px!important;box-shadow:none!important;backdrop-filter:none!important;display:block!important;margin:0 0 14px!important;max-width:100%!important}');
    l.push('#homeKicker{display:inline-flex!important;align-items:center!important;gap:6px!important;height:22px!important;padding:0 9px!important;border-radius:999px!important;background:rgba(56,189,248,0.12)!important;color:#38BDF8!important;font-size:10px!important;font-weight:750!important;letter-spacing:0.06em!important;text-transform:uppercase!important;margin:0 0 10px!important}');
    l.push('#homeTitle,#homeTitle.hollow{font-size:19px!important;line-height:1.28!important;font-weight:750!important;color:#FAFAFA!important;letter-spacing:-0.02em!important;margin:0 0 6px!important;-webkit-text-fill-color:#FAFAFA!important;background:none!important;display:block!important;text-shadow:none!important}');
    l.push('#homeSub{font-size:12.5px!important;line-height:1.45!important;color:#A1A1AA!important;margin:0 0 12px!important;display:block!important}');
    l.push('#sdpHeroConfigChips{display:flex!important;flex-wrap:wrap!important;gap:6px!important;margin:0 0 14px!important}');
    l.push('.sdp-chip{display:inline-flex!important;align-items:center!important;gap:5px!important;height:26px!important;padding:0 10px!important;border-radius:999px!important;background:#222226!important;border:1px solid rgba(255,255,255,0.08)!important;color:#D4D4D8!important;font-size:11px!important;font-weight:600!important;cursor:pointer!important;box-shadow:none!important;white-space:nowrap!important}');
    l.push('.sdp-chip:active{transform:scale(0.97)!important}');
    l.push('.hero-actions{display:block!important;gap:0!important}');
    l.push('#btnStart{width:100%!important;height:46px!important;min-height:46px!important;border-radius:12px!important;background:#38BDF8!important;color:#062530!important;border:1px solid #38BDF8!important;font-size:14.5px!important;font-weight:750!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;padding:0 14px!important;position:relative!important;box-shadow:0 8px 22px rgba(56,189,248,0.22)!important;transform:none!important}');
    l.push('#btnStart svg{display:none!important}');
    l.push('#btnStart #btnStartText{color:#062530!important;font-weight:750!important}');
    l.push('#sdpBtnStartEst{position:static!important;margin-left:auto!important;font-size:11.5px!important;font-weight:700!important;color:rgba(6,37,48,0.72)!important}');
    l.push('#btnStart #btnStartText{margin-right:auto!important}');
    l.push('#btnGuide,#btnHowItWorks{width:100%!important;height:40px!important;min-height:40px!important;margin-top:8px!important;border-radius:12px!important;background:#222226!important;border:1px solid rgba(255,255,255,0.08)!important;color:#D4D4D8!important;font-size:12.5px!important;font-weight:650!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;box-shadow:none!important;transform:none!important}');
    l.push('#btnGuide svg{display:none!important}');
    l.push('#btnGuide{display:none!important}');
    /* home: stats + quick practice */
    l.push('#sdpHomeStatsRow{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:8px!important;margin:0 0 16px!important}');
    l.push('.sdp-stat{background:#18181B!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:14px!important;padding:11px 10px!important;display:flex!important;flex-direction:column!important;gap:3px!important}');
    l.push('.sdp-stat b{font-size:17px!important;font-weight:750!important;line-height:1!important;color:#FAFAFA!important;font-variant-numeric:tabular-nums}');
    l.push('.sdp-stat span{font-size:10px!important;font-weight:600!important;color:#71717A!important;letter-spacing:0.05em!important;text-transform:uppercase!important}');
    l.push('.sdp-stat.ok b{color:#4ADE80!important}');
    l.push('.sdp-stat.warn b{color:#FBBF24!important}');
    l.push('#sdpQuickPracticeGrid{display:flex!important;flex-direction:column!important;gap:8px!important;margin:0 0 8px!important}');
    l.push('.sdp-quick-head{font-size:10.5px!important;font-weight:750!important;letter-spacing:0.1em!important;color:#71717A!important;padding:0 2px!important}');
    l.push('#sdpQuickPracticeGrid .sdp-quick-cells{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}');
    l.push('.sdp-quick{display:flex!important;align-items:center!important;gap:9px!important;min-height:56px!important;padding:10px 11px!important;border-radius:14px!important;background:#18181B!important;border:1px solid rgba(255,255,255,0.08)!important;color:#FAFAFA!important;font-size:12.5px!important;font-weight:650!important;text-align:left!important;cursor:pointer!important;box-shadow:none!important;transform:none!important}');
    l.push('.sdp-quick i{width:28px!important;height:28px!important;border-radius:9px!important;background:#222226!important;color:#38BDF8!important;display:flex!important;align-items:center!important;justify-content:center!important;font-style:normal!important;font-size:13px!important;flex:none!important}');
    l.push('.sdp-quick .sdp-badge{margin-left:auto!important;min-width:18px!important;height:18px!important;border-radius:999px!important;background:rgba(251,191,36,0.16)!important;color:#FBBF24!important;font-size:10.5px!important;font-weight:750!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0 5px!important}');
    /* credit dock + pills */
    l.push('#creditDocked{position:fixed!important;left:50%!important;transform:translateX(-50%)!important;bottom:calc(80px + env(safe-area-inset-bottom,0px))!important;z-index:74!important;font-size:10.5px!important;font-weight:650!important;color:#71717A!important;background:#121215!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:999px!important;padding:4px 12px!important;pointer-events:none!important;white-space:nowrap!important}');
    l.push('#creditPill{position:fixed!important;left:50%!important;bottom:calc(84px + env(safe-area-inset-bottom,0px))!important;transform:translate(-50%,10px)!important;z-index:120!important;pointer-events:none!important;font-size:11px!important;font-weight:800!important;letter-spacing:0.04em!important;color:#062530!important;background:linear-gradient(100deg,#F5C842,#FBBF24 45%,#F5C842)!important;border:1px solid rgba(245,200,66,0.7)!important;border-radius:999px!important;padding:7px 15px!important;box-shadow:0 10px 26px rgba(245,200,66,0.28)!important;opacity:0!important;transition:opacity .3s ease,transform .3s ease!important}');
    l.push('#creditPill.sdp-show{opacity:1!important;transform:translate(-50%,0)!important}');
    l.push('#microToastLoad{position:fixed!important;left:14px!important;bottom:calc(84px + env(safe-area-inset-bottom,0px))!important;z-index:118!important;pointer-events:none!important;font-size:10.5px!important;font-weight:650!important;color:#A1A1AA!important;background:#121215!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:999px!important;padding:5px 11px!important;opacity:0!important;transition:opacity .3s ease!important}');
    l.push('#microToastLoad.sdp-show{opacity:1!important}');
    /* words explorer */
    l.push('#screen-dict #dictTabs,.v59-weak-bar,.v58-weak-bar{display:none!important}');
    l.push('#sdpWordFilterRow{display:flex!important;gap:6px!important;padding:10px 0 4px!important;overflow-x:auto!important}');
    l.push('#sdpWordFilterRow button{height:30px!important;padding:0 12px!important;border-radius:999px!important;background:#18181B!important;border:1px solid rgba(255,255,255,0.08)!important;color:#A1A1AA!important;font-size:11.5px!important;font-weight:650!important;white-space:nowrap!important;cursor:pointer!important;box-shadow:none!important}');
    l.push('#sdpWordFilterRow button[aria-pressed="true"]{background:#38BDF8!important;border-color:#38BDF8!important;color:#062530!important}');
    l.push('#screen-dict .stack>.glass.card{background:#18181B!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:16px!important;box-shadow:none!important;padding:12px!important;margin:0 0 10px!important}');
    l.push('#dictSearch{background:#0F0F12!important;border:1px solid rgba(255,255,255,0.08)!important;color:#FAFAFA!important;border-radius:11px!important;height:40px!important}');
    l.push('#dictList{display:flex!important;flex-direction:column!important;gap:8px!important}');
    l.push('.sdp-word-card{display:flex!important;gap:10px!important;align-items:flex-start!important;background:#18181B!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:14px!important;padding:12px!important;box-shadow:none!important;width:100%!important;max-width:100%!important}');
    l.push('.sdp-word-num{width:28px!important;height:28px!important;flex:none!important;border-radius:9px!important;background:#222226!important;color:#A1A1AA!important;font-size:11px!important;font-weight:750!important;display:flex!important;align-items:center!important;justify-content:center!important;font-variant-numeric:tabular-nums}');
    l.push('.sdp-word-body{flex:1 1 auto!important;min-width:0!important;display:flex!important;flex-direction:column!important;gap:3px!important}');
    l.push('.sdp-word-head{display:flex!important;align-items:center!important;gap:7px!important;flex-wrap:wrap!important}');
    l.push('.sdp-word-head b{font-size:14.5px!important;font-weight:750!important;color:#FAFAFA!important}');
    l.push('.sdp-word-card .v59-ipa{font-size:11.5px!important;color:#38BDF8!important;font-weight:600!important}');
    l.push('.sdp-word-card .v59-pos{font-size:11px!important;color:#71717A!important;font-style:italic!important}');
    l.push('.sdp-word-def{font-size:12px!important;color:#D4D4D8!important;line-height:1.4!important}');
    l.push('.sdp-word-eg{font-size:11.5px!important;color:#A1A1AA!important;line-height:1.4!important}');
    l.push('.sdp-word-eg b{color:#FAFAFA!important}');
    l.push('.sdp-si-pill{display:inline-flex!important;align-self:flex-start!important;margin-top:3px!important;padding:3px 9px!important;border-radius:999px!important;background:#222226!important;border:1px solid rgba(255,255,255,0.08)!important;color:#A1A1AA!important;font-size:11px!important;line-height:1.5!important}');
    l.push('.sdp-word-acts{display:flex!important;flex-direction:column!important;gap:6px!important;flex:none!important}');
    l.push('.sdp-word-acts button{width:34px!important;height:34px!important;min-height:34px!important;border-radius:10px!important;background:#222226!important;border:1px solid rgba(255,255,255,0.08)!important;color:#A1A1AA!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;cursor:pointer!important;font-size:12px!important;box-shadow:none!important}');
    /* settings */
    l.push('#sdpNextGenSettings{display:flex!important;flex-direction:column!important;gap:10px!important;margin:0 0 12px!important}');
    l.push('.sdp-card{background:#18181B!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:16px!important;padding:14px!important;box-shadow:none!important}');
    l.push('.sdp-card-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;margin:0 0 10px!important}');
    l.push('.sdp-card-head b{font-size:10.5px!important;font-weight:750!important;letter-spacing:0.09em!important;color:#71717A!important;text-transform:uppercase!important}');
    l.push('.sdp-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;padding:9px 0!important;border-top:1px solid rgba(255,255,255,0.05)!important}');
    l.push('.sdp-row:first-of-type{border-top:0!important}');
    l.push('.sdp-row .sdp-lbl{font-size:12.5px!important;font-weight:650!important;color:#FAFAFA!important}');
    l.push('.sdp-row .sdp-hint{font-size:10.5px!important;color:#71717A!important;font-weight:500!important;display:block!important}');
    l.push('.sdp-seg{display:inline-flex!important;background:#0F0F12!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:11px!important;padding:3px!important;gap:3px!important}');
    l.push('.sdp-seg button{height:30px!important;min-height:30px!important;padding:0 10px!important;border-radius:8px!important;border:0!important;background:transparent!important;color:#A1A1AA!important;font-size:11.5px!important;font-weight:650!important;cursor:pointer!important;box-shadow:none!important;white-space:nowrap!important}');
    l.push('.sdp-seg button[aria-pressed="true"]{background:#38BDF8!important;color:#062530!important}');
    l.push('.sdp-val{font-size:12px!important;font-weight:750!important;color:#38BDF8!important;font-variant-numeric:tabular-nums;min-width:34px!important;text-align:right!important}');
    l.push('#sdpRangeWait{width:150px!important;accent-color:#38BDF8!important}');
    l.push('.sdp-switch{width:44px!important;height:26px!important;border-radius:999px!important;border:1px solid rgba(255,255,255,0.12)!important;background:#0F0F12!important;position:relative!important;cursor:pointer!important;padding:0!important;box-shadow:none!important;flex:none!important}');
    l.push('.sdp-switch i{position:absolute!important;top:2px!important;left:2px!important;width:20px!important;height:20px!important;border-radius:999px!important;background:#71717A!important;transition:left .2s ease,background .2s ease!important}');
    l.push('.sdp-switch[aria-pressed="true"]{background:#0C2D3E!important;border-color:#38BDF8!important}');
    l.push('.sdp-switch[aria-pressed="true"] i{left:20px!important;background:#38BDF8!important}');
    l.push('.sdp-btn{height:34px!important;min-height:34px!important;padding:0 13px!important;border-radius:10px!important;background:#222226!important;border:1px solid rgba(255,255,255,0.08)!important;color:#FAFAFA!important;font-size:12px!important;font-weight:650!important;cursor:pointer!important;box-shadow:none!important}');
    l.push('.sdp-btn.primary{background:#38BDF8!important;border-color:#38BDF8!important;color:#062530!important}');
    l.push('#sdpAppearanceAccordion{background:#18181B!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:16px!important;padding:0 14px!important;margin-top:2px!important}');
    l.push('#sdpAppearanceAccordion>summary{cursor:pointer!important;list-style:none!important;padding:12px 0!important;font-size:10.5px!important;font-weight:750!important;letter-spacing:0.09em!important;color:#71717A!important;text-transform:uppercase!important}');
    l.push('#sdpAppearanceAccordion>summary::-webkit-details-marker{display:none!important}');
    l.push('#sdpAppearanceAccordion #setBody{padding:0 0 12px!important;background:transparent!important}');
    l.push('#sdpAppearanceAccordion #setBody .glass.card{background:#141418!important;border:1px solid rgba(255,255,255,0.06)!important;border-radius:12px!important;box-shadow:none!important;margin:0 0 8px!important}');
    /* cockpit */
    l.push('.layer.player .lens{display:none!important;visibility:hidden!important;pointer-events:none!important}');
    l.push('#sdpCockpitCard{background:#18181B!important;border:1px solid rgba(255,255,255,0.09)!important;border-radius:16px!important;padding:16px!important;position:relative!important;overflow:hidden!important;box-shadow:none!important;max-width:100%!important;width:100%!important;backdrop-filter:none!important}');
    l.push('#sdpEdgeBar{position:absolute!important;top:0!important;left:0!important;right:0!important;height:4px!important;background:rgba(255,255,255,0.06)!important;z-index:2!important}');
    l.push('#sdpEdgeBarFill{display:block!important;height:4px!important;width:100%!important;background:#38BDF8!important;transition:background .25s ease!important}');
    l.push('#sdpCockpitHeaderRow{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;margin:4px 0 12px!important}');
    l.push('#sdpCockpitWordOf{font-size:11px!important;font-weight:700!important;color:#71717A!important;letter-spacing:0.02em!important;font-variant-numeric:tabular-nums}');
    l.push('#sdpCockpitHeaderRow #plStatus{display:inline-flex!important;align-items:center!important;gap:5px!important;height:24px!important;padding:0 10px!important;border-radius:999px!important;background:rgba(251,191,36,0.14)!important;color:#FBBF24!important;font-size:10.5px!important;font-weight:750!important;white-space:nowrap!important}');
    l.push('#sdpTimerPill{display:inline-flex!important;align-items:center!important;gap:7px!important;height:34px!important;padding:0 9px 0 12px!important;border-radius:999px!important;background:#0F0F12!important;border:1px solid rgba(255,255,255,0.08)!important}');
    l.push('#sdpTimerPill #cdNum{font-size:13px!important;font-weight:750!important;color:#FAFAFA!important;font-variant-numeric:tabular-nums;letter-spacing:0.01em!important}');
    l.push('#sdpTimerPill svg{width:24px!important;height:24px!important}');
    l.push('#sdpCockpitStage{display:flex!important;flex-direction:column!important;align-items:center!important;gap:9px!important;padding:10px 0 14px!important;text-align:center!important}');
    l.push('#sdpCockpitKicker{font-size:10px!important;font-weight:750!important;letter-spacing:0.14em!important;color:#52525B!important;text-transform:uppercase!important}');
    l.push('#sdpLetterSlots{display:flex!important;flex-wrap:wrap!important;justify-content:center!important;gap:5px!important;max-width:100%!important}');
    l.push('#sdpLetterSlots i{width:20px!important;height:26px!important;border-bottom:2px solid rgba(255,255,255,0.16)!important;display:inline-block!important}');
    l.push('#sdpCockpitCaption{font-size:11px!important;color:#71717A!important;font-weight:500!important}');
    l.push('#sdpCockpitDock{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:6px!important;margin:0 0 12px!important}');
    l.push('#sdpCockpitDock button{height:52px!important;min-height:52px!important;border-radius:12px!important;background:#222226!important;border:1px solid rgba(255,255,255,0.08)!important;color:#D4D4D8!important;font-size:10.5px!important;font-weight:650!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;padding:0!important;cursor:pointer!important;box-shadow:none!important}');
    l.push('#sdpCockpitDock button svg{width:16px!important;height:16px!important}');
    l.push('#sdpCockpitFoot{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding-top:2px!important}');
    l.push('#sdpCockpitVoice{font-size:10.5px!important;color:#71717A!important;font-weight:600!important}');
    l.push('#sdpCockpitFoot .sdp-foot-acts{display:flex!important;gap:6px!important}');
    l.push('#sdpCockpitFoot button{height:32px!important;min-height:32px!important;padding:0 12px!important;border-radius:9px!important;background:#222226!important;border:1px solid rgba(255,255,255,0.08)!important;color:#D4D4D8!important;font-size:11.5px!important;font-weight:650!important;cursor:pointer!important;box-shadow:none!important}');
    l.push('#sdpCockpitFoot button#sdpSkipBtn{background:#38BDF8!important;border-color:#38BDF8!important;color:#062530!important}');
    l.push('#sdpCockpitCounters{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:8px!important;margin:10px 0!important}');
    l.push('#sdpCockpitCounters .sdp-stat{padding:9px 10px!important}');
    l.push('#sdpWordMapCard{background:#18181B!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:16px!important;padding:12px!important;margin-top:10px!important}');
    l.push('#sdpWordMap{display:grid!important;grid-template-columns:repeat(10,1fr)!important;gap:5px!important}');
    l.push('#sdpWordMap i{height:22px!important;border-radius:6px!important;background:#222226!important;color:#71717A!important;font-size:9.5px!important;font-weight:700!important;font-style:normal!important;display:flex!important;align-items:center!important;justify-content:center!important;font-variant-numeric:tabular-nums}');
    l.push('#sdpWordMap i.ok{background:rgba(74,222,128,0.16)!important;color:#4ADE80!important}');
    l.push('#sdpWordMap i.miss{background:rgba(248,113,113,0.16)!important;color:#F87171!important}');
    l.push('#sdpWordMap i.now{background:#38BDF8!important;color:#062530!important}');
    /* desktop rail */
    l.push('@media (min-width:1024px){#tabbar{display:none!important}#sdpDesktopRail{display:flex!important;position:fixed!important;top:0!important;left:0!important;bottom:0!important;width:232px!important;background:#0D0D10!important;border-right:1px solid rgba(255,255,255,0.08)!important;z-index:85!important;flex-direction:column!important;justify-content:space-between!important;padding:16px 12px!important}.topbar,.topbar.glass{left:232px!important;width:calc(100% - 232px)!important;right:auto!important}#app{margin-left:232px!important;max-width:calc(100vw - 232px)!important;padding:72px 28px 40px!important;display:block!important}#creditDocked{display:none!important}#sdpDesktopRail .sdp-rail-nav{display:flex!important;flex-direction:column!important;gap:4px!important;margin-top:14px!important}#sdpDesktopRail .sdp-rail-nav button{height:40px!important;border-radius:10px!important;border:0!important;background:transparent!important;color:#A1A1AA!important;font-size:12.5px!important;font-weight:650!important;text-align:left!important;padding:0 12px!important;cursor:pointer!important;box-shadow:none!important}#sdpDesktopRail .sdp-rail-nav button[aria-selected="true"]{background:#18181B!important;color:#38BDF8!important}}');
    l.push('#sdpDesktopRail{display:none}');
    l.push('#sdpDesktopRail .sdp-rail-brand{display:flex!important;align-items:center!important;gap:10px!important;padding:2px 6px!important}');
    l.push('#sdpDesktopRail .sdp-rail-title{font-size:13.5px!important;font-weight:750!important;color:#FAFAFA!important}');
    l.push('#sdpDesktopRail .sdp-rail-sub{font-size:10px!important;color:#71717A!important;display:block!important}');
    l.push('#creditDockedDesktop{font-size:10.5px!important;color:#71717A!important;font-weight:650!important;padding:0 6px!important}');
    return l;
  }

  /* --------------------------------------------------- style cascade control */
  function ensureStyle(id) {
    var n = D.getElementById(id);
    if (!n) {
      n = D.createElement('style');
      n.id = id;
      (D.head || D.documentElement).appendChild(n);
    }
    return n;
  }
  function neutraliseLegacyStyles() {
    var ids = ['sdpV57Css', 'sdpV58Css'];
    for (var i = 0; i < ids.length; i++) {
      var el = ensureStyle(ids[i]);
      try { el.disabled = true; } catch (e) {}
      try { el.textContent = '/* v60 neutralised */'; } catch (e2) {}
      if (el.parentNode !== D.head) (D.head || D.documentElement).appendChild(el);
    }
  }
  function paintNextGenCss() {
    neutraliseLegacyStyles();
    var st = ensureStyle('sdpNextGenCss');
    try { st.disabled = false; } catch (e) {}
    st.textContent = cssLines().join('\n');
    if (D.head && st.parentNode === D.head && D.head.lastElementChild !== st) D.head.appendChild(st);
    return st;
  }
  function watchHead() {
    if (!W.MutationObserver || !D.head) return;
    try {
      var mo = new W.MutationObserver(function () {
        if (V.busy) return;
        V.busy = true;
        try {
          var a = D.getElementById('sdpV57Css'), b = D.getElementById('sdpV58Css'), st = D.getElementById('sdpNextGenCss');
          if (a && (a.textContent !== '/* v60 neutralised */' || !a.disabled)) { a.disabled = true; a.textContent = '/* v60 neutralised */'; }
          if (b && (b.textContent !== '/* v60 neutralised */' || !b.disabled)) { b.disabled = true; b.textContent = '/* v60 neutralised */'; }
          if (st && D.head.lastElementChild !== st) D.head.appendChild(st);
        } catch (e) {}
        V.busy = false;
      });
      mo.observe(D.head, { childList: true, subtree: false, characterData: true, attributes: true });
    } catch (e) {}
  }
  function dropWallpaper() {
    try {
      var explicit = W.localStorage && W.localStorage.getItem('sdp_wp_explicit_v60');
      if (explicit === '1') return;
      var body = D.body;
      if (!body) return;
      var c = String(body.className || '');
      if (c.indexOf('wallpaper-on') >= 0) {
        body.className = c.replace(/wallpaper-on/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
      }
      var v = D.getElementById('bgLiveVideo');
      if (v && v.parentNode) { try { v.pause(); } catch (e) {} }
    } catch (e) {}
  }

  /* -------------------------------------------------------- global chrome */
  function mountChrome() {
    if (!D.body) return;
    var bar = $('.topbar');
    if (bar) {
      var cluster = $('#sdpBrandCluster');
      if (!cluster) {
        cluster = mk('div', null, 'sdpBrandCluster');
        var badge = mk('span', null, 'sdpBrandBadge', '\uD83E\uDDA2');
        badge.setAttribute('aria-hidden', 'true');
        var textbox = mk('div', null, 'sdpBrandText');
        var name = $('#brandName');
        if (!name) { name = mk('b', null, 'brandName'); }
        name.innerHTML = '';
        name.appendChild(D.createTextNode(T('brand')));
        var pill = mk('span', null, 'sdpVerPill', 'v' + V.id);
        pill.setAttribute('aria-label', 'version ' + V.ver);
        var sub = $('#brandSub');
        if (!sub) { sub = mk('span', null, 'brandSub'); }
        sub.textContent = T('branch');
        textbox.appendChild(name);
        textbox.appendChild(pill);
        textbox.appendChild(sub);
        cluster.appendChild(badge);
        cluster.appendChild(textbox);
        bar.insertBefore(cluster, bar.firstChild);
      }
      var actions = $('#sdpTopActions');
      if (!actions) {
        actions = mk('div', null, 'sdpTopActions');
        var mic = mk('button', null, 'sdpTopVoiceBtn');
        mic.type = 'button';
        mic.setAttribute('aria-label', 'Start dictation by voice');
        mic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z"/></svg>';
        on(mic, 'click', function () { startDictation(); });
        var lang = mk('button', null, 'sdpTopLangPill');
        lang.type = 'button';
        refreshLangPill(lang);
        on(lang, 'click', function () { applyLang(V.lang === 'si' ? 'en' : 'si'); });
        var cog = mk('button', null, 'btnOpenSettingsTop');
        cog.type = 'button';
        cog.setAttribute('aria-label', 'Settings');
        cog.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17"><path fill="currentColor" d="M4 6h10v2H4V6Zm12 0h4v2h-4V6ZM4 16h4v2H4v-2Zm6 0h10v2H10v-2Zm-2-6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/></svg>';
        on(cog, 'click', function () { var u = UI(); if (u && u.setTab) u.setTab('set'); });
        actions.appendChild(mic);
        actions.appendChild(lang);
        actions.appendChild(cog);
        bar.appendChild(actions);
      }
      var legacyControls = $('.topbar .row.top-controls');
      if (legacyControls) keep(legacyControls);
    }

    var tabbar = $('#tabbar');
    if (tabbar) {
      var comm = $('#tab-comm');
      if (comm && comm.parentNode !== $('#sdpLegacyKeeper')) keep(comm);
      var practice = $('#tab-practice');
      if (practice) {
        var ps = practice.querySelector('span:not([data-i18n])') || practice.querySelector('span');
        if (ps) ps.textContent = T('practice');
      }
      var homs = $('#tab-home'); var hp = homs && homs.querySelector('span'); if (hp) hp.textContent = T('home');
      var detab = $('#tab-dict'); var dp = detab && detab.querySelector('span'); if (dp) dp.textContent = T('words');
      var setab = $('#tab-set'); var sp = setab && setab.querySelector('span'); if (sp) sp.textContent = T('settings');
      if (!$('#tab-dictate')) {
        var dbtn = mk('button', null, 'tab-dictate');
        dbtn.type = 'button';
        dbtn.setAttribute('role', 'tab');
        dbtn.setAttribute('data-tab', 'dictate');
        dbtn.setAttribute('aria-selected', 'false');
        dbtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="19" height="19"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z"/></svg>';
        var dl = mk('span', null, null, T('dictate'));
        dbtn.appendChild(dl);
        if (tabbar.children.length >= 2) tabbar.insertBefore(dbtn, tabbar.children[tabbar.children.length - 1]);
        else tabbar.appendChild(dbtn);
      }
      if (!$('#tab-prac')) {
        var alias = mk('button', null, 'tab-prac');
        alias.type = 'button';
        alias.style.display = 'none';
        alias.setAttribute('aria-hidden', 'true');
        alias.tabIndex = -1;
        keep(alias);
      }
    }

    if (!$('#sdpDesktopRail')) {
      var rail = mk('aside', null, 'sdpDesktopRail');
      rail.setAttribute('aria-label', 'Sections');
      var top = mk('div', 'sdp-rail-top');
      var brand = mk('div', 'sdp-rail-brand');
      var mark = mk('span', null, 'sdpBrandBadge', '\uD83E\uDDA2');
      var ttl = mk('div');
      ttl.appendChild(mk('span', 'sdp-rail-title', null, T('brand')));
      ttl.appendChild(mk('span', 'sdp-rail-sub', null, T('branch')));
      brand.appendChild(mark);
      brand.appendChild(ttl);
      top.appendChild(brand);
      var nav = mk('div', 'sdp-rail-nav');
      var items = [['home', 'home'], ['dict', 'words'], ['dictate', 'dictate'], ['practice', 'practice'], ['set', 'settings']];
      for (var i = 0; i < items.length; i++) {
        var b = mk('button', null, 'sdpRail-' + items[i][0], T(items[i][1]));
        b.type = 'button';
        b.setAttribute('data-rail', items[i][0]);
        b.setAttribute('aria-selected', items[i][0] === 'home' ? 'true' : 'false');
        nav.appendChild(b);
      }
      top.appendChild(nav);
      var bottom = mk('div', null, 'creditDockedDesktop', T('creditDock'));
      rail.appendChild(top);
      rail.appendChild(bottom);
      (D.body).appendChild(rail);
      on(nav, 'click', function (ev) {
        var t = ev.target;
        while (t && t !== nav && !t.getAttribute('data-rail')) t = t.parentNode;
        if (!t || t === nav) return;
        var name = t.getAttribute('data-rail');
        if (name === 'dictate') { startDictation(); return; }
        var u = UI(); if (u && u.setTab) u.setTab(name);
      });
    }

    if (!$('#creditDocked')) {
      var cd = mk('div', null, 'creditDocked', T('creditDock'));
      cd.setAttribute('aria-hidden', 'true');
      D.body.appendChild(cd);
    }
    if (!$('#creditPill')) {
      var cp = mk('div', null, 'creditPill', T('creditPill'));
      cp.setAttribute('aria-hidden', 'true');
      D.body.appendChild(cp);
    }
    if (!$('#microToastLoad')) {
      var mt = mk('div', null, 'microToastLoad');
      mt.setAttribute('aria-hidden', 'true');
      D.body.appendChild(mt);
    }
  }

  function refreshLangPill(node) {
    if (!node) return;
    node.innerHTML = '';
    var en = mk('span', V.lang === 'en' ? 'on' : 'dim', null, 'EN');
    var sep = mk('span', 'dim', null, '|');
    var si = mk('span', V.lang === 'si' ? 'on' : 'dim', null, '\u0DC3\u0DD2\u0D82\u0DC4\u0DBD');
    node.appendChild(en); node.appendChild(sep); node.appendChild(si);
    node.setAttribute('aria-label', 'Language');
  }

  function startDictation() {
    try {
      var e = Eng();
      if (e && e.start) { e.start({}); return; }
      var b = $('#btnStart'); if (b) b.click();
    } catch (err) {}
  }

  /* ------------------------------------------------------------- home view */
  function settingsData() {
    try { var d = DB(); return (d && d.data && d.data.settings) || {}; } catch (e) { return {}; }
  }
  function homeGreeting() {
    var host = $('#screen-home');
    if (!host) return;
    var wrapId = 'sdpHomeGreeting';
    var g = $('#' + wrapId);
    if (!g) {
      g = mk('div', null, wrapId);
      g.appendChild(mk('div', null, 'sdpHomeGreetingL', T('greeting')));
      g.appendChild(mk('div', null, 'sdpHomeGreetingR', T('session')));
      host.insertBefore(g, host.firstChild);
    } else {
      txt($('#sdpHomeGreetingL', g), T('greeting'));
      txt($('#sdpHomeGreetingR', g), T('session'));
    }
  }
  function renderNextGenHome() {
    if (!D.body) return;
    mountChrome();
    homeGreeting();
    var hero = $('#homeHero');
    if (hero) {
      txt($('#homeKicker', hero), T('kicker'));
      txt($('#homeTitle', hero), T('title'));
      txt($('#homeSub', hero), T('sub'));
      var st = settingsData();
      var chips = $('#sdpHeroConfigChips');
      if (!chips) {
        chips = mk('div', null, 'sdpHeroConfigChips');
        attr(chips, 'role', 'group');
        attr(chips, 'aria-label', 'Current setup');
        var subs = $('#homeSub', hero);
        if (subs && subs.parentNode === hero) hero.insertBefore(chips, subs.nextSibling);
        else hero.appendChild(chips);
      }
      chips.innerHTML = '';
      var labels = [
        (st.mode === 'type' ? T('typing') : T('paper')),
        '\uD83D\uDD53 ' + (Number(st.rate) ? Number(st.rate).toFixed(2) : '0.90') + '\u00D7',
        '\u00D7' + (Number(st.repeats) || 2) + ' repeats',
        '' + (Number(st.writeFixed) || 8) + 's write'
      ];
      for (var i = 0; i < labels.length; i++) {
        var chip = mk('button', 'sdp-chip', null, labels[i]);
        chip.type = 'button';
        chip.setAttribute('data-chip', String(i));
        on(chip, 'click', function () { var u = UI(); if (u && u.setTab) u.setTab('set'); });
        chips.appendChild(chip);
      }
      var start = $('#btnStart', hero);
      if (start) {
        txt($('#btnStartText', start), T('start'));
        if (!$('#sdpBtnStartEst', start)) start.appendChild(mk('span', null, 'sdpBtnStartEst', T('est')));
        else txt($('#sdpBtnStartEst', start), T('est'));
      }
      var guide = $('#btnGuide', hero);
      var anchor = start && start.parentNode === hero ? start : null;
      if (!guide) {
        guide = mk('button', null, 'btnGuide', T('howto'));
        guide.type = 'button';
        if (anchor && anchor.nextSibling) hero.insertBefore(guide, anchor.nextSibling);
        else hero.appendChild(guide);
        on(guide, 'click', function () { try { var u = UI(); if (u && u.guide) u.guide(); } catch (e) {} });
      }
      if (!$('#btnHowItWorks', hero)) {
        var how = mk('button', null, 'btnHowItWorks', T('howto'));
        how.type = 'button';
        on(how, 'click', function () { try { var u = UI(); if (u && u.guide) u.guide(); } catch (e) {} });
        if (guide.parentNode === hero && guide.nextSibling) hero.insertBefore(how, guide.nextSibling);
        else hero.appendChild(how);
      }
    }
    /* stats row */
    var stats = $('#sdpHomeStatsRow');
    if (!stats) {
      stats = mk('div', null, 'sdpHomeStatsRow');
      stats.appendChild(statCard('sdpStatStreak', '5 days', T('streak'), ''));
      stats.appendChild(statCard('sdpStatMastered', '14 / 30', T('mastered'), 'ok'));
      stats.appendChild(statCard('sdpStatWeak', '3', T('weak'), 'warn'));
      var homeHost = $('#screen-home');
      if (hero && hero.parentNode) hero.parentNode.appendChild(stats);
      else if (homeHost) homeHost.appendChild(stats);
    }
    /* quick practice */
    var grid = $('#sdpQuickPracticeGrid');
    if (!grid) {
      grid = mk('div', null, 'sdpQuickPracticeGrid');
      grid.appendChild(mk('div', 'sdp-quick-head', null, T('quick')));
      var cells = mk('div', 'sdp-quick-cells');
      var defs = [
        ['pracFlashcards', '\uD83D\uDDC2', T('flashcards'), '', 'flash'],
        ['pracQuiz', '\u2705', T('quiz'), '', 'quiz'],
        ['pracGap', '\uD83D\uDCDD', T('gap'), '', 'gap'],
        ['pracWeak', '\uD83C\uDFAF', T('weak'), '3', 'weak']
      ];
      for (var k = 0; k < defs.length; k++) {
        var card = mk('button', 'sdp-quick', defs[k][0]);
        card.type = 'button';
        card.setAttribute('data-practice', defs[k][4]);
        card.appendChild(mk('i', null, null, defs[k][1]));
        card.appendChild(mk('span', null, null, defs[k][2]));
        if (defs[k][3]) card.appendChild(mk('span', 'sdp-badge', null, defs[k][3]));
        on(card, 'click', function (ev) {
          var btn = ev.currentTarget;
          var kind = btn && btn.getAttribute('data-practice');
          try {
            var u = UI(); if (u && u.setTab) u.setTab('practice');
            if (window.SDPLearning && window.SDPLearning.startPractice) window.SDPLearning.startPractice(kind);
          } catch (e) {}
        });
        cells.appendChild(card);
      }
      grid.appendChild(cells);
      if (stats.parentNode) stats.parentNode.insertBefore(grid, stats.nextSibling);
      else if (hero && hero.parentNode) hero.parentNode.appendChild(grid);
    }
    mountChrome();
  }
  function statCard(id, value, label, mod) {
    var c = mk('div', 'sdp-stat' + (mod ? ' ' + mod : ''), id);
    c.appendChild(mk('b', null, null, value));
    c.appendChild(mk('span', null, null, label));
    return c;
  }

  /* --------------------------------------------------- micro toast + pills */
  function showLoadToast() {
    var t = $('#microToastLoad');
    if (!t) return;
    var mb = '0.34';
    try {
      var perf = W.performance;
      if (perf && perf.getEntriesByType) {
        var nav = perf.getEntriesByType('navigation');
        var bytes = 0;
        if (nav && nav.length && nav[0].transferSize) bytes = nav[0].transferSize;
        if (bytes > 0) mb = (bytes / 1048576).toFixed(2);
      }
    } catch (e) {}
    t.textContent = '\u26A1 ' + mb + ' MB used on load';
    t.className = 'sdp-show';
    W.setTimeout(function () { try { t.className = ''; } catch (e) {} }, 3500);
  }
  function showCreditPill() {
    var p = $('#creditPill');
    if (!p) return;
    p.className = 'sdp-show';
    W.setTimeout(function () { try { p.className = ''; } catch (e) {} }, 3800);
  }

  /* ---------------------------------------------------------------- i18n */
  function applyLang(lang) {
    V.lang = lang === 'si' ? 'si' : 'en';
    try { if (D.documentElement) D.documentElement.setAttribute('lang', V.lang); } catch (e) {}
    refreshLangPill($('#sdpTopLangPill'));
    try { txt($('#brandSub'), T('branch')); } catch (e) {}
    try { renderNextGenHome(); } catch (e) {}
    try { if (window.SDP_NEXTGEN_SETTINGS_REFRESH) window.SDP_NEXTGEN_SETTINGS_REFRESH(); } catch (e) {}
    try {
      var home = $('#tab-home') && $('#tab-home').querySelector('span'); if (home) home.textContent = T('home');
      var d = $('#tab-dict') && $('#tab-dict').querySelector('span'); if (d) d.textContent = T('words');
      var p = $('#tab-dictate') && $('#tab-dictate').querySelector('span'); if (p) p.textContent = T('dictate');
      var pr = $('#tab-practice') && $('#tab-practice').querySelector('span'); if (pr) pr.textContent = T('practice');
      var s = $('#tab-set') && $('#tab-set').querySelector('span'); if (s) s.textContent = T('settings');
    } catch (e) {}
    return V.lang;
  }
  W.SDP_applyLang = function (lang) { return applyLang(lang); };

  /* --------------------------------------------------------------- wiring */
  function wrapTabset() {
    var u = UI();
    if (!u || u.__v60SetTab || typeof u.setTab !== 'function') return;
    var orig = u.setTab;
    u.setTab = function (name) {
      if (name === 'dictate') { startDictation(); return; }
      V.tab = name;
      var out = orig.apply(this, arguments);
      try { mountChrome(); if (name === 'home') renderNextGenHome(); } catch (e) {}
      return out;
    };
    u.__v60SetTab = true;
  }
  function wrapHome() {
    var s = Screens();
    if (!s || s.__v60Home || typeof s.home !== 'function') return;
    var orig = s.home;
    s.home = function () {
      var out = orig.apply(this, arguments);
      try { renderNextGenHome(); } catch (e) {}
      return out;
    };
    s.__v60Home = true;
  }
  var PAINT_DEPTH = 0;
  function wrapPaint() {
    var e = Eng();
    if (!e || e.__v60Paint) return;
    if (typeof e.paint === 'function') {
      var orig = e.paint;
      e.paint = function () {
        var out = orig.apply(this, arguments);
        if (PAINT_DEPTH === 0) {
          PAINT_DEPTH++;
          try { if (V.tab === 'home') renderNextGenHome(); } catch (err) {}
          PAINT_DEPTH--;
        }
        return out;
      };
    }
    e.__v60Paint = true;
  }

  /* ---------------------------------------------------------------- boot */
  function boot() {
    if (!D.body) { W.setTimeout(boot, 60); return; }
    if (V.mounted) return;
    V.mounted = true;
    V.bootedAt = Date.now();
    paintNextGenCss();
    watchHead();
    dropWallpaper();
    neutraliseLegacyStyles();
    mountChrome();
    wrapTabset();
    wrapHome();
    wrapPaint();
    try { renderNextGenHome(); } catch (e) {}
    W.setTimeout(showLoadToast, 700);
    W.setTimeout(showCreditPill, 1400);
  }
  if (D.readyState === 'loading') on(D, 'DOMContentLoaded', function () { W.setTimeout(boot, 40); });
  else W.setTimeout(boot, 40);
  /* safety: if SDPCore appears later, re-wrap once */
  W.setTimeout(function () { try { wrapTabset(); wrapHome(); wrapPaint(); } catch (e) {} }, 1200);
})();
