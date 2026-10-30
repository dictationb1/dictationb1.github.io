/* SECTION 60 - v53 ZERO-DRAIN VOICE SYNC BOOTSTRAP (loads the professor studio on demand) */
(function () {
  var CFG = {
    version: 53, appVersion: "5.9.0", schema: 53, settingsRev: 53,
    key: "sdp.v53_github_voice_sync", voiceId: "Xb7hH8MSUJpSbSDYk0k2", modelId: "eleven_flash_v2_5",
    file: "./data/studio.js?v=53"
  };
  window.EV53 = CFG;
  var previous = DB.migrate;
  DB.resetToV53 = function (data) {
    var state = data || {};
    state.settings = state.settings || {};
    state.settings.elevenLabsKey = state.settings.elevenLabsKey || "";
    state.settings.elevenLabsVoiceId = state.settings.elevenLabsVoiceId || CFG.voiceId;
    state.settings.elevenLabsModelId = state.settings.elevenLabsModelId || CFG.modelId;
    state.settings.activeVideoSrc = DEFAULT_WALLPAPER_SRC;
    state.settings.activeMediaType = "video";
    state.settingsRev = CFG.settingsRev;
    state.v = CFG.schema;
    return state;
  };
  DB.migrate = function (data) {
    var state = previous.call(this, data) || data;
    if (!state) return state;
    if ((Number(state.settingsRev) || 0) < CFG.settingsRev) state = DB.resetToV53(state);
    state.settingsRev = CFG.settingsRev;
    state.v = CFG.schema;
    return state;
  };
  CONFIG.schema = CFG.schema;
  CONFIG.settingsRev = CFG.settingsRev;
  CONFIG.key = CFG.key;
  CONFIG.appVersion = CFG.appVersion;
  CONFIG.adminPin = "78987898";

  /* The studio (voice vault, GitHub sync, 3-step admin panel) is loaded from
     data/studio.js so the page stays tiny and students never fetch it twice. */
  var state = 0, waiters = [];
  function done() {
    var list = waiters, i;
    state = 2;
    waiters = [];
    for (i = 0; i < list.length; i++) { try { list[i](); } catch (e) {} }
  }
  function load(cb) {
    var el;
    if (state === 2) { if (cb) cb(); return true; }
    if (cb) waiters.push(cb);
    if (state === 1) return false;
    state = 1;
    try {
      el = document.createElement("script");
      el.src = CFG.file;
      el.async = true;
      el.onload = done;
      el.onerror = function () { state = 0; waiters = []; if (el.parentNode) el.parentNode.removeChild(el); };
      (document.head || document.documentElement).appendChild(el);
    } catch (e) { state = 0; waiters = []; }
    return true;
  }
  /* the app keeps its internals private: publish the handles the studio needs */
  window.SDPCore = {
    DB: DB, Speech: Speech, UI: UI, U: U, Lib: Lib, Admin: Admin, Cloud: Cloud, CONFIG: CONFIG, GUIDE: GUIDE,
    Store: Store, Screens: Screens, DEFAULT_WALLPAPER_SRC: DEFAULT_WALLPAPER_SRC, BUILD_DATE: BUILD_DATE,
    wordRow: wordRow, SAMPLE_WORDS: SAMPLE_WORDS, WORD_BANK: WORD_BANK, Dict: Dict, APP_VERSION: APP_VERSION
  };
  window.SDPStudio = load;
  window.SDPStudioReady = function () { return state === 2; };
  setTimeout(function () { load(); }, 0);
  var openPanel = Admin.open;
  Admin.open = function () { load(); return openPanel.apply(this, arguments); };
})();
