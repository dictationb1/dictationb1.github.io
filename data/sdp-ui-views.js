/*! Smart Dictation Player — views, i18n & router (v0.0.1.a)
 * Strict ES5, dependency free, no runtime CSS injection.
 * contract: docs/UI_COMPONENT_GUIDE.md §Components
 * contract: docs/ARCHITECTURE_MAP.md §R3 single-active-screen, §R9 data toast */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;
  var APP_VERSION = '0.0.1.b';

  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function setText(el, text) { if (el) el.textContent = str(text); }
  function esc(text) {
    return str(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function on(id, evt, fn) {
    var node = byId(id);
    if (!node || node['_sdp_' + evt]) return null;
    node['_sdp_' + evt] = true;
    node.addEventListener(evt, fn);
    return node;
  }

  /* ══ STRINGS ════════════════════════════════════════════════════════════ */
  /* contract: docs/UI_COMPONENT_GUIDE.md §Language purity (W7) */
  var STRINGS_EN = {
    appName: 'Smart Dictation',
    guideBtn: '? Guide',
    tabHome: 'Home', tabPlayer: 'Dictation', tabPractice: 'Practice', tabWords: '30 Words', tabSettings: 'Settings',
    homeTitle: 'Smart Dictation', homeSub: 'Listen, write, and check 30 B1 words with your class.',
    startDictation: 'Start Dictation', howToUse: 'How to Use',
    paperMode: 'Paper', typingMode: 'Typing', resumeSession: 'Continue where you stopped',
    statMastered: 'Mastered', statAccuracy: 'Accuracy', statStreak: 'Day streak',
    quickPractice: 'Quick practice', flashcards: 'Flashcards', quiz: '4-Choice Quiz', listening: 'Listening Drill',
    weakWords: 'Weak Words', mastered: 'Mastered', announcements: 'Class announcement',
    creditsLine: 'Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 / Lesandu',
    creditsPill: 'CREDITS GOES TO Hansana',
    btnPrev: 'Previous', btnPlayPause: 'Listen / Pause', btnNext: 'Next', btnRepeat: 'Repeat', btnHint: 'Hint',
    btnModeSwitch: 'Paper / Typing', btnFinish: 'Finish & check',
    readyBeat: 'Ready', listeningBeat: 'Listening', writeNowBeat: 'Write Now', pausedBeat: 'Paused',
    finishedBeat: 'Finished — check your answers', repeatWord: 'Repeat', remainingWord: 'remaining',
    noWords: 'No words loaded yet', hintPos: 'Word type', hintFirst: 'First letter', hintSi: 'Sinhala meaning',
    hintSentence: 'Example sentence', playAudio: 'Play audio',
    resultsTitle: 'Self-Check & Results', colYourWord: 'Your word', colCorrectWord: 'Correct word', colMark: 'Mark',
    markCorrect: 'Correct', markMissed: 'Missed', markAll: 'Mark all correct', toggleMissed: 'Toggle missed',
    btnRetryMissed: 'Retry missed words', btnNewSession: 'Start new session',
    filterAll: 'All 30', searchWords: 'Search words', noWordsFound: 'No words found',
    tapToFlip: 'Tap the card to see the meaning', nextCard: 'Next card', prevCard: 'Previous card',
    chooseMeaning: 'Choose the correct meaning', listenAndChoose: 'Listen and choose the correct word',
    weakWordsOnly: 'Weak words only', correctPick: 'Correct!', wrongPick: 'Not quite',
    setPacing: '1 · Dictation pacing & mode', modeLabel: 'Mode', writeTime: 'Writing time', repeats: 'Word repeats',
    pauseBetween: 'Pause between repeats', autoAdvance: 'Advance automatically',
    setAudio: '2 · Audio & voice', voiceSource: 'Voice source', voiceAuto: 'Auto (best British voice)',
    voiceLecturer: 'Lecturer clips', voiceAlice: 'Alice (ElevenLabs UK)', voiceDevice: 'Device voice',
    rate: 'Speech rate', volume: 'Volume', testVoice: 'Test Voice',
    setLangTheme: '3 · Language & appearance', language: 'Language', theme: 'Theme',
    themeDark: 'Dark', themeLight: 'Light', langEnglish: 'English', langSinhala: 'Sinhala',
    aboutTitle: '5 · About this app',
    aboutBlurb: 'A free, offline-first dictation trainer for one class — no accounts, no ads, no tracking.',
    aboutAudience: 'Built for the CCBE Galle Branch — B1 English Class, Sri Lanka.',
    aboutVersionLabel: 'Version', aboutBuiltLabel: 'Built',
    aboutDataLink: 'See every byte this app stores',
    emptyBank: 'No word list is available yet. Connect once, then tap "Check for session update" in Settings.',
    setProgress: '4 · Progress & offline storage', exportBackup: 'Export backup', importBackup: 'Import backup',
    resetStats: 'Reset local stats', checkUpdate: 'Check for session update',
    studioTitle: '6 · Lecturer Studio & admin vault', studioLocked: 'Enter the lecturer PIN to open the studio.',
    guideSpeakBtn: 'Listen to the steps (EN)', guideCloseBtn: 'Got it, Start Learning',
    /* Table B additions — UI labels, badges, presets and studio controls */
    dictSearchPh: 'Search 30 words (English, Sinhala, IPA)...',
    syncBadgeSynced: 'Synced · Session 8 · v0.0.1.b',
    syncBadgeOffline: 'Offline — showing cached session',
    syncBadgeUpdate: 'Update found — tap to reload',
    syncBadgeRetry: 'Check failed — retry',
    guidePauseVoice: '⏸ Pause Voice',
    guideResumeVoice: '▶ Resume Voice',
    guideNextStep: '⏭ Next Step',
    guideReplayStep: '🔁 Replay Step',
    guideReplay: '🎓 Replay Step-by-Step Voice Guide',
    guideAutoPlay: 'Auto-play English voice guide on start',
    presetHeading: 'Quick Pacing Presets',
    presetBeginner: '🐢 Beginner Slow (12s · 4×)',
    presetStandard: '🎯 CCBE B1 Standard (8s · 3×)',
    presetExam: '⚡ Fast Exam (5s · 2×)',
    presetBoard: '🖥️ Smart Board Class Mode',
    themeBoard: 'Smart Board High-Contrast',
    voiceLockLabel: 'Voice Persona Lock',
    voiceLockUnified: 'British Female Professor (Unified 25–35 UK)',
    voiceLockCustom: 'Follow Individual Tier Source',
    downloadClips: '🔊 Download All 30 Word Audio Clips for Offline Use',
    downloadClipsDone: 'Cached 30 of 30 audio clips for offline use',
    studioFirstTime: 'First-Time Studio Setup: Set Your 4–8 Digit Lecturer PIN + API Keys',
    studioTestEl: 'Test ElevenLabs Key',
    studioTestGh: 'Test GitHub Token',
    studioShow: 'Show',
    studioHide: 'Hide',
    studioPaste: 'Paste',
    pinPadClear: 'Clear',
    pinPadUnlock: 'Unlock',
    studioCommitClip: 'Commit Recorded Clip',
    guideStep1Title: '1. Choose how you learn',
    guideStep1Body: 'Paper Mode means writing each word in your exercise book as you hear it. Typing Mode means typing directly on your phone or laptop.',
    guideStep2Title: '2. Listen and write against the timer',
    guideStep2Body: 'Each word is read aloud in a British accent several times. Write it while the ring counts down; the player moves from 1 to 30 by itself.',
    guideStep3Title: '3. Check all 30 words and see your score',
    guideStep3Body: 'In Paper Mode you tick each word you wrote correctly against the IPA and Sinhala meaning. In Typing Mode spelling is graded automatically and missed words join your weak-word list.',
    guideStep4Title: '4. Practise the words you missed',
    guideStep4Body: 'Open the Words tab any time to review all 30 words. Train the weak ones in Practice with flashcards, four-choice questions and listening drills.',
    toastLoaded: 'Loaded', toastOffline: 'Offline ready',
    updateChecking: 'Checking for a newer session…', updateNone: 'You already have the latest session',
    updateFound: 'New session downloaded', resetDone: 'Local stats cleared', exportReady: 'Backup downloaded',
    importOk: 'Backup restored', importBad: 'That backup file could not be read',
    presetApplied: 'Preset applied',
    storageLine: 'stored on this device', resumeAt: 'Continue from word',
    voiceTest: 'Voice test', playWordAudio: 'Play', listen: 'Listen',
    studioPinLabel: 'Lecturer PIN', studioUnlock: 'Unlock studio', studioSetup: 'Create the vault',
    studioSetupHint: 'First time here? Choose a PIN to create the encrypted vault.',
    studioLockedOut: 'Too many wrong PINs. Try again in', seconds: 'seconds',
    studioBadPin: 'Wrong PIN', studioEditor: 'Session words (one per line: w | ipa | pos | meaning | sinhala | sentence)',
    studioPreview: 'Publish preview', studioPublish: 'Publish session', studioGenerate: 'Generate Alice clips',
    studioRecord: 'Record word', studioSave: 'Save draft', studioLock: 'Lock studio',
    studioEnvelope: 'Encrypted vault envelope (SDP_ENC_V2)', studioCopy: 'Copy envelope',
    studioPublishOk: 'Session published', studioPublishFail: 'Publish failed',
    studioNoToken: 'Add a GitHub token (Contents API) in the vault first', studioWordsCount: 'words parsed',
    studioElevenNote: 'ElevenLabs generation runs only while unlocked, using the Alice voice and flash_v2_5.'
  };

  /* contract: docs/UI_COMPONENT_GUIDE.md §H7 verified Sinhala strings */
  var STRINGS_SI = {
    appName: 'Smart Dictation',
    guideBtn: '? උපදෙස්',
    tabHome: 'මුල් පිටුව', tabPlayer: 'ඩික්ටේෂන්', tabPractice: 'අභ්‍යාස', tabWords: 'වචන 30', tabSettings: 'සැකසුම්',
    homeTitle: 'Smart Dictation', homeSub: 'ඔබේ පන්තියේ B1 වචන 30 අසමින් ලියන්න, පසුව පරීක්ෂා කරන්න.',
    startDictation: 'ඩික්ටේෂන් ආරම්භ කරන්න', howToUse: 'භාවිතා කරන ආකාරය',
    paperMode: 'පොතේ ලිවීම', typingMode: 'ටයිප් කිරීම', resumeSession: 'නැවැත්වූ තැනින් ඉදිරියට යන්න',
    statMastered: 'ප්‍රගුණ කළ වචන', statAccuracy: 'නිවැරදිභාවය', statStreak: 'දින පෙළ',
    quickPractice: 'ක්ෂණික අභ්‍යාස', flashcards: 'ෆ්ලෑෂ් කාඩ්', quiz: 'බහුවරණ ප්‍රශ්න', listening: 'ශ්‍රවණ අභ්‍යාස',
    weakWords: 'දුර්වල වචන', mastered: 'ප්‍රගුණ කළ', announcements: 'පන්ති දැනුම්දීම',
    creditsLine: 'නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini',
    creditsPill: 'CREDITS GOES TO Hansana',
    btnPrev: 'පෙර වචනය', btnPlayPause: 'අසන්න / නවතන්න', btnNext: 'ඊළඟ වචනය', btnRepeat: 'නැවත අසන්න',
    btnHint: 'ඉඟියක්', btnModeSwitch: 'පොතේ / ටයිප් මාරුව', btnFinish: 'අවසන් කර පිළිතුරු බලන්න',
    readyBeat: 'සූදානම්', listeningBeat: 'අසන්න', writeNowBeat: 'දැන් ලියන්න', pausedBeat: 'තාවකාලිකව නවතා ඇත',
    finishedBeat: 'අවසන් — පිළිතුරු පරීක්ෂා කරන්න', repeatWord: 'වාරය', remainingWord: 'ඉතිරි',
    noWords: 'වචන තවම පූරණය වී නැත', hintPos: 'වචන වර්ගය', hintFirst: 'පළමු අක්ෂරය', hintSi: 'සිංහල තේරුම',
    hintSentence: 'උදාහරණ වාක්‍යය', playAudio: 'හඬ වාදනය',
    resultsTitle: 'ස්වයං පරීක්ෂාව සහ ප්‍රතිඵල', colYourWord: 'ඔබ ලියූ වචනය', colCorrectWord: 'නිවැරදි වචනය', colMark: 'ලකුණු කිරීම',
    markCorrect: 'නිවැරදි', markMissed: 'වැරදි', markAll: 'සියල්ල නිවැරදි ලෙස ලකුණු කරන්න', toggleMissed: 'වැරදි මාරු කරන්න',
    btnRetryMissed: 'වැරදුණු වචන පමණක් නැවත ලියන්න', btnNewSession: 'නව වාරයක් අරඹන්න',
    filterAll: 'සියල්ල 30', searchWords: 'වචන සොයන්න', noWordsFound: 'වචන හමු නොවීය',
    tapToFlip: 'තේරුම බැලීමට කාඩ්පත ස්පර්ශ කරන්න', nextCard: 'ඊළඟ', prevCard: 'පෙර',
    chooseMeaning: 'නිවැරදි තේරුම තෝරන්න', listenAndChoose: 'අසා නිවැරදි වචනය තෝරන්න',
    weakWordsOnly: 'දුර්වල වචන පමණක්', correctPick: 'නිවැරදි!', wrongPick: 'වැරදි',
    setPacing: '1 · ඩික්ටේෂන් වේගය සහ ආකාරය', modeLabel: 'ආකාරය', writeTime: 'ලිවීමට කාලය', repeats: 'වචන පුනරාවර්තන',
    pauseBetween: 'පුනරාවර්තන අතර විරාමය', autoAdvance: 'ස්වයංක්‍රීයව ඉදිරියට යන්න',
    setAudio: '2 · හඬ සහ උච්චාරණය', voiceSource: 'හඬ මූලාශ්‍රය', voiceAuto: 'ස්වයංක්‍රීය (හොඳම බ්‍රිතාන්‍ය හඬ)',
    voiceLecturer: 'කථිකාචාර්ය පටිගත කිරීම්', voiceAlice: 'Alice (ElevenLabs UK)', voiceDevice: 'උපාංගයේ හඬ',
    rate: 'කථන වේගය', volume: 'හඬ පරිමාව', testVoice: 'හඬ පරීක්ෂා කරන්න',
    setLangTheme: '3 · භාෂාව සහ පෙනුම', language: 'භාෂාව', theme: 'තේමාව',
    themeDark: 'අඳුරු', themeLight: 'දීප්ත', langEnglish: 'English', langSinhala: 'සිංහල',
    aboutTitle: '5 · මෙම යෙදුම ගැන',
    aboutBlurb: 'එක් පන්තියක් සඳහා නොමිලේ සකසන ලද, අන්තර්ජාලය නොමැතිව ද ක්‍රියා කරන අක්ෂර වින්‍යාස පුහුණු යෙදුමක් — ගිණුම් නැත, දැන්වීම් නැත, ලුහුබැඳීම් නැත.',
    aboutAudience: 'කොළඹ විශ්ව විද්‍යාලයීය ව්‍යාප්ත අධ්‍යයන මධ්‍යස්ථානය — ගාල්ල ශාඛාවේ B1 ඉංග්‍රීසි පන්තිය සඳහා.',
    aboutVersionLabel: 'අනුවාදය', aboutBuiltLabel: 'නිර්මිත දිනය',
    aboutDataLink: 'මෙම යෙදුම සුරකින සෑම දත්තයක්ම බලන්න',
    emptyBank: 'තවම වචන ලැයිස්තුවක් නොමැත. එක් වරක් අන්තර්ජාලයට සම්බන්ධ වී, සැකසුම් තුළ "Check for session update" ඔබන්න.',
    setProgress: '4 · ප්‍රගතිය සහ නොබැඳි ගබඩාව', exportBackup: 'උපස්ථයක් අපනයනය', importBackup: 'උපස්ථයක් ආනයනය',
    resetStats: 'දේශීය සංඛ්‍යාලේඛන මකන්න', checkUpdate: 'වාර යාවත්කාලීනය පරීක්ෂා කරන්න',
    studioTitle: '6 · කථිකාචාර්ය ස්ටුඩියෝ සහ පරිපාලන බඳුන', studioLocked: 'ස්ටුඩියෝ විවෘත කිරීමට කථිකාචාර්ය PIN ඇතුළත් කරන්න.',
    guideSpeakBtn: 'උපදෙස් හඬින් අසන්න (EN)', guideCloseBtn: 'තේරුණා, ආරම්භ කරමු',
    /* Table B additions — Sinhala UI labels, badges, presets and studio controls */
    dictSearchPh: 'වචන 30 සොයන්න (ඉංග්‍රීසි, සිංහල, උච්චාරණය)...',
    syncBadgeSynced: 'සමමුහුර්තයි · 8 වන වාරය · v0.0.1.b',
    syncBadgeOffline: 'අන්තර්ජාලය නැත — සුරැකි වාරය පෙන්වයි',
    syncBadgeUpdate: 'නව යාවත්කාලීනයක් ඇත — නැවත පූරණයට ඔබන්න',
    syncBadgeRetry: 'පරීක්ෂාව අසාර්ථකයි — නැවත උත්සාහ කරන්න',
    guidePauseVoice: '⏸ හඬ නවතන්න',
    guideResumeVoice: '▶ හඬ අරඹන්න',
    guideNextStep: '⏭ ඊළඟ පියවර',
    guideReplayStep: '🔁 මෙම පියවර නැවත අසන්න',
    guideReplay: '🎓 පියවරෙන් පියවර හඬ උපදෙස් නැවත අසන්න',
    guideAutoPlay: 'ආරම්භයේදී ඉංග්‍රීසි හඬ උපදෙස් ස්වයංක්‍රීයව වාදනය කරන්න',
    presetHeading: 'ඉක්මන් කාල සැකසුම් (Presets)',
    presetBeginner: '🐢 ආරම්භක මන්දගාමී (තත් 12 · 4×)',
    presetStandard: '🎯 CCBE B1 සාමාන්‍ය (තත් 8 · 3×)',
    presetExam: '⚡ විභාග වේගවත් (තත් 5 · 2×)',
    presetBoard: '🖥️ ස්මාර්ට් බෝඩ් පන්ති ප්‍රකාරය',
    themeBoard: 'ස්මාර්ට් බෝඩ් අධි-පැහැදිලි තේමාව',
    voiceLockLabel: 'හඬ අගුල (Voice Lock)',
    voiceLockUnified: 'බ්‍රිතාන්‍ය කාන්තා කථිකාචාර්ය හඬ (ඒකාබදද්ධ 25–35 UK)',
    voiceLockCustom: 'තෝරාගත් හඬ මූලාශ්‍රය අනුව',
    downloadClips: '🔊 අන්තර්ජාලය නොමැතිව භාවිතයට වචන 30 හඬපට බාගන්න',
    downloadClipsDone: 'වචන 30න් 30ම නොබැඳි භාවිතයට සුරැකිණි',
    studioFirstTime: 'පළමු වරට ස්ටුඩියෝ පිහිටුවීම: ඉලක්කම් 4–8 කථිකාචාර්ය PIN අංකය සහ API යතුරු ඇතුළත් කරන්න',
    studioTestEl: 'ElevenLabs යතුර පරීක්ෂා කරන්න',
    studioTestGh: 'GitHub යතුර පරීක්ෂා කරන්න',
    studioShow: 'පෙන්වන්න',
    studioHide: 'සඟවන්න',
    studioPaste: 'අලවන්න',
    pinPadClear: 'මකන්න',
    pinPadUnlock: 'විවෘත කරන්න',
    studioCommitClip: 'පටිගත කළ හඬපටය සුරකින්න',
    guideStep1Title: '1. ඔබේ ඉගෙනුම් ආකාරය තෝරන්න',
    guideStep1Body: 'පොතේ ලිවීම (Paper Mode) යනු අසන අතරේ වචන ඔබේ අභ්‍යාස පොතේ ලිවීමයි; ටයිප් කිරීම (Typing Mode) යනු දුරකථනයේ හෝ පරිගණකයේ කෙළින්ම ටයිප් කිරීමයි.',
    guideStep2Title: '2. අසා කාල ගණකය අතරේ ලියන්න',
    guideStep2Body: 'එක් එක් වචනය බ්‍රිතාන්‍ය උච්චාරණයෙන් වාර ගණනක් ඇසෙයි; කාල ගණකය ගණන් කරන අතරේ වචනය ලියන්න; 1 සිට 30 දක්වා ස්වයංක්‍රීයව ඉදිරියට යයි.',
    guideStep3Title: '3. වචන 30 පරීක්ෂා කර ලකුණු බලන්න',
    guideStep3Body: 'පොතේ ලිවීමේ ආකාරයේදී ඔබ ලියූ වචන 30 නිවැරදි උච්චාරණ සහ සිංහල තේරුම් සමඟ පරීක්ෂා කර ලකුණු කරන්න; ටයිප් කිරීමේදී අක්ෂර වින්‍යාසය ස්වයංක්‍රීයව ලකුණු වන අතර වැරදුණු වචන දුර්වල වචන ලැයිස්තුවට එකතු වේ.',
    guideStep4Title: '4. දුර්වල වචන නැවත පුහුණු වන්න',
    guideStep4Body: 'වචන පිටුවෙන් සියලු වචන 30 ඕනෑම වේලාවක නැවත බලන්න; දුර්වල වචන අභ්‍යාස පිටුවෙන් (ෆ්ලෑෂ් කාඩ්, බහුවරණ ප්‍රශ්න, ශ්‍රවණ අභ්‍යාස) පුහුණු වන්න.',
    toastLoaded: 'පූරණය විය', toastOffline: 'නොබැඳිව සූදානම්',
    updateChecking: 'නව වාරයක් පරීක්ෂා කරමින්…', updateNone: 'ඔබ සතුව නවතම වාරය දැනටමත් ඇත',
    updateFound: 'නව වාරය බාගත විය', resetDone: 'දේශීය සංඛ්‍යාලේඛන මකා දමන ලදී', exportReady: 'උපස්ථය බාගත විය',
    importOk: 'උපස්ථය ප්‍රතිසාධනය විය', importBad: 'එම උපස්ථ ගොනුව කියවිය නොහැක',
    presetApplied: 'සැකසුම යොදවීමට පවතී',
    storageLine: 'මෙම උපාංගයේ ගබඩා කර ඇත', resumeAt: 'මෙම වචනයෙන් දිගටම කරගෙන යන්න',
    voiceTest: 'හඬ පරීක්ෂණය', playWordAudio: 'වාදනය', listen: 'අසන්න',
    studioPinLabel: 'කථිකාචාර්ය PIN', studioUnlock: 'ස්ටුඩියෝ විවෘත කරන්න', studioSetup: 'බඳුන සාදන්න',
    studioSetupHint: 'පළමු වතාවද? සංකේතිත බඳුන සෑදීමට PIN එකක් තෝරන්න.',
    studioLockedOut: 'වැරදි PIN ගණන වැඩිය. නැවත උත්සාහ කරන්න', seconds: 'තත්පර',
    studioBadPin: 'වැරදි PIN', studioEditor: 'වාරයේ වචන (පේළියකට එකක්: w | ipa | pos | meaning | sinhala | sentence)',
    studioPreview: 'ප්‍රකාශන පෙරදසුන', studioPublish: 'වාරය ප්‍රකාශයට පත් කරන්න', studioGenerate: 'Alice හඬ පටි සාදන්න',
    studioRecord: 'වචනය පටිගත කරන්න', studioSave: 'කෙටුම්පත සුරකින්න', studioLock: 'ස්ටුඩියෝ අගුළු දමන්න',
    studioEnvelope: 'සංකේතිත බඳුන ලියුම (SDP_ENC_V2)', studioCopy: 'ලියුම පිටපත් කරන්න',
    studioPublishOk: 'වාරය ප්‍රකාශයට පත් විය', studioPublishFail: 'ප්‍රකාශනය අසාර්ථක විය',
    studioNoToken: 'පළමුව බඳුනට GitHub ටෝකනයක් එක් කරන්න', studioWordsCount: 'වචන විග්‍රහ කර ඇත',
    studioElevenNote: 'ElevenLabs ජනනය සිදු වන්නේ අගුළු හැර ඇති විට පමණක්, Alice හඬ සහ flash_v2_5 සමඟය.'
  };

  var lang = 'en';
  var theme = 'dark';
  var initialized = false;
  var practice = { mode: 'flash', index: 0, flipped: false, answered: '', score: 0, pool: [] };

  function t(key, fallback) {
    var table = lang === 'si' ? STRINGS_SI : STRINGS_EN;
    var value = table[key];
    if (value === undefined) value = STRINGS_EN[key];
    if (value === undefined) return fallback === undefined ? key : fallback;
    return value;
  }
  function settings() {
    try { return SDP.Data.settings(); } catch (e) { return { mode: 'paper', lang: 'en', theme: 'dark' }; }
  }
  function words() {
    try { return SDP.Sync && SDP.Sync.words ? SDP.Sync.words() : []; } catch (e) { return []; }
  }
  function stats() {
    try { return SDP.Data.stats(); } catch (e) { return { mastered: 0, accuracy: 0, streak: 0 }; }
  }

  /* ══ language / theme ═══════════════════════════════════════════════════ */
  function applyI18n() {
    var nodes = doc.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      if (!key) continue;
      var value = t(key);
      if (value !== undefined) nodes[i].textContent = value;
    }
    var placeholders = doc.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < placeholders.length; j++) {
      var pkey = placeholders[j].getAttribute('data-i18n-placeholder');
      if (!pkey) continue;
      var pvalue = t(pkey);
      if (pvalue !== undefined) placeholders[j].placeholder = pvalue;
    }
  }
  function paintLangPills() {
    var pills = [byId('btnLang'), byId('guideLangPill')];
    for (var i = 0; i < pills.length; i++) {
      var pill = pills[i];
      if (!pill) continue;
      var onEl = pill.querySelector ? pill.querySelector('.lang-on') : null;
      var offEl = pill.querySelector ? pill.querySelector('.lang-off') : null;
      if (onEl) onEl.style.opacity = lang === 'en' ? '1' : '0.45';
      if (offEl) offEl.style.opacity = lang === 'si' ? '1' : '0.45';
      pill.setAttribute('aria-label', lang === 'en' ? 'Switch to Sinhala' : 'Switch to English');
    }
  }

  function applyLang(next, quiet) {
    lang = next === 'si' ? 'si' : 'en';
    if (doc && doc.documentElement) doc.documentElement.setAttribute('lang', lang === 'si' ? 'si' : 'en');
    if (doc && doc.body) doc.body.setAttribute('data-lang', lang);
    if (!quiet) { try { SDP.Data.saveSettings({ lang: lang }); } catch (e) {} }
    applyI18n();
    paintLangPills();
    var select = byId('setLang');
    if (select) select.value = lang;
    renderHome();
    renderWords();
    renderPractice();
    renderGuideSteps();
    renderSettings();
    if (SDP.Engine) {
      if (SDP.Engine.repaintState) { try { SDP.Engine.repaintState(); } catch (e) {} }
      if (SDP.Engine.renderResults && SDP.Engine.state && SDP.Engine.state() === 'finished') {
        try { SDP.Engine.renderResults(); } catch (e) {}
      }
    }
    if (SDP.Studio && SDP.Studio.onLangChange) { try { SDP.Studio.onLangChange(); } catch (e) {} }
    return lang;
  }
  function toggleLang() { return applyLang(lang === 'en' ? 'si' : 'en'); }

  function applyTheme(next, quiet) {
    theme = next === 'light' ? 'light' : 'dark';
    if (doc && doc.documentElement) doc.documentElement.setAttribute('data-theme', theme);
    if (doc && doc.body) doc.body.setAttribute('data-theme', theme);
    var meta = doc.querySelector ? doc.querySelector('meta[name="theme-color"]') : null;
    if (meta) meta.setAttribute('content', theme === 'light' ? '#FFFFFF' : '#09090B');
    if (!quiet) { try { SDP.Data.saveSettings({ theme: theme }); } catch (e) {} }
    var select = byId('setTheme');
    if (select) select.value = theme;
    var icon = byId('themeIcon');
    if (icon) setText(icon, theme === 'light' ? '◑' : '◐');
    /* R7 / H5: Smart Board shows a clean quick-word jumper in the cockpit header. */
    var jumper = byId('quickJumper');
    if (jumper) {
      if (name === 'board') { jumper.hidden = false; renderQuickJumper(); }
      else jumper.hidden = true;
    }
    return theme;
  }
  function toggleTheme() { return applyTheme(theme === 'dark' ? 'light' : 'dark'); }

  /* ══ router ═════════════════════════════════════════════════════════════ */
  /* contract: docs/ARCHITECTURE_MAP.md §R3 exactly one active screen */
  var TABS = ['home', 'player', 'practice', 'dict', 'settings'];
  function showTab(name) {
    var target = TABS.indexOf(name) >= 0 ? name : 'home';
    var i;
    for (i = 0; i < TABS.length; i++) {
      var screen = byId('screen-' + TABS[i]);
      if (!screen) continue;
      if (TABS[i] === target) {
        if (screen.classList) screen.classList.add('active');
        screen.setAttribute('aria-hidden', 'false');
      } else {
        if (screen.classList) screen.classList.remove('active');
        screen.setAttribute('aria-hidden', 'true');
      }
    }
    var tabIds = ['tab-home', 'tab-player', 'tab-practice', 'tab-dict', 'tab-settings'];
    for (i = 0; i < tabIds.length; i++) {
      var node = byId(tabIds[i]);
      if (node) node.setAttribute('aria-selected', String(tabIds[i] === 'tab-' + target));
    }
    var rails = doc.querySelectorAll('#sdpSideRail [data-tab]');
    for (i = 0; i < rails.length; i++) rails[i].setAttribute('aria-selected', String(rails[i].getAttribute('data-tab') === target));
    if (target === 'dict') renderWords();
    if (target === 'home') renderHome();
    if (target === 'practice') renderPractice();
    if (target === 'settings') renderSettings();
    if (target === 'player' && SDP.Engine && SDP.Engine.refreshEls) SDP.Engine.refreshEls();
    return target;
  }
  function currentTab() {
    for (var i = 0; i < TABS.length; i++) {
      var screen = byId('screen-' + TABS[i]);
      if (screen && screen.classList && screen.classList.contains('active')) return TABS[i];
    }
    return 'home';
  }

  /* ══ Home ═══════════════════════════════════════════════════════════════ */
  function renderHome() {
    var s = stats();
    var bank = words().length;
    var total = bank || 30;
    /* An empty bank is a real state (first run offline), so say so instead of
       promising thirty words that do not exist. */
    var empty = byId('bankEmpty');
    if (empty) empty.hidden = bank > 0;
    var start = byId('btnStart');
    if (start) {
      start.disabled = bank === 0;
      if (bank === 0) start.setAttribute('aria-disabled', 'true');
      else start.removeAttribute('aria-disabled');
    }
    setText(byId('statMastered'), bank ? s.mastered + ' / ' + total : '—');
    setText(byId('statAccuracy'), s.accuracy + '%');
    setText(byId('statStreak'), String(s.streak));
    var line = doc.querySelector ? doc.querySelector('#creditFoot .credit-line') : null;
    if (line) setText(line, t('creditsLine'));
    var pill = doc.querySelector ? doc.querySelector('#creditFoot .credits-pill') : null;
    if (pill) setText(pill, 'CREDITS GOES TO Hansana');
    var banner = byId('resumeBanner');
    var draft = null;
    try { draft = SDP.Data.session(); } catch (e) {}
    var resumable = draft && typeof draft.index === 'number' && draft.answers && Object.keys(draft.answers).length > 0;
    if (banner) banner.hidden = !resumable;
    if (resumable) setText(byId('resumeText'), t('resumeAt') + ' ' + (draft.index + 1));
    var ann = byId('homeAnn');
    var announcement = null;
    try { announcement = SDP.Sync && SDP.Sync.announcement ? SDP.Sync.announcement() : null; } catch (e) {}
    var annText = isObj(announcement) ? str(announcement.text || announcement.title) : str(announcement);
    if (ann) ann.hidden = !annText;
    setText(byId('homeAnnText'), annText);
    paintModePills();
  }
  function paintModePills() {
    var mode = settings().mode === 'typing' ? 'typing' : 'paper';
    var pills = doc.querySelectorAll('#homeModePills [data-mode]');
    for (var i = 0; i < pills.length; i++) pills[i].setAttribute('aria-pressed', String(pills[i].getAttribute('data-mode') === mode));
    var segPaper = byId('setModePaper');
    var segTyping = byId('setModeTyping');
    if (segPaper) segPaper.setAttribute('aria-pressed', String(mode === 'paper'));
    if (segTyping) segTyping.setAttribute('aria-pressed', String(mode === 'typing'));
  }
  function applyModePills(mode) {
    var pills = doc.querySelectorAll('#homeModePills [data-mode]');
    for (var i = 0; i < pills.length; i++) pills[i].setAttribute('aria-pressed', String(pills[i].getAttribute('data-mode') === mode));
    var segPaper = byId('setModePaper');
    var segTyping = byId('setModeTyping');
    if (segPaper) segPaper.setAttribute('aria-pressed', String(mode === 'paper'));
    if (segTyping) segTyping.setAttribute('aria-pressed', String(mode === 'typing'));
  }

  function startDictation(mode) {
    var chosen = mode || settings().mode;
    if (!words().length) {
      /* Never open an empty cockpit: retry the boot, then tell the student
         plainly what to do next. */
      try { SDP.Sync.boot({}, function () { startDictation(chosen); }); } catch (e) {}
      showToast(t('emptyBank'));
      showTab('home');
      renderHome();
      return false;
    }
    try { SDP.Data.saveSettings({ mode: chosen }); } catch (e) {}
    try { SDP.Engine.start({ mode: chosen }); } catch (e) {}
    showTab('player');
    return true;
  }
  function resumeDictation() {
    var draft = null;
    try { draft = SDP.Data.session(); } catch (e) {}
    if (!draft) { startDictation(); return; }
    try {
      SDP.Engine.start({ mode: draft.mode || settings().mode, startIndex: draft.index || 0, answers: draft.answers || {} });
    } catch (e) {}
    showTab('player');
  }

  /* ══ Guide 2.0 — version-stamped, auto-narrating student guide (R3, D3) ══ */
  var guideState = { activeStep: 0, narrating: false, opener: null };
  var guidePaused = false;

  function renderGuideSteps() {
    var host = byId('guideSteps');
    if (!host) return;
    var html = '', i;
    for (i = 1; i <= 4; i++) {
      html += '<li class="guide-step" data-step="' + (i - 1) + '">' +
        '<h3>' + esc(t('guideStep' + i + 'Title')) + '</h3>' +
        '<p>' + esc(t('guideStep' + i + 'Body')) + '</p>' +
        '</li>';
    }
    host.innerHTML = html;
    var steps = host.querySelectorAll ? host.querySelectorAll('.guide-step') : [];
    for (i = 0; i < steps.length; i++) steps[i].classList.remove('guide-active');
    if (steps[guideState.activeStep]) steps[guideState.activeStep].classList.add('guide-active');
  }
  function highlightGuideStep(idx) {
    var host = byId('guideSteps');
    if (!host) return;
    var steps = host.querySelectorAll ? host.querySelectorAll('.guide-step') : [];
    var j;
    for (j = 0; j < steps.length; j++) steps[j].classList.remove('guide-active');
    if (steps[idx]) {
      steps[idx].classList.add('guide-active');
      guideState.activeStep = idx;
    }
  }
  function startGuideNarration(fromStep) {
    if (guideState.narrating) return;
    guideState.narrating = true;
    guideState.activeStep = Math.max(0, Math.min(3, Number(fromStep) || 0));
    renderGuideSteps();
    function speakStep(idx) {
      if (idx > 3) { guideState.narrating = false; return; }
      highlightGuideStep(idx);
      var title = t('guideStep' + (idx + 1) + 'Title');
      var body = t('guideStep' + (idx + 1) + 'Body');
      /* R3: narration always speaks English, even when the cards show SI. */
      try { SDP.Speech.playGuideStep(title + '. ' + body, { lang: 'en-GB', rate: 0.94, pitch: 1.03 }, function () {
        speakStep(idx + 1);
      }); } catch (e) { guideState.narrating = false; }
    }
    speakStep(guideState.activeStep);
  }
  function stopGuideNarration() {
    guidePaused = false;
    var btn = byId('guidePauseVoice');
    if (btn) btn.textContent = t('guidePauseVoice');
    try { if (SDP.Speech) SDP.Speech.stop(); } catch (e) {}
    guideState.narrating = false;
  }
  function toggleGuidePause() {
    if (!guideState.narrating && !guidePaused) return;
    var btn = byId('guidePauseVoice');
    try {
      if (global.speechSynthesis && typeof global.speechSynthesis.pause === 'function') {
        if (guidePaused) { global.speechSynthesis.resume(); guidePaused = false; if (btn) btn.textContent = t('guidePauseVoice'); }
        else { global.speechSynthesis.pause(); guidePaused = true; if (btn) btn.textContent = t('guideResumeVoice'); }
        return;
      }
    } catch (e) {}
    /* No synth pause: restart the current step instead. */
    if (guidePaused) { guidePaused = false; if (btn) btn.textContent = t('guidePauseVoice'); startGuideNarration(guideState.activeStep); }
    else { stopGuideNarration(); }
  }
  function guideNextStep() {
    stopGuideNarration();
    startGuideNarration(Math.min(3, guideState.activeStep + 1));
  }
  function guideReplayStep() {
    stopGuideNarration();
    startGuideNarration(guideState.activeStep);
  }
  function openGuide(opener) {
    var modal = byId('guideModal');
    if (!modal) return false;
    guideState.opener = opener || null;
    guidePaused = false;
    renderGuideSteps();
    var btn = byId('guidePauseVoice');
    if (btn) btn.textContent = t('guidePauseVoice');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    if (modal.classList) modal.classList.add('is-open');
    var conf = settings();
    if (conf.guideAutoPlay !== false) startGuideNarration(0);
    /* R3 fallback: if the browser blocks un-gestured speech, the student's
       first tap inside the modal starts the English narration. */
    if (!modal._guideNarrationBound) {
      modal._guideNarrationBound = true;
      modal.addEventListener('click', function () { if (!guideState.narrating) startGuideNarration(guideState.activeStep); }, false);
      modal.addEventListener('touchstart', function () { if (!guideState.narrating) startGuideNarration(guideState.activeStep); }, false);
    }
    var close = byId('btnGuideClose');
    if (close && close.focus) { try { close.focus({ preventScroll: true }); } catch (e) {} }
    return true;
  }
  function closeGuide() {
    var modal = byId('guideModal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      if (modal.classList) modal.classList.remove('is-open');
    }
    stopGuideNarration();
    /* W7: write the version stamp so the guide re-opens on the next upgrade. */
    try { SDP.Data.markGuideSeen(); } catch (e) {}
    var opener = guideState.opener;
    if (opener && typeof opener.focus === 'function') { try { opener.focus({ preventScroll: true }); } catch (e) {} }
    guideState.opener = null;
    guideState.activeStep = 0;
    return true;
  }
  function speakGuide() {
    var lines = [];
    for (var i = 1; i <= 4; i++) {
      lines.push(STRINGS_EN['guideStep' + i + 'Title']);
      lines.push(STRINGS_EN['guideStep' + i + 'Body']);
    }
    try { SDP.Speech.say(lines, { lang: 'en-GB', rate: 0.94, pitch: 1.03 }, noop); } catch (e) {}
    return lines.length;
  }
  function trapGuideKeys() {
    if (doc.documentElement._sdpGuideKeys) return;
    doc.documentElement._sdpGuideKeys = true;
    doc.addEventListener('keydown', function (ev) {
      var modal = byId('guideModal');
      if (!modal || modal.hidden) return;
      if (ev.key === 'Escape') { ev.preventDefault(); closeGuide(); return; }
      if (ev.key === 'Tab') {
        var focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (ev.shiftKey) {
          if (doc.activeElement === first) { ev.preventDefault(); last.focus(); }
        } else if (doc.activeElement === last || !modal.contains(doc.activeElement)) {
          ev.preventDefault(); first.focus();
        }
      }
    }, true);
  }

  /* ══ Words explorer ═════════════════════════════════════════════════════ */
  function wordFilter() {
    var active = doc.querySelector ? doc.querySelector('#dictFilterRow [aria-pressed="true"]') : null;
    return active ? str(active.getAttribute('data-filter')) : 'all';
  }
  function renderWords() {
    var host = byId('dictList');
    if (!host) return 0;
    var list = words();
    var query = str(byId('dictSearch') ? byId('dictSearch').value : '').toLowerCase();
    var filter = wordFilter();
    var progress = {};
    try { progress = SDP.Data.progress(); } catch (e) {}
    var weak = (progress.weakWords || []).slice(0);
    var html = '', shown = 0, i;
    for (i = 0; i < list.length; i++) {
      var w = list[i];
      var key = str(w.w).toLowerCase();
      if (query && key.indexOf(query) < 0 && str(w.si).indexOf(query) < 0 && str(w.m).toLowerCase().indexOf(query) < 0) continue;
      if (filter === 'weak' && weak.indexOf(key) < 0) continue;
      if (filter === 'mastered' && !progress.mastered[key]) continue;
      shown += 1;
      html += '<article class="dict-card" data-word="' + esc(w.w) + '">' +
        '<div class="d-body">' +
        '<div class="d-top"><span class="d-idx">#' + (i + 1) + '</span> <strong class="d-w">' + esc(w.w) + '</strong> <span class="d-pos">' + esc(w.pos) + '</span></div>' +
        '<div class="d-p">/' + esc(w.p) + '/</div>' +
        '<div class="d-m">' + esc(w.m) + '</div>' +
        '<div class="word-si">' + esc(w.si) + '</div>' +
        '<div class="d-s">' + esc(w.s) + '</div>' +
        '</div>' +
        '<button type="button" class="btn btn-sm d-play" data-play="' + esc(w.w) + '" aria-label="' + esc(t('playAudio')) + ' ' + esc(w.w) + '">▶</button>' +
        '</article>';
    }
    var dictEmpty = byId('dictEmpty');
    if (dictEmpty) dictEmpty.hidden = list.length > 0;
    host.innerHTML = shown ? html : (list.length ? '<p class="dict-empty">' + esc(t('noWordsFound')) + '</p>' : '');
    return shown;
  }
  function bindWords() {
    var search = byId('dictSearch');
    if (search && !search._sdpBound) {
      search._sdpBound = true;
      search.addEventListener('input', function () { renderWords(); });
    }
    var filters = byId('dictFilterRow');
    if (filters && !filters._sdpBound) {
      filters._sdpBound = true;
      filters.addEventListener('click', function (ev) {
        var node = ev && ev.target;
        while (node && node !== filters && !(node.getAttribute && node.getAttribute('data-filter'))) node = node.parentNode;
        if (!node || node === filters || !node.getAttribute) return;
        var pills = filters.querySelectorAll('[data-filter]');
        for (var i = 0; i < pills.length; i++) pills[i].setAttribute('aria-pressed', String(pills[i] === node));
        renderWords();
      });
    }
    var list = byId('dictList');
    if (list && !list._sdpBound) {
      list._sdpBound = true;
      list.addEventListener('click', function (ev) {
        var node = ev && ev.target;
        while (node && node !== list && !(node.getAttribute && node.getAttribute('data-play'))) node = node.parentNode;
        if (!node || node === list || !node.getAttribute) return;
        var word = null;
        try { word = SDP.Sync.wordByName(node.getAttribute('data-play')); } catch (e) {}
        if (word && SDP.Speech) SDP.Speech.playWord(word, {}, noop);
      });
    }
  }

  /* ══ Practice ═══════════════════════════════════════════════════════════ */
  function practicePool() {
    var list = words().slice(0);
    var weakOnly = byId('pracWeakOnly');
    if (weakOnly && weakOnly.checked) {
      var progress = {};
      try { progress = SDP.Data.progress(); } catch (e) {}
      var weak = progress.weakWords || [];
      var filtered = [];
      for (var i = 0; i < list.length; i++) if (weak.indexOf(str(list[i].w).toLowerCase()) >= 0) filtered.push(list[i]);
      if (filtered.length) list = filtered;
    }
    return list;
  }
  function shuffle(list) {
    var copy = list.slice(0), i, j, tmp;
    for (i = copy.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }
  function renderPractice() {
    var host = byId('pracStage');
    if (!host) return;
    practice.pool = practicePool();
    if (practice.index >= practice.pool.length) practice.index = 0;
    var pills = doc.querySelectorAll('#pracMode [data-prac]');
    for (var p = 0; p < pills.length; p++) pills[p].setAttribute('aria-selected', String(pills[p].getAttribute('data-prac') === practice.mode));
    var word = practice.pool[practice.index];
    if (!word) { host.innerHTML = '<p class="dict-empty">' + esc(t('noWords')) + '</p>'; return; }
    var html = '';
    if (practice.mode === 'quiz' || practice.mode === 'listen') {
      var distractors = [];
      var others = shuffle(practice.pool.filter(function (x) { return str(x.w) !== str(word.w); }));
      for (var d = 0; d < others.length && distractors.length < 3; d++) distractors.push(others[d]);
      var options = shuffle(distractors.concat([word]));
      var prompt = practice.mode === 'quiz' ? '<div class="prac-word">' + esc(word.w) + '</div><div class="prac-mini">/' + esc(word.p) + '/ · ' + esc(t('chooseMeaning')) + '</div>'
        : '<div class="prac-word">▶</div><div class="prac-mini">' + esc(t('listenAndChoose')) + '</div>';
      html += '<div class="prac-card">' + prompt + '</div><div class="prac-options">';
      for (var o = 0; o < options.length; o++) {
        var label = practice.mode === 'quiz' ? str(options[o].m) : str(options[o].w);
        var state = '';
        if (practice.answered) {
          if (str(options[o].w) === str(word.w)) state = 'ok';
          else if (practice.answered === str(options[o].w)) state = 'bad';
        }
        html += '<button type="button" class="prac-option" data-pick="' + esc(options[o].w) + '" data-state="' + state + '">' + esc(label) + '</button>';
      }
      html += '</div>';
      if (practice.answered) {
        var good = practice.answered === str(word.w);
        html += '<p class="prac-verdict">' + (good ? t('correctPick') : t('wrongPick')) + '</p>';
      }
      html += '<div class="prac-actions">' +
        (practice.mode === 'listen' ? '<button type="button" class="btn btn-sm" data-prac-act="say">' + esc(t('listen')) + '</button>' : '') +
        '<button type="button" class="btn btn-sm" data-prac-act="next">' + esc(t('nextCard')) + '</button></div>';
    } else {
      var face = practice.flipped
        ? '<div class="prac-word si">' + esc(word.si) + '</div><div class="prac-mini">' + esc(word.m) + '</div>'
        : '<div class="prac-word">' + esc(word.w) + '</div><div class="prac-mini">/' + esc(word.p) + '/ · ' + esc(word.pos) + '</div>';
      html += '<div class="prac-card" data-prac-act="flip" role="button" tabindex="0">' + face +
        '<div class="prac-mini">' + esc(t('tapToFlip')) + '</div></div>' +
        '<div class="prac-actions">' +
        '<button type="button" class="btn btn-sm" data-prac-act="say">' + esc(t('listen')) + '</button>' +
        '<button type="button" class="btn btn-sm" data-prac-act="next">' + esc(t('nextCard')) + '</button>' +
        '</div>';
    }
    host.innerHTML = html;
    /* F3: speak a listen-mode card exactly once per card via the spoken flag. */
    if (practice.mode === 'listen' && !practice.answered && !practice.spoken) {
      practice.spoken = true;
      try { if (SDP.Speech) SDP.Speech.playWord(word, {}, noop); } catch (e) {}
    }
  }
  function bindPractice() {
    var modeHost = byId('pracMode');
    if (modeHost && !modeHost._sdpBound) {
      modeHost._sdpBound = true;
      modeHost.addEventListener('click', function (ev) {
        var node = ev && ev.target;
        while (node && node !== modeHost && !(node.getAttribute && node.getAttribute('data-prac'))) node = node.parentNode;
        if (!node || node === modeHost || !node.getAttribute) return;
        practice.mode = str(node.getAttribute('data-prac')) || 'flash';
        practice.index = 0; practice.answered = ''; practice.flipped = false;
        renderPractice();
      });
    }
    var weak = byId('pracWeakOnly');
    if (weak && !weak._sdpBound) {
      weak._sdpBound = true;
      weak.addEventListener('change', function () { practice.index = 0; renderPractice(); });
    }
    var host = byId('pracStage');
    if (host && !host._sdpBound) {
      host._sdpBound = true;
      host.addEventListener('click', function (ev) {
        var node = ev && ev.target;
        var pick = null, act = null;
        while (node && node !== host) {
          if (node.getAttribute) {
            if (!pick && node.getAttribute('data-pick')) pick = node.getAttribute('data-pick');
            if (!act && node.getAttribute('data-prac-act')) act = node.getAttribute('data-prac-act');
          }
          node = node.parentNode;
        }
        var word = practice.pool[practice.index];
        if (pick) {
          practice.answered = str(pick);
          if (practice.answered === str(word && word.w)) practice.score += 1;
          renderPractice();
          return;
        }
        if (act === 'flip') { practice.flipped = !practice.flipped; practice.spoken = false; renderPractice(); return; }
        if (act === 'say' && word) { if (SDP.Speech) SDP.Speech.playWord(word, {}, noop); return; }
        if (act === 'next') {
          practice.index = (practice.index + 1) % Math.max(1, practice.pool.length);
          practice.answered = ''; practice.flipped = false; practice.spoken = false;
          renderPractice();
        }
      });
    }
  }
  function startPractice(mode) {
    practice.mode = mode === 'weak' ? 'flash' : (mode || 'flash');
    if (mode === 'weak') { var weak = byId('pracWeakOnly'); if (weak) weak.checked = true; }
    practice.index = 0; practice.answered = ''; practice.flipped = false; practice.spoken = false;
    showTab('practice');
    renderPractice();
    return practice.mode;
  }

  /* ══ Settings ═══════════════════════════════════════════════════════════ */
  function buildRepeatsOptions(select) {
    /* ONE shared builder for #setRepeats (never duplicated). */
    if (!select || select._sdpBuilt) return;
    select._sdpBuilt = true;
    var html = '';
    for (var n = 1; n <= 5; n++) html += '<option value="' + n + '">' + n + '×</option>';
    select.innerHTML = html;
  }
  function renderSettings() {
    var conf = settings();
    buildRepeatsOptions(byId('setRepeats'));
    var write = byId('setWriteSecs');
    if (write) write.value = String(conf.writeSecs);
    setText(byId('outWriteSecs'), conf.writeSecs + 's');
    var repeats = byId('setRepeats');
    if (repeats) repeats.value = String(conf.repeats);
    var pause = byId('setPause');
    if (pause) pause.value = String(conf.pauseSecs);
    setText(byId('outPause'), conf.pauseSecs + 's');
    var auto = byId('setAutoAdvance');
    if (auto) auto.checked = conf.autoAdvance !== false;
    var source = byId('setVoiceSource');
    if (source) source.value = str(conf.voiceSource || 'auto');
    var rate = byId('setRate');
    if (rate) rate.value = String(conf.rate);
    setText(byId('outRate'), conf.rate + 'x');
    var volume = byId('setVolume');
    if (volume) volume.value = String(Math.round((isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) * 100));
    setText(byId('outVolume'), Math.round((isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) * 100) + '%');
    var langSel = byId('setLang');
    if (langSel) langSel.value = lang;
    var themeSel = byId('setTheme');
    if (themeSel) themeSel.value = theme;
    var voiceLock = byId('setVoiceLock');
    if (voiceLock) voiceLock.value = str(conf.voiceLock || 'unified');
    var guideAuto = byId('setGuideAutoPlay');
    if (guideAuto) guideAuto.checked = conf.guideAutoPlay !== false;
    var pills = doc.querySelectorAll ? doc.querySelectorAll('#presetRow [data-preset]') : [];
    for (var pi = 0; pi < pills.length; pi++) {
      pills[pi].setAttribute('aria-pressed', String(pills[pi].getAttribute('data-preset') === str(conf.pacingPreset || 'standard')));
    }
    paintModePills();
    paintSyncBadge({ state: 'synced', session: str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8') });
    var storage = byId('storageStatus');
    if (storage) {
      var kb = 0;
      try {
        var payload = (global.localStorage ? str(global.localStorage.getItem('sdp.progress')).length : 0) +
          (global.localStorage ? str(global.localStorage.getItem('sdp.settings')).length : 0);
        kb = Math.round(payload / 1024);
      } catch (e) { kb = 0; }
      setText(storage, (SDP.Data.available ? '' : '⚠ ') + kb + ' KB ' + t('storageLine'));
    }
  }
  function bindSettings() {
    function save(patch) { try { SDP.Data.saveSettings(patch); } catch (e) {} }
    function range(id, key, scale, format) {
      var node = byId(id);
      if (!node || node._sdpBound) return;
      node._sdpBound = true;
      node.addEventListener('input', function () {
        var raw = Number(node.value);
        var value = scale ? raw / scale : raw;
        var patch = {};
        patch[key] = value;
        save(patch);
        if (format) setText(byId(format.out), format.fn(value));
        if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
      });
    }
    range('setWriteSecs', 'writeSecs', 1, { out: 'outWriteSecs', fn: function (v) { return v + 's'; } });
    range('setPause', 'pauseSecs', 1, { out: 'outPause', fn: function (v) { return v + 's'; } });
    range('setRate', 'rate', 1, { out: 'outRate', fn: function (v) { return v + 'x'; } });
    range('setVolume', 'volume', 100, { out: 'outVolume', fn: function (v) { return Math.round(v * 100) + '%'; } });
    var repeats = byId('setRepeats');
    if (repeats && !repeats._sdpBound2) {
      repeats._sdpBound2 = true;
      repeats.addEventListener('change', function () { save({ repeats: Number(repeats.value) }); if (SDP.Engine) SDP.Engine.applySettings(); });
    }
    var auto = byId('setAutoAdvance');
    if (auto && !auto._sdpBound) {
      auto._sdpBound = true;
      auto.addEventListener('change', function () { save({ autoAdvance: !!auto.checked }); if (SDP.Engine) SDP.Engine.applySettings(); });
    }
    var source = byId('setVoiceSource');
    if (source && !source._sdpBound) {
      source._sdpBound = true;
      source.addEventListener('change', function () { save({ voiceSource: source.value }); });
    }
    var voiceLock = byId('setVoiceLock');
    if (voiceLock && !voiceLock._sdpBound) {
      voiceLock._sdpBound = true;
      voiceLock.addEventListener('change', function () {
        var val = voiceLock.value;
        save({ voiceLock: val });
        if (val === 'unified') { try { save({ voiceSource: 'auto' }); } catch (e) {} }
        else if (str(source ? source.value : '') === 'auto') { try { save({ voiceSource: 'custom' }); } catch (e) {} }
        if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
      });
    }
    var guideAuto = byId('setGuideAutoPlay');
    if (guideAuto && !guideAuto._sdpBound) {
      guideAuto._sdpBound = true;
      guideAuto.addEventListener('change', function () { save({ guideAutoPlay: !!guideAuto.checked }); });
    }
    var btnReplay = byId('btnReplayGuide');
    if (btnReplay && !btnReplay._sdpBound) {
      btnReplay._sdpBound = true;
      btnReplay.addEventListener('click', function () { openGuide(); });
    }
    var dl = byId('btnDownloadClips');
    if (dl && !dl._sdpBound) {
      dl._sdpBound = true;
      dl.addEventListener('click', function () {
        try {
          var words = SDP.Sync && typeof SDP.Sync.words === 'function' ? SDP.Sync.words() : [];
          var status = byId('downloadClipsStatus');
          if (status) status.textContent = '…';
          SDP.Sync.downloadOfflineAudio(words, function (done, total) {
            if (status) status.textContent = str(done) + ' of ' + str(total) + ' cached';
          }, function (result) {
            if (status) status.textContent = result.ok ? t('downloadClipsDone') : t('downloadClipsDone') + ' — incomplete';
            setUpdateStatus(status ? status.textContent : '', result.ok ? 'ok' : 'bad');
          });
        } catch (e) { var status = byId('downloadClipsStatus'); if (status) status.textContent = 'Download unavailable'; }
      });
    }
    var badge = byId('syncBadge');
    if (badge && !badge._sdpBound) {
      badge._sdpBound = true;
      badge.addEventListener('click', function () {
        var st = badge.getAttribute('data-sync-state');
        if (st === 'update') { location.reload(); }
        else checkForUpdate();
      });
    }
    var langSel = byId('setLang');
    if (langSel && !langSel._sdpBound) {
      langSel._sdpBound = true;
      langSel.addEventListener('change', function () { applyLang(langSel.value); });
    }
    var themeSel = byId('setTheme');
    if (themeSel && !themeSel._sdpBound) {
      themeSel._sdpBound = true;
      themeSel.addEventListener('change', function () { applyTheme(themeSel.value); });
    }
    [['setModePaper', 'paper'], ['setModeTyping', 'typing']].forEach(function (pair) {
      var node = byId(pair[0]);
      if (!node || node._sdpBound) return;
      node._sdpBound = true;
      node.addEventListener('click', function () {
        save({ mode: pair[1] });
        applyModePills(pair[1]);
        if (SDP.Engine && SDP.Engine.setMode) SDP.Engine.setMode(pair[1], true);
      });
    });
    var test = byId('btnTestVoice');
    if (test && !test._sdpBound) {
      test._sdpBound = true;
      test.addEventListener('click', function () { try { SDP.Speech.testVoice(noop); } catch (e) {} });
    }
    var exportBtn = byId('btnExportBackup');
    if (exportBtn && !exportBtn._sdpBound) {
      exportBtn._sdpBound = true;
      exportBtn.addEventListener('click', function () {
        try {
          var text = SDP.Data.backup();
          var blob = new global.Blob([text], { type: 'application/json' });
          var url = global.URL.createObjectURL(blob);
          var a = doc.createElement('a');
          a.href = url;
          a.download = 'smart-dictation-backup-' + APP_VERSION + '.json';
          if (doc.body) doc.body.appendChild(a);
          a.click();
          global.setTimeout(function () { try { global.URL.revokeObjectURL(url); } catch (e) {} }, 1500);
          setUpdateStatus(t('exportReady'), 'ok');
        } catch (e) { setUpdateStatus(t('importBad'), 'bad'); }
      });
    }
    var importBtn = byId('btnImportBackup');
    var importFile = byId('importFile');
    if (importBtn && importFile && !importBtn._sdpBound) {
      importBtn._sdpBound = true;
      importBtn.addEventListener('click', function () { try { importFile.click(); } catch (e) {} });
      importFile.addEventListener('change', function () {
        var file = importFile.files && importFile.files[0];
        if (!file || typeof global.FileReader !== 'function') return;
        var reader = new global.FileReader();
        reader.onload = function () {
          var result = { ok: false };
          try { result = SDP.Data.restore(str(reader.result)); } catch (e) { result = { ok: false }; }
          setUpdateStatus(result.ok ? t('importOk') : t('importBad'), result.ok ? 'ok' : 'bad');
          renderHome(); renderWords(); renderSettings();
        };
        reader.readAsText(file);
      });
    }
    var reset = byId('btnResetStats');
    if (reset && !reset._sdpBound) {
      reset._sdpBound = true;
      reset.addEventListener('click', function () {
        try { SDP.Data.resetProgress(); } catch (e) {}
        renderHome(); renderWords();
        setUpdateStatus(t('resetDone'), 'ok');
      });
    }
    var check = byId('btnCheckUpdate');
    if (check && !check._sdpBound) {
      check._sdpBound = true;
      check.addEventListener('click', function () { checkForUpdate(); });
    }
  }
  function setUpdateStatus(text, state) {
    var node = byId('updateStatus');
    if (!node) return;
    node.textContent = str(text);
    if (state) node.setAttribute('data-state', state); else node.removeAttribute('data-state');
  }
  /* ══ Sync badge — four honest states (I1/R10) ═════════════════════════════════════════════════════════════════ */
  function paintSyncBadge(state) {
    state = state || {};
    var session = str(state.session || '8');
    var badge = byId('syncBadge');
    var status = byId('settingsSyncStatus') || byId('updateStatus');
    var label;
    if (state.state === 'synced') {
      label = t('syncBadgeSynced').replace('Session 8', 'Session ' + session).replace('8 වන වාරය', session + ' වන වාරය').replace('v0.0.1.b', 'v' + APP_VERSION);
    } else if (state.state === 'offline') {
      label = t('syncBadgeOffline');
    } else if (state.state === 'update') {
      label = t('syncBadgeUpdate').replace('v0.0.1.b', 'v' + APP_VERSION);
    } else {
      label = t('syncBadgeRetry');
    }
    if (badge) { badge.textContent = label; badge.setAttribute('data-sync-state', state.state || 'synced'); badge.setAttribute('title', label); }
    if (status) { status.textContent = label; status.setAttribute('data-state', state.state || 'synced'); status.setAttribute('title', label); }
  }
  function checkForUpdate() {
    setUpdateStatus(t('updateChecking'), '');
    try {
      SDP.Sync.checkForUpdates(function (result) {
        if (!result || !result.ok) {
          var state = (result && result.error === 'no_fetch') ? 'offline' : 'error';
          paintSyncBadge({ state: state });
          setUpdateStatus(state === 'offline' ? t('syncBadgeOffline') : t('syncBadgeRetry'), state === 'offline' ? '' : 'bad');
          return;
        }
        if (result.appVersionChanged) {
          paintSyncBadge({ state: 'update', session: result.session, appVersion: result.appVersion });
          setUpdateStatus(t('syncBadgeUpdate'), 'ok');
          return;
        }
        if (result.updated) {
          paintSyncBadge({ state: 'synced', session: result.session });
          setUpdateStatus(t('updateFound') + ' · Session ' + str(result.session), 'ok');
          onDataReady();
          return;
        }
        paintSyncBadge({ state: 'synced', session: result.session });
        setUpdateStatus(t('updateNone'), '');
      });
    } catch (e) {
      paintSyncBadge({ state: 'error' });
      setUpdateStatus(t('syncBadgeRetry'), 'bad');
    }
  }

  /* ══ Quick pacing presets (settings section 1) ═════════════════════════════════════════════════════════════════════ */
  var PRESETS = {
    beginner: { pacingPreset: 'beginner', writeSecs: 12, repeats: 4, pauseSecs: 2, autoAdvance: true },
    standard: { pacingPreset: 'standard', writeSecs: 8, repeats: 3, pauseSecs: 1.5, autoAdvance: true },
    exam: { pacingPreset: 'exam', writeSecs: 5, repeats: 2, pauseSecs: 1, autoAdvance: true },
    board: { pacingPreset: 'board', writeSecs: 10, repeats: 3, pauseSecs: 1.5, autoAdvance: true, theme: 'board' }
  };
  function applyPreset(id) {
    var p = PRESETS[id];
    if (!p) return;
    var patch = { pacingPreset: p.pacingPreset, writeSecs: p.writeSecs, repeats: p.repeats, pauseSecs: p.pauseSecs, autoAdvance: p.autoAdvance };
    if (p.theme) patch.theme = p.theme;
    try { SDP.Data.saveSettings(patch); } catch (e) {}
    renderSettings();
    if (p.theme) applyTheme(p.theme, true);
    if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
    setUpdateStatus(t('presetApplied'), 'ok');
  }

  /* ══ Smart Board quick-word jumper (R7 / H5) ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function renderQuickJumper() {
    var sel = byId('setQuickWord');
    if (!sel) return;
    var count = 30;
    var i, html = '';
    for (i = 1; i <= count; i++) html += '<option value="' + i + '">' + str(i) + '</option>';
    sel.innerHTML = html;
    if (sel._jqBound) return;
    sel._jqBound = true;
    sel.addEventListener('change', function () {
      var idx = Number(sel.value) - 1;
      if (SDP.Engine && typeof SDP.Engine.jumpTo === 'function') SDP.Engine.jumpTo(idx);
    });
  }

  /* ══ Settings order guard (5 sections, studio last & collapsed) ═════════ */
  /* contract: docs/UI_COMPONENT_GUIDE.md §Student-first settings order */
  function settingsOrder() {
    var host = byId('settingsSections');
    if (!host) return [];
    var sections = host.querySelectorAll('.set-card');
    var order = [];
    for (var i = 0; i < sections.length; i++) order.push(sections[i].id || sections[i].getAttribute('data-section') || 'section');
    return order;
  }

  /* ══ Data toast ═════════════════════════════════════════════════════════ */
  /* contract: docs/ARCHITECTURE_MAP.md §R9 whisper data toast */
  var toastTimer = null;
  function toastBytes() {
    var meter = global.SDPDataMeter;
    try {
      if (meter && meter.getLive) {
        var live = meter.getLive();
        if (live && live.sessionBytes) return Math.round(live.sessionBytes / 1024);
      }
    } catch (e) {}
    var kb = 0;
    try {
      var session = SDP.Sync.session();
      kb = session ? Math.round(JSON.stringify(session).length / 1024) : 0;
    } catch (e) { kb = 0; }
    return kb;
  }
  function toastText() {
    var offline = false;
    try { offline = SDP.Sync.state.source === 'offline'; } catch (e) {}
    var kb = offline ? 0 : toastBytes();
    return t(offline ? 'toastOffline' : 'toastLoaded') + ' · ' + kb + ' KB';
  }
  function showToast() {
    var node = byId('sdpDataToast');
    if (!node) return;
    node.textContent = toastText();
    node.hidden = false;
    if (node.classList) node.classList.remove('toast-hidden');
    if (toastTimer) global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () {
      if (node.classList) node.classList.add('toast-hidden');
      toastTimer = global.setTimeout(function () { node.hidden = true; }, 420);
    }, 2400);
  }

  /* ══ wiring ═════════════════════════════════════════════════════════════ */
  function bindShell() {
    on('btnGuideTop', 'click', openGuide);
    on('btnGuide', 'click', openGuide);
    on('btnGuideClose', 'click', closeGuide);
    on('btnLang', 'click', toggleLang);
    on('guideLangPill', 'click', toggleLang);
    on('guideSpeak', 'click', speakGuide);
    on('guidePauseVoice', 'click', toggleGuidePause);
    on('guideNextStep', 'click', guideNextStep);
    on('guideReplayStep', 'click', guideReplayStep);
    on('btnTheme', 'click', toggleTheme);
    on('btnStart', 'click', function () { startDictation(); });
    on('btnResume', 'click', resumeDictation);
    var tabs = ['home', 'player', 'practice', 'dict', 'settings'];
    for (var i = 0; i < tabs.length; i++) {
      (function (name) {
        on('tab-' + name, 'click', function () { showTab(name); });
        on('rail-' + name, 'click', function () { showTab(name); });
      })(tabs[i]);
    }
    var modePills = doc.querySelectorAll('#homeModePills [data-mode]');
    for (var m = 0; m < modePills.length; m++) {
      (function (node) {
        if (node._sdpBound) return;
        node._sdpBound = true;
        node.addEventListener('click', function () {
          var mode = str(node.getAttribute('data-mode'));
          try { SDP.Data.saveSettings({ mode: mode }); } catch (e) {}
          applyModePills(mode);
          if (SDP.Engine && SDP.Engine.setMode) SDP.Engine.setMode(mode, true);
        });
      })(modePills[m]);
    }
    var presetPills = doc.querySelectorAll ? doc.querySelectorAll('#presetRow [data-preset]') : [];
    for (var pp = 0; pp < presetPills.length; pp++) {
      (function (node) {
        if (node._sdpBound) return;
        node._sdpBound = true;
        node.addEventListener('click', function () {
          applyPreset(str(node.getAttribute('data-preset')));
        });
      })(presetPills[pp]);
    }
    var quick = doc.querySelectorAll('#homeQuickPractice [data-prac]');
    for (var q = 0; q < quick.length; q++) {
      (function (node) {
        if (node._sdpBound) return;
        node._sdpBound = true;
        node.addEventListener('click', function () { startPractice(str(node.getAttribute('data-prac'))); });
      })(quick[q]);
    }
    var modal = byId('guideModal');
    if (modal && !modal._sdpBound) {
      modal._sdpBound = true;
      modal.addEventListener('click', function (ev) { if (ev && ev.target === modal) closeGuide(); });
    }
    trapGuideKeys();
    bindWords();
    bindPractice();
    bindSettings();
  }

  function onDataReady(err) {
    renderHome();
    renderWords();
    renderPractice();
    renderSettings();
    if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
    var title = byId('sessionTitle');
    try { if (title && SDP.Sync.sessionTitle()) setText(title, SDP.Sync.sessionTitle()); } catch (e) {}
    try { if (SDP.Speech && SDP.Speech.loadManifest) SDP.Speech.loadManifest(noop); } catch (e) {}
    try { if (SDP.Studio && SDP.Studio.onDataReady) SDP.Studio.onDataReady(); } catch (e) {}
    if (!err && global.__SDP_NO_LIVE__ !== true) {
      try { SDP.Sync.startWatch(120000); } catch (e) {}
    }
    return true;
  }

  function init() {
    if (initialized) return false;
    initialized = true;
    var conf = settings();
    applyTheme(conf.theme === 'light' ? 'light' : 'dark', true);
    applyLang(conf.lang === 'si' ? 'si' : 'en', true);
    bindShell();
    try { if (SDP.Engine && SDP.Engine.bind) SDP.Engine.bind(); } catch (e) {}
    setText(byId('sdpVerPill'), 'v' + APP_VERSION);
    setText(byId('brandName'), 'Smart Dictation');
    renderHome();
    renderWords();
    renderPractice();
    renderGuideSteps();
    renderSettings();
    paintSyncBadge({ state: 'synced', session: str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8') });
    if (!SDP.Data.guideSeen()) openGuide();
    showToast();
    try { SDP.Sync.registerSW(); } catch (e) {}
    try {
      SDP.Sync.boot({}, function (err) { onDataReady(err); });
    } catch (e) { onDataReady(e); }
    return true;
  }

  var Views = {
    init: init,
    t: t,
    strings: function () { return lang === 'si' ? STRINGS_SI : STRINGS_EN; },
    stringsEn: STRINGS_EN,
    stringsSi: STRINGS_SI,
    lang: function () { return lang; },
    theme: function () { return theme; },
    applyLang: applyLang,
    applyTheme: applyTheme,
    toggleLang: toggleLang,
    toggleTheme: toggleTheme,
    showTab: showTab,
    currentTab: currentTab,
    renderHome: renderHome,
    renderWords: renderWords,
    renderPractice: renderPractice,
    renderSettings: renderSettings,
    renderGuideSteps: renderGuideSteps,
    settingsOrder: settingsOrder,
    applyModePills: applyModePills,
    startDictation: startDictation,
    resumeDictation: resumeDictation,
    startPractice: startPractice,
    openGuide: openGuide,
    closeGuide: closeGuide,
    speakGuide: speakGuide,
    showToast: showToast,
    toastText: toastText,
    checkForUpdate: checkForUpdate,
    setUpdateStatus: setUpdateStatus,
    onDataReady: onDataReady
  };
  SDP.Views = Views;
  SDP.STRINGS_EN = STRINGS_EN;
  SDP.STRINGS_SI = STRINGS_SI;

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { init(); });
    else init();
  }
})(typeof window !== 'undefined' ? window : this);
