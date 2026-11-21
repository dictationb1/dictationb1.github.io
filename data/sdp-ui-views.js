(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;
  /* Single source of truth: SDP.version (sdp-data-sync.js). */
  var APP_VERSION = (function () {
    try { if (SDP && SDP.version) return String(SDP.version); } catch (e) {}
    try { if (global.__SDP_BOOT_VERSION__) return String(global.__SDP_BOOT_VERSION__); } catch (e) {}
    return '0.0.7.e';
  })();
  /* v0.0.6.m (P1/P3): the governed Beta channel stays URL-driven for the
     Project Briefing suite. The v0.0.6.m features are permanent on Main;
     ?beta or #beta stamps BETA_SUBVERSION 0.0.6.m.beta and replays the
     briefing so the whole suite is verifiable on a phone in one tap. */

  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  /* D14: the #01..#30 badge keeps two digits so the order never looks wrong. */
  function pad2(n) { var v = Number(n) || 0; return (v < 10 ? '0' : '') + v; }
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

  /* ══ STRINGS  ══ */
  
  var STRINGS_EN = {
    appName: 'Smart Dictation',
    guideBtn: '? Guide',
    tabHome: 'Home', tabPlayer: 'Dictation', tabPractice: 'Practice', tabWords: 'Words', tabSettings: 'Settings',
    homeTitle: 'Smart Dictation', homeSub: 'Listen, write, and check {N} B1 words with your class.',
    startDictation: 'Start Dictation (Word #1 to #{N})', howToUse: 'How to Use',
    paperMode: 'Paper', typingMode: 'Typing', resumeSession: 'Continue where you stopped',
    statMastered: 'Mastered', statAccuracy: 'Accuracy', statStreak: 'Day streak',
    quickPractice: 'Quick practice', flashcards: 'Flashcards', quiz: '4-Choice Quiz', listening: 'Listening Drill',
    flashcardsSub: 'Flip through all {N} words', quizSub: 'Pick the right meaning', listeningSub: 'Hear it, then choose', weakWordsSub: 'Retry the ones you missed',
    weakWords: 'Weak Words', mastered: 'Mastered', announcements: 'Class announcement',
    creditsLine: 'Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)',
    creditsPill: 'CREDITS GOES TO Hansana',
    btnPrev: '⏮ Prev', btnPlayPause: '⏸ Pause Dictation', btnNext: 'Next', btnRepeat: 'Repeat', btnHint: 'Hint',
    btnModeSwitch: 'Paper / Typing', btnFinish: 'Finish & check',
    readyBeat: 'Ready', listeningBeat: 'Listening', writeNowBeat: 'Write Now', pausedBeat: 'Paused',
    finishedBeat: 'Finished — check your answers', repeatWord: 'Repeat', remainingWord: 'remaining',
    noWords: 'No words loaded yet', hintPos: 'Word type', hintFirst: 'First letter', hintSi: 'Sinhala meaning',
    hintSentence: 'Example sentence', playAudio: 'Play audio',
    pronVariantsBadge: 'UK pronunciations accepted', hintLength: 'letters',
    offlineBanner: 'Running in Offline Mode (No Internet / Mobile Data)', offlineBannerSub: 'Cached audio & sessions active',
    offlineBannerHelp: 'Get Help', offlineBackOnline: 'Back online',
    /* v0.0.7.c (BUG-01/BUG-05): probe-verified offline law + dynamic counts + deck caps. */
    offlineRetry: 'Retry Connection', offlineProbePending: 'Checking your connection…',
    updateTimedOut: 'Check timed out — the connection is too slow. Tap again to retry.',
    homeReadyLoading: 'Loading the class word list…',
    capPause: 'Pause', capResume: 'Resume', capStart: 'Start',
    /* v0.0.7.c (BUG-03): provider key tests + the word-record schema gate. */
    studioVerifyGroq: 'Test Groq Key', studioVerifyGemini: 'Test Gemini Key',
    studioVerifyHttpOk: 'key valid', studioVerifyHttp401: 'invalid key',
    studioVerifyHttp403: 'permission / quota denied', studioVerifyHttp429: 'rate limited — rotate the key pool',
    studioVerifyHttp5xx: 'provider error — retry later', studioVerifyHttpOther: 'unexpected response',
    studioVerifyNoKey: 'Paste the AI key first',
    studioVerifyNetErr: 'Network / CORS error — the request never reached the provider. Check the internet and retry.',
    studioWordsInvalidTitle: 'Publish blocked — fix these words first:',
    studioWordsIssueW: 'missing word', studioWordsIssueDup: 'duplicate word',
    studioWordsIssueSi: 'missing Sinhala meaning',
    studioWordsIssueM: 'English meaning missing or truncated',
    studioWordsIssueP: 'missing IPA', studioWordsIssuePos: 'missing part of speech',
    studioWordsIssueS: 'missing example sentence', studioWordsIssueSNoWord: 'example does not contain the word',
    tapFlipBack: 'Tap the card to flip back',
    studioAutoLockIn: 'Auto-locking Studio in', studioAutoLockHint: '— tap anywhere to stay unlocked',
    studioPublishLockOk: 'Published, synced & locked — students can start dictation now.',
    studioGuideBtn: '📘 Studio Guide', studioGuideTitle: 'Lecturer Studio Guide',
    studioGuideSimple: 'Simple Guide — daily teaching flow', studioGuideAdvanced: 'Advanced Guide — every admin control',
    studioGuideLater: 'Maybe later',
    resultsTitle: 'Self-Check & Results', colYourWord: 'Your word', colCorrectWord: 'Correct word', colMark: 'Mark',
    markCorrect: 'Correct', markMissed: 'Missed', markAll: 'Mark all correct', toggleMissed: 'Toggle missed',
    btnRetryMissed: 'Retry missed words', btnNewSession: 'Start new session',
    filterAll: 'All {N}', searchWords: 'Search words', noWordsFound: 'No words found',
    tapToFlip: 'Tap the card to see the meaning', nextCard: 'Next card', prevCard: 'Previous card',
    chooseMeaning: 'Choose the correct meaning', listenAndChoose: 'Listen and choose the correct word',
    weakWordsOnly: 'Weak words only', correctPick: 'Correct!', wrongPick: 'Not quite',
    setPacing: '1 · Dictation pacing & mode', modeLabel: 'Mode', writeTime: 'Writing time', repeats: 'Word repeats',
    pauseBetween: 'Pause between repeats', autoAdvance: 'Advance automatically',
    setAudio: '2 · Audio & voice', voiceSource: 'Voice source', voiceAuto: 'Auto (best British voice)',
    voiceLecturer: 'Lecturer clips', voiceAlice: 'Charlotte (ElevenLabs UK)', voiceDevice: 'Device voice',
    rate: 'Speech rate', volume: 'Volume', testVoice: 'Test Voice',
    setLangTheme: '3 · Language & appearance', language: 'Language', theme: 'Theme',
    themeDark: '🌙 Dark Mode', themeLight: '☀️ Light Mode (Default)', langEnglish: 'English', langSinhala: 'Sinhala',
    aboutTitle: '5 · About this app',
    aboutBlurb: 'A free, offline-first dictation trainer for one class — no accounts, no ads, no tracking.',
    aboutAudience: 'Built for the CCBE Galle Branch — B1 English Class, Sri Lanka.',
    aboutVersionLabel: 'Version', aboutBuiltLabel: 'Built',
    aboutDataLink: 'See every byte this app stores',
    emptyBank: 'No word list is available yet. Connect once, then tap "Check for session update" in Settings.',
    setProgress: '4 · Progress & offline storage', exportBackup: 'Export backup', importBackup: 'Import backup',
    resetStats: 'Reset local stats', checkUpdate: 'Check for session update',
    studioTitle: '6 · Lecturer Studio & admin vault', studioLocked: 'Enter the lecturer PIN to open the studio.',
    studioChangePin: 'Change PIN',
    /* Table B additions — UI labels, badges, presets and studio controls */
    dictTitle: '{N}-Word Session View · #01–#{P}', dictSearchPh: 'Search {N} words (English, Sinhala, IPA)...',
    syncBadgeSynced: 'Synced',
    syncShortSyncing: 'Syncing…',
    lecturerSyncBar: ' Broadcast Current Pacing & Settings (Fast Exam 5s · 2×) to All Classroom Devices',
    lecturerSyncDirty: '🔴 Unsaved Changes — Broadcast Words, Voice & Settings to All Classroom Devices Now',
    lecturerSyncLast: 'Last synced to the class',
    /* D19: a dedicated idle label — applyLang can never overwrite a real stamp. */
    lecturerSyncIdle: 'Not synced yet — press Save & Sync',
    lecturerSyncedToast: ' Synced teacher\'s latest classroom settings (Rev #',
    lecturerSyncNoToken: 'Add a GitHub token in Lecturer Studio to sync the class',
    guideQuickTitle: 'Quick Voice Guide — How This Dictation Works',
    guideSkipStart: '⏩ Skip Guide & Start Immediately',
    studioAskLecturer: 'Ask your lecturer to unlock Lecturer Studio with the PIN.',
    studioPinMismatch: 'The two PINs do not match — type the same 4–8 digits twice.',
    invertMarks: 'Invert marks (tap twice)',
    invertConfirmToast: 'Tap Invert marks again within 3s to confirm',
    syncBadgeOffline: 'Offline — showing cached session',
    syncBadgeUpdate: 'Update found — tap to reload',
    syncBadgeRetry: 'Check failed — retry',
    guideReplay: ' Replay Step-by-Step Voice Guide',
    guideAutoPlay: 'Auto-play English voice guide on start',
    presetHeading: 'Quick Pacing Presets',
    presetBeginner: ' Beginner Slow (12s · 4×)',
    presetStandard: ' CCBE B1 Standard (8s · 3×)',
    presetExam: ' Fast Exam (5s · 2×)',
    presetBoard: ' Smart Board Class Mode',
    themeBoard: 'Smart Board High-Contrast',
    voiceLockLabel: 'Voice Persona Lock',
    voiceLockUnified: 'British Female Professor (Unified 25–35 UK)',
    voiceLockCustom: 'Follow Individual Tier Source',
    downloadClips: ' Download All {N} Word Audio Clips for Offline Use',
    downloadClipsDone: 'Cached {A} of {N} audio clips for offline use',
    studioFirstTime: 'First-Time Studio Setup: Set Your 4–8 Digit Lecturer PIN + API Keys',
    studioTestEl: 'Test ElevenLabs Key',
    studioTestGh: 'Test GitHub Token',
    studioShow: 'Show',
    studioHide: 'Hide',
    studioPaste: 'Paste',
    pinPadClear: 'Clear',
    pinPadUnlock: 'Unlock',
    studioCommitClip: 'Commit Recorded Clip',
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
    studioRecord: 'Record word', studioSave: ' Save Keys to Vault Only', studioLock: 'Lock studio',
    studioEnvelope: 'Encrypted vault envelope (SDP_ENC_V2)', studioCopy: 'Copy envelope',
    studioPublishOk: 'Session published', studioPublishFail: 'Publish failed',
    studioNoToken: 'Add a GitHub token (Contents API) in the vault first', studioWordsCount: 'words parsed',
    studioElevenNote: 'ElevenLabs generation runs only while unlocked, using the Charlotte voice and flash_v2_5.',
    /* ── v0.0.1.c Table B: Guide 2.0, Home journey, Smart Board bar, Studio ── */
    guideTapToStart: ' Tap anywhere to start the voice guide',
    homeJourney1: 'Listen & write',
    homeJourney2: 'Check your {N} words',
    homeJourney3: 'Train weak words',
    homeReadyBadge: 'Session {S} ready · {N} words',
    modePaperFull: ' Write in Exercise Book (Paper)',
    modeTypingFull: 'Type on Screen',
    voiceGuideBtn: ' Interactive Voice Guide',
    boardShowWord: ' 👁 Show Current Word',
    boardHideWord: ' 🙈 Hide Current Word',
    quotaHeading: 'ElevenLabs Character Quota (Zero-Cost Check)',
    costPreviewLabel: 'Estimated Generation Cost',
    testOneWordBtn: ' Test 1 Word (~8 chars)',
    forceRegenLabel: 'Force re-generate existing clips',
    genDeltaBtn: ' Generate Missing Clips (Credit-Saver)',
    teacherUpdatedToast: 'Your teacher updated the class settings',
    vaultSavedToast: 'Vault saved · synced to GitHub',
    guideVoiceFailed: 'Voice guide unavailable — tap to retry',
    boardPlayPause: 'Play / Pause',
    boardRepeat: ' Repeat',
    boardNext: 'Next',
    boardJumpLabel: 'Jump to word',
    syncShortSynced: 'Synced ',
    syncShortOffline: 'Offline',
    syncShortUpdate: 'Update',
    syncShortRetry: 'Retry',
    homeJourneyTitle: 'Your 3 steps today',
    settingsSyncLabel: 'Sync',
    settingsUpdateLabel: 'Update',
    guiding: 'Guide',
    /* v0.0.1.f additions (D9, D13, D14, D17, D18) */
    resumePaused: 'Resume Paused Dictation',
    homePresetBadge: 'Fast Exam · 5s · 2× · British English',
    repeatBadge: 'Repeat',
    pausedBanner: 'Paused — Tap Resume to Continue',
    btnResumeDictation: 'Resume Dictation',
    pauseReasonNavigation: 'you switched screens',
    pauseReasonModal: 'a dialog opened',
    pauseReasonVisibility: 'the app went to the background',
    pauseReasonUser: 'you tapped pause',
    guideAutoplayBanner: ' Tap Anywhere to Start Voice Guide',
    studioCardKeys: 'STEP 1 — API KEYS & 70-CLIP VOICE PACK GENERATOR',
    studioCardWords: 'STEP 2 — 30-WORD SESSION EDITOR & FREE AI AUTO-FILL',
    studioCardSettings: 'STEP 3 — CLASSROOM SETTINGS BROADCAST & PIN SECURITY',
    studioLockLecturer: 'Lock Lecturer Mode',
    studioAiProvider: 'Free AI / dictionary engine',
    studioAiKey: 'Free AI key (optional)',
    studioTestAi: 'Test Free AI / Dictionary Engine',
    studioAiNoKey: '1: Built-in Free Oxford/Wikimedia Dictionary + Sinhala Translator (100% Free — No API Key Needed)',
    studioOneClick: ' Generate 74 British Professor Voices & Sync All Devices',
    studioBulkWords: 'Paste or type the session words (one per line, or comma separated)',
    studioEnrich: 'Auto-Fill IPA, English & Sinhala Meanings (Free AI / Dictionary)',
    studioWordManager: 'Word manager — # · w · p · pos · m · si · s',
    studioPublishWordsVoice: ' Auto-Enrich & Publish the Words',
    studioSyncSettings: ' Save & Sync Classroom Settings to All Devices',
    studioMasterSteps: 'Setup progress',
    studioEnriching: 'Enriching',
    studioEnriched: 'Enriched',
    studioAiOffline: 'offline B1 lexicon used',
    /* ── v0.0.1.h (D2, D6, D7, D10, D13, D14) ── */
    vaultBadgeLabel: 'Vault Saved & Protected Across Updates',
    studioFreeNoKey: '100% Free — No API Key Required!',
    studioQuotaScoped: 'Key accepted (scoped/free-tier key — quota read bypassed)',
    studioElTierWarn: 'ElevenLabs free quota/tier limit reached — using Built-in Free British Female Professor Voice for remaining words',
    studioSavedLocal: 'Saved in local Vault (protected across updates)',
    studioAiSlotPollinations: '2: Pollinations Free Open-Source AI (Llama/Mistral — 100% Free, No API Key Needed!)',
    studioAiSlotGroq: '3: Groq Cloud Free Tier · Llama-3.3-70B Open-Source (gsk_… — Free, No Credit Card)',
    studioAiSlotOpenrouter: '4: OpenRouter Free Models · Llama-3.3-70B:free (sk-or-… — Free Tier)',
    studioAiSlotGemini: '5: Google Gemini Free Tier · gemini-2.5-flash (AIza… — Optional)',
    studioWorking: 'Working…',
    studioClear: 'Clear',
    studioRestored: 'Studio restored from this tab',
    studioNoVaultWarn: 'No vault sealed yet — words publish without keys; seal the vault when you add your keys',
    studioAiOfflineFallback: 'AI offline — free dictionary used',
    /* ── v0.0.2.a (D5–D16): 6-tab shell, 1-2-3 Home, tactile cues, Guide 3.0 ── */
    tabStudio: 'Lecturer',
    homeStep1Tag: 'STEP 1', homeStep2Tag: 'STEP 2', homeStep3Tag: 'STEP 3',
    homeWordsTitle: 'Check & Study All {N} Session Words in Order #1–#{P}',
    homeWordsSub: 'Every word in class order with its British IPA, Sinhala meaning and example sentence.',
    homeWordsBtn: ' Open the {N}-Word List (#1–#{P})',
    resumeMetaIdle: 'Paused at Word #1 of {N}',
    startOver: 'Start Over from Word #1',
    cueStep1: 'STEP 1 — PRESS HERE',
    cuePlayer: 'PAUSE OR RESUME HERE',
    cueDict: 'TAP A WORD TO LISTEN',
    cueStudio: 'ENTER YOUR PIN',
    settingsLecturerActive: ' Lecturer Mode Active — Open Lecturer Admin Studio to Broadcast Settings or Edit the Word List',
    openStudioBtn: ' Open Lecturer Admin Studio',
    studioScreenTitle: ' Lecturer Admin Studio',
    studioScreenSub: 'Unlock with the lecturer PIN \u2014 paste the class words, check the session number, then broadcast to every classroom device.',
    lecturerAdminLocked: ' Lecturer Admin', lecturerAdminUnlocked: ' Lecturer Admin',
    btnReplay: ' Replay Word',
    btnPauseDictation: '⏸ Pause Dictation',
    btnResumeWord: '▶ Resume Word #',
    btnPrevNum: '⏮ Prev (#', btnNextNum: '⏭ Next (#',
    listenCarefully: 'Listen Carefully (Repeat ', writeInBook: 'Write Word #',
    inYourBook: ' in Your Book! (', countdownTail: 's countdown)',
    pausedAtWord: 'Dictation Paused at Word #', pausedResumeTail: ' — Press Resume Below',
    resumeMetaLine: 'Paused at Word #', ofWord: ' of {N} · Repeat ', secondsLeft: 's left',
    progressWord: 'Word #', progressOf: ' of {N}',
    /* Phase 5 (v0.0.4.a): the one-line cockpit header and the symbol deck. */
    progressWordUpper: 'WORD #', progressOf30: ' / {N}', repeatOf: ' of ', writeSecsBadge: 's Write',
    capPrev: 'Prev', capPlay: 'Pause', capReplay: 'Replay', capNext: 'Next',
    capRepeat: 'Repeat', capHint: 'Hint', capMode: 'Mode', capFinish: 'Check',
    pillsDrawer: 'Jump to Word 1–{N} ▾',
    markCorrectWord: ' Correct', markWeakWord: ' Needs Practice', btnStartDictation: '▶ Start Dictation',
    studioRetryNone: 'No failed clip to retry — every clip is already saved.',
    studioRetryOne: 'Retry the failed clip',
    studioStep1Head: 'STEP 1 — API KEYS & 70-CLIP VOICE PACK GENERATOR',
    studioStep2Head: 'STEP 2 — 30-WORD SESSION EDITOR & FREE AI AUTO-FILL',
    studioStep3Head: 'STEP 3 — CLASSROOM SETTINGS BROADCAST & PIN SECURITY',
    studioPackVault: 'Vault: Saved ', studioPackGithub: 'GitHub: Connected ', studioPackClips: 'Voice Pack: ',
    studioClipsUnit: '/74 Clips', studioGenPrefix: 'Generating clip ',
    studioGenCharsTail: ' chars used', studioClipsSaved: '/74 Clips Saved to GitHub · syncRev ',
    studioRetryFailed: 'Retry missing clips',
    studioOneClick34: ' Generate 74 British Professor Voices & Sync All Devices',
    studioSaveOnly: ' Save Keys to Vault Only',
    studioPublishWordsVoice34: ' Auto-Enrich & Publish the Words',
    studioOneClickFull: 'Publish & Sync the Words',
    studioWordsRecognized: 'Words Recognized',
    studioWordModified: 'Word(s) Modified',
    studioClickBroadcast: 'click Broadcast to Auto-Enrich & Sync',
    studioErrTitle: 'Something needs your attention',
    studioErrFixNow: '1-Click Fix / Retry Failed Step',
    studioErrDismiss: 'Dismiss',
    pillReady: 'Ready',
    pillPaused: 'Paused — tap Resume',
    pillFinished: 'Finished — check answers',
    pillListening: 'Listening · Repeat',
    pillWriting: 'Write the word ·',
    pillFinishWarn: 'Finish writing ·',
    studioBroadcast34: ' Broadcast Current Pacing & Settings (Fast Exam 5s · 2×) to All Classroom Devices',    guideCard3Tag: '3 of 4 — Check Words #1 to #{N} in Order', guideCard4Tag: '4 of 4 — Automatic Classroom Sync & Lecturer Admin',
    guideSkipStartNow: '▶ Click Start Dictation Now',
    /* R2 (v0.0.4.a): the compact spotlight — four clean spoken sentences. */
    guideSpotlight1: 'Press Start Dictation to begin.',
    guideSpotlight2: 'Listen twice, then write in five seconds.',
    guideSpotlight3: 'Check all thirty words in order.',
    guideSpotlight4: 'Practise the words you missed.',
    guideStepTagPrefix: 'Step', guideStepTagSuffix: 'of 4',
    guideExitBtn: ' Exit',
    studioSavedOk: ' Keys saved & protected across updates',
    studioVerifyEl: ' Test & Verify ElevenLabs Voice Key',
    studioVerifyOk: 'VALID  (Remaining Free Credits: ',
    studioVerifyBad: 'INVALID KEY  (HTTP ',
    studioVerifyHint: 'INVALID KEY — paste the sk_… secret from ElevenLabs (the e1b… value is the key ID and will not work)',
    studioClips70: '70 clips = 829 chars ≈ 8.3% of the free monthly quota (flash_v2_5 ≈ 414 credits)',
    studioRecoveryUsed: 'Master recovery used — set a new PIN now',
    studioChangePinBtn: ' Change Lecturer PIN',
    presetReset: 'Reset to Class Default (5s · 2×)',
    studioOneClickSub: 'Automatic: British IPA · Sinhala meaning · voice pack · all-device sync',
    studioAdvancedToggle: ' Advanced Tools & Word Inspector',
    ssbUnlocked: 'Lecturer Mode Active — lock before handing the device to students',
    guardTitle: '\ud83d\udd34 Unsaved Changes',
    guardBody: 'Edited words or settings were not broadcast yet. Publish, sync & lock before switching \u2014 or discard them.',
    guardPublish: '\ud83d\udd34 Publish, Sync & Leave',
    guardLock: '\ud83d\udd12 Discard Changes, Lock & Leave',
    guardStay: '\u270f\ufe0f Stay in Lecturer Mode',
    studioPublishOkFull: ' Published & synced to all classroom devices',
    /* v0.0.6.d (D1/D7/D8): the capsule notices + clock-ring affordance. */
    wordsRefreshedToast: '🔄 Word list updated — Dictation refreshed & ready from Word #1',
    toastLoadedCapsule: '📊 Task Data',
    toastOfflineCapsule: '📊 Offline ready',
    ringTapStart: 'Tap to Start',
    ringTapPause: 'Tap to Pause',
    ringTapResume: 'Tap to Resume',
    /* v0.0.6.e (C/D/E): reveal card, update capsule, offline studio, live chips. */
    revealShow: 'Show Current Word', revealHide: 'Hide Word', revealPausedBadge: '⏸ Paused while viewing word',
    stalePillLabel: '⚠ Using older word list — Tap here to refresh',
    updateSyncing: '🔄 Updating — refreshing automatically…', updateAsk: 'New classroom words are ready. Refresh now?',
    updateNow: 'Update Now (OK)', updateLater: 'Later',
    studioOfflineTitle: 'Lecturer Studio needs the internet',
    studioOfflineBody: 'Lecturer Studio requires an active internet connection so changes sync to GitHub Cloud. Student Dictation Mode works offline.',
    sessionNoLabel: 'Session No', sessionTitleLabel: 'Session Topic / Title',
    pasteWords: '📋 Paste', clearWords: '🧹 Clear', confirmWords: '✓ Confirm Edited Words',
    liveChipsLabel: 'Live word chips', helperReady: '✓ all word clips ready',
    helperOver: '{n} words detected (need 30) — tap ⇄ on a split word to merge it, or tap ✕ to remove an extra word',
    studioStep1: 'STEP 1 · ONE-TIME SETUP', studioStep2: 'STEP 2 · PASTE 30 WORDS', studioStep3: 'STEP 3 · BROADCAST TO CLASS',
    helperUnder: '{n} words ready — add {need} more',
    wordsConfirmedOk: '✓ Words confirmed — ready to Broadcast', wordsCleared: 'Word editor cleared',
    chipMergeLabel: 'Merge with next word', chipRemoveLabel: 'Remove word',
    apiCreditsExhausted: '⚠️ API Credits Exhausted — Please Enter a New API Key in Advanced Tools',
    apiCreditsExhaustedSi: '⚠️ API ක්‍රෙඩිට් අවසන් වී ඇත — කරුණාකර නව API යතුරක් ඇතුළත් කරන්න',
    apiCreditsFixNow: 'Open Advanced Tools & Enter New Key',
    pinComplete: '✓ PIN Complete',
    pinDigitsNeeded: 'digits',
    /* ══ v0.0.6.m — Project-First Executive Briefing, Beta channel, Review ══ */
    creatorNoteBtn: '♪ Project Briefing',
    briefingEyebrow: 'OPEN-SOURCE PROJECT BRIEFING · AUTOMATED SYSTEM',
    briefingTitle: 'Smart Dictation · Project Overview',
    briefingPersona: 'Started 2 Weeks Ago (Oct 22) · $0 Open-Source System',
    briefingLinkCode: 'Code on GitHub ↗',
    briefingLinkProfile: "Hansana's GitHub & RDP ↗",
    briefingContinue: '▶ Start Dictation →',
    briefingContinueWait: 'Start Dictation ({n}s)…',
    briefingContinueBeat1: 'Start Dictation (finishing Paragraph 1…)',
    briefingContinueAll: 'Start Dictation (Paragraph {p} of 4…)',
    briefingSkip: 'Exit',
    briefingSkipTop: '✕ Skip →',
    briefingCountdown: 'Please listen / read ({n}s)…',
    briefingUnlocked: 'Thank you for listening — continue whenever you are ready.',
    betaPillLabel: 'Beta',
    betaStampLabel: 'BETA · 0.0.6.q.beta — Project Briefing · Multi-API · Reviews · Diagnostics',
    betaOnToast: 'Beta channel ON — the v0.0.6.n suite is highlighted and the Project Briefing will replay',
    betaOffToast: 'Beta channel OFF — back to the standard main cockpit',
    reviewTitle: 'Help Improve Smart Dictation — Share Your Quick Review',
    reviewSub: '100% optional — two taps or one short voice note. It goes straight to the creator, encrypted.',
    reviewPopupTitle: 'How was your dictation session?',
    reviewPopupSub: 'Help us improve in 1 tap:',
    reviewVoiceBtn: '🎤 Record Voice Review (English or Sinhala)',
    reviewTextPh: 'Or type a quick note (optional)…',
    reviewSendBtn: 'Send Review',
    reviewSkipBtn: 'Skip — no thanks',
    reviewSentToast: 'Thank you! Your encrypted review was saved for the creator.',
    reviewSkipToast: 'No problem — your encrypted session telemetry still helps the creator. Enjoy your class!',
    reviewVoiceListening: 'Listening… speak now, then press the button again to stop.',
    reviewVoiceHeard: 'Heard: “{t}” — send it or edit the text box.',
    reviewVoiceOff: 'Voice review is not supported on this browser — typing works everywhere.',
    reviewVoiceError: 'Could not hear you — try again or type your note instead.',
    reviewRecLive: '🔴 Recording {t}… Tap to Stop & Attach',
    reviewRecAttached: '🎤 Voice note attached ({t}) — press ▶ to hear it before sending.',
    reviewRecShort: 'Recording was too short — tap again and speak for a few seconds.',
    reviewRecMicDenied: 'Microphone permission was blocked — allow the mic or type your note instead.',
    reviewFast: '⚡ Fast & Smooth', reviewClear: '🔊 Voice Clear', reviewIssue: '🐞 Found an Issue',
    /* v0.0.6.m Pillar 3: the five human-centric diagnostic chips. */
    chipFast: '⚡ Fast & Smooth', chipVoiceOk: '🔊 Voice Clear', chipVoiceBad: '🔇 Voice / Pronunciation Issue',
    chipIncomplete: '⏳ Dictation Words Incomplete', chipBug: '🐞 UI / Button Issue',
    /* v0.0.6.m Pillar 4: the Paper-mode 1-tap self-check helper. */
    markAllUnmarked: '✓ Mark All Unmarked as Correct',
    markAllUnmarkedToast: 'All unmarked words marked correct — your Missed marks are kept.',
    /* v0.0.6.m Pillar 3: the floating Feedback / Quick-Help launcher. */
    fabTitle: 'Feedback & Quick Help',
    fabSub: 'Instant answers — zero AI credits. Or send the creator a 1-tap encrypted review.',
    fabReviewNote: '🔒 Every review is end-to-end encrypted — nothing readable ever leaves your device unsealed.',
    fabBadge: 'Spot an issue? Tell us',
    fabFaqAudio: '🔇 No sound, or a robotic browser voice?',
    fabFaqAudioA: 'Tap once anywhere on the briefing — a brand-new browser session blocks audio until your first tap, so the briefing waits for it. Also check the phone silent switch and the volume keys. The committed British male briefing clips and the 30 word clips play offline once loaded.',
    fabFaqPacing: '⏳ Words too fast or too slow?',
    fabFaqPacingA: 'On the player screen tap Slower for a 0.72 rate, or open Settings → Pacing to set the writing seconds (3–60), the repeats (1/2/3) and the pause between words. Paper Mode gets two readings and a five-second writing period by default.',
    fabFaqPaper: '📝 Paper Mode vs Typing Mode?',
    fabFaqPaperA: 'Paper Mode is for writing in your exercise book: listen twice, write, and at the results screen tap “✓ Mark All Unmarked as Correct”, then tap Missed on just the one or two words you got wrong. Typing Mode checks your spelling automatically.',
    fabFaqSync: '🔄 Classroom words not updating?',
    fabFaqSyncA: 'Check your internet connection and the sync badge on Home. Lecturers publish new words through Lecturer Mode at any time; your device picks them up automatically. Already-downloaded words keep working offline.',
    studioAlIntro: 'Architecture D — the Hybrid Smart Classroom Gate. LOCK ON stops every unapproved visitor at a full-screen Entry Lock before any student data; LOCK OFF opens the whole web app to everyone.',
    studioAlMaster: 'Master Lock — turn the Private Web App Access Lock ON or OFF anytime (synced to the Apps Script cloud)',
    studioAlApply: ' Apply Master Lock',
    studioAlPasswordLbl: 'Access Lock Password (min 6 characters)',
    studioAlPasswordPh: 'Set / change the class access password…',
    studioAlSetPassword: ' Set / Change Password',
    studioAlPinLbl: 'Admin Break-Glass PIN (4–8 digits)',
    studioAlPinPh: '1234',
    studioAlSetPin: ' Set Break-Glass PIN',
    studioAlCodeCountLbl: 'How many one-time student codes? (1–50)',
    studioAlGenCodes: ' Generate One-Time Codes',
    studioAlLockAll: ' Lock All Now (Exam Mode)',
    studioAlRosterTitle: 'Live Access Roster — pending requests & approved devices',
    studioAlPendingEmpty: 'No pending access requests right now.',
    studioAlApprovedEmpty: 'No approved devices yet.',
    studioAlSecretsLaw: 'Security law: passwords and PINs are hashed (HMAC-SHA256) server-side in Google Apps Script — raw secrets never live in GitHub or this page.',
    studioAlRelayMissing: 'The lock needs the Apps Script relay URL — paste it under Advanced Tools first.',
    studioAlNoticeBody: 'The Web App is currently OPEN (unlocked). Configure the Private Web App Access Lock under Advanced Settings so only approved students can enter.',
    studioAlNoticeJump: ' Open Advanced Settings → Access Lock',
    studioAlNoticeDismiss: ' Dismiss',
    fabFromAnywhere: 'Send a review from any screen — it reaches the creator even if you skip the results card.'
  };

  
  var STRINGS_SI = {
    appName: 'Smart Dictation',
    guideBtn: '? උපදෙස්',
    tabHome: 'මුල් පිටුව', tabPlayer: 'ඩික්ටේෂන්', tabPractice: 'අභ්‍යාස', tabWords: 'වචන', tabSettings: 'සැකසුම්',
    homeTitle: 'Smart Dictation', homeSub: 'ඔබේ පන්තියේ B1 වචන {N} අසමින් ලියන්න, පසුව පරීක්ෂා කරන්න.',
    startDictation: 'ඩික්ටේෂන් අරඹන්න (#1–#30)', howToUse: 'භාවිතා කරන ආකාරය',
    paperMode: 'පොතේ ලිවීම', typingMode: 'ටයිප් කිරීම', resumeSession: 'නැවතැත්වූ තැනින් ඉදිරියට',
    statMastered: 'ප්‍රගුණ කළ වචන', statAccuracy: 'නිවැරදිභාවය', statStreak: 'දින පෙළ',
    quickPractice: 'ක්ෂණික අභ්‍යාස', flashcards: 'ෆ්ලෑෂ් කාඩ්', quiz: 'බහුවරණ ප්‍රශ්න', listening: 'ශ්‍රවණ අභ්‍යාස',
    flashcardsSub: 'වචන {N} ම පෙරළන්න', quizSub: 'නිවැරදි අර්ථය තෝරන්න', listeningSub: 'අහන්න, එතැනින් තෝරන්න', weakWordsSub: 'මඟ හැරි ඒවා නැවත අභ්‍යාස කරන්න',
    weakWords: 'දුර්වල වචන', mastered: 'ප්‍රගුණ කළ', announcements: 'පන්ති දැනුම්දීම',
    creditsLine: 'නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini',
    creditsPill: 'CREDITS GOES TO Hansana',
    btnPrev: '⏮ පෙර', btnPlayPause: 'අසන්න / නවතන්න', btnNext: 'ඊළඟ', btnRepeat: 'නැවත අසන්න',
    btnHint: 'ඉඟියක්', btnModeSwitch: 'මාරුව', btnFinish: 'පිළිතුරු බලන්න',
    readyBeat: 'සූදානම්', listeningBeat: 'අසන්න', writeNowBeat: 'දැන් ලියන්න', pausedBeat: 'තාවකාලිකව නවතා ඇත',
    finishedBeat: 'අවසන් — පිළිතුරු පරීක්ෂා කරන්න', repeatWord: 'වාරය', remainingWord: 'ඉතිරි',
    noWords: 'වචන තවම පූරණය වී නැත', hintPos: 'වචන වර්ගය', hintFirst: 'පළමු අක්ෂරය', hintSi: 'සිංහල තේරුම',
    hintSentence: 'උදාහරණ වාක්‍යය', playAudio: 'හඬ වාදනය',
    pronVariantsBadge: 'බ්‍රිතාන්‍ය උච්චාරණ පිළිගනී', hintLength: 'අකුරු',
    offlineBanner: 'ඕෆ්ලයින් මාදිලියෙන් ක්‍රියාත්මක වේ (මොබයිල් ඩේටා නොමැත)', offlineBannerSub: 'සුරැකි හඬ පට භාවිත වේ',
    offlineBannerHelp: 'උපකාර ලබාගන්න', offlineBackOnline: 'නැවත සම්බන්ධ විය', offlineRetry: 'නැවත සම්බන්ධ වීමට උත්සාහ කරන්න', offlineProbePending: 'සම්බන්ධතාව පරීක්ෂා වෙමින්…',
    updateTimedOut: 'පරීක්ෂාව කල් ඉක්මවීය — සම්බන්ධතාව මන්දගාමීයි. නැවත උත්සාහ කරන්න.',
    homeReadyLoading: 'පන්ති වචන ලැයිස්තුව පූරණය වෙමින්…',
    capPause: 'නවත්වන්න', capResume: 'දිගටම', capStart: 'ආරම්භ',
    studioVerifyGroq: 'Groq යතුර පරීක්ෂා කරන්න', studioVerifyGemini: 'Gemini යතුර පරීක්ෂා කරන්න',
    studioVerifyHttpOk: 'යතුර වලංගුයි', studioVerifyHttp401: 'වලංගු නොවන යතුරකි',
    studioVerifyHttp403: 'අවසරය / කෝටාව ප්‍රතික්ෂේපිතයි', studioVerifyHttp429: 'සීමාව ඉක්මවා ඇත — යතුරු තොගය මාරු කරන්න',
    studioVerifyHttp5xx: 'සේවාදායක දෝෂයකි — පසුව නැවත උත්සාහ කරන්න', studioVerifyHttpOther: 'අනපේක්ෂිත පිළිතුරකි',
    studioVerifyNoKey: 'පළමුව AI යතුර අලවන්න',
    studioVerifyNetErr: 'ජාල / CORS දෝෂයකි — ඉල්ලීම සේවාදායකයට ළඟා වූයේ නැත. අන්තර්ජාලය පරීක්ෂා කර නැවත උත්සාහ කරන්න.',
    studioWordsInvalidTitle: 'පළ කිරීම අවහිරයි — පළමුණු වචන නිවැරදි කරන්න:',
    studioWordsIssueW: 'වචනය නොමැත', studioWordsIssueDup: 'පුනරාවර්තිත වචනයකි',
    studioWordsIssueSi: 'සිංහල තේරුම නොමැත',
    studioWordsIssueM: 'ඉංග්‍රීසි තේරුම නොමැත හෝ අසම්පූර්ණයි',
    studioWordsIssueP: 'IPA උච්චාරණය නොමැත', studioWordsIssuePos: 'වචන වර්ගය නොමැත',
    studioWordsIssueS: 'උදාහරණ වාක්‍යය නොමැත', studioWordsIssueSNoWord: 'උදාහරණයේ වචනය අඩංගු නොවේ',
    studioAutoLockIn: 'ස්ටූඩියෝව තත්පර', studioAutoLockHint: '— නොවැසී සිටීමට ඕනෑම තැනක ස්පර්ශ කරන්න…',
    studioPublishLockOk: 'පළ කර සමමුහූර්ත කර අගුලු ලෑවා — ශිෂ්‍යයන්ට දැන් ඩික්ටේෂන් ආරම්භ කළ හැක.',
    studioGuideBtn: '📘 ස්ටූඩියෝ මාර්ගෝපදේශය', studioGuideTitle: 'කථිකාචාර්ය ස්ටූඩියෝ මාර්ගෝපදේශය',
    studioGuideSimple: 'සරල මාර්ගෝපදේශය — දෛනික ඉගැන්වීම් ප්‍රවාහය', studioGuideAdvanced: 'උසස් මාර්ගෝපදේශය — සියලු පරිපාලක පාලක',
    studioGuideLater: 'පසුව බලමු',
    resultsTitle: 'ස්වයං පරීක්ෂාව සහ ප්‍රතිඵල', colYourWord: 'ඔබ ලියූ වචනය', colCorrectWord: 'නිවැරදි වචනය', colMark: 'ලකුණු කිරීම',
    markCorrect: 'නිවැරදි', markMissed: 'වැරදි', markAll: 'සියල්ල නිවැරදි', toggleMissed: 'ලකුණු මාරු කරන්න',
    btnRetryMissed: 'වැරදි නැවත ලියන්න', btnNewSession: 'නව වාරයක්',
    filterAll: 'සියල්ල {N}', searchWords: 'වචන සොයන්න', noWordsFound: 'වචන හමු නොවීය',
    tapToFlip: 'තේරුම බැලීමට කාඩ්පත ස්පර්ශ කරන්න', tapFlipBack: 'කාඩ්පත නැවත හැරවීමට තට්ටු කරන්න', nextCard: 'ඊළඟ', prevCard: 'පෙර',
    chooseMeaning: 'නිවැරදි තේරුම තෝරන්න', listenAndChoose: 'අසා නිවැරදි වචනය තෝරන්න',
    weakWordsOnly: 'දුර්වල වචන පමණක්', correctPick: 'නිවැරදි!', wrongPick: 'වැරදි',
    setPacing: '1 · ඩික්ටේෂන් වේගය සහ ආකාරය', modeLabel: 'ආකාරය', writeTime: 'ලිවීමට කාලය', repeats: 'වචන පුනරාවර්තන',
    pauseBetween: 'විරාමය', autoAdvance: 'ස්වයංක්‍රීයව ඉදිරියට',
    setAudio: '2 · හඬ සහ උච්චාරණය', voiceSource: 'හඬ මූලාශ්‍රය', voiceAuto: 'ස්වයංක්‍රීය (හොඳම බ්‍රිතාන්‍ය හඬ)',
    voiceLecturer: 'කථිකාචාර්ය පටිගත කිරීම්', voiceAlice: 'Alice (ElevenLabs UK)', voiceDevice: 'උපාංගයේ හඬ',
    rate: 'කථන වේගය', volume: 'හඬ පරිමාව', testVoice: 'හඬ පරීක්ෂා කරන්න',
    setLangTheme: '3 · භාෂාව සහ පෙනුම', language: 'භාෂාව', theme: 'තේමාව',
    themeDark: '🌙 අඳුරු ප්‍රකාරය', themeLight: '☀️ සුබ ප්‍රකාරය (දෙභ)', langEnglish: 'English', langSinhala: 'සිංහල',
    aboutTitle: '5 · මෙම යෙදුම ගැන',
    aboutBlurb: 'එක් පන්තියක් සඳහා නොමිලේ සකසන ලද, අන්තර්ජාලය නොමැතිව ද ක්‍රියා කරන අක්ෂර වින්‍යාස පුහුණු යෙදුමක් — ගිණුම් නැත, දැන්වීම් නැත, ලුහුබැඳීම් නැත.',
    aboutAudience: 'කොළඹ විශ්ව විද්‍යාලයීය ව්‍යාප්ත අධ්‍යයන මධ්‍යස්ථානය — ගාල්ල ශාඛාවේ B1 ඉංග්‍රීසි පන්තිය සඳහා.',
    aboutVersionLabel: 'අනුවාදය', aboutBuiltLabel: 'නිර්මිත දිනය',
    aboutDataLink: 'මෙම යෙදුම සුරකින සෑම දත්තයක්ම බලන්න',
    emptyBank: 'තවම වචන ලැයිස්තුවක් නොමැත. එක් වරක් අන්තර්ජාලයට සම්බන්ධ වී, සැකසුම් තුළ "Check for session update" ඔබන්න.',
    setProgress: '4 · ප්‍රගතිය සහ නොබැඳි ගබඩාව', exportBackup: 'උපස්ථය බාගන්න', importBackup: 'උපස්ථය ගෙන්වන්න',
    resetStats: 'සංඛ්‍යාලේඛන මකන්න', checkUpdate: 'යාවත්කාලීනය පරීක්ෂා කරන්න',
    studioTitle: '6 · කථිකාචාර්ය ස්ටුඩියෝ සහ පරිපාලන බඳුන', studioLocked: 'ස්ටුඩියෝ විවෘත කිරීමට කථිකාචාර්ය PIN ඇතුළත් කරන්න.',
    studioChangePin: 'PIN වෙනස් කරන්ඕ.',
    /* Table B additions — Sinhala UI labels, badges, presets and studio controls */
    dictTitle: 'වචන {N} ලැයිස්තුව · #01–#{P}', dictSearchPh: 'වචන {N} සොයන්න (ඉංග්‍රීසි, සිංහල, උච්චාරණය)...',
    syncBadgeSynced: 'සමමුහුර්තයි',
    syncShortSyncing: 'සමමුහුර්ත වෙමින්…',
    lecturerSyncBar: ' වර්තමාන වේග සැකසුම් (විභාග 5 තත් · 2×) සියලු පන්ති උපකරණවලට විකාශනය කරන්න',

    lecturerSyncDirty: '\ud83d\udd34 සුරඐකී නොමැති වෙනස්කම් — වඩන, හග සහ සැකසුම් සියලුම් උපකරණවලට දැන්නම යවන්න',
    lecturerSyncLast: 'පන්තියට සමමුහුර්ත කළ අවසන් වාරය',
    lecturerSyncIdle: 'තවම සමමුහුර්ත නොවීය — Save & Sync එබන්න',
    lecturerSyncedToast: ' ගුරුවරයාගේ නවතම පන්ති සැකසුම් සමමුහුර්ත විය (අනුවාදය #',
    lecturerSyncNoToken: 'පන්තිය සමමුහුර්ත කිරීමට කථිකාචාර්ය ස්ටූඩියෝවේ GitHub ටෝකනය එක් කරන්න',
    guideQuickTitle: 'ක්ෂණික හඬ උපදෙස් — ඩික්ටේෂන් ක්‍රියා කරන ආකාරය',
    guideSkipStart: '⏩ උපදෙස් මඟහැර දැන්ම ආරම්භ කරන්න',
    studioAskLecturer: 'ස්ටූඩියෝ විවෘත කිරීමට ඔබේ කථිකාචාර්යවරයාගෙන් විමසන්න.',
    studioPinMismatch: 'PIN දෙක නොගැළපේ — එකම ඉලක්කම් 4–8 දෙවරක් ලියන්න.',
    invertMarks: 'ලකුණු මාරු කරන්න (දෙවරක් ස්පර්ශ කරන්න)',
    invertConfirmToast: 'තහවුරු කිරීමට තත්පර 3ක් ඇතුළත නැවත ස්පර්ශ කරන්න',
    syncBadgeOffline: 'අන්තර්ජාලය නැත — සුරැකි වාරය පෙන්වයි',
    syncBadgeUpdate: 'නව යාවත්කාලීනයක් ඇත — නැවත පූරණයට ඔබන්න',
    syncBadgeRetry: 'පරීක්ෂාව අසාර්ථකයි — නැවත උත්සාහ කරන්න',
    guideReplay: ' හඬ උපදෙස් නැවත අසන්න',
    guideAutoPlay: 'ආරම්භයේදී ඉංග්‍රීසි හඬ උපදෙස් ස්වයංක්‍රීයව වාදනය කරන්න',
    presetHeading: 'ඉක්මන් කාල සැකසුම් (Presets)',
    presetBeginner: ' ආරම්භක මන්දගාමී (තත් 12 · 4×)',
    presetStandard: ' CCBE B1 සාමාන්‍ය (තත් 8 · 3×)',
    presetExam: ' විභාග වේගවත් (තත් 5 · 2×)',
    presetBoard: ' ස්මාර්ට් බෝඩ් පන්ති ප්‍රකාරය',
    themeBoard: 'ස්මාර්ට් බෝඩ් අධි-පැහැදිලි තේමාව',
    voiceLockLabel: 'හඬ අගුල (Voice Lock)',
    voiceLockUnified: 'බ්‍රිතාන්‍ය කාන්තා කථිකාචාර්ය හඬ (ඒකාබදද්ධ 25–35 UK)',
    voiceLockCustom: 'තෝරාගත් හඬ මූලාශ්‍රය අනුව',
    downloadClips: ' හඬපට {N} බාගන්න (නොබැඳි)',
    downloadClipsDone: 'වචන {N}න් {A}ම නොබැඳි භාවිතයට සුරැකිණි',
    studioFirstTime: 'පළමු වරට ස්ටුඩියෝ පිහිටුවීම: ඉලක්කම් 4–8 කථිකාචාර්ය PIN අංකය සහ API යතුරු ඇතුළත් කරන්න',
    studioTestEl: 'ElevenLabs යතුර පරීක්ෂා කරන්න',
    studioTestGh: 'GitHub යතුර පරීක්ෂා කරන්න',
    studioShow: 'පෙන්වන්න',
    studioHide: 'සඟවන්න',
    studioPaste: 'අලවන්න',
    pinPadClear: 'මකන්න',
    pinPadUnlock: 'විවෘත කරන්න',
    studioCommitClip: 'පටිගත කළ හඬපටය සුරකින්න',
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
    studioRecord: 'වචනය පටිගත කරන්න', studioSave: 'පියවර 1: යතුරු ස්ථිරවම සුරකින්න (දේශීය බඳුන + GitHub සමමුහුර්තය)', studioLock: 'ස්ටුඩියෝ අගුළු දමන්න',
    studioEnvelope: 'සංකේතිත බඳුන ලියුම (SDP_ENC_V2)', studioCopy: 'ලියුම පිටපත් කරන්න',
    studioPublishOk: 'වාරය ප්‍රකාශයට පත් විය', studioPublishFail: 'ප්‍රකාශනය අසාර්ථක විය',
    studioNoToken: 'පළමුව බඳුනට GitHub ටෝකනයක් එක් කරන්න', studioWordsCount: 'වචන විග්‍රහ කර ඇත',
    studioElevenNote: 'ElevenLabs ජනනය සිදු වන්නේ අගුළු හැර ඇති විට පමණක්, Charlotte හඬ සහ flash_v2_5 සමඟය.',
    /* ── v0.0.1.c Table B (සිංහල) ── */
    guideTapToStart: ' හඬ උපදෙස් ආරම්භ කිරීමට ඕනෑම තැනක ස්පර්ශ කරන්න',
    homeJourney1: 'අසා ලියන්න',
    homeJourney2: 'වචන {N} පරීක්ෂා කරන්න',
    homeJourney3: 'දුර්වල වචන පුහුණු වන්න',
    homeReadyBadge: '{S} වන වාරය සූදානම් · වචන {N}',
    modePaperFull: ' පොතේ ලිවීම',
    modeTypingFull: 'තිරයේ ටයිප් කිරීම',
    voiceGuideBtn: ' හඬ උපදෙස්',
    boardShowWord: ' 👁 වචනය පෙන්වන්න',
    boardHideWord: ' 🙈 වචනය සඟවන්න',
    quotaHeading: 'ElevenLabs අක්ෂර සීමාව (ගාස්තු රහිත පරීක්ෂාව)',
    costPreviewLabel: 'ඇස්තමේන්තුගත අක්ෂර වැයවීම',
    testOneWordBtn: ' එක් වචනයක් පරීක්ෂා කරන්න (~අක්ෂර 8)',
    forceRegenLabel: 'දැනට පවතින හඬපට නැවත උත්පාදනය කරන්න',
    genDeltaBtn: ' ඉතිරි හඬපට පමණක් සාදන්න (Credit-Saver)',
    teacherUpdatedToast: 'ගුරුවරයා පන්තියේ සැකසුම් යාවත්කාලීන කරන ලදී',
    vaultSavedToast: 'ආරක්ෂිත යතුරු සුරැකිණි · GitHub වෙත සමමුහුර්ත විය',
    guideVoiceFailed: 'හඬ උපදෙස් නොමැත — නැවත උත්සාහ කිරීමට ස්පර්ශ කරන්න',
    boardPlayPause: '▶ වාදනය / නවතන්න',
    boardRepeat: ' නැවත අසන්න',
    boardNext: '⏭ ඊළඟ',
    boardJumpLabel: 'වචනයට යන්න',
    syncShortSynced: 'සමමුහුර්තයි ',
    syncShortOffline: 'නොබැඳි',
    syncShortUpdate: 'යාවත්කාලීන',
    syncShortRetry: 'නැවත',
    homeJourneyTitle: 'අද ඔබේ පියවර 3',
    settingsSyncLabel: 'සමමුහුර්තය',
    settingsUpdateLabel: 'යාවත්කාලීනය',
    guiding: 'උපදෙස්',
    /* v0.0.1.f additions (D9, D13, D14, D17, D18) */
    resumePaused: 'නැවතැත්වූ ඩික්ටේෂන් දිගටම යන්න',
    homePresetBadge: 'වේගවත් විභාග අඩවිය · තත්පර 5 · 2 වාරය · බ්‍රිතාන්‍ය ඉංග්‍රීසි',
    repeatBadge: 'වාරය',
    pausedBanner: 'තාවකාලිකව නවතා ඇත — දිගටම කරගෙන යාමට ස්පර්ශ කරන්න',
    btnResumeDictation: 'ඩික්ටේෂන් දිගටම කරගෙන යන්න',
    pauseReasonNavigation: 'ඔබ තිරය මාරු කළා',
    pauseReasonModal: 'කවුළුවක් විවෘත විය',
    pauseReasonVisibility: 'යෙදුම පසුගිය තලයට ගියා',
    pauseReasonUser: 'ඔබ නැවැත්වීමට ස්පර්ශ කළා',
    guideAutoplayBanner: ' හඬ උපදෙස් ආරම්භ කිරීමට ඕනෑම තැනක ස්පර්ශ කරන්න',
    studioCardKeys: 'පියවර 1 — API යතුරු සහ හඬපට 34 පැකේජය',
    studioCardWords: 'පියවර 2 — වචන සංස්කාරකය සහ නොමිලේ AI ස්වයං පිරවීම',
    studioCardSettings: 'පියවර 3 — පන්ති සැකසුම් විකාශනය සහ PIN ආරක්ෂාව',
    studioLockLecturer: 'කථිකාචාර්ය ප්‍රකාරය අගුළු දමන්න',
    studioAiProvider: 'නොමිලේ AI / ශබ්දකෝෂ එන්ජිම',
    studioAiKey: 'නොමිලේ AI යතුර (අවශ්‍ය නැත)',
    studioTestAi: 'නොමිලේ AI / ශබ්දකෝෂ එන්ජිම පරීක්ෂා කරන්න',
    studioAiNoKey: '1: ඉදිකළ නොමිලේ Oxford/Wikimedia ශබ්දකෝෂය සහ සිංහල පරිවර්තකය (100% නොමිලේ — යතුරක් අවශ්‍ය නැත)',
    studioOneClick: ' බ්‍රිතාන්‍ය මහාචාර්ය හඬ 70 සාදා සියලු උපාංග සමමුහුර්ත කරන්න',
    studioBulkWords: 'වාරයේ වචන අලවන්න හෝ ලියන්න (එක් පේළියකට එකක් හෝ කොමාවෙන් වෙන් කර)',
    studioEnrich: 'IPA, ඉංග්‍රීසි සහ සිංහල අර්ථ ස්වයංක්‍රීයව පුරවන්න (නොමිලේ AI / ශබ්දකෝෂය)',
    studioWordManager: 'වචන කළමනාකරු — # · w · p · pos · m · si · s',
    studioPublishWordsVoice: ' හඬ සාදා වචන සියලු උපාංග වෙත පළ කරන්න',
    studioSyncSettings: ' පන්ති සැකසුම් සියලු උපාංග වෙත සුරකා සමමුහුර්ත කරන්න',
    studioMasterSteps: 'සැකසුම් ප්‍රගතිය',
    studioEnriching: 'පුරවමින්',
    studioEnriched: 'පුරවා අවසන්',
    studioAiOffline: 'නොබැඳි B1 ශබ්දකෝෂය භාවිතා විය',
    /* ── v0.0.1.h (D2, D6, D7, D10, D13, D14) ── */
    vaultBadgeLabel: 'යතුරු බඳුන සුරකින ලදී · යාවත්කාලීනවලින් ආරක්ෂිතයි',
    studioFreeNoKey: '100% නොමිලේ — API යතුරක් අවශ්‍ය නැත!',
    studioQuotaScoped: 'යතුර පිළිගැනිණි (scoped/නොමිලේ මට්ටමේ යතුර — සීමා කියවීම මඟ හැරිණි)',
    studioElTierWarn: 'ElevenLabs නොමිලේ සීමාව අවසන් — ඉතිරි වචන සඳහා ඉදිකළ නොමිලේ බ්‍රිතාන්‍ය කාන්තා මහාචාර්ය හඬ භාවිතා වේ',
    studioSavedLocal: 'දේශීය බඳුනේ සුරකින ලදී (යාවත්කාලීනවලින් ආරක්ෂිතයි)',
    studioAiSlotPollinations: '2: Pollinations නොමිලේ විවෘත මූලාශ්‍ර AI (Llama/Mistral — 100% නොමිලේ, යතුරක් අවශ්‍ය නැත!)',
    studioAiSlotGroq: '3: Groq Cloud නොමිලේ මට්ටම · Llama-3.3-70B (gsk_… — නොමිලේ, කාඩ්පතක් අවශ්‍ය නැත)',
    studioAiSlotOpenrouter: '4: OpenRouter නොමිලේ ආකෘති · Llama-3.3-70B:free (sk-or-… — නොමිලේ මට්ටම)',
    studioAiSlotGemini: '5: Google Gemini නොමිලේ මට්ටම · gemini-2.5-flash (AIza… — අමතර)',
    studioWorking: 'ක්‍රියාත්මක වෙමින්…',
    studioClear: 'හිස් කරන්න',
    studioRestored: 'මෙම ටැබයෙන් ස්ටූඩියෝව නැවත ලබා ගන්නා ලදි',
    studioNoVaultWarn: 'තවම බඳුනක් සකසා නැත — යතුරු නොමැතිව වචන ප්‍රකාශ වේ',
    studioAiOfflineFallback: 'AI අක්‍රියයි — නොමිලේ ශබ්දකෝෂය භාවිතා විය',
    /* ── v0.0.2.a (සිංහල) ── */
    tabStudio: 'කථිකාචාර්ය',
    homeStep1Tag: 'පියවර 1', homeStep2Tag: 'පියවර 2', homeStep3Tag: 'පියවර 3',
    homeWordsTitle: 'වචන {N} ම #1–#{P} අනුපිළිවෙලින් පරීක්ෂා කර අධ්‍යයනය කරන්න',
    homeWordsSub: 'සෑම වචනයක්ම පන්ති අනුපිළිවෙලින්, බ්‍රිතාන්‍ය උච්චාරණය, සිංහල තේරුම සහ උදාහරණ වාක්‍යය සමඟ.',
    homeWordsBtn: ' වචන {N} ලැයිස්තුව විවෘත කරන්න',
    resumeMetaIdle: 'වචන #1 දී නවතා ඇත (වචන {N} න්)',
    startOver: '↺ #1 සිට නැවත අරඹන්න',
    cueStep1: 'පියවර 1 — මෙතැන ඔබන්න',
    cuePlayer: 'මෙතැනින් නවතන්න හෝ දිගටම යන්න',
    cueDict: 'අසන්න වචනයක් ඔබන්න',
    cueStudio: 'ඔබේ PIN ඇතුළත් කරන්න',
    settingsLecturerActive: ' කථිකාචාර්ය ප්‍රකාරය සක්‍රීයයි — විකාශනයට ස්ටූඩියෝව විවෘත කරන්න',
    openStudioBtn: ' ස්ටූඩියෝව විවෘත කරන්න',
    studioScreenTitle: ' කථිකාචාර්ය පරිපාලන ස්ටූඩියෝව',
    studioScreenSub: 'කථිකාචාර්ය PIN එකෙන් විවෘත කරන්න \u2014 පන්ති වචන අලවන්න, සැසියේ අංකය පරීක්ෂා කර, සියලුම පන්ති උපාංගවලට විකාශනය කරන්න.',
    lecturerAdminLocked: ' කථිකාචාර්ය පරිපාලනය', lecturerAdminUnlocked: ' කථිකාචාර්ය පරිපාලනය',
    btnReplay: ' නැවත අසන්න',
    btnPauseDictation: '⏸ නවතන්න',
    btnResumeWord: '▶ වචන # දිගටම',
    btnPrevNum: '⏮ පෙර (#', btnNextNum: '⏭ ඊළඟ (#',
    listenCarefully: 'හොඳින් අසන්න (වාරය ', writeInBook: 'වචන #',
    inYourBook: ' ඔබේ පොතේ ලියන්න! (', countdownTail: ' තත්පර ගණන්)',
    pausedAtWord: 'වචන #', pausedResumeTail: ' දී ඩික්ටේෂන් නවතා ඇත — පහතින් දිගටම යන්න ඔබන්න',
    resumeMetaLine: 'වචන # දී නවතා ඇත · ඉතිරි ', ofWord: ' / {N} · වාරය ', secondsLeft: ' තත්පර',
    progressWord: 'වචන #', progressOf: ' / {N}',
    progressWordUpper: 'වචන #', progressOf30: ' / {N}', repeatOf: ' න් ', writeSecsBadge: 'තත් ලියන්න',
    capPrev: 'පෙර', capPlay: 'නවත්වන්න', capReplay: 'නැවත', capNext: 'ඊළඟ',
    capRepeat: 'පුනරාවර්තනය', capHint: 'ඉඟිය', capMode: 'ක්‍රමය', capFinish: 'පරීක්ෂාව',
    pillsDrawer: 'වචන 1–{N} යන්න ▾',
    markCorrectWord: ' නිවැරදි', markWeakWord: ' පුහුණුව අවශ්‍යයි', btnStartDictation: '▶ ඩික්ටේෂන් අරඹන්න',
    studioRetryNone: 'නැවත උත්සාහ කිරීමට අසාර්ථක ක්ලිපයක් නැත — සියලු ක්ලිප සුරකිනු ලැබීය.',
    studioRetryOne: '↻ අසාර්ථක වූ ක්ලිපය පමණක් නැවත උත්සාහ කරන්න',
    studioStep1Head: 'පියවර 1 — API යතුරු සහ හඬපට 34 උත්පාදකය',
    studioStep2Head: 'පියවර 2 — වචන සංස්කාරකය සහ නොමිලේ AI ස්වයං පිරවීම',
    studioStep3Head: 'පියවර 3 — පන්ති සැකසුම් විකාශනය සහ PIN ආරක්ෂාව',
    studioPackVault: 'බඳුන: සුරකින ලදී ', studioPackGithub: 'GitHub: සම්බන්ධයි ', studioPackClips: 'හඬ පැකේජය: ',
    studioClipsUnit: '/හඬපට 74', studioGenPrefix: 'හඬපට සාදමින් ',
    studioGenCharsTail: ' අක්ෂර භාවිතය', studioClipsSaved: '/හඬපට 34 GitHub වෙත සුරකින ලදී · syncRev ',
    studioRetryFailed: ' ඉතිරි හඬපට පමණක් නැවත උත්සාහ කරන්න',
    studioOneClick34: ' බ්‍රිතාන්‍ය මහාචාර්ය හඬ 70 සාදා සියලු උපාංග සමමුහුර්ත කරන්න',
    studioSaveOnly: ' යතුරු බඳුනේ පමණක් සුරකින්න',
    studioPublishWordsVoice34: ' හඬ සාදා වචන සියලු උපාංග වෙත පළ කරන්න',
    studioOneClickFull: 'වචන පළ කර සමමුහුර්ත කරන්න',
    studioWordsRecognized: 'වචන හඳුනාගත්',

    studioWordModified: 'වචන(ග) වෙනස් කර ඇත',
    studioClickBroadcast: 'විකාශනය කිරීමට බාගන්න — ස්වයක්‍රීක්‍රරීම සහ සමව්රාකකළ',
    studioErrTitle: 'දෙයක් ඔබේ අවධානය ඉල්ලයි',
    studioErrFixNow: 'එක් ක්ලික් එකකින් නිවැරදි කරන්න / අසාර්ථක පියවර නැවත උත්සාහ කරන්න',
    studioErrDismiss: 'වසන්න',
    pillReady: '🎧 සූදානම්',
    pillPaused: '⏸ විරාමයි — නැවත පටන් ගන්න',
    pillFinished: '✅ අවසන් — පිළිතුරු පරීක්ෂා කරන්න',
    pillListening: '🎧 සවන් දෙන්න · පුනරාවර්තනය',
    pillWriting: '✍️ වචනය ලියන්න ·',
    pillFinishWarn: '⏳ ලිවීම අවසන් කරන්න ·',
    studioBroadcast34: ' වර්තමාන වේග සැකසුම් (විභාග 5 තත් · 2×) සියලු පන්ති උපාංගවලට විකාශනය කරන්න',    guideCard3Tag: '4 න් 3 — වචන #1 සිට #{N} දක්වා පිළිවෙලින් පරීක්ෂා කරන්න', guideCard4Tag: '4 න් 4 — ස්වයංක්‍රීය පන්ති සමමුහුර්තය සහ කථිකාචාර්ය පරිපාලනය',
    guideSkipStartNow: '▶ දැන් Start Dictation ඔබන්න',
    guideSpotlight1: 'ඩික්ටේෂන් ආරම්භ කිරීමට පහළ ඇති ▶ Start Dictation බොත්තම ඔබන්න.',
    guideSpotlight2: 'සෑම වචනයක්ම දෙවරක් අසන්න, පසුව තත්පර පහක් තුළ ලියන්න.',
    guideSpotlight3: 'වාරය අවසන් වූ පසු වචන තිහම පිළිවෙලින් පරීක්ෂා කරන්න.',
    guideSpotlight4: 'ඔබට මඟ හැරුණු වචන නැවත පුහුණු වන්න.',
    guideStepTagPrefix: 'පියවර', guideStepTagSuffix: 'න් 4',
    guideExitBtn: ' ඉවත් වන්න',
    studioSavedOk: ' යතුරු සුරක්ෂිතව තැන්පත් කරන ලදී',
    studioVerifyEl: ' ElevenLabs හඬ යතුර පරීක්ෂා කරන්න',
    studioVerifyOk: 'වලංගුයි  (ඉතිරි නොමිලේ අක්ෂර: ',
    studioVerifyBad: 'වලංගු නොවේ  (HTTP ',
    studioVerifyHint: 'වලංගු නොවේ — ElevenLabs වෙතින් sk_… රහස අලවන්න (e1b… අගය යතුරු හැඳුනුමයි, වැඩ නොකරයි)',
    studioClips70: 'හඬපට 70 = අක්ෂර 829 ≈ මාසික නොමිලේ කෝටාවෙන් 8.3% (flash_v2_5 ≈ ණය 414)',
    studioRecoveryUsed: 'ප්‍රධාන ප්‍රතිසාධනය භාවිතයි — දැන් නව PIN එකක් සකසන්න',
    studioChangePinBtn: ' කථිකාචාර්ය PIN වෙනස් කරන්න',
    presetReset: 'පන්ති පෙරනිමියට යථා කරන්න (5 තත් · 2×)',
    studioOneClickSub: 'ස්වයංක්‍රීය: බ්‍රිතාන්‍ය IPA · සිංහල තේරුම · හඬ පැකේජය · සියලු උපාංග සමමුහුර්තය',
    studioAdvancedToggle: ' උසස් මෙවලම් සහ වචන පරීක්ෂකයා',
    ssbUnlocked: 'කථිකාචාර්ය ප්‍රකාරය විවෘතයි — උපාංගය සිසුන්ට දීමට පෙර අගුළු දමන්න',
    guardTitle: '🔴 මුලා නොසිදුක් වෙනස්කම්',
    guardBody: 'වෙනස්කල් වන හෝ සැකසුම් තවම පළ නොකර ඇත. මාරු වීමට පෙර පළ කර සමව්රාක අගුලු දමන්න — නැහැත් එවා අතර දමන්න.',
    guardPublish: '🔴 පළ කර, සමමුහූර්ත කර පිටවන්න',
    guardLock: '🔒 අතර දමන්න අගුලු දමන්න',
    guardStay: '✏️ කථිකාචාර්‍ය ප්‍රකාරයෙහි රැඳී සිටින්න',
    studioPublishOkFull: ' සියලුම උපාංග වෙත සාර්ථකව ප්‍රකාශයට පත් කරන ලදී',
    /* v0.0.6.d (D1/D7/D8) — සිංහල */
    wordsRefreshedToast: '🔄 වචන ලැයිස්තුව යාවත්කාලීන විය — ඩික්ටේෂන් #1 වචනයේ සිට සූදානම්',
    toastLoadedCapsule: '📊 දත්ත භාවිතය',
    toastOfflineCapsule: '📊 නොබැඳිව සූදානම්',
    ringTapStart: 'ආරම්භයට ස්පර්ශ කරන්න',
    ringTapPause: 'විරාමයට ස්පර්ශ කරන්න',
    ringTapResume: 'දිගටම යාමට ස්පර්ශ කරන්න',
    revealShow: 'වත්මන් වචනය පෙන්වන්න', revealHide: 'වචනය සඟවන්න', revealPausedBadge: '⏸ වචනය බලමින් විරාමයි',
    stalePillLabel: '⚠ පැරණි වචන ලැයිස්තුව — නැවුම් කිරීමට ස්පර්ශ කරන්න',
    updateSyncing: '🔄 නව පන්ති යාවත්කාලීනයක් හමුවිය — මොහොතකින් නැවුම් වෙමින්…', updateAsk: 'නව පන්ති වචන සූදානම්. දැන් නැවුම් කරන්නද?',
    updateNow: 'දැන් යාවත්කාලීන කරන්න (OK)', updateLater: 'පසුව',
    studioOfflineTitle: 'විද්‍යාගාරයට අන්තර්ජාලය අවශ්‍යයි',
    studioOfflineBody: 'විද්‍යාගාරය සඳහා ක්‍රියාකාරී අන්තර්ජාල සම්බන්ධතාවක් අවශ්‍ය බැවින් සියලු වෙනස්කම් GitHub Cloud වෙත සමමුහූර්ත වේ. සිසු ඩික්ටේෂන් ප්‍රකාරය නොබැඳිව ක්‍රියා කරයි.',
    sessionNoLabel: 'වාර අංකය', sessionTitleLabel: 'වාර මාතෘකාව',
    pasteWords: '📋 අලවන්න', clearWords: '🧹 හිස් කරන්න', confirmWords: '✓ වචන තහවුර කරන්න',
    liveChipsLabel: 'වචන චිප', helperReady: '✓ 30 / 30 වචන සූදානම්',
    helperOver: '{n} වචන හමු විය (අවශ්‍ය 30) — ඉවත් කිරීමට ✕ හෝ ඒකාංශ කිරීමට ⇄ ස්පර්ශ කරන්න',
    studioStep1: 'පියවර 1 · එක් වරක් සැකසීම', studioStep2: 'පියවර 2 · වචන අලවන්න', studioStep3: 'පියවර 3 · පන්තියට විකාශනය',
    helperUnder: '{n} / 30 වචන — තව {need}ක් එකතු කරන්න',
    wordsConfirmedOk: '✓ වචන තහවුරු කළා — විකාශනයට සූදානම්', wordsCleared: 'වචන සංස්කාරකය හිස් කළා',
    chipMergeLabel: 'ඊළඟ වචනය සමඟ ඒකාංශ කරන්න', chipRemoveLabel: 'වචනය ඉවත් කරන්න',
    apiCreditsExhausted: '⚠️ API ක්‍රෙඩිට් අවසන් වී ඇත — කරුණාකර නව API යතුරක් ඇතුළත් කරන්න',
    apiCreditsExhaustedSi: '⚠️ API ක්‍රෙඩිට් අවසන් වී ඇත — කරුණාකර නව API යතුරක් ඇතුළත් කරන්න',
    apiCreditsFixNow: 'උසස් මෙවලම් විවෘත කර යතුර ඇතුළත් කරන්න',
    pinComplete: '✓ PIN සම්පූර්ණයි',
    pinDigitsNeeded: 'ඉලක්කම්',
    /* ══ v0.0.6.m — ව්‍යාපෘති හඳුන්වාදීම, බීටා නාලිකාව, සැසියෙන් පසු සමාලෝචනය ══ */
    creatorNoteBtn: '♪ ව්‍යාපෘති හඳුන්වාදීම',
    briefingEyebrow: 'විවෘත කේත ව්‍යාපෘති සාරාංශය · ස්වයංක්‍රීය පද්ධතිය',
    briefingTitle: 'Smart Dictation · ව්‍යාපෘති දළ විශ්ලේෂණය',
    briefingPersona: 'ඔක්තෝබර් 22 ආරම්භ විය (සති 2) · $0 විවෘත-කේත පද්ධතිය',
    briefingLinkCode: 'GitHub කේතය ↗',
    briefingLinkProfile: "Hansana ගේ GitHub සහ RDP ↗",
    briefingContinue: '▶ Start Dictation →',
    briefingContinueWait: 'Start Dictation ({n}s)…',
    briefingContinueBeat1: 'Start Dictation (පළමු පාරාග්‍රාෆය සම්පූර්ණ වෙමින්…)',
    briefingContinueAll: 'Start Dictation (පාරාග්‍රාෆය {p} / 4…)',
    briefingSkip: 'ඉවත් වන්න',
    briefingSkipTop: '✕ මඟහරින්න →',
    briefingCountdown: 'කරුණාකර අහන්න / කියවන්න ({n}s)…',
    briefingUnlocked: 'ඇහුවට ස්තූතියි — කැමති විටක ඉදලා ඉදිරියට යන්න.',
    betaPillLabel: 'බීටා',
    betaStampLabel: 'බීටා · 0.0.6.n.beta — ව්‍යාපෘති හඳුන්වාදීම · Multi-API · සමාලෝචන · දයග්නොස්ටික්ස්',
    betaOnToast: 'බීටා නාලිකාව ක්‍රියාත්මකයි — v0.0.6.n පොදිය ඉස්මතියේ තිබේ',
    betaOffToast: 'බීටා නාලිකාව වසා ඇත — සාමාන්‍ය ප්‍රධාන කොක්පිට් එකට ආපසු',
    reviewTitle: 'Smart Dictation වඩාත් හොඳ කරන්න — ඔබේ ඉක්මන් සමාලෝචනය බෙදාගන්න',
    reviewSub: '100% අවශ්‍ය නැත — තට්ටු දෙකක් හෝ කෙටි කටහඬක්. එය කේතනය කර නිර්මාණකරුට යයි.',
    reviewPopupTitle: 'ඔබේ ඩික්ටේෂන් සැසිය කොහොමද වුණේ?',
    reviewPopupSub: 'එක් තට්ටුවකින් අපට උදව් කරන්න:',
    reviewVoiceBtn: '🎤 සමාලෝචනය කථනයෙන් පටිගත කරන්න (ඉංග්‍රීසි හෝ සිංහල)',
    reviewTextPh: 'හෝ කෙටි සටහනක් ලියන්න (අවශ්‍ය නම්)…',
    reviewSendBtn: 'සමාලෝචනය යවන්න',
    reviewSkipBtn: 'මඟහරින්න — අවශ්‍ය නැත',
    reviewSentToast: 'ස්තූතියි! ඔබේ කේතනය කළ සමාලෝචනය සුරැකුණා.',
    reviewSkipToast: 'කමක් නැත — ඔබේ කේතනය කළ සැසි දත්තත් නිර්මාණකරුට උදව් වෙනවා. පන්තිය නිදහසේ භුක්ති විඳින්න!',
    reviewVoiceListening: 'අහමින්… දැන් කථනය කරන්න, නවත්වන්න නම් නැවත තට්ටු කරන්න.',
    reviewVoiceHeard: 'ඇහුණා: “{t}” — යවන්න නැතහොත් පෙළ සංස්කරණය කරන්න.',
    reviewVoiceOff: 'මෙම බ්‍රව්සරයේ කටහඬ සමාලෝචනය ලැබෙන්නේ නැත — ලිවීම හැම තැනම වැඩ.',
    reviewVoiceError: 'කටහඬ ඇහුණේ නැත — නැවත උත්සාහ කරන්න හෝ ලියන්න.',
    reviewRecLive: '🔴 පටිගත වෙමින් {t}… නවත්වා ඇමිණීමට තට්ටු කරන්න',
    reviewRecAttached: '🎤 කටහඬ සටහන ඇමිණුණා ({t}) — යැවීමට පෙර ▶ වෙන් අහන්න.',
    reviewRecShort: 'පටිගත කිරීම තරමක් කෙටියි — නැවත තට්ටු කර තත්පර කිහිපයක් කථනය කරන්න.',
    reviewRecMicDenied: 'මයික්‍රොෆෝන් අවසරය අවහිර වී ඇත — මයික් අවසර දෙන්න නැතහොත් ලියන්න.',
    reviewFast: '⚡ ඉක්මන් සහ නිරවද්‍යයි', reviewClear: '🔊 කටහඬ පැහැදිලියි', reviewIssue: '🐞 ගැටලුවක් හමුවුණා',
    chipFast: '⚡ ඉක්මන් සහ නිරවද්‍යයි', chipVoiceOk: '🔊 කටහඬ පැහැදිලියි', chipVoiceBad: '🔇 කටහඬ / උච්චාරණ ගැටලුවක්',
    chipIncomplete: '⏳ ඩික්ටේෂන් වචන අසම්පූර්ණයි', chipBug: '🐞 UI / බොත්තම් ගැටලුවක්',
    markAllUnmarked: '✓ ලකුණු නොකළ සියල්ල නිවැරදි ලෙස සලකුණු කරන්න',
    markAllUnmarkedToast: 'ලකුණු නොකළ වචන සියල්ල නිවැරදි ලෙස සලකුණු කළා — ඔබේ “වැරදුණා” ලකුණු ආරක්ෂා වේ.',
    fabTitle: 'ප්‍රතිචාර සහ ඉක්මන් උපකාරය',
    fabSub: 'විනාඩියක් ඇතුළත පිළිතුරු — AI ශ්‍රේය්ණියක් වත් නැත. නැතහොත් නිර්මාණකරුට එක් තට්ටුවකින් කේතනය කළ සමාලෝචනයක් යවන්න.',
    fabReviewNote: '🔒 සෑම සමාලෝචනයක්ම අන්ත සිට අන්තට කේතනය කර ඇත — කියවිය හැකි කිසිවක් ඔබේ උපාංගයෙන් පිටතට නොයයි.',
    fabBadge: 'ගැටලුවක් දැක්කාද? කියන්න',
    fabFaqAudio: '🔇 හඬක් නැති වුණා, නැතහොත් යන්ත්‍ර සේවක කටහඬක් ඇහුණාද?',
    fabFaqAudioA: 'සාරාංශය මත ඕනෑම තැනක එක් තට්ටුවක් කරන්න — අලුත් බ්‍රව්සර් සැසියක ඔබේ පළමු තට්ටුව වන තුරු හඬ අඟහරි වේ, එබැවින් සාරාංශය එයට රැඳී සිටියි. දුරකථනයේ නිශ්ශබ්ද ස්විචය සහ ශබ්ද ප්‍රමාණයද පරීක්ෂා කරන්න. බ්‍රිතාන්‍ය පිරිමි හඬ ක්ලිප් සහ සියලු වචන ක්ලිප් එක් වරක් පූරණය වූ පසු ඕෆ්ලයින් වැඩ කරයි.',
    fabFaqPacing: '⏳ වචන ඉතා ඉක්මන් හෝ මන්දගාමීද?',
    fabFaqPacingA: 'ධාවක තිරයේ “මන්දගාමී” බොත්තම තට්ටු කරන්න (0.72 වේගය), නැතහොත් සැකසුම් → වේගයෙන් ලිවීමේ තත්පර (3–60), පුනරාවර්තන (1/2/3) සහ වචන අතර විරාමය සකසන්න. කඩදාසි ප්‍රකාරයේ පෙරනිමිය කියවීම් දෙකක් සහ තත්පර පහක ලිවීමේ කාලයකි.',
    fabFaqPaper: '📝 කඩදාසි ප්‍රකාරය සහ ටයිප් කිරීමේ ප්‍රකාරය?',
    fabFaqPaperA: 'කඩදාසි ප්‍රකාරය ලේඛන පොතේ ලිවීමට: දෙවරක් අසා, ලියා, ප්‍රතිඵල තිරයේ “✓ ලකුණු නොකළ සියල්ල නිවැරදි ලෙස සලකුණු කරන්න” තට්ටු කර, වැරදුණු එක් දෙකකට පමණක් “වැරදුණා” තට්ටු කරන්න. ටයිප් කිරීමේ ප්‍රකාරය ඔබේ අක්ෂර වින්‍යාසය ස්වයංක්‍රීයව පරීක්ෂා කරයි.',
    fabFaqSync: '🔄 පන්ති වචන යාවත්කාලීන නොවෙනවාද?',
    fabFaqSyncA: 'අන්තර්ජාල සම්බන්ධතාවය සහ මුල් පිටුවේ සමමුහූර්ත ලාංඡනය පරීක්ෂා කරන්න. දේශනවරු ඕනෑම වේලාවක නව වචන ප්‍රකාශයට පත් කරති; ඔබේ උපාංගය ඒවා ස්වයංක්‍රීයව ලබා ගනී. බාගත කළ වචන ඕෆ්ලයින්වත් වැඩ කරයි.',
    studioAlIntro: 'Architecture D — මිශ්‍ර ක්‍රියාකාරී පන්ති දොරටුව. LOCK ON දෙන විට අනුමත නොකළ සෑම අමුත්තකුම සිසු දත්ත පෙනෙන පෙරම පූර්ණ-තිර ප්‍රවේශ අගුළුවක නවතිති; LOCK OFF දෙන විට සම්පූර්ණ වෙබ් යෙදුම සියලුදෙනාට විවෘතයි.',
    studioAlMaster: 'ප්‍රධාන අගුළුව — පෞද්ගලික වෙබ් යෙදුම් ප්‍රවේශ අගුළුව ඕනෑම වේලාවක ON/OFF කරන්න (Apps Script වලවලට සමමුහූර්තයි)',
    studioAlApply: ' ප්‍රධාන අගුළුව යොදන්න',
    studioAlPasswordLbl: 'ප්‍රවේශ මුර-පදය (අවම අක්ෂර 6)',
    studioAlPasswordPh: 'පන්ති ප්‍රවේශ මුර-පදය සකසන්න…',
    studioAlSetPassword: ' මුර-පදය සකසන්න / වෙනස් කරන්න',
    studioAlPinLbl: 'පරිපාලක අතෘප්ත මුර-අංකය (අංක 4–8)',
    studioAlPinPh: '1234',
    studioAlSetPin: ' අතෘප්ත මුර-අංකය සකසන්න',
    studioAlCodeCountLbl: 'එක් වරක් වලංගු සිසු කේත කීයද? (1–50)',
    studioAlGenCodes: ' එක්-වරක් කේත සාදන්න',
    studioAlLockAll: ' සියල්ලටම දැන් අගුළු දමන්න (විභාග ප්‍රකාරය)',
    studioAlRosterTitle: 'සජීවී ප්‍රවේශ නාමාවරය — අපේක්ෂිත ඉල්ලීම් සහ අනුමත උපාංග',
    studioAlPendingEmpty: 'දැනට අපේක්ෂිත ඉල්ලීම් නැත.',
    studioAlApprovedEmpty: 'දැනට අනුමත උපාංග නැත.',
    studioAlSecretsLaw: 'ආරක්ෂණ නීතිය: මුර-පද සහ මුර-අංක Google Apps Script තුළ සේවාදානයේදීම කේතනය (HMAC-SHA256) වේ — අමු රහස් කිසිවිටෙකත් GitHub හෝ මෙම පිටුවේ නොතැනේ.',
    studioAlRelayMissing: 'අගුළුවට Apps Script relay URL අවශ්‍යයි — පළමුව උසස් මෙවලම් යට අලවන්න.',
    studioAlNoticeBody: 'වෙබ් යෙදුම දැනට විවෘතයි (අගුළු නොවුණු). උසස් සැකසුම් යට පෞද්ගලික වෙබ් යෙදුම් ප්‍රවේශ අගුළුව සකසන්න, එවිට අනුමත සිසුන්ට පමණක් ඇතුළු විය හැක.',
    studioAlNoticeJump: ' උසස් සැකසුම් → ප්‍රවේශ අගුළුව විවෘත කරන්න',
    studioAlNoticeDismiss: ' වසා දමන්න',
    fabFromAnywhere: 'ඕනෑම තිරයකින් සමාලෝචනයක් යවන්න — ප්‍රතිඵල කාඩ්පත මඟහැරුවත් එය නිර්මාණකරුට ළඟා වේ.'
  };

  var lang = 'en';
  var theme = 'light';
  var initialized = false;
  var practice = { mode: 'flash', index: 0, flipped: false, answered: '', score: 0, pool: [] };

  function t(key, fallback) {
    var table = lang === 'si' ? STRINGS_SI : STRINGS_EN;
    var value = table[key];
    if (value === undefined) value = STRINGS_EN[key];
    if (value === undefined) return fallback === undefined ? key : fallback;
    return value;
  }
  /* v0.0.7.c (BUG-05): {N} total words · {P} zero-padded total · {S} session
     no · {A} auxiliary count — every word-count string is templated, painted
     from the LIVE bank, and can never go stale again. */
  function fmtN(template, n, p, a) {
    return String(template)
      .replace('{N}', String(n === undefined ? 0 : n))
      .replace('{P}', String(p === undefined ? n : p))
      .replace('{A}', String(a === undefined ? n : a));
  }
  function liveTotal() {
    var n = 0;
    try { n = Number(SDP.Sync && SDP.Sync.wordCount ? SDP.Sync.wordCount() : 0) || 0; } catch (e) { n = 0; }
    if (!n) n = words().length || 0;
    return n;
  }
  function setLabel(host, text) {
    if (!host) return false;
    var inner = host.querySelector ? host.querySelector('.i18n-label') : null;
    setText(inner || host, text);
    return true;
  }
  function paintWordCounts() {
    var n = liveTotal(), p = pad2(n), i;
    setText(byId('homeSub'), fmtN(t('homeSub', 'Listen, write, and check {N} B1 words with your class.'), n));
    setText(byId('btnStart'), fmtN(t('startDictation', 'Start Dictation (Word #1 to #{N})'), n));
    setText(byId('homeWordsTitle'), fmtN(t('homeWordsTitle', 'Check & Study All {N} Session Words in Order #1–#{P}'), n, p));
    setLabel(byId('btnHomeWords'), fmtN(t('homeWordsBtn', ' Open the {N}-Word List (#1–#{P})'), n, p));
    setText(byId('homeJourney2'), fmtN(t('homeJourney2', 'Check your {N} words'), n));
    setText(byId('flashcardsSub'), fmtN(t('flashcardsSub', 'Flip through all {N} words'), n));
    setText(byId('dictTitle'), fmtN(t('dictTitle', '{N}-Word Session View · #01–#{P}'), n, p));
    var ds = byId('dictSearch');
    if (ds) ds.placeholder = fmtN(t('dictSearchPh', 'Search {N} words (English, Sinhala, IPA)...'), n);
    var fa = doc.querySelector ? doc.querySelector('.pill[data-filter="all"]') : null;
    if (fa) setText(fa, fmtN(t('filterAll', 'All {N}'), n));
    setText(byId('pillsDrawerToggle'), fmtN(t('pillsDrawer', 'Jump to Word 1–{N} ▾'), n));
    setText(byId('boardJumperToggle'), fmtN(t('pillsDrawer', 'Jump to Word 1–{N} ▾'), n));
    setText(byId('resumeMeta'), fmtN(t('resumeMetaIdle', 'Paused at Word #1 of {N}'), n));
    setLabel(byId('btnDownloadClips'), fmtN(t('downloadClips', ' Download All {N} Word Audio Clips for Offline Use'), n));
    var tabLabel = doc.querySelector ? doc.querySelector('#tab-dict [data-i18n="tabWords"]') : null;
    if (tabLabel) setText(tabLabel, (lang === 'si' ? 'වචන (' : 'Words (') + n + ')');
    var dcd = byId('btnDownloadClips');
    if (dcd) { /* keep aria in sync for screen readers */ dcd.setAttribute('aria-label', fmtN(t('downloadClips', ' Download All {N} Word Audio Clips for Offline Use'), n)); }
    return true;
  }
  function settings() {
    try { return SDP.Data.settings(); } catch (e) { return { mode: 'paper', lang: 'en', theme: 'light' }; }
  }
  function words() {
    try { return SDP.Sync && SDP.Sync.words ? SDP.Sync.words() : []; } catch (e) { return []; }
  }
  function stats() {
    try { return SDP.Data.stats(); } catch (e) { return { mastered: 0, accuracy: 0, streak: 0 }; }
  }

  /* ══ language / theme  ══ */
  function applyI18n() {
    var nodes = doc.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      if (!key) continue;
      var value = t(key);
      if (value === undefined) continue;
      /* v0.0.5.c (GAP 2): never wipe an SVG icon. A [data-i18n] node with a
         .i18n-label child updates only the label, so EN <-> SI keeps its icon. */
      var label = nodes[i].querySelector ? nodes[i].querySelector('.i18n-label') : null;
      if (label) { label.textContent = value; continue; }
      if (nodes[i].querySelector && nodes[i].querySelector('svg.sdp-icon')) continue;
      nodes[i].textContent = value;
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
    /* v0.0.7.b B7: the offline banner speaks the new language at once. */
    try { paintOfflineBanner(isOfflineNow()); } catch (eOB) {}
    if (doc && doc.documentElement) doc.documentElement.setAttribute('lang', lang === 'si' ? 'si' : 'en');
    if (doc && doc.body) doc.body.setAttribute('data-lang', lang);
    if (!quiet) { try { SDP.Data.saveSettings({ lang: lang }); } catch (e) {} }
    applyI18n();
    paintIconHosts();
    paintLangPills();
    var select = byId('setLang');
    if (select) select.value = lang;
    renderHome();
    renderWords();
    renderPractice();
    renderGuideSteps();
    paintRevealCard();
    renderSettings();
    if (SDP.Engine) {
      if (SDP.Engine.repaintState) { try { SDP.Engine.repaintState(); } catch (e) {} }
      if (SDP.Engine.renderResults && SDP.Engine.state && SDP.Engine.state() === 'finished') {
        try { SDP.Engine.renderResults(); } catch (e) {}
      }
    }
    if (SDP.Studio && SDP.Studio.onLangChange) { try { SDP.Studio.onLangChange(); } catch (e) {} }
    paintWordCounts();
    return lang;
  }
  function toggleLang() { return applyLang(lang === 'en' ? 'si' : 'en'); }

  var THEMES = ['dark', 'light', 'board'];
  function normalizeTheme(next) {
    var wanted = str(next).toLowerCase();
    return THEMES.indexOf(wanted) >= 0 ? wanted : 'light';
  }
  /* D-UI2: 'board' must survive normalizeTheme. */
  function applyTheme(next, quiet) {
    theme = normalizeTheme(next);
    if (doc && doc.documentElement) doc.documentElement.setAttribute('data-theme', theme);
    if (doc && doc.body) doc.body.setAttribute('data-theme', theme);
    var meta = doc.querySelector ? doc.querySelector('meta[name="theme-color"]') : null;
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F8FAFC' : (theme === 'board' ? '#000000' : '#0F1420'));
    /* v0.0.6.g (A1): the color-scheme meta follows the app's own toggle only. */
    var schemeMeta = doc.querySelector ? doc.querySelector('meta[name="color-scheme"]') : null;
    if (schemeMeta) schemeMeta.setAttribute('content', theme === 'light' ? 'only light' : 'dark');
    if (!quiet) { try { SDP.Data.saveSettings({ theme: theme, touchedKeys: touchedPatch('theme') }); } catch (e) {} }
    var select = byId('setTheme');
    if (select) select.value = theme;
    var icon = byId('themeIcon');
    if (icon) {
      icon.innerHTML = svgIcon(theme === 'light' ? 'sun' : (theme === 'board' ? 'target' : 'moon'), 20);
      icon.setAttribute('data-icon', theme === 'light' ? 'sun' : (theme === 'board' ? 'target' : 'moon'));
    }
    renderBoardBar();
    return theme;
  }
  /* ENG-05/R1: the ten classroom keys; personal keys are never marked touched. */
  var CLASS_SETTING_KEYS = [
    'mode', 'writeSecs', 'repeats', 'pauseSecs', 'autoAdvance',
    'pacingPreset', 'voiceLock', 'voiceSource', 'rate', 'theme'
  ];
  /* R7: remember that this student changed a setting by hand. */
  function touchedPatch(key) {
    var out = {};
    if (!key) return out;
    var current = {};
    try { current = settings().touchedKeys || {}; } catch (e) { current = {}; }
    for (var k in current) if (Object.prototype.hasOwnProperty.call(current, k)) out[k] = current[k];
    out[key] = true;
    return out;
  }
  /* ENG-05: ONE writer for classroom keys. */
  function saveTouched(patch, label) {
    var withTouch = {}, k, i;
    var keys = [];
    for (k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      withTouch[k] = patch[k];
      if (CLASS_SETTING_KEYS.indexOf(k) >= 0) keys.push(k);
    }
    if (keys.length) {
      var merged = {};
      var current = {};
      try { current = settings().touchedKeys || {}; } catch (e) { current = {}; }
      for (k in current) if (Object.prototype.hasOwnProperty.call(current, k)) merged[k] = current[k];
      for (i = 0; i < keys.length; i++) merged[keys[i]] = true;
      withTouch.touchedKeys = merged;
    }
    try { SDP.Data.saveSettings(withTouch); } catch (e) {}
    var node = byId('settingsFeedback');
    if (node) node.textContent = str(label) || '';
    if (label) showToast(str(label));
    return withTouch;
  }
  function toggleTheme() {
    var next = theme === 'light' ? 'dark' : 'light';
    return applyTheme(next);
  }

  /* ══ router  ══ */
  
  var TABS = ['home', 'player', 'practice', 'dict', 'settings', 'studio'];
  /* R6/D10: leaving the cockpit pauses the live beat; Settings is a modal surface. */
  function pauseForNavigation(target) {
    var engine = SDP.Engine;
    if (!engine || !engine.isActive || !engine.isActive()) return false;
    var reason = target === 'settings' ? 'modal' : 'navigation';
    try { if (engine.pause) engine.pause(reason); } catch (e) {}
    try { if (SDP.Speech && SDP.Speech.stop) SDP.Speech.stop(); } catch (e) {}
    return true;
  }
  var guardPendingTab = null;
  function closeGuardModal() {
    var host = byId('studioGuardModal');
    if (host) { host.hidden = true; host.setAttribute('aria-hidden', 'true'); }
    return true;
  }
  function studioGuardModal(target) {
    guardPendingTab = target;
    var host = byId('studioGuardModal');
    if (!host) {
      host = doc.createElement('div');
      host.id = 'studioGuardModal';
      host.className = 'modal';
      host.setAttribute('role', 'dialog');
      host.setAttribute('aria-modal', 'true');
      host.setAttribute('aria-labelledby', 'guardTitle');
      host.hidden = true;
      host.setAttribute('aria-hidden', 'true');
      host.innerHTML = '<div class="modal-card"><h2 class="card-title" id="guardTitle"></h2>' +
        '<p class="muted" id="guardBody"></p><div class="modal-foot">' +
        '<button type="button" class="btn btn-primary" id="btnGuardPublish"></button>' +
        '<button type="button" class="btn" id="btnGuardLock"></button>' +
        '<button type="button" class="btn btn-ghost" id="btnGuardStay"></button></div></div>';
      if (doc.body) doc.body.appendChild(host);
      var pub = byId('btnGuardPublish'), lk = byId('btnGuardLock'), stay = byId('btnGuardStay');
      if (pub) pub.addEventListener('click', function () {
        closeGuardModal();
        var done = function () { try { SDP.Studio.lock(); } catch (e) {} showTab(guardPendingTab || 'home'); };
        try {
          if (SDP.Studio && SDP.Studio.publishWordsAndVoice) { SDP.Studio.publishWordsAndVoice(done); return; }
        } catch (e) {}
        done();
      }, false);
      if (lk) lk.addEventListener('click', function () {
        closeGuardModal();
        try { SDP.Studio.lock(); } catch (e) {}
        showTab(guardPendingTab || 'home');
      }, false);
      if (stay) stay.addEventListener('click', function () { closeGuardModal(); }, false);
    }
    setText(byId('guardTitle'), t('guardTitle'));
    setText(byId('guardBody'), t('guardBody'));
    setText(byId('btnGuardPublish'), t('guardPublish'));
    setText(byId('btnGuardLock'), t('guardLock'));
    setText(byId('btnGuardStay'), t('guardStay'));
    host.hidden = false;
    host.setAttribute('aria-hidden', 'false');
    return true;
  }
  function showTab(name) {
    var target = TABS.indexOf(name) >= 0 ? name : 'home';
    var i;
    if (target !== 'studio') {
      var studioUnlocked = false;
      try { studioUnlocked = !!(SDP.Studio && SDP.Studio.isUnlocked && SDP.Studio.isUnlocked()); } catch (e) { studioUnlocked = false; }
      if (studioUnlocked) {
        var dirtyEdits = false;
        try { dirtyEdits = !!(SDP.Studio && SDP.Studio.hasUnpublishedEdits && SDP.Studio.hasUnpublishedEdits()); } catch (e) { dirtyEdits = false; }
        if (dirtyEdits) { studioGuardModal(target); return currentTab(); }
        try { SDP.Studio.lock(); } catch (e) {}
      }
    }
    /* v0.0.6.f (R5): the Lecturer tab can never open its PIN pad offline. */
    if (target === 'studio') { try { paintStudioOffline(isOfflineNow()); } catch (e) {} }
    if (target !== 'player' && target !== 'dict' && target !== 'dictation') pauseForNavigation(target);
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
    var tabIds = ['tab-home', 'tab-player', 'tab-practice', 'tab-dict', 'tab-settings', 'tab-studio'];
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
    /* D6: the router owns mounting the studio screen (gate or 3 cards). */
    if (target === 'studio') {
      try { if (SDP.Studio && SDP.Studio.mount) SDP.Studio.mount(); } catch (e) {}
      try { if (SDP.Studio && SDP.Studio.paintQuickButton) SDP.Studio.paintQuickButton(); } catch (e2) {}
    }
    if (target === 'player') {
      /* v0.0.7.a Z4: a deep link or tab tap onto the player can never bypass
         the strict Dictation Mode lock — the overlay paints every time. */
      paintDictationLockOverlay();
      renderBoardJumper();
    }
    renderBoardBar();
    if (target === 'player' && SDP.Engine && SDP.Engine.refreshEls) SDP.Engine.refreshEls();
    /* v0.0.7.c (BUG-05): every tab switch lands at the top of the screen —
       a heading can never sit clipped underneath the sticky app header. */
    try { if (global.scrollTo) global.scrollTo(0, 0); } catch (eSc) {}
    return target;
  }
  function currentTab() {
    for (var i = 0; i < TABS.length; i++) {
      var screen = byId('screen-' + TABS[i]);
      if (screen && screen.classList && screen.classList.contains('active')) return TABS[i];
    }
    return 'home';
  }

  /* ══ v0.0.7.a Z4 — the strict Dictation Mode lock overlay ══
     Painted whenever Engine.studioLocked() is true (or the explicit value
     arrives from setStudioLocked). Bilingual lock card; both buttons resolve:
     ↩ Return to Lecturer Studio opens the studio tab; 🔒 Lock Studio &
     Unlock Dictation clears the lock and starts the beat immediately. The
     overlay repaints on every showTab('player') so a deep link (?tab=player)
     can never bypass the engine gate, and it lifts the instant the Studio
     reports ST.unlocked === false (studioLocked() itself releases). */
  function paintDictationLockOverlay(force) {
    var host = byId('dictationStudioLockOverlay');
    if (!host) return false;
    var locked = (force === true || force === false) ? !!force : (function () { try { return !!(SDP.Engine && SDP.Engine.studioLocked && SDP.Engine.studioLocked()); } catch (e) { return false; } })();
    host.hidden = !locked;
    try { host.setAttribute('aria-hidden', locked ? 'false' : 'true'); } catch (eA) {}
    if (locked) {
      var strip = byId('sessionProgressStrip');
      if (strip) strip.setAttribute('data-lockdim', 'true');
    } else {
      var strip2 = byId('sessionProgressStrip');
      if (strip2) strip2.removeAttribute('data-lockdim');
    }
    return locked;
  }
  function bindDictationLockOverlay() {
    var back = byId('btnLockOverlayReturnStudio');
    if (back) {
      back.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        try { showTab('studio'); } catch (eS) {}
        return false;
      };
    }
    var unlock = byId('btnLockOverlayUnlockDictation');
    if (unlock) {
      unlock.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        try {
          if (SDP.Engine && SDP.Engine.setStudioLocked) SDP.Engine.setStudioLocked(false);
        } catch (eU) {}
        paintDictationLockOverlay(false);
        try { if (SDP.Engine && SDP.Engine.togglePlayPause) SDP.Engine.togglePlayPause(); } catch (eT) {}
        return false;
      };
    }
    return true;
  }

  /* ══ Home  ══ */
  function renderHome() {
    var s = stats();
    var bank = words().length;
    var total = bank || liveTotal();
    /* v0.0.7.c (BUG-01 #3): an empty bank before boot settles is a LOADING
       state, never a false 'no word list' — bankEmpty only tells the truth
       after the boot attempt finished (onDataReady set dataSettled). */
    var empty = byId('bankEmpty');
    if (empty) empty.hidden = bank > 0 || !dataSettled();
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
    paintCredits();
    paintReadiness(bank);
    /* D13/D15: giant resume card — word, repeat, seconds, resume or restart. */
    var banner = byId('resumeBanner');
    var draft = null;
    try { draft = SDP.Data.session(); } catch (e) {}
    var enginePaused = false;
    try { enginePaused = !!(SDP.Engine && SDP.Engine.isPaused && SDP.Engine.isPaused()); } catch (e) { enginePaused = false; }
    var draftPaused = !!(draft && str(draft.status) === 'paused');
    var hasAnswers = !!(draft && draft.answers && Object.keys(draft.answers).length > 0);
    var resumable = !!(draft && typeof draft.index === 'number' && (draftPaused || hasAnswers)) || enginePaused;
    var cfg = {};
    try { cfg = SDP.Engine && SDP.Engine.config ? (SDP.Engine.config() || {}) : {}; } catch (e) { cfg = {}; }
    var draftIndex = enginePaused ? Number(cfg.index || 0) : (draft && typeof draft.index === 'number' ? draft.index : 0);
    var bankCount = bank || liveTotal();
    var repeatsTotal = Math.max(1, Number(cfg.repeats || (draft && draft.repeats) || (settings().repeats) || 2));
    var repeatsDone = Math.max(0, Number(enginePaused ? cfg.repeatsDone : (draft && draft.repeatsDone) || 0));
    var repeatsShown = Math.min(repeatsTotal, repeatsDone + 1);
    var remainingMs = Math.max(0, Number(enginePaused ? cfg.remainingMs : (draft && draft.remainingMs) || 0));
    var secondsLeft = (Math.ceil(remainingMs / 100) / 10).toFixed(1);
    if (banner) {
      banner.hidden = !resumable;
      if (resumable) {
        banner.setAttribute('data-state', (enginePaused || draftPaused) ? 'paused' : 'draft');
        setText(byId('resumeText'), t('resumeMetaLine') + (draftIndex + 1) + fmtN(t('ofWord'), liveTotal()) +
          repeatsShown + ' of ' + repeatsTotal + ' · ' + secondsLeft + t('secondsLeft'));
        setText(byId('resumeMeta'), resumable ? t('resumePaused') : t('resumeMetaIdle'));
      }
    }
    var resumeBtn = byId('btnResume');
    if (resumeBtn) setText(resumeBtn, t('resumeSession'));
    if (resumeBtn) resumeBtn.hidden = !!(enginePaused || draftPaused);
    var resumeDraftBtn = byId('btnResumeDraft');
    if (resumeDraftBtn) {
      resumeDraftBtn.hidden = !(enginePaused || draftPaused);
      setText(resumeDraftBtn, t('btnResumeWord') + (draftIndex + 1));
    }
    var startOverBtn = byId('btnStartOver');
    if (startOverBtn) setText(startOverBtn, t('startOver'));
    paintHomeWordsPreview();
    paintPresetBadge();
    paintCues();
    var ann = byId('homeAnn');
    var announcement = null;
    try { announcement = SDP.Sync && SDP.Sync.announcement ? SDP.Sync.announcement() : null; } catch (e) {}
    var annText = isObj(announcement) ? str(announcement.text || announcement.title) : str(announcement);
    if (ann) ann.hidden = !annText;
    setText(byId('homeAnnText'), annText);
    paintModePills();
    paintWordCounts();
  }
  /* D15: Home Step-2 previews #01..#03 in strict class order. */
  function paintHomeWordsPreview() {
    var host = byId('homeWordsPreview');
    if (!host) return false;
    var list = words();
    var html = '', i, n = Math.min(3, list.length);
    for (i = 0; i < n; i++) {
      var w = list[i] || {};
      html += '<div class="hp-row"><span class="hp-num">#' + pad2(i + 1) + '</span>' +
        '<span class="hp-w">' + esc(w.w) + '</span>' +
        '<span class="hp-si word-si">' + esc(w.si) + '</span></div>';
    }
    host.innerHTML = html;
    return true;
  }

  /* D9: the amber STEP cue retires per screen via sdp.settings.cuesSeen. */
  function cuesSeen() {
    var conf = settings();
    return isObj(conf.cuesSeen) ? conf.cuesSeen : {};
  }
  function paintCues() {
    if (!doc || !doc.querySelectorAll) return false;
    var seen = cuesSeen();
    var nodes = doc.querySelectorAll('.cue[data-cue]');
    for (var i = 0; i < nodes.length; i++) {
      var screen = str(nodes[i].getAttribute('data-cue'));
      nodes[i].hidden = seen[screen] === true;
    }
    return true;
  }
  function markCueSeen(screen) {
    var key = str(screen) || 'home';
    var seen = cuesSeen();
    if (seen[key] === true) return false;
    seen[key] = true;
    try { SDP.Data.saveSettings({ cuesSeen: seen }); } catch (e) {}
    paintCues();
    return true;
  }

  /* R1: all three credit lines stay verbatim, but only the active language is… */
  function paintCredits() {
    if (!doc || !doc.querySelectorAll) return false;
    var enText = lang === 'si' ? '' : STRINGS_EN.creditsLine;
    var siText = lang === 'si' ? STRINGS_SI.creditsLine : '';
    var enNodes = doc.querySelectorAll('.credit-line:not(.credit-line-si)');
    var siNodes = doc.querySelectorAll('.credit-line-si');
    var i;
    for (i = 0; i < enNodes.length; i++) setText(enNodes[i], enText);
    for (i = 0; i < siNodes.length; i++) setText(siNodes[i], siText);
    return true;
  }

  /* P5 + v0.0.7.c (BUG-01 #3): the readiness badge. Before the boot settles
     it is an honest LOADING state — never a false 'Session 8 ready · 0 words'
     flash; afterwards it paints the live session number and word count. */
  function paintReadiness(bank) {
    var badge = byId('homeReadyBadge');
    if (!badge) return false;
    var count = Number(bank);
    if (isNaN(count)) count = boardWordCount();
    if (!dataSettled() && count <= 0) {
      badge.textContent = t('homeReadyLoading', 'Loading the class word list…');
      badge.setAttribute('data-ready', 'loading');
      return true;
    }
    var sessionNo = '';
    try { sessionNo = str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : ''); } catch (e) { sessionNo = ''; }
    var label = fmtN(t('homeReadyBadge', 'Session {S} ready · {N} words').replace('{S}', sessionNo || '—'), count);
    badge.textContent = label;
    badge.setAttribute('data-ready', count > 0 ? 'true' : 'false');
    return true;
  }
  /* D17: show the published preset on Home (Fast Exam · 5s · 2× · British). */
  function presetLabel(conf) {
    var s = isObj(conf) ? conf : settings();
    var preset = str(s.pacingPreset || 'exam');
    var secs = Number(s.writeSecs || s.intervalSec) || 5;
    var repeats = Math.min(5, Math.max(1, Number(s.repeats) || 2));
    var name = preset === 'beginner' ? 'Beginner Slow'
      : (preset === 'board' ? 'Smart Board Class' : (preset === 'standard' ? 'CCBE B1 Standard' : 'Fast Exam'));
    return name + ' · ' + secs + 's · ' + repeats + '× · British English';
  }
  function paintPresetBadge() {
    var badge = byId('homePresetBadge');
    if (!badge) return false;
    badge.textContent = presetLabel(settings());
    badge.setAttribute('data-preset', str(settings().pacingPreset || 'exam'));
    return true;
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

  /* VOX-07: the first Start of a session speaks a condensed two-step English… */
  var sessionState = { introShown: false };
  function startDictation(mode) {
    /* v0.0.7.a Z4 — #btnStart can never start a session while the strict
       Dictation Mode lock is armed; the bilingual overlay paints instead. */
    if ((function () { try { return !!(SDP.Engine && SDP.Engine.studioLocked && SDP.Engine.studioLocked()); } catch (e) { return false; } })()) {
      paintDictationLockOverlay(true);
      showTab('player');
      return false;
    }
    var chosen = mode || settings().mode;
    var conf = settings();
    if (!sessionState.introShown && conf.guideAutoPlay === true && words().length) {
      sessionState.introShown = true;
      if (openGuideQuick(chosen)) return true;
    }
    return beginDictation(chosen);
  }
  function beginDictation(mode) {
    var chosen = mode || settings().mode;
    if (!words().length) {
      /* Never open an empty cockpit: retry boot, then say what to do. */
      try { SDP.Sync.boot({}, function () { startDictation(chosen); }); } catch (e) {}
      showToast(t('emptyBank'));
      showTab('home');
      renderHome();
      return false;
    }
    try { SDP.Data.saveSettings({ mode: chosen }); } catch (e) {}
    /* v0.0.6.m FIX 3: entering a dictation session first releases any mic /
       audio-session lock left by a voice review. */
    releaseFeedbackAudioLocks('dictation_start');
    try { SDP.Engine.start({ mode: chosen }); } catch (e) {}
    showTab('player');
    return true;
  }
  function resumeDictation() {
    var draft = null;
    try { draft = SDP.Data.session(); } catch (e) {}
    /* v0.0.6.m FIX 3: resuming a session first releases any mic / audio lock. */
    releaseFeedbackAudioLocks('dictation_resume');
    /* D11: Engine.resume() restores the exact beat (countdown for 'writing',… */
    var resumed = false;
    try { resumed = !!(SDP.Engine && SDP.Engine.resume && SDP.Engine.resume()); } catch (e) { resumed = false; }
    if (!resumed) {
      if (!draft) { startDictation(); return; }
      try {
        SDP.Engine.start({ mode: draft.mode || settings().mode, startIndex: draft.index || 0, answers: draft.answers || {} });
      } catch (e) {}
    }
    showTab('player');
    if (!resumed && SDP.Engine && SDP.Engine.isPaused && SDP.Engine.isPaused()) {
      try { SDP.Engine.resume(); } catch (e) {}
    }
  }

  var GUIDE_SPOTLIGHT_STEPS = [
    'Press Start Dictation to begin.',
    'Listen twice, then write in five seconds.',
    'Check all thirty words in order.',
    'Practise the words you missed.'
  ];
  var guideState = { activeStep: 0, narrating: false, opener: null, autoplayTimer: null, quickMode: false, pendingMode: null, guideRunId: 0 };
  function guideIndex(n) {
    var i = Number(n);
    if (!(i >= 0)) i = 0;
    if (i > 3) i = 3;
    return i;
  }
  function guideSentence(idx) { return GUIDE_SPOTLIGHT_STEPS[guideIndex(idx)]; }
  /* The hidden <ol> keeps the four steps machine-readable (and translated) for
     the language pill and for assistive tech; the spotlight is what is seen. */
  function renderGuideSteps() {
    var host = byId('guideSteps');
    if (!host) return 0;
    var html = '', i;
    for (i = 1; i <= 4; i++) {
      html += '<li class="guide-step" data-step="' + (i - 1) + '">' + esc(t('guideSpotlight' + i)) + '</li>';
    }
    host.innerHTML = html;
    paintGuideSpotlight(guideState.activeStep);
    return 4;
  }
  function paintGuideSpotlight(idx) {
    var at = guideIndex(idx);
    guideState.activeStep = at;
    setText(byId('guideStepTag'), t('guideStepTagPrefix', 'Step') + ' ' + (at + 1) + ' ' + t('guideStepTagSuffix', 'of 4'));
    setText(byId('guideStepText'), t('guideSpotlight' + (at + 1), GUIDE_SPOTLIGHT_STEPS[at]));
    var dots = byId('guideDots');
    if (dots && dots.querySelectorAll) {
      var all = dots.querySelectorAll('.guide-dot');
      for (var d = 0; d < all.length; d++) {
        var on = d === at;
        if (all[d].classList) {
          if (on) all[d].classList.add('is-active'); else all[d].classList.remove('is-active');
        }
        if (on) all[d].setAttribute('aria-current', 'step');
        else all[d].removeAttribute('aria-current');
      }
    }
    var host = byId('guideSteps');
    if (host && host.querySelectorAll) {
      var steps = host.querySelectorAll('.guide-step');
      for (var j = 0; j < steps.length; j++) {
        var live = j === at;
        if (steps[j].classList) {
          if (live) { steps[j].classList.add('guide-active'); steps[j].classList.add('active-step'); }
          else { steps[j].classList.remove('guide-active'); steps[j].classList.remove('active-step'); }
        }
      }
    }
    return at;
  }

  /* ── D-G2: the "tap to start" autoplay-unlock banner ──────────────────── */
  function showGuideTapBanner() {
    var banner = byId('guideTapBanner');
    if (!banner) return false;
    if (banner.classList) banner.classList.remove('hidden');
    banner.hidden = false;
    return true;
  }
  function hideGuideTapBanner() {
    var banner = byId('guideTapBanner');
    if (!banner) return false;
    if (banner.classList) banner.classList.add('hidden');
    banner.hidden = true;
    return true;
  }
  function guideTapBannerVisible() {
    var banner = byId('guideTapBanner');
    if (!banner) return false;
    if (banner.hidden) return false;
    return !(banner.classList && banner.classList.contains('hidden'));
  }
  /* D16/R9: 900 ms in, a cold-boot browser may still be un-gestured. */
  function showGuideAutoplayBanner() {
    var banner = byId('guideAutoplayBanner');
    if (!banner) return false;
    if (banner.classList) banner.classList.remove('hidden');
    banner.hidden = false;
    banner.textContent = t('guideAutoplayBanner', ' Tap Anywhere to Start Voice Guide');
    return true;
  }
  function hideGuideAutoplayBanner() {
    var banner = byId('guideAutoplayBanner');
    if (!banner) return false;
    if (banner.classList) banner.classList.add('hidden');
    banner.hidden = true;
    return true;
  }
  function guideAutoplayBannerVisible() {
    var banner = byId('guideAutoplayBanner');
    if (!banner) return false;
    if (banner.hidden) return false;
    return !(banner.classList && banner.classList.contains('hidden'));
  }
  function clearGuideAutoplayWatch() {
    if (guideState.autoplayTimer) {
      try { global.clearTimeout(guideState.autoplayTimer); } catch (e) {}
      guideState.autoplayTimer = null;
    }
    return true;
  }
  function armGuideAutoplayWatch() {
    clearGuideAutoplayWatch();
    guideState.autoplayTimer = global.setTimeout(function () {
      guideState.autoplayTimer = null;
      var modal = byId('guideModal');
      if (!modal || modal.hidden) return;
      var started = false;
      try {
        started = !!(SDP.Speech && SDP.Speech.hasStarted && SDP.Speech.hasStarted()) ||
          !!(SDP.Speech && SDP.Speech.isAudioPlaying && SDP.Speech.isAudioPlaying());
      } catch (e) { started = false; }
      if (!started) showGuideAutoplayBanner();
    }, 900);
    return true;
  }
  /* R2: one run id per narration. Every callback re-checks it, so a tap or a
     skip can never be overtaken by an older chain (the F2 loop). */
  function startGuideNarration(fromStep, lastStep) {
    guideState.narrating = true;
    guideState.guideRunId += 1;
    var runId = guideState.guideRunId;
    var start = guideIndex(fromStep);
    var last = lastStep === undefined ? 3 : guideIndex(lastStep);
    renderGuideSteps();
    function speakStep(idx) {
      if (runId !== guideState.guideRunId) return false;
      var modal = byId('guideModal');
      if (!modal || modal.hidden) { guideState.narrating = false; return false; }
      if (idx > last) {
        guideState.narrating = false;
        /* VOX-07: the quick walkthrough starts the dictation by itself. */
        if (guideState.quickMode) finishQuickGuide(true);
        return true;
      }
      paintGuideSpotlight(idx);
      hideGuideTapBanner();
      var sentence = guideSentence(idx);
      try {
        SDP.Speech.playGuideStep(idx, sentence, { lang: 'en-GB', rate: 0.94, pitch: 1.03 }, function () {
          if (runId !== guideState.guideRunId || !guideState.narrating) return;
          speakStep(idx + 1);
        });
      } catch (e) {
        /* D-G1: never swallow a narration failure. */
        guideState.narrating = false;
        try { console.error('[SDP] guide narration failed:', e); } catch (e2) {}
        showToast(t('guideVoiceFailed'));
        showGuideTapBanner();
      }
      return true;
    }
    speakStep(start);
    return true;
  }
  function stopGuideNarration() {
    guideState.guideRunId += 1;
    try { if (SDP.Speech) SDP.Speech.stop(); } catch (e) {}
    guideState.narrating = false;
    return true;
  }
  /* R2 (F2): the banner tap primes audio and resumes the CURRENT step — it is
     not a modal-wide gesture loop that restarts from Step 1 on every tap. */
  function onGuideBannerTap(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (ev && ev.preventDefault) ev.preventDefault();
    hideGuideTapBanner();
    hideGuideAutoplayBanner();
    clearGuideAutoplayWatch();
    closeGuideSpot();
    try { if (SDP.Speech && SDP.Speech.unlockAudio) SDP.Speech.unlockAudio(); } catch (e) {}
    if (!guideState.narrating) startGuideNarration(guideState.activeStep);
    return true;
  }
  function openGuide(opener, opts) {
    opts = opts || {};
    var modal = byId('guideModal');
    if (!modal) return false;
    guideState.guideRunId += 1;
    /* R6 / D10: opening the guide is a modal event — pause the beat first. */
    pauseForNavigation('settings');
    if (!opts.quick) restoreGuideTitle();
    guideState.opener = opener && typeof opener.focus === 'function' ? opener : null;
    guideState.activeStep = 0;
    renderGuideSteps();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    if (modal.classList) modal.classList.add('is-open');
    var conf = settings();
    hideGuideTapBanner();
    hideGuideAutoplayBanner();
    /* v0.0.5.c Path A: a cold boot paints the guide silently.
       v0.0.6.q Pillar 3: the BRIEFING HANDOVER (fromHandover) narrates
       Step 1 → Step 4 with the committed guide.en.0..3 clips immediately —
       the user's ▶ Start Dictation → click already unlocked audio, so the
       guide speaks from the very first step with no banner, no tap. */
    if (opts.fromHandover) startGuideNarration(0);
    else if (!opts.fromBoot && conf.guideAutoPlay !== false && !opts.quick) startGuideNarration(0);
    armGuideAutoplayWatch();
    var banner = byId('guideTapBanner');
    if (banner && !banner._sdpBound) {
      banner._sdpBound = true;
      banner.addEventListener('click', onGuideBannerTap, false);
      banner.addEventListener('keydown', function (ev) {
        if (ev && (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar')) onGuideBannerTap(ev);
      }, false);
    }
    var auto = byId('guideAutoplayBanner');
    if (auto && !auto._sdpBound) {
      auto._sdpBound = true;
      auto.addEventListener('click', onGuideBannerTap, false);
    }
    var spotClose = byId('btnGuideSpotClose');
    if (spotClose && !spotClose._sdpBound) {
      spotClose._sdpBound = true;
      spotClose.addEventListener('click', closeGuideSpot, false);
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
    closeGuideSpot();
    stopGuideNarration();
    clearGuideAutoplayWatch();
    hideGuideTapBanner();
    hideGuideAutoplayBanner();
    /* W7/D-G5: write the stamp — dismissing still counts as seen (G7.1d). */
    try { SDP.Data.markGuideSeen(); } catch (e) {}
    restoreGuideTitle();
    var opener = guideState.opener;
    if (opener && typeof opener.focus === 'function') { try { opener.focus({ preventScroll: true }); } catch (e) {} }
    guideState.opener = null;
    guideState.activeStep = 0;
    return true;
  }
  /* ── VOX-07: Quick Walkthrough Mode ───────────────────────────────────── */
  function quickSkipButton(show) {
    var btn = byId('btnGuideSkipStart');
    if (!btn) return false;
    btn.hidden = show === false;
    btn.setAttribute('aria-hidden', show === false ? 'true' : 'false');
    /* v0.0.6.q Pillar 3: the guide footer's RIGHT-side highlighted CTA —
       ▶ Click Start Dictation Now — exactly as the creator requested. */
    btn.textContent = t('guideSkipStartNow', '▶ Click Start Dictation Now');
    return true;
  }
  function restoreGuideTitle() {
    var title = byId('guideTitle');
    if (title) title.textContent = t('howToUse');
    guideState.quickMode = false;
    guideState.pendingMode = null;
    /* R2: the footer always carries exactly ▶ Start Dictation Now. */
    quickSkipButton(true);
    return true;
  }
  function openGuideQuick(mode) {
    var modal = byId('guideModal');
    if (!modal) return false;
    guideState.pendingMode = mode || settings().mode;
    guideState.quickMode = true;
    openGuide(null, { quick: true });
    var title = byId('guideTitle');
    if (title) title.textContent = t('guideQuickTitle');
    quickSkipButton(true);
    guideState.activeStep = 0;
    renderGuideSteps();
    if (settings().guideAutoPlay !== false) {
      stopGuideNarration();
      startGuideNarration(0, 1);
    }
    return true;
  }
  /* Called when the quick walkthrough ends or the student skips it. */
  function finishQuickGuide(startNow) {
    var mode = guideState.pendingMode || settings().mode;
    var wasQuick = !!guideState.quickMode;
    guideState.quickMode = false;
    guideState.pendingMode = null;
    closeGuide();
    if (wasQuick && startNow !== false) beginDictation(mode);
    return true;
  }
  /* R2: the retired "Listen to the steps (EN)" affordance now just reopens the
     spotlight and starts from Step 1. */
  function speakGuide() {
    var modal = byId('guideModal');
    if (modal && modal.hidden) {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      if (modal.classList) modal.classList.add('is-open');
    }
    try { if (SDP.Speech && SDP.Speech.unlockAudio) SDP.Speech.unlockAudio(); } catch (e) {}
    hideGuideTapBanner();
    closeGuideSpot();
    stopGuideNarration();
    startGuideNarration(0);
    armGuideAutoplayWatch();
    return 4;
  }
  /* E7: guide-spot spotlight — highlights the control the step describes. */
  function openGuideSpot(targetId, cueText) {
    var spot = byId('guideSpot');
    var cue = byId('guideSpotCue');
    if (!spot) return false;
    if (cue) cue.textContent = str(cueText || '');
    spot.hidden = false;
    spot.setAttribute('aria-hidden', 'false');
    return true;
  }
  function closeGuideSpot() {
    var spot = byId('guideSpot');
    if (spot) { spot.hidden = true; spot.setAttribute('aria-hidden', 'true'); }
    return true;
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

  /* ══ Words explorer  ══ */
  function wordFilter() {
    var active = doc.querySelector ? doc.querySelector('#dictFilterRow [aria-pressed="true"]') : null;
    return active ? str(active.getAttribute('data-filter')) : 'all';
  }
  /* v0.0.4.a W4: wrap the first case-insensitive match of the word inside its
     example sentence in a <b class="d-hit"> highlight. */
  function highlightWordInSentence(sentence, word) {
    var s = str(sentence), w = str(word);
    if (!s || !w) return esc(s);
    var at = s.toLowerCase().indexOf(w.toLowerCase());
    if (at < 0) return esc(s);
    return esc(s.slice(0, at)) + '<b class="d-hit">' + esc(s.slice(at, at + w.length)) + '</b>' + esc(s.slice(at + w.length));
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
      /* D14: #01..#30 rows + per-word self-check into sdp.progress. */
      var isMastered = !!progress.mastered[key];
      var isWeak = weak.indexOf(key) >= 0;
      var rowState = isMastered ? 'mastered' : (isWeak ? 'weak' : '');
      html += '<article class="dict-card" data-word="' + esc(w.w) + '" data-state="' + rowState + '">' +
        '<div class="d-body">' +
        '<div class="d-top"><span class="d-index">#' + pad2(i + 1) + '</span> <strong class="d-w">' + esc(w.w) + '</strong> <span class="d-pos">' + esc(w.pos) + '</span></div>' +
        '<div class="d-p">/' + esc(str(w.p).replace(/^\/+|\/+$/g, '')) + '/</div>' +
        /* v0.0.7.b B2: the UK pronunciation-variant hint badge. */
        (Array.isArray(w.pronunciationVariants) && w.pronunciationVariants.length > 1
          ? '<div class="d-pron-variants" role="note">🔊 ' + w.pronunciationVariants.length + ' ' + esc(t('pronVariantsBadge')) + ': ' + w.pronunciationVariants.slice(0, 3).map(esc).join(' · ') + '</div>' : '') +
        '<div class="d-m">' + esc(w.m) + '</div>' +
        '<div class="word-si">' + esc(w.si) + '</div>' +
        '<div class="d-s">' + highlightWordInSentence(str(w.s), str(w.w)) + '</div>' +
        '</div>' +
        '<div class="d-side">' +
        '<button type="button" class="btn btn-sm d-play" data-play="' + esc(w.w) + '" data-play-word="' + esc(w.w) + '" aria-label="' + esc(t('playAudio')) + ' ' + esc(w.w) + '">' + svgIcon('volume', 16) + ' <span class="i18n-label">' + esc(t('playAudio')) + '</span></button>' +
        '<button type="button" class="btn btn-sm d-mark-correct" data-mark-word="mastered" data-word-mark="' + esc(w.w) + '" aria-pressed="' + String(isMastered) + '">' + esc(t('markCorrectWord')) + '</button>' +
        '<button type="button" class="btn btn-sm d-mark-weak" data-mark-word="weak" data-word-mark="' + esc(w.w) + '" aria-pressed="' + String(isWeak) + '">' + esc(t('markWeakWord')) + '</button>' +
        '</div>' +
        '</article>';
    }
    var dictEmpty = byId('dictEmpty');
    if (dictEmpty) dictEmpty.hidden = list.length > 0 || !dataSettled();
    host.innerHTML = shown ? html : (list.length ? '<p class="dict-empty">' + esc(t('noWordsFound')) + '</p>' : '');
    paintWordCounts();
    return shown;
  }
  /* D14:  /  write sdp.progress.mastered / weakWords and repaint. */
  function markDictWord(wordName, state) {
    var key = str(wordName).toLowerCase();
    if (!key) return false;
    var progress = {};
    try { progress = SDP.Data.progress(); } catch (e) { return false; }
    if (!isObj(progress.mastered)) progress.mastered = {};
    var weak = Array.isArray(progress.weakWords) ? progress.weakWords.slice(0) : [];
    var at = weak.indexOf(key);
    if (state === 'mastered') {
      progress.mastered[key] = true;
      if (at >= 0) weak.splice(at, 1);
    } else if (state === 'weak') {
      delete progress.mastered[key];
      if (at < 0) weak.push(key);
    }
    progress.weakWords = weak;
    try { SDP.Data.saveProgress(progress); } catch (e) {}
    renderWords();
    renderHome();
    return true;
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
        var markNode = node;
        while (markNode && markNode !== list && !(markNode.getAttribute && markNode.getAttribute('data-mark-word'))) markNode = markNode.parentNode;
        if (markNode && markNode !== list && markNode.getAttribute) {
          markDictWord(markNode.getAttribute('data-word-mark'), markNode.getAttribute('data-mark-word'));
          return;
        }
        while (node && node !== list && !(node.getAttribute && (node.getAttribute('data-play') || node.getAttribute('data-play-word')))) node = node.parentNode;
        if (!node || node === list || !node.getAttribute) return;
        var word = null;
        try { word = SDP.Sync.wordByName(node.getAttribute('data-play') || node.getAttribute('data-play-word')); } catch (e) {}
        /* v0.0.6.t PILLAR 1: the ▶ Play tap on a 30 Words card is a manual
           play — it speaks even while the engine is pause-locked. */
        if (word && SDP.Speech && SDP.Speech.playWord) SDP.Speech.playWord(word, { allowWhenPaused: true, manualPlay: true }, noop);
      });
    }
  }

  /* ══ Practice  ══ */
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
      var prompt = practice.mode === 'quiz' ? '<div class="prac-word">' + esc(word.w) + '</div><div class="prac-mini">/' + esc(str(word.p).replace(/^\/+|\/+$/g, '')) + '/ · ' + esc(t('chooseMeaning')) + '</div>'
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
        : '<div class="prac-word">' + esc(word.w) + '</div><div class="prac-mini">/' + esc(str(word.p).replace(/^\/+|\/+$/g, '')) + '/ · ' + esc(word.pos) + '</div>';
      html += '<div class="prac-card" data-prac-act="flip" role="button" tabindex="0">' + face +
        '<div class="prac-mini">' + esc(t(practice.flipped ? 'tapFlipBack' : 'tapToFlip')) + '</div></div>' +
        '<div class="prac-actions">' +
        '<button type="button" class="btn btn-sm" data-prac-act="say">' + esc(t('listen')) + '</button>' +
        '<button type="button" class="btn btn-sm" data-prac-act="next">' + esc(t('nextCard')) + '</button>' +
        '</div>';
    }
    host.innerHTML = html;
    /* F3: speak a listen-mode card exactly once per card via the spoken flag. */
    if (practice.mode === 'listen' && !practice.answered && !practice.spoken) {
      practice.spoken = true;
      /* v0.0.6.t PILLAR 1: a listen-mode card on the Practice screen is a
         user-driven play — it must speak even while the engine is paused. */
      try { if (SDP.Speech && SDP.Speech.playWord) SDP.Speech.playWord(word, { allowWhenPaused: true, manualPlay: true }, noop); } catch (e) {}
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
        /* ENG-04: without this the first drill card stayed silent. */
        practice.index = 0; practice.answered = ''; practice.flipped = false; practice.spoken = false;
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
        /* v0.0.6.t PILLAR 1: the Listen tap on a Practice card is a manual
           play — never muted by the engine's pause-for-navigation lock. */
        if (act === 'say' && word) { if (SDP.Speech && SDP.Speech.playWord) SDP.Speech.playWord(word, { allowWhenPaused: true, manualPlay: true }, noop); return; }
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

  /* ══ Settings  ══ */
  function buildRepeatsOptions(select) {
    /* ONE shared builder for #setRepeats (never duplicated). */
    if (!select || select._sdpBuilt) return;
    select._sdpBuilt = true;
    var html = '';
    for (var n = 1; n <= 5; n++) html += '<option value="' + n + '">' + n + '×</option>';
    select.innerHTML = html;
  }
  /* One call for every surface — used after a classroom settings adoption. */
  /* D12/D18: skip Studio re-render while an action is in flight. */
  function studioIsBusy() {
    try { return !!(SDP.Studio && SDP.Studio.isBusy && SDP.Studio.isBusy()); } catch (e) { return false; }
  }
  function renderAll() {
    renderHome(); renderWords(); renderPractice();
    if (!studioIsBusy()) { renderSettings(); }
    renderGuideSteps(); renderBoardBar(); renderBoardJumper();
    paintPresetBadge();
    try { paintSyncBadge({ state: 'synced', session: str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8') }); } catch (e) {}
    return true;
  }
  /* R1: the lecturer-only sticky bar at the top of Settings section 1. */
  function paintLecturerBar() {
    var bar = byId('lecturerSyncBar');
    if (!bar) return false;
    var unlocked = false;
    try { unlocked = !!(SDP.Studio && SDP.Studio.isUnlocked && SDP.Studio.isUnlocked()); } catch (e) { unlocked = false; }
    bar.hidden = !unlocked;
    bar.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
    var dirty = false;
    try { dirty = !!(SDP.Studio && SDP.Studio.hasUnpublishedEdits && SDP.Studio.hasUnpublishedEdits()); } catch (e) { dirty = false; }
    /* v0.0.6.c (F1): the RED unsaved-changes action state. */
    if (bar.setAttribute) {
      if (dirty) bar.setAttribute('data-dirty', 'true');
      else bar.removeAttribute('data-dirty');
    }
    if (unlocked) {
      var btn = byId('btnSyncClassSettings');
      /* D2: never repaint a mid-action button label. The dirty label keeps
         the gate substring 'Broadcast Current Pacing & Settings'. */
      if (btn && btn.getAttribute('data-busy') !== '1') {
        /* F1: the label keeps the gate-verbatim pacing substring; the RED
           data-dirty action state is the unsaved-changes signal. */
        btn.textContent = t('lecturerSyncBar');
        if (dirty) btn.setAttribute('data-dirty', 'true');
        else btn.removeAttribute('data-dirty');
      }
      var hint = byId('lecturerSyncHint');
      if (hint) hint.textContent = t('studioAskLecturer');
    }
    /* D19: the idle label is separate from the live status stamp. */
    var last = byId('lecturerSyncLast');
    if (last && !last.getAttribute('data-state')) last.textContent = t('lecturerSyncIdle');
    return unlocked;
  }
  /* D7: Settings is student-only; one banner links into the studio. */
  function paintLecturerBanner() {
    var banner = byId('settingsLecturerBanner');
    if (!banner) return false;
    var unlocked = false;
    try { unlocked = !!(SDP.Studio && SDP.Studio.isUnlocked && SDP.Studio.isUnlocked()); } catch (e) { unlocked = false; }
    banner.hidden = !unlocked;
    setText(byId('settingsLecturerText'), t('settingsLecturerActive'));
    var btn = byId('btnOpenStudioFromSettings');
    if (btn) btn.textContent = t('openStudioBtn');
    return unlocked;
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
    paintLecturerBanner();
    var guideAuto = byId('setGuideAutoPlay');
    if (guideAuto) guideAuto.checked = conf.guideAutoPlay !== false;
    var pills = doc.querySelectorAll ? doc.querySelectorAll('#presetRow [data-preset]') : [];
    for (var pi = 0; pi < pills.length; pi++) {
      pills[pi].setAttribute('aria-pressed', String(pills[pi].getAttribute('data-preset') === str(conf.pacingPreset || 'standard')));
    }
    var resetChip = byId('presetReset');
    if (resetChip) resetChip.hidden = !!(Number(conf.writeSecs) !== 5 || Number(conf.repeats) !== 2 || Number(conf.pauseSecs) !== 1);
    paintModePills();
    paintLecturerBar();
    paintSyncBadge({ state: 'synced', session: str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8') });
    var storage = byId('storageStatus');
    if (storage) {
      var kb = 0;
      try {
        var payload = (global.localStorage ? str(global.localStorage.getItem('sdp.progress')).length : 0) +
          (global.localStorage ? str(global.localStorage.getItem('sdp.settings')).length : 0);
        kb = Math.round(payload / 1024);
      } catch (e) { kb = 0; }
      setText(storage, (SDP.Data.available ? '' : ' ') + kb + ' KB ' + t('storageLine'));
    }
  }
  function bindSettings() {
    function save(patch) { try { SDP.Data.saveSettings(patch); } catch (e) {} }
    /* P5/ENG-05: every manual change answers at once and is remembered as touched. */
    window.__sdpSaveTouched = saveTouched;
    function range(id, key, scale, format, label, personal) {
      var node = byId(id);
      if (!node || node._sdpBound) return;
      node._sdpBound = true;
      var commit = function () {
        var raw = Number(node.value);
        var value = scale ? raw / scale : raw;
        var patch = {};
        patch[key] = value;
        var line = label ? label + ' → ' + (format ? format.fn(value) : value) : '';
        /* Personal keys (volume) are saved but never marked as touched. */
        if (personal) save(patch); else saveTouched(patch, line);
        if (format) setText(byId(format.out), format.fn(value));
        if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
      };
      /* 'change' is the moment a range settles: toast once, never per pixel. */
      node.addEventListener('input', function () {
        var raw = Number(node.value);
        var value = scale ? raw / scale : raw;
        var patch = {};
        patch[key] = value;
        save(patch);
        if (format) setText(byId(format.out), format.fn(value));
        if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
      });
      node.addEventListener('change', commit);
    }
    range('setWriteSecs', 'writeSecs', 1, { out: 'outWriteSecs', fn: function (v) { return v + 's'; } }, t('writeTime'));
    range('setPause', 'pauseSecs', 1, { out: 'outPause', fn: function (v) { return v + 's'; } }, t('pauseBetween'));
    range('setRate', 'rate', 1, { out: 'outRate', fn: function (v) { return v + 'x'; } }, t('rate'));
    range('setVolume', 'volume', 100, { out: 'outVolume', fn: function (v) { return Math.round(v * 100) + '%'; } }, t('volume'), true);
    function wireStepper(inputId, minusId, plusId, min, max, step) {
      var node = byId(inputId), minus = byId(minusId), plus = byId(plusId);
      if (!node || !minus || !plus || node._sdpStepper) return;
      node._sdpStepper = true;
      function fire(type) {
        try {
          var ev = (typeof global.Event === 'function') ? new global.Event(type) : null;
          if (ev) node.dispatchEvent(ev);
        } catch (e) {}
      }
      function bump(dir) {
        var raw = Number(node.value) + dir * step;
        raw = Math.round(raw * 1000) / 1000;
        if (raw < min) raw = min;
        if (raw > max) raw = max;
        node.value = String(raw);
        fire('input');
        fire('change');
      }
      minus.addEventListener('click', function () { bump(-1); });
      plus.addEventListener('click', function () { bump(1); });
    }
    wireStepper('setWriteSecs', 'stepWriteMinus', 'stepWritePlus', 3, 20, 1);
    wireStepper('setPause', 'stepPauseMinus', 'stepPausePlus', 0.5, 3, 0.5);
    wireStepper('setRate', 'stepRateMinus', 'stepRatePlus', 0.7, 1.2, 0.05);
    wireStepper('setVolume', 'stepVolMinus', 'stepVolPlus', 0, 100, 5);
    var resetChipBtn = byId('presetReset');
    if (resetChipBtn && !resetChipBtn._sdpBound) {
      resetChipBtn._sdpBound = true;
      resetChipBtn.addEventListener('click', function () { applyPreset('exam'); });
    }
    var repeats = byId('setRepeats');
    if (repeats && !repeats._sdpBound2) {
      repeats._sdpBound2 = true;
      repeats.addEventListener('change', function () {
        saveTouched({ repeats: Number(repeats.value) }, t('repeats') + ' → ' + repeats.value);
        if (SDP.Engine) SDP.Engine.applySettings();
      });
    }
    var auto = byId('setAutoAdvance');
    if (auto && !auto._sdpBound) {
      auto._sdpBound = true;
      auto.addEventListener('change', function () {
        saveTouched({ autoAdvance: !!auto.checked }, t('autoAdvance') + ' → ' + (auto.checked ? 'on' : 'off'));
        if (SDP.Engine) SDP.Engine.applySettings();
      });
    }
    var source = byId('setVoiceSource');
    if (source && !source._sdpBound) {
      source._sdpBound = true;
      source.addEventListener('change', function () {
        saveTouched({ voiceSource: source.value }, t('voiceSource') + ' → ' + source.value);
      });
    }
    var voiceLock = byId('setVoiceLock');
    if (voiceLock && !voiceLock._sdpBound) {
      voiceLock._sdpBound = true;
      voiceLock.addEventListener('change', function () {
        var val = voiceLock.value;
        var patch = { voiceLock: val };
        if (val === 'unified') patch.voiceSource = 'auto';
        else if (str(source ? source.value : '') === 'auto') patch.voiceSource = 'custom';
        saveTouched(patch, t('voiceLockLabel') + ' → ' + val);
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
      themeSel.addEventListener('change', function () {
        var next = applyTheme(themeSel.value, true);
        saveTouched({ theme: next }, t('theme') + ' → ' + next);
      });
    }
    [['setModePaper', 'paper'], ['setModeTyping', 'typing']].forEach(function (pair) {
      var node = byId(pair[0]);
      if (!node || node._sdpBound) return;
      node._sdpBound = true;
      node.addEventListener('click', function () {
        saveTouched({ mode: pair[1] }, t('modeLabel') + ' → ' + pair[1]);
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
    /* R1 / SYNC-03: the lecturer's one button that moves the class. */
    var syncBtn = byId('btnSyncClassSettings');
    if (syncBtn && !syncBtn._sdpBound) {
      syncBtn._sdpBound = true;
      syncBtn.addEventListener('click', function () {
        if (!SDP.Studio || !SDP.Studio.saveClassSettings) return;
        /* D2: no double-click can ever start two publishes. */
        if (syncBtn.getAttribute('data-busy') === '1') return;
        var work = function (finish) {
          var result = SDP.Studio.saveClassSettings(function (err) {
            if (err) {
              setUpdateStatus(err.message === 'no_token' ? t('lecturerSyncNoToken') : t('studioPublishFail'), 'bad');
              showToast(err.message === 'no_token' ? t('lecturerSyncNoToken') : t('studioPublishFail'));
            } else {
              /* D19: Studio stamped the exact Rev # on #lecturerSyncLast. */
              setUpdateStatus(t('lecturerSyncLast') + ' · ' + t('studioPublishOk'), 'ok');
            }
            finish();
          });
          if (result && result.ok === false && result.reason === 'no_token') {
            showToast(t('lecturerSyncNoToken'));
          }
        };
        if (SDP.Studio.withBusy) SDP.Studio.withBusy(syncBtn, work);
        else {
          syncBtn.setAttribute('data-busy', '1');
          syncBtn.disabled = true;
          work(function () { syncBtn.removeAttribute('data-busy'); syncBtn.disabled = false; });
        }
      });
    }
  }
  function setUpdateStatus(text, state) {
    var node = byId('settingsUpdateStatus') || byId('updateStatus');
    if (!node) return;
    node.textContent = str(text);
    if (state) node.setAttribute('data-state', state); else node.removeAttribute('data-state');
  }
  /* ══ Sync badge ══ */
  function paintSyncBadge(state) {
    state = state || {};
    var session = str(state.session || '8');
    var badge = byId('syncBadge');
    /* D-UI10: the badge owns #settingsSyncStatus only. */
    var status = byId('settingsSyncStatus');
    var label;
    if (state.state === 'synced') {
      /* ENG-06: no version or session literal lives in the string tables — the… */
      var base = t('syncBadgeSynced');
      var sessSeg = session ? (lang === 'si' ? ' · ' + session + ' වන වාරය' : ' · Session ' + session) : '';
      label = base + sessSeg + ' · v' + APP_VERSION;
    } else if (state.state === 'offline') {
      label = t('syncBadgeOffline');
    } else if (state.state === 'update') {
      label = t('syncBadgeUpdate');
    } else {
      label = t('syncBadgeRetry');
    }
    if (badge) {
      /* D-UI6: below 480 px the badge shows a two-word summary. */
      var vw = Number(global.innerWidth || 0);
      var shortLabel = label;
      if (vw > 0 && vw < 480) {
        if (state.state === 'offline') shortLabel = t('syncShortOffline');
        else if (state.state === 'update') shortLabel = t('syncShortUpdate');
        else if (state.state === 'error') shortLabel = t('syncShortRetry');
        else shortLabel = t('syncShortSynced');
      }
      badge.textContent = shortLabel;
      badge.setAttribute('data-sync-state', state.state || 'synced');
      badge.setAttribute('title', label);
    }
    if (status) { status.textContent = label; status.setAttribute('data-state', state.state || 'synced'); status.setAttribute('title', label); }
  }
  /* R2/D1: checkForUpdates(cb) is node-style, cb(err, result); v0.0.1.d read… */
  function handleSyncCheckResult(err, result) {
    var res = (result && typeof result === 'object') ? result : ((err && typeof err === 'object' && 'ok' in err) ? err : {});
    var hasErr = (result !== undefined && !!err) || !res.ok;
    if (hasErr) {
      paintSyncBadge({ state: res.error === 'no_fetch' ? 'offline' : 'error', session: syncSessionNo() });
      /* v0.0.7.c (BUG-01): a single failed tick NEVER latches Offline Mode.
         The banner follows the probe-verified state only, and only after two
         consecutive unreachable ticks (a full 50 s window) does the probe
         even run — one slow pointer on mobile data is not 'offline'. */
      if (res.error === 'no_fetch' || res.error === 'timeout') { try { noteSyncFailed(); } catch (eO) {} }
      return;
    }
    /* a real answer from the network proves connectivity — clear the banner
       AND the Lecturer Studio blind together (the v0.0.7.b bug: the studio
       stayed blinded forever after one bad probe, even fully back online). */
    try { noteSyncReachable(); } catch (eO2) {}
    if (res.appVersionChanged) {
      paintSyncBadge({ state: 'update', session: res.session || syncSessionNo() });
      return;
    }
    paintSyncBadge({ state: 'synced', session: res.session || syncSessionNo() });
  }
  function syncSessionNo() {
    /* v0.0.7.c (BUG-01 #3): no literal Session-8 fallback — an unknown
       session stays empty instead of flashing a wrong number. */
    var n = '';
    try { if (SDP.Sync && SDP.Sync.sessionNo) n = SDP.Sync.sessionNo() || ''; } catch (e) {}
    return str(n);
  }
  function checkForUpdate() {
    setUpdateStatus(t('updateChecking'), '');
    /* v0.0.7.c (BUG-01 #2): the manual check can NEVER hang — a hard 8 s
       deadline always lands a deterministic success / up-to-date / error
       status plus a toast, whatever the network does underneath. */
    var settledUpd = false;
    var deadlineUpd = global.setTimeout(function () {
      if (settledUpd) return;
      settledUpd = true;
      paintSyncBadge({ state: 'error', session: syncSessionNo() });
      setUpdateStatus(t('updateTimedOut', 'Check timed out — the connection is too slow. Tap again to retry.'), 'bad');
      showToast(t('updateTimedOut', 'Check timed out — the connection is too slow. Tap again to retry.'));
      try { noteSyncFailed(); } catch (eD) {}
    }, 8000);
    var finishUpd = function (err, result) {
      if (settledUpd) return;
      settledUpd = true;
      global.clearTimeout(deadlineUpd);
      var res = (result && typeof result === 'object') ? result : ((err && typeof err === 'object' && 'ok' in err) ? err : {});
      var failed = (result !== undefined && !!err) || !res.ok;
      if (failed) {
        var offlineish = res.error === 'no_fetch' || res.error === 'timeout' || res.error === 'raw_timeout' || res.error === 'raw_unavailable';
        var state = offlineish ? 'offline' : 'error';
        paintSyncBadge({ state: state, session: syncSessionNo() });
        setUpdateStatus(offlineish ? t('syncBadgeOffline') : t('syncBadgeRetry'), offlineish ? '' : 'bad');
        showToast(offlineish ? t('syncBadgeOffline') : t('syncBadgeRetry'));
        /* probe-verified only: a failed fetch alone never paints Offline. */
        if (offlineish) { try { noteSyncFailed(); } catch (eF) {} }
        return;
      }
      try { noteSyncReachable(); } catch (eR) {}
      if (res.appVersionChanged) {
        paintSyncBadge({ state: 'update', session: res.session || syncSessionNo(), appVersion: res.appVersion });
        setUpdateStatus(t('syncBadgeUpdate'), 'ok');
        showToast(t('syncBadgeUpdate'));
        return;
      }
      if (res.updated) {
        paintSyncBadge({ state: 'synced', session: res.session || syncSessionNo() });
        setUpdateStatus(t('updateFound') + ' · Session ' + str(res.session), 'ok');
        showToast(t('updateFound') + ' · Session ' + str(res.session));
        onDataReady();
        return;
      }
      paintSyncBadge({ state: 'synced', session: res.session || syncSessionNo() });
      setUpdateStatus(t('updateNone'), '');
      showToast(t('updateNone'));
    };
    try {
      SDP.Sync.checkForUpdates(function (err, result) { finishUpd(err, result); });
    } catch (e) {
      finishUpd(e, null);
    }
  }

  /* ══ Quick pacing presets ══ */
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
    /* ENG-05: a preset is a classroom change like any other. */
    saveTouched(patch, t('presetHeading') + ' → ' + id);
    renderSettings();
    if (p.theme) applyTheme(p.theme, true);
    if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
    setUpdateStatus(t('presetApplied'), 'ok');
  }

  /* ══ Smart Board Classroom Bar (D-UI4, D-UI5, R10)  ══ */
  var boardState = { wordShown: false };
  function boardWordCount() {
    var n = 0;
    try { n = Number(SDP.Sync && SDP.Sync.wordCount ? SDP.Sync.wordCount() : 0) || 0; } catch (e) { n = 0; }
    return n;
  }
  function boardBarShouldShow() {
    return boardWordCount() > 0;
  }
  function renderBoardBar() {
    var bar = byId('boardClassBar');
    if (!bar) return false;
    var show = boardBarShouldShow();
    if (bar.classList) {
      if (show) bar.classList.add('is-active'); else bar.classList.remove('is-active');
    }
    bar.hidden = !show;
    if (show) renderBoardJumper();
    paintBoardWord();
    return show;
  }
  function renderBoardJumper() {
    var host = byId('boardJumper');
    if (!host) return 0;
    /* D-UI5: 1..N from the live session, never a hardcoded 1..30. */
    var count = boardWordCount();
    var active = -1;
    try { active = Number(SDP.Engine && SDP.Engine.config ? SDP.Engine.config().index : -1); } catch (e) { active = -1; }
    var html = '', i;
    for (i = 0; i < count; i++) {
      html += '<button type="button" class="board-chip" data-board-jump="' + i + '" aria-pressed="' +
        (i === active ? 'true' : 'false') + '">' + (i + 1) + '</button>';
    }
    host.innerHTML = html;
    /* v0.0.6.c (F2): the 1-30 chips live inside a CLOSED drawer; the summary
       pill carries the live word so the numbers never clutter the cockpit. */
    var toggle = byId('boardJumperToggle');
    if (toggle) setText(toggle, fmtN(t('pillsDrawer', 'Jump to Word 1–{N} ▾'), liveTotal()));
    var drawer = byId('boardJumperDrawer');
    if (drawer && drawer.removeAttribute) drawer.setAttribute('data-count', String(count));
    return count;
  }
  function currentWordText() {
    try {
      if (SDP.Engine && SDP.Engine.current) {
        var c = SDP.Engine.current();
        if (c && c.word) return str(c.word.w || c.word);
      }
    } catch (e) {}
    var idx = 0;
    try { idx = Number(SDP.Engine && SDP.Engine.config ? SDP.Engine.config().index : 0) || 0; } catch (e) { idx = 0; }
    var w = null;
    try { w = SDP.Sync && SDP.Sync.word ? SDP.Sync.word(idx) : null; } catch (e) { w = null; }
    return w ? str(w.w) : '';
  }
  /* R10 — the board NEVER spoils the spelling during dictation by default. */
  function currentBoardWord() {
    var idx = 0;
    try { idx = Number(SDP.Engine && SDP.Engine.config ? SDP.Engine.config().index : 0) || 0; } catch (e) { idx = 0; }
    try { return SDP.Sync && SDP.Sync.word ? (SDP.Sync.word(idx) || null) : null; } catch (e2) { return null; }
  }
  function paintBoardWord() {
    var node = byId('boardWordDisplay');
    if (!node) return false;
    var text = currentWordText();
    node.textContent = boardState.wordShown ? text : '••••••';
    node.setAttribute('data-revealed', boardState.wordShown ? 'true' : 'false');
    var w = currentBoardWord();
    var idx = 0, count = boardWordCount();
    try { idx = Number(SDP.Engine && SDP.Engine.config ? SDP.Engine.config().index : 0) || 0; } catch (e) { idx = 0; }
    setText(byId('boardWordNo'), '#' + (idx + 1) + '/' + count);
    var rawP = w && w.p ? String(w.p).replace(/^\/+|\/+$/g, '') : '';
    /* v0.0.6.a: a spelling-as-phonetics placeholder is never printed. */
    if (rawP && rawP.toLowerCase() === String(w && w.w ? w.w : '').toLowerCase()) rawP = '';
    setText(byId('boardIpa'), rawP ? '/' + rawP + '/' : '/—/');
    setText(byId('boardPos'), (w && w.pos) || '—');
    setText(byId('boardSi'), (w && w.si) || '—');
    var btn = byId('btnBoardToggleWord');
    if (btn) {
      btn.textContent = boardState.wordShown ? t('boardHideWord') : t('boardShowWord');
      btn.setAttribute('aria-pressed', boardState.wordShown ? 'true' : 'false');
    }
    return true;
  }
  function toggleBoardWord() {
    boardState.wordShown = !boardState.wordShown;
    if (boardState.wordShown) autoPauseForReveal();
    paintBoardWord();
    return boardState.wordShown;
  }
  /* v0.0.6.a: each new word (jump or auto-advance) re-hides the reveal so the
     spelling can never leak into the next beat by itself (R10 / G7.3c). */
  function resetBoardReveal() {
    boardState.wordShown = false;
    paintBoardWord();
  }
  function bindBoardBar() {
    var bar = byId('boardClassBar');
    if (!bar || bar._sdpBound) return false;
    bar._sdpBound = true;
    bar.addEventListener('click', function (ev) {
      var node = ev && ev.target;
      while (node && node !== bar && !(node.getAttribute && node.getAttribute('data-board-jump') !== null)) node = node.parentNode;
      if (node && node !== bar) {
        if (ev.preventDefault) ev.preventDefault();
        var jump = Number(node.getAttribute('data-board-jump'));
        if (isFinite(jump)) {
          try { if (SDP.Engine && SDP.Engine.jumpTo) SDP.Engine.jumpTo(jump); } catch (e) {}
          renderBoardJumper();
          paintBoardWord();
        }
        return;
      }
      var t2 = ev && ev.target;
      while (t2 && t2 !== bar && !(t2.id)) t2 = t2.parentNode;
      var id = (t2 && t2 !== bar) ? t2.id : '';
      if (id === 'btnBoardToggleWord') { toggleBoardWord(); return; }
      var engine = SDP.Engine;
      if (!engine) return;
      if (id === 'boardPlayPause') { try { engine.togglePlayPause(); } catch (e) {} }
      else if (id === 'boardRepeat') { try { engine.repeat(); } catch (e) {} }
      else if (id === 'boardNext') { try { engine.next(); } catch (e) {} }
      renderBoardJumper();
      paintBoardWord();
    }, false);
    return true;
  }


  /* ══ Settings order guard ══ */
  
  function settingsOrder() {
    var host = byId('settingsSections');
    if (!host) return [];
    var sections = host.querySelectorAll('.set-card');
    var order = [];
    for (var i = 0; i < sections.length; i++) order.push(sections[i].id || sections[i].getAttribute('data-section') || 'section');
    return order;
  }

  /* ══ Data toast  ══ */
  
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
    /* v0.0.6.d (D7): the Samsung One-UI data capsule — the exact task data
       spend plus the honest offline-cache state, in one line. */
    return t(offline ? 'toastOfflineCapsule' : 'toastLoadedCapsule') + ' · ' + kb + ' KB';
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
  function showCapsule(text) {
    var node = byId('sdpDataToast');
    if (!node) return false;
    node.textContent = str(text);
    node.hidden = false;
    if (node.classList) node.classList.remove('toast-hidden');
    if (toastTimer) global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () {
      if (node.classList) node.classList.add('toast-hidden');
      toastTimer = global.setTimeout(function () { node.hidden = true; }, 420);
    }, 2400);
    return true;
  }

  /* ══ wiring  ══ */
  /* D13: the resume card's secondary route — a clean run from word #1. */
  function startOver() {
    try { SDP.Data.clearSession(); } catch (e) {}
    try { SDP.Engine.start({ mode: settings().mode, fresh: true }); } catch (e) {}
    showTab('player');
    return true;
  }
  /* D9: any human tap on a [data-primary-cta] retires that screen's cue. */
  function bindCueWatcher() {
    if (!doc || !doc.addEventListener || bindCueWatcher._bound) return false;
    bindCueWatcher._bound = true;
    doc.addEventListener('click', function (ev) {
      var node = ev && ev.target;
      while (node && node !== doc && !(node.getAttribute && node.getAttribute('data-primary-cta'))) node = node.parentNode;
      if (!node || node === doc || !node.getAttribute) return;
      markCueSeen(currentTab());
    }, false);
    return true;
  }

  function bindShell() {
    /* v0.0.6.m (CF1): btnGuideTop / btnCreatorNote / btnStudioQuick moved
       from the header into the Settings About card — the same ids keep
       their contracts, only the roof they live under changed. */
    on('btnGuideTop', 'click', openGuide);
    on('btnGuide', 'click', openGuide);
    on('btnGuideClose', 'click', closeGuide);
    /* v0.0.6.m: the relocated Project Briefing button replays the synced
       executive briefing from the About card. */
    on('btnCreatorNote', 'click', function () { openBriefing({ replay: true, fromSettings: true }); });
    /* v0.0.6.w: the Real-Time Voice & Clone Lab (lab.html) launcher. */
    on('btnOpenLiveLab', 'click', function () {
      try { global.open('./lab.html', '_blank'); } catch (eL) {}
    });
    on('btnBriefingContinue', 'click', function () { closeBriefing('continue'); });
    on('btnBriefingSkip', 'click', function () { closeBriefing('skip'); });
    /* v0.0.6.v: the ALWAYS-ENABLED top-right escape hatch — closes the
       briefing immediately, gates and narration notwithstanding. */
    on('btnBriefingSkipTop', 'click', function () { briefingSkipTop(); });
    var bModal = byId('briefingModal');
    if (bModal && !bModal._sdpBound) {
      bModal._sdpBound = true;
      bModal.addEventListener('click', function (ev) {
        if (ev && ev.target === bModal) closeBriefing('backdrop');
      });
      bModal.addEventListener('click', function (ev) {
        var node = ev && ev.target;
        if (!node || !node.getAttribute) return;
        var line = node.getAttribute('data-bline');
        if (line !== null && line !== undefined && line !== '') briefingSeek(Number(line));
      });
    }
    bindReviewCard();
    on('btnGuideSkipStart', 'click', function () {
      /* v0.0.6.q Pillar 3 — STAGE 4 of the onboarding pipeline: ▶ Click
         Start Dictation Now closes the guide, stamps guideSeen, switches to
         the Dictation screen (#screen-player) and starts the Dictation Clock
         cleanly at Word #1 (Engine.start with no startIndex → index 0),
         speaking Word #1 through its committed ElevenLabs Alice clip. */
      var mode = guideState.pendingMode || settings().mode;
      closeGuide();
      beginDictation(mode);
    });
    /* Phase 5: the 30-pill map lives in a collapsed bottom drawer. */
    on('pillsDrawerToggle', 'click', function () {
      var drawer = byId('pillsDrawer');
      var toggle = byId('pillsDrawerToggle');
      if (!drawer) return;
      var open = drawer.hidden === true;
      drawer.hidden = !open;
      if (toggle) {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.textContent = fmtN(t('pillsDrawer', 'Jump to Word 1–{N} ▾'), liveTotal());
      }
    });
    on('btnLang', 'click', toggleLang);
    on('btnRevealWord', 'click', toggleRevealCard);
    on('sdpStalePill', 'click', applyUpdateNow);
    on('sdpUpdateNowBtn', 'click', applyUpdateNow);
    on('sdpUpdateLaterBtn', 'click', dismissUpdateLater);
    on('guideLangPill', 'click', toggleLang);
    on('btnTheme', 'click', toggleTheme);
    on('btnStart', 'click', function () { markCueSeen('home'); startDictation(); });
    on('btnResume', 'click', resumeDictation);
    on('btnHomeWords', 'click', function () { showTab('dict'); });
    on('btnOpenStudioFromSettings', 'click', function () { openStudio(); });
    on('btnStartOver', 'click', startOver);
    on('btnResumeDraft', 'click', resumeDictation);
    var tabs = ['home', 'player', 'practice', 'dict', 'settings', 'studio'];
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
    /* D-L1: the header studio button mirrors the lock state. */
    var quickBtn = byId('btnStudioQuick');
    if (quickBtn && !quickBtn._sdpBound) {
      quickBtn._sdpBound = true;
      quickBtn.addEventListener('click', function () { openStudio(); }, false);
    }
    var modal = byId('guideModal');
    if (modal && !modal._sdpBound) {
      modal._sdpBound = true;
      modal.addEventListener('click', function (ev) { if (ev && ev.target === modal) closeGuide(); });
    }
    trapGuideKeys();
    bindBoardBar();
    bindWords();
    bindPractice();
    bindSettings();
    bindCueWatcher();
    paintCues();
  }


  /* ══ v0.0.6.e (C/D/E) — reveal card, update capsule, offline studio ══ */
  function isOfflineNow() {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }
  function engineRunningNow() {
    try { return !!(SDP.Engine && SDP.Engine.isActive && SDP.Engine.isActive() && !(SDP.Engine.isPaused && SDP.Engine.isPaused())); } catch (e) { return false; }
  }
  function autoPauseForReveal() {
    if (!engineRunningNow()) return false;
    try { if (SDP.Engine && SDP.Engine.pause) SDP.Engine.pause('reveal'); } catch (e) {}
    return true;
  }
  var revealState = { shown: false, pausedFor: false, meaningOnly: false };
  /* v0.0.6.f (R2): the reveal card carries the full meaning — IPA, part of
     speech, Sinhala and the English gloss — so the student never scrolls. */
  function paintRevealMeaning(w) {
    var host = byId('revealMeaning');
    if (!host) return false;
    var ipa = byId('revealIpa'), pos = byId('revealPos'), si = byId('revealSi'), en = byId('revealEn'), pv = byId('revealPronVariants');
    if (!(revealState.shown || revealState.meaningOnly) || !w) {
      host.hidden = true;
      if (ipa) setText(ipa, '/—/');
      if (pos) setText(pos, '—');
      if (si) setText(si, '—');
      if (en) setText(en, '');
      if (pv) pv.hidden = true;
      return true;
    }
    var rawP = str(w.p).replace(/^\/+|\/+$/g, '');
    if (rawP && rawP.toLowerCase() === str(w.w).toLowerCase()) rawP = '';
    if (ipa) setText(ipa, rawP ? '/' + rawP + '/' : '/—/');
    if (pos) setText(pos, str(w.pos) || '—');
    if (si) setText(si, str(w.si) || '—');
    if (en) setText(en, str(w.m) || '');
    /* v0.0.7.b B2: the UK pronunciation-variant hint badge on the Player
       reveal card — students see both accepted British forms at a glance. */
    if (pv) {
      var vars = Array.isArray(w.pronunciationVariants) ? w.pronunciationVariants : [];
      if (vars.length > 1) {
        pv.hidden = false;
        pv.textContent = '🔊 ' + vars.length + ' ' + t('pronVariantsBadge') + ': ' + vars.slice(0, 3).join(' · ');
      } else {
        pv.hidden = true;
      }
    }
    host.hidden = false;
    return true;
  }
  function paintRevealCard() {
    var card = byId('revealWordCard'), text = byId('revealWordText'), btn = byId('btnRevealWord'), badge = byId('revealPausedBadge');
    if (!card) return false;
    card.hidden = false;
    var word = currentWordText();
    if (text) { text.textContent = revealState.shown ? (word || '—') : '••••••'; text.setAttribute('data-revealed', revealState.shown ? 'true' : 'false'); }
    if (btn) {
      var rLabel = revealState.shown ? t('revealHide', 'Hide Word') : t('revealShow', 'Show Current Word');
      var rIcon = '';
      try { if (SDP.Icons && SDP.Icons.icon) rIcon = SDP.Icons.icon(revealState.shown ? 'eyeOff' : 'eye', 18); } catch (e) {}
      btn.innerHTML = rIcon + '<span class="i18n-label"></span>';
      var rSpan = btn.querySelector('.i18n-label');
      if (rSpan) rSpan.textContent = rLabel;
      btn.setAttribute('aria-label', rLabel);
    }
    if (badge) badge.hidden = !(revealState.shown && revealState.pausedFor);
    var cockpitCard = byId('cockpitBar');
    if (cockpitCard && cockpitCard.classList) { if (revealState.shown) cockpitCard.classList.add('reveal-open'); else cockpitCard.classList.remove('reveal-open'); }
    paintRevealMeaning((revealState.shown || revealState.meaningOnly) ? currentBoardWord() : null);
    return true;
  }
  function toggleRevealCard() {
    revealState.shown = !revealState.shown;
    if (revealState.shown) revealState.pausedFor = autoPauseForReveal();
    else revealState.pausedFor = false;
    if (revealState.shown) revealState.meaningOnly = false;
    paintRevealCard();
    return revealState.shown;
  }
  /* v0.0.6.g (A2): the Hint pill opens the meaning panel — IPA, word type and
     the Sinhala/English gloss — WITHOUT the spelling, so it is a real hint. */
  function toggleHintPanel() {
    if (revealState.shown) { toggleRevealCard(); return false; }
    revealState.meaningOnly = !revealState.meaningOnly;
    paintRevealCard();
    return revealState.meaningOnly;
  }
  /* v0.0.7.b B3: the 3-stage Hint flow drives the meaning panel through
     these explicit setters (press 1 shows it, press 3 hides it — a spelling
     reveal is always folded back to a meaning-only hint first). */
  function showHintPanel() {
    if (revealState.shown) { revealState.shown = false; revealState.pausedFor = false; }
    revealState.meaningOnly = true;
    paintRevealCard();
    return true;
  }
  function hideHintPanel() {
    revealState.meaningOnly = false;
    paintRevealCard();
    return true;
  }
  var lastRevealIdx = -1;
  function onEngineWordChanged(idx) {
    if (idx === lastRevealIdx) {
      /* same word, engine re-rendered: a resumed beat re-hides a SHOWN
         spelling (R10). v0.0.7.b B3: an open meaning HINT (meaningOnly —
         IPA/POS/Si/En, never the spelling) is NEVER auto-closed by an
         engine re-render; only the next word or an explicit press closes
         it (the live Hint-fails-mid-beat bug). */
      if (engineRunningNow() && revealState.shown) {
        revealState.shown = false;
        revealState.pausedFor = false;
        paintRevealCard();
      }
      return true;
    }
    lastRevealIdx = idx;
    revealState.shown = false;
    revealState.meaningOnly = false;
    revealState.pausedFor = false;
    revealState.wordIdx = idx;
    paintRevealCard();
    try { resetBoardReveal(); } catch (e) {}
    paintBoardWord();
    return true;
  }
  function paintUpdateCard(mode) {
    var card = byId('sdpUpdateCard'), text = byId('sdpUpdateText'), bar = byId('sdpUpdateBar');
    var nowBtn = byId('sdpUpdateNowBtn'), laterBtn = byId('sdpUpdateLaterBtn');
    if (!card) return false;
    card.hidden = false;
    if (text) setText(text, mode === 'ask'
      ? t('updateAsk', 'New classroom words are ready. Refresh now?')
      : t('updateSyncing', '🔄 Updating to v' + APP_VERSION + ' — refreshing automatically…'));
    if (bar) bar.hidden = (mode !== 'sync');
    if (nowBtn) nowBtn.hidden = (mode !== 'ask');
    if (laterBtn) laterBtn.hidden = (mode !== 'ask');
    if (mode === 'sync' && global.setTimeout) {
      global.setTimeout(function () { applyUpdateNow(); }, 1500);
    }
    return true;
  }
  function applyUpdateNow() {
    var card = byId('sdpUpdateCard'), stale = byId('sdpStalePill');
    if (card) card.hidden = true;
    if (stale) stale.hidden = true;
    try { if (SDP.Engine && SDP.Engine.hardReset) SDP.Engine.hardReset(); } catch (e) {}
    try { if (SDP.Data && SDP.Data.clearSession) SDP.Data.clearSession(); } catch (e) {}
    renderAll();
    if (SDP.Engine && SDP.Engine.refreshEls) { try { SDP.Engine.refreshEls(); } catch (e) {} }
    showCapsule(t('wordsRefreshedToast', '🔄 Word list updated — Dictation refreshed & ready from Word #1'));
    return true;
  }
  function dismissUpdateLater() {
    var card = byId('sdpUpdateCard'), stale = byId('sdpStalePill');
    if (card) card.hidden = true;
    if (stale) stale.hidden = false;
    return true;
  }
  function paintStudioOffline(show) {
    var card = byId('sdpStudioOfflineCard');
    var tab = byId('tab-studio'), rail = byId('rail-studio');
    var screenNode = byId('screen-studio');
    if (card) card.hidden = !show;
    /* v0.0.6.f (R5): offline the whole studio surface is blinded — the PIN
       pad can never unlock without GitHub Cloud behind it. */
    if (screenNode) { if (show) screenNode.classList.add('studio-is-offline'); else screenNode.classList.remove('studio-is-offline'); }
    if (tab) { if (show) tab.classList.add('is-offline'); else tab.classList.remove('is-offline'); }
    if (rail) { if (show) rail.classList.add('is-offline'); else rail.classList.remove('is-offline'); }
    if (show) {
      try { if (SDP.Studio && SDP.Studio.lock) SDP.Studio.lock(); } catch (e) {}
      try { if (SDP.Studio && SDP.Studio.isUnlocked && !SDP.Studio.isUnlocked() && SDP.Studio.state) {} } catch (e2) {}
    }
    return true;
  }
  /* v0.0.7.c (BUG-01 #3): boot-settled latch — the honest loading state for
     the readiness badge and the empty-bank copy. */
  var dataBootSettled = false;
  function dataSettled(value) {
    if (value === true) dataBootSettled = true;
    return dataBootSettled;
  }
  function onNetChange() {
    var off = isOfflineNow();
    paintStudioOffline(off);
    /* v0.0.7.b B7: the app-wide Offline Mode banner follows every change. */
    paintOfflineBanner(off);
    if (!off) return true;
    var studioOpen = false;
    try { studioOpen = !!(doc.querySelector && doc.querySelector('#screen-studio.active')); } catch (e) { studioOpen = false; }
    if (studioOpen) {
      var body = byId('studioBody');
      if (body && body.setAttribute) body.setAttribute('aria-live', 'polite');
    }
    return true;
  }
  /* ══ v0.0.7.b B7 — the ALWAYS-VISIBLE OFFLINE MODE BANNER (#sdpOfflineModeBanner).
     navigator.onLine alone lies on phone networks ("connected" but no mobile
     data), so the online event is verified with a tiny live probe of
     version.json: a failed probe keeps the banner up; a success clears it
     the instant real connectivity returns. ══ */
  var offlineProbeBusy = false;
  var offlineStrikes = 0;
  var offlineVisible = false;
  function probeConnectivity(cb) {
    cb = cb || function () {};
    if (typeof global.fetch !== 'function') { cb(false); return false; }
    var done = false;
    var finish = function (ok) { if (!done) { done = true; cb(ok); } };
    try {
      global.fetch('./data/version.json?probe=' + Date.now(), { cache: 'no-store' })
        /* v0.0.7.c (BUG-01): ANY HTTP answer (200 … 404) proves the origin is
           reachable — only a network error or a timeout is 'offline'. */
        .then(function (r) { finish(!!r); }, function () { finish(false); });
    } catch (e) { finish(false); return false; }
    /* v0.0.7.c: the probe gets a real 8 s window (was 6 s, racing the service
       worker's own 10 s network-first window and losing on slow mobile data). */
    global.setTimeout(function () { finish(false); }, 8000);
    return true;
  }
  function paintOfflineBanner(show) {
    var b = byId('sdpOfflineModeBanner');
    if (!b) return false;
    b.hidden = !show;
    b.setAttribute('data-state', show ? 'on' : 'hidden');
    if (show) {
      setText(byId('obTitle'), '📡 ' + t('offlineBanner', 'Running in Offline Mode (No Internet / Mobile Data)'));
      setText(byId('obSub'), t('offlineBannerSub', 'Cached audio & sessions active'));
      var hb = byId('btnOfflineHelp');
      if (hb) setText(hb, t('offlineBannerHelp', 'Get Help'));
      var rb = byId('btnOfflineRetry');
      if (rb) setText(rb, t('offlineRetry', 'Retry Connection'));
    }
    offlineVisible = !!show;
    return true;
  }
  function applyProbeResult(ok, announceOnline) {
    offlineProbeBusy = false;
    paintOfflineBanner(!ok);
    /* v0.0.7.c (BUG-01): the banner and the Lecturer Studio blind ALWAYS
       move together — a reachable origin unblinds the studio instantly. */
    paintStudioOffline(!ok);
    if (ok) {
      offlineStrikes = 0;
      if (announceOnline && offlineVisible) { try { showToast(t('offlineBackOnline', 'Back online')); } catch (e) {} }
      offlineVisible = false;
    }
  }
  function refreshOfflineState(announceOnline) {
    var off = isOfflineNow();
    if (off) { offlineStrikes = 0; onNetChange(); return true; }
    /* navigator claims online — verify with a probe so "no mobile data"
       keeps the banner visible. */
    if (offlineProbeBusy) return true;
    offlineProbeBusy = true;
    try { setText(byId('obSub'), t('offlineProbePending', 'Checking your connection…')); } catch (eP) {}
    probeConnectivity(function (ok) { applyProbeResult(ok, announceOnline); });
    return true;
  }
  /* v0.0.7.c (BUG-01): the 25 s sync tick alone can never flip the app into
     Offline Mode. A failed tick counts ONE strike; two consecutive failures
     escalate to a probe-verified decision, and any success clears everything
     instantly. One slow pointer read on mobile data is not 'offline'. */
  function noteSyncReachable() {
    offlineStrikes = 0;
    paintOfflineBanner(false);
    paintStudioOffline(false);
    offlineVisible = false;
    return true;
  }
  function noteSyncFailed() {
    offlineStrikes += 1;
    if (offlineStrikes >= 2 && !offlineProbeBusy) refreshOfflineState(false);
    return true;
  }
  /* D-S10/S11 (R7): a teacher publish tells the student, and only the keys… */
  function bindTeacherUpdates() {
    if (bindTeacherUpdates._bound || !doc || !doc.addEventListener) return false;
    bindTeacherUpdates._bound = true;
    doc.addEventListener('sdp:teacher-updated', function (ev) {
      var rev = Number(ev && ev.detail && ev.detail.settingsRev) || 0;
      /* R1: the student is told exactly which revision arrived. */
      showToast(rev ? t('lecturerSyncedToast') + rev + ')' : t('teacherUpdatedToast'));
      renderAll();
    }, false);
    /* D3: every adopted publish repaints — v0.0.1.e emitted 'sdp:update' to nobody. */
    doc.addEventListener('sdp:update', function () {
      renderAll();
      if (SDP.Engine && SDP.Engine.refreshEls) { try { SDP.Engine.refreshEls(); } catch (e) {} }
    }, false);
    /* v0.0.6.d (D1): the active word list changed — reset the cockpit to
       Word #1 with the new words and announce it in the top capsule. */
    doc.addEventListener('sdp:words-refresh', function () { onWordsRefresh(); }, false);
    if (global.addEventListener) {
      global.addEventListener('sdp:words-refresh', function () { onWordsRefresh(); }, false);
    }
    /* The same event on window, for harnesses that dispatch on window. */
    if (global.addEventListener) {
      global.addEventListener('sdp:update', function () { renderAll(); }, false);
    }
    /* D16: the 30 s tick and every visibilitychange repaint the badge from the… */
    doc.addEventListener('sdp:sync-status', function (ev) {
      var d = (ev && ev.detail) || {};
      handleSyncCheckResult(d.err, d.result);
    }, false);
    /* v0.0.6.e (E): online-only Lecturer Studio — the lock reacts to the real
       network state and never blocks a programmatic mount() while online. */
    if (global.addEventListener && !bindTeacherUpdates._netBound) {
      bindTeacherUpdates._netBound = true;
      global.addEventListener('offline', function () { onNetChange(); }, false);
      /* v0.0.7.b B7: the online event is PROBE-verified — a lying
         navigator.onLine (no mobile data) keeps the banner visible. */
      global.addEventListener('online', function () { refreshOfflineState(true); }, false);
    }
    return true;
  }

  /* D6: Studio is a top-level screen; focus the PIN (locked) or the key row. */
  function openStudio() {
    if (isOfflineNow()) paintStudioOffline(true);
    try { showTab('studio'); } catch (e) {}
    try { if (SDP.Studio && SDP.Studio.mount) SDP.Studio.mount(); } catch (e) {}
    var unlocked = false;
    try { unlocked = !!(SDP.Studio && SDP.Studio.isUnlocked && SDP.Studio.isUnlocked()); } catch (e) { unlocked = false; }
    /* v0.0.4.a W3: never call .focus() while the Studio is locked — the mobile
       OS keyboard must never cover #pinPad. Desktop + unlocked still focuses. */
    var isDesktopFine = global.matchMedia && global.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var target = (unlocked && isDesktopFine) ? (byId('elKeyInput') || byId('btnOneClickMasterSetup')) : null;
    if (target && target.focus) { try { target.focus({ preventScroll: true }); } catch (e) {} }
    var acc = byId('studioAccordion');
    if (acc && acc.scrollIntoView) { try { acc.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { try { acc.scrollIntoView(); } catch (e2) {} } }
    try { if (SDP.Studio && SDP.Studio.paintQuickButton) SDP.Studio.paintQuickButton(); } catch (e) {}
    paintCues();
    return true;
  }

  function onWordsRefresh() {
    /* v0.0.6.e (D): a running dictation is never interrupted mid-word — the
       ask-mode capsule takes over; an idle player auto-syncs in 1.5s. */
    var wasRunning = engineRunningNow();
    if (!wasRunning) {
      try { if (SDP.Engine && SDP.Engine.hardReset) SDP.Engine.hardReset(); } catch (e) {}
      try { if (SDP.Data && SDP.Data.clearSession) SDP.Data.clearSession(); } catch (e) {}
      renderAll();
      if (SDP.Engine && SDP.Engine.refreshEls) { try { SDP.Engine.refreshEls(); } catch (e) {} }
    }
    var lecturerHere = false;
    try { lecturerHere = !!(doc.querySelector && doc.querySelector('#screen-studio.active')); } catch (e) { lecturerHere = false; }
    if (lecturerHere) {
      showCapsule(t('wordsRefreshedToast', '🔄 Word list updated — Dictation refreshed & ready from Word #1'));
      return true;
    }
    if (wasRunning) paintUpdateCard('ask');
    else paintUpdateCard('sync');
    return true;
  }

  function onDataReady(err) {
    dataSettled(true);
    renderHome();
    renderBoardBar();
    renderWords();
    renderPractice();
    renderSettings();
    if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
    var title = byId('sessionTitle');
    try { if (title && SDP.Sync.sessionTitle()) setText(title, SDP.Sync.sessionTitle()); } catch (e) {}
    try { if (SDP.Speech && SDP.Speech.loadManifest) SDP.Speech.loadManifest(noop); } catch (e) {}
    try { if (SDP.Studio && SDP.Studio.onDataReady) SDP.Studio.onDataReady(); } catch (e) {}
    if (!err && global.__SDP_NO_LIVE__ !== true) {
      /* R8 (F8): the watch tightened from 25 s to 15 s; the honest badge and
         the deferred-adoption queue both ride on this single ticker. */
      try { SDP.Sync.startWatch(15000); } catch (e) {}
    }
    return true;
  }

  /* v0.0.6.g (A1): re-arm the anti-extension shield once the modules are up.
     The inline boot script already locked Dark Reader out of the page; this
     guard removes anything an extension re-injects after DOM ready. */
  function installExtensionShield() {
    function shield() {
      var d = doc.documentElement, h = doc.head, i;
      var ax = ['data-darkreader-mode', 'data-darkreader-scheme', 'data-darkreader-proxy-injected'];
      for (i = 0; i < ax.length; i++) if (d.hasAttribute(ax[i])) d.removeAttribute(ax[i]);
      if (!h) return;
      var rm = h.querySelectorAll('meta[name="darkreader"]');
      for (i = 0; i < rm.length; i++) if (rm[i].parentNode) rm[i].parentNode.removeChild(rm[i]);
      if (!h.querySelector('meta[name="darkreader-lock"]')) {
        var L = doc.createElement('meta'); L.setAttribute('name', 'darkreader-lock'); h.appendChild(L);
      }
      var rs = h.querySelectorAll('style.darkreader,link.darkreader');
      for (i = 0; i < rs.length; i++) if (rs[i].parentNode) rs[i].parentNode.removeChild(rs[i]);
    }
    shield();
    if (global.MutationObserver && !installExtensionShield._armed) {
      installExtensionShield._armed = true;
      try {
        new global.MutationObserver(function () { shield(); }).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-darkreader-mode', 'data-darkreader-scheme', 'data-darkreader-proxy-injected'] });
        new global.MutationObserver(function () { shield(); }).observe(doc.head, { childList: true });
      } catch (e) {}
    }
    return true;
  }

  /* ══ v0.0.6.m Pillar 1 — Dynamic Oct-22 Weekly Briefing ════════════════
   * Re-architected around how a brand-new visitor actually experiences the
   * briefing on a fresh Chrome session:
   *   - the week counter is COMPUTED from PROJECT_START_ISO (2026-10-22), so
   *     "Started N Weeks Ago" bumps itself every week without code edits;
   *   - Beat 2 states the 100% E2EE privacy law upfront (a core purpose);
   *   - narration is word-by-word karaoke flow (.b-word is-spoken/is-current)
   *     with all 4 beats visible for read-ahead / read-back;
   *   - the 4 beats ship as REAL warm British male clips (_intro_male_1..4
   *     in data/elevenlabs-audio.json), so a fresh session hears studio
   *     audio instead of a robotic browser voice; the Studio's
   *     autoEnsureSystemClips() keeps them current (week-count drift);
   *   - fresh-Chrome autoplay handshake: when Audio.play() is blocked
   *     (NotAllowedError) or no speech voices exist yet, a pulsing
   *     "Tap Anywhere to Start Voice Briefing" pill takes over and the
   *     narration WAITS for the first gesture — never silently skipping.
   * No age detail is ever shown or spoken. */
  var BETA_SUBVERSION = '0.0.7.e.beta';
  var BRIEFING_GATE_MS = 10000;
  var PROJECT_START_ISO = '2026-10-22';
  function weeksSinceStart() {
    var t0 = Date.parse(PROJECT_START_ISO + 'T00:00:00+05:30');
    if (!(t0 > 0)) t0 = Date.parse(PROJECT_START_ISO);
    if (!(t0 > 0)) return 2;
    return Math.max(2, Math.floor((Date.now() - t0) / (7 * 86400000)));
  }
  /* v0.0.6.q Pillar 2 — the PARAGRAPH-1 COMPLETION GATE STATE: beat1Done is
     false until Paragraph 1 (Beat 1, idx === 0) has genuinely finished
     speaking its FINAL word; gateLeft is the 10-second minimum-listen gate
     that now starts ONLY when Stage 2 actually begins narrating (inside
     welcomeContinueToOverview), never on the Welcome splash. Both footer
     buttons stay disabled until beat1Done === true && gateLeft <= 0. */
  var briefingState = { open: false, directOpen: false, gateLeft: 10, idx: -1, timer: null, gateTimer: null, epoch: 0, seenGuideAfter: false, waitGesture: false, gestureArmed: false, wordTimers: [], flow: null, beat1Done: false, allBeatsDone: false, beat1Guard: null };
  /* {W} is replaced with the live weeksSinceStart() at render time, so the
     committed clip text and the spoken sentence stay in drift-check sync.
     v0.0.6.s Pillar 1 — the 100% AUTHENTIC FIRST-PERSON CREATOR OVERVIEW,
     in the creator's exact priority order with ZERO false claims: Beat 1 is
     written by Hansana himself ("I, Hansana", "on my own system" — never
     third-person); Beat 2 carries the free social mission for Sri Lanka and
     the never-for-money vow; Beat 3 states the TRUE A/L fact — he COMPLETED
     his A/Ls but did not take IT as a subject, then stabilized his IT
     knowledge within two months (never "without A/L"); Beat 4 closes with
     the strict-privacy / 100% E2EE (AES-GCM) law, the low-mobile-data
     engine, Lecturer Mode and the right-side Start Dictation handover. */
  var BRIEFING_SENTENCES = [
    "Welcome to Smart Dictation — a zero-cost ($0), one hundred percent open-source GitHub Pages web app system "
    + "that I, Hansana, started on October 22 ({W} weeks ago) and developed on my own system using autonomous AI "
    + "agents to test how far my critical thinking and problem-solving skills can go.",
    "I did not build this project merely to grow my own IT knowledge — my main goal is to do my utmost to give "
    + "something genuinely valuable to our society in Sri Lanka completely for free. Because one of the biggest "
    + "challenges in Sri Lanka is that people rarely reflect on themselves and their own potential, I started this "
    + "project with a positive mindset, and I will never seek money or profit from this work.",
    "Although I did not take IT as a subject for my A/Ls, after my A/Ls I researched resources and databases and "
    + "stabilized my IT knowledge to a strong level within two months. Using several of the world's largest "
    + "open-source databases, I hope to build open-source tools for Sri Lankan society to strongly support the "
    + "future of Sri Lanka's IT field — you can check my own tools on GitHub, including my Remote Desktop PC "
    + "(RDP) project, dedicated lab environment, and upcoming flagship IT project.",
    "This website is privacy-focused at its core: no personal data is ever shared, no unnecessary data is "
    + "collected, and every session review, feedback chat, and diagnostic report is one hundred percent "
    + "end-to-end encrypted (AES-GCM) so your privacy is completely safe. Engineered to run smoothly even on low "
    + "mobile data with live Lecturer Mode updates, tap Start Dictation on the right to open the step-by-step "
    + "user guide and begin your dictation session from Word #1!"
  ];
  function briefingSentence(i) {
    var n = Number(i);
    if (!(n >= 0) || n >= BRIEFING_SENTENCES.length) return '';
    return BRIEFING_SENTENCES[n].replace('{W}', String(weeksSinceStart()));
  }
  function briefingSentences() {
    var out = [], i;
    for (i = 0; i < BRIEFING_SENTENCES.length; i++) out.push(briefingSentence(i));
    return out;
  }
  function briefingWeekLabel() {
    var w = weeksSinceStart();
    return (lang === 'si') ? ('ඔක්තෝබර් 22 (සති ' + w + ') ආරම්භ විය') : ('Started ' + w + ' Weeks Ago (Oct 22)');
  }
  function paintBriefingPersona() {
    var persona = byId('briefingPersona');
    if (!persona) return false;
    /* v0.0.6.n Pillar 1: the compact single-line subtitle of the minimal
       2-line header — Started N Weeks Ago (Oct 22) · $0 Open-Source System. */
    persona.textContent = (lang === 'si')
      ? (briefingWeekLabel() + ' · $0 විවෘත-කේත පද්ධතිය')
      : (briefingWeekLabel() + ' · $0 Open-Source System');
    return true;
  }
  function briefingSeen() {
    var s = settings();
    /* v0.0.6.m law: the stamp is the RELEASE VERSION, never a boolean. Any
       device that saw an older build stored briefingSeen:1 — which no longer
       equals APP_VERSION — so 100% of devices (existing phones, PCs and
       brand-new visitors) replay the updated briefing the moment v0.0.6.m
       deploys. */
    return !!(s && s.briefingSeen === APP_VERSION);
  }
  function markBriefingSeen() {
    try { SDP.Data.saveSettings({ briefingSeen: APP_VERSION }); } catch (e) {}
    try { if (SDP.Diagnostics) SDP.Diagnostics.log('briefing_seen', { ver: APP_VERSION }); } catch (e) {}
  }
  /* ── v0.0.6.m: the frame-accurate karaoke clock ─────────────────────────
   * The v0.0.6.m word flow was a blind setTimeout ladder that drifted away
   * from the narrator. The v0.0.6.m law: the highlighted word is derived
   * from the REAL playback clock — audio.currentTime / audio.duration via
   * requestAnimationFrame (playUrl pumps hooks.onTick every frame), or
   * utterance onboundary(charIndex) on the Web Speech tier. The estimate
   * timer survives only as a last-resort stall guard for silent browsers. */
  var PUNCT_PAUSE_MS = { ',': 140, '\u2014': 180, '.': 240, ';': 160, ':': 160, '!': 220, '?': 220 };
  /* Word-by-word flow: every beat is tokenized into .b-word spans so the
     active sentence illuminates smoothly while the other beats stay
     readable for read-ahead and read-back. */
  function renderBriefingLyrics() {
    var host = byId('briefingLyrics');
    if (!host) return false;
    var html = '', i, j, words, k;
    for (i = 0; i < BRIEFING_SENTENCES.length; i++) {
      html += '<p class="b-line" data-bline="' + i + '">';
      words = briefingSentence(i).split(/\s+/);
      for (j = 0; j < words.length; j++) {
        if (!words[j]) continue;
        html += '<span class="b-word" data-bword="' + j + '">' + esc(words[j]) + '</span>' + (j < words.length - 1 ? ' ' : '');
      }
      html += '</p>';
    }
    host.innerHTML = html;
    return true;
  }
  function briefingLineNode(idx) {
    var host = byId('briefingLyrics');
    if (!host || !host.querySelector) return null;
    return host.querySelector('.b-line[data-bline="' + Number(idx) + '"]');
  }
  function wordPauseMs(token) {
    var t = str(token), extra = 0, i, c;
    for (i = 0; i < t.length; i++) {
      c = t.charAt(i);
      if (PUNCT_PAUSE_MS[c]) extra = Math.max(extra, PUNCT_PAUSE_MS[c]);
    }
    return extra;
  }
  /* Per-word timing weights: character/syllable length + trailing
     punctuation pauses. When the Studio's LLM script pass (Step A) stored
     per-word syllable weights on the synthesized clip entry (ww), those
     weights win — the AI-verified phrasing of the real British voice. */
  function briefingWordWeights(idx, line) {
    var out = [], i, words, entry, ww = null, list;
    try {
      var pack = SDP.Speech && SDP.Speech.clipManifest ? SDP.Speech.clipManifest() : null;
      entry = pack && pack.clips ? pack.clips['_intro_male_' + (Number(idx) + 1)] : null;
      if (entry && Array.isArray(entry.ww) && entry.ww.length) ww = entry.ww;
    } catch (e) { ww = null; }
    words = line.querySelectorAll('.b-word');
    for (i = 0; i < words.length; i++) {
      if (ww && i < ww.length && Number(ww[i]) > 0) { out.push(Math.max(1, Number(ww[i]))); continue; }
      out.push(Math.max(2, ((words[i].textContent || '').length + 2) + (wordPauseMs(words[i].textContent) / 24)));
    }
    return out;
  }
  /* v0.0.6.n Pillar 3 — the EXACT word timestamps: when the Studio
     synthesized the beat through the timestamped ElevenLabs TTS
     endpoint, the clip entry carries wt = [[startMs, endMs], …]
     aligned per word. Those absolute boundaries win over every estimate:
     the karaoke highlights the exact word being spoken right now. */
  function briefingWordTimings(idx) {
    var entry = null;
    try {
      var pack = SDP.Speech && SDP.Speech.clipManifest ? SDP.Speech.clipManifest() : null;
      entry = pack && pack.clips ? pack.clips['_intro_male_' + (Number(idx) + 1)] : null;
    } catch (e) { entry = null; }
    if (!entry || !Array.isArray(entry.wt) || !entry.wt.length) return null;
    var out = [], i, pair;
    for (i = 0; i < entry.wt.length; i++) {
      pair = entry.wt[i];
      if (!Array.isArray(pair) || !(Number(pair[0]) >= 0) || !(Number(pair[1]) > 0)) return null;
      out.push([Number(pair[0]), Number(pair[1])]);
    }
    return out;
  }
  /* Cumulative time slices: slice[i] = the fraction of the duration at which
     word i ENDS. The active word at time t is the first i with slice[i] > t. */
  function briefingTimeSlices(weights) {
    var total = 0, i, out = [], at = 0;
    for (i = 0; i < weights.length; i++) total += weights[i];
    if (!(total > 0)) return out;
    for (i = 0; i < weights.length; i++) { at += weights[i]; out.push(at / total); }
    return out;
  }
  function briefingFlowState() { return briefingState.flow; }
  function clearBriefingWordTimers() {
    var i;
    for (i = 0; i < briefingState.wordTimers.length; i++) {
      try { global.clearTimeout(briefingState.wordTimers[i]); } catch (e) {}
    }
    briefingState.wordTimers = [];
    var f = briefingState.flow;
    if (f) {
      if (f.raf && global.cancelAnimationFrame) { try { global.cancelAnimationFrame(f.raf); } catch (e) {} }
      if (f.estTimer) { try { global.clearInterval(f.estTimer); } catch (e) {} }
      f.raf = 0; f.estTimer = 0; f.active = false;
    }
  }
  function resetBriefingWords(idx) {
    var line = briefingLineNode(idx);
    if (!line) return false;
    var words = line.querySelectorAll('.b-word'), i;
    for (i = 0; i < words.length; i++) {
      if (words[i].classList) { words[i].classList.remove('is-spoken'); words[i].classList.remove('is-current'); }
    }
    return true;
  }
  function paintBriefingWordFlow(idx, wordIdx) {
    var line = briefingLineNode(idx);
    if (!line) return false;
    var words = line.querySelectorAll('.b-word'), i;
    for (i = 0; i < words.length; i++) {
      if (!words[i].classList) continue;
      if (i < wordIdx) { words[i].classList.add('is-spoken'); words[i].classList.remove('is-current'); }
      else if (i === wordIdx) { words[i].classList.add('is-spoken'); words[i].classList.add('is-current'); }
      else { words[i].classList.remove('is-spoken'); words[i].classList.remove('is-current'); }
    }
    return true;
  }
  /* Distribute the narration duration across the words. With no real clock
     available (silent browser) an estimate keeps the flow moving; the FIRST
     real clock tick or boundary event switches the flow to clock mode and
     cancels the estimate, so the words glide in musical lockstep with the
     actual voice. */
  /* v0.0.6.r Pillar 3: the briefing clips play at the crisp 1.12× broadcast
     cadence (SDP.Speech.playBriefingStep) — the estimate fallback timer runs
     on wall-clock time, so a real <audio> duration is divided by the rate to
     land the estimate when the clip actually ends. onBriefingClockTick stays
     in PURE media time (tSec vs durSec / wt) so LAB4b's curIdx === expect
     drift law keeps holding with 0 shift. */
  var BRIEFING_PLAY_RATE = 1.12;
  function startBriefingWordFlow(idx, durSec, epoch) {
    var line = briefingLineNode(idx);
    if (!line) return false;
    var words = line.querySelectorAll('.b-word');
    if (!words.length) return false;
    var weights = briefingWordWeights(idx, line);
    var slices = briefingTimeSlices(weights);
    if (!slices.length) return false;
    var dur = Number(durSec);
    if (dur > 0) {
      /* a real reported duration is media time — scale it to wall-clock by
         the playback rate for the estimate timer (the real clock ticks in
         media time and is never shifted). */
      dur = dur / BRIEFING_PLAY_RATE;
    } else {
      var total = 0, w;
      for (w = 0; w < weights.length; w++) total += weights[w];
      dur = (words.length * 0.36) + (total * 0.012);
    }
    dur = Math.max(1200, Math.min(90000, dur * 1000));
    clearBriefingWordTimers();
    /* v0.0.6.n: wt (exact /with-timestamps word boundaries) takes absolute
       precedence — the flow paints from the real clip clock against the
       ElevenLabs alignment, falling back to weighted slices only without it. */
    var wt = briefingWordTimings(idx);
    briefingState.flow = { idx: idx, epoch: epoch, durMs: dur, slices: slices, mode: 'estimate', active: true, raf: 0, estTimer: 0, lastWord: -1, startedAt: 0, wt: wt };
    /* Estimate mode: a 100 ms self-advancing tick — smooth, and instantly
       replaced by the real clock on the first onTick / onBoundary. */
    var f = briefingState.flow;
    f.startedAt = Date.now();
    f.estTimer = global.setInterval(function () {
      if (!f.active || !briefingState.open || epoch !== briefingState.epoch) { clearBriefingWordTimers(); return; }
      if (f.mode !== 'estimate') return;
      paintBriefingClockAt((Date.now() - f.startedAt) / f.durMs, f);
    }, 100);
    return true;
  }
  /* The shared painter: frac is the fraction of the narration (0..1). */
  function paintBriefingClockAt(frac, f) {
    if (!f || !f.active) return false;
    frac = Math.max(0, Math.min(1.0001, Number(frac) || 0));
    var i, wordIdx = f.slices.length - 1;
    for (i = 0; i < f.slices.length; i++) { if (f.slices[i] > frac) { wordIdx = i; break; } }
    /* v0.0.6.n Pillar 3: the bar advances CONTINUOUSLY across all four
       beats — (beatIndex + inBeatFraction) / 4 — instead of jumping in
       quarter-steps at each beat boundary. */
    paintBriefingContinuousBar(f.idx, frac);
    if (wordIdx === f.lastWord) return true;
    f.lastWord = wordIdx;
    paintBriefingWordFlow(f.idx, wordIdx);
    return true;
  }
  /* Continuous 0..100% across Beat 1 → Beat 4: the narration is one song,
     the progress bar tracks it word by word like an Apple Music scrubber. */
  function paintBriefingContinuousBar(beatIdx, frac) {
    var bar = byId('briefingBar');
    if (!bar) return false;
    var total = BRIEFING_SENTENCES.length || 4;
    var pct = ((Number(beatIdx) || 0) + Math.max(0, Math.min(1, Number(frac) || 0))) / total * 100;
    bar.style.width = (Math.max(0, Math.min(100, pct))).toFixed(2) + '%';
    return true;
  }
  /* Real clock tick from the playing <audio> element (currentTime/duration,
     pumped per animation frame by SDP.Speech.playBriefingStep). */
  function onBriefingClockTick(idx, epoch, tSec, durSec) {
    var f = briefingFlowState();
    if (!f || !f.active || f.idx !== Number(idx) || epoch !== briefingState.epoch) return false;
    if (!(Number(tSec) >= 0)) return false;
    if (f.mode !== 'clock') {
      f.mode = 'clock';
      if (f.estTimer) { try { global.clearInterval(f.estTimer); } catch (e) {} f.estTimer = 0; }
    }
    var d = Number(durSec) || (f.durMs / 1000);
    if (!(d > 0)) d = f.durMs / 1000;
    var tMs = Math.max(0, Number(tSec)) * 1000;
    /* v0.0.6.n: with wt (the /with-timestamps alignment) the current word
       is the exact word whose [startMs, endMs] window spans the real clock
       — frame-accurate karaoke straight from the studio synthesis. */
    if (f.wt && f.wt.length) {
      var wi, hit = f.wt.length - 1;
      for (wi = 0; wi < f.wt.length; wi++) { if (tMs < f.wt[wi][1]) { hit = wi; break; } }
      var endMs = f.wt[f.wt.length - 1][1];
      paintBriefingContinuousBar(f.idx, endMs > 0 ? Math.min(1, tMs / endMs) : 0);
      if (hit !== f.lastWord) {
        f.lastWord = hit;
        paintBriefingWordFlow(f.idx, hit);
      }
      return true;
    }
    paintBriefingClockAt(Math.max(0, Number(tSec)) / d, f);
    return true;
  }
  /* Web Speech tier: onboundary(charIndex) maps the spoken char position to
     the word index, so device synthesis is karaoke-synced too. */
  function onBriefingBoundary(idx, epoch, charIndex) {
    var f = briefingFlowState();
    if (!f || !f.active || f.idx !== Number(idx) || epoch !== briefingState.epoch) return false;
    var line = briefingLineNode(idx);
    if (!line) return false;
    var words = line.querySelectorAll('.b-word');
    if (!words.length) return false;
    if (f.mode !== 'clock') {
      f.mode = 'clock';
      if (f.estTimer) { try { global.clearInterval(f.estTimer); } catch (e) {} f.estTimer = 0; }
    }
    var ci = Math.max(0, Number(charIndex) || 0), text = briefingSentence(idx), pos = 0, i, tok;
    var tokens = [];
    for (i = 0; i < words.length; i++) { tok = str(words[i].textContent); tokens.push(tok); }
    /* Walk the tokens accumulating their start offsets in the sentence. */
    var search = 0, wordIdx = tokens.length - 1;
    for (i = 0; i < tokens.length; i++) {
      pos = text.indexOf(tokens[i], search);
      if (pos < 0) { search += 0; continue; }
      if (ci <= pos + tokens[i].length) { wordIdx = i; break; }
      search = pos + tokens[i].length;
    }
    if (wordIdx !== f.lastWord) {
      f.lastWord = wordIdx;
      paintBriefingWordFlow(idx, wordIdx);
    }
    return true;
  }
  function paintBriefingLine(idx) {
    var host = byId('briefingLyrics');
    if (!host) return false;
    var lines = host.querySelectorAll('.b-line'), i, node;
    for (i = 0; i < lines.length; i++) {
      node = lines[i];
      if (node.classList) {
        node.classList.remove('on');
        if (i < idx) { node.setAttribute('data-state', 'past'); node.style.opacity = '0.45'; }
        else if (i === idx) { node.setAttribute('data-state', 'on'); node.classList.add('on'); node.style.opacity = ''; }
        else { node.setAttribute('data-state', 'next'); node.style.opacity = '0.72'; }
      }
    }
    var bar = byId('briefingBar');
    if (bar) bar.style.width = (Math.round(((idx + 1) / BRIEFING_SENTENCES.length) * 100)) + '%';
    var active = host.querySelector('.b-line.on');
    /* v0.0.6.n Pillar 1 — the NO-YANK auto-centering law: the stage only
       scrolls when the active beat is genuinely OUT of the visible band.
       Beat 1 LIVES at the very top of the stage and is never scrolled away
       from, so the Project Overview always opens readable from word one.
       (In v0.0.6.m the unconditional offsetTop-centre scroll dragged Beat 1
       and Beat 2 off-screen the moment the narration started.) */
    if (active && host.scrollTo && idx > 0) {
      try {
        var top = active.offsetTop, bot = top + active.offsetHeight;
        var view0 = host.scrollTop, view1 = host.scrollTop + host.clientHeight;
        var hidden = (top < view0 + 8) || (bot > view1 - 8);
        if (hidden) {
          host.scrollTo({ top: Math.max(0, top - host.clientHeight * 0.30), behavior: 'smooth' });
        }
      } catch (e) {}
    }
    return true;
  }
  function briefingShowTapPill() {
    briefingState.waitGesture = true;
    var pill = byId('briefingTapPill');
    if (pill) pill.hidden = false;
    try { if (SDP.Diagnostics) SDP.Diagnostics.log('briefing_autoplay_wait', { ver: APP_VERSION }); } catch (e) {}
    return true;
  }
  function briefingHideTapPill() {
    var pill = byId('briefingTapPill');
    if (pill) pill.hidden = true;
  }
  /* The very first tap anywhere on the briefing modal (fresh Chrome, sticky
     autoplay block) restarts the narration from the current beat with the
     gesture-activated audio. */
  function briefingGestureUnlock() {
    if (!briefingState.open || !briefingState.waitGesture) return false;
    briefingState.waitGesture = false;
    briefingState.gestureArmed = true;
    briefingHideTapPill();
    try { if (SDP.Diagnostics) SDP.Diagnostics.log('briefing_gesture_unlock', { idx: briefingState.idx }); } catch (e) {}
    var idx = (briefingState.idx >= 0) ? briefingState.idx : 0;
    briefingState.epoch += 1;
    /* v0.0.6.q Pillar 2: the gate clock restarts with the re-armed narration
       (the tap pill held the beat, so the held seconds cannot count against
       the 10-second minimum) and the Paragraph-1 lock stays engaged until
       this fresh narration genuinely finishes Beat 1's final word. */
    if (briefingState.gateTimer) { global.clearInterval(briefingState.gateTimer); briefingState.gateTimer = null; }
    briefingState.gateLeft = Math.max(1, Math.round(BRIEFING_GATE_MS / 1000));
    if (briefingState.beat1Guard) { global.clearTimeout(briefingState.beat1Guard); briefingState.beat1Guard = null; }
    /* v0.0.6.t Pillar 2: the dead-browser safety ceiling is 25 s — it force-
       arms ONLY beat1Done (Paragraph 1 completion) so a headless/broken
       browser whose audio never fires onended can never trap a student
       behind the gate, while a healthy playback always finishes Beat 1's
       final word first (the re-armed beat takes ~11–19 s). Paragraphs 2–4
       keep narrating afterwards; allBeatsDone stays a telemetry-only latch
       inside briefingFinishNarration(). */
    briefingState.beat1Guard = global.setTimeout(function () {
      if (!briefingState.open || briefingState.beat1Done) return;
      briefingState.beat1Done = true;
      briefingCheckGateUnlock();
    }, 9000);
    briefingState.gateTimer = global.setInterval(briefingTickGate, 1000);
    briefingNarrate(idx, briefingState.epoch);
    return true;
  }
  /* ── v0.0.6.o Pillar 1 — the TWO-STAGE CINEMATIC ENTRY ──────────────────
   * Stage 1 (#welcomeStage): the animated "Welcome to Smart Dictation Web
   * App" splash. Stage 2 (#briefingStage): the Project Overview. The
   * Continue click is the ONE gesture that unlocks autoplay: audio is primed
   * inside the synchronous click handler, so Paragraph 1 starts speaking
   * from Word 1 the moment the 320ms transition lands — the beat can never
   * be skipped by a NotAllowedError race. */
  function welcomePrimeAudioInGesture() {
    /* Inside the click gesture: unmute + full volume on the SHARED element
       (properties only), plus a DISPOSABLE silent element that primes the
       document's user activation, and a silent resume of speechSynthesis so
       Chrome/Safari consider the session user-activated BEFORE Paragraph 1
       calls play().
       v0.0.6.u Fix 1A: the old in-gesture sharedAudio().play() left an
       asynchronous play().then(pause()) attached to the very element
       playBriefingStep(0) re-uses 410 ms later — on a cold browser that
       promise could settle (or an 'ended'/'error' from the prime could
       fire) AFTER Paragraph 1's clip had already started, cutting it off
       and advancing narration to Paragraph 2. The prime now runs on its
       own throw-away <audio> that is paused and emptied the instant it
       starts, so sharedAudio() stays completely untouched until
       playBriefingStep owns it. */
    try {
      var el = byId('sdpSharedAudio');
      if (!el && SDP.Speech && SDP.Speech.sharedAudioElement) el = SDP.Speech.sharedAudioElement();
      if (el) {
        el.muted = false;
        el.volume = 1.0;
      }
    } catch (e0) {}
    try {
      if (doc && doc.createElement) {
        var prime = doc.createElement('audio');
        prime.preload = 'auto';
        prime.setAttribute('playsinline', 'playsinline');
        /* A real, instantly-loadable 44-byte silent WAV media source. */
        prime.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        var p = prime.play();
        if (p && typeof p.then === 'function') {
          p.then(function () {
            try { prime.pause(); prime.removeAttribute('src'); prime.load(); } catch (e1) {}
          }, function () {
            try { prime.pause(); prime.removeAttribute('src'); prime.load(); } catch (e2) {}
          });
        }
      }
    } catch (e3) {}
    try {
      if (global.speechSynthesis) {
        try { global.speechSynthesis.resume(); } catch (e1) {}
        try { global.speechSynthesis.getVoices(); } catch (e2) {}
      }
    } catch (e4) {}
  }
  function welcomeStageVisible() {
    var w = byId('welcomeStage');
    return !!(w && w.hidden === false);
  }
  function welcomeShowStage() {
    var w = byId('welcomeStage'), b = byId('briefingStage');
    if (!w || !b) return false;
    if (w.classList) { w.classList.remove('is-leaving'); w.classList.remove('is-entering'); }
    if (b.classList) b.classList.remove('is-entering');
    w.hidden = false;
    b.hidden = true;
    return true;
  }
  function welcomeContinueToOverview() {
    var w = byId('welcomeStage'), b = byId('briefingStage');
    if (!w || !b || w.hidden) return false;
    /* THE LAW: the audio unlock happens INSIDE this synchronous click
       handler, before any transition timer, so the browser counts a real
       user gesture for every later play()/speak(). */
    welcomePrimeAudioInGesture();
    briefingState.gestureArmed = true;
    briefingState.waitGesture = false;
    if (w.classList) w.classList.add('is-leaving');
    var epoch = briefingState.epoch;
    global.setTimeout(function () {
      w.hidden = true;
      if (w.classList) w.classList.remove('is-leaving');
      b.hidden = false;
      if (b.classList) b.classList.add('is-entering');
      global.setTimeout(function () { if (b.classList) b.classList.remove('is-entering'); }, 360);
      /* Stage 2 opens at the very top and narration starts STRICTLY at
         Paragraph 1, Word 1 (idx === 0) — epoch-locked so no stale callback
         from the welcome stage can ever skip Paragraph 1. */
      briefingResetStageTop();
      briefingState.idx = -1;
      /* v0.0.6.q Pillar 2, Rule A — the 10-second gate timer starts HERE,
         the exact moment Stage 2 (#briefingStage) is revealed and Paragraph 1
         begins — NEVER on the Welcome splash. In v0.0.6.p openBriefing()
         armed this interval while #welcomeStage was still on screen, so
         seconds silently burned before the user ever clicked Continue. */
      if (briefingState.gateTimer) global.clearInterval(briefingState.gateTimer);
      briefingState.gateTimer = global.setInterval(briefingTickGate, 1000);
      /* v0.0.6.t Pillar 2 — the 25-second safety ceiling: if browser audio is
         completely dead or the tab is throttled, beat1Done is force-armed so
         a broken environment can never trap a student behind the Paragraph-1
         gate for ever. A healthy playback always finishes Beat 1's final word
         (~11–19 s) well inside it; Paragraphs 2–4 then keep narrating and
         allBeatsDone latches only in briefingFinishNarration (telemetry). */
      if (briefingState.beat1Guard) global.clearTimeout(briefingState.beat1Guard);
      briefingState.beat1Guard = global.setTimeout(function () {
        if (!briefingState.open || epoch !== briefingState.epoch) return;
        if (briefingState.beat1Done) return;
        briefingState.beat1Done = true;
        briefingCheckGateUnlock();
      }, 9000);
      global.setTimeout(function () {
        if (!briefingState.open || epoch !== briefingState.epoch) return;
        briefingNarrate(0, epoch);
      }, 90);
    }, 320);
    try { if (SDP.Diagnostics) SDP.Diagnostics.log('welcome_continue', { ver: APP_VERSION }); } catch (e) {}
    return true;
  }
  /* v0.0.6.q Pillar 2 — the ANTI-7-SECOND MINIMUM-DWELL LAW. In v0.0.6.o the
     four _intro_male clips were missing, so speechSynthesis (0 voices on
     Android/iOS) fired onerror/onend instantly; with gestureArmed already
     true, every beat advanced in ~320 ms and the whole briefing silently
     auto-scrolled to the bottom in ~7 seconds without a single spoken word.
     The law: a paragraph may NEVER advance in under 1.8 s, and in the
     absence of a real clock it paces over its natural reading duration —
     the SAME estimate the karaoke flow uses — so a muted or failed clip
     still reads at a human pace. Real playback (clip 'ended' / utterance
     onend) always wins when it takes longer; the dwell is only a floor. */
  function briefingEstimateDurMs(text) {
    var words = str(text).split(/\s+/);
    var total = 0, i, w;
    for (i = 0; i < words.length; i++) {
      w = Math.max(2, (words[i].length + 2) + (wordPauseMs(words[i]) / 24));
      total += w;
    }
    return Math.max(1200, Math.min(90000, ((words.length * 0.36) + (total * 0.012)) * 1000));
  }
  function briefingNarrate(idx, epoch) {
    if (!briefingState.open || epoch !== briefingState.epoch) return;
    if (idx >= BRIEFING_SENTENCES.length) { briefingFinishNarration(epoch); return; }
    briefingState.idx = idx;
    paintBriefingLine(idx);
    clearBriefingWordTimers();
    resetBriefingWords(idx);
    var text = briefingSentence(idx);
    var advanced = false;
    /* v0.0.6.q: the beat clock starts NOW; next() may not fire before the
       minimum dwell (>= 1.8 s) has fully elapsed. A REAL clip's own 'ended'
       event already enforces its natural spoken duration, so once a real
       duration is reported only the 1.8 s anti-race floor applies; without
       real audio (muted device, dead TTS) the beat paces over the natural
       reading estimate so a silent browser can never flash-scroll. */
    var startedAt = Date.now();
    var realDurMs = 0;
    var dwellMs = function () {
      if (realDurMs > 0) return 1800;
      return Math.max(1800, briefingEstimateDurMs(text));
    };
    /* v0.0.6.o Pillar 3 — THE ZERO CUT-OFF LAW: the fallback guard may only
       advance the beat when NOTHING is genuinely still speaking. While the
       shared <audio> element is playing (paused === false, ended === false,
       currentTime > 0) the guard is re-armed, because the ONLY legitimate
       finish of a beat is the element's real 'ended' event (or the Web
       Speech onend). The final words of a paragraph can never be clipped. */
    var audioStillSpeaking = function () {
      try {
        var el = byId('sdpSharedAudio');
        if (!el) return false;
        if (el.paused || el.ended) return false;
        var ct = Number(el.currentTime) || 0;
        if (ct <= 0) return false;
        /* v0.0.6.q liveness law: an element parked at its own end (a missed
           'ended' event, a throttled background tab, a stalled media source)
           is NOT still speaking — otherwise the guard below would re-arm for
           ever and the briefing would freeze on one paragraph. */
        var dur = Number(el.duration);
        if (isFinite(dur) && dur > 0 && ct >= dur - 0.15) return false;
        return true;
      } catch (e) { return false; }
    };
    var next = function () {
      if (advanced || epoch !== briefingState.epoch) return;
      /* The minimum-dwell floor: however the beat reports completion (real
         'ended', silent TTS failure, autoplay-block fallthrough), the
         paragraph holds until its natural duration has elapsed. */
      var wait = Math.max(0, dwellMs() - (Date.now() - startedAt));
      /* v0.0.6.q: the OPENING beat keeps a longer 2.6 s floor. Paragraph 1 is
         the longest beat (~600 chars / 79 words) and it is painted the instant
         Stage 2 appears while the welcome cross-fade is still settling, so on a
         slow phone ~0.6 s can pass before the paragraph is actually on screen.
         The extra hold guarantees the user truly SEES beat 1 held before beat 2
         arrives; it can never delay a real clip, because wait() is already zero
         once a real duration has elapsed — this is a floor, never a delay. */
      if (idx === 0) wait = Math.max(wait, 2600 - (Date.now() - startedAt));
      global.setTimeout(function advanceBeat() {
        if (advanced || epoch !== briefingState.epoch) return;
        /* v0.0.6.u Fix 1C — the HARD PARAGRAPH-1 MINIMUM PLAYBACK GUARD.
           Paragraph 1 may NEVER advance to Paragraph 2 after a phantom
           completion: if the beat reported done WITHOUT the real MP3 clip
           ever starting (realStarted false — the cold-browser Tier-2
           fallback, an onerror from a cancelled utterance, a stalled
           element), the beat either gets ONE retry the moment the real
           _intro_male_1 clip is actually available, or it holds the
           remaining natural time up to a hard 8-second floor. A genuine
           clip (realStarted, 'ended' owns the pacing) and the test-suite
           FAST stubs (a reported duration 0 < d < 6 s) are exempt, so the
           lab gates keep their fast beats. */
        if (idx === 0 && !realStarted && !(realDurMs > 0 && realDurMs < 6000)) {
          var beatReady = false;
          try { beatReady = !!(SDP.Speech && SDP.Speech.briefingClipReady && SDP.Speech.briefingClipReady(0)); } catch (eR) {}
          if (beatReady && speakTried < 2) { speakBeat(); return; }
          var beatMs = Date.now() - startedAt;
          if (beatMs < 8000) { global.setTimeout(advanceBeat, Math.max(120, 8000 - beatMs)); return; }
        }
        advanced = true;
        /* v0.0.6.q Pillar 2, Rule B — the PARAGRAPH-1 COMPLETION LAW: the
           instant Beat 1 (idx === 0) has finished speaking its final word and
           the narration advances to Beat 2, beat1Done latches true. v0.0.6.t:
           the creator restored the Paragraph-1 unlock — the instant Beat 1
           completes, briefingCheckGateUnlock() runs so #btnBriefingSkip (Exit)
           and #btnBriefingContinue (▶ Start Dictation →) unlock the moment
           gateLeft <= 0 too, while Paragraphs 2–4 keep narrating in order
           with dark-ink karaoke unless/until the user exits. */
        if (idx === 0) {
          briefingState.beat1Done = true;
          briefingCheckGateUnlock();
        } else {
          paintBriefingCtaLabel();
        }
        /* Hold the final word highlighted (wordIdx = last) through a natural
           320ms inter-paragraph breathing pause after 'ended' fires, so the
           user SEES the last word spoken cleanly before the next paragraph. */
        global.setTimeout(function () { briefingNarrate(idx + 1, epoch); }, 320);
      }, wait);
    };
    /* The speech layer always calls back (clip, device voice or watchdog);
       the parallel estimate timer is only a last-resort stall guard — and it
       stands down whenever real audio/utterance playback is in flight. */
    var guardMs = 2200 + (text.length * 95);
    var guardPushes = 0;
    var guard = global.setTimeout(function runner() {
      if (advanced || epoch !== briefingState.epoch) return;
      if (audioStillSpeaking() && guardPushes < 15) {
        /* Real playback in flight: push the guard back 800ms and keep
           pushing while the element is still speaking. Never cut it off —
           but never re-arm for ever either (15 pushes = 12 s past the
           estimate); a truthful duration always ends the beat first. */
        guardPushes += 1;
        guard = global.setTimeout(runner, 800);
        return;
      }
      next();
    }, guardMs);
    var realNext = function () { global.clearTimeout(guard); next(); };
    var flowStarted = false;
    var startFlow = function (durSec) {
      if (flowStarted || !briefingState.open || epoch !== briefingState.epoch) return;
      flowStarted = true;
      /* A real reported duration means real audio is playing — the clip's
         'ended' event owns the natural pacing from here on. */
      if (Number(durSec) > 0) realDurMs = Math.round(Number(durSec) * 1000);
      startBriefingWordFlow(idx, durSec, epoch);
    };
    /* v0.0.6.u Fix 1C: the beat's speech attempt is a callable (max 2 tries)
       so the Paragraph-1 hard guard can hand the REAL clip one more chance
       the moment the cold-browser manifest finally arrives. realStarted
       latches only on the clip's genuine 'playing' signal (onStarted). */
    var realStarted = false;
    var speakTried = 0;
    var speakBeat = function () {
      if (advanced || epoch !== briefingState.epoch || !briefingState.open) return;
      speakTried += 1;
      try {
        if (SDP.Speech && SDP.Speech.playBriefingStep) {
          SDP.Speech.playBriefingStep(idx, text, function (res) {
            if (epoch !== briefingState.epoch) return;
            /* Fresh-Chrome autoplay handshake: the browser blocked the audio
               (NotAllowedError / zero voices) — HOLD this beat behind the tap
               pill instead of skipping it silently. After the user's first
               gesture we never hold again (estimate flow keeps it moving). */
            if (res && res.autoplayBlocked && !briefingState.gestureArmed) {
              global.clearTimeout(guard);
              briefingShowTapPill();
              return;
            }
            realNext();
          }, {
            onStarted: function () { realStarted = true; briefingHideTapPill(); },
            onDuration: function (durSec) { startFlow(durSec); },
            /* v0.0.6.m: the frame-accurate clock — every real playback frame
               (audio.currentTime / audio.duration) and every Web Speech
               boundary event repaints the karaoke directly from the voice. */
            onTick: function (tSec, durSec) {
              /* v0.0.6.s: a media element that re-uses the same URL (the lab
                 fixture, a cached blob) may never re-fire loadedmetadata, so
                 the REAL duration also latches from the playback clock — the
                 natural pacing then follows the actual clip, never the
                 natural-reading estimate. */
              if (!realDurMs && Number(durSec) > 0) realDurMs = Math.round(Number(durSec) * 1000);
              onBriefingClockTick(idx, epoch, tSec, durSec);
            },
            onBoundary: function (charIndex) { onBriefingBoundary(idx, epoch, charIndex); }
          });
          /* If neither the clip duration nor a rejection arrives (silent
             browser), an estimate keeps the karaoke flowing gracefully. */
          global.setTimeout(function () { if (flowStarted || epoch !== briefingState.epoch || !briefingState.open) return; startFlow(0); }, 1100);
        } else {
          startFlow(0);
          realNext();
        }
      } catch (e) { startFlow(0); realNext(); }
    };
    speakBeat();
  }
  function briefingFinishNarration(epoch) {
    if (epoch !== briefingState.epoch) return;
    paintBriefingLine(BRIEFING_SENTENCES.length - 1);
    var bar = byId('briefingBar');
    if (bar) bar.style.width = '100%';
    var i;
    for (i = 0; i < BRIEFING_SENTENCES.length; i++) paintBriefingWordFlow(i, 9999);
    /* v0.0.6.t Pillar 2 — the whole-briefing TELEMETRY latch: allBeatsDone
       turns true the instant Paragraph 4 finishes its very last word. It no
       longer holds the buttons (the Paragraph-1 unlock owns that); it stays
       exported via briefingAllBeatsDone() for the lab + diagnostics so the
       full-completion rate of the Project Briefing can still be measured. */
    briefingState.beat1Done = true;
    briefingState.allBeatsDone = true;
    briefingCheckGateUnlock();
    briefingResetStageTop();
  }
  /* v0.0.6.n Pillar 1: the hard top-reset — overrides the CSS smooth-scroll,
     zeroes scrollTop synchronously and re-asserts on the next frame so a
     late focus() or reflow can never leave the stage scrolled (the 360x800
     8px-drift bug this replaces). */
  function briefingResetStageTop() {
    var stage = byId('briefingLyrics');
    if (!stage) return false;
    try {
      stage.style.scrollBehavior = 'auto';
      stage.scrollTop = 0;
      var raf = global.requestAnimationFrame
        ? function (fn) { return global.requestAnimationFrame(fn); }
        : function (fn) { return global.setTimeout(fn, 16); };
      raf(function () {
        try { stage.scrollTop = 0; } catch (e1) {}
        try { stage.style.scrollBehavior = ''; } catch (e2) {}
      });
    } catch (e0) {}
    return true;
  }
  function briefingTickGate() {
    if (!briefingState.open) return;
    if (briefingState.gateLeft > 0) {
      briefingState.gateLeft -= 1;
      var count = byId('briefingCount');
      if (count && briefingState.gateLeft > 0) {
        count.textContent = t('briefingCountdown', 'Please listen / read ({n}s)…').replace('{n}', String(briefingState.gateLeft));
      }
      /* v0.0.6.n Pillar 1: the visible countdown lives INSIDE the Continue
         button label — never a separate bulky yellow box stealing stage height. */
      paintBriefingCtaLabel();
      if (briefingState.gateLeft > 0) return;
    }
    /* v0.0.6.q: the gate matured — but the unlock also needs Paragraph 1 to
       have finished speaking (beat1Done). briefingCheckGateUnlock holds the
       lock and keeps the label honest until both conditions are true. */
    briefingCheckGateUnlock();
  }
  function paintBriefingCtaLabel() {
    var cont = byId('btnBriefingContinue');
    if (!cont) return false;
    /* v0.0.6.t Pillar 2: the RIGHT-side CTA carries the live gate state —
       the 10-second countdown while gateLeft > 0, the Paragraph-1 finishing
       note while the beat is still speaking its final words, and the glowing
       ▶ Start Dictation → the instant gateLeft <= 0 && beat1Done === true
       (Paragraphs 2–4 keep narrating freely after the unlock). */
    if (briefingState.gateLeft > 0) {
      cont.textContent = t('briefingContinueWait', 'Start Dictation ({n}s)…').replace('{n}', String(briefingState.gateLeft));
    } else if (!briefingState.beat1Done) {
      cont.textContent = t('briefingContinueBeat1', 'Start Dictation (finishing Paragraph 1…)');
    } else {
      cont.textContent = t('briefingContinue', '▶ Start Dictation →');
    }
    return true;
  }
  /* v0.0.6.t Pillar 2 — the PARAGRAPH-1 COMPLETION GATE. Both
     #btnBriefingContinue (▶ Start Dictation →) and #btnBriefingSkip (Exit)
     unlock as soon as the 10-second minimum gate has fully elapsed
     (gateLeft <= 0) AND Paragraph 1 has finished speaking its final word
     (beat1Done, latched inside briefingNarrate's next() at idx === 0).
     Paragraphs 2–4 continue narrating smoothly in order with dark-ink
     karaoke highlighting unless/until the user clicks Exit or
     ▶ Start Dictation →. */
  function briefingCheckGateUnlock() {
    if (!briefingState.open) return false;
    if (briefingState.gateLeft > 0 || !briefingState.beat1Done) {
      paintBriefingCtaLabel();
      return false;
    }
    if (briefingState.gateTimer) { global.clearInterval(briefingState.gateTimer); briefingState.gateTimer = null; }
    if (briefingState.beat1Guard) { global.clearTimeout(briefingState.beat1Guard); briefingState.beat1Guard = null; }
    var cont = byId('btnBriefingContinue'), skip = byId('btnBriefingSkip'), cnt = byId('briefingCount'), card = byId('briefingModal');
    if (cont) { cont.disabled = false; cont.removeAttribute('aria-disabled'); }
    if (skip) { skip.disabled = false; skip.removeAttribute('aria-disabled'); }
    if (card && card.classList) card.classList.add('b-gate-open');
    paintBriefingCtaLabel();
    if (cnt) cnt.textContent = t('briefingUnlocked', 'Thank you for listening — continue whenever you are ready.');
    return true;
  }
  function openBriefing(opts) {
    opts = opts || {};
    var modal = byId('briefingModal');
    if (!modal) return false;
    if (briefingState.open && !opts.replay) return true;
    /* v0.0.6.w — the ON-DEMAND SETTINGS LAW: opening the briefing from the
       Settings › About Project Briefing button (#btnCreatorNote) or any
       explicit replay skips the intermediate Welcome splash entirely and
       lands DIRECTLY on #briefingStage, because that click is already a real
       user gesture that unlocked browser audio. All three exits unlock at
       once (no countdown) and Paragraph 1 narrates from Word 1. */
    var direct = !!(opts.fromSettings || (opts.replay && !opts.fromBoot && opts.welcome !== true));
    briefingState.directOpen = direct;
    briefingState.open = true;
    briefingState.epoch += 1;
    briefingState.idx = -1;
    briefingState.waitGesture = false;
    /* v0.0.6.q Pillar 2: every open re-arms the Paragraph-1 completion lock —
       beat1Done is false and the gate countdown is at its full 10 seconds, so
       BOTH footer buttons stay disabled until Stage 2's narration has
       finished Paragraph 1's final word AND the minimum-listen gate has
       matured. allBeatsDone re-arms as the telemetry-only whole-briefing
       latch (v0.0.6.t: it never holds the buttons). */
    briefingState.gateLeft = Math.max(1, Math.round(BRIEFING_GATE_MS / 1000));
    briefingState.beat1Done = false;
    briefingState.allBeatsDone = false;
    if (briefingState.gateTimer) { global.clearInterval(briefingState.gateTimer); briefingState.gateTimer = null; }
    if (briefingState.beat1Guard) { global.clearTimeout(briefingState.beat1Guard); briefingState.beat1Guard = null; }
    paintBriefingPersona();
    renderBriefingLyrics();
    paintBriefingLine(-1);
    briefingHideTapPill();
    var bar = byId('briefingBar');
    if (bar) bar.style.width = '0%';
    var cont = byId('btnBriefingContinue'), skip = byId('btnBriefingSkip'), count = byId('briefingCount');
    if (direct) {
      /* On-demand from Settings: every exit is unlocked the instant the modal
         opens — the user may listen to the full developer story or close it
         at any moment without waiting for a countdown. */
      if (cont) { cont.disabled = false; cont.removeAttribute('aria-disabled'); }
      if (skip) { skip.disabled = false; skip.removeAttribute('aria-disabled'); }
      if (count) count.textContent = t('briefingUnlocked', 'Developer Overview — playing · close anytime.');
    } else {
      if (cont) { cont.disabled = true; cont.setAttribute('aria-disabled', 'true'); }
      if (skip) { skip.disabled = true; skip.setAttribute('aria-disabled', 'true'); }
      if (count) count.textContent = t('briefingCountdown', 'Please listen / read ({n}s)…').replace('{n}', String(briefingState.gateLeft));
    }
    paintBriefingCtaLabel();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    if (modal.classList) { modal.classList.remove('hidden'); modal.classList.add('is-open'); }
    if (modal.classList) modal.classList.remove('b-gate-open');
    /* v0.0.6.n Pillar 1 — the ALWAYS-START-AT-BEAT-1 law: the reading stage
       is scrolled to the very top and Beat 1 / Word 1 are highlighted the
       instant the modal opens, so the Project Overview is ALWAYS read from
       the beginning — never mid-way through Beat 3 or 4. The reset overrides
       the CSS smooth-scroll behaviour and re-asserts on the next frame, so
       no late focus/reflow can nudge the stage off zero. */
    briefingResetStageTop();
    /* v0.0.6.q Pillar 2 — the ALWAYS-STAGE-1 law: EVERY open of the Project
       Briefing — automatic first-visit boot, version-upgrade replay, the
       About-card Project Briefing button, the Beta channel — begins at
       Stage 1 (#welcomeStage): the animated "Welcome to Smart Dictation Web
       App" splash with the Continue to Project Overview → gesture that
       unlocks browser audio. The v0.0.6.o replay path that jumped straight
       to the reading stage is retired; the user ALWAYS sees the Welcome
       first, exactly as the creator demanded. */
    if (direct) {
      /* v0.0.6.w: the Settings path reveals #briefingStage at once — the
         #welcomeStage splash stays hidden — and narration begins from
         Paragraph 1, Word 1 inside the already-unlocked click gesture. */
      var wD = byId('welcomeStage'), bD = byId('briefingStage');
      if (wD) wD.hidden = true;
      if (bD) bD.hidden = false;
      briefingState.gateLeft = 0;
      briefingState.beat1Done = true;
      briefingState.gestureArmed = true;
      briefingState.waitGesture = false;
      briefingCheckGateUnlock();
      global.setTimeout(function () {
        if (!briefingState.open) return;
        briefingState.idx = -1;
        briefingNarrate(0, briefingState.epoch);
      }, 90);
    } else {
      welcomeShowStage();
    }
    /* v0.0.6.u Fix 5A — the WELCOME-STAGE PRE-WARM: the moment the Welcome
       splash is on screen, loadManifest() is kicked in the background and
       _intro_male_1's base64 is decoded into its memoized Blob URL, so the
       Continue click starts Paragraph 1 with 0 ms decode latency — even on
       a cold browser the 3.8 MB pack download overlaps with the user
       reading the splash instead of racing the first beat. */
    try { if (SDP.Speech && SDP.Speech.preWarmBriefing) SDP.Speech.preWarmBriefing(0); } catch (eW) {}
    /* v0.0.6.q Pillar 2, Rule A — the gate timer is NOT started here. While
       the Welcome splash (#welcomeStage) is on screen the countdown must not
       burn: welcomeContinueToOverview() arms it the exact moment Stage 2 is
       revealed and Paragraph 1 starts speaking. */
    try { if (SDP.Diagnostics) SDP.Diagnostics.log('briefing_open', { replay: !!opts.replay, beta: betaActive(), weeks: weeksSinceStart() }); } catch (e) {}
    /* v0.0.6.n Pillar 2 — Trigger 2: the creator opens the Project Overview
       on the device where the vault was unlocked THIS session and the
       _intro_male_1..4 clips are missing → the Studio synthesizes them live
       on the fly (real keys, real George voice), injects them into this
       playback and caches them — the direct Studio ↔ Briefing bridge. */
    try {
      if (SDP.Studio && typeof SDP.Studio.ensureBriefingAndGuideVoices === 'function') {
        SDP.Studio.ensureBriefingAndGuideVoices({ source: 'briefing-open' }, function (err, info) {
          if (!err && info && info.made && window.__SDP_BRIEFING_BRIDGE__) {
            try { window.__SDP_BRIEFING_BRIDGE__({ source: 'briefing-open', made: info.made }); } catch (e2) {}
          }
        });
      }
    } catch (eBridge) {}
    /* v0.0.6.q: the narration start is ALWAYS owned by #btnWelcomeContinue
       (welcomeContinueToOverview), which fires it at idx = 0 inside the
       click-gesture-unlocked epoch — every open begins at Stage 1, so no
       path may narrate from here anymore. */
    return true;
  }
  function closeBriefing(viaButton) {
    var modal = byId('briefingModal');
    if (!modal || !briefingState.open) return false;
    /* v0.0.6.t Pillar 2: the PARAGRAPH-1 completion law — the briefing can be
       dismissed (Exit / ▶ Start Dictation →) once the minimum gate matured
       AND Paragraph 1 finished speaking its final word. Paragraphs 2–4 may
       still be narrating; the user's explicit choice always wins. */
    /* v0.0.6.w: an on-demand (Settings) briefing opened with every exit
       unlocked may be dismissed instantly — no gate, no Paragraph-1 lock. */
    if (briefingState.gateLeft > 0 && !briefingState.directOpen) return false;
    if (!briefingState.beat1Done && !briefingState.directOpen) return false;
    briefingState.open = false;
    briefingState.directOpen = false;
    briefingState.waitGesture = false;
    briefingState.epoch += 1;
    clearBriefingWordTimers();
    if (briefingState.gateTimer) { global.clearInterval(briefingState.gateTimer); briefingState.gateTimer = null; }
    if (briefingState.beat1Guard) { global.clearTimeout(briefingState.beat1Guard); briefingState.beat1Guard = null; }
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (modal.classList) modal.classList.remove('is-open');
    briefingHideTapPill();
    try { if (SDP.Speech && SDP.Speech.stop) SDP.Speech.stop(); } catch (e) {}
    markBriefingSeen();
    try { if (SDP.Diagnostics) SDP.Diagnostics.log('briefing_close', { via: viaButton || 'other' }); } catch (e) {}
    /* v0.0.6.q Pillar 3 — the BRIEFING → GUIDE HANDOVER: clicking the
       right-side ▶ Start Dictation → ALWAYS opens the compact Step-by-Step
       Interactive Voice User Guide from Step 1 of 4 (audio is already
       unlocked by the user's click, so the guide narrates immediately).
       A stale guide_seen stamp never suppresses the handover. */
    if (viaButton === 'continue') {
      global.setTimeout(function () { openGuide(null, { fromHandover: true }); }, 260);
    }
    return true;
  }
  function briefingGateLeft() { return briefingState.gateLeft; }
  function briefingBeat1Done() { return !!briefingState.beat1Done; }
  /* v0.0.6.t Pillar 2: the whole-briefing completion flag stays exported for
     the lab + telemetry — false until Paragraph 4's final word latches
     allBeatsDone inside briefingFinishNarration(). It never gates the
     buttons anymore (beat1Done owns the unlock). */
  function briefingAllBeatsDone() { return !!briefingState.allBeatsDone; }
  function briefingSeek(idx) {
    if (!briefingState.open) return false;
    var i = Number(idx);
    if (!(i >= 0) || i >= BRIEFING_SENTENCES.length) return false;
    /* v0.0.6.t Pillar 2 — the NO-FORWARD-SKIP law: while Paragraph 1 is still
       locked (beat1Done === false) nobody can jump AHEAD of the narration —
       tapping Paragraph 4 to skip Paragraphs 1–3 is refused. Tapping an
       already-spoken paragraph (i <= briefingState.idx) always stays
       allowed, and once Paragraph 1 completes (beat1Done === true) any
       paragraph 0..3 seeks freely. */
    if (!briefingState.beat1Done && !briefingState.directOpen && Number(idx) > briefingState.idx) return false;
    briefingState.epoch += 1;
    briefingState.waitGesture = false;
    briefingHideTapPill();
    briefingNarrate(i, briefingState.epoch);
    return true;
  }

  /* ══ v0.0.6.m — the governed Beta channel (?beta / #beta URL only) ══════
   * The v0.0.6.m suite (Project Briefing, 5-key Multi-API pool, post-session
   * reviews, diagnostics .zip) is live on the MAIN cockpit by default; the
   * Beta channel is a URL-driven testing state that stamps the sub-version
   * and replays the briefing so it can be verified on a phone in one tap.
   * The header stays ultra-clean: no pill, no floating stamp. */
  function betaFlag() { return 'sdp.beta.channel'; }
  function betaActive() {
    try { if (global.sessionStorage && global.sessionStorage.getItem(betaFlag()) === '1') return true; } catch (e) {}
    return false;
  }
  function paintBeta() {
    /* v0.0.6.m (CF1): the Beta pill left the ultra-clean header — the
       governed channel is still available at ?beta / #beta and through
       SDP.Views.applyBetaChannel(); the floating stamp is retired with it. */
    var on = betaActive();
    try { if (SDP.Diagnostics) SDP.Diagnostics.log('beta_paint', { on: !!on }); } catch (e) {}
    return on;
  }
  function applyBetaChannel(on, quiet) {
    try {
      if (global.sessionStorage) global.sessionStorage.setItem(betaFlag(), on ? '1' : '0');
    } catch (e) {}
    paintBeta();
    if (!quiet) showCapsule(on ? t('betaOnToast') : t('betaOffToast'));
    try { if (SDP.Diagnostics) SDP.Diagnostics.log('beta_channel', { on: !!on }); } catch (e) {}
    if (on) openBriefing({ replay: true, fromSettings: true });
    return true;
  }
  function initBetaFromUrl() {
    var hit = false;
    try {
      var q = String(global.location && global.location.search || '');
      var h = String(global.location && global.location.hash || '');
      hit = /[?&]beta(=1|=true)?($|&)/i.test(q) || /[#&]beta(=1|=true)?($|&)/i.test(h);
    } catch (e) {}
    if (hit && !betaActive()) applyBetaChannel(true, true);
    paintBeta();
    return betaActive();
  }

  /* ══ v0.0.6.m Pillar 3 — instant review popup + dual-engine voice ════
   * Human-factors rework of the post-session review:
   *   - the card renders at the TOP of the results view (above all 30 rows)
   *     the moment a session finishes, so it can never be missed again;
   *   - five 1-tap diagnostic chips (fast / voice_ok / voice_bad /
   *     incomplete / bug); picking any chip immediately highlights
   *     "Send Review" for a 1-second submit;
   *   - the voice review is DUAL-ENGINE: MediaRecorder captures a real
   *     compact audio clip (opus/mp4, <= 20 s, base64 inside the E2EE
   *     payload) while SpeechRecognition transcribes live in parallel;
   *     a live "Recording 0:04…" timer and a ▶ preview let the student
   *     verify 100% that their voice was recorded;
   *   - the floating corner Feedback / Quick-Help launcher (#sdpFeedbackFab)
   *     offers offline-first troubleshooting (0 AI credits) and accepts a
   *     review from ANY screen at ANY time.
   * Both "Send Review" AND "Skip — no thanks" seal the encrypted session
   * telemetry (Pillar 4) — a skip never loses the authenticity data. */
  var REVIEW_REC_MAX_MS = 20000;
  var REVIEW_B64_CAP = 160000;
  var reviewState = { pills: {}, listening: false, recog: null, voiceText: '', done: false, rec: null, recStream: null, recChunks: [], recMime: '', recStartAt: 0, recTimer: 0, recSecs: 0, voiceB64: '', voiceMime: '', previewUrl: '' };
  function reviewRecogCtor() {
    return global.SpeechRecognition || global.webkitSpeechRecognition || null;
  }
  function fmtReviewTimer(secs) {
    var m = Math.floor(secs / 60), s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function reviewStatusLine(msg, keepOpen) {
    var a = byId('reviewVoiceStatus'), b = byId('fabVoiceStatus');
    if (a) {
      if (!msg && !keepOpen) { a.hidden = true; a.textContent = ''; }
      else { a.hidden = false; a.textContent = str(msg); }
    }
    if (b) {
      if (!msg && !keepOpen) { b.hidden = true; b.textContent = ''; }
      else { b.hidden = false; b.textContent = str(msg); }
    }
    return true;
  }
  function engineTelemetry() {
    try { if (SDP.Engine && SDP.Engine.sessionTelemetry) return SDP.Engine.sessionTelemetry(); } catch (e) {}
    return null;
  }
  function syncReviewPills() {
    var pills = doc.querySelectorAll ? doc.querySelectorAll('.rpill') : [], i, node, key;
    for (i = 0; i < pills.length; i++) {
      node = pills[i];
      key = str(node.getAttribute('data-rpill'));
      node.setAttribute('aria-pressed', reviewState.pills[key] ? 'true' : 'false');
      if (node.classList) { if (reviewState.pills[key]) node.classList.add('pressed'); else node.classList.remove('pressed'); }
    }
    var send = byId('btnSendReview'), any = false, k;
    for (k in reviewState.pills) { if (reviewState.pills.hasOwnProperty(k) && reviewState.pills[k]) { any = true; break; } }
    if (send && send.classList) { if (any) send.classList.add('rpc-ready'); else send.classList.remove('rpc-ready'); }
    return true;
  }
  function paintReviewCard(model) {
    var card = byId('reviewPopupCard');
    if (!card) return false;
    reviewState.pills = {}; reviewState.voiceText = ''; reviewState.done = false;
    reviewState.voiceB64 = ''; reviewState.voiceMime = ''; reviewState.recSecs = 0;
    syncReviewPills();
    var input = byId('reviewTextInput');
    if (input) input.value = '';
    var fabInput = byId('fabReviewText');
    if (fabInput) fabInput.value = '';
    var preview = byId('reviewVoicePreview');
    if (preview) { try { preview.pause(); } catch (e) {} preview.hidden = true; preview.removeAttribute('src'); }
    reviewStatusLine('');
    card.hidden = false;
    try { card.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    var total = isObj(model) ? Number(model.total) || 0 : 0;
    var correct = isObj(model) ? Number(model.correct) || 0 : 0;
    var tel = engineTelemetry();
    var logBody = { total: total, correct: correct, mode: isObj(model) ? str(model.mode) : '', ver: APP_VERSION };
    if (tel) logBody.telemetry = tel;
    try {
      if (SDP.Diagnostics) SDP.Diagnostics.log('session_complete', logBody);
    } catch (e) {}
    return true;
  }
  function hideReviewCard() {
    var card = byId('reviewPopupCard');
    if (card) card.hidden = true;
    stopReviewVoice(false);
    /* v0.0.6.m FIX 3: hiding the card also ends any live mic session. */
    releaseFeedbackAudioLocks('review_card_hidden');
  }
  function stopReviewTracks0(stream) {
    try {
      var tracks = stream && stream.getTracks ? stream.getTracks() : [], i;
      for (i = 0; i < tracks.length; i++) { try { tracks[i].stop(); } catch (e) {} }
    } catch (e) {}
  }
  function stopReviewTracks() {
    stopReviewTracks0(reviewState.recStream);
    reviewState.recStream = null;
  }
  function assembleReviewClip() {
    stopReviewTracks();
    var chunks = reviewState.recChunks;
    reviewState.recChunks = [];
    if (!chunks.length) return false;
    try {
      var blob = new global.Blob(chunks, { type: reviewState.recMime || 'audio/webm' });
      if (reviewState.previewUrl && global.URL && global.URL.revokeObjectURL) {
        try { global.URL.revokeObjectURL(reviewState.previewUrl); } catch (e) {}
      }
      reviewState.previewUrl = (global.URL && global.URL.createObjectURL) ? global.URL.createObjectURL(blob) : '';
      var fr = new global.FileReader();
      fr.onload = function () {
        var s = str(fr.result), comma = s.indexOf(',');
        reviewState.voiceB64 = comma >= 0 ? s.slice(comma + 1) : s;
        reviewState.voiceMime = reviewState.recMime || 'audio/webm';
        var preview = byId('reviewVoicePreview');
        if (preview && reviewState.previewUrl) {
          preview.src = reviewState.previewUrl;
          preview.hidden = false;
        }
        reviewStatusLine(t('reviewRecAttached', '🎤 Voice note attached ({t}) — press ▶ to hear it before sending.').replace('{t}', fmtReviewTimer(reviewState.recSecs)));
        try { if (SDP.Diagnostics) SDP.Diagnostics.log('review_voice_attached', { secs: reviewState.recSecs, bytes: Math.round(reviewState.voiceB64.length * 0.75) }); } catch (e) {}
      };
      fr.readAsDataURL(blob);
      return true;
    } catch (e) { return false; }
  }
  /* ══ v0.0.6.m FIX 3: releaseFeedbackAudioLocks() ═══════════════════════
   * A voice review (getUserMedia + MediaRecorder + SpeechRecognition) puts
   * mobile Chrome/Safari into Voice Communication / Mic Capture mode, which
   * ducks or mutes standard media playback and can leave speechSynthesis
   * cancelled/stuck — the exact "Dictation Words mispronounce / stay muted
   * after a review" bug. This is the bulletproof release: called when
   * recording stops, when the review is sent or skipped, when the feedback
   * drawer closes, and before every dictation word / start / resume. */
  function releaseFeedbackAudioLocks(reason) {
    var had = false;
    /* 1. stop every active MediaRecorder */
    if (reviewState.rec) {
      var rec = reviewState.rec;
      reviewState.rec = null;
      had = true;
      try { if (rec.state && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); } } catch (e) {}
    }
    /* 2. stop + nullify every MediaStreamTrack so the OS exits Mic mode */
    if (reviewState.recStream) {
      had = true;
      try {
        var stream = reviewState.recStream;
        reviewState.recStream = null;
        var tracks = stream.getTracks ? stream.getTracks() : [], i;
        for (i = 0; i < tracks.length; i++) { try { tracks[i].stop(); } catch (e1) {} }
      } catch (e2) {}
    }
    /* 3. abort/stop any active SpeechRecognition */
    if (reviewState.recog) {
      had = true;
      var recog = reviewState.recog;
      reviewState.recog = null;
      try { if (recog.abort) recog.abort(); } catch (e3) {}
      try { if (recog.stop) recog.stop(); } catch (e4) {}
    }
    reviewState.listening = false;
    if (reviewState.recTimer) { global.clearInterval(reviewState.recTimer); reviewState.recTimer = 0; }
    /* 4. reset the shared <audio> (volume 1.0, muted false) and unstick
          speechSynthesis (cancel + resume) — the next word plays crisply. */
    try { if (SDP.Speech && SDP.Speech.recoverAudioSession) SDP.Speech.recoverAudioSession(reason || 'feedback'); } catch (e5) {}
    if (had) {
      try {
        if (SDP.Diagnostics) SDP.Diagnostics.log('feedback_audio_released', { reason: str(reason || 'generic') });
      } catch (e6) {}
    }
    return true;
  }
  function stopReviewVoice(attach) {
    reviewState.listening = false;
    if (reviewState.recTimer) { global.clearInterval(reviewState.recTimer); reviewState.recTimer = 0; }
    var btn = byId('btnVoiceReview'), fabBtn = byId('btnFabVoiceNote');
    if (btn && btn.classList) btn.classList.remove('listening');
    if (fabBtn && fabBtn.classList) fabBtn.classList.remove('listening');
    if (reviewState.recog) {
      try { reviewState.recog.onend = null; reviewState.recog.stop(); } catch (e) {}
      reviewState.recog = null;
    }
    var rec = reviewState.rec;
    reviewState.rec = null;
    if (rec) {
      try {
        if (attach && rec.state !== 'inactive') {
          /* keep the natural onstop so the clip is assembled, then release */
          rec.onstop = function () { try { rec.onstop = null; } catch (e0) {} assembleReviewClip(); releaseFeedbackAudioLocks('recorder_stopped'); };
          rec.stop();
          return true;
        }
        if (rec.state !== 'inactive') { rec.onstop = null; rec.stop(); }
      } catch (e) {}
      stopReviewTracks();
      reviewState.recChunks = [];
    }
    /* v0.0.6.m FIX 3: every stop path releases the mic + audio session. */
    releaseFeedbackAudioLocks('recorder_stopped');
    return true;
  }
  function startReviewRecognition() {
    var SR = reviewRecogCtor();
    if (!SR) return false;
    try {
      var recog = new SR();
      reviewState.recog = recog;
      try { recog.lang = (lang === 'si') ? 'si-LK' : 'en-GB'; } catch (e) {}
      try { recog.interimResults = false; recog.continuous = false; } catch (e) {}
      recog.onresult = function (ev) {
        var said = '';
        try {
          var r = ev && ev.results ? ev.results[0] : null;
          if (r && r[0] && r[0].transcript) said = str(r[0].transcript);
        } catch (e) {}
        if (said) {
          reviewState.voiceText = said;
          var input = byId('reviewTextInput');
          if (input) input.value = said;
          var fabInput = byId('fabReviewText');
          if (fabInput) fabInput.value = said;
        }
      };
      recog.onerror = function () {};
      recog.onend = function () { reviewState.recog = null; };
      recog.start();
      return true;
    } catch (e) { reviewState.recog = null; return false; }
  }
  function toggleReviewVoice() {
    if (reviewState.listening) { stopReviewVoice(true); return true; }
    var hasMR = !!(global.navigator && global.navigator.mediaDevices && global.navigator.mediaDevices.getUserMedia && global.MediaRecorder);
    var hasSR = !!reviewRecogCtor();
    if (!hasMR && !hasSR) {
      reviewStatusLine(t('reviewVoiceOff', 'Voice review is not supported on this browser — typing works everywhere.'));
      return false;
    }
    reviewState.listening = true;
    reviewState.recChunks = [];
    reviewState.voiceB64 = '';
    reviewState.recSecs = 0;
    reviewState.recStartAt = Date.now();
    var btn = byId('btnVoiceReview'), fabBtn = byId('btnFabVoiceNote');
    if (btn && btn.classList) btn.classList.add('listening');
    if (fabBtn && fabBtn.classList) fabBtn.classList.add('listening');
    reviewStatusLine(t('reviewRecLive', '🔴 Recording {t}… Tap to Stop & Attach').replace('{t}', '0:00'));
    reviewState.recTimer = global.setInterval(function () {
      reviewState.recSecs = Math.floor((Date.now() - reviewState.recStartAt) / 1000);
      reviewStatusLine(t('reviewRecLive', '🔴 Recording {t}… Tap to Stop & Attach').replace('{t}', fmtReviewTimer(reviewState.recSecs)), true);
    }, 250);
    /* Engine B: the live transcript (best effort — never blocks Engine A). */
    startReviewRecognition();
    /* Engine A: the REAL audio clip, <= 20 s, compact opus/mp4. */
    if (hasMR) {
      try {
        global.navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
          if (!reviewState.listening) { stopReviewTracks0(stream); return; }
          reviewState.recStream = stream;
          var mime = '';
          try {
            if (global.MediaRecorder.isTypeSupported) {
              if (global.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
              else if (global.MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';
              else if (global.MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
            }
          } catch (e3) {}
          var rec = null;
          try { rec = mime ? new global.MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 24000 }) : new global.MediaRecorder(stream); }
          catch (e2) { try { rec = new global.MediaRecorder(stream); } catch (e4) { rec = null; } }
          if (!rec) { reviewStatusLine(t('reviewVoiceError', 'Could not hear you — try again or type your note instead.')); stopReviewVoice(false); return; }
          reviewState.rec = rec;
          reviewState.recMime = str(rec.mimeType) || mime;
          rec.ondataavailable = function (ev) { if (ev && ev.data && ev.data.size) reviewState.recChunks.push(ev.data); };
          rec.onstop = function () { assembleReviewClip(); };
          rec.start(400);
          global.setTimeout(function () { if (reviewState.listening) stopReviewVoice(true); }, REVIEW_REC_MAX_MS);
        }, function () {
          reviewStatusLine(t('reviewRecMicDenied', 'Microphone permission was blocked — allow the mic or type your note instead.'));
          if (!reviewState.recog) stopReviewVoice(false);
        });
      } catch (e) {
        if (!reviewState.recog) { reviewStatusLine(t('reviewVoiceError', 'Could not hear you — try again or type your note instead.')); stopReviewVoice(false); }
      }
    }
    return true;
  }
  function sendReview(skipped) {
    if (reviewState.done) { hideReviewCard(); return true; }
    var input = byId('reviewTextInput');
    var fabInput = byId('fabReviewText');
    var text = reviewState.voiceText || str(input && input.value) || str(fabInput && fabInput.value);
    var pills = reviewState.pills || {};
    var picked = [];
    for (var k in pills) { if (pills.hasOwnProperty(k) && pills[k]) picked.push(k); }
    var payload = {
      kind: 'student_review',
      skipped: !!skipped,
      pills: picked,
      text: str(text).slice(0, 300),
      lang: lang,
      at: new Date().toISOString(),
      source: feedbackDrawerOpen() ? 'fab_drawer' : 'results_card',
      ver: APP_VERSION
    };
    if (reviewState.voiceB64 && reviewState.voiceB64.length <= REVIEW_B64_CAP) {
      payload.voiceClip = { mime: reviewState.voiceMime, secs: reviewState.recSecs, b64: reviewState.voiceB64 };
    } else if (reviewState.voiceB64) {
      try { if (SDP.Diagnostics) SDP.Diagnostics.log('review_voice_oversize', { chars: reviewState.voiceB64.length }); } catch (e) {}
    }
    /* Pillar 4: the sealed session authenticity telemetry rides along on
       BOTH paths — Send Review and Skip — No Thanks. */
    var tel = engineTelemetry();
    if (tel) payload.telemetry = tel;
    /* v0.0.6.m FIX 4: the automatic full UI + DOM + Cache + Audio snapshot
       rides on BOTH paths too — the creator can inspect the exact screen
       geometry, cache state and audio pipeline at the moment of the review. */
    try {
      if (SDP.Diagnostics && SDP.Diagnostics.captureFullUiSnapshot) {
        payload.uiSnapshot = SDP.Diagnostics.captureFullUiSnapshot();
      }
    } catch (e0) {}
    try {
      if (SDP.Diagnostics) SDP.Diagnostics.captureReview(payload);
    } catch (e) {}
    /* v0.0.7.b B6: the reaction pills and a 1–5 rating stamp the last
       telemetry session record and beacon it, so the Lecturer Studio's
       Live Activity table shows reactions against real performance. */
    try {
      if (SDP.Telemetry && SDP.Telemetry.stampLastSession && !skipped) {
        var rating = picked.length ? 5 : 4; /* pill feedback = engaged rating; text-only still counts */
        SDP.Telemetry.stampLastSession({ rating: rating, reactions: picked });
      } else if (SDP.Telemetry && SDP.Telemetry.stampLastSession && skipped) {
        SDP.Telemetry.stampLastSession({ rating: 3, reactions: ['skipped'] });
      }
    } catch (eSt2) {}
    reviewState.done = true;
    stopReviewVoice(false);
    releaseFeedbackAudioLocks('review_sent');
    hideReviewCard();
    toggleFeedbackDrawer(false);
    showCapsule(skipped ? t('reviewSkipToast') : t('reviewSentToast'));
    return true;
  }
  /* ══ v0.0.6.m Pillar 3: the floating Feedback / Quick-Help launcher ══ */
  function feedbackDrawerOpen() {
    var drawer = byId('sdpFeedbackDrawer');
    return !!(drawer && !drawer.hidden);
  }
  function fabBadgeSeen() {
    var s = settings();
    return !!(s && (s.fabBadgeSeen === 1 || s.fabBadgeSeen === '1' || s.fabBadgeSeen === true));
  }
  function paintFeedbackFab() {
    var fab = byId('sdpFeedbackFab');
    if (!fab) return false;
    fab.setAttribute('data-badge', fabBadgeSeen() ? '0' : '1');
    return true;
  }
  function markFabBadgeSeen() {
    try { SDP.Data.saveSettings({ fabBadgeSeen: 1 }); } catch (e) {}
    paintFeedbackFab();
  }
  function toggleFeedbackDrawer(open) {
    var drawer = byId('sdpFeedbackDrawer');
    var fab = byId('sdpFeedbackFab');
    if (!drawer) return false;
    var want = (open === undefined || open === null) ? !!drawer.hidden : !!open;
    drawer.hidden = !want;
    if (fab) fab.setAttribute('aria-expanded', want ? 'true' : 'false');
    if (want) { markFabBadgeSeen(); renderFabFaq(); }
    /* v0.0.6.m FIX 3: closing the drawer releases every mic / audio lock —
       the next dictation session must speak crisply. */
    if (!want) releaseFeedbackAudioLocks('drawer_closed');
    return want;
  }
  /* Offline-first FAQ: every answer is a real, checkable in-app fact —
     zero AI credits are ever spent on help text. */
  function renderFabFaq() {
    var host = byId('fabFaq');
    if (!host) return false;
    if (host.getAttribute('data-built') === '1') return true;
    var items = [['fabFaqAudio', 'fabFaqAudioA'], ['fabFaqPacing', 'fabFaqPacingA'], ['fabFaqPaper', 'fabFaqPaperA'], ['fabFaqSync', 'fabFaqSyncA']];
    var html = '', i;
    for (i = 0; i < items.length; i++) {
      html += '<details><summary>' + esc(t(items[i][0])) + '</summary><p>' + esc(t(items[i][1])) + '</p></details>';
    }
    host.innerHTML = html;
    host.setAttribute('data-built', '1');
    return true;
  }
  function bindReviewCard() {
    /* One state, every chip surface: the results popup card and the FAB
       drawer share reviewState.pills through data-rpill. */
    var pills = doc.querySelectorAll ? doc.querySelectorAll('.rpill') : [];
    for (var i = 0; i < pills.length; i++) {
      (function (node) {
        if (node._sdpBound) return;
        node._sdpBound = true;
        node.addEventListener('click', function () {
          var key = str(node.getAttribute('data-rpill'));
          reviewState.pills[key] = !reviewState.pills[key];
          syncReviewPills();
        });
      })(pills[i]);
    }
    on('btnVoiceReview', 'click', toggleReviewVoice);
    on('btnFabVoiceNote', 'click', toggleReviewVoice);
    on('btnSendReview', 'click', function () { sendReview(false); });
    on('btnSkipReview', 'click', function () { sendReview(true); });
    on('btnFabSendReview', 'click', function () { sendReview(false); });
    /* v0.0.7.b B7: manual entry to the Student Troubleshooting Guide. */
    on('btnFabTroubleshoot', 'click', function () {
      try { if (SDP.SelfHeal && SDP.SelfHeal.showTroubleshoot) { SDP.SelfHeal.showTroubleshoot('offline'); return; } } catch (e) {}
    });
    /* The floating launcher: open / close + the one-time micro-badge. */
    on('sdpFeedbackFab', 'click', function () { toggleFeedbackDrawer(); });
    on('btnFabClose', 'click', function () { toggleFeedbackDrawer(false); });
    /* The fresh-Chrome autoplay handshake: the very first tap anywhere on
       the briefing modal (pill, text, links — anything) unlocks the voice. */
    var bModal = byId('briefingModal');
    if (bModal && !bModal._sdpGestureBound) {
      bModal._sdpGestureBound = true;
      bModal.addEventListener('pointerdown', function () { briefingGestureUnlock(); });
      bModal.addEventListener('click', function () { briefingGestureUnlock(); });
    }
    /* v0.0.6.o Pillar 1 — the two-stage welcome: the Continue click unlocks
       audio INSIDE the gesture and hands over to the Project Overview. */
    on('btnWelcomeContinue', 'click', function () { welcomeContinueToOverview(); });
    paintFeedbackFab();
    return true;
  }
  function onFinished(model) {
    paintReviewCard(model);
    return true;
  }

  function init() {
    if (initialized) return false;
    initialized = true;
    var conf = settings();
    installExtensionShield();
    applyTheme(normalizeTheme(conf.theme), true);
    applyLang(conf.lang === 'si' ? 'si' : 'en', true);
    bindShell();
    paintIconHosts();
    bindTeacherUpdates();
    /* v0.0.7.b B7 + v0.0.7.c (BUG-01): the Offline Mode banner paints its
       boot state; the Get Help button opens the Student Troubleshooting
       Guide and the Retry Connection button re-probes immediately — a
       transient probe failure can always be cleared by hand. */
    try {
      paintOfflineBanner(isOfflineNow());
      var obHelp = byId('btnOfflineHelp');
      if (obHelp && !obHelp._sdpBound) {
        obHelp._sdpBound = true;
        obHelp.addEventListener('click', function () {
          try { if (SDP.SelfHeal && SDP.SelfHeal.showTroubleshoot) { SDP.SelfHeal.showTroubleshoot('offline'); return; } } catch (e) {}
          try { if (SDP.SelfHeal && SDP.SelfHeal.show) SDP.SelfHeal.show('manual', { via: 'offline_banner' }); } catch (e2) {}
        }, false);
      }
      var obRetry = byId('btnOfflineRetry');
      if (obRetry && !obRetry._sdpBound) {
        obRetry._sdpBound = true;
        obRetry.addEventListener('click', function () {
          offlineStrikes = 0;
          refreshOfflineState(true);
        }, false);
      }
    } catch (eOB) {}
    /* v0.0.7.a Z4: the lock overlay buttons arm on boot. */
    bindDictationLockOverlay();
    try { if (SDP.Engine && SDP.Engine.bind) SDP.Engine.bind(); } catch (e) {}
    setText(byId('sdpVerPill'), 'v' + APP_VERSION); /* v0.0.6.m: pill lives in the About card */
    setText(byId('aboutVersion'), APP_VERSION);
    setText(byId('brandName'), 'Smart Dictation');
    initBetaFromUrl();
    try {
      if (SDP.Diagnostics) SDP.Diagnostics.log('boot', {
        ver: APP_VERSION, beta: betaActive(),
        vw: global.innerWidth || 0, vh: global.innerHeight || 0,
        touch: !!(global.matchMedia && global.matchMedia('(hover: none)').matches)
      });
    } catch (e) {}
    renderHome();
    renderWords();
    renderPractice();
    renderGuideSteps();
    renderSettings();
    /* v0.0.7.c (BUG-01 #3): no literal-8 'synced' badge before the boot
       settles — the badge stays honest until real data arrives. */
    paintSyncBadge({ state: 'synced', session: syncSessionNo() });
    /* v0.0.6.m Pillar 1: a brand-new visitor gets the Project Briefing first;
       the student guide follows the moment the briefing closes. Returning
       students (any guide_seen stamp) are never interrupted again.
       v0.0.6.o: the boot path always opens the CINEMATIC WELCOME stage —
       because briefingSeen() only matches THIS release, every existing
       phone/PC and every brand-new visitor meets the animated splash and
       unlocks audio through the Continue gesture.
       v0.0.6.q Pillar 2 — THE GUARANTEED WELCOME LAW: the two-stage entry
       fires whenever !briefingSeen() ALONE — a stale sdp.guide_seen stamp
       from an earlier release can never hide the Welcome splash again (the
       exact v0.0.6.o field bug: `!briefingSeen() && !guideSeen()` skipped
       the whole briefing on every phone that had seen an older guide). */
    /* v0.0.6.w — the NO-BOOT-BRIEFING LAW: students and users opening the app
       must NEVER be blocked or interrupted by the Project Briefing or the
       Welcome splash on startup. The boot goes straight into the main
       Dictation screen; the Project Briefing lives ONLY behind the Settings ›
       About › Project Briefing button (#btnCreatorNote), narrating on demand. */
    try { SDP.Data.saveSettings({ briefingSeen: APP_VERSION }); } catch (eBS) {}
    try { if (SDP.Diagnostics) SDP.Diagnostics.log('briefing_boot_retired', { ver: APP_VERSION }); } catch (eBL) {}
    showToast();
    try { SDP.Sync.registerSW(); } catch (e) {}
    try {
      SDP.Sync.boot({}, function (err) { onDataReady(err); });
    } catch (e) { onDataReady(e); }
    return true;
  }

  var ICON_PATHS = {
    play: { f: 'M8.6 5.2a1.4 1.4 0 011.5 0l9.6 5.9a1.4 1.4 0 010 2.4l-9.6 5.9a1.4 1.4 0 01-1.5 0z', s: 'M8.6 5.2a1.4 1.4 0 011.5 0l9.6 5.9a1.4 1.4 0 010 2.4l-9.6 5.9a1.4 1.4 0 01-1.5 0z' },
    pause: { f: 'M7 5.5a1.5 1.5 0 011.5-1.5h1A1.5 1.5 0 0111 5.5v13A1.5 1.5 0 019.5 20h-1A1.5 1.5 0 017 18.5zM14.5 5.5A1.5 1.5 0 0116 4h1a1.5 1.5 0 011.5 1.5v13A1.5 1.5 0 0117 20h-1a1.5 1.5 0 01-1.5-1.5z', s: 'M7 5.5a1.5 1.5 0 011.5-1.5h1A1.5 1.5 0 0111 5.5v13A1.5 1.5 0 019.5 20h-1A1.5 1.5 0 017 18.5zM14.5 5.5A1.5 1.5 0 0116 4h1a1.5 1.5 0 011.5 1.5v13A1.5 1.5 0 0117 20h-1a1.5 1.5 0 01-1.5-1.5z' },
    stop: { f: 'M6.5 6.5h11v11h-11z', s: 'M6.5 6.5h11v11h-11z' },
    prev: { f: 'M6 5.5A1.5 1.5 0 017.5 4h1A1.5 1.5 0 0110 5.5v13A1.5 1.5 0 018.5 20h-1A1.5 1.5 0 016 18.5zM19.4 5.6a1.3 1.3 0 011.6 1.2v10.4a1.3 1.3 0 01-1.6 1.2l-8.9-5.2a1.3 1.3 0 010-2.4z', s: 'M6 5.5A1.5 1.5 0 017.5 4h1A1.5 1.5 0 0110 5.5v13A1.5 1.5 0 018.5 20h-1A1.5 1.5 0 016 18.5zM19.4 5.6a1.3 1.3 0 011.6 1.2v10.4a1.3 1.3 0 01-1.6 1.2l-8.9-5.2a1.3 1.3 0 010-2.4z' },
    next: { f: 'M18 5.5A1.5 1.5 0 0016.5 4h-1A1.5 1.5 0 0014 5.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5zM4.6 5.6a1.3 1.3 0 00-1.6 1.2v10.4a1.3 1.3 0 001.6 1.2l8.9-5.2a1.3 1.3 0 000-2.4z', s: 'M18 5.5A1.5 1.5 0 0016.5 4h-1A1.5 1.5 0 0014 5.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5zM4.6 5.6a1.3 1.3 0 00-1.6 1.2v10.4a1.3 1.3 0 001.6 1.2l8.9-5.2a1.3 1.3 0 000-2.4z' },
    replay: { f: 'M12 3.2a8.8 8.8 0 11-8.6 10.6 1 1 0 011.9-.5A6.8 6.8 0 1012 5.2V8l4.2-3.2L12 1.6z', s: 'M12 3.2a8.8 8.8 0 11-8.6 10.6 1 1 0 011.9-.5A6.8 6.8 0 1012 5.2V8l4.2-3.2L12 1.6z' },
    repeat: { f: 'M6.8 7.5A3.3 3.3 0 0110 4.2h8.6a3.3 3.3 0 013.3 3.3v6.4a3.3 3.3 0 01-3.3 3.3H10a3.3 3.3 0 01-3.2-3.3z', s: 'M4 9a4 4 0 014-4h12M20 16a4 4 0 01-4 4H4M16 1l4 3-4 3M8 23l-4-3 4-3' },
    volume: { f: 'M11 5.4a1 1 0 011.6-.8l4.9 3.6a1 1 0 01-.1 1.7l-4.8 2.8a1 1 0 01-1.6-.9z', s: 'M11 5L6 9H2v6h4l5 4zM14.8 9.2a4.2 4.2 0 010 5.6M17.6 6.4a8.2 8.2 0 010 11.2' },
    volumeOff: { f: 'M11 5L6 9H2v6h4l5 4z', s: 'M11 5L6 9H2v6h4l5 4zM16 9l5 6M21 9l-5 6' },
    mic: { f: 'M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3z', s: 'M8 11a4 4 0 008 0M12 15v4M9 21h6M7 11a5 5 0 0010 0' },
    bulb: { f: 'M12 3.2a5.8 5.8 0 00-3.5 10.4c.6.5.9 1.2 1 2.1h5c.1-.9.4-1.6 1-2.1A5.8 5.8 0 0012 3.2z', s: 'M9.5 16.6h5M10 19.4h4M12 1.8v1.2M4 5.2l1.1 1.1M20 5.2l-1.1 1.1M12 6.5v6' },
    check: { f: 'M12 2.6a9.4 9.4 0 100 18.8 9.4 9.4 0 000-18.8z', s: 'M20 6.5L9.4 17.2l-5.2-5.2' },
    checkCircle: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M8 12.5l2.8 2.8L16 9.5' },
    close: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M6 6l12 12M18 6L6 18' },
    plus: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 5v14M5 12h14' },
    minus: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M5 12h14' },
    home: { f: 'M12 3l9 7.5v10.5H3V10.5z', s: 'M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5' },
    headphones: { f: 'M12 3a8 8 0 018 8v5h-3v-5a5 5 0 00-10 0v5H4v-5a8 8 0 018-8z', s: 'M4 14v-2a8 8 0 0116 0v2M4 14h3v6H4zM17 14h3v6h-3z' },
    sparkles: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.9 2.6 2.1.9-2.1.9L19 22l-.9-2.6-2.1-.9 2.1-.9L19 15z' },
    list: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01' },
    gear: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.8 1.4-1.8 3.1-2.2-.9a7 7 0 0 1-1.7 1L15.2 20h-3.6l-.3-2.5a7 7 0 0 1-1.7-1l-2.2.9-1.8-3.1 1.8-1.4a7 7 0 0 1 0-2l-1.8-1.4 1.8-3.1 2.2.9a7 7 0 0 1 1.7-1L11.6 2.6h3.6l.3 2.5a7 7 0 0 1 1.7 1l2.2-.9 1.8 3.1-1.8 1.4a7 7 0 0 1 0 2z' },
    sliders: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M4 7h10M18 7h2M4 17h4M12 17h8M15 4v6M8 14v6' },
    cap: { f: 'M12 4L1 9l11 5 9-4.1V15h2V9L12 4z', s: 'M12 4L1 9l11 5 9-4.1V15h2V9L12 4zM5 13.5V17c0 1.7 3.1 3 7 3s7-1.3 7-3v-3.5' },
    book: { f: 'M4 4a2 2 0 012-2h13v18H6a2 2 0 00-2 2V4z', s: 'M4 4a2 2 0 012-2h13v18H6a2 2 0 00-2 2V4zM4 20a2 2 0 012-2h13' },
    sun: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' },
    moon: { f: 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z', s: 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z' },
    eye: { f: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z', s: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z' },
    eyeOff: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A9.8 9.8 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A16.6 16.6 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 4-.8' },
    search: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M11 4a7 7 0 100 14 7 7 0 000-14zM16.5 16.5L21 21' },
    download: { f: 'M5 14v6h14v-6', s: 'M12 3v12M7 11l5 5 5-5M4 20h16' },
    upload: { f: 'M4 4h16v2H4z', s: 'M12 20V8M7 12l5-5 5 5M4 20h16' },
    cloud: { f: 'M7 18h10a4 4 0 000-8 6 6 0 00-11.6 1.6A3.5 3.5 0 006 18z', s: 'M7 18h10a4 4 0 000-8 6 6 0 00-11.6 1.6A3.5 3.5 0 006 18z' },
    cloudOff: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M3 3l18 18M7 18h9M18.5 14.5A4 4 0 0017 7a6 6 0 00-9.3 2.1' },
    sync: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M20 12a8 8 0 01-13.7 5.6M4 12a8 8 0 0113.7-5.6M4 4v5h5M20 20v-5h-5' },
    lock: { f: 'M5 11h14v9H5z', s: 'M8 11V8a4 4 0 018 0v3M5 11h14v9H5z' },
    unlock: { f: 'M5 11h14v9H5z', s: 'M8 11V8a4 4 0 017-2.6M5 11h14v9H5z' },
    key: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M14 4a6 6 0 00-5.6 8.1L3 17.5V21h3.5l1-1v-2h2v-2h2l1.1-1.1A6 6 0 1014 4z' },
    shield: { f: 'M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5z', s: 'M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5z' },
    user: { f: 'M12 12a4 4 0 100-8 4 4 0 000 8z', s: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0' },
    users: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 21a7 7 0 0114 0M17 4.5a3.5 3.5 0 010 7M18 14a6 6 0 014 6' },
    edit: { f: 'M4 20l1.5-5L16 4.5 19.5 8 9 18.5z', s: 'M14.5 6L18 9.5M4 20l1.5-5L16 4.5 19.5 8 9 18.5z' },
    trash: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6' },
    save: { f: 'M5 3h11l3 3v15H5z', s: 'M5 3h11l3 3v15H5zM8 3v6h8V3M8 13h8v8H8z' },
    table: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M3 4h18v16H3zM3 9h18M3 14.5h18M9 9v11M15 9v11' },
    chart: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M4 20V6M4 20h16M8 20v-6M13 20v-9M18 20v-4' },
    clock: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 7v5l3.5 2M12 3a9 9 0 100 18 9 9 0 000-18z' },
    alert: { f: 'M12 3l10 18H2z', s: 'M12 3l10 18H2zM12 9v5M12 17h.01' },
    info: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7h.01' },
    star: { f: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z', s: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z' },
    heart: { f: 'M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0112 6a4.8 4.8 0 018.5 3.3C20.5 15 12 20.5 12 20.5z', s: 'M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0112 6a4.8 4.8 0 018.5 3.3C20.5 15 12 20.5 12 20.5z' },
    mail: { f: 'M3 5h18v14H3z', s: 'M3 5h18v14H3zM3 6l9 7 9-7' },
    github: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 4.5-1.4 4.5-5a4 4 0 00-1.1-2.8 3.7 3.7 0 00-.1-2.8s-1.2-.3-3.9 1.5a9.3 9.3 0 00-5 0C6.2 2.6 5 2.9 5 2.9a3.7 3.7 0 00-.1 2.8A4 4 0 003.8 8.5c0 3.6 1.7 4.7 4.5 5-.6.6-.5 1-.5 2V21' },
    globe: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.4 3.9 5.5 4 9-.1 3.5-1.5 6.6-4 9-2.5-2.4-3.9-5.5-4-9 .1-3.5 1.5-6.6 4-9z' },
    folder: { f: 'M3 6h6l2 2h10v11H3z', s: 'M3 6h6l2 2h10v11H3zM3 9h18' },
    target: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5a.5.5 0 100 1 .5.5 0 000-1z' },
    keyboard: { f: 'M3 7h18v10H3z', s: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8' }
  };
  function iconNames() {
    var out = [], k;
    for (k in ICON_PATHS) { if (ICON_PATHS.hasOwnProperty(k)) out.push(k); }
    return out;
  }
  function svgIcon(name, size, extraClass) {
    var key = ICON_PATHS[name] ? name : 'sparkles';
    var ic = ICON_PATHS[key];
    var s = Number(size) || 18;
    return '<svg class="sdp-icon sdp-icon-' + esc(key) + (extraClass ? ' ' + esc(extraClass) : '') +
      '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path class="ic-fill" d="' + ic.f + '"/><path class="ic-stroke" d="' + ic.s + '"/></svg>';
  }
  /* Hosts declared in index.html as <span data-icon="name"> are painted once,
     so the shell ships semantic placeholders instead of emoji. */
  function paintIconHosts() {
    if (!doc || !doc.querySelectorAll) return 0;
    var hosts = doc.querySelectorAll('[data-icon]'), i, host, name, painted = 0;
    for (i = 0; i < hosts.length; i++) {
      host = hosts[i];
      name = host.getAttribute('data-icon');
      if (!name || !ICON_PATHS[name]) continue;
      if (host.querySelector && host.querySelector('svg')) continue;
      host.innerHTML = svgIcon(name, Number(host.getAttribute('data-icon-size')) || 18);
      painted += 1;
    }
    return painted;
  }


  /* ═══════════════════ v0.0.6.v — SMALL-DEVICE & iOS BRIEFING LAWS ═════════ */
  /* briefingContentHash(): the returning-student exemption — the briefing
     replays only when the CONTENT changed (hash of BRIEFING_SENTENCES), not
     on every version bump. Stored inside sdp.settings (five-key law). */
  function briefingSimpleHash(s) {
    var h = 5381, i;
    s = String(s || '');
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0x7FFFFFFF;
    return String(h);
  }
  function briefingContentHash() {
    try { return briefingSimpleHash(BRIEFING_SENTENCES.join('|')); } catch (e) { return ''; }
  }
  function briefingContentSeen() {
    var s = settings();
    return !!(s && s.briefingContentHash && s.briefingContentHash === briefingContentHash());
  }
  function markBriefingContentSeen() {
    try { SDP.Data.saveSettings({ briefingContentHash: briefingContentHash() }); } catch (e) {}
  }

  /* The top-right Skip (never disabled): closes the briefing at once, stops
     the narration, stamps briefingSeen + briefingContentHash, releases the
     scroll lock and logs the viewport (small-device diagnostics). */
  function briefingSkipTop() {
    var modal = byId('briefingModal');
    if (!modal || !briefingState.open) return false;
    briefingState.open = false;
    briefingState.waitGesture = false;
    briefingState.epoch += 1;
    clearBriefingWordTimers();
    if (briefingState.gateTimer) { global.clearInterval(briefingState.gateTimer); briefingState.gateTimer = null; }
    if (briefingState.beat1Guard) { global.clearTimeout(briefingState.beat1Guard); briefingState.beat1Guard = null; }
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (modal.classList) modal.classList.remove('is-open');
    briefingHideTapPill();
    try { if (SDP.Speech && SDP.Speech.stop) SDP.Speech.stop(); } catch (e) {}
    markBriefingSeen();
    markBriefingContentSeen();
    releaseBodyScrollLock();
    try {
      if (SDP.Diagnostics) SDP.Diagnostics.log('briefing_skip_top', { vw: global.innerWidth || 0, vh: global.innerHeight || 0 });
    } catch (e2) {}
    return true;
  }

  /* F5: lock background scroll while ANY modal is open. */
  function syncBodyScrollLock() {
    var body = global.document && global.document.body;
    if (!body || !body.classList) return false;
    var open = global.document.querySelectorAll('.modal.is-open').length;
    if (open) body.classList.add('modal-open');
    else body.classList.remove('modal-open');
    return true;
  }
  function releaseBodyScrollLock() {
    var body = global.document && global.document.body;
    if (body && body.classList) body.classList.remove('modal-open');
    return true;
  }

  /* F1: --tabbar-h measured from the real #tabbar rect on first paint. */
  function measureTabbarHeight() {
    try {
      var bar = byId('tabbar');
      if (!bar || !bar.getBoundingClientRect) return false;
      var h = Math.round(bar.getBoundingClientRect().height);
      if (h > 40 && global.document && global.document.documentElement) {
        global.document.documentElement.style.setProperty('--tabbar-h', h + 'px');
      }
    } catch (e) {}
    return true;
  }

  /* v0.0.6.v boot wiring for the new laws. */
  function initV006v() {
    measureTabbarHeight();
    if (global.addEventListener) global.addEventListener('resize', measureTabbarHeight, false);
    /* F6: pause the gate countdown while the tab is hidden. */
    if (global.document && global.document.addEventListener) {
      global.document.addEventListener('visibilitychange', function () {
        if (global.document.visibilityState === 'hidden') {
          if (briefingState.gateTimer) { global.clearInterval(briefingState.gateTimer); briefingState.gateTimer = null; }
        } else if (briefingState.open && briefingState.gateLeft > 0 && !briefingState.gateTimer) {
          briefingState.gateTimer = global.setInterval(briefingTickGate, 1000);
        }
        syncBodyScrollLock();
      }, false);
    }
    /* pack-load pause for the crest orbit animation */
    try {
      var rootEl = global.document.documentElement;
      if (rootEl && rootEl.classList) {
        rootEl.classList.add('sdp-pack-loading');
        var donePack = function () { rootEl.classList.remove('sdp-pack-loading'); };
        if (SDP.Speech && SDP.Speech.loadManifest) SDP.Speech.loadManifest(function () { donePack(); });
        else donePack();
        global.setTimeout(donePack, 12000);
      }
      if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches && rootEl && rootEl.classList) {
        rootEl.classList.add('prefers-reduced-motion');
      }
    } catch (e) {}
    /* the returning-student content-hash exemption: a version bump alone no
       longer forces a replay once the content hash matches (first-visit and
       content-change replays stay intact through briefingSeen()). */
    try {
      if (!briefingSeen() && briefingContentSeen()) {
        SDP.Data.saveSettings({ briefingSeen: APP_VERSION });
      }
    } catch (e2) {}
    /* preWarmBriefing / manifest failure can never trap the student: the
       9 s failsafe already arms beat1Done, and a failed pack load arms it
       at once so the footer unlocks with the gate. */
    try {
      if (SDP.Speech && SDP.Speech.loadManifest) {
        SDP.Speech.loadManifest(function (err) {
          if (err && briefingState.open && !briefingState.beat1Done) {
            briefingState.beat1Done = true;
            briefingCheckGateUnlock();
          }
        });
      }
    } catch (e3) {}
    /* T1: surface a manifest load failure through the Self-Heal assistant. */
    try {
      if (SDP.Speech && SDP.Speech.loadManifest) {
        SDP.Speech.loadManifest(function (err) {
          if (err && SDP.SelfHeal && SDP.SelfHeal.show) SDP.SelfHeal.show('T1', { lastErr: String(err && err.message || err) });
        });
      }
    } catch (e4) {}
    syncBodyScrollLock();
  }
  initV006v();

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
    /* v0.0.7.a Z4 — the strict Dictation Mode lock overlay painter. */
    paintDictationLockOverlay: paintDictationLockOverlay,
    /* R6: showScreen is the documented alias of the one router (D10). */
    showScreen: showTab,
    currentTab: currentTab,
    pauseForNavigation: pauseForNavigation,
    paintPresetBadge: paintPresetBadge,
    presetLabel: presetLabel,
    renderHome: renderHome,
    renderWords: renderWords,
    renderPractice: renderPractice,
    renderSettings: renderSettings,
    renderAll: renderAll,
    refreshAll: renderAll,
    paintLecturerBar: paintLecturerBar,
    renderGuideSteps: renderGuideSteps,
    settingsOrder: settingsOrder,
    applyModePills: applyModePills,
    startDictation: startDictation,
    resumeDictation: resumeDictation,
    startPractice: startPractice,
    openGuide: openGuide,
    openGuideQuick: openGuideQuick,
    finishQuickGuide: finishQuickGuide,
    beginDictation: beginDictation,
    sessionIntroShown: function () { return !!sessionState.introShown; },
    openStudio: openStudio,
    startOver: startOver,
    /* ══ v0.0.6.m public surface: briefing, beta channel, review card ══ */
    openBriefing: openBriefing,
    closeBriefing: closeBriefing,
    briefingSkipTop: briefingSkipTop,
    briefingContentHash: briefingContentHash,
    briefingContentSeen: briefingContentSeen,
    measureTabbarHeight: measureTabbarHeight,
    syncBodyScrollLock: syncBodyScrollLock,
    briefingSentences: briefingSentences,
    briefingSeen: briefingSeen,
    briefingGateLeft: briefingGateLeft,
    briefingBeat1Done: briefingBeat1Done,
    briefingAllBeatsDone: briefingAllBeatsDone,
    briefingSeek: briefingSeek,
    briefingIsOpen: function () { return !!briefingState.open; },
    /* v0.0.6.m: the frame-accurate karaoke clock + mic-release surface. */
    onBriefingClockTick: onBriefingClockTick,
    onBriefingBoundary: onBriefingBoundary,
    /* v0.0.6.n: the exact /with-timestamps word boundaries for the lab. */
    briefingWordTimings: briefingWordTimings,
    /* v0.0.6.q: the live weekly counter so the Studio's briefingVoiceDelta()
       stamps and checks the exact same weekStamp the header renders. */
    weeksSinceStart: weeksSinceStart,
    /* v0.0.6.o: the live karaoke clock mode ('estimate' until the first real
       onTick/onBoundary, then 'clock') so the lab can wait for the documented
       estimate→clock handoff instead of guessing with a fixed sleep. */
    briefingFlowMode: function () { var f = briefingFlowState(); return f && f.active ? f.mode : ''; },
    /* v0.0.6.o: the two-stage cinematic welcome surface for the lab. */
    welcomeStageVisible: welcomeStageVisible,
    welcomeContinueToOverview: welcomeContinueToOverview,
    releaseFeedbackAudioLocks: releaseFeedbackAudioLocks,
    reviewVoiceActive: function () { return !!(reviewState.listening || reviewState.rec || reviewState.recog || reviewState.recStream); },
    betaSubversion: function () { return BETA_SUBVERSION; },
    betaActive: betaActive,
    applyBetaChannel: applyBetaChannel,
    onFinished: onFinished,
    paintReviewCard: paintReviewCard,
    hideReviewCard: hideReviewCard,
    sendReview: sendReview,
    paintCues: paintCues,
    cuesSeen: cuesSeen,
    markCueSeen: markCueSeen,
    paintHomeWordsPreview: paintHomeWordsPreview,
    markDictWord: markDictWord,
    paintLecturerBanner: paintLecturerBanner,
    renderBoardBar: renderBoardBar,
    renderBoardJumper: renderBoardJumper,
    toggleBoardWord: toggleBoardWord,
    resetBoardReveal: resetBoardReveal,
    paintBoardWord: paintBoardWord,
    closeGuide: closeGuide,
    speakGuide: speakGuide,
    startGuideNarration: startGuideNarration,
    showGuideTapBanner: showGuideTapBanner,
    hideGuideTapBanner: hideGuideTapBanner,
    showGuideAutoplayBanner: showGuideAutoplayBanner,
    hideGuideAutoplayBanner: hideGuideAutoplayBanner,
    guideAutoplayBannerVisible: guideAutoplayBannerVisible,
    armGuideAutoplayWatch: armGuideAutoplayWatch,
    showToast: showToast,
    showCapsule: showCapsule,
    onWordsRefresh: onWordsRefresh,
    onEngineWordChanged: onEngineWordChanged,
    toggleRevealCard: toggleRevealCard,
    toggleHintPanel: toggleHintPanel,
    showHintPanel: showHintPanel,
    hideHintPanel: hideHintPanel,
    installExtensionShield: installExtensionShield,
    paintUpdateCard: paintUpdateCard,
    isOfflineNow: isOfflineNow,
    toastText: toastText,
    checkForUpdate: checkForUpdate,
    setUpdateStatus: setUpdateStatus,
    onDataReady: onDataReady
  };
  SDP.Views = Views;
  Views.Icons = { icon: svgIcon, names: iconNames, count: function () { return iconNames().length; }, paint: paintIconHosts };
  SDP.Icons = Views.Icons;
  SDP.STRINGS_EN = STRINGS_EN;
  SDP.STRINGS_SI = STRINGS_SI;

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { init(); });
    else init();
  }
})(typeof window !== 'undefined' ? window : this);
